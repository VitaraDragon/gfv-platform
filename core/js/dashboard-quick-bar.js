/**
 * Barra orizzontale con 5 accessi rapidi configurabili (catalogo consentito, localStorage per utente).
 * Configurazione: elenco di card per modulo, non menu a tendina.
 * @module core/js/dashboard-quick-bar
 */

import {
    countOreDaValidareManager,
    loadGuastiApertiCount,
    loadMagazzinoSottoScortaCount,
    loadLavoriDaPianificareCount
} from './dashboard-data.js';

const STORAGE_PREFIX = 'gfv_dash_quickbar_v1_';
const SLOT_COUNT = 5;

/**
 * Sezioni elenco configurazione (ordine visualizzazione).
 * Ogni voce catalogo ha `section` uguale a uno di questi id.
 * `dashboardRouteId`: chiave catalogo della dashboard del modulo (stessa riga del titolo); null se assente.
 */
export const QUICK_BAR_SECTION_ORDER = [
    { id: 'core', label: 'Core e strumenti', dashboardRouteId: null },
    { id: 'manodopera', label: 'Manodopera', dashboardRouteId: null },
    { id: 'contoTerzi', label: 'Conto Terzi', dashboardRouteId: 'contoTerziHome' },
    { id: 'parcoMacchine', label: 'Parco macchine', dashboardRouteId: 'parcoDashboard' },
    { id: 'vigneto', label: 'Vigneto', dashboardRouteId: 'vigneto' },
    { id: 'frutteto', label: 'Frutteto', dashboardRouteId: 'frutteto' },
    { id: 'magazzino', label: 'Magazzino', dashboardRouteId: 'magazzino' },
    { id: 'report', label: 'Report', dashboardRouteId: 'report' }
];

