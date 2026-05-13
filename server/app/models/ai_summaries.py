from sqlalchemy import BigInteger, DateTime, JSON, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.article import Article

class AiSummary(Base):
    __tablename__ = "ai_summaries"

    output_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    article_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("articles.article_id", ondelete="SET NULL"), nullable=True)
    summary_text: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime, server_default=func.now(), nullable=True)

    article: Mapped["Article"] = relationship("Article", back_populates="ai_summaries")
