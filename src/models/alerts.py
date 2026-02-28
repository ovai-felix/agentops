"""Alert, Diagnosis, and Resolution schemas."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Severity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class AlertType(str, Enum):
    MODEL_DRIFT = "model_drift"
    DATA_QUALITY = "data_quality"
    LATENCY = "latency"
    ACCURACY_DROP = "accuracy_drop"
    ANOMALY_SPIKE = "anomaly_spike"


class Alert(BaseModel):
    alert_id: str
    severity: Severity
    alert_type: AlertType
    affected_component: str
    metrics: dict
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    message: str = ""


class RecommendedAction(BaseModel):
    action: str
    priority: int
    requires_approval: bool
    condition: str = ""


class Diagnosis(BaseModel):
    alert_id: str
    root_cause: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[str]
    recommended_actions: list[RecommendedAction]
    runbook_reference: str = ""
    similar_incidents: list[str] = []


class ActionResult(BaseModel):
    action: str
    status: str
    details: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class Resolution(BaseModel):
    alert_id: str
    actions_taken: list[ActionResult]
    resolution_status: str
    time_to_detect_sec: float = 0
    time_to_diagnose_sec: float = 0
    time_to_act_sec: float = 0
