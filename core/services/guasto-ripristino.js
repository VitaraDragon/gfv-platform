/**
 * Quali mezzi sono in guasto, e a quale stato tornano dopo annullo o chiusura.
 * Sul mezzo si scrive solo stato (in_uso, mai in-uso) e updatedAt.
 * @module core/services/guasto-ripristino
 */

import { isGuastoAttivo } from './guasto-stati.js';

function testo(v) {
  return String(v == null ? '' : v).trim();
}

function idPuliti(ids) {
  const visti = new Set();
  const out = [];
  (ids || []).forEach((id) => {
    const clean = testo(id);
    if (!clean || visti.has(clean)) return;
    visti.add(clean);
    out.push(clean);
  });
  return out;
}

function idONull(id) {
  return testo(id) || null;
}

function componente(guasto) {
  return testo(guasto && guasto.componenteGuasto).toLowerCase();
}

function eGenerico(guasto) {
  return testo(guasto && guasto.tipoGuasto).toLowerCase() === 'generico';
}

/**
 * Id dei mezzi davvero in guasto, secondo il componente.
 * Un guasto «Trattore» che ha anche attrezzoId non coinvolge l'attrezzo.
 * @param {object|null|undefined} guasto
 * @returns {string[]}
 */
export function idMezziCoinvolti(guasto) {
  if (!guasto || eGenerico(guasto)) return [];
  const comp = componente(guasto);
  if (comp === 'trattore') return idPuliti([guasto.macchinaId]);
  if (comp === 'attrezzo') return idPuliti([guasto.attrezzoId]);
  if (comp === 'entrambi') return idPuliti([guasto.macchinaId, guasto.attrezzoId]);
  if (!comp) return idPuliti([guasto.macchinaId]);
  return [];
}

/**
 * Campi mezzo da salvare in creazione. macchinaId dell'attrezzo resta
 * come riferimento: le liste del manager lo leggono da lì.
 * @param {{ componenteGuasto?: string, macchinaId?: string|null, attrezzoId?: string|null }} input
 * @returns {{ macchinaId: string|null, attrezzoId: string|null, mezziInGuasto: string[] }}
 */
export function campiMezziPerCreazione({ componenteGuasto, macchinaId, attrezzoId } = {}) {
  const comp = testo(componenteGuasto).toLowerCase();
  const macchina = idONull(macchinaId);
  const attrezzo = idONull(attrezzoId);
  if (comp === 'trattore') {
    return { macchinaId: macchina, attrezzoId: null, mezziInGuasto: idPuliti([macchina]) };
  }
  if (comp === 'attrezzo') {
    return { macchinaId: macchina, attrezzoId: attrezzo, mezziInGuasto: idPuliti([attrezzo]) };
  }
  if (comp === 'entrambi') {
    return { macchinaId: macchina, attrezzoId: attrezzo, mezziInGuasto: idPuliti([macchina, attrezzo]) };
  }
  return { macchinaId: macchina, attrezzoId: attrezzo, mezziInGuasto: [] };
}

/**
 * Mezzi da rimettere a posto, con lo stato salvato prima del guasto.
 * Senza componente si ripristina solo la macchina, come faceva la pagina.
 * @param {object|null|undefined} guasto
 * @returns {Array<{ id: string, statoPrima: string|null }>}
 */
export function mezziDaRipristinare(guasto) {
  if (!guasto || eGenerico(guasto)) return [];
  const comp = componente(guasto);
  const voci = [];
  const push = (id, statoPrima) => {
    const clean = testo(id);
    if (!clean) return;
    const prima = testo(statoPrima);
    voci.push({ id: clean, statoPrima: prima || null });
  };
  if (comp === 'attrezzo') push(guasto.attrezzoId, guasto.statoAttrezzoPrima);
  else if (comp === 'entrambi') {
    push(guasto.macchinaId, guasto.statoMacchinaPrima);
    push(guasto.attrezzoId, guasto.statoAttrezzoPrima);
  } else if (comp === 'trattore' || !comp) {
    push(guasto.macchinaId, guasto.statoMacchinaPrima);
  }
  return voci;
}

function normalizzaStatoMezzo(stato) {
  const s = testo(stato).toLowerCase();
  if (s === 'in-uso') return 'in_uso';
  return s;
}

/**
 * @param {{ statoAttuale?: string, statoPrima?: string|null, altroGuastoAttivoSulMezzo?: boolean }} input
 * @returns {{ scrivi: boolean, stato: string|null, motivo: string }}
 */
export function statoRipristinoMezzo({ statoAttuale, statoPrima, altroGuastoAttivoSulMezzo } = {}) {
  if (altroGuastoAttivoSulMezzo) {
    return { scrivi: false, stato: null, motivo: 'altro-guasto' };
  }
  const attuale = normalizzaStatoMezzo(statoAttuale);
  if (attuale !== 'guasto' && attuale !== 'guasto-lavoro-in-corso') {
    return { scrivi: false, stato: null, motivo: 'gia-cambiato' };
  }
  const prima = normalizzaStatoMezzo(statoPrima);
  if (prima === 'disponibile' || prima === 'in_uso') {
    return { scrivi: true, stato: prima, motivo: 'stato-prima' };
  }
  return {
    scrivi: true,
    stato: attuale === 'guasto-lavoro-in-corso' ? 'in_uso' : 'disponibile',
    motivo: 'senza-stato-prima'
  };
}

/**
 * Un altro guasto attivo conta solo se il mezzo è tra i mezzi coinvolti.
 * Un guasto annullato non blocca. Si guardano tutti i guasti del tenant.
 * @param {Array<object>|null|undefined} guasti
 * @param {string} mezzoId
 * @param {string} guastoId
 * @returns {boolean}
 */
export function altroGuastoAttivoSulMezzo(guasti, mezzoId, guastoId) {
  const id = testo(mezzoId);
  if (!id) return false;
  return (Array.isArray(guasti) ? guasti : []).some((g) => {
    if (!g) return false;
    if (guastoId && testo(g.id) === testo(guastoId)) return false;
    if (!isGuastoAttivo(g.stato)) return false;
    return idMezziCoinvolti(g).includes(id);
  });
}
