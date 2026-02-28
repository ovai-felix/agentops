# Runbook: Model Retraining Procedures

## Overview

Model retraining is triggered when model performance degrades beyond acceptable thresholds. This runbook covers when to retrain, prerequisites, training configuration, evaluation gates, and deployment.

## When to Retrain

| Trigger | Threshold | Priority |
|---------|-----------|----------|
| Accuracy drop | F1 drops > 0.05 from baseline | High |
| Drift score | Aggregate PSI > 0.3 | High |
| Scheduled | Weekly (Sunday 02:00 UTC) | Normal |
| Manual request | Team decision | Varies |

## Prerequisites

Before triggering a retraining run, verify:

1. **Sufficient data**: Minimum 10,000 new labeled samples since last training.
   ```sql
   SELECT COUNT(*) AS new_samples
   FROM TRANSACTIONS
   WHERE ingestion_timestamp > '<last_training_date>';
   ```

2. **Data quality check passed**: No critical data quality issues.
   ```sql
   SELECT status, COUNT(*)
   FROM DATA_QUALITY
   WHERE timestamp >= DATEADD(day, -1, CURRENT_TIMESTAMP())
   GROUP BY status;
   ```
   All recent runs should be `healthy` or `warning` (not `critical`).

3. **No active incidents**: Check that no P1 incidents are open.
   ```sql
   SELECT * FROM INCIDENTS
   WHERE status = 'open' AND severity = 'P1';
   ```

## Training Configuration

Trigger retraining via the mlmonitoring API:

```
POST /training/trigger
Content-Type: application/json

{
    "model_type": "classifier",
    "data_version": "latest"
}
```

**Default hyperparameters** (managed by mlmonitoring service):
- Optimization: Optuna with 5 trials
- Epochs: 30
- Early stopping patience: 5 epochs
- Cross-validation: 5-fold stratified

## Evaluation Gate

The new model must pass these criteria before promotion:

| Metric | Requirement |
|--------|-------------|
| F1 Score | >= production F1 - 0.01 |
| AUC-ROC | >= production AUC-ROC - 0.005 |
| Precision | >= 0.85 |
| Recall | >= 0.80 |
| Latency p99 | < 1s |

**Check training status:**
```
GET /training/status
```

Response includes:
- `status`: running, completed, failed
- `metrics`: F1, precision, recall, AUC-ROC of the new model
- `comparison`: delta against production model

## Post-Training Deployment

If the evaluation gate passes:

1. **Promote to staging**:
   - The mlmonitoring service handles model artifact storage.
   - New model is loaded into the standby slot.

2. **Smoke tests**:
   - Send 100 sample predictions via `POST /predict/batch`.
   - Verify all return valid scores in [0, 1].
   - Verify latency p99 < 1s.

3. **Blue-green deployment**:
   ```
   POST /model/reload
   ```
   - Swaps active and standby model slots.
   - Previous model remains in standby for rollback.

4. **Post-deploy monitoring**:
   - Watch MODEL_METRICS for 30 minutes.
   - If F1 drops or latency spikes → immediate rollback.

## If Retraining Fails

1. Check training logs via `/training/status`.
2. Common failures:
   - **Data imbalance**: Adjust class weights or use SMOTE.
   - **Convergence failure**: Increase epochs or adjust learning rate.
   - **Resource exhaustion**: Reduce batch size or model complexity.
3. If repeated failures → create incident, investigate data quality.

## Related Runbooks

- [Model Drift Runbook](model_drift.md) — drift triggers retraining
- [Rollback Runbook](rollback.md) — if new model underperforms
- [Data Quality Runbook](data_quality.md) — ensure data quality before training
