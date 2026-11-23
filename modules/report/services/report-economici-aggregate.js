/**
 * Aggregati puri Report Economici (terreno × coltura).
 * Nessuna I/O: pensato per unit test e riuso futuro (Tony / Context Builder).
 *
 * Regola anti-doppio conteggio (lavoro ↔ trattamento):
 * - manodopera e macchine solo da lavori + attività di diario dirette;
 * - prodotti solo da `costoProdotto` dei trattamenti/concimazioni;
 * - mai sommare costoManodopera/costoMacchina del documento trattamento
 *   (restano sul lavoro o sul diario collegato).
 *
 * @module modules/report/services/report-economici-aggregate
 */

export function euro(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Math.round(Number(value) * 100) / 100;
}

export function formatLocalIsoDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  const x = new Date(val);
  return Number.isNaN(x.getTime()) ? null : x;
}

export function inRange(d, start, end) {
  const x = toDate(d);
  if (!x) return false;
  return x >= start && x <= end;
}

/** Campo data attività: stringa YYYY-MM-DD o Timestamp/Date. */
export function dataIsoInRange(val, start, end) {
  const a = formatLocalIsoDate(start);
  const b = formatLocalIsoDate(end);
  if (!a || !b) return false;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    const s = val.slice(0, 10);
    return s >= a && s <= b;
  }
  return inRange(val, start, end);
}

export function dataIsoFromAny(val) {
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val.slice(0, 10);
  }
  return formatLocalIsoDate(toDate(val));
}

/**
 * Chiave anti-doppione diario ↔ lavoro (stesso criterio seminativo/orticole spese).
 * @param {string} terrenoId
 * @param {string} dataIso
 * @param {string} tipoLavoro
 */
export function chiaveLavoroDiario(terrenoId, dataIso, tipoLavoro) {
  return `${String(terrenoId || '')}|${String(dataIso || '')}|${String(tipoLavoro || '').trim().toLowerCase()}`;
}

/**
 * @param {number|null|undefined} totale
 * @param {number|null|undefined} ettari
 * @returns {number|null}
 */
export function euroPerHa(totale, ettari) {
  const t = euro(totale);
  const ha = Number(ettari);
  if (t == null) return null;
  if (!ha || ha <= 0 || Number.isNaN(ha)) return null;
  return euro(t / ha);
}

/**
 * Somma costi: null se almeno un addendo è null e c’è attività; 0 se tutti assenti/zero.
 * @param {Array<number|null|undefined>} values
 * @param {{ anyMissing?: boolean }} [opts]
 */
export function sumNullable(values, opts = {}) {
  if (opts.anyMissing) return null;
  let sum = 0;
  let sawNull = false;
  let sawNumber = false;
  for (const v of values || []) {
    if (v == null) {
      sawNull = true;
      continue;
    }
    sawNumber = true;
    sum += Number(v) || 0;
  }
  if (sawNull && !sawNumber) return null;
  if (sawNull) return null;
  return euro(sum);
}

/**
 * Aggrega linee di costo già normalizzate per terreno × coltura.
 *
 * @param {Array<{
 *   terrenoId: string,
 *   terrenoNome?: string,
 *   coltura?: string,
 *   ettari?: number|null,
 *   ore?: number,
 *   costoManodopera?: number|null,
 *   costoMacchine?: number|null,
 *   costoProdotti?: number|null,
 *   missingManodopera?: boolean,
 *   missingMacchine?: boolean,
 *   missingProdotti?: boolean,
 *   notes?: string[]
 * }>} lines
 * @param {{ terrenoId?: string|null, coltura?: string|null }} [filters]
 */
