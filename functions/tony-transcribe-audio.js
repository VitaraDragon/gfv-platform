"use strict";

/**
 * Tony — trascrizione vocale server-side (Gemini audio).
 *
 * Serve alle piattaforme dove la Web Speech API non è disponibile
 * (web app iOS aggiunte alla schermata Home: WebKit bug 225298).
 * Il client registra con getUserMedia + MediaRecorder e invia il clip;
 * qui lo passiamo a Gemini con `inlineData` e restituiamo solo il testo.
 */

const { HttpsError } = require("firebase-functions/v2/https");
const { callGeminiWithRetry } = require("./tony-gemini-api");

const TONY_TRANSCRIBE_GEMINI_MODEL =
  process.env.GEMINI_TRANSCRIBE_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";

/** Base64 max: ~3 MB ≈ 60 s di AAC 48 kbps o ~90 s di Opus 32 kbps. */
const MAX_AUDIO_BASE64_CHARS = 4 * 1024 * 1024;
const MAX_AUDIO_DURATION_MS = 60000;

/** Contenitori che MediaRecorder produce (Safari → mp4/AAC, Chromium → webm/Opus). */
const ALLOWED_AUDIO_MIME = new Set([
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/x-aac",
  "audio/mpeg",
  "audio/mp3",
  "audio/webm",
  "audio/ogg",
  "audio/opus",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
]);

/** Alias → MIME che Gemini elenca tra quelli supportati. */
const GEMINI_MIME_ALIAS = {
  "audio/x-m4a": "audio/m4a",
  "audio/x-aac": "audio/aac",
  "audio/x-wav": "audio/wav",
  "audio/mp3": "audio/mpeg",
};

const TRANSCRIBE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    hasSpeech: { type: "BOOLEAN" },
    transcript: { type: "STRING" },
  },
  required: ["hasSpeech", "transcript"],
};

/**
 * `audio/webm;codecs=opus` → `audio/webm`; alias x-m4a → m4a.
 * @param {string} raw
 * @returns {string} MIME normalizzato ('' se vuoto)
 */
function normalizeAudioMimeType(raw) {
  const base = String(raw || "").split(";")[0].trim().toLowerCase();
  if (!base) return "";
  return GEMINI_MIME_ALIAS[base] || base;
}

/**
 * Valida il payload audio inviato dal client.
 * @param {{ mimeType?: string, data?: string, durationMs?: number }} audio
 * @returns {{ mimeType: string, data: string, durationMs: number|null }}
 */
function validateAudioPayload(audio) {
  if (!audio || typeof audio !== "object") {
    throw new Error("Campo 'audio' obbligatorio.");
  }
  const mimeType = normalizeAudioMimeType(audio.mimeType);
  if (!mimeType || !ALLOWED_AUDIO_MIME.has(mimeType)) {
    throw new Error("Formato audio non supportato: " + (audio.mimeType || "(vuoto)"));
  }
  const data = typeof audio.data === "string" ? audio.data.trim() : "";
  if (!data) {
    throw new Error("Audio vuoto.");
  }
  if (data.length > MAX_AUDIO_BASE64_CHARS) {
    throw new Error("Clip audio troppo lungo (max ~60 secondi).");
  }
  if (!/^[A-Za-z0-9+/=\s]+$/.test(data.slice(0, 256))) {
    throw new Error("Audio non in formato base64.");
  }
  let durationMs = null;
  if (audio.durationMs != null) {
    const d = Number(audio.durationMs);
    if (Number.isFinite(d) && d >= 0) {
      durationMs = Math.round(d);
      if (durationMs > MAX_AUDIO_DURATION_MS) {
        throw new Error("Clip audio troppo lungo (max 60 secondi).");
      }
    }
  }
  return { mimeType, data, durationMs };
}

/**
 * @param {{ lang?: string, hint?: string }} [opts]
 * @returns {string}
 */
function buildTranscribePrompt(opts) {
  opts = opts || {};
  const lang = String(opts.lang || "it-IT").toLowerCase().startsWith("it") ? "italiano" : "la lingua parlata";
  const lines = [
    "Sei il modulo di trascrizione vocale di un assistente per aziende agricole.",
    "Trascrivi fedelmente ciò che dice la persona nell'audio, in " + lang + ".",
    "Regole:",
    "- Restituisci solo le parole pronunciate, con punteggiatura naturale. Nessun commento, nessuna risposta alla richiesta.",
    "- Numeri e orari in cifre (es. «dalle 7 alle 12», «3 ettari», «250 litri»).",
    "- Non tradurre, non riassumere, non correggere il senso: solo trascrizione.",
    "- Se non c'è parlato comprensibile (silenzio, rumore, musica) imposta hasSpeech=false e transcript vuoto.",
  ];
  if (opts.hint && typeof opts.hint === "string") {
    const hint = opts.hint.trim().slice(0, 400);
    if (hint) lines.push("Termini frequenti in questo contesto (usali se li senti): " + hint);
  }
  return lines.join("\n");
}

