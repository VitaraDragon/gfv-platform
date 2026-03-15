/**
 * Tony Form Injector - Universal Injection Engine
 * Motore di iniezione basato su mappe di configurazione.
 * Supporta SELECT, RADIO, TEXT, NUMBER, DATE, TIME, TEXTAREA.
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
    'lavoro-trattore': 350,
    'tipo-assegnazione': 200
  };

  function delay(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /** Attende che un select abbia opzioni (max 3s). Per attivita-sottocategoria dopo categoria. */
  function waitForSelectOptions(selectId, minOptions) {
    minOptions = minOptions || 2;
    var el = document.getElementById(selectId);
    if (!el || el.tagName !== 'SELECT') return Promise.resolve();
    if (el.options.length >= minOptions) return Promise.resolve();
    return new Promise(function (resolve) {
      var start = Date.now();
      var iv = setInterval(function () {
        if (el.options.length >= minOptions || Date.now() - start > 3000) {
          clearInterval(iv);
          resolve();
        }
      }, 80);
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
      return n && (n.indexOf(search) >= 0 || search.indexOf(n) >= 0);
    });
    if (matches.length === 0) return rawValue;
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

  function resolveValueLavoro(fieldId, value, context) {
    if (value === undefined || value === null || value === '') return value;
    switch (fieldId) {
      case 'lavoro-categoria-principale':
      case 'lavoro-sottocategoria': return resolveCategoriaLavori(value);
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
    if (matches.length > 1 && formData && formData['lavoro-terreno']) {
      var terrenoVal = String(formData['lavoro-terreno'] || '').trim();
      var terrenoNome = terrenoVal.toLowerCase();
      // Risolvi terreno per ID (la CF/injector può passare l'id del select) oppure per nome
      var terreno = terreniList.find(function (t) { return (t.id || '') === terrenoVal; });
      if (!terreno) {
        terreno = terreniList.find(function (t) {
          var n = (t.nome || '').toLowerCase();
          return n === terrenoNome || n.indexOf(terrenoNome) >= 0 || terrenoNome.indexOf(n) >= 0;
        });
      }
      var colturaCat = (terreno && (terreno.coltura_categoria || terreno.coltura)) ? String(terreno.coltura_categoria || terreno.coltura).toLowerCase() : '';
      var hasFilari = /vite|vigneto|frutteto|olivo|arboreo|alberi/.test(colturaCat);
      var preferTraLeFile = hasFilari;
      job = matches.find(function (t) {
        var n = (t.nome || '').toLowerCase();
        if (preferTraLeFile) return n.indexOf('tra le file') >= 0 || n.indexOf('sulla fila') >= 0;
        return n.indexOf('tra le file') < 0 && n.indexOf('sulla fila') < 0;
      }) || matches[0];
    } else {
      job = matches.length > 0
        ? matches.sort(function (a, b) {
            var lenA = (a.nome || '').length;
            var lenB = (b.nome || '').length;
            return lenB - lenA;
          })[0]
        : null;
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
    } else if ((fieldId === 'attivita-tipo-lavoro-gerarchico' || fieldId === 'lavoro-tipo-lavoro') && valStr && !/^[a-zA-Z0-9_-]{15,}$/.test(valStr)) {
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
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    if (typeof window.jQuery === 'function') {
      try { window.jQuery(el).trigger('change').trigger('input'); } catch (_) {}
    }
    log('Iniettato campo SELECT ' + fieldId + ' = "' + resolved + '"');
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
   * Imposta valore su TEXT/NUMBER/DATE/TIME/TEXTAREA: value + input
   */
  function setInputValue(el, value, fieldId) {
    if (!el) return false;
    var tag = (el.tagName || '').toUpperCase();
    var type = (el.type || '').toLowerCase();
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') return false;
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
   * @returns {Promise<boolean>}
   */
  async function injectForm(formData, mapConfig, context) {
    if (!formData || typeof formData !== 'object') {
      log('injectForm: formData vuoto o non valido');
      return false;
    }
    if (!mapConfig || !Array.isArray(mapConfig.injectionOrder)) {
      log('injectForm: mapConfig.injectionOrder mancante');
      return false;
    }

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

      if (fieldId === 'attivita-sottocategoria') {
        await waitForSelectOptions('attivita-sottocategoria', 2);
      }
      if (fieldId === 'lavoro-sottocategoria') {
        var subGroup = document.getElementById('lavoro-sottocategoria-group');
        if (subGroup) subGroup.style.display = 'block';
        await waitForSelectOptions('lavoro-sottocategoria', 2);
      }
      if (fieldId === 'lavoro-tipo-lavoro') {
        var tipoGroup = document.getElementById('tipo-lavoro-group');
        if (tipoGroup) tipoGroup.style.display = 'block';
        await waitForSelectOptions('lavoro-tipo-lavoro', 2);
      }
      if (fieldId === 'lavoro-operaio' || fieldId === 'lavoro-caposquadra') {
        await waitForSelectOptions(fieldId, 2);
      }
      setFieldValue(fieldId, value, mapConfig, context);

      var ms = delays[fieldId];
      if (ms && ms > 0) {
        log('Attesa ' + ms + 'ms dopo ' + fieldId + ' (dropdown dipendenti)...');
        await delay(ms);
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
    if (macEl && macEl.value && attEl && !attEl.value && tipoLavoroValue) {
      var tn = (tipoLavoroValue || '').toLowerCase();
      var search = tn.indexOf('erpicatura') >= 0 ? 'erpice' : tn.indexOf('trinciatura') >= 0 ? 'trincia' : tn.indexOf('fresatura') >= 0 ? 'fresa' : tn.indexOf('ripasso') >= 0 ? 'ripasso' : '';
      if (search && attEl.options && attEl.options.length > 1) {
        var opt = Array.from(attEl.options).find(function (o) { return o.value && (o.text || '').toLowerCase().indexOf(search) >= 0; });
        if (opt) {
          attEl.value = opt.value;
          attEl.dispatchEvent(new Event('change', { bubbles: true }));
          log('Attrezzo inferito da tipo lavoro: ' + (opt.text || opt.value));
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
            // Vigneto/frutteto: lavorazione meccanica deve essere "Tra le File", non "Generale"
            var terrenoVal = String(formData['lavoro-terreno'] || '').trim();
            var terreniList = (window.lavoriState && window.lavoriState.terreniList) || (context && context.lavori && context.lavori.terreni) || [];
            var terreno = terreniList.find(function (t) { return (t.id || '') === terrenoVal; });
            if (!terreno) terreno = terreniList.find(function (t) { var n = (t.nome || '').toLowerCase(); return n === terrenoVal.toLowerCase() || (terrenoVal && n.indexOf(terrenoVal.toLowerCase()) >= 0); });
            var colturaCat = (terreno && (terreno.coltura_categoria || terreno.coltura)) ? String(terreno.coltura_categoria || terreno.coltura).toLowerCase() : '';
            if (/vite|vigneto|frutteto|olivo|arboreo|alberi/.test(colturaCat)) {
              formData['lavoro-sottocategoria'] = 'Tra le File';
              log('Sottocategoria Generale ignorata: terreno ha filari (vigneto/frutteto) → Tra le File');
            }
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

    // Inferenza attrezzo da tipo: se lavoro-trattore è impostato e lavoro-attrezzo vuoto, e tipo è meccanico,
    // cerca nel dropdown attrezzi (già filtrato per compatibilità trattore) l'attrezzo corrispondente al tipo.
    // Se PIÙ attrezzi compatibili (es. Erpice 2mt, Erpice 3mt) → NON inferire: Tony deve chiedere all'utente.
    if (ok && formData['lavoro-trattore'] && !formData['lavoro-attrezzo']) {
      var tipoNome = (formData['lavoro-tipo-lavoro'] || '').toLowerCase();
      var searchAttrezzo = tipoNome.indexOf('pre-potatur') >= 0 || tipoNome.indexOf('potatur') >= 0 && tipoNome.indexOf('meccanic') >= 0 ? 'potatric' : tipoNome.indexOf('trinciatur') >= 0 ? 'trincia' : tipoNome.indexOf('erpicatur') >= 0 ? 'erpice' : tipoNome.indexOf('fresatur') >= 0 ? 'fresa' : tipoNome.indexOf('vangatur') >= 0 ? 'vanga' : '';
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
            log('Attrezzi compatibili multipli (' + matches.length + '), non inferisco: Tony deve chiedere (es. Erpice 2mt o Erpice 3mt?)');
          }
        }
      }
    }

    // Second pass: se lavoro-terreno era presente, il suo change handler può aver ricaricato
    // il dropdown tipo-lavoro e azzerato la selezione. Re-inietta lavoro-tipo-lavoro dopo
    // un delay per dare tempo a loadTipiLavoro di completare (600ms per ricaricamento asincrono).
    if (ok && formData['lavoro-tipo-lavoro'] && formData['lavoro-terreno']) {
      await delay(600);
      var select = document.getElementById('lavoro-tipo-lavoro');
      if (select && !select.value) {
        var resolved = resolveValueLavoro('lavoro-tipo-lavoro', formData['lavoro-tipo-lavoro'], context);
        if (resolved) {
          setFieldValue('lavoro-tipo-lavoro', resolved, mapConfig, context);
          log('Second pass: re-iniettato lavoro-tipo-lavoro dopo cambio terreno');
        }
      }
    }
    return ok;
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
    var useLavoroForm = false;
    if (formCtx && (formCtx.formId === 'lavoro-form' || formCtx.modalId === 'lavoro-modal')) {
      useLavoroForm = true;
    } else {
      var fd = extracted.formData;
      useLavoroForm = Object.keys(fd || {}).some(function(k) {
        return k.indexOf('lavoro-') === 0 || k === 'tipo-assegnazione';
      });
    }
    try {
      if (useLavoroForm) {
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
    applyBusinessRules: applyBusinessRules,
    extractFormDataFromText: extractFormDataFromText,
    extractAndInjectFromResponse: extractAndInjectFromResponse,
    INJECTION_ORDER_ATTIVITA: INJECTION_ORDER_ATTIVITA,
    INJECTION_ORDER_LAVORO: INJECTION_ORDER_LAVORO,
    DELAYS_ATTIVITA: DELAYS_ATTIVITA,
    DELAYS_LAVORO: DELAYS_LAVORO
  };
})(typeof window !== 'undefined' ? window : globalThis);
