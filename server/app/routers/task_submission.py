import hashlib
import mimetypes
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.curriculum import Curriculum
from app.models.task_submission import TaskSubmission, TaskSubmissionAttachment
from app.models.user import User
from app.schemas.article import TimelinePoint, TimelineResponse
from app.schemas.task_submission import (
    TaskSubmissionCreate,
    TaskSubmissionFeedbackUpdate,
    TaskSubmissionResponse,
    TaskSubmissionWithLearnerResponse,
)

router = APIRouter(prefix="/api/task-submissions", tags=["task-submissions"])

# 첨부파일 저장 루트 (server/uploads/task_attachments/{submission_id}/{stored_name})
ATTACHMENT_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "task_attachments"
ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024  # 한 파일당 20MB
_SAFE_NAME_PATTERN = re.compile(r"[^A-Za-z0-9._-]")


def _sanitize_filename(name: str) -> str:
    """원본 파일명에서 위험 문자 제거하고 확장자 보존. 경로 traversal 방지."""
    clean = _SAFE_NAME_PATTERN.sub("_", Path(name).name)
    return clean or "file"


def _attachment_to_legacy_dict(attachment: TaskSubmissionAttachment) -> dict:
    return {
        "task_attachment_id": attachment.task_attachment_id,
        "filename": attachment.file_original_name,
        "stored_name": attachment.file_storage_key,
        "size": attachment.file_size_bytes,
        "mime": attachment.file_mime_type,
        "sha256": attachment.file_sha256,
        "uploaded_at": attachment.file_uploaded_at.isoformat() if attachment.file_uploaded_at else None,
    }


def _content_with_attachments(submission: TaskSubmission) -> dict:
    content = dict(submission.task_submitted_content or {})
    legacy_attachments = list(content.get("attachments") or [])
    db_attachments = [
        _attachment_to_legacy_dict(attachment)
        for attachment in submission.attachments
        if attachment.file_deleted_at is None
    ]
    content["attachments"] = db_attachments or legacy_attachments
    return content


def _submission_type_from_content(submission: TaskSubmission) -> str:
    content = submission.task_submitted_content or {}
    has_text = bool(str(content.get("text") or "").strip())
    has_file = any(attachment.file_deleted_at is None for attachment in submission.attachments)
    if has_text and has_file:
        return "mixed"
    if has_file:
        return "file"
    return "text"


def _submission_response(submission: TaskSubmission) -> TaskSubmissionResponse:
    return TaskSubmissionResponse(
        task_submission_id=submission.task_submission_id,
        task_curriculum_id=submission.task_curriculum_id,
        task_learner_id=submission.task_learner_id,
        task_week_number=submission.task_week_number,
        task_submission_type=submission.task_submission_type or _submission_type_from_content(submission),
        task_submitted_content=_content_with_attachments(submission),
        task_submitted_at=submission.task_submitted_at,
        task_manager_feedback=submission.task_manager_feedback,
        task_score=submission.task_score,
        task_resubmit_requested=submission.task_resubmit_requested or "N",
        task_feedback_at=submission.task_feedback_at,
        task_status=submission.task_status,
        attachments=[a for a in submission.attachments if a.file_deleted_at is None],
    )


def _week_exists(curriculum: Curriculum, week_number: int) -> bool:
    if week_number < 1:
        return False

    week_plan = curriculum.cur_week_plan
    if isinstance(week_plan, list) and week_plan:
        return any(
            isinstance(item, dict) and item.get("week") == week_number
            for item in week_plan
        )

    if isinstance(week_plan, dict):
        week = week_plan.get("week")
        return week == week_number if week is not None else week_number == 1

    return week_number <= curriculum.cur_duration_weeks


def _can_access_submission(submission: TaskSubmission, user: User, db: Session) -> bool:
    """Role 기반으로 task_submission 접근 권한 판정.

    - a (admin): 전체
    - m (manager): 본인이 만든 커리큘럼의 과제만
    - j (learner): 본인이 제출한 과제만
    """
    if user.user_role == "a":
        return True
    if user.user_role == "j":
        return submission.task_learner_id == user.user_id
    if user.user_role == "m":
        curriculum = (
            db.query(Curriculum)
            .filter(Curriculum.cur_id == submission.task_curriculum_id)
            .first()
        )
        return curriculum is not None and curriculum.cur_creator_id == user.user_id
    return False


