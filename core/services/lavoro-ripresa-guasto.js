/**
 * Ripresa di un lavoro sospeso perché un guasto è stato risolto.
 *
 * Preferisce `statoPrimaSospensione` salvato alla sospensione (assegnato | in_corso).
 * Se manca (lavori sospesi prima di quella chiave), ricostruisce da avanzamento
 * come prima. Il campo viene azzerato nella stessa patch.
 *
 * Mai `stato: 'attivo'`: non è uno stato del lavoro.
 *
 * @module core/services/lavoro-ripresa-guasto
 */

import { isGuastoAttivo, isGuastoChiuso } from './guasto-stati.js';

/** Marcatore testabile: la pagina lo sostituisce con deleteField(). */
export const AZZERA_CAMPO = Object.freeze({ __delete: true });

export const STATI_SELECT_MODIFICA = Object.freeze([
  'da_pianificare',
  'assegnato',
  'in_corso',
  'sospeso',
  'completato',
  'annullato'
]);

const MOTIVI_STORICI = Object.freeze(['Guasto macchina grave', 'Segnalazione grave']);

function testo(v) {
  return String(v || '').trim();
}

function iniziaConGuastoOSegnalazione(causa) {
  const t = testo(causa).toLowerCase();
  return t.startsWith('guasto') || t.startsWith('segnalazione grave');
}

/**
 * @param {object|null|undefined} lavoro
 * @returns {boolean}
 */
export function lavoroSospesoDaGuasto(lavoro) {
  if (!lavoro || testo(lavoro.stato).toLowerCase() !== 'sospeso') return false;
  const causa = testo(lavoro.sospensioneCausa);
  if (causa) return iniziaConGuastoOSegnalazione(causa);
  return MOTIVI_STORICI.includes(testo(lavoro.motivoSospensione));
}

