"use strict";

const { HttpsError } = require("firebase-functions/v2/https");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
 * Stream Gemini generateContent (SSE alt=sse). Invoca onDelta per ogni chunk testo.
 * @returns {Promise<string>} testo completo accumulato
 */
async function streamGeminiGenerateContent(streamUrl, body, onDelta, stats) {
  const res = await callGeminiWithRetry(streamUrl, body, "stream", stats);
  const streamBody = res.body;
  if (!streamBody || typeof streamBody.getReader !== "function") {
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (text && onDelta) onDelta(text);
    return text;
  }

  const reader = streamBody.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload);
          const parts = parsed?.candidates?.[0]?.content?.parts;
          if (!Array.isArray(parts)) continue;
          for (const part of parts) {
            const delta = part?.text;
            if (typeof delta === "string" && delta.length > 0) {
              fullText += delta;
              if (onDelta) onDelta(delta);
            }
          }
        } catch (_) {
          /* ignora chunk SSE non JSON */
        }
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
            const parsed = JSON.parse(payload);
            const parts = parsed?.candidates?.[0]?.content?.parts;
            if (!Array.isArray(parts)) continue;
            for (const part of parts) {
              const delta = part?.text;
              if (typeof delta === "string" && delta.length > 0) {
                fullText += delta;
                if (onDelta) onDelta(delta);
              }
            }
          } catch (_) {}
        }
      }
      break;
    }
  }

  return fullText;
}

function geminiStreamUrl(generateUrl) {
  return String(generateUrl).replace(":generateContent?", ":streamGenerateContent?") + "&alt=sse";
}

module.exports = {
  sleep,
  callGeminiWithRetry,
  streamGeminiGenerateContent,
  geminiStreamUrl,
};
