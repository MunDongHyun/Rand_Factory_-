from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CurriculumCreate(BaseModel):
    cur_title: str
    cur_target_job: str
    cur_target_industry: str
    cur_duration_weeks: int
    cur_learning_goal: str
    cur_ai_prompt_input: str
    cur_week_plan: dict
    cur_assigned_learner_ids: list[int]
    cur_status: str = "draft"


class CurriculumUpdate(BaseModel):
    cur_title: str | None = None
    cur_target_job: str | None = None
    cur_target_industry: str | None = None
    cur_duration_weeks: int | None = None
    cur_learning_goal: str | None = None
    cur_ai_prompt_input: str | None = None
    cur_week_plan: dict | None = None
    cur_assigned_learner_ids: list[int] | None = None
    cur_status: str | None = None


class CurriculumResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cur_id: int
    cur_creator_id: int
    cur_title: str
    cur_target_job: str
    cur_target_industry: str
    cur_duration_weeks: int
    cur_learning_goal: str
    cur_ai_prompt_input: str
    cur_week_plan: dict
    cur_assigned_learner_ids: dict
    cur_status: str
    cur_created_at: datetime
    cur_updated_at: datetime
    cur_deleted_at: datetime | None = None
