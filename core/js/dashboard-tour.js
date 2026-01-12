/**
 * Dashboard Tour - Logica tour interattivo per dashboard
 * 
 * @module core/js/dashboard-tour
 */

// ============================================
// CONSTANTS
// ============================================
const TOUR_STORAGE_KEY = 'gfv_dashboard_tour_v1';

// ============================================
// FUNZIONI PRINCIPALI
// ============================================

/**
 * Setup bottone tour e auto-start se necessario
 * @param {Object} userData - Dati utente con ruoli
 * @param {Function} startDashboardTourCallback - Callback per avviare tour
 */
export function setupDashboardTour(userData, startDashboardTourCallback) {
    try {
        const tourButton = document.getElementById('dashboard-tour-button');
        if (tourButton && startDashboardTourCallback) {
            tourButton.onclick = () => startDashboardTourCallback(userData, true);
        }

        const hasRoles = Array.isArray(userData.ruoli) && userData.ruoli.length > 0;
        const hasSeenTour = localStorage.getItem(TOUR_STORAGE_KEY);

        if (!hasSeenTour && hasRoles && startDashboardTourCallback) {
            setTimeout(() => startDashboardTourCallback(userData, false), 2200);
        }
    } catch (error) {
        console.warn('Tour onboarding non disponibile:', error);
    }
}

/**
 * Avvia tour dashboard
 * @param {Object} userData - Dati utente
 * @param {boolean} triggeredManually - Se true, tour avviato manualmente
 */
export function startDashboardTour(userData, triggeredManually) {
    if (typeof introJs === 'undefined') {
        if (triggeredManually) {
            alert('Tour non disponibile al momento. Riprova più tardi.');
        }
        return;
    }

    const steps = buildDashboardTourSteps(userData);
    if (!steps.length) {
        if (triggeredManually) {
            alert('Tour non disponibile per questa vista.');
        }
        return;
    }

    // Avvia il tour con gli step
    setTimeout(() => {
        startDashboardTourWithSteps(userData);
    }, 300);
}

/**
 * Avvia tour con step configurati
 * @param {Object} userData - Dati utente
 */
