"use strict";

/**
 * tonyLandingSetup — salvataggio di sede, poderi e terreni dopo «Sì, salva»
 * sulla landing «Tony bussa ed entra».
 *
 * È l'unico punto in cui la landing scrive nel tenant. Scrive con l'Admin SDK
 * (che salta le firestore.rules): per questo rifà tutti i controlli di accesso,
 * forma dei dati, limiti del piano e idempotenza.
 *
 * Brief v4.2, sezione 8 (8.2–8.4, 8.6). Non pubblicare prima del passo 9
 * (App Check): l'export ha enforceAppCheck: true.
 */

const admin = require("firebase-admin");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const {
  validaRichiestaSetup,
  risolviControAzienda
} = require("./lib/tony-landing-setup-core");
const { rolesForTenant } = require("./lib/tenant-membership-access");
const { resolveTenantPlanId } = require("./tenant-plan");

const LIMITE_TERRENI_FREE = 5;
const LIMITE_CHIAMATE_ORA = 5;
const LIMITE_CHIAMATE_GIORNO = 10;
const ORE_SCADENZA_CONTATORE = 48;
const FUSO_CONTATORE = "Europe/Rome";
const COLLEZIONE_CONTATORE = "tonyLandingSetupQuota";
const DOC_ESITO = "esito";

const MESSAGGIO = Object.freeze({
  nonCollegato: "Devi essere collegato per salvare.",
  troppeChiamate: "Hai fatto troppe richieste. Riprova più tardi.",
  datiNonValidi: "I dati non sono validi.",
  nienteDaSalvare: "Non c'è niente da salvare.",
  senzaAzienda: "Non troviamo la tua azienda.",
  limiteTerreni: "Hai raggiunto il limite di terreni del piano gratuito.",
  giaPreparato: "L'azienda è già stata preparata.",
  interno: "Non è stato salvato niente. Riprova tra poco."
});

/**
 * Chiavi giorno/ora nel fuso Europe/Rome.
 * @param {Date} data
 * @returns {{ giorno: string, ora: string }}
 */
