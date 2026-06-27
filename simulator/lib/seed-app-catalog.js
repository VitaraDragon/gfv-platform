/**
 * Seed catalogo app completo (categorie, sottocategorie, tipi lavoro, colture) — Admin SDK.
 * Allineato a initializeCategoriePredefinite / initializeTipiLavoroPredefiniti / initializeColturePredefinite.
 * @module simulator/lib/seed-app-catalog
 */

import { addTenantDocument } from './firestore-write.js';
import {
  CATEGORIE_PRINCIPALI_PREDEFINITE,
  CATEGORIE_COLTURE_PREDEFINITE,
  SOTTOCATEGORIE_PREDEFINITE,
  TIPI_LAVORO_PREDEFINITI,
  COLTURE_PREDEFINITE,
  SIM_ALIASES_TIPI_LAVORO,
  TIPI_LAVORO_CANONICAL_FIXES,
} from '../../core/config/app-catalog-seed-data.js';

async function loadCategorieIndex(db, tenantId) {
  const snap = await db.collection(`tenants/${tenantId}/categorie`).get();
  const byCodice = new Map();
  const all = [];
  for (const doc of snap.docs) {
    const row = { id: doc.id, ...doc.data() };
    all.push(row);
    if (row.codice) byCodice.set(String(row.codice).toLowerCase(), row);
  }
  return { byCodice, all };
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {string} userId
 * @returns {Promise<{ categoriePrincipali: number, sottocategorie: number, tipiLavoro: number, colture: number }>}
 */
export async function seedAppCatalog(db, tenantId, userId) {
  const stats = { categoriePrincipali: 0, sottocategorie: 0, tipiLavoro: 0, colture: 0 };
  let { byCodice, all } = await loadCategorieIndex(db, tenantId);
  const codiceToId = new Map();
  for (const [cod, row] of byCodice) codiceToId.set(cod, row.id);

  for (const cat of [...CATEGORIE_PRINCIPALI_PREDEFINITE, ...CATEGORIE_COLTURE_PREDEFINITE]) {
    const key = String(cat.codice).toLowerCase();
    if (byCodice.has(key)) continue;
    const id = await addTenantDocument(db, tenantId, 'categorie', {
      ...cat,
      attiva: true,
      creatoDa: userId,
    });
    codiceToId.set(key, id);
    byCodice.set(key, { id, ...cat });
    all.push({ id, ...cat });
    stats.categoriePrincipali += 1;
  }

  for (const sub of SOTTOCATEGORIE_PREDEFINITE) {
    const key = String(sub.codice).toLowerCase();
    if (byCodice.has(key)) continue;
    const parentId = codiceToId.get(String(sub.parentCodice).toLowerCase());
    if (!parentId) continue;
    const { parentCodice, ...payload } = sub;
    const id = await addTenantDocument(db, tenantId, 'categorie', {
      ...payload,
      parentId,
      attiva: true,
      creatoDa: userId,
    });
    codiceToId.set(key, id);
    byCodice.set(key, { id, ...payload, parentId });
    all.push({ id, ...payload, parentId });
    stats.sottocategorie += 1;
  }

  const sottocatByCodice = new Map();
  const catByCodice = new Map();
  for (const c of all) {
    if (!c.codice) continue;
    const k = String(c.codice).toLowerCase();
    if (c.parentId) sottocatByCodice.set(k, c.id);
    else catByCodice.set(k, c.id);
  }

  const tipiSnap = await db.collection(`tenants/${tenantId}/tipiLavoro`).get();
  const nomiTipi = new Set(tipiSnap.docs.map((d) => String(d.data().nome || '').toLowerCase()));

  for (const tipo of [...TIPI_LAVORO_PREDEFINITI, ...SIM_ALIASES_TIPI_LAVORO]) {
    if (nomiTipi.has(String(tipo.nome).toLowerCase())) continue;

    let categoriaId = null;
    let sottocategoriaId = null;

    if (tipo.sottocategoriaCodice) {
      sottocategoriaId = sottocatByCodice.get(String(tipo.sottocategoriaCodice).toLowerCase()) || null;
      const sub = all.find((c) => c.id === sottocategoriaId);
      categoriaId = sub?.parentId || null;
    } else if (tipo.categoriaCodice) {
      categoriaId = catByCodice.get(String(tipo.categoriaCodice).toLowerCase()) || null;
    }

    if (!categoriaId) continue;

    await addTenantDocument(db, tenantId, 'tipiLavoro', {
      nome: tipo.nome,
      categoriaId,
      sottocategoriaId,
      descrizione: tipo.descrizione || null,
      predefinito: true,
      attivo: true,
      creatoDa: userId,
    });
    nomiTipi.add(String(tipo.nome).toLowerCase());
    stats.tipiLavoro += 1;
  }

  const colSnap = await db.collection(`tenants/${tenantId}/colture`).get();
  const nomiCol = new Set(colSnap.docs.map((d) => String(d.data().nome || '').toLowerCase()));

  for (const col of COLTURE_PREDEFINITE) {
    if (nomiCol.has(String(col.nome).toLowerCase())) continue;
    const categoriaId = catByCodice.get(String(col.categoriaCodice).toLowerCase());
    if (!categoriaId) continue;
    await addTenantDocument(db, tenantId, 'colture', {
      nome: col.nome,
      categoriaId,
      descrizione: col.descrizione || null,
      predefinito: true,
      creatoDa: userId,
    });
    nomiCol.add(String(col.nome).toLowerCase());
    stats.colture += 1;
  }

  const tipiFinalSnap = await db.collection(`tenants/${tenantId}/tipiLavoro`).get();
  for (const fix of TIPI_LAVORO_CANONICAL_FIXES) {
    const doc = tipiFinalSnap.docs.find(
      (d) => String(d.data().nome || '').toLowerCase() === fix.nome.toLowerCase()
    );
    if (!doc) continue;
    const targetSubId = sottocatByCodice.get(String(fix.sottocategoriaCodice).toLowerCase());
    if (!targetSubId || doc.data().sottocategoriaId === targetSubId) continue;
    const sub = all.find((c) => c.id === targetSubId);
    await doc.ref.update({
      sottocategoriaId: targetSubId,
      categoriaId: sub?.parentId || doc.data().categoriaId,
      descrizione: fix.descrizione || doc.data().descrizione || null,
      updatedAt: new Date(),
    });
  }

  return stats;
}
