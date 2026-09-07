/**
 * Adattatore segmentatore per la proposta confine (Fase 0).
 *
 * ABBANDONATO (no-go 2026-09-05): non usare in prodotto, non estendere.
 * SAM / macchie non è usabile come proposta di confine.
 *
 * Interfaccia unica: `{ image, pointPx, bounds } → { polygonCoords, latencyMs }`.
 * SAM (browser, transformers.js) è l’engine v1; lo stub serve a CI e smoke
 * senza scaricare il modello. Gemini non entra qui.
 *
 * Pixel satellite: i tile Google Static Maps in browser sono spesso opachi
 * (CORS). La vista interattiva resta Maps; per l’inferenza si compone la
 * stessa finestra Web Mercator da imagery pubblica (ESRI World Imagery).
 *
 * @module core/dev/obsoleto/proposta-confine/proposta-confine-segmenter
 */

import {
  maskToPolygon,
  imagePixelToLatLng,
  latLngToImagePixel,
  viewForPolygon,
  buildStaticMapUrl
} from './proposta-confine-geo.js';
import { rectanglePolygonMeters } from '../../../js/zona-lavorata-slice.js';

export const DEFAULT_INFER_TIMEOUT_MS = 45000;
export const DEFAULT_LOAD_TIMEOUT_MS = 180000;
export const DEFAULT_VIEW_SIZE = { width: 640, height: 480 };

const SLIMSAM_ID = 'Xenova/slimsam-77-uniform';
const TRANSFORMERS_CDN =
  'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/+esm';

/** @type {Promise<{ model: object, processor: object, RawImage: Function }>|null} */
let samLoadPromise = null;

/**
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<never>}
 */
function timeoutReject(ms, label) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(label || 'timeout_segmentatore')), ms);
  });
}

/**
 * @param {{
 *   center: {lat:number,lng:number},
 *   zoom: number,
 *   width: number,
 *   height: number,
 *   apiKey?: string,
 *   scale?: number
 * }} view
 * @returns {string}
 */
export function staticMapUrlForView(view) {
  return buildStaticMapUrl({
    center: view.center,
    zoom: view.zoom,
    width: view.width,
    height: view.height,
    apiKey: view.apiKey || '',
    scale: view.scale
  });
}

/**
 * Compone un’immagine Web Mercator da tile ESRI (CORS ok in browser).
 * Stessa proiezione/zoom/centro della vista Static Maps.
 *
 * @param {{ center: {lat:number,lng:number}, zoom: number, width: number, height: number }} view
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<ImageData>}
 */
export async function composeEsriViewport(view, options) {
  const fetchImpl = (options && options.fetchImpl) || fetch;
  const { width, height, zoom, center } = view;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_non_disponibile');

  const TILE = 256;
  const scale = TILE * Math.pow(2, zoom);
  const worldX = ((center.lng + 180) / 360) * scale;
  const latRad = (center.lat * Math.PI) / 180;
  const worldY =
    (0.5 - Math.log((1 + Math.sin(latRad)) / (1 - Math.sin(latRad))) / (4 * Math.PI)) *
    scale;

  const left = worldX - width / 2;
  const top = worldY - height / 2;
  const x0 = Math.floor(left / TILE);
  const y0 = Math.floor(top / TILE);
  const x1 = Math.floor((left + width) / TILE);
  const y1 = Math.floor((top + height) / TILE);
  const maxTile = Math.pow(2, zoom);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const wrappedX = ((tx % maxTile) + maxTile) % maxTile;
      if (ty < 0 || ty >= maxTile) continue;
      const url =
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' +
        `${zoom}/${ty}/${wrappedX}`;
      const img = await loadImageBitmap(url, fetchImpl);
      const dx = Math.round(tx * TILE - left);
      const dy = Math.round(ty * TILE - top);
      ctx.drawImage(img, dx, dy);
      if (typeof img.close === 'function') img.close();
    }
  }

  return ctx.getImageData(0, 0, width, height);
}

function createCanvas(width, height) {
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }
  throw new Error('canvas_non_disponibile');
}

async function loadImageBitmap(url, fetchImpl) {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error('tile_fetch_failed');
  const blob = await res.blob();
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(blob);
  }
  throw new Error('createImageBitmap_non_disponibile');
}

/**
 * ImageData → maschera rettangolare intorno al tap (stub deterministico).
 * @param {{ x: number, y: number }} pointPx
 * @param {number} width
 * @param {number} height
 * @param {number} [halfW]
 * @param {number} [halfH]
 * @returns {{ data: Uint8Array, width: number, height: number }}
 */
