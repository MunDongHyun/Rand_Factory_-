from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


ChatbotRole = Literal["user", "assistant"]


class ChatbotSessionCreate(BaseModel):
    cb_curriculum_id: int | None = None


class ChatbotSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cb_session_id: int
    cb_manager_id: int
    cb_curriculum_id: int | None = None
    cb_created_at: datetime | None = None


class ChatbotMessageCreate(BaseModel):
    role: ChatbotRole
    content: str


class ChatbotMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    message_id: int
    session_id: int
    role: ChatbotRole
    content: str
    created_at: datetime | None = None
