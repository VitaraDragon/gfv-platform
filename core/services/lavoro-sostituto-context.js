/**
 * Contesto assenza/sostituto su lavoro (lettura per UI campo).
 * Include slice giornaliero `equipaggioGiorno` per lavori di squadra.
 * @module core/services/lavoro-sostituto-context
 */

/**
 * @param {Object|null} lavoro
 * @param {string} [giornoKey]
 * @returns {{ assenti: string[], sostituzioni: Object[], prestitiUscita: Object[] }}
 */
export function getEquipaggioGiorno(lavoro, giornoKey) {
  if (!lavoro?.equipaggioGiorno || !giornoKey) {
    return { assenti: [], sostituzioni: [], prestitiUscita: [] };
  }
  const slice = lavoro.equipaggioGiorno[giornoKey] || {};
  return {
    assenti: [...(slice.assenti || [])],
    sostituzioni: [...(slice.sostituzioni || [])],
    prestitiUscita: [...(slice.prestitiUscita || [])]
  };
}

/**
 * @param {Object|null} lavoro
 * @returns {{ assenteId: string|null, sostitutoId: string|null }}
 */
export function getAssenzaSostitutoIds(lavoro) {
  if (!lavoro) return { assenteId: null, sostitutoId: null };
  let assenteId =
    lavoro.assenzaOperaioAssenteId ||
    lavoro.standbyOperaioId ||
    null;
  let sostitutoId = lavoro.assenzaSostitutoOperaioId || null;

  // Fallback: ultima sostituzione nel roster giornaliero (squadra)
  if (!sostitutoId && lavoro.equipaggioGiorno) {
    const keys = Object.keys(lavoro.equipaggioGiorno).sort();
    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      const slice = getEquipaggioGiorno(lavoro, lastKey);
      const last = slice.sostituzioni[slice.sostituzioni.length - 1];
      if (last) {
        sostitutoId = last.sostitutoOperaioId || sostitutoId;
        assenteId = last.assenteOperaioId || assenteId;
      }
    }
  }

  return { assenteId, sostitutoId };
}

/**
 * @param {Object|null} lavoro
 * @returns {boolean}
 */
export function lavoroHaSostitutoAttivo(lavoro) {
  return Boolean(getAssenzaSostitutoIds(lavoro).sostitutoId);
}

/**
 * @param {string} userId
 * @param {Object|null} lavoro
 * @returns {boolean}
 */
export function isOperaioSostitutoSuLavoro(userId, lavoro) {
  if (!userId || !lavoro) return false;
  return getAssenzaSostitutoIds(lavoro).sostitutoId === userId;
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} userId
 * @returns {Promise<string>}
 */
export async function resolveOperaioDisplayName(db, userId) {
  if (!db || !userId) return '';
  try {
    const { doc, getDoc } = await import('./firebase-service.js');
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return userId;
    const u = snap.data();
    return [u.nome, u.cognome].filter(Boolean).join(' ') || u.email || userId;
  } catch {
    return userId;
  }
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {Object|null} lavoro
 * @returns {Promise<{ assenteId: string|null, sostitutoId: string|null, assenteNome: string, sostitutoNome: string }>}
 */
export async function resolveAssenzaSostitutoDisplay(db, lavoro) {
  const ids = getAssenzaSostitutoIds(lavoro);
  const [assenteNome, sostitutoNome] = await Promise.all([
    ids.assenteId ? resolveOperaioDisplayName(db, ids.assenteId) : Promise.resolve(''),
    ids.sostitutoId ? resolveOperaioDisplayName(db, ids.sostitutoId) : Promise.resolve('')
  ]);
  return { ...ids, assenteNome, sostitutoNome };
}
