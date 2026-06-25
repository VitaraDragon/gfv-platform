#!/usr/bin/env node
/**
 * Verifica integrità manifest vs dati su Firebase Emulator.
 * Uso: npm run sim:audit
 * Exit 0 se tutti OK/WARN; exit 1 se almeno un FAIL.
 * @module simulator/audit-manifest
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readManifest, SEED_VERSION } from './lib/manifest.js';
import { assertSimulatorSafeToRun } from './lib/guard-production.js';
import { initEmulatorAdmin } from './lib/emulator-context.js';
import { inspectTenantSeed } from './lib/tenant-inspect.js';
import { expectedVignetoCountsFromTemplate } from './phases/05-simulate-vigneto.js';
import { isEmulatorAvailable } from './lib/emulator-available.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const template = JSON.parse(
  readFileSync(join(__dirname, 'templates/solo-titolare-viticola.json'), 'utf-8')
);
const q = template.quantities;
const vignetoExpected = expectedVignetoCountsFromTemplate(template);

/** Conteggi attesi per template solo-titolare-viticola v1.5 */
const EXPECTED = {
  terreni: q.terreni,
  macchine: q.trattori + q.attrezzi + (q.flotta ?? 2),
  flotta: q.flotta ?? 2,
  macchineConScadenzeMin: 3,
  inManutenzioneMin: 1,
  vigneti: q.vigneti,
  prodotti: q.prodotti,
  attivita: q.attivitaGiorniLavorativi,
  movimentiMagazzino: 12,
  potatureVigneto: vignetoExpected.potature,
  trattamentiVigneto: vignetoExpected.trattamenti
};

