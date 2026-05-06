from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.curriculum import Curriculum
from app.models.user import User
from app.schemas.curriculum import CurriculumCreate, CurriculumResponse, CurriculumUpdate

router = APIRouter(prefix="/api/curricula", tags=["curricula"])


@router.post("", response_model=CurriculumResponse, status_code=status.HTTP_201_CREATED)
def create_curriculum(
    body: CurriculumCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    curriculum = Curriculum(
        cur_creator_id=current_user.user_id,
        cur_title=body.cur_title,
        cur_target_job=body.cur_target_job,
        cur_target_industry=body.cur_target_industry,
        cur_duration_weeks=body.cur_duration_weeks,
        cur_learning_goal=body.cur_learning_goal,
        cur_ai_prompt_input=body.cur_ai_prompt_input,
        cur_week_plan=body.cur_week_plan,
        cur_assigned_learner_ids=body.cur_assigned_learner_ids,
        cur_status=body.cur_status,
    )
    db.add(curriculum)
    db.commit()
    db.refresh(curriculum)
    return curriculum


@router.get("", response_model=list[CurriculumResponse])
def list_curricula(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return db.query(Curriculum).order_by(Curriculum.cur_created_at.desc()).all()


@router.get("/{cur_id}", response_model=CurriculumResponse)
def get_curriculum(
    cur_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    curriculum = db.query(Curriculum).filter(Curriculum.cur_id == cur_id).first()
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
        .filter(Curriculum.cur_id == cur_id, Curriculum.cur_creator_id == current_user.user_id)
        .first()
    )
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(curriculum, field, value)

    db.commit()
    db.refresh(curriculum)
    return curriculum
