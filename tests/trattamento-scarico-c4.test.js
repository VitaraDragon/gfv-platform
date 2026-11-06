/**
 * C4 — scarico magazzino da trattamento: ID deterministico, delta giacenza, storno, delete da Movimenti,
 * deleteTrattamento vigneto/frutteto. Firestore simulato in memoria (stessi mock del gate test, ma stateful),
 * con movimenti-service, prodotti-service e trattamento-scarico-magazzino-service reali.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** @type {Map<string, any>} */
const store = new Map();
/** Chiavi `coll/id` per cui getDocumentData fallisce (simula errore di rete/permessi). */
const failRead = new Set();

const key = (coll, id) => `${coll}/${id}`;

vi.mock('../core/services/firebase-service.js', () => ({
  getDocumentData: vi.fn(async (coll, id) => {
    const k = key(coll, id);
    if (failRead.has(k)) throw new Error('boom lettura');
    return store.has(k) ? { id, ...store.get(k) } : null;
  }),
  setDocument: vi.fn(async (coll, id, data) => {
    store.set(key(coll, id), { ...(store.get(key(coll, id)) || {}), ...data });
  }),
  createDocument: vi.fn(async (coll, data) => {
    const id = `auto-${store.size + 1}`;
    store.set(key(coll, id), { ...data });
    return id;
  }),
  updateDocument: vi.fn(async (coll, id, data) => {
    store.set(key(coll, id), { ...(store.get(key(coll, id)) || {}), ...data });
  }),
  deleteDocument: vi.fn(async (coll, id) => {
    store.delete(key(coll, id));
  }),
  incrementDocumentField: vi.fn(async (coll, id, field, delta) => {
    const d = store.get(key(coll, id));
    d[field] = (Number(d[field]) || 0) + delta;
  }),
  getCollectionData: vi.fn(async () => []),
  getDb: vi.fn(() => ({})),
  timestampToDate: (t) => (t && t.toDate ? t.toDate() : t),
  dateToTimestamp: (d) => d,
}));
vi.mock('../core/services/tenant-service.js', () => ({
  getCurrentTenantId: vi.fn(() => 't1'),
  getCurrentUser: vi.fn(() => ({ uid: 'u1' })),
}));
vi.mock('../modules/vigneto/services/vigneti-service.js', () => ({
  getVigneto: vi.fn(async () => ({ id: 'v1' })),
  updateVigneto: vi.fn(async () => undefined),
}));
vi.mock('../modules/frutteto/services/frutteti-service.js', () => ({
  getFrutteto: vi.fn(async () => ({ id: 'f1' })),
  updateFrutteto: vi.fn(async () => undefined),
}));
vi.mock('../core/services/storico-guard.js', () => ({
  assertRegistroImpiantoModificabile: vi.fn(async () => undefined),
}));

import { getDocumentData } from '../core/services/firebase-service.js';
import {
  syncScarichiMagazzinoTrattamento,
  rimuoviMovimentiTrattamento,
  movimentoIdScaricoTrattamento,
  eliminaMovimentoConStornoTrattamento,
} from '../modules/magazzino/services/trattamento-scarico-magazzino-service.js';
import { applyScaricoMagazzinoUi } from '../shared/js/scarico-magazzino-ui.js';
import { deleteTrattamento as deleteTrattamentoVigneto } from '../modules/vigneto/services/trattamenti-vigneto-service.js';
import { deleteTrattamento as deleteTrattamentoFrutteto } from '../modules/frutteto/services/trattamenti-frutteto-service.js';

const now = new Date('2026-09-18T12:00:00Z');

function idMov(prodottoId, modulo = 'vigneto', colturaId = 'v1', trattamentoId = 'tr1') {
  return movimentoIdScaricoTrattamento({ modulo, colturaId, trattamentoId, prodottoId });
}

function giacenza(prodottoId) {
  return store.get(key('prodotti', prodottoId)).giacenza;
}

function movimentiScarico() {
  return [...store.keys()].filter((k) => k.startsWith('movimentiMagazzino/trattamento_'));
}

function sync(over = {}) {
  return syncScarichiMagazzinoTrattamento({
    modulo: 'vigneto',
    colturaId: 'v1',
    trattamentoId: 'tr1',
    dataTrattamento: now,
    prodotti: [{ prodottoId: 'p1', quantita: 2, costo: 10 }],
    registraScaricoMagazzino: true,
    previousMovimentoIds: [],
    ...over,
  });
}

