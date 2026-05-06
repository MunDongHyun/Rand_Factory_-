from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str
    job_title: str | None = None
    industry: str | None = None
    work_years: int | None = 0

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in {"j", "m", "a"}:
            raise ValueError("role must be one of: j, m, a")
        return value


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
