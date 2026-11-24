/**
 * Aggregati puri Report Economici (terreno × coltura).
 * Nessuna I/O: pensato per unit test e riuso futuro (Tony / Context Builder).
 *
 * Regole:
 * - manodopera/macchine da lavori + diario; prodotti da trattamenti + uscite magazzino
 *   non già collegate a un trattamento (`magazzinoMovimentoIds` / origineTrattamento*);
 * - coltura alla data della riga (campagna/impianto), non solo anagrafe attuale;
 * - totali parziali: somma dei noti + flag partial; «—» solo senza alcun valore noto.
 *
 * @module modules/report/services/report-economici-aggregate
 */

export const TERRENO_NON_ATTRIBUITO_ID = '__non_attribuito__';
export const TERRENO_NON_ATTRIBUITO_NOME = 'Non attribuito a un terreno';

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
 * Unisce liste di documenti deduplicando per `id` (prima occorrenza vince).
 * Usato quando si fanno due range query sullo stesso campo in formati diversi
 * (stringa ISO vs Timestamp): Firestore non mescola i tipi in un solo range.
 * @param {...Array<object>} lists
 * @returns {Array<object>}
 */
export function mergeDocsById(...lists) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const list of lists) {
    for (const doc of list || []) {
      if (!doc || doc.id == null || doc.id === '') continue;
      const key = String(doc.id);
      if (!map.has(key)) map.set(key, doc);
    }
  }
  return [...map.values()];
}

export function chiaveLavoroDiario(terrenoId, dataIso, tipoLavoro) {
  return `${String(terrenoId || '')}|${String(dataIso || '')}|${String(tipoLavoro || '').trim().toLowerCase()}`;
}

/** Intervallo campagna agricola IT (1 set – 31 ago), come seminativo/orticole. */
export function intervalloCampagnaLabel(label) {
  const match = String(label || '').match(/(\d{4})\s*\/\s*(\d{4})/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end !== start + 1) return null;
  return { inizio: `${match[1]}-09-01`, fine: `${match[2]}-08-31` };
}

/**
 * Somma valori noti; partial se manca almeno un pezzo.
 * «—» (null) solo se non c’è nessun valore noto e c’è almeno un missing.
 *
 * @param {Array<number|null|undefined>} values
 * @param {{ anyMissing?: boolean }} [opts]
 * @returns {{ value: number|null, partial: boolean }}
 */
export function sumNullable(values, opts = {}) {
  let sum = 0;
  let known = 0;
  let missing = !!opts.anyMissing;
  for (const v of values || []) {
    if (v == null || Number.isNaN(Number(v))) {
      missing = true;
      continue;
    }
    known += 1;
    sum += Number(v);
  }
  if (known === 0) {
    return { value: missing ? null : 0, partial: false };
  }
  return { value: euro(sum), partial: missing };
}

export function euroPerHa(totale, ettari) {
  const t = euro(totale);
  const ha = Number(ettari);
  if (t == null) return null;
  if (!ha || ha <= 0 || Number.isNaN(ha)) return null;
  return euro(t / ha);
}

function emptyCostAcc() {
  return { sum: 0, known: false, missing: false, partialHints: [] };
}

function mergeCostAcc(acc, value, missing, hint) {
  if (value != null && !Number.isNaN(Number(value))) {
    acc.known = true;
    acc.sum += Number(value);
  }
  if (missing) {
    acc.missing = true;
    if (hint) acc.partialHints.push(String(hint));
  }
}

function finalizeCostAcc(acc) {
  if (!acc.known && acc.missing) {
    return { value: null, partial: false, hints: acc.partialHints };
  }
  if (!acc.known) {
    return { value: 0, partial: false, hints: [] };
  }
  return {
    value: euro(acc.sum),
    partial: acc.missing,
    hints: acc.missing ? acc.partialHints : []
  };
}

function combineColumnResults(cols) {
  let sum = 0;
  let known = 0;
  let partial = false;
  const hints = [];
  for (const c of cols) {
    if (c.value == null) {
      if (c.missingActivity || c.partial) {
        partial = true;
        for (const h of c.hints || []) hints.push(h);
      }
      continue;
    }
    known += 1;
    sum += Number(c.value) || 0;
    if (c.partial) {
      partial = true;
      for (const h of c.hints || []) hints.push(h);
    }
  }
  if (known === 0) {
    return { value: null, partial: false, hints: [...new Set(hints)] };
  }
  return { value: euro(sum), partial, hints: [...new Set(hints)] };
}

