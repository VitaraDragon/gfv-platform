/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  ASSENZA_TIPI,
  LAVORO_STAND_BY_CAUSA_ASSENZA,
  LAVORO_STATI_STANDBY_AMMESSI,
  toGiornoKey,
  giornoInIntervalloAssenza,
  getAssenzaTipoLabel
} from '../../core/config/manodopera-assenze-config.js';

describe('manodopera-assenze-config', () => {
  test('catalogo tipi assenza non vuoto', () => {
    expect(ASSENZA_TIPI.length).toBeGreaterThan(0);
    expect(getAssenzaTipoLabel('ferie')).toBe('Ferie');
  });

  test('toGiornoKey formato YYYY-MM-DD', () => {
    expect(toGiornoKey(new Date(2026, 4, 16))).toBe('2026-05-16');
  });

  test('giornoInIntervalloAssenza su giornata singola', () => {
    expect(giornoInIntervalloAssenza('2026-05-16', '2026-05-16', '2026-05-16')).toBe(true);
    expect(giornoInIntervalloAssenza('2026-05-15', '2026-05-16', '2026-05-16')).toBe(false);
  });

  test('standby ammesso solo da stati operativi', () => {
    expect(LAVORO_STATI_STANDBY_AMMESSI).toContain('in_corso');
    expect(LAVORO_STATI_STANDBY_AMMESSI).not.toContain('sospeso');
    expect(LAVORO_STAND_BY_CAUSA_ASSENZA).toBe('assenza_personale');
  });
});
