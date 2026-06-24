#!/usr/bin/env node
/**
 * Elimina tenant simulati dall'emulator e aggiorna manifest.
 * Uso:
 *   npm run sim:cleanup              # rimuove tutte le entry del manifest
 *   npm run sim:cleanup -- --keep 2  # mantiene le ultime 2 aziende
 *   npm run sim:cleanup -- --dry-run
 * @module simulator/cleanup
 */

import { readManifest, writeManifest } from './lib/manifest.js';
import { assertSimulatorSafeToRun } from './lib/guard-production.js';
import { initEmulatorAdmin } from './lib/emulator-context.js';
import { deleteSimulatedTenant } from './lib/cleanup-tenant.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const keepArg = args.find((a) => a.startsWith('--keep='));
const keepFlagIdx = args.indexOf('--keep');
const keepCount = keepArg
  ? Number(keepArg.split('=')[1])
  : keepFlagIdx >= 0
    ? Number(args[keepFlagIdx + 1])
    : 0;

function sortByCreatedAt(list) {
  return [...list].sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0));
}

async function main() {
  assertSimulatorSafeToRun();
  const manifest = readManifest();

  if (!manifest.length) {
    console.log('[sim:cleanup] Manifest vuoto — niente da fare.');
    return;
  }

  const sorted = sortByCreatedAt(manifest);
  const toKeep = Number.isFinite(keepCount) && keepCount > 0 ? sorted.slice(-keepCount) : [];
  const toDelete = Number.isFinite(keepCount) && keepCount > 0
    ? sorted.slice(0, Math.max(0, sorted.length - keepCount))
    : sorted;

  console.log(`[sim:cleanup] ${dryRun ? '(dry-run) ' : ''}Rimuovo ${toDelete.length} aziende, tengo ${toKeep.length}.`);

  if (dryRun) {
    toDelete.forEach((e) => console.log(`  - ${e.aziendaNome} (${e.tenantId})`));
    return;
  }

  const { db, auth } = initEmulatorAdmin();

  for (const entry of toDelete) {
    try {
      await deleteSimulatedTenant(db, auth, {
        tenantId: entry.tenantId,
        userId: entry.userId
      });
      console.log(`[sim:cleanup] OK ${entry.aziendaNome} (${entry.tenantId})`);
    } catch (err) {
      console.warn(`[sim:cleanup] WARN ${entry.tenantId}: ${err.message}`);
    }
  }

  writeManifest(toKeep);
  console.log(`[sim:cleanup] Manifest aggiornato (${toKeep.length} entry).`);
}

main().catch((err) => {
  console.error('[sim:cleanup] FAILED:', err.message);
  if (err.message.includes('FIRESTORE_EMULATOR_HOST')) {
    console.error('Avvia prima: npm run sim:emulators');
  }
  process.exit(1);
});
