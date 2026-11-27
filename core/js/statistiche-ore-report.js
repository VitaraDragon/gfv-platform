/**
 * Aggregazione report ore operai (statistiche manodopera).
 * Modulo puro: niente Firebase, niente DOM.
 * @module core/js/statistiche-ore-report
 */

import { dateLikeToLocalCalendarIso } from './date-format-it.js';

/**
 * @param {unknown} stato
 * @returns {boolean}
 */
export function isOraRifiutata(stato) {
  return String(stato || '') === 'rifiutate';
}

/**
 * Aggrega le ore per operaio escludendo le righe rifiutate dal totale.
 * Il giorno lavorato usa il calendario locale (non UTC di toISOString).
 *
 * @param {{
 *   operaioId?: string,
 *   oreNette?: number,
 *   stato?: string,
 *   data?: *
 * }[]|null|undefined} righe
 * @returns {{
 *   orePerOperaio: Record<string, {
 *     operaioId: string,
 *     oreTotali: number,
 *     oreValidate: number,
 *     oreDaValidare: number,
 *     giorniLavorati: Set<string>
 *   }>,
 *   oreTotali: number,
 *   oreValidateTotali: number,
 *   oreDaValidareTotali: number
 * }}
 */
export function aggregaOreReport(righe) {
  /** @type {Record<string, { operaioId: string, oreTotali: number, oreValidate: number, oreDaValidare: number, giorniLavorati: Set<string> }>} */
  const orePerOperaio = {};
  let oreTotali = 0;
  let oreValidateTotali = 0;
  let oreDaValidareTotali = 0;

  const lista = Array.isArray(righe) ? righe : [];
  for (const ora of lista) {
    if (!ora || typeof ora !== 'object') continue;
    if (isOraRifiutata(ora.stato)) continue;

    const operaioId = ora.operaioId;
    if (!operaioId) continue;

    const oreNette = typeof ora.oreNette === 'number' && Number.isFinite(ora.oreNette) ? ora.oreNette : 0;
    const stato = ora.stato || 'da_validare';

    if (!orePerOperaio[operaioId]) {
      orePerOperaio[operaioId] = {
        operaioId,
        oreTotali: 0,
        oreValidate: 0,
        oreDaValidare: 0,
        giorniLavorati: new Set()
      };
    }

    orePerOperaio[operaioId].oreTotali += oreNette;
    oreTotali += oreNette;

    if (stato === 'validate') {
      orePerOperaio[operaioId].oreValidate += oreNette;
      oreValidateTotali += oreNette;
    } else if (stato === 'da_validare') {
      orePerOperaio[operaioId].oreDaValidare += oreNette;
      oreDaValidareTotali += oreNette;
    }

    const giornoKey = dateLikeToLocalCalendarIso(ora.data);
    if (giornoKey) {
      orePerOperaio[operaioId].giorniLavorati.add(giornoKey);
    }
  }

  return {
    orePerOperaio,
    oreTotali,
    oreValidateTotali,
    oreDaValidareTotali
  };
}

/**
 * Media ore/giorno = ore totali ÷ somma dei giorni lavorati da ciascun operaio
 * (media per persona), non ÷ max giorni di un solo operaio.
 *
 * @param {{ oreTotali?: number, giorniLavorati?: number }[]|null|undefined} operai
 * @returns {{ oreTotali: number, giorniLavoratiSum: number, mediaOreGiorno: number }}
 */
export function riepilogoMediaOrePerPersona(operai) {
  let oreTotali = 0;
  let giorniLavoratiSum = 0;
  const lista = Array.isArray(operai) ? operai : [];
  for (const operaio of lista) {
    if (!operaio || typeof operaio !== 'object') continue;
    const ore = typeof operaio.oreTotali === 'number' && Number.isFinite(operaio.oreTotali)
      ? operaio.oreTotali
      : 0;
    const giorni = typeof operaio.giorniLavorati === 'number' && Number.isFinite(operaio.giorniLavorati)
      ? operaio.giorniLavorati
      : 0;
    oreTotali += ore;
    giorniLavoratiSum += giorni;
  }
  return {
    oreTotali,
    giorniLavoratiSum,
    mediaOreGiorno: giorniLavoratiSum > 0 ? oreTotali / giorniLavoratiSum : 0
  };
}

const TIPO_OPERAIO_LABELS = {
  semplice: 'Operaio Semplice',
  specializzato: 'Operaio Specializzato',
  trattorista: 'Trattorista',
  meccanico: 'Meccanico',
  elettricista: 'Elettricista',
  altro: 'Altro'
};

/**
 * Etichetta Tipo in tabella report ore: ruolo caposquadra + tipoOperaio.
 * Stesso testo usato dal filtro Tipo (incluso «Non specificato»).
 *
 * @param {{ ruoli?: string[], tipoOperaio?: string }|null|undefined} operaio
 * @returns {string}
 */
export function getTipoOperaioDisplay(operaio) {
  const ruoli = (operaio && Array.isArray(operaio.ruoli)) ? operaio.ruoli : [];
  const tipoOperaio = (operaio && operaio.tipoOperaio) ? String(operaio.tipoOperaio) : '';
  const isCaposquadra = ruoli.some((r) => String(r || '').toLowerCase() === 'caposquadra');

  if (isCaposquadra) {
    if (tipoOperaio && TIPO_OPERAIO_LABELS[tipoOperaio]) {
      return `Caposquadra - ${TIPO_OPERAIO_LABELS[tipoOperaio]}`;
    }
    if (tipoOperaio) {
      return `Caposquadra - ${tipoOperaio}`;
    }
    return 'Caposquadra';
  }

  if (tipoOperaio && TIPO_OPERAIO_LABELS[tipoOperaio]) {
    return TIPO_OPERAIO_LABELS[tipoOperaio];
  }
  if (tipoOperaio) {
    return tipoOperaio;
  }
  return 'Non specificato';
}

/**
 * True se l'operaio passa il filtro Tipo del report ore.
 * «non_specificato» allinea al display «Non specificato» (non caposquadra senza tipo).
 *
 * @param {{ ruoli?: string[], tipoOperaio?: string }|null|undefined} operaio
 * @param {string} filtroTipo valore select (`tutti` | `Caposquadra` | `non_specificato` | codice tipo)
 * @returns {boolean}
 */
export function matchesTipoOperaioFilter(operaio, filtroTipo) {
  if (!filtroTipo || filtroTipo === 'tutti') return true;

  const ruoli = (operaio && Array.isArray(operaio.ruoli)) ? operaio.ruoli : [];
  const isCaposquadra = ruoli.some((r) => String(r || '').toLowerCase() === 'caposquadra');

  if (filtroTipo === 'Caposquadra') {
    return isCaposquadra;
  }

  if (filtroTipo === 'non_specificato') {
    return getTipoOperaioDisplay(operaio) === 'Non specificato';
  }

  const tipoOperaio = (operaio && operaio.tipoOperaio) ? String(operaio.tipoOperaio) : '';
  return tipoOperaio === filtroTipo;
}
