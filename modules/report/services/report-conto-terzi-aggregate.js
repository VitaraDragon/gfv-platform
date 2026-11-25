/**
 * Aggregati puri Report Conto terzi (per cliente / lavori / grafici).
 * Nessuna I/O: pensato per unit test.
 *
 * Ricavo = totale (senza IVA) del preventivo accettato collegato al lavoro.
 * Costi = manodopera + macchine + prodotti magazzino (valori già calcolati a monte
 * con le stesse regole di Economici / Manodopera / Macchine).
 * Prezzo o preventivo mancante → null + * (mai 0 silenzioso).
 *
 * @module modules/report/services/report-conto-terzi-aggregate
 */

import {
  dataIsoFromAny,
  euro,
  euroPerHa,
  prodottoCostFromMovimentoUscita,
  sumNullable
} from './report-economici-aggregate.js';

/** Stati che contano come ricavo (accettati o già pianificati dopo accettazione). */
export const PREVENTIVO_ACCETTATO_STATI = Object.freeze([
  'accettato_email',
  'accettato_manager',
  'pianificato'
]);

/** @param {string|null|undefined} stato */
export function isPreventivoAccettato(stato) {
  return PREVENTIVO_ACCETTATO_STATI.includes(String(stato || ''));
}

/** @param {string|null|undefined} stato */
export function isPreventivoInAttesa(stato) {
  return String(stato || '') === 'inviato';
}

/** @param {string|null|undefined} stato */
export function isPreventivoRifiutatoOScaduto(stato) {
  const s = String(stato || '');
  return s === 'rifiutato' || s === 'scaduto';
}

/**
 * Etichetta stato preventivo per UI / Excel.
 * @param {string|null|undefined} stato
 */
export function labelStatoPreventivo(stato) {
  const s = String(stato || '');
  const map = {
    bozza: 'Bozza',
    inviato: 'Inviato',
    accettato_email: 'Accettato (email)',
    accettato_manager: 'Accettato (manager)',
    rifiutato: 'Rifiutato',
    scaduto: 'Scaduto',
    pianificato: 'Pianificato',
    annullato: 'Annullato'
  };
  return map[s] || (s || '—');
}

/**
 * Ripartisci un totale € su n quote per pesi (es. ettari).
 * Arrotonda al centesimo; il resto va sull'ultima quota così la somma è esatta.
 * Se tutti i pesi sono ≤ 0 → parti uguali.
 *
 * @param {number} total
 * @param {Array<number|null|undefined>} weights
 * @returns {Array<number|null>}
 */
export function allocateEuroByWeights(total, weights) {
  const n = (weights || []).length;
  if (n === 0) return [];
  const tot = euro(total);
  if (tot == null) return Array(n).fill(null);
  if (n === 1) return [tot];

  const w = weights.map((x) => {
    const v = Number(x);
    return !Number.isNaN(v) && v > 0 ? v : 0;
  });
  const sumW = w.reduce((a, b) => a + b, 0);
  /** @type {number[]} */
  const shares = new Array(n);
  if (sumW <= 0) {
    const base = euro(tot / n) ?? 0;
    for (let i = 0; i < n - 1; i++) shares[i] = base;
    const sumPrev = base * (n - 1);
    shares[n - 1] = euro(tot - sumPrev) ?? 0;
  } else {
    for (let i = 0; i < n - 1; i++) {
      shares[i] = euro((tot * w[i]) / sumW) ?? 0;
    }
    const sumPrev = shares.slice(0, -1).reduce((a, b) => a + b, 0);
    shares[n - 1] = euro(tot - sumPrev) ?? 0;
  }
  return shares;
}

/**
 * Etichetta rif. preventivo in cassetto / Excel (quota se condiviso).
 * @param {{ preventivoNumero?: string|null, preventivoCondivisoN?: number }} row
 */
export function formatPreventivoRifLabel(row) {
  if (!row) return '';
  const num = row.preventivoNumero ? String(row.preventivoNumero) : '';
  const n = Number(row.preventivoCondivisoN) || 0;
  if (n > 1 && num) return `quota di ${num} (${n} lavori)`;
  return num;
}

/**
 * Se lo stesso preventivo è collegato a più lavori, ripartisci il ricavo
 * in proporzione agli ettari (o in parti uguali se ettari assenti).
 * Mutates in place; ricalcola margine e €/ha.
 *
 * @param {Array<object>} lavori
 * @returns {{ nPreventiviCondivisi: number, nLavoriConQuota: number }}
 */
