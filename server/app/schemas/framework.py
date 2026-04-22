from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


SUPPORTED_TYPES = ["OKR", "AARRR", "JTBD", "Flywheel", "린캔버스"]


class FrameworkGenerate(BaseModel):
    framework_type: str = Field(..., description=f"지원 타입: {', '.join(SUPPORTED_TYPES)}")
    user_input: str = Field(..., description="현재 상황 또는 해결하고 싶은 과제")


class FrameworkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    framework_id: int
    user_id: int
    framework_type: Optional[str] = None
    user_input: str
    generated_content: dict
    referenced_article_ids: Optional[list[int]] = None
    is_saved: bool
    created_at: datetime
