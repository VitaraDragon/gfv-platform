/**
 * Policy anti-invasività briefing proattivo Tony (§15.5).
 * Fasce mattina/pomeriggio/sera + fingerprint segnali + messaggi delta.
 * Fingerprint keys/labels da catalogo §15.6 (`tony-proactive-signals`).
 * Pure helpers testabili — nessuna dipendenza DOM/Tony.
 * @module core/js/tony-proactive-briefing-policy
 */

import {
  getProactiveSignalIds,
  getProactiveSignalLabels,
} from '../config/tony-proactive-signals.js';

export const PROACTIVE_BRIEFING_STORAGE_PREFIX = 'tony.proactiveBriefing.v1:';

/** @typedef {'mattina'|'pomeriggio'|'sera'} ProactiveFascia */

/** @typedef {Record<string, number>} ProactiveFingerprint */

/** @typedef {{
 *   dayKey: string,
 *   fasciaFull: Record<ProactiveFascia, boolean>,
 *   fingerprint: ProactiveFingerprint|null
 * }} ProactiveBriefingState */

/** @deprecated usare getProactiveSignalIds — mantenuto per test legacy */
export const PROACTIVE_SIGNAL_KEYS = getProactiveSignalIds();

/**
 * @param {string} tenantId
 * @returns {string}
 */
export function proactiveBriefingStorageKey(tenantId) {
  return PROACTIVE_BRIEFING_STORAGE_PREFIX + String(tenantId || '').trim();
}

/**
 * @param {Date} [now]
 * @returns {string} YYYY-MM-DD locale
 */
