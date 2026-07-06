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

    // Aggiungi Report/Bilancio se modulo report è attivo
    if (availableModules && availableModules.includes('report')) {
        actionsHTML += `
            <a href="../modules/report/views/report-dashboard-standalone.html" class="action-card">
                <span class="action-icon">📑</span>
                <span class="action-title">Report/Bilancio</span>
                <span class="action-description">Dashboard report per area e export (cross-moduli)</span>
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
            <span class="action-description">Contratti, scadenze e scheda competenze (skill)</span>
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
    section.className = 'dashboard-section dashboard-section--module-tile';

    section.innerHTML = `
        <a href="admin/amministrazione-standalone.html" class="dashboard-module-tile" data-module="amministrazione" style="--module-accent:#8D6E63;">
            <span class="dashboard-module-tile__icon" aria-hidden="true">👑</span>
            <span class="dashboard-module-tile__body">
                <span class="dashboard-module-tile__title">Amministrazione</span>
                <span class="dashboard-module-tile__desc">Utenti, ruoli e squadre aziendali. Abbonamento e impostazioni di servizio.</span>
            </span>
        </a>
    `;

    return section;
};

/**
 * Card Statistiche (porta a pagina dedicata)
 * @param {boolean} hasManodopera - Se true, linka a statistiche manodopera, altrimenti a statistiche core
 */
window.GFVDashboardSections.createStatisticheCard = function createStatisticheCard(hasManodopera = false) {
    const section = document.createElement('div');
    section.className = 'dashboard-section dashboard-section--module-tile';

    const linkUrl = hasManodopera ? 'admin/statistiche-manodopera-standalone.html' : 'statistiche-standalone.html';
    const desc = hasManodopera
        ? 'Lavori, ore, squadre e superficie. Costi, disponibilità e andamenti nel tempo.'
        : 'KPI su attività, ore e terreni. Affitti e trend in sintesi per l\'azienda.';

    section.innerHTML = `
        <a href="${linkUrl}" class="dashboard-module-tile" data-module="statistiche" style="--module-accent:#3949AB;">
            <span class="dashboard-module-tile__icon" aria-hidden="true">📊</span>
            <span class="dashboard-module-tile__body">
                <span class="dashboard-module-tile__title">Statistiche</span>
                <span class="dashboard-module-tile__desc">${desc}</span>
            </span>
        </a>
    `;

    return section;
};

/**
 * Card Terreni (porta a pagina terreni)
 */
window.GFVDashboardSections.createTerreniCard = function createTerreniCard() {
    const section = document.createElement('div');
    section.className = 'dashboard-section dashboard-section--module-tile';

    section.innerHTML = `
        <a href="terreni-standalone.html" class="dashboard-module-tile" data-module="terreni" style="--module-accent:#2E7D32;">
            <span class="dashboard-module-tile__icon" aria-hidden="true">🗺️</span>
            <span class="dashboard-module-tile__body">
                <span class="dashboard-module-tile__title">Terreni</span>
                <span class="dashboard-module-tile__desc">Lotti, appezzamenti e dati di anagrafica. Confini su mappa e schede di dettaglio.</span>
            </span>
        </a>
    `;

    return section;
};

/**
 * Card Diario Attività (porta a pagina diario)
 */
window.GFVDashboardSections.createDiarioAttivitaCard = function createDiarioAttivitaCard() {
    const section = document.createElement('div');
    section.className = 'dashboard-section dashboard-section--module-tile';

    section.innerHTML = `
        <a href="attivita-standalone.html" class="dashboard-module-tile" data-module="diarioAttivita" style="--module-accent:#5D4037;">
            <span class="dashboard-module-tile__icon" aria-hidden="true">📝</span>
            <span class="dashboard-module-tile__body">
                <span class="dashboard-module-tile__title">Diario attività</span>
                <span class="dashboard-module-tile__desc">Registro delle attività in campo. Collega lavoro, terreno, orari e note operative.</span>
            </span>
        </a>
    `;
    
    return section;
};

/**
 * Card Abbonamento (porta a pagina abbonamento)
 */
window.GFVDashboardSections.createAbbonamentoCard = function createAbbonamentoCard() {
    const section = document.createElement('div');
    section.className = 'dashboard-section dashboard-section--module-tile';

    section.innerHTML = `
        <a href="admin/abbonamento-standalone.html" class="dashboard-module-tile" data-module="abbonamento" style="--module-accent:#00897B;">
            <span class="dashboard-module-tile__icon" aria-hidden="true">💳</span>
            <span class="dashboard-module-tile__body">
                <span class="dashboard-module-tile__title">Abbonamento</span>
                <span class="dashboard-module-tile__desc">Piano GFV e moduli attivati per il tenant. Fatturazione e rinnovi.</span>
            </span>
        </a>
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
 * Menu a tendina compatto: elenco moduli attivi (pin hub compatibili).
 * @param {{ variant: 'core' | 'manodopera', availableModules?: string[], sottoScortaMagazzino?: number }} opts
 */
window.GFVDashboardSections.createDashboardModuleSidebar = function createDashboardModuleSidebar(opts) {
    const S = window.GFVDashboardSections;
    const mods = Array.isArray(opts && opts.availableModules) ? opts.availableModules : [];
    const variant = opts && opts.variant === 'manodopera' ? 'manodopera' : 'core';
    const sotto = opts && opts.sottoScortaMagazzino != null ? opts.sottoScortaMagazzino : 0;

    const menu = document.createElement('div');
    menu.className = 'dashboard-module-menu';
    menu.setAttribute('data-tour-section', 'moduli-menu');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'dashboard-module-menu__trigger';
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'dashboard-module-menu-panel');
    trigger.innerHTML =
        '<span class="dashboard-module-menu__trigger-icon" aria-hidden="true">📂</span>' +
        '<span class="dashboard-module-menu__trigger-label">Moduli</span>' +
        '<span class="dashboard-module-menu__trigger-count"></span>' +
        '<span class="dashboard-module-menu__trigger-chevron" aria-hidden="true">▾</span>';

    const panel = document.createElement('div');
    panel.id = 'dashboard-module-menu-panel';
    panel.className = 'dashboard-module-menu__panel';
    panel.hidden = true;
    panel.setAttribute('role', 'menu');
    panel.setAttribute('aria-label', 'Moduli attivi');

    const nav = document.createElement('nav');
    nav.className = 'dashboard-module-menu__nav';
    nav.setAttribute('aria-label', 'Elenco moduli attivi');

    function appendCard(el) {
        if (!el) return;
        el.classList.add('dashboard-section--in-menu');
        nav.appendChild(el);
    }

    if (variant === 'manodopera') {
        appendCard(S.createAmministrazioneCard());
        appendCard(S.createAbbonamentoCard());
        appendCard(S.createStatisticheCard(true));
        if (mods.includes('manodopera')) appendCard(S.createManodoperaCard());
        appendCard(S.createTerreniCard());
        if (mods.includes('contoTerzi')) appendCard(S.createContoTerziCard());
        if (mods.includes('vendemmiaMeccanica')) appendCard(S.createVendemmiaMeccanicaCard());
        if (mods.includes('vigneto')) appendCard(S.createVignetoCard());
        if (mods.includes('frutteto')) appendCard(S.createFruttetoCard());
        if (mods.includes('magazzino')) appendCard(S.createMagazzinoCard(sotto));
        if (mods.includes('parcoMacchine')) appendCard(S.createMacchineCard());
        if (mods.includes('report')) appendCard(S.createReportCard());
        if (mods.includes('meteo')) appendCard(S.createMeteoCard());
    } else {
        appendCard(S.createTerreniCard());
        appendCard(S.createDiarioAttivitaCard());
        appendCard(S.createStatisticheCard(false));
        appendCard(S.createAbbonamentoCard());
        if (mods.includes('manodopera')) appendCard(S.createManodoperaCard());
        if (mods.includes('contoTerzi')) appendCard(S.createContoTerziCard());
        if (mods.includes('vendemmiaMeccanica')) appendCard(S.createVendemmiaMeccanicaCard());
        if (mods.includes('vigneto')) appendCard(S.createVignetoCard());
        if (mods.includes('frutteto')) appendCard(S.createFruttetoCard());
        if (mods.includes('magazzino')) appendCard(S.createMagazzinoCard(sotto));
        if (mods.includes('parcoMacchine')) appendCard(S.createMacchineCard());
        if (mods.includes('report')) appendCard(S.createReportCard());
        if (mods.includes('meteo')) appendCard(S.createMeteoCard());
    }

    const countEl = trigger.querySelector('.dashboard-module-menu__trigger-count');
    const moduleCount = nav.children.length;
    if (countEl) {
        countEl.textContent = String(moduleCount);
        countEl.setAttribute('aria-label', moduleCount + ' moduli attivi');
    }

    panel.appendChild(nav);
    menu.appendChild(trigger);
    menu.appendChild(panel);

    setupDashboardModuleMenu(menu);

    return menu;
};

