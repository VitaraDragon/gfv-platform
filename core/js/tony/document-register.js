/**
 * Registrazione movimenti entrata da bolla e aggiornamento prezzi da fattura (Tony Occhi Fase 2–3).
 * @module core/js/tony/document-register
 */

import { buildProdottoStubFromRiga } from './document-product-match.js';

/**
 * Crea prodotti minimi per righe senza match anagrafica.
 * @param {Array<object>} righe
 * @param {{ createProdotto?: function }} opts
 * @returns {Promise<{ righe: Array<object>, prodottiCreati: Array<{ id: string, nome: string, categoria: string }> }>}
 */
export async function ensureProdottiForRighe(righe, opts) {
  opts = opts || {};
  var list = Array.isArray(righe) ? righe.map(function (r) { return Object.assign({}, r); }) : [];
  var prodottiCreati = [];
  var createProdotto = opts.createProdotto;
  if (typeof createProdotto !== 'function') {
    return { righe: list, prodottiCreati: prodottiCreati };
  }
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    if (r.prodottoIdConfermato || r.prodottoIdSuggerito) continue;
    if (!String(r.descrizione || '').trim()) continue;
    var stub = buildProdottoStubFromRiga(r);
    if (!stub) continue;
    var id = await createProdotto(stub);
    r.prodottoIdConfermato = id;
    r.prodottoIdSuggerito = id;
    r.prodottoCreatoAuto = true;
    prodottiCreati.push({ id: id, nome: stub.nome, categoria: stub.categoria });
  }
  return { righe: list, prodottiCreati: prodottiCreati };
}

function normText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {object} m
 * @returns {boolean}
 */
export function isMovimentoPrezzoInAttesa(m) {
  if (!m) return false;
  // tipo assente: ok (lista già filtrata a entrate); solo escludi uscite esplicite
  if (m.tipo != null && m.tipo !== 'entrata') return false;
  if (m.prezzoInAttesa === true) return true;
  return m.prezzoUnitario == null;
}

/**
 * Anno calendario della data movimento (Date / Timestamp / ISO).
 * @param {object} m
 * @returns {number|null}
 */
export function getMovimentoDataYear(m) {
  if (!m || m.data == null) return null;
  var d = m.data;
  if (typeof d.toDate === 'function') d = d.toDate();
  if (!(d instanceof Date)) d = new Date(d);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear();
}

/**
 * Entrata con prezzo unitario certo (post-fattura / non in attesa).
 * @param {object} m
 * @returns {boolean}
 */
/**
 * Parse prezzo da number o stringa IT ("94,25" / "1.234,56").
 * @param {*} v
 * @returns {number}
 */
export function parsePrezzoUnitarioNum(v) {
  if (v == null || v === '') return NaN;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  var s = String(v).trim().replace(/\s/g, '');
  if (!s) return NaN;
  if (s.indexOf(',') >= 0) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  return Number(s);
}

export function isEntrataConPrezzoCerto(m) {
  if (!m) return false;
  if (m.tipo != null && m.tipo !== 'entrata') return false;
  var p = parsePrezzoUnitarioNum(m.prezzoUnitario);
  var q = Number(m.quantita);
  // Prezzo numerico valido = certo (anche se prezzoInAttesa è rimasto true per errore)
  return Number.isFinite(p) && p > 0 && Number.isFinite(q) && q > 0;
}

/**
 * Media ponderata prezzo×qty sulle entrate con prezzo certo (opz. filtro anno).
 * @param {Array<object>} movimenti
 * @param {{ anno?: number|null }} [opts]
 * @returns {{ prezzoMedio: number, totaleQuantita: number, nEntrate: number, anno: number|null }|null}
 */
export function computePrezzoMedioPonderato(movimenti, opts) {
  opts = opts || {};
  var anno = opts.anno != null && opts.anno !== '' ? Number(opts.anno) : null;
  if (anno != null && !Number.isFinite(anno)) anno = null;
  var sumPQ = 0;
  var sumQ = 0;
  var n = 0;
  (movimenti || []).forEach(function (m) {
    if (!isEntrataConPrezzoCerto(m)) return;
    if (anno != null) {
      var y = getMovimentoDataYear(m);
      // Data assente/illeggibile: non escludere (altrimenti media sempre vuota)
      if (y != null && y !== anno) return;
    }
    sumPQ += parsePrezzoUnitarioNum(m.prezzoUnitario) * Number(m.quantita);
    sumQ += Number(m.quantita);
    n += 1;
  });
  if (!(sumQ > 0) || n === 0) return null;
  return {
    prezzoMedio: Math.round((sumPQ / sumQ) * 10000) / 10000,
    totaleQuantita: sumQ,
    nEntrate: n,
    anno: anno,
  };
}

/**
 * Anno da data documento (YYYY-MM-DD o simile); fallback anno corrente.
 * @param {string} dataStr
 * @returns {number}
 */
export function parseAnnoFromDataDocumento(dataStr) {
  var s = String(dataStr || '').trim();
  var m = s.match(/(\d{4})/);
  if (m) {
    var y = parseInt(m[1], 10);
    if (y >= 2000 && y <= 2100) return y;
  }
  return new Date().getFullYear();
}

/**
 * Ricalcola e scrive `prezzoUnitario` anagrafica (media ponderata anno) per i prodotti indicati.
 * Non blocca il flusso chiamante: errori per singolo prodotto → skip + warn.
 * @param {object} params
 * @param {string[]} params.prodottoIds
 * @param {number} [params.anno]
 * @param {function} params.getAllMovimenti - async (opts) => movimenti
 * @param {function} params.updateProdotto - async (id, updates) => void
 * @returns {Promise<{ updated: number, skipped: number }>}
 */
/**
 * Carica entrate per un prodotto con fallback se manca l'indice Firestore.
 * @param {function} getAllMovimenti
 * @param {string} prodottoId
 * @returns {Promise<Array<object>>}
 */
async function loadEntrateForProdottoPrezzoMedio(getAllMovimenti, prodottoId) {
  var movs = [];
  try {
    movs = await getAllMovimenti({
      prodottoId: prodottoId,
      tipo: 'entrata',
      orderDirection: 'desc',
      limit: 500,
    });
  } catch (idxErr) {
    try {
      movs = await getAllMovimenti({
        prodottoId: prodottoId,
        orderDirection: 'desc',
        limit: 500,
      });
      movs = (movs || []).filter(function (m) {
        return !m || m.tipo == null || m.tipo === 'entrata';
      });
    } catch (e2) {
      // Ultimo fallback: ultime entrate tenant, filtro in memoria
      movs = await getAllMovimenti({
        tipo: 'entrata',
        orderDirection: 'desc',
        limit: 400,
      });
      movs = (movs || []).filter(function (m) {
        return m && m.prodottoId === prodottoId;
      });
    }
  }
  return movs || [];
}

