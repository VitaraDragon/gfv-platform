/**
 * Al primo accesso dopo landing: geocoding sede e salvataggio pin se il comune coincide.
 * @module core/js/sede-auto-pin
 */

import {
  deveTentareAutoPinSede,
  scegliGeocodeNelComune,
  scegliCentroComune,
  buildQueryCentroComune,
} from './sede-geocode-match.js';

/** v2: riprova per chi aveva esito fallito con Geocoder non pronto (bug loading=async). */
const STORAGE_PREFIX = 'gfv_sede_auto_pin_v2_';

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
 * Ottiene un Geocoder quando le classi sono pronte (importLibrary se serve).
 * @returns {Promise<object|null>}
 */
export async function ottieniGeocoder() {
  if (typeof google === 'undefined' || !google.maps) return null;
  try {
    if (typeof google.maps.importLibrary === 'function' && !google.maps.Geocoder) {
      await google.maps.importLibrary('geocoding');
    }
  } catch (e) {
    console.warn('[sede-auto-pin] importLibrary geocoding', e);
  }
  if (!google.maps.Geocoder) return null;
  return new google.maps.Geocoder();
}

/**
 * @param {object} geocoder
 * @param {string} address
 * @param {{ country?: string, locality?: string }} [restrictions]
 * @returns {Promise<object[]>}
 */
export function geocodeAddress(geocoder, address, restrictions) {
  const req = {
    address: String(address || '').indexOf('Italia') === -1
      ? String(address || '') + ', Italia'
      : String(address || ''),
    region: 'it',
    componentRestrictions: Object.assign({ country: 'it' }, restrictions || {}),
  };
  return new Promise((resolve) => {
    geocoder.geocode(req, (res, status) => {
      if (status === 'OK' && Array.isArray(res)) resolve(res);
      else resolve([]);
    });
  });
}

/**
 * Estrae lat/lng da un risultato Geocoder.
 * @param {object|null} chosen
 * @returns {{ lat: number, lng: number }|null}
 */
