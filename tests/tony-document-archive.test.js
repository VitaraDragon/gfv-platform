import { describe, it, expect, vi } from 'vitest';
import {
  buildDocumentStoragePath,
  extFromMime,
  base64ToBlob,
  buildDocumentoAcquisitoMetadata,
  resolveArchiveLinkState,
  persistDocumentArchiveAfterRegister,
  formatArchivePersistMessage,
  preparePageForUpload,
  filterDocumentiAcquisiti,
  formatStatoCollegamentoLabel,
  getDataAcquisizioneYmd,
  formatDataAcquisizioneDisplay,
} from '../core/js/tony/document-archive.js';

describe('document-archive paths e mime', () => {
  it('buildDocumentStoragePath tipizzato', () => {
    expect(buildDocumentStoragePath('tid1', 'sess-abc', 2, 'jpg')).toBe(
      'tenants/tid1/documentiAcquisiti/sess-abc/page-2.jpg'
    );
  });

  it('rifiuta path incompleti', () => {
    expect(() => buildDocumentStoragePath('', 's', 1, 'jpg')).toThrow();
    expect(() => buildDocumentStoragePath('t', 's', 0, 'jpg')).toThrow();
  });

  it('extFromMime', () => {
    expect(extFromMime('image/jpeg')).toBe('jpg');
    expect(extFromMime('application/pdf')).toBe('pdf');
    expect(extFromMime('image/webp')).toBe('webp');
  });

  it('base64ToBlob produce Blob con mime', () => {
    var b64 = Buffer.from('hello').toString('base64');
    var blob = base64ToBlob(b64, 'text/plain');
    expect(blob.size).toBe(5);
    expect(blob.type).toBe('text/plain');
  });
});

describe('document-archive metadati', () => {
  it('bolla con prezzo in attesa', () => {
    var meta = buildDocumentoAcquisitoMetadata({
      estrazione: {
        tipoDocumentoConfermato: 'bolla',
        fornitore: { nome: 'Consorzio' },
        numeroDocumento: '1334',
        dataDocumento: '2026-07-10',
        righe: [{ descrizione: 'Urea', quantita: 10, prezzoUnitario: null }],
      },
      movimentoIds: ['m1', 'm2'],
      pagine: [{ indice: 1, storagePath: 'tenants/t/documentiAcquisiti/s/page-1.jpg' }],
      confermatoDa: 'uid1',
    });
    expect(meta.stato).toBe('confirmed');
    expect(meta.prezzoInAttesa).toBe(true);
    expect(meta.statoCollegamento).toBe('prezzo_in_attesa');
    expect(meta.movimentoIds).toEqual(['m1', 'm2']);
    expect(meta.fornitore.nome).toBe('Consorzio');
    expect(meta.pagine.length).toBe(1);
  });

  it('fattura collegata a bolla', () => {
    var link = resolveArchiveLinkState(
      { tipoDocumentoConfermato: 'fattura' },
      { documentoCollegatoId: 'bolla-sess' }
    );
    expect(link.statoCollegamento).toBe('collegata_a_bolla');
    expect(link.prezzoInAttesa).toBe(false);
  });

  it('scontrino = entrata diretta', () => {
    expect(resolveArchiveLinkState({ tipoDocumentoConfermato: 'scontrino' }).statoCollegamento).toBe(
      'entrata_diretta'
    );
  });
});

describe('persistDocumentArchiveAfterRegister', () => {
  it('upload ok → filePending false', async () => {
    var uploaded = [];
    var saved = null;
    var pdfB64 = Buffer.from('%PDF-1.4 ok').toString('base64');
    var res = await persistDocumentArchiveAfterRegister({
      tenantId: 'tid',
      sessionId: 'sess1',
      pages: [{ mimeType: 'application/pdf', data: pdfB64, fileName: 'doc.pdf' }],
      estrazione: { tipoDocumentoConfermato: 'bolla', numeroDocumento: '1', fornitore: { nome: 'X' }, righe: [] },
      movimentoIds: ['m1'],
      uploadBytes: async function (path, blob, meta) {
        uploaded.push({ path: path, size: blob.size, type: meta.contentType });
      },
      saveDocumento: async function (id, data) {
        saved = { id: id, data: data };
      },
    });
    expect(res.ok).toBe(true);
    expect(res.filePending).toBe(false);
    expect(uploaded.length).toBe(1);
    expect(uploaded[0].path).toContain('tenants/tid/documentiAcquisiti/sess1/page-1.');
    expect(saved.id).toBe('sess1');
    expect(saved.data.movimentoIds).toEqual(['m1']);
    expect(saved.data.filePending).toBe(false);
  });

  it('upload fallisce → movimenti ok, filePending true', async () => {
    var saved = null;
    var b64 = Buffer.from('%PDF-1.4').toString('base64');
    var res = await persistDocumentArchiveAfterRegister({
      tenantId: 'tid',
      sessionId: 'sess2',
      pages: [{ mimeType: 'application/pdf', data: b64 }],
      estrazione: { tipoDocumentoConfermato: 'fattura', righe: [] },
      movimentoIds: ['m9'],
      uploadBytes: async function () {
        throw new Error('permission-denied');
      },
      saveDocumento: async function (id, data) {
        saved = data;
      },
    });
    expect(res.filePending).toBe(true);
    expect(res.ok).toBe(false);
    expect(saved.filePending).toBe(true);
    expect(saved.movimentoIds).toEqual(['m9']);
    expect(saved.pagine.length).toBe(0);
  });

  it('senza pagine → filePending + metadati movimenti', async () => {
    var saved = null;
    var res = await persistDocumentArchiveAfterRegister({
      tenantId: 'tid',
      sessionId: 'sess3',
      pages: [],
      estrazione: { tipoDocumentoConfermato: 'scontrino', righe: [] },
      movimentoIds: ['m2'],
      uploadBytes: vi.fn(),
      saveDocumento: async function (_id, data) { saved = data; },
    });
    expect(res.filePending).toBe(true);
    expect(saved.movimentoIds).toEqual(['m2']);
  });

  it('collega bolla quando fattura ha documentoCollegatoId', async () => {
    var linked = null;
    var b64 = Buffer.from('%PDF-1.4').toString('base64');
    await persistDocumentArchiveAfterRegister({
      tenantId: 'tid',
      sessionId: 'fatt-1',
      pages: [{ mimeType: 'application/pdf', data: b64 }],
      estrazione: { tipoDocumentoConfermato: 'fattura', righe: [] },
      movimentoIds: ['m1'],
      documentoCollegatoId: 'bolla-1',
      uploadBytes: async function () {},
      saveDocumento: async function () {},
      linkDocumentoCollegato: async function (id, patch) {
        linked = { id: id, patch: patch };
      },
    });
    expect(linked.id).toBe('bolla-1');
    expect(linked.patch.documentoCollegatoId).toBe('fatt-1');
  });
});

