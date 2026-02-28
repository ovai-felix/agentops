# Incident Report: INC-2026-0218

## Summary
An upstream system added a new field (`transaction_channel`) to the transaction payload, which broke the feature pipeline's strict schema validation and halted data ingestion for 45 minutes.

## Severity
P2

## Timeline
- 11:00 — Upstream system deployed v3.2 with new `transaction_channel` field
- 11:05 — Feature pipeline began receiving payloads with unexpected field
- 11:06 — Schema validation failed: "unexpected field: transaction_channel"
- 11:08 — Pipeline halted (strict mode: reject on schema violation)
- 11:15 — Monitoring agent detected: DATA_QUALITY showing 0 records processed in last 10 minutes
- 11:18 — Diagnostic agent identified schema validation errors in pipeline logs
- 11:20 — Slack alert sent to #data-alerts: "Feature pipeline halted — schema violation"
- 11:25 — Data engineering investigated: confirmed new field from upstream v3.2 release
- 11:30 — Decision: add `transaction_channel` to accepted schema, set pipeline to lenient mode temporarily
- 11:40 — Schema config updated, pipeline restarted
- 11:45 — Backlog of 45 minutes of transactions began processing
- 11:50 — Pipeline caught up, all quality checks passing
- 12:00 — Monitoring confirmed: metrics back to normal

## Root Cause
The upstream transaction processing system added a new field (`transaction_channel`: "web", "mobile", "pos", "atm") in their v3.2 release. This change was not communicated to the ML platform team in advance. The feature pipeline used strict schema validation that rejected any payload with unexpected fields, causing a complete ingestion halt.

## Resolution
1. Added `transaction_channel` to the accepted schema configuration.
2. Changed schema validation from strict (reject unknown fields) to lenient (log and ignore unknown fields).
3. Processed the 45-minute backlog of queued transactions.
4. Evaluated `transaction_channel` as a potential new feature (added to feature backlog).
5. Set up a schema change notification webhook with the upstream team.

## Lessons Learned
- Strict schema validation is too brittle for evolving upstream systems. Switched to lenient mode with alerts for unknown fields.
- Upstream teams must notify downstream consumers before schema changes (added to cross-team SLA).
- Added a schema compatibility check to upstream team's CI/CD pipeline.
- The new `transaction_channel` field was later evaluated and added as a useful feature for fraud detection (mobile vs. POS has different fraud patterns).

## Affected Components
- Feature pipeline (halted for 45 minutes)
- Transaction ingestion (45-minute data gap, fully recovered)
- Model predictions (stale features during gap, no accuracy impact due to caching)
