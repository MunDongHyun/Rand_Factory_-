from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class PointResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    point_id: int
    amount: int
    balance: int
    transaction_type: str
    description: Optional[str] = None
    created_at: datetime


class PointChargeRequest(BaseModel):
    amount: int = Field(..., ge=100, le=1_000_000, description="충전할 포인트 (100P 이상)")


class PointBalanceResponse(BaseModel):
    user_id: int
    balance: int
