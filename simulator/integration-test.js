#!/usr/bin/env node
/**
 * Test integrazione simulatore su Firebase Emulator.
 * @module simulator/integration-test
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { isEmulatorAvailable } from './lib/emulator-available.js';
import { runFullSimulation } from './lib/run-simulation.js';
import { initEmulatorAdmin } from './lib/emulator-context.js';
import { inspectTenantSeed } from './lib/tenant-inspect.js';
import { deleteSimulatedTenant } from './lib/cleanup-tenant.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const template = JSON.parse(
  readFileSync(join(__dirname, 'templates/solo-titolare-viticola.json'), 'utf-8')
);
const q = template.quantities;

async function main() {
  const up = await isEmulatorAvailable();
  if (!up) {
    console.error('[sim:test] SKIP — emulator non raggiungibile. Avvia: npm run sim:emulators');
    process.exit(0);
  }

  /** @type {{ tenantId: string, userId: string } | null} */
  let setup = null;
  let exitCode = 0;

  try {
    const result = await runFullSimulation({
      templateId: 'solo-titolare-viticola',
      seed: 424242,
      appendManifest: false
    });
    setup = result.setup;

    const { counts: assetCounts } = result.assets;
    const { counts: simCounts } = result.simulation;
    const { counts: magCounts, sottoScorta } = result.magazzino;

    if (assetCounts.terreni !== q.terreni) throw new Error(`terreni: attesi ${q.terreni}, got ${assetCounts.terreni}`);
    if (assetCounts.trattori !== q.trattori) throw new Error(`trattori: attesi ${q.trattori}, got ${assetCounts.trattori}`);
    if (assetCounts.attrezzi !== q.attrezzi) throw new Error(`attrezzi: attesi ${q.attrezzi}, got ${assetCounts.attrezzi}`);
    if (assetCounts.vigneti !== q.vigneti) throw new Error(`vigneti: attesi ${q.vigneti}, got ${assetCounts.vigneti}`);
    if (assetCounts.prodotti !== q.prodotti) throw new Error(`prodotti: attesi ${q.prodotti}, got ${assetCounts.prodotti}`);
    if (simCounts.attivita !== q.attivitaGiorniLavorativi) {
      throw new Error(`attività: attese ${q.attivitaGiorniLavorativi}, got ${simCounts.attivita}`);
    }
    if (magCounts.movimenti < 8) {
      throw new Error(`movimenti magazzino: attesi almeno 8, got ${magCounts.movimenti}`);
    }
    if (sottoScorta < 1) {
      throw new Error('prodotti sotto scorta: atteso almeno 1 dopo scarichi simulati');
    }

    const { db } = initEmulatorAdmin();
    const inspect = await inspectTenantSeed(db, setup.tenantId);
    if (!inspect.ok) {
      throw new Error(`seed terreni KO: ${inspect.errors.join('; ')}`);
    }

    const { refreshTenantDates } = await import('./lib/refresh-dates.js');
    const refreshed = await refreshTenantDates(db, setup.tenantId);
    if (refreshed.attivita !== simCounts.attivita) {
      throw new Error('refresh-dates: conteggio attività non allineato');
    }

    console.log('[sim:test] SUCCESS');
    console.log(`  tenant: ${setup.tenantId}`);
    console.log(`  terreni seed v2: OK (${inspect.counts.terreni})`);
    console.log(`  attività: ${simCounts.attivita}`);
    console.log(`  movimenti magazzino: ${magCounts.movimenti}, sotto scorta: ${sottoScorta}`);
    console.log(`  refresh date: ${refreshed.dateRange.from} → ${refreshed.dateRange.to}`);
  } catch (err) {
    console.error('[sim:test] FAILED:', err.message);
    exitCode = 1;
  } finally {
    if (setup?.tenantId) {
      try {
        const { db, auth } = initEmulatorAdmin();
        await deleteSimulatedTenant(db, auth, {
          tenantId: setup.tenantId,
          userId: setup.userId
        });
      } catch (_) { /* ignore */ }
    }
  }

  process.exit(exitCode);
}

main();
