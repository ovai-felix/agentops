#!/bin/bash
cd "$(dirname "$0")/.."
source .venv/bin/activate 2>/dev/null
export PYTHONPATH=src:$PYTHONPATH
streamlit run dashboard/streamlit_app.py --server.port 8502
