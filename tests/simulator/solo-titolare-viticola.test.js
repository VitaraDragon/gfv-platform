/**
 * Integrazione GFV Farm Simulator su Firebase Emulator.
 * Richiede emulator attivo: npm run sim:emulators
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isEmulatorAvailable } from '../../simulator/lib/emulator-available.js';
import { runFullSimulation } from '../../simulator/lib/run-simulation.js';
import { initEmulatorAdmin } from '../../simulator/lib/emulator-context.js';
import { inspectTenantSeed } from '../../simulator/lib/tenant-inspect.js';
import { deleteSimulatedTenant } from '../../simulator/lib/cleanup-tenant.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const template = JSON.parse(
  readFileSync(join(__dirname, '../../simulator/templates/solo-titolare-viticola.json'), 'utf-8')
);
const q = template.quantities;

describe('GFV Farm Simulator — solo-titolare-viticola (emulator)', () => {
  let emulatorUp = false;
  /** @type {{ tenantId: string, userId: string } | null} */
  let created = null;

  beforeAll(async () => {
    emulatorUp = await isEmulatorAvailable();
  }, 15000);

  afterAll(async () => {
    if (!created?.tenantId) return;
    const { db, auth } = initEmulatorAdmin();
    await deleteSimulatedTenant(db, auth, created);
  }, 30000);

  it('run completo + seed terreni v2', async ({ skip: skipTest }) => {
    if (!emulatorUp) skipTest();

    const { setup, assets, simulation, magazzino, vigneto } = await runFullSimulation({
      templateId: 'solo-titolare-viticola',
      seed: 424242,
      appendManifest: false
    });

    created = { tenantId: setup.tenantId, userId: setup.userId };

    expect(assets.counts.terreni).toBe(q.terreni);
    expect(assets.counts.trattori).toBe(q.trattori);
    expect(assets.counts.attrezzi).toBe(q.attrezzi);
    expect(assets.counts.vigneti).toBe(q.vigneti);
    expect(assets.counts.prodotti).toBe(q.prodotti);
    expect(simulation.counts.attivita).toBe(q.attivitaGiorniLavorativi);
    expect(magazzino.counts.movimenti).toBeGreaterThanOrEqual(8);
    expect(magazzino.sottoScorta).toBeGreaterThanOrEqual(1);
    expect(vigneto.counts.potature).toBe(q.potatureVigneto);
    expect(vigneto.counts.trattamenti).toBe(q.trattamentiVigneto);

    const { db } = initEmulatorAdmin();
    const inspect = await inspectTenantSeed(db, setup.tenantId);
    expect(inspect.ok, inspect.errors.join('; ')).toBe(true);
    expect(inspect.counts.poderi).toBeGreaterThanOrEqual(1);
    expect(inspect.counts.movimentiMagazzino).toBeGreaterThanOrEqual(8);
    expect(inspect.counts.potatureVigneto).toBe(q.potatureVigneto);
    expect(inspect.counts.trattamentiVigneto).toBe(q.trattamentiVigneto);

    const { refreshTenantDates } = await import('../../simulator/lib/refresh-dates.js');
    const refreshed = await refreshTenantDates(db, setup.tenantId);
    expect(refreshed.attivita).toBe(q.attivitaGiorniLavorativi);
  }, 60000);
});
