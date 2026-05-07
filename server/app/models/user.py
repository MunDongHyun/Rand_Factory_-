<<<<<<< HEAD
from sqlalchemy import BigInteger, Boolean, DateTime, Enum, Integer, JSON, Numeric, String, Text, ForeignKey, func
=======
from sqlalchemy import BigInteger, DateTime, Enum, Integer, String, func
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
<<<<<<< HEAD
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    role: Mapped[str] = mapped_column(Enum("mentee", "mentor"), nullable=False)
    job_title: Mapped[str | None] = mapped_column(String(100))
    industry: Mapped[str | None] = mapped_column(String(100))
    years_of_experience: Mapped[int] = mapped_column(Integer, default=0)
    profile_image_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    mentor_profile: Mapped["MentorProfile | None"] = relationship("MentorProfile", back_populates="user", uselist=False)
    mentee_matches: Mapped[list["MentoringMatch"]] = relationship("MentoringMatch", foreign_keys="MentoringMatch.mentee_id", back_populates="mentee")
    mentor_matches: Mapped[list["MentoringMatch"]] = relationship("MentoringMatch", foreign_keys="MentoringMatch.mentor_id", back_populates="mentor")
    reviews_written: Mapped[list["MentoringReview"]] = relationship("MentoringReview", back_populates="reviewer")
    points: Mapped[list["Point"]] = relationship("Point", back_populates="user")
    frameworks: Mapped[list["Framework"]] = relationship("Framework", back_populates="user")
    sent_messages: Mapped[list["ChatMessage"]] = relationship("ChatMessage", back_populates="sender")


class MentorProfile(Base):
    __tablename__ = "mentor_profiles"

    mentor_profile_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), nullable=False, unique=True)
    business_card_image_url: Mapped[str | None] = mapped_column(String(500))
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    bio: Mapped[str | None] = mapped_column(Text)
    specialties: Mapped[dict | None] = mapped_column(JSON)
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    rating_avg: Mapped[float] = mapped_column(Numeric(2, 1), default=0.0)
    mentoring_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="mentor_profile")
=======
    user_email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    user_pw: Mapped[str] = mapped_column(String(255), nullable=False)
    user_name: Mapped[str] = mapped_column(String(50), nullable=False)
    user_role: Mapped[str] = mapped_column(Enum("j", "m", "a"), nullable=False)
    user_job_title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    user_industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    user_work_years: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    user_created_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True, server_default=func.now())
    user_updated_at: Mapped[DateTime] = mapped_column(
        DateTime,
        nullable=True,
        server_default=func.now(),
        onupdate=func.now(),
    )
    user_deleted_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True)

    ai_outputs: Mapped[list["AiOutput"]] = relationship("AiOutput", back_populates="user")
    curricula: Mapped[list["Curriculum"]] = relationship("Curriculum", back_populates="creator")
    chatbot_sessions: Mapped[list["ChatbotSession"]] = relationship("ChatbotSession", back_populates="manager")
    task_submissions: Mapped[list["TaskSubmission"]] = relationship("TaskSubmission", back_populates="learner")
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511
