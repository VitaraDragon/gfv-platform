#!/usr/bin/env node
/**
 * Ispeziona dati tenant sull'emulator (terreni, poderi, colture).
 * Uso: node simulator/inspect-tenant.js [tenantId]
 */
import { readManifest } from './lib/manifest.js';
import { assertSimulatorSafeToRun } from './lib/guard-production.js';
import { initEmulatorAdmin } from './lib/emulator-context.js';
import { inspectTenantSeed } from './lib/tenant-inspect.js';

const tenantId = process.argv[2] || readManifest().at(-1)?.tenantId;

if (!tenantId) {
  console.error('Nessun tenantId (argomento o manifest vuoto)');
  process.exit(1);
}

assertSimulatorSafeToRun();
const { db } = initEmulatorAdmin();
const report = await inspectTenantSeed(db, tenantId);

console.log(`\n=== Tenant: ${tenantId} ===\n`);
console.log(`Poderi: ${report.counts.poderi}`);
console.log(`Colture: ${report.counts.colture} (categorie colture: ${report.counts.categorieColture})`);
console.log(`Terreni: ${report.counts.terreni} | Attività: ${report.counts.attivita} | Movimenti: ${report.counts.movimentiMagazzino} | Sotto scorta: ${report.counts.prodottiSottoScorta}\n`);

report.terreni.forEach((t) => {
  console.log(`• ${t.nome}`);
  console.log(`  coltura: ${t.coltura ?? '(manca)'}`);
  console.log(`  podere: ${t.podere ?? '(manca)'}`);
  console.log(`  tipoCampo: ${t.tipoCampo ?? '(manca)'}`);
  console.log(`  polygonCoords: ${Array.isArray(t.polygonCoords) ? t.polygonCoords.length + ' vertici' : '(manca)'}`);
});

if (report.errors.length) {
  report.errors.forEach((e) => console.log(`  ! ${e}`));
}

console.log(report.ok ? '\n✔ Seed terreni OK' : '\n✘ Seed terreni INCOMPLETO');
process.exit(report.ok ? 0 : 1);