export function stubMaskAroundPoint(pointPx, width, height, halfW, halfH) {
  const hw = Number.isFinite(halfW) ? halfW : 28;
  const hh = Number.isFinite(halfH) ? halfH : 18;
  const data = new Uint8Array(width * height);
  const x0 = Math.max(0, Math.round(pointPx.x - hw));
  const x1 = Math.min(width - 1, Math.round(pointPx.x + hw));
  const y0 = Math.max(0, Math.round(pointPx.y - hh));
  const y1 = Math.min(height - 1, Math.round(pointPx.y + hh));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      data[y * width + x] = 1;
    }
  }
  return { data, width, height };
}

/**
 * Stub: rettangolo in metri intorno al tap, oppure maschera → poligono se c’è una vista.
 *
 * @param {{ halfWidthM?: number, halfHeightM?: number }} [defaults]
 * @returns {(input: object) => Promise<{ polygonCoords: Array, latencyMs: number, engine: string }>}
 */
export function createStubSegmenter(defaults) {
  const halfW = defaults && Number.isFinite(defaults.halfWidthM) ? defaults.halfWidthM : 40;
  const halfH = defaults && Number.isFinite(defaults.halfHeightM) ? defaults.halfHeightM : 25;

  return async function segmentFromPoint(input) {
    const started = Date.now();
    const view = resolveView(input);
    const pointPx = resolvePointPx(input, view);
    if (view && pointPx) {
      const mask = stubMaskAroundPoint(pointPx, view.width, view.height);
      const polygonCoords = maskToPolygon(mask, view, { simplifyM: 2 });
      if (polygonCoords.length >= 3) {
        return { polygonCoords, latencyMs: Date.now() - started, engine: 'stub' };
      }
    }
    const tap = resolvePointLatLng(input, view);
    if (!tap) throw new Error('punto_non_valido');
    const sw = {
      lat: tap.lat - (halfH / 111320),
      lng: tap.lng - halfW / (111320 * Math.cos((tap.lat * Math.PI) / 180))
    };
    return {
      polygonCoords: rectanglePolygonMeters(sw, halfW * 2, halfH * 2),
      latencyMs: Date.now() - started,
      engine: 'stub'
    };
  };
}

function resolveView(input) {
  if (!input) return null;
  if (input.bounds && input.bounds.center) {
    return {
      center: input.bounds.center,
      zoom: input.bounds.zoom,
      width: input.bounds.width || DEFAULT_VIEW_SIZE.width,
      height: input.bounds.height || DEFAULT_VIEW_SIZE.height
    };
  }
  if (input.view && input.view.center) return input.view;
  return null;
}

function resolvePointPx(input, view) {
  if (input && input.pointPx && Number.isFinite(input.pointPx.x)) {
    return { x: input.pointPx.x, y: input.pointPx.y };
  }
  const ll = input && (input.pointLatLng || input.point);
  if (ll && view) {
    return latLngToImagePixel(ll.lat, ll.lng, view.center, view.zoom, view.width, view.height);
  }
  return null;
}

function resolvePointLatLng(input, view) {
  const ll = input && (input.pointLatLng || input.point);
  if (ll && Number.isFinite(ll.lat) && Number.isFinite(ll.lng)) {
    return { lat: ll.lat, lng: ll.lng };
  }
  if (input && input.pointPx && view) {
    return imagePixelToLatLng(
      input.pointPx.x,
      input.pointPx.y,
      view.center,
      view.zoom,
      view.width,
      view.height
    );
  }
  return null;
}

/**
 * transformers.js di default prova `/models/` sull’origine corrente
 * (localhost:8000 → 404). Il pilota deve scaricare da Hugging Face.
 * @param {object|null|undefined} env
 */
export function configureTransformersEnv(env) {
  if (!env) return env;
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.useBrowserCache = true;
  return env;
}

async function loadSamModules() {
  if (samLoadPromise) return samLoadPromise;
  samLoadPromise = (async () => {
    const mod = await import(/* @vite-ignore */ TRANSFORMERS_CDN);
    configureTransformersEnv(mod.env);
    const SamModel = mod.SamModel;
    const AutoProcessor = mod.AutoProcessor;
    const RawImage = mod.RawImage;
    if (!SamModel || !AutoProcessor || !RawImage) {
      throw new Error('transformers_sam_non_disponibile');
    }
    const model = await SamModel.from_pretrained(SLIMSAM_ID, { quantized: true });
    const processor = await AutoProcessor.from_pretrained(SLIMSAM_ID);
    return { model, processor, RawImage };
  })();
  samLoadPromise.catch(() => {
    samLoadPromise = null;
  });
  return samLoadPromise;
}

function imageDataToRawImage(imageData, RawImage) {
  const { width, height, data } = imageData;
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
  }
  return new RawImage(rgb, width, height, 3);
}

