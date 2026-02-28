"""Create Snowflake tables and populate with seed data for AgentOps demo.

Usage:
    cd /Users/omatsone/Desktop/projectAI/agentops
    PYTHONPATH=src python seed/setup_snowflake.py
"""

import random
import sys
import os
from datetime import datetime, timedelta, UTC

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import snowflake.connector
from config import settings

# ---------------------------------------------------------------------------
# Schema DDL
# ---------------------------------------------------------------------------

TABLES_DDL = [
    """
    CREATE TABLE IF NOT EXISTS MODEL_METRICS (
        id INTEGER AUTOINCREMENT,
        ts TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
        model_name VARCHAR(100),
        model_version VARCHAR(50),
        f1_score FLOAT,
        precision_score FLOAT,
        recall_score FLOAT,
        auc_roc FLOAT,
        drift_score FLOAT,
        latency_p50_ms FLOAT,
        latency_p95_ms FLOAT,
        latency_p99_ms FLOAT,
        prediction_count INTEGER,
        anomaly_rate FLOAT,
        PRIMARY KEY (id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS DATA_QUALITY (
        id INTEGER AUTOINCREMENT,
        ts TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
        pipeline_name VARCHAR(100),
        records_processed INTEGER,
        records_valid INTEGER,
        records_invalid INTEGER,
        null_rate FLOAT,
        schema_violations INTEGER,
        out_of_range_count INTEGER,
        status VARCHAR(20),
        PRIMARY KEY (id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS FEATURE_DRIFT (
        id INTEGER AUTOINCREMENT,
        ts TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
        model_name VARCHAR(100),
        feature_name VARCHAR(50),
        psi_score FLOAT,
        ks_statistic FLOAT,
        mean_shift FLOAT,
        std_shift FLOAT,
        PRIMARY KEY (id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS INCIDENTS (
        id INTEGER AUTOINCREMENT,
        incident_id VARCHAR(50),
        ts TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
        alert_type VARCHAR(50),
        severity VARCHAR(20),
        affected_component VARCHAR(100),
        root_cause TEXT,
        resolution TEXT,
        duration_minutes INTEGER,
        status VARCHAR(20),
        PRIMARY KEY (id)
    )
    """,
]

# ---------------------------------------------------------------------------
# Features list (matches mlmonitoring PCA features)
# ---------------------------------------------------------------------------

FEATURES = [f"V{i}" for i in range(1, 29)] + ["Time", "Amount"]


def jitter(base: float, pct: float = 0.03) -> float:
    return round(base * (1 + random.uniform(-pct, pct)), 6)


def ts_fmt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


# ---------------------------------------------------------------------------
# Seed: healthy baseline (last 7 days, hourly)
# ---------------------------------------------------------------------------

def build_healthy_baseline(now: datetime):
    start = now - timedelta(days=7)
    hours = int((now - timedelta(hours=3) - start).total_seconds() / 3600)

    mm_rows = []
    for h in range(hours):
        ts = start + timedelta(hours=h)
        mm_rows.append((
            ts_fmt(ts), "classifier_v2", "v2.1.0",
            jitter(0.91), jitter(0.89), jitter(0.93), jitter(0.96),
            jitter(0.08, 0.2), jitter(45.0, 0.1), jitter(120.0, 0.1),
            jitter(200.0, 0.1), random.randint(800, 1200), jitter(0.03, 0.3),
        ))

    dq_rows = []
    for h in range(hours):
        ts = start + timedelta(hours=h)
        total = random.randint(900, 1100)
        invalid = random.randint(0, 5)
        dq_rows.append((
            ts_fmt(ts), "transactions_ingest",
            total, total - invalid, invalid,
            jitter(0.008, 0.3), random.randint(0, 2), random.randint(0, 3), "healthy",
        ))

    fd_rows = []
    for h in range(0, hours, 6):
        ts = start + timedelta(hours=h)
        for feat in FEATURES:
            fd_rows.append((
                ts_fmt(ts), "classifier_v2", feat,
                jitter(0.05, 0.4), jitter(0.03, 0.4),
                jitter(0.01, 0.5), jitter(0.02, 0.5),
            ))

    return mm_rows, dq_rows, fd_rows


# ---------------------------------------------------------------------------
# Seed: drift event (last 2 hours)
# ---------------------------------------------------------------------------

