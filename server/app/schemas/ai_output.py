from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator


AiOutputType = Literal["summary", "wordcloud", "framework"]


class AiOutputCreate(BaseModel):
    article_id: int | None = None
    output_type: AiOutputType
    summary_text: str | None = None
    result_json: dict | None = None
    image_url: str | None = None
    framework_type: str | None = None
    user_input: str | None = None
    generated_content: dict | None = None
    is_saved: bool = False
    model_used: str | None = None

    @model_validator(mode="after")
    def _validate_required_fields(self):
        if self.output_type == "summary" and not self.summary_text:
            raise ValueError("summary_text is required when output_type is 'summary'")
        if self.output_type == "wordcloud" and not (self.result_json or self.image_url):
            raise ValueError("result_json or image_url is required when output_type is 'wordcloud'")
        if self.output_type == "framework" and not (self.framework_type and self.generated_content):
            raise ValueError("framework_type and generated_content are required when output_type is 'framework'")
        return self


class AiOutputUpdate(BaseModel):
    is_saved: bool | None = None


class AiOutputResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    output_id: int
    user_id: int
    article_id: int | None = None
    output_type: AiOutputType
    summary_text: str | None = None
    result_json: dict | None = None
    image_url: str | None = None
    framework_type: str | None = None
    user_input: str | None = None
    generated_content: dict | None = None
    is_saved: bool | None = None
    model_used: str | None = None
    created_at: datetime | None = None
