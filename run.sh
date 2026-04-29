#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  echo
  echo "Cerrando procesos..."
  [[ -n "${SERVER_PID:-}" ]] && kill "${SERVER_PID}" 2>/dev/null || true
  [[ -n "${PANEL_PID:-}" ]] && kill "${PANEL_PID}" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

echo "Arrancando backend..."
(cd "$ROOT_DIR/server" && DOTENV_CONFIG_PATH=../.env npm run dev) &
SERVER_PID=$!

echo "Arrancando frontend..."
(cd "$ROOT_DIR/panel" && npm run dev) &
PANEL_PID=$!

echo
echo "Listo."
echo "Backend:  http://localhost:3000"
echo "Panel:    http://localhost:5173"
echo
echo "Ctrl+C para cerrar todo."

wait
