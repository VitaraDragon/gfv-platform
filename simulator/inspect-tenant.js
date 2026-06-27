#!/usr/bin/env node
/**
 * Ispeziona dati tenant sull'emulator (terreni, poderi, colture).
 * Uso: node simulator/inspect-tenant.js [tenantId]
 */
import { readManifest } from './lib/manifest.js';
import { assertSimulatorSafeToRun } from './lib/guard-production.js';
import { initEmulatorAdmin } from './lib/emulator-context.js';
import { inspectTenantSeed } from './lib/tenant-inspect.js';
import { inspectContoTerziSeed } from './lib/conto-terzi-inspect.js';
import { loadTemplate, isContoTerziTemplate } from './lib/load-template.js';

const tenantId = process.argv[2] || readManifest().at(-1)?.tenantId;

if (!tenantId) {
  console.error('Nessun tenantId (argomento o manifest vuoto)');
  process.exit(1);
}

assertSimulatorSafeToRun();
const { db } = initEmulatorAdmin();
const report = await inspectTenantSeed(db, tenantId);

const manifestEntry = readManifest().find((e) => e.tenantId === tenantId);
let contoTerziReport = null;
if (manifestEntry?.templateId) {
  try {
    const template = loadTemplate(manifestEntry.templateId);
    if (isContoTerziTemplate(template)) {
      const q = template.quantities || {};
      contoTerziReport = await inspectContoTerziSeed(db, tenantId, {
        clienti: q.clienti ?? 3,
        poderiClienti: q.poderiClienti ?? q.clienti ?? 3,
        terreniClienti: q.terreniClienti ?? 6,
        tariffe: q.tariffe ?? 8,
        preventivi: q.preventivi ?? 5,
        minPreventiviInviati: 1,
        minPreventiviAccettati: 1
      });
    }
  } catch (_) { /* template non risolvibile */ }
}

console.log(`\n=== Tenant: ${tenantId} ===\n`);
console.log(`Poderi: ${report.counts.poderi}`);
console.log(`Colture: ${report.counts.colture} (categorie colture: ${report.counts.categorieColture})`);
console.log(`Terreni: ${report.counts.terreni} | Attività: ${report.counts.attivita} | Movimenti: ${report.counts.movimentiMagazzino} | Sotto scorta: ${report.counts.prodottiSottoScorta}\n`);

if (contoTerziReport) {
  console.log(
    `Conto Terzi: clienti ${contoTerziReport.counts.clienti}, poderi ${contoTerziReport.counts.poderiClienti}, ` +
      `terreni clienti ${contoTerziReport.counts.terreniClienti}, tariffe ${contoTerziReport.counts.tariffe}, ` +
      `preventivi ${contoTerziReport.counts.preventivi} (${contoTerziReport.counts.preventiviInviati} inviati, ` +
      `${contoTerziReport.counts.preventiviAccettati} accettati)\n`
  );
}

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
if (contoTerziReport?.errors?.length) {
  contoTerziReport.errors.forEach((e) => console.log(`  ! conto terzi: ${e}`));
}

const seedOk = report.ok && (!contoTerziReport || contoTerziReport.ok);
console.log(seedOk ? '\n✔ Seed terreni OK' : '\n✘ Seed terreni INCOMPLETO');
process.exit(seedOk ? 0 : 1);
