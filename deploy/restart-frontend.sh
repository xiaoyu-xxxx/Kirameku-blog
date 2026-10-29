#!/usr/bin/env bash
set -euo pipefail

FRONTEND_DIR="${FRONTEND_DIR:-/home/blog-deploy/apps/kirameku/frontend}"
cd "$FRONTEND_DIR"

mkdir -p logs

if command -v fuser >/dev/null 2>&1; then
  fuser -k 3200/tcp 2>/dev/null || true
else
  pkill -f "[n]ext start" 2>/dev/null || true
fi
sleep 1

export PORT=3200
export HOSTNAME=127.0.0.1
export NODE_OPTIONS=--max-old-space-size=384

nohup pnpm start >> logs/frontend.log 2>&1 &
echo "Frontend started: http://${HOSTNAME}:${PORT} (see logs/frontend.log)"
