from datetime import date, datetime

from pydantic import BaseModel


class BookmarkCreate(BaseModel):
    article_id: int


class BookmarkCreateResponse(BaseModel):
    bookmark_id: int
    created: bool


class BookmarkArticleItem(BaseModel):
    article_id: int
    article_title: str
    article_category: str | None = None
    article_thumbnail_url: str | None = None
    article_published_date: date | None = None
    created_at: datetime


class MyBookmarksResponse(BaseModel):
    articles: list[BookmarkArticleItem]
