/**
 * Cache Firestore + LRU memoria per output buildContextAzienda (T4 pieno).
 * Path: tenants/{tenantId}/tonyContextCache/latest
 */

const { sliceContextAziendaToTier, normalizeTierMax, tierRankNum } = require("./tony-context-tier");

const DEFAULT_TTL_MS = 120 * 1000;
const CACHE_DOC_ID = "latest";

/** @type {Map<string, { payload: object, expiresAt: number }>} */
const memoryLru = new Map();
const MEMORY_LRU_MAX = 32;

function memoryGet(tenantId) {
  const entry = memoryLru.get(tenantId);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    memoryLru.delete(tenantId);
    return null;
  }
  return entry.payload;
}

function memorySet(tenantId, payload, expiresAt) {
  if (memoryLru.has(tenantId)) memoryLru.delete(tenantId);
  memoryLru.set(tenantId, { payload, expiresAt });
  while (memoryLru.size > MEMORY_LRU_MAX) {
    const firstKey = memoryLru.keys().next().value;
    if (firstKey != null) memoryLru.delete(firstKey);
    else break;
  }
}

function firestoreExpiresAtToMs(raw) {
  if (raw == null) return 0;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw.toMillis === "function") return raw.toMillis();
  if (typeof raw.toDate === "function") {
    try {
      return raw.toDate().getTime();
    } catch (e) {
      return 0;
    }
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} tenantId
 * @param {(tierMax: string) => Promise<object>} buildFn
 * @param {{ ttlMs?: number, tierMax?: string }} [opts]
 * @returns {Promise<{ azienda: object, cacheHit: boolean, buildMs?: number, tierUsed?: string }>}
 */
async function getCachedContextAzienda(db, tenantId, buildFn, opts = {}) {
  const ttlMs = opts.ttlMs != null && Number.isFinite(Number(opts.ttlMs)) ? Number(opts.ttlMs) : DEFAULT_TTL_MS;
  const tierMax = normalizeTierMax(opts.tierMax || "T4");
  if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") {
    const built = await buildFn(tierMax);
    return { azienda: built || {}, cacheHit: false, tierUsed: tierMax };
  }
  const tid = tenantId.trim();

  const memHit = memoryGet(tid);
  if (memHit && typeof memHit === "object") {
    return {
      azienda: sliceContextAziendaToTier(memHit, tierMax),
      cacheHit: true,
      tierUsed: tierMax,
    };
  }

  const ref = db.collection("tenants").doc(tid).collection("tonyContextCache").doc(CACHE_DOC_ID);
  try {
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data() || {};
      const expiresAtMs = firestoreExpiresAtToMs(data.expiresAt);
      if (expiresAtMs > Date.now() && data.payload && typeof data.payload === "object") {
        memorySet(tid, data.payload, expiresAtMs);
        return {
          azienda: sliceContextAziendaToTier(data.payload, tierMax),
          cacheHit: true,
          tierUsed: tierMax,
        };
      }
    }
  } catch (e) {
    console.warn("[Tony Context Cache] read fallita:", e.message);
  }

  const buildStart = Date.now();
  const built = (await buildFn(tierMax)) || {};
  const buildMs = Date.now() - buildStart;
  const expiresAtMs = Date.now() + ttlMs;
  const expiresAt = new Date(expiresAtMs);

  if (tierRankNum(tierMax) >= 4) {
    memorySet(tid, built, expiresAtMs);
    try {
      await ref.set(
        {
          payload: built,
          expiresAt,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("[Tony Context Cache] write fallita:", e.message);
    }
  }

  return { azienda: built, cacheHit: false, buildMs, tierUsed: tierMax };
}

/**
 * Invalida cache contesto Tony per tenant (Firestore + LRU memoria).
 * Chiamare dopo write critici (magazzino, conto terzi, guasti) — non su ogni attività/ore.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} tenantId
 */
async function invalidateTonyContextCache(db, tenantId) {
  if (!tenantId || typeof tenantId !== "string" || tenantId.trim() === "") return;
  const tid = tenantId.trim();
  memoryLru.delete(tid);
  if (!db) return;
  const ref = db.collection("tenants").doc(tid).collection("tonyContextCache").doc(CACHE_DOC_ID);
  try {
    await ref.delete();
  } catch (e) {
    console.warn("[Tony Context Cache] invalidate fallita:", e.message);
  }
}

/** Solo test: svuota LRU memoria istanza. */
function _clearMemoryCacheForTests() {
  memoryLru.clear();
}

module.exports = {
  DEFAULT_TTL_MS,
  getCachedContextAzienda,
  invalidateTonyContextCache,
  _clearMemoryCacheForTests,
};
