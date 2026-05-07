from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.article import Article
from app.models.user import User
from app.schemas.article import ArticleCreate, ArticleListResponse, ArticleResponse
from app.services import rag_service

router = APIRouter(prefix="/api/articles", tags=["articles"])


@router.post("", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
def create_article(
    body: ArticleCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    article = Article(
        title=body.title,
        author=body.author,
        published_date=body.published_date,
        category=body.category,
        industry_tags=body.industry_tags,
        summary=body.summary,
        source_url=body.source_url,
    )
    db.add(article)
    db.commit()
    db.refresh(article)

    if body.content:
        chunk_count = rag_service.ingest_article(
            article_id=article.article_id,
            title=article.title,
            content=body.content,
            category=article.category,
            author=article.author,
        )
        article.chunk_count = chunk_count
        db.commit()
        db.refresh(article)

    return article


@router.get("", response_model=ArticleListResponse)
def list_articles(
    category: str | None = None,
    industry: str | None = None,
    keyword: str | None = Query(None, description="Search keyword for article title"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Article)

    if category:
        query = query.filter(Article.category == category)

    if industry:
        query = query.filter(Article.industry_tags.contains(industry))

    if keyword:
        query = query.filter(Article.title.ilike(f"%{keyword}%"))

    total = query.count()
    articles = (
        query.order_by(Article.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return ArticleListResponse(articles=articles, total=total)


@router.get("/categories", response_model=list[str])
def list_categories(db: Session = Depends(get_db)):
    rows = (
        db.query(Article.category)
        .filter(Article.category.isnot(None))
        .distinct()
        .order_by(Article.category.asc())
        .all()
    )
    return [category for (category,) in rows if category]


@router.get("/{article_id}", response_model=ArticleResponse)
def get_article(article_id: int, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.article_id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="아티클을 찾을 수 없습니다")
    return article
