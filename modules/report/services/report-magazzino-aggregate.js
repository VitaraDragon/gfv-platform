/**
 * Aggregati puri Report Magazzino (per prodotto / categoria / grafici).
 * Nessuna I/O: pensato per unit test.
 *
 * Valore uscite: stesse regole di Economici (`prodottoCostFromMovimentoUscita`).
 * Prezzo mancante → null + badge (mai 0 silenzioso). Totali parziali con *.
 *
 * @module modules/report/services/report-magazzino-aggregate
 */

import {
  dataIsoFromAny,
  euro,
  filterUsciteMagazzinoPerEconomici,
  prodottoCostFromMovimentoUscita,
  sumNullable
} from './report-economici-aggregate.js';
import { CATEGORIE_PRODOTTO } from '../../magazzino/config/categorie-prodotto.js';

/** @typedef {'trattamento'|'carburante'|'manuale'} OrigineUscita */

/**
 * @param {object|null|undefined} mov
 * @returns {OrigineUscita}
 */
export function classifyUscitaOrigine(mov) {
  if (!mov) return 'manuale';
  if (mov.origineTrattamentoId) return 'trattamento';
  if (mov.origineCarburante) return 'carburante';
  return 'manuale';
}

/**
 * @param {OrigineUscita|string} origine
 * @returns {string}
 */
export function labelOrigineUscita(origine) {
  const o = String(origine || '');
  if (o === 'trattamento') return 'Scarico trattamento';
  if (o === 'carburante') return 'Pieno / carico carburante';
  if (o === 'manuale') return 'Uscita manuale';
  return o || '—';
}

/**
 * @param {string|null|undefined} categoriaId
 * @returns {string}
 */
export function labelCategoria(categoriaId) {
  const id = String(categoriaId || '').trim();
  if (!id) return 'Non classificato';
  const found = (CATEGORIE_PRODOTTO || []).find((c) => c && c.id === id);
  return found ? found.nome : id;
}

/**
 * Valore economico di un’uscita (prodotti + carburante), regole Economici.
 * @param {object} mov
 * @param {object|null} [prodottoAnag]
 * @returns {{ valore: number|null, missing: boolean, isCarburante: boolean, notes: string[] }}
 */
export function valoreUscitaFromMovimento(mov, prodottoAnag = null) {
  const priced = prodottoCostFromMovimentoUscita(mov, prodottoAnag);
  const missing = !!(priced.missingProdotti || priced.missingCarburante);
  const isCarb = !!priced.missingCarburante
    || (priced.costoCarburante != null && Number(priced.costoCarburante) > 0
      && !(Number(priced.costoProdotti) > 0));
  if (missing) {
    return {
      valore: null,
      missing: true,
      isCarburante: !!priced.missingCarburante || isCarb,
      notes: priced.notes || []
    };
  }
  const tot = euro((Number(priced.costoProdotti) || 0) + (Number(priced.costoCarburante) || 0));
  return {
    valore: tot,
    missing: false,
    isCarburante: Number(priced.costoCarburante) > 0 && !(Number(priced.costoProdotti) > 0),
    notes: []
  };
}

/**
 * Valore entrata: qty × (prezzo movimento o anagrafica).
 * @param {object} mov
 * @param {object|null} [prodottoAnag]
 * @returns {{ valore: number|null, missing: boolean, prezzoInAttesa: boolean, prezzo: number|null }}
 */
export function valoreEntrataFromMovimento(mov, prodottoAnag = null) {
  const qty = Number(mov && mov.quantita) || 0;
  const prezzoInAttesa = !!(mov && mov.prezzoInAttesa);
  if (qty <= 0) {
    return { valore: 0, missing: false, prezzoInAttesa, prezzo: null };
  }
  let prezzo = mov && mov.prezzoUnitario;
  if (prezzo == null || !(Number(prezzo) > 0)) {
    prezzo = prodottoAnag && prodottoAnag.prezzoUnitario;
  }
  if (prezzo == null || !(Number(prezzo) > 0)) {
    return { valore: null, missing: true, prezzoInAttesa, prezzo: null };
  }
  return {
    valore: euro(qty * Number(prezzo)),
    missing: false,
    prezzoInAttesa,
    prezzo: Number(prezzo)
  };
}

