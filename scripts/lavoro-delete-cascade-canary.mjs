#!/usr/bin/env node
/**
 * Prova emulator del delete a cascata lavoro (Gestione lavori + Firestore).
 *
 * Prerequisiti:
 *   npm run sim:emulators
 *   npx http-server -p 8000 -c-1
 *   npm run sim:run -- --template=viticola-manodopera --giorniOreSimulate=2
 *
 * Uso:
 *   node scripts/lavoro-delete-cascade-canary.mjs
 */
import { chromium } from 'playwright-core';
import { assertSimulatorSafeToRun } from '../simulator/lib/guard-production.js';
import { getEmulatorDb } from '../simulator/lib/emulator-context.js';
import { isEmulatorAvailable } from '../simulator/lib/emulator-available.js';
import {
  addTenantDocument,
  addTenantNestedDocument,
  getTenantDocument
} from '../simulator/lib/firestore-write.js';
import { readManifest } from '../simulator/lib/manifest.js';
import {
  loginAsManagerFromDevPage,
  gotoGestioneLavori,
  GESTIONE_LAVORI_PATH
} from '../tests/e2e/sim/helpers/sim-login.js';

const BASE = process.env.GFV_E2E_BASE_URL || 'http://127.0.0.1:8000';
const MARKER = `GFV CASCADE DELETE ${Date.now()}`;
const PARENT_NAME = `${MARKER} ORIGINE`;
const CHILD_NAME = `${MARKER} RIPRESA`;
const TARGET_NAME = `${MARKER} TARGET`;

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

function pickTenantFromManifest() {
  const list = readManifest();
  const filtered = list
    .filter((e) => (e.templateId || '').includes('manodopera'))
    .filter((e) => !(e.templateId || '').includes('regime-max'))
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  if (!filtered.length) {
    throw new Error('Nessun tenant manodopera in simulator/manifest.json — esegui npm run sim:run -- --template=viticola-manodopera');
  }
  return filtered[0];
}

