from datetime import date, datetime
<<<<<<< HEAD
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
=======
from typing import Literal

from pydantic import BaseModel, ConfigDict


ArticleSource = Literal["DBR", "HBR"]


class ArticleCreate(BaseModel):
    article_source: ArticleSource
    article_title: str
    article_author: str | None = None
    article_published_date: date | None = None
    article_category: str | None = None
    article_source_url: str | None = None
    article_image_count: int = 0
    content: str | None = None
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511


class ArticleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    article_id: int
<<<<<<< HEAD
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
=======
    article_source: ArticleSource
    article_title: str
    article_author: str | None = None
    article_published_date: date | None = None
    article_category: str | None = None
    article_source_url: str | None = None
    article_image_count: int | None = None
    article_chunk_count: int | None = None
    article_created_at: datetime | None = None
    article_updated_at: datetime | None = None
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511


class ArticleListResponse(BaseModel):
    articles: list[ArticleResponse]
    total: int
<<<<<<< HEAD
=======


class InsightItem(BaseModel):
    title: str
    description: str
    actions: list[str]


class ArticleInsightsResponse(BaseModel):
    article_id: int
    title: str
    keywords: list[str]
    insights: list[InsightItem]
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511