function numeroPositivo(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function haOreOZone(lavoro) {
  if (Array.isArray(lavoro.zoneLavorate) && lavoro.zoneLavorate.length > 0) return true;
  if (Array.isArray(lavoro.ore) && lavoro.ore.length > 0) return true;
  return numeroPositivo(lavoro.zoneLavorateCount)
    || numeroPositivo(lavoro.oreRegistrate)
    || numeroPositivo(lavoro.oreTotali);
}

/**
 * Stato attivo precedente, ricostruito dai dati già sul lavoro.
 * Con avanzamento (percentuale, superficie, ore o zone) → in_corso, altrimenti assegnato.
 * Usato solo se manca `statoPrimaSospensione` (lavori sospesi prima di quella chiave).
 * @param {object|null|undefined} lavoro
 * @returns {'in_corso'|'assegnato'}
 */
export function statoDopoRipresa(lavoro) {
  const lav = lavoro || {};
  const salvato = testo(lav.statoPrimaSospensione).toLowerCase();
  if (salvato === 'assegnato' || salvato === 'in_corso') return salvato;
  if (numeroPositivo(lav.percentualeCompletamento) || numeroPositivo(lav.superficieTotaleLavorata) || numeroPositivo(lav.superficieLavorata) || haOreOZone(lav)) {
    return 'in_corso';
  }
  return 'assegnato';
}

/**
 * @param {object|null|undefined} lavoro
 * @param {Date|object|string|number} now
 * @returns {{ stato: string, sospensioneCausa: object, sospensioneIl: object, statoPrimaSospensione: object, aggiornatoIl: Date|object|string|number }}
 */
export function buildRiprendiLavoroPatch(lavoro, now) {
  return {
    stato: statoDopoRipresa(lavoro),
    sospensioneCausa: AZZERA_CAMPO,
    sospensioneIl: AZZERA_CAMPO,
    statoPrimaSospensione: AZZERA_CAMPO,
    aggiornatoIl: now
  };
}

/**
 * Sostituisce i marcatori con il risultato di deleteField().
 * @param {object} patch
 * @param {Function} deleteFieldFn
 */
export function patchRipresaPerFirestore(patch, deleteFieldFn) {
  const azzera = () => (typeof deleteFieldFn === 'function' ? deleteFieldFn() : AZZERA_CAMPO);
  const src = patch || {};
  const out = {
    stato: src.stato,
    sospensioneCausa: src.sospensioneCausa && src.sospensioneCausa.__delete ? azzera() : src.sospensioneCausa,
    sospensioneIl: src.sospensioneIl && src.sospensioneIl.__delete ? azzera() : src.sospensioneIl,
    aggiornatoIl: src.aggiornatoIl
  };
  if (src.statoPrimaSospensione && src.statoPrimaSospensione.__delete) {
    out.statoPrimaSospensione = azzera();
  } else if (src.statoPrimaSospensione !== undefined) {
    out.statoPrimaSospensione = src.statoPrimaSospensione;
  }
  return out;
}

function guastoAncoraAperto(guasto) {
  return isGuastoAttivo(guasto && guasto.stato);
}

/**
 * Altri guasti aperti con lo stesso lavoroId. Il guasto appena risolto è escluso.
 * @param {Array} guasti
 * @param {string} lavoroId
 * @param {string} guastoIdCorrente
 */
export function haAltriGuastiApertiStessoLavoro(guasti, lavoroId, guastoIdCorrente) {
  const id = testo(lavoroId);
  if (!id) return false;
  return (Array.isArray(guasti) ? guasti : []).some((g) => {
    if (!g || testo(g.lavoroId) !== id) return false;
    if (guastoIdCorrente && testo(g.id) === testo(guastoIdCorrente)) return false;
    return guastoAncoraAperto(g);
  });
}

/**
 * @param {{ lavoro?: object, guasti?: Array, guastoId?: string }} input
 * @returns {{ riprendi: boolean, motivo: string }}
 */
export function esitoRipresaDopoGuasto({ lavoro, guasti, guastoId } = {}) {
  if (!lavoroSospesoDaGuasto(lavoro)) {
    return { riprendi: false, motivo: 'non-sospeso-da-guasto' };
  }
  const lavoroId = lavoro.id || lavoro.lavoroId;
  if (haAltriGuastiApertiStessoLavoro(guasti, lavoroId, guastoId)) {
    return { riprendi: false, motivo: 'altro-guasto' };
  }
  return { riprendi: true, motivo: 'ok' };
}

function etichettaStatoRipresa(stato) {
  const s = testo(stato).toLowerCase();
  if (s === 'in_corso') return 'In corso';
  if (s === 'assegnato') return 'Assegnato';
  return '';
}

/**
 * @param {string} nomeLavoro
 * @param {{ ripreso?: boolean, altroGuasto?: boolean, fallita?: boolean, stato?: string }} esito
 */
export function testoToastRipresa(nomeLavoro, esito = {}) {
  if (esito.fallita) {
    return 'Guasto risolto, ma non ho potuto riprendere il lavoro: riprendilo da Gestione lavori.';
  }
  if (esito.altroGuasto) {
    return 'Guasto risolto. Il lavoro è ancora sospeso per un altro guasto.';
  }
  if (esito.ripreso) {
    const nome = testo(nomeLavoro) || 'senza nome';
    const etichetta = etichettaStatoRipresa(esito.stato);
    if (etichetta) {
      return `Guasto risolto. Il lavoro "${nome}" è ripreso (${etichetta}).`;
    }
    return `Guasto risolto. Il lavoro "${nome}" è ripreso.`;
  }
  return 'Guasto risolto.';
}

/**
 * Pulsante di sicurezza sul guasto già risolto, finché il lavoro è sospeso da guasto.
 */
export function mostraRiprendiLavoro(guasto, lavoro) {
  if (!guasto || !testo(guasto.lavoroId)) return false;
  if (!isGuastoChiuso(guasto.stato)) return false;
  return lavoroSospesoDaGuasto(lavoro);
}

/**
 * Valore della select Modifica. `attivo` (dato vecchio) diventa in_corso.
 * Uno stato sconosciuto non viene salvato in silenzio.
 * @param {string} stato
 * @returns {{ valore: string, nonValido: boolean, etichettaExtra: string }}
 */
export function statoPerSelectModifica(stato) {
  const s = testo(stato);
  if (s.toLowerCase() === 'attivo') {
    return { valore: 'in_corso', nonValido: false, etichettaExtra: '' };
  }
  if (STATI_SELECT_MODIFICA.includes(s)) {
    return { valore: s, nonValido: false, etichettaExtra: '' };
  }
  if (!s) {
    return { valore: 'assegnato', nonValido: false, etichettaExtra: '' };
  }
  return {
    valore: '__non_valido__',
    nonValido: true,
    etichettaExtra: `Stato non valido: ${s}`
  };
}

/**
 * Messaggio se la select non ha uno stato ammesso. Stringa vuota = si può salvare.
 * @param {string} valoreSelect
 * @returns {string}
 */
export function erroreSalvataggioStato(valoreSelect) {
  const v = testo(valoreSelect);
  if (!v || v === '__non_valido__' || !STATI_SELECT_MODIFICA.includes(v)) {
    return 'Seleziona uno stato valido prima di salvare.';
  }
  return '';
}
