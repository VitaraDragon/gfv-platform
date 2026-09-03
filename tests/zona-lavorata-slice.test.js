/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  slicePolygonBetweenPoints,
  hasUsableTerrenoPolygon,
  rectanglePolygonMeters,
  haversineMeters,
  pointInPolygonLatLng
} from '../core/js/zona-lavorata-slice.js';

const ORIGIN = { lat: 44.5, lng: 11.3 };

function midOnRect(poly, tAlongWidth, tAlongHeight) {
  const sw = poly[0];
  const se = poly[1];
  const nw = poly[3];
  return {
    lat: sw.lat + (nw.lat - sw.lat) * tAlongHeight + (se.lat - sw.lat) * 0,
    lng: sw.lng + (se.lng - sw.lng) * tAlongWidth + (nw.lng - sw.lng) * tAlongHeight
  };
}

describe('zona-lavorata-slice', () => {
  test('hasUsableTerrenoPolygon richiede almeno 3 vertici', () => {
    expect(hasUsableTerrenoPolygon(null)).toBe(false);
    expect(hasUsableTerrenoPolygon([{ lat: 1, lng: 2 }])).toBe(false);
    expect(hasUsableTerrenoPolygon(rectanglePolygonMeters(ORIGIN, 100, 50))).toBe(true);
  });

  test('taglio metà campo: 50 m su 100×50 → ~0.25 ha', () => {
    const poly = rectanglePolygonMeters(ORIGIN, 100, 50);
    const start = midOnRect(poly, 0.1, 0.5);
    const end = midOnRect(poly, 0.6, 0.5);
    const r = slicePolygonBetweenPoints(poly, start, end);
    expect(r.ok).toBe(true);
    expect(r.coords.length).toBeGreaterThanOrEqual(3);
    expect(r.areaM2).toBeGreaterThan(2400);
    expect(r.areaM2).toBeLessThan(2600);
    expect(r.areaHa).toBeCloseTo(r.areaM2 / 10000, 6);
    expect(r.lengthMeters).toBeGreaterThan(45);
    expect(r.lengthMeters).toBeLessThan(55);
  });

  test('inizio e fine invertiti: stessa superficie', () => {
    const poly = rectanglePolygonMeters(ORIGIN, 100, 50);
    const start = midOnRect(poly, 0.1, 0.5);
    const end = midOnRect(poly, 0.6, 0.5);
    const a = slicePolygonBetweenPoints(poly, start, end);
    const b = slicePolygonBetweenPoints(poly, end, start);
    expect(a.ok && b.ok).toBe(true);
    expect(Math.abs(a.areaM2 - b.areaM2)).toBeLessThan(20);
  });

  test('da un bordo all’altro: quasi tutto il campo (~0.5 ha)', () => {
    const poly = rectanglePolygonMeters(ORIGIN, 100, 50);
    const start = midOnRect(poly, 0, 0.5);
    const end = midOnRect(poly, 1, 0.5);
    const r = slicePolygonBetweenPoints(poly, start, end);
    expect(r.ok).toBe(true);
    expect(r.areaM2).toBeGreaterThan(4800);
    expect(r.areaM2).toBeLessThan(5200);
  });

  test('punti troppo vicini → errore', () => {
    const poly = rectanglePolygonMeters(ORIGIN, 100, 50);
    const start = midOnRect(poly, 0.4, 0.5);
    const end = {
      lat: start.lat + 0.000005,
      lng: start.lng + 0.000005
    };
    const r = slicePolygonBetweenPoints(poly, start, end);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('punti_troppo_vicini');
  });

  test('senza perimetro → errore', () => {
    const r = slicePolygonBetweenPoints([], { lat: 44.5, lng: 11.3 }, { lat: 44.51, lng: 11.31 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('terreno_senza_perimetro');
  });

  test('fascia fuori dal campo → zona vuota', () => {
    const poly = rectanglePolygonMeters(ORIGIN, 80, 40);
    const start = { lat: ORIGIN.lat + 0.02, lng: ORIGIN.lng };
    const end = { lat: ORIGIN.lat + 0.021, lng: ORIGIN.lng };
    const r = slicePolygonBetweenPoints(poly, start, end);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('zona_vuota');
  });

  test('anello chiuso in input (primo=ultimo) non rompe il taglio', () => {
    const poly = rectanglePolygonMeters(ORIGIN, 80, 40);
    poly.push({ ...poly[0] });
    const start = midOnRect(poly, 0.2, 0.5);
    const end = midOnRect(poly, 0.8, 0.5);
    const r = slicePolygonBetweenPoints(poly, start, end);
    expect(r.ok).toBe(true);
    expect(r.areaM2).toBeGreaterThan(1800);
    expect(r.areaM2).toBeLessThan(2100);
  });

  test('pointInPolygon e distanza rettangolo', () => {
    const poly = rectanglePolygonMeters(ORIGIN, 100, 50);
    const inside = midOnRect(poly, 0.5, 0.5);
    expect(pointInPolygonLatLng(inside, poly)).toBe(true);
    const far = { lat: ORIGIN.lat + 1, lng: ORIGIN.lng + 1 };
    expect(pointInPolygonLatLng(far, poly)).toBe(false);
    expect(haversineMeters(poly[0], poly[0])).toBeCloseTo(0, 5);
  });
});