beforeEach(() => {
  store.clear();
  failRead.clear();
  vi.clearAllMocks();
  store.set('tenants/t1', { modules: ['magazzino'], moduleTrials: {} });
  store.set('prodotti/p1', { nome: 'Rame', unitaMisura: 'kg', giacenza: 100 });
  store.set('prodotti/p2', { nome: 'Zolfo', unitaMisura: 'kg', giacenza: 50 });
});

describe('ID deterministico', () => {
  it('formato trattamento_<modulo>_<colturaId>_<trattamentoId>_<prodottoId>', () => {
    expect(idMov('p1', 'frutteto', 'f9', 'trX')).toBe('trattamento_frutteto_f9_trX_p1');
  });
});

describe('syncScarichiMagazzinoTrattamento — C4', () => {
  it('salvataggio ripetuto → 1 solo movimento e giacenza scalata una volta', async () => {
    const a = await sync();
    const b = await sync({ previousMovimentoIds: a.movimentoIds });
    const c = await sync({ previousMovimentoIds: b.movimentoIds });
    expect(a.movimentoIds).toEqual([idMov('p1')]);
    expect(c.movimentoIds).toEqual([idMov('p1')]);
    expect(movimentiScarico()).toHaveLength(1);
    expect(giacenza('p1')).toBe(98);
  });

  it('salvataggio ripetuto senza previousMovimentoIds (id perso sul trattamento) → ancora 1 movimento', async () => {
    await sync();
    await sync({ previousMovimentoIds: [] });
    expect(movimentiScarico()).toHaveLength(1);
    expect(giacenza('p1')).toBe(98);
  });

  it('righe con lo stesso prodotto vengono sommate in un solo movimento', async () => {
    await sync({
      prodotti: [
        { prodottoId: 'p1', quantita: 2, costo: 4 },
        { prodottoId: 'p1', quantita: 3, costo: 6 },
      ],
    });
    expect(movimentiScarico()).toHaveLength(1);
    expect(store.get(key('movimentiMagazzino', idMov('p1'))).quantita).toBe(5);
    expect(giacenza('p1')).toBe(95);
  });

  it('id orfano (movimento già eliminato) → nessun errore e 1 movimento', async () => {
    const out = await sync({ previousMovimentoIds: ['id-che-non-esiste'] });
    expect(out.movimentoIds).toEqual([idMov('p1')]);
    expect(movimentiScarico()).toHaveLength(1);
    expect(giacenza('p1')).toBe(98);
  });

  it('delete fallita (non «non trovato») → nessun movimento creato e errore all\'utente', async () => {
    store.set('movimentiMagazzino/legacy-1', { prodottoId: 'p1', tipo: 'uscita', quantita: 1, data: now });
    failRead.add('movimentiMagazzino/legacy-1');
    await expect(sync({ previousMovimentoIds: ['legacy-1'] })).rejects.toThrow(/legacy-1/);
    expect(movimentiScarico()).toHaveLength(0);
    expect(giacenza('p1')).toBe(100);
  });

  it('rimuoviMovimentiTrattamento: errore diverso da «non trovato» non viene ingoiato', async () => {
    failRead.add('movimentiMagazzino/x1');
    await expect(rimuoviMovimentiTrattamento(['x1'])).rejects.toThrow(/boom lettura/);
    await expect(rimuoviMovimentiTrattamento(['mai-esistito'])).resolves.toBeUndefined();
  });

  it('cambio quantità → delta corretto (solo la differenza)', async () => {
    const a = await sync({ prodotti: [{ prodottoId: 'p1', quantita: 2 }] });
    expect(giacenza('p1')).toBe(98);
    const b = await sync({ prodotti: [{ prodottoId: 'p1', quantita: 5 }], previousMovimentoIds: a.movimentoIds });
    expect(giacenza('p1')).toBe(95);
    expect(store.get(key('movimentiMagazzino', idMov('p1'))).quantita).toBe(5);
    await sync({ prodotti: [{ prodottoId: 'p1', quantita: 1 }], previousMovimentoIds: b.movimentoIds });
    expect(giacenza('p1')).toBe(99);
    expect(movimentiScarico()).toHaveLength(1);
  });

  it('checkbox tolto → movimenti eliminati e giacenza ripristinata', async () => {
    const a = await sync();
    expect(giacenza('p1')).toBe(98);
    const out = await sync({ registraScaricoMagazzino: false, previousMovimentoIds: a.movimentoIds });
    expect(out.movimentoIds).toEqual([]);
    expect(movimentiScarico()).toHaveLength(0);
    expect(giacenza('p1')).toBe(100);
  });

  it('riga prodotto rimossa → il suo movimento viene eliminato, l\'altro resta', async () => {
    const a = await sync({
      prodotti: [
        { prodottoId: 'p1', quantita: 2 },
        { prodottoId: 'p2', quantita: 4 },
      ],
    });
    expect(a.movimentoIds).toHaveLength(2);
    expect(giacenza('p2')).toBe(46);
    const b = await sync({ prodotti: [{ prodottoId: 'p1', quantita: 2 }], previousMovimentoIds: a.movimentoIds });
    expect(b.movimentoIds).toEqual([idMov('p1')]);
    expect(movimentiScarico()).toHaveLength(1);
    expect(giacenza('p1')).toBe(98);
    expect(giacenza('p2')).toBe(50);
  });

  it('ID legacy casuali vengono sostituiti da quelli deterministici senza doppio scarico', async () => {
    store.set('movimentiMagazzino/legacy-1', {
      prodottoId: 'p1', tipo: 'uscita', quantita: 2, data: now,
    });
    store.get('prodotti/p1').giacenza = 98;
    const out = await sync({ previousMovimentoIds: ['legacy-1'] });
    expect(out.movimentoIds).toEqual([idMov('p1')]);
    expect(store.has('movimentiMagazzino/legacy-1')).toBe(false);
    expect(giacenza('p1')).toBe(98);
  });

  it('modulo magazzino spento → non scrive movimenti', async () => {
    store.set('tenants/t1', { modules: ['vigneto'], moduleTrials: {} });
    const out = await sync();
    expect(out.movimentoIds).toEqual([]);
    expect(movimentiScarico()).toHaveLength(0);
  });
});

