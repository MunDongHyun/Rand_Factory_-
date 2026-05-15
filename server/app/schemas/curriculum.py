from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

CurriculumStatus = Literal["active", "unactive"]

class CurriculumCreate(BaseModel):
    cur_title: str
    cur_target_job: str | None = None
    cur_target_industry: str | None = None
    cur_duration_weeks: int
    cur_learning_goal: str | None = None
    cur_learning_detail_goal: str | None = None
    cur_week_plan: dict | list[dict] | None = None
    cur_assigned_learner_ids: list[int] | None = None
    cur_status: CurriculumStatus | None = "active"

class CurriculumUpdate(BaseModel):
    cur_title: str | None = None
    cur_target_job: str | None = None
    cur_target_industry: str | None = None
    cur_duration_weeks: int | None = None
    cur_learning_goal: str | None = None
    cur_learning_detail_goal: str | None = None
    cur_week_plan: dict | list[dict] | None = None
    cur_assigned_learner_ids: list[int] | None = None
    cur_status: CurriculumStatus | None = None

# ---------------------------------------------------------
# [수정됨] 불필요해진 옛날 스키마(WeekPlanItem 등) 삭제 
# ---------------------------------------------------------

class CurriculumGenerateRequest(BaseModel):
    cur_title: str
    cur_duration_weeks: int
    cur_target_job: str | None = None
    cur_target_industry: str | None = None
    cur_learning_goal: str | None = None
    required_content: str | None = None

class CurriculumGenerateResponse(BaseModel):
    cur_title: str
    cur_duration_weeks: int
    cur_target_job: str | None = None
    cur_target_industry: str | None = None
    cur_learning_goal: str | None = None
    
    # 🚀 핵심 수정 포인트: AI가 만든 최신 JSON 배열을 깎아내지 않고 그대로 내보냅니다.
    cur_week_plan: list[dict]

class CurriculumResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cur_id: int
    cur_creator_id: int
    cur_title: str
    cur_target_job: str | None = None
    cur_target_industry: str | None = None
    cur_duration_weeks: int
    cur_learning_goal: str | None = None
    cur_learning_detail_goal: str | None = None
    cur_week_plan: dict | list[dict] | None = None
    cur_assigned_learner_ids: list[int] | None = None
    cur_status: CurriculumStatus | None = None
    cur_created_at: datetime | None = None
    cur_updated_at: datetime | None = None
    cur_deleted_at: datetime | None = None

class CurriculumStatsResponse(BaseModel):
    total_curricula: int
    active_learners: int
    total_submissions: int