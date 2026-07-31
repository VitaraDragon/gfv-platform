/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  ensureRosterSlice,
  applySostituzioneToRoster,
  applyPrestitoUscitaToRoster,
  applyAssenzaToRoster,
  isRosterMaterializzato,
  getRosterAttiviIds,
  getRosterPrevistiIds,
  getRosterAssentiIds,
  getRosterSostitutiIds,
  resolvePrevistiOperaioIdsForGiorno,
  resolveAnagraficaPrevistiIds,
  applyLegacyDeltaToPartecipazioni,
  ROSTER_STATO_PREVISTO,
  ROSTER_STATO_ASSENTE,
  ROSTER_STATO_SOSTITUITO,
  ROSTER_STATO_AGGIUNTO,
  ROSTER_STATO_PRESTATO_OUT,
  ROSTER_ORIGINE_SOSTITUZIONE,
  ROSTER_ORIGINE_PRESTITO_IN,
  ROSTER_ORIGINE_MANUALE,
  addPartecipazioneManuale,
  removePartecipazioneManuale,
  canRemovePartecipazioneManuale
} from '../../core/services/manodopera-roster-giorno-logic.js';

const GIORNO = '2026-07-27';

describe('manodopera-roster-giorno-logic', () => {
  test('ensureRosterSlice seed da squadra', () => {
    const lavoro = { id: 'L1', caposquadraId: 'cap1' };
    const squadre = [{ caposquadraId: 'cap1', operai: ['a', 'b', 'c'] }];
    const { slice, created } = ensureRosterSlice({
      lavoro,
      giornoKey: GIORNO,
      squadreList: squadre,
      materializzatoIl: '2026-07-27T08:00:00.000Z'
    });
    expect(created).toBe(true);
    expect(isRosterMaterializzato(slice)).toBe(true);
    expect(getRosterPrevistiIds(slice)).toEqual(['a', 'b', 'c']);
    expect(getRosterAttiviIds(slice)).toEqual(['a', 'b', 'c']);
    expect(slice.materializzatoDa).toBe('auto');
    expect(slice.partecipazioni.every((p) => p.stato === ROSTER_STATO_PREVISTO)).toBe(true);
  });

  test('ensureRosterSlice autonomo', () => {
    const { slice } = ensureRosterSlice({
      lavoro: { id: 'L2', operaioId: 'solo' },
      giornoKey: GIORNO,
      squadreList: []
    });
    expect(getRosterPrevistiIds(slice)).toEqual(['solo']);
    expect(slice.partecipazioni[0].origine).toBe('autonomo');
  });

  test('ensureRosterSlice idempotente se già materializzato', () => {
    const lavoro = {
      id: 'L1',
      caposquadraId: 'cap1',
      equipaggioGiorno: {
        [GIORNO]: {
          partecipazioni: [
            {
              operaioId: 'x',
              stato: ROSTER_STATO_PREVISTO,
              origine: 'squadra'
            }
          ],
          materializzatoIl: 'already',
          assenti: [],
          sostituzioni: [],
          prestitiUscita: []
        }
      }
    };
    const { slice, created } = ensureRosterSlice({
      lavoro,
      giornoKey: GIORNO,
      squadreList: [{ caposquadraId: 'cap1', operai: ['a', 'b'] }]
    });
    expect(created).toBe(false);
    expect(getRosterPrevistiIds(slice)).toEqual(['x']);
  });

  test('idrata delta legacy in seed', () => {
    const lavoro = {
      id: 'L1',
      caposquadraId: 'cap1',
      equipaggioGiorno: {
        [GIORNO]: {
          assenti: ['a'],
          sostituzioni: [
            {
              assenteOperaioId: 'a',
              sostitutoOperaioId: 'sost',
              assegnatoDa: 'mgr'
            }
          ],
          prestitiUscita: []
        }
      }
    };
    const { slice } = ensureRosterSlice({
      lavoro,
      giornoKey: GIORNO,
      squadreList: [{ caposquadraId: 'cap1', operai: ['a', 'b'] }]
    });
    expect(getRosterAssentiIds(slice)).toContain('a');
    expect(getRosterSostitutiIds(slice)).toContain('sost');
    expect(getRosterAttiviIds(slice)).toEqual(['b', 'sost']);
    const a = slice.partecipazioni.find((p) => p.operaioId === 'a');
    expect(a.stato).toBe(ROSTER_STATO_SOSTITUITO);
  });

  test('applySostituzioneToRoster aggiorna stati e delta', () => {
    let { slice } = ensureRosterSlice({
      lavoro: { caposquadraId: 'c' },
      giornoKey: GIORNO,
      squadreList: [{ caposquadraId: 'c', operai: ['assente', 'ok'] }]
    });
    slice = applySostituzioneToRoster(slice, {
      assenteOperaioId: 'assente',
      sostitutoOperaioId: 'nuovo',
      assegnatoDa: 'mgr1'
    });
    expect(slice.assenti).toContain('assente');
    expect(slice.sostituzioni).toHaveLength(1);
    expect(getRosterAttiviIds(slice).sort()).toEqual(['nuovo', 'ok']);
    const ass = slice.partecipazioni.find((p) => p.operaioId === 'assente');
    expect(ass.stato).toBe(ROSTER_STATO_SOSTITUITO);
    const sost = slice.partecipazioni.find((p) => p.operaioId === 'nuovo');
    expect(sost.stato).toBe(ROSTER_STATO_AGGIUNTO);
    expect(sost.origine).toBe(ROSTER_ORIGINE_SOSTITUZIONE);
  });

  test('applyPrestitoUscitaToRoster', () => {
    let { slice } = ensureRosterSlice({
      lavoro: { caposquadraId: 'c' },
      giornoKey: GIORNO,
      squadreList: [{ caposquadraId: 'c', operai: ['op1', 'op2'] }]
    });
    slice = applyPrestitoUscitaToRoster(slice, {
      operaioId: 'op1',
      versoLavoroId: 'Ldest',
      daManagerId: 'mgr'
    });
    expect(slice.prestitiUscita[0].versoLavoroId).toBe('Ldest');
    const row = slice.partecipazioni.find((p) => p.operaioId === 'op1');
    expect(row.stato).toBe(ROSTER_STATO_PRESTATO_OUT);
    expect(getRosterAttiviIds(slice)).toEqual(['op2']);
  });

  test('applyAssenzaToRoster senza sostituto', () => {
    let { slice } = ensureRosterSlice({
      lavoro: { operaioId: 'solo' },
      giornoKey: GIORNO
    });
    slice = applyAssenzaToRoster(slice, 'solo', 'mgr');
    expect(getRosterAttiviIds(slice)).toEqual([]);
    expect(getRosterAssentiIds(slice)).toContain('solo');
  });

  test('resolvePrevistiOperaioIdsForGiorno: fallback anagrafica vs roster', () => {
    const squadre = [{ caposquadraId: 'c', operai: ['a', 'b'] }];
    const lavoroBare = { caposquadraId: 'c' };
    expect(resolveAnagraficaPrevistiIds(lavoroBare, squadre)).toEqual(['a', 'b']);
    expect(resolvePrevistiOperaioIdsForGiorno(lavoroBare, squadre, GIORNO)).toEqual([
      'a',
      'b'
    ]);

    const { slice } = ensureRosterSlice({
      lavoro: lavoroBare,
      giornoKey: GIORNO,
      squadreList: squadre
    });
    const lavoroMat = {
      ...lavoroBare,
      equipaggioGiorno: { [GIORNO]: slice }
    };
    // dopo sostituzione i previsti restano a,b (non il sostituto)
    const after = applySostituzioneToRoster(slice, {
      assenteOperaioId: 'a',
      sostitutoOperaioId: 's'
    });
    const lavoroSost = {
      ...lavoroBare,
      equipaggioGiorno: { [GIORNO]: after }
    };
    expect(resolvePrevistiOperaioIdsForGiorno(lavoroSost, squadre, GIORNO)).toEqual([
      'a',
      'b'
    ]);
    expect(getRosterSostitutiIds(after)).toEqual(['s']);
    expect(lavoroMat).toBeTruthy();
  });

  test('applyLegacyDeltaToPartecipazioni standalone', () => {
    const seed = [
      {
        operaioId: 'a',
        stato: ROSTER_STATO_PREVISTO,
        origine: 'squadra',
        ruoloSlot: null,
        sostitutoDiOperaioId: null,
        prestitoVersoLavoroId: null,
        daManagerId: null
      }
    ];
    const out = applyLegacyDeltaToPartecipazioni(seed, {
      assenti: ['a'],
      sostituzioni: [],
      prestitiUscita: [{ operaioId: 'a', versoLavoroId: 'Lx' }]
    });
    expect(out[0].stato).toBe(ROSTER_STATO_PRESTATO_OUT);
    expect(out[0].prestitoVersoLavoroId).toBe('Lx');
  });

  test('sostituzione da prestito marca origine prestito_in', () => {
    let { slice } = ensureRosterSlice({
      lavoro: { caposquadraId: 'c' },
      giornoKey: GIORNO,
      squadreList: [{ caposquadraId: 'c', operai: ['a'] }]
    });
    slice = applySostituzioneToRoster(slice, {
      assenteOperaioId: 'a',
      sostitutoOperaioId: 'fromB',
      impegnoOrigineLavoroId: 'L-B'
    });
    const s = slice.partecipazioni.find((p) => p.operaioId === 'fromB');
    expect(s.origine).toBe(ROSTER_ORIGINE_PRESTITO_IN);
  });

  test('A2 addPartecipazioneManuale + remove previsto', () => {
    let { slice } = ensureRosterSlice({
      lavoro: { caposquadraId: 'c' },
      giornoKey: GIORNO,
      squadreList: [{ caposquadraId: 'c', operai: ['a', 'b'] }]
    });
    slice = addPartecipazioneManuale(slice, { operaioId: 'extra', daManagerId: 'mgr' });
    const extra = slice.partecipazioni.find((p) => p.operaioId === 'extra');
    expect(extra.origine).toBe(ROSTER_ORIGINE_MANUALE);
    expect(extra.stato).toBe(ROSTER_STATO_AGGIUNTO);
    expect(getRosterAttiviIds(slice).sort()).toEqual(['a', 'b', 'extra']);
    expect(canRemovePartecipazioneManuale(extra)).toBe(true);

    slice = removePartecipazioneManuale(slice, { operaioId: 'a' });
    expect(getRosterPrevistiIds(slice).sort()).toEqual(['b', 'extra']);
    expect(getRosterAttiviIds(slice).sort()).toEqual(['b', 'extra']);
  });

  test('A2 non rimuove sostituto; roster vuoto resta materializzato', () => {
    let { slice } = ensureRosterSlice({
      lavoro: { caposquadraId: 'c' },
      giornoKey: GIORNO,
      squadreList: [{ caposquadraId: 'c', operai: ['a'] }]
    });
    slice = applySostituzioneToRoster(slice, {
      assenteOperaioId: 'a',
      sostitutoOperaioId: 's',
      assegnatoDa: 'mgr'
    });
    const sost = slice.partecipazioni.find((p) => p.operaioId === 's');
    const assente = slice.partecipazioni.find((p) => p.operaioId === 'a');
    expect(canRemovePartecipazioneManuale(sost)).toBe(false);
    expect(canRemovePartecipazioneManuale(assente)).toBe(false);
    expect(() => removePartecipazioneManuale(slice, { operaioId: 's' })).toThrow(/Non rimuovibile/);

    let { slice: s2 } = ensureRosterSlice({
      lavoro: { operaioId: 'solo' },
      giornoKey: GIORNO
    });
    s2 = removePartecipazioneManuale(s2, { operaioId: 'solo' });
    expect(s2.partecipazioni).toEqual([]);
    expect(isRosterMaterializzato(s2)).toBe(true);
    const again = ensureRosterSlice({
      lavoro: {
        operaioId: 'solo',
        equipaggioGiorno: { [GIORNO]: s2 }
      },
      giornoKey: GIORNO
    });
    expect(again.created).toBe(false);
    expect(again.slice.partecipazioni).toEqual([]);
  });

  test('A2 add duplicato → errore', () => {
    let { slice } = ensureRosterSlice({
      lavoro: { operaioId: 'solo' },
      giornoKey: GIORNO
    });
    expect(() =>
      addPartecipazioneManuale(slice, { operaioId: 'solo' })
    ).toThrow(/già presente/);
  });
});
