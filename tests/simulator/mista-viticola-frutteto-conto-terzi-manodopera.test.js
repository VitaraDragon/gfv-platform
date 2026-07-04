/**
 * Integrazione GFV Farm Simulator — template azienda mista viticola + frutteto.
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
import { expectedMixedColtureCountsFromTemplate } from '../../simulator/lib/mixed-colture-utils.js';
import { expectedMovimentiFromTemplate } from '../../simulator/phases/04-simulate-magazzino.js';
import { extraCatenaCountsManodopera } from '../../simulator/lib/vigneto-stub-from-trigger.js';
import { extraCatenaCountsManodoperaFrutteto } from '../../simulator/lib/frutteto-stub-from-trigger.js';
import { verifySpeseVignetoTenant } from '../../simulator/lib/verify-spese-vigneto-tenant.js';

const TEMPLATE_ID = 'mista-viticola-frutteto-conto-terzi-manodopera';
const template = loadTemplate(TEMPLATE_ID);
const q = template.quantities;
const mixedExpected = expectedMixedColtureCountsFromTemplate(template);
const catenaExtraV = extraCatenaCountsManodopera(template);
const catenaExtraF = extraCatenaCountsManodoperaFrutteto(template);
const movExpected = expectedMovimentiFromTemplate(template);
const expectedLavoriSquadra = q.lavoriSquadra + catenaExtraV.lavoriSquadra + catenaExtraF.lavoriSquadra;

describe(`GFV Farm Simulator — ${TEMPLATE_ID} (emulator)`, () => {
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

  it('flusso operativo seed: vigneto + frutteto, magazzino B, manodopera, conto terzi', async ({ skip: skipTest }) => {
    if (!emulatorUp) skipTest();

    const result = await runFullSimulation({
      templateId: TEMPLATE_ID,
      seed: 848484,
      appendManifest: false
    });

    const {
      setup,
      assets,
      simulation,
      magazzino,
      vigneto,
      frutteto,
      contoTerzi,
      personas,
      manodopera,
      manodoperaOre
    } = result;

    created = {
      tenantId: setup.tenantId,
      userId: setup.userId,
      personas: personas?.personas
    };

    expect(setup.template.moduli).toEqual(
      expect.arrayContaining(['vigneto', 'frutteto', 'magazzino', 'manodopera', 'contoTerzi'])
    );

    expect(assets.counts.vigneti).toBe(q.vigneti);
    expect(assets.counts.frutteti).toBe(q.frutteti);
    expect(assets.counts.terreni).toBe(q.terreni);

    expect(simulation.counts.attivita).toBe(q.attivitaGiorniLavorativi);
    expect(vigneto.counts.trattamenti).toBe(mixedExpected.vigneto.trattamenti);
    expect(vigneto.counts.potature).toBe(mixedExpected.vigneto.potature);
    expect(vigneto.counts.vendemmie).toBe(mixedExpected.vigneto.vendemmie);
    expect(frutteto.counts.trattamenti).toBe(mixedExpected.frutteto.trattamenti);
    expect(frutteto.counts.potature).toBe(mixedExpected.frutteto.potature);
    expect(frutteto.counts.raccolte).toBe(mixedExpected.frutteto.raccolte);
    expect(magazzino.counts.movimenti).toBe(movExpected);
    expect(magazzino.sottoScorta).toBeGreaterThanOrEqual(1);

    expect(manodopera.counts.lavoriSquadra).toBe(expectedLavoriSquadra);
    expect(manodoperaOre.counts.oreValidate).toBeGreaterThanOrEqual(4);
    expect(contoTerzi.counts.clienti).toBe(q.clienti);

    const { db } = initEmulatorAdmin();
    const inspectTenant = await inspectTenantSeed(db, setup.tenantId);
    expect(inspectTenant.ok, inspectTenant.errors.join('; ')).toBe(true);
    expect(inspectTenant.counts.vigneti).toBe(q.vigneti);
    expect(inspectTenant.counts.frutteti).toBe(q.frutteti);
    expect(inspectTenant.counts.trattamentiVigneto).toBe(
      mixedExpected.vigneto.trattamenti + catenaExtraV.trattamenti
    );
    expect(inspectTenant.counts.trattamentiFrutteto).toBe(
      mixedExpected.frutteto.trattamenti + catenaExtraF.trattamenti
    );
    expect(inspectTenant.counts.movimentiMagazzino).toBe(movExpected);

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
      clienti: q.clienti,
      poderiClienti: q.poderiClienti,
      terreniClienti: q.terreniClienti,
      tariffe: q.tariffe,
      preventivi: q.preventivi,
      minPreventiviInviati: 1,
      minPreventiviAccettati: 1
    });
    expect(inspectCt.ok, inspectCt.errors.join('; ')).toBe(true);
  }, 180000);
});
