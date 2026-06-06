/**
 * Creazione movimento magazzino — client-side (no CF).
 * Evita falso «Movimento registrato!» senza OPEN_MODAL / SAVE_ACTIVITY.
 * @module core/js/tony-movimento-create-local
 */

import { isTonySaveConfirmText, isTonySaveDenyText } from './tony-form-save-local.js';

/**
 * @returns {boolean}
 */
export function isOnMovimentiPage() {
  if (typeof window === 'undefined' || !window.location) return false;
  return String(window.location.pathname || '').toLowerCase().indexOf('movimenti') >= 0;
}

/**
 * @returns {boolean}
 */
export function isMovimentoModalOpen() {
  if (typeof document === 'undefined') return false;
  var modal = document.getElementById('movimento-modal');
  return !!(modal && modal.classList.contains('active'));
}

/**
 * @returns {string}
 */
export function todayIsoDateLocal() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/**
 * @param {string} text
 * @returns {string|null}
 */
export function parseMovimentoDateFromText(text) {
  var t = String(text || '').trim().toLowerCase();
  if (!t) return null;
  if (/^(oggi|per\s+oggi|data\s+(di\s+)?oggi)\b/i.test(t) || /\boggi\b/i.test(t)) {
    return todayIsoDateLocal();
  }
  if (/^(ieri|per\s+ieri)\b/i.test(t)) {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  var iso = t.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  var it = t.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/);
  if (it) {
    return it[3] + '-' + String(it[2]).padStart(2, '0') + '-' + String(it[1]).padStart(2, '0');
  }
  return null;
}

/**
 * @param {string} text
 * @returns {string|null}
 */
