# Runbook: Model Rollback Procedures

## Overview

Model rollback reverts the production model to the previous version. The mlmonitoring service uses a blue-green deployment strategy where the previous model is always kept in a standby slot, enabling instant rollback without reloading from storage.

## When to Rollback

| Trigger | Threshold | Urgency |
|---------|-----------|---------|
| Accuracy drop post-deploy | F1 drop > 0.05 within 30 min of deploy | Immediate |
| Latency spike post-deploy | p99 > 2s within 30 min of deploy | Immediate |
| Error rate increase | Error rate > 5% | Immediate |
| Anomaly rate spike | > 3x baseline anomaly rate | Investigate first |
| Manual decision | Team judgment | Varies |

## Rollback Procedure

### Step 1: Confirm rollback is needed

```sql
-- Check recent model metrics
SELECT timestamp, f1_score, latency_p99_ms, drift_score
FROM MODEL_METRICS
WHERE model_name = '<model>'
  AND timestamp >= DATEADD(hour, -1, CURRENT_TIMESTAMP())
ORDER BY timestamp DESC
LIMIT 10;
```

Compare with baseline (previous 24h average):
```sql
SELECT AVG(f1_score) AS avg_f1, AVG(latency_p99_ms) AS avg_p99
FROM MODEL_METRICS
WHERE model_name = '<model>'
  AND timestamp BETWEEN DATEADD(day, -1, CURRENT_TIMESTAMP())
                     AND DATEADD(hour, -1, CURRENT_TIMESTAMP());
```

### Step 2: Execute rollback

```
POST /model/rollback
```

Expected response:
```json
{
    "status": "success",
    "previous_version": "v2.1",
    "rolled_back_to": "v2.0",
    "timestamp": "2026-02-28T12:00:00Z"
}
```

### Step 3: Verify health

```
GET /health    → 200 OK
GET /ready     → 200 OK (model loaded)
GET /model/info → verify version matches rolled-back version
```

### Step 4: Verify performance recovery

Wait 5 minutes, then check:
```sql
SELECT timestamp, f1_score, latency_p99_ms
FROM MODEL_METRICS
WHERE model_name = '<model>'
  AND timestamp >= DATEADD(minute, -5, CURRENT_TIMESTAMP())
ORDER BY timestamp DESC;
```

F1 and latency should return to pre-deployment levels.

### Step 5: Monitor for 30 minutes

Continue watching metrics for 30 minutes to confirm stability:
- F1 score stable within 0.02 of baseline.
- Latency p99 within normal range (< 1s).
- No error rate increases.

## Blue-Green Mechanism

The mlmonitoring service maintains two model slots:

| Slot | State | Purpose |
|------|-------|---------|
| Active | Serving predictions | Current production model |
| Standby | Loaded but idle | Previous model version |

- **Deploy** (`POST /model/reload`): Swaps active ↔ standby.
- **Rollback** (`POST /model/rollback`): Swaps active ↔ standby (same mechanism).
- The standby model is always warm (loaded in memory), so rollback is instant.

## Post-Rollback Actions

1. **Create incident report**: Document what happened, why rollback was needed.
   ```sql
   INSERT INTO INCIDENTS (incident_id, alert_type, severity, affected_component,
                          root_cause, resolution, status)
   VALUES ('<inc_id>', '<type>', '<severity>', '<component>',
           '<root_cause>', 'Rolled back to previous version', 'resolved');
   ```

2. **Notify team**: Post rollback summary to Slack `#ml-alerts`.

3. **Schedule investigation**: Create GitHub issue to investigate why the new model failed.

4. **Plan retraining**: After root cause is understood, retrain with corrected approach.

## If Rollback Fails

1. Check service health: `GET /health`.
2. If service is down, restart the mlmonitoring service.
3. If standby model is corrupted, reload from model artifact storage.
4. Escalate to platform engineering if infrastructure issues.

## Related Runbooks

- [Retraining Runbook](retraining.md) — to retrain after rollback
- [Latency Spike Runbook](latency_spike.md) — latency may trigger rollback
- [Incident Response Runbook](incident_response.md) — post-rollback incident management
