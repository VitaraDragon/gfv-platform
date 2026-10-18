/**
 * @vitest-environment node
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  STATI_ESCLUSI_SUPERFICIE,
  calcolaSuperficieStats
} from '../core/services/statistiche-superficie.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/statistiche-superficie-uso-reale.json'), 'utf8')
);

function expectUsoReale(stats) {
  expect(stats.sommaPassaggi.toFixed(2)).toBe('56.89');
  expect(stats.superficieTotale.toFixed(2)).toBe('56.11');
  expect(stats.superficieCoperta.toFixed(2)).toBe('32.58');
  expect(stats.terreniCoperti).toBe(16);
  expect(stats.percentualeCoperta.toFixed(1)).toBe('58.1');
}

describe('calcolaSuperficieStats', () => {
  test('caso reale anonimizzato: somma passaggi e terreni coperti', () => {
    expect(FIXTURE.terreni).toHaveLength(27);
    expect(FIXTURE.lavori).toHaveLength(57);
    expect(FIXTURE.lavori.some((lavoro) => lavoro.stato === 'annullato')).toBe(false);
    expectUsoReale(calcolaSuperficieStats(FIXTURE.lavori, FIXTURE.terreni));
  });

  test('annullati esclusi: gli ettari annullati non cambiano i numeri del caso reale', () => {
    const lavori = FIXTURE.lavori.concat([
      { stato: 'annullato', terrenoId: 't01', superficieTotaleLavorata: 9 },
      { stato: 'annullato', terrenoId: 't03', superficieTotaleLavorata: 1 }
    ]);
    expectUsoReale(calcolaSuperficieStats(lavori, FIXTURE.terreni));
  });

  test('soli annullati: 0 passaggi, 0 coperti, 0 terreni', () => {
    const stats = calcolaSuperficieStats(
      [
        { stato: 'annullato', terrenoId: 't01', superficieTotaleLavorata: 9 },
        { stato: 'annullato', terrenoId: 't02', superficieTotaleLavorata: 1 }
      ],
      []
    );
    expect(stats.sommaPassaggi).toBe(0);
    expect(stats.superficieTotale).toBe(0);
    expect(stats.superficieCoperta).toBe(0);
    expect(stats.terreniCoperti).toBe(0);
    expect(stats.percentualeCoperta).toBe(0);
  });

  test('terreno lavorato due volte: la somma conta i passaggi, i coperti una volta sola', () => {
    const stats = calcolaSuperficieStats(
      [
        { stato: 'completato', terrenoId: 'a', superficieTotaleLavorata: 2 },
        { stato: 'completato', terrenoId: 'a', superficieTotaleLavorata: 2 }
      ],
      [{ id: 'a', superficie: 2 }]
    );
    expect(stats.sommaPassaggi).toBe(4);
    expect(stats.superficieCoperta).toBe(2);
    expect(stats.terreniCoperti).toBe(1);
  });

  test('terreno con lavoro ma 0 ha non è coperto', () => {
    const stats = calcolaSuperficieStats(
      [
        { stato: 'completato', terrenoId: 'a', superficieTotaleLavorata: 2 },
        { stato: 'assegnato', terrenoId: 'c', superficieTotaleLavorata: 0 },
        { stato: 'assegnato', terrenoId: 'c' }
      ],
      [
        { id: 'a', superficie: 2 },
        { id: 'c', superficie: 4 }
      ]
    );
    expect(stats.sommaPassaggi).toBe(2);
    expect(stats.superficieCoperta).toBe(2);
    expect(stats.terreniCoperti).toBe(1);
    expect(stats.percentualeCoperta.toFixed(1)).toBe('33.3');
  });

  test('ripresa e origine sullo stesso terreno contano un solo terreno', () => {
    const stats = calcolaSuperficieStats(
      [
        { id: 'orig', stato: 'sospeso', terrenoId: 'b', superficieTotaleLavorata: 1 },
        {
          stato: 'in_corso',
          terrenoId: 'b',
          superficieTotaleLavorata: 2,
          ripresaDaLavoroId: 'orig'
        }
      ],
      [{ id: 'b', superficie: 3 }]
    );
    expect(stats.sommaPassaggi).toBe(3);
    expect(stats.superficieCoperta).toBe(3);
    expect(stats.terreniCoperti).toBe(1);
  });

  test('caso misto: passaggi, ripresa e annullato', () => {
    const stats = calcolaSuperficieStats(
      [
        { stato: 'completato', terrenoId: 'a', superficieTotaleLavorata: 2 },
        { stato: 'completato', terrenoId: 'a', superficieTotaleLavorata: 2 },
        { id: 'orig', stato: 'sospeso', terrenoId: 'b', superficieTotaleLavorata: 1 },
        {
          stato: 'in_corso',
          terrenoId: 'b',
          superficieTotaleLavorata: 2,
          ripresaDaLavoroId: 'orig'
        },
        { stato: 'annullato', terrenoId: 'b', superficieTotaleLavorata: 9 }
      ],
      [
        { id: 'a', superficie: 2 },
        { id: 'b', superficie: 3 }
      ]
    );
    expect(stats).toMatchObject({
      sommaPassaggi: 7,
      superficieCoperta: 5,
      terreniCoperti: 2,
      percentualeCoperta: 100
    });
  });

  test('stringa, null e negativo valgono 0; totale 0 dà percentuale 0', () => {
    const sporchi = calcolaSuperficieStats(
      [
        { stato: 'completato', terrenoId: 'a', superficieTotaleLavorata: '2.5' },
        { stato: 'completato', terrenoId: 'a', superficieTotaleLavorata: null },
        { stato: 'completato', terrenoId: 'b', superficieTotaleLavorata: -3 }
      ],
      [
        { id: 'a', superficie: '4' },
        { id: 'b', superficie: null },
        { id: 'c', superficie: -1 }
      ]
    );
    expect(sporchi.sommaPassaggi).toBe(0);
    expect(sporchi.superficieTotale).toBe(0);
    expect(sporchi.superficieCoperta).toBe(0);
    expect(sporchi.terreniCoperti).toBe(0);
    expect(sporchi.percentualeCoperta).toBe(0);

    const senzaTotale = calcolaSuperficieStats(
      [{ stato: 'completato', terrenoId: 'z', superficieTotaleLavorata: 3 }],
      [{ id: 'z', superficie: 0 }]
    );
    expect(senzaTotale.superficieTotale).toBe(0);
    expect(senzaTotale.percentualeCoperta).toBe(0);
  });

  test('un terrenoId assente dai terreni non è coperto, ma i suoi ettari restano nella somma', () => {
    const stats = calcolaSuperficieStats(
      [{ stato: 'completato', terrenoId: 'mancante', superficieTotaleLavorata: 4 }],
      [{ id: 'a', superficie: 2 }]
    );
    expect(stats.sommaPassaggi).toBe(4);
    expect(stats.superficieCoperta).toBe(0);
    expect(stats.terreniCoperti).toBe(0);
    expect(stats.superficieTotale).toBe(2);
  });

  test('l’unico stato escluso è annullato', () => {
    expect(STATI_ESCLUSI_SUPERFICIE).toEqual(['annullato']);
    expect(Object.isFrozen(STATI_ESCLUSI_SUPERFICIE)).toBe(true);
  });
});
