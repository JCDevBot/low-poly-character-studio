#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  if [ -d "$HOME/.nvm/versions/node/v22.22.3/bin" ]; then
    export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Open the same shell you used for pnpm install, or run:"
  echo '  export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"'
  exit 1
fi

echo "Starting API and Style Studio..."
echo "API:    http://localhost:3001"
echo "Studio: http://localhost:5173"

cleanup() {
  echo
  echo "Stopping local services..."
  if [ -n "${API_PID:-}" ]; then
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

pnpm --filter @low-poly-character-studio/api dev &
API_PID=$!

sleep 2

pnpm --filter @low-poly-character-studio/style-studio dev
