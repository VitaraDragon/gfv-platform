/**
 * Aggregazioni pure Statistiche Macchine (niente Firestore, niente DOM).
 * @module core/js/statistiche-macchine-aggregazioni
 */

import { dateLikeToLocalCalendarIso } from './date-format-it.js';

/**
 * Chiave cache filtri (tenant escluso).
 * @param {Object} [periodo]
 * @returns {string}
 */
export function periodoCacheKey(periodo = {}) {
    return [
        periodo.dataDa || '',
        periodo.dataA || '',
        periodo.terrenoId || '',
        periodo.tipoLavoro || ''
    ].join('|');
}

/**
 * Filtra una riga ore su `ora.data` (calendario locale). Data invalida → scarta solo questa riga.
 * @param {Object} ora
 * @param {Object} [periodo]
 * @returns {boolean}
 */
export function oraMatchesPeriodo(ora, periodo = {}) {
    const iso = dateLikeToLocalCalendarIso(ora?.data);
    if (!iso) return false;
    if (periodo.dataDa && iso < periodo.dataDa) return false;
    if (periodo.dataA && iso > periodo.dataA) return false;
    return true;
}

/**
 * Terreno / tipo lavoro da lavoro o dalla riga ore.
 * @param {Object} [lavoro]
 * @param {Object} [periodo]
 * @param {Object} [ora]
 * @returns {boolean}
 */
export function lavoroMatchesTerrenoTipo(lavoro = {}, periodo = {}, ora = null) {
    const terrenoId = (ora && ora.terrenoId) || lavoro.terrenoId || '';
    const tipoLavoro = (ora && ora.tipoLavoro) || lavoro.tipoLavoro || '';
    if (periodo.terrenoId && terrenoId !== periodo.terrenoId) return false;
    if (periodo.tipoLavoro && tipoLavoro !== periodo.tipoLavoro) return false;
    return true;
}

/**
 * Estrae ore validate filtrate da un bundle lavori+oreOperai.
 * Errori su un lavoro/riga non azzerano il resto.
 * @param {{ oreByLavoroId?: Map<string, { lavoroData?: Object, oreDocs?: Array }> }|null|undefined} bundle
 * @param {Object} [periodo]
 * @returns {{ lavoroId: string, lavoro: Object, ora: Object }[]}
 */
export function collectOreValidateFiltrate(bundle, periodo = {}) {
    const rows = [];
    if (!bundle || !bundle.oreByLavoroId) return rows;

    bundle.oreByLavoroId.forEach((entry, lavoroId) => {
        try {
            const lavoro = entry?.lavoroData || {};
            if (!lavoroMatchesTerrenoTipo(lavoro, periodo)) return;

            const oreDocs = entry?.oreDocs || [];
            for (const oraDoc of oreDocs) {
                try {
                    const ora = typeof oraDoc?.data === 'function' ? oraDoc.data() : (oraDoc || {});
                    if (!oraMatchesPeriodo(ora, periodo)) continue;
                    if (!lavoroMatchesTerrenoTipo(lavoro, periodo, ora)) continue;
                    rows.push({ lavoroId: String(lavoroId), lavoro, ora });
                } catch (_) {
                    // scarta solo questa riga
                }
            }
        } catch (_) {
            // scarta solo questo lavoro
        }
    });

    return rows;
}

/**
 * @param {Array} attivita
 * @param {{ ora: Object }[]} oreRows
 * @returns {number}
 */
export function aggregaOreMacchineTotali(attivita, oreRows) {
    let totaleOre = 0;
    (attivita || []).forEach((att) => {
        if (att?.oreMacchina && att.oreMacchina > 0) {
            totaleOre += att.oreMacchina;
        }
    });
    (oreRows || []).forEach(({ ora }) => {
        if (ora?.oreMacchina && ora.oreMacchina > 0) {
            totaleOre += ora.oreMacchina;
        }
    });
    return parseFloat(totaleOre.toFixed(2));
}

/**
 * @param {Array} attivita
 * @param {{ ora: Object }[]} oreRows
 * @param {Array} macchine
 * @param {number} [limit=5]
 * @returns {Array<{ macchinaId: string, nome: string, tipo: string, ore: number }>}
 */
