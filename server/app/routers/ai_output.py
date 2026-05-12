from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.ai_summaries import AiSummary
from app.models.user import User
from app.schemas.ai_output import AiSummaryCreate, AiSummaryResponse, AiSummaryUpdate

router = APIRouter(prefix="/api/ai-outputs", tags=["ai-outputs"])


@router.post("", response_model=AiSummaryResponse, status_code=status.HTTP_201_CREATED)
def create_ai_output(
    body: AiSummaryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    output = AiSummary(user_id=current_user.user_id, **body.model_dump())
    db.add(output)
    db.commit()
    db.refresh(output)
    return output


@router.get("/my", response_model=list[AiSummaryResponse])
def get_my_outputs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(AiSummary)
        .filter(AiSummary.user_id == current_user.user_id)
        .order_by(AiSummary.created_at.desc())
        .all()
    )


@router.get("/{output_id}", response_model=AiSummaryResponse)
def get_output(
    output_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    output = (
        db.query(AiSummary)
        .filter(AiSummary.output_id == output_id, AiSummary.user_id == current_user.user_id)
        .first()
    )
    if not output:
        raise HTTPException(status_code=404, detail="AI output not found")
    return output


@router.patch("/{output_id}", response_model=AiSummaryResponse)
def update_output(
    output_id: int,
    body: AiSummaryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    output = (
        db.query(AiSummary)
        .filter(AiSummary.output_id == output_id, AiSummary.user_id == current_user.user_id)
        .first()
    )
    if not output:
        raise HTTPException(status_code=404, detail="AI output not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(output, field, value)

    db.commit()
    db.refresh(output)
    return output
