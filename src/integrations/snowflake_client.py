"""Snowflake client for querying model metrics and data quality."""

import snowflake.connector
from config import settings

METRIC_COLUMNS = frozenset({
    "f1_score", "precision_score", "recall_score", "auc_roc",
    "drift_score", "latency_p50_ms", "latency_p95_ms", "latency_p99_ms",
    "prediction_count", "anomaly_rate",
})


class SnowflakeClient:
    def __init__(self):
        self._conn = None

    def _get_conn(self):
        if self._conn is None or self._conn.is_closed():
            self._conn = snowflake.connector.connect(
                account=settings.snowflake_account,
                user=settings.snowflake_user,
                password=settings.snowflake_password,
                database=settings.snowflake_database,
                schema=settings.snowflake_schema,
                warehouse=settings.snowflake_warehouse,
            )
        return self._conn

    def query(self, sql: str, params: tuple | None = None) -> list[dict]:
        """Run SQL and return rows as list of dicts."""
        conn = self._get_conn()
        cur = conn.cursor()
        try:
            cur.execute(sql, params or ())
            if cur.description is None:
                return []
            cols = [d[0].lower() for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
        finally:
            cur.close()

    def get_latest_model_metrics(
        self, model_name: str = "classifier_v2", hours: int = 1
    ) -> list[dict]:
        return self.query(
            "SELECT * FROM MODEL_METRICS "
            "WHERE model_name = %s AND ts > DATEADD(hour, %s, CURRENT_TIMESTAMP()) "
            "ORDER BY ts DESC",
            (model_name, -hours),
        )

    def get_feature_drift(
        self, model_name: str = "classifier_v2", hours: int = 2
    ) -> list[dict]:
        return self.query(
            "SELECT * FROM FEATURE_DRIFT "
            "WHERE model_name = %s AND ts > DATEADD(hour, %s, CURRENT_TIMESTAMP()) "
            "ORDER BY psi_score DESC",
            (model_name, -hours),
        )

    def get_data_quality(
        self, pipeline: str = "transactions_ingest", hours: int = 1
    ) -> list[dict]:
        return self.query(
            "SELECT * FROM DATA_QUALITY "
            "WHERE pipeline_name = %s AND ts > DATEADD(hour, %s, CURRENT_TIMESTAMP()) "
            "ORDER BY ts DESC",
            (pipeline, -hours),
        )

    def get_metric_trend(
        self, model_name: str, metric: str, hours: int = 24
    ) -> list[dict]:
        if metric not in METRIC_COLUMNS:
            raise ValueError(f"Invalid metric: {metric}. Must be one of {METRIC_COLUMNS}")
        return self.query(
            f"SELECT ts, {metric} FROM MODEL_METRICS "
            "WHERE model_name = %s AND ts > DATEADD(hour, %s, CURRENT_TIMESTAMP()) "
            "ORDER BY ts ASC",
            (model_name, -hours),
        )

    def get_incidents(self, status: str | None = None, limit: int = 10) -> list[dict]:
        if status:
            return self.query(
                "SELECT * FROM INCIDENTS WHERE status = %s ORDER BY ts DESC LIMIT %s",
                (status, limit),
            )
        return self.query(
            "SELECT * FROM INCIDENTS ORDER BY ts DESC LIMIT %s",
            (limit,),
        )

    def close(self):
        if self._conn and not self._conn.is_closed():
            self._conn.close()
