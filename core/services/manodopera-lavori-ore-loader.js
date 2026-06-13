/**
 * Caricamento lavori + oreOperai in parallelo (evita N+1 sequenziale).
 * @module core/services/manodopera-lavori-ore-loader
 */

/**
 * @typedef {Object} LavoroOreBundle
 * @property {import('firebase/firestore').QueryDocumentSnapshot[]} lavoriDocs
 * @property {Map<string, { lavoroData: Object, oreDocs: import('firebase/firestore').QueryDocumentSnapshot[] }>} oreByLavoroId
 */

/**
 * Converte Timestamp Firestore in Date sui campi ore più usati.
 * @param {Object} data
 * @returns {Object}
 */
export function normalizeOraRecordData(data) {
    if (!data || typeof data !== 'object') return data;
    const out = { ...data };
    if (out.data && typeof out.data.toDate === 'function') {
        out.data = out.data.toDate();
    }
    if (out.creatoIl && typeof out.creatoIl.toDate === 'function') {
        out.creatoIl = out.creatoIl.toDate();
    }
    if (out.validatoIl && typeof out.validatoIl.toDate === 'function') {
        out.validatoIl = out.validatoIl.toDate();
    }
    return out;
}

/**
 * @param {import('firebase/firestore').QueryDocumentSnapshot[]} lavoriDocs
 * @param {Map<string, { lavoroData: Object, oreDocs: import('firebase/firestore').QueryDocumentSnapshot[] }>} oreByLavoroId
 * @returns {LavoroOreBundle}
 */
export function createLavoroOreBundle(lavoriDocs, oreByLavoroId) {
    return {
        lavoriDocs: Array.isArray(lavoriDocs) ? lavoriDocs : [],
        oreByLavoroId: oreByLavoroId instanceof Map ? oreByLavoroId : new Map()
    };
}

/**
 * Scarica tutti i lavori del tenant.
 * @param {string} tenantId
 * @param {{ db: object, collection: Function, getDocs: Function }} dependencies
 * @returns {Promise<import('firebase/firestore').QueryDocumentSnapshot[]>}
 */
export async function fetchLavoriDocs(tenantId, dependencies) {
    const { db, collection, getDocs } = dependencies;
    if (!tenantId || !db) return [];
    const lavoriRef = collection(db, 'tenants', tenantId, 'lavori');
    const snapshot = await getDocs(lavoriRef);
    return snapshot.docs || [];
}

/**
 * Scarica oreOperai per ogni lavoro in parallelo.
 * @param {string} tenantId
 * @param {import('firebase/firestore').QueryDocumentSnapshot[]} lavoriDocs
 * @param {{ db: object, collection: Function, getDocs: Function, query?: Function, where?: Function }} dependencies
 * @param {{ statoFilter?: string|null }} [options]
 * @returns {Promise<Map<string, { lavoroData: Object, oreDocs: import('firebase/firestore').QueryDocumentSnapshot[] }>>}
 */
export async function fetchOreOperaiForLavori(tenantId, lavoriDocs, dependencies, options = {}) {
    const { db, collection, getDocs, query, where } = dependencies;
    const docs = Array.isArray(lavoriDocs) ? lavoriDocs : [];
    const { statoFilter = null } = options;
    const oreByLavoroId = new Map();

    if (!tenantId || !db || docs.length === 0) {
        return oreByLavoroId;
    }

    await Promise.all(
        docs.map(async (lavoroDoc) => {
            const lavoroId = lavoroDoc.id;
            const lavoroData = lavoroDoc.data();
            try {
                const oreRef = collection(db, 'tenants', tenantId, 'lavori', lavoroId, 'oreOperai');
                let oreQuery = oreRef;
                if (statoFilter && query && where) {
                    oreQuery = query(oreRef, where('stato', '==', statoFilter));
                }
                const oreSnapshot = await getDocs(oreQuery);
                oreByLavoroId.set(lavoroId, {
                    lavoroData,
                    oreDocs: oreSnapshot.docs || []
                });
            } catch (error) {
                console.warn(`[manodopera-lavori-ore-loader] oreOperai lavoro ${lavoroId}:`, error);
                oreByLavoroId.set(lavoroId, { lavoroData, oreDocs: [] });
            }
        })
    );

    return oreByLavoroId;
}

/**
 * Un fetch lavori + N fetch oreOperai in parallelo.
 * @param {string} tenantId
 * @param {{ db: object, collection: Function, getDocs: Function, query?: Function, where?: Function }} dependencies
 * @param {{ statoFilter?: string|null, lavoriDocs?: import('firebase/firestore').QueryDocumentSnapshot[]|null }} [options]
 * @returns {Promise<LavoroOreBundle>}
 */
export async function fetchLavoriWithOreOperai(tenantId, dependencies, options = {}) {
    const lavoriDocs = options.lavoriDocs != null
        ? options.lavoriDocs
        : await fetchLavoriDocs(tenantId, dependencies);
    const oreByLavoroId = await fetchOreOperaiForLavori(
        tenantId,
        lavoriDocs,
        dependencies,
        { statoFilter: options.statoFilter ?? null }
    );
    return createLavoroOreBundle(lavoriDocs, oreByLavoroId);
}

/**
 * Itera tutte le ore del bundle con callback (lavoroId, lavoroData, oraDoc).
 * @param {LavoroOreBundle} bundle
 * @param {(ctx: { lavoroId: string, lavoroData: Object, oraDoc: import('firebase/firestore').QueryDocumentSnapshot, oraData: Object }) => void} fn
 */
export function forEachOraInBundle(bundle, fn) {
    if (!bundle || !bundle.oreByLavoroId) return;
    bundle.oreByLavoroId.forEach((entry, lavoroId) => {
        const lavoroData = entry.lavoroData || {};
        (entry.oreDocs || []).forEach((oraDoc) => {
            fn({
                lavoroId,
                lavoroData,
                oraDoc,
                oraData: oraDoc.data()
            });
        });
    });
}

/**
 * Risolve getDoc utenti in parallelo e popola una mappa id → dati.
 * @param {string[]} userIds
 * @param {{ db: object, doc: Function, getDoc: Function }} dependencies
 * @returns {Promise<Map<string, Object>>}
 */
export async function fetchUsersByIds(userIds, dependencies) {
    const { db, doc, getDoc } = dependencies;
    const unique = [...new Set((userIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
    const map = new Map();
    if (!db || unique.length === 0) return map;

    await Promise.all(
        unique.map(async (userId) => {
            try {
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (userDoc.exists()) {
                    map.set(userId, userDoc.data());
                }
            } catch (error) {
                console.warn(`[manodopera-lavori-ore-loader] utente ${userId}:`, error);
            }
        })
    );

    return map;
}
