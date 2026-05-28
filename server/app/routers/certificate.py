from datetime import datetime, timezone
import os
import secrets
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from fpdf import FPDF
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.certificate import Certificate
from app.models.curriculum import Curriculum
from app.models.task_submission import TaskSubmission
from app.models.user import User
from app.schemas.certificate import (
    CertificateEligibilityResponse,
    CertificateIssueRequest,
    CertificateResponse,
)
from app.services.attachment_storage import (
    AttachmentNotFoundError,
    AttachmentStorageError,
    open_object,
    save_object,
)

router = APIRouter(prefix="/api/certificates", tags=["certificates"])

current_file = os.path.abspath(__file__)
router_dir = os.path.dirname(current_file)
app_dir = os.path.dirname(router_dir)
server_dir = os.path.dirname(app_dir)
FONT_PATH = os.path.join(server_dir, "resources", "fonts", "NanumGothic.ttf")


def _assigned_learner_ids(curriculum: Curriculum) -> set[int]:
    raw = curriculum.cur_assigned_learner_ids
    if not isinstance(raw, list):
        return set()
    return {int(value) for value in raw if isinstance(value, int) or str(value).isdigit()}


def _expected_weeks(curriculum: Curriculum) -> list[int]:
    # 수료 판정은 현재 제출 모델이 주차 단위라서, 커리큘럼의 주차 목록을 기준으로 계산한다.
    week_plan = curriculum.cur_week_plan
    if isinstance(week_plan, list) and week_plan:
        weeks = sorted(
            {
                int(item["week"])
                for item in week_plan
                if isinstance(item, dict)
                and item.get("week") is not None
                and str(item.get("week")).isdigit()
            }
        )
        if weeks:
            return weeks
    return list(range(1, int(curriculum.cur_duration_weeks or 0) + 1))


def _load_curriculum_for_issue(db: Session, current_user: User, cur_id: int) -> Curriculum:
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=403, detail="Only managers/admins can issue certificates")

    curriculum = (
        db.query(Curriculum)
        .filter(Curriculum.cur_id == cur_id, Curriculum.cur_deleted_at.is_(None))
        .first()
    )
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    if current_user.user_role == "m" and curriculum.cur_creator_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    return curriculum


def _load_assigned_learner(db: Session, curriculum: Curriculum, learner_id: int) -> User:
    learner = (
        db.query(User)
        .filter(
            User.user_id == learner_id,
            User.user_role == "j",
            User.user_deleted_at.is_(None),
        )
        .first()
    )
    if not learner or learner.user_id not in _assigned_learner_ids(curriculum):
        raise HTTPException(status_code=404, detail="Assigned learner not found")
    return learner


def _latest_submissions_by_week(
    db: Session,
    curriculum_id: int,
    learner_id: int,
) -> dict[int, TaskSubmission]:
    submissions = (
        db.query(TaskSubmission)
        .filter(
            TaskSubmission.task_curriculum_id == curriculum_id,
            TaskSubmission.task_learner_id == learner_id,
        )
        .order_by(
            TaskSubmission.task_week_number.asc(),
            TaskSubmission.task_submitted_at.asc(),
            TaskSubmission.task_submission_id.asc(),
        )
        .all()
    )
    latest: dict[int, TaskSubmission] = {}
    for submission in submissions:
        latest[submission.task_week_number] = submission
    return latest


def _build_eligibility(
    db: Session,
    curriculum: Curriculum,
    learner: User,
) -> CertificateEligibilityResponse:
    expected = _expected_weeks(curriculum)
    latest = _latest_submissions_by_week(db, curriculum.cur_id, learner.user_id)

    # 모든 주차가 제출되고, 재제출 요청 없이 피드백 완료된 경우에만 발급 가능하다.
    completed: list[int] = []
    missing: list[int] = []
    pending_feedback: list[int] = []
    resubmit_requested: list[int] = []

    for week in expected:
        submission = latest.get(week)
        if not submission:
            missing.append(week)
            continue
        if submission.task_resubmit_requested == "Y" or submission.task_status == "resubmit_requested":
            resubmit_requested.append(week)
            continue
        if submission.task_status != "feedback_given":
            pending_feedback.append(week)
            continue
        completed.append(week)

    eligible = bool(expected) and not missing and not pending_feedback and not resubmit_requested
    reason = None
    if not expected:
        reason = "No curriculum weeks configured"
    elif missing:
        reason = "Some weeks have no submission"
    elif resubmit_requested:
        reason = "Some weeks require resubmission"
    elif pending_feedback:
        reason = "Some weeks are waiting for manager feedback"

    return CertificateEligibilityResponse(
        eligible=eligible,
        curriculum_id=curriculum.cur_id,
        learner_id=learner.user_id,
        expected_weeks=expected,
        completed_weeks=completed,
        missing_weeks=missing,
        pending_feedback_weeks=pending_feedback,
        resubmit_requested_weeks=resubmit_requested,
        reason=reason,
    )