export function applyRicaviPreventiviCondivisi(lavori) {
  /** @type {Map<string, object[]>} */
  const byPrev = new Map();
  for (const l of lavori || []) {
    if (!l || l.senzaPreventivo || l.ricavo == null || !l.preventivoId) continue;
    const key = String(l.preventivoId);
    if (!byPrev.has(key)) byPrev.set(key, []);
    byPrev.get(key).push(l);
  }

  let nPreventiviCondivisi = 0;
  let nLavoriConQuota = 0;

  for (const group of byPrev.values()) {
    for (const l of group) {
      l.preventivoCondivisoN = group.length;
    }
    if (group.length < 2) continue;
    nPreventiviCondivisi += 1;
    nLavoriConQuota += group.length;

    group.sort((a, b) => {
      const da = String(a.dataIso || '');
      const db = String(b.dataIso || '');
      if (da !== db) return da.localeCompare(db);
      return String(a.id || '').localeCompare(String(b.id || ''));
    });

    const totale = group[0].ricavo;
    // usa il totale originale del preventivo (tutti partono con lo stesso)
    const weights = group.map((l) => Number(l.ettari) || 0);
    const shares = allocateEuroByWeights(totale, weights);

    for (let i = 0; i < group.length; i++) {
      const l = group[i];
      const ricavo = shares[i];
      l.ricavo = ricavo;
      l.preventivoRifLabel = formatPreventivoRifLabel(l);
      if (ricavo == null || l.costo == null) {
        l.margine = null;
        l.partialMargine = true;
      } else {
        l.margine = euro(Number(ricavo) - Number(l.costo));
        l.partialMargine = !!l.partialCosto;
      }
      l.euroPerHa = euroPerHa(ricavo, l.ettari);
    }
  }

  for (const l of lavori || []) {
    if (!l) continue;
    if (l.preventivoCondivisoN == null) l.preventivoCondivisoN = 1;
    if (!l.preventivoRifLabel) {
      l.preventivoRifLabel = formatPreventivoRifLabel(l);
    }
  }

  return { nPreventiviCondivisi, nLavoriConQuota };
}

/**
 * Ricavo da preventivo accettato: solo `totale` (imponibile, senza IVA).
 * @param {object|null|undefined} prev
 * @returns {{ ricavo: number|null, senzaPreventivo: boolean, preventivoId: string|null, preventivoNumero: string|null, stato: string|null }}
 */
export function ricavoFromPreventivoAccettato(prev) {
  if (!prev || !isPreventivoAccettato(prev.stato)) {
    return {
      ricavo: null,
      senzaPreventivo: true,
      preventivoId: prev && prev.id ? String(prev.id) : null,
      preventivoNumero: prev && prev.numero ? String(prev.numero) : null,
      stato: prev && prev.stato ? String(prev.stato) : null
    };
  }
  const tot = prev.totale;
  if (tot == null || Number.isNaN(Number(tot))) {
    return {
      ricavo: null,
      senzaPreventivo: true,
      preventivoId: prev.id ? String(prev.id) : null,
      preventivoNumero: prev.numero ? String(prev.numero) : null,
      stato: String(prev.stato)
    };
  }
  return {
    ricavo: euro(Number(tot)),
    senzaPreventivo: false,
    preventivoId: prev.id ? String(prev.id) : null,
    preventivoNumero: prev.numero ? String(prev.numero) : null,
    stato: String(prev.stato)
  };
}

/**
 * Trova il preventivo accettato collegato a un lavoro (lavoro.preventivoId o prev.lavoroId).
 * Un preventivo rifiutato/scaduto non conta come ricavo.
 *
 * @param {Array<object>} preventivi
 * @param {object} lavoro
 * @returns {object|null}
 */
