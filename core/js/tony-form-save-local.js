/**
 * Conferma salvataggio form Tony — client-side, 0 round-trip CF.
 * Pattern condiviso: lavoro (canary 3b-C8), preventivo (3b-C14), magazzino prodotto/movimento (3b-C15/C16).
 * @module core/js/tony-form-save-local
 */

/** @typedef {{
 *   formId: string,
 *   modalId?: string,
 *   awaitingFlag: string,
 *   saveMessage: string,
 *   speakText?: string,
 *   denyMessage?: string,
 *   isFormActive: () => boolean,
 *   beforeSave?: () => void,
 *   onConfirmReset?: () => void,
 * }} TonyFormSaveLocalEntry */

/** Ordine intercept: lavoro → preventivo → prodotto → movimento se più flag pending (improbabile). */
export const TONY_FORM_SAVE_LOCAL_ORDER = ['lavoro-form', 'preventivo-form', 'prodotto-form', 'movimento-form'];

/** @type {Record<string, TonyFormSaveLocalEntry>} */
export const TONY_FORM_SAVE_LOCAL_CONFIG = {
  'lavoro-form': {
    formId: 'lavoro-form',
    modalId: 'lavoro-modal',
    awaitingFlag: '__tonyAwaitingLavoroSaveConfirm',
    saveMessage: 'Vuoi che salvi il lavoro?',
    speakText: 'Vuoi che salvi il lavoro?',
    isFormActive: function isLavoroFormActiveForSave() {
      var pathLav = (typeof window !== 'undefined' && window.location && window.location.pathname)
        ? String(window.location.pathname).toLowerCase()
        : '';
      var modalL = typeof document !== 'undefined' ? document.getElementById('lavoro-modal') : null;
      return pathLav.indexOf('gestione-lavori') >= 0 && !!modalL && modalL.classList.contains('active');
    },
    beforeSave: function lavoroBeforeSave() {
      if (typeof window !== 'undefined' && window.TonyFormInjector &&
          typeof window.TonyFormInjector.syncLavoroOperatoreMacchinaIfNeeded === 'function') {
        window.TonyFormInjector.syncLavoroOperatoreMacchinaIfNeeded();
      }
    },
    onConfirmReset: function lavoroOnConfirmReset() {
      if (typeof window !== 'undefined') {
        window.__tonyLavoroCreationFlow = false;
      }
    },
  },
  'preventivo-form': {
    formId: 'preventivo-form',
    modalId: 'preventivo-form',
    awaitingFlag: '__tonyAwaitingPreventivoSaveConfirm',
    saveMessage: 'Vuoi che salvi il preventivo?',
    speakText: 'Vuoi che salvi il preventivo?',
    isFormActive: function isPreventivoFormActiveForSave() {
      return typeof document !== 'undefined' && !!document.getElementById('preventivo-form');
    },
  },
  'prodotto-form': {
    formId: 'prodotto-form',
    modalId: 'prodotto-modal',
    awaitingFlag: '__tonyAwaitingProdottoSaveConfirm',
    saveMessage: 'Vuoi che salvi il prodotto?',
    speakText: 'Vuoi che salvi il prodotto?',
    isFormActive: function isProdottoFormActiveForSave() {
      var modal = typeof document !== 'undefined' ? document.getElementById('prodotto-modal') : null;
      return !!modal && modal.classList.contains('active');
    },
  },
  'movimento-form': {
    formId: 'movimento-form',
    modalId: 'movimento-modal',
    awaitingFlag: '__tonyAwaitingMovimentoSaveConfirm',
    saveMessage: 'Vuoi che salvi il movimento?',
    speakText: 'Vuoi che salvi il movimento?',
    isFormActive: function isMovimentoFormActiveForSave() {
      var modal = typeof document !== 'undefined' ? document.getElementById('movimento-modal') : null;
      return !!modal && modal.classList.contains('active');
    },
  },
};

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isTonySaveConfirmText(text) {
  var tsv = String(text || '').trim();
  return /^\s*(s[iì]|ok|salva|confermo|va\s*bene|procedi)(\s|$|[,.!])/i.test(tsv) ||
    /^\s*(s[iì]|ok),?\s*(salva|va bene)/i.test(tsv);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isTonySaveDenyText(text) {
  return /^\s*(no|annulla|aspetta|modifica|ferma)\b/i.test(String(text || '').trim());
}

/**
 * @param {string} formId
 * @returns {TonyFormSaveLocalEntry|null}
 */
export function getTonyFormSaveLocalConfig(formId) {
  return TONY_FORM_SAVE_LOCAL_CONFIG[formId] || null;
}

/**
 * @param {string} formId
 * @returns {boolean}
 */
export function formReadyForTonySave(formId) {
  var cfg = getTonyFormSaveLocalConfig(formId);
  if (!cfg || typeof document === 'undefined') return false;
  var formEl = document.getElementById(cfg.formId);
  if (!formEl) return false;
  var build = typeof window !== 'undefined' ? window.__tonyBuildTonyFormContext : null;
  if (typeof build !== 'function') return false;
  var ctx = build(formEl, formEl, cfg.modalId || '', 'form save check');
  if (!ctx || ctx.formId !== cfg.formId) return false;
  var reqEmpty = (ctx.requiredEmpty && ctx.requiredEmpty.slice) ? ctx.requiredEmpty.slice() : [];
  if (reqEmpty.length > 0) return false;
  /** Movimento: campi intervista opzionali HTML — basta requiredEmpty vuoto. */
  if (formId === 'movimento-form') return true;
  return true;
}

/**
 * Form magazzino pronto per prompt save locale / timer proattivo.
 * @param {string} formId
 * @returns {boolean}
 */
export function magazzinoFormReadyForTonySave(formId) {
  if (formId !== 'prodotto-form' && formId !== 'movimento-form') return false;
  return formReadyForTonySave(formId);
}

/**
 * @param {string} formId
 * @param {boolean} hasRequiredEmpty
 * @returns {boolean}
 */
export function magazzinoProactiveReadyForSave(formId, hasRequiredEmpty) {
  if (hasRequiredEmpty) return false;
  if (formId === 'movimento-form') return true;
  return magazzinoFormReadyForTonySave(formId);
}

/**
 * @returns {'prodotto-form'|'movimento-form'|null}
 */
export function getActiveMagazzinoFormIdForSave() {
  if (magazzinoFormReadyForTonySave('prodotto-form')) return 'prodotto-form';
  if (magazzinoFormReadyForTonySave('movimento-form')) return 'movimento-form';
  return null;
}

/**
 * Testo CF che simula conferma/successo salvataggio senza SAVE_ACTIVITY.
 * @param {string} text
 * @returns {boolean}
 */
export function isTonyMagazzinoCfFakeSaveText(text) {
  var t = String(text || '').trim();
  if (!t) return false;
  return /salvo\s*\?|perfetto\s*,?\s*salvo|salvat[ao](?:\s|!|\.|$)|prodotto\s+salvato|movimento\s+(?:salvato|registrato)/i.test(t);
}

/**
 * Prompt canonico + SAVE_ACTIVITY reale (magazzino).
 * @param {string} formId
 * @param {{ appendMessage?: Function, speak?: Function, processTonyCommand?: Function, showPrompt?: boolean, logSuffix?: string }} handlers
 * @returns {boolean}
 */
export function executeTonyMagazzinoSaveLocal(formId, handlers) {
  handlers = handlers || {};
  var cfg = getTonyFormSaveLocalConfig(formId);
  if (!cfg || !magazzinoFormReadyForTonySave(formId) || !cfg.isFormActive()) return false;
  var showPrompt = handlers.showPrompt !== false;
  if (showPrompt && typeof handlers.appendMessage === 'function') {
    handlers.appendMessage(cfg.saveMessage, 'tony');
  }
  if (showPrompt && typeof handlers.speak === 'function' && cfg.speakText) {
    handlers.speak(cfg.speakText);
  }
  if (typeof cfg.beforeSave === 'function') cfg.beforeSave();
  if (typeof console !== 'undefined' && console.log) {
    var sfx = handlers.logSuffix ? ' (' + handlers.logSuffix + ')' : '';
    console.log('[Tony] Salva ' + formId + ': conferma utente locale (senza tonyAsk)' + sfx + '.');
  }
  if (typeof handlers.processTonyCommand === 'function') {
    handlers.processTonyCommand({ type: 'SAVE_ACTIVITY' });
  }
  return true;
}

/**
 * «salva»/«sì» con form magazzino pronto ma flag CF non armato — evita round-trip e falso «Prodotto salvato!».
 * @param {string} text
 * @param {{ appendMessage?: Function, speak?: Function, processTonyCommand?: Function, clearEarlyTyping?: Function }} handlers
 * @returns {{ handled: boolean, confirmed?: boolean }}
 */
/**
 * Verifica readiness sul DOM reale `#quick-hours-form` (parent workspace o documento corrente).
 * @returns {boolean}
 */
export function quickHoursDomReadyForTonySave(opts) {
  opts = opts || {};
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  var doc = null;
  if (document.getElementById('quick-hours-form')) doc = document;
  else {
    try {
      if (window.parent && window.parent !== window && window.parent.document &&
          window.parent.document.getElementById('quick-hours-form')) {
        doc = window.parent.document;
      }
    } catch (eP) { /* cross-origin */ }
  }
  if (!doc) return false;
  var sel = doc.getElementById('selected-work') || doc.getElementById('quick-work-select');
  var lavoroVal = sel && sel.value ? String(sel.value).trim() : '';
  if (!lavoroVal) return false;
  var dateEl = doc.getElementById('ora-data');
  var start = doc.getElementById('ora-start');
  var end = doc.getElementById('ora-end');
  if (!dateEl || !start || !end) return false;
  if (!String(dateEl.value || '').trim() || !String(start.value || '').trim() || !String(end.value || '').trim()) {
    return false;
  }
  if (opts.forceIfSaveConfirm) return true;
  var brEl = doc.getElementById('ora-break');
  var brNum = 0;
  if (brEl && String(brEl.value || '').trim() !== '') {
    var bp = parseInt(String(brEl.value).trim(), 10);
    brNum = Number.isFinite(bp) ? bp : 0;
  }
  if (brNum > 0) return true;
  try {
    if (window.__tonyQuickHoursPauseAckAt &&
        (Date.now() - window.__tonyQuickHoursPauseAckAt) < 30 * 60 * 1000) {
      return true;
    }
  } catch (eFl) { /* ignore */ }
  var lastU = '';
  try {
    if (typeof sessionStorage !== 'undefined') {
      lastU = String(sessionStorage.getItem('tony_last_user_message') || '').trim();
    }
  } catch (eS) { /* ignore */ }
  if (!lastU && typeof window !== 'undefined' && window.__tonyLastUserMessage) {
    lastU = String(window.__tonyLastUserMessage).trim();
  }
  if (/^\s*(\d{1,3})\s*$/.test(lastU)) return true;
  if (/^\s*(nessuna|nessun|niente|nulla)\s*$/i.test(lastU)) return true;
  if (/nessun[ao]?\s+pausa|senza\s+pausa|no\s+pausa|zero\s+pausa|non\s+ho\s+fatto\s+pausa/i.test(lastU)) return true;
  return false;
}

/**
 * Form Segna ore inline workspace (`field-workspace-ore-form` / `#quick-hours-form`).
 * @returns {boolean}
 */
export function quickHoursFormReadyForTonySave(opts) {
  opts = opts || {};
  if (typeof window === 'undefined') return false;
  var getCtx = window.__tonyGetCurrentFormContext;
  var ctx = typeof getCtx === 'function' ? getCtx() : null;
  if (ctx && ctx.formId === 'field-workspace-ore-form') {
    if (ctx.requiredEmpty && ctx.requiredEmpty.length > 0) return false;
    if (ctx.interviewEmpty && ctx.interviewEmpty.length > 0) {
      return quickHoursDomReadyForTonySave(opts);
    }
  }
  return quickHoursDomReadyForTonySave(opts);
}

/**
 * Testo CF che simula salvataggio ore senza submit reale su quick-hours.
 * @param {string} text
 * @returns {boolean}
 */
export function isTonyQuickHoursCfFakeSaveText(text) {
  var t = String(text || '').trim();
  if (!t) return false;
  if (/\?\s*$/.test(t)) return false;
  return /ore\s+salvat|ore\s+segnate\b|turno\s+registrat|registrat[ao]\s+(correttamente|le\s+ore)|salvat[ao]\s+correttamente/i.test(t);
}

/**
 * «sì»/«salva» con #quick-hours-form pronto — 0 CF, submit reale via QUICK_SAVE.
 * @param {string} text
 * @param {{ clearEarlyTyping?: () => void, processTonyCommand?: (cmd: object) => void, salvaQuickHours?: (opts?: object) => void }} handlers
 * @returns {{ handled: boolean, confirmed?: boolean }}
 */
export function tryInterceptQuickHoursSaveBeforeCf(text, handlers) {
  handlers = handlers || {};
  if (typeof window === 'undefined') return { handled: false };
  var ready = quickHoursFormReadyForTonySave();
  if (!ready && isTonySaveConfirmText(text)) {
    var getCtx = window.__tonyGetCurrentFormContext;
    var ctx = typeof getCtx === 'function' ? getCtx() : null;
    var ctxBlocked = ctx && ctx.requiredEmpty && ctx.requiredEmpty.length > 0;
    if (!ctxBlocked) {
      ready = quickHoursDomReadyForTonySave({ forceIfSaveConfirm: true });
    }
  }
  if (!ready) return { handled: false };
  if (!isTonySaveConfirmText(text)) return { handled: false };
  if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
  if (typeof handlers.salvaQuickHours === 'function') {
    handlers.salvaQuickHours({ skipRecover: true });
  } else if (typeof handlers.processTonyCommand === 'function') {
    handlers.processTonyCommand({ type: 'QUICK_SAVE', formId: 'field-workspace-ore-form' });
  }
  if (typeof console !== 'undefined' && console.log) {
    console.log('[Tony] Salva rapido workspace: conferma locale (senza tonyAsk).');
  }
  return { handled: true, confirmed: true };
}

export function tryInterceptMagazzinoSaveBeforeCf(text, handlers) {
  handlers = handlers || {};
  if (typeof window === 'undefined') return { handled: false };

  var forms = ['prodotto-form', 'movimento-form'];
  for (var i = 0; i < forms.length; i++) {
    var formId = forms[i];
    var cfg = getTonyFormSaveLocalConfig(formId);
    if (!cfg || window[cfg.awaitingFlag]) continue;
    if (!cfg.isFormActive() || !magazzinoFormReadyForTonySave(formId)) continue;

    if (isTonySaveConfirmText(text)) {
      if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
      executeTonyMagazzinoSaveLocal(formId, Object.assign({}, handlers, {
        logSuffix: 'intercept pre-CF',
      }));
      return { handled: true, confirmed: true };
    }
  }
  return { handled: false };
}

/**
 * @returns {boolean}
 */
export function isAnyTonyFormSaveConfirmPending() {
  if (typeof window === 'undefined') return false;
  for (var i = 0; i < TONY_FORM_SAVE_LOCAL_ORDER.length; i++) {
    var cfg = TONY_FORM_SAVE_LOCAL_CONFIG[TONY_FORM_SAVE_LOCAL_ORDER[i]];
    if (cfg && window[cfg.awaitingFlag]) return true;
  }
  return false;
}

/**
 * @param {string[]} [formIds]
 */
export function resetTonyFormSaveConfirmFlags(formIds) {
  if (typeof window === 'undefined') return;
  var ids = formIds && formIds.length ? formIds : TONY_FORM_SAVE_LOCAL_ORDER;
  ids.forEach(function (fid) {
    var cfg = TONY_FORM_SAVE_LOCAL_CONFIG[fid];
    if (cfg) window[cfg.awaitingFlag] = false;
  });
}

/**
 * @param {string} formId
 * @param {{ appendMessage?: (msg: string, role: string) => void, speak?: (text: string) => void, requireComplete?: boolean }} deps
 * @returns {boolean}
 */
export function promptTonyFormSaveLocal(formId, deps) {
  deps = deps || {};
  var cfg = getTonyFormSaveLocalConfig(formId);
  if (!cfg || typeof window === 'undefined') return false;
  if (window[cfg.awaitingFlag]) return false;
  if (!cfg.isFormActive()) return false;
  if (deps.requireComplete && !formReadyForTonySave(formId)) return false;
  window[cfg.awaitingFlag] = true;
  if (typeof deps.appendMessage === 'function') {
    deps.appendMessage(cfg.saveMessage, 'tony');
  }
  if (typeof deps.speak === 'function' && cfg.speakText) {
    deps.speak(cfg.speakText);
  }
  return true;
}

/**
 * Intercept «sì/salva» prima di tonyAsk — 0 CF.
 * @param {string} text
 * @param {{
 *   appendMessage?: (msg: string, role: string) => void,
 *   processTonyCommand?: (cmd: { type: string }) => void,
 *   clearEarlyTyping?: () => void,
 *   logLabel?: string,
 * }} handlers
 * @returns {{ handled: boolean, confirmed?: boolean }}
 */
export function tryInterceptTonyFormSaveConfirm(text, handlers) {
  handlers = handlers || {};
  if (typeof window === 'undefined') return { handled: false };

  for (var i = 0; i < TONY_FORM_SAVE_LOCAL_ORDER.length; i++) {
    var cfg = TONY_FORM_SAVE_LOCAL_CONFIG[TONY_FORM_SAVE_LOCAL_ORDER[i]];
    if (!cfg || !window[cfg.awaitingFlag]) continue;
    if (!cfg.isFormActive()) continue;

    if (isTonySaveConfirmText(text)) {
      window[cfg.awaitingFlag] = false;
      if (typeof cfg.onConfirmReset === 'function') cfg.onConfirmReset();
      if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
      var label = handlers.logLabel || cfg.formId;
      if (typeof console !== 'undefined' && console.log) {
        console.log('[Tony] Salva ' + label + ': conferma utente locale (senza tonyAsk).');
      }
      if (typeof cfg.beforeSave === 'function') cfg.beforeSave();
      if (typeof handlers.processTonyCommand === 'function') {
        handlers.processTonyCommand({ type: 'SAVE_ACTIVITY' });
      }
      return { handled: true, confirmed: true };
    }

    if (isTonySaveDenyText(text)) {
      window[cfg.awaitingFlag] = false;
      if (typeof handlers.clearEarlyTyping === 'function') handlers.clearEarlyTyping();
      var denyMsg = cfg.denyMessage || 'Ok, dimmi se vuoi modificare qualcosa nel form.';
      if (typeof handlers.appendMessage === 'function') {
        handlers.appendMessage(denyMsg, 'tony');
      }
      return { handled: true, confirmed: false };
    }
  }

  return { handled: false };
}

if (typeof window !== 'undefined') {
  window.TonyFormSaveLocal = {
    TONY_FORM_SAVE_LOCAL_CONFIG: TONY_FORM_SAVE_LOCAL_CONFIG,
    TONY_FORM_SAVE_LOCAL_ORDER: TONY_FORM_SAVE_LOCAL_ORDER,
    isTonySaveConfirmText: isTonySaveConfirmText,
    isTonySaveDenyText: isTonySaveDenyText,
    formReadyForTonySave: formReadyForTonySave,
    magazzinoFormReadyForTonySave: magazzinoFormReadyForTonySave,
    magazzinoProactiveReadyForSave: magazzinoProactiveReadyForSave,
    getActiveMagazzinoFormIdForSave: getActiveMagazzinoFormIdForSave,
    isTonyMagazzinoCfFakeSaveText: isTonyMagazzinoCfFakeSaveText,
    executeTonyMagazzinoSaveLocal: executeTonyMagazzinoSaveLocal,
    quickHoursFormReadyForTonySave: quickHoursFormReadyForTonySave,
    isTonyQuickHoursCfFakeSaveText: isTonyQuickHoursCfFakeSaveText,
    tryInterceptQuickHoursSaveBeforeCf: tryInterceptQuickHoursSaveBeforeCf,
    tryInterceptMagazzinoSaveBeforeCf: tryInterceptMagazzinoSaveBeforeCf,
    isAnyTonyFormSaveConfirmPending: isAnyTonyFormSaveConfirmPending,
    promptTonyFormSaveLocal: promptTonyFormSaveLocal,
    tryInterceptTonyFormSaveConfirm: tryInterceptTonyFormSaveConfirm,
    resetTonyFormSaveConfirmFlags: resetTonyFormSaveConfirmFlags,
    getTonyFormSaveLocalConfig: getTonyFormSaveLocalConfig,
  };
}
