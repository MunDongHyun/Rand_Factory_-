from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import article, chatbot, curriculum, health, rag, task_submission, user
from app.services.thumbnail_service import THUMBNAIL_DIR, URL_PREFIX as THUMBNAIL_URL_PREFIX


# 필요한 DB 테이블이 있으면 스크립트에 명시해주면 테이블 자동 생성해주는 코드
from app.models.user_activity import UserActivity
from app.core.database import engine, Base
Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="landfactory API",
    description="DBR/HBR article-based AI learning platform API",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if THUMBNAIL_DIR.exists():
    app.mount(THUMBNAIL_URL_PREFIX, StaticFiles(directory=THUMBNAIL_DIR), name="thumbnails")

app.include_router(health.router)
app.include_router(user.router)
app.include_router(article.router)
app.include_router(rag.router)
app.include_router(curriculum.router)
app.include_router(chatbot.router)
app.include_router(task_submission.router)
