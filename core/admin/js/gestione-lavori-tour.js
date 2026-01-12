/**
 * Gestione Lavori Tour - Logica tour interattivo per gestione lavori
 * 
 * @module core/admin/js/gestione-lavori-tour
 */

// ============================================
// CONSTANTS
// ============================================
const LAVORI_TOUR_STORAGE_KEY = 'gfv_lavori_tour_v1';

// ============================================
// FUNZIONI PRINCIPALI
// ============================================

/**
 * Setup bottone tour e event listener
 * @param {Function} startLavoriTourCallback - Callback per avviare tour
 */
export function setupLavoriTourButton(startLavoriTourCallback) {
    const tourButton = document.getElementById('lavori-tour-button');
    if (tourButton && startLavoriTourCallback) {
        tourButton.addEventListener('click', () => startLavoriTourCallback(true));
    }
}

/**
 * Avvia tour automaticamente se utente non l'ha mai visto
 * @param {Object} state - State object con { lavoriTourAutoRequested }
 * @param {Function} updateState - Funzione per aggiornare lo state
 * @param {Function} startLavoriTourCallback - Callback per avviare tour
 */
export function maybeAutoStartLavoriTour(state, updateState, startLavoriTourCallback) {
    if (state.lavoriTourAutoRequested) return;
    try {
        const hasSeen = localStorage.getItem(LAVORI_TOUR_STORAGE_KEY);
        if (!hasSeen && startLavoriTourCallback) {
            updateState({ lavoriTourAutoRequested: true });
            setTimeout(() => startLavoriTourCallback(false), 2200);
        }
    } catch (error) {
        // Ignora errori localStorage
    }
}

/**
 * Avvia tour interattivo
 * @param {boolean} triggeredManually - Se true, tour avviato manualmente dall'utente
 * @param {Object} state - State object con { lavoriTourOpenedModal }
 * @param {Function} updateState - Funzione per aggiornare lo state
 * @param {Function} openCreaModalCallback - Callback per aprire modal crea
 * @param {Function} closeLavoroModalCallback - Callback per chiudere modal
 * @param {boolean} hasParcoMacchineModule - Se il modulo Parco Macchine è attivo
 */
export function startLavoriTour(
    triggeredManually,
    state,
    updateState,
    openCreaModalCallback,
    closeLavoroModalCallback,
    hasParcoMacchineModule
) {
    if (typeof introJs === 'undefined') {
        if (triggeredManually) {
            alert('Tour non disponibile al momento. Riprova più tardi.');
        }
        return;
    }

    const modal = document.getElementById('lavoro-modal');
    const modalAlreadyOpen = modal && modal.classList.contains('active');
    
    // NON apriamo il modal all'inizio - lo apriremo solo quando necessario (step del form)
    // Chiudiamo il modal se è già aperto per vedere gli step iniziali
    if (modalAlreadyOpen && closeLavoroModalCallback) {
        closeLavoroModalCallback(state, updateState);
    }
    
    updateState({ lavoriTourOpenedModal: false });
    
    // Avvia il tour senza aprire il modal
    setTimeout(() => {
        startLavoriTourWithSteps(modalAlreadyOpen, state, updateState, openCreaModalCallback, closeLavoroModalCallback, hasParcoMacchineModule);
    }, 300);
}

/**
 * Avvia tour con step
 * @param {boolean} modalAlreadyOpen - Se il modal era già aperto
 * @param {Object} state - State object
 * @param {Function} updateState - Funzione per aggiornare lo state
 * @param {Function} openCreaModalCallback - Callback per aprire modal crea
 * @param {Function} closeLavoroModalCallback - Callback per chiudere modal
 * @param {boolean} hasParcoMacchineModule - Se il modulo Parco Macchine è attivo
 */
/**
 * Costruisce gli step del tour per gestione lavori
 * @param {boolean} hasParcoMacchineModule - Se il modulo Parco Macchine è attivo
 * @returns {Array} Array di step per il tour
 */
