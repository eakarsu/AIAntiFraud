#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
test -f "$root/.env" || { echo 'Missing .env; copy .env.example.' >&2; exit 1; }
set -a; source "$root/.env"; set +a
: "${BACKEND_PORT:=${PORT:-3001}}" "${FRONTEND_PORT:=3000}"
: "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY is required}"
: "${OPENROUTER_MODEL:?OPENROUTER_MODEL is required}"
: "${OPENROUTER_BASE_URL:?OPENROUTER_BASE_URL is required}"
[ "$OPENROUTER_BASE_URL" = "https://openrouter.ai/api/v1" ] || { echo 'OPENROUTER_BASE_URL must be https://openrouter.ai/api/v1' >&2; exit 1; }
test -d "$root/node_modules" && test -d "$root/client/node_modules" || { echo 'Dependencies missing; run scripts/bootstrap.sh.' >&2; exit 1; }
for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do if lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then echo "Port $port is occupied; refusing to terminate another process." >&2; exit 1; fi; done
if [ "${MIGRATE_ON_START:-false}" = true ]; then
  case "${ALLOW_SCHEMA_MIGRATION:-}" in 1|true) ;; *) echo 'ALLOW_SCHEMA_MIGRATION=1 or true is required for startup migration.' >&2; exit 1;; esac
  "$root/scripts/migrate.sh"
  node "$root/server/scripts/create-admin.js"
fi
(cd "$root" && PORT="$BACKEND_PORT" CLIENT_URL="http://127.0.0.1:$FRONTEND_PORT" npm start) & backend_pid=$!
(cd "$root/client" && BROWSER=none PORT="$FRONTEND_PORT" REACT_APP_API_BASE="http://127.0.0.1:$BACKEND_PORT/api" ./node_modules/.bin/react-scripts start) & frontend_pid=$!
cleanup(){ kill "$backend_pid" "$frontend_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
wait "$backend_pid" "$frontend_pid"