function chiaviContatore(data) {
  const d = data instanceof Date ? data : new Date(data);
  let giorno;
  try {
    giorno = new Intl.DateTimeFormat("sv-SE", {
      timeZone: FUSO_CONTATORE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  } catch (_e) {
    giorno = d.toISOString().slice(0, 10);
  }
  let oraParte = "00";
  try {
    const parti = new Intl.DateTimeFormat("en-GB", {
      timeZone: FUSO_CONTATORE,
      hour: "2-digit",
      hourCycle: "h23"
    }).formatToParts(d);
    const trovata = parti.find(function (p) {
      return p.type === "hour";
    });
    if (trovata && trovata.value) oraParte = trovata.value.padStart(2, "0");
  } catch (_e) {
    oraParte = String(d.getUTCHours()).padStart(2, "0");
  }
  return { giorno: giorno, ora: giorno + "T" + oraParte };
}

/**
 * Calcola il prossimo stato del contatore senza scrivere.
 * @param {object|null|undefined} datiAttuali
 * @param {{ giorno: string, ora: string }} chiavi
 * @returns {{ consentito: false } | { consentito: true, nuovi: { count: number, oraChiave: string, oraCount: number } }}
 */
function prossimoContatore(datiAttuali, chiavi) {
  const dati = datiAttuali && typeof datiAttuali === "object" ? datiAttuali : {};
  const count = Number(dati.count) || 0;
  let oraCount = 0;
  if (dati.oraChiave === chiavi.ora) {
    oraCount = Number(dati.oraCount) || 0;
  }
  if (count >= LIMITE_CHIAMATE_GIORNO || oraCount >= LIMITE_CHIAMATE_ORA) {
    return { consentito: false };
  }
  return {
    consentito: true,
    nuovi: {
      count: count + 1,
      oraChiave: chiavi.ora,
      oraCount: oraCount + 1
    }
  };
}

/**
 * TenantId dal documento utente (mai dal browser).
 * @param {object|null|undefined} userData
 * @returns {string|null}
 */
function tenantDalDocumentoUtente(userData) {
  if (!userData || typeof userData !== "object") return null;
  if (typeof userData.tenantId === "string") {
    const diretto = sanitizzaTenantId(userData.tenantId);
    if (diretto) return diretto;
  }
  const memberships = userData.tenantMemberships;
  if (!memberships || typeof memberships !== "object") return null;
  const chiavi = Object.keys(memberships);
  for (let i = 0; i < chiavi.length; i++) {
    const m = memberships[chiavi[i]];
    if (m && typeof m === "object" && m.tenantIdPredefinito === true) {
      return sanitizzaTenantId(chiavi[i]);
    }
  }
  if (chiavi.length === 1) return sanitizzaTenantId(chiavi[0]);
  return null;
}

function sanitizzaTenantId(valore) {
  if (typeof valore !== "string") return null;
  const t = valore.trim();
  if (!t || t.length > 128 || t.indexOf("/") !== -1) return null;
  return t;
}

/**
 * Conta i terreni dell'azienda (senza clienteId o con clienteId vuoto).
 * @param {Array<{ data?: Function }|object>} documenti
 * @returns {number}
 */
function contaTerreniAziendali(documenti) {
  if (!Array.isArray(documenti)) return 0;
  let n = 0;
  for (let i = 0; i < documenti.length; i++) {
    const raw = documenti[i];
    const dati =
      raw && typeof raw.data === "function"
        ? raw.data() || {}
        : raw && typeof raw === "object"
          ? raw
          : {};
    const clienteId = dati.clienteId;
    if (clienteId == null || clienteId === "") n += 1;
  }
  return n;
}

function dbDiDefault() {
  return admin.firestore();
}

function adessoDiDefault() {
  return new Date();
}

/**
 * Consuma una chiamata nel contatore (transazione separata, prima dei controlli).
 * @returns {Promise<void>}
 */
async function consumaContatore(db, uid, adesso) {
  const chiavi = chiaviContatore(adesso);
  const ref = db.collection(COLLEZIONE_CONTATORE).doc(chiavi.giorno + "_" + uid);
  const esito = await db.runTransaction(async function (tx) {
    const snap = await tx.get(ref);
    const dati = snap.exists ? snap.data() || {} : {};
    const prossimo = prossimoContatore(dati, chiavi);
    if (!prossimo.consentito) {
      return { ok: false };
    }
    const expireAt = Timestamp.fromDate(
      new Date(adesso.getTime() + ORE_SCADENZA_CONTATORE * 60 * 60 * 1000)
    );
    tx.set(
      ref,
      Object.assign({}, prossimo.nuovi, {
        expireAt: expireAt,
        aggiornatoIl: FieldValue.serverTimestamp()
      }),
      { merge: true }
    );
    return { ok: true };
  });
  if (!esito.ok) {
    throw new HttpsError("resource-exhausted", MESSAGGIO.troppeChiamate, {
      motivo: "troppe-chiamate"
    });
  }
}

/**
 * Risolve e autorizza l'azienda dell'utente (fuori dalla transazione di scrittura).
 * @returns {Promise<{ tenantId: string, tenantData: object }>}
 */
async function risolviAziendaAutorizzata(db, uid) {
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    throw new HttpsError("permission-denied", MESSAGGIO.senzaAzienda, {
      motivo: "senza-azienda"
    });
  }
  const userData = userSnap.data() || {};
  const tenantId = tenantDalDocumentoUtente(userData);
  if (!tenantId) {
    throw new HttpsError("permission-denied", MESSAGGIO.senzaAzienda, {
      motivo: "senza-azienda"
    });
  }
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnap.exists) {
    throw new HttpsError("permission-denied", MESSAGGIO.senzaAzienda, {
      motivo: "senza-azienda"
    });
  }
  const tenantData = tenantSnap.data() || {};
  if (tenantData.stato !== "attivo") {
    throw new HttpsError("permission-denied", MESSAGGIO.senzaAzienda, {
      motivo: "senza-azienda"
    });
  }
  const ruoli = rolesForTenant(userData, tenantId);
  if (tenantData.creatoDa !== uid || ruoli.indexOf("amministratore") < 0) {
    throw new HttpsError("permission-denied", MESSAGGIO.senzaAzienda, {
      motivo: "non-autorizzato"
    });
  }
  return { tenantId: tenantId, tenantData: tenantData };
}

function nomiDaSnap(snap) {
  const out = [];
  if (!snap || !snap.docs) return out;
  for (let i = 0; i < snap.docs.length; i++) {
    const dati = snap.docs[i].data() || {};
    if (dati.nome != null) out.push(dati.nome);
  }
  return out;
}

