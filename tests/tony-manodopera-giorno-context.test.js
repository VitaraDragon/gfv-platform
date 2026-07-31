/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  buildManodoperaGiornoSnapshot,
  formatManodoperaGiornoQuickReply,
  isManodoperaGiornoQuestion,
  lavoroCopreGiornoKey
} from '../functions/tony-manodopera-giorno-context.js';

const GIORNO = '2026-07-27';

describe('tony-manodopera-giorno-context', () => {
  test('lavoroCopreGiornoKey con durata', () => {
    const lav = {
      stato: 'assegnato',
      dataInizio: new Date('2026-07-26T10:00:00'),
      durataPrevista: 3
    };
    expect(lavoroCopreGiornoKey('2026-07-26', lav)).toBe(true);
    expect(lavoroCopreGiornoKey(GIORNO, lav)).toBe(true);
    expect(lavoroCopreGiornoKey('2026-07-29', lav)).toBe(false);
  });

  test('snapshot roster + shortlist materializzata', () => {
    const snap = buildManodoperaGiornoSnapshot({
      giornoKey: GIORNO,
      operai: [
        { id: 'a', nome: 'Anna' },
        { id: 'b', nome: 'Bruno' },
        { id: 's', nome: 'Sara' },
        { id: 'lib', nome: 'Libero' }
      ],
      squadre: [{ caposquadraId: 'cap1', operai: ['a', 'b'] }],
      assenze: [],
      lavori: [
        {
          id: 'L1',
          nome: 'Carro',
          stato: 'in_standby',
          standbyCausa: 'assenza_personale',
          standbyOperaioId: 'b',
          standbyGiornoKey: GIORNO,
          caposquadraId: 'cap1',
          dataInizio: new Date(`${GIORNO}T08:00:00`),
          durataPrevista: 1,
          equipaggioGiorno: {
            [GIORNO]: {
              partecipazioni: [
                { operaioId: 'a', stato: 'previsto', origine: 'squadra' },
                { operaioId: 'b', stato: 'assente', origine: 'squadra' }
              ],
              shortlistCandidati: [
                {
                  operaioId: 's',
                  nome: 'Sara',
                  disponibilita: 'libero',
                  motivo: 'Libero oggi'
                }
              ]
            }
          }
        }
      ]
    });

    expect(snap.kpi.lavoriGiorno).toBe(1);
    expect(snap.kpi.lavoriInStandbyAssenza).toBe(1);
    expect(snap.kpi.shortlistMaterializzate).toBe(1);
    expect(snap.lavoriInStandbyAssenza[0].shortlistCandidati[0].operaioId).toBe('s');
    expect(snap.perLavoro[0].rosterMaterializzato).toBe(true);
    expect(snap.perLavoro[0].attiviIds).toContain('a');
    expect(snap.summary).toMatch(/Manodopera/);
  });

  test('quick reply liberi e shortlist', () => {
    const snap = buildManodoperaGiornoSnapshot({
      giornoKey: GIORNO,
      operai: [
        { id: 'a', nome: 'Anna' },
        { id: 'lib', nome: 'Luca' }
      ],
      squadre: [{ caposquadraId: 'c', operai: ['a'] }],
      assenze: [],
      lavori: [
        {
          id: 'L1',
          nome: 'Potatura',
          stato: 'in_corso',
          caposquadraId: 'c',
          dataInizio: new Date(`${GIORNO}T08:00:00`),
          durataPrevista: 1,
          equipaggioGiorno: {
            [GIORNO]: {
              partecipazioni: [{ operaioId: 'a', stato: 'previsto', origine: 'squadra' }]
            }
          }
        }
      ]
    });
    const textLiberi = formatManodoperaGiornoQuickReply(snap, 'chi è libero oggi?');
    expect(textLiberi).toMatch(/Luca/);
    expect(isManodoperaGiornoQuestion('chi è libero oggi')).toBe(true);
    expect(isManodoperaGiornoQuestion('quanto costa la tariffa')).toBe(false);
  });

  test('shortlist non salvata → invita Gestione lavori', () => {
    const snap = buildManodoperaGiornoSnapshot({
      giornoKey: GIORNO,
      operai: [{ id: 'b', nome: 'Bruno' }],
      squadre: [],
      assenze: [],
      lavori: [
        {
          id: 'L2',
          nome: 'Standby',
          stato: 'in_standby',
          standbyCausa: 'assenza_personale',
          standbyOperaioId: 'b',
          operaioId: 'b',
          dataInizio: new Date(`${GIORNO}T08:00:00`),
          durataPrevista: 1
        }
      ]
    });
    const text = formatManodoperaGiornoQuickReply(snap, 'mostra shortlist sostituti');
    expect(text).toMatch(/Gestione lavori/i);
  });
});
