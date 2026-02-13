/**
 * Tony Smart Form Filler
 * Modulo centralizzato per la compilazione intelligente dei form.
 * Gestisce dipendenze gerarchiche (es. Categoria -> Tipo Lavoro) e preselezione automatica.
 * 
 * Utilizzo:
 * const filler = new SmartFormFiller();
 * filler.fillField('attivita-tipo-lavoro-gerarchico', 'Erpicatura', contextData);
 */

class SmartFormFiller {
    constructor() {
        this._pendingOperations = [];
        this._isProcessing = false;
        this.formSchemas = window.TONY_FORM_SCHEMAS || {};
        // Mappa delle dipendenze conosciute (Campo Figlio -> Campo Padre)
        this.dependencies = {
            'attivita-tipo-lavoro-gerarchico': {
                parentField: 'attivita-categoria-principale',
                // Funzione per trovare il valore del padre dato il valore/testo del figlio
                deriveParent: (value, text, context) => this._deriveCategoriaFromLavoro(value, text, context)
            },
            'attivita-sottocategoria': {
                parentField: 'attivita-tipo-lavoro-gerarchico', 
                // La sottocategoria non è un vero "parent" del tipo lavoro nel DOM, ma logicamente è un filtro.
                // In questo contesto, fillField viene chiamato su 'attivita-tipo-lavoro-gerarchico'.
                // Quindi questa dipendenza non viene usata direttamente per impostare la sottocategoria PRIMA del lavoro,
                // ma possiamo estendere la logica per gestire campi correlati POST-compilazione.
                deriveParent: (value, text, context) => null 
            },
        };
    }

    /**
     * Tenta di compilare un campo gestendo le dipendenze.
     */
    async fillField(fieldId, valueOrText, context) {
        // console.log(`[SmartFiller] Richiesta compilazione: ${fieldId} = ${valueOrText}`);
        const fieldSchema = this._getFieldSchemaDefinition(fieldId);
        
        // 1. Gestione Dipendenza Padre/i (da mappa o da schema: deriveParent o deriveParentsFromChild)
        const dependency = this._getDependencyForField(fieldId);
        let derivedJob = null; // Memorizza il job trovato per uso successivo

        if (dependency) {
            if (dependency.deriveParentsFromChild && Array.isArray(dependency.parentFields)) {
                // Più padri in ordine (es. categoria → sottocategoria per lavoro-tipo-lavoro)
                const parentValues = dependency.deriveParentsFromChild(null, valueOrText, context);
                for (let i = 0; i < dependency.parentFields.length; i++) {
                    const pf = dependency.parentFields[i];
                    const v = parentValues && parentValues[pf];
                    if (v != null && v !== '') {
                        console.log(`[SmartFiller] Padre derivato: ${pf} = ${v}`);
                        const set = await this._setFieldValue(pf, v);
                        if (!set) console.warn(`[SmartFiller] Impossibile impostare padre ${pf}`);
                    }
                }
                await this._waitForOptions(fieldId);
            } else if (dependency.deriveParent && dependency.parentField) {
                if (fieldId === 'attivita-tipo-lavoro-gerarchico') {
                    derivedJob = this._findJobInContext(valueOrText, context);
                }
                const parentValue = dependency.deriveParent(null, valueOrText, context);
                if (parentValue) {
                    console.log(`[SmartFiller] Padre derivato: ${dependency.parentField} = ${parentValue}`);
                    const parentSet = await this._setFieldValue(dependency.parentField, parentValue);
                    if (parentSet) {
                        await this._waitForOptions('attivita-sottocategoria');
                        // ORDINE MODAL: Categoria → Sottocategoria (da terreno) → Tipo lavoro
                        // Imposta sottocategoria PRIMA del tipo lavoro, così si aprono i figli e loadTipiLavoro filtra correttamente
                        if (derivedJob) {
                            await this._fillSubcategory(derivedJob, context);
                            await this._waitForOptions(fieldId);
                        } else {
                            await this._waitForOptions(fieldId);
                        }
                    } else {
                        console.warn(`[SmartFiller] Impossibile impostare padre ${dependency.parentField}`);
                    }
                }
            }
        }

        // 2. Imposta il campo target (Tipo Lavoro)
        let finalValue = valueOrText;
        const el = document.getElementById(fieldId);
        
        if (el && el.tagName === 'SELECT') {
             const isDirectValue = Array.from(el.options).some(o => o.value === valueOrText);
             if (isDirectValue) {
                 finalValue = valueOrText;
             } else {
                 let resolved = null;
                 if (fieldId === 'attivita-tipo-lavoro-gerarchico') {
                     // Il dropdown usa tipo.nome come value (non id). Priorità: match per testo nelle options.
                     resolved = this._findOptionValue(el, valueOrText) ||
                               (derivedJob && this._valueExistsInOptions(el, derivedJob.nome) ? derivedJob.nome : null) ||
                               this._findTipoLavoroNomeInOptions(el, valueOrText, context);
                 }
                 if (!resolved) {
                     const schemaResolved = this._resolveUsingSchemaResolver(fieldSchema, valueOrText, context, el);
                     // Per attivita-tipo-lavoro-gerarchico usa SEMPRE nome (il dropdown usa tipo.nome come value), mai id
                     const fallbackVal = (fieldId === 'attivita-tipo-lavoro-gerarchico' && derivedJob?.nome)
                         ? (this._valueExistsInOptions(el, derivedJob.nome) ? derivedJob.nome : null)
                         : (derivedJob ? derivedJob.id : this._findValueInContext(fieldId, valueOrText, context));
                     resolved = schemaResolved ||
                               this._findOptionValue(el, valueOrText) ||
                               fallbackVal;
                 }
                 if (resolved) finalValue = resolved;
             }
        }

        const resultSet = await this._setFieldValue(fieldId, finalValue);

        // 3. Sottocategoria già impostata PRIMA del tipo lavoro (ordine modal: cat → sottocat → tipo)

        return resultSet;
    }

