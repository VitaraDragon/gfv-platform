import { describe, it, expect } from 'vitest';
import { suggestProdottoForRiga, enrichRigheWithProdottoSuggestions, suggestCategoriaForRiga, buildProdottoStubFromRiga, mapUnitaOcrToGfv } from '../core/js/tony/document-product-match.js';
import {
  validateRigheForBollaRegister,
  validateRigheForFatturaRegister,
  validateRigheForFatturaDirettaRegister,
  validateRigheForFatturaDocumento,
  formatRegisterSuccessMessage,
  isMovimentoPrezzoInAttesa,
  filterMovimentiCandidatiFattura,
  matchRigheFatturaToMovimenti,
  splitRigheFatturaPerModo,
  resolveAutoBollaSessionFromEstrazione,
  movimentoMatchesRiferimentoBolla,
  movimentoNoteContainsDocNum,
  normalizeRiferimentiBolla,
  ensureProdottiForRighe,
  qtyMatch,
} from '../core/js/tony/document-register.js';

const PRODOTTI = [
  { id: 'p1', nome: 'Urea 46%', codice: 'UREA46', categoria: 'fertilizzanti' },
  { id: 'p2', nome: 'NPK 12-12-17', codice: 'NPK1217', categoria: 'fertilizzanti' },
  { id: 'p3', nome: 'Rame ossicloruro', codice: 'RAMO', categoria: 'fitofarmaci' },
];

describe('document-product-match', () => {
  it('suggerisce prodotto per nome o codice', () => {
    var a = suggestProdottoForRiga('Urea 46 per ettaro', '', PRODOTTI);
    expect(a.prodottoId).toBe('p1');

    var b = suggestProdottoForRiga('concime', 'NPK1217', PRODOTTI);
    expect(b.prodottoId).toBe('p2');
  });

  it('enrichRigheWithProdottoSuggestions aggiunge candidati', () => {
    var out = enrichRigheWithProdottoSuggestions(
      [{ descrizione: 'Urea', quantita: 10 }],
      PRODOTTI
    );
    expect(out[0].matchCandidates.length).toBeGreaterThan(0);
    expect(out[0].categoriaSuggerita).toBe('fertilizzanti');
  });

  it('suggestCategoriaForRiga e stub prodotto', () => {
    expect(suggestCategoriaForRiga('Fungicida rame').categoria).toBe('fitofarmaci');
    expect(suggestCategoriaForRiga('Concime NPK').categoria).toBe('fertilizzanti');
    expect(mapUnitaOcrToGfv('kg')).toBe('kg');
    var stub = buildProdottoStubFromRiga({ descrizione: 'Viti plastiche', unita: 'pz', categoriaSuggerita: 'materiale_impianto' });
    expect(stub.daCompletare).toBe(true);
    expect(stub.categoria).toBe('materiale_impianto');
  });
});

