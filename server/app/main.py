from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.limiter import limiter
from app.routers import (
    article,
    author,
    bookmark,
    certificate,
    curriculum,
    health,
    notification,
    rag,
    reports,
    task_submission,
    thumbnail,
    user,
)


# 필요한 DB 테이블이 있으면 스크립트에 명시해주면 테이블 자동 생성해주는 코드
from app.models.user_activity import UserActivity
from app.models.bookmark import Bookmark
from app.models.notification import Notification
from app.core.database import engine, Base
Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="ArtiCulum API",
    description="DBR/HBR article-based AI learning platform API",
    version="0.2.0",
)

# 레이트 리미트 (slowapi) — IP 기반 메모리 백엔드
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(user.router)
app.include_router(article.router)
app.include_router(author.router)
app.include_router(bookmark.router)
app.include_router(certificate.router)
app.include_router(thumbnail.router)
app.include_router(rag.router)
app.include_router(curriculum.router)
app.include_router(task_submission.router)
app.include_router(notification.router)
app.include_router(reports.router)
