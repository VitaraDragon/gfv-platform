/**
 * Lettura/aggiornamento `notificationEvents` dal client (solo i propri).
 * Seen su tap deep link; create/acted restano Cloud Functions.
 *
 * @module core/services/notification-events-client
 */

import { getCollectionData, updateDocument, serverTimestamp, getAuthInstance } from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';

const SEEN_FROM = new Set(['pending', 'queued', 'sent']);
const CLOSED = new Set(['acted', 'resolved', 'dismissed', 'seen']);

/**
 * @param {string} assenzaId
 * @param {string} [tenantId]
 * @returns {Promise<number>}
 */
export async function markAssenzaNotificationsSeen(assenzaId, tenantId = null) {
    const tid = tenantId || getCurrentTenantId();
    const uid = getAuthInstance()?.currentUser?.uid;
    if (!tid || !uid || !assenzaId) return 0;
    let rows = [];
    try {
        rows = await getCollectionData('notificationEvents', {
            tenantId: tid,
            where: [
                ['type', '==', 'assenza_turno'],
                ['sourceId', '==', String(assenzaId)],
            ],
        });
    } catch (err) {
        console.warn('[notifiche] mark seen query:', err);
        return 0;
    }
    const mine = (rows || []).filter((r) => r.recipientUserId === uid);
    let n = 0;
    for (const row of mine) {
        const st = String(row.status || '');
        if (CLOSED.has(st) || !SEEN_FROM.has(st)) continue;
        try {
            await updateDocument(
                'notificationEvents',
                row.id,
                { status: 'seen', seenBy: uid, seenAt: serverTimestamp() },
                tid
            );
            n += 1;
        } catch (err) {
            console.warn('[notifiche] mark seen update:', err);
        }
    }
    return n;
}
