# ClaudeClaw container build.
# Multi-stage:
#   1. node-builder  → compiles TS + Vite SPA into dist/
#   2. py-builder    → builds warroom/.venv with pipecat-ai deps
#   3. runtime       → slim Node 22 + Python runtime + artifacts from above
#
# Persistent state (SQLite + JSON) lives at /app/store, mounted as a Fly
# volume so the container itself stays stateless and disposable.

# ─────────────────────── Stage 1: Node builder ──────────────────────────────
FROM node:22-bookworm AS node-builder

WORKDIR /app

# Native modules (better-sqlite3) need build tooling
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json vite.config.ts ./
COPY src ./src
COPY web ./web
RUN npm run build

# ────────────────────── Stage 2: Python venv builder ────────────────────────
# Built separately so we can keep heavy build tooling (gcc, libffi-dev, etc.)
# out of the final image. The resulting /app/warroom/.venv contains all
# pipecat-ai deps and is copied verbatim into the runtime stage.
FROM python:3.11-bookworm AS py-builder

WORKDIR /app

# Build dependencies for pipecat-ai's native wheels (silero needs torch,
# cartesia/deepgram use cffi, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libffi-dev libssl-dev \
      libsndfile1-dev libportaudio2 portaudio19-dev \
    && rm -rf /var/lib/apt/lists/*

COPY warroom/requirements.txt /app/warroom/requirements.txt

# Create venv at the EXACT path the Node code expects: /app/warroom/.venv
RUN python3 -m venv /app/warroom/.venv \
 && /app/warroom/.venv/bin/pip install --no-cache-dir --upgrade pip \
 && /app/warroom/.venv/bin/pip install --no-cache-dir -r /app/warroom/requirements.txt

# ────────────────────────── Stage 3: runtime ────────────────────────────────
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    DASHBOARD_PORT=3141 \
    CLAUDECLAW_AGENT_ID=main \
    CLAUDECLAW_DEPLOY=fly \
    PATH="/app/warroom/.venv/bin:${PATH}"

# Runtime deps:
#   - Python 3.11 runtime (matches the py-builder stage)
#   - libsndfile1 / libportaudio2 → silero VAD + audio io
#   - ca-certs, tini, git, rsync, sqlite3 → already needed
#   - syncthing → bidirectional Obsidian vault sync with Mac
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates tini git rsync sqlite3 curl \
      python3.11 python3.11-venv \
      libsndfile1 libportaudio2 \
      syncthing \
    && rm -rf /var/lib/apt/lists/* \
 && ln -sf /usr/bin/python3.11 /usr/local/bin/python3

WORKDIR /app

# Production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Claude Code CLI — the @anthropic-ai/claude-agent-sdk spawns `claude` as a
# subprocess. Install globally so it's in $PATH for the bot's child processes.
RUN npm install -g @anthropic-ai/claude-code && npm cache clean --force

# Built Node artifacts + connectors + agents + system files
COPY --from=node-builder /app/dist ./dist
COPY connectors ./connectors
COPY scripts/notify.sh ./scripts/notify.sh
COPY CLAUDE.md ./CLAUDE.md
COPY agents ./agents

# War Room: source files + the pre-built Python venv
COPY warroom ./warroom
COPY --from=py-builder /app/warroom/.venv ./warroom/.venv

# Run as non-root user. Claude Code CLI refuses to run with
# --dangerously-skip-permissions as root, so the bot subprocess fails when
# running as root. The node:bookworm-slim image already ships with a `node`
# user (uid 1000); we reuse it and place credentials at /home/node/.claude.
RUN mkdir -p /app/store /app/logs /home/node/.claude \
 && chown -R node:node /app /home/node

# Entrypoint shim: bridges Fly-injected env secrets into /app/.env so the
# Node app's readEnvFile() (which reads from disk, not process.env) finds
# them. See docker-entrypoint.sh for rationale.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3141

USER node

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
