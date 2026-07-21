/**
 * Tony Occhi — form di revisione documento (Fase 2).
 * @module core/js/tony/document-review-form
 */

import { enrichRigheWithProdottoSuggestions, getCategoriaNome, filterProdottiByCategoria } from './document-product-match.js';
import {
  buildProdottoCompletamentoReminderMessage,
  stashProdottoCompletamentoReminder,
} from './document-prodotto-reminder.js';
import { formatEurDisplay, formatEurForInput, parseEurInput } from './document-eur-format.js';
import { formatArchivePersistMessage } from './document-archive.js';
import {
  registerBollaMovimenti,
  registerFatturaDocumento,
  registerFatturaEntrata,
  formatRegisterSuccessMessage,
  validateRigheForBollaRegister,
  validateRigheForFatturaDocumento,
  validateRigheForFatturaDirettaRegister,
  filterMovimentiCandidatiFattura,
  groupBolleSessionsFromMovimenti,
  matchRigheFatturaToMovimenti,
  resolveAutoBollaSessionFromEstrazione,
  normalizeRiferimentiBolla,
  isMovimentoPrezzoInAttesa,
  sanitizeFatturaRighe,
  getRigaRiferimentoBollaNumero,
  assessDocumentExtractionSafety,
  evaluateExtractionOutcome,
  DOCUMENT_CONFIDENCE_WARN_THRESHOLD,
  movimentoNoteContainsDocNum,
  qtyMatch,
} from './document-register.js';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveTipoConfermato(estrazione) {
  var tipo = String(
    (estrazione && estrazione.tipoDocumentoConfermato) ||
    (estrazione && estrazione.tipoDocumento) ||
    'bolla'
  ).toLowerCase();
  if (tipo === 'scontrino') return 'scontrino';
  if (tipo === 'fattura') return 'fattura';
  if (tipo === 'sconosciuto') return 'sconosciuto';
  return 'bolla';
}

function cloneEstrazione(estrazione) {
  var e = estrazione && typeof estrazione === 'object' ? estrazione : {};
  var tipoConf = resolveTipoConfermato(e);
  var righeRaw = Array.isArray(e.righe) ? e.righe.map(function (r) { return Object.assign({}, r); }) : [];
  var righe = (tipoConf === 'fattura' || e.tipoDocumento === 'fattura')
    ? sanitizeFatturaRighe(righeRaw)
    : righeRaw;
  var refs = normalizeRiferimentiBolla(e.riferimentiBolla);
  if (!refs.length && righe.length) {
    var seen = {};
    righe.forEach(function (r) {
      var n = getRigaRiferimentoBollaNumero(r);
      if (n && !seen[n]) {
        seen[n] = true;
        refs.push({ numeroDocumento: n, dataDocumento: '', fornitore: '' });
      }
    });
  }
  return {
    tipoDocumento: e.tipoDocumento || 'sconosciuto',
    tipoDocumentoConfermato: tipoConf,
    confidence: e.confidence,
    safetyPassB: e.safetyPassB === true,
    safetyPassBReasons: Array.isArray(e.safetyPassBReasons) ? e.safetyPassBReasons.slice() : [],
    fornitore: Object.assign({ nome: '', piva: '', confidence: null }, e.fornitore || {}),
    numeroDocumento: e.numeroDocumento || '',
    dataDocumento: e.dataDocumento || '',
    righe: righe,
    totali: e.totali || null,
    riferimentiBolla: refs,
  };
}

function newSessionId() {
  return 'toc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

/**
 * Garantisce overlay modal a livello pagina (migra markup legacy dentro #tony-panel).
 * @returns {{ shell: HTMLElement|null, overlay: HTMLElement|null, inner: HTMLElement|null }}
 */
export function ensureTonyDocumentReviewModal() {
  var shell = document.getElementById('tony-doc-review');
  var inner = document.getElementById('tony-doc-review-inner');
  var overlay = document.getElementById('tony-doc-review-overlay');
  if (!shell) return { shell: null, overlay: null, inner: null };

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'tony-doc-review-overlay';
    overlay.id = 'tony-doc-review-overlay';
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    if (shell.parentNode) shell.parentNode.removeChild(shell);
    overlay.appendChild(shell);
    document.body.appendChild(overlay);
  } else if (shell.parentNode !== overlay) {
    if (shell.parentNode) shell.parentNode.removeChild(shell);
    overlay.appendChild(shell);
  }

  if (!inner) {
    inner = document.createElement('div');
    inner.className = 'tony-doc-review-inner';
    inner.id = 'tony-doc-review-inner';
    shell.appendChild(inner);
  }

  return { shell: shell, overlay: overlay, inner: inner };
}