/** Catalogo voci: solo percorsi mappati qui (sicurezza). Icone come hub/tile dashboard e card dei moduli. */
export const QUICK_BAR_CATALOG = {
    terreni: {
        label: 'Terreni',
        desc: 'Gestisci terreni e vigneti',
        icon: '🗺️',
        href: 'terreni-standalone.html',
        modules: [],
        requireManodopera: false,
        section: 'core'
    },
    diarioAttivita: {
        label: 'Diario attività',
        desc: 'Registro attività in campo',
        icon: '📅',
        href: 'attivita-standalone.html',
        modules: [],
        requireManodopera: false,
        hideWhenManodopera: true,
        section: 'core'
    },
    mappa: {
        label: 'Mappa aziendale',
        desc: 'Terreni e overlay su mappa',
        icon: '🗺️',
        href: 'mappa-aziendale-standalone.html',
        modules: [],
        requireManodopera: false,
        section: 'core'
    },
    amministrazione: {
        label: 'Amministrazione',
        desc: 'Utenti, ruoli e impostazioni',
        icon: '👑',
        href: 'admin/amministrazione-standalone.html',
        modules: [],
        requireManodopera: false,
        section: 'core'
    },
    impostazioni: {
        label: 'Impostazioni',
        desc: 'Preferenze account e servizio',
        icon: '⚙️',
        href: 'admin/impostazioni-standalone.html',
        modules: [],
        requireManodopera: false,
        section: 'core'
    },
    statisticheCore: {
        label: 'Statistiche',
        desc: 'KPI e grafici aziendali',
        icon: '📊',
        href: 'statistiche-standalone.html',
        modules: [],
        requireManodopera: false,
        hideWhenManodopera: true,
        section: 'core'
    },
    statisticheManodopera: {
        label: 'Statistiche',
        desc: 'Ore, lavori e squadre',
        icon: '📊',
        href: 'admin/statistiche-manodopera-standalone.html',
        modules: [],
        requireManodopera: true,
        section: 'manodopera'
    },
    gestioneLavori: {
        label: 'Gestione Lavori',
        desc: 'Crea, modifica e assegna lavori',
        icon: '📋',
        href: 'admin/gestione-lavori-standalone.html',
        modules: [],
        requireManodopera: true,
        section: 'manodopera'
    },
    lavoriDaPianificare: {
        label: 'Da pianificare',
        desc: 'Bozze lavori da assegnare',
        icon: '📝',
        href: 'admin/gestione-lavori-standalone.html?stato=da_pianificare',
        modules: ['contoTerzi'],
        requireManodopera: true,
        badge: 'daPianificare',
        section: 'contoTerzi'
    },
    validazioneOre: {
        label: 'Validazione ore',
        desc: 'Valida ore lavori autonomi',
        icon: '✅',
        href: 'admin/validazione-ore-standalone.html',
        modules: [],
        requireManodopera: true,
        badge: 'oreDaValidare',
        section: 'manodopera'
    },
    gestioneSquadre: {
        label: 'Gestione squadre',
        desc: 'Squadre e assegnazioni',
        icon: '👷',
        href: 'admin/gestione-squadre-standalone.html',
        modules: [],
        requireManodopera: true,
        section: 'manodopera'
    },
    gestisciUtenti: {
        label: 'Gestisci utenti',
        desc: 'Inviti e permessi',
        icon: '👥',
        href: 'admin/gestisci-utenti-standalone.html',
        modules: [],
        requireManodopera: true,
        section: 'manodopera'
    },
    gestioneOperai: {
        label: 'Gestione operai',
        desc: 'Contratti e anagrafica operai',
        icon: '👷‍♂️',
        href: 'admin/gestione-operai-standalone.html',
        modules: [],
        requireManodopera: true,
        section: 'manodopera'
    },
    compensiOperai: {
        label: 'Compensi operai',
        desc: 'Calcolo compensi',
        icon: '💰',
        href: 'admin/compensi-operai-standalone.html',
        modules: [],
        requireManodopera: true,
        section: 'manodopera'
    },
    segnaturaOre: {
        label: 'Segnatura ore',
        desc: 'Registra ore lavorate',
        icon: '⏰',
        href: 'segnatura-ore-standalone.html',
        modules: [],
        requireManodopera: true,
        visibleForRoles: ['operaio', 'caposquadra'],
        section: 'manodopera'
    },
    lavoriCaposquadra: {
        label: 'Lavori caposquadra',
        desc: 'Vista lavori per caposquadra',
        icon: '📋',
        href: 'admin/lavori-caposquadra-standalone.html',
        modules: [],
        requireManodopera: true,
        visibleForRoles: ['caposquadra'],
        section: 'manodopera'
    },
    gestioneMacchine: {
        label: 'Gestione macchine',
        desc: 'Parco macchine e anagrafica',
        icon: '🚜',
        href: 'admin/gestione-macchine-standalone.html',
        modules: ['parcoMacchine'],
        requireManodopera: true,
        section: 'parcoMacchine'
    },
    guasti: {
        label: 'Guasti',
        desc: 'Segnalazioni e interventi',
        icon: '⚠️',
        href: '../modules/macchine/views/guasti-list-standalone.html',
        modules: ['parcoMacchine'],
        requireManodopera: false,
        badge: 'guastiAperti',
        section: 'parcoMacchine'
    },
    scadenzeMezzi: {
        label: 'Scadenze mezzi',
        desc: 'Tagliandi e revisioni',
        icon: '📅',
        href: '../modules/macchine/views/scadenze-list-standalone.html',
        modules: ['parcoMacchine'],
        requireManodopera: false,
        section: 'parcoMacchine'
    },
    parcoDashboard: {
        label: 'Parco macchine',
        desc: 'Dashboard mezzi e uso',
        icon: '🚜',
        href: '../modules/macchine/views/macchine-dashboard-standalone.html',
        modules: ['parcoMacchine'],
        requireManodopera: false,
        section: 'parcoMacchine'
    },
    parcoTrattori: {
        label: 'Trattori',
        desc: 'Elenco trattori',
        icon: '🚜',
        href: '../modules/macchine/views/trattori-list-standalone.html',
        modules: ['parcoMacchine'],
        requireManodopera: false,
        section: 'parcoMacchine'
    },
    parcoAttrezzi: {
        label: 'Attrezzi',
        desc: 'Elenco attrezzature',
        icon: '🛠️',
        href: '../modules/macchine/views/attrezzi-list-standalone.html',
        modules: ['parcoMacchine'],
        requireManodopera: false,
        section: 'parcoMacchine'
    },
    parcoFlotta: {
        label: 'Flotta',
        desc: 'Flotta aziendale',
        icon: '🚚',
        href: '../modules/macchine/views/flotta-list-standalone.html',
        modules: ['parcoMacchine'],
        requireManodopera: false,
        section: 'parcoMacchine'
    },
    contoTerziHome: {
        label: 'Conto Terzi',
        desc: 'Home modulo conto terzi',
        icon: '🤝',
        href: '../modules/conto-terzi/views/conto-terzi-home-standalone.html',
        modules: ['contoTerzi'],
        requireManodopera: false,
        section: 'contoTerzi'
    },
    preventivi: {
        label: 'Preventivi',
        desc: 'Lista e gestione preventivi',
        icon: '📋',
        href: '../modules/conto-terzi/views/preventivi-standalone.html',
        modules: ['contoTerzi'],
        requireManodopera: false,
        section: 'contoTerzi'
    },
    nuovoPreventivo: {
        label: 'Nuovo preventivo',
        desc: 'Crea un nuovo preventivo',
        icon: '📋',
        href: '../modules/conto-terzi/views/nuovo-preventivo-standalone.html',
        modules: ['contoTerzi'],
        requireManodopera: false,
        section: 'contoTerzi'
    },
    ctClienti: {
        label: 'Clienti',
        desc: 'Anagrafica clienti conto terzi',
        icon: '👥',
        href: '../modules/conto-terzi/views/clienti-standalone.html',
        modules: ['contoTerzi'],
        requireManodopera: false,
        section: 'contoTerzi'
    },
    ctTerreniClienti: {
        label: 'Terreni cliente',
        desc: 'Terreni affidati ai clienti',
        icon: '🗺️',
        href: '../modules/conto-terzi/views/terreni-clienti-standalone.html',
        modules: ['contoTerzi'],
        requireManodopera: false,
        section: 'contoTerzi'
    },
    ctMappaClienti: {
        label: 'Mappa clienti',
        desc: 'Mappa terreni conto terzi',
        icon: '🌍',
        href: '../modules/conto-terzi/views/mappa-clienti-standalone.html',
        modules: ['contoTerzi'],
        requireManodopera: false,
        section: 'contoTerzi'
    },
    ctTariffe: {
        label: 'Tariffe',
        desc: 'Listini e tariffe lavorazioni',
        icon: '💰',
        href: '../modules/conto-terzi/views/tariffe-standalone.html',
        modules: ['contoTerzi'],
        requireManodopera: false,
        section: 'contoTerzi'
    },
    ctAttivitaInCorso: {
        label: 'Lavori CT in corso',
        desc: 'Attività conto terzi in corso',
        icon: '🔄',
        href: 'attivita-standalone.html?contoTerzi=true&stato=in_corso',
        modules: ['contoTerzi'],
        requireManodopera: false,
        section: 'contoTerzi'
    },
    ctAttivitaCompletate: {
        label: 'Lavori CT completati',
        desc: 'Attività conto terzi completate',
        icon: '✅',
        href: 'attivita-standalone.html?contoTerzi=true&stato=completato',
        modules: ['contoTerzi'],
        requireManodopera: false,
        section: 'contoTerzi'
    },
    vigneto: {
        label: 'Vigneto',
        desc: 'Dashboard vigneto',
        icon: '🍇',
        href: '../modules/vigneto/views/vigneto-dashboard-standalone.html',
        modules: ['vigneto'],
        requireManodopera: false,
        section: 'vigneto'
    },
    vignetoVigneti: {
        label: 'Vigneti',
        desc: 'Anagrafica e gestione vigneti',
        icon: '🍇',
        href: '../modules/vigneto/views/vigneti-standalone.html',
        modules: ['vigneto'],
        requireManodopera: false,
        section: 'vigneto'
    },
    vignetoVendemmia: {
        label: 'Vendemmia',
        desc: 'Registro vendemmie',
        icon: '🍷',
        href: '../modules/vigneto/views/vendemmia-standalone.html',
        modules: ['vigneto'],
        requireManodopera: false,
        section: 'vigneto'
    },
    vignetoPotatura: {
        label: 'Potatura (vigneto)',
        desc: 'Interventi di potatura',
        icon: '✂️',
        href: '../modules/vigneto/views/potatura-standalone.html',
        modules: ['vigneto'],
        requireManodopera: false,
        section: 'vigneto'
    },
    vignetoTrattamenti: {
        label: 'Trattamenti (vigneto)',
        desc: 'Trattamenti filari e vegetazione',
        icon: '🧪',
        href: '../modules/vigneto/views/trattamenti-standalone.html',
        modules: ['vigneto'],
        requireManodopera: false,
        section: 'vigneto'
    },
    vignetoConcimazioni: {
        label: 'Concimazioni (vigneto)',
        desc: 'Concimazioni e fertilizzazioni',
        icon: '🌱',
        href: '../modules/vigneto/views/concimazioni-standalone.html',
        modules: ['vigneto'],
        requireManodopera: false,
        section: 'vigneto'
    },
    vignetoStatistiche: {
        label: 'Statistiche vigneto',
        desc: 'KPI e riepiloghi vigneto',
        icon: '📊',
        href: '../modules/vigneto/views/vigneto-statistiche-standalone.html',
        modules: ['vigneto'],
        requireManodopera: false,
        section: 'vigneto'
    },
    vignetoPianificaImpianto: {
        label: 'Pianifica impianto (vigneto)',
        desc: 'Pianificazione nuovo impianto',
        icon: '📐',
        href: '../modules/vigneto/views/pianifica-impianto-standalone.html?coltura=vigneto',
        modules: ['vigneto'],
        requireManodopera: false,
        section: 'vigneto'
    },
    vignetoCalcoloMateriali: {
        label: 'Calcolo materiali (vigneto)',
        desc: 'Stima materiali da impianto',
        icon: '🔢',
        href: '../modules/vigneto/views/calcolo-materiali-standalone.html?coltura=vigneto',
        modules: ['vigneto'],
        requireManodopera: false,
        section: 'vigneto'
    },
    frutteto: {
        label: 'Frutteto',
        desc: 'Dashboard frutteto',
        icon: '🍎',
        href: '../modules/frutteto/views/frutteto-dashboard-standalone.html',
        modules: ['frutteto'],
        requireManodopera: false,
        section: 'frutteto'
    },
    fruttetoAlberi: {
        label: 'Frutteti',
        desc: 'Anagrafica impianti frutteto',
        icon: '🍎',
        href: '../modules/frutteto/views/frutteti-standalone.html',
        modules: ['frutteto'],
        requireManodopera: false,
        section: 'frutteto'
    },
    fruttetoRaccolta: {
        label: 'Raccolta',
        desc: 'Registro raccolta frutta',
        icon: '📦',
        href: '../modules/frutteto/views/raccolta-frutta-standalone.html',
        modules: ['frutteto'],
        requireManodopera: false,
        section: 'frutteto'
    },
    fruttetoPotatura: {
        label: 'Potatura (frutteto)',
        desc: 'Interventi di potatura',
        icon: '✂️',
        href: '../modules/frutteto/views/potatura-standalone.html',
        modules: ['frutteto'],
        requireManodopera: false,
        section: 'frutteto'
    },
    fruttetoTrattamenti: {
        label: 'Trattamenti (frutteto)',
        desc: 'Trattamenti impianto',
        icon: '🧪',
        href: '../modules/frutteto/views/trattamenti-standalone.html',
        modules: ['frutteto'],
        requireManodopera: false,
        section: 'frutteto'
    },
    fruttetoConcimazioni: {
        label: 'Concimazioni (frutteto)',
        desc: 'Concimazioni',
        icon: '🌱',
        href: '../modules/frutteto/views/concimazioni-standalone.html',
        modules: ['frutteto'],
        requireManodopera: false,
        section: 'frutteto'
    },
    fruttetoPianificaImpianto: {
        label: 'Pianifica impianto (frutteto)',
        desc: 'Pianificazione nuovo impianto',
        icon: '📐',
        href: '../modules/vigneto/views/pianifica-impianto-standalone.html?coltura=frutteto',
        modules: ['frutteto'],
        requireManodopera: false,
        section: 'frutteto'
    },
    fruttetoCalcoloMateriali: {
        label: 'Calcolo materiali (frutteto)',
        desc: 'Stima materiali da impianto',
        icon: '🔢',
        href: '../modules/vigneto/views/calcolo-materiali-standalone.html?coltura=frutteto',
        modules: ['frutteto'],
        requireManodopera: false,
        section: 'frutteto'
    },
    fruttetoStatistiche: {
        label: 'Statistiche frutteto',
        desc: 'KPI e riepiloghi frutteto',
        icon: '📊',
        href: '../modules/frutteto/views/frutteto-statistiche-standalone.html',
        modules: ['frutteto'],
        requireManodopera: false,
        section: 'frutteto'
    },
    magazzino: {
        label: 'Magazzino',
        desc: 'Scorte e movimenti',
        icon: '📦',
        href: '../modules/magazzino/views/magazzino-home-standalone.html',
        modules: ['magazzino'],
        requireManodopera: false,
        badge: 'sottoScorta',
        section: 'magazzino'
    },
    magazzinoProdotti: {
        label: 'Anagrafica prodotti',
        desc: 'Prodotti, categorie, soglie',
        icon: '📋',
        href: '../modules/magazzino/views/prodotti-standalone.html',
        modules: ['magazzino'],
        requireManodopera: false,
        section: 'magazzino'
    },
    magazzinoMovimenti: {
        label: 'Movimenti magazzino',
        desc: 'Entrate e uscite',
        icon: '📥',
        href: '../modules/magazzino/views/movimenti-standalone.html',
        modules: ['magazzino'],
        requireManodopera: false,
        section: 'magazzino'
    },
    magazzinoTracciabilita: {
        label: 'Tracciabilità consumi',
        desc: 'Uscite per categoria (lettura)',
        icon: '🔍',
        href: '../modules/magazzino/views/tracciabilita-consumi-standalone.html',
        modules: ['magazzino'],
        requireManodopera: false,
        section: 'magazzino'
    },
    report: {
        label: 'Report',
        desc: 'Report ed esportazioni',
        icon: '📑',
        href: '../modules/report/views/report-dashboard-standalone.html',
        modules: ['report'],
        requireManodopera: false,
        section: 'report'
    },
    reportTerreni: {
        label: 'Report terreni',
        desc: 'Stato campi e confronti',
        icon: '🗺️',
        href: '../modules/report/views/report-terreni-standalone.html',
        modules: ['report'],
        requireManodopera: false,
        section: 'report'
    },
    reportVignetoExport: {
        label: 'Export dati vigneto',
        desc: 'Tabelle vendemmie e lavori (MVP)',
        icon: '📑',
        href: '../modules/report/views/report-standalone.html',
        modules: ['report', 'vigneto'],
        requireManodopera: false,
        section: 'report'
    },
    abbonamento: {
        label: 'Abbonamento',
        desc: 'Piano e fatturazione',
        icon: '💳',
        href: 'admin/abbonamento-standalone.html',
        modules: [],
        requireManodopera: false,
        section: 'core'
    }
};

