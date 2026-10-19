import { describe, expect, it } from 'vitest';
import { scegliSuggerimentoRapido } from '../core/js/field-suggerimento-lavoro.js';

function lavoro(id, stato, label) {
  return { id, label: label || id, raw: { stato } };
}

describe('scegliSuggerimentoRapido', () => {
  it('un completato in testa non vince: sceglie il primo in corso', () => {
    const works = [
      lavoro('c', 'completato', 'A completato'),
      lavoro('z', 'assegnato', 'Z assegnato'),
      lavoro('i', 'in_corso', 'M in corso'),
    ];
    expect(scegliSuggerimentoRapido(works, {}).id).toBe('i');
  });

  it('solo lavori chiusi o fermi restituisce null', () => {
    const works = [
      lavoro('c1', 'completato'),
      lavoro('c2', 'completato_da_approvare'),
      lavoro('s', 'sospeso'),
      lavoro('a', 'annullato'),
    ];
    expect(scegliSuggerimentoRapido(works, { selezionatoId: 'c1' })).toBeNull();
    expect(scegliSuggerimentoRapido([], {})).toBeNull();
  });

  it('il selezionato attivo vince anche se non è il primo', () => {
    const works = [
      lavoro('c', 'completato', 'A'),
      lavoro('i', 'in_corso', 'B'),
      lavoro('s', 'assegnato', 'C'),
    ];
    expect(scegliSuggerimentoRapido(works, { selezionatoId: 's' }).id).toBe('s');
    expect(scegliSuggerimentoRapido(works, { selezionatoId: 'i' }).id).toBe('i');
  });

  it('legge lo stato anche senza raw', () => {
    const works = [
      { id: 'c', label: 'Chiuso', stato: 'completato' },
      { id: 'a', label: 'Assegnato', stato: 'assegnato' },
    ];
    expect(scegliSuggerimentoRapido(works, {}).id).toBe('a');
  });
});
