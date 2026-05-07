from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    job_title: str | None = None
    industry: str | None = None
    work_years: int | None = 0


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    user_email: str
    user_name: str
    user_role: str
    user_job_title: str | None = None
    user_industry: str | None = None
    user_work_years: int | None = None
    user_created_at: datetime | None = None
    user_updated_at: datetime | None = None
    user_deleted_at: datetime | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
