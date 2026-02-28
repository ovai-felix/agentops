"""AgentOps FastAPI backend — REST endpoints + SSE crew streaming."""

import json
import os
import queue
import sys
import threading
from datetime import datetime, UTC
from typing import Any

# Allow imports from src/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from config import settings
from integrations.snowflake_client import SnowflakeClient
from integrations.rag_client import RAGClient
from integrations.mlmonitoring_client import MLMonitoringClient

from backend.event_bus import event_bus, CrewEvent
from backend.stdout_capture import StdoutCapture

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="AgentOps API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Shared state
# ---------------------------------------------------------------------------


class AppState:
    def __init__(self):
        self.crew_running = False
        self.crew_result: str | None = None
        self.crew_error: str | None = None
        self.alerts: list[dict] = []
        self.diagnosis: dict | None = None
        self.actions: list[dict] = []


state = AppState()

# ---------------------------------------------------------------------------
# Clients (lazy init)
# ---------------------------------------------------------------------------

_sf: SnowflakeClient | None = None
_rag: RAGClient | None = None
_ml: MLMonitoringClient | None = None


def get_sf() -> SnowflakeClient:
    global _sf
    if _sf is None:
        _sf = SnowflakeClient()
    return _sf


def get_rag() -> RAGClient:
    global _rag
    if _rag is None:
        _rag = RAGClient()
    return _rag