/**
 * Valore giacenza attuale (anagrafica, non storica).
 * @param {object|null} prodotto
 * @returns {{ valore: number|null, missing: boolean, giacenza: number, sottoScorta: boolean, giacenzaNegativa: boolean }}
 */
export function valoreGiacenzaProdotto(prodotto) {
  const giacenza = prodotto && prodotto.giacenza != null ? Number(prodotto.giacenza) : 0;
  const g = Number.isFinite(giacenza) ? giacenza : 0;
  const scorta = prodotto && prodotto.scortaMinima != null ? Number(prodotto.scortaMinima) : 0;
  const sottoScorta = scorta > 0 && g < scorta;
  const giacenzaNegativa = g < 0;
  const prezzo = prodotto && prodotto.prezzoUnitario != null ? Number(prodotto.prezzoUnitario) : null;
  if (prezzo == null || !(prezzo > 0) || Number.isNaN(prezzo)) {
    return {
      valore: null,
      missing: true,
      giacenza: g,
      sottoScorta,
      giacenzaNegativa
    };
  }
  return {
    valore: euro(g * prezzo),
    missing: false,
    giacenza: g,
    sottoScorta,
    giacenzaNegativa
  };
}

/**
 * Totale valore uscite sulle stesse uscite che Economici include.
 * Per test di allineamento (stesso `prodottoCostFromMovimentoUscita`).
 *
 * @param {Array<object>} movimenti
 * @param {Map<string, object>|null} [prodottiById]
 * @param {Set<string>|string[]} [excludedMovimentoIds]
 * @returns {{ value: number|null, partial: boolean }}
 */
export function totaleUsciteComeEconomici(movimenti, prodottiById = null, excludedMovimentoIds = []) {
  const uscite = filterUsciteMagazzinoPerEconomici(movimenti, excludedMovimentoIds);
  const values = uscite.map((mov) => {
    const anag = prodottiById && mov && mov.prodottoId
      ? prodottiById.get(String(mov.prodottoId))
      : null;
    return valoreUscitaFromMovimento(mov, anag).valore;
  });
  return sumNullable(values);
}

/**
 * Arricchisce un movimento con quantità/valore/origine per il report.
 * @param {object} mov
 * @param {Map<string, object>|null} prodottiById
 */
export function enrichMovimento(mov, prodottiById) {
  if (!mov) return null;
  const prodottoId = mov.prodottoId ? String(mov.prodottoId) : null;
  const anag = prodottoId && prodottiById ? prodottiById.get(prodottoId) : null;
  const tipo = String(mov.tipo || '').toLowerCase() === 'uscita' ? 'uscita' : 'entrata';
  const qty = Number(mov.quantita) || 0;
  const dataIso = dataIsoFromAny(mov.data);
  const categoria = (anag && anag.categoria) || mov.categoria || '';
  const nome = (anag && (anag.nome || anag.nomeCommerciale))
    || mov.prodottoNome
    || prodottoId
    || '—';
  const unita = (anag && anag.unitaMisura) || mov.unitaMisura || '';

  if (tipo === 'uscita') {
    const priced = valoreUscitaFromMovimento(mov, anag);
    const origine = classifyUscitaOrigine(mov);
    let prezzo = mov.prezzoUnitario;
    if (prezzo == null || !(Number(prezzo) > 0)) {
      prezzo = anag && anag.prezzoUnitario;
    }
    return {
      id: mov.id ? String(mov.id) : null,
      prodottoId,
      prodottoNome: nome,
      categoria: String(categoria || ''),
      tipo: 'uscita',
      quantita: qty,
      unitaMisura: unita,
      dataIso,
      prezzo: prezzo != null && Number(prezzo) > 0 ? Number(prezzo) : null,
      valore: priced.valore,
      missingPrezzo: priced.missing,
      prezzoInAttesa: !!mov.prezzoInAttesa,
      origineUscita: origine,
      origineCarburante: mov.origineCarburante || null,
      origineTrattamentoId: mov.origineTrattamentoId || null,
      macchinaId: mov.macchinaId ? String(mov.macchinaId) : null,
      lavoroId: mov.lavoroId ? String(mov.lavoroId) : null,
      attivitaId: mov.attivitaId ? String(mov.attivitaId) : null,
      note: mov.note || ''
    };
  }

  const priced = valoreEntrataFromMovimento(mov, anag);
  return {
    id: mov.id ? String(mov.id) : null,
    prodottoId,
    prodottoNome: nome,
    categoria: String(categoria || ''),
    tipo: 'entrata',
    quantita: qty,
    unitaMisura: unita,
    dataIso,
    prezzo: priced.prezzo,
    valore: priced.valore,
    missingPrezzo: priced.missing,
    prezzoInAttesa: priced.prezzoInAttesa,
    origineUscita: null,
    origineCarburante: mov.origineCarburante || null,
    origineTrattamentoId: null,
    macchinaId: mov.macchinaId ? String(mov.macchinaId) : null,
    lavoroId: mov.lavoroId ? String(mov.lavoroId) : null,
    attivitaId: mov.attivitaId ? String(mov.attivitaId) : null,
    note: mov.note || ''
  };
}

