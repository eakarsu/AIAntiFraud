#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
test -f "$root/.env" || { echo 'Missing .env; copy .env.example.' >&2; exit 1; }
test -d "$root/node_modules" && test -d "$root/client/node_modules" || { echo 'Dependencies missing; run scripts/bootstrap.sh.' >&2; exit 1; }
(cd "$root" && npm start) & backend_pid=$!
(cd "$root/client" && BROWSER=none npm start) & frontend_pid=$!
cleanup(){ kill "$backend_pid" "$frontend_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
wait "$backend_pid" "$frontend_pid"