export function aggregaMacchinePiuUtilizzate(attivita, oreRows, macchine, limit = 5) {
    const orePerMacchina = {};

    const add = (id, ore) => {
        if (!id || !(ore > 0)) return;
        orePerMacchina[id] = (orePerMacchina[id] || 0) + ore;
    };

    (attivita || []).forEach((att) => {
        if (!att?.oreMacchina || att.oreMacchina <= 0) return;
        add(att.macchinaId, att.oreMacchina);
        add(att.attrezzoId, att.oreMacchina);
    });

    (oreRows || []).forEach(({ ora }) => {
        if (!ora?.oreMacchina || ora.oreMacchina <= 0) return;
        add(ora.macchinaId, ora.oreMacchina);
        add(ora.attrezzoId, ora.oreMacchina);
    });

    const macchineMap = {};
    (macchine || []).forEach((m) => {
        if (m?.id) macchineMap[m.id] = m;
    });

    return Object.entries(orePerMacchina)
        .map(([macchinaId, ore]) => {
            const macchina = macchineMap[macchinaId];
            return {
                macchinaId,
                nome: macchina?.nome || `Macchina ${macchinaId.substring(0, 8)}...`,
                tipo: macchina?.tipoMacchina || macchina?.tipo || 'macchina',
                ore: parseFloat(ore.toFixed(2))
            };
        })
        .sort((a, b) => b.ore - a.ore)
        .slice(0, limit || 5);
}

/**
 * @param {Array} attivita
 * @param {{ lavoro: Object, ora: Object }[]} oreRows
 * @param {Record<string, { nome?: string, clienteId?: string, archiviato?: boolean }>} terreniMap
 * @param {(t: Object) => boolean} [isArchiviatoFn]
 * @returns {Array<{ terrenoNome: string, ore: number }>}
 */
export function aggregaOreMacchinaPerTerreno(attivita, oreRows, terreniMap = {}, isArchiviatoFn = null) {
    const orePerTerreno = {};

    (attivita || []).forEach((att) => {
        if (att?.terrenoNome && att.oreMacchina && att.oreMacchina > 0) {
            orePerTerreno[att.terrenoNome] = (orePerTerreno[att.terrenoNome] || 0) + att.oreMacchina;
        }
    });

    (oreRows || []).forEach(({ lavoro, ora }) => {
        if (!(ora?.oreMacchina > 0)) return;
        const terrenoId = lavoro?.terrenoId;
        if (!terrenoId) return;
        const terrenoData = terreniMap[terrenoId];
        if (!terrenoData) return;
        if (terrenoData.clienteId) return;
        if (typeof isArchiviatoFn === 'function' && isArchiviatoFn(terrenoData)) return;
        const terrenoNome = terrenoData.nome || 'Terreno sconosciuto';
        orePerTerreno[terrenoNome] = (orePerTerreno[terrenoNome] || 0) + ora.oreMacchina;
    });

    return Object.entries(orePerTerreno)
        .map(([terrenoNome, ore]) => ({
            terrenoNome,
            ore: parseFloat(ore.toFixed(2))
        }))
        .sort((a, b) => b.ore - a.ore);
}

/**
 * Stesse fonti del KPI ore macchine: Diario + Manodopera validate.
 * @param {Array} attivita
 * @param {{ ora: Object }[]} oreRows
 * @returns {{ oreLavoratore: number, oreMacchina: number }}
 */
export function aggregaOreMacchinaVsLavoratore(attivita, oreRows) {
    let oreLavoratore = 0;
    let oreMacchina = 0;

    (attivita || []).forEach((att) => {
        if (att?.oreNette) oreLavoratore += att.oreNette;
        if (att?.oreMacchina) oreMacchina += att.oreMacchina;
    });

    (oreRows || []).forEach(({ ora }) => {
        if (ora?.oreNette) oreLavoratore += ora.oreNette;
        if (ora?.oreMacchina) oreMacchina += ora.oreMacchina;
    });

    return {
        oreLavoratore: parseFloat(oreLavoratore.toFixed(2)),
        oreMacchina: parseFloat(oreMacchina.toFixed(2))
    };
}

/**
 * Mese da calendario locale (non UTC di toISOString).
 * @param {Array} attivita
 * @param {{ ora: Object }[]} oreRows
 * @returns {Array<{ mese: string, ore: number }>}
 */
export function aggregaOreMacchinePerMese(attivita, oreRows) {
    const orePerMese = {};

    (attivita || []).forEach((att) => {
        if (!att?.data || !att.oreMacchina) return;
        const mese = String(att.data).substring(0, 7);
        if (!mese || mese.length < 7) return;
        orePerMese[mese] = (orePerMese[mese] || 0) + att.oreMacchina;
    });

    (oreRows || []).forEach(({ ora }) => {
        if (!(ora?.oreMacchina > 0)) return;
        const iso = dateLikeToLocalCalendarIso(ora.data);
        if (!iso) return;
        const mese = iso.substring(0, 7);
        orePerMese[mese] = (orePerMese[mese] || 0) + ora.oreMacchina;
    });

    return Object.entries(orePerMese)
        .map(([mese, ore]) => ({
            mese,
            ore: parseFloat(ore.toFixed(2))
        }))
        .sort((a, b) => a.mese.localeCompare(b.mese));
}
