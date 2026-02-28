#!/bin/bash
cd "$(dirname "$0")"
source .venv/bin/activate 2>/dev/null
export PYTHONPATH=src:$PYTHONPATH
python3 src/orchestrator.py --mode demo
