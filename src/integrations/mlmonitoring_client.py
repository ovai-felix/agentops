"""HTTP client for the ML Monitoring API."""
import httpx
from config import settings


class MLMonitoringClient:
    def __init__(self):
        self._client = httpx.Client(base_url=settings.mlmonitoring_url, timeout=120.0)

    def health(self) -> dict:
        return self._client.get("/health").json()

    def ready(self) -> dict:
        return self._client.get("/ready").json()

    def model_info(self) -> dict:
        return self._client.get("/model/info").json()

    def trigger_retraining(self, model_type: str = "classifier") -> dict:
        resp = self._client.post("/training/trigger", json={"model_type": model_type})
        resp.raise_for_status()
        return resp.json()

    def training_status(self, model_type: str | None = None) -> list[dict]:
        params = {}
        if model_type:
            params["model_type"] = model_type
        return self._client.get("/training/status", params=params).json()

    def rollback_model(self) -> dict:
        resp = self._client.post("/model/rollback")
        resp.raise_for_status()
        return resp.json()

    def reload_model(self) -> dict:
        resp = self._client.post("/model/reload")
        resp.raise_for_status()
        return resp.json()

    def predict(self, features: dict) -> dict:
        resp = self._client.post("/predict", json=features)
        resp.raise_for_status()
        return resp.json()

    def metrics(self) -> str:
        """Get Prometheus metrics as text."""
        return self._client.get("/metrics").text
