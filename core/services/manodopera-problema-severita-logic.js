/**
 * Severità problemi manodopera (semaforo) — logica pura, senza Firebase.
 * Rosso = azione urgente; giallo = attenzione; null = nessun allarme.
 *
 * @module core/services/manodopera-problema-severita-logic
 */

import {
  LAVORO_STAND_BY_CAUSA_ASSENZA,
  LAVORO_STAND_BY_CAUSA_PRESTITO
} from '../config/manodopera-assenze-config.js';

export const SEVERITA_ROSSO = 'rosso';
export const SEVERITA_GIALLO = 'giallo';
export const SEVERITA_VERDE = 'verde';

/**
 * @param {Object} input
 * @param {string} [input.stato]
 * @param {string|null} [input.standbyCausa]
 * @param {string[]} [input.sostitutiIds]
 * @param {boolean} [input.equipaggioIncompleto]
 * @param {boolean} [input.shortlistVuota] — shortlist materializzata vuota (opzionale)
 * @returns {{ severita: 'rosso'|'giallo'|null, motivo: string|null, pulse: boolean }}
 */
export function resolveLavoroManodoperaSeverita(input = {}) {
  const stato = input.stato || '';
  const causa = input.standbyCausa || null;
  const sostitutiIds = (input.sostitutiIds || []).filter(Boolean);
  const hasSostituto = sostitutiIds.length > 0;
  const incompleto = !!input.equipaggioIncompleto;
  const shortlistVuota = !!input.shortlistVuota;

  const standbyAssenza =
    stato === 'in_standby' && (causa === LAVORO_STAND_BY_CAUSA_ASSENZA || !causa);
  const standbyPrestito =
    stato === 'in_standby' && causa === LAVORO_STAND_BY_CAUSA_PRESTITO;

  if (standbyAssenza && !hasSostituto) {
    return {
      severita: SEVERITA_ROSSO,
      motivo: 'Standby assenza senza sostituto',
      pulse: true
    };
  }

  if (incompleto && !hasSostituto) {
    return {
      severita: SEVERITA_ROSSO,
      motivo: 'Equipaggio sotto il minimo',
      pulse: true
    };
  }

  if (incompleto && hasSostituto) {
    return {
      severita: SEVERITA_GIALLO,
      motivo: 'Equipaggio ancora incompleto',
      pulse: false
    };
  }

  if (standbyPrestito) {
    return {
      severita: SEVERITA_GIALLO,
      motivo: 'Buco da prestito manodopera',
      pulse: false
    };
  }

  if (standbyAssenza && shortlistVuota) {
    return {
      severita: SEVERITA_GIALLO,
      motivo: 'Standby senza candidati in shortlist',
      pulse: false
    };
  }

  return { severita: null, motivo: null, pulse: false };
}

/**
 * Ordine sort: rosso → giallo → resto.
 * @param {'rosso'|'giallo'|null|undefined} severita
 * @returns {number}
 */
export function severitaSortRank(severita) {
  if (severita === SEVERITA_ROSSO) return 0;
  if (severita === SEVERITA_GIALLO) return 1;
  return 2;
}

/**
 * Markup HTML semaforo (stringa statica; escape titolo a cura del chiamante).
 * @param {{ severita: string|null, motivo?: string|null, pulse?: boolean }} info
 * @param {(s: string) => string} [escapeHtml]
 * @returns {string}
 */
export function renderSemaforoHtml(info, escapeHtml = (s) => String(s ?? '')) {
  if (!info?.severita) return '';
  const cls =
    info.severita === SEVERITA_ROSSO
      ? 'gfv-semaforo gfv-semaforo--red' + (info.pulse ? ' gfv-semaforo--pulse' : '')
      : info.severita === SEVERITA_GIALLO
        ? 'gfv-semaforo gfv-semaforo--yellow'
        : '';
  if (!cls) return '';
  const title = escapeHtml(info.motivo || 'Attenzione manodopera');
  return `<span class="${cls}" title="${title}" role="img" aria-label="${title}"></span>`;
}
