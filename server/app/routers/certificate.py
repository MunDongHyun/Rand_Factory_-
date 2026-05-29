from datetime import datetime, timezone
import json
import os
import secrets
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from fpdf import FPDF
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.db_helpers import fetch_in_order
from app.core.security import get_current_user
from app.models.certificate import Certificate
from app.models.curriculum import Curriculum
from app.models.task_submission import TaskSubmission
from app.models.user import User
from app.schemas.certificate import (
    CertificateEligibilityResponse,
    CertificateIssueRequest,
    CertificateResponse,
    LearnerCurriculumProgressItem,
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
FONT_PATH = os.path.join(server_dir, "resources", "fonts", "NanumMyeongjo-subset.ttf")
FONT_PATH_BOLD = os.path.join(server_dir, "resources", "fonts", "NanumMyeongjoBold-subset.ttf")
BG_IMAGE = os.path.join(server_dir, "resources", "fonts", "certificate_template.jpg")


def _assigned_learner_ids(curriculum: Curriculum) -> set[int]:
    raw = curriculum.cur_assigned_learner_ids
    if not isinstance(raw, list):
        return set()
    return {int(value) for value in raw if isinstance(value, int) or str(value).isdigit()}


def _expected_weeks(curriculum: Curriculum) -> list[int]:
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
    id_query = (
        db.query(TaskSubmission.task_submission_id)
        .filter(
            TaskSubmission.task_curriculum_id == curriculum_id,
            TaskSubmission.task_learner_id == learner_id,
        )
        .order_by(
            TaskSubmission.task_week_number.asc(),
            TaskSubmission.task_submitted_at.asc(),
            TaskSubmission.task_submission_id.asc(),
        )
    )
    submissions = fetch_in_order(
        db, id_query, TaskSubmission, TaskSubmission.task_submission_id
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
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=False)
    pdf.add_page()

    if os.path.exists(FONT_PATH):
        pdf.add_font("kr", "", FONT_PATH, uni=True)
        font = "kr"
        bold_style = ""

        if os.path.exists(FONT_PATH_BOLD):
            pdf.add_font("kr", "B", FONT_PATH_BOLD, uni=True)
            bold_style = "B"
    else:
        font = "Helvetica"
        bold_style = "B"

    if os.path.exists(BG_IMAGE):
        pdf.image(BG_IMAGE, x=0, y=0, w=210, h=297)
    else:
        pdf.set_draw_color(57, 74, 171)
        pdf.set_line_width(1.1)
        pdf.rect(12, 12, 186, 273)

        pdf.set_draw_color(118, 149, 255)
        pdf.set_line_width(0.4)
        pdf.rect(18, 18, 174, 261)

    pdf.set_text_color(31, 41, 55)

    pdf.set_font(font, "", 8)
    pdf.set_xy(20, 20)
    pdf.cell(80, 5, cert_no)

    pdf.set_font(font, bold_style, 28)
    pdf.set_xy(0, 48)
    pdf.cell(210, 14, title, align="C")

    pdf.set_font(font, "", 11)
    pdf.set_text_color(75, 85, 99)
    pdf.set_xy(0, 66)
    pdf.cell(210, 8, "ArtiCulum Learning Certificate", align="C")

    pdf.set_text_color(17, 24, 39)
    pdf.set_font(font, bold_style, 22)
    pdf.set_xy(0, 96)
    pdf.cell(210, 12, learner_name, align="C")

    pdf.set_font(font, "", 12)
    pdf.set_text_color(55, 65, 81)
    pdf.set_xy(24, 116)
    pdf.multi_cell(
        162,
        8,
        f"{curriculum_title} 과정을 성실히 이수하였음을 증명합니다.",
        align="C",
    )

    completed_str = completed_at.strftime("%Y-%m-%d") if completed_at else "-"
    issued_str = issued_at.strftime("%Y-%m-%d")

    info_lines = [
        ("과정명", curriculum_title),
        ("학습 기간", f"{duration_weeks}주"),
        ("완료일", completed_str),
        ("발급일", issued_str),
        ("발급자", issuer_name),
    ]

    y = 150
    pdf.set_font(font, "", 11)
    for label, value in info_lines:
        pdf.set_xy(52, y)
        pdf.set_text_color(75, 85, 99)
        pdf.cell(30, 8, label)
        pdf.set_text_color(17, 24, 39)
        pdf.cell(90, 8, str(value))
        y += 10

    pdf.set_font(font, bold_style, 18)
    pdf.set_text_color(31, 41, 55)
    pdf.set_xy(0, 245)
    pdf.cell(210, 10, "ArtiCulum", align="C")

    out = pdf.output(dest="S")
    return out.encode("latin-1") if isinstance(out, str) else bytes(out)


def _download_headers(filename: str) -> dict[str, str]:
    fallback = filename.encode("ascii", "ignore").decode("ascii") or "certificate.pdf"
    encoded = quote(filename, safe="")
    return {
        "Content-Disposition": f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{encoded}"
    }


def _can_access_certificate(certificate: Certificate, user: User) -> bool:
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


@router.get("/learner-progress", response_model=list[LearnerCurriculumProgressItem])
def get_learner_curricula_progress(
    learner_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=404, detail="찾을 수 없습니다")

    learner = (
        db.query(User)
        .filter(User.user_id == learner_id, User.user_deleted_at.is_(None))
        .first()
    )
    if not learner or learner.user_role != "j":
        raise HTTPException(status_code=404, detail="학습자를 찾을 수 없습니다")

    if current_user.user_role == "m" and learner.user_company != current_user.user_company:
        raise HTTPException(status_code=404, detail="학습자를 찾을 수 없습니다")

    query = db.query(Curriculum).filter(
        Curriculum.cur_deleted_at.is_(None),
        func.json_contains(Curriculum.cur_assigned_learner_ids, json.dumps(learner_id)),
    )
    if current_user.user_role == "m":
        query = query.filter(Curriculum.cur_creator_id == current_user.user_id)
    curricula = query.order_by(Curriculum.cur_updated_at.desc()).all()

    cert_map: dict[int, Certificate] = {}
    if curricula:
        cur_ids = [c.cur_id for c in curricula]
        existing_certs = (
            db.query(Certificate)
            .filter(
                Certificate.cert_learner_id == learner_id,
                Certificate.cert_deleted_at.is_(None),
                Certificate.cert_curriculum_id.in_(cur_ids),
            )
            .all()
        )
        cert_map = {c.cert_curriculum_id: c for c in existing_certs}

    items: list[LearnerCurriculumProgressItem] = []
    for cur in curricula:
        eligibility = _build_eligibility(db, cur, learner)
        total = len(eligibility.expected_weeks)
        done = len(eligibility.completed_weeks)
        progress = int(round(100 * done / total)) if total > 0 else 0
        cert = cert_map.get(cur.cur_id)

        items.append(
            LearnerCurriculumProgressItem(
                curriculum_id=cur.cur_id,
                curriculum_title=cur.cur_title or "",
                expected_weeks=eligibility.expected_weeks,
                completed_weeks=eligibility.completed_weeks,
                missing_weeks=eligibility.missing_weeks,
                pending_feedback_weeks=eligibility.pending_feedback_weeks,
                resubmit_requested_weeks=eligibility.resubmit_requested_weeks,
                progress_pct=progress,
                eligible=eligibility.eligible,
                has_certificate=cert is not None,
                cert_id=cert.cert_id if cert else None,
                reason=eligibility.reason,
            )
        )

    return items


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
    curriculum_title = curriculum.cur_title or ""
    learner_name = learner.user_name or ""
    issuer_name = current_user.user_name or ""

    pdf_bytes = _pdf_bytes(
        title=title,
        cert_no=cert_no,
        curriculum_title=curriculum_title,
        duration_weeks=int(curriculum.cur_duration_weeks or 0),
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
