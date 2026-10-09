import { describe, it, expect } from 'vitest';
import {
  riepilogoGiornoDopoEliminazione,
  riepilogoGiornoDopoSalvataggio,
} from '../core/js/tony/tony-riepilogo-giorno.js';

const righe = [
  { id: 'a', oreNette: 0.5, stato: 'da_validare' },
  { id: 'b', oreNette: 1, stato: 'da_validare' },
  { id: 'c', oreNette: 2, stato: 'rifiutate' },
];

describe('riepilogo ore del giorno', () => {
  it('dopo eliminazione toglie la riga e ricalcola ore e minuti', () => {
    const out = riepilogoGiornoDopoEliminazione(righe, 'a');
    expect(out.trovato).toBe(true);
    expect(out.righe.map((r) => r.id)).toEqual(['b', 'c']);
    expect(out.totaleOre).toBe(1);
    expect(out.totaleMinuti).toBe(60);
    expect(righe).toHaveLength(3);
  });

  it('se la riga non c’è il riepilogo resta com’è', () => {
    const out = riepilogoGiornoDopoEliminazione(righe, 'manca');
    expect(out.trovato).toBe(false);
    expect(out.righe).toHaveLength(3);
    expect(out.totaleOre).toBe(1.5);
    expect(out.totaleMinuti).toBe(90);
  });

  it('dopo il salvataggio aggiunge la riga e aggiorna il totale', () => {
    const out = riepilogoGiornoDopoSalvataggio(righe, {
      id: 'd',
      oreNette: 0.5,
      stato: 'da_validare',
    });
    expect(out.righe.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(out.totaleOre).toBe(2);
    expect(out.totaleMinuti).toBe(120);
  });

  it('se l’id c’è già aggiorna quella riga', () => {
    const out = riepilogoGiornoDopoSalvataggio(righe, {
      id: 'b',
      oreNette: 1.5,
      stato: 'da_validare',
    });
    expect(out.righe).toHaveLength(3);
    expect(out.righe[1].oreNette).toBe(1.5);
    expect(out.totaleMinuti).toBe(120);
  });
});
