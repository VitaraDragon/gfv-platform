/**
 * Riepilogo ore del giorno a partire dalle righe già in memoria.
 * La pagina lo disegna subito, poi rilegge da Firestore.
 */
import { sommaOreNette } from '../../services/ore-operai-logic.js';

function totaleGiorno(righe) {
  const attive = (Array.isArray(righe) ? righe : []).filter((r) => r && r.stato !== 'rifiutate');
  const totaleOre = sommaOreNette(attive);
  const totaleMinuti = Math.round((totaleOre + Number.EPSILON) * 60);
  return { totaleOre, totaleMinuti };
}

/**
 * @param {Array<object>|null|undefined} righe
 * @param {string} oraId
 * @returns {{ righe: Array<object>, trovato: boolean, totaleOre: number, totaleMinuti: number }}
 */
export function riepilogoGiornoDopoEliminazione(righe, oraId) {
  const list = Array.isArray(righe) ? righe : [];
  const id = String(oraId || '');
  let trovato = false;
  const next = [];
  list.forEach((r) => {
    if (r && id && String(r.id) === id) {
      trovato = true;
      return;
    }
    next.push(r);
  });
  return { righe: next, trovato, ...totaleGiorno(next) };
}

/**
 * @param {Array<object>|null|undefined} righe
 * @param {object|null|undefined} riga
 * @returns {{ righe: Array<object>, totaleOre: number, totaleMinuti: number }}
 */
export function riepilogoGiornoDopoSalvataggio(righe, riga) {
  const next = Array.isArray(righe) ? righe.slice() : [];
  const nuova = riga && typeof riga === 'object' ? riga : null;
  if (nuova) {
    const id = nuova.id != null ? String(nuova.id) : '';
    const idx = id ? next.findIndex((r) => r && String(r.id) === id) : -1;
    if (idx >= 0) next[idx] = Object.assign({}, next[idx], nuova);
    else next.push(nuova);
  }
  return { righe: next, ...totaleGiorno(next) };
}
