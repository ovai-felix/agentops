"""CrewAI agent definitions for AgentOps."""
from crewai import Agent, LLM

from config import settings
from tools.snowflake_tools import (
    query_model_metrics,
    query_feature_drift,
    query_data_quality,
    query_metric_trend,
)
from tools.rag_tools import search_runbooks, search_incidents
from tools.mlops_tools import (
    check_model_health,
    trigger_retraining,
    check_training_status,
    rollback_model,
)

# Composio tools are optional — only load if COMPOSIO_API_KEY is set
try:
    from tools.composio_tools import get_composio_tools
    composio_tools = get_composio_tools()
except Exception:
    composio_tools = []

# Configure LLM based on available API keys
if settings.anthropic_api_key:
    _llm = LLM(model="anthropic/claude-sonnet-4-20250514", api_key=settings.anthropic_api_key)
elif settings.openai_api_key:
    _llm = LLM(model="openai/gpt-4o", api_key=settings.openai_api_key)
else:
    _llm = None  # CrewAI default

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
    llm=_llm,
    verbose=True,
    allow_delegation=False,
)

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
    llm=_llm,
    verbose=True,
    allow_delegation=False,
)

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
    llm=_llm,
    verbose=True,
    allow_delegation=False,
)
