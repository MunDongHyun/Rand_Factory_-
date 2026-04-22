from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ChatMessageCreate(BaseModel):
    content: str


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    message_id: int
    match_id: int
    sender_id: int
    content: str
    is_flagged: bool
    flag_reason: Optional[str] = None
    created_at: datetime
    warning: Optional[str] = None
