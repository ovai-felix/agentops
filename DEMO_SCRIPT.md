# AgentOps Demo Script (3 minutes)

> Run `bash scripts/reset_demo.sh` before each demo attempt.
> Then start: Terminal 1: `bash dashboard/run_dashboard.sh` | Terminal 2: ready for `bash run_demo.sh`

---

## 0:00–0:15 — Intro (spoken)

**Say:**
> "AgentOps is an autonomous MLOps platform. When ML models degrade in
> production, AgentOps detects the issue, diagnoses the root cause using
> internal knowledge, and remediates it — all with human approval gates.
> It's built on three production systems we've developed, orchestrated
> by a multi-agent crew."

**Show:** Architecture diagram (sidebar or a prepared slide)

---

## 0:15–0:30 — Healthy Dashboard

**Show:** Browser at `http://localhost:8502` — **Status** tab

**Point out:**
- F1 Score: ~0.91 baseline over 7 days (blue trend line)
- Drift Score: low ~0.08 baseline, then spiking in last 2 hours (red trend line)
- Data Quality: healthy, null rate < 1%
- Latency: p99 ~220ms (green)

**Say:**
> "Here's our fraud detection model in production. The status dashboard
> pulls live data from Snowflake. Notice the drift score — it's been
> climbing over the last two hours."

---

## 0:30–1:00 — Alert Detection

**Action:** Click the **Alerts** tab → Click **"Check for Alerts Now"**

**What happens:**
- Two alerts appear: "Accuracy Drop" (F1=0.82) and "Model Drift" (drift=0.44)
- Both show as CRITICAL with red badges

**Say:**
> "The Monitor Agent has detected two critical issues: model accuracy
> has dropped from 0.91 to 0.82, and the aggregate drift score is 0.44 —
> well above our 0.3 threshold. Let's investigate."

**Action:** Click **"Investigate"** on the drift alert

---

## 1:00–1:45 — Investigation

**What happens:** Auto-switches to **Investigation** tab. Two spinners run:
1. "Searching runbooks..." → returns remediation procedures
2. "Searching incidents..." → finds INC-2026-0115 (V14 drift)

**Point out (once loaded):**
- **Root Cause Analysis** — cites `model_drift.md` runbook with specific steps
- **Similar Past Incidents** — finds the January V14 drift incident caused by vendor API change
- **Recommended Actions** — 4 actions listed with approval requirements

**Say:**
> "The Investigator Agent searched our operational runbooks and found the
> exact procedures for handling drift. It also found a similar incident
> from January where V14 drifted due to a vendor API change.
> It recommends: notify the team, create a tracking issue, retrain the model,
> and rollback if retraining fails."

---

## 1:45–2:30 — Remediation

**Action:** Click **"Execute Remediation Plan"** → switches to **Actions** tab

**Show:** 4 actions with status indicators:
1. Send Slack notification — ⏳ PENDING (no approval needed)
2. Create GitHub issue — ⏳ PENDING (no approval needed)
3. Trigger model retraining — ⏳ PENDING (requires approval 🔒)
4. Rollback model — ⏳ PENDING (requires approval 🔒)

**Action:** Click **"Execute"** on Slack notification → turns ✅ COMPLETED

**Action:** Click **"Execute"** on GitHub issue → turns ✅ COMPLETED

**Say:**
> "Low-risk actions execute immediately. For high-risk actions like
> retraining or rollback, the system pauses for human approval."

**Action:** Click **"Approve"** on model retraining → turns ✅ COMPLETED
- If ML Monitoring is running, this actually triggers `POST /training/trigger`

**Say:**
> "With one click, the model retraining job is triggered. The system
> calls our ML monitoring API to start the training pipeline."

**Action:** Click **"Approve"** on rollback (or deny if retrain was enough)

**Show:** Progress bar hits 100%, balloons appear

---

## 2:30–2:45 — Crew Output (Optional — if time permits)

**Action:** Switch to **Crew Output** tab

**Say:**
> "For the full autonomous flow, our CrewAI crew runs all three agents
> end-to-end without manual intervention."

**Action:** (If already ran crew earlier) Show the full output with agent reasoning

---

## 2:45–3:00 — Wrap Up

**Say:**
> "What you just saw took under 3 minutes. A human doing this manually —
> checking dashboards, reading runbooks, searching past incidents, filing
> tickets, triggering retraining — that takes 2 to 4 hours.
>
> AgentOps is built on Snowflake for metrics storage, CrewAI for
> multi-agent orchestration, and Composio for Slack and GitHub integrations.
> Three production systems, one autonomous platform.
>
> From alert to resolution in minutes, not hours."

---

## Pre-Demo Checklist

```
[ ] Run: bash scripts/reset_demo.sh
[ ] Verify: Snowflake data shows drift (latest F1 ~0.82, drift ~0.44)
[ ] Verify: RAG system running (curl http://localhost:8003/health)
[ ] Verify: ML Monitoring running (curl http://localhost:8000/health)
[ ] Launch: bash dashboard/run_dashboard.sh
[ ] Open:   http://localhost:8502 in browser
[ ] Test:   Click through all tabs once to warm up connections
[ ] Clear:  Refresh the page to reset session state
```

## Fallback Plan

If a service is down during demo:
- **Snowflake down:** Status tab will show error, but Alerts/Investigation still work from cached data
- **RAG down:** Investigation tab shows error; explain the RAG concept verbally, show the runbook files
- **ML Monitoring down:** Actions tab will show API error on approve; explain the blue-green deploy concept
- **CrewAI slow:** Use the manual flow (Alerts → Investigate → Actions) instead of Crew Output tab
