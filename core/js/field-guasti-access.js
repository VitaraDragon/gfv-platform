/**
 * Accesso alla segnalazione guasti dal profilo campo.
 * Stesso form della pagina desktop: operaio e caposquadra (anche capo-only).
 * Manager/admin, anche con ruolo campo, tornano in dashboard (niente loop col workspace).
 */

export function normalizzaRuoliGuasti(ruoli, ruoloSingolo) {
    const list = [];
    if (Array.isArray(ruoli)) {
        for (let i = 0; i < ruoli.length; i++) list.push(ruoli[i]);
    }
    if (ruoloSingolo) list.push(ruoloSingolo);
    return list
        .map((r) => String(r || '').toLowerCase().trim())
        .filter(Boolean);
}

/** Operaio o caposquadra, anche se ha anche manager/admin. */
export function puoAprireSegnalazioneGuasti(ruoli, ruoloSingolo) {
    const n = normalizzaRuoliGuasti(ruoli, ruoloSingolo);
    return n.includes('operaio') || n.includes('caposquadra');
}

/**
 * true solo per il profilo campo puro (niente manager/amministratore).
 * Il ritorno al workspace per un manager+capo rimbalzerebbe sulla dashboard.
 */
export function ritornoWorkspaceCampoDaGuasti(ruoli, ruoloSingolo) {
    const n = normalizzaRuoliGuasti(ruoli, ruoloSingolo);
    if (n.includes('manager') || n.includes('amministratore')) return false;
    return n.includes('operaio') || n.includes('caposquadra');
}

export function hrefRitornoSegnalazioneGuasti(ruoli, ruoloSingolo) {
    return ritornoWorkspaceCampoDaGuasti(ruoli, ruoloSingolo)
        ? '../mobile/field-workspace-standalone.html'
        : '../dashboard-standalone.html';
}

export function etichettaRitornoSegnalazioneGuasti(ruoli, ruoloSingolo) {
    return ritornoWorkspaceCampoDaGuasti(ruoli, ruoloSingolo) ? '← Campo' : '← Dashboard';
}

/**
 * tenantId sul documento utente, altrimenti la membership attiva.
 * Stesso ordine di resolveCurrentTenantId in dashboard-standalone.html.
 */
export function primoTenantIdUtente(userData) {
    if (!userData || typeof userData !== 'object') return null;
    if (userData.tenantId) return String(userData.tenantId);
    const memberships = userData.tenantMemberships;
    if (!memberships || typeof memberships !== 'object') return null;
    const entries = Object.entries(memberships);
    const active = entries.find(([, m]) => m && m.stato === 'attivo');
    if (active) return active[0];
    const def = entries.find(([, m]) => m && m.tenantIdPredefinito);
    if (def) return def[0];
    if (entries.length === 1) return entries[0][0];
    return null;
}
