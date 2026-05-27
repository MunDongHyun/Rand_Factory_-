from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, update
from sqlalchemy.orm import Session
from collections import Counter


from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.ai_summaries import AiSummary
from app.models.article import Article
from app.models.user import User
from app.schemas.article import (
    ArticleCreate,
    ArticleDetailResponse,
    ArticleInsightsResponse,
    ArticleListResponse,
    ArticleResponse,
    ArticleSummaryResponse,
    AuthorBrief,
    CategoryStatItem,
    CategoryStatsResponse,
    TimelinePoint,
    TimelineResponse,
)
from app.services import article_service, rag_service, thumbnail_service
from app.models.user_activity import UserActivity

router = APIRouter(prefix="/api/articles", tags=["articles"])


def _extract_preview_summary_title(summary_text: dict | list | None) -> str | None:
    if not isinstance(summary_text, dict):
        return None

    card_news = summary_text.get("card_news")
    if not isinstance(card_news, list) or not card_news:
        return None

    first_card = card_news[0]
    if not isinstance(first_card, dict):
        return None

    detailed_summary = first_card.get("detailed_summary")
    if isinstance(detailed_summary, str) and detailed_summary.strip():
        summary = " ".join(detailed_summary.split())
        return summary[:160] + ("..." if len(summary) > 160 else "")

    core_message = first_card.get("core_message")
    if isinstance(core_message, str) and core_message.strip():
        return core_message

    title = first_card.get("card_title")
    return title if isinstance(title, str) and title.strip() else None


def _to_response(
    article: Article,
    summary_article_ids: set[int] | None = None,
    preview_summary_titles: dict[int, str] | None = None,
) -> ArticleResponse:
    response = ArticleResponse.model_validate(article)
    response.article_thumbnail_url = thumbnail_service.get_thumbnail_url(article)
    if summary_article_ids is not None:
        response.article_has_summary = article.article_id in summary_article_ids
    if preview_summary_titles is not None:
        response.article_preview_summary_title = preview_summary_titles.get(article.article_id)
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


def _preview_summary_titles(db: Session, article_ids: list[int]) -> dict[int, str]:
    if not article_ids:
        return {}

    rows = (
        db.query(AiSummary)
        .filter(AiSummary.article_id.in_(article_ids))
        .order_by(AiSummary.article_id.asc(), AiSummary.created_at.desc(), AiSummary.output_id.desc())
        .all()
    )

    previews: dict[int, str] = {}
    for row in rows:
        if row.article_id is None or row.article_id in previews:
            continue
        title = _extract_preview_summary_title(row.summary_text)
        if title:
            previews[row.article_id] = title
    return previews


