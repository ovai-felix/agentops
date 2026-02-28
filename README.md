# AgentOps — Autonomous MLOps Platform

> From alert to resolution in minutes, not hours.

AgentOps is an autonomous MLOps platform that detects model degradation in production, diagnoses root causes using internal knowledge bases, and remediates issues — all with human approval gates for high-risk actions.

Built for the [Llama Lounge Agentic Hackathon](https://cerebralvalley.ai/e/llama-lounge-agentic-hackathon/details) (Feb 28, 2026).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Streamlit Dashboard                    │
│  Status │ Alerts │ Investigation │ Actions │ Crew Output │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              CrewAI Multi-Agent Orchestration            │
│                                                         │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │ Monitor  │──▶│ Investigator │──▶│ Remediator   │   │
│  │  Agent   │   │    Agent     │   │    Agent     │   │
│  └────┬─────┘   └──────┬──────┘   └──────┬───────┘   │
│       │                │                  │            │
└───────┼────────────────┼──────────────────┼────────────┘
        │                │                  │
   ┌────▼────┐    ┌──────▼──────┐   ┌──────▼───────┐
   │Snowflake│    │ RAG System  │   │ML Monitoring │
   │ Metrics │    │  Runbooks   │   │  Retrain /   │
   │ & Drift │    │ & Incidents │   │  Rollback    │
   └─────────┘    └─────────────┘   └──────────────┘
                                    ┌──────────────┐
                                    │  Composio    │
                                    │ Slack+GitHub │
                                    └──────────────┘
```

### Three Agents, One Pipeline

| Agent | Role | Tools |
|-------|------|-------|
| **Monitor** | Queries Snowflake for model metrics, feature drift, and data quality. Raises alerts when thresholds are breached. | Snowflake queries, ML Monitoring health checks |
| **Investigator** | Searches operational runbooks and past incident reports via RAG to diagnose root causes and recommend actions. | RAG search (runbooks + incidents) |
| **Remediator** | Executes remediation: notifies teams via Slack, creates GitHub issues, triggers retraining, or rolls back models — with human approval for high-risk actions. | Composio (Slack, GitHub), ML Monitoring (retrain/rollback) |

## Partner Integrations

| Partner | Usage |
|---------|-------|
| **Snowflake** | Stores and serves production model metrics, feature drift scores, data quality stats, and historical incidents |
| **CrewAI** | Orchestrates the 3-agent pipeline with sequential task delegation and context passing |
| **Composio** | Provides authenticated Slack and GitHub tool integrations for the Remediator agent |

## Demo Scenario

A fraud detection model experiences feature drift on V14 and V17 due to a vendor API change:

- **F1 Score** drops from 0.91 → 0.82
- **Drift Score** spikes from 0.08 → 0.45
- The crew detects, diagnoses (finding a matching past incident), and remediates with human approval

## Setup

### Prerequisites

- Python 3.11+
- Snowflake account with credentials
- Running instances of [RAG System](../ragsystem) and [ML Monitoring](../mlmonitoring)
- Composio API key (for Slack/GitHub integrations)

### Install

```bash
cd agentops
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

### Configure

```bash
cp .env.example .env
# Edit .env with your Snowflake credentials, API keys, etc.
```

### Seed Snowflake

```bash
python seed/setup_snowflake.py    # Creates tables + seeds 7 days of data
python scripts/ingest_docs.py     # Ingests runbooks + incidents into RAG
```

### Run

**Dashboard (interactive demo):**
```bash
bash dashboard/run_dashboard.sh   # Opens at http://localhost:8502
```

**CLI (autonomous crew):**
```bash
bash run_demo.sh                  # Runs full Monitor → Investigate → Remediate pipeline
```

**Monitor mode (continuous polling):**
```bash
source .venv/bin/activate
python src/orchestrator.py --mode monitor --interval 30
```

### Reset Demo

```bash
bash scripts/reset_demo.sh        # Resets Snowflake data + kills services
```

## Project Structure

```
agentops/
├── dashboard/
│   └── streamlit_app.py          # 5-tab Streamlit dashboard
├── incidents/                    # 8 historical incident reports
├── runbooks/                     # 6 operational runbooks
├── seed/
│   ├── setup_snowflake.py        # Table creation + data seeding
│   └── reset_demo.py             # Demo state reset
├── scripts/
│   ├── ingest_docs.py            # RAG document ingestion
│   └── reset_demo.sh             # Full demo reset script
├── src/
│   ├── config.py                 # Pydantic Settings configuration
│   ├── orchestrator.py           # CLI entry point (demo/monitor/investigate)
│   ├── crew/
│   │   ├── agents.py             # 3 CrewAI agent definitions
│   │   ├── tasks.py              # Task factories with context chaining
│   │   └── crew.py               # AgentOpsCrew orchestration class
│   ├── integrations/
│   │   ├── snowflake_client.py   # Snowflake query client
│   │   ├── rag_client.py         # RAG system HTTP client
│   │   ├── mlmonitoring_client.py # ML Monitoring API client
│   │   └── composio_client.py    # Composio tool loader
│   ├── models/
│   │   ├── alerts.py             # Alert, Diagnosis, Resolution schemas
│   │   └── approval.py           # ApprovalRequest/Response schemas
│   └── tools/
│       ├── snowflake_tools.py    # CrewAI tools for Snowflake queries
│       ├── rag_tools.py          # CrewAI tools for RAG search
│       ├── mlops_tools.py        # CrewAI tools for ML operations
│       └── composio_tools.py     # CrewAI tools for Slack/GitHub
└── pyproject.toml
```

## Tech Stack

- **Agents:** CrewAI + Claude/GPT-4o
- **Data:** Snowflake
- **Knowledge:** RAG (hybrid retrieval with vector + BM25 + cross-encoder reranking)
- **Integrations:** Composio (Slack, GitHub)
- **ML Platform:** FastAPI with blue-green deployment
- **Dashboard:** Streamlit
- **Language:** Python 3.11+

## Team

Built at the Llama Lounge Agentic Hackathon, February 2026.
