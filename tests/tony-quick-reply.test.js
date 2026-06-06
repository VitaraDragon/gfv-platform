import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  tryTonyQuickReplies,
  resolveTariffaDeterministica,
  shouldSkipQuickReply,
  isTonyOperationalCreationIntent,
  isTonyPreventivoFormFieldCorrection,
} = require('../functions/tony-quick-replies.js');

const minimalAzienda = {
  summarySottoScorta: '2 prodotti sotto scorta: Concime A (giacenza 3, soglia 10); Fitofarmaco B (giacenza 0, soglia 5).',
  prodottiSottoScorta: [
    { nome: 'Concime A', giacenza: 3, sogliaMinima: 10 },
    { nome: 'Fitofarmaco B', giacenza: 0, sogliaMinima: 5 },
  ],
  summaryScadenze: '1 terreno in affitto scade entro 30 giorni; 2 revisioni trattori imminenti.',
  clienti: [
    { id: 'c1', ragioneSociale: 'Rossi Srl', stato: 'attivo' },
    { id: 'c2', ragioneSociale: 'Verdi', stato: 'sospeso' },
  ],
  preventivi: [
    { id: 'p1', stato: 'bozza', clienteId: 'c1' },
    { id: 'p2', stato: 'inviato', clienteId: 'c1' },
  ],
  tariffe: [
    {
      id: 't1',
      tipoLavoro: 'Trinciatura',
      coltura: '',
      categoriaColturaId: 'cat-seminativo',
      tipoCampo: 'collina',
      tariffaBase: 80,
      coefficiente: 1.2,
      attiva: true,
    },
    {
      id: 't2',
      tipoLavoro: 'Aratura',
      coltura: '',
      categoriaColturaId: 'cat-seminativo',
      tipoCampo: 'pianura',
      tariffaBase: 100,
      coefficiente: 1,
      attiva: true,
    },
  ],
  categorie: [{ id: 'cat-seminativo', nome: 'Seminativo', applicabileA: 'colture' }],
  colture: [{ id: 'col1', nome: 'Grano', categoriaId: 'cat-seminativo' }],
  tipiLavoro: [{ id: 'tl1', nome: 'Trinciatura' }, { id: 'tl2', nome: 'Aratura' }],
  summaryMovimentiRecenti: 'Ultimi movimenti: scarico Fitofarmaco B il 10 aprile 2026.',
  movimentiRecenti: [{ tipo: 'uscita', prodottoId: 'p1' }],
  guastiAperti: [{ macchina: 'Trattore 1', gravita: 'alta' }],
};

function ctxWithAzienda(extra = {}) {
  return {
    azienda: minimalAzienda,
    moduli_attivi: ['magazzino', 'contoTerzi', 'parcoMacchine', 'tony'],
    dashboard: { moduli_attivi: ['magazzino', 'contoTerzi', 'parcoMacchine', 'tony'] },
    ...extra,
  };
}

describe('tryTonyQuickReplies', () => {
  it('risponde su sotto scorta da summary reale', () => {
    const hit = tryTonyQuickReplies({
      message: 'cosa abbiamo sotto scorta?',
      ctx: ctxWithAzienda(),
    });
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('query_scorte');
    expect(hit.text).toMatch(/2 prodotti sotto scorta/i);
  });

  it('risponde su scadenze', () => {
    const hit = tryTonyQuickReplies({
      message: 'quali scadenze abbiamo?',
      ctx: ctxWithAzienda(),
    });
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('query_scadenze');
    expect(hit.text).toMatch(/affitto|revisioni/i);
  });

  it('risponde su costo tariffa collina', () => {
    const hit = tryTonyQuickReplies({
      message: 'quanto costa trinciatura in collina?',
      ctx: ctxWithAzienda(),
    });
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('query_tariffa_costo');
    expect(hit.text).toMatch(/96.*euro per ettaro/i);
  });

  it('conteggia clienti attivi', () => {
    const hit = tryTonyQuickReplies({
      message: 'quanti clienti attivi?',
      ctx: ctxWithAzienda(),
    });
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('query_conteggi_clienti');
    expect(hit.text).toMatch(/1 clienti attivi/i);
  });

  it('conteggia preventivi in bozza', () => {
    const hit = tryTonyQuickReplies({
      message: 'quanti preventivi in bozza?',
      ctx: ctxWithAzienda(),
    });
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('query_conteggi_preventivi');
    expect(hit.text).toMatch(/1 preventivi in bozza/i);
  });

  it('non intercetta crea lavoro (fallback Gemini)', () => {
    const msg = 'crea lavoro erpicatura nel casetti';
    expect(isTonyOperationalCreationIntent(msg)).toBe(true);
    expect(shouldSkipQuickReply(msg, ctxWithAzienda())).toBe(true);
    const hit = tryTonyQuickReplies({
      message: 'crea lavoro erpicatura nel casetti',
      ctx: ctxWithAzienda(),
    });
    expect(hit).toBeNull();
  });

  it('riconosce creazione preventivo anche con typo preventio', () => {
    expect(isTonyOperationalCreationIntent('crea preventio per luca, trinciare trebbiano')).toBe(true);
    expect(isTonyOperationalCreationIntent('dobbiamo trinciare il trebbiano per luca')).toBe(true);
  });

  it('blocca tariffe se contoTerzi non attivo', () => {
    const hit = tryTonyQuickReplies({
      message: 'quanto costa trinciatura in collina?',
      ctx: ctxWithAzienda({
        moduli_attivi: ['tony', 'vigneto'],
        dashboard: { moduli_attivi: ['tony', 'vigneto'] },
      }),
    });
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('query_tariffa_costo_module_blocked');
    expect(hit.text).toMatch(/Conto Terzi.*non è attivo/i);
  });

  it('blocca scorte se magazzino non attivo', () => {
    const hit = tryTonyQuickReplies({
      message: 'cosa abbiamo sotto scorta?',
      ctx: ctxWithAzienda({
        moduli_attivi: ['tony'],
        dashboard: { moduli_attivi: ['tony'] },
      }),
    });
    expect(hit.id).toBe('query_scorte_module_blocked');
    expect(hit.text).toMatch(/Magazzino.*non è attivo/i);
  });
});

describe('resolveTariffaDeterministica', () => {
  it('calcola tariffaBase * coefficiente', () => {
    const text = resolveTariffaDeterministica(minimalAzienda, 'quanto costa trinciatura nel seminativo in collina?');
    expect(text).toMatch(/96/);
  });
});

describe('isTonyPreventivoFormFieldCorrection', () => {
  const preventivoCtx = { form: { formId: 'preventivo-form' } };

  it('rileva correzione sottocategoria su preventivo aperto', () => {
    expect(isTonyPreventivoFormFieldCorrection('è trinciatura tra le file', preventivoCtx)).toBe(true);
    expect(isTonyPreventivoFormFieldCorrection('la sottocategoria è trinciatura tra le file', preventivoCtx)).toBe(true);
  });

  it('non confonde con domanda meteo operativa', () => {
    expect(isTonyPreventivoFormFieldCorrection('posso trinciare mercoledì?', preventivoCtx)).toBe(false);
  });

  it('shouldSkipQuickReply su preventivo aperto', () => {
    expect(shouldSkipQuickReply('è trinciatura tra le file', preventivoCtx)).toBe(true);
  });
});
