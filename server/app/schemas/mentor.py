from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, field_validator


class MentorProfileUpdate(BaseModel):
    bio: Optional[str] = None
    specialties: Optional[list[str]] = None
    available: Optional[bool] = None


class MentorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    name: str
    job_title: Optional[str] = None
    industry: Optional[str] = None
    years_of_experience: int
    profile_image_url: Optional[str] = None
    mentor_profile_id: int
    business_card_image_url: Optional[str] = None
    is_verified: bool
    bio: Optional[str] = None
    specialties: list[str]
    available: bool
    rating_avg: float
    mentoring_count: int

    @field_validator("specialties", mode="before")
    @classmethod
    def normalize_specialties(cls, value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            return [str(item) for item in value.values()]
        return []

    @field_validator("rating_avg", mode="before")
    @classmethod
    def normalize_rating_avg(cls, value: Any) -> float:
        if value is None:
            return 0.0
        if isinstance(value, Decimal):
            return float(value)
        return value
