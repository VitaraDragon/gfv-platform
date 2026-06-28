/**
 * Integrazione GFV Farm Simulator — template viticola-manodopera v2.
 * Richiede emulator attivo: npm run sim:emulators
 */
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isEmulatorAvailable } from '../../simulator/lib/emulator-available.js';
import { runFullSimulation } from '../../simulator/lib/run-simulation.js';
import { initEmulatorAdmin } from '../../simulator/lib/emulator-context.js';
import { inspectManodoperaSeed } from '../../simulator/lib/manodopera-inspect.js';
import { deleteSimulatedTenant } from '../../simulator/lib/cleanup-tenant.js';
import { resetSimContext } from '../../simulator/lib/sim-context.js';
import { loadTemplate } from '../../simulator/lib/load-template.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const template = loadTemplate('viticola-manodopera');
const q = template.quantities;

describe('GFV Farm Simulator — viticola-manodopera v2 (emulator)', () => {
  let emulatorUp = false;
  /** @type {{ tenantId: string, userId: string, personas?: Array } | null} */
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

  it('run v2 manodopera + ore validate per ruolo', async ({ skip: skipTest }) => {
    if (!emulatorUp) skipTest();

    const { setup, personas, manodopera, manodoperaOre } = await runFullSimulation({
      templateId: 'viticola-manodopera',
      seed: 525253,
      appendManifest: false
    });

    created = {
      tenantId: setup.tenantId,
      userId: setup.userId,
      personas: personas?.personas
    };

    expect(personas.counts.caposquadra).toBe(q.caposquadra);
    expect(personas.counts.operai).toBe(q.operai);
    expect(manodopera.counts.squadre).toBe(Math.min(q.squadre ?? q.caposquadra, q.caposquadra));
    expect(manodopera.counts.lavoriSquadra).toBe(q.lavoriSquadra);
    expect(manodopera.counts.lavoriAutonomi).toBe(q.lavoriAutonomi);
    expect(manodoperaOre.counts.oreValidate).toBeGreaterThanOrEqual(4);
    expect(manodoperaOre.counts.comunicazioniInviate).toBeGreaterThanOrEqual(q.lavoriSquadra);
    expect(manodoperaOre.counts.comunicazioniConfermate).toBeGreaterThanOrEqual(q.operai * q.lavoriSquadra);

    const { db } = initEmulatorAdmin();
    const inspect = await inspectManodoperaSeed(db, setup.tenantId, {
      squadre: Math.min(q.squadre ?? q.caposquadra, q.caposquadra),
      lavoriSquadra: q.lavoriSquadra,
      lavoriAutonomi: q.lavoriAutonomi,
      minOreOperaioValidateDaCapo: 1,
      minOreCapoValidateDaManager: 1,
      minOreAutonomoValidateDaManager: 1,
      oreDaValidarePending: template.manodopera?.oreDaValidarePending ?? 0,
      minComunicazioniAttive: q.lavoriSquadra,
      requireConfermeDestinatari: true,
      minAssenzeMalattiaConfermate: 1,
      minLavoriStandbyAssenza: 1
    });
    expect(inspect.ok, inspect.errors.join('; ')).toBe(true);
    expect(inspect.counts.oreDaValidare).toBe(template.manodopera?.oreDaValidarePending ?? 0);
    expect(manodoperaOre.counts.assenzeMalattiaConfermate).toBeGreaterThanOrEqual(1);
    expect(manodoperaOre.counts.lavoriStandbyAssenza).toBeGreaterThanOrEqual(1);
  }, 120000);
});
