/**
 * Integrazione GFV Farm Simulator — template frutteto-solo-titolare (M4).
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
import { resetSimContext } from '../../simulator/lib/sim-context.js';
import { expectedFruttetoCountsFromTemplate } from '../../simulator/phases/05-simulate-frutteto.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const template = JSON.parse(
  readFileSync(join(__dirname, '../../simulator/templates/frutteto-solo-titolare.json'), 'utf-8')
);
const q = template.quantities;
const expected = expectedFruttetoCountsFromTemplate(template);

describe('GFV Farm Simulator — frutteto-solo-titolare (emulator)', () => {
  let emulatorUp = false;
  /** @type {{ tenantId: string, userId: string } | null} */
  let created = null;

  beforeAll(async () => {
    resetSimContext();
    emulatorUp = await isEmulatorAvailable();
  }, 15000);

  afterAll(async () => {
    resetSimContext();
    if (!created?.tenantId) return;
    const { db, auth } = initEmulatorAdmin();
    await deleteSimulatedTenant(db, auth, created);
  }, 30000);

  it('run completo + stub catena A frutteto', async ({ skip: skipTest }) => {
    if (!emulatorUp) skipTest();

    const { setup, assets, simulation, magazzino, frutteto } = await runFullSimulation({
      templateId: 'frutteto-solo-titolare',
      seed: 525252,
      appendManifest: false
    });

    created = { tenantId: setup.tenantId, userId: setup.userId };

    expect(assets.counts.terreni).toBe(q.terreni);
    expect(assets.counts.frutteti).toBe(q.frutteti);
    expect(assets.counts.vigneti).toBe(0);
    expect(simulation.counts.attivita).toBe(q.attivitaGiorniLavorativi);
    expect(magazzino.counts.movimenti).toBe(expected.trattamenti);
    expect(frutteto.counts.potature).toBe(expected.potature);
    expect(frutteto.counts.trattamenti).toBe(expected.trattamenti);
    expect(frutteto.counts.raccolte).toBe(expected.raccolte);

    const { db } = initEmulatorAdmin();
    const inspect = await inspectTenantSeed(db, setup.tenantId);
    expect(inspect.ok, inspect.errors.join('; ')).toBe(true);
    expect(inspect.counts.frutteti).toBe(q.frutteti);
    expect(inspect.counts.potatureFrutteto).toBe(expected.potature);
    expect(inspect.counts.trattamentiFrutteto).toBe(expected.trattamenti);
    expect(inspect.counts.raccolteFrutteto).toBe(expected.raccolte);
    expect(inspect.counts.movimentiMagazzino).toBe(expected.trattamenti);
  }, 60000);
});
