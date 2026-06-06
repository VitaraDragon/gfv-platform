/**
 * Obbligatorietà dosaggio / carenza anagrafica prodotto (per categoria).
 * @module core/js/prodotto-form-required
 */

/** @type {string[]} */
export const PRODOTTO_CATEGORIE_DOSAGGIO_OBBLIGATORIO = ['fitofarmaci', 'fertilizzanti'];

/** @type {string[]} */
export const PRODOTTO_CATEGORIE_CARENZA_OBBLIGATORIA = ['fitofarmaci'];

/**
 * @param {string|null|undefined} categoria
 * @returns {boolean}
 */
export function prodottoCategoriaRichiedeDosaggio(categoria) {
  var c = String(categoria || '').trim().toLowerCase();
  return PRODOTTO_CATEGORIE_DOSAGGIO_OBBLIGATORIO.indexOf(c) >= 0;
}

/**
 * @param {string|null|undefined} categoria
 * @returns {boolean}
 */
export function prodottoCategoriaRichiedeGiorniCarenza(categoria) {
  var c = String(categoria || '').trim().toLowerCase();
  return PRODOTTO_CATEGORIE_CARENZA_OBBLIGATORIA.indexOf(c) >= 0;
}

/**
 * @param {string|null|undefined} categoria
 * @returns {string[]}
 */
export function getProdottoDosaggioCarenzaRequiredFieldIds(categoria) {
  var ids = [];
  if (prodottoCategoriaRichiedeDosaggio(categoria)) {
    ids.push('prodotto-dosaggio-min', 'prodotto-dosaggio-max');
  }
  if (prodottoCategoriaRichiedeGiorniCarenza(categoria)) {
    ids.push('prodotto-giorni-carenza');
  }
  return ids;
}

/**
 * @param {Record<string, string>|null|undefined} draft
 * @returns {string[]}
 */
export function getProdottoDosaggioCarenzaMissingFromDraft(draft) {
  if (!draft) return ['prodotto-categoria'];
  var cat = draft['prodotto-categoria'];
  var missing = [];
  getProdottoDosaggioCarenzaRequiredFieldIds(cat).forEach(function (id) {
    var v = draft[id];
    if (v == null || String(v).trim() === '') missing.push(id);
  });
  return missing;
}

/**
 * Aggiorna attributo HTML required + asterisco label per dosaggio/carenza.
 * @returns {string|null} categoria corrente
 */
export function syncProdottoDosaggioCarenzaRequiredDom() {
  if (typeof document === 'undefined') return null;
  var catEl = document.getElementById('prodotto-categoria');
  var cat = catEl ? String(catEl.value || '').trim().toLowerCase() : '';
  var needDos = prodottoCategoriaRichiedeDosaggio(cat);
  var needCar = prodottoCategoriaRichiedeGiorniCarenza(cat);

  /** @param {string} inputId @param {string} labelFor @param {boolean} req */
  function apply(inputId, labelFor, req) {
    var inp = document.getElementById(inputId);
    var lbl = document.querySelector('label[for="' + labelFor + '"]');
    if (inp) {
      if (req) inp.setAttribute('required', 'required');
      else inp.removeAttribute('required');
    }
    if (lbl) {
      var base = lbl.textContent.replace(/\s*\*$/, '').trim();
      lbl.textContent = req ? base + ' *' : base;
    }
  }

  apply('prodotto-dosaggio-min', 'prodotto-dosaggio-min', needDos);
  apply('prodotto-dosaggio-max', 'prodotto-dosaggio-max', needDos);
  apply('prodotto-giorni-carenza', 'prodotto-giorni-carenza', needCar);

  var rowCarenza = document.getElementById('prodotto-giorni-carenza');
  if (rowCarenza && rowCarenza.closest('.form-row')) {
    rowCarenza.closest('.form-row').style.display = needCar ? '' : 'none';
  }

  return cat || null;
}

if (typeof window !== 'undefined') {
  window.__tonySyncProdottoDosaggioCarenzaRequired = syncProdottoDosaggioCarenzaRequiredDom;
}
