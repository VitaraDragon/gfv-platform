import { describe, it, expect } from 'vitest';
import {
  tryTonyActivityPatterns,
  extractHours,
  resolveRelativeDate,
  resolveTerreno,
} from '../functions/tony-activity-patterns.js';
import { geminiStreamUrl } from '../functions/tony-gemini-api.js';

describe('tony-activity-patterns', () => {
  const ctx = {
    azienda: {
      terreni: [
        { id: 't1', nome: 'Pinot' },
        { id: 't2', nome: 'Sangiovese Casetti' },
      ],
      tipiLavoro: [{ nome: 'Trinciatura' }, { nome: 'Potatura' }],
    },
  };

  it('match trinciatura + ore + terreno + ieri (senza manodopera → diario)', () => {
    const hit = tryTonyActivityPatterns({
      message: 'ho trinciato 6 ore nel pinot ieri',
      ctx,
    });
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('activity_pattern');
    expect(hit.command.type).toBe('INJECT_FORM_DATA');
    expect(hit.command.formId).toBe('attivita-form');
    expect(hit.command.formData['attivita-ore']).toBe('6');
    expect(hit.command.formData['attivita-tipo-lavoro']).toBe('Trinciatura');
    expect(hit.command.formData['attivita-terreno']).toBe('t1');
    expect(hit.command.formData['attivita-data']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('con manodopera attivo → messaggio informativo, nessuna navigazione (manager)', () => {
    const hit = tryTonyActivityPatterns({
      message: 'ho trinciato 6 ore nel pinot ieri',
      ctx: {
        ...ctx,
        dashboard: { moduli_attivi: ['tony', 'manodopera'] },
      },
    });
    expect(hit).not.toBeNull();
    expect(hit.id).toBe('activity_pattern_manodopera_info');
    expect(hit.command).toBeNull();
    expect(hit.text).toMatch(/manodopera/i);
    expect(hit.text).toMatch(/operai e caposquadra/i);
    expect(hit.text).not.toMatch(/Segna ore/i);
  });

  it('null se terreno ambiguo', () => {
    const hit = tryTonyActivityPatterns({
      message: 'segna 4 ore di potatura nel vigna pinot e pinot giallo',
      ctx: {
        azienda: {
          terreni: [
            { id: 'a', nome: 'Vigna Pinot' },
            { id: 'b', nome: 'Pinot Giallo' },
          ],
          tipiLavoro: [{ nome: 'Potatura' }],
        },
      },
    });
    expect(hit).toBeNull();
  });

  it('extractHours accetta decimali', () => {
    expect(extractHours('lavorato 7,5 ore')).toBe(7.5);
  });

  it('resolveRelativeDate domani', () => {
    const iso = resolveRelativeDate('domani potatura');
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('resolveTerreno match unico', () => {
    const r = resolveTerreno('nel sangiovese casetti', ctx.azienda.terreni);
    expect(r.ambiguous).toBe(false);
    expect(r.id).toBe('t2');
  });
});

describe('tony-gemini-api geminiStreamUrl', () => {
  it('converte generateContent in streamGenerateContent con alt=sse', () => {
    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=abc';
    expect(geminiStreamUrl(url)).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=abc&alt=sse'
    );
  });
});