def build_drift_event(now: datetime):
    mm_rows = []
    for step in range(8):
        ts = now - timedelta(minutes=(120 - step * 15))
        p = step / 7
        mm_rows.append((
            ts_fmt(ts), "classifier_v2", "v2.1.0",
            jitter(0.91 - 0.09 * p, 0.01), jitter(0.89 - 0.07 * p, 0.01),
            jitter(0.93 - 0.05 * p, 0.01), jitter(0.96 - 0.04 * p, 0.01),
            jitter(0.10 + 0.35 * p, 0.02),
            jitter(48.0, 0.05), jitter(130.0, 0.05), jitter(220.0, 0.05),
            random.randint(800, 1200), jitter(0.03 + 0.05 * p, 0.05),
        ))

    fd_rows = []
    ts_str = ts_fmt(now - timedelta(minutes=15))
    for feat in FEATURES:
        if feat == "V14":
            psi, ks, ms, ss = 0.80, 0.35, 0.42, 0.28
        elif feat == "V17":
            psi, ks, ms, ss = 0.60, 0.28, 0.31, 0.19
        elif feat in ("V12", "V10"):
            psi, ks, ms, ss = 0.18, 0.10, 0.08, 0.06
        else:
            psi, ks, ms, ss = jitter(0.05, 0.3), jitter(0.03, 0.3), jitter(0.01, 0.4), jitter(0.02, 0.4)
        fd_rows.append((
            ts_str, "classifier_v2", feat,
            jitter(psi, 0.02), jitter(ks, 0.02), jitter(ms, 0.02), jitter(ss, 0.02),
        ))

    dq_rows = []
    for step in range(8):
        ts = now - timedelta(minutes=(120 - step * 15))
        total = random.randint(900, 1100)
        invalid = random.randint(0, 4)
        dq_rows.append((
            ts_fmt(ts), "transactions_ingest",
            total, total - invalid, invalid,
            jitter(0.009, 0.2), random.randint(0, 1), random.randint(0, 2), "healthy",
        ))

    return mm_rows, dq_rows, fd_rows


# ---------------------------------------------------------------------------
# Seed: historical incidents
# ---------------------------------------------------------------------------

INCIDENTS_DATA = [
    ("INC-2026-0115", "2026-01-15 14:30:00", "model_drift", "critical",
     "classifier_v2",
     "Feature V14 distribution shifted due to vendor API format change",
     "Retrained model with new data distribution. Deployed v2.0.8.", 95, "resolved"),
    ("INC-2026-0120", "2026-01-20 09:15:00", "data_quality", "critical",
     "transactions_ingest",
     "15% null rate in Amount field due to upstream ETL timezone bug",
     "Fixed ETL timezone handling. Reprocessed affected batches.", 180, "resolved"),
    ("INC-2026-0203", "2026-02-03 16:45:00", "latency", "warning",
     "classifier_v2",
     "p99 latency hit 3s after deploying larger model",
     "Rolled back to previous model. Pruned new model and redeployed.", 45, "resolved"),
    ("INC-2026-0210", "2026-02-10 11:00:00", "accuracy_drop", "critical",
     "classifier_v2",
     "F1 dropped from 0.91 to 0.78 after data pipeline outage corrupted training data",
     "Retrained on clean data. Added data validation gate before training.", 240, "resolved"),
    ("INC-2026-0215", "2026-02-15 08:30:00", "anomaly_spike", "warning",
     "anomaly_v1",
     "False positive rate spiked 300% due to seasonal shopping pattern",
     "Added temporal features. Adjusted anomaly threshold for seasonal periods.", 120, "resolved"),
    ("INC-2026-0218", "2026-02-18 13:20:00", "data_quality", "critical",
     "feature_pipeline",
     "Upstream system added new field, broke feature pipeline schema validation",
     "Updated schema config to handle new field. Added schema versioning.", 60, "resolved"),
    ("INC-2026-0222", "2026-02-22 10:00:00", "anomaly_spike", "warning",
     "anomaly_v1",
     "Isolation Forest flagged 25% of transactions as anomalous during promotional event",
     "Adjusted contamination threshold. Added event calendar integration.", 30, "resolved"),
    ("INC-2026-0225", "2026-02-25 15:45:00", "accuracy_drop", "warning",
     "classifier_v2",
     "Automated retraining produced worse model (F1 0.65) due to class imbalance in new data",
     "Evaluation gate blocked promotion. Adjusted class weights in training config.", 15, "resolved"),
]


