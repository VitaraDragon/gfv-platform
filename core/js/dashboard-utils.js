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

