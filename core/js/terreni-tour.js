/**
 * Terreni Tour - Logica tour interattivo per gestione terreni
 * 
 * @module core/js/terreni-tour
 */

// ============================================
// CONSTANTS
// ============================================
const TERRENI_TOUR_STORAGE_KEY = 'gfv_terreni_tour_v1';

// ============================================
// STATE MANAGEMENT
// ============================================
// Le variabili di stato (terreniTourAutoRequested, terreniTourOpenedModal) 
// verranno gestite tramite un state object o variabili globali nel file HTML principale

// ============================================
// FUNZIONI PRINCIPALI
// ============================================

/**
 * Setup bottone tour e event listener
 * @param {Function} startTerreniTourCallback - Callback per avviare tour
 */
export function setupTerreniTourButton(startTerreniTourCallback) {
    const tourButton = document.getElementById('terreni-tour-button');
    if (tourButton && startTerreniTourCallback) {
        tourButton.addEventListener('click', () => startTerreniTourCallback(true));
    }
}

/**
 * Avvia tour automaticamente se utente non l'ha mai visto
 * @param {Object} state - State object con { terreniTourAutoRequested }
 * @param {Function} updateState - Funzione per aggiornare lo state
 * @param {Function} startTerreniTourCallback - Callback per avviare tour
 */
export function maybeAutoStartTerreniTour(state, updateState, startTerreniTourCallback) {
    if (state.terreniTourAutoRequested) return;
    try {
        const hasSeen = localStorage.getItem(TERRENI_TOUR_STORAGE_KEY);
        if (!hasSeen && startTerreniTourCallback) {
            updateState({ terreniTourAutoRequested: true });
            setTimeout(() => startTerreniTourCallback(false), 2000);
        }
    } catch (error) {
        // Ignora errori localStorage
    }
}

/**
 * Avvia tour interattivo
 * @param {boolean} triggeredManually - Se true, tour avviato manualmente dall'utente
 * @param {Object} state - State object con { terreniTourOpenedModal }
 * @param {Function} updateState - Funzione per aggiornare lo state
 * @param {Function} openTerrenoModalCallback - Callback per aprire modal
 * @param {Function} closeTerrenoModalCallback - Callback per chiudere modal
 */
export function startTerreniTour(
    triggeredManually,
    state,
    updateState,
    openTerrenoModalCallback,
    closeTerrenoModalCallback
) {
    if (typeof introJs === 'undefined') {
        if (triggeredManually) {
            alert('Tour non disponibile al momento. Riprova più tardi.');
        }
        return;
    }

    const modal = document.getElementById('terreno-modal');
    const modalAlreadyOpen = modal && modal.classList.contains('active');
    
    // Apriamo temporaneamente il modal per costruire gli step correttamente
    // (così tutti gli elementi sono visibili quando vengono cercati)
    let modalWasOpenedForTour = false;
    if (!modalAlreadyOpen && openTerrenoModalCallback) {
        openTerrenoModalCallback(null, state, updateState);
        modalWasOpenedForTour = true;
        // Piccolo delay per assicurarsi che il modal sia completamente aperto
        setTimeout(() => {
            // Costruisci gli step ora che il modal è aperto
            const steps = buildTerreniTourSteps();
            
            if (!steps.length) {
                if (modalWasOpenedForTour && closeTerrenoModalCallback) {
                    closeTerrenoModalCallback(state, updateState);
                }
                if (triggeredManually) {
                    alert('Completa il caricamento della pagina per poter vedere il tour.');
                }
                return;
            }

            updateState({ terreniTourOpenedModal: false });

            // Se abbiamo aperto il modal, chiudiamolo prima di iniziare il tour
            // (lo riapriremo quando arriviamo agli step del form)
            if (modalWasOpenedForTour && closeTerrenoModalCallback) {
                closeTerrenoModalCallback(state, updateState);
                // Piccolo delay per assicurarsi che il modal sia chiuso
                setTimeout(() => {
                    startTourWithSteps(
                        steps,
                        modalAlreadyOpen,
                        modalWasOpenedForTour,
                        state,
                        updateState,
                        openTerrenoModalCallback,
                        closeTerrenoModalCallback
                    );
                }, 100);
            } else {
                startTourWithSteps(
                    steps,
                    modalAlreadyOpen,
                    modalWasOpenedForTour,
                    state,
                    updateState,
                    openTerrenoModalCallback,
                    closeTerrenoModalCallback
                );
            }
        }, 200);
    } else {
        // Il modal è già aperto, costruisci gli step direttamente
        const steps = buildTerreniTourSteps();
        
        if (!steps.length) {
            if (triggeredManually) {
                alert('Completa il caricamento della pagina per poter vedere il tour.');
            }
            return;
        }

        updateState({ terreniTourOpenedModal: false });
        startTourWithSteps(
            steps,
            modalAlreadyOpen,
            false,
            state,
            updateState,
            openTerrenoModalCallback,
            closeTerrenoModalCallback
        );
    }
}

