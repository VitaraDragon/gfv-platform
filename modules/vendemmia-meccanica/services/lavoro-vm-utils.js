/**
 * Riconoscimento lavori/preventivi vendemmia meccanica CT.
 * @module modules/vendemmia-meccanica/services/lavoro-vm-utils
 */

const VM_TIPO_KEYWORDS = [
  'vendemmia meccanica',
  'vendemmia meccanizzata',
  'vendemmia meccanizzata ct',
  'vendemmia meccanica ct'
];

const PREVENTIVO_ACCETTATO_STATI = ['accettato_email', 'accettato_manager'];

/**
 * @param {string} tipoLavoro
 * @returns {boolean}
 */
export function isTipoLavoroVendemmiaMeccanica(tipoLavoro) {
  const tipo = String(tipoLavoro || '').toLowerCase().trim();
  if (!tipo) return false;
  if (VM_TIPO_KEYWORDS.some((k) => tipo.includes(k))) return true;
  return tipo.includes('vendemmia') && tipo.includes('meccan');
}

/**
 * @param {Object|null|undefined} preventivo
 * @returns {boolean}
 */
export function isPreventivoVendemmiaMeccanica(preventivo) {
  if (!preventivo) return false;
  return isTipoLavoroVendemmiaMeccanica(preventivo.tipoLavoro);
}

/**
 * @param {string|null|undefined} stato
 * @returns {boolean}
 */
export function isPreventivoAccettato(stato) {
  return PREVENTIVO_ACCETTATO_STATI.includes(String(stato || '').trim());
}

/**
 * Anno stagione VM da data prevista preventivo o anno corrente.
 * @param {Object|null|undefined} preventivo
 * @param {number} [fallbackAnno]
 * @returns {number}
 */
export function deriveAnnoStagioneFromPreventivo(preventivo, fallbackAnno) {
  const raw = preventivo?.dataPrevista;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.getFullYear();
  if (raw && typeof raw === 'object' && typeof raw.toDate === 'function') {
    const d = raw.toDate();
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d.getFullYear();
  }
  if (typeof raw === 'string' && raw.length >= 4) {
    const y = Number(raw.slice(0, 4));
    if (Number.isFinite(y) && y >= 2000 && y <= 2100) return y;
  }
  const fb = fallbackAnno ?? new Date().getFullYear();
  return Number.isFinite(Number(fb)) ? Number(fb) : new Date().getFullYear();
}

/**
 * @param {Object|null|undefined} lavoro
 * @param {{ hasVmModule?: boolean }} [options]
 * @returns {boolean}
 */
export function isLavoroVendemmiaMeccanica(lavoro, options = {}) {
  if (!lavoro) return false;
  if (options.hasVmModule === false) return false;

  if (isTipoLavoroVendemmiaMeccanica(lavoro.tipoLavoro)) return true;

  // Lavoro CT collegato a preventivo/cliente con modulo VM attivo
  if (options.hasVmModule !== false && lavoro.clienteId && lavoro.preventivoId) {
    if (String(lavoro.tipoLavoro || '').toLowerCase().includes('vendemmia')) return true;
  }

  return false;
}

/**
 * @param {Object|null|undefined} stato — vendemmiaMeccanica[anno]
 * @param {string} lavoroId
 * @returns {boolean}
 */
/** Stati lavoro da cui è sensato aprire il calcolatore compenso. */
export const CALCOLATORE_VM_LAVORO_STATI = ['completato', 'completato_da_approvare'];

/**
 * Lavoro VM completato/in approvazione con cliente e terreno → shortcut calcolatore.
 * @param {Object|null|undefined} lavoro
 * @param {{ hasVmModule?: boolean }} [options]
 * @returns {boolean}
 */
export function isLavoroEligibleForCalcolatoreShortcut(lavoro, options = {}) {
  if (!isLavoroVendemmiaMeccanica(lavoro, options)) return false;
  if (!lavoro?.clienteId || !lavoro?.terrenoId) return false;
  return CALCOLATORE_VM_LAVORO_STATI.includes(String(lavoro.stato || '').trim());
}

export function isPianoStagioneLinkedToLavoro(stato, lavoroId) {
  if (!stato?.vendemmiato || !lavoroId) return false;
  if (!stato.lavoroId) return true;
  return stato.lavoroId === lavoroId;
}

