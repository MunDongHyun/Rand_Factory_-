from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr


UserRole = Literal["j", "m", "a"]


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


class UserUpdate(BaseModel):
    user_role: UserRole | None = None
    is_deleted: bool | None = None  # true → 강제 탈퇴, false → 복구


class UserActivitySummary(BaseModel):
    user_id: int
    user_role: str
    curricula_created: int = 0     # 매니저/관리자가 만든 커리큘럼 수
    curricula_assigned: int = 0    # 학습자에게 배정된 커리큘럼 수
    submissions_count: int = 0     # 학습자가 제출한 과제 수
    feedbacks_received: int = 0    # 학습자가 받은 피드백 수
    feedbacks_given: int = 0       # 매니저가 작성한 피드백 수
