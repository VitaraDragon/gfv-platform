"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { callGeminiWithRetry } = require("./tony-gemini-api");
const {
  validateDocumentPages,
  parseExtractedDocumentJson,
  normalizeExtractionResult,
  buildGeminiDocumentParts,
} = require("./config/tony-document-schemas");

const TONY_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

async function assertManagerOrAdminForTenant(db, uid, tenantId) {
  if (!tenantId || typeof tenantId !== "string") {
    throw new HttpsError("invalid-argument", "tenantId obbligatorio.");
  }
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "Utente non trovato.");
  }
  const data = snap.data();
  const memberships = data.tenantMemberships || {};
  const m = memberships[tenantId];
  if (m && m.stato === "attivo" && Array.isArray(m.ruoli)) {
    if (m.ruoli.includes("manager") || m.ruoli.includes("amministratore")) {
      return;
    }
  }
  if (data.tenantId === tenantId && Array.isArray(data.ruoli)) {
    if (data.ruoli.includes("manager") || data.ruoli.includes("amministratore")) {
      return;
    }
  }
  throw new HttpsError(
    "permission-denied",
    "Permessi insufficienti: serve ruolo manager o amministratore per acquisire documenti."
  );
}

function normalizeSubscriptionPlanId(raw) {
  if (raw == null || raw === "") return "base";
  const p = String(raw).trim().toLowerCase();
  if (p === "free" || p === "freemium") return "free";
  return "base";
}

async function resolveTenantSubscriptionPlan(db, dashboard, ctx, tenantIdHint) {
  let raw =
    (dashboard && (dashboard.plan || dashboard.piano)) ||
    (ctx && (ctx.plan || ctx.piano)) ||
    null;
  if (!raw && tenantIdHint) {
    try {
      const tSnap = await db.collection("tenants").doc(String(tenantIdHint)).get();
      if (tSnap.exists) {
        const td = tSnap.data();
        raw = td.piano || td.plan || raw;
      }
    } catch (e) {
      console.warn("[tonyExtractDocument] resolve plan:", e.message);
    }
  }
  return normalizeSubscriptionPlanId(raw);
}

async function resolveTenantIdForTony(db, authUid, dashboard, ctx, explicitTenantId) {
  if (explicitTenantId) return String(explicitTenantId);
  let tid = (dashboard && dashboard.tenantId) || (ctx && ctx.tenantId) || null;
  if (tid) return String(tid);
  if (!authUid) return null;
  try {
    const userSnap = await db.collection("users").doc(authUid).get();
    if (!userSnap.exists) return null;
    const ud = userSnap.data();
    if (ud.tenantId) return String(ud.tenantId);
    if (ud.tenantMemberships && typeof ud.tenantMemberships === "object") {
      const keys = Object.keys(ud.tenantMemberships);
      const pref = keys.find((k) => {
        const m = ud.tenantMemberships[k];
        return m && m.tenantIdPredefinito === true;
      });
      if (pref) return pref;
      if (keys.length >= 1) return keys[0];
    }
  } catch (e) {
    console.warn("[tonyExtractDocument] resolveTenantId:", e.message);
  }
  return null;
}

function resolveModuliAttivi(dashboard, ctx) {
  if (Array.isArray(dashboard.moduli_attivi)) return dashboard.moduli_attivi;
  if (Array.isArray(dashboard.info_azienda?.moduli_attivi)) return dashboard.info_azienda.moduli_attivi;
  if (Array.isArray(ctx.moduli_attivi)) return ctx.moduli_attivi;
  if (Array.isArray(ctx.info_azienda?.moduli_attivi)) return ctx.info_azienda.moduli_attivi;
  return [];
}

function tenantHasMagazzinoModule(moduliAttivi) {
  return (moduliAttivi || []).some((m) => String(m).toLowerCase() === "magazzino");
}

/**
 * Chiamata Gemini vision — estrazione documento (PoC Tony Occhi).
 * @param {string} apiKey
 * @param {Array<{ mimeType: string, data: string, indice: number }>} pages
 * @param {{ retryCount?: number }} [stats]
 */
async function extractDocumentWithGemini(apiKey, pages, stats) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TONY_GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: buildGeminiDocumentParts(pages) }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  };
  const res = await callGeminiWithRetry(url, body, "tonyExtractDocument", stats);
  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = parseExtractedDocumentJson(rawText);
  return normalizeExtractionResult(parsed);
}

/**
 * Handler callable tonyExtractDocument (Fase 0 PoC).
 * Body: { pages: [{ mimeType, data }], tenantId?, context? }
 */
async function handleTonyExtractDocument(db, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Utente non autenticato.");
  }

  const reqData = request.data || {};
  const ctx = reqData.context != null ? reqData.context : {};
  const dashboard = ctx.dashboard != null ? ctx.dashboard : {};
  const tenantId = await resolveTenantIdForTony(
    db,
    request.auth.uid,
    dashboard,
    ctx,
    reqData.tenantId
  );
  if (!tenantId) {
    throw new HttpsError("failed-precondition", "Tenant non risolvibile per l'utente corrente.");
  }

  const planId = await resolveTenantSubscriptionPlan(db, dashboard, ctx, tenantId);
  if (planId === "free") {
    throw new HttpsError(
      "permission-denied",
      "Tony non è disponibile sul piano Free. Passa al piano Base per usare l'acquisizione documenti."
    );
  }

  await assertManagerOrAdminForTenant(db, request.auth.uid, tenantId);

  const moduliAttivi = resolveModuliAttivi(dashboard, ctx);
  if (!tenantHasMagazzinoModule(moduliAttivi)) {
    throw new HttpsError(
      "permission-denied",
      "Il modulo Prodotti e Magazzino non è attivo. Attivalo dalla pagina Abbonamento."
    );
  }

  let pages;
  try {
    pages = validateDocumentPages(reqData.pages);
  } catch (e) {
    throw new HttpsError("invalid-argument", e.message || "Pagine non valide.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpsError(
      "failed-precondition",
      "Chiave Gemini non configurata (GEMINI_API_KEY)."
    );
  }

  const geminiStats = {};
  const started = Date.now();
  let estrazione;
  try {
    estrazione = await extractDocumentWithGemini(apiKey, pages, geminiStats);
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error("[tonyExtractDocument] estrazione fallita:", e);
    throw new HttpsError("internal", "Estrazione documento non riuscita: " + (e.message || "errore Gemini"));
  }

  return {
    ok: true,
    tenantId,
    model: TONY_GEMINI_MODEL,
    pagineRicevute: pages.length,
    geminiMs: Date.now() - started,
    geminiRetryCount: geminiStats.retryCount || 0,
    estrazione,
  };
}

module.exports = {
  handleTonyExtractDocument,
  extractDocumentWithGemini,
  assertManagerOrAdminForTenant,
  tenantHasMagazzinoModule,
  TONY_GEMINI_MODEL,
};