# ---------------------------------------------------------------------------
# Batch insert helper
# ---------------------------------------------------------------------------

def batch_insert(cur, table: str, columns: list[str], rows: list[tuple]):
    """Insert rows using executemany for speed."""
    if not rows:
        return
    placeholders = ", ".join(["%s"] * len(columns))
    cols = ", ".join(columns)
    sql = f"INSERT INTO {table} ({cols}) VALUES ({placeholders})"
    cur.executemany(sql, rows)
    print(f"  {table}: {len(rows)} rows inserted")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Connecting to Snowflake...")
    conn = snowflake.connector.connect(
        account=settings.snowflake_account,
        user=settings.snowflake_user,
        password=settings.snowflake_password,
        warehouse=settings.snowflake_warehouse,
    )
    cur = conn.cursor()

    print("Creating database and schema...")
    cur.execute(f"CREATE DATABASE IF NOT EXISTS {settings.snowflake_database}")
    cur.execute(f"USE DATABASE {settings.snowflake_database}")
    cur.execute(f"CREATE SCHEMA IF NOT EXISTS {settings.snowflake_schema}")
    cur.execute(f"USE SCHEMA {settings.snowflake_schema}")
    print(f"  Using {settings.snowflake_database}.{settings.snowflake_schema}")

    print("Creating tables...")
    for ddl in TABLES_DDL:
        cur.execute(ddl)
    print("  4 tables created")

    # Clear existing data
    print("Clearing existing data...")
    for t in ["MODEL_METRICS", "DATA_QUALITY", "FEATURE_DRIFT", "INCIDENTS"]:
        cur.execute(f"DELETE FROM {t}")

    now = datetime.now(UTC).replace(tzinfo=None)
    random.seed(42)

    # Build all data in memory
    print("Building healthy baseline (7 days)...")
    h_mm, h_dq, h_fd = build_healthy_baseline(now)

    print("Building drift event (last 2 hours)...")
    d_mm, d_dq, d_fd = build_drift_event(now)

    # Batch insert everything
    mm_cols = ["ts", "model_name", "model_version", "f1_score", "precision_score",
               "recall_score", "auc_roc", "drift_score", "latency_p50_ms",
               "latency_p95_ms", "latency_p99_ms", "prediction_count", "anomaly_rate"]
    batch_insert(cur, "MODEL_METRICS", mm_cols, h_mm + d_mm)

    dq_cols = ["ts", "pipeline_name", "records_processed", "records_valid",
               "records_invalid", "null_rate", "schema_violations",
               "out_of_range_count", "status"]
    batch_insert(cur, "DATA_QUALITY", dq_cols, h_dq + d_dq)

    fd_cols = ["ts", "model_name", "feature_name", "psi_score",
               "ks_statistic", "mean_shift", "std_shift"]
    batch_insert(cur, "FEATURE_DRIFT", fd_cols, h_fd + d_fd)

    inc_cols = ["incident_id", "ts", "alert_type", "severity", "affected_component",
                "root_cause", "resolution", "duration_minutes", "status"]
    batch_insert(cur, "INCIDENTS", inc_cols, INCIDENTS_DATA)

    conn.commit()
    print("\nCommitted.")

    # Verify
    print("\n--- Verification ---")
    for table in ["MODEL_METRICS", "DATA_QUALITY", "FEATURE_DRIFT", "INCIDENTS"]:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        print(f"  {table}: {cur.fetchone()[0]} rows")

    cur.execute(
        "SELECT ts, f1_score, drift_score FROM MODEL_METRICS ORDER BY ts DESC LIMIT 1"
    )
    latest = cur.fetchone()
    print(f"\n  Latest metrics: ts={latest[0]}, F1={latest[1]:.4f}, drift={latest[2]:.4f}")

    cur.execute(
        "SELECT feature_name, psi_score FROM FEATURE_DRIFT ORDER BY psi_score DESC LIMIT 3"
    )
    print("  Top drifting features:")
    for feat, psi in cur.fetchall():
        print(f"    {feat}: PSI={psi:.4f}")

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