/**
 * Coltura in vigore alla data della riga.
 * Ordine: campo esplicito → campagna seminativo → campagna orticole → vigneto → frutteto → anagrafe terreno.
 *
 * @param {object} opts
 * @param {string} [opts.dataIso]
 * @param {string} [opts.terrenoId]
 * @param {string} [opts.explicitColtura]
 * @param {string} [opts.campagnaId]
 * @param {Array<{ id?: string, terrenoId?: string, campagna?: string, colturaNome?: string }>} [opts.campagneSeminativo]
 * @param {Array<{ id?: string, terrenoId?: string, campagna?: string, colturaNome?: string }>} [opts.campagneOrticole]
 * @param {Array<{ terrenoId?: string, varieta?: string }>} [opts.vigneti]
 * @param {Array<{ terrenoId?: string, specie?: string, varieta?: string }>} [opts.frutteti]
 * @param {string} [opts.terrenoColtura]
 */
export function resolveColturaAtDate(opts = {}) {
  const explicit = opts.explicitColtura && String(opts.explicitColtura).trim();
  if (explicit) return explicit;

  const terrenoId = String(opts.terrenoId || '');
  const dataIso = opts.dataIso || '';
  const campagnaId = opts.campagnaId ? String(opts.campagnaId) : '';

  const matchCampagna = (list) => {
    for (const c of list || []) {
      if (!c) continue;
      if (campagnaId && String(c.id || '') === campagnaId) {
        const nome = (c.colturaNome && String(c.colturaNome).trim()) || '';
        if (nome) return nome;
      }
      if (!terrenoId || String(c.terrenoId || '') !== terrenoId) continue;
      const range = intervalloCampagnaLabel(c.campagna);
      if (range && dataIso && dataIso >= range.inizio && dataIso <= range.fine) {
        const nome = (c.colturaNome && String(c.colturaNome).trim()) || '';
        if (nome) return nome;
      }
    }
    return '';
  };

  const fromSemi = matchCampagna(opts.campagneSeminativo);
  if (fromSemi) return fromSemi;
  const fromOrt = matchCampagna(opts.campagneOrticole);
  if (fromOrt) return fromOrt;

  if (terrenoId) {
    for (const v of opts.vigneti || []) {
      if (v && String(v.terrenoId || '') === terrenoId) {
        const nome = (v.varieta && String(v.varieta).trim()) || 'Vite';
        return nome;
      }
    }
    for (const f of opts.frutteti || []) {
      if (f && String(f.terrenoId || '') === terrenoId) {
        const nome = (f.specie && String(f.specie).trim())
          || (f.varieta && String(f.varieta).trim())
          || 'Frutteto';
        return nome;
      }
    }
  }

  const fallback = opts.terrenoColtura && String(opts.terrenoColtura).trim();
  return fallback || 'Senza coltura';
}

