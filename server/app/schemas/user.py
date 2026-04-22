from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str
    job_title: Optional[str] = None
    industry: Optional[str] = None
    years_of_experience: int = 0

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("mentee", "mentor"):
            raise ValueError("role은 mentee 또는 mentor여야 합니다")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class MentorProfileCreate(BaseModel):
    bio: Optional[str] = None
    specialties: list[str] = []


class MentorProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    mentor_profile_id: int
    user_id: int
    is_verified: bool
    bio: Optional[str] = None
    specialties: Optional[list[str]] = None
    rating_avg: float
    mentoring_count: int


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    email: str
    name: str
    role: str
    job_title: Optional[str] = None
    industry: Optional[str] = None
    years_of_experience: int
    created_at: datetime
    mentor_profile: Optional[MentorProfileResponse] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
