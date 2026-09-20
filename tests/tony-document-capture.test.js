import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canUseTonyDocumentCapture,
  isTonyManagerOrAdmin,
  formatDocumentExtractionSummary,
  resolveDocumentMime,
  isHeicLikeDocumentFile,
  convertRasterFileToJpeg,
  fileToDocumentPage,
} from '../core/js/tony/document-capture.js';

const uiSrc = readFileSync(join(process.cwd(), 'core/js/tony/ui.js'), 'utf8');

describe('tony-document-capture client', () => {
  it('isTonyManagerOrAdmin riconosce manager', () => {
    expect(isTonyManagerOrAdmin(['operaio', 'manager'])).toBe(true);
    expect(isTonyManagerOrAdmin(['Amministratore'])).toBe(true);
    expect(isTonyManagerOrAdmin(['operaio'])).toBe(false);
  });

  it('canUseTonyDocumentCapture richiede magazzino e manager', () => {
    const ok = canUseTonyDocumentCapture({
      freemiumBlocked: false,
      moduliAttivi: ['tony', 'magazzino'],
      ruoli: ['manager'],
    });
    expect(ok.ok).toBe(true);

    const noMod = canUseTonyDocumentCapture({
      freemiumBlocked: false,
      moduliAttivi: ['tony'],
      ruoli: ['manager'],
    });
    expect(noMod.ok).toBe(false);

    const noRole = canUseTonyDocumentCapture({
      freemiumBlocked: false,
      moduliAttivi: ['magazzino'],
      ruoli: ['operaio'],
    });
    expect(noRole.ok).toBe(false);
  });

  it('formatDocumentExtractionSummary compone riepilogo', () => {
    const text = formatDocumentExtractionSummary({
      tipoDocumento: 'bolla',
      fornitore: { nome: 'Agri Nord' },
      numeroDocumento: 'DDT 12',
      dataDocumento: '2026-07-01',
      righe: [{ descrizione: 'Urea 46%', quantita: 10, unita: 'kg' }],
    });
    expect(text).toMatch(/Bolla/i);
    expect(text).toMatch(/Agri Nord/);
    expect(text).toMatch(/Urea/);
  });

  it('resolveDocumentMime accetta xml anche senza MIME browser', () => {
    expect(resolveDocumentMime({ type: '', name: 'IT01234567890_ABC.xml' })).toBe('application/xml');
    expect(resolveDocumentMime({ type: 'text/xml', name: 'fattura.xml' })).toBe('application/xml');
    expect(resolveDocumentMime({ type: 'image/jpeg', name: 'bolla.jpg' })).toBe('image/jpeg');
  });

  it('isHeicLikeDocumentFile riconosce MIME e estensione iPhone', () => {
    expect(isHeicLikeDocumentFile({ type: 'image/heic', name: 'IMG_1.HEIC' })).toBe(true);
    expect(isHeicLikeDocumentFile({ type: 'image/heif', name: 'foto.heif' })).toBe(true);
    expect(isHeicLikeDocumentFile({ type: '', name: 'IMG_1234.HEIC' })).toBe(true);
    expect(isHeicLikeDocumentFile({ type: 'image/jpeg', name: 'bolla.jpg' })).toBe(false);
    expect(resolveDocumentMime({ type: 'image/heic', name: 'IMG_1.HEIC' })).toBe('image/heic');
    expect(resolveDocumentMime({ type: '', name: 'IMG_1.heic' })).toBe('image/heic');
  });

  it('il file picker non forza la fotocamera: scatto o galleria, HEIC in accept', () => {
    expect(uiSrc).toMatch(/id="tony-doc-file-input"/);
    expect(uiSrc).not.toMatch(/capture=/);
    expect(uiSrc).toMatch(/\.heic/);
    expect(uiSrc).toMatch(/scegli dalla galleria/i);
  });

  it('convertRasterFileToJpeg riduce il lato lungo e restituisce JPEG', async () => {
    const heic = new File([new Uint8Array([1, 2, 3])], 'IMG_9.HEIC', { type: 'image/heic' });
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const jpegBlob = new Blob([jpegBytes], { type: 'image/jpeg' });
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => {} }),
      toBlob: (cb) => cb(jpegBlob),
    };
    const out = await convertRasterFileToJpeg(heic, {
      createImageBitmap: async () => ({ width: 4032, height: 3024, close() {} }),
      document: { createElement: (tag) => (tag === 'canvas' ? canvas : {}) },
    });
    expect(out.type).toBe('image/jpeg');
    expect(out.name).toMatch(/\.jpg$/i);
    expect(canvas.width).toBe(2048);
    expect(canvas.height).toBe(1536);
  });

  it('convertRasterFileToJpeg se il browser non decodifica HEIC spiega di scattare o usare JPEG', async () => {
    const heic = new File([new Uint8Array([1])], 'foto.heic', { type: 'image/heic' });
    await expect(convertRasterFileToJpeg(heic, {
      createImageBitmap: async () => { throw new Error('unsupported'); },
    })).rejects.toThrow(/HEIC/i);
  });

  it('fileToDocumentPage converte HEIC in JPEG prima della lettura', async () => {
    const heic = new File([new Uint8Array([9, 9, 9])], 'IMG_2.HEIC', { type: 'image/heic' });
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'IMG_2.jpg', { type: 'image/jpeg' });
    const page = await fileToDocumentPage(heic, {
      convertRasterFileToJpeg: async () => jpeg,
    });
    expect(page.mimeType).toBe('image/jpeg');
    expect(page.fileName).toMatch(/jpg/i);
    expect(page.data.length).toBeGreaterThan(0);
  });

  it('fileToDocumentPage rifiuta formati non immagine/pdf con messaggio galleria', async () => {
    const bin = new File([new Uint8Array([1])], 'note.txt', { type: 'text/plain' });
    await expect(fileToDocumentPage(bin)).rejects.toThrow(/galleria/i);
  });

  it('formatDocumentExtractionSummary su fattura XML parla come una foto (stessa idea 📷)', () => {
    const text = formatDocumentExtractionSummary({
      tipoDocumento: 'fattura',
      fonteEstrazione: 'fatturapa',
      fornitore: { nome: 'Agri Nord' },
      numeroDocumento: '695/V0',
      righe: [{ descrizione: 'Urea' }],
    });
    expect(text).toMatch(/Fattura/i);
    expect(text).toMatch(/Agri Nord/);
    expect(text).not.toMatch(/XML/i);
  });
});
