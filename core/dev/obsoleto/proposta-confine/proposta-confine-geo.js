/**
 * Geometria per la proposta confine da tap (Fase 0).
 *
 * ABBANDONATO come prodotto (no-go segmentatore 2026-09-05). Helper puri
 * tenuti come archivio / test. Non collegare alla UI Terreni.
 *
 * Puro: niente Google Maps, niente Tony. L’area in produzione resta
 * `updateAreaInfo` / `computeArea`; qui lo shoelace locale serve a test e score.
 *
 * @module core/dev/obsoleto/proposta-confine/proposta-confine-geo
 */

import {
  toLatLngPoint,
  haversineMeters,
  pointInPolygonLatLng,
  hasUsableTerrenoPolygon
} from '../../../js/zona-lavorata-slice.js';

const METERS_PER_DEG_LAT = 111320;
const CLOSE_RING_M = 0.5;
const TILE_SIZE = 256;

export const CAMPO_GIUSTO_IOU = 0.5;
export const RITOCCO_MAX_VERTICI = 4;
export const RITOCCO_TOLERANCE_M = 4;
export const FUSED_AREA_RATIO = 1.8;
/** Quota della bozza che può stare fuori dal poligono salvato (bordo). Oltre = invasione. */
export const MAX_OUTSIDE_FRACTION = 0.08;
export const OVERLAP_MIN_M2 = 1;
export const RASTER_CELL_M = 2;

/**
 * @param {Array<{lat?:number,lng?:number}>|null|undefined} coords
 * @returns {Array<{lat:number,lng:number}>}
 */
export function normalizeRing(coords) {
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

/**
 * @param {Array<{lat:number,lng:number}>} ring
 * @returns {{lat:number,lng:number}|null}
 */
export function polygonCentroid(ring) {
  const pts = normalizeRing(ring);
  if (!pts.length) return null;
  let lat = 0;
  let lng = 0;
  for (const p of pts) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / pts.length, lng: lng / pts.length };
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

function shoelaceAreaM2(ringXY) {
  let a = 0;
  const n = ringXY.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += ringXY[i].x * ringXY[j].y - ringXY[j].x * ringXY[i].y;
  }
  return Math.abs(a) / 2;
}

/**
 * Superficie in m² (proiezione locale). Per i test e lo score Fase 0.
 * @param {Array<{lat?:number,lng?:number}>|null|undefined} coords
 * @returns {number}
 */
export function polygonAreaM2(coords) {
  const ring = normalizeRing(coords);
  if (ring.length < 3) return 0;
  const origin = polygonCentroid(ring);
  return shoelaceAreaM2(ring.map((p) => toXY(p, origin)));
}

/**
 * Superficie in ettari (stesso shoelace di `polygonAreaM2`).
 * @param {Array<{lat?:number,lng?:number}>|null|undefined} coords
 * @returns {number}
 */
export function polygonAreaHa(coords) {
  return polygonAreaM2(coords) / 10000;
}

function combinedOrigin(a, b) {
  const ca = polygonCentroid(a);
  const cb = polygonCentroid(b);
  if (ca && cb) {
    return { lat: (ca.lat + cb.lat) / 2, lng: (ca.lng + cb.lng) / 2 };
  }
  return ca || cb || { lat: 0, lng: 0 };
}

function bboxXY(rings, origin) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const p of ring) {
      const xy = toXY(p, origin);
      if (xy.x < minX) minX = xy.x;
      if (xy.y < minY) minY = xy.y;
      if (xy.x > maxX) maxX = xy.x;
      if (xy.y > maxY) maxY = xy.y;
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

/**
 * IoU raster (celle ~2 m). Funziona anche su poligoni concavi.
 * @param {Array} a
 * @param {Array} b
 * @param {{ cellM?: number }} [options]
 * @returns {number} 0–1, o 0 se un anello non è usabile
 */
export function polygonIoU(a, b, options) {
  const ringA = normalizeRing(a);
  const ringB = normalizeRing(b);
  if (ringA.length < 3 || ringB.length < 3) return 0;

  const cellM = options && Number.isFinite(options.cellM) ? options.cellM : RASTER_CELL_M;
  const origin = combinedOrigin(ringA, ringB);
  const box = bboxXY([ringA, ringB], origin);
  const pad = cellM;
  const minX = box.minX - pad;
  const minY = box.minY - pad;
  const cols = Math.max(1, Math.ceil((box.maxX - minX + pad) / cellM));
  const rows = Math.max(1, Math.ceil((box.maxY - minY + pad) / cellM));

  let inter = 0;
  let union = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const xy = {
        x: minX + (col + 0.5) * cellM,
        y: minY + (row + 0.5) * cellM
      };
      const ll = fromXY(xy, origin);
      const inA = pointInPolygonLatLng(ll, ringA);
      const inB = pointInPolygonLatLng(ll, ringB);
      if (inA && inB) inter += 1;
      if (inA || inB) union += 1;
    }
  }
  if (union === 0) return 0;
  return inter / union;
}

