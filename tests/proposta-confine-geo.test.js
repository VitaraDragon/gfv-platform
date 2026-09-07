/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import { rectanglePolygonMeters } from '../core/js/zona-lavorata-slice.js';
import {
  polygonAreaHa,
  polygonAreaM2,
  polygonIoU,
  polygonsOverlap,
  findOverlappingTerreni,
  scoreProposal,
  scostamentoEttari,
  countRitoccoVertices,
  maskToPolygon,
  maskContourPixels,
  latLngToImagePixel,
  imagePixelToLatLng,
  viewForPolygon,
  simplifyRingMeters,
  normalizeRing,
  CAMPO_GIUSTO_IOU,
  proposalOutsideFraction
} from '../core/dev/obsoleto/proposta-confine/proposta-confine-geo.js';

const ORIGIN = { lat: 44.5, lng: 11.3 };

describe('proposta-confine-geo', () => {
  test('100×50 m → 0.5 ha', () => {
    const poly = rectanglePolygonMeters(ORIGIN, 100, 50);
    expect(polygonAreaM2(poly)).toBeGreaterThan(4980);
    expect(polygonAreaM2(poly)).toBeLessThan(5020);
    expect(polygonAreaHa(poly)).toBeCloseTo(0.5, 2);
  });

  test('IoU identico ≈ 1', () => {
    const poly = rectanglePolygonMeters(ORIGIN, 80, 40);
    expect(polygonIoU(poly, poly)).toBeGreaterThan(0.95);
  });

  test('IoU metà sovrapposta ≈ 0.33', () => {
    const a = rectanglePolygonMeters(ORIGIN, 100, 50);
    const shifted = {
      lat: ORIGIN.lat,
      lng: ORIGIN.lng + 50 / (111320 * Math.cos((ORIGIN.lat * Math.PI) / 180))
    };
    const b = rectanglePolygonMeters(shifted, 100, 50);
    const iou = polygonIoU(a, b);
    expect(iou).toBeGreaterThan(0.25);
    expect(iou).toBeLessThan(0.45);
  });

  test('poligoni disgiunti: no overlap, IoU 0', () => {
    const a = rectanglePolygonMeters(ORIGIN, 40, 40);
    const far = { lat: ORIGIN.lat + 0.01, lng: ORIGIN.lng + 0.01 };
    const b = rectanglePolygonMeters(far, 40, 40);
    expect(polygonsOverlap(a, b)).toBe(false);
    expect(polygonIoU(a, b)).toBe(0);
  });

  test('findOverlappingTerreni esclude id e ignora senza poligono', () => {
    const a = rectanglePolygonMeters(ORIGIN, 80, 40);
    const neighbor = rectanglePolygonMeters(ORIGIN, 80, 40);
    const hits = findOverlappingTerreni(a, [
      { id: 'self', nome: 'A', polygonCoords: a },
      { id: 'n1', nome: 'Vicino', polygonCoords: neighbor },
      { id: 'empty', nome: 'Vuoto', polygonCoords: [] }
    ], { excludeId: 'self' });
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe('n1');
    expect(hits[0].intersectionM2).toBeGreaterThan(1);
  });

  test('score: proposta uguale al riferimento → campo giusto + ritocco minimo', () => {
    const ref = rectanglePolygonMeters(ORIGIN, 100, 50);
    const s = scoreProposal(ref, ref);
    expect(s.ok).toBe(true);
    expect(s.campoGiusto).toBe(true);
    expect(s.ritoccoMinimo).toBe(true);
    expect(s.ritoccoCount).toBe(0);
    expect(s.iou).toBeGreaterThan(CAMPO_GIUSTO_IOU);
    expect(s.scostamentoEttari).toBeLessThan(0.05);
    expect(s.fusedSuspect).toBe(false);
  });

  test('score: bozza che invade un pezzo extra → non campo giusto', () => {
    const ref = rectanglePolygonMeters(ORIGIN, 100, 50);
    const invaded = rectanglePolygonMeters(ORIGIN, 150, 50);
    const s = scoreProposal(invaded, ref);
    expect(s.ok).toBe(true);
    expect(s.invasion).toBe(true);
    expect(s.outsideFraction).toBeGreaterThan(0.2);
    expect(s.campoGiusto).toBe(false);
    expect(proposalOutsideFraction(ref, ref)).toBeLessThan(0.03);
  });

  test('score: proposta fusione (area >> riferimento) → non campo giusto', () => {
    const ref = rectanglePolygonMeters(ORIGIN, 50, 50);
    const fused = rectanglePolygonMeters(ORIGIN, 160, 50);
    const s = scoreProposal(fused, ref);
    expect(s.ok).toBe(true);
    expect(s.fusedSuspect).toBe(true);
    expect(s.campoGiusto).toBe(false);
  });

  test('score: proposta lontana → non campo giusto', () => {
    const ref = rectanglePolygonMeters(ORIGIN, 80, 40);
    const far = rectanglePolygonMeters({ lat: ORIGIN.lat + 0.02, lng: ORIGIN.lng }, 80, 40);
    const s = scoreProposal(far, ref);
    expect(s.campoGiusto).toBe(false);
    expect(s.iou).toBe(0);
  });

  test('scostamentoEttari e ritocco su rettangolo spostato', () => {
    const ref = rectanglePolygonMeters(ORIGIN, 100, 50);
    const shifted = {
      lat: ORIGIN.lat + 8 / 111320,
      lng: ORIGIN.lng
    };
    const proposta = rectanglePolygonMeters(shifted, 100, 50);
    expect(scostamentoEttari(proposta, ref)).toBeLessThan(0.01);
    expect(countRitoccoVertices(proposta, ref)).toBeGreaterThan(0);
    expect(countRitoccoVertices(ref, ref)).toBe(0);
  });

  test('anello chiuso (primo=ultimo) si normalizza', () => {
    const poly = rectanglePolygonMeters(ORIGIN, 60, 30);
    poly.push({ ...poly[0] });
    expect(normalizeRing(poly).length).toBe(4);
    expect(polygonAreaHa(poly)).toBeCloseTo(0.18, 2);
  });

  test('Web Mercator: pixel → lat/lng → pixel (roundtrip)', () => {
    const center = { lat: 44.5, lng: 11.3 };
    const zoom = 18;
    const w = 640;
    const h = 480;
    const p = { lat: 44.5012, lng: 11.302 };
    const pix = latLngToImagePixel(p.lat, p.lng, center, zoom, w, h);
    const back = imagePixelToLatLng(pix.x, pix.y, center, zoom, w, h);
    expect(back.lat).toBeCloseTo(p.lat, 6);
    expect(back.lng).toBeCloseTo(p.lng, 6);
  });

  test('viewForPolygon restituisce centro e zoom', () => {
    const poly = rectanglePolygonMeters(ORIGIN, 120, 80);
    const view = viewForPolygon(poly, 640, 480);
    expect(view).toBeTruthy();
    expect(view.center.lat).toBeGreaterThan(44);
    expect(view.zoom).toBeGreaterThanOrEqual(12);
    expect(view.zoom).toBeLessThanOrEqual(20);
  });

  test('mask rettangolare → poligono con ≥ 3 vertici', () => {
    const width = 40;
    const height = 30;
    const data = new Uint8Array(width * height);
    for (let y = 8; y < 22; y++) {
      for (let x = 10; x < 30; x++) {
        data[y * width + x] = 1;
      }
    }
    const contour = maskContourPixels({ data, width, height });
    expect(contour.length).toBeGreaterThanOrEqual(3);

    const center = { lat: 44.5, lng: 11.3 };
    const view = { center, zoom: 18, width: 40, height: 30 };
    const poly = maskToPolygon({ data, width, height }, view, { simplifyM: 0.5 });
    expect(poly.length).toBeGreaterThanOrEqual(3);
    expect(polygonAreaM2(poly)).toBeGreaterThan(10);
  });

  test('simplifyRingMeters riduce i vertici collineari', () => {
    const a = rectanglePolygonMeters(ORIGIN, 80, 40);
    const extra = {
      lat: (a[0].lat + a[1].lat) / 2,
      lng: (a[0].lng + a[1].lng) / 2
    };
    const noisy = [a[0], extra, a[1], a[2], a[3]];
    const simple = simplifyRingMeters(noisy, 0.4);
    expect(simple.length).toBeLessThanOrEqual(4);
    expect(simple.length).toBeGreaterThanOrEqual(3);
  });
});
