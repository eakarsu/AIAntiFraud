#!/usr/bin/env bash
set -euo pipefail
test "${CONFIRM_DEMO_SEED:-}" = yes || { echo 'Set CONFIRM_DEMO_SEED=yes.' >&2; exit 1; }
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; test -n "${DATABASE_URL:-}" || exit 1
(cd "$root" && npm run db:seed)
