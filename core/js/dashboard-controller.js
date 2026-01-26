/**
 * Dashboard Controller - Logica principale dashboard
 * 
 * @module core/js/dashboard-controller
 */

// ============================================
// IMPORTS
// ============================================
// Le funzioni create* sono importate da dashboard-sections.js
// Le funzioni load* sono importate da dashboard-data.js
// Le funzioni di utilità sono importate da dashboard-utils-extended.js

// ============================================
// FUNZIONI PRINCIPALI
// ============================================

/**
 * Renderizza la dashboard in base ai ruoli e moduli disponibili
 * @param {Object} userData - Dati utente
 * @param {Array} availableModules - Moduli disponibili
 * @param {Object} callbacks - Callbacks per funzioni create* e load*
 * @param {Object} dependencies - Dipendenze Firebase e utilities
 */
export async function renderDashboard(userData, availableModules = [], callbacks, dependencies) {
    const {
        // Create functions
        createCoreBaseSection,
        createAdminSection,
        createManagerSection,
        createAmministrazioneCard,
        createStatisticheCard,
        createTerreniCard,
        createDiarioAttivitaCard,
        createAbbonamentoCard,
        createAffittiScadenzaCard,
        createContoTerziCard,
        createVignetoCard,
        createReportCard,
        createManagerManodoperaSection,
        createDiarioDaLavoriSection,
        createCaposquadraSection,
        createOperaioSection,
        createMappaAziendaleSection,
        // Load functions
        loadAffittiInScadenza,
        loadCoreStatsForManager,
        loadManagerManodoperaStats,
        loadRecentLavoriManagerManodopera,
        loadDiarioDaLavori,
        loadCaposquadraStats,
        loadRecentLavoriCaposquadra,
        loadComunicazioneRapida,
        loadComunicazioniInviateCaposquadra,
        loadComunicazioniOperaio,
        loadLavoriOggiOperaio,
        loadStatisticheOreOperaio,
        // Utility functions
        hasRole,
        hasOnlyCoreModules,
        hasManodoperaModule,
        setupDashboardTour
    } = callbacks;

    const container = document.getElementById('dashboard-content');
    if (!container) {
        console.error('Container dashboard non trovato');
        return;
    }
    
    container.innerHTML = '';

    const ruoli = userData.ruoli || [];
    const isCoreOnly = hasOnlyCoreModules(availableModules);
    const hasAdvancedModules = !isCoreOnly;
    const hasManodopera = hasManodoperaModule(availableModules);

    // Gestisci visibilità link "Invita Collaboratore" nell'header
    const invitaLink = document.getElementById('invita-collaboratore-link');
    if (invitaLink) {
        if (hasManodopera && (hasRole(userData, 'manager') || hasRole(userData, 'amministratore'))) {
            invitaLink.style.display = 'inline-flex';
        } else {
            invitaLink.style.display = 'none';
        }
    }

    // CORE BASE: Mostra solo se l'utente NON è solo Operaio o solo Caposquadra
    // ECCEZIONE: Se Manager o Amministratore ha modulo Manodopera attivo, nascondi Core Base
    const isOnlyOperaio = ruoli.length === 1 && hasRole(userData, 'operaio');
    const isOnlyCaposquadra = ruoli.length === 1 && hasRole(userData, 'caposquadra');
    const isManagerOrAdminWithManodopera = hasManodopera && (hasRole(userData, 'manager') || hasRole(userData, 'amministratore'));
    const shouldShowCoreBase = !isOnlyOperaio && !isOnlyCaposquadra && !isManagerOrAdminWithManodopera;
    
    if (shouldShowCoreBase) {
        // Per Manager/Amministratore senza Manodopera: layout con card sopra mappa
        if ((hasRole(userData, 'manager') || hasRole(userData, 'amministratore')) && !hasManodopera) {
            const topRow = document.createElement('div');
            topRow.className = 'dashboard-top-row';
            topRow.setAttribute('data-tour-section', 'panoramica');
            
            const topLeft = document.createElement('div');
            topLeft.className = 'dashboard-top-left';
            
            topLeft.appendChild(createTerreniCard());
            topLeft.appendChild(createDiarioAttivitaCard());
            
            const affittiCardCore = createAffittiScadenzaCard();
            topLeft.appendChild(affittiCardCore);
            
            topLeft.appendChild(createStatisticheCard(false)); // false = Core Base
            
            topLeft.appendChild(createAbbonamentoCard());
            
            const hasContoTerzi = availableModules && availableModules.includes('contoTerzi');
            if (hasContoTerzi) {
                topLeft.appendChild(createContoTerziCard());
            }
            
            const hasVigneto = availableModules && availableModules.includes('vigneto');
            if (hasVigneto) {
                topLeft.appendChild(createVignetoCard());
            }
            
            const hasReport = availableModules && availableModules.includes('report');
            if (hasReport) {
                topLeft.appendChild(createReportCard());
            }
            
            // Carica dati affitti in scadenza
            setTimeout(() => {
                loadAffittiInScadenza(dependencies);
            }, 100);
            
            // Mappa a destra (versione semplificata senza Manodopera)
            const topRight = document.createElement('div');
            topRight.className = 'dashboard-top-right';
            const mappaSection = createMappaAziendaleSection(userData, hasManodopera, (userData, hasManodopera) => {
                // Callback per caricare la mappa
                const { loadMappaAziendale } = callbacks;
                if (loadMappaAziendale) {
                    loadMappaAziendale(userData, hasManodopera, dependencies);
                }
            });
            if (mappaSection) {
                mappaSection.setAttribute('data-tour-section', 'mappa');
                topRight.appendChild(mappaSection);
            }
            
            topRow.appendChild(topLeft);
            topRow.appendChild(topRight);
            container.appendChild(topRow);
        } else {
            // Per altri utenti: layout normale con sezione Core Base
            const coreSection = createCoreBaseSection(userData, isCoreOnly, availableModules);
            if (coreSection) {
                coreSection.setAttribute('data-tour-section', 'core-base');
                container.appendChild(coreSection);
            }
        }
    }

    // Card Amministrazione (per Manager e Amministratore con Manodopera attivo)
    if (hasManodopera && (hasRole(userData, 'manager') || hasRole(userData, 'amministratore'))) {
        const topRow = document.createElement('div');
        topRow.className = 'dashboard-top-row';
        topRow.setAttribute('data-tour-section', 'panoramica');
        
        const topLeft = document.createElement('div');
        topLeft.className = 'dashboard-top-left';
        
        topLeft.appendChild(createAmministrazioneCard());
        topLeft.appendChild(createStatisticheCard(true)); // true = ha Manodopera
        topLeft.appendChild(createTerreniCard());
        
        const hasContoTerzi = availableModules && availableModules.includes('contoTerzi');
        if (hasContoTerzi) {
            topLeft.appendChild(createContoTerziCard());
        }
        
        const hasVigneto = availableModules && availableModules.includes('vigneto');
        if (hasVigneto) {
            topLeft.appendChild(createVignetoCard());
        }
        
        const hasReport = availableModules && availableModules.includes('report');
        if (hasReport) {
            topLeft.appendChild(createReportCard());
        }
        
        const affittiCard = createAffittiScadenzaCard();
        topLeft.appendChild(affittiCard);
        
        // Carica dati affitti in scadenza
        setTimeout(() => {
            loadAffittiInScadenza(dependencies);
        }, 100);
        
        // Mappa a destra (versione completa con Manodopera)
        const topRight = document.createElement('div');
        topRight.className = 'dashboard-top-right';
        const mappaSection = createMappaAziendaleSection(userData, hasManodopera, (userData, hasManodopera) => {
            const { loadMappaAziendale } = callbacks;
            if (loadMappaAziendale) {
                loadMappaAziendale(userData, hasManodopera, dependencies);
            }
        });
        if (mappaSection) {
            mappaSection.setAttribute('data-tour-section', 'mappa');
            topRight.appendChild(mappaSection);
        }
        
        topRow.appendChild(topLeft);
        topRow.appendChild(topRight);
        container.appendChild(topRow);
    }

    // Ruoli avanzati: solo se ci sono moduli avanzati attivi
    if (hasAdvancedModules) {
        // Sezione Manager: layout diverso se ha Manodopera attivo
        if (hasRole(userData, 'manager')) {
            if (hasManodopera) {
                // Gestione Manodopera (dopo la riga superiore)
                const managerManodoperaSection = createManagerManodoperaSection(
                    userData, 
                    availableModules, 
                    () => loadManagerManodoperaStats(dependencies),
                    () => loadRecentLavoriManagerManodopera(dependencies)
                );
                if (managerManodoperaSection) {
                    managerManodoperaSection.setAttribute('data-tour-section', 'gestione-manodopera');
                    container.appendChild(managerManodoperaSection);
                }
                
                // Diario da Lavori (sezione principale per Manager con Manodopera)
                const diarioSection = createDiarioDaLavoriSection(userData, availableModules);
                if (diarioSection) {
                    diarioSection.setAttribute('data-tour-section', 'diario');
                    container.appendChild(diarioSection);
                }
                setTimeout(() => {
                    loadDiarioDaLavori(userData, dependencies);
                }, 50);
            } else {
                // Layout normale per Manager senza Manodopera
                const managerSection = createManagerSection(
                    userData, 
                    isCoreOnly, 
                    availableModules, 
                    () => loadCoreStatsForManager(dependencies)
                );
                if (managerSection) {
                    managerSection.setAttribute('data-tour-section', 'gestione-core');
                    container.appendChild(managerSection);
                }
                
                // Card Conto Terzi (solo se modulo attivo) anche per Manager senza Manodopera
                const hasContoTerzi = availableModules && availableModules.includes('contoTerzi');
                if (hasContoTerzi) {
                    container.appendChild(createContoTerziCard());
                }
                
                // Card Vigneto (solo se modulo attivo) anche per Manager senza Manodopera
                const hasVigneto = availableModules && availableModules.includes('vigneto');
                if (hasVigneto) {
                    container.appendChild(createVignetoCard());
                }
                
                // Card Affitti in Scadenza anche per Manager senza Manodopera
                const affittiCardCore = createAffittiScadenzaCard();
                container.appendChild(affittiCardCore);
                setTimeout(() => {
                    loadAffittiInScadenza(dependencies);
                }, 100);
            }
        }
        
        // Sezione per Amministratore che non è Manager (solo se modulo Manodopera attivo)
        if (hasManodopera && hasRole(userData, 'amministratore') && !hasRole(userData, 'manager')) {
            const adminManodoperaSection = createManagerManodoperaSection(
                userData, 
                availableModules, 
                () => loadManagerManodoperaStats(dependencies),
                () => loadRecentLavoriManagerManodopera(dependencies)
            );
            if (adminManodoperaSection) {
                adminManodoperaSection.setAttribute('data-tour-section', 'gestione-manodopera');
                container.appendChild(adminManodoperaSection);
            }
            
            const diarioSection = createDiarioDaLavoriSection(userData, availableModules);
            if (diarioSection) {
                diarioSection.setAttribute('data-tour-section', 'diario');
                container.appendChild(diarioSection);
            }
            setTimeout(() => {
                loadDiarioDaLavori(userData, dependencies);
            }, 50);
        }

        // Sezione Caposquadra (solo con modulo Manodopera attivo)
        if (hasRole(userData, 'caposquadra')) {
            if (hasManodopera) {
                const caposquadraSection = createCaposquadraSection(
                    userData, 
                    isCoreOnly, 
                    availableModules, 
                    () => loadCaposquadraStats(userData, dependencies),
                    () => loadRecentLavoriCaposquadra(userData, dependencies),
                    () => loadComunicazioneRapida(userData, dependencies)
                );
                if (caposquadraSection) {
                    caposquadraSection.setAttribute('data-tour-section', 'caposquadra');
                    container.appendChild(caposquadraSection);
                    // Carica comunicazioni inviate dopo il rendering
                    loadComunicazioniInviateCaposquadra(userData, dependencies);
                }
            } else {
                // Messaggio se caposquadra ma modulo Manodopera non attivo
                const noModuleSection = document.createElement('div');
                noModuleSection.className = 'dashboard-section';
                noModuleSection.innerHTML = `
                    <h2><span class="section-icon">👷</span> Gestione Squadra</h2>
                    <div class="empty-state" style="padding: 40px;">
                        <div class="empty-state-icon">⚠️</div>
                        <h3>Modulo Manodopera non attivo</h3>
                        <p>Per accedere alle funzionalità di gestione squadra e lavori, è necessario attivare il modulo Manodopera.</p>
                        <p style="margin-top: 10px; font-size: 14px; color: #666;">Contatta l'amministratore per attivare il modulo.</p>
                    </div>
                `;
                container.appendChild(noModuleSection);
            }
        }

        // Sezione Operaio (solo con modulo Manodopera attivo)
        if (hasRole(userData, 'operaio')) {
            if (hasManodopera) {
                const operaioSection = createOperaioSection(
                    userData, 
                    isCoreOnly, 
                    availableModules, 
                    () => loadComunicazioniOperaio(userData, dependencies),
                    () => loadLavoriOggiOperaio(userData, dependencies),
                    () => loadStatisticheOreOperaio(userData, dependencies)
                );
                if (operaioSection) {
                    operaioSection.setAttribute('data-tour-section', 'operaio');
                    container.appendChild(operaioSection);
                }
            } else {
                // Messaggio se operaio ma modulo Manodopera non attivo
                const noModuleSection = document.createElement('div');
                noModuleSection.className = 'dashboard-section';
                noModuleSection.innerHTML = `
                    <h2><span class="section-icon">🔧</span> I Miei Lavori</h2>
                    <div class="empty-state" style="padding: 40px;">
                        <div class="empty-state-icon">⚠️</div>
                        <h3>Modulo Manodopera non attivo</h3>
                        <p>Per accedere alle funzionalità di gestione lavori e segnatura ore, è necessario attivare il modulo Manodopera.</p>
                        <p style="margin-top: 10px; font-size: 14px; color: #666;">Contatta l'amministratore per attivare il modulo.</p>
                    </div>
                `;
                container.appendChild(noModuleSection);
            }
        }
    }

    // Se non ha ruoli, mostra messaggio
    if (ruoli.length === 0) {
        container.innerHTML = `
            <div class="dashboard-section" style="grid-column: 1 / -1;">
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <h2>Nessun ruolo assegnato</h2>
                    <p>Contatta l'amministratore per ottenere i permessi necessari.</p>
                </div>
            </div>
        `;
    }

    // Setup tour
    if (setupDashboardTour) {
        setupDashboardTour(userData);
    }
}



