import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Date, DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.ai_summaries import AiSummary
    from app.models.author import Author


class Article(Base):
    __tablename__ = "articles"

    article_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    article_source: Mapped[str] = mapped_column(Enum("DBR", "HBR"), nullable=False)
    article_title: Mapped[str] = mapped_column(String(500), nullable=False)
    article_author: Mapped[str] = mapped_column(String(200), nullable=False)
    article_published_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    article_category: Mapped[str] = mapped_column(String(100), nullable=False)
    article_view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    article_source_url: Mapped[str] = mapped_column(String(500), nullable=False)
    article_created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    article_updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    article_thumbnail_filename: Mapped[str | None] = mapped_column(String(512), nullable=True)

    ai_summaries: Mapped[list["AiSummary"]] = relationship("AiSummary", back_populates="article")
    authors: Mapped[list["Author"]] = relationship(
        "Author",
        secondary="article_authors_mapping",
        back_populates="articles",
    )
