/**
 * Utility condivise per comunicazioni caposquadra → operai (match ID, destinatari).
 */

/**
 * @param {unknown} entry
 * @returns {string|null}
 */
export function normalizeOperaioIdFromSquadraEntry(entry) {
    if (entry == null || entry === '') return null;
    if (typeof entry === 'string') return entry.trim() || null;
    if (typeof entry === 'object') {
        const o = /** @type {Record<string, unknown>} */ (entry);
        const id = o.id || o.uid || o.operaioId || o.userId;
        return id != null ? String(id).trim() || null : null;
    }
    return null;
}

/**
 * @param {unknown} destinatari
 * @returns {string[]}
 */
export function normalizeDestinatariIds(destinatari) {
    if (!Array.isArray(destinatari)) return [];
    const ids = new Set();
    destinatari.forEach((entry) => {
        const id = normalizeOperaioIdFromSquadraEntry(entry);
        if (id) ids.add(id);
    });
    return Array.from(ids);
}

/**
 * @param {import('firebase/auth').User | null | undefined} authUser
 * @param {Record<string, unknown> | null | undefined} userData
 * @returns {string[]}
 */
export function resolveManodoperaUserIds(authUser, userData) {
    const ids = new Set();
    if (authUser && authUser.uid) ids.add(String(authUser.uid));
    if (userData) {
        if (userData.id) ids.add(String(userData.id));
        if (userData.uid) ids.add(String(userData.uid));
    }
    return Array.from(ids);
}

/**
 * @param {import('firebase/auth').User | null | undefined} authUser
 * @param {Record<string, unknown> | null | undefined} userData
 * @returns {string}
 */
export function primaryManodoperaUserId(authUser, userData) {
    const ids = resolveManodoperaUserIds(authUser, userData);
    return ids[0] || '';
}

/**
 * @param {unknown} destinatari
 * @param {import('firebase/auth').User | null | undefined} authUser
 * @param {Record<string, unknown> | null | undefined} userData
 * @returns {boolean}
 */
export function destinatariIncludesUser(destinatari, authUser, userData) {
    const normalized = normalizeDestinatariIds(destinatari);
    if (!normalized.length) return false;
    const mine = new Set(resolveManodoperaUserIds(authUser, userData));
    return normalized.some((d) => mine.has(d));
}

/**
 * @param {unknown} conferme
 * @param {import('firebase/auth').User | null | undefined} authUser
 * @param {Record<string, unknown> | null | undefined} userData
 * @returns {boolean}
 */
export function confermeIncludesUser(conferme, authUser, userData) {
    if (!Array.isArray(conferme) || conferme.length === 0) return false;
    const mine = new Set(resolveManodoperaUserIds(authUser, userData));
    return conferme.some((c) => {
        if (c && typeof c === 'object' && c.userId) return mine.has(String(c.userId));
        if (typeof c === 'string') return mine.has(c);
        return false;
    });
}

/**
 * ID caposquadra per query Firestore (prova uid e userData.id).
 * @param {import('firebase/auth').User | null | undefined} authUser
 * @param {Record<string, unknown> | null | undefined} userData
 * @returns {string[]}
 */
export function caposquadraIdsForQuery(authUser, userData) {
    return resolveManodoperaUserIds(authUser, userData);
}

/**
 * @param {Date | null | undefined} dataCom
 * @returns {boolean}
 */
export function isComunicazioneAttivaPerData(dataCom) {
    if (!dataCom || Number.isNaN(dataCom.getTime())) return true;
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const giornoComm = new Date(dataCom);
    giornoComm.setHours(0, 0, 0, 0);
    const limitePassato = new Date(oggi);
    limitePassato.setDate(limitePassato.getDate() - 60);
    return giornoComm >= limitePassato;
}

/**
 * Visibilità per operaio: destinatario esplicito, oppure invio legacy senza destinatari
 * ma dal proprio caposquadra.
 * @param {Record<string, unknown>} comm
 * @param {import('firebase/auth').User | null | undefined} authUser
 * @param {Record<string, unknown> | null | undefined} userData
 * @param {string|null|undefined} caposquadraIdOperaio
 */
export function comunicazioneVisibilePerOperaio(comm, authUser, userData, caposquadraIdOperaio, operaioLavoroIds) {
    if (!comm || typeof comm !== 'object') return false;
    const destIds = normalizeDestinatariIds(comm.destinatari);
    if (destIds.length > 0) {
        return destinatariIncludesUser(comm.destinatari, authUser, userData);
    }
    const lavoroId = comm.lavoroId != null ? String(comm.lavoroId) : '';
    if (lavoroId && Array.isArray(operaioLavoroIds) && operaioLavoroIds.includes(lavoroId)) {
        return true;
    }
    if (!comm.caposquadraId) return false;
    const capiRaw = Array.isArray(caposquadraIdOperaio)
        ? caposquadraIdOperaio
        : (caposquadraIdOperaio ? [caposquadraIdOperaio] : []);
    if (!capiRaw.length) return false;
    const commCapo = String(comm.caposquadraId);
    return capiRaw.some((capoId) => {
        const mioCapo = new Set(resolveManodoperaUserIds(
            { uid: String(capoId) },
            { id: String(capoId) }
        ));
        return mioCapo.has(commCapo);
    });
}