export function findPreventivoAccettatoForLavoro(preventivi, lavoro) {
  if (!lavoro) return null;
  const list = preventivi || [];
  const lavoroId = lavoro.id ? String(lavoro.id) : null;
  const directId = lavoro.preventivoId ? String(lavoro.preventivoId) : null;

  if (directId) {
    const direct = list.find((p) => p && String(p.id) === directId);
    if (direct && isPreventivoAccettato(direct.stato)) return direct;
    // preventivo collegato ma non accettato → nessun ricavo
    if (direct) return null;
  }

  const linked = list.filter(
    (p) => p && lavoroId && String(p.lavoroId || '') === lavoroId && isPreventivoAccettato(p.stato)
  );
  if (!linked.length) return null;
  // preferisci quello con totale noto, poi il più recente per dataAccettazione / dataInvio
  linked.sort((a, b) => {
    const da = dataIsoFromAny(a.dataAccettazione || a.dataInvio || a.dataPrevista || '') || '';
    const db = dataIsoFromAny(b.dataAccettazione || b.dataInvio || b.dataPrevista || '') || '';
    return String(db).localeCompare(String(da));
  });
  return linked[0];
}

/**
 * Costo prodotti da uscite magazzino collegate a un lavoro (regole Economici).
 * @param {Array<object>} movimenti
 * @param {Map<string, object>|null} [prodottiById]
 * @returns {{ costoProdotti: number|null, missingProdotti: boolean, notes: string[] }}
 */
export function costoProdottiFromMovimenti(movimenti, prodottiById = null) {
  const values = [];
  /** @type {string[]} */
  const notes = [];
  let any = false;
  for (const mov of movimenti || []) {
    if (!mov) continue;
    if (String(mov.tipo || '').toLowerCase() !== 'uscita') continue;
    any = true;
    const anag = prodottiById && mov.prodottoId
      ? prodottiById.get(String(mov.prodottoId))
      : null;
    const priced = prodottoCostFromMovimentoUscita(mov, anag);
    for (const n of priced.notes || []) notes.push(n);
    if (priced.missingProdotti || priced.missingCarburante) {
      values.push(null);
      continue;
    }
    values.push(euro((Number(priced.costoProdotti) || 0) + (Number(priced.costoCarburante) || 0)));
  }
  if (!any) {
    return { costoProdotti: 0, missingProdotti: false, notes: [] };
  }
  const summed = sumNullable(values);
  return {
    costoProdotti: summed.value,
    missingProdotti: summed.partial || summed.value == null,
    notes: [...new Set(notes)]
  };
}

/**
 * Somma costi lavoro (manodopera + macchine + prodotti) con regola nullable/*.
 * @param {{
 *   costoManodopera?: number|null,
 *   missingManodopera?: boolean,
 *   costoMacchine?: number|null,
 *   missingMacchine?: boolean,
 *   costoProdotti?: number|null,
 *   missingProdotti?: boolean
 * }} parts
 * @returns {{ costo: number|null, partial: boolean }}
 */
export function combineCostiLavoro(parts = {}) {
  // Se missing: null; altrimenti usa il valore (0 se assente / senza ore).
  const out = [
    parts.missingManodopera ? null : Number(parts.costoManodopera) || 0,
    parts.missingMacchine ? null : Number(parts.costoMacchine) || 0,
    parts.missingProdotti ? null : Number(parts.costoProdotti) || 0
  ];
  return sumNullable(out);
}

/**
 * Ettari del lavoro: superficie lavorata → preventivo → terreno.
 * @param {object} lavoro
 * @param {object|null} [preventivo]
 * @param {object|null} [terreno]
 */
export function resolveEttariLavoro(lavoro, preventivo = null, terreno = null) {
  const fromLav = lavoro && lavoro.superficieTotaleLavorata != null
    ? Number(lavoro.superficieTotaleLavorata)
    : null;
  if (fromLav != null && fromLav > 0) return fromLav;
  const fromPrev = preventivo && preventivo.superficie != null
    ? Number(preventivo.superficie)
    : null;
  if (fromPrev != null && fromPrev > 0) return fromPrev;
  const fromTerr = terreno && terreno.superficie != null
    ? Number(terreno.superficie)
    : null;
  if (fromTerr != null && fromTerr > 0) return fromTerr;
  return 0;
}

/**
 * Arricchisce un lavoro CT con ricavo, costi, cliente.
 *
 * @param {object} lavoro
 * @param {{
 *   preventivi?: Array<object>,
 *   clientiById?: Map<string, object>,
 *   terrenoById?: Map<string, object>,
 *   costi?: {
 *     ore?: number,
 *     costoManodopera?: number|null,
 *     missingManodopera?: boolean,
 *     costoMacchine?: number|null,
 *     missingMacchine?: boolean,
 *     costoProdotti?: number|null,
 *     missingProdotti?: boolean,
 *     notes?: string[]
 *   }
 * }} ctx
 */