describe('document-register', () => {
  it('validateRigheForBollaRegister richiede prodotto o descrizione e qty', () => {
    expect(validateRigheForBollaRegister([]).ok).toBe(false);
    expect(
      validateRigheForBollaRegister([{ prodottoIdConfermato: 'p1', quantita: 5 }]).ok
    ).toBe(true);
    expect(
      validateRigheForBollaRegister([{ descrizione: 'Nuovo prodotto X', quantita: 5 }]).ok
    ).toBe(true);
    expect(
      validateRigheForBollaRegister([{ prodottoIdConfermato: '', quantita: 5 }]).ok
    ).toBe(false);
  });

  it('formatRegisterSuccessMessage', () => {
    expect(formatRegisterSuccessMessage(2, 'bolla')).toMatch(/2 movimenti/);
    expect(formatRegisterSuccessMessage(1, 'fattura')).toMatch(/aggiornato/);
    expect(formatRegisterSuccessMessage(2, 'scontrino')).toMatch(/Scontrino registrato/);
    expect(formatRegisterSuccessMessage(2, 'fattura', { creati: 2 })).toMatch(/Fattura diretta/);
    expect(formatRegisterSuccessMessage(2, 'fattura', { creati: 1, aggiornati: 2 })).toMatch(/aggiornat/);
    expect(formatRegisterSuccessMessage(1, 'bolla', { prodottiCreati: 1 })).toMatch(/da completare/);
  });

  it('isMovimentoPrezzoInAttesa e filtro candidati fattura', () => {
    expect(isMovimentoPrezzoInAttesa({ tipo: 'entrata', prezzoInAttesa: true })).toBe(true);
    expect(isMovimentoPrezzoInAttesa({ tipo: 'entrata', prezzoUnitario: null })).toBe(true);
    expect(isMovimentoPrezzoInAttesa({ tipo: 'entrata', prezzoUnitario: 10 })).toBe(false);
    var movs = [
      { id: 'm1', tipo: 'entrata', prezzoInAttesa: true, prodottoId: 'p1', quantita: 10, documentoAcquisitoId: 'toc-a', note: 'Tony Occhi · Agri' },
      { id: 'm2', tipo: 'entrata', prezzoUnitario: 5, prodottoId: 'p2', quantita: 3, documentoAcquisitoId: 'toc-b' },
    ];
    expect(filterMovimentiCandidatiFattura(movs, { documentoBollaSessionId: 'toc-a' })).toHaveLength(1);
    expect(filterMovimentiCandidatiFattura(movs, { fornitoreNome: 'Agri' })).toHaveLength(1);
  });

  it('matchRigheFatturaToMovimenti per prodotto e quantità', () => {
    expect(qtyMatch(10, 10.05)).toBe(true);
    var candidati = [
      { id: 'm1', prodottoId: 'p1', quantita: 10 },
      { id: 'm2', prodottoId: 'p2', quantita: 5 },
    ];
    var matches = matchRigheFatturaToMovimenti(
      [
        { prodottoIdConfermato: 'p1', quantita: 10, prezzoUnitario: 12 },
        { prodottoIdConfermato: 'p2', quantita: 5, prezzoUnitario: 8 },
      ],
      candidati
    );
    expect(matches[0].movimentoId).toBe('m1');
    expect(matches[1].movimentoId).toBe('m2');
  });

  it('validateRigheForFatturaDirettaRegister richiede prezzo e qty', () => {
    expect(
      validateRigheForFatturaDirettaRegister([
        { prodottoIdConfermato: 'p1', quantita: 5, prezzoUnitario: 10 },
      ]).ok
    ).toBe(true);
    expect(
      validateRigheForFatturaDirettaRegister([
        { prodottoIdConfermato: 'p1', quantita: 5 },
      ]).ok
    ).toBe(false);
  });

  it('validateRigheForFatturaDocumento accetta fattura diretta senza bolla', () => {
    expect(
      validateRigheForFatturaDocumento(
        [{ prodottoIdConfermato: 'p1', quantita: 5, prezzoUnitario: 10 }],
        [{ movimentoId: null }]
      ).ok
    ).toBe(true);
    expect(
      validateRigheForFatturaDocumento(
        [{ prodottoIdConfermato: 'p1', prezzoUnitario: 10, movimentoIdConfermato: 'm1' }],
        [{ movimentoId: 'm1' }]
      ).ok
    ).toBe(true);
  });

  it('splitRigheFatturaPerModo separa righe con e senza bolla', () => {
    var split = splitRigheFatturaPerModo(
      [
        { prodottoIdConfermato: 'p1', movimentoIdConfermato: 'm1' },
        { prodottoIdConfermato: 'p2' },
      ],
      [{ movimentoId: 'm1' }, { movimentoId: null }]
    );
    expect(split.conBolla).toHaveLength(1);
    expect(split.senzaBolla).toHaveLength(1);
  });

  it('resolveAutoBollaSessionFromEstrazione trova sessione da DDT in nota', () => {
    var movs = [
      {
        id: 'm1',
        tipo: 'entrata',
        prezzoInAttesa: true,
        prodottoId: 'p1',
        quantita: 10,
        documentoAcquisitoId: 'toc-bolla-99',
        note: 'Tony Occhi · doc DDT-42 · Agri Srl · Urea',
      },
      {
        id: 'm2',
        tipo: 'entrata',
        prezzoInAttesa: true,
        prodottoId: 'p2',
        quantita: 5,
        documentoAcquisitoId: 'toc-bolla-99',
        note: 'Tony Occhi · doc DDT-42 · Agri Srl · NPK',
      },
      {
        id: 'm3',
        tipo: 'entrata',
        prezzoInAttesa: true,
        prodottoId: 'p3',
        quantita: 2,
        documentoAcquisitoId: 'toc-altro',
        note: 'Tony Occhi · doc DDT-99 · Altro · X',
      },
    ];
    var match = resolveAutoBollaSessionFromEstrazione(
      {
        tipoDocumento: 'fattura',
        fornitore: { nome: 'Agri Srl' },
        riferimentiBolla: [{ numeroDocumento: 'DDT-42' }],
        righe: [{ prodottoIdConfermato: 'p1', quantita: 10, prezzoUnitario: 12 }],
      },
      movs
    );
    expect(match.sessionId).toBe('toc-bolla-99');
    expect(match.numeroDocumento).toBe('DDT-42');
    expect(match.score).toBe(2);
  });

  it('movimentoNoteContainsDocNum e normalizeRiferimentiBolla', () => {
    expect(movimentoNoteContainsDocNum('Tony Occhi · doc DDT-42 · Agri', 'DDT-42')).toBe(true);
    expect(normalizeRiferimentiBolla(['DDT-1', { numeroDocumento: 'DDT-2' }])).toHaveLength(2);
    expect(movimentoMatchesRiferimentoBolla(
      { note: 'Tony Occhi · doc DDT-42 · Agri Srl' },
      { numeroDocumento: 'DDT-42' },
      'Agri Srl'
    )).toBe(true);
  });

  it('validateRigheForFatturaRegister richiede prezzo e movimento', () => {
    expect(
      validateRigheForFatturaRegister(
        [{ prodottoIdConfermato: 'p1', prezzoUnitario: 10, movimentoIdConfermato: 'm1' }],
        []
      ).ok
    ).toBe(true);
    expect(
      validateRigheForFatturaRegister([{ prodottoIdConfermato: 'p1', prezzoUnitario: 10 }], []).ok
    ).toBe(false);
  });

  it('registerFatturaPrezzi aggiorna movimenti via mock', async () => {
    const { registerFatturaPrezzi } = await import('../core/js/tony/document-register.js');
    const updated = [];
    const result = await registerFatturaPrezzi({
      sessionId: 'toc-fattura',
      estrazione: {
        tipoDocumentoConfermato: 'fattura',
        numeroDocumento: 'FT-9',
        fornitore: { nome: 'Agri' },
        righe: [
          { descrizione: 'Urea', prodottoIdConfermato: 'p1', quantita: 10, prezzoUnitario: 15, movimentoIdConfermato: 'mov-1' },
        ],
      },
      matches: [{ movimentoId: 'mov-1', movimento: { note: 'Bolla' } }],
      updateMovimento: async (id, data) => {
        updated.push({ id: id, data: data });
      },
    });
    expect(result.movimentoIds).toEqual(['mov-1']);
    expect(updated[0].data.prezzoUnitario).toBe(15);
    expect(updated[0].data.prezzoInAttesa).toBe(false);
    expect(updated[0].data.documentoFatturaId).toBe('toc-fattura');
  });

  it('registerFatturaEntrata crea entrate con prezzo', async () => {
    const { registerFatturaEntrata } = await import('../core/js/tony/document-register.js');
    const created = [];
    const result = await registerFatturaEntrata({
      sessionId: 'toc-scontrino',
      estrazione: {
        tipoDocumentoConfermato: 'scontrino',
        dataDocumento: '2026-07-13',
        fornitore: { nome: 'Garden' },
        numeroDocumento: 'SC-1',
        righe: [
          { descrizione: 'Concime', quantita: 2, prezzoUnitario: 18.5, prodottoIdConfermato: 'p1' },
        ],
      },
      createMovimento: async (data) => {
        created.push(data);
        return 'mov-s1';
      },
    });
    expect(result.movimentoIds).toEqual(['mov-s1']);
    expect(created[0].prezzoInAttesa).toBe(false);
    expect(created[0].prezzoUnitario).toBe(18.5);
    expect(created[0].documentoFatturaId).toBe('toc-scontrino');
    expect(created[0].note).toMatch(/Scontrino/);
  });

  it('registerFatturaDocumento gestisce fattura diretta e aggiornamento bolla', async () => {
    const { registerFatturaDocumento } = await import('../core/js/tony/document-register.js');
    const created = [];
    const updated = [];
    const result = await registerFatturaDocumento({
      sessionId: 'toc-fattura-mix',
      estrazione: {
        tipoDocumentoConfermato: 'fattura',
        numeroDocumento: 'FT-10',
        fornitore: { nome: 'Agri' },
        righe: [
          { descrizione: 'Urea', prodottoIdConfermato: 'p1', quantita: 10, prezzoUnitario: 15, movimentoIdConfermato: 'mov-1' },
          { descrizione: 'NPK', prodottoIdConfermato: 'p2', quantita: 4, prezzoUnitario: 20 },
        ],
      },
      matches: [{ movimentoId: 'mov-1' }, { movimentoId: null }],
      updateMovimento: async (id, data) => {
        updated.push({ id: id, data: data });
      },
      createMovimento: async (data) => {
        created.push(data);
        return 'mov-new';
      },
    });
    expect(result.movimentoIds).toEqual(['mov-1', 'mov-new']);
    expect(result.aggiornati).toBe(1);
    expect(result.creati).toBe(1);
    expect(updated[0].data.prezzoUnitario).toBe(15);
    expect(created[0].prezzoUnitario).toBe(20);
    expect(created[0].note).toMatch(/Fattura diretta/);
  });

  it('ensureProdottiForRighe crea stub se manca match', async () => {
    var created = [];
    var out = await ensureProdottiForRighe(
      [{ descrizione: 'Concime nuovo', quantita: 10, unita: 'kg' }],
      {
        createProdotto: async (data) => {
          created.push(data);
          return 'prod-new';
        },
      }
    );
    expect(out.righe[0].prodottoIdConfermato).toBe('prod-new');
    expect(created[0].daCompletare).toBe(true);
    expect(created[0].categoria).toBe('fertilizzanti');
  });

  it('registerBollaMovimenti crea prodotto e movimento se necessario', async () => {
    const { registerBollaMovimenti } = await import('../core/js/tony/document-register.js');
    const createdMov = [];
    const createdProd = [];
    const result = await registerBollaMovimenti({
      sessionId: 'toc-test2',
      estrazione: {
        tipoDocumentoConfermato: 'bolla',
        dataDocumento: '2026-07-01',
        righe: [{ descrizione: 'Seme barbera', quantita: 3, unita: 'kg' }],
      },
      createProdotto: async (data) => {
        createdProd.push(data);
        return 'prod-auto';
      },
      createMovimento: async (data) => {
        createdMov.push(data);
        return 'mov-auto';
      },
    });
    expect(result.movimentoIds).toEqual(['mov-auto']);
    expect(createdProd[0].nome).toBe('Seme barbera');
    expect(createdMov[0].prodottoId).toBe('prod-auto');
    expect(result.prodottiCreati).toHaveLength(1);
  });

  it('registerBollaMovimenti crea movimenti via mock', async () => {
    const { registerBollaMovimenti } = await import('../core/js/tony/document-register.js');
    const created = [];
    const result = await registerBollaMovimenti({
      sessionId: 'toc-test',
      estrazione: {
        tipoDocumentoConfermato: 'bolla',
        dataDocumento: '2026-07-01',
        fornitore: { nome: 'Agri' },
        numeroDocumento: 'DDT-1',
        righe: [
          { descrizione: 'Urea', quantita: 10, prodottoIdConfermato: 'p1' },
          { descrizione: 'NPK', quantita: 5, prodottoIdConfermato: 'p2', prezzoUnitario: 12 },
        ],
      },
      createMovimento: async (data) => {
        created.push(data);
        return 'mov-' + created.length;
      },
    });
    expect(result.movimentoIds).toHaveLength(2);
    expect(created[0].prezzoInAttesa).toBe(true);
    expect(created[1].prezzoInAttesa).toBe(false);
    expect(created[1].prezzoUnitario).toBe(12);
  });
});
