from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.article import Article
from app.models.user import User
<<<<<<< HEAD
from app.schemas.article import ArticleCreate, ArticleListResponse, ArticleResponse
from app.services import rag_service
=======
from app.schemas.article import ArticleCreate, ArticleInsightsResponse, ArticleListResponse, ArticleResponse
from app.services import article_service, rag_service
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511

router = APIRouter(prefix="/api/articles", tags=["articles"])


@router.post("", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
def create_article(
    body: ArticleCreate,
    db: Session = Depends(get_db),
<<<<<<< HEAD
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
=======
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
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511
    )
    db.add(article)
    db.commit()
    db.refresh(article)

    if body.content:
        chunk_count = rag_service.ingest_article(
            article_id=article.article_id,
<<<<<<< HEAD
            title=article.title,
            content=body.content,
            category=article.category,
            author=article.author,
        )
        article.chunk_count = chunk_count
=======
            title=article.article_title,
            content=body.content,
            category=article.article_category,
            author=article.article_author,
        )
        article.article_chunk_count = chunk_count
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511
        db.commit()
        db.refresh(article)

    return article


@router.get("", response_model=ArticleListResponse)
def list_articles(
    category: str | None = None,
<<<<<<< HEAD
    industry: str | None = None,
=======
    source: str | None = None,
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511
    keyword: str | None = Query(None, description="Search keyword for article title"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
<<<<<<< HEAD
=======
    _current_user: User = Depends(get_current_user),
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511
):
    query = db.query(Article)

    if category:
<<<<<<< HEAD
        query = query.filter(Article.category == category)

    if industry:
        query = query.filter(Article.industry_tags.contains(industry))

    if keyword:
        query = query.filter(Article.title.ilike(f"%{keyword}%"))

    total = query.count()
    articles = (
        query.order_by(Article.created_at.desc())
=======
        query = query.filter(Article.article_category == category)

    if source:
        query = query.filter(Article.article_source == source)

    if keyword:
        query = query.filter(Article.article_title.ilike(f"%{keyword}%"))

    total = query.count()
    articles = (
        query.order_by(Article.article_created_at.desc())
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return ArticleListResponse(articles=articles, total=total)


@router.get("/categories", response_model=list[str])
<<<<<<< HEAD
def list_categories(db: Session = Depends(get_db)):
    rows = (
        db.query(Article.category)
        .filter(Article.category.isnot(None))
        .distinct()
        .order_by(Article.category.asc())
=======
def list_categories(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(Article.article_category)
        .distinct()
        .order_by(Article.article_category.asc())
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511
        .all()
    )
    return [category for (category,) in rows if category]


<<<<<<< HEAD
@router.get("/{article_id}", response_model=ArticleResponse)
def get_article(article_id: int, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.article_id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="아티클을 찾을 수 없습니다")
=======
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
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511
    return article
