/**
 * Dashboard Sections - Funzioni per creare sezioni della dashboard
 * Le funzioni di caricamento dati vengono passate come callback opzionali
 */

// Namespace per evitare conflitti
window.GFVDashboardSections = window.GFVDashboardSections || {};

/**
 * Sezione Core Base (sempre visibile - essenziale)
 * @param {Object} userData - Dati utente
 * @param {boolean} isCoreOnly - Se true, solo moduli core attivi
 * @param {Array<string>} availableModules - Array di moduli disponibili (opzionale)
 */
window.GFVDashboardSections.createCoreBaseSection = function createCoreBaseSection(userData, isCoreOnly, availableModules = []) {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    
    // Azioni rapide core (sempre disponibili)
    let actionsHTML = `
        <a href="terreni-standalone.html" class="action-card">
            <span class="action-icon">🗺️</span>
            <span class="action-title">Terreni</span>
            <span class="action-description">Gestisci terreni e vigneti</span>
        </a>
        <a href="attivita-standalone.html" class="action-card">
            <span class="action-icon">📝</span>
            <span class="action-title">Diario Attività</span>
            <span class="action-description">Registra attività lavorative</span>
        </a>
        <a href="statistiche-standalone.html" class="action-card">
            <span class="action-icon">📊</span>
            <span class="action-title">Statistiche</span>
            <span class="action-description">Visualizza statistiche e grafici</span>
        </a>
    `;
    
    // Aggiungi Gestione Macchine se modulo Parco Macchine è attivo (indipendentemente da Manodopera)
    if (availableModules && availableModules.includes('parcoMacchine')) {
        actionsHTML += `
            <a href="admin/gestione-macchine-standalone.html" class="action-card">
                <span class="action-icon">🚜</span>
                <span class="action-title">Gestione Macchine</span>
                <span class="action-description">Gestisci parco macchine e manutenzioni</span>
            </a>
        `;
    }
    
    // Aggiungi card Abbonamento (sempre visibile per gestire piano e moduli)
    actionsHTML += `
        <a href="admin/abbonamento-standalone.html" class="action-card">
            <span class="action-icon">💳</span>
            <span class="action-title">Abbonamento</span>
            <span class="action-description">Gestisci piano e moduli</span>
        </a>
    `;
    
    section.innerHTML = `
        <h2><span class="section-icon">🌾</span> Core Base</h2>
        <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #666;">Azioni Rapide</h3>
        <div class="quick-actions">
            ${actionsHTML}
        </div>
    `;
    
    return section;
};

/**
 * Sezione Amministratore (sempre disponibile nel core base)
 * @param {Function} loadStatsCallback - Callback opzionale per caricare statistiche
 */