export async function refreshPrezzoMedioAnagraficaProdotti(params) {
  params = params || {};
  var ids = [];
  var seen = {};
  (Array.isArray(params.prodottoIds) ? params.prodottoIds : []).forEach(function (id) {
    if (!id || seen[id]) return;
    seen[id] = true;
    ids.push(id);
  });
  var getAllMovimenti = params.getAllMovimenti;
  var updateProdotto = params.updateProdotto;
  if (!ids.length || typeof getAllMovimenti !== 'function' || typeof updateProdotto !== 'function') {
    return { updated: 0, skipped: ids.length };
  }
  var anno = params.anno != null ? Number(params.anno) : new Date().getFullYear();
  if (!Number.isFinite(anno)) anno = new Date().getFullYear();
  var seedByProd = {};
  (Array.isArray(params.seedMovimenti) ? params.seedMovimenti : []).forEach(function (m) {
    if (!m || !m.prodottoId) return;
    if (!seedByProd[m.prodottoId]) seedByProd[m.prodottoId] = [];
    seedByProd[m.prodottoId].push(m);
  });
  var updated = 0;
  var skipped = 0;
  for (var i = 0; i < ids.length; i++) {
    var pid = ids[i];
    try {
      var movs = await loadEntrateForProdottoPrezzoMedio(getAllMovimenti, pid);
      var seeds = seedByProd[pid] || [];
      var calc = computePrezzoMedioPonderato(movs, { anno: anno });
      // Fallback: tutte le entrate con prezzo (anno diverso / data assente)
      if (!calc) calc = computePrezzoMedioPonderato(movs, { anno: null });
      // Fallback: prezzi appena confermati sulla fattura (se query non li vede ancora)
      if (!calc && seeds.length) {
        calc = computePrezzoMedioPonderato(seeds, { anno: null });
        if (calc) calc = Object.assign({}, calc, { anno: anno });
      }
      if (!calc) {
        console.warn('[Tony Occhi] prezzo medio: nessuna entrata con prezzo per', pid);
        skipped += 1;
        continue;
      }
      var annoScrivi = calc.anno != null ? calc.anno : anno;
      await updateProdotto(pid, {
        prezzoUnitario: calc.prezzoMedio,
        prezzoMedioAnno: annoScrivi,
        prezzoMedioN: calc.nEntrate,
        prezzoMedioAggiornatoAt: new Date().toISOString(),
      });
      updated += 1;
    } catch (e) {
      console.warn('[Tony Occhi] prezzo medio anagrafica:', pid, e && e.message ? e.message : e);
      skipped += 1;
    }
  }
  return { updated: updated, skipped: skipped };
}

/**
 * @param {Array<object>} righe
 * @param {string[]} [movimentoIds]
 * @param {function} [getMovimento]
 * @returns {Promise<string[]>}
 */
async function collectProdottoIdsForPrezzoMedio(righe, movimentoIds, getMovimento) {
  var seen = {};
  var ids = [];
  function add(pid) {
    if (!pid || seen[pid]) return;
    seen[pid] = true;
    ids.push(pid);
  }
  (Array.isArray(righe) ? righe : []).forEach(function (r) {
    add(r && (r.prodottoIdConfermato || r.prodottoIdSuggerito));
  });
  if (typeof getMovimento === 'function' && Array.isArray(movimentoIds)) {
    for (var i = 0; i < movimentoIds.length; i++) {
      try {
        var m = await getMovimento(movimentoIds[i]);
        if (m && m.prodottoId) add(m.prodottoId);
      } catch (_) { /* ignore */ }
    }
  }
  return ids;
}

/**
 * @param {object} params - deps register (getAllMovimenti, updateProdotto, getMovimento)
 * @param {object} estrazione
 * @param {Array<object>} righe
 * @param {string[]} movimentoIds
 */
/**
 * Movimenti “sintetici” dalle righe fattura (prezzo già confermato nel form).
 * @param {object} estrazione
 * @param {Array<object>} righe
 * @returns {Array<object>}
 */
function seedMovimentiFromFatturaRighe(estrazione, righe) {
  var dataMov = null;
  try {
    dataMov = parseDataDocumento(estrazione && estrazione.dataDocumento);
  } catch (_) {
    dataMov = new Date();
  }
  var out = [];
  (Array.isArray(righe) ? righe : []).forEach(function (r) {
    if (!r) return;
    var pid = r.prodottoIdConfermato || r.prodottoIdSuggerito || '';
    var p = Number(r.prezzoUnitario);
    var q = Number(r.quantita);
    if (!pid || !Number.isFinite(p) || p <= 0 || !Number.isFinite(q) || q <= 0) return;
    out.push({
      tipo: 'entrata',
      prodottoId: pid,
      prezzoUnitario: p,
      quantita: q,
      prezzoInAttesa: false,
      data: dataMov,
    });
  });
  return out;
}

async function maybeRefreshPrezzoMedioAfterFattura(params, estrazione, righe, movimentoIds) {
  if (!params || typeof params.updateProdotto !== 'function' || typeof params.getAllMovimenti !== 'function') {
    console.warn('[Tony Occhi] prezzo medio: deps mancanti (updateProdotto/getAllMovimenti)');
    return null;
  }
  try {
    var prodottoIds = await collectProdottoIdsForPrezzoMedio(righe, movimentoIds, params.getMovimento);
    var seeds = seedMovimentiFromFatturaRighe(estrazione, righe);
    seeds.forEach(function (m) {
      if (m.prodottoId && prodottoIds.indexOf(m.prodottoId) < 0) prodottoIds.push(m.prodottoId);
    });
    if (!prodottoIds.length) {
      console.warn('[Tony Occhi] prezzo medio: nessun prodottoId dalle righe/movimenti');
      return { updated: 0, skipped: 0 };
    }
    var res = await refreshPrezzoMedioAnagraficaProdotti({
      prodottoIds: prodottoIds,
      anno: parseAnnoFromDataDocumento(estrazione && estrazione.dataDocumento),
      seedMovimenti: seeds,
      getAllMovimenti: params.getAllMovimenti,
      updateProdotto: params.updateProdotto,
    });
    console.info('[Tony Occhi] prezzo medio anagrafica:', res);
    return res;
  } catch (e) {
    console.warn('[Tony Occhi] refresh prezzo medio anagrafica:', e && e.message ? e.message : e);
    return null;
  }
}

