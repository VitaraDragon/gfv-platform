/**
 * Aggregati puri blocco Manodopera su Statistiche (annata, senza confronto anni).
 * Nessuna I/O / DOM.
 * @module core/js/statistiche-manodopera-blocco
 */

import { dateLikeToLocalCalendarIso } from './date-format-it.js';
import {
  aggregaOrePerTipoDisplay,
  aggregaOreReport,
  boundsIsoAnnata,
  getTipoOperaioDisplay,
  isOraRifiutata,
  oraInPeriodoIso
} from './statistiche-ore-report.js';

const MESI_IT_BREVI = [
  'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'
];

/**
 * @param {{ stato?: string }|null|undefined} lavoro
 * @returns {boolean}
 */
export function isLavoroAnnullato(lavoro) {
  return String((lavoro && lavoro.stato) || '').toLowerCase() === 'annullato';
}

/**
 * @param {{ stato?: string }|null|undefined} lavoro
 * @returns {boolean}
 */
export function isLavoroAttivoStats(lavoro) {
  const stato = String((lavoro && lavoro.stato) || '').toLowerCase();
  return stato === 'in_corso' || stato === 'assegnato' || stato === 'attivo';
}

/**
 * @param {{ stato?: string }|null|undefined} lavoro
 * @returns {boolean}
 */
export function isLavoroCompletatoStats(lavoro) {
  return String((lavoro && lavoro.stato) || '').toLowerCase() === 'completato';
}

/**
 * @param {{ dataInizio?: *, data?: * }|null|undefined} lavoro
 * @param {number} anno
 * @returns {boolean}
 */
export function lavoroInAnnata(lavoro, anno) {
  const iso = dateLikeToLocalCalendarIso((lavoro && (lavoro.dataInizio || lavoro.data)) || null);
  if (!iso) return false;
  return iso.startsWith(`${Number(anno)}-`);
}

/**
 * Conta lavori nell'annata: annullati esclusi dai totali (conteggio a parte).
 *
 * @param {{ stato?: string, dataInizio?: *, data?: * }[]|null|undefined} lavori
 * @param {number} anno
 * @returns {{
 *   attivi: number,
 *   completati: number,
 *   annullati: number,
 *   considerati: number
 * }}
 */
export function calcolaLavoriAnnata(lavori, anno) {
  let attivi = 0;
  let completati = 0;
  let annullati = 0;
  let considerati = 0;
  const lista = Array.isArray(lavori) ? lavori : [];
  for (const lavoro of lista) {
    if (!lavoro || !lavoroInAnnata(lavoro, anno)) continue;
    if (isLavoroAnnullato(lavoro)) {
      annullati += 1;
      continue;
    }
    considerati += 1;
    if (isLavoroAttivoStats(lavoro)) attivi += 1;
    else if (isLavoroCompletatoStats(lavoro)) completati += 1;
  }
  return { attivi, completati, annullati, considerati };
}

/**
 * Media ore validate / giorni con ore nel periodo ISO inclusivo.
 *
 * @param {{ stato?: string, oreNette?: number, data?: * }[]|null|undefined} oreRows
 * @param {string} isoFrom
 * @param {string} isoTo
 * @param {string} etichetta
 * @returns {{ oreValidateMese: number, giorniConOre: number, mediaOreGiorno: number, etichettaMese: string }}
 */
function mediaOreValidateInPeriodo(oreRows, isoFrom, isoTo, etichetta) {
  const giorni = new Set();
  let oreValidateMese = 0;
  const lista = Array.isArray(oreRows) ? oreRows : [];
  for (const ora of lista) {
    if (!ora || isOraRifiutata(ora.stato)) continue;
    if (String(ora.stato || '') !== 'validate') continue;
    if (!oraInPeriodoIso(ora.data, isoFrom, isoTo)) continue;
    const oreNette = typeof ora.oreNette === 'number' && Number.isFinite(ora.oreNette) ? ora.oreNette : 0;
    if (oreNette <= 0) continue;
    oreValidateMese += oreNette;
    const giorno = dateLikeToLocalCalendarIso(ora.data);
    if (giorno) giorni.add(giorno);
  }
  const giorniConOre = giorni.size;
  return {
    oreValidateMese,
    giorniConOre,
    mediaOreGiorno: giorniConOre > 0 ? oreValidateMese / giorniConOre : 0,
    etichettaMese: etichetta
  };
}

