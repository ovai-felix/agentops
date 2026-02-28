#!/bin/bash
# Reset everything to pre-demo state
cd "$(dirname "$0")/.."
source .venv/bin/activate 2>/dev/null
export PYTHONPATH=src:$PYTHONPATH

echo "Resetting Snowflake seed data..."
python seed/reset_demo.py

echo ""
echo "Killing any running services..."
pkill -f "streamlit run dashboard" 2>/dev/null
pkill -f "uvicorn backend" 2>/dev/null
pkill -f "orchestrator" 2>/dev/null

echo ""
echo "Ready for demo. Start with:"
echo "  Terminal 1: bash backend/run.sh           # FastAPI on :8080"
echo "  Terminal 2: cd frontend && npm run dev    # React on :5173"
echo "  Terminal 3: bash run_demo.sh              # (optional CLI)"
