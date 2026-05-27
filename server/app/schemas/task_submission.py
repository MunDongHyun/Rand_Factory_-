from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


TaskStatus = Literal["submitted", "feedback_given", "resubmit_requested"]
TaskSubmissionType = Literal["text", "file", "mixed"]


class TaskSubmissionCreate(BaseModel):
    task_curriculum_id: int
    task_week_number: int
    task_submitted_content: dict | None = None
    task_submission_type: TaskSubmissionType = "text"
    task_deadline: datetime | None = None


class TaskSubmissionFeedbackUpdate(BaseModel):
    task_manager_feedback: str
    task_status: TaskStatus = "feedback_given"


class TaskSubmissionAttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_attachment_id: int
    task_submission_id: int
    file_original_name: str
    file_storage_key: str
    file_mime_type: str
    file_size_bytes: int
    file_sha256: str | None = None
    file_uploaded_at: datetime | None = None
    file_deleted_at: datetime | None = None


class TaskSubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_submission_id: int
    task_curriculum_id: int
    task_learner_id: int
    task_week_number: int
    task_submission_type: TaskSubmissionType = "text"
    task_submitted_content: dict | None = None
    task_submitted_at: datetime | None = None
    task_manager_feedback: str | None = None
    task_resubmit_requested: str = "N"
    task_feedback_at: datetime | None = None
    task_status: TaskStatus | None = None
    attachments: list[TaskSubmissionAttachmentResponse] = Field(default_factory=list)


class TaskSubmissionWithLearnerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    task_submission_id: int
    task_curriculum_id: int
    task_learner_id: int
    learner_name: str | None = None
    learner_email: str | None = None
    task_week_number: int
    task_submission_type: TaskSubmissionType = "text"
    task_submitted_content: dict | None = None
    task_submitted_at: datetime | None = None
    task_manager_feedback: str | None = None
    task_resubmit_requested: str = "N"
    task_feedback_at: datetime | None = None
    task_status: TaskStatus | None = None
    attachments: list[TaskSubmissionAttachmentResponse] = Field(default_factory=list)
