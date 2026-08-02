/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  resolveLavoroManodoperaSeverita,
  severitaSortRank,
  renderSemaforoHtml,
  SEVERITA_ROSSO,
  SEVERITA_GIALLO
} from '../../core/services/manodopera-problema-severita-logic.js';
import {
  LAVORO_STAND_BY_CAUSA_ASSENZA,
  LAVORO_STAND_BY_CAUSA_PRESTITO
} from '../../core/config/manodopera-assenze-config.js';

describe('manodopera-problema-severita', () => {
  test('standby assenza senza sostituto → rosso + pulse', () => {
    const r = resolveLavoroManodoperaSeverita({
      stato: 'in_standby',
      standbyCausa: LAVORO_STAND_BY_CAUSA_ASSENZA,
      sostitutiIds: [],
      equipaggioIncompleto: false
    });
    expect(r.severita).toBe(SEVERITA_ROSSO);
    expect(r.pulse).toBe(true);
  });

  test('equipaggio incompleto senza sostituto → rosso', () => {
    const r = resolveLavoroManodoperaSeverita({
      stato: 'in_corso',
      sostitutiIds: [],
      equipaggioIncompleto: true
    });
    expect(r.severita).toBe(SEVERITA_ROSSO);
    expect(r.pulse).toBe(true);
  });

  test('equipaggio incompleto con sostituto → giallo', () => {
    const r = resolveLavoroManodoperaSeverita({
      stato: 'in_corso',
      sostitutiIds: ['x'],
      equipaggioIncompleto: true
    });
    expect(r.severita).toBe(SEVERITA_GIALLO);
    expect(r.pulse).toBe(false);
  });

  test('buco prestito → giallo', () => {
    const r = resolveLavoroManodoperaSeverita({
      stato: 'in_standby',
      standbyCausa: LAVORO_STAND_BY_CAUSA_PRESTITO,
      sostitutiIds: [],
      equipaggioIncompleto: false
    });
    expect(r.severita).toBe(SEVERITA_GIALLO);
  });

  test('lavoro normale → nessuna severità', () => {
    const r = resolveLavoroManodoperaSeverita({
      stato: 'in_corso',
      sostitutiIds: [],
      equipaggioIncompleto: false
    });
    expect(r.severita).toBeNull();
  });

  test('sort rank: rosso prima di giallo', () => {
    expect(severitaSortRank(SEVERITA_ROSSO)).toBeLessThan(severitaSortRank(SEVERITA_GIALLO));
    expect(severitaSortRank(SEVERITA_GIALLO)).toBeLessThan(severitaSortRank(null));
  });

  test('renderSemaforoHtml pulse solo rosso', () => {
    const red = renderSemaforoHtml({
      severita: SEVERITA_ROSSO,
      motivo: 'Test',
      pulse: true
    });
    expect(red).toContain('gfv-semaforo--red');
    expect(red).toContain('gfv-semaforo--pulse');
    const yel = renderSemaforoHtml({
      severita: SEVERITA_GIALLO,
      motivo: 'Attenzione',
      pulse: false
    });
    expect(yel).toContain('gfv-semaforo--yellow');
    expect(yel).not.toContain('pulse');
  });
});
