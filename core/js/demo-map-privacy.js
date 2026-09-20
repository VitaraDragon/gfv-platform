/**
 * Privacy map helpers — SOLO tenant AZIENDA DEMO GFV.
 * Non alterare stile mappe degli account reali.
 */

export const DEMO_CLOUD_TENANT_ID = 'demo_azienda_demo_gfv_v1';

/** Stile roadmap: nasconde POI, transit e etichette strade/amministrative. */
export const DEMO_PRIVACY_MAP_STYLES = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'labels', stylers: [{ visibility: 'off' }] }
];

/**
 * Gate stretto: solo il tenantId della demo cloud.
 * @param {string|null|undefined} tenantId
 * @returns {boolean}
 */
export function isDemoCloudTenant(tenantId) {
  return tenantId === DEMO_CLOUD_TENANT_ID;
}

/**
 * Opzioni Map Google: privacy-safe solo se tenant demo.
 * @param {object} baseOptions
 * @param {string|null|undefined} tenantId
 * @returns {object}
 */
export function withDemoPrivacyMapOptions(baseOptions = {}, tenantId) {
  if (!isDemoCloudTenant(tenantId)) return baseOptions;
  return {
    ...baseOptions,
    // Roadmap + styles: le etichette spariscono; satellite le ignora in parte
    mapTypeId: baseOptions.mapTypeId === 'satellite' ? 'roadmap' : (baseOptions.mapTypeId || 'roadmap'),
    styles: DEMO_PRIVACY_MAP_STYLES,
    streetViewControl: false,
    mapTypeControl: true
  };
}
