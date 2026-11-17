/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { getCategoriaFromColtura } from '../core/js/terreni-controller.js';

describe('getCategoriaFromColtura', () => {
  it('Pomodoro e un terreno con colturaCategoria Ortive danno Ortive', () => {
    expect(getCategoriaFromColtura('Pomodoro')).toBe('Ortive');
    expect(getCategoriaFromColtura({ colturaCategoria: 'Ortive' })).toBe('Ortive');
    expect(getCategoriaFromColtura({ coltura: 'Zucchine', colturaCategoria: 'Ortive' })).toBe('Ortive');
  });

  it('Vite, Pesco e Grano restano Vigneto, Frutteto e Seminativo', () => {
    expect(getCategoriaFromColtura('Vite')).toBe('Vigneto');
    expect(getCategoriaFromColtura('Pesco')).toBe('Frutteto');
    expect(getCategoriaFromColtura('Grano')).toBe('Seminativo');
  });
});