function storageKey(uid) {
    return `${STORAGE_PREFIX}${uid || 'anon'}`;
}

function getModulesList(ctx) {
    return Array.isArray(ctx.availableModules) ? ctx.availableModules : [];
}

export function isQuickBarRouteVisible(routeId, ctx) {
    const meta = QUICK_BAR_CATALOG[routeId];
    if (!meta) return false;
    if (meta.requireManodopera && !ctx.hasManodopera) return false;
    if (meta.hideWhenManodopera && ctx.hasManodopera) return false;
    const mods = getModulesList(ctx);
    if (meta.modules && meta.modules.length) {
        if (!meta.modules.every((m) => mods.includes(m))) return false;
    }
    if (meta.visibleForRoles && meta.visibleForRoles.length) {
        const roles = Array.isArray(ctx.userRoles) ? ctx.userRoles : [];
        const ok = meta.visibleForRoles.some((r) => roles.includes(String(r || '').toLowerCase()));
        if (!ok) return false;
    }
    return true;
}

function listVisibleRoutes(ctx) {
    return Object.keys(QUICK_BAR_CATALOG).filter((id) => isQuickBarRouteVisible(id, ctx));
}

function defaultSlots(ctx) {
    const prefer = [
        'gestioneLavori',
        'validazioneOre',
        'statisticheManodopera',
        'terreni',
        'gestioneSquadre',
        'statisticheCore',
        'preventivi',
        'vigneto',
        'guasti',
        'magazzino',
        'amministrazione'
    ];
    const out = [];
    for (const id of prefer) {
        if (out.length >= SLOT_COUNT) break;
        if (isQuickBarRouteVisible(id, ctx)) out.push(id);
    }
    const vis = listVisibleRoutes(ctx).filter((id) => !out.includes(id));
    for (const id of vis) {
        if (out.length >= SLOT_COUNT) break;
        out.push(id);
    }
    while (out.length < SLOT_COUNT) out.push(null);
    return out.slice(0, SLOT_COUNT);
}

