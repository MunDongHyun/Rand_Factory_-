from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


ArticleSource = Literal["DBR", "HBR"]


class ArticleCreate(BaseModel):
    article_source: ArticleSource
    article_title: str
    article_author: str | None = None
    article_published_date: str | None = None
    article_category: str | None = None
    article_source_url: str | None = None
    content: str | None = None


class ArticleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    article_id: int
    article_source: ArticleSource
    article_title: str
    article_author: str | None = None
    article_published_date: str | None = None
    article_category: str | None = None
    article_source_url: str | None = None
    article_chunk_count: int | None = None
    article_view_count: int | None = None
    article_created_at: datetime | None = None
    article_updated_at: datetime | None = None
    article_thumbnail_url: str | None = None
    article_has_summary: bool = False


class ArticleListResponse(BaseModel):
    articles: list[ArticleResponse]
    total: int


class ArticleSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    output_id: int
    article_id: int | None = None
    summary_text: dict | list | None = None
    created_at: datetime | None = None


class InsightItem(BaseModel):
    title: str
    description: str
    actions: list[str]


class ArticleInsightsResponse(BaseModel):
    article_id: int
    title: str
    keywords: list[str]
    insights: list[InsightItem]