function pad(str, len) {
  const s = String(str ?? '');
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function truncate(str, max) {
  const s = String(str ?? '');
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

/**
 * @param {import('firebase-admin/auth').Auth} auth
 * @param {string} email
 * @param {string} expectedUserId
 */
async function checkAuthUser(auth, email, expectedUserId) {
  if (!email) return { ok: false, detail: 'email mancante nel manifest' };
  try {
    const user = await auth.getUserByEmail(email);
    if (expectedUserId && user.uid !== expectedUserId) {
      return { ok: false, detail: `userId manifest (${expectedUserId}) != Auth (${user.uid})` };
    }
    return { ok: true, detail: user.uid };
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      return { ok: false, detail: 'utente Auth assente' };
    }
    throw err;
  }
}

/** @param {import('firebase-admin/firestore').Firestore} db */
async function tenantRootExists(db, tenantId) {
  const doc = await db.collection('tenants').doc(tenantId).get();
  return doc.exists;
}

/**
 * @param {object} entry
 * @param {object} inspect
 * @param {{ authOk: boolean, authDetail: string, tenantExists: boolean }} checks
 */
function classifyEntry(entry, inspect, checks) {
  const issues = [];
  const warnings = [];

  if ((entry.seedVersion || 0) < SEED_VERSION) {
    warnings.push(`seedVersion ${entry.seedVersion ?? 'assente'} (atteso ${SEED_VERSION})`);
  }

  if (!checks.tenantExists) {
    issues.push('tenant assente su emulator');
  }
  if (!checks.authOk) {
    issues.push(checks.authDetail);
  }
  if (checks.tenantExists && !inspect.ok) {
    issues.push(...inspect.errors.slice(0, 2));
    if (inspect.errors.length > 2) issues.push(`+${inspect.errors.length - 2} errori seed`);
  }

  const c = inspect.counts || {};
  if (checks.tenantExists) {
    if (c.terreni !== EXPECTED.terreni) issues.push(`terreni ${c.terreni}/${EXPECTED.terreni}`);
    if (c.attivita !== EXPECTED.attivita) issues.push(`attività ${c.attivita}/${EXPECTED.attivita}`);
    if (c.movimentiMagazzino !== EXPECTED.movimentiMagazzino) {
      issues.push(`movimenti ${c.movimentiMagazzino}/${EXPECTED.movimentiMagazzino}`);
    }
    if (c.prodotti !== EXPECTED.prodotti) issues.push(`prodotti ${c.prodotti}/${EXPECTED.prodotti}`);
    if (c.vigneti !== EXPECTED.vigneti) issues.push(`vigneti ${c.vigneti}/${EXPECTED.vigneti}`);
    if (c.macchine !== EXPECTED.macchine) issues.push(`macchine ${c.macchine}/${EXPECTED.macchine}`);
    if ((c.flotta ?? 0) < EXPECTED.flotta) {
      issues.push(`flotta ${c.flotta ?? 0}/${EXPECTED.flotta}`);
    }
    if ((c.macchineConScadenze ?? 0) < EXPECTED.macchineConScadenzeMin) {
      issues.push(`scadenze macchine ${c.macchineConScadenze ?? 0}/≥${EXPECTED.macchineConScadenzeMin}`);
    }
    if ((c.inManutenzione ?? 0) < EXPECTED.inManutenzioneMin) {
      issues.push(`in manutenzione ${c.inManutenzione ?? 0}/≥${EXPECTED.inManutenzioneMin}`);
    }
    if (c.potatureVigneto !== EXPECTED.potatureVigneto) {
      issues.push(`potature vigneto ${c.potatureVigneto}/${EXPECTED.potatureVigneto}`);
    }
    if (c.trattamentiVigneto !== EXPECTED.trattamentiVigneto) {
      issues.push(`trattamenti vigneto ${c.trattamentiVigneto}/${EXPECTED.trattamentiVigneto}`);
    }
  }

  if (issues.length) return { status: 'FAIL', detail: issues.join('; ') };
  if (warnings.length) return { status: 'WARN', detail: warnings.join('; ') };
  return { status: 'OK', detail: 'completo' };
}

async function main() {
  assertSimulatorSafeToRun();

  const up = await isEmulatorAvailable();
  if (!up) {
    console.error('[sim:audit] FAIL — emulator non raggiungibile. Avvia: npm run sim:emulators');
    process.exit(1);
  }

  const manifest = readManifest();
  if (!manifest.length) {
    console.log('[sim:audit] Manifest vuoto — niente da verificare (OK).');
    console.log('  Suggerimento: npm run sim:run per creare un\'azienda demo.');
    process.exit(0);
  }

  const { db, auth } = initEmulatorAdmin();
  const rows = [];
  let failCount = 0;
  let warnCount = 0;

  for (const entry of manifest) {
    const tenantId = entry.tenantId;
    const tenantExists = tenantId ? await tenantRootExists(db, tenantId) : false;
    const authCheck = tenantId
      ? await checkAuthUser(auth, entry.email, entry.userId)
      : { ok: false, detail: 'tenantId mancante' };

    let inspect = { ok: false, counts: {}, errors: ['tenant non ispezionato'] };
    if (tenantExists && tenantId) {
      inspect = await inspectTenantSeed(db, tenantId);
    } else if (tenantId) {
      inspect = { ok: false, counts: {}, errors: ['tenant assente su emulator'] };
    }

    const result = classifyEntry(entry, inspect, {
      authOk: authCheck.ok,
      authDetail: authCheck.detail,
      tenantExists
    });

    if (result.status === 'FAIL') failCount += 1;
    if (result.status === 'WARN') warnCount += 1;

    rows.push({
      status: result.status,
      azienda: entry.aziendaNome || '(senza nome)',
      tenantId: tenantId || '(manca)',
      seed: entry.seedVersion ?? '-',
      detail: result.detail
    });
  }

  console.log('\n=== GFV Farm Simulator — audit manifest ===\n');
  console.log(
    pad('STATO', 6) +
    pad('AZIENDA', 28) +
    pad('TENANT', 36) +
    pad('SEED', 6) +
    'DETTAGLIO'
  );
  console.log('-'.repeat(120));

  for (const r of rows) {
    console.log(
      pad(r.status, 6) +
      pad(truncate(r.azienda, 27), 28) +
      pad(truncate(r.tenantId, 35), 36) +
      pad(String(r.seed), 6) +
      truncate(r.detail, 60)
    );
  }

  console.log('\n---');
  console.log(`Entry: ${manifest.length} | OK: ${rows.filter((r) => r.status === 'OK').length} | WARN: ${warnCount} | FAIL: ${failCount}`);
  console.log(`Attesi (template): ${EXPECTED.terreni} terreni, ${EXPECTED.macchine} macchine (${q.trattori} trattori + ${q.attrezzi} attrezzi + ${EXPECTED.flotta} flotta), ${EXPECTED.vigneti} vigneti, ${EXPECTED.prodotti} prodotti, ${EXPECTED.attivita} attività, ${EXPECTED.movimentiMagazzino} movimenti, ${EXPECTED.potatureVigneto} potature, ${EXPECTED.trattamentiVigneto} trattamenti vigneto`);

  if (failCount > 0) {
    console.log('\n[sim:audit] FAIL — correggi con sim:run, sim:backfill o sim:cleanup');
    process.exit(1);
  }

  if (warnCount > 0) {
    console.log('\n[sim:audit] WARN — seed legacy; usa sim:migrate-terreni o sim:backfill');
  } else {
    console.log('\n[sim:audit] OK');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[sim:audit] Errore:', err.message);
  process.exit(1);
});