function payloadSede(sede) {
  const out = {
    indirizzo: sede.indirizzo,
    citta: sede.citta,
    aggiornatoIl: FieldValue.serverTimestamp()
  };
  if (sede.cap != null) out.cap = sede.cap;
  if (sede.provincia != null) out.provincia = sede.provincia;
  return out;
}

function payloadPodere(nome) {
  return {
    nome: nome,
    indirizzo: null,
    note: null,
    coordinate: null,
    creatoIl: FieldValue.serverTimestamp(),
    aggiornatoIl: FieldValue.serverTimestamp()
  };
}

function payloadTerreno(voce) {
  const out = {
    nome: voce.nome,
    superficie: voce.superficie,
    tipoPossesso: "proprieta",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  if (voce.coltura != null) out.coltura = voce.coltura;
  if (voce.podere != null) out.podere = voce.podere;
  return out;
}

/**
 * Transazione unica: idempotenza, controlli contro azienda, limite Free, scritture.
 */
async function eseguiTransazioneSetup(db, uid, tenantId, richiesta) {
  const tenantRef = db.collection("tenants").doc(tenantId);
  const esitoRef = tenantRef.collection("tonyLandingSetup").doc(DOC_ESITO);
  const poderiCol = tenantRef.collection("poderi");
  const terreniCol = tenantRef.collection("terreni");
  const coltureCol = tenantRef.collection("colture");

  return db.runTransaction(async function (tx) {
    const esitoSnap = await tx.get(esitoRef);
    if (esitoSnap.exists) {
      const esito = esitoSnap.data() || {};
      if (esito.requestId === richiesta.requestId) {
        return {
          ok: true,
          requestId: richiesta.requestId,
          giaSalvato: true,
          sedeAggiornata: !!esito.sedeAggiornata,
          poderiCreati: Number(esito.poderiCreati) || 0,
          poderiGiaPresenti: Number(esito.poderiGiaPresenti) || 0,
          terreniCreati: Number(esito.terreniCreati) || 0
        };
      }
      throw new HttpsError("already-exists", MESSAGGIO.giaPreparato, {
        motivo: "gia-preparato"
      });
    }

    const tenantSnap = await tx.get(tenantRef);
    const tenantData = tenantSnap.exists ? tenantSnap.data() || {} : {};
    const poderiSnap = await tx.get(poderiCol);
    const terreniSnap = await tx.get(terreniCol);
    const coltureSnap = await tx.get(coltureCol);

    const risoluzione = risolviControAzienda(richiesta, {
      poderi: nomiDaSnap(poderiSnap),
      terreni: nomiDaSnap(terreniSnap),
      coltureAzienda: nomiDaSnap(coltureSnap)
    });
    if (!risoluzione.ok) {
      throw new HttpsError("invalid-argument", MESSAGGIO.datiNonValidi, {
        motivo: "dati-non-validi",
        campi: risoluzione.campi
      });
    }

    const daScrivere = risoluzione.daScrivere;
    const piano = resolveTenantPlanId(tenantData);
    if (piano === "free") {
      const esistenti = contaTerreniAziendali(terreniSnap.docs || []);
      const richiesti = daScrivere.terreni.length;
      if (richiesti > 0 && esistenti + richiesti > LIMITE_TERRENI_FREE) {
        throw new HttpsError("failed-precondition", MESSAGGIO.limiteTerreni, {
          motivo: "limite-terreni",
          limite: LIMITE_TERRENI_FREE,
          esistenti: esistenti,
          richiesti: richiesti
        });
      }
    }

    const sedeAggiornata = daScrivere.sede != null;
    if (sedeAggiornata) {
      tx.update(tenantRef, payloadSede(daScrivere.sede));
    }

    for (let i = 0; i < daScrivere.poderiDaCreare.length; i++) {
      const ref = poderiCol.doc();
      tx.set(ref, payloadPodere(daScrivere.poderiDaCreare[i].nome));
    }

    for (let j = 0; j < daScrivere.terreni.length; j++) {
      const refT = terreniCol.doc();
      tx.set(refT, payloadTerreno(daScrivere.terreni[j]));
    }

    const risposta = {
      ok: true,
      requestId: richiesta.requestId,
      giaSalvato: false,
      sedeAggiornata: sedeAggiornata,
      poderiCreati: daScrivere.poderiDaCreare.length,
      poderiGiaPresenti: daScrivere.poderiGiaPresenti,
      terreniCreati: daScrivere.terreni.length
    };

    tx.set(esitoRef, {
      requestId: richiesta.requestId,
      completatoIl: FieldValue.serverTimestamp(),
      uid: uid,
      sedeAggiornata: risposta.sedeAggiornata,
      poderiCreati: risposta.poderiCreati,
      poderiGiaPresenti: risposta.poderiGiaPresenti,
      terreniCreati: risposta.terreniCreati
    });

    return risposta;
  });
}

function tipoErroreImprevisto(err) {
  if (!err || err.code == null) return "sconosciuto";
  const c = err.code;
  if (typeof c === "number" && Number.isFinite(c)) return String(c);
  if (typeof c === "string" && /^[A-Za-z0-9_-]+$/.test(c)) return c;
  return "sconosciuto";
}

function logEsito(livello, parti) {
  const riga = "[tonyLandingSetup] " + parti.join(" ");
  if (livello === "info") console.info(riga);
  else if (livello === "warn") console.warn(riga);
  else console.error(riga);
}

/**
 * Gestore della callable. In produzione: handleTonyLandingSetup(request).
 * Nei test: handleTonyLandingSetup(request, { db, adesso }).
 * @param {object} request
 * @param {{ db?: FirebaseFirestore.Firestore, adesso?: () => Date }} [opzioni]
 */
async function handleTonyLandingSetup(request, opzioni) {
  const inizio = Date.now();
  const db = (opzioni && opzioni.db) || dbDiDefault();
  const adessoFn = (opzioni && opzioni.adesso) || adessoDiDefault;

  try {
    if (!request || !request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", MESSAGGIO.nonCollegato);
    }
    const uid = String(request.auth.uid);

    await consumaContatore(db, uid, adessoFn());

    const validata = validaRichiestaSetup(request.data);
    if (!validata.ok) {
      if (validata.motivo === "niente-da-salvare") {
        throw new HttpsError("invalid-argument", MESSAGGIO.nienteDaSalvare, {
          motivo: "niente-da-salvare"
        });
      }
      const details = { motivo: validata.motivo };
      if (validata.campi) details.campi = validata.campi;
      throw new HttpsError("invalid-argument", MESSAGGIO.datiNonValidi, details);
    }

    const { tenantId } = await risolviAziendaAutorizzata(db, uid);
    const risposta = await eseguiTransazioneSetup(db, uid, tenantId, validata.richiesta);

    logEsito("info", [
      "esito=ok",
      "gia=" + (risposta.giaSalvato ? "1" : "0"),
      "sede=" + (risposta.sedeAggiornata ? "1" : "0"),
      "poderi=" + risposta.poderiCreati,
      "poderiPresenti=" + risposta.poderiGiaPresenti,
      "terreni=" + risposta.terreniCreati,
      "ms=" + (Date.now() - inizio)
    ]);
    return risposta;
  } catch (err) {
    const ms = Date.now() - inizio;
    if (err instanceof HttpsError) {
      const details = err.details && typeof err.details === "object" ? err.details : {};
      const motivo = details.motivo || "";
      const parti = ["esito=errore", "codice=" + err.code, "ms=" + ms];
      if (motivo) parti.splice(2, 0, "motivo=" + motivo);
      if (Array.isArray(details.campi)) {
        parti.splice(motivo ? 3 : 2, 0, "campiErrati=" + details.campi.length);
      }
      logEsito("warn", parti);
      throw err;
    }
    logEsito("error", [
      "esito=errore",
      "codice=internal",
      "tipo=" + tipoErroreImprevisto(err),
      "ms=" + ms
    ]);
    throw new HttpsError("internal", MESSAGGIO.interno);
  }
}

module.exports = {
  handleTonyLandingSetup,
  LIMITE_TERRENI_FREE,
  LIMITE_CHIAMATE_ORA,
  LIMITE_CHIAMATE_GIORNO,
  ORE_SCADENZA_CONTATORE,
  chiaviContatore,
  prossimoContatore,
  tenantDalDocumentoUtente,
  contaTerreniAziendali
};
