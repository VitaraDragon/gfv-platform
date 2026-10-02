/**
 * Carburante sul registro movimenti (Fase 2).
 * Carico cisterna = entrata. Pieno mezzo = uscita con macchinaId.
 * Le quote litri per lavoro non passano da qui (niente secondo scarico).
 * @module modules/magazzino/lib/carburante-movimento
 */

import { normalizeCategoriaProdottoId } from '../config/categorie-prodotto.js';

export const ORIGINE_CARICO_CISTERNA = 'carico_cisterna';
export const ORIGINE_PIENO = 'pieno';

const ORIGINI = [ORIGINE_CARICO_CISTERNA, ORIGINE_PIENO];

/**
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function normalizeOrigineCarburante(raw) {
  if (raw == null || raw === '') return null;
  var s = String(raw).toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (s === 'carico' || s === 'cisterna' || s === 'carico_cisterna') return ORIGINE_CARICO_CISTERNA;
  if (s === 'pieno' || s === 'pieno_mezzo') return ORIGINE_PIENO;
  return s;
}

/**
 * @param {string|null|undefined} origine
 * @returns {boolean}
 */
export function isOrigineCarburante(origine) {
  return ORIGINI.indexOf(origine) >= 0;
}

/**
 * Pieno: uscita + mezzo. Carico cisterna: entrata. Senza origine, nessuna regola extra.
 * @param {{ tipo?: string, origineCarburante?: string|null, macchinaId?: string|null }} data
 * @returns {{ valid: boolean, errors: string[], origineCarburante: string|null }}
 */
export function validateMovimentoCarburante(data) {
  var errors = [];
  var origine = normalizeOrigineCarburante(data && data.origineCarburante);
  var tipo = data && data.tipo ? String(data.tipo) : '';
  var macchinaId = data && data.macchinaId != null ? String(data.macchinaId).trim() : '';

  if (origine && !isOrigineCarburante(origine)) {
    errors.push('Origine carburante non valida');
    return { valid: false, errors: errors, origineCarburante: null };
  }

  if (origine === ORIGINE_PIENO) {
    if (tipo !== 'uscita') errors.push('Il pieno è un\'uscita di magazzino');
    if (!macchinaId) errors.push('Mezzo obbligatorio per il pieno');
  }

  if (origine === ORIGINE_CARICO_CISTERNA && tipo && tipo !== 'entrata') {
    errors.push('Il carico cisterna è un\'entrata di magazzino');
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    origineCarburante: origine
  };
}

/**
 * @param {string|URLSearchParams|null|undefined} search
 * @returns {{
 *   categoria: string|null,
 *   tipo: string|null,
 *   pieno: boolean,
 *   origineFiltro: string|null,
 *   origineForm: string|null,
 *   apriForm: boolean
 * }}
 */
export function parseCarburanteMovimentoQuery(search) {
  var params;
  if (search instanceof URLSearchParams) params = search;
  else params = new URLSearchParams(String(search || '').replace(/^\?/, ''));

  var categoriaRaw = params.get('categoria');
  var categoriaNorm = categoriaRaw ? normalizeCategoriaProdottoId(categoriaRaw) : null;
  var categoria = categoriaNorm === 'carburante' ? 'carburante' : null;

  var tipoRaw = params.get('tipo');
  var tipo = tipoRaw === 'entrata' || tipoRaw === 'uscita' ? tipoRaw : null;

  var pienoRaw = params.get('pieno');
  var pieno = pienoRaw === '1' || pienoRaw === 'true' || pienoRaw === 'yes';

  var origineParam = normalizeOrigineCarburante(params.get('origine') || params.get('origineCarburante'));
  var origineFiltro = isOrigineCarburante(origineParam) ? origineParam : null;

  var origineForm = null;
  if (pieno || origineFiltro === ORIGINE_PIENO) origineForm = ORIGINE_PIENO;
  else if (categoria === 'carburante' && tipo === 'entrata') origineForm = ORIGINE_CARICO_CISTERNA;
  else if (origineFiltro === ORIGINE_CARICO_CISTERNA) origineForm = ORIGINE_CARICO_CISTERNA;

  var apriForm = !!(categoria === 'carburante' && (origineForm === ORIGINE_CARICO_CISTERNA || origineForm === ORIGINE_PIENO) && (tipo === 'entrata' || pieno || tipo === 'uscita' && origineForm === ORIGINE_PIENO));
  if (origineForm === ORIGINE_PIENO) apriForm = categoria === 'carburante' && (pieno || tipo === 'uscita');
  if (origineForm === ORIGINE_CARICO_CISTERNA) apriForm = categoria === 'carburante' && tipo === 'entrata';

  return {
    categoria: categoria,
    tipo: tipo,
    pieno: pieno || origineForm === ORIGINE_PIENO,
    origineFiltro: origineFiltro,
    origineForm: origineForm,
    apriForm: !!apriForm
  };
}

