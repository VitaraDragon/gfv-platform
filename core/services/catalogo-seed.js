/**
 * Supporto seed catalogo: id documento deterministici e lock in memoria per tenant.
 * @module core/services/catalogo-seed
 */

/**
 * Slug per id documento: minuscolo, senza accenti, solo [a-z0-9_].
 * @param {unknown} value
 * @returns {string}
 */
export function slugCatalogo(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Id deterministico di una voce seed (stesso valore da ogni pagina/tab).
 * @param {unknown} codiceONome
 * @returns {string} es. `seed_vite`, `seed_fico_d_india`
 */
export function idSeed(codiceONome) {
  const slug = slugCatalogo(codiceONome);
  if (!slug) throw new Error('Codice seed vuoto');
  return `seed_${slug}`;
}

/**
 * Dati da scrivere con setDocument(merge): senza id e senza timestamp del modello
 * (createdAt lo aggiunge setDocument solo se il documento non esiste ancora).
 * @param {object} dati
 * @returns {object}
 */
export function datiSeed(dati) {
  const out = { ...(dati || {}) };
  delete out.id;
  delete out.createdAt;
  delete out.updatedAt;
  return out;
}

const inCorso = new Map();

/**
 * Esegue `fn` una sola volta per (nome, tenant) finché è in corso: le chiamate concorrenti
 * ricevono la stessa promise. Terminata (bene o male), la chiamata successiva riparte.
 * @template T
 * @param {string} nome
 * @param {string} tenantId
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function conLockSeed(nome, tenantId, fn) {
  const key = `${nome}:${tenantId}`;
  const esistente = inCorso.get(key);
  if (esistente) return esistente;
  const p = Promise.resolve()
    .then(fn)
    .finally(() => {
      if (inCorso.get(key) === p) inCorso.delete(key);
    });
  inCorso.set(key, p);
  return p;
}

/** Solo test: svuota i lock. */
export function _resetLockSeed() {
  inCorso.clear();
}
