/** @vitest-environment jsdom */
/**
 * C1: potatura senza NaN (ceppi/ore) e ore validate al posto della stima durataPrevista × 8.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ ore: [], attivita: [], hasManodopera: true }));

vi.mock('../core/services/firebase-service.js', () => {
  const makeSnap = (rows) => ({
    forEach: (fn) => rows.forEach((r, i) => fn({ data: () => r }, i)),
    docs: rows.map((r) => ({ data: () => r }))
  });
  return {
    getDb: () => ({ fake: true }),
    getDocumentData: vi.fn(async () => ({ tipoOperaio: 'operaio_semplice' })),
    getCollectionData: vi.fn(async () => []),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
    dateToTimestamp: (d) => d,
    timestampToDate: (d) => d,
    collection: (_db, path) => ({ path }),
    doc: vi.fn(),
    where: (field, op, value) => ({ field, op, value }),
    query: (ref, ...conds) => ({ ref, conds }),
    getDocs: vi.fn(async (q) => (q.ref.path.endsWith('/oreOperai') ? makeSnap(state.ore) : makeSnap(state.attivita)))
  };
});
vi.mock('../core/services/tenant-service.js', () => ({
  getCurrentTenantId: () => 'tenant-1',
  hasModuleAccess: vi.fn(async (m) => (m === 'manodopera' ? state.hasManodopera : false))
}));
vi.mock('../core/services/calcolo-compensi-service.js', () => ({
  getTariffaOperaio: vi.fn(async () => 10),
  getTariffaProprietario: vi.fn(async () => 10)
}));
vi.mock('../core/services/lavori-service.js', () => ({ getAllLavori: vi.fn(), getLavoro: vi.fn() }));
vi.mock('../modules/vigneto/services/vigneti-service.js', () => ({
  getVigneto: vi.fn(),
  updateVigneto: vi.fn(),
  getVignetiByTerreno: vi.fn()
}));
vi.mock('../modules/frutteto/services/frutteti-service.js', () => ({
  getFrutteto: vi.fn(),
  updateFrutteto: vi.fn(),
  getAllFrutteti: vi.fn()
}));

import { PotaturaVigneto } from '../modules/vigneto/models/PotaturaVigneto.js';
import { PotaturaFrutteto } from '../modules/frutteto/models/PotaturaFrutteto.js';
import { calcolaCostiLavoro as costiVigneto } from '../modules/vigneto/services/lavori-vigneto-service.js';
import { calcolaCostiLavoro as costiFrutteto } from '../modules/frutteto/services/lavori-frutteto-service.js';
import {
  oreFinite,
  stimaOreDaDurataPrevista,
  risolviOreCostiLavoro
} from '../shared/js/ore-lavoro-validate.js';

beforeEach(() => {
  state.ore = [];
  state.attivita = [];
  state.hasManodopera = true;
});

describe('C1 – modelli potatura senza NaN', () => {
  it('PotaturaVigneto: ceppi null/""/non numerico → null in toFirestore', () => {
    for (const ceppiPotati of [null, '', undefined, 'abc']) {
      const out = new PotaturaVigneto({ vignetoId: 'v1', lavoroId: 'l1', ceppiPotati, oreImpiegate: ceppiPotati }).toFirestore();
      expect(out.ceppiPotati).toBeNull();
      expect(out.oreImpiegate).toBeNull();
      expect(Number.isNaN(out.ceppiPotati)).toBe(false);
    }
  });

  it('PotaturaVigneto: valori validi restano numeri', () => {
    const p = new PotaturaVigneto({ vignetoId: 'v1', ceppiPotati: '120', oreImpiegate: '2.5' });
    expect(p.ceppiPotati).toBe(120);
    expect(p.oreImpiegate).toBe(2.5);
  });

  it('PotaturaFrutteto: oreImpiegate null/""/NaN → null', () => {
    for (const oreImpiegate of [null, '', 'x']) {
      expect(new PotaturaFrutteto({ fruttetoId: 'f1', oreImpiegate }).toFirestore().oreImpiegate).toBeNull();
    }
    expect(new PotaturaFrutteto({ fruttetoId: 'f1', oreImpiegate: '3' }).oreImpiegate).toBe(3);
  });
});

describe('C1 – calcolaCostiLavoro restituisce oreValidate', () => {
  it('vigneto: 2h validate @10€ → costoManodopera 20, oreValidate 2', async () => {
    state.ore = [{ operaioId: 'op1', oreNette: 2, stato: 'validate' }];
    const out = await costiVigneto('lav1', { id: 'lav1' });
    expect(out.costoManodopera).toBe(20);
    expect(out.oreValidate).toBe(2);
  });

  it('frutteto: 2h validate @10€ → costoManodopera 20, oreValidate 2', async () => {
    state.ore = [{ operaioId: 'op1', oreNette: 2, stato: 'validate' }];
    const out = await costiFrutteto('lav1', { id: 'lav1' });
    expect(out.costoManodopera).toBe(20);
    expect(out.oreValidate).toBe(2);
  });

  it('senza ore: oreValidate 0', async () => {
    state.hasManodopera = true;
    const out = await costiVigneto('lav1', { id: 'lav1' });
    expect(out.oreValidate).toBe(0);
  });

  it('le ore da_validare (stima prefill) non entrano in oreValidate', async () => {
    state.ore = [
      { operaioId: 'op1', oreNette: 2, stato: 'validate' },
      { operaioId: 'op2', oreNette: 5, stato: 'da_validare' }
    ];
    const out = await costiVigneto('lav1', { id: 'lav1' }, { includeDaValidarePerPrefill: true });
    expect(out.oreValidate).toBe(2);
  });
});

describe('C1 – risolviOreCostiLavoro (validate > stima ×8)', () => {
  it('con ore validate usa quelle e i costi, non durataPrevista × 8', () => {
    const r = risolviOreCostiLavoro(
      { durataPrevista: 3 },
      { oreValidate: 2, costoManodopera: 20, costoMacchine: 5 }
    );
    expect(r).toEqual({ oreImpiegate: 2, costoManodopera: 20, costoMacchina: 5, daValidate: true });
  });

  it('senza ore validate: stima durata × 8 e nessun costo', () => {
    const r = risolviOreCostiLavoro({ durataPrevista: 3 }, { oreValidate: 0, costoManodopera: 0 });
    expect(r.oreImpiegate).toBe(24);
    expect(r.daValidate).toBe(false);
    expect(r.costoManodopera).toBeUndefined();
  });

  it('durata assente o non numerica → null (mai NaN)', () => {
    expect(stimaOreDaDurataPrevista(undefined)).toBeNull();
    expect(stimaOreDaDurataPrevista('abc')).toBeNull();
    expect(stimaOreDaDurataPrevista(0)).toBeNull();
    expect(risolviOreCostiLavoro({}, null).oreImpiegate).toBeNull();
    expect(oreFinite(NaN)).toBeNull();
    expect(oreFinite('2.5')).toBe(2.5);
  });
});
