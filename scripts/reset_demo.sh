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
pkill -f "orchestrator" 2>/dev/null

echo ""
echo "Ready for demo. Start with:"
echo "  Terminal 1: bash dashboard/run_dashboard.sh"
echo "  Terminal 2: bash run_demo.sh"
