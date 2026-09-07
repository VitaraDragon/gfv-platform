/**
 * Disegno confini terreno più veloce (Fase 1b) — puro, niente Maps / Tony.
 *
 * Chiusura vicino al primo vertice, doppio tap, debounce dito,
 * aggancio al bordo dei campi già in anagrafe.
 *
 * @module core/js/terreni-draw-helpers
 */

import {
  toLatLngPoint,
  haversineMeters,
  hasUsableTerrenoPolygon
} from './zona-lavorata-slice.js';

const METERS_PER_DEG_LAT = 111320;

/** Tap entro questi metri dal primo vertice (≥3 punti) = chiudi. */
export const CLOSE_TO_START_M = 12;
/** Tap troppo vicino all’ultimo vertice = rimbalzo dito, ignora. */
export const DEBOUNCE_VERTEX_M = 2.5;
/** Due tap nello stesso punto entro questo tempo = ho finito. */
export const DOUBLE_TAP_MS = 380;
export const DOUBLE_TAP_M = 8;
/** Aggancio a vertice/lato di un terreno già salvato. */
export const SNAP_NEIGHBOR_M = 6;

/**
 * @param {{lat:number,lng:number}} p
 * @param {{lat:number,lng:number}} origin
 * @returns {{x:number,y:number}}
 */
function toXY(p, origin) {
  const mLng = METERS_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180);
  return {
    x: (p.lng - origin.lng) * mLng,
    y: (p.lat - origin.lat) * METERS_PER_DEG_LAT
  };
}

/**
 * @param {{x:number,y:number}} xy
 * @param {{lat:number,lng:number}} origin
 * @returns {{lat:number,lng:number}}
 */
function fromXY(xy, origin) {
  const mLng = METERS_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180);
  return {
    lat: origin.lat + xy.y / METERS_PER_DEG_LAT,
    lng: origin.lng + xy.x / mLng
  };
}

/**
 * Punto più vicino sul segmento a–b.
 * @param {{lat:number,lng:number}} p
 * @param {{lat:number,lng:number}} a
 * @param {{lat:number,lng:number}} b
 * @returns {{lat:number,lng:number}}
 */
export function nearestPointOnSegment(p, a, b) {
  if (!p || !a || !b) return p;
  const P = toXY(p, a);
  const B = toXY(b, a);
  const len2 = B.x * B.x + B.y * B.y;
  if (len2 < 1e-6) return { lat: a.lat, lng: a.lng };
  let t = (P.x * B.x + P.y * B.y) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return fromXY({ x: B.x * t, y: B.y * t }, a);
}

/**
 * @param {Array} terreni
 * @param {string|null|undefined} excludeId
 * @returns {Array<Array<{lat:number,lng:number}>>}
 */
export function neighborRingsFromTerreni(terreni, excludeId) {
  const out = [];
  if (!Array.isArray(terreni)) return out;
  for (const t of terreni) {
    if (!t || t.id === excludeId) continue;
    if (!hasUsableTerrenoPolygon(t.polygonCoords)) continue;
    const ring = [];
    for (const raw of t.polygonCoords) {
      const p = toLatLngPoint(raw);
      if (p) ring.push(p);
    }
    if (ring.length >= 3) out.push(ring);
  }
  return out;
}

/**
 * @param {{lat:number,lng:number}} point
 * @param {Array<Array<{lat:number,lng:number}>>} rings
 * @param {number} [toleranceM]
 * @returns {{ point: {lat:number,lng:number}, snapped: boolean, kind: 'vertex'|'edge'|null, distanceM: number }}
 */
export function snapToNeighborRings(point, rings, toleranceM = SNAP_NEIGHBOR_M) {
  const p = toLatLngPoint(point);
  if (!p) {
    return { point, snapped: false, kind: null, distanceM: Infinity };
  }
  let best = p;
  let bestD = toleranceM;
  let kind = null;
  const list = Array.isArray(rings) ? rings : [];
  for (const ring of list) {
    if (!Array.isArray(ring) || ring.length < 2) continue;
    for (const v of ring) {
      const d = haversineMeters(p, v);
      if (d <= bestD) {
        bestD = d;
        best = v;
        kind = 'vertex';
      }
    }
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const proj = nearestPointOnSegment(p, a, b);
      const d = haversineMeters(p, proj);
      if (d < bestD) {
        bestD = d;
        best = proj;
        kind = 'edge';
      }
    }
  }
  if (!kind) {
    return { point: p, snapped: false, kind: null, distanceM: Infinity };
  }
  return { point: best, snapped: true, kind, distanceM: bestD };
}

/**
 * @param {object} input
 * @param {{lat?:number,lng?:number}} input.tap
 * @param {Array} input.vertices
 * @param {number} input.now
 * @param {number|null} [input.lastTapAt]
 * @param {{lat?:number,lng?:number}|null} [input.lastTapPoint]
 * @param {Array<Array>} [input.neighborRings]
 * @returns {{
 *   action: 'add'|'close'|'ignore',
 *   reason?: string,
 *   point?: {lat:number,lng:number},
 *   snapped?: boolean,
 *   snapKind?: string|null,
 *   dropLastIfNear?: boolean
 * }}
 */
export function resolveDrawTap(input) {
  const tap = toLatLngPoint(input && input.tap);
  if (!tap) return { action: 'ignore', reason: 'invalid' };

  const verts = [];
  const rawVerts = input && input.vertices;
  if (Array.isArray(rawVerts)) {
    for (const raw of rawVerts) {
      const v = toLatLngPoint(raw);
      if (v) verts.push(v);
    }
  }

  if (verts.length >= 3 && haversineMeters(tap, verts[0]) <= CLOSE_TO_START_M) {
    return { action: 'close', reason: 'near_start', point: verts[0] };
  }

  const lastTapAt = input && input.lastTapAt;
  const lastTapPoint = toLatLngPoint(input && input.lastTapPoint);
  const now = Number(input && input.now);
  if (
    verts.length >= 3 &&
    lastTapPoint &&
    Number.isFinite(lastTapAt) &&
    Number.isFinite(now) &&
    now - lastTapAt <= DOUBLE_TAP_MS &&
    haversineMeters(tap, lastTapPoint) <= DOUBLE_TAP_M
  ) {
    return { action: 'close', reason: 'double_tap', dropLastIfNear: true };
  }

  if (verts.length >= 1 && haversineMeters(tap, verts[verts.length - 1]) <= DEBOUNCE_VERTEX_M) {
    return { action: 'ignore', reason: 'debounce' };
  }

  const snap = snapToNeighborRings(tap, input && input.neighborRings, SNAP_NEIGHBOR_M);
  return {
    action: 'add',
    point: snap.point,
    snapped: snap.snapped,
    snapKind: snap.kind
  };
}
