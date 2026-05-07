from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.ai_output import AiOutput
from app.models.user import User
from app.schemas.ai_output import AiOutputCreate, AiOutputResponse, AiOutputUpdate

router = APIRouter(prefix="/api/ai-outputs", tags=["ai-outputs"])


@router.post("", response_model=AiOutputResponse, status_code=status.HTTP_201_CREATED)
def create_ai_output(
    body: AiOutputCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    output = AiOutput(user_id=current_user.user_id, **body.model_dump())
    db.add(output)
    db.commit()
    db.refresh(output)
    return output


@router.get("/my", response_model=list[AiOutputResponse])
def get_my_outputs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(AiOutput)
        .filter(AiOutput.user_id == current_user.user_id)
        .order_by(AiOutput.created_at.desc())
        .all()
    )


@router.get("/{output_id}", response_model=AiOutputResponse)
def get_output(
    output_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    output = (
        db.query(AiOutput)
        .filter(AiOutput.output_id == output_id, AiOutput.user_id == current_user.user_id)
        .first()
    )
    if not output:
        raise HTTPException(status_code=404, detail="AI output not found")
    return output


@router.patch("/{output_id}", response_model=AiOutputResponse)
def update_output(
    output_id: int,
    body: AiOutputUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    output = (
        db.query(AiOutput)
        .filter(AiOutput.output_id == output_id, AiOutput.user_id == current_user.user_id)
        .first()
    )
    if not output:
        raise HTTPException(status_code=404, detail="AI output not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(output, field, value)

    db.commit()
    db.refresh(output)
    return output
