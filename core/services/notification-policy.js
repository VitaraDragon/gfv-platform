/**
 * Policy pura destinatari / finestre / timeout conferme per il catalogo push.
 * Nessun I/O Firebase: usabile da client, test e (in seguito) Cloud Functions.
 *
 * @module core/services/notification-policy
 */

import {
    NOTIFICATION_PREFS_DEFAULTS,
    NOTIFICATION_MANAGER_STATI,
    getNotificationEvent,
    italianCountAgreement,
    formatNotificationTemplate,
    oreDaValidareCoalesceKey,
} from '../config/notification-catalog.js';

/**
 * @param {string} hhmm
 * @returns {number} minuti da mezzanotte
 */
export function parseHmToMinutes(hhmm) {
    const m = String(hhmm || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return NaN;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return NaN;
    return h * 60 + min;
}

/**
 * @param {string} hhmm
 * @returns {string} HH:mm oppure ''
 */
export function formatHm(hhmm) {
    const minutes = parseHmToMinutes(hhmm);
    if (!Number.isFinite(minutes)) return '';
    const h = String(Math.floor(minutes / 60)).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    return `${h}:${m}`;
}

/**
 * @param {unknown} prefs
 * @returns {typeof NOTIFICATION_PREFS_DEFAULTS}
 */
/**
 * Minuti da mezzanotte nel fuso indicato (Cloud Functions sono in UTC).
 * @param {Date} date
 * @param {string} [timeZone]
 * @returns {number}
 */
export function zonedMinutesOfDay(date, timeZone = 'Europe/Rome') {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return NaN;
    try {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: timeZone || 'Europe/Rome',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(date);
        const hour = Number(parts.find((p) => p.type === 'hour')?.value);
        const minute = Number(parts.find((p) => p.type === 'minute')?.value);
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return NaN;
        return hour * 60 + minute;
    } catch (_err) {
        return date.getHours() * 60 + date.getMinutes();
    }
}

export function mergeNotificationPrefs(prefs) {
    const p = prefs && typeof prefs === 'object' ? prefs : {};
    const start = formatHm(p.pushWindowStart) || NOTIFICATION_PREFS_DEFAULTS.pushWindowStart;
    const end = formatHm(p.pushWindowEnd) || NOTIFICATION_PREFS_DEFAULTS.pushWindowEnd;
    const timeout = Number(p.confermaTimeoutHours);
    return {
        pushEnabled: p.pushEnabled !== false,
        pushWindowStart: start,
        pushWindowEnd: end,
        timezone: typeof p.timezone === 'string' && p.timezone.trim()
            ? p.timezone.trim()
            : NOTIFICATION_PREFS_DEFAULTS.timezone,
        confermaTimeoutHours: Number.isFinite(timeout) && timeout > 0
            ? timeout
            : NOTIFICATION_PREFS_DEFAULTS.confermaTimeoutHours,
    };
}

/**
 * @param {Date} date
 * @param {string} windowStart
 * @param {string} windowEnd
 * @returns {boolean}
 */
export function isInPushWindow(date, windowStart, windowEnd, timeZone = 'Europe/Rome') {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
    const start = parseHmToMinutes(windowStart);
    const end = parseHmToMinutes(windowEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return false;
    const minutes = zonedMinutesOfDay(date, timeZone);
    if (!Number.isFinite(minutes)) return false;
    return minutes >= start && minutes < end;
}

/**
 * Minuti *utili* (dentro la finestra) tra from e to. Non conta la notte.
 *
 * @param {Date} from
 * @param {Date} to
 * @param {string} windowStart
 * @param {string} windowEnd
 * @returns {number}
 */
export function usefulMinutesBetween(from, to, windowStart, windowEnd, timeZone = 'Europe/Rome') {
    if (!(from instanceof Date) || !(to instanceof Date)) return 0;
    if (to.getTime() <= from.getTime()) return 0;
    const startMin = parseHmToMinutes(windowStart);
    const endMin = parseHmToMinutes(windowEnd);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || startMin >= endMin) return 0;
    let useful = 0;
    const stepMs = 60 * 1000;
    for (let t = from.getTime(); t < to.getTime(); t += stepMs) {
        if (isInPushWindow(new Date(t), windowStart, windowEnd, timeZone)) useful += 1;
    }
    return useful;
}

/**
 * @param {Record<string, unknown>|null|undefined} user
 * @param {string|null|undefined} tenantId
 * @returns {string[]}
 */
export function rolesOfUser(user, tenantId) {
    if (!user || typeof user !== 'object') return [];
    const tid = tenantId != null ? String(tenantId) : '';
    const memberships = user.tenantMemberships;
    if (tid && memberships && typeof memberships === 'object') {
        const m = memberships[tid];
        if (m && m.stato === 'attivo' && Array.isArray(m.ruoli)) {
            return m.ruoli.map((r) => String(r));
        }
    }
    if (Array.isArray(user.ruoli)) return user.ruoli.map((r) => String(r));
    return [];
}

/**
 * @param {string[]} ids
 * @returns {string[]}
 */
export function uniqueUserIds(ids) {
    const out = [];
    const seen = new Set();
    (Array.isArray(ids) ? ids : []).forEach((raw) => {
        const id = raw != null ? String(raw).trim() : '';
        if (!id || seen.has(id)) return;
        seen.add(id);
        out.push(id);
    });
    return out;
}

/**
 * @param {Record<string, unknown>} user
 * @returns {string[]}
 */
function idsFromUserDoc(user) {
    if (!user || typeof user !== 'object') return [];
    return uniqueUserIds([user.id, user.uid, user.userId]);
}

/**
 * Assegnatario operativo: capo squadra, altrimenti operaio autonomo.
 * Senza capo le ore da validare non vanno in push al manager.
 *
 * @param {{ caposquadraId?: unknown, operaioId?: unknown }} lavoro
 * @param {string} eventId
 * @returns {string[]}
 */
export function assegnatarioIdsForEvent(lavoro, eventId) {
    const capo = lavoro && lavoro.caposquadraId != null ? String(lavoro.caposquadraId).trim() : '';
    const operaio = lavoro && lavoro.operaioId != null ? String(lavoro.operaioId).trim() : '';
    if (eventId === 'ore_da_validare') {
        return capo ? [capo] : [];
    }
    if (capo) return [capo];
    if (operaio) return [operaio];
    return [];
}

/**
 * @param {string} eventId
 * @param {{
 *   actorUserId?: string|null,
 *   destinatariIds?: unknown[],
 *   caposquadraId?: string|null,
 *   lavoro?: { caposquadraId?: unknown, operaioId?: unknown }|null,
 *   tenantUsers?: Array<Record<string, unknown>>,
 *   tenantId?: string|null,
 * }} ctx
 * @returns {string[]}
 */
export function resolveNotificationRecipients(eventId, ctx = {}) {
    const def = getNotificationEvent(eventId);
    if (!def || !def.enabled) return [];

    const actor = ctx.actorUserId != null ? String(ctx.actorUserId).trim() : '';
    let ids = [];

    if (def.recipientMode === 'explicit_destinatari') {
        ids = uniqueUserIds(ctx.destinatariIds || []);
    } else if (def.recipientMode === 'lavoro_assegnatario') {
        ids = assegnatarioIdsForEvent(ctx.lavoro || {
            caposquadraId: ctx.caposquadraId,
        }, eventId);
    } else if (def.recipientMode === 'comunicazione_mittente') {
        const mittente = ctx.caposquadraId != null ? String(ctx.caposquadraId).trim() : '';
        ids = mittente ? [mittente] : [];
    } else if (def.recipientMode === 'tenant_manager_admin') {
        const users = Array.isArray(ctx.tenantUsers) ? ctx.tenantUsers : [];
        users.forEach((u) => {
            const roles = rolesOfUser(u, ctx.tenantId);
            if (!roles.includes('manager') && !roles.includes('amministratore')) return;
            idsFromUserDoc(u).forEach((id) => ids.push(id));
        });
        ids = uniqueUserIds(ids);
    }

    if (def.excludeActor && actor) {
        ids = ids.filter((id) => id !== actor);
    }
    return ids;
}

/**
 * @param {string} eventId
 * @param {string} statoLavoro
 * @returns {boolean}
 */
export function isManagerPushStato(eventId, statoLavoro) {
    if (eventId === 'lavoro_completato_da_approvare') return statoLavoro === 'completato_da_approvare';
    if (eventId === 'lavoro_sospeso') return statoLavoro === 'sospeso';
    return NOTIFICATION_MANAGER_STATI.includes(statoLavoro);
}

/**
 * @param {{
 *   createdAt: Date,
 *   now: Date,
 *   destCount: number,
 *   confermeCount: number,
 *   alreadyEscalated?: boolean,
 *   prefs?: unknown,
 * }} opts
 * @returns {boolean}
 */
export function shouldEscalateConferme(opts) {
    const createdAt = opts && opts.createdAt;
    const now = opts && opts.now;
    if (!(createdAt instanceof Date) || !(now instanceof Date)) return false;
    if (opts.alreadyEscalated) return false;
    const dest = Number(opts.destCount) || 0;
    const conf = Number(opts.confermeCount) || 0;
    if (dest <= 0 || conf >= dest) return false;
    const prefs = mergeNotificationPrefs(opts.prefs);
    if (!prefs.pushEnabled) return false;
    const useful = usefulMinutesBetween(
        createdAt,
        now,
        prefs.pushWindowStart,
        prefs.pushWindowEnd,
        prefs.timezone
    );
    return useful >= prefs.confermaTimeoutHours * 60;
}

/**
 * Primo istante in finestra >= from (stesso giorno o giorno dopo).
 *
 * @param {Date} from
 * @param {string} windowStart
 * @param {string} windowEnd
 * @returns {Date}
 */
export function nextSendAt(from, windowStart, windowEnd, timeZone = 'Europe/Rome') {
    if (isInPushWindow(from, windowStart, windowEnd, timeZone)) return new Date(from.getTime());
    const startMin = parseHmToMinutes(windowStart);
    if (!Number.isFinite(startMin)) return new Date(from.getTime());
    for (let i = 1; i <= 48 * 60; i += 1) {
        const candidate = new Date(from.getTime() + i * 60 * 1000);
        if (zonedMinutesOfDay(candidate, timeZone) === startMin
            && isInPushWindow(candidate, windowStart, windowEnd, timeZone)) {
            return candidate;
        }
    }
    return new Date(from.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * @param {string} eventId
 * @param {Record<string, string|number|undefined|null>} vars
 * @returns {{ title: string, body: string }}
 */
export function buildNotificationCopy(eventId, vars = {}) {
    const def = getNotificationEvent(eventId);
    if (!def) return { title: '', body: '' };
    const countVars = italianCountAgreement(vars.count != null ? vars.count : vars.pendenti);
    const merged = {
        ...countVars,
        pendenti: countVars.count,
        ...vars,
    };
    return {
        title: formatNotificationTemplate(def.titleTemplate, merged).trim(),
        body: formatNotificationTemplate(def.bodyTemplate, merged).trim(),
    };
}

/**
 * @param {unknown} form
 * @returns {{ ok: true, prefs: ReturnType<typeof mergeNotificationPrefs> } | { ok: false, error: string }}
 */
export function validateNotificationPrefsForm(form) {
    const raw = form && typeof form === 'object' ? form : {};
    if (raw.confermaTimeoutHours != null && raw.confermaTimeoutHours !== '') {
        const rawTimeout = Number(raw.confermaTimeoutHours);
        if (!Number.isFinite(rawTimeout) || rawTimeout < 1 || rawTimeout > 24) {
            return { ok: false, error: 'Il timeout conferme deve essere tra 1 e 24 ore.' };
        }
    }
    const merged = mergeNotificationPrefs(form);
    const start = parseHmToMinutes(merged.pushWindowStart);
    const end = parseHmToMinutes(merged.pushWindowEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return { ok: false, error: 'Orario non valido.' };
    }
    if (start >= end) {
        return { ok: false, error: 'L\'inizio della finestra deve essere prima della fine.' };
    }
    return { ok: true, prefs: merged };
}

/**
 * Payload `users/{uid}.notificationPrefs` (non tocca i token FCM già salvati).
 *
 * @param {unknown} formValues
 * @param {unknown} existingPrefs
 * @returns {{ ok: true, prefs: object } | { ok: false, error: string }}
 */
export function buildNotificationPrefsWrite(formValues, existingPrefs) {
    const existing = existingPrefs && typeof existingPrefs === 'object' ? existingPrefs : {};
    const validated = validateNotificationPrefsForm({
        ...mergeNotificationPrefs(existing),
        ...(formValues && typeof formValues === 'object' ? formValues : {}),
    });
    if (!validated.ok) return validated;
    return {
        ok: true,
        prefs: {
            ...validated.prefs,
            fcmTokens: Array.isArray(existing.fcmTokens) ? existing.fcmTokens : [],
        },
    };
}

export { oreDaValidareCoalesceKey };
