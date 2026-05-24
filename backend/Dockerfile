# syntax=docker/dockerfile:1.7

# ── Base image ────────────────────────────────────────────────────────────────
# python:3.12-slim is a stripped-down Debian image with Python 3.12 already
# installed. We pin to 3.12 to match .python-version. The -slim tag drops
# things like build tools and man pages — smaller and more secure.
FROM python:3.12-slim AS base

# Don't write .pyc files (saves disk) and force stdout/stderr to be unbuffered
# (so `docker logs` shows output in real time instead of in batches).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install OS packages we need:
#   - libpq5: runtime library psycopg2-binary depends on
#   - curl:   used by the HEALTHCHECK below
# We clean apt caches in the same RUN so they don't bloat the image layer.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

# Everything below lives in /app inside the container.
WORKDIR /app

# ── Dependencies layer ────────────────────────────────────────────────────────
# Copy *only* requirements.txt first, then install. Because Docker caches each
# layer, if requirements.txt hasn't changed since last build, this entire pip
# install step is reused from cache — even if our app code has changed.
# This is the single biggest reason to copy deps before source.
COPY requirements.txt .
RUN pip install -r requirements.txt

# ── App code layer ────────────────────────────────────────────────────────────
# Copy the rest of the backend. The .dockerignore file decides what's excluded.
COPY . .

# ── Runtime user ──────────────────────────────────────────────────────────────
# Don't run as root inside the container — if anything in the app gets
# compromised, the attacker is confined to a non-privileged user.
RUN useradd --create-home --shell /bin/bash app \
    && chown -R app:app /app
USER app

# ── Network + health ──────────────────────────────────────────────────────────
EXPOSE 8000

# Docker pings /health every 30s. Container is marked "unhealthy" after 3 fails.
# Compose / ECS use this to decide whether to route traffic to us.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

# ── Default command ───────────────────────────────────────────────────────────
# 0.0.0.0 (NOT 127.0.0.1!) so the container's port 8000 is reachable from
# outside the container. --reload is DEV only; we omit it here.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
