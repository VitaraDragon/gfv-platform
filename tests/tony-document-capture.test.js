import { describe, it, expect } from 'vitest';
import {
  canUseTonyDocumentCapture,
  isTonyManagerOrAdmin,
  formatDocumentExtractionSummary,
} from '../core/js/tony/document-capture.js';

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
});
