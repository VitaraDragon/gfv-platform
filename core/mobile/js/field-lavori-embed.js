/**
 * Indirizzi del dettaglio lavoro incorporato nel workspace del campo.
 * Nessun ws=classic: quel parametro lo legge solo la dashboard.
 */

export const VERSIONE_LAVORI_CAMPO = '20260904c';

/**
 * Iframe del dettaglio: sempre embed=mobile, mai ws=classic.
 * @param {{ lavoroId?: string, versione?: string }} [input]
 * @returns {string}
 */
export function urlDettaglioLavoroIncorporato({ lavoroId, versione } = {}) {
  const params = new URLSearchParams();
  params.set('v', versione || VERSIONE_LAVORI_CAMPO);
  if (lavoroId) params.set('focusLavoroId', String(lavoroId));
  params.set('embed', 'mobile');
  return '../admin/lavori-caposquadra-standalone.html?' + params.toString();
}

/**
 * «Vedi tutti» / «Mostra tutti»: nell'iframe resta la vista incorporata.
 * @param {{ inIframe?: boolean }} [input]
 * @returns {string}
 */
export function hrefElencoLavoriCampo({ inIframe } = {}) {
  if (inIframe) return 'lavori-caposquadra-standalone.html?embed=mobile';
  return 'lavori-caposquadra-standalone.html';
}
