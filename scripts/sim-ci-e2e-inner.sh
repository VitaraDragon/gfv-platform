#!/usr/bin/env bash
# Eseguito dentro firebase emulators:exec (CI + locale con bash).
set -euo pipefail

TEMPLATE="${GFV_SIM_E2E_TEMPLATE:-viticola-conto-terzi-manodopera}"

npx http-server -p 8000 -c-1 >/tmp/gfv-http-server.log 2>&1 &
HTTP_PID=$!
trap 'kill "$HTTP_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8000/ >/dev/null; then
    break
  fi
  sleep 1
done
curl -sf http://127.0.0.1:8000/ >/dev/null || {
  echo "[sim:e2e:ci] http-server non raggiungibile su :8000" >&2
  cat /tmp/gfv-http-server.log >&2 || true
  exit 1
}

npm run sim:run -- --template="${TEMPLATE}"
npm run sim:verify:e2e-seed
npm run sim:run -- --template=frutteto-solo-titolare
GFV_SIM_E2E_TEMPLATE=frutteto-solo-titolare npm run sim:verify:e2e-seed
npm run sim:run -- --template=mista-viticola-frutteto-conto-terzi-manodopera
GFV_SIM_E2E_TEMPLATE=mista-viticola-frutteto-conto-terzi-manodopera npm run sim:verify:e2e-seed
npm run sim:e2e:pw
