"use strict";

const { HttpsError } = require("firebase-functions/v2/https");

/** Avviso utente se la risposta resta troncata dopo il ripiego. */
const TONY_MAX_TOKENS_NOTICE =
  "La risposta si è interrotta: chiedimi di continuare.";

const TONY_MAX_OUTPUT_DEFAULT = 4096;
const TONY_MAX_OUTPUT_RETRY = 8192;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * generationConfig Tony in base al modello (GEMINI_MODEL sovrascrivibile).
 * gemini-2.5-flash*: thinkingBudget 0 (i token di ragionamento contano nel maxOutputTokens).
 * gemini-2.5-pro: mai budget 0 (min API 128); non inviamo thinkingConfig di default.
 * gemini-3*: niente thinkingBudget (deprecato); opzionale thinkingLevel solo sul ripiego.
 *
 * @param {string} model
 * @param {{ structured?: boolean, maxTokensRetry?: boolean }} [options]
 * @returns {{ temperature: number, maxOutputTokens: number, thinkingConfig?: object }}
 */
function buildTonyGenerationConfig(model, options) {
  const opts = options && typeof options === "object" ? options : {};
  const structured = !!opts.structured;
  const maxTokensRetry = !!opts.maxTokensRetry;
  const name = String(model || "").toLowerCase();

  const config = {
    temperature: structured ? 0.3 : 0.7,
    maxOutputTokens: maxTokensRetry ? TONY_MAX_OUTPUT_RETRY : TONY_MAX_OUTPUT_DEFAULT,
  };

  if (/gemini-2\.5-flash/.test(name)) {
    config.thinkingConfig = { thinkingBudget: 0 };
  } else if (/gemini-2\.5-pro/.test(name)) {
    // API: thinkingBudget 0 non ammesso (min 128). Sul ripiego MAX_TOKENS abbassiamo il budget.
    if (maxTokensRetry) {
      config.thinkingConfig = { thinkingBudget: 128 };
    }
  } else if (/gemini-3/.test(name)) {
    // thinkingBudget deprecato su Gemini 3+; thinkingLevel solo sul ripiego.
    if (maxTokensRetry) {
      config.thinkingConfig = { thinkingLevel: "low" };
    }
  }

  return config;
}

/**
 * Estrae finishReason e usageMetadata da un payload Gemini (generateContent o chunk SSE).
 * @param {object} data
 * @returns {{ finishReason: string|null, usageMetadata: object|null }}
 */
function extractGeminiFinishMeta(data) {
  const finishReason =
    data &&
    data.candidates &&
    data.candidates[0] &&
    typeof data.candidates[0].finishReason === "string"
      ? data.candidates[0].finishReason
      : null;
  const usageMetadata =
    data && data.usageMetadata && typeof data.usageMetadata === "object"
      ? data.usageMetadata
      : null;
  return { finishReason, usageMetadata };
}

/**
 * Log + arricchimento tonyPerf per MAX_TOKENS / finishReason.
 * @returns {boolean} true se finishReason === MAX_TOKENS
 */
function recordTonyGeminiFinish(tonyPerf, meta, model, text) {
  const finishReason = meta && meta.finishReason ? meta.finishReason : null;
  const usage = (meta && meta.usageMetadata) || {};
  if (tonyPerf && typeof tonyPerf === "object") {
    tonyPerf.finishReason = finishReason;
    tonyPerf.thoughtsTokenCount =
      usage.thoughtsTokenCount != null ? usage.thoughtsTokenCount : null;
    tonyPerf.promptTokenCount =
      usage.promptTokenCount != null ? usage.promptTokenCount : null;
    tonyPerf.candidatesTokenCount =
      usage.candidatesTokenCount != null ? usage.candidatesTokenCount : null;
  }
  if (finishReason === "MAX_TOKENS") {
    console.warn(
      "[Tony Cloud Function] MAX_TOKENS",
      JSON.stringify({
        finishReason,
        promptTokenCount: usage.promptTokenCount != null ? usage.promptTokenCount : null,
        candidatesTokenCount:
          usage.candidatesTokenCount != null ? usage.candidatesTokenCount : null,
        thoughtsTokenCount: usage.thoughtsTokenCount != null ? usage.thoughtsTokenCount : null,
        textLength: text != null ? String(text).length : 0,
        model: model || null,
      })
    );
    return true;
  }
  return false;
}

/**
 * Se testo strutturato sembra JSON troncato (blocco aperto / parse impossibile).
 */