/**
 * Intersezione stimata in m² (stessa griglia dell’IoU).
 * @param {Array} a
 * @param {Array} b
 * @param {{ cellM?: number }} [options]
 * @returns {number}
 */
export function polygonIntersectionM2(a, b, options) {
  const ringA = normalizeRing(a);
  const ringB = normalizeRing(b);
  if (ringA.length < 3 || ringB.length < 3) return 0;

  const cellM = options && Number.isFinite(options.cellM) ? options.cellM : RASTER_CELL_M;
  const origin = combinedOrigin(ringA, ringB);
  const box = bboxXY([ringA, ringB], origin);
  const pad = cellM;
  const minX = box.minX - pad;
  const minY = box.minY - pad;
  const cols = Math.max(1, Math.ceil((box.maxX - minX + pad) / cellM));
  const rows = Math.max(1, Math.ceil((box.maxY - minY + pad) / cellM));
  let inter = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const xy = {
        x: minX + (col + 0.5) * cellM,
        y: minY + (row + 0.5) * cellM
      };
      const ll = fromXY(xy, origin);
      if (pointInPolygonLatLng(ll, ringA) && pointInPolygonLatLng(ll, ringB)) {
        inter += 1;
      }
    }
  }
  return inter * cellM * cellM;
}

/**
 * @param {Array} a
 * @param {Array} b
 * @param {{ minM2?: number, cellM?: number }} [options]
 * @returns {boolean}
 */
export function polygonsOverlap(a, b, options) {
  const minM2 = options && Number.isFinite(options.minM2) ? options.minM2 : OVERLAP_MIN_M2;
  return polygonIntersectionM2(a, b, options) > minM2;
}

/**
 * Altri terreni dello stesso tenant/famiglia che intersecano la proposta.
 * @param {Array} proposta
 * @param {Array<{ id?: string, nome?: string, polygonCoords?: Array }>} others
 * @param {{ excludeId?: string }} [options]
 * @returns {Array<{ id: string|null, nome: string, intersectionM2: number }>}
 */
export function findOverlappingTerreni(proposta, others, options) {
  const excludeId = options && options.excludeId != null ? String(options.excludeId) : '';
  const ring = normalizeRing(proposta);
  if (ring.length < 3 || !Array.isArray(others)) return [];
  const hits = [];
  for (const t of others) {
    const id = t && t.id != null ? String(t.id) : '';
    if (excludeId && id === excludeId) continue;
    const other = normalizeRing(t && t.polygonCoords);
    if (other.length < 3) continue;
    const intersectionM2 = polygonIntersectionM2(ring, other);
    if (intersectionM2 > OVERLAP_MIN_M2) {
      hits.push({
        id: id || null,
        nome: (t && t.nome) || '',
        intersectionM2
      });
    }
  }
  return hits;
}

function distPointToSegmentM(p, a, b) {
  const origin = p;
  const P = { x: 0, y: 0 };
  const A = toXY(a, origin);
  const B = toXY(b, origin);
  const abx = B.x - A.x;
  const aby = B.y - A.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-6) return haversineMeters(p, a);
  let t = ((P.x - A.x) * abx + (P.y - A.y) * aby) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const qx = A.x + t * abx;
  const qy = A.y + t * aby;
  return Math.hypot(P.x - qx, P.y - qy);
}

/**
 * Distanza minima di un punto al perimetro (metri).
 * @param {{lat:number,lng:number}} point
 * @param {Array} ring
 * @returns {number}
 */
