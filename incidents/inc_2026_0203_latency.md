# Incident Report: INC-2026-0203

## Summary
p99 prediction latency spiked to 3.2 seconds after deploying a larger model architecture (classifier_v3), exceeding the 2-second critical threshold. Resolved by rolling back to classifier_v2 and subsequently deploying a pruned version.

## Severity
P1

## Timeline
- 14:00 — classifier_v3 deployed via blue-green swap (new architecture with additional layers)
- 14:05 — Initial metrics looked good: F1 = 0.93 (improvement over v2's 0.91)
- 14:15 — Monitoring agent detected p95 = 1.2s (warning)
- 14:18 — p99 hit 2.5s, prediction queue starting to back up
- 14:20 — p99 reached 3.2s (critical). Monitoring agent triggered diagnostic investigation
- 14:22 — Diagnostic agent identified: model size 3x larger than v2, inference time increased proportionally
- 14:25 — Rollback recommended and approved
- 14:26 — POST /model/rollback executed. classifier_v2 restored from standby slot
- 14:28 — Health check passed. Latency returned to normal (p99 = 180ms)
- 14:30 — Slack notification sent: rollback complete
- Next day — Pruned v3 model created (30% parameter reduction), latency p99 = 450ms, F1 = 0.92
- Next day — Pruned v3 deployed successfully

## Root Cause
The classifier_v3 model used a deeper architecture (6 layers vs. v2's 3 layers) to achieve better accuracy. While the model performed well in offline evaluation, the inference latency was not tested under production load. The 3x increase in model parameters caused inference time to exceed SLA thresholds, especially under concurrent request load.

## Resolution
1. Immediate: Rolled back to classifier_v2 (total downtime: ~12 minutes of degraded latency).
2. Follow-up: Applied model pruning to v3, reducing parameters by 30% while retaining F1 = 0.92.
3. Added latency benchmarking to the model evaluation gate (must pass p99 < 1s under simulated load).
4. Deployed pruned v3 after passing all gates including latency.

## Lessons Learned
- Model evaluation gate must include latency testing under realistic load, not just accuracy metrics.
- Added automated load test step to the deployment pipeline: 1000 concurrent requests, p99 must be < 1s.
- The blue-green rollback mechanism worked flawlessly — total recovery time was 2 minutes.
- Model size/complexity should be tracked as a deployment metric.

## Affected Components
- Prediction API (degraded latency for ~12 minutes)
- Transaction scoring (delayed but no missed transactions)
- classifier_v3 model (rolled back, later replaced with pruned version)
