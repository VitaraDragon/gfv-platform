#!/usr/bin/env node
/**
 * Aggiorna aziende esistenti nel manifest (senza crearne di nuove):
 * prodotti/giacenza, refresh date, movimenti magazzino se assenti.
 * @module simulator/backfill-existing
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readManifest } from './lib/manifest.js';
import { assertSimulatorSafeToRun } from './lib/guard-production.js';
import { initEmulatorAdmin } from './lib/emulator-context.js';
import { setSimContext } from './lib/sim-context.js';
import { refreshTenantDates } from './lib/refresh-dates.js';
import { runSimulateMagazzino } from './phases/04-simulate-magazzino.js';
import { inspectTenantSeed } from './lib/tenant-inspect.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const template = JSON.parse(
  readFileSync(join(__dirname, 'templates/solo-titolare-viticola.json'), 'utf-8')
);

async function normalizeProdotti(db, tenantId) {
  const snap = await db.collection(`tenants/${tenantId}/prodotti`).get();
  let updated = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    const patch = {};
    if (d.giacenza == null) {
      patch.giacenza = d.quantitaDisponibile ?? 12;
    }
    if (d.categoria === 'fitosanitario') patch.categoria = 'fitofarmaci';
    if (d.categoria === 'concime') patch.categoria = 'fertilizzanti';
    if (Object.keys(patch).length) {
      await doc.ref.update({ ...patch, updatedAt: new Date() });
      updated += 1;
    }
  }
  return updated;
}

async function backfillTenant(db, entry) {
  const { tenantId, userId, aziendaNome, runId } = entry;
  console.log(`\n[sim:backfill] ${aziendaNome} (${tenantId})`);

  setSimContext({
    tenantId,
    userId,
    runId,
    profile: { aziendaNome, template, templateId: entry.templateId || 'solo-titolare-viticola' }
  });

  const prodottiFixed = await normalizeProdotti(db, tenantId);
  if (prodottiFixed) console.log(`  prodotti normalizzati: ${prodottiFixed}`);

  const movSnap = await db.collection(`tenants/${tenantId}/movimentiMagazzino`).limit(1).get();
  let magazzino = { counts: { movimenti: 0 }, sottoScorta: 0 };
  if (movSnap.empty) {
    magazzino = await runSimulateMagazzino();
    console.log(`  movimenti creati: ${magazzino.counts.movimenti}, sotto scorta: ${magazzino.sottoScorta}`);
  } else {
    const all = await db.collection(`tenants/${tenantId}/movimentiMagazzino`).get();
    console.log(`  movimenti già presenti: ${all.size} (skip creazione)`);
    magazzino.counts.movimenti = all.size;
  }

  const refreshed = await refreshTenantDates(db, tenantId);
  console.log(
    `  date aggiornate: ${refreshed.attivita} attività, ${refreshed.movimenti} movimenti (${refreshed.dateRange.from} → ${refreshed.dateRange.to})`
  );

  const inspect = await inspectTenantSeed(db, tenantId);
  console.log(
    `  inspect: movimenti=${inspect.counts.movimentiMagazzino}, sotto scorta=${inspect.counts.prodottiSottoScorta}, terreni OK=${inspect.ok}`
  );

  return { prodottiFixed, magazzino, refreshed, inspect };
}

async function main() {
  assertSimulatorSafeToRun();
  const { db } = initEmulatorAdmin();
  const manifest = readManifest();

  if (!manifest.length) {
    console.log('[sim:backfill] Manifest vuoto — nessuna azienda esistente.');
    return;
  }

  console.log(`[sim:backfill] ${manifest.length} azienda/e nel manifest`);

  for (const entry of manifest) {
    try {
      await backfillTenant(db, entry);
    } catch (err) {
      console.warn(`[sim:backfill] ERRORE ${entry.tenantId}: ${err.message}`);
    }
  }

  console.log('\n[sim:backfill] Completato.');
}

main().catch((err) => {
  console.error('[sim:backfill] FAILED:', err.message);
  if (err.message.includes('FIRESTORE_EMULATOR_HOST')) {
    console.error('Avvia prima: npm run sim:emulators');
  }
  process.exit(1);
});
