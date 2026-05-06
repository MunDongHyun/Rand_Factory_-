from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AiOutputCreate(BaseModel):
    article_id: int | None = None
    output_type: str
    summary_text: str | None = None
    result_json: dict | None = None
    image_url: str | None = None
    framework_type: str | None = None
    user_input: str | None = None
    generated_content: dict | None = None
    is_saved: bool = False
    model_used: str | None = None


class AiOutputUpdate(BaseModel):
    is_saved: bool | None = None


class AiOutputResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    output_id: int
    user_id: int
    article_id: int | None = None
    output_type: str
    summary_text: str | None = None
    result_json: dict | None = None
    image_url: str | None = None
    framework_type: str | None = None
    user_input: str | None = None
    generated_content: dict | None = None
    is_saved: bool | None = None
    model_used: str | None = None
    created_at: datetime | None = None
