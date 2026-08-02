/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  operaioQualificatoPerSkill,
  getMinStelleSuSkillRichieste,
  rankAndLimitShortlist,
  findImpegnoLavoroOperaio,
  buildOperaioSquadreMap,
  classifyDisponibilitaCandidato,
  buildMotivoDisponibilita,
  evaluateEquipaggioMinimo,
  resolvePrevistiOperaioIds,
  wouldOrigineFallBelowMin,
  DISPONIBILITA_LIBERO,
  DISPONIBILITA_IMPEGNATO,
  DISPONIBILITA_SPOSTABILE,
  SHORTLIST_MAX_CANDIDATI
} from '../../core/services/manodopera-sostituti-shortlist-logic.js';
import {
  isLavoroPrestabile,
  resolvePrioritaLavoro,
  computeShortlistScore
} from '../../core/config/manodopera-sostituzione-policy-config.js';
import { giornoInIntervalloAssenza } from '../../core/config/manodopera-assenze-config.js';

describe('manodopera-sostituti-shortlist', () => {
  test('qualificazione per skill dichiarate', () => {
    const profilo = { skillDichiarate: ['potatura_manuale'], skillCalcolate: [] };
    expect(operaioQualificatoPerSkill(profilo, ['potatura_manuale'])).toBe(true);
    expect(operaioQualificatoPerSkill(profilo, ['guida_trattore'])).toBe(false);
  });

  test('stelle minime da skill calcolate', () => {
    const profilo = {
      skillDichiarate: [],
      skillCalcolate: [{ skillId: 'potatura_manuale', stelle: 4 }]
    };
    expect(getMinStelleSuSkillRichieste(profilo, ['potatura_manuale'])).toBe(4);
  });

  test('rank: liberi prima, poi spostabili, max 4', () => {
    const ranked = rankAndLimitShortlist([
      { operaioId: 'a', disponibilita: DISPONIBILITA_IMPEGNATO, stelleMinime: 5 },
      { operaioId: 'b', disponibilita: DISPONIBILITA_LIBERO, stelleMinime: 2 },
      { operaioId: 'c', disponibilita: DISPONIBILITA_LIBERO, stelleMinime: 4 },
      { operaioId: 's', disponibilita: DISPONIBILITA_SPOSTABILE, stelleMinime: 5 },
      { operaioId: 'd', disponibilita: DISPONIBILITA_LIBERO, stelleMinime: 3 },
      { operaioId: 'e', disponibilita: DISPONIBILITA_LIBERO, stelleMinime: 1 }
    ]);
    expect(ranked).toHaveLength(SHORTLIST_MAX_CANDIDATI);
    expect(ranked[0].operaioId).toBe('c');
    expect(ranked[1].operaioId).toBe('d');
    expect(ranked[2].operaioId).toBe('b');
    expect(ranked[3].operaioId).toBe('e');
    expect(ranked.every((r) => r.disponibilita === DISPONIBILITA_LIBERO)).toBe(true);
  });

  test('rank include spostabile dopo i liberi se pochi liberi', () => {
    const ranked = rankAndLimitShortlist([
      { operaioId: 's1', disponibilita: DISPONIBILITA_SPOSTABILE, stelleMinime: 3 },
      { operaioId: 'i1', disponibilita: DISPONIBILITA_IMPEGNATO, stelleMinime: 5 },
      { operaioId: 'l1', disponibilita: DISPONIBILITA_LIBERO, stelleMinime: 2 }
    ]);
    expect(ranked.map((r) => r.operaioId)).toEqual(['l1', 's1', 'i1']);
  });

  test('impegno via squadra del caposquadra', () => {
    const map = buildOperaioSquadreMap([{ caposquadraId: 'cap1', operai: ['op1'] }]);
    const lav = findImpegnoLavoroOperaio(
      'op1',
      [{ id: 'L1', stato: 'in_corso', caposquadraId: 'cap1' }],
      map,
      'other'
    );
    expect(lav?.id).toBe('L1');
  });

  test('classifica spostabile se origine a priorità inferiore', () => {
    const { disponibilita, richiedeConfermaSpostamento } = classifyDisponibilitaCandidato({
      impegno: { id: 'L0', prioritaOperativa: 'scalabile', nome: 'Potatura leggera' },
      lavoroDestinazione: { id: 'L1', prioritaOperativa: 'critico' },
      isPrestabile: isLavoroPrestabile
    });
    expect(disponibilita).toBe(DISPONIBILITA_SPOSTABILE);
    expect(richiedeConfermaSpostamento).toBe(true);
    expect(buildMotivoDisponibilita(disponibilita, { nome: 'Potatura leggera' })).toMatch(
      /Spostabile con conferma/
    );
  });

  test('classifica impegnato se origine non prestabile', () => {
    const { disponibilita } = classifyDisponibilitaCandidato({
      impegno: { id: 'L0', prioritaOperativa: 'critico' },
      lavoroDestinazione: { id: 'L1', prioritaOperativa: 'normale' },
      isPrestabile: isLavoroPrestabile
    });
    expect(disponibilita).toBe(DISPONIBILITA_IMPEGNATO);
  });

  test('sospendibile forza prestabile', () => {
    expect(
      isLavoroPrestabile(
        { sospendibile: true, prioritaOperativa: 'critico' },
        { prioritaOperativa: 'normale' }
      )
    ).toBe(true);
    expect(resolvePrioritaLavoro({ ritardabile: true })).toBe('scalabile');
  });

  test('equipaggio minimo incompleto dopo assenza', () => {
    const check = evaluateEquipaggioMinimo({
      minPersone: 4,
      previstiIds: ['a', 'b', 'c', 'd'],
      assentiIds: ['b'],
      sostitutiIds: []
    });
    expect(check.applicabile).toBe(true);
    expect(check.incompleto).toBe(true);
    expect(check.attivi).toBe(3);
    expect(check.mancanti).toBe(1);
  });

  test('equipaggio minimo ok dopo sostituto', () => {
    const check = evaluateEquipaggioMinimo({
      minPersone: 4,
      previstiIds: ['a', 'b', 'c', 'd'],
      assentiIds: ['b'],
      sostitutiIds: ['x']
    });
    expect(check.incompleto).toBe(false);
    expect(check.attivi).toBe(4);
  });

  test('previsti da squadra e origine sotto soglia dopo prestito', () => {
    const ids = resolvePrevistiOperaioIds(
      { caposquadraId: 'cap1' },
      [{ caposquadraId: 'cap1', operai: ['o1', 'o2', 'o3', 'o4'] }]
    );
    expect(ids).toHaveLength(4);
    expect(
      wouldOrigineFallBelowMin({
        lavoroOrigine: { caposquadraId: 'cap1' },
        squadreList: [{ caposquadraId: 'cap1', operai: ['o1', 'o2', 'o3', 'o4'] }],
        minPersoneOrigine: 4,
        operaioDaPrestareId: 'o2'
      })
    ).toBe(true);
  });

  test('esclusione assenza: giorno in intervallo (helper usato dalla shortlist)', () => {
    expect(giornoInIntervalloAssenza('2026-07-22', '2026-07-20', '2026-07-25')).toBe(true);
    expect(giornoInIntervalloAssenza('2026-07-22', '2026-07-23', '2026-07-25')).toBe(false);
  });

  test('score: libero batte spostabile a pari stelle (tie-break ranking)', () => {
    const libero = computeShortlistScore({
      stelleMinime: 3,
      disponibilita: DISPONIBILITA_LIBERO
    });
    const spostabile = computeShortlistScore({
      stelleMinime: 3,
      disponibilita: DISPONIBILITA_SPOSTABILE
    });
    expect(libero).toBeGreaterThan(spostabile);
  });

  test('score: stesso terreno / podere vicino batte lontano (pari stelle e disp.)', () => {
    const vicino = computeShortlistScore({
      stelleMinime: 3,
      disponibilita: DISPONIBILITA_SPOSTABILE,
      stessoTerreno: true,
      distanzaKm: 0
    });
    const lontano = computeShortlistScore({
      stelleMinime: 3,
      disponibilita: DISPONIBILITA_SPOSTABILE,
      stessoTerreno: false,
      stessoPodere: false,
      distanzaKm: 12
    });
    expect(vicino).toBeGreaterThan(lontano);
  });

  test('rank: a pari score preferisce distanza minore', () => {
    const ranked = rankAndLimitShortlist([
      {
        operaioId: 'far',
        disponibilita: DISPONIBILITA_SPOSTABILE,
        stelleMinime: 3,
        distanzaKm: 8,
        score: 32
      },
      {
        operaioId: 'near',
        disponibilita: DISPONIBILITA_SPOSTABILE,
        stelleMinime: 3,
        distanzaKm: 1,
        score: 32
      }
    ]);
    expect(ranked[0].operaioId).toBe('near');
    expect(ranked[1].operaioId).toBe('far');
  });
});
