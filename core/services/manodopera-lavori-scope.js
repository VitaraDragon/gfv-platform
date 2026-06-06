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
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} tenantId
 * @param {string} userId - solitamente users doc id / auth uid usato nei lavori
 * @param {{ isCaposquadra: boolean, isOperaio: boolean, operaioIncludeSquadJobs?: boolean }} roleFlags
 *        `operaioIncludeSquadJobs` (default true): se false, l’operaio vede solo i lavori autonomi (operaioId),
 *        coerente con la pagina «I miei lavori» caposquadra; se true, anche i lavori di squadra del proprio capo.
 * @returns {Promise<Array<{ id: string } & Record<string, unknown>>>}
 */
export async function fetchLavoriDocumentsForFieldUser(db, tenantId, userId, roleFlags) {
    const { isCaposquadra, isOperaio, operaioIncludeSquadJobs = true } = roleFlags;
    const lavoriRef = collection(db, 'tenants', tenantId, 'lavori');
    const byId = new Map();

    if (isCaposquadra) {
        const q = query(lavoriRef, where('caposquadraId', '==', userId));
        const snap = await getDocs(q);
        snap.forEach((d) => {
            const data = d.data();
            if (data.operaioId) return;
            byId.set(d.id, { id: d.id, ...data });
        });
        return Array.from(byId.values());
    }

    if (isOperaio) {
        const snapAuto = await getDocs(query(lavoriRef, where('operaioId', '==', userId)));
        snapAuto.forEach((d) => {
            const data = d.data();
            if (data.caposquadraId) return;
            byId.set(d.id, { id: d.id, ...data });
        });

        const capoIds = operaioIncludeSquadJobs
            ? await resolveCaposquadraIdsForOperaio(db, tenantId, userId)
            : [];
        for (const capoId of capoIds) {
            const snapSquad = await getDocs(query(lavoriRef, where('caposquadraId', '==', capoId)));
            snapSquad.forEach((d) => {
                const data = d.data();
                if (data.operaioId) return;
                byId.set(d.id, { id: d.id, ...data });
            });
        }

        const snapSost = await getDocs(
            query(lavoriRef, where('assenzaSostitutoOperaioId', '==', userId))
        );
        snapSost.forEach((d) => {
            byId.set(d.id, { id: d.id, ...d.data() });
        });

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
    return sortedAsc.slice(start, end);
}