/**
 * Match fornitore tollerante (es. "Francesconi sas" vs "Francesconi s.a.s.").
 * @param {string} fornitoreNome
 * @param {string} note
 * @returns {boolean}
 */
export function fornitoreNomeMatchesNote(fornitoreNome, note) {
  var fn = normText(fornitoreNome);
  if (!fn) return true;
  var nn = normText(note);
  if (!nn) return false;
  if (nn.indexOf(fn) >= 0) return true;
  var fnCompact = fn.replace(/\s+/g, '');
  var nnCompact = nn.replace(/\s+/g, '');
  if (fnCompact.length >= 5 && nnCompact.indexOf(fnCompact) >= 0) return true;
  var parts = fn.split(' ').filter(function (w) { return w.length >= 5; });
  if (parts.length && parts.every(function (w) { return nn.indexOf(w) >= 0; })) return true;
  if (parts.length === 1 && nn.indexOf(parts[0]) >= 0) return true;
  return false;
}

/**
 * @param {Array<object>} movimenti
 * @param {object} [opts]
 * @param {string} [opts.documentoBollaSessionId]
 * @param {string} [opts.fornitoreNome]
 * @returns {Array<object>}
 */
export function filterMovimentiCandidatiFattura(movimenti, opts) {
  opts = opts || {};
  var list = (movimenti || []).filter(isMovimentoPrezzoInAttesa);
  if (opts.documentoBollaSessionId) {
    list = list.filter(function (m) {
      return m.documentoAcquisitoId === opts.documentoBollaSessionId;
    });
  }
  var fn = normText(opts.fornitoreNome);
  if (fn) {
    var withForn = list.filter(function (m) {
      return fornitoreNomeMatchesNote(opts.fornitoreNome, m.note || '');
    });
    // Se il filtro fornitore azzera tutto (note senza ragione sociale), non bloccare il match
    if (withForn.length) list = withForn;
  }
  return list;
}

/**
 * @param {Array<object>} movimenti
 * @returns {Array<{ sessionId: string, label: string, count: number }>}
 */
export function groupBolleSessionsFromMovimenti(movimenti) {
  var map = {};
  (movimenti || []).forEach(function (m) {
    if (!isMovimentoPrezzoInAttesa(m)) return;
    var sid = m.documentoAcquisitoId || '';
    var key = sid || '__no_session__';
    if (!map[key]) {
      map[key] = { sessionId: sid, count: 0, noteSample: m.note || '' };
    }
    map[key].count += 1;
  });
  return Object.keys(map).map(function (key) {
    var g = map[key];
    var label;
    if (g.sessionId) {
      var docNum = extractDocNumFromNote(g.noteSample);
      label = docNum
        ? 'Bolla doc ' + docNum + ' · ' + g.sessionId.slice(-8) + ' · ' + g.count + ' entr' + (g.count === 1 ? 'ata' : 'ate')
        : 'Bolla ' + g.sessionId.slice(-8) + ' · ' + g.count + ' entr' + (g.count === 1 ? 'ata' : 'ate');
    } else {
      label = 'Entrate senza sessione · ' + g.count;
    }
    return { sessionId: g.sessionId, label: label, count: g.count };
  });
}

function normDocNumero(s) {
  return normText(String(s || '')).replace(/\s+/g, '');
}

function extractDocNumFromNote(note) {
  var m = String(note || '').match(/doc\s+([^·]+)/i);
  return m ? String(m[1]).trim() : '';
}

/**
 * Parte numerica principale di un n. documento (es. "1490/00" → "1490").
 * @param {string} s
 * @returns {string}
 */
export function extractDocNumDigitsCore(s) {
  var m = String(s || '').match(/(\d{3,})/);
  return m ? m[1] : '';
}

/**
 * Confronto tollerante numeri DDT (OCR: 1490↔1493, non 1490↔1500).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function docNumsLooselyEqual(a, b) {
  var na = normDocNumero(a);
  var nb = normDocNumero(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.indexOf(nb) >= 0 || nb.indexOf(na) >= 0) return true;
  var da = extractDocNumDigitsCore(a);
  var db = extractDocNumDigitsCore(b);
  if (!da || !db) return false;
  if (da === db) return true;
  // Stessa lunghezza, al più 1 cifra diversa (errori OCR tipici)
  if (da.length === db.length && da.length >= 3) {
    var diff = 0;
    for (var i = 0; i < da.length; i++) {
      if (da[i] !== db[i]) diff += 1;
      if (diff > 1) return false;
    }
    return diff <= 1;
  }
  return false;
}

/**
 * @param {string} note
 * @param {string} docNum
 * @returns {boolean}
 */
export function movimentoNoteContainsDocNum(note, docNum) {
  var n = normDocNumero(docNum);
  if (!n) return false;
  var noteNorm = normText(note);
  if (noteNorm.indexOf('doc ' + n) >= 0) return true;
  var noteCompact = normDocNumero(note);
  if (noteCompact.indexOf('doc' + n) >= 0) return true;
  if (n.length >= 3 && noteCompact.indexOf(n) >= 0) return true;
  // Fuzzy: cifra core del doc cercato vs eventuali numeri in nota (dopo "doc …")
  var core = extractDocNumDigitsCore(docNum);
  if (!core) return false;
  var docInNote = String(note || '').match(/doc\s+([^·]+)/i);
  if (docInNote && docNumsLooselyEqual(docInNote[1], docNum)) return true;
  // Altri numeri lunghi in nota
  var nums = String(note || '').match(/\d{3,}/g) || [];
  for (var i = 0; i < nums.length; i++) {
    if (docNumsLooselyEqual(nums[i], core)) return true;
  }
  return false;
}

/**
 * @param {unknown} raw
 * @returns {Array<{ numeroDocumento: string, dataDocumento: string, fornitore: string }>}
 */
export function normalizeRiferimentiBolla(raw) {
  if (!raw) return [];
  var list = Array.isArray(raw) ? raw : [raw];
  return list
    .map(function (item) {
      if (!item || typeof item !== 'object') {
        if (typeof item === 'string' && item.trim()) {
          return { numeroDocumento: item.trim(), dataDocumento: '', fornitore: '' };
        }
        return null;
      }
      var numero = String(item.numeroDocumento || item.numero || '').trim();
      if (!numero) return null;
      return {
        numeroDocumento: numero,
        dataDocumento: String(item.dataDocumento || item.data || '').trim(),
        fornitore: String(item.fornitore || '').trim(),
      };
    })
    .filter(Boolean);
}

/**
 * @param {object} m
 * @param {{ numeroDocumento?: string, fornitore?: string }} ref
 * @param {string} [fornitoreNome]
 * @returns {boolean}
 */
