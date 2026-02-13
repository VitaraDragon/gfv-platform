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
    'attivita-terreno': 200,
    'attivita-macchina': 350,
    'attivita-tipo-lavoro-gerarchico': 150,
    '_secondPass_tipo_lavoro': 350
  };

  const INJECTION_ORDER_LAVORO = [
    'lavoro-nome',
    'lavoro-categoria-principale',
    'lavoro-sottocategoria',
    'lavoro-tipo-lavoro',
    'lavoro-terreno',
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
    'lavoro-categoria-principale': 250,
    'lavoro-sottocategoria': 250,
    'lavoro-terreno': 200,
    'lavoro-trattore': 350
  };

  function delay(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
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
      case 'attivita-tipo-lavoro-gerarchico': return value;
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
      case 'lavoro-tipo-lavoro': return resolveFromLavoriState(value, 'tipiLavoroList', 'nome');
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
    if (opts.some(function (o) { return o.value === value; })) {
      resolved = value;
    } else if (opts.some(function (o) { return (o.text || '').toLowerCase() === String(value).toLowerCase(); })) {
      var opt = opts.find(function (o) { return (o.text || '').toLowerCase() === String(value).toLowerCase(); });
      resolved = opt ? opt.value : value;
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
   * Preferisce il match PIÙ SPECIFICO (nome più lungo) per evitare che
   * "Trinciatura tra le file" matchi "Trinciatura" (che ha sottocat Generale).
   */
  function deriveCategoriaFromTipo(tipoNome, context) {
    var tipi = (context && context.attivita && context.attivita.tipi_lavoro) || (window.attivitaState && window.attivitaState.tipiLavoroList) || [];
    var mainCats = (context && context.attivita && context.attivita.categorie_lavoro) || (window.attivitaState && window.attivitaState.categorieLavoriPrincipali) || [];
    var subMap = (window.attivitaState && window.attivitaState.sottocategorieLavoriMap) || null;
    var search = (tipoNome || '').toLowerCase().trim();
    if (!search || !tipi.length) return null;
    var matches = tipi.filter(function (t) {
      var n = (t.nome || '').toLowerCase();
      return n === search || n.indexOf(search) >= 0 || search.indexOf(n) >= 0;
    });
    var job = matches.length > 0
      ? matches.sort(function (a, b) {
          var lenA = (a.nome || '').length;
          var lenB = (b.nome || '').length;
          return lenB - lenA;
        })[0]
      : null;
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

    var hasMacchina = !!(formData['attivita-macchina'] || formData['attivita-attrezzo']);
    var oreMac = formData['attivita-ore-macchina'];
    var oreMacNum = oreMac !== undefined && oreMac !== null && oreMac !== '' ? parseFloat(oreMac) : NaN;
    if (hasMacchina && (isNaN(oreMacNum) || oreMacNum <= 0)) {
      var calc = calcOreNetteFromStrings(formData['attivita-orario-inizio'], formData['attivita-orario-fine'], formData['attivita-pause']);
      if (calc != null && calc > 0) {
        formData['attivita-ore-macchina'] = calc.toFixed(2);
        log('Auto-compilato attivita-ore-macchina = ' + formData['attivita-ore-macchina'] + ' da orari e pause');
      }
    }

    var tipoNome = formData['attivita-tipo-lavoro-gerarchico'];
    if (tipoNome) {
      var derived = deriveCategoriaFromTipo(tipoNome, context);
      if (derived) {
        if (!formData['attivita-categoria-principale']) {
          formData['attivita-categoria-principale'] = derived.categoriaNome;
        }
        var existingSub = (formData['attivita-sottocategoria'] || '').toString().trim();
        var explicitSubOk = existingSub === 'Tra le File' || existingSub === 'Sulla Fila';
        if (derived.sottocategoriaNome && !(explicitSubOk && derived.sottocategoriaNome === 'Generale')) {
          formData['attivita-sottocategoria'] = derived.sottocategoriaNome;
          log('Derivata sottocategoria da tipo lavoro: ' + derived.sottocategoriaNome);
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
        oreMacEl.value = calc.toFixed(2);
        if (oreMacEl.dispatchEvent) oreMacEl.dispatchEvent(new Event('input', { bubbles: true }));
        log('Ore macchina auto-compilate da orari: ' + oreMacEl.value);
      }
    }

    log('injectAttivitaForm completato');
    return true;
  }

  /**
   * Inietta form lavoro (gestione-lavori).
   * @param {Object} formData - { 'lavoro-nome': '...', 'tipo-assegnazione': 'autonomo', ... }
   * @param {Object} context - contesto Tony
   * @returns {Promise<boolean>}
   */
  async function injectLavoroForm(formData, context) {
    if (!formData || typeof formData !== 'object') return false;
    context = context || (window.Tony && window.Tony.context) || {};

    var mapConfig = {
      formId: 'lavoro-form',
      modalId: 'lavoro-modal',
      injectionOrder: INJECTION_ORDER_LAVORO,
      delays: DELAYS_LAVORO,
      resolver: resolveValueLavoro
    };

    return injectForm(formData, mapConfig, context);
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

  async function extractAndInjectFromResponse(responseText, context) {
    var out = { cleanedText: responseText || '', injected: false };
    var extracted = extractFormDataFromText(responseText);
    if (!extracted || !extracted.formData || Object.keys(extracted.formData).length === 0) {
      return out;
    }
    out.cleanedText = extracted.cleanedText || extracted.replyText || responseText;
    try {
      out.injected = await injectAttivitaForm(extracted.formData, context);
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