/**
 * Titolo luogo per card comunicazione (dashboard / mobile).
 * @param {Record<string, unknown>} comm
 * @returns {string}
 */
export function formatComunicazioneLuogo(comm) {
    if (!comm || typeof comm !== 'object') return 'Comunicazione';
    const podere = comm.podere ? String(comm.podere).trim() : '';
    const terreno = comm.terreno ? String(comm.terreno).trim() : '';
    if (podere && terreno) return `${podere} - ${terreno}`;
    if (comm.lavoroNome) return String(comm.lavoroNome);
    if (terreno) return terreno;
    if (podere) return podere;
    return 'Comunicazione squadra';
}

/**
 * Corpo testo comunicazione.
 * @param {Record<string, unknown>} comm
 * @returns {string}
 */
export function formatComunicazioneTesto(comm) {
    if (!comm || typeof comm !== 'object') return '';
    const messaggio = comm.messaggio ? String(comm.messaggio).trim() : '';
    const note = comm.note ? String(comm.note).trim() : '';
    return messaggio || note || '';
}

/**
 * @param {Record<string, unknown>} row
 * @returns {number}
 */
export function countConfermePendentiInvio(row) {
    const dest = normalizeDestinatariIds(row.destinatari).length;
    const conf = Array.isArray(row.conferme) ? row.conferme.length : 0;
    return Math.max(0, dest - conf);
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {'dataCom'|'createdAt'} dateKey
 * @returns {Array<Record<string, unknown>>}
 */
export function sortComunicazioniDesc(rows, dateKey = 'dataCom') {
    return [...rows].sort((a, b) => {
        const ad = dateKey === 'createdAt'
            ? (a.createdAt && typeof a.createdAt === 'object' && typeof a.createdAt.toDate === 'function'
                ? a.createdAt.toDate()
                : null)
            : (a.dataCom instanceof Date ? a.dataCom : null);
        const bd = dateKey === 'createdAt'
            ? (b.createdAt && typeof b.createdAt === 'object' && typeof b.createdAt.toDate === 'function'
                ? b.createdAt.toDate()
                : null)
            : (b.dataCom instanceof Date ? b.dataCom : null);
        return (bd?.getTime?.() || 0) - (ad?.getTime?.() || 0);
    });
}

/**
 * @param {Array<{ haConfermato?: boolean }>} rows
 * @returns {{ pending: Array<unknown>, history: Array<unknown> }}
 */
export function partitionComunicazioniRicevuteOperaio(rows) {
    const pending = rows.filter((r) => !r.haConfermato);
    const history = rows.filter((r) => r.haConfermato);
    return {
        pending: sortComunicazioniDesc(pending, 'dataCom'),
        history: sortComunicazioniDesc(history, 'dataCom'),
    };
}

/**
 * Invio caposquadra ancora rilevante (conferme mancanti o invio legacy recente).
 * @param {Record<string, unknown>} row
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isComunicazioneInviataInEvidenzaCapo(row, now = new Date()) {
    if (row.stato && row.stato !== 'attiva') return false;
    const dest = normalizeDestinatariIds(row.destinatari).length;
    if (dest > 0) return countConfermePendentiInvio(row) > 0;
    const created = row.createdAt && typeof row.createdAt === 'object' && typeof row.createdAt.toDate === 'function'
        ? row.createdAt.toDate()
        : null;
    if (!created) return true;
    return (now.getTime() - created.getTime()) <= (7 * 86400000);
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {Date} [now]
 * @returns {{ inEvidenza: Array<unknown>, storico: Array<unknown> }}
 */
export function partitionComunicazioniInviateCapo(rows, now = new Date()) {
    const inEvidenza = [];
    const storico = [];
    rows.forEach((row) => {
        if (isComunicazioneInviataInEvidenzaCapo(row, now)) inEvidenza.push(row);
        else storico.push(row);
    });
    return {
        inEvidenza: sortComunicazioniDesc(inEvidenza, 'createdAt'),
        storico: sortComunicazioniDesc(storico, 'createdAt'),
    };
}

/**
 * Nome visualizzato per operaio/caposquadra (ore, validazione, liste).
 * @param {Record<string, unknown> | null | undefined} userData
 * @returns {string}
 */
export function formatManodoperaDisplayName(userData) {
    if (!userData || typeof userData !== 'object') return 'N/A';
    const nome = `${userData.nome || ''} ${userData.cognome || ''}`.trim();
    const email = userData.email ? String(userData.email).trim() : '';
    return nome || email || 'N/A';
}

/**
 * Indicizza un utente manodopera per doc id, userData.id e uid (lookup ore.operaioId).
 * @param {Map<string, Record<string, unknown>>} map
 * @param {string} docId
 * @param {Record<string, unknown>} data
 */
export function indexManodoperaUserInMap(map, docId, data) {
    const entry = { id: docId, ...data };
    resolveManodoperaUserIds({ uid: docId }, entry).forEach((id) => {
        if (id) map.set(String(id), entry);
    });
}

/**
 * @param {Map<string, Record<string, unknown>>} map
 * @param {string | null | undefined} operaioId
 * @returns {string}
 */
export function getManodoperaDisplayNameFromMap(map, operaioId) {
    if (!operaioId) return 'N/A';
    const user = map.get(String(operaioId));
    return formatManodoperaDisplayName(user);
}
