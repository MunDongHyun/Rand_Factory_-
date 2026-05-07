from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class MatchCreate(BaseModel):
    mentor_id: int
    title: str
    description: str


class MatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    match_id: int
    mentee_id: int
    mentor_id: int
    title: Optional[str] = None
    description: Optional[str] = None
    status: str
    point_cost: int
    created_at: datetime
    completed_at: Optional[datetime] = None


class MatchStatusUpdate(BaseModel):
    status: Literal["accepted", "rejected", "cancelled"]


class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    review_id: int
    match_id: int
    reviewer_id: int
    rating: int
    comment: Optional[str] = None
    created_at: datetime
