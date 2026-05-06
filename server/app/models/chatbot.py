from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ChatbotSession(Base):
    __tablename__ = "chatbot_sessions"

    cb_session_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    cb_manager_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.user_id"), nullable=False)
    cb_curriculum_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("curriculum.cur_id"), nullable=True)
    cb_created_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True, server_default=func.now())

    manager: Mapped["User"] = relationship("User", back_populates="chatbot_sessions")
    curriculum: Mapped["Curriculum | None"] = relationship("Curriculum", back_populates="chatbot_sessions")
    messages: Mapped[list["ChatbotMessage"]] = relationship("ChatbotMessage", back_populates="session")


class ChatbotMessage(Base):
    __tablename__ = "chatbot_messages"

    message_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("chatbot_sessions.cb_session_id"), nullable=False)
    role: Mapped[str] = mapped_column(Enum("user", "assistant"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True, server_default=func.now())

    session: Mapped["ChatbotSession"] = relationship("ChatbotSession", back_populates="messages")