    /**
     * Restituisce l'opzione del select la cui label (testo o value) contiene il pattern (case-insensitive).
     */
    _findSubcategoryOptionByLabel(selectEl, labelPattern) {
        if (!selectEl || !selectEl.options) return null;
        const search = (labelPattern || '').toLowerCase();
        if (!search) return null;
        return Array.from(selectEl.options).find(o =>
            (o.text && o.text.toLowerCase().includes(search)) ||
            (o.value && o.value.toLowerCase().includes(search))
        ) || null;
    }

    /**
     * Preferenza sottocategoria in base alla coltura del terreno.
     * Regole estensibili: arboreo (vite, frutteto, oliveto, ...) → "tra le file"; seminativo/prato/altro → "generale".
     * @returns {string|null} 'tra le file' | 'generale' | null
     */
    _getColturaToSottocategoriaPreference(coltura) {
        if (!coltura || typeof coltura !== 'string') return null;
        const c = coltura.toLowerCase().trim();
        const traLeFilePatterns = ['vite', 'vigneto', 'frutteto', 'oliveto', 'arboreo', 'alberi'];
        const generalePatterns = ['seminativo', 'seminativi', 'prato', 'prati', 'generale', 'coltura erbacea'];
        if (traLeFilePatterns.some(p => c.includes(p))) return 'tra le file';
        if (generalePatterns.some(p => c.includes(p))) return 'generale';
        return null;
    }

