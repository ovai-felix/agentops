# AgentOps: Autonomous MLOps & DataOps Platform

## Vision
An agentic system that autonomously monitors ML models and data pipelines, diagnoses issues by querying internal runbooks and documentation via RAG, and self-heals with human-in-the-loop approval gates — all orchestrated by a multi-agent crew.

## Tagline
> "From alert to resolution in minutes, not hours."

---

## Architecture Overview

```
                          ┌─────────────────────────┐
                          │      AgentOps UI         │
                          │   (Streamlit Dashboard)  │
                          └────────────┬────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │    CrewAI Orchestrator   │
                          │  (Multi-Agent Manager)   │
                          └────────────┬────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
   ┌──────────▼──────────┐  ┌─────────▼──────────┐  ┌─────────▼──────────┐
   │   Monitor Agent      │  │  Investigator Agent │  │  Remediator Agent  │
   │                      │  │                     │  │                    │
   │ • Model metrics      │  │ • RAG over runbooks │  │ • Trigger retrain  │
   │ • Data quality       │  │ • Root cause        │  │ • Model rollback   │
   │ • Pipeline health    │  │   analysis          │  │ • Pipeline rerun   │
   │ • Drift detection    │  │ • Historical        │  │ • Slack/GitHub      │
   │                      │  │   incident matching │  │ • Human approvals  │
   └──────────┬──────────┘  └─────────┬──────────┘  └─────────┬──────────┘
              │                        │                        │
   ┌──────────▼──────────┐  ┌─────────▼──────────┐  ┌─────────▼──────────┐
   │   mlmonitoring       │  │   ragsystem         │  │  agenticworkflow   │
   │   + Snowflake        │  │   (Hybrid RAG)      │  │  + Composio        │
   └─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

---

## Partner Integration Map

| Partner     | Role in AgentOps                                                    |
|-------------|---------------------------------------------------------------------|
| **Snowflake** | Data warehouse for model metrics, prediction logs, data quality stats. Monitor Agent queries Snowflake for real-time health signals. |
| **CrewAI**    | Orchestrates the 3-agent crew (Monitor, Investigator, Remediator). Manages agent communication, task delegation, and workflow sequencing. |
| **Composio**  | Provides tool integrations for Remediator Agent: Slack notifications, GitHub issue creation, PagerDuty acknowledgment, JIRA tickets. |
| **Skyfire**   | (Optional) Payment/billing for API costs if applicable. |

---

## Project Reuse Map

| Existing Project      | What We Reuse                                           | What We Add                            |
|-----------------------|---------------------------------------------------------|----------------------------------------|
| **agenticworkflow**   | LangGraph agent core, tool registry, confirmation gates, tracing, memory | CrewAI integration, new remediation tools |
| **mlmonitoring**      | Prometheus metrics, drift detection, model manager, prediction service, blue-green deploy | Snowflake export, metric aggregation API |
| **ragsystem**         | Hybrid retrieval (vector+BM25), cross-encoder reranking, streaming generation, document ingestion | Runbook corpus, incident knowledge base |

---

## Agent Definitions (CrewAI)

### Agent 1: Monitor Agent
**Role**: Sentinel
**Goal**: Continuously watch model performance and data pipeline health. Raise structured alerts when anomalies are detected.

**Tools**:
- `query_snowflake` — Run SQL against Snowflake tables (model_metrics, prediction_logs, data_quality)
- `check_model_health` — Hit mlmonitoring `/health` and `/model/info` endpoints
- `check_drift` — Query drift detection service for per-feature PSI/KS scores
- `check_data_quality` — Validate recent data batches (null rates, schema violations, volume)

**Triggers** (what it watches for):
- Model accuracy drops > 5% from baseline
- Feature drift score > 0.3 (aggregate PSI)
- Data volume anomaly (< 50% or > 200% of expected)
- Prediction latency p99 > 1 second
- Anomaly rate spike > 10%
- Data quality violations > 5% of records

**Output**: Structured alert object:
```json
{
  "alert_id": "alert_2026-02-28_001",
  "severity": "critical|warning|info",
  "alert_type": "model_drift|data_quality|latency|accuracy_drop|anomaly_spike",
  "affected_component": "classifier_v2|data_pipeline_transactions|...",
  "metrics": { "current_f1": 0.82, "baseline_f1": 0.91, "drift_score": 0.45 },
  "timestamp": "2026-02-28T14:30:00Z"
}
```

---

### Agent 2: Investigator Agent
**Role**: Detective
**Goal**: Given an alert, determine root cause by searching runbooks, historical incidents, and documentation.

**Tools**:
- `search_runbooks` — RAG query over ingested runbooks/docs (ragsystem hybrid retrieval)
- `search_incidents` — RAG query over historical incident reports
- `query_snowflake_history` — Look at metric trends over time to identify when degradation started
- `compare_model_versions` — Diff current vs. previous model metrics

**Investigation Flow**:
1. Receive alert from Monitor Agent
2. Classify alert type → select investigation strategy
3. For **model drift**: query runbooks for "feature drift remediation", check which features drifted, look at upstream data changes in Snowflake
4. For **data quality**: query pipeline docs for expected schema, check recent data source changes
5. For **accuracy drop**: compare model versions, check if retraining data was corrupted, search for similar past incidents
6. For **latency**: check model complexity, batch size, infrastructure metrics

**Output**: Diagnosis report:
```json
{
  "alert_id": "alert_2026-02-28_001",
  "root_cause": "Feature V14 distribution shifted due to upstream schema change in transactions table",
  "confidence": 0.85,
  "evidence": ["runbook_section_3.2", "incident_2026-01-15", "snowflake_query_result"],
  "recommended_actions": [
    {"action": "retrain_model", "priority": 1, "requires_approval": true},
    {"action": "notify_data_team", "priority": 2, "requires_approval": false},
    {"action": "rollback_model", "priority": 3, "requires_approval": true, "condition": "if retrain fails"}
  ],
  "runbook_reference": "runbook_model_drift.md#section-3",
  "similar_incidents": ["INC-2026-0115: V14 drift caused by vendor API change"]
}
```

---

### Agent 3: Remediator Agent
**Role**: Fixer
**Goal**: Execute recommended actions from the Investigator, with human approval gates for destructive operations.

**Tools** (via Composio + agenticworkflow):
- `trigger_retraining` — Call mlmonitoring `/training/trigger` endpoint
- `rollback_model` — Call mlmonitoring `/model/rollback` endpoint
- `send_slack_alert` — Post to Slack channel via Composio
- `create_github_issue` — Create issue with diagnosis details via Composio
- `rerun_pipeline` — Trigger data pipeline rerun (Snowflake task or external)
- `request_human_approval` — Pause workflow for human confirmation (agenticworkflow confirmation gates)

**Approval Matrix**:
| Action | Auto-Approve? | Reason |
|--------|--------------|--------|
| Send Slack notification | Yes | Low risk, informational |
| Create GitHub issue | Yes | Low risk, tracking |
| Trigger model retraining | **No** — requires approval | Resource-intensive, could introduce new issues |
| Rollback model | **No** — requires approval | Affects production predictions |
| Rerun data pipeline | **No** — requires approval | Could process duplicate data |
| Scale infrastructure | **No** — requires approval | Cost implications |

**Output**: Resolution report:
```json
{
  "alert_id": "alert_2026-02-28_001",
  "actions_taken": [
    {"action": "send_slack_alert", "status": "completed", "details": "Posted to #ml-alerts"},
    {"action": "create_github_issue", "status": "completed", "details": "Issue #142 created"},
    {"action": "retrain_model", "status": "awaiting_approval", "approval_url": "..."}
  ],
  "resolution_status": "in_progress",
  "time_to_detect": "2 minutes",
  "time_to_diagnose": "45 seconds",
  "time_to_act": "30 seconds"
}
```

---

## Data Flow: End-to-End Scenario

### Scenario: Model Drift Detected

```
Timeline:
─────────────────────────────────────────────────────────────────