@router.post("", response_model=TaskSubmissionResponse, status_code=status.HTTP_201_CREATED)
def create_submission(
    body: TaskSubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.user_role != "j":
        raise HTTPException(status_code=403, detail="Only learners can submit tasks")

    curriculum = (
        db.query(Curriculum)
        .filter(
            Curriculum.cur_id == body.task_curriculum_id,
            Curriculum.cur_deleted_at.is_(None),
            Curriculum.cur_status == "active",
        )
        .first()
    )
    assigned_ids = curriculum.cur_assigned_learner_ids if curriculum else None
    if not curriculum or not isinstance(assigned_ids, list) or current_user.user_id not in assigned_ids:
        raise HTTPException(status_code=404, detail="Curriculum not found")

    if not _week_exists(curriculum, body.task_week_number):
        raise HTTPException(status_code=400, detail="Invalid curriculum week")

    submission = TaskSubmission(
        task_curriculum_id=body.task_curriculum_id,
        task_learner_id=current_user.user_id,
        task_week_number=body.task_week_number,
        task_submission_type=body.task_submission_type,
        task_submitted_content=body.task_submitted_content or {},
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return _submission_response(submission)


@router.get("/my", response_model=list[TaskSubmissionResponse])
def list_my_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submissions = (
        db.query(TaskSubmission)
        .filter(TaskSubmission.task_learner_id == current_user.user_id)
        .order_by(TaskSubmission.task_submitted_at.desc())
        .all()
    )
    return [_submission_response(submission) for submission in submissions]


@router.get("/by-curriculum/{cur_id}", response_model=list[TaskSubmissionWithLearnerResponse])
def list_submissions_by_curriculum(
    cur_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """매니저/관리자 전용: 본인이 만든 커리큘럼의 모든 제출 + 학습자 정보."""
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=404, detail="Not found")

    curriculum = (
        db.query(Curriculum)
        .filter(Curriculum.cur_id == cur_id, Curriculum.cur_deleted_at.is_(None))
        .first()
    )
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    if current_user.user_role == "m" and curriculum.cur_creator_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="Curriculum not found")

    rows = (
        db.query(TaskSubmission, User)
        .join(User, TaskSubmission.task_learner_id == User.user_id)
        .filter(TaskSubmission.task_curriculum_id == cur_id)
        .order_by(
            TaskSubmission.task_week_number.asc(),
            TaskSubmission.task_submitted_at.desc(),
        )
        .all()
    )

    return [
        TaskSubmissionWithLearnerResponse(
            task_submission_id=s.task_submission_id,
            task_curriculum_id=s.task_curriculum_id,
            task_learner_id=s.task_learner_id,
            learner_name=u.user_name,
            learner_email=u.user_email,
            task_week_number=s.task_week_number,
            task_submission_type=s.task_submission_type or _submission_type_from_content(s),
            task_submitted_content=_content_with_attachments(s),
            task_submitted_at=s.task_submitted_at,
            task_manager_feedback=s.task_manager_feedback,
            task_score=s.task_score,
            task_resubmit_requested=s.task_resubmit_requested or "N",
            task_feedback_at=s.task_feedback_at,
            task_status=s.task_status,
            attachments=[a for a in s.attachments if a.file_deleted_at is None],
        )
        for s, u in rows
    ]


@router.get("/stats/timeline", response_model=TimelineResponse)
def get_submissions_timeline(
    days: int = Query(30, ge=1, le=180),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """관리자(a) 전용: 최근 N일 일별 과제 제출 수."""
    if current_user.user_role != "a":
        raise HTTPException(status_code=404, detail="Not found")

    today = date.today()
    start_date = today - timedelta(days=days - 1)

    rows = (
        db.query(
            func.date(TaskSubmission.task_submitted_at).label("d"),
            func.count(TaskSubmission.task_submission_id).label("cnt"),
        )
        .filter(TaskSubmission.task_submitted_at >= start_date)
        .group_by(func.date(TaskSubmission.task_submitted_at))
        .all()
    )
    date_counts = {row.d: int(row.cnt) for row in rows}

    items = []
    for i in range(days):
        d = start_date + timedelta(days=i)
        items.append(TimelinePoint(date=d, count=date_counts.get(d, 0)))
    return TimelineResponse(items=items)


@router.get("/{submission_id}", response_model=TaskSubmissionResponse)
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = (
        db.query(TaskSubmission)
        .filter(TaskSubmission.task_submission_id == submission_id)
        .first()
    )
    if not submission or not _can_access_submission(submission, current_user, db):
        raise HTTPException(status_code=404, detail="Task submission not found")
    return _submission_response(submission)


@router.patch("/{submission_id}/feedback", response_model=TaskSubmissionResponse)
def update_feedback(
    submission_id: int,
    body: TaskSubmissionFeedbackUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=403, detail="Only master/admin can leave feedback")

    submission = (
        db.query(TaskSubmission)
        .filter(TaskSubmission.task_submission_id == submission_id)
        .first()
    )
    if not submission or not _can_access_submission(submission, current_user, db):
        raise HTTPException(status_code=404, detail="Task submission not found")

    submission.task_manager_feedback = body.task_manager_feedback
    submission.task_feedback_at = datetime.now(timezone.utc)
    submission.task_status = body.task_status
    submission.task_score = body.task_score
    submission.task_resubmit_requested = "Y" if body.task_status == "resubmit_requested" else "N"
    db.commit()
    db.refresh(submission)
    return _submission_response(submission)


# ---------------------------------------------------------------------------
# 첨부파일 (업로드 / 다운로드 / 삭제)
# task_submitted_content JSON 안 "attachments" 배열에 메타 보관.
# 실제 파일은 server/uploads/task_attachments/{submission_id}/{stored_name}
# ---------------------------------------------------------------------------


@router.post("/{submission_id}/attachments", response_model=TaskSubmissionResponse)
async def upload_attachment(
    submission_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """학습자가 본인 제출에 파일 첨부. 한 파일당 20MB 제한."""
    submission = (
        db.query(TaskSubmission)
        .filter(TaskSubmission.task_submission_id == submission_id)
        .first()
    )
    if not submission or not _can_access_submission(submission, current_user, db):
        raise HTTPException(status_code=404, detail="과제 제출을 찾을 수 없습니다")
    if current_user.user_role != "j" or submission.task_learner_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="본인 제출에만 파일을 첨부할 수 있습니다")

    contents = await file.read()
    if len(contents) > ATTACHMENT_MAX_BYTES:
        raise HTTPException(status_code=413, detail="파일이 너무 큽니다 (최대 20MB)")
    if not contents:
        raise HTTPException(status_code=400, detail="빈 파일은 업로드할 수 없습니다")

    safe_name = _sanitize_filename(file.filename or "file")
    stored_name = f"{uuid.uuid4().hex}_{safe_name}"
    target_dir = ATTACHMENT_ROOT / str(submission_id)
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / stored_name
    target_path.write_bytes(contents)

    attachment = TaskSubmissionAttachment(
        task_submission_id=submission_id,
        file_original_name=file.filename or safe_name,
        file_storage_key=stored_name,
        file_mime_type=file.content_type or mimetypes.guess_type(safe_name)[0] or "application/octet-stream",
        file_size_bytes=len(contents),
        file_sha256=hashlib.sha256(contents).hexdigest(),
    )
    db.add(attachment)
    db.flush()
    content = submission.task_submitted_content or {}
    submission.task_submission_type = "mixed" if str(content.get("text") or "").strip() else "file"
    db.commit()
    db.refresh(submission)
    return _submission_response(submission)


@router.get("/{submission_id}/attachments/{stored_name}")
def download_attachment(
    submission_id: int,
    stored_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """첨부파일 다운로드. 본인 제출 또는 담당 매니저/관리자만."""
    submission = (
        db.query(TaskSubmission)
        .filter(TaskSubmission.task_submission_id == submission_id)
        .first()
    )
    if not submission or not _can_access_submission(submission, current_user, db):
        raise HTTPException(status_code=404, detail="과제 제출을 찾을 수 없습니다")

    # path traversal 차단: 메타에 등록된 stored_name과만 매칭
    attachment = (
        db.query(TaskSubmissionAttachment)
        .filter(
            TaskSubmissionAttachment.task_submission_id == submission_id,
            TaskSubmissionAttachment.file_storage_key == stored_name,
            TaskSubmissionAttachment.file_deleted_at.is_(None),
        )
        .first()
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="첨부파일을 찾을 수 없습니다")

    file_path = ATTACHMENT_ROOT / str(submission_id) / stored_name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="첨부파일을 찾을 수 없습니다")

    return FileResponse(
        path=file_path,
        media_type=attachment.file_mime_type or "application/octet-stream",
        filename=attachment.file_original_name or stored_name,
    )


@router.delete("/{submission_id}/attachments/{stored_name}", response_model=TaskSubmissionResponse)
def delete_attachment(
    submission_id: int,
    stored_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """본인 제출의 첨부파일 삭제."""
    submission = (
        db.query(TaskSubmission)
        .filter(TaskSubmission.task_submission_id == submission_id)
        .first()
    )
    if not submission or not _can_access_submission(submission, current_user, db):
        raise HTTPException(status_code=404, detail="과제 제출을 찾을 수 없습니다")
    if current_user.user_role != "j" or submission.task_learner_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="본인 제출의 첨부파일만 삭제할 수 있습니다")

    attachment = (
        db.query(TaskSubmissionAttachment)
        .filter(
            TaskSubmissionAttachment.task_submission_id == submission_id,
            TaskSubmissionAttachment.file_storage_key == stored_name,
            TaskSubmissionAttachment.file_deleted_at.is_(None),
        )
        .first()
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="첨부파일을 찾을 수 없습니다")

    file_path = ATTACHMENT_ROOT / str(submission_id) / stored_name
    if file_path.is_file():
        file_path.unlink()

    attachment.file_deleted_at = datetime.now(timezone.utc)
    submission.task_submission_type = _submission_type_from_content(submission)
    db.commit()
    db.refresh(submission)
    return _submission_response(submission)
