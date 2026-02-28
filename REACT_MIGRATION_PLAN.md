# React Migration Execution Plan

> Replaces the Streamlit dashboard with React + FastAPI backend with real-time terminal UI.
> Split into 5 self-contained sessions for parallel execution across multiple Claude Code instances.

---

## Dependency Graph

```
S1 (Backend API)  ───────────────────────┐
                                          ├──▶ S4 (Integration + Polish)
S2 (React Scaffold + Terminal) ──────────┤
                                          │
S3 (Tab Components) ─────────────────────┘

S5 (Cleanup + Deploy) ──▶ after S4
```

**Parallel execution:** S1, S2, S3 can run simultaneously. S4 depends on all three. S5 is final.

---

## S1 — FastAPI Backend API + SSE Streaming

**Prerequisites:** Existing `src/` code (integrations, crew, tools, models, config)
**Estimated time:** 30-40 min
**Output:** Fully functional API server on port 8080

### Instructions

1. Install Python dependencies:
   ```bash
   source .venv/bin/activate
   pip install fastapi uvicorn sse-starlette
   ```

2. Create `backend/__init__.py` (empty)

3. Create `backend/event_bus.py` — Thread-safe pub/sub for SSE events:
   - `CrewEvent` dataclass: `event_type` (str), `data` (str), `timestamp` (str), `agent` (optional str)
   - `EventBus` class with:
     - `_subscribers: list[queue.Queue]` + `_lock: threading.Lock` + `_history: list[CrewEvent]`
     - `subscribe()` → returns a Queue, replays history to catch up late joiners
     - `unsubscribe(q)` → removes queue
     - `publish(event)` → appends to history + puts on all subscriber queues
     - `clear_history()` → resets for new crew run
   - Module-level singleton: `event_bus = EventBus()`

4. Create `backend/stdout_capture.py` — Tees sys.stdout to EventBus:
   - `StdoutCapture(io.TextIOBase)`:
     - `__init__(original_stdout)` — stores reference to real stdout
     - `write(text)` — writes to original stdout AND buffers lines, on newline classifies + publishes to event_bus
     - `_classify_line(line)` → returns event_type string:
       - "agent_start" if "working agent" or "agent:" in line
       - "tool_call" if "tool:" or "using tool:" in line
       - "task_complete" if "task output" or "task completed" in line
       - "reasoning" if "thought:" in line
       - "stdout" otherwise
     - `_extract_agent(line)` → scans for agent role names, returns name or None
     - `flush()` → flushes original

5. Create `backend/api.py` — FastAPI app with all endpoints:

   **Setup:**
   - `sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))` to import from src/
   - Load .env via dotenv
   - Import `SnowflakeClient`, `RAGClient`, `MLMonitoringClient`, `AgentOpsCrew`
   - Import `event_bus`, `StdoutCapture`
   - CORS middleware allowing `http://localhost:5173`
   - App state: `crew_running=False`, `crew_result=None`, `crew_error=None`, `actions=[]`, `diagnosis=None`

   **Health endpoint:**
   - `GET /api/health` → checks Snowflake (`SELECT 1`), RAG (`/health`), ML Monitoring (`/health`), returns status dict

   **Metrics endpoints (wrap SnowflakeClient):**
   - `GET /api/metrics/model` → `sf.get_latest_model_metrics()` → return first row as JSON with health assessment (same logic as `fetch_model_metrics()` in streamlit_app.py lines 98-125)
   - `GET /api/metrics/data-quality` → `sf.get_data_quality()` → return latest row
   - `GET /api/metrics/feature-drift` → `sf.get_feature_drift()` → return all rows sorted by PSI desc
   - `GET /api/metrics/trend/{metric}?hours=48` → `sf.get_metric_trend("classifier_v2", metric, hours)` → return list of `{ts, value}` points
   - `GET /api/incidents` → `sf.get_incidents(limit=10)` → return incident list

   **Alert detection:**
   - `POST /api/alerts/check` → replicate the alert detection logic from streamlit_app.py lines 389-425:
     - Query latest metrics
     - Check F1 < 0.88 → accuracy_drop alert
     - Check drift > 0.3 → model_drift alert
     - Return list of alert objects
   - Store alerts in `app.state.alerts`

   **Investigation:**
   - `POST /api/investigate` (body: `{query: str}`) → call `rag.query(query)` → return answer
   - `POST /api/investigate/auto` (body: `{alert: dict}`) → replicate streamlit_app.py investigation flow:
     - Search runbooks with alert description
     - Search incidents with alert description
     - Build diagnosis object with root_cause, similar_incidents, recommended_actions
     - Store in `app.state.diagnosis`
     - Return diagnosis

   **Actions:**
   - `GET /api/actions` → return `app.state.actions` list
   - `POST /api/actions/execute` (body: `{index: int}`) → execute non-approval action, update status
   - `POST /api/actions/approve` (body: `{index: int}`) → call `ml_client.trigger_retraining()` or `ml_client.rollback_model()`, update status
   - `POST /api/actions/deny` (body: `{index: int}`) → set status to denied
   - `POST /api/actions/set` (body: list of action objects) → set the actions list (called after investigation)

   **Crew execution:**
   - `GET /api/crew/status` → return `{running, result, error}`
   - `POST /api/crew/start` → if not running, spawn daemon thread:
     - Set `crew_running = True`, clear event_bus history
     - Redirect sys.stdout to StdoutCapture
     - Publish `crew_start` event
     - Call `AgentOpsCrew().run(context="Check for model drift...")`
     - On success: store result, publish `complete` event
     - On error: store error, publish `error` event
     - Finally: restore sys.stdout, set `crew_running = False`
   - `GET /api/crew/stream` → SSE endpoint:
     - Subscribe to event_bus
     - Yield events as `{event: type, data: JSON}`
     - Send `ping` every 1s during idle
     - Close on `complete` or `error` event
     - Unsubscribe on disconnect

