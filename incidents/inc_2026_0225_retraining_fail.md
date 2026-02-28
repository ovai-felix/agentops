# Incident Report: INC-2026-0225

## Summary
Automated retraining produced a significantly worse model (F1 = 0.65 vs. production 0.91) due to severe class imbalance in the training dataset. The evaluation gate correctly blocked promotion to production.

## Severity
P3

## Timeline
- 02:00 — Scheduled weekly retraining triggered
- 02:05 — Training data pulled: 50,000 records from last 2 weeks
- 03:15 — Training completed. Model F1 on validation set = 0.65
- 03:17 — Evaluation gate check: 0.65 < (0.91 - 0.01) = 0.90. **BLOCKED.**
- 03:18 — Slack notification: "Retraining failed evaluation gate. New model F1=0.65, required >= 0.90"
- 03:20 — Model artifact saved for investigation but NOT promoted
- 08:00 — ML engineer investigated training data
- 08:30 — Root cause identified: training data had 0.05% fraud rate (normal ~1.8%) due to post-holiday transaction mix
- 09:00 — Retraining triggered with class weight adjustment (fraud_weight=36x)
- 10:00 — New model F1 = 0.92 on validation set
- 10:02 — Evaluation gate passed. Deployed via blue-green swap
- 10:30 — Metrics confirmed stable: F1 = 0.92 on live traffic

## Root Cause
The 2-week training window (Feb 11–25) captured a period of unusually low fraud activity following the Valentine's Day promotional event. The fraud rate in the training data dropped to 0.05% (vs. typical 1.8%), creating a severe class imbalance. The model learned to predict "not fraud" for almost everything, achieving high accuracy (99.95%) but very low F1 on the minority class (0.65).

Contributing factor: the training pipeline used a fixed 2-week window without adjusting for class balance. No minimum fraud-rate check existed in the data validation step.

## Resolution
1. The evaluation gate correctly prevented the bad model from reaching production (system worked as designed).
2. Retrained with class weight adjustment: `fraud_weight = 1/fraud_rate ≈ 36x`.
3. Added pre-training data validation:
   - Minimum fraud rate check: training data must have >= 0.5% fraud rate.
   - If below threshold, extend training window or apply oversampling (SMOTE).
4. Added class distribution logging to training metadata.

## Lessons Learned
- The evaluation gate saved us from a production incident — validates the importance of relative thresholds.
- Training data quality checks should include class distribution validation, not just null rates and schema checks.
- Post-holiday periods may have unusual fraud distributions — the training pipeline should adapt.
- Added configurable class weight strategy: "auto" (sklearn's balanced), "fixed" (manual), or "smote" (synthetic oversampling).
- This was a P3 because the system correctly prevented impact — the evaluation gate and monitoring worked as designed.

## Affected Components
- Training pipeline (produced bad model, correctly blocked)
- No production impact (evaluation gate prevented deployment)
- ML engineer time (investigation and manual retraining)
