import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildModuleRecommendationHints,
  classifyAdvisorQuestion,
  isModuleAdvisorQuestion,
  mergeActiveModuleIds,
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
    expect(out.text).toMatch(/ti suggerirei/i);
  });

  it('suggerisce bundle se due moduli del pacchetto sono già attivi', () => {
    const { bundleHints } = buildModuleRecommendationHints(
      { terreni: [], tipiLavoro: [] },
      ['vigneto', 'manodopera'],
      { activeBundles: [] }
    );
    expect(bundleHints.some((h) => h.bundleId === 'vigneto-operativo')).toBe(true);
    expect(bundleHints[0].monthlySavings).toBeGreaterThan(0);
    expect(bundleHints[0].reason).toMatch(/\d+ euro al mese/i);
  });

  it('non suggerisce bundle già attivo', () => {
    const { bundleHints } = buildModuleRecommendationHints(
      { terreni: [], tipiLavoro: [] },
      ['vigneto', 'manodopera', 'magazzino'],
      { activeBundles: ['vigneto-operativo'] }
    );
    expect(bundleHints.some((h) => h.bundleId === 'vigneto-operativo')).toBe(false);
  });

  it('riconosce domande sui bundle', () => {
    expect(isModuleAdvisorQuestion('Quale bundle mi conviene?')).toBe(true);
    expect(classifyAdvisorQuestion('quali Bundle mi consigli?')).toBe('bundle');
  });

  it('domanda bundle: bundle prima delle riattivazioni', () => {
    const azienda = {
      terreni: [],
      clienti: [{ id: 'c1' }, { id: 'c2' }],
      terreniClienti: [{}, {}, {}, {}],
      preventivi: Array.from({ length: 13 }, (_, i) => ({ id: i })),
      macchine: Array.from({ length: 13 }, (_, i) => ({ id: i })),
      guastiAperti: [{ id: 1 }, { id: 2 }],
      tipiLavoro: [],
    };
    const out = tryTonyModuleAdvisorQuickReply(
      'quali Bundle dovrei attivare?',
      azienda,
      ['manodopera', 'vigneto', 'magazzino'],
      { activeBundles: [] }
    );
    expect(out).not.toBeNull();
    expect(out.text).toMatch(/Viticoltore Operativo/i);
    expect(out.text).toMatch(/2 euro al mese/i);
    const voIdx = out.text.indexOf('Viticoltore Operativo');
    const gfvIdx = out.text.indexOf('GFV Completo');
    if (gfvIdx >= 0) expect(voIdx).toBeLessThan(gfvIdx);
    expect(voIdx).toBeLessThan(out.text.indexOf('Conto Terzi'));
  });

  it('merge moduli tenant: conversione bundle anche se client ne manda 2', () => {
    const { bundleHintsAll } = buildModuleRecommendationHints(
      { terreni: [], tipiLavoro: [] },
      mergeActiveModuleIds(['manodopera', 'vigneto'], ['magazzino']),
      { activeBundles: [] }
    );
    expect(bundleHintsAll[0].bundleId).toBe('vigneto-operativo');
    expect(bundleHintsAll[0].kind).toBe('bundle_convert');
  });

  it('singoli vs bundle: domanda lunga riattivare o bundle', () => {
    const out = tryTonyModuleAdvisorQuickReply(
      'Ma secondo la mia azienda che cosa Mi converrebbe fare riattivare i moduli o attivare dei Bundle?',
      { terreni: [], clienti: [{ id: 1 }], macchine: [{ id: 1 }], tipiLavoro: [] },
      ['manodopera', 'vigneto', 'magazzino'],
      { activeBundles: [] }
    );
    expect(out).not.toBeNull();
    expect(out.id).toBe('bundle_vs_singles');
    expect(out.text).toMatch(/Viticoltore Operativo/i);
  });

  it('bundle o altri moduli → singoli vs bundle (non modulo generico)', () => {
    expect(classifyAdvisorQuestion('mi conviene attivare un bundle o altri moduli?')).toBe(
      'singoli_vs_bundle'
    );
    const out = tryTonyModuleAdvisorQuickReply(
      'mi conviene attivare un bundle o altri moduli?',
      { terreni: [], clienti: [{ id: 1 }], tipiLavoro: [] },
      ['manodopera', 'vigneto', 'magazzino'],
      { activeBundles: [] }
    );
    expect(out.id).toBe('bundle_vs_singles');
    expect(out.text).not.toMatch(/^In base ai dati della tua azienda ti suggerirei: Conto Terzi/i);
  });

  it('aggiungere tony frutteto conto terzi → GFV Completo in quick reply', () => {
    const out = tryTonyModuleAdvisorQuickReply(
      'e se volessi aggiungere anche tony avanzato frutteto e conto terzi?',
      {
        terreni: [],
        clienti: [{ id: 1 }],
        tipiLavoro: [],
      },
      ['manodopera', 'vigneto', 'magazzino'],
      { activeBundles: [] }
    );
    expect(out).not.toBeNull();
    expect(out.id).toBe('module_add_advisor');
    expect(out.text).toMatch(/GFV Completo/i);
    expect(out.text).toMatch(/7 euro al mese/i);
    expect(out.text.length).toBeLessThan(900);
  });

  it('attivarli singolarmente o bundle', () => {
    const out = tryTonyModuleAdvisorQuickReply(
      'mi conviene attivarli singolarmente o attivare un bundle?',
      { terreni: [], tipiLavoro: [] },
      ['manodopera', 'vigneto', 'magazzino'],
      { activeBundles: [] }
    );
    expect(out).not.toBeNull();
    expect(out.id).toBe('bundle_vs_singles');
  });

  it('volessi anche meteo tony frutteto report conto terzi → module_add (non guida dashboard)', () => {
    const msg =
      'e se volessi anche il modulo meteo,tony avanzato,frutteto,report,e conto terzi?';
    expect(classifyAdvisorQuestion(msg)).toBe('module_add');
    const out = tryTonyModuleAdvisorQuickReply(
      msg,
      { terreni: [], clienti: [{ id: 1 }], tipiLavoro: [] },
      ['manodopera', 'vigneto', 'magazzino'],
      { activeBundles: [] }
    );
    expect(out).not.toBeNull();
    expect(out.id).toBe('module_add_advisor');
    expect(out.text).toMatch(/GFV Completo/i);
    expect(out.text).not.toMatch(/riquadro Meteo in dashboard/i);
  });

  it('con Viticoltore Operativo già attivo: no Viticoltore Campo, messaggio chiaro', () => {
    const { bundleHintsAll } = buildModuleRecommendationHints(
      { terreni: [], tipiLavoro: [] },
      ['vigneto', 'manodopera', 'magazzino'],
      { activeBundles: ['vigneto-operativo'] }
    );
    expect(bundleHintsAll.some((b) => b.bundleId === 'operativo-vigneto')).toBe(false);

    const out = tryTonyModuleAdvisorQuickReply(
      'mi conviene attivare un bundle o altri moduli?',
      { terreni: [], clienti: [{ id: 1 }], tipiLavoro: [] },
      ['vigneto', 'manodopera', 'magazzino'],
      { activeBundles: ['vigneto-operativo'] }
    );
    expect(out).not.toBeNull();
    expect(out.text).toMatch(/Viticoltore Operativo/i);
    expect(out.text).toMatch(/risparmio bundle ce l'hai già/i);
    expect(out.text).not.toMatch(/Viticoltore Campo/i);
  });

  it('con Operativo attivo: no expand bundle se singoli marginali costano meno', () => {
    const { bundleHintsAll } = buildModuleRecommendationHints(
      { terreni: [], tipiLavoro: [] },
      ['vigneto', 'manodopera', 'magazzino'],
      { activeBundles: ['vigneto-operativo'] }
    );
    expect(bundleHintsAll.some((b) => b.bundleId === 'frutticoltore-campo')).toBe(false);
    expect(bundleHintsAll.some((b) => b.bundleId === 'frutteto-operativo')).toBe(false);
  });

  it('domanda Frutticoltore Campo con Operativo attivo → confronto marginale', () => {
    const msg =
      'non sarebbe piu conveniente attivare il bundle frutticoltore campo per avere magazzino e macchine visto che ho frutteti';
    const azienda = {
      terreni: [{ coltura_categoria: 'Frutteto' }],
      clienti: [{ id: 1 }],
      macchine: Array(13).fill({}),
      guastiAperti: [{}, {}],
      tipiLavoro: [],
    };
    const out = tryTonyModuleAdvisorQuickReply(msg, azienda, ['vigneto', 'manodopera', 'magazzino'], {
      activeBundles: ['vigneto-operativo'],
    });
    expect(out).not.toBeNull();
    expect(out.id).toBe('stacked_bundle_advisor');
    expect(out.text).toMatch(/Frutticoltore Campo/i);
    expect(out.text).toMatch(/16 euro al mese/i);
    expect(out.text).toMatch(/20 euro al mese/i);
    expect(out.text).toMatch(/moduli singoli/i);
    expect(out.text).toMatch(/Parco Macchine/i);
    expect(out.text).not.toMatch(/risparmi circa 2 euro.*Frutticoltore Campo/i);
  });
});
