from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import update
from sqlalchemy.orm import Session
from app.schemas.ai_output import AiSummaryResponse 

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.ai_summaries import AiSummary
from app.models.article import Article
from app.models.user import User
from app.schemas.article import (ArticleCreate, ArticleInsightsResponse, ArticleListResponse, ArticleResponse, ArticleSummaryResponse,)
from app.services import article_service, rag_service, thumbnail_service

router = APIRouter(prefix="/api/articles", tags=["articles"])


def _to_response(article: Article, summary_article_ids: set[int] | None = None) -> ArticleResponse:
    response = ArticleResponse.model_validate(article)
    response.article_thumbnail_url = thumbnail_service.get_thumbnail_url(article)
    if summary_article_ids is not None:
        response.article_has_summary = article.article_id in summary_article_ids
    return response


def _summary_article_ids(db: Session, article_ids: list[int]) -> set[int]:
    if not article_ids:
        return set()

    rows = (
        db.query(AiSummary.article_id)
        .filter(
            AiSummary.article_id.in_(article_ids),
        )
        .distinct()
        .all()
    )
    return {article_id for (article_id,) in rows if article_id is not None}


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
    )
    db.add(article)
    db.commit()
    db.refresh(article)

    if body.content:
        rag_service.ingest_article(
            article_id=article.article_id,
            title=article.article_title,
            content=body.content,
            category=article.article_category,
            author=article.article_author,
        )

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

    summary_article_ids = _summary_article_ids(db, [a.article_id for a in articles])

    return ArticleListResponse(
        articles=[_to_response(a, summary_article_ids) for a in articles],
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
    summary_article_ids = _summary_article_ids(db, [a.article_id for a in articles])
    return [_to_response(a, summary_article_ids) for a in articles]


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
        db.query(AiSummary)
        .filter(AiSummary.article_id == article_id) 
        .order_by(AiSummary.created_at.desc(), AiSummary.output_id.desc())
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

    summary_article_ids = _summary_article_ids(db, [article.article_id])
    return _to_response(article, summary_article_ids)




# 기존에 ai_output에 있던 라우터 article.py파일로 이동
@router.get("/{article_id}/summary", response_model=AiSummaryResponse)
def get_article_summary(
    article_id: int, 
    db: Session = Depends(get_db)
):
    """
    특정 아티클의 AI 요약 데이터를 가져옵니다.
    프론트엔드의 api.get(`/articles/${article.article_id}/summary`) 요청에 대응합니다.
    """
    # DB 구조에 맞춰 article_id로 필터링
    summary = (
        db.query(AiSummary)
        .filter(AiSummary.article_id == article_id)
        .order_by(AiSummary.created_at.desc())  # 최신 요약본 우선
        .first()
    )

    if not summary:
        raise HTTPException(
            status_code=404, 
            detail="이 아티클에 대한 요약문이 아직 생성되지 않았습니다."
        )
        
    return summary