/** % minima tracciata per inviare al manager (lavori standard). */
export const SOGLIA_SEGNA_COMPLETATO_PERCENT = 90;
/** Lavori di ripresa: il resto era sul lavoro sospeso. */
export const SOGLIA_SEGNA_COMPLETATO_PERCENT_RIPRESA = 2;
/** Vendemmia meccanica: consente chiusura parziale (es. 75% campo). */
export const SOGLIA_SEGNA_COMPLETATO_PERCENT_VM = 10;
/** Sotto questa % il completamento VM è considerato «parziale». */
export const SOGLIA_COMPLETAMENTO_PIENO_PERCENT = 90;

/**
 * Soglia minima % tracciata per mostrare «invia al manager».
 * @param {Object|null|undefined} lavoro
 * @param {{ hasVmModule?: boolean }} [options]
 * @returns {number}
 */
export function getSogliaMinimaSegnaCompletato(lavoro, options = {}) {
  if (lavoro?.ripresaDaLavoroId) return SOGLIA_SEGNA_COMPLETATO_PERCENT_RIPRESA;
  if (isLavoroVendemmiaMeccanica(lavoro, options)) return SOGLIA_SEGNA_COMPLETATO_PERCENT_VM;
  return SOGLIA_SEGNA_COMPLETATO_PERCENT;
}

/**
 * @param {number|string|null|undefined} percentuale
 * @param {Object|null|undefined} lavoro
 * @param {{ hasVmModule?: boolean }} [options]
 * @returns {boolean}
 */
export function isCompletamentoParzialeTracciato(percentuale, lavoro, options = {}) {
  const perc = Number(percentuale);
  if (!Number.isFinite(perc)) return false;
  if (lavoro?.completamentoParziale === true) return true;
  if (perc >= SOGLIA_COMPLETAMENTO_PIENO_PERCENT) return false;
  if (lavoro?.ripresaDaLavoroId) return perc < SOGLIA_COMPLETAMENTO_PIENO_PERCENT;
  return isLavoroVendemmiaMeccanica(lavoro, options);
}

/**
 * @param {number|string|null|undefined} percentuale
 * @param {Object|null|undefined} lavoro
 * @param {{ hasVmModule?: boolean }} [options]
 * @returns {string}
 */
export function getEtichettaSegnaCompletato(percentuale, lavoro, options = {}) {
  if (isCompletamentoParzialeTracciato(percentuale, lavoro, options)) {
    return 'Invia chiusura parziale al manager';
  }
  return 'Segna come Completato';
}

/**
 * Conta zone lavorate con la stessa data (YYYY-MM-DD).
 * @param {Array<{ data?: Date|null, dataKeyString?: string }>} zone
 * @param {string} dateKey - YYYY-MM-DD
 */
export function countZoneLavorateSameDay(zone, dateKey) {
  if (!Array.isArray(zone) || !dateKey) return 0;
  return zone.filter((z) => {
    if (z.dataKeyString) return z.dataKeyString === dateKey;
    if (!z.data) return false;
    const d = z.data instanceof Date ? z.data : new Date(z.data);
    if (Number.isNaN(d.getTime())) return false;
    return d.toISOString().split('T')[0] === dateKey;
  }).length;
}

/**
 * Normalizza data zona in chiave YYYY-MM-DD.
 * @param {Date|string|{ toDate?: Function }|null} raw
 * @returns {string|null}
 */
export function toDateKeyString(raw) {
  if (!raw) return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw.toISOString().split('T')[0];
  }
  if (typeof raw === 'object' && typeof raw.toDate === 'function') {
    return toDateKeyString(raw.toDate());
  }
  if (typeof raw === 'string') {
    return raw.length >= 10 ? raw.slice(0, 10) : raw;
  }
  return null;
}

export default {
  isTipoLavoroVendemmiaMeccanica,
  isPreventivoVendemmiaMeccanica,
  isPreventivoAccettato,
  deriveAnnoStagioneFromPreventivo,
  isLavoroVendemmiaMeccanica,
  isLavoroEligibleForCalcolatoreShortcut,
  CALCOLATORE_VM_LAVORO_STATI,
  isPianoStagioneLinkedToLavoro,
  countZoneLavorateSameDay,
  toDateKeyString,
  SOGLIA_SEGNA_COMPLETATO_PERCENT,
  SOGLIA_SEGNA_COMPLETATO_PERCENT_RIPRESA,
  SOGLIA_SEGNA_COMPLETATO_PERCENT_VM,
  SOGLIA_COMPLETAMENTO_PIENO_PERCENT,
  getSogliaMinimaSegnaCompletato,
  isCompletamentoParzialeTracciato,
  getEtichettaSegnaCompletato
};
