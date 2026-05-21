from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.article import Article
from app.models.bookmark import Bookmark
from app.models.user import User
from app.schemas.bookmark import (
    BookmarkArticleItem,
    BookmarkCreate,
    BookmarkCreateResponse,
    MyBookmarksResponse,
)
from app.services import thumbnail_service

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])


@router.get("/me", response_model=MyBookmarksResponse)
def get_my_bookmarks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bookmarks = (
        db.query(Bookmark)
        .filter(Bookmark.user_id == current_user.user_id)
        .all()
    )

    if not bookmarks:
        return MyBookmarksResponse(articles=[])

    created_at_lookup = {b.article_id: b.created_at for b in bookmarks}
    article_ids = list(created_at_lookup.keys())

    articles = db.query(Article).filter(Article.article_id.in_(article_ids)).all()

    items: list[BookmarkArticleItem] = [
        BookmarkArticleItem(
            article_id=article.article_id,
            article_title=article.article_title,
            article_category=article.article_category,
            article_thumbnail_url=thumbnail_service.get_thumbnail_url(article),
            article_published_date=article.article_published_date,
            created_at=created_at_lookup[article.article_id],
        )
        for article in articles
    ]
    items.sort(key=lambda x: x.created_at, reverse=True)

    return MyBookmarksResponse(articles=items)


@router.post("", response_model=BookmarkCreateResponse, status_code=status.HTTP_201_CREATED)
def create_bookmark(
    body: BookmarkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    article = db.query(Article).filter(Article.article_id == body.article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="아티클을 찾을 수 없습니다")

    existing = (
        db.query(Bookmark)
        .filter(
            Bookmark.user_id == current_user.user_id,
            Bookmark.article_id == body.article_id,
        )
        .first()
    )

    if existing:
        return BookmarkCreateResponse(bookmark_id=existing.bookmark_id, created=False)

    bookmark = Bookmark(
        user_id=current_user.user_id,
        article_id=body.article_id,
    )
    db.add(bookmark)
    db.commit()
    db.refresh(bookmark)
    return BookmarkCreateResponse(bookmark_id=bookmark.bookmark_id, created=True)


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bookmark(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bookmark = (
        db.query(Bookmark)
        .filter(
            Bookmark.user_id == current_user.user_id,
            Bookmark.article_id == article_id,
        )
        .first()
    )

    if bookmark:
        db.delete(bookmark)
        db.commit()
