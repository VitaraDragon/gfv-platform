/**
 * Tony Form Injector - Universal Injection Engine
 * Motore di iniezione basato su mappe di configurazione.
 * Supporta SELECT, RADIO, TEXT, NUMBER, DATE, TIME, TEXTAREA, CHECKBOX.
 * Gestisce delay asincroni per dropdown dipendenti e regole di business.
 */

(function (global) {
  'use strict';

  const DEBUG = true;
  function log(msg) {
    if (DEBUG && typeof console !== 'undefined' && console.log) {
      console.log('[TonyFormInjector] ' + msg);
    }
  }

  const INJECTION_ORDER_ATTIVITA = [
    'attivita-data',
    'attivita-terreno',
    'attivita-categoria-principale',
    'attivita-sottocategoria',
    'attivita-tipo-lavoro-gerarchico',
    'attivita-coltura-categoria',
    'attivita-coltura-gerarchica',
    'attivita-orario-inizio',
    'attivita-orario-fine',
    'attivita-pause',
    'attivita-macchina',
    'attivita-attrezzo',
    'attivita-ore-macchina',
    'attivita-note'
  ];

  const DELAYS_ATTIVITA = {
    'attivita-categoria-principale': 250,
    'attivita-sottocategoria': 250,
    'attivita-coltura-categoria': 280,
    'attivita-coltura-gerarchica': 150,
    'attivita-terreno': 400,
    'attivita-macchina': 350,
    'attivita-tipo-lavoro-gerarchico': 150,
    '_secondPass_tipo_lavoro': 400
  };

  const INJECTION_ORDER_LAVORO = [
    'lavoro-nome',
    'lavoro-terreno',
    'lavoro-categoria-principale',
    'lavoro-sottocategoria',
    'lavoro-tipo-lavoro',
    'tipo-assegnazione',
    'lavoro-caposquadra',
    'lavoro-operaio',
    'lavoro-data-inizio',
    'lavoro-durata',
    'lavoro-stato',
    'lavoro-trattore',
    'lavoro-attrezzo',
    'lavoro-operatore-macchina',
    'lavoro-note'
  ];

  const DELAYS_LAVORO = {
    'lavoro-terreno': 200,
    'lavoro-categoria-principale': 180,
    'lavoro-sottocategoria': 280,
    'lavoro-tipo-lavoro': 180,
    'lavoro-trattore': 200,
    'tipo-assegnazione': 120
  };

  const INJECTION_ORDER_PREVENTIVO = [
    'cliente-id',
    // Prima seleziona il terreno cliente: innesca onTerrenoChange e precompila campi dipendenti
    // (superficie, tipo-campo, coltura*) prima della cascata lavorazione.
    'terreno-id',
    'lavoro-categoria-principale',
    'lavoro-sottocategoria',
    'tipo-lavoro',
    'coltura-categoria',
    'coltura',
    'tipo-campo',
    'superficie',
    'iva',
    'giorni-scadenza',
    'data-prevista',
    'note'
  ];

  /** Allineato a main.js OPEN_MODAL lavoro + `enqueueTonyCommand(INJECT, delayMs: 1800)` dopo openCreaModal. */
  const PREVENTIVO_POST_CLIENTE_MS = 1800;

  const DELAYS_PREVENTIVO = {
    'cliente-id': PREVENTIVO_POST_CLIENTE_MS,
    'terreno-id': 600,
    /** loadTipiLavoro(categoria) è async: tempo per ripopolare #tipo-lavoro prima della sottocategoria/tipo */
    'lavoro-categoria-principale': 900,
    'lavoro-sottocategoria': 900,
    'tipo-lavoro': 250,
    'coltura-categoria': 350,
    'coltura': 200
  };

  function delay(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /** Attende che un select abbia opzioni. Nuovo Preventivo: loadTipiLavoro async → maxMs più alto. */
  function waitForSelectOptions(selectId, minOptions, maxMs) {
    minOptions = minOptions || 2;
    maxMs = maxMs == null ? 3000 : maxMs;
    var el = document.getElementById(selectId);
    if (!el || el.tagName !== 'SELECT') return Promise.resolve();
    if (el.options.length >= minOptions) return Promise.resolve();
    return new Promise(function (resolve) {
      var start = Date.now();
      var iv = setInterval(function () {
        if (el.options.length >= minOptions || Date.now() - start > maxMs) {
          clearInterval(iv);
          resolve();
        }
      }, 80);
    });
  }

  /**
   * Attende che la pagina Nuovo Preventivo abbia finito il bootstrap (tipi lavoro + categorie colture).
   * Evita injectPreventivoForm che fallisce o lascia campi vuoti se Tony risponde mentre loadColture/loadTipiLavoro sono in corso.
   */
  function waitForPreventivoPageDataReady(maxMs) {
    maxMs = maxMs || 20000;
    var t0 = Date.now();
    return new Promise(function (resolve) {
      var iv = setInterval(function () {
        var ps = window.preventivoState;
        var tipiOk = ps && Array.isArray(ps.tipiLavoroList) && ps.tipiLavoroList.length > 0;
        var catLavOk = ps && Array.isArray(ps.categorieLavoriPrincipali) && ps.categorieLavoriPrincipali.length > 0;
        var elColCat = document.getElementById('coltura-categoria');
        var nOptCol = elColCat && elColCat.options ? elColCat.options.length : 0;
        var coltureOk = nOptCol >= 2 || (ps && Array.isArray(ps.categorieColturePreventivo) && ps.categorieColturePreventivo.length > 0);
        if (tipiOk && catLavOk && coltureOk) {
          clearInterval(iv);
          resolve();
          return;
        }
        if (Date.now() - t0 > maxMs) {
          clearInterval(iv);
          resolve();
        }
      }, 120);
    });
  }

  /**
   * Attende che nel select esista un'option con value esatto (es. id Firestore).
   * Nuovo Preventivo: dopo cliente-id, loadTerreniCliente() è async e ricostruisce terreno-id.
   */
  /**
   * True se dal terreno si capisce coltura arborata / filari (vite, frutteto, olivo…).
   * Conto Terzi: campi camelCase (colturaCategoria spesso è id Firestore) + coltura nome.
   */
  function terrenoHasFilariColtura(terreno) {
    if (!terreno) return false;
    var blob = [
      terreno.coltura,
      terreno.colturaSottocategoria,
      terreno.colturaSottoCategoria,
      terreno.coltura_categoria,
      terreno.colturaCategoria,
      terreno.colturaDettaglio && terreno.colturaDettaglio.nome,
      terreno.colturaDettaglio && terreno.colturaDettaglio.categoria,
      terreno.nome
    ].filter(function (x) { return x != null && String(x).trim() !== ''; }).join(' ').toLowerCase();
    // Filari: vigneto e colture arboree/frutteto (es. albicocche, pesco, ciliegio...)
    return /vite|vigneto|trebbian|frutteto|olivo|oliveto|arboreo|alberi|albicocc|pesc|cilieg|susin|prugn|pero|melo|kaki|mandorl|nocciol|noce|kiwi|melograno|castagn|pistac|fico|nespol|giuggiol|gelso/.test(blob);
  }

  function findPreventivoTerrenoById(terrenoId) {
    var tid = String(terrenoId || '').trim();
    if (!tid) return null;
    var list = (window.preventivoState && window.preventivoState.terreni) ||
      (window.lavoriState && window.lavoriState.terreniList) || [];
    var hit = list.find(function (t) { return String(t.id || '') === tid; });
    if (hit) return hit;
    var tl = tid.toLowerCase();
    return list.find(function (t) {
      var n = (t.nome || '').toLowerCase();
      return n === tl || (tl && n.indexOf(tl) >= 0) || (n && tl.indexOf(n) >= 0);
    }) || null;
  }

  /** Terreno corrente (form o fd) con coltura a filari → preferisci tipo "… tra le file". */
  function getPreventivoTerrenoFilariHint(terrenoIdOpt) {
    var sel = document.getElementById('terreno-id');
    var tid = terrenoIdOpt != null ? String(terrenoIdOpt).trim() : ((sel && sel.value) || '');
    var t = findPreventivoTerrenoById(tid);
    return terrenoHasFilariColtura(t) ? t : null;
  }

  function normTipoLavoroNome(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Se terreno vite/trebbiano/frutteto: upgrade "Trinciatura" → "Trinciatura tra le file" e sottocategoria Tra le File.
   */
  function upgradePreventivoLavorazioneFilari(fd) {
    if (!fd || typeof fd !== 'object') return fd;
    var terreno = getPreventivoTerrenoFilariHint(fd['terreno-id']);
    if (!terreno) return fd;
    var sub = String(fd['lavoro-sottocategoria'] || '').trim().toLowerCase();
    if (!sub || sub === 'generale' || sub === '-- nessuna sottocategoria --') {
      fd['lavoro-sottocategoria'] = 'Tra le File';
    }
    var tipoRaw = String(fd['tipo-lavoro'] || '').trim();
    if (!tipoRaw || !window.lavoriState || !Array.isArray(window.lavoriState.tipiLavoroList)) return fd;
    var tipoN = normTipoLavoroNome(tipoRaw);
    if (tipoN.indexOf('tra le file') >= 0 || tipoN.indexOf('sulla fila') >= 0) return fd;
    var root = tipoN.split(/\s+/)[0];
    if (!root || root.length < 4) return fd;
    var list = window.lavoriState.tipiLavoroList;
    var candidates = list.filter(function (t) {
      var n = normTipoLavoroNome(t.nome);
      return n.indexOf(root) >= 0 && (n.indexOf('tra le file') >= 0 || n.indexOf('sulla fila') >= 0);
    });
    if (!candidates.length) return fd;
    candidates.sort(function (a, b) { return (b.nome || '').length - (a.nome || '').length; });
    fd['tipo-lavoro'] = candidates[0].nome;
    return fd;
  }

  function preventivoDomTipoLavoroText() {
    var sel = document.getElementById('tipo-lavoro');
    if (!sel || !sel.options || sel.selectedIndex < 0) return '';
    var opt = sel.options[sel.selectedIndex];
    return String((opt && (opt.text || opt.value)) || sel.value || '').trim();
  }

  function preventivoTipoIncomingMoreSpecific(domText, incoming) {
    var a = normTipoLavoroNome(domText);
    var b = normTipoLavoroNome(incoming);
    if (!a || !b || a === b) return false;
    if (b.length > a.length + 2 && (b.indexOf(a) >= 0 || a.indexOf(b) >= 0)) return true;
    return false;
  }

  function normalizeTonyText(v) {
    try {
      return String(v || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) {
      return String(v || '').toLowerCase().trim();
    }
  }

  function getLavorazioniDefaultsTony() {
    var m = (typeof window !== 'undefined' && window.TONY_FORM_MAPPING) || {};
    return m.LAVORAZIONI_DEFAULTS_TONY || {
      mechanicalDefaultKeywords: ['trinciatur', 'erpicatur', 'fresatur', 'vangatur', 'ripunt', 'diserb', 'trattament', 'concimaz'],
      machineRequiredKeywords: ['trinciatur', 'erpicatur', 'fresatur', 'vangatur', 'ripunt', 'diserb', 'trattament', 'concimaz'],
      coverageRules: { rowCropSubcategories: ['Tra le File', 'Sulla Fila'], openFieldSubcategory: 'Generale' }
    };
  }

  function inferPreferMechanicalFromTipo(tipoNome) {
    var s = normalizeTonyText(tipoNome);
    if (!s) return false;
    if (s.indexOf('manual') >= 0) return false;
    if (s.indexOf('meccanic') >= 0) return true;
    var cfg = getLavorazioniDefaultsTony();
    var list = Array.isArray(cfg.mechanicalDefaultKeywords) ? cfg.mechanicalDefaultKeywords : [];
    return list.some(function (k) { return s.indexOf(normalizeTonyText(k)) >= 0; });
  }

  function inferRequiresMachineFromTipo(tipoNome) {
    var s = normalizeTonyText(tipoNome);
    if (!s) return false;
    if (window.__tonyLavoroTipoModo === 'manuale') return false;
    if (window.__tonyLavoroTipoModo === 'meccanica') return true;
    var modo = classifyTipoLavoroModo(tipoNome);
    if (modo === 'manuale') return false;
    if (modo === 'meccanica') return true;
    if (s.indexOf('manual') >= 0) return false;
    if (s.indexOf('meccanic') >= 0) return true;
    var cfg = getLavorazioniDefaultsTony();
    var list = Array.isArray(cfg.machineRequiredKeywords) ? cfg.machineRequiredKeywords : [];
    return list.some(function (k) { return s.indexOf(normalizeTonyText(k)) >= 0; });
  }

  function forceCoverageByTerreno(existingSub, terrenoHasFilari) {
    var cfg = getLavorazioniDefaultsTony();
    var rules = cfg.coverageRules || {};
    var rowSubs = Array.isArray(rules.rowCropSubcategories) ? rules.rowCropSubcategories : ['Tra le File', 'Sulla Fila'];
    var openField = String(rules.openFieldSubcategory || 'Generale');
    var sub = String(existingSub || '').trim();
    if (!sub) return terrenoHasFilari ? rowSubs[0] : openField;
    var subNorm = normalizeTonyText(sub);
    var isGenerale = subNorm === normalizeTonyText(openField);
    var isRow = rowSubs.some(function (x) { return normalizeTonyText(x) === subNorm; });
    if (terrenoHasFilari && isGenerale) return rowSubs[0];
    if (!terrenoHasFilari && isRow) return openField;
    return sub;
  }

  function chooseSingleActiveByType(list, tipo) {
    if (!Array.isArray(list)) return '';
    var hasTipoField = list.some(function (m) { return m && m.tipoMacchina; });
    var active = list.filter(function (m) {
      if (!m) return false;
      if ((m.stato || '') === 'dismesso') return false;
      if (hasTipoField) return m.tipoMacchina === tipo;
      return true;
    });
    return active.length === 1 ? String(active[0].nome || active[0].id || '') : '';
  }

  function getTonyLastUserMessage() {
    try { return String(sessionStorage.getItem('tony_last_user_message') || '').trim(); } catch (e) { return ''; }
  }

  /** True se il messaggio utente nomina un trattore (parola o nome da anagrafica). */
  function userMentionedTrattoreInMessage(userText, trList) {
    if (!userText) return false;
    var t = normalizeTonyText(userText);
    if (/\btrattr/i.test(t)) return true;
    if (!Array.isArray(trList)) return false;
    for (var i = 0; i < trList.length; i++) {
      var nome = normalizeTonyText(trList[i].nome || '');
      if (nome.length >= 4 && t.indexOf(nome) >= 0) return true;
      var tokens = nome.split(/\s+/).filter(function (w) { return w.length >= 4; });
      for (var j = 0; j < tokens.length; j++) {
        if (t.indexOf(tokens[j]) >= 0) return true;
      }
    }
    return false;
  }

  /**
   * Rimuove lavoro-trattore se l'utente non l'ha indicato e ci sono più trattori compatibili
   * (es. Gemini/CF che «inventa» Agrifull con Agrifull + Nuovo T5 entrambi validi per l'erpice).
   * @returns {Object} formData (mutato)
   */
  function buildAttrezzoDisambiguationPayload(candidati, tipoVis) {
    var lab = (candidati || []).slice(0, 8).map(function (a) {
      return String((a.nome || a.id || '')).trim();
    }).filter(Boolean);
    var tipoStr = String(tipoVis || '').trim() || 'questa lavorazione';
    return {
      message: 'Per **' + tipoStr + '** ci sono più **attrezzi** compatibili: ' + lab.join(', ') +
        (candidati.length > 8 ? '…' : '') +
        '.\n\nIndica quale usare (nome esatto) così compilo **lavoro-attrezzo**.',
      voiceText: 'Ci sono più attrezzi compatibili. Quale vuoi usare?',
      formId: 'lavoro-form',
      field: 'lavoro-attrezzo',
      candidati: (candidati || []).map(function (c) {
        return { id: String((c && c.id) || ''), nome: String((c && c.nome) || '') };
      })
    };
  }

  function buildTrattoreDisambiguationPayload(candidati, attKnown) {
    var minCvL = attKnown && attKnown.cavalliMinimiRichiesti;
    var minStrL = (minCvL != null && minCvL !== '' && Number(minCvL) > 0) ? String(minCvL) : '';
    var labCvL = labelsFromTrattoriRecords(candidati, 8);
    return {
      message: 'Con l’**attrezzo** indicato ci sono più **trattori** compatibili' +
        (minStrL ? ' (richiesti almeno **' + minStrL + '** CV)' : '') + ': ' + labCvL.join(', ') +
        (candidati.length > 8 ? '…' : '') +
        '.\n\nQuale trattore **vuoi usare** per questo lavoro? (nome come in elenco) così compilo **lavoro-trattore**.',
      voiceText: 'Ci sono più trattori compatibili. Quale vuoi usare?',
      formId: 'lavoro-form',
      field: 'lavoro-trattore',
      candidati: (candidati || []).map(function (c) {
        return { id: String((c && c.id) || ''), nome: String((c && c.nome) || '') };
      })
    };
  }

  function sanitizeUndeclaredLavoroMacchine(formData, opts) {
    opts = opts || {};
    if (!formData || typeof formData !== 'object') return formData;
    var userText = opts.userMessage || getTonyLastUserMessage();
    var trList = (window.lavoriState && window.lavoriState.trattoriList) || [];
    var atList = (window.lavoriState && window.lavoriState.attrezziList) || [];

    if (!formData['lavoro-trattore'] || userMentionedTrattoreInMessage(userText, trList)) {
      return formData;
    }

    var attKnown = resolveAttrezzoFromState(formData['lavoro-attrezzo'], atList);
    if (!attKnown && inferRequiresMachineFromTipo(formData['lavoro-tipo-lavoro'])) {
      var inferredAtt = inferAttrezziFromTipoInState(formData['lavoro-tipo-lavoro'], atList);
      if (inferredAtt.length === 1) attKnown = inferredAtt[0];
    }

    var candidati = attKnown
      ? trattoriCompatibiliCv(macchineListSoloTrattori(trList), attKnown)
      : macchineListSoloTrattori(trList);

    if (candidati.length > 1) {
      delete formData['lavoro-trattore'];
      // Attrezzo nel form dipende dal trattore selezionato (dropdown vuoto finché non c'è trattore)
      delete formData['lavoro-attrezzo'];
      if (formData['lavoro-operatore-macchina'] && formData['lavoro-operaio'] &&
          String(formData['lavoro-operatore-macchina']) === String(formData['lavoro-operaio'])) {
        delete formData['lavoro-operatore-macchina'];
      }
      window.__tonyPendingLavoroTrattoreDisamb = buildTrattoreDisambiguationPayload(candidati, attKnown);
      log('Policy lavoro: rimosso lavoro-trattore non dichiarato (' + candidati.length + ' trattori compatibili, chiedo all\'utente)');
    } else if (candidati.length === 1) {
      var wantId = String(candidati[0].id || '').trim();
      var wantNome = String(candidati[0].nome || candidati[0].id || '').trim();
      var cur = String(formData['lavoro-trattore'] || '').trim();
      var curLow = normalizeTonyText(cur);
      var ok = (wantId && cur === wantId) ||
        normalizeTonyText(wantNome) === curLow ||
        (curLow && normalizeTonyText(wantNome).indexOf(curLow) >= 0);
      if (!ok) {
        formData['lavoro-trattore'] = wantNome;
        log('Policy lavoro: corretto trattore → unico compatibile CV: ' + wantNome);
      }
    }
    return formData;
  }

  function emitPendingLavoroTrattoreDisambiguation() {
    var pending = window.__tonyPendingLavoroTrattoreDisamb;
    if (!pending) return false;
    window.__tonyPendingLavoroTrattoreDisamb = null;
    postTonyMacchineDisambiguation(pending);
    log('Disambiguazione trattore emessa (pending post-inject)');
    return true;
  }

  /** Keyword attrezzo da nome tipo lavoro (minuscolo). */
  function keywordAttrezzoFromTipoNomeLower(tipoNomeLower) {
    var tn = tipoNomeLower || '';
    if (tn.indexOf('pre-potatur') >= 0 || (tn.indexOf('potatur') >= 0 && tn.indexOf('meccanic') >= 0)) return 'potatric';
    if (tn.indexOf('trinciatur') >= 0) return 'trincia';
    if (tn.indexOf('erpicatur') >= 0) return 'erpice';
    if (tn.indexOf('fresatur') >= 0) return 'fresa';
    if (tn.indexOf('vangatur') >= 0) return 'vanga';
    if (tn.indexOf('ripasso') >= 0) return 'ripasso';
    return '';
  }

  function elencoOptionLabels(options, max) {
    max = max || 8;
    return Array.from(options).filter(function (o) { return o && o.value; }).slice(0, max).map(function (o) {
      return String((o.text || o.value || '')).trim();
    }).filter(Boolean);
  }

  function plainTonyMacchineText(s) {
    return String(s || '').replace(/\*\*/g, '');
  }

  var __tonyMacchineDisambGuard = { k: '', t: 0 };

  function macchineDisambiguationRecentlyAsked(field) {
    if (!window.__tonyMacchineDisambAskedAt) return false;
    if (Date.now() - window.__tonyMacchineDisambAskedAt > 120000) return false;
    if (field && window.__tonyLastMacchineDisambField !== field) return false;
    return true;
  }

  function shouldSkipMacchineDisambiguationReask(field) {
    if (!macchineDisambiguationRecentlyAsked(field)) return false;
    if (field === 'lavoro-trattore' && lavoroSelectIsEmpty('lavoro-trattore')) return true;
    if (field === 'lavoro-attrezzo' && lavoroSelectIsEmpty('lavoro-attrezzo')) return true;
    return false;
  }

  function postTonyMacchineDisambiguation(payload) {
    try {
      var msg = payload && payload.message;
      if (!msg || typeof msg !== 'string') return;
      var field = (payload && payload.field) ? String(payload.field) : '';
      if (shouldSkipMacchineDisambiguationReask(field)) {
        log('postTonyMacchineDisambiguation: skip re-ask recente per ' + field);
        return;
      }
      msg = plainTonyMacchineText(msg);
      var sig = String(payload.formId || '') + '|' + field + '|' + msg.slice(0, 160);
      var now = Date.now();
      if (__tonyMacchineDisambGuard.k === sig && now - __tonyMacchineDisambGuard.t < 2500) return;
      __tonyMacchineDisambGuard = { k: sig, t: now };
      window.__tonyMacchineDisambAskedAt = now;
      window.__tonyLastMacchineDisambField = field;
      if (field === 'lavoro-trattore' && payload.candidati && payload.candidati.length) {
        window.__tonyMacchineDisambTrattoriCandidati = payload.candidati.slice();
      }
      if (field === 'lavoro-attrezzo' && payload.candidati && payload.candidati.length) {
        window.__tonyMacchineDisambAttrezziCandidati = payload.candidati.slice();
      }
      window.dispatchEvent(new CustomEvent('tony-macchine-disambiguation', {
        detail: Object.assign({}, payload, { message: msg })
      }));
    } catch (e) {
      log('postTonyMacchineDisambiguation: ' + e);
    }
  }

  /**
   * Dopo change cliente, loadTerreniCliente() è async. Attende ≥2 option (placeholder + terreno) oppure
   * solo placeholder stabilo dopo 6s+0.5s (cliente senza terreni). Max 12s.
   * Stesso spirito di attesa dropdown del modal Gestione Lavori prima della prima INJECT.
   */
  function waitForPreventivoTerrenoSelectHydrated(maxMs) {
    maxMs = maxMs || 12000;
    var t0 = Date.now();
    var lastN = -1;
    var stableOneSince = null;
    return new Promise(function (resolve) {
      var iv = setInterval(function () {
        var el = document.getElementById('terreno-id');
        var n = el && el.options ? el.options.length : 0;
        var elapsed = Date.now() - t0;
        if (n >= 2) {
          clearInterval(iv);
          resolve();
          return;
        }
        if (elapsed >= 6000 && n <= 1) {
          if (lastN === n) {
            if (!stableOneSince) stableOneSince = Date.now();
            else if (Date.now() - stableOneSince >= 500) {
              clearInterval(iv);
              resolve();
              return;
            }
          } else {
            stableOneSince = null;
          }
        }
        lastN = n;
        if (elapsed > maxMs) {
          clearInterval(iv);
          resolve();
        }
      }, 100);
    });
  }

  function waitForSelectOptionValue(selectId, optionValue, maxMs) {
    maxMs = maxMs || 10000;
    var want = String(optionValue || '').trim();
    if (!want) return Promise.resolve();
    var el = document.getElementById(selectId);
    if (!el || el.tagName !== 'SELECT') return Promise.resolve();
    function hasOption() {
      if (!el || !el.options) return false;
      for (var o = 0; o < el.options.length; o++) {
        if ((el.options[o].value || '') === want) return true;
      }
      return false;
    }
    if (hasOption()) return Promise.resolve();
    return new Promise(function (resolve) {
      var start = Date.now();
      var iv = setInterval(function () {
        if (hasOption() || Date.now() - start > maxMs) {
          clearInterval(iv);
          resolve();
        }
      }, 100);
    });
  }

  /** Attende che esista un'option con value o testo visibile corrispondente (es. sottocategoria «Tra le File»). */
  function waitForSelectOptionTextOrValue(selectId, textOrValue, maxMs) {
    maxMs = maxMs || 12000;
    var want = String(textOrValue || '').trim();
    if (!want) return Promise.resolve();
    var el = document.getElementById(selectId);
    if (!el || el.tagName !== 'SELECT') return Promise.resolve();
    var wantLow = want.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    function hasMatch() {
      if (!el || !el.options) return false;
      for (var o = 0; o < el.options.length; o++) {
        var opt = el.options[o];
        if (!(opt.value || '').trim()) continue;
        var v = String(opt.value || '').trim();
        var t = String(opt.text || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (v === want) return true;
        if (t && (t === wantLow || t.indexOf(wantLow) >= 0 || wantLow.indexOf(t) >= 0)) return true;
      }
      return false;
    }
    if (hasMatch()) return Promise.resolve();
    return new Promise(function (resolve) {
      var start = Date.now();
      var iv = setInterval(function () {
        if (hasMatch() || Date.now() - start > maxMs) {
          clearInterval(iv);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Attende opzioni con value non vuoto e non disabled (es. lavoro-attrezzo dopo populate da change trattore).
   * Evita che waitForSelectOptions(2) si soddisfi con due placeholder a value "".
   */
  function waitForSelectOptionsWithValue(selectId, minCount, maxMs) {
    minCount = minCount || 1;
    maxMs = maxMs == null ? 12000 : maxMs;
    var el = document.getElementById(selectId);
    if (!el || el.tagName !== 'SELECT') return Promise.resolve();
    function countWithValue() {
      var n = 0;
      var opts = el.options || [];
      for (var i = 0; i < opts.length; i++) {
        var o = opts[i];
        if ((o.value || '') !== '' && !o.disabled) n++;
      }
      return n;
    }
    if (countWithValue() >= minCount) return Promise.resolve();
    return new Promise(function (resolve) {
      var start = Date.now();
      var iv = setInterval(function () {
        if (countWithValue() >= minCount || Date.now() - start > maxMs) {
          clearInterval(iv);
          resolve();
        }
      }, 80);
    });
  }

  function lavoroSelectIsEmpty(selectId) {
    return !lavoroSelectHasChoice(selectId);
  }

  function lavoroSelectHasChoice(selectId) {
    var el = document.getElementById(selectId);
    if (!el || el.tagName !== 'SELECT') return false;
    if (el.selectedIndex > 0 && String(el.value || '').trim() !== '') return true;
    if (el.selectedIndex >= 0 && el.options && el.options[el.selectedIndex]) {
      var txt = String(el.options[el.selectedIndex].text || '').trim();
      if (txt && !/^--\s|seleziona/i.test(txt)) return true;
    }
    return false;
  }

  function getLavoroTipoDomText() {
    if (!lavoroSelectHasChoice('lavoro-tipo-lavoro')) return '';
    var el = document.getElementById('lavoro-tipo-lavoro');
    if (!el || el.tagName !== 'SELECT') return '';
    if (el.selectedIndex >= 0 && el.options[el.selectedIndex]) {
      return String(el.options[el.selectedIndex].text || el.value || '').trim();
    }
    return String(el.value || '').trim();
  }

  function lavoroTipoIsChosen() {
    return lavoroSelectHasChoice('lavoro-tipo-lavoro');
  }

  var LOV_INTERVIEW_USER_FIELDS = [
    'lavoro-operaio', 'lavoro-caposquadra', 'lavoro-terreno', 'lavoro-tipo-lavoro',
    'lavoro-nome', 'lavoro-data-inizio', 'lavoro-durata'
  ];

  var DELAYS_LAVORO_INTERVIEW = {
    'lavoro-terreno': 120,
    'lavoro-categoria-principale': 80,
    'lavoro-sottocategoria': 120,
    'lavoro-tipo-lavoro': 80,
    'lavoro-trattore': 100,
    'tipo-assegnazione': 50
  };

  function isLavoroInterviewSimplePatch(patch) {
    if (!patch || typeof patch !== 'object') return false;
    var keys = Object.keys(patch);
    if (!keys.length) return false;
    var cascadeKeys = ['lavoro-terreno', 'lavoro-tipo-lavoro', 'lavoro-categoria-principale', 'lavoro-sottocategoria'];
    for (var i = 0; i < keys.length; i++) {
      if (cascadeKeys.indexOf(keys[i]) >= 0) return false;
    }
    return true;
  }

  async function injectLavoroInterviewSimplePatch(patch, context) {
    var mapConfig = {
      formId: 'lavoro-form',
      modalId: 'lavoro-modal',
      injectionOrder: INJECTION_ORDER_LAVORO,
      delays: DELAYS_LAVORO_INTERVIEW,
      resolver: resolveValueLavoro
    };
    context = context || (window.Tony && window.Tony.context) || {};
    applyBusinessRules(patch, 'lavoro-form');
    var order = ['tipo-assegnazione', 'lavoro-operaio', 'lavoro-caposquadra', 'lavoro-operatore-macchina',
      'lavoro-stato', 'lavoro-data-inizio', 'lavoro-durata', 'lavoro-nome'];
    for (var i = 0; i < order.length; i++) {
      var fid = order[i];
      if (patch[fid] === undefined || patch[fid] === null) continue;
      setFieldValue(fid, patch[fid], mapConfig, context);
      if (fid === 'tipo-assegnazione') await delay(80);
    }
    return true;
  }

  /** Attende che lavoriState esponga liste macchine (populate async dopo nav Tony → Gestione Lavori). */
  function waitForLavoriStateList(stateKey, minLen, maxMs) {
    minLen = minLen || 1;
    maxMs = maxMs == null ? 12000 : maxMs;
    return new Promise(function (resolve) {
      var start = Date.now();
      var iv = setInterval(function () {
        var st = window.lavoriState;
        var list = st && Array.isArray(st[stateKey]) ? st[stateKey] : [];
        if (list.length >= minLen || Date.now() - start > maxMs) {
          clearInterval(iv);
          resolve(list.length >= minLen);
        }
      }, 100);
    });
  }

  function isLavoriFormDataReady() {
    if (window.__lavoriFormDataReady) {
      var stReady = window.lavoriState;
      if (stReady && stReady.hasManodoperaModule &&
          !(Array.isArray(stReady.operaiList) && stReady.operaiList.length > 0)) {
        return false;
      }
      return true;
    }
    var st = window.lavoriState;
    if (!st) return false;
    if (!(Array.isArray(st.terreniList) && st.terreniList.length > 0)) return false;
    if (!(Array.isArray(st.tipiLavoroList) && st.tipiLavoroList.length > 0)) return false;
    if (!(Array.isArray(st.categorieLavoriPrincipali) && st.categorieLavoriPrincipali.length > 0)) return false;
    if (st.hasManodoperaModule && !(Array.isArray(st.operaiList) && st.operaiList.length > 0)) return false;
    if (st.hasParcoMacchineModule) {
      if (!(Array.isArray(st.trattoriList) && st.trattoriList.length > 0)) return false;
      if (!(Array.isArray(st.attrezziList) && st.attrezziList.length > 0)) return false;
    }
    return true;
  }

  function lavoriMacchineListsReady() {
    var st = window.lavoriState;
    return !!(st && Array.isArray(st.trattoriList) && st.trattoriList.length > 0 &&
      Array.isArray(st.attrezziList) && st.attrezziList.length > 0);
  }

  function inferAttrezziFromTipoInState(tipoNome, atListCv) {
    var searchAttrezzo = keywordAttrezzoFromTipoNomeLower((tipoNome || '').toLowerCase());
    if (!searchAttrezzo || !Array.isArray(atListCv)) return [];
    return macchineListSoloAttrezzi(atListCv).filter(function (a) {
      if (!a || (a.stato || '') === 'dismesso') return false;
      var n = normalizeTonyText(a.nome || '');
      return n && n.indexOf(searchAttrezzo) >= 0;
    });
  }

  function buildFormDataFromLavoroDom() {
    var fd = {};
    var tipoEl = document.getElementById('lavoro-tipo-lavoro');
    if (tipoEl && tipoEl.value) fd['lavoro-tipo-lavoro'] = tipoEl.value;
    var trEl = document.getElementById('lavoro-trattore');
    if (trEl && trEl.value) fd['lavoro-trattore'] = trEl.value;
    var atEl = document.getElementById('lavoro-attrezzo');
    if (atEl && atEl.value) fd['lavoro-attrezzo'] = atEl.value;
    return fd;
  }

  function waitForLavoriManodoperaReady(maxMs) {
    maxMs = maxMs == null ? 8000 : maxMs;
    var st = window.lavoriState;
    if (!st || !st.hasManodoperaModule) return Promise.resolve(true);
    if (Array.isArray(st.operaiList) && st.operaiList.length > 0) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var done = false;
      function finish(ok) {
        if (done) return;
        done = true;
        window.removeEventListener('lavori-form-data-ready', onReady);
        clearInterval(iv);
        resolve(!!ok);
      }
      function readyNow() {
        var s = window.lavoriState;
        return !!(s && Array.isArray(s.operaiList) && s.operaiList.length > 0);
      }
      function onReady() { finish(readyNow()); }
      window.addEventListener('lavori-form-data-ready', onReady);
      var start = Date.now();
      var iv = setInterval(function () {
        if (readyNow()) finish(true);
        else if (Date.now() - start >= maxMs) finish(false);
      }, 120);
    });
  }

  /** Gate inject Tony: terreni/categorie/tipi pronti (evento da gestione-lavori, prima di loadLavori). */
  function waitForLavoriFormDataReady(maxMs) {
    maxMs = maxMs == null ? 15000 : maxMs;
    if (isLavoriFormDataReady()) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var done = false;
      function finish(ok) {
        if (done) return;
        done = true;
        window.removeEventListener('lavori-form-data-ready', onReady);
        clearInterval(iv);
        resolve(!!ok);
      }
      function onReady() { finish(isLavoriFormDataReady()); }
      window.addEventListener('lavori-form-data-ready', onReady);
      var start = Date.now();
      var iv = setInterval(function () {
        if (isLavoriFormDataReady()) finish(true);
        else if (Date.now() - start > maxMs) finish(false);
      }, 40);
    });
  }

  function lavoroSelectWaitMs(injectOpts, fallback) {
    if (injectOpts && injectOpts.selectWaitMs != null) return injectOpts.selectWaitMs;
    return fallback == null ? 8000 : fallback;
  }

  /**
   * Inietta trattore/attrezzo quando hint presente e select ancora vuoto.
   * Attende hydration liste + opzioni dropdown (evita race post OPEN_MODAL).
   */
  async function injectLavoroMacchinaFieldFromHint(fieldId, rawHint, mapConfig, context) {
    if (!rawHint || String(rawHint).trim() === '') return false;
    var want = String(rawHint).trim();
    if (typeof mapConfig.resolver === 'function') {
      var resolvedHint = mapConfig.resolver(fieldId, want, context);
      if (resolvedHint != null && String(resolvedHint).trim() !== '') want = String(resolvedHint).trim();
    }
    if (fieldId === 'lavoro-trattore') {
      await waitForLavoriStateList('trattoriList', 1, 14000);
      await waitForSelectOptionsWithValue('lavoro-trattore', 1, 14000);
    } else if (fieldId === 'lavoro-attrezzo') {
      var trElPrep = document.getElementById('lavoro-trattore');
      if (trElPrep && trElPrep.value) {
        trElPrep.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(150);
      }
      await waitForLavoriStateList('attrezziList', 1, 14000);
      await waitForSelectOptionsWithValue('lavoro-attrezzo', 1, 14000);
    }
    if (looksLikeFirestoreDocId(want)) {
      await waitForSelectOptionValue(fieldId, want, 14000);
    } else {
      await waitForSelectOptionTextOrValue(fieldId, want, 14000);
    }
    setFieldValue(fieldId, want, mapConfig, context);
    var el = document.getElementById(fieldId);
    var ok = el && el.value && String(el.value).trim() !== '';
    if (ok && fieldId === 'lavoro-trattore') {
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await delay(400);
    }
    if (ok) log('Macchina iniettata (' + fieldId + ') = "' + want + '"');
    return !!ok;
  }

  /**
   * True se lavoro-trattore è già in DOM o in formData (hint inject imminente).
   * Usato per non chiedere disamb. attrezzo da tipo lavoro prima della scelta trattore.
   */
  function lavoroTrattoreValorizzato(formData) {
    if (!lavoroSelectIsEmpty('lavoro-trattore')) return true;
    return !!(formData && formData['lavoro-trattore'] && String(formData['lavoro-trattore']).trim());
  }

  /**
   * Chiede disamb. attrezzo inferito da tipo solo se l'utente ha già indicato l'attrezzo
   * (hasAtHint) oppure se il trattore è noto — altrimenti prima trattore, poi attrezzo.
   */
  function shouldAskAttrezzoDisambigFromTipo(inferredCount, hasAtHint, formData) {
    if (inferredCount <= 1) return false;
    if (hasAtHint) return true;
    return lavoroTrattoreValorizzato(formData);
  }

  /**
   * Disambiguazione / auto-fill macchine da lavoriState (no attesa dropdown DOM).
   * @returns {Promise<{resolved: boolean, asked: boolean}>}
   */
  async function resolveLavoroMacchineFromState(formData, mapConfig, context) {
    var result = { resolved: false, asked: false };
    var needsMacchine = inferRequiresMachineFromTipo(formData['lavoro-tipo-lavoro'] || '');
    var hasTrHint = !!(formData['lavoro-trattore'] && String(formData['lavoro-trattore']).trim());
    var hasAtHint = !!(formData['lavoro-attrezzo'] && String(formData['lavoro-attrezzo']).trim());
    if (!needsMacchine && !hasTrHint && !hasAtHint) return result;

    var trListCv = (window.lavoriState && window.lavoriState.trattoriList) || [];
    var atListCv = (window.lavoriState && window.lavoriState.attrezziList) || [];
    if (!trListCv.length || !atListCv.length) return result;

    if (!lavoroSelectIsEmpty('lavoro-trattore') && !lavoroSelectIsEmpty('lavoro-attrezzo')) {
      result.resolved = true;
      return result;
    }

    var attKnown = resolveAttrezzoFromState(formData['lavoro-attrezzo'], atListCv);
    if (!attKnown && needsMacchine && !hasAtHint) {
      var inferredAtt = inferAttrezziFromTipoInState(formData['lavoro-tipo-lavoro'], atListCv);
      if (inferredAtt.length === 1) {
        attKnown = inferredAtt[0];
        formData['lavoro-attrezzo'] = String((attKnown.nome || attKnown.id || '')).trim();
        log('Lavoro: attrezzo unico inferito da tipo → ' + formData['lavoro-attrezzo']);
      } else if (shouldAskAttrezzoDisambigFromTipo(inferredAtt.length, hasAtHint, formData)) {
        var inferredAsk = inferredAtt;
        var trForAsk = resolveTrattoreRecordFromLavoroDom();
        if (trForAsk) inferredAsk = attrezziCompatibiliConTrattoreCv(trForAsk, inferredAsk);
        if (inferredAsk.length === 1) {
          attKnown = inferredAsk[0];
          formData['lavoro-attrezzo'] = String((attKnown.nome || attKnown.id || '')).trim();
          log('Lavoro: attrezzo unico compatibile CV con trattore → ' + formData['lavoro-attrezzo']);
        } else if (inferredAsk.length === 0 && trForAsk) {
          log('Lavoro: nessun attrezzo compatibile CV con trattore scelto');
        } else if (inferredAsk.length > 1) {
        if (shouldSkipMacchineDisambiguationReask('lavoro-attrezzo')) {
          result.asked = true;
          return result;
        }
        postTonyMacchineDisambiguation(buildAttrezzoDisambiguationPayload(
          inferredAsk,
          String(formData['lavoro-tipo-lavoro'] || '').trim() || 'questa lavorazione'
        ));
        result.asked = true;
        return result;
        }
      } else if (inferredAtt.length > 1) {
        log('Lavoro: ' + inferredAtt.length + ' attrezzi da tipo — disamb. attrezzo differita finché non c\'è trattore');
      }
    }

    if (hasTrHint && lavoroSelectIsEmpty('lavoro-trattore')) {
      var trOk = await injectLavoroMacchinaFieldFromHint('lavoro-trattore', formData['lavoro-trattore'], mapConfig, context);
      if (trOk) {
        log('Lavoro: lavoro-trattore iniettato da hint (state-first)');
        if (!lavoroSelectIsEmpty('lavoro-attrezzo')) result.resolved = true;
      }
    }

    if (hasAtHint && lavoroSelectIsEmpty('lavoro-attrezzo')) {
      var atOk = await injectLavoroMacchinaFieldFromHint('lavoro-attrezzo', formData['lavoro-attrezzo'], mapConfig, context);
      if (atOk) log('Lavoro: lavoro-attrezzo iniettato da hint (state-first)');
    }

    if (needsMacchine && lavoroSelectIsEmpty('lavoro-trattore')) {
      attKnown = resolveAttrezzoFromState(formData['lavoro-attrezzo'], atListCv) || attKnown;
      if (!attKnown && !hasAtHint) {
        var inferredForTr = inferAttrezziFromTipoInState(formData['lavoro-tipo-lavoro'], atListCv);
        if (inferredForTr.length === 1) attKnown = inferredForTr[0];
      }
      var candidatiTr = attKnown ? trattoriCompatibiliCv(macchineListSoloTrattori(trListCv), attKnown) : null;
      if (candidatiTr != null) {
        if (candidatiTr.length === 1) {
          formData['lavoro-trattore'] = String((candidatiTr[0].nome || candidatiTr[0].id || '')).trim();
          await injectLavoroMacchinaFieldFromHint('lavoro-trattore', formData['lavoro-trattore'], mapConfig, context);
          log('Lavoro: trattore unico compatibile (CV) con attrezzo noto → impostato');
        } else if (candidatiTr.length > 1) {
          if (shouldSkipMacchineDisambiguationReask('lavoro-trattore')) {
            result.asked = true;
            return result;
          }
          postTonyMacchineDisambiguation(buildTrattoreDisambiguationPayload(candidatiTr, attKnown));
          result.asked = true;
          return result;
        } else if (attKnown) {
          var attNomeL = String((attKnown.nome || attKnown.id || 'attrezzo')).trim();
          var minN0 = Number(attKnown.cavalliMinimiRichiesti);
          var hasMinL = Number.isFinite(minN0) && minN0 > 0;
          postTonyMacchineDisambiguation({
            message: hasMinL
              ? '**Nessun trattore** ha potenza sufficiente per **' + attNomeL + '** (servono almeno **' + String(minN0) + '** CV). Verifica i dati in anagrafica o indica un altro attrezzo.'
              : '**Nessun trattore** attivo disponibile per **' + attNomeL + '**. Verifica l’anagrafica macchine.',
            voiceText: hasMinL
              ? 'Nessun trattore con CV sufficienti per questo attrezzo.'
              : 'Nessun trattore disponibile.',
            formId: 'lavoro-form',
            field: 'lavoro-trattore'
          });
          result.asked = true;
          return result;
        }
      } else {
        var trAttivi = macchineListSoloTrattori(trListCv);
        if (trAttivi.length === 1) {
          formData['lavoro-trattore'] = String((trAttivi[0].nome || trAttivi[0].id || '')).trim();
          await injectLavoroMacchinaFieldFromHint('lavoro-trattore', formData['lavoro-trattore'], mapConfig, context);
          log('Lavoro: trattore unico in anagrafica → impostato automaticamente');
        } else if (trAttivi.length > 1) {
          var labTrSt = labelsFromTrattoriRecords(trAttivi, 8);
          postTonyMacchineDisambiguation({
            message: 'Ci sono più **trattori** disponibili: ' + labTrSt.join(', ') + (trAttivi.length > 8 ? '…' : '') +
              '.\n\nQuale **vuoi usare** per questo lavoro? (nome come in elenco) così compilo **lavoro-trattore**; poi scegliamo l’attrezzo se serve.',
            voiceText: 'Ci sono più trattori. Quale vuoi usare?',
            formId: 'lavoro-form',
            field: 'lavoro-trattore'
          });
          result.asked = true;
          return result;
        }
      }
    }

    var trElDom = document.getElementById('lavoro-trattore');
    var trattoreNomeEff = formData['lavoro-trattore'] || (trElDom && trElDom.selectedOptions[0] ? (trElDom.selectedOptions[0].text || trElDom.value) : '');
    if (String(trattoreNomeEff || '').trim() !== '' && lavoroSelectIsEmpty('lavoro-attrezzo') && !formData['lavoro-attrezzo']) {
      var tipoNomeLow = (formData['lavoro-tipo-lavoro'] || '').toLowerCase();
      var searchAttrezzo = keywordAttrezzoFromTipoNomeLower(tipoNomeLow);
      if (searchAttrezzo) {
        var attMatchesSt = inferAttrezziFromTipoInState(formData['lavoro-tipo-lavoro'], atListCv);
        var trRecordSt = resolveTrattoreRecordFromLavoroDom();
        if (trRecordSt) attMatchesSt = attrezziCompatibiliConTrattoreCv(trRecordSt, attMatchesSt);
        if (attMatchesSt.length === 1) {
          formData['lavoro-attrezzo'] = String((attMatchesSt[0].nome || attMatchesSt[0].id || '')).trim();
          await injectLavoroMacchinaFieldFromHint('lavoro-attrezzo', formData['lavoro-attrezzo'], mapConfig, context);
          log('Inferito attrezzo da tipo lavoro (state, unico match): ' + formData['lavoro-attrezzo']);
        } else if (attMatchesSt.length > 1) {
          if (shouldSkipMacchineDisambiguationReask('lavoro-attrezzo')) {
            result.asked = true;
            return result;
          }
          postTonyMacchineDisambiguation(buildAttrezzoDisambiguationPayload(
            attMatchesSt,
            String(formData['lavoro-tipo-lavoro'] || '').trim() || 'questa lavorazione'
          ));
          result.asked = true;
          return result;
        }
      }
    }

    if (!lavoroSelectIsEmpty('lavoro-trattore') && !lavoroSelectIsEmpty('lavoro-attrezzo')) {
      result.resolved = true;
    }
    return result;
  }

  /**
   * Prompt proattivo macchine (timer Tony) — client-side, no round-trip CF.
   * @returns {Promise<{resolved: boolean, asked: boolean}>}
   */
  async function promptLavoroMacchineMissing(formData, context) {
    if (emitPendingLavoroTrattoreDisambiguation()) {
      return { resolved: false, asked: true };
    }
    formData = formData && typeof formData === 'object' ? Object.assign({}, formData) : buildFormDataFromLavoroDom();
    context = context || (window.Tony && window.Tony.context) || {};
    var mapConfig = {
      formId: 'lavoro-form',
      modalId: 'lavoro-modal',
      injectionOrder: INJECTION_ORDER_LAVORO,
      delays: DELAYS_LAVORO,
      resolver: resolveValueLavoro
    };
    if (!lavoriMacchineListsReady()) {
      await waitForLavoriStateList('trattoriList', 1, 2500);
      await waitForLavoriStateList('attrezziList', 1, 2500);
    }
    return resolveLavoroMacchineFromState(formData, mapConfig, context);
  }

  function dedupeTrattoriRecords(list) {
    var seen = {};
    return (list || []).filter(function (tr) {
      if (!tr) return false;
      var id = String(tr.id || tr.nome || '');
      if (seen[id]) return false;
      seen[id] = 1;
      return true;
    });
  }

  function findTrattoreInUserText(userText, trList) {
    if (!userText || !Array.isArray(trList) || !trList.length) return null;
    var t = normalizeTonyText(userText);
    if (!t) return null;
    var matches = [];
    for (var i = 0; i < trList.length; i++) {
      var tr = trList[i];
      if (!tr) continue;
      var nome = normalizeTonyText(tr.nome || '');
      if (nome.length >= 3 && t.indexOf(nome) >= 0) {
        matches.push(tr);
        continue;
      }
      var tokens = nome.split(/\s+/).filter(function (w) { return w.length >= 3; });
      for (var j = 0; j < tokens.length; j++) {
        if (t.indexOf(tokens[j]) >= 0) {
          matches.push(tr);
          break;
        }
      }
    }
    matches = dedupeTrattoriRecords(matches);
    if (matches.length === 1) return matches[0];

    if (t.length >= 2 && t.length <= 16) {
      var shortMatches = [];
      var tCompact = t.replace(/\s+/g, '');
      for (var k = 0; k < trList.length; k++) {
        var tr2 = trList[k];
        if (!tr2) continue;
        var n2 = normalizeTonyText(tr2.nome || '');
        if (!n2) continue;
        if (n2.indexOf(t) >= 0) {
          shortMatches.push(tr2);
          continue;
        }
        var nCompact = n2.replace(/\s+/g, '');
        if (tCompact && nCompact.indexOf(tCompact) >= 0) shortMatches.push(tr2);
      }
      shortMatches = dedupeTrattoriRecords(shortMatches);
      if (shortMatches.length === 1) return shortMatches[0];
      if (shortMatches.length > 1) matches = matches.concat(shortMatches);
    }

    matches = dedupeTrattoriRecords(matches);
    if (matches.length === 1) return matches[0];
    var exact = matches.filter(function (tr) {
      var n = normalizeTonyText(tr.nome || '');
      return t === n || (n.length >= 4 && t.indexOf(n) >= 0);
    });
    return exact.length === 1 ? exact[0] : null;
  }

  function dedupeAttrezziRecords(list) {
    var seen = {};
    return (list || []).filter(function (at) {
      if (!at) return false;
      var id = String(at.id || at.nome || '');
      if (seen[id]) return false;
      seen[id] = 1;
      return true;
    });
  }

  function findAttrezzoInUserText(userText, atList) {
    if (!userText || !Array.isArray(atList) || !atList.length) return null;
    var t = normalizeTonyText(userText);
    if (!t) return null;
    var matches = [];
    for (var i = 0; i < atList.length; i++) {
      var at = atList[i];
      if (!at) continue;
      var nome = normalizeTonyText(at.nome || '');
      if (nome.length >= 3 && t.indexOf(nome) >= 0) {
        matches.push(at);
        continue;
      }
      var tokens = nome.split(/\s+/).filter(function (w) { return w.length >= 2; });
      for (var j = 0; j < tokens.length; j++) {
        if (t.indexOf(tokens[j]) >= 0) {
          matches.push(at);
          break;
        }
      }
    }
    matches = dedupeAttrezziRecords(matches);
    if (matches.length === 1) return matches[0];

    if (t.length >= 2 && t.length <= 24) {
      var shortMatches = [];
      var tCompact = t.replace(/\s+/g, '');
      for (var k = 0; k < atList.length; k++) {
        var at2 = atList[k];
        if (!at2) continue;
        var n2 = normalizeTonyText(at2.nome || '');
        if (!n2) continue;
        if (n2.indexOf(t) >= 0) {
          shortMatches.push(at2);
          continue;
        }
        var nCompact = n2.replace(/\s+/g, '');
        if (tCompact && nCompact.indexOf(tCompact) >= 0) shortMatches.push(at2);
      }
      shortMatches = dedupeAttrezziRecords(shortMatches);
      if (shortMatches.length === 1) return shortMatches[0];
      if (shortMatches.length > 1) matches = matches.concat(shortMatches);
    }

    matches = dedupeAttrezziRecords(matches);
    if (matches.length === 1) return matches[0];

    var userNums = (t.match(/\d+/g) || []).filter(function (d) { return d.length >= 2; });
    if (userNums.length >= 1) {
      var numPool = matches.length > 1 ? matches : atList;
      for (var ni = 0; ni < userNums.length; ni++) {
        var numHits = numPool.filter(function (at) {
          return normalizeTonyText(at.nome || '').indexOf(userNums[ni]) >= 0;
        });
        numHits = dedupeAttrezziRecords(numHits);
        if (numHits.length === 1) return numHits[0];
        if (numHits.length > 0) numPool = numHits;
      }
    }

    var userTokens = t.split(/\s+/).filter(function (w) {
      return w.length >= 2 || /^\d+$/.test(w);
    });
    if (userTokens.length >= 2) {
      var tokenPool = matches.length > 1 ? dedupeAttrezziRecords(matches) : atList;
      var tokenHits = tokenPool.filter(function (at) {
        var nome = normalizeTonyText(at.nome || '');
        return userTokens.every(function (w) { return nome.indexOf(w) >= 0; });
      });
      tokenHits = dedupeAttrezziRecords(tokenHits);
      if (tokenHits.length === 1) return tokenHits[0];
    }

    var exact = matches.filter(function (at) {
      var n = normalizeTonyText(at.nome || '');
      return t === n || (n.length >= 4 && t.indexOf(n) >= 0);
    });
    return exact.length === 1 ? exact[0] : null;
  }

  function trattoriListForMacchineDisambReply() {
    var trList = macchineListSoloTrattori((window.lavoriState && window.lavoriState.trattoriList) || []);
    if (macchineDisambiguationRecentlyAsked('lavoro-trattore') &&
        window.__tonyMacchineDisambTrattoriCandidati &&
        window.__tonyMacchineDisambTrattoriCandidati.length) {
      return window.__tonyMacchineDisambTrattoriCandidati;
    }
    return trList;
  }

  function attrezziListForMacchineDisambReply() {
    var atList = macchineListSoloAttrezzi((window.lavoriState && window.lavoriState.attrezziList) || []);
    if (macchineDisambiguationRecentlyAsked('lavoro-attrezzo') &&
        window.__tonyMacchineDisambAttrezziCandidati &&
        window.__tonyMacchineDisambAttrezziCandidati.length) {
      return window.__tonyMacchineDisambAttrezziCandidati;
    }
    return atList;
  }

  function lavoroTipoNomeFromDom() {
    var tipoEl = document.getElementById('lavoro-tipo-lavoro');
    return (tipoEl && tipoEl.options && tipoEl.options[tipoEl.selectedIndex])
      ? String(tipoEl.options[tipoEl.selectedIndex].text || tipoEl.value || '').trim()
      : '';
  }

  function resolveTrattoreRecordFromLavoroDom() {
    var trEl = document.getElementById('lavoro-trattore');
    if (!trEl || !trEl.value || !String(trEl.value).trim()) return null;
    var val = String(trEl.value).trim();
    var label = (trEl.selectedOptions && trEl.selectedOptions[0])
      ? String(trEl.selectedOptions[0].text || '').trim() : '';
    var trList = macchineListSoloTrattori((window.lavoriState && window.lavoriState.trattoriList) || []);
    for (var i = 0; i < trList.length; i++) {
      var tr = trList[i];
      if (!tr) continue;
      if (String(tr.id || '') === val) return tr;
      if (label && normalizeTonyText(tr.nome || '') === normalizeTonyText(label)) return tr;
    }
    return null;
  }

  async function resolveAttrezzoAfterTrattoreKnown(mapConfig, context) {
    if (!lavoroSelectIsEmpty('lavoro-attrezzo')) return { resolved: true, asked: false };
    var tipoVal = lavoroTipoNomeFromDom();
    var atList = (window.lavoriState && window.lavoriState.attrezziList) || [];
    var inferred = inferAttrezziFromTipoInState(tipoVal, atList);
    var trRecord = resolveTrattoreRecordFromLavoroDom();
    if (trRecord) {
      inferred = attrezziCompatibiliConTrattoreCv(trRecord, inferred);
      if (inferred.length === 0) {
        var cvStr = Number(trRecord.cavalli);
        var cvLabel = Number.isFinite(cvStr) && cvStr > 0 ? String(cvStr) : '?';
        postTonyMacchineDisambiguation({
          message: 'Con **' + String(trRecord.nome || 'trattore').trim() + '** (' + cvLabel +
            ' CV) nessun attrezzo compatibile con la potenza disponibile per **' +
            (String(tipoVal || '').trim() || 'questa lavorazione') +
            '**. Scegli un altro trattore o verifica l’anagrafica macchine.',
          voiceText: 'Nessun attrezzo compatibile con la potenza del trattore scelto.',
          formId: 'lavoro-form',
          field: 'lavoro-trattore'
        });
        return { resolved: false, asked: true };
      }
    }
    if (inferred.length === 1) {
      var ok = await injectLavoroMacchinaFieldFromHint(
        'lavoro-attrezzo',
        String(inferred[0].id || inferred[0].nome || '').trim(),
        mapConfig,
        context
      );
      return { resolved: ok && !lavoroSelectIsEmpty('lavoro-attrezzo'), asked: false };
    }
    if (inferred.length > 1) {
      if (shouldSkipMacchineDisambiguationReask('lavoro-attrezzo')) {
        return { resolved: false, asked: true };
      }
      postTonyMacchineDisambiguation(buildAttrezzoDisambiguationPayload(inferred, tipoVal));
      return { resolved: false, asked: true };
    }
    return { resolved: false, asked: false };
  }

  function markLavoroInterviewMacchineAsked(field) {
    if (!field) return;
    window.__tonyLavoroInterviewAskedMacchineField = field;
    window.__tonyLastMacchineDisambField = field;
    window.__tonyMacchineDisambAskedAt = Date.now();
  }

  function userCanReplyToMacchineDisamb(userText) {
    var modal = document.getElementById('lavoro-modal');
    if (!modal || !modal.classList.contains('active')) return false;
    if (typeof isLavoroTipoCorrectionText === 'function' && isLavoroTipoCorrectionText(userText)) return false;
    var trEl = document.getElementById('lavoro-trattore');
    var atEl = document.getElementById('lavoro-attrezzo');
    if (trEl && trEl.value && atEl && atEl.value) return false;
    var t = String(userText || '').trim();
    if (!t || t.length > 48) return false;
    var trList = trattoriListForMacchineDisambReply();
    var atList = attrezziListForMacchineDisambReply();
    // Fase macchine intervista locale: trattore/attrezzo hanno priorità su altre euristiche.
    if (window.__tonyLavoroCreationFlow && lavoroInterviewCanAskMacchine()) {
      if (lavoroSelectIsEmpty('lavoro-trattore') && findTrattoreInUserText(t, trList)) return true;
      if (!lavoroSelectIsEmpty('lavoro-trattore') && lavoroSelectIsEmpty('lavoro-attrezzo') &&
          findAttrezzoInUserText(t, atList)) return true;
    }
    if (typeof userTextShouldGoToLavoroInterviewNotMacchine === 'function' &&
        userTextShouldGoToLavoroInterviewNotMacchine(userText)) return false;
    var recent = macchineDisambiguationRecentlyAsked('lavoro-trattore');
    var pending = !!(window.__tonyPendingLavoroTrattoreDisamb);
    var interviewTrAsked = window.__tonyLavoroInterviewAskedMacchineField === 'lavoro-trattore' ||
      (window.__tonyLavoroCreationFlow && lavoroInterviewCanAskMacchine() && lavoroSelectIsEmpty('lavoro-trattore'));
    if (lavoroSelectIsEmpty('lavoro-trattore') && findTrattoreInUserText(t, trList)) {
      if (recent || pending || window.__tonyLastMacchineDisambField === 'lavoro-trattore' || interviewTrAsked) return true;
    }
    if (lavoroSelectIsEmpty('lavoro-attrezzo')) {
      var recentAt = macchineDisambiguationRecentlyAsked('lavoro-attrezzo');
      var interviewAtAsked = window.__tonyLavoroInterviewAskedMacchineField === 'lavoro-attrezzo' ||
        (window.__tonyLavoroCreationFlow && lavoroInterviewCanAskMacchine() && !lavoroSelectIsEmpty('lavoro-trattore'));
      if (findAttrezzoInUserText(t, atList)) {
        if (recentAt || window.__tonyLastMacchineDisambField === 'lavoro-attrezzo' || interviewAtAsked) return true;
      }
    }
    return false;
  }

  /**
   * Risposta breve utente a disambiguazione terreno Nuovo Preventivo — client-side, no CF.
   * @returns {Promise<{handled: boolean, message: string, voiceText: string}>}
   */
  async function applyPreventivoTerrenoFromUserReply(userText) {
    var out = { handled: false, message: '', voiceText: '' };
    var text = String(userText || '').trim();
    if (!text || !document.getElementById('preventivo-form')) return out;
    var terEl = document.getElementById('terreno-id');
    if (terEl && String(terEl.value || '').trim()) return out;

    var candidates = [];
    var dis = typeof window !== 'undefined' ? window.__tonyPreventivoTerrenoDisambiguation : null;
    if (dis && Array.isArray(dis.options) && dis.options.length > 1) {
      candidates = dis.options.map(function (o) {
        return { id: o.id, label: o.nome || o.id, nome: o.nome || o.id, coltura: o.coltura || null };
      });
    } else if (terEl && terEl.options.length > 2) {
      for (var i = 0; i < terEl.options.length; i++) {
        var opt = terEl.options[i];
        if (!opt || !opt.value) continue;
        var lbl = String((opt.text || '').split('(')[0]).trim();
        candidates.push({ id: opt.value, label: lbl, nome: lbl });
      }
    }
    if (candidates.length < 2) return out;

    var picked = resolveTerrenoFromDisambReply(text, candidates);
    if (!picked) return out;

    var ctx = (window.Tony && window.Tony.context) || {};
    var terrenoVal = picked.id || picked.label;
    var ok = await injectPreventivoForm({ 'terreno-id': terrenoVal }, ctx);
    if (!ok) return out;
    if (typeof window !== 'undefined') window.__tonyPreventivoTerrenoDisambiguation = null;
    out.handled = true;
    out.message = 'Ok, ho impostato il terreno nel preventivo.';
    out.voiceText = out.message;
    log('applyPreventivoTerrenoFromUserReply: terreno impostato da risposta utente');
    return out;
  }

  /**
   * Risposta breve utente con data prevista (es. «domani») — client-side, no CF.
   * @returns {Promise<{handled: boolean, message: string, voiceText: string}>}
   */
  async function applyPreventivoScheduleFromUserReply(userText) {
    var out = { handled: false, message: '', voiceText: '' };
    var text = String(userText || '').trim();
    if (!text || !document.getElementById('preventivo-form')) return out;
    var terEl = document.getElementById('terreno-id');
    if (!terEl || !String(terEl.value || '').trim()) return out;
    var ctx = (window.Tony && window.Tony.context) || {};
    var resolved = resolveValuePreventivo('data-prevista', text, ctx);
    if (!resolved) return out;
    var ok = await injectPreventivoForm({ 'data-prevista': resolved }, ctx);
    if (!ok) return out;
    out.handled = true;
    out.message = 'Ok, ho impostato la data prevista nel preventivo.';
    out.voiceText = out.message;
    return out;
  }

  /**
   * Risposta breve utente a disambiguazione trattore/attrezzo — client-side, no CF.
   * @returns {Promise<{handled: boolean, readyForSave: boolean, message: string, voiceText: string}>}
   */
  async function applyLavoroMacchineFromUserReply(userText) {
    var out = { handled: false, readyForSave: false, message: '', voiceText: '', field: '' };
    if (!userCanReplyToMacchineDisamb(userText)) return out;
    var text = String(userText || '').trim();
    if (!text) return out;

    if (!lavoriMacchineListsReady()) {
      await waitForLavoriStateList('trattoriList', 1, 4000);
      await waitForLavoriStateList('attrezziList', 1, 4000);
    }

    var trWasAlreadySet = !lavoroSelectIsEmpty('lavoro-trattore');
    var context = (window.Tony && window.Tony.context) || {};
    var mapConfig = {
      formId: 'lavoro-form',
      modalId: 'lavoro-modal',
      injectionOrder: INJECTION_ORDER_LAVORO,
      delays: DELAYS_LAVORO,
      resolver: resolveValueLavoro
    };
    var trList = trattoriListForMacchineDisambReply();
    var atList = attrezziListForMacchineDisambReply();

    if (lavoroSelectIsEmpty('lavoro-trattore')) {
      var matchedTr = findTrattoreInUserText(text, trList);
      if (!matchedTr) return out;
      var trHint = String(matchedTr.id || matchedTr.nome || '').trim();
      var trOk = await injectLavoroMacchinaFieldFromHint('lavoro-trattore', trHint, mapConfig, context);
      if (!trOk || lavoroSelectIsEmpty('lavoro-trattore')) {
        log('applyLavoroMacchineFromUserReply: lavoro-trattore non impostato (hint=' + trHint + ')');
        return out;
      }
      log('applyLavoroMacchineFromUserReply: trattore impostato → ' + trHint);
      window.__tonyLastMacchineDisambField = '';
      window.__tonyLavoroInterviewAskedMacchineField = null;
    }

    if (lavoroSelectIsEmpty('lavoro-attrezzo')) {
      var matchedAt = findAttrezzoInUserText(text, atList);
      if (matchedAt) {
        var atHint = String(matchedAt.id || matchedAt.nome || '').trim();
        var atOk = await injectLavoroMacchinaFieldFromHint('lavoro-attrezzo', atHint, mapConfig, context);
        if (!atOk || lavoroSelectIsEmpty('lavoro-attrezzo')) {
          log('applyLavoroMacchineFromUserReply: lavoro-attrezzo non impostato (hint=' + atHint + ')');
          return out;
        }
        log('applyLavoroMacchineFromUserReply: attrezzo impostato → ' + atHint);
      } else if (window.__tonyLastMacchineDisambField === 'lavoro-attrezzo' && trWasAlreadySet) {
        return out;
      } else if (!trWasAlreadySet) {
        var attPass = await resolveAttrezzoAfterTrattoreKnown(mapConfig, context);
        if (attPass.asked && lavoroSelectIsEmpty('lavoro-attrezzo')) {
          out.handled = true;
          out.field = 'lavoro-attrezzo';
          out.message = 'Trattore impostato. Quale attrezzo vuoi usare?';
          out.voiceText = 'Trattore impostato. Quale attrezzo?';
          markLavoroInterviewMacchineAsked('lavoro-attrezzo');
          log('applyLavoroMacchineFromUserReply: disambiguazione attrezzo emessa dopo trattore');
          return out;
        }
      }
    }

    if (!lavoroSelectIsEmpty('lavoro-trattore') && !lavoroSelectIsEmpty('lavoro-attrezzo')) {
      window.__tonyMacchineDisambAskedAt = 0;
      window.__tonyPendingLavoroTrattoreDisamb = null;
      window.__tonyLastMacchineDisambField = '';
      window.__tonyMacchineDisambTrattoriCandidati = null;
      window.__tonyMacchineDisambAttrezziCandidati = null;
      window.__tonyLavoroInterviewAskedMacchineField = null;
      out.handled = true;
      autoFillLavoroNomeIfMissing();
      syncLavoroOperatoreMacchinaIfNeeded();
      if (lavoroInterviewReadyForSave()) {
        out.readyForSave = true;
        if (trWasAlreadySet) {
          out.message = 'Attrezzo impostato.';
          out.voiceText = 'Attrezzo impostato.';
        } else {
          out.message = 'Trattore e attrezzo impostati.';
          out.voiceText = 'Trattore e attrezzo impostati.';
        }
        log('applyLavoroMacchineFromUserReply: macchine OK, pronto per salvataggio');
        return out;
      }
      var reqAfterMac = getLavoroInterviewRequiredEmpty();
      if (lavoroInterviewNeedsScheduleFields() || reqAfterMac.length) {
        var nextAfterMac = buildNextLavoroInterviewMessage(reqAfterMac, false);
        out.message = trWasAlreadySet ? ('Attrezzo impostato. ' + nextAfterMac) : ('Trattore e attrezzo impostati. ' + nextAfterMac);
        out.voiceText = nextAfterMac;
        window.__tonyLavoroInterviewPending = true;
        log('applyLavoroMacchineFromUserReply: macchine OK, prossimo campo intervista');
        return out;
      }
      out.readyForSave = lavoroInterviewReadyForSave();
      if (trWasAlreadySet) {
        out.message = 'Attrezzo impostato.';
        out.voiceText = 'Attrezzo impostato.';
      } else {
        out.message = 'Trattore e attrezzo impostati.';
        out.voiceText = 'Trattore e attrezzo impostati.';
      }
      log('applyLavoroMacchineFromUserReply: macchine OK da risposta utente');
    } else if (!lavoroSelectIsEmpty('lavoro-trattore') && lavoroSelectIsEmpty('lavoro-attrezzo')) {
      var attAsk = await resolveAttrezzoAfterTrattoreKnown(mapConfig, context);
      if (attAsk.asked) {
        out.handled = true;
        out.field = 'lavoro-attrezzo';
        out.message = trWasAlreadySet
          ? 'Indica quale attrezzo vuoi usare (nome come in elenco).'
          : 'Trattore impostato. Quale attrezzo vuoi usare?';
        out.voiceText = 'Quale attrezzo vuoi usare?';
        markLavoroInterviewMacchineAsked('lavoro-attrezzo');
        log('applyLavoroMacchineFromUserReply: attesa scelta attrezzo');
      } else {
        out.handled = true;
        out.message = 'Trattore impostato. Indica anche l\'attrezzo se serve.';
        out.voiceText = 'Trattore impostato.';
        log('applyLavoroMacchineFromUserReply: solo trattore impostato');
      }
    }
    return out;
  }

  /**
   * Re-inject trattore/attrezzo + inferenza fallback quando liste/dropdown arrivano in ritardo.
   */
  async function reconcileLavoroMacchineFields(formData, mapConfig, context, opts) {
    opts = opts || {};
    var waitMs = opts.waitListsMs == null ? 14000 : opts.waitListsMs;
    var passLabel = opts.passLabel || 'macchine';
    var needsMacchine = inferRequiresMachineFromTipo(formData['lavoro-tipo-lavoro'] || '');
    var hasTrHint = !!(formData['lavoro-trattore'] && String(formData['lavoro-trattore']).trim());
    var hasAtHint = !!(formData['lavoro-attrezzo'] && String(formData['lavoro-attrezzo']).trim());
    if (!needsMacchine && !hasTrHint && !hasAtHint) return;

    if (!lavoriMacchineListsReady()) {
      await waitForLavoriStateList('trattoriList', 1, Math.min(waitMs, 3000));
      await waitForLavoriStateList('attrezziList', 1, Math.min(waitMs, 3000));
    }

    var statePass = await resolveLavoroMacchineFromState(formData, mapConfig, context);
    if (statePass.asked || statePass.resolved) return;

    await waitForSelectOptionsWithValue('lavoro-trattore', 1, Math.min(waitMs, 4000));

    if (hasTrHint && lavoroSelectIsEmpty('lavoro-trattore')) {
      var trOk = await injectLavoroMacchinaFieldFromHint('lavoro-trattore', formData['lavoro-trattore'], mapConfig, context);
      if (trOk) log('Pass ' + passLabel + ': lavoro-trattore re-iniettato dopo hydration liste');
    }

    if (hasAtHint && lavoroSelectIsEmpty('lavoro-attrezzo')) {
      var atOk = await injectLavoroMacchinaFieldFromHint('lavoro-attrezzo', formData['lavoro-attrezzo'], mapConfig, context);
      if (atOk) log('Pass ' + passLabel + ': lavoro-attrezzo re-iniettato dopo hydration liste');
    }

    if (needsMacchine && lavoroSelectIsEmpty('lavoro-trattore')) {
      await delay(200);
      var trEl0 = document.getElementById('lavoro-trattore');
      if (trEl0 && trEl0.tagName === 'SELECT') {
        var trOpts0 = Array.from(trEl0.options || []).filter(function (o) { return o.value && !o.disabled; });
        if (trOpts0.length === 1) {
          trEl0.value = trOpts0[0].value;
          trEl0.dispatchEvent(new Event('change', { bubbles: true }));
          formData['lavoro-trattore'] = String((trOpts0[0].text || trOpts0[0].value || '')).trim();
          log('Lavoro: trattore unico in elenco DOM → impostato automaticamente');
          await delay(300);
        }
      }
    }

    var trElDom = document.getElementById('lavoro-trattore');
    var trattoreNomeEff = formData['lavoro-trattore'] || (trElDom && trElDom.selectedOptions[0] ? (trElDom.selectedOptions[0].text || trElDom.value) : '');
    if (String(trattoreNomeEff || '').trim() !== '' && lavoroSelectIsEmpty('lavoro-attrezzo') && !formData['lavoro-attrezzo']) {
      var tipoNomeLow = (formData['lavoro-tipo-lavoro'] || '').toLowerCase();
      var searchAttrezzo = keywordAttrezzoFromTipoNomeLower(tipoNomeLow);
      if (searchAttrezzo) {
        await delay(300);
        await waitForSelectOptionsWithValue('lavoro-attrezzo', 1, Math.min(waitMs, 4000));
        var attEl = document.getElementById('lavoro-attrezzo');
        if (attEl && attEl.tagName === 'SELECT' && attEl.options && attEl.options.length > 1) {
          var matches = Array.from(attEl.options).filter(function (o) {
            return o.value && !o.disabled && (o.text || '').toLowerCase().indexOf(searchAttrezzo) >= 0;
          });
          if (matches.length === 1) {
            var opt = matches[0];
            attEl.value = opt.value;
            attEl.dispatchEvent(new Event('change', { bubbles: true }));
            log('Inferito attrezzo da tipo lavoro (DOM, unico match): ' + (opt.text || opt.value));
          } else if (matches.length > 1) {
            if (shouldSkipMacchineDisambiguationReask('lavoro-attrezzo')) return;
            var candidatiDom = matches.map(function (o) {
              return { id: String(o.value || ''), nome: String((o.text || o.value || '')).trim() };
            });
            var trRecDom = resolveTrattoreRecordFromLavoroDom();
            if (trRecDom) {
              var atListRec = (window.lavoriState && window.lavoriState.attrezziList) || [];
              candidatiDom = candidatiDom.filter(function (c) {
                var rec = resolveAttrezzoFromState(c.id || c.nome, atListRec);
                if (!rec) return true;
                return attrezziCompatibiliConTrattoreCv(trRecDom, [rec]).length === 1;
              });
            }
            if (candidatiDom.length === 1) {
              attEl.value = candidatiDom[0].id;
              attEl.dispatchEvent(new Event('change', { bubbles: true }));
              log('Inferito attrezzo da tipo lavoro (DOM, unico compatibile CV): ' + candidatiDom[0].nome);
            } else if (candidatiDom.length > 1) {
            postTonyMacchineDisambiguation(buildAttrezzoDisambiguationPayload(
              candidatiDom,
              String(formData['lavoro-tipo-lavoro'] || '').trim() || 'questa lavorazione'
            ));
            }
          }
        }
      }
    } else if (hasAtHint && lavoroSelectIsEmpty('lavoro-attrezzo') && !lavoroSelectIsEmpty('lavoro-trattore')) {
      await injectLavoroMacchinaFieldFromHint('lavoro-attrezzo', formData['lavoro-attrezzo'], mapConfig, context);
    }
  }

  /** Attende la fine del fetch `loadTerreniCliente` (nuovo-preventivo-standalone) per evitare race su innerHTML del select. */
  function awaitPreventivoTerreniFetchDone(maxMs) {
    if (typeof window.__preventivoAwaitTerreniClienteReady !== 'function') return Promise.resolve();
    return window.__preventivoAwaitTerreniClienteReady(maxMs == null ? 15000 : maxMs);
  }

  /** Attende che syncPreventivoTonyState() abbia messo il terreno in preventivoState.terreni (dopo change cliente). */
  function waitForPreventivoStateContainsTerreno(terrenoId, maxMs) {
    maxMs = maxMs || 12000;
    var want = String(terrenoId || '').trim();
    if (!want) return Promise.resolve();
    return new Promise(function (resolve) {
      var start = Date.now();
      var iv = setInterval(function () {
        var ps = window.preventivoState;
        var list = ps && Array.isArray(ps.terreni) ? ps.terreni : [];
        var hit = list.some(function (t) { return (t.id || '') === want; });
        if (hit || Date.now() - start > maxMs) {
          clearInterval(iv);
          resolve();
        }
      }, 100);
    });
  }

  function _resolveByName(raw, list, key) {
    if (!raw || !Array.isArray(list)) return raw;
    const search = String(raw).toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nameKey = key || 'nome';
    const exact = list.find(function (item) {
      const n = (item && item[nameKey] || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return n === search;
    });
    if (exact && exact.id) return exact.id;
    const partial = list.find(function (item) {
      const n = (item && item[nameKey] || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return n && (n.indexOf(search) >= 0 || search.indexOf(n) >= 0);
    });
    return partial && partial.id ? partial.id : raw;
  }

  function normTxt(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  /** True se sembra id documento Firestore (evita confondere con nome coltura). */
  function looksLikeFirestoreDocId(s) {
    return /^[a-zA-Z0-9_-]{15,}$/.test(String(s || '').trim());
  }

  /** Lista attrezzi: se gli oggetti hanno tipoMacchina filtra; altrimenti assume che la lista sia già solo attrezzi. */
  function macchineListSoloAttrezzi(list) {
    if (!Array.isArray(list)) return [];
    var hasTipo = list.some(function (m) { return m && m.tipoMacchina; });
    if (!hasTipo) return list.slice();
    return list.filter(function (m) {
      return m && (m.tipoMacchina || m.tipo) === 'attrezzo';
    });
  }

  /** Trattori attivi da lista unificata o da lista solo-trattori. */
  function macchineListSoloTrattori(list) {
    if (!Array.isArray(list)) return [];
    var hasTipo = list.some(function (m) { return m && m.tipoMacchina; });
    if (!hasTipo) {
      return list.filter(function (m) { return m && (m.stato || '') !== 'dismesso'; });
    }
    return list.filter(function (m) {
      return m && (m.stato || '') !== 'dismesso' && (m.tipoMacchina || m.tipo) === 'trattore';
    });
  }

  /**
   * Risolve un attrezzo da valore form (id o nome fuzzy). Un solo match sicuro, altrimenti null.
   * @param {string} raw - lavoro-attrezzo / attivita-attrezzo
   * @param {Array} attrezziOMacchineList - attrezziList lavori o macchineList attività
   */
  function resolveAttrezzoFromState(raw, attrezziOMacchineList) {
    if (raw == null || String(raw).trim() === '' || !Array.isArray(attrezziOMacchineList)) return null;
    var attList = macchineListSoloAttrezzi(attrezziOMacchineList);
    var v = String(raw).trim();
    if (looksLikeFirestoreDocId(v)) {
      var byId = attList.find(function (a) { return (a.id || '') === v; });
      if (byId) return byId;
    }
    var low = normalizeTonyText(v);
    if (!low) return null;
    var matches = attList.filter(function (a) {
      if (!a || (a.stato || '') === 'dismesso') return false;
      var n = normalizeTonyText(a.nome || '');
      return n && (n === low || n.indexOf(low) >= 0 || low.indexOf(n) >= 0);
    });
    if (matches.length === 1) return matches[0];
    return null;
  }

  /** Attrezzi compatibili con CV trattore (inverso di trattoriCompatibiliCv). */
  function attrezziCompatibiliConTrattoreCv(trattore, attrezziList) {
    if (!Array.isArray(attrezziList)) return [];
    if (!trattore) return attrezziList.slice();
    var cv = Number(trattore.cavalli);
    if (!Number.isFinite(cv) || cv <= 0) return attrezziList.slice();
    return attrezziList.filter(function (a) {
      if (!a) return false;
      var min = a.cavalliMinimiRichiesti;
      if (min == null || min === '') return true;
      var minN = Number(min);
      if (!Number.isFinite(minN) || minN <= 0) return true;
      return cv >= minN;
    });
  }

  /** Trattori con cavalli >= cavalliMinimiRichiesti attrezzo; senza minimo valido → tutti i trattori attivi. */
  function trattoriCompatibiliCv(trattoriList, attrezzo) {
    if (!Array.isArray(trattoriList)) return [];
    var active = trattoriList.filter(function (t) {
      return t && (t.stato || '') !== 'dismesso';
    });
    if (!attrezzo) return active;
    var min = attrezzo.cavalliMinimiRichiesti;
    if (min == null || min === '') return active;
    var minN = Number(min);
    if (!Number.isFinite(minN) || minN <= 0) return active;
    return active.filter(function (t) {
      var cv = Number(t.cavalli);
      return Number.isFinite(cv) && cv >= minN;
    });
  }

  function labelsFromTrattoriRecords(trattori, max) {
    max = max || 8;
    return (trattori || []).slice(0, max).map(function (t) {
      return String((t.nome || t.id || '')).trim();
    }).filter(Boolean);
  }

  /**
   * Incrocia hint coltura con `colturePerCategoriaPreventivo` → id coltura / nomi da confrontare sui terreni.
   */
  function colturaHintsFromGlobalMap(hintNorm) {
    var ids = [];
    var nomi = [];
    if (!hintNorm || hintNorm.length < 2) return { ids: ids, nomi: nomi };
    var map = (typeof window !== 'undefined' && window.colturePerCategoriaPreventivo) || {};
    Object.keys(map).forEach(function (cid) {
      var arr = map[cid];
      if (!Array.isArray(arr)) return;
      arr.forEach(function (c) {
        var nome = (c && (c.nome || c)) || '';
        var n = normTxt(nome);
        if (!n) return;
        if (n === hintNorm || n.indexOf(hintNorm) >= 0 || hintNorm.indexOf(n) >= 0) {
          if (c.id) ids.push(String(c.id));
          nomi.push(nome);
        }
      });
    });
    return { ids: ids, nomi: nomi };
  }

  /**
   * Risolve terreno-id dal select DOM: value=id o testo opzione `nome (X ha)` che contiene l'hint.
   */
  function resolveTerrenoIdViaDomSelect(hint) {
    if (hint === undefined || hint === null || String(hint).trim() === '') return null;
    var el = typeof document !== 'undefined' ? document.getElementById('terreno-id') : null;
    if (!el || el.tagName !== 'SELECT' || !el.options) return null;
    var v = String(hint).trim();
    if (looksLikeFirestoreDocId(v)) {
      for (var i = 0; i < el.options.length; i++) {
        if ((el.options[i].value || '') === v) return v;
      }
    }
    var vNorm = normTxt(v);
    if (!vNorm) return null;
    var bestVal = null;
    var bestScore = 0;
    for (var j = 0; j < el.options.length; j++) {
      var opt = el.options[j];
      var val = opt.value || '';
      if (!val) continue;
      var text = normTxt((opt.text || '').split('(')[0].trim());
      if (text === vNorm || text.indexOf(vNorm) >= 0 || vNorm.indexOf(text) >= 0) {
        var sc = text === vNorm ? 100 : Math.min(text.length, vNorm.length);
        if (sc > bestScore) {
          bestScore = sc;
          bestVal = val;
        }
      }
      if (normTxt(opt.text || '').indexOf(vNorm) >= 0 && !bestVal) {
        bestVal = val;
        bestScore = 50;
      }
    }
    return bestVal;
  }

  /**
   * Se `resolvedId` non compare tra le `<option>` del select (stato Tony vs DOM disallineati dopo race
   * o sync saltato), prova a mappare su un value presente usando nome terreno dallo stato o hint raw.
   */
  function coercePreventivoTerrenoSelectToDomOption(el, resolvedId, rawHint) {
    if (!el || el.tagName !== 'SELECT' || !el.options) return resolvedId;
    function hasValue(v) {
      var s = String(v || '').trim();
      if (!s) return false;
      for (var i = 0; i < el.options.length; i++) {
        if ((el.options[i].value || '') === s) return true;
      }
      return false;
    }
    var want = String(resolvedId || '').trim();
    if (want && hasValue(want)) return want;
    var optionVals = Array.from(el.options || []).map(function (o) { return String(o.value || ''); }).filter(function (v) { return v; });
    var optionNames = Array.from(el.options || []).map(function (o) { return String((o.text || '').split('(')[0].trim()); }).filter(function (v) { return v; });
    log('preventivo terreno-id: coerce start rawHint="' + (rawHint == null ? '' : String(rawHint)) + '" resolved="' + want + '" options=' + optionVals.length);
    var hint = rawHint != null ? String(rawHint).trim() : '';
    if (hint) {
      var viaHint = resolveTerrenoIdViaDomSelect(hint);
      if (viaHint && hasValue(viaHint)) return viaHint;
    }
    var ps = window.preventivoState;
    function chooseTerrenoFromHint(h, terreni) {
      if (!h || !Array.isArray(terreni) || terreni.length === 0) return null;
      var hNorm = normTxt(h);
      if (!hNorm) return null;
      function hit(v) {
        var n = normTxt(v);
        return n && (n === hNorm || n.indexOf(hNorm) >= 0 || hNorm.indexOf(n) >= 0);
      }
      var found = terreni.find(function (t) {
        return hit(t.nome)
          || hit(t.coltura)
          || hit(t.colturaSottocategoria)
          || hit(t.colturaCategoria)
          || hit(t.coltura_categoria)
          || hit(t.colturaNome)
          || hit(t.coltura_nome)
          || hit(t.nomeColtura);
      });
      return found || null;
    }
    if (want && ps && Array.isArray(ps.terreni)) {
      var t = ps.terreni.find(function (x) { return (x.id || '') === want; });
      if (t) {
        if (t.nome) {
          var viaNome = resolveTerrenoIdViaDomSelect(t.nome);
          if (viaNome && hasValue(viaNome)) return viaNome;
        }
        var nn = normTxt(t.nome || '');
        if (nn) {
          var bestV = null;
          var bestSc = 0;
          for (var j = 0; j < el.options.length; j++) {
            var o = el.options[j];
            var ov = o.value || '';
            if (!ov) continue;
            var tx = normTxt((o.text || '').split('(')[0].trim());
            if (!tx) continue;
            var sc = tx === nn ? 100 : (tx.indexOf(nn) >= 0 || nn.indexOf(tx) >= 0 ? Math.min(tx.length, nn.length) : 0);
            if (sc > bestSc) {
              bestSc = sc;
              bestV = ov;
            }
          }
          if (bestV && bestSc >= 3) {
            return bestV;
          }
        }
      }
    }
    if (hint && ps && Array.isArray(ps.terreni)) {
      var byHint = chooseTerrenoFromHint(hint, ps.terreni);
      if (byHint) {
        if (byHint.id && hasValue(byHint.id)) {
          log('preventivo terreno-id: coercion via hint stato -> option value id');
          return String(byHint.id).trim();
        }
        if (byHint.nome) {
          var byHintNome = resolveTerrenoIdViaDomSelect(byHint.nome);
          if (byHintNome && hasValue(byHintNome)) {
            log('preventivo terreno-id: coercion via hint stato -> option text nome');
            return byHintNome;
          }
        }
      }
    }
    // Fallback hard: se c'e' un solo terreno selezionabile, usa quello.
    if (optionVals.length === 1) {
      log('preventivo terreno-id: fallback unico terreno nel select -> ' + optionVals[0]);
      return optionVals[0];
    }
    // Fallback ambiguo: prepara disambiguazione dalla UI corrente.
    if (optionVals.length > 1 && typeof window !== 'undefined') {
      var opts = [];
      for (var k = 0; k < el.options.length; k++) {
        var oo = el.options[k];
        if (!oo || !oo.value) continue;
        opts.push({ id: String(oo.value), nome: String((oo.text || '').trim()) });
      }
      window.__tonyPreventivoTerrenoDisambiguation = {
        hint: hint || want || '',
        options: opts.slice(0, 10)
      };
      log('preventivo terreno-id: fallback ambiguo, richiesta disambiguazione. Hint="' + (hint || want) + '" opzioni=' + opts.length + ' [' + optionNames.join(' | ') + ']');
      return '';
    }
    /** Ultimo tentativo: stesso nome su qualsiasi terreno in lista (hint era id sbagliato / tenant) */
    if (hint && ps && Array.isArray(ps.terreni)) {
      var t2 = ps.terreni.find(function (x) {
        var n = normTxt(x.nome || '');
        var h = normTxt(hint);
        return n && h && (n === h || n.indexOf(h) >= 0 || h.indexOf(n) >= 0);
      });
      if (t2 && t2.id && hasValue(t2.id)) return String(t2.id).trim();
    }
    return resolvedId;
  }

  /**
   * Nuovo Preventivo: il modello spesso passa coltura ("trebbiano") o nome parziale in `terreno-id`.
   * Le option del select usano `value = id` Firestore; il testo è `nome (ha)`. Risolve per id, nome, coltura.
   */
  function resolveTerrenoIdForPreventivo(raw, list) {
    if (raw === undefined || raw === null || raw === '') return raw;
    if (!Array.isArray(list) || list.length === 0) return raw;
    var v = String(raw).trim();
    if (!v) return raw;
    var vNorm = normTxt(v);

    if (typeof window !== 'undefined') {
      window.__tonyPreventivoTerrenoDisambiguation = null;
    }

    var byId = list.find(function (t) { return (t.id || '') === v; });
    if (byId) return byId.id;

    var byNome = _resolveByName(v, list, 'nome');
    if (byNome !== v && byNome != null && String(byNome).trim() !== '') return byNome;

    var colMap = colturaHintsFromGlobalMap(vNorm);

    function terrenoBlob(t) {
      return [
        t.nome,
        t.descrizione,
        t.note,
        t.coltura,
        t.colturaSottocategoria,
        t.colturaSottoCategoria,
        t.colturaNome,
        t.coltura_nome,
        t.nomeColtura,
        t.colturaCategoria,
        t.coltura_categoria,
        t.colturaDettaglio && t.colturaDettaglio.nome,
        t.colturaDettaglio && t.colturaDettaglio.categoria,
        t.colturaId,
        t.coltura_id
      ].map(normTxt).join(' ');
    }

    function tokenScore(t) {
      var blob = terrenoBlob(t);
      if (!blob) return 0;
      var toks = vNorm.split(/\s+/).filter(function (x) { return x && x.length >= 3; });
      if (!toks.length) toks = [vNorm];
      var hits = 0;
      toks.forEach(function (tk) {
        if (blob.indexOf(tk) >= 0) hits++;
      });
      var ratio = hits / toks.length;
      if (ratio >= 1) return 70;
      if (ratio >= 0.66) return 45;
      if (ratio >= 0.5) return 25;
      return 0;
    }

    var candidates = list.filter(function (t) {
      var nome = normTxt(t.nome);
      var col = normTxt(t.coltura);
      var cs = normTxt(t.colturaSottocategoria);
      var cs2 = normTxt(t.colturaSottoCategoria);
      var colCat = normTxt(t.colturaCategoria || t.coltura_categoria);
      var colDet = normTxt((t.colturaDettaglio && t.colturaDettaglio.nome) || '');
      var colId = String(t.colturaId || t.coltura_id || '').trim();
      if (colMap.ids.length && colId && colMap.ids.indexOf(colId) >= 0) return true;
      if (colMap.nomi.length) {
        for (var mi = 0; mi < colMap.nomi.length; mi++) {
          var cn = normTxt(colMap.nomi[mi]);
          if (cn && (col === cn || cs === cn || cs2 === cn || colDet === cn || col.indexOf(cn) >= 0 || cs.indexOf(cn) >= 0 || cs2.indexOf(cn) >= 0 || colDet.indexOf(cn) >= 0)) return true;
        }
      }
      return (nome && (nome === vNorm || nome.indexOf(vNorm) >= 0 || vNorm.indexOf(nome) >= 0))
        || (col && (col === vNorm || col.indexOf(vNorm) >= 0 || vNorm.indexOf(col) >= 0))
        || (cs && (cs === vNorm || cs.indexOf(vNorm) >= 0 || vNorm.indexOf(cs) >= 0))
        || (cs2 && (cs2 === vNorm || cs2.indexOf(vNorm) >= 0 || vNorm.indexOf(cs2) >= 0))
        || (colDet && (colDet === vNorm || colDet.indexOf(vNorm) >= 0 || vNorm.indexOf(colDet) >= 0))
        || (colCat && (colCat === vNorm || colCat.indexOf(vNorm) >= 0))
        || tokenScore(t) >= 45
        || (vNorm.length >= 3 && terrenoBlob(t).indexOf(vNorm) >= 0);
    });
    if (candidates.length === 1) return candidates[0].id || raw;
    if (candidates.length > 1) {
      var exact = candidates.find(function (t) {
        var col = normTxt(t.coltura);
        var cs = normTxt(t.colturaSottocategoria);
        return col === vNorm || cs === vNorm;
      });
      if (exact) return exact.id || raw;
      if (colMap.ids.length) {
        var byCid = candidates.find(function (t) {
          var cid = String(t.colturaId || t.coltura_id || '').trim();
          return cid && colMap.ids.indexOf(cid) >= 0;
        });
        if (byCid) return byCid.id || raw;
      }
      candidates.sort(function (a, b) {
        var sb = tokenScore(b);
        var sa = tokenScore(a);
        if (sb !== sa) return sb - sa;
        return String(a.nome || '').localeCompare(String(b.nome || ''), 'it');
      });
      var topScore = tokenScore(candidates[0]);
      var secondScore = candidates.length > 1 ? tokenScore(candidates[1]) : -1;
      if (topScore >= 45 && secondScore < topScore) {
        log('preventivo: match elastico terreno univoco per hint "' + v + '" → ' + (candidates[0].nome || candidates[0].id));
        return candidates[0].id || raw;
      }
      var opts = candidates
        .map(function (t) {
          return {
            id: t.id || '',
            nome: String(t.nome || t.id || '').trim(),
            superficie: t.superficie
          };
        })
        .filter(function (x) { return x.nome; })
        .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'it'); });
      if (typeof window !== 'undefined') {
        window.__tonyPreventivoTerrenoDisambiguation = {
          hint: v,
          options: opts.slice(0, 8)
        };
      }
      log('preventivo: hint terreno ambiguo "' + v + '" (' + opts.length + ' opzioni) → richiedo chiarimento utente');
      return '';
    }
    return raw;
  }

  function resolveTerrenoByName(name, context) {
    const list = (window.attivitaState && window.attivitaState.terreniList) ||
      (context && context.attivita && context.attivita.terreni) || [];
    return _resolveByName(name, list, 'nome');
  }

  function resolveCategoriaByName(name, context) {
    const principali = (window.attivitaState && window.attivitaState.categorieLavoriPrincipali) ||
      (context && context.attivita && context.attivita.categorie_lavoro) || [];
    const map = window.attivitaState && window.attivitaState.sottocategorieLavoriMap;
    let all = [...principali];
    if (map && typeof map.forEach === 'function') {
      map.forEach(function (items) {
        if (Array.isArray(items)) all = all.concat(items);
      });
    }
    return _resolveByName(name, all, 'nome');
  }

  function resolveTipoLavoroByName(name, context) {
    const list = (window.attivitaState && window.attivitaState.tipiLavoroList) ||
      (context && context.attivita && context.attivita.tipi_lavoro) || [];
    return _resolveByName(name, list, 'nome');
  }

  function resolveMacchinaByName(name, context) {
    const list = (window.attivitaState && window.attivitaState.macchineList) ||
      (context && context.attivita && context.attivita.macchine) || [];
    const trattori = list.filter(function (m) { return m.tipoMacchina === 'trattore' && m.stato !== 'dismesso'; });
    return _resolveByName(name, trattori, 'nome');
  }

  function resolveAttrezzoByName(name, context) {
    const list = (window.attivitaState && window.attivitaState.macchineList) ||
      (context && context.attivita && context.attivita.macchine) || [];
    const attrezzi = list.filter(function (m) { return m.tipoMacchina === 'attrezzo' && m.stato !== 'dismesso'; });
    return _resolveByName(name, attrezzi, 'nome');
  }

  function resolveFromLavoriState(rawValue, stateKey, nameKey) {
    if (!window.lavoriState) return rawValue;
    var list = window.lavoriState[stateKey];
    if (!Array.isArray(list)) return rawValue;
    if (nameKey === 'nome' && (stateKey === 'caposquadraList' || stateKey === 'operaiList')) {
      return resolveUserByName(rawValue, list) || rawValue;
    }
    return _resolveByName(rawValue, list, nameKey || 'nome') || rawValue;
  }

  /**
   * Risolve lavoro-tipo-lavoro al NOME (non id).
   * populateTipoLavoroDropdown usa option.value = tipo.nome per retrocompatibilità.
   * Preferisce il match piu specifico (nome piu lungo) per evitare che "Potatura"
   * matchi il tipo sbagliato sotto Gestione del Verde.
   * Se Gemini invia un ID Firestore (es. 1pUgzBjZLer6gPxjMDO9), risolvi a nome.
   */
  function getDefaultTipoTrattamentoAnticrittogamico() {
    var m = (typeof window !== 'undefined' && window.TONY_FORM_MAPPING) || {};
    return m.DEFAULT_TIPO_LAVORO_TRATTAMENTO_GENERICO || 'Trattamento Anticrittogamico Meccanico';
  }

  function getDefaultSottocategoriaTrattamentiTony() {
    var m = (typeof window !== 'undefined' && window.TONY_FORM_MAPPING) || {};
    return m.DEFAULT_SOTTOCATEGORIA_TRATTAMENTI_TONY || 'Meccanico';
  }

  /**
   * Risolve il nome tipo lavoro dal catalogo. Per "Trattamento Anticrittogamico …" con match multipli
   * (Manuale vs Meccanico) preferisce Meccanico se l'input non specifica "manuale" (default Tony).
   */
  function resolveTipoLavoroToNome(rawValue) {
    if (!rawValue || !window.lavoriState || !Array.isArray(window.lavoriState.tipiLavoroList)) return rawValue;
    var list = window.lavoriState.tipiLavoroList;
    var v = String(rawValue).trim();
    if (/^[a-zA-Z0-9_-]{15,}$/.test(v)) {
      var byId = list.find(function (t) { return (t.id || '') === v; });
      if (byId && byId.nome) return byId.nome;
    }
    var search = v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!search) return rawValue;
    var exact = list.find(function (t) {
      var n = (t.nome || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return n === search;
    });
    if (exact && exact.nome) {
      var exactN = normTipoLavoroNome(exact.nome);
      if (exactN.indexOf('tra le file') < 0 && exactN.indexOf('sulla fila') < 0 && getPreventivoTerrenoFilariHint()) {
        var longerFilari = list.filter(function (t) {
          var n = normTipoLavoroNome(t.nome);
          return n !== exactN && n.indexOf(exactN) === 0 && n.length > exactN.length + 3 &&
            (n.indexOf('tra le file') >= 0 || n.indexOf('sulla fila') >= 0);
        });
        if (longerFilari.length) {
          longerFilari.sort(function (a, b) { return (b.nome || '').length - (a.nome || '').length; });
          return longerFilari[0].nome;
        }
      }
      return exact.nome;
    }
    var matches = list.filter(function (t) {
      var n = (t.nome || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!n) return false;
      if (n.indexOf(search) >= 0) return true;
      /** Evita match spuri su nomi corti (es. "e" in "trinciatura") */
      if (n.length >= 3 && search.indexOf(n) >= 0) return true;
      return false;
    });
    if (matches.length === 0) return rawValue;

    if (matches.length > 1 && search.indexOf('tra le file') >= 0) {
      var traFileHit = matches.find(function (t) {
        return (t.nome || '').toLowerCase().indexOf('tra le file') >= 0;
      });
      if (traFileHit && traFileHit.nome) return traFileHit.nome;
    }
    if (matches.length > 1 && search.indexOf('sulla fila') >= 0) {
      var filaHit = matches.find(function (t) {
        return (t.nome || '').toLowerCase().indexOf('sulla fila') >= 0;
      });
      if (filaHit && filaHit.nome) return filaHit.nome;
    }

    var defAnticritto = getDefaultTipoTrattamentoAnticrittogamico();
    var anticrittoHits = matches.filter(function (t) {
      var n = (t.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return n.indexOf('anticrittogamico') >= 0;
    });
    if (anticrittoHits.length >= 2) {
      if (search.indexOf('manuale') >= 0) {
        var onlyM = anticrittoHits.find(function (t) {
          return (t.nome || '').toLowerCase().indexOf('manuale') >= 0;
        });
        if (onlyM && onlyM.nome) return onlyM.nome;
      }
      if (search.indexOf('meccanico') >= 0) {
        var onlyMc = anticrittoHits.find(function (t) {
          return (t.nome || '').toLowerCase().indexOf('meccanico') >= 0;
        });
        if (onlyMc && onlyMc.nome) return onlyMc.nome;
      }
      var defObj = anticrittoHits.find(function (t) { return (t.nome || '') === defAnticritto; });
      if (defObj && defObj.nome) return defObj.nome;
      var preferMc = anticrittoHits.find(function (t) {
        var n = (t.nome || '').toLowerCase();
        return n.indexOf('meccanico') >= 0;
      });
      if (preferMc && preferMc.nome) return preferMc.nome;
    }

    if (matches.length > 1 && search.indexOf('anticrittogamico') >= 0 && search.indexOf('manuale') < 0 && search.indexOf('meccanico') < 0) {
      var defHit2 = matches.find(function (t) { return (t.nome || '') === defAnticritto; });
      if (defHit2 && defHit2.nome) return defHit2.nome;
    }

    var best = matches.sort(function (a, b) {
      var lenA = (a.nome || '').length;
      var lenB = (b.nome || '').length;
      return lenB - lenA;
    })[0];
    return best && best.nome ? best.nome : rawValue;
  }

  function resolveUserByName(rawValue, list) {
    if (!rawValue || !Array.isArray(list)) return null;
    var search = String(rawValue).toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!search) return null;
    var ids = [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var nomeCompleto = ((item.nome || '') + ' ' + (item.cognome || '')).trim() || (item.email || '');
      var n = nomeCompleto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (n === search || (n && (n.indexOf(search) >= 0 || search.indexOf(n) >= 0))) {
        if (item.id) ids.push(item.id);
      }
    }
    if (ids.length === 1) return ids[0];
    if (ids.length > 1) return null;
    return null;
  }

  function resolveCategoriaLavori(rawValue) {
    if (!window.lavoriState) return rawValue;
    const principali = Array.isArray(window.lavoriState.categorieLavoriPrincipali)
      ? window.lavoriState.categorieLavoriPrincipali : [];
    let all = [...principali];
    const map = window.lavoriState.sottocategorieLavoriMap;
    if (map && typeof map.forEach === 'function') {
      map.forEach(function (items) {
        if (Array.isArray(items)) all = all.concat(items);
      });
    }
    return _resolveByName(rawValue, all, 'nome') || rawValue;
  }

  /**
   * Risolve la sottocategoria nel contesto della categoria principale attualmente selezionata.
   * Evita di prendere un id "Meccanico/Manuale" appartenente a un'altra categoria.
   */
  function resolveSottocategoriaLavoriForCurrentCategory(rawValue) {
    if (rawValue === undefined || rawValue === null || rawValue === '' || !window.lavoriState) return rawValue;
    var categoriaEl = document.getElementById('lavoro-categoria-principale');
    var categoriaId = categoriaEl ? categoriaEl.value : null;
    var subMap = window.lavoriState.sottocategorieLavoriMap;
    if (!categoriaId || !subMap || typeof subMap.get !== 'function') return resolveCategoriaLavori(rawValue);
    var subs = subMap.get(categoriaId) || [];
    if (!Array.isArray(subs) || subs.length === 0) return resolveCategoriaLavori(rawValue);
    var raw = String(rawValue).trim();
    var byId = subs.find(function (s) { return s && (s.id || '') === raw; });
    if (byId && byId.id) return byId.id;
    var search = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var byName = subs.find(function (s) {
      var n = String((s && (s.nome || s.text)) || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return n && (n === search || n.indexOf(search) >= 0 || search.indexOf(n) >= 0);
    });
    if (byName && byName.id) return byName.id;
    var subEl = document.getElementById('lavoro-sottocategoria');
    if (subEl && subEl.tagName === 'SELECT' && subEl.options && subEl.options.length) {
      var searchDom = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      var domOpt = Array.from(subEl.options).find(function (o) {
        if (!(o.value || '').trim()) return false;
        var t = String(o.text || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return t && (t === searchDom || t.indexOf(searchDom) >= 0 || searchDom.indexOf(t) >= 0);
      });
      if (domOpt && domOpt.value) return domOpt.value;
    }
    return rawValue;
  }

  /**
   * La CF spesso manda tipo-assegnazione=caposquadra; nel DOM i radio sono squadra | autonomo.
   */
  function normalizeLavoroTipoAssegnazioneValue(formData) {
    if (!formData || typeof formData !== 'object') return;
    var ta = formData['tipo-assegnazione'];
    var t = ta != null ? String(ta).toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
    if (t === 'caposquadra' || t === 'capo_squadra' || t === 'con_caposquadra' || t === 'con caposquadra' || t === 'capo') {
      formData['tipo-assegnazione'] = 'squadra';
      return;
    }
    if (!t && formData['lavoro-caposquadra'] && !formData['lavoro-operaio']) {
      formData['tipo-assegnazione'] = 'squadra';
    }
  }

  /**
   * True se il valore di lavoro-categoria-principale punta alla categoria Trattamenti (id o nome) o a una sua sottocategoria.
   */
  function isTrattamentiLavoroCategoryFromFormValue(catRaw) {
    if (catRaw == null || String(catRaw).trim() === '' || !window.lavoriState) return false;
    var main = window.lavoriState.categorieLavoriPrincipali || [];
    var subMap = window.lavoriState.sottocategorieLavoriMap;
    var flat = main.slice();
    if (subMap && typeof subMap.forEach === 'function') {
      subMap.forEach(function (items) {
        if (Array.isArray(items)) flat = flat.concat(items);
      });
    }
    var id = String(catRaw).trim();
    var cat = flat.find(function (c) { return c && c.id === id; });
    if (!cat) {
      var idLow = id.toLowerCase();
      cat = flat.find(function (c) {
        return c && (c.nome || '').toLowerCase() === idLow;
      });
    }
    if (!cat && !looksLikeFirestoreDocId(id)) {
      var resolved = resolveCategoriaLavori(catRaw);
      var rid = resolved != null ? String(resolved).trim() : '';
      if (rid && rid !== id) cat = flat.find(function (c) { return c && c.id === rid; });
    }
    if (!cat) return false;
    if ((cat.codice || '').toLowerCase() === 'trattamenti') return true;
    if (cat.parentId) {
      var parent = main.find(function (p) { return p && p.id === cat.parentId; });
      if (parent && (parent.codice || '').toLowerCase() === 'trattamenti') return true;
    }
    return false;
  }

  /**
   * Dopo navigazione (pending-after-nav) la CF può inviare formData parziale senza tipo/sottocategoria.
   * Per categoria Trattamenti compila default Tony (Meccanico + Anticrittogamico meccanico).
   */
  function ensureTrattamentiDefaultsForLavoroForm(formData) {
    if (!formData || !window.lavoriState) return;
    if (!isTrattamentiLavoroCategoryFromFormValue(formData['lavoro-categoria-principale'])) return;
    var defTipo = getDefaultTipoTrattamentoAnticrittogamico();
    var defSub = getDefaultSottocategoriaTrattamentiTony();
    var tipoStr = formData['lavoro-tipo-lavoro'] != null ? String(formData['lavoro-tipo-lavoro']).trim() : '';
    if (!tipoStr) {
      formData['lavoro-tipo-lavoro'] = defTipo;
      log('ensureTrattamentiDefaults: tipo lavoro (mancante) → ' + defTipo);
    } else {
      formData['lavoro-tipo-lavoro'] = resolveTipoLavoroToNome(formData['lavoro-tipo-lavoro']);
    }
    var tipoNorm = String(formData['lavoro-tipo-lavoro'] || '').toLowerCase();
    if (tipoNorm.indexOf('anticrittogamico manuale') >= 0) {
      formData['lavoro-tipo-lavoro'] = defTipo;
      log('ensureTrattamentiDefaults: override anticrittogamico manuale → default meccanico');
    }
    var subStr = formData['lavoro-sottocategoria'] != null ? String(formData['lavoro-sottocategoria']).trim() : '';
    if (!subStr) {
      formData['lavoro-sottocategoria'] = defSub;
      log('ensureTrattamentiDefaults: sottocategoria (mancante) → ' + defSub);
    }
    if (formData['lavoro-tipo-lavoro'] === defTipo) {
      formData['lavoro-sottocategoria'] = defSub;
      log('ensureTrattamentiDefaults: sottocategoria allineata al tipo default → ' + defSub);
    }
  }

  function resolveValueAttivita(fieldId, value, context) {
    if (value === undefined || value === null || value === '') return value;
    switch (fieldId) {
      case 'attivita-terreno': return resolveTerrenoByName(value, context);
      case 'attivita-categoria-principale': return resolveCategoriaByName(value, context);
      case 'attivita-sottocategoria': return resolveCategoriaByName(value, context);
      case 'attivita-tipo-lavoro-gerarchico': {
        if (!value) return value;
        var v = String(value).trim();
        var tipi = (window.attivitaState && window.attivitaState.tipiLavoroList) || (context && context.attivita && context.attivita.tipi_lavoro) || [];
        if (/^[a-zA-Z0-9_-]{15,}$/.test(v)) {
          var t = tipi.find(function (x) { return (x.id || '') === v; });
          return t && t.nome ? t.nome : value;
        }
        return value;
      }
      case 'attivita-coltura-categoria': return resolveCategoriaByName(value, context);
      case 'attivita-coltura-gerarchica': return value;
      case 'attivita-macchina': return resolveMacchinaByName(value, context);
      case 'attivita-attrezzo': return resolveAttrezzoByName(value, context);
      case 'attivita-data':
        if (String(value).toLowerCase() === 'oggi') {
          return new Date().toISOString().slice(0, 10);
        }
        return value;
      case 'attivita-orario-inizio':
      case 'attivita-orario-fine': {
        var v = String(value).trim();
        if (/^\d{1,2}\s*[h:]\s*\d{0,2}$/i.test(v) || /^\d{1,2}$/.test(v)) {
          var parts = v.replace(/[h:]/gi, ':').split(':');
          var h = parseInt(parts[0], 10) || 0;
          var m = parseInt(parts[1], 10) || 0;
          return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
        }
        return value;
      }
      default: return value;
    }
  }

  /** Converte testo/ISO/DD-MM-YYYY in YYYY-MM-DD per input type="date". */
  function normalizeDateForPreventivoInput(value) {
    if (value === undefined || value === null) return value;
    var s = String(value).trim();
    if (!s) return value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var low = s.toLowerCase();
    if (low === 'oggi' || low === 'today') return new Date().toISOString().slice(0, 10);
    var m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (m) {
      var d = parseInt(m[1], 10);
      var mo = parseInt(m[2], 10);
      var y = parseInt(m[3], 10);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return y + '-' + (mo < 10 ? '0' : '') + mo + '-' + (d < 10 ? '0' : '') + d;
      }
    }
    var parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return value;
  }

  /**
   * Resolver campi Nuovo Preventivo (usa window.preventivoState; per categoria/tipo lavoro
   * injectPreventivoForm rispecchia temporaneamente lavoriState).
   */
  function resolveValuePreventivo(fieldId, value, context) {
    if (value === undefined || value === null || value === '') return value;
    var ps = window.preventivoState;
    switch (fieldId) {
      case 'data-prevista':
        return normalizeDateForPreventivoInput(value);
      case 'cliente-id':
        if (!ps || !Array.isArray(ps.clienti)) return value;
        return _resolveByName(value, ps.clienti, 'ragioneSociale') || value;
      case 'terreno-id': {
        var listT = ps && ps.terreni;
        if (!ps || !Array.isArray(listT)) {
          return resolveTerrenoIdViaDomSelect(value) || value;
        }
        var rT = resolveTerrenoIdForPreventivo(value, listT);
        if (rT !== value) return rT;
        if (looksLikeFirestoreDocId(value)) return value;
        var domT = resolveTerrenoIdViaDomSelect(value);
        return domT || rT;
      }
      case 'lavoro-categoria-principale':
      case 'lavoro-sottocategoria':
        return resolveCategoriaLavori(value);
      case 'tipo-lavoro':
        return resolveTipoLavoroToNome(value);
      case 'coltura-categoria':
        if (!ps || !Array.isArray(ps.categorieColturePreventivo)) return value;
        return _resolveByName(value, ps.categorieColturePreventivo, 'nome') || value;
      case 'coltura': {
        var mapCol = (typeof window !== 'undefined' && window.colturePerCategoriaPreventivo) || {};
        var searchC = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!searchC) return value;
        var bestNome = null;
        var bestLen = 0;
        Object.keys(mapCol).forEach(function (cid) {
          var arr = mapCol[cid];
          if (!Array.isArray(arr)) return;
          arr.forEach(function (c) {
            var nome = (c && (c.nome || c)) || '';
            var n = String(nome).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (!n) return;
            if (n === searchC || n.indexOf(searchC) >= 0 || searchC.indexOf(n) >= 0) {
              var L = n.length;
              if (L > bestLen) {
                bestLen = L;
                bestNome = nome;
              }
            }
          });
        });
        return bestNome || value;
      }
      default:
        return value;
    }
  }

  function resolveValueLavoro(fieldId, value, context) {
    if (value === undefined || value === null || value === '') return value;
    switch (fieldId) {
      case 'lavoro-categoria-principale':
        return resolveCategoriaLavori(value);
      case 'lavoro-sottocategoria':
        return resolveSottocategoriaLavoriForCurrentCategory(value);
      case 'lavoro-tipo-lavoro': return resolveTipoLavoroToNome(value);
      case 'lavoro-terreno': return resolveFromLavoriState(value, 'terreniList', 'nome');
      case 'lavoro-caposquadra': return resolveFromLavoriState(value, 'caposquadraList', 'nome');
      case 'lavoro-operaio':
      case 'lavoro-operatore-macchina': return resolveFromLavoriState(value, 'operaiList', 'nome');
      case 'lavoro-trattore': return resolveFromLavoriState(value, 'trattoriList', 'nome');
      case 'lavoro-attrezzo': return resolveFromLavoriState(value, 'attrezziList', 'nome');
      default: return value;
    }
  }

  /**
   * Regole di business: casi speciali per form specifici.
   * Es: Gestione Lavori - se tipo-assegnazione è 'autonomo' e operatoreMacchinaId vuoto, usa operaioId.
   */
  function applyBusinessRules(formData, formId) {
    if (!formData || typeof formData !== 'object') return;
    if (formId === 'lavoro-form' || formId === 'lavoro-modal') {
      const tipoAssegnazione = formData['tipo-assegnazione'];
      const operatoreMacchinaId = formData['lavoro-operatore-macchina'];
      const operaioId = formData['lavoro-operaio'];
      if (tipoAssegnazione === 'autonomo' && !operatoreMacchinaId && operaioId) {
        formData['lavoro-operatore-macchina'] = operaioId;
        log('applyBusinessRules: tipo-assegnazione=autonomo, operatoreMacchinaId vuoto → usa operaioId: ' + operaioId);
      }
    }
  }

  /**
   * Deriva categoria e sottocategoria dal tipo lavoro (form lavori).
   * Usa tipiLavoroList per risalire a categoriaId e sottocategoriaId, poi risolve ai nomi.
   * Se ci sono più match (es. Erpicatura vs Erpicatura Tra le File), usa terreno per disambiguare.
   * @param {string} tipoNome - nome tipo lavoro
   * @param {Object} context - contesto Tony (lavori, azienda)
   * @param {Object} formData - dati form (lavoro-terreno per disambiguare)
   */
  function deriveParentsFromTipoLavoro(tipoNome, context, formData) {
    var tipi = (context && context.lavori && context.lavori.tipi_lavoro) || (window.lavoriState && window.lavoriState.tipiLavoroList) || [];
    var mainCats = (context && context.lavori && context.lavori.categorie_lavoro) || (window.lavoriState && window.lavoriState.categorieLavoriPrincipali) || [];
    var subMap = (window.lavoriState && window.lavoriState.sottocategorieLavoriMap) || null;
    var terreniList = (window.lavoriState && window.lavoriState.terreniList) || (context && context.lavori && context.lavori.terreni) || [];
    var search = (tipoNome || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!search || !tipi.length) return null;
    var matches = tipi.filter(function (t) {
      var n = ((t.nome || '') + '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return n === search || (n && (n.indexOf(search) >= 0 || search.indexOf(n) >= 0));
    });
    var job = null;
    var terreno = null;
    var hasFilari = false;
    if (formData && formData['lavoro-terreno']) {
      var terrenoVal = String(formData['lavoro-terreno'] || '').trim();
      var terrenoNome = terrenoVal.toLowerCase();
      terreno = terreniList.find(function (t) { return (t.id || '') === terrenoVal; });
      if (!terreno) {
        terreno = terreniList.find(function (t) {
          var n = (t.nome || '').toLowerCase();
          return n === terrenoNome || n.indexOf(terrenoNome) >= 0 || terrenoNome.indexOf(n) >= 0;
        });
      }
      hasFilari = terrenoHasFilariColtura(terreno);
    }
    if (matches.length > 1) {
      var preferMechanical = inferPreferMechanicalFromTipo(tipoNome);
      job = matches.slice().sort(function (a, b) {
        function score(t) {
          var n = normalizeTonyText(t && t.nome);
          if (!n) return -999;
          var sc = 0;
          if (hasFilari) {
            if (n.indexOf('tra le file') >= 0 || n.indexOf('sulla fila') >= 0) sc += 5;
            if (n.indexOf('pieno campo') >= 0 || n.indexOf('generale') >= 0) sc -= 3;
          } else {
            if (n.indexOf('tra le file') < 0 && n.indexOf('sulla fila') < 0) sc += 3;
          }
          if (preferMechanical) {
            if (n.indexOf('meccanic') >= 0) sc += 4;
            if (n.indexOf('manual') >= 0) sc -= 3;
          }
          sc += Math.min((t.nome || '').length, 80) / 100;
          return sc;
        }
        return score(b) - score(a);
      })[0];
    } else {
      job = matches.length > 0 ? matches[0] : null;
    }
    if (!job || !job.categoriaId) return null;
    var catId = job.categoriaId;
    var subId = job.sottocategoriaId || null;
    var mainCatIds = mainCats.map(function (c) { return c.id; }).filter(Boolean);
    var isMain = mainCatIds.indexOf(catId) >= 0;
    var mainCatId = catId;
    var subCatId = subId;
    if (!isMain && subMap && typeof subMap.forEach === 'function') {
      subMap.forEach(function (subs, parentId) {
        if (Array.isArray(subs) && subs.some(function (s) { return (s.id || s.value) === catId; })) {
          mainCatId = parentId;
          subCatId = catId;
        }
      });
    }
    var mainCat = mainCats.find(function (c) { return c.id === mainCatId; });
    var mainNome = mainCat ? (mainCat.nome || mainCat.text) : null;
    if (!mainNome) return null;
    var subNome = null;
    if (subCatId && subMap) {
      var subs = subMap.get ? subMap.get(mainCatId) : (subMap[mainCatId] || []);
      if (Array.isArray(subs)) {
        var sub = subs.find(function (s) { return (s.id || s.value) === subCatId; });
        subNome = sub ? (sub.nome || sub.text) : null;
      }
    }
    return subNome ? { categoriaNome: mainNome, sottocategoriaNome: subNome } : { categoriaNome: mainNome };
  }

  /**
   * Intelligenza assegnazione: se l'utente nomina un singolo operaio (non caposquadra),
   * switcha automaticamente su 'autonomo'. Default: 'squadra'.
   */
  function applyAssignmentIntelligence(formData) {
    if (!formData || typeof formData !== 'object') return;
    var operaioName = formData['lavoro-operaio'];
    var caposquadraName = formData['lavoro-caposquadra'];
    var tipoAssegnazione = formData['tipo-assegnazione'];
    if (tipoAssegnazione && tipoAssegnazione !== 'squadra') return;
    if (!window.lavoriState) return;
    var caposquadraList = window.lavoriState.caposquadraList || [];
    var operaiList = window.lavoriState.operaiList || [];
    var nameToCheck = operaioName || caposquadraName;
    if (!nameToCheck) return;
    var search = String(nameToCheck).toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var isCaposquadra = caposquadraList.some(function (c) {
      var n = ((c.nome || '') + ' ' + (c.cognome || '')).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return n && (n === search || n.indexOf(search) >= 0 || search.indexOf(n) >= 0);
    });
    var isOperaio = operaiList.some(function (o) {
      var n = ((o.nome || '') + ' ' + (o.cognome || '')).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return n && (n === search || n.indexOf(search) >= 0 || search.indexOf(n) >= 0);
    });
    if (operaioName && isOperaio && !isCaposquadra) {
      formData['tipo-assegnazione'] = 'autonomo';
      formData['lavoro-caposquadra'] = undefined;
      log('applyAssignmentIntelligence: operaio "' + operaioName + '" rilevato → tipo-assegnazione=autonomo');
    }
  }

  /**
   * Ottiene l'elemento DOM per un campo. Per RADIO usa name, per gli altri id.
   */
  function getFieldElement(fieldId, mapConfig) {
    var el = document.getElementById(fieldId);
    if (el) return el;
    var radio = document.querySelector('input[type="radio"][name="' + fieldId + '"]');
    if (radio) return { isRadioGroup: true, name: fieldId };
    return null;
  }

  /**
   * Imposta valore su SELECT: value + change
   */
  function setSelectValue(el, value, fieldId) {
    if (!el || el.tagName !== 'SELECT') return false;
    var resolved = value;
    var opts = Array.from(el.options);
    var valStr = String(value || '').trim();
    if (opts.some(function (o) { return o.value === value; })) {
      resolved = value;
    } else if (opts.some(function (o) { return (o.text || '').toLowerCase() === valStr.toLowerCase(); })) {
      var opt = opts.find(function (o) { return (o.text || '').toLowerCase() === valStr.toLowerCase(); });
      resolved = opt ? opt.value : value;
    } else if ((fieldId === 'attivita-tipo-lavoro-gerarchico' || fieldId === 'lavoro-tipo-lavoro' || fieldId === 'tipo-lavoro' || fieldId === 'coltura') && valStr && !/^[a-zA-Z0-9_-]{15,}$/.test(valStr)) {
      var partial = opts.find(function (o) {
        var t = (o.text || o.value || '').toLowerCase();
        var v = valStr.toLowerCase();
        return o.value && (t === v || t.startsWith(v) || t.includes(v) || v.includes(t.split(' ')[0] || ''));
      });
      if (partial) resolved = partial.value;
    } else if (fieldId === 'lavoro-terreno' && valStr) {
      var searchStr = valStr.toLowerCase();
      if (/^[a-zA-Z0-9_-]{15,}$/.test(valStr) && window.lavoriState && Array.isArray(window.lavoriState.terreniList)) {
        var terrenoById = window.lavoriState.terreniList.find(function (t) { return (t.id || '') === value; });
        if (terrenoById && terrenoById.nome) searchStr = String(terrenoById.nome).toLowerCase().trim();
      }
      var partialTerreno = opts.find(function (o) {
        if (!o.value) return false;
        var t = (o.text || '').toLowerCase();
        var nomePart = t.split('(')[0].trim();
        return t === searchStr || nomePart === searchStr || t.startsWith(searchStr) || nomePart.startsWith(searchStr) || searchStr.includes(nomePart) || nomePart.includes(searchStr);
      });
      if (partialTerreno) resolved = partialTerreno.value;
    } else if (fieldId === 'cliente-id' && valStr && window.preventivoState && Array.isArray(window.preventivoState.clienti)) {
      var searchCliente = valStr.toLowerCase().trim();
      if (/^[a-zA-Z0-9_-]{15,}$/.test(valStr)) {
        var clById = window.preventivoState.clienti.find(function (c) { return (c.id || '') === valStr; });
        if (clById && clById.ragioneSociale) searchCliente = String(clById.ragioneSociale).toLowerCase().trim();
      }
      var partialCliente = opts.find(function (o) {
        if (!o.value) return false;
        var t = (o.text || '').toLowerCase();
        var nomePart = t.split('(')[0].trim();
        return t === searchCliente || nomePart === searchCliente || t.startsWith(searchCliente) || nomePart.startsWith(searchCliente) || searchCliente.includes(nomePart) || nomePart.includes(searchCliente);
      });
      if (partialCliente) resolved = partialCliente.value;
    } else if (fieldId === 'terreno-id' && valStr && window.preventivoState && Array.isArray(window.preventivoState.terreni)) {
      var searchTerrenoP = valStr.toLowerCase().trim();
      if (/^[a-zA-Z0-9_-]{15,}$/.test(valStr)) {
        var trById = window.preventivoState.terreni.find(function (t) { return (t.id || '') === valStr; });
        if (trById && trById.nome) searchTerrenoP = String(trById.nome).toLowerCase().trim();
      }
      var partialTerrenoP = opts.find(function (o) {
        if (!o.value) return false;
        var t = (o.text || '').toLowerCase();
        var nomePart = t.split('(')[0].trim();
        return t === searchTerrenoP || nomePart === searchTerrenoP || t.startsWith(searchTerrenoP) || nomePart.startsWith(searchTerrenoP) || searchTerrenoP.includes(nomePart) || nomePart.includes(searchTerrenoP);
      });
      if (partialTerrenoP) resolved = partialTerrenoP.value;
    } else if (fieldId === 'mov-prodotto' && valStr) {
      var searchMov = valStr.toLowerCase().trim();
      if (!/^[a-zA-Z0-9_-]{15,}$/.test(valStr)) {
        var partialMov = opts.find(function (o) {
          if (!o.value) return false;
          var t = (o.text || '').toLowerCase();
          var nomePart = t.split(/[–-]/)[0].trim();
          return t === searchMov || nomePart === searchMov || t.indexOf(searchMov) >= 0 || nomePart.indexOf(searchMov) >= 0 || searchMov.indexOf(nomePart.split(/\s+/)[0] || '') >= 0;
        });
        if (partialMov) resolved = partialMov.value;
      }
    } else if ((fieldId === 'lavoro-trattore' || fieldId === 'lavoro-attrezzo') && valStr && window.lavoriState) {
      var macList = fieldId === 'lavoro-trattore'
        ? (window.lavoriState.trattoriList || [])
        : (window.lavoriState.attrezziList || []);
      var searchMac = valStr.toLowerCase().trim();
      if (/^[a-zA-Z0-9_-]{15,}$/.test(valStr)) {
        var exactMacOpt = opts.find(function (o) { return (o.value || '') === valStr; });
        if (exactMacOpt) resolved = exactMacOpt.value;
      }
      if (String(resolved) === String(value || '').trim() || !opts.some(function (o) { return o.value === resolved; })) {
        var partialMac = opts.find(function (o) {
          if (!o.value) return false;
          var t = (o.text || '').toLowerCase();
          var nomePart = t.replace(/^[^\w]*\s*/, '').split('(')[0].trim();
          var fw = (nomePart.split(/\s+/)[0] || '').trim();
          return t.indexOf(searchMac) >= 0 || nomePart.indexOf(searchMac) >= 0 ||
            searchMac.indexOf(fw) >= 0 || searchMac.indexOf(nomePart) >= 0;
        });
        if (partialMac) resolved = partialMac.value;
      }
    } else if ((fieldId === 'ora-lavoro' || fieldId === 'ora-macchina' || fieldId === 'ora-attrezzo') && valStr) {
      var searchOra = valStr.toLowerCase().trim();
      if (/^[a-zA-Z0-9_-]{15,}$/.test(valStr) && opts.some(function (o) { return (o.value || '') === valStr; })) {
        resolved = valStr;
      } else {
        var partialOra = opts.find(function (o) {
          if (!o.value) return false;
          var t = (o.text || '').toLowerCase();
          var fw = (t.split(/\s+/)[0] || '').trim();
          return t === searchOra || t.indexOf(searchOra) >= 0 || searchOra.indexOf(fw) >= 0 || (fw && searchOra.indexOf(fw) >= 0);
        });
        if (partialOra) resolved = partialOra.value;
      }
    } else if ((fieldId === 'lavoro-operaio' || fieldId === 'lavoro-caposquadra') && valStr && window.lavoriState) {
      var searchStr = valStr.toLowerCase();
      var list = fieldId === 'lavoro-operaio' ? (window.lavoriState.operaiList || []) : (window.lavoriState.caposquadraList || []);
      if (/^[a-zA-Z0-9_-]{15,}$/.test(valStr) && list.length) {
        var item = list.find(function (i) { return (i.id || '') === value; });
        var display = item ? ((item.nome || '') + ' ' + (item.cognome || '')).trim() || item.email : null;
        if (display) searchStr = String(display).toLowerCase().trim().split(' ')[0] || searchStr;
      }
      var partialUser = opts.find(function (o) {
        if (!o.value) return false;
        var t = (o.text || '').toLowerCase();
        var firstWord = (t.split(' ')[0] || t.split('(')[0] || '').trim();
        return t === searchStr || firstWord === searchStr || t.startsWith(searchStr) || (firstWord && (searchStr.includes(firstWord) || firstWord.includes(searchStr)));
      });
      if (partialUser) resolved = partialUser.value;
    } else if (fieldId === 'lavoro-sottocategoria' && valStr && window.lavoriState) {
      var catEl = document.getElementById('lavoro-categoria-principale');
      var catId = catEl ? catEl.value : null;
      var subMap = window.lavoriState.sottocategorieLavoriMap;
      var subs = subMap && subMap.get && catId ? subMap.get(catId) : [];
      if (Array.isArray(subs) && subs.length) {
        var sub = subs.find(function (s) { return (s.id || '') === value; });
        var subNome = sub ? String(sub.nome || sub.text || '').toLowerCase().trim() : null;
        if (subNome) {
          var partialSub = opts.find(function (o) {
            if (!o.value) return false;
            var t = (o.text || '').toLowerCase();
            return t === subNome || t.includes(subNome) || subNome.includes(t);
          });
          if (partialSub) resolved = partialSub.value;
        }
      }
    }
    if (String(el.value || '') === String(resolved || '')) {
      log('Campo SELECT ' + fieldId + ' già impostato a "' + resolved + '" (skip change)');
      return true;
    }
    el.value = resolved;
    if ((fieldId === 'lavoro-trattore' || fieldId === 'lavoro-attrezzo') && String(el.value) !== String(resolved)) {
      var idxMac = Array.from(el.options).findIndex(function (o) { return String(o.value || '') === String(resolved); });
      if (idxMac >= 0) {
        var optMac = el.options[idxMac];
        var wasDisMac = optMac.disabled;
        if (wasDisMac) optMac.disabled = false;
        el.selectedIndex = idxMac;
      }
    }
    if (fieldId === 'terreno-id' && resolved != null && String(resolved).trim() !== '') {
      var wantT = String(resolved).trim();
      if (String(el.value) !== wantT) {
        var idxT = Array.from(el.options).findIndex(function (o) { return (o.value || '') === wantT; });
        if (idxT >= 0) el.selectedIndex = idxT;
      }
      if (String(el.value) !== wantT) {
        var dbgVals = Array.from(el.options || []).map(function (o) { return (o.value || '') + '::' + (o.text || ''); }).join(' || ');
        log('preventivo terreno-id: browser non ha accettato il value (effettivo="' + el.value + '" atteso="' + wantT + '", opzioni=' + (el.options ? el.options.length : 0) + ') values=' + dbgVals);
      }
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    if (typeof window.jQuery === 'function') {
      try { window.jQuery(el).trigger('change').trigger('input'); } catch (_) {}
    }
    log('Iniettato campo SELECT ' + fieldId + ' = "' + resolved + '" (DOM value="' + (el && el.value != null ? el.value : '') + '")');
    return true;
  }

  /**
   * Imposta valore su RADIO: seleziona input con value corrispondente, dispatch change
   */
  function setRadioValue(fieldName, value, fieldId) {
    var inputs = document.querySelectorAll('input[type="radio"][name="' + fieldName + '"]');
    if (!inputs.length) return false;
    var valStr = String(value || '').toLowerCase().trim();
    if (fieldName === 'tipo-assegnazione' && (valStr === 'caposquadra' || valStr === 'capo' || valStr === 'con_caposquadra')) {
      valStr = 'squadra';
    }
    var target = Array.from(inputs).find(function (r) {
      return (r.value || '').toLowerCase() === valStr;
    });
    if (!target) {
      log('RADIO ' + fieldId + ': nessun input con value="' + value + '"');
      return false;
    }
    target.checked = true;
    target.dispatchEvent(new Event('change', { bubbles: true }));
    target.dispatchEvent(new Event('input', { bubbles: true }));
    if (typeof window.jQuery === 'function') {
      try { window.jQuery(target).trigger('change').trigger('input'); } catch (_) {}
    }
    log('Iniettato campo RADIO ' + fieldId + ' = "' + value + '"');
    return true;
  }

  /**
   * Imposta valore su TEXT/NUMBER/DATE/TIME/TEXTAREA/CHECKBOX: value + eventi
   */
  function setInputValue(el, value, fieldId) {
    if (!el) return false;
    var tag = (el.tagName || '').toUpperCase();
    var type = (el.type || '').toLowerCase();
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') return false;
    if (type === 'checkbox') {
      var checked = false;
      if (value === true || value === 1) checked = true;
      else if (value === false || value === 0) checked = false;
      else if (typeof value === 'string') {
        var z = value.trim().toLowerCase();
        checked =
          z === 'true' ||
          z === '1' ||
          z === 'sì' ||
          z === 'si' ||
          z === 'yes' ||
          z === 'on' ||
          z === 'vero' ||
          z === 'spuntato' ||
          z === 'attivo';
      } else {
        checked = !!value;
      }
      el.checked = checked;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof window.jQuery === 'function') {
        try { window.jQuery(el).trigger('input').trigger('change'); } catch (_) {}
      }
      log('Iniettato campo checkbox ' + fieldId + ' = ' + checked);
      return true;
    }
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (typeof window.jQuery === 'function') {
      try { window.jQuery(el).trigger('input').trigger('change'); } catch (_) {}
    }
    log('Iniettato campo ' + (type || 'text') + ' ' + fieldId + ' = "' + value + '"');
    return true;
  }

  const DELAYS_TERRENO = {
    'terreno-coltura-categoria': 350,
    'terreno-coltura': 280,
    'terreno-podere': 120,
    'terreno-tipo-possesso': 80
  };

  function _normalizeSearchTerreno(s) {
    return String(s || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function _matchSelectOptionByText(el, rawValue) {
    if (!el || el.tagName !== 'SELECT' || !rawValue) return null;
    var search = _normalizeSearchTerreno(rawValue);
    if (!search) return null;
    var opts = Array.from(el.options || []);
    var exact = opts.find(function (o) {
      if (!(o.value || '').trim() && !(o.text || '').trim()) return false;
      var t = _normalizeSearchTerreno(o.text || o.value);
      return t === search;
    });
    if (exact) return exact.value || exact.text;
    var partial = opts.find(function (o) {
      if (!(o.value || '').trim()) return false;
      var t = _normalizeSearchTerreno(o.text || o.value);
      return t && (t.indexOf(search) >= 0 || search.indexOf(t) >= 0);
    });
    return partial ? (partial.value || partial.text) : null;
  }

  /**
   * Resolver form terreno: categoria/podere da contesto azienda; coltura per nome su select.
   */
  function resolveValueTerreno(fieldId, value, context) {
    if (value === undefined || value === null) return value;
    var str = String(value).trim();
    if (!str) return value;
    context = context || (window.Tony && window.Tony.context) || {};
    var azienda = context.azienda || {};

    if (fieldId === 'terreno-coltura-categoria') {
      if (looksLikeFirestoreDocId(str)) return str;
      var categorie = Array.isArray(azienda.categorie) ? azienda.categorie : [];
      var catHit = categorie.find(function (c) {
        var n = _normalizeSearchTerreno(c.nome || '');
        var s = _normalizeSearchTerreno(str);
        return n && (n === s || n.indexOf(s) >= 0 || s.indexOf(n) >= 0);
      });
      if (catHit && catHit.id) return catHit.id;
      var catEl = document.getElementById('terreno-coltura-categoria');
      var domCat = _matchSelectOptionByText(catEl, str);
      return domCat != null ? domCat : value;
    }

    if (fieldId === 'terreno-coltura') {
      var colture = Array.isArray(azienda.colture) ? azienda.colture : [];
      var colHit = colture.find(function (c) {
        var n = _normalizeSearchTerreno(c.nome || '');
        var s = _normalizeSearchTerreno(str);
        return n && (n === s || n.indexOf(s) >= 0 || s.indexOf(n) >= 0);
      });
      if (colHit && colHit.nome) return colHit.nome;
      var colEl = document.getElementById('terreno-coltura');
      var domCol = _matchSelectOptionByText(colEl, str);
      return domCol != null ? domCol : value;
    }

    if (fieldId === 'terreno-podere') {
      var poderi = Array.isArray(azienda.poderi) ? azienda.poderi : [];
      var podHit = poderi.find(function (p) {
        var n = _normalizeSearchTerreno(p.nome || '');
        var s = _normalizeSearchTerreno(str);
        return n && (n === s || n.indexOf(s) >= 0 || s.indexOf(n) >= 0);
      });
      if (podHit && podHit.nome) return podHit.nome;
      var podEl = document.getElementById('terreno-podere');
      var domPod = _matchSelectOptionByText(podEl, str);
      return domPod != null ? domPod : value;
    }

    if (fieldId === 'terreno-tipo-campo' || fieldId === 'terreno-tipo-possesso') {
      var low = _normalizeSearchTerreno(str);
      if (fieldId === 'terreno-tipo-campo') {
        if (low.indexOf('mont') >= 0) return 'montagna';
        if (low.indexOf('coll') >= 0) return 'collina';
        if (low.indexOf('pian') >= 0) return 'pianura';
      }
      if (fieldId === 'terreno-tipo-possesso') {
        if (low.indexOf('affit') >= 0) return 'affitto';
        if (low.indexOf('propri') >= 0) return 'proprieta';
      }
    }

    return value;
  }

  function _resolveTerrenoCategoriaIdFromDom(hintNorm) {
    if (!hintNorm) return null;
    var catEl = document.getElementById('terreno-coltura-categoria');
    if (!catEl) return null;
    return Array.from(catEl.options || []).reduce(function (found, o) {
      if (found || !(o.value || '').trim()) return found;
      var t = _normalizeSearchTerreno(o.text || o.value);
      if (!t) return found;
      if (t === hintNorm || t.indexOf(hintNorm) >= 0 || hintNorm.indexOf(t) >= 0) return o.value;
      return found;
    }, null);
  }

  function _findTerrenoCategoriaId(categorie, hintNorm) {
    if (!hintNorm) return null;
    var hints = [hintNorm];
    if (hintNorm.indexOf('vigneto') >= 0 || hintNorm === 'vite') hints.push('vite', 'vigneto', 'vino');
    if (hintNorm.indexOf('frutteto') >= 0 || hintNorm.indexOf('frutt') >= 0) hints.push('frutteto', 'frutt');
    if (hintNorm.indexOf('seminativ') >= 0) hints.push('seminativ', 'seminativo');
    if (hintNorm.indexOf('oliv') >= 0) hints.push('oliv', 'olivo');
    if (hintNorm.indexOf('ortiv') >= 0) hints.push('ortiv', 'orto');
    var seen = {};
    for (var hi = 0; hi < hints.length; hi++) {
      var hint = hints[hi];
      if (!hint || seen[hint]) continue;
      seen[hint] = true;
      var catHit = (categorie || []).find(function (c) {
        var n = _normalizeSearchTerreno(c.nome || '');
        return n && (n === hint || n.indexOf(hint) >= 0 || hint.indexOf(n) >= 0);
      });
      if (catHit && catHit.id) return catHit.id;
      var domId = _resolveTerrenoCategoriaIdFromDom(hint);
      if (domId) return domId;
    }
    return null;
  }

  function _colturaOptionMatchesName(optionEl, colNameNorm) {
    if (!optionEl || !(optionEl.value || '').trim() || !colNameNorm) return false;
    var t = _normalizeSearchTerreno(optionEl.text || optionEl.value);
    return t === colNameNorm || t.indexOf(colNameNorm) >= 0 || colNameNorm.indexOf(t) >= 0;
  }

  async function _findTerrenoCategoriaIdByColturaNameInDom(colName) {
    var colNorm = _normalizeSearchTerreno(colName);
    if (!colNorm) return null;
    var catEl = document.getElementById('terreno-coltura-categoria');
    var colEl = document.getElementById('terreno-coltura');
    if (!catEl || !colEl) return null;
    var prevCat = catEl.value || '';
    var opts = Array.from(catEl.options || []).filter(function (o) { return (o.value || '').trim(); });
    for (var i = 0; i < opts.length; i++) {
      catEl.value = opts[i].value;
      catEl.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof window.updateColtureDropdownTerreni === 'function') {
        window.updateColtureDropdownTerreni();
      }
      await delay(60);
      var match = Array.from(colEl.options || []).find(function (o) {
        return _colturaOptionMatchesName(o, colNorm);
      });
      if (match) {
        log('Scan DOM terreno: coltura "' + colName + '" in categoria id=' + opts[i].value);
        return opts[i].value;
      }
    }
    catEl.value = prevCat;
    catEl.dispatchEvent(new Event('change', { bubbles: true }));
    if (typeof window.updateColtureDropdownTerreni === 'function') {
      window.updateColtureDropdownTerreni();
    }
    return null;
  }

  async function _ensureTerrenoColturaCategoriaInFormData(formData, context) {
    var fd = enrichTerrenoFormDataFromContext(formData, context);
    if (!fd['terreno-coltura'] || fd['terreno-coltura-categoria']) return fd;
    await waitForSelectOptions('terreno-coltura-categoria', 2, 12000);
    fd = enrichTerrenoFormDataFromContext(fd, context);
    if (fd['terreno-coltura-categoria']) return fd;
    var colName = String(fd['terreno-coltura']).trim();
    var scannedId = await _findTerrenoCategoriaIdByColturaNameInDom(colName);
    if (scannedId) fd['terreno-coltura-categoria'] = scannedId;
    return fd;
  }

  function _inferTerrenoCategoriaHintFromText(text) {
    var colNorm = _normalizeSearchTerreno(text);
    if (!colNorm) return null;
    var rules = [
      { keys: ['vite', 'vino', 'vigneto'], hint: 'vigneto' },
      { keys: ['frutt', 'albicoc', 'pesc', 'melo', 'pero', 'kaki', 'cilieg', 'nettar'], hint: 'frutteto' },
      { keys: ['oliv'], hint: 'oliv' },
      { keys: ['grano', 'mais', 'orzo', 'frumento', 'seminat'], hint: 'seminativ' },
      { keys: ['orto', 'pomodor', 'insalat', 'zucchin'], hint: 'ortiv' }
    ];
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].keys.some(function (k) { return colNorm.indexOf(k) >= 0; })) return rules[i].hint;
    }
    return null;
  }

  function enrichTerrenoFormDataFromContext(formData, context) {
    if (!formData || typeof formData !== 'object') return formData;
    var fd = Object.assign({}, formData);
    context = context || (window.Tony && window.Tony.context) || {};
    var colture = (context.azienda && Array.isArray(context.azienda.colture)) ? context.azienda.colture : [];
    var categorie = (context.azienda && Array.isArray(context.azienda.categorie)) ? context.azienda.categorie : [];

    if (fd['terreno-coltura'] && !fd['terreno-coltura-categoria']) {
      var colName = String(fd['terreno-coltura']).trim();
      var colObj = colture.find(function (c) {
        var n = _normalizeSearchTerreno(c.nome || '');
        var s = _normalizeSearchTerreno(colName);
        return n && (n === s || n.indexOf(s) >= 0 || s.indexOf(n) >= 0);
      });
      if (colObj && colObj.categoriaId) {
        fd['terreno-coltura-categoria'] = colObj.categoriaId;
      }
      if (!fd['terreno-coltura-categoria']) {
        var catDirect = categorie.find(function (c) {
          var n = _normalizeSearchTerreno(c.nome || '');
          var s = _normalizeSearchTerreno(colName);
          return n && s && (s.indexOf(n) >= 0 || n.indexOf(s) >= 0);
        });
        if (catDirect && catDirect.id) fd['terreno-coltura-categoria'] = catDirect.id;
      }
      if (!fd['terreno-coltura-categoria']) {
        var hintFromColtura = _inferTerrenoCategoriaHintFromText(colName);
        var catIdFromColtura = _findTerrenoCategoriaId(categorie, hintFromColtura);
        if (catIdFromColtura) fd['terreno-coltura-categoria'] = catIdFromColtura;
      }
    }

    if (!fd['terreno-coltura-categoria'] && fd['terreno-nome']) {
      var nomeLow = _normalizeSearchTerreno(fd['terreno-nome']);
      var catByNome = categorie.find(function (c) {
        var n = _normalizeSearchTerreno(c.nome || '');
        return n && nomeLow.indexOf(n) >= 0;
      });
      if (catByNome && catByNome.id) {
        fd['terreno-coltura-categoria'] = catByNome.id;
      } else {
        var catIdFromNome = _findTerrenoCategoriaId(categorie, nomeLow);
        if (!catIdFromNome) {
          var hintFromNome = _inferTerrenoCategoriaHintFromText(fd['terreno-nome']);
          catIdFromNome = _findTerrenoCategoriaId(categorie, hintFromNome);
        }
        if (catIdFromNome) fd['terreno-coltura-categoria'] = catIdFromNome;
      }
    }

    if (!fd['terreno-tipo-possesso']) fd['terreno-tipo-possesso'] = 'proprieta';
    return fd;
  }

  /**
   * Resolver per form magazzino (movimento): mov-prodotto da nome tramite context.azienda.prodotti;
   * mov-lavoro / mov-attivita per testo su option DOM se non è già id.
   */
  function resolveValueMagazzino(fieldId, value, context) {
    if (value === undefined || value === null) return value;
    var str = String(value).trim();
    if (!str) return value;
    context = context || (window.Tony && window.Tony.context) || {};
    if (fieldId === 'mov-prodotto') {
      if (/^[a-zA-Z0-9_-]{15,}$/.test(str)) return str;
      var prodotti = (context.azienda && Array.isArray(context.azienda.prodotti)) ? context.azienda.prodotti : [];
      var low = str.toLowerCase();
      var hit = prodotti.find(function (p) {
        var n = (p.nome || '').toLowerCase();
        return n === low || n.indexOf(low) >= 0 || low.indexOf(n) >= 0;
      });
      if (hit && hit.id) return hit.id;
      return value;
    }
    if (fieldId === 'mov-lavoro' || fieldId === 'mov-attivita') {
      if (/^[a-zA-Z0-9_-]{15,}$/.test(str)) return str;
      var el = document.getElementById(fieldId);
      if (el && el.tagName === 'SELECT' && el.options && el.options.length) {
        var search = str.toLowerCase();
        var opt = Array.from(el.options).find(function (o) {
          if (!o.value) return false;
          var t = (o.text || '').toLowerCase();
          var first = (t.split(/\s+/)[0] || '').trim();
          return t === search || t.indexOf(search) >= 0 || search.indexOf(first) >= 0;
        });
        if (opt) return opt.value;
      }
      return value;
    }
    return value;
  }

  /**
   * Imposta valore su un singolo campo in base al tipo elemento.
   */
  function setFieldValue(fieldId, value, mapConfig, context) {
    var resolver = (mapConfig && mapConfig.resolver) || null;
    var resolved = value;
    if (typeof resolver === 'function') {
      resolved = resolver(fieldId, value, context);
    } else if (mapConfig && mapConfig.fields && mapConfig.fields[fieldId] && typeof mapConfig.fields[fieldId].resolver === 'function') {
      resolved = mapConfig.fields[fieldId].resolver(value, mapConfig.fields[fieldId], context);
    }
    if (resolved === undefined || resolved === null) resolved = value;

    var el = document.getElementById(fieldId);
    var radio = document.querySelector('input[type="radio"][name="' + fieldId + '"]');

    if (radio) {
      return setRadioValue(fieldId, resolved, fieldId);
    }
    if (el && el.tagName === 'SELECT') {
      if (fieldId === 'terreno-id' && mapConfig && mapConfig.formId === 'preventivo-form') {
        resolved = coercePreventivoTerrenoSelectToDomOption(el, resolved, value);
      }
      return setSelectValue(el, resolved, fieldId);
    }
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
      return setInputValue(el, resolved, fieldId);
    }

    log('Campo ' + fieldId + ' non trovato o tipo non supportato');
    return false;
  }

  /**
   * Metodo principale: injectForm(formData, mapConfig)
   * Scorre i campi in mapConfig.injectionOrder, imposta valori, rispetta delays.
   *
   * @param {Object} formData - { fieldId: value, ... }
   * @param {Object} mapConfig - {
   *   formId: string,
   *   injectionOrder: string[],
   *   delays: { [fieldId]: number },
   *   resolver: function(fieldId, value, context),
   *   fields: { [fieldId]: { resolver, type, ... } }
   * }
   * @param {Object} context - contesto Tony (attivita, lavori, ecc.)
   * @param {{ skipFieldIds?: Object.<string, boolean> }} [injectOpts] - es. salta cliente-id se già impostato in pre-sync preventivo
   * @returns {Promise<boolean>}
   */
  async function injectForm(formData, mapConfig, context, injectOpts) {
    if (!formData || typeof formData !== 'object') {
      log('injectForm: formData vuoto o non valido');
      return false;
    }
    if (!mapConfig || !Array.isArray(mapConfig.injectionOrder)) {
      log('injectForm: mapConfig.injectionOrder mancante');
      return false;
    }

    injectOpts = injectOpts || {};
    var skipFieldIds = injectOpts.skipFieldIds || null;
    var patchOnly = !!injectOpts.patchOnly;
    var forceFields = injectOpts.forceFields || null;

    function fieldAlreadyHasValue(fieldId) {
      var el = document.getElementById(fieldId);
      if (!el) return false;
      if (el.tagName === 'SELECT') {
        return lavoroSelectHasChoice(fieldId);
      }
      return String(el.value || '').trim() !== '';
    }

    context = context || (window.Tony && window.Tony.context) || {};
    var formId = mapConfig.formId || mapConfig.modalId || 'unknown';
    var delays = mapConfig.delays || {};
    var injectionOrder = mapConfig.injectionOrder;
    var isLavoroForm = formId === 'lavoro-form';
    function lw(ms) {
      return isLavoroForm ? lavoroSelectWaitMs(injectOpts, ms) : ms;
    }

    applyBusinessRules(formData, formId);
    log('Avvio iniezione form ' + formId + ' con ' + Object.keys(formData).length + ' campi');

    for (var i = 0; i < injectionOrder.length; i++) {
      var fieldId = injectionOrder[i];
      var value = formData[fieldId];
      if (value === undefined || value === null) continue;

      if (skipFieldIds && skipFieldIds[fieldId]) {
        log('injectForm: salto ' + fieldId + ' (già sincronizzato prima del loop)');
        continue;
      }

      if (patchOnly && fieldAlreadyHasValue(fieldId) && !(forceFields && forceFields[fieldId])) {
        log('injectForm patchOnly: salto ' + fieldId + ' (già valorizzato in DOM)');
        continue;
      }

      if (fieldId === 'attivita-sottocategoria') {
        await waitForSelectOptions('attivita-sottocategoria', 2);
      }
      if (fieldId === 'attivita-coltura-categoria') {
        await waitForSelectOptions('attivita-coltura-categoria', 2);
      }
      if (fieldId === 'attivita-coltura-gerarchica') {
        if (typeof window.updateColtureDropdownAttivita === 'function') {
          window.updateColtureDropdownAttivita();
        }
        await waitForSelectOptions('attivita-coltura-gerarchica', 2);
        var rawColAtt = formData[fieldId];
        var rawColStrAtt = rawColAtt != null ? String(rawColAtt).trim() : '';
        if (rawColStrAtt) {
          await waitForSelectOptionTextOrValue('attivita-coltura-gerarchica', rawColStrAtt, 8000);
        }
      }
      if (formId === 'lavoro-form' && fieldId === 'lavoro-categoria-principale') {
        await waitForSelectOptions('lavoro-sottocategoria', 2, lw(8000));
      }
      if (fieldId === 'lavoro-sottocategoria') {
        var subGroup = document.getElementById('lavoro-sottocategoria-group');
        if (subGroup) subGroup.style.display = 'block';
        await waitForSelectOptions('lavoro-sottocategoria', 2, lw(8000));
        var rawSubLav = formData[fieldId];
        var rawSubStrLav = rawSubLav != null ? String(rawSubLav).trim() : '';
        if (rawSubStrLav) {
          if (looksLikeFirestoreDocId(rawSubStrLav)) {
            await waitForSelectOptionValue('lavoro-sottocategoria', rawSubStrLav, lw(8000));
          } else {
            await waitForSelectOptionTextOrValue('lavoro-sottocategoria', rawSubStrLav, lw(8000));
          }
        }
      }
      if (fieldId === 'lavoro-tipo-lavoro') {
        var tipoGroup = document.getElementById('tipo-lavoro-group');
        if (tipoGroup) tipoGroup.style.display = 'block';
        await waitForSelectOptions('lavoro-tipo-lavoro', 2, lw(8000));
        var rawTipoLav = formData[fieldId];
        var rawTipoStrLav = rawTipoLav != null ? String(rawTipoLav).trim() : '';
        if (rawTipoStrLav) {
          await waitForSelectOptionTextOrValue('lavoro-tipo-lavoro', rawTipoStrLav, lw(8000));
        }
      }
      if (formId === 'preventivo-form' && fieldId === 'lavoro-sottocategoria') {
        var subGroupP = document.getElementById('lavoro-sottocategoria-group');
        if (subGroupP) subGroupP.style.display = 'block';
        await waitForSelectOptions('lavoro-sottocategoria', 2);
        // loadTipiLavoro popola le sottocategorie dopo la categoria: 2 option non bastano se l'id cercato non è ancora nel DOM
        var rawSubW = formData[fieldId];
        var rawSubStrW = rawSubW != null ? String(rawSubW).trim() : '';
        if (rawSubStrW && looksLikeFirestoreDocId(rawSubStrW)) {
          await waitForSelectOptionValue('lavoro-sottocategoria', rawSubStrW, 12000);
        }
      }
      if (formId === 'preventivo-form' && fieldId === 'tipo-lavoro') {
        await waitForSelectOptions('tipo-lavoro', 2, 14000);
      }
      if (formId === 'preventivo-form' && fieldId === 'coltura') {
        if (typeof window.updateColtureDropdownPreventivo === 'function') {
          window.updateColtureDropdownPreventivo();
        }
        await waitForSelectOptions('coltura', 2);
      }
      if (fieldId === 'lavoro-operaio' || fieldId === 'lavoro-caposquadra') {
        await waitForSelectOptions(fieldId, 2);
      }
      if (formId === 'lavoro-form' && fieldId === 'lavoro-trattore') {
        await waitForLavoriStateList('trattoriList', 1, lw(6000));
        await waitForSelectOptionsWithValue('lavoro-trattore', 1, lw(6000));
        var rawTrInj = formData[fieldId];
        var rawTrStrInj = rawTrInj != null ? String(rawTrInj).trim() : '';
        if (rawTrStrInj) {
          if (looksLikeFirestoreDocId(rawTrStrInj)) {
            await waitForSelectOptionValue('lavoro-trattore', rawTrStrInj, lw(6000));
          } else {
            await waitForSelectOptionTextOrValue('lavoro-trattore', rawTrStrInj, lw(6000));
          }
        }
      }
      if (formId === 'lavoro-form' && fieldId === 'lavoro-attrezzo') {
        var trElForAtt = document.getElementById('lavoro-trattore');
        if (trElForAtt && trElForAtt.value) {
          trElForAtt.dispatchEvent(new Event('change', { bubbles: true }));
          await delay(80);
        }
        await waitForLavoriStateList('attrezziList', 1, lw(6000));
        var rawAtInj = formData[fieldId];
        var rawAtStrInj = rawAtInj != null ? String(rawAtInj).trim() : '';
        if (rawAtStrInj) {
          if (looksLikeFirestoreDocId(rawAtStrInj)) {
            await waitForSelectOptionValue('lavoro-attrezzo', rawAtStrInj, lw(6000));
          } else {
            await waitForSelectOptionsWithValue('lavoro-attrezzo', 1, lw(6000));
            await waitForSelectOptionTextOrValue('lavoro-attrezzo', rawAtStrInj, lw(6000));
          }
        } else {
          await waitForSelectOptionsWithValue('lavoro-attrezzo', 1, lw(6000));
        }
      }
      if (formId === 'terreno-form' && fieldId === 'terreno-coltura-categoria') {
        await waitForSelectOptions('terreno-coltura-categoria', 2, 12000);
        var rawCatTer = formData[fieldId];
        var rawCatStrTer = rawCatTer != null ? String(rawCatTer).trim() : '';
        if (rawCatStrTer) {
          if (looksLikeFirestoreDocId(rawCatStrTer)) {
            await waitForSelectOptionValue('terreno-coltura-categoria', rawCatStrTer, 10000);
          } else {
            await waitForSelectOptionTextOrValue('terreno-coltura-categoria', rawCatStrTer, 10000);
          }
        }
      }
      if (formId === 'terreno-form' && fieldId === 'terreno-coltura') {
        var catSelPre = document.getElementById('terreno-coltura-categoria');
        if (catSelPre && !catSelPre.value) {
          if (formData['terreno-coltura-categoria']) {
            await waitForSelectOptions('terreno-coltura-categoria', 2, 10000);
            setFieldValue('terreno-coltura-categoria', formData['terreno-coltura-categoria'], mapConfig, context);
            if (typeof window.updateColtureDropdownTerreni === 'function') {
              window.updateColtureDropdownTerreni();
            }
            await delay(280);
          } else if (formData['terreno-coltura']) {
            var autoCatId = await _findTerrenoCategoriaIdByColturaNameInDom(String(formData['terreno-coltura']).trim());
            if (autoCatId) {
              formData['terreno-coltura-categoria'] = autoCatId;
              setFieldValue('terreno-coltura-categoria', autoCatId, mapConfig, context);
              if (typeof window.updateColtureDropdownTerreni === 'function') {
                window.updateColtureDropdownTerreni();
              }
              await delay(280);
            }
          }
        }
        if (typeof window.updateColtureDropdownTerreni === 'function') {
          window.updateColtureDropdownTerreni();
        }
        await delay(280);
        await waitForSelectOptions('terreno-coltura', 2, 10000);
        var rawColTer = formData[fieldId];
        var rawColStrTer = rawColTer != null ? String(rawColTer).trim() : '';
        if (rawColStrTer) {
          await waitForSelectOptionTextOrValue('terreno-coltura', rawColStrTer, 10000);
        }
      }
      if (formId === 'terreno-form' && fieldId === 'terreno-podere') {
        await waitForSelectOptions('terreno-podere', 2, 8000);
        var rawPodTer = formData[fieldId];
        var rawPodStrTer = rawPodTer != null ? String(rawPodTer).trim() : '';
        if (rawPodStrTer) {
          await waitForSelectOptionTextOrValue('terreno-podere', rawPodStrTer, 8000);
        }
      }
      if (formId === 'movimento-form' && fieldId === 'mov-prodotto') {
        await waitForSelectOptions('mov-prodotto', 2, 12000);
      }
      if (formId === 'movimento-form' && (fieldId === 'mov-lavoro' || fieldId === 'mov-attivita')) {
        await waitForSelectOptions(fieldId, 2, 8000);
      }
      if (formId === 'preventivo-form' && fieldId === 'terreno-id') {
        await awaitPreventivoTerreniFetchDone(12000);
        var rawTerreno = value;
        if (rawTerreno !== undefined && rawTerreno !== null && String(rawTerreno).trim() !== '') {
          var resTerreno = rawTerreno;
          if (typeof mapConfig.resolver === 'function') {
            resTerreno = mapConfig.resolver('terreno-id', rawTerreno, context);
          }
          if (resTerreno === undefined || resTerreno === null) resTerreno = rawTerreno;
          var resStr = String(resTerreno).trim();
          if (resStr) {
            log('Attesa opzione terreno-id nel select (loadTerreniCliente async dopo cliente)...');
            if (looksLikeFirestoreDocId(resStr)) {
              await waitForSelectOptionValue('terreno-id', resStr, 10000);
            } else {
              log('preventivo: terreno hint non ancora id dopo resolver, attendo solo dropdown popolato');
              await waitForSelectOptions('terreno-id', 2, 8000);
            }
          }
        }
      }
      setFieldValue(fieldId, value, mapConfig, context);

      if (formId === 'attivita-form' && fieldId === 'attivita-coltura-categoria') {
        if (typeof window.updateColtureDropdownAttivita === 'function') {
          window.updateColtureDropdownAttivita();
        }
        await delay(280);
      }
      if (formId === 'preventivo-form' && fieldId === 'coltura-categoria') {
        if (typeof window.updateColtureDropdownPreventivo === 'function') {
          window.updateColtureDropdownPreventivo();
        }
        await delay(280);
      }
      if (formId === 'terreno-form' && fieldId === 'terreno-coltura-categoria') {
        if (typeof window.updateColtureDropdownTerreni === 'function') {
          window.updateColtureDropdownTerreni();
        }
        await delay(280);
      }
      if (formId === 'terreno-form' && fieldId === 'terreno-tipo-possesso') {
        if (typeof window.toggleDataScadenzaAffitto === 'function') {
          window.toggleDataScadenzaAffitto();
        }
      }

      var ms = delays[fieldId];
      if (ms && ms > 0) {
        log('Attesa ' + ms + 'ms dopo ' + fieldId + ' (dropdown dipendenti)...');
        await delay(ms);
      }
      if (formId === 'preventivo-form' && fieldId === 'cliente-id') {
        await awaitPreventivoTerreniFetchDone(12000);
      }
    }

    if (formId === 'movimento-form') {
      var ctxMovPz = context || (window.Tony && window.Tony.context) || {};
      applyMovPrezzoCatalogoToDom(ctxMovPz);
    }

    log('Form ' + formId + ' iniettato con successo');
    await delay(150);
    log('Attesa 150ms per stabilizzazione DOM e valueLabel');
    return true;
  }

  /**
   * Deriva categoria e sottocategoria dal tipo lavoro (form attività).
   * Se più match (es. Erpicatura vs Erpicatura Tra le File): preselezione da terreno.
   * Terreno Seminativo → tipo con sottocategoria Generale. Terreno Vite/Frutteto/Olivo → tipo con "Tra le File".
   */
  function deriveCategoriaFromTipo(tipoNome, context, formData) {
    var tipi = (context && context.attivita && context.attivita.tipi_lavoro) || (window.attivitaState && window.attivitaState.tipiLavoroList) || [];
    var mainCats = (context && context.attivita && context.attivita.categorie_lavoro) || (window.attivitaState && window.attivitaState.categorieLavoriPrincipali) || [];
    var subMap = (window.attivitaState && window.attivitaState.sottocategorieLavoriMap) || null;
    var search = (tipoNome || '').toLowerCase().trim();
    if (!search || !tipi.length) return null;
    var matches = tipi.filter(function (t) {
      var n = (t.nome || '').toLowerCase();
      return n === search || n.indexOf(search) >= 0 || search.indexOf(n) >= 0;
    });
    var job = null;
    if (matches.length > 1) {
      var terrenoId = null;
      if (window.attivitaState && window.attivitaState.terreniList && typeof document !== 'undefined') {
        var terrenoEl = document.getElementById('attivita-terreno');
        terrenoId = terrenoEl ? terrenoEl.value : null;
      }
      var terreno = null;
      if (terrenoId && window.attivitaState && window.attivitaState.terreniList) {
        terreno = window.attivitaState.terreniList.find(function (t) { return t.id === terrenoId; });
      }
      // Priorità a coltura_categoria (Seminativo, Vite, Frutteto, ecc.) - usa config se disponibile
      var coltura = terreno ? (terreno.coltura_categoria || terreno.coltura || '') : '';
      var tonyMapping = (typeof window !== 'undefined' && window.TONY_FORM_MAPPING) || (typeof globalThis !== 'undefined' && globalThis.TONY_FORM_MAPPING);
      var pref = (typeof tonyMapping?.getSottocategoriaPreferenceFromColtura === 'function')
        ? tonyMapping.getSottocategoriaPreferenceFromColtura(coltura)
        : null;
      var preferGenerale = pref === 'generale' || (!pref && /seminativo|seminativi|prato|prati|grano|mais|orzo/.test((coltura || '').toLowerCase()));
      var preferTraLeFile = pref === 'tra le file' || (!pref && /vite|vigneto|frutteto|oliveto|arboreo|alberi/.test((coltura || '').toLowerCase()));
      if (preferGenerale) {
        job = matches.find(function (t) {
          var n = (t.nome || '').toLowerCase();
          return n.indexOf('tra le file') < 0 && n.indexOf('sulla fila') < 0;
        });
      } else if (preferTraLeFile) {
        job = matches.find(function (t) {
          var n = (t.nome || '').toLowerCase();
          return n.indexOf('tra le file') >= 0 || n.indexOf('sulla fila') >= 0;
        });
      }
      if (!job) job = matches.sort(function (a, b) { return (b.nome || '').length - (a.nome || '').length; })[0];
    } else if (matches.length === 1) {
      job = matches[0];
    } else {
      job = matches.length > 0 ? matches.sort(function (a, b) { return (b.nome || '').length - (a.nome || '').length; })[0] : null;
    }
    if (!job || !job.categoriaId) return null;
    var catId = job.categoriaId;
    var subId = job.sottocategoriaId || null;
    var mainCatIds = mainCats.map(function (c) { return c.id; }).filter(Boolean);
    var isMain = mainCatIds.indexOf(catId) >= 0;
    var mainCatId = catId;
    var subCatId = subId;
    if (!isMain && subMap) {
      if (typeof subMap.forEach === 'function') {
        subMap.forEach(function (subs, parentId) {
          if (Array.isArray(subs) && subs.some(function (s) { return (s.id || s.value) === catId; })) {
            mainCatId = parentId;
            subCatId = catId;
            isMain = true;
          }
        });
      }
    }
    var mainCat = mainCats.find(function (c) { return c.id === mainCatId; });
    var mainNome = mainCat ? (mainCat.nome || mainCat.text) : null;
    if (!mainNome) return null;
    var subNome = null;
    if (subCatId && subMap) {
      var subs = subMap.get ? subMap.get(mainCatId) : (subMap[mainCatId] || []);
      if (Array.isArray(subs)) {
        var sub = subs.find(function (s) { return (s.id || s.value) === subCatId; });
        subNome = sub ? (sub.nome || sub.text) : null;
      }
    }
    if (subNome === 'Generale' && tipoNome) {
      var tn = (tipoNome || '').toLowerCase();
      if (tn.indexOf('tra le file') >= 0) subNome = 'Tra le File';
      else if (tn.indexOf('sulla fila') >= 0) subNome = 'Sulla Fila';
    }
    // Override: terreno vigneto + Lavorazione Terreno + Generale → Tra le File (vigneti hanno filari)
    if (subNome === 'Generale' && mainNome && (mainNome.toLowerCase().indexOf('lavorazione') >= 0 || mainNome.toLowerCase().indexOf('terreno') >= 0)) {
      var terrenoId = (formData && formData['attivita-terreno']) || null;
      if (!terrenoId && typeof document !== 'undefined') {
        var te = document.getElementById('attivita-terreno');
        terrenoId = te ? te.value : null;
      }
      if (terrenoId && window.attivitaState && window.attivitaState.terreniList) {
        var terreno = window.attivitaState.terreniList.find(function (t) { return t.id === terrenoId; });
        if (!terreno) terreno = window.attivitaState.terreniList.find(function (t) { return (t.nome || '').toLowerCase() === String(terrenoId).toLowerCase(); });
        var coltura = terreno ? (terreno.coltura_categoria || terreno.coltura || '').toLowerCase() : '';
        if (/vite|vigneto|frutteto|oliveto|arboreo/.test(coltura)) {
          subNome = 'Tra le File';
          log('deriveCategoriaFromTipo: terreno vigneto, override Generale → Tra le File');
        }
      }
    }
    return subNome ? { categoriaNome: mainNome, sottocategoriaNome: subNome } : { categoriaNome: mainNome };
  }

  /**
   * Inietta form attività (retrocompatibile).
   */
  function calcOreNetteFromStrings(inizio, fine, pauseMin) {
    if (!inizio || !fine) return null;
    try {
      var partsI = String(inizio).split(':');
      var partsF = String(fine).split(':');
      var inizioMin = (parseInt(partsI[0], 10) || 0) * 60 + (parseInt(partsI[1], 10) || 0);
      var fineMin = (parseInt(partsF[0], 10) || 0) * 60 + (parseInt(partsF[1], 10) || 0);
      var pause = parseInt(pauseMin, 10) || 0;
      var minuti = fineMin - inizioMin - pause;
      if (minuti <= 0) return null;
      return parseFloat((minuti / 60).toFixed(2));
    } catch (e) { return null; }
  }

  function applyLavorazioneDefaultsAttivita(formData, context) {
    if (!formData || typeof formData !== 'object') return;
    var tipo = String(formData['attivita-tipo-lavoro-gerarchico'] || '').trim();
    if (!tipo) return;
    var attivitaState = window.attivitaState || {};
    var terreni = Array.isArray(attivitaState.terreniList) ? attivitaState.terreniList : ((context && context.attivita && context.attivita.terreni) || []);
    var terrVal = String(formData['attivita-terreno'] || '').trim();
    var terreno = terreni.find(function (t) { return (t.id || '') === terrVal; });
    if (!terreno) {
      var tv = terrVal.toLowerCase();
      terreno = terreni.find(function (t) {
        var n = String(t && t.nome || '').toLowerCase();
        return n === tv || (tv && (n.indexOf(tv) >= 0 || tv.indexOf(n) >= 0));
      });
    }
    var hasFilari = terrenoHasFilariColtura(terreno);
    var forcedSub = forceCoverageByTerreno(formData['attivita-sottocategoria'], hasFilari);
    if (forcedSub && String(formData['attivita-sottocategoria'] || '').trim() !== forcedSub) {
      formData['attivita-sottocategoria'] = forcedSub;
      log('Policy attivita: sottocategoria forzata da terreno -> ' + forcedSub);
    }
    if (inferRequiresMachineFromTipo(tipo)) {
      var listMac = (window.attivitaState && window.attivitaState.macchineList) || (context && context.attivita && context.attivita.macchine) || [];
      if (!formData['attivita-macchina']) {
        var oneTr = chooseSingleActiveByType(listMac, 'trattore');
        if (oneTr) {
          formData['attivita-macchina'] = oneTr;
          log('Policy attivita: trattore auto-selezionato (unico disponibile) -> ' + oneTr);
        }
      }
      if (!formData['attivita-attrezzo']) {
        var oneAt = chooseSingleActiveByType(listMac, 'attrezzo');
        if (oneAt) {
          formData['attivita-attrezzo'] = oneAt;
          log('Policy attivita: attrezzo auto-selezionato (unico disponibile) -> ' + oneAt);
        }
      }
    }
  }

  function applyLavorazioneDefaultsLavoro(formData, context) {
    if (!formData || typeof formData !== 'object') return;
    if (!String(formData['lavoro-terreno'] || '').trim()) {
      var terrEl = document.getElementById('lavoro-terreno');
      if (terrEl && String(terrEl.value || '').trim()) {
        formData['lavoro-terreno'] = String(terrEl.value).trim();
      }
    }
    var tipo = String(formData['lavoro-tipo-lavoro'] || '').trim();
    var terrVal = String(formData['lavoro-terreno'] || '').trim();
    var terreni = (window.lavoriState && window.lavoriState.terreniList) || (context && context.lavori && context.lavori.terreni) || [];
    var terreno = terreni.find(function (t) { return (t.id || '') === terrVal; });
    if (!terreno) {
      var tv = terrVal.toLowerCase();
      terreno = terreni.find(function (t) {
        var n = String(t && t.nome || '').toLowerCase();
        return n === tv || (tv && (n.indexOf(tv) >= 0 || tv.indexOf(n) >= 0));
      });
    }
    var hasFilari = terrenoHasFilariColtura(terreno);
    var forcedSub = forceCoverageByTerreno(formData['lavoro-sottocategoria'], hasFilari);
    if (forcedSub && String(formData['lavoro-sottocategoria'] || '').trim() !== forcedSub) {
      formData['lavoro-sottocategoria'] = forcedSub;
      log('Policy lavoro: sottocategoria forzata da terreno -> ' + forcedSub);
    }
    if (!tipo) return;
    if (inferPreferMechanicalFromTipo(tipo)) {
      var subNorm = normalizeTonyText(formData['lavoro-sottocategoria']);
      if (!subNorm || subNorm === 'manuale') {
        formData['lavoro-sottocategoria'] = hasFilari ? 'Tra le File' : 'Meccanico';
        log('Policy lavoro: default meccanico applicato -> ' + formData['lavoro-sottocategoria']);
      }
    }
    if (inferRequiresMachineFromTipo(tipo)) {
      var trList = (window.lavoriState && window.lavoriState.trattoriList) || [];
      var atList = (window.lavoriState && window.lavoriState.attrezziList) || [];
      if (!formData['lavoro-trattore']) {
        var oneTr = chooseSingleActiveByType(trList, 'trattore');
        if (oneTr) {
          formData['lavoro-trattore'] = oneTr;
          log('Policy lavoro: trattore auto-selezionato (unico disponibile) -> ' + oneTr);
        }
      }
      if (!formData['lavoro-attrezzo']) {
        var oneAt = chooseSingleActiveByType(atList, 'attrezzo');
        if (oneAt) {
          formData['lavoro-attrezzo'] = oneAt;
          log('Policy lavoro: attrezzo auto-selezionato (unico disponibile) -> ' + oneAt);
        }
      }
    }
  }

  async function injectAttivitaForm(formData, context) {
    if (!formData || typeof formData !== 'object') return false;
    context = context || (window.Tony && window.Tony.context) || {};

    var attivitaState = window.attivitaState;
    if (!attivitaState) {
      log('attivitaState non disponibile');
      return false;
    }

    if (formData['attivita-pause'] === undefined || formData['attivita-pause'] === null || formData['attivita-pause'] === '') {
      formData['attivita-pause'] = '0';
      log('Default attivita-pause = 0 (non specificato)');
    }
    var hasMacchina = !!(formData['attivita-macchina'] || formData['attivita-attrezzo']);
    var oreMac = formData['attivita-ore-macchina'];
    var oreMacNum = oreMac !== undefined && oreMac !== null && oreMac !== '' ? parseFloat(String(oreMac).replace(',', '.')) : NaN;
    if (hasMacchina && (isNaN(oreMacNum) || oreMacNum <= 0)) {
      var calc = calcOreNetteFromStrings(formData['attivita-orario-inizio'], formData['attivita-orario-fine'], formData['attivita-pause']);
      if (calc != null && calc > 0) {
        formData['attivita-ore-macchina'] = (Math.round(calc * 10) / 10).toFixed(1);
        log('Auto-compilato attivita-ore-macchina = ' + formData['attivita-ore-macchina'] + ' da orari e pause');
      }
    } else if (hasMacchina && oreMacNum > 0) {
      formData['attivita-ore-macchina'] = (Math.round(oreMacNum * 10) / 10).toFixed(1);
    }

    applyLavorazioneDefaultsAttivita(formData, context);

    var tipoNome = formData['attivita-tipo-lavoro-gerarchico'];
    if (tipoNome) {
      var derived = deriveCategoriaFromTipo(tipoNome, context, formData);
      if (derived) {
        if (!formData['attivita-categoria-principale']) {
          formData['attivita-categoria-principale'] = derived.categoriaNome;
        }
        var existingSub = (formData['attivita-sottocategoria'] || '').toString().trim();
        var validSubs = ['Generale', 'Tra le File', 'Sulla Fila'];
        var userExplicit = validSubs.some(function (s) { return existingSub === s || existingSub.toLowerCase() === s.toLowerCase(); });
        var terrenoId = formData['attivita-terreno'] || null;
        var terreno = null;
        if (terrenoId && attivitaState && attivitaState.terreniList) {
          terreno = attivitaState.terreniList.find(function (t) { return t.id === terrenoId; });
          if (!terreno) terreno = attivitaState.terreniList.find(function (t) { return (t.nome || '').toLowerCase() === String(terrenoId).toLowerCase(); });
        }
        var coltura = terreno ? (terreno.coltura_categoria || terreno.coltura || '').toLowerCase() : '';
        var terrenoHaFilari = /vite|vigneto|frutteto|oliveto|arboreo|alberi/.test(coltura);
        if (userExplicit && existingSub.toLowerCase() === 'generale' && terrenoHaFilari) {
          formData['attivita-sottocategoria'] = derived.sottocategoriaNome || 'Tra le File';
          log('Sottocategoria Generale ignorata: terreno ha filari → ' + formData['attivita-sottocategoria']);
        } else if (derived.sottocategoriaNome && !userExplicit) {
          formData['attivita-sottocategoria'] = derived.sottocategoriaNome;
          log('Derivata sottocategoria da tipo lavoro: ' + derived.sottocategoriaNome);
        } else if (userExplicit) {
          log('Sottocategoria esplicita utente preservata: ' + existingSub);
        }
        if (derived.categoriaNome || derived.sottocategoriaNome) {
          log('deriveCategoriaFromTipo: ' + JSON.stringify(derived));
        }
      }
    }

    var mapConfig = {
      formId: 'attivita-form',
      modalId: 'attivita-modal',
      injectionOrder: INJECTION_ORDER_ATTIVITA,
      delays: DELAYS_ATTIVITA,
      resolver: resolveValueAttivita
    };

    await injectForm(formData, mapConfig, context);

    var tipoLavoroValue = formData['attivita-tipo-lavoro-gerarchico'];
    if (tipoLavoroValue) {
      var secondPassDelay = DELAYS_ATTIVITA._secondPass_tipo_lavoro || 350;
      log('Seconda passata su tipo-lavoro, attesa ' + secondPassDelay + 'ms...');
      await delay(secondPassDelay);
      var reResolved = resolveValueAttivita('attivita-tipo-lavoro-gerarchico', tipoLavoroValue, context);
      setFieldValue('attivita-tipo-lavoro-gerarchico', reResolved, mapConfig, context);
    }

    var oreMacEl = document.getElementById('attivita-ore-macchina');
    var macEl = document.getElementById('attivita-macchina');
    var attEl = document.getElementById('attivita-attrezzo');
    var hasMacOrAttrezzo = !!(macEl && macEl.value) || !!(attEl && attEl.value);
    var tnAct = (tipoLavoroValue || '').toLowerCase();
    if (inferRequiresMachineFromTipo(tipoLavoroValue || '') && macEl && macEl.tagName === 'SELECT' &&
      (!macEl.value || String(macEl.value).trim() === '')) {
      var listMacCv = (attivitaState && attivitaState.macchineList) || [];
      var attKnownA = resolveAttrezzoFromState(formData['attivita-attrezzo'], listMacCv);
      var candidatiMac = attKnownA ? trattoriCompatibiliCv(macchineListSoloTrattori(listMacCv), attKnownA) : null;
      if (candidatiMac != null) {
        if (candidatiMac.length === 1) {
          formData['attivita-macchina'] = String((candidatiMac[0].nome || candidatiMac[0].id || '')).trim();
          setFieldValue('attivita-macchina', formData['attivita-macchina'], mapConfig, context);
          var macElCv = document.getElementById('attivita-macchina');
          if (macElCv && macElCv.value) {
            macElCv.dispatchEvent(new Event('change', { bubbles: true }));
          }
          log('Attività: trattore unico compatibile (CV) con attrezzo noto → impostato');
          await delay(400);
        } else if (candidatiMac.length > 1) {
          var minCvA = attKnownA.cavalliMinimiRichiesti;
          var minStrA = (minCvA != null && minCvA !== '' && Number(minCvA) > 0) ? String(minCvA) : '';
          var labCvA = labelsFromTrattoriRecords(candidatiMac, 8);
          postTonyMacchineDisambiguation({
            message: 'Con l’**attrezzo** indicato ci sono più **trattori** compatibili' +
              (minStrA ? ' (richiesti almeno **' + minStrA + '** CV)' : '') + ': ' + labCvA.join(', ') +
              (candidatiMac.length > 8 ? '…' : '') +
              '.\n\nIndica quale hai usato (nome come in elenco) per **attivita-macchina**.',
            voiceText: 'Ci sono più trattori compatibili. Quale hai usato?',
            formId: 'attivita-form',
            field: 'attivita-macchina'
          });
        } else {
          var attNomeA = String((attKnownA.nome || attKnownA.id || 'attrezzo')).trim();
          var minN1 = Number(attKnownA.cavalliMinimiRichiesti);
          var hasMinA = Number.isFinite(minN1) && minN1 > 0;
          postTonyMacchineDisambiguation({
            message: hasMinA
              ? '**Nessun trattore** ha potenza sufficiente per **' + attNomeA + '** (servono almeno **' + String(minN1) + '** CV). Verifica i dati in anagrafica o indica un altro attrezzo.'
              : '**Nessun trattore** attivo disponibile per **' + attNomeA + '**. Verifica l’anagrafica macchine.',
            voiceText: hasMinA
              ? 'Nessun trattore con CV sufficienti per questo attrezzo.'
              : 'Nessun trattore disponibile.',
            formId: 'attivita-form',
            field: 'attivita-macchina'
          });
        }
      } else {
        var macOptsAll = Array.from(macEl.options || []).filter(function (o) { return o.value; });
        if (macOptsAll.length === 1) {
          macEl.value = macOptsAll[0].value;
          macEl.dispatchEvent(new Event('change', { bubbles: true }));
          formData['attivita-macchina'] = String((macOptsAll[0].text || macOptsAll[0].value || '')).trim();
          log('Trattore unico in elenco → impostato automaticamente');
        } else if (macOptsAll.length > 1) {
          var labTr = elencoOptionLabels(macOptsAll, 8);
          postTonyMacchineDisambiguation({
            message: 'Ci sono più **trattori** disponibili: ' + labTr.join(', ') + (macOptsAll.length > 8 ? '…' : '') +
              '.\n\nIndica quale hai usato (nome come in elenco) per compilare il trattore nel diario.',
            voiceText: 'Ci sono più trattori. Quale hai usato?',
            formId: 'attivita-form',
            field: 'attivita-macchina'
          });
        }
      }
    }
    if (macEl && macEl.value && attEl && attEl.tagName === 'SELECT' &&
      (!attEl.value || String(attEl.value).trim() === '') && tipoLavoroValue) {
      await delay(350);
      var searchA = keywordAttrezzoFromTipoNomeLower(tnAct);
      if (searchA && attEl.options && attEl.options.length > 1) {
        var matchesA = Array.from(attEl.options).filter(function (o) {
          return o.value && (o.text || '').toLowerCase().indexOf(searchA) >= 0;
        });
        if (matchesA.length === 1) {
          attEl.value = matchesA[0].value;
          attEl.dispatchEvent(new Event('change', { bubbles: true }));
          log('Attrezzo inferito da tipo lavoro (unico match): ' + (matchesA[0].text || matchesA[0].value));
        } else if (matchesA.length > 1) {
          var labAt = elencoOptionLabels(matchesA, 8);
          postTonyMacchineDisambiguation({
            message: 'Per **' + String(tipoLavoroValue).trim() + '** ci sono più **attrezzi** compatibili: ' + labAt.join(', ') +
              (matchesA.length > 8 ? '…' : '') + '.\n\nDimmi quale hai usato (nome esatto) per l’attrezzo nel diario.',
            voiceText: 'Ci sono più attrezzi compatibili. Quale hai usato?',
            formId: 'attivita-form',
            field: 'attivita-attrezzo'
          });
        }
      }
    }
    if (oreMacEl && hasMacOrAttrezzo && (!oreMacEl.value || parseFloat(oreMacEl.value) <= 0)) {
      var inizioEl = document.getElementById('attivita-orario-inizio');
      var fineEl = document.getElementById('attivita-orario-fine');
      var pauseEl = document.getElementById('attivita-pause');
      var calc = calcOreNetteFromStrings(
        inizioEl ? inizioEl.value : null,
        fineEl ? fineEl.value : null,
        pauseEl ? pauseEl.value : null
      );
      if (calc != null && calc > 0) {
        oreMacEl.value = (Math.round(calc * 10) / 10).toFixed(1);
        if (oreMacEl.dispatchEvent) oreMacEl.dispatchEvent(new Event('input', { bubbles: true }));
        log('Ore macchina auto-compilate da orari: ' + oreMacEl.value);
      }
    }

    log('injectAttivitaForm completato');
    return true;
  }

  /**
   * Inietta form lavoro (gestione-lavori).
   * - deriveParentsFromTipoLavoro: da tipo lavoro deriviamo categoria e sottocategoria
   * - applyAssignmentIntelligence: se nomina operaio (non caposquadra) → autonomo
   * - applyBusinessRules: autonomo + operatore vuoto → usa operaio
   * - Radio tipo-assegnazione: gestito via name="tipo-assegnazione"
   * @param {Object} formData - { 'lavoro-nome': '...', 'tipo-assegnazione': 'autonomo', ... }
   * @param {Object} context - contesto Tony
   * @returns {Promise<boolean>}
   */
  async function injectLavoroForm(formData, context, injectOpts) {
    if (!formData || typeof formData !== 'object') return false;
    context = context || (window.Tony && window.Tony.context) || {};
    injectOpts = injectOpts || {};

    var formReady = await waitForLavoriFormDataReady(injectOpts.formReadyMaxMs != null ? injectOpts.formReadyMaxMs : 12000);
    if (!formReady) {
      log('injectLavoroForm: timeout lavori-form-data-ready, procedo con attese ridotte');
    } else {
      log('injectLavoroForm: lavori-form-data-ready OK');
    }
    if (injectOpts.selectWaitMs == null) {
      injectOpts.selectWaitMs = formReady ? 5000 : 10000;
    }

    var sourceMsg = '';
    try { sourceMsg = String(sessionStorage.getItem('tony_last_user_message') || '').trim(); } catch (eSrc) {}
    if (window.lavoriState && window.lavoriState.hasManodoperaModule) {
      await waitForLavoriManodoperaReady(6000);
    }
    sanitizeAmbiguousLavoroInterviewFields(formData, sourceMsg);

    normalizeLavoroTipoAssegnazioneValue(formData);
    applyAssignmentIntelligence(formData);

    var interviewPatch = !!injectOpts.interviewPatch;
    var touchesTerrenoOrTipo = !!(formData['lavoro-terreno'] || formData['lavoro-tipo-lavoro']);

    if (interviewPatch) {
      if (!formData['lavoro-terreno']) {
        var terrElIv = document.getElementById('lavoro-terreno');
        if (terrElIv && String(terrElIv.value || '').trim()) {
          formData['lavoro-terreno'] = String(terrElIv.value).trim();
        }
      }
      if (touchesTerrenoOrTipo) {
        ensureTrattamentiDefaultsForLavoroForm(formData);
        applyLavorazioneDefaultsLavoro(formData, context);
      }
    } else {
      ensureTrattamentiDefaultsForLavoroForm(formData);
      applyLavorazioneDefaultsLavoro(formData, context);
    }

    var tipoNome = formData['lavoro-tipo-lavoro'];
    if (tipoNome && (touchesTerrenoOrTipo || !interviewPatch)) {
      var derived = deriveParentsFromTipoLavoro(tipoNome, context, formData);
      if (derived) {
        if (!formData['lavoro-categoria-principale']) {
          formData['lavoro-categoria-principale'] = derived.categoriaNome;
          log('deriveParentsFromTipoLavoro: categoria = ' + derived.categoriaNome);
        }
        if (derived.sottocategoriaNome) {
          var existingSub = (formData['lavoro-sottocategoria'] || '').toString().trim().toLowerCase();
          if (!existingSub || existingSub === '-- nessuna sottocategoria --') {
            formData['lavoro-sottocategoria'] = derived.sottocategoriaNome;
            log('deriveParentsFromTipoLavoro: sottocategoria = ' + derived.sottocategoriaNome);
          } else if (existingSub === 'generale') {
            var terrenoVal = String(formData['lavoro-terreno'] || '').trim();
            var terreniList = (window.lavoriState && window.lavoriState.terreniList) || (context && context.lavori && context.lavori.terreni) || [];
            var terreno = terreniList.find(function (t) { return (t.id || '') === terrenoVal; });
            if (!terreno) terreno = terreniList.find(function (t) { var n = (t.nome || '').toLowerCase(); return n === terrenoVal.toLowerCase() || (terrenoVal && n.indexOf(terrenoVal.toLowerCase()) >= 0); });
            if (terrenoHasFilariColtura(terreno)) {
              formData['lavoro-sottocategoria'] = 'Tra le File';
              log('Sottocategoria Generale ignorata: terreno ha filari (vigneto/frutteto) → Tra le File');
            }
          }
        }
        var subNormL = String(formData['lavoro-sottocategoria'] || '').trim().toLowerCase();
        if (subNormL === 'generale' && formData['lavoro-terreno']) {
          var terrenoValL = String(formData['lavoro-terreno'] || '').trim();
          var terreniListL = (window.lavoriState && window.lavoriState.terreniList) || (context && context.lavori && context.lavori.terreni) || [];
          var terrenoL = terreniListL.find(function (t) { return (t.id || '') === terrenoValL; });
          if (!terrenoL) {
            var tvl = terrenoValL.toLowerCase();
            terrenoL = terreniListL.find(function (t) {
              var n = (t.nome || '').toLowerCase();
              return n === tvl || (tvl && n.indexOf(tvl) >= 0) || (n && tvl.indexOf(n) >= 0);
            });
          }
          if (terrenoHasFilariColtura(terrenoL)) {
            formData['lavoro-sottocategoria'] = 'Tra le File';
            log('Generale → Tra le File dopo derive (lavoro, terreno con filari)');
          }
        }
      }
    }

    if (interviewPatch && (formData['lavoro-terreno'] || formData['lavoro-tipo-lavoro'])) {
      applyLavorazioneDefaultsLavoro(formData, context);
    }

    sanitizeUndeclaredLavoroMacchine(formData, injectOpts);

    var mapConfig = {
      formId: 'lavoro-form',
      modalId: 'lavoro-modal',
      injectionOrder: INJECTION_ORDER_LAVORO,
      delays: interviewPatch ? DELAYS_LAVORO_INTERVIEW : DELAYS_LAVORO,
      resolver: resolveValueLavoro
    };

    var ok = await injectForm(formData, mapConfig, context, injectOpts);

    var skipSecondPass = !!(injectOpts.patchOnly);
    if (ok && formData['lavoro-terreno'] && !skipSecondPass) {
      var tipoSelCheck = document.getElementById('lavoro-tipo-lavoro');
      var subSelCheck = document.getElementById('lavoro-sottocategoria');
      if (tipoSelCheck && tipoSelCheck.value && subSelCheck && subSelCheck.value) {
        skipSecondPass = true;
        log('Second pass lavoro: skip (cascata terreno/categoria/tipo già valorizzata)');
      }
    }

    // Second pass: il change su terreno può ricaricare dropdown e azzerare tipo/sottocategoria.
    if (ok && formData['lavoro-terreno'] && !skipSecondPass) {
      await delay(350);
      ensureTrattamentiDefaultsForLavoroForm(formData);
      var tipoSel = document.getElementById('lavoro-tipo-lavoro');
      var subSel = document.getElementById('lavoro-sottocategoria');
      var passWait = injectOpts.selectWaitMs || 5000;
      if (subSel && (!subSel.value || String(subSel.value).trim() === '') && formData['lavoro-sottocategoria']) {
        var resolvedSub = resolveValueLavoro('lavoro-sottocategoria', formData['lavoro-sottocategoria'], context);
        var subWant = resolvedSub || formData['lavoro-sottocategoria'];
        await waitForSelectOptionTextOrValue('lavoro-sottocategoria', subWant, passWait);
        setFieldValue('lavoro-sottocategoria', subWant, mapConfig, context);
        log('Second pass: re-iniettato lavoro-sottocategoria dopo cambio terreno');
        await delay(280);
      }
      if (tipoSel && (!tipoSel.value || String(tipoSel.value).trim() === '') && formData['lavoro-tipo-lavoro']) {
        var resolvedTipo = resolveValueLavoro('lavoro-tipo-lavoro', formData['lavoro-tipo-lavoro'], context);
        var tipoWant = resolvedTipo || formData['lavoro-tipo-lavoro'];
        await waitForSelectOptions('lavoro-tipo-lavoro', 2, passWait);
        await waitForSelectOptionTextOrValue('lavoro-tipo-lavoro', tipoWant, passWait);
        setFieldValue('lavoro-tipo-lavoro', tipoWant, mapConfig, context);
        log('Second pass: re-iniettato lavoro-tipo-lavoro dopo cambio terreno');
      }
    }

    if (ok && !injectOpts.interviewPatch) {
      await reconcileLavoroMacchineFields(formData, mapConfig, context, {
        passLabel: 'macchine-hydration',
        waitListsMs: injectOpts.selectWaitMs || 5000
      });
      if (!emitPendingLavoroTrattoreDisambiguation()) {
        /* pending già emesso da reconcile oppure assente */
      }
    }
    return ok;
  }

  /**
   * Form anagrafica terreno (pagina Terreni).
   */
  async function injectTerrenoForm(formData, context) {
    if (!formData || typeof formData !== 'object') return false;
    context = context || (window.Tony && window.Tony.context) || {};
    var tonyMapping = (typeof window !== 'undefined' && window.TONY_FORM_MAPPING && window.TONY_FORM_MAPPING.getFormMap)
      ? window.TONY_FORM_MAPPING.getFormMap('terreno-form')
      : null;
    if (!tonyMapping || !Array.isArray(tonyMapping.injectionOrder)) {
      log('injectTerrenoForm: mapping mancante');
      return false;
    }
    var fd = await _ensureTerrenoColturaCategoriaInFormData(formData, context);
    if (fd['terreno-coltura-categoria']) {
      log('injectTerrenoForm: categoria coltura dedotta=' + fd['terreno-coltura-categoria']);
    }
    var mapConfig = {
      formId: 'terreno-form',
      injectionOrder: tonyMapping.injectionOrder,
      fields: tonyMapping.fields || {},
      delays: DELAYS_TERRENO,
      resolver: resolveValueTerreno
    };
    var ok = await injectForm(fd, mapConfig, context);
    if (ok && typeof window.toggleDataScadenzaAffitto === 'function') {
      window.toggleDataScadenzaAffitto();
    }
    return ok;
  }

  /**
   * Form anagrafica prodotto (magazzino).
   */
  async function injectProdottoForm(formData, context) {
    if (!formData || typeof formData !== 'object') return false;
    context = context || (window.Tony && window.Tony.context) || {};
    var tonyMapping = (typeof window !== 'undefined' && window.TONY_FORM_MAPPING && window.TONY_FORM_MAPPING.getFormMap)
      ? window.TONY_FORM_MAPPING.getFormMap('prodotto-form')
      : null;
    if (!tonyMapping || !Array.isArray(tonyMapping.injectionOrder)) {
      log('injectProdottoForm: mapping mancante');
      return false;
    }
    var mapConfig = {
      formId: 'prodotto-form',
      injectionOrder: tonyMapping.injectionOrder,
      fields: tonyMapping.fields || {}
    };
    var ok = await injectForm(formData, mapConfig, context);
    if (ok && typeof window !== 'undefined' && typeof window.__tonySyncProdottoDosaggioCarenzaRequired === 'function') {
      window.__tonySyncProdottoDosaggioCarenzaRequired();
    }
    return ok;
  }

  /**
   * Form completamento trattamento/concimazione in campo (`#form-trattamento`, pagine vigneto/frutteto).
   * Richiede `window.__tonyTrattamentoCampoApi` esposto dalla pagina (renderProdotti + getProdottiAnagrafica).
   */
  function tenantHasMeteoModuleFromContext(context) {
    context = context || (window.Tony && window.Tony.context) || {};
    var mods = [];
    if (context.dashboard && Array.isArray(context.dashboard.moduli_attivi)) {
      mods = context.dashboard.moduli_attivi;
    } else if (context.info_azienda && Array.isArray(context.info_azienda.moduli_attivi)) {
      mods = context.info_azienda.moduli_attivi;
    } else if (Array.isArray(context.moduli_attivi)) {
      mods = context.moduli_attivi;
    }
    return mods.some(function (m) {
      return String(m).toLowerCase() === 'meteo';
    });
  }

  async function resolveTerrenoIdForMeteoSuggest(resolverKey) {
    if (resolverKey !== 'trattamento_campo') return null;
    var api = window.__tonyTrattamentoCampoApi;
    if (api && typeof api.getTerrenoId === 'function') {
      var fromApi = api.getTerrenoId();
      if (fromApi) return fromApi;
    }
    var lavoroEl = document.getElementById('trattamento-lavoro-id');
    var lavoroId = lavoroEl && lavoroEl.value ? String(lavoroEl.value).trim() : '';
    if (lavoroId) {
      try {
        var lavoriSvc = await import('../services/lavori-service.js');
        var lav = await lavoriSvc.getLavoro(lavoroId);
        if (lav && lav.terrenoId) return lav.terrenoId;
      } catch (eLav) {
        log('resolveTerrenoId lavoro: ' + (eLav && eLav.message ? eLav.message : eLav));
      }
    }
    var attEl = document.getElementById('trattamento-attivita-id');
    var attId = attEl && attEl.value ? String(attEl.value).trim() : '';
    if (attId) {
      try {
        var attSvc = await import('../services/attivita-service.js');
        var att = await attSvc.getAttivita(attId);
        if (att && att.terrenoId) return att.terrenoId;
      } catch (eAtt) {
        log('resolveTerrenoId attivita: ' + (eAtt && eAtt.message ? eAtt.message : eAtt));
      }
    }
    return null;
  }

  async function applyMeteoSuggestionFromMapConfig(mapConfig, context) {
    if (!mapConfig || !mapConfig.meteoSuggest) return;
    if (!tenantHasMeteoModuleFromContext(context)) return;
    var ms = mapConfig.meteoSuggest;
    var el = document.getElementById(ms.fieldId);
    if (!el || String(el.value || '').trim()) return;

    var terrenoId = await resolveTerrenoIdForMeteoSuggest(ms.terrenoResolver);
    if (!terrenoId) return;

    var tenantId = null;
    if (context && context.dashboard && context.dashboard.tenantId) {
      tenantId = context.dashboard.tenantId;
    } else if (context && context.info_azienda && context.info_azienda.tenantId) {
      tenantId = context.info_azienda.tenantId;
    }
    if (!tenantId) {
      try {
        var tenantSvc = await import('../services/tenant-service.js');
        tenantId = tenantSvc.getCurrentTenantId && tenantSvc.getCurrentTenantId();
      } catch (eT) {
        log('applyMeteoSuggestion tenant: ' + (eT && eT.message ? eT.message : eT));
      }
    }
    if (!tenantId) return;

    var meteoHelpers = await import('./meteo-ui-helpers.js');
    var meteoSvc = await import('../services/meteo-service.js');
    var rulesCfg = await import('../config/tony-meteo-rules.js');
    var rowRaw = await meteoSvc.fetchTerrenoMeteoRowCached(tenantId, terrenoId);
    var compact = meteoHelpers.compactTerrenoMeteoRowFromFetch(rowRaw);
    var ventoMax =
      rulesCfg.DEFAULT_TONY_METEO_RULES &&
      rulesCfg.DEFAULT_TONY_METEO_RULES.trattamento &&
      rulesCfg.DEFAULT_TONY_METEO_RULES.trattamento.ventoMaxKmh != null
        ? rulesCfg.DEFAULT_TONY_METEO_RULES.trattamento.ventoMaxKmh
        : 15;
    var suggested = meteoHelpers.deriveCondizioniMeteoFromCompactRow(compact, { ventoMaxKmh: ventoMax });
    if (!suggested) return;

    el.value = suggested;
    try {
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (eCh) {}
    meteoHelpers.showCondizioniMeteoSuggestHint(el, suggested);
    log('Suggerimento condizioniMeteo: ' + suggested + ' (terreno ' + terrenoId + ')');
  }

  async function suggestTrattamentoCondizioniMeteo(context) {
    var modal = document.getElementById('modal-trattamento');
    if (!modal || !modal.classList.contains('active')) return;
    var tonyMapping =
      typeof window !== 'undefined' &&
      window.TONY_FORM_MAPPING &&
      window.TONY_FORM_MAPPING.getFormMap
        ? window.TONY_FORM_MAPPING.getFormMap('form-trattamento')
        : null;
    if (!tonyMapping) return;
    await applyMeteoSuggestionFromMapConfig(tonyMapping, context);
  }

  async function injectTrattamentoCampoForm(formData, context) {
    if (!formData || typeof formData !== 'object') return false;
    if (!document.getElementById('form-trattamento')) {
      log('injectTrattamentoCampoForm: form-trattamento assente');
      return false;
    }
    var api = window.__tonyTrattamentoCampoApi;
    if (!api || typeof api.renderProdotti !== 'function') {
      log('injectTrattamentoCampoApi non disponibile (pagina concimazioni/trattamenti)');
      return false;
    }
    context = context || (window.Tony && window.Tony.context) || {};
    var list = typeof api.getProdottiAnagrafica === 'function' ? api.getProdottiAnagrafica() : [];
    if (!Array.isArray(list)) list = [];
    var prodottiCtx = (context.azienda && Array.isArray(context.azienda.prodotti)) ? context.azienda.prodotti : [];
    var catalog = list.length ? list : prodottiCtx;

    function resolveProdottoId(val) {
      if (val === undefined || val === null) return null;
      var str = String(val).trim();
      if (!str) return null;
      if (/^[a-zA-Z0-9_-]{15,}$/.test(str)) return str;
      var low = str.toLowerCase();
      var hit = catalog.find(function (p) {
        var n = (p.nome || '').toLowerCase();
        var c = (p.codice || '').toLowerCase();
        return n === low || (n && n.indexOf(low) >= 0) || (low && low.indexOf(n) >= 0) || (c && (c === low || c.indexOf(low) >= 0));
      });
      return hit && hit.id ? hit.id : null;
    }

    var fdLocal = Object.assign({}, formData);
    if (fdLocal['trattamento-superficie'] != null) {
      var supElPre = document.getElementById('trattamento-superficie');
      if (supElPre) {
        var svPre = parseFloat(String(fdLocal['trattamento-superficie']).replace(',', '.'));
        if (Number.isFinite(svPre)) {
          supElPre.value = String(svPre);
          try {
            supElPre.dispatchEvent(new Event('input', { bubbles: true }));
            supElPre.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (ePre) {}
        }
      }
    }
    var supElHa = document.getElementById('trattamento-superficie');
    var haTratt =
      supElHa && supElHa.value != null && String(supElHa.value).trim() !== ''
        ? parseFloat(String(supElHa.value).replace(',', '.'))
        : NaN;

    var raw = formData['trattamento-prodotti'] || formData.trattamento_prodotti || formData.prodotti;
    var rows = [];
    if (Array.isArray(raw)) {
      raw.forEach(function (item) {
        if (!item || typeof item !== 'object') return;
        var nome = item.prodotto != null ? String(item.prodotto).trim() : '';
        var pid = item.prodottoId || item.prodotto_id || resolveProdottoId(nome);
        var dosaggio = item.dosaggio != null ? parseFloat(String(item.dosaggio).replace(',', '.')) : null;
        var dosaggioOk = dosaggio != null && Number.isFinite(dosaggio);
        if (!dosaggioOk) {
          var kgTot = null;
          if (item.quantitaTotaleKg != null && String(item.quantitaTotaleKg).trim() !== '') {
            kgTot = parseFloat(String(item.quantitaTotaleKg).replace(',', '.'));
          } else if (item.kgTotali != null && String(item.kgTotali).trim() !== '') {
            kgTot = parseFloat(String(item.kgTotali).replace(',', '.'));
          } else if (item.kg_totali != null && String(item.kg_totali).trim() !== '') {
            kgTot = parseFloat(String(item.kg_totali).replace(',', '.'));
          } else if (item.ql != null && String(item.ql).trim() !== '') {
            kgTot = parseFloat(String(item.ql).replace(',', '.')) * 100;
          } else if (item.quintali != null && String(item.quintali).trim() !== '') {
            kgTot = parseFloat(String(item.quintali).replace(',', '.')) * 100;
          }
          if (kgTot != null && Number.isFinite(kgTot) && Number.isFinite(haTratt) && haTratt > 0) {
            dosaggio = Math.round((kgTot / haTratt) * 100) / 100;
          } else {
            dosaggio = null;
          }
        }
        if (pid) {
          rows.push({
            prodottoId: pid,
            prodotto: '',
            dosaggio: dosaggio == null || isNaN(dosaggio) ? null : dosaggio,
            unitaDosaggio: null,
            quantita: null,
            costo: 0
          });
        } else if (nome) {
          rows.push({
            prodottoId: null,
            prodotto: nome,
            dosaggio: dosaggio == null || isNaN(dosaggio) ? null : dosaggio,
            unitaDosaggio: null,
            quantita: null,
            costo: 0
          });
        }
      });
    }
    if (rows.length) {
      api.renderProdotti(rows);
      await delay(200);
    }

    var tonyMapping = (typeof window !== 'undefined' && window.TONY_FORM_MAPPING && window.TONY_FORM_MAPPING.getFormMap)
      ? window.TONY_FORM_MAPPING.getFormMap('form-trattamento')
      : null;
    if (!tonyMapping || !Array.isArray(tonyMapping.injectionOrder)) {
      log('injectTrattamentoCampoForm: mapping mancante');
      return rows.length > 0;
    }
    var order = tonyMapping.injectionOrder.filter(function (k) {
      return k !== 'trattamento-prodotti';
    });
    var fd = Object.assign({}, formData);
    delete fd['trattamento-prodotti'];
    delete fd.trattamento_prodotti;
    delete fd.prodotti;

    var mapConfig = {
      formId: 'form-trattamento',
      injectionOrder: order,
      fields: tonyMapping.fields || {}
    };
    var hasOther = Object.keys(fd).some(function (k) {
      var v = fd[k];
      if (v === undefined || v === null) return false;
      if (Array.isArray(v)) return v.length > 0;
      return String(v).trim() !== '';
    });
    if (!hasOther && rows.length) return true;
    var ok = await injectForm(fd, mapConfig, context);
    var anag = fd['trattamento-superficie-anagrafe'];
    var wantsAnagrafe =
      anag === true ||
      anag === 1 ||
      (typeof anag === 'string' && /^(true|1|si|sì|vero|on)$/i.test(String(anag).trim()));
    if (ok && wantsAnagrafe && api.syncSuperficieAnagrafeAfterTonyInject) {
      try {
        await api.syncSuperficieAnagrafeAfterTonyInject();
      } catch (e) {
        log('syncSuperficieAnagrafeAfterTonyInject: ' + (e && e.message ? e.message : e));
      }
    }
    if (ok) {
      try {
        await suggestTrattamentoCondizioniMeteo(context);
      } catch (eMet) {
        log('suggestTrattamentoCondizioniMeteo: ' + (eMet && eMet.message ? eMet.message : eMet));
      }
    }
    return ok;
  }

  /**
   * Form movimento magazzino.
   */
  /**
   * Form traccia segmento / zona lavorata (operaio / caposquadra, `lavori-caposquadra-standalone.html`).
   */
  async function injectZonaSegmentoForm(formData, context) {
    if (!formData || typeof formData !== 'object') return false;
    context = context || (window.Tony && window.Tony.context) || {};
    var tonyMapping = (typeof window !== 'undefined' && window.TONY_FORM_MAPPING && window.TONY_FORM_MAPPING.getFormMap)
      ? window.TONY_FORM_MAPPING.getFormMap('zona-form')
      : null;
    if (!tonyMapping || !Array.isArray(tonyMapping.injectionOrder)) {
      log('injectZonaSegmentoForm: mapping mancante');
      return false;
    }
    var zonaModal = document.getElementById('zona-modal');
    if (!zonaModal || !zonaModal.classList.contains('active')) {
      log('injectZonaSegmentoForm: aprire prima il modal Traccia segmento (zona-modal)');
      return false;
    }
    function resolveZona(fieldId, value) {
      return value;
    }
    var mapConfig = {
      formId: 'zona-form',
      modalId: 'zona-modal',
      injectionOrder: tonyMapping.injectionOrder,
      fields: tonyMapping.fields || {},
      resolver: resolveZona
    };
    return injectForm(formData, mapConfig, context);
  }

  /**
   * Finestra che contiene `#quick-hours-form` (documento corrente o parent, es. iframe lavori-caposquadra dentro field-workspace).
   * @param {{ targetWindow?: Window }} [injectOpts]
   * @returns {Window|null}
   */
  function resolveQuickHoursTargetWindow(injectOpts) {
    if (injectOpts && injectOpts.targetWindow) return injectOpts.targetWindow;
    if (document.getElementById('quick-hours-form')) return window;
    try {
      if (window.parent && window.parent !== window && window.parent.document.getElementById('quick-hours-form')) {
        return window.parent;
      }
    } catch (e) { /* cross-origin */ }
    return null;
  }

  /**
   * Form ore inline workspace mobile (`field-workspace-standalone.html`, `#quick-hours-form`).
   * Stesse chiavi logiche ora-* della pagina segnatura ore (senza modal / senza macchine qui).
   * @param {{ targetWindow?: Window }} [injectOpts] — se il widget è in iframe, passa la finestra del workspace (parent).
   */
  async function injectFieldWorkspaceQuickHoursForm(formData, context, injectOpts) {
    if (!formData || typeof formData !== 'object') return false;
    context = context || (window.Tony && window.Tony.context) || {};
    injectOpts = injectOpts || {};
    var tw = resolveQuickHoursTargetWindow(injectOpts);
    if (!tw || !tw.document || !tw.document.getElementById('quick-hours-form')) {
      log('injectFieldWorkspaceQuickHoursForm: quick-hours-form assente (né qui né nel parent)');
      return false;
    }
    var doc = tw.document;
    var fd = Object.assign({}, formData);
    if (fd['attivita-orario-inizio'] && !fd['ora-inizio']) fd['ora-inizio'] = fd['attivita-orario-inizio'];
    if (fd['attivita-orario-fine'] && !fd['ora-fine']) fd['ora-fine'] = fd['attivita-orario-fine'];
    if (fd['attivita-pause'] != null && fd['ora-pause'] == null) fd['ora-pause'] = fd['attivita-pause'];
    if (fd['attivita-data'] && !fd['ora-data']) fd['ora-data'] = fd['attivita-data'];
    if (fd['attivita-note'] != null && String(fd['attivita-note']).trim() !== '' && (!fd['ora-note'] || String(fd['ora-note']).trim() === '')) {
      fd['ora-note'] = fd['attivita-note'];
    }
    if ((!fd['ora-lavoro'] || String(fd['ora-lavoro']).trim() === '') && typeof tw.gfvFieldWorkspaceGetSelectedLavoroId === 'function') {
      try {
        var selId = tw.gfvFieldWorkspaceGetSelectedLavoroId();
        if (selId && String(selId).trim()) fd['ora-lavoro'] = String(selId).trim();
      } catch (eSel) { /* ignore */ }
    }
    if (fd['ora-lavoro'] != null && String(fd['ora-lavoro']).trim() !== '' && typeof tw.gfvFieldWorkspaceSelectLavoroById === 'function') {
      var okSel = await tw.gfvFieldWorkspaceSelectLavoroById(String(fd['ora-lavoro']).trim());
      if (!okSel) log('injectFieldWorkspaceQuickHoursForm: lavoro non trovato nel select');
      await delay(350);
    }
    if (typeof tw.gfvFieldWorkspaceGoToHoursSlide === 'function') {
      tw.gfvFieldWorkspaceGoToHoursSlide();
      await delay(550);
    }
    var domMap = {
      'ora-data': 'ora-data',
      'ora-inizio': 'ora-start',
      'ora-fine': 'ora-end',
      'ora-pause': 'ora-break',
      'ora-note': 'ora-note'
    };
    var order = ['ora-data', 'ora-inizio', 'ora-fine', 'ora-pause', 'ora-note'];
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      if (fd[k] == null || String(fd[k]).trim() === '') continue;
      var el = doc.getElementById(domMap[k]);
      if (!el) continue;
      setInputValue(el, fd[k], k);
      await delay(120);
    }
    try {
      if (typeof tw.gfvFieldWorkspaceRecalcHours === 'function') tw.gfvFieldWorkspaceRecalcHours();
    } catch (eR) { /* ignore */ }
    return true;
  }

  /**
   * Form Segna ora (`segnatura-ore-standalone.html`): due passi — dopo lavoro si aggiornano i select macchina (pagina).
   */
  async function injectSegnaOraForm(formData, context) {
    if (!formData || typeof formData !== 'object') return false;
    context = context || (window.Tony && window.Tony.context) || {};
    var qhTw = resolveQuickHoursTargetWindow({});
    if (qhTw) {
      log('injectSegnaOraForm: uso form inline workspace mobile (quick-hours-form)');
      return injectFieldWorkspaceQuickHoursForm(formData, context, { targetWindow: qhTw });
    }
    var tonyMapping = (typeof window !== 'undefined' && window.TONY_FORM_MAPPING && window.TONY_FORM_MAPPING.getFormMap)
      ? window.TONY_FORM_MAPPING.getFormMap('ora-form')
      : null;
    if (!tonyMapping || !Array.isArray(tonyMapping.injectionOrder)) {
      log('injectSegnaOraForm: mapping mancante');
      return false;
    }
    var oraModal = document.getElementById('ora-modal');
    if (!oraModal || !oraModal.classList.contains('active')) {
      log('injectSegnaOraForm: aprire prima il modal Segna ora (ora-modal)');
      return false;
    }
    var sel0 = document.getElementById('ora-lavoro');
    if (sel0 && sel0.options.length <= 1 && typeof window.openSegnaOraModal === 'function') {
      log('injectSegnaOraForm: popolo dropdown lavori via openSegnaOraModal');
      await window.openSegnaOraModal(null);
      await delay(500);
    }
    function resolveOra(fieldId, value) {
      return value;
    }
    var baseConfig = {
      formId: 'ora-form',
      modalId: 'ora-modal',
      fields: tonyMapping.fields || {},
      resolver: resolveOra,
      delays: { 'ora-lavoro': 400, 'ora-macchina': 450, 'ora-attrezzo': 400 }
    };
    var orderFirst = ['ora-lavoro', 'ora-data', 'ora-inizio', 'ora-fine', 'ora-pause', 'ora-note', 'ora-includi-posizione'];
    var orderMac = ['ora-macchina', 'ora-attrezzo', 'ora-ore-macchina'];
    var fd = Object.assign({}, formData);
    var ok1 = await injectForm(fd, Object.assign({}, baseConfig, { injectionOrder: orderFirst }), context);
    if (!ok1) return false;
    if (typeof window.gfvSegnaturaOreRefreshMacchineFromSelect === 'function') {
      await delay(450);
      try {
        window.gfvSegnaturaOreRefreshMacchineFromSelect();
      } catch (eMac) {
        log('injectSegnaOraForm: refresh macchine: ' + (eMac && eMac.message));
      }
      await delay(500);
      var hasMac = fd['ora-macchina'] != null && String(fd['ora-macchina']).trim() !== '';
      var hasAtt = fd['ora-attrezzo'] != null && String(fd['ora-attrezzo']).trim() !== '';
      var hasOreM = fd['ora-ore-macchina'] != null && String(fd['ora-ore-macchina']).trim() !== '';
      if (hasMac || hasAtt || hasOreM) {
        await injectForm(fd, Object.assign({}, baseConfig, { injectionOrder: orderMac }), context);
      }
    }
    try {
      if (typeof window.gfvCalcolaOreNetteSegnatura === 'function') {
        window.gfvCalcolaOreNetteSegnatura();
      }
    } catch (eCalc) { /* ignore */ }
    return true;
  }

  function parsePrezzoUnitarioCatalogoInline(value) {
    if (value === undefined || value === null || value === '') return null;
    var p = parseFloat(value);
    return Number.isFinite(p) && p >= 0 ? p : null;
  }

  function getPrezzoFromMovProdottoOptionDom(prodottoId) {
    var sel = typeof document !== 'undefined' ? document.getElementById('mov-prodotto') : null;
    if (!sel || !prodottoId) return null;
    var id = String(prodottoId).trim();
    for (var oi = 0; oi < sel.options.length; oi++) {
      var opt = sel.options[oi];
      if (opt.value !== id) continue;
      if (opt.dataset && opt.dataset.prezzoUnitario != null && opt.dataset.prezzoUnitario !== '') {
        return parsePrezzoUnitarioCatalogoInline(opt.dataset.prezzoUnitario);
      }
      break;
    }
    return null;
  }

  function getPrezzoUnitarioFromCatalogLists(prodottoId, catalogLists) {
    if (!prodottoId) return null;
    var id = String(prodottoId).trim();
    if (!id) return null;
    var lists = Array.isArray(catalogLists) ? catalogLists : [catalogLists];
    for (var li = 0; li < lists.length; li++) {
      var list = lists[li];
      if (!Array.isArray(list)) continue;
      for (var pi = 0; pi < list.length; pi++) {
        var prod = list[pi];
        if (prod && String(prod.id) === id) {
          var pr = parsePrezzoUnitarioCatalogoInline(prod.prezzoUnitario);
          if (pr != null) return pr;
        }
      }
    }
    return getPrezzoFromMovProdottoOptionDom(id);
  }

  function enrichMovimentoPrezzoInline(formData, context) {
    if (!formData || typeof formData !== 'object') return formData || {};
    var fd = Object.assign({}, formData);
    if (String(fd['mov-tipo'] || '').trim().toLowerCase() !== 'entrata') return fd;
    if (fd['mov-prezzo'] != null && String(fd['mov-prezzo']).trim() !== '') return fd;
    if (!fd['mov-prodotto']) return fd;
    var lists = [];
    if (context && context.azienda && Array.isArray(context.azienda.prodotti)) lists.push(context.azienda.prodotti);
    if (typeof window !== 'undefined' && Array.isArray(window.__gfvMagazzinoProdotti)) lists.push(window.__gfvMagazzinoProdotti);
    var prezzo = getPrezzoUnitarioFromCatalogLists(fd['mov-prodotto'], lists);
    if (prezzo != null) fd['mov-prezzo'] = String(prezzo);
    return fd;
  }

  function applyMovPrezzoCatalogoToDom(context) {
    if (typeof document === 'undefined') return false;
    var tipoEl = document.getElementById('mov-tipo');
    var prodEl = document.getElementById('mov-prodotto');
    var prezzoEl = document.getElementById('mov-prezzo');
    if (!tipoEl || !prodEl || !prezzoEl) return false;
    if (String(tipoEl.value || '').trim().toLowerCase() !== 'entrata') return false;
    if (String(prezzoEl.value || '').trim() !== '') return false;
    var lists = [];
    context = context || (window.Tony && window.Tony.context) || {};
    if (context.azienda && Array.isArray(context.azienda.prodotti)) lists.push(context.azienda.prodotti);
    if (typeof window !== 'undefined' && Array.isArray(window.__gfvMagazzinoProdotti)) lists.push(window.__gfvMagazzinoProdotti);
    var prezzo = getPrezzoUnitarioFromCatalogLists(prodEl.value, lists);
    if (prezzo == null) return false;
    prezzoEl.value = String(prezzo);
    try {
      prezzoEl.dispatchEvent(new Event('input', { bubbles: true }));
      prezzoEl.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) { /* ignore */ }
    log('Prezzo movimento da anagrafica: mov-prezzo = ' + prezzo);
    return true;
  }

  async function injectMovimentoForm(formData, context) {
    if (!formData || typeof formData !== 'object') return false;
    context = context || (window.Tony && window.Tony.context) || {};
    var tonyMapping = (typeof window !== 'undefined' && window.TONY_FORM_MAPPING && window.TONY_FORM_MAPPING.getFormMap)
      ? window.TONY_FORM_MAPPING.getFormMap('movimento-form')
      : null;
    if (!tonyMapping || !Array.isArray(tonyMapping.injectionOrder)) {
      log('injectMovimentoForm: mapping mancante');
      return false;
    }
    var fd = Object.assign({}, formData);
    if (fd['mov-prodotto']) {
      fd['mov-prodotto'] = resolveValueMagazzino('mov-prodotto', fd['mov-prodotto'], context);
    }
    fd = enrichMovimentoPrezzoInline(fd, context);
    var enrichFn = (typeof global !== 'undefined' && global.__tonyEnrichMovimentoFormDataFromCatalog)
      || (typeof window !== 'undefined' && window.__tonyEnrichMovimentoFormDataFromCatalog);
    if (typeof enrichFn === 'function') {
      fd = enrichFn(fd, {
        context: context,
        pageProdotti: (typeof window !== 'undefined' && window.__gfvMagazzinoProdotti) || undefined,
      });
    } else if (typeof global !== 'undefined' && global.MovimentoPrezzoCatalogo &&
        typeof global.MovimentoPrezzoCatalogo.enrichMovimentoFormDataFromCatalog === 'function') {
      fd = global.MovimentoPrezzoCatalogo.enrichMovimentoFormDataFromCatalog(fd, {
        context: context,
        pageProdotti: (typeof window !== 'undefined' && window.__gfvMagazzinoProdotti) || undefined,
      });
    }
    var mapConfig = {
      formId: 'movimento-form',
      injectionOrder: tonyMapping.injectionOrder,
      fields: tonyMapping.fields || {},
      resolver: resolveValueMagazzino
    };
    var ok = await injectForm(fd, mapConfig, context);
    if (ok) applyMovPrezzoCatalogoToDom(context);
    return ok;
  }

  /**
   * Inietta form Nuovo Preventivo (Conto Terzi). Rispecchia preventivoState in lavoriState
   * per riusare deriveParentsFromTipoLavoro e resolveCategoriaLavori.
   */
  async function injectPreventivoForm(formData, context) {
    if (!formData || typeof formData !== 'object') return false;
    context = context || (window.Tony && window.Tony.context) || {};
    if (!document.getElementById('preventivo-form')) {
      log('preventivo-form non presente nel DOM');
      return false;
    }
    await waitForPreventivoPageDataReady(20000);
    if (!window.preventivoState) {
      log('preventivoState non disponibile dopo attesa bootstrap pagina');
      return false;
    }
    var savedLavori = window.lavoriState;
    var ps = window.preventivoState;
    window.lavoriState = {
      terreniList: ps.terreni || [],
      categorieLavoriPrincipali: ps.categorieLavoriPrincipali || [],
      sottocategorieLavoriMap: ps.sottocategorieLavoriMap,
      tipiLavoroList: ps.tipiLavoroList || [],
      caposquadraList: savedLavori && savedLavori.caposquadraList,
      operaiList: savedLavori && savedLavori.operaiList,
      trattoriList: savedLavori && savedLavori.trattoriList,
      attrezziList: savedLavori && savedLavori.attrezziList
    };
    try {
      var fd = Object.assign({}, formData);
      var terrenoHint = fd['terreno-id'];
      var hasTerrenoHint = terrenoHint != null && String(terrenoHint).trim() !== '';
      if (fd['tipo-lavoro']) {
        fd['tipo-lavoro'] = resolveValuePreventivo('tipo-lavoro', fd['tipo-lavoro'], context);
      }
      if (hasTerrenoHint && fd['tipo-campo']) {
        delete fd['tipo-campo'];
      }
      if (!hasTerrenoHint) {
        delete fd['tipo-campo'];
        if (String(fd['lavoro-sottocategoria'] || '').trim().toLowerCase() === 'generale') {
          delete fd['lavoro-sottocategoria'];
        }
      }
      var tipoNome = fd['tipo-lavoro'];
      var preMapCliente = { formId: 'preventivo-form', resolver: resolveValuePreventivo };
      var skipClienteInLoop = false;
      var domTerElEarly = document.getElementById('terreno-id');
      var domTerSetEarly = domTerElEarly && String(domTerElEarly.value || '').trim();
      var dateOnlyFast =
        fd['data-prevista'] &&
        !hasTerrenoHint &&
        !tipoNome &&
        !fd['lavoro-sottocategoria'] &&
        !fd['lavoro-categoria-principale'] &&
        domTerSetEarly;
      if (dateOnlyFast) {
        log('preventivo: inject rapido solo data-prevista (terreno già nel form)');
        var mapConfigDateOnly = {
          formId: 'preventivo-form',
          injectionOrder: INJECTION_ORDER_PREVENTIVO,
          delays: DELAYS_PREVENTIVO,
          resolver: resolveValuePreventivo
        };
        return await injectForm(fd, mapConfigDateOnly, context);
      }
      /** Cliente + terreno insieme: sempre pre-sync (non solo se c'è tipo-lavoro), come atomicità Gestione Lavori su terreno→tipo */
      if (fd['cliente-id'] && hasTerrenoHint) {
        log('preventivo: pre-inietto cliente + attesa terreni (derive/inject sempre coerenti con lista terreni caricata)');
        setFieldValue('cliente-id', fd['cliente-id'], preMapCliente, context);
        await delay(PREVENTIVO_POST_CLIENTE_MS);
        await awaitPreventivoTerreniFetchDone(15000);
        await waitForPreventivoTerrenoSelectHydrated(12000);
        var resolvedTid = resolveValuePreventivo('terreno-id', fd['terreno-id'], context);
        resolvedTid = resolvedTid != null ? String(resolvedTid).trim() : '';
        if (resolvedTid) {
          await waitForPreventivoStateContainsTerreno(resolvedTid, 12000);
        }
        ps = window.preventivoState;
        window.lavoriState.terreniList = (ps && ps.terreni) || [];
        if (resolvedTid && ps && Array.isArray(ps.terreni) && ps.terreni.some(function (t) { return (t.id || '') === resolvedTid; })) {
          fd['terreno-id'] = resolvedTid;
        }
        skipClienteInLoop = true;
        upgradePreventivoLavorazioneFilari(fd);
        if (fd['tipo-lavoro']) {
          fd['tipo-lavoro'] = resolveValuePreventivo('tipo-lavoro', fd['tipo-lavoro'], context);
          tipoNome = fd['tipo-lavoro'];
        }
      }
      if (tipoNome) {
        var fdDerive = Object.assign({}, fd);
        if (fdDerive['terreno-id'] && !fdDerive['lavoro-terreno']) {
          fdDerive['lavoro-terreno'] = fdDerive['terreno-id'];
        }
        var derived = deriveParentsFromTipoLavoro(tipoNome, context, fdDerive);
        if (derived) {
          if (!fd['lavoro-categoria-principale']) {
            fd['lavoro-categoria-principale'] = derived.categoriaNome;
            log('preventivo deriveParents: categoria = ' + derived.categoriaNome);
          }
          if (derived.sottocategoriaNome) {
            var existingSub = (fd['lavoro-sottocategoria'] || '').toString().trim().toLowerCase();
            if (!existingSub || existingSub === '-- nessuna sottocategoria --') {
              fd['lavoro-sottocategoria'] = derived.sottocategoriaNome;
              log('preventivo deriveParents: sottocategoria = ' + derived.sottocategoriaNome);
            } else if (existingSub === 'generale') {
              var terrenoValG = String(fd['terreno-id'] || '').trim();
              var terreniListG = (window.lavoriState && window.lavoriState.terreniList) || [];
              var terrenoG = terreniListG.find(function (t) { return (t.id || '') === terrenoValG; });
              if (!terrenoG) {
                terrenoG = terreniListG.find(function (t) {
                  var n = (t.nome || '').toLowerCase();
                  return n === terrenoValG.toLowerCase() || (terrenoValG && n.indexOf(terrenoValG.toLowerCase()) >= 0);
                });
              }
              if (terrenoHasFilariColtura(terrenoG)) {
                fd['lavoro-sottocategoria'] = 'Tra le File';
                log('preventivo: Generale → Tra le File (terreno con filari)');
              }
            }
          }
          var subNorm = String(fd['lavoro-sottocategoria'] || '').trim().toLowerCase();
          if (subNorm === 'generale') {
            var terrenoValO = String(fd['terreno-id'] || fdDerive['lavoro-terreno'] || '').trim();
            if (terrenoValO) {
              var terreniListO = (window.lavoriState && window.lavoriState.terreniList) || [];
              var terrenoO = terreniListO.find(function (t) { return (t.id || '') === terrenoValO; });
              if (!terrenoO) {
                var tvl = terrenoValO.toLowerCase();
                terrenoO = terreniListO.find(function (t) {
                  var n = (t.nome || '').toLowerCase();
                  return n === tvl || (tvl && n.indexOf(tvl) >= 0) || (n && tvl.indexOf(n) >= 0);
                });
              }
              if (terrenoHasFilariColtura(terrenoO)) {
                fd['lavoro-sottocategoria'] = 'Tra le File';
                log('preventivo: Generale → Tra le File dopo derive (terreno con filari, come Gestione Lavori)');
              }
            }
          }
        }
      }

      upgradePreventivoLavorazioneFilari(fd);
      if (fd['tipo-lavoro']) {
        fd['tipo-lavoro'] = resolveValuePreventivo('tipo-lavoro', fd['tipo-lavoro'], context);
      }

      var mapConfig = {
        formId: 'preventivo-form',
        injectionOrder: INJECTION_ORDER_PREVENTIVO,
        delays: DELAYS_PREVENTIVO,
        resolver: resolveValuePreventivo
      };

      var injectOptsPrev = skipClienteInLoop ? { skipFieldIds: { 'cliente-id': true } } : {};
      var ok = await injectForm(fd, mapConfig, context, injectOptsPrev);

      if (ok && fd['terreno-id']) {
        var tt = resolveValuePreventivo('terreno-id', fd['terreno-id'], context);
        tt = tt != null ? String(tt).trim() : '';
        if (tt) {
          await awaitPreventivoTerreniFetchDone(12000);
          await waitForSelectOptionValue('terreno-id', tt, 10000);
          var st = document.getElementById('terreno-id');
          if (st && st.value !== tt) {
            setFieldValue('terreno-id', fd['terreno-id'], mapConfig, context);
            log('Second pass preventivo: terreno-id dopo caricamento opzioni');
          }
        }
      }

      if (ok && fd['tipo-lavoro'] && fd['terreno-id']) {
        await delay(650);
        var selTipo = document.getElementById('tipo-lavoro');
        if (selTipo && !selTipo.value) {
          var resolvedTipo = resolveValuePreventivo('tipo-lavoro', fd['tipo-lavoro'], context);
          if (resolvedTipo) {
            setFieldValue('tipo-lavoro', resolvedTipo, mapConfig, context);
            log('Second pass preventivo: tipo-lavoro dopo terreno');
          }
        }
      }
      if (ok && fd['tipo-lavoro']) {
        await delay(200);
        var reT = resolveValuePreventivo('tipo-lavoro', fd['tipo-lavoro'], context);
        var curDomTipo = preventivoDomTipoLavoroText();
        if (!curDomTipo || preventivoTipoIncomingMoreSpecific(curDomTipo, reT)) {
          setFieldValue('tipo-lavoro', reT, mapConfig, context);
        }
      }
      return ok;
    } finally {
      window.lavoriState = savedLavori;
    }
  }

  // --- Intervista lavoro client-side (terreno, operaio, data, durata, tipo — no CF) ---

  var LOV_INTERVIEW_WEEKDAYS_NORM = [
    { key: 'lunedi', dow: 1 },
    { key: 'martedi', dow: 2 },
    { key: 'mercoledi', dow: 3 },
    { key: 'giovedi', dow: 4 },
    { key: 'venerdi', dow: 5 },
    { key: 'sabato', dow: 6 },
    { key: 'domenica', dow: 0 }
  ];

  function formatIsoDateLocalInterview(d) {
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1);
    if (mo.length < 2) mo = '0' + mo;
    var da = String(d.getDate());
    if (da.length < 2) da = '0' + da;
    return y + '-' + mo + '-' + da;
  }

  function isoDateFromWeekdayOffset(dow, allowToday) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    var today = d.getDay();
    var diff = (dow - today + 7) % 7;
    if (diff === 0 && !allowToday) diff = 7;
    d.setDate(d.getDate() + diff);
    return formatIsoDateLocalInterview(d);
  }

  function extractLavoroInterviewDate(message) {
    var n = normalizeTonyText(message);
    if (!n) return null;
    for (var i = 0; i < LOV_INTERVIEW_WEEKDAYS_NORM.length; i++) {
      var entry = LOV_INTERVIEW_WEEKDAYS_NORM[i];
      if (n.indexOf(entry.key) >= 0) {
        return isoDateFromWeekdayOffset(entry.dow, /\boggi\b/.test(n));
      }
    }
    if (/\boggi\b/.test(n)) {
      var d0 = new Date();
      d0.setHours(12, 0, 0, 0);
      return formatIsoDateLocalInterview(d0);
    }
    if (/\bdomani\b/.test(n)) {
      var d1 = new Date();
      d1.setHours(12, 0, 0, 0);
      d1.setDate(d1.getDate() + 1);
      return formatIsoDateLocalInterview(d1);
    }
    if (/\bdopodomani\b/.test(n)) {
      var d2 = new Date();
      d2.setHours(12, 0, 0, 0);
      d2.setDate(d2.getDate() + 2);
      return formatIsoDateLocalInterview(d2);
    }
    var dayMatch = n.match(/\bil\s+(\d{1,2})\b/);
    if (dayMatch) {
      var dayNum = parseInt(dayMatch[1], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        var now = new Date();
        now.setHours(12, 0, 0, 0);
        var candidate = new Date(now.getFullYear(), now.getMonth(), dayNum, 12, 0, 0, 0);
        if (candidate <= now) candidate.setMonth(candidate.getMonth() + 1);
        return formatIsoDateLocalInterview(candidate);
      }
    }
    return null;
  }

  function extractLavoroInterviewDuration(message) {
    var m = String(message || '');
    var n = normalizeTonyText(m);
    var wordMap = { uno: 1, un: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10 };
    var numToken = '(\\d+|un|una|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)';
    if (/\bun(?:a|o)?\s+giorn(?:o|i|ata|ate)\b/i.test(m)) return 1;
    var match =
      m.match(new RegExp('\\b(?:dura|durata)\\s+' + numToken + '\\s+giorn', 'i')) ||
      m.match(new RegExp('\\bdurata\\s+' + numToken + '\\s+giorn', 'i')) ||
      m.match(new RegExp('\\b(?:per|di)\\s+' + numToken + '\\s+giorn', 'i')) ||
      m.match(new RegExp('\\b' + numToken + '\\s+giorn', 'i')) ||
      m.match(/\b(\d+)\s+giorn/i);
    if (!match) {
      var ilMatch = n.match(/\bil\s+(\d{1,3})\b/);
      if (ilMatch) {
        var ilN = parseInt(ilMatch[1], 10);
        if (Number.isFinite(ilN) && ilN > 0 && ilN <= 365) return ilN;
      }
      var bare = m.trim();
      if (/^\d{1,3}$/.test(bare)) {
        var nb = parseInt(bare, 10);
        if (Number.isFinite(nb) && nb > 0 && nb <= 365) return nb;
      }
      if (wordMap[n] != null) return wordMap[n];
      return null;
    }
    var raw = String(match[1]).toLowerCase();
    var num = wordMap[raw] != null ? wordMap[raw] : parseInt(raw, 10);
    if (!Number.isFinite(num) || num <= 0 || num > 365) return null;
    return num;
  }

  function lavoroInterviewLastQuestionAsksDate() {
    var q = normalizeTonyText(window.__tonyLastLavoroInterviewQuestion || '');
    return /quando|inizi/.test(q);
  }

  function lavoroInterviewLastQuestionAsksDurata() {
    var q = normalizeTonyText(window.__tonyLastLavoroInterviewQuestion || '');
    return /quanti\s+giorni|durata/.test(q);
  }

  function lavoroInterviewFieldEmpty(fieldId) {
    var el = document.getElementById(fieldId);
    if (!el) return true;
    if (el.tagName === 'SELECT') return lavoroSelectIsEmpty(fieldId);
    return !el.value || String(el.value).trim() === '';
  }

  function getLavoroInterviewRequiredEmpty() {
    var raw = [];
    if (typeof window.__tonyBuildTonyFormContext === 'function') {
      var form = document.getElementById('lavoro-form');
      var modal = document.getElementById('lavoro-modal');
      if (form && modal && modal.classList.contains('active')) {
        var ctx = window.__tonyBuildTonyFormContext(form, modal, 'lavoro-modal', 'lavoro-modal attivo');
        if (ctx && Array.isArray(ctx.requiredEmpty)) raw = ctx.requiredEmpty.slice();
      }
    }
    if (!raw.length) {
      raw = ['lavoro-nome', 'lavoro-terreno', 'lavoro-categoria-principale', 'lavoro-sottocategoria',
        'lavoro-tipo-lavoro', 'lavoro-operaio', 'lavoro-caposquadra', 'lavoro-data-inizio', 'lavoro-durata'];
      raw = raw.filter(function (id) { return lavoroInterviewFieldEmpty(id); });
    }
    var filtered = raw.filter(function (id) {
      if (LOV_INTERVIEW_USER_FIELDS.indexOf(id) < 0) return false;
      var assignMode = getConfirmedLavoroInterviewAssignMode();
      if (id === 'lavoro-caposquadra') {
        if (assignMode !== 'squadra') return false;
        return lavoroInterviewFieldEmpty(id);
      }
      if (id === 'lavoro-operaio') {
        if (assignMode !== 'autonomo') return false;
        return lavoroInterviewFieldEmpty(id);
      }
      if (id === 'lavoro-tipo-lavoro') return !lavoroTipoIsChosen();
      if (id === 'lavoro-nome') {
        if (!lavoroTipoIsChosen()) return false;
        var n = document.getElementById('lavoro-nome');
        var nv = n ? String(n.value || '').trim() : '';
        if (!nv || /seleziona\s+tipo/i.test(nv)) return true;
        return false;
      }
      return lavoroInterviewFieldEmpty(id);
    });
    if (!lavoroTipoIsChosen() && filtered.indexOf('lavoro-tipo-lavoro') < 0) {
      filtered.push('lavoro-tipo-lavoro');
    }
    if (lavoroInterviewFieldEmpty('lavoro-data-inizio') && filtered.indexOf('lavoro-data-inizio') < 0) {
      filtered.push('lavoro-data-inizio');
    }
    if (lavoroInterviewFieldEmpty('lavoro-durata') && filtered.indexOf('lavoro-durata') < 0) {
      filtered.push('lavoro-durata');
    }
    var assignModeReq = getConfirmedLavoroInterviewAssignMode();
    if (assignModeReq === 'autonomo' && lavoroInterviewFieldEmpty('lavoro-operaio') &&
        filtered.indexOf('lavoro-operaio') < 0) {
      filtered.push('lavoro-operaio');
    }
    if (assignModeReq === 'squadra' && lavoroInterviewFieldEmpty('lavoro-caposquadra') &&
        filtered.indexOf('lavoro-caposquadra') < 0) {
      filtered.push('lavoro-caposquadra');
    }
    return filtered;
  }

  function lavoroInterviewNeedsScheduleFields() {
    return lavoroInterviewFieldEmpty('lavoro-data-inizio') || lavoroInterviewFieldEmpty('lavoro-durata');
  }

  function lavoroInterviewCanAskMacchine() {
    return lavoroInterviewNeedsMacchineOnly() && !lavoroInterviewNeedsScheduleFields();
  }

  function lavoroInterviewReadyForSave() {
    if (lavoroInterviewNeedsAssignModeQuestion()) return false;
    if (lavoroInterviewFieldEmpty('lavoro-terreno') || !lavoroTipoIsChosen()) return false;
    if (lavoroInterviewNeedsScheduleFields()) return false;
    if (getLavoroInterviewRequiredEmpty().length) return false;
    if (lavoroInterviewNeedsMacchineOnly()) return false;
    return true;
  }

  function lavoroInterviewNeedsMacchineOnly() {
    var tipoVal = getLavoroTipoDomText();
    if (!tipoVal) return false;
    if (!inferRequiresMachineFromTipo(tipoVal)) return false;
    return lavoroSelectIsEmpty('lavoro-trattore') || lavoroSelectIsEmpty('lavoro-attrezzo');
  }

  function mentionsLavoroTipoKeyword(text) {
    return !!lavoroTipoStemFromText(text);
  }

  function isLavoroTipoCorrectionText(text) {
    if (!mentionsLavoroTipoKeyword(text)) return false;
    var t = normalizeTonyText(text);
    return /\b(manuale|meccanic\w*|produzione|verde|generale|tra\s+le\s+file|sulla\s+fila)\b/.test(t);
  }

  function isLavoroTerrenoCorrectionText(text) {
    var t = normalizeTonyText(text);
    if (!t) return false;
    if (/\b(?:il\s+)?terreno\s+(?:e\s+|è\s+|sara\s+|sara)\b/.test(t)) return true;
    if (/\bcambia(?:re)?\s+(?:il\s+)?terren/.test(t)) return true;
    if (/\b(?:metti|imposta|usa)\s+(?:il\s+)?terren/.test(t)) return true;
    return false;
  }

  function hasExplicitTerrenoInInterviewText(text) {
    var t = normalizeTonyText(text);
    if (!t) return false;
    if (isLavoroTerrenoCorrectionText(text)) return true;
    return /\b(?:nel|nella|nello|in|sul|sulla|sullo|terreno|vigneto|campo|appezzamento)\b/.test(t);
  }

  function extractTerrenoQueryFromInterviewText(text) {
    var raw = String(text || '').trim();
    if (!raw) return '';
    var m = raw.match(/\b(?:il\s+)?terreno\s+(?:è|e|sara|sarà)\s+(.+)$/i);
    if (m) return m[1].trim();
    m = raw.match(/\b(?:nel|nella|nello|in|sul|sulla|sullo)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9'`\- ]{1,48})/i);
    if (m) {
      return m[1].replace(/\s+(?:con|per|domani|oggi|inizio|durata|assegna)\b.*$/i, '').trim();
    }
    return raw;
  }

  function lavoroInterviewTextNamesPersonOnly(text) {
    if (!lavoroInterviewTextAssignsPerson(text)) return false;
    return !hasExplicitTerrenoInInterviewText(text);
  }

  function lavoroInterviewAssignModeConfirmed() {
    return !!window.__tonyLavoroAssignModeConfirmed;
  }

  function setLavoroInterviewConfirmedAssignMode(mode) {
    window.__tonyLavoroAssignModeConfirmed = true;
    window.__tonyLavoroConfirmedAssignMode = (mode === 'squadra' || mode === 'autonomo') ? mode : null;
  }

  function lavoroInterviewNeedsAssignModeQuestion() {
    if (lavoroInterviewAssignModeConfirmed()) return false;
    return lavoroInterviewFieldEmpty('lavoro-operaio') && lavoroInterviewFieldEmpty('lavoro-caposquadra');
  }

  function getLavoroInterviewAssignMode() {
    var squadra = document.getElementById('tipo-squadra');
    var autonomo = document.getElementById('tipo-autonomo');
    if (autonomo && autonomo.checked) return 'autonomo';
    if (squadra && squadra.checked) return 'squadra';
    return null;
  }

  /** Modalità assegnazione effettiva per l'intervista — non fidarsi del default DOM (squadra checked). */
  function getConfirmedLavoroInterviewAssignMode() {
    if (!lavoroInterviewAssignModeConfirmed()) return null;
    var explicit = window.__tonyLavoroConfirmedAssignMode;
    if (explicit === 'squadra' || explicit === 'autonomo') return explicit;
    if (window.__tonyLavoroPersonDisambRole === 'operaio') return 'autonomo';
    if (window.__tonyLavoroPersonDisambRole === 'caposquadra') return 'squadra';
    return getLavoroInterviewAssignMode();
  }

  function parseAssignModeFromText(text) {
    var t = normalizeTonyText(text);
    if (!t) return null;
    if (/^(s[iì]|yes|y|squadra|di\s+squadra|con\s+(?:il\s+)?(?:capo|squadra)|lavoro\s+di\s+squadra)\b/.test(t) ||
        /\b(lavoro\s+)?di\s+squadra\b/.test(t)) {
      return 'squadra';
    }
    if (/^(no|n|autonomo|operaio|persona|individuale|da\s+solo)\b/.test(t) ||
        /\b(assegna?\w*\s+(?:a|ad)\s+)/.test(t)) {
      return 'autonomo';
    }
    return null;
  }

  function resetLavoroInterviewSessionState() {
    window.__tonyLavoroAssignModeConfirmed = false;
    window.__tonyLavoroConfirmedAssignMode = null;
    window.__tonyLavoroTipoDisambCandidates = null;
    window.__tonyLavoroAwaitingTipoModo = false;
    window.__tonyLavoroTipoModo = null;
    window.__tonyLavoroTipoStemCandidates = null;
    window.__tonyLastLavoroInterviewQuestion = '';
    window.__tonyLavoroPendingTipoHint = '';
    window.__tonyLavoroPendingCreationText = '';
    window.__tonyLavoroInterviewAskedMacchineField = null;
    window.__tonyMacchineDisambAskedAt = 0;
    window.__tonyLastMacchineDisambField = null;
    window.__tonyPendingLavoroTrattoreDisamb = false;
    window.__tonyMacchineDisambTrattoriCandidati = null;
    window.__tonyMacchineDisambAttrezziCandidati = null;
    window.__tonyAwaitingLavoroSaveConfirm = false;
    clearLavoroPersonDisamb();
    clearLavoroTerrenoDisamb();
  }

  function autoFillLavoroNomeIfMissing() {
    if (!lavoroInterviewFieldEmpty('lavoro-nome')) return false;
    var tipoForNome = getLavoroTipoDomText();
    if (!tipoForNome || /seleziona/i.test(tipoForNome)) return false;
    var terrRec = getTerrenoRecordForInterviewHint(null);
    if (!terrRec || !terrRec.nome) return false;
    var nomeEl = document.getElementById('lavoro-nome');
    if (!nomeEl) return false;
    var nome = String(tipoForNome + ' ' + terrRec.nome).trim().slice(0, 80);
    if (!nome) return false;
    nomeEl.value = nome;
    nomeEl.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  function syncLavoroOperatoreMacchinaIfNeeded() {
    if (lavoroSelectIsEmpty('lavoro-trattore')) return false;
    if (!lavoroInterviewFieldEmpty('lavoro-operatore-macchina')) return false;
    if (getLavoroInterviewAssignMode() !== 'autonomo') return false;
    var opEl = document.getElementById('lavoro-operaio');
    var omEl = document.getElementById('lavoro-operatore-macchina');
    if (!opEl || !omEl) return false;
    var opVal = String(opEl.value || '').trim();
    if (!opVal) return false;
    for (var i = 0; i < omEl.options.length; i++) {
      if (String(omEl.options[i].value || '') === opVal) {
        omEl.value = opVal;
        omEl.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  function normalizeLavoroTipoUserText(text) {
    var t = normalizeTonyText(text);
    t = t.replace(/\b(crea(\s+un)?\s+lavoro|nuovo\s+lavoro|dobbiamo|devo|vogliamo|voglio|facciamo|faccio|fare|lavoro\s+di|un\s+lavoro\s+di)\b/g, ' ');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  function lavoroTipoStemFromText(text) {
    var t = normalizeLavoroTipoUserText(text);
    var stems = [
      ['erpic', /\b(erpic\w*|erpc\w*)\b/],
      ['trinc', /\b(trinc\w*|trnc\w*)\b/],
      ['potatur', /\bpot(?:atur\w*|are|a)\b/],
      ['fresat', /\bfresat\w*\b/],
      ['aratur', /\baratur\w*\b/],
      ['diserb', /\bdiserb\w*\b/],
      ['semin', /\bsemin\w*\b/],
      ['vang', /\bvang\w*\b/],
      ['vendemm', /\bvendemm\w*\b/],
      ['sfalci', /\bsfalci\w*\b/],
      ['raccolt', /\braccolt\w*\b/],
      ['concim', /\bconcim\w*\b/]
    ];
    for (var i = 0; i < stems.length; i++) {
      if (stems[i][1].test(t)) return stems[i][0];
    }
    return '';
  }

  function lavoroTipoQueryFromText(text) {
    var stem = lavoroTipoStemFromText(text);
    var map = {
      trinc: 'trinciatura', erpic: 'erpicatura', potatur: 'potatura', fresat: 'fresatura',
      aratur: 'aratura', diserb: 'diserbo', semin: 'semina', vendemm: 'vendemmia',
      sfalci: 'sfalcio', raccolt: 'raccolta', concim: 'concimazione', vang: 'vangatura'
    };
    return map[stem] || String(text || '').trim();
  }

  function scoreTerrenoInterviewMatch(queryText, terrenoNome) {
    var t = normalizeTonyText(queryText);
    var n = normalizeTonyText(terrenoNome || '');
    if (!t || !n || t.length < 2) return 0;
    if (t === n) return 1000;
    if (n.indexOf(t) >= 0) return 800 + Math.min(t.length, 40);
    if (t.indexOf(n) >= 0) return 700 + Math.min(n.length, 40);
    var queryParts = t.split(/\s+/).filter(function (w) { return w.length >= 2; });
    if (queryParts.length >= 2) {
      var matched = queryParts.filter(function (w) { return n.indexOf(w) >= 0; });
      if (matched.length === queryParts.length) return 500 + matched.length * 10;
      if (matched.length > 0) return 100 + matched.length * 10;
      return 0;
    }
    if (queryParts.length === 1 && n.indexOf(queryParts[0]) >= 0) return 300;
    var tokens = n.split(/\s+/).filter(function (w) { return w.length >= 4; });
    for (var j = 0; j < tokens.length; j++) {
      if (t.indexOf(tokens[j]) >= 0) return 200;
    }
    return 0;
  }

  function findTerrenoInInterviewText(text, list) {
    if (!text || !Array.isArray(list) || !list.length) return null;
    var t = normalizeTonyText(text);
    if (!t || t.length < 2) return null;
    var scored = [];
    for (var i = 0; i < list.length; i++) {
      var tr = list[i];
      if (!tr) continue;
      var sc = scoreTerrenoInterviewMatch(t, tr.nome || '');
      if (sc > 0) scored.push({ tr: tr, sc: sc });
    }
    if (!scored.length) return null;
    scored.sort(function (a, b) { return b.sc - a.sc; });
    var topSc = scored[0].sc;
    var tied = scored.filter(function (s) { return s.sc === topSc; });
    if (tied.length === 1) {
      if (tied[0].sc < 300) return null;
      return tied[0].tr;
    }
    if (scored.length > 1 && scored[0].sc > scored[1].sc) {
      if (scored[0].sc < 300) return null;
      return scored[0].tr;
    }
    return {
      ambiguous: true,
      candidates: tied.map(function (s) {
        return {
          id: s.tr.id || null,
          label: String(s.tr.nome || '').trim(),
          coltura: s.tr.coltura || null
        };
      })
    };
  }

  function isTerrenoInterviewUniqueHit(hit) {
    return hit && !hit.ambiguous && (hit.id || hit.nome);
  }

  function stripLavoroCreationIntentPrefix(text) {
    return String(text || '').trim().replace(/^(crea(\s+un)?\s+lavoro|nuovo\s+lavoro)\s+/i, '').trim();
  }

  /** «per luca nel pinot» → «luca» (evita token «luca nel» non matchabile in elenco operai). */
  function trimPersonInterviewToken(token) {
    var t = String(token || '').trim();
    if (!t) return t;
    t = t.replace(/\s+(?:nel|nella|nello|in|sul|sulla|sul|al|alla|allo|con|da|di|domani|oggi|un|una|\d+)\b.*$/i, '').trim();
    return t;
  }

  function extractPersonTokenFromInterviewText(raw) {
    var text = String(raw || '').trim();
    if (!text) return text;
    var m = text.match(/\b(?:per|a|ad|assegna?\w*\s+(?:a|ad|al|alla))\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'`\-]{1,30}(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'`\-]{1,30})?)/i);
    if (m) return trimPersonInterviewToken(m[1].trim());
    return text;
  }

  function lavoroInterviewParseText(text) {
    var raw = String(text || '').trim();
    if (!raw) return raw;
    var stripped = stripLavoroCreationIntentPrefix(raw);
    return stripped || raw;
  }

  /** Stem leggibile per messaggi disamb. (es. «crea lavoro per luca» → «luca»). */
  function lavoroInterviewDisambStemHint(userText, entityKind) {
    var parsed = lavoroInterviewParseText(userText);
    if (!parsed) return '';
    entityKind = entityKind || 'generic';

    if (entityKind === 'person') {
      parsed = extractPersonTokenFromInterviewText(parsed);
    }

    parsed = parsed.replace(/\s+(?:con|nel|nella|in|sul|sulla|per\s+\d+\s+giorn).*$/i, '').trim();
    parsed = parsed.replace(/\b(?:domani|oggi|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b.*$/i, '').trim();
    parsed = parsed.replace(/\b(?:inizio|durata|assegna)\b.*$/i, '').trim();
    if (entityKind === 'person' && mentionsLavoroTipoKeyword(parsed)) {
      parsed = parsed.replace(/\b(?:trinc\w*|erpic\w*|potatur\w*|vendemm\w*|aratur\w*)\w*\b.*$/i, '').trim();
    }
    if (entityKind === 'terreno' && mentionsLavoroTipoKeyword(parsed)) return '';

    if (!parsed || parsed.length > 48) return '';
    if (parseAssignModeFromText(parsed)) return '';
    return parsed;
  }

  function formatPersonInterviewLabel(person, fallback) {
    if (!person) return String(fallback || '').trim();
    return String(((person.nome || '') + ' ' + (person.cognome || '')).trim() || person.nome || person.email || fallback || '').trim();
  }

  function clearLavoroPersonDisamb() {
    window.__tonyLavoroPersonDisambCandidates = null;
    window.__tonyLavoroPersonDisambRole = null;
    window.__tonyLavoroPersonDisambStemHint = null;
  }

  function lavoroInterviewPersonDisambPending() {
    return !!(window.__tonyLavoroPersonDisambCandidates &&
      window.__tonyLavoroPersonDisambCandidates.length > 1);
  }

  function patchResolvesLavoroInterviewPerson(patch) {
    if (!patch || typeof patch !== 'object') return false;
    return !!(patch['lavoro-operaio'] || patch['lavoro-caposquadra']);
  }

  function lavoroInterviewTextAssignsPerson(text) {
    var parseText = lavoroInterviewParseText(text);
    if (parseAssignModeFromText(text) === 'squadra') return false;
    if (parseAssignModeFromText(text) === 'autonomo' && !findPersonInInterviewText(parseText)) return false;
    return !!findPersonInInterviewText(parseText);
  }

  function isLavoroRichCreationMessage(text) {
    var t = String(text || '').trim();
    return /^(crea(\s+un)?\s+lavoro|nuovo\s+lavoro)\b/i.test(t) && t.length > 20;
  }

  function rememberLavoroPendingCreationText(text) {
    if (!isLavoroRichCreationMessage(text)) return;
    window.__tonyLavoroPendingCreationText = String(text).trim();
    window.__tonyLavoroCreationFlow = true;
  }

  function stripAssigneeFieldsFromLavoroPatch(patch) {
    var p = Object.assign({}, patch || {});
    delete p['lavoro-operaio'];
    delete p['lavoro-caposquadra'];
    delete p['tipo-assegnazione'];
    delete p['lavoro-stato'];
    delete p['lavoro-operatore-macchina'];
    return p;
  }

  function mergeLavoroInterviewPatchFromPending(target, source) {
    source = stripAssigneeFieldsFromLavoroPatch(source || {});
    Object.keys(source).forEach(function (k) {
      if (target[k] != null && String(target[k]).trim() !== '') return;
      if (/^lavoro-/.test(k) && typeof lavoroInterviewFieldEmpty === 'function' && !lavoroInterviewFieldEmpty(k)) {
        return;
      }
      target[k] = source[k];
    });
    return target;
  }

  function lavoroInterviewCanApplyPendingTipoHint(text) {
    if (lavoroInterviewNeedsAssignModeQuestion()) return false;
    if (lavoroInterviewPersonDisambPending() && !isLavoroRichCreationMessage(text)) return false;
    if (lavoroInterviewTextAssignsPerson(text) && !isLavoroRichCreationMessage(text)) return false;
    return true;
  }

  function buildLavoroPersonDisambPendingMessage(text) {
    return buildPersonDisambiguationMessage(
      window.__tonyLavoroPersonDisambCandidates,
      window.__tonyLavoroPersonDisambRole || 'operaio',
      window.__tonyLavoroPersonDisambStemHint || lavoroInterviewDisambStemHint(text, 'person')
    );
  }

  function clearLavoroTerrenoDisamb() {
    window.__tonyLavoroTerrenoDisambCandidates = null;
    window.__tonyLavoroTerrenoDisambStemHint = null;
  }

  function setLavoroTerrenoDisamb(candidates) {
    if (!candidates || candidates.length < 2) {
      clearLavoroTerrenoDisamb();
      return;
    }
    window.__tonyLavoroTerrenoDisambCandidates = candidates.map(function (c) {
      return {
        id: c.id || null,
        label: c.label || String(c.nome || '').trim(),
        coltura: c.coltura || null
      };
    });
  }

  function buildTerrenoDisambiguationMessage(candidates, stemHint) {
    var labels = (candidates || []).slice(0, 6).map(function (c) {
      var lbl = c.label || String(c.nome || '').trim();
      if (c.coltura) return lbl + ' (' + c.coltura + ')';
      return lbl;
    }).filter(Boolean);
    if (!labels.length) return 'Su quale terreno?';
    var extra = labels.length < (candidates || []).length ? ' (e altri — sii più specifico)' : '';
    var stem = stemHint ? String(stemHint).trim() : '';
    return 'Ho trovato più terreni' + (stem ? ' per «' + stem + '»' : '') + ': ' +
      labels.join(', ') + extra + '. Su quale lavori? (nome come in elenco)';
  }

  function resolveTerrenoFromDisambReply(userText, candidates) {
    if (!candidates || candidates.length < 2) return null;
    var t = normalizeTonyText(userText);
    if (!t) return null;
    var list = candidates.map(function (c) {
      return { id: c.id || null, label: String(c.label || c.nome || '').trim(), coltura: c.coltura || null };
    }).filter(function (c) { return c.label; });
    if (!list.length) return null;

    var exact = list.filter(function (c) { return normalizeTonyText(c.label) === t; });
    if (exact.length === 1) return exact[0];

    var partial = list.filter(function (c) {
      var n = normalizeTonyText(c.label);
      if (n.indexOf(t) >= 0 || t.indexOf(n) >= 0) return true;
      var parts = t.split(/\s+/).filter(function (w) { return w.length >= 2; });
      return parts.length > 0 && parts.every(function (w) { return n.indexOf(w) >= 0; });
    });
    if (partial.length === 1) return partial[0];
    if (partial.length > 1) {
      var tPartsRank = t.split(/\s+/).filter(function (w) { return w.length >= 2; });
      if (tPartsRank.length >= 2) {
        var ranked = partial.map(function (c) {
          var n = normalizeTonyText(c.label);
          var matched = tPartsRank.filter(function (w) { return n.indexOf(w) >= 0; }).length;
          return { c: c, matched: matched };
        }).sort(function (a, b) { return b.matched - a.matched; });
        if (ranked.length && ranked[0].matched > 0 &&
            (ranked.length === 1 || ranked[0].matched > ranked[1].matched)) {
          return ranked[0].c;
        }
      }
    }

    var terreniList = (window.lavoriState && window.lavoriState.terreniList) || [];
    var allowedIds = {};
    list.forEach(function (c) {
      if (c.id) allowedIds[String(c.id)] = c;
    });
    var scoped = terreniList.filter(function (tr) {
      return tr && tr.id && allowedIds[String(tr.id)];
    });
    if (scoped.length) {
      var hit = findTerrenoInInterviewText(userText, scoped);
      if (isTerrenoInterviewUniqueHit(hit)) {
        return { id: hit.id, label: hit.nome || allowedIds[String(hit.id)].label };
      }
    }
    return null;
  }

  function isTerrenoDisambQualifierText(text) {
    var t = normalizeTonyText(text);
    if (!t) return false;
    if (!window.__tonyLavoroTerrenoDisambCandidates || window.__tonyLavoroTerrenoDisambCandidates.length <= 1) return false;
    if (parseAssignModeFromText(text)) return false;
    if (mentionsLavoroTipoKeyword(text)) return false;
    if (extractLavoroInterviewDate(text) || extractLavoroInterviewDuration(text) != null) return false;
    if (findTrattoreInUserText(text, trattoriListForMacchineDisambReply())) return false;
    if (findPersonInInterviewText(text)) return false;
    return t.length <= 48 && t.split(/\s+/).length <= 5;
  }

  function offerTerrenoDisambResponse(terrenoHit, stemHint) {
    if (!terrenoHit || !terrenoHit.ambiguous || !terrenoHit.candidates || terrenoHit.candidates.length < 2) return null;
    setLavoroTerrenoDisamb(terrenoHit.candidates);
    var stem = lavoroInterviewDisambStemHint(stemHint, 'terreno');
    window.__tonyLavoroTerrenoDisambStemHint = stem || null;
    window.__tonyLavoroInterviewPending = true;
    return buildTerrenoDisambiguationMessage(terrenoHit.candidates, stem);
  }

  function tryTerrenoDisambFromText(text) {
    var terreniList = (window.lavoriState && window.lavoriState.terreniList) || [];
    var parseText = lavoroInterviewParseText(text);
    var hit = findTerrenoInInterviewText(parseText, terreniList);
    if (!hit && parseText !== text) hit = findTerrenoInInterviewText(text, terreniList);
    if (!hit || !hit.ambiguous) return null;
    return offerTerrenoDisambResponse(hit, text);
  }

  function setLavoroPersonDisamb(candidates, role) {
    if (!candidates || candidates.length < 2) {
      clearLavoroPersonDisamb();
      return;
    }
    window.__tonyLavoroPersonDisambCandidates = candidates.map(function (c) {
      return { id: c.id || null, label: c.label || formatPersonInterviewLabel(c, '') };
    });
    window.__tonyLavoroPersonDisambRole = role === 'caposquadra' ? 'caposquadra' : 'operaio';
  }

  function buildPersonDisambiguationMessage(candidates, role, stemHint) {
    var labels = (candidates || []).slice(0, 6).map(function (c) {
      return c.label || formatPersonInterviewLabel(c, '');
    }).filter(Boolean);
    if (!labels.length) {
      return role === 'caposquadra' ? 'A quale caposquadra assegno il lavoro?' : 'A chi lo assegno?';
    }
    var extra = labels.length < (candidates || []).length ? ' (e altri — sii più specifico)' : '';
    var stem = stemHint ? String(stemHint).trim() : '';
    if (role === 'caposquadra') {
      return 'Ho trovato più caposquadra' + (stem ? ' per «' + stem + '»' : '') + ': ' +
        labels.join(', ') + extra + '. Quale assegno? (nome e cognome come in elenco)';
    }
    return 'Ho trovato più operai' + (stem ? ' per «' + stem + '»' : '') + ': ' +
      labels.join(', ') + extra + '. A chi assegno? (nome e cognome come in elenco)';
  }

  function resolvePersonFromDisambReply(userText, candidates, role) {
    if (!candidates || candidates.length < 2) return null;
    var t = normalizeTonyText(userText);
    if (!t) return null;
    var list = candidates.map(function (c) {
      return { id: c.id || null, label: String(c.label || '').trim() };
    }).filter(function (c) { return c.label; });
    if (!list.length) return null;

    var exact = list.filter(function (c) { return normalizeTonyText(c.label) === t; });
    if (exact.length === 1) return exact[0];

    var partial = list.filter(function (c) {
      var n = normalizeTonyText(c.label);
      if (n.indexOf(t) >= 0 || t.indexOf(n) >= 0) return true;
      var parts = t.split(/\s+/).filter(function (w) { return w.length >= 2; });
      return parts.length > 0 && parts.every(function (w) { return n.indexOf(w) >= 0; });
    });
    if (partial.length === 1) return partial[0];

    var operai = (window.lavoriState && window.lavoriState.operaiList) || [];
    var capi = (window.lavoriState && window.lavoriState.caposquadraList) || [];
    var pool = role === 'caposquadra' ? capi : operai;
    var allowedIds = {};
    list.forEach(function (c) {
      if (c.id) allowedIds[String(c.id)] = c;
    });
    var scoped = pool.filter(function (p) {
      return p && p.id && allowedIds[String(p.id)];
    });
    if (scoped.length) {
      var hit = findPersonInListInterviewText(userText, scoped, role || 'operaio');
      if (hit && !hit.ambiguous && hit.id) {
        return { id: hit.id, label: hit.label || allowedIds[String(hit.id)].label };
      }
    }
    return null;
  }

  function isPersonDisambQualifierText(text) {
    var t = normalizeTonyText(text);
    if (!t) return false;
    if (!window.__tonyLavoroPersonDisambCandidates || window.__tonyLavoroPersonDisambCandidates.length <= 1) return false;
    if (parseAssignModeFromText(text)) return false;
    if (mentionsLavoroTipoKeyword(text)) return false;
    if (extractLavoroInterviewDate(text) || extractLavoroInterviewDuration(text) != null) return false;
    if (findTrattoreInUserText(text, trattoriListForMacchineDisambReply())) return false;
    return t.length <= 48 && t.split(/\s+/).length <= 5;
  }

  function offerPersonDisambResponse(personHit, stemHint) {
    if (!personHit || !personHit.ambiguous || !personHit.candidates || personHit.candidates.length < 2) return null;
    var role = personHit.role === 'caposquadra' ? 'caposquadra' : 'operaio';
    setLavoroPersonDisamb(personHit.candidates, role);
    var stem = lavoroInterviewDisambStemHint(stemHint, 'person');
    window.__tonyLavoroPersonDisambStemHint = stem || null;
    setLavoroInterviewConfirmedAssignMode(role === 'caposquadra' ? 'squadra' : 'autonomo');
    window.__tonyLavoroInterviewPending = true;
    return buildPersonDisambiguationMessage(personHit.candidates, role, stem);
  }

  function tryPersonDisambFromText(text, roleHint) {
    var parseText = lavoroInterviewParseText(text);
    var hit = findPersonInInterviewText(parseText, { roleHint: roleHint });
    if (!hit && parseText !== text) hit = findPersonInInterviewText(text, { roleHint: roleHint });
    if (!hit || !hit.ambiguous) return null;
    return offerPersonDisambResponse(hit, text);
  }

  /**
   * Prima di inject CF/cross-page: togli operaio/terreno ambigui dal formData e prepara disamb. locale.
   */
  function sanitizeAmbiguousLavoroInterviewFields(formData, sourceMessage) {
    if (!formData || typeof formData !== 'object') return formData;
    var msg = String(sourceMessage || '').trim();

    function stripPerson(role) {
      var key = role === 'caposquadra' ? 'lavoro-caposquadra' : 'lavoro-operaio';
      if (!formData[key]) return;
      var hint = msg || String(formData[key] || '').trim();
      var roleHint = role === 'caposquadra' ? 'squadra' : 'autonomo';
      var hit = findPersonInInterviewText(hint, { roleHint: roleHint });
      if ((!hit || !hit.ambiguous) && hint !== msg && msg) {
        hit = findPersonInInterviewText(msg, { roleHint: roleHint });
      }
      if (hit && hit.ambiguous) {
        delete formData[key];
        delete formData['lavoro-operatore-macchina'];
        if (formData['tipo-assegnazione'] === (role === 'caposquadra' ? 'squadra' : 'autonomo')) {
          delete formData['tipo-assegnazione'];
        }
        if (formData['lavoro-stato'] === 'assegnato') delete formData['lavoro-stato'];
        offerPersonDisambResponse(hit, msg || hint);
        window.__tonyLavoroCreationFlow = true;
        window.__tonyLavoroInterviewPending = true;
      }
    }

    stripPerson('operaio');
    if (!window.__tonyLavoroPersonDisambCandidates) stripPerson('caposquadra');

    if (!window.__tonyLavoroTerrenoDisambCandidates && formData['lavoro-terreno']) {
      var terrenoVal = String(formData['lavoro-terreno'] || '').trim();
      if (!looksLikeFirestoreDocId(terrenoVal)) {
        var terreniList = (window.lavoriState && window.lavoriState.terreniList) || [];
        var trHint = msg || terrenoVal;
        var trHit = findTerrenoInInterviewText(trHint, terreniList);
        if ((!trHit || !trHit.ambiguous) && msg && trHint !== msg) {
          trHit = findTerrenoInInterviewText(msg, terreniList);
        }
        if (trHit && trHit.ambiguous) {
          delete formData['lavoro-terreno'];
          delete formData['lavoro-sottocategoria'];
          offerTerrenoDisambResponse(trHit, msg || trHint);
          window.__tonyLavoroCreationFlow = true;
          window.__tonyLavoroInterviewPending = true;
        }
      }
    }

    return formData;
  }

  function findPersonInListInterviewText(text, list, role) {
    var raw = String(text || '').trim();
    if (!raw || !Array.isArray(list) || !list.length) return null;
    var token = extractPersonTokenFromInterviewText(raw);
    var tokN = normalizeTonyText(token);
    if (!tokN || tokN.length < 2) return null;
    var hits = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p) continue;
      var nome = normalizeTonyText(p.nome || '');
      var cognome = normalizeTonyText(p.cognome || '');
      var full = normalizeTonyText(formatPersonInterviewLabel(p, ''));
      if (!full) continue;
      if (full === tokN || tokN === nome || tokN === cognome) {
        hits.push(p);
        continue;
      }
      if (full.indexOf(tokN) >= 0 || tokN.indexOf(full) >= 0) {
        hits.push(p);
        continue;
      }
      var tokParts = tokN.split(/\s+/).filter(function (w) { return w.length >= 2; });
      if (tokParts.length && tokParts.every(function (w) { return full.indexOf(w) >= 0; })) {
        hits.push(p);
        continue;
      }
      if (tokParts.length === 1 && tokParts[0].length >= 3) {
        if (nome.indexOf(tokParts[0]) === 0 || cognome.indexOf(tokParts[0]) === 0 ||
            nome === tokParts[0] || cognome === tokParts[0]) {
          hits.push(p);
        }
      }
    }
    var seen = {};
    hits = hits.filter(function (p) {
      var id = String(p.id || formatPersonInterviewLabel(p, ''));
      if (seen[id]) return false;
      seen[id] = 1;
      return true;
    });
    if (hits.length === 1) {
      return {
        role: role,
        id: hits[0].id || null,
        label: formatPersonInterviewLabel(hits[0], token)
      };
    }
    if (hits.length > 1) {
      return {
        role: role,
        ambiguous: true,
        candidates: hits.map(function (p) {
          return { id: p.id || null, label: formatPersonInterviewLabel(p, token) };
        })
      };
    }
    var resolvedId = resolveUserByName(token, list);
    if (resolvedId) {
      var resolved = list.find(function (p) { return String(p.id || '') === String(resolvedId); });
      return {
        role: role,
        id: resolvedId,
        label: formatPersonInterviewLabel(resolved, token)
      };
    }
    return null;
  }

  function findPersonInInterviewText(text, opts) {
    opts = opts || {};
    var operai = (window.lavoriState && window.lavoriState.operaiList) || [];
    var capi = (window.lavoriState && window.lavoriState.caposquadraList) || [];
    var assignMode = opts.roleHint || null;
    if (!assignMode && lavoroInterviewAssignModeConfirmed()) {
      assignMode = getLavoroInterviewAssignMode();
    }
    if (!assignMode) {
      var lastQ = String(window.__tonyLastLavoroInterviewQuestion || '');
      if (/caposquadra/i.test(lastQ)) assignMode = 'squadra';
      else if (/\b(chi|persona|operaio)\b/i.test(lastQ) ||
          /squadra\s+o\s+(?:lo\s+assegno\s+a\s+)?(?:una\s+)?persona/i.test(lastQ)) {
        assignMode = 'autonomo';
      }
    }
    if (assignMode === 'squadra') {
      return findPersonInListInterviewText(text, capi, 'caposquadra');
    }
    if (assignMode === 'autonomo') {
      return findPersonInListInterviewText(text, operai, 'operaio');
    }
    var squadraIntent = parseAssignModeFromText(text) === 'squadra' ||
      /\blavoro\s+di\s+squadra\b/i.test(normalizeTonyText(text));
    var capHit = findPersonInListInterviewText(text, capi, 'caposquadra');
    var opHit = findPersonInListInterviewText(text, operai, 'operaio');
    if (!squadraIntent && opHit) return opHit;
    if (capHit && !capHit.ambiguous && (!opHit || opHit.ambiguous)) return capHit;
    if (opHit && !opHit.ambiguous && (!capHit || capHit.ambiguous)) return opHit;
    if (capHit && capHit.ambiguous && opHit && opHit.ambiguous) {
      return squadraIntent ? null : opHit;
    }
    if (capHit && capHit.ambiguous) return capHit;
    if (opHit && opHit.ambiguous) return opHit;
    if (capHit && !capHit.ambiguous && opHit && !opHit.ambiguous && capHit.id === opHit.id) return capHit;
    return null;
  }

  function getTerrenoRecordForInterviewHint(terrenoHint) {
    var list = (window.lavoriState && window.lavoriState.terreniList) || [];
    if (!terrenoHint) {
      var el = document.getElementById('lavoro-terreno');
      if (el && el.value) terrenoHint = el.value;
    }
    if (!terrenoHint) return null;
    var v = String(terrenoHint).trim();
    var hit = list.find(function (t) { return String(t.id || '') === v; });
    if (hit) return hit;
    var vn = normalizeTonyText(v);
    return list.find(function (t) {
      var n = normalizeTonyText(t.nome || '');
      return n === vn || n.indexOf(vn) >= 0 || vn.indexOf(n) >= 0;
    }) || null;
  }

  function findTipoLavoroCandidatesInInterviewText(text, terrenoHint) {
    if (!mentionsLavoroTipoKeyword(text)) return [];
    var list = (window.lavoriState && window.lavoriState.tipiLavoroList) || [];
    if (!list.length) return [];
    var t = normalizeLavoroTipoUserText(text);
    var stem = lavoroTipoStemFromText(text);
    return list.filter(function (tipo) {
      var n = normalizeTonyText(tipo.nome || '');
      if (!n) return false;
      if (t && (t.indexOf(n) >= 0 || (n.length >= 4 && n.indexOf(t) >= 0))) return true;
      if (stem && n.indexOf(stem) >= 0) return true;
      return false;
    });
  }

  function scoreTipoLavoroForInterview(tipo, text, terrenoHint, assignMode) {
    var n = normalizeTonyText(tipo.nome || '');
    var t = normalizeTonyText(text);
    var sc = 0;
    var terreno = getTerrenoRecordForInterviewHint(terrenoHint);
    var hasFilari = terrenoHasFilariColtura(terreno);
    if (hasFilari) {
      if (n.indexOf('tra le file') >= 0 || n.indexOf('sulla fila') >= 0) sc += 5;
    } else if (n.indexOf('generale') >= 0 || (n.indexOf('tra le file') < 0 && n.indexOf('sulla fila') < 0)) {
      sc += 2;
    }
    if (/\bmanuale\b/.test(t) && n.indexOf('manual') >= 0) sc += 10;
    if (/\bmeccanic/.test(t) && n.indexOf('meccanic') >= 0) sc += 10;
    if (/\bproduzione\b/.test(t) && n.indexOf('produz') >= 0) sc += 8;
    if (/\bverde\b/.test(t) && n.indexOf('verde') >= 0) sc += 8;
    if (!/\bmeccanic/.test(t) && n.indexOf('meccanic') >= 0) sc -= 7;
    if (!/\bmanual/.test(t) && !/\bmanuale\b/.test(t) && n.indexOf('manual') >= 0) sc += 4;
    if (assignMode === 'autonomo' && !/\bmeccanic/.test(t) && n.indexOf('meccanic') >= 0) sc -= 5;
    sc += Math.min((tipo.nome || '').length, 80) / 200;
    return sc;
  }

  function isLavoroTipoDisambQualifierText(text) {
    var t = normalizeTonyText(text);
    if (!t) return false;
    if (/\b(tra\s+le\s+file|sulla\s+fila|generale|manuale|meccanic\w*|produzione|verde)\b/.test(t)) return true;
    if (!window.__tonyLavoroTipoDisambCandidates || window.__tonyLavoroTipoDisambCandidates.length <= 1) return false;
    if (mentionsLavoroTipoKeyword(text)) return true;
    if (findTrattoreInUserText(t, trattoriListForMacchineDisambReply())) return false;
    return t.split(/\s+/).length <= 5 && t.length <= 48;
  }

  function userTextShouldGoToLavoroInterviewNotMacchine(userText) {
    var modal = document.getElementById('lavoro-modal');
    if (!modal || !modal.classList.contains('active')) return false;
    if (window.__tonyAwaitingLavoroSaveConfirm) return false;
    var t = String(userText || '').trim();
    if (!t) return false;
    if (lavoroInterviewCanAskMacchine()) {
      if (findTrattoreInUserText(t, trattoriListForMacchineDisambReply()) && lavoroSelectIsEmpty('lavoro-trattore')) return false;
      if (findAttrezzoInUserText(t, attrezziListForMacchineDisambReply()) && !lavoroSelectIsEmpty('lavoro-trattore') &&
          lavoroSelectIsEmpty('lavoro-attrezzo')) return false;
    }
    if (isLavoroTipoCorrectionText(t)) return true;
    if (isLavoroTerrenoCorrectionText(t)) return true;
    if (window.__tonyLavoroAwaitingTipoModo) return true;
    if (window.__tonyLavoroTipoDisambCandidates && window.__tonyLavoroTipoDisambCandidates.length > 1 &&
        isLavoroTipoDisambQualifierText(t)) return true;
    if (mentionsLavoroTipoKeyword(t) && !lavoroTipoIsChosen()) {
      if (!findTrattoreInUserText(t, trattoriListForMacchineDisambReply())) return true;
    }
    if (lavoroInterviewNeedsScheduleFields() &&
        (extractLavoroInterviewDate(t) || extractLavoroInterviewDuration(t) != null)) return true;
    return userCanReplyToLavoroInterview(t, { skipMacchineCheck: true });
  }

  function isLavoroTipoStemOnlyText(text) {
    if (!mentionsLavoroTipoKeyword(text)) return false;
    if (parseTipoModoFromText(text)) return false;
    var t = normalizeTonyText(normalizeLavoroTipoUserText(text));
    if (!t) return false;
    if (/\b(manuale|meccanic\w*|produzione|verde|tra\s+le\s+file|sulla\s+fila|generale)\b/.test(t)) return false;
    var query = normalizeTonyText(lavoroTipoQueryFromText(text));
    if (query && (t === query || t.indexOf(query) === 0)) return true;
    return t.split(/\s+/).filter(Boolean).length <= 2;
  }

  function parseTipoModoFromText(text) {
    var t = normalizeTonyText(String(text || '').trim());
    if (!t) return null;
    if (/^(manuale|manual|a\s+mano)\b/.test(t)) return 'manuale';
    if (/^(meccanic\w*|meccanica)\b/.test(t)) return 'meccanica';
    if (/\bmanuale\b/.test(t) && !/\bmeccanic\w*\b/.test(t)) return 'manuale';
    if (/\bmeccanic\w*\b/.test(t)) return 'meccanica';
    return null;
  }

  function classifyTipoLavoroModo(nome) {
    var s = normalizeTonyText(String(nome || ''));
    if (!s) return null;
    var cfg = getLavorazioniDefaultsTony();
    var mechKw = Array.isArray(cfg.mechanicalSubtypeKeywords) ? cfg.mechanicalSubtypeKeywords : ['meccanic', 'verde'];
    var manKw = Array.isArray(cfg.manualSubtypeKeywords) ? cfg.manualSubtypeKeywords : ['manual', 'manuale', 'produz'];
    var mechHit = mechKw.some(function (k) {
      var nk = normalizeTonyText(k);
      return nk && s.indexOf(nk) >= 0;
    });
    var manHit = manKw.some(function (k) {
      var nk = normalizeTonyText(k);
      return nk && s.indexOf(nk) >= 0;
    });
    if (mechHit && manHit) return s.indexOf('meccanic') >= 0 ? 'meccanica' : 'manuale';
    if (mechHit) return 'meccanica';
    if (manHit) return 'manuale';
    var mechDefault = Array.isArray(cfg.mechanicalDefaultKeywords) ? cfg.mechanicalDefaultKeywords : [];
    if (mechDefault.some(function (k) {
      var nk = normalizeTonyText(k);
      return nk && s.indexOf(nk) >= 0;
    })) return 'meccanica';
    return null;
  }

  function filterTipoCandidatesByModo(candidates, modo) {
    if (!modo || !Array.isArray(candidates)) return candidates || [];
    return candidates.filter(function (t) {
      var nome = (t && t.nome) ? t.nome : t;
      return classifyTipoLavoroModo(nome) === modo;
    });
  }

  function stemSkipsManualMechFirstChoice(text) {
    var stem = lavoroTipoStemFromText(text);
    if (!stem) return false;
    var cfg = getLavorazioniDefaultsTony();
    var skip = Array.isArray(cfg.manualMechSkipStems) ? cfg.manualMechSkipStems : [];
    var sn = normalizeTonyText(stem);
    return skip.some(function (k) {
      var nk = normalizeTonyText(k);
      return nk && (sn.indexOf(nk) >= 0 || nk.indexOf(sn) >= 0);
    });
  }

  function lavoroTipoStemNeedsManualMechChoice(text, terrenoHint, candidates) {
    if (parseTipoModoFromText(text) || window.__tonyLavoroTipoModo) return false;
    if (stemSkipsManualMechFirstChoice(text)) return false;
    var stem = lavoroTipoStemFromText(text);
    if (!stem) return false;
    var cfg = getLavorazioniDefaultsTony();
    var choiceStems = Array.isArray(cfg.manualMechChoiceStems) ? cfg.manualMechChoiceStems : ['potatur'];
    var stemAllowed = choiceStems.some(function (k) {
      var nk = normalizeTonyText(k);
      return nk && (stem.indexOf(nk) >= 0 || nk.indexOf(stem) >= 0);
    });
    if (!stemAllowed) return false;
    var pool = candidates;
    if (!pool || !pool.length) {
      var query = lavoroTipoQueryFromText(text) || String(text || '').trim();
      pool = findTipoLavoroCandidatesInInterviewText(query, terrenoHint);
    }
    if (!pool || pool.length < 2) return false;
    var hasMan = false;
    var hasMech = false;
    for (var i = 0; i < pool.length; i++) {
      var nome = (pool[i] && pool[i].nome) ? pool[i].nome : pool[i];
      var modo = classifyTipoLavoroModo(nome);
      if (modo === 'manuale') hasMan = true;
      if (modo === 'meccanica') hasMech = true;
    }
    return hasMan && hasMech;
  }

  function buildTipoModoQuestion(stemHint) {
    var label = stemHint ? lavoroTipoQueryFromText(stemHint) : '';
    if (!label && stemHint) label = String(stemHint).trim();
    return 'Per la ' + (label || 'lavorazione') + ', è manuale o meccanica?';
  }

  function getAmbiguousTipoLavoroCandidates(text, terrenoHint, assignMode) {
    var query = lavoroTipoQueryFromText(text) || String(text || '').trim();
    var matches = findTipoLavoroCandidatesInInterviewText(query, terrenoHint);
    if (!matches.length && query !== text) {
      matches = findTipoLavoroCandidatesInInterviewText(text, terrenoHint);
    }
    if (!matches.length) return { auto: null, candidates: [] };
    if (matches.length === 1) return { auto: matches[0].nome, candidates: [] };
    if (lavoroTipoStemNeedsManualMechChoice(text, terrenoHint, matches)) {
      return { auto: null, candidates: matches };
    }
    var autoPick = findTipoLavoroInInterviewText(text, terrenoHint, assignMode);
    if (autoPick) return { auto: autoPick, candidates: [] };
    var scored = matches.map(function (tipo) {
      return { tipo: tipo, score: scoreTipoLavoroForInterview(tipo, text, terrenoHint, assignMode) };
    }).sort(function (a, b) { return b.score - a.score; });
    return { auto: null, candidates: scored.map(function (row) { return row.tipo; }) };
  }

  function offerTipoLavoroDisambIfNeeded(text, terrenoHint, opts) {
    opts = opts || {};
    if (lavoroTipoIsChosen()) return null;
    var terr = String(terrenoHint || '').trim();
    if (!terr && !opts.allowNoTerreno) {
      var terrEl = document.getElementById('lavoro-terreno');
      terr = terrEl && terrEl.value ? String(terrEl.value).trim() : '';
    }
    if (!terr) return null;
    var hint = String(text || '').trim();
    if (!mentionsLavoroTipoKeyword(hint) && window.__tonyLavoroPendingTipoHint) {
      hint = window.__tonyLavoroPendingTipoHint;
    }
    if (!mentionsLavoroTipoKeyword(hint)) return null;
    var amb = getAmbiguousTipoLavoroCandidates(hint, terr, getConfirmedLavoroInterviewAssignMode());
    var mechPool = amb.candidates && amb.candidates.length
      ? amb.candidates
      : findTipoLavoroCandidatesInInterviewText(lavoroTipoQueryFromText(hint) || hint, terr);
    if (lavoroTipoStemNeedsManualMechChoice(hint, terr, mechPool) &&
        (isLavoroTipoStemOnlyText(hint) || opts.preferList)) {
      window.__tonyLavoroAwaitingTipoModo = true;
      window.__tonyLavoroTipoStemCandidates = mechPool.slice();
      window.__tonyLavoroTipoDisambCandidates = null;
      return buildTipoModoQuestion(hint);
    }
    // Policy coltura: con terreno noto non chiedere disamb. sottocategoria/copertura (§14.7)
    if (amb.auto) return null;
    if (!amb.candidates || !amb.candidates.length) return null;

    var pool = amb.candidates.slice();
    var modoFilter = parseTipoModoFromText(hint) || window.__tonyLavoroTipoModo;
    if (modoFilter) {
      pool = filterTipoCandidatesByModo(pool, modoFilter);
    }
    if (pool.length === 1 && !opts.preferList) return null;
    if (pool.length <= 1) return null;

    window.__tonyLavoroTipoDisambCandidates = pool.map(function (t) { return t.nome || t; });
    return buildTipoLavoroDisambiguationMessage(pool, hint, modoFilter);
  }

  function resolveTipoLavoroFromDisambReply(userText, candidateNames, terrenoHint) {
    if (!candidateNames || !candidateNames.length) return null;
    var list = candidateNames.map(function (n) { return String(n || '').trim(); }).filter(Boolean);
    if (!list.length) return null;
    var t = normalizeTonyText(userText);
    if (!t) return null;

    var exact = list.filter(function (nome) {
      return normalizeTonyText(nome) === t;
    });
    if (exact.length === 1) return exact[0];

    var partial = list.filter(function (nome) {
      var n = normalizeTonyText(nome);
      if (n.indexOf(t) >= 0 || t.indexOf(n) >= 0) return true;
      var parts = t.split(/\s+/).filter(function (w) { return w.length >= 3; });
      return parts.length > 0 && parts.every(function (w) { return n.indexOf(w) >= 0; });
    });
    if (partial.length === 1) return partial[0];

    var scored = list.map(function (nome) {
      return {
        nome: nome,
        score: scoreTipoLavoroForInterview({ nome: nome }, userText, terrenoHint, getConfirmedLavoroInterviewAssignMode())
      };
    }).sort(function (a, b) { return b.score - a.score; });
    if (!scored.length) return null;
    if (scored.length === 1 && scored[0].score > 0) return scored[0].nome;
    if (scored.length >= 2 && scored[0].score - scored[1].score >= 3) return scored[0].nome;
    return null;
  }

  function buildTipoLavoroDisambiguationMessage(candidates, stemHint, modoHint) {
    var all = (candidates || []).map(function (tipo) {
      return String((tipo && tipo.nome) || tipo || '').trim();
    }).filter(Boolean);
    var labels = all.slice(0, 5);
    if (!labels.length) return 'Che tipo di lavoro devo impostare?';
    var stemLabel = stemHint ? lavoroTipoQueryFromText(stemHint) : '';
    if (!stemLabel && stemHint) stemLabel = String(stemHint).trim();
    var extra = all.length > 5 ? ' (e altre varianti — sii più specifico)' : '';
    var modoLabel = modoHint === 'manuale' ? ' manuale' : (modoHint === 'meccanica' ? ' meccanica' : '');
    var subject = stemLabel ? (stemLabel + modoLabel) : ('questo lavoro' + modoLabel);
    return 'Per ' + subject + ' ci sono: ' + labels.join(', ') +
      extra + '. Indica quale usare (nome esatto).';
  }

  function findTipoLavoroInInterviewText(text, terrenoHint, assignMode, modoFilter) {
    var query = lavoroTipoQueryFromText(text);
    var matches = findTipoLavoroCandidatesInInterviewText(query, terrenoHint);
    if (!matches.length && query !== text) {
      matches = findTipoLavoroCandidatesInInterviewText(text, terrenoHint);
    }
    if (!matches.length) return null;
    var modo = modoFilter || parseTipoModoFromText(text) || window.__tonyLavoroTipoModo;
    if (modo) matches = filterTipoCandidatesByModo(matches, modo);
    if (!matches.length) return null;
    if (lavoroTipoStemNeedsManualMechChoice(text, terrenoHint, matches)) return null;
    if (matches.length === 1) return matches[0].nome;
    var terreno = getTerrenoRecordForInterviewHint(terrenoHint);
    var hasTerreno = !!(terreno || String(terrenoHint || '').trim());
    if (isLavoroTipoStemOnlyText(text) && !hasTerreno) return null;
    var scored = matches.map(function (tipo) {
      return { tipo: tipo, score: scoreTipoLavoroForInterview(tipo, text, terrenoHint, assignMode) };
    }).sort(function (a, b) { return b.score - a.score; });
    if (!scored.length) return null;
    if (scored.length === 1) return scored[0].tipo.nome;
    var margin = scored[0].score - scored[1].score;
    if (margin >= 3) return scored[0].tipo.nome;
    if (hasTerreno && isLavoroTipoStemOnlyText(text) && stemSkipsManualMechFirstChoice(text) &&
        margin >= 2 && scored[0].score > 0) {
      return scored[0].tipo.nome;
    }
    if (hasTerreno && isLavoroTipoStemOnlyText(text) && terrenoHasFilariColtura(terreno)) {
      var filariRows = scored.filter(function (row) {
        var nn = normalizeTonyText(row.tipo.nome || '');
        return nn.indexOf('tra le file') >= 0 || nn.indexOf('sulla fila') >= 0;
      });
      if (filariRows.length === 1) return filariRows[0].tipo.nome;
      if (filariRows.length > 1 && filariRows[0].score - filariRows[1].score >= 2) {
        return filariRows[0].tipo.nome;
      }
    }
    if (hasTerreno && isLavoroTipoStemOnlyText(text) && terreno && !terrenoHasFilariColtura(terreno)) {
      var genRows = scored.filter(function (row) {
        return normalizeTonyText(row.tipo.nome || '').indexOf('generale') >= 0;
      });
      if (genRows.length === 1) return genRows[0].tipo.nome;
      if (genRows.length > 1 && genRows[0].score - genRows[1].score >= 2) return genRows[0].tipo.nome;
    }
    return null;
  }

  function noteLavoroInterviewMacchineQuestion(message, needsMacchine) {
    if (!needsMacchine || !message) return;
    if (/trattor/i.test(message) && lavoroSelectIsEmpty('lavoro-trattore')) {
      markLavoroInterviewMacchineAsked('lavoro-trattore');
    } else if (/attrezz/i.test(message) && lavoroSelectIsEmpty('lavoro-attrezzo')) {
      markLavoroInterviewMacchineAsked('lavoro-attrezzo');
    }
  }

  function buildLavoroTipoStemOnlyAckMessage(tipoNome, terrenoHint) {
    var tipo = String(tipoNome || '').trim();
    if (!tipo) return '';
    var terrRec = getTerrenoRecordForInterviewHint(terrenoHint);
    var terrLabel = (terrRec && terrRec.nome) ? String(terrRec.nome).trim() : String(terrenoHint || '').trim();
    if (terrLabel) return 'Ok, ' + tipo + ' su ' + terrLabel + '.';
    return 'Ok, ' + tipo + '.';
  }

  function shouldAckLavoroTipoStemOnlyAutoPick(userText, patch, opts) {
    opts = opts || {};
    if (!patch || !patch['lavoro-tipo-lavoro']) return false;
    if (opts.fromDisamb || opts.fromTipoModo) return false;
    if (isLavoroTipoCorrectionText(userText)) return false;
    var text = String(userText || '').trim();
    var tipoSource = text;
    if (lavoroInterviewCanApplyPendingTipoHint(text) && window.__tonyLavoroPendingTipoHint &&
        !mentionsLavoroTipoKeyword(text)) {
      tipoSource = window.__tonyLavoroPendingTipoHint;
    }
    if (!isLavoroTipoStemOnlyText(tipoSource) && !isLavoroTipoStemOnlyText(text)) return false;
    var terr = patch['lavoro-terreno'] ||
      (document.getElementById('lavoro-terreno') && document.getElementById('lavoro-terreno').value) || '';
    if (lavoroTipoStemNeedsManualMechChoice(tipoSource, terr)) return false;
    return true;
  }

  function prependLavoroTipoStemOnlyAck(message, userText, patch, opts) {
    if (!shouldAckLavoroTipoStemOnlyAutoPick(userText, patch, opts)) return message;
    var terrAck = patch['lavoro-terreno'] ||
      (document.getElementById('lavoro-terreno') && document.getElementById('lavoro-terreno').value) || '';
    var ack = buildLavoroTipoStemOnlyAckMessage(patch['lavoro-tipo-lavoro'], terrAck);
    if (!ack) return message;
    if (!message) return ack;
    return ack + ' ' + message;
  }

  function applyLavoroAssigneeFromTextToPatch(patch, userText, opts) {
    opts = opts || {};
    patch = patch || {};
    var text = String(userText || '').trim();
    if (!text) return patch;
    var parseText = lavoroInterviewParseText(text);
    var assignMode = getConfirmedLavoroInterviewAssignMode();

    if (lavoroInterviewNeedsAssignModeQuestion()) {
      var personEarly = findPersonInInterviewText(parseText);
      if (!personEarly && parseText !== text) personEarly = findPersonInInterviewText(text);
      if (personEarly && personEarly.ambiguous) {
        if (opts.offerDisamb !== false) offerPersonDisambResponse(personEarly, text);
      } else if (personEarly && !personEarly.ambiguous) {
        if (personEarly.role === 'caposquadra') {
          patch['tipo-assegnazione'] = 'squadra';
          patch['lavoro-caposquadra'] = personEarly.id || personEarly.label;
        } else {
          patch['tipo-assegnazione'] = 'autonomo';
          patch['lavoro-operaio'] = personEarly.id || personEarly.label;
        }
        patch['lavoro-stato'] = 'assegnato';
        setLavoroInterviewConfirmedAssignMode(patch['tipo-assegnazione']);
        assignMode = patch['tipo-assegnazione'];
      } else {
        var modeParsed = parseAssignModeFromText(text);
        if (modeParsed) {
          patch['tipo-assegnazione'] = modeParsed;
          setLavoroInterviewConfirmedAssignMode(modeParsed);
          assignMode = modeParsed;
        }
      }
    }

    if (lavoroInterviewAssignModeConfirmed()) {
      var assignModeNow = assignMode || getConfirmedLavoroInterviewAssignMode();
      if (assignModeNow === 'squadra' && lavoroInterviewFieldEmpty('lavoro-caposquadra')) {
        var capoOnly = findPersonInInterviewText(text, { roleHint: 'squadra' });
        if (capoOnly && !capoOnly.ambiguous) {
          patch['tipo-assegnazione'] = 'squadra';
          patch['lavoro-caposquadra'] = capoOnly.id || capoOnly.label;
          patch['lavoro-stato'] = 'assegnato';
        }
      } else if (assignModeNow === 'autonomo' && lavoroInterviewFieldEmpty('lavoro-operaio')) {
        var opOnly = findPersonInInterviewText(text, { roleHint: 'autonomo' });
        if (opOnly && !opOnly.ambiguous) {
          patch['tipo-assegnazione'] = 'autonomo';
          patch['lavoro-operaio'] = opOnly.id || opOnly.label;
          patch['lavoro-stato'] = 'assegnato';
          setLavoroInterviewConfirmedAssignMode('autonomo');
        }
      }
    }

    if (patch['lavoro-operaio'] && patch['tipo-assegnazione'] === 'autonomo' && lavoroInterviewFieldEmpty('lavoro-operatore-macchina')) {
      patch['lavoro-operatore-macchina'] = patch['lavoro-operaio'];
    }
    return patch;
  }

  function buildLavoroInterviewPatch(userText) {
    var patch = {};
    var text = String(userText || '').trim();
    if (!text) return patch;
    if (/^(crea(\s+un)?\s+lavoro|nuovo\s+lavoro)\s*$/i.test(text)) return patch;

    rememberLavoroPendingCreationText(text);
    var parseText = lavoroInterviewParseText(text);
    var terreniList = (window.lavoriState && window.lavoriState.terreniList) || [];
    var assignMode = getConfirmedLavoroInterviewAssignMode();
    var terrenoCorrection = isLavoroTerrenoCorrectionText(text);
    var canPatchTerreno = lavoroInterviewFieldEmpty('lavoro-terreno') || terrenoCorrection;

    if (canPatchTerreno) {
      if (!terrenoCorrection && lavoroInterviewTextNamesPersonOnly(text)) {
        /* persona nel messaggio (es. «per Luca Fabbri») — non inferire terreno da cognome */
      } else {
        var terrenoQuery = extractTerrenoQueryFromInterviewText(parseText);
        if (!terrenoQuery || terrenoQuery === parseText) {
          terrenoQuery = extractTerrenoQueryFromInterviewText(text);
        }
        var trSearch = terrenoQuery || parseText;
        var tr = findTerrenoInInterviewText(trSearch, terreniList);
        if (!tr && trSearch !== text) tr = findTerrenoInInterviewText(text, terreniList);
        if (tr && tr.ambiguous) {
          offerTerrenoDisambResponse(tr, text);
        } else if (isTerrenoInterviewUniqueHit(tr)) {
          patch['lavoro-terreno'] = String(tr.id || tr.nome || '').trim();
          if (terrenoCorrection) {
            delete patch['lavoro-tipo-lavoro'];
            delete patch['lavoro-categoria-principale'];
            delete patch['lavoro-sottocategoria'];
          }
        }
      }
    }

    var terrenoHint = patch['lavoro-terreno'] || (document.getElementById('lavoro-terreno') && document.getElementById('lavoro-terreno').value) || '';
    var terrenoSet = !!String(terrenoHint || '').trim();
    var tipoCorrection = isLavoroTipoCorrectionText(text);
    var canTipoNow = lavoroInterviewCanApplyPendingTipoHint(text);
    var tipoSource = text;
    if (canTipoNow && terrenoSet && lavoroInterviewFieldEmpty('lavoro-tipo-lavoro') && window.__tonyLavoroPendingTipoHint &&
        !mentionsLavoroTipoKeyword(text)) {
      tipoSource = window.__tonyLavoroPendingTipoHint;
    }
    if (terrenoSet && (mentionsLavoroTipoKeyword(tipoSource) || mentionsLavoroTipoKeyword(text)) &&
        (lavoroInterviewFieldEmpty('lavoro-tipo-lavoro') || tipoCorrection) &&
        (canTipoNow || mentionsLavoroTipoKeyword(text))) {
      var modoFromText = parseTipoModoFromText(text) || window.__tonyLavoroTipoModo;
      if (modoFromText) window.__tonyLavoroTipoModo = modoFromText;
      var tipoNome = findTipoLavoroInInterviewText(tipoSource, terrenoHint, assignMode || getConfirmedLavoroInterviewAssignMode(), modoFromText);
      if (!tipoNome && tipoSource !== text) {
        tipoNome = findTipoLavoroInInterviewText(text, terrenoHint, assignMode || getConfirmedLavoroInterviewAssignMode(), modoFromText);
      }
      if (tipoNome) {
        patch['lavoro-tipo-lavoro'] = tipoNome;
        window.__tonyLavoroPendingTipoHint = '';
        if (!inferRequiresMachineFromTipo(tipoNome)) {
          patch['lavoro-trattore'] = '';
          patch['lavoro-attrezzo'] = '';
        }
      }
    } else if (mentionsLavoroTipoKeyword(text) && lavoroInterviewFieldEmpty('lavoro-terreno') &&
        lavoroInterviewFieldEmpty('lavoro-tipo-lavoro')) {
      window.__tonyLavoroPendingTipoHint = text;
    }

    if (lavoroInterviewFieldEmpty('lavoro-data-inizio')) {
      var askDurOnly = lavoroInterviewLastQuestionAsksDurata() && !lavoroInterviewLastQuestionAsksDate();
      if (!askDurOnly) {
        var dataIso = extractLavoroInterviewDate(text);
        if (dataIso) patch['lavoro-data-inizio'] = dataIso;
      }
    }

    if (lavoroInterviewFieldEmpty('lavoro-durata')) {
      var askDateOnly = lavoroInterviewLastQuestionAsksDate() && !lavoroInterviewLastQuestionAsksDurata();
      if (!askDateOnly) {
        var dur = extractLavoroInterviewDuration(text);
        if (dur != null) patch['lavoro-durata'] = String(dur);
      }
    }

    if (lavoroInterviewFieldEmpty('lavoro-nome')) {
      var tipoForNome = patch['lavoro-tipo-lavoro'];
      if (!tipoForNome && lavoroTipoIsChosen()) {
        tipoForNome = getLavoroTipoDomText();
      }
      if (!tipoForNome) {
        var tipoEl = document.getElementById('lavoro-tipo-lavoro');
        if (tipoEl && tipoEl.options && tipoEl.selectedIndex >= 0 && lavoroSelectHasChoice('lavoro-tipo-lavoro')) {
          tipoForNome = String(tipoEl.options[tipoEl.selectedIndex].text || tipoEl.value || '').trim();
        }
      }
      var terrRec = getTerrenoRecordForInterviewHint(patch['lavoro-terreno'] || terrenoHint);
      if (tipoForNome && !/seleziona/i.test(tipoForNome) && terrRec && terrRec.nome) {
        patch['lavoro-nome'] = String(tipoForNome + ' ' + terrRec.nome).trim().slice(0, 80);
      }
    }

    if (getLavoroTipoDomText() && lavoroInterviewFieldEmpty('lavoro-nome')) {
      var nomeCand = String(text || '').trim();
      if (nomeCand && nomeCand.length <= 60 && nomeCand.split(/\s+/).length <= 6 &&
          !mentionsLavoroTipoKeyword(nomeCand) && !parseAssignModeFromText(nomeCand) &&
          !findPersonInInterviewText(nomeCand) && !isTerrenoInterviewUniqueHit(findTerrenoInInterviewText(nomeCand, terreniList)) &&
          !extractLavoroInterviewDate(nomeCand) && extractLavoroInterviewDuration(nomeCand) == null &&
          !/^--\s|seleziona/i.test(nomeCand)) {
        patch['lavoro-nome'] = nomeCand.slice(0, 80);
      }
    }

    patch = applyLavoroAssigneeFromTextToPatch(patch, text);
    return patch;
  }

  function buildNextLavoroInterviewMessage(requiredEmpty, needsMacchine) {
    if (lavoroInterviewPersonDisambPending()) {
      return buildLavoroPersonDisambPendingMessage('');
    }
    if (lavoroInterviewNeedsAssignModeQuestion()) {
      return 'È un lavoro di squadra o lo assegno a una persona?';
    }
    var assignMode = getConfirmedLavoroInterviewAssignMode();
    if (assignMode === 'squadra' && requiredEmpty.indexOf('lavoro-caposquadra') >= 0) {
      if (window.__tonyLavoroPersonDisambCandidates && window.__tonyLavoroPersonDisambCandidates.length > 1 &&
          window.__tonyLavoroPersonDisambRole === 'caposquadra') {
        return buildPersonDisambiguationMessage(
          window.__tonyLavoroPersonDisambCandidates,
          'caposquadra',
          window.__tonyLavoroPersonDisambStemHint || ''
        );
      }
      return 'A quale caposquadra assegno il lavoro?';
    }
    if (assignMode === 'autonomo' && requiredEmpty.indexOf('lavoro-operaio') >= 0) {
      if (window.__tonyLavoroPersonDisambCandidates && window.__tonyLavoroPersonDisambCandidates.length > 1) {
        return buildPersonDisambiguationMessage(
          window.__tonyLavoroPersonDisambCandidates,
          window.__tonyLavoroPersonDisambRole || 'operaio',
          window.__tonyLavoroPersonDisambStemHint || ''
        );
      }
      return 'A chi lo assegno?';
    }
    if (requiredEmpty.indexOf('lavoro-terreno') >= 0) {
      if (window.__tonyLavoroTerrenoDisambCandidates && window.__tonyLavoroTerrenoDisambCandidates.length > 1) {
        return buildTerrenoDisambiguationMessage(
          window.__tonyLavoroTerrenoDisambCandidates,
          window.__tonyLavoroTerrenoDisambStemHint || ''
        );
      }
      return 'Su quale terreno?';
    }
    if (!lavoroTipoIsChosen() && requiredEmpty.indexOf('lavoro-tipo-lavoro') >= 0) {
      var terrElMsg = document.getElementById('lavoro-terreno');
      var terrValMsg = terrElMsg && terrElMsg.value ? String(terrElMsg.value).trim() : '';
      if (terrValMsg) {
        var pendingTipo = window.__tonyLavoroPendingTipoHint || '';
        if (pendingTipo) {
          var proactiveTipo = offerTipoLavoroDisambIfNeeded(pendingTipo, terrValMsg, { preferList: true });
          if (proactiveTipo) return proactiveTipo;
        }
      }
      return 'Che tipo di lavoro devo impostare?';
    }
    var order = ['lavoro-nome', 'lavoro-data-inizio', 'lavoro-durata'];
    for (var i = 0; i < order.length; i++) {
      var fid = order[i];
      if (requiredEmpty.indexOf(fid) >= 0) {
        if (fid === 'lavoro-nome') return 'Come vuoi chiamare questo lavoro?';
        if (fid === 'lavoro-data-inizio') return 'Quando vuoi iniziare?';
        if (fid === 'lavoro-durata') return 'Per quanti giorni dura il lavoro?';
      }
    }
    if (needsMacchine) {
      return 'Quale trattore vuoi usare per questo lavoro?';
    }
    return 'Ok, dimmi il prossimo dato mancante.';
  }

  function userCanReplyToLavoroInterview(userText, opts) {
    opts = opts || {};
    var modal = document.getElementById('lavoro-modal');
    if (!modal || !modal.classList.contains('active')) return false;
    if (window.__tonyAwaitingLavoroSaveConfirm) return false;
    if (typeof isLavoroTipoCorrectionText === 'function' && isLavoroTipoCorrectionText(userText)) {
      return true;
    }
    if (isLavoroTerrenoCorrectionText(userText)) return true;
    if (!opts.skipMacchineCheck &&
        typeof userCanReplyToMacchineDisamb === 'function' && userCanReplyToMacchineDisamb(userText)) return false;
    if (window.__tonyLavoroTipoDisambCandidates && window.__tonyLavoroTipoDisambCandidates.length > 1 &&
        isLavoroTipoDisambQualifierText(userText)) return true;
    if (window.__tonyLavoroPersonDisambCandidates && window.__tonyLavoroPersonDisambCandidates.length > 1 &&
        isPersonDisambQualifierText(userText)) return true;
    if (window.__tonyLavoroTerrenoDisambCandidates && window.__tonyLavoroTerrenoDisambCandidates.length > 1 &&
        isTerrenoDisambQualifierText(userText)) return true;
    if (window.__tonyLavoroAwaitingTipoModo && parseTipoModoFromText(userText)) return true;
    if (lavoroInterviewNeedsAssignModeQuestion() &&
        (parseAssignModeFromText(userText) || findPersonInInterviewText(userText))) return true;
    var assignModeReply = getConfirmedLavoroInterviewAssignMode();
    if (assignModeReply === 'squadra' && lavoroInterviewFieldEmpty('lavoro-caposquadra')) {
      var capReply = String(userText || '').trim();
      if (capReply.length >= 2 && capReply.length <= 40 && !parseAssignModeFromText(capReply) &&
          !mentionsLavoroTipoKeyword(capReply) && !extractLavoroInterviewDate(capReply) &&
          extractLavoroInterviewDuration(capReply) == null) {
        return true;
      }
    }
    if (assignModeReply === 'autonomo' && lavoroInterviewFieldEmpty('lavoro-operaio')) {
      var opReply = String(userText || '').trim();
      if (opReply.length >= 2 && opReply.length <= 40 && !parseAssignModeFromText(opReply) &&
          !mentionsLavoroTipoKeyword(opReply) && !extractLavoroInterviewDate(opReply) &&
          extractLavoroInterviewDuration(opReply) == null) {
        return true;
      }
    }
    if (lavoroInterviewFieldEmpty('lavoro-terreno')) {
      var terreniList = (window.lavoriState && window.lavoriState.terreniList) || [];
      var trHitReply = findTerrenoInInterviewText(userText, terreniList);
      if (isTerrenoInterviewUniqueHit(trHitReply)) return true;
      if (trHitReply && trHitReply.ambiguous) return true;
    }
    var req = getLavoroInterviewRequiredEmpty();
    var needsMac = lavoroInterviewNeedsMacchineOnly();
    if (!req.length && !needsMac && !lavoroInterviewNeedsAssignModeQuestion()) {
      window.__tonyLavoroInterviewPending = false;
      return false;
    }
    if (lavoroInterviewFieldEmpty('lavoro-durata') && /^\d{1,3}$/.test(String(userText || '').trim())) return true;
    if (lavoroInterviewFieldEmpty('lavoro-data-inizio') && extractLavoroInterviewDate(userText)) return true;
    if (lavoroInterviewFieldEmpty('lavoro-durata') && extractLavoroInterviewDuration(userText) != null) return true;
    var patch = buildLavoroInterviewPatch(userText);
    if (Object.keys(patch).length > 0) return true;
    if (getLavoroTipoDomText() && lavoroInterviewFieldEmpty('lavoro-nome')) {
      var t = String(userText || '').trim();
      if (t && t.length <= 60 && t.split(/\s+/).length <= 6) return true;
    }
    if (mentionsLavoroTipoKeyword(userText) && !lavoroInterviewFieldEmpty('lavoro-terreno') &&
        findTipoLavoroCandidatesInInterviewText(userText, '').length > 1) {
      return true;
    }
    return false;
  }

  async function applyLavoroInterviewFromUserReply(userText) {
    var out = { handled: false, readyForSave: false, message: '', voiceText: '', field: '' };
    var text = String(userText || '').trim();
    var patch = {};
    var terrenoHintPre = (document.getElementById('lavoro-terreno') && document.getElementById('lavoro-terreno').value) || '';
    var tipoPickFromDisamb = false;
    var tipoPickFromModo = false;
    var tipoPickMeta = function () {
      return { fromDisamb: tipoPickFromDisamb, fromTipoModo: tipoPickFromModo };
    };

    if (window.__tonyLavoroAwaitingTipoModo && !lavoroTipoIsChosen()) {
      var modoReply = parseTipoModoFromText(text);
      if (modoReply) {
        window.__tonyLavoroAwaitingTipoModo = false;
        window.__tonyLavoroTipoModo = modoReply;
        var stemPool = window.__tonyLavoroTipoStemCandidates || [];
        var filteredModo = filterTipoCandidatesByModo(stemPool, modoReply);
        if (filteredModo.length === 1) {
          patch['lavoro-tipo-lavoro'] = filteredModo[0].nome || filteredModo[0];
          tipoPickFromModo = true;
          window.__tonyLavoroTipoStemCandidates = null;
        } else if (filteredModo.length > 1) {
          window.__tonyLavoroTipoDisambCandidates = filteredModo.map(function (t) { return t.nome || t; });
          window.__tonyLavoroTipoStemCandidates = filteredModo;
          out.handled = true;
          out.message = buildTipoLavoroDisambiguationMessage(filteredModo, window.__tonyLavoroPendingTipoHint || text, modoReply);
          out.voiceText = out.message;
          window.__tonyLavoroInterviewPending = true;
          window.__tonyLastLavoroInterviewQuestion = out.message;
          return out;
        } else {
          out.handled = true;
          out.message = 'Non ho trovato varianti ' + modoReply + ' per questo lavoro. Ripeti manuale o meccanica.';
          out.voiceText = out.message;
          window.__tonyLavoroAwaitingTipoModo = true;
          return out;
        }
      } else {
        out.handled = true;
        out.message = 'Non ho capito. Rispondi manuale o meccanica.';
        out.voiceText = out.message;
        window.__tonyLavoroInterviewPending = true;
        return out;
      }
    }

    var disambNames = window.__tonyLavoroTipoDisambCandidates;
    if (disambNames && disambNames.length > 1) {
      var fromDisamb = resolveTipoLavoroFromDisambReply(text, disambNames, terrenoHintPre);
      if (fromDisamb) {
        patch['lavoro-tipo-lavoro'] = fromDisamb;
        tipoPickFromDisamb = true;
        window.__tonyLavoroTipoDisambCandidates = null;
      } else if (isLavoroTipoDisambQualifierText(text)) {
        out.handled = true;
        out.message = buildTipoLavoroDisambiguationMessage(disambNames.map(function (n) { return { nome: n }; }), text);
        out.voiceText = out.message;
        window.__tonyLavoroInterviewPending = true;
        window.__tonyLastLavoroInterviewQuestion = out.message;
        return out;
      }
    }

    var personDisamb = window.__tonyLavoroPersonDisambCandidates;
    var personDisambRole = window.__tonyLavoroPersonDisambRole;
    if (personDisamb && personDisamb.length > 1) {
      var fromPersonDisamb = resolvePersonFromDisambReply(text, personDisamb, personDisambRole);
      if (fromPersonDisamb) {
        clearLavoroPersonDisamb();
        setLavoroInterviewConfirmedAssignMode(personDisambRole === 'caposquadra' ? 'squadra' : 'autonomo');
        if (personDisambRole === 'caposquadra') {
          patch['tipo-assegnazione'] = 'squadra';
          patch['lavoro-caposquadra'] = fromPersonDisamb.id || fromPersonDisamb.label;
        } else {
          patch['tipo-assegnazione'] = 'autonomo';
          patch['lavoro-operaio'] = fromPersonDisamb.id || fromPersonDisamb.label;
          if (lavoroInterviewFieldEmpty('lavoro-operatore-macchina')) {
            patch['lavoro-operatore-macchina'] = patch['lavoro-operaio'];
          }
        }
        patch['lavoro-stato'] = 'assegnato';
        if (window.__tonyLavoroPendingCreationText) {
          mergeLavoroInterviewPatchFromPending(
            patch,
            buildLavoroInterviewPatch(window.__tonyLavoroPendingCreationText)
          );
        }
      } else if (isPersonDisambQualifierText(text)) {
        out.handled = true;
        out.message = buildPersonDisambiguationMessage(
          personDisamb,
          personDisambRole,
          window.__tonyLavoroPersonDisambStemHint || lavoroInterviewDisambStemHint(text, 'person')
        );
        out.voiceText = out.message;
        window.__tonyLavoroInterviewPending = true;
        window.__tonyLastLavoroInterviewQuestion = out.message;
        return out;
      }
    }

    var terrenoDisamb = window.__tonyLavoroTerrenoDisambCandidates;
    if (terrenoDisamb && terrenoDisamb.length > 1) {
      var fromTerrenoDisamb = resolveTerrenoFromDisambReply(text, terrenoDisamb);
      if (fromTerrenoDisamb) {
        clearLavoroTerrenoDisamb();
        patch['lavoro-terreno'] = fromTerrenoDisamb.id || fromTerrenoDisamb.label;
      } else if (isTerrenoDisambQualifierText(text)) {
        out.handled = true;
        out.message = buildTerrenoDisambiguationMessage(
          terrenoDisamb,
          window.__tonyLavoroTerrenoDisambStemHint || lavoroInterviewDisambStemHint(text, 'terreno')
        );
        out.voiceText = out.message;
        window.__tonyLavoroInterviewPending = true;
        window.__tonyLastLavoroInterviewQuestion = out.message;
        return out;
      }
    }

    if (!Object.keys(patch).length) {
      patch = buildLavoroInterviewPatch(text);
    }

    var askPersonDisambAfterInject = lavoroInterviewPersonDisambPending() &&
      !patchResolvesLavoroInterviewPerson(patch);
    if (askPersonDisambAfterInject) {
      patch = stripAssigneeFieldsFromLavoroPatch(patch);
    } else if (lavoroInterviewPersonDisambPending() && !patchResolvesLavoroInterviewPerson(patch)) {
      out.handled = true;
      out.message = buildLavoroPersonDisambPendingMessage(text);
      out.voiceText = out.message;
      window.__tonyLavoroInterviewPending = true;
      window.__tonyLastLavoroInterviewQuestion = out.message;
      return out;
    }

    if (!Object.keys(patch).length && window.__tonyLavoroTerrenoDisambCandidates &&
        window.__tonyLavoroTerrenoDisambCandidates.length > 1) {
      out.handled = true;
      out.message = buildTerrenoDisambiguationMessage(
        window.__tonyLavoroTerrenoDisambCandidates,
        window.__tonyLavoroTerrenoDisambStemHint || lavoroInterviewDisambStemHint(text, 'terreno')
      );
      out.voiceText = out.message;
      window.__tonyLavoroInterviewPending = true;
      window.__tonyLastLavoroInterviewQuestion = out.message;
      return out;
    }

    var terrForTipoDisamb = terrenoHintPre || patch['lavoro-terreno'] || '';
    if (!patch['lavoro-tipo-lavoro'] && !lavoroTipoIsChosen() &&
        (mentionsLavoroTipoKeyword(text) || window.__tonyLavoroPendingTipoHint) &&
        String(terrForTipoDisamb).trim()) {
      var disambTipoMsg = offerTipoLavoroDisambIfNeeded(text, terrForTipoDisamb, { preferList: true });
      if (disambTipoMsg) {
        out.handled = true;
        out.message = disambTipoMsg;
        out.voiceText = disambTipoMsg;
        window.__tonyLavoroInterviewPending = true;
        window.__tonyLastLavoroInterviewQuestion = disambTipoMsg;
        if (mentionsLavoroTipoKeyword(text)) window.__tonyLavoroPendingTipoHint = text;
        return out;
      }
    }

    if (!Object.keys(patch).length && mentionsLavoroTipoKeyword(text) && !lavoroInterviewFieldEmpty('lavoro-terreno')) {
      var ambiguous = findTipoLavoroCandidatesInInterviewText(text, terrenoHintPre);
      if (ambiguous.length > 1) {
        out.handled = true;
        out.message = buildTipoLavoroDisambiguationMessage(ambiguous, text);
        out.voiceText = out.message;
        window.__tonyLavoroTipoDisambCandidates = ambiguous.map(function (t) { return t.nome; });
        window.__tonyLavoroInterviewPending = true;
        window.__tonyLastLavoroInterviewQuestion = out.message;
        return out;
      }
    }
    if (!Object.keys(patch).length && mentionsLavoroTipoKeyword(text) && lavoroInterviewFieldEmpty('lavoro-terreno')) {
      out.handled = true;
      out.message = 'Prima dimmi su quale terreno, così scelgo Generale o Tra le File in base alla coltura.';
      out.voiceText = 'Su quale terreno?';
      window.__tonyLavoroInterviewPending = true;
      return out;
    }
    if (!Object.keys(patch).length && mentionsLavoroTipoKeyword(text) && !lavoroInterviewFieldEmpty('lavoro-terreno')) {
      var queryTipo = lavoroTipoQueryFromText(text);
      var candsUnmatched = findTipoLavoroCandidatesInInterviewText(queryTipo, terrenoHintPre);
      if (!candsUnmatched.length && queryTipo !== text) {
        candsUnmatched = findTipoLavoroCandidatesInInterviewText(text, terrenoHintPre);
      }
      if (!candsUnmatched.length) {
        out.handled = true;
        var hintTxt = String(normalizeLavoroTipoUserText(text) || text).trim();
        out.message = 'Non riconosco «' + hintTxt + '» tra i tipi disponibili. ' +
          'Prova con il nome esatto (es. trinciatura, erpicatura, potatura) o aggiungi manuale/meccanica.';
        out.voiceText = 'Non ho trovato quel tipo di lavoro. Riprova con il nome esatto.';
        window.__tonyLavoroInterviewPending = true;
        return out;
      }
    }
    if (!Object.keys(patch).length) {
      var assignModeMiss = getConfirmedLavoroInterviewAssignMode();
      var roleHintMiss = assignModeMiss === 'squadra' ? 'squadra' : (assignModeMiss === 'autonomo' ? 'autonomo' : null);
      var personDisambMsg = tryPersonDisambFromText(text, roleHintMiss);
      if (personDisambMsg) {
        out.handled = true;
        out.message = personDisambMsg;
        out.voiceText = personDisambMsg;
        window.__tonyLastLavoroInterviewQuestion = personDisambMsg;
        return out;
      }
      if (lavoroInterviewFieldEmpty('lavoro-terreno')) {
        var terrenoDisambMsg = tryTerrenoDisambFromText(text);
        if (terrenoDisambMsg) {
          out.handled = true;
          out.message = terrenoDisambMsg;
          out.voiceText = terrenoDisambMsg;
          window.__tonyLastLavoroInterviewQuestion = terrenoDisambMsg;
          return out;
        }
      }
      if (lavoroInterviewNeedsAssignModeQuestion() && String(text || '').trim().length >= 2) {
        out.handled = true;
        out.message = 'Non ho riconosciuto «' + String(text).trim() + '». ' +
          'Dimmi se è un lavoro di squadra o per una persona, oppure nome e cognome come in elenco.';
        out.voiceText = 'Dimmi squadra o autonomo, oppure il nome completo.';
        window.__tonyLavoroInterviewPending = true;
        return out;
      }
      if (assignModeMiss === 'squadra' && lavoroInterviewFieldEmpty('lavoro-caposquadra') &&
          String(text || '').trim().length >= 2) {
        out.handled = true;
        out.message = 'Non ho trovato «' + String(text).trim() + '» tra i caposquadra. Ripeti nome e cognome come in elenco.';
        out.voiceText = 'Non ho trovato quel caposquadra. Ripeti il nome come in elenco.';
        window.__tonyLavoroInterviewPending = true;
        return out;
      }
      if (assignModeMiss === 'autonomo' && lavoroInterviewFieldEmpty('lavoro-operaio') &&
          String(text || '').trim().length >= 2) {
        out.handled = true;
        out.message = 'Non ho trovato «' + String(text).trim() + '» tra gli operai. Ripeti nome e cognome come in elenco.';
        out.voiceText = 'Non ho trovato quell\'operaio. Ripeti il nome come in elenco.';
        window.__tonyLavoroInterviewPending = true;
        return out;
      }
      return out;
    }

    if (!window.lavoriState || !window.lavoriState.terreniList) {
      await waitForLavoriFormDataReady(8000);
    }
    await waitForLavoriManodoperaReady(8000);
    if (!patchResolvesLavoroInterviewPerson(patch) && !askPersonDisambAfterInject) {
      patch = applyLavoroAssigneeFromTextToPatch(patch, text);
    }

    out.handled = true;
    var context = (window.Tony && window.Tony.context) || {};
    var mapConfig = {
      formId: 'lavoro-form',
      modalId: 'lavoro-modal',
      injectionOrder: INJECTION_ORDER_LAVORO,
      delays: DELAYS_LAVORO,
      resolver: resolveValueLavoro
    };

    if (patch['lavoro-trattore'] === '' || patch['lavoro-attrezzo'] === '') {
      window.__tonyMacchineDisambAskedAt = 0;
      window.__tonyLastMacchineDisambField = null;
      window.__tonyPendingLavoroTrattoreDisamb = false;
    }

    var ok = true;
    if (Object.keys(patch).length) {
      var injectOptsIv = {
        patchOnly: true,
        interviewPatch: true,
        formReadyMaxMs: 4000,
        selectWaitMs: 5000
      };
      if (isLavoroTerrenoCorrectionText(text) && patch['lavoro-terreno']) {
        injectOptsIv.forceFields = {
          'lavoro-terreno': true,
          'lavoro-sottocategoria': true,
          'lavoro-categoria-principale': true,
          'lavoro-tipo-lavoro': true
        };
      }
      if (isLavoroInterviewSimplePatch(patch)) {
        ok = await injectLavoroInterviewSimplePatch(patch, context);
      } else {
        ok = await injectLavoroForm(patch, context, injectOptsIv);
      }
    }
    if (!ok) {
      out.handled = false;
      return out;
    }
    if (patch['lavoro-tipo-lavoro']) {
      window.__tonyLavoroTipoDisambCandidates = null;
      window.__tonyLavoroPendingTipoHint = '';
      window.__tonyLavoroAwaitingTipoModo = false;
      window.__tonyLavoroTipoStemCandidates = null;
      window.__tonyLavoroTipoModo = null;
    }
    if (patch['lavoro-operaio'] || patch['lavoro-caposquadra']) {
      clearLavoroPersonDisamb();
    }
    if (patch['lavoro-terreno']) {
      clearLavoroTerrenoDisamb();
    }
    log('applyLavoroInterviewFromUserReply: patch ' + Object.keys(patch).join(', '));

    if (patch['lavoro-tipo-lavoro'] && !getLavoroTipoDomText()) {
      await delay(120);
    }

    if (askPersonDisambAfterInject) {
      window.__tonyLavoroInterviewPending = true;
      out.message = buildLavoroPersonDisambPendingMessage(
        window.__tonyLavoroPendingCreationText || text
      );
      out.voiceText = out.message;
      window.__tonyLastLavoroInterviewQuestion = out.message;
      return out;
    }

    var reqAfter = getLavoroInterviewRequiredEmpty();
    var needsMacAfter = lavoroInterviewCanAskMacchine();

    if (lavoroInterviewNeedsAssignModeQuestion()) {
      window.__tonyLavoroInterviewPending = true;
      out.message = buildNextLavoroInterviewMessage(reqAfter, false);
      out.message = prependLavoroTipoStemOnlyAck(out.message, text, patch, tipoPickMeta());
      window.__tonyLastLavoroInterviewQuestion = out.message;
      out.voiceText = out.message;
      return out;
    }

    if (reqAfter.length) {
      window.__tonyLavoroInterviewPending = true;
      out.message = buildNextLavoroInterviewMessage(reqAfter, needsMacAfter);
      if (out.message === window.__tonyLastLavoroInterviewQuestion) {
        if (reqAfter.indexOf('lavoro-tipo-lavoro') >= 0) {
          var terrRetry = (document.getElementById('lavoro-terreno') && document.getElementById('lavoro-terreno').value) || '';
          var hintRetry = mentionsLavoroTipoKeyword(text) ? text : (window.__tonyLavoroPendingTipoHint || text);
          var disambRetry = offerTipoLavoroDisambIfNeeded(hintRetry, terrRetry, { preferList: true });
          if (disambRetry) {
            out.message = disambRetry;
          } else {
            out.message = 'Non ho ancora registrato il tipo di lavoro. Ripeti con il nome esatto (es. potatura di produzione).';
          }
        } else {
          out.message = 'Non ho ancora registrato il dato. Ripeti con più dettaglio.';
        }
      }
      out.message = prependLavoroTipoStemOnlyAck(out.message, text, patch, tipoPickMeta());
      window.__tonyLastLavoroInterviewQuestion = out.message;
      out.voiceText = out.message;
      noteLavoroInterviewMacchineQuestion(out.message, needsMacAfter);
      return out;
    }

    if (needsMacAfter) {
      var fdMacEnd = buildFormDataFromLavoroDom();
      if (!fdMacEnd['lavoro-terreno']) {
        var terrElEnd = document.getElementById('lavoro-terreno');
        if (terrElEnd && String(terrElEnd.value || '').trim()) {
          fdMacEnd['lavoro-terreno'] = String(terrElEnd.value).trim();
        }
      }
      var macStEnd = await resolveLavoroMacchineFromState(fdMacEnd, mapConfig, context);
      if (macStEnd.asked) {
        var recentDisambEnd = window.__tonyMacchineDisambAskedAt && Date.now() - window.__tonyMacchineDisambAskedAt < 5000;
        if (!recentDisambEnd) {
          out.message = prependLavoroTipoStemOnlyAck(
            buildNextLavoroInterviewMessage([], true),
            text,
            patch,
            tipoPickMeta()
          );
          out.voiceText = out.message || 'Quale trattore vuoi usare?';
        }
        window.__tonyLavoroInterviewPending = true;
        window.__tonyLastLavoroInterviewQuestion = out.message || 'trattore';
        noteLavoroInterviewMacchineQuestion(out.message, true);
        return out;
      }
    }

    if (lavoroInterviewReadyForSave()) {
      window.__tonyLavoroInterviewPending = false;
      window.__tonyLavoroPendingCreationText = '';
      out.readyForSave = true;
      out.message = 'Ok, ho compilato il lavoro.';
      out.voiceText = 'Lavoro compilato.';
      return out;
    }

    autoFillLavoroNomeIfMissing();
    syncLavoroOperatoreMacchinaIfNeeded();
    if (lavoroInterviewReadyForSave()) {
      window.__tonyLavoroInterviewPending = false;
      window.__tonyLavoroPendingCreationText = '';
      out.readyForSave = true;
      out.message = 'Ok, ho compilato il lavoro.';
      out.voiceText = 'Lavoro compilato.';
      return out;
    }

    if (lavoroInterviewFieldEmpty('lavoro-terreno')) {
      window.__tonyLavoroInterviewPending = true;
      if (window.__tonyLavoroTerrenoDisambCandidates && window.__tonyLavoroTerrenoDisambCandidates.length > 1) {
        out.message = buildTerrenoDisambiguationMessage(
          window.__tonyLavoroTerrenoDisambCandidates,
          window.__tonyLavoroTerrenoDisambStemHint || ''
        );
      } else {
        out.message = 'Su quale terreno?';
      }
      out.voiceText = out.message;
      window.__tonyLastLavoroInterviewQuestion = out.message;
      return out;
    }
    if (!lavoroTipoIsChosen()) {
      window.__tonyLavoroInterviewPending = true;
      out.message = 'Che tipo di lavoro devo impostare?';
      out.voiceText = out.message;
      window.__tonyLastLavoroInterviewQuestion = out.message;
      return out;
    }

    window.__tonyLavoroInterviewPending = true;
    out.message = buildNextLavoroInterviewMessage([], needsMacAfter);
    window.__tonyLastLavoroInterviewQuestion = out.message;
    out.voiceText = out.message;
    noteLavoroInterviewMacchineQuestion(out.message, needsMacAfter);
    return out;
  }

  /**
   * Turno unificato intervista + macchine durante __tonyLavoroCreationFlow.
   * @returns {Promise<{handled: boolean, readyForSave: boolean, message: string, voiceText: string, field: string}>}
   */
  async function applyLavoroCreationTurn(userText) {
    var text = String(userText || '').trim();
    if (!text) return { handled: false, readyForSave: false, message: '', voiceText: '', field: '' };
    if (lavoroInterviewNeedsScheduleFields()) {
      return applyLavoroInterviewFromUserReply(text);
    }
    if (lavoroInterviewCanAskMacchine()) {
      var trList = trattoriListForMacchineDisambReply();
      var atList = attrezziListForMacchineDisambReply();
      var looksMac = (lavoroSelectIsEmpty('lavoro-trattore') && findTrattoreInUserText(text, trList)) ||
        (!lavoroSelectIsEmpty('lavoro-trattore') && lavoroSelectIsEmpty('lavoro-attrezzo') &&
          findAttrezzoInUserText(text, atList));
      if (looksMac || userCanReplyToMacchineDisamb(text)) {
        if (looksMac && lavoroSelectIsEmpty('lavoro-trattore')) {
          markLavoroInterviewMacchineAsked('lavoro-trattore');
        } else if (looksMac) {
          markLavoroInterviewMacchineAsked('lavoro-attrezzo');
        }
        var macRes = await applyLavoroMacchineFromUserReply(text);
        if (macRes && macRes.handled) return macRes;
      }
    }
    return applyLavoroInterviewFromUserReply(text);
  }

  /**
   * Domanda proattiva intervista lavoro — client-side (no CF).
   * @returns {Promise<{asked: boolean, message: string}>}
   */
  async function promptLavoroInterviewMissing() {
    if (lavoroInterviewNeedsAssignModeQuestion()) {
      window.__tonyLavoroInterviewPending = true;
      var msgAssign = buildNextLavoroInterviewMessage([], false);
      window.__tonyLastLavoroInterviewQuestion = msgAssign;
      return { asked: true, message: msgAssign };
    }
    var req = getLavoroInterviewRequiredEmpty();
    var needsMac = lavoroInterviewCanAskMacchine();
    if (!req.length && !needsMac) {
      window.__tonyLavoroInterviewPending = false;
      return { asked: false, message: '' };
    }
    if (req.length) {
      window.__tonyLavoroInterviewPending = true;
      var msgReq = buildNextLavoroInterviewMessage(req, needsMac);
      window.__tonyLastLavoroInterviewQuestion = msgReq;
      return { asked: true, message: msgReq };
    }
    if (needsMac && typeof promptLavoroMacchineMissing === 'function') {
      var fd = buildFormDataFromLavoroDom();
      var macRes = await promptLavoroMacchineMissing(fd, (window.Tony && window.Tony.context) || {});
      if (macRes && macRes.asked) {
        window.__tonyLavoroInterviewPending = true;
        return { asked: true, message: '' };
      }
    }
    window.__tonyLavoroInterviewPending = true;
    var msgTail = buildNextLavoroInterviewMessage(req, needsMac);
    window.__tonyLastLavoroInterviewQuestion = msgTail;
    return { asked: true, message: msgTail };
  }

  function extractFormDataFromText(responseText) {
    if (!responseText || typeof responseText !== 'string') return null;
    var match = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (!match) return null;
    try {
      var parsed = JSON.parse(match[1].trim());
      var cleanedText = responseText.replace(/```(?:json)?\s*[\s\S]*?```/g, '').trim() || (parsed.replyText || '');
      return {
        cleanedText: cleanedText,
        formData: parsed.formData || null,
        action: parsed.action || '',
        replyText: parsed.replyText || cleanedText
      };
    } catch (e) {
      return null;
    }
  }

  async function extractAndInjectFromResponse(responseText, context, formCtx) {
    var out = { cleanedText: responseText || '', injected: false };
    var extracted = extractFormDataFromText(responseText);
    if (!extracted || !extracted.formData || Object.keys(extracted.formData).length === 0) {
      return out;
    }
    out.cleanedText = extracted.cleanedText || extracted.replyText || responseText;
    context = context || (window.Tony && window.Tony.context) || {};
    var fd = extracted.formData;
    var looksLavoroModal = fd && Object.keys(fd).some(function (k) {
      return k === 'lavoro-tipo-lavoro' || k === 'lavoro-nome' || k === 'tipo-assegnazione';
    });
    var usePreventivoForm = !!(formCtx && formCtx.formId === 'preventivo-form');
    if (!usePreventivoForm && fd && !looksLavoroModal) {
      var hasCliente = fd['cliente-id'] != null && String(fd['cliente-id']).trim() !== '';
      if (hasCliente && (fd['tipo-lavoro'] || fd['coltura-categoria'] || fd['coltura'] || fd['terreno-id'])) {
        usePreventivoForm = true;
      }
    }
    var useLavoroForm = false;
    if (!usePreventivoForm) {
      if (formCtx && (formCtx.formId === 'lavoro-form' || formCtx.modalId === 'lavoro-modal')) {
        useLavoroForm = true;
      } else if (fd) {
        useLavoroForm = Object.keys(fd).some(function (k) {
          return k.indexOf('lavoro-') === 0 || k === 'tipo-assegnazione';
        });
      }
    }
    var useOraForm = false;
    if (fd && Object.keys(fd).some(function (k) { return k.indexOf('ora-') === 0; })) {
      if (formCtx && formCtx.formId === 'ora-form') useOraForm = true;
      else if (!usePreventivoForm && !useLavoroForm) {
        useOraForm = true;
      }
    }
    try {
      if (usePreventivoForm) {
        out.injected = await injectPreventivoForm(extracted.formData, context);
      } else if (useLavoroForm) {
        out.injected = await injectLavoroForm(extracted.formData, context);
      } else if (useOraForm) {
        out.injected = await injectSegnaOraForm(extracted.formData, context);
      } else {
        out.injected = await injectAttivitaForm(extracted.formData, context);
      }
      if (out.injected) log('Estrazione e iniezione da risposta completata');
    } catch (e) {
      console.warn('[TonyFormInjector] extractAndInject fallito:', e);
    }
    return out;
  }

  global.TonyFormInjector = {
    injectForm: injectForm,
    injectAttivitaForm: injectAttivitaForm,
    injectLavoroForm: injectLavoroForm,
    waitForLavoriFormDataReady: waitForLavoriFormDataReady,
    waitForLavoriManodoperaReady: waitForLavoriManodoperaReady,
    isLavoriFormDataReady: isLavoriFormDataReady,
    sanitizeAmbiguousLavoroInterviewFields: sanitizeAmbiguousLavoroInterviewFields,
    stripLavoroCreationIntentPrefix: stripLavoroCreationIntentPrefix,
    lavoroInterviewDisambStemHint: lavoroInterviewDisambStemHint,
    promptLavoroMacchineMissing: promptLavoroMacchineMissing,
    userCanReplyToMacchineDisamb: userCanReplyToMacchineDisamb,
    applyLavoroMacchineFromUserReply: applyLavoroMacchineFromUserReply,
    findTrattoreInUserText: findTrattoreInUserText,
    findAttrezzoInUserText: findAttrezzoInUserText,
    shouldAskAttrezzoDisambigFromTipo: shouldAskAttrezzoDisambigFromTipo,
    attrezziCompatibiliConTrattoreCv: attrezziCompatibiliConTrattoreCv,
    userCanReplyToLavoroInterview: userCanReplyToLavoroInterview,
    applyLavoroInterviewFromUserReply: applyLavoroInterviewFromUserReply,
    applyLavoroCreationTurn: applyLavoroCreationTurn,
    buildLavoroInterviewPatch: buildLavoroInterviewPatch,
    promptLavoroInterviewMissing: promptLavoroInterviewMissing,
    resetLavoroInterviewSessionState: resetLavoroInterviewSessionState,
    isLavoroTipoCorrectionText: isLavoroTipoCorrectionText,
    isLavoroTerrenoCorrectionText: isLavoroTerrenoCorrectionText,
    mentionsLavoroTipoKeyword: mentionsLavoroTipoKeyword,
    userTextShouldGoToLavoroInterviewNotMacchine: userTextShouldGoToLavoroInterviewNotMacchine,
    lavoroInterviewReadyForSave: lavoroInterviewReadyForSave,
    lavoroInterviewCanAskMacchine: lavoroInterviewCanAskMacchine,
    syncLavoroOperatoreMacchinaIfNeeded: syncLavoroOperatoreMacchinaIfNeeded,
    getAmbiguousTipoLavoroCandidates: getAmbiguousTipoLavoroCandidates,
    buildTipoLavoroDisambiguationMessage: buildTipoLavoroDisambiguationMessage,
    isLavoroTipoStemOnlyText: isLavoroTipoStemOnlyText,
    buildLavoroTipoStemOnlyAckMessage: buildLavoroTipoStemOnlyAckMessage,
    shouldAckLavoroTipoStemOnlyAutoPick: shouldAckLavoroTipoStemOnlyAutoPick,
    prependLavoroTipoStemOnlyAck: prependLavoroTipoStemOnlyAck,
    parseTipoModoFromText: parseTipoModoFromText,
    classifyTipoLavoroModo: classifyTipoLavoroModo,
    lavoroTipoStemNeedsManualMechChoice: lavoroTipoStemNeedsManualMechChoice,
    buildTipoModoQuestion: buildTipoModoQuestion,
    findPersonInListInterviewText: findPersonInListInterviewText,
    findPersonInInterviewText: findPersonInInterviewText,
    buildPersonDisambiguationMessage: buildPersonDisambiguationMessage,
    resolvePersonFromDisambReply: resolvePersonFromDisambReply,
    isPersonDisambQualifierText: isPersonDisambQualifierText,
    offerPersonDisambResponse: offerPersonDisambResponse,
    findTerrenoInInterviewText: findTerrenoInInterviewText,
    isTerrenoInterviewUniqueHit: isTerrenoInterviewUniqueHit,
    buildTerrenoDisambiguationMessage: buildTerrenoDisambiguationMessage,
    resolveTerrenoFromDisambReply: resolveTerrenoFromDisambReply,
    isTerrenoDisambQualifierText: isTerrenoDisambQualifierText,
    offerTerrenoDisambResponse: offerTerrenoDisambResponse,
    injectPreventivoForm: injectPreventivoForm,
    applyPreventivoTerrenoFromUserReply: applyPreventivoTerrenoFromUserReply,
    applyPreventivoScheduleFromUserReply: applyPreventivoScheduleFromUserReply,
    injectTerrenoForm: injectTerrenoForm,
    injectProdottoForm: injectProdottoForm,
    resolveValueTerreno: resolveValueTerreno,
    injectTrattamentoCampoForm: injectTrattamentoCampoForm,
    suggestTrattamentoCondizioniMeteo: suggestTrattamentoCondizioniMeteo,
    injectMovimentoForm: injectMovimentoForm,
    injectZonaSegmentoForm: injectZonaSegmentoForm,
    injectSegnaOraForm: injectSegnaOraForm,
    injectFieldWorkspaceQuickHoursForm: injectFieldWorkspaceQuickHoursForm,
    resolveQuickHoursTargetWindow: function (injectOpts) {
      return resolveQuickHoursTargetWindow(injectOpts || {});
    },
    resolveValueMagazzino: resolveValueMagazzino,
    applyBusinessRules: applyBusinessRules,
    extractFormDataFromText: extractFormDataFromText,
    extractAndInjectFromResponse: extractAndInjectFromResponse,
    INJECTION_ORDER_ATTIVITA: INJECTION_ORDER_ATTIVITA,
    INJECTION_ORDER_LAVORO: INJECTION_ORDER_LAVORO,
    INJECTION_ORDER_PREVENTIVO: INJECTION_ORDER_PREVENTIVO,
    DELAYS_ATTIVITA: DELAYS_ATTIVITA,
    DELAYS_LAVORO: DELAYS_LAVORO,
    DELAYS_PREVENTIVO: DELAYS_PREVENTIVO
  };
  if (typeof global !== 'undefined') {
    global.__tonySuggestTrattamentoCondizioniMeteo = suggestTrattamentoCondizioniMeteo;
  }
})(typeof window !== 'undefined' ? window : globalThis);
