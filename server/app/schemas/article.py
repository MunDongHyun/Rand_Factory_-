from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class ArticleCreate(BaseModel):
    article_source: str
    article_title: str
    article_author: str
    article_published_date: date
    article_category: str
    article_source_url: str
    article_image_count: int = 0
    content: str | None = None


class ArticleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    article_id: int
    article_source: str
    article_title: str
    article_author: str
    article_published_date: date
    article_category: str
    article_source_url: str | None = None
    article_image_count: int
    article_chunk_count: int
    article_created_at: datetime
    article_updated_at: datetime


class ArticleListResponse(BaseModel):
    articles: list[ArticleResponse]
    total: int


class InsightItem(BaseModel):
    title: str
    description: str
    actions: list[str]


class ArticleInsightsResponse(BaseModel):
    article_id: int
    title: str
    keywords: list[str]
    insights: list[InsightItem]