async function firstDoc(col) {
  const snap = await col.limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function countByLavoroId(db, tenantId, collectionName, lavoroId, extraField) {
  const snap = await db.collection(`tenants/${tenantId}/${collectionName}`).get();
  return snap.docs.filter((d) => {
    const data = d.data();
    if (String(data.lavoroId || '') === String(lavoroId)) return true;
    if (extraField && String(data[extraField] || '') === String(lavoroId)) return true;
    return false;
  }).length;
}

async function subCount(db, tenantId, lavoroId, sub) {
  const snap = await db.collection(`tenants/${tenantId}/lavori/${lavoroId}/${sub}`).get();
  return snap.size;
}

async function seedFixture(db, tenantId) {
  const lavoriCol = db.collection(`tenants/${tenantId}/lavori`);
  const existing = await firstDoc(lavoriCol);
  if (!existing) throw new Error('Nessun lavoro seed — seed manodopera incompleto');
  const capoId = existing.caposquadraId || existing.operaioId;
  const operaioId = existing.operaioId || existing.caposquadraId;

  const vigneto = await firstDoc(db.collection(`tenants/${tenantId}/vigneti`));
  const terrenoId = vigneto?.terrenoId || existing.terrenoId;
  if (!terrenoId) throw new Error('Nessun terreno per il fixture');

  const oggi = new Date();
  const lavoroBase = {
    nome: TARGET_NAME,
    stato: 'assegnato',
    terrenoId,
    tipoLavoro: 'Erpicatura',
    dataInizio: oggi,
    durataPrevista: 2,
    caposquadraId: capoId,
    creatoDa: existing.creatoDa || capoId
  };

  const targetId = await addTenantDocument(db, tenantId, 'lavori', lavoroBase);
  const parentId = await addTenantDocument(db, tenantId, 'lavori', {
    ...lavoroBase,
    nome: PARENT_NAME,
    stato: 'sospeso'
  });
  const childId = await addTenantDocument(db, tenantId, 'lavori', {
    ...lavoroBase,
    nome: CHILD_NAME,
    stato: 'assegnato',
    ripresaDaLavoroId: parentId
  });

  const ora1 = await addTenantNestedDocument(db, tenantId, ['lavori', targetId, 'oreOperai'], {
    operaioId,
    ore: 8,
    data: oggi
  });
  const ora2 = await addTenantNestedDocument(db, tenantId, ['lavori', targetId, 'oreOperai'], {
    operaioId,
    ore: 4,
    data: oggi
  });
  const zonaId = await addTenantNestedDocument(db, tenantId, ['lavori', targetId, 'zoneLavorate'], {
    superficie: 0.4,
    note: 'canary-zona'
  });
  const commId = await addTenantDocument(db, tenantId, 'comunicazioni', {
    lavoroId: targetId,
    stato: 'attiva',
    caposquadraId: capoId,
    destinatari: [operaioId].filter(Boolean),
    messaggio: 'Canary cascata',
    data: oggi
  });
  const attId = await addTenantDocument(db, tenantId, 'attivita', {
    lavoroId: targetId,
    tipoLavoro: 'Erpicatura',
    data: oggi,
    note: 'canary-diario'
  });
  const assenzaDelId = await addTenantDocument(db, tenantId, 'assenzeOperai', {
    lavoroId: targetId,
    operaioId,
    tipo: 'malattia',
    data: oggi
  });
  const assenzaStandbyId = await addTenantDocument(db, tenantId, 'assenzeOperai', {
    standbyLavoroId: targetId,
    operaioId,
    tipo: 'malattia',
    data: oggi
  });
  const prevId = await addTenantDocument(db, tenantId, 'preventivi', {
    lavoroId: targetId,
    stato: 'pianificato',
    note: 'canary-preventivo'
  });
  const guastoId = await addTenantDocument(db, tenantId, 'guasti', {
    lavoroId: targetId,
    descrizione: 'canary-guasto',
    stato: 'aperto'
  });

  let trattId = null;
  if (vigneto?.id) {
    trattId = await addTenantNestedDocument(db, tenantId, ['vigneti', vigneto.id, 'trattamenti'], {
      lavoroId: targetId,
      data: oggi,
      prodotto: 'Canary zolfo',
      note: 'canary-trattamento'
    });
  }

  return {
    targetId,
    parentId,
    childId,
    oraIds: [ora1, ora2],
    zonaId,
    commId,
    attId,
    assenzaDelId,
    assenzaStandbyId,
    prevId,
    guastoId,
    trattId,
    vignetoId: vigneto?.id || null
  };
}

async function relatedSnapshot(db, tenantId, ids) {
  const lavoro = await getTenantDocument(db, tenantId, 'lavori', ids.targetId);
  const parent = await getTenantDocument(db, tenantId, 'lavori', ids.parentId);
  const child = await getTenantDocument(db, tenantId, 'lavori', ids.childId);
  const ore = await subCount(db, tenantId, ids.targetId, 'oreOperai');
  const zone = await subCount(db, tenantId, ids.targetId, 'zoneLavorate');
  const comms = await countByLavoroId(db, tenantId, 'comunicazioni', ids.targetId);
  const attivita = await countByLavoroId(db, tenantId, 'attivita', ids.targetId);
  const assenze = await countByLavoroId(db, tenantId, 'assenzeOperai', ids.targetId);
  const standby = await countByLavoroId(db, tenantId, 'assenzeOperai', ids.targetId, 'standbyLavoroId');
  const preventivo = await getTenantDocument(db, tenantId, 'preventivi', ids.prevId);
  const guasto = await getTenantDocument(db, tenantId, 'guasti', ids.guastoId);
  let tratt = null;
  if (ids.vignetoId && ids.trattId) {
    const snap = await db.doc(`tenants/${tenantId}/vigneti/${ids.vignetoId}/trattamenti/${ids.trattId}`).get();
    tratt = snap.exists ? { id: snap.id, ...snap.data() } : null;
  }
  const assenzaStandbyDoc = await getTenantDocument(db, tenantId, 'assenzeOperai', ids.assenzaStandbyId);
  return {
    lavoro,
    parent,
    child,
    ore,
    zone,
    comms,
    attivita,
    assenze,
    standby,
    preventivo,
    guasto,
    tratt,
    assenzaStandbyDoc
  };
}

async function launchBrowser() {
  const channel = process.env.GFV_E2E_BROWSER_CHANNEL;
  try {
    if (channel) return await chromium.launch({ headless: true, channel });
    return await chromium.launch({ headless: true });
  } catch (err) {
    info(`launch ${channel || 'chromium'} fallito (${err.message}), retry bundled chromium`);
    return chromium.launch({ headless: true });
  }
}

async function newEmulatorPage(browser) {
  const context = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 1400, height: 900 }
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('gfv_firebase_emulator', '1');
    } catch (_) { /* ignore */ }
  });
  return context.newPage();
}

