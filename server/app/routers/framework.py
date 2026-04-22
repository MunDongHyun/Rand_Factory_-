from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.framework import Framework
from app.models.user import User
from app.schemas.framework import FrameworkGenerate, FrameworkResponse
from app.services.framework_service import generate_framework

router = APIRouter(prefix="/api/frameworks", tags=["frameworks"])


@router.post("/generate", response_model=FrameworkResponse, status_code=201)
def generate(
    body: FrameworkGenerate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content, ref_ids = generate_framework(body.framework_type, body.user_input)

    fw = Framework(
        user_id=current_user.user_id,
        framework_type=body.framework_type,
        user_input=body.user_input,
        generated_content=content,
        referenced_article_ids=ref_ids,
        is_saved=False,
    )
    db.add(fw)
    db.commit()
    db.refresh(fw)
    return fw


@router.get("/my", response_model=list[FrameworkResponse])
def get_my_frameworks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Framework)
        .filter(Framework.user_id == current_user.user_id)
        .order_by(Framework.created_at.desc())
        .all()
    )


@router.get("/{framework_id}", response_model=FrameworkResponse)
def get_framework(
    framework_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fw = db.query(Framework).filter(
        Framework.framework_id == framework_id,
        Framework.user_id == current_user.user_id,
    ).first()
    if not fw:
        raise HTTPException(status_code=404, detail="프레임워크를 찾을 수 없습니다")
    return fw


@router.patch("/{framework_id}/save", response_model=FrameworkResponse)
def toggle_save(
    framework_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fw = db.query(Framework).filter(
        Framework.framework_id == framework_id,
        Framework.user_id == current_user.user_id,
    ).first()
    if not fw:
        raise HTTPException(status_code=404, detail="프레임워크를 찾을 수 없습니다")

    fw.is_saved = not fw.is_saved
    db.commit()
    db.refresh(fw)
    return fw
