from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.chat import ChatMessage
from app.models.mentoring import MentoringMatch
from app.models.user import User
from app.schemas.chat import ChatMessageCreate, ChatMessageResponse
from app.services.content_filter import check_sensitive_content

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _get_match_or_404(db: Session, match_id: int) -> MentoringMatch:
    match = db.query(MentoringMatch).filter(MentoringMatch.match_id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="매칭을 찾을 수 없습니다")
    return match


def _assert_participant(match: MentoringMatch, user_id: int) -> None:
    if match.mentee_id != user_id and match.mentor_id != user_id:
        raise HTTPException(status_code=403, detail="해당 매칭의 참여자만 접근할 수 있습니다")


def _to_message_response(message: ChatMessage, warning: str | None = None) -> ChatMessageResponse:
    return ChatMessageResponse(
        message_id=message.message_id,
        match_id=message.match_id,
        sender_id=message.sender_id,
        content=message.content,
        is_flagged=message.is_flagged,
        flag_reason=message.flag_reason,
        created_at=message.created_at,
        warning=warning,
    )


@router.post(
    "/{match_id}/messages",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    match_id: int,
    body: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    match = _get_match_or_404(db, match_id)
    _assert_participant(match, current_user.user_id)

    if match.status != "accepted":
        raise HTTPException(status_code=400, detail="수락된 매칭에서만 메시지를 전송할 수 있습니다")

    is_flagged, reason = check_sensitive_content(body.content)
    message = ChatMessage(
        match_id=match_id,
        sender_id=current_user.user_id,
        content=body.content,
        is_flagged=is_flagged,
        flag_reason=reason,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    warning = None
    if is_flagged:
        warning = f"민감정보({reason})가 감지되었습니다. 외부 연락처나 개인정보 공유에 주의하세요."

    return _to_message_response(message, warning=warning)


@router.get("/{match_id}/messages", response_model=list[ChatMessageResponse])
def list_messages(
    match_id: int,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    match = _get_match_or_404(db, match_id)
    _assert_participant(match, current_user.user_id)

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.match_id == match_id)
        .order_by(ChatMessage.created_at.asc(), ChatMessage.message_id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_to_message_response(message) for message in messages]