/**
 * @param {Array<object>} enriched
 * @param {{ categoria?: string|null, prodottoId?: string|null, tipo?: string|null, origineUscita?: string|null }} [filters]
 */
export function filterEnrichedMovimenti(enriched, filters = {}) {
  const cat = filters.categoria ? String(filters.categoria) : null;
  const pid = filters.prodottoId ? String(filters.prodottoId) : null;
  const tipo = filters.tipo ? String(filters.tipo).toLowerCase() : null;
  const origine = filters.origineUscita ? String(filters.origineUscita) : null;
  return (enriched || []).filter((m) => {
    if (!m) return false;
    if (cat && String(m.categoria || '') !== cat) return false;
    if (pid && String(m.prodottoId || '') !== pid) return false;
    if (tipo && m.tipo !== tipo) return false;
    if (origine) {
      if (m.tipo !== 'uscita') return false;
      if (String(m.origineUscita || '') !== origine) return false;
    }
    return true;
  });
}

/**
 * Aggrega per prodotto.
 * @param {Array<object>} enriched
 * @param {Map<string, object>|null} prodottiById
 */
export function aggregateByProdotto(enriched, prodottiById) {
  /** @type {Map<string, object>} */
  const map = new Map();

  const ensure = (id, nome, categoria, unita) => {
    const key = id || `__nome:${nome}`;
    let row = map.get(key);
    if (!row) {
      const anag = id && prodottiById ? prodottiById.get(String(id)) : null;
      const g = valoreGiacenzaProdotto(anag || {
        giacenza: 0,
        scortaMinima: 0,
        prezzoUnitario: null
      });
      row = {
        prodottoId: id,
        nome: nome || (anag && (anag.nome || anag.nomeCommerciale)) || id || '—',
        categoria: categoria || (anag && anag.categoria) || '',
        unitaMisura: unita || (anag && anag.unitaMisura) || '',
        qtyEntrate: 0,
        qtyUscite: 0,
        valoreEntrate: 0,
        valoreUscite: 0,
        missingEntrate: false,
        missingUscite: false,
        knownEntrate: 0,
        knownUscite: 0,
        nMovimenti: 0,
        prezzoInAttesa: false,
        giacenza: g.giacenza,
        valoreMagazzino: g.valore,
        missingGiacenza: g.missing,
        sottoScorta: g.sottoScorta,
        giacenzaNegativa: g.giacenzaNegativa,
        byOrigine: {
          trattamento: { qty: 0, valore: 0, known: 0, missing: false },
          carburante: { qty: 0, valore: 0, known: 0, missing: false },
          manuale: { qty: 0, valore: 0, known: 0, missing: false }
        }
      };
      map.set(key, row);
    }
    return row;
  };

  for (const m of enriched || []) {
    if (!m) continue;
    const row = ensure(m.prodottoId, m.prodottoNome, m.categoria, m.unitaMisura);
    row.nMovimenti += 1;
    if (m.prezzoInAttesa) row.prezzoInAttesa = true;
    const qty = Number(m.quantita) || 0;
    if (m.tipo === 'entrata') {
      row.qtyEntrate += qty;
      if (m.missingPrezzo || m.valore == null) row.missingEntrate = true;
      else {
        row.valoreEntrate += Number(m.valore) || 0;
        row.knownEntrate += 1;
      }
    } else {
      row.qtyUscite += qty;
      const orig = m.origineUscita || 'manuale';
      const bucket = row.byOrigine[orig] || row.byOrigine.manuale;
      bucket.qty += qty;
      if (m.missingPrezzo || m.valore == null) {
        row.missingUscite = true;
        bucket.missing = true;
      } else {
        row.valoreUscite += Number(m.valore) || 0;
        row.knownUscite += 1;
        bucket.valore += Number(m.valore) || 0;
        bucket.known += 1;
      }
    }
  }

  // Prodotti in anagrafica senza movimenti nel periodo (per giacenza / sotto scorta)
  if (prodottiById) {
    for (const [id, anag] of prodottiById.entries()) {
      if (!anag || anag.attivo === false) continue;
      const key = String(id);
      if (map.has(key)) continue;
      const g = valoreGiacenzaProdotto(anag);
      if (!(g.sottoScorta || g.giacenzaNegativa || (g.giacenza !== 0))) continue;
      map.set(key, {
        prodottoId: key,
        nome: anag.nome || anag.nomeCommerciale || key,
        categoria: anag.categoria || '',
        unitaMisura: anag.unitaMisura || '',
        qtyEntrate: 0,
        qtyUscite: 0,
        valoreEntrate: 0,
        valoreUscite: 0,
        missingEntrate: false,
        missingUscite: false,
        knownEntrate: 0,
        knownUscite: 0,
        nMovimenti: 0,
        prezzoInAttesa: false,
        giacenza: g.giacenza,
        valoreMagazzino: g.valore,
        missingGiacenza: g.missing,
        sottoScorta: g.sottoScorta,
        giacenzaNegativa: g.giacenzaNegativa,
        byOrigine: {
          trattamento: { qty: 0, valore: 0, known: 0, missing: false },
          carburante: { qty: 0, valore: 0, known: 0, missing: false },
          manuale: { qty: 0, valore: 0, known: 0, missing: false }
        }
      });
    }
  }

  return [...map.values()].map((r) => {
    const ent = r.knownEntrate === 0
      ? { value: r.missingEntrate ? null : 0, partial: false }
      : { value: euro(r.valoreEntrate), partial: r.missingEntrate };
    const usc = r.knownUscite === 0
      ? { value: r.missingUscite ? null : 0, partial: false }
      : { value: euro(r.valoreUscite), partial: r.missingUscite };
    return {
      ...r,
      qtyEntrate: euro(r.qtyEntrate) || 0,
      qtyUscite: euro(r.qtyUscite) || 0,
      valoreEntrate: ent.value,
      partialEntrate: ent.partial,
      valoreUscite: usc.value,
      partialUscite: usc.partial,
      byOrigine: {
        trattamento: finalizeOrigine(r.byOrigine.trattamento),
        carburante: finalizeOrigine(r.byOrigine.carburante),
        manuale: finalizeOrigine(r.byOrigine.manuale)
      }
    };
  }).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it'));
}

