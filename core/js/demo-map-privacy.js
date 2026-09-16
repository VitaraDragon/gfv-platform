/**
 * Privacy geografica per il tenant demo cloud: le mappe Google del tenant demo
 * usano la roadmap senza POI né etichette, così le coordinate "Demo Valley"
 * non mostrano toponimi reali. Per tutti gli altri tenant le opzioni passano
 * inalterate.
 *
 * @module core/js/demo-map-privacy
 */

/** Tenant demo cloud (vedi COSA_ABBIAMO_FATTO — Demo cloud geo privacy-safe v2). */
export const DEMO_PRIVACY_TENANT_IDS = Object.freeze(['demo_azienda_demo_gfv_v1']);

/** Stili Google Maps: nascondono POI, etichette e transit. */
export const DEMO_PRIVACY_MAP_STYLES = Object.freeze([
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'landscape', elementType: 'labels', stylers: [{ visibility: 'off' }] },
]);

/**
 * @param {string|null|undefined} tenantId
 * @returns {boolean}
 */
export function isDemoPrivacyTenant(tenantId) {
    if (typeof tenantId !== 'string' || !tenantId) return false;
    return DEMO_PRIVACY_TENANT_IDS.includes(tenantId);
}

/**
 * Restituisce le opzioni mappa da passare a `new google.maps.Map(...)`.
 * Per il tenant demo forza roadmap senza POI/etichette e disattiva Street View
 * e il selettore tipo mappa (evita che l'utente torni al satellite reale).
 *
 * @template {object} T
 * @param {T} options Opzioni mappa originali (non mutate)
 * @param {string|null|undefined} tenantId
 * @returns {T|(T & object)}
 */
export function withDemoPrivacyMapOptions(options, tenantId) {
    const base = options && typeof options === 'object' ? options : {};
    if (!isDemoPrivacyTenant(tenantId)) return base;
    return Object.assign({}, base, {
        mapTypeId: 'roadmap',
        mapTypeControl: false,
        streetViewControl: false,
        styles: DEMO_PRIVACY_MAP_STYLES.slice(),
    });
}

if (typeof window !== 'undefined') {
    window.withDemoPrivacyMapOptions = withDemoPrivacyMapOptions;
    window.isDemoPrivacyTenant = isDemoPrivacyTenant;
}
