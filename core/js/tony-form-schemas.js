/**
 * Catalogo schemi form per Tony Operativo.
 * Ogni schema descrive i campi critici del modal e la save guard.
 */
(function() {
    'use strict';

    function normalizeText(value) {
        return String(value || '')
            .toLowerCase()
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function resolveByNameFromList(rawValue, list, nameKey) {
        if (!rawValue || !Array.isArray(list)) return null;
        var search = normalizeText(rawValue);
        if (!search) return null;
        var key = nameKey || 'nome';

        var exact = list.find(function(item) {
            return normalizeText(item && item[key]) === search;
        });
        if (exact && exact.id) return exact.id;

        var partial = list.find(function(item) {
            var name = normalizeText(item && item[key]);
            return name && (name.indexOf(search) !== -1 || search.indexOf(name) !== -1);
        });
        return partial && partial.id ? partial.id : null;
    }

    function resolveTipoLavoroAttivita(rawValue, context) {
        var value = String(rawValue || '').trim();
        if (!value) return null;

        var list = [];
        if (window.attivitaState && Array.isArray(window.attivitaState.tipiLavoroList)) {
            list = window.attivitaState.tipiLavoroList;
        } else if (context && context.attivita && Array.isArray(context.attivita.tipi_lavoro)) {
            list = context.attivita.tipi_lavoro;
        }

        var resolvedFromName = resolveByNameFromList(value, list, 'nome');
        if (resolvedFromName) return resolvedFromName;

        var aliasMap = (context && context.attivita && context.attivita.verbi_alias) || {};
        var normalizedValue = normalizeText(value);
        var aliasKey = Object.keys(aliasMap).find(function(k) {
            var nk = normalizeText(k);
            return nk === normalizedValue || normalizedValue.indexOf(nk) !== -1 || nk.indexOf(normalizedValue) !== -1;
        });

        if (aliasKey) {
            var aliasTarget = aliasMap[aliasKey];
            return resolveByNameFromList(aliasTarget, list, 'nome');
        }

        return null;
    }

    function resolveTerrenoAttivita(rawValue, context) {
        var list = [];
        if (window.attivitaState && Array.isArray(window.attivitaState.terreniList)) {
            list = window.attivitaState.terreniList;
        } else if (context && context.attivita && Array.isArray(context.attivita.terreni)) {
            list = context.attivita.terreni;
        }
        return resolveByNameFromList(rawValue, list, 'nome');
    }

    function resolveFromLavoriState(rawValue, stateKey, nameKey) {
        if (!window.lavoriState) return null;
        var list = window.lavoriState[stateKey];
        return resolveByNameFromList(rawValue, list, nameKey || 'nome');
    }

    function resolveCategoriaLavori(rawValue) {
        if (!window.lavoriState) return null;
        var principali = Array.isArray(window.lavoriState.categorieLavoriPrincipali)
            ? window.lavoriState.categorieLavoriPrincipali
            : [];
        var sottocategorie = [];
        var map = window.lavoriState.sottocategorieLavoriMap;
        if (map && typeof map.forEach === 'function') {
            map.forEach(function(items) {
                if (Array.isArray(items)) sottocategorie = sottocategorie.concat(items);
            });
        }
        return resolveByNameFromList(rawValue, principali.concat(sottocategorie), 'nome');
    }

    function baseSaveGuard(state) {
        return state.missingVisibleRequired.length === 0 && state.submitAvailable;
    }

    var schemas = {
        'attivita-modal': {
            modalId: 'attivita-modal',
            submitSelector: 'button[type="submit"], .btn-primary, .btn-save',
            fields: [
                { id: 'attivita-data', type: 'date', required: true },
                {
                    id: 'attivita-terreno',
                    type: 'select',
                    required: true,
                    resolver: function(value, _fieldDef, context) {
                        return resolveTerrenoAttivita(value, context);
                    }
                },
                { id: 'attivita-categoria-principale', type: 'select', required: true },
                {
                    id: 'attivita-tipo-lavoro-gerarchico',
                    type: 'select',
                    required: true,
                    dependsOn: ['attivita-categoria-principale'],
                    resolver: function(value, _fieldDef, context) {
                        return resolveTipoLavoroAttivita(value, context);
                    }
                },
                {
                    id: 'attivita-sottocategoria',
                    type: 'select',
                    required: false,
                    dependsOn: ['attivita-categoria-principale', 'attivita-tipo-lavoro-gerarchico'],
                    visibleWhen: function(state) {
                        var categoria = state && state.values ? state.values['attivita-categoria-principale'] : '';
                        return !!categoria;
                    }
                },
                { id: 'attivita-orario-inizio', type: 'time', required: true },
                { id: 'attivita-orario-fine', type: 'time', required: false },
                { id: 'attivita-pause', type: 'number', required: true },
                {
                    id: 'attivita-macchina',
                    type: 'select',
                    required: false,
                    resolver: function(value, _fieldDef, context) {
                        var list = (window.attivitaState && window.attivitaState.macchineList) || (context && context.attivita && context.attivita.macchine) || [];
                        var trattori = list.filter(function(m) { return m.tipoMacchina === 'trattore' && (m.stato !== 'dismesso'); });
                        return resolveByNameFromList(value, trattori, 'nome');
                    }
                },
                {
                    id: 'attivita-attrezzo',
                    type: 'select',
                    required: false,
                    resolver: function(value, _fieldDef, context) {
                        var list = (window.attivitaState && window.attivitaState.macchineList) || (context && context.attivita && context.attivita.macchine) || [];
                        var attrezzi = list.filter(function(m) { return m.tipoMacchina === 'attrezzo' && m.stato !== 'dismesso'; });
                        return resolveByNameFromList(value, attrezzi, 'nome');
                    }
                },
                {
                    id: 'attivita-cliente',
                    type: 'select',
                    required: function(state) {
                        var section = state && state.modal ? state.modal.querySelector('#attivita-conto-terzi-section') : null;
                        if (!section) return false;
                        var style = window.getComputedStyle(section);
                        return style.display !== 'none' && style.visibility !== 'hidden';
                    }
                },
                {
                    id: 'attivita-lavoro',
                    type: 'select',
                    required: function(state) {
                        var section = state && state.modal ? state.modal.querySelector('#attivita-conto-terzi-section') : null;
                        if (!section) return false;
                        var style = window.getComputedStyle(section);
                        return style.display !== 'none' && style.visibility !== 'hidden';
                    },
                    resolver: function(value, _fieldDef, context) {
                        var lavori = context && context.attivita ? context.attivita.lavori : null;
                        return resolveByNameFromList(value, lavori, 'nome');
                    }
                }
            ],
            saveGuard: baseSaveGuard
        },
        'ora-modal': {
            modalId: 'ora-modal',
            submitSelector: 'button[type="submit"], .btn-primary, .btn-save',
            fields: [
                {
                    id: 'ora-lavoro',
                    type: 'select',
                    required: true,
                    resolver: function(value, _fieldDef, context) {
                        var lavori = context && context.ore ? context.ore.lavori : null;
                        return resolveByNameFromList(value, lavori, 'nome');
                    }
                },
                { id: 'ora-data', type: 'date', required: true },
                { id: 'ora-inizio', type: 'time', required: true },
                { id: 'ora-fine', type: 'time', required: true },
                { id: 'ora-pause', type: 'number', required: false },
                {
                    id: 'ora-macchina',
                    type: 'select',
                    required: false,
                    visibleWhen: function(state) {
                        var section = state && state.modal ? state.modal.querySelector('#macchine-sezione') : null;
                        if (!section) return false;
                        var style = window.getComputedStyle(section);
                        return style.display !== 'none' && style.visibility !== 'hidden';
                    }
                }
            ],
            saveGuard: baseSaveGuard
        },
        'lavoro-modal': {
            modalId: 'lavoro-modal',
            submitSelector: 'button[type="submit"], .btn-primary, .btn-save',
            fields: [
                { id: 'lavoro-nome', type: 'text', required: true },
                {
                    id: 'lavoro-categoria-principale',
                    type: 'select',
                    required: true,
                    resolver: function(value) {
                        return resolveCategoriaLavori(value);
                    }
                },
                {
                    id: 'lavoro-sottocategoria',
                    type: 'select',
                    required: false,
                    dependsOn: ['lavoro-categoria-principale'],
                    resolver: function(value) {
                        return resolveCategoriaLavori(value);
                    },
                    visibleWhen: function(state) {
                        var group = state && state.modal ? state.modal.querySelector('#lavoro-sottocategoria-group') : null;
                        if (!group) return false;
                        var style = window.getComputedStyle(group);
                        return style.display !== 'none' && style.visibility !== 'hidden';
                    }
                },
                {
                    id: 'lavoro-tipo-lavoro',
                    type: 'select',
                    required: true,
                    dependsOn: ['lavoro-categoria-principale', 'lavoro-sottocategoria'],
                    deriveParentsFromChild: function(value) {
                        var list = window.lavoriState && window.lavoriState.tipiLavoroList;
                        if (!Array.isArray(list)) return {};
                        var search = normalizeText(value);
                        if (!search) return {};
                        var item = list.find(function(t) {
                            var n = normalizeText(t && t.nome);
                            return n && (n === search || n.indexOf(search) !== -1 || search.indexOf(n) !== -1);
                        });
                        if (!item) return {};
                        var out = { 'lavoro-categoria-principale': item.categoriaId || null };
                        if (item.sottocategoriaId) out['lavoro-sottocategoria'] = item.sottocategoriaId;
                        return out;
                    },
                    resolver: function(value) {
                        return resolveFromLavoriState(value, 'tipiLavoroList', 'nome');
                    },
                    visibleWhen: function(state) {
                        var group = state && state.modal ? state.modal.querySelector('#tipo-lavoro-group') : null;
                        if (!group) return true;
                        var style = window.getComputedStyle(group);
                        return style.display !== 'none' && style.visibility !== 'hidden';
                    }
                },
                {
                    id: 'lavoro-terreno',
                    type: 'select',
                    required: true,
                    resolver: function(value) {
                        return resolveFromLavoriState(value, 'terreniList', 'nome');
                    }
                },
                {
                    id: 'lavoro-pianificazione-impianto',
                    type: 'select',
                    required: false,
                    visibleWhen: function(state) {
                        var group = state && state.modal ? state.modal.querySelector('#pianificazione-impianto-group') : null;
                        if (!group) return false;
                        var style = window.getComputedStyle(group);
                        return style.display !== 'none' && style.visibility !== 'hidden';
                    }
                }
            ],
            saveGuard: baseSaveGuard
        }
    };

    window.TONY_FORM_SCHEMAS = schemas;
})();

