/**
 * Pieno registrato da operaio o caposquadra.
 * Un'uscita su movimentiMagazzino e un solo increment negativo della giacenza.
 */
const admin = require("firebase-admin");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { validaPienoCampo } = require("./lib/registra-pieno-campo-core");

function normId(value) {
  if (value == null) return "";
  return String(value).trim();
}

function collectRuoli(userData, tenantId) {
  const out = [];
  if (userData && Array.isArray(userData.ruoli)) out.push(...userData.ruoli);
  const membership = userData && userData.tenantMemberships && userData.tenantMemberships[tenantId];
  if (membership && Array.isArray(membership.ruoli)) out.push(...membership.ruoli);
  return out;
}

function userBelongsToTenant(userData, tenantId) {
  if (!userData || !tenantId) return false;
  if (normId(userData.tenantId) === tenantId) return true;
  const memberships = userData.tenantMemberships;
  return !!(memberships && Object.prototype.hasOwnProperty.call(memberships, tenantId));
}

function haModuloMagazzino(tenant) {
  const modules = tenant && Array.isArray(tenant.modules) ? tenant.modules : [];
  if (modules.indexOf("magazzino") >= 0) return true;
  const trial = tenant && tenant.moduleTrials && tenant.moduleTrials.magazzino;
  if (!trial || trial.status !== "active" || !trial.endsAt) return false;
  const ends = trial.endsAt.toDate ? trial.endsAt.toDate() : new Date(trial.endsAt);
  return ends > new Date();
}

async function capoIdsSquadraPerUtente(db, tenantId, userIds) {
  const mine = new Set(userIds.map(normId).filter(Boolean));
  const snap = await db.collection("tenants").doc(tenantId).collection("squadre").get();
  const capi = new Set();
  snap.forEach((docSnap) => {
    const squadra = docSnap.data() || {};
    const operai = Array.isArray(squadra.operai) ? squadra.operai : [];
    const hit = operai.some((op) => {
      if (op == null) return false;
      if (typeof op === "string") return mine.has(normId(op));
      return mine.has(normId(op.id || op.uid || op.operaioId || op.userId));
    });
    if (hit && squadra.caposquadraId) capi.add(normId(squadra.caposquadraId));
  });
  return Array.from(capi);
}

async function handleRegistraPienoCampo(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Accedi per registrare il pieno.");
  }
  const data = request.data || {};
  const tenantId = normId(data.tenantId);
  const lavoroId = normId(data.lavoroId);
  const prodottoId = normId(data.prodottoId);
  const quantita = Number(data.quantita);
  if (!tenantId || !lavoroId || !prodottoId) {
    throw new HttpsError("invalid-argument", "Mancano lavoro o carburante.");
  }

  const db = admin.firestore();
  const userSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!userSnap.exists) {
    throw new HttpsError("permission-denied", "Utente non trovato.");
  }
  const userData = userSnap.data() || {};
  if (!userBelongsToTenant(userData, tenantId)) {
    throw new HttpsError("permission-denied", "Questa azienda non è la tua.");
  }

  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const tenant = tenantSnap.exists ? tenantSnap.data() : {};
  const lavoroSnap = await db.collection("tenants").doc(tenantId).collection("lavori").doc(lavoroId).get();
  const lavoro = lavoroSnap.exists ? Object.assign({ id: lavoroSnap.id }, lavoroSnap.data()) : null;
  const userIds = [request.auth.uid, userData.id, userData.uid].map(normId).filter(Boolean);
  const capoIds = await capoIdsSquadraPerUtente(db, tenantId, userIds);

  const prodottoRef = db.collection("tenants").doc(tenantId).collection("prodotti").doc(prodottoId);
  const macchinaId = lavoro ? normId(lavoro.macchinaId) : "";
  const macchinaRef = macchinaId
    ? db.collection("tenants").doc(tenantId).collection("macchine").doc(macchinaId)
    : null;

  let createdId = null;
  try {
  await db.runTransaction(async (tx) => {
    const prodottoSnap = await tx.get(prodottoRef);
    const prodotto = prodottoSnap.exists ? Object.assign({ id: prodottoSnap.id }, prodottoSnap.data()) : null;
    const macchinaSnap = macchinaRef ? await tx.get(macchinaRef) : null;
    const macchina = macchinaSnap && macchinaSnap.exists
      ? Object.assign({ id: macchinaSnap.id }, macchinaSnap.data())
      : null;
    const check = validaPienoCampo({
      userIds,
      ruoli: collectRuoli(userData, tenantId),
      lavoro,
      prodotto,
      macchina,
      quantita,
      capoIdsSquadra: capoIds,
      haModuloMagazzino: haModuloMagazzino(tenant)
    });
    if (!check.ok) {
      const err = new Error(check.error);
      err.gfvCode = check.code || "failed-precondition";
      throw err;
    }
    const movRef = db.collection("tenants").doc(tenantId).collection("movimentiMagazzino").doc();
    createdId = movRef.id;
    const now = Timestamp.now();
    tx.set(movRef, {
      prodottoId,
      data: now,
      tipo: "uscita",
      quantita,
      prezzoUnitario: null,
      lavoroId,
      attivitaId: null,
      note: "Pieno registrato in campo",
      userId: request.auth.uid,
      macchinaId,
      origineCarburante: "pieno",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.update(prodottoRef, {
      giacenza: FieldValue.increment(-quantita),
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  } catch (err) {
    if (err && err.gfvCode) {
      throw new HttpsError(err.gfvCode, err.message);
    }
    console.error("[registraPienoCampo]", err);
    throw new HttpsError("internal", (err && err.message) ? err.message : "Errore registrazione pieno.");
  }

  return { movimentoId: createdId };
}

module.exports = { handleRegistraPienoCampo };