function unwrapMaskTensor(processed) {
  let t = processed;
  if (Array.isArray(t)) t = t[0];
  if (t && t.pred_masks) t = t.pred_masks;
  return t;
}

function bestMaskFromSam(outputs, width, height) {
  if (!outputs || !outputs.pred_masks) {
    throw new Error('sam_senza_maschera');
  }
  const tensor = outputs.pred_masks;
  const data = tensor.data || tensor;
  const dims = tensor.dims || tensor.size;
  // Tipico: [1, 1, nMasks, h, w] o [1, nMasks, h, w]
  let nMasks = 1;
  let mh = height;
  let mw = width;
  if (Array.isArray(dims) && dims.length >= 2) {
    mw = dims[dims.length - 1];
    mh = dims[dims.length - 2];
    if (dims.length >= 3) nMasks = dims[dims.length - 3] || 1;
  }

  let scores = null;
  if (outputs.iou_scores && outputs.iou_scores.data) {
    scores = Array.from(outputs.iou_scores.data);
  }
  let best = 0;
  if (scores && scores.length) {
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > scores[best]) best = i;
    }
  }

  const plane = mw * mh;
  const offset = best * plane;
  const mask = new Uint8Array(plane);
  const src = data;
  // logits → sigmoid se i valori non sono già 0/1
  let needsSigmoid = false;
  for (let i = 0; i < Math.min(32, plane); i++) {
    const v = Number(src[offset + i]);
    if (v < 0 || v > 1.5) {
      needsSigmoid = true;
      break;
    }
  }
  for (let i = 0; i < plane; i++) {
    let v = Number(src[offset + i]);
    if (needsSigmoid) v = 1 / (1 + Math.exp(-v));
    mask[i] = v > 0.5 ? 1 : 0;
  }
  return { data: mask, width: mw, height: mh };
}

/**
 * SAM in browser (slimsam). Caricato solo al primo uso.
 *
 * @param {{ timeoutMs?: number, loadTimeoutMs?: number }} [options]
 * @returns {(input: object) => Promise<{ polygonCoords: Array, latencyMs: number, engine: string }>}
 */
export function createSamSegmenter(options) {
  const inferTimeout =
    options && Number.isFinite(options.timeoutMs)
      ? options.timeoutMs
      : DEFAULT_INFER_TIMEOUT_MS;
  const loadTimeout =
    options && Number.isFinite(options.loadTimeoutMs)
      ? options.loadTimeoutMs
      : DEFAULT_LOAD_TIMEOUT_MS;

  return async function segmentFromPoint(input) {
    const started = Date.now();
    const view = resolveView(input);
    const pointPx = resolvePointPx(input, view);
    if (!view || !pointPx) throw new Error('vista_o_punto_mancanti');

    let imageData = input.image;
    if (!imageData) throw new Error('immagine_mancante');

    const run = async () => {
      const { model, processor, RawImage } = await Promise.race([
        loadSamModules(),
        timeoutReject(loadTimeout, 'timeout_caricamento_sam')
      ]);
      const raw =
        imageData && imageData.data && Number.isFinite(imageData.width)
          ? imageDataToRawImage(imageData, RawImage)
          : imageData;
      const inputPoints = [[[pointPx.x, pointPx.y]]];
      let inputs;
      try {
        inputs = await processor(raw, inputPoints);
      } catch (_) {
        inputs = await processor(raw, {
          input_points: [inputPoints],
          input_labels: [[[1]]]
        });
      }
      const outputs = await model(inputs);
      let mask;
      if (typeof processor.post_process_masks === 'function') {
        const processed = await processor.post_process_masks(
          outputs.pred_masks,
          inputs.original_sizes,
          inputs.reshaped_input_sizes
        );
        mask = bestMaskFromSam({ pred_masks: unwrapMaskTensor(processed), iou_scores: outputs.iou_scores }, view.width, view.height);
      } else {
        mask = bestMaskFromSam(outputs, view.width, view.height);
      }
      const polygonCoords = maskToPolygon(mask, view, { simplifyM: 3 });
      if (polygonCoords.length < 3) throw new Error('maschera_vuota');
      return {
        polygonCoords,
        latencyMs: Date.now() - started,
        engine: 'sam'
      };
    };

    return Promise.race([
      run(),
      timeoutReject(loadTimeout + inferTimeout, 'timeout_segmentatore')
    ]);
  };
}

/**
 * Factory: `sam` | `stub`. Default stub in node/test.
 * @param {'sam'|'stub'} [engine]
 * @param {object} [options]
 */
export function createSegmenter(engine, options) {
  if (engine === 'sam') return createSamSegmenter(options);
  return createStubSegmenter(options);
}

export { viewForPolygon };
