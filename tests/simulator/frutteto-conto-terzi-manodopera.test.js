/**
 * Integrazione GFV Farm Simulator — template frutteto-conto-terzi-manodopera.
 * Richiede emulator attivo: npm run sim:emulators
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isEmulatorAvailable } from '../../simulator/lib/emulator-available.js';
import { runFullSimulation } from '../../simulator/lib/run-simulation.js';
import { initEmulatorAdmin } from '../../simulator/lib/emulator-context.js';
import { inspectContoTerziSeed } from '../../simulator/lib/conto-terzi-inspect.js';
import { inspectManodoperaSeed } from '../../simulator/lib/manodopera-inspect.js';
import { inspectTenantSeed } from '../../simulator/lib/tenant-inspect.js';
import { deleteSimulatedTenant } from '../../simulator/lib/cleanup-tenant.js';
import { resetSimContext } from '../../simulator/lib/sim-context.js';
import { loadTemplate } from '../../simulator/lib/load-template.js';
import { expectedMovimentiFromTemplate } from '../../simulator/phases/04-simulate-magazzino.js';
import { expectedFruttetoCountsFromTemplate } from '../../simulator/phases/05-simulate-frutteto.js';
import { extraCatenaCountsManodoperaFrutteto } from '../../simulator/lib/frutteto-stub-from-trigger.js';

const template = loadTemplate('frutteto-conto-terzi-manodopera');
const q = template.quantities;
const catenaExtra = extraCatenaCountsManodoperaFrutteto(template);
const frExpected = expectedFruttetoCountsFromTemplate(template);
const movExpected = expectedMovimentiFromTemplate(template);
const expectedTrattamenti = frExpected.trattamenti + catenaExtra.trattamenti;
const expectedRaccolte = frExpected.raccolte + catenaExtra.raccolte;
const expectedLavoriSquadra = q.lavoriSquadra + catenaExtra.lavoriSquadra;

describe('GFV Farm Simulator — frutteto-conto-terzi-manodopera (emulator)', () => {
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
  }, 120000);

  it('flusso operativo seed: frutteto, magazzino B, manodopera, conto terzi Melo', async ({ skip: skipTest }) => {
    if (!emulatorUp) skipTest();

    const result = await runFullSimulation({
      templateId: 'frutteto-conto-terzi-manodopera',
      seed: 838383,
      appendManifest: false
    });

    const { setup, assets, simulation, magazzino, frutteto, contoTerzi, personas, manodopera, manodoperaOre } =
      result;

    created = {
      tenantId: setup.tenantId,
      userId: setup.userId,
      personas: personas?.personas
    };

    expect(setup.template.moduli).toEqual(
      expect.arrayContaining(['frutteto', 'magazzino', 'manodopera', 'contoTerzi'])
    );

    expect(assets.counts.frutteti).toBe(q.frutteti);
    expect(assets.counts.vigneti).toBe(0);
    expect(simulation.counts.attivita).toBe(q.attivitaGiorniLavorativi);
    expect(frutteto.counts.trattamenti).toBe(frExpected.trattamenti);
    expect(frutteto.counts.raccolte).toBe(frExpected.raccolte);
    expect(magazzino.counts.movimenti).toBe(movExpected);

    expect(personas.counts.caposquadra).toBe(q.caposquadra);
    expect(personas.counts.operai).toBe(q.operai);
    expect(manodopera.counts.lavoriSquadra).toBe(expectedLavoriSquadra);
    expect(manodoperaOre.counts.oreValidate).toBeGreaterThanOrEqual(4);

    expect(contoTerzi.counts.clienti).toBe(q.clienti);
    expect(contoTerzi.counts.preventivi).toBe(q.preventivi);

    const { db } = initEmulatorAdmin();
    const inspect = await inspectTenantSeed(db, setup.tenantId);
    expect(inspect.ok, inspect.errors.join('; ')).toBe(true);
    expect(inspect.counts.trattamentiFrutteto).toBe(expectedTrattamenti);
    expect(inspect.counts.raccolteFrutteto).toBe(expectedRaccolte);
    expect(inspect.counts.movimentiMagazzino).toBe(movExpected);

    const ctInspect = await inspectContoTerziSeed(db, setup.tenantId, {
      clienti: q.clienti,
      poderiClienti: q.poderiClienti,
      terreniClienti: q.terreniClienti,
      tariffe: q.tariffe,
      preventivi: q.preventivi
    });
    expect(ctInspect.ok, ctInspect.errors.join('; ')).toBe(true);
    expect(contoTerzi.terreniClienti.some((t) => (t.coltura || '').includes('Melo'))).toBe(true);

    const mdInspect = await inspectManodoperaSeed(db, setup.tenantId, {
      squadre: Math.min(q.squadre ?? q.caposquadra, q.caposquadra),
      lavoriSquadra: expectedLavoriSquadra,
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
    expect(mdInspect.ok, mdInspect.errors.join('; ')).toBe(true);
  }, 120000);
});
