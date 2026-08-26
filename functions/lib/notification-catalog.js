/**
 * Catalogo eventi push ciclo lavoro (comunicazioni + stati manager).
 * Nuovo tipo = nuova voce qui + trigger Functions, non if sulla pagina.
 *
 * Tony in-app resta in tony-proactive-signals.js. Assenze/WA: linea guida separata.
 *
 * @module core/config/notification-catalog
 */

/** @typedef {'explicit_destinatari'|'lavoro_assegnatario'|'comunicazione_mittente'|'tenant_manager_admin'} NotificationRecipientMode */

/**
 * @typedef {Object} NotificationEventDef
 * @property {string} id
 * @property {boolean} enabled
 * @property {string[]} roles
 * @property {NotificationRecipientMode} recipientMode
 * @property {boolean} excludeActor
 * @property {string} titleTemplate
 * @property {string} bodyTemplate
 * @property {string} deepLinkPath
 * @property {string} [openSlide]
 * @property {{ by: 'recipient_day', debounceMinutes: number }|null} [coalesce]
 * @property {boolean} [usesConfermaTimeout]
 */

export const NOTIFICATION_PREFS_DEFAULTS = Object.freeze({
    pushEnabled: true,
    pushWindowStart: '05:00',
    pushWindowEnd: '21:00',
    timezone: 'Europe/Rome',
    confermaTimeoutHours: 6,
});

export const NOTIFICATION_MANAGER_STATI = Object.freeze([
    'completato_da_approvare',
    'sospeso',
]);

/** PNG reale in repo. La cartella `icons/` del manifest non contiene i file. */
export const NOTIFICATION_ICON_RELATIVE = 'core/images/icon-192x192.png';

/** Origin pubblico ERP (GitHub Pages). FCM richiede URL HTTPS assoluto, non un path relativo. */
export const NOTIFICATION_WEB_ORIGIN = 'https://vitaradragon.github.io/gfv-platform';

/**
 * @param {string} [origin]
 * @returns {string}
 */
export function buildNotificationIconUrl(origin) {
    const base = String(origin || NOTIFICATION_WEB_ORIGIN).replace(/\/+$/, '');
    return `${base}/${NOTIFICATION_ICON_RELATIVE}`;
}

/**
 * Base URL dell'app dal location del browser (Pages ha il prefisso /gfv-platform).
 *
 * @param {{ origin?: string, pathname?: string }|null} [locationLike]
 * @returns {string}
 */
export function resolveNotificationWebOrigin(locationLike) {
    const loc = locationLike || (typeof window !== 'undefined' ? window.location : null);
    if (!loc) return NOTIFICATION_WEB_ORIGIN;
    const origin = String(loc.origin || '').replace(/\/+$/, '');
    const path = String(loc.pathname || '');
    if (path.includes('/gfv-platform')) return `${origin}/gfv-platform`;
    return origin || NOTIFICATION_WEB_ORIGIN;
}