    /**
     * Logica per dedurre e compilare la sottocategoria.
     * Priorità: 1) Job sottocategoria fissa  2) Macchina/Attrezzo selezionati → meccanica  3) Nome lavoro (manuale/meccanica)  4) Terreno/Coltura (tra le file / generale).
     */
    async _fillSubcategory(jobObj, context) {
        const subFieldId = 'attivita-sottocategoria';
        const subEl = document.getElementById(subFieldId);
        if (!subEl) {
            console.warn(`[SmartFiller] Campo sottocategoria ${subFieldId} non trovato`);
            return;
        }

        let targetSubId = null;
        console.log(`[SmartFiller] Deduzione sottocategoria per lavoro: ${jobObj.nome}`);

        // 1. Priorità: Il Job ha sottocategoria fissa o categoriaId che è una sottocategoria
        // (es. Trinciatura ha categoriaId = "Sulla Fila" e sottocategoriaId = null)
        if (jobObj.sottocategoriaId) {
            targetSubId = jobObj.sottocategoriaId;
        } else if (jobObj.categoriaId && Array.from(subEl.options).some(o => o.value === jobObj.categoriaId)) {
            // categoriaId del job è una sottocategoria valida (es. Sulla Fila per Trinciatura)
            targetSubId = jobObj.categoriaId;
            console.log(`[SmartFiller] Job.categoriaId è sottocategoria valida, uso: ${targetSubId}`);
        }

        // 2. Priorità: Macchina o Attrezzo utilizzato → lavorazione meccanica (override nome lavoro)
        if (!targetSubId) {
            const macchinaId = document.getElementById('attivita-macchina')?.value;
            const attrezzoId = document.getElementById('attivita-attrezzo')?.value;
            if (macchinaId || attrezzoId) {
                const mecOpt = this._findSubcategoryOptionByLabel(subEl, 'meccanica');
                if (mecOpt) {
                    targetSubId = mecOpt.value;
                    console.log(`[SmartFiller] Macchina/attrezzo selezionati -> Meccanica (${targetSubId})`);
                }
            }
        }

        // 3. Priorità: Nome lavoro (Manuale / Meccanica)
        if (!targetSubId) {
            const jobName = (jobObj.nome || '').toLowerCase();
            const manOpt = this._findSubcategoryOptionByLabel(subEl, 'manuale');
            if (jobName.includes('manuale') && manOpt) {
                targetSubId = manOpt.value;
            } else if (jobName.includes('meccanica') || jobName.includes('macchina')) {
                const mecOpt = this._findSubcategoryOptionByLabel(subEl, 'meccanica');
                if (mecOpt) targetSubId = mecOpt.value;
            }
        }

        // 4. Priorità: Terreno (Coltura) → "tra le file" (vigneto/frutteto/oliveto) o "generale" (seminativo/prato)
        if (!targetSubId) {
            const terrenoId = document.getElementById('attivita-terreno')?.value;
            if (terrenoId) {
                let terreno = null;
                if (window.attivitaState && window.attivitaState.terreniList) {
                    terreno = window.attivitaState.terreniList.find(t => t.id === terrenoId);
                } else if (context && context.attivita && context.attivita.terreni) {
                    terreno = context.attivita.terreni.find(t => t.id === terrenoId);
                }
                if (terreno && terreno.coltura) {
                    const preference = this._getColturaToSottocategoriaPreference(terreno.coltura);
                    if (preference === 'tra le file') {
                        const opt = this._findSubcategoryOptionByLabel(subEl, 'tra le file');
                        if (opt) targetSubId = opt.value;
                    } else if (preference === 'generale') {
                        const opt = this._findSubcategoryOptionByLabel(subEl, 'generale');
                        if (opt) targetSubId = opt.value;
                    }
                }
            }
        }

        // 5. Applicazione
        if (targetSubId) {
            const exists = Array.from(subEl.options).some(o => o.value === targetSubId);
            if (exists) {
                await this._setFieldValue(subFieldId, targetSubId);
            } else {
                console.warn(`[SmartFiller] Sottocategoria dedotta ${targetSubId} non presente nel dropdown`);
            }
        }
    }

