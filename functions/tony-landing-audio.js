"use strict";

/**
 * tonyLandingAudio — voce dal vivo di Tony sulla landing (passo 12b).
 * HTTP onRequest, MP3 in streaming da ElevenLabs, App Check, biglietto monouso,
 * tetto caratteri giornaliero. Stessa chiave e stessa voce del Tony dell'app.
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAppCheck } = require("firebase-admin/app-check");
const {
  COSTANTI,
  origineAmmessa,
  normalizzaConfig,
  chiaviTempo,
  scadenze
} = require("./lib/tony-landing-limiti");
const {
  COSTANTI_VOCE,
  preparaTestoVoce,
  impronta,
  validaRichiestaVoce,
  decidiVoce,
  corpoElevenLabs,
  urlElevenLabs,
  statoPerCodice
} = require("./lib/tony-landing-voce");
const {
  leggiSubscriptionElevenLabs,
  decidiMargineVoce
} = require("./lib/tony-landing-elevenlabs-quota");
const { readJsonBody } = require("./tony-landing-ask");

const elevenLabsApiKey = defineSecret("ELEVENLABS_API_KEY");

const COLLEZIONE_QUOTA = "tonyLandingQuota";
const DOC_CONFIG = "tonyLanding";

/** Cache in memoria di config/tonyLanding (svuotabile nei test). */
let cacheConfig = { valore: null, lettoA: 0, giorno: "" };

/**
 * Svuota la cache in memoria (solo per i test).
 */
function svuotaCacheTonyLandingAudio() {
  cacheConfig = { valore: null, lettoA: 0, giorno: "" };
}

function impostaCors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Firebase-AppCheck"
  );
  res.setHeader("Access-Control-Max-Age", "3600");
}

function logRiga(livello, parti) {
  const riga = "[tonyLandingAudio] " + parti.join(" ");
  if (livello === "error") console.error(riga);
  else if (livello === "warn") console.warn(riga);
  else console.info(riga);
}

function rispondiCodice(res, codice) {
  const stato = statoPerCodice(codice);
  res.status(stato).json({ codice: codice });
}

async function leggiConfigDefault(db, adesso) {
  const ora = adesso.getTime();
  if (
    cacheConfig.valore &&
    ora - cacheConfig.lettoA < COSTANTI.CACHE_CONFIG_MS &&
    cacheConfig.giorno === chiaviTempo(adesso).giorno
  ) {
    return cacheConfig.valore;
  }
  try {
    const snap = await db.collection("config").doc(DOC_CONFIG).get();
    const dati = snap.exists ? snap.data() || {} : null;
    const normale = normalizzaConfig(dati);
    cacheConfig = {
      valore: normale,
      lettoA: ora,
      giorno: chiaviTempo(adesso).giorno
    };
    return normale;
  } catch (_e) {
    const spento = normalizzaConfig(null);
    cacheConfig = {
      valore: spento,
      lettoA: ora,
      giorno: chiaviTempo(adesso).giorno
    };
    return spento;
  }
}

/**
 * Chiamata a ElevenLabs in streaming.
 * @param {string} testoVoce
 * @param {{ chiave: string, segnale?: AbortSignal, fetchFn?: typeof fetch }} opts
 */
async function sintetizzaDefault(testoVoce, opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  const fetchFn = typeof o.fetchFn === "function" ? o.fetchFn : fetch;
  const risposta = await fetchFn(urlElevenLabs(), {
    method: "POST",
    headers: {
      "xi-api-key": o.chiave || "",
      "Content-Type": "application/json",
      Accept: "audio/mpeg"
    },
    body: JSON.stringify(corpoElevenLabs(testoVoce)),
    signal: o.segnale
  });
  return risposta;
}

/**
 * Consuma il biglietto e aggiorna i contatori voce (prima della sintesi).
 */
