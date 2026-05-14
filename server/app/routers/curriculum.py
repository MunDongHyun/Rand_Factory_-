from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Query, Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.curriculum import Curriculum
from app.models.task_submission import TaskSubmission
from app.models.user import User
from app.schemas.curriculum import (
    CurriculumCreate,
    CurriculumGenerateRequest,
    CurriculumGenerateResponse,
    CurriculumResponse,
    CurriculumStatsResponse,
    CurriculumUpdate,
)
from app.services import curriculum_service

router = APIRouter(prefix="/api/curricula", tags=["curricula"])


def _scope_curriculum_query(query: Query, user: User) -> Query:
    """Role 기반으로 curriculum 조회 범위를 제한 (soft delete 제외).

    - a (admin): 전체
    - m (manager): 본인이 만든 것
    - j (learner): 본인이 cur_assigned_learner_ids에 포함된 것
    """
    query = query.filter(Curriculum.cur_deleted_at.is_(None))
    if user.user_role == "a":
        return query
    if user.user_role == "m":
        return query.filter(Curriculum.cur_creator_id == user.user_id)
    return query.filter(func.json_contains(Curriculum.cur_assigned_learner_ids, str(user.user_id)))


@router.post("", response_model=CurriculumResponse, status_code=status.HTTP_201_CREATED)
def create_curriculum(
    body: CurriculumCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=403, detail="Only manager/admin can create curricula")

    curriculum = Curriculum(
        cur_creator_id=current_user.user_id,
        cur_title=body.cur_title,
        cur_target_job=body.cur_target_job,
        cur_target_industry=body.cur_target_industry,
        cur_duration_weeks=body.cur_duration_weeks,
        cur_learning_goal=body.cur_learning_goal,
        cur_learning_detail_goal=body.cur_learning_detail_goal,
        cur_week_plan=body.cur_week_plan,
        cur_assigned_learner_ids=body.cur_assigned_learner_ids,
        cur_status=body.cur_status,
    )
    db.add(curriculum)
    db.commit()
    db.refresh(curriculum)
    return curriculum


@router.post("/generate", response_model=CurriculumGenerateResponse)
def generate_curriculum(
    body: CurriculumGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=403, detail="Only manager/admin can generate curricula")

    try:
        week_plan = curriculum_service.generate_week_plan(
            cur_title=body.cur_title,
            cur_duration_weeks=body.cur_duration_weeks,
            cur_target_job=body.cur_target_job,
            cur_target_industry=body.cur_target_industry,
            cur_learning_goal=body.cur_learning_goal,
            required_content=body.required_content,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI 생성 실패: {exc}")

    return CurriculumGenerateResponse(
        cur_title=body.cur_title,
        cur_duration_weeks=body.cur_duration_weeks,
        cur_target_job=body.cur_target_job,
        cur_target_industry=body.cur_target_industry,
        cur_learning_goal=body.cur_learning_goal,
        cur_week_plan=week_plan,
    )


@router.get("", response_model=list[CurriculumResponse])
def list_curricula(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = _scope_curriculum_query(db.query(Curriculum), current_user)
    return query.order_by(Curriculum.cur_created_at.desc()).all()


@router.get("/stats", response_model=CurriculumStatsResponse)
def get_curriculum_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """관리자(a) 전용: 커리큘럼/학습자/과제 제출 통계."""
    if current_user.user_role != "a":
        raise HTTPException(status_code=404, detail="Not found")

    total_curricula = (
        db.query(func.count(Curriculum.cur_id))
        .filter(Curriculum.cur_deleted_at.is_(None))
        .scalar()
        or 0
    )

    assigned_rows = (
        db.query(Curriculum.cur_assigned_learner_ids)
        .filter(
            Curriculum.cur_deleted_at.is_(None),
            Curriculum.cur_status == "active",
        )
        .all()
    )
    learner_set: set[int] = set()
    for (ids,) in assigned_rows:
        if isinstance(ids, list):
            for lid in ids:
                if isinstance(lid, int):
                    learner_set.add(lid)
    active_learners = len(learner_set)

    total_submissions = (
        db.query(func.count(TaskSubmission.task_submission_id)).scalar() or 0
    )

    return CurriculumStatsResponse(
        total_curricula=total_curricula,
        active_learners=active_learners,
        total_submissions=total_submissions,
    )


@router.get("/{cur_id}", response_model=CurriculumResponse)
def get_curriculum(
    cur_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = _scope_curriculum_query(db.query(Curriculum), current_user)
    curriculum = query.filter(Curriculum.cur_id == cur_id).first()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    return curriculum


@router.patch("/{cur_id}", response_model=CurriculumResponse)
def update_curriculum(
    cur_id: int,
    body: CurriculumUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    curriculum = (
        db.query(Curriculum)
        .filter(
            Curriculum.cur_id == cur_id,
            Curriculum.cur_creator_id == current_user.user_id,
            Curriculum.cur_deleted_at.is_(None),
        )
        .first()
    )
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(curriculum, field, value)

    db.commit()
    db.refresh(curriculum)
    return curriculum
