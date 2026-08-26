/**
 * Persistenza preferenze push su users/{uid}.notificationPrefs.
 * UI Impostazioni chiama queste funzioni; niente logica duplicata in pagina.
 *
 * @module core/services/notification-prefs-service
 */

import {
    mergeNotificationPrefs,
    buildNotificationPrefsWrite,
} from './notification-policy.js';

/**
 * @param {Record<string, unknown>|null|undefined} userData
 * @returns {ReturnType<typeof mergeNotificationPrefs>}
 */
export function loadNotificationPrefsFromUser(userData) {
    return mergeNotificationPrefs(userData && userData.notificationPrefs);
}

/**
 * @param {{
 *   updateDoc: Function,
 *   doc: Function,
 *   db: unknown,
 *   uid: string,
 *   formValues: unknown,
 *   existingPrefs?: unknown,
 * }} args
 * @returns {Promise<{ ok: true, prefs: object } | { ok: false, error: string }>}
 */
export async function saveUserNotificationPrefs(args) {
    const uid = args && args.uid ? String(args.uid).trim() : '';
    if (!uid || typeof args.updateDoc !== 'function' || typeof args.doc !== 'function') {
        return { ok: false, error: 'Sessione non pronta.' };
    }
    const built = buildNotificationPrefsWrite(args.formValues, args.existingPrefs);
    if (!built.ok) return built;
    await args.updateDoc(args.doc(args.db, 'users', uid), {
        notificationPrefs: built.prefs,
    });
    return built;
}

/**
 * @param {unknown} existingPrefs
 * @param {string} token
 * @param {string} [ua]
 * @returns {object}
 */
export function upsertFcmTokenInPrefs(existingPrefs, token, ua) {
    const built = buildNotificationPrefsWrite({}, existingPrefs);
    const prefs = built.ok ? built.prefs : { ...mergeNotificationPrefs(existingPrefs), fcmTokens: [] };
    const tokens = Array.isArray(prefs.fcmTokens) ? prefs.fcmTokens.filter((t) => t && t.token) : [];
    const entry = {
        token: String(token),
        ua: ua ? String(ua).slice(0, 180) : '',
        updatedAt: new Date().toISOString(),
    };
    const idx = tokens.findIndex((t) => String(t.token) === entry.token);
    if (idx >= 0) tokens[idx] = entry;
    else tokens.unshift(entry);
    return { ...prefs, fcmTokens: tokens.slice(0, 5) };
}
