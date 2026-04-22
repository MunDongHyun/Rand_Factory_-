from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import article, chat, framework, health, mentor, mentoring, point, rag, user

app = FastAPI(
    title="landfactory API",
    description="DBR 아티클 기반 RAG 멘토링 플랫폼",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(user.router)
app.include_router(mentoring.router)
app.include_router(point.router)
app.include_router(article.router)
app.include_router(mentor.router)
app.include_router(chat.router)
app.include_router(rag.router)
app.include_router(framework.router)
