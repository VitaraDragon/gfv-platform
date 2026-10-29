"use strict";

/**
 * tonyLandingAsk — domande dei visitatori della landing senza login (passo 10).
 * HTTP onRequest, SSE, App Check obbligatorio nel codice, CORS ristretto,
 * limiti 15/30/1000, tetto 30 €/mese, interruttore config/tonyLanding.
 * Non tocca i dati delle aziende né Tony dell'app.
 */

const crypto = require("node:crypto");
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
  scadenze,
  ipDaRichiesta,
  idVisitatore,
  idSessione,
  idAccount,
  validaRichiesta,
  contieneDatiPersonali,
  decidiDomanda,
  decidiDomandaAccount,
  messaggioPerCodice,
  costoStimatoEur,
  tokenDaUsage,
  corpoRichiestaGemini,
  testoDaPayloadGemini,
  rigaSse
} = require("./lib/tony-landing-limiti");
// Prompt definitivo con base di conoscenza (passo 11).
const { PROMPT_SISTEMA_LANDING } = require("./lib/tony-landing-prompt");
const {
  SCHEMA_RISPOSTA_ACCOUNT,
  promptSistemaAccount,
  rispostaAccountDaTesto
} = require("./lib/tony-landing-account");
const {
  COSTANTI_VOCE,
  preparaTestoVoce,
  nuovoIdVoce,
  datiBiglietto
} = require("./lib/tony-landing-voce");

const geminiApiKey = defineSecret("GEMINI_API_KEY");

const COLLEZIONE_QUOTA = "tonyLandingQuota";
const DOC_CONFIG = "tonyLanding";

/** Cache in memoria di config/tonyLanding (svuotabile nei test). */
let cacheConfig = { valore: null, lettoA: 0, giorno: "" };

/** Cache in memoria del sale del giorno. */
let cacheSale = { giorno: "", sale: "" };

/**
 * Svuota le cache in memoria (solo per i test).
 */
function svuotaCacheTonyLandingAsk() {
  cacheConfig = { valore: null, lettoA: 0, giorno: "" };
  cacheSale = { giorno: "", sale: "" };
}

/**
 * Body JSON con limite di dimensione (copia adattata da tony-ask-stream).
 * @param {object} req
 * @param {number} maxByte
 */
async function readJsonBody(req, maxByte) {
  let body = req.body;
  if (Buffer.isBuffer(body)) {
    if (body.length > maxByte) {
      const err = new Error("corpo-troppo-grande");
      err.codice = "corpo-troppo-grande";
      throw err;
    }
    try {
      return JSON.parse(body.toString("utf8"));
    } catch (_e) {
      const err = new Error("json-non-valido");
      err.codice = "richiesta-non-valida";
      throw err;
    }
  }
  if (typeof body === "string") {
    if (Buffer.byteLength(body, "utf8") > maxByte) {
      const err = new Error("corpo-troppo-grande");
      err.codice = "corpo-troppo-grande";
      throw err;
    }
    try {
      return JSON.parse(body);
    } catch (_e) {
      const err = new Error("json-non-valido");
      err.codice = "richiesta-non-valida";
      throw err;
    }
  }
  if (body && typeof body === "object") {
    const stimato = Buffer.byteLength(JSON.stringify(body), "utf8");
    if (stimato > maxByte) {
      const err = new Error("corpo-troppo-grande");
      err.codice = "corpo-troppo-grande";
      throw err;
    }
    return body;
  }
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let totale = 0;
    let chiuso = false;
    req.on("data", function (c) {
      if (chiuso) return;
      totale += c.length;
      if (totale > maxByte) {
        chiuso = true;
        const err = new Error("corpo-troppo-grande");
        err.codice = "corpo-troppo-grande";
        reject(err);
        return;
      }
      chunks.push(c);
    });
    req.on("end", function () {
      if (chiuso) return;
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (_e) {
        const err = new Error("json-non-valido");
        err.codice = "richiesta-non-valida";
        reject(err);
      }
    });
    req.on("error", function () {
      if (chiuso) return;
      const err = new Error("json-non-valido");
      err.codice = "richiesta-non-valida";
      reject(err);
    });
  });
}

function impostaCors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Firebase-AppCheck, Authorization"
  );
  res.setHeader("Access-Control-Max-Age", "3600");
}

function avviaSse(res) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();
  res.write(": tony-landing-ask-open " + " ".repeat(2048) + "\n\n");
  if (typeof res.flush === "function") res.flush();
}