export function extractMovimentoProdottoFromText(text) {
  var t = String(text || '').trim();
  if (!t) return null;
  var s = t.replace(
    /^(?:crea|nuovo|registra|aggiungi|fammi)\s+(?:un[a]?\s+)?(?:movimento\s+)?(?:(?:entrata|uscita|carico|scarico)\s+(?:di\s+)?)?/i,
    ''
  );
  s = s.replace(/^(?:movimento\s+)?/i, '');
  s = s.replace(/^(?:entrata|uscita|carico|scarico)\s+(?:di\s+)?/i, '');
  s = s.replace(/\s+in\s+(entrata|uscita|carico|scarico)\b.*$/i, '');
  var m = s.match(/^([a-zA-ZÀ-ÿ0-9][\w\s\-']*?)\s+(\d+(?:[.,]\d+)?)/);
  if (m) return m[1].trim();
  m = s.match(/^([a-zA-ZÀ-ÿ0-9][\w\-']+)/);
  return m ? m[1].trim() : null;
}

/**
 * @param {string} text
 * @returns {Record<string, string>|null}
 */
export function parseMovimentoCreationFromText(text) {
  var t = String(text || '').trim();
  if (!t) return null;
  /** @type {Record<string, string>} */
  var formData = {};

  if (/\b(entrata|carico)\b/i.test(t)) formData['mov-tipo'] = 'entrata';
  else if (/\b(uscita|scarico)\b/i.test(t)) formData['mov-tipo'] = 'uscita';

  var qtyM = t.match(/(\d+(?:[.,]\d+)?)\s*(?:unit[aà]|litri?|\bl\b|kg|pezzi?|confezioni?)?/i);
  if (qtyM) formData['mov-quantita'] = qtyM[1].replace(',', '.');

  var prod = extractMovimentoProdottoFromText(t);
  if (prod) formData['mov-prodotto'] = prod;

  var dt = parseMovimentoDateFromText(t);
  if (dt) formData['mov-data'] = dt;

  return Object.keys(formData).length ? formData : null;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isMovimentoCreationIntent(text) {
  var t = String(text || '').trim();
  if (!t) return false;
  if (/^(crea|nuovo|registra|aggiungi|fammi)\s+(?:un[a]?\s+)?(?:movimento|entrata|uscita|carico|scarico)\b/i.test(t)) {
    return true;
  }
  if (/^(scarico|carico)\s+/i.test(t)) {
    return true;
  }
  if (/\b(crea|registra|nuovo)\b/i.test(t) && /\b(entrata|uscita|carico|scarico)\b/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * @param {Record<string, string>|null|undefined} draft
 * @returns {string[]}
 */
export function getMovimentoDraftRequiredMissing(draft) {
  var missing = [];
  if (!draft || !draft['mov-prodotto']) missing.push('mov-prodotto');
  if (!draft || !draft['mov-tipo']) missing.push('mov-tipo');
  if (!draft || !draft['mov-quantita']) missing.push('mov-quantita');
  if (!draft || !draft['mov-data']) missing.push('mov-data');
  return missing;
}

/**
 * @param {Record<string, string>|null|undefined} draft
 * @returns {boolean}
 */
export function isMovimentoDraftComplete(draft) {
  return getMovimentoDraftRequiredMissing(draft).length === 0;
}

/**
 * @param {Record<string, string>|null|undefined} draft
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function mergeMovimentoDraft(draft, text) {
  /** @type {Record<string, string>} */
  var out = Object.assign({}, draft || {});
  var t = String(text || '').trim();
  var isConfirmOnly = isTonySaveConfirmText(t) || isTonySaveDenyText(t);

  if (!isConfirmOnly) {
    var parsed = parseMovimentoCreationFromText(text);
    if (parsed) {
      Object.keys(parsed).forEach(function (k) {
        if (parsed[k] != null && String(parsed[k]).trim() !== '') out[k] = parsed[k];
      });
    }
    if (/^\d+(?:[.,]\d+)?$/.test(t) && !out['mov-quantita']) {
      out['mov-quantita'] = t.replace(',', '.');
    }
  }

  var dt = parseMovimentoDateFromText(text);
  if (dt) out['mov-data'] = dt;

  return out;
}

/**
 * @param {string} target
 * @param {Record<string, string>} draft
 * @param {string} text
 */
export function storeMovimentoCrossPageIntent(target, draft, text) {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem('tony_pending_movimento_local_intent', JSON.stringify({
      text: String(text || '').trim(),
      draft: draft,
      ts: Date.now(),
    }));
    sessionStorage.setItem('tony_pending_intent', JSON.stringify({
      target: target,
      modalId: 'movimento-modal',
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
export function executeMovimentoCreateLocal(formData, handlers, opts) {
  handlers = handlers || {};
  opts = opts || {};
  if (!formData || !isMovimentoDraftComplete(formData)) return false;
  if (!formData['mov-data']) formData['mov-data'] = todayIsoDateLocal();

  if (typeof console !== 'undefined' && console.log) {
    var sfx = opts.logSuffix ? ' (' + opts.logSuffix + ')' : '';
    console.log('[Tony] Creazione movimento locale (no CF)' + sfx + ':', formData);
  }

  if (typeof handlers.processTonyCommand === 'function') {
    handlers.processTonyCommand({
      type: 'OPEN_MODAL',
      id: 'movimento-modal',
      fields: Object.assign({}, formData),
    });
  }

  if (typeof window !== 'undefined') {
    window.__tonyMovimentoPendingDraft = null;
    if (opts.userConfirmedSave) {
      window.__tonyMovimentoSaveAfterInject = true;
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
 * }} handlers
 * @returns {{ handled: boolean, opened?: boolean }}
 */
export function tryInterceptMovimentoCreateBeforeCf(text, handlers) {
  handlers = handlers || {};
  if (typeof window === 'undefined') return { handled: false };
  if (isMovimentoModalOpen()) return { handled: false };

  var t = String(text || '').trim();
  if (!t) return { handled: false };

  var draft = window.__tonyMovimentoPendingDraft || null;
  var creationIntent = isMovimentoCreationIntent(t);

  if (creationIntent) {
    draft = mergeMovimentoDraft(null, t);
    if (!draft['mov-data']) draft['mov-data'] = todayIsoDateLocal();
    window.__tonyMovimentoPendingDraft = draft;
  } else if (draft) {
    draft = mergeMovimentoDraft(draft, t);
    window.__tonyMovimentoPendingDraft = draft;
  }

  if (!draft) return { handled: false };

  var complete = isMovimentoDraftComplete(draft);
  var confirm = isTonySaveConfirmText(t);
  var dateOnly = !!parseMovimentoDateFromText(t) && !creationIntent && !confirm;

  if (!isOnMovimentiPage()) {
    if ((creationIntent && complete) || (dateOnly && complete)) {
      if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
      if (typeof handlers.appendMessage === 'function') {
        handlers.appendMessage('Ti porto ai movimenti magazzino.', 'tony');
      }
      storeMovimentoCrossPageIntent('movimenti', draft, t);
      var urlCross = typeof handlers.getUrlForTarget === 'function' ? handlers.getUrlForTarget('movimenti') : null;
      if (urlCross) {
        window.location.href = urlCross + (urlCross.indexOf('?') >= 0 ? '&' : '?') + 'tnyNotify=movimenti';
      }
      return { handled: true, opened: false, navigating: true };
    }
    return { handled: false };
  }

  if (creationIntent && complete) {
    if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
    if (typeof handlers.appendMessage === 'function') {
      handlers.appendMessage('Apro il form movimento e compilo i dati.', 'tony');
    }
    executeMovimentoCreateLocal(draft, handlers, { logSuffix: 'intent completo' });
    return { handled: true, opened: true };
  }

  if (dateOnly && complete) {
    if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
    if (typeof handlers.appendMessage === 'function') {
      handlers.appendMessage('Ok, data impostata. Apro il form movimento.', 'tony');
    }
    executeMovimentoCreateLocal(draft, handlers, { logSuffix: 'data risposta' });
    return { handled: true, opened: true };
  }

  if (confirm && complete) {
    if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
    executeMovimentoCreateLocal(draft, handlers, {
      userConfirmedSave: true,
      logSuffix: 'conferma utente',
    });
    return { handled: true, opened: true };
  }

  if (creationIntent && !complete) {
    if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
    var miss = getMovimentoDraftRequiredMissing(draft);
    var ask = miss.indexOf('mov-data') >= 0
      ? 'Quale data vuoi per il movimento? (es. oggi)'
      : 'Mi mancano ancora alcuni dati per aprire il form movimento.';
    if (typeof handlers.appendMessage === 'function') handlers.appendMessage(ask, 'tony');
    return { handled: true, opened: false };
  }

  return { handled: false };
}

/**
 * Recupero falso «Movimento registrato!» CF senza modal aperto.
 * @param {string} cfText
 * @param {{ processTonyCommand?: Function, appendMessage?: Function }} handlers
 * @returns {boolean}
 */
export function tryRecoverMovimentoCfFakeSave(cfText, handlers) {
  handlers = handlers || {};
  if (typeof window === 'undefined') return false;
  if (!isOnMovimentiPage() || isMovimentoModalOpen()) return false;
  if (!/movimento\s+(?:salvato|registrato)/i.test(String(cfText || ''))) return false;
  var draft = window.__tonyMovimentoPendingDraft;
  if (!draft || !isMovimentoDraftComplete(draft)) return false;
  if (typeof handlers.appendMessage === 'function') {
    handlers.appendMessage('Apro il form e registro il movimento.', 'tony');
  }
  executeMovimentoCreateLocal(draft, handlers, {
    userConfirmedSave: true,
    logSuffix: 'recovery fake CF',
  });
  return true;
}

if (typeof window !== 'undefined') {
  window.TonyMovimentoCreateLocal = {
    isOnMovimentiPage: isOnMovimentiPage,
    isMovimentoModalOpen: isMovimentoModalOpen,
    isMovimentoCreationIntent: isMovimentoCreationIntent,
    parseMovimentoCreationFromText: parseMovimentoCreationFromText,
    mergeMovimentoDraft: mergeMovimentoDraft,
    isMovimentoDraftComplete: isMovimentoDraftComplete,
    tryInterceptMovimentoCreateBeforeCf: tryInterceptMovimentoCreateBeforeCf,
    tryRecoverMovimentoCfFakeSave: tryRecoverMovimentoCfFakeSave,
    executeMovimentoCreateLocal: executeMovimentoCreateLocal,
  };
}
