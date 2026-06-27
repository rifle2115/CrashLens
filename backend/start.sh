#!/bin/sh
# Container start script: run DB migrations, then launch the API.
# Used by Render (and anywhere that wants migrate-then-serve in one process).
# $PORT is provided by the platform; falls back to 8000 for local runs.
set -e

echo "==> Running database migrations..."
alembic upgrade head

echo "==> Starting uvicorn on port ${PORT:-8000}..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