async function consumaBigliettoVoce(db, args) {
  const {
    idVoce,
    hashTesto,
    hashSessione,
    config,
    adessoMs,
    expireContatori,
    expireMese,
    giorno,
    mese
  } = args;

  const refB = db.collection(COLLEZIONE_QUOTA).doc("voce_" + idVoce);
  const refG = db.collection(COLLEZIONE_QUOTA).doc("g_" + giorno);
  const refM = db.collection(COLLEZIONE_QUOTA).doc("m_" + mese);

  return db.runTransaction(async function (tx) {
    const [snapB, snapG, snapM] = await Promise.all([
      tx.get(refB),
      tx.get(refG),
      tx.get(refM)
    ]);
    const biglietto = snapB.exists ? snapB.data() || {} : null;
    const g = snapG.exists ? snapG.data() || {} : {};
    const m = snapM.exists ? snapM.data() || {} : {};

    const decisione = decidiVoce({
      config: config,
      biglietto: biglietto,
      hashTesto: hashTesto,
      hashSessione: hashSessione,
      adessoMs: adessoMs,
      caratteriGiorno:
        typeof g.caratteriVoce === "number" ? g.caratteriVoce : 0,
      margineVoce: args.margineVoce
    });

    if (!decisione.consentita) {
      return { consentita: false, codice: decisione.codice, caratteri: 0 };
    }

    const caratteri = decisione.caratteri;
    const expireG = Timestamp.fromDate(expireContatori);
    const expireMe = Timestamp.fromDate(expireMese);
    const ts = FieldValue.serverTimestamp();

    tx.set(
      refB,
      {
        usato: true,
        usatoIl: ts
      },
      { merge: true }
    );
    // Solo caratteri voce: la spesa in euro è solo Gemini (tonyLandingAsk).
    tx.set(
      refG,
      {
        caratteriVoce: FieldValue.increment(caratteri),
        voci: FieldValue.increment(1),
        expireAt: expireG,
        aggiornatoIl: ts
      },
      { merge: true }
    );
    tx.set(
      refM,
      {
        caratteriVoce: FieldValue.increment(caratteri),
        expireAt: expireMe,
        aggiornatoIl: ts
      },
      { merge: true }
    );

    return { consentita: true, codice: "ok", caratteri: caratteri };
  });
}

/**
 * Scrive lo stream audio sulla risposta HTTP.
 * @param {object} res
 * @param {Response} rispostaEleven
 */
async function pipeAudio(res, rispostaEleven) {
  res.status(200);
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const body = rispostaEleven.body;
  if (body && typeof body.getReader === "function") {
    const reader = body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    res.end();
    return;
  }
  if (body && typeof body.pipe === "function") {
    await new Promise(function (resolve, reject) {
      body.on("error", reject);
      body.on("end", resolve);
      body.pipe(res);
    });
    return;
  }
  const buf = Buffer.from(await rispostaEleven.arrayBuffer());
  res.write(buf);
  res.end();
}

/**
 * Gestore HTTP (testabile con dipendenze iniettate).
 * @param {object} req
 * @param {object} res
 * @param {{
 *   db?: object,
 *   verificaAppCheck?: Function,
 *   leggiConfig?: Function,
 *   adesso?: Function|Date,
 *   sintetizza?: Function
 * }=} opzioni
 */
