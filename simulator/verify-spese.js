#!/usr/bin/env node
/**
 * Verifica calcolo spese vigneto su tenant simulato o manifest.
 * Uso: node simulator/verify-spese.js [--tenant=ID] [--seed=424242]
 * @module simulator/verify-spese
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { isEmulatorAvailable } from './lib/emulator-available.js';
import { initEmulatorAdmin } from './lib/emulator-context.js';
import { runFullSimulation } from './lib/run-simulation.js';
import { deleteSimulatedTenant } from './lib/cleanup-tenant.js';
import { verifySpeseVignetoTenant } from './lib/verify-spese-vigneto-tenant.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const out = { tenant: null, seed: 424242, fresh: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--tenant=')) out.tenant = arg.slice(9);
    else if (arg.startsWith('--seed=')) out.seed = parseInt(arg.slice(7), 10);
    else if (arg === '--fresh') out.fresh = true;
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const up = await isEmulatorAvailable();
  if (!up) {
    console.error('[verify-spese] Emulator non raggiungibile. Avvia: npm run sim:emulators');
    process.exit(1);
  }

  /** @type {{ tenantId: string, userId: string } | null} */
  let setup = null;
  let tenantId = args.tenant;

  try {
    if (args.fresh || !tenantId) {
      const result = await runFullSimulation({
        templateId: 'solo-titolare-viticola',
        seed: args.seed,
        appendManifest: false
      });
      setup = result.setup;
      tenantId = setup.tenantId;
      console.log(`[verify-spese] Simulazione fresh tenant: ${tenantId}`);
    } else {
      console.log(`[verify-spese] Tenant manifest: ${tenantId}`);
    }

    const { db } = initEmulatorAdmin();
    const report = await verifySpeseVignetoTenant(db, tenantId);

    console.log('\n=== RIEPILOGO SPESE VIGNETO ===');
    console.log(`Anno: ${report.anno} | Tariffa proprietario: ${report.tariffaProprietario} €/h`);
    console.log(`Parco macchine: ${report.parcoMacchine ? 'sì' : 'no'}`);
    console.log(`Totali (reference aggregaSpese):`, report.totals);
    console.log('Conteggi:', report.counts);

    for (const v of report.vigneti) {
      console.log(
        `\n  ${v.varieta || v.vignetoId}: manodopera ${v.reference.speseManodoperaAnno} € | prodotti ${v.reference.speseProdottiAnno} € | macchine ${v.reference.speseMacchineAnno} € | totale ${v.reference.costoTotaleAnno} €`
      );
      console.log(`    attività contate: ${v.reference.attivitaContate}`);
      if (v.stored.costoTotaleAnno != null) {
        console.log(
          `    doc Firestore: totale ${v.stored.costoTotaleAnno} € | M ${v.stored.speseManodoperaAnno} | Mac ${v.stored.speseMacchineAnno} | Prod ${v.stored.speseProdottiAnno}`
        );
      }
    }

    if (report.warnings.length) {
      console.log('\n=== AVVISI ===');
      report.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    }
    if (report.errors.length) {
      console.log('\n=== ERRORI ===');
      report.errors.forEach((e) => console.log(`  ✗ ${e}`));
    }

    if (report.ok) {
      console.log('\n[verify-spese] OK — calcolo coerente con dati seed (vedi avvisi per gap architetturali)');
      process.exit(report.warnings.length ? 0 : 0);
    }
    console.log('\n[verify-spese] FAILED');
    process.exit(1);
  } finally {
    if (setup?.tenantId && args.fresh) {
      try {
        const { db, auth } = initEmulatorAdmin();
        await deleteSimulatedTenant(db, auth, setup);
      } catch (_) { /* ignore */ }
    }
  }
}

main().catch((err) => {
  console.error('[verify-spese] ERRORE:', err);
  process.exit(1);
});
