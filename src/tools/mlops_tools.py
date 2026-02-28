"""CrewAI tools for ML model lifecycle operations."""
from crewai.tools import tool
from integrations.mlmonitoring_client import MLMonitoringClient

_ml = MLMonitoringClient()


@tool("Check Model Health")
def check_model_health() -> str:
    """Check the health and readiness of the ML model serving system.

    Returns the service health status, model readiness, and current
    model version information including blue-green deployment state.
    """
    try:
        health = _ml.health()
    except Exception as e:
        return f"ML monitoring service unreachable: {e}"

    try:
        ready = _ml.ready()
    except Exception:
        ready = {"detail": "readiness check failed"}

    try:
        info = _ml.model_info()
    except Exception:
        info = {"error": "could not retrieve model info"}

    lines = [
        f"Service Health: {health.get('status', 'unknown')}",
        f"Ready: {ready}",
        f"Model Info: {info}",
    ]
    return "\n".join(lines)


@tool("Trigger Retraining")
def trigger_retraining(model_type: str = "classifier") -> str:
    """Trigger model retraining on the ML monitoring service.

    This starts a retraining job for the specified model type.
    After triggering, use 'Check Training Status' to monitor progress.
    This is a high-impact action — verify the need for retraining first.
    """
    try:
        result = _ml.trigger_retraining(model_type)
        return f"Retraining triggered for {model_type}: {result}"
    except Exception as e:
        return f"Failed to trigger retraining: {e}"


@tool("Check Training Status")
def check_training_status(model_type: str = "classifier") -> str:
    """Check the status of a model retraining job.

    Returns training status (running/completed/failed), metrics of the
    new model if training is complete, and comparison against production.
    """
    try:
        status = _ml.training_status(model_type)
        if not status:
            return f"No training runs found for {model_type}."
        lines = [f"Training status for {model_type}:"]
        for run in status[:3]:
            lines.append(f"  {run}")
        return "\n".join(lines)
    except Exception as e:
        return f"Failed to check training status: {e}"


@tool("Rollback Model")
def rollback_model() -> str:
    """Rollback the production model to the previous version.

    Uses the blue-green deployment mechanism to swap back to the standby
    model slot. This is a high-impact action — verify it is necessary first.
    After rollback, check model health to confirm recovery.
    """
    try:
        result = _ml.rollback_model()
        return f"Rollback result: {result}"
    except Exception as e:
        return f"Rollback failed: {e}"
