from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, JSON, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TaskSubmission(Base):
    __tablename__ = "task_submissions"

    task_submission_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_curriculum_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("curriculum.cur_id"), nullable=False)
    task_learner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), nullable=False)
    task_week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    task_submitted_content: Mapped[dict] = mapped_column(JSON, nullable=False)
    task_submitted_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True, server_default=func.now())
    task_manager_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    task_feedback_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True)
    task_status: Mapped[str | None] = mapped_column(
        Enum("submitted", "feedback_given", "resubmit_requested"),
        nullable=True,
        default="submitted",
    )

    curriculum: Mapped["Curriculum"] = relationship("Curriculum", back_populates="task_submissions")
    learner: Mapped["User"] = relationship("User", back_populates="task_submissions")