/**
 * Avvia tour con gli step costruiti
 * @param {Array} steps - Array step tour
 * @param {boolean} modalAlreadyOpen - Se true, modal già aperto
 * @param {boolean} modalWasOpenedForTour - Se true, modal aperto per tour
 * @param {Object} state - State object
 * @param {Function} updateState - Funzione per aggiornare lo state
 * @param {Function} openTerrenoModalCallback - Callback per aprire modal
 * @param {Function} closeTerrenoModalCallback - Callback per chiudere modal
 */
function startTourWithSteps(
    steps,
    modalAlreadyOpen,
    modalWasOpenedForTour,
    state,
    updateState,
    openTerrenoModalCallback,
    closeTerrenoModalCallback
) {
    // Variabile per salvare la posizione top del popup della barra di ricerca
    let searchPopupTop = null;
    
    const tour = introJs.tour().setOptions({
        steps,
        showProgress: true,
        showBullets: false,
        exitOnOverlayClick: true,
        nextLabel: 'Avanti',
        prevLabel: 'Indietro',
        skipLabel: '×',
        doneLabel: 'Fatto',
        scrollToElement: true, // Scroll automatico agli elementi
        scrollPadding: 50, // Padding maggiore per lo scroll
        tooltipClass: 'customTooltip',
        highlightClass: 'customHighlight'
    });
    
    // Flag per evitare loop infiniti
    let isRepositioning = false;
    let ensureTooltipCallCount = 0;
    let lastCallTime = 0;
    const MAX_ENSURE_CALLS = 3; // Massimo 3 chiamate consecutive
    const CALL_RESET_TIME = 500; // Reset contatore dopo 500ms di inattività
    let isListaStepActive = false; // Flag per preservare position: fixed per lista terreni
    
    // Funzione per forzare il posizionamento corretto del tooltip in base alle dimensioni dello schermo
    function ensureTooltipVisible() {
        const now = Date.now();
        
        // Reset contatore se è passato abbastanza tempo dall'ultima chiamata
        if (now - lastCallTime > CALL_RESET_TIME) {
            ensureTooltipCallCount = 0;
        }
        lastCallTime = now;
        
        ensureTooltipCallCount++;
        if (ensureTooltipCallCount > MAX_ENSURE_CALLS) {
            ensureTooltipCallCount = 0;
            return;
        }
        
        if (isRepositioning) {
            return;
        }
        
        setTimeout(() => {
            const tooltip = document.querySelector('.introjs-tooltip');
            const highlightedElement = document.querySelector('.introjs-showElement');

            if (!tooltip) {
                ensureTooltipCallCount = 0; // Reset se tooltip non esiste
                return;
            }
            
            // Se siamo nello step della lista, preserva position: fixed
            if (isListaStepActive) {
                tooltip.style.setProperty('position', 'fixed', 'important');
                tooltip.style.setProperty('z-index', '9999999', 'important');
            } else {
                // FORZA position: absolute con !important per uscire dallo stacking context del parent
                tooltip.style.setProperty('position', 'absolute', 'important');
                tooltip.style.setProperty('z-index', '999999', 'important');
            }
            
            const rect = tooltip.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const tooltipHeight = rect.height;
            const tooltipWidth = rect.width;
            
            // Margine di sicurezza (più grande per schermi piccoli)
            const isMobile = viewportWidth < 768;
            const isTablet = viewportWidth >= 768 && viewportWidth < 1024;
            const margin = isMobile ? 30 : (isTablet ? 25 : 20);
            
            // Ottieni la posizione corrente del tooltip
            const currentTop = parseInt(tooltip.style.top) || rect.top;
            const currentLeft = parseInt(tooltip.style.left) || rect.left;
            
            // Controlla e correggi posizione verticale
            let newTop = currentTop;
            if (rect.top < margin) {
                // Tooltip troppo in alto - spostalo in basso
                newTop = margin;
                tooltip.style.top = newTop + 'px';
                tooltip.style.bottom = 'auto';
            } else if (rect.bottom > viewportHeight - margin) {
                // Tooltip troppo in basso - spostalo in alto
                newTop = viewportHeight - tooltipHeight - margin;
                tooltip.style.top = newTop + 'px';
                tooltip.style.bottom = 'auto';
            }
            
            // Controlla e correggi posizione orizzontale
            let newLeft = currentLeft;
            if (rect.left < margin) {
                // Tooltip troppo a sinistra - spostalo a destra
                newLeft = margin;
                tooltip.style.left = newLeft + 'px';
                tooltip.style.right = 'auto';
            } else if (rect.right > viewportWidth - margin) {
                // Tooltip troppo a destra - spostalo a sinistra
                newLeft = viewportWidth - tooltipWidth - margin;
                tooltip.style.left = newLeft + 'px';
                tooltip.style.right = 'auto';
            }
            
            // Su schermi piccoli, centra il tooltip se è troppo largo
            if (isMobile && tooltipWidth > viewportWidth - (margin * 2)) {
                tooltip.style.left = margin + 'px';
                tooltip.style.right = margin + 'px';
                tooltip.style.width = 'auto';
                tooltip.style.maxWidth = (viewportWidth - (margin * 2)) + 'px';
            }
            
            // FORZA anche il tooltipReferenceLayer ad avere position absolute/fixed e z-index alto
            const tooltipReferenceLayer = document.querySelector('.introjs-tooltipReferenceLayer');
            if (tooltipReferenceLayer) {
                if (isListaStepActive) {
                    tooltipReferenceLayer.style.setProperty('position', 'fixed', 'important');
                    tooltipReferenceLayer.style.setProperty('z-index', '9999999', 'important');
                } else {
                    tooltipReferenceLayer.style.setProperty('position', 'absolute', 'important');
                    tooltipReferenceLayer.style.setProperty('z-index', '999999', 'important');
                }
            }
            
            // Se c'è un elemento evidenziato, assicurati che non sia coperto dal tooltip
            if (highlightedElement && !isListaStepActive) {
                const elementRect = highlightedElement.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();

                // Controlla se il tooltip copre l'elemento evidenziato
                const tooltipCoversElement = !(
                    tooltipRect.bottom < elementRect.top ||
                    tooltipRect.top > elementRect.bottom ||
                    tooltipRect.right < elementRect.left ||
                    tooltipRect.left > elementRect.right
                );
                
                // Per la lista terreni, non fare scroll se il tooltip copre l'elemento (è normale)
                if (tooltipCoversElement && !isRepositioning && ensureTooltipCallCount <= 1) {
                    isRepositioning = true;
                    
                    // Scrolla l'elemento in vista, lasciando spazio per il tooltip
                    highlightedElement.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center',
                        inline: 'nearest'
                    });
                    
                    // Dopo lo scroll, riposiziona il tooltip se necessario (solo una volta)
                    setTimeout(() => {
                        isRepositioning = false;
                        ensureTooltipCallCount = 0; // Reset contatore
                        ensureTooltipVisible();
                    }, 300);
                }
            }

        }, 150);
    }

    // Gestisci apertura/chiusura modal e scroll durante il tour
    tour.onchange((targetElement) => {
        if (!targetElement) return;
        
        // Scroll l'elemento in vista con un piccolo delay
        setTimeout(() => {
            if (targetElement && typeof targetElement.scrollIntoView === 'function') {
                targetElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                });
            }
            
            // FORZA position e z-index PRIMA di ensureTooltipVisible
            const tooltip = document.querySelector('.introjs-tooltip');
            const tooltipReferenceLayer = document.querySelector('.introjs-tooltipReferenceLayer');
            
            if (tooltip) {
                tooltip.style.setProperty('position', 'absolute', 'important');
                tooltip.style.setProperty('z-index', '999999', 'important');
            }
            
            if (tooltipReferenceLayer) {
                tooltipReferenceLayer.style.setProperty('position', 'absolute', 'important');
                tooltipReferenceLayer.style.setProperty('z-index', '999999', 'important');
            }
            
            // Forza il tooltip a essere visibile
            ensureTooltipVisible();
        }, 150);
        
        const isFormStep = targetElement.closest('[data-tour-section="form-terreno"]') ||
                          targetElement.closest('[data-tour-section="mappa-terreno"]');
        
        const isListaStep = targetElement.closest('[data-tour-section="lista-terreni"]');
        
        // Apri il modal quando arriviamo agli step del form/mappa
        if (isFormStep && !modalAlreadyOpen && !state.terreniTourOpenedModal && openTerrenoModalCallback) {
            updateState({ terreniTourOpenedModal: true });
            // Apri il modal con delay per assicurarsi che sia completamente renderizzato
            setTimeout(() => {
                openTerrenoModalCallback(null, state, updateState);
                // Scroll l'elemento dopo che il modal è aperto
                setTimeout(() => {
                    if (targetElement && typeof targetElement.scrollIntoView === 'function') {
                        targetElement.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center',
                            inline: 'nearest'
                        });
                    }
                    // Forza il tooltip a essere visibile
                    ensureTooltipVisible();
                }, 300);
            }, 300);
        }
        
        // Chiudi il modal quando arriviamo alla lista (se l'abbiamo aperto noi)
        if (isListaStep && modalWasOpenedForTour && state.terreniTourOpenedModal && closeTerrenoModalCallback) {
            updateState({ terreniTourOpenedModal: false });
            setTimeout(() => {
                closeTerrenoModalCallback(state, updateState);
                // Scroll la lista dopo che il modal è chiuso
                setTimeout(() => {
                    if (targetElement && typeof targetElement.scrollIntoView === 'function') {
                        targetElement.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center',
                            inline: 'nearest'
                        });
                    }
                    // Forza il tooltip a essere visibile solo se esiste
                    const tooltipAfterClose = document.querySelector('.introjs-tooltip');
                    if (tooltipAfterClose) {
                        ensureTooltipVisible();
                    } else {
                        setTimeout(() => {
                            const tooltipAfterWait = document.querySelector('.introjs-tooltip');
                            if (tooltipAfterWait) {
                                ensureTooltipVisible();
                            }
                        }, 200);
                    }
                }, 300);
            }, 200);
        }
    });

    // Assicurati che il tooltip sia visibile quando viene mostrato
    tour.onafterchange((targetElement) => {
        // FORZA position e z-index PRIMA di tutto
        const tooltip = document.querySelector('.introjs-tooltip');
        const tooltipReferenceLayer = document.querySelector('.introjs-tooltipReferenceLayer');
        
        if (tooltip) {
            // FORZA position: absolute con !important
            tooltip.style.setProperty('position', 'absolute', 'important');
            tooltip.style.setProperty('z-index', '999999', 'important');
        }
        
        if (tooltipReferenceLayer) {
            tooltipReferenceLayer.style.setProperty('position', 'absolute', 'important');
            tooltipReferenceLayer.style.setProperty('z-index', '999999', 'important');
        }
        
        // Se è lo step della lista terreni, forza il tooltip sopra la lista
        const isListaStep = targetElement && (
            targetElement.closest('[data-tour-section="lista-terreni"]') ||
            targetElement.classList.contains('terreni-table') ||
            targetElement.querySelector('table')
        );
        
        // Imposta il flag per preservare position: fixed
        isListaStepActive = !!isListaStep;
        
        if (isListaStep && tooltip) {
            // Forza z-index ancora più alto e assicurati che sia sopra tutto
            tooltip.style.setProperty('z-index', '9999999', 'important');
            tooltip.style.setProperty('position', 'fixed', 'important'); // Usa fixed per essere sicuro che sia sopra tutto
            if (tooltipReferenceLayer) {
                tooltipReferenceLayer.style.setProperty('z-index', '9999999', 'important');
                tooltipReferenceLayer.style.setProperty('position', 'fixed', 'important');
            }
            // Reset contatore per permettere nuove chiamate per questo step
            ensureTooltipCallCount = 0;
        } else {
            // Reset flag se non siamo nello step della lista
            isListaStepActive = false;
        }
        
        // Chiama ensureTooltipVisible solo se il tooltip esiste
        const tooltipExists = document.querySelector('.introjs-tooltip');
        if (tooltipExists) {
            ensureTooltipVisible();
        } else {
            // Aspetta che Intro.js crei il tooltip
            setTimeout(() => {
                const tooltipAfterWait = document.querySelector('.introjs-tooltip');
                if (tooltipAfterWait) {
                    ensureTooltipVisible();
                }
            }, 100);
        }
    });

    tour.oncomplete(() => {
        // Reset flag quando il tour finisce
        isListaStepActive = false;
        isRepositioning = false;
        ensureTooltipCallCount = 0;
        
        if (!modalAlreadyOpen && modalWasOpenedForTour && closeTerrenoModalCallback) {
            closeTerrenoModalCallback(state, updateState);
        }
        try { localStorage.setItem(TERRENI_TOUR_STORAGE_KEY, 'done'); } catch (error) {}
    });

    tour.onexit(() => {
        // Reset flag quando il tour viene chiuso
        isListaStepActive = false;
        isRepositioning = false;
        ensureTooltipCallCount = 0;
        
        if (!modalAlreadyOpen && modalWasOpenedForTour && closeTerrenoModalCallback) {
            closeTerrenoModalCallback(state, updateState);
        }
        try { localStorage.setItem(TERRENI_TOUR_STORAGE_KEY, 'done'); } catch (error) {}
    });

    tour.start();
    
    // Assicurati che il tooltip sia visibile anche all'inizio
    setTimeout(() => {
        ensureTooltipVisible();
    }, 300);
}

