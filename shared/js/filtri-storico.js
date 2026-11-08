/**
 * Filtri dello storico e clic sulle schede (pelle Proposta / telefono).
 * Le tendine di inserimento restano solo sugli impianti aperti.
 * @module shared/js/filtri-storico
 */

import { nomeTerrenoPerStorico, terreniOperativi } from './terreno-archivio.js';

export const MESSAGGIO_APERTURA_TRATTAMENTO = 'Non riesco ad aprire il trattamento.';

export function messaggioAperturaTrattamento(err) {
  const testo = err && err.message ? String(err.message).trim() : '';
  return testo || MESSAGGIO_APERTURA_TRATTAMENTO;
}

/**
 * Apre il modulo. Se l'apertura fallisce, l'avviso è visibile e l'errore non resta solo in console.
 * @param {() => (void|Promise<void>)} apri
 * @param {(messaggio: string, tipo?: string) => void} avvisa
 */
export async function apriConAvviso(apri, avvisa) {
  try {
    await apri();
  } catch (err) {
    console.error(err);
    if (typeof avvisa === 'function') avvisa(messaggioAperturaTrattamento(err), 'error');
  }
}

/**
 * Modifica, Completa ed Elimina anche sulla copia in scheda.
 * Il contenitore è la tabella (desktop) e, sul telefono, le schede appese allo stesso nodo.
 * @param {Element|null|undefined} container
 * @param {{ onEdit?: Function, onCompleta?: Function, onDelete?: Function, onError?: Function }} handlers
 */
export function bindAzioniLista(container, handlers = {}) {
  if (!container || container.getAttribute('data-azioni-lista') === '1') return;
  container.setAttribute('data-azioni-lista', '1');
  container.addEventListener('click', (event) => {
    const nodo = event.target && event.target.nodeType === 1
      ? event.target
      : event.target && event.target.parentElement;
    if (!nodo || typeof nodo.closest !== 'function') return;
    const edit = nodo.closest('[data-edit-row]');
    const completa = nodo.closest('[data-completa-row]');
    const remove = nodo.closest('[data-delete-row]');
    const voce = edit
      ? { fn: handlers.onEdit, idx: edit.getAttribute('data-edit-row') }
      : completa
        ? { fn: handlers.onCompleta, idx: completa.getAttribute('data-completa-row') }
        : remove
          ? { fn: handlers.onDelete, idx: remove.getAttribute('data-delete-row') }
          : null;
    if (!voce || typeof voce.fn !== 'function') return;
    const indice = Number(voce.idx);
    Promise.resolve()
      .then(() => voce.fn(indice))
      .catch((err) => {
        if (typeof handlers.onError === 'function') handlers.onError(err);
      });
  });
}

export function mostraArchiviatiSelezionato(doc = typeof document !== 'undefined' ? document : null) {
  const box = doc && doc.getElementById ? doc.getElementById('filter-mostra-archiviati') : null;
  return !!(box && box.checked);
}

/** Filtro elenco: con la spunta anche gli impianti chiusi. */
export function impiantiPerFiltro(impianti, mostraArchiviati) {
  const list = Array.isArray(impianti) ? impianti : [];
  if (mostraArchiviati) return list.slice();
  return list.filter((item) => item && item.statoImpianto !== 'chiuso');
}

/** Tendina di inserimento: solo impianti non chiusi. */
export function impiantiPerInserimento(impianti) {
  return impiantiPerFiltro(impianti, false);
}

/** Filtro terreno: con la spunta anche gli archiviati. */
export function terreniPerFiltro(terreni, mostraArchiviati) {
  const list = Array.isArray(terreni) ? terreni : [];
  if (mostraArchiviati) return list.slice();
  return terreniOperativi(list);
}

/**
 * Nome in riga o in tendina di storico. L'anagrafe vince sul nome copiato nel movimento.
 * @param {object|null|undefined} terreno
 * @param {string} [nomeSnapshot]
 */
export function nomeAppezzamentoConsumo(terreno, nomeSnapshot = '') {
  if (terreno) return nomeTerrenoPerStorico(terreno, nomeSnapshot || '-');
  return String(nomeSnapshot || '').trim();
}
