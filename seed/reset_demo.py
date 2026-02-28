"""Reset Snowflake drift event data with fresh timestamps for demo replay.

Usage:
    cd /Users/omatsone/Desktop/projectAI/agentops
    PYTHONPATH=src python seed/reset_demo.py
"""

import random
import sys
import os
from datetime import datetime, timedelta, UTC

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import snowflake.connector
from config import settings
from setup_snowflake import build_drift_event, batch_insert


def main():
    print("Connecting to Snowflake...")
    conn = snowflake.connector.connect(
        account=settings.snowflake_account,
        user=settings.snowflake_user,
        password=settings.snowflake_password,
        database=settings.snowflake_database,
        schema=settings.snowflake_schema,
        warehouse=settings.snowflake_warehouse,
    )
    cur = conn.cursor()

    now = datetime.now(UTC).replace(tzinfo=None)
    cutoff = (now - timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S")
    random.seed()

    print("Removing recent data (last 3 hours)...")
    for t in ["MODEL_METRICS", "DATA_QUALITY", "FEATURE_DRIFT"]:
        cur.execute(f"DELETE FROM {t} WHERE ts > '{cutoff}'")
    print("  Cleared")

    print("Re-inserting drift event with fresh timestamps...")
    d_mm, d_dq, d_fd = build_drift_event(now)

    mm_cols = ["ts", "model_name", "model_version", "f1_score", "precision_score",
               "recall_score", "auc_roc", "drift_score", "latency_p50_ms",
               "latency_p95_ms", "latency_p99_ms", "prediction_count", "anomaly_rate"]
    batch_insert(cur, "MODEL_METRICS", mm_cols, d_mm)

    dq_cols = ["ts", "pipeline_name", "records_processed", "records_valid",
               "records_invalid", "null_rate", "schema_violations",
               "out_of_range_count", "status"]
    batch_insert(cur, "DATA_QUALITY", dq_cols, d_dq)

    fd_cols = ["ts", "model_name", "feature_name", "psi_score",
               "ks_statistic", "mean_shift", "std_shift"]
    batch_insert(cur, "FEATURE_DRIFT", fd_cols, d_fd)

    conn.commit()

    # Verify
    cur.execute("SELECT ts, f1_score, drift_score FROM MODEL_METRICS ORDER BY ts DESC LIMIT 1")
    latest = cur.fetchone()
    print(f"\n  Latest: ts={latest[0]}, F1={latest[1]:.4f}, drift={latest[2]:.4f}")

    cur.execute("SELECT feature_name, psi_score FROM FEATURE_DRIFT ORDER BY psi_score DESC LIMIT 2")
    top = cur.fetchall()
    print(f"  Top drift: {top[0][0]}={top[0][1]:.4f}, {top[1][0]}={top[1][1]:.4f}")

    cur.close()
    conn.close()
    print("\nDemo reset complete.")


if __name__ == "__main__":
    main()
