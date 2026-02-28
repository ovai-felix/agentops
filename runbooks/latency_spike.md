# Runbook: Latency Spike Detection & Response

## Overview

Prediction latency directly impacts fraud detection effectiveness. High latency can cause transaction timeouts, degraded user experience, and missed fraud in real-time scoring. This runbook covers latency baselines, investigation, and remediation.

## Latency Baselines

| Percentile | Normal | Warning | Critical |
|------------|--------|---------|----------|
| p50 | < 100ms | 100 – 200ms | > 200ms |
| p95 | < 500ms | 500ms – 1s | > 1s |
| p99 | < 1s | 1s – 2s | > 2s |

**Monitoring query:**
```sql
SELECT timestamp, model_name,
       latency_p50_ms, latency_p95_ms, latency_p99_ms,
       prediction_count
FROM MODEL_METRICS
WHERE timestamp >= DATEADD(hour, -6, CURRENT_TIMESTAMP())
ORDER BY timestamp DESC;
```

## Investigation Steps

### Step 1: Identify when the spike started

```sql
SELECT timestamp, latency_p99_ms, prediction_count
FROM MODEL_METRICS
WHERE model_name = '<model>'
  AND timestamp >= DATEADD(hour, -24, CURRENT_TIMESTAMP())
ORDER BY timestamp ASC;
```

Look for the inflection point where latency jumped.

### Step 2: Correlate with events

Check if the spike correlates with:
- **Model deployment** — was a new model version deployed recently?
- **Traffic spike** — did `prediction_count` increase significantly?
- **Resource changes** — infrastructure scaling events?

### Step 3: Check model serving health

```
GET /health → should return 200
GET /ready → should return 200
GET /model/info → check model version and size
GET /metrics → check Prometheus metrics for resource usage
```

### Step 4: Check batch queue depth

If batch prediction is enabled, check if the queue is backing up:
```
GET /metrics | grep batch_queue_size
```

## Common Causes

| Cause | Pattern | Resolution |
|-------|---------|------------|
| Model too complex | Spike after deployment, consistent high latency | Rollback, optimize model (pruning, quantization) |
| Feature pipeline slow | Intermittent spikes, correlates with feature computation | Optimize feature engineering, add caching |
| Resource contention | Gradual increase, correlates with traffic | Scale horizontally, increase resource allocation |
| Batch queue backlog | Growing queue, increasing p99 | Increase batch workers, optimize batch size |
| Memory pressure | Latency + OOM events | Increase memory, optimize model memory footprint |
| Network issues | Intermittent, affects all services | Check network, DNS, load balancer |

## Remediation

### Immediate (Critical Level)

1. **Check if recent deployment** caused the spike:
   - If yes → `POST /model/rollback` to previous version.
   - Verify latency returns to normal within 5 minutes.

2. **If not deployment-related**:
   - Check resource utilization via `/metrics`.
   - Scale resources if utilization > 80%.
   - Enable request queuing/throttling if needed.

### Short-term (Warning Level)

1. Monitor for 30 minutes to see if the spike is transient.
2. If persistent:
   - Profile the model inference path.
   - Check feature computation latency.
   - Review recent changes to input data volume.

### Long-term

1. **Model optimization**: Pruning, quantization, distillation.
2. **Infrastructure**: Auto-scaling policies, dedicated inference instances.
3. **Architecture**: Async prediction for non-critical paths, caching for repeated inputs.
4. **Monitoring**: Add alerting for p95 > 500ms to catch issues earlier.

## Post-Incident

- Record the incident with root cause and resolution time.
- Update latency baselines if new normal is established.
- Add regression tests for latency-sensitive paths.

## Related Runbooks

- [Rollback Runbook](rollback.md) — for model rollback procedures
- [Incident Response Runbook](incident_response.md) — for escalation procedures
