/**
 * Motore locale Segna ore — workspace mobile (#quick-hours-form) e desktop (#ora-form).
 * Parse, readiness DOM, messaggi raggruppati, risoluzione finestra target.
 * @module core/js/tony/tony-segna-ora-local-engine
 */

/** Messaggio di fallback quando mancano più campi obbligatori. */
export const SEGNA_ORE_ASK_FALLBACK =
  'Mi servono orario di inizio, orario di fine e minuti di pausa (es. dalle 7 alle 18, pausa 30).';

/** Rimuove inizio «fantasma» (autofill browser = ora corrente) se Tony inietta solo fine/pausa. */
export function clearSpuriousQuickHoursAutofill(doc, fd) {
  if (!doc || !fd || typeof fd !== 'object') return;
  var hasStart = fd['ora-inizio'] != null && String(fd['ora-inizio']).trim() !== '';
  var hasEnd = fd['ora-fine'] != null && String(fd['ora-fine']).trim() !== '';
  if (hasStart && hasEnd) return;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var now = new Date();
  var nowHm = pad(now.getHours()) + ':' + pad(now.getMinutes());
  var startEl = doc.getElementById('ora-start') || doc.getElementById('ora-inizio');
  if (!startEl) return;
  var curStart = String(startEl.value || '').trim();
  if (!curStart || curStart.substring(0, 5) !== nowHm) return;
  if (!hasStart && (hasEnd || fd['ora-pause'] != null)) {
    startEl.value = '';
    try { startEl.dispatchEvent(new Event('input', { bubbles: true })); } catch (eEv) { /* ignore */ }
  }
}

/**
 * @typedef {'quick-hours'|'ora-modal'} SegnaOreFormKind
 * @typedef {{ window: Window, formKind: SegnaOreFormKind, doc: Document }} SegnaOreTarget
 */

/**
 * @param {SegnaOreFormKind} formKind
 * @returns {{ data: string, start: string, end: string, pause: string, lavoro: string, note: string, form: string }}
 */
export function getSegnaOreDomFieldIds(formKind) {
  if (formKind === 'quick-hours') {
    return {
      data: 'ora-data',
      start: 'ora-start',
      end: 'ora-end',
      pause: 'ora-break',
      lavoro: 'selected-work',
      lavoroAlt: 'quick-work-select',
      note: 'ora-note',
      form: 'quick-hours-form',
    };
  }
  return {
    data: 'ora-data',
    start: 'ora-inizio',
    end: 'ora-fine',
    pause: 'ora-pause',
    lavoro: 'ora-lavoro',
    lavoroAlt: null,
    note: 'ora-note',
    form: 'ora-form',
  };
}

/**
 * @param {Document} doc
 * @param {SegnaOreFormKind} formKind
 * @returns {HTMLElement|null}
 */
export function getSegnaOreLavoroElement(doc, formKind) {
  if (!doc) return null;
  const ids = getSegnaOreDomFieldIds(formKind);
  var el = doc.getElementById(ids.lavoro);
  if (el) return el;
  if (ids.lavoroAlt) {
    el = doc.getElementById(ids.lavoroAlt);
    if (el) return el;
  }
  return null;
}

/**
 * @param {{ targetWindow?: Window }} [opts]
 * @returns {SegnaOreTarget|null}
 */
export function resolveSegnaOreTargetWindow(opts) {
  opts = opts || {};
  if (typeof window === 'undefined') return null;

  if (opts.targetWindow && opts.targetWindow.document) {
    var forced = classifySegnaOreDocument(opts.targetWindow.document);
    if (forced) {
      return { window: opts.targetWindow, formKind: forced, doc: opts.targetWindow.document };
    }
  }

  try {
    if (window.TonyFormInjector && typeof window.TonyFormInjector.resolveQuickHoursTargetWindow === 'function') {
      var tw = window.TonyFormInjector.resolveQuickHoursTargetWindow({});
      if (tw && tw.document) {
        var kindQ = classifySegnaOreDocument(tw.document);
        if (kindQ) return { window: tw, formKind: kindQ, doc: tw.document };
      }
    }
  } catch (e0) { /* ignore */ }

  var direct = classifySegnaOreWindow(window);
  if (direct) return direct;

  try {
    if (window.parent && window.parent !== window) {
      var parentTarget = classifySegnaOreWindow(window.parent);
      if (parentTarget) return parentTarget;
    }
  } catch (e1) { /* cross-origin */ }

  return null;
}