def _certificate_response(certificate: Certificate) -> CertificateResponse:
    # 수료증은 발급 당시의 이름/커리큘럼명을 스냅샷 컬럼에 저장해 이후 원본 변경 영향을 받지 않는다.
    return CertificateResponse(
        cert_id=certificate.cert_id,
        cert_no=certificate.cert_no,
        cert_curriculum_id=certificate.cert_curriculum_id,
        cert_learner_id=certificate.cert_learner_id,
        cert_issuer_id=certificate.cert_issuer_id,
        cert_title=certificate.cert_title,
        cert_curriculum_title=certificate.cert_curriculum_title,
        cert_learner_name=certificate.cert_learner_name,
        cert_issuer_name=certificate.cert_issuer_name,
        cert_storage_key=certificate.cert_storage_key,
        cert_issued_at=certificate.cert_issued_at,
        cert_completed_at=certificate.cert_completed_at,
        cert_deleted_at=certificate.cert_deleted_at,
        learner_name=certificate.cert_learner_name,
        learner_email=certificate.learner.user_email if certificate.learner else None,
        curriculum_title=certificate.cert_curriculum_title,
        issuer_name=certificate.cert_issuer_name,
    )


def _generate_cert_no(db: Session, issued_at: datetime) -> str:
    # 사람이 확인하기 쉬운 번호 + 짧은 랜덤 suffix로 중복 가능성을 낮춘다.
    prefix = issued_at.strftime("AC-%Y%m%d")
    for _ in range(10):
        cert_no = f"{prefix}-{secrets.token_hex(3).upper()}"
        exists = db.query(Certificate.cert_id).filter(Certificate.cert_no == cert_no).first()
        if not exists:
            return cert_no
    raise HTTPException(status_code=500, detail="Certificate number could not be generated")


def _completed_at_from_submissions(
    db: Session,
    curriculum_id: int,
    learner_id: int,
    completed_weeks: list[int],
) -> datetime | None:
    # 모든 완료 주차 중 마지막 피드백/제출 시각을 교육 완료일로 사용한다.
    latest = _latest_submissions_by_week(db, curriculum_id, learner_id)
    completed_dates = [
        submission.task_feedback_at or submission.task_submitted_at
        for week, submission in latest.items()
        if week in completed_weeks and (submission.task_feedback_at or submission.task_submitted_at)
    ]
    return max(completed_dates) if completed_dates else None


def _pdf_bytes(
    *,
    title: str,
    cert_no: str,
    curriculum_title: str,
    duration_weeks: int,
    learner_name: str,
    issuer_name: str,
    issued_at: datetime,
    completed_at: datetime | None,
) -> bytes:
    # 실제 수료증 PDF 레이아웃을 만드는 함수. 템플릿 문구/배치는 여기서 수정한다.
    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=False)
    pdf.add_page()

    has_font = os.path.exists(FONT_PATH)
    if has_font:
        pdf.add_font("NanumGothic", "", FONT_PATH, uni=True)
        font = "NanumGothic"
    else:
        font = "Arial"

    pdf.set_draw_color(57, 74, 171)
    pdf.set_line_width(1.2)
    pdf.rect(12, 12, 273, 186)
    pdf.set_draw_color(118, 149, 255)
    pdf.set_line_width(0.4)
    pdf.rect(18, 18, 261, 174)

    pdf.set_text_color(31, 41, 55)
    pdf.set_font(font, "", 28)
    pdf.ln(34)
    pdf.cell(0, 16, title, ln=True, align="C")

    pdf.set_font(font, "", 13)
    pdf.set_text_color(75, 85, 99)
    pdf.cell(0, 10, "ArtiCulum Learning Certificate", ln=True, align="C")
    pdf.ln(16)

    pdf.set_text_color(17, 24, 39)
    pdf.set_font(font, "", 20)
    pdf.cell(0, 14, learner_name, ln=True, align="C")

    pdf.set_font(font, "", 12)
    pdf.set_text_color(55, 65, 81)
    pdf.multi_cell(
        0,
        8,
        f"{curriculum_title} 과정을 성실히 이수하였음을 증명합니다.",
        align="C",
    )
    pdf.ln(8)

    info_lines = [
        f"수료증 번호: {cert_no}",
        f"과정명: {curriculum_title}",
        f"학습 기간: {duration_weeks}주",
        f"완료일: {completed_at.strftime('%Y-%m-%d') if completed_at else '-'}",
        f"발급일: {issued_at.strftime('%Y-%m-%d')}",
        f"발급자: {issuer_name}",
    ]

    pdf.set_font(font, "", 10)
    pdf.set_text_color(75, 85, 99)
    for line in info_lines:
        pdf.cell(0, 7, line, ln=True, align="C")

    pdf.set_y(174)
    pdf.set_font(font, "", 12)
    pdf.set_text_color(31, 41, 55)
    pdf.cell(0, 8, "ArtiCulum", ln=True, align="C")

    out = pdf.output(dest="S")
    return out.encode("latin-1") if isinstance(out, str) else bytes(out)


