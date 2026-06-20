import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildModuleRecommendationHints,
  isModuleAdvisorQuestion,
  tryTonyModuleAdvisorQuickReply,
} = require('../functions/tony-module-recommendations.js');

describe('tony-module-recommendations', () => {
  it('suggerisce Vigneto con molti terreni a vite', () => {
    const azienda = {
      terreni: [
        { nome: 'A', coltura_categoria: 'Vite' },
        { nome: 'B', coltura_categoria: 'Vite' },
        { nome: 'C', coltura_categoria: 'Vite' },
        { nome: 'D', coltura_categoria: 'Seminativo' },
      ],
      tipiLavoro: [],
    };
    const { hints } = buildModuleRecommendationHints(azienda, []);
    expect(hints.some((h) => h.moduleId === 'vigneto')).toBe(true);
  });

  it('suggerisce complemento Magazzino se Vigneto attivo', () => {
    const azienda = {
      terreni: [{ nome: 'A', coltura_categoria: 'Vite' }],
      tipiLavoro: [],
    };
    const { hints } = buildModuleRecommendationHints(azienda, ['vigneto']);
    expect(hints.some((h) => h.moduleId === 'magazzino' && h.kind === 'complement')).toBe(true);
    expect(hints.some((h) => h.moduleId === 'vigneto')).toBe(false);
  });

  it('con clienti ma Conto Terzi disattivo → riattivazione, non scoperta', () => {
    const azienda = {
      terreni: [],
      clienti: [{ id: 'c1', ragioneSociale: 'Rossi' }],
      terreniClienti: [{ nome: 'Campo cliente' }],
      tipiLavoro: [],
    };
    const { hints } = buildModuleRecommendationHints(azienda, []);
    const ct = hints.find((h) => h.moduleId === 'contoTerzi');
    expect(ct).toBeTruthy();
    expect(ct.kind).toBe('reactivate');
    expect(ct.reason).toMatch(/archivio/i);
  });

  it('senza clienti e senza Conto Terzi → nessun suggerimento conto terzi', () => {
    const azienda = {
      terreni: [{ nome: 'A', coltura_categoria: 'Seminativo' }],
      tipiLavoro: [],
    };
    const { hints } = buildModuleRecommendationHints(azienda, []);
    expect(hints.some((h) => h.moduleId === 'contoTerzi')).toBe(false);
  });

  it('con clienti e Conto Terzi attivo → trigger scoperta', () => {
    const azienda = {
      terreni: [],
      clienti: [{ id: 'c1', ragioneSociale: 'Rossi' }],
      tipiLavoro: [],
    };
    const { hints } = buildModuleRecommendationHints(azienda, ['contoTerzi']);
    expect(hints.some((h) => h.moduleId === 'contoTerzi')).toBe(false);
  });

  it('non suggerisce moduli già attivi', () => {
    const azienda = {
      terreni: [
        { nome: 'A', coltura_categoria: 'Vite' },
        { nome: 'B', coltura_categoria: 'Vite' },
      ],
      tipiLavoro: [],
    };
    const { hints } = buildModuleRecommendationHints(azienda, ['vigneto', 'magazzino']);
    expect(hints.every((h) => h.moduleId !== 'vigneto' && h.moduleId !== 'magazzino')).toBe(true);
  });

  it('non suggerisce Tony Avanzato', () => {
    const azienda = {
      terreni: Array.from({ length: 6 }, (_, i) => ({
        nome: `T${i}`,
        coltura_categoria: 'Vite',
      })),
      tipiLavoro: [{ nome: 'Trattamenti' }],
    };
    const { hints } = buildModuleRecommendationHints(azienda, []);
    expect(hints.every((h) => h.moduleId !== 'tony')).toBe(true);
  });

  it('riconosce domande consigli moduli', () => {
    expect(isModuleAdvisorQuestion('Quali moduli mi servono?')).toBe(true);
    expect(isModuleAdvisorQuestion('Cosa c\'è in questa tabella?')).toBe(false);
  });

  it('quick reply su domanda esplicita', () => {
    const out = tryTonyModuleAdvisorQuickReply(
      'Quali moduli mi consigli?',
      {
        terreni: [
          { coltura_categoria: 'Vite' },
          { coltura_categoria: 'Vite' },
          { coltura_categoria: 'Vite' },
        ],
        tipiLavoro: [],
      },
      []
    );
    expect(out).not.toBeNull();
    expect(out.text).toMatch(/Vigneto/i);
    expect(out.text).toMatch(/Abbonamento/i);
    expect(out.text).toMatch(/ti suggerirei questi moduli/i);
  });
});
