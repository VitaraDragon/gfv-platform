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

/**
 * Provenienza della pagina guasti.
 * `field` o `mobile` = aperta dal workspace. Vuoto = desktop / nessun from.
 * @param {string} [da]
 * @returns {'field'|'mobile'|''}
 */
export function normalizzaProvenienzaGuasti(da) {
    const v = String(da || '').toLowerCase().trim();
    if (v === 'field' || v === 'mobile') return v;
    return '';
}

/**
 * La provenienza vince sul ruolo.
 * Dal workspace si torna al campo solo se il profilo è campo puro (niente loop).
 * Senza provenienza si torna sempre in dashboard.
 * @returns {{ href: string, etichetta: string }}
 */
export function ritornoSegnalazioneGuasti(ruoli, ruoloSingolo, da) {
    const dalCampo = normalizzaProvenienzaGuasti(da) !== '';
    const versoCampo = dalCampo && ritornoWorkspaceCampoDaGuasti(ruoli, ruoloSingolo);
    return versoCampo
        ? { href: '../mobile/field-workspace-standalone.html', etichetta: '← Campo' }
        : { href: '../dashboard-standalone.html', etichetta: '← Dashboard' };
}

export function hrefRitornoSegnalazioneGuasti(ruoli, ruoloSingolo, da) {
    return ritornoSegnalazioneGuasti(ruoli, ruoloSingolo, da).href;
}

export function etichettaRitornoSegnalazioneGuasti(ruoli, ruoloSingolo, da) {
    return ritornoSegnalazioneGuasti(ruoli, ruoloSingolo, da).etichetta;
}

/** Prima opzione della select Trattore quando l'elenco è vuoto o c'è scelta. */
export function testoOpzioneTrattore(numeroTrattori) {
    return Number(numeroTrattori) > 0 ? '-- Seleziona trattore --' : 'Nessun trattore disponibile';
}

/**
 * Sospensione del lavoro dopo un guasto grave.
 * Manager/admin: sì. Caposquadra: solo il proprio lavoro. Operaio: no.
 */
export function deveTentareSospensioneLavoroGuasto({ ruoli, ruoloSingolo, uid, lavoro } = {}) {
    const n = normalizzaRuoliGuasti(ruoli, ruoloSingolo);
    if (n.includes('manager') || n.includes('amministratore')) return true;
    if (!n.includes('caposquadra')) return false;
    if (!lavoro || !uid) return false;
    return String(lavoro.caposquadraId || '') === String(uid);
}

const AVVISO_SECONDARIA_GUASTO = 'Non ho potuto aggiornare lo stato della macchina/il lavoro: avvisa il tuo responsabile.';

/**
 * Esito dopo le scritture della segnalazione.
 * La scrittura su `guasti` è essenziale. Macchina e lavoro sono secondarie.
 * @param {{ scritturaPrincipaleOk?: boolean, secondarie?: Array<{ nome?: string, ok?: boolean, errore?: string }> }} input
 * @returns {{ chiudi: boolean, successo: boolean, avvisi: string[], errore: string|null }}
 */
export function esitoSegnalazioneGuasto({ scritturaPrincipaleOk, secondarie } = {}) {
    const list = Array.isArray(secondarie) ? secondarie : [];
    if (!scritturaPrincipaleOk) {
        const conErrore = list.find((s) => s && s.errore);
        return {
            chiudi: false,
            successo: false,
            avvisi: [],
            errore: (conErrore && conErrore.errore) || 'Errore segnalazione'
        };
    }
    const fallite = list.filter((s) => s && s.ok === false);
    return {
        chiudi: true,
        successo: true,
        avvisi: fallite.length ? [AVVISO_SECONDARIA_GUASTO] : [],
        errore: null
    };
}

/**
 * Testo del banner dopo un invio riuscito.
 * Dal profilo campo si torna al workspace. Se un aggiornamento secondario
 * è fallito, niente ritorno automatico: l’utente deve poter leggere l’avviso.
 * @param {{ dalCampo?: boolean, haAvvisi?: boolean }} input
 */
export function testoConfermaSegnalazione({ dalCampo, haAvvisi } = {}) {
  return {
    titolo: 'Segnalazione inviata. Grazie.',
    dettaglio: haAvvisi
      ? 'Non ho potuto aggiornare lo stato della macchina o del lavoro: avvisa il tuo responsabile.'
      : (dalCampo ? 'Torno al workspace…' : 'La trovi in «I Miei Guasti Segnalati».'),
    tornaAutomatico: !!dalCampo && !haAvvisi,
    mostraTornaWorkspace: !!dalCampo && !!haAvvisi
  };
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
