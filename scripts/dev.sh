#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Run this project with Node 22 and Corepack-enabled pnpm 9."
  echo "Example: mise exec node@22 -- bash -c 'corepack enable && corepack install --global pnpm@9 && pnpm studio'"
  exit 1
fi

API_URL="${API_URL:-http://localhost:3001}"
STUDIO_URL="${STUDIO_URL:-http://localhost:5173}"

echo "Starting API and Style Studio..."
echo "API:    $API_URL"
echo "Studio: $STUDIO_URL"

cleanup() {
  echo
  echo "Stopping local services..."
  if [ -n "${API_PID:-}" ]; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

pnpm --filter @low-poly-character-studio/api dev &
API_PID=$!

api_ready=false
for _ in $(seq 1 40); do
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "API process exited before becoming ready."
    wait "$API_PID"
    exit 1
  fi

  if command -v curl >/dev/null 2>&1; then
    if curl --silent --fail "$API_URL/health" >/dev/null 2>&1; then
      api_ready=true
      break
    fi
  else
    sleep 2
    api_ready=true
    break
  fi

  sleep 0.25
done

if [ "$api_ready" != true ]; then
  echo "API did not become ready at $API_URL within 10 seconds."
  exit 1
fi

echo "API ready. Launching Style Studio..."
pnpm --filter @low-poly-character-studio/style-studio dev