function scriviSse(res, evento, dati) {
  res.write(rigaSse(evento, dati));
  if (typeof res.flush === "function") res.flush();
}

function chiudiDone(res, payload) {
  scriviSse(res, "done", payload);
  res.end();
}

function logRiga(livello, parti) {
  const riga = "[tonyLandingAsk] " + parti.join(" ");
  if (livello === "error") console.error(riga);
  else if (livello === "warn") console.warn(riga);
  else console.info(riga);
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
 * Sale del giorno: crea se manca (transazione a parte).
 * Grazie al TTL il sale viene cancellato, e senza sale gli ID dei visitatori
 * non si possono più ricollegare a un IP.
 */
async function ottieniSaleGiorno(db, giorno, expireContatori) {
  if (cacheSale.giorno === giorno && cacheSale.sale) return cacheSale.sale;
  const ref = db.collection(COLLEZIONE_QUOTA).doc("sale_" + giorno);
  const sale = await db.runTransaction(async function (tx) {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const dati = snap.data() || {};
      if (typeof dati.sale === "string" && dati.sale) return dati.sale;
    }
    const nuovo = crypto.randomBytes(32).toString("hex");
    tx.set(
      ref,
      {
        sale: nuovo,
        creatoIl: FieldValue.serverTimestamp(),
        expireAt: Timestamp.fromDate(expireContatori)
      },
      { merge: true }
    );
    return nuovo;
  });
  cacheSale = { giorno: giorno, sale: sale };
  return sale;
}

/**
 * Transazione contatori: decide e, se consentita, incrementa le domande.
 */
async function consumaQuota(db, args) {
  const {
    giorno,
    mese,
    idVis,
    idSes,
    config,
    expireContatori,
    expireMese
  } = args;
  const refG = db.collection(COLLEZIONE_QUOTA).doc("g_" + giorno);
  const refV = db.collection(COLLEZIONE_QUOTA).doc("v_" + giorno + "_" + idVis);
  const refS = db.collection(COLLEZIONE_QUOTA).doc("s_" + giorno + "_" + idSes);
  const refM = db.collection(COLLEZIONE_QUOTA).doc("m_" + mese);

  return db.runTransaction(async function (tx) {
    const [snapG, snapV, snapS, snapM] = await Promise.all([
      tx.get(refG),
      tx.get(refV),
      tx.get(refS),
      tx.get(refM)
    ]);
    const g = snapG.exists ? snapG.data() || {} : {};
    const v = snapV.exists ? snapV.data() || {} : {};
    const s = snapS.exists ? snapS.data() || {} : {};
    const m = snapM.exists ? snapM.data() || {} : {};

    const decisione = decidiDomanda({
      config: config,
      spesaMeseEur: typeof m.costoEur === "number" ? m.costoEur : 0,
      domandeGiorno: typeof g.domande === "number" ? g.domande : 0,
      domandeVisitatore: typeof v.domande === "number" ? v.domande : 0,
      domandeSessione: typeof s.domande === "number" ? s.domande : 0
    });

    const expireG = Timestamp.fromDate(expireContatori);
    const expireMe = Timestamp.fromDate(expireMese);
    const ts = FieldValue.serverTimestamp();

    const caratteriVoceGiorno =
      typeof g.caratteriVoce === "number" ? g.caratteriVoce : 0;

    if (!decisione.consentita) {
      tx.set(
        refG,
        {
          bloccate: FieldValue.increment(1),
          expireAt: expireG,
          aggiornatoIl: ts
        },
        { merge: true }
      );
      return {
        codice: decisione.codice,
        voce: false,
        domandeSessione: typeof s.domande === "number" ? s.domande : 0,
        caratteriVoceGiorno: caratteriVoceGiorno
      };
    }

    tx.set(
      refG,
      {
        domande: FieldValue.increment(1),
        expireAt: expireG,
        aggiornatoIl: ts
      },
      { merge: true }
    );
    tx.set(
      refV,
      {
        domande: FieldValue.increment(1),
        expireAt: expireG,
        aggiornatoIl: ts
      },
      { merge: true }
    );
    tx.set(
      refS,
      {
        domande: FieldValue.increment(1),
        expireAt: expireG,
        aggiornatoIl: ts
      },
      { merge: true }
    );
    tx.set(
      refM,
      {
        domande: FieldValue.increment(1),
        expireAt: expireMe,
        aggiornatoIl: ts
      },
      { merge: true }
    );

    const domandeSessione =
      (typeof s.domande === "number" ? s.domande : 0) + 1;
    return {
      codice: "ok",
      voce: decisione.voce,
      domandeSessione: domandeSessione,
      caratteriVoceGiorno: caratteriVoceGiorno
    };
  });
}

