/**
 * Caricamento lavori per ruoli campo (operaio / caposquadra) senza scaricare
 * l'intera collection lavori. Stesso criterio usato in segnatura / lavori caposquadra.
 */

import { collection, getDocs, query, where } from './firebase-service.js';
import {
    collectOperaioIdsFromSquadraOperai
} from './comunicazioni-squadra-service.js';
import { resolveManodoperaUserIds } from './comunicazioni-squadra-utils.js';

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} tenantId
 * @param {string} operaioUserId
 * @returns {Promise<string|null>} caposquadraId della squadra di cui l'operaio fa parte
 */
export async function resolveCaposquadraIdsForOperaio(db, tenantId, operaioUserId) {
    if (!db || !tenantId || !operaioUserId) return [];
    try {
        const squadreRef = collection(db, 'tenants', tenantId, 'squadre');
        const squadreSnapshot = await getDocs(squadreRef);
        const capoIds = new Set();
        const mine = new Set(resolveManodoperaUserIds({ uid: operaioUserId }, { id: operaioUserId }));
        squadreSnapshot.forEach((docSnap) => {
            const squadra = docSnap.data();
            const ids = collectOperaioIdsFromSquadraOperai(squadra.operai);
            if (ids.some((id) => mine.has(id)) && squadra.caposquadraId) {
                capoIds.add(String(squadra.caposquadraId));
            }
        });
        return Array.from(capoIds);
    } catch (e) {
        console.warn('[manodopera-lavori-scope] resolveCaposquadraIdsForOperaio:', e);
        return [];
    }
}

/** @returns {Promise<string|null>} */
export async function resolveCaposquadraIdForOperaio(db, tenantId, operaioUserId) {
    const ids = await resolveCaposquadraIdsForOperaio(db, tenantId, operaioUserId);
    return ids[0] || null;
}

/**
 * @param {*} dataInizio
 * @returns {Date|null}
 */
