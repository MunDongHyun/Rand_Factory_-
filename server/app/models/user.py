from sqlalchemy import BigInteger, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    user_pw: Mapped[str] = mapped_column(String(255), nullable=False)
    user_name: Mapped[str] = mapped_column(String(50), nullable=False)
    user_company: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    user_role: Mapped[str] = mapped_column(Enum("j", "m", "a"), nullable=False)
    user_created_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True, server_default=func.now())
    user_updated_at: Mapped[DateTime] = mapped_column(
        DateTime,
        nullable=True,
        server_default=func.now(),
        onupdate=func.now(),
    )
    user_deleted_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True)

    curricula: Mapped[list["Curriculum"]] = relationship("Curriculum", back_populates="creator")
    chatbot_sessions: Mapped[list["ChatbotSession"]] = relationship("ChatbotSession", back_populates="manager")
    task_submissions: Mapped[list["TaskSubmission"]] = relationship("TaskSubmission", back_populates="learner")