export function movimentoMatchesRiferimentoBolla(m, ref, fornitoreNome) {
  if (!m || !ref) return false;
  if (!movimentoNoteContainsDocNum(m.note, ref.numeroDocumento)) return false;
  var fn = fornitoreNome || (ref && ref.fornitore) || '';
  if (fn && !fornitoreNomeMatchesNote(fn, m.note || '')) return false;
  return true;
}

/**
 * @param {Array<object>} movimenti
 * @param {{ numeroDocumento?: string, fornitore?: string }} ref
 * @param {string} [fornitoreNome]
 * @returns {Record<string, number>}
 */
export function scoreSessionsForRiferimentoBolla(movimenti, ref, fornitoreNome) {
  var counts = {};
  (movimenti || []).filter(isMovimentoPrezzoInAttesa).forEach(function (m) {
    if (!movimentoMatchesRiferimentoBolla(m, ref, fornitoreNome)) return;
    var sid = m.documentoAcquisitoId || '';
    if (!sid) return;
    counts[sid] = (counts[sid] || 0) + 1;
  });
  return counts;
}

/**
 * Numero DDT/bolla associato a una riga fattura (campo o testo descrizione).
 * @param {object} riga
 * @returns {string}
 */
export function getRigaRiferimentoBollaNumero(riga) {
  if (!riga) return '';
  var rif = riga.riferimentoBolla;
  if (rif && typeof rif === 'object' && rif.numeroDocumento) {
    return String(rif.numeroDocumento).trim();
  }
  if (typeof rif === 'string' && rif.trim()) return rif.trim();
  var desc = String(riga.descrizione || '');
  var m = desc.match(
    /(?:ddt|bolla)\s*(?:num(?:ero)?|n\.?|n°)?\s*[:.]?\s*([0-9]+(?:\s*\/\s*[0-9A-Za-z]+)?)/i
  );
  return m ? String(m[1] || '').replace(/\s+/g, '').trim() : '';
}

/**
 * True se descrizione è solo intestazione gruppo DDT (non merce).
 * @param {string} descrizione
 * @returns {boolean}
 */
export function isDdtHeaderDescrizione(descrizione) {
  var d = String(descrizione || '').trim();
  if (!d) return false;
  if (/^ddt\s*num/i.test(d)) return true;
  if (/^ddt\s*[nN°.]/i.test(d)) return true;
  if (/^documento\s+di\s+trasporto/i.test(d)) return true;
  if (/^bolla\s+(n|num)/i.test(d)) return true;
  if (/^ddt[\s.:/\d]/i.test(d) && !/\b(fung|inse|concim|maschera|spese|olio|rame|zolfo|fertil|seme)/i.test(d)) {
    return true;
  }
  return false;
}

/**
 * Rimuove intestazioni DDT e propaga riferimentoBolla alle righe successive.
 * @param {Array<object>} righe
 * @returns {Array<object>}
 */
export function sanitizeFatturaRighe(righe) {
  var lastRif = null;
  var out = [];
  (righe || []).forEach(function (r) {
    if (!r || typeof r !== 'object') return;
    var descrizione = String(r.descrizione || '').trim();
    if (!descrizione) return;
    if (isDdtHeaderDescrizione(descrizione)) {
      var num = getRigaRiferimentoBollaNumero({ descrizione: descrizione, riferimentoBolla: r.riferimentoBolla });
      if (num) lastRif = { numeroDocumento: num, dataDocumento: '' };
      return;
    }
    var row = Object.assign({}, r, { descrizione: descrizione });
    var numRiga = getRigaRiferimentoBollaNumero(row);
    if (numRiga) {
      row.riferimentoBolla = Object.assign({}, row.riferimentoBolla || {}, { numeroDocumento: numRiga });
      lastRif = row.riferimentoBolla;
    } else if (lastRif && !row.riferimentoBolla) {
      row.riferimentoBolla = Object.assign({}, lastRif);
    }
    out.push(row);
  });
  return out;
}

/**
 * @param {object} estrazione
 * @param {Array<object>} movimenti
 * @returns {{ sessionId: string, matchedRef: object|null, score: number, numeroDocumento: string, sessionIds: string[], multiSession: boolean }}
 */
export function resolveAutoBollaSessionFromEstrazione(estrazione, movimenti) {
  var empty = {
    sessionId: '',
    matchedRef: null,
    score: 0,
    numeroDocumento: '',
    sessionIds: [],
    multiSession: false,
  };
  if (!estrazione) return empty;
  var refs = normalizeRiferimentiBolla(estrazione.riferimentiBolla);
  if (!refs.length && Array.isArray(estrazione.righe)) {
    var fromRows = {};
    estrazione.righe.forEach(function (r) {
      var n = getRigaRiferimentoBollaNumero(r);
      if (n) fromRows[n] = { numeroDocumento: n, dataDocumento: '', fornitore: '' };
    });
    refs = Object.keys(fromRows).map(function (k) { return fromRows[k]; });
  }
  if (!refs.length) return empty;
  var fornitoreNome = estrazione.fornitore && estrazione.fornitore.nome ? estrazione.fornitore.nome : '';
  var sessionBest = {};
  refs.forEach(function (ref) {
    var counts = scoreSessionsForRiferimentoBolla(movimenti, ref, fornitoreNome);
    Object.keys(counts).forEach(function (sid) {
      if (!sessionBest[sid] || counts[sid] > sessionBest[sid].score) {
        sessionBest[sid] = {
          sessionId: sid,
          matchedRef: ref,
          score: counts[sid],
          numeroDocumento: ref.numeroDocumento || '',
        };
      }
    });
  });
  var sids = Object.keys(sessionBest);
  if (!sids.length) return empty;
  if (sids.length > 1) {
    var totalScore = sids.reduce(function (acc, sid) { return acc + sessionBest[sid].score; }, 0);
    return {
      sessionId: '',
      matchedRef: null,
      score: totalScore,
      numeroDocumento: refs.map(function (r) { return r.numeroDocumento; }).filter(Boolean).join(', '),
      sessionIds: sids,
      multiSession: true,
    };
  }
  var only = sessionBest[sids[0]];
  return {
    sessionId: only.sessionId,
    matchedRef: only.matchedRef,
    score: only.score,
    numeroDocumento: only.numeroDocumento,
    sessionIds: [only.sessionId],
    multiSession: false,
  };
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} [tolerance]
 * @returns {boolean}
 */
export function qtyMatch(a, b, tolerance) {
  var tol = tolerance != null ? tolerance : 0.02;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === b) return true;
  var max = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / max <= tol;
}

/**
 * @param {object} riga
 * @param {Array<object>} candidati
 * @param {Set<string>} usedIds
 * @returns {object|null}
 */
