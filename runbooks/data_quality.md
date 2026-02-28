# Runbook: Data Quality Monitoring & Response

## Overview

Data quality issues in the feature pipeline can cause model performance degradation, false alerts, or silent failures. This runbook covers validation checks, investigation steps, and remediation for common data quality problems.

## Validation Checks

| Check | Normal | Warning | Critical |
|-------|--------|---------|----------|
| Null rate (per column) | < 1% | 5% – 10% | > 10% |
| Schema violations | 0 | 1 – 5 per batch | > 5 per batch |
| Out-of-range values | < 0.1% | 0.1% – 1% | > 1% |
| Record count deviation | Within 10% of expected | 10% – 30% | > 30% drop |
| Duplicate rate | < 0.01% | 0.01% – 0.1% | > 0.1% |

## Investigation Steps

### Step 1: Identify the scope

```sql
SELECT pipeline_name, timestamp, null_rate, schema_violations,
       out_of_range_count, records_processed, records_invalid, status
FROM DATA_QUALITY
WHERE timestamp >= DATEADD(hour, -6, CURRENT_TIMESTAMP())
ORDER BY timestamp DESC;
```

### Step 2: Check null rates per feature

```sql
SELECT feature_name,
       COUNT(*) AS total_records,
       SUM(CASE WHEN value IS NULL THEN 1 ELSE 0 END) AS null_count,
       ROUND(null_count / total_records * 100, 2) AS null_pct
FROM FEATURE_VALUES
WHERE ingestion_timestamp >= DATEADD(hour, -6, CURRENT_TIMESTAMP())
GROUP BY feature_name
HAVING null_pct > 1
ORDER BY null_pct DESC;
```

### Step 3: Check for schema mismatches

```sql
SELECT timestamp, pipeline_name, schema_violations, status
FROM DATA_QUALITY
WHERE schema_violations > 0
  AND timestamp >= DATEADD(day, -1, CURRENT_TIMESTAMP())
ORDER BY timestamp DESC;
```

### Step 4: Check for out-of-range values

```sql
-- Amount should be positive and < $50,000 for fraud detection
SELECT COUNT(*) AS out_of_range
FROM TRANSACTIONS
WHERE Amount < 0 OR Amount > 50000
  AND ingestion_timestamp >= DATEADD(hour, -6, CURRENT_TIMESTAMP());
```

## Common Causes

| Cause | Symptoms | Typical Resolution |
|-------|----------|-------------------|
| Upstream ETL failure | Sudden spike in nulls across many fields | Alert data engineering, rerun ETL |
| Source system migration | Schema violations, new unexpected fields | Update schema config, add field mappings |
| Timezone issues | Duplicate records, missing time windows | Fix timezone conversion in ETL |
| Encoding changes | Schema violations, parsing errors | Update parser configuration |
| Network timeout | Partial batches, low record count | Retry ingestion, check connectivity |

## Remediation

### For Warning Level (null rate 5–10%)

1. Quarantine the affected batch (mark as `warning` in DATA_QUALITY table).
2. Alert data team via Slack `#data-alerts`.
3. Allow model to continue serving with existing data.
4. Monitor for 1 hour — if rate returns to normal, likely transient.

### For Critical Level (null rate > 10%)

1. **Quarantine** the affected batch immediately.
2. **Alert** data engineering team — Slack `#data-alerts` with urgency.
3. **Check model impact** — query MODEL_METRICS for accuracy changes.
4. If model accuracy affected:
   - Halt new predictions on corrupted data.
   - Fall back to cached predictions or default scores.
5. **Rerun pipeline** after root cause is fixed.
6. **Validate** the rerun batch passes all quality checks.

### For Schema Violations

1. Compare incoming schema against expected schema.
2. Identify new, missing, or changed fields.
3. Update schema configuration if the change is intentional.
4. Notify upstream team if the change is unintentional.

## Post-Incident

- Log the incident in the INCIDENTS table.
- Update monitoring thresholds if they were too sensitive/insensitive.
- Add new validation rules if a novel issue type was discovered.

## Related Runbooks

- [Model Drift Runbook](model_drift.md) — drift may follow data quality issues
- [Incident Response Runbook](incident_response.md) — for escalation procedures
