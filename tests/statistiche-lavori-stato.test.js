/**
 * @vitest-environment node
 */

import { describe, expect, test } from 'vitest';
import { calcolaLavoriPerStato } from '../core/js/statistiche-lavori-stato.js';

const STATI_VALIDI = [
  'da_pianificare',
  'assegnato',
  'in_corso',
  'in_standby',
  'sospeso',
  'completato',
  'completato_da_approvare',
  'annullato'
];

const STATI_LEGACY = ['attivo', 'pianificato'];

describe('calcolaLavoriPerStato', () => {
  test('un lavoro per ogni stato (validi + legacy): somma schede = totale', () => {
    const lavori = [...STATI_VALIDI, ...STATI_LEGACY].map((stato) => ({ stato }));
    const stats = calcolaLavoriPerStato(lavori);

    expect(stats.totali).toBe(STATI_VALIDI.length + STATI_LEGACY.length);
    expect(stats.attivi).toBe(3); // assegnato, in_corso, attivo
    expect(stats.pianificati).toBe(2); // da_pianificare, pianificato
    expect(stats.completati).toBe(1);
    expect(stats.sospesi).toBe(2); // sospeso, in_standby
    expect(stats.altri).toBe(2); // completato_da_approvare, annullato
    expect(
      stats.attivi + stats.pianificati + stats.completati + stats.sospesi + stats.altri
    ).toBe(stats.totali);
  });

  test('caso 74: 18 assegnati / 13 in corso / 3 sospesi / 40 completati', () => {
    const lavori = [
      ...Array.from({ length: 18 }, () => ({ stato: 'assegnato' })),
      ...Array.from({ length: 13 }, () => ({ stato: 'in_corso' })),
      ...Array.from({ length: 3 }, () => ({ stato: 'sospeso' })),
      ...Array.from({ length: 40 }, () => ({ stato: 'completato' }))
    ];
    const stats = calcolaLavoriPerStato(lavori);

    expect(stats.totali).toBe(74);
    expect(stats.attivi).toBe(31);
    expect(stats.pianificati).toBe(0);
    expect(stats.completati).toBe(40);
    expect(stats.sospesi).toBe(3);
    expect(stats.altri).toBe(0);
    expect(
      stats.attivi + stats.pianificati + stats.completati + stats.sospesi + stats.altri
    ).toBe(74);
  });

  test('stato assente conta come pianificato (legacy default)', () => {
    const stats = calcolaLavoriPerStato([{}, { stato: '' }, { stato: null }]);
    expect(stats.totali).toBe(3);
    expect(stats.pianificati).toBe(3);
  });

  test('lista vuota o non array', () => {
    expect(calcolaLavoriPerStato([])).toEqual({
      totali: 0,
      attivi: 0,
      pianificati: 0,
      completati: 0,
      sospesi: 0,
      altri: 0
    });
    expect(calcolaLavoriPerStato(null).totali).toBe(0);
    expect(calcolaLavoriPerStato(undefined).totali).toBe(0);
  });
});
