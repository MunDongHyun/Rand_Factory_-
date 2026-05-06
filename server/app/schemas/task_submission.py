from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


TaskStatus = Literal["submitted", "feedback_given", "resubmit_requested"]


class TaskSubmissionCreate(BaseModel):
    task_curriculum_id: int
    task_week_number: int
    task_framework_type: str | None = None
    task_submitted_content: dict


class TaskSubmissionFeedbackUpdate(BaseModel):
    task_manager_feedback: str
    task_status: TaskStatus = "feedback_given"


class TaskSubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_submission_id: int
    task_curriculum_id: int
    task_learner_id: int
    task_week_number: int
    task_framework_type: str | None = None
    task_submitted_content: dict
    task_submitted_at: datetime | None = None
    task_manager_feedback: str | None = None
    task_feedback_at: datetime | None = None
    task_status: TaskStatus | None = None