describe('applyScaricoMagazzinoUi — checkbox derivato dai movimenti', () => {
  function fakeDoc() {
    const els = {
      'trattamento-scarico-magazzino-group': {
        style: {},
        children: [],
        appendChild(c) { this.children.push(c); els[c.id] = c; },
      },
      'trattamento-registra-scarico-magazzino': { checked: false },
    };
    return {
      els,
      getElementById: (id) => els[id] || null,
      createElement: () => ({ style: {}, textContent: '' }),
    };
  }

  it('movimento collegato mancante → checkbox deselezionato + nota «Scarico stornato da Movimenti»', async () => {
    const doc = fakeDoc();
    doc.els['trattamento-registra-scarico-magazzino'].checked = true;
    await applyScaricoMagazzinoUi({ magazzinoMovimentoIds: ['sparito'] }, { hasMagazzinoModule: true, doc });
    expect(doc.els['trattamento-registra-scarico-magazzino'].checked).toBe(false);
    expect(doc.els['trattamento-scarico-magazzino-nota'].textContent).toBe('Scarico stornato da Movimenti');
    expect(doc.els['trattamento-scarico-magazzino-nota'].style.display).toBe('block');
  });

  it('movimento presente → checkbox selezionato, nessuna nota', async () => {
    await sync();
    const doc = fakeDoc();
    await applyScaricoMagazzinoUi({ magazzinoMovimentoIds: [idMov('p1')] }, { hasMagazzinoModule: true, doc });
    expect(doc.els['trattamento-registra-scarico-magazzino'].checked).toBe(true);
    expect(doc.els['trattamento-scarico-magazzino-nota']).toBeUndefined();
  });

  it('senza id ma con magazzinoScaricoStornatoIl → deselezionato con nota', async () => {
    const doc = fakeDoc();
    await applyScaricoMagazzinoUi(
      { magazzinoMovimentoIds: [], magazzinoScaricoStornatoIl: now },
      { hasMagazzinoModule: true, doc }
    );
    expect(doc.els['trattamento-registra-scarico-magazzino'].checked).toBe(false);
    expect(doc.els['trattamento-scarico-magazzino-nota'].textContent).toBe('Scarico stornato da Movimenti');
  });

  it('errore di lettura → mantiene lo stato registrato (non deseleziona alla cieca)', async () => {
    failRead.add('movimentiMagazzino/m-err');
    const doc = fakeDoc();
    await applyScaricoMagazzinoUi({ magazzinoMovimentoIds: ['m-err'] }, { hasMagazzinoModule: true, doc });
    expect(doc.els['trattamento-registra-scarico-magazzino'].checked).toBe(true);
  });

  it('senza modulo magazzino il gruppo resta nascosto', async () => {
    const doc = fakeDoc();
    await applyScaricoMagazzinoUi({ magazzinoMovimentoIds: ['x'] }, { hasMagazzinoModule: false, doc });
    expect(doc.els['trattamento-scarico-magazzino-group'].style.display).toBe('none');
  });
});

