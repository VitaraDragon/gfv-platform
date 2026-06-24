#!/usr/bin/env node
/**
 * Genera N aziende simulate complete (setup + asset + attività + magazzino).
 * @module simulator/run-batch
 */

import { runFullSimulation } from './lib/run-simulation.js';
import { isEmulatorAvailable } from './lib/emulator-available.js';
import { initEmulatorAdmin } from './lib/emulator-context.js';
import { inspectTenantSeed } from './lib/tenant-inspect.js';
import { readManifest } from './lib/manifest.js';

const args = process.argv.slice(2);
const countArg = args.find((a) => a.startsWith('--count='));
const count = Math.max(1, parseInt(countArg ? countArg.split('=')[1] : '10', 10) || 10);
const verbose = args.includes('--verbose');

async function main() {
  if (!(await isEmulatorAvailable())) {
    console.error('[sim:batch] Emulator non raggiungibile. Avvia: npm run sim:emulators');
    process.exit(1);
  }

  const started = Date.now();
  const before = readManifest().length;
  const rows = [];

  console.log(`[sim:batch] Creazione ${count} aziende (template solo-titolare-viticola)…`);

  for (let i = 1; i <= count; i += 1) {
    const t0 = Date.now();
    try {
      const result = await runFullSimulation({ templateId: 'solo-titolare-viticola' });
      const { setup, assets, simulation, magazzino } = result;
      const { db } = initEmulatorAdmin();
      const inspect = await inspectTenantSeed(db, setup.tenantId);
      const movimenti = magazzino.counts.movimenti;
      const ok = inspect.ok && movimenti >= 8 && simulation.counts.attivita >= 20;

      rows.push({
        ok,
        aziendaNome: setup.aziendaNome,
        tenantId: setup.tenantId,
        email: setup.email,
        attivita: simulation.counts.attivita,
        movimenti,
        sottoScorta: magazzino.sottoScorta,
        ms: Date.now() - t0
      });

      const mark = ok ? 'OK' : 'WARN';
      console.log(
        `[sim:batch] ${i}/${count} ${mark} ${setup.aziendaNome} — attività ${simulation.counts.attivita}, movimenti ${movimenti} (${Date.now() - t0}ms)`
      );
      if (verbose && !inspect.ok) {
        console.warn(`  seed terreni: ${inspect.errors.join('; ')}`);
      }
    } catch (err) {
      rows.push({ ok: false, error: err.message, ms: Date.now() - t0 });
      console.error(`[sim:batch] ${i}/${count} FAILED: ${err.message}`);
    }
  }

  const okCount = rows.filter((r) => r.ok).length;
  const failCount = rows.filter((r) => r.ok === false).length;
  const manifestTotal = readManifest().length;

  console.log('\n[sim:batch] Riepilogo');
  console.log(`  create in questo run: ${rows.length}`);
  console.log(`  OK: ${okCount} | errori: ${failCount}`);
  console.log(`  manifest: ${before} → ${manifestTotal} aziende`);
  console.log(`  durata totale: ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`  dev UI: http://127.0.0.1:8000/core/dev/simulator-dev-standalone.html?emulator=1`);

  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[sim:batch] FAILED:', err.message);
  process.exit(1);
});
