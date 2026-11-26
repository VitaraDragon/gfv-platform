/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  calcolaIva,
  mergeIvaConfig,
  normalizeAliquote,
  normalizeCompensazione,
  newCategoriaIvaId,
  ripristinaIvaDefaults,
  suggerisciAliquotaPerTipo,
  suggerisciAliquotaContoTerzi,
  totaliIvaEntrate,
  formatImportoConIva,
  ALIQUOTE_DEFAULT,
  COMPENSAZIONE_DEFAULT
} from '../core/models/IvaConfig.js';
import { Entrata, totaliEntrate } from '../core/models/Entrata.js';

describe('calcolaIva', () => {
  it('calcola IVA e totale a 2 decimali', () => {
    expect(calcolaIva(1000, 10)).toEqual({ importoIva: 100, importoTotale: 1100 });
    expect(calcolaIva(100, 22)).toEqual({ importoIva: 22, importoTotale: 122 });
    expect(calcolaIva(33.33, 4)).toEqual({ importoIva: 1.33, importoTotale: 34.66 });
  });

  it('esente e fuori campo → IVA 0', () => {
    expect(calcolaIva(500, 0)).toEqual({ importoIva: 0, importoTotale: 500 });
    expect(calcolaIva(500, null)).toEqual({ importoIva: 0, importoTotale: 500 });
  });

  it('imponibile non numerico → null', () => {
    expect(calcolaIva(null, 10)).toBeNull();
    expect(calcolaIva('x', 10)).toBeNull();
  });
});

describe('mergeIvaConfig / lista azienda', () => {
  it('senza documento usa default ordinario e tutte le categorie', () => {
    const cfg = mergeIvaConfig({});
    expect(cfg.regime).toBe('ordinario');
    expect(cfg.aliquote.length).toBe(ALIQUOTE_DEFAULT.length);
    expect(cfg.aliquote.find((a) => a.id === 'uva_da_vino').aliquota).toBe(10);
    expect(cfg.aliquote.find((a) => a.id === 'contributi_pac').natura).toBe('fuori_campo');
    expect(cfg.compensazione.find((c) => c.id === 'vino').percentuale).toBe(12.3);
  });

  it('categoria personalizzata salvata e riletta', () => {
    const id = newCategoriaIvaId('Nocciole', ALIQUOTE_DEFAULT.map((a) => a.id));
    const saved = [
      ...ALIQUOTE_DEFAULT.map((r) => ({ ...r })),
      { id, label: 'Nocciole', aliquota: 4, natura: 'imponibile', tipo: 'entrata' }
    ];
    const cfg = mergeIvaConfig({ aliquote: saved });
    const row = cfg.aliquote.find((a) => a.id === id);
    expect(row).toBeTruthy();
    expect(row.label).toBe('Nocciole');
    expect(row.aliquota).toBe(4);
    expect(normalizeAliquote(cfg.aliquote).find((a) => a.id === id)?.aliquota).toBe(4);
  });

  it('default tolto non ricompare; override restano sulla lista azienda', () => {
    const senzaVino = ALIQUOTE_DEFAULT.filter((a) => a.id !== 'vino').map((r) =>
      r.id === 'frutta' ? { ...r, aliquota: 5 } : { ...r }
    );
    const cfg = mergeIvaConfig({ regime: 'speciale_agricolo', aliquote: senzaVino });
    expect(cfg.regime).toBe('speciale_agricolo');
    expect(cfg.aliquote.find((a) => a.id === 'vino')).toBeUndefined();
    expect(cfg.aliquote.find((a) => a.id === 'frutta').aliquota).toBe(5);
    expect(cfg.aliquote.length).toBe(ALIQUOTE_DEFAULT.length - 1);
  });

  it('ripristina valori predefiniti', () => {
    const d = ripristinaIvaDefaults();
    expect(d.aliquote).toHaveLength(ALIQUOTE_DEFAULT.length);
    expect(d.compensazione).toHaveLength(COMPENSAZIONE_DEFAULT.length);
    expect(d.aliquote.find((a) => a.id === 'vino').aliquota).toBe(22);
  });

  it('compensazione: riga tolta non ricompare, personalizzata resta', () => {
    const rows = [
      { id: 'cereali', label: 'Cereali', percentuale: 4 },
      { id: 'nocciole_comp', label: 'Nocciole', percentuale: 2 }
    ];
    const n = normalizeCompensazione(rows);
    expect(n).toHaveLength(2);
    expect(n.find((c) => c.id === 'vino')).toBeUndefined();
    expect(n.find((c) => c.id === 'nocciole_comp').percentuale).toBe(2);
  });
});