function finalizeOrigine(b) {
  const known = Number(b.known) || 0;
  const missing = !!b.missing;
  if (known === 0) {
    return {
      qty: euro(b.qty) || 0,
      valore: missing ? null : 0,
      partial: false
    };
  }
  return {
    qty: euro(b.qty) || 0,
    valore: euro(b.valore),
    partial: missing
  };
}

/**
 * @param {Array<object>} byProdotto
 */
export function aggregateByCategoria(byProdotto) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const r of byProdotto || []) {
    if (!r) continue;
    const cat = String(r.categoria || '') || '__none__';
    let row = map.get(cat);
    if (!row) {
      row = {
        categoria: cat === '__none__' ? '' : cat,
        label: labelCategoria(cat === '__none__' ? '' : cat),
        valoreEntrate: 0,
        valoreUscite: 0,
        knownEntrate: 0,
        knownUscite: 0,
        missingEntrate: false,
        missingUscite: false,
        valoreMagazzino: 0,
        knownGiacenza: 0,
        missingGiacenza: false,
        nProdotti: 0,
        sottoScorta: 0
      };
      map.set(cat, row);
    }
    row.nProdotti += 1;
    if (r.sottoScorta) row.sottoScorta += 1;
    if (r.valoreEntrate == null) {
      if (r.partialEntrate || r.qtyEntrate > 0) row.missingEntrate = true;
    } else {
      row.valoreEntrate += Number(r.valoreEntrate) || 0;
      row.knownEntrate += 1;
      if (r.partialEntrate) row.missingEntrate = true;
    }
    if (r.valoreUscite == null) {
      if (r.partialUscite || r.qtyUscite > 0) row.missingUscite = true;
    } else {
      row.valoreUscite += Number(r.valoreUscite) || 0;
      row.knownUscite += 1;
      if (r.partialUscite) row.missingUscite = true;
    }
    if (r.valoreMagazzino == null) {
      if (r.missingGiacenza) row.missingGiacenza = true;
    } else {
      row.valoreMagazzino += Number(r.valoreMagazzino) || 0;
      row.knownGiacenza += 1;
      if (r.missingGiacenza) row.missingGiacenza = true;
    }
  }
  return [...map.values()].map((r) => ({
    categoria: r.categoria,
    label: r.label,
    nProdotti: r.nProdotti,
    sottoScorta: r.sottoScorta,
    valoreEntrate: r.knownEntrate === 0
      ? (r.missingEntrate ? null : 0)
      : euro(r.valoreEntrate),
    partialEntrate: r.knownEntrate > 0 && r.missingEntrate,
    valoreUscite: r.knownUscite === 0
      ? (r.missingUscite ? null : 0)
      : euro(r.valoreUscite),
    partialUscite: r.knownUscite > 0 && r.missingUscite,
    valoreMagazzino: r.knownGiacenza === 0
      ? (r.missingGiacenza ? null : 0)
      : euro(r.valoreMagazzino),
    partialMagazzino: r.knownGiacenza > 0 && r.missingGiacenza
  })).sort((a, b) => (Number(b.valoreUscite) || 0) - (Number(a.valoreUscite) || 0));
}

