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


class CurriculumGenerateRequest(BaseModel):
    cur_title: str
    cur_duration_weeks: int
    cur_target_job: str | None = None
    cur_target_industry: str | None = None
    cur_learning_goal: str | None = None
    required_content: str | None = None


class RecommendedArticle(BaseModel):
    filename: str | None = None
    title: str | None = None
    why_relevant: str | None = None


class WeekPlanItem(BaseModel):
    week: int | None = None
    theme: str | None = None
    learning_objective: str | None = None
    tasks: list[str] = []
    recommended_articles: list[RecommendedArticle] = []
    success_criteria: list[str] = []
    estimated_hours: int | None = None


class CurriculumGenerateResponse(BaseModel):
    cur_title: str
    cur_duration_weeks: int
    cur_target_job: str | None = None
    cur_target_industry: str | None = None
    cur_learning_goal: str | None = None
    cur_week_plan: list[WeekPlanItem]


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