async function waitForLavoroRow(page, nome, timeout = 60_000) {
  await page.waitForFunction(
    (marker) => {
      const container = document.getElementById('lavori-container');
      if (!container || container.querySelector('.loading')) return false;
      return Array.from(container.querySelectorAll('.lavori-table tbody tr'))
        .some((tr) => (tr.textContent || '').includes(marker));
    },
    nome,
    { timeout }
  );
  return page.locator('#lavori-container .lavori-table tbody tr').filter({ hasText: nome }).first();
}

async function clickEliminaAndCaptureDialog(page, row, { accept, waitMs = 45_000 }) {
  const captured = { text: null, type: null };
  const onDialog = async (dialog) => {
    captured.type = dialog.type();
    captured.text = dialog.message();
    if (accept) await dialog.accept();
    else await dialog.dismiss();
  };
  page.on('dialog', onDialog);
  try {
    await row.getByRole('button', { name: /Elimina/i }).click();
    const started = Date.now();
    while (!captured.text && Date.now() - started < waitMs) {
      await page.waitForTimeout(200);
    }
    return captured;
  } finally {
    page.off('dialog', onDialog);
  }
}

async function main() {
  console.log('\n=== Canary delete a cascata lavoro (emulatori) ===\n');
  assertSimulatorSafeToRun();
  if (!(await isEmulatorAvailable())) {
    throw new Error('Emulatori non raggiungibili. Avvia npm run sim:emulators');
  }

  const entry = pickTenantFromManifest();
  const tenantId = entry.tenantId;
  info(`tenant ${tenantId} (${entry.templateId})`);
  const db = getEmulatorDb();
  const ids = await seedFixture(db, tenantId);
  info(`seed target=${ids.targetId} parent=${ids.parentId} child=${ids.childId}`);

  const before = await relatedSnapshot(db, tenantId, ids);
  if (!before.lavoro) throw new Error('Fixture target non scritto');
  if (before.ore < 2) fail('seed-ore', `attese 2 ore, trovate ${before.ore}`);
  else pass('seed-ore', `${before.ore} oreOperai`);
  if (before.zone < 1) fail('seed-zone', `zone=${before.zone}`);
  else pass('seed-zone', `${before.zone} zoneLavorate`);
  if (before.comms < 1) fail('seed-comm', `comms=${before.comms}`);
  else pass('seed-comm', `${before.comms} comunicazioni`);
  if (before.attivita < 1) fail('seed-diario', `attivita=${before.attivita}`);
  else pass('seed-diario', `${before.attivita} voci diario`);
  if (before.assenze < 1) fail('seed-assenze', `assenze=${before.assenze}`);
  else pass('seed-assenze', `${before.assenze} assenze hard`);
  if (!before.preventivo || before.preventivo.stato !== 'pianificato') {
    fail('seed-prev', JSON.stringify(before.preventivo));
  } else pass('seed-prev', 'preventivo pianificato');
  if (!before.guasto) fail('seed-guasto', 'guasto assente');
  else pass('seed-guasto', 'guasto collegato');
  if (ids.trattId && !before.tratt) fail('seed-tratt', 'trattamento assente');
  else if (ids.trattId) pass('seed-tratt', `trattamento ${ids.trattId}`);

  const browser = await launchBrowser();
  try {
    const page = await newEmulatorPage(browser);
    page.setDefaultTimeout(60_000);
    await loginAsManagerFromDevPage(page, {
      templateIncludes: 'manodopera',
      preferTemplateId: entry.templateId,
      preferSeedComplete: true,
      excludeRegimeMax: true
    });
    await page.goto(GESTIONE_LAVORI_PATH);
    await page.locator('h1').filter({ hasText: 'Gestione Lavori' }).waitFor();
    const pulisci = page.getByRole('button', { name: /Pulisci Filtri/i });
    if (await pulisci.isVisible()) await pulisci.click();

    const parentRow = await waitForLavoroRow(page, PARENT_NAME);
    await parentRow.getByRole('button', { name: /Elimina/i }).click();
    const blockedToast = page.locator('#gfv-standalone-toast-layer .alert-error, .alert.alert-error');
    await blockedToast.filter({ hasText: /ripresa/i }).first().waitFor({ timeout: 45_000 });
    const blockedText = ((await blockedToast.first().textContent()) || '').trim();
    if (/ripresa/i.test(blockedText)) pass('ui-blocco-ripresa', blockedText);
    else fail('ui-blocco-ripresa', blockedText);

    const afterBlock = await relatedSnapshot(db, tenantId, ids);
    if (afterBlock.parent && afterBlock.child) pass('fs-parent-intatto', 'origine e ripresa ancora presenti');
    else fail('fs-parent-intatto', `parent=${!!afterBlock.parent} child=${!!afterBlock.child}`);

    const targetRow = await waitForLavoroRow(page, TARGET_NAME);
    const confirm = await clickEliminaAndCaptureDialog(page, targetRow, { accept: true, waitMs: 45_000 });
    if (!confirm.text) {
      fail('ui-confirm', 'nessun window.confirm');
    } else {
      const msg = confirm.text;
      const needed = ['ore operai', 'zona lavorata', 'comunicazione', 'voce diario', 'assenza', 'preventivo'];
      const missing = needed.filter((k) => !msg.toLowerCase().includes(k.split(' ')[0]));
      if (msg.includes(TARGET_NAME) && missing.length === 0) {
        pass('ui-confirm', msg.replace(/\n+/g, ' | ').slice(0, 240));
      } else {
        fail('ui-confirm', `mancano ${missing.join(', ')} :: ${msg.slice(0, 240)}`);
      }
    }

    await page.locator('#gfv-standalone-toast-layer .alert-success, .alert.alert-success')
      .filter({ hasText: /eliminato/i })
      .first()
      .waitFor({ timeout: 60_000 });
    pass('ui-success', 'toast Lavoro eliminato con successo');

    await page.waitForTimeout(800);
    const stillThere = await page.locator('#lavori-container .lavori-table tbody tr')
      .filter({ hasText: TARGET_NAME })
      .count();
    if (stillThere === 0) pass('ui-riga-sparita', 'riga target assente dalla tabella');
    else fail('ui-riga-sparita', `ancora ${stillThere} righe`);
  } finally {
    await browser.close();
  }

  const after = await relatedSnapshot(db, tenantId, ids);
  if (!after.lavoro) pass('fs-lavoro-gone', ids.targetId);
  else fail('fs-lavoro-gone', 'il documento lavoro è ancora lì');
  if (after.ore === 0) pass('fs-ore-gone', 'subcollection oreOperai vuota');
  else fail('fs-ore-gone', `ore residue ${after.ore}`);
  if (after.zone === 0) pass('fs-zone-gone', 'zoneLavorate vuota');
  else fail('fs-zone-gone', `zone residue ${after.zone}`);
  if (after.comms === 0) pass('fs-comm-gone', 'comunicazioni collegate eliminate');
  else fail('fs-comm-gone', `comms residue ${after.comms}`);
  if (after.attivita === 0) pass('fs-diario-gone', 'voci diario eliminate');
  else fail('fs-diario-gone', `attivita residue ${after.attivita}`);
  const assenzaHard = await getTenantDocument(db, tenantId, 'assenzeOperai', ids.assenzaDelId);
  if (!assenzaHard) pass('fs-assenza-hard', 'assenza con lavoroId eliminata');
  else fail('fs-assenza-hard', 'assenza hard ancora presente');
  if (after.assenzaStandbyDoc && after.assenzaStandbyDoc.standbyLavoroId == null) {
    pass('fs-assenza-standby', 'assenza standby scollegata, documento restato');
  } else fail('fs-assenza-standby', JSON.stringify(after.assenzaStandbyDoc));
  if (after.preventivo && after.preventivo.lavoroId == null && after.preventivo.stato === 'accettato_manager') {
    pass('fs-prev-unlink', 'preventivo pianificato → accettato_manager, lavoroId null');
  } else fail('fs-prev-unlink', JSON.stringify(after.preventivo));
  if (after.guasto && after.guasto.lavoroId == null) pass('fs-guasto-unlink', 'guasto scollegato');
  else fail('fs-guasto-unlink', JSON.stringify(after.guasto));
  if (ids.trattId) {
    if (!after.tratt) pass('fs-tratt-gone', 'trattamento vigneto eliminato');
    else fail('fs-tratt-gone', 'trattamento ancora presente');
  }
  if (after.parent && after.child) pass('fs-ripresa-restata', 'catena ripresa non toccata dal delete del target');
  else fail('fs-ripresa-restata', `parent=${!!after.parent} child=${!!after.child}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.filter((r) => r.ok).length}/${results.length} PASS ===`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  still failing: ${f.id} — ${f.detail}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
