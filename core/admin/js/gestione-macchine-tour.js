/**
 * Gestione Macchine Tour - Tour interattivo per gestione macchine
 * 
 * @module core/admin/js/gestione-macchine-tour
 */

// ============================================
// COSTANTI
// ============================================
const MACCHINE_TOUR_STORAGE_KEY = 'gfv_macchine_tour_v1';

// ============================================
// FUNZIONI SETUP TOUR
// ============================================

/**
 * Setup bottone tour
 * @param {Function} startMacchineTourCallback - Callback per avviare tour
 */
export function setupMacchineTourButton(startMacchineTourCallback) {
    const tourButton = document.getElementById('macchine-tour-button');
    if (tourButton && startMacchineTourCallback) {
        tourButton.addEventListener('click', () => startMacchineTourCallback(true));
    }
}

/**
 * Avvia tour automatico se non visto prima
 * @param {Function} startMacchineTourCallback - Callback per avviare tour
 * @param {Object} state - State object con macchineTourAutoRequested
 * @param {Function} updateState - Funzione per aggiornare state
 */
export function maybeAutoStartMacchineTour(startMacchineTourCallback, state, updateState) {
    if (state.macchineTourAutoRequested) return;
    
    try {
        const hasSeen = localStorage.getItem(MACCHINE_TOUR_STORAGE_KEY);
        if (!hasSeen && startMacchineTourCallback) {
            updateState({ macchineTourAutoRequested: true });
            setTimeout(() => startMacchineTourCallback(false), 2000);
        }
    } catch (error) {
        // Ignora errori localStorage
    }
}

/**
 * Avvia tour macchine
 * @param {boolean} triggeredManually - Se true, il tour è stato avviato manualmente
 * @param {Function} closeMacchinaModalCallback - Callback per chiudere modal
 */
export function startMacchineTour(triggeredManually, closeMacchinaModalCallback) {
    if (typeof introJs === 'undefined') {
        if (triggeredManually) {
            alert('Tour non disponibile al momento. Riprova più tardi.');
        }
        return;
    }

    const modal = document.getElementById('macchina-modal');
    const modalAlreadyOpen = modal && modal.classList.contains('active');
    
    // NON apriamo il modal all'inizio - lo apriremo solo quando necessario (step del form)
    // Chiudiamo il modal se è già aperto per vedere gli step iniziali
    if (modalAlreadyOpen && closeMacchinaModalCallback) {
        closeMacchinaModalCallback();
    }
    
    let macchineTourOpenedModal = false; // Non abbiamo aperto il modal noi
    
    // Avvia il tour senza aprire il modal
    setTimeout(() => {
        startMacchineTourWithSteps(modalAlreadyOpen, macchineTourOpenedModal, closeMacchinaModalCallback);
    }, 300);
}

/**
 * Avvia tour con step
 * @param {boolean} modalAlreadyOpen - Se il modal era già aperto
 * @param {boolean} macchineTourOpenedModal - Se abbiamo aperto il modal noi
 * @param {Function} closeMacchinaModalCallback - Callback per chiudere modal
 * @param {Function} openMacchinaModalCallback - Callback per aprire modal
 */
