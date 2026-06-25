/**
 * Catalogo minimo categorie lavori + tipi lavoro per UI vigneto (Diario → Trattamenti/Potatura).
 * @module simulator/lib/seed-lavori-catalog
 */

import { addTenantDocument } from './firestore-write.js';

/** Categorie radice (collection `categorie`, applicabileA lavori) */
const CATEGORIE_LAVORI = [
  { nome: 'Trattamenti', codice: 'trattamenti', descrizione: 'Fitofarmaci e controllo fitosanitario', ordine: 2 },
  { nome: 'Concimazione', codice: 'concimazione', descrizione: 'Concimazioni di campo', ordine: 3 },
  { nome: 'Potatura', codice: 'potatura', descrizione: 'Potatura vigneto', ordine: 4 },
  { nome: 'Lavorazione del Terreno', codice: 'lavorazione_terreno', descrizione: 'Erpicatura e lavorazioni suolo', ordine: 1 }
];

/** Nome tipo lavoro attività simulata → codice categoria radice */
export const TIPO_LAVORO_CATEGORIA_CODICE = {
  Potatura: 'potatura',
  Trattamento: 'trattamenti',
  Concimazione: 'concimazione',
  'Controllo fitosanitario': 'trattamenti',
  Erpicatura: 'lavorazione_terreno'
};

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {string} userId
 * @param {string[]} [tipiLavoroNomi]
 * @returns {Promise<{ categorieMap: Record<string, string>, tipiSeed: number }>}
 */
export async function seedLavoriCatalog(db, tenantId, userId, tipiLavoroNomi = []) {
  const existingSnap = await db.collection(`tenants/${tenantId}/categorie`).get();
  const byCodice = new Map();
  for (const doc of existingSnap.docs) {
    const cod = (doc.data().codice || '').toLowerCase();
    if (cod) byCodice.set(cod, doc.id);
  }

  const categorieMap = {};
  for (const cat of CATEGORIE_LAVORI) {
    const key = cat.codice.toLowerCase();
    if (byCodice.has(key)) {
      categorieMap[cat.codice] = byCodice.get(key);
      continue;
    }
    const id = await addTenantDocument(db, tenantId, 'categorie', {
      nome: cat.nome,
      codice: cat.codice,
      descrizione: cat.descrizione,
      applicabileA: 'entrambi',
      predefinita: true,
      ordine: cat.ordine,
      attiva: true,
      creatoDa: userId
    });
    categorieMap[cat.codice] = id;
    byCodice.set(key, id);
  }

  const tipiSnap = await db.collection(`tenants/${tenantId}/tipiLavoro`).get();
  const nomiEsistenti = new Set(
    tipiSnap.docs.map((d) => (d.data().nome || '').trim().toLowerCase())
  );

  let tipiSeed = 0;
  const nomi = tipiLavoroNomi.length
    ? tipiLavoroNomi
    : Object.keys(TIPO_LAVORO_CATEGORIA_CODICE);

  for (const nome of nomi) {
    if (nomiEsistenti.has(nome.trim().toLowerCase())) continue;
    const codiceCat = TIPO_LAVORO_CATEGORIA_CODICE[nome];
    const categoriaId = codiceCat ? categorieMap[codiceCat] : null;
    if (!categoriaId) continue;
    await addTenantDocument(db, tenantId, 'tipiLavoro', {
      nome,
      categoriaId,
      sottocategoriaId: null,
      descrizione: `Tipo lavoro simulato — ${nome}`,
      predefinito: true,
      attivo: true,
      creatoDa: userId
    });
    nomiEsistenti.add(nome.trim().toLowerCase());
    tipiSeed += 1;
  }

  return { categorieMap, tipiSeed };
}
