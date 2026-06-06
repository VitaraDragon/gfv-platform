import { createRequire } from 'module';
import { describe, it, expect, beforeEach } from 'vitest';

const require = createRequire(import.meta.url);
const {
  getCachedContextAzienda,
  invalidateTonyContextCache,
  _clearMemoryCacheForTests,
  DEFAULT_TTL_MS,
} = require('../functions/tony-context-cache.js');

function mockFirestore(tenantId, initialDoc = null) {
  const store = new Map();
  const cacheKey = `tenants/${tenantId}/tonyContextCache/latest`;
  if (initialDoc) store.set(cacheKey, initialDoc);
  return {
    collection(name) {
      if (name !== 'tenants') throw new Error(`unexpected collection ${name}`);
      return {
        doc(tid) {
          return {
            collection(subName) {
              if (subName !== 'tonyContextCache') throw new Error(`unexpected sub ${subName}`);
              return {
                doc(docId) {
                  const key = `tenants/${tid}/tonyContextCache/${docId}`;
                  return {
                    async get() {
                      const data = store.get(key);
                      return { exists: !!data, data: () => data };
                    },
                    async set(data) {
                      store.set(key, { ...data });
                    },
                    async delete() {
                      store.delete(key);
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    _store: store,
    _cacheKey: cacheKey,
  };
}

describe('getCachedContextAzienda', () => {
  beforeEach(() => {
    _clearMemoryCacheForTests();
  });

  it('cache hit Firestore valido (TTL non scaduto)', async () => {
    const payload = { clienti: [{ id: 'c1' }], summaryScadenze: 'ok' };
    const db = mockFirestore('t1', {
      payload,
      expiresAt: new Date(Date.now() + 60_000),
    });
    let buildCalls = 0;
    const result = await getCachedContextAzienda(
      db,
      't1',
      async () => {
        buildCalls += 1;
        return { should: 'not-run' };
      },
      { ttlMs: DEFAULT_TTL_MS, tierMax: 'T4' }
    );
    expect(result.cacheHit).toBe(true);
    expect(result.azienda).toEqual(payload);
    expect(buildCalls).toBe(0);
  });

  it('TTL scaduto → rebuild e write', async () => {
    const db = mockFirestore('t1', {
      payload: { stale: true },
      expiresAt: new Date(Date.now() - 1000),
    });
    let buildCalls = 0;
    const fresh = { clienti: [], summaryScadenze: 'nuovo' };
    const result = await getCachedContextAzienda(db, 't1', async () => {
      buildCalls += 1;
      return fresh;
    }, { tierMax: 'T4' });
    expect(result.cacheHit).toBe(false);
    expect(result.azienda).toEqual(fresh);
    expect(buildCalls).toBe(1);
    const key = db._cacheKey;
    expect(db._store.get(key).payload).toEqual(fresh);
  });

  it('seconda chiamata stesso tenant → memory hit', async () => {
    const db = mockFirestore('t1');
    let buildCalls = 0;
    const built = { terreni: [] };
    const r1 = await getCachedContextAzienda(db, 't1', async () => {
      buildCalls += 1;
      return built;
    }, { tierMax: 'T4' });
    const r2 = await getCachedContextAzienda(db, 't1', async () => {
      buildCalls += 1;
      return { other: true };
    }, { tierMax: 'T4' });
    expect(r1.cacheHit).toBe(false);
    expect(r2.cacheHit).toBe(true);
    expect(r2.azienda).toEqual(built);
    expect(buildCalls).toBe(1);
  });

  it('cache hit Firestore → slice tier inferiore', async () => {
    const payload = {
      summaryScadenze: 'ok',
      clienti: [{ id: 'c1' }],
      terreni: [{ id: 't1' }],
      prodotti: [{ id: 'p1' }],
    };
    const db = mockFirestore('t1', {
      payload,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const result = await getCachedContextAzienda(
      db,
      't1',
      async () => ({ should: 'not-run' }),
      { tierMax: 'T1' }
    );
    expect(result.cacheHit).toBe(true);
    expect(result.azienda.summaryScadenze).toBe('ok');
    expect(result.azienda.clienti).toBeUndefined();
    expect(result.azienda._contextTier).toBe('T1');
  });

  it('invalidateTonyContextCache elimina doc Firestore e memory hit successivo rebuild', async () => {
    const payload = { clienti: [{ id: 'c1' }] };
    const db = mockFirestore('t1', {
      payload,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await invalidateTonyContextCache(db, 't1');
    expect(db._store.has(db._cacheKey)).toBe(false);
    let buildCalls = 0;
    const r = await getCachedContextAzienda(db, 't1', async () => {
      buildCalls += 1;
      return { fresh: true };
    }, { tierMax: 'T4' });
    expect(r.cacheHit).toBe(false);
    expect(buildCalls).toBe(1);
  });

  it('tenantId vuoto → build diretto senza cache', async () => {
    const db = mockFirestore('t1');
    let buildCalls = 0;
    const result = await getCachedContextAzienda(db, '', async () => {
      buildCalls += 1;
      return { _profiloCampo: true };
    }, { tierMax: 'T0' });
    expect(result.cacheHit).toBe(false);
    expect(result.azienda._profiloCampo).toBe(true);
    expect(buildCalls).toBe(1);
  });
});
