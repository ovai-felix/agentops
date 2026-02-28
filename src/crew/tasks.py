"""CrewAI task factories for AgentOps."""
from crewai import Task

from crew.agents import monitor_agent, investigator_agent, remediator_agent


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
