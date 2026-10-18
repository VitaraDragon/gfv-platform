/**
 * Testo e avviso del riquadro ore quando la lettura non riesce.
 * La pagina dipinge solo questo risultato.
 */
import { t, leggiLinguaCampo } from '../../services/field-ui-i18n.js';

function linguaRiquadro() {
  try {
    return leggiLinguaCampo(typeof localStorage !== 'undefined' ? localStorage : null);
  } catch (error) {
    return 'it';
  }
}

/**
 * Giorno da leggere: quello passato dal salvataggio, altrimenti il campo data, altrimenti oggi.
 * @param {string} [giornoForzato]
 * @param {string} [valoreCampo]
 * @param {string} [oggi]
 * @returns {string}
 */
export function giornoRiquadroOre(giornoForzato, valoreCampo, oggi) {
  const forzato = String(giornoForzato || '').trim();
  if (forzato) return forzato;
  const campo = String(valoreCampo || '').trim();
  if (campo) return campo;
  return String(oggi || '').trim();
}

/**
 * Cambio giorno: titolo nuovo e testo di attesa. Le righe del giorno prima non restano.
 * @param {string} titolo
 * @param {string} testoCaricamento
 * @returns {{ titolo: string, corpo: string, righe: [] }}
 */
export function vistaOreGiornoInAttesa(titolo, testoCaricamento) {
  return {
    titolo: String(titolo || ''),
    corpo: String(testoCaricamento || ''),
    righe: []
  };
}

export function testoRiquadroOreNonDisponibile(etichettaGiorno) {
  const giorno = String(etichettaGiorno || '').trim();
  return t('ore.boxUnavailable', linguaRiquadro(), { giorno: giorno });
}

/**
 * @param {{ codice?: string, etichettaGiorno?: string, dopoSalvataggio?: boolean }} [input]
 * @returns {{ testo: string, dataState: 'ready', avviso: string, mantieniPrecedente: boolean }}
 */
export function esitoRiquadroOreSuErrore({ codice, etichettaGiorno, dopoSalvataggio } = {}) {
  const permesso = String(codice || '') === 'permission-denied';
  const dopo = Boolean(dopoSalvataggio);
  return {
    testo: testoRiquadroOreNonDisponibile(etichettaGiorno),
    dataState: 'ready',
    avviso: dopo && !permesso
      ? t('ore.boxReread', linguaRiquadro())
      : '',
    mantieniPrecedente: dopo
  };
}

/**
 * Un solo avviso in console per sessione, anche se la data cambia più volte.
 * @param {(...args: unknown[]) => void} [warn]
 */
export function creaSegnalatoreRiquadroOre(warn) {
  let gia = false;
  return function segnala(passo, codice) {
    if (gia) return false;
    gia = true;
    const fn = typeof warn === 'function' ? warn : console.warn;
    fn('[FIELD-WORKSPACE] Riquadro ore giorno non leggibile:', passo || 'ore', codice || '');
    return true;
  };
}

/**
 * Equivalente puro di aggiornaRiquadroOreGiorno quando la lettura lancia.
 * @param {() => Promise<unknown>} leggi
 * @param {{ etichettaGiorno?: string, dopoSalvataggio?: boolean, segnala?: function }} [opts]
 */
export async function esitoLetturaRiquadroOre(leggi, opts) {
  const o = opts || {};
  try {
    const righe = await leggi();
    return { ok: true, righe: righe, dataState: 'ready', testo: '', avviso: '' };
  } catch (error) {
    const codice = error && error.code ? String(error.code) : '';
    const passo = error && error.passoLetturaOre ? String(error.passoLetturaOre) : 'ore';
    if (typeof o.segnala === 'function') o.segnala(passo, codice);
    const vista = esitoRiquadroOreSuErrore({
      codice: codice,
      etichettaGiorno: o.etichettaGiorno,
      dopoSalvataggio: o.dopoSalvataggio
    });
    return {
      ok: false,
      codice: codice,
      passo: passo,
      testo: vista.testo,
      dataState: vista.dataState,
      avviso: vista.avviso,
      mantieniPrecedente: vista.mantieniPrecedente
    };
  }
}
