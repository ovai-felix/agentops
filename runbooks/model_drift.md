# Runbook: Model Drift Detection & Response

## Overview

Model drift occurs when the statistical properties of input data or the relationship between inputs and outputs change over time, degrading model performance. This runbook covers both **data drift** (input distribution shift) and **concept drift** (target relationship change).

## Drift Metrics & Thresholds

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| PSI (Population Stability Index) | < 0.1 | 0.2 – 0.3 | > 0.3 |
| KS Statistic | < 0.05 | 0.05 – 0.1 | > 0.1 |
| Mean Shift (std deviations) | < 0.5 | 0.5 – 1.0 | > 1.0 |

**Aggregate drift score** is the weighted average PSI across all features. The monitoring agent checks this every `monitor_poll_interval_sec` (default 30s).

## Per-Feature Investigation Steps

When aggregate drift exceeds the warning threshold:

1. **Query per-feature drift scores** from the `FEATURE_DRIFT` table:
   ```sql
   SELECT feature_name, psi_score, ks_statistic, mean_shift, std_shift
   FROM FEATURE_DRIFT
   WHERE model_name = '<model>'
     AND timestamp >= DATEADD(hour, -2, CURRENT_TIMESTAMP())
   ORDER BY psi_score DESC;
   ```

2. **Identify top drifting features** — typically V1–V28 (PCA components), Time, or Amount.

3. **Check feature correlations** — if multiple correlated features drift together (e.g., V14 and V17), suspect a single upstream cause.

4. **Compare distributions** — pull recent vs. baseline histograms for the drifting features.

## Common Causes

| Cause | Typical Pattern | Features Affected |
|-------|----------------|-------------------|
| Upstream schema change | Sudden spike in 1–2 features | Specific V-features |
| Seasonal patterns | Gradual shift in Amount, Time | Amount, Time |
| Data source outage | Nulls or zeros in multiple features | Multiple |
| Vendor API format change | Sudden shift in specific features | V14, V17 (example) |
| Population shift | Gradual drift across many features | Many |

## Remediation Decision Tree

```
Drift detected
├── PSI < 0.3 (Warning)
│   ├── Monitor for 24 hours
│   ├── Check if seasonal or transient
│   └── If persists → escalate to Critical
│
├── PSI >= 0.3 AND accuracy stable (F1 within 0.02 of baseline)
│   ├── Retrain with recent data (include drifted distribution)
│   ├── Use /training/trigger endpoint
│   ├── Validate new model meets evaluation gate
│   └── Deploy via blue-green swap
│
└── PSI >= 0.3 AND accuracy dropping (F1 drop > 0.05)
    ├── IMMEDIATE: Rollback to previous model version
    ├── POST /model/rollback → verify /health
    ├── Investigate root cause (data issue vs. concept drift)
    ├── Retrain with corrected/new data
    └── Deploy only after evaluation gate passes
```

## Escalation

- **Warning level**: Post to Slack `#ml-alerts` with drift summary and affected features.
- **Critical level**: Post to Slack `#ml-alerts` AND `#data-alerts`. Tag on-call data engineer.
- **If automated remediation fails**: Create GitHub issue with full diagnostics, notify team lead.

## Related Runbooks

- [Retraining Runbook](retraining.md) — for model retraining procedures
- [Rollback Runbook](rollback.md) — for model rollback procedures
- [Data Quality Runbook](data_quality.md) — to rule out data quality as root cause
