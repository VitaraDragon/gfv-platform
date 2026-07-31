#!/usr/bin/env node
/**
 * Canary: nav PAGE_MAP impegni + binario B hub Manodopera + roster A2 (add/remove).
 *
 * Fase UNIT (sempre):
 *  - TONY_PAGE_MAP / getUrlForTarget impegni
 *  - resolveNavTarget + tryTonyNavQuickReply hub manodopera
 *  - logic A2 add/remove + no re-seed roster vuoto
 *
 * Fase BROWSER (emulator + seed + npm start):
 *  - login manager → Impegni giornalieri
 *  - currentTableData pageType
 *  - Modifica roster: aggiungi operaio → verifica → rimuovi → verifica Firestore
 *
 * Prerequisiti browser:
 *   npm run sim:emulators   # terminale 1
 *   npm start               # terminale 2
 *   npm run sim:run -- --template=viticola-conto-terzi-manodopera
 *
 * Uso:
 *   npm run manodopera:roster-a2-canary
 *   node scripts/manodopera-roster-a2-canary.mjs --unit-only
 *   node scripts/manodopera-roster-a2-canary.mjs --keep
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import {
  loginAsManagerManodopera,
  SIM_DEV_PATH
} from '../tests/e2e/sim/helpers/sim-login.js';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const BASE = process.env.GFV_E2E_BASE_URL || 'http://127.0.0.1:8000';
const UNIT_ONLY = process.argv.includes('--unit-only');
const KEEP = process.argv.includes('--keep');
const MARKER = `CANARY-A2-${Date.now()}`;

const IMPEGNI_PATH =
  '/modules/manodopera/views/impegni-giornalieri-standalone.html?emulator=1';

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

  const engineUrl = pathToFileURL(join(ROOT, 'core/js/tony/engine.js')).href;
  const logicUrl = pathToFileURL(
    join(ROOT, 'core/services/manodopera-roster-giorno-logic.js')
  ).href;
  const gateUrl = pathToFileURL(join(ROOT, 'core/config/tony-module-gate.js')).href;

  const { getUrlForTarget, resolveTarget, TONY_PAGE_MAP } = await import(engineUrl);
  const { getRequiredModuleForTarget } = await import(gateUrl);
  const {
    ensureRosterSlice,
    addPartecipazioneManuale,
    removePartecipazioneManuale,
    canRemovePartecipazioneManuale,
    isRosterMaterializzato,
    getRosterAttiviIds,
    applySostituzioneToRoster,
    ROSTER_ORIGINE_MANUALE
  } = await import(logicUrl);

  const {
    resolveNavTarget,
    tryTonyNavQuickReply
  } = require('../functions/tony-nav-quick-reply.js');

  // PAGE_MAP impegni
  try {
    if (!TONY_PAGE_MAP['impegni giornalieri'] || !TONY_PAGE_MAP['impegni giorno']) {
      throw new Error('chiavi impegni assenti da TONY_PAGE_MAP');
    }
    const url = getUrlForTarget('impegni giornalieri', '/core/dashboard-standalone.html');
    if (!url || !/impegni-giornalieri-standalone\.html/.test(url)) {
      throw new Error(`URL inatteso: ${url}`);
    }
    if (resolveTarget('impegni giorno') !== 'impegni giorno') {
      throw new Error('resolveTarget impegni giorno fallito');
    }
    if (getRequiredModuleForTarget('impegni giornalieri') !== 'manodopera') {
      throw new Error('gate client impegni ≠ manodopera');
    }
    pass('unit:page-map-impegni', url);
  } catch (e) {
    fail('unit:page-map-impegni', e.message || String(e));
  }

  // Nav B hub manodopera
  try {
    if (resolveNavTarget('apri manodopera') !== 'manodopera') {
      throw new Error('resolveNavTarget apri manodopera');
    }
    if (resolveNavTarget('portami alla home manodopera') !== 'manodopera') {
      throw new Error('home manodopera non deve finire su dashboard');
    }
    if (resolveNavTarget('apri statistiche manodopera') !== 'statistiche manodopera') {
      throw new Error('statistiche manodopera non deve finire su hub');
    }
    const moduli = ['tony', 'manodopera'];
    const hit = tryTonyNavQuickReply({
      message: 'apri manodopera',
      ctx: { moduli_attivi: moduli, dashboard: { moduli_attivi: moduli } }
    });
    if (!hit || hit.id !== 'nav' || hit.command?.target !== 'manodopera') {
      throw new Error(`quick reply inatteso: ${JSON.stringify(hit)}`);
    }
    const blocked = tryTonyNavQuickReply({
      message: 'apri manodopera',
      ctx: { moduli_attivi: ['tony'], dashboard: { moduli_attivi: ['tony'] } }
    });
    if (!blocked || blocked.id !== 'nav_module_blocked') {
      throw new Error('gate modulo manodopera non blocca');
    }
    pass('unit:nav-b-manodopera', hit.text || 'APRI_PAGINA manodopera');
  } catch (e) {
    fail('unit:nav-b-manodopera', e.message || String(e));
  }

  // Logic A2
  try {
    const GIORNO = '2026-07-31';
    let { slice } = ensureRosterSlice({
      lavoro: { caposquadraId: 'c' },
      giornoKey: GIORNO,
      squadreList: [{ caposquadraId: 'c', operai: ['a', 'b'] }],
      materializzatoIl: '2026-07-31T08:00:00.000Z'
    });
    slice = addPartecipazioneManuale(slice, {
      operaioId: 'extra',
      daManagerId: 'mgr'
    });
    const extra = slice.partecipazioni.find((p) => p.operaioId === 'extra');
    if (!extra || extra.origine !== ROSTER_ORIGINE_MANUALE) {
      throw new Error('add manuale fallito');
    }
    if (!canRemovePartecipazioneManuale(extra)) {
      throw new Error('extra dovrebbe essere rimuovibile');
    }
    slice = removePartecipazioneManuale(slice, { operaioId: 'a' });
    if (getRosterAttiviIds(slice).includes('a')) {
      throw new Error('a ancora attivo dopo remove');
    }

    let { slice: s2 } = ensureRosterSlice({
      lavoro: { operaioId: 'solo' },
      giornoKey: GIORNO
    });
    s2 = removePartecipazioneManuale(s2, { operaioId: 'solo' });
    if (!isRosterMaterializzato(s2) || s2.partecipazioni.length !== 0) {
      throw new Error('roster vuoto deve restare materializzato');
    }
    const again = ensureRosterSlice({
      lavoro: {
        operaioId: 'solo',
        equipaggioGiorno: { [GIORNO]: s2 }
      },
      giornoKey: GIORNO
    });
    if (again.created || again.slice.partecipazioni.length) {
      throw new Error('re-seed indesiderato su roster vuoto');
    }

    let { slice: s3 } = ensureRosterSlice({
      lavoro: { caposquadraId: 'c' },
      giornoKey: GIORNO,
      squadreList: [{ caposquadraId: 'c', operai: ['x'] }]
    });
    s3 = applySostituzioneToRoster(s3, {
      assenteOperaioId: 'x',
      sostitutoOperaioId: 's'
    });
    if (canRemovePartecipazioneManuale(s3.partecipazioni.find((p) => p.operaioId === 's'))) {
      throw new Error('sostituto non deve essere rimuovibile A2');
    }

    pass('unit:roster-a2-logic', `attivi=${getRosterAttiviIds(slice).join(',')}`);
  } catch (e) {
    fail('unit:roster-a2-logic', e.message || String(e));
  }
}

function launchOptions() {
  const opts = { headless: true };
  // Locale: Chrome di sistema; CI: Chromium Playwright (`npm run sim:e2e:install`)
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
  await context.addInitScript(() => {
    try {
      localStorage.setItem('gfv_firebase_emulator', '1');
    } catch (_) {
      /* ignore */
    }
  });
  return context.newPage();
}