/**
 * Barre: top N prodotti per valore uscito + Altri.
 * @param {Array<object>} byProdotto
 * @param {number} [topN=8]
 */
export function aggregateProdottiUsciteForChart(byProdotto, topN = 8) {
  const attributed = [...(byProdotto || [])]
    .filter((r) => r && (Number(r.valoreUscite) > 0 || r.partialUscite))
    .map((r) => ({
      prodottoId: r.prodottoId,
      nome: r.nome || r.prodottoId,
      valore: r.valoreUscite == null ? null : Number(r.valoreUscite)
    }))
    .sort((a, b) => (Number(b.valore) || 0) - (Number(a.valore) || 0));

  const n = Math.max(0, topN);
  const top = attributed.slice(0, n);
  const rest = attributed.slice(n);
  const out = top.map((x) => ({
    prodottoId: x.prodottoId,
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
      prodottoId: '__altri__',
      nome: 'Altri',
      valore: altri.missing && !(altri.known > 0) ? null : euro(altri.known)
    });
  }
  return out;
}

const MESI_IT_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/**
 * Mensile entrate vs uscite (valore).
 * @param {Array<object>} enriched
 */
export function aggregateMonthlyEntrateUscite(enriched) {
  /** @type {Map<string, { entrate: number, uscite: number, missingEntrate: boolean, missingUscite: boolean, knownEntrate: number, knownUscite: number }>} */
  const map = new Map();
  for (const m of enriched || []) {
    if (!m) continue;
    const iso = String(m.dataIso || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(iso)) continue;
    let bucket = map.get(iso);
    if (!bucket) {
      bucket = {
        entrate: 0,
        uscite: 0,
        missingEntrate: false,
        missingUscite: false,
        knownEntrate: 0,
        knownUscite: 0
      };
      map.set(iso, bucket);
    }
    if (m.tipo === 'entrata') {
      if (m.missingPrezzo || m.valore == null) bucket.missingEntrate = true;
      else {
        bucket.entrate += Number(m.valore) || 0;
        bucket.knownEntrate += 1;
      }
    } else {
      if (m.missingPrezzo || m.valore == null) bucket.missingUscite = true;
      else {
        bucket.uscite += Number(m.valore) || 0;
        bucket.knownUscite += 1;
      }
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
        entrate: b.knownEntrate === 0 ? (b.missingEntrate ? null : 0) : euro(b.entrate),
        uscite: b.knownUscite === 0 ? (b.missingUscite ? null : 0) : euro(b.uscite),
        partialEntrate: b.knownEntrate > 0 && b.missingEntrate,
        partialUscite: b.knownUscite > 0 && b.missingUscite
      };
    });
}

/**
 * @param {Array<object>} byProdotto
 */