export function enrichLavoroCt(lavoro, ctx = {}) {
  if (!lavoro) return null;
  const clienteId = lavoro.clienteId ? String(lavoro.clienteId) : null;
  const clientiById = ctx.clientiById || new Map();
  const terrenoById = ctx.terrenoById || new Map();
  const cliente = clienteId ? clientiById.get(clienteId) : null;
  const terreno = lavoro.terrenoId ? terrenoById.get(String(lavoro.terrenoId)) : null;
  const prev = findPreventivoAccettatoForLavoro(ctx.preventivi || [], lavoro);
  // se c'è preventivoId ma rifiutato: ancora senza ricavo
  const ricavoInfo = ricavoFromPreventivoAccettato(prev);
  // se non trovato accettato, prova a mostrare numero del preventivo collegato (anche rifiutato) solo come ref
  let preventivoNumero = ricavoInfo.preventivoNumero;
  let preventivoStato = ricavoInfo.stato;
  if (!prev && lavoro.preventivoId) {
    const raw = (ctx.preventivi || []).find((p) => p && String(p.id) === String(lavoro.preventivoId));
    if (raw) {
      preventivoNumero = raw.numero ? String(raw.numero) : null;
      preventivoStato = raw.stato ? String(raw.stato) : null;
    }
  }

  const costi = ctx.costi || {};
  const combined = combineCostiLavoro({
    costoManodopera: costi.costoManodopera,
    missingManodopera: !!costi.missingManodopera,
    costoMacchine: costi.costoMacchine,
    missingMacchine: !!costi.missingMacchine,
    costoProdotti: costi.costoProdotti,
    missingProdotti: !!costi.missingProdotti
  });
  const ettariRaw = resolveEttariLavoro(lavoro, prev, terreno);
  const ettari = euro(ettariRaw) || 0;
  const ricavo = ricavoInfo.ricavo;
  const costo = combined.value;
  const partialCosto = combined.partial;
  let margine = null;
  let partialMargine = false;
  if (ricavo == null) {
    margine = null;
    partialMargine = true;
  } else if (costo == null) {
    margine = null;
    partialMargine = true;
  } else {
    margine = euro(Number(ricavo) - Number(costo));
    partialMargine = partialCosto;
  }

  const clienteNome = cliente
    ? (cliente.ragioneSociale || cliente.nome || clienteId)
    : (clienteId || '—');

  const row = {
    id: lavoro.id ? String(lavoro.id) : null,
    kind: lavoro._kind || 'lavoro',
    clienteId,
    clienteNome,
    terrenoId: lavoro.terrenoId ? String(lavoro.terrenoId) : null,
    terrenoNome: terreno
      ? (terreno.nome || terreno.podere || lavoro.terrenoId)
      : (lavoro.terrenoId || '—'),
    tipoLavoro: lavoro.tipoLavoro || '',
    dataIso: dataIsoFromAny(lavoro.dataInizio || lavoro.data) || null,
    statoLavoro: lavoro.stato || null,
    ettari,
    ore: Number(costi.ore) || 0,
    ricavo,
    senzaPreventivo: ricavoInfo.senzaPreventivo,
    preventivoId: ricavoInfo.preventivoId || (lavoro.preventivoId ? String(lavoro.preventivoId) : null),
    preventivoNumero,
    preventivoStato,
    preventivoCondivisoN: 1,
    preventivoRifLabel: '',
    costo,
    partialCosto,
    costoManodopera: costi.missingManodopera ? null : (costi.costoManodopera == null ? 0 : costi.costoManodopera),
    missingManodopera: !!costi.missingManodopera,
    costoMacchine: costi.missingMacchine ? null : (costi.costoMacchine == null ? 0 : costi.costoMacchine),
    missingMacchine: !!costi.missingMacchine,
    costoProdotti: costi.missingProdotti ? null : (costi.costoProdotti == null ? 0 : costi.costoProdotti),
    missingProdotti: !!costi.missingProdotti,
    margine,
    partialMargine,
    euroPerHa: euroPerHa(ricavo, ettari),
    notes: costi.notes || []
  };
  row.preventivoRifLabel = formatPreventivoRifLabel(row);
  return row;
}

/**
 * Filtra lavori arricchiti.
 * @param {Array<object>} rows
 * @param {{ clienteId?: string|null, tipoLavoro?: string|null, statoPreventivo?: string|null }} [filters]
 */
