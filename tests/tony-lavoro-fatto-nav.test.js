/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  isLavoroFattoInCampo,
  resolveLavoroFattoNav,
  mapDiarioFieldsToLavoro,
  alignLavoroFattoSpeech
} from '../core/js/tony/tony-lavoro-fatto-nav.js';

describe('lavoro fatto in campo — destinazione', () => {
  test('dialetto e frasi equivalenti sono lo stesso intento', () => {
    expect(isLavoroFattoInCampo("o' fatto la vigna")).toBe(true);
    expect(isLavoroFattoInCampo('o’ fatto la vigna')).toBe(true);
    expect(isLavoroFattoInCampo('ho fatto la vigna')).toBe(true);
    expect(isLavoroFattoInCampo('fatto il lavoro in vigna')).toBe(true);
    expect(isLavoroFattoInCampo('ho finito in vigna')).toBe(true);
    expect(isLavoroFattoInCampo('ho finito il lavoro in vigna')).toBe(true);
  });

  test('pieno, carico e nuovo lavoro non aprono il diario', () => {
    expect(isLavoroFattoInCampo('ho fatto il pieno in campo alla mietitrebbia, 150 litri, campo del grano')).toBe(false);
    expect(isLavoroFattoInCampo('ho fatto il carico cisterna')).toBe(false);
    expect(isLavoroFattoInCampo('crea un lavoro di erpicatura nel sangiovese')).toBe(false);
    expect(isLavoroFattoInCampo('portami al diario')).toBe(false);
  });

  test('senza Manodopera la frase porta al Diario', () => {
    const nav = resolveLavoroFattoNav("o' fatto la vigna", { hasManodopera: false });
    expect(nav.target).toBe('attivita');
    expect(nav.pendingModal).toBe('attivita-modal');
    expect(nav.text.toLowerCase()).toContain('diario');
    expect(nav.text.toLowerCase()).not.toContain('gestione lavori');
  });

  test('con Manodopera la frase porta a Gestione lavori e non promette il Diario', () => {
    const nav = resolveLavoroFattoNav('ho fatto la vigna', { hasManodopera: true });
    expect(nav.target).toBe('gestione lavori');
    expect(nav.pendingModal).toBe('lavoro-modal');
    expect(nav.text.toLowerCase()).toContain('gestione lavori');
    expect(nav.text.toLowerCase()).not.toContain('diario');
  });

  test('non inventa campi: copia solo ciò che il payload ha già', () => {
    expect(mapDiarioFieldsToLavoro(null)).toBe(null);
    expect(mapDiarioFieldsToLavoro({})).toBe(null);
    expect(mapDiarioFieldsToLavoro({
      'attivita-terreno': 'Sangiovese',
      'attivita-ore': '6'
    })).toEqual({ 'lavoro-terreno': 'Sangiovese' });
  });

  test('la promessa «ti porto al diario» con Manodopera diventa Gestione lavori', () => {
    const speech = alignLavoroFattoSpeech(
      'Ti porto al diario.',
      "o' fatto la vigna",
      { type: 'OPEN_MODAL', id: 'attivita-modal' },
      true,
      false
    );
    expect(speech.toLowerCase()).toContain('gestione lavori');
    expect(speech.toLowerCase()).not.toContain('diario');
  });

  test('«portami al diario» resta il Diario', () => {
    const speech = alignLavoroFattoSpeech(
      'Ti porto al diario attività.',
      'portami al diario',
      { type: 'APRI_PAGINA', target: 'attivita' },
      true,
      false
    );
    expect(speech.toLowerCase()).toContain('diario');
  });
});
