from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Column, ForeignKey, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.article import Article


article_authors_mapping = Table(
    "article_authors_mapping",
    Base.metadata,
    Column(
        "article_id",
        BigInteger,
        ForeignKey("articles.article_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "author_numb",
        BigInteger,
        ForeignKey("authors.author_numb", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Author(Base):
    __tablename__ = "authors"

    author_numb: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    author_name: Mapped[str] = mapped_column(String(50), nullable=False)
    author_from: Mapped[str | None] = mapped_column(String(100), nullable=True)
    author_email: Mapped[str | None] = mapped_column(String(100), nullable=True)

    articles: Mapped[list["Article"]] = relationship(
        "Article",
        secondary=article_authors_mapping,
        back_populates="authors",
    )
