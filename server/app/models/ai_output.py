from sqlalchemy import BigInteger, Boolean, DateTime, Enum, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AiOutput(Base):
    __tablename__ = "ai_outputs"

    output_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.user_id"), nullable=True)
    article_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("articles.article_id"), nullable=True)
    output_type: Mapped[str] = mapped_column(Enum("summary", "wordcloud", "framework"), nullable=False)
    summary_text: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    result_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    framework_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_input: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_content: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_saved: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)
    model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True, server_default=func.now())

    user: Mapped["User | None"] = relationship("User", back_populates="ai_outputs")
    article: Mapped["Article | None"] = relationship("Article", back_populates="ai_outputs")
    output_refs: Mapped[list["OutputArticleRef"]] = relationship("OutputArticleRef", back_populates="output")
