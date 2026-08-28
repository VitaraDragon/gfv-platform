/**
 * Costruzione eventi push (senza I/O). Usato da test e Cloud Functions.
 * @module core/services/notification-dispatch-core
 */

import {
    getNotificationEvent,
    buildNotificationDeepLink,
    oreDaValidareCoalesceKey,
} from '../config/notification-catalog.js';
import {
    resolveNotificationRecipients,
    buildNotificationCopy,
    mergeNotificationPrefs,
    isInPushWindow,
    nextSendAt,
    resolveNotificationDelivery,
    rolesOfUser,
    zonedGiornoKey,
    assenzaCoversGiorno,
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
 * Assenza last-minute / oggi: buca il turno di oggi (Europe/Rome).
 *
 * @param {Record<string, unknown>|null|undefined} after
 * @param {Date} [now]
 * @param {string} [timeZone]
 * @returns {boolean}
 */
export function shouldNotifyAssenzaTurno(after, now = new Date(), timeZone = 'Europe/Rome') {
    if (!after || typeof after !== 'object') return false;
    if (after.sostitutoOperaioId) return false;
    const stato = after.stato != null ? String(after.stato) : '';
    if (stato !== 'segnalata' && stato !== 'confermata') return false;
    const giorno = zonedGiornoKey(now, timeZone);
    return assenzaCoversGiorno(giorno, after.dataInizioGiorno, after.dataFineGiorno);
}

/**
 * @param {Record<string, unknown>|null|undefined} before
 * @param {Record<string, unknown>|null|undefined} after
 * @param {Date} [now]
 * @returns {{ notify: boolean, closeStatus: 'acted'|'resolved'|null }}
 */
export function detectAssenzaLifecycle(before, after, now = new Date()) {
    if (!after || typeof after !== 'object') {
        return { notify: false, closeStatus: before ? 'resolved' : null };
    }
    const afterStato = after.stato != null ? String(after.stato) : '';
    const beforeStato = before && before.stato != null ? String(before.stato) : '';
    if (afterStato === 'annullata' && beforeStato !== 'annullata') {
        return { notify: false, closeStatus: 'resolved' };
    }
    const hadSost = before && before.sostitutoOperaioId;
    const hasSost = after.sostitutoOperaioId;
    if (hasSost && !hadSost) return { notify: false, closeStatus: 'acted' };
    if (!before && shouldNotifyAssenzaTurno(after, now)) {
        return { notify: true, closeStatus: null };
    }
    return { notify: false, closeStatus: null };
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
 *   operaioId?: string|null,
 *   squadre?: Array<Record<string, unknown>>,
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
        operaioId: input.operaioId,
        squadre: input.squadre,
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
    const debounceMinutes = Number.isFinite(Number(input.debounceMinutes))
        ? Number(input.debounceMinutes)
        : (def.coalesce && def.coalesce.debounceMinutes) || 0;

    return recipients.map((recipientUserId) => {
        const rawPrefs = input.prefsByUser && input.prefsByUser[recipientUserId];
        const prefs = mergeNotificationPrefs(rawPrefs);
        const user = Array.isArray(input.tenantUsers)
            ? input.tenantUsers.find((u) => {
                if (!u || typeof u !== 'object') return false;
                return [u.id, u.uid, u.userId].some((id) => id != null && String(id) === recipientUserId);
            })
            : null;
        const roles = rolesOfUser(user, input.tenantId);
        const isManager = roles.includes('manager') || roles.includes('amministratore');
        const deepLink = buildNotificationDeepLink(eventId, {
            lavoroId: input.lavoroId || null,
            comunicazioneId: input.sourceCollection === 'comunicazioni' ? input.sourceId : null,
            assenzaId: input.sourceCollection === 'assenzeOperai' ? input.sourceId : null,
            data: input.vars && input.vars.dataGiorno ? String(input.vars.dataGiorno) : null,
            variant: eventId === 'assenza_turno' && !isManager ? 'capo' : undefined,
        });
        let status = 'pending';
        let sendAfter = now;
        let skipFcm = false;
        let waStatus = null;
        if (eventId === 'assenza_turno') {
            const delivery = resolveNotificationDelivery(eventId, rawPrefs, now);
            status = delivery.status;
            sendAfter = delivery.sendAfter;
            skipFcm = delivery.skipFcm;
            waStatus = delivery.waStatus;
        } else if (!prefs.pushEnabled) {
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
            : (def.coalesce && def.coalesce.by === 'source_recipient'
                ? `${eventId}:${input.sourceId}:${recipientUserId}`
                : null);
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
            skipFcm,
            waStatus,
            operaioNome: vars.operaioNome || null,
        };
    });
}