    /**
     * Logica specifica per derivare la categoria dal lavoro.
     * Cerca in context.attivita.tipi_lavoro o window.attivitaState
     */
    _deriveCategoriaFromLavoro(value, text, context) {
        const searchText = (text || value || '').toLowerCase();
        let foundJob = null;

        // Cerca in window.attivitaState (dati caricati dal controller)
        if (window.attivitaState && window.attivitaState.tipiLavoroList) {
            foundJob = window.attivitaState.tipiLavoroList.find(t => 
                (t.id === value) || (t.nome && t.nome.toLowerCase() === searchText) || 
                (t.nome && t.nome.toLowerCase().includes(searchText)) // Fuzzy match
            );
        }

        // Cerca nel contesto Tony (backup)
        if (!foundJob && context && context.attivita && context.attivita.tipi_lavoro) {
             foundJob = context.attivita.tipi_lavoro.find(t => 
                (t.id === value) || (t.nome && t.nome.toLowerCase() === searchText) ||
                (t.nome && t.nome.toLowerCase().includes(searchText))
            );
        }

        if (foundJob) {
            console.log('[SmartFiller] Lavoro trovato:', foundJob);
            let catId = foundJob.categoriaId;
            if (!catId) return null;
            // Se categoriaId è una sottocategoria (es. "Tra le file"), risolvi alla categoria principale
            const map = (window.attivitaState && window.attivitaState.sottocategorieLavoriMap) || null;
            const mainCats = (window.attivitaState && window.attivitaState.categorieLavoriPrincipali) || [];
            const mainCatIds = mainCats.map(c => c.id || c.value).filter(Boolean);
            const isMainCat = mainCatIds.includes(catId);
            if (!isMainCat && map) {
                // Cerca parent: 1) via map.entries() se Map, 2) via flat list (più robusto)
                let resolved = false;
                if (typeof map.entries === 'function') {
                    for (const [parentId, sottocat] of map.entries()) {
                        if (Array.isArray(sottocat) && sottocat.some(sc => (sc.id || sc.value) === catId)) {
                            catId = parentId;
                            resolved = true;
                            console.log('[SmartFiller] CategoriaId era sottocategoria, risolto a principale:', catId);
                            break;
                        }
                    }
                }
                if (!resolved) {
                    const allSubcats = Array.from(map.values ? map.values() : Object.values(map)).flat();
                    const found = allSubcats.find(sc => (sc.id || sc.value) === catId);
                    if (found && (found.parentId || found.parent)) {
                        catId = found.parentId || found.parent;
                        console.log('[SmartFiller] CategoriaId era sottocategoria (flat), risolto a principale:', catId);
                    }
                }
            }
            // Se catId non è ancora una categoria principale (attivitaState vuoto o risoluzione fallita), usa euristica
            if (!mainCatIds.includes(catId) && context && context.attivita && Array.isArray(context.attivita.categorie_lavoro)) {
                const heuristic = this._deriveCategoriaHeuristic(foundJob.nome, context);
                if (heuristic) return heuristic;
                console.warn('[SmartFiller] CategoriaId non valida per dropdown, euristica fallita');
                return null; // Non impostare un valore che non esiste nelle options
            }
            return catId;
        }
        
        const heuristic = this._deriveCategoriaHeuristic(searchText, context);
        return heuristic;
    }

    /**
     * Euristica nome lavoro -> ID categoria principale (usata quando attivitaState non è pronto).
     */
    _deriveCategoriaHeuristic(jobNameOrSearch, context) {
        if (!context || !context.attivita || !Array.isArray(context.attivita.categorie_lavoro)) return null;
        const search = (jobNameOrSearch || '').toLowerCase().trim();
        if (!search) return null;
        const catNomeByJob = {
            erpicatura: 'Lavorazione del Terreno',
            erpicato: 'Lavorazione del Terreno',
            aratura: 'Lavorazione del Terreno',
            trinciatura: 'Gestione del Verde',
            trinciato: 'Gestione del Verde',
            fresatura: 'Lavorazione del Terreno',
            fresato: 'Lavorazione del Terreno',
            estirpatura: 'Lavorazione del Terreno',
            zappatura: 'Lavorazione del Terreno',
            diserbo: 'Diserbo',
            potatura: 'Potatura',
            potato: 'Potatura',
            raccolta: 'Raccolta',
            raccolto: 'Raccolta',
            trattamenti: 'Trattamenti',
            trattato: 'Trattamenti',
            concimazione: 'Trattamenti',
            semina: 'Semina e Piantagione',
            piantagione: 'Semina e Piantagione',
            manutenzione: 'Manutenzione',
            altro: 'Altro'
        };
        const catNome = catNomeByJob[search] || catNomeByJob[search.replace(/o$/, 'a')];
        if (catNome) {
            const cat = context.attivita.categorie_lavoro.find(c =>
                (c.nome || '').toLowerCase().includes(catNome.toLowerCase()));
            if (cat && cat.id) {
                console.log('[SmartFiller] Categoria derivata da euristica:', catNome, '→', cat.id);
                return cat.id;
            }
        }
        return null;
    }

