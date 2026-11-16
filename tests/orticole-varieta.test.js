/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  VARIETA_PREDEFINITE_PER_COLTURA,
  getVarietaPerColtura,
  addVarietaPersonalizzata,
  storageKeyForColtura
} from '../modules/orticole/services/varieta-orticole-service.js';

function memoryStore(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    _data: data
  };
}

describe('Varietà Orticole', () => {
  it('predefinite per Pomodoro, Patate, Cipolle', () => {
    expect(VARIETA_PREDEFINITE_PER_COLTURA.Pomodoro.length).toBeGreaterThan(3);
    expect(VARIETA_PREDEFINITE_PER_COLTURA.Patate.length).toBeGreaterThan(3);
    expect(VARIETA_PREDEFINITE_PER_COLTURA.Cipolle.length).toBeGreaterThan(3);
    expect(VARIETA_PREDEFINITE_PER_COLTURA.Pomodoro).toContain('San Marzano');
  });

  it('merge con personalizzate e chiave localStorage', () => {
    expect(storageKeyForColtura('Pomodoro')).toBe('orticole_varieta_pomodoro');
    const store = memoryStore();
    expect(addVarietaPersonalizzata('Pomodoro', 'Mia Cultivar', store)).toBe(true);
    const merged = getVarietaPerColtura('Pomodoro', store);
    expect(merged).toContain('Mia Cultivar');
    expect(merged).toContain('San Marzano');
  });
});
