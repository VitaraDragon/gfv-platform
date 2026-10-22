/**
 * Lavori del giorno da collegare a un'assenza.
 * Riusa resolvePrevistiOperaioIdsForGiorno: niente seconda copia del roster.
 * @module core/services/assenza-lavori-giorno-logic
 */

import { toGiornoKey } from '../config/manodopera-assenze-config.js';
import { resolvePrevistiOperaioIdsForGiorno } from './manodopera-roster-giorno-logic.js';

const STATI_CANDIDATI = new Set(['assegnato', 'in_corso']);

function statoLavoroAssenza(lavoro) {
    let stato = String((lavoro && lavoro.stato) || '').trim();
    if (stato === 'attivo') stato = 'in_corso';
    return stato;
}

function istanteInizioAssenza(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'object' && typeof value.toDate === 'function') {
        try {
            const data = value.toDate();
            if (data instanceof Date && !Number.isNaN(data.getTime())) return data;
        } catch (error) {
            return null;
        }
        return null;
    }
    if (typeof value === 'object' && typeof value.seconds === 'number') {
        const data = new Date(value.seconds * 1000);
        return Number.isNaN(data.getTime()) ? null : data;
    }
    if (typeof value === 'string') {
        const soloGiorno = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
        if (soloGiorno) {
            const data = new Date(Number(soloGiorno[1]), Number(soloGiorno[2]) - 1, Number(soloGiorno[3]));
            return Number.isNaN(data.getTime()) ? null : data;
        }
        const data = new Date(value);
        return Number.isNaN(data.getTime()) ? null : data;
    }
    return null;
}

function giornoInizioLavoro(lavoro) {
    const data = istanteInizioAssenza(lavoro && lavoro.dataInizio);
    if (!data) return '';
    return toGiornoKey(data);
}

function iniziatoEntroIlGiorno(lavoro, giornoKey) {
    const inizio = giornoInizioLavoro(lavoro);
    if (!inizio) return true;
    return inizio <= giornoKey;
}

function lavoroAutonomoAssenza(lavoro) {
    return !!(lavoro && lavoro.operaioId && !lavoro.caposquadraId);
}

/**
 * Lavori assegnato/in corso già iniziati entro il giorno, dove l'operaio è previsto.
 * Gli autonomi sono in testa.
 * @param {{ operaioId?: string, giornoKey?: string, lavori?: Array, squadre?: Array }} input
 * @returns {Array}
 */
export function lavoriCandidatiAssenza({ operaioId, giornoKey, lavori, squadre } = {}) {
    const id = String(operaioId || '');
    if (!id) return [];
    const giorno = toGiornoKey(giornoKey) || String(giornoKey || '');
    const candidati = (Array.isArray(lavori) ? lavori : []).filter((lavoro) => {
        if (!lavoro || lavoro.id == null || String(lavoro.id) === '') return false;
        if (!STATI_CANDIDATI.has(statoLavoroAssenza(lavoro))) return false;
        if (!iniziatoEntroIlGiorno(lavoro, giorno)) return false;
        const previsti = resolvePrevistiOperaioIdsForGiorno(lavoro, squadre || [], giorno);
        return previsti.map((prev) => String(prev)).includes(id);
    });
    candidati.sort((a, b) => {
        const ordineA = lavoroAutonomoAssenza(a) ? 0 : 1;
        const ordineB = lavoroAutonomoAssenza(b) ? 0 : 1;
        if (ordineA !== ordineB) return ordineA - ordineB;
        return String(a.id).localeCompare(String(b.id));
    });
    return candidati;
}

/**
 * In standby solo gli autonomi. La squadra resta spuntata solo se il manager la sceglie.
 * @param {Array} lavori
 * @returns {string[]}
 */
export function lavoroIdsPreselezionatiStandby(lavori) {
    return (Array.isArray(lavori) ? lavori : [])
        .filter(lavoroAutonomoAssenza)
        .map((lavoro) => String(lavoro.id));
}

/**
 * Unisce lavoroIds e il vecchio lavoroId, per le assenze già salvate.
 * @param {Object|null|undefined} assenza
 * @returns {string[]}
 */
export function lavoroIdsDaAssenza(assenza) {
    const ids = [];
    const aggiungi = (id) => {
        if (id == null || String(id) === '') return;
        const testo = String(id);
        if (!ids.includes(testo)) ids.push(testo);
    };
    const lista = assenza && assenza.lavoroIds;
    if (Array.isArray(lista)) lista.forEach(aggiungi);
    if (assenza && assenza.lavoroId) aggiungi(assenza.lavoroId);
    return ids;
}
