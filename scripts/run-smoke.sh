#!/usr/bin/env bash
set -euo pipefail

# Simple wrapper to run the Playwright smoke test.
# Usage: export env vars per SMOKE_TESTS.md, then run: ./scripts/run-smoke.sh

if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found; install Node.js/npm"
  exit 1
fi

npx playwright test tests/e2e/smoke.spec.mjs --project=chromium --reporter=list
