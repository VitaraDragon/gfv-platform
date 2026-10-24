/**
 * Seed catalogo idempotente (categorie, colture, tipi lavoro) con Firestore finto in memoria.
 * - id deterministici `seed_<codice|nome>` via setDocument (merge), mai addDoc;
 * - due chiamate concorrenti → una sola scrittura per voce;
 * - lettura fallita → nessuna scrittura;
 * - copie omonime già presenti → colture/tipi agganciati alla copia canonica.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({ store: {}, failRead: false, writes: [] }));

vi.mock('../core/services/firebase-service.js', () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  return {
    timestampToDate: (v) => (v instanceof Date ? v : new Date(v)),
    dateToTimestamp: (v) => v,
    getCollectionData: vi.fn(async (col) => {
      await tick();
      if (db.failRead) throw new Error('Errore lettura collection: unavailable');
      return Object.entries(db.store[col] || {}).map(([id, d]) => ({ id, ...d }));
    }),
    setDocument: vi.fn(async (col, id, data) => {
      await tick();
      db.writes.push(`${col}/${id}`);
      db.store[col] = db.store[col] || {};
      const esiste = !!db.store[col][id];
      // come firebase-service.setDocument: createdAt solo alla prima scrittura
      db.store[col][id] = { ...(db.store[col][id] || {}), ...data, ...(esiste ? {} : { createdAt: new Date('2026-01-01T00:00:00Z') }) };
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

import { setDocument, createDocument } from '../core/services/firebase-service.js';
import { initializeCategoriePredefinite } from '../core/services/categorie-service.js';
import { initializeColturePredefinite } from '../core/services/colture-service.js';
import { initializeTipiLavoroPredefiniti } from '../core/services/tipi-lavoro-service.js';
import { idSeed, slugCatalogo, conLockSeed, _resetLockSeed } from '../core/services/catalogo-seed.js';
import {
  CATEGORIE_PRINCIPALI_PREDEFINITE,
  CATEGORIE_COLTURE_PREDEFINITE,
  SOTTOCATEGORIE_PREDEFINITE,
  COLTURE_PREDEFINITE,
} from '../core/config/app-catalog-seed-data.js';

const NUM_CATEGORIE =
  CATEGORIE_PRINCIPALI_PREDEFINITE.length + CATEGORIE_COLTURE_PREDEFINITE.length + SOTTOCATEGORIE_PREDEFINITE.length;

beforeEach(() => {
  vi.clearAllMocks();
  _resetLockSeed();
  db.store = {};
  db.failRead = false;
  db.writes = [];
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
});

describe('initializeCategoriePredefinite', () => {
  it('due chiamate concorrenti → una sola scrittura per codice, id seed_<codice>', async () => {
    await Promise.all([initializeCategoriePredefinite(), initializeCategoriePredefinite()]);
    expect(createDocument).not.toHaveBeenCalled();
    expect(db.writes).toHaveLength(NUM_CATEGORIE);
    expect(new Set(db.writes).size).toBe(NUM_CATEGORIE);
    expect(db.store.categorie.seed_vite).toMatchObject({ codice: 'vite', applicabileA: 'colture' });
    const sub = Object.values(db.store.categorie).find((c) => c.parentId);
    expect(String(sub.parentId).startsWith('seed_')).toBe(true);
    // i dati passati a setDocument non portano createdAt/id del modello (li gestisce setDocument)
    expect(setDocument.mock.calls.every(([, , data]) => !('createdAt' in data) && !('id' in data))).toBe(true);
  });

  it('seconda esecuzione non scrive nulla', async () => {
    await initializeCategoriePredefinite();
    const prima = db.writes.length;
    await initializeCategoriePredefinite();
    expect(db.writes.length).toBe(prima);
  });

  it('lettura fallita → nessuna scrittura e errore propagato', async () => {
    db.failRead = true;
    await expect(initializeCategoriePredefinite()).rejects.toThrow(/inizializzazione categorie/);
    expect(setDocument).not.toHaveBeenCalled();
  });
});

describe('initializeColturePredefinite', () => {
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
    expect(setDocument).not.toHaveBeenCalled();
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
    expect(setDocument).not.toHaveBeenCalled();
  });
});
