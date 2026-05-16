/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  normalizeSkillDichiarateIds,
  normalizeProfiloManodopera,
  summarizeProfiloForList
} from '../../core/services/profilo-manodopera-normalize.js';

describe('profilo-manodopera-service', () => {
  test('normalizeSkillDichiarateIds filtra invalidi e duplicati', () => {
    expect(
      normalizeSkillDichiarateIds([
        'potatura_manuale',
        'invalid',
        'potatura_manuale',
        'trattamenti'
      ])
    ).toEqual(['potatura_manuale', 'trattamenti']);
  });

  test('normalizeProfiloManodopera da oggetto misto', () => {
    const p = normalizeProfiloManodopera({
      skillDichiarate: [{ skillId: 'guida_trattore' }, 'raccolta_manuale'],
      skillCalcolate: [{ skillId: 'potatura_manuale', stelle: 3, orePeriodo: 90 }]
    });
    expect(p.skillDichiarate).toEqual(['guida_trattore', 'raccolta_manuale']);
    expect(p.skillCalcolate).toHaveLength(1);
  });

  test('summarizeProfiloForList', () => {
    const s = summarizeProfiloForList({
      skillDichiarate: ['trattamenti'],
      skillCalcolate: [
        { skillId: 'potatura_manuale', stelle: 2 },
        { skillId: 'raccolta_manuale', stelle: 4 }
      ]
    });
    expect(s.dichiarateCount).toBe(1);
    expect(s.topCalcolata.skillId).toBe('raccolta_manuale');
  });
});
