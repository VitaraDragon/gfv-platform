#!/usr/bin/env node
/**
 * Lab 1 mese — 5 aziende diverse (~22 giorni lavorativi).
 *
 * Prerequisito: npm run sim:emulators
 * Poi: npm run sim:run:mese-aziende
 * UI: http://127.0.0.1:8000/core/dev/simulator-dev-standalone.html?emulator=1
 * Password: SimGFV2026!
 *
 * @module simulator/run-mese-aziende
 */

import { runFullSimulation } from './lib/run-simulation.js';
import { isEmulatorAvailable } from './lib/emulator-available.js';
import { loadTemplate } from './lib/load-template.js';
import { readManifest } from './lib/manifest.js';
import { MESE_AZIENDE_RUNS } from './lib/mese-aziende-lab.js';
import { verifyMeseAzienda } from './lib/mese-aziende-verify.js';

function printPlaybook(results) {
  console.log('\n========== PLAYBOOK LAB 1 MESE / 5 AZIENDE ==========');
  console.log('Dev page: http://127.0.0.1:8000/core/dev/simulator-dev-standalone.html?emulator=1');
  console.log('Password tutti: SimGFV2026!');
  console.log('Doc: simulator/PLAYBOOK_MESE_AZIENDE.md\n');

  for (const r of results) {
    console.log(`--- ${r.label} ---`);
    console.log(`  tenantId: ${r.tenantId}`);
    console.log(`  template: ${r.templateId}`);
    console.log(`  azienda: ${r.aziendaNome || '-'}`);
    if (r.personas?.length) {
      for (const p of r.personas) {
        const roles = (p.ruoli || p.roles || []).join(',');
        console.log(`  ${roles || p.role}: ${p.email}`);
      }
    } else if (r.email) {
      console.log(`  manager: ${r.email}`);
    }
    for (const step of r.prove || []) {
      console.log(`  • ${step}`);
    }
    console.log('');
  }
  console.log('Flusso tipico multi-ruolo (aziende con manodopera):');
  console.log('  Manager pianifica → Capo comunica/segna → Operaio ore → Capo valida');
  console.log('  → Assenza → standby → Magazzino carichi/scarichi → Guasti parco');
  console.log('=====================================================\n');
}

async function main() {
  if (!(await isEmulatorAvailable())) {
    console.error('[mese-aziende] Emulator non raggiungibile. Avvia: npm run sim:emulators');
    process.exit(1);
  }

  const started = Date.now();
  const before = readManifest().length;
  let failed = 0;
  const results = [];

  console.log('[mese-aziende] 5 aziende — ~22 giorni lavorativi (1 mese)\n');

  for (const run of MESE_AZIENDE_RUNS) {
    const t0 = Date.now();
    const template = loadTemplate(run.templateId);
    try {
      const result = await runFullSimulation({
        templateId: run.templateId,
        seed: run.seed,
        appendManifest: true
      });
      const issues = await verifyMeseAzienda(result, template);
      const ok = issues.length === 0;
      if (!ok) failed += 1;

      const mag = result.magazzino?.counts || {};
      console.log(`[mese-aziende] ${ok ? 'OK' : 'FAIL'} ${result.setup.aziendaNome}`);
      console.log(`  tenant: ${result.setup.tenantId}`);
      console.log(`  email: ${result.setup.email}`);
      console.log(
        `  attività ${result.simulation.counts.attivita} | movimenti ${mag.movimenti || 0}` +
          ` (uscite ${mag.uscite ?? '-'}, carichi ${mag.carichi ?? 0})` +
          ` | guasti ${result.guastiSeed?.counts?.guasti ?? 0}`
      );
      if (result.vigneto) {
        console.log(
          `  vigneto: potature ${result.vigneto.counts.potature}, trattamenti ${result.vigneto.counts.trattamenti}`
        );
      }
      if (result.frutteto) {
        console.log(
          `  frutteto: potature ${result.frutteto.counts.potature}, trattamenti ${result.frutteto.counts.trattamenti}`
        );
      }
      if (result.contoTerzi) {
        console.log(
          `  conto terzi: clienti ${result.contoTerzi.counts?.clienti ?? '-'}, preventivi ${result.contoTerzi.counts?.preventivi ?? '-'}`
        );
      }
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
        console.log(`  issues: ${issues.join('; ')}`);
      }
      console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);

      const manifest = readManifest();
      const entry = [...manifest].reverse().find((e) => e.tenantId === result.setup.tenantId);
      results.push({
        label: run.label,
        templateId: run.templateId,
        tenantId: result.setup.tenantId,
        aziendaNome: result.setup.aziendaNome,
        email: result.setup.email,
        personas: entry?.personas || result.personas?.personas || [],
        prove: run.prove,
        ok
      });
    } catch (err) {
      failed += 1;
      console.error(`[mese-aziende] FAILED ${run.label}: ${err.message}\n`);
      results.push({
        label: run.label,
        templateId: run.templateId,
        tenantId: '-',
        prove: run.prove,
        ok: false
      });
    }
  }

  printPlaybook(results);

  console.log('[mese-aziende] Riepilogo');
  console.log(`  verify: ${MESE_AZIENDE_RUNS.length - failed}/${MESE_AZIENDE_RUNS.length} OK`);
  console.log(`  manifest: ${before} → ${readManifest().length} aziende`);
  console.log(`  durata: ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log('  password: SimGFV2026!');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[mese-aziende] FAILED:', err.message);
  process.exit(1);
});
