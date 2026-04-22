from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.point import Point


def get_balance(db: Session, user_id: int) -> int:
    last = (
        db.query(Point)
        .filter(Point.user_id == user_id)
        .order_by(Point.point_id.desc())
        .first()
    )
    return last.balance if last else 0


def deduct_points(
    db: Session,
    user_id: int,
    amount: int,
    description: str,
    reference_id: int | None = None,
) -> Point:
    balance = get_balance(db, user_id)
    if balance < amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"포인트가 부족합니다 (잔액: {balance}P, 필요: {amount}P)",
        )
    record = Point(
        user_id=user_id,
        amount=-amount,
        balance=balance - amount,
        transaction_type="spend",
        description=description,
        reference_id=reference_id,
    )
    db.add(record)
    return record


def add_points(
    db: Session,
    user_id: int,
    amount: int,
    transaction_type: str,
    description: str,
    reference_id: int | None = None,
) -> Point:
    balance = get_balance(db, user_id)
    record = Point(
        user_id=user_id,
        amount=amount,
        balance=balance + amount,
        transaction_type=transaction_type,
        description=description,
        reference_id=reference_id,
    )
    db.add(record)
    return record