function openReviewModal(shell, overlay) {
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.classList.add('tony-doc-review--open');
    overlay.setAttribute('aria-hidden', 'false');
  }
  if (shell) {
    shell.style.display = 'flex';
    shell.classList.add('tony-doc-review--open');
  }
  try { document.body.classList.add('tony-doc-review-modal-open'); } catch (e) { /* ignore */ }
}

function closeReviewModal(shell, overlay) {
  if (shell) {
    shell.style.display = 'none';
    shell.classList.remove('tony-doc-review--open');
  }
  if (overlay) {
    overlay.style.display = 'none';
    overlay.classList.remove('tony-doc-review--open');
    overlay.setAttribute('aria-hidden', 'true');
  }
  try { document.body.classList.remove('tony-doc-review-modal-open'); } catch (e) { /* ignore */ }
}

/**
 * @param {object} opts
 * @param {object} opts.estrazione
 * @param {string} [opts.sessionId]
 * @param {Array<{ mimeType: string, data: string, fileName?: string }>} [opts.pages] — originali per archivio Storage
 * @param {function(string, string=): void} opts.showMessageInChat
 * @param {function(string, string=): void} [opts.appendMessage]
 * @param {function(): void} [opts.onClose]
 */
export async function openTonyDocumentReviewForm(opts) {
  opts = opts || {};
  var mount = ensureTonyDocumentReviewModal();
  var shell = mount.shell;
  var overlay = mount.overlay;
  var inner = mount.inner;
  if (!shell || !inner) return;

  var showMessageInChat = opts.showMessageInChat || function () {};
  var appendMessage = opts.appendMessage || showMessageInChat;
  var sessionId = opts.sessionId || newSessionId();
  var archivePages = Array.isArray(opts.pages) ? opts.pages.slice() : [];
  var state = cloneEstrazione(opts.estrazione);

  var prodotti = [];
  var movimentiPrezzoInAttesa = [];
  var bollaSessionFilter = '';
  var bollaSessionUserOverride = false;
  var autoBollaMatch = { sessionId: '', numeroDocumento: '', score: 0, multiSession: false, sessionIds: [] };
  /** Soft-gate controlli sicurezza: primo Registra chiede conferma, secondo procede */
  var safetyAck = false;
  var didScrollSafetyRow = false;
  try {
    var mod = await import('../../../modules/magazzino/services/prodotti-service.js');
    prodotti = await mod.getAllProdotti({ soloAttivi: true });
    prodotti = (prodotti || []).map(function (p) {
      return {
        id: p.id,
        nome: p.nome,
        codice: p.codice,
        unitaMisura: p.unitaMisura,
        categoria: p.categoria || 'altro',
      };
    });
  } catch (e) {
    console.warn('[Tony Occhi] caricamento prodotti:', e);
  }
  try {
    var movMod0 = await import('../../../modules/magazzino/services/movimenti-service.js');
    var allMov;
    try {
      allMov = await movMod0.getAllMovimenti({ tipo: 'entrata', orderDirection: 'desc', limit: 300 });
    } catch (idxErr) {
      // Indice composto tipo+data assente: fallback senza filtro tipo
      console.warn('[Tony Occhi] query movimenti tipo+data fallita, fallback:', idxErr && idxErr.message);
      allMov = await movMod0.getAllMovimenti({ orderDirection: 'desc', limit: 400 });
      allMov = (allMov || []).filter(function (m) { return m && m.tipo === 'entrata'; });
    }
    movimentiPrezzoInAttesa = (allMov || []).filter(isMovimentoPrezzoInAttesa).map(function (m) {
      return {
        id: m.id,
        tipo: 'entrata',
        prodottoId: m.prodottoId,
        quantita: m.quantita,
        note: m.note || '',
        documentoAcquisitoId: m.documentoAcquisitoId || '',
        data: m.data,
        prezzoUnitario: m.prezzoUnitario != null ? m.prezzoUnitario : null,
        prezzoInAttesa: m.prezzoInAttesa === true || m.prezzoUnitario == null,
      };
    });
  } catch (e) {
    console.warn('[Tony Occhi] caricamento movimenti prezzo in attesa:', e);
  }

  if (state.tipoDocumentoConfermato === 'fattura' || state.tipoDocumento === 'fattura') {
    autoBollaMatch = resolveAutoBollaSessionFromEstrazione(state, movimentiPrezzoInAttesa);
    // Multi-DDT: lascia "Tutte le bolle" così il match per-riga può usare tutti i movimenti
    if (autoBollaMatch.sessionId && !autoBollaMatch.multiSession) {
      bollaSessionFilter = autoBollaMatch.sessionId;
    }
  }

  state.righe = enrichRigheWithProdottoSuggestions(state.righe, prodotti);

  function readFormState() {
    var tipoSel = inner.querySelector('#tony-doc-review-tipo');
    state.tipoDocumentoConfermato = tipoSel ? tipoSel.value : state.tipoDocumentoConfermato;
    state.fornitore.nome = (inner.querySelector('#tony-doc-review-fornitore') || {}).value || '';
    state.fornitore.piva = (inner.querySelector('#tony-doc-review-piva') || {}).value || '';
    state.numeroDocumento = (inner.querySelector('#tony-doc-review-numero') || {}).value || '';
    state.dataDocumento = (inner.querySelector('#tony-doc-review-data') || {}).value || '';
    var rows = inner.querySelectorAll('.tony-doc-review-row');
    rows.forEach(function (rowEl, idx) {
      if (!state.righe[idx]) return;
      state.righe[idx].descrizione = (rowEl.querySelector('.tony-doc-r-desc') || {}).value || '';
      state.righe[idx].quantita = parseFloat((rowEl.querySelector('.tony-doc-r-qty') || {}).value);
      state.righe[idx].unita = (rowEl.querySelector('.tony-doc-r-unit') || {}).value || '';
      var prezzoRaw = (rowEl.querySelector('.tony-doc-r-prezzo') || {}).value;
      state.righe[idx].prezzoUnitario = parseEurInput(prezzoRaw);
      state.righe[idx].prodottoIdConfermato = (rowEl.querySelector('.tony-doc-r-prodotto') || {}).value || '';
      var movSel = rowEl.querySelector('.tony-doc-r-movimento');
      if (movSel) state.righe[idx].movimentoIdConfermato = movSel.value || '';
    });
    var bollaSel = inner.querySelector('#tony-doc-review-bolla');
    if (bollaSel) bollaSessionFilter = bollaSel.value || '';
  }

  function getCandidatiFiltrati() {
    return filterMovimentiCandidatiFattura(movimentiPrezzoInAttesa, {
      documentoBollaSessionId: bollaSessionFilter || null,
      fornitoreNome: state.fornitore && state.fornitore.nome ? state.fornitore.nome : '',
    });
  }

  function buildMovimentoOptions(riga, suggestedId) {
    var pid = riga.prodottoIdConfermato || riga.prodottoIdSuggerito || '';
    var qty = Number(riga.quantita);
    var hasQty = Number.isFinite(qty) && qty > 0;
    var refNum = getRigaRiferimentoBollaNumero(riga);
    var candidati = getCandidatiFiltrati().slice();
    candidati.sort(function (a, b) {
      var aDdt = refNum && movimentoNoteContainsDocNum(a.note, refNum) ? 0 : 1;
      var bDdt = refNum && movimentoNoteContainsDocNum(b.note, refNum) ? 0 : 1;
      if (aDdt !== bDdt) return aDdt - bDdt;
      var aPid = pid && a.prodottoId === pid ? 0 : 1;
      var bPid = pid && b.prodottoId === pid ? 0 : 1;
      if (aPid !== bPid) return aPid - bPid;
      if (hasQty) return Math.abs(a.quantita - qty) - Math.abs(b.quantita - qty);
      return 0;
    });
    var opts = '<option value="">— Collega movimento bolla —</option>';
    var seen = {};
    function addOpt(m, labelPrefix) {
      if (!m.id || seen[m.id]) return;
      seen[m.id] = true;
      var sel = (riga.movimentoIdConfermato || suggestedId) === m.id ? ' selected' : '';
      var lab = (labelPrefix || '') + 'Entrata ' + m.quantita;
      if (refNum && movimentoNoteContainsDocNum(m.note, refNum)) lab = 'DDT ' + refNum + ' · ' + lab;
      if (m.note) lab += ' · ' + String(m.note).slice(0, 40);
      opts += '<option value="' + escapeHtml(m.id) + '"' + sel + '>' + escapeHtml(lab) + '</option>';
    }
    // Stesso prodotto
    candidati.forEach(function (m) {
      if (pid && m.prodottoId !== pid) return;
      addOpt(m, '');
    });
    // Stesso DDT + qty anche se prodotto diverso / assente
    if (refNum && hasQty) {
      candidati.forEach(function (m) {
        if (!movimentoNoteContainsDocNum(m.note, refNum)) return;
        if (!qtyMatch(m.quantita, qty)) return;
        addOpt(m, 'Qty+DDT · ');
      });
    }
    // Altri candidati
    candidati.forEach(function (m) {
      addOpt(m, 'Altro · ');
    });
    if (Object.keys(seen).length === 0) {
      if (!movimentiPrezzoInAttesa.length) {
        opts += '<option value="" disabled>Nessuna bolla in attesa di prezzo — registra prima le bolle, oppure lascia vuoto (fattura diretta)</option>';
      } else {
        opts += '<option value="" disabled>Nessun movimento bolla compatibile con questa riga — lascia vuoto per fattura diretta</option>';
      }
    }
    return opts;
  }

  function attachPriceInputHandlers() {
    inner.querySelectorAll('.tony-doc-r-prezzo').forEach(function (input) {
      input.addEventListener('blur', function () {
        var parsed = parseEurInput(input.value);
        input.value = parsed != null ? formatEurForInput(parsed) : '';
      });
    });
  }

  function buildTotaliHtml() {
    var tot = state.totali;
    if (!tot || (tot.imponibile == null && tot.iva == null && tot.totale == null)) return '';
    return (
      '<div class="tony-doc-review-totali" aria-label="Totali documento">' +
      '<span class="tony-doc-review-totali-label">Totali documento</span>' +
      '<span>Imponibile: <strong>' + escapeHtml(formatEurDisplay(tot.imponibile)) + '</strong></span>' +
      '<span>IVA: <strong>' + escapeHtml(formatEurDisplay(tot.iva)) + '</strong></span>' +
      '<span>Totale: <strong>' + escapeHtml(formatEurDisplay(tot.totale)) + '</strong></span>' +
      '</div>'
    );
  }

  function render() {
    var tipoConf = state.tipoDocumentoConfermato || state.tipoDocumento || 'bolla';
    var isFattura = tipoConf === 'fattura';
    var isScontrino = tipoConf === 'scontrino';
    var prezzoObbligatorio = isFattura || isScontrino;
    var candidati = isFattura ? getCandidatiFiltrati() : [];
    var matchRows = isFattura ? matchRigheFatturaToMovimenti(state.righe, candidati) : [];
    var bolleGroups = isFattura ? groupBolleSessionsFromMovimenti(movimentiPrezzoInAttesa) : [];
    var bollaOpts = '<option value="">Tutte le bolle in attesa</option>';
    bolleGroups.forEach(function (g) {
      var sel = bollaSessionFilter === g.sessionId ? ' selected' : '';
      bollaOpts += '<option value="' + escapeHtml(g.sessionId) + '"' + sel + '>' + escapeHtml(g.label) + '</option>';
    });

    var safety = assessDocumentExtractionSafety(state, { tipo: tipoConf });
    var warnRowIdx = {};
    (safety.lowConfidenceRowIndexes || []).forEach(function (i) { warnRowIdx[i] = true; });
    (safety.issues || []).forEach(function (iss) {
      if (iss.rowIndex != null) warnRowIdx[iss.rowIndex] = true;
    });

    var rowsHtml = state.righe.map(function (r, idx) {
      var lowConf =
        warnRowIdx[idx] ||
        (r.confidence != null && Number(r.confidence) < DOCUMENT_CONFIDENCE_WARN_THRESHOLD);
      var suggestedMovId = matchRows[idx] ? matchRows[idx].movimentoId : null;
      if (isFattura && !r.movimentoIdConfermato && suggestedMovId) {
        r.movimentoIdConfermato = suggestedMovId;
      }
      var catLabel = r.categoriaSuggerita && r.categoriaSuggerita !== 'altro'
        ? getCategoriaNome(r.categoriaSuggerita)
        : '';
      var ddtNum = getRigaRiferimentoBollaNumero(r);
      var optsHtml = '<option value="">— Seleziona prodotto —</option>';
      var seen = {};
      (r.matchCandidates || []).forEach(function (c) {
        if (!c.id || seen[c.id]) return;
        seen[c.id] = true;
        var sel = (r.prodottoIdConfermato || r.prodottoIdSuggerito) === c.id ? ' selected' : '';
        optsHtml += '<option value="' + escapeHtml(c.id) + '"' + sel + '>' + escapeHtml(c.label) + '</option>';
      });
      var pool = filterProdottiByCategoria(prodotti, r.categoriaSuggerita);
      pool.forEach(function (p) {
        if (!p.id || seen[p.id]) return;
        seen[p.id] = true;
        var sel2 = (r.prodottoIdConfermato || r.prodottoIdSuggerito) === p.id ? ' selected' : '';
        var lab = (p.nome || p.codice || p.id) + (p.codice ? ' (' + p.codice + ')' : '');
        optsHtml += '<option value="' + escapeHtml(p.id) + '"' + sel2 + '>' + escapeHtml(lab) + '</option>';
      });
      if (pool.length < prodotti.length) {
        prodotti.forEach(function (p) {
          if (!p.id || seen[p.id]) return;
          seen[p.id] = true;
          var sel3 = (r.prodottoIdConfermato || r.prodottoIdSuggerito) === p.id ? ' selected' : '';
          var lab2 = (p.nome || p.codice || p.id) + ' · altre categorie';
          optsHtml += '<option value="' + escapeHtml(p.id) + '"' + sel3 + '>' + escapeHtml(lab2) + '</option>';
        });
      }
      var movCol = isFattura
        ? '<td><select class="tony-doc-r-movimento">' + buildMovimentoOptions(r, suggestedMovId) + '</select></td>'
        : '';
      var prezzoVal = formatEurForInput(r.prezzoUnitario);
      return (
        '<tr class="tony-doc-review-row' + (lowConf ? ' tony-doc-row-low-conf' : '') + '" data-idx="' + idx + '">' +
        '<td><div class="tony-doc-desc-cell"><input class="tony-doc-r-desc" type="text" value="' + escapeHtml(r.descrizione) + '" maxlength="200">' +
        (ddtNum ? '<span class="tony-doc-ddt-badge" title="DDT collegato a questa riga">DDT ' + escapeHtml(ddtNum) + '</span>' : '') +
        (catLabel ? '<span class="tony-doc-cat-badge" title="Categoria suggerita">' + escapeHtml(catLabel) + '</span>' : '') +
        '</div></td>' +
        '<td><input class="tony-doc-r-qty" type="number" min="0" step="any" value="' + escapeHtml(r.quantita != null ? r.quantita : '') + '"></td>' +
        '<td><input class="tony-doc-r-unit" type="text" value="' + escapeHtml(r.unita || '') + '" maxlength="12"></td>' +
        '<td><span class="tony-doc-eur-wrap"><input class="tony-doc-r-prezzo" type="text" inputmode="decimal" autocomplete="off" value="' + escapeHtml(prezzoVal) + '" placeholder="' + (prezzoObbligatorio ? '0,00' : '—') + '"><span class="tony-doc-eur-suffix" aria-hidden="true">€</span></span></td>' +
        '<td><select class="tony-doc-r-prodotto">' + optsHtml + '</select></td>' +
        movCol +
        '</tr>'
      );
    }).join('');

    var tableHead = isFattura
      ? '<th>Descrizione</th><th>Qty</th><th>Unità</th><th>Prezzo (€)</th><th>Prodotto GFV</th><th>Movimento bolla</th>'
      : '<th>Descrizione</th><th>Qty</th><th>Unità</th><th>Prezzo (€)</th><th>Prodotto GFV</th>';
    var hint = isScontrino
      ? 'Scontrino: inserisci prezzi e prodotti — verrà creata una nuova entrata in magazzino (qty + prezzo).'
      : isFattura
        ? 'Fattura: «Movimento bolla» collega la riga a un\'entrata già registrata dalla bolla (prezzo in attesa). Il badge DDT sotto la descrizione è solo il riferimento letto dalla fattura, non il collegamento. Lascia vuoto per una nuova entrata (fattura diretta).'
        : 'Righe evidenziate: revisione consigliata (bassa confidence). Su bolla il prezzo può restare vuoto (prezzo in attesa). Prodotti non trovati verranno creati in anagrafica al momento della registrazione.';
    if (isFattura && !movimentiPrezzoInAttesa.length) {
      hint += ' Nessuna entrata bolla in attesa di prezzo in magazzino: registra prima le bolle (con qty, prezzo vuoto), poi ripeti la fattura.';
    } else if (isFattura && autoBollaMatch.multiSession && !bollaSessionUserOverride) {
      hint += ' Fattura multi-DDT: collegamento per riga (badge DDT). Filtro bolla lasciato su tutte le bolle in attesa.';
    } else if (isFattura && autoBollaMatch.sessionId && bollaSessionFilter === autoBollaMatch.sessionId && !bollaSessionUserOverride) {
      hint += ' Bolla collegata automaticamente da DDT ' + autoBollaMatch.numeroDocumento + ' (' + autoBollaMatch.score + ' entr' + (autoBollaMatch.score === 1 ? 'ata' : 'ate') + ').';
    }
    var riferimentiHtml = '';
    if (isFattura && state.riferimentiBolla && state.riferimentiBolla.length) {
      var refLabels = state.riferimentiBolla.map(function (r) { return r.numeroDocumento; }).join(', ');
      riferimentiHtml = '<p class="tony-doc-review-refs">DDT in fattura: <strong>' + escapeHtml(refLabels) + '</strong></p>';
    }
    var passBHtml = '';
    if (state.safetyPassB) {
      var reasonsLabel = (state.safetyPassBReasons && state.safetyPassBReasons.length)
        ? state.safetyPassBReasons.join(', ')
        : 'incoerenze rilevate';
      passBHtml =
        '<p class="tony-doc-review-passb" role="status">' +
        'Rilettura di controllo eseguita (' + escapeHtml(reasonsLabel) + '). Verifica ancora numeri e righe.' +
        '</p>';
    }
    var safetyHtml = '';
    if (safety.needsAck && safety.issues && safety.issues.length) {
      safetyHtml =
        '<div class="tony-doc-review-safety" role="status">' +
        '<p class="tony-doc-review-safety-summary">' + escapeHtml(safety.summaryMessage || 'Controlli sicurezza: verifica gli avvisi.') + '</p>' +
        '<ul class="tony-doc-review-safety-list">' +
        safety.issues.map(function (iss) {
          return '<li>' + escapeHtml(iss.message) + '</li>';
        }).join('') +
        '</ul>' +
        (safetyAck
          ? '<p class="tony-doc-review-safety-ack">Conferma ricevuta: un altro clic su «Registra dati» procederà comunque.</p>'
          : '') +
        '</div>';
    }
    var bollaFilterHtml = isFattura
      ? '<label class="tony-doc-review-bolla-filter">Collega bolla <select id="tony-doc-review-bolla">' + bollaOpts + '</select></label>'
      : '';

    inner.innerHTML =
      '<div class="tony-doc-review-header">' +
      '<h3 id="tony-doc-review-title">Revisione documento</h3>' +
      '<button type="button" class="tony-doc-review-close" id="tony-doc-review-close" aria-label="Chiudi">×</button>' +
      '</div>' +
      '<div class="tony-doc-review-meta">' +
      '<label>Tipo <select id="tony-doc-review-tipo">' +
      '<option value="bolla"' + (tipoConf === 'bolla' ? ' selected' : '') + '>Bolla / DDT</option>' +
      '<option value="fattura"' + (tipoConf === 'fattura' ? ' selected' : '') + '>Fattura</option>' +
      '<option value="scontrino"' + (tipoConf === 'scontrino' ? ' selected' : '') + '>Scontrino</option>' +
      '<option value="sconosciuto"' + (tipoConf === 'sconosciuto' ? ' selected' : '') + '>Sconosciuto</option>' +
      '<option value="preventivo" disabled>Preventivo (in arrivo)</option>' +
      '</select></label>' +
      bollaFilterHtml +
      '<label>Fornitore <input id="tony-doc-review-fornitore" type="text" value="' + escapeHtml(state.fornitore.nome) + '"></label>' +
      '<label>P.IVA <input id="tony-doc-review-piva" type="text" value="' + escapeHtml(state.fornitore.piva) + '"></label>' +
      '<label>N. documento <input id="tony-doc-review-numero" type="text" value="' + escapeHtml(state.numeroDocumento) + '"></label>' +
      '<label>Data <input id="tony-doc-review-data" type="text" value="' + escapeHtml(state.dataDocumento) + '" placeholder="YYYY-MM-DD"></label>' +
      '</div>' +
      riferimentiHtml +
      buildTotaliHtml() +
      passBHtml +
      safetyHtml +
      '<div class="tony-doc-review-table-wrap">' +
      '<table class="tony-doc-review-table"><thead><tr>' +
      tableHead +
      '</tr></thead><tbody>' + rowsHtml + '</tbody></table>' +
      '</div>' +
      '<p class="tony-doc-review-hint">' + hint + '</p>' +
      '<div class="tony-doc-review-actions">' +
      '<button type="button" class="tony-doc-btn tony-doc-btn-primary" id="tony-doc-review-register">Registra dati</button>' +
      '<button type="button" class="tony-doc-btn tony-doc-btn-ghost" id="tony-doc-review-cancel">Annulla</button>' +
      '</div>' +
      '<p class="tony-doc-review-errors" id="tony-doc-review-errors" role="alert"></p>';

    inner.querySelector('#tony-doc-review-close').addEventListener('click', close);
    inner.querySelector('#tony-doc-review-cancel').addEventListener('click', close);
    inner.querySelector('#tony-doc-review-register').addEventListener('click', onRegister);
    var tipoSel = inner.querySelector('#tony-doc-review-tipo');
    if (tipoSel) {
      tipoSel.addEventListener('change', function () {
        readFormState();
        state.tipoDocumentoConfermato = tipoSel.value;
        safetyAck = false;
        if (tipoSel.value === 'fattura' && !bollaSessionUserOverride) {
          autoBollaMatch = resolveAutoBollaSessionFromEstrazione(state, movimentiPrezzoInAttesa);
          bollaSessionFilter = (autoBollaMatch.sessionId && !autoBollaMatch.multiSession)
            ? autoBollaMatch.sessionId
            : '';
        } else if (tipoSel.value !== 'fattura') {
          bollaSessionFilter = '';
        }
        render();
      });
    }
    var bollaSel = inner.querySelector('#tony-doc-review-bolla');
    if (bollaSel) {
      bollaSel.addEventListener('change', function () {
        readFormState();
        bollaSessionUserOverride = true;
        safetyAck = false;
        render();
      });
    }
    attachPriceInputHandlers();
    if (!didScrollSafetyRow) {
      var firstWarn = inner.querySelector('.tony-doc-row-low-conf');
      if (firstWarn && typeof firstWarn.scrollIntoView === 'function') {
        try {
          firstWarn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (_) {
          firstWarn.scrollIntoView(true);
        }
        didScrollSafetyRow = true;
      }
    }
  }

  function close() {
    closeReviewModal(shell, overlay);
    if (typeof opts.onClose === 'function') opts.onClose();
  }

  async function onRegister() {
    var errEl = inner.querySelector('#tony-doc-review-errors');
    if (errEl) errEl.textContent = '';
    readFormState();
    var tipo = String(state.tipoDocumentoConfermato || 'bolla').toLowerCase();
    var isFattura = tipo === 'fattura';
    var isScontrino = tipo === 'scontrino';
    var candidati = isFattura ? getCandidatiFiltrati() : [];
    var matches = isFattura ? matchRigheFatturaToMovimenti(state.righe, candidati) : [];
    var validation = isScontrino
      ? validateRigheForFatturaDirettaRegister(state.righe)
      : isFattura
        ? validateRigheForFatturaDocumento(state.righe, matches)
        : validateRigheForBollaRegister(state.righe);
    if (!validation.ok) {
      if (errEl) errEl.textContent = validation.errors.join(' ');
      return;
    }
    var outcomeReg = evaluateExtractionOutcome(state, { tipo: tipo });
    if (outcomeReg.status === 'failed') {
      if (errEl) errEl.textContent = outcomeReg.message;
      return;
    }
    var safetyReg = outcomeReg.safety || assessDocumentExtractionSafety(state, { tipo: tipo });
    if (safetyReg.needsAck && !safetyAck) {
      safetyAck = true;
      if (errEl) {
        errEl.textContent =
          'Controlli sicurezza: rivedi gli avvisi in alto (e le righe in giallo), poi premi di nuovo «Registra dati» per confermare.';
      }
      render();
      var errEl2 = inner.querySelector('#tony-doc-review-errors');
      if (errEl2) {
        errEl2.textContent =
          'Controlli sicurezza: rivedi gli avvisi in alto (e le righe in giallo), poi premi di nuovo «Registra dati» per confermare.';
      }
      return;
    }
    var btn = inner.querySelector('#tony-doc-review-register');
    if (btn) btn.disabled = true;
    try {
      var movMod = await import('../../../modules/magazzino/services/movimenti-service.js');
      var authMod = await import('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js');
      var fbMod = await import('../../../core/services/firebase-service.js');
      var app = null;
      try {
        app = fbMod.getAppInstanceIfReady ? fbMod.getAppInstanceIfReady() : null;
      } catch (_) { /* ignore */ }
      if (!app && fbMod.getAppInstance) {
        try { app = fbMod.getAppInstance(); } catch (_) { /* ignore */ }
      }
      var userId = null;
      if (app) {
        var user = authMod.getAuth(app).currentUser;
        if (user) userId = user.uid;
      }
      var prodMod = await import('../../../modules/magazzino/services/prodotti-service.js');
      var result;
      if (isScontrino) {
        result = await registerFatturaEntrata({
          estrazione: state,
          sessionId: sessionId,
          userId: userId,
          createMovimento: movMod.createMovimento,
          createProdotto: prodMod.createProdotto,
          getAllMovimenti: movMod.getAllMovimenti,
          updateProdotto: prodMod.updateProdottoPrezzoMedio || prodMod.updateProdotto,
          getMovimento: movMod.getMovimento,
        });
      } else if (isFattura) {
        result = await registerFatturaDocumento({
          estrazione: state,
          sessionId: sessionId,
          userId: userId,
          matches: matches,
          movimentiCandidati: candidati,
          updateMovimento: movMod.updateMovimento,
          getMovimento: movMod.getMovimento,
          createMovimento: movMod.createMovimento,
          createProdotto: prodMod.createProdotto,
          getAllMovimenti: movMod.getAllMovimenti,
          updateProdotto: prodMod.updateProdottoPrezzoMedio || prodMod.updateProdotto,
        });
      } else {
        result = await registerBollaMovimenti({
          estrazione: state,
          sessionId: sessionId,
          userId: userId,
          createMovimento: movMod.createMovimento,
          createProdotto: prodMod.createProdotto,
        });
      }
      var prodottiCreatiList = result.prodottiCreati || [];
      var prodottiCreati = prodottiCreatiList.length;
      if (prodottiCreati > 0) {
        stashProdottoCompletamentoReminder(prodottiCreatiList);
      }
      var msg = formatRegisterSuccessMessage(result.movimentoIds.length, state.tipoDocumentoConfermato, {
        creati: result.creati,
        aggiornati: result.aggiornati,
        prodottiCreati: prodottiCreati,
        prezzoMedio: result.prezzoMedio,
      });
      if (prodottiCreati > 0) {
        var rem = buildProdottoCompletamentoReminderMessage(prodottiCreatiList);
        if (rem) msg += ' ' + rem;
      }
      if (result.skipped > 0) msg += ' (' + result.skipped + ' righe saltate)';
      if (result.unmatched > 0) msg += ' (' + result.unmatched + ' senza collegamento bolla)';

      // Persistenza originali (Storage + documentiAcquisiti) — non annulla i movimenti se fallisce
      var documentoCollegatoId = null;
      if (isFattura && bollaSessionFilter) documentoCollegatoId = bollaSessionFilter;
      try {
        var tenantMod = await import('../../services/tenant-service.js');
        if (typeof tenantMod.getCurrentTenantId === 'function' && !tenantMod.getCurrentTenantId()) {
          var tidCtx = window.Tony && window.Tony.context && window.Tony.context.dashboard
            && window.Tony.context.dashboard.tenantId;
          if (tidCtx && typeof tenantMod.setCurrentTenantId === 'function') {
            tenantMod.setCurrentTenantId(tidCtx);
          }
        }
        var archMod = await import('../../../modules/magazzino/services/documenti-acquisiti-service.js');
        var archiveResult = await archMod.persistArchiveForSession({
          sessionId: sessionId,
          pages: archivePages,
          estrazione: state,
          movimentoIds: result.movimentoIds || [],
          documentoCollegatoId: documentoCollegatoId,
          userId: userId,
        });
        msg += formatArchivePersistMessage(archiveResult);
      } catch (archErr) {
        console.warn('[Tony Occhi] archivio post-registrazione:', archErr);
        msg += formatArchivePersistMessage({ filePending: true });
      }

      showMessageInChat(msg, 'tony');
      appendMessage('Registra dati — confermato.', 'user');
      if (window.Tony && typeof window.Tony.speak === 'function') window.Tony.speak(msg);
      close();
      if (typeof opts.onRegistered === 'function') {
        opts.onRegistered({ movimentoIds: result.movimentoIds, sessionId: sessionId });
      }
    } catch (e) {
      console.error('[Tony Occhi] registrazione:', e);
      if (errEl) errEl.textContent = e.message || 'Registrazione non riuscita.';
      if (btn) btn.disabled = false;
    }
  }

  render();
  openReviewModal(shell, overlay);
  showMessageInChat('Ho aperto il riepilogo in una finestra dedicata: controlla i dati e conferma con «Registra dati».', 'tony');
}

export function closeTonyDocumentReviewForm() {
  var mount = ensureTonyDocumentReviewModal();
  closeReviewModal(mount.shell, mount.overlay);
}
