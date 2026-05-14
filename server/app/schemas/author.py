from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr


class AuthorArticleSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    article_id: int
    article_title: str
    article_category: str | None = None
    article_source: str | None = None
    article_published_date: date | None = None
    article_view_count: int | None = None
    article_thumbnail_url: str | None = None


class AuthorListItem(BaseModel):
    author_numb: int
    author_name: str
    author_from: str | None = None
    author_email: str | None = None
    categories: list[str] = []
    article_count: int = 0


class AuthorListResponse(BaseModel):
    authors: list[AuthorListItem]
    total: int


class AuthorDetailResponse(BaseModel):
    author_numb: int
    author_name: str
    author_from: str | None = None
    author_email: str | None = None
    categories: list[str] = []
    articles: list[AuthorArticleSummary] = []


class EmailSendRequest(BaseModel):
    subject: str
    body: str
    reply_to: EmailStr | None = None


class EmailSendResponse(BaseModel):
    sent: bool
    to: str
