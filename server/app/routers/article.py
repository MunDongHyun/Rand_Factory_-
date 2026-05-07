from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.article import Article
from app.models.user import User
from app.schemas.article import ArticleCreate, ArticleInsightsResponse, ArticleListResponse, ArticleResponse
from app.services import article_service, rag_service

router = APIRouter(prefix="/api/articles", tags=["articles"])


@router.post("", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
def create_article(
    body: ArticleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.user_role != "a":
        raise HTTPException(status_code=403, detail="Only admin can create articles")

    article = Article(
        article_source=body.article_source,
        article_title=body.article_title,
        article_author=body.article_author,
        article_published_date=body.article_published_date,
        article_category=body.article_category,
        article_source_url=body.article_source_url,
        article_image_count=body.article_image_count,
    )
    db.add(article)
    db.commit()
    db.refresh(article)

    if body.content:
        chunk_count = rag_service.ingest_article(
            article_id=article.article_id,
            title=article.article_title,
            content=body.content,
            category=article.article_category,
            author=article.article_author,
        )
        article.article_chunk_count = chunk_count
        db.commit()
        db.refresh(article)

    return article


@router.get("", response_model=ArticleListResponse)
def list_articles(
    category: str | None = None,
    source: str | None = None,
    keyword: str | None = Query(None, description="Search keyword for article title"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    query = db.query(Article)

    if category:
        query = query.filter(Article.article_category == category)

    if source:
        query = query.filter(Article.article_source == source)

    if keyword:
        query = query.filter(Article.article_title.ilike(f"%{keyword}%"))

    total = query.count()
    articles = (
        query.order_by(Article.article_created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return ArticleListResponse(articles=articles, total=total)


@router.get("/categories", response_model=list[str])
def list_categories(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(Article.article_category)
        .distinct()
        .order_by(Article.article_category.asc())
        .all()
    )
    return [category for (category,) in rows if category]


@router.get("/{article_id}/insights", response_model=ArticleInsightsResponse)
def get_article_insights(
    article_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    article = db.query(Article).filter(Article.article_id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    content = rag_service.get_article_content(article_id)

    if not content:
        raise HTTPException(status_code=422, detail="Article content is not indexed yet")

    result = article_service.extract_insights(title=article.article_title, content=content)
    return ArticleInsightsResponse(
        article_id=article.article_id,
        title=article.article_title,
        keywords=result.get("keywords", []),
        insights=result.get("insights", []),
    )


@router.get("/{article_id}", response_model=ArticleResponse)
def get_article(
    article_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    article = db.query(Article).filter(Article.article_id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article
