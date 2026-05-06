from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.chatbot import ChatbotMessage, ChatbotSession
from app.models.curriculum import Curriculum
from app.models.user import User
from app.schemas.chatbot import (
    ChatbotMessageCreate,
    ChatbotMessageResponse,
    ChatbotSessionCreate,
    ChatbotSessionResponse,
)

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])


@router.post("/sessions", response_model=ChatbotSessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    body: ChatbotSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=403, detail="Only manager/admin can use chatbot")

    if body.cb_curriculum_id is not None:
        curriculum = (
            db.query(Curriculum)
            .filter(Curriculum.cur_id == body.cb_curriculum_id)
            .first()
        )
        owns_curriculum = curriculum is not None and (
            current_user.user_role == "a" or curriculum.cur_creator_id == current_user.user_id
        )
        if not owns_curriculum:
            raise HTTPException(status_code=404, detail="Curriculum not found")

    session = ChatbotSession(cb_manager_id=current_user.user_id, cb_curriculum_id=body.cb_curriculum_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions", response_model=list[ChatbotSessionResponse])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ChatbotSession)
        .filter(ChatbotSession.cb_manager_id == current_user.user_id)
        .order_by(ChatbotSession.cb_created_at.desc())
        .all()
    )


@router.post("/sessions/{session_id}/messages", response_model=ChatbotMessageResponse, status_code=status.HTTP_201_CREATED)
def create_message(
    session_id: int,
    body: ChatbotMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(ChatbotSession)
        .filter(ChatbotSession.cb_session_id == session_id, ChatbotSession.cb_manager_id == current_user.user_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Chatbot session not found")

    message = ChatbotMessage(session_id=session_id, role=body.role, content=body.content)
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.get("/sessions/{session_id}/messages", response_model=list[ChatbotMessageResponse])
def list_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(ChatbotSession)
        .filter(ChatbotSession.cb_session_id == session_id, ChatbotSession.cb_manager_id == current_user.user_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Chatbot session not found")

    return (
        db.query(ChatbotMessage)
        .filter(ChatbotMessage.session_id == session_id)
        .order_by(ChatbotMessage.created_at.asc(), ChatbotMessage.message_id.asc())
        .all()
    )
