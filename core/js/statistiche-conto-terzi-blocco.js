/**
 * Aggregati puri blocco Conto terzi su Statistiche (annata, senza €/margine).
 * Nessuna I/O / DOM.
 * @module core/js/statistiche-conto-terzi-blocco
 */

import { dateLikeToLocalCalendarIso } from './date-format-it.js';
import { boundsIsoAnnata } from './statistiche-ore-report.js';

/**
 * @param {{ stato?: string }|null|undefined} lavoro
 * @returns {boolean}
 */
export function isLavoroCtAnnullato(lavoro) {
  return String((lavoro && lavoro.stato) || '').toLowerCase() === 'annullato';
}

/**
 * @param {{ clienteId?: * }|null|undefined} row
 * @returns {boolean}
 */
export function hasClienteId(row) {
  return !!(row && row.clienteId && String(row.clienteId).trim());
}

/**
 * @param {{ dataInizio?: *, data?: * }|null|undefined} row
 * @param {number} anno
 * @returns {boolean}
 */
export function rowInAnnata(row, anno) {
  const iso = dateLikeToLocalCalendarIso((row && (row.dataInizio || row.data)) || null);
  if (!iso) return false;
  return iso.startsWith(`${Number(anno)}-`);
}

/**
 * Ettari lavoro CT: superficie lavorata → terreno.
 * (Niente preventivo: il blocco Statistiche non carica i preventivi.)
 *
 * @param {{ superficieTotaleLavorata?: * }|null|undefined} lavoro
 * @param {{ superficie?: * }|null|undefined} terreno
 * @returns {number}
 */
export function resolveEttariCtStats(lavoro, terreno = null) {
  const fromLav = lavoro && lavoro.superficieTotaleLavorata != null
    ? Number(lavoro.superficieTotaleLavorata)
    : null;
  if (fromLav != null && Number.isFinite(fromLav) && fromLav > 0) return fromLav;
  const fromTerr = terreno && terreno.superficie != null
    ? Number(terreno.superficie)
    : null;
  if (fromTerr != null && Number.isFinite(fromTerr) && fromTerr > 0) return fromTerr;
  return 0;
}

/**
 * Nome display cliente.
 * @param {object|null|undefined} cliente
 * @param {string|null|undefined} clienteId
 * @returns {string}
 */
export function nomeClienteDisplay(cliente, clienteId) {
  if (cliente) {
    return String(cliente.ragioneSociale || cliente.nome || clienteId || '—');
  }
  return String(clienteId || '—');
}

/**
 * Top N + «Altri» per conteggio (riparto lavori / movimenti).
 *
 * @param {{ id?: string, nome: string, valore: number }[]} items
 * @param {number} [topN=7]
 * @returns {{ id?: string, nome: string, valore: number }[]}
 */
export function topNConAltri(items, topN = 7) {
  const sorted = [...(items || [])]
    .filter((x) => x && Number(x.valore) > 0)
    .sort((a, b) => Number(b.valore) - Number(a.valore));
  const n = Math.max(0, Number(topN) || 0);
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n);
  const out = top.map((x) => ({
    id: x.id,
    nome: x.nome,
    valore: Number(x.valore) || 0
  }));
  if (rest.length) {
    const somma = rest.reduce((acc, x) => acc + (Number(x.valore) || 0), 0);
    out.push({ id: '__altri__', nome: 'Altri', valore: somma });
  }
  return out;
}

/**
 * KPI + riparto lavori per cliente (annata civile).
 *
 * Ore: somma da `attivita` con clienteId (una collezione, no N+1 oreOperai).
 *
 * @param {{
 *   lavori?: Array<object>,
 *   attivita?: Array<object>,
 *   clientiById?: Map<string, object>|Record<string, object>|null,
 *   terreniById?: Map<string, object>|Record<string, object>|null,
 *   anno: number,
 *   topN?: number
 * }} input
 */
export function calcolaBloccoContoTerziAnnata(input) {
  const anno = Number(input && input.anno);
  const topN = (input && Number(input.topN) > 0) ? Number(input.topN) : 7;
  const lavori = (input && Array.isArray(input.lavori)) ? input.lavori : [];
  const attivita = (input && Array.isArray(input.attivita)) ? input.attivita : [];

  const resolveCliente = (id) => {
    if (!id || !input.clientiById) return null;
    if (input.clientiById instanceof Map) return input.clientiById.get(String(id)) || null;
    return input.clientiById[String(id)] || null;
  };
  const resolveTerreno = (id) => {
    if (!id || !input.terreniById) return null;
    if (input.terreniById instanceof Map) return input.terreniById.get(String(id)) || null;
    return input.terreniById[String(id)] || null;
  };

  /** @type {Map<string, { clienteId: string, clienteNome: string, nLavori: number, ettari: number, ore: number }>} */
  const byCliente = new Map();
  let nLavori = 0;
  let ettariTot = 0;

  for (const lav of lavori) {
    if (!lav || !hasClienteId(lav) || !rowInAnnata(lav, anno)) continue;
    if (isLavoroCtAnnullato(lav)) continue;
    nLavori += 1;
    const cid = String(lav.clienteId);
    const cliente = resolveCliente(cid);
    const terreno = resolveTerreno(lav.terrenoId);
    const ettari = resolveEttariCtStats(lav, terreno);
    ettariTot += ettari;
    let row = byCliente.get(cid);
    if (!row) {
      row = {
        clienteId: cid,
        clienteNome: nomeClienteDisplay(cliente, cid),
        nLavori: 0,
        ettari: 0,
        ore: 0
      };
      byCliente.set(cid, row);
    }
    row.nLavori += 1;
    row.ettari += ettari;
  }

  /** Ore da attività CT nell'annata (anche senza lavoroId). */
  let oreTot = 0;
  const { isoFrom, isoTo } = boundsIsoAnnata(anno);
  for (const att of attivita) {
    if (!att || !hasClienteId(att)) continue;
    const iso = dateLikeToLocalCalendarIso(att.data);
    if (!iso || iso < isoFrom || iso > isoTo) continue;
    const ore = typeof att.oreNette === 'number' && Number.isFinite(att.oreNette)
      ? att.oreNette
      : (Number(att.oreNette) || 0);
    if (!(ore > 0)) continue;
    oreTot += ore;
    const cid = String(att.clienteId);
    let row = byCliente.get(cid);
    if (!row) {
      const cliente = resolveCliente(cid);
      row = {
        clienteId: cid,
        clienteNome: nomeClienteDisplay(cliente, cid),
        nLavori: 0,
        ettari: 0,
        ore: 0
      };
      byCliente.set(cid, row);
    }
    row.ore += ore;
  }

  const clientiAttivi = [...byCliente.values()].filter((r) => r.nLavori > 0 || r.ore > 0).length;
  const lavoriPerCliente = topNConAltri(
    [...byCliente.values()]
      .filter((r) => r.nLavori > 0)
      .map((r) => ({
        id: r.clienteId,
        nome: r.clienteNome,
        valore: r.nLavori
      })),
    topN
  );

  return {
    anno,
    nLavori,
    clientiAttivi,
    ettari: Math.round(ettariTot * 100) / 100,
    ore: Math.round(oreTot * 100) / 100,
    lavoriPerCliente
  };
}
