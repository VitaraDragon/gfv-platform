/**
 * Lock preventivi — funzioni pure, senza I/O.
 * Numero: PREV-{anno}-{seq padded}; accettazione: solo bozza/inviato e non scaduto.
 *
 * @module modules/conto-terzi/services/preventivo-lock-utils
 */

export const PREVENTIVO_SEQ_FIELD = 'preventivoSeqByYear';

/**
 * @param {Date} [now]
 * @returns {number}
 */
export function preventivoAnnoCorrente(now = new Date()) {
  return now.getFullYear();
}

/**
 * @param {number} anno
 * @param {number} seq
 * @returns {string}
 */
export function formatPreventivoNumero(anno, seq) {
  const year = Number(anno);
  const n = Number(seq);
  if (!Number.isFinite(year) || !Number.isFinite(n) || n < 1) {
    throw new Error('Numero preventivo non valido');
  }
  return `PREV-${year}-${String(n).padStart(3, '0')}`;
}

/**
 * @param {string} numero
 * @returns {{ anno: number, seq: number } | null}
 */
export function parsePreventivoNumero(numero) {
  const match = String(numero || '').match(/^PREV-(\d{4})-(\d+)$/);
  if (!match) return null;
  return { anno: parseInt(match[1], 10), seq: parseInt(match[2], 10) };
}

/**
 * @param {string[]} numeri
 * @param {number} anno
 * @returns {number}
 */
export function maxSeqFromNumeri(numeri, anno) {
  const year = Number(anno);
  let max = 0;
  if (!Array.isArray(numeri)) return 0;
  for (const n of numeri) {
    const parsed = parsePreventivoNumero(n);
    if (parsed && parsed.anno === year && parsed.seq > max) max = parsed.seq;
  }
  return max;
}

/**
 * Prossimo seq: max(contatore tenant, max già in collection) + 1.
 * Gap ammessi (allocazione riuscita, create fallita).
 * @param {*} storedSeq
 * @param {*} maxExistingSeq
 * @returns {number}
 */
export function nextPreventivoSeq(storedSeq, maxExistingSeq) {
  const stored = Number(storedSeq);
  const existing = Number(maxExistingSeq);
  const a = Number.isFinite(stored) ? stored : 0;
  const b = Number.isFinite(existing) ? existing : 0;
  return Math.max(a, b) + 1;
}

/**
 * Race senza lock: ogni writer calcola lo stesso max+1.
 * @param {number} maxExisting
 * @param {number} concurrentCount
 * @returns {number[]}
 */
export function lastWriteWinsNumeri(maxExisting, concurrentCount) {
  const next = (Number(maxExisting) || 0) + 1;
  const n = Number(concurrentCount) || 0;
  return Array.from({ length: n }, () => next);
}

/**
 * Transazioni serializzate sul contatore: numeri distinti.
 * @param {number} maxExisting
 * @param {number} concurrentCount
 * @param {number} [storedSeq]
 * @returns {number[]}
 */
export function lockedNumeri(maxExisting, concurrentCount, storedSeq = 0) {
  const out = [];
  let stored = Number(storedSeq) || 0;
  const existing = Number(maxExisting) || 0;
  const n = Number(concurrentCount) || 0;
  for (let i = 0; i < n; i++) {
    const seq = nextPreventivoSeq(stored, existing);
    out.push(seq);
    stored = seq;
  }
  return out;
}

/**
 * @param {*} value
 * @returns {Date|null}
 */
export function toPreventivoDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value.toDate === 'function') {
    try {
      const d = value.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    } catch (_) {
      return null;
    }
  }
  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Stesso predicato di Preventivo.canBeAccepted().
 * @param {string} stato
 * @param {*} dataScadenza
 * @param {Date} [now]
 * @returns {boolean}
 */
export function preventivoPuoEssereAccettato(stato, dataScadenza, now = new Date()) {
  if (!['inviato', 'bozza'].includes(stato)) return false;
  const scadenza = toPreventivoDate(dataScadenza);
  if (!scadenza) return true;
  return now <= scadenza;
}

/**
 * @param {string} metodo 'email' | 'manager'
 * @returns {string}
 */
export function statoAccettazione(metodo) {
  return metodo === 'email' ? 'accettato_email' : 'accettato_manager';
}

/**
 * @param {string} stato
 * @param {*} dataScadenza
 * @param {'accetta'|'rifiuta'} azione
 * @param {string} [metodo]
 * @param {Date} [now]
 * @returns {{ ok: true, patch: Object } | { ok: false, reason: string }}
 */
export function decideTransizionePreventivo(stato, dataScadenza, azione, metodo = 'manager', now = new Date()) {
  const verb = azione === 'rifiuta' ? 'rifiutato' : 'accettato';
  if (!preventivoPuoEssereAccettato(stato, dataScadenza, now)) {
    return { ok: false, reason: `Preventivo non può essere ${verb} (stato o scaduto)` };
  }
  if (azione === 'rifiuta') {
    return { ok: true, patch: { stato: 'rifiutato' } };
  }
  if (azione !== 'accetta') {
    return { ok: false, reason: 'Azione non valida' };
  }
  return {
    ok: true,
    patch: {
      stato: statoAccettazione(metodo),
      dataAccettazione: now
    }
  };
}

/**
 * Simula writer serializzati (come Firestore runTransaction sullo stesso doc).
 * @param {{ stato: string, dataScadenza?: * }} initial
 * @param {Array<{ azione: string, metodo?: string }>} actions
 * @param {Date} [now]
 * @returns {{ stato: string, outcomes: Array<{ ok: boolean, stato?: string, reason?: string }> }}
 */
export function applySerializedTransitions(initial, actions, now = new Date()) {
  let stato = initial && initial.stato;
  const dataScadenza = initial && initial.dataScadenza;
  const outcomes = [];
  for (const action of actions || []) {
    const decision = decideTransizionePreventivo(
      stato,
      dataScadenza,
      action.azione,
      action.metodo || 'manager',
      now
    );
    if (decision.ok) {
      stato = decision.patch.stato;
      outcomes.push({ ok: true, stato });
    } else {
      outcomes.push({ ok: false, reason: decision.reason });
    }
  }
  return { stato, outcomes };
}

/**
 * Race get+update senza check: entrambi “vincono”, resta l’ultimo write.
 * @param {Array<{ stato: string }>} writes
 * @returns {string|null}
 */
export function lastWriteWinsStato(writes) {
  if (!Array.isArray(writes) || !writes.length) return null;
  return writes[writes.length - 1].stato;
}

/**
 * Snapshot client (exists()) vs Admin (exists boolean).
 * @param {*} snap
 * @returns {boolean}
 */
export function firestoreSnapExists(snap) {
  if (!snap) return false;
  if (typeof snap.exists === 'function') return snap.exists();
  return snap.exists === true;
}
