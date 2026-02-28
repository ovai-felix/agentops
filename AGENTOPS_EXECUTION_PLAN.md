# AgentOps — Multi-Session Execution Plan

> Each session below is self-contained. A new Claude Code instance can execute any
> session by reading THIS file + the referenced files. Sessions have explicit
> prerequisites, inputs, outputs, and verification steps.

---

## Quick Reference

| Session | Name | Est. Time | Dependencies | Can Parallelize With |
|---------|------|-----------|--------------|----------------------|
| S1 | Project Scaffold + Config | 20 min | None | S2 |
| S2 | Runbooks + Incident Corpus | 30 min | None | S1 |
| S3 | Snowflake Schema + Seed Data | 40 min | S1 | S2, S4 |
| S4 | Pydantic Models + Schemas | 20 min | S1 | S2, S3 |
| S5 | Integration Clients | 40 min | S1, S4 | S6 |
| S6 | RAG Ingestion of Runbooks | 20 min | S2 | S5 |
| S7 | CrewAI Tools | 50 min | S4, S5 | — |
| S8 | CrewAI Agents + Crew | 40 min | S7 | — |
| S9 | Orchestrator + Demo Mode | 40 min | S8 | S10 |
| S10 | Streamlit Dashboard | 50 min | S4, S5 | S9 |
| S11 | End-to-End Integration + Polish | 40 min | S9, S10 | — |
| S12 | Demo Script + Video Prep | 30 min | S11 | — |

**Parallelization Strategy (3 Claude Code instances):**
```
Instance A: S1 → S3 → S5 → S7 → S8 → S9 → S11
Instance B: S2 → S6 → S10
Instance C: S4 (after S1) → helps with S7 or S10
```

---

## Global Context

**Project root:** `/Users/omatsone/Desktop/projectAI/agentops/`

**Sibling projects (read-only, used as services):**
- `/Users/omatsone/Desktop/projectAI/agenticworkflow/` — LangGraph agent (reuse patterns only)
- `/Users/omatsone/Desktop/projectAI/mlmonitoring/` — FastAPI ML serving (call via HTTP)
- `/Users/omatsone/Desktop/projectAI/ragsystem/` — RAG system (call via HTTP)

