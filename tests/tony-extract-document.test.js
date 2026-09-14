import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  validateDocumentPages,
  parseExtractedDocumentJson,
  normalizeExtractionResult,
  buildGeminiDocumentParts,
  buildGeminiReconcileParts,
  TONY_DOCUMENT_MAX_PAGES,
  TONY_DOCUMENT_EXTRACTION_PROMPT,
  TONY_DOCUMENT_TRANSCRIBE_PROMPT,
  TONY_DOCUMENT_RECONCILE_PROMPT,
} = require('../functions/config/tony-document-schemas.js');
const {
  tenantHasMagazzinoModule,
  applyDocumentGeminiGenerationConfig,
  pickReconciledExtraction,
  runTwoPassExtraction,
  TONY_DOCUMENT_THINKING_BUDGET,
} = require('../functions/tony-extract-document.js');
const {
  shouldRunSafetySecondPass,
  mergeSafetySecondPass,
  countMerceRows,
} = require('../functions/config/tony-document-safety.js');

const MIN_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGf/AP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//Z';

describe('tony-document-schemas', () => {
  it('valida pagina jpeg base64 minima', () => {
    const pages = validateDocumentPages([{ mimeType: 'image/jpeg', data: MIN_JPEG_B64 }]);
    expect(pages).toHaveLength(1);
    expect(pages[0].mimeType).toBe('image/jpeg');
    expect(pages[0].indice).toBe(1);
  });

  it('rifiuta MIME non supportato', () => {
    expect(() =>
      validateDocumentPages([{ mimeType: 'text/plain', data: MIN_JPEG_B64 }])
    ).toThrow(/MIME non supportato/);
  });

  it('accetta XML fattura elettronica', () => {
    const xmlB64 = Buffer.from('<FatturaElettronica></FatturaElettronica>', 'utf8').toString('base64');
    const pages = validateDocumentPages([{ mimeType: 'application/xml', data: xmlB64 }]);
    expect(pages[0].mimeType).toBe('application/xml');
  });

  it('rifiuta array vuoto', () => {
    expect(() => validateDocumentPages([])).toThrow(/almeno una pagina/);
  });

  it('rifiuta troppe pagine', () => {
    const many = Array.from({ length: TONY_DOCUMENT_MAX_PAGES + 1 }, (_, i) => ({
      mimeType: 'image/jpeg',
      data: MIN_JPEG_B64,
      indice: i + 1,
    }));
    expect(() => validateDocumentPages(many)).toThrow(/Massimo/);
  });

  it('parsa JSON in fence markdown', () => {
    const raw = '```json\n{"tipoDocumento":"bolla","righe":[{"descrizione":"NPK 12kg"}]}\n```';
    const parsed = parseExtractedDocumentJson(raw);
    expect(parsed.tipoDocumento).toBe('bolla');
    expect(parsed.righe).toHaveLength(1);
  });

  it('ripara JSON troncato e decimali italiani', () => {
    const truncated =
      '{"tipoDocumento":"fattura","righe":[{"descrizione":"SWORD","quantita":15,"prezzoUnitario":61,04},{"descrizione":"KUSABI","quantita":2';
    const parsed = parseExtractedDocumentJson(truncated);
    expect(parsed.tipoDocumento).toBe('fattura');
    expect(parsed.righe).toHaveLength(2);
    expect(parsed.righe[0].prezzoUnitario).toBe(61.04);
    expect(parsed.righe[1].descrizione).toBe('KUSABI');
  });

  it('normalizza estrazione con tipi misti', () => {
    const out = normalizeExtractionResult({
      tipoDocumento: 'FATTURA',
      confidence: 1.2,
      fornitore: { nome: ' Agri Srl ', piva: 'IT123' },
      righe: [
        { descrizione: '  Urea ', quantita: '10', unita: 'kg', prezzoUnitario: '2.5', paginaOrigine: 2 },
        { descrizione: '' },
      ],
      totali: { totale: '25' },
    });
    expect(out.tipoDocumento).toBe('fattura');
    expect(out.confidence).toBe(1);
    expect(out.fornitore.nome).toBe('Agri Srl');
    expect(out.righe).toHaveLength(1);
    expect(out.righe[0].quantita).toBe(10);
    expect(out.righe[0].prezzoUnitario).toBe(2.5);
    expect(out.totali.totale).toBe(25);
    expect(out.fonteEstrazione).toBeUndefined();
  });

  it('preserve fonteEstrazione fatturapa', () => {
    const out = normalizeExtractionResult({
      tipoDocumento: 'fattura',
      fonteEstrazione: 'fatturapa',
      righe: [{ descrizione: 'Urea', quantita: 1 }],
    });
    expect(out.fonteEstrazione).toBe('fatturapa');
  });

  it('normalizza tipo scontrino', () => {
    const out = normalizeExtractionResult({
      tipoDocumento: 'scontrino',
      righe: [{ descrizione: 'Viti', quantita: 1, prezzoUnitario: 3 }],
    });
    expect(out.tipoDocumento).toBe('scontrino');
  });

  it('normalizza riferimentiBolla su fattura', () => {
    const out = normalizeExtractionResult({
      tipoDocumento: 'fattura',
      riferimentiBolla: [
        { numeroDocumento: 'DDT 12/2026', dataDocumento: '2026-07-01' },
        'DDT-99',
      ],
      righe: [{ descrizione: 'Urea', quantita: 10 }],
    });
    expect(out.riferimentiBolla).toHaveLength(2);
    expect(out.riferimentiBolla[0].numeroDocumento).toBe('DDT 12/2026');
    expect(out.riferimentiBolla[1].numeroDocumento).toBe('DDT-99');
  });

  it('fattura riepilogativa: scarta intestazioni DDT e propaga riferimentoBolla', () => {
    const out = normalizeExtractionResult({
      tipoDocumento: 'fattura',
      totali: { imponibile: 3632.96, iva: 368.31, totale: 4001.27 },
      righe: [
        { descrizione: 'Ddt num: 1334/00 del 08/09/2026', quantita: null },
        { descrizione: 'Inse. SIVANTO PRIME da 1 lt.', quantita: 8, unita: 'LT', prezzoUnitario: 114.45 },
        { descrizione: 'Inse. SWORD UP da 0,500 lt.', quantita: 15, unita: 'MJ', prezzoUnitario: 61.04 },
        { descrizione: 'Ddt num: 1355/00 del 09/09/2026' },
        {
          descrizione: 'Fung. CUPROCAFFARO MICRO da 20 kg',
          quantita: 120,
          unita: 'KG',
          prezzoUnitario: 11.24,
          riferimentoBolla: { numeroDocumento: '1355/00' },
        },
      ],
    });
    expect(out.righe).toHaveLength(3);
    expect(out.righe[0].descrizione).toMatch(/SIVANTO/i);
    expect(out.righe[0].riferimentoBolla.numeroDocumento).toBe('1334/00');
    expect(out.righe[1].riferimentoBolla.numeroDocumento).toBe('1334/00');
    expect(out.righe[2].riferimentoBolla.numeroDocumento).toBe('1355/00');
    expect(out.riferimentiBolla.map((r) => r.numeroDocumento)).toEqual(
      expect.arrayContaining(['1334/00', '1355/00'])
    );
    expect(TONY_DOCUMENT_EXTRACTION_PROMPT || '').toBeDefined();
  });

  it('buildGeminiDocumentParts include inlineData per pagina', () => {
    const pages = [{ mimeType: 'image/png', data: 'abc123', indice: 1 }];
    const parts = buildGeminiDocumentParts(pages);
    expect(parts.some((p) => p.inlineData && p.inlineData.mimeType === 'image/png')).toBe(true);
    expect(parts[0].text).toMatch(/bolle/i);
    expect(parts[0].text).toMatch(/riepilogativ/i);
    expect(parts[0].text).toMatch(/CIFRA PER CIFRA/i);
  });

  it('buildGeminiDocumentParts include trascrizione se presente e salta XML', () => {
    const pages = [
      { mimeType: 'image/png', data: 'abc123', indice: 1 },
      { mimeType: 'application/xml', data: 'eA==', indice: 2 },
    ];
    const parts = buildGeminiDocumentParts(pages, { transcription: 'DDT 1490/00 Urea 10 kg' });
    expect(parts.some((p) => p.text && /TRASCRIZIONE LETTERALE/.test(p.text))).toBe(true);
    expect(parts.some((p) => p.inlineData && p.inlineData.mimeType === 'application/xml')).toBe(false);
    expect(parts.some((p) => p.inlineData && p.inlineData.mimeType === 'image/png')).toBe(true);
  });

  it('OCR prompt salta boilerplate legale e resta cifra-per-cifra', () => {
    expect(TONY_DOCUMENT_TRANSCRIBE_PROMPT).toMatch(/CIFRA PER CIFRA/i);
    expect(TONY_DOCUMENT_TRANSCRIBE_PROMPT).toMatch(/piè di pagina|condizioni di pagamento/i);
  });

  it('reconcile è solo testo, senza immagini', () => {
    const parts = buildGeminiReconcileParts(
      { tipoDocumento: 'fattura', numeroDocumento: '1493/00', righe: [{ descrizione: 'Urea' }] },
      'Fattura n. 1490/00 Urea 10 kg'
    );
    expect(TONY_DOCUMENT_RECONCILE_PROMPT).toMatch(/CIFRA PER CIFRA/i);
    expect(parts.some((p) => p.inlineData)).toBe(false);
    expect(parts.some((p) => /1493\/00/.test(p.text || ''))).toBe(true);
    expect(parts.some((p) => /1490\/00/.test(p.text || ''))).toBe(true);
  });
});

