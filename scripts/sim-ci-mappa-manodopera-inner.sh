#!/usr/bin/env bash
# CI inner: http-server + seed manodopera + canary mappa allarmi.
set -euo pipefail

TEMPLATE="${GFV_SIM_E2E_TEMPLATE:-viticola-conto-terzi-manodopera}"

echo "[mappa:manodopera-canary:ci] avvio http-server…"
npx http-server -p 8000 -c-1 >/tmp/gfv-http-server-mappa-manodopera.log 2>&1 &
HTTP_PID=$!
trap 'kill "$HTTP_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8000/ >/dev/null; then
    break
  fi
  sleep 1
done
curl -sf http://127.0.0.1:8000/ >/dev/null || {
  echo "[mappa:manodopera-canary:ci] http-server non raggiungibile su :8000" >&2
  cat /tmp/gfv-http-server-mappa-manodopera.log >&2 || true
  exit 1
}

echo "[mappa:manodopera-canary:ci] seed ${TEMPLATE}…"
npm run sim:run -- --template="${TEMPLATE}"

echo "[mappa:manodopera-canary:ci] canary…"
CI=true npm run mappa:manodopera-canary
