/**
 * Al primo accesso dopo landing: geocoding sede e salvataggio pin se il comune coincide.
 * @module core/js/sede-auto-pin
 */

import {
  deveTentareAutoPinSede,
  scegliGeocodeNelComune,
} from './sede-geocode-match.js';

const STORAGE_PREFIX = 'gfv_sede_auto_pin_';

/**
 * @param {string} tenantId
 * @returns {{ attempted: boolean, failed: boolean }}
 */
export function leggiEsitoAutoPinLocale(tenantId) {
  const id = String(tenantId || '').trim();
  if (!id) return { attempted: false, failed: false };
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return { attempted: false, failed: false };
    const o = JSON.parse(raw);
    return {
      attempted: !!(o && o.attempted),
      failed: !!(o && o.failed),
    };
  } catch (e) {
    return { attempted: false, failed: false };
  }
}

/**
 * @param {string} tenantId
 * @param {{ attempted?: boolean, failed?: boolean }} esito
 */
export function memorizzaEsitoAutoPinLocale(tenantId, esito) {
  const id = String(tenantId || '').trim();
  if (!id) return;
  try {
    localStorage.setItem(
      STORAGE_PREFIX + id,
      JSON.stringify({
        attempted: !!(esito && esito.attempted),
        failed: !!(esito && esito.failed),
        at: Date.now(),
      })
    );
  } catch (e) {
    /* ignore quota */
  }
}

/**
 * Costruisce query indirizzo sede da campi tenant.
 * @param {{ indirizzo?: string, citta?: string, cap?: string, provincia?: string }} tenant
 * @returns {string}
 */
export function buildSedeQueryDaTenant(tenant) {
  const t = tenant && typeof tenant === 'object' ? tenant : {};
  return [t.indirizzo, t.cap, t.citta, t.provincia, 'Italia'].filter(Boolean).join(', ');
}

/**
 * @param {object} opts
 * @param {string} opts.tenantId
 * @param {object} opts.tenantData
 * @param {string} [opts.ruolo]
 * @param {(ref: any, data: object) => Promise<void>} opts.updateTenant
 * @param {() => Promise<any>} opts.loadGoogleMapsAPI
 * @param {(msg: string) => void} [opts.onAvviso]
 * @returns {Promise<{ saved: boolean, reason: string }>}
 */
export async function tryAutoSaveSedePinOnFirstAccess(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const tenantId = String(o.tenantId || '').trim();
  const tenantData = o.tenantData || {};
  const ruolo = String(o.ruolo || '').toLowerCase();
  if (!tenantId) return { saved: false, reason: 'no-tenant' };
  if (ruolo && ruolo !== 'admin' && ruolo !== 'amministratore' && ruolo !== 'manager') {
    return { saved: false, reason: 'ruolo' };
  }

  const locale = leggiEsitoAutoPinLocale(tenantId);
  if (
    !deveTentareAutoPinSede({
      indirizzo: tenantData.indirizzo,
      citta: tenantData.citta,
      sedeCoordinate: tenantData.sedeCoordinate,
      autoPinAttempted: locale.attempted,
      autoPinFailed: locale.failed,
    })
  ) {
    return { saved: false, reason: 'skip' };
  }

  memorizzaEsitoAutoPinLocale(tenantId, { attempted: true, failed: false });

  try {
    if (typeof o.loadGoogleMapsAPI === 'function') {
      await o.loadGoogleMapsAPI();
    }
    if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
      memorizzaEsitoAutoPinLocale(tenantId, { attempted: true, failed: true });
      if (typeof o.onAvviso === 'function') {
        o.onAvviso('Non riesco a mettere il pin della sede: aprilo a mano in Impostazioni.');
      }
      return { saved: false, reason: 'maps' };
    }

    const query = buildSedeQueryDaTenant(tenantData);
    const results = await new Promise((resolve) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        {
          address: query.indexOf('Italia') === -1 ? query + ', Italia' : query,
          componentRestrictions: { country: 'it' },
        },
        (res, status) => {
          if (status === 'OK' && Array.isArray(res)) resolve(res);
          else resolve([]);
        }
      );
    });

    const chosen = scegliGeocodeNelComune(results, tenantData.citta);
    if (!chosen || !chosen.geometry || !chosen.geometry.location) {
      memorizzaEsitoAutoPinLocale(tenantId, { attempted: true, failed: true });
      if (typeof o.onAvviso === 'function') {
        o.onAvviso(
          'Non trovo la sede a ' +
            String(tenantData.citta || '') +
            ': metti il pin a mano in Impostazioni (ingranaggio in alto a destra).'
        );
      }
      return { saved: false, reason: 'no-match' };
    }

    const loc = chosen.geometry.location;
    const lat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
    const lng = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      memorizzaEsitoAutoPinLocale(tenantId, { attempted: true, failed: true });
      return { saved: false, reason: 'coords' };
    }

    await o.updateTenant({
      sedeCoordinate: { lat, lng },
      aggiornatoIl: o.serverTimestamp ? o.serverTimestamp() : undefined,
    });
    memorizzaEsitoAutoPinLocale(tenantId, { attempted: true, failed: false });
    return { saved: true, reason: 'ok' };
  } catch (err) {
    console.warn('[sede-auto-pin]', err);
    memorizzaEsitoAutoPinLocale(tenantId, { attempted: true, failed: true });
    if (typeof o.onAvviso === 'function') {
      o.onAvviso('Non riesco a salvare il pin della sede: aprilo a mano in Impostazioni.');
    }
    return { saved: false, reason: 'error' };
  }
}