async function handleTonyLandingAudio(req, res, opzioni) {
  const inizio = Date.now();
  const opt = opzioni && typeof opzioni === "object" ? opzioni : {};
  const adessoFn =
    typeof opt.adesso === "function"
      ? opt.adesso
      : opt.adesso instanceof Date
        ? function () {
            return opt.adesso;
          }
        : function () {
            return new Date();
          };
  const db = opt.db || admin.firestore();
  const verificaAppCheck =
    typeof opt.verificaAppCheck === "function"
      ? opt.verificaAppCheck
      : async function (token) {
          return getAppCheck().verifyToken(token);
        };
  const leggiConfig =
    typeof opt.leggiConfig === "function"
      ? opt.leggiConfig
      : function (database, quando) {
          return leggiConfigDefault(database, quando);
        };
  const sintetizza =
    typeof opt.sintetizza === "function"
      ? opt.sintetizza
      : async function (testoVoce, segnali) {
          const chiave = elevenLabsApiKey.value();
          return sintetizzaDefault(testoVoce, {
            chiave: chiave,
            segnale: segnali && segnali.segnale
          });
        };
  const leggiSub =
    typeof opt.leggiSubscription === "function"
      ? opt.leggiSubscription
      : async function () {
          let chiave = "";
          try {
            chiave = elevenLabsApiKey.value();
          } catch (_e) {
            chiave = "";
          }
          return leggiSubscriptionElevenLabs({
            chiave: chiave,
            fetchFn: opt.fetchFn
          });
        };

  try {
    const origin = req.headers && req.headers.origin;
    if (!origineAmmessa(origin)) {
      res.status(403).json({ codice: "origine-non-ammessa" });
      logRiga("info", [
        "esito=bloccato",
        "codice=origine-non-ammessa",
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }
    impostaCors(res, origin);

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      rispondiCodice(res, "metodo-non-ammesso");
      logRiga("info", [
        "esito=bloccato",
        "codice=metodo-non-ammesso",
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }

    const tokenAppCheck =
      req.headers &&
      (req.headers["x-firebase-appcheck"] || req.headers["X-Firebase-AppCheck"]);
    if (!tokenAppCheck || typeof tokenAppCheck !== "string") {
      rispondiCodice(res, "app-check-mancante");
      logRiga("info", [
        "esito=bloccato",
        "codice=app-check-mancante",
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }
    try {
      await verificaAppCheck(tokenAppCheck);
    } catch (_e) {
      rispondiCodice(res, "app-check-non-valido");
      logRiga("info", [
        "esito=bloccato",
        "codice=app-check-non-valido",
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }

    let corpo;
    try {
      corpo = await readJsonBody(req, COSTANTI_VOCE.MAX_BYTE_RICHIESTA);
    } catch (e) {
      if (e && e.codice === "corpo-troppo-grande") {
        rispondiCodice(res, "corpo-troppo-grande");
        logRiga("info", [
          "esito=bloccato",
          "codice=corpo-troppo-grande",
          "ms=" + (Date.now() - inizio)
        ]);
        return;
      }
      const codice = (e && e.codice) || "richiesta-non-valida";
      rispondiCodice(res, codice);
      logRiga("info", [
        "esito=bloccato",
        "codice=" + codice,
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }

    const validata = validaRichiestaVoce(corpo);
    if (!validata.ok) {
      rispondiCodice(res, validata.codice);
      logRiga("info", [
        "esito=bloccato",
        "codice=" + validata.codice,
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }

    const adesso = adessoFn();
    let config;
    try {
      config = await leggiConfig(db, adesso);
    } catch (_cfgErr) {
      config = normalizzaConfig(null);
    }
    if (config.enabled !== true || config.voiceEnabled !== true) {
      rispondiCodice(res, "voce-spenta");
      logRiga("info", [
        "esito=bloccato",
        "codice=voce-spenta",
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }

    const { giorno, mese } = chiaviTempo(adesso);
    const scad = scadenze(adesso);
    const hashTesto = impronta(validata.testo);
    const hashSessione = impronta(validata.sessione);

    let margineVoce = { consentita: true, codice: "ok" };
    try {
      const subEsito = await leggiSub();
      if (!subEsito || subEsito.ok !== true) {
        margineVoce = decidiMargineVoce({ apiFallita: true });
        logRiga("warn", [
          "margine-elevenlabs=non-leggibile",
          "errore=" + String((subEsito && subEsito.errore) || "sconosciuto")
        ]);
      } else {
        margineVoce = decidiMargineVoce({
          sub: subEsito.sub,
          voiceReserveChars: config.voiceReserveChars
        });
      }
    } catch (_subErr) {
      margineVoce = decidiMargineVoce({ apiFallita: true });
      logRiga("warn", ["margine-elevenlabs=non-leggibile", "errore=eccezione"]);
    }

    let consumo;
    try {
      consumo = await consumaBigliettoVoce(db, {
        idVoce: validata.idVoce,
        hashTesto: hashTesto,
        hashSessione: hashSessione,
        config: config,
        adessoMs: adesso.getTime(),
        expireContatori: scad.contatori,
        expireMese: scad.mese,
        giorno: giorno,
        mese: mese,
        margineVoce: margineVoce
      });
    } catch (_e) {
      rispondiCodice(res, "errore");
      logRiga("error", [
        "esito=errore",
        "codice=errore",
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }

    if (!consumo.consentita) {
      rispondiCodice(res, consumo.codice);
      logRiga("info", [
        "esito=bloccato",
        "codice=" + consumo.codice,
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }

    const testoVoce = preparaTestoVoce(validata.testo);
    const ac =
      typeof AbortController === "function" ? new AbortController() : null;
    const timer = ac
      ? setTimeout(function () {
          ac.abort();
        }, COSTANTI_VOCE.TIMEOUT_ELEVENLABS_MS)
      : null;
    const onClose = function () {
      if (ac) ac.abort();
    };
    if (req && typeof req.on === "function") {
      req.on("close", onClose);
    }

    let rispostaEleven;
    try {
      rispostaEleven = await sintetizza(testoVoce, {
        segnale: ac ? ac.signal : undefined
      });
    } catch (e) {
      clearTimeout(timer);
      if (req && typeof req.off === "function") req.off("close", onClose);
      else if (req && typeof req.removeListener === "function") {
        req.removeListener("close", onClose);
      }
      const abortito =
        e &&
        (e.name === "AbortError" ||
          String(e.message || "").includes("abort"));
      rispondiCodice(res, "voce-errore");
      logRiga("warn", [
        "esito=bloccato",
        "codice=voce-errore",
        "motivo=" + (abortito ? "timeout" : "elevenlabs-errore"),
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }
    clearTimeout(timer);
    if (req && typeof req.off === "function") req.off("close", onClose);
    else if (req && typeof req.removeListener === "function") {
      req.removeListener("close", onClose);
    }

    if (
      !rispostaEleven ||
      !rispostaEleven.ok ||
      !rispostaEleven.body
    ) {
      const status =
        rispostaEleven && typeof rispostaEleven.status === "number"
          ? rispostaEleven.status
          : 0;
      rispondiCodice(res, "voce-errore");
      logRiga("warn", [
        "esito=bloccato",
        "codice=voce-errore",
        "motivo=elevenlabs-" + status,
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }

    try {
      await pipeAudio(res, rispostaEleven);
      logRiga("info", [
        "esito=ok",
        "caratteri=" + consumo.caratteri,
        "ms=" + (Date.now() - inizio)
      ]);
    } catch (_pipeErr) {
      try {
        res.end();
      } catch (_e) {
        /* ignore */
      }
      logRiga("warn", [
        "esito=bloccato",
        "codice=voce-errore",
        "motivo=stream-interrotto",
        "ms=" + (Date.now() - inizio)
      ]);
    }
  } catch (_e) {
    try {
      if (!res.headersSent) rispondiCodice(res, "errore");
    } catch (_e2) {
      /* ignore */
    }
    logRiga("error", [
      "esito=errore",
      "codice=errore",
      "ms=" + (Date.now() - inizio)
    ]);
  }
}

exports.tonyLandingAudio = onRequest(
  {
    region: "europe-west1",
    secrets: [elevenLabsApiKey],
    timeoutSeconds: 30,
    memory: "256MiB",
    maxInstances: 5,
    cors: false,
    invoker: "public"
  },
  function (req, res) {
    return handleTonyLandingAudio(req, res);
  }
);

exports.handleTonyLandingAudio = handleTonyLandingAudio;
exports.svuotaCacheTonyLandingAudio = svuotaCacheTonyLandingAudio;
exports.sintetizzaDefault = sintetizzaDefault;