T+0s    Monitor Agent polls Snowflake
        → SELECT avg(drift_score) FROM model_metrics WHERE ts > now() - interval '1 hour'
        → drift_score = 0.45 (threshold: 0.3)
        → ALERT RAISED: model_drift, severity=critical

T+5s    CrewAI delegates to Investigator Agent
        → Investigator queries RAG: "What causes high drift in fraud detection model?"
        → RAG returns: runbook_model_drift.md Section 3.2
          "Feature drift typically caused by: (1) upstream schema changes,
           (2) seasonal patterns, (3) data source outages"
        → Investigator queries Snowflake: "Show me per-feature drift scores"
        → Finds: V14 PSI=0.8, V17 PSI=0.6, others normal
        → Investigator queries RAG: "V14 V17 drift historical incidents"
        → Finds: Similar incident on 2026-01-15 caused by vendor API change
        → ROOT CAUSE: Feature V14/V17 distribution shift, likely upstream change

T+50s   CrewAI delegates to Remediator Agent
        → Auto-executes: Slack alert to #ml-alerts with diagnosis
        → Auto-executes: GitHub issue created with full diagnosis report
        → Requests approval: "Trigger model retraining with latest data?"
        → [HUMAN APPROVES via UI]
        → Triggers retraining via mlmonitoring /training/trigger
        → Monitors training progress
        → Training complete → new model passes evaluation gate (F1 >= baseline - 0.01)
        → Requests approval: "Deploy retrained model via blue-green swap?"
        → [HUMAN APPROVES]
        → Blue-green deployment executed
        → Post-deploy monitoring: 5-minute health check

