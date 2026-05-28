from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CertificateIssueRequest(BaseModel):
    cert_curriculum_id: int
    cert_learner_id: int
    cert_title: str | None = None
    overwrite: bool = False


class CertificateEligibilityResponse(BaseModel):
    eligible: bool
    curriculum_id: int
    learner_id: int
    expected_weeks: list[int]
    completed_weeks: list[int]
    missing_weeks: list[int]
    pending_feedback_weeks: list[int]
    resubmit_requested_weeks: list[int]
    reason: str | None = None


class CertificateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cert_id: int
    cert_no: str
    cert_curriculum_id: int
    cert_learner_id: int
    cert_issuer_id: int
    cert_title: str
    cert_curriculum_title: str
    cert_learner_name: str
    cert_issuer_name: str
    cert_storage_key: str
    cert_issued_at: datetime | None = None
    cert_completed_at: datetime | None = None
    cert_deleted_at: datetime | None = None
    learner_name: str | None = None
    learner_email: str | None = None
    curriculum_title: str | None = None
    issuer_name: str | None = None