async function probeUrl(url, label) {
  try {
    const res = await fetch(url, { method: 'GET' });
    return { ok: true, status: res.status, label };
  } catch (e) {
    return { ok: false, error: e.message || String(e), label };
  }
}

async function runBrowserChecks() {
  console.log('\n--- BROWSER ---');

  const host = await probeUrl(`${BASE}${SIM_DEV_PATH}`, 'http-server');
  if (!host.ok) {
    fail(
      'http:server',
      `${host.error} — avvia npm start + sim:emulators + sim:run (oppure --unit-only)`
    );
    return;
  }
  pass('http:server', `${BASE} raggiungibile`);

  // Auth emulator (9099): senza di esso «Entra come manager» resta sulla pagina dev
  const authProbe = await probeUrl('http://127.0.0.1:9099/', 'auth-emulator');
  if (!authProbe.ok) {
    fail(
      'http:auth-emulator',
      `${authProbe.error} — avvia npm run sim:emulators (Auth :9099 + Firestore :8080)`
    );
    return;
  }
  pass('http:auth-emulator', '9099 raggiungibile');

  const fsProbe = await probeUrl('http://127.0.0.1:8080/', 'firestore-emulator');
  if (!fsProbe.ok) {
    fail(
      'http:firestore-emulator',
      `${fsProbe.error} — avvia npm run sim:emulators`
    );
    return;
  }
  pass('http:firestore-emulator', '8080 raggiungibile');

  await withBrowser(async (browser) => {
    const page = await newEmulatorPage(browser);
    try {
      await loginAsManagerManodopera(page, LOGIN_OPTS);
      pass('browser:login-manager', 'dashboard ok');

      await page.goto(`${IMPEGNI_PATH}`);
      await page.waitForSelector('h1', { timeout: 60_000 });
      const h1 = await page.locator('h1').first().textContent();
      if (!/Impegni giornalieri/i.test(h1 || '')) {
        throw new Error(`h1 inatteso: ${h1}`);
      }
      pass('browser:impegni-page', h1.trim());

      await page.waitForFunction(() => {
        const el = document.getElementById('impegni-lavori-container');
        if (!el) return false;
        if (el.querySelector('.loading')) return false;
        return (
          el.querySelector('.btn-roster-edit') != null ||
          /Nessun lavoro/i.test(el.textContent || '')
        );
      }, { timeout: 90_000 });

      const ctd = await page.evaluate(() => {
        const d = window.currentTableData || {};
        return {
          pageType: d.pageType || null,
          summary: d.summary || '',
          itemsLen: Array.isArray(d.items) ? d.items.length : 0
        };
      });
      if (ctd.pageType !== 'impegni_giornalieri') {
        fail('browser:currentTableData', `pageType=${ctd.pageType}`);
      } else {
        pass(
          'browser:currentTableData',
          `pageType ok, items=${ctd.itemsLen}, summary=${(ctd.summary || '').slice(0, 80)}`
        );
      }

      const btnCount = await page.locator('.btn-roster-edit').count();
      if (!btnCount) {
        fail('browser:roster-btn', 'Nessun lavoro del giorno con «Scegli manualmente…»');
        return;
      }
      pass('browser:roster-btn', `${btnCount} lavori con Scegli manualmente`);

      // A2 via servizi in-page (stesso contratto UI, più stabile di select+confirm)
      const report = await page.evaluate(async ({ marker, keep }) => {
        const out = {
          ok: false,
          error: null,
          lavoroId: null,
          giornoKey: null,
          addedId: null,
          steps: []
        };
        try {
          const { toGiornoKey } = await import('/core/config/manodopera-assenze-config.js');
          const { buildImpegniGiorno } = await import(
            '/core/services/manodopera-impegni-giorno-service.js'
          );
          const {
            aggiungiPartecipazioneRosterGiorno,
            rimuoviPartecipazioneRosterGiorno,
            getEquipaggioSlice,
            ensureRosterGiornoPersisted
          } = await import('/core/services/manodopera-roster-giorno-service.js');
          const { getLavoro } = await import('/core/services/lavori-service.js');
          const { getAuthInstance } = await import('/core/services/firebase-service.js');
          const { setCurrentUserDataCache, getCurrentUserData } =
            await import('/core/services/auth-service.js');

          const authUser = getAuthInstance()?.currentUser;
          if (authUser && !getCurrentUserData()) {
            // Fallback se la pagina non ha ancora popolato la cache auth
            setCurrentUserDataCache({
              id: authUser.uid,
              uid: authUser.uid,
              ruoli: ['manager', 'amministratore']
            });
          }

          const giornoKey =
            document.getElementById('impegni-giorno')?.value || toGiornoKey(new Date());
          out.giornoKey = giornoKey;

          const snap = await buildImpegniGiorno({ giornoKey });
          const perLavoro = snap.perLavoro || [];
          const operai = snap.operaiList || [];
          if (!perLavoro.length) throw new Error('Nessun lavoro nel giorno');

          // Preferisci lavoro con almeno 1 operaio fuori roster (tipicamente autonomo)
          let picked = null;
          for (const r of perLavoro) {
            await ensureRosterGiornoPersisted({
              lavoroId: r.lavoroId,
              giornoKey,
              materializzatoDa: 'manager'
            });
            const lavPrep = await getLavoro(r.lavoroId);
            const slicePrep = getEquipaggioSlice(lavPrep, giornoKey);
            const onRoster = new Set(
              (slicePrep.partecipazioni || []).map((p) => p.operaioId).filter(Boolean)
            );
            const candidate = operai.find((o) => {
              const id = o.id || o.uid;
              return id && !onRoster.has(id);
            });
            if (!candidate) continue;
            const score = (r.isSquadra ? 0 : 10) + (operai.length - onRoster.size);
            if (!picked || score > picked.score) {
              picked = { row: r, candidate, score, onRosterSize: onRoster.size };
            }
          }
          if (!picked) {
            throw new Error(
              'Nessun lavoro con operaio fuori roster (serve ≥1 operaio non già nel seed)'
            );
          }
          const row = picked.row;
          const candidate = picked.candidate;
          out.lavoroId = row.lavoroId;
          out.steps.push(
            `lavoro:${row.lavoroNome || row.lavoroId}:fuori=${operai.length - picked.onRosterSize}`
          );
          const addedId = candidate.id || candidate.uid;
          out.addedId = addedId;

          const managerId = getAuthInstance()?.currentUser?.uid || null;
          await aggiungiPartecipazioneRosterGiorno({
            lavoroId: row.lavoroId,
            giornoKey,
            operaioId: addedId,
            daManagerId: managerId
          });
          out.steps.push(`add:${addedId}`);

          let lav = await getLavoro(row.lavoroId);
          let slice = getEquipaggioSlice(lav, giornoKey);
          const added = (slice.partecipazioni || []).find((p) => p.operaioId === addedId);
          if (!added || added.origine !== 'manuale') {
            throw new Error('partecipazione manuale non persistita');
          }
          out.steps.push('add_verified');

          // Apri modal UI e verifica riga visibile
          const btn = document.querySelector(
            `.btn-roster-edit[data-lavoro-id="${row.lavoroId}"]`
          );
          if (btn) {
            btn.click();
            await new Promise((r) => setTimeout(r, 800));
            const modal = document.getElementById('roster-edit-modal');
            const listText = document.getElementById('roster-edit-list')?.textContent || '';
            out.modalActive = !!(modal && modal.classList.contains('active'));
            out.modalHasAdded =
              listText.includes(addedId) ||
              listText.toLowerCase().includes(
                `${candidate.nome || ''} ${candidate.cognome || ''}`.trim().toLowerCase()
              );
            out.steps.push(
              `modal:${out.modalActive ? 'open' : 'closed'}:hasAdded=${out.modalHasAdded}`
            );
            const closeBtn = document.getElementById('roster-edit-close');
            if (closeBtn) closeBtn.click();
          }

          if (!keep) {
            await rimuoviPartecipazioneRosterGiorno({
              lavoroId: row.lavoroId,
              giornoKey,
              operaioId: addedId,
              daManagerId: managerId
            });
            lav = await getLavoro(row.lavoroId);
            slice = getEquipaggioSlice(lav, giornoKey);
            if ((slice.partecipazioni || []).some((p) => p.operaioId === addedId)) {
              throw new Error('rimozione non persistita');
            }
            out.steps.push('remove_verified');
          } else {
            out.steps.push(`keep:${marker}`);
          }

          out.ok = true;
        } catch (e) {
          out.error = e.message || String(e);
        }
        return out;
      }, { marker: MARKER, keep: KEEP });

      if (!report.ok) {
        fail('browser:a2-service', report.error || 'unknown');
        return;
      }
      pass('browser:a2-service', report.steps.join(' → '));

      if (report.modalActive === false) {
        fail('browser:a2-modal', 'modal non aperta');
      } else if (report.modalHasAdded === false) {
        fail('browser:a2-modal', 'operaio aggiunto non in lista modal');
      } else if (report.modalActive) {
        pass('browser:a2-modal', 'modal mostra partecipazione aggiunta');
      } else {
        info('modal UI non esercitata (btn assente dopo refresh interno)');
      }
    } catch (e) {
      fail('browser:flow', e.message || String(e));
    } finally {
      await page.context().close();
    }
  });
}

async function main() {
  console.log('\n=== Manodopera roster A2 + nav impegni canary ===');
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