function loadSlots(uid, ctx) {
    try {
        const raw = localStorage.getItem(storageKey(uid));
        const arr = JSON.parse(raw || '[]');
        if (!Array.isArray(arr) || arr.length !== SLOT_COUNT) return defaultSlots(ctx);
        const cleaned = arr.map((x) => (x && QUICK_BAR_CATALOG[x] && isQuickBarRouteVisible(x, ctx) ? x : null));
        if (cleaned.every((x) => x == null)) return defaultSlots(ctx);
        return cleaned;
    } catch {
        return defaultSlots(ctx);
    }
}

function saveSlots(uid, slots) {
    try {
        localStorage.setItem(storageKey(uid), JSON.stringify(slots.slice(0, SLOT_COUNT)));
    } catch (e) {
        console.warn('saveSlots quick bar:', e);
    }
}

function escapeAttr(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function escapeHtml(s) {
    return escapeAttr(s);
}

function buildBarHTML(slots, ctx, esc) {
    let html = '';
    slots.forEach((routeId, idx) => {
        if (!routeId || !QUICK_BAR_CATALOG[routeId]) {
            html += `
                <div class="action-card dashboard-quick-bar-slot dashboard-quick-bar-slot--empty" data-slot-index="${idx}">
                    <span class="action-icon" aria-hidden="true">⋯</span>
                    <span class="action-title">Slot vuoto</span>
                    <span class="action-description">Configura la barra per assegnare un accesso</span>
                </div>`;
            return;
        }
        const m = QUICK_BAR_CATALOG[routeId];
        const badgeAttr = m.badge ? ` data-badge-type="${escapeAttr(m.badge)}"` : '';
        const badge = m.badge
            ? `<span class="dashboard-quick-bar-badge" hidden>0</span>`
            : '';
        html += `
            <a href="${escapeAttr(m.href)}" class="action-card dashboard-quick-bar-slot"${badgeAttr} data-slot-index="${idx}" data-route-id="${escapeAttr(routeId)}">
                ${badge}
                <span class="action-icon" aria-hidden="true">${m.icon}</span>
                <span class="action-title">${esc(m.label)}</span>
                <span class="action-description">${esc(m.desc)}</span>
            </a>`;
    });
    return html;
}

async function refreshBadges(root, slots, tenantId, ctx, dependencies) {
    if (!tenantId || !root) return;
    const needOre = slots.includes('validazioneOre');
    const needGuasti = slots.includes('guasti');
    const needScorta = slots.includes('magazzino');
    const needPian = slots.includes('lavoriDaPianificare');

    let nOre = 0;
    let nGuasti = 0;
    let nScorta = 0;
    let nPian = 0;

    try {
        if (needOre) nOre = (await countOreDaValidareManager(tenantId, dependencies)) || 0;
        if (needGuasti) nGuasti = (await loadGuastiApertiCount(tenantId, dependencies)) || 0;
        if (needScorta) nScorta = (await loadMagazzinoSottoScortaCount(dependencies)) || 0;
        if (needPian) nPian = (await loadLavoriDaPianificareCount(tenantId, dependencies)) || 0;
    } catch (e) {
        console.warn('refreshBadges quick bar:', e);
    }

    root.querySelectorAll('a.dashboard-quick-bar-slot[data-badge-type]').forEach((el) => {
        const type = el.getAttribute('data-badge-type');
        const badge = el.querySelector('.dashboard-quick-bar-badge');
        if (!badge || !type) return;
        let n = 0;
        if (type === 'oreDaValidare') n = nOre;
        else if (type === 'guastiAperti') n = nGuasti;
        else if (type === 'sottoScorta') n = nScorta;
        else if (type === 'daPianificare') n = nPian;
        if (n > 0) {
            badge.textContent = n > 99 ? '99+' : String(n);
            badge.hidden = false;
        } else {
            badge.hidden = true;
        }
    });
}

function compactDraftFromSlots(slotArr) {
    const out = [];
    const seen = new Set();
    for (const x of slotArr) {
        if (!x || seen.has(x)) continue;
        if (!QUICK_BAR_CATALOG[x]) continue;
        seen.add(x);
        out.push(x);
        if (out.length >= SLOT_COUNT) break;
    }
    return out;
}

function draftOrderToSavedSlots(draftOrder) {
    const dense = draftOrder.filter(Boolean).slice(0, SLOT_COUNT);
    const out = dense.slice();
    while (out.length < SLOT_COUNT) out.push(null);
    return out;
}

function buildDraftPreviewHTML(draftOrder, esc) {
    let html = '<div class="quick-actions dashboard-quick-bar dashboard-quick-bar--draft">';
    for (let i = 0; i < SLOT_COUNT; i++) {
        const routeId = draftOrder[i];
        if (!routeId || !QUICK_BAR_CATALOG[routeId]) {
            html += `
                <div class="action-card dashboard-quick-bar-slot dashboard-quick-bar-slot--empty">
                    <span class="action-icon" aria-hidden="true">+</span>
                    <span class="action-title">Libero</span>
                    <span class="action-description">Scegli una voce qui sotto</span>
                </div>`;
            continue;
        }
        const m = QUICK_BAR_CATALOG[routeId];
        html += `
            <button type="button" class="action-card dashboard-quick-bar-slot dashboard-quick-bar-draft-slot"
              data-draft-remove="${escapeAttr(routeId)}"
              title="Rimuovi dalla barra"
              aria-label="Rimuovi ${esc(m.label)} dalla barra">
                <span class="action-icon" aria-hidden="true">${m.icon}</span>
                <span class="action-title">${esc(m.label)}</span>
                <span class="action-description">${esc(m.desc)}</span>
            </button>`;
    }
    html += '</div>';
    return html;
}

function buildPickCardHtml(id, draftSet, esc, extraClass = '') {
    const m = QUICK_BAR_CATALOG[id];
    if (!m) return '';
    const selected = draftSet.has(id);
    const selCl = selected ? ' is-selected' : '';
    const ec = extraClass ? ` ${extraClass}` : '';
    return `
            <button type="button"
              class="action-card dashboard-quick-bar-slot dashboard-quick-bar-pick-card${selCl}${ec}"
              data-route-id="${escapeAttr(id)}"
              aria-pressed="${selected ? 'true' : 'false'}">
                ${selected ? '<span class="dashboard-quick-bar-pick-card__check" aria-hidden="true">✓</span>' : ''}
                <span class="action-icon" aria-hidden="true">${m.icon}</span>
                <span class="action-title">${esc(m.label)}</span>
                <span class="action-description">${esc(m.desc)}</span>
            </button>`;
}

function buildCatalogHTML(ctx, draftSet, esc) {
    let html = '';
    for (const sec of QUICK_BAR_SECTION_ORDER) {
        const ids = listVisibleRoutes(ctx)
            .filter((id) => (QUICK_BAR_CATALOG[id].section || 'core') === sec.id)
            .sort((a, b) =>
                QUICK_BAR_CATALOG[a].label.localeCompare(QUICK_BAR_CATALOG[b].label, 'it', {
                    sensitivity: 'base'
                })
            );
        if (!ids.length) continue;

        const dashId = sec.dashboardRouteId;
        const hasDash = dashId && ids.includes(dashId);
        const subIds = hasDash ? ids.filter((id) => id !== dashId) : ids;

        html += `<section class="dashboard-quick-bar-catalog-section" aria-labelledby="quick-bar-sec-${sec.id}">`;

        html += `<div class="dashboard-quick-bar-module-head">`;
        html += `<h4 class="dashboard-quick-bar-module-title" id="quick-bar-sec-${sec.id}">${esc(sec.label)}</h4>`;
        if (hasDash) {
            html += `<div class="dashboard-quick-bar-module-dashboard-slot">`;
            html += buildPickCardHtml(dashId, draftSet, esc, 'dashboard-quick-bar-pick-card--dashboard');
            html += `</div>`;
        }
        html += `</div>`;

        if (subIds.length) {
            const subhint = hasDash
                ? "Pagine e funzioni all'interno del modulo:"
                : 'Accessi in questo gruppo:';
            html += `<p class="dashboard-quick-bar-module-subhint">${esc(subhint)}</p>`;
            html += '<div class="quick-actions dashboard-quick-bar-catalog-grid">';
            for (const id of subIds) {
                html += buildPickCardHtml(id, draftSet, esc, '');
            }
            html += '</div>';
        }

        html += '</section>';
    }
    return html;
}

/**
 * @param {Object} options
 * @param {string} [options.userId]
 * @param {string} [options.tenantId]
 * @param {string[]} options.availableModules
 * @param {boolean} options.hasManodopera
 * @param {string[]} [options.userRoles] — ruoli normalizzati (lowercase), es. da `userData.ruoli`
 * @param {Object} options.dependencies
 */
export async function initDashboardQuickBar(options) {
    const root = document.getElementById('dashboard-quick-bar-root');
    if (!root || root.dataset.quickBarInit === '1') return;

    const {
        userId,
        tenantId,
        availableModules,
        hasManodopera,
        dependencies
    } = options;

    const userRoles = Array.isArray(options.userRoles)
        ? options.userRoles.map((r) => String(r || '').trim().toLowerCase()).filter(Boolean)
        : [];

    const ctx = { availableModules, hasManodopera, userRoles };
    const esc = dependencies.escapeHtml || ((s) => String(s || ''));

    let slots = loadSlots(userId, ctx);
    const escA = escapeHtml;

    async function render() {
        root.innerHTML = buildBarHTML(slots, ctx, escA);
        await refreshBadges(root, slots, tenantId, ctx, dependencies);
    }

    await render();
    const configBtn = document.getElementById('dashboard-quick-bar-config-btn');
    const modal = document.getElementById('dashboard-quick-bar-modal');
    const modalForm = document.getElementById('dashboard-quick-bar-form');
    const closeEls = modal ? modal.querySelectorAll('[data-quick-bar-close]') : [];

    let draftOrder = [];

    function syncPickerDom() {
        const draftRoot = document.getElementById('dashboard-quick-bar-draft-root');
        const catalogRoot = document.getElementById('dashboard-quick-bar-catalog-root');
        const hintEl = document.getElementById('dashboard-quick-bar-limit-hint');
        if (draftRoot) draftRoot.innerHTML = buildDraftPreviewHTML(draftOrder, escA);
        if (catalogRoot) {
            catalogRoot.innerHTML = buildCatalogHTML(ctx, new Set(draftOrder), escA);
        }
        if (hintEl) hintEl.textContent = '';
    }

    function openModal() {
        if (!modal || !modalForm) return;
        draftOrder = compactDraftFromSlots(slots);
        syncPickerDom();
        modal.hidden = false;
        document.body.classList.add('dashboard-quick-bar-modal-open');
    }

    function closeModal() {
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove('dashboard-quick-bar-modal-open');
    }

    if (configBtn) {
        configBtn.addEventListener('click', () => openModal());
    }
    closeEls.forEach((el) => el.addEventListener('click', () => closeModal()));

    const btnClear = document.getElementById('dashboard-quick-bar-clear-draft');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            draftOrder = [];
            syncPickerDom();
        });
    }

    if (modal) {
        modal.addEventListener('click', (ev) => {
            const rem = ev.target.closest('[data-draft-remove]');
            const pick = ev.target.closest('.dashboard-quick-bar-pick-card[data-route-id]');
            if (rem) {
                const id = rem.getAttribute('data-draft-remove');
                draftOrder = draftOrder.filter((x) => x !== id);
                syncPickerDom();
                return;
            }
            if (pick) {
                const id = pick.getAttribute('data-route-id');
                if (!id || !QUICK_BAR_CATALOG[id] || !isQuickBarRouteVisible(id, ctx)) return;
                const ix = draftOrder.indexOf(id);
                if (ix >= 0) {
                    draftOrder = draftOrder.filter((x) => x !== id);
                } else if (draftOrder.length >= SLOT_COUNT) {
                    const hintEl = document.getElementById('dashboard-quick-bar-limit-hint');
                    if (hintEl) {
                        hintEl.textContent =
                            'Hai già 5 accessi: rimuovine uno dalla barra in alto per aggiungerne un altro.';
                    }
                    return;
                } else {
                    draftOrder = draftOrder.concat([id]);
                }
                syncPickerDom();
            }
        });
    }

    if (modalForm) {
        modalForm.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            slots = draftOrderToSavedSlots(draftOrder);
            saveSlots(userId, slots);
            await render();
            closeModal();
        });
    }

    document.addEventListener('keydown', function onKey(ev) {
        if (ev.key === 'Escape' && modal && !modal.hidden) closeModal();
    });

    root.dataset.quickBarInit = '1';
}
