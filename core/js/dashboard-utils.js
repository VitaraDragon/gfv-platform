/**
 * Dashboard Utilities - Funzioni di utilità per la dashboard
 * Gestisce ruoli, normalizzazione, escape HTML, etc.
 */

// Namespace per evitare conflitti
window.GFVDashboardUtils = window.GFVDashboardUtils || {};

// Ruoli disponibili con nomi display
window.GFVDashboardUtils.roleNames = {
    'amministratore': '👑 Amministratore',
    'manager': '📊 Manager',
    'caposquadra': '👷 Caposquadra',
    'operaio': '🔧 Operaio'
};

/**
 * Normalizza i ruoli (converte varianti in ruoli standard)
 * @param {string} role - Ruolo da normalizzare
 * @returns {string} Ruolo normalizzato
 */
window.GFVDashboardUtils.normalizeRole = function normalizeRole(role) {
    if (!role) return role;
    const roleLower = role.toLowerCase().trim();
    
    // Mappa varianti comuni ai ruoli standard
    const roleMap = {
        'aggiungi amministratore': 'amministratore',
        'admin': 'amministratore',
        'administrator': 'amministratore',
        'mgr': 'manager',
        'capo squadra': 'caposquadra',
        'capo-squadra': 'caposquadra',
        'worker': 'operaio',
        'operario': 'operaio'
    };
    
    return roleMap[roleLower] || roleLower;
}

/**
 * Normalizza array di ruoli
 * @param {Array<string>} ruoli - Array di ruoli da normalizzare
 * @returns {Array<string>} Array di ruoli normalizzati
 */
window.GFVDashboardUtils.normalizeRoles = function normalizeRoles(ruoli) {
    if (!Array.isArray(ruoli)) return [];
    return ruoli.map(r => window.GFVDashboardUtils.normalizeRole(r));
}

/**
 * Funzione per escape HTML (prevenzione XSS)
 * @param {string} text - Testo da escapare
 * @returns {string} Testo escapato
 */
window.GFVDashboardUtils.escapeHtml = function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Verifica se utente ha un ruolo (con normalizzazione)
 * @param {Object} userData - Dati utente
 * @param {string} role - Ruolo da verificare
 * @returns {boolean} true se ha il ruolo
 */
window.GFVDashboardUtils.hasRole = function hasRole(userData, role) {
    if (!userData || !userData.ruoli) return false;
    const normalizedRoles = window.GFVDashboardUtils.normalizeRoles(userData.ruoli);
    const normalizedRole = window.GFVDashboardUtils.normalizeRole(role);
    return normalizedRoles.includes(normalizedRole);
}

/**
 * Verifica se utente ha almeno uno dei ruoli (con normalizzazione)
 * @param {Object} userData - Dati utente
 * @param {Array<string>} roles - Array di ruoli da verificare
 * @returns {boolean} true se ha almeno un ruolo
 */
window.GFVDashboardUtils.hasAnyRole = function hasAnyRole(userData, roles) {
    if (!userData || !userData.ruoli) return false;
    const normalizedRoles = window.GFVDashboardUtils.normalizeRoles(userData.ruoli);
    const normalizedCheckRoles = roles.map(r => window.GFVDashboardUtils.normalizeRole(r));
    return normalizedCheckRoles.some(role => normalizedRoles.includes(role));
}

/**
 * Verifica se ha solo moduli core (nessun modulo avanzato)
 * @param {Array<string>} modules - Array di moduli
 * @returns {boolean} true se ha solo moduli core
 */
window.GFVDashboardUtils.hasOnlyCoreModules = function hasOnlyCoreModules(modules) {
    if (!modules || modules.length === 0) return true;
    // Filtra 'core' se presente (è sempre incluso)
    const advancedModules = modules.filter(m => m !== 'core');
    return advancedModules.length === 0;
}

/**
 * Verifica se modulo Manodopera è attivo
 * @param {Array<string>} availableModules - Array di moduli disponibili
 * @returns {boolean} true se Manodopera è attivo
 */
window.GFVDashboardUtils.hasManodoperaModule = function hasManodoperaModule(availableModules) {
    return availableModules && availableModules.includes('manodopera');
}

// ============================================
// WORKSPACE MOBILE RUOLI CAMPO
// ============================================

window.GFVDashboardUtils.FIELD_WORKSPACE_PREF_KEY = 'gfv_field_workspace_pref';

/**
 * Device check pragmatico per UX mobile.
 * Usa combinazione viewport, pointer coarse e user-agent per evitare falsi positivi.
 * @returns {boolean}
 */
window.GFVDashboardUtils.isLikelyMobileDevice = function isLikelyMobileDevice() {
    try {
        const isSmallViewport = window.matchMedia('(max-width: 900px)').matches;
        const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
        const ua = (navigator.userAgent || '').toLowerCase();
        const isMobileUA = /android|iphone|ipad|ipod|mobile/.test(ua);
        return (isSmallViewport && isCoarsePointer) || isMobileUA;
    } catch (error) {
        return false;
    }
}

/**
 * Ritorna preferenza utente:
 * - auto (default): redirect automatico su mobile per ruoli campo
 * - classic: forza dashboard classica
 * - mobile: forza workspace mobile
 * @returns {'auto'|'classic'|'mobile'}
 */
window.GFVDashboardUtils.getFieldWorkspacePreference = function getFieldWorkspacePreference() {
    try {
        const raw = localStorage.getItem(window.GFVDashboardUtils.FIELD_WORKSPACE_PREF_KEY);
        if (raw === 'classic' || raw === 'mobile' || raw === 'auto') {
            return raw;
        }
        return 'auto';
    } catch (error) {
        return 'auto';
    }
}

/**
 * Salva preferenza utente per workspace mobile.
 * @param {'auto'|'classic'|'mobile'} value
 */
window.GFVDashboardUtils.setFieldWorkspacePreference = function setFieldWorkspacePreference(value) {
    if (value !== 'classic' && value !== 'mobile' && value !== 'auto') {
        return;
    }
    try {
        localStorage.setItem(window.GFVDashboardUtils.FIELD_WORKSPACE_PREF_KEY, value);
    } catch (error) {
        // ignore storage errors
    }
}

/**
 * Decide se mostrare workspace mobile ruoli campo.
 * Non devia mai manager/amministratore per mantenere UX invariata.
 * @param {Object} userData
 * @param {Array<string>} availableModules
 * @returns {boolean}
 */
window.GFVDashboardUtils.shouldUseFieldMobileWorkspace = function shouldUseFieldMobileWorkspace(userData, availableModules = []) {
    if (!userData) return false;
    const hasManodopera = window.GFVDashboardUtils.hasManodoperaModule(availableModules);
    if (!hasManodopera) return false;

    const hasManagerRole = window.GFVDashboardUtils.hasAnyRole(userData, ['manager', 'amministratore']);
    if (hasManagerRole) return false;

    const hasFieldRole = window.GFVDashboardUtils.hasAnyRole(userData, ['operaio', 'caposquadra']);
    if (!hasFieldRole) return false;

    const pref = window.GFVDashboardUtils.getFieldWorkspacePreference();
    if (pref === 'classic') return false;
    if (pref === 'mobile') return true;

    return window.GFVDashboardUtils.isLikelyMobileDevice();
}

