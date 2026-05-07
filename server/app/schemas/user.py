from datetime import datetime
<<<<<<< HEAD
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
=======

from pydantic import BaseModel, ConfigDict, EmailStr
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
<<<<<<< HEAD
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
=======
    job_title: str | None = None
    industry: str | None = None
    work_years: int | None = 0
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511


class UserLogin(BaseModel):
    email: EmailStr
    password: str


<<<<<<< HEAD
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


=======
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511
class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
<<<<<<< HEAD
    email: str
    name: str
    role: str
    job_title: Optional[str] = None
    industry: Optional[str] = None
    years_of_experience: int
    created_at: datetime
    mentor_profile: Optional[MentorProfileResponse] = None
=======
    user_email: str
    user_name: str
    user_role: str
    user_job_title: str | None = None
    user_industry: str | None = None
    user_work_years: int | None = None
    user_created_at: datetime | None = None
    user_updated_at: datetime | None = None
    user_deleted_at: datetime | None = None
>>>>>>> 54ce94ac13cdc028831d4832e4150a5dcb114511


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