/**
 * Media ore validate / giorni con ore nel mese civile di `oggi`.
 *
 * @param {{ stato?: string, oreNette?: number, data?: * }[]|null|undefined} oreRows
 * @param {Date} [oggi]
 * @returns {{ oreValidateMese: number, giorniConOre: number, mediaOreGiorno: number, etichettaMese: string }}
 */
export function calcolaMediaOreGiornoMeseCorrente(oreRows, oggi = new Date()) {
  const y = oggi.getFullYear();
  const m = oggi.getMonth();
  const isoFrom = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const isoTo = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return mediaOreValidateInPeriodo(
    oreRows,
    isoFrom,
    isoTo,
    `${MESI_IT_BREVI[m]} ${y}`
  );
}

/**
 * Media ore/giorno allineata all'annata scelta:
 * - se `anno` è l'anno di `oggi` → mese civile corrente;
 * - altrimenti → media sull'intera annata (etichetta «annata YYYY»).
 *
 * @param {{ stato?: string, oreNette?: number, data?: * }[]|null|undefined} oreRows
 * @param {number} anno
 * @param {Date} [oggi]
 * @returns {{ oreValidateMese: number, giorniConOre: number, mediaOreGiorno: number, etichettaMese: string }}
 */
export function calcolaMediaOreGiornoPerAnnata(oreRows, anno, oggi = new Date()) {
  const y = Number(anno);
  if (!Number.isFinite(y)) {
    return calcolaMediaOreGiornoMeseCorrente(oreRows, oggi);
  }
  if (y === oggi.getFullYear()) {
    return calcolaMediaOreGiornoMeseCorrente(oreRows, oggi);
  }
  const { isoFrom, isoTo } = boundsIsoAnnata(y);
  return mediaOreValidateInPeriodo(oreRows, isoFrom, isoTo, `annata ${y}`);
}

/**
 * Serie mensile ore validate per l'annata (12 bucket).
 *
 * @param {{ stato?: string, oreNette?: number, data?: * }[]|null|undefined} oreRows
 * @param {number} anno
 * @returns {{ mese: number, label: string, ore: number }[]}
 */
export function aggregaOreValidatePerMeseAnnata(oreRows, anno) {
  const { isoFrom, isoTo } = boundsIsoAnnata(anno);
  const buckets = Array.from({ length: 12 }, (_, i) => ({
    mese: i + 1,
    label: MESI_IT_BREVI[i],
    ore: 0
  }));
  const lista = Array.isArray(oreRows) ? oreRows : [];
  for (const ora of lista) {
    if (!ora || isOraRifiutata(ora.stato)) continue;
    if (String(ora.stato || '') !== 'validate') continue;
    if (!oraInPeriodoIso(ora.data, isoFrom, isoTo)) continue;
    const iso = dateLikeToLocalCalendarIso(ora.data);
    if (!iso || iso.length < 7) continue;
    const monthIdx = Number(iso.slice(5, 7)) - 1;
    if (monthIdx < 0 || monthIdx > 11) continue;
    const oreNette = typeof ora.oreNette === 'number' && Number.isFinite(ora.oreNette) ? ora.oreNette : 0;
    buckets[monthIdx].ore += oreNette;
  }
  return buckets;
}

/**
 * KPI + liste del blocco Manodopera per un'annata.
 *
 * Criteri ore: validate = `stato === 'validate'` (come Report);
 * da validare = `da_validare` escludendo lavori in sola lettura (operativo).
 *
 * @param {{
 *   oreRows?: Array<{
 *     stato?: string,
 *     oreNette?: number,
 *     data?: *,
 *     operaioId?: string,
 *     lavoroId?: string
 *   }>,
 *   lavori?: Array<{
 *     id?: string,
 *     stato?: string,
 *     dataInizio?: *,
 *     data?: *,
 *     terrenoId?: string
 *   }>,
 *   terreniById?: Map<string, object>|Record<string, object>|null,
 *   usersById?: Map<string, object>|Record<string, object>|null,
 *   anno: number,
 *   oggi?: Date,
 *   isLavoroSolaLettura?: (lavoro: object, terreno: object|null) => boolean,
 *   topN?: number
 * }} input
 */
