"""AgentOps Dashboard — Autonomous MLOps & DataOps Platform.

Usage:
    cd /Users/omatsone/Desktop/projectAI/agentops
    PYTHONPATH=src streamlit run dashboard/streamlit_app.py --server.port 8502
"""

import sys
import os
import time
import threading
import json
from datetime import datetime, UTC

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import streamlit as st
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from config import settings
from integrations.snowflake_client import SnowflakeClient
from integrations.rag_client import RAGClient

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="AgentOps",
    page_icon="🔧",  # wrench
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Session state init
# ---------------------------------------------------------------------------

if "alerts" not in st.session_state:
    st.session_state.alerts = []
if "diagnosis" not in st.session_state:
    st.session_state.diagnosis = None
if "actions" not in st.session_state:
    st.session_state.actions = []
if "crew_running" not in st.session_state:
    st.session_state.crew_running = False
if "crew_result" not in st.session_state:
    st.session_state.crew_result = None
if "crew_error" not in st.session_state:
    st.session_state.crew_error = None
if "auto_refresh" not in st.session_state:
    st.session_state.auto_refresh = False

# ---------------------------------------------------------------------------
# Clients (cached)
# ---------------------------------------------------------------------------


@st.cache_resource
def get_snowflake_client():
    return SnowflakeClient()


@st.cache_resource
def get_rag_client():
    return RAGClient()


# ---------------------------------------------------------------------------
# Helper: severity badge
# ---------------------------------------------------------------------------

SEVERITY_COLORS = {
    "critical": "#FF4B4B",
    "warning": "#FFA62F",
    "info": "#4B9EFF",
    "healthy": "#09AB3B",
}


def severity_badge(severity: str) -> str:
    color = SEVERITY_COLORS.get(severity, "#888")
    return f'<span style="background:{color};color:white;padding:2px 8px;border-radius:4px;font-size:0.8em;font-weight:bold">{severity.upper()}</span>'


def status_indicator(ok: bool, label: str) -> str:
    dot = "🟢" if ok else "🔴"
    return f"{dot} {label}"


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------


def fetch_model_metrics(sf: SnowflakeClient) -> dict:
    """Fetch latest model metrics and compute status."""
    rows = sf.get_latest_model_metrics(hours=1)
    if not rows:
        return {"status": "unknown", "f1": None, "drift": None, "latency": None, "anomaly_rate": None, "count": 0}

    latest = rows[0]
    f1 = latest.get("f1_score", 0)
    drift = latest.get("drift_score", 0)
    latency = latest.get("latency_p99_ms", 0)
    anomaly = latest.get("anomaly_rate", 0)

    if f1 < 0.88 - settings.accuracy_drop_threshold or drift > settings.drift_threshold:
        status = "critical"
    elif f1 < 0.88 or drift > 0.2:
        status = "warning"
    else:
        status = "healthy"

    return {
        "status": status,
        "f1": f1,
        "drift": drift,
        "latency": latency,
        "anomaly_rate": anomaly,
        "count": len(rows),
        "rows": rows,
    }


def fetch_data_quality(sf: SnowflakeClient) -> dict:
    rows = sf.get_data_quality(hours=1)
    if not rows:
        return {"status": "unknown", "null_rate": None, "records": 0}

    latest = rows[0]
    null_rate = latest.get("null_rate", 0)
    status_val = latest.get("status", "unknown")

    return {
        "status": status_val,
        "null_rate": null_rate,
        "records": latest.get("records_processed", 0),
        "violations": latest.get("schema_violations", 0),
        "rows": rows,
    }


def fetch_feature_drift(sf: SnowflakeClient) -> list[dict]:
    return sf.get_feature_drift(hours=2)


def fetch_drift_trend(sf: SnowflakeClient) -> list[dict]:
    return sf.get_metric_trend("classifier_v2", "drift_score", hours=48)


