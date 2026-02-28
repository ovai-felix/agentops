# Incident Report: INC-2026-0120

## Summary
A 15% null rate spike in the Amount field was caused by an upstream ETL timezone conversion bug introduced during a routine maintenance window.

## Severity
P1

## Timeline
- 06:00 — Upstream ETL maintenance window began (scheduled)
- 06:15 — ETL resumed with updated timezone handling code
- 06:45 — Monitoring agent detected null rate 8% in Amount field (warning)
- 06:48 — Diagnostic agent queried DATA_QUALITY table, confirmed escalating null trend
- 06:52 — Null rate reached 15% (critical threshold)
- 06:55 — Slack alert sent to #data-alerts and #ml-alerts
- 07:00 — Data engineering team identified timezone conversion producing null timestamps, which cascaded to null Amount values in the join
- 07:15 — ETL hotfix deployed: corrected timezone conversion logic
- 07:20 — Affected batches quarantined (06:15–07:15 window)
- 07:30 — Pipeline rerun with corrected ETL
- 07:45 — Data quality checks passed (null rate < 1%)
- 08:00 — Model metrics verified stable (no accuracy impact due to quick quarantine)

## Root Cause
During scheduled ETL maintenance, a code change to the timezone conversion logic introduced a bug where UTC+0 timestamps were converted to null instead of being passed through. Since the Amount field was derived from a JOIN using the timestamp key, null timestamps caused null Amount values in the joined output. The bug affected approximately 12,000 records over the 1-hour window.

## Resolution
1. ETL hotfix deployed to correct timezone conversion (UTC+0 now handled correctly).
2. Affected batch (06:15–07:15) quarantined and reprocessed.
3. Added unit tests for all timezone edge cases in the ETL code.
4. Added pre-deploy validation step for ETL changes that runs sample data through the pipeline.

## Lessons Learned
- ETL changes should be validated with sample data before deployment, even during maintenance windows.
- The cascade from null timestamps to null Amount was not covered by existing integration tests.
- Added a circuit breaker: if null rate exceeds 10% for 10 minutes, auto-halt ingestion.
- Quick quarantine prevented model accuracy degradation — this pattern should be documented as a best practice.

## Affected Components
- Upstream ETL (timezone conversion)
- Transaction ingestion pipeline
- Amount feature (15% nulls for ~1 hour)
- Model accuracy (not affected due to quick quarantine)