export function matchRigaFatturaToMovimento(riga, candidati, usedIds) {
  var pid = riga.prodottoIdConfermato || riga.prodottoIdSuggerito || '';
  var qty = Number(riga.quantita);
  var hasQty = Number.isFinite(qty) && qty > 0;
  var refNum = getRigaRiferimentoBollaNumero(riga);

  function sortByQty(pool) {
    if (!hasQty || !pool.length) return pool;
    return pool.slice().sort(function (a, b) {
      return Math.abs(a.quantita - qty) - Math.abs(b.quantita - qty);
    });
  }

  // 1) DDT + qty (anche senza prodotto) — unico candidato → collega bolla
  if (refNum && hasQty) {
    var byDdtQty = (candidati || []).filter(function (m) {
      if (!m || !m.id || usedIds.has(m.id)) return false;
      if (!movimentoNoteContainsDocNum(m.note, refNum)) return false;
      return qtyMatch(m.quantita, qty);
    });
    if (byDdtQty.length === 1) return byDdtQty[0];
    if (byDdtQty.length > 1 && pid) {
      var byDdtPid = byDdtQty.filter(function (m) { return m.prodottoId === pid; });
      if (byDdtPid.length) return sortByQty(byDdtPid)[0];
    }
    if (byDdtQty.length > 1) return sortByQty(byDdtQty)[0];
  }

  if (!pid) return null;

  function basePool(requireDdt) {
    return (candidati || []).filter(function (m) {
      if (!m || !m.id || usedIds.has(m.id)) return false;
      if (m.prodottoId !== pid) return false;
      if (requireDdt) {
        if (!refNum || !movimentoNoteContainsDocNum(m.note, refNum)) return false;
      }
      if (!hasQty) return true;
      return qtyMatch(m.quantita, qty);
    });
  }

  var pool = refNum ? basePool(true) : [];
  if (!pool.length) pool = basePool(false);
  if (!pool.length) return null;
  return sortByQty(pool)[0];
}

/**
 * @param {Array<object>} righe
 * @param {Array<object>} candidati
 * @returns {Array<{ riga: object, movimento: object|null, movimentoId: string|null }>}
 */
export function matchRigheFatturaToMovimenti(righe, candidati) {
  var used = new Set();
  return (righe || []).map(function (r) {
    var mov = matchRigaFatturaToMovimento(r, candidati, used);
    if (mov && mov.id) used.add(mov.id);
    return { riga: r, movimento: mov, movimentoId: mov ? mov.id : null };
  });
}

/**
 * Somma qty × prezzo delle righe (ignora righe senza prezzo).
 * @param {Array<object>} righe
 * @returns {number|null}
 */
export function sumRigheImportoNetto(righe) {
  var sum = 0;
  var any = false;
  (righe || []).forEach(function (r) {
    if (isDdtHeaderDescrizione(r && r.descrizione)) return;
    var qty = Number(r && r.quantita);
    var prezzo = Number(r && r.prezzoUnitario);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(prezzo)) return;
    sum += qty * prezzo;
    any = true;
  });
  return any ? Math.round(sum * 100) / 100 : null;
}

/**
 * Controlla coerenza Σ righe vs totali.imponibile (warning, non blocco).
 * @param {Array<object>} righe
 * @param {{ imponibile?: number|null }|null} totali
 * @param {number} [toleranceAbs]
 * @returns {{ ok: boolean, sumRighe: number|null, imponibile: number|null, delta: number|null, message: string }}
 */
export function checkRigheVsImponibile(righe, totali, toleranceAbs) {
  var tol = toleranceAbs != null ? toleranceAbs : 1.5;
  var sumRighe = sumRigheImportoNetto(righe);
  var imponibile = totali && totali.imponibile != null ? Number(totali.imponibile) : null;
  if (sumRighe == null || imponibile == null || !Number.isFinite(imponibile)) {
    return { ok: true, sumRighe: sumRighe, imponibile: imponibile, delta: null, message: '' };
  }
  var delta = Math.round((sumRighe - imponibile) * 100) / 100;
  if (Math.abs(delta) <= tol) {
    return { ok: true, sumRighe: sumRighe, imponibile: imponibile, delta: delta, message: '' };
  }
  var msg =
    'Attenzione: somma righe (' +
    sumRighe.toFixed(2).replace('.', ',') +
    ' €) diversa dall\'imponibile (' +
    imponibile.toFixed(2).replace('.', ',') +
    ' €). Possibile riga mancante o prezzo errato — controlla prima di registrare.';
  return { ok: false, sumRighe: sumRighe, imponibile: imponibile, delta: delta, message: msg };
}

/**
 * @param {string} tipo
 * @returns {boolean}
 */
export function isTipoFatturaDiretta(tipo) {
  return String(tipo || '').toLowerCase() === 'scontrino';
}

/**
 * @param {object} riga
 * @param {{ movimentoId?: string|null }} [matchRow]
 * @returns {string}
 */
export function resolveMovimentoIdForRiga(riga, matchRow) {
  var m = matchRow || {};
  return String(riga.movimentoIdConfermato || m.movimentoId || '').trim();
}

/**
 * @param {Array<object>} righe
 * @param {Array<{ movimentoId?: string|null }>} [matches]
 * @returns {{ conBolla: Array<{ riga: object, match: object|null, index: number }>, senzaBolla: Array<{ riga: object, index: number }> }}
 */
export function splitRigheFatturaPerModo(righe, matches) {
  var conBolla = [];
  var senzaBolla = [];
  (righe || []).forEach(function (r, idx) {
    var match = matches && matches[idx] ? matches[idx] : null;
    var movId = resolveMovimentoIdForRiga(r, match);
    if (movId) {
      conBolla.push({ riga: r, match: match, index: idx });
    } else {
      senzaBolla.push({ riga: r, index: idx });
    }
  });
  return { conBolla: conBolla, senzaBolla: senzaBolla };
}

