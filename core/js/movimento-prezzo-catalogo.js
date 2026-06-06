/**
 * Prezzo movimento entrata — default da anagrafica prodotto (editabile, opzionale al save).
 * @module core/js/movimento-prezzo-catalogo
 */

/**
 * @param {*} value
 * @returns {number|null}
 */
export function parsePrezzoUnitarioCatalogo(value) {
  if (value === undefined || value === null || value === '') return null;
  var p = parseFloat(value);
  return Number.isFinite(p) && p >= 0 ? p : null;
}

/**
 * @param {Array|Array<Array>} catalogLists
 * @returns {Array<Array>}
 */
function normalizeCatalogLists(catalogLists) {
  if (!catalogLists) return [];
  if (Array.isArray(catalogLists) && catalogLists.length && Array.isArray(catalogLists[0])) {
    return catalogLists;
  }
  if (Array.isArray(catalogLists)) return [catalogLists];
  return [catalogLists];
}

/**
 * @param {string} prodottoId
 * @param {Array<Array<{ id?: string, prezzoUnitario?: number|null }>>|Array<{ id?: string, prezzoUnitario?: number|null }>} catalogLists
 * @returns {{ id?: string, prezzoUnitario?: number|null }|null}
 */
export function findProdottoInCatalog(prodottoId, catalogLists) {
  if (!prodottoId) return null;
  var id = String(prodottoId).trim();
  if (!id) return null;
  var lists = normalizeCatalogLists(catalogLists);
  for (var i = 0; i < lists.length; i++) {
    var list = lists[i];
    if (!Array.isArray(list)) continue;
    var hit = list.find(function (p) { return p && String(p.id) === id; });
    if (hit) return hit;
  }
  return null;
}

/**
 * @param {string} prodottoId
 * @returns {number|null}
 */
export function getPrezzoFromMovProdottoSelectDom(prodottoId) {
  if (typeof document === 'undefined' || !prodottoId) return null;
  var sel = document.getElementById('mov-prodotto');
  if (!sel || !sel.options) return null;
  var id = String(prodottoId).trim();
  for (var oi = 0; oi < sel.options.length; oi++) {
    var opt = sel.options[oi];
    if (opt.value !== id) continue;
    if (opt.dataset && opt.dataset.prezzoUnitario != null && opt.dataset.prezzoUnitario !== '') {
      return parsePrezzoUnitarioCatalogo(opt.dataset.prezzoUnitario);
    }
    break;
  }
  return null;
}

/**
 * @param {string} prodottoId
 * @param {Array<Array<{ id?: string, prezzoUnitario?: number|null }>>|Array<{ id?: string, prezzoUnitario?: number|null }>} catalogLists
 * @returns {number|null}
 */
export function getPrezzoUnitarioFromCatalog(prodottoId, catalogLists) {
  if (!prodottoId) return null;
  var id = String(prodottoId).trim();
  if (!id) return null;
  var lists = normalizeCatalogLists(catalogLists);
  for (var i = 0; i < lists.length; i++) {
    var list = lists[i];
    if (!Array.isArray(list)) continue;
    var hit = list.find(function (p) { return p && String(p.id) === id; });
    if (hit) {
      var pr = parsePrezzoUnitarioCatalogo(hit.prezzoUnitario);
      if (pr != null) return pr;
    }
  }
  return getPrezzoFromMovProdottoSelectDom(id);
}

/**
 * @param {string} tipo
 * @returns {boolean}
 */
export function isMovimentoEntrataTipo(tipo) {
  return String(tipo || '').trim().toLowerCase() === 'entrata';
}

/**
 * @param {Record<string, unknown>|null|undefined} formData
 * @returns {boolean}
 */
export function movimentoFormDataHasPrezzo(formData) {
  if (!formData || formData['mov-prezzo'] == null) return false;
  return String(formData['mov-prezzo']).trim() !== '';
}

/**
 * Aggiunge mov-prezzo da anagrafica se entrata, prodotto risolto e prezzo non già in formData.
 * @param {Record<string, string|number>|null|undefined} formData
 * @param {{ context?: { azienda?: { prodotti?: Array<{ id?: string, prezzoUnitario?: number|null }> } }, pageProdotti?: Array<{ id?: string, prezzoUnitario?: number|null }> }} [options]
 * @returns {Record<string, string|number>}
 */
export function enrichMovimentoFormDataFromCatalog(formData, options) {
  options = options || {};
  if (!formData || typeof formData !== 'object') return {};
  /** @type {Record<string, string|number>} */
  var out = Object.assign({}, formData);
  if (!isMovimentoEntrataTipo(out['mov-tipo'])) return out;
  if (!out['mov-prodotto']) return out;
  if (movimentoFormDataHasPrezzo(out)) return out;

  var lists = [];
  if (options.context && options.context.azienda && Array.isArray(options.context.azienda.prodotti)) {
    lists.push(options.context.azienda.prodotti);
  }
  if (Array.isArray(options.pageProdotti)) lists.push(options.pageProdotti);

  var prezzo = getPrezzoUnitarioFromCatalog(String(out['mov-prodotto']), lists);
  if (prezzo == null && typeof document !== 'undefined') {
    prezzo = getPrezzoFromMovProdottoSelectDom(String(out['mov-prodotto']));
  }
  if (prezzo != null) out['mov-prezzo'] = String(prezzo);
  return out;
}

/**
 * Imposta mov-prezzo nel DOM da elenco prodotti pagina (form manuale).
 * @param {Array<{ id?: string, prezzoUnitario?: number|null }>} catalogProdotti
 * @param {{ onlyIfEmpty?: boolean }} [options]
 * @returns {boolean}
 */
export function suggestMovPrezzoInDom(catalogProdotti, options) {
  options = options || {};
  if (typeof document === 'undefined') return false;
  var tipoEl = document.getElementById('mov-tipo');
  var prodEl = document.getElementById('mov-prodotto');
  var prezzoEl = document.getElementById('mov-prezzo');
  if (!tipoEl || !prodEl || !prezzoEl) return false;
  if (!isMovimentoEntrataTipo(tipoEl.value)) return false;
  if (options.onlyIfEmpty !== false && String(prezzoEl.value || '').trim() !== '') return false;
  var prezzo = getPrezzoUnitarioFromCatalog(prodEl.value, [catalogProdotti]);
  if (prezzo == null) return false;
  prezzoEl.value = String(prezzo);
  try {
    prezzoEl.dispatchEvent(new Event('input', { bubbles: true }));
    prezzoEl.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (_) { /* ignore */ }
  return true;
}

if (typeof window !== 'undefined') {
  window.MovimentoPrezzoCatalogo = {
    parsePrezzoUnitarioCatalogo: parsePrezzoUnitarioCatalogo,
    findProdottoInCatalog: findProdottoInCatalog,
    getPrezzoFromMovProdottoSelectDom: getPrezzoFromMovProdottoSelectDom,
    getPrezzoUnitarioFromCatalog: getPrezzoUnitarioFromCatalog,
    enrichMovimentoFormDataFromCatalog: enrichMovimentoFormDataFromCatalog,
    suggestMovPrezzoInDom: suggestMovPrezzoInDom,
    isMovimentoEntrataTipo: isMovimentoEntrataTipo,
  };
}
