/**
 * Righe del riepilogo ore del giorno, a partire da quelle già in memoria.
 * La pagina le disegna subito, poi rilegge da Firestore.
 * Il totale usa sommaOreNette (ore-operai-logic), come il riquadro: le rifiutate non contano.
 */
import { sommaOreNette } from '../../services/ore-operai-logic.js';

/**
 * Minuti netti del giorno. Stesso calcolo del riquadro: somma delle ore nette, senza le rifiutate.
 * @param {Array<object>|null|undefined} righe
 * @returns {number}
 */
export function totaleMinutiGiorno(righe) {
  const attive = (Array.isArray(righe) ? righe : []).filter((r) => r && r.stato !== 'rifiutate');
  const ore = sommaOreNette(attive);
  if (!Number.isFinite(ore) || ore <= 0) return 0;
  return Math.round((ore + Number.EPSILON) * 60);
}

/**
 * @param {Array<object>|null|undefined} righe
 * @param {string} oraId
 * @returns {Array<object>}
 */
export function righeGiornoDopoEliminazione(righe, oraId) {
  const list = Array.isArray(righe) ? righe : [];
  const id = String(oraId || '');
  if (!id) return list.slice();
  return list.filter((r) => !(r && String(r.id) === id));
}

/**
 * Sostituisce la riga se l'id c'è già, altrimenti la aggiunge.
 * @param {Array<object>|null|undefined} righe
 * @param {object|null|undefined} nuovaRiga
 * @returns {Array<object>}
 */
export function righeGiornoDopoSalvataggio(righe, nuovaRiga) {
  const next = Array.isArray(righe) ? righe.slice() : [];
  const nuova = nuovaRiga && typeof nuovaRiga === 'object' ? nuovaRiga : null;
  if (!nuova) return next;
  const id = nuova.id != null ? String(nuova.id) : '';
  const idx = id ? next.findIndex((r) => r && String(r.id) === id) : -1;
  if (idx >= 0) next[idx] = Object.assign({}, next[idx], nuova);
  else next.push(nuova);
  return next;
}