describe('tony-extract-document gate', () => {
  it('tenantHasMagazzinoModule', () => {
    expect(tenantHasMagazzinoModule(['tony', 'magazzino'])).toBe(true);
    expect(tenantHasMagazzinoModule(['tony', 'vigneto'])).toBe(false);
  });
});

describe('tony-document-safety Level B', () => {
  it('non richiede seconda passata se documento coerente', () => {
    const gate = shouldRunSafetySecondPass({
      tipoDocumento: 'fattura',
      confidence: 0.9,
      numeroDocumento: '695/V0',
      totali: { imponibile: 189.6 },
      righe: [
        { descrizione: 'KUSABI', quantita: 2, prezzoUnitario: 94.25, confidence: 0.9 },
        { descrizione: 'Spese', quantita: 1, prezzoUnitario: 1.1, confidence: 0.85 },
      ],
    });
    expect(gate.run).toBe(false);
  });

  it('richiede seconda passata su imponibile incoerente o poche righe', () => {
    const gate = shouldRunSafetySecondPass({
      tipoDocumento: 'fattura',
      confidence: 0.8,
      numeroDocumento: '1',
      totali: { imponibile: 4000 },
      righe: [{ descrizione: 'Solo uno', quantita: 1, prezzoUnitario: 10, confidence: 0.9 }],
    });
    expect(gate.run).toBe(true);
    expect(gate.reasons).toEqual(expect.arrayContaining(['imponibile_mismatch', 'few_rows_vs_imponibile']));
  });

  it('merge preferisce più righe dalla seconda passata', () => {
    const first = {
      tipoDocumento: 'fattura',
      confidence: 0.6,
      numeroDocumento: '',
      fornitore: { nome: '', piva: '' },
      righe: [{ descrizione: 'Prodotto A', quantita: 1, prezzoUnitario: 10 }],
      totali: { imponibile: 100 },
    };
    const second = {
      tipoDocumento: 'fattura',
      confidence: 0.8,
      numeroDocumento: '100/V0',
      fornitore: { nome: 'Agri', piva: 'IT1' },
      righe: [
        { descrizione: 'Prodotto A', quantita: 1, prezzoUnitario: 10 },
        { descrizione: 'Prodotto B', quantita: 2, prezzoUnitario: 45 },
      ],
      totali: { imponibile: 100 },
    };
    const merged = mergeSafetySecondPass(first, second, ['imponibile_mismatch']);
    expect(merged.safetyPassB).toBe(true);
    expect(merged.numeroDocumento).toBe('100/V0');
    expect(merged.fornitore.nome).toBe('Agri');
    expect(countMerceRows(merged.righe)).toBe(2);
  });
});