    /**
     * Trova il value di una option dato il testo (fuzzy match).
     */
    _findOptionValue(selectEl, text) {
        if (!text) return null;
        const search = text.toLowerCase();
        const options = Array.from(selectEl.options);
        
        // Match esatto
        let opt = options.find(o => o.text.toLowerCase() === search || o.value === text);
        if (opt) return opt.value;
        
        // Match parziale
        opt = options.find(o => o.text.toLowerCase().includes(search));
        if (opt) return opt.value;

        return null;
    }

    /** Verifica se un value è presente nelle option del select. */
    _valueExistsInOptions(el, value) {
        if (!el || !value) return false;
        return Array.from(el.options).some(o => o.value === value);
    }

    /**
     * Per attivita-tipo-lavoro-gerarchico: cerca il lavoro per nome nel context e ritorna
     * job.nome se quel nome esiste nelle options (il dropdown usa nome come value).
     */
    _findTipoLavoroNomeInOptions(el, text, context) {
        const job = this._findJobInContext(text, context);
        if (!job || !job.nome) return null;
        return this._valueExistsInOptions(el, job.nome) ? job.nome : null;
    }

    /**
     * Cerca l'ID nei dati di contesto se il select è vuoto (non ancora popolato).
     */
    _findValueInContext(fieldId, text, context) {
        if (fieldId === 'attivita-tipo-lavoro-gerarchico' || fieldId === 'attivita-tipo-lavoro') {
             const job = this._findJobInContext(text, context);
             return job ? job.id : null;
        }
        return null;
    }

    _findJobInContext(text, context) {
         if (!text) return null;
         const searchText = text.toLowerCase().trim();
         
         // Helper per cercare nella lista
         const searchInList = (list) => {
             if (!Array.isArray(list)) return null;
             // Cerca match esatto o parziale
             return list.find(t => t.nome && (
                 t.nome.toLowerCase() === searchText || 
                 t.nome.toLowerCase().includes(searchText) ||
                 searchText.includes(t.nome.toLowerCase()) // Viceversa: "Trinciatura vigneto" include "Trinciatura"
             ));
         };

         // Priorità a window.attivitaState (dati runtime del controller)
         if (window.attivitaState && window.attivitaState.tipiLavoroList) {
             const found = searchInList(window.attivitaState.tipiLavoroList);
             if (found) return found;
         }
         
         // Fallback su context di Tony
         if (context && context.attivita && context.attivita.tipi_lavoro) {
             return searchInList(context.attivita.tipi_lavoro);
         }
         
         return null;
    }

    _getFieldSchemaDefinition(fieldId) {
        const schema = this.getActiveSchema();
        if (!schema || !Array.isArray(schema.fields) || !fieldId) return null;
        return schema.fields.find((f) => f && f.id === fieldId) || null;
    }

    /**
     * Restituisce la dipendenza per un campo: dalla mappa hardcoded o dallo schema (dependsOn + deriveParentFromChild / deriveParentsFromChild).
     * Ritorno: { parentField, deriveParent } (un solo padre) oppure { parentFields, deriveParentsFromChild } (più padri) o null.
     */
    _getDependencyForField(fieldId) {
        if (this.dependencies[fieldId]) return this.dependencies[fieldId];
        const fieldSchema = this._getFieldSchemaDefinition(fieldId);
        if (!fieldSchema || !Array.isArray(fieldSchema.dependsOn) || !fieldSchema.dependsOn[0]) return null;
        if (typeof fieldSchema.deriveParentsFromChild === 'function') {
            return {
                parentFields: fieldSchema.dependsOn,
                deriveParentsFromChild: (value, text, context) => fieldSchema.deriveParentsFromChild(value || text, context)
            };
        }
        if (typeof fieldSchema.deriveParentFromChild === 'function') {
            return {
                parentField: fieldSchema.dependsOn[0],
                deriveParent: (value, text, context) => fieldSchema.deriveParentFromChild(value || text, context)
            };
        }
        return null;
    }

