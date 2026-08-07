FROM python:3.12-slim

# OpenCV (used by the ingestion subprocess) needs these system libs.
# tesseract-ocr is the system binary behind pytesseract (scoreboard OCR).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    ffmpeg \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# ── Backend ────────────────────────────────────────────────────────────────
# Step 1: install only dependencies (cached as long as pyproject.toml unchanged)
COPY packages/backend/pyproject.toml ./packages/backend/
RUN cd packages/backend && uv sync --no-dev --no-install-project

# Step 2: copy source, then install the project itself (editable) on top
COPY packages/backend/src ./packages/backend/src
RUN cd packages/backend && uv sync --no-dev

# ── Ingestion ──────────────────────────────────────────────────────────────
# Install WITH [cv] extras so torch + ultralytics are pre-baked into the image.
# This makes the image ~5 GB but avoids a runtime download on first upload.
# The backend spawns:  packages/ingestion/.venv/bin/python -m ingestion.cli
COPY packages/ingestion/pyproject.toml ./packages/ingestion/
RUN cd packages/ingestion && uv sync --no-dev --extra cv --no-install-project

COPY packages/ingestion/src ./packages/ingestion/src
RUN cd packages/ingestion && uv sync --no-dev --extra cv

# ── ML (batch scoring) ──────────────────────────────────────────────────────
# The backend spawns:  packages/ml/.venv/bin/... via `uv run wels-score`.
# torch is already cached from the ingestion layer; this adds torch-geometric.
COPY packages/ml/pyproject.toml ./packages/ml/
RUN cd packages/ml && uv sync --no-dev --no-install-project

COPY packages/ml/src ./packages/ml/src
RUN cd packages/ml && uv sync --no-dev

# ── Scripts (Google Drive model download) ─────────────────────────────────
COPY scripts/ ./scripts/
COPY docker/download_models_docker.py ./docker/download_models_docker.py
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x /app/docker/entrypoint.sh

# ── Runtime directories ────────────────────────────────────────────────────
RUN mkdir -p \
    data/input/videos \
    data/input/models/ingestion \
    data/output/videos \
    data/output/duckdb \
    credentials

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -sf http://localhost:8000/health || exit 1

ENTRYPOINT ["/app/docker/entrypoint.sh"]