/**
 * @param {Document} doc
 * @returns {SegnaOreFormKind|null}
 */
function classifySegnaOreDocument(doc) {
  if (!doc) return null;
  if (doc.getElementById('quick-hours-form')) return 'quick-hours';
  if (doc.getElementById('ora-form')) return 'ora-modal';
  return null;
}

/**
 * @param {Window} w
 * @returns {SegnaOreTarget|null}
 */
function classifySegnaOreWindow(w) {
  if (!w || !w.document) return null;
  var kind = classifySegnaOreDocument(w.document);
  if (!kind) return null;
  return { window: w, formKind: kind, doc: w.document };
}

/**
 * @param {SegnaOreTarget|null} target
 * @returns {{
 *   formKind: SegnaOreFormKind,
 *   lavoroVal: string,
 *   dateVal: string,
 *   startVal: string,
 *   endVal: string,
 *   pauseVal: string,
 *   noteVal: string,
 *   modalActive: boolean
 * }|null}
 */
export function readSegnaOreDomState(target) {
  if (!target || !target.doc || !target.formKind) return null;
  var doc = target.doc;
  var ids = getSegnaOreDomFieldIds(target.formKind);
  var lavoroEl = getSegnaOreLavoroElement(doc, target.formKind);
  var dateEl = doc.getElementById(ids.data);
  var startEl = doc.getElementById(ids.start);
  var endEl = doc.getElementById(ids.end);
  var pauseEl = doc.getElementById(ids.pause);
  var noteEl = doc.getElementById(ids.note);
  var modal = doc.getElementById('ora-modal');
  return {
    formKind: target.formKind,
    lavoroVal: lavoroEl ? String(lavoroEl.value || '').trim() : '',
    dateVal: dateEl ? String(dateEl.value || '').trim() : '',
    startVal: startEl ? String(startEl.value || '').trim() : '',
    endVal: endEl ? String(endEl.value || '').trim() : '',
    pauseVal: pauseEl ? String(pauseEl.value || '').trim() : '',
    noteVal: noteEl ? String(noteEl.value || '').trim() : '',
    modalActive: !!(modal && modal.classList && modal.classList.contains('active')),
  };
}

/**
 * Elenco campi mancanti per il submit.
 * @param {ReturnType<typeof readSegnaOreDomState>} state
 * @param {{ pauseAcknowledged?: boolean, requireLavoro?: boolean }} [opts]
 * @returns {string[]}
 */
export function listSegnaOreMissingRequired(state, opts) {
  opts = opts || {};
  if (!state) return ['orario di inizio', 'orario di fine', 'minuti di pausa'];
  var missing = [];
  var requireLavoro = opts.requireLavoro !== false;
  if (requireLavoro && !state.lavoroVal) missing.push('lavoro');
  if (!state.dateVal) missing.push('data');
  if (!state.startVal) missing.push('orario di inizio');
  if (!state.endVal) missing.push('orario di fine');
  var pauseKnown = state.pauseVal !== '' || !!opts.pauseAcknowledged;
  if (state.startVal && state.endVal && !pauseKnown) missing.push('minuti di pausa');
  return missing;
}

/**
 * Una sola richiesta Tony con tutti i campi obbligatori ancora mancanti.
 * @param {ReturnType<typeof readSegnaOreDomState>} state
 * @param {{ pauseAcknowledged?: boolean, requireLavoro?: boolean }} [opts]
 * @returns {string}
 */
