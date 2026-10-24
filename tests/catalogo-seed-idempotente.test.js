/**
 * Seed catalogo idempotente (categorie, colture, tipi lavoro) con Firestore finto in memoria.
 * - id deterministici `seed_<codice|nome>` via writeBatch (merge), mai addDoc;
 * - due chiamate concorrenti → una sola scrittura per voce;
 * - lettura fallita → nessuna scrittura;
 * - catalogo parziale → ripresa fino al completo, senza doppioni;
 * - catalogo completo → zero scritture;
 * - copie omonime già presenti → colture/tipi agganciati alla copia canonica.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  store: {},
  failRead: false,
  writes: [],
  batchCommits: 0,
  /** Simula interruzione: dopo N set in batch lancia (0 = mai). */
  failAfterSets: 0,
  setsInFlight: 0,
}));

vi.mock('../core/services/firebase-service.js', () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const serverTimestamp = () => ({ __serverTimestamp: true });

  function applySet(col, id, data) {
    db.writes.push(`${col}/${id}`);
    db.store[col] = db.store[col] || {};
    const esiste = !!db.store[col][id];
    // come setDocument reale: createdAt solo alla prima scrittura (Date fissa per i test)
    db.store[col][id] = {
      ...(db.store[col][id] || {}),
      ...data,
      ...(esiste ? {} : { createdAt: new Date('2026-01-01T00:00:00Z') }),
    };
  }

  return {
    timestampToDate: (v) => (v instanceof Date ? v : new Date(v)),
    dateToTimestamp: (v) => v,
    serverTimestamp,
    getDb: vi.fn(() => ({ __fakeDb: true })),
    getDocument: vi.fn((col, id) => ({ __ref: true, col, id })),
    writeBatch: vi.fn(() => {
      const ops = [];
      return {
        set(ref, data) {
          ops.push({ ref, data });
        },
        async commit() {
          await tick();
          for (const { ref, data } of ops) {
            db.setsInFlight += 1;
            if (db.failAfterSets > 0 && db.setsInFlight > db.failAfterSets) {
              throw new Error('Simulated batch interrupt');
            }
            applySet(ref.col, ref.id, data);
          }
          db.batchCommits += 1;
        },
      };
    }),
    getCollectionData: vi.fn(async (col) => {
      await tick();
      if (db.failRead) throw new Error('Errore lettura collection: unavailable');
      return Object.entries(db.store[col] || {}).map(([id, d]) => ({ id, ...d }));
    }),
    setDocument: vi.fn(async (col, id, data) => {
      await tick();
      applySet(col, id, data);
    }),
    createDocument: vi.fn(async () => { throw new Error('addDoc non deve essere usato dai seed'); }),
    updateDocument: vi.fn(async () => {}),
    deleteDocument: vi.fn(async () => {}),
    getDocumentData: vi.fn(async () => null),
  };
});
vi.mock('../core/services/tenant-service.js', () => ({
  getCurrentTenantId: vi.fn(() => 'cascina-conti'),
}));

import { setDocument, createDocument, writeBatch } from '../core/services/firebase-service.js';
import { initializeCategoriePredefinite } from '../core/services/categorie-service.js';
import { initializeColturePredefinite } from '../core/services/colture-service.js';
import { initializeTipiLavoroPredefiniti } from '../core/services/tipi-lavoro-service.js';
import { idSeed, slugCatalogo, conLockSeed, _resetLockSeed, SEED_BATCH_MAX_OPS } from '../core/services/catalogo-seed.js';
import {
  CATEGORIE_PRINCIPALI_PREDEFINITE,
  CATEGORIE_COLTURE_PREDEFINITE,
  SOTTOCATEGORIE_PREDEFINITE,
  COLTURE_PREDEFINITE,
  TIPI_LAVORO_PREDEFINITI,
} from '../core/config/app-catalog-seed-data.js';

const NUM_CATEGORIE =
  CATEGORIE_PRINCIPALI_PREDEFINITE.length + CATEGORIE_COLTURE_PREDEFINITE.length + SOTTOCATEGORIE_PREDEFINITE.length;

