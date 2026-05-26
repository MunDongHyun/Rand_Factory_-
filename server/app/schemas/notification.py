from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    notif_id: int
    notif_type: str
    notif_title: str
    notif_body: str | None = None
    notif_link: str | None = None
    notif_ref_type: str | None = None
    notif_ref_id: int | None = None
    notif_read_at: datetime | None = None
    notif_created_at: datetime | None = None


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    unread_count: int


class NotificationUnreadCountResponse(BaseModel):
    count: int