/**
 * @param {Array<object>} lines
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
    if (!line) continue;
    const nonAttribuito = !!line.nonAttribuito || String(line.terrenoId || '') === TERRENO_NON_ATTRIBUITO_ID;
    const terrenoId = nonAttribuito ? TERRENO_NON_ATTRIBUITO_ID : String(line.terrenoId || '');
    if (!terrenoId) continue;
    if (wantTerreno && terrenoId !== wantTerreno) continue;
    const coltura = (line.coltura && String(line.coltura).trim()) || 'Senza coltura';
    if (wantColtura && coltura.toLowerCase() !== wantColtura) continue;

    const key = `${terrenoId}||${coltura}`;
    let row = map.get(key);
    if (!row) {
      row = {
        terrenoId,
        terrenoNome: nonAttribuito
          ? TERRENO_NON_ATTRIBUITO_NOME
          : (line.terrenoNome || terrenoId),
        coltura,
        nonAttribuito,
        ettari: line.ettari != null ? Number(line.ettari) : null,
        ore: 0,
        mano: emptyCostAcc(),
        mac: emptyCostAcc(),
        prod: emptyCostAcc()
      };
      map.set(key, row);
    }

    row.ore += Number(line.ore) || 0;
    if (line.ettari != null && (row.ettari == null || row.ettari === 0)) {
      row.ettari = Number(line.ettari);
    }
    if (line.terrenoNome && !nonAttribuito) row.terrenoNome = line.terrenoNome;

    const label = `${row.terrenoNome} · ${coltura}`;
    mergeCostAcc(
      row.mano,
      line.missingManodopera ? null : line.costoManodopera,
      !!line.missingManodopera,
      line.missingManodopera ? `manodopera (${label})` : null
    );
    mergeCostAcc(
      row.mac,
      line.missingMacchine ? null : line.costoMacchine,
      !!line.missingMacchine,
      line.missingMacchine ? `macchine (${label})` : null
    );
    mergeCostAcc(
      row.prod,
      line.missingProdotti ? null : line.costoProdotti,
      !!line.missingProdotti,
      line.missingProdotti ? `prodotti (${label})` : null
    );

    for (const n of line.notes || []) {
      if (n) notes.add(String(n));
    }
  }

  const rows = [...map.values()].map((r) => {
    const mano = finalizeCostAcc(r.mano);
    const mac = finalizeCostAcc(r.mac);
    const prod = finalizeCostAcc(r.prod);
    const tot = combineColumnResults([
      { ...mano, missingActivity: r.mano.missing && !r.mano.known },
      { ...mac, missingActivity: r.mac.missing && !r.mac.known },
      { ...prod, missingActivity: r.prod.missing && !r.prod.known }
    ]);
    const partialNotes = [];
    if (mano.partial || (mano.value == null && r.mano.missing)) {
      partialNotes.push(`parziale: manca il costo di manodopera (${r.terrenoNome} · ${r.coltura})`);
    }
    if (mac.partial || (mac.value == null && r.mac.missing)) {
      partialNotes.push(`parziale: manca il costo di macchine (${r.terrenoNome} · ${r.coltura})`);
    }
    if (prod.partial || (prod.value == null && r.prod.missing)) {
      partialNotes.push(`parziale: manca il costo di prodotti (${r.terrenoNome} · ${r.coltura})`);
    }
    for (const n of partialNotes) notes.add(n);

    return {
      terrenoId: r.terrenoId,
      terrenoNome: r.terrenoNome,
      coltura: r.coltura,
      nonAttribuito: !!r.nonAttribuito,
      ettari: r.ettari != null ? euro(r.ettari) : null,
      ore: euro(r.ore) || 0,
      costoManodopera: mano.value,
      costoMacchine: mac.value,
      costoProdotti: prod.value,
      totale: tot.value,
      euroHa: euroPerHa(tot.value, r.ettari),
      partialManodopera: mano.partial,
      partialMacchine: mac.partial,
      partialProdotti: prod.partial,
      partialTotale: tot.partial,
      partialEuroHa: tot.partial && tot.value != null,
      noteParziale: partialNotes.join('; ')
    };
  });

  rows.sort((a, b) => {
    if (a.nonAttribuito !== b.nonAttribuito) return a.nonAttribuito ? 1 : -1;
    const na = `${a.terrenoNome} ${a.coltura}`.toLowerCase();
    const nb = `${b.terrenoNome} ${b.coltura}`.toLowerCase();
    return na.localeCompare(nb, 'it');
  });

  return { rows, notes: [...notes] };
}

/**
 * Totali per coltura (esclude righe non attribuite a un terreno).
 * @param {Array<object>} rows
 */
export function totalsByColtura(rows) {
  /** @type {Map<string, object[]>} */
  const map = new Map();
  for (const r of rows || []) {
    if (r.nonAttribuito || r.terrenoId === TERRENO_NON_ATTRIBUITO_ID) continue;
    const key = r.coltura || 'Senza coltura';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }

  return [...map.entries()].map(([coltura, list]) => {
    let ettari = 0;
    let ore = 0;
    for (const r of list) {
      ettari += Number(r.ettari) || 0;
      ore += Number(r.ore) || 0;
    }
    const simple = sumCostsFromRows(list);
    return {
      coltura,
      ettari: euro(ettari),
      ore: euro(ore) || 0,
      ...simple
    };
  }).sort((a, b) => String(a.coltura).localeCompare(String(b.coltura), 'it'));
}

