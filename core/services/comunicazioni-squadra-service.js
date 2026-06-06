/**
 * Caricamento destinatari squadra per comunicazioni caposquadra → operai.
 */

import { collection, getDocs, query, where } from './firebase-service.js';
import {
    caposquadraIdsForQuery,
    normalizeOperaioIdFromSquadraEntry
} from './comunicazioni-squadra-utils.js';

/**
 * @param {unknown} operai
 * @returns {string[]}
 */
export function collectOperaioIdsFromSquadraOperai(operai) {
    if (!Array.isArray(operai)) return [];
    const ids = new Set();
    operai.forEach((entry) => {
        const id = normalizeOperaioIdFromSquadraEntry(entry);
        if (id) ids.add(id);
    });
    return Array.from(ids);
}

/**
 * Tutti gli operai delle squadre assegnate al caposquadra (tutte le squadre, non solo la prima).
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} tenantId
 * @param {import('firebase/auth').User | null | undefined} authUser
 * @param {Record<string, unknown> | null | undefined} userData
 * @returns {Promise<string[]>}
 */
export async function fetchOperaioIdsForCaposquadraSquadre(db, tenantId, authUser, userData) {
    if (!db || !tenantId) return [];

    const capoIds = caposquadraIdsForQuery(authUser, userData).filter(Boolean);
    if (!capoIds.length) return [];

    const capoIdSet = new Set(capoIds.map(String));
    const operaioIds = new Set();
    const squadreRef = collection(db, `tenants/${tenantId}/squadre`);

    let foundByQuery = false;
    for (const capoId of capoIds) {
        try {
            const snap = await getDocs(query(squadreRef, where('caposquadraId', '==', capoId)));
            if (!snap.empty) foundByQuery = true;
            snap.forEach((docSnap) => {
                collectOperaioIdsFromSquadraOperai(docSnap.data().operai).forEach((id) => operaioIds.add(id));
            });
        } catch (error) {
            console.warn('[comunicazioni-squadra] query squadra capo:', capoId, error);
        }
    }

    if (!foundByQuery || operaioIds.size === 0) {
        try {
            const allSnap = await getDocs(squadreRef);
            allSnap.forEach((docSnap) => {
                const data = docSnap.data();
                if (!capoIdSet.has(String(data.caposquadraId || ''))) return;
                collectOperaioIdsFromSquadraOperai(data.operai).forEach((id) => operaioIds.add(id));
            });
        } catch (error) {
            console.warn('[comunicazioni-squadra] scan squadre:', error);
        }
    }

    capoIds.forEach((id) => operaioIds.delete(String(id)));
    return Array.from(operaioIds);
}
