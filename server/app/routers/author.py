from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.article import Article
from app.models.author import Author, article_authors_mapping
from app.models.user import User
from app.schemas.author import (
    AuthorArticleSummary,
    AuthorDetailResponse,
    AuthorListItem,
    AuthorListResponse,
    EmailSendRequest,
    EmailSendResponse,
)
from app.services import email_service, thumbnail_service

router = APIRouter(prefix="/api/authors", tags=["authors"])


def _article_summary(article: Article) -> AuthorArticleSummary:
    item = AuthorArticleSummary.model_validate(article)
    item.article_thumbnail_url = thumbnail_service.get_thumbnail_url(article)
    return item


@router.get("", response_model=AuthorListResponse)
def list_authors(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    authors = db.query(Author).order_by(Author.author_name.asc()).all()

    items: list[AuthorListItem] = []
    for author in authors:
        articles = author.articles
        categories = sorted(
            {a.article_category for a in articles if a.article_category}
        )
        items.append(
            AuthorListItem(
                author_numb=author.author_numb,
                author_name=author.author_name,
                author_from=author.author_from,
                author_email=author.author_email,
                categories=categories,
                article_count=len(articles),
            )
        )

    return AuthorListResponse(authors=items, total=len(items))


@router.get("/{author_numb}", response_model=AuthorDetailResponse)
def get_author(
    author_numb: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    author = db.query(Author).filter(Author.author_numb == author_numb).first()
    if not author:
        raise HTTPException(status_code=404, detail="저자를 찾을 수 없습니다")

    articles = sorted(
        author.articles,
        key=lambda a: a.article_published_date or a.article_created_at,
        reverse=True,
    )
    categories = sorted(
        {a.article_category for a in articles if a.article_category}
    )

    return AuthorDetailResponse(
        author_numb=author.author_numb,
        author_name=author.author_name,
        author_from=author.author_from,
        author_email=author.author_email,
        categories=categories,
        articles=[_article_summary(a) for a in articles],
    )


@router.post("/{author_numb}/email", response_model=EmailSendResponse)
def send_email_to_author(
    author_numb: int,
    body: EmailSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    author = db.query(Author).filter(Author.author_numb == author_numb).first()
    if not author:
        raise HTTPException(status_code=404, detail="저자를 찾을 수 없습니다")
    if not author.author_email:
        raise HTTPException(status_code=400, detail="이 저자는 등록된 이메일이 없습니다")

    if not body.subject.strip():
        raise HTTPException(status_code=400, detail="제목을 입력하세요")
    if not body.body.strip():
        raise HTTPException(status_code=400, detail="본문을 입력하세요")

    reply_to = str(body.reply_to) if body.reply_to else current_user.user_email

    try:
        email_service.send_email(
            to_addr=author.author_email,
            subject=body.subject,
            body=body.body,
            reply_to=reply_to,
        )
    except email_service.EmailNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"메일 발송 실패: {exc}") from exc

    return EmailSendResponse(sent=True, to=author.author_email)
