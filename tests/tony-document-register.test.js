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
  getRigaRiferimentoBollaNumero,
  sanitizeFatturaRighe,
  checkRigheVsImponibile,
  sumRigheImportoNetto,
  fornitoreNomeMatchesNote,
  docNumsLooselyEqual,
  extractDocNumDigitsCore,
  computePrezzoMedioPonderato,
  isEntrataConPrezzoCerto,
  parseAnnoFromDataDocumento,
  refreshPrezzoMedioAnagraficaProdotti,
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

  it('non matcha intestazioni DDT né confonde fungicidi generici', () => {
    var fitofarmaci = [
      { id: 'f1', nome: '(*) Fung. FORTUNE DISPERSS da 15 kg. (Zolfo)', codice: 'FORT', categoria: 'fitofarmaci' },
      { id: 'f2', nome: '(*) Fung. CUPROCAFFARO MICRO da 20 kg.', codice: 'CUPRO', categoria: 'fitofarmaci' },
      { id: 'bad', nome: 'DdT num. 1334/00 del 06/06/2026', codice: '', categoria: 'altro' },
    ];
    expect(suggestProdottoForRiga('Ddt num: 1334/00 del 08/09/2026', '', fitofarmaci).prodottoId).toBe(null);
    var cupro = suggestProdottoForRiga('Fung. CUPROCAFFARO MICRO da 20 kg', '', fitofarmaci);
    expect(cupro.prodottoId).toBe('f2');
    var siv = suggestProdottoForRiga('Inse SIVANTO', '', fitofarmaci.concat([
      { id: 'siv', nome: 'Inse. SIVANTO PRIME da 1 lt.', codice: 'SIV', categoria: 'fitofarmaci' },
    ]));
    expect(siv.prodottoId).toBe('siv');
    expect(siv.candidates.every(function (c) { return c.id !== 'bad'; })).toBe(true);
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
    expect(isMovimentoPrezzoInAttesa({ tipo: 'uscita', prezzoUnitario: null })).toBe(false);
    // Oggetto “ridotto” come in review-form (tipo omesso): non deve azzerare i candidati
    expect(isMovimentoPrezzoInAttesa({ id: 'mX', prezzoUnitario: null, note: 'Tony Occhi' })).toBe(true);
    var movs = [
      { id: 'm1', tipo: 'entrata', prezzoInAttesa: true, prodottoId: 'p1', quantita: 10, documentoAcquisitoId: 'toc-a', note: 'Tony Occhi · Agri' },
      { id: 'm2', tipo: 'entrata', prezzoUnitario: 5, prodottoId: 'p2', quantita: 3, documentoAcquisitoId: 'toc-b' },
    ];
    expect(filterMovimentiCandidatiFattura(movs, { documentoBollaSessionId: 'toc-a' })).toHaveLength(1);
    expect(filterMovimentiCandidatiFattura(movs, { fornitoreNome: 'Agri' })).toHaveLength(1);
    var stripped = [{ id: 'm1', prodottoId: 'p1', quantita: 10, documentoAcquisitoId: 'toc-a', note: 'Tony Occhi · Agri · doc 1490/00' }];
    expect(filterMovimentiCandidatiFattura(stripped, { fornitoreNome: 'Francesconi' })).toHaveLength(1);
  });

  it('computePrezzoMedioPonderato dalle entrate fatturate', () => {
    expect(isEntrataConPrezzoCerto({ tipo: 'entrata', prezzoUnitario: 10, quantita: 2 })).toBe(true);
    // Prezzo numerico valido conta anche se il flag in attesa è rimasto true
    expect(isEntrataConPrezzoCerto({ tipo: 'entrata', prezzoInAttesa: true, prezzoUnitario: 10, quantita: 2 })).toBe(true);
    expect(isEntrataConPrezzoCerto({ tipo: 'entrata', prezzoInAttesa: true, prezzoUnitario: null, quantita: 2 })).toBe(false);
    expect(parseAnnoFromDataDocumento('2026-06-30')).toBe(2026);
    var movs = [
      { tipo: 'entrata', prezzoUnitario: 100, quantita: 2, data: new Date('2026-01-10'), prezzoInAttesa: false },
      { tipo: 'entrata', prezzoUnitario: 10, quantita: 98, data: new Date('2026-03-01'), prezzoInAttesa: false },
      { tipo: 'entrata', prezzoUnitario: 50, quantita: 10, data: new Date('2025-06-01'), prezzoInAttesa: false },
      { tipo: 'entrata', prezzoInAttesa: true, prezzoUnitario: null, quantita: 5, data: new Date('2026-04-01') },
    ];
    var calc = computePrezzoMedioPonderato(movs, { anno: 2026 });
    expect(calc).not.toBeNull();
    expect(calc.nEntrate).toBe(2);
    // (100*2 + 10*98) / 100 = 11.8
    expect(calc.prezzoMedio).toBe(11.8);
    expect(computePrezzoMedioPonderato(movs, { anno: 2025 }).prezzoMedio).toBe(50);
    // Data assente: inclusa nel filtro anno (non azzera la media)
    expect(computePrezzoMedioPonderato([
      { tipo: 'entrata', prezzoUnitario: 12, quantita: 1, prezzoInAttesa: false },
    ], { anno: 2026 }).prezzoMedio).toBe(12);
  });

  it('refreshPrezzoMedioAnagraficaProdotti aggiorna anagrafica', async () => {
    var updates = [];
    var res = await refreshPrezzoMedioAnagraficaProdotti({
      prodottoIds: ['p1'],
      anno: 2026,
      getAllMovimenti: async () => ([
        { tipo: 'entrata', prezzoUnitario: 2, quantita: 10, data: new Date('2026-02-01'), prezzoInAttesa: false },
        { tipo: 'entrata', prezzoUnitario: 4, quantita: 10, data: new Date('2026-05-01'), prezzoInAttesa: false },
      ]),
      updateProdotto: async (id, u) => { updates.push({ id, u }); },
    });
    expect(res.updated).toBe(1);
    expect(updates[0].id).toBe('p1');
    expect(updates[0].u.prezzoUnitario).toBe(3);
    expect(updates[0].u.prezzoMedioAnno).toBe(2026);
    expect(updates[0].u.prezzoMedioN).toBe(2);
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

  it('matchRigheFatturaToMovimenti preferisce DDT della riga', () => {
    var candidati = [
      { id: 'm-old', prodottoId: 'p1', quantita: 10, note: 'Tony Occhi · doc 999/00 · Urea' },
      { id: 'm-ddt', prodottoId: 'p1', quantita: 10, note: 'Tony Occhi · doc 1334/00 · Urea' },
    ];
    var matches = matchRigheFatturaToMovimenti(
      [{ prodottoIdConfermato: 'p1', quantita: 10, riferimentoBolla: { numeroDocumento: '1334/00' } }],
      candidati
    );
    expect(matches[0].movimentoId).toBe('m-ddt');
  });

  it('matchRigheFatturaToMovimenti collega per DDT+qty anche senza prodotto', () => {
    var candidati = [
      { id: 'm1', prodottoId: 'p-x', quantita: 8, note: 'Tony Occhi · doc 1334/00 · Sivanto' },
      { id: 'm2', prodottoId: 'p-y', quantita: 15, note: 'Tony Occhi · doc 1334/00 · Sword' },
    ];
    var matches = matchRigheFatturaToMovimenti(
      [
        { descrizione: 'Inse SIVANTO', quantita: 8, riferimentoBolla: { numeroDocumento: '1334/00' } },
        { descrizione: 'Inse SWORD', quantita: 15, riferimentoBolla: { numeroDocumento: '1334/00' } },
      ],
      candidati
    );
    expect(matches[0].movimentoId).toBe('m1');
    expect(matches[1].movimentoId).toBe('m2');
  });

  it('fornitoreNomeMatchesNote tollera s.a.s. vs sas', () => {
    expect(fornitoreNomeMatchesNote(
      'Francesconi sas',
      'Tony Occhi · doc 1334/00 · Francesconi s.a.s. di Francesconi'
    )).toBe(true);
    expect(fornitoreNomeMatchesNote('Agri Srl', 'Tony Occhi · doc 1 · Altro Spa')).toBe(false);
  });

  it('docNumsLooselyEqual e match nota con OCR DDT', () => {
    expect(extractDocNumDigitsCore('1490/00')).toBe('1490');
    expect(docNumsLooselyEqual('1490/00', '1493/00')).toBe(true);
    expect(docNumsLooselyEqual('1490/00', '1500/00')).toBe(false);
    expect(movimentoNoteContainsDocNum('Tony Occhi · doc 1490/00 · Kusabi', '1493/00')).toBe(true);
    expect(movimentoNoteContainsDocNum('Tony Occhi · doc 1490/00 · Kusabi', '1500/00')).toBe(false);
  });

  it('sanitizeFatturaRighe e checkRigheVsImponibile', () => {
    expect(getRigaRiferimentoBollaNumero({ riferimentoBolla: { numeroDocumento: '1490/00' } })).toBe('1490/00');
    var clean = sanitizeFatturaRighe([
      { descrizione: 'Ddt num: 1490/00 del 24/09/2026' },
      { descrizione: 'Fung. KUSABI da 1 lt.', quantita: 2, prezzoUnitario: 94.25 },
      { descrizione: 'Spese Spedizione', quantita: 1, prezzoUnitario: 1.1 },
    ]);
    expect(clean).toHaveLength(2);
    expect(clean[0].riferimentoBolla.numeroDocumento).toBe('1490/00');
    expect(sumRigheImportoNetto(clean)).toBe(189.6);
    var warn = checkRigheVsImponibile(clean, { imponibile: 3632.96 });
    expect(warn.ok).toBe(false);
    expect(warn.message).toMatch(/imponibile/i);
    expect(checkRigheVsImponibile(clean, { imponibile: 189.6 }).ok).toBe(true);
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
    expect(match.multiSession).toBe(false);
  });

  it('resolveAutoBollaSessionFromEstrazione non forza filtro su multi-DDT', () => {
    var movs = [
      {
        id: 'm1',
        tipo: 'entrata',
        prezzoInAttesa: true,
        prodottoId: 'p1',
        quantita: 10,
        documentoAcquisitoId: 'toc-ddt-a',
        note: 'Tony Occhi · doc 1334/00 · Francesconi · Urea',
      },
      {
        id: 'm2',
        tipo: 'entrata',
        prezzoInAttesa: true,
        prodottoId: 'p2',
        quantita: 5,
        documentoAcquisitoId: 'toc-ddt-b',
        note: 'Tony Occhi · doc 1355/00 · Francesconi · NPK',
      },
    ];
    var match = resolveAutoBollaSessionFromEstrazione(
      {
        tipoDocumento: 'fattura',
        fornitore: { nome: 'Francesconi' },
        riferimentiBolla: [{ numeroDocumento: '1334/00' }, { numeroDocumento: '1355/00' }],
      },
      movs
    );
    expect(match.multiSession).toBe(true);
    expect(match.sessionId).toBe('');
    expect(match.sessionIds).toHaveLength(2);
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