function startDashboardTourWithSteps(userData) {
    const steps = buildDashboardTourSteps(userData || {});
    
    if (!steps.length) {
        return;
    }

    // Flag per evitare loop infiniti
    let isRepositioning = false;
    let ensureTooltipCallCount = 0;
    let lastCallTime = 0;
    const MAX_ENSURE_CALLS = 3; // Massimo 3 chiamate consecutive
    const CALL_RESET_TIME = 500; // Reset contatore dopo 500ms di inattività
    let isMappaStepActive = false; // Flag per preservare position: fixed per mappa
    let scrollListener = null; // Listener per mantenere tooltip fisso durante scroll
    
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
            
            // Se siamo nello step della mappa, preserva position: fixed
            if (isMappaStepActive) {
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
            
            // Se siamo nello step della mappa con position: fixed, centra il tooltip nel viewport
            if (isMappaStepActive) {
                // Usa le dimensioni reali del tooltip (offsetHeight/Width sono più affidabili per elementi fixed)
                const realTooltipHeight = tooltip.offsetHeight || tooltipHeight || 350;
                const realTooltipWidth = tooltip.offsetWidth || tooltipWidth || 400;
                
                // Centra verticalmente e orizzontalmente nel viewport
                const centerTop = (viewportHeight - realTooltipHeight) / 2;
                const centerLeft = (viewportWidth - realTooltipWidth) / 2;
                
                // Assicurati che sia dentro il viewport con margini adeguati
                // Usa margini più grandi per schermi grandi
                const safeMargin = Math.max(margin, Math.min(viewportHeight * 0.05, 50));
                const newTop = Math.max(safeMargin, Math.min(centerTop, viewportHeight - realTooltipHeight - safeMargin));
                const newLeft = Math.max(safeMargin, Math.min(centerLeft, viewportWidth - realTooltipWidth - safeMargin));
                
                tooltip.style.setProperty('top', newTop + 'px', 'important');
                tooltip.style.setProperty('left', newLeft + 'px', 'important');
                tooltip.style.setProperty('bottom', 'auto', 'important');
                tooltip.style.setProperty('right', 'auto', 'important');
                tooltip.style.setProperty('transform', 'none', 'important');
                tooltip.style.setProperty('position', 'fixed', 'important');
                tooltip.style.setProperty('z-index', '9999999', 'important');
            } else {
                // Per gli altri step, usa la logica normale
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
            }
            
            // FORZA anche il tooltipReferenceLayer ad avere position absolute/fixed e z-index alto
            const tooltipReferenceLayer = document.querySelector('.introjs-tooltipReferenceLayer');
            if (tooltipReferenceLayer) {
                if (isMappaStepActive) {
                    tooltipReferenceLayer.style.setProperty('position', 'fixed', 'important');
                    tooltipReferenceLayer.style.setProperty('z-index', '9999999', 'important');
                } else {
                    tooltipReferenceLayer.style.setProperty('position', 'absolute', 'important');
                    tooltipReferenceLayer.style.setProperty('z-index', '999999', 'important');
                }
            }
            
            // Se c'è un elemento evidenziato, assicurati che non sia coperto dal tooltip
            if (highlightedElement) {
                const elementRect = highlightedElement.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();
                const elementHeight = elementRect.height;
                const elementWidth = elementRect.width;
                const viewportHeight = window.innerHeight;
                const viewportWidth = window.innerWidth;
                
                // Se l'elemento è molto grande (più grande del viewport), forza lo scroll all'inizio dell'elemento
                if (elementHeight > viewportHeight * 0.8) {
                    highlightedElement.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start', // Scroll all'inizio invece di center
                        inline: 'nearest'
                    });
                    
                    // Dopo lo scroll, riposiziona il tooltip
                    setTimeout(() => {
                        ensureTooltipVisible();
                    }, 400);
                }
                
                // Controlla se il tooltip copre l'elemento evidenziato
                const tooltipCoversElement = !(
                    tooltipRect.bottom < elementRect.top ||
                    tooltipRect.top > elementRect.bottom ||
                    tooltipRect.right < elementRect.left ||
                    tooltipRect.left > elementRect.right
                );
                
                // Per la mappa, non fare scroll se il tooltip copre l'elemento (è normale)
                if (tooltipCoversElement && !isRepositioning && ensureTooltipCallCount <= 1 && !isMappaStepActive) {
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
                
                // Se non siamo nello step mappa, verifica se il tooltip è fuori dal viewport
                if (!isMappaStepActive && highlightedElement) {
                    const elementRect = highlightedElement.getBoundingClientRect();
                    const tooltipRect = tooltip.getBoundingClientRect();
                    const viewportHeight = window.innerHeight;
                    const viewportWidth = window.innerWidth;
                    
                    // Verifica se il tooltip è completamente fuori dal viewport
                    const tooltipOutOfViewport = 
                        tooltipRect.bottom < 0 || 
                        tooltipRect.top > viewportHeight ||
                        tooltipRect.right < 0 ||
                        tooltipRect.left > viewportWidth;
                    
                    // Verifica se il tooltip è parzialmente fuori dal viewport
                    const tooltipPartiallyOut = 
                        tooltipRect.top < 0 ||
                        tooltipRect.bottom > viewportHeight ||
                        tooltipRect.left < 0 ||
                        tooltipRect.right > viewportWidth;
                    
                    if (tooltipOutOfViewport) {
                        // Forza scroll dell'elemento e riposizionamento
                        highlightedElement.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'start', // Scroll all'inizio per elementi grandi
                            inline: 'nearest'
                        });
                        
                        setTimeout(() => {
                            ensureTooltipVisible();
                        }, 400);
                    } else if (tooltipPartiallyOut) {
                        // Correggi la posizione del tooltip
                        if (tooltipRect.top < 0) {
                            tooltip.style.setProperty('top', '20px', 'important');
                        }
                        if (tooltipRect.bottom > viewportHeight) {
                            const newTop = viewportHeight - tooltipRect.height - 20;
                            tooltip.style.setProperty('top', newTop + 'px', 'important');
                        }
                        if (tooltipRect.left < 0) {
                            tooltip.style.setProperty('left', '20px', 'important');
                        }
                        if (tooltipRect.right > viewportWidth) {
                            const newLeft = viewportWidth - tooltipRect.width - 20;
                            tooltip.style.setProperty('left', newLeft + 'px', 'important');
                        }
                    }
                    
                    // Se il tooltip è sopra l'elemento e l'elemento è molto in basso nella pagina, forza lo scroll
                    if (tooltipRect.bottom < elementRect.top && elementRect.top > viewportHeight * 0.5) {
                        highlightedElement.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'start', // Per elementi grandi, scroll all'inizio
                            inline: 'nearest'
                        });
                    }
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
        scrollToElement: true, // Scroll automatico agli elementi
        scrollPadding: 50, // Padding maggiore per lo scroll
        tooltipClass: 'customTooltip',
        highlightClass: 'customHighlight'
    });

    // Assicurati che il tooltip sia visibile quando il tour inizia
    tour.onstart(() => {
        setTimeout(() => {
            ensureTooltipVisible();
            const tooltip = document.querySelector('.introjs-tooltip');
            const overlay = document.querySelector('.introjs-overlay');
            const helperLayer = document.querySelector('.introjs-helperLayer');
            const tooltipReferenceLayer = document.querySelector('.introjs-tooltipReferenceLayer');
            
            if (tooltip) {
                // FORZA position: absolute con !important
                tooltip.style.setProperty('position', 'absolute', 'important');
                tooltip.style.setProperty('z-index', '999999', 'important');
                
                // Forza stili uniformi
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
            
            if (tooltipReferenceLayer) {
                tooltipReferenceLayer.style.setProperty('position', 'absolute', 'important');
                tooltipReferenceLayer.style.setProperty('z-index', '999999', 'important');
            }
            
            if (overlay) {
                overlay.style.zIndex = '999998';
            }
            if (helperLayer) {
                helperLayer.style.zIndex = '999998';
            }
        }, 100);
    });

    // Gestisci scroll e posizionamento durante il tour
    tour.onchange((targetElement) => {
        if (!targetElement) {
            console.warn('⚠️ [TOUR DEBUG] onchange: targetElement è null');
            return;
        }
        
        // Verifica se stiamo passando da step mappa a step normale
        const wasMappaStep = isMappaStepActive;
        const isMappaStepNow = targetElement && (
            targetElement.closest('[data-tour-section="mappa"]') ||
            targetElement.querySelector('[data-tour-section="mappa"]') ||
            (targetElement.getAttribute && targetElement.getAttribute('data-tour-section') === 'mappa') ||
            (targetElement.classList && targetElement.classList.contains('dashboard-section') && 
             (targetElement.querySelector('[data-tour-section="mappa"]') || 
              targetElement.querySelector('.mappa-container')))
        );
        
        // Se passiamo da mappa a normale, rimuovi le proprietà fixed
        if (wasMappaStep && !isMappaStepNow) {
            const tooltip = document.querySelector('.introjs-tooltip');
            if (tooltip) {
                // Rimuovi tutte le proprietà che potrebbero interferire
                tooltip.style.removeProperty('top');
                tooltip.style.removeProperty('left');
                tooltip.style.removeProperty('transform');
                tooltip.style.setProperty('position', 'absolute', 'important');
                tooltip.style.setProperty('z-index', '999999', 'important');
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
            
            // FORZA position e z-index PRIMA di ensureTooltipVisible
            const tooltip = document.querySelector('.introjs-tooltip');
            const tooltipReferenceLayer = document.querySelector('.introjs-tooltipReferenceLayer');
            
            if (tooltip) {
                // Se non siamo nello step mappa, forza absolute
                if (!isMappaStepNow) {
                    tooltip.style.setProperty('position', 'absolute', 'important');
                    tooltip.style.setProperty('z-index', '999999', 'important');
                }
            }
            
            if (tooltipReferenceLayer) {
                if (!isMappaStepNow) {
                    tooltipReferenceLayer.style.setProperty('position', 'absolute', 'important');
                    tooltipReferenceLayer.style.setProperty('z-index', '999999', 'important');
                }
            }
            
            // Forza il tooltip a essere visibile
            ensureTooltipVisible();

            // Forza il refresh dell'overlay di Intro.js per correggere il posizionamento
            // Questo è importante quando si naviga avanti perché l'elemento potrebbe non essere ancora completamente renderizzato
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
        // Se è lo step della mappa, forza il tooltip sopra la mappa
        // Verifica anche se l'elemento è dentro una sezione dashboard che contiene la mappa
        let isMappaStep = false;
        
        if (targetElement) {
            // Verifica direttamente l'attributo data-tour-section
            const tourSection = targetElement.getAttribute && targetElement.getAttribute('data-tour-section');
            if (tourSection === 'mappa') {
                isMappaStep = true;
            }
            
            // Verifica se l'elemento contiene o è dentro [data-tour-section="mappa"]
            if (!isMappaStep) {
                const mappaParent = targetElement.closest('[data-tour-section="mappa"]');
                const mappaChild = targetElement.querySelector('[data-tour-section="mappa"]');
                if (mappaParent || mappaChild) {
                    isMappaStep = true;
                }
            }
            
            // Verifica se l'elemento è un dashboard-section che contiene la mappa
            if (!isMappaStep && targetElement.classList && targetElement.classList.contains('dashboard-section')) {
                const hasMappaSection = targetElement.querySelector('[data-tour-section="mappa"]');
                const hasMappaContainer = targetElement.querySelector('.mappa-container');
                if (hasMappaSection || hasMappaContainer) {
                    isMappaStep = true;
                }
            }
            
            // Verifica anche se l'elemento è dentro un container che ha la mappa
            if (!isMappaStep) {
                const parent = targetElement.parentElement;
                if (parent) {
                    const parentMappa = parent.closest('[data-tour-section="mappa"]');
                    if (parentMappa) {
                        isMappaStep = true;
                    }
                }
            }
        }
        
        // Imposta il flag per preservare position: fixed
        isMappaStepActive = !!isMappaStep;
        
        // FORZA position e z-index PRIMA di tutto
        const tooltip = document.querySelector('.introjs-tooltip');
        const tooltipReferenceLayer = document.querySelector('.introjs-tooltipReferenceLayer');
        
        if (tooltip) {
            if (isMappaStep) {
                // Forza z-index ancora più alto e assicurati che sia sopra tutto
                tooltip.style.setProperty('z-index', '9999999', 'important');
                tooltip.style.setProperty('position', 'fixed', 'important'); // Usa fixed per essere sicuro che sia sopra tutto
                // Reset contatore per permettere nuove chiamate per questo step
                ensureTooltipCallCount = 0;
                
                // Rimuovi listener precedente se esiste
                if (scrollListener) {
                    window.removeEventListener('scroll', scrollListener, true);
                    window.removeEventListener('wheel', scrollListener, true);
                }
                
                // Crea nuovo listener per mantenere tooltip fisso durante scroll
                scrollListener = function() {
                    if (isMappaStepActive) {
                        const tooltip = document.querySelector('.introjs-tooltip');
                        const tooltipReferenceLayer = document.querySelector('.introjs-tooltipReferenceLayer');
                        
                        if (tooltip) {
                            const viewportHeight = window.innerHeight;
                            const viewportWidth = window.innerWidth;
                            
                            // Usa le dimensioni reali del tooltip (offsetHeight/Width sono più affidabili)
                            const realTooltipHeight = tooltip.offsetHeight || 350;
                            const realTooltipWidth = tooltip.offsetWidth || 400;
                            
                            // Margini adeguati per schermi grandi
                            const safeMargin = Math.max(20, Math.min(viewportHeight * 0.05, 50));
                            
                            // Mantieni il tooltip centrato nel viewport
                            const centerTop = (viewportHeight - realTooltipHeight) / 2;
                            const centerLeft = (viewportWidth - realTooltipWidth) / 2;
                            
                            const newTop = Math.max(safeMargin, Math.min(centerTop, viewportHeight - realTooltipHeight - safeMargin));
                            const newLeft = Math.max(safeMargin, Math.min(centerLeft, viewportWidth - realTooltipWidth - safeMargin));
                            
                            tooltip.style.setProperty('position', 'fixed', 'important');
                            tooltip.style.setProperty('z-index', '9999999', 'important');
                            tooltip.style.setProperty('top', newTop + 'px', 'important');
                            tooltip.style.setProperty('left', newLeft + 'px', 'important');
                            tooltip.style.setProperty('transform', 'none', 'important');
                        }
                        
                        // Mantieni anche il tooltipReferenceLayer fisso
                        if (tooltipReferenceLayer) {
                            tooltipReferenceLayer.style.setProperty('position', 'fixed', 'important');
                            tooltipReferenceLayer.style.setProperty('z-index', '9999999', 'important');
                        }
                    }
                };
                // Aggiungi listener per scroll e wheel
                window.addEventListener('scroll', scrollListener, true);
                window.addEventListener('wheel', scrollListener, true);
                
                // Forza anche il posizionamento iniziale con delay per assicurarsi che il tooltip sia renderizzato
                setTimeout(() => {
                    if (scrollListener && isMappaStepActive) {
                        scrollListener();
                        // Riposiziona anche dopo un breve delay per assicurarsi che le dimensioni siano corrette
                        setTimeout(() => {
                            if (scrollListener && isMappaStepActive) {
                                scrollListener();
                            }
                        }, 100);
                    }
                }, 150);
            } else {
                // Rimuovi listener se non siamo più nello step della mappa
                if (scrollListener) {
                    window.removeEventListener('scroll', scrollListener, true);
                    window.removeEventListener('wheel', scrollListener, true);
                    scrollListener = null;
                }
                
                // FORZA position: absolute con !important
                tooltip.style.setProperty('position', 'absolute', 'important');
                tooltip.style.setProperty('z-index', '999999', 'important');
                
                // Se veniamo da uno step mappa (era fixed), forza il riposizionamento
                // Rimuovi eventuali posizioni fixed che potrebbero interferire
                tooltip.style.removeProperty('top');
                tooltip.style.removeProperty('left');
                tooltip.style.removeProperty('transform');
                
                // Reset flag per permettere scroll se necessario
                isRepositioning = false;
                ensureTooltipCallCount = 0;
            }
            
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
            
            const zIndexAfter = window.getComputedStyle(tooltip).zIndex;
            const positionAfter = window.getComputedStyle(tooltip).position;
            
            // Verifica se lo z-index è quello che ci aspettiamo
            // Per la mappa deve essere 9999999, per gli altri step 999999
            const expectedZIndex = isMappaStep ? '9999999' : '999999';
            if (zIndexAfter !== expectedZIndex && zIndexAfter !== expectedZIndex + 'px') {
                console.error('❌ [TOUR DEBUG] PROBLEMA: z-index non è', expectedZIndex, '! È:', zIndexAfter);
            }
            if (positionAfter !== 'absolute' && positionAfter !== 'fixed') {
                console.error('❌ [TOUR DEBUG] PROBLEMA: position non è absolute/fixed! È:', positionAfter);
            }
        }
        
        if (tooltipReferenceLayer) {
            if (isMappaStep) {
                tooltipReferenceLayer.style.setProperty('z-index', '9999999', 'important');
                tooltipReferenceLayer.style.setProperty('position', 'fixed', 'important');
            } else {
                tooltipReferenceLayer.style.setProperty('position', 'absolute', 'important');
                tooltipReferenceLayer.style.setProperty('z-index', '999999', 'important');
            }
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
        
        // Forza il refresh dell'overlay dopo che il tooltip è stato posizionato
        setTimeout(() => {
            const helperLayer = document.querySelector('.introjs-helperLayer');
            if (helperLayer && targetElement) {
                const targetRect = targetElement.getBoundingClientRect();
                if (targetRect.width > 0 && targetRect.height > 0) {
                    // Forza il ricalcolo dell'overlay usando le coordinate dell'elemento target
                    helperLayer.style.width = targetRect.width + 'px';
                    helperLayer.style.height = targetRect.height + 'px';
                    helperLayer.style.top = (targetRect.top + window.scrollY) + 'px';
                    helperLayer.style.left = (targetRect.left + window.scrollX) + 'px';
                }
            }
        }, 200);
    });

    tour.oncomplete(() => {
        // Reset flag quando il tour finisce
        isMappaStepActive = false;
        isRepositioning = false;
        ensureTooltipCallCount = 0;
        
        // Rimuovi listener scroll
        if (scrollListener) {
            window.removeEventListener('scroll', scrollListener, true);
            window.removeEventListener('wheel', scrollListener, true);
            scrollListener = null;
        }
        
        try { localStorage.setItem(TOUR_STORAGE_KEY, 'done'); } catch (error) {}
    });

    tour.onexit(() => {
        // Reset flag quando il tour viene chiuso
        isMappaStepActive = false;
        isRepositioning = false;
        ensureTooltipCallCount = 0;
        
        // Rimuovi listener scroll
        if (scrollListener) {
            window.removeEventListener('scroll', scrollListener, true);
            window.removeEventListener('wheel', scrollListener, true);
            scrollListener = null;
        }
        
        try { localStorage.setItem(TOUR_STORAGE_KEY, 'done'); } catch (error) {}
    });

    tour.start();
    
    // Assicurati che il tooltip sia visibile anche all'inizio
    setTimeout(() => {
        ensureTooltipVisible();
    }, 300);
}

/**
 * Costruisce array di step per il tour
 * @param {Object} userData - Dati utente
 * @returns {Array} Array di step per IntroJS
 */
function buildDashboardTourSteps(userData) {
    const steps = [];

    const header = document.querySelector('.dashboard-header');
    if (header) {
        steps.push({
            element: header,
            title: 'Dashboard Principale',
            intro: 'Qui trovi i tuoi dati, i ruoli assegnati e tutte le scorciatoie principali. Puoi sempre tornare qui dalla dashboard o aprire le guide.'
        });
    }

    const guideLink = document.querySelector('[data-tour="guide-link"]');
    if (guideLink) {
        steps.push({
            element: guideLink,
            title: 'Guide sempre disponibili',
            intro: 'Il portale documentazione ospita Primi Passi, FAQ e guide per ruolo/funzionalità. Trovi procedure complete per ogni modulo, incluso il Parco Macchine.'
        });
    }

    const tourButton = document.getElementById('dashboard-tour-button');
    if (tourButton) {
        steps.push({
            element: tourButton,
            title: 'Tour interattivo',
            intro: 'Puoi riaprire questo tour guidato in qualunque momento cliccando qui. Utile per rivedere le funzionalità disponibili.'
        });
    }

    const coreBase = document.querySelector('[data-tour-section="core-base"]');
    if (coreBase) {
        steps.push({
            element: coreBase,
            title: 'Sezione Core Base',
            intro: 'Da qui accedi a Terreni, Diario attività e statistiche rapide quando il modulo Manodopera non è attivo. Queste funzionalità sono sempre disponibili indipendentemente dai moduli aggiuntivi.'
        });
    }

    const panoramica = document.querySelector('[data-tour-section="panoramica"]');
    if (panoramica) {
        steps.push({
            element: panoramica,
            title: 'Panoramica aziendale',
            intro: 'Card rapide per Amministrazione, Statistiche e Terreni. La mappa aziendale è sempre visibile sulla destra: clicca sulle card per accedere alle sezioni dedicate.'
        });
    }

    const mappaSection = document.querySelector('[data-tour-section="mappa"]');
    if (mappaSection) {
        steps.push({
            element: mappaSection,
            title: 'Mappa Aziendale',
            intro: 'Visualizza tutti i terreni con confini geolocalizzati, zone lavorate e indicatori stato lavori. I filtri in alto ti permettono di concentrarti su un podere o una coltura specifica. Clicca su un terreno per vedere i dettagli.'
        });
    }

    const manodoperaSection = document.querySelector('[data-tour-section="gestione-manodopera"]');
    if (manodoperaSection) {
        steps.push({
            element: manodoperaSection,
            title: 'Gestione Manodopera',
            intro: 'Sezione dedicata a Manager e Amministratori per creare lavori, monitorare squadre, validare ore e vedere statistiche operative. Da qui accedi a tutte le funzionalità del modulo Manodopera.'
        });
    }

    const diarioSection = document.querySelector('[data-tour-section="diario"]');
    if (diarioSection) {
        steps.push({
            element: diarioSection,
            title: 'Diario da Lavori',
            intro: 'Riepilogo automatico delle attività generate dalle ore validate dai caposquadra. Utile per controllare l\'avanzamento reale dei lavori senza dover aprire ogni singolo dettaglio.'
        });
    }

    const caposquadraSection = document.querySelector('[data-tour-section="caposquadra"]');
    if (caposquadraSection) {
        steps.push({
            element: caposquadraSection,
            title: 'Dashboard Caposquadra',
            intro: 'Qui il caposquadra gestisce comunicazioni rapide alla squadra, valida le ore degli operai e può controllare i lavori assegnati. Le comunicazioni vengono notificate immediatamente agli operai.'
        });
    }

    const operaioSection = document.querySelector('[data-tour-section="operaio"]');
    if (operaioSection) {
        steps.push({
            element: operaioSection,
            title: 'Dashboard Operaio',
            intro: 'Qui gli operai trovano i lavori del giorno, le comunicazioni dal caposquadra e un riepilogo delle loro ore. Possono segnare le ore lavorate e confermare le comunicazioni di ritrovo.'
        });
    }

    const manutenzioniSection = document.getElementById('manutenzioni-scadenza-section');
    if (manutenzioniSection && window.getComputedStyle(manutenzioniSection).display !== 'none') {
        steps.push({
            element: manutenzioniSection,
            title: 'Modulo Parco Macchine',
            intro: 'Con il modulo Parco Macchine attivo controlli qui manutenzioni imminenti e guasti segnalati. Ogni segnalazione aggiorna automaticamente anche i lavori collegati alle macchine interessate.'
        });
    }

    // Ultimo step: usa le statistiche come elemento target (sono subito dopo l'header)
    const statsSection = document.querySelector('[data-tour-section="panoramica"]') || 
                        document.querySelector('[data-tour-section="mappa"]');
    if (statsSection) {
        steps.push({
            element: statsSection,
            title: 'Serve altro?',
            intro: 'Per workflow completi (Parco Macchine, Bilancio, Tenant) e procedure passo-passo approfondisci sempre nella sezione "📘 Guide". Buon lavoro!'
        });
    } else {
        // Fallback se non trova elementi
        steps.push({
            title: 'Serve altro?',
            intro: 'Per workflow completi (Parco Macchine, Bilancio, Tenant) e procedure passo-passo approfondisci sempre nella sezione "📘 Guide". Buon lavoro!'
        });
    }

    return steps;
}



