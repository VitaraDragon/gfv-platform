#!/usr/bin/env node
/**
 * Smoke test Fase 0 — emulator + firestore-write + payload terreno.
 * @module simulator/smoke-test
 */

import { assertSimulatorSafeToRun } from './lib/guard-production.js';
import { initEmulatorAdmin } from './lib/emulator-context.js';
import {
  addTenantDocument,
  getTenantDocument,
  normalizeForAdmin
} from './lib/firestore-write.js';

async function main() {
  console.log('[sim:smoke] Verifica guard emulator…');
  const { projectId, firestoreHost } = assertSimulatorSafeToRun();
  console.log(`[sim:smoke] OK — project=${projectId}, firestore=${firestoreHost}`);

  const { db } = initEmulatorAdmin();
  const tenantId = `sim_smoke_${Date.now()}`;

  const terrenoPayload = normalizeForAdmin({
    nome: 'Podere Smoke Test',
    superficie: 1.2,
    coltura: 'Vite da Vino',
    tipoPossesso: 'proprieta',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  console.log('[sim:smoke] Write terreno di test…');
  const terrenoId = await addTenantDocument(db, tenantId, 'terreni', terrenoPayload);
  const readBack = await getTenantDocument(db, tenantId, 'terreni', terrenoId);

  if (!readBack || readBack.nome !== 'Podere Smoke Test') {
    throw new Error('Lettura terreno smoke fallita');
  }

  console.log('[sim:smoke] SUCCESS');
  console.log(`  tenant: ${tenantId}`);
  console.log(`  terreno: ${terrenoId}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[sim:smoke] FAILED:', err.message);
  if (err.message.includes('ECONNREFUSED') || err.code === 14) {
    console.error('Avvia prima gli emulator: npm run sim:emulators');
  }
  process.exit(1);
});