export function buildSegnaOreMissingFieldsMessage(state, opts) {
  opts = opts || {};
  var missing = listSegnaOreMissingRequired(state, opts);
  if (missing.length === 0) {
    var recap = '';
    if (state && state.startVal && state.endVal) {
      recap = 'dalle ' + state.startVal + ' alle ' + state.endVal;
      var pauseN = state.pauseVal !== '' ? parseInt(state.pauseVal, 10) : 0;
      recap += ', pausa ' + (Number.isFinite(pauseN) ? pauseN : 0) + ' min';
    }
    return 'Tutto pronto' + (recap ? ': ' + recap : ' nel form') + '. Vuoi salvare? Scrivi «sì» o «salva».';
  }
  if (missing.length === 1) {
    var one = missing[0];
    if (one === 'minuti di pausa') {
      return 'Quanti minuti di pausa hai fatto? (es. 30, oppure «nessuna pausa»).';
    }
    if (one === 'orario di inizio' || one === 'orario di fine') {
      return 'Mi servono ' + missing.join(' e ') + ' (es. dalle 7 alle 18).';
    }
    return 'Mi manca: ' + one + '.';
  }
  return 'Mi servono: ' + missing.join(', ') + '. Esempio: «dalle 7 alle 18, pausa 30».';
}

export function extractSegnaOrePauseMinutesFromUserBlob(userBlob) {
  if (!userBlob || typeof userBlob !== 'string') return null;
  var pm = userBlob.match(/(\d+)\s*min(?:uti)?(?:\s+di\s*pausa)?/i);
  if (pm) {
    var n0 = parseInt(pm[1], 10);
    if (Number.isFinite(n0) && n0 >= 0 && n0 <= 600) return n0;
  }
  var pmBare = userBlob.match(/(?:con\s+)?pausa\s+(\d{1,3})\b/i);
  if (pmBare) {
    var n1 = parseInt(pmBare[1], 10);
    if (Number.isFinite(n1) && n1 >= 0 && n1 <= 600) return n1;
  }
  if (/un['']?ora\s+di\s+pausa/i.test(userBlob)) return 60;
  if (/^\s*(nessuna|nessun|niente|nulla)\s*$/i.test(userBlob.trim())) return 0;
  if (/nessun[ao]?\s+pausa|senza\s+pausa|no\s+pausa|zero\s+pausa|non\s+ho\s+fatto\s+pausa/i.test(userBlob)) {
    return 0;
  }
  return null;
}

/**
 * @param {string} userBlob
 * @returns {boolean}
 */
export function userBlobMentionsSegnaOrePause(userBlob) {
  if (extractSegnaOrePauseMinutesFromUserBlob(userBlob) != null) return true;
  if (/un['']?ora\s+di\s+pausa/i.test(userBlob)) return true;
  if (/nessun[ao]?\s+pausa|senza\s+pausa|no\s+pausa|zero\s+pausa|non\s+ho\s+fatto\s+pausa|mai\s+fatto\s+pausa|non\s+ho\s+paus/i.test(userBlob)) {
    return true;
  }
  if (/\bpausa\b/i.test(userBlob) && /\b(nessun|niente|nulla|\b0\b)\b/i.test(userBlob)) return true;
  return false;
}

/**
 * @param {string} userBlob
 * @returns {boolean}
 */
export function userBlobAcknowledgesZeroPause(userBlob) {
  var ub = String(userBlob || '').trim();
  if (!ub) return false;
  if (/^\s*(\d{1,3})\s*$/.test(ub)) return parseInt(ub, 10) === 0;
  if (/^\s*(nessuna|nessun|niente|nulla)\s*$/i.test(ub)) return true;
  return /nessun[ao]?\s+pausa|senza\s+pausa|no\s+pausa|zero\s+pausa|non\s+ho\s+fatto\s+pausa/i.test(ub);
}

/**
 * @param {{ forceIfSaveConfirm?: boolean, userBlob?: string }} [opts]
 * @returns {boolean}
 */
