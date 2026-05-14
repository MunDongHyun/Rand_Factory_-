# server/app/models/user_activity.py
from datetime import datetime
from sqlalchemy import ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

class UserActivity(Base):
    __tablename__ = "user_activities"

    activity_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"), nullable=False)
    article_id: Mapped[int] = mapped_column(ForeignKey("articles.article_id"), nullable=False)
    
    # 검색 추천 시 빠른 집계를 위해 카테고리를 함께 저장합니다.
    category: Mapped[str] = mapped_column(String(50), nullable=False) 
    
    created_at: Mapped[datetime | None] = mapped_column(
        nullable=True, server_default=func.now()
    )