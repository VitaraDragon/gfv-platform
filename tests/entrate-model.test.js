/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  Entrata,
  calcolaImportoVendita,
  totaliEntrate,
  filtraEntratePerPeriodo,
  filtraEntrate
} from '../core/models/Entrata.js';

describe('Entrata model', () => {
  it('valida data e importo > 0', () => {
    const bad = new Entrata({ tipo: 'altro', importo: 0 });
    expect(bad.validate().valid).toBe(false);
    expect(bad.validate().errors.join(' ')).toMatch(/data/i);

    const zero = new Entrata({ data: '2026-03-01', tipo: 'altro', importo: 0 });
    expect(zero.validate().valid).toBe(false);
    expect(zero.validate().errors.join(' ')).toMatch(/importo/i);

    const ok = new Entrata({ data: '2026-03-01', tipo: 'pac_contributo', importo: 120.5 });
    expect(ok.validate()).toEqual({ valid: true, errors: [] });
  });

  it('calcola importo vendita e consente sovrascrittura manuale', () => {
    expect(calcolaImportoVendita(10, 2.5)).toBe(25);

    const auto = new Entrata({
      data: '2026-01-15',
      tipo: 'vendita_prodotto',
      quantita: 100,
      prezzoUnitario: 1.2,
      unita: 'kg'
    });
    expect(auto.validate().valid).toBe(true);
    expect(auto.importo).toBe(120);

    const manuale = new Entrata({
      data: '2026-01-15',
      tipo: 'vendita_prodotto',
      quantita: 100,
      prezzoUnitario: 1.2,
      unita: 'kg',
      importo: 99.9
    });
    expect(manuale.validate().valid).toBe(true);
    expect(manuale.importo).toBe(99.9);
  });

  it('totali incassate e da incassare', () => {
    const t = totaliEntrate([
      { importo: 100, incassato: true },
      { importo: 40, incassato: false },
      { importo: 10, incassato: false },
      { importo: -5, incassato: true }
    ]);
    expect(t).toEqual({ registrate: 150, incassate: 100, daIncassare: 50 });
  });

  it('acconto richiede acquirente e conferimento, senza quantità', () => {
    const bad = new Entrata({ data: '2026-03-01', tipo: 'acconto', importo: 100 });
    expect(bad.validate().valid).toBe(false);
    const ok = new Entrata({
      data: '2026-03-01',
      tipo: 'acconto',
      importo: 4200,
      acquirenteId: 'a1',
      conferimentoId: 'c1',
      incassato: true
    });
    expect(ok.validate().valid).toBe(true);
    expect(ok.toFirestore().quantita).toBeNull();
  });

  it('filtra per periodo, tipo e coltura', () => {
    const items = [
      { data: '2025-11-10', tipo: 'altro', importo: 1, coltura: '' },
      { data: '2025-11-11', tipo: 'vendita_prodotto', importo: 2, coltura: 'Grano duro' },
      { data: '2026-03-01', tipo: 'vendita_prodotto', importo: 3, coltura: 'Uva' },
      { data: '2026-11-11', tipo: 'pac_contributo', importo: 4, coltura: '' }
    ];
    const periodo = filtraEntratePerPeriodo(items, '2025-11-11', '2026-11-10');
    expect(periodo.map((i) => i.data)).toEqual(['2025-11-11', '2026-03-01']);

    const grano = filtraEntrate(items, {
      start: '2025-01-01',
      end: '2026-12-31',
      tipo: 'vendita_prodotto',
      coltura: 'grano'
    });
    expect(grano).toHaveLength(1);
    expect(grano[0].coltura).toBe('Grano duro');
  });
});
