# Runbook: Incident Response Procedures

## Overview

This runbook defines the incident response lifecycle for the AgentOps platform, covering severity classification, response times, communication, and post-mortem procedures.

## Severity Levels

| Severity | Definition | Examples |
|----------|-----------|----------|
| **P1 — Critical** | Model serving impaired, fraud detection compromised | Accuracy F1 < 0.70, service down, error rate > 10% |
| **P2 — Warning** | Degraded performance, action needed within hours | Drift PSI > 0.3, latency p99 > 2s, null rate > 10% |
| **P3 — Info** | Notable event, no immediate action required | Drift PSI 0.2–0.3, minor latency increase, scheduled retraining |

## Response Time SLAs

| Severity | Detection → Triage | Triage → Investigation | Investigation → Resolution |
|----------|-------------------|----------------------|---------------------------|
| P1 | < 5 min (automated) | < 10 min | < 2 hours |
| P2 | < 15 min (automated) | < 30 min | < 8 hours |
| P3 | < 1 hour | < 4 hours | < 24 hours |

## Incident Lifecycle

### 1. Detection

Automated detection by the Monitoring Agent:
- Checks MODEL_METRICS, DATA_QUALITY, FEATURE_DRIFT tables.
- Compares against configured thresholds.
- Generates an Alert object with severity, type, and affected component.

### 2. Triage

The Diagnostic Agent performs triage:
- Queries relevant metrics tables for detailed investigation.
- Consults runbooks via RAG system for context.
- Searches historical incidents for similar patterns.
- Produces a Diagnosis with root cause, confidence, and recommended actions.

### 3. Investigation

Based on the diagnosis, the agent:
- Gathers additional evidence (per-feature drift, data quality details).
- Correlates with recent changes (deployments, data pipeline runs).
- Identifies the specific root cause.

### 4. Remediation

The Action Agent executes the remediation plan:
- **Automated actions** (no approval needed): Slack notifications, metric logging.
- **Approval-required actions**: Model rollback, retraining, infrastructure changes.
- Executes actions sequentially based on priority.
- Logs each action result.

### 5. Post-Mortem

After resolution:
- Generate incident report with timeline, root cause, and resolution.
- Log in INCIDENTS table.
- Identify preventive measures.
- Update runbooks if new patterns discovered.

## Communication Channels

| Channel | When | Audience |
|---------|------|----------|
| Slack `#ml-alerts` | All P1/P2 alerts, resolutions | ML team |
| Slack `#data-alerts` | Data quality issues | Data engineering |
| GitHub Issues | Post-incident tracking | Full team |
| Email | P1 escalations, stakeholder updates | Management |

### Slack Message Format

**Alert:**
```
🚨 [P1] Model Drift Critical — classifier_v2
Drift score: 0.45 (threshold: 0.3)
Top features: V14 (PSI=0.8), V17 (PSI=0.6)
Investigating automatically...
```

**Resolution:**
```
✅ [Resolved] Model Drift — classifier_v2
Root cause: Vendor API format change affecting V14
Resolution: Retrained model with updated feature pipeline
Time to resolve: 45 minutes
```

## Post-Mortem Template

```markdown
# Post-Mortem: INC-YYYY-MMDD

## What Happened
Brief description of the incident and its impact.

## Root Cause
Detailed technical explanation of why the incident occurred.

## Timeline
- HH:MM — Alert triggered (detection)
- HH:MM — Agent began investigation (triage)
- HH:MM — Root cause identified (investigation)
- HH:MM — Remediation started (action)
- HH:MM — Service restored (resolution)
- HH:MM — Post-mortem completed

## Impact
- Duration: X minutes
- Affected systems: list
- User impact: description

## Lessons Learned
1. What went well
2. What could be improved
3. Action items with owners and deadlines

## Preventive Measures
- Changes to monitoring/alerting
- Changes to runbooks
- Infrastructure improvements
```

## Escalation Matrix

| Condition | Escalate To |
|-----------|-------------|
| Automated remediation fails | ML Team Lead (Slack DM) |
| P1 unresolved > 1 hour | Engineering Manager |
| Data issue from upstream | Data Engineering Team Lead |
| Infrastructure issue | Platform Engineering |
| Security concern (adversarial) | Security Team |

## Related Runbooks

- [Model Drift Runbook](model_drift.md)
- [Data Quality Runbook](data_quality.md)
- [Latency Spike Runbook](latency_spike.md)
- [Retraining Runbook](retraining.md)
- [Rollback Runbook](rollback.md)