describe('formatArchivePersistMessage', () => {
  it('messaggi utente', () => {
    expect(formatArchivePersistMessage({ filePending: false })).toMatch(/Archivio/);
    expect(formatArchivePersistMessage({ filePending: true })).toMatch(/non è ancora/);
  });
});

describe('preparePageForUpload PDF', () => {
  it('PDF non compresso', async () => {
    var b64 = Buffer.from('%PDF-1.4 test').toString('base64');
    var out = await preparePageForUpload({ mimeType: 'application/pdf', data: b64 });
    expect(out.ext).toBe('pdf');
    expect(out.compressed).toBe(false);
    expect(out.mimeType).toBe('application/pdf');
  });
});

describe('filterDocumentiAcquisiti', () => {
  const DOCS = [
    {
      id: '1',
      tipoDocumentoConfermato: 'bolla',
      fornitore: { nome: 'Consorzio Agrario' },
      numeroDocumento: '1334',
      dataDocumento: '2026-03-15',
      prezzoInAttesa: true,
      statoCollegamento: 'prezzo_in_attesa',
    },
    {
      id: '2',
      tipoDocumentoConfermato: 'fattura',
      fornitore: { nome: 'Agri Spa' },
      numeroDocumento: 'F-99',
      dataDocumento: '2026-03-20',
      prezzoInAttesa: false,
      statoCollegamento: 'collegata_a_bolla',
    },
  ];

  it('filtra per tipo e fornitore', () => {
    expect(filterDocumentiAcquisiti(DOCS, { tipo: 'bolla' })).toHaveLength(1);
    expect(filterDocumentiAcquisiti(DOCS, { fornitore: 'consorzio' })[0].id).toBe('1');
  });

  it('filtra periodo e prezzo in attesa', () => {
    expect(filterDocumentiAcquisiti(DOCS, { dal: '2026-03-18', periodoSu: 'documento' })).toHaveLength(1);
    expect(filterDocumentiAcquisiti(DOCS, { soloPrezzoInAttesa: true })[0].id).toBe('1');
  });

  it('periodo default su data acquisizione', () => {
    var withAcq = [
      { id: 'a', tipoDocumentoConfermato: 'bolla', dataDocumento: '2026-01-01', confermatoIl: '2026-03-20T10:00:00.000Z' },
      { id: 'b', tipoDocumentoConfermato: 'fattura', dataDocumento: '2026-03-25', confermatoIl: '2026-03-10T10:00:00.000Z' },
    ];
    expect(filterDocumentiAcquisiti(withAcq, { dal: '2026-03-15' }).map(function (d) { return d.id; })).toEqual(['a']);
    expect(filterDocumentiAcquisiti(withAcq, { dal: '2026-03-15', periodoSu: 'documento' }).map(function (d) { return d.id; })).toEqual(['b']);
  });

  it('formatDataAcquisizioneDisplay e getDataAcquisizioneYmd', () => {
    expect(getDataAcquisizioneYmd({ confermatoIl: '2026-07-21T08:30:00.000Z' })).toBe('2026-07-21');
    expect(formatDataAcquisizioneDisplay({ confermatoIl: '2026-07-21T08:30:00.000Z' })).toMatch(/21\/07\/2026/);
  });

  it('formatStatoCollegamentoLabel', () => {
    expect(formatStatoCollegamentoLabel({ statoCollegamento: 'prezzo_in_attesa' })).toMatch(/Prezzo/);
    expect(formatStatoCollegamentoLabel({ filePending: true })).toMatch(/File/);
  });
});
