from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Curriculum(Base):
    __tablename__ = "curriculum"

    cur_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    cur_creator_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), nullable=False)
    cur_title: Mapped[str] = mapped_column(String(200), nullable=False)
    cur_target_job: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cur_target_industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cur_duration_weeks: Mapped[int] = mapped_column(Integer, nullable=False)
    cur_learning_goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    cur_learning_detail_goal: Mapped[str | None] = mapped_column(JSON, nullable=True)
    cur_week_plan: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    cur_assigned_learner_ids: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cur_status: Mapped[str | None] = mapped_column(Enum("draft", "active", "archived"), nullable=True, default="draft")
    cur_created_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True, server_default=func.now())
    cur_updated_at: Mapped[DateTime] = mapped_column(
        DateTime,
        nullable=True,
        server_default=func.now(),
        onupdate=func.now(),
    )
    cur_deleted_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True)

    creator: Mapped["User"] = relationship("User", back_populates="curricula")
    task_submissions: Mapped[list["TaskSubmission"]] = relationship("TaskSubmission", back_populates="curriculum")
    chatbot_sessions: Mapped[list["ChatbotSession"]] = relationship("ChatbotSession", back_populates="curriculum")
