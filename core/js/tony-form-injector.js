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
    'lavoro-terreno': 500,
    'lavoro-categoria-principale': 350,
    'lavoro-sottocategoria': 350,
    'lavoro-trattore': 450,
    'tipo-assegnazione': 200
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
    return /vite|vigneto|frutteto|olivo|oliveto|arboreo|alberi|albicocc|pesc|cilieg|susin|prugn|pero|melo|kaki|mandorl|nocciol|noce|kiwi|melograno|castagn|pistac|fico|nespol|giuggiol|gelso/.test(blob);
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

  var __tonyMacchineDisambGuard = { k: '', t: 0 };
  function postTonyMacchineDisambiguation(payload) {
    try {
      var msg = payload && payload.message;
      if (!msg || typeof msg !== 'string') return;
      var sig = String(payload.formId || '') + '|' + String(payload.field || '') + '|' + msg.slice(0, 160);
      var now = Date.now();
      if (__tonyMacchineDisambGuard.k === sig && now - __tonyMacchineDisambGuard.t < 2500) return;
      __tonyMacchineDisambGuard = { k: sig, t: now };
      window.dispatchEvent(new CustomEvent('tony-macchine-disambiguation', { detail: payload }));
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
    if (exact && exact.nome) return exact.nome;
    var matches = list.filter(function (t) {
      var n = (t.nome || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!n) return false;
      if (n.indexOf(search) >= 0) return true;
      /** Evita match spuri su nomi corti (es. "e" in "trinciatura") */
      if (n.length >= 3 && search.indexOf(n) >= 0) return true;
      return false;
    });
    if (matches.length === 0) return rawValue;

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
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var nomeCompleto = ((item.nome || '') + ' ' + (item.cognome || '')).trim() || (item.email || '');
      var n = nomeCompleto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (n === search || (n && (n.indexOf(search) >= 0 || search.indexOf(n) >= 0))) {
        return item.id || null;
      }
    }
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
    return byName && byName.id ? byName.id : rawValue;
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
    el.value = resolved;
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

    context = context || (window.Tony && window.Tony.context) || {};
    var formId = mapConfig.formId || mapConfig.modalId || 'unknown';
    var delays = mapConfig.delays || {};
    var injectionOrder = mapConfig.injectionOrder;

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

      if (fieldId === 'attivita-sottocategoria') {
        await waitForSelectOptions('attivita-sottocategoria', 2);
      }
      if (fieldId === 'lavoro-sottocategoria') {
        var subGroup = document.getElementById('lavoro-sottocategoria-group');
        if (subGroup) subGroup.style.display = 'block';
        await waitForSelectOptions('lavoro-sottocategoria', 2);
        var rawSubLav = formData[fieldId];
        var rawSubStrLav = rawSubLav != null ? String(rawSubLav).trim() : '';
        if (rawSubStrLav && looksLikeFirestoreDocId(rawSubStrLav)) {
          await waitForSelectOptionValue('lavoro-sottocategoria', rawSubStrLav, 12000);
        }
      }
      if (fieldId === 'lavoro-tipo-lavoro') {
        var tipoGroup = document.getElementById('tipo-lavoro-group');
        if (tipoGroup) tipoGroup.style.display = 'block';
        await waitForSelectOptions('lavoro-tipo-lavoro', 2);
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
        await waitForSelectOptions('lavoro-trattore', 2, 12000);
        var rawTrInj = formData[fieldId];
        var rawTrStrInj = rawTrInj != null ? String(rawTrInj).trim() : '';
        if (rawTrStrInj && looksLikeFirestoreDocId(rawTrStrInj)) {
          await waitForSelectOptionValue('lavoro-trattore', rawTrStrInj, 12000);
        }
      }
      if (formId === 'lavoro-form' && fieldId === 'lavoro-attrezzo') {
        var trElForAtt = document.getElementById('lavoro-trattore');
        if (trElForAtt && trElForAtt.value) {
          trElForAtt.dispatchEvent(new Event('change', { bubbles: true }));
          await delay(100);
        }
        var rawAtInj = formData[fieldId];
        var rawAtStrInj = rawAtInj != null ? String(rawAtInj).trim() : '';
        if (rawAtStrInj && looksLikeFirestoreDocId(rawAtStrInj)) {
          await waitForSelectOptionValue('lavoro-attrezzo', rawAtStrInj, 12000);
        } else {
          await waitForSelectOptionsWithValue('lavoro-attrezzo', 1, 12000);
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

      if (formId === 'preventivo-form' && fieldId === 'coltura-categoria') {
        if (typeof window.updateColtureDropdownPreventivo === 'function') {
          window.updateColtureDropdownPreventivo();
        }
        await delay(280);
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
  async function injectLavoroForm(formData, context) {
    if (!formData || typeof formData !== 'object') return false;
    context = context || (window.Tony && window.Tony.context) || {};

    applyAssignmentIntelligence(formData);

    ensureTrattamentiDefaultsForLavoroForm(formData);
    applyLavorazioneDefaultsLavoro(formData, context);

    var tipoNome = formData['lavoro-tipo-lavoro'];
    if (tipoNome) {
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

    var mapConfig = {
      formId: 'lavoro-form',
      modalId: 'lavoro-modal',
      injectionOrder: INJECTION_ORDER_LAVORO,
      delays: DELAYS_LAVORO,
      resolver: resolveValueLavoro
    };

    var ok = await injectForm(formData, mapConfig, context);

    if (ok && inferRequiresMachineFromTipo(formData['lavoro-tipo-lavoro'] || '')) {
      await delay(350);
      var trEl0 = document.getElementById('lavoro-trattore');
      if (trEl0 && trEl0.tagName === 'SELECT' && (!trEl0.value || String(trEl0.value).trim() === '')) {
        var trListCv = (window.lavoriState && window.lavoriState.trattoriList) || [];
        var atListCv = (window.lavoriState && window.lavoriState.attrezziList) || [];
        var attKnown = resolveAttrezzoFromState(formData['lavoro-attrezzo'], atListCv);
        var candidatiTr = attKnown ? trattoriCompatibiliCv(macchineListSoloTrattori(trListCv), attKnown) : null;
        if (candidatiTr != null) {
          if (candidatiTr.length === 1) {
            formData['lavoro-trattore'] = String((candidatiTr[0].nome || candidatiTr[0].id || '')).trim();
            setFieldValue('lavoro-trattore', formData['lavoro-trattore'], mapConfig, context);
            var trElCv = document.getElementById('lavoro-trattore');
            if (trElCv && trElCv.value) {
              trElCv.dispatchEvent(new Event('change', { bubbles: true }));
            }
            log('Lavoro: trattore unico compatibile (CV) con attrezzo noto → impostato');
            await delay(400);
          } else if (candidatiTr.length > 1) {
            var minCvL = attKnown.cavalliMinimiRichiesti;
            var minStrL = (minCvL != null && minCvL !== '' && Number(minCvL) > 0) ? String(minCvL) : '';
            var labCvL = labelsFromTrattoriRecords(candidatiTr, 8);
            postTonyMacchineDisambiguation({
              message: 'Con l’**attrezzo** indicato ci sono più **trattori** compatibili' +
                (minStrL ? ' (richiesti almeno **' + minStrL + '** CV)' : '') + ': ' + labCvL.join(', ') +
                (candidatiTr.length > 8 ? '…' : '') +
                '.\n\nQuale trattore **vuoi usare** per questo lavoro? (nome come in elenco) così compilo **lavoro-trattore**.',
              voiceText: 'Ci sono più trattori compatibili. Quale vuoi usare?',
              formId: 'lavoro-form',
              field: 'lavoro-trattore'
            });
          } else {
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
          }
        } else {
          var trOpts0 = Array.from(trEl0.options || []).filter(function (o) { return o.value; });
          if (trOpts0.length === 1) {
            trEl0.value = trOpts0[0].value;
            trEl0.dispatchEvent(new Event('change', { bubbles: true }));
            formData['lavoro-trattore'] = String((trOpts0[0].text || trOpts0[0].value || '')).trim();
            log('Lavoro: trattore unico in elenco → impostato automaticamente');
          } else if (trOpts0.length > 1) {
            var labTr0 = elencoOptionLabels(trOpts0, 8);
            postTonyMacchineDisambiguation({
              message: 'Ci sono più **trattori** disponibili: ' + labTr0.join(', ') + (trOpts0.length > 8 ? '…' : '') +
                '.\n\nQuale **vuoi usare** per questo lavoro? (nome come in elenco) così compilo **lavoro-trattore**; poi scegliamo l’attrezzo se serve.',
              voiceText: 'Ci sono più trattori. Quale vuoi usare?',
              formId: 'lavoro-form',
              field: 'lavoro-trattore'
            });
          }
        }
      }
    }

    // Inferenza attrezzo da tipo: se lavoro-trattore è impostato e lavoro-attrezzo vuoto, e tipo è meccanico,
    // cerca nel dropdown attrezzi (già filtrato per compatibilità trattore) l'attrezzo corrispondente al tipo.
    // Se PIÙ attrezzi compatibili → messaggio in chat: Tony chiede quale opzione iniettare.
    var trElDom = document.getElementById('lavoro-trattore');
    var trattoreNomeEff = formData['lavoro-trattore'] || (trElDom && trElDom.selectedOptions[0] ? (trElDom.selectedOptions[0].text || trElDom.value) : '');
    if (ok && String(trattoreNomeEff || '').trim() !== '' && !formData['lavoro-attrezzo']) {
      var tipoNomeLow = (formData['lavoro-tipo-lavoro'] || '').toLowerCase();
      var searchAttrezzo = keywordAttrezzoFromTipoNomeLower(tipoNomeLow);
      if (searchAttrezzo) {
        await delay(400);
        var attEl = document.getElementById('lavoro-attrezzo');
        if (attEl && attEl.tagName === 'SELECT' && attEl.options && attEl.options.length > 1) {
          var matches = Array.from(attEl.options).filter(function (o) {
            return o.value && (o.text || '').toLowerCase().indexOf(searchAttrezzo) >= 0;
          });
          if (matches.length === 1) {
            var opt = matches[0];
            attEl.value = opt.value;
            attEl.dispatchEvent(new Event('change', { bubbles: true }));
            log('Inferito attrezzo da tipo lavoro (unico match): ' + (opt.text || opt.value));
          } else if (matches.length > 1) {
            var labM = elencoOptionLabels(matches, 8);
            var tipoVis = String(formData['lavoro-tipo-lavoro'] || '').trim() || 'questa lavorazione';
            postTonyMacchineDisambiguation({
              message: 'Per **' + tipoVis + '** ci sono più **attrezzi** compatibili: ' + labM.join(', ') +
                (matches.length > 8 ? '…' : '') + '.\n\nIndica quale usare (nome esatto) così compilo **lavoro-attrezzo**.',
              voiceText: 'Ci sono più attrezzi compatibili. Quale vuoi usare?',
              formId: 'lavoro-form',
              field: 'lavoro-attrezzo'
            });
          }
        }
      }
    }

    // Second pass: il change su terreno può ricaricare dropdown e azzerare tipo/sottocategoria.
    if (ok && formData['lavoro-terreno']) {
      await delay(600);
      ensureTrattamentiDefaultsForLavoroForm(formData);
      var tipoSel = document.getElementById('lavoro-tipo-lavoro');
      var subSel = document.getElementById('lavoro-sottocategoria');
      if (tipoSel && (!tipoSel.value || String(tipoSel.value).trim() === '') && formData['lavoro-tipo-lavoro']) {
        var resolvedTipo = resolveValueLavoro('lavoro-tipo-lavoro', formData['lavoro-tipo-lavoro'], context);
        if (resolvedTipo) {
          setFieldValue('lavoro-tipo-lavoro', resolvedTipo, mapConfig, context);
          log('Second pass: re-iniettato lavoro-tipo-lavoro dopo cambio terreno');
        }
      }
      if (subSel && (!subSel.value || String(subSel.value).trim() === '') && formData['lavoro-sottocategoria']) {
        var resolvedSub = resolveValueLavoro('lavoro-sottocategoria', formData['lavoro-sottocategoria'], context);
        if (resolvedSub) {
          setFieldValue('lavoro-sottocategoria', resolvedSub, mapConfig, context);
          log('Second pass: re-iniettato lavoro-sottocategoria dopo cambio terreno');
        }
      }
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
    return injectForm(formData, mapConfig, context);
  }

  /**
   * Form completamento trattamento/concimazione in campo (`#form-trattamento`, pagine vigneto/frutteto).
   * Richiede `window.__tonyTrattamentoCampoApi` esposto dalla pagina (renderProdotti + getProdottiAnagrafica).
   */
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
    return ok;
  }

  /**
   * Form movimento magazzino.
   */
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
    var mapConfig = {
      formId: 'movimento-form',
      injectionOrder: tonyMapping.injectionOrder,
      fields: tonyMapping.fields || {},
      resolver: resolveValueMagazzino
    };
    return injectForm(formData, mapConfig, context);
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
      var tipoNome = fd['tipo-lavoro'];
      var preMapCliente = { formId: 'preventivo-form', resolver: resolveValuePreventivo };
      var skipClienteInLoop = false;
      /** Cliente + terreno insieme: sempre pre-sync (non solo se c'è tipo-lavoro), come atomicità Gestione Lavori su terreno→tipo */
      var terrenoHint = fd['terreno-id'];
      var hasTerrenoHint = terrenoHint != null && String(terrenoHint).trim() !== '';
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
        setFieldValue('tipo-lavoro', reT, mapConfig, context);
      }
      return ok;
    } finally {
      window.lavoriState = savedLavori;
    }
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
    try {
      if (usePreventivoForm) {
        out.injected = await injectPreventivoForm(extracted.formData, context);
      } else if (useLavoroForm) {
        out.injected = await injectLavoroForm(extracted.formData, context);
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
    injectPreventivoForm: injectPreventivoForm,
    injectProdottoForm: injectProdottoForm,
    injectTrattamentoCampoForm: injectTrattamentoCampoForm,
    injectMovimentoForm: injectMovimentoForm,
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
})(typeof window !== 'undefined' ? window : globalThis);