export function aggregateEconomiciRows(lines, filters = {}) {
  const wantTerreno = filters.terrenoId ? String(filters.terrenoId) : null;
  const wantColtura = filters.coltura != null && String(filters.coltura).trim() !== ''
    ? String(filters.coltura).trim().toLowerCase()
    : null;

  /** @type {Map<string, object>} */
  const map = new Map();
  /** @type {Set<string>} */
  const notes = new Set();

  for (const line of lines || []) {
    if (!line || !line.terrenoId) continue;
    const terrenoId = String(line.terrenoId);
    if (wantTerreno && terrenoId !== wantTerreno) continue;
    const coltura = (line.coltura && String(line.coltura).trim()) || 'Senza coltura';
    if (wantColtura && coltura.toLowerCase() !== wantColtura) continue;

    const key = `${terrenoId}||${coltura}`;
    let row = map.get(key);
    if (!row) {
      row = {
        terrenoId,
        terrenoNome: line.terrenoNome || terrenoId,
        coltura,
        ettari: line.ettari != null ? Number(line.ettari) : null,
        ore: 0,
        costoManodopera: 0,
        costoMacchine: 0,
        costoProdotti: 0,
        missingManodopera: false,
        missingMacchine: false,
        missingProdotti: false,
        hasManodopera: false,
        hasMacchine: false,
        hasProdotti: false
      };
      map.set(key, row);
    }

    row.ore += Number(line.ore) || 0;
    if (line.ettari != null && (row.ettari == null || row.ettari === 0)) {
      row.ettari = Number(line.ettari);
    }
    if (line.terrenoNome) row.terrenoNome = line.terrenoNome;

    if (line.missingManodopera) row.missingManodopera = true;
    if (line.missingMacchine) row.missingMacchine = true;
    if (line.missingProdotti) row.missingProdotti = true;

    if (line.costoManodopera != null) {
      row.hasManodopera = true;
      row.costoManodopera += Number(line.costoManodopera) || 0;
    } else if (line.missingManodopera) {
      row.missingManodopera = true;
    }
    if (line.costoMacchine != null) {
      row.hasMacchine = true;
      row.costoMacchine += Number(line.costoMacchine) || 0;
    } else if (line.missingMacchine) {
      row.missingMacchine = true;
    }
    if (line.costoProdotti != null) {
      row.hasProdotti = true;
      row.costoProdotti += Number(line.costoProdotti) || 0;
    } else if (line.missingProdotti) {
      row.missingProdotti = true;
    }

    for (const n of line.notes || []) {
      if (n) notes.add(String(n));
    }
  }

  const rows = [...map.values()].map((r) => {
    const costoManodopera = r.missingManodopera ? null : euro(r.hasManodopera ? r.costoManodopera : 0);
    const costoMacchine = r.missingMacchine ? null : euro(r.hasMacchine ? r.costoMacchine : 0);
    const costoProdotti = r.missingProdotti ? null : euro(r.hasProdotti ? r.costoProdotti : 0);
    const anyMissing = costoManodopera == null || costoMacchine == null || costoProdotti == null;
    const totale = anyMissing
      ? null
      : euro((costoManodopera || 0) + (costoMacchine || 0) + (costoProdotti || 0));
    return {
      terrenoId: r.terrenoId,
      terrenoNome: r.terrenoNome,
      coltura: r.coltura,
      ettari: r.ettari != null ? euro(r.ettari) : null,
      ore: euro(r.ore) || 0,
      costoManodopera,
      costoMacchine,
      costoProdotti,
      totale,
      euroHa: euroPerHa(totale, r.ettari)
    };
  });

  rows.sort((a, b) => {
    const na = `${a.terrenoNome} ${a.coltura}`.toLowerCase();
    const nb = `${b.terrenoNome} ${b.coltura}`.toLowerCase();
    return na.localeCompare(nb, 'it');
  });

  return { rows, notes: [...notes] };
}

/**
 * Totali per coltura (somma righe già filtrate).
 * @param {Array<object>} rows
 */
export function totalsByColtura(rows) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const r of rows || []) {
    const key = r.coltura || 'Senza coltura';
    let t = map.get(key);
    if (!t) {
      t = {
        coltura: key,
        ettari: 0,
        ore: 0,
        costoManodopera: 0,
        costoMacchine: 0,
        costoProdotti: 0,
        missingManodopera: false,
        missingMacchine: false,
        missingProdotti: false,
        hasManodopera: false,
        hasMacchine: false,
        hasProdotti: false
      };
      map.set(key, t);
    }
    t.ettari += Number(r.ettari) || 0;
    t.ore += Number(r.ore) || 0;
    if (r.costoManodopera == null) t.missingManodopera = true;
    else {
      t.hasManodopera = true;
      t.costoManodopera += Number(r.costoManodopera) || 0;
    }
    if (r.costoMacchine == null) t.missingMacchine = true;
    else {
      t.hasMacchine = true;
      t.costoMacchine += Number(r.costoMacchine) || 0;
    }
    if (r.costoProdotti == null) t.missingProdotti = true;
    else {
      t.hasProdotti = true;
      t.costoProdotti += Number(r.costoProdotti) || 0;
    }
  }

  return [...map.values()].map((t) => {
    const costoManodopera = t.missingManodopera ? null : euro(t.hasManodopera ? t.costoManodopera : 0);
    const costoMacchine = t.missingMacchine ? null : euro(t.hasMacchine ? t.costoMacchine : 0);
    const costoProdotti = t.missingProdotti ? null : euro(t.hasProdotti ? t.costoProdotti : 0);
    const anyMissing = costoManodopera == null || costoMacchine == null || costoProdotti == null;
    const totale = anyMissing
      ? null
      : euro((costoManodopera || 0) + (costoMacchine || 0) + (costoProdotti || 0));
    return {
      coltura: t.coltura,
      ettari: euro(t.ettari),
      ore: euro(t.ore) || 0,
      costoManodopera,
      costoMacchine,
      costoProdotti,
      totale,
      euroHa: euroPerHa(totale, t.ettari)
    };
  }).sort((a, b) => String(a.coltura).localeCompare(String(b.coltura), 'it'));
}

