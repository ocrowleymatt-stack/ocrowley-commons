# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY python/ocrowley_osint ./python/ocrowley_osint
RUN npm ci
# Build in dependency order — npm -w A -w B runs workspaces in parallel.
# Force emit: host tsbuildinfo must not be present (see .dockerignore).
RUN npm run build -w @ocrowley/persistence \
  && npm run build -w @ocrowley/audit \
  && npm run build -w @ocrowley/crypto \
  && npm run build -w @ocrowley/jobs \
  && npm run build -w @ocrowley/policy \
  && npm run build -w @ocrowley/darkweb \
  && npm run build -w @ocrowley/osint
RUN pip3 install --break-system-packages -e ./python/ocrowley_osint

FROM node:22-bookworm-slim AS who
WORKDIR /app
ENV NODE_ENV=production \
    OCROWLEY_WHO_HOST=0.0.0.0 \
    OCROWLEY_WHO_PORT=8787 \
    OCROWLEY_DATA_DIR=/data \
    OCROWLEY_BB_AUTOSTART=0 \
    OCROWLEY_WHO_WORKER=1 \
    OCROWLEY_BIGBROTHER_BRIDGE=http://bb:8798
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app /app
RUN mkdir -p /data/who-archive /data/who-dossiers /data/who-audit /data/who-entities /data/caspa-jobs
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -sf http://127.0.0.1:8787/api/health || exit 1
CMD ["node", "packages/osint/bin/who-server.mjs"]

FROM who AS who-worker
ENV OCROWLEY_WHO_WORKER=0
CMD ["node", "packages/osint/bin/who-worker.mjs"]

FROM python:3.12-slim AS bb
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY python/ocrowley_osint ./python/ocrowley_osint
RUN pip install --no-cache-dir -e ./python/ocrowley_osint
EXPOSE 8798
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8798/health')" || exit 1
CMD ["python", "-m", "ocrowley_osint", "--host", "0.0.0.0", "--port", "8798"]