def _download_headers(filename: str) -> dict[str, str]:
    fallback = filename.encode("ascii", "ignore").decode("ascii") or "certificate.pdf"
    encoded = quote(filename, safe="")
    return {
        "Content-Disposition": f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{encoded}"
    }


def _can_access_certificate(certificate: Certificate, user: User) -> bool:
    # 관리자 전체, 학습자 본인, 커리큘럼 담당 매니저만 수료증에 접근할 수 있다.
    if user.user_role == "a":
        return True
    if user.user_role == "j":
        return certificate.cert_learner_id == user.user_id
    if user.user_role == "m":
        return (
            certificate.cert_issuer_id == user.user_id
            or (
                certificate.curriculum is not None
                and certificate.curriculum.cur_creator_id == user.user_id
            )
        )
    return False


@router.get("/eligibility", response_model=CertificateEligibilityResponse)
def get_certificate_eligibility(
    curriculum_id: int = Query(...),
    learner_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    curriculum = _load_curriculum_for_issue(db, current_user, curriculum_id)
    learner = _load_assigned_learner(db, curriculum, learner_id)
    return _build_eligibility(db, curriculum, learner)


@router.get("", response_model=list[CertificateResponse])
def list_certificates(
    learner_id: int | None = Query(None),
    curriculum_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Certificate).join(Curriculum).filter(Certificate.cert_deleted_at.is_(None))
    if current_user.user_role == "j":
        query = query.filter(Certificate.cert_learner_id == current_user.user_id)
    elif current_user.user_role == "m":
        query = query.filter(Curriculum.cur_creator_id == current_user.user_id)
    elif current_user.user_role != "a":
        raise HTTPException(status_code=404, detail="Not found")

    if learner_id is not None:
        query = query.filter(Certificate.cert_learner_id == learner_id)
    if curriculum_id is not None:
        query = query.filter(Certificate.cert_curriculum_id == curriculum_id)

    certificates = query.order_by(Certificate.cert_issued_at.desc()).all()
    return [_certificate_response(certificate) for certificate in certificates]


@router.get("/sample/download")
def download_sample_certificate(
    current_user: User = Depends(get_current_user),
):
    # TODO: 수료증 템플릿 확정 후 제거. DB/R2 저장 없이 디자인 확인용 PDF만 내려준다.
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=404, detail="Not found")

    issued_at = datetime.now(timezone.utc)
    pdf_bytes = _pdf_bytes(
        title="ArtiCulum 수료증",
        cert_no=issued_at.strftime("AC-%Y%m%d-SAMPLE"),
        curriculum_title="AI 기반 비즈니스 문제해결 실무 과정",
        duration_weeks=4,
        learner_name="김아티",
        issuer_name=current_user.user_name or "발급자",
        issued_at=issued_at,
        completed_at=issued_at,
    )
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers=_download_headers("articulum_certificate_sample.pdf"),
    )