/**
 * Interpreta la risposta JSON di Gemini; tollera testo nudo come fallback.
 * @param {string} rawText
 * @returns {{ transcript: string, hasSpeech: boolean }}
 */
function parseTranscriptionResponse(rawText) {
  const raw = typeof rawText === "string" ? rawText.trim() : "";
  if (!raw) return { transcript: "", hasSpeech: false };
  let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      const transcript = typeof parsed.transcript === "string" ? parsed.transcript.trim() : "";
      const hasSpeech = parsed.hasSpeech != null ? !!parsed.hasSpeech : transcript.length > 0;
      return { transcript: hasSpeech ? transcript : "", hasSpeech: hasSpeech && transcript.length > 0 };
    }
  } catch (e) {
    /* testo nudo */
  }
  const asText = cleaned.replace(/\s+/g, " ").trim();
  return { transcript: asText, hasSpeech: asText.length > 0 };
}

function geminiTranscribeUrl(apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${TONY_TRANSCRIBE_GEMINI_MODEL}:generateContent?key=${apiKey}`;
}

/**
 * @param {string} apiKey
 * @param {{ mimeType: string, data: string }} audio
 * @param {{ lang?: string, hint?: string }} opts
 * @param {{ retryCount?: number }} stats
 * @returns {Promise<{ transcript: string, hasSpeech: boolean }>}
 */
async function transcribeAudioWithGemini(apiKey, audio, opts, stats) {
  const body = {
    contents: [
      {
        parts: [
          { text: buildTranscribePrompt(opts) },
          { inlineData: { mimeType: audio.mimeType, data: audio.data } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 512,
      responseMimeType: "application/json",
      responseSchema: TRANSCRIBE_RESPONSE_SCHEMA,
    },
  };
  const res = await callGeminiWithRetry(geminiTranscribeUrl(apiKey), body, "tonyTranscribeAudio", stats);
  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return parseTranscriptionResponse(rawText);
}

/**
 * Handler callable tonyTranscribeAudio.
 * Body: { audio: { mimeType, data, durationMs? }, lang?, hint?, tenantId?, context? }
 * @param {object} db Firestore
 * @param {object} request onCall request
 * @param {{ resolveTenantId: Function, resolvePlan: Function }} deps
 */
async function handleTonyTranscribeAudio(db, request, deps) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Utente non autenticato.");
  }
  const reqData = request.data || {};
  const ctx = reqData.context != null ? reqData.context : {};
  const dashboard = ctx.dashboard != null ? ctx.dashboard : {};

  const tenantId = await deps.resolveTenantId(db, request.auth.uid, dashboard, ctx, reqData.tenantId);
  if (!tenantId) {
    throw new HttpsError("failed-precondition", "Tenant non risolvibile per l'utente corrente.");
  }
  const planId = await deps.resolvePlan(db, dashboard, ctx, tenantId);
  if (planId === "free") {
    throw new HttpsError(
      "permission-denied",
      "Tony non è disponibile sul piano Free. Passa al piano Base dalla pagina Abbonamento."
    );
  }

  let audio;
  try {
    audio = validateAudioPayload(reqData.audio);
  } catch (e) {
    throw new HttpsError("invalid-argument", e.message || "Audio non valido.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "Chiave Gemini non configurata (GEMINI_API_KEY).");
  }

  const started = Date.now();
  const stats = {};
  let result;
  try {
    result = await transcribeAudioWithGemini(
      apiKey,
      audio,
      { lang: reqData.lang, hint: reqData.hint },
      stats
    );
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error("[tonyTranscribeAudio] trascrizione fallita:", e);
    throw new HttpsError("internal", "Trascrizione non riuscita: " + (e.message || "errore Gemini"));
  }

  console.info("[tonyTranscribeAudio]", {
    tenantId,
    mimeType: audio.mimeType,
    base64Chars: audio.data.length,
    durationMs: audio.durationMs,
    hasSpeech: result.hasSpeech,
    chars: result.transcript.length,
    geminiMs: Date.now() - started,
    retry: stats.retryCount || 0,
  });

  return {
    ok: true,
    tenantId,
    model: TONY_TRANSCRIBE_GEMINI_MODEL,
    transcript: result.transcript,
    hasSpeech: result.hasSpeech,
    geminiMs: Date.now() - started,
    geminiRetryCount: stats.retryCount || 0,
  };
}

module.exports = {
  handleTonyTranscribeAudio,
  transcribeAudioWithGemini,
  normalizeAudioMimeType,
  validateAudioPayload,
  buildTranscribePrompt,
  parseTranscriptionResponse,
  ALLOWED_AUDIO_MIME,
  MAX_AUDIO_BASE64_CHARS,
  MAX_AUDIO_DURATION_MS,
  TONY_TRANSCRIBE_GEMINI_MODEL,
};