export function coordsDaGeocodeResult(chosen) {
  if (!chosen || !chosen.geometry || !chosen.geometry.location) return null;
  const loc = chosen.geometry.location;
  const lat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
  const lng = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Geocoding indirizzo + ripiego al centro comune se il civico non è nel comune.
 * @param {object} opts
 * @param {object} opts.geocoder
 * @param {string} opts.queryIndirizzo
 * @param {string} opts.comune
 * @param {string} [opts.provincia]
 * @returns {Promise<{ coords: {lat:number,lng:number}|null, mode: 'civico'|'centro'|null, reason: string }>}
 */
export async function risolviPinSedeConRipiego(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const geocoder = o.geocoder;
  const comune = String(o.comune || '').trim();
  if (!geocoder || !comune) {
    return { coords: null, mode: null, reason: 'no-input' };
  }

  const results = await geocodeAddress(geocoder, o.queryIndirizzo || '');
  const chosen = scegliGeocodeNelComune(results, comune);
  const civico = coordsDaGeocodeResult(chosen);
  if (civico) {
    return { coords: civico, mode: 'civico', reason: 'ok' };
  }

  const queryCentro = buildQueryCentroComune(comune, o.provincia);
  const centroResults = await geocodeAddress(geocoder, queryCentro, { locality: comune });
  const centro =
    scegliCentroComune(centroResults, comune) ||
    scegliCentroComune(await geocodeAddress(geocoder, queryCentro), comune);
  const centroCoords = coordsDaGeocodeResult(centro);
  if (centroCoords) {
    return { coords: centroCoords, mode: 'centro', reason: 'ok-centro' };
  }
  return { coords: null, mode: null, reason: 'no-match' };
}

/**
 * Espone l'auto-pin in corso come `window.__gfvSedeAutoPinPromise` (G1: Tony saluto attende il pin).
 * La promise non rifiuta mai: risolve con l'esito di tryAutoSaveSedePinOnFirstAccess.
 * @param {Promise<any>} promise
 * @param {object} [target]  default: window
 * @returns {Promise<any>}
 */
export function esponiAutoPinPromise(promise, target) {
  const sicura = Promise.resolve(promise).catch(() => ({ saved: false, reason: 'error' }));
  const t = target || (typeof window !== 'undefined' ? window : null);
  if (t) t.__gfvSedeAutoPinPromise = sicura;
  return sicura;
}

/**
 * Fonde il documento tenant riletto con lo stato già in memoria SENZA perdere `sedeCoordinate`
 * scritto dall'auto-pin (o da Impostazioni) nel frattempo: lo snapshot letto prima può non averlo ancora.
 * Un pin valido in memoria vince su uno snapshot senza pin; un pin nello snapshot vince se la memoria non l'ha.
 * @param {object|null|undefined} snapshot  dati tenant appena letti
 * @param {object|null|undefined} extra  campi derivati (modules, plan, piano…)
 * @param {object|null|undefined} corrente  window.__gfvTenantData già presente
 * @returns {object}
 */
export function unisciTenantDataMantenendoSede(snapshot, extra, corrente) {
  const merged = Object.assign({}, snapshot || {}, extra || {});
  const haCoord = (c) =>
    !!c &&
    typeof c === 'object' &&
    Number.isFinite(typeof c.lat === 'number' ? c.lat : Number(c.lat)) &&
    Number.isFinite(typeof c.lng === 'number' ? c.lng : Number(c.lng));
  const inMemoria = corrente && typeof corrente === 'object' ? corrente.sedeCoordinate : null;
  if (!haCoord(merged.sedeCoordinate) && haCoord(inMemoria)) {
    merged.sedeCoordinate = inMemoria;
  }
  return merged;
}

/**
 * @param {object} opts
 * @param {string} opts.tenantId
 * @param {object} opts.tenantData
 * @param {string} [opts.ruolo]
 * @param {(ref: any, data: object) => Promise<void>} opts.updateTenant
 * @param {() => Promise<any>} opts.loadGoogleMapsAPI
 * @param {(msg: string) => void} [opts.onAvviso]
 * @returns {Promise<{ saved: boolean, reason: string, mode?: string }>}
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
    const geocoder = await ottieniGeocoder();
    if (!geocoder) {
      memorizzaEsitoAutoPinLocale(tenantId, { attempted: true, failed: true });
      if (typeof o.onAvviso === 'function') {
        o.onAvviso('Non riesco a mettere il pin della sede: aprilo a mano in Impostazioni.');
      }
      return { saved: false, reason: 'maps' };
    }

    const query = buildSedeQueryDaTenant(tenantData);
    const resolved = await risolviPinSedeConRipiego({
      geocoder,
      queryIndirizzo: query,
      comune: tenantData.citta,
      provincia: tenantData.provincia,
    });

    if (!resolved.coords) {
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

    const { lat, lng } = resolved.coords;
    await o.updateTenant({
      sedeCoordinate: { lat, lng },
      aggiornatoIl: o.serverTimestamp ? o.serverTimestamp() : undefined,
    });
    memorizzaEsitoAutoPinLocale(tenantId, { attempted: true, failed: false });
    if (resolved.mode === 'centro' && typeof o.onAvviso === 'function') {
      o.onAvviso(
        'Ho messo il pin al centro di ' +
          String(tenantData.citta || '') +
          ': spostalo sulla sede in Impostazioni'
      );
    }
    return { saved: true, reason: 'ok', mode: resolved.mode };
  } catch (err) {
    console.warn('[sede-auto-pin]', err);
    memorizzaEsitoAutoPinLocale(tenantId, { attempted: true, failed: true });
    if (typeof o.onAvviso === 'function') {
      o.onAvviso('Non riesco a salvare il pin della sede: aprilo a mano in Impostazioni.');
    }
    return { saved: false, reason: 'error' };
  }
}
