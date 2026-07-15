/** Stati in cui trattore/attrezzo restano riservati (in_uso) al salvataggio lavoro. */
export const LAVORO_STATI_CHE_RISERVANO_MACCHINA = Object.freeze([
    'assegnato',
    'in_corso',
    'da_pianificare',
]);

/** Stati che impediscono la liberazione macchine (solo lavoro realmente in campo). */
export const LAVORO_STATI_CHE_BLOCCANO_LIBERAZIONE = Object.freeze([
    'in_corso',
]);

/**
 * @param {string|null|undefined} stato
 * @returns {boolean}
 */
export function lavoroStatoRiservaMacchine(stato) {
    return LAVORO_STATI_CHE_RISERVANO_MACCHINA.includes(String(stato || '').toLowerCase());
}

/**
 * @param {string|null|undefined} stato
 * @returns {boolean}
 */
export function lavoroStatoBloccaLiberazioneMacchine(stato) {
    return LAVORO_STATI_CHE_BLOCCANO_LIBERAZIONE.includes(String(stato || '').toLowerCase());
}

/**
 * Macchine ancora impegnate da lavori in corso (sospeso/assegnato non bloccano).
 * @param {Array<{ id?: string, stato?: string, macchinaId?: string|null, attrezzoId?: string|null }>} lavoriList
 * @param {string|null} [excludeLavoroId]
 * @returns {{ macchine: Set<string>, attrezzi: Set<string> }}
 */
export function collectMacchineIdsDaLavoriInCorso(lavoriList, excludeLavoroId = null) {
    const macchine = new Set();
    const attrezzi = new Set();
    (lavoriList || []).forEach((l) => {
        if (excludeLavoroId && l.id === excludeLavoroId) return;
        if (!lavoroStatoBloccaLiberazioneMacchine(l.stato)) return;
        if (l.macchinaId) macchine.add(String(l.macchinaId));
        if (l.attrezzoId) attrezzi.add(String(l.attrezzoId));
    });
    return { macchine, attrezzi };
}

/**
 * @param {Array<{ id?: string, stato?: string, macchinaId?: string|null, attrezzoId?: string|null }>} lavoriList
 * @param {string|null} [excludeLavoroId]
 * @returns {{ macchine: Set<string>, attrezzi: Set<string> }}
 */
export function collectMacchineIdsDaLavoriCheRiservano(lavoriList, excludeLavoroId = null) {
    const macchine = new Set();
    const attrezzi = new Set();
    (lavoriList || []).forEach((l) => {
        if (excludeLavoroId && l.id === excludeLavoroId) return;
        if (!lavoroStatoRiservaMacchine(l.stato)) return;
        if (l.macchinaId) macchine.add(String(l.macchinaId));
        if (l.attrezzoId) attrezzi.add(String(l.attrezzoId));
    });
    return { macchine, attrezzi };
}