function sumCostsFromRows(list) {
  const mano = emptyCostAcc();
  const mac = emptyCostAcc();
  const prod = emptyCostAcc();
  const hints = [];
  for (const r of list || []) {
    if (r.costoManodopera != null) mergeCostAcc(mano, r.costoManodopera, !!r.partialManodopera, null);
    else if (r.partialManodopera || (r.noteParziale && /manodopera/i.test(r.noteParziale))) {
      mergeCostAcc(mano, null, true, null);
    } else {
      mergeCostAcc(mano, 0, false, null);
    }
    if (r.costoMacchine != null) mergeCostAcc(mac, r.costoMacchine, !!r.partialMacchine, null);
    else if (r.partialMacchine || (r.noteParziale && /macchine/i.test(r.noteParziale))) {
      mergeCostAcc(mac, null, true, null);
    } else {
      mergeCostAcc(mac, 0, false, null);
    }
    if (r.costoProdotti != null) mergeCostAcc(prod, r.costoProdotti, !!r.partialProdotti, null);
    else if (r.partialProdotti || (r.noteParziale && /prodotti/i.test(r.noteParziale))) {
      mergeCostAcc(prod, null, true, null);
    } else {
      mergeCostAcc(prod, 0, false, null);
    }
    if (r.noteParziale) hints.push(r.noteParziale);
  }
  const m = finalizeCostAcc(mano);
  const c = finalizeCostAcc(mac);
  const p = finalizeCostAcc(prod);
  const tot = combineColumnResults([
    { ...m, missingActivity: !mano.known && mano.missing },
    { ...c, missingActivity: !mac.known && mac.missing },
    { ...p, missingActivity: !prod.known && prod.missing }
  ]);
  let ettari = 0;
  for (const r of list || []) ettari += Number(r.ettari) || 0;
  return {
    costoManodopera: m.value,
    costoMacchine: c.value,
    costoProdotti: p.value,
    totale: tot.value,
    euroHa: euroPerHa(tot.value, ettari),
    partialManodopera: m.partial,
    partialMacchine: c.partial,
    partialProdotti: p.partial,
    partialTotale: tot.partial,
    partialEuroHa: tot.partial && tot.value != null,
    noteParziale: hints.join('; ')
  };
}

/**
 * Totale azienda (include non attribuiti).
 * @param {Array<object>} rows
 */
export function companyTotal(rows) {
  const list = rows || [];
  let ettari = 0;
  let ore = 0;
  for (const r of list) {
    ettari += Number(r.ettari) || 0;
    ore += Number(r.ore) || 0;
  }
  const costs = sumCostsFromRows(list);
  return {
    label: 'Totale azienda',
    ettari: euro(ettari),
    ore: euro(ore) || 0,
    ...costs
  };
}

/**
 * @param {object} input
 */
