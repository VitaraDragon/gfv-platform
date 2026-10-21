/**
 * Banner «assenze da gestire» (Gestione lavori e Impegni giornalieri).
 * Puro: nessun import Firebase.
 *
 * La fonte dei lavori in standby è il lavoro stesso (stato in_standby + standbyAssenzaId):
 * il riferimento si azzera quando il lavoro riceve il sostituto o torna dallo standby.
 * standbyLavoroId sull'assenza resta solo come storico (tiene l'ultimo lavoro) e qui non si usa.
 *
 * @module core/services/assenze-banner-logic
 */

export const MSG_STANDBY_NON_VERIFICATO = 'Non riesco a controllare i lavori in standby, riprova.';

/**
 * Lavori ancora in standby per ogni assenza.
 * @param {Array<Object>} lavori
 * @returns {Map<string, Array<{ id: string, nome: string }>>}
 */
export function lavoriStandbyPerAssenza(lavori) {
  const map = new Map();
  (Array.isArray(lavori) ? lavori : []).forEach((l) => {
    if (!l || !l.id || l.stato !== 'in_standby' || !l.standbyAssenzaId) return;
    const key = String(l.standbyAssenzaId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ id: String(l.id), nome: l.nome || '' });
  });
  return map;
}

/**
 * Segnalata: sempre da gestire. Confermata: da gestire finché ha almeno un lavoro in standby.
 * Senza lista (lettura dei lavori fallita): confermata senza sostituto, così il manager la vede.
 * @param {Object} a assenza normalizzata
 * @param {Array<{ id: string }>|null|undefined} lavoriInStandby
 * @returns {boolean}
 */
export function assenzaDaGestireNelBanner(a, lavoriInStandby) {
  if (!a) return false;
  if (a.stato === 'segnalata') return true;
  if (a.stato !== 'confermata') return false;
  if (Array.isArray(lavoriInStandby)) return lavoriInStandby.length > 0;
  return !a.sostitutoOperaioId;
}

/**
 * Righe del banner: le assenze del giorno più quelle (anche di giorni passati)
 * che hanno ancora lavori in standby.
 * @param {{ aperte: Object[], assenzeDaStandby?: Object[], standbyPerAssenza: Map|null }} input
 * @returns {Array<Object & { lavoriInStandby: Array<{ id: string, nome: string }> }>}
 */
export function righeBannerAssenze({ aperte, assenzeDaStandby = [], standbyPerAssenza }) {
  const byId = new Map();
  [...(aperte || []), ...(assenzeDaStandby || [])].forEach((a) => {
    if (a && a.id && !byId.has(a.id)) byId.set(a.id, a);
  });
  const rows = [];
  byId.forEach((a) => {
    const lista = standbyPerAssenza ? standbyPerAssenza.get(a.id) || [] : null;
    if (!assenzaDaGestireNelBanner(a, lista)) return;
    rows.push({ ...a, lavoriInStandby: lista || [] });
  });
  return rows;
}

/**
 * Lavoro da aprire dal deep link: quello richiesto se è ancora in standby per l'assenza,
 * altrimenti il primo ancora in standby. Senza lista: quello richiesto, se c'è.
 * @param {Array<{ id: string }>|null} lavoriInStandby
 * @param {string|null} [lavoroIdRichiesto]
 * @returns {string|null}
 */
export function lavoroDaAprireDaDeepLink(lavoriInStandby, lavoroIdRichiesto = null) {
  const richiesto = lavoroIdRichiesto ? String(lavoroIdRichiesto) : '';
  if (!Array.isArray(lavoriInStandby)) return richiesto || null;
  if (richiesto && lavoriInStandby.some((l) => l.id === richiesto)) return richiesto;
  return lavoriInStandby[0] ? lavoriInStandby[0].id : null;
}