### Verification
```bash
# Start server
PYTHONPATH=src uvicorn backend.api:app --port 8080 --reload

# Test endpoints
curl http://localhost:8080/api/health
curl http://localhost:8080/api/metrics/model
curl http://localhost:8080/api/metrics/feature-drift
curl -X POST http://localhost:8080/api/alerts/check
curl -X POST http://localhost:8080/api/crew/start
curl -N http://localhost:8080/api/crew/stream  # should see SSE events
```

---

## S2 — React Scaffold + Terminal Component + Layout

**Prerequisites:** Node.js 18+
**Estimated time:** 30-40 min
**Output:** React app with working terminal UI, sidebar, and tab navigation

### Instructions

1. Scaffold the project:
   ```bash
   cd /Users/omatsone/Desktop/projectAI/agentops
   npm create vite@latest frontend -- --template react
   cd frontend
   npm install
   npm install -D tailwindcss @tailwindcss/vite
   npm install recharts
   ```

2. Configure Vite (`frontend/vite.config.js`):
   ```javascript
   import { defineConfig } from 'vite'
   import react from '@vitejs/plugin-react'
   import tailwindcss from '@tailwindcss/vite'

   export default defineConfig({
     plugins: [react(), tailwindcss()],
     server: {
       proxy: {
         '/api': 'http://localhost:8080'
       }
     }
   })
   ```

3. Configure Tailwind — replace `frontend/src/index.css` with:
   ```css
   @import "tailwindcss";
   ```

4. Create `frontend/src/api.js` — API helpers:
   - `fetchJSON(path)` → GET with error handling, uses relative `/api/...` (proxied by Vite)
   - `postJSON(path, body)` → POST with JSON body
   - `useCrewStream(onEvent, enabled)` → React hook that:
     - Creates EventSource to `/api/crew/stream` when `enabled=true`
     - Listens for typed events: `stdout`, `agent_start`, `tool_call`, `task_complete`, `reasoning`, `complete`, `error`
     - Calls `onEvent(parsedData)` for each
     - Cleans up on unmount or `enabled=false`

5. Create `frontend/src/context/AppContext.jsx` — Global state:
   - `useReducer` with initial state:
     ```
     services: {snowflake: null, rag: null, mlmonitor: null}
     modelMetrics: null, dataQuality: null, featureDrift: [], f1Trend: [], driftTrend: []
     alerts: [], incidents: []
     diagnosis: null
     actions: []
     crewRunning: false, crewResult: null, crewError: null, crewLines: []
     activeTab: "status"
     ```
   - Actions: `SET_SERVICES`, `SET_METRICS`, `SET_DATA_QUALITY`, `SET_FEATURE_DRIFT`, `SET_F1_TREND`, `SET_DRIFT_TREND`, `SET_ALERTS`, `SET_INCIDENTS`, `SET_DIAGNOSIS`, `SET_ACTIONS`, `UPDATE_ACTION`, `CREW_START`, `CREW_LINE`, `CREW_COMPLETE`, `CREW_ERROR`, `CLEAR_CREW`, `SET_TAB`
   - Export `AppProvider` wrapper and `useApp()` hook