export function filterLavoriCt(rows, filters = {}) {
  const cid = filters.clienteId ? String(filters.clienteId) : null;
  const tipo = filters.tipoLavoro ? String(filters.tipoLavoro) : null;
  const stato = filters.statoPreventivo ? String(filters.statoPreventivo) : null;
  return (rows || []).filter((r) => {
    if (!r) return false;
    if (cid && String(r.clienteId || '') !== cid) return false;
    if (tipo && String(r.tipoLavoro || '') !== tipo) return false;
    if (stato) {
      if (stato === '__senza__') {
        if (!r.senzaPreventivo) return false;
      } else if (String(r.preventivoStato || '') !== stato) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Aggrega per cliente.
 * @param {Array<object>} lavori
 */
export function aggregateByCliente(lavori) {
  /** @type {Map<string, object>} */
  const map = new Map();

  for (const l of lavori || []) {
    if (!l) continue;
    const key = l.clienteId || '__none__';
    let row = map.get(key);
    if (!row) {
      row = {
        clienteId: l.clienteId,
        clienteNome: l.clienteNome || l.clienteId || '—',
        nLavori: 0,
        ettari: 0,
        ore: 0,
        ricaviKnown: 0,
        ricaviSum: 0,
        missingRicavi: false,
        costiKnown: 0,
        costiSum: 0,
        missingCosti: false,
        senzaPreventivo: 0
      };
      map.set(key, row);
    }
    row.nLavori += 1;
    row.ettari += Number(l.ettari) || 0;
    row.ore += Number(l.ore) || 0;
    if (l.senzaPreventivo || l.ricavo == null) {
      row.missingRicavi = true;
      row.senzaPreventivo += 1;
    } else {
      row.ricaviSum += Number(l.ricavo) || 0;
      row.ricaviKnown += 1;
    }
    if (l.costo == null || l.partialCosto) {
      row.missingCosti = true;
      if (l.costo != null) {
        row.costiSum += Number(l.costo) || 0;
        row.costiKnown += 1;
      }
    } else {
      row.costiSum += Number(l.costo) || 0;
      row.costiKnown += 1;
    }
  }

  return [...map.values()].map((r) => {
    const ricavi = r.ricaviKnown === 0
      ? (r.missingRicavi ? null : 0)
      : euro(r.ricaviSum);
    const partialRicavi = r.ricaviKnown > 0 && r.missingRicavi;
    const costi = r.costiKnown === 0
      ? (r.missingCosti ? null : 0)
      : euro(r.costiSum);
    const partialCosti = r.costiKnown > 0 && r.missingCosti;
    let margine = null;
    let partialMargine = false;
    if (ricavi == null || costi == null) {
      margine = null;
      partialMargine = true;
    } else {
      margine = euro(Number(ricavi) - Number(costi));
      partialMargine = partialRicavi || partialCosti;
    }
    return {
      clienteId: r.clienteId,
      clienteNome: r.clienteNome,
      nLavori: r.nLavori,
      ettari: euro(r.ettari) || 0,
      ore: euro(r.ore) || 0,
      ricavi,
      partialRicavi,
      costi,
      partialCosti,
      margine,
      partialMargine,
      euroPerHa: euroPerHa(ricavi, r.ettari),
      senzaPreventivo: r.senzaPreventivo
    };
  }).sort((a, b) => String(a.clienteNome).localeCompare(String(b.clienteNome), 'it'));
}

/**
 * Barre: top N clienti per ricavi + «Altri».
 * @param {Array<object>} byCliente
 * @param {number} [topN=7]
 */
export function aggregateRicaviClientiForChart(byCliente, topN = 7) {
  const attributed = [...(byCliente || [])]
    .filter((r) => r && (Number(r.ricavi) > 0 || r.partialRicavi))
    .map((r) => ({
      clienteId: r.clienteId,
      nome: r.clienteNome || r.clienteId || '—',
      valore: r.ricavi == null ? null : Number(r.ricavi)
    }))
    .sort((a, b) => (Number(b.valore) || 0) - (Number(a.valore) || 0));

  const n = Math.max(0, topN);
  const top = attributed.slice(0, n);
  const rest = attributed.slice(n);
  const out = top.map((x) => ({
    clienteId: x.clienteId,
    nome: x.nome,
    valore: x.valore == null ? null : euro(x.valore)
  }));
  if (rest.length) {
    const altri = rest.reduce((acc, x) => {
      if (x.valore != null) acc.known += Number(x.valore) || 0;
      else acc.missing = true;
      return acc;
    }, { known: 0, missing: false });
    out.push({
      clienteId: '__altri__',
      nome: 'Altri',
      valore: altri.missing && !(altri.known > 0) ? null : euro(altri.known)
    });
  }
  return out;
}

const MESI_IT_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/**
 * Mensile ricavi vs costi.
 * @param {Array<object>} lavori
 */
export function aggregateMonthlyRicaviCosti(lavori) {
  /** @type {Map<string, { ricavi: number, costi: number, missR: boolean, missC: boolean, knownR: number, knownC: number }>} */
  const map = new Map();
  for (const l of lavori || []) {
    if (!l) continue;
    const iso = String(l.dataIso || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(iso)) continue;
    let b = map.get(iso);
    if (!b) {
      b = { ricavi: 0, costi: 0, missR: false, missC: false, knownR: 0, knownC: 0 };
      map.set(iso, b);
    }
    if (l.ricavo == null || l.senzaPreventivo) b.missR = true;
    else {
      b.ricavi += Number(l.ricavo) || 0;
      b.knownR += 1;
    }
    if (l.costo == null || l.partialCosto) {
      b.missC = true;
      if (l.costo != null) {
        b.costi += Number(l.costo) || 0;
        b.knownC += 1;
      }
    } else {
      b.costi += Number(l.costo) || 0;
      b.knownC += 1;
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, b]) => {
      const [y, mo] = ym.split('-');
      const mi = Number(mo) - 1;
      return {
        ym,
        label: `${MESI_IT_SHORT[mi] || mo} ${y}`,
        ricavi: b.knownR === 0 ? (b.missR ? null : 0) : euro(b.ricavi),
        costi: b.knownC === 0 ? (b.missC ? null : 0) : euro(b.costi),
        partialRicavi: b.knownR > 0 && b.missR,
        partialCosti: b.knownC > 0 && b.missC
      };
    });
}

/**
 * Conta preventivi per stato (KPI).
 * @param {Array<object>} preventivi
 */
export function countPreventiviByStato(preventivi) {
  let inAttesa = 0;
  let accettati = 0;
  let rifiutatiOScaduti = 0;
  for (const p of preventivi || []) {
    if (!p) continue;
    if (isPreventivoInAttesa(p.stato)) inAttesa += 1;
    else if (isPreventivoAccettato(p.stato)) accettati += 1;
    else if (isPreventivoRifiutatoOScaduto(p.stato)) rifiutatiOScaduti += 1;
  }
  return { inAttesa, accettati, rifiutatiOScaduti };
}

/**
 * @param {Array<object>} byCliente
 * @param {Array<object>} lavori
 * @param {{ inAttesa: number, accettati: number, rifiutatiOScaduti: number }} preventiviCount
 */
export function buildContoTerziKpi(byCliente, lavori, preventiviCount) {
  let ricavi = 0;
  let costi = 0;
  let knownR = 0;
  let knownC = 0;
  let missR = false;
  let missC = false;
  let ettari = 0;
  const clienti = new Set();

  for (const r of byCliente || []) {
    if (!r) continue;
    if (r.clienteId) clienti.add(String(r.clienteId));
    ettari += Number(r.ettari) || 0;
    if (r.ricavi == null) {
      if (r.partialRicavi || r.nLavori > 0) missR = true;
    } else {
      ricavi += Number(r.ricavi) || 0;
      knownR += 1;
      if (r.partialRicavi) missR = true;
    }
    if (r.costi == null) {
      if (r.partialCosti || r.nLavori > 0) missC = true;
    } else {
      costi += Number(r.costi) || 0;
      knownC += 1;
      if (r.partialCosti) missC = true;
    }
  }

  const ricaviVal = knownR === 0 ? (missR ? null : 0) : euro(ricavi);
  const costiVal = knownC === 0 ? (missC ? null : 0) : euro(costi);
  const partialRicavi = knownR > 0 && missR;
  const partialCosti = knownC > 0 && missC;
  let margine = null;
  let partialMargine = false;
  if (ricaviVal == null || costiVal == null) {
    margine = null;
    partialMargine = true;
  } else {
    margine = euro(Number(ricaviVal) - Number(costiVal));
    partialMargine = partialRicavi || partialCosti;
  }

  void lavori;
  return {
    ricavi: ricaviVal,
    partialRicavi,
    costi: costiVal,
    partialCosti,
    margine,
    partialMargine,
    ettari: euro(ettari) || 0,
    nClienti: clienti.size,
    nLavori: (lavori || []).length,
    preventiviInAttesa: preventiviCount.inAttesa || 0,
    preventiviAccettati: preventiviCount.accettati || 0,
    preventiviRifiutatiOScaduti: preventiviCount.rifiutatiOScaduti || 0
  };
}

/**
 * Dettaglio lavori di un cliente.
 * @param {Array<object>} lavori
 * @param {string} clienteId
 */
export function buildClienteDetailRows(lavori, clienteId) {
  const id = String(clienteId || '');
  return (lavori || [])
    .filter((l) => l && String(l.clienteId || '') === id)
    .slice()
    .sort((a, b) => String(b.dataIso || '').localeCompare(String(a.dataIso || '')));
}

/**
 * Export Excel: stessi filtri/righe della pagina.
 * @param {{ byCliente: Array<object>, kpi: object, lavori: Array<object>, notes?: string[] }} data
 */
export function prepareContoTerziExportData(data) {
  const kpi = data.kpi || {};
  const byCliente = data.byCliente || [];
  const lavori = data.lavori || [];
  const notes = data.notes || [];
  return {
    kpi: {
      ricavi: kpi.ricavi,
      costi: kpi.costi,
      margine: kpi.margine,
      ettari: kpi.ettari,
      nClienti: kpi.nClienti,
      nLavori: kpi.nLavori,
      preventiviInAttesa: kpi.preventiviInAttesa,
      preventiviAccettati: kpi.preventiviAccettati,
      preventiviRifiutatiOScaduti: kpi.preventiviRifiutatiOScaduti,
      annotazione: 'Ricavi senza IVA'
    },
    perCliente: byCliente.map((r) => ({
      cliente: r.clienteNome,
      nLavori: r.nLavori,
      ettari: r.ettari,
      ore: r.ore,
      ricavi: r.ricavi,
      costi: r.costi,
      margine: r.margine,
      euroPerHa: r.euroPerHa,
      senzaPreventivo: r.senzaPreventivo
    })),
    lavori: lavori.map((l) => ({
      data: l.dataIso,
      cliente: l.clienteNome,
      tipo: l.tipoLavoro,
      terreno: l.terrenoNome,
      ettari: euro(l.ettari) || 0,
      ore: l.ore,
      ricavo: l.ricavo,
      costo: l.costo,
      margine: l.margine,
      preventivo: formatPreventivoRifLabel(l) || l.preventivoNumero || '',
      statoPreventivo: labelStatoPreventivo(l.preventivoStato),
      senzaPreventivo: !!l.senzaPreventivo,
      costoParziale: !!l.partialCosto
    })),
    notes
  };
}

/**
 * Assembla il report completo da lavori CT già costati + preventivi + clienti.
 *
 * @param {{
 *   lavori?: Array<object>,
 *   costiByLavoroId?: Map<string, object>|Record<string, object>,
 *   preventivi?: Array<object>,
 *   clienti?: Array<object>,
 *   terreni?: Array<object>,
 *   movimenti?: Array<object>,
 *   prodotti?: Array<object>
 * }} input
 * @param {{ clienteId?: string|null, tipoLavoro?: string|null, statoPreventivo?: string|null }} [filters]
 */
export function assembleContoTerziReport(input = {}, filters = {}) {
  const clienti = input.clienti || [];
  const clientiById = new Map(
    clienti.filter((c) => c && c.id).map((c) => [String(c.id), c])
  );
  const terreni = input.terreni || [];
  const terrenoById = new Map(
    terreni.filter((t) => t && t.id).map((t) => [String(t.id), t])
  );
  const preventivi = input.preventivi || [];
  const prodotti = input.prodotti || [];
  const prodottiById = new Map(
    prodotti.filter((p) => p && p.id).map((p) => [String(p.id), p])
  );

  /** @type {Map<string, object>} */
  let costiByLavoroId;
  if (input.costiByLavoroId instanceof Map) {
    costiByLavoroId = input.costiByLavoroId;
  } else {
    costiByLavoroId = new Map(Object.entries(input.costiByLavoroId || {}));
  }

  // uscite per lavoroId
  /** @type {Map<string, object[]>} */
  const usciteByLavoroId = new Map();
  for (const mov of input.movimenti || []) {
    if (!mov || String(mov.tipo || '').toLowerCase() !== 'uscita') continue;
    const lid = mov.lavoroId ? String(mov.lavoroId) : null;
    if (!lid) continue;
    if (!usciteByLavoroId.has(lid)) usciteByLavoroId.set(lid, []);
    usciteByLavoroId.get(lid).push(mov);
  }

  const enrichedAll = [];
  for (const lav of input.lavori || []) {
    if (!lav || !lav.clienteId || !String(lav.clienteId).trim()) continue;
    const id = lav.id ? String(lav.id) : null;
    const baseCosti = (id && costiByLavoroId.get(id)) || {
      ore: 0,
      costoManodopera: 0,
      missingManodopera: false,
      costoMacchine: 0,
      missingMacchine: false,
      notes: []
    };
    const uscite = id ? (usciteByLavoroId.get(id) || []) : [];
    const prod = costoProdottiFromMovimenti(uscite, prodottiById);
    const costi = {
      ...baseCosti,
      costoProdotti: prod.costoProdotti,
      missingProdotti: prod.missingProdotti,
      notes: [...(baseCosti.notes || []), ...prod.notes]
    };
    const row = enrichLavoroCt(lav, {
      preventivi,
      clientiById,
      terrenoById,
      costi
    });
    if (row) enrichedAll.push(row);
  }

  // Un preventivo collegato a più lavori: ricavo una sola volta, ripartito per ettari.
  applyRicaviPreventiviCondivisi(enrichedAll);

  const lavori = filterLavoriCt(enrichedAll, filters);

  // preventivi nel perimetro filtri (cliente / tipo / stato) per i KPI stato
  const preventiviFiltrati = (preventivi || []).filter((p) => {
    if (!p) return false;
    if (filters.clienteId && String(p.clienteId || '') !== String(filters.clienteId)) return false;
    if (filters.tipoLavoro && String(p.tipoLavoro || '') !== String(filters.tipoLavoro)) return false;
    if (filters.statoPreventivo) {
      if (filters.statoPreventivo === '__senza__') return false;
      if (String(p.stato || '') !== String(filters.statoPreventivo)) return false;
    }
    return true;
  });
  const preventiviCount = countPreventiviByStato(preventiviFiltrati);

  const byCliente = aggregateByCliente(lavori);
  const kpi = buildContoTerziKpi(byCliente, lavori, preventiviCount);
  const chartRicaviClienti = aggregateRicaviClientiForChart(byCliente, 7);
  const chartMensile = aggregateMonthlyRicaviCosti(lavori);

  /** @type {string[]} */
  const notes = ['Ricavi senza IVA.'];
  const nSenza = lavori.filter((l) => l.senzaPreventivo).length;
  if (nSenza > 0) {
    notes.push(`${nSenza} lavor${nSenza === 1 ? 'o' : 'i'} senza preventivo accettato (ricavo —; totali con *).`);
  }
  const preventiviCondivisiInView = new Set(
    lavori.filter((l) => l && l.preventivoCondivisoN > 1 && l.preventivoId)
      .map((l) => String(l.preventivoId))
  );
  if (preventiviCondivisiInView.size > 0) {
    const np = preventiviCondivisiInView.size;
    notes.push(
      `${np} preventiv${np === 1 ? 'o' : 'i'} collegat${np === 1 ? 'o' : 'i'} a più lavori: ` +
      'il ricavo è ripartito in quota proporzionale agli ettari (o in parti uguali se gli ettari mancano); ' +
      'nei dettagli compare «quota di PREV-… (n lavori)».'
    );
  }
  if (kpi.partialCosti || kpi.costi == null) {
    notes.push('Alcuni costi orari o prezzi prodotti mancano (mostrati come —; totali con * se parziali).');
  }

  return {
    lavori,
    byCliente,
    kpi,
    chartRicaviClienti,
    chartMensile,
    preventivi: preventiviFiltrati,
    notes,
    empty: !(lavori.length),
    ready: true
  };
}

export function formatEuroPrefixCompact(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  if (Math.abs(n) >= 1000) {
    return `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k €`;
  }
  return `${n.toLocaleString('it-IT', { maximumFractionDigits: 0 })} €`;
}

export function isContoTerziDataReady(data) {
  return !!(data && data.ready);
}
