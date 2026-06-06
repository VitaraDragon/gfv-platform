/**
 * Contesto assenza/sostituto su lavoro (lettura per UI campo).
 * @module core/services/lavoro-sostituto-context
 */

/**
 * @param {Object|null} lavoro
 * @returns {{ assenteId: string|null, sostitutoId: string|null }}
 */
export function getAssenzaSostitutoIds(lavoro) {
  if (!lavoro) return { assenteId: null, sostitutoId: null };
  return {
    assenteId:
      lavoro.assenzaOperaioAssenteId ||
      lavoro.standbyOperaioId ||
      null,
    sostitutoId: lavoro.assenzaSostitutoOperaioId || null
  };
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
