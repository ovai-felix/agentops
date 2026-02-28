# Incident Report: INC-2026-0215

## Summary
False positive rate spiked 300% on Valentine's Day due to unusual but legitimate shopping patterns (high-value gift purchases, international transactions). The model lacked temporal features to account for seasonal purchasing behavior.

## Severity
P2

## Timeline
- 10:00 — Valentine's Day transaction volume began increasing (expected)
- 12:30 — Monitoring agent detected anomaly rate 8% (baseline: 2%)
- 12:33 — Diagnostic agent investigation: checked drift scores (normal), data quality (normal)
- 12:40 — Analysis revealed: high-value transactions ($200–$500 range) being flagged as fraud at 3x normal rate
- 12:45 — Manual review of flagged transactions: 92% were legitimate gift purchases
- 13:00 — RAG consultation found no matching runbook (novel pattern)
- 13:15 — Team decision: temporarily increase fraud threshold for Amount-based rules
- 13:20 — Threshold adjustment applied (reduced false positives by 60%)
- 13:30 — Slack notification: temporary threshold adjustment in effect
- 18:00 — Transaction patterns returned to near-normal as Valentine's Day rush subsided
- 19:00 — Thresholds reverted to standard values
- Next week — Temporal features (day-of-week, holiday flag, seasonal indicator) added to feature pipeline

## Root Cause
The fraud detection model was trained primarily on non-holiday transaction patterns. Valentine's Day introduced a significant shift in legitimate transaction behavior:
- 3x increase in gift card purchases ($100–$500)
- 2x increase in international flower delivery orders
- Unusual merchant categories (jewelry, premium restaurants) at higher frequency

These patterns closely resembled known fraud patterns (high-value, unusual merchants, international), causing the model to flag legitimate transactions. The model had no temporal awareness to recognize seasonal patterns.

## Resolution
1. Short-term: Temporarily adjusted fraud scoring threshold for the Amount-based feature.
2. Medium-term: Added temporal features to the feature pipeline:
   - `day_of_week` (0–6)
   - `is_holiday` (boolean, based on US holiday calendar)
   - `seasonal_indicator` (categorical: normal, valentines, black_friday, christmas, etc.)
3. Retrained model with temporal features. New model showed 45% reduction in holiday false positives while maintaining fraud detection recall.

## Lessons Learned
- Seasonal patterns must be explicitly modeled — the model cannot learn them from non-seasonal training data alone.
- Created a "known seasonal events" calendar that adjusts alerting thresholds proactively.
- Added false positive rate monitoring (previously only tracked false negatives/recall).
- This incident type is now documented in the model drift runbook under "seasonal patterns."

## Affected Components
- classifier_v2 model (false positive rate 3x baseline for ~6 hours)
- Fraud review team (received 3x normal alert volume)
- Customer experience (legitimate transactions delayed by fraud review)
