/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  buildImpegniGiornoSnapshot,
  lavoroCopreGiornoKey,
  IMPEGNO_STATO_LIBERO,
  IMPEGNO_STATO_IMPEGNATO,
  IMPEGNO_STATO_ASSENTE,
  IMPEGNO_STATO_PRESTATO,
  IMPEGNO_STATO_SOSTITUTO
} from '../../core/services/manodopera-impegni-giorno-logic.js';

const GIORNO = '2026-07-22';

function op(id, nome = id) {
  return { id, nome, cognome: '' };
}

describe('manodopera-impegni-giorno-logic', () => {
  test('lavoroCopreGiornoKey: data inizio + durata', () => {
    const lav = {
      stato: 'assegnato',
      dataInizio: new Date('2026-07-21T12:00:00'),
      durataPrevista: 3
    };
    expect(lavoroCopreGiornoKey('2026-07-21', lav)).toBe(true);
    expect(lavoroCopreGiornoKey(GIORNO, lav)).toBe(true);
    expect(lavoroCopreGiornoKey('2026-07-23', lav)).toBe(true);
    expect(lavoroCopreGiornoKey('2026-07-24', lav)).toBe(false);
  });

  test('impegno via squadra + assente confermato non è libero', () => {
    const snap = buildImpegniGiornoSnapshot({
      giornoKey: GIORNO,
      operaiList: [op('op1', 'Mario'), op('op2', 'Luigi')],
      squadreList: [{ id: 'sq1', caposquadraId: 'cap1', operai: ['op1', 'op2'] }],
      lavoriList: [
        {
          id: 'L1',
          nome: 'Potatura A',
          stato: 'in_corso',
          caposquadraId: 'cap1',
          dataInizio: new Date(`${GIORNO}T08:00:00`),
          durataPrevista: 1
        }
      ],
      assenzeConfermate: [{ operaioId: 'op1', tipo: 'malattia', tipoLabel: 'Malattia' }]
    });

    const r1 = snap.perOperaio.find((r) => r.operaioId === 'op1');
    const r2 = snap.perOperaio.find((r) => r.operaioId === 'op2');
    expect(r1.statoDisponibilita).toBe(IMPEGNO_STATO_ASSENTE);
    expect(r1.statoDisponibilita).not.toBe(IMPEGNO_STATO_LIBERO);
    expect(r2.statoDisponibilita).toBe(IMPEGNO_STATO_IMPEGNATO);
    expect(r2.lavoroId).toBe('L1');
    expect(snap.kpi.assenti).toBe(1);
    expect(snap.kpi.impegnati).toBe(1);
  });

  test('sostituto e prestito da equipaggioGiorno', () => {
    const snap = buildImpegniGiornoSnapshot({
      giornoKey: GIORNO,
      operaiList: [op('assente'), op('sost'), op('prest'), op('libero')],
      squadreList: [
        { id: 'sqA', caposquadraId: 'capA', operai: ['assente', 'prest'] },
        { id: 'sqB', caposquadraId: 'capB', operai: [] }
      ],
      lavoriList: [
        {
          id: 'L-orig',
          nome: 'Origine',
          stato: 'in_corso',
          caposquadraId: 'capA',
          dataInizio: new Date(`${GIORNO}T08:00:00`),
          durataPrevista: 1,
          equipaggioGiorno: {
            [GIORNO]: {
              assenti: ['assente'],
              sostituzioni: [],
              prestitiUscita: [{ operaioId: 'prest', versoLavoroId: 'L-dest' }]
            }
          }
        },
        {
          id: 'L-dest',
          nome: 'Destinazione',
          stato: 'in_corso',
          caposquadraId: 'capB',
          dataInizio: new Date(`${GIORNO}T08:00:00`),
          durataPrevista: 1,
          equipaggioGiorno: {
            [GIORNO]: {
              assenti: [],
              sostituzioni: [
                { assenteOperaioId: 'assente', sostitutoOperaioId: 'sost' }
              ],
              prestitiUscita: []
            }
          }
        }
      ],
      assenzeConfermate: [{ operaioId: 'assente', tipo: 'ferie' }]
    });

    const byId = Object.fromEntries(snap.perOperaio.map((r) => [r.operaioId, r]));
    expect(byId.assente.statoDisponibilita).toBe(IMPEGNO_STATO_ASSENTE);
    expect(byId.sost.statoDisponibilita).toBe(IMPEGNO_STATO_SOSTITUTO);
    expect(byId.sost.lavoroId).toBe('L-dest');
    expect(byId.prest.statoDisponibilita).toBe(IMPEGNO_STATO_PRESTATO);
    expect(byId.libero.statoDisponibilita).toBe(IMPEGNO_STATO_LIBERO);

    const dest = snap.perLavoro.find((l) => l.lavoroId === 'L-dest');
    expect(dest.sostitutiIds).toContain('sost');
    expect(dest.assentiIds).toEqual([]);
  });

  test('lavoro di squadra elenca previsti e assenti equipaggio giorno', () => {
    const snap = buildImpegniGiornoSnapshot({
      giornoKey: GIORNO,
      operaiList: [op('a', 'Anna'), op('b', 'Bruno')],
      squadreList: [{ id: 'sq1', caposquadraId: 'cap1', operai: ['a', 'b'] }],
      lavoriList: [
        {
          id: 'L1',
          nome: 'Carro',
          stato: 'assegnato',
          caposquadraId: 'cap1',
          dataInizio: new Date(`${GIORNO}T08:00:00`),
          durataPrevista: 1,
          equipaggioGiorno: {
            [GIORNO]: {
              assenti: ['b'],
              sostituzioni: [{ assenteOperaioId: 'b', sostitutoOperaioId: 'a' }],
              prestitiUscita: []
            }
          }
        }
      ],
      assenzeConfermate: [],
      equipaggioMinimoByLavoroId: { L1: 2 }
    });

    const lav = snap.perLavoro[0];
    expect(lav.previstiIds).toEqual(expect.arrayContaining(['a', 'b']));
    expect(lav.assentiIds).toContain('b');
    expect(lav.sostitutiIds).toContain('a');
    expect(lav.equipaggioMinimo).toBe(2);
  });
});
