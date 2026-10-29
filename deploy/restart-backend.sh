#!/usr/bin/env bash
set -euo pipefail

BACKEND_DIR="${BACKEND_DIR:-/home/blog-deploy/apps/kirameku/backend}"
cd "$BACKEND_DIR"

if [[ ! -f .env ]]; then
  echo "Missing ${BACKEND_DIR}/.env — create it on the server before deploy."
  exit 1
fi

if [[ ! -d admin/dist ]]; then
  echo "Missing admin/dist — admin must be built on GitHub Actions before rsync."
  exit 1
fi

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck source=/dev/null
source .venv/bin/activate

pip install -U pip
pip install -r requirements.txt python-dotenv

set -a
# shellcheck source=/dev/null
source .env
set +a

if ! psql "$DATABASE_URL" -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user'" | grep -q 1; then
  echo "Schema missing — applying init_db.sql"
  psql "$DATABASE_URL" -f init_db.sql
fi

mkdir -p logs uploads

if command -v fuser >/dev/null 2>&1; then
  fuser -k 8200/tcp 2>/dev/null || true
else
  pkill -f "[u]vicorn app.main:app.*8200" 2>/dev/null || true
fi
sleep 1

nohup uvicorn app.main:app --host 127.0.0.1 --port 8200 >> logs/backend.log 2>&1 &
echo "Backend started: http://127.0.0.1:8200 (see logs/backend.log)"
