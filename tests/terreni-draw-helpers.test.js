/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import { rectanglePolygonMeters } from '../core/js/zona-lavorata-slice.js';
import {
  nearestPointOnSegment,
  snapToNeighborRings,
  neighborRingsFromTerreni,
  resolveDrawTap,
  CLOSE_TO_START_M,
  SNAP_NEIGHBOR_M,
  DOUBLE_TAP_MS
} from '../core/js/terreni-draw-helpers.js';

const ORIGIN = { lat: 44.5, lng: 11.3 };

function shiftMeters(origin, eastM, northM) {
  const mLng = 111320 * Math.cos((origin.lat * Math.PI) / 180);
  return {
    lat: origin.lat + northM / 111320,
    lng: origin.lng + eastM / mLng
  };
}

describe('nearestPointOnSegment', () => {
  test('proietta sul mezzo del lato', () => {
    const a = ORIGIN;
    const b = shiftMeters(ORIGIN, 100, 0);
    const p = shiftMeters(ORIGIN, 50, 8);
    const q = nearestPointOnSegment(p, a, b);
    expect(q.lat).toBeCloseTo(ORIGIN.lat, 5);
    expect(q.lng).toBeCloseTo(shiftMeters(ORIGIN, 50, 0).lng, 5);
  });

  test('clamp al vertice se oltre il segmento', () => {
    const a = ORIGIN;
    const b = shiftMeters(ORIGIN, 40, 0);
    const p = shiftMeters(ORIGIN, 80, 3);
    const q = nearestPointOnSegment(p, a, b);
    expect(q.lng).toBeCloseTo(b.lng, 5);
    expect(q.lat).toBeCloseTo(b.lat, 5);
  });
});

describe('snapToNeighborRings', () => {
  const ring = rectanglePolygonMeters(ORIGIN, 100, 50);

  test('aggancia un vertice vicino', () => {
    const tap = shiftMeters(ORIGIN, -2, -2);
    const out = snapToNeighborRings(tap, [ring], SNAP_NEIGHBOR_M);
    expect(out.snapped).toBe(true);
    expect(out.kind).toBe('vertex');
    expect(out.point.lat).toBeCloseTo(ORIGIN.lat, 5);
    expect(out.point.lng).toBeCloseTo(ORIGIN.lng, 5);
  });

  test('aggancia un lato se più vicino del vertice', () => {
    const tap = shiftMeters(ORIGIN, 40, 3);
    const out = snapToNeighborRings(tap, [ring], SNAP_NEIGHBOR_M);
    expect(out.snapped).toBe(true);
    expect(out.kind).toBe('edge');
    expect(out.point.lat).toBeCloseTo(ORIGIN.lat, 5);
  });

  test('non aggancia se troppo lontano', () => {
    const tap = shiftMeters(ORIGIN, 40, 40);
    const out = snapToNeighborRings(tap, [ring], SNAP_NEIGHBOR_M);
    expect(out.snapped).toBe(false);
  });
});

describe('neighborRingsFromTerreni', () => {
  test('esclude il terreno in modifica e i poligoni corti', () => {
    const rings = neighborRingsFromTerreni(
      [
        { id: 'a', polygonCoords: rectanglePolygonMeters(ORIGIN, 80, 40) },
        { id: 'b', polygonCoords: rectanglePolygonMeters(ORIGIN, 60, 30) },
        { id: 'c', polygonCoords: [ORIGIN] }
      ],
      'a'
    );
    expect(rings).toHaveLength(1);
    expect(rings[0].length).toBeGreaterThanOrEqual(3);
  });
});

describe('resolveDrawTap', () => {
  const square = [
    ORIGIN,
    shiftMeters(ORIGIN, 80, 0),
    shiftMeters(ORIGIN, 80, 80)
  ];

  test('vicino al primo vertice (≥3) chiude', () => {
    const tap = shiftMeters(ORIGIN, 4, 3);
    const out = resolveDrawTap({ tap, vertices: square, now: 1000 });
    expect(out.action).toBe('close');
    expect(out.reason).toBe('near_start');
  });

  test('con 2 vertici non chiude sul primo', () => {
    const tap = shiftMeters(ORIGIN, 3, 2);
    const out = resolveDrawTap({
      tap,
      vertices: [ORIGIN, shiftMeters(ORIGIN, 80, 0)],
      now: 1000
    });
    expect(out.action).not.toBe('close');
  });

  test('doppio tap nello stesso punto chiude', () => {
    const tap = shiftMeters(ORIGIN, 20, 20);
    const out = resolveDrawTap({
      tap,
      vertices: square,
      now: 500,
      lastTapAt: 500 - 120,
      lastTapPoint: tap
    });
    expect(out.action).toBe('close');
    expect(out.reason).toBe('double_tap');
    expect(out.dropLastIfNear).toBe(true);
  });

  test('doppio tap troppo lento non chiude', () => {
    const tap = shiftMeters(ORIGIN, 20, 20);
    const out = resolveDrawTap({
      tap,
      vertices: square,
      now: 500,
      lastTapAt: 500 - DOUBLE_TAP_MS - 40,
      lastTapPoint: tap
    });
    expect(out.reason).not.toBe('double_tap');
  });

  test('tap sul ultimo vertice è debounce', () => {
    const last = square[2];
    const out = resolveDrawTap({
      tap: shiftMeters(last, 1, 0),
      vertices: square,
      now: 1000
    });
    expect(out.action).toBe('ignore');
    expect(out.reason).toBe('debounce');
  });

  test('tap lontano aggiunge, con snap se c’è un vicino', () => {
    const neighbor = rectanglePolygonMeters(shiftMeters(ORIGIN, 200, 0), 80, 40);
    const tap = shiftMeters(shiftMeters(ORIGIN, 200, 0), 2, 1);
    const out = resolveDrawTap({
      tap,
      vertices: square,
      now: 1000,
      neighborRings: [neighbor]
    });
    expect(out.action).toBe('add');
    expect(out.snapped).toBe(true);
  });

  test('soglia chiusura è quella esportata', () => {
    expect(CLOSE_TO_START_M).toBeGreaterThan(8);
  });
});
