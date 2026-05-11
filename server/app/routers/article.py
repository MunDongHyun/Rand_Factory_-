from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.ai_output import AiOutput
from app.models.article import Article
from app.models.user import User
from app.schemas.article import (
    ArticleCreate,
    ArticleInsightsResponse,
    ArticleListResponse,
    ArticleResponse,
    ArticleSummaryResponse,
)
from app.services import article_service, rag_service, thumbnail_service

router = APIRouter(prefix="/api/articles", tags=["articles"])


def _to_response(article: Article) -> ArticleResponse:
    response = ArticleResponse.model_validate(article)
    response.article_thumbnail_url = thumbnail_service.get_thumbnail_url(article)
    return response


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

    return _to_response(article)


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

    return ArticleListResponse(
        articles=[_to_response(a) for a in articles],
        total=total,
    )


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


@router.get("/popular", response_model=list[ArticleResponse])
def get_popular_articles(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    articles = (
        db.query(Article)
        .order_by(Article.article_view_count.desc(), Article.article_created_at.desc())
        .limit(limit)
        .all()
    )
    return [_to_response(a) for a in articles]


@router.get("/{article_id}/summary", response_model=ArticleSummaryResponse)
def get_article_summary(
    article_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    article = db.query(Article).filter(Article.article_id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    summary = (
        db.query(AiOutput)
        .filter(AiOutput.article_id == article_id, AiOutput.output_type == "summary")
        .order_by(AiOutput.created_at.desc(), AiOutput.output_id.desc())
        .first()
    )
    if not summary:
        raise HTTPException(status_code=404, detail="Article summary not found")
    return summary


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

    db.execute(
        update(Article)
        .where(Article.article_id == article_id)
        .values(article_view_count=Article.article_view_count + 1)
    )
    db.commit()
    db.refresh(article)

    return _to_response(article)