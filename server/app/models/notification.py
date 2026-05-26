from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    notif_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    notif_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.user_id"), nullable=False
    )
    notif_type: Mapped[str] = mapped_column(String(50), nullable=False)
    notif_title: Mapped[str] = mapped_column(String(200), nullable=False)
    notif_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    notif_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notif_ref_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    notif_ref_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    # 중복 알림 방지 키. NULL이면 dedupe 적용 안 함 (MySQL UNIQUE는 NULL을 여러 개 허용).
    # DB 측 UNIQUE: (notif_user_id, notif_dedupe_key)
    notif_dedupe_key: Mapped[str | None] = mapped_column(String(150), nullable=True)
    notif_read_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True)
    notif_created_at: Mapped[DateTime | None] = mapped_column(
        DateTime, nullable=True, server_default=func.now()
    )
    notif_deleted_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True)