export function calcolaBloccoManodoperaAnnata(input) {
  const anno = Number(input && input.anno);
  const oggi = (input && input.oggi instanceof Date) ? input.oggi : new Date();
  const topN = (input && Number(input.topN) > 0) ? Number(input.topN) : 5;
  const oreRows = (input && Array.isArray(input.oreRows)) ? input.oreRows : [];
  const lavori = (input && Array.isArray(input.lavori)) ? input.lavori : [];
  const isSolaLettura = typeof (input && input.isLavoroSolaLettura) === 'function'
    ? input.isLavoroSolaLettura
    : () => false;

  const lavoriById = new Map();
  for (const lav of lavori) {
    if (lav && lav.id) lavoriById.set(String(lav.id), lav);
  }

  const resolveTerreno = (terrenoId) => {
    if (!terrenoId || !input.terreniById) return null;
    if (input.terreniById instanceof Map) return input.terreniById.get(String(terrenoId)) || null;
    return input.terreniById[String(terrenoId)] || null;
  };

  const resolveUser = (userId) => {
    if (!userId || !input.usersById) return null;
    if (input.usersById instanceof Map) return input.usersById.get(String(userId)) || null;
    return input.usersById[String(userId)] || null;
  };

  const { isoFrom, isoTo } = boundsIsoAnnata(anno);
  let oreDaValidare = 0;
  /** Validate + da_validare operative (no sola lettura) → stesso perimetro KPI/tipo/top */
  const oreAnnoPerOperai = [];

  for (const ora of oreRows) {
    if (!ora || isOraRifiutata(ora.stato)) continue;
    if (!oraInPeriodoIso(ora.data, isoFrom, isoTo)) continue;
    const stato = String(ora.stato || '');
    if (stato === 'validate') {
      oreAnnoPerOperai.push(ora);
      continue;
    }
    if (stato === 'da_validare') {
      const lav = ora.lavoroId ? lavoriById.get(String(ora.lavoroId)) : null;
      const terreno = lav ? resolveTerreno(lav.terrenoId) : null;
      if (lav && isSolaLettura(lav, terreno)) continue;
      const oreNette = typeof ora.oreNette === 'number' && Number.isFinite(ora.oreNette) ? ora.oreNette : 0;
      oreDaValidare += oreNette;
      oreAnnoPerOperai.push(ora);
    }
  }

  const aggregato = aggregaOreReport(oreAnnoPerOperai);
  const oreValidateAnno = aggregato.oreValidateTotali;

  const operaiLista = Object.values(aggregato.orePerOperaio).map((base) => {
    const user = resolveUser(base.operaioId) || {};
    return {
      operaioId: base.operaioId,
      nome: user.nome || '',
      cognome: user.cognome || '',
      tipoOperaio: user.tipoOperaio || '',
      ruoli: Array.isArray(user.ruoli) ? user.ruoli : [],
      oreTotali: base.oreTotali,
      oreValidate: base.oreValidate,
      oreDaValidare: base.oreDaValidare,
      giorniLavorati: base.giorniLavorati.size
    };
  });

  const topOperai = [...operaiLista]
    .sort((a, b) => b.oreTotali - a.oreTotali)
    .slice(0, topN)
    .map((o) => ({
      operaioId: o.operaioId,
      nomeCompleto: `${o.nome || ''} ${o.cognome || ''}`.trim() || 'N/A',
      tipoDisplay: getTipoOperaioDisplay(o),
      oreTotali: o.oreTotali,
      oreValidate: o.oreValidate
    }));

  const orePerTipo = aggregaOrePerTipoDisplay(operaiLista);
  const lavoriStats = calcolaLavoriAnnata(lavori, anno);
  const mediaMese = calcolaMediaOreGiornoPerAnnata(oreRows, anno, oggi);
  const orePerMese = aggregaOreValidatePerMeseAnnata(oreRows, anno);

  return {
    anno,
    oreValidateAnno,
    oreDaValidare,
    lavoriAttiviAnno: lavoriStats.attivi,
    lavoriCompletatiAnno: lavoriStats.completati,
    lavoriAnnullatiAnno: lavoriStats.annullati,
    mediaOreGiornoMeseCorrente: mediaMese.mediaOreGiorno,
    mediaOreGiornoEtichetta: mediaMese.etichettaMese,
    oreValidateMeseCorrente: mediaMese.oreValidateMese,
    orePerMese,
    topOperai,
    orePerTipo
  };
}
