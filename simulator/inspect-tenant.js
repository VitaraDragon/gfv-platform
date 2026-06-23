#!/usr/bin/env node
/**
 * Ispeziona dati tenant sull'emulator (terreni, poderi, colture).
 * Uso: node simulator/inspect-tenant.js [tenantId]
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { assertSimulatorSafeToRun } from './lib/guard-production.js';
import { initEmulatorAdmin } from './lib/emulator-context.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, 'manifest.json'), 'utf-8'));
const tenantId = process.argv[2] || manifest[manifest.length - 1]?.tenantId;

if (!tenantId) {
  console.error('Nessun tenantId (argomento o manifest vuoto)');
  process.exit(1);
}

assertSimulatorSafeToRun();
const { db } = initEmulatorAdmin();

async function listCollection(name) {
  const snap = await db.collection(`tenants/${tenantId}/${name}`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const terreni = await listCollection('terreni');
const poderi = await listCollection('poderi');
const colture = await listCollection('colture');
const categorie = await listCollection('categorie');

console.log(`\n=== Tenant: ${tenantId} ===\n`);
console.log(`Poderi: ${poderi.length}`);
poderi.forEach((p) => console.log(`  - ${p.nome}`));
console.log(`Colture: ${colture.length} (categorie colture: ${categorie.filter((c) => c.applicabileA === 'colture').length})`);
console.log(`Terreni: ${terreni.length}\n`);

terreni.forEach((t) => {
  console.log(`• ${t.nome}`);
  console.log(`  coltura: ${t.coltura ?? '(manca)'}`);
  console.log(`  podere: ${t.podere ?? '(manca)'}`);
  console.log(`  tipoCampo: ${t.tipoCampo ?? '(manca)'}`);
  console.log(`  polygonCoords: ${Array.isArray(t.polygonCoords) ? t.polygonCoords.length + ' vertici' : '(manca)'}`);
});

const ok = terreni.every(
  (t) =>
    t.coltura === 'Vite da Vino' &&
    t.podere &&
    t.tipoCampo &&
    Array.isArray(t.polygonCoords) &&
    t.polygonCoords.length >= 3
);

console.log(ok ? '\n✔ Seed terreni OK' : '\n✘ Seed terreni INCOMPLETO');
process.exit(ok ? 0 : 1);
