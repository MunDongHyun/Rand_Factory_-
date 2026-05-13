from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    company: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    user_email: str
    user_name: str
    user_company: str | None = None
    user_role: str
    user_created_at: datetime | None = None
    user_updated_at: datetime | None = None
    user_deleted_at: datetime | None = None


class BulkSignupEmployee(BaseModel):
    email: EmailStr
    password: str
    name: str


class BulkSignupRequest(BaseModel):
    company: str
    employees: list[BulkSignupEmployee]


class BulkSignupResponse(BaseModel):
    users: list[UserResponse]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int


class UserStatsResponse(BaseModel):
    total_users: int
    monthly_signups: int
    top_company: str | None = None