/**
 * Costruisce array step per tour
 * @returns {Array} Array step tour
 */
function buildTerreniTourSteps() {
    const steps = [];

    // 1. Header - usa l'intero header per migliore visibilità
    const header = document.querySelector('.header');
    if (header) {
        steps.push({
            element: header,
            position: 'bottom',
            title: 'Gestione Terreni',
            intro: 'Qui gestisci l\'anagrafica completa dei terreni aziendali. Puoi sempre tornare alla dashboard o aprire le guide.'
        });
    }

    // 2. Pulsante aggiungi
    const addButton = document.getElementById('add-terreno-button');
    if (addButton) {
        steps.push({
            element: addButton,
            position: 'auto', // Lascia che Intro.js scelga la posizione migliore
            title: 'Aggiungi nuovo terreno',
            intro: 'Premi qui per aprire il modulo completo: inserisci dati anagrafici, podere, coltura e traccia i confini sulla mappa.'
        });
    }

    // 3. Form e mappa (nel modal - verrà aperto durante il tour)
    const modal = document.getElementById('terreno-modal');
    const form = modal ? modal.querySelector('#terreno-form') : null;
    
    // Usa il form specifico invece del modal-content
    if (form) {
        steps.push({
            element: form,
            position: 'left', // A sinistra del form
            title: 'Modulo dettagli terreno',
            intro: 'Compila Nome, Superficie, Coltura, Podere e note operative. I dropdown sono alimentati dalle liste aziendali. La superficie può essere calcolata automaticamente tracciando i confini.'
        });
    }

    // Step dettagliati per il tracciamento confini
    const mappa = modal ? modal.querySelector('[data-tour-section="mappa-terreno"]') : null;
    if (mappa) {
        // Step 1: Ricerca indirizzo - usa il wrapper che include input e pulsante
        const searchWrapper = document.getElementById('map-search-wrapper');
        if (searchWrapper) {
            steps.push({
                element: searchWrapper,
                position: 'left', // A SINISTRA per non coprire la barra di ricerca
                title: 'Cerca l\'indirizzo del terreno',
                intro: 'Digita l\'indirizzo o il nome del luogo e clicca "🔍 Cerca" per centrare la mappa. Puoi anche trascinare manualmente la mappa per posizionarla.'
            });
        } else {
            // Fallback all'input se il wrapper non esiste
            const searchInput = document.getElementById('map-search');
            if (searchInput) {
                steps.push({
                    element: searchInput,
                    position: 'left',
                    title: 'Cerca l\'indirizzo del terreno',
                    intro: 'Digita l\'indirizzo o il nome del luogo e clicca "🔍 Cerca" per centrare la mappa. Puoi anche trascinare manualmente la mappa per posizionarla.'
                });
            }
        }

        // Step 2: Pulsante tracciamento - punta DIRETTAMENTE al pulsante
        const drawButton = document.getElementById('btn-draw');
        if (drawButton) {
            steps.push({
                element: drawButton,
                position: 'right', // A DESTRA del pulsante per metterlo nella zona vuota
                title: 'Inizia il tracciamento confini',
                intro: 'Clicca "✏️ Traccia Confini" per attivare la modalità disegno. Il cursore diventerà una croce: ora puoi cliccare sulla mappa per aggiungere punti al perimetro. 🆕 Nuovo terreno: clicca sulla mappa per tracciare. ✏️ Modifica esistente: i confini vengono caricati automaticamente e puoi trascinare i vertici (pallini verdi) per modificarli. Servono almeno 3 punti per calcolare la superficie.'
            });
        }

        // Step 3: Area calcolata - punta DIRETTAMENTE al container map-info
        const mapInfo = document.getElementById('map-info');
        if (mapInfo) {
            steps.push({
                element: mapInfo,
                position: 'top', // Sopra l'info
                title: 'Superficie calcolata automaticamente',
                intro: 'La superficie viene calcolata in tempo reale mentre tracci. Puoi anche inserire manualmente la superficie nel campo "Superficie" del form se preferisci. Il valore calcolato dalla mappa ha priorità se presente.'
            });
        }
    }

    // 4. Lista terreni - ALLA FINE (dopo aver chiuso il modal)
    const lista = document.querySelector('[data-tour-section="lista-terreni"]');
    if (lista) {
        // Verifica che l'elemento sia nel DOM
        const listaStyle = window.getComputedStyle(lista);
        const isListaVisible = listaStyle.display !== 'none' && 
                              listaStyle.visibility !== 'hidden';
        
        if (isListaVisible) {
            // Prova a trovare la tabella, altrimenti usa il container
            let targetElement = lista.querySelector('table');
            if (!targetElement) {
                targetElement = lista.querySelector('.terreni-table');
            }
            if (!targetElement) {
                // Se non c'è tabella, usa il container stesso
                targetElement = lista;
            }
            
            // Aggiungi lo step solo se l'elemento esiste
            if (targetElement) {
                steps.push({
                    element: targetElement,
                    position: 'auto', // Lascia che Intro.js scelga la posizione migliore
                    title: 'Elenco terreni',
                    intro: 'La tabella mostra nome campo, coltura, podere, superficie e stato mappa. Clicca "✏️ Modifica" per modificare un terreno esistente: i confini verranno caricati sulla mappa e potrai modificarli trascinando i vertici.'
                });
            }
        }
    }

    return steps;
}

