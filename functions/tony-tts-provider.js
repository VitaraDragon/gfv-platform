"use strict";

/**
 * Provider TTS per getTonyAudio.
 * ElevenLabs (voce da vecchio) oppure Google Chirp 3 — stesso contratto: MP3 base64.
 * Nessuna logica di pagina: solo env + chiave.
 */

const TONY_TTS_ELEVEN_VOICE_DEFAULT = "5zD2eYSLIo8c2zkowMfP";
const TONY_TTS_GOOGLE_VOICE_DEFAULT = "it-IT-Chirp3-HD-Charon";
const TONY_TTS_ELEVEN_MODEL_DEFAULT = "eleven_flash_v2_5";
const TONY_TTS_ELEVEN_URL = "https://api.elevenlabs.io/v1/text-to-speech";

function isGoogleVoiceName(name) {
  return /^(it-IT|en-US|en-GB|de-DE|fr-FR|es-ES)-/i.test(String(name || "").trim());
}

function clampElevenSpeed(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return 1;
  if (n < 0.7) return 0.7;
  if (n > 1.2) return 1.2;
  return n;
}

/**
 * @param {{ env?: NodeJS.ProcessEnv, elevenLabsApiKey?: string }} [opts]
 */
function resolveTonyTtsConfig(opts) {
  const env = (opts && opts.env) || process.env;
  const keyFromOpts = opts && typeof opts.elevenLabsApiKey === "string" ? opts.elevenLabsApiKey.trim() : "";
  const keyFromEnv = String(env.ELEVENLABS_API_KEY || "").trim();
  const apiKey = keyFromOpts || keyFromEnv;

  const requested = String(env.TONY_TTS_PROVIDER || "elevenlabs").trim().toLowerCase();
  let provider = requested === "google" || requested === "chirp" ? "google" : "elevenlabs";
  let fallbackReason = "";
  if (provider === "elevenlabs" && !apiKey) {
    provider = "google";
    fallbackReason = "missing_elevenlabs_key";
  }

  const envVoice = String(env.TONY_TTS_VOICE || "").trim();
  const elevenOverride = String(env.TONY_TTS_ELEVEN_VOICE || "").trim();
  let voice;
  if (provider === "elevenlabs") {
    if (elevenOverride) voice = elevenOverride;
    else if (envVoice && !isGoogleVoiceName(envVoice)) voice = envVoice;
    else voice = TONY_TTS_ELEVEN_VOICE_DEFAULT;
  } else if (envVoice && isGoogleVoiceName(envVoice)) {
    voice = envVoice;
  } else {
    voice = TONY_TTS_GOOGLE_VOICE_DEFAULT;
  }

  const speakingRate = Number(env.TONY_TTS_SPEAKING_RATE || "1.0");
  const modelId = String(env.TONY_TTS_ELEVEN_MODEL || TONY_TTS_ELEVEN_MODEL_DEFAULT).trim() ||
    TONY_TTS_ELEVEN_MODEL_DEFAULT;

  return {
    provider,
    voice,
    speakingRate: Number.isFinite(speakingRate) ? speakingRate : 1,
    modelId,
    apiKey,
    fallbackReason,
  };
}

/**
 * @param {{
 *   text: string,
 *   voice: string,
 *   modelId: string,
 *   speakingRate: number,
 *   apiKey: string,
 *   fetchFn?: typeof fetch
 * }} args
 */
async function synthesizeElevenLabsAudio(args) {
  const fetchFn = args.fetchFn || fetch;
  const voice = encodeURIComponent(args.voice);
  const url = TONY_TTS_ELEVEN_URL + "/" + voice + "?output_format=mp3_44100_128";
  const res = await fetchFn(url, {
    method: "POST",
    headers: {
      "xi-api-key": args.apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: args.text,
      model_id: args.modelId,
      speed: clampElevenSpeed(args.speakingRate),
    }),
  });
  if (!res.ok) {
    const errText = typeof res.text === "function" ? await res.text() : "";
    throw new Error(
      "ElevenLabs TTS " + res.status + ": " + String(errText || "").slice(0, 200)
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) {
    throw new Error("ElevenLabs TTS: risposta audio vuota");
  }
  return buf.toString("base64");
}

module.exports = {
  TONY_TTS_ELEVEN_VOICE_DEFAULT,
  TONY_TTS_GOOGLE_VOICE_DEFAULT,
  TONY_TTS_ELEVEN_MODEL_DEFAULT,
  isGoogleVoiceName,
  clampElevenSpeed,
  resolveTonyTtsConfig,
  synthesizeElevenLabsAudio,
};