T+8min  Resolution complete
        → Slack update: "Model drift resolved. New model v3 deployed. F1: 0.89 → 0.93"
        → GitHub issue closed with resolution details
        → Full trace logged with Mermaid diagram
```

---

## Implementation Plan (6 Hours)

### Hour 1: Foundation & Snowflake Setup (60 min)

**Task 1.1: Snowflake Schema + Seed Data (30 min)**
- Create Snowflake database `AGENTOPS`
- Create tables:
  - `MODEL_METRICS` (timestamp, model_name, f1, precision, recall, auc, drift_score, latency_p99)
  - `PREDICTION_LOGS` (timestamp, prediction_id, features, prediction, confidence, actual_label)
  - `DATA_QUALITY` (timestamp, pipeline_name, null_rate, schema_violations, record_count, status)
  - `INCIDENTS` (incident_id, timestamp, alert_type, severity, root_cause, resolution, duration_minutes)
- Seed with realistic data from mlmonitoring's existing SQLite DB (export → load to Snowflake)
- Include a "drift event" in the seed data for demo purposes

**Task 1.2: Snowflake Connector (30 min)**
- Install `snowflake-connector-python`
- Create `src/integrations/snowflake_client.py`
- Functions: `query_model_metrics()`, `query_data_quality()`, `query_prediction_trends()`, `query_incidents()`
- Environment config: `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD`, `SNOWFLAKE_DATABASE`

### Hour 2: RAG Runbook Corpus (60 min)

**Task 2.1: Create Runbook Documents (30 min)**
- Write 5-8 runbook documents covering:
  - `runbook_model_drift.md` — Steps to diagnose and fix model drift
  - `runbook_data_quality.md` — Data validation failure response
  - `runbook_latency_spike.md` — Performance degradation playbook
  - `runbook_retraining.md` — When and how to retrain models
  - `runbook_rollback.md` — Model rollback procedures
  - `runbook_incident_response.md` — General incident response workflow
- Include realistic steps, thresholds, decision trees, and escalation paths

**Task 2.2: Ingest into RAG System (15 min)**
- Use ragsystem's ingestion pipeline to process runbooks
- Verify hybrid search returns relevant results for test queries

**Task 2.3: Create Historical Incident Corpus (15 min)**
- Write 10-15 historical incident reports (text files)
- Include root causes, resolutions, and lessons learned
- Ingest into RAG system as a separate doc_type for filtering

### Hour 3: CrewAI Agent Definitions (60 min)

**Task 3.1: Install & Configure CrewAI (15 min)**
- `pip install crewai crewai-tools`
- Create `src/crew/` directory structure

**Task 3.2: Define Monitor Agent (15 min)**
- CrewAI Agent with Snowflake query tools
- Polling logic: check metrics every N seconds (configurable)
- Alert threshold configuration
- Structured alert output format

**Task 3.3: Define Investigator Agent (15 min)**
- CrewAI Agent with RAG query tools
- Investigation strategy per alert type
- Diagnosis report output format
- Evidence collection from multiple sources

**Task 3.4: Define Remediator Agent (15 min)**
- CrewAI Agent with action tools
- Approval matrix implementation
- Action execution with status tracking
- Resolution report output format

### Hour 4: Composio Integration + Tool Wiring (60 min)

**Task 4.1: Composio Setup (20 min)**
- Install `composio-crewai`
- Configure Composio with:
  - Slack integration (send messages to channels)
  - GitHub integration (create issues, comment on issues)
- Create Composio tool wrappers for CrewAI agents

**Task 4.2: Wire Remediation Tools (20 min)**
- `trigger_retraining` → calls mlmonitoring API
- `rollback_model` → calls mlmonitoring API
- `send_slack_alert` → Composio Slack tool
- `create_github_issue` → Composio GitHub tool

**Task 4.3: Human Approval Gate (20 min)**
- Reuse agenticworkflow's confirmation gate pattern
- Approval webhook that pauses execution
- Streamlit UI button for approve/deny
- Timeout: 5 minutes → auto-escalate

### Hour 5: Orchestration & End-to-End Flow (60 min)

**Task 5.1: CrewAI Crew Definition (20 min)**
- Define the `AgentOpsCrew` with all 3 agents
- Task sequencing: Monitor → Investigator → Remediator
- Configure agent memory (shared context between agents)
- Error handling: if any agent fails, escalate to human

**Task 5.2: Main Orchestrator (20 min)**
- `src/orchestrator.py` — Entry point
- Mode 1: **Continuous monitoring** (polling loop)
- Mode 2: **On-demand investigation** (user triggers with a query)
- Mode 3: **Demo mode** (simulated alert → full resolution flow)

**Task 5.3: End-to-End Test (20 min)**
- Run the full flow: inject drift signal → Monitor detects → Investigator diagnoses → Remediator acts
- Fix integration issues
- Verify all partner tools are called

### Hour 6: Streamlit Dashboard + Demo Polish (60 min)

**Task 6.1: Dashboard UI (30 min)**
- Reuse ragsystem's Streamlit app as base
- Panels:
  - **Live Status**: Model health, data quality, pipeline status (from Snowflake)
  - **Alert Feed**: Real-time alerts with severity badges
  - **Investigation View**: RAG-powered diagnosis with source citations
  - **Action Log**: Actions taken/pending with approve/deny buttons
  - **Trace View**: Mermaid diagram of agent reasoning chain (from agenticworkflow tracing)

**Task 6.2: Demo Script & Video (30 min)**
- Write demo script with exact steps
- Seed the "drift event" trigger
- Record 3-minute demo video showing:
  1. Dashboard in healthy state
  2. Drift injected → alert appears
  3. Investigator finds root cause (show RAG citations)
  4. Remediator proposes actions
  5. Human approves retraining
  6. Model retrained and deployed
  7. Dashboard returns to healthy state
  8. Slack message and GitHub issue shown

---

## File Structure (New Code)

```
/Users/omatsone/Desktop/projectAI/agentops/
├── README.md
├── pyproject.toml
├── .env.example
├── docker-compose.yml
│
├── src/
│   ├── __init__.py
│   ├── orchestrator.py              # Main entry point, CrewAI crew runner
│   ├── config.py                    # Pydantic settings (all env vars)
│   │
│   ├── crew/                        # CrewAI definitions
│   │   ├── __init__.py
│   │   ├── agents.py                # Monitor, Investigator, Remediator agent defs
│   │   ├── tasks.py                 # CrewAI task definitions
│   │   └── crew.py                  # AgentOpsCrew assembly
│   │
│   ├── tools/                       # Custom CrewAI tools
│   │   ├── __init__.py
│   │   ├── snowflake_tools.py       # query_metrics, query_quality, query_history
│   │   ├── rag_tools.py             # search_runbooks, search_incidents
│   │   ├── mlops_tools.py           # trigger_retrain, rollback, check_health
│   │   └── composio_tools.py        # Slack, GitHub via Composio
│   │
│   ├── integrations/
│   │   ├── __init__.py
│   │   ├── snowflake_client.py      # Snowflake connector wrapper
│   │   ├── rag_client.py            # HTTP client to ragsystem API
│   │   ├── mlmonitoring_client.py   # HTTP client to mlmonitoring API
│   │   └── composio_client.py       # Composio integration
│   │
│   └── models/
│       ├── __init__.py
│       ├── alerts.py                # Alert, Diagnosis, Resolution schemas
│       └── approval.py              # ApprovalRequest, ApprovalResponse
│
├── runbooks/                        # Runbook documents (ingested into RAG)
│   ├── model_drift.md
│   ├── data_quality.md
│   ├── latency_spike.md
│   ├── retraining.md
│   ├── rollback.md
│   └── incident_response.md
│
├── incidents/                       # Historical incidents (ingested into RAG)
│   ├── inc_2026_0115_v14_drift.md
│   ├── inc_2026_0203_latency.md
│   └── ... (10-15 incident reports)
│
├── seed/                            # Snowflake seed data
│   ├── seed_model_metrics.sql
│   ├── seed_prediction_logs.sql
│   ├── seed_data_quality.sql
│   └── seed_incidents.sql
│
├── dashboard/
│   └── streamlit_app.py             # Main Streamlit dashboard
│
└── tests/
    ├── test_snowflake_tools.py
    ├── test_rag_tools.py
    ├── test_crew.py
    └── test_orchestrator.py