export function parseLavoroDataInizio(dataInizio) {
    if (dataInizio == null) return null;
    const d = dataInizio.toDate ? dataInizio.toDate() : new Date(dataInizio);
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Stesso criterio della dashboard «Lavori di oggi» e selezione lavori campo.
 * @param {{ stato?: string, dataInizio?: * }} lavoro
 * @param {Date} [oggi]
 */
export function isLavoroVisibileOperaioCampo(lavoro, oggi = new Date()) {
    const stato = lavoro.stato || 'assegnato';
    if (stato === 'completato' || stato === 'annullato' || stato === 'completato_da_approvare') {
        return false;
    }
    if (stato === 'in_standby') return false;

    const oggiNorm = new Date(oggi);
    oggiNorm.setHours(0, 0, 0, 0);

    if (stato === 'assegnato' || stato === 'in_corso' || stato === 'sospeso') {
        return true;
    }
    if (stato === 'da_pianificare') {
        const di = parseLavoroDataInizio(lavoro.dataInizio);
        if (!di) return true;
        const d = new Date(di);
        d.setHours(0, 0, 0, 0);
        return d <= oggiNorm;
    }
    return false;
}

/** Solo lavori su cui l'operaio può ancora segnare ore (no completati). */
export function isLavoroSegnabileOperaio(lavoro, oggi = new Date()) {
    return isLavoroInDropdownSegnaOre(lavoro, oggi);
}

/**
 * Data fine prevista (inclusivo) da dataInizio + durataPrevista.
 * @param {{ dataInizio?: *, durataPrevista?: number }} lavoro
 * @returns {Date|null}
 */
export function getLavoroDataFinePrevista(lavoro) {
    const di = parseLavoroDataInizio(lavoro && lavoro.dataInizio);
    const dur = lavoro && lavoro.durataPrevista != null ? Number(lavoro.durataPrevista) : NaN;
    if (!di || !Number.isFinite(dur) || dur < 1) return null;
    const end = new Date(di);
    end.setDate(end.getDate() + dur - 1);
    end.setHours(23, 59, 59, 999);
    return end;
}

/**
 * Lavori ammessi nel dropdown «Segna ore»: attivi/imminenti, no sospesi/completati/fuori finestra.
 * @param {{ stato?: string, dataInizio?: *, durataPrevista?: number }} lavoro
 * @param {Date} [oggi]
 * @param {{ maxFutureDays?: number }} [opts]
 */
export function isLavoroInDropdownSegnaOre(lavoro, oggi = new Date(), opts = {}) {
    const stato = (lavoro && lavoro.stato) || 'assegnato';
    if (stato === 'completato' || stato === 'annullato' || stato === 'completato_da_approvare') {
        return false;
    }
    if (stato === 'in_standby') return false;

    // Ripresa da sospensione: sempre segnabile finché assegnato/in corso (date originali non devono escluderla)
    if (lavoro && lavoro.ripresaDaLavoroId && (stato === 'assegnato' || stato === 'in_corso')) {
        return true;
    }

    const oggiNorm = new Date(oggi);
    oggiNorm.setHours(0, 0, 0, 0);
    const maxFutureDays = opts.maxFutureDays != null ? opts.maxFutureDays : 14;

    if (stato === 'in_corso' || stato === 'sospeso') return true;

    const di = parseLavoroDataInizio(lavoro && lavoro.dataInizio);

    if (stato === 'da_pianificare') {
        if (!di) return false;
        const d = new Date(di);
        d.setHours(0, 0, 0, 0);
        if (d > oggiNorm) return false;
        const finePrev = getLavoroDataFinePrevista(lavoro);
        if (finePrev && finePrev < oggiNorm) return false;
        return true;
    }

    if (stato === 'assegnato') {
        // Assegnato resta in elenco anche oltre la durata prevista (finché non chiuso/sospeso)
        if (!di) return true;
        const d = new Date(di);
        d.setHours(0, 0, 0, 0);
        const diffFuture = (d - oggiNorm) / 86400000;
        if (diffFuture > maxFutureDays) return false;
        return true;
    }

    return isLavoroVisibileOperaioCampo(lavoro, oggi);
}

/**
 * Scope fetch per pagina Segna ore: se l'utente è operaio usa solo i lavori assegnati a lui
 * (autonomi + squadra), non l'intero elenco caposquadra.
 * @param {{ ruoli?: string[] }} userData
 */
export function resolveSegnaturaOreRoleFlags(userData) {
    const ruoli = Array.isArray(userData?.ruoli)
        ? userData.ruoli.map((r) => String(r || '').toLowerCase().trim())
        : [];
    const isOperaio = ruoli.includes('operaio');
    const isCaposquadra = ruoli.includes('caposquadra');
    if (isOperaio) {
        return { isCaposquadra: false, isOperaio: true, operaioIncludeSquadJobs: true };
    }
    if (isCaposquadra) {
        return { isCaposquadra: true, isOperaio: false, operaioIncludeSquadJobs: true };
    }
    return { isCaposquadra: false, isOperaio: false, operaioIncludeSquadJobs: true };
}

/**
 * ID utente campo (doc users + uid auth) per match su lavori.operaioId / caposquadraId.
 * @param {string} userId
 * @returns {string[]}
 */
export function resolveFieldUserIdVariants(userId, userData = null) {
    if (!userId && !userData) return [];
    return resolveManodoperaUserIds(
        userId ? { uid: userId } : null,
        userData || (userId ? { id: userId, uid: userId } : null)
    );
}

/**
 * @param {Record<string, unknown>} lavoro
 * @param {string} userId
 * @returns {boolean}
 */
export function lavoroAssegnatoDirettamenteAFieldUser(lavoro, userId) {
    if (!lavoro || !userId) return false;
    const mine = new Set(resolveFieldUserIdVariants(userId));
    const keys = ['operaioId', 'operatoreMacchinaId', 'assenzaSostitutoOperaioId'];
    return keys.some((k) => {
        const v = lavoro[k];
        return v != null && mine.has(String(v));
    });
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {import('firebase/firestore').CollectionReference} lavoriRef
 * @param {string} field
 * @param {string} userId
 * @param {Map<string, Record<string, unknown>>} byId
 * @param {(data: Record<string, unknown>) => boolean} [acceptRow]
 */
async function mergeLavoriQueryByUserField(db, lavoriRef, field, userId, byId, acceptRow = () => true, userData = null) {
    const ids = resolveFieldUserIdVariants(userId, userData);
    for (const id of ids) {
        const snap = await getDocs(query(lavoriRef, where(field, '==', id)));
        snap.forEach((d) => {
            const data = { id: d.id, ...d.data() };
            if (!acceptRow(data)) return;
            byId.set(d.id, data);
        });
    }
}

/** Lavoro autonomo assegnato all'operaio (ignora caposquadraId residuo su documenti inconsistenti). */
function acceptOperaioAutonomoRow(data, userId, userData = null) {
    if (!data.caposquadraId) return true;
    if (!data.operaioId) return false;
    const mine = new Set(resolveFieldUserIdVariants(userId, userData));
    return mine.has(String(data.operaioId));
}
/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} tenantId
 * @param {string} userId
 * @param {{ isCaposquadra: boolean, isOperaio: boolean, operaioIncludeSquadJobs?: boolean }} roleFlags
 * @param {Record<string, unknown>|null} [userData] - Profilo users (id/uid) per varianti ID
 * @returns {Promise<Array<{ id: string } & Record<string, unknown>>>}
 */
export async function fetchLavoriDocumentsForFieldUser(db, tenantId, userId, roleFlags, userData = null) {
    const { isCaposquadra, isOperaio, operaioIncludeSquadJobs = true } = roleFlags;
    const lavoriRef = collection(db, 'tenants', tenantId, 'lavori');
    const byId = new Map();

    if (isCaposquadra) {
        await mergeLavoriQueryByUserField(
            db,
            lavoriRef,
            'caposquadraId',
            userId,
            byId,
            (data) => !data.operaioId,
            userData
        );
        return Array.from(byId.values());
    }

    if (isOperaio) {
        await mergeLavoriQueryByUserField(
            db,
            lavoriRef,
            'operaioId',
            userId,
            byId,
            (data) => acceptOperaioAutonomoRow(data, userId, userData),
            userData
        );

        await mergeLavoriQueryByUserField(
            db,
            lavoriRef,
            'operatoreMacchinaId',
            userId,
            byId,
            () => true,
            userData
        );

        const capoIds = operaioIncludeSquadJobs
            ? await resolveCaposquadraIdsForOperaio(db, tenantId, userId)
            : [];
        for (const capoId of capoIds) {
            const capoVariants = resolveFieldUserIdVariants(capoId, null);
            for (const cid of capoVariants.length ? capoVariants : [capoId]) {
                const snapSquad = await getDocs(query(lavoriRef, where('caposquadraId', '==', cid)));
                snapSquad.forEach((d) => {
                    const data = d.data();
                    if (data.operaioId) return;
                    byId.set(d.id, { id: d.id, ...data });
                });
            }
        }

        await mergeLavoriQueryByUserField(db, lavoriRef, 'assenzaSostitutoOperaioId', userId, byId, () => true, userData);

        return Array.from(byId.values());
    }

    return [];
}

/**
 * Per operai: riduce l'elenco al lavoro "focus" e al massimo `maxNeighbors` prima/dopo
 * (ordinamento per dataInizio crescente). Non usare per caposquadra.
 *
 * @param {Array<{ id: string, dataInizio?: *, stato?: string }>} works
 * @param {{ focusLavoroId?: string|null, maxNeighbors?: number }} [opts]
 */
export function sliceOperaioLavoriWindow(works, opts = {}) {
    const { focusLavoroId = null, maxNeighbors = 1 } = opts;
    if (!works || works.length === 0) return [];
    const maxLen = maxNeighbors * 2 + 1;
    if (works.length <= maxLen) return works;

    const getTime = (w) => {
        const di = w && w.dataInizio;
        if (!di) return 0;
        const d = di.toDate ? di.toDate() : new Date(di);
        const t = d.getTime();
        return Number.isNaN(t) ? 0 : t;
    };
    const sortedAsc = [...works].sort((a, b) => getTime(a) - getTime(b));
    const sortedDesc = [...works].sort((a, b) => getTime(b) - getTime(a));

    let focusId = focusLavoroId || null;
    if (!focusId) {
        const ripresa = sortedDesc.find((w) => w.ripresaDaLavoroId);
        if (ripresa) {
            focusId = ripresa.id;
        }
    }
    if (!focusId) {
        const priority = ['in_corso', 'assegnato', 'da_pianificare', 'sospeso'];
        for (const stato of priority) {
            const hit = sortedDesc.find((w) => (w.stato || '') === stato);
            if (hit) {
                focusId = hit.id;
                break;
            }
        }
        if (!focusId && sortedDesc[0]) focusId = sortedDesc[0].id;
    }

    let idx = sortedAsc.findIndex((w) => w.id === focusId);
    if (idx < 0) idx = 0;

    const start = Math.max(0, idx - maxNeighbors);
    const end = Math.min(sortedAsc.length, idx + maxNeighbors + 1);
    const sliced = sortedAsc.slice(start, end);

    const mustKeepIds = new Set(sliced.map((w) => w.id));
    if (focusLavoroId) mustKeepIds.add(focusLavoroId);
    works.forEach((w) => {
        if (w.ripresaDaLavoroId) mustKeepIds.add(w.id);
        if ((w.stato || '') === 'in_corso') mustKeepIds.add(w.id);
    });

    if (mustKeepIds.size <= sliced.length) return sliced;

    const merged = works.filter((w) => mustKeepIds.has(w.id));
    merged.sort((a, b) => getTime(a) - getTime(b));
    return merged;
}