function looksLikeTruncatedStructuredJson(text) {
  const s = String(text || "");
  if (!s.trim()) return true;
  const openFences = (s.match(/```/g) || []).length;
  if (openFences % 2 === 1) return true;
  const jsonBlock = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlock) {
    try {
      JSON.parse(jsonBlock[1].trim());
      return false;
    } catch (_) {
      return true;
    }
  }
  if (/\{\s*"action"\s*:/.test(s)) {
    try {
      const loose = s.match(/\{[\s\S]*"action"\s*:\s*"[^"]+"[\s\S]*\}/);
      if (!loose) return true;
      JSON.parse(loose[0]);
      return false;
    } catch (_) {
      return true;
    }
  }
  return false;
}

/**
 * Appende l'avviso di interruzione se non già presente.
 */
function appendMaxTokensNotice(text) {
  const base = String(text || "").trim();
  if (base.indexOf(TONY_MAX_TOKENS_NOTICE) >= 0) return base || TONY_MAX_TOKENS_NOTICE;
  if (!base) return TONY_MAX_TOKENS_NOTICE;
  return base + "\n\n" + TONY_MAX_TOKENS_NOTICE;
}

async function callGeminiWithRetry(url, body, label, stats) {
  const maxAttempts = 6;
  const baseDelayOther = 900;
  let lastStatus = 0;
  let lastText = "";
  let retries = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      if (stats && typeof stats === "object") stats.retryCount = retries;
      return res;
    }
    retries += 1;
    const retryAfterHeader = res.headers.get("retry-after");
    lastStatus = res.status;
    lastText = await res.text();
    console.error("Gemini API error:", res.status, lastText);
    const retriable = res.status === 429 || res.status === 500 || res.status === 503;
    if (!retriable || attempt === maxAttempts) break;
    let waitMs;
    if (res.status === 429) {
      let sec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
      if (!Number.isFinite(sec) || sec < 1) {
        sec = Math.min(90, Math.pow(2, attempt) * 2);
      }
      waitMs = Math.min(120000, sec * 1000);
      waitMs = Math.max(2000, waitMs);
    } else {
      waitMs = baseDelayOther * attempt;
    }
    console.warn(
      `[Tony Cloud Function] ${label} retry ${attempt}/${maxAttempts - 1} dopo ${waitMs}ms (status ${res.status})`
    );
    await sleep(waitMs);
  }
  if (lastStatus === 429) {
    throw new HttpsError(
      "resource-exhausted",
      "Servizio AI temporaneamente al limite di richieste. Riprova tra qualche decina di secondi."
    );
  }
  throw new HttpsError("internal", "Errore chiamata Gemini: " + (lastStatus || "unknown"));
}

/**
 * Applica un chunk SSE / payload JSON: accumula testo e meta finish.
 * @returns {{ text: string, finishReason: string|null, usageMetadata: object|null }}
 */
function consumeGeminiPayload(parsed, state, onDelta) {
  if (!parsed || typeof parsed !== "object") return state;
  const meta = extractGeminiFinishMeta(parsed);
  if (meta.finishReason) state.finishReason = meta.finishReason;
  if (meta.usageMetadata) state.usageMetadata = meta.usageMetadata;

  const parts = parsed?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return state;
  for (const part of parts) {
    const delta = part?.text;
    if (typeof delta === "string" && delta.length > 0) {
      state.text += delta;
      if (onDelta) onDelta(delta);
    }
  }
  return state;
}

/**
 * Stream Gemini generateContent (SSE alt=sse). Invoca onDelta per ogni chunk testo.
 * @returns {Promise<{ text: string, finishReason: string|null, usageMetadata: object|null }>}
 */
async function streamGeminiGenerateContent(streamUrl, body, onDelta, stats) {
  const res = await callGeminiWithRetry(streamUrl, body, "stream", stats);
  const streamBody = res.body;
  const state = { text: "", finishReason: null, usageMetadata: null };

  if (!streamBody || typeof streamBody.getReader !== "function") {
    const data = await res.json();
    consumeGeminiPayload(data, state, onDelta);
    return state;
  }

  const reader = streamBody.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
    }
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        consumeGeminiPayload(JSON.parse(payload), state, onDelta);
      } catch (_) {
        /* ignora chunk SSE non JSON */
      }
    }
    if (done) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        for (const line of buffer.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            consumeGeminiPayload(JSON.parse(payload), state, onDelta);
          } catch (_) {}
        }
      }
      break;
    }
  }

  return state;
}

function geminiStreamUrl(generateUrl) {
  return String(generateUrl).replace(":generateContent?", ":streamGenerateContent?") + "&alt=sse";
}

module.exports = {
  sleep,
  callGeminiWithRetry,
  streamGeminiGenerateContent,
  geminiStreamUrl,
  buildTonyGenerationConfig,
  extractGeminiFinishMeta,
  recordTonyGeminiFinish,
  looksLikeTruncatedStructuredJson,
  appendMaxTokensNotice,
  TONY_MAX_TOKENS_NOTICE,
  TONY_MAX_OUTPUT_DEFAULT,
  TONY_MAX_OUTPUT_RETRY,
};
