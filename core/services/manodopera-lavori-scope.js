/**
 * Caricamento lavori per ruoli campo (operaio / caposquadra) senza scaricare
 * l'intera collection lavori. Stesso criterio usato in segnatura / lavori caposquadra.
 */

import { collection, getDocs, query, where } from './firebase-service.js';

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} tenantId
 * @param {string} operaioUserId
 * @returns {Promise<string|null>} caposquadraId della squadra di cui l'operaio fa parte
 */
export async function resolveCaposquadraIdForOperaio(db, tenantId, operaioUserId) {
    if (!db || !tenantId || !operaioUserId) return null;
    try {
        const squadreRef = collection(db, 'tenants', tenantId, 'squadre');
        const squadreSnapshot = await getDocs(squadreRef);
        let caposquadraId = null;
        squadreSnapshot.forEach((docSnap) => {
            const squadra = docSnap.data();
            if (squadra.operai && squadra.operai.includes(operaioUserId)) {
                caposquadraId = squadra.caposquadraId;
            }
        });
        return caposquadraId;
    } catch (e) {
        console.warn('[manodopera-lavori-scope] resolveCaposquadraIdForOperaio:', e);
        return null;
    }
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

        const capoId = operaioIncludeSquadJobs
            ? await resolveCaposquadraIdForOperaio(db, tenantId, userId)
            : null;
        if (capoId) {
            const snapSquad = await getDocs(query(lavoriRef, where('caposquadraId', '==', capoId)));
            snapSquad.forEach((d) => {
                const data = d.data();
                if (data.operaioId) return;
                byId.set(d.id, { id: d.id, ...data });
            });
        }
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
    const sorted = [...works].sort((a, b) => getTime(a) - getTime(b));
    let idx = 0;
    if (focusLavoroId) {
        const fi = sorted.findIndex((w) => w.id === focusLavoroId);
        if (fi >= 0) idx = fi;
    } else {
        const iInCorso = sorted.findIndex((w) => (w.stato || '') === 'in_corso');
        if (iInCorso >= 0) idx = iInCorso;
        else {
            const iAss = sorted.findIndex((w) => (w.stato || '') === 'assegnato');
            if (iAss >= 0) idx = iAss;
        }
    }
    const start = Math.max(0, idx - maxNeighbors);
    const end = Math.min(sorted.length, idx + maxNeighbors + 1);
    return sorted.slice(start, end);
}