function startMacchineTourWithSteps(modalAlreadyOpen, macchineTourOpenedModal, closeMacchinaModalCallback, openMacchinaModalCallback) {
    const steps = buildMacchineTourSteps();
    if (!steps.length) {
        if (!modalAlreadyOpen && closeMacchinaModalCallback) {
            closeMacchinaModalCallback();
        }
        return;
    }

    // Funzione per forzare il posizionamento corretto del tooltip in base alle dimensioni dello schermo
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
            
            // Se c'è un elemento evidenziato, assicurati che non sia coperto dal tooltip
            if (highlightedElement) {
                const elementRect = highlightedElement.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();
                
                // Controlla se il tooltip copre l'elemento evidenziato
                const tooltipCoversElement = !(
                    tooltipRect.bottom < elementRect.top ||
                    tooltipRect.top > elementRect.bottom ||
                    tooltipRect.right < elementRect.left ||
                    tooltipRect.left > elementRect.right
                );
                
                if (tooltipCoversElement) {
                    // Scrolla l'elemento in vista, lasciando spazio per il tooltip
                    highlightedElement.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center',
                        inline: 'nearest'
                    });
                    
                    // Dopo lo scroll, riposiziona il tooltip se necessario
                    setTimeout(() => {
                        ensureTooltipVisible();
                    }, 300);
                }
            }
        }, 150);
    }

    const tour = introJs.tour().setOptions({
        steps,
        showProgress: true,
        showBullets: false,
        exitOnOverlayClick: true,
        nextLabel: 'Avanti',
        prevLabel: 'Indietro',
        skipLabel: '×',
        doneLabel: 'Fatto',
        scrollToElement: true,
        scrollPadding: 50,
        tooltipClass: 'customTooltip',
        highlightClass: 'customHighlight'
    });

    // Assicurati che il tooltip sia visibile quando il tour inizia
    tour.onstart(() => {
        setTimeout(() => {
            ensureTooltipVisible();
            const tooltip = document.querySelector('.introjs-tooltip');
            if (tooltip) {
                tooltip.style.zIndex = '99999';
                tooltip.style.position = 'absolute';
            }
        }, 100);
    });

    // Gestisci scroll e posizionamento durante il tour
    tour.onchange((targetElement) => {
        if (!targetElement) return;
        
        // Controlla se lo step corrente è nel modal (form)
        const isFormStep = targetElement.closest('#macchina-modal') !== null || 
                          targetElement.closest('[data-tour-section="macchina-form"]') !== null;
        
        // Se siamo agli step del form, apri il modal se non è già aperto
        if (isFormStep) {
            const modal = document.getElementById('macchina-modal');
            const modalIsOpen = modal && modal.classList.contains('active');
            if (!modalIsOpen && openMacchinaModalCallback) {
                openMacchinaModalCallback();
                macchineTourOpenedModal = true;
                // Aspetta che il modal sia aperto prima di continuare
                setTimeout(() => {
                    if (targetElement && typeof targetElement.scrollIntoView === 'function') {
                        targetElement.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center',
                            inline: 'nearest'
                        });
                    }
                    ensureTooltipVisible();
                }, 400);
            }
        } else {
            // Se NON siamo agli step del form, chiudi il modal se l'abbiamo aperto noi
            const modal = document.getElementById('macchina-modal');
            const modalIsOpen = modal && modal.classList.contains('active');
            if (modalIsOpen && macchineTourOpenedModal && closeMacchinaModalCallback) {
                closeMacchinaModalCallback();
                // Aspetta che il modal sia chiuso prima di continuare
                setTimeout(() => {
                    if (targetElement && typeof targetElement.scrollIntoView === 'function') {
                        targetElement.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center',
                            inline: 'nearest'
                        });
                    }
                    ensureTooltipVisible();
                }, 300);
            }
        }
        
        // Scroll l'elemento in vista con un piccolo delay
        setTimeout(() => {
            if (targetElement && typeof targetElement.scrollIntoView === 'function') {
                targetElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                });
            }
            // Forza il tooltip a essere visibile e sopra il modal
            ensureTooltipVisible();
            const tooltip = document.querySelector('.introjs-tooltip');
            if (tooltip) {
                tooltip.style.zIndex = '99999';
            }
            
            // Forza il refresh dell'overlay di Intro.js per correggere il posizionamento
            setTimeout(() => {
                const helperLayer = document.querySelector('.introjs-helperLayer');
                if (helperLayer && targetElement) {
                    // Forza il ricalcolo del posizionamento
                    const rect = targetElement.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        // L'elemento è visibile, forza il refresh
                        helperLayer.style.display = 'none';
                        setTimeout(() => {
                            helperLayer.style.display = '';
                        }, 10);
                    }
                }
            }, 200);
        }, 150);
    });

    // Assicurati che il tooltip sia visibile quando viene mostrato
    tour.onafterchange((targetElement) => {
        ensureTooltipVisible();
        
        // Forza il refresh dell'overlay dopo che il tooltip è stato posizionato
        if (targetElement) {
            // Funzione per forzare il refresh dell'overlay
            function refreshOverlay() {
                const helperLayer = document.querySelector('.introjs-helperLayer');
                if (!helperLayer || !targetElement) return;
                
                const targetRect = targetElement.getBoundingClientRect();
                
                // Verifica che l'elemento sia visibile e abbia dimensioni valide
                if (targetRect.width > 0 && targetRect.height > 0) {
                    // Forza il ricalcolo dell'overlay usando le coordinate dell'elemento target
                    helperLayer.style.width = targetRect.width + 'px';
                    helperLayer.style.height = targetRect.height + 'px';
                    helperLayer.style.top = (targetRect.top + window.scrollY) + 'px';
                    helperLayer.style.left = (targetRect.left + window.scrollX) + 'px';
                }
            }
            
            // Esegui il refresh più volte con delay crescenti per assicurarsi che funzioni
            setTimeout(refreshOverlay, 50);
            setTimeout(refreshOverlay, 150);
            setTimeout(refreshOverlay, 300);
            setTimeout(refreshOverlay, 500);
        }
    });

    tour.oncomplete(() => {
        if (!modalAlreadyOpen && macchineTourOpenedModal && closeMacchinaModalCallback) {
            closeMacchinaModalCallback();
        }
        try { localStorage.setItem(MACCHINE_TOUR_STORAGE_KEY, 'done'); } catch (error) {}
    });

    tour.onexit(() => {
        if (!modalAlreadyOpen && macchineTourOpenedModal && closeMacchinaModalCallback) {
            closeMacchinaModalCallback();
        }
        try { localStorage.setItem(MACCHINE_TOUR_STORAGE_KEY, 'done'); } catch (error) {}
    });

    tour.start();
}

