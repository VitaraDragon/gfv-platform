/**
 * Callable registraAccettazioniLegali: registra oppure legge lo stato.
 * Scrive solo con Admin SDK. Il client non ha accesso alla collezione.
 * Righe e stato sono per azienda: lo stato chiede il tenantId e verifica la membership.
 */
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const {
  validaPayloadAccettazione,
  idAccettazione,
  RUOLI_INVITO
} = require("./lib/accettazione-legale-core");

const {
  belongsToTenant: appartieneAlTenant,
  rolesForTenant,
} = require("./lib/tenant-membership-access");

function ruoliDi(userData, tenantId) {
  return rolesForTenant(userData, tenantId);
}

function giaEsiste(err) {
  const code = err && err.code;
  return code === 6 || code === "already-exists" || code === "ALREADY_EXISTS";
}

async function handleRegistraAccettazioniLegali(request, db) {
  if (!request || !request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Accedi per registrare l'accettazione.");
  }
  const uid = String(request.auth.uid);
  const database = db || admin.firestore();
  const check = validaPayloadAccettazione(request.data || {});
  if (!check.ok) {
    throw new HttpsError(check.code, check.error);
  }

  const userSnap = await database.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    throw new HttpsError("permission-denied", "Utente non trovato.");
  }
  const userData = userSnap.data() || {};

  if (check.azione === "stato") {
    if (!appartieneAlTenant(userData, check.tenantId)) {
      throw new HttpsError("permission-denied", "Non appartieni a questa azienda.");
    }
    // Filtro per azienda in memoria: niente indice composito nuovo.
    const snap = await database.collection("accettazioniLegali").where("uid", "==", uid).get();
    const documenti = [];
    snap.forEach(function (docSnap) {
      const row = docSnap.data() || {};
      if (row.tenantId === check.tenantId && typeof row.tipo === "string" && typeof row.versione === "string") {
        documenti.push({ tipo: row.tipo, versione: row.versione });
      }
    });
    return { documenti: documenti };
  }
  const ruoli = ruoliDi(userData, check.tenantId);

  if (check.canale === "registrazione") {
    if (check.ruolo !== "amministratore" || ruoli.indexOf("amministratore") < 0) {
      throw new HttpsError("permission-denied", "Solo l'amministratore che crea l'azienda può accettare questi documenti.");
    }
    const tenantSnap = await database.collection("tenants").doc(check.tenantId).get();
    const tenant = tenantSnap.exists ? (tenantSnap.data() || {}) : null;
    if (!tenant || tenant.creatoDa !== uid) {
      throw new HttpsError("permission-denied", "Solo chi ha creato l'azienda può accettare questi documenti.");
    }
  } else if (!appartieneAlTenant(userData, check.tenantId) || RUOLI_INVITO.indexOf(check.ruolo) < 0 || ruoli.indexOf(check.ruolo) < 0) {
    throw new HttpsError("permission-denied", "Il ruolo non corrisponde all'invito.");
  }

  for (let i = 0; i < check.righe.length; i++) {
    const riga = check.righe[i];
    const ref = database.collection("accettazioniLegali").doc(idAccettazione(uid, check.tenantId, riga.tipo, riga.versione));
    const row = {
      uid: uid,
      tenantId: check.tenantId,
      tipo: riga.tipo,
      versione: riga.versione,
      accettatoIl: FieldValue.serverTimestamp(),
      canale: check.canale,
      ruolo: check.ruolo,
      versioneTestoCasella: riga.versioneTestoCasella
    };
    try {
      await ref.create(row);
    } catch (err) {
      // Stessa azienda, stesso documento e versione: già accettato, non si sovrascrive la prova.
      if (giaEsiste(err)) continue;
      console.error("[registraAccettazioniLegali]", check.canale, riga.tipo);
      throw new HttpsError("internal", "Registrazione accettazione non riuscita.");
    }
  }
  return { ok: true };
}

module.exports = { handleRegistraAccettazioniLegali };
