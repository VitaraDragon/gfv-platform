#!/usr/bin/env node
/**
 * Run demo regime max: 2 aziende (manodopera 10 op / 2 capi + solo titolare), 30 giorni.
 * @module simulator/run-demo-max
 */

import { runFullSimulation } from './lib/run-simulation.js';
import { isEmulatorAvailable } from './lib/emulator-available.js';
import { initEmulatorAdmin } from './lib/emulator-context.js';
import { inspectTenantSeed } from './lib/tenant-inspect.js';
import { inspectManodoperaSeed } from './lib/manodopera-inspect.js';
import { expectedVignetoCountsFromTemplate } from './phases/05-simulate-vigneto.js';
import { loadTemplate } from './lib/load-template.js';
import { readManifest } from './lib/manifest.js';

const RUNS = [
  {
    label: 'Regime max manodopera (2 capi, 10 operai)',
    templateId: 'regime-max-manodopera',
    seed: 880001
  },
  {
    label: 'Regime max solo titolare',
    templateId: 'regime-max-titolare',
    seed: 880002
  }
];

async function verifyRun(result, template) {
  const { db } = initEmulatorAdmin();
  const inspect = await inspectTenantSeed(db, result.setup.tenantId);
  const vigExpected = expectedVignetoCountsFromTemplate(template);
  const issues = [];

  if (!inspect.ok) issues.push(...inspect.errors);
  if (result.simulation.counts.attivita < 30) {
    issues.push(`attività ${result.simulation.counts.attivita}/30`);
  }
  if (result.vigneto.counts.potature < vigExpected.potature) {
    issues.push(`potature ${result.vigneto.counts.potature}/${vigExpected.potature}`);
  }
  if (result.vigneto.counts.trattamenti < vigExpected.trattamenti) {
    issues.push(`trattamenti ${result.vigneto.counts.trattamenti}/${vigExpected.trattamenti}`);
  }
  if (result.magazzino.counts.movimenti < 8) {
    issues.push(`movimenti ${result.magazzino.counts.movimenti}/≥8`);
  }

  if (result.manodoperaOre) {
    const q = template.quantities;
    const mo = await inspectManodoperaSeed(db, result.setup.tenantId, {
      squadre: q.squadre,
      lavoriSquadra: q.lavoriSquadra,
      lavoriAutonomi: q.lavoriAutonomi,
      minOreOperaioValidateDaCapo: 1,
      minOreCapoValidateDaManager: 1,
      minOreAutonomoValidateDaManager: 1,
      minComunicazioniAttive: 1,
      requireConfermeDestinatari: true,
      minAssenzeMalattiaConfermate: 1,
      minLavoriStandbyAssenza: 1
    });
    if (!mo.ok) issues.push(...mo.errors);
    if (result.manodoperaOre.counts.oreValidate < 50) {
      issues.push(`ore validate ${result.manodoperaOre.counts.oreValidate}/≥50`);
    }
  }

  return issues;
}

async function main() {
  if (!(await isEmulatorAvailable())) {
    console.error('[sim:demo-max] Emulator non raggiungibile. Avvia: npm run sim:emulators');
    process.exit(1);
  }

  const started = Date.now();
  const before = readManifest().length;
  let failed = 0;

  console.log('[sim:demo-max] 2 aziende — 30 giorni lavorativi, vigneto/magazzino/mezzi/manodopera\n');

  for (const run of RUNS) {
    const t0 = Date.now();
    const template = loadTemplate(run.templateId);
    try {
      const result = await runFullSimulation({
        templateId: run.templateId,
        seed: run.seed,
        appendManifest: true
      });
      const issues = await verifyRun(result, template);
      const ok = issues.length === 0;
      if (!ok) failed += 1;

      console.log(`[sim:demo-max] ${ok ? 'OK' : 'WARN'} ${result.setup.aziendaNome}`);
      console.log(`  tenant: ${result.setup.tenantId}`);
      console.log(`  email: ${result.setup.email}`);
      console.log(
        `  attività ${result.simulation.counts.attivita} | potature ${result.vigneto.counts.potature} | trattamenti ${result.vigneto.counts.trattamenti} | movimenti ${result.magazzino.counts.movimenti}`
      );
      console.log(
        `  mezzi: ${result.assets.counts.trattori} trattori, ${result.assets.counts.attrezzi} attrezzi, flotta ${result.assets.counts.flotta ?? 0}`
      );
      if (result.personas) {
        console.log(
          `  personas: capi ${result.personas.counts.caposquadra}, operai ${result.personas.counts.operai}`
        );
      }
      if (result.manodoperaOre) {
        const c = result.manodoperaOre.counts;
        console.log(
          `  manodopera: ore ${c.oreSegnate}/${c.oreValidate} validate, comm ${c.comunicazioniInviate}, assenze ${c.assenzeMalattiaConfermate}, standby ${c.lavoriStandbyAssenza}`
        );
      }
      if (issues.length) {
        console.log(`  note: ${issues.join('; ')}`);
      }
      console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
    } catch (err) {
      failed += 1;
      console.error(`[sim:demo-max] FAILED ${run.label}: ${err.message}\n`);
    }
  }

  console.log('[sim:demo-max] Riepilogo');
  console.log(`  manifest: ${before} → ${readManifest().length} aziende`);
  console.log(`  durata: ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log('  dev UI: http://127.0.0.1:8000/core/dev/simulator-dev-standalone.html?emulator=1');
  console.log('  password: SimGFV2026!');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[sim:demo-max] FAILED:', err.message);
  process.exit(1);
});
