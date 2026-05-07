from sqlalchemy import BigInteger, Date, DateTime, Enum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Article(Base):
    __tablename__ = "articles"

    article_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    article_source: Mapped[str] = mapped_column(Enum("DBR", "HBR"), nullable=False)
    article_title: Mapped[str] = mapped_column(String(500), nullable=False)
    article_author: Mapped[str | None] = mapped_column(String(200), nullable=True)
    article_published_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    article_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    article_source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    article_image_count: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    article_chunk_count: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    article_created_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True, server_default=func.now())
    article_updated_at: Mapped[DateTime] = mapped_column(
        DateTime,
        nullable=True,
        server_default=func.now(),
        onupdate=func.now(),
    )

    ai_outputs: Mapped[list["AiOutput"]] = relationship("AiOutput", back_populates="article")
    output_refs: Mapped[list["OutputArticleRef"]] = relationship("OutputArticleRef", back_populates="article")
