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
    TaskSubmissionWithLearnerResponse,
)

router = APIRouter(prefix="/api/task-submissions", tags=["task-submissions"])


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
            task_submitted_content=s.task_submitted_content,
            task_submitted_at=s.task_submitted_at,
            task_manager_feedback=s.task_manager_feedback,
            task_feedback_at=s.task_feedback_at,
            task_status=s.task_status,
        )
        for s, u in rows
    ]


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