@router.post("", response_model=CertificateResponse, status_code=status.HTTP_201_CREATED)
def issue_certificate(
    body: CertificateIssueRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    curriculum = _load_curriculum_for_issue(db, current_user, body.cert_curriculum_id)
    learner = _load_assigned_learner(db, curriculum, body.cert_learner_id)
    eligibility = _build_eligibility(db, curriculum, learner)
    if not eligibility.eligible:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Certificate cannot be issued yet",
                "eligibility": eligibility.model_dump(),
            },
        )

    existing = (
        db.query(Certificate)
        .filter(
            Certificate.cert_curriculum_id == curriculum.cur_id,
            Certificate.cert_learner_id == learner.user_id,
        )
        .first()
    )
    # curriculum+learner unique 제약 때문에 기존 soft-deleted row는 새로 만들지 않고 복구/갱신한다.
    if existing and existing.cert_deleted_at is None and not body.overwrite:
        return _certificate_response(existing)

    issued_at = datetime.now(timezone.utc)
    title = (body.cert_title or "수료증").strip() or "수료증"
    completed_at = _completed_at_from_submissions(
        db,
        curriculum.cur_id,
        learner.user_id,
        eligibility.completed_weeks,
    )
    cert_no = existing.cert_no if existing else _generate_cert_no(db, issued_at)
    curriculum_title = curriculum.cur_title
    learner_name = learner.user_name
    issuer_name = current_user.user_name
    pdf_bytes = _pdf_bytes(
        title=title,
        cert_no=cert_no,
        curriculum_title=curriculum_title,
        duration_weeks=curriculum.cur_duration_weeks,
        learner_name=learner_name,
        issuer_name=issuer_name,
        issued_at=issued_at,
        completed_at=completed_at,
    )
    key = f"certificates/{curriculum.cur_id}/{learner.user_id}/{issued_at.strftime('%Y%m%dT%H%M%S')}.pdf"
    try:
        save_object(key, pdf_bytes, "application/pdf")
    except AttachmentStorageError as exc:
        raise HTTPException(status_code=500, detail="Certificate PDF could not be stored") from exc

    if existing:
        existing.cert_issuer_id = current_user.user_id
        existing.cert_title = title
        existing.cert_curriculum_title = curriculum_title
        existing.cert_learner_name = learner_name
        existing.cert_issuer_name = issuer_name
        existing.cert_storage_key = key
        existing.cert_issued_at = issued_at.replace(tzinfo=None)
        existing.cert_completed_at = completed_at
        existing.cert_deleted_at = None
        certificate = existing
    else:
        certificate = Certificate(
            cert_no=cert_no,
            cert_curriculum_id=curriculum.cur_id,
            cert_learner_id=learner.user_id,
            cert_issuer_id=current_user.user_id,
            cert_title=title,
            cert_curriculum_title=curriculum_title,
            cert_learner_name=learner_name,
            cert_issuer_name=issuer_name,
            cert_storage_key=key,
            cert_issued_at=issued_at.replace(tzinfo=None),
            cert_completed_at=completed_at,
        )
        db.add(certificate)

    db.commit()
    db.refresh(certificate)
    return _certificate_response(certificate)


@router.get("/{cert_id}", response_model=CertificateResponse)
def get_certificate(
    cert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    certificate = (
        db.query(Certificate)
        .filter(Certificate.cert_id == cert_id, Certificate.cert_deleted_at.is_(None))
        .first()
    )
    if not certificate or not _can_access_certificate(certificate, current_user):
        raise HTTPException(status_code=404, detail="Certificate not found")
    return _certificate_response(certificate)


@router.get("/{cert_id}/download")
def download_certificate(
    cert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    certificate = (
        db.query(Certificate)
        .filter(Certificate.cert_id == cert_id, Certificate.cert_deleted_at.is_(None))
        .first()
    )
    if not certificate or not _can_access_certificate(certificate, current_user):
        raise HTTPException(status_code=404, detail="Certificate not found")

    try:
        stored = open_object(certificate.cert_storage_key, "application/pdf")
    except AttachmentNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Certificate file not found") from exc
    except AttachmentStorageError as exc:
        raise HTTPException(status_code=500, detail="Certificate file could not be loaded") from exc

    curriculum_title = certificate.cert_curriculum_title or "certificate"
    learner_name = certificate.cert_learner_name or "learner"
    filename = f"{curriculum_title}_{learner_name}_certificate.pdf"
    return StreamingResponse(
        stored.body,
        media_type=stored.content_type,
        headers=_download_headers(filename),
    )
