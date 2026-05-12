from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.curriculum import Curriculum
from app.models.task_submission import TaskSubmission
from app.models.user import User
from app.schemas.task_submission import (
    TaskSubmissionCreate,
    TaskSubmissionFeedbackUpdate,
    TaskSubmissionResponse,
)

router = APIRouter(prefix="/api/task-submissions", tags=["task-submissions"])


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
    submission = TaskSubmission(
        task_curriculum_id=body.task_curriculum_id,
        task_learner_id=current_user.user_id,
        task_week_number=body.task_week_number,
        task_submitted_content=body.task_submitted_content,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.get("/my", response_model=list[TaskSubmissionResponse])
def list_my_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(TaskSubmission)
        .filter(TaskSubmission.task_learner_id == current_user.user_id)
        .order_by(TaskSubmission.task_submitted_at.desc())
        .all()
    )


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
    return submission


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
    db.commit()
    db.refresh(submission)
    return submission
