# Incident Report: INC-2026-0210

## Summary
Model F1 score dropped from 0.91 to 0.78 after an automated retraining cycle ingested corrupted training data from a pipeline outage window, producing a degraded model that passed a misconfigured evaluation gate.

## Severity
P1

## Timeline
- 02:00 — Scheduled weekly retraining triggered
- 02:05 — Training data pulled from Snowflake (included data from 02/08 pipeline outage window)
- 03:30 — Training completed. New model F1 = 0.82 on validation set
- 03:32 — Evaluation gate passed (gate was checking F1 >= 0.80, should have been >= production - 0.01)
- 03:35 — Blue-green deployment executed automatically
- 04:00 — Monitoring agent detected F1 = 0.78 on live traffic (critical: > 0.05 drop)
- 04:02 — Diagnostic agent investigation: compared training data distribution vs. production
- 04:08 — Identified corrupted data from 02/08 pipeline outage (2,300 records with incorrect labels)
- 04:10 — Rollback approved and executed
- 04:12 — F1 recovered to 0.91 (previous model restored)
- 04:15 — Slack alert: rollback complete, investigation ongoing
- 06:00 — Corrupted records identified and quarantined
- 08:00 — Retraining triggered on clean dataset
- 09:00 — New model F1 = 0.92, passed corrected evaluation gate, deployed successfully

## Root Cause
Two contributing factors:
1. **Corrupted training data**: During a brief pipeline outage on 02/08, approximately 2,300 transactions were ingested with incorrect fraud labels (legitimate transactions labeled as fraud). This corrupted data was included in the training dataset.
2. **Misconfigured evaluation gate**: The gate threshold was set to F1 >= 0.80 (absolute) instead of F1 >= production_F1 - 0.01 (relative). The corrupted model's F1 of 0.82 passed the absolute check but represented a significant regression from the production model's 0.91.

## Resolution
1. Immediate: Rolled back to previous model (F1 0.91).
2. Quarantined the 2,300 corrupted records from 02/08.
3. Fixed evaluation gate to use relative threshold: new_F1 >= production_F1 - 0.01.
4. Retrained on clean data, achieving F1 = 0.92.
5. Added data provenance tracking: training data now excludes records from known outage windows.

## Lessons Learned
- Evaluation gate must compare against production model, not an absolute threshold.
- Training data pipeline should automatically exclude records from known outage/incident windows.
- Added a "training data quality check" step before retraining that validates label distribution.
- The 2-hour gap between deployment and detection was too long — tightened monitoring interval for post-deploy period to 5 minutes.

## Affected Components
- classifier_v2 model (replaced with degraded version for ~40 minutes)
- Fraud detection accuracy (F1 dropped to 0.78, approximately 13% more false negatives)
- Evaluation gate configuration
- Training data pipeline
