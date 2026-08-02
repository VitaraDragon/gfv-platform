#!/usr/bin/env node
/**
 * Canary: mappa aziendale — allarmi manodopera (semaforo) + legenda + toggle.
 *
 * Fase UNIT (sempre):
 *  - resolveSeveritaManodoperaPerMappa / buildLavoroMarkerIconUrl
 *  - sorgente dashboard-maps: toggle Allarmi + legenda manodopera
 *
 * Fase BROWSER (emulator + seed + npm start):
 *  - login manager → standby su lavoro con terreno poligonato
 *  - mappa con mock Google Maps (stabile in CI senza API key)
 *  - toggle Allarmi / Progresso, legenda, marker allarme
 *
 * Prerequisiti browser:
 *   npm run sim:emulators   # terminale 1
 *   npm start               # terminale 2
 *   npm run sim:run -- --template=viticola-conto-terzi-manodopera
 *
 * Uso:
 *   npm run mappa:manodopera-canary
 *   node scripts/mappa-manodopera-canary.mjs --unit-only
 *   node scripts/mappa-manodopera-canary.mjs --keep
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import {
  loginAsManagerManodopera,
  SIM_DEV_PATH,
  MAPPA_AZIENDALE_PATH,
  waitForMappaAziendaleLoaded
} from '../tests/e2e/sim/helpers/sim-login.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const BASE = process.env.GFV_E2E_BASE_URL || 'http://127.0.0.1:8000';
const UNIT_ONLY = process.argv.includes('--unit-only');
const KEEP = process.argv.includes('--keep');
const MARKER = `CANARY-MAPPA-${Date.now()}`;

const LOGIN_OPTS = {
  templateIncludes: 'manodopera',
  preferTemplateId: 'viticola-conto-terzi-manodopera',
  preferSeedComplete: true,
  excludeRegimeMax: true,
  requirePersonas: true
};

const results = [];
function pass(id, detail) {
  results.push({ id, ok: true, detail });
  console.log(`  PASS  ${id}: ${detail}`);
}
function fail(id, detail) {
  results.push({ id, ok: false, detail });
  console.log(`  FAIL  ${id}: ${detail}`);
}
function info(msg) {
  console.log(`  INFO  ${msg}`);
}

async function runUnitChecks() {
  console.log('--- UNIT ---');

  const mapsUrl = pathToFileURL(join(ROOT, 'core/js/dashboard-maps.js')).href;
  const {
    resolveSeveritaManodoperaPerMappa,
    buildLavoroMarkerIconUrl
  } = await import(mapsUrl);

  try {
    const red = resolveSeveritaManodoperaPerMappa({
      stato: 'in_standby',
      standbyCausa: 'assenza_personale',
      standbyOperaioId: 'op1'
    });
    if (red.severita !== 'rosso' || !red.pulse) {
      throw new Error(`atteso rosso+pulse, got ${JSON.stringify(red)}`);
    }
    const yel = resolveSeveritaManodoperaPerMappa({
      stato: 'in_standby',
      standbyCausa: 'prestito_manodopera'
    });
    if (yel.severita !== 'giallo') {
      throw new Error(`atteso giallo, got ${JSON.stringify(yel)}`);
    }
    const ok = resolveSeveritaManodoperaPerMappa({ stato: 'in_corso' });
    if (ok.severita != null) {
      throw new Error(`atteso null, got ${ok.severita}`);
    }
    pass('unit:severita-mappa', 'rosso/giallo/null ok');
  } catch (e) {
    fail('unit:severita-mappa', e.message || String(e));
  }

  try {
    const url = buildLavoroMarkerIconUrl({
      fill: '#c62828',
      label: '!',
      ring: '#c62828',
      ringWide: true
    });
    if (!url.startsWith('data:image/svg+xml')) {
      throw new Error('icon URL non SVG data');
    }
    const decoded = decodeURIComponent(url);
    if (!decoded.includes('!') || !decoded.includes('#c62828')) {
      throw new Error('SVG senza label/colore allarme');
    }
    pass('unit:marker-icon', 'SVG allarme ok');
  } catch (e) {
    fail('unit:marker-icon', e.message || String(e));
  }

  try {
    const src = readFileSync(join(ROOT, 'core/js/dashboard-maps.js'), 'utf8');
    const need = [
      'toggle-allarmi-manodopera',
      'Allarmi manodopera',
      'allarmiManodoperaVisible',
      'resolveSeveritaManodoperaPerMappa',
      'Progresso lavori'
    ];
    const missing = need.filter((s) => !src.includes(s));
    if (missing.length) {
      throw new Error(`mancano: ${missing.join(', ')}`);
    }
    pass('unit:source-ui', 'toggle/legenda/allarmi presenti in dashboard-maps.js');
  } catch (e) {
    fail('unit:source-ui', e.message || String(e));
  }
}

/** Mock minimo google.maps — evita dipendenza da API key in CI. */
function googleMapsMockInitScript() {
  return () => {
    try {
      localStorage.setItem('gfv_firebase_emulator', '1');
    } catch (_) {
      /* ignore */
    }

    class LatLng {
      constructor(lat, lng) {
        this._lat = lat;
        this._lng = lng;
      }
      lat() {
        return this._lat;
      }
      lng() {
        return this._lng;
      }
    }

    class LatLngBounds {
      constructor(sw, ne) {
        this._points = [];
        if (sw) this._points.push(sw);
        if (ne) this._points.push(ne);
      }
      extend(p) {
        this._points.push(p);
      }
      getCenter() {
        if (!this._points.length) return new LatLng(45.1, 9.1);
        let la = 0;
        let ln = 0;
        for (const p of this._points) {
          la += typeof p.lat === 'function' ? p.lat() : p._lat;
          ln += typeof p.lng === 'function' ? p.lng() : p._lng;
        }
        const n = this._points.length;
        return new LatLng(la / n, ln / n);
      }
      getNorthEast() {
        if (!this._points.length) return new LatLng(45.2, 9.2);
        let maxLa = -90;
        let maxLn = -180;
        for (const p of this._points) {
          const la = typeof p.lat === 'function' ? p.lat() : p._lat;
          const ln = typeof p.lng === 'function' ? p.lng() : p._lng;
          maxLa = Math.max(maxLa, la);
          maxLn = Math.max(maxLn, ln);
        }
        return new LatLng(maxLa, maxLn);
      }
      getSouthWest() {
        if (!this._points.length) return new LatLng(45.0, 9.0);
        let minLa = 90;
        let minLn = 180;
        for (const p of this._points) {
          const la = typeof p.lat === 'function' ? p.lat() : p._lat;
          const ln = typeof p.lng === 'function' ? p.lng() : p._lng;
          minLa = Math.min(minLa, la);
          minLn = Math.min(minLn, ln);
        }
        return new LatLng(minLa, minLn);
      }
    }

    class Map {
      constructor() {
        this._listeners = {};
        this._once = {};
        queueMicrotask(() => {
          const fn = this._once.idle;
          if (typeof fn === 'function') fn();
        });
      }
      setCenter() {}
      setZoom() {}
      fitBounds() {}
    }

    class Size {
      constructor(w, h) {
        this.width = w;
        this.height = h;
      }
    }

    class Point {
      constructor(x, y) {
        this.x = x;
        this.y = y;
      }
    }

    class Marker {
      static _all = [];
      constructor(opts = {}) {
        this.opts = opts;
        this.map = opts.map || null;
        this.icon = opts.icon || null;
        this.title = opts.title || '';
        this.zIndex = opts.zIndex;
        this._listeners = {};
        Marker._all.push(this);
      }
      setMap(m) {
        this.map = m;
      }
      setIcon(i) {
        this.icon = i;
      }
      addListener(ev, fn) {
        this._listeners[ev] = fn;
      }
    }

    class InfoWindow {
      constructor(opts = {}) {
        this.content = opts.content || '';
      }
      open() {}
      close() {}
      setPosition() {}
    }

    class Polygon {
      constructor(opts = {}) {
        this.opts = opts;
        this.map = opts.map || null;
      }
      setMap(m) {
        this.map = m;
      }
      addListener() {}
    }

    const gmaps = {
      Map,
      Marker,
      InfoWindow,
      Polygon,
      LatLng,
      LatLngBounds,
      Size,
      Point,
      SymbolPath: { CIRCLE: 0 },
      event: {
        trigger() {},
        addListenerOnce(target, ev, fn) {
          if (target && typeof target === 'object') {
            target._once = target._once || {};
            target._once[ev] = fn;
            if (ev === 'idle') {
              queueMicrotask(() => {
                try {
                  fn();
                } catch (_) {
                  /* ignore */
                }
              });
            }
          }
        },
        addListener(target, ev, fn) {
          if (target && typeof target.addListener === 'function') {
            return target.addListener(ev, fn);
          }
          return { remove() {} };
        }
      },
      MapTypeId: { SATELLITE: 'satellite' },
      MapTypeControlStyle: { HORIZONTAL_BAR: 0 },
      ControlPosition: { TOP_RIGHT: 0 }
    };
    window.google = { maps: gmaps };

    // La pagina fa `googleMapsReady = false` all'avvio: forziamo sempre true per il canary.
    Object.defineProperty(window, 'googleMapsReady', {
      configurable: true,
      get() {
        return true;
      },
      set() {
        /* ignore */
      }
    });

    // loadGoogleMapsAPI: risolvi subito senza caricare Maps reale
    const origCreate = document.createElement.bind(document);
    document.createElement = function (tag) {
      const el = origCreate(tag);
      if (String(tag).toLowerCase() === 'script') {
        Object.defineProperty(el, 'src', {
          configurable: true,
          enumerable: true,
          get() {
            return this._gfvSrc || '';
          },
          set(v) {
            this._gfvSrc = v;
            if (String(v).includes('maps.googleapis.com')) {
              window.google = window.google || {};
              window.google.maps = gmaps;
              queueMicrotask(() => {
                if (typeof el.onload === 'function') el.onload();
              });
              return;
            }
            HTMLScriptElement.prototype.__lookupSetter__('src')?.call(this, v);
          }
        });
      }
      return el;
    };
  };
}

