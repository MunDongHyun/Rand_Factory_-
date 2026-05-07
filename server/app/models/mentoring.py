from sqlalchemy import BigInteger, CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MentoringMatch(Base):
    __tablename__ = "mentoring_matches"

    match_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    mentee_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), nullable=False)
    mentor_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), nullable=False)
    title: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        Enum("pending", "accepted", "rejected", "completed", "cancelled"),
        default="pending",
    )
    point_cost: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[DateTime | None] = mapped_column(DateTime)

    mentee: Mapped["User"] = relationship("User", foreign_keys=[mentee_id], back_populates="mentee_matches")
    mentor: Mapped["User"] = relationship("User", foreign_keys=[mentor_id], back_populates="mentor_matches")
    review: Mapped["MentoringReview | None"] = relationship("MentoringReview", back_populates="match", uselist=False)
    messages: Mapped[list["ChatMessage"]] = relationship("ChatMessage", back_populates="match")


class MentoringReview(Base):
    __tablename__ = "mentoring_reviews"
    __table_args__ = (CheckConstraint("rating BETWEEN 1 AND 5", name="chk_rating_range"),)

    review_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    match_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("mentoring_matches.match_id"), nullable=False, unique=True)
    reviewer_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

    match: Mapped["MentoringMatch"] = relationship("MentoringMatch", back_populates="review")
    reviewer: Mapped["User"] = relationship("User", back_populates="reviews_written")