/**
 * Query da appendere all'URL movimenti quando Tony apre carico o pieno.
 * @param {Record<string, string>|null|undefined} draft
 * @returns {string}
 */
export function carburanteMovimentoSearchFromDraft(draft) {
  if (!draft) return '';
  var origine = normalizeOrigineCarburante(draft['mov-origine-carburante']);
  if (origine === ORIGINE_PIENO) return 'categoria=carburante&tipo=uscita&pieno=1';
  if (origine === ORIGINE_CARICO_CISTERNA) return 'categoria=carburante&tipo=entrata';
  return '';
}

/**
 * @param {{ categoria?: string }|null|undefined} prodotto
 * @returns {boolean}
 */
export function isProdottoCarburante(prodotto) {
  return normalizeCategoriaProdottoId(prodotto && prodotto.categoria) === 'carburante';
}

/**
 * @param {{ tipo?: string, prodottoId?: string, origineCarburante?: string|null }} movimento
 * @param {{ categoria?: string }|null|undefined} prodotto
 * @param {{ categoria?: string|null, tipo?: string|null, prodottoId?: string|null, origineCarburante?: string|null }} filtro
 * @returns {boolean}
 */
export function movimentoMatchesCarburanteFiltro(movimento, prodotto, filtro) {
  filtro = filtro || {};
  if (filtro.categoria === 'carburante' && !isProdottoCarburante(prodotto)) return false;
  if (filtro.tipo && (!movimento || movimento.tipo !== filtro.tipo)) return false;
  if (filtro.prodottoId && (!movimento || movimento.prodottoId !== filtro.prodottoId)) return false;
  if (filtro.origineCarburante && (!movimento || movimento.origineCarburante !== filtro.origineCarburante)) return false;
  return true;
}

/**
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function normalizeMezzoName(raw) {
  var s = String(raw || '').toLowerCase();
  try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* ignore */ }
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/[^a-z0-9]+/g, ' ').trim();
  return s;
}

/**
 * Stessa idea della disambiguazione trattore sui lavori: un solo match, altrimenti non scegliere.
 * @param {Array<{ id?: string, nome?: string, text?: string }>|null|undefined} list
 * @param {string} hint
 * @returns {{ status: 'empty'|'none'|'unique'|'ambiguous', match: object|null, matches: object[] }}
 */
export function matchMezzoByName(list, hint) {
  var h = normalizeMezzoName(hint);
  var items = (list || []).filter(function (m) { return m && (m.nome || m.text || m.id); });
  if (!h) return { status: 'empty', match: null, matches: [] };

  function nome(m) {
    return normalizeMezzoName(m.nome || m.text || '');
  }

  var exact = items.filter(function (m) { return nome(m) === h; });
  if (exact.length === 1) return { status: 'unique', match: exact[0], matches: exact };
  if (exact.length > 1) return { status: 'ambiguous', match: null, matches: exact };

  var contains = items.filter(function (m) {
    var n = nome(m);
    if (!n) return false;
    if (n.indexOf(h) >= 0) return true;
    var tokens = n.split(' ').filter(function (w) { return w.length >= 2; });
    return tokens.some(function (w) { return w === h; });
  });

  if (contains.length === 1) return { status: 'unique', match: contains[0], matches: contains };
  if (contains.length > 1) return { status: 'ambiguous', match: null, matches: contains };
  return { status: 'none', match: null, matches: [] };
}

/** Destinazione del pulsante in testata sulle sottopagine Magazzino. */
export var DASHBOARD_MAGAZZINO_HREF = 'magazzino-home-standalone.html';
export var DASHBOARD_MAGAZZINO_LABEL = '← Dashboard';
export var DASHBOARD_CARBURANTE_HREF = 'carburante-home-standalone.html';
export var DASHBOARD_CARBURANTE_LABEL = '← Dashboard carburante';

/**
 * Sottosezione aperta con ?categoria=carburante: si torna all'hub Carburante.
 * @param {string|null|undefined} categoria
 * @returns {{ href: string, label: string }}
 */
export function dashboardLinkForCategoria(categoria) {
  if (categoria === 'carburante') {
    return { href: DASHBOARD_CARBURANTE_HREF, label: DASHBOARD_CARBURANTE_LABEL };
  }
  return { href: DASHBOARD_MAGAZZINO_HREF, label: DASHBOARD_MAGAZZINO_LABEL };
}
