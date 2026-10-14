/**
 * Corrispondenza unica fra i valori GFV e le colture della scheda pubblica.
 * Se il valore manca o non è in questa mappa, non si propone nulla.
 * @module core/config/registro-trattamenti-specie
 */

/**
 * Destinazione uva del vigneto → coltura della banca SIAN.
 * Letto il 13 ottobre 2026 su SIVANTO PRIME, pagina 2: VITE, VITE DA VINO, VITE DA TAVOLA sono tre righe.
 * `misto` e la riga generica VITE non si indovinano. UVA SPINA non è vite.
 */
export const MAPPA_DESTINAZIONE_VIGNETO = {
  vino: 'vite da vino',
  vendita_uva: 'vite da tavola',
  misto: null
};

/**
 * Specie frutteto (anagrafica) → coltura della scheda.
 * `Altro` non si mappa.
 */
export const MAPPA_SPECIE_FRUTTETO = {
  Melo: 'melo',
  Pesco: 'pesco',
  Pero: 'pero',
  Albicocco: 'albicocco',
  Ciliegio: 'ciliegio',
  Susino: 'susino',
  Kiwi: 'actinidia',
  Fico: 'fico',
  Nocciolo: 'nocciolo',
  Castagno: 'castagno',
  Mandorlo: 'mandorlo',
  Arancio: 'arancio',
  Limone: 'limone',
  Mandarino: 'mandarino',
  Clementine: 'clementine',
  Kaki: 'kaki',
  Noce: 'noce',
  Pistacchio: 'pistacchio',
  Altro: null
};

/**
 * Nome coltura seminativo (catalogo) → coltura della scheda.
 * Il grano in scheda è il frumento.
 */
export const MAPPA_COLTURA_SEMINATIVO = {
  Grano: 'frumento',
  Mais: 'mais',
  Orzo: 'orzo',
  Favino: 'favino',
  Girasole: 'girasole',
  Soia: 'soia',
  Colza: 'colza',
  Avena: 'avena',
  Segale: 'segale',
  Fava: 'fava',
  Lenticchia: 'lenticchia',
  Cece: 'cece',
  Lupino: 'lupino',
  Cicerchia: 'cicerchia',
  Riso: 'riso',
  'Grano Saraceno': 'grano saraceno',
  Amaranto: 'amaranto',
  Quinoa: 'quinoa',
  Canapa: 'canapa',
  Lino: 'lino',
  Carthamo: 'carthamo',
  'Erba Medica': 'erba medica',
  Trifoglio: 'trifoglio',
  Veccia: 'veccia',
  Lupinella: 'lupinella',
  Sulla: 'sulla',
  Sorgo: 'sorgo',
  Miglio: 'miglio',
  Panico: 'panico'
};

/** Altri modi in cui la stessa coltura compare sulla scheda. */
export const ALIAS_COLTURA_SCHEDA = {
  frumento: ['frumento', 'grano', 'grano tenero', 'grano duro'],
  'vite da vino': ['vite da vino'],
  'vite da tavola': ['vite da tavola'],
  actinidia: ['actinidia', 'kiwi'],
  clementine: ['clementine', 'clementino'],
  'erba medica': ['erba medica', 'medica']
};

function daMappa(mappa, valore) {
  const raw = String(valore || '').trim();
  if (!raw) return null;
  if (Object.prototype.hasOwnProperty.call(mappa, raw)) {
    return mappa[raw] || null;
  }
  const key = Object.keys(mappa).find((k) => k.toLowerCase() === raw.toLowerCase());
  if (!key) return null;
  return mappa[key] || null;
}

export function colturaSchedaVigneto(destinazioneUva) {
  return daMappa(MAPPA_DESTINAZIONE_VIGNETO, destinazioneUva);
}

export function colturaSchedaFrutteto(specie) {
  return daMappa(MAPPA_SPECIE_FRUTTETO, specie);
}

export function colturaSchedaSeminativo(colturaNome) {
  return daMappa(MAPPA_COLTURA_SEMINATIVO, colturaNome);
}

/**
 * @param {{ modulo?: string, destinazioneUva?: string, specie?: string, colturaNome?: string }} input
 * @returns {string|null}
 */
export function colturaSchedaRegistro(input = {}) {
  const modulo = String(input.modulo || '').trim().toLowerCase();
  if (modulo === 'vigneto') return colturaSchedaVigneto(input.destinazioneUva);
  if (modulo === 'frutteto') return colturaSchedaFrutteto(input.specie);
  if (modulo === 'seminativo') return colturaSchedaSeminativo(input.colturaNome);
  return null;
}

export function aliasColturaScheda(coltura) {
  const nome = String(coltura || '').trim().toLowerCase();
  if (!nome) return [];
  const extra = ALIAS_COLTURA_SCHEDA[nome] || [];
  const set = new Set([nome, ...extra.map((v) => String(v).trim().toLowerCase())]);
  return Array.from(set).filter(Boolean);
}

export function slugColturaScheda(coltura) {
  return String(coltura || '').trim().toLowerCase().replace(/\s+/g, '_');
}