export function buildLavoriTourSteps(hasParcoMacchineModule) {
    const steps = [];

    const header = document.querySelector('.header');
    if (header) {
        steps.push({
            element: header,
            title: 'Gestione Lavori',
            intro: 'Qui pianifichi, assegni e monitori tutte le attività. Puoi sempre tornare alla dashboard o aprire le guide.'
        });
    }

    const stats = document.querySelector('[data-tour-section="lavori-stats"]');
    if (stats) {
        steps.push({
            element: stats,
            title: 'Statistiche rapide',
            intro: 'Lavori totali, in corso, ore validate e superficie lavorata: controlla questi numeri per capire dove intervenire.'
        });
    }

    const filters = document.querySelector('[data-tour-section="lavori-filters"]');
    if (filters) {
        steps.push({
            element: filters,
            title: 'Filtri combinabili',
            intro: 'Combina stato, progresso, caposquadra e terreno per isolare esattamente i lavori da analizzare. Usa "Pulisci filtri" per ripartire.'
        });
    }

    const count = document.getElementById('lavori-count');
    if (count) {
        steps.push({
            element: count,
            title: 'Quanti lavori stai vedendo',
            intro: 'Il contatore riflette i filtri correnti: utile per capire l\'ampiezza della selezione (es. lavori in ritardo).'
        });
    }

    const approvazione = document.querySelector('[data-tour-section="lavori-approvazione"]');
    if (approvazione) {
        steps.push({
            element: approvazione,
            title: 'Lavori da approvare',
            intro: 'Quando i capisquadra completano un lavoro passa di qui: approva o rifiuta, oppure apri i dettagli per verificare i progressi.'
        });
    }

    const list = document.querySelector('[data-tour-section="lavori-list"]');
    if (list) {
        steps.push({
            element: list,
            title: 'Elenco lavori',
            intro: 'Ogni riga mostra terreno, caposquadra, progressi, stato e azioni. Passa sulle icone per leggere note e dettagli.'
        });
    }

    const progressExample = document.querySelector('.progress-bar-inline');
    if (progressExample) {
        steps.push({
            element: progressExample,
            title: 'Progressi tracciati',
            intro: 'La barra confronta superficie lavorata con quella totale. Se è corta o rossa, significa che il lavoro è in ritardo.'
        });
    }

    const actionButtons = document.querySelector('.action-buttons');
    if (actionButtons) {
        steps.push({
            element: actionButtons,
            title: 'Azioni rapide',
            intro: 'Dettagli, Modifica ed Elimina sono sempre qui. Usa il dettaglio per aprire la mappa e vedere zone e ore lavorate.'
        });
    }

    // Cerca il form nel modal (il modal verrà aperto quando necessario durante il tour)
    const modal = document.getElementById('lavoro-modal');
    const form = modal ? modal.querySelector('[data-tour-section="lavoro-form"]') : null;
    // Aggiungiamo gli step del form anche se il modal non è aperto - verrà aperto durante il tour
    if (form) {
        steps.push({
            element: form,
            title: 'Modulo lavoro',
            intro: 'Compila nome, durata, note e scegli categoria/sottocategoria → tipo lavoro. I pulsanti "+" aprono i moduli per creare nuove voci.'
        });

        const assegnazione = form.querySelector('input[name="tipo-assegnazione"]')?.closest('.form-group');
        if (assegnazione) {
            steps.push({
                element: assegnazione,
                title: 'Assegna a squadra o autonomo',
                intro: 'Decidi se assegnare il lavoro a un caposquadra con la sua squadra oppure direttamente a un operaio autonomo.'
            });
        }

        const macchinaSection = hasParcoMacchineModule ? document.getElementById('macchina-section') : null;
        if (macchinaSection) {
            steps.push({
                element: macchinaSection,
                title: 'Integrazione Parco Macchine',
                intro: 'Collega il trattore e l\'attrezzo da utilizzare. I dropdown mostrano solo i mezzi disponibili e compatibili.'
            });
        }
    }

    // Ultimo step: usa le statistiche come elemento target (sono subito dopo l'header)
    const statsSection = document.querySelector('[data-tour-section="lavori-stats"]');
    if (statsSection) {
        steps.push({
            element: statsSection,
            title: 'Serve altro?',
            intro: 'Per procedure passo-passo e best practice apri il portale 📘 Guide e leggi "Gestione Lavori" o "Modulo Manodopera".'
        });
    }

    return steps;
}

