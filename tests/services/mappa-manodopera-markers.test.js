/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  resolveSeveritaManodoperaPerMappa,
  buildLavoroMarkerIconUrl
} from '../../core/js/dashboard-maps.js';

describe('mappa aziendale — marker manodopera', () => {
  test('standby assenza → rosso', () => {
    const r = resolveSeveritaManodoperaPerMappa({
      stato: 'in_standby',
      standbyCausa: 'assenza_personale',
      standbyOperaioId: 'op1'
    });
    expect(r.severita).toBe('rosso');
    expect(r.pulse).toBe(true);
  });

  test('standby prestito → giallo', () => {
    const r = resolveSeveritaManodoperaPerMappa({
      stato: 'in_standby',
      standbyCausa: 'prestito_manodopera'
    });
    expect(r.severita).toBe('giallo');
  });

  test('lavoro in corso senza problemi → nessuna severità', () => {
    const r = resolveSeveritaManodoperaPerMappa({
      stato: 'in_corso'
    });
    expect(r.severita).toBeNull();
  });

  test('buildLavoroMarkerIconUrl produce data SVG', () => {
    const url = buildLavoroMarkerIconUrl({
      fill: '#c62828',
      label: '!',
      ring: '#c62828',
      ringWide: true
    });
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(url)).toContain('#c62828');
    expect(decodeURIComponent(url)).toContain('!');
  });
});
