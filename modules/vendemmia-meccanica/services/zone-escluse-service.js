/**
 * Zone escluse vendemmia meccanica — ettari netti
 * @module modules/vendemmia-meccanica/services/zone-escluse-service
 */

/**
 * Normalizza coordinate { lat, lng } da oggetto plain o google LatLng.
 * @param {*} c
 * @returns {{ lat: number, lng: number }|null}
 */
export function normalizeLatLngCoord(c) {
  if (!c) return null;
  if (typeof c.lat === 'function' && typeof c.lng === 'function') {
    return { lat: Number(c.lat()), lng: Number(c.lng()) };
  }
  if (c.lat != null && c.lng != null) {
    return { lat: Number(c.lat), lng: Number(c.lng) };
  }
  return null;
}

/**
 * Serializza path poligono Google Maps in array persistibile.
 * @param {Array} pathArray
 * @returns {Array<{ lat: number, lng: number }>}
 */
export function serializePolygonPath(pathArray) {
  if (!Array.isArray(pathArray)) return [];
  return pathArray.map(normalizeLatLngCoord).filter(Boolean);
}

/**
 * Normalizza zone escluse per persistenza Firestore (solo coordinate plain).
 * @param {Array} zoneEscluse
 * @returns {Array<{ coordinates: Array<{ lat: number, lng: number }> }>}
 */
export function sanitizeZoneEscluse(zoneEscluse) {
  if (!Array.isArray(zoneEscluse)) return [];
  return zoneEscluse
    .map((zone) => {
      const raw = zone?.coordinates || zone?.coords || [];
      const coordinates = raw.map(normalizeLatLngCoord).filter(Boolean);
      if (coordinates.length < 3) return null;
      return { coordinates };
    })
    .filter(Boolean);
}

/**
 * Calcola ettari vendemmiati netti.
 * Priorità: override manuale > totale − esclusi > totale pieno.
 * @param {number} ettariTotali
 * @param {{ ettariEsclusi?: number, ettariVendemmiatiManuali?: number }} [options]
 * @returns {number}
 */
export function computeEttariVendemmiati(ettariTotali, options = {}) {
  const total = Math.max(0, Number(ettariTotali) || 0);
  const manual = options.ettariVendemmiatiManuali;
  if (manual != null && Number.isFinite(Number(manual))) {
    return Math.max(0, Math.min(total, Number(manual)));
  }
  const esclusi = Math.max(0, Number(options.ettariEsclusi) || 0);
  return Math.max(0, Math.round((total - esclusi) * 100) / 100);
}

/**
 * Stima ettari esclusi da somma aree poligoni (m² → ha).
 * Richiede google.maps.geometry.spherical se disponibile lato browser.
 * @param {Array<{ coordinates: Array<{ lat: number, lng: number }> }>} zoneEscluse
 * @param {{ geometry?: object }} [mapsApi]
 * @returns {number|null} ettari esclusi o null se geometry non disponibile
 */
export function sumExcludedAreaHectares(zoneEscluse, mapsApi) {
  if (!Array.isArray(zoneEscluse) || zoneEscluse.length === 0) return 0;
  const spherical = mapsApi?.geometry?.spherical;
  if (!spherical || typeof spherical.computeArea !== 'function') return null;

  let m2 = 0;
  zoneEscluse.forEach((zone) => {
    const coords = zone?.coordinates || zone?.coords || [];
    if (!Array.isArray(coords) || coords.length < 3) return;
    const path = coords.map((c) => {
      if (c.lat != null && typeof mapsApi.LatLng === 'function') {
        return new mapsApi.LatLng(Number(c.lat), Number(c.lng));
      }
      return c;
    });
    m2 += Math.abs(spherical.computeArea(path));
  });
  return Math.round((m2 / 10000) * 100) / 100;
}

/**
 * Aggiorna payload stagione con ettari netti ricalcolati.
 * @param {Object} statoAnno — vendemmiaMeccanica[anno] esistente
 * @param {number} ettariTotali
 * @param {{ mapsApi?: object, ettariVendemmiatiManuali?: number }} [options]
 * @returns {Object}
 */
/**
 * @param {Array} polygonCoords
 * @returns {Array<{ lat: number, lng: number }>}
 */
export function normalizePolygonCoords(polygonCoords) {
  if (!Array.isArray(polygonCoords)) return [];
  return polygonCoords.map(normalizeLatLngCoord).filter(Boolean);
}

/**
 * @param {Array<{ lat: number, lng: number }>} coords
 * @returns {Array<[number, number]>|null}
 */
export function latLngRingToClipRing(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return null;
  const ring = coords.map((c) => [Number(c.lng), Number(c.lat)]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

/**
 * @param {Array<Array<{ lat: number, lng: number }>>} polygons
 * @returns {Array<Array<Array<[number, number]>>>}
 */
export function latLngPolygonsToClipMultiPolygon(polygons) {
  const multi = [];
  (polygons || []).forEach((poly) => {
    const ring = latLngRingToClipRing(poly);
    if (ring) multi.push([ring]);
  });
  return multi;
}

/**
 * @param {Array<Array<Array<[number, number]>>>} multiPoly
 * @returns {Array<{ coordinates: Array<{ lat: number, lng: number }> }>}
 */
export function clipMultiPolygonToZoneEscluse(multiPoly) {
  const zones = [];
  (multiPoly || []).forEach((poly) => {
    (poly || []).forEach((ring) => {
      if (!Array.isArray(ring) || ring.length < 4) return;
      const coordinates = ring.slice(0, -1).map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }));
      if (coordinates.length >= 3) zones.push({ coordinates });
    });
  });
  return zones;
}