describe('tony-extract-document pipeline parallela', () => {
  it('disattiva il thinking Gemini sulle chiamate documento', () => {
    const cfg = applyDocumentGeminiGenerationConfig({ temperature: 0 });
    expect(TONY_DOCUMENT_THINKING_BUDGET).toBe(0);
    expect(cfg.thinkingConfig.thinkingBudget).toBe(0);
  });

  it('se il reconcile perde righe tiene la copertura vision e copia n. documento', () => {
    const first = {
      tipoDocumento: 'fattura',
      numeroDocumento: '1493/00',
      fornitore: { nome: 'Agri', piva: '' },
      righe: [
        { descrizione: 'Urea 46', quantita: 10, prezzoUnitario: 2.5 },
        { descrizione: 'NPK', quantita: 5, prezzoUnitario: 1 },
      ],
      totali: { totale: 30 },
    };
    const reconciled = {
      tipoDocumento: 'fattura',
      numeroDocumento: '1490/00',
      fornitore: { nome: 'Agri', piva: 'IT1' },
      righe: [{ descrizione: 'Urea 46', quantita: 10, prezzoUnitario: 2.5 }],
      totali: { totale: 30 },
    };
    const out = pickReconciledExtraction(first, reconciled);
    expect(out.numeroDocumento).toBe('1490/00');
    expect(out.fornitore.piva).toBe('IT1');
    expect(out.righe).toHaveLength(2);
  });

  it('OCR e JSON vision partono insieme, poi reconcile allinea le cifre', async () => {
    let inflight = 0;
    let maxInflight = 0;
    const seen = [];
    const prevFetch = global.fetch;
    global.fetch = async (_url, opts) => {
      const body = JSON.parse(opts.body);
      const blob = JSON.stringify(body);
      const hasInline = blob.includes('inlineData');
      const mime = body.generationConfig && body.generationConfig.responseMimeType;
      expect(body.generationConfig.thinkingConfig.thinkingBudget).toBe(0);
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 40));
      inflight -= 1;
      if (!mime) {
        seen.push('ocr');
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: 'Fattura n. 1490/00 Agri Srl Urea 10 kg prezzo 2.50 Totale 25.00',
                    },
                  ],
                },
              },
            ],
          }),
        };
      }
      if (hasInline) {
        seen.push('extract');
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        tipoDocumento: 'fattura',
                        numeroDocumento: '1493/00',
                        righe: [{ descrizione: 'Urea', quantita: 10, prezzoUnitario: 2.5 }],
                        totali: { totale: 25 },
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        };
      }
      seen.push('reconcile');
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      tipoDocumento: 'fattura',
                      numeroDocumento: '1490/00',
                      righe: [{ descrizione: 'Urea', quantita: 10, prezzoUnitario: 2.5 }],
                      totali: { totale: 25 },
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    };
    try {
      const pages = [{ mimeType: 'image/jpeg', data: MIN_JPEG_B64, indice: 1 }];
      const out = await runTwoPassExtraction('fake-key', pages, {});
      expect(maxInflight).toBeGreaterThanOrEqual(2);
      expect(seen).toEqual(expect.arrayContaining(['ocr', 'extract', 'reconcile']));
      expect(out.transcriptionUsed).toBe(true);
      expect(out.estrazione.numeroDocumento).toBe('1490/00');
      expect(out.timings.parallelWallMs).toBeGreaterThan(0);
    } finally {
      global.fetch = prevFetch;
    }
  });
});
