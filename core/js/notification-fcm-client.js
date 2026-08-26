/**
 * Registrazione token FCM sul service worker esistente.
 * No-op se manca vapidKey, permesso negato, o push disattivata.
 *
 * @module core/js/notification-fcm-client
 */

import { getAppInstance, getAuthInstance, getDb, doc, getDoc, updateDoc } from '../services/firebase-service.js';
import { loadNotificationPrefsFromUser, upsertFcmTokenInPrefs } from '../services/notification-prefs-service.js';

function resolveServiceWorkerUrl() {
    const host = window.location.hostname || '';
    const path = window.location.pathname || '';
    if (path.includes('/gfv-platform/')) return '/gfv-platform/service-worker.js';
    if (host === 'localhost' || host === '127.0.0.1') return '/service-worker.js';
    if (path.includes('/core/mobile/')) return '../../service-worker.js';
    if (path.includes('/core/admin/')) return '../../service-worker.js';
    if (path.includes('/core/')) return '../service-worker.js';
    return '/service-worker.js';
}

async function ensureServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    try {
        const registration = await navigator.serviceWorker.register(resolveServiceWorkerUrl());
        if (registration.update) await registration.update().catch(() => {});
        return registration;
    } catch (err) {
        console.warn('[push] service worker:', err);
        return navigator.serviceWorker.getRegistration();
    }
}

/**
 * @param {{ userData?: Record<string, unknown>, firebaseConfig?: Record<string, string> }} [opts]
 */
export async function startNotificationFcm(opts = {}) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const auth = getAuthInstance();
    const user = auth && auth.currentUser;
    if (!user) return;

    const db = getDb();
    let userData = opts.userData;
    if (!userData) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        userData = snap.exists() ? snap.data() : {};
    }
    const prefs = loadNotificationPrefsFromUser(userData);
    if (!prefs.pushEnabled) return;

    const cfg = opts.firebaseConfig || window.firebaseConfig || {};
    const vapidKey = cfg.vapidKey || cfg.vapid || '';
    if (!vapidKey || String(vapidKey).startsWith('YOUR_')) {
        console.info('[push] vapidKey assente in firebase-config: token FCM non registrato (gli eventi Firestore si creano comunque).');
        return;
    }

    if (Notification.permission === 'denied') return;
    if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
    }

    const registration = await ensureServiceWorker();
    if (!registration) return;

    const { getMessaging, getToken, onMessage, isSupported } = await import(
        'https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging.js'
    );
    const supported = await isSupported().catch(() => false);
    if (!supported) return;

    const app = getAppInstance();
    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
        const notification = (payload && payload.notification) || {};
        const data = (payload && payload.data) || {};
        const title = notification.title || data.title || 'GFV Platform';
        const body = notification.body || data.body || '';
        if (Notification.permission !== 'granted') return;
        registration.showNotification(title, {
            body,
            icon: 'icons/icon-192x192.png',
            data: { url: data.url || '' },
        }).catch((err) => console.warn('[push] foreground:', err));
    });
    const token = await getToken(messaging, {
        vapidKey: String(vapidKey),
        serviceWorkerRegistration: registration,
    });
    if (!token) return;

    const nextPrefs = upsertFcmTokenInPrefs(userData.notificationPrefs, token, navigator.userAgent || '');
    await updateDoc(doc(db, 'users', user.uid), { notificationPrefs: nextPrefs });
}

export function startNotificationFcmBackground(opts) {
    startNotificationFcm(opts).catch((err) => {
        console.warn('[push] registrazione token:', err);
    });
}