/**
 * @param {Array<object>} righe
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateRigheForFatturaDirettaRegister(righe) {
  var errors = [];
  var list = Array.isArray(righe) ? righe : [];
  if (!list.length) {
    errors.push('Nessuna riga da registrare.');
    return { ok: false, errors: errors };
  }
  var registrabili = 0;
  list.forEach(function (r, idx) {
    var pid = r.prodottoIdConfermato || r.prodottoIdSuggerito || '';
    var qty = Number(r.quantita);
    var prezzo = r.prezzoUnitario != null && r.prezzoUnitario !== '' ? Number(r.prezzoUnitario) : null;
    if (!pid && !String(r.descrizione || '').trim()) {
      errors.push('Riga ' + (idx + 1) + ': inserisci descrizione o seleziona un prodotto GFV.');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push('Riga ' + (idx + 1) + ': quantità non valida.');
      return;
    }
    if (prezzo == null || !Number.isFinite(prezzo) || prezzo <= 0) {
      errors.push('Riga ' + (idx + 1) + ': inserisci un prezzo unitario valido.');
      return;
    }
    registrabili += 1;
  });
  if (registrabili === 0) {
    errors.push('Nessuna riga valida con prodotto/descrizione, quantità e prezzo.');
  }
  return { ok: errors.length === 0, errors: errors };
}

/**
 * Fattura mista: righe con bolla → prezzo su movimento; senza bolla → nuova entrata.
 * @param {Array<object>} righe
 * @param {Array<{ movimentoId?: string|null }>} [matches]
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateRigheForFatturaDocumento(righe, matches) {
  var errors = [];
  var list = Array.isArray(righe) ? righe : [];
  if (!list.length) {
    errors.push('Nessuna riga da registrare.');
    return { ok: false, errors: errors };
  }
  var valid = 0;
  list.forEach(function (r, idx) {
    var pid = r.prodottoIdConfermato || r.prodottoIdSuggerito || '';
    var prezzo = r.prezzoUnitario != null && r.prezzoUnitario !== '' ? Number(r.prezzoUnitario) : null;
    var matchRow = matches && matches[idx] ? matches[idx] : null;
    var movId = resolveMovimentoIdForRiga(r, matchRow);
    if (!pid && !String(r.descrizione || '').trim()) {
      errors.push('Riga ' + (idx + 1) + ': inserisci descrizione o seleziona un prodotto GFV.');
      return;
    }
    if (prezzo == null || !Number.isFinite(prezzo) || prezzo <= 0) {
      errors.push('Riga ' + (idx + 1) + ': inserisci un prezzo unitario valido.');
      return;
    }
    if (movId) {
      valid += 1;
      return;
    }
    var qty = Number(r.quantita);
    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push('Riga ' + (idx + 1) + ': quantità non valida (fattura senza bolla collegata).');
      return;
    }
    valid += 1;
  });
  if (valid === 0) {
    errors.push('Nessuna riga valida da registrare.');
  }
  return { ok: errors.length === 0, errors: errors };
}

/**
 * @param {Array<object>} righe
 * @param {Array<{ movimentoId?: string|null }>} [matches]
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateRigheForFatturaRegister(righe, matches) {
  var errors = [];
  var list = Array.isArray(righe) ? righe : [];
  if (!list.length) {
    errors.push('Nessuna riga da registrare.');
    return { ok: false, errors: errors };
  }
  var aggiornabili = 0;
  list.forEach(function (r, idx) {
    var pid = r.prodottoIdConfermato || r.prodottoIdSuggerito || '';
    var prezzo = r.prezzoUnitario != null && r.prezzoUnitario !== '' ? Number(r.prezzoUnitario) : null;
    var matchRow = matches && matches[idx] ? matches[idx] : null;
    var movId = (r.movimentoIdConfermato || (matchRow && (matchRow.movimentoIdConfermato || matchRow.movimentoId)) || '');
    if (!pid) {
      errors.push('Riga ' + (idx + 1) + ': seleziona un prodotto GFV.');
      return;
    }
    if (prezzo == null || !Number.isFinite(prezzo) || prezzo <= 0) {
      errors.push('Riga ' + (idx + 1) + ': inserisci un prezzo unitario valido.');
      return;
    }
    if (!movId) {
      errors.push('Riga ' + (idx + 1) + ': collega un movimento bolla in attesa di prezzo.');
      return;
    }
    aggiornabili += 1;
  });
  if (aggiornabili === 0) {
    errors.push('Nessuna riga valida con prodotto, prezzo e movimento bolla.');
  }
  return { ok: errors.length === 0, errors: errors };
}

function appendFatturaNota(existingNote, header, riga) {
  var parts = [String(existingNote || '').trim()];
  parts.push('Fattura Tony Occhi');
  if (header.numeroDocumento) parts.push('doc ' + header.numeroDocumento);
  if (header.fornitore && header.fornitore.nome) parts.push(header.fornitore.nome);
  if (riga.descrizione) parts.push(String(riga.descrizione).slice(0, 60));
  return parts.filter(Boolean).join(' · ');
}

/**
 * @param {object} params
 * @param {object} params.estrazione
 * @param {string} params.sessionId
 * @param {Array<{ riga: object, movimento?: object|null, movimentoId?: string|null, movimentoIdConfermato?: string|null }>} params.matches
 * @param {function} params.updateMovimento - async (id, updates) => void
 * @param {function} [params.getMovimento] - async (id) => movimento
 * @returns {Promise<{ movimentoIds: string[], skipped: number, unmatched: number }>}
 */
export async function registerFatturaPrezzi(params) {
  var estrazione = params && params.estrazione ? params.estrazione : {};
  var righe = Array.isArray(estrazione.righe) ? estrazione.righe : [];
  var matches = Array.isArray(params.matches) ? params.matches : matchRigheFatturaToMovimenti(righe, params.movimentiCandidati || []);
  var validation = validateRigheForFatturaRegister(righe, matches);
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }

  var updateMovimento = params.updateMovimento;
  var getMovimento = params.getMovimento;
  if (typeof updateMovimento !== 'function') {
    throw new Error('Servizio movimenti non disponibile.');
  }

  var sessionId = params.sessionId || '';
  var movimentoIds = [];
  var skipped = 0;
  var unmatched = 0;

  for (var i = 0; i < righe.length; i++) {
    var r = righe[i];
    var mrow = matches[i] || {};
    var movId = r.movimentoIdConfermato || mrow.movimentoIdConfermato || mrow.movimentoId || '';
    var prezzo = Number(r.prezzoUnitario);
    if (!movId || !Number.isFinite(prezzo) || prezzo <= 0) {
      skipped += 1;
      if (!movId) unmatched += 1;
      continue;
    }

    var existingNote = '';
    if (typeof getMovimento === 'function') {
      try {
        var existing = await getMovimento(movId);
        if (existing) existingNote = existing.note || '';
      } catch (_) { /* ignore */ }
    } else if (mrow.movimento && mrow.movimento.note) {
      existingNote = mrow.movimento.note;
    }

    await updateMovimento(movId, {
      prezzoUnitario: prezzo,
      prezzoInAttesa: false,
      documentoFatturaId: sessionId || null,
      note: appendFatturaNota(existingNote, estrazione, r),
    });
    movimentoIds.push(movId);
  }

  if (!movimentoIds.length) {
    throw new Error('Nessun movimento aggiornato. Collega ogni riga a una bolla in attesa di prezzo.');
  }
  return { movimentoIds: movimentoIds, skipped: skipped, unmatched: unmatched };
}

