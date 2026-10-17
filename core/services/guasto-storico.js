/**
 * Storico e patch del segnalatore. Le chiavi stanno nell'elenco delle rules
 * (stato, dettagli, noteRisoluzione, costoRiparazione, risolto, risoltoDa,
 * risoltoIl, annullatoDa, annullatoIl, storico, noteAggiuntive, updatedAt).
 * `il` è una Date: serverTimestamp() non funziona dentro un array.
 * @module core/services/guasto-storico
 */

/**
 * @param {{ azione: string, uid: string, now: Date, nota?: string|null }} input
 * @returns {{ azione: string, da: string, il: Date, nota: string|null }}
 */
export function buildVoceStorico({ azione, uid, now, nota } = {}) {
  const testo = String(nota == null ? '' : nota).trim();
  return {
    azione,
    da: uid,
    il: now,
    nota: testo || null
  };
}

/**
 * Nuovo array. Se lo storico non è un array, parte da vuoto.
 * Non modifica l'array originale.
 * @param {unknown} storico
 * @param {object} voce
 * @returns {object[]}
 */
export function aggiungiVoceStorico(storico, voce) {
  const base = Array.isArray(storico) ? storico.slice() : [];
  base.push(voce);
  return base;
}

/**
 * @param {{ uid: string, now: Date, nota?: string|null, storico?: unknown }} input
 */
export function buildAnnullaPatch({ uid, now, nota, storico } = {}) {
  return {
    stato: 'annullato',
    annullatoDa: uid,
    annullatoIl: now,
    storico: aggiungiVoceStorico(storico, buildVoceStorico({
      azione: 'annullato',
      uid,
      now,
      nota
    })),
    updatedAt: now
  };
}

function costoAccettato(costo) {
  if (typeof costo === 'number') {
    return Number.isFinite(costo) && costo >= 0 ? costo : undefined;
  }
  if (typeof costo === 'string') {
    const testo = costo.trim();
    if (!testo) return undefined;
    const n = Number(testo);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }
  return undefined;
}

/**
 * La nota è obbligatoria. Il costo resta solo se è un numero ≥ 0 (lo zero si tiene).
 * @param {{ uid: string, now: Date, nota?: string|null, costo?: unknown, storico?: unknown }} input
 * @returns {{ ok: true, patch: object }|{ ok: false, errore: string }}
 */
export function buildRisoltoDaMePatch({ uid, now, nota, costo, storico } = {}) {
  const testo = String(nota == null ? '' : nota).trim();
  if (!testo) return { ok: false, errore: 'nota-vuota' };
  const patch = {
    stato: 'risolto',
    risolto: true,
    risoltoDa: uid,
    risoltoIl: now,
    noteRisoluzione: testo,
    storico: aggiungiVoceStorico(storico, buildVoceStorico({
      azione: 'risolto_da_segnalatore',
      uid,
      now,
      nota: testo
    })),
    updatedAt: now
  };
  const costoOk = costoAccettato(costo);
  if (costoOk !== undefined) patch.costoRiparazione = costoOk;
  return { ok: true, patch };
}
