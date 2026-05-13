import datetime
from sqlalchemy import BigInteger, DateTime, Enum, Integer, String, func, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.ai_summaries import AiSummary


class Article(Base):
    __tablename__ = "articles"

    article_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    article_source: Mapped[str] = mapped_column(Enum("DBR", "HBR"), nullable=False)
    article_title: Mapped[str] = mapped_column(String(500), nullable=False)
    article_author: Mapped[str | None] = mapped_column(String(200), nullable=True)
    
    article_author_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    article_published_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    
    article_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    article_source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    article_thumbnail_filename: Mapped[str | None] = mapped_column(String(512), nullable=True)
    article_view_count: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    article_created_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True, server_default=func.now())
    article_updated_at: Mapped[DateTime | None] = mapped_column( 
        DateTime,
        nullable=True,
        server_default=func.now(),
        onupdate=func.now(),
    )


    ai_summaries: Mapped[list["AiSummary"]] = relationship("AiSummary", back_populates="article")
