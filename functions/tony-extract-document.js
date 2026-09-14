"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { callGeminiWithRetry } = require("./tony-gemini-api");
const {
  validateDocumentPages,
  parseExtractedDocumentJson,
  normalizeExtractionResult,
  buildGeminiDocumentParts,
  buildGeminiTranscribeParts,
  buildGeminiReconcileParts,
  isVisionDocumentPage,
  mergeRiferimentiBolla,
  TONY_DOCUMENT_RESPONSE_SCHEMA,
} = require("./config/tony-document-schemas");
const {
  shouldRunSafetySecondPass,
  buildSafetySecondPassParts,
  mergeSafetySecondPass,
  countMerceRows,
} = require("./config/tony-document-safety");
const { tryExtractFatturaPaFromPages, isXmlMime } = require("./config/tony-fatturapa");

const TONY_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const TONY_DOCUMENT_GEMINI_MODEL =
  process.env.GEMINI_DOCUMENT_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";
/** Gemini 2.5 Flash di default pensa in dinamico: su foto/PDF raddoppia i tempi. */
const TONY_DOCUMENT_THINKING_BUDGET = 0;

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

function geminiDocumentUrl(apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${TONY_DOCUMENT_GEMINI_MODEL}:generateContent?key=${apiKey}`;
}

/**
 * Disattiva il thinking Gemini 2.5 sulle chiamate documento (OCR è copia cifre, non ragionamento).
 * @param {object} generationConfig
 * @returns {object}
 */
function applyDocumentGeminiGenerationConfig(generationConfig) {
  const cfg = generationConfig && typeof generationConfig === "object" ? generationConfig : {};
  cfg.thinkingConfig = { thinkingBudget: TONY_DOCUMENT_THINKING_BUDGET };
  return cfg;
}

/**
 * Passata OCR: testo verbatim. Se fallisce, l'estrazione vision-only resta valida.
 * @param {string} apiKey
 * @param {Array} pages
 * @param {{ retryCount?: number }} [stats]
 * @returns {Promise<string>}
 */
async function transcribeDocumentWithGemini(apiKey, pages, stats) {
  const parts = buildGeminiTranscribeParts(pages);
  if (parts.length < 3) return "";
  const body = {
    contents: [{ parts }],
    generationConfig: applyDocumentGeminiGenerationConfig({
      temperature: 0,
      maxOutputTokens: 8192,
    }),
  };
  const res = await callGeminiWithRetry(geminiDocumentUrl(apiKey), body, "tonyExtractDocument-ocr", stats);
  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof rawText === "string" ? rawText.trim() : "";
}

async function extractDocumentWithGemini(apiKey, pages, stats, options) {
  options = options || {};
  const label = options.label || "tonyExtractDocument";
  const parts = Array.isArray(options.parts)
    ? options.parts
    : buildGeminiDocumentParts(pages, { transcription: options.transcription });
  const generationConfig = applyDocumentGeminiGenerationConfig({
    temperature: options.temperature != null ? options.temperature : 0.1,
    // Fatture riepilogative: 4096 tronca spesso il JSON a metà array righe
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
  });
  if (options.useSchema !== false) {
    generationConfig.responseSchema = TONY_DOCUMENT_RESPONSE_SCHEMA;
  }
  const url = geminiDocumentUrl(apiKey);
  const body = {
    contents: [{ parts }],
    generationConfig,
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
      generationConfig: applyDocumentGeminiGenerationConfig({
        temperature: 0,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      }),
    };
    const repairRes = await callGeminiWithRetry(geminiDocumentUrl(apiKey), repairBody, label + "-repair", stats);
    const repairData = await repairRes.json();
    const repairText = repairData?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = parseExtractedDocumentJson(repairText);
    return normalizeExtractionResult(parsed);
  }
}

function descriptionsSimilar(a, b) {
  const left = String(a || "").toLowerCase().trim();
  const right = String(b || "").toLowerCase().trim();
  if (!left || !right) return false;
  if (left === right) return true;
  const a8 = left.slice(0, 8);
  const b8 = right.slice(0, 8);
  return (a8.length >= 4 && right.includes(a8)) || (b8.length >= 4 && left.includes(b8));
}

function overlayRigaNumeri(baseRows, recRows) {
  const rec = Array.isArray(recRows) ? recRows : [];
  return (Array.isArray(baseRows) ? baseRows : []).map((row, i) => {
    const candidate = rec[i];
    if (!candidate || !descriptionsSimilar(row && row.descrizione, candidate.descrizione)) {
      return row;
    }
    return Object.assign({}, row, {
      quantita: candidate.quantita != null ? candidate.quantita : row.quantita,
      prezzoUnitario: candidate.prezzoUnitario != null ? candidate.prezzoUnitario : row.prezzoUnitario,
      riferimentoBolla: candidate.riferimentoBolla || row.riferimentoBolla,
    });
  });
}

/**
 * Se il reconcile perde righe, tieni la copertura del JSON vision e copia solo le cifre sicure.
 * @param {object} first
 * @param {object} reconciled
 * @returns {object}
 */
function pickReconciledExtraction(first, reconciled) {
  const base = first && typeof first === "object" ? first : { righe: [] };
  const rec = reconciled && typeof reconciled === "object" ? reconciled : null;
  if (!rec) return base;
  if (countMerceRows(rec.righe) >= countMerceRows(base.righe)) return rec;
  const overlaid = Object.assign({}, base, {
    numeroDocumento: rec.numeroDocumento || base.numeroDocumento,
    dataDocumento: rec.dataDocumento || base.dataDocumento,
    totali: rec.totali || base.totali,
    riferimentiBolla: mergeRiferimentiBolla(base.riferimentiBolla, rec.riferimentiBolla),
    righe: overlayRigaNumeri(base.righe, rec.righe),
  });
  if (rec.fornitore) {
    const prev = base.fornitore || {};
    overlaid.fornitore = {
      nome: prev.nome || rec.fornitore.nome || "",
      piva: rec.fornitore.piva || prev.piva || "",
      confidence: prev.confidence != null ? prev.confidence : rec.fornitore.confidence,
    };
  }
  return overlaid;
}

async function reconcileExtractionWithTranscription(apiKey, estrazione, transcription, stats) {
  const parts = buildGeminiReconcileParts(estrazione, transcription);
  const generationConfig = applyDocumentGeminiGenerationConfig({
    temperature: 0,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
    responseSchema: TONY_DOCUMENT_RESPONSE_SCHEMA,
  });
  const body = {
    contents: [{ parts }],
    generationConfig,
  };
  const res = await callGeminiWithRetry(
    geminiDocumentUrl(apiKey),
    body,
    "tonyExtractDocument-reconcile",
    stats
  );
  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = parseExtractedDocumentJson(rawText);
  return pickReconciledExtraction(estrazione, normalizeExtractionResult(parsed));
}

/**
 * OCR e JSON vision in parallelo; allineamento cifre in una chiamata solo testo.
 * @param {string} apiKey
 * @param {Array} pages
 * @param {{ retryCount?: number }} stats
 * @returns {Promise<{ estrazione: object, transcriptionUsed: boolean, timings: object }>}
 */
async function runTwoPassExtraction(apiKey, pages, stats) {
  const timings = { transcribeMs: null, extractMs: null, reconcileMs: null, parallelWallMs: null };
  const wallStart = Date.now();
  const ocrP = (async () => {
    const start = Date.now();
    try {
      const text = await transcribeDocumentWithGemini(apiKey, pages, stats);
      timings.transcribeMs = Date.now() - start;
      return { ok: true, text };
    } catch (err) {
      timings.transcribeMs = Date.now() - start;
      return { ok: false, err };
    }
  })();
  const jsonP = (async () => {
    const start = Date.now();
    const first = await extractDocumentWithGemini(apiKey, pages, stats, { transcription: "" });
    timings.extractMs = Date.now() - start;
    return first;
  })();
  const [ocr, first] = await Promise.all([ocrP, jsonP]);
  timings.parallelWallMs = Date.now() - wallStart;

  let transcription = "";
  if (ocr.ok) {
    transcription = String(ocr.text || "").trim();
  } else {
    console.warn(
      "[tonyExtractDocument] trascrizione OCR saltata:",
      ocr.err && ocr.err.message ? ocr.err.message : ocr.err
    );
  }
  const transcriptionUsed = transcription.length > 40;
  let estrazione = first;
  if (transcriptionUsed) {
    const start = Date.now();
    try {
      estrazione = await reconcileExtractionWithTranscription(apiKey, first, transcription, stats);
      timings.reconcileMs = Date.now() - start;
    } catch (e) {
      timings.reconcileMs = Date.now() - start;
      console.warn(
        "[tonyExtractDocument] reconcile saltato, uso JSON vision:",
        e && e.message ? e.message : e
      );
      estrazione = first;
    }
  }
  console.info("[tonyExtractDocument] pipeline parallela", JSON.stringify(Object.assign({ transcriptionUsed }, timings)));
  return { estrazione, transcriptionUsed, timings };
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

  const started = Date.now();
  const fatturapa = tryExtractFatturaPaFromPages(pages);
  if (fatturapa && Array.isArray(fatturapa.righe) && fatturapa.righe.length) {
    const estrazioneXml = normalizeExtractionResult(fatturapa);
    console.info(
      "[tonyExtractDocument] FatturaPA XML:",
      estrazioneXml.numeroDocumento || "(senza numero)",
      "righe=" + estrazioneXml.righe.length
    );
    return {
      ok: true,
      tenantId,
      model: "fatturapa-xml",
      fonteEstrazione: "fatturapa",
      transcriptionUsed: false,
      pagineRicevute: pages.length,
      geminiMs: Date.now() - started,
      geminiRetryCount: 0,
      safetyPassB: false,
      safetyPassBReasons: [],
      estrazione: estrazioneXml,
    };
  }

  const hasVision = pages.some(isVisionDocumentPage);
  const hasXml = pages.some((p) => isXmlMime(p.mimeType));
  if (!hasVision && hasXml) {
    throw new HttpsError(
      "invalid-argument",
      "Non riesco a leggere questo file. Scatta una foto della bolla o della fattura, oppure carica il PDF."
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpsError(
      "failed-precondition",
      "Chiave Gemini non configurata (GEMINI_API_KEY)."
    );
  }

  const geminiStats = {};
  let estrazione;
  let safetyPassB = false;
  let safetyPassBReasons = [];
  const fonteEstrazione = "gemini";
  let transcriptionUsed = false;
  try {
    const twoPass = await runTwoPassExtraction(apiKey, pages, geminiStats);
    transcriptionUsed = !!twoPass.transcriptionUsed;
    const passB = await maybeRunSafetySecondPass(apiKey, pages, twoPass.estrazione, geminiStats);
    estrazione = passB.estrazione;
    safetyPassB = !!passB.safetyPassB;
    safetyPassBReasons = passB.safetyPassBReasons || [];
    if (estrazione && typeof estrazione === "object") {
      estrazione.fonteEstrazione = "gemini";
    }
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error("[tonyExtractDocument] estrazione fallita:", e);
    throw new HttpsError("internal", "Estrazione documento non riuscita: " + (e.message || "errore Gemini"));
  }

  return {
    ok: true,
    tenantId,
    model: TONY_DOCUMENT_GEMINI_MODEL,
    fonteEstrazione,
    transcriptionUsed,
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
  transcribeDocumentWithGemini,
  reconcileExtractionWithTranscription,
  runTwoPassExtraction,
  pickReconciledExtraction,
  applyDocumentGeminiGenerationConfig,
  maybeRunSafetySecondPass,
  assertManagerOrAdminForTenant,
  tenantHasMagazzinoModule,
  TONY_GEMINI_MODEL,
  TONY_DOCUMENT_GEMINI_MODEL,
  TONY_DOCUMENT_THINKING_BUDGET,
};
