#!/usr/bin/env node
/**
 * Canary connettività Tony — locale + endpoint Cloud Functions.
 * Uso: node scripts/tony-connectivity-canary.mjs [--local-port=8000]
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? '1'];
  })
);

const PROJECT = 'gfv-platform';
const REGION = 'europe-west1';
const LOCAL_PORT = Number(args['local-port'] || 8000);
const STREAM_URL = `https://${REGION}-${PROJECT}.cloudfunctions.net/tonyAskStream`;
const CALLABLE_URL = `https://${REGION}-${PROJECT}.cloudfunctions.net/tonyAsk`;

const results = [];

function pass(id, detail) {
  results.push({ id, ok: true, detail });
  console.log(`  PASS  ${id}: ${detail}`);
}

function fail(id, detail) {
  results.push({ id, ok: false, detail });
  console.log(`  FAIL  ${id}: ${detail}`);
}

async function timedFetch(url, init, labelMs) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), labelMs || 15000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    return { res, ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

async function checkDns(host) {
  try {
    const { lookup } = await import('node:dns/promises');
    const addrs = await lookup(host, { all: true });
    pass(`dns:${host}`, addrs.map((a) => a.address).join(', '));
    return true;
  } catch (e) {
    fail(`dns:${host}`, e.message || String(e));
    return false;
  }
}

async function main() {
  console.log('\n=== Tony connectivity canary ===');
  console.log(`Project: ${PROJECT} | Stream: ${STREAM_URL}\n`);

  // 1. Local dev server
  try {
    const { res, ms } = await timedFetch(`http://127.0.0.1:${LOCAL_PORT}/core/terreni-standalone.html`, { method: 'GET' }, 5000);
    if (res.ok) pass('local:http-server', `terreni-standalone.html HTTP ${res.status} in ${ms} ms`);
    else fail('local:http-server', `HTTP ${res.status} in ${ms} ms`);
  } catch (e) {
    fail('local:http-server', e.name === 'AbortError' ? 'timeout 5s — avvia npm start' : (e.message || String(e)));
  }

  // 2. Client bundle markers (fix terreno + callable locale)
  try {
    const { readFileSync } = await import('node:fs');
    const inj = readFileSync('core/js/tony-form-injector.js', 'utf8');
    if (inj.includes('_preferCallableOverStream') || inj.includes('_ensureTerrenoColturaCategoriaInFormData')) {
      pass('code:terreno-injector', 'fix coltura/categoria presente in tony-form-injector.js');
    } else if (inj.includes('_findTerrenoCategoriaIdByColturaNameInDom')) {
      pass('code:terreno-injector', 'scan DOM categoria coltura presente');
    } else {
      fail('code:terreno-injector', 'fix terreno non trovato nel sorgente');
    }
    const svc = readFileSync('core/services/tony-service.js', 'utf8');
    if (svc.includes('_preferCallableOverStream') && svc.includes('TONY_STREAM_CONNECT_TIMEOUT_MS')) {
      pass('code:tony-service', 'fallback callable locale + timeout SSE presenti');
    } else {
      fail('code:tony-service', 'patch SSE/callable non trovata in tony-service.js');
    }
  } catch (e) {
    fail('code:bundle-check', e.message || String(e));
  }

  // 3. DNS
  await checkDns(`${REGION}-${PROJECT}.cloudfunctions.net`);
  await checkDns('firestore.googleapis.com');

  // 4. SSE OPTIONS (CORS preflight)
  try {
    const { res, ms } = await timedFetch(STREAM_URL, { method: 'OPTIONS' }, 15000);
    if (res.status === 204 || res.status === 200) {
      pass('cf:tonyAskStream:options', `HTTP ${res.status} in ${ms} ms`);
    } else {
      fail('cf:tonyAskStream:options', `HTTP ${res.status} in ${ms} ms`);
    }
  } catch (e) {
    fail('cf:tonyAskStream:options', e.name === 'AbortError' ? 'timeout 15s — rete/DNS verso Cloud Functions' : (e.message || String(e)));
  }

  // 5. SSE POST senza auth → 401 atteso (endpoint vivo)
  try {
    const { res, ms } = await timedFetch(
      STREAM_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ message: 'canary ping', context: {}, history: [] }),
      },
      20000
    );
    if (res.status === 401) {
      pass('cf:tonyAskStream:post-unauth', `HTTP 401 (endpoint raggiungibile) in ${ms} ms`);
    } else if (res.ok) {
      pass('cf:tonyAskStream:post-unauth', `HTTP ${res.status} in ${ms} ms (inaspettato ma raggiungibile)`);
    } else {
      fail('cf:tonyAskStream:post-unauth', `HTTP ${res.status} in ${ms} ms (atteso 401)`);
    }
  } catch (e) {
    fail('cf:tonyAskStream:post-unauth', e.name === 'AbortError' ? 'timeout 20s — connessione SSE bloccata' : (e.message || String(e)));
  }

  // 6. Callable POST senza auth → 401/403 atteso
  try {
    const { res, ms } = await timedFetch(
      CALLABLE_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { message: 'canary', context: {}, history: [] } }),
      },
      20000
    );
    if (res.status === 401 || res.status === 403) {
      pass('cf:tonyAsk:callable-unauth', `HTTP ${res.status} in ${ms} ms`);
    } else {
      fail('cf:tonyAsk:callable-unauth', `HTTP ${res.status} in ${ms} ms`);
    }
  } catch (e) {
    fail('cf:tonyAsk:callable-unauth', e.name === 'AbortError' ? 'timeout 20s' : (e.message || String(e)));
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n=== Esito: ${passed} PASS, ${failed} FAIL ===\n`);

  if (failed > 0) {
    console.log('Suggerimenti:');
    if (results.some((r) => !r.ok && r.id.startsWith('local:'))) {
      console.log('  - Avvia il server: npm start');
    }
    if (results.some((r) => !r.ok && (r.id.startsWith('dns:') || r.id.startsWith('cf:')))) {
      console.log('  - Verifica rete/VPN/DNS verso Google Cloud; in browser usa tonyAsk callable (localhost).');
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