/**
 * Totale azienda dalle righe.
 * @param {Array<object>} rows
 */
export function companyTotal(rows) {
  const list = rows || [];
  let ettari = 0;
  let ore = 0;
  let costoManodopera = 0;
  let costoMacchine = 0;
  let costoProdotti = 0;
  let missingManodopera = false;
  let missingMacchine = false;
  let missingProdotti = false;
  let hasManodopera = false;
  let hasMacchine = false;
  let hasProdotti = false;

  for (const r of list) {
    ettari += Number(r.ettari) || 0;
    ore += Number(r.ore) || 0;
    if (r.costoManodopera == null) missingManodopera = true;
    else {
      hasManodopera = true;
      costoManodopera += Number(r.costoManodopera) || 0;
    }
    if (r.costoMacchine == null) missingMacchine = true;
    else {
      hasMacchine = true;
      costoMacchine += Number(r.costoMacchine) || 0;
    }
    if (r.costoProdotti == null) missingProdotti = true;
    else {
      hasProdotti = true;
      costoProdotti += Number(r.costoProdotti) || 0;
    }
  }

  const m = missingManodopera ? null : euro(hasManodopera ? costoManodopera : 0);
  const mac = missingMacchine ? null : euro(hasMacchine ? costoMacchine : 0);
  const p = missingProdotti ? null : euro(hasProdotti ? costoProdotti : 0);
  const anyMissing = m == null || mac == null || p == null;
  const totale = anyMissing ? null : euro((m || 0) + (mac || 0) + (p || 0));

  return {
    label: 'Totale azienda',
    ettari: euro(ettari),
    ore: euro(ore) || 0,
    costoManodopera: m,
    costoMacchine: mac,
    costoProdotti: p,
    totale,
    euroHa: euroPerHa(totale, ettari)
  };
}

/**
 * Costruisce linee di costo da sorgenti già caricate (puro).
 *
 * @param {object} input
 * @param {Array} input.terreni
 * @param {Array} input.lavoriCosti - { id, terrenoId, dataIso, tipoLavoro, ore, costoManodopera, costoMacchine, missingManodopera?, missingMacchine?, notes? }
 * @param {Array} input.attivitaCosti - diario diretto (senza lavoroId)
 * @param {Array} input.prodottiCosti - { terrenoId, costoProdotti, missingProdotti?, notes? }
 * @param {Set<string>} [input.activeModules]
 */