/**
 * Contatori fase account: giorno, mese e a_<hash> (niente sessione/visitatore).
 */
async function consumaQuotaAccount(db, args) {
  const { giorno, mese, idAcc, config, expireContatori, expireMese, expireAccount } =
    args;
  const refG = db.collection(COLLEZIONE_QUOTA).doc("g_" + giorno);
  const refM = db.collection(COLLEZIONE_QUOTA).doc("m_" + mese);
  const refA = db.collection(COLLEZIONE_QUOTA).doc("a_" + idAcc);

  return db.runTransaction(async function (tx) {
    const [snapG, snapM, snapA] = await Promise.all([
      tx.get(refG),
      tx.get(refM),
      tx.get(refA)
    ]);
    const g = snapG.exists ? snapG.data() || {} : {};
    const m = snapM.exists ? snapM.data() || {} : {};
    const a = snapA.exists ? snapA.data() || {} : {};

    const decisione = decidiDomandaAccount({
      config: config,
      spesaMeseEur: typeof m.costoEur === "number" ? m.costoEur : 0,
      domandeGiorno: typeof g.domande === "number" ? g.domande : 0,
      domandeAccount: typeof a.count === "number" ? a.count : 0
    });

    const expireG = Timestamp.fromDate(expireContatori);
    const expireMe = Timestamp.fromDate(expireMese);
    const expireA = Timestamp.fromDate(expireAccount);
    const ts = FieldValue.serverTimestamp();
    const caratteriVoceGiorno =
      typeof g.caratteriVoce === "number" ? g.caratteriVoce : 0;

    if (!decisione.consentita) {
      tx.set(
        refG,
        {
          bloccate: FieldValue.increment(1),
          expireAt: expireG,
          aggiornatoIl: ts
        },
        { merge: true }
      );
      return {
        codice: decisione.codice,
        voce: false,
        domandeAccount: typeof a.count === "number" ? a.count : 0,
        caratteriVoceGiorno: caratteriVoceGiorno
      };
    }

    tx.set(
      refG,
      {
        domande: FieldValue.increment(1),
        expireAt: expireG,
        aggiornatoIl: ts
      },
      { merge: true }
    );
    tx.set(
      refM,
      {
        domande: FieldValue.increment(1),
        expireAt: expireMe,
        aggiornatoIl: ts
      },
      { merge: true }
    );
    const patchA = {
      count: FieldValue.increment(1),
      aggiornatoIl: ts
    };
    if (!snapA.exists) {
      patchA.expireAt = expireA;
    }
    tx.set(refA, patchA, { merge: true });

    return {
      codice: "ok",
      voce: decisione.voce,
      domandeAccount: (typeof a.count === "number" ? a.count : 0) + 1,
      caratteriVoceGiorno: caratteriVoceGiorno
    };
  });
}

async function registraSpesa(db, giorno, mese, costo, ok, expireContatori, expireMese) {
  const refG = db.collection(COLLEZIONE_QUOTA).doc("g_" + giorno);
  const refM = db.collection(COLLEZIONE_QUOTA).doc("m_" + mese);
  const patchG = {
    costoEur: FieldValue.increment(costo),
    expireAt: Timestamp.fromDate(expireContatori),
    aggiornatoIl: FieldValue.serverTimestamp()
  };
  if (ok) patchG.risposte = FieldValue.increment(1);
  else patchG.errori = FieldValue.increment(1);

  await Promise.all([
    refG.set(patchG, { merge: true }),
    refM.set(
      {
        costoEur: FieldValue.increment(costo),
        expireAt: Timestamp.fromDate(expireMese),
        aggiornatoIl: FieldValue.serverTimestamp()
      },
      { merge: true }
    )
  ]);
}

/**
 * Chiamata unica a Gemini in streaming SSE.
 * @returns {Promise<{ testo: string, tokenIngresso: number, tokenUscita: number, ok: boolean, motivo?: string }>}
 */
