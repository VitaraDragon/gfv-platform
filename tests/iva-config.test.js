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
  defaultAliquotaForCategoriaId,
  resolveAliquotaAfterNaturaChange,
  categoriaProdottoDaRaccoltaModulo,
  suggerisciAliquotaPerTipo,
  risolviIvaEntrataInLettura,
  inferisciTipoClienteContoTerzi,
  suggerisciAliquotaContoTerzi,
  resolveAggiornamentoAliquotaForm,
  totaliIvaEntrate,
  formatImportoConIva,
  ALIQUOTE_DEFAULT,
  COMPENSAZIONE_DEFAULT
} from '../core/models/IvaConfig.js';
import { Entrata, totaliEntrate } from '../core/models/Entrata.js';

describe('resolveAliquotaAfterNaturaChange', () => {
  it('Esente/Fuori campo: disabilita, svuota e ricorda il valore corrente', () => {
    const toEsente = resolveAliquotaAfterNaturaChange({
      natura: 'esente',
      currentValue: 10,
      rememberedAliquota: null,
      defaultAliquota: 10
    });
    expect(toEsente).toEqual({
      disabled: true,
      value: '',
      placeholder: 'Esente',
      rememberedAliquota: 10
    });
    const toFuori = resolveAliquotaAfterNaturaChange({
      natura: 'fuori_campo',
      currentValue: 4,
      rememberedAliquota: 22,
      defaultAliquota: 4
    });
    expect(toFuori.disabled).toBe(true);
    expect(toFuori.value).toBe('');
    expect(toFuori.placeholder).toBe('Fuori campo');
    expect(toFuori.rememberedAliquota).toBe(4);
  });

  it('tornando a Imponibile ripristina il valore ricordato', () => {
    const next = resolveAliquotaAfterNaturaChange({
      natura: 'imponibile',
      currentValue: '',
      rememberedAliquota: 10,
      defaultAliquota: 4
    });
    expect(next).toEqual({
      disabled: false,
      value: '10',
      placeholder: '',
      rememberedAliquota: 10
    });
  });

  it('tornando a Imponibile senza ricordo usa il predefinito categoria, altrimenti 0', () => {
    expect(
      resolveAliquotaAfterNaturaChange({
        natura: 'imponibile',
        rememberedAliquota: null,
        defaultAliquota: 22
      }).value
    ).toBe('22');
    expect(
      resolveAliquotaAfterNaturaChange({
        natura: 'imponibile',
        rememberedAliquota: null,
        defaultAliquota: null
      }).value
    ).toBe('0');
    expect(defaultAliquotaForCategoriaId('uva_da_vino')).toBe(10);
    expect(defaultAliquotaForCategoriaId('affitto_terreni')).toBeNull();
  });
});

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

  it('raccoltaModulo orticole/frutta/seminativo/vendemmia', () => {
    expect(categoriaProdottoDaRaccoltaModulo('orticole')).toBe('ortaggi');
    expect(suggerisciAliquotaPerTipo({ tipo: 'vendita_prodotto', raccoltaModulo: 'orticole' }).aliquotaIva).toBe(4);
    expect(suggerisciAliquotaPerTipo({ tipo: 'vendita_prodotto', raccoltaModulo: 'orticole' }).categoriaIva).toBe(
      'ortaggi'
    );
    expect(
      suggerisciAliquotaPerTipo({ tipo: 'vendita_prodotto', raccoltaModulo: 'frutta', coltura: 'Redhaven' })
        .categoriaIva
    ).toBe('frutta');
    expect(suggerisciAliquotaPerTipo({ tipo: 'vendita_prodotto', coltura: 'pesche' }).categoriaIva).toBe('frutta');
    expect(suggerisciAliquotaPerTipo({ tipo: 'vendita_prodotto', raccoltaModulo: 'seminativo' }).categoriaIva).toBe(
      'cereali'
    );
    expect(suggerisciAliquotaPerTipo({ tipo: 'vendita_prodotto', raccoltaModulo: 'vendemmia' }).aliquotaIva).toBe(10);
  });

  it('cambio tipo senza coltura: PAC → vendita non lascia PAC; altro → null', () => {
    expect(suggerisciAliquotaPerTipo({ tipo: 'pac_contributo' }).categoriaIva).toBe('contributi_pac');
    expect(suggerisciAliquotaPerTipo({ tipo: 'vendita_prodotto' })).toBeNull();
    expect(suggerisciAliquotaPerTipo({ tipo: 'altro', coltura: 'grano' }).categoriaIva).toBe('cereali');
    expect(suggerisciAliquotaPerTipo({ tipo: 'altro' })).toBeNull();
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

  it('inferisce impresa agricola da P.IVA, altrimenti null', () => {
    expect(inferisciTipoClienteContoTerzi({ partitaIva: '12345678901' })).toBe('impresa_agricola');
    expect(inferisciTipoClienteContoTerzi({ partitaIva: ' 12345678901 ' })).toBe('impresa_agricola');
    expect(inferisciTipoClienteContoTerzi({ partitaIva: null })).toBeNull();
    expect(inferisciTipoClienteContoTerzi({})).toBeNull();
  });
});