export function buildEconomiciLines(input = {}) {
  const terreniById = new Map();
  for (const t of input.terreni || []) {
    if (!t || !t.id) continue;
    if (t.clienteId && String(t.clienteId).trim()) continue;
    terreniById.set(String(t.id), t);
  }

  const colturaCtx = input.colturaContext || {};
  const resolve = (terrenoId, dataIso, hints = {}) => {
    if (hints.coltura && String(hints.coltura).trim()) return String(hints.coltura).trim();
    const terreno = terrenoId ? terreniById.get(String(terrenoId)) : null;
    return resolveColturaAtDate({
      dataIso,
      terrenoId,
      explicitColtura: hints.coltura,
      campagnaId: hints.campagnaId,
      campagneSeminativo: colturaCtx.campagneSeminativo,
      campagneOrticole: colturaCtx.campagneOrticole,
      vigneti: colturaCtx.vigneti,
      frutteti: colturaCtx.frutteti,
      terrenoColtura: terreno && terreno.coltura
    });
  };

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
      coltura: resolve(lav.terrenoId, dataIso, lav),
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
      coltura: resolve(att.terrenoId, dataIso, att),
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
    if (!prod) continue;
    const nonAttribuito = !!prod.nonAttribuito || !prod.terrenoId;
    if (nonAttribuito) {
      lines.push({
        terrenoId: TERRENO_NON_ATTRIBUITO_ID,
        terrenoNome: TERRENO_NON_ATTRIBUITO_NOME,
        coltura: (prod.coltura && String(prod.coltura).trim()) || 'Senza coltura',
        nonAttribuito: true,
        ettari: null,
        ore: 0,
        costoManodopera: 0,
        costoMacchine: 0,
        costoProdotti: prod.missingProdotti ? null : (prod.costoProdotti != null ? Number(prod.costoProdotti) : 0),
        missingProdotti: !!prod.missingProdotti,
        notes: prod.notes || []
      });
      continue;
    }
    const terreno = terreniById.get(String(prod.terrenoId));
    if (!terreno) continue;
    const dataIso = prod.dataIso || '';
    lines.push({
      terrenoId: String(prod.terrenoId),
      terrenoNome: terreno.nome || terreno.podere || prod.terrenoId,
      coltura: resolve(prod.terrenoId, dataIso, prod),
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

/**
 * Costo di un’uscita magazzino (non scarico trattamento).
 * @param {object} mov
 * @param {{ prezzoUnitario?: number|null }|null} [prodottoAnag]
 */
export function prodottoCostFromMovimentoUscita(mov, prodottoAnag = null) {
  if (!mov) return { costoProdotti: 0, missingProdotti: false, notes: [] };
  const qty = Number(mov.quantita) || 0;
  if (qty <= 0) return { costoProdotti: 0, missingProdotti: false, notes: [] };

  let prezzo = mov.prezzoUnitario;
  if (prezzo == null || !(Number(prezzo) > 0)) {
    prezzo = prodottoAnag && prodottoAnag.prezzoUnitario;
  }
  if (prezzo == null || !(Number(prezzo) > 0)) {
    return {
      costoProdotti: null,
      missingProdotti: true,
      notes: ['Prezzo prodotto non in anagrafica (uscita magazzino)']
    };
  }
  return {
    costoProdotti: euro(qty * Number(prezzo)),
    missingProdotti: false,
    notes: []
  };
}

/**
 * Filtra uscite da includere nei costi prodotti (esclude scarichi già nel trattamento).
 * @param {Array<object>} movimenti
 * @param {Set<string>|string[]} excludedMovimentoIds
 */
export function filterUsciteMagazzinoPerEconomici(movimenti, excludedMovimentoIds) {
  const excluded = excludedMovimentoIds instanceof Set
    ? excludedMovimentoIds
    : new Set((excludedMovimentoIds || []).map(String));
  return (movimenti || []).filter((m) => {
    if (!m || m.tipo !== 'uscita') return false;
    if (m.origineCarburante) return false;
    if (m.origineTrattamentoId) return false;
    if (excluded.has(String(m.id || ''))) return false;
    return true;
  });
}

/**
 * Somma importi noti delle voci di dettaglio (null / prezzo mancante esclusi dalla somma).
 * @param {Array<{ importo?: number|null, prezzoMancante?: boolean }>} voci
 * @returns {{ value: number|null, partial: boolean, known: number }}
 */
export function sumVociImporti(voci) {
  let sum = 0;
  let known = 0;
  let missing = false;
  for (const v of voci || []) {
    if (!v) continue;
    if (v.prezzoMancante || v.importo == null || Number.isNaN(Number(v.importo))) {
      missing = true;
      continue;
    }
    known += 1;
    sum += Number(v.importo);
  }
  if (known === 0) {
    return { value: missing ? null : 0, partial: false, known: 0 };
  }
  return { value: euro(sum), partial: missing, known };
}

/**
 * Filtra voci con gli stessi criteri delle righe aggregate.
 * @param {Array<object>} voci
 * @param {{ terrenoId?: string|null, coltura?: string|null }} [filters]
 */
export function filterEconomiciVoci(voci, filters = {}) {
  const wantTerreno = filters.terrenoId ? String(filters.terrenoId) : null;
  const wantColtura = filters.coltura != null && String(filters.coltura).trim() !== ''
    ? String(filters.coltura).trim().toLowerCase()
    : null;
  return (voci || []).filter((v) => {
    if (!v) return false;
    const nonAttribuito = !!v.nonAttribuito || String(v.terrenoId || '') === TERRENO_NON_ATTRIBUITO_ID;
    const terrenoId = nonAttribuito ? TERRENO_NON_ATTRIBUITO_ID : String(v.terrenoId || '');
    if (!terrenoId) return false;
    if (wantTerreno && terrenoId !== wantTerreno) return false;
    const coltura = (v.coltura && String(v.coltura).trim()) || 'Senza coltura';
    if (wantColtura && coltura.toLowerCase() !== wantColtura) return false;
    return true;
  });
}

/**
 * Voci che compongono una riga (o una colonna di costo della riga).
 * @param {Array<object>} voci
 * @param {{ terrenoId: string, coltura: string }} row
 * @param {'manodopera'|'macchine'|'prodotti'|null} [categoria]
 */
export function vociForRow(voci, row, categoria = null) {
  if (!row) return [];
  const tid = String(row.terrenoId || '');
  const col = ((row.coltura && String(row.coltura).trim()) || 'Senza coltura').toLowerCase();
  const cat = categoria ? String(categoria).toLowerCase() : null;
  return (voci || []).filter((v) => {
    if (!v) return false;
    const nonAttribuito = !!v.nonAttribuito || String(v.terrenoId || '') === TERRENO_NON_ATTRIBUITO_ID;
    const vTid = nonAttribuito ? TERRENO_NON_ATTRIBUITO_ID : String(v.terrenoId || '');
    if (vTid !== tid) return false;
    const vCol = ((v.coltura && String(v.coltura).trim()) || 'Senza coltura').toLowerCase();
    if (vCol !== col) return false;
    if (cat && String(v.categoria || '').toLowerCase() !== cat) return false;
    return true;
  });
}

/**
 * Dettaglio prodotti da un trattamento (una voce per prodotto, o una aggregata).
 * @param {object} row
 * @returns {Array<{ descrizione: string, importo: number|null, prezzoMancante: boolean, quantita?: number|null, unita?: string|null }>}
 */
export function prodottoVociFromTrattamento(row) {
  if (!row) return [];
  const prodotti = Array.isArray(row.prodotti) ? row.prodotti : [];
  const costoEsplicito = row.costoProdotto != null ? Number(row.costoProdotto) : null;
  const tipo = (row.tipoTrattamento || row.tipoLavoro || 'Trattamento').toString().trim() || 'Trattamento';

  if (prodotti.length > 0) {
    const voci = [];
    let sommaRighe = 0;
    let anyQty = false;
    let anyMissing = false;
    for (const p of prodotti) {
      if (!p) continue;
      const nome = (p.prodotto && String(p.prodotto).trim()) || 'Prodotto';
      const qty = Number(p.quantita != null ? p.quantita : p.dosaggio);
      const hasQty = !Number.isNaN(qty) && qty > 0;
      if (hasQty) anyQty = true;
      const costo = p.costo != null ? Number(p.costo) : null;
      if (costo != null && !Number.isNaN(costo) && costo > 0) {
        sommaRighe += costo;
        voci.push({
          descrizione: `${tipo}: ${nome}${hasQty ? ` × ${qty}${p.unitaDosaggio ? ` ${p.unitaDosaggio}` : ''}` : ''}`,
          importo: euro(costo),
          prezzoMancante: false,
          quantita: hasQty ? qty : null,
          unita: p.unitaDosaggio || null
        });
      } else if (hasQty || nome) {
        anyMissing = true;
        voci.push({
          descrizione: `${tipo}: ${nome}${hasQty ? ` × ${qty}${p.unitaDosaggio ? ` ${p.unitaDosaggio}` : ''}` : ''}`,
          importo: null,
          prezzoMancante: true,
          quantita: hasQty ? qty : null,
          unita: p.unitaDosaggio || null
        });
      }
    }
    if (voci.length) {
      // Se c’è un costo esplicito sul doc e le righe non lo spiegano, tieni le voci riga
      // (regola aggregato invariata: costo esplicito vince sul totale riga).
      if (costoEsplicito != null && !Number.isNaN(costoEsplicito) && costoEsplicito > 0
        && Math.abs(costoEsplicito - sommaRighe) > 0.02 && !anyMissing) {
        return [{
          descrizione: `${tipo} (costo registrato)`,
          importo: euro(costoEsplicito),
          prezzoMancante: false
        }];
      }
      return voci;
    }
  }

  const agg = prodottoCostFromTrattamento(row);
  if ((agg.costoProdotti == null || agg.costoProdotti === 0) && !agg.missingProdotti) return [];
  return [{
    descrizione: tipo,
    importo: agg.missingProdotti ? null : agg.costoProdotti,
    prezzoMancante: !!agg.missingProdotti
  }];
}

/**
 * Costruisce le voci di dettaglio (stessa attribuzione terreno×coltura delle lines).
 * @param {object} input
 * @returns {Array<object>}
 */
export function buildEconomiciVoci(input = {}) {
  const terreniById = new Map();
  for (const t of input.terreni || []) {
    if (!t || !t.id) continue;
    if (t.clienteId && String(t.clienteId).trim()) continue;
    terreniById.set(String(t.id), t);
  }
  const colturaCtx = input.colturaContext || {};
  const resolve = (terrenoId, dataIso, hints = {}) => {
    if (hints.coltura && String(hints.coltura).trim()) return String(hints.coltura).trim();
    const terreno = terrenoId ? terreniById.get(String(terrenoId)) : null;
    return resolveColturaAtDate({
      dataIso,
      terrenoId,
      explicitColtura: hints.coltura,
      campagnaId: hints.campagnaId,
      campagneSeminativo: colturaCtx.campagneSeminativo,
      campagneOrticole: colturaCtx.campagneOrticole,
      vigneti: colturaCtx.vigneti,
      frutteti: colturaCtx.frutteti,
      terrenoColtura: terreno && terreno.coltura
    });
  };

  const chiaviLavoro = new Set();
  /** @type {Array<object>} */
  const voci = [];

  const pushVoce = (base) => {
    if (!base) return;
    voci.push({
      terrenoId: base.terrenoId,
      terrenoNome: base.terrenoNome,
      coltura: base.coltura,
      nonAttribuito: !!base.nonAttribuito,
      dataIso: base.dataIso || '',
      origine: base.origine,
      categoria: base.categoria,
      descrizione: base.descrizione || '',
      importo: base.prezzoMancante ? null : (base.importo != null ? euro(base.importo) : 0),
      prezzoMancante: !!base.prezzoMancante,
      sourceId: base.sourceId || null
    });
  };

  for (const lav of input.lavoriCosti || []) {
    if (!lav || !lav.terrenoId) continue;
    const terreno = terreniById.get(String(lav.terrenoId));
    if (!terreno) continue;
    const dataIso = lav.dataIso || '';
    const tipo = lav.tipoLavoro || 'Lavoro';
    chiaviLavoro.add(chiaveLavoroDiario(lav.terrenoId, dataIso, tipo));
    const coltura = resolve(lav.terrenoId, dataIso, lav);
    const terrenoNome = terreno.nome || terreno.podere || lav.terrenoId;
    const detail = Array.isArray(lav.voci) ? lav.voci : [];
    if (detail.length) {
      for (const d of detail) {
        pushVoce({
          terrenoId: String(lav.terrenoId),
          terrenoNome,
          coltura,
          dataIso: d.dataIso || dataIso,
          origine: d.origine || 'lavoro',
          categoria: d.categoria,
          descrizione: d.descrizione || tipo,
          importo: d.importo,
          prezzoMancante: !!d.prezzoMancante,
          sourceId: lav.id || null
        });
      }
    } else {
      if ((lav.costoManodopera != null && lav.costoManodopera !== 0) || lav.missingManodopera) {
        pushVoce({
          terrenoId: String(lav.terrenoId),
          terrenoNome,
          coltura,
          dataIso,
          origine: 'lavoro',
          categoria: 'manodopera',
          descrizione: tipo,
          importo: lav.missingManodopera ? null : lav.costoManodopera,
          prezzoMancante: !!lav.missingManodopera,
          sourceId: lav.id || null
        });
      }
      if ((lav.costoMacchine != null && lav.costoMacchine !== 0) || lav.missingMacchine) {
        pushVoce({
          terrenoId: String(lav.terrenoId),
          terrenoNome,
          coltura,
          dataIso,
          origine: 'lavoro',
          categoria: 'macchine',
          descrizione: tipo,
          importo: lav.missingMacchine ? null : lav.costoMacchine,
          prezzoMancante: !!lav.missingMacchine,
          sourceId: lav.id || null
        });
      }
    }
  }

  for (const att of input.attivitaCosti || []) {
    if (!att || !att.terrenoId) continue;
    if (att.lavoroId || att.clienteId) continue;
    const terreno = terreniById.get(String(att.terrenoId));
    if (!terreno) continue;
    const dataIso = att.dataIso || '';
    const tipo = att.tipoLavoro || 'Diario';
    if (chiaviLavoro.has(chiaveLavoroDiario(att.terrenoId, dataIso, tipo))) continue;
    const coltura = resolve(att.terrenoId, dataIso, att);
    const terrenoNome = terreno.nome || terreno.podere || att.terrenoId;
    const detail = Array.isArray(att.voci) ? att.voci : [];
    if (detail.length) {
      for (const d of detail) {
        pushVoce({
          terrenoId: String(att.terrenoId),
          terrenoNome,
          coltura,
          dataIso: d.dataIso || dataIso,
          origine: d.origine || 'diario',
          categoria: d.categoria,
          descrizione: d.descrizione || tipo,
          importo: d.importo,
          prezzoMancante: !!d.prezzoMancante,
          sourceId: att.id || null
        });
      }
    } else {
      if ((att.costoManodopera != null && att.costoManodopera !== 0) || att.missingManodopera) {
        pushVoce({
          terrenoId: String(att.terrenoId),
          terrenoNome,
          coltura,
          dataIso,
          origine: 'diario',
          categoria: 'manodopera',
          descrizione: tipo,
          importo: att.missingManodopera ? null : att.costoManodopera,
          prezzoMancante: !!att.missingManodopera,
          sourceId: att.id || null
        });
      }
      if ((att.costoMacchine != null && att.costoMacchine !== 0) || att.missingMacchine) {
        pushVoce({
          terrenoId: String(att.terrenoId),
          terrenoNome,
          coltura,
          dataIso,
          origine: 'diario',
          categoria: 'macchine',
          descrizione: tipo,
          importo: att.missingMacchine ? null : att.costoMacchine,
          prezzoMancante: !!att.missingMacchine,
          sourceId: att.id || null
        });
      }
    }
  }

  for (const prod of input.prodottiCosti || []) {
    if (!prod) continue;
    const detail = Array.isArray(prod.voci) && prod.voci.length
      ? prod.voci
      : [{
        descrizione: prod.descrizione || 'Prodotto',
        importo: prod.missingProdotti ? null : prod.costoProdotti,
        prezzoMancante: !!prod.missingProdotti,
        origine: prod.origine || 'trattamento'
      }];
    const nonAttribuito = !!prod.nonAttribuito || !prod.terrenoId;
    if (nonAttribuito) {
      for (const d of detail) {
        pushVoce({
          terrenoId: TERRENO_NON_ATTRIBUITO_ID,
          terrenoNome: TERRENO_NON_ATTRIBUITO_NOME,
          coltura: (prod.coltura && String(prod.coltura).trim()) || 'Senza coltura',
          nonAttribuito: true,
          dataIso: prod.dataIso || d.dataIso || '',
          origine: d.origine || prod.origine || 'uscita_magazzino',
          categoria: 'prodotti',
          descrizione: d.descrizione || 'Uscita magazzino',
          importo: d.importo,
          prezzoMancante: !!d.prezzoMancante,
          sourceId: prod.id || null
        });
      }
      continue;
    }
    const terreno = terreniById.get(String(prod.terrenoId));
    if (!terreno) continue;
    const dataIso = prod.dataIso || '';
    const coltura = resolve(prod.terrenoId, dataIso, prod);
    const terrenoNome = terreno.nome || terreno.podere || prod.terrenoId;
    for (const d of detail) {
      pushVoce({
        terrenoId: String(prod.terrenoId),
        terrenoNome,
        coltura,
        dataIso: d.dataIso || dataIso,
        origine: d.origine || prod.origine || 'trattamento',
        categoria: 'prodotti',
        descrizione: d.descrizione || 'Prodotto',
        importo: d.importo,
        prezzoMancante: !!d.prezzoMancante,
        sourceId: prod.id || null
      });
    }
  }

  voci.sort((a, b) => {
    const da = String(a.dataIso || '');
    const db = String(b.dataIso || '');
    if (da !== db) return da < db ? -1 : 1;
    return String(a.descrizione || '').localeCompare(String(b.descrizione || ''), 'it');
  });
  return voci;
}

/**
 * Assembla report filtrato da lines + voci già costruite (niente I/O).
 * @param {object} input
 * @param {{ terrenoId?: string|null, coltura?: string|null }} [filters]
 */
export function assembleEconomiciReport(input = {}, filters = {}) {
  const lines = input.lines || buildEconomiciLines(input);
  const allVoci = input.voci || buildEconomiciVoci(input);
  const { rows, notes } = aggregateEconomiciRows(lines, filters);
  const voci = filterEconomiciVoci(allVoci, filters);
  return {
    rows,
    byColtura: totalsByColtura(rows),
    totaleAzienda: companyTotal(rows),
    notes,
    voci,
    lines,
    allVoci
  };
}

/**
 * Dati pronti per export Excel: esattamente ciò che è visibile + meta filtri + foglio Voci.
 * @param {object} report - output di assembleEconomiciReport / buildReportEconomici
 * @param {{ periodoLabel?: string, terrenoId?: string|null, terrenoNome?: string|null, coltura?: string|null }} [meta]
 */
export function prepareEconomiciExportData(report, meta = {}) {
  const rows = (report && report.rows) || [];
  const byColtura = (report && report.byColtura) || [];
  const totaleAzienda = report && report.totaleAzienda ? report.totaleAzienda : null;
  const notes = (report && report.notes) || [];
  const voci = (report && report.voci) || [];
  const filtroTerreno = meta.terrenoId
    ? (meta.terrenoNome || meta.terrenoId)
    : 'Tutti';
  const filtroColtura = meta.coltura && String(meta.coltura).trim()
    ? String(meta.coltura).trim()
    : 'Tutte';
  return {
    periodoLabel: meta.periodoLabel || '',
    filtroTerreno,
    filtroColtura,
    dettaglio: rows,
    perColtura: byColtura,
    totaleAzienda: totaleAzienda ? [totaleAzienda] : [],
    noteRows: [
      `Periodo: ${meta.periodoLabel || '—'}`,
      `Filtro terreno: ${filtroTerreno}`,
      `Filtro coltura: ${filtroColtura}`,
      ...notes
    ],
    voci
  };
}
