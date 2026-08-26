/**
 * Costruzione eventi push (senza I/O). Usato da test e Cloud Functions.
 * @module core/services/notification-dispatch-core
 */

import {
    getNotificationEvent,
    buildNotificationDeepLink,
    oreDaValidareCoalesceKey,
} from './notification-catalog.js';
import {
    resolveNotificationRecipients,
    buildNotificationCopy,
    mergeNotificationPrefs,
    isInPushWindow,
    nextSendAt,
} from './notification-policy.js';

/**
 * @param {Record<string, unknown>|null|undefined} before
 * @param {Record<string, unknown>|null|undefined} after
 * @returns {string[]}
 */
export function detectLavoroPushEvents(before, after) {
    if (!after || typeof after !== 'object') return [];
    const events = [];
    const afterCapo = after.caposquadraId != null ? String(after.caposquadraId).trim() : '';
    const afterOp = after.operaioId != null ? String(after.operaioId).trim() : '';
    const beforeCapo = before && before.caposquadraId != null ? String(before.caposquadraId).trim() : '';
    const beforeOp = before && before.operaioId != null ? String(before.operaioId).trim() : '';
    const afterStato = after.stato != null ? String(after.stato) : '';
    const beforeStato = before && before.stato != null ? String(before.stato) : '';
    const isCreate = !before;

    if (isCreate && (afterCapo || afterOp)) events.push('lavoro_assegnato');
    if (!isCreate && (afterCapo !== beforeCapo || afterOp !== beforeOp) && (afterCapo || afterOp)) {
        events.push('lavoro_assegnato');
    }
    if (afterStato === 'completato_da_approvare' && beforeStato !== 'completato_da_approvare') {
        events.push('lavoro_completato_da_approvare');
    }
    if (afterStato === 'sospeso' && beforeStato !== 'sospeso') {
        events.push('lavoro_sospeso');
    }
    return events;
}

/**
 * @param {unknown} text
 * @param {number} [max]
 * @returns {string}
 */
export function truncatePreview(text, max = 120) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (s.length <= max) return s;
    return `${s.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function formatLavoroDataInizio(raw) {
    let d = null;
    if (raw && typeof raw.toDate === 'function') d = raw.toDate();
    else if (raw instanceof Date) d = raw;
    else if (raw) d = new Date(raw);
    if (!d || Number.isNaN(d.getTime())) return 'presto';
    try {
        return d.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' });
    } catch (_err) {
        return d.toLocaleDateString('it-IT');
    }
}

/**
 * @param {{
 *   eventId: string,
 *   tenantId: string,
 *   sourceCollection: string,
 *   sourceId: string,
 *   actorUserId?: string|null,
 *   lavoro?: { caposquadraId?: unknown, operaioId?: unknown, nome?: unknown }|null,
 *   lavoroId?: string|null,
 *   destinatariIds?: unknown[],
 *   caposquadraId?: string|null,
 *   tenantUsers?: Array<Record<string, unknown>>,
 *   vars?: Record<string, string|number|undefined|null>,
 *   now?: Date,
 *   prefsByUser?: Record<string, unknown>,
 *   debounceMinutes?: number,
 * }} input
 * @returns {Array<Record<string, unknown>>}
 */
export function buildNotificationEventDocs(input) {
    const eventId = input && input.eventId;
    const def = getNotificationEvent(eventId);
    if (!def || !def.enabled) return [];
    const now = input.now instanceof Date ? input.now : new Date();
    const lavoro = input.lavoro || {};
    const recipients = resolveNotificationRecipients(eventId, {
        actorUserId: input.actorUserId,
        destinatariIds: input.destinatariIds,
        caposquadraId: input.caposquadraId || lavoro.caposquadraId,
        lavoro,
        tenantUsers: input.tenantUsers,
        tenantId: input.tenantId,
    });
    if (!recipients.length) return [];

    const vars = {
        lavoroNome: input.vars && input.vars.lavoroNome
            ? input.vars.lavoroNome
            : (lavoro.nome ? String(lavoro.nome) : 'Lavoro'),
        ...(input.vars || {}),
    };
    const copy = buildNotificationCopy(eventId, vars);
    const deepLink = buildNotificationDeepLink(eventId, {
        lavoroId: input.lavoroId || null,
        comunicazioneId: input.sourceCollection === 'comunicazioni' ? input.sourceId : null,
    });
    const debounceMinutes = Number.isFinite(Number(input.debounceMinutes))
        ? Number(input.debounceMinutes)
        : (def.coalesce && def.coalesce.debounceMinutes) || 0;

    return recipients.map((recipientUserId) => {
        const prefs = mergeNotificationPrefs(
            input.prefsByUser && input.prefsByUser[recipientUserId]
        );
        let status = 'pending';
        let sendAfter = now;
        if (!prefs.pushEnabled) {
            status = 'suppressed';
        } else if (!isInPushWindow(now, prefs.pushWindowStart, prefs.pushWindowEnd, prefs.timezone)) {
            status = 'queued';
            sendAfter = nextSendAt(now, prefs.pushWindowStart, prefs.pushWindowEnd, prefs.timezone);
        } else if (debounceMinutes > 0) {
            status = 'queued';
            sendAfter = new Date(now.getTime() + debounceMinutes * 60 * 1000);
            if (!isInPushWindow(sendAfter, prefs.pushWindowStart, prefs.pushWindowEnd, prefs.timezone)) {
                sendAfter = nextSendAt(sendAfter, prefs.pushWindowStart, prefs.pushWindowEnd, prefs.timezone);
            }
        }
        const coalesceKey = def.coalesce && def.coalesce.by === 'recipient_day'
            ? oreDaValidareCoalesceKey(recipientUserId, now)
            : null;
        return {
            type: eventId,
            tenantId: input.tenantId,
            sourceCollection: input.sourceCollection,
            sourceId: input.sourceId,
            lavoroId: input.lavoroId || null,
            lavoroNome: vars.lavoroNome,
            actorUserId: input.actorUserId || null,
            recipientUserId,
            recipientUserIds: [recipientUserId],
            title: copy.title,
            body: copy.body,
            deepLink,
            status,
            coalesceKey,
            sendAfter,
            createdAt: now,
        };
    });
}