export function buildMagazzinoKpi(byProdotto) {
  let entrate = 0;
  let uscite = 0;
  let magazzino = 0;
  let knownE = 0;
  let knownU = 0;
  let knownG = 0;
  let missE = false;
  let missU = false;
  let missG = false;
  let sottoScorta = 0;
  let nProdotti = 0;

  for (const r of byProdotto || []) {
    if (!r) continue;
    nProdotti += 1;
    if (r.sottoScorta) sottoScorta += 1;
    if (r.valoreEntrate == null) {
      if (r.partialEntrate || r.qtyEntrate > 0) missE = true;
    } else {
      entrate += Number(r.valoreEntrate) || 0;
      knownE += 1;
      if (r.partialEntrate) missE = true;
    }
    if (r.valoreUscite == null) {
      if (r.partialUscite || r.qtyUscite > 0) missU = true;
    } else {
      uscite += Number(r.valoreUscite) || 0;
      knownU += 1;
      if (r.partialUscite) missU = true;
    }
    if (r.valoreMagazzino == null) {
      if (r.missingGiacenza) missG = true;
    } else {
      magazzino += Number(r.valoreMagazzino) || 0;
      knownG += 1;
      if (r.missingGiacenza) missG = true;
    }
  }

  return {
    valoreEntrate: knownE === 0 ? (missE ? null : 0) : euro(entrate),
    partialEntrate: knownE > 0 && missE,
    valoreUscite: knownU === 0 ? (missU ? null : 0) : euro(uscite),
    partialUscite: knownU > 0 && missU,
    valoreMagazzino: knownG === 0 ? (missG ? null : 0) : euro(magazzino),
    partialMagazzino: knownG > 0 && missG,
    prodottiSottoScorta: sottoScorta,
    nProdotti
  };
}

/**
 * @param {Array<object>} enriched
 * @param {string} prodottoId
 */
export function buildProdottoDetailRows(enriched, prodottoId) {
  const id = String(prodottoId || '');
  return (enriched || [])
    .filter((m) => m && String(m.prodottoId || '') === id)
    .slice()
    .sort((a, b) => String(b.dataIso || '').localeCompare(String(a.dataIso || '')))
    .map((m) => ({
      dataIso: m.dataIso || null,
      tipo: m.tipo,
      quantita: m.quantita,
      unitaMisura: m.unitaMisura || '',
      prezzo: m.prezzo,
      valore: m.valore,
      missingPrezzo: !!m.missingPrezzo,
      prezzoInAttesa: !!m.prezzoInAttesa,
      origineUscita: m.origineUscita,
      origineLabel: m.tipo === 'uscita' ? labelOrigineUscita(m.origineUscita) : (m.origineCarburante === 'carico_cisterna' ? 'Carico cisterna' : 'Entrata'),
      macchinaId: m.macchinaId,
      lavoroId: m.lavoroId,
      attivitaId: m.attivitaId,
      origineTrattamentoId: m.origineTrattamentoId,
      note: m.note || ''
    }));
}

/**
 * @param {{ byProdotto: Array<object>, kpi: object, movimenti: Array<object>, notes?: string[] }} data
 */
export function prepareMagazzinoExportData(data) {
  const kpi = data.kpi || {};
  const byProdotto = data.byProdotto || [];
  const movimenti = data.movimenti || [];
  const notes = data.notes || [];
  return {
    kpi: {
      valoreEntrate: kpi.valoreEntrate,
      valoreUscite: kpi.valoreUscite,
      valoreMagazzino: kpi.valoreMagazzino,
      prodottiSottoScorta: kpi.prodottiSottoScorta,
      nProdotti: kpi.nProdotti
    },
    perProdotto: byProdotto.map((r) => ({
      nome: r.nome,
      categoria: labelCategoria(r.categoria),
      qtyEntrate: r.qtyEntrate,
      valoreEntrate: r.valoreEntrate,
      qtyUscite: r.qtyUscite,
      valoreUscite: r.valoreUscite,
      giacenza: r.giacenza,
      valoreMagazzino: r.valoreMagazzino,
      sottoScorta: !!r.sottoScorta,
      giacenzaNegativa: !!r.giacenzaNegativa,
      prezzoInAttesa: !!r.prezzoInAttesa
    })),
    movimenti: movimenti.map((m) => ({
      data: m.dataIso,
      prodotto: m.prodottoNome,
      categoria: labelCategoria(m.categoria),
      tipo: m.tipo,
      quantita: m.quantita,
      unita: m.unitaMisura,
      prezzo: m.prezzo,
      valore: m.valore,
      origine: m.tipo === 'uscita' ? labelOrigineUscita(m.origineUscita) : '',
      lavoroId: m.lavoroId || '',
      macchinaId: m.macchinaId || '',
      prezzoInAttesa: !!m.prezzoInAttesa,
      prezzoMancante: !!m.missingPrezzo
    })),
    notes
  };
}

