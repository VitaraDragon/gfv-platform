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
  if (!m || m.tipo !== 'entrata') return false;
  if (m.prezzoInAttesa === true) return true;
  return m.prezzoUnitario == null;
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
    list = list.filter(function (m) {
      return normText(m.note || '').indexOf(fn) >= 0;
    });
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
  var fn = normText(fornitoreNome || ref.fornitore || '');
  if (fn && normText(m.note || '').indexOf(fn) < 0) return false;
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
 * @param {object} estrazione
 * @param {Array<object>} movimenti
 * @returns {{ sessionId: string, matchedRef: object|null, score: number, numeroDocumento: string }}
 */
export function resolveAutoBollaSessionFromEstrazione(estrazione, movimenti) {
  var empty = { sessionId: '', matchedRef: null, score: 0, numeroDocumento: '' };
  if (!estrazione) return empty;
  var refs = normalizeRiferimentiBolla(estrazione.riferimentiBolla);
  if (!refs.length) return empty;
  var fornitoreNome = estrazione.fornitore && estrazione.fornitore.nome ? estrazione.fornitore.nome : '';
  var best = empty;
  refs.forEach(function (ref) {
    var counts = scoreSessionsForRiferimentoBolla(movimenti, ref, fornitoreNome);
    Object.keys(counts).forEach(function (sid) {
      if (counts[sid] > best.score) {
        best = {
          sessionId: sid,
          matchedRef: ref,
          score: counts[sid],
          numeroDocumento: ref.numeroDocumento || '',
        };
      }
    });
  });
  return best;
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
  if (!pid) return null;
  var qty = Number(riga.quantita);
  var hasQty = Number.isFinite(qty) && qty > 0;
  var pool = (candidati || []).filter(function (m) {
    if (!m || !m.id || usedIds.has(m.id)) return false;
    if (m.prodottoId !== pid) return false;
    if (!hasQty) return true;
    return qtyMatch(m.quantita, qty);
  });
  if (!pool.length) return null;
  if (hasQty) {
    pool.sort(function (a, b) {
      var da = Math.abs(a.quantita - qty);
      var db = Math.abs(b.quantita - qty);
      return da - db;
    });
  }
  return pool[0];
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
  return { movimentoIds: movimentoIds, skipped: skipped, prodottiCreati: ensured.prodottiCreati };
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
  return {
    movimentoIds: movimentoIds,
    skipped: skipped,
    unmatched: unmatched,
    creati: creati,
    aggiornati: aggiornati,
    prodottiCreati: prodottiCreati,
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
    if (creati > 0 && aggiornati > 0) {
      return 'Fattura registrata: ' + aggiornati + ' moviment' + (aggiornati === 1 ? 'o' : 'i') + ' aggiornat' + (aggiornati === 1 ? 'o' : 'i') + ' con i prezzi e ' + creati + ' nuov' + (creati === 1 ? 'a entrata' : 'e entrate') + '.' + stubSuffix;
    }
    if (creati > 0) {
      return 'Fattura diretta registrata: ' + n + ' moviment' + (n === 1 ? 'o' : 'i') + ' di entrata creat' + (n === 1 ? 'o' : 'i') + ' in magazzino.' + stubSuffix;
    }
    return 'Fattura registrata: ' + n + ' moviment' + (n === 1 ? 'o' : 'i') + ' aggiornat' + (n === 1 ? 'o' : 'i') + ' con i prezzi.' + stubSuffix;
  }
  var label = 'Bolla';
  return label + ' registrata: ' + n + ' moviment' + (n === 1 ? 'o' : 'i') + ' di entrata creat' + (n === 1 ? 'o' : 'i') + ' in magazzino.' + stubSuffix;
}
