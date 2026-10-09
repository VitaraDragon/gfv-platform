import { describe, it, expect } from 'vitest';
import {
  righeGiornoDopoEliminazione,
  righeGiornoDopoSalvataggio,
  totaleMinutiGiorno,
} from '../core/js/tony/tony-riepilogo-giorno.js';

const righe = [
  { id: 'a', oreNette: 0.5, stato: 'da_validare' },
  { id: 'b', oreNette: 1, stato: 'da_validare' },
  { id: 'c', oreNette: 2, stato: 'rifiutate' },
];

describe('riepilogo ore del giorno', () => {
  it('dopo eliminazione toglie la riga e il totale non conta le rifiutate', () => {
    const next = righeGiornoDopoEliminazione(righe, 'a');
    expect(next.map((r) => r.id)).toEqual(['b', 'c']);
    expect(totaleMinutiGiorno(next)).toBe(60);
    expect(righe).toHaveLength(3);
    expect(righe[0].id).toBe('a');
  });

  it('se la riga non c’è l’elenco resta com’è', () => {
    const next = righeGiornoDopoEliminazione(righe, 'manca');
    expect(next).toHaveLength(3);
    expect(next).not.toBe(righe);
    expect(totaleMinutiGiorno(next)).toBe(90);
  });

  it('dopo il salvataggio aggiunge la riga', () => {
    const next = righeGiornoDopoSalvataggio(righe, {
      id: 'd',
      oreNette: 0.5,
      stato: 'da_validare',
    });
    expect(next.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(totaleMinutiGiorno(next)).toBe(120);
    expect(righe).toHaveLength(3);
  });

  it('se l’id c’è già sostituisce quella riga', () => {
    const next = righeGiornoDopoSalvataggio(righe, {
      id: 'b',
      oreNette: 1.5,
      stato: 'da_validare',
    });
    expect(next).toHaveLength(3);
    expect(next[1].oreNette).toBe(1.5);
    expect(righe[1].oreNette).toBe(1);
    expect(totaleMinutiGiorno(next)).toBe(120);
  });

  it('totale 0 se non ci sono righe o sono tutte rifiutate', () => {
    expect(totaleMinutiGiorno([])).toBe(0);
    expect(totaleMinutiGiorno(null)).toBe(0);
    expect(totaleMinutiGiorno([{ id: 'c', oreNette: 2, stato: 'rifiutate' }])).toBe(0);
    expect(totaleMinutiGiorno([{ id: 'z', oreNette: 0, stato: 'da_validare' }])).toBe(0);
  });
});
