#!/usr/bin/env node
/**
 * Test integrazione simulatore su Firebase Emulator.
 * @module simulator/integration-test
 */


import { isEmulatorAvailable } from './lib/emulator-available.js';
import { runFullSimulation } from './lib/run-simulation.js';
import { initEmulatorAdmin } from './lib/emulator-context.js';
import { inspectTenantSeed } from './lib/tenant-inspect.js';
import { deleteSimulatedTenant } from './lib/cleanup-tenant.js';
import { expectedVignetoCountsFromTemplate } from './phases/05-simulate-vigneto.js';
import { verifyScarichiTrattamentoVignetoTenant } from './lib/link-scarichi-trattamento-vigneto.js';
import { verifySpeseVignetoTenant } from './lib/verify-spese-vigneto-tenant.js';
import { inspectManodoperaSeed } from './lib/manodopera-inspect.js';
import { loadTemplate } from './lib/load-template.js';

const template = loadTemplate('solo-titolare-viticola');
const v2Template = loadTemplate('viticola-manodopera');
const q = template.quantities;
const qV2 = v2Template.quantities;

async function runV1Test() {
  const result = await runFullSimulation({
    templateId: 'solo-titolare-viticola',
    seed: 424242,
    appendManifest: false
  });
  const setup = result.setup;

  const { counts: assetCounts } = result.assets;
  const { counts: simCounts } = result.simulation;
  const { counts: magCounts, sottoScorta } = result.magazzino;
  const { counts: vigCounts } = result.vigneto;
  const vigExpected = expectedVignetoCountsFromTemplate(template);

  if (assetCounts.terreni !== q.terreni) throw new Error(`terreni: attesi ${q.terreni}, got ${assetCounts.terreni}`);
  if (assetCounts.trattori !== q.trattori) throw new Error(`trattori: attesi ${q.trattori}, got ${assetCounts.trattori}`);
  if (assetCounts.attrezzi !== q.attrezzi) throw new Error(`attrezzi: attesi ${q.attrezzi}, got ${assetCounts.attrezzi}`);
  if (assetCounts.flotta !== (q.flotta ?? 2)) {
    throw new Error(`flotta: attesi ${q.flotta ?? 2}, got ${assetCounts.flotta ?? 0}`);
  }
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
  if (vigCounts.potature !== vigExpected.potature) {
    throw new Error(`potature vigneto: attese ${vigExpected.potature}, got ${vigCounts.potature}`);
  }
  if (vigCounts.trattamenti !== vigExpected.trattamenti) {
    throw new Error(`trattamenti vigneto: attesi ${vigExpected.trattamenti}, got ${vigCounts.trattamenti}`);
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

  const scarichi = await verifyScarichiTrattamentoVignetoTenant(db, setup.tenantId);
  if (scarichi.trattamentiConScarico < vigExpected.trattamenti) {
    throw new Error(
      `scarichi trattamento: attesi ${vigExpected.trattamenti} trattamenti con movimento, got ${scarichi.trattamentiConScarico}`
    );
  }
  if (scarichi.origineMissing > 0) {
    throw new Error(
      `scarichi trattamento: ${scarichi.origineMissing} movimenti senza origineTrattamento* (attesi 0)`
    );
  }

  const spese = await verifySpeseVignetoTenant(db, setup.tenantId);
  if (!spese.ok) {
    throw new Error(`spese vigneto: ${spese.errors.join('; ')}`);
  }
  if (spese.totals.costoTotaleAnno <= 0) {
    throw new Error('spese vigneto: costoTotaleAnno atteso > 0');
  }
  if (spese.totals.speseMacchineAnno <= 0) {
    throw new Error('spese vigneto: speseMacchineAnno atteso > 0 (costoOra macchine seed)');
  }
  if (inspect.counts.flotta < 1) {
    throw new Error('parco macchine: attesa almeno 1 voce flotta (furgone/pickup)');
  }
  if (inspect.counts.macchineConScadenze < 3) {
    throw new Error(
      `parco macchine: attese scadenze su almeno 3 mezzi, got ${inspect.counts.macchineConScadenze}`
    );
  }
  if (inspect.counts.inManutenzione < 1) {
    throw new Error('parco macchine: atteso almeno 1 mezzo in_manutenzione');
  }
  const flottaExpected = q.flotta ?? 2;
  if (inspect.counts.flottaKmOk < flottaExpected) {
    throw new Error(
      `flotta km: attesi ${flottaExpected} mezzi con km validi, got ${inspect.counts.flottaKmOk ?? 0}`
    );
  }
  if ((inspect.counts.flottaTagliandoSuperato ?? 0) < 1) {
    throw new Error('flotta km: atteso almeno 1 tagliando superato per demo scadenze');
  }

  console.log('[sim:test] v1 SUCCESS');
  console.log(`  tenant: ${setup.tenantId}`);
  return setup;
}

async function runV2Test() {
  const result = await runFullSimulation({
    templateId: 'viticola-manodopera',
    seed: 525252,
    appendManifest: false
  });
  const setup = result.setup;
  const cleanupEntry = {
    tenantId: setup.tenantId,
    userId: setup.userId,
    personas: result.personas.personas
  };

  if (result.personas.counts.caposquadra !== qV2.caposquadra) {
    throw new Error(`caposquadra: attesi ${qV2.caposquadra}, got ${result.personas.counts.caposquadra}`);
  }
  if (result.personas.counts.operai !== qV2.operai) {
    throw new Error(`operai: attesi ${qV2.operai}, got ${result.personas.counts.operai}`);
  }
  if (result.manodopera.counts.lavoriSquadra !== qV2.lavoriSquadra) {
    throw new Error(`lavori squadra: attesi ${qV2.lavoriSquadra}, got ${result.manodopera.counts.lavoriSquadra}`);
  }
  if (result.manodopera.counts.lavoriAutonomi !== qV2.lavoriAutonomi) {
    throw new Error(`lavori autonomi: attesi ${qV2.lavoriAutonomi}, got ${result.manodopera.counts.lavoriAutonomi}`);
  }

  const { db } = initEmulatorAdmin();
  const inspect = await inspectManodoperaSeed(db, setup.tenantId, {
    squadre: Math.min(qV2.squadre ?? qV2.caposquadra, qV2.caposquadra),
    lavoriSquadra: qV2.lavoriSquadra,
    lavoriAutonomi: qV2.lavoriAutonomi,
    minOreOperaioValidateDaCapo: 1,
    minOreCapoValidateDaManager: 1,
    minOreAutonomoValidateDaManager: 1,
    minComunicazioniAttive: qV2.lavoriSquadra,
    requireConfermeDestinatari: true,
    minAssenzeMalattiaConfermate: 1,
    minLavoriStandbyAssenza: 1
  });
  if (!inspect.ok) {
    const err = new Error(`manodopera v2: ${inspect.errors.join('; ')}`);
    err.cleanupEntry = cleanupEntry;
    throw err;
  }

  console.log('[sim:test] v2 manodopera SUCCESS');
  console.log(`  tenant: ${setup.tenantId}`);
  console.log(
    `  personas: ${result.personas.counts.totalPersonas}, ore validate: ${inspect.counts.oreValidate}, comunicazioni: ${inspect.counts.comunicazioniAttive}, conferme: ${inspect.counts.confermeTotali}`
  );
  return cleanupEntry;
}

async function main() {
  const up = await isEmulatorAvailable();
  if (!up) {
    console.error('[sim:test] SKIP — emulator non raggiungibile. Avvia: npm run sim:emulators');
    process.exit(0);
  }

  /** @type {{ tenantId: string, userId: string, personas?: Array } | null} */
  let v1Setup = null;
  /** @type {{ tenantId: string, userId: string, personas?: Array } | null} */
  let v2Setup = null;
  let exitCode = 0;

  try {
    v1Setup = await runV1Test();
    v2Setup = await runV2Test();
  } catch (err) {
    console.error('[sim:test] FAILED:', err.message);
    if (err.cleanupEntry && !v2Setup) {
      v2Setup = err.cleanupEntry;
    }
    exitCode = 1;
  } finally {
    const { db, auth } = initEmulatorAdmin();
    for (const entry of [v1Setup, v2Setup]) {
      if (!entry?.tenantId) continue;
      try {
        await deleteSimulatedTenant(db, auth, entry);
      } catch (_) { /* ignore */ }
    }
  }

  process.exit(exitCode);
}

main();