describe('suggerisciAliquotaPerTipo', () => {
  it('PAC → fuori campo', () => {
    const s = suggerisciAliquotaPerTipo({ tipo: 'pac_contributo' });
    expect(s.categoriaIva).toBe('contributi_pac');
    expect(s.naturaIva).toBe('fuori_campo');
  });

  it('uva / frutta / cereali / vino', () => {
    expect(suggerisciAliquotaPerTipo({ tipo: 'acconto', categoriaProdotto: 'uva' }).aliquotaIva).toBe(10);
    expect(suggerisciAliquotaPerTipo({ tipo: 'vendita_prodotto', categoriaProdotto: 'frutta' }).aliquotaIva).toBe(4);
    expect(suggerisciAliquotaPerTipo({ tipo: 'vendita_prodotto', categoriaProdotto: 'seminativo' }).aliquotaIva).toBe(4);
    expect(suggerisciAliquotaPerTipo({ tipo: 'vendita_prodotto', coltura: 'vino rosso' }).aliquotaIva).toBe(22);
  });

  it('altro senza indizio → null', () => {
    expect(suggerisciAliquotaPerTipo({ tipo: 'altro' })).toBeNull();
  });

  it('suggerimento assente se categoria tolta dall\'azienda', () => {
    const senzaUva = ALIQUOTE_DEFAULT.filter((a) => a.id !== 'uva_da_vino');
    expect(
      suggerisciAliquotaPerTipo({
        tipo: 'acconto',
        categoriaProdotto: 'uva',
        aliquote: senzaUva
      })
    ).toBeNull();
    expect(
      suggerisciAliquotaPerTipo({
        tipo: 'pac_contributo',
        aliquote: ALIQUOTE_DEFAULT.filter((a) => a.id !== 'contributi_pac')
      })
    ).toBeNull();
  });
});

describe('entrate con categoria tolta', () => {
  it('mostrano comunque aliquota e IVA salvate', () => {
    const e = new Entrata({
      data: '2026-03-01',
      tipo: 'altro',
      importo: 1000,
      categoriaIva: 'nocciole_custom',
      aliquotaIva: 4,
      naturaIva: 'imponibile'
    });
    expect(e.validate().valid).toBe(true);
    expect(e.importoIva).toBe(40);
    expect(formatImportoConIva(e, (n) => `${n}`)).toContain('+ IVA 40');
  });
});

describe('suggerisciAliquotaContoTerzi', () => {
  it('impresa 10%, privato 22%, sconosciuto 10% con nota', () => {
    expect(suggerisciAliquotaContoTerzi('impresa_agricola').aliquotaIva).toBe(10);
    expect(suggerisciAliquotaContoTerzi('privato').aliquotaIva).toBe(22);
    const unk = suggerisciAliquotaContoTerzi(null);
    expect(unk.aliquotaIva).toBe(10);
    expect(unk.nota).toMatch(/22%/);
  });
});

describe('KPI IVA con entrate legacy senza aliquota', () => {
  it('totali imponibili invariati; IVA solo dove presente', () => {
    const items = [
      { importo: 1000, incassato: true, aliquotaIva: 10, importoIva: 100 },
      { importo: 400, incassato: false },
      { importo: 200, incassato: true, naturaIva: 'esente', aliquotaIva: 0, importoIva: 0 }
    ];
    expect(totaliEntrate(items)).toEqual({
      registrate: 1600,
      incassate: 1200,
      daIncassare: 400
    });
    expect(totaliIvaEntrate(items)).toEqual({
      ivaRegistrate: 100,
      ivaIncassate: 100,
      ivaDaIncassare: 0
    });
  });

  it('Entrata legacy senza aliquota: toFirestore lascia IVA null', () => {
    const e = new Entrata({ data: '2026-03-01', tipo: 'altro', importo: 50 });
    expect(e.validate().valid).toBe(true);
    const fs = e.toFirestore();
    expect(fs.importo).toBe(50);
    expect(fs.aliquotaIva).toBeNull();
    expect(fs.importoIva).toBeNull();
  });

  it('Entrata con aliquota sincronizza IVA', () => {
    const e = new Entrata({
      data: '2026-03-01',
      tipo: 'acconto',
      importo: 1000,
      acquirenteId: 'a1',
      conferimentoId: 'c1',
      categoriaIva: 'uva_da_vino',
      aliquotaIva: 10,
      naturaIva: 'imponibile'
    });
    expect(e.validate().valid).toBe(true);
    expect(e.importoIva).toBe(100);
    expect(e.importoTotale).toBe(1100);
  });
});

describe('formatImportoConIva', () => {
  const euro = (n) => n.toFixed(2).replace('.', ',') + ' €';
  it('legacy senza aliquota = solo imponibile', () => {
    expect(formatImportoConIva({ importo: 1000 }, euro)).toBe('1000,00 €');
  });
  it('con IVA', () => {
    expect(formatImportoConIva({ importo: 1000, aliquotaIva: 10, importoIva: 100 }, euro)).toBe(
      '1000,00 € (+ IVA 100,00 €)'
    );
  });
  it('esente / fuori campo', () => {
    expect(formatImportoConIva({ importo: 100, naturaIva: 'esente' }, euro)).toBe('100,00 € (esente)');
    expect(formatImportoConIva({ importo: 100, naturaIva: 'fuori_campo' }, euro)).toBe(
      '100,00 € (fuori campo IVA)'
    );
  });
});