window.GFVDashboardSections.createAdminSection = function createAdminSection(userData, isCoreOnly, availableModules, loadStatsCallback) {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    
    // Statistiche amministratore
    let statsHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" id="stat-utenti-admin">-</div>
                <div class="stat-label">Utenti Totali</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-moduli-admin">-</div>
                <div class="stat-label">Moduli Attivi</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-piano-admin">-</div>
                <div class="stat-label">Piano</div>
            </div>
        </div>
    `;
    
    // Azioni amministratore (solo con modulo Manodopera)
    // Nota: Abbonamento e Impostazioni sono sempre disponibili nell'header o Core Base
    let actionsHTML = `
        <a href="admin/gestisci-utenti-standalone.html" class="action-card">
            <span class="action-icon">👥</span>
            <span class="action-title">Gestisci Utenti</span>
            <span class="action-description">Invita e gestisci utenti azienda</span>
        </a>
        <a href="admin/gestione-squadre-standalone.html" class="action-card">
            <span class="action-icon">👷</span>
            <span class="action-title">Gestione Squadre</span>
            <span class="action-description">Crea e gestisci squadre di lavoro</span>
        </a>
        <a href="admin/gestione-operai-standalone.html" class="action-card">
            <span class="action-icon">👷‍♂️</span>
            <span class="action-title">Gestione Operai</span>
            <span class="action-description">Gestisci contratti e scadenze operai</span>
        </a>
        <a href="admin/compensi-operai-standalone.html" class="action-card">
            <span class="action-icon">💰</span>
            <span class="action-title">Compensi Operai</span>
            <span class="action-description">Calcola e gestisci compensi operai</span>
        </a>
    `;
    
    // Aggiungi Gestione Macchine se modulo Parco Macchine è attivo
    if (availableModules && availableModules.includes('parcoMacchine')) {
        actionsHTML += `
            <a href="admin/gestione-macchine-standalone.html" class="action-card">
                <span class="action-icon">🚜</span>
                <span class="action-title">Gestione Macchine</span>
                <span class="action-description">Gestisci parco macchine e manutenzioni</span>
            </a>
        `;
    }
    
    // Report completi solo se ci sono moduli avanzati
    if (!isCoreOnly) {
        actionsHTML += `
            <a href="admin/report-standalone.html" class="action-card">
                <span class="action-icon">📊</span>
                <span class="action-title">Report Completi</span>
                <span class="action-description">Visualizza tutte le statistiche</span>
            </a>
        `;
    }
    
    section.innerHTML = `
        <h2><span class="section-icon">👑</span> Amministrazione</h2>
        ${statsHTML}
        <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #666;">Azioni Rapide</h3>
        <div class="quick-actions">
            ${actionsHTML}
        </div>
    `;
    
    // Carica statistiche amministratore se callback fornito
    if (loadStatsCallback && typeof loadStatsCallback === 'function') {
        loadStatsCallback(availableModules);
    }
    
    return section;
};

/**
 * Sezione Manager (senza Manodopera o con altri moduli)
 * @param {Function} loadStatsCallback - Callback opzionale per caricare statistiche
 */
window.GFVDashboardSections.createManagerSection = function createManagerSection(userData, isCoreOnly, availableModules, loadStatsCallback) {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    
    // Usa utility functions
    const { hasManodoperaModule } = window.GFVDashboardUtils;
    
    // Statistiche: se core only, mostra solo metriche core
    let statsHTML = '';
    if (isCoreOnly) {
        statsHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value" id="stat-terreni-manager">-</div>
                    <div class="stat-label">Terreni</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="stat-attivita-manager">-</div>
                    <div class="stat-label">Attività</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="stat-ore-manager">-</div>
                    <div class="stat-label">Ore Questo Mese</div>
                </div>
            </div>
        `;
    } else {
        statsHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value" id="stat-terreni-manager">-</div>
                    <div class="stat-label">Terreni</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">-</div>
                    <div class="stat-label">Lavori Attivi</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="stat-ore-manager">-</div>
                    <div class="stat-label">Ore Questo Mese</div>
                </div>
            </div>
        `;
    }
    
    // Azioni rapide: se core only, mostra solo funzionalità core
    let actionsHTML = '';
    const hasManodopera = hasManodoperaModule(availableModules);
    
    if (isCoreOnly) {
        actionsHTML = `
            <a href="terreni-standalone.html" class="action-card">
                <span class="action-icon">🗺️</span>
                <span class="action-title">Terreni</span>
                <span class="action-description">Gestisci terreni e vigneti</span>
            </a>
            <a href="attivita-standalone.html" class="action-card">
                <span class="action-icon">📝</span>
                <span class="action-title">Diario Attività</span>
                <span class="action-description">Registra attività lavorative</span>
            </a>
            <a href="statistiche-standalone.html" class="action-card">
                <span class="action-icon">📊</span>
                <span class="action-title">Statistiche</span>
                <span class="action-description">Visualizza statistiche e grafici</span>
            </a>
        `;
    } else {
        actionsHTML = `
            <a href="terreni-standalone.html" class="action-card">
                <span class="action-icon">🗺️</span>
                <span class="action-title">Terreni</span>
                <span class="action-description">Gestisci terreni e vigneti</span>
            </a>
            <a href="attivita-standalone.html" class="action-card">
                <span class="action-icon">📝</span>
                <span class="action-title">Diario Attività</span>
                <span class="action-description">Registra attività lavorative</span>
            </a>
            <a href="statistiche-standalone.html" class="action-card">
                <span class="action-icon">📊</span>
                <span class="action-title">Statistiche</span>
                <span class="action-description">Visualizza statistiche e grafici</span>
            </a>
        `;
    }
    
    section.innerHTML = `
        <h2><span class="section-icon">📊</span> Gestione Operativa</h2>
        ${statsHTML}
        <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #666;">Azioni Rapide</h3>
        <div class="quick-actions">
            ${actionsHTML}
        </div>
    `;
    
    // Carica statistiche core se core only e callback fornito
    if (isCoreOnly && loadStatsCallback && typeof loadStatsCallback === 'function') {
        loadStatsCallback();
    }
    
    return section;
};

/**
 * Card Amministrazione (porta a pagina dedicata)
 */
window.GFVDashboardSections.createAmministrazioneCard = function createAmministrazioneCard() {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    
    section.innerHTML = `
        <h2><span class="section-icon">👑</span> Amministrazione</h2>
        <p style="color: #666; margin-bottom: 20px; font-size: 14px;">
            Gestisci utenti, squadre e abbonamento dell'azienda
        </p>
        <div class="quick-actions">
            <a href="admin/amministrazione-standalone.html" class="action-card" style="text-decoration: none;">
                <span class="action-icon" style="font-size: 48px;">👑</span>
                <span class="action-title" style="font-size: 18px;">Apri Amministrazione</span>
                <span class="action-description">
                    Accedi a tutte le funzionalità amministrative: gestisci utenti, squadre e abbonamento
                </span>
            </a>
        </div>
    `;
    
    return section;
};

/**
 * Card Statistiche (porta a pagina dedicata)
 * @param {boolean} hasManodopera - Se true, linka a statistiche manodopera, altrimenti a statistiche core
 */
window.GFVDashboardSections.createStatisticheCard = function createStatisticheCard(hasManodopera = false) {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    
    const linkUrl = hasManodopera ? 'admin/statistiche-manodopera-standalone.html' : 'statistiche-standalone.html';
    const description = hasManodopera 
        ? 'Accedi alle statistiche complete: lavori, ore, squadre, superficie e molto altro'
        : 'Visualizza statistiche e analisi dettagliate su attività, ore, terreni e affitti';
    
    section.innerHTML = `
        <h2><span class="section-icon">📊</span> Statistiche</h2>
        <p style="color: #666; margin-bottom: 20px; font-size: 14px;">
            ${hasManodopera ? 'Visualizza statistiche e analisi dettagliate su lavori, ore, squadre e superficie' : 'Visualizza statistiche e analisi dettagliate su attività, ore, terreni e affitti'}
        </p>
        <div class="quick-actions">
            <a href="${linkUrl}" class="action-card" style="text-decoration: none;">
                <span class="action-icon" style="font-size: 48px;">📊</span>
                <span class="action-title" style="font-size: 18px;">Apri Statistiche</span>
                <span class="action-description">
                    ${description}
                </span>
            </a>
        </div>
    `;
    
    return section;
};

/**
 * Card Terreni (porta a pagina terreni)
 */
window.GFVDashboardSections.createTerreniCard = function createTerreniCard() {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    
    section.innerHTML = `
        <h2><span class="section-icon">🗺️</span> Terreni</h2>
        <p style="color: #666; margin-bottom: 20px; font-size: 14px;">
            Gestisci terreni, traccia confini sulla mappa e visualizza informazioni dettagliate
        </p>
        <div class="quick-actions">
            <a href="terreni-standalone.html" class="action-card" style="text-decoration: none;">
                <span class="action-icon" style="font-size: 48px;">🗺️</span>
                <span class="action-title" style="font-size: 18px;">Apri Terreni</span>
                <span class="action-description">
                    Accedi alla gestione completa dei terreni: crea, modifica, traccia confini e visualizza dettagli
                </span>
            </a>
        </div>
    `;
    
    return section;
};

/**
 * Card Diario Attività (porta a pagina diario)
 */
window.GFVDashboardSections.createDiarioAttivitaCard = function createDiarioAttivitaCard() {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    
    section.innerHTML = `
        <h2><span class="section-icon">📝</span> Diario Attività</h2>
        <p style="color: #666; margin-bottom: 20px; font-size: 14px;">
            Registra le attività lavorative svolte sui terreni
        </p>
        <div class="quick-actions">
            <a href="attivita-standalone.html" class="action-card" style="text-decoration: none;">
                <span class="action-icon" style="font-size: 48px;">📝</span>
                <span class="action-title" style="font-size: 18px;">Apri Diario</span>
                <span class="action-description">
                    Accedi al diario attività: registra orari, tipo lavoro, terreno e note
                </span>
            </a>
        </div>
    `;
    
    return section;
};

/**
 * Card Abbonamento (porta a pagina abbonamento)
 */
window.GFVDashboardSections.createAbbonamentoCard = function createAbbonamentoCard() {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    
    section.innerHTML = `
        <h2><span class="section-icon">💳</span> Abbonamento</h2>
        <p style="color: #666; margin-bottom: 20px; font-size: 14px;">
            Gestisci piano e moduli attivi dell'azienda
        </p>
        <div class="quick-actions">
            <a href="admin/abbonamento-standalone.html" class="action-card" style="text-decoration: none;">
                <span class="action-icon" style="font-size: 48px;">💳</span>
                <span class="action-title" style="font-size: 18px;">Apri Abbonamento</span>
                <span class="action-description">
                    Visualizza piano attivo e gestisci moduli disponibili
                </span>
            </a>
        </div>
    `;
    
    return section;
};

/**
 * Card Affitti in Scadenza (mostra affitti con scadenze imminenti)
 */
window.GFVDashboardSections.createAffittiScadenzaCard = function createAffittiScadenzaCard() {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    section.id = 'affitti-scadenza-card';
    
    section.innerHTML = `
        <h2><span class="section-icon">📅</span> Affitti in Scadenza</h2>
        <div id="affitti-scadenza-content" style="min-height: 80px; max-height: 200px; overflow-y: auto;">
            <div style="text-align: center; padding: 15px; color: #666; font-size: 13px;">
                Caricamento affitti...
            </div>
        </div>
    `;
    
    return section;
};

/**
 * Sezione Manager con Modulo Manodopera attivo (layout completo)
 */
window.GFVDashboardSections.createManagerManodoperaSection = function createManagerManodoperaSection(userData, availableModules, loadStatsCallback, loadRecentCallback) {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    section.style.width = '100%';
    
    section.innerHTML = `
        <h2><span class="section-icon">👷</span> Gestione Manodopera</h2>
        <div class="stats-grid" style="margin-bottom: 30px;">
            <div class="stat-card">
                <div class="stat-value" id="stat-lavori-totali-manodopera">-</div>
                <div class="stat-label">Lavori Totali</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-lavori-attivi-manodopera">-</div>
                <div class="stat-label">Lavori Attivi</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-ore-validate-manodopera">-</div>
                <div class="stat-label">Ore Validate (Mese)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-superficie-lavorata-manodopera">-</div>
                <div class="stat-label">Superficie Lavorata (ha)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-squadre-attive-manodopera">-</div>
                <div class="stat-label">Squadre Attive</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-operai-online-manodopera">-</div>
                <div class="stat-label">Operai Online</div>
            </div>
        </div>
        <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #666;">Azioni Rapide</h3>
        <div class="quick-actions">
            <a href="admin/gestione-lavori-standalone.html" class="action-card">
                <span class="action-icon">📋</span>
                <span class="action-title">Gestione Lavori</span>
                <span class="action-description">Crea, modifica e assegna lavori</span>
            </a>
            <a href="admin/validazione-ore-standalone.html" class="action-card">
                <span class="action-icon">✅</span>
                <span class="action-title">Validazione Ore</span>
                <span class="action-description">Valida ore lavori autonomi</span>
            </a>
            <a href="admin/statistiche-manodopera-standalone.html" class="action-card">
                <span class="action-icon">📊</span>
                <span class="action-title">Statistiche</span>
                <span class="action-description">Visualizza statistiche dettagliate</span>
            </a>
            ${availableModules && availableModules.includes('parcoMacchine') ? `
            <a href="admin/gestione-macchine-standalone.html" class="action-card">
                <span class="action-icon">🚜</span>
                <span class="action-title">Gestione Macchine</span>
                <span class="action-description">Gestisci parco macchine e guasti</span>
            </a>
            ` : ''}
            <a href="terreni-standalone.html" class="action-card">
                <span class="action-icon">🗺️</span>
                <span class="action-title">Terreni</span>
                <span class="action-description">Gestisci terreni e vigneti</span>
            </a>
        </div>
        ${availableModules && availableModules.includes('parcoMacchine') ? `
        <div id="manutenzioni-scadenza-section" style="margin: 30px 0; padding: 20px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 8px; display: none;">
            <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #856404; display: flex; align-items: center; gap: 8px;">
                <span>⚠️</span> Manutenzioni in Scadenza
            </h3>
            <div id="manutenzioni-scadenza-list">
                <div style="padding: 10px; text-align: center; color: #856404;">Caricamento manutenzioni...</div>
            </div>
        </div>
        <div id="guasti-segnalati-section" style="margin: 30px 0; padding: 20px; background: #f8d7da; border-left: 4px solid #dc3545; border-radius: 8px; display: none;">
            <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #721c24; display: flex; align-items: center; gap: 8px;">
                <span>🔧</span> Guasti Segnalati
            </h3>
            <div id="guasti-segnalati-list">
                <div style="padding: 10px; text-align: center; color: #721c24;">Caricamento guasti...</div>
            </div>
        </div>
        ` : ''}
        <h3 style="margin: 30px 0 15px 0; font-size: 16px; color: #666;">Lavori Recenti</h3>
        <ul class="recent-items" id="recent-lavori-manager-manodopera">
            <li class="recent-item">
                <div>
                    <div class="recent-item-title">Caricamento...</div>
                </div>
            </li>
        </ul>
    `;
    
    if (loadStatsCallback && typeof loadStatsCallback === 'function') loadStatsCallback();
    if (loadRecentCallback && typeof loadRecentCallback === 'function') loadRecentCallback();
    
    return section;
};

/**
 * Sezione Manager - Gestione Lavori
 */
window.GFVDashboardSections.createManagerLavoriSection = function createManagerLavoriSection(userData, availableModules, loadStatsCallback, loadRecentCallback) {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    section.innerHTML = `
        <h2><span class="section-icon">📋</span> Gestione Lavori</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" id="stat-lavori-totali">-</div>
                <div class="stat-label">Lavori Totali</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-lavori-attivi">-</div>
                <div class="stat-label">Lavori Attivi</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-lavori-completati">-</div>
                <div class="stat-label">Lavori Completati</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-lavori-pianificati">-</div>
                <div class="stat-label">Lavori Pianificati</div>
            </div>
        </div>
        <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #666;">Azioni Rapide</h3>
        <div class="quick-actions">
            <a href="admin/gestione-lavori-standalone.html" class="action-card">
                <span class="action-icon">📋</span>
                <span class="action-title">Gestione Lavori</span>
                <span class="action-description">Crea, modifica e assegna lavori</span>
            </a>
            <a href="admin/gestione-squadre-standalone.html" class="action-card">
                <span class="action-icon">👥</span>
                <span class="action-title">Gestione Squadre</span>
                <span class="action-description">Gestisci squadre e assegnazioni</span>
            </a>
        </div>
        <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #666;">Lavori Recenti</h3>
        <ul class="recent-items" id="recent-lavori-manager">
            <li class="recent-item">
                <div>
                    <div class="recent-item-title">Caricamento...</div>
                </div>
            </li>
        </ul>
    `;
    
    if (loadStatsCallback && typeof loadStatsCallback === 'function') loadStatsCallback();
    if (loadRecentCallback && typeof loadRecentCallback === 'function') loadRecentCallback();
    
    return section;
};

/**
 * Sezione Diario da Lavori
 */
window.GFVDashboardSections.createDiarioDaLavoriSection = function createDiarioDaLavoriSection(userData, availableModules) {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    section.style.width = '100%';
    section.innerHTML = `
        <h2><span class="section-icon">📝</span> Diario da Lavori</h2>
        <p style="color: #666; margin-bottom: 20px; font-size: 14px;">
            Attività generate automaticamente dalle ore validate dei lavori assegnati. Queste attività vengono create aggregando le ore segnate dagli operai e validate dai caposquadra.
        </p>
        <div id="diario-lavori-container" style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; padding: 40px; color: #666;">Caricamento attività...</div>
        </div>
    `;
    return section;
};

/**
 * Sezione Caposquadra
 */
window.GFVDashboardSections.createCaposquadraSection = function createCaposquadraSection(userData, isCoreOnly, availableModules, loadStatsCallback, loadRecentCallback, loadComunicazioneCallback) {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    section.innerHTML = `
        <h2><span class="section-icon">👷</span> Gestione Squadra</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" id="stat-lavori-assegnati-capo">-</div>
                <div class="stat-label">Lavori Assegnati</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-ore-da-validare-capo">-</div>
                <div class="stat-label">Ore da Validare</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-squadra-capo">-</div>
                <div class="stat-label">Squadra</div>
            </div>
        </div>
        <div id="comunicazione-rapida-section" style="background: white; border: 2px solid #2E8B57; border-radius: 12px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #2E8B57; font-size: 18px; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                <span>📢</span> Invia Comunicazione Rapida alla Squadra
            </h3>
            <div id="comunicazione-rapida-content">
                <div style="text-align: center; padding: 20px; color: #666;">Caricamento lavori...</div>
            </div>
        </div>
        <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #666;">Azioni Rapide</h3>
        <div class="quick-actions">
            <a href="admin/lavori-caposquadra-standalone.html" class="action-card">
                <span class="action-icon">📋</span>
                <span class="action-title">I Miei Lavori</span>
                <span class="action-description">Visualizza lavori assegnati e traccia zone</span>
            </a>
            <a href="segnatura-ore-standalone.html" class="action-card">
                <span class="action-icon">⏱️</span>
                <span class="action-title">Segna Ore</span>
                <span class="action-description">Registra le tue ore lavorate</span>
            </a>
            <a href="admin/validazione-ore-standalone.html" class="action-card">
                <span class="action-icon">✅</span>
                <span class="action-title">Valida Ore</span>
                <span class="action-description">Valida ore degli operai</span>
            </a>
            <a href="admin/gestione-squadre-standalone.html" class="action-card">
                <span class="action-icon">👥</span>
                <span class="action-title">La Mia Squadra</span>
                <span class="action-description">Visualizza membri squadra</span>
            </a>
        </div>
        <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #666;">Lavori Recenti</h3>
        <ul class="recent-items" id="recent-lavori-capo">
            <li class="recent-item">
                <div>
                    <div class="recent-item-title">Caricamento...</div>
                </div>
            </li>
        </ul>
    `;
    
    if (loadStatsCallback && typeof loadStatsCallback === 'function') loadStatsCallback(userData);
    if (loadRecentCallback && typeof loadRecentCallback === 'function') loadRecentCallback(userData);
    if (loadComunicazioneCallback && typeof loadComunicazioneCallback === 'function') loadComunicazioneCallback(userData);
    
    return section;
};

/**
 * Sezione Operaio
 */
window.GFVDashboardSections.createOperaioSection = function createOperaioSection(userData, isCoreOnly, availableModules, loadComunicazioniCallback, loadLavoriOggiCallback, loadStatisticheCallback) {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    section.innerHTML = `
        <h2><span class="section-icon">🔧</span> I Miei Lavori</h2>
        <div id="comunicazioni-operaio-section" style="margin-bottom: 30px;">
            <h3 style="margin: 20px 0 15px 0; font-size: 18px; color: #2E8B57; border-bottom: 2px solid #2E8B57; padding-bottom: 8px;">📢 Comunicazioni dal Caposquadra</h3>
            <div id="comunicazioni-operaio-list">
                <div style="padding: 20px; text-align: center; color: #666;">Caricamento comunicazioni...</div>
            </div>
        </div>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" id="stat-lavori-oggi-operaio">-</div>
                <div class="stat-label">Lavori Oggi</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-ore-segnate-operaio">-</div>
                <div class="stat-label">Ore Segnate</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-stato-operaio">-</div>
                <div class="stat-label">Stato</div>
            </div>
        </div>
        <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #666;">Azioni Rapide</h3>
        <div class="quick-actions">
            <a href="segnatura-ore-standalone.html" class="action-card">
                <span class="action-icon">⏱️</span>
                <span class="action-title">Segna Ore</span>
                <span class="action-description">Registra ore lavorate</span>
            </a>
            <a href="admin/lavori-caposquadra-standalone.html" class="action-card">
                <span class="action-icon">📍</span>
                <span class="action-title">Traccia Zone</span>
                <span class="action-description">Traccia zone lavorate</span>
            </a>
            ${availableModules && availableModules.includes('parcoMacchine') ? `
            <a href="admin/segnalazione-guasti-standalone.html" class="action-card">
                <span class="action-icon">🔧</span>
                <span class="action-title">Segnala Guasti</span>
                <span class="action-description">Segnala guasti alle macchine</span>
            </a>
            ` : ''}
            <a href="segnatura-ore-standalone.html" class="action-card">
                <span class="action-icon">📊</span>
                <span class="action-title">Le Mie Ore</span>
                <span class="action-description">Visualizza storico ore</span>
            </a>
        </div>
        <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #666;">Lavori di Oggi</h3>
        <ul class="recent-items" id="lavori-oggi-operaio">
            <li class="recent-item">
                <div>
                    <div class="recent-item-title">Caricamento lavori...</div>
                </div>
            </li>
        </ul>
        <h3 style="margin: 30px 0 15px 0; font-size: 16px; color: #666;">Le Mie Ore</h3>
        <div id="mie-ore-operaio-section">
            <div style="padding: 20px; text-align: center; color: #666;">Caricamento statistiche ore...</div>
        </div>
    `;
    
    if (userData && userData.tenantId) {
        if (loadComunicazioniCallback && typeof loadComunicazioniCallback === 'function') loadComunicazioniCallback(userData);
        if (loadLavoriOggiCallback && typeof loadLavoriOggiCallback === 'function') loadLavoriOggiCallback(userData);
        if (loadStatisticheCallback && typeof loadStatisticheCallback === 'function') loadStatisticheCallback(userData);
    }
    
    return section;
};

