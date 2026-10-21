/**
 * Unione delle zone lavorate, ritagliata sul terreno.
 * In browser usa lo script vendorizzato; in Node il pacchetto polygon-clipping.
 */

/** Relativo a questo modulo: core/services → vendor in radice. */
export const POLYGON_CLIPPING_VENDOR_PATH = '../../vendor/polygon-clipping-0.15.7.umd.min.js';

const EARTH_RADIUS_M = 6378137;
const CHIUSURA_METRI = 10;

let loadPromise = null;

function toRad(degrees) {
  return (Number(degrees) * Math.PI) / 180;
}

/**
 * @param {*} raw
 * @returns {{ lat: number, lng: number }|null}
 */
function punto(raw) {
  if (!raw) return null;
  if (typeof raw.lat === 'function' && typeof raw.lng === 'function') {
    const lat = Number(raw.lat());
    const lng = Number(raw.lng());
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }
  if (Array.isArray(raw) && raw.length >= 2) {
    const lat = Number(raw[0]);
    const lng = Number(raw[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }
  if (raw.lat == null || raw.lng == null) return null;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * @param {Array} raw
 * @returns {Array<{ lat: number, lng: number }>}
 */
function punti(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(punto).filter(Boolean);
}

/**
 * @param {{ lat: number, lng: number }} a
 * @param {{ lat: number, lng: number }} b
 * @returns {number}
 */
function distanzaMetri(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Area geodetica di un anello (metri quadri). R = 6378137, come Maps spherical.
 * @param {Array<{ lat: number, lng: number }>} ring
 * @returns {number}
 */
function areaAnelloM2(ring) {
  const pts = ring.slice();
  if (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first.lat === last.lat && first.lng === last.lng) pts.pop();
  }
  if (pts.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    total += toRad(p2.lng - p1.lng) * (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

/**
 * @param {Array<{ lat: number, lng: number }>} coords
 * @returns {Array<[number, number]>|null}
 */
function anelloClip(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return null;
  const ring = coords.map((c) => [c.lng, c.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  if (ring.length < 4) return null;
  return ring;
}

/**
 * @param {object} zona
 * @returns {boolean}
 */
function zonaChiusa(zona) {
  const coords = punti(zona && (zona.coordinate || zona.coordinates));
  if (coords.length < 3) return false;
  if (zona.isChiuso === true) return true;
  return distanzaMetri(coords[0], coords[coords.length - 1]) <= CHIUSURA_METRI;
}

/**
 * @param {Array<Array<Array<Array<number>>>>} multi
 * @returns {number}
 */
function areaMultiHa(multi) {
  if (!Array.isArray(multi)) return 0;
  let m2 = 0;
  multi.forEach((poly) => {
    if (!Array.isArray(poly) || poly.length === 0) return;
    const esterno = (poly[0] || []).map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }));
    m2 += areaAnelloM2(esterno);
    for (let i = 1; i < poly.length; i += 1) {
      const buco = (poly[i] || []).map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }));
      m2 -= areaAnelloM2(buco);
    }
  });
  return Math.max(0, m2) / 10000;
}

function iniettaScriptVendor() {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('polygon-clipping non disponibile'));
      return;
    }
    const esistente = document.querySelector('script[data-gfv-polygon-clipping="1"]');
    if (esistente) {
      if (window.polygonClipping) {
        resolve(window.polygonClipping);
        return;
      }
      esistente.addEventListener('load', () => resolve(window.polygonClipping));
      esistente.addEventListener('error', () => reject(new Error('polygon-clipping')));
      return;
    }
    const script = document.createElement('script');
    script.src = new URL(POLYGON_CLIPPING_VENDOR_PATH, import.meta.url).href;
    script.dataset.gfvPolygonClipping = '1';
    script.onload = () => resolve(window.polygonClipping);
    script.onerror = () => reject(new Error('polygon-clipping'));
    document.head.appendChild(script);
  });
}

/**
 * @returns {Promise<object>}
 */
export function loadPolygonClipping() {
  if (typeof window !== 'undefined' && window.polygonClipping) {
    return Promise.resolve(window.polygonClipping);
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const lib = await iniettaScriptVendor();
        if (lib) return lib;
      }
      const mod = await import('polygon-clipping');
      return mod.default || mod;
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  return loadPromise;
}

/**
 * Unione dei poligoni chiusi, intersecata con il terreno, più la superficieHa dei segmenti aperti.
 * Il risultato non supera l'area del terreno.
 * @param {Array<object>} zone
 * @param {Array|null|undefined} terrenoCoords
 * @param {object} pc polygon-clipping
 * @returns {number} ettari
 */
export function computeWorkedAreaHa(zone, terrenoCoords, pc) {
  const lista = Array.isArray(zone) ? zone : [];
  if (lista.length === 0) return 0;
  if (!pc || typeof pc.union !== 'function') {
    throw new Error('polygon-clipping mancante');
  }

  const anelloTerreno = anelloClip(punti(terrenoCoords));
  const terrenoPoly = anelloTerreno ? [[anelloTerreno]] : null;
  const terrenoHa = anelloTerreno ? areaAnelloM2(punti(terrenoCoords)) / 10000 : 0;

  const chiusi = [];
  let apertiHa = 0;
  lista.forEach((zona) => {
    if (!zona) return;
    if (zonaChiusa(zona)) {
      const ring = anelloClip(punti(zona.coordinate || zona.coordinates));
      if (ring) chiusi.push([[ring]]);
      else apertiHa += Number(zona.superficieHa) || 0;
    } else {
      apertiHa += Number(zona.superficieHa) || 0;
    }
  });

  let chiusiHa = 0;
  if (chiusi.length > 0) {
    let unione = chiusi[0];
    for (let i = 1; i < chiusi.length; i += 1) {
      unione = pc.union(unione, chiusi[i]);
    }
    if (terrenoPoly) unione = pc.intersection(unione, terrenoPoly);
    chiusiHa = areaMultiHa(unione);
  }

  let totale = chiusiHa + apertiHa;
  if (terrenoHa > 0) totale = Math.min(totale, terrenoHa);
  return Math.max(0, totale);
}

/**
 * @param {Array<object>} zone
 * @param {Array|null|undefined} terrenoCoords
 * @returns {Promise<number>}
 */
export async function computeWorkedAreaHaAsync(zone, terrenoCoords) {
  if (!Array.isArray(zone) || zone.length === 0) return 0;
  const pc = await loadPolygonClipping();
  return computeWorkedAreaHa(zone, terrenoCoords, pc);
}

/**
 * Percentuale lavorata, al massimo 100, un decimale.
 * @param {number} lavorataHa
 * @param {number} totaleHa
 * @returns {number}
 */
export function percentualeLavorata(lavorataHa, totaleHa) {
  const totale = Number(totaleHa) || 0;
  if (totale <= 0) return 0;
  const pct = ((Number(lavorataHa) || 0) / totale) * 100;
  const limitata = Math.min(100, Math.max(0, pct));
  return Math.round(limitata * 10) / 10;
}
