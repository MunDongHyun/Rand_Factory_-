from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AiSummaryCreate(BaseModel):
    article_id: int | None = None
    summary_text: dict | list | None = None
    result_json: dict | None = None
    image_url: str | None = None
    framework_type: str | None = None
    user_input: str | None = None
    generated_content: dict | None = None
    is_saved: bool = False
    model_used: str | None = None


# 수정 2: AiOutputUpdate -> AiSummaryUpdate 로 이름만 변경
class AiSummaryUpdate(BaseModel):
    is_saved: bool | None = None


class AiSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    output_id: int
    user_id: int | None = None
    article_id: int | None = None
    summary_text: dict | list | None = None
    result_json: dict | None = None
    image_url: str | None = None
    framework_type: str | None = None
    user_input: str | None = None
    generated_content: dict | None = None
    is_saved: bool | None = None
    model_used: str | None = None
    created_at: datetime | None = None
    is_saved: bool | None = None
    model_used: str | None = None
    created_at: datetime | None = None