6. Create `frontend/src/components/Terminal.jsx`:
   - Props: `lines` (array of `{type, data, timestamp, agent}`), `onClear` callback
   - Dark terminal container: `bg-gray-900 rounded-lg font-mono text-sm`
   - Fixed height with `overflow-y-auto`, ref for auto-scroll
   - Sticky header bar: "Agent Terminal" label + Clear button + Auto-scroll toggle
   - Line rendering: each line gets color class based on `type`:
     - `agent_start` → `text-cyan-400`
     - `tool_call` → `text-yellow-400`
     - `task_complete` → `text-green-400`
     - `reasoning` → `text-gray-500`
     - `error` → `text-red-400`
     - `stdout` → `text-gray-300`
   - Timestamp prefix in `text-gray-600`
   - `useEffect` for auto-scroll to bottom when new lines arrive
   - 1000-line max buffer (trim oldest)

7. Create `frontend/src/components/Layout.jsx`:
   - Two-column layout: sidebar (fixed width ~280px) + main content area
   - Dark theme: `bg-gray-950 text-white min-h-screen`

8. Create `frontend/src/components/Sidebar.jsx`:
   - AgentOps logo/title
   - Service health indicators (green/red dots for Snowflake, RAG, ML Monitoring)
   - Fetches `/api/health` on mount
   - Tab navigation buttons: Status, Alerts, Investigation, Actions, Crew
   - "Run Full Crew" button (POST `/api/crew/start`, toggles crew streaming)
   - Crew status indicator (running spinner / completed badge / error badge)

9. Update `frontend/src/App.jsx`:
   - Wrap in `AppProvider`
   - Render `Layout` with `Sidebar` + tab content based on `activeTab`
   - Wire up `useCrewStream` hook: when crewRunning, dispatch `CREW_LINE` for each event, `CREW_COMPLETE`/`CREW_ERROR` on finish
   - Placeholder divs for tab content (to be filled in S3)

10. Update `frontend/index.html` — set title to "AgentOps"

### Verification
```bash
cd frontend && npm run dev
# Open http://localhost:5173
# Should see: dark layout, sidebar with tabs, service health dots, "Run Full Crew" button
# Terminal component visible on Crew tab (empty initially)
```

---

## S3 — Tab Components (Status, Alerts, Investigation, Actions, Crew)

**Prerequisites:** S2 scaffold exists (AppContext, api.js, Layout, Terminal)
**Estimated time:** 40-50 min
**Output:** All 5 tabs fully functional with data display

### Instructions

1. Create `frontend/src/components/MetricCard.jsx`:
   - Props: `title`, `value`, `unit`, `status` (healthy/warning/critical), `subtitle`
   - Card with colored left border based on status (green/yellow/red)
   - Large value display, small subtitle

2. Create `frontend/src/components/SeverityBadge.jsx`:
   - Props: `severity` (critical/warning/info)
   - Pill-shaped badge with color: red/yellow/blue

3. Create `frontend/src/components/StatusTab.jsx`:
   - On mount: fetch `/api/metrics/model`, `/api/metrics/data-quality`, `/api/metrics/feature-drift`, `/api/metrics/trend/f1_score?hours=48`, `/api/metrics/trend/drift_score?hours=48`
   - 4 MetricCards in a grid: F1 Score, Drift Score, Data Quality (null rate), Latency p99
   - Status assessment per card (same thresholds as snowflake_tools.py)
   - 2 recharts `<LineChart>` side by side: F1 trend (blue line) + Drift trend (red line)
   - Feature drift table: feature name, PSI, KS stat, status badge
   - Color highlight rows where PSI > 0.3 (critical) or > 0.2 (warning)

4. Create `frontend/src/components/AlertsTab.jsx`:
   - "Check for Alerts Now" button → POST `/api/alerts/check` → dispatch `SET_ALERTS`
   - Alert list: each alert as an expandable card showing severity badge, alert_type, timestamp, metrics, message
   - "Investigate" button on each alert → POST `/api/investigate/auto` with alert → dispatch `SET_DIAGNOSIS` + switch to Investigation tab
   - Historical incidents table at bottom → GET `/api/incidents`

5. Create `frontend/src/components/InvestigateTab.jsx`:
   - Text input + "Search" button for manual RAG query → POST `/api/investigate`
   - Display RAG answer
   - If diagnosis exists (from auto-investigate):
     - Root Cause Analysis section (cites runbook reference)
     - Similar Past Incidents section (list with dates + descriptions)
     - Recommended Actions list (action, priority, requires_approval flag)
   - "Execute Remediation Plan" button → POST `/api/actions/set` with recommended actions → dispatch `SET_ACTIONS` + switch to Actions tab

