from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import (
    NotificationListResponse,
    NotificationResponse,
    NotificationUnreadCountResponse,
)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _base_query(db: Session, user_id: int):
    return db.query(Notification).filter(
        Notification.notif_user_id == user_id,
        Notification.notif_deleted_at.is_(None),
    )


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """본인의 알림 목록 (최신순). 안 읽음 카운트 같이 반환."""
    query = _base_query(db, current_user.user_id)
    if unread_only:
        query = query.filter(Notification.notif_read_at.is_(None))

    items = (
        query.order_by(Notification.notif_created_at.desc())
        .limit(limit)
        .all()
    )

    unread_count = (
        db.query(func.count(Notification.notif_id))
        .filter(
            Notification.notif_user_id == current_user.user_id,
            Notification.notif_read_at.is_(None),
            Notification.notif_deleted_at.is_(None),
        )
        .scalar()
        or 0
    )

    return NotificationListResponse(
        items=[NotificationResponse.model_validate(n) for n in items],
        unread_count=int(unread_count),
    )


@router.get("/unread-count", response_model=NotificationUnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """폴링용 가벼운 안 읽음 카운트 조회."""
    count = (
        db.query(func.count(Notification.notif_id))
        .filter(
            Notification.notif_user_id == current_user.user_id,
            Notification.notif_read_at.is_(None),
            Notification.notif_deleted_at.is_(None),
        )
        .scalar()
        or 0
    )
    return NotificationUnreadCountResponse(count=int(count))


@router.patch("/{notif_id}/read", response_model=NotificationResponse)
def mark_as_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (
        _base_query(db, current_user.user_id)
        .filter(Notification.notif_id == notif_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다")

    if notification.notif_read_at is None:
        notification.notif_read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)
    return NotificationResponse.model_validate(notification)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """본인의 안 읽음 알림을 일괄 읽음 처리."""
    now = datetime.now(timezone.utc)
    db.query(Notification).filter(
        Notification.notif_user_id == current_user.user_id,
        Notification.notif_read_at.is_(None),
        Notification.notif_deleted_at.is_(None),
    ).update({Notification.notif_read_at: now}, synchronize_session=False)
    db.commit()
