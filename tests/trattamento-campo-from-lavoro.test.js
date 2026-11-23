/** @vitest-environment jsdom */
/**
 * Lavoro di trattamento su seminativo → doc in trattamentiSeminativo (create / no doppione / sync).
 * Frutteto resta invariato sullo stesso hook createTrattamentoFromLavoro.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = vi.hoisted(() => ({ docs: new Map(), nextId: 1 }));
const mocks = vi.hoisted(() => ({
  lavoro: null,
  terreno: null,
  campagneSeminativo: [],
  prodotti: []
}));

vi.mock('../core/services/firebase-service.js', () => ({
  getCollectionData: vi.fn(async (path, options = {}) => {
    const out = [];
    const where = Array.isArray(options.where) ? options.where : [];
    store.docs.forEach((doc, key) => {
      if (!key.startsWith(path + '/')) return;
      const id = key.slice(path.length + 1);
      if (id.includes('/')) return;
      const row = { ...doc, id };
      const ok = where.every(([field, op, value]) => {
        if (op !== '==') return true;
        return String(row[field] ?? '') === String(value ?? '');
      });
      if (ok) out.push(row);
    });
    return out;
  }),
  getDocumentData: vi.fn(async (path, id) => store.docs.get(path + '/' + id) || null),
  createDocument: vi.fn(async (path, data) => {
    const id = 'trat-' + store.nextId++;
    store.docs.set(path + '/' + id, { ...data });
    return id;
  }),
  updateDocument: vi.fn(async (path, id, data) => {
    const key = path + '/' + id;
    store.docs.set(key, { ...(store.docs.get(key) || {}), ...data });
  }),
  deleteDocument: vi.fn(async (path, id) => {
    store.docs.delete(path + '/' + id);
  }),
  dateToTimestamp: vi.fn((d) => d),
  timestampToDate: vi.fn((d) => d),
  getDb: vi.fn()
}));
vi.mock('../core/services/tenant-service.js', () => ({
  getCurrentTenantId: vi.fn(() => 't1'),
  getCurrentUser: vi.fn(() => ({ uid: 'u1' }))
}));
vi.mock('../core/services/lavori-service.js', () => ({
  getLavoro: vi.fn(async () => mocks.lavoro),
  getAllLavori: vi.fn(async () => [])
}));
vi.mock('../core/services/terreni-service.js', () => ({
  getTerreno: vi.fn(async () => mocks.terreno)
}));
vi.mock('../core/services/tipi-lavoro-service.js', () => ({
  getTipoLavoroByNome: vi.fn(async () => ({ categoriaId: 'cat1' })),
  getAllTipiLavoro: vi.fn(async () => [])
}));
vi.mock('../core/services/categorie-service.js', () => ({
  getCategoria: vi.fn(async () => ({ codice: 'trattamenti' })),
  getAllCategorie: vi.fn(async () => [])
}));
vi.mock('../core/services/attivita-service.js', () => ({
  getAllAttivita: vi.fn(async () => [])
}));
vi.mock('../core/services/storico-guard.js', () => ({
  assertRegistroImpiantoModificabile: vi.fn(async () => undefined)
}));
vi.mock('../core/js/attivita-utils.js', () => ({
  mapColturaToCategoria: vi.fn((nome) => {
    const n = String(nome || '').toLowerCase();
    if (n.includes('vite')) return 'Vite';
    if (n.includes('pesco') || n.includes('melo')) return 'Frutteto';
    if (n.includes('grano')) return 'Seminativo';
    return 'Default';
  })
}));
vi.mock('../modules/magazzino/services/prodotti-service.js', () => ({
  getAllProdotti: vi.fn(async () => mocks.prodotti)
}));
vi.mock('../modules/seminativo/services/seminativi-service.js', () => ({
  getAllSeminativi: vi.fn(async () => mocks.campagneSeminativo),
  listTerreniSeminativo: vi.fn(async () => [{ id: 'ter-grano' }])
}));
vi.mock('../modules/frutteto/services/frutteti-service.js', () => ({
  getAllFrutteti: vi.fn(async () => [{ id: 'f1', terrenoId: 'ter-pesco', specie: 'Pesco' }]),
  getFruttetiByTerreno: vi.fn(async () => [{ id: 'f1', terrenoId: 'ter-pesco', specie: 'Pesco' }]),
  getFrutteto: vi.fn(),
  updateFrutteto: vi.fn(async () => undefined)
}));
vi.mock('../modules/vigneto/services/vigneti-service.js', () => ({
  getAllVigneti: vi.fn(async () => []),
  getVigneto: vi.fn(),
  updateVigneto: vi.fn(async () => undefined)
}));

vi.mock('../modules/magazzino/services/trattamento-scarico-magazzino-service.js', () => ({
  rimuoviMovimentiTrattamento: vi.fn(async () => undefined),
  syncScarichiMagazzinoTrattamento: vi.fn(async () => ({ movimentoIds: [] }))
}));

import * as seminativo from '../modules/seminativo/services/trattamenti-service.js';
import * as frutteto from '../modules/frutteto/services/trattamenti-frutteto-service.js';
import { superficieTrattataDaTerreno } from '../shared/js/trattamento-campo-from-lavoro.js';
import { createDocument, deleteDocument, getCollectionData } from '../core/services/firebase-service.js';
import { rimuoviMovimentiTrattamento } from '../modules/magazzino/services/trattamento-scarico-magazzino-service.js';

const MISCELA = {
  ettolitriPerEttaro: 3,
  ettolitriTotali: 6,
  prodotti: [
    { prodottoId: 'p1', nome: 'Prosaro', unita: 'l', dosePerEttaro: 1, quantita: 2 }
  ]
};

function resetStore() {
  store.docs.clear();
  store.nextId = 1;
}

function lavoroGrano(overrides = {}) {
  return {
    id: 'lav-grano',
    nome: 'Trattamento grano',
    tipoLavoro: 'Trattamento antiparassitario',
    terrenoId: 'ter-grano',
    dataInizio: new Date('2026-04-15T08:00:00Z'),
    operaioId: 'op1',
    miscelaPrevista: MISCELA,
    ...overrides
  };
}

describe('superficieTrattataDaTerreno', () => {
  it('arrotonda a 2 decimali (step 0.01 del form registro)', () => {
    expect(superficieTrattataDaTerreno({ superficie: 1.4050816695097663 })).toBe(1.41);
    expect(superficieTrattataDaTerreno({ superficie: '1.4050816695097663' })).toBe(1.41);
    expect(superficieTrattataDaTerreno({ superficie: 3.04 })).toBe(3.04);
    expect(superficieTrattataDaTerreno({ superficie: null })).toBeNull();
    expect(superficieTrattataDaTerreno(null)).toBeNull();
  });
});

describe('seminativo createTrattamentoFromLavoro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mocks.campagneSeminativo = [{
      id: 'camp1',
      terrenoId: 'ter-grano',
      campagna: '2025/2026',
      colturaNome: 'Grano'
    }];
    mocks.terreno = { id: 'ter-grano', coltura: 'Grano', superficie: '2' };
    mocks.lavoro = lavoroGrano();
    mocks.prodotti = [{ id: 'p1', prezzoUnitario: 12 }];
  });

  it('crea il doc in trattamentiSeminativo con lavoroId e miscela', async () => {
    const id = await seminativo.createTrattamentoFromLavoro('lav-grano');
    expect(id).toBe('trat-1');
    const doc = store.docs.get('trattamentiSeminativo/trat-1');
    expect(doc.lavoroId).toBe('lav-grano');
    expect(doc.campagnaId).toBe('camp1');
    expect(doc.terrenoId).toBe('ter-grano');
    expect(doc.prodotti).toHaveLength(1);
    expect(doc.prodotti[0]).toMatchObject({ prodottoId: 'p1', prodotto: 'Prosaro', dosaggio: 1 });
    expect(createDocument).toHaveBeenCalledTimes(1);
  });

  it('salva superficie arrotondata a 2 decimali (non blocca Salva con step 0.01)', async () => {
    mocks.terreno = { id: 'ter-grano', coltura: 'Grano', superficie: 1.4050816695097663 };
    const id = await seminativo.createTrattamentoFromLavoro('lav-grano');
    const doc = store.docs.get('trattamentiSeminativo/' + id);
    expect(doc.superficieTrattata).toBe(1.41);
    expect(doc.superficieDaAnagrafeTerreno).toBe(true);
  });

  it('modifica senza doppione: secondo salvataggio sincronizza e non crea un altro doc', async () => {
    const id1 = await seminativo.createTrattamentoFromLavoro('lav-grano');
    mocks.lavoro = lavoroGrano({
      dataInizio: new Date('2026-04-20T08:00:00Z'),
      miscelaPrevista: null
    });
    const id2 = await seminativo.createTrattamentoFromLavoro('lav-grano');
    expect(id2).toBe(id1);
    expect(createDocument).toHaveBeenCalledTimes(1);
    const docs = await getCollectionData('trattamentiSeminativo', { tenantId: 't1' });
    expect(docs).toHaveLength(1);
    expect(docs[0].data).toBe('2026-04-20');
    expect(docs[0].prodotti[0].prodotto).toBe('Prosaro');
  });

  it('elimina il doc collegato (come cascade Elimina lavoro)', async () => {
    const id = await seminativo.createTrattamentoFromLavoro('lav-grano');
    const found = await seminativo.findTrattamentoByLavoroId('lav-grano');
    expect(found.trattamentoId).toBe(id);
    await seminativo.deleteTrattamentoSeminativo(id, { exportConfermato: true });
    expect(deleteDocument).toHaveBeenCalledWith('trattamentiSeminativo', id, 't1');
    expect(await seminativo.findTrattamentoByLavoroId('lav-grano')).toBeNull();
  });

  it('in delete storna i movimenti di magazzino collegati al trattamento', async () => {
    const id = await seminativo.createTrattamentoFromLavoro('lav-grano');
    store.docs.set('trattamentiSeminativo/' + id, {
      ...store.docs.get('trattamentiSeminativo/' + id),
      magazzinoMovimentoIds: ['mov-uscita-1']
    });
    await seminativo.deleteTrattamentoSeminativo(id, { exportConfermato: true });
    expect(rimuoviMovimentiTrattamento).toHaveBeenCalledWith(['mov-uscita-1']);
    expect(deleteDocument).toHaveBeenCalledWith('trattamentiSeminativo', id, 't1');
  });

  it('senza campagna non crea nulla', async () => {
    mocks.campagneSeminativo = [];
    const id = await seminativo.createTrattamentoFromLavoro('lav-grano');
    expect(id).toBeNull();
    expect(createDocument).not.toHaveBeenCalled();
  });
});

describe('frutteto createTrattamentoFromLavoro invariato', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mocks.terreno = { id: 'ter-pesco', coltura: 'Pesco', superficie: '1.5' };
    mocks.lavoro = {
      id: 'lav-pesco',
      nome: 'Trattamento pesco',
      tipoLavoro: 'Trattamento antiparassitario',
      terrenoId: 'ter-pesco',
      dataInizio: new Date('2026-05-01T08:00:00Z'),
      operaioId: 'op1',
      miscelaPrevista: MISCELA
    };
    mocks.prodotti = [{ id: 'p1', prezzoUnitario: 10 }];
  });

  it('crea ancora sotto frutteti/{id}/trattamenti', async () => {
    const id = await frutteto.createTrattamentoFromLavoro('lav-pesco');
    expect(id).toBe('trat-1');
    const doc = store.docs.get('frutteti/f1/trattamenti/trat-1');
    expect(doc.lavoroId).toBe('lav-pesco');
    expect(doc.prodotti).toHaveLength(1);
    expect(store.docs.has('trattamentiSeminativo/trat-1')).toBe(false);
  });
});
