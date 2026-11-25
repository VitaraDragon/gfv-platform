/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { toIsoDate, campiSourceForCategoria } from '../core/admin/js/entrate-utils.js';

describe('toIsoDate', () => {
  it('accetta stringa ISO e tronca il tempo', () => {
    expect(toIsoDate('2025-09-14')).toBe('2025-09-14');
    expect(toIsoDate('2025-09-14T12:30:00.000Z')).toBe('2025-09-14');
  });

  it('accetta Date locale', () => {
    expect(toIsoDate(new Date(2025, 8, 14))).toBe('2025-09-14');
  });

  it('accetta Timestamp-like con toDate()', () => {
    const ts = {
      toDate() {
        return new Date(2025, 8, 14, 8, 0, 0);
      }
    };
    expect(toIsoDate(ts)).toBe('2025-09-14');
  });

  it('accetta plain { seconds, nanoseconds }', () => {
    const localNoon = new Date(2025, 8, 14, 12, 0, 0);
    const seconds = Math.floor(localNoon.getTime() / 1000);
    expect(toIsoDate({ seconds, nanoseconds: 0 })).toBe('2025-09-14');
  });

  it('restituisce stringa vuota su input invalido', () => {
    expect(toIsoDate(null)).toBe('');
    expect(toIsoDate('')).toBe('');
    expect(toIsoDate('Timestamp(seconds=1)')).toBe('');
    expect(toIsoDate(new Date('invalid'))).toBe('');
    expect(toIsoDate({})).toBe('');
  });
});

describe('campiSourceForCategoria', () => {
  it('mappa categoria → elenco campi', () => {
    expect(campiSourceForCategoria('uva')).toBe('vigneti');
    expect(campiSourceForCategoria('frutta')).toBe('frutteti');
    expect(campiSourceForCategoria('seminativo')).toBe('terreni');
    expect(campiSourceForCategoria('ortaggi')).toBe('terreni');
    expect(campiSourceForCategoria('altro')).toBe(null);
  });
});