describe('eliminazione da Movimenti → aggiorna il trattamento', () => {
  it('toglie l\'id, imposta magazzinoScaricoStornatoIl e ripristina la giacenza', async () => {
    const out = await sync();
    store.set('vigneti/v1/trattamenti/tr1', { magazzinoMovimentoIds: out.movimentoIds });
    const mov = {
      id: out.movimentoIds[0],
      origineTrattamentoModulo: 'vigneto',
      origineTrattamentoColturaId: 'v1',
      origineTrattamentoId: 'tr1',
    };
    await eliminaMovimentoConStornoTrattamento(mov);
    expect(movimentiScarico()).toHaveLength(0);
    expect(giacenza('p1')).toBe(100);
    const t = store.get('vigneti/v1/trattamenti/tr1');
    expect(t.magazzinoMovimentoIds).toEqual([]);
    expect(t.magazzinoScaricoStornatoIl).toBeInstanceOf(Date);
  });

  it('movimento non da trattamento → il trattamento non viene letto', async () => {
    store.set('movimentiMagazzino/m-libero', { prodottoId: 'p1', tipo: 'uscita', quantita: 3, data: now });
    store.get('prodotti/p1').giacenza = 97;
    getDocumentData.mockClear();
    await eliminaMovimentoConStornoTrattamento({ id: 'm-libero' });
    expect(giacenza('p1')).toBe(100);
    expect(getDocumentData.mock.calls.some((c) => String(c[0]).includes('trattamenti'))).toBe(false);
  });

  it('trattamento già eliminato → nessun errore', async () => {
    const out = await sync();
    await expect(
      eliminaMovimentoConStornoTrattamento({
        id: out.movimentoIds[0],
        origineTrattamentoModulo: 'vigneto',
        origineTrattamentoColturaId: 'v1',
        origineTrattamentoId: 'tr-sparito',
      })
    ).resolves.toBeUndefined();
  });
});

describe('deleteTrattamento rimuove le uscite collegate', () => {
  it('vigneto', async () => {
    const out = await sync();
    store.set('vigneti/v1/trattamenti/tr1', {
      vignetoId: 'v1',
      data: now,
      prodotti: [{ prodottoId: 'p1', quantita: 2 }],
      magazzinoMovimentoIds: out.movimentoIds,
    });
    expect(giacenza('p1')).toBe(98);
    await deleteTrattamentoVigneto('v1', 'tr1', { exportConfermato: true });
    expect(store.has('vigneti/v1/trattamenti/tr1')).toBe(false);
    expect(movimentiScarico()).toHaveLength(0);
    expect(giacenza('p1')).toBe(100);
  });

  it('frutteto', async () => {
    const out = await sync({ modulo: 'frutteto', colturaId: 'f1' });
    store.set('frutteti/f1/trattamenti/tr1', {
      fruttetoId: 'f1',
      data: now,
      prodotti: [{ prodottoId: 'p1', quantita: 2 }],
      magazzinoMovimentoIds: out.movimentoIds,
    });
    expect(giacenza('p1')).toBe(98);
    await deleteTrattamentoFrutteto('f1', 'tr1', { exportConfermato: true });
    expect(store.has('frutteti/f1/trattamenti/tr1')).toBe(false);
    expect(movimentiScarico()).toHaveLength(0);
    expect(giacenza('p1')).toBe(100);
  });

  it('storno fallito → il trattamento non viene eliminato e l\'errore arriva all\'utente', async () => {
    const out = await sync();
    store.set('vigneti/v1/trattamenti/tr1', {
      vignetoId: 'v1',
      data: now,
      prodotti: [{ prodottoId: 'p1', quantita: 2 }],
      magazzinoMovimentoIds: out.movimentoIds,
    });
    failRead.add(`movimentiMagazzino/${out.movimentoIds[0]}`);
    await expect(deleteTrattamentoVigneto('v1', 'tr1', { exportConfermato: true })).rejects.toThrow(/Impossibile stornare/);
    expect(store.has('vigneti/v1/trattamenti/tr1')).toBe(true);
  });
});