/**
 * Costruisce step del tour
 * @returns {Array} Array di step per il tour
 */
function buildMacchineTourSteps() {
    const steps = [];

    const header = document.querySelector('.header');
    if (header) {
        steps.push({
            element: header,
            title: 'Gestione Parco Macchine',
            intro: 'Gestisci trattori e attrezzi dell\'azienda, monitora stati e pianifica manutenzioni.'
        });
    }

    const addButton = document.getElementById('nuova-macchina-button');
    if (addButton) {
        steps.push({
            element: addButton,
            title: 'Nuova macchina o attrezzo',
            intro: 'Apri il modulo per inserire una macchina. Scegli il tipo (trattore o attrezzo), inserisci marca/modello e imposta lo stato.'
        });
    }

    const filters = document.querySelector('[data-tour-section="macchine-filters"]');
    if (filters) {
        steps.push({
            element: filters,
            title: 'Filtri rapidi',
            intro: 'Filtra per stato, tipo, categoria e visualizza solo macchine attive. Usa "Pulisci filtri" per tornare alla vista completa.'
        });
    }

    const lista = document.querySelector('[data-tour-section="macchine-list"]');
    if (lista) {
        steps.push({
            element: lista,
            title: 'Elenco macchine',
            intro: 'La tabella mostra stato, ore, manutenzioni e compatibilità. Usa i pulsanti Modifica/Elimina per intervenire rapidamente.'
        });
    }

    const form = document.querySelector('[data-tour-section="macchina-form"]');
    // Aggiungiamo lo step del form anche se il modal non è aperto - verrà aperto durante il tour
    if (form) {
        steps.push({
            element: form,
            title: 'Modulo dettagli',
            intro: 'Il modulo è dinamico: per i trattori inserisci cavalli e dati tecnici, per gli attrezzi scegli la categoria e i CV minimi richiesti.'
        });
    }

    steps.push({
        title: 'Approfondisci',
        intro: 'Trovi procedure complete e best practice nella guida "Parco Macchine". Clicca su 📘 Guide dalla dashboard per aprirla.'
    });

    return steps;
}

// Export funzione per avviare tour con step (per uso interno)
export { startMacchineTourWithSteps };