def get_ml() -> MLMonitoringClient:
    global _ml
    if _ml is None:
        _ml = MLMonitoringClient()
    return _ml


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize(obj: Any) -> Any:
    """Make dicts JSON-serializable (datetimes → strings)."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize(i) for i in obj]
    return obj


# =========================================================================
# HEALTH
# =========================================================================


@app.get("/api/health")
def health():
    result = {"snowflake": False, "rag": False, "mlmonitor": False}

    try:
        get_sf().query("SELECT 1")
        result["snowflake"] = True
    except Exception:
        pass

    try:
        get_rag().health()
        result["rag"] = True
    except Exception:
        pass

    try:
        get_ml().health()
        result["mlmonitor"] = True
    except Exception:
        pass

    return result


# =========================================================================
# METRICS
# =========================================================================


@app.get("/api/metrics/model")
def get_model_metrics():
    rows = get_sf().get_latest_model_metrics(hours=1)
    if not rows:
        return {"status": "unknown", "f1": None, "drift": None, "latency": None, "anomaly_rate": None, "count": 0}

    latest = rows[0]
    f1 = latest.get("f1_score", 0)
    drift = latest.get("drift_score", 0)
    latency = latest.get("latency_p99_ms", 0)
    anomaly = latest.get("anomaly_rate", 0)

    if f1 < 0.88 - settings.accuracy_drop_threshold or drift > settings.drift_threshold:
        status = "critical"
    elif f1 < 0.88 or drift > 0.2:
        status = "warning"
    else:
        status = "healthy"

    return _serialize({
        "status": status,
        "f1": f1,
        "drift": drift,
        "latency": latency,
        "anomaly_rate": anomaly,
        "count": len(rows),
        "rows": rows,
    })


@app.get("/api/metrics/data-quality")
def get_data_quality():
    rows = get_sf().get_data_quality(hours=1)
    if not rows:
        return {"status": "unknown", "null_rate": None, "records": 0}

    latest = rows[0]
    return _serialize({
        "status": latest.get("status", "unknown"),
        "null_rate": latest.get("null_rate", 0),
        "records": latest.get("records_processed", 0),
        "violations": latest.get("schema_violations", 0),
        "rows": rows,
    })


@app.get("/api/metrics/feature-drift")
def get_feature_drift():
    rows = get_sf().get_feature_drift(hours=2)
    return _serialize(rows)


@app.get("/api/metrics/trend/{metric}")
def get_metric_trend(metric: str, hours: int = 48):
    try:
        rows = get_sf().get_metric_trend("classifier_v2", metric, hours)
    except ValueError as e:
        raise HTTPException(400, str(e))
    # Normalize: frontend expects {ts, value}
    normalized = [{"ts": r["ts"], "value": r.get(metric)} for r in rows]
    return _serialize(normalized)


@app.get("/api/incidents")
def get_incidents(limit: int = 10):
    rows = get_sf().get_incidents(limit=limit)
    return _serialize(rows)


# =========================================================================
# ALERTS
# =========================================================================


@app.post("/api/alerts/check")
def check_alerts():
    rows = get_sf().get_latest_model_metrics(hours=1)
    if not rows:
        return {"alerts": [], "message": "No metrics available"}

    latest = rows[0]
    f1 = latest.get("f1_score", 0)
    drift = latest.get("drift_score", 0)

    new_alerts = []
    ts_str = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")

    if f1 < 0.88:
        new_alerts.append({
            "alert_id": f"alert_{ts_str}_accuracy",
            "severity": "critical" if f1 < 0.83 else "warning",
            "alert_type": "accuracy_drop",
            "affected_component": "classifier_v2",
            "metrics": {"f1_score": f1, "baseline_f1": 0.91},
            "timestamp": datetime.now(UTC).isoformat(),
            "message": f"Model F1 dropped to {f1:.4f} (baseline: 0.91)",
        })

    if drift > settings.drift_threshold:
        new_alerts.append({
            "alert_id": f"alert_{ts_str}_drift",
            "severity": "critical",
            "alert_type": "model_drift",
            "affected_component": "classifier_v2",
            "metrics": {"drift_score": drift, "threshold": settings.drift_threshold},
            "timestamp": datetime.now(UTC).isoformat(),
            "message": f"Drift score {drift:.4f} exceeds threshold {settings.drift_threshold}",
        })

    state.alerts = new_alerts + state.alerts
    return {"alerts": new_alerts, "total": len(state.alerts)}


@app.get("/api/alerts")
def get_alerts():
    return {"alerts": state.alerts}


# =========================================================================
# INVESTIGATION
# =========================================================================


class InvestigateRequest(BaseModel):
    query: str


class AutoInvestigateRequest(BaseModel):
    alert: dict


@app.post("/api/investigate")
def investigate(req: InvestigateRequest):
    answer = get_rag().search_runbooks(req.query)
    return {"answer": answer}


@app.post("/api/investigate/auto")
def auto_investigate(req: AutoInvestigateRequest):
    alert = req.alert
    alert_type = alert.get("alert_type", "unknown")

    # Build query from alert
    query = f"How to diagnose and fix {alert_type.replace('_', ' ')} in ML fraud detection model?"
    if alert.get("metrics"):
        metrics_str = ", ".join(f"{k}={v}" for k, v in alert["metrics"].items())
        query += f" Current metrics: {metrics_str}"

    runbook_answer = get_rag().search_runbooks(query)

    # Search incidents
    incident_query = f"Past incidents similar to {alert_type.replace('_', ' ')}"
    if "drift" in alert_type:
        try:
            fd_rows = get_sf().get_feature_drift(hours=2)
            top_features = [r["feature_name"] for r in fd_rows[:3]] if fd_rows else []
            if top_features:
                incident_query += f" involving features {', '.join(top_features)}"
        except Exception:
            pass

    incident_answer = get_rag().search_incidents(incident_query)

    diagnosis = {
        "status": "complete",
        "alert": alert,
        "root_cause_analysis": runbook_answer,
        "similar_incidents": incident_answer,
        "recommended_actions": [
            {"action": "Send Slack notification", "priority": 1, "requires_approval": False},
            {"action": "Create GitHub issue", "priority": 2, "requires_approval": False},
            {"action": "Trigger model retraining", "priority": 3, "requires_approval": True},
            {"action": "Rollback model (if retrain fails)", "priority": 4, "requires_approval": True},
        ],
    }
    state.diagnosis = diagnosis
    return diagnosis


# =========================================================================
# ACTIONS
# =========================================================================


class ActionIndexRequest(BaseModel):
    index: int


class SetActionsRequest(BaseModel):
    actions: list[dict]


@app.get("/api/actions")
def get_actions():
    return {"actions": state.actions}


@app.post("/api/actions/set")
def set_actions(req: SetActionsRequest):
    state.actions = [
        {**act, "status": "pending", "timestamp": datetime.now(UTC).isoformat()}
        for act in req.actions
    ]
    return {"actions": state.actions}


@app.post("/api/actions/execute")
def execute_action(req: ActionIndexRequest):
    if req.index < 0 or req.index >= len(state.actions):
        raise HTTPException(400, "Invalid action index")

    act = state.actions[req.index]
    if act.get("requires_approval"):
        raise HTTPException(400, "This action requires approval")

    act["status"] = "completed"
    act["details"] = f"Executed at {datetime.now(UTC).strftime('%H:%M:%S')}"
    return {"action": act}


@app.post("/api/actions/approve")
def approve_action(req: ActionIndexRequest):
    if req.index < 0 or req.index >= len(state.actions):
        raise HTTPException(400, "Invalid action index")

    act = state.actions[req.index]
    act["status"] = "completed"
    act["details"] = f"Approved at {datetime.now(UTC).strftime('%H:%M:%S')}"

    action_name = act.get("action", "").lower()
    try:
        if "retrain" in action_name:
            result = get_ml().trigger_retraining()
            act["details"] += f" | {result}"
        elif "rollback" in action_name:
            result = get_ml().rollback_model()
            act["details"] += f" | {result}"
    except Exception as e:
        act["details"] += f" | API error: {e}"

    return {"action": act}


@app.post("/api/actions/deny")
def deny_action(req: ActionIndexRequest):
    if req.index < 0 or req.index >= len(state.actions):
        raise HTTPException(400, "Invalid action index")

    act = state.actions[req.index]
    act["status"] = "denied"
    act["details"] = f"Denied at {datetime.now(UTC).strftime('%H:%M:%S')}"
    return {"action": act}


# =========================================================================
# CREW EXECUTION + SSE
# =========================================================================


@app.get("/api/crew/status")
def crew_status():
    return {
        "running": state.crew_running,
        "result": state.crew_result,
        "error": state.crew_error,
    }


@app.post("/api/crew/start")
def crew_start():
    if state.crew_running:
        raise HTTPException(409, "Crew is already running")

    state.crew_running = True
    state.crew_result = None
    state.crew_error = None
    event_bus.clear_history()

    def run_crew():
        capture = StdoutCapture(sys.__stdout__)
        sys.stdout = capture
        try:
            event_bus.publish(CrewEvent(event_type="crew_start", data="Starting AgentOps crew..."))

            from crew.crew import AgentOpsCrew

            crew = AgentOpsCrew()
            result = crew.run(context="Check for model drift — elevated drift on V14 and V17.")
            state.crew_result = result
            event_bus.publish(CrewEvent(event_type="complete", data=result))
        except Exception as e:
            state.crew_error = str(e)
            event_bus.publish(CrewEvent(event_type="error", data=str(e)))
        finally:
            sys.stdout = sys.__stdout__
            state.crew_running = False

    t = threading.Thread(target=run_crew, daemon=True)
    t.start()
    return {"status": "started"}


@app.get("/api/crew/stream")
async def crew_stream():
    q = event_bus.subscribe()

    async def generate():
        try:
            while True:
                try:
                    event = q.get(timeout=1.0)
                    yield {
                        "event": event.event_type,
                        "data": json.dumps({
                            "type": event.event_type,
                            "data": event.data,
                            "timestamp": event.timestamp,
                            "agent": event.agent,
                        }),
                    }
                    if event.event_type in ("complete", "error"):
                        break
                except queue.Empty:
                    yield {"event": "ping", "data": ""}
        finally:
            event_bus.unsubscribe(q)

    return EventSourceResponse(generate())