```

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent framework | CrewAI (not raw LangGraph) | Hackathon partner, simpler multi-agent setup, judges expect it |
| Data store | Snowflake (not just SQLite) | Hackathon partner, production-credible, SQL-queryable metrics |
| External actions | Composio (not raw API calls) | Hackathon partner, pre-built Slack/GitHub integrations |
| Knowledge base | Existing ragsystem (HTTP client) | Fully working RAG, no need to rebuild |
| ML monitoring | Existing mlmonitoring (HTTP client) | Fully working serving layer, just call APIs |
| Agent reasoning | Existing agenticworkflow patterns | Reuse confirmation gates, tracing, safety controls |
| LLM for agents | Llama 3 via Ollama (primary) | Hackathon is "Llama Lounge" — use Llama! |
| UI | Streamlit | Fast to build, already have examples in ragsystem |
| Demo strategy | Seeded scenario with real integrations | Reliable demo, all partner tools visibly used |

---

## Demo Script (3 minutes)

### Slide 1: "What is AgentOps?" (15 sec)
"AgentOps is an autonomous MLOps platform. When your ML models degrade in production, AgentOps detects it, diagnoses it, and fixes it — with human approval gates."

### Slide 2: Live Dashboard (15 sec)
Show Streamlit dashboard. Point out:
- Model health panel (green)
- Data quality panel (green)
- Empty alert feed

### Slide 3: Inject Drift (30 sec)
"Let's simulate what happens when upstream data changes cause model drift."
- Click "Simulate Drift" button (or show Snowflake data update)
- Monitor Agent detects drift within seconds
- Alert appears in feed: "CRITICAL: Model drift detected. Aggregate PSI: 0.45"

### Slide 4: Automated Investigation (45 sec)
"The Investigator Agent now searches our runbooks and historical incidents."
- Show RAG query happening in real-time
- Show citations: "According to runbook_model_drift.md Section 3.2..."
- Show diagnosis: "Root cause: Feature V14 distribution shifted. Similar to incident INC-2026-0115."
- Show recommended actions with priorities

### Slide 5: Remediation with Approval (45 sec)
"The Remediator Agent now acts on the diagnosis."
- Show Slack notification (auto-approved)
- Show GitHub issue created (auto-approved)
- Show retraining request with APPROVE button
- Click APPROVE → training starts
- Show training progress → model passes evaluation gate
- Show deployment request → Click APPROVE → blue-green swap

### Slide 6: Resolution (15 sec)
- Dashboard returns to green
- Slack update: "Drift resolved. Model v3 deployed."
- GitHub issue auto-closed
- Show trace diagram: full agent reasoning chain

### Slide 7: Architecture & Impact (15 sec)
"This took 8 minutes end-to-end, autonomously. A human would take 2-4 hours."
- Show architecture diagram
- Highlight: Snowflake, CrewAI, Composio, Llama 3
- "Built on three production-grade systems we've already developed."

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Snowflake connection issues during demo | Pre-cache query results as fallback |
| CrewAI agent takes too long | Set strict timeouts, use demo mode with pre-computed responses |
| Composio auth expires | Pre-authorize all integrations, test 30 min before demo |
| RAG returns irrelevant results | Pre-test all demo queries, tune runbook content |
| Model retraining takes too long for demo | Use a fast training run (1 epoch) for demo mode |
| Network issues at venue | Have offline fallback mode with cached responses |

---

## Success Criteria (Judging Alignment)

| Judging Criteria | How AgentOps Addresses It |
|-----------------|---------------------------|
| **Demo quality** | Live, end-to-end flow from detection → resolution. Real Snowflake queries, real Slack messages, real GitHub issues. |
| **Long-term potential** | This is a genuine product gap — no existing tool does autonomous MLOps with RAG-powered diagnosis. Enterprise customers would pay for this. |
| **Innovation** | Novel combination: multi-agent crew + RAG over operational knowledge + human-in-the-loop remediation. No one else is doing RAG-powered incident response for ML systems. |
| **Presentation** | Clear narrative arc: healthy → broken → diagnosed → fixed. Visceral "wow" moment when agent finds root cause and proposes fix. |