export function proactiveDayKey(now) {
  const d = now instanceof Date ? now : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/**
 * Fasce: mattina 05–12, pomeriggio 12–18, sera 18–24 e 00–05.
 * @param {Date} [now]
 * @returns {ProactiveFascia}
 */
export function proactiveFasciaForDate(now) {
  const d = now instanceof Date ? now : new Date();
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'mattina';
  if (h >= 12 && h < 18) return 'pomeriggio';
  return 'sera';
}

/**
 * @param {Partial<ProactiveFingerprint>|null|undefined} raw
 * @param {string[]|null|undefined} [signalIds]
 * @returns {ProactiveFingerprint}
 */
export function normalizeProactiveFingerprint(raw, signalIds) {
  const ids =
    Array.isArray(signalIds) && signalIds.length
      ? signalIds
      : getProactiveSignalIds();
  /** @type {ProactiveFingerprint} */
  const base = {};
  ids.forEach(function (k) {
    base[k] = 0;
  });
  if (!raw || typeof raw !== 'object') return base;
  ids.forEach(function (k) {
    const n = Number(raw[k]);
    base[k] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  });
  return base;
}

/**
 * @returns {ProactiveFingerprint}
 */
export function emptyProactiveFingerprint(signalIds) {
  return normalizeProactiveFingerprint(null, signalIds);
}

/**
 * @param {object|null|undefined} briefing  tonyGlobalBriefing / fingerprint-like
 * @returns {ProactiveFingerprint}
 */
export function buildProactiveFingerprintFromBriefing(briefing) {
  const b = briefing && typeof briefing === 'object' ? briefing : {};
  return normalizeProactiveFingerprint({
    oreDaValidare: b.oreDaValidare,
    lavoriInCorso: b.lavoriInCorso,
    lavoriDaPianificare: b.lavoriDaPianificare,
    preventiviAperti: b.preventiviAperti,
    prodottiDaCompletare: b.prodottiDaCompletare,
    prezziInAttesa: b.prezziInAttesa,
    sottoScorta: b.sottoScorta,
    scadenzeUrgenti: b.scadenzeUrgenti,
    guastiAperti: b.guastiAperti,
    vendemmieIncomplete: b.vendemmieIncomplete,
    raccolteIncomplete: b.raccolteIncomplete,
    meteoConsigli:
      b.meteoConsigliCount != null ? b.meteoConsigliCount : b.meteoConsigli,
  });
}

/**
 * @param {ProactiveFingerprint} fp
 * @param {string[]|null|undefined} [signalIds]
 * @returns {number}
 */
export function proactiveFingerprintTotal(fp, signalIds) {
  const n = normalizeProactiveFingerprint(fp, signalIds);
  const ids =
    Array.isArray(signalIds) && signalIds.length
      ? signalIds
      : getProactiveSignalIds();
  return ids.reduce(function (sum, id) {
    return sum + (n[id] || 0);
  }, 0);
}

/**
 * @param {ProactiveFingerprint|null|undefined} prev
 * @param {ProactiveFingerprint|null|undefined} next
 * @param {string[]|null|undefined} [signalIds]
 * @returns {Array<{ id: string, from: number, to: number }>}
 */
export function computeProactiveDelta(prev, next, signalIds) {
  const a = normalizeProactiveFingerprint(prev, signalIds);
  const b = normalizeProactiveFingerprint(next, signalIds);
  const ids =
    Array.isArray(signalIds) && signalIds.length
      ? signalIds
      : getProactiveSignalIds();
  const out = [];
  ids.forEach(function (id) {
    if (b[id] > a[id]) {
      out.push({ id: id, from: a[id], to: b[id] });
    }
  });
  return out;
}

/**
 * @param {Array<{ id: string, from: number, to: number }>} delta
 * @returns {string}
 */
export function formatProactiveDeltaMessage(delta) {
  const list = Array.isArray(delta) ? delta : [];
  if (list.length === 0) return '';
  const parts = list.map(function (item) {
    const labels = getProactiveSignalLabels(item.id);
    const n = item.to;
    const label = n === 1 ? labels.singular : labels.plural;
    if (item.from <= 0) {
      return n + ' ' + label;
    }
    return label + ' (da ' + item.from + ' a ' + n + ')';
  });
  if (parts.length === 1) {
    return 'La situazione è un po\' cambiata: c\'è da considerare anche ' + parts[0] + '.';
  }
  const last = parts[parts.length - 1];
  const head = parts.slice(0, -1).join(', ');
  return (
    'La situazione è un po\' cambiata: c\'è da considerare anche ' +
    head +
    ' e ' +
    last +
    '.'
  );
}

/**
 * @returns {ProactiveBriefingState}
 */
export function createEmptyProactiveBriefingState(dayKey) {
  return {
    dayKey: dayKey || '',
    fasciaFull: { mattina: false, pomeriggio: false, sera: false },
    fingerprint: null,
  };
}

/**
 * @param {unknown} raw
 * @param {string} [dayKeyNow]
 * @returns {ProactiveBriefingState}
 */
export function normalizeProactiveBriefingState(raw, dayKeyNow) {
  const day = dayKeyNow || proactiveDayKey();
  const empty = createEmptyProactiveBriefingState(day);
  if (!raw || typeof raw !== 'object') return empty;
  const storedDay = String(raw.dayKey || '').trim();
  if (storedDay !== day) return empty;
  const ff = raw.fasciaFull && typeof raw.fasciaFull === 'object' ? raw.fasciaFull : {};
  return {
    dayKey: day,
    fasciaFull: {
      mattina: !!ff.mattina,
      pomeriggio: !!ff.pomeriggio,
      sera: !!ff.sera,
    },
    fingerprint: raw.fingerprint != null ? normalizeProactiveFingerprint(raw.fingerprint) : null,
  };
}

/**
 * Decide azione proattiva senza mutare lo state passato.
 * @param {ProactiveBriefingState|null|undefined} state
 * @param {Date} now
 * @param {ProactiveFingerprint|null|undefined} fingerprint
 * @param {{ signalIds?: string[], allowIdle?: boolean }} [opts]
 */
export function decideProactiveBriefingAction(state, now, fingerprint, opts) {
  opts = opts || {};
  const signalIds = opts.signalIds;
  const allowIdle = opts.allowIdle !== false;
  const dayKey = proactiveDayKey(now);
  const fascia = proactiveFasciaForDate(now);
  const fp = normalizeProactiveFingerprint(fingerprint, signalIds);
  const total = proactiveFingerprintTotal(fp, signalIds);
  const current = normalizeProactiveBriefingState(state, dayKey);
  const worsened = computeProactiveDelta(current.fingerprint, fp, signalIds);

  /** @type {'full'|'delta'|'silence'} */
  let action = 'silence';
  const fullAlready = !!current.fasciaFull[fascia];

  if (!fullAlready) {
    action = 'full';
  } else if (worsened.length > 0) {
    action = 'delta';
  }

  if (action === 'full' && total === 0 && !allowIdle) {
    action = 'silence';
  }

  const nextState = {
    dayKey: dayKey,
    fasciaFull: {
      mattina: current.fasciaFull.mattina,
      pomeriggio: current.fasciaFull.pomeriggio,
      sera: current.fasciaFull.sera,
    },
    fingerprint: current.fingerprint,
  };

  if (action === 'full') {
    nextState.fasciaFull[fascia] = true;
    nextState.fingerprint = fp;
  } else if (action === 'delta') {
    nextState.fingerprint = fp;
  }

  return {
    action: action,
    fascia: fascia,
    dayKey: dayKey,
    worsened: worsened,
    allowIdleFull: action === 'full' && total === 0 && allowIdle,
    nextState: nextState,
  };
}

/**
 * @param {Storage|null|undefined} storage
 * @param {string} tenantId
 * @param {Date} [now]
 * @param {{ storageKey?: string }} [opts]
 * @returns {ProactiveBriefingState}
 */
export function loadProactiveBriefingState(storage, tenantId, now, opts) {
  const dayKey = proactiveDayKey(now);
  if (!storage || !tenantId) return createEmptyProactiveBriefingState(dayKey);
  try {
    const key =
      (opts && opts.storageKey) || proactiveBriefingStorageKey(tenantId);
    const raw = storage.getItem(key);
    if (!raw) return createEmptyProactiveBriefingState(dayKey);
    return normalizeProactiveBriefingState(JSON.parse(raw), dayKey);
  } catch (e) {
    return createEmptyProactiveBriefingState(dayKey);
  }
}

/**
 * @param {Storage|null|undefined} storage
 * @param {string} tenantId
 * @param {ProactiveBriefingState} state
 * @param {{ storageKey?: string }} [opts]
 * @returns {boolean}
 */
export function saveProactiveBriefingState(storage, tenantId, state, opts) {
  if (!storage || !tenantId || !state) return false;
  try {
    const key =
      (opts && opts.storageKey) || proactiveBriefingStorageKey(tenantId);
    const payload = {
      dayKey: state.dayKey,
      fasciaFull: {
        mattina: !!(state.fasciaFull && state.fasciaFull.mattina),
        pomeriggio: !!(state.fasciaFull && state.fasciaFull.pomeriggio),
        sera: !!(state.fasciaFull && state.fasciaFull.sera),
      },
      fingerprint: state.fingerprint != null ? normalizeProactiveFingerprint(state.fingerprint) : null,
    };
    storage.setItem(key, JSON.stringify(payload));
    return true;
  } catch (e) {
    return false;
  }
}