/**
 * @param {Array<object>} righe
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateRigheForBollaRegister(righe) {
  var errors = [];
  var list = Array.isArray(righe) ? righe : [];
  if (!list.length) {
    errors.push('Nessuna riga da registrare.');
    return { ok: false, errors: errors };
  }
  var registrabili = 0;
  list.forEach(function (r, idx) {
    var pid = r.prodottoIdConfermato || r.prodottoIdSuggerito || '';
    var qty = Number(r.quantita);
    if (!pid && !String(r.descrizione || '').trim()) {
      errors.push('Riga ' + (idx + 1) + ': inserisci descrizione o seleziona un prodotto GFV.');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push('Riga ' + (idx + 1) + ': quantità non valida.');
      return;
    }
    registrabili += 1;
  });
  if (registrabili === 0) {
    errors.push('Nessuna riga valida con prodotto/descrizione e quantità.');
  }
  return { ok: errors.length === 0, errors: errors };
}

function parseDataDocumento(dataStr) {
  var s = String(dataStr || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    var d = new Date(s + 'T12:00:00');
    if (!isNaN(d.getTime())) return d;
  }
  var m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    var day = parseInt(m[1], 10);
    var month = parseInt(m[2], 10) - 1;
    var year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    var d2 = new Date(year, month, day, 12, 0, 0);
    if (!isNaN(d2.getTime())) return d2;
  }
  return new Date();
}

function buildNotaMovimento(header, riga, tipoLabel) {
  var parts = ['Tony Occhi'];
  if (tipoLabel) parts.push(tipoLabel);
  if (header.numeroDocumento) parts.push('doc ' + header.numeroDocumento);
  if (header.fornitore && header.fornitore.nome) parts.push(header.fornitore.nome);
  if (riga.descrizione) parts.push(String(riga.descrizione).slice(0, 80));
  if (riga.unita) parts.push(riga.unita);
  return parts.join(' · ');
}

/**
 * @param {object} params
 * @param {object} params.estrazione
 * @param {string} params.sessionId
 * @param {string} [params.userId]
 * @param {function} params.createMovimento
 * @returns {Promise<{ movimentoIds: string[], skipped: number }>}
 */
export async function registerFatturaEntrata(params) {
  var estrazione = params && params.estrazione ? params.estrazione : {};
  var righe = Array.isArray(estrazione.righe) ? estrazione.righe : [];
  var ensured = await ensureProdottiForRighe(righe, { createProdotto: params.createProdotto });
  righe = ensured.righe;
  estrazione = Object.assign({}, estrazione, { righe: righe });
  var validation = validateRigheForFatturaDirettaRegister(righe);
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }

  var tipo = String(estrazione.tipoDocumentoConfermato || estrazione.tipoDocumento || 'fattura').toLowerCase();
  var tipoLabel = tipo === 'scontrino' ? 'Scontrino' : 'Fattura diretta';
  var dataMov = parseDataDocumento(estrazione.dataDocumento);
  var sessionId = params.sessionId || '';
  var userId = params.userId || null;
  var createMovimento = params.createMovimento;
  if (typeof createMovimento !== 'function') {
    throw new Error('Servizio movimenti non disponibile.');
  }

  var movimentoIds = [];
  var skipped = 0;
  for (var i = 0; i < righe.length; i++) {
    var r = righe[i];
    var prodottoId = r.prodottoIdConfermato || r.prodottoIdSuggerito || '';
    var qty = Number(r.quantita);
    var prezzo = Number(r.prezzoUnitario);
    if (!prodottoId || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(prezzo) || prezzo <= 0) {
      skipped += 1;
      continue;
    }

    var movId = await createMovimento({
      prodottoId: prodottoId,
      data: dataMov,
      tipo: 'entrata',
      quantita: qty,
      prezzoUnitario: prezzo,
      prezzoInAttesa: false,
      documentoAcquisitoId: sessionId || null,
      documentoFatturaId: sessionId || null,
      note: buildNotaMovimento(estrazione, r, tipoLabel),
      userId: userId,
      confezione: r.confezione || '',
    });
    movimentoIds.push(movId);
  }

  if (!movimentoIds.length) {
    throw new Error('Nessun movimento creato. Controlla prodotto, quantità e prezzo sulle righe.');
  }
  var prezzoMedio = await maybeRefreshPrezzoMedioAfterFattura(params, estrazione, righe, movimentoIds);
  return {
    movimentoIds: movimentoIds,
    skipped: skipped,
    prodottiCreati: ensured.prodottiCreati,
    prezzoMedio: prezzoMedio,
  };
}

/**
 * Fattura: aggiorna prezzi su bolle collegate e crea entrate per righe senza bolla.
 * @param {object} params
 * @returns {Promise<{ movimentoIds: string[], skipped: number, unmatched: number, creati: number, aggiornati: number, prodottiCreati: Array<object> }>}
 */
export async function registerFatturaDocumento(params) {
  var estrazione = params && params.estrazione ? params.estrazione : {};
  var righe = Array.isArray(estrazione.righe) ? estrazione.righe : [];
  var ensuredAll = await ensureProdottiForRighe(righe, { createProdotto: params.createProdotto });
  righe = ensuredAll.righe;
  estrazione = Object.assign({}, estrazione, { righe: righe });
  var prodottiCreati = ensuredAll.prodottiCreati.slice();
  var matches = Array.isArray(params.matches)
    ? params.matches
    : matchRigheFatturaToMovimenti(righe, params.movimentiCandidati || []);
  var validation = validateRigheForFatturaDocumento(righe, matches);
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }

  var split = splitRigheFatturaPerModo(righe, matches);
  var movimentoIds = [];
  var skipped = 0;
  var unmatched = 0;
  var creati = 0;
  var aggiornati = 0;

  if (split.conBolla.length) {
    var righeConBolla = split.conBolla.map(function (x) { return x.riga; });
    var matchesConBolla = split.conBolla.map(function (x) {
      return Object.assign({}, x.match || {}, {
        movimentoId: resolveMovimentoIdForRiga(x.riga, x.match),
      });
    });
    var resPrezzi = await registerFatturaPrezzi({
      estrazione: Object.assign({}, estrazione, { righe: righeConBolla }),
      sessionId: params.sessionId,
      matches: matchesConBolla,
      movimentiCandidati: params.movimentiCandidati,
      updateMovimento: params.updateMovimento,
      getMovimento: params.getMovimento,
    });
    movimentoIds = movimentoIds.concat(resPrezzi.movimentoIds);
    aggiornati = resPrezzi.movimentoIds.length;
    skipped += resPrezzi.skipped;
    unmatched += resPrezzi.unmatched;
  }

  if (split.senzaBolla.length) {
    var righeSenzaBolla = split.senzaBolla.map(function (x) { return x.riga; });
    var resEntrata = await registerFatturaEntrata({
      estrazione: Object.assign({}, estrazione, {
        tipoDocumentoConfermato: 'fattura',
        righe: righeSenzaBolla,
      }),
      sessionId: params.sessionId,
      userId: params.userId,
      createMovimento: params.createMovimento,
    });
    movimentoIds = movimentoIds.concat(resEntrata.movimentoIds);
    creati = resEntrata.movimentoIds.length;
    skipped += resEntrata.skipped;
  }

  if (!movimentoIds.length) {
    throw new Error('Nessun movimento registrato. Controlla prodotto, prezzo e collegamenti bolla.');
  }
  var prezzoMedio = await maybeRefreshPrezzoMedioAfterFattura(params, estrazione, righe, movimentoIds);
  return {
    movimentoIds: movimentoIds,
    skipped: skipped,
    unmatched: unmatched,
    creati: creati,
    aggiornati: aggiornati,
    prodottiCreati: prodottiCreati,
    prezzoMedio: prezzoMedio,
  };
}

