/**
 * Ciclo di vita trattore/attrezzo ↔ lavoro: riserva (in_uso) e liberazione.
 *
 * @module core/services/lavoro-macchine-lifecycle
 */

import {
    getDb,
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    getCollectionData,
} from './firebase-service.js';
import {
    lavoroStatoRiservaMacchine,
    collectMacchineIdsDaLavoriCheRiservano,
    collectMacchineIdsDaLavoriInCorso,
} from './lavoro-macchine-lifecycle-utils.js';

export {
    LAVORO_STATI_CHE_RISERVANO_MACCHINA,
    LAVORO_STATI_CHE_BLOCCANO_LIBERAZIONE,
    lavoroStatoRiservaMacchine,
    lavoroStatoBloccaLiberazioneMacchine,
    collectMacchineIdsDaLavoriCheRiservano,
    collectMacchineIdsDaLavoriInCorso,
} from './lavoro-macchine-lifecycle-utils.js';

/**
 * @param {string} macchinaId
 * @param {string} nuovoStato
 * @param {string} tenantId
 * @returns {Promise<void>}
 */
async function updateMacchinaStatoTenant(macchinaId, nuovoStato, tenantId) {
    if (!macchinaId || !tenantId) return;
    const db = getDb();
    const ref = doc(db, 'tenants', tenantId, 'macchine', macchinaId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const current = snap.data()?.stato ? String(snap.data().stato) : '';
    if (nuovoStato === 'disponibile' && (current === 'guasto' || current === 'in_manutenzione')) {
        return;
    }
    if (nuovoStato === 'in_uso' && current && current !== 'disponibile' && current !== 'in_uso') {
        return;
    }
    await updateDoc(ref, {
        stato: nuovoStato,
        updatedAt: serverTimestamp(),
    });
}

/**
 * @param {string|null|undefined} macchinaId
 * @param {string} tenantId
 * @param {Set<string>} [occupati]
 * @returns {Promise<void>}
 */
export async function liberaMacchinaIdSeNonRiservata(macchinaId, tenantId, occupati) {
    if (!macchinaId || !tenantId) return;
    if (occupati && occupati.has(String(macchinaId))) return;
    await updateMacchinaStatoTenant(macchinaId, 'disponibile', tenantId);
}

/**
 * @param {{ id?: string, macchinaId?: string|null, attrezzoId?: string|null }} lavoro
 * @param {{ tenantId: string, lavoriList?: Array<Record<string, unknown>> }} options
 * @returns {Promise<void>}
 */
export async function liberaMacchineDaLavoro(lavoro, options = {}) {
    const tenantId = options.tenantId;
    if (!tenantId || !lavoro) return;

    let macchineOccupate;
    let attrezziOccupati;
    if (Array.isArray(options.lavoriList)) {
        const collected = collectMacchineIdsDaLavoriInCorso(options.lavoriList, lavoro.id || null);
        macchineOccupate = collected.macchine;
        attrezziOccupati = collected.attrezzi;
    } else {
        const docs = await getCollectionData('lavori', { tenantId });
        const collected = collectMacchineIdsDaLavoriInCorso(docs, lavoro.id || null);
        macchineOccupate = collected.macchine;
        attrezziOccupati = collected.attrezzi;
    }

    await liberaMacchinaIdSeNonRiservata(lavoro.macchinaId, tenantId, macchineOccupate);
    await liberaMacchinaIdSeNonRiservata(lavoro.attrezzoId, tenantId, attrezziOccupati);
}

/**
 * @param {{ stato?: string, macchinaId?: string|null, attrezzoId?: string|null }} lavoro
 * @param {{ tenantId: string }} options
 * @returns {Promise<void>}
 */
export async function riservaMacchineDaLavoro(lavoro, options = {}) {
    const tenantId = options.tenantId;
    if (!tenantId || !lavoro || !lavoroStatoRiservaMacchine(lavoro.stato)) return;
    if (lavoro.macchinaId) {
        await updateMacchinaStatoTenant(lavoro.macchinaId, 'in_uso', tenantId);
    }
    if (lavoro.attrezzoId) {
        await updateMacchinaStatoTenant(lavoro.attrezzoId, 'in_uso', tenantId);
    }
}

/**
 * @param {string} tenantId
 * @param {Array<{ id?: string, stato?: string, macchinaId?: string|null, attrezzoId?: string|null }>} lavoriList
 * @returns {Promise<number>}
 */
export async function correggiMacchineLavoriSospesiOStandby(tenantId, lavoriList) {
    if (!tenantId || !Array.isArray(lavoriList)) return 0;
    const { macchine, attrezzi } = collectMacchineIdsDaLavoriInCorso(lavoriList);
    let liberate = 0;
    for (const lavoro of lavoriList) {
        const stato = String(lavoro.stato || '').toLowerCase();
        if (stato !== 'sospeso' && stato !== 'in_standby') continue;
        if (lavoro.macchinaId && !macchine.has(String(lavoro.macchinaId))) {
            await liberaMacchinaIdSeNonRiservata(lavoro.macchinaId, tenantId, macchine);
            liberate += 1;
        }
        if (lavoro.attrezzoId && !attrezzi.has(String(lavoro.attrezzoId))) {
            await liberaMacchinaIdSeNonRiservata(lavoro.attrezzoId, tenantId, attrezzi);
            liberate += 1;
        }
    }
    return liberate;
}