beforeEach(() => {
  vi.clearAllMocks();
  _resetLockSeed();
  db.store = {};
  db.failRead = false;
  db.writes = [];
  db.batchCommits = 0;
  db.failAfterSets = 0;
  db.setsInFlight = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('catalogo-seed utilità', () => {
  it('idSeed deterministico, minuscolo, senza accenti', () => {
    expect(idSeed('vite')).toBe('seed_vite');
    expect(idSeed("Fico d'India")).toBe('seed_fico_d_india');
    expect(slugCatalogo(' Erba Médica ')).toBe('erba_medica');
    expect(() => idSeed('  ')).toThrow();
  });
  it('id seed unici su tutto il catalogo predefinito', () => {
    const cat = [...CATEGORIE_PRINCIPALI_PREDEFINITE, ...CATEGORIE_COLTURE_PREDEFINITE, ...SOTTOCATEGORIE_PREDEFINITE].map((c) => idSeed(c.codice));
    expect(new Set(cat).size).toBe(cat.length);
    const col = COLTURE_PREDEFINITE.map((c) => idSeed(c.nome));
    expect(new Set(col).size).toBe(col.length);
  });
  it('conLockSeed: chiamate concorrenti condividono la stessa esecuzione', async () => {
    const fn = vi.fn(async () => 'ok');
    const [a, b] = await Promise.all([conLockSeed('x', 't', fn), conLockSeed('x', 't', fn)]);
    expect([a, b]).toEqual(['ok', 'ok']);
    expect(fn).toHaveBeenCalledTimes(1);
    await conLockSeed('x', 't', fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('SEED_BATCH_MAX_OPS rispetta il limite Firestore', () => {
    expect(SEED_BATCH_MAX_OPS).toBe(500);
  });
});

describe('initializeCategoriePredefinite', () => {
  it('due chiamate concorrenti → una sola scrittura per codice, id seed_<codice>', async () => {
    await Promise.all([initializeCategoriePredefinite(), initializeCategoriePredefinite()]);
    expect(createDocument).not.toHaveBeenCalled();
    expect(writeBatch).toHaveBeenCalled();
    expect(db.writes).toHaveLength(NUM_CATEGORIE);
    expect(new Set(db.writes).size).toBe(NUM_CATEGORIE);
    expect(db.store.categorie.seed_vite).toMatchObject({ codice: 'vite', applicabileA: 'colture' });
    const sub = Object.values(db.store.categorie).find((c) => c.parentId);
    expect(String(sub.parentId).startsWith('seed_')).toBe(true);
    expect(db.writes.every((w) => w.startsWith('categorie/seed_'))).toBe(true);
  });

  it('seconda esecuzione non scrive nulla', async () => {
    await initializeCategoriePredefinite();
    const prima = db.writes.length;
    const commits = db.batchCommits;
    await initializeCategoriePredefinite();
    expect(db.writes.length).toBe(prima);
    expect(db.batchCommits).toBe(commits);
  });

  it('lettura fallita → nessuna scrittura e errore propagato', async () => {
    db.failRead = true;
    await expect(initializeCategoriePredefinite()).rejects.toThrow(/inizializzazione categorie/);
    expect(db.writes).toHaveLength(0);
  });

  it('ripresa da catalogo parziale → completa senza doppioni', async () => {
    await initializeCategoriePredefinite();
    const ids = Object.keys(db.store.categorie);
    // Simula interruzione: lascia solo metà delle categorie
    const keep = ids.slice(0, Math.floor(ids.length / 2));
    db.store.categorie = Object.fromEntries(keep.map((id) => [id, db.store.categorie[id]]));
    db.writes = [];
    db.batchCommits = 0;
    await initializeCategoriePredefinite();
    expect(Object.keys(db.store.categorie)).toHaveLength(NUM_CATEGORIE);
    expect(new Set(Object.keys(db.store.categorie)).size).toBe(NUM_CATEGORIE);
    expect(db.writes.length).toBe(NUM_CATEGORIE - keep.length);
  });
});

describe('initializeColturePredefinite', () => {
  async function seedCategorieColtureMinimali() {
    // Tutte le categorie coltura del catalogo (serve per arrivare a 99)
    await initializeCategoriePredefinite();
    db.writes = [];
    db.batchCommits = 0;
  }

  it('concorrenti → una scrittura per coltura; categoria = copia canonica fra le omonime', async () => {
    db.store.categorie = {
      'vite-nuova': { codice: 'vite', nome: 'Vite', applicabileA: 'colture', predefinita: true, createdAt: new Date('2026-10-23T10:00:05Z') },
      'vite-vecchia': { codice: 'vite', nome: 'Vite', applicabileA: 'colture', predefinita: true, createdAt: new Date('2026-10-23T10:00:00Z') },
      'frutteto-x': { codice: 'frutteto', nome: 'Frutteto', applicabileA: 'colture', predefinita: true },
    };
    await Promise.all([initializeColturePredefinite(), initializeColturePredefinite()]);
    const scritte = db.writes.filter((w) => w.startsWith('colture/'));
    expect(new Set(scritte).size).toBe(scritte.length);
    expect(db.store.colture[idSeed('Vite da Vino')].categoriaId).toBe('vite-vecchia');
    expect(db.store.colture[idSeed('Pesco')].categoriaId).toBe('frutteto-x');
    expect(db.store.colture[idSeed('Grano')]).toBeUndefined(); // categoria seminativo assente
  });

  it('colture già presenti per nome non vengono riscritte', async () => {
    db.store.categorie = { v: { codice: 'vite', nome: 'Vite', applicabileA: 'colture' } };
    db.store.colture = { vecchio: { nome: 'vite', categoriaId: 'v' } };
    await initializeColturePredefinite();
    expect(db.writes).not.toContain(`colture/${idSeed('Vite')}`);
    expect(db.writes).toContain(`colture/${idSeed('Vite da Vino')}`);
  });

  it('lettura fallita → nessuna scrittura', async () => {
    db.failRead = true;
    await expect(initializeColturePredefinite()).rejects.toThrow();
    expect(db.writes).toHaveLength(0);
  });

  it('ripresa da catalogo parziale (34/99) → arriva a 99 senza doppioni', async () => {
    await seedCategorieColtureMinimali();
    await initializeColturePredefinite();
    expect(Object.keys(db.store.colture || {})).toHaveLength(COLTURE_PREDEFINITE.length);

    // Simula Podere Bassi: lascia solo le prime 34 colture
    const ids = Object.keys(db.store.colture);
    const keep = ids.slice(0, 34);
    db.store.colture = Object.fromEntries(keep.map((id) => [id, db.store.colture[id]]));
    db.writes = [];
    db.batchCommits = 0;

    await initializeColturePredefinite();
    const finalIds = Object.keys(db.store.colture);
    expect(finalIds).toHaveLength(COLTURE_PREDEFINITE.length);
    expect(new Set(finalIds).size).toBe(COLTURE_PREDEFINITE.length);
    expect(db.writes.filter((w) => w.startsWith('colture/'))).toHaveLength(COLTURE_PREDEFINITE.length - 34);
  });

  it('catalogo completo → zero scritture', async () => {
    await seedCategorieColtureMinimali();
    await initializeColturePredefinite();
    db.writes = [];
    db.batchCommits = 0;
    await initializeColturePredefinite();
    expect(db.writes).toHaveLength(0);
    expect(db.batchCommits).toBe(0);
  });

  it('interruzione a metà + seconda chiamata → completo', async () => {
    await seedCategorieColtureMinimali();
    db.setsInFlight = 0;
    db.failAfterSets = 40;
    await expect(initializeColturePredefinite()).rejects.toThrow(/inizializzazione colture/);
    const parziali = Object.keys(db.store.colture || {}).length;
    expect(parziali).toBeGreaterThan(0);
    expect(parziali).toBeLessThan(COLTURE_PREDEFINITE.length);

    db.failAfterSets = 0;
    db.setsInFlight = 0;
    db.writes = [];
    _resetLockSeed();
    await initializeColturePredefinite();
    expect(Object.keys(db.store.colture)).toHaveLength(COLTURE_PREDEFINITE.length);
  });

  it('due chiamate in parallelo → nessun doppione', async () => {
    await seedCategorieColtureMinimali();
    await Promise.all([initializeColturePredefinite(), initializeColturePredefinite()]);
    const ids = Object.keys(db.store.colture);
    expect(ids).toHaveLength(COLTURE_PREDEFINITE.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('seed_'))).toBe(true);
  });
});

describe('initializeTipiLavoroPredefiniti', () => {
  it('concorrenti → una scrittura per tipo, agganciati alle categorie canoniche', async () => {
    await initializeCategoriePredefinite();
    // copia omonima più recente di una principale: non deve essere scelta
    db.store.categorie['zzz-copia'] = { codice: 'potatura', nome: 'Potatura', applicabileA: 'entrambi', predefinita: true, createdAt: new Date() };
    db.writes = [];
    await Promise.all([initializeTipiLavoroPredefiniti(), initializeTipiLavoroPredefiniti()]);
    const scritte = db.writes.filter((w) => w.startsWith('tipiLavoro/'));
    expect(scritte.length).toBeGreaterThan(0);
    expect(new Set(scritte).size).toBe(scritte.length);
    expect(scritte.every((w) => w.startsWith('tipiLavoro/seed_'))).toBe(true);
    const usaCopia = Object.values(db.store.tipiLavoro).some((t) => t.categoriaId === 'zzz-copia');
    expect(usaCopia).toBe(false);
  });

  it('lettura fallita → nessuna scrittura', async () => {
    db.failRead = true;
    await expect(initializeTipiLavoroPredefiniti()).rejects.toThrow();
    expect(db.writes).toHaveLength(0);
  });

  it('ripresa da catalogo parziale (46/75) → arriva a 75 senza doppioni', async () => {
    await initializeCategoriePredefinite();
    db.writes = [];
    await initializeTipiLavoroPredefiniti();
    expect(Object.keys(db.store.tipiLavoro || {}).length).toBe(TIPI_LAVORO_PREDEFINITI.length);

    const ids = Object.keys(db.store.tipiLavoro);
    const keep = ids.slice(0, 46);
    db.store.tipiLavoro = Object.fromEntries(keep.map((id) => [id, db.store.tipiLavoro[id]]));
    db.writes = [];
    db.batchCommits = 0;

    await initializeTipiLavoroPredefiniti();
    const finalIds = Object.keys(db.store.tipiLavoro);
    expect(finalIds).toHaveLength(TIPI_LAVORO_PREDEFINITI.length);
    expect(new Set(finalIds).size).toBe(TIPI_LAVORO_PREDEFINITI.length);
    expect(db.writes.filter((w) => w.startsWith('tipiLavoro/'))).toHaveLength(TIPI_LAVORO_PREDEFINITI.length - 46);
  });

  it('catalogo completo → zero scritture tipi', async () => {
    await initializeCategoriePredefinite();
    db.writes = [];
    await initializeTipiLavoroPredefiniti();
    db.writes = [];
    db.batchCommits = 0;
    await initializeTipiLavoroPredefiniti();
    expect(db.writes.filter((w) => w.startsWith('tipiLavoro/'))).toHaveLength(0);
  });

  it('interruzione a metà + seconda chiamata → completo', async () => {
    await initializeCategoriePredefinite();
    db.writes = [];
    db.setsInFlight = 0;
    db.failAfterSets = 30;
    await expect(initializeTipiLavoroPredefiniti()).rejects.toThrow(/inizializzazione tipi lavoro/);
    const parziali = Object.keys(db.store.tipiLavoro || {}).length;
    expect(parziali).toBeGreaterThan(0);
    expect(parziali).toBeLessThan(TIPI_LAVORO_PREDEFINITI.length);

    db.failAfterSets = 0;
    db.setsInFlight = 0;
    db.writes = [];
    _resetLockSeed();
    await initializeTipiLavoroPredefiniti();
    expect(Object.keys(db.store.tipiLavoro)).toHaveLength(TIPI_LAVORO_PREDEFINITI.length);
  });

  it('due chiamate in parallelo → nessun doppione', async () => {
    await initializeCategoriePredefinite();
    db.writes = [];
    await Promise.all([initializeTipiLavoroPredefiniti(), initializeTipiLavoroPredefiniti()]);
    const ids = Object.keys(db.store.tipiLavoro);
    expect(ids).toHaveLength(TIPI_LAVORO_PREDEFINITI.length);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
