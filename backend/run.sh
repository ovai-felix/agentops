#!/bin/bash
cd "$(dirname "$0")/.."
source .venv/bin/activate
PYTHONPATH=src uvicorn backend.api:app --port 8080 --reload
