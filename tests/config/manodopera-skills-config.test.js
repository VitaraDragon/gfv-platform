/**
 * @vitest-environment node
 */

import { describe, test, expect } from 'vitest';
import {
  MANODOPERA_SKILL_IDS,
  resolveSkillIdFromSottocategoriaCodice,
  resolveSkillIdsFromTipoLavoro,
  resolveRequiredSkillsForLavoro,
  resolveSkillIdsForOreAggregation,
  isCarroRaccoltaFruttaAttrezzo,
  oreToStelle,
  getDefaultDeclaredSkillIdsForTipoOperaio,
  SKILL_ID_TRATTAMENTI,
  SKILL_ID_GUIDA_TRATTORE,
  SKILL_ID_RACCOLTA_MANUALE
} from '../../core/config/manodopera-skills-config.js';

describe('manodopera-skills-config', () => {
  test('catalogo ha 20 skill', () => {
    expect(MANODOPERA_SKILL_IDS).toHaveLength(20);
  });

  test('trattamenti manuale e meccanico → skill trattamenti', () => {
    expect(resolveSkillIdFromSottocategoriaCodice('trattamenti_manuale')).toBe(SKILL_ID_TRATTAMENTI);
    expect(resolveSkillIdFromSottocategoriaCodice('trattamenti_meccanico')).toBe(SKILL_ID_TRATTAMENTI);
  });

  test('vendemmia meccanica non mappa a raccolta_meccanica', () => {
    const ids = resolveSkillIdsFromTipoLavoro({
      tipoLavoroNome: 'Vendemmia Meccanica',
      sottocategoriaCodice: 'raccolta_meccanica'
    });
    expect(ids).toContain(SKILL_ID_RACCOLTA_MANUALE);
    expect(ids).not.toContain('raccolta_meccanica');
  });

  test('carro frutta richiede raccolta_meccanica e min 4', () => {
    const result = resolveRequiredSkillsForLavoro({
      tipoLavoroNome: 'Raccolta Meccanica',
      sottocategoriaCodice: 'raccolta_meccanica',
      attrezzo: { nome: 'Carro raccolta mele 4 posti' }
    });
    expect(result.skillIds).toContain('raccolta_meccanica');
    expect(result.equipaggioMinimo).toBe(4);
  });

  test('vendemmia con macchina aggiunge guida_trattore', () => {
    const result = resolveRequiredSkillsForLavoro({
      tipoLavoroNome: 'Vendemmia Manuale',
      sottocategoriaCodice: 'raccolta_manuale',
      macchinaId: 'trattore-1'
    });
    expect(result.skillIds).toContain(SKILL_ID_GUIDA_TRATTORE);
  });

  test('isCarroRaccoltaFruttaAttrezzo con tag', () => {
    expect(
      isCarroRaccoltaFruttaAttrezzo({ skillTags: ['carro_raccolta'] }, { tipoLavoroNome: 'Raccolta' })
    ).toBe(true);
  });

  test('oreToStelle soglie default', () => {
    expect(oreToStelle(10)).toBe(1);
    expect(oreToStelle(50)).toBe(2);
    expect(oreToStelle(500)).toBe(5);
  });

  test('tipoOperaio trattorista → guida_trattore', () => {
    expect(getDefaultDeclaredSkillIdsForTipoOperaio('trattorista')).toEqual([SKILL_ID_GUIDA_TRATTORE]);
  });

  test('ore aggregazione vendemmia trasporto', () => {
    const ids = resolveSkillIdsForOreAggregation({
      tipoLavoroNome: 'Vendemmia Meccanica',
      sottocategoriaCodice: 'raccolta_meccanica',
      macchinaId: 't1',
      ruoloOre: 'trasporto'
    });
    expect(ids).toContain(SKILL_ID_GUIDA_TRATTORE);
    expect(ids).not.toContain('raccolta_meccanica');
  });
});
