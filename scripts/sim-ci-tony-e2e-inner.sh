#!/usr/bin/env bash
# CI inner: http-server + seed Tony template + Tony E2E mock (tier 2).
set -euo pipefail

echo "[sim:tony:e2e:ci] avvio http-server…"
npx http-server -p 8000 -c-1 &
HTTP_PID=$!
trap 'kill "$HTTP_PID" 2>/dev/null || true' EXIT

for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8000/ >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -sf http://127.0.0.1:8000/ >/dev/null 2>&1; then
  echo "[sim:tony:e2e:ci] http-server non raggiungibile su :8000" >&2
  exit 1
fi

echo "[sim:tony:e2e:ci] seed template viticola-conto-terzi-manodopera (modulo tony)…"
npm run sim:run -- --template=viticola-conto-terzi-manodopera

echo "[sim:tony:e2e:ci] Tony E2E mock…"
CI=true npm run sim:tony:e2e
