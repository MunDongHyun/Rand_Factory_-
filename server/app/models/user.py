from sqlalchemy import BigInteger, Boolean, DateTime, Enum, Integer, JSON, Numeric, String, Text, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
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
