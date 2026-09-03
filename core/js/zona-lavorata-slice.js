/**
 * Zona lavorata da due punti (inizio / fine).
 *
 * Taglia il perimetro già tracciato del terreno: la zona è la fascia del
 * poligono compresa tra due rette perpendicolari alla direzione inizio→fine.
 * Vale per filari e seminativi: non richiede una griglia di filari.
 *
 * Puro (niente Google Maps / Tony). Conferma umana resta nel form mappa.
 *
 * @module core/js/zona-lavorata-slice
 */

const METERS_PER_DEG_LAT = 111320;
const CLIP_EPS_M = 0.05;
const CLOSE_RING_M = 0.5;

/**
 * @param {{lat?:number,lng?:number}|null|undefined} p
 * @returns {{lat:number,lng:number}|null}
 */
export function toLatLngPoint(p) {
  if (!p || typeof p !== 'object') return null;
  const lat = Number(typeof p.lat === 'function' ? p.lat() : p.lat);
  const lng = Number(typeof p.lng === 'function' ? p.lng() : p.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * @param {Array<{lat:number,lng:number}>|null|undefined} coords
 * @returns {boolean}
 */
export function hasUsableTerrenoPolygon(coords) {
  return Array.isArray(coords) && normalizeRing(coords).length >= 3;
}

/**
 * Distanza in metri (haversine).
 * @param {{lat:number,lng:number}} a
 * @param {{lat:number,lng:number}} b
 * @returns {number}
 */
export function haversineMeters(a, b) {
  if (!a || !b) return NaN;
  const toRad = (d) => (d * Math.PI) / 180;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = lat2 - lat1;
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Ray casting su lat/lng (appezzamenti agricoli, scala locale).
 * @param {{lat:number,lng:number}} point
 * @param {Array<{lat:number,lng:number}>} polygon
 * @returns {boolean}
 */
export function pointInPolygonLatLng(point, polygon) {
  const ring = normalizeRing(polygon);
  if (!point || ring.length < 3) return false;
  let inside = false;
  const x = point.lng;
  const y = point.lat;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lng;
    const yi = ring[i].lat;
    const xj = ring[j].lng;
    const yj = ring[j].lat;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-18) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Taglia il poligono del terreno tra due punti.
 *
 * @param {Array<{lat:number,lng:number}>} polygonCoords
 * @param {{lat:number,lng:number}} start
 * @param {{lat:number,lng:number}} end
 * @param {{ minDistanceMeters?: number }} [options]
 * @returns {{
 *   ok: boolean,
 *   error: string|null,
 *   coords: Array<{lat:number,lng:number}>,
 *   areaM2: number,
 *   areaHa: number,
 *   lengthMeters: number,
 *   start: {lat:number,lng:number}|null,
 *   end: {lat:number,lng:number}|null
 * }}
 */
export function slicePolygonBetweenPoints(polygonCoords, start, end, options) {
  const minDistanceMeters =
    options && Number.isFinite(options.minDistanceMeters)
      ? options.minDistanceMeters
      : 3;

  const empty = (error, extra) =>
    Object.assign(
      {
        ok: false,
        error,
        coords: [],
        areaM2: 0,
        areaHa: 0,
        lengthMeters: 0,
        start: toLatLngPoint(start),
        end: toLatLngPoint(end)
      },
      extra || {}
    );

  const polygon = normalizeRing(polygonCoords);
  if (polygon.length < 3) return empty('terreno_senza_perimetro');

  const a = toLatLngPoint(start);
  const b = toLatLngPoint(end);
  if (!a || !b) return empty('punti_non_validi');

  const origin = polygonCentroid(polygon);
  const polyXY = polygon.map((p) => toXY(p, origin));
  const aXY = toXY(a, origin);
  const bXY = toXY(b, origin);
  const dx = bXY.x - aXY.x;
  const dy = bXY.y - aXY.y;
  const lengthMeters = Math.hypot(dx, dy);
  if (lengthMeters < minDistanceMeters) {
    return empty('punti_troppo_vicini', { lengthMeters });
  }

  const ux = dx / lengthMeters;
  const uy = dy / lengthMeters;
  const tOf = (p) => (p.x - aXY.x) * ux + (p.y - aXY.y) * uy;

  let clipped = clipHalfPlane(
    polyXY,
    (p) => tOf(p) >= -CLIP_EPS_M,
    (p1, p2) => intersectAtT(p1, p2, tOf, 0)
  );
  clipped = clipHalfPlane(
    clipped,
    (p) => tOf(p) <= lengthMeters + CLIP_EPS_M,
    (p1, p2) => intersectAtT(p1, p2, tOf, lengthMeters)
  );
  clipped = dedupeRing(clipped, 0.02);

  if (clipped.length < 3) return empty('zona_vuota', { lengthMeters });

  const areaM2 = shoelaceAreaM2(clipped);
  if (areaM2 < 1) return empty('zona_vuota', { lengthMeters, areaM2 });

  const coords = clipped.map((p) => fromXY(p, origin));
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (haversineMeters(first, last) > CLOSE_RING_M) {
    coords.push({ lat: first.lat, lng: first.lng });
  }

  return {
    ok: true,
    error: null,
    coords,
    areaM2,
    areaHa: areaM2 / 10000,
    lengthMeters,
    start: a,
    end: b
  };
}

/**
 * Rettangolo geografico di prova (metri da un'origine).
 * @param {{lat:number,lng:number}} origin
 * @param {number} widthM
 * @param {number} heightM
 * @returns {Array<{lat:number,lng:number}>}
 */
export function rectanglePolygonMeters(origin, widthM, heightM) {
  const sw = origin;
  const se = fromXY({ x: widthM, y: 0 }, origin);
  const ne = fromXY({ x: widthM, y: heightM }, origin);
  const nw = fromXY({ x: 0, y: heightM }, origin);
  return [sw, se, ne, nw];
}

function normalizeRing(coords) {
  if (!Array.isArray(coords)) return [];
  const out = [];
  for (const raw of coords) {
    const p = toLatLngPoint(raw);
    if (!p) continue;
    const prev = out[out.length - 1];
    if (prev && haversineMeters(prev, p) < 0.05) continue;
    out.push(p);
  }
  if (out.length >= 2 && haversineMeters(out[0], out[out.length - 1]) < CLOSE_RING_M) {
    out.pop();
  }
  return out;
}

function polygonCentroid(ring) {
  let lat = 0;
  let lng = 0;
  for (const p of ring) {
    lat += p.lat;
    lng += p.lng;
  }
  const n = ring.length || 1;
  return { lat: lat / n, lng: lng / n };
}

function metersPerDegLng(lat) {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

function toXY(p, origin) {
  return {
    x: (p.lng - origin.lng) * metersPerDegLng(origin.lat),
    y: (p.lat - origin.lat) * METERS_PER_DEG_LAT
  };
}

function fromXY(xy, origin) {
  const mLng = metersPerDegLng(origin.lat);
  return {
    lat: origin.lat + xy.y / METERS_PER_DEG_LAT,
    lng: origin.lng + xy.x / mLng
  };
}

function shoelaceAreaM2(ring) {
  let a = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += ring[i].x * ring[j].y - ring[j].x * ring[i].y;
  }
  return Math.abs(a) / 2;
}

function clipHalfPlane(vertices, isInside, intersect) {
  if (!vertices || vertices.length < 3) return [];
  const out = [];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const curr = vertices[i];
    const prev = vertices[(i + n - 1) % n];
    const currIn = isInside(curr);
    const prevIn = isInside(prev);
    if (currIn) {
      if (!prevIn) out.push(intersect(prev, curr));
      out.push(curr);
    } else if (prevIn) {
      out.push(intersect(prev, curr));
    }
  }
  return out;
}

function intersectAtT(p1, p2, tOf, tCut) {
  const t1 = tOf(p1);
  const t2 = tOf(p2);
  const d = t2 - t1;
  if (Math.abs(d) < 1e-12) return { x: p1.x, y: p1.y };
  const s = (tCut - t1) / d;
  return {
    x: p1.x + s * (p2.x - p1.x),
    y: p1.y + s * (p2.y - p1.y)
  };
}

function dedupeRing(ring, minDistM) {
  if (!ring.length) return [];
  const out = [];
  for (const p of ring) {
    const prev = out[out.length - 1];
    if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) < minDistM) continue;
    out.push(p);
  }
  if (
    out.length >= 2 &&
    Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < minDistM
  ) {
    out.pop();
  }
  return out;
}
