"""Human approval gate models."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    TIMED_OUT = "timed_out"


class ApprovalRequest(BaseModel):
    request_id: str
    action: str
    description: str
    context: dict = {}
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    timeout_sec: int = 300


class ApprovalResponse(BaseModel):
    request_id: str
    status: ApprovalStatus
    responded_at: datetime | None = None
    responded_by: str = ""
