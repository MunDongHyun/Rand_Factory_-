from sqlalchemy import BigInteger, DECIMAL, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class OutputArticleRef(Base):
    __tablename__ = "output_article_refs"

    output_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("ai_outputs.output_id"), primary_key=True)
    article_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("articles.article_id"), primary_key=True)
    relevance_score: Mapped[float | None] = mapped_column(DECIMAL(4, 3), nullable=True)

    output: Mapped["AiOutput"] = relationship("AiOutput", back_populates="output_refs")
    article: Mapped["Article"] = relationship("Article", back_populates="output_refs")