async function chiamaGeminiDefault(apiKey, corpo, segnali) {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    COSTANTI.MODELLO_GEMINI +
    ":streamGenerateContent?alt=sse";
  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, COSTANTI.TIMEOUT_GEMINI_MS);

  function onClose() {
    controller.abort();
  }
  if (segnali && segnali.req && typeof segnali.req.on === "function") {
    segnali.req.on("close", onClose);
  }

  let testo = "";
  let usage = null;
  try {
    const risposta = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(corpo),
      signal: controller.signal
    });
    if (!risposta.ok) {
      return {
        testo: "",
        tokenIngresso: 0,
        tokenUscita: 0,
        ok: false,
        motivo: "gemini-" + risposta.status
      };
    }
    const reader = risposta.body;
    if (!reader || typeof reader.getReader !== "function") {
      // Node fetch: body è un ReadableStream web oppure un stream Node.
      const testoGrezzo = await risposta.text();
      const linee = testoGrezzo.split("\n");
      for (let i = 0; i < linee.length; i++) {
        const linea = linee[i];
        if (!linea.startsWith("data:")) continue;
        const raw = linea.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        let payload;
        try {
          payload = JSON.parse(raw);
        } catch (_e) {
          continue;
        }
        const pezzo = testoDaPayloadGemini(payload);
        if (pezzo.delta) {
          testo += pezzo.delta;
          if (segnali && typeof segnali.onChunk === "function") {
            segnali.onChunk(pezzo.delta);
          }
        }
        if (pezzo.usageMetadata) usage = pezzo.usageMetadata;
      }
    } else {
      const dec = new TextDecoder();
      let buffer = "";
      const r = reader.getReader();
      while (true) {
        const { done, value } = await r.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const parti = buffer.split("\n");
        buffer = parti.pop() || "";
        for (let i = 0; i < parti.length; i++) {
          const linea = parti[i];
          if (!linea.startsWith("data:")) continue;
          const raw = linea.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;
          let payload;
          try {
            payload = JSON.parse(raw);
          } catch (_e) {
            continue;
          }
          const pezzo = testoDaPayloadGemini(payload);
          if (pezzo.delta) {
            testo += pezzo.delta;
            if (segnali && typeof segnali.onChunk === "function") {
              segnali.onChunk(pezzo.delta);
            }
          }
          if (pezzo.usageMetadata) usage = pezzo.usageMetadata;
        }
      }
    }
    const tok = tokenDaUsage(usage, "", testo);
    return {
      testo: testo,
      tokenIngresso: tok.tokenIngresso,
      tokenUscita: tok.tokenUscita,
      ok: true
    };
  } catch (e) {
    const abortito =
      e && (e.name === "AbortError" || String(e.message || "").includes("abort"));
    return {
      testo: "",
      tokenIngresso: 0,
      tokenUscita: 0,
      ok: false,
      motivo: abortito ? "timeout" : "gemini-errore"
    };
  } finally {
    clearTimeout(timer);
    if (segnali && segnali.req && typeof segnali.req.off === "function") {
      segnali.req.off("close", onClose);
    } else if (segnali && segnali.req && typeof segnali.req.removeListener === "function") {
      segnali.req.removeListener("close", onClose);
    }
  }
}

/**
 * Ramo fase account (passo 14): accesso obbligatorio, JSON, niente stream grezzo.
 */
