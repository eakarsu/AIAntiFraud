#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; test -n "${DATABASE_URL:-}" || { echo 'DATABASE_URL required' >&2; exit 1; }
# The legacy schema.sql is destructive and intentionally excluded. Provision it only
# in a disposable environment, then use this forward-only migration command.
for f in "$root"/server/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
