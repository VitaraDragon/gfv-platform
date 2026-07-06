/**
 * Costanti Modulo Vendemmia Meccanica (CT)
 * @module modules/vendemmia-meccanica/config/vm-constants
 */

/** ID modulo licenza */
export const MODULE_ID = 'vendemmiaMeccanica';

/** Modulo obbligatorio per dati clienti/terreni */
export const REQUIRES_MODULES = ['contoTerzi'];

/** Tipi palo per griglia tariffe (chiave tariffa: `${morfologia}-${tipoPalo}`) */
export const TIPI_PALO_VM = ['ferro', 'legno', 'cemento', 'personalizzata'];

/** Morfologie terreno (allineate a tipoCampo CT) */
export const MORFOLOGIE_VM = ['pianura', 'collina', 'montagna'];

/**
 * Destinazioni trasporto uva (€/qli) — preset tenant, estendibili in impostazioni.
 * @type {Array<{ id: string, label: string }>}
 */
export const DESTINAZIONI_TRASPORTO_PRESET = [
  { id: 'sociale', label: 'Cantina sociale' },
  { id: 'intesa', label: 'Intesa' },
  { id: 'colli', label: 'Colli' },
  { id: 'altro', label: 'Altro' },
  { id: 'personalizzata', label: 'Personalizzata' }
];

/** Documento Firestore tariffe tenant */
export const TARIFFE_VM_DOC_PATH = 'tariffe-vendemmia-meccanica';

/** Collections tenant */
export const CALCOLI_VM_COLLECTION = 'calcoli-vendemmia-meccanica';
export const SPESE_VM_COLLECTION = 'spese-vendemmia-meccanica';

/**
 * Coefficienti sesto impianto (modello O4-B: morf×palo × coeff).
 * Chiavi derivate da distanza fila/ceppo o preset futuro.
 */
export const COEFFICIENTI_SESTO_DEFAULT = {
  standard: 1.0,
  stretto: 1.1,
  largo: 0.95
};

/**
 * Deriva chiave coefficiente sesto da distanze (m).
 * @param {{ distanzaFile?: number, distanzaCeppo?: number } | null} sesto
 * @returns {string}
 */
export function deriveSestoPresetKey(sesto) {
  if (!sesto || typeof sesto !== 'object') return 'standard';
  const df = Number(sesto.distanzaFile);
  const dc = Number(sesto.distanzaCeppo);
  if (!Number.isFinite(df) || !Number.isFinite(dc) || df <= 0 || dc <= 0) return 'standard';
  const densita = 10000 / (df * dc);
  if (densita >= 4500) return 'stretto';
  if (densita <= 2500) return 'largo';
  return 'standard';
}

/**
 * Coefficiente numerico per sesto impianto.
 * @param {{ distanzaFile?: number, distanzaCeppo?: number } | null} sesto
 * @param {Record<string, number>} [coefficienti]
 * @returns {number}
 */
export function getCoefficienteSesto(sesto, coefficienti) {
  const map = coefficienti && typeof coefficienti === 'object'
    ? { ...COEFFICIENTI_SESTO_DEFAULT, ...coefficienti }
    : COEFFICIENTI_SESTO_DEFAULT;
  const key = deriveSestoPresetKey(sesto);
  const coeff = map[key];
  return Number.isFinite(Number(coeff)) ? Number(coeff) : 1;
}

/**
 * Chiave tariffa vendemmia morfologia × tipo palo.
 * @param {string} morfologia
 * @param {string} tipoPalo
 * @returns {string}
 */
export function tariffaVmKey(morfologia, tipoPalo) {
  return `${String(morfologia || '').toLowerCase()}-${String(tipoPalo || '').toLowerCase()}`;
}

/**
 * Anno corrente per stato stagione VM.
 * @returns {number}
 */
export function getAnnoStagioneCorrente() {
  return new Date().getFullYear();
}

export default {
  MODULE_ID,
  REQUIRES_MODULES,
  TIPI_PALO_VM,
  MORFOLOGIE_VM,
  DESTINAZIONI_TRASPORTO_PRESET,
  TARIFFE_VM_DOC_PATH,
  CALCOLI_VM_COLLECTION,
  SPESE_VM_COLLECTION,
  COEFFICIENTI_SESTO_DEFAULT,
  deriveSestoPresetKey,
  getCoefficienteSesto,
  tariffaVmKey,
  getAnnoStagioneCorrente
};
