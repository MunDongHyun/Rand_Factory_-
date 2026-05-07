from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

<<<<<<< HEAD
from app.routers import article, chat, health, mentor, mentoring, point, rag, user

app = FastAPI(
    title="landfactory API",
    description="DBR 아티클 기반 RAG 멘토링 플랫폼",
    version="0.1.0",
=======
from app.routers import ai_output, article, chatbot, curriculum, health, rag, task_submission, user

app = FastAPI(
    title="landfactory API",
    description="DBR/HBR article-based AI learning platform API",
    version="0.2.0",
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511
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
<<<<<<< HEAD
app.include_router(mentoring.router)
app.include_router(point.router)
app.include_router(article.router)
app.include_router(mentor.router)
app.include_router(chat.router)
app.include_router(rag.router)
=======
app.include_router(article.router)
app.include_router(rag.router)
app.include_router(curriculum.router)
app.include_router(ai_output.router)
app.include_router(chatbot.router)
app.include_router(task_submission.router)
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511
