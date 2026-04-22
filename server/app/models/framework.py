from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Framework(Base):
    __tablename__ = "frameworks"

    framework_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), nullable=False)
    framework_type: Mapped[str | None] = mapped_column(String(50))
    user_input: Mapped[str] = mapped_column(Text, nullable=False)
    generated_content: Mapped[dict] = mapped_column(JSON, nullable=False)
    referenced_article_ids: Mapped[dict | None] = mapped_column(JSON)
    is_saved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="frameworks")