def fetch_f1_trend(sf: SnowflakeClient) -> list[dict]:
    return sf.get_metric_trend("classifier_v2", "f1_score", hours=48)


# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------

with st.sidebar:
    st.title("AgentOps")
    st.caption("Autonomous MLOps Platform")
    st.divider()

    # Service health
    st.subheader("Services")

    # Snowflake
    try:
        sf = get_snowflake_client()
        sf.query("SELECT 1")
        st.markdown(status_indicator(True, "Snowflake"))
    except Exception:
        sf = None
        st.markdown(status_indicator(False, "Snowflake"))

    # RAG
    try:
        rag = get_rag_client()
        rag_health = rag.health()
        st.markdown(status_indicator(rag_health.get("status") == "ok", "RAG System"))
    except Exception:
        rag = None
        st.markdown(status_indicator(False, "RAG System"))

    # MLMonitoring
    try:
        from integrations.mlmonitoring_client import MLMonitoringClient
        ml_client = MLMonitoringClient()
        ml_health = ml_client.health()
        st.markdown(status_indicator(True, "ML Monitoring"))
    except Exception:
        ml_client = None
        st.markdown(status_indicator(False, "ML Monitoring"))

    st.divider()

    # Controls
    st.subheader("Controls")

    if st.button("Refresh Data", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

    st.divider()

    # Run crew
    st.subheader("Agent Crew")
    crew_available = False
    try:
        from crew.crew import AgentOpsCrew
        crew_available = True
    except Exception as _crew_err:
        pass

    if crew_available:
        if st.button("Run Full Demo", type="primary", use_container_width=True,
                      disabled=st.session_state.crew_running):
            st.session_state.crew_running = True
            st.session_state.crew_result = None
            st.session_state.crew_error = None

            def _run_crew():
                try:
                    crew = AgentOpsCrew()
                    result = crew.run(context="Check for model drift — elevated drift on V14 and V17.")
                    st.session_state.crew_result = result
                except Exception as e:
                    st.session_state.crew_error = str(e)
                finally:
                    st.session_state.crew_running = False

            t = threading.Thread(target=_run_crew, daemon=True)
            t.start()
            st.rerun()
    else:
        st.info(f"Agent crew not available: {_crew_err}")

    if st.session_state.crew_running:
        st.warning("Crew is running...")
    elif st.session_state.crew_result:
        st.success("Crew finished!")
    elif st.session_state.crew_error:
        st.error(f"Crew error: {st.session_state.crew_error}")

    st.divider()
    st.caption("Llama Lounge Hackathon 2026")
    st.caption("Snowflake | CrewAI | Composio")


# ---------------------------------------------------------------------------
# Main content tabs
# ---------------------------------------------------------------------------

tab_status, tab_alerts, tab_investigate, tab_actions, tab_crew = st.tabs(
    ["Status", "Alerts", "Investigation", "Actions", "Crew Output"]
)

# ===========================================================================
# TAB 1: STATUS
# ===========================================================================

with tab_status:
    st.header("System Health")

    if sf is None:
        st.error("Snowflake not connected. Check credentials in .env")
    else:
        model_data = fetch_model_metrics(sf)
        dq_data = fetch_data_quality(sf)

        # Top-level metric cards
        col1, col2, col3, col4 = st.columns(4)

        with col1:
            f1_val = model_data["f1"]
            st.metric(
                "Model F1 Score",
                f"{f1_val:.4f}" if f1_val else "N/A",
                delta=f"{f1_val - 0.91:.4f}" if f1_val else None,
                delta_color="normal",
            )
            st.markdown(severity_badge(model_data["status"]), unsafe_allow_html=True)

        with col2:
            drift_val = model_data["drift"]
            st.metric(
                "Drift Score",
                f"{drift_val:.4f}" if drift_val else "N/A",
                delta=f"{drift_val - 0.08:.4f}" if drift_val else None,
                delta_color="inverse",
            )
            drift_status = "critical" if (drift_val or 0) > 0.3 else "warning" if (drift_val or 0) > 0.2 else "healthy"
            st.markdown(severity_badge(drift_status), unsafe_allow_html=True)

        with col3:
            null_rate = dq_data["null_rate"]
            st.metric(
                "Data Quality (Null Rate)",
                f"{null_rate:.4f}" if null_rate is not None else "N/A",
                delta=None,
            )
            st.markdown(severity_badge(dq_data["status"]), unsafe_allow_html=True)

        with col4:
            latency = model_data["latency"]
            st.metric(
                "Latency p99",
                f"{latency:.0f}ms" if latency else "N/A",
            )
            lat_status = "critical" if (latency or 0) > 1000 else "warning" if (latency or 0) > 500 else "healthy"
            st.markdown(severity_badge(lat_status), unsafe_allow_html=True)

        st.divider()

        # Trend charts
        col_left, col_right = st.columns(2)

        with col_left:
            st.subheader("F1 Score Trend (48h)")
            f1_trend = fetch_f1_trend(sf)
            if f1_trend:
                import pandas as pd
                df = pd.DataFrame(f1_trend)
                df["ts"] = pd.to_datetime(df["ts"])
                st.line_chart(df.set_index("ts")["f1_score"], color="#4B9EFF")
            else:
                st.info("No trend data available")

        with col_right:
            st.subheader("Drift Score Trend (48h)")
            drift_trend = fetch_drift_trend(sf)
            if drift_trend:
                import pandas as pd
                df = pd.DataFrame(drift_trend)
                df["ts"] = pd.to_datetime(df["ts"])
                st.line_chart(df.set_index("ts")["drift_score"], color="#FF4B4B")
            else:
                st.info("No trend data available")

        # Feature drift breakdown
        st.subheader("Per-Feature Drift Scores")
        fd_rows = fetch_feature_drift(sf)
        if fd_rows:
            import pandas as pd
            # Deduplicate: keep highest PSI per feature
            seen = {}
            for r in fd_rows:
                feat = r["feature_name"]
                if feat not in seen or r["psi_score"] > seen[feat]["psi_score"]:
                    seen[feat] = r
            fd_dedup = sorted(seen.values(), key=lambda x: x["psi_score"], reverse=True)

            df_fd = pd.DataFrame(fd_dedup)[["feature_name", "psi_score", "ks_statistic", "mean_shift"]]
            df_fd = df_fd.rename(columns={
                "feature_name": "Feature",
                "psi_score": "PSI",
                "ks_statistic": "KS Statistic",
                "mean_shift": "Mean Shift",
            })

            # Highlight high-drift features
            def highlight_drift(row):
                psi = row["PSI"]
                if psi > 0.3:
                    return ["background-color: #FF4B4B33"] * len(row)
                elif psi > 0.2:
                    return ["background-color: #FFA62F33"] * len(row)
                return [""] * len(row)

            st.dataframe(
                df_fd.style.apply(highlight_drift, axis=1).format({"PSI": "{:.4f}", "KS Statistic": "{:.4f}", "Mean Shift": "{:.4f}"}),
                use_container_width=True,
                hide_index=True,
            )
        else:
            st.info("No feature drift data available")


# ===========================================================================
# TAB 2: ALERTS
# ===========================================================================

with tab_alerts:
    st.header("Alert Feed")

    col_alert_ctrl, _ = st.columns([1, 2])
    with col_alert_ctrl:
        if sf and st.button("Check for Alerts Now", type="primary"):
            model_data = fetch_model_metrics(sf)
            new_alerts = []

            if model_data["f1"] and model_data["f1"] < 0.88:
                new_alerts.append({
                    "alert_id": f"alert_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}_accuracy",
                    "severity": "critical" if model_data["f1"] < 0.83 else "warning",
                    "alert_type": "accuracy_drop",
                    "affected_component": "classifier_v2",
                    "metrics": {"f1_score": model_data["f1"], "baseline_f1": 0.91},
                    "timestamp": datetime.now(UTC).isoformat(),
                    "message": f"Model F1 dropped to {model_data['f1']:.4f} (baseline: 0.91)",
                })

            if model_data["drift"] and model_data["drift"] > settings.drift_threshold:
                new_alerts.append({
                    "alert_id": f"alert_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}_drift",
                    "severity": "critical",
                    "alert_type": "model_drift",
                    "affected_component": "classifier_v2",
                    "metrics": {"drift_score": model_data["drift"], "threshold": settings.drift_threshold},
                    "timestamp": datetime.now(UTC).isoformat(),
                    "message": f"Drift score {model_data['drift']:.4f} exceeds threshold {settings.drift_threshold}",
                })

            if new_alerts:
                st.session_state.alerts = new_alerts + st.session_state.alerts
                st.success(f"Detected {len(new_alerts)} alert(s)")
            else:
                st.success("All systems healthy - no alerts")

    # Display alerts
    if not st.session_state.alerts:
        st.info("No active alerts. Click 'Check for Alerts Now' to scan.")
    else:
        for i, alert in enumerate(st.session_state.alerts):
            severity = alert.get("severity", "info")
            alert_type = alert.get("alert_type", "unknown")
            msg = alert.get("message", "")
            ts = alert.get("timestamp", "")

            with st.expander(
                f"{severity_badge(severity)} **{alert_type.replace('_', ' ').title()}** — {msg}",
                expanded=(i == 0),
            ):
                st.markdown(f"**Alert ID:** `{alert.get('alert_id', 'N/A')}`")
                st.markdown(f"**Timestamp:** {ts}")
                st.markdown(f"**Component:** {alert.get('affected_component', 'N/A')}")
                st.markdown("**Metrics:**")
                st.json(alert.get("metrics", {}))

                if st.button(f"Investigate", key=f"investigate_{i}"):
                    st.session_state.diagnosis = {"status": "investigating", "alert": alert}
                    st.rerun()

    # Historical incidents
    st.divider()
    st.subheader("Historical Incidents")
    if sf:
        incidents = sf.get_incidents(limit=8)
        if incidents:
            import pandas as pd
            df_inc = pd.DataFrame(incidents)[["incident_id", "ts", "alert_type", "severity", "affected_component", "duration_minutes", "status"]]
            df_inc = df_inc.rename(columns={
                "incident_id": "ID", "ts": "Time", "alert_type": "Type",
                "severity": "Severity", "affected_component": "Component",
                "duration_minutes": "Duration (min)", "status": "Status",
            })
            st.dataframe(df_inc, use_container_width=True, hide_index=True)


# ===========================================================================
# TAB 3: INVESTIGATION
# ===========================================================================

with tab_investigate:
    st.header("Investigation")

    # Manual RAG query
    st.subheader("Ask the Knowledge Base")
    query_input = st.text_input(
        "Search runbooks and incidents",
        placeholder="e.g., What causes V14 drift? How do I rollback a model?",
    )
    if query_input and rag:
        with st.spinner("Searching..."):
            answer = rag.search_runbooks(query_input)
        st.markdown("### Answer")
        st.markdown(answer)

    st.divider()

    # Automated diagnosis display
    st.subheader("Agent Diagnosis")
    if st.session_state.diagnosis is None:
        st.info("No active investigation. Trigger one from the Alerts tab.")
    elif st.session_state.diagnosis.get("status") == "investigating":
        alert = st.session_state.diagnosis.get("alert", {})
        alert_type = alert.get("alert_type", "unknown")

        st.warning(f"Investigating: **{alert_type.replace('_', ' ').title()}**")

        if rag:
            with st.spinner("Investigator Agent searching runbooks..."):
                # Build contextual query from alert
                query = f"How to diagnose and fix {alert_type.replace('_', ' ')} in ML fraud detection model?"
                if alert.get("metrics"):
                    metrics_str = ", ".join(f"{k}={v}" for k, v in alert["metrics"].items())
                    query += f" Current metrics: {metrics_str}"

                runbook_answer = rag.search_runbooks(query)

            with st.spinner("Searching historical incidents..."):
                incident_query = f"Past incidents similar to {alert_type.replace('_', ' ')}"
                if "drift" in alert_type:
                    fd_rows = fetch_feature_drift(sf) if sf else []
                    top_features = [r["feature_name"] for r in fd_rows[:3]] if fd_rows else []
                    if top_features:
                        incident_query += f" involving features {', '.join(top_features)}"
                incident_answer = rag.search_incidents(incident_query)

            # Build diagnosis
            diagnosis = {
                "status": "complete",
                "alert": alert,
                "root_cause_analysis": runbook_answer,
                "similar_incidents": incident_answer,
                "recommended_actions": [
                    {"action": "Send Slack notification", "priority": 1, "requires_approval": False},
                    {"action": "Create GitHub issue", "priority": 2, "requires_approval": False},
                    {"action": "Trigger model retraining", "priority": 3, "requires_approval": True},
                    {"action": "Rollback model (if retrain fails)", "priority": 4, "requires_approval": True},
                ],
            }
            st.session_state.diagnosis = diagnosis
            st.rerun()
        else:
            st.error("RAG system not available for investigation")

    elif st.session_state.diagnosis.get("status") == "complete":
        diag = st.session_state.diagnosis

        # Root cause
        st.markdown("### Root Cause Analysis")
        st.markdown(diag.get("root_cause_analysis", "N/A"))

        st.divider()

        # Similar incidents
        st.markdown("### Similar Past Incidents")
        st.markdown(diag.get("similar_incidents", "N/A"))

        st.divider()

        # Recommended actions
        st.markdown("### Recommended Actions")
        actions = diag.get("recommended_actions", [])
        for act in actions:
            approval = "Requires Approval" if act["requires_approval"] else "Auto-Execute"
            icon = "🔒" if act["requires_approval"] else "✅"
            st.markdown(f"**{act['priority']}.** {icon} {act['action']} — _{approval}_")

        if st.button("Execute Remediation Plan", type="primary"):
            st.session_state.actions = [
                {**act, "status": "pending", "timestamp": datetime.now(UTC).isoformat()}
                for act in actions
            ]
            st.rerun()


# ===========================================================================
# TAB 4: ACTIONS
# ===========================================================================

with tab_actions:
    st.header("Remediation Actions")

    if not st.session_state.actions:
        st.info("No actions pending. Run an investigation first.")
    else:
        for i, act in enumerate(st.session_state.actions):
            status = act["status"]
            action_name = act["action"]
            requires_approval = act.get("requires_approval", False)

            if status == "completed":
                icon = "✅"
            elif status == "pending":
                icon = "⏳"
            elif status == "approved":
                icon = "🟢"
            elif status == "failed":
                icon = "❌"
            else:
                icon = "❓"

            col_action, col_status, col_ctrl = st.columns([3, 1, 2])

            with col_action:
                st.markdown(f"### {icon} {action_name}")
                if act.get("details"):
                    st.caption(act["details"])

            with col_status:
                st.markdown(f"**{status.upper()}**")

            with col_ctrl:
                if status == "pending" and not requires_approval:
                    # Auto-execute
                    if st.button(f"Execute", key=f"exec_{i}"):
                        st.session_state.actions[i]["status"] = "completed"
                        st.session_state.actions[i]["details"] = f"Executed at {datetime.now(UTC).strftime('%H:%M:%S')}"
                        st.rerun()

                elif status == "pending" and requires_approval:
                    c1, c2 = st.columns(2)
                    with c1:
                        if st.button("Approve", key=f"approve_{i}", type="primary"):
                            st.session_state.actions[i]["status"] = "completed"
                            st.session_state.actions[i]["details"] = f"Approved at {datetime.now(UTC).strftime('%H:%M:%S')}"

                            # Actually trigger the action if services are available
                            if "retrain" in action_name.lower() and ml_client:
                                try:
                                    result = ml_client.trigger_retraining()
                                    st.session_state.actions[i]["details"] += f" | {result}"
                                except Exception as e:
                                    st.session_state.actions[i]["details"] += f" | API error: {e}"

                            if "rollback" in action_name.lower() and ml_client:
                                try:
                                    result = ml_client.rollback_model()
                                    st.session_state.actions[i]["details"] += f" | {result}"
                                except Exception as e:
                                    st.session_state.actions[i]["details"] += f" | API error: {e}"

                            st.rerun()
                    with c2:
                        if st.button("Deny", key=f"deny_{i}"):
                            st.session_state.actions[i]["status"] = "denied"
                            st.session_state.actions[i]["details"] = f"Denied at {datetime.now(UTC).strftime('%H:%M:%S')}"
                            st.rerun()

            st.divider()

        # Summary
        completed = sum(1 for a in st.session_state.actions if a["status"] == "completed")
        total = len(st.session_state.actions)
        if completed == total:
            st.success(f"All {total} actions completed!")
            st.balloons()
        else:
            st.progress(completed / total, text=f"{completed}/{total} actions completed")

        if st.button("Clear All Actions"):
            st.session_state.actions = []
            st.session_state.diagnosis = None
            st.session_state.alerts = []
            st.rerun()


# ===========================================================================
# TAB 5: CREW OUTPUT
# ===========================================================================

with tab_crew:
    st.header("Agent Crew Output")

    if st.session_state.crew_running:
        st.info("Crew is currently running... This page will show results when complete.")
        st.markdown("The crew runs 3 agents sequentially:")
        st.markdown("1. **Monitor Agent** — Queries Snowflake for model metrics and drift scores")
        st.markdown("2. **Investigator Agent** — Searches runbooks and incidents via RAG")
        st.markdown("3. **Remediator Agent** — Executes actions (Slack, GitHub, retrain/rollback)")
        if st.button("Refresh", key="crew_refresh"):
            st.rerun()

    elif st.session_state.crew_result:
        st.success("Crew completed successfully!")
        st.markdown("### Full Crew Output")
        st.markdown(st.session_state.crew_result)

        st.divider()

        # Show recent log files
        logs_dir = os.path.join(os.path.dirname(__file__), "..", "logs")
        if os.path.isdir(logs_dir):
            log_files = sorted(
                [f for f in os.listdir(logs_dir) if f.endswith(".json")],
                reverse=True,
            )
            if log_files:
                st.subheader("Run Logs")
                selected_log = st.selectbox("Select log file", log_files)
                if selected_log:
                    with open(os.path.join(logs_dir, selected_log)) as lf:
                        log_data = json.load(lf)
                    st.json(log_data)

        if st.button("Clear Crew Output"):
            st.session_state.crew_result = None
            st.session_state.crew_error = None
            st.rerun()

    elif st.session_state.crew_error:
        st.error(f"Crew failed: {st.session_state.crew_error}")
        if st.button("Clear Error"):
            st.session_state.crew_error = None
            st.rerun()

    else:
        st.info("No crew runs yet. Click 'Run Full Demo' in the sidebar to start.")
        st.markdown("""
        ### How it works

        The AgentOps crew orchestrates 3 specialized agents via CrewAI:

        | Agent | Role | Tools |
        |-------|------|-------|
        | **Monitor** | Detects issues | Snowflake queries (metrics, drift, quality) |
        | **Investigator** | Diagnoses root cause | RAG search (runbooks, incidents) |
        | **Remediator** | Fixes issues | Retrain, rollback, Slack, GitHub |

        Each agent passes its findings to the next in a sequential pipeline.
        """)
