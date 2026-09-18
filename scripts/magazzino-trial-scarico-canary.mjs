#!/usr/bin/env node
/**
 * Canary emulator: Magazzino in prova → checkbox scarico visibile e uscite create.
 * Richiede: npm run sim:emulators, npm start, seed solo-titolare-viticola.
 *
 *   node scripts/magazzino-trial-scarico-canary.mjs
 *   node scripts/magazzino-trial-scarico-canary.mjs --tenant=sim_az_agr_ricci_208883
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = process.env.GFV_E2E_BASE_URL || 'http://127.0.0.1:8000';
const ARG_TENANT = (process.argv.find((a) => a.startsWith('--tenant=')) || '').split('=')[1] || '';

const results = [];
function pass(id, detail) {
  results.push({ id, ok: true, detail });
  console.log(`  PASS  ${id}: ${detail}`);
}
function fail(id, detail) {
  results.push({ id, ok: false, detail });
  console.log(`  FAIL  ${id}: ${detail}`);
}

function loadLatestViticolaTenant() {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'simulator/manifest.json'), 'utf8'));
  const list = Array.isArray(manifest) ? manifest : [];
  const hit = [...list].reverse().find((e) => e.templateId === 'solo-titolare-viticola') || list.at(-1);
  return hit;
}

async function emulatorDb() {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
  const cfg = JSON.parse(readFileSync(join(ROOT, 'simulator/config/emulator.json'), 'utf8'));
  if (!getApps().length) initializeApp({ projectId: cfg.projectId });
  return { db: getFirestore(), Timestamp };
}

async function patchMagazzinoAccess(db, Timestamp, tenantId, mode) {
  const ref = db.doc(`tenants/${tenantId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Tenant ${tenantId} assente sull'emulator`);
  const data = snap.data() || {};
  const modules = (Array.isArray(data.modules) ? data.modules : []).filter((m) => m !== 'magazzino');
  const now = new Date();
  if (mode === 'trial') {
    const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await ref.update({
      modules,
      moduli: modules,
      moduleTrials: {
        magazzino: {
          status: 'active',
          startedAt: Timestamp.fromDate(now),
          endsAt: Timestamp.fromDate(endsAt),
        },
      },
    });
  } else if (mode === 'off') {
    await ref.update({
      modules,
      moduli: modules,
      moduleTrials: {
        magazzino: {
          status: 'expired',
          endsAt: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')),
        },
      },
    });
  }
  const after = (await ref.get()).data();
  return {
    modules: after.modules,
    trialStatus: after.moduleTrials?.magazzino?.status || null,
  };
}

async function movimentoOrigineIds(db, tenantId) {
  const snap = await db.collection(`tenants/${tenantId}/movimentiMagazzino`).get();
  return snap.docs
    .filter((d) => {
      const x = d.data() || {};
      return x.tipo === 'uscita' && x.origineTrattamentoId;
    })
    .map((d) => d.id);
}

async function loginManager(page, tenantId) {
  await page.goto('/core/dev/simulator-dev-standalone.html?emulator=1');
  await page.locator('.card').first().waitFor({ state: 'visible', timeout: 45_000 });
  const emptyMsg = page.getByText('Nessuna azienda in manifest');
  if (await emptyMsg.isVisible().catch(() => false)) {
    throw new Error('Nessuna azienda in manifest — npm run sim:run');
  }
  const card = page.locator('.card').filter({ hasText: tenantId });
  if ((await card.count()) === 0) {
    throw new Error(`Card tenant ${tenantId} non in manifest`);
  }
  await card.getByRole('button', { name: /Entra come manager/i }).click();
  await page.waitForURL(/dashboard-standalone\.html/, { timeout: 60_000 });
}

async function openTrattamentiModal(page, { preferIncomplete = false } = {}) {
  await page.goto('/modules/vigneto/views/trattamenti-standalone.html?emulator=1');
  await page.locator('h1').filter({ hasText: 'Trattamenti Vigneto' }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const loading = document.getElementById('loading');
    const wrap = document.getElementById('table-wrap');
    const rows = document.querySelectorAll('#tbody-trattamenti tr');
    const loadingHidden = !loading || loading.style.display === 'none';
    const wrapVisible = wrap && wrap.style.display !== 'none';
    return loadingHidden && wrapVisible && rows.length >= 1;
  }, { timeout: 60_000 });

  const completa = page.locator('[data-completa-row]').first();
  if (await completa.count()) {
    await completa.click();
  } else if (preferIncomplete) {
    const rows = page.locator('#tbody-trattamenti tr');
    const count = await rows.count();
    let clicked = false;
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const prodotto = ((await row.locator('td').nth(4).textContent()) || '').trim();
      if ((prodotto === '-' || prodotto === '') && (await row.locator('[data-edit-row]').count())) {
        await row.locator('[data-edit-row]').click();
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      const modifica = page.locator('[data-edit-row]').first();
      if (!(await modifica.count())) throw new Error('Nessun pulsante Completa/Modifica in lista trattamenti');
      await modifica.click();
    }
  } else {
    const modifica = page.locator('[data-edit-row]').first();
    if (await modifica.count()) await modifica.click();
    else throw new Error('Nessun pulsante Completa/Modifica in lista trattamenti');
  }
  await page.locator('#modal-trattamento.active').waitFor({ state: 'visible', timeout: 30_000 });
}

async function scaricoGroupVisible(page) {
  return page.evaluate(() => {
    const grp = document.getElementById('trattamento-scarico-magazzino-group');
    if (!grp) return { exists: false, display: null, visible: false };
    const cs = window.getComputedStyle(grp);
    return {
      exists: true,
      display: grp.style.display || cs.display,
      visible: cs.display !== 'none' && cs.visibility !== 'hidden',
    };
  });
}

async function completeScaricoIfPossible(page) {
  await page.waitForFunction(
    () => {
      const sel = document.querySelector('#tbody-prodotti-trattamento .prodotto-select');
      return sel && sel.querySelectorAll('option[value]:not([value=""])').length >= 1;
    },
    undefined,
    { timeout: 60_000 }
  );
  const productSelect = page.locator('#tbody-prodotti-trattamento .prodotto-select').first();
  const productValue = await productSelect.locator('option[value]:not([value=""])').first().getAttribute('value');
  await productSelect.selectOption(productValue);
  await productSelect.dispatchEvent('change');

  const superficie = page.locator('#trattamento-superficie');
  const superficieVal = parseFloat((await superficie.inputValue()) || '0');
  if (!(superficieVal > 0)) {
    await superficie.fill('1.00');
    await superficie.dispatchEvent('input');
  }

  const dosaggio = page.locator('#tbody-prodotti-trattamento .prodotto-dosaggio').first();
  await dosaggio.fill('2.5');
  await dosaggio.dispatchEvent('input');
  await page.locator('#trattamento-note').fill('GFV_CANARY_MAGAZZINO_TRIAL');
  await page.locator('#trattamento-registra-scarico-magazzino').check();

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#form-trattamento button[type="submit"]').click();
  await page.locator('#modal-trattamento.active').waitFor({ state: 'hidden', timeout: 90_000 });
  return { saved: true };
}

async function main() {
  const entry = loadLatestViticolaTenant();
  const tenantId = ARG_TENANT || entry.tenantId;
  console.log(`[magazzino-trial-canary] tenant=${tenantId} base=${BASE}`);

  const { db, Timestamp } = await emulatorDb();
  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantSnap.exists) {
    fail('emulator:tenant', `tenant ${tenantId} non trovato`);
    process.exit(1);
  }

  const before = tenantSnap.data();
  pass(
    'emulator:tenant',
    `modules=${JSON.stringify(before.modules || [])} trial=${JSON.stringify(before.moduleTrials || {})}`
  );

  const trialState = await patchMagazzinoAccess(db, Timestamp, tenantId, 'trial');
  if (trialState.modules.includes('magazzino')) {
    fail('patch:trial', 'magazzino è ancora nei moduli pagati');
  } else if (trialState.trialStatus !== 'active') {
    fail('patch:trial', `trial status=${trialState.trialStatus}`);
  } else {
    pass('patch:trial', `modules=${JSON.stringify(trialState.modules)} trial=active`);
  }

  const idsBefore = await movimentoOrigineIds(db, tenantId);

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.GFV_E2E_BROWSER_CHANNEL || 'chrome',
  });
  const context = await browser.newContext({ baseURL: BASE });
  await context.addInitScript(() => {
    try { localStorage.setItem('gfv_firebase_emulator', '1'); } catch (_) {}
  });
  const page = await context.newPage();

  try {
    await loginManager(page, tenantId);
    pass('login:manager', page.url());

    await openTrattamentiModal(page, { preferIncomplete: true });
    const visTrial = await scaricoGroupVisible(page);
    if (visTrial.visible) {
      pass('ui:trial-checkbox', `display=${visTrial.display}`);
    } else {
      fail('ui:trial-checkbox', JSON.stringify(visTrial));
    }

    const save = await completeScaricoIfPossible(page);
    if (save.saved) {
      const idsAfter = await movimentoOrigineIds(db, tenantId);
      const newIds = idsAfter.filter((id) => !idsBefore.includes(id));
      if (newIds.length) {
        pass('write:uscita', `nuovi movimenti ${newIds.join(',')} (prima=${idsBefore.length} dopo=${idsAfter.length})`);
      } else {
        fail('write:uscita', `nessun nuovo id uscita (prima=${idsBefore.length} dopo=${idsAfter.length})`);
      }
    } else {
      fail('write:uscita', save.reason || 'save non eseguito');
    }

    await patchMagazzinoAccess(db, Timestamp, tenantId, 'off');
    await openTrattamentiModal(page);
    const visOff = await scaricoGroupVisible(page);
    if (!visOff.visible) {
      pass('ui:off-checkbox', `display=${visOff.display}`);
    } else {
      fail('ui:off-checkbox', JSON.stringify(visOff));
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n[magazzino-trial-canary] ${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
