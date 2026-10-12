/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import { pianoGate, eseguiGate } from '../core/js/accettazione-legale-gate.js';

const config = {
  DOCUMENTI_LEGALI: {
    'termini-b2b': { versione: 'termini-b2b-2026-03-01', url: 'https://example.com/termini' },
    privacy: { versione: 'privacy-2026-03-01', url: 'https://example.com/privacy' },
    dpa: { versione: 'dpa-2026-03-01', url: 'https://example.com/dpa' },
    'informativa-lavoratori': {
      versione: 'informativa-lavoratori-2026-03-01',
      url: 'https://example.com/lavoratori'
    }
  }
};

describe('pianoGate', () => {
  it('flag spento: nessuna chiamata e nessuna UI', async () => {
    const leggiStato = vi.fn();
    const mostra = vi.fn();
    const piano = pianoGate({
      attiva: false,
      configOk: true,
      ruoli: ['amministratore'],
      accettazioni: [],
      config
    });
    expect(piano).toEqual({ chiamare: false, mostra: false, canale: '', ruolo: '', mancanti: [] });
    const esito = await eseguiGate({
      attiva: false,
      configOk: true,
      ruoli: ['amministratore'],
      config,
      leggiStato,
      mostra
    });
    expect(esito).toEqual({ mostrato: false });
    expect(leggiStato).not.toHaveBeenCalled();
    expect(mostra).not.toHaveBeenCalled();
  });

  it('admin senza accettazioni: mostra termini, privacy e dpa', () => {
    const piano = pianoGate({
      attiva: true,
      configOk: true,
      ruoli: ['amministratore'],
      accettazioni: [],
      config
    });
    expect(piano.canale).toBe('registrazione');
    expect(piano.mostra).toBe(true);
    expect(piano.mancanti.map((riga) => riga.tipo)).toEqual(['termini-b2b', 'privacy', 'dpa']);
  });

  it('operaio: solo informativa lavoratori', () => {
    const piano = pianoGate({
      attiva: true,
      configOk: true,
      ruoli: ['operaio'],
      accettazioni: [],
      config
    });
    expect(piano.canale).toBe('invito');
    expect(piano.mancanti.map((riga) => riga.tipo)).toEqual(['informativa-lavoratori']);
  });

  it('stessa versione: non mostra', async () => {
    const mostra = vi.fn();
    const esito = await eseguiGate({
      attiva: true,
      configOk: true,
      ruoli: ['operaio'],
      config,
      leggiStato: async () => [{
        tipo: 'informativa-lavoratori',
        versione: 'informativa-lavoratori-2026-03-01'
      }],
      mostra
    });
    expect(esito).toEqual({ mostrato: false });
    expect(mostra).not.toHaveBeenCalled();
  });
});