function launchOptions() {
  const opts = { headless: true };
  if (process.env.GFV_E2E_BROWSER_CHANNEL) {
    opts.channel = process.env.GFV_E2E_BROWSER_CHANNEL;
  } else if (!process.env.CI) {
    opts.channel = 'chrome';
  }
  return opts;
}

async function withBrowser(fn) {
  const browser = await chromium.launch(launchOptions());
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

async function newEmulatorPage(browser) {
  const context = await browser.newContext({ baseURL: BASE });
  await context.addInitScript(googleMapsMockInitScript());
  await context.route('**/maps.googleapis.com/**', (route) => route.abort());
  return context.newPage();
}

async function probeUrl(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

async function runBrowserChecks() {
  console.log('\n--- BROWSER ---');

  const host = await probeUrl(`${BASE}${SIM_DEV_PATH}`);
  if (!host.ok) {
    fail(
      'http:server',
      `${host.error} — avvia npm start + sim:emulators + sim:run (oppure --unit-only)`
    );
    return;
  }
  pass('http:server', `${BASE} raggiungibile`);

  const authProbe = await probeUrl('http://127.0.0.1:9099/');
  if (!authProbe.ok) {
    fail('http:auth-emulator', `${authProbe.error} — npm run sim:emulators`);
    return;
  }
  pass('http:auth-emulator', '9099 raggiungibile');

  const fsProbe = await probeUrl('http://127.0.0.1:8080/');
  if (!fsProbe.ok) {
    fail('http:firestore-emulator', `${fsProbe.error} — npm run sim:emulators`);
    return;
  }
  pass('http:firestore-emulator', '8080 raggiungibile');

  await withBrowser(async (browser) => {
    const page = await newEmulatorPage(browser);
    try {
      await loginAsManagerManodopera(page, LOGIN_OPTS);
      pass('browser:login-manager', 'dashboard ok');

      const seed = await page.evaluate(async ({ marker, keep }) => {
        const out = {
          ok: false,
          error: null,
          lavoroId: null,
          prev: null,
          steps: []
        };
        try {
          const { getAllLavori, updateLavoro, getLavoro } = await import(
            '/core/services/lavori-service.js'
          );
          const { getAllTerreni } = await import('/core/services/terreni-service.js');
          const { getAuthInstance } = await import('/core/services/firebase-service.js');
          const { setCurrentUserDataCache, getCurrentUserData } = await import(
            '/core/services/auth-service.js'
          );
          const { toGiornoKey } = await import('/core/config/manodopera-assenze-config.js');

          const authUser = getAuthInstance()?.currentUser;
          if (authUser && !getCurrentUserData()) {
            setCurrentUserDataCache({
              id: authUser.uid,
              uid: authUser.uid,
              ruoli: ['manager', 'amministratore']
            });
          }

          const terreni = await getAllTerreni({ includeTerreniClienti: true });
          const withPoly = new Set(
            (terreni || [])
              .filter(
                (t) =>
                  Array.isArray(t.polygonCoords) && t.polygonCoords.length >= 3
              )
              .map((t) => t.id)
          );
          if (!withPoly.size) {
            throw new Error('Nessun terreno con polygonCoords nel seed');
          }

          const lavori = await getAllLavori();
          const candidato = (lavori || []).find(
            (l) =>
              l.terrenoId &&
              withPoly.has(l.terrenoId) &&
              l.stato !== 'completato' &&
              l.stato !== 'annullato'
          );
          if (!candidato) {
            throw new Error('Nessun lavoro attivo su terreno con poligono');
          }

          out.lavoroId = candidato.id;
          out.prev = {
            stato: candidato.stato || 'assegnato',
            standbyCausa: candidato.standbyCausa || null,
            standbyOperaioId: candidato.standbyOperaioId || null,
            standbyGiornoKey: candidato.standbyGiornoKey || null,
            standbyNota: candidato.standbyNota || null
          };
          out.steps.push(`picked:${candidato.nome || candidato.id}`);

          const giornoKey = toGiornoKey(new Date());
          await updateLavoro(candidato.id, {
            stato: 'in_standby',
            standbyStatoPrecedente: candidato.stato || 'assegnato',
            standbyCausa: 'assenza_personale',
            standbyOperaioId: candidato.operaioId || candidato.caposquadraId || 'canary-op',
            standbyGiornoKey: giornoKey,
            standbyNota: marker
          });
          out.steps.push('standby_set');

          const lav = await getLavoro(candidato.id);
          if (lav.stato !== 'in_standby' || lav.standbyCausa !== 'assenza_personale') {
            throw new Error('standby non persistito');
          }
          out.ok = true;
          out.keep = keep;
        } catch (e) {
          out.error = e.message || String(e);
        }
        return out;
      }, { marker: MARKER, keep: KEEP });

      if (!seed.ok) {
        fail('browser:seed-standby', seed.error || 'unknown');
        return;
      }
      pass('browser:seed-standby', seed.steps.join(' → '));

      await page.goto(MAPPA_AZIENDALE_PATH);
      await waitForMappaAziendaleLoaded(page);
      pass('browser:mappa-page', 'Mappa aziendale caricata');

      await page.waitForSelector('#toggle-allarmi-manodopera', { timeout: 30_000 });
      await page.waitForSelector('#toggle-indicatori-lavori', { timeout: 10_000 });
      const toggleTxt = await page.locator('#toggle-allarmi-manodopera').innerText();
      const progTxt = await page.locator('#toggle-indicatori-lavori').innerText();
      if (!/Allarmi/i.test(toggleTxt)) {
        fail('browser:toggle-allarmi', `testo inatteso: ${toggleTxt}`);
      } else {
        pass('browser:toggle-allarmi', toggleTxt.replace(/\s+/g, ' ').trim());
      }
      if (!/Progresso/i.test(progTxt)) {
        fail('browser:toggle-progresso', `testo inatteso: ${progTxt}`);
      } else {
        pass('browser:toggle-progresso', progTxt.replace(/\s+/g, ' ').trim());
      }

      try {
        await page.waitForFunction(
          () => {
            const leg = document.querySelector('.mappa-legenda');
            if (!leg) return false;
            return /Allarmi manodopera/i.test(leg.textContent || '');
          },
          null,
          { timeout: 60_000 }
        );
      } catch (e) {
        const diag = await page.evaluate(() => {
          const c = document.getElementById('mappa-aziendale-container');
          return {
            google: typeof window.google !== 'undefined',
            maps: !!(window.google && window.google.maps),
            ready: !!window.googleMapsReady,
            hasLegenda: !!document.querySelector('.mappa-legenda'),
            containerText: (c && c.innerText || '').slice(0, 400),
            markerCount: (window.google?.maps?.Marker?._all || []).length
          };
        });
        fail(
          'browser:legenda',
          `timeout legenda — diag=${JSON.stringify(diag)} — ${e.message || e}`
        );
        return;
      }
      const legendText = await page.locator('.mappa-legenda').innerText();
      if (!/Rosso|pulsato/i.test(legendText) || !/Giallo/i.test(legendText)) {
        fail('browser:legenda', `legenda incompleta: ${legendText.slice(0, 200)}`);
      } else {
        pass('browser:legenda', 'sezione allarmi manodopera presente');
      }
      if (!/Progresso lavori/i.test(legendText)) {
        fail('browser:legenda-progresso', 'manca sezione Progresso lavori');
      } else {
        pass('browser:legenda-progresso', 'sezione progresso presente');
      }

      const markerReport = await page.evaluate(() => {
        const all = window.google?.maps?.Marker?._all || [];
        const allarmi = all.filter((m) => m._gfv && m._gfv.isAllarme);
        const rossi = allarmi.filter((m) => m._gfv.severita === 'rosso');
        const onMap = allarmi.filter((m) => m.map != null);
        return {
          total: all.length,
          allarmi: allarmi.length,
          rossi: rossi.length,
          onMap: onMap.length,
          titles: allarmi.map((m) => m.title).slice(0, 3)
        };
      });
      if (!markerReport.allarmi) {
        fail(
          'browser:marker-allarme',
          `nessun marker allarme (total markers=${markerReport.total})`
        );
      } else if (!markerReport.rossi) {
        fail('browser:marker-allarme', `allarmi senza rosso: ${JSON.stringify(markerReport)}`);
      } else if (!markerReport.onMap) {
        fail('browser:marker-allarme', 'marker allarme creati ma non sulla mappa (toggle OFF?)');
      } else {
        pass(
          'browser:marker-allarme',
          `${markerReport.rossi} rossi on-map / ${markerReport.allarmi} allarmi (titles: ${markerReport.titles.join(' | ')})`
        );
      }

      // Toggle off → marker nascosti
      await page.locator('#toggle-allarmi-manodopera').click();
      await page.waitForTimeout(300);
      const afterOff = await page.evaluate(() => {
        const allarmi = (window.google?.maps?.Marker?._all || []).filter(
          (m) => m._gfv && m._gfv.isAllarme
        );
        return allarmi.filter((m) => m.map != null).length;
      });
      if (afterOff !== 0) {
        fail('browser:toggle-off', `attesi 0 on-map, got ${afterOff}`);
      } else {
        pass('browser:toggle-off', 'Allarmi OFF nasconde marker');
      }

      await page.locator('#toggle-allarmi-manodopera').click();
      await page.waitForTimeout(300);
      const afterOn = await page.evaluate(() => {
        const allarmi = (window.google?.maps?.Marker?._all || []).filter(
          (m) => m._gfv && m._gfv.isAllarme
        );
        return allarmi.filter((m) => m.map != null).length;
      });
      if (afterOn < 1) {
        fail('browser:toggle-on', 'Allarmi ON non ripristina marker');
      } else {
        pass('browser:toggle-on', `${afterOn} marker di nuovo visibili`);
      }

      if (!KEEP && seed.lavoroId && seed.prev) {
        const restored = await page.evaluate(async ({ lavoroId, prev }) => {
          try {
            const { updateLavoro } = await import('/core/services/lavori-service.js');
            const { getAuthInstance } = await import('/core/services/firebase-service.js');
            const { setCurrentUserDataCache, getCurrentUserData } = await import(
              '/core/services/auth-service.js'
            );
            const authUser = getAuthInstance()?.currentUser;
            if (authUser && !getCurrentUserData()) {
              setCurrentUserDataCache({
                id: authUser.uid,
                uid: authUser.uid,
                ruoli: ['manager', 'amministratore']
              });
            }
            await updateLavoro(lavoroId, {
              stato: prev.stato || 'assegnato',
              standbyCausa: prev.standbyCausa,
              standbyOperaioId: prev.standbyOperaioId,
              standbyGiornoKey: prev.standbyGiornoKey,
              standbyNota: prev.standbyNota,
              standbyStatoPrecedente: null
            });
            return { ok: true };
          } catch (e) {
            return { ok: false, error: e.message || String(e) };
          }
        }, { lavoroId: seed.lavoroId, prev: seed.prev });
        if (!restored.ok) {
          fail('browser:restore', restored.error || 'restore fallito');
        } else {
          pass('browser:restore', `lavoro ${seed.lavoroId} ripristinato`);
        }
      } else if (KEEP) {
        info(`--keep: standby lasciato su ${seed.lavoroId} (${MARKER})`);
      }
    } catch (e) {
      fail('browser:flow', e.message || String(e));
    } finally {
      await page.context().close();
    }
  });
}

async function main() {
  console.log('\n=== Mappa aziendale manodopera canary ===');
  console.log(`Base: ${BASE}`);
  console.log(`Marker: ${MARKER}${UNIT_ONLY ? ' (--unit-only)' : ''}${KEEP ? ' (--keep)' : ''}\n`);

  await runUnitChecks();

  if (!UNIT_ONLY) {
    await runBrowserChecks();
  } else {
    info('Skip browser (--unit-only)');
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n=== ${failed.length ? 'FAIL' : 'OK'} (${results.length} check, ${failed.length} fail) ===\n`
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