export function segnaOreDomReadyForTonySave(opts) {
  opts = opts || {};
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  var target = resolveSegnaOreTargetWindow();
  if (!target) return false;
  var state = readSegnaOreDomState(target);
  if (!state) return false;

  if (target.formKind === 'ora-modal' && !state.modalActive) return false;

  var lavoroEl = getSegnaOreLavoroElement(target.doc, target.formKind);
  if (lavoroEl && !String(lavoroEl.value || '').trim()) return false;

  if (!state.dateVal || !state.startVal || !state.endVal) return false;

  if (opts.forceIfSaveConfirm) return true;

  var brNum = 0;
  if (state.pauseVal !== '') {
    var bp = parseInt(state.pauseVal, 10);
    brNum = Number.isFinite(bp) ? bp : 0;
  }
  if (brNum > 0) return true;

  try {
    if (window.__tonyQuickHoursPauseAckAt &&
        (Date.now() - window.__tonyQuickHoursPauseAckAt) < 30 * 60 * 1000) {
      return true;
    }
  } catch (eFl) { /* ignore */ }

  var ub = opts.userBlob != null ? String(opts.userBlob).trim() : '';
  if (!ub) {
    try {
      if (typeof sessionStorage !== 'undefined') {
        ub = String(sessionStorage.getItem('tony_last_user_message') || '').trim();
      }
    } catch (eS) { /* ignore */ }
  }
  if (!ub && typeof window !== 'undefined' && window.__tonyLastUserMessage) {
    ub = String(window.__tonyLastUserMessage).trim();
  }
  return userBlobAcknowledgesZeroPause(ub);
}

/**
 * Apre slide ore (mobile) o modal Segna ora (desktop) se necessario.
 * @param {SegnaOreTarget} target
 * @returns {Promise<boolean>}
 */
export async function ensureSegnaOreUiVisible(target) {
  if (!target || !target.window) return false;
  if (target.formKind === 'quick-hours') {
    try {
      if (typeof target.window.gfvFieldWorkspaceGoToHoursSlide === 'function') {
        target.window.gfvFieldWorkspaceGoToHoursSlide();
      }
    } catch (eSl) { /* ignore */ }
    return !!target.doc.getElementById('quick-hours-form');
  }
  var modal = target.doc.getElementById('ora-modal');
  if (modal && modal.classList.contains('active')) return true;
  if (typeof target.window.openSegnaOraModal === 'function') {
    try {
      await target.window.openSegnaOraModal(null);
      await delayMs(500);
    } catch (eOpen) {
      return false;
    }
    modal = target.doc.getElementById('ora-modal');
    return !!(modal && modal.classList.contains('active'));
  }
  return false;
}

/**
 * Su pagina segnatura desktop: apre il modal se il form esiste ma non è visibile.
 * @returns {Promise<SegnaOreTarget|null>}
 */
export async function resolveOrOpenSegnaOreTarget() {
  var target = resolveSegnaOreTargetWindow();
  if (target && target.formKind === 'ora-modal') {
    var modalEl = target.doc.getElementById('ora-modal');
    if (!modalEl || !modalEl.classList.contains('active')) {
      var ok = await ensureSegnaOreUiVisible(target);
      if (!ok) return null;
      return resolveSegnaOreTargetWindow();
    }
  }
  if (target) return target;
  if (typeof window !== 'undefined' && typeof window.openSegnaOraModal === 'function' &&
      window.document.getElementById('ora-form')) {
    target = { window: window, formKind: 'ora-modal', doc: window.document };
    var opened = await ensureSegnaOreUiVisible(target);
    return opened ? resolveSegnaOreTargetWindow() : null;
  }
  return null;
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delayMs(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

/**
 * Compat: finestra che contiene un form segna ore (mobile o desktop).
 * @returns {Window|null}
 */
export function resolveSegnaOreWindowOnly() {
  var t = resolveSegnaOreTargetWindow();
  return t ? t.window : null;
}

if (typeof window !== 'undefined') {
  window.TonySegnaOraLocalEngine = {
    SEGNA_ORE_ASK_FALLBACK,
    resolveSegnaOreTargetWindow,
    resolveSegnaOreWindowOnly,
    readSegnaOreDomState,
    buildSegnaOreMissingFieldsMessage,
    listSegnaOreMissingRequired,
    segnaOreDomReadyForTonySave,
    ensureSegnaOreUiVisible,
    resolveOrOpenSegnaOreTarget,
    getSegnaOreDomFieldIds,
    getSegnaOreLavoroElement,
    userBlobAcknowledgesZeroPause,
    extractSegnaOrePauseMinutesFromUserBlob,
    userBlobMentionsSegnaOrePause,
  };
}
