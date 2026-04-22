from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.point import Point
from app.models.user import User
from app.schemas.point import PointBalanceResponse, PointChargeRequest, PointResponse
from app.services.point_service import add_points, get_balance

router = APIRouter(prefix="/api/points", tags=["points"])


@router.post("/charge", response_model=PointBalanceResponse, status_code=201)
def charge_points(
    body: PointChargeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    add_points(
        db,
        user_id=current_user.user_id,
        amount=body.amount,
        transaction_type="charge",
        description=f"{body.amount}P 충전",
    )
    db.commit()
    return PointBalanceResponse(
        user_id=current_user.user_id,
        balance=get_balance(db, current_user.user_id),
    )


@router.get("/balance", response_model=PointBalanceResponse)
def get_my_balance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PointBalanceResponse(
        user_id=current_user.user_id,
        balance=get_balance(db, current_user.user_id),
    )


@router.get("/history", response_model=list[PointResponse])
def get_my_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Point)
        .filter(Point.user_id == current_user.user_id)
        .order_by(Point.point_id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
