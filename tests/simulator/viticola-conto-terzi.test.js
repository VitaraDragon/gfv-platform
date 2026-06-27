/**
 * Integrazione GFV Farm Simulator — template viticola-conto-terzi.
 * Richiede emulator attivo: npm run sim:emulators
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isEmulatorAvailable } from '../../simulator/lib/emulator-available.js';
import { runFullSimulation } from '../../simulator/lib/run-simulation.js';
import { initEmulatorAdmin } from '../../simulator/lib/emulator-context.js';
import { inspectContoTerziSeed } from '../../simulator/lib/conto-terzi-inspect.js';
import { inspectTenantSeed } from '../../simulator/lib/tenant-inspect.js';
import { deleteSimulatedTenant } from '../../simulator/lib/cleanup-tenant.js';
import { resetSimContext } from '../../simulator/lib/sim-context.js';
import { loadTemplate } from '../../simulator/lib/load-template.js';

const template = loadTemplate('viticola-conto-terzi');
const q = template.quantities;

describe('GFV Farm Simulator — viticola-conto-terzi (emulator)', () => {
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
  }, 60000);

  it('run conto terzi seed clienti, tariffe e preventivi', async ({ skip: skipTest }) => {
    if (!emulatorUp) skipTest();

    const { setup, assets, contoTerzi } = await runFullSimulation({
      templateId: 'viticola-conto-terzi',
      seed: 626271,
      appendManifest: false
    });

    created = { tenantId: setup.tenantId, userId: setup.userId };

    expect(setup.template.moduli).toContain('contoTerzi');
    expect(contoTerzi.counts.clienti).toBe(q.clienti);
    expect(contoTerzi.counts.poderiClienti).toBe(q.poderiClienti);
    expect(contoTerzi.counts.terreniClienti).toBe(q.terreniClienti);
    expect(contoTerzi.counts.tariffe).toBe(q.tariffe);
    expect(contoTerzi.counts.preventivi).toBe(q.preventivi);
    expect(contoTerzi.counts.preventiviInviati).toBeGreaterThanOrEqual(2);
    expect(contoTerzi.counts.preventiviAccettati).toBeGreaterThanOrEqual(2);

    const { db } = initEmulatorAdmin();
    const inspectCt = await inspectContoTerziSeed(db, setup.tenantId, {
      clienti: q.clienti,
      poderiClienti: q.poderiClienti,
      terreniClienti: q.terreniClienti,
      tariffe: q.tariffe,
      preventivi: q.preventivi,
      minPreventiviInviati: 1,
      minPreventiviAccettati: 1
    });
    expect(inspectCt.ok, inspectCt.errors.join('; ')).toBe(true);

    const inspectTenant = await inspectTenantSeed(db, setup.tenantId);
    expect(inspectTenant.counts.terreni).toBe(assets.counts.terreni + q.terreniClienti);
  }, 120000);
});
