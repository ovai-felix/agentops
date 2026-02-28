"""CrewAI tools for querying Snowflake model metrics and data quality."""
from crewai.tools import tool
from config import settings
from integrations.snowflake_client import SnowflakeClient

_sf = SnowflakeClient()


@tool("Query Model Metrics")
def query_model_metrics(model_name: str = "classifier_v2", hours: int = 1) -> str:
    """Query the latest ML model performance metrics from Snowflake.

    Returns F1 score, drift score, latency percentiles, prediction count,
    and anomaly rate for the specified model over the last N hours.
    Includes an overall health assessment: HEALTHY, WARNING, or CRITICAL.
    """
    rows = _sf.get_latest_model_metrics(model_name, hours)
    if not rows:
        return f"No metrics found for {model_name} in the last {hours} hour(s)."

    latest = rows[0]
    f1 = latest.get("f1_score", 0)
    drift = latest.get("drift_score", 0)
    p99 = latest.get("latency_p99_ms", 0)
    anomaly = latest.get("anomaly_rate", 0)

    # Determine health status
    issues = []
    if f1 < 0.88:
        issues.append(f"F1={f1:.3f} < 0.88 (accuracy_drop)")
    if drift > settings.drift_threshold:
        issues.append(f"drift_score={drift:.3f} > {settings.drift_threshold} (model_drift)")
    if p99 > 1000:
        issues.append(f"latency_p99={p99:.0f}ms > 1000ms (latency)")
    if anomaly > 0.10:
        issues.append(f"anomaly_rate={anomaly:.3f} > 0.10 (anomaly_spike)")

    if f1 < 0.70 or drift > 0.5 or p99 > 2000:
        status = "CRITICAL"
    elif issues:
        status = "WARNING"
    else:
        status = "HEALTHY"

    lines = [
        f"Model: {model_name} | Status: {status}",
        f"Timestamp: {latest.get('ts', latest.get('timestamp', 'N/A'))}",
        f"F1 Score: {f1:.4f}",
        f"Precision: {latest.get('precision_score', 'N/A')}",
        f"Recall: {latest.get('recall_score', 'N/A')}",
        f"AUC-ROC: {latest.get('auc_roc', 'N/A')}",
        f"Drift Score: {drift:.4f}",
        f"Latency p50: {latest.get('latency_p50_ms', 'N/A')}ms",
        f"Latency p95: {latest.get('latency_p95_ms', 'N/A')}ms",
        f"Latency p99: {p99}ms",
        f"Prediction Count: {latest.get('prediction_count', 'N/A')}",
        f"Anomaly Rate: {anomaly:.4f}",
        f"Rows returned: {len(rows)}",
    ]
    if issues:
        lines.append(f"Issues: {'; '.join(issues)}")
    return "\n".join(lines)


@tool("Query Feature Drift")
def query_feature_drift(model_name: str = "classifier_v2") -> str:
    """Query per-feature drift scores (PSI, KS statistic) for an ML model.

    Returns drift scores for all features sorted by PSI descending.
    Highlights any feature with PSI > 0.2 (warning) or PSI > 0.3 (critical).
    Use this to identify which specific features are causing model drift.
    """
    rows = _sf.get_feature_drift(model_name)
    if not rows:
        return f"No feature drift data found for {model_name}."

    lines = [f"Feature drift for {model_name} ({len(rows)} features):"]
    lines.append(f"{'Feature':<12} {'PSI':>8} {'KS':>8} {'Mean Shift':>12} {'Status'}")
    lines.append("-" * 55)
    for r in rows:
        psi = r.get("psi_score", 0)
        if psi > 0.3:
            flag = "CRITICAL"
        elif psi > 0.2:
            flag = "WARNING"
        else:
            flag = "ok"
        lines.append(
            f"{r.get('feature_name', '?'):<12} {psi:>8.4f} "
            f"{r.get('ks_statistic', 0):>8.4f} "
            f"{r.get('mean_shift', 0):>12.4f} {flag}"
        )

    critical = [r for r in rows if r.get("psi_score", 0) > 0.3]
    warning = [r for r in rows if 0.2 < r.get("psi_score", 0) <= 0.3]
    lines.append(f"\nSummary: {len(critical)} critical, {len(warning)} warning features")
    return "\n".join(lines)


@tool("Query Data Quality")
def query_data_quality(pipeline_name: str = "transactions_ingest") -> str:
    """Query data quality metrics for a data pipeline from Snowflake.

    Returns null rates, schema violations, out-of-range counts, and overall
    status (healthy/warning/critical) for the specified pipeline.
    """
    rows = _sf.get_data_quality(pipeline_name)
    if not rows:
        return f"No data quality records found for {pipeline_name}."

    latest = rows[0]
    null_rate = latest.get("null_rate", 0)

    if null_rate > 0.10:
        assessment = "CRITICAL — null rate exceeds 10%"
    elif null_rate > 0.05:
        assessment = "WARNING — null rate exceeds 5%"
    else:
        assessment = "HEALTHY"

    lines = [
        f"Pipeline: {pipeline_name} | Assessment: {assessment}",
        f"Timestamp: {latest.get('ts', latest.get('timestamp', 'N/A'))}",
        f"Records Processed: {latest.get('records_processed', 'N/A')}",
        f"Records Valid: {latest.get('records_valid', 'N/A')}",
        f"Records Invalid: {latest.get('records_invalid', 'N/A')}",
        f"Null Rate: {null_rate:.4f}",
        f"Schema Violations: {latest.get('schema_violations', 'N/A')}",
        f"Out-of-Range Count: {latest.get('out_of_range_count', 'N/A')}",
        f"Pipeline Status: {latest.get('status', 'N/A')}",
    ]
    return "\n".join(lines)


@tool("Query Metric Trend")
def query_metric_trend(model_name: str, metric: str, hours: int = 24) -> str:
    """Query the trend of a specific metric over time for an ML model.

    Valid metrics: f1_score, precision_score, recall_score, auc_roc,
    drift_score, latency_p50_ms, latency_p95_ms, latency_p99_ms,
    prediction_count, anomaly_rate.

    Returns a time series showing when the metric started changing,
    useful for pinpointing the onset of issues.
    """
    try:
        rows = _sf.get_metric_trend(model_name, metric, hours)
    except ValueError as e:
        return str(e)

    if not rows:
        return f"No trend data for {model_name}.{metric} in the last {hours}h."

    lines = [f"Trend: {model_name}.{metric} (last {hours}h, {len(rows)} points)"]
    lines.append(f"{'Timestamp':<25} {metric}")
    lines.append("-" * 40)
    for r in rows:
        ts = r.get("ts", r.get("timestamp", "?"))
        val = r.get(metric, "?")
        if isinstance(val, float):
            lines.append(f"{str(ts):<25} {val:.4f}")
        else:
            lines.append(f"{str(ts):<25} {val}")
    return "\n".join(lines)