/**
 * Assembla il report completo da movimenti + anagrafica.
 * @param {{ movimenti: Array<object>, prodotti: Array<object> }} input
 * @param {{ categoria?: string|null, prodottoId?: string|null, tipo?: string|null, origineUscita?: string|null }} [filters]
 */
export function assembleMagazzinoReport(input, filters = {}) {
  const prodotti = input.prodotti || [];
  const prodottiById = new Map(
    prodotti.filter((p) => p && p.id).map((p) => [String(p.id), p])
  );
  const enrichedAll = (input.movimenti || [])
    .map((m) => enrichMovimento(m, prodottiById))
    .filter(Boolean);
  const enriched = filterEnrichedMovimenti(enrichedAll, filters);
  const hasLocalFilter = !!(filters.prodottoId || filters.categoria || filters.tipo || filters.origineUscita);
  // Senza filtri: include anche prodotti sotto scorta / giacenza senza movimenti nel periodo.
  const byProdotto = aggregateByProdotto(enriched, hasLocalFilter ? null : prodottiById);
  // Con filtri: ricalcola giacenza dai prodotti presenti nei movimenti filtrati.
  let rows = byProdotto;
  if (hasLocalFilter) {
    rows = byProdotto
      .filter((r) => r.nMovimenti > 0)
      .map((r) => {
        const anag = r.prodottoId ? prodottiById.get(String(r.prodottoId)) : null;
        if (!anag) return r;
        const g = valoreGiacenzaProdotto(anag);
        return {
          ...r,
          giacenza: g.giacenza,
          valoreMagazzino: g.valore,
          missingGiacenza: g.missing,
          sottoScorta: g.sottoScorta,
          giacenzaNegativa: g.giacenzaNegativa
        };
      });
    if (filters.categoria) {
      rows = rows.filter((r) => String(r.categoria || '') === String(filters.categoria));
    }
    if (filters.prodottoId) {
      rows = rows.filter((r) => String(r.prodottoId || '') === String(filters.prodottoId));
    }
  }
  const byCategoria = aggregateByCategoria(rows);
  const kpi = buildMagazzinoKpi(rows);
  const chartUsciteCategoria = byCategoria
    .filter((c) => c.valoreUscite != null && Number(c.valoreUscite) > 0)
    .map((c) => ({
      categoria: c.categoria,
      label: c.label,
      valore: c.valoreUscite
    }));
  const chartTopProdotti = aggregateProdottiUsciteForChart(rows, 8);
  const chartMensile = aggregateMonthlyEntrateUscite(enriched);

  /** @type {string[]} */
  const notes = [];
  if (kpi.partialEntrate || kpi.valoreEntrate == null) {
    notes.push('Alcune entrate non hanno prezzo (mostrate come —; totali con * se parziali).');
  }
  if (kpi.partialUscite || kpi.valoreUscite == null) {
    notes.push('Alcune uscite non hanno prezzo in movimento né in anagrafica.');
  }
  if (kpi.partialMagazzino || kpi.valoreMagazzino == null) {
    notes.push('Valore di magazzino incompleto: manca il prezzo unitario su alcuni prodotti.');
  }
  const anyPrezzoInAttesa = rows.some((r) => r.prezzoInAttesa);
  if (anyPrezzoInAttesa) {
    notes.push('Ci sono movimenti con «Prezzo in attesa» (bolla senza fattura).');
  }

  const empty = !(enriched.length) && !(rows.some((r) => r.nMovimenti > 0));

  return {
    movimenti: enriched,
    byProdotto: rows,
    byCategoria,
    kpi,
    chartUsciteCategoria,
    chartTopProdotti,
    chartMensile,
    notes,
    empty,
    ready: true,
    prodottiById
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

export function isMagazzinoDataReady(data) {
  return !!(data && data.ready);
}
