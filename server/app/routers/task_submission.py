from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.task_submission import TaskSubmission
from app.models.user import User
from app.schemas.task_submission import (
    TaskSubmissionCreate,
    TaskSubmissionFeedbackUpdate,
    TaskSubmissionResponse,
)

router = APIRouter(prefix="/api/task-submissions", tags=["task-submissions"])


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
        task_framework_type=body.task_framework_type,
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
    if not submission:
        raise HTTPException(status_code=404, detail="Task submission not found")
    if current_user.user_role == "j" and submission.task_learner_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not allowed to access this submission")
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
    if not submission:
        raise HTTPException(status_code=404, detail="Task submission not found")

    submission.task_manager_feedback = body.task_manager_feedback
    submission.task_feedback_at = datetime.utcnow()
    submission.task_status = body.task_status
    db.commit()
    db.refresh(submission)
    return submission
