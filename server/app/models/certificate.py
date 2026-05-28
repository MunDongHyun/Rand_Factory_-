from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.curriculum import Curriculum
    from app.models.user import User


class Certificate(Base):
    __tablename__ = "certificates"
    __table_args__ = (
        UniqueConstraint(
            "cert_no",
            name="uq_certificates_no",
        ),
        UniqueConstraint(
            "cert_curriculum_id",
            "cert_learner_id",
            name="uq_certificates_curriculum_learner",
        ),
        Index("idx_certificates_learner", "cert_learner_id", "cert_issued_at"),
        Index("idx_certificates_curriculum", "cert_curriculum_id", "cert_issued_at"),
    )

    cert_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    cert_no: Mapped[str] = mapped_column(String(50), nullable=False)
    cert_curriculum_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("curriculum.cur_id"),
        nullable=False,
    )
    cert_learner_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.user_id"),
        nullable=False,
    )
    cert_issuer_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.user_id"),
        nullable=False,
    )
    cert_title: Mapped[str] = mapped_column(String(255), nullable=False)
    cert_curriculum_title: Mapped[str] = mapped_column(String(255), nullable=False)
    cert_learner_name: Mapped[str] = mapped_column(String(50), nullable=False)
    cert_issuer_name: Mapped[str] = mapped_column(String(50), nullable=False)
    cert_storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    cert_issued_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )
    cert_completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cert_deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    curriculum: Mapped["Curriculum"] = relationship("Curriculum")
    learner: Mapped["User"] = relationship("User", foreign_keys=[cert_learner_id])
    issuer: Mapped["User"] = relationship("User", foreign_keys=[cert_issuer_id])
