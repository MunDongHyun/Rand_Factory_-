from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


CurriculumStatus = Literal["draft", "active", "archived"]


class CurriculumCreate(BaseModel):
    cur_title: str
    cur_target_job: str | None = None
    cur_target_industry: str | None = None
    cur_duration_weeks: int
    cur_learning_goal: str | None = None
    cur_ai_prompt_input: str | None = None
    cur_week_plan: dict | None = None
    cur_assigned_learner_ids: list[int] | None = None
    cur_status: CurriculumStatus | None = "draft"


class CurriculumUpdate(BaseModel):
    cur_title: str | None = None
    cur_target_job: str | None = None
    cur_target_industry: str | None = None
    cur_duration_weeks: int | None = None
    cur_learning_goal: str | None = None
    cur_ai_prompt_input: str | None = None
    cur_week_plan: dict | None = None
    cur_assigned_learner_ids: list[int] | None = None
    cur_status: CurriculumStatus | None = None


class CurriculumResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cur_id: int
    cur_creator_id: int
    cur_title: str
    cur_target_job: str | None = None
    cur_target_industry: str | None = None
    cur_duration_weeks: int
    cur_learning_goal: str | None = None
    cur_ai_prompt_input: str | None = None
    cur_week_plan: dict | None = None
    cur_assigned_learner_ids: list[int] | None = None
    cur_status: CurriculumStatus | None = None
    cur_created_at: datetime | None = None
    cur_updated_at: datetime | None = None
    cur_deleted_at: datetime | None = None
