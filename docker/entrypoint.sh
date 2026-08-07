#!/bin/bash
set -e

PYTHON=/app/packages/backend/.venv/bin/python

if [ -f /app/credentials/token.json ]; then
    "$PYTHON" /app/docker/download_models_docker.py &
else
    echo "==> No credentials/token.json found — skipping model download."
    echo "    Run 'make auth' locally and restart to enable automatic model download."
fi

exec /app/packages/backend/.venv/bin/uvicorn backend.app:app \
    --host 0.0.0.0 --port 8000