let polygonClippingPromise = null;

/**
 * Browser: script UMD `polygon-clipping.umd.js` → window.polygonClipping
 * Node/vitest: import dinamico npm
 */
export async function getPolygonClippingLib() {
  if (typeof window !== 'undefined' && window.polygonClipping) {
    return window.polygonClipping;
  }
  if (!polygonClippingPromise) {
    polygonClippingPromise = import('polygon-clipping').then((mod) => mod.default || mod);
  }
  return polygonClippingPromise;
}

/**
 * @param {Object} [statoEsistente]
 * @returns {boolean}
 */
export function shouldAutoGenerateZoneEscluse(statoEsistente) {
  if (!statoEsistente || typeof statoEsistente !== 'object') return true;
  if (statoEsistente.zoneEscluseModificateManualmente === true) return false;
  if (Array.isArray(statoEsistente.zoneEscluse) && statoEsistente.zoneEscluse.length > 0) {
    return statoEsistente.zoneEscluseAutoDaLavoro === true;
  }
  return true;
}

/**
 * Calcola zone escluse (terreno − vendemmiato) e ettari esclusi.
 * @param {{ terrenoPolygonCoords?: Array, zoneVendemmiate?: Array, ettariTotali?: number, ettariVendemmiati?: number }} options
 * @returns {Promise<{ zoneEscluse: Array, ettariEsclusi: number, fromGeometry: boolean }>}
 */
export async function computeZoneEscluseAutomatiche(options = {}) {
  const ettariTotali = Math.max(0, Number(options.ettariTotali) || 0);
  const ettariVendemmiati = Math.max(0, Number(options.ettariVendemmiati) || 0);
  const ettariEsclusi = Math.max(
    0,
    Math.round((ettariTotali - ettariVendemmiati) * 100) / 100
  );

  if (ettariEsclusi <= 0.001) {
    return { zoneEscluse: [], ettariEsclusi: 0, fromGeometry: false };
  }

  const boundary = normalizePolygonCoords(options.terrenoPolygonCoords);
  const harvestedPolys = (options.zoneVendemmiate || [])
    .map((z) => normalizePolygonCoords(z?.coordinates || z?.coords))
    .filter((coords) => coords.length >= 3);

  if (boundary.length < 3 || !harvestedPolys.length) {
    return { zoneEscluse: [], ettariEsclusi, fromGeometry: false };
  }

  try {
    const pc = await getPolygonClippingLib();
    const subject = latLngPolygonsToClipMultiPolygon([boundary]);
    let harvestedUnion = [];
    harvestedPolys.forEach((poly) => {
      const part = latLngPolygonsToClipMultiPolygon([poly]);
      harvestedUnion = harvestedUnion.length ? pc.union(harvestedUnion, part) : part;
    });
    const diff = pc.difference(subject, harvestedUnion);
    const zoneEscluse = sanitizeZoneEscluse(clipMultiPolygonToZoneEscluse(diff));
    return {
      zoneEscluse,
      ettariEsclusi,
      fromGeometry: zoneEscluse.length > 0
    };
  } catch (err) {
    console.warn('[VM] computeZoneEscluseAutomatiche:', err.message || err);
    return { zoneEscluse: [], ettariEsclusi, fromGeometry: false };
  }
}

export function buildStagioneWithNetArea(statoAnno = {}, ettariTotali, options = {}) {
  const zoneEscluse = Array.isArray(statoAnno.zoneEscluse) ? statoAnno.zoneEscluse : [];
  let ettariEsclusi = statoAnno.ettariEsclusi != null ? Number(statoAnno.ettariEsclusi) : null;

  if (ettariEsclusi == null && zoneEscluse.length > 0) {
    const fromGeometry = sumExcludedAreaHectares(zoneEscluse, options.mapsApi);
    if (fromGeometry != null) ettariEsclusi = fromGeometry;
  }

  const ettariVendemmiati = computeEttariVendemmiati(ettariTotali, {
    ettariEsclusi: ettariEsclusi || 0,
    ettariVendemmiatiManuali: options.ettariVendemmiatiManuali ?? statoAnno.ettariVendemmiatiManuali
  });

  return {
    ...statoAnno,
    zoneEscluse,
    ettariTotaliSnapshot: ettariTotali,
    ettariEsclusi: ettariEsclusi != null ? ettariEsclusi : (statoAnno.ettariEsclusi || 0),
    ettariVendemmiati
  };
}

export default {
  normalizeLatLngCoord,
  serializePolygonPath,
  sanitizeZoneEscluse,
  normalizePolygonCoords,
  computeEttariVendemmiati,
  sumExcludedAreaHectares,
  shouldAutoGenerateZoneEscluse,
  computeZoneEscluseAutomatiche,
  buildStagioneWithNetArea
};