export function buildEconomiciLines(input = {}) {
  const terreniById = new Map();
  for (const t of input.terreni || []) {
    if (!t || !t.id) continue;
    if (t.clienteId && String(t.clienteId).trim()) continue;
    terreniById.set(String(t.id), t);
  }

  const chiaviLavoro = new Set();
  /** @type {Array<object>} */
  const lines = [];

  for (const lav of input.lavoriCosti || []) {
    if (!lav || !lav.terrenoId) continue;
    const terreno = terreniById.get(String(lav.terrenoId));
    if (!terreno) continue;
    const dataIso = lav.dataIso || '';
    const tipo = lav.tipoLavoro || '';
    chiaviLavoro.add(chiaveLavoroDiario(lav.terrenoId, dataIso, tipo));
    lines.push({
      terrenoId: String(lav.terrenoId),
      terrenoNome: terreno.nome || terreno.podere || lav.terrenoId,
      coltura: (terreno.coltura && String(terreno.coltura).trim()) || 'Senza coltura',
      ettari: terreno.stato === 'archiviato' ? 0 : (terreno.superficie != null ? Number(terreno.superficie) : null),
      ore: Number(lav.ore) || 0,
      costoManodopera: lav.missingManodopera ? null : (lav.costoManodopera != null ? Number(lav.costoManodopera) : 0),
      costoMacchine: lav.missingMacchine ? null : (lav.costoMacchine != null ? Number(lav.costoMacchine) : 0),
      costoProdotti: 0,
      missingManodopera: !!lav.missingManodopera,
      missingMacchine: !!lav.missingMacchine,
      notes: lav.notes || []
    });
  }

  for (const att of input.attivitaCosti || []) {
    if (!att || !att.terrenoId) continue;
    if (att.lavoroId || att.clienteId) continue;
    const terreno = terreniById.get(String(att.terrenoId));
    if (!terreno) continue;
    const dataIso = att.dataIso || '';
    const tipo = att.tipoLavoro || '';
    if (chiaviLavoro.has(chiaveLavoroDiario(att.terrenoId, dataIso, tipo))) continue;
    lines.push({
      terrenoId: String(att.terrenoId),
      terrenoNome: terreno.nome || terreno.podere || att.terrenoId,
      coltura: (terreno.coltura && String(terreno.coltura).trim()) || 'Senza coltura',
      ettari: terreno.stato === 'archiviato' ? 0 : (terreno.superficie != null ? Number(terreno.superficie) : null),
      ore: Number(att.ore) || 0,
      costoManodopera: att.missingManodopera ? null : (att.costoManodopera != null ? Number(att.costoManodopera) : 0),
      costoMacchine: att.missingMacchine ? null : (att.costoMacchine != null ? Number(att.costoMacchine) : 0),
      costoProdotti: 0,
      missingManodopera: !!att.missingManodopera,
      missingMacchine: !!att.missingMacchine,
      notes: att.notes || []
    });
  }

  for (const prod of input.prodottiCosti || []) {
    if (!prod || !prod.terrenoId) continue;
    const terreno = terreniById.get(String(prod.terrenoId));
    if (!terreno) continue;
    lines.push({
      terrenoId: String(prod.terrenoId),
      terrenoNome: terreno.nome || terreno.podere || prod.terrenoId,
      coltura: (terreno.coltura && String(terreno.coltura).trim()) || 'Senza coltura',
      ettari: terreno.stato === 'archiviato' ? 0 : (terreno.superficie != null ? Number(terreno.superficie) : null),
      ore: 0,
      costoManodopera: 0,
      costoMacchine: 0,
      costoProdotti: prod.missingProdotti ? null : (prod.costoProdotti != null ? Number(prod.costoProdotti) : 0),
      missingProdotti: !!prod.missingProdotti,
      notes: prod.notes || []
    });
  }

  return lines;
}

/**
 * Estrae solo il costo prodotti da un trattamento (ignora manodopera/macchine sul doc).
 * @param {object} row
 * @returns {{ costoProdotti: number|null, missingProdotti: boolean, notes: string[] }}
 */
export function prodottoCostFromTrattamento(row) {
  if (!row) return { costoProdotti: 0, missingProdotti: false, notes: [] };
  const prodotti = Array.isArray(row.prodotti) ? row.prodotti : [];
  const costoEsplicito = row.costoProdotto != null ? Number(row.costoProdotto) : null;
  const sommaRighe = prodotti.reduce((s, p) => s + (Number(p && p.costo) || 0), 0);
  const hasQty = prodotti.some((p) => {
    const q = Number(p && (p.quantita != null ? p.quantita : p.dosaggio));
    return !Number.isNaN(q) && q > 0;
  }) || (Number(row.quantita) > 0);

  if (costoEsplicito != null && !Number.isNaN(costoEsplicito) && costoEsplicito > 0) {
    return { costoProdotti: euro(costoEsplicito), missingProdotti: false, notes: [] };
  }
  if (sommaRighe > 0) {
    return { costoProdotti: euro(sommaRighe), missingProdotti: false, notes: [] };
  }
  if (hasQty || (prodotti.length > 0 && (costoEsplicito === 0 || costoEsplicito == null))) {
    return {
      costoProdotti: null,
      missingProdotti: true,
      notes: ['Prezzo prodotto non in anagrafica (o costo non registrato sul trattamento)']
    };
  }
  return { costoProdotti: 0, missingProdotti: false, notes: [] };
}