/** @type {NotificationEventDef[]} */
export const NOTIFICATION_EVENTS = [
    {
        id: 'comunicazione_destinatario',
        enabled: true,
        roles: ['operaio', 'caposquadra'],
        recipientMode: 'explicit_destinatari',
        excludeActor: true,
        titleTemplate: 'Comunicazione — {lavoroNome}',
        bodyTemplate: '{mittenteNome}: {messaggio}',
        deepLinkPath: 'core/mobile/field-workspace-standalone.html',
        openSlide: 'comunicazioni',
        coalesce: null,
    },
    {
        id: 'lavoro_assegnato',
        enabled: true,
        roles: ['caposquadra', 'operaio'],
        recipientMode: 'lavoro_assegnatario',
        excludeActor: true,
        titleTemplate: 'Nuovo lavoro — {lavoroNome}',
        bodyTemplate: 'Assegnato per {dataInizio}. Tocca per vedere cosa fare.',
        deepLinkPath: 'core/mobile/field-workspace-standalone.html',
        openSlide: 'lavoro',
        coalesce: null,
    },
    {
        id: 'conferme_in_ritardo',
        enabled: true,
        roles: ['caposquadra'],
        recipientMode: 'comunicazione_mittente',
        excludeActor: false,
        titleTemplate: 'Conferme mancanti — {lavoroNome}',
        bodyTemplate: '{pendenti} opera{i} non {hanno} confermato la ricezione.',
        deepLinkPath: 'core/mobile/field-workspace-standalone.html',
        openSlide: 'comunicazioni',
        coalesce: null,
        usesConfermaTimeout: true,
    },
    {
        id: 'ore_da_validare',
        enabled: true,
        roles: ['caposquadra'],
        recipientMode: 'lavoro_assegnatario',
        excludeActor: true,
        titleTemplate: 'Ore da validare',
        bodyTemplate: '{count} opera{i} {hanno} segnato le ore — da validare.',
        deepLinkPath: 'core/mobile/field-workspace-standalone.html',
        openSlide: 'valida-ore',
        coalesce: { by: 'recipient_day', debounceMinutes: 15 },
    },
    {
        id: 'lavoro_completato_da_approvare',
        enabled: true,
        roles: ['manager', 'amministratore'],
        recipientMode: 'tenant_manager_admin',
        excludeActor: true,
        titleTemplate: 'Lavoro da approvare — {lavoroNome}',
        bodyTemplate: 'Il caposquadra ha chiesto la chiusura. Tocca per aprire il lavoro.',
        deepLinkPath: 'core/admin/gestione-lavori-standalone.html',
        coalesce: null,
    },
    {
        id: 'lavoro_sospeso',
        enabled: true,
        roles: ['manager', 'amministratore'],
        recipientMode: 'tenant_manager_admin',
        excludeActor: true,
        titleTemplate: 'Lavoro sospeso — {lavoroNome}',
        bodyTemplate: 'Il lavoro è stato messo in sospeso. Tocca per i dettagli.',
        deepLinkPath: 'core/admin/gestione-lavori-standalone.html',
        coalesce: null,
    },
];

/** @type {Readonly<Record<string, NotificationEventDef>>} */
export const NOTIFICATION_EVENTS_BY_ID = Object.freeze(
    Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e.id, e]))
);

/**
 * @param {string} id
 * @returns {NotificationEventDef|null}
 */
export function getNotificationEvent(id) {
    return NOTIFICATION_EVENTS_BY_ID[id] || null;
}

/**
 * @returns {string[]}
 */
export function getNotificationEventIds() {
    return NOTIFICATION_EVENTS.map((e) => e.id);
}

/**
 * @param {Record<string, string|number|undefined|null>} vars
 * @param {string} template
 * @returns {string}
 */
export function formatNotificationTemplate(template, vars = {}) {
    return String(template || '').replace(/\{(\w+)\}/g, (_, key) => {
        const v = vars[key];
        return v == null ? '' : String(v);
    });
}

/**
 * @param {number} count
 * @returns {{ count: number, i: string, hanno: string }}
 */
export function italianCountAgreement(count) {
    const n = Number(count) || 0;
    if (n === 1) return { count: 1, i: 'io', hanno: 'ha' };
    return { count: n, i: 'i', hanno: 'hanno' };
}

/**
 * Deep link relativo alla root hosting (stessi query già usati da workspace / gestione lavori).
 *
 * @param {string} eventId
 * @param {{ lavoroId?: string, comunicazioneId?: string }} [params]
 * @returns {string}
 */
export function buildNotificationDeepLink(eventId, params = {}) {
    const def = getNotificationEvent(eventId);
    if (!def) return '';
    const q = new URLSearchParams();
    if (def.openSlide) q.set('openSlide', def.openSlide);
    if (params.lavoroId && def.deepLinkPath.includes('field-workspace')) {
        q.set('focusLavoroId', String(params.lavoroId));
    }
    if (params.lavoroId && def.deepLinkPath.includes('gestione-lavori')) {
        q.set('lavoroId', String(params.lavoroId));
    }
    if (params.comunicazioneId) q.set('comunicazioneId', String(params.comunicazioneId));
    const qs = q.toString();
    return qs ? `${def.deepLinkPath}?${qs}` : def.deepLinkPath;
}

/**
 * Chiave digest ore da validare (un evento per capo per giorno).
 *
 * @param {string} recipientUserId
 * @param {Date|string} [day]
 * @returns {string}
 */
export function oreDaValidareCoalesceKey(recipientUserId, day = new Date()) {
    const d = day instanceof Date ? day : new Date(day);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayNum = String(d.getDate()).padStart(2, '0');
    return `ore_da_validare:${recipientUserId}:${y}-${m}-${dayNum}`;
}
