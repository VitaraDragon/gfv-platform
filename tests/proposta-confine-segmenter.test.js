/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  createStubSegmenter,
  createSegmenter,
  createSamSegmenter,
  configureTransformersEnv,
  stubMaskAroundPoint,
  staticMapUrlForView
} from '../core/dev/obsoleto/proposta-confine/proposta-confine-segmenter.js';
import { hasUsableTerrenoPolygon } from '../core/js/zona-lavorata-slice.js';
import { scoreProposal, polygonAreaHa } from '../core/dev/obsoleto/proposta-confine/proposta-confine-geo.js';

const VIEW = {
  center: { lat: 44.5, lng: 11.3 },
  zoom: 18,
  width: 200,
  height: 160
};

describe('proposta-confine-segmenter stub', () => {
  test('createSegmenter default = stub, non scarica SAM', async () => {
    const seg = createSegmenter();
    const pointPx = { x: 100, y: 80 };
    const out = await seg({
      pointPx,
      bounds: VIEW,
      image: { data: new Uint8Array(1), width: 1, height: 1 }
    });
    expect(out.engine).toBe('stub');
    expect(hasUsableTerrenoPolygon(out.polygonCoords)).toBe(true);
    expect(out.latencyMs).toBeGreaterThanOrEqual(0);
    expect(polygonAreaHa(out.polygonCoords)).toBeGreaterThan(0);
  });

  test('stubMaskAroundPoint riempie un rettangolo sul tap', () => {
    const mask = stubMaskAroundPoint({ x: 50, y: 40 }, 100, 80, 10, 8);
    expect(mask.data[40 * 100 + 50]).toBe(1);
    expect(mask.data[0]).toBe(0);
  });

  test('stub senza vista: rettangolo metri intorno al tap', async () => {
    const seg = createStubSegmenter({ halfWidthM: 20, halfHeightM: 10 });
    const out = await seg({ pointLatLng: { lat: 44.5, lng: 11.3 } });
    expect(out.engine).toBe('stub');
    expect(out.polygonCoords.length).toBeGreaterThanOrEqual(3);
    expect(polygonAreaHa(out.polygonCoords)).toBeCloseTo(0.08, 2);
  });

  test('stub vs se stesso: score usabile (pipeline Fase 0)', async () => {
    const seg = createStubSegmenter();
    const out = await seg({ pointPx: { x: 100, y: 80 }, bounds: VIEW });
    const s = scoreProposal(out.polygonCoords, out.polygonCoords);
    expect(s.campoGiusto).toBe(true);
    expect(s.ritoccoMinimo).toBe(true);
  });

  test('staticMapUrlForView include satellite e centro', () => {
    const url = staticMapUrlForView({ ...VIEW, apiKey: 'test-key' });
    expect(url).toContain('maps.googleapis.com/maps/api/staticmap');
    expect(url).toContain('maptype=satellite');
    expect(url).toContain('44.5');
    expect(url).toContain('key=test-key');
  });

  test('punto mancante → errore', async () => {
    const seg = createStubSegmenter();
    await expect(seg({})).rejects.toThrow('punto_non_valido');
  });

  test('configureTransformersEnv disattiva /models/ locale', () => {
    const env = { allowLocalModels: true, allowRemoteModels: false };
    configureTransformersEnv(env);
    expect(env.allowLocalModels).toBe(false);
    expect(env.allowRemoteModels).toBe(true);
    expect(env.useBrowserCache).toBe(true);
  });

  test('SAM senza vista/punto non scarica il modello', async () => {
    const seg = createSamSegmenter({ timeoutMs: 500, loadTimeoutMs: 500 });
    await expect(seg({})).rejects.toThrow('vista_o_punto_mancanti');
  });
});
