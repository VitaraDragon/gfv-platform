/**
 * Integrazione GFV Farm Simulator — template stack completo (E2E CI).
 * Viticola + magazzino catena B + manodopera + conto terzi.
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
import { expectedVignetoCountsFromTemplate } from '../../simulator/phases/05-simulate-vigneto.js';
import { extraCatenaCountsManodopera } from '../../simulator/lib/vigneto-stub-from-trigger.js';
import { verifyScarichiTrattamentoVignetoTenant } from '../../simulator/lib/link-scarichi-trattamento-vigneto.js';
import { verifySpeseVignetoTenant } from '../../simulator/lib/verify-spese-vigneto-tenant.js';

const template = loadTemplate('viticola-conto-terzi-manodopera');
const q = template.quantities;
const qCt = template.quantities;
const catenaExtra = extraCatenaCountsManodopera(template);
const vigExpected = expectedVignetoCountsFromTemplate(template);
const movExpected = expectedMovimentiFromTemplate(template);
const expectedTrattamenti = vigExpected.trattamenti + catenaExtra.trattamenti;
const expectedLavoriSquadra = q.lavoriSquadra + catenaExtra.lavoriSquadra;

describe('GFV Farm Simulator — viticola-conto-terzi-manodopera (emulator)', () => {
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

  it('flusso operativo seed: vigneto, magazzino B, manodopera, conto terzi', async ({ skip: skipTest }) => {
    if (!emulatorUp) skipTest();

    const result = await runFullSimulation({
      templateId: 'viticola-conto-terzi-manodopera',
      seed: 737373,
      appendManifest: false
    });

    const { setup, assets, simulation, magazzino, vigneto, contoTerzi, personas, manodopera, manodoperaOre } =
      result;

    created = {
      tenantId: setup.tenantId,
      userId: setup.userId,
      personas: personas?.personas
    };

    expect(setup.template.moduli).toEqual(
      expect.arrayContaining(['vigneto', 'magazzino', 'manodopera', 'contoTerzi'])
    );

    expect(simulation.counts.attivita).toBe(q.attivitaGiorniLavorativi);
    expect(vigneto.counts.trattamenti).toBe(expectedTrattamenti);
    expect(vigneto.counts.potature).toBe(vigExpected.potature);
    expect(vigneto.counts.vendemmie).toBe(vigExpected.vendemmie + catenaExtra.vendemmie);
    expect(magazzino.counts.movimenti).toBe(movExpected);
    expect(magazzino.sottoScorta).toBeGreaterThanOrEqual(1);

    expect(personas.counts.caposquadra).toBe(q.caposquadra);
    expect(personas.counts.operai).toBe(q.operai);
    expect(manodopera.counts.lavoriSquadra).toBe(expectedLavoriSquadra);
    expect(manodoperaOre.counts.oreValidate).toBeGreaterThanOrEqual(4);

    expect(contoTerzi.counts.clienti).toBe(qCt.clienti);
    expect(contoTerzi.counts.terreniClienti).toBe(qCt.terreniClienti);
    expect(contoTerzi.counts.preventivi).toBe(qCt.preventivi);

    const { db } = initEmulatorAdmin();

    const inspectTenant = await inspectTenantSeed(db, setup.tenantId);
    expect(inspectTenant.ok, inspectTenant.errors.join('; ')).toBe(true);
    expect(inspectTenant.counts.terreni).toBe(assets.counts.terreni + qCt.terreniClienti);
    expect(inspectTenant.counts.movimentiMagazzino).toBe(movExpected);
    expect(inspectTenant.counts.trattamentiVigneto).toBe(expectedTrattamenti);

    const scarichi = await verifyScarichiTrattamentoVignetoTenant(db, setup.tenantId);
    expect(scarichi.trattamentiConScarico).toBe(expectedTrattamenti);
    expect(scarichi.origineMissing).toBe(0);
    expect(scarichi.origineOk).toBe(scarichi.movimentiCollegati);

    const spese = await verifySpeseVignetoTenant(db, setup.tenantId);
    expect(spese.ok, spese.errors.join('; ')).toBe(true);
    expect(spese.totals.costoTotaleAnno).toBeGreaterThan(0);

    const inspectMo = await inspectManodoperaSeed(db, setup.tenantId, {
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
    expect(inspectMo.ok, inspectMo.errors.join('; ')).toBe(true);

    const inspectCt = await inspectContoTerziSeed(db, setup.tenantId, {
      clienti: qCt.clienti,
      poderiClienti: qCt.poderiClienti,
      terreniClienti: qCt.terreniClienti,
      tariffe: qCt.tariffe,
      preventivi: qCt.preventivi,
      minPreventiviInviati: 1,
      minPreventiviAccettati: 1
    });
    expect(inspectCt.ok, inspectCt.errors.join('; ')).toBe(true);
  }, 180000);
});