async function handleFaseAccount(req, res, ctx) {
  const { validata, inizio, adessoFn, db, verificaIdToken, chiamaGemini, leggiConfig } =
    ctx;

  const authHeader =
    (req.headers && (req.headers.authorization || req.headers.Authorization)) ||
    "";
  const match =
    typeof authHeader === "string"
      ? /^Bearer\s+(.+)$/i.exec(authHeader.trim())
      : null;
  if (!match || !match[1]) {
    res.status(401).json({ codice: "accesso-mancante" });
    return;
  }

  let decoded;
  try {
    decoded = await verificaIdToken(match[1]);
  } catch (_e) {
    res.status(401).json({ codice: "accesso-non-valido" });
    return;
  }
  const uid = decoded && typeof decoded.uid === "string" ? decoded.uid : "";
  if (!uid) {
    res.status(401).json({ codice: "accesso-non-valido" });
    return;
  }

  let sseAvviato = false;
  try {
    avviaSse(res);
    sseAvviato = true;

    const domanda = validata.domanda;
    const storia = validata.storia;
    const argomento = validata.argomento;

    let haDatiPersonali = contieneDatiPersonali(domanda);
    if (!haDatiPersonali) {
      for (let i = 0; i < storia.length; i++) {
        if (storia[i].ruolo === "utente" && contieneDatiPersonali(storia[i].testo)) {
          haDatiPersonali = true;
          break;
        }
      }
    }
    if (haDatiPersonali) {
      chiudiDone(res, {
        codice: "dati-personali",
        testo: messaggioPerCodice("dati-personali"),
        voce: false,
        domandeRimaste: 0,
        mostraRegistrazione: false
      });
      logRiga("info", [
        "fase=account",
        "esito=bloccato",
        "codice=dati-personali",
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
    if (config.enabled !== true) {
      chiudiDone(res, {
        codice: "spento",
        testo: messaggioPerCodice("spento"),
        voce: false,
        domandeRimaste: 0,
        mostraRegistrazione: false
      });
      logRiga("info", [
        "fase=account",
        "esito=bloccato",
        "codice=spento",
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }

    const { giorno, mese } = chiaviTempo(adesso);
    const scad = scadenze(adesso);
    const expireAccount = new Date(
      adesso.getTime() + COSTANTI.ORE_VALIDITA_ACCOUNT * 60 * 60 * 1000
    );
    const idAcc = idAccount(uid);

    const quota = await consumaQuotaAccount(db, {
      giorno: giorno,
      mese: mese,
      idAcc: idAcc,
      config: config,
      expireContatori: scad.contatori,
      expireMese: scad.mese,
      expireAccount: expireAccount
    });

    if (quota.codice !== "ok") {
      chiudiDone(res, {
        codice: quota.codice,
        testo: messaggioPerCodice(quota.codice),
        voce: false,
        domandeRimaste: Math.max(
          0,
          COSTANTI.MAX_DOMANDE_ACCOUNT - (quota.domandeAccount || 0)
        ),
        mostraRegistrazione: false
      });
      logRiga("info", [
        "fase=account",
        "esito=bloccato",
        "codice=" + quota.codice,
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }

    const corpoGemini = corpoRichiestaGemini({
      promptSistema: promptSistemaAccount(argomento),
      storia: storia,
      domanda: domanda,
      formatoAccount: true,
      schemaRisposta: SCHEMA_RISPOSTA_ACCOUNT
    });

    let testoGrezzo = "";
    const esitoGemini = await chiamaGemini(corpoGemini, {
      req: req,
      onChunk: function (delta) {
        if (delta) testoGrezzo += String(delta);
      }
    });

    if (!esitoGemini || !esitoGemini.ok) {
      try {
        await registraSpesa(
          db,
          giorno,
          mese,
          COSTANTI.COSTO_FISSO_RICHIESTA_EUR,
          false,
          scad.contatori,
          scad.mese
        );
      } catch (_e) {
        logRiga("warn", ["fase=account", "spesa=non-registrata"]);
      }
      chiudiDone(res, {
        codice: "errore",
        testo: messaggioPerCodice("errore"),
        voce: false,
        domandeRimaste: Math.max(
          0,
          COSTANTI.MAX_DOMANDE_ACCOUNT - quota.domandeAccount
        ),
        mostraRegistrazione: false
      });
      logRiga("warn", [
        "fase=account",
        "esito=errore",
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }

    if (esitoGemini.testo) testoGrezzo = esitoGemini.testo;
    const pulita = rispostaAccountDaTesto(testoGrezzo);
    const testoRisposta = pulita.testo || "";

    const tok = tokenDaUsage(
      {
        promptTokenCount: esitoGemini.tokenIngresso,
        candidatesTokenCount: esitoGemini.tokenUscita,
        thoughtsTokenCount: 0
      },
      domanda,
      testoRisposta
    );
    const tokenIngresso =
      typeof esitoGemini.tokenIngresso === "number"
        ? esitoGemini.tokenIngresso
        : tok.tokenIngresso;
    const tokenUscita =
      typeof esitoGemini.tokenUscita === "number"
        ? esitoGemini.tokenUscita
        : tok.tokenUscita;
    const costo = costoStimatoEur({
      tokenIngresso: tokenIngresso,
      tokenUscita: tokenUscita,
      caratteriVoce: 0
    });
    try {
      await registraSpesa(
        db,
        giorno,
        mese,
        costo,
        true,
        scad.contatori,
        scad.mese
      );
    } catch (_e) {
      logRiga("warn", ["fase=account", "spesa=non-registrata"]);
    }

    let voceOfferta = false;
    let idVoce = null;
    const caratteriVoceGiorno =
      typeof quota.caratteriVoceGiorno === "number"
        ? quota.caratteriVoceGiorno
        : 0;
    if (
      quota.voce === true &&
      caratteriVoceGiorno < config.dailyVoiceCharCap &&
      testoRisposta &&
      testoRisposta.length <= COSTANTI_VOCE.MAX_CARATTERI_TESTO &&
      preparaTestoVoce(testoRisposta)
    ) {
      try {
        idVoce = nuovoIdVoce(crypto.randomBytes.bind(crypto));
        const dati = datiBiglietto({
          testo: testoRisposta,
          sessione: validata.sessione,
          adesso: adesso.getTime(),
          expireAt: Timestamp.fromDate(scad.contatori)
        });
        await db
          .collection(COLLEZIONE_QUOTA)
          .doc("voce_" + idVoce)
          .set(
            Object.assign({}, dati, {
              creatoIl: FieldValue.serverTimestamp()
            })
          );
        voceOfferta = true;
      } catch (_bigliettoErr) {
        idVoce = null;
        voceOfferta = false;
        logRiga("warn", ["fase=account", "voce=biglietto-non-scritto"]);
      }
    }

    scriviSse(res, "chunk", { delta: testoRisposta });
    const doneOk = {
      codice: "ok",
      testo: testoRisposta,
      voce: voceOfferta,
      domandeRimaste: Math.max(
        0,
        COSTANTI.MAX_DOMANDE_ACCOUNT - quota.domandeAccount
      ),
      mostraRegistrazione: false,
      dati: pulita.dati,
      troppiTerreni: pulita.troppiTerreni === true
    };
    if (voceOfferta && idVoce) doneOk.idVoce = idVoce;
    chiudiDone(res, doneOk);

    const nPoderi =
      pulita.dati && Array.isArray(pulita.dati.poderi)
        ? pulita.dati.poderi.length
        : 0;
    const nTerreni =
      pulita.dati && Array.isArray(pulita.dati.terreni)
        ? pulita.dati.terreni.length
        : 0;
    logRiga("info", [
      "fase=account",
      "esito=ok",
      "ms=" + (Date.now() - inizio),
      "poderi=" + nPoderi,
      "terreni=" + nTerreni,
      "voce=" + (voceOfferta ? "1" : "0")
    ]);
  } catch (_e) {
    if (!sseAvviato) {
      res.status(503).json({ codice: "errore" });
      logRiga("error", [
        "fase=account",
        "esito=errore",
        "motivo=imprevisto",
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }
    try {
      chiudiDone(res, {
        codice: "errore",
        testo: messaggioPerCodice("errore"),
        voce: false,
        domandeRimaste: 0,
        mostraRegistrazione: false
      });
    } catch (_e2) {
      try {
        res.end();
      } catch (_e3) {
        /* ignore */
      }
    }
    logRiga("error", [
      "fase=account",
      "esito=errore",
      "motivo=imprevisto",
      "ms=" + (Date.now() - inizio)
    ]);
  }
}

/**
 * Gestore HTTP (testabile con dipendenze iniettate).
 * @param {object} req
 * @param {object} res
 * @param {{ db?: object, verificaAppCheck?: Function, verificaIdToken?: Function, chiamaGemini?: Function, adesso?: Function|Date, leggiConfig?: Function }=} opzioni
 */
async function handleTonyLandingAsk(req, res, opzioni) {
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
  const verificaIdToken =
    typeof opt.verificaIdToken === "function"
      ? opt.verificaIdToken
      : async function (token) {
          return admin.auth().verifyIdToken(token);
        };
  const chiamaGemini =
    typeof opt.chiamaGemini === "function"
      ? opt.chiamaGemini
      : async function (corpo, segnali) {
          const chiave = geminiApiKey.value();
          return chiamaGeminiDefault(chiave, corpo, segnali);
        };
  const leggiConfig =
    typeof opt.leggiConfig === "function"
      ? opt.leggiConfig
      : function (database, quando) {
          return leggiConfigDefault(database, quando);
        };

  const origin = req.headers && req.headers.origin;
  if (!origineAmmessa(origin)) {
    res.status(403).json({ codice: "origine-non-ammessa" });
    return;
  }
  impostaCors(res, origin);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ codice: "metodo-non-ammesso" });
    return;
  }

  const tokenAppCheck =
    req.headers &&
    (req.headers["x-firebase-appcheck"] || req.headers["X-Firebase-AppCheck"]);
  if (!tokenAppCheck || typeof tokenAppCheck !== "string") {
    res.status(401).json({ codice: "app-check-mancante" });
    return;
  }
  try {
    await verificaAppCheck(tokenAppCheck);
  } catch (_e) {
    res.status(401).json({ codice: "app-check-non-valido" });
    return;
  }

  let corpo;
  try {
    corpo = await readJsonBody(req, COSTANTI.MAX_BYTE_RICHIESTA);
  } catch (e) {
    if (e && e.codice === "corpo-troppo-grande") {
      res.status(413).json({ codice: "corpo-troppo-grande" });
      return;
    }
    res.status(400).json({ codice: (e && e.codice) || "richiesta-non-valida" });
    return;
  }

  const validata = validaRichiesta(corpo);
  if (!validata.ok) {
    res.status(400).json({ codice: validata.codice });
    return;
  }

  if (validata.fase === "account") {
    await handleFaseAccount(req, res, {
      validata: validata,
      inizio: inizio,
      adessoFn: adessoFn,
      db: db,
      verificaIdToken: verificaIdToken,
      chiamaGemini: chiamaGemini,
      leggiConfig: leggiConfig
    });
    return;
  }

  let sseAvviato = false;
  try {
    avviaSse(res);
    sseAvviato = true;

    const domanda = validata.domanda;
    const storia = validata.storia;

    let haDatiPersonali = contieneDatiPersonali(domanda);
    if (!haDatiPersonali) {
      for (let i = 0; i < storia.length; i++) {
        if (storia[i].ruolo === "utente" && contieneDatiPersonali(storia[i].testo)) {
          haDatiPersonali = true;
          break;
        }
      }
    }
    if (haDatiPersonali) {
      chiudiDone(res, {
        codice: "dati-personali",
        testo: messaggioPerCodice("dati-personali"),
        voce: false,
        domandeRimaste: 0,
        mostraRegistrazione: true
      });
      logRiga("info", [
        "esito=bloccato",
        "codice=dati-personali",
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }

    const adesso = adessoFn();
    let config;
    try {
      config = await leggiConfig(db, adesso);
    } catch (_cfgErr) {
      // Mai acceso per errore di lettura: documento o rete falliti → spento.
      config = normalizzaConfig(null);
    }
    if (config.enabled !== true) {
      chiudiDone(res, {
        codice: "spento",
        testo: messaggioPerCodice("spento"),
        voce: false,
        domandeRimaste: 0,
        mostraRegistrazione: true
      });
      logRiga("info", [
        "esito=bloccato",
        "codice=spento",
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }

    const { giorno, mese } = chiaviTempo(adesso);
    const scad = scadenze(adesso);
    const sale = await ottieniSaleGiorno(db, giorno, scad.contatori);
    const ua =
      (req.headers && (req.headers["user-agent"] || req.headers["User-Agent"])) ||
      "";
    const ip = ipDaRichiesta(req.headers, req.ip);
    const idVis = idVisitatore(ip, ua, sale);
    const idSes = idSessione(idVis, validata.sessione);

    const quota = await consumaQuota(db, {
      giorno: giorno,
      mese: mese,
      idVis: idVis,
      idSes: idSes,
      config: config,
      expireContatori: scad.contatori,
      expireMese: scad.mese
    });

    if (quota.codice !== "ok") {
      const domandeRimaste = Math.max(
        0,
        COSTANTI.MAX_DOMANDE_SESSIONE - (quota.domandeSessione || 0)
      );
      chiudiDone(res, {
        codice: quota.codice,
        testo: messaggioPerCodice(quota.codice),
        voce: false,
        domandeRimaste: domandeRimaste,
        mostraRegistrazione: true
      });
      logRiga("info", [
        "esito=bloccato",
        "codice=" + quota.codice,
        "ms=" + (Date.now() - inizio),
        "voce=0"
      ]);
      return;
    }

    const domandeRimaste = Math.max(
      0,
      COSTANTI.MAX_DOMANDE_SESSIONE - quota.domandeSessione
    );
    const corpoGemini = corpoRichiestaGemini({
      promptSistema: PROMPT_SISTEMA_LANDING,
      storia: storia,
      domanda: domanda
    });

    const esitoGemini = await chiamaGemini(corpoGemini, {
      req: req,
      onChunk: function (delta) {
        if (delta) scriviSse(res, "chunk", { delta: String(delta) });
      }
    });

    if (!esitoGemini || !esitoGemini.ok) {
      const motivo =
        (esitoGemini && esitoGemini.motivo) || "gemini-errore";
      try {
        await registraSpesa(
          db,
          giorno,
          mese,
          COSTANTI.COSTO_FISSO_RICHIESTA_EUR,
          false,
          scad.contatori,
          scad.mese
        );
      } catch (_e) {
        logRiga("warn", ["spesa=non-registrata"]);
      }
      chiudiDone(res, {
        codice: "errore",
        testo: messaggioPerCodice("errore"),
        voce: false,
        domandeRimaste: domandeRimaste,
        mostraRegistrazione: true
      });
      logRiga("warn", [
        "esito=errore",
        "motivo=" + motivo,
        "ms=" + (Date.now() - inizio),
        "voce=0"
      ]);
      return;
    }

    const tok = tokenDaUsage(
      {
        promptTokenCount: esitoGemini.tokenIngresso,
        candidatesTokenCount: esitoGemini.tokenUscita,
        thoughtsTokenCount: 0
      },
      domanda,
      esitoGemini.testo
    );
    // Se chiamaGemini ha già passato i token, usali; altrimenti stima.
    const tokenIngresso =
      typeof esitoGemini.tokenIngresso === "number"
        ? esitoGemini.tokenIngresso
        : tok.tokenIngresso;
    const tokenUscita =
      typeof esitoGemini.tokenUscita === "number"
        ? esitoGemini.tokenUscita
        : tok.tokenUscita;
    const costo = costoStimatoEur({
      tokenIngresso: tokenIngresso,
      tokenUscita: tokenUscita,
      caratteriVoce: 0
    });
    try {
      await registraSpesa(
        db,
        giorno,
        mese,
        costo,
        true,
        scad.contatori,
        scad.mese
      );
    } catch (_e) {
      logRiga("warn", ["spesa=non-registrata"]);
    }

    const testoRisposta = esitoGemini.testo || "";
    let voceOfferta = false;
    let idVoce = null;
    const caratteriVoceGiorno =
      typeof quota.caratteriVoceGiorno === "number"
        ? quota.caratteriVoceGiorno
        : 0;
    if (
      quota.voce === true &&
      caratteriVoceGiorno < config.dailyVoiceCharCap &&
      testoRisposta &&
      testoRisposta.length <= COSTANTI_VOCE.MAX_CARATTERI_TESTO &&
      preparaTestoVoce(testoRisposta)
    ) {
      try {
        idVoce = nuovoIdVoce(crypto.randomBytes.bind(crypto));
        const dati = datiBiglietto({
          testo: testoRisposta,
          sessione: validata.sessione,
          adesso: adesso.getTime(),
          expireAt: Timestamp.fromDate(scad.contatori)
        });
        await db
          .collection(COLLEZIONE_QUOTA)
          .doc("voce_" + idVoce)
          .set(
            Object.assign({}, dati, {
              creatoIl: FieldValue.serverTimestamp()
            })
          );
        voceOfferta = true;
      } catch (_bigliettoErr) {
        idVoce = null;
        voceOfferta = false;
        logRiga("warn", ["voce=biglietto-non-scritto"]);
      }
    }

    const doneOk = {
      codice: "ok",
      testo: testoRisposta,
      voce: voceOfferta,
      domandeRimaste: domandeRimaste,
      mostraRegistrazione: false
    };
    if (voceOfferta && idVoce) doneOk.idVoce = idVoce;
    chiudiDone(res, doneOk);
    logRiga("info", [
      "esito=ok",
      "codice=ok",
      "ms=" + (Date.now() - inizio),
      "tokIn=" + tokenIngresso,
      "tokOut=" + tokenUscita,
      "voce=" + (voceOfferta ? "1" : "0")
    ]);
  } catch (_e) {
    if (!sseAvviato) {
      res.status(503).json({ codice: "errore" });
      logRiga("error", [
        "esito=errore",
        "motivo=imprevisto",
        "ms=" + (Date.now() - inizio)
      ]);
      return;
    }
    try {
      chiudiDone(res, {
        codice: "errore",
        testo: messaggioPerCodice("errore"),
        voce: false,
        domandeRimaste: 0,
        mostraRegistrazione: true
      });
    } catch (_e2) {
      try {
        res.end();
      } catch (_e3) {
        /* ignore */
      }
    }
    logRiga("error", [
      "esito=errore",
      "motivo=imprevisto",
      "ms=" + (Date.now() - inizio)
    ]);
  }
}

exports.tonyLandingAsk = onRequest(
  {
    region: "europe-west1",
    secrets: [geminiApiKey],
    timeoutSeconds: 30,
    memory: "256MiB",
    maxInstances: 10,
    cors: false,
    invoker: "public"
  },
  function (req, res) {
    return handleTonyLandingAsk(req, res);
  }
);

exports.handleTonyLandingAsk = handleTonyLandingAsk;
exports.svuotaCacheTonyLandingAsk = svuotaCacheTonyLandingAsk;
exports.readJsonBody = readJsonBody;
