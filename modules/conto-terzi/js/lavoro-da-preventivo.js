/**
 * Creazione lavoro da preventivo conto terzi.
 * Con Manodopera: nasce da_pianificare (completa in Gestione lavori).
 * Senza Manodopera: nasce in_corso (registra nel Diario Conto Terzi).
 *
 * @module modules/conto-terzi/js/lavoro-da-preventivo
 */

import { registroLavoriHref } from '../../../core/config/manodopera-diario-gate.js';

/**
 * @param {object} preventivo
 * @param {{ hasManodopera?: boolean, terrenoId?: string|null, creatoDa?: string|null, now?: Date }} [opts]
 * @returns {{
 *   lavoroData: object,
 *   stato: 'da_pianificare'|'in_corso',
 *   toastMessage: string,
 *   registroHref: string
 * }}
 */
export function lavoroDaPreventivo(preventivo, opts = {}) {
  const hasManodopera = !!opts.hasManodopera;
  const stato = hasManodopera ? 'da_pianificare' : 'in_corso';
  const clienteLabel = preventivo?.clienteLabel || '';
  const tipo = preventivo?.tipoLavoro || 'Lavoro';
  const coltura = preventivo?.coltura || '';
  const nome =
    preventivo?.nomeLavoro ||
    `${tipo}${coltura ? ` - ${coltura}` : ''}${clienteLabel ? ` (${clienteLabel})` : ''}`;

  let dataInizio = opts.now instanceof Date ? opts.now : new Date();
  if (preventivo?.dataPrevista?.toDate) {
    dataInizio = preventivo.dataPrevista.toDate();
  } else if (preventivo?.dataPrevista instanceof Date) {
    dataInizio = preventivo.dataPrevista;
  }

  const noteBase = `Lavoro creato da preventivo ${preventivo?.numero || ''}.\n${preventivo?.note || ''}`.trim();

  const lavoroData = {
    nome,
    terrenoId: opts.terrenoId != null ? opts.terrenoId : preventivo?.terrenoId || null,
    tipoLavoro: tipo,
    clienteId: preventivo?.clienteId || null,
    preventivoId: preventivo?.id || null,
    dataInizio,
    durataPrevista: 1,
    stato,
    note: noteBase,
    creatoDa: opts.creatoDa || null
  };

  const registroHref = registroLavoriHref({
    hasManodopera,
    stato,
    from: 'module'
  });

  const toastMessage = hasManodopera
    ? 'Lavoro creato con successo! Ora puoi completare la pianificazione dalla pagina Gestione Lavori.'
    : 'Lavoro creato: registra le giornate nel Diario Conto Terzi';

  return { lavoroData, stato, toastMessage, registroHref };
}

/**
 * Lavori selezionabili nel Diario CT (tendina e schede).
 * Senza Manodopera include anche i CT ancora `da_pianificare` (legacy bloccati).
 *
 * @param {Array<object>} lavoriList
 * @param {{ hasManodopera?: boolean, statoFiltro?: string|null }} [opts]
 * @returns {Array<object>}
 */
export function filtraLavoriPerDiarioContoTerzi(lavoriList = [], opts = {}) {
  const hasManodopera = !!opts.hasManodopera;
  const statoFiltro = opts.statoFiltro || null;
  const list = Array.isArray(lavoriList) ? lavoriList : [];

  if (statoFiltro) {
    return list.filter((l) => l.stato === statoFiltro);
  }

  return list.filter((l) => {
    if (l.stato === 'in_corso') return true;
    if (
      !hasManodopera &&
      l.stato === 'da_pianificare' &&
      l.clienteId != null &&
      l.clienteId !== ''
    ) {
      return true;
    }
    return false;
  });
}