/**
 * @param {object} params
 * @param {object} params.estrazione - dati form revisione
 * @param {string} params.sessionId
 * @param {string} [params.userId]
 * @param {function} params.createMovimento - async (data) => id
 * @param {function} [params.createProdotto] - async (data) => id
 * @returns {Promise<{ movimentoIds: string[], skipped: number, prodottiCreati: Array<object> }>}
 */
export async function registerBollaMovimenti(params) {
  var estrazione = params && params.estrazione ? params.estrazione : {};
  var righe = Array.isArray(estrazione.righe) ? estrazione.righe : [];
  var ensured = await ensureProdottiForRighe(righe, { createProdotto: params.createProdotto });
  righe = ensured.righe;
  estrazione = Object.assign({}, estrazione, { righe: righe });
  var validation = validateRigheForBollaRegister(righe);
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }
  var tipo = String(estrazione.tipoDocumentoConfermato || estrazione.tipoDocumento || 'bolla').toLowerCase();
  if (tipo === 'fattura' || tipo === 'scontrino') {
    throw new Error('Per fattura o scontrino usa il tipo documento corrispondente nel form di revisione.');
  }

  var dataMov = parseDataDocumento(estrazione.dataDocumento);
  var sessionId = params.sessionId || '';
  var userId = params.userId || null;
  var createMovimento = params.createMovimento;
  if (typeof createMovimento !== 'function') {
    throw new Error('Servizio movimenti non disponibile.');
  }

  var movimentoIds = [];
  var skipped = 0;
  for (var i = 0; i < righe.length; i++) {
    var r = righe[i];
    var prodottoId = r.prodottoIdConfermato || r.prodottoIdSuggerito || '';
    var qty = Number(r.quantita);
    if (!prodottoId || !Number.isFinite(qty) || qty <= 0) {
      skipped += 1;
      continue;
    }
    var prezzo = r.prezzoUnitario != null && r.prezzoUnitario !== '' ? Number(r.prezzoUnitario) : null;
    if (prezzo != null && !Number.isFinite(prezzo)) prezzo = null;
    var prezzoInAttesa = prezzo == null;

    var movId = await createMovimento({
      prodottoId: prodottoId,
      data: dataMov,
      tipo: 'entrata',
      quantita: qty,
      prezzoUnitario: prezzo,
      prezzoInAttesa: prezzoInAttesa,
      documentoAcquisitoId: sessionId || null,
      note: buildNotaMovimento(estrazione, r),
      userId: userId,
      confezione: r.confezione || '',
    });
    movimentoIds.push(movId);
  }

  if (!movimentoIds.length) {
    throw new Error('Nessun movimento creato. Controlla prodotto e quantità sulle righe.');
  }
  return { movimentoIds: movimentoIds, skipped: skipped, prodottiCreati: ensured.prodottiCreati };
}

/**
 * @param {number} count
 * @param {string} tipo
 * @param {{ creati?: number, aggiornati?: number, prodottiCreati?: number }} [details]
 * @returns {string}
 */
export function formatRegisterSuccessMessage(count, tipo, details) {
  details = details || {};
  var n = count;
  var stubSuffix = '';
  var stubN = details.prodottiCreati || 0;
  if (stubN > 0) {
    stubSuffix = ' ' + stubN + ' prodott' + (stubN === 1 ? 'o nuovo creato' : 'i nuovi creati') + ' (da completare in anagrafica).';
  }
  if (tipo === 'scontrino') {
    return 'Scontrino registrato: ' + n + ' moviment' + (n === 1 ? 'o' : 'i') + ' di entrata creat' + (n === 1 ? 'o' : 'i') + ' in magazzino.' + stubSuffix;
  }
  if (tipo === 'fattura') {
    var creati = details.creati || 0;
    var aggiornati = details.aggiornati || 0;
    var medioN = details.prezzoMedio && details.prezzoMedio.updated ? details.prezzoMedio.updated : 0;
    var medioSuffix = medioN > 0
      ? ' Prezzo medio aggiornato su ' + medioN + ' prodott' + (medioN === 1 ? 'o' : 'i') + ' in anagrafica.'
      : '';
    if (creati > 0 && aggiornati > 0) {
      return 'Fattura registrata: ' + aggiornati + ' moviment' + (aggiornati === 1 ? 'o' : 'i') + ' aggiornat' + (aggiornati === 1 ? 'o' : 'i') + ' con i prezzi e ' + creati + ' nuov' + (creati === 1 ? 'a entrata' : 'e entrate') + '.' + stubSuffix + medioSuffix;
    }
    if (creati > 0) {
      return 'Fattura diretta registrata: ' + n + ' moviment' + (n === 1 ? 'o' : 'i') + ' di entrata creat' + (n === 1 ? 'o' : 'i') + ' in magazzino.' + stubSuffix + medioSuffix;
    }
    return 'Fattura registrata: ' + n + ' moviment' + (n === 1 ? 'o' : 'i') + ' aggiornat' + (n === 1 ? 'o' : 'i') + ' con i prezzi.' + stubSuffix + medioSuffix;
  }
  var label = 'Bolla';
  return label + ' registrata: ' + n + ' moviment' + (n === 1 ? 'o' : 'i') + ' di entrata creat' + (n === 1 ? 'o' : 'i') + ' in magazzino.' + stubSuffix;
}