function setupDashboardModuleMenu(menuEl) {
    const trigger = menuEl.querySelector('.dashboard-module-menu__trigger');
    const panel = menuEl.querySelector('.dashboard-module-menu__panel');
    if (!trigger || !panel) return;

    function closeMenu() {
        panel.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
    }

    function openMenu() {
        panel.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
    }

    trigger.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (panel.hidden) openMenu();
        else closeMenu();
    });

    panel.addEventListener('click', function (ev) {
        if (ev.target.closest('a.dashboard-module-tile')) closeMenu();
    });

    document.addEventListener('click', function (ev) {
        if (!menuEl.contains(ev.target)) closeMenu();
    });

    document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') closeMenu();
    });
}

/**
 * Barra accessi rapidi configurabili (5 slot) + schermata configurazione (card per modulo).
 */
window.GFVDashboardSections.createDashboardQuickBarSection = function createDashboardQuickBarSection() {
    const section = document.createElement('section');
    section.className = 'dashboard-section dashboard-quick-bar-wrap';
    section.setAttribute('aria-label', 'Accessi rapidi personalizzati');
    section.setAttribute('data-tour-section', 'miei-accessi');

    section.innerHTML = `
        <div class="dashboard-quick-bar-head">
            <h3 class="dashboard-quick-bar-heading">I miei accessi</h3>
            <button type="button" id="dashboard-quick-bar-config-btn" class="dashboard-quick-bar-config-btn">
                Configura
            </button>
        </div>
        <p class="dashboard-quick-bar-intro">Cinque scorciatoie verso moduli e pagine consentite. Preferenze salvate solo su questo browser.</p>
        <div class="quick-actions dashboard-quick-bar" id="dashboard-quick-bar-root"></div>
        <div id="dashboard-quick-bar-modal" class="dashboard-quick-bar-modal" hidden>
            <div class="dashboard-quick-bar-modal__backdrop" data-quick-bar-close tabindex="-1"></div>
            <div class="dashboard-quick-bar-modal__panel" role="dialog" aria-modal="true" aria-labelledby="dashboard-quick-bar-modal-title">
                <div class="dashboard-quick-bar-modal__header">
                    <h3 id="dashboard-quick-bar-modal-title">Componi la tua barra</h3>
                    <button type="button" class="dashboard-quick-bar-modal__x" data-quick-bar-close aria-label="Chiudi">×</button>
                </div>
                <p class="dashboard-quick-bar-modal__hint">Sotto trovi tutti gli accessi disponibili (anche le sottopagine: vigneto, frutteto, magazzino, conto terzi, parco macchine, report, manodopera), organizzati per modulo. Tocca una card per aggiungerla o toglierla dalla barra (massimo 5). Solo percorsi previsti dall’app; niente URL liberi.</p>
                <form id="dashboard-quick-bar-form" class="dashboard-quick-bar-form">
                    <div class="dashboard-quick-bar-draft-block">
                        <h4 class="dashboard-quick-bar-draft-block__title">Anteprima — I miei accessi</h4>
                        <div id="dashboard-quick-bar-draft-root"></div>
                    </div>
                    <p id="dashboard-quick-bar-limit-hint" class="dashboard-quick-bar-limit-hint" aria-live="polite"></p>
                    <div id="dashboard-quick-bar-catalog-root" class="dashboard-quick-bar-catalog-scroll"></div>
                    <div class="dashboard-quick-bar-modal__actions">
                        <button type="button" id="dashboard-quick-bar-clear-draft" class="dashboard-quick-bar-btn dashboard-quick-bar-btn--ghost">Svuota barra</button>
                        <button type="button" class="dashboard-quick-bar-btn dashboard-quick-bar-btn--ghost" data-quick-bar-close>Annulla</button>
                        <button type="submit" class="dashboard-quick-bar-btn dashboard-quick-bar-btn--primary">Salva</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    return section;
};

/**
 * Widget meteo base (sede aziendale, piano Base+).
 */
window.GFVDashboardSections.createDashboardMeteoSection = function createDashboardMeteoSection() {
    const row = document.createElement('div');
    row.className = 'dashboard-meteo-row';
    row.setAttribute('data-tour-section', 'meteo');
    row.hidden = true;

    const section = document.createElement('section');
    section.id = 'dashboard-meteo-widget';
    section.className = 'dashboard-section dashboard-meteo-widget';
    section.setAttribute('aria-label', 'Meteo sede aziendale');
    section.innerHTML = `
        <h2><span class="section-icon" aria-hidden="true">🌤</span> Meteo sede</h2>
        <div class="dashboard-meteo__content">
            <p class="dashboard-meteo__message">Caricamento meteo…</p>
        </div>
    `;

    const side = document.createElement('aside');
    side.id = 'dashboard-meteo-side';
    side.className = 'dashboard-meteo-side';
    side.setAttribute('aria-label', 'Previsioni e operatività');
    side.innerHTML = '<div class="dashboard-meteo-side__inner"><p class="dashboard-meteo__message">Caricamento…</p></div>';

    row.appendChild(section);
    row.appendChild(side);
    return row;
};

/**
 * Fascia doppia: Scadenze amministrazione + In arrivo (operativo).
 */
window.GFVDashboardSections.createDashboardDeadlinesRow = function createDashboardDeadlinesRow() {
    const row = document.createElement('div');
    row.className = 'dashboard-deadlines-row';
    row.setAttribute('data-tour-section', 'scadenze');
    row.innerHTML = `
        <section id="scadenze-amministrazione-widget" class="dashboard-section dashboard-widget-scadenze dashboard-widget-scadenze-ammin">
            <h2><span class="section-icon" aria-hidden="true">📋</span> Scadenze amministrazione</h2>
            <p class="dashboard-widget-scadenze__hint">Affitti, revisioni e assicurazioni con scadenza imminente o superata.</p>
            <div id="scadenze-amministrazione-list" class="dashboard-deadline-list"></div>
            <p id="scadenze-amministrazione-empty" class="dashboard-deadline-empty">Caricamento scadenze…</p>
        </section>
        <section id="in-arrivo-widget" class="dashboard-section dashboard-widget-scadenze dashboard-widget-in-arrivo">
            <h2><span class="section-icon" aria-hidden="true">⏳</span> In arrivo</h2>
            <p class="dashboard-widget-scadenze__hint">Manutenzioni mezzi, lavori da pianificare e ore da validare.</p>
            <div id="in-arrivo-list" class="dashboard-deadline-list"></div>
            <p id="in-arrivo-empty" class="dashboard-deadline-empty">Caricamento…</p>
        </section>
    `;
    return row;
};

/**
 * Fascia panoramica sopra la griglia moduli: attenzione, promemoria, accessi rapidi (pin/recenti).
 */
window.GFVDashboardSections.createDashboardPanoramaHubSection = function createDashboardPanoramaHubSection() {
    const section = document.createElement('section');
    section.id = 'dashboard-panorama-hub';
    section.className = 'dashboard-panorama-hub';
    section.setAttribute('aria-label', 'Panoramica rapida');
    section.innerHTML = `
        <div class="dashboard-hub-grid">
            <div class="dashboard-hub-block dashboard-hub-block--attention">
                <h3 class="dashboard-hub-heading">Richiede attenzione</h3>
                <ul id="dashboard-hub-attention-list" class="dashboard-hub-list" hidden></ul>
                <p id="dashboard-hub-attention-empty" class="dashboard-hub-empty">Verifica in corso…</p>
            </div>
            <div class="dashboard-hub-block dashboard-hub-block--today">
                <h3 class="dashboard-hub-heading">Per te oggi</h3>
                <ul id="dashboard-hub-today-list" class="dashboard-hub-list"></ul>
            </div>
            <div class="dashboard-hub-block dashboard-hub-block--shortcuts">
                <h3 class="dashboard-hub-heading">Accessi rapidi</h3>
                <p class="dashboard-hub-hint">Preferiti e ultimi moduli usati su questo dispositivo. Clicca la stella nel menu Moduli per fissare un accesso.</p>
                <div id="dashboard-hub-shortcuts" class="dashboard-hub-shortcuts"></div>
                <p id="dashboard-hub-shortcuts-empty" class="dashboard-hub-empty" hidden>Nessun accesso rapido ancora: apri un modulo o aggiungi un preferito.</p>
            </div>
        </div>
    `;
    return section;
};

/**
 * Riga tile moduli attivi (entry card visibili sotto la panoramica dashboard).
 * @param {string[]} availableModules
 * @returns {HTMLElement|null}
 */
window.GFVDashboardSections.createDashboardModuleEntryTilesRow = function createDashboardModuleEntryTilesRow(availableModules) {
    const S = window.GFVDashboardSections;
    const mods = Array.isArray(availableModules) ? availableModules : [];
    const row = document.createElement('div');
    row.className = 'dashboard-section dashboard-module-entry-row';
    row.setAttribute('data-tour-section', 'moduli-attivi');
    row.innerHTML = '<h2><span class="section-icon" aria-hidden="true">🧩</span> Moduli attivi</h2><div class="dashboard-module-entry-grid"></div>';
    const grid = row.querySelector('.dashboard-module-entry-grid');

    function appendTile(el) {
        if (!el) return;
        el.classList.remove('dashboard-section--in-menu');
        const shell = document.createElement('div');
        shell.className = 'dashboard-module-tile-shell';
        shell.appendChild(el);
        grid.appendChild(shell);
    }

    if (mods.includes('contoTerzi')) appendTile(S.createContoTerziCard());
    if (mods.includes('vendemmiaMeccanica')) appendTile(S.createVendemmiaMeccanicaCard());
    if (mods.includes('vigneto')) appendTile(S.createVignetoCard());
    if (mods.includes('frutteto')) appendTile(S.createFruttetoCard());
    if (mods.includes('magazzino')) appendTile(S.createMagazzinoCard(0));
    if (mods.includes('parcoMacchine')) appendTile(S.createMacchineCard());
    if (mods.includes('report')) appendTile(S.createReportCard());

    return grid.children.length ? row : null;
};

window.GFVDashboardSections.createContoTerziCard = function createContoTerziCard() {
    const section = document.createElement('div');
    section.className = 'dashboard-section dashboard-section--module-tile';
    section.innerHTML = `
        <a href="../modules/conto-terzi/views/conto-terzi-home-standalone.html" class="dashboard-module-tile" data-module="contoTerzi" style="--module-accent:#1976D2;">
            <span class="dashboard-module-tile__icon" aria-hidden="true">🤝</span>
            <span class="dashboard-module-tile__body">
                <span class="dashboard-module-tile__title">Conto Terzi</span>
                <span class="dashboard-module-tile__desc">Lavori per conto terzi e contratti. Tariffe, preventivi e consuntivi.</span>
            </span>
        </a>
    `;
    return section;
};

/**
 * Card Vendemmia Meccanica — servizio CT (richiede contoTerzi)
 */
window.GFVDashboardSections.createVendemmiaMeccanicaCard = function createVendemmiaMeccanicaCard() {
    const section = document.createElement('div');
    section.className = 'dashboard-section dashboard-section--module-tile';
    section.innerHTML = `
        <a href="../modules/vendemmia-meccanica/views/vm-home-standalone.html" class="dashboard-module-tile" data-module="vendemmiaMeccanica" style="--module-accent:#6A1B9A;">
            <span class="dashboard-module-tile__icon" aria-hidden="true">🍇</span>
            <span class="dashboard-module-tile__body">
                <span class="dashboard-module-tile__title">Vendemmia Meccanica</span>
                <span class="dashboard-module-tile__desc">Piano stagione, calcolo compenso e bilancio del servizio meccanizzato CT.</span>
            </span>
        </a>
    `;
    return section;
};

/**
 * Card Vigneto — tile compatto
 */
window.GFVDashboardSections.createVignetoCard = function createVignetoCard() {
    const section = document.createElement('div');
    section.className = 'dashboard-section dashboard-section--module-tile';
    section.innerHTML = `
        <a href="../modules/vigneto/views/vigneto-dashboard-standalone.html" class="dashboard-module-tile" data-module="vigneto" style="--module-accent:#6A1B9A;">
            <span class="dashboard-module-tile__icon" aria-hidden="true">🍇</span>
            <span class="dashboard-module-tile__body">
                <span class="dashboard-module-tile__title">Vigneto</span>
                <span class="dashboard-module-tile__desc">Filari, produzione e vendemmia. Interventi e registrazioni in campo.</span>
            </span>
        </a>
    `;
    return section;
};

/**
 * Card Frutteto — tile compatto
 */
window.GFVDashboardSections.createFruttetoCard = function createFruttetoCard() {
    const section = document.createElement('div');
    section.className = 'dashboard-section dashboard-section--module-tile';
    section.innerHTML = `
        <a href="../modules/frutteto/views/frutteto-dashboard-standalone.html" class="dashboard-module-tile" data-module="frutteto" style="--module-accent:#FF6F00;">
            <span class="dashboard-module-tile__icon" aria-hidden="true">🍎</span>
            <span class="dashboard-module-tile__body">
                <span class="dashboard-module-tile__title">Frutteto</span>
                <span class="dashboard-module-tile__desc">Alberi, raccolta e qualità. Pianificazione colture e interventi.</span>
            </span>
        </a>
    `;
    return section;
};

/**
 * Card Magazzino — tile compatto (badge sotto-scorta se presente)
 */
window.GFVDashboardSections.createMagazzinoCard = function createMagazzinoCard(sottoScortaCount) {
    const section = document.createElement('div');
    section.className = 'dashboard-section dashboard-section--module-tile';
    section.setAttribute('data-tony-briefing', 'scorte');

    const hasBadge = (sottoScortaCount != null && sottoScortaCount > 0);
    const alertBadge = hasBadge
        ? `<span class="dashboard-module-tile__badge" title="Prodotti sotto scorta minima">⚠ ${sottoScortaCount}</span>`
        : '';
    const tileMod = hasBadge ? 'dashboard-module-tile dashboard-module-tile--has-badge' : 'dashboard-module-tile';

    section.innerHTML = `
        <a href="../modules/magazzino/views/magazzino-home-standalone.html" class="${tileMod}" data-module="magazzino" style="--module-accent:#2E7D32;">
            ${alertBadge}
            <span class="dashboard-module-tile__icon" aria-hidden="true">📦</span>
            <span class="dashboard-module-tile__body">
                <span class="dashboard-module-tile__title">Magazzino</span>
                <span class="dashboard-module-tile__desc">Scorte, movimenti e tracciabilità. Semi, fitosanitari e prodotti a magazzino.</span>
            </span>
        </a>
    `;

    return section;
};

/**
 * Card Manodopera — tile compatto (hub modulo)
 */
window.GFVDashboardSections.createManodoperaCard = function createManodoperaCard() {
    const section = document.createElement('div');
    section.className = 'dashboard-section dashboard-section--module-tile';
    section.innerHTML = `
        <a href="../modules/manodopera/views/manodopera-home-standalone.html" class="dashboard-module-tile" data-module="manodopera" style="--module-accent:#2E8B57;">
            <span class="dashboard-module-tile__icon" aria-hidden="true">👷</span>
            <span class="dashboard-module-tile__body">
                <span class="dashboard-module-tile__title">Manodopera</span>
                <span class="dashboard-module-tile__desc">Lavori, squadre e ore. Pianificazione, validazione e compensi.</span>
            </span>
        </a>
    `;
    return section;
};

/**
 * Aggiorna badge sotto-scorta su tutte le tile magazzino già renderizzate.
 * @param {number} sottoScortaCount
 */
window.GFVDashboardSections.updateMagazzinoSottoScortaBadge = function updateMagazzinoSottoScortaBadge(sottoScortaCount) {
    const n = sottoScortaCount != null ? Number(sottoScortaCount) : 0;
    document.querySelectorAll('a.dashboard-module-tile[data-module="magazzino"]').forEach((tile) => {
        const existing = tile.querySelector('.dashboard-module-tile__badge');
        if (n > 0) {
            if (existing) {
                existing.textContent = `⚠ ${n}`;
            } else {
                tile.insertAdjacentHTML(
                    'afterbegin',
                    `<span class="dashboard-module-tile__badge" title="Prodotti sotto scorta minima">⚠ ${n}</span>`
                );
            }
            tile.classList.add('dashboard-module-tile--has-badge');
        } else {
            if (existing) existing.remove();
            tile.classList.remove('dashboard-module-tile--has-badge');
        }
    });
};

/**
 * Card Parco Macchine — tile compatto
 */
window.GFVDashboardSections.createMacchineCard = function createMacchineCard() {
    const section = document.createElement('div');
    section.className = 'dashboard-section dashboard-section--module-tile';
    section.setAttribute('data-tony-briefing', 'scadenze');

    section.innerHTML = `
        <a href="../modules/macchine/views/macchine-dashboard-standalone.html" class="dashboard-module-tile" data-module="parcoMacchine" style="--module-accent:#0097A7;">
            <span class="dashboard-module-tile__icon" aria-hidden="true">🚜</span>
            <span class="dashboard-module-tile__body">
                <span class="dashboard-module-tile__title">Parco Macchine</span>
                <span class="dashboard-module-tile__desc">Mezzi, ore e consumi. Scadenzario tagliandi e interventi di manutenzione.</span>
            </span>
        </a>
    `;

    // Ancora per highlight Tony RIASSUNTO (guasti): prima era sul box "Guasti segnalati", rimosso in favore dell'hub panoramica.
    const tonyGuastiAnchor = document.createElement('span');
    tonyGuastiAnchor.setAttribute('data-tony-briefing', 'guasti');
    tonyGuastiAnchor.setAttribute('aria-hidden', 'true');
    tonyGuastiAnchor.className = 'dashboard-tony-briefing-anchor';
    section.appendChild(tonyGuastiAnchor);

    return section;
};

/**
 * Card Meteo — tile modulo pay-per-use
 */
window.GFVDashboardSections.createMeteoCard = function createMeteoCard() {
    const section = document.createElement('div');
    section.className = 'dashboard-section dashboard-section--module-tile';

    section.innerHTML = `
        <a href="../modules/meteo/views/meteo-dashboard-standalone.html" class="dashboard-module-tile" data-module="meteo" style="--module-accent:#0288D1;">
            <span class="dashboard-module-tile__icon" aria-hidden="true">🌦️</span>
            <span class="dashboard-module-tile__body">
                <span class="dashboard-module-tile__title">Meteo</span>
                <span class="dashboard-module-tile__desc">Previsioni per sede e terreni, alert e ore successive.</span>
            </span>
        </a>
    `;

    return section;
};

/**
 * Card Report — tile compatto (accent scuro come modulo report)
 */
window.GFVDashboardSections.createReportCard = function createReportCard() {
    const section = document.createElement('div');
    section.className = 'dashboard-section dashboard-section--module-tile';

    section.innerHTML = `
        <a href="../modules/report/views/report-dashboard-standalone.html" class="dashboard-module-tile" data-module="report" style="--module-accent:#374151;">
            <span class="dashboard-module-tile__icon" aria-hidden="true">📑</span>
            <span class="dashboard-module-tile__body">
                <span class="dashboard-module-tile__title">Report</span>
                <span class="dashboard-module-tile__desc">Report predefiniti ed esportazioni. Dati riaggregati per analisi e revisione.</span>
            </span>
        </a>
    `;

    return section;
};

/**
 * Sezione Manager - Gestione Lavori
 */
window.GFVDashboardSections.createManagerLavoriSection = function createManagerLavoriSection(userData, availableModules, loadStatsCallback, loadRecentCallback) {
    const section = document.createElement('div');
    section.className = 'dashboard-section';
    
    // Verifica se modulo Conto Terzi è attivo
    const hasContoTerzi = availableModules && availableModules.includes('contoTerzi');
    
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
            ${hasContoTerzi ? `
            <a href="admin/gestione-lavori-standalone.html?stato=da_pianificare" class="stat-card" style="text-decoration: none; color: inherit; cursor: pointer;" title="Clicca per vedere i lavori da pianificare">
                <div class="stat-value" id="stat-lavori-pianificati">-</div>
                <div class="stat-label">Lavori Pianificati</div>
            </a>
            ` : ''}
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
        <div id="comunicazioni-inviate-section" style="background: white; border: 1px solid #e9ecef; border-radius: 12px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #2E8B57; font-size: 18px; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; justify-content: space-between;">
                <span style="display: flex; align-items: center; gap: 8px;">
                    <span>📋</span> Comunicazioni Inviate
                </span>
                <a href="admin/impostazioni-standalone.html" style="font-size: 13px; color: #2E8B57; text-decoration: none; font-weight: normal;">
                    Vedi tutte →
                </a>
            </h3>
            <div id="comunicazioni-inviate-content">
                <div style="text-align: center; padding: 15px; color: #666;">Caricamento...</div>
            </div>
        </div>
        <h3 style="margin: 20px 0 15px 0; font-size: 16px; color: #666;">Azioni Rapide</h3>
        <div class="quick-actions">
            <a href="mobile/field-workspace-standalone.html?ws=mobile" class="action-card">
                <span class="action-icon">📱</span>
                <span class="action-title">Workspace Mobile</span>
                <span class="action-description">Interfaccia rapida a scorrimento per campo</span>
            </a>
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
            <a href="mobile/field-workspace-standalone.html?ws=mobile" class="action-card">
                <span class="action-icon">📱</span>
                <span class="action-title">Workspace Mobile</span>
                <span class="action-description">Apri il flusso mobile rapido giornaliero</span>
            </a>
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