**mlmonitoring API (expected at http://localhost:8000):**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness check |
| GET | `/ready` | Readiness (models loaded) |
| GET | `/model/info` | Active model version/metadata |
| POST | `/model/reload` | Blue-green swap |
| POST | `/model/rollback` | Revert to previous model |
| POST | `/predict` | Single prediction |
| POST | `/predict/batch` | Batch prediction |
| POST | `/training/trigger` | Start retraining (body: `{model_type, data_version}`) |
| GET | `/training/status` | Recent training runs |
| GET | `/metrics` | Prometheus metrics (text/plain) |

**ragsystem API (expected at http://localhost:8001):**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/register` | Create user (body: `{username, password}`) |
| POST | `/auth/token` | Get JWT (body: `{username, password}`) |
| POST | `/query` | RAG query (body: `{query, top_k, filters}`, header: `Authorization: Bearer <token>`) |
| POST | `/ingest` | Upload doc (multipart file, header: `Authorization: Bearer <token>`) |
| GET | `/sources` | List sources (header: `Authorization: Bearer <token>`) |
| GET | `/health` | Health check |

**LLM:** Claude Sonnet 4 or GPT-4o (via CrewAI LLM config). NOT Llama for reliability.

**Partner tools:**
- Snowflake: `snowflake-connector-python` — data warehouse for metrics
- CrewAI: `crewai` + `crewai-tools` — multi-agent orchestration
- Composio: `composio-crewai` — Slack + GitHub integrations

---

## SESSION S1: Project Scaffold + Config

**Goal:** Create the agentops project structure, pyproject.toml, config, and all `__init__.py` files.

**Prerequisites:** None

**Instructions:**

1. Create directory structure:
```
/Users/omatsone/Desktop/projectAI/agentops/
├── src/
│   ├── __init__.py
│   ├── config.py
│   ├── orchestrator.py          # placeholder
│   ├── crew/
│   │   ├── __init__.py
│   │   ├── agents.py            # placeholder
│   │   ├── tasks.py             # placeholder
│   │   └── crew.py              # placeholder
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── snowflake_tools.py   # placeholder
│   │   ├── rag_tools.py         # placeholder
│   │   ├── mlops_tools.py       # placeholder
│   │   └── composio_tools.py    # placeholder
│   ├── integrations/
│   │   ├── __init__.py
│   │   ├── snowflake_client.py  # placeholder
│   │   ├── rag_client.py        # placeholder
│   │   ├── mlmonitoring_client.py  # placeholder
│   │   └── composio_client.py   # placeholder
│   └── models/
│       ├── __init__.py
│       ├── alerts.py            # placeholder
│       └── approval.py          # placeholder
├── runbooks/                    # populated in S2
├── incidents/                   # populated in S2
├── seed/                        # populated in S3
├── dashboard/
│   └── streamlit_app.py         # placeholder
├── tests/
│   └── __init__.py
├── pyproject.toml
├── .env.example
└── .gitignore
```

2. Create `pyproject.toml`:
```toml
[build-system]
requires = ["setuptools>=68.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "agentops"
version = "0.1.0"
description = "AgentOps: Autonomous MLOps & DataOps Platform"
requires-python = ">=3.11"
dependencies = [
    "crewai>=0.80.0",
    "crewai-tools>=0.14.0",
    "composio-crewai>=0.6.0",
    "snowflake-connector-python>=3.6.0",
    "httpx>=0.27.0",
    "pydantic>=2.6.0",
    "pydantic-settings>=2.1.0",
    "streamlit>=1.30.0",
    "python-dotenv>=1.0.0",
    "structlog>=24.1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
]

[tool.setuptools.packages.find]
where = ["src"]
```

3. Create `src/config.py` using Pydantic Settings:
```python
"""AgentOps configuration — all settings from environment variables."""
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Snowflake
    snowflake_account: str = ""
    snowflake_user: str = ""
    snowflake_password: str = ""
    snowflake_database: str = "AGENTOPS"
    snowflake_schema: str = "PUBLIC"
    snowflake_warehouse: str = "COMPUTE_WH"

    # Sibling services
    mlmonitoring_url: str = "http://localhost:8000"
    ragsystem_url: str = "http://localhost:8001"
    rag_username: str = "agentops"
    rag_password: str = "agentops123"

    # LLM
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    llm_provider: str = "openai"  # "openai" or "anthropic"

    # Composio
    composio_api_key: str = ""
    slack_channel: str = "#ml-alerts"
    github_repo: str = ""

    # Agent behavior
    monitor_poll_interval_sec: int = 30
    drift_threshold: float = 0.3
    accuracy_drop_threshold: float = 0.05
    approval_timeout_sec: int = 300

    # Demo mode
    demo_mode: bool = False

    model_config = {"env_file": ".env", "extra": "ignore"}

settings = Settings()
```

4. Create `.env.example` listing every variable with empty/default values.

5. Create `.gitignore`:
```
.env
__pycache__/
*.pyc
.venv/
*.egg-info/
dist/
build/
```

**Verification:**
- `cd /Users/omatsone/Desktop/projectAI/agentops && python -c "from config import settings; print(settings.model_dump())"`
- All directories exist with `__init__.py`

**Output artifacts:**
- Complete project scaffold at `/Users/omatsone/Desktop/projectAI/agentops/`
- Working `config.py` importable as `from config import settings`

---

## SESSION S2: Runbooks + Incident Corpus

**Goal:** Write realistic runbook documents and historical incident reports that the RAG system will ingest.

**Prerequisites:** None (files are standalone markdown/text)

**Instructions:**

1. Create 6 runbook files in `/Users/omatsone/Desktop/projectAI/agentops/runbooks/`:

**`model_drift.md`** — Must cover:
- What is model drift (concept + data drift)
- Thresholds: PSI > 0.2 = warning, PSI > 0.3 = critical
- Per-feature investigation steps (check V1-V28, Time, Amount)
- Common causes: upstream schema change, seasonal patterns, data source outage, vendor API change
- Remediation decision tree:
  - If drift < 0.3 → monitor for 24h
  - If drift >= 0.3 AND accuracy stable → retrain with new data
  - If drift >= 0.3 AND accuracy dropping → immediate rollback + retrain
- Escalation: notify data engineering team via Slack #data-alerts
- Reference: link to retraining runbook

**`data_quality.md`** — Must cover:
- Validation checks: null rates, out-of-range values, schema mismatches
- Thresholds: null rate > 5% = warning, > 10% = critical
- Common causes: upstream ETL failures, source system migrations, timezone issues
- Remediation: quarantine bad batch, alert data team, rerun pipeline
- Includes example SQL queries for Snowflake investigation

**`latency_spike.md`** — Must cover:
- Normal latency baselines: p50 < 100ms, p95 < 500ms, p99 < 1s
- Investigation steps: check model size, batch queue depth, CPU/memory usage
- Common causes: model too complex, feature pipeline slow, resource contention
- Remediation: scale resources, optimize model, enable batching

**`retraining.md`** — Must cover:
- When to retrain: accuracy drop > 5%, drift score > 0.3, scheduled (weekly)
- Prerequisites: minimum 10k new labeled samples, data quality check passed
- Training config: model_type=classifier, Optuna trials=5, epochs=30
- Evaluation gate: new F1 >= production F1 - 0.01
- Post-training: promote to staging, run smoke tests, deploy via blue-green

**`rollback.md`** — Must cover:
- When to rollback: accuracy drops post-deploy, latency spikes, error rate > 5%
- Rollback procedure: POST /model/rollback → verify health → monitor 30 min
- Blue-green mechanism: previous model kept in standby slot
- Post-rollback: create incident report, schedule investigation

**`incident_response.md`** — Must cover:
- Severity levels: P1 (critical), P2 (warning), P3 (info)
- Response times: P1 < 15 min, P2 < 1 hour, P3 < 24 hours
- Incident lifecycle: detect → triage → investigate → remediate → post-mortem
- Communication: Slack for real-time, GitHub issue for tracking, email for stakeholders
- Post-mortem template: what happened, root cause, timeline, lessons learned

2. Create 8-10 incident reports in `/Users/omatsone/Desktop/projectAI/agentops/incidents/`:

Each file named `inc_YYYY_MMDD_<slug>.md` with this structure:
```markdown
# Incident Report: INC-YYYY-MMDD

## Summary
One-sentence summary.

## Severity
P1/P2/P3

## Timeline
- HH:MM — Event
- HH:MM — Event

## Root Cause
Detailed explanation.

## Resolution
What was done to fix it.

## Lessons Learned
What we changed to prevent recurrence.

## Affected Components
List of systems/models affected.
```

Create these specific incidents (realistic for fraud detection ML system):
- `inc_2026_0115_v14_drift.md` — Feature V14 distribution shift caused by vendor API format change. Resolved by retraining.
- `inc_2026_0120_null_spike.md` — 15% null rate in Amount field due to upstream ETL timezone bug. Resolved by fixing ETL.
- `inc_2026_0203_latency.md` — p99 latency hit 3s after deploying larger model. Resolved by rollback + model pruning.
- `inc_2026_0210_accuracy_drop.md` — F1 dropped from 0.91 to 0.78 after data pipeline outage corrupted training data. Resolved by retraining on clean data.
- `inc_2026_0215_false_positive.md` — False positive rate spiked 300% due to seasonal shopping pattern (Valentine's Day). Resolved by adding temporal features.
- `inc_2026_0218_schema_change.md` — Upstream system added new field, broke feature pipeline. Resolved by updating schema config.
- `inc_2026_0222_anomaly_spike.md` — Isolation Forest flagged 25% of transactions as anomalous. Caused by legitimate promotional event. Resolved by adjusting contamination threshold.
- `inc_2026_0225_retraining_fail.md` — Automated retraining produced worse model (F1 0.65). Evaluation gate blocked promotion. Root cause: training data imbalance. Resolved by adjusting class weights.

**Verification:**
- `ls /Users/omatsone/Desktop/projectAI/agentops/runbooks/` shows 6 files
- `ls /Users/omatsone/Desktop/projectAI/agentops/incidents/` shows 8 files
- Each file is > 500 characters with realistic, detailed content

**Output artifacts:**
- 6 runbook markdown files
- 8 incident report markdown files

---

## SESSION S3: Snowflake Schema + Seed Data

**Goal:** Create Snowflake tables and populate with realistic seed data including a demo drift scenario.

**Prerequisites:** S1 (need config.py for Snowflake credentials)

**Env vars required:** `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD`

**Instructions:**

1. Create `/Users/omatsone/Desktop/projectAI/agentops/seed/setup_snowflake.py`:

This script should:
- Connect to Snowflake using credentials from `config.py`
- Create database `AGENTOPS` if not exists
- Create schema `PUBLIC` if not exists
- Create 4 tables:

```sql
-- Table 1: Model performance metrics (one row per measurement)
CREATE TABLE IF NOT EXISTS MODEL_METRICS (
    id INTEGER AUTOINCREMENT,
    timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    model_name VARCHAR(100),        -- 'classifier_v2', 'lstm_v1', 'anomaly_v1'
    model_version VARCHAR(50),
    f1_score FLOAT,
    precision_score FLOAT,
    recall_score FLOAT,
    auc_roc FLOAT,
    drift_score FLOAT,              -- aggregate PSI
    latency_p50_ms FLOAT,
    latency_p95_ms FLOAT,
    latency_p99_ms FLOAT,
    prediction_count INTEGER,
    anomaly_rate FLOAT,
    PRIMARY KEY (id)
);

-- Table 2: Data quality checks (one row per pipeline run)
CREATE TABLE IF NOT EXISTS DATA_QUALITY (
    id INTEGER AUTOINCREMENT,
    timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    pipeline_name VARCHAR(100),     -- 'transactions_ingest', 'feature_pipeline'
    records_processed INTEGER,
    records_valid INTEGER,
    records_invalid INTEGER,
    null_rate FLOAT,
    schema_violations INTEGER,
    out_of_range_count INTEGER,
    status VARCHAR(20),             -- 'healthy', 'warning', 'critical'
    PRIMARY KEY (id)
);

-- Table 3: Per-feature drift scores (one row per feature per measurement)
CREATE TABLE IF NOT EXISTS FEATURE_DRIFT (
    id INTEGER AUTOINCREMENT,
    timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    model_name VARCHAR(100),
    feature_name VARCHAR(50),       -- 'V1', 'V2', ..., 'V28', 'Time', 'Amount'
    psi_score FLOAT,
    ks_statistic FLOAT,
    mean_shift FLOAT,
    std_shift FLOAT,
    PRIMARY KEY (id)
);

-- Table 4: Incident log
CREATE TABLE IF NOT EXISTS INCIDENTS (
    id INTEGER AUTOINCREMENT,
    incident_id VARCHAR(50),
    timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    alert_type VARCHAR(50),
    severity VARCHAR(20),
    affected_component VARCHAR(100),
    root_cause TEXT,
    resolution TEXT,
    duration_minutes INTEGER,
    status VARCHAR(20),             -- 'open', 'investigating', 'resolved'
    PRIMARY KEY (id)
);
```

2. Create seed data generator in the same script:

**Healthy baseline data (last 7 days, hourly):**
- `MODEL_METRICS`: classifier_v2 with F1 ~0.91, drift ~0.1, latency_p99 ~200ms
- `DATA_QUALITY`: transactions_ingest with null_rate ~0.01, status='healthy'
- `FEATURE_DRIFT`: all 30 features with PSI < 0.1

**Drift event (last 2 hours):**
- `MODEL_METRICS`: classifier_v2 with F1 dropping to ~0.82, drift_score climbing to 0.45
- `FEATURE_DRIFT`: V14 PSI=0.8, V17 PSI=0.6, others stay normal
- `DATA_QUALITY`: still healthy (drift is distribution shift, not quality issue)

This creates the demo scenario: model metrics look bad, feature drift pinpoints V14/V17, but data quality is fine — so the root cause is distribution shift, not bad data.

3. Create a `seed/reset_demo.py` script that:
- Deletes all data from the last 2 hours
- Re-inserts the drift event data
- This lets us "reset" the demo to a known state quickly

**Verification:**
- Run `python seed/setup_snowflake.py` — tables created, data loaded
- Run `python -c` with a test query: `SELECT COUNT(*) FROM MODEL_METRICS` returns > 100 rows
- Run `python -c` with: `SELECT drift_score FROM MODEL_METRICS ORDER BY timestamp DESC LIMIT 1` returns ~0.45

**Output artifacts:**
- `seed/setup_snowflake.py` — idempotent setup + seed script
- `seed/reset_demo.py` — demo reset script
- 4 Snowflake tables populated with realistic data

---

## SESSION S4: Pydantic Models + Schemas

**Goal:** Define all shared data models used across tools, agents, and the dashboard.

**Prerequisites:** S1 (project scaffold exists)

**Instructions:**

1. Create `/Users/omatsone/Desktop/projectAI/agentops/src/models/alerts.py`:

```python
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
    metrics: dict  # flexible dict for alert-type-specific metrics
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    message: str = ""

class RecommendedAction(BaseModel):
    action: str           # "retrain_model", "rollback_model", "notify_team", etc.
    priority: int
    requires_approval: bool
    condition: str = ""   # e.g., "if retrain fails"

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
    status: str           # "completed", "failed", "awaiting_approval", "skipped"
    details: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Resolution(BaseModel):
    alert_id: str
    actions_taken: list[ActionResult]
    resolution_status: str  # "resolved", "in_progress", "escalated"
    time_to_detect_sec: float = 0
    time_to_diagnose_sec: float = 0
    time_to_act_sec: float = 0
```

2. Create `/Users/omatsone/Desktop/projectAI/agentops/src/models/approval.py`:

```python
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
```

3. Update `/Users/omatsone/Desktop/projectAI/agentops/src/models/__init__.py`:
```python
from .alerts import Alert, AlertType, Severity, Diagnosis, RecommendedAction, ActionResult, Resolution
from .approval import ApprovalRequest, ApprovalResponse, ApprovalStatus
```

**Verification:**
```bash
cd /Users/omatsone/Desktop/projectAI/agentops
python -c "
from models.alerts import Alert, Severity, AlertType
a = Alert(alert_id='test', severity=Severity.CRITICAL, alert_type=AlertType.MODEL_DRIFT, affected_component='classifier_v2', metrics={'drift_score': 0.45})
print(a.model_dump_json(indent=2))
"
```

**Output artifacts:**
- `src/models/alerts.py` — Alert, Diagnosis, Resolution models
- `src/models/approval.py` — ApprovalRequest, ApprovalResponse models

---

## SESSION S5: Integration Clients

**Goal:** Build HTTP/SDK clients for Snowflake, RAG system, and ML monitoring. These are used by CrewAI tools in S7.

**Prerequisites:** S1, S4 (config + models)

**Instructions:**

1. Create `/Users/omatsone/Desktop/projectAI/agentops/src/integrations/snowflake_client.py`:

```python
"""Snowflake client for querying model metrics and data quality."""
import snowflake.connector
from config import settings

class SnowflakeClient:
    def __init__(self):
        self._conn = None

    def _get_conn(self):
        if self._conn is None or self._conn.is_closed():
            self._conn = snowflake.connector.connect(
                account=settings.snowflake_account,
                user=settings.snowflake_user,
                password=settings.snowflake_password,
                database=settings.snowflake_database,
                schema=settings.snowflake_schema,
                warehouse=settings.snowflake_warehouse,
            )
        return self._conn

    def query(self, sql: str, params: dict | None = None) -> list[dict]:
        """Run SQL and return rows as list of dicts."""
        conn = self._get_conn()
        cur = conn.cursor()
        try:
            cur.execute(sql, params or {})
            cols = [d[0].lower() for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
        finally:
            cur.close()

    def get_latest_model_metrics(self, model_name: str = "classifier_v2", hours: int = 1) -> list[dict]:
        """Get model metrics from the last N hours."""
        return self.query(
            "SELECT * FROM MODEL_METRICS WHERE model_name = %(model)s "
            "AND timestamp > DATEADD(hour, -%(hours)s, CURRENT_TIMESTAMP()) "
            "ORDER BY timestamp DESC",
            {"model": model_name, "hours": hours}
        )

    def get_feature_drift(self, model_name: str = "classifier_v2", hours: int = 1) -> list[dict]:
        """Get per-feature drift scores from the last N hours."""
        return self.query(
            "SELECT * FROM FEATURE_DRIFT WHERE model_name = %(model)s "
            "AND timestamp > DATEADD(hour, -%(hours)s, CURRENT_TIMESTAMP()) "
            "ORDER BY psi_score DESC",
            {"model": model_name, "hours": hours}
        )

    def get_data_quality(self, pipeline: str = "transactions_ingest", hours: int = 1) -> list[dict]:
        """Get data quality metrics from the last N hours."""
        return self.query(
            "SELECT * FROM DATA_QUALITY WHERE pipeline_name = %(pipeline)s "
            "AND timestamp > DATEADD(hour, -%(hours)s, CURRENT_TIMESTAMP()) "
            "ORDER BY timestamp DESC",
            {"pipeline": pipeline, "hours": hours}
        )

    def get_metric_trend(self, model_name: str, metric: str, hours: int = 24) -> list[dict]:
        """Get a metric's trend over time for investigation."""
        return self.query(
            f"SELECT timestamp, {metric} FROM MODEL_METRICS "
            "WHERE model_name = %(model)s "
            "AND timestamp > DATEADD(hour, -%(hours)s, CURRENT_TIMESTAMP()) "
            "ORDER BY timestamp ASC",
            {"model": model_name, "hours": hours}
        )

    def get_incidents(self, status: str | None = None, limit: int = 10) -> list[dict]:
        """Get recent incidents."""
        sql = "SELECT * FROM INCIDENTS"
        params = {}
        if status:
            sql += " WHERE status = %(status)s"
            params["status"] = status
        sql += " ORDER BY timestamp DESC LIMIT %(limit)s"
        params["limit"] = limit
        return self.query(sql, params)

    def close(self):
        if self._conn and not self._conn.is_closed():
            self._conn.close()
```

Note: The `query` method above uses Snowflake's `%(name)s` parameterized syntax. For the `get_metric_trend` method, the `metric` column name is interpolated directly — validate it against a whitelist in production, but for the hackathon this is acceptable.

2. Create `/Users/omatsone/Desktop/projectAI/agentops/src/integrations/rag_client.py`:

```python
"""HTTP client for the RAG system API."""
import httpx
from config import settings

class RAGClient:
    def __init__(self):
        self._token: str | None = None
        self._client = httpx.Client(base_url=settings.ragsystem_url, timeout=120.0)

    def _ensure_auth(self):
        if self._token:
            return
        # Register user (ignore if already exists)
        self._client.post("/auth/register", json={
            "username": settings.rag_username,
            "password": settings.rag_password,
        })
        # Get token
        resp = self._client.post("/auth/token", json={
            "username": settings.rag_username,
            "password": settings.rag_password,
        })
        resp.raise_for_status()
        self._token = resp.json()["access_token"]

    def _headers(self) -> dict:
        self._ensure_auth()
        return {"Authorization": f"Bearer {self._token}"}

    def query(self, question: str, top_k: int = 5, filters: dict | None = None) -> dict:
        """Send a RAG query. Returns {answer, citations, retrieved_chunks, timings}."""
        body = {"query": question, "top_k": top_k}
        if filters:
            body["filters"] = filters
        resp = self._client.post("/query", json=body, headers=self._headers())
        resp.raise_for_status()
        return resp.json()

    def search_runbooks(self, question: str) -> str:
        """Search runbooks and return the answer with citations."""
        result = self.query(question, top_k=5, filters={"doc_type": "runbooks"})
        citations = ""
        if result.get("citations"):
            citations = "\n\nSources:\n" + "\n".join(
                f"- {c.get('source_path', 'unknown')}" for c in result["citations"]
            )
        return result.get("answer", "No relevant information found.") + citations

    def search_incidents(self, question: str) -> str:
        """Search historical incidents and return the answer with citations."""
        result = self.query(question, top_k=5, filters={"doc_type": "incidents"})
        citations = ""
        if result.get("citations"):
            citations = "\n\nSources:\n" + "\n".join(
                f"- {c.get('source_path', 'unknown')}" for c in result["citations"]
            )
        return result.get("answer", "No relevant incidents found.") + citations

    def ingest_file(self, file_path: str) -> dict:
        """Upload a document for ingestion."""
        with open(file_path, "rb") as f:
            resp = self._client.post(
                "/ingest",
                files={"file": (file_path.split("/")[-1], f)},
                headers=self._headers(),
            )
        resp.raise_for_status()
        return resp.json()

    def health(self) -> dict:
        resp = self._client.get("/health")
        return resp.json()
```

3. Create `/Users/omatsone/Desktop/projectAI/agentops/src/integrations/mlmonitoring_client.py`:

```python
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
```

4. Create `/Users/omatsone/Desktop/projectAI/agentops/src/integrations/composio_client.py`:

```python
"""Composio integration for Slack and GitHub actions."""
from composio_crewai import ComposioToolSet, Action

def get_composio_tools():
    """Get Composio tools for CrewAI agents.

    Returns a list of CrewAI-compatible tools for:
    - Slack: send messages
    - GitHub: create issues

    Must have COMPOSIO_API_KEY set and integrations connected.
    """
    toolset = ComposioToolSet()
    tools = toolset.get_tools(
        actions=[
            Action.SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL,
            Action.GITHUB_CREATE_AN_ISSUE,
        ]
    )
    return tools
```

5. Update `/Users/omatsone/Desktop/projectAI/agentops/src/integrations/__init__.py`:
```python
from .snowflake_client import SnowflakeClient
from .rag_client import RAGClient
from .mlmonitoring_client import MLMonitoringClient
```

**Verification:**
```bash
cd /Users/omatsone/Desktop/projectAI/agentops
# Test imports (no connections needed)
python -c "
from integrations import SnowflakeClient, RAGClient, MLMonitoringClient
print('All clients importable')
"
```

**Output artifacts:**
- `src/integrations/snowflake_client.py` — Snowflake query client
- `src/integrations/rag_client.py` — RAG HTTP client
- `src/integrations/mlmonitoring_client.py` — ML monitoring HTTP client
- `src/integrations/composio_client.py` — Composio tool getter

---

## SESSION S6: RAG Ingestion of Runbooks

**Goal:** Ingest the runbook and incident documents into the running RAG system.

**Prerequisites:** S2 (runbooks + incidents exist), RAG system running at localhost:8001

**Instructions:**

1. Create `/Users/omatsone/Desktop/projectAI/agentops/scripts/ingest_docs.py`:

```python
"""Ingest runbooks and incidents into the RAG system."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from integrations.rag_client import RAGClient
from pathlib import Path

def main():
    client = RAGClient()

    # Check health
    health = client.health()
    print(f"RAG health: {health}")

    # Ingest runbooks
    runbooks_dir = Path(__file__).parent.parent / "runbooks"
    for f in sorted(runbooks_dir.glob("*.md")):
        print(f"Ingesting runbook: {f.name}...")
        result = client.ingest_file(str(f))
        print(f"  → {result}")

    # Ingest incidents
    incidents_dir = Path(__file__).parent.parent / "incidents"
    for f in sorted(incidents_dir.glob("*.md")):
        print(f"Ingesting incident: {f.name}...")
        result = client.ingest_file(str(f))
        print(f"  → {result}")

    # Verify with test queries
    print("\n--- Verification Queries ---")

    r1 = client.search_runbooks("What should I do when model drift is detected?")
    print(f"\nRunbook query result:\n{r1[:300]}...")

    r2 = client.search_incidents("Has V14 drift happened before?")
    print(f"\nIncident query result:\n{r2[:300]}...")

if __name__ == "__main__":
    main()
```

2. Run: `cd /Users/omatsone/Desktop/projectAI/agentops && python scripts/ingest_docs.py`

**Verification:**
- All 6 runbooks + 8 incidents ingested successfully
- Test query about "model drift" returns relevant runbook content
- Test query about "V14" returns the V14 drift incident

**Output artifacts:**
- `scripts/ingest_docs.py` — ingestion script
- Documents indexed in RAG system's ChromaDB + BM25 index

---

## SESSION S7: CrewAI Tools

**Goal:** Create custom CrewAI tools that wrap the integration clients. These are what the agents actually call.

**Prerequisites:** S4 (models), S5 (integration clients)

**Instructions:**

1. Create `/Users/omatsone/Desktop/projectAI/agentops/src/tools/snowflake_tools.py`:

Define these as CrewAI `@tool` decorated functions or `BaseTool` subclasses:

- **`query_model_metrics`**: Takes `model_name` (str, default "classifier_v2") and `hours` (int, default 1). Uses `SnowflakeClient.get_latest_model_metrics()`. Returns formatted string with latest F1, drift score, latency, anomaly rate. Include a clear assessment: "HEALTHY", "WARNING", or "CRITICAL" based on thresholds from config.

- **`query_feature_drift`**: Takes `model_name` (str). Uses `SnowflakeClient.get_feature_drift()`. Returns per-feature drift scores, highlighting any feature with PSI > 0.2. Sort by PSI descending.

- **`query_data_quality`**: Takes `pipeline_name` (str, default "transactions_ingest"). Uses `SnowflakeClient.get_data_quality()`. Returns latest quality metrics with status assessment.

- **`query_metric_trend`**: Takes `model_name` (str), `metric` (str), `hours` (int, default 24). Uses `SnowflakeClient.get_metric_trend()`. Returns the trend as a formatted list showing when the metric started degrading.

Use `crewai.tools.tool` decorator. Each tool must have a clear docstring (CrewAI uses this as the tool description for the LLM).

2. Create `/Users/omatsone/Desktop/projectAI/agentops/src/tools/rag_tools.py`:

- **`search_runbooks`**: Takes `question` (str). Uses `RAGClient.search_runbooks()`. Returns answer with citations.

- **`search_incidents`**: Takes `question` (str). Uses `RAGClient.search_incidents()`. Returns answer with citations.

3. Create `/Users/omatsone/Desktop/projectAI/agentops/src/tools/mlops_tools.py`:

- **`check_model_health`**: No params. Uses `MLMonitoringClient.health()` + `.ready()` + `.model_info()`. Returns formatted health status.

- **`trigger_retraining`**: Takes `model_type` (str, default "classifier"). Uses `MLMonitoringClient.trigger_retraining()`. Returns training status.

- **`check_training_status`**: Takes `model_type` (str). Uses `MLMonitoringClient.training_status()`. Returns latest training run info.

- **`rollback_model`**: No params. Uses `MLMonitoringClient.rollback_model()`. Returns rollback result.

4. Create `/Users/omatsone/Desktop/projectAI/agentops/src/tools/composio_tools.py`:

This file just re-exports the Composio tools:
```python
from integrations.composio_client import get_composio_tools
```

The Composio tools (Slack send message, GitHub create issue) are already CrewAI-compatible via `composio-crewai`.

5. Update `/Users/omatsone/Desktop/projectAI/agentops/src/tools/__init__.py` with imports.

**Verification:**
```bash
cd /Users/omatsone/Desktop/projectAI/agentops
python -c "
from tools.snowflake_tools import query_model_metrics, query_feature_drift, query_data_quality, query_metric_trend
from tools.rag_tools import search_runbooks, search_incidents
from tools.mlops_tools import check_model_health, trigger_retraining, rollback_model
print('All tools importable')
# Print tool descriptions
for t in [query_model_metrics, query_feature_drift, search_runbooks, check_model_health]:
    print(f'  {t.name}: {t.description[:80]}...')
"
```

**Output artifacts:**
- `src/tools/snowflake_tools.py` — 4 Snowflake query tools
- `src/tools/rag_tools.py` — 2 RAG search tools
- `src/tools/mlops_tools.py` — 4 ML ops action tools
- `src/tools/composio_tools.py` — Composio tool re-export

---

## SESSION S8: CrewAI Agents + Crew

**Goal:** Define the 3 agents and assemble the AgentOps crew.

**Prerequisites:** S7 (all tools ready)

**Instructions:**

1. Create `/Users/omatsone/Desktop/projectAI/agentops/src/crew/agents.py`:

Define 3 CrewAI Agents:

**Monitor Agent:**
```python
from crewai import Agent

monitor_agent = Agent(
    role="ML Model Monitor",
    goal="Continuously monitor ML model health and data pipeline quality. "
         "Detect anomalies including model drift, accuracy drops, latency spikes, "
         "and data quality issues. Raise structured alerts when thresholds are breached.",
    backstory="You are a senior SRE specializing in ML systems. You monitor "
              "production ML models for a fraud detection platform. You know the "
              "healthy baselines: F1 > 0.88, drift_score < 0.3, latency_p99 < 1000ms, "
              "null_rate < 0.05, anomaly_rate < 0.10. When metrics breach these "
              "thresholds, you raise alerts with severity and evidence.",
    tools=[query_model_metrics, query_feature_drift, query_data_quality, check_model_health],
    verbose=True,
    allow_delegation=False,
)
```

**Investigator Agent:**
```python
investigator_agent = Agent(
    role="ML Incident Investigator",
    goal="Given an alert about ML model or data pipeline issues, determine the "
         "root cause by searching operational runbooks and historical incident "
         "reports. Provide a diagnosis with evidence and recommended actions.",
    backstory="You are a senior ML engineer who has debugged hundreds of production "
              "ML incidents. You always start by checking runbooks, then look at "
              "historical incidents for similar patterns. You examine metric trends "
              "to pinpoint when the problem started. You provide clear root cause "
              "analysis with confidence levels and cite your sources.",
    tools=[search_runbooks, search_incidents, query_metric_trend, query_feature_drift],
    verbose=True,
    allow_delegation=False,
)
```

**Remediator Agent:**
```python
remediator_agent = Agent(
    role="ML Operations Remediator",
    goal="Execute recommended remediation actions from the investigation. "
         "Send notifications, create tracking issues, and trigger model "
         "retraining or rollback as needed. Always check training status "
         "after triggering retraining.",
    backstory="You are a DevOps engineer responsible for ML model lifecycle. "
              "You follow runbook procedures precisely. For low-risk actions "
              "(notifications, issue creation) you execute immediately. For "
              "high-risk actions (retraining, rollback) you clearly state what "
              "you're about to do and why. You always verify the outcome of "
              "your actions.",
    tools=[trigger_retraining, check_training_status, rollback_model,
           check_model_health] + composio_tools,
    verbose=True,
    allow_delegation=False,
)
```

2. Create `/Users/omatsone/Desktop/projectAI/agentops/src/crew/tasks.py`:

Define 3 CrewAI Tasks:

```python
from crewai import Task

def create_monitor_task(context: str = "") -> Task:
    """Create monitoring task. Context can provide specific focus."""
    return Task(
        description=(
            "Check the current health of the ML fraud detection system.\n\n"
            "1. Query the latest model metrics from Snowflake (last 1 hour)\n"
            "2. Check per-feature drift scores\n"
            "3. Check data quality metrics\n"
            "4. Check model serving health\n\n"
            "Thresholds:\n"
            "- F1 score < 0.88 → accuracy_drop alert\n"
            "- Drift score > 0.3 → model_drift alert\n"
            "- Latency p99 > 1000ms → latency alert\n"
            "- Null rate > 0.05 → data_quality alert\n"
            "- Anomaly rate > 0.10 → anomaly_spike alert\n\n"
            f"Additional context: {context}\n\n"
            "Output a JSON alert object if any thresholds are breached, "
            "or state 'ALL_HEALTHY' if everything is within normal range."
        ),
        expected_output=(
            "A JSON object with: alert_id, severity (critical/warning/info), "
            "alert_type, affected_component, metrics dict, message. "
            "Or the string 'ALL_HEALTHY' if no issues found."
        ),
        agent=monitor_agent,
    )

def create_investigation_task() -> Task:
    return Task(
        description=(
            "Investigate the alert raised by the Monitor Agent.\n\n"
            "1. Search runbooks for relevant procedures based on the alert type\n"
            "2. Search historical incidents for similar past events\n"
            "3. Query metric trends to identify when the problem started\n"
            "4. If it's a drift alert, check which specific features are drifting\n\n"
            "Provide a root cause analysis with:\n"
            "- Root cause explanation\n"
            "- Confidence level (0.0 to 1.0)\n"
            "- Evidence from runbooks and incidents\n"
            "- Recommended actions with priorities\n"
            "- Similar past incidents if any"
        ),
        expected_output=(
            "A JSON diagnosis object with: alert_id, root_cause, confidence, "
            "evidence list, recommended_actions list (each with action, priority, "
            "requires_approval), runbook_reference, similar_incidents."
        ),
        agent=investigator_agent,
    )

def create_remediation_task() -> Task:
    return Task(
        description=(
            "Execute the recommended remediation actions from the investigation.\n\n"
            "For each recommended action:\n"
            "1. Send a Slack notification to #ml-alerts with the diagnosis summary\n"
            "2. Create a GitHub issue with the full diagnosis details\n"
            "3. If retraining is recommended: trigger model retraining and monitor its status\n"
            "4. If rollback is recommended: execute model rollback\n"
            "5. After any action, verify the system health\n\n"
            "Report all actions taken with their status."
        ),
        expected_output=(
            "A JSON resolution object with: alert_id, actions_taken list "
            "(each with action, status, details), resolution_status."
        ),
        agent=remediator_agent,
    )
```

3. Create `/Users/omatsone/Desktop/projectAI/agentops/src/crew/crew.py`:

```python
from crewai import Crew, Process

class AgentOpsCrew:
    def __init__(self):
        # ... initialize agents, tasks
        pass

    def run(self, context: str = "") -> str:
        """Run the full monitor → investigate → remediate pipeline."""
        monitor_task = create_monitor_task(context)
        investigate_task = create_investigation_task()
        remediate_task = create_remediation_task()

        # Sequential: investigate depends on monitor, remediate depends on investigate
        investigate_task.context = [monitor_task]
        remediate_task.context = [monitor_task, investigate_task]

        crew = Crew(
            agents=[monitor_agent, investigator_agent, remediator_agent],
            tasks=[monitor_task, investigate_task, remediate_task],
            process=Process.sequential,
            verbose=True,
        )
        result = crew.kickoff()
        return str(result)

    def run_monitor_only(self, context: str = "") -> str:
        """Run just the monitor task (for polling mode)."""
        crew = Crew(
            agents=[monitor_agent],
            tasks=[create_monitor_task(context)],
            process=Process.sequential,
            verbose=True,
        )
        return str(crew.kickoff())
```

**Verification:**
```bash
cd /Users/omatsone/Desktop/projectAI/agentops
python -c "
from crew.crew import AgentOpsCrew
c = AgentOpsCrew()
print('Crew initialized successfully')
print(f'Agents: {len(c.crew.agents) if hasattr(c, \"crew\") else \"lazy init\"}')
"
```

**Output artifacts:**
- `src/crew/agents.py` — 3 agent definitions
- `src/crew/tasks.py` — 3 task factories
- `src/crew/crew.py` — AgentOpsCrew orchestrator class

---

## SESSION S9: Orchestrator + Demo Mode

**Goal:** Build the main entry point that ties everything together with a demo mode.

**Prerequisites:** S8 (crew ready)

**Instructions:**

1. Create `/Users/omatsone/Desktop/projectAI/agentops/src/orchestrator.py`:

Three execution modes:

**Mode 1: `demo`** — Runs the full pipeline once with a pre-seeded drift scenario.
```bash
python -m orchestrator --mode demo
```
- Calls `AgentOpsCrew.run()` with context "Check for model drift"
- Prints agent reasoning at each step
- Outputs final resolution report

**Mode 2: `monitor`** — Polling loop that checks every N seconds.
```bash
python -m orchestrator --mode monitor --interval 30
```
- Runs `AgentOpsCrew.run_monitor_only()` in a loop
- If alert detected, runs full pipeline (investigate + remediate)
- Continues polling after resolution

**Mode 3: `investigate`** — On-demand investigation of a user-provided issue.
```bash
python -m orchestrator --mode investigate --query "Model F1 dropped to 0.82"
```
- Skips monitoring, goes straight to investigation + remediation
- User provides the alert context

The orchestrator should:
- Load `.env` via `python-dotenv`
- Set up `sys.path` to include `src/`
- Log all agent outputs to a JSON file at `logs/run_<timestamp>.json`
- Capture start/end timestamps for time-to-detect, time-to-diagnose, time-to-act metrics
- Handle KeyboardInterrupt gracefully in monitor mode

2. Create a `run_demo.sh` convenience script at the project root:
```bash
#!/bin/bash
cd "$(dirname "$0")"
source .env 2>/dev/null
export PYTHONPATH=src:$PYTHONPATH
python src/orchestrator.py --mode demo
```

**Verification:**
```bash
cd /Users/omatsone/Desktop/projectAI/agentops
python -c "from orchestrator import main; print('Orchestrator importable')"
# Full test requires all services running
```

**Output artifacts:**
- `src/orchestrator.py` — Main entry point with 3 modes
- `run_demo.sh` — Convenience launcher

---

## SESSION S10: Streamlit Dashboard

**Goal:** Build the Streamlit UI with live status, alert feed, investigation view, and action buttons.

**Prerequisites:** S4 (models for typing), S5 (clients for data fetching)

**Instructions:**

1. Create `/Users/omatsone/Desktop/projectAI/agentops/dashboard/streamlit_app.py`:

**Layout (use `st.columns` and `st.tabs`):**

```
┌─────────────────────────────────────────────────┐
│  🔒 AgentOps — Autonomous MLOps Platform        │
├─────────────────────────────────────────────────┤
│  [Status] [Alerts] [Investigation] [Actions]    │  ← tabs
├─────────────────────────────────────────────────┤
│                                                 │
│  Tab content area                               │
│                                                 │
├─────────────────────────────────────────────────┤
│  [▶ Run Demo]  [🔄 Refresh]                     │  ← sidebar
│  Demo Mode: ☑                                   │
│  Poll Interval: 30s                             │
└─────────────────────────────────────────────────┘
```

**Tab 1: Status**
- 3 metric cards across the top row:
  - Model Health: F1 score + drift score (green/yellow/red)
  - Data Quality: null rate + record count (green/yellow/red)
  - System: latency p99 + uptime (green/yellow/red)
- Data from `SnowflakeClient.get_latest_model_metrics()` and `.get_data_quality()`
- Use `st.metric()` with delta indicators

**Tab 2: Alerts**
- Real-time feed of alerts (stored in `st.session_state`)
- Each alert as an expandable card with severity badge
- Color coding: red=critical, yellow=warning, blue=info
- "Simulate Drift" button that triggers the demo scenario

**Tab 3: Investigation**
- Shows the Investigator Agent's diagnosis when available
- Root cause, confidence bar, evidence list, runbook citations
- Similar past incidents as expandable cards
- "Ask a Question" text input that queries RAG directly

**Tab 4: Actions**
- List of actions taken/pending
- For pending actions: APPROVE / DENY buttons
- Status indicators: completed (green check), pending (yellow clock), failed (red X)
- Timeline view of all actions

**Sidebar:**
- "Run Full Demo" button — triggers `AgentOpsCrew.run()` in a thread
- "Monitor Mode" toggle — starts/stops polling
- Configuration: poll interval slider
- Snowflake connection status indicator
- RAG system health indicator
- ML Monitoring health indicator

**State management:**
- Use `st.session_state` for: alerts list, current diagnosis, action log, approval queue
- Use `threading` for background crew execution (don't block the UI)
- Use `st.rerun()` to refresh after state changes

**Important implementation notes:**
- The crew runs in a background thread. Use a queue or shared state dict for communication.
- For the demo, pre-populate some state to show the UI working even before services are connected.
- Add fallback/mock data if services are unavailable (for resilient demo).
- Include the AgentOps architecture diagram as a static image or Mermaid render.

2. Create `dashboard/run_dashboard.sh`:
```bash
#!/bin/bash
cd "$(dirname "$0")/.."
export PYTHONPATH=src:$PYTHONPATH
streamlit run dashboard/streamlit_app.py --server.port 8502
```

**Verification:**
```bash
cd /Users/omatsone/Desktop/projectAI/agentops
PYTHONPATH=src streamlit run dashboard/streamlit_app.py --server.port 8502
# Opens browser, all 4 tabs render without errors
# "Simulate Drift" button is visible
```

**Output artifacts:**
- `dashboard/streamlit_app.py` — Full dashboard (~300-400 lines)
- `dashboard/run_dashboard.sh` — Launcher script

---

## SESSION S11: End-to-End Integration + Polish

**Goal:** Run the full system, fix integration issues, and polish for demo.

**Prerequisites:** S9 (orchestrator), S10 (dashboard), all services running

**Pre-flight checklist (verify before starting):**
- [ ] Snowflake tables exist and seeded (S3)
- [ ] Runbooks/incidents ingested into RAG (S6)
- [ ] mlmonitoring running at localhost:8000
- [ ] ragsystem running at localhost:8001
- [ ] `.env` file populated with all credentials
- [ ] Composio integrations connected (Slack + GitHub)

**Instructions:**

1. **Test each integration client independently:**
```bash
cd /Users/omatsone/Desktop/projectAI/agentops
PYTHONPATH=src python -c "
from integrations import SnowflakeClient
c = SnowflakeClient()
print('Snowflake:', c.get_latest_model_metrics()[:1])
"

PYTHONPATH=src python -c "
from integrations import RAGClient
c = RAGClient()
print('RAG:', c.search_runbooks('What is model drift?')[:200])
"

PYTHONPATH=src python -c "
from integrations import MLMonitoringClient
c = MLMonitoringClient()
print('MLMon:', c.health())
"
```

2. **Test each CrewAI tool independently:**
```bash
PYTHONPATH=src python -c "
from tools.snowflake_tools import query_model_metrics
print(query_model_metrics.run())
"
# Repeat for each tool
```

3. **Run the full demo flow:**
```bash
cd /Users/omatsone/Desktop/projectAI/agentops
bash run_demo.sh
```
- Watch for errors, fix import issues, adjust prompts if agents are confused
- If agent takes too long, reduce task description complexity
- If agent produces bad output, adjust backstory or expected_output

4. **Run the dashboard + demo simultaneously:**
- Terminal 1: `bash dashboard/run_dashboard.sh`
- Terminal 2: `bash run_demo.sh`
- Verify the dashboard updates as the crew runs

5. **Polish checklist:**
- [ ] Demo completes in < 5 minutes
- [ ] Slack notification appears in channel
- [ ] GitHub issue created with diagnosis
- [ ] Dashboard shows alert → investigation → resolution flow
- [ ] No Python tracebacks visible in UI
- [ ] "Simulate Drift" button works from dashboard

6. **Create fallback mode** — If any service is down during demo:
- Add mock data responses to each integration client
- Controlled by `settings.demo_mode = True`
- Mock responses should be realistic and match the demo script

**Verification:**
- Full demo flow completes without errors
- Dashboard shows all 4 phases: healthy → alert → diagnosis → resolution
- At least 3 partner tools are visibly used (Snowflake queries, CrewAI agents, Composio actions)

**Output artifacts:**
- Bug fixes across all files
- Mock/fallback responses for demo resilience
- Validated end-to-end flow

---

## SESSION S12: Demo Script + Video Prep

**Goal:** Prepare the demo narrative, reset script, and record the submission video.

**Prerequisites:** S11 (everything working)

**Instructions:**

1. Create `/Users/omatsone/Desktop/projectAI/agentops/DEMO_SCRIPT.md`:

Write a precise, timed demo script (3 minutes total):

```
0:00-0:15  "AgentOps is an autonomous MLOps platform..."
           → Show architecture slide
0:15-0:30  → Show dashboard in healthy state (all green)
0:30-1:00  → Click "Simulate Drift" / show Snowflake data
           → Monitor Agent detects, alert appears
1:00-1:45  → Investigator Agent runs (show RAG citations live)
           → Diagnosis appears with root cause + evidence
1:45-2:30  → Remediator acts: Slack msg, GitHub issue
           → Show retraining triggered
           → Approve deployment
2:30-2:45  → Dashboard returns to green
           → Show Slack confirmation message
2:45-3:00  → Architecture recap: "Snowflake + CrewAI + Composio"
           → "From alert to resolution in minutes, not hours"
```

2. Create `/Users/omatsone/Desktop/projectAI/agentops/scripts/reset_demo.sh`:
```bash
#!/bin/bash
# Reset everything to pre-demo state
cd "$(dirname "$0")/.."
export PYTHONPATH=src:$PYTHONPATH

echo "Resetting Snowflake seed data..."
python seed/reset_demo.py

echo "Clearing dashboard state..."
# Kill any running streamlit/orchestrator
pkill -f "streamlit run" 2>/dev/null
pkill -f "orchestrator" 2>/dev/null

echo "Ready for demo. Start with:"
echo "  Terminal 1: bash dashboard/run_dashboard.sh"
echo "  Terminal 2: bash run_demo.sh"
```

3. Prepare GitHub repo:
- Create README.md with: project description, architecture diagram, setup instructions, demo video link
- Ensure `.env` is gitignored
- Ensure all code is committed
- Push to public GitHub repo

4. Record demo video (if possible from this session):
- Use QuickTime / OBS
- Follow DEMO_SCRIPT.md exactly
- Include: dashboard, terminal output, Slack notification, GitHub issue

**Verification:**
- `bash scripts/reset_demo.sh` runs clean
- Demo can be repeated identically after reset
- GitHub repo has all code + README

**Output artifacts:**
- `DEMO_SCRIPT.md` — Timed demo narrative
- `scripts/reset_demo.sh` — Demo reset script
- `README.md` — Public repo readme
- GitHub repo ready for submission

---

## Appendix: Environment Setup Checklist

Before starting any session, ensure:

```bash
# 1. Python venv
cd /Users/omatsone/Desktop/projectAI/agentops
python3.11 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -e ".[dev]"

# 3. Set PYTHONPATH
export PYTHONPATH=src:$PYTHONPATH

# 4. Copy and fill .env
cp .env.example .env
# Edit .env with real credentials

# 5. Verify sibling services
curl http://localhost:8000/health   # mlmonitoring
curl http://localhost:8001/health   # ragsystem
```

## Appendix: Quick Session Selector

**"I have 30 minutes, what should I do?"**
→ Run S1 + S4 in parallel (scaffold + models). Then S2 (runbooks).

**"I have 1 hour and a teammate"**
→ Person A: S1 → S3 (scaffold + Snowflake)
→ Person B: S2 → S4 (runbooks + models)

**"Everything is built, services are running, I need to demo in 1 hour"**
→ Run S11 (integration test) → S12 (demo prep)

**"I want to test just the agents without all services"**
→ Set `demo_mode=True` in `.env`, run S8 with mock responses
