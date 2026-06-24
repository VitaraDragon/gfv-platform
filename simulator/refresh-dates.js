#!/usr/bin/env node
/**
 * Ricalcola date attività (ultime N settimane lavorative fino a oggi).
 * @module simulator/refresh-dates
 */

import { readManifest } from './lib/manifest.js';
import { assertSimulatorSafeToRun } from './lib/guard-production.js';
import { initEmulatorAdmin } from './lib/emulator-context.js';
import { refreshTenantDates } from './lib/refresh-dates.js';

const args = process.argv.slice(2);
const allManifest = args.includes('--all');
const tenantArg = args.find((a) => !a.startsWith('--'));

async function main() {
  assertSimulatorSafeToRun();
  const { db } = initEmulatorAdmin();

  let tenantIds = [];
  if (tenantArg) {
    tenantIds = [tenantArg];
  } else if (allManifest) {
    tenantIds = readManifest().map((e) => e.tenantId);
  } else {
    const last = readManifest().at(-1)?.tenantId;
    if (!last) throw new Error('Manifest vuoto — passa tenantId o --all');
    tenantIds = [last];
  }

  if (!tenantIds.length) {
    console.log('[sim:refresh-dates] Nessun tenant da aggiornare.');
    return;
  }

  for (const tenantId of tenantIds) {
    try {
      const result = await refreshTenantDates(db, tenantId);
      console.log(
        `[sim:refresh-dates] OK ${tenantId} — ${result.attivita} attività, ${result.movimenti} movimenti (${result.dateRange.from} → ${result.dateRange.to})`
      );
    } catch (err) {
      console.warn(`[sim:refresh-dates] SKIP ${tenantId}: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error('[sim:refresh-dates] FAILED:', err.message);
  process.exit(1);
});