@router.post("", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
def create_article(
    body: ArticleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.user_role != "a":
        raise HTTPException(status_code=403, detail="게시글 생성은 관리자만 할 수 있습니다")

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
    keyword: str | None = Query(None, description="Search keyword for semantic search"), 
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user), 
):
    # 🌟 1. 기본 쿼리에서 'AI' 출처 제외
    query = db.query(Article)

    if keyword:
        recent_logs = db.query(UserActivity.category)\
                        .filter(UserActivity.user_id == current_user.user_id)\
                        .order_by(UserActivity.created_at.desc())\
                        .limit(30).all()
        category_counts = Counter([log.category for log in recent_logs])
        total_logs = sum(category_counts.values()) or 1
        user_pref_weights = {cat: count / total_logs for cat, count in category_counts.items()}

        vector_results = rag_service.search_similar_with_scores(query_text=keyword, k=50)
        
        print(f"\n🔍 검색어: '{keyword}'")
        for aid, dist, content in vector_results[:5]: 
            print(f" - 아티클 ID: {aid} | 거리(Distance): {dist:.4f}")

        # 🌟 2. 키워드 직접 매칭 시 'AI' 제외
        exact_matches = db.query(Article.article_id).filter(
            Article.article_title.ilike(f"%{keyword}%")
        ).all()
        exact_match_ids = [row[0] for row in exact_matches]

        merged_distances = {aid: 0.1 for aid in exact_match_ids}

        for aid, dist, content in vector_results:
            
            if keyword in content:
                dist = 0.1

            if aid in merged_distances:
                merged_distances[aid] = min(merged_distances[aid], dist)
            else:
                merged_distances[aid] = dist

        DISTANCE_THRESHOLD = settings.article_search_distance_threshold
        filtered_results = [(aid, dist) for aid, dist in merged_distances.items() if dist <= DISTANCE_THRESHOLD]
        
        # 필터링 후 남은 게 없다면 빈 리스트 반환 -> 팝업 띄움!
        if not filtered_results:
            return ArticleListResponse(articles=[], total=0)

        hybrid_scores = []
        matched_article_ids = [aid for aid, _ in filtered_results]
        
        # 🌟 3. 점수 계산을 위한 DB 조회 시 'AI' 제외
        db_articles = db.query(Article).filter(
            Article.article_id.in_(matched_article_ids)
        ).all()
        article_map = {a.article_id: a for a in db_articles}

        for article_id, distance in filtered_results:
            article = article_map.get(article_id)
            if not article:
                continue
                
            content_score = max(0, 1 - distance) 
            user_score = user_pref_weights.get(article.article_category, 0.0)

            final_score = (content_score * 0.7) + (user_score * 0.3)
            hybrid_scores.append((article_id, final_score))

        hybrid_scores.sort(key=lambda x: x[1], reverse=True)
        sorted_article_ids = [aid for aid, score in hybrid_scores]

        query = query.filter(Article.article_id.in_(sorted_article_ids))
        order_case = {id_: index for index, id_ in enumerate(sorted_article_ids)}
        query = query.order_by(func.field(Article.article_id, *sorted_article_ids))

    elif category:
        query = query.filter(Article.article_category == category)
    elif source:
        query = query.filter(Article.article_source == source)

    if not keyword:
        query = query.order_by(
            Article.article_published_date.desc(),
            Article.article_created_at.desc(),
            Article.article_id.desc(),
        )

    total = query.count()
    articles = query.offset((page - 1) * limit).limit(limit).all()
    article_ids = [a.article_id for a in articles]
    summary_article_ids = _summary_article_ids(db, article_ids)
    preview_summary_titles = _preview_summary_titles(db, article_ids)

    return ArticleListResponse(
        articles=[_to_response(a, summary_article_ids, preview_summary_titles) for a in articles],
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
    article_ids = [a.article_id for a in articles]
    summary_article_ids = _summary_article_ids(db, article_ids)
    preview_summary_titles = _preview_summary_titles(db, article_ids)
    return [_to_response(a, summary_article_ids, preview_summary_titles) for a in articles]


@router.get("/stats/by-category", response_model=CategoryStatsResponse)
def get_category_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """관리자(a) 전용: 카테고리별 조회수 합과 아티클 수 (도넛 차트용)."""
    if current_user.user_role != "a":
        raise HTTPException(status_code=404, detail="찾을 수 없습니다")

    rows = (
        db.query(
            Article.article_category,
            func.coalesce(func.sum(Article.article_view_count), 0).label("total_views"),
            func.count(Article.article_id).label("article_count"),
        )
        .filter(Article.article_category.isnot(None))
        .group_by(Article.article_category)
        .order_by(func.coalesce(func.sum(Article.article_view_count), 0).desc())
        .all()
    )
    return CategoryStatsResponse(
        items=[
            CategoryStatItem(
                category=category,
                total_views=int(total_views or 0),
                article_count=int(article_count or 0),
            )
            for category, total_views, article_count in rows
        ]
    )


@router.get("/stats/views-timeline", response_model=TimelineResponse)
def get_views_timeline(
    days: int = Query(30, ge=1, le=180),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """관리자(a) 전용: 최근 N일 일별 아티클 조회 이벤트 수 (user_activities 기반)."""
    if current_user.user_role != "a":
        raise HTTPException(status_code=404, detail="찾을 수 없습니다")

    today = date.today()
    start_date = today - timedelta(days=days - 1)

    rows = (
        db.query(
            func.date(UserActivity.created_at).label("d"),
            func.count(UserActivity.activity_id).label("cnt"),
        )
        .filter(UserActivity.created_at >= start_date)
        .group_by(func.date(UserActivity.created_at))
        .all()
    )
    date_counts = {row.d: int(row.cnt) for row in rows}

    items = []
    for i in range(days):
        d = start_date + timedelta(days=i)
        items.append(TimelinePoint(date=d, count=date_counts.get(d, 0)))
    return TimelineResponse(items=items)


@router.get("/{article_id}/summary", response_model=ArticleSummaryResponse)
def get_article_summary(
    article_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    article = db.query(Article).filter(Article.article_id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")

    summary = (
        db.query(AiSummary)
        .filter(AiSummary.article_id == article_id) 
        .order_by(AiSummary.created_at.desc(), AiSummary.output_id.desc())
        .first()
    )
    if not summary:
        raise HTTPException(status_code=404, detail="게시글 요약을 찾을 수 없습니다")
    return summary


@router.get("/{article_id}/insights", response_model=ArticleInsightsResponse)
def get_article_insights(
    article_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    article = db.query(Article).filter(Article.article_id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")

    content = rag_service.get_article_content(article_id)

    if not content:
        raise HTTPException(status_code=422, detail="게시글 내용이 아직 색인되지 않았습니다")

    result = article_service.extract_insights(title=article.article_title, content=content)
    return ArticleInsightsResponse(
        article_id=article.article_id,
        title=article.article_title,
        keywords=result.get("keywords", []),
        insights=result.get("insights", []),
    )


@router.post("/{article_id}/view", response_model=ArticleDetailResponse)
def record_article_view(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user), # 기존 _current_user의 언더바(_)를 제거하여 변수로 사용
):
    article = db.query(Article).filter(Article.article_id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")

    # 1. 기존: 아티클 전체 조회수 증가
    db.execute(
        update(Article)
        .where(Article.article_id == article_id)
        .values(article_view_count=func.coalesce(Article.article_view_count, 0) + 1)
    )

    # 2. 추가: 하이브리드 추천을 위한 유저 행동 로그 적재
    new_activity = UserActivity(
        user_id=current_user.user_id,
        article_id=article_id,
        category=article.article_category
    )
    db.add(new_activity)

    db.commit()
    db.refresh(article)

    article_ids = [article.article_id]
    summary_article_ids = _summary_article_ids(db, article_ids)
    preview_summary_titles = _preview_summary_titles(db, article_ids)
    base = _to_response(article, summary_article_ids, preview_summary_titles)
    return ArticleDetailResponse(
        **base.model_dump(),
        authors=[AuthorBrief.model_validate(a) for a in article.authors],
    )

@router.get("/{article_id}", response_model=ArticleDetailResponse)
def get_article(
    article_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    article = db.query(Article).filter(Article.article_id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")

    article_ids = [article.article_id]
    summary_article_ids = _summary_article_ids(db, article_ids)
    preview_summary_titles = _preview_summary_titles(db, article_ids)
    base = _to_response(article, summary_article_ids, preview_summary_titles)
    return ArticleDetailResponse(
        **base.model_dump(),
        authors=[AuthorBrief.model_validate(a) for a in article.authors],
    )