6. Create `frontend/src/components/ActionsTab.jsx`:
   - Action list: each action shows status icon, action description, requires_approval flag
   - For non-approval actions: "Execute" button → POST `/api/actions/execute`
   - For approval-required actions: "Approve" / "Deny" buttons → POST `/api/actions/approve` or `/api/actions/deny`
   - Progress bar: completed / total
   - "Clear All" button to reset
   - On approve of retraining: calls the ML Monitoring trigger_retraining endpoint via backend
   - On approve of rollback: calls the ML Monitoring rollback endpoint via backend

7. Create `frontend/src/components/CrewTab.jsx`:
   - Terminal component (from S2) showing `crewLines` from context
   - Below terminal: crew result panel (shown when crewResult is set)
   - If crewError: red error box
   - "How it works" table: 3-row table explaining Monitor → Investigator → Remediator pipeline

8. Wire all tabs into `App.jsx`:
   - Import all tab components
   - Render based on `activeTab` from context

### Verification
```bash
# With backend running (S1): PYTHONPATH=src uvicorn backend.api:app --port 8080
cd frontend && npm run dev
# Open http://localhost:5173

# Test each tab:
# Status: should show 4 metric cards, 2 trend charts, drift table
# Alerts: click "Check for Alerts Now" → 2 critical alerts appear
# Investigation: click "Investigate" on an alert → diagnosis appears
# Actions: click "Execute Remediation Plan" → 4 actions with buttons
# Crew: click "Run Full Crew" → terminal shows live agent output
```

---

## S4 — Integration Testing + Wiring

**Prerequisites:** S1, S2, S3 all complete
**Estimated time:** 20-30 min
**Output:** Fully integrated, end-to-end working demo

### Instructions

1. Start all services:
   ```bash
   # Terminal 1: FastAPI backend
   cd /Users/omatsone/Desktop/projectAI/agentops
   source .venv/bin/activate
   PYTHONPATH=src uvicorn backend.api:app --port 8080

   # Terminal 2: React frontend
   cd /Users/omatsone/Desktop/projectAI/agentops/frontend
   npm run dev

   # Verify sibling services are running:
   curl http://localhost:8003/health  # RAG
   curl http://localhost:8000/health  # ML Monitoring
   ```

2. Full demo walkthrough:
   - Open http://localhost:5173
   - **Status tab**: Verify F1=~0.83, Drift=~0.45, trend charts show spike, V14/V17 highlighted red in drift table
   - **Alerts tab**: Click "Check for Alerts Now" → 2 CRITICAL alerts (accuracy_drop + model_drift)
   - Click "Investigate" on drift alert → switches to Investigation tab
   - **Investigation tab**: Verify runbook results, similar incidents, recommended actions load
   - Click "Execute Remediation Plan" → switches to Actions tab
   - **Actions tab**: 4 actions shown. Execute Slack + GitHub. Approve retraining.
   - **Crew tab**: Click "Run Full Crew" in sidebar → Terminal shows real-time output with color-coded agent steps

3. Fix any integration issues:
   - CORS errors → check FastAPI middleware
   - SSE connection drops → check EventBus cleanup
   - Data format mismatches → verify API response shapes match frontend expectations
   - Crew not streaming → verify stdout_capture is active during crew thread

4. Create `backend/run.sh`:
   ```bash
   #!/bin/bash
   cd "$(dirname "$0")/.."
   source .venv/bin/activate
   PYTHONPATH=src uvicorn backend.api:app --port 8080 --reload
   ```

5. Update `DEMO_SCRIPT.md` with new startup commands:
   - Terminal 1: `bash backend/run.sh`
   - Terminal 2: `cd frontend && npm run dev`
   - Browser: `http://localhost:5173`

### Verification
- Complete demo flow works end-to-end without errors
- Terminal shows real-time agent output (not just final result)
- All 5 tabs display correct data
- Service health indicators in sidebar are accurate

---

## S5 — Cleanup + Git Push

**Prerequisites:** S4 complete
**Estimated time:** 10-15 min

### Instructions

1. Update `pyproject.toml` with new backend dependencies:
   ```
   fastapi>=0.109.0
   uvicorn>=0.27.0
   sse-starlette>=1.8.0
   ```

2. Add to `.gitignore`:
   ```
   frontend/node_modules/
   frontend/dist/
   ```

3. Update `README.md`:
   - Update setup instructions to include `cd frontend && npm install`
   - Update run instructions: backend (uvicorn) + frontend (npm run dev)
   - Note: Streamlit dashboard remains as fallback at `dashboard/streamlit_app.py`

4. Update `scripts/reset_demo.sh` to also kill uvicorn if running

5. Git commit and push:
   ```bash
   git add -A
   git commit -m "Add React dashboard with real-time terminal UI"
   git push origin main
   ```

### Verification
- `git status` shows clean working tree
- GitHub repo has all new files
- Fresh clone + install + run works
