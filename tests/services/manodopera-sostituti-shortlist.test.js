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
  DISPONIBILITA_LIBERO,
  DISPONIBILITA_IMPEGNATO,
  SHORTLIST_MAX_CANDIDATI
} from '../../core/services/manodopera-sostituti-shortlist-logic.js';

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

  test('rank: liberi prima e max 4', () => {
    const ranked = rankAndLimitShortlist([
      { operaioId: 'a', disponibilita: DISPONIBILITA_IMPEGNATO, stelleMinime: 5 },
      { operaioId: 'b', disponibilita: DISPONIBILITA_LIBERO, stelleMinime: 2 },
      { operaioId: 'c', disponibilita: DISPONIBILITA_LIBERO, stelleMinime: 4 },
      { operaioId: 'd', disponibilita: DISPONIBILITA_LIBERO, stelleMinime: 3 },
      { operaioId: 'e', disponibilita: DISPONIBILITA_LIBERO, stelleMinime: 1 }
    ]);
    expect(ranked).toHaveLength(SHORTLIST_MAX_CANDIDATI);
    expect(ranked[0].operaioId).toBe('c');
    expect(ranked[1].operaioId).toBe('d');
  });

  test('impegno via squadra del caposquadra', () => {
    const map = buildOperaioSquadreMap([
      { caposquadraId: 'cap1', operai: ['op1'] }
    ]);
    const lav = findImpegnoLavoroOperaio(
      'op1',
      [{ id: 'L1', stato: 'in_corso', caposquadraId: 'cap1' }],
      map,
      'other'
    );
    expect(lav?.id).toBe('L1');
  });
});
