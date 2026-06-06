/**
 * Creazione prodotto magazzino — client-side (no CF).
 * @module core/js/tony-prodotto-create-local
 */

import { isTonySaveConfirmText, isTonySaveDenyText } from './tony-form-save-local.js';
import {
  getProdottoDosaggioCarenzaMissingFromDraft,
} from './prodotto-form-required.js';

/** @type {Record<string, string>} */
var CATEGORIA_STEMS = {
  fitofarmaci: 'fitofarmaci',
  fitofarmaco: 'fitofarmaci',
  fitosanitari: 'fitofarmaci',
  fertilizzanti: 'fertilizzanti',
  fertilizzante: 'fertilizzanti',
  concime: 'fertilizzanti',
  concimi: 'fertilizzanti',
  sementi: 'sementi',
  seme: 'sementi',
  ricambi: 'ricambi',
  ricambio: 'ricambi',
  materiale_impianto: 'materiale_impianto',
  'materiale impianto': 'materiale_impianto',
  altro: 'altro',
};

/** @type {Record<string, string>} */
var UNITA_STEMS = {
  litri: 'L',
  litro: 'L',
  l: 'L',
  kg: 'kg',
  chilo: 'kg',
  chilogrammi: 'kg',
  pezzi: 'pezzi',
  pezzo: 'pezzi',
  confezione: 'confezione',
  confezioni: 'confezione',
  sacchi: 'sacchi',
  sacco: 'sacchi',
  m2: 'm2',
  'm²': 'm2',
  mq: 'm2',
  m: 'm',
  altro: 'altro',
};

/**
 * @returns {boolean}
 */
export function isOnProdottiPage() {
  if (typeof window === 'undefined' || !window.location) return false;
  return String(window.location.pathname || '').toLowerCase().indexOf('prodotti') >= 0;
}

/**
 * @returns {boolean}
 */
export function isProdottoModalOpen() {
  if (typeof document === 'undefined') return false;
  var modal = document.getElementById('prodotto-modal');
  return !!(modal && modal.classList.contains('active'));
}

/**
 * @param {string} text
 * @returns {string|null}
 */
export function normalizeProdottoCategoriaFromText(text) {
  var t = String(text || '').toLowerCase();
  var keys = Object.keys(CATEGORIA_STEMS).sort(function (a, b) { return b.length - a.length; });
  for (var i = 0; i < keys.length; i++) {
    var stem = keys[i];
    var re = new RegExp('\\b' + stem.replace(/\s+/g, '\\s+') + '\\b', 'i');
    if (re.test(t)) return CATEGORIA_STEMS[stem];
  }
  return null;
}

/**
 * @param {string} text
 * @returns {string|null}
 */
export function normalizeProdottoUnitaFromText(text) {
  var t = String(text || '').toLowerCase();
  var keys = Object.keys(UNITA_STEMS).sort(function (a, b) { return b.length - a.length; });
  for (var i = 0; i < keys.length; i++) {
    var stem = keys[i];
    var re = new RegExp('\\b' + stem.replace(/\s+/g, '\\s+') + '\\b', 'i');
    if (re.test(t)) return UNITA_STEMS[stem];
  }
  return null;
}

/**
 * @param {string} text
 * @returns {string|null}
 */