    _resolveUsingSchemaResolver(fieldSchema, valueOrText, context, element) {
        if (!fieldSchema || typeof fieldSchema.resolver !== 'function') return null;
        try {
            return fieldSchema.resolver(valueOrText, fieldSchema, context, element) || null;
        } catch (error) {
            console.warn('[SmartFiller] Resolver schema fallito per campo', fieldSchema.id, error);
            return null;
        }
    }

    /**
     * Imposta fisicamente il valore e scaena eventi.
     */
    async _setFieldValue(fieldId, value) {
        const el = document.getElementById(fieldId);
        if (!el) {
            console.warn(`[SmartFiller] Elemento ${fieldId} non trovato nel DOM`);
            return false;
        }
        
        // Se il valore è identico, non fare nulla ma ritorna true
        if (el.value === value) {
            return true;
        }

        // Per SELECT: verifica che il valore esista nelle options, altrimenti l'impostazione fallirebbe silenziosamente
        if (el.tagName === 'SELECT' && value) {
            const exists = Array.from(el.options).some(o => o.value === value);
            if (!exists) {
                console.warn(`[SmartFiller] Valore "${value}" non presente nelle options di ${fieldId} (${el.options.length} opzioni), impossibile impostare`);
                return false;
            }
        }

        el.value = value;
        
        // Trigger eventi standard
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true })); // Force validation/update
        
        // Supporto jQuery se presente (Select2 spesso usa jQuery)
        if (window.jQuery) {
            window.jQuery(el).trigger('change');
            // Alcuni framework ascoltano 'input' anche su jQuery
            window.jQuery(el).trigger('input');
        }
        
        // console.log(`[SmartFiller] Impostato ${fieldId} = ${value}`);
        return true;
    }

    /**
     * Attende che un select si popoli (es. dopo aver settato il padre).
     * Per attivita-sottocategoria: se il gruppo è nascosto (display:none) = nessuna sottocategoria, risolve subito.
     */
    async _waitForOptions(selectId, timeout = 5000) {
        const el = document.getElementById(selectId);
        if (!el || el.tagName !== 'SELECT') return;

        const group = document.getElementById(selectId + '-group');
        const isGroupHidden = () => {
            if (!group) return false;
            const s = window.getComputedStyle(group);
            return s.display === 'none' || s.visibility === 'hidden';
        };

        const startCount = el.options.length;
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if (selectId === 'attivita-sottocategoria' && isGroupHidden()) {
                    clearInterval(interval);
                    resolve(true);
                    return;
                }
                if ((el.options.length > startCount || el.options.length > 1) && !el.disabled) {
                    clearInterval(interval);
                    resolve(true);
                }
            }, 100);

            setTimeout(() => {
                clearInterval(interval);
                if (selectId === 'attivita-sottocategoria') {
                    resolve(true); // Procedi comunque per non bloccare
                } else {
                    console.warn(`[SmartFiller] Timeout attesa ${selectId}`);
                    resolve(false);
                }
            }, timeout);
        });
    }

    /**
     * Determina se l'elemento è effettivamente visibile all'utente.
     */
    _isVisible(el) {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;

        const parentGroup = el.closest('[id$="-group"]');
        if (parentGroup) {
            const parentStyle = window.getComputedStyle(parentGroup);
            if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') return false;
        }

        const rect = el.getBoundingClientRect();
        return rect.width > 0 || rect.height > 0;
    }

    /**
     * Restituisce lo schema per il modal attivo (se disponibile).
     */
    getActiveSchema() {
        if (window.TONY_FORM_SCHEMAS && window.TONY_FORM_SCHEMAS !== this.formSchemas) {
            this.formSchemas = window.TONY_FORM_SCHEMAS;
        }
        const activeModal = document.querySelector('.modal.active');
        if (!activeModal || !activeModal.id) return null;
        return this.formSchemas[activeModal.id] || null;
    }

    /**
     * Save guard deterministico: blocca submit se required visibili mancanti
     * o se il bottone submit non è disponibile/abilitato.
     */
    validateBeforeSave() {
        const schema = this.getActiveSchema();
        const activeModal = document.querySelector('.modal.active');
        const missingFields = [];

        if (!activeModal) {
            return {
                isComplete: false,
                missingFields: ['Nessun modal attivo'],
                details: { schemaId: null, submitAvailable: false, missingVisibleRequired: ['Nessun modal attivo'] }
            };
        }

        const form = activeModal.querySelector('form');
        if (!form) {
            return {
                isComplete: false,
                missingFields: ['Nessun form nel modal attivo'],
                details: { schemaId: schema ? schema.modalId : null, submitAvailable: false, missingVisibleRequired: ['Nessun form nel modal attivo'] }
            };
        }

        const stateValues = {};
        form.querySelectorAll('input, select, textarea').forEach((el) => {
            if (!el || !el.id) return;
            stateValues[el.id] = el.value;
        });

        const schemaFields = schema && Array.isArray(schema.fields) ? schema.fields : [];
        schemaFields.forEach((fieldDef) => {
            const fieldId = fieldDef && fieldDef.id ? fieldDef.id : '';
            if (!fieldId) return;

            const el = document.getElementById(fieldId);
            if (!el || !activeModal.contains(el)) return;

            const visibleByDom = this._isVisible(el);
            const visibleByRule = this._isFieldVisibleBySchema(fieldDef, {
                values: stateValues,
                modal: activeModal,
                form: form
            });
            const isVisible = visibleByDom && visibleByRule;
            if (!isVisible) return;

            const isRequired = this._isFieldRequiredBySchema(fieldDef, {
                values: stateValues,
                modal: activeModal,
                form: form
            });
            if (!isRequired) return;

            const value = el.value == null ? '' : String(el.value).trim();
            if (!value) {
                const label = this._getFieldLabel(activeModal, el);
                missingFields.push(fieldId + ' (' + label + ')');
            }
        });

        // Fallback per required presenti a DOM ma non ancora modellati nello schema.
        const requiredElements = form.querySelectorAll('[required]');
        requiredElements.forEach((el) => {
            if (!el.id) return;
            if (!this._isVisible(el)) return;
            const alreadyTracked = missingFields.some((x) => x.indexOf(el.id + ' (') === 0);
            if (alreadyTracked) return;

            const value = el.value == null ? '' : String(el.value).trim();
            if (!value) {
                const label = this._getFieldLabel(activeModal, el);
                missingFields.push(el.id + ' (' + label + ')');
            }
        });

        const submitSelector = schema && schema.submitSelector ? schema.submitSelector : 'button[type="submit"], input[type="submit"], .btn-primary';
        const submitEl = activeModal.querySelector(submitSelector);
        const submitAvailable = !!(submitEl && !submitEl.disabled && this._isVisible(submitEl));

        const state = {
            schemaId: schema ? schema.modalId : null,
            missingVisibleRequired: missingFields.slice(),
            submitAvailable: submitAvailable
        };

        const isComplete = schema && typeof schema.saveGuard === 'function'
            ? !!schema.saveGuard(state)
            : (missingFields.length === 0 && submitAvailable);

        if (!submitAvailable) {
            missingFields.push('Pulsante Salva non disponibile');
        }

        return {
            isComplete: isComplete,
            missingFields: missingFields,
            details: state
        };
    }

    _getFieldLabel(activeModal, el) {
        if (!activeModal || !el || !el.id) return el && el.id ? el.id : 'campo';
        const labelEl = activeModal.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (labelEl) return labelEl.textContent.trim().replace(/\s*\*?\s*$/, '');
        return el.placeholder || el.getAttribute('aria-label') || el.id;
    }

    _isFieldVisibleBySchema(fieldDef, state) {
        if (!fieldDef) return true;
        if (typeof fieldDef.visibleWhen === 'function') {
            try {
                return !!fieldDef.visibleWhen(state);
            } catch (_) {
                return true;
            }
        }
        return true;
    }

    _isFieldRequiredBySchema(fieldDef, state) {
        if (!fieldDef) return false;
        if (typeof fieldDef.required === 'function') {
            try {
                return !!fieldDef.required(state);
            } catch (_) {
                return false;
            }
        }
        return !!fieldDef.required;
    }
}

// Esporta globalmente
window.SmartFormFiller = SmartFormFiller;
