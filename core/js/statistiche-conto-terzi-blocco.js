/**
 * Aggregati puri blocco Conto terzi su Statistiche (annata, senza €/margine).
 * Nessuna I/O / DOM.
 * @module core/js/statistiche-conto-terzi-blocco
 */

import { dateLikeToLocalCalendarIso } from './date-format-it.js';

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
 * Superficie di un singolo lavoro (lavorata se > 0, altrimenti terreno).
 * Usata solo come fallback quando non c’è terrenoId da deduplicare.
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
 * Ettari CT: superficie distinta dei terreni lavorati nell’annata.
 * Non somma più volte lo stesso terreno; non usa il terreno intero come
 * fallback su ogni lavoro.
 *
 * @param {Array<object>} lavoriAnnata
 * @param {Map<string, object>|Record<string, object>|null|undefined} terreniById
 * @returns {number}
 */
export function resolveEttariDistintiTerreni(lavoriAnnata, terreniById) {
  const resolveTerreno = (id) => {
    if (!id || !terreniById) return null;
    if (terreniById instanceof Map) return terreniById.get(String(id)) || null;
    return terreniById[String(id)] || null;
  };

  /** @type {Map<string, { superficieTerreno: number, maxLavorata: number }>} */
  const byTerreno = new Map();
  let senzaTerreno = 0;

  for (const lav of lavoriAnnata || []) {
    if (!lav) continue;
    const tid = lav.terrenoId != null && String(lav.terrenoId).trim()
      ? String(lav.terrenoId)
      : '';
    const lavorata = lav.superficieTotaleLavorata != null
      ? Number(lav.superficieTotaleLavorata)
      : 0;
    const lavOk = Number.isFinite(lavorata) && lavorata > 0 ? lavorata : 0;

    if (!tid) {
      senzaTerreno += lavOk;
      continue;
    }

    let row = byTerreno.get(tid);
    if (!row) {
      const terreno = resolveTerreno(tid);
      const fromTerr = terreno && terreno.superficie != null
        ? Number(terreno.superficie)
        : 0;
      row = {
        superficieTerreno: (Number.isFinite(fromTerr) && fromTerr > 0) ? fromTerr : 0,
        maxLavorata: 0
      };
      byTerreno.set(tid, row);
    }
    if (lavOk > row.maxLavorata) row.maxLavorata = lavOk;
  }

  let tot = senzaTerreno;
  for (const row of byTerreno.values()) {
    tot += row.superficieTerreno > 0 ? row.superficieTerreno : row.maxLavorata;
  }
  return Math.round(tot * 100) / 100;
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
 * Ettari = superficie distinta dei terreni lavorati (etichetta UI dedicata).
 * Ore: non incluse (fonte ore validate lavori CT richiede oreOperai N+1;
 * il Diario non è una fonte verificabile allineata a Gestione lavori).
 *
 * @param {{
 *   lavori?: Array<object>,
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

  const resolveCliente = (id) => {
    if (!id || !input.clientiById) return null;
    if (input.clientiById instanceof Map) return input.clientiById.get(String(id)) || null;
    return input.clientiById[String(id)] || null;
  };

  /** @type {object[]} */
  const lavoriAnnata = [];
  /** @type {Map<string, { clienteId: string, clienteNome: string, nLavori: number, lavori: object[] }>} */
  const byCliente = new Map();
  let nLavori = 0;

  for (const lav of lavori) {
    if (!lav || !hasClienteId(lav) || !rowInAnnata(lav, anno)) continue;
    if (isLavoroCtAnnullato(lav)) continue;
    nLavori += 1;
    lavoriAnnata.push(lav);
    const cid = String(lav.clienteId);
    const cliente = resolveCliente(cid);
    let row = byCliente.get(cid);
    if (!row) {
      row = {
        clienteId: cid,
        clienteNome: nomeClienteDisplay(cliente, cid),
        nLavori: 0,
        lavori: []
      };
      byCliente.set(cid, row);
    }
    row.nLavori += 1;
    row.lavori.push(lav);
  }

  const ettariTot = resolveEttariDistintiTerreni(lavoriAnnata, input && input.terreniById);

  const clientiAttivi = [...byCliente.values()].filter((r) => r.nLavori > 0).length;
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
    ettari: ettariTot,
    ettariLabel: 'Ettari terreni lavorati',
    lavoriPerCliente
  };
}
