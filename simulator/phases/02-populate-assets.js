/**
 * Fase 2 — Popola terreni, macchine, vigneti, prodotti.
 * @module simulator/phases/02-populate-assets
 */

import {
  generaAttrezzi,
  generaFlotta,
  generaProdotti,
  generaTerreni,
  generaTrattori,
  generaVigneti
} from '../generators/nomi-italiani.js';
import { getEmulatorDb } from '../lib/emulator-context.js';
import { addTenantDocument } from '../lib/firestore-write.js';
import { seedTenantReferenceData } from '../lib/seed-reference-data.js';
import { seedAppCatalog } from '../lib/seed-app-catalog.js';
import { ensureTenantEconomia } from '../lib/sim-economia-vigneto.js';
import {
  enrichAttrezzoPayload,
  enrichFlottaPayload,
  enrichTrattorePayload
} from '../lib/seed-parco-macchine-details.js';
import { requireSimTenantId, requireSimUserId, getSimProfile } from '../lib/sim-context.js';

const CATEGORIE_PREDEFINITE = [
  { nome: 'Lavorazione del Terreno', codice: 'lavorazione_terreno', predefinita: true },
  { nome: 'Trattamenti', codice: 'trattamenti', predefinita: true },
  { nome: 'Potatura Meccanica', codice: 'potatura_meccanica', predefinita: true }
];

async function seedCategorieAttrezzi(db, tenantId, userId) {
  const map = {};
  for (const cat of CATEGORIE_PREDEFINITE) {
    const id = await addTenantDocument(db, tenantId, 'categorieAttrezzi', {
      nome: cat.nome,
      codice: cat.codice,
      predefinita: cat.predefinita,
      attiva: true,
      creatoDa: userId
    });
    map[cat.codice] = id;
  }
  return map;
}

/**
 * @returns {Promise<{ terreni, trattori, attrezzi, vigneti, prodotti, counts }>}
 */
export async function runPopulateAssets() {
  const tenantId = requireSimTenantId();
  const userId = requireSimUserId();
  const profile = getSimProfile();
  const template = profile?.template;
  const q = template?.quantities || {};
  const seed = Date.now();
  const db = getEmulatorDb();

  const categorieMap = await seedCategorieAttrezzi(db, tenantId, userId);

  const catalogStats = await seedAppCatalog(db, tenantId, userId);

  const { podereNome } = await seedTenantReferenceData(db, tenantId, userId, {
    podereNome: profile?.aziendaNome || 'Podere principale'
  });

  const terreniData = generaTerreni(q.terreni || 4, seed, { podereNome });
  const terreni = [];
  for (const t of terreniData) {
    const id = await addTenantDocument(db, tenantId, 'terreni', {
      ...t,
      clienteId: null
    });
    terreni.push({ id, ...t });
  }

  const trattoriData = generaTrattori(q.trattori || 1, seed);
  const trattori = [];
  for (let i = 0; i < trattoriData.length; i++) {
    const base = trattoriData[i];
    const m = enrichTrattorePayload(
      { ...base, oreAttuali: base.oreIniziali, creatoDa: userId },
      i
    );
    const id = await addTenantDocument(db, tenantId, 'macchine', m);
    trattori.push({ id, nome: m.nome });
  }

  const attrezziData = generaAttrezzi(q.attrezzi || 3, seed);
  const attrezzi = [];
  for (let i = 0; i < attrezziData.length; i++) {
    const a = enrichAttrezzoPayload(attrezziData[i], i);
    const categoriaId = categorieMap[a.codiceCategoria] || categorieMap.lavorazione_terreno;
    const id = await addTenantDocument(db, tenantId, 'macchine', {
      nome: a.nome,
      tipoMacchina: 'attrezzo',
      marca: a.marca,
      cavalliMinimiRichiesti: a.cavalliMinimiRichiesti,
      categoriaId,
      categoriaFunzione: a.codiceCategoria,
      stato: a.stato,
      prossimaManutenzione: a.prossimaManutenzione,
      creatoDa: userId
    });
    attrezzi.push({ id, nome: a.nome });
  }

  const flottaData = generaFlotta(q.flotta || 2, seed);
  const flotta = [];
  for (let i = 0; i < flottaData.length; i++) {
    const m = enrichFlottaPayload({ ...flottaData[i], creatoDa: userId }, i);
    const id = await addTenantDocument(db, tenantId, 'macchine', m);
    flotta.push({ id, nome: m.nome, tipoMacchina: m.tipoMacchina });
  }

  const vignetiData = generaVigneti(terreni, seed);
  const vigneti = [];
  for (const v of vignetiData.slice(0, q.vigneti || terreni.length)) {
    const id = await addTenantDocument(db, tenantId, 'vigneti', {
      ...v,
      speseManodoperaAnno: 0,
      speseTrattamentiAnno: 0,
      spesePotaturaAnno: 0,
      speseRaccoltaAnno: 0,
      speseMacchineAnno: 0,
      speseAltroAnno: 0,
      speseVendemmiaAnno: 0,
      speseCantinaAnno: 0,
      speseProdottiAnno: 0
    });
    vigneti.push({ id, varieta: v.varieta, terrenoId: v.terrenoId });
  }

  const prodottiData = generaProdotti(q.prodotti || 5, seed);
  const prodotti = [];
  for (const p of prodottiData) {
    const id = await addTenantDocument(db, tenantId, 'prodotti', {
      ...p,
      giacenza: 12,
      creatoDa: userId
    });
    prodotti.push({ id, nome: p.nome });
  }

  await ensureTenantEconomia(db, tenantId);

  return {
    terreni,
    trattori,
    attrezzi,
    flotta,
    vigneti,
    prodotti,
    counts: {
      terreni: terreni.length,
      trattori: trattori.length,
      attrezzi: attrezzi.length,
      flotta: flotta.length,
      vigneti: vigneti.length,
      prodotti: prodotti.length
    }
  };
}