export function distanceToRingMeters(point, ring) {
  const pts = normalizeRing(ring);
  if (!point || pts.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = distPointToSegmentM(point, pts[i], pts[(i + 1) % pts.length]);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Quanti vertici della proposta distano più di `toleranceM` dal riferimento.
 * @param {Array} proposta
 * @param {Array} riferimento
 * @param {{ toleranceM?: number }} [options]
 * @returns {number}
 */
export function countRitoccoVertices(proposta, riferimento, options) {
  const ringP = normalizeRing(proposta);
  const ringR = normalizeRing(riferimento);
  if (ringP.length < 3 || ringR.length < 3) return Infinity;
  const tol =
    options && Number.isFinite(options.toleranceM)
      ? options.toleranceM
      : RITOCCO_TOLERANCE_M;
  let n = 0;
  for (const v of ringP) {
    if (distanceToRingMeters(v, ringR) > tol) n += 1;
  }
  return n;
}

/**
 * |ha_proposta − ha_salvati| / ha_salvati. Null se il riferimento ha area 0.
 * @param {Array} proposta
 * @param {Array} riferimento
 * @returns {number|null}
 */
export function scostamentoEttari(proposta, riferimento) {
  const haRef = polygonAreaHa(riferimento);
  if (!(haRef > 0)) return null;
  return Math.abs(polygonAreaHa(proposta) - haRef) / haRef;
}

/**
 * Frazione dell’area proposta che non cade nel riferimento.
 * 0 = tutta dentro; 0,16 = il 16% è un pezzo extra (altro campo / strada).
 * @param {Array} proposta
 * @param {Array} riferimento
 * @param {{ cellM?: number }} [options]
 * @returns {number}
 */
export function proposalOutsideFraction(proposta, riferimento, options) {
  const areaP = polygonAreaM2(proposta);
  if (!(areaP > 0)) return 1;
  const inter = polygonIntersectionM2(proposta, riferimento, options);
  return Math.max(0, Math.min(1, (areaP - inter) / areaP));
}

/**
 * Score Fase 0 (§7): campo giusto, ritocco, scostamento ha.
 * @param {Array} proposta
 * @param {Array} riferimento
 * @returns {{
 *   ok: boolean,
 *   campoGiusto: boolean,
 *   ritoccoMinimo: boolean,
 *   ritoccoCount: number,
 *   iou: number,
 *   haProposta: number,
 *   haRiferimento: number,
 *   scostamentoEttari: number|null,
 *   fusedSuspect: boolean,
 *   outsideFraction: number,
 *   invasion: boolean
 * }}
 */
export function scoreProposal(proposta, riferimento) {
  const ringP = normalizeRing(proposta);
  const ringR = normalizeRing(riferimento);
  const empty = {
    ok: false,
    campoGiusto: false,
    ritoccoMinimo: false,
    ritoccoCount: Infinity,
    iou: 0,
    haProposta: 0,
    haRiferimento: 0,
    scostamentoEttari: null,
    fusedSuspect: false,
    outsideFraction: 1,
    invasion: false
  };
  if (ringP.length < 3 || ringR.length < 3) return empty;

  const haProposta = polygonAreaHa(ringP);
  const haRiferimento = polygonAreaHa(ringR);
  const iou = polygonIoU(ringP, ringR);
  const centro = polygonCentroid(ringP);
  const centroDentro = !!(centro && pointInPolygonLatLng(centro, ringR));
  const fusedSuspect =
    haRiferimento > 0 && haProposta / haRiferimento > FUSED_AREA_RATIO;
  const outsideFraction = proposalOutsideFraction(ringP, ringR);
  const invasion = outsideFraction > MAX_OUTSIDE_FRACTION;
  const campoGiusto =
    centroDentro && iou >= CAMPO_GIUSTO_IOU && !fusedSuspect && !invasion;
  const ritoccoCount = countRitoccoVertices(ringP, ringR);
  const ritoccoMinimo = ritoccoCount <= RITOCCO_MAX_VERTICI;

  return {
    ok: true,
    campoGiusto,
    ritoccoMinimo,
    ritoccoCount,
    iou,
    haProposta,
    haRiferimento,
    scostamentoEttari: scostamentoEttari(ringP, ringR),
    fusedSuspect,
    outsideFraction,
    invasion
  };
}

export { hasUsableTerrenoPolygon };

// ---------------------------------------------------------------------------
// Web Mercator (Static Maps / tile) — tap pixel ↔ lat/lng
// ---------------------------------------------------------------------------

/**
 * @param {number} lat
 * @param {number} lng
 * @param {number} zoom
 * @returns {{x:number,y:number}}
 */
export function latLngToWorldPixel(lat, lng, zoom) {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const y =
    (0.5 - Math.log((1 + Math.sin(latRad)) / (1 - Math.sin(latRad))) / (4 * Math.PI)) *
    scale;
  return { x, y };
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} zoom
 * @returns {{lat:number,lng:number}}
 */
export function worldPixelToLatLng(x, y, zoom) {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {{lat:number,lng:number}} center
 * @param {number} zoom
 * @param {number} width
 * @param {number} height
 * @returns {{x:number,y:number}}
 */
export function latLngToImagePixel(lat, lng, center, zoom, width, height) {
  const c = latLngToWorldPixel(center.lat, center.lng, zoom);
  const p = latLngToWorldPixel(lat, lng, zoom);
  return { x: p.x - c.x + width / 2, y: p.y - c.y + height / 2 };
}

/**
 * @param {number} px
 * @param {number} py
 * @param {{lat:number,lng:number}} center
 * @param {number} zoom
 * @param {number} width
 * @param {number} height
 * @returns {{lat:number,lng:number}}
 */
export function imagePixelToLatLng(px, py, center, zoom, width, height) {
  const c = latLngToWorldPixel(center.lat, center.lng, zoom);
  return worldPixelToLatLng(c.x + px - width / 2, c.y + py - height / 2, zoom);
}

/**
 * Zoom intero che fa stare i bounds in width×height (padding in px).
 * @param {{south:number,west:number,north:number,east:number}} bounds
 * @param {number} width
 * @param {number} height
 * @param {number} [paddingPx]
 * @returns {number}
 */
export function zoomToFitBounds(bounds, width, height, paddingPx) {
  const pad = Number.isFinite(paddingPx) ? paddingPx : 40;
  const w = Math.max(1, width - pad * 2);
  const h = Math.max(1, height - pad * 2);
  const sw = latLngToWorldPixel(bounds.south, bounds.west, 0);
  const ne = latLngToWorldPixel(bounds.north, bounds.east, 0);
  const fracX = Math.abs(ne.x - sw.x) / TILE_SIZE;
  const fracY = Math.abs(sw.y - ne.y) / TILE_SIZE;
  if (fracX < 1e-12 || fracY < 1e-12) return 18;
  const zX = Math.log2(w / (fracX * TILE_SIZE));
  const zY = Math.log2(h / (fracY * TILE_SIZE));
  const z = Math.min(zX, zY, 20);
  return Math.max(12, Math.min(20, Math.floor(z)));
}

/**
 * Vista satellite centrata sul poligono.
 * @param {Array} coords
 * @param {number} [width]
 * @param {number} [height]
 * @returns {{ center: {lat:number,lng:number}, zoom: number, bounds: object }|null}
 */
export function viewForPolygon(coords, width, height) {
  const ring = normalizeRing(coords);
  if (ring.length < 3) return null;
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;
  for (const p of ring) {
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
  }
  const bounds = { south, west, north, east };
  const center = { lat: (south + north) / 2, lng: (west + east) / 2 };
  const zoom = zoomToFitBounds(bounds, width || 640, height || 480, 48);
  return { center, zoom, bounds };
}

function douglasPeuckerXY(points, epsilonM) {
  if (points.length <= 2) return points.slice();
  let maxD = 0;
  let idx = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], first, last);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > epsilonM) {
    const left = douglasPeuckerXY(points.slice(0, idx + 1), epsilonM);
    const right = douglasPeuckerXY(points.slice(idx), epsilonM);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function perpDist(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len = Math.hypot(abx, aby);
  if (len < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(abx * (a.y - p.y) - aby * (a.x - p.x)) / len;
}

/**
 * Semplifica un anello lat/lng (Douglas-Peucker, epsilon in metri).
 * @param {Array} coords
 * @param {number} [epsilonM]
 * @returns {Array<{lat:number,lng:number}>}
 */
export function simplifyRingMeters(coords, epsilonM) {
  const ring = normalizeRing(coords);
  if (ring.length < 3) return ring;
  const eps = Number.isFinite(epsilonM) ? epsilonM : 3;
  const origin = polygonCentroid(ring);
  const xy = ring.map((p) => toXY(p, origin));
  xy.push({ ...xy[0] });
  const simple = douglasPeuckerXY(xy, eps);
  if (simple.length >= 2) {
    const a = simple[0];
    const b = simple[simple.length - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.05) simple.pop();
  }
  if (simple.length < 3) return ring;
  return simple.map((p) => fromXY(p, origin));
}

function maskAt(data, width, height, x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;
  return data[y * width + x] ? 1 : 0;
}

/**
 * Contorno esterno (Moore) di una maschera binaria → pixel {x,y}.
 * @param {{ data: ArrayLike<number>, width: number, height: number }} mask
 * @returns {Array<{x:number,y:number}>}
 */
export function maskContourPixels(mask) {
  if (!mask || !mask.data) return [];
  const width = mask.width | 0;
  const height = mask.height | 0;
  const data = mask.data;
  if (width < 1 || height < 1) return [];

  let sx = -1;
  let sy = -1;
  outer: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (maskAt(data, width, height, x, y) && !maskAt(data, width, height, x - 1, y)) {
        sx = x;
        sy = y;
        break outer;
      }
    }
  }
  if (sx < 0) return [];

  // N, NE, E, SE, S, SW, W, NW
  const dx = [0, 1, 1, 1, 0, -1, -1, -1];
  const dy = [-1, -1, 0, 1, 1, 1, 0, -1];
  const contour = [];
  let x = sx;
  let y = sy;
  let dir = 4;
  const maxSteps = width * height + 8;

  for (let step = 0; step < maxSteps; step++) {
    contour.push({ x, y });
    let found = false;
    const startDir = (dir + 6) % 8;
    for (let k = 0; k < 8; k++) {
      const nd = (startDir + k) % 8;
      const nx = x + dx[nd];
      const ny = y + dy[nd];
      if (maskAt(data, width, height, nx, ny)) {
        x = nx;
        y = ny;
        dir = nd;
        found = true;
        break;
      }
    }
    if (!found) break;
    if (x === sx && y === sy && contour.length > 2) break;
  }
  return contour;
}

/**
 * Maschera binaria + vista Web Mercator → `polygonCoords`.
 * @param {{ data: ArrayLike<number>, width: number, height: number }} mask
 * @param {{
 *   center: {lat:number,lng:number},
 *   zoom: number,
 *   width: number,
 *   height: number
 * }} view
 * @param {{ simplifyM?: number }} [options]
 * @returns {Array<{lat:number,lng:number}>}
 */
export function maskToPolygon(mask, view, options) {
  if (!view || !view.center || !Number.isFinite(view.zoom)) return [];
  const contour = maskContourPixels(mask);
  if (contour.length < 3) return [];

  const imageW = view.width;
  const imageH = view.height;
  const maskW = mask.width;
  const maskH = mask.height;
  const sx = imageW / maskW;
  const sy = imageH / maskH;

  const ring = contour.map((p) =>
    imagePixelToLatLng(
      (p.x + 0.5) * sx,
      (p.y + 0.5) * sy,
      view.center,
      view.zoom,
      imageW,
      imageH
    )
  );
  const simplifyM = options && Number.isFinite(options.simplifyM) ? options.simplifyM : 3;
  return simplifyRingMeters(ring, simplifyM);
}

/**
 * URL Static Maps (stessa vista; i pixel in browser spesso non sono leggibili per CORS).
 * @param {{
 *   center: {lat:number,lng:number},
 *   zoom: number,
 *   width: number,
 *   height: number,
 *   apiKey: string,
 *   scale?: number
 * }} opts
 * @returns {string}
 */
export function buildStaticMapUrl(opts) {
  const w = Math.min(640, Math.max(1, opts.width | 0));
  const h = Math.min(640, Math.max(1, opts.height | 0));
  const scale = opts.scale === 2 ? 2 : 1;
  const c = opts.center;
  return (
    'https://maps.googleapis.com/maps/api/staticmap' +
    `?center=${encodeURIComponent(c.lat + ',' + c.lng)}` +
    `&zoom=${opts.zoom}` +
    `&size=${w}x${h}` +
    `&scale=${scale}` +
    '&maptype=satellite' +
    `&key=${encodeURIComponent(opts.apiKey || '')}`
  );
}
