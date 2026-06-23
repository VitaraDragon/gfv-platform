/**
 * Dati di riferimento tenant (categorie colture, colture, poderi) per allineamento UI.
 * @module simulator/lib/seed-reference-data
 */

import { addTenantDocument } from './firestore-write.js';

const CATEGORIE_COLTURE = [
  { nome: 'Frutteto', codice: 'frutteto', descrizione: 'Alberi da frutto', ordine: 1 },
  { nome: 'Seminativo', codice: 'seminativo', descrizione: 'Colture erbacee da granella', ordine: 2 },
  { nome: 'Vite', codice: 'vite', descrizione: 'Vigneto', ordine: 3 },
  { nome: 'Ortive', codice: 'ortive', descrizione: 'Colture orticole', ordine: 4 },
  { nome: 'Prato', codice: 'prato', descrizione: 'Prati e pascoli', ordine: 5 },
  { nome: 'Olivo', codice: 'olivo', descrizione: 'Oliveto', ordine: 6 },
  { nome: 'Agrumeto', codice: 'agrumeto', descrizione: 'Agrumi', ordine: 7 },
  { nome: 'Bosco', codice: 'bosco', descrizione: 'Area boschiva', ordine: 8 }
];

/** Colture minime per scenario viticola (nomi allineati a terreni-controller.js) */
const COLTURE_VITICOLA = [
  { nome: 'Vite', codiceCategoria: 'vite' },
  { nome: 'Vite da Tavola', codiceCategoria: 'vite' },
  { nome: 'Vite da Vino', codiceCategoria: 'vite' },
  { nome: 'Sangiovese', codiceCategoria: 'vite' },
  { nome: 'Merlot', codiceCategoria: 'vite' },
  { nome: 'Glera', codiceCategoria: 'vite' }
];

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {string} userId
 * @param {{ podereNome?: string }} [options]
 * @returns {Promise<{ categorieMap: Record<string, string>, podereNome: string }>}
 */
export async function seedTenantReferenceData(db, tenantId, userId, options = {}) {
  const categorieMap = {};

  for (const cat of CATEGORIE_COLTURE) {
    const id = await addTenantDocument(db, tenantId, 'categorie', {
      nome: cat.nome,
      codice: cat.codice,
      descrizione: cat.descrizione,
      applicabileA: 'colture',
      predefinita: true,
      ordine: cat.ordine,
      attiva: true,
      creatoDa: userId
    });
    categorieMap[cat.codice] = id;
  }

  for (const coltura of COLTURE_VITICOLA) {
    const categoriaId = categorieMap[coltura.codiceCategoria];
    if (!categoriaId) continue;
    await addTenantDocument(db, tenantId, 'colture', {
      nome: coltura.nome,
      categoriaId,
      descrizione: null,
      predefinito: true,
      creatoDa: userId
    });
  }

  const podereNome = options.podereNome || 'Podere principale';
  await addTenantDocument(db, tenantId, 'poderi', {
    nome: podereNome,
    indirizzo: '',
    note: 'Podere simulato GFV Farm Simulator',
    coordinate: { lat: 45.4, lng: 11.8 },
    creatoDa: userId
  });

  return { categorieMap, podereNome };
}