function startLavoriTourWithSteps(
    modalAlreadyOpen,
    state,
    updateState,
    openCreaModalCallback,
    closeLavoroModalCallback,
    hasParcoMacchineModule
) {
    const steps = buildLavoriTourSteps(hasParcoMacchineModule);
    
    if (!steps.length) {
        if (!modalAlreadyOpen && state.lavoriTourOpenedModal && closeLavoroModalCallback) {
            closeLavoroModalCallback(state, updateState);
        }
        return;
    }

    // Funzione per forzare il posizionamento corretto del tooltip
    function ensureTooltipVisible() {
        setTimeout(() => {
            const tooltip = document.querySelector('.introjs-tooltip');
            const highlightedElement = document.querySelector('.introjs-showElement');
            
            if (!tooltip) return;
            
            const rect = tooltip.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const tooltipHeight = rect.height;
            const tooltipWidth = rect.width;
            
            const isMobile = viewportWidth < 768;
            const isTablet = viewportWidth >= 768 && viewportWidth < 1024;
            const margin = isMobile ? 30 : (isTablet ? 25 : 20);
            
            const currentTop = parseInt(tooltip.style.top) || rect.top;
            const currentLeft = parseInt(tooltip.style.left) || rect.left;
            
            let newTop = currentTop;
            if (rect.top < margin) {
                newTop = margin;
                tooltip.style.top = newTop + 'px';
                tooltip.style.bottom = 'auto';
            } else if (rect.bottom > viewportHeight - margin) {
                newTop = viewportHeight - tooltipHeight - margin;
                tooltip.style.top = newTop + 'px';
                tooltip.style.bottom = 'auto';
            }
            
            let newLeft = currentLeft;
            if (rect.left < margin) {
                newLeft = margin;
                tooltip.style.left = newLeft + 'px';
                tooltip.style.right = 'auto';
            } else if (rect.right > viewportWidth - margin) {
                newLeft = viewportWidth - tooltipWidth - margin;
                tooltip.style.left = newLeft + 'px';
                tooltip.style.right = 'auto';
            }
            
            if (isMobile && tooltipWidth > viewportWidth - (margin * 2)) {
                tooltip.style.left = margin + 'px';
                tooltip.style.right = margin + 'px';
                tooltip.style.width = 'auto';
                tooltip.style.maxWidth = (viewportWidth - (margin * 2)) + 'px';
            }
            
            if (highlightedElement) {
                const elementRect = highlightedElement.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();
                
                const tooltipCoversElement = !(
                    tooltipRect.bottom < elementRect.top ||
                    tooltipRect.top > elementRect.bottom ||
                    tooltipRect.right < elementRect.left ||
                    tooltipRect.left > elementRect.right
                );
                
                if (tooltipCoversElement) {
                    setTimeout(() => {
                        ensureTooltipVisible();
                    }, 100);
                }
            }
        }, 150);
    }

    const tour = introJs().setOptions({
        steps,
        showProgress: true,
        showBullets: false,
        exitOnOverlayClick: true,
        nextLabel: 'Avanti',
        prevLabel: 'Indietro',
        skipLabel: '×',
        doneLabel: 'Fatto',
        scrollToElement: false,
        scrollPadding: 50,
        tooltipClass: 'customTooltip',
        highlightClass: 'customHighlight'
    });

    tour.onstart(() => {
        setTimeout(() => {
            ensureTooltipVisible();
            const tooltip = document.querySelector('.introjs-tooltip');
            const overlay = document.querySelector('.introjs-overlay');
            const helperLayer = document.querySelector('.introjs-helperLayer');
            if (tooltip) {
                tooltip.style.zIndex = '99999';
                tooltip.style.position = 'absolute';
                tooltip.style.background = 'linear-gradient(135deg, #2E8B57 0%, #228B22 100%)';
                tooltip.style.color = 'rgba(255,255,255,0.95)';
                tooltip.style.borderRadius = '18px';
                tooltip.style.border = 'none';
                tooltip.style.boxShadow = '0 25px 55px rgba(15, 23, 42, 0.35)';
                tooltip.style.maxWidth = '380px';
                tooltip.style.fontSize = '15px';
                tooltip.style.lineHeight = '1.6';
                tooltip.style.padding = '22px 26px 20px';
                tooltip.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
            }
            if (overlay) {
                overlay.style.zIndex = '99998';
            }
            if (helperLayer) {
                helperLayer.style.zIndex = '99998';
            }
        }, 100);
    });

    let lastScrollTime = 0;
    const SCROLL_DEBOUNCE = 500;
    
    tour.onchange((targetElement) => {
        if (!targetElement) return;
        
        const isFormStep = targetElement.closest('#lavoro-modal') !== null || 
                          targetElement.closest('[data-tour-section="lavoro-form"]') !== null;
        
        if (isFormStep) {
            const modal = document.getElementById('lavoro-modal');
            const modalIsOpen = modal && modal.classList.contains('active');
            if (!modalIsOpen && openCreaModalCallback) {
                openCreaModalCallback(state, updateState);
                updateState({ lavoriTourOpenedModal: true });
            }
        }
        
        setTimeout(() => {
            ensureTooltipVisible();
        }, 200);
    });

    tour.oncomplete(() => {
        localStorage.setItem(LAVORI_TOUR_STORAGE_KEY, 'true');
        if (state.lavoriTourOpenedModal && closeLavoroModalCallback) {
            closeLavoroModalCallback(state, updateState);
        }
    });

    tour.onexit(() => {
        if (state.lavoriTourOpenedModal && closeLavoroModalCallback) {
            closeLavoroModalCallback(state, updateState);
        }
    });

    tour.start();
}




