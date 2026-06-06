/**
 * Catalogo tipi assenza e stati segnalazione/conferma (giornata intera).
 * @module core/config/manodopera-assenze-config
 */

export const ASSENZA_STATO_SEGNALATA = 'segnalata';
export const ASSENZA_STATO_CONFERMATA = 'confermata';
export const ASSENZA_STATO_ANNULLATA = 'annullata';

export const ASSENZA_CANALE_CAPOSQUADRA = 'caposquadra';
export const ASSENZA_CANALE_MANAGER_DIRETTO = 'manager_diretto';
export const ASSENZA_CANALE_MANAGER = 'manager';

export const ASSENZA_TIPI = Object.freeze([
  { id: 'malattia', label: 'Malattia' },
  { id: 'ferie', label: 'Ferie' },
  { id: 'permesso', label: 'Permesso' },
  { id: 'infortunio', label: 'Infortunio' },
  { id: 'non_presenza', label: 'Non presenza / giustificata in sede' },
  { id: 'altro', label: 'Altro' }
]);

export const LAVORO_STAND_BY_CAUSA_ASSENZA = 'assenza_personale';

/** Stati lavoro ammessi prima di passare a in_standby per assenza */
export const LAVORO_STATI_STANDBY_AMMESSI = Object.freeze([
  'da_pianificare',
  'assegnato',
  'in_corso'
]);

/**
 * @param {string} tipo
 * @returns {string}
 */
export function getAssenzaTipoLabel(tipo) {
  const row = ASSENZA_TIPI.find((t) => t.id === tipo);
  return row ? row.label : tipo || 'Assenza';
}

/**
 * @param {Date|string} value
 * @returns {string} YYYY-MM-DD
 */
export function toGiornoKey(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {string} giornoKey YYYY-MM-DD
 * @param {string} dataInizioGiorno
 * @param {string} dataFineGiorno
 * @returns {boolean}
 */
export function giornoInIntervalloAssenza(giornoKey, dataInizioGiorno, dataFineGiorno) {
  if (!giornoKey || !dataInizioGiorno || !dataFineGiorno) return false;
  return giornoKey >= dataInizioGiorno && giornoKey <= dataFineGiorno;
}
