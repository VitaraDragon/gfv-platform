#!/usr/bin/env node
/**
 * Aggiorna terreni/poderi delle aziende manifest create prima del seed v2.
 * @module simulator/migrate-terreni-seed
 */

import { readManifest, SEED_VERSION } from './lib/manifest.js';
import { assertSimulatorSafeToRun } from './lib/guard-production.js';
import { initEmulatorAdmin } from './lib/emulator-context.js';
import { seedTenantReferenceData } from './lib/seed-reference-data.js';
import { seedAppCatalog } from './lib/seed-app-catalog.js';

const MORFOLOGIE = ['collina', 'pianura', 'collina', 'montagna'];

function polygonAround(lat, lng, delta = 0.0015) {
  return [
    { lat: lat - delta, lng: lng - delta },
    { lat: lat - delta, lng: lng + delta },
    { lat: lat + delta, lng: lng + delta },
    { lat: lat + delta, lng: lng - delta }
  ];
}

async function migrateTenant(db, entry) {
  const { tenantId, aziendaNome, userId, seedVersion } = entry;
  if (seedVersion >= SEED_VERSION) {
    console.log(`[skip] ${aziendaNome} — già seed v${seedVersion}`);
    return { skipped: true };
  }

  const podereNome = aziendaNome || 'Podere principale';
  const poderiSnap = await db.collection(`tenants/${tenantId}/poderi`).limit(1).get();
  if (poderiSnap.empty) {
    await seedTenantReferenceData(db, tenantId, userId || 'sim-migrate', { podereNome });
  }

  const colSnap = await db.collection(`tenants/${tenantId}/colture`).limit(1).get();
  const subSnap = await db
    .collection(`tenants/${tenantId}/categorie`)
    .where('parentId', '!=', null)
    .limit(1)
    .get();
  if (colSnap.empty || subSnap.empty) {
    const stats = await seedAppCatalog(db, tenantId, userId || 'sim-migrate');
    console.log(
      `  catalogo app: +${stats.categoriePrincipali} cat, +${stats.sottocategorie} sottocat, +${stats.tipiLavoro} tipi, +${stats.colture} colture`
    );
  }

  const terreniSnap = await db.collection(`tenants/${tenantId}/terreni`).get();
  let updated = 0;
  let i = 0;
  for (const doc of terreniSnap.docs) {
    const t = doc.data();
    const lat = t.coordinate?.lat ?? 45.4 + i * 0.01;
    const lng = t.coordinate?.lng ?? 11.8 + i * 0.01;
    const patch = {
      coltura: 'Vite da Vino',
      podere: t.podere || podereNome,
      tipoCampo: t.tipoCampo || MORFOLOGIE[i % MORFOLOGIE.length],
      updatedAt: new Date()
    };
    if (!t.coordinate) patch.coordinate = { lat, lng };
    if (!Array.isArray(t.polygonCoords) || t.polygonCoords.length < 3) {
      patch.polygonCoords = polygonAround(lat, lng);
    }
    await doc.ref.update(patch);
    updated += 1;
    i += 1;
  }

  console.log(`[ok] ${aziendaNome} — ${updated} terreni aggiornati`);
  return { updated };
}

async function main() {
  assertSimulatorSafeToRun();
  const { db } = initEmulatorAdmin();
  const manifest = readManifest();
  if (!manifest.length) {
    console.log('Manifest vuoto.');
    return;
  }

  let total = 0;
  for (const entry of manifest) {
    const result = await migrateTenant(db, entry);
    if (result.updated) total += result.updated;
  }
  console.log(`\nMigrati ${total} terreni su ${manifest.length} aziende in manifest.`);
  console.log('Ricarica la pagina dev e rientra nell\'azienda.');
}

main().catch((err) => {
  console.error('[sim:migrate-terreni] FAILED:', err.message);
  process.exit(1);
});
