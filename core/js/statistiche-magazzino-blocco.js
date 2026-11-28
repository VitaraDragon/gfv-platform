/**
 * Aggregati puri blocco Magazzino su Statistiche (annata, solo quantità, niente €).
 * Nessuna I/O / DOM.
 * @module core/js/statistiche-magazzino-blocco
 */

import { dateLikeToLocalCalendarIso } from './date-format-it.js';
import { boundsIsoAnnata } from './statistiche-ore-report.js';
import { topNConAltri } from './statistiche-conto-terzi-blocco.js';

/**
 * @param {{ tipo?: string }|null|undefined} mov
 * @returns {'entrata'|'uscita'}
 */
export function tipoMovimentoNorm(mov) {
  return String((mov && mov.tipo) || '').toLowerCase() === 'uscita' ? 'uscita' : 'entrata';
}

/**
 * @param {{ data?: * }|null|undefined} mov
 * @param {number} anno
 * @returns {boolean}
 */
export function movimentoInAnnata(mov, anno) {
  const iso = dateLikeToLocalCalendarIso((mov && mov.data) || null);
  if (!iso) return false;
  const { isoFrom, isoTo } = boundsIsoAnnata(anno);
  if (!isoFrom) return false;
  return iso >= isoFrom && iso <= isoTo;
}

/**
 * Nome prodotto da anagrafica o riga movimento.
 * @param {object|null|undefined} prodotto
 * @param {object|null|undefined} mov
 * @param {string|null|undefined} prodottoId
 * @returns {string}
 */
export function nomeProdottoDisplay(prodotto, mov, prodottoId) {
  if (prodotto) {
    return String(prodotto.nome || prodotto.nomeCommerciale || prodottoId || '—');
  }
  if (mov && (mov.prodottoNome || mov.nome)) {
    return String(mov.prodottoNome || mov.nome);
  }
  return String(prodottoId || '—');
}

/**
 * KPI quantità + riparto movimenti per prodotto (annata civile).
 *
 * @param {{
 *   prodotti?: Array<object>,
 *   movimenti?: Array<object>,
 *   anno: number,
 *   topGiacenze?: number,
 *   topNChart?: number
 * }} input
 */
export function calcolaBloccoMagazzinoAnnata(input) {
  const anno = Number(input && input.anno);
  const topGiacenze = (input && Number(input.topGiacenze) > 0) ? Number(input.topGiacenze) : 5;
  const topNChart = (input && Number(input.topNChart) > 0) ? Number(input.topNChart) : 7;
  const prodotti = (input && Array.isArray(input.prodotti)) ? input.prodotti : [];
  const movimenti = (input && Array.isArray(input.movimenti)) ? input.movimenti : [];

  /** @type {Map<string, object>} */
  const prodottiById = new Map();
  for (const p of prodotti) {
    if (p && p.id) prodottiById.set(String(p.id), p);
  }

  const conGiacenza = prodotti
    .map((p) => {
      const g = p && p.giacenza != null ? Number(p.giacenza) : 0;
      const giacenza = Number.isFinite(g) ? g : 0;
      return {
        id: p && p.id ? String(p.id) : '',
        nome: nomeProdottoDisplay(p, null, p && p.id),
        giacenza,
        unitaMisura: (p && p.unitaMisura) || ''
      };
    })
    .filter((p) => p.id && p.giacenza > 0)
    .sort((a, b) => b.giacenza - a.giacenza);

  const giacenzePrincipali = conGiacenza.slice(0, topGiacenze);
  const nProdottiConGiacenza = conGiacenza.length;

  let qtyEntrate = 0;
  let qtyUscite = 0;
  let nMovimenti = 0;
  /** @type {Map<string, { id: string, nome: string, valore: number }>} */
  const byProdotto = new Map();
  /** @type {Map<string, number>} */
  const byTipo = new Map([['entrata', 0], ['uscita', 0]]);

  for (const mov of movimenti) {
    if (!mov || !movimentoInAnnata(mov, anno)) continue;
    const qty = Number(mov.quantita);
    if (!(qty > 0) || !Number.isFinite(qty)) continue;
    nMovimenti += 1;
    const tipo = tipoMovimentoNorm(mov);
    if (tipo === 'uscita') qtyUscite += qty;
    else qtyEntrate += qty;
    byTipo.set(tipo, (byTipo.get(tipo) || 0) + qty);

    const pid = mov.prodottoId ? String(mov.prodottoId) : '__none__';
    const anag = prodottiById.get(pid) || null;
    let row = byProdotto.get(pid);
    if (!row) {
      row = {
        id: pid === '__none__' ? '' : pid,
        nome: nomeProdottoDisplay(anag, mov, pid === '__none__' ? null : pid),
        valore: 0
      };
      byProdotto.set(pid, row);
    }
    row.valore += qty;
  }

  const movimentiPerProdotto = topNConAltri([...byProdotto.values()], topNChart);
  const movimentiPerTipo = [
    { id: 'entrata', nome: 'Entrate', valore: byTipo.get('entrata') || 0 },
    { id: 'uscita', nome: 'Uscite', valore: byTipo.get('uscita') || 0 }
  ].filter((x) => Number(x.valore) > 0);

  return {
    anno,
    nProdottiConGiacenza,
    giacenzePrincipali,
    nMovimenti,
    qtyEntrate: Math.round(qtyEntrate * 1000) / 1000,
    qtyUscite: Math.round(qtyUscite * 1000) / 1000,
    movimentiPerProdotto,
    movimentiPerTipo
  };
}