describe('resolveAggiornamentoAliquotaForm — manuale non sovrascritta', () => {
  it('senza flag manuale applica il suggerimento (es. Uva → 10%)', () => {
    const sug = suggerisciAliquotaPerTipo({
      tipo: 'vendita_prodotto',
      coltura: 'Uva',
      aliquote: ALIQUOTE_DEFAULT
    });
    const d = resolveAggiornamentoAliquotaForm({ aliquotaManuale: false, suggerimento: sug });
    expect(d.apply).toBe(true);
    expect(d.suggerimento.categoriaIva).toBe('uva_da_vino');
    expect(d.showManualHint).toBe(false);
  });

  it('con aliquota manuale (Vino 22%) cambio coltura Uva non applica il suggerimento', () => {
    const sug = suggerisciAliquotaPerTipo({
      tipo: 'vendita_prodotto',
      coltura: 'Uva',
      aliquote: ALIQUOTE_DEFAULT
    });
    const d = resolveAggiornamentoAliquotaForm({
      aliquotaManuale: true,
      suggerimento: sug,
      corrente: 22
    });
    expect(d.apply).toBe(false);
    expect(d.suggerimento.categoriaIva).toBe('uva_da_vino');
    expect(d.showManualHint).toBe(true);
    expect(d.suggestedPercent).toBe(10);
  });

  it('acconto: Latte 10% manuale + prodotto Ortaggi non sovrascrive', () => {
    const sug = suggerisciAliquotaPerTipo({
      tipo: 'acconto',
      categoriaProdotto: 'ortaggi',
      aliquote: ALIQUOTE_DEFAULT
    });
    expect(sug.categoriaIva).toBe('ortaggi');
    const d = resolveAggiornamentoAliquotaForm({
      aliquotaManuale: true,
      suggerimento: sug,
      corrente: 10
    });
    expect(d.apply).toBe(false);
    expect(d.showManualHint).toBe(true);
    expect(d.suggestedPercent).toBe(4);
  });

  it('preventivo: senza scelta impresa lascia vuoto (non 10%)', () => {
    const d = resolveAggiornamentoAliquotaForm({
      aliquotaManuale: false,
      suggerimento: suggerisciAliquotaContoTerzi(null),
      richiedeSceltaCliente: true,
      sceltaClientePresente: false
    });
    expect(d.clearForMissingCliente).toBe(true);
    expect(d.apply).toBe(true);
    expect(d.suggerimento).toBeNull();
    expect(d.suggestedPercent).toBeNull();
  });

  it('preventivo: IVA manuale + cambio Sì/No mostra hint Usa X% senza applicare', () => {
    const sug = suggerisciAliquotaContoTerzi('impresa_agricola');
    const d = resolveAggiornamentoAliquotaForm({
      aliquotaManuale: true,
      suggerimento: sug,
      corrente: 22,
      richiedeSceltaCliente: true,
      sceltaClientePresente: true
    });
    expect(d.apply).toBe(false);
    expect(d.showManualHint).toBe(true);
    expect(d.suggestedPercent).toBe(10);
    expect(d.clearForMissingCliente).toBe(false);
  });
});

describe('risolviIvaEntrataInLettura', () => {
  it('legacy senza aliquota: suggerisce da coltura e calcola IVA solo in memoria', () => {
    const legacy = { tipo: 'vendita_prodotto', coltura: 'grano', importo: 4000 };
    const resolved = risolviIvaEntrataInLettura(legacy, ALIQUOTE_DEFAULT);
    expect(resolved).not.toBe(legacy);
    expect(resolved.categoriaIva).toBe('cereali');
    expect(resolved.aliquotaIva).toBe(4);
    expect(resolved.importoIva).toBe(160);
    expect(legacy.aliquotaIva).toBeUndefined();
  });

  it('PAC legacy → fuori campo; senza indizio resta com\'è', () => {
    const pac = risolviIvaEntrataInLettura(
      { tipo: 'pac_contributo', importo: 1000 },
      ALIQUOTE_DEFAULT
    );
    expect(pac.naturaIva).toBe('fuori_campo');
    expect(pac.importoIva).toBe(0);
    const plain = { tipo: 'altro', importo: 500 };
    expect(risolviIvaEntrataInLettura(plain, ALIQUOTE_DEFAULT)).toBe(plain);
  });

  it('già completa non viene riscritta; KPI usano suggerimento sui legacy', () => {
    const saved = {
      tipo: 'vendita_prodotto',
      importo: 1000,
      aliquotaIva: 10,
      importoIva: 100,
      naturaIva: 'imponibile'
    };
    expect(risolviIvaEntrataInLettura(saved, ALIQUOTE_DEFAULT)).toBe(saved);
    const items = [
      risolviIvaEntrataInLettura(
        { importo: 4000, incassato: true, tipo: 'vendita_prodotto', coltura: 'grano' },
        ALIQUOTE_DEFAULT
      ),
      { importo: 400, incassato: false }
    ];
    expect(totaliIvaEntrate(items)).toEqual({
      ivaRegistrate: 160,
      ivaIncassate: 160,
      ivaDaIncassare: 0
    });
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
