from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.curriculum import Curriculum
    from app.models.user import User


class TaskSubmission(Base):
    __tablename__ = "task_submissions"

    task_submission_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_curriculum_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("curriculum.cur_id"), nullable=False)
    task_learner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), nullable=False)
    task_week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    task_submission_type: Mapped[str] = mapped_column(
        Enum("text", "file", "mixed"),
        nullable=False,
        default="text",
        server_default="text",
    )
    task_submitted_content: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    task_submitted_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True, server_default=func.now())
    task_manager_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    task_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    task_resubmit_requested: Mapped[str] = mapped_column(String(1), nullable=False, default="N", server_default="N")
    task_feedback_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True)
    task_status: Mapped[str | None] = mapped_column(
        Enum("submitted", "feedback_given", "resubmit_requested"),
        nullable=True,
        default="submitted",
    )

    curriculum: Mapped["Curriculum"] = relationship("Curriculum", back_populates="task_submissions")
    learner: Mapped["User"] = relationship("User", back_populates="task_submissions")
    attachments: Mapped[list["TaskSubmissionAttachment"]] = relationship(
        "TaskSubmissionAttachment",
        back_populates="submission",
        cascade="all, delete-orphan",
        order_by="TaskSubmissionAttachment.file_uploaded_at",
    )


class TaskSubmissionAttachment(Base):
    __tablename__ = "task_submission_attachments"

    task_attachment_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_submission_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("task_submissions.task_submission_id", ondelete="CASCADE"),
        nullable=False,
    )
    file_original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_storage_key: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    file_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    file_uploaded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, server_default=func.now())
    file_deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    submission: Mapped["TaskSubmission"] = relationship("TaskSubmission", back_populates="attachments")
