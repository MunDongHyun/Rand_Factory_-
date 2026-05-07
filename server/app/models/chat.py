from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    message_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    match_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("mentoring_matches.match_id"), nullable=False)
    sender_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_reason: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    match: Mapped["MentoringMatch"] = relationship("MentoringMatch", back_populates="messages")
    sender: Mapped["User"] = relationship("User", back_populates="sent_messages")
