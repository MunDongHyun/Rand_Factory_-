from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, field_validator


class ArticleCreate(BaseModel):
    title: str
    author: str
    published_date: date
    category: str
    industry_tags: list[str]
    summary: Optional[str] = None
    source_url: Optional[str] = None
    content: Optional[str] = None  # 본문 텍스트, 있으면 RAG 인덱싱


class ArticleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    article_id: int
    title: str
    author: Optional[str] = None
    published_date: Optional[date] = None
    category: Optional[str] = None
    industry_tags: list[str]
    summary: Optional[str] = None
    source_url: Optional[str] = None
    image_count: int
    chunk_count: int
    created_at: datetime

    @field_validator("industry_tags", mode="before")
    @classmethod
    def default_industry_tags(cls, value: Any) -> list[str]:
        return [] if value is None else value


class ArticleListResponse(BaseModel):
    articles: list[ArticleResponse]
    total: int
