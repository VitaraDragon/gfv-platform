"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { callGeminiWithRetry } = require("./tony-gemini-api");
const {
  validateDocumentPages,
  parseExtractedDocumentJson,
  normalizeExtractionResult,
  buildGeminiDocumentParts,
} = require("./config/tony-document-schemas");
const {
  shouldRunSafetySecondPass,
  buildSafetySecondPassParts,
  mergeSafetySecondPass,
} = require("./config/tony-document-safety");

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
 * @param {{ parts?: Array<object>, label?: string }} [options]
 */
async function extractDocumentWithGemini(apiKey, pages, stats, options) {
  options = options || {};
  const label = options.label || "tonyExtractDocument";
  const parts = Array.isArray(options.parts) ? options.parts : buildGeminiDocumentParts(pages);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TONY_GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts }],
    generationConfig: {
      temperature: options.temperature != null ? options.temperature : 0.1,
      // Fatture riepilogative: 4096 tronca spesso il JSON a metà array righe
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  };
  const res = await callGeminiWithRetry(url, body, label, stats);
  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const finishReason = data?.candidates?.[0]?.finishReason || "";
  try {
    const parsed = parseExtractedDocumentJson(rawText);
    return normalizeExtractionResult(parsed);
  } catch (parseErr) {
    // Secondo tentativo: chiedi solo riparazione JSON (senza ri-leggere l'immagine)
    if (!rawText || typeof rawText !== "string") throw parseErr;
    console.warn(
      "[tonyExtractDocument] JSON parse fallito (" +
        (parseErr && parseErr.message) +
        "), finishReason=" +
        finishReason +
        " — retry riparazione"
    );
    const repairBody = {
      contents: [
        {
          parts: [
            {
              text:
                "Correggi il testo seguente in un UNICO oggetto JSON valido (schema estrazione documento magazzino). " +
                "Niente markdown, niente commenti. Numeri con punto decimale. Chiudi array/oggetti incompleti se troncati.\n\n" +
                rawText,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    };
    const repairRes = await callGeminiWithRetry(url, repairBody, label + "-repair", stats);
    const repairData = await repairRes.json();
    const repairText = repairData?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = parseExtractedDocumentJson(repairText);
    return normalizeExtractionResult(parsed);
  }
}

/**
 * Level B: seconda passata Flash solo se i controlli post-estrazione lo richiedono.
 * @param {string} apiKey
 * @param {Array} pages
 * @param {object} first
 * @param {{ retryCount?: number }} stats
 * @returns {Promise<{ estrazione: object, safetyPassB: boolean, safetyPassBReasons: string[] }>}
 */
async function maybeRunSafetySecondPass(apiKey, pages, first, stats) {
  const gate = shouldRunSafetySecondPass(first);
  if (!gate.run) {
    return { estrazione: first, safetyPassB: false, safetyPassBReasons: [] };
  }
  console.info("[tonyExtractDocument] Level B seconda passata:", gate.reasons.join(", "));
  try {
    const parts = buildSafetySecondPassParts(pages, first, gate.reasons);
    const second = await extractDocumentWithGemini(apiKey, pages, stats, {
      parts,
      label: "tonyExtractDocument-safetyB",
      temperature: 0.05,
    });
    const merged = mergeSafetySecondPass(first, second, gate.reasons);
    return {
      estrazione: merged,
      safetyPassB: true,
      safetyPassBReasons: gate.reasons,
    };
  } catch (e) {
    console.warn(
      "[tonyExtractDocument] Level B fallita, uso prima passata:",
      e && e.message ? e.message : e
    );
    const fallback = Object.assign({}, first, {
      safetyPassB: false,
      safetyPassBAttempted: true,
      safetyPassBReasons: gate.reasons,
      safetyPassBError: e && e.message ? String(e.message).slice(0, 200) : "error",
    });
    return {
      estrazione: fallback,
      safetyPassB: false,
      safetyPassBReasons: gate.reasons,
    };
  }
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
  let safetyPassB = false;
  let safetyPassBReasons = [];
  try {
    const first = await extractDocumentWithGemini(apiKey, pages, geminiStats);
    const passB = await maybeRunSafetySecondPass(apiKey, pages, first, geminiStats);
    estrazione = passB.estrazione;
    safetyPassB = !!passB.safetyPassB;
    safetyPassBReasons = passB.safetyPassBReasons || [];
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
    safetyPassB,
    safetyPassBReasons,
    estrazione,
  };
}

module.exports = {
  handleTonyExtractDocument,
  extractDocumentWithGemini,
  maybeRunSafetySecondPass,
  assertManagerOrAdminForTenant,
  tenantHasMagazzinoModule,
  TONY_GEMINI_MODEL,
};