export function extractProdottoNomeFromText(text) {
  var t = String(text || '').trim();
  if (!t) return null;
  var s = t.replace(/^(?:crea|nuovo|registra|aggiungi|fammi)\s+(?:un[a]?\s+)?prodotto\s+/i, '');
  s = s.replace(/^(?:prodotto\s+)/i, '');

  var catKeys = Object.keys(CATEGORIA_STEMS).sort(function (a, b) { return b.length - a.length; });
  var earliest = -1;
  catKeys.forEach(function (stem) {
    var re = new RegExp('\\b' + stem.replace(/\s+/g, '\\s+') + '\\b', 'i');
    var m = s.match(re);
    if (m && m.index != null && (earliest < 0 || m.index < earliest)) earliest = m.index;
  });
  if (earliest > 0) {
    var name = s.slice(0, earliest).trim();
    if (name) return name;
  }

  s = s.replace(/\b(?:scorta(?:\s+minima)?|prezzo|carenza|dosaggio)\b.*$/i, '');
  s = s.replace(/\b(?:litri?|kg|pezzi?|confezioni?|sacchi?|m2|m²)\b.*$/i, '');
  s = s.replace(/\b\d+(?:[.,]\d+)?(?:\s*€)?.*$/i, '');
  var m2 = s.match(/^([a-zA-ZÀ-ÿ0-9][\w\s\-']+)/);
  return m2 ? m2[1].trim() : null;
}

/**
 * @param {string} text
 * @returns {Record<string, string>|null}
 */
export function parseProdottoCreationFromText(text) {
  var t = String(text || '').trim();
  if (!t) return null;
  /** @type {Record<string, string>} */
  var formData = {};

  var cat = normalizeProdottoCategoriaFromText(t);
  if (cat) formData['prodotto-categoria'] = cat;

  var unita = normalizeProdottoUnitaFromText(t);
  if (unita) formData['prodotto-unita'] = unita;

  var nome = extractProdottoNomeFromText(t);
  if (nome) formData['prodotto-nome'] = nome;

  var scortaM = t.match(/\bscorta(?:\s+minima)?\s+(\d+(?:[.,]\d+)?)/i);
  if (scortaM) formData['prodotto-scorta-minima'] = scortaM[1].replace(',', '.');

  var prezzoM = t.match(/\bprezzo(?:\s+unitario)?\s+(\d+(?:[.,]\d+)?)/i);
  if (!prezzoM) prezzoM = t.match(/(\d+(?:[.,]\d+)?)\s*€/i);
  if (prezzoM) formData['prodotto-prezzo'] = prezzoM[1].replace(',', '.');

  var carenzaM = t.match(/\b(?:carenza|giorni(?:\s+di)?\s+carenza)\s+(\d+)/i);
  if (carenzaM) formData['prodotto-giorni-carenza'] = carenzaM[1];

  var dosRange = t.match(/\bdosaggio\s+(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/i);
  if (dosRange) {
    formData['prodotto-dosaggio-min'] = dosRange[1].replace(',', '.');
    formData['prodotto-dosaggio-max'] = dosRange[2].replace(',', '.');
  }

  return Object.keys(formData).length ? formData : null;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isProdottoCreationIntent(text) {
  var t = String(text || '').trim();
  if (!t) return false;
  if (/^(crea|nuovo|registra|aggiungi|fammi)\s+(?:un[a]?\s+)?prodotto\b/i.test(t)) return true;
  if (/\b(crea|registra|nuovo)\b/i.test(t) && /\bprodotto\b/i.test(t)) return true;
  return false;
}

/**
 * @param {Record<string, string>|null|undefined} draft
 * @returns {string[]}
 */
export function getProdottoDraftRequiredMissing(draft) {
  var missing = [];
  if (!draft || !draft['prodotto-nome']) missing.push('prodotto-nome');
  if (!draft || !draft['prodotto-categoria']) missing.push('prodotto-categoria');
  if (!draft || !draft['prodotto-unita']) missing.push('prodotto-unita');
  getProdottoDosaggioCarenzaMissingFromDraft(draft).forEach(function (id) {
    if (missing.indexOf(id) < 0) missing.push(id);
  });
  return missing;
}

/**
 * @param {Record<string, string>|null|undefined} draft
 * @returns {boolean}
 */
export function isProdottoDraftComplete(draft) {
  return getProdottoDraftRequiredMissing(draft).length === 0;
}

/**
 * @param {Record<string, string>|null|undefined} draft
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function mergeProdottoDraft(draft, text) {
  /** @type {Record<string, string>} */
  var out = Object.assign({}, draft || {});
  var t = String(text || '').trim();
  var isConfirmOnly = isTonySaveConfirmText(t) || isTonySaveDenyText(t);

  if (!isConfirmOnly) {
    var parsed = parseProdottoCreationFromText(text);
    if (parsed) {
      Object.keys(parsed).forEach(function (k) {
        if (parsed[k] != null && String(parsed[k]).trim() !== '') out[k] = parsed[k];
      });
    }
  }
  return out;
}

/**
 * @param {string} target
 * @param {Record<string, string>} draft
 * @param {string} text
 * @param {string} storageKey
 */
export function storeProdottoCrossPageIntent(target, draft, text, storageKey) {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({
      text: String(text || '').trim(),
      draft: draft,
      ts: Date.now(),
    }));
    sessionStorage.setItem('tony_pending_intent', JSON.stringify({
      target: target,
      modalId: 'prodotto-modal',
      fields: Object.assign({}, draft),
      magazzinoLocalIntent: true,
    }));
  } catch (_) { /* ignore */ }
}

/**
 * @param {Record<string, string>} formData
 * @param {{ processTonyCommand?: Function, onAfterOpen?: Function }} handlers
 * @param {{ userConfirmedSave?: boolean, logSuffix?: string }} [opts]
 * @returns {boolean}
 */
export function executeProdottoCreateLocal(formData, handlers, opts) {
  handlers = handlers || {};
  opts = opts || {};
  if (!formData || !isProdottoDraftComplete(formData)) return false;

  if (typeof console !== 'undefined' && console.log) {
    var sfx = opts.logSuffix ? ' (' + opts.logSuffix + ')' : '';
    console.log('[Tony] Creazione prodotto locale (no CF)' + sfx + ':', formData);
  }

  if (typeof handlers.processTonyCommand === 'function') {
    handlers.processTonyCommand({
      type: 'OPEN_MODAL',
      id: 'prodotto-modal',
      fields: Object.assign({}, formData),
    });
  }

  if (typeof window !== 'undefined') {
    window.__tonyProdottoPendingDraft = null;
    if (opts.userConfirmedSave) {
      window.__tonyProdottoSaveAfterInject = true;
    }
  }

  if (typeof handlers.onAfterOpen === 'function') {
    handlers.onAfterOpen(formData);
  }
  return true;
}

/**
 * @param {string} text
 * @param {{
 *   appendMessage?: Function,
 *   processTonyCommand?: Function,
 *   clearEarlyTyping?: Function,
 *   onAfterOpen?: Function,
 *   getUrlForTarget?: Function,
 * }} handlers
 * @returns {{ handled: boolean, opened?: boolean, navigating?: boolean }}
 */
export function tryInterceptProdottoCreateBeforeCf(text, handlers) {
  handlers = handlers || {};
  if (typeof window === 'undefined') return { handled: false };
  if (isProdottoModalOpen()) return { handled: false };

  var t = String(text || '').trim();
  if (!t) return { handled: false };

  var draft = window.__tonyProdottoPendingDraft || null;
  var creationIntent = isProdottoCreationIntent(t);

  if (creationIntent) {
    draft = mergeProdottoDraft(null, t);
    window.__tonyProdottoPendingDraft = draft;
  } else if (draft) {
    draft = mergeProdottoDraft(draft, t);
    window.__tonyProdottoPendingDraft = draft;
  }

  if (!draft) return { handled: false };

  var complete = isProdottoDraftComplete(draft);
  var confirm = isTonySaveConfirmText(t);

  if (!isOnProdottiPage()) {
    if (creationIntent && complete) {
      if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
      if (typeof handlers.appendMessage === 'function') {
        handlers.appendMessage('Ti porto all\'anagrafica prodotti.', 'tony');
      }
      storeProdottoCrossPageIntent('prodotti', draft, t, 'tony_pending_prodotto_local_intent');
      var urlCross = typeof handlers.getUrlForTarget === 'function' ? handlers.getUrlForTarget('prodotti') : null;
      if (urlCross) {
        window.location.href = urlCross + (urlCross.indexOf('?') >= 0 ? '&' : '?') + 'tnyNotify=prodotti';
      }
      return { handled: true, opened: false, navigating: true };
    }
    return { handled: false };
  }

  if (creationIntent && complete) {
    if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
    if (typeof handlers.appendMessage === 'function') {
      handlers.appendMessage('Apro il form prodotto e compilo i dati.', 'tony');
    }
    executeProdottoCreateLocal(draft, handlers, { logSuffix: 'intent completo' });
    return { handled: true, opened: true };
  }

  if (confirm && complete) {
    if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
    executeProdottoCreateLocal(draft, handlers, {
      userConfirmedSave: true,
      logSuffix: 'conferma utente',
    });
    return { handled: true, opened: true };
  }

  if (creationIntent && !complete) {
    if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
    var miss = getProdottoDraftRequiredMissing(draft);
    var ask = 'Mi mancano ancora alcuni dati per aprire il form prodotto.';
    if (miss.indexOf('prodotto-categoria') >= 0) {
      ask = 'Di che categoria è il prodotto? (fitofarmaci, fertilizzanti, sementi, …)';
    } else if (miss.indexOf('prodotto-unita') >= 0) {
      ask = 'Quale unità di misura? (kg, L, pezzi, …)';
    } else if (miss.indexOf('prodotto-dosaggio-min') >= 0 || miss.indexOf('prodotto-dosaggio-max') >= 0) {
      ask = 'Indica il dosaggio minimo e massimo per ettaro (es. dosaggio 0.5-1).';
    } else if (miss.indexOf('prodotto-giorni-carenza') >= 0) {
      ask = 'Quanti giorni di carenza ha il fitofarmaco? (es. carenza 30)';
    }
    if (typeof handlers.appendMessage === 'function') handlers.appendMessage(ask, 'tony');
    return { handled: true, opened: false };
  }

  return { handled: false };
}

/**
 * @param {string} cfText
 * @param {{ processTonyCommand?: Function, appendMessage?: Function }} handlers
 * @returns {boolean}
 */
export function tryRecoverProdottoCfFakeSave(cfText, handlers) {
  handlers = handlers || {};
  if (typeof window === 'undefined') return false;
  if (!isOnProdottiPage() || isProdottoModalOpen()) return false;
  if (!/prodotto\s+salvato/i.test(String(cfText || ''))) return false;
  var draft = window.__tonyProdottoPendingDraft;
  if (!draft || !isProdottoDraftComplete(draft)) return false;
  if (typeof handlers.appendMessage === 'function') {
    handlers.appendMessage('Apro il form e registro il prodotto.', 'tony');
  }
  executeProdottoCreateLocal(draft, handlers, {
    userConfirmedSave: true,
    logSuffix: 'recovery fake CF',
  });
  return true;
}

if (typeof window !== 'undefined') {
  window.TonyProdottoCreateLocal = {
    isOnProdottiPage: isOnProdottiPage,
    isProdottoModalOpen: isProdottoModalOpen,
    isProdottoCreationIntent: isProdottoCreationIntent,
    parseProdottoCreationFromText: parseProdottoCreationFromText,
    mergeProdottoDraft: mergeProdottoDraft,
    isProdottoDraftComplete: isProdottoDraftComplete,
    tryInterceptProdottoCreateBeforeCf: tryInterceptProdottoCreateBeforeCf,
    tryRecoverProdottoCfFakeSave: tryRecoverProdottoCfFakeSave,
    executeProdottoCreateLocal: executeProdottoCreateLocal,
  };
}
