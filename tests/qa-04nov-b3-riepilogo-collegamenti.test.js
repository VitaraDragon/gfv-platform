import { describe, expect, it } from 'vitest';
import {
  haCollegamenti,
  riepilogoCollegamenti
} from '../shared/js/terreno-archivio.js';

describe('B3 — riepilogo collegamenti terreno', () => {
  it('mostra un conteggio vero quando disponibile', () => {
    expect(riepilogoCollegamenti({ attivita: 12 })).toContain('12 attività del diario');
  });

  it('con una query limitata segnala la presenza senza inventare il numero 1', () => {
    const collegamenti = { attivita: 0, attivitaPresenti: true };
    const testo = riepilogoCollegamenti(collegamenti);
    expect(haCollegamenti(collegamenti)).toBe(true);
    expect(testo).toContain('attività del diario');
    expect(testo).not.toContain('1 attività');
  });

  it('mantiene esatto il conteggio dei lavori', () => {
    expect(riepilogoCollegamenti({ lavori: 3 })).toContain('3 lavori');
  });
});
