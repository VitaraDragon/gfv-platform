/**
 * Gestione membership utenti per tenant (Admin SDK).
 * elencaUtentiTenant / gestisciMembershipUtente — mai delete del doc users.
 */

const { FieldValue } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const {
  belongsToTenant,
  rolesForTenant,
  isManagerOrAdmin,
  isAmministratore,
  ensureMembershipFromDeprecated,
  normalizeRuoliValidi,
  hasMembershipKey,
} = require("./lib/tenant-membership-access");

const AZIONI = new Set(["disattiva", "riattiva", "rimuovi", "ruoli"]);

function requireAuth(request) {
  if (!request || !request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Autenticazione richiesta.");
  }
  return request.auth.uid;
}

function requireTenantId(data) {
  const tenantId = data && typeof data.tenantId === "string" ? data.tenantId.trim() : "";
  if (!tenantId) {
    throw new HttpsError("invalid-argument", "tenantId obbligatorio.");
  }
  return tenantId;
}

async function loadUser(db, uid) {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "Utente non trovato.");
  }
  return { ref: snap.ref, data: snap.data() || {}, id: snap.id };
}

async function assertCallerManagerOrAdmin(db, callerUid, tenantId) {
  const caller = await loadUser(db, callerUid);
  if (!isManagerOrAdmin(caller.data, tenantId)) {
    throw new HttpsError(
      "permission-denied",
      "Serve ruolo manager o amministratore attivo del tenant."
    );
  }
  return caller;
}

function targetBelongs(userData, tenantId) {
  if (belongsToTenant(userData, tenantId)) return true;
  // Appartiene anche se membership disattivata/rimossa (per riattivare) o solo deprecato.
  if (hasMembershipKey(userData, tenantId)) return true;
  return userData.tenantId === tenantId;
}

function serializeUserForTenant(id, data, tenantId) {
  let ruoli = [];
  let stato = "attivo";
  if (hasMembershipKey(data, tenantId)) {
    const m = data.tenantMemberships[tenantId] || {};
    ruoli = Array.isArray(m.ruoli) ? m.ruoli.map(String) : [];
    stato = m.stato || "attivo";
  } else if (data.tenantId === tenantId) {
    ruoli = Array.isArray(data.ruoli) ? data.ruoli.map(String) : [];
    stato = data.stato || "attivo";
  }
  return {
    id,
    email: typeof data.email === "string" ? data.email : "",
    nome: typeof data.nome === "string" ? data.nome : "",
    cognome: typeof data.cognome === "string" ? data.cognome : "",
    ruoli,
    stato,
    ultimoAccesso: data.ultimoAccesso || null,
    isOnline: data.isOnline === true,
    lastSeen: data.lastSeen || null,
    viaMembership: hasMembershipKey(data, tenantId),
  };
}

/**
 * Elenco utenti del tenant (tenantId deprecato o membership).
 * @param {*} db
 * @param {{ auth?: { uid: string }, data?: { tenantId?: string } }} request
 */
async function handleElencaUtentiTenant(db, request) {
  const callerUid = requireAuth(request);
  const tenantId = requireTenantId(request.data || {});
  await assertCallerManagerOrAdmin(db, callerUid, tenantId);

  const byId = new Map();

  const byDeprecated = await db.collection("users").where("tenantId", "==", tenantId).get();
  byDeprecated.forEach((docSnap) => {
    byId.set(docSnap.id, serializeUserForTenant(docSnap.id, docSnap.data() || {}, tenantId));
  });

  // Membership: collection group non disponibile su mappa; scan limitato non è ok.
  // Admin SDK: query su campo mappa non supportata → leggiamo candidati via collection
  // e filtriamo in memoria solo se già in byId? No: utenti solo-membership non hanno tenantId.
  // Soluzione: collection group non esiste. Usiamo get di tutti users? Troppo costoso.
  // Per tenant tipici: query field path tenantMemberships.<tenantId> non è indicizzabile
  // facilmente. Con Admin SDK possiamo usare collection group su sotto-collezione — ma
  // tenantMemberships è una mappa, non sotto-collezione.
  // Approccio: leggiamo users dove tenantMemberships.<tenantId>.stato esiste via
  // FieldPath — in Firestore Admin: where(`tenantMemberships.${tenantId}.stato`, 'in', ...)
  const stati = ["attivo", "disattivato", "rimosso"];
  try {
    const byMem = await db
      .collection("users")
      .where(`tenantMemberships.${tenantId}.stato`, "in", stati)
      .get();
    byMem.forEach((docSnap) => {
      byId.set(docSnap.id, serializeUserForTenant(docSnap.id, docSnap.data() || {}, tenantId));
    });
  } catch (err) {
    // Indice mancante o path: fallback scan non ammesso in prod; log e continua con tenantId.
    console.warn("[elencaUtentiTenant] query membership:", err && err.message);
  }

  // Inviti accettati di recente (ultimi 30 giorni) → uid accettatoDa se non già in lista
  const since = new Date();
  since.setDate(since.getDate() - 30);
  try {
    const invitiSnap = await db
      .collection("inviti")
      .where("tenantId", "==", tenantId)
      .where("stato", "==", "accettato")
      .get();
    const missingUids = [];
    invitiSnap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      const accettatoDa = typeof d.accettatoDa === "string" ? d.accettatoDa : "";
      if (!accettatoDa || byId.has(accettatoDa)) return;
      const accettatoIl = d.accettatoIl && d.accettatoIl.toDate ? d.accettatoIl.toDate() : d.accettatoIl;
      if (accettatoIl && new Date(accettatoIl) < since) return;
      missingUids.push(accettatoDa);
    });
    await Promise.all(
      missingUids.map(async (uid) => {
        const snap = await db.collection("users").doc(uid).get();
        if (!snap.exists) return;
        const data = snap.data() || {};
        if (!targetBelongs(data, tenantId) && !belongsToTenant(data, tenantId)) {
          // ancora membership o deprecato?
          if (!hasMembershipKey(data, tenantId) && data.tenantId !== tenantId) return;
        }
        byId.set(uid, serializeUserForTenant(uid, data, tenantId));
      })
    );
  } catch (err) {
    console.warn("[elencaUtentiTenant] inviti accettati:", err && err.message);
  }

  const utenti = Array.from(byId.values()).sort((a, b) =>
    String(a.cognome || "").localeCompare(String(b.cognome || ""), "it")
  );
  return { ok: true, utenti };
}

async function countActiveAdmins(db, tenantId, excludeUid) {
  let count = 0;
  const seen = new Set();

  const bump = (uid, data) => {
    if (!uid || uid === excludeUid || seen.has(uid)) return;
    const roles = rolesForTenant(data, tenantId);
    if (!roles.includes("amministratore")) return;
    seen.add(uid);
    count += 1;
  };

  const byDep = await db.collection("users").where("tenantId", "==", tenantId).get();
  byDep.forEach((s) => bump(s.id, s.data() || {}));

  try {
    const byMem = await db
      .collection("users")
      .where(`tenantMemberships.${tenantId}.stato`, "==", "attivo")
      .get();
    byMem.forEach((s) => bump(s.id, s.data() || {}));
  } catch (err) {
    console.warn("[countActiveAdmins] membership query:", err && err.message);
  }

  return count;
}

/**
 * @param {*} db
 * @param {{ auth?: { uid: string }, data?: Object }} request
 */
async function handleGestisciMembershipUtente(db, request) {
  const callerUid = requireAuth(request);
  const data = request.data || {};
  const tenantId = requireTenantId(data);
  const targetUid = typeof data.uid === "string" ? data.uid.trim() : "";
  const azione = typeof data.azione === "string" ? data.azione.trim() : "";

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "uid obbligatorio.");
  }
  if (!AZIONI.has(azione)) {
    throw new HttpsError(
      "invalid-argument",
      "azione deve essere disattiva|riattiva|rimuovi|ruoli."
    );
  }

  const caller = await assertCallerManagerOrAdmin(db, callerUid, tenantId);

  if ((azione === "disattiva" || azione === "rimuovi") && targetUid === callerUid) {
    throw new HttpsError(
      "failed-precondition",
      "Non puoi disattivare o rimuovere te stesso da questa azienda (uscita volontaria fuori perimetro)."
    );
  }

  const targetPreview = await loadUser(db, targetUid);
  if (!targetBelongs(targetPreview.data, tenantId)) {
    throw new HttpsError("permission-denied", "L'utente non appartiene a questo tenant.");
  }

  const previewMemberships = ensureMembershipFromDeprecated(targetPreview.data);
  if (!previewMemberships[tenantId] && targetPreview.data.tenantId === tenantId) {
    previewMemberships[tenantId] = {
      ruoli: Array.isArray(targetPreview.data.ruoli) ? targetPreview.data.ruoli.slice() : [],
      stato: targetPreview.data.stato || "attivo",
      tenantIdPredefinito: true,
    };
  }
  const previewMem = previewMemberships[tenantId] || {};
  const previewRoles = Array.isArray(previewMem.ruoli)
    ? previewMem.ruoli.map(String)
    : rolesForTenant(targetPreview.data, tenantId);
  const previewStato = previewMem.stato || "attivo";
  const wasAdmin = previewRoles.includes("amministratore");

  let nextRolesForRuoli = null;
  if (azione === "ruoli") {
    nextRolesForRuoli = normalizeRuoliValidi(data.ruoli);
    if (!nextRolesForRuoli) {
      throw new HttpsError("invalid-argument", "Ruoli non validi.");
    }
    if (
      nextRolesForRuoli.includes("amministratore") &&
      !isAmministratore(caller.data, tenantId)
    ) {
      throw new HttpsError(
        "permission-denied",
        "Solo un amministratore può assegnare il ruolo amministratore."
      );
    }
  }

  const losesAdmin =
    wasAdmin &&
    previewStato === "attivo" &&
    (azione === "disattiva" ||
      azione === "rimuovi" ||
      (azione === "ruoli" && nextRolesForRuoli && !nextRolesForRuoli.includes("amministratore")));
  if (losesAdmin) {
    const otherAdmins = await countActiveAdmins(db, tenantId, targetUid);
    if (otherAdmins < 1) {
      throw new HttpsError(
        "failed-precondition",
        "Non puoi togliere l'ultimo amministratore attivo del tenant."
      );
    }
  }

  const targetRef = db.collection("users").doc(targetUid);

  await db.runTransaction(async (tx) => {
    const targetSnap = await tx.get(targetRef);
    if (!targetSnap.exists) {
      throw new HttpsError("not-found", "Utente target non trovato.");
    }
    const targetData = targetSnap.data() || {};

    if (!targetBelongs(targetData, tenantId)) {
      throw new HttpsError("permission-denied", "L'utente non appartiene a questo tenant.");
    }

    // Se solo campi deprecati: crea membership prima (punto 1 fa valere la nuova chiave).
    let memberships = ensureMembershipFromDeprecated(targetData);
    if (!memberships[tenantId] && targetData.tenantId === tenantId) {
      memberships[tenantId] = {
        ruoli: Array.isArray(targetData.ruoli) ? targetData.ruoli.slice() : [],
        stato: targetData.stato || "attivo",
        tenantIdPredefinito: true,
      };
    }
    if (!memberships[tenantId]) {
      throw new HttpsError("failed-precondition", "Membership tenant assente.");
    }

    if (azione === "disattiva") {
      memberships[tenantId] = Object.assign({}, memberships[tenantId], {
        stato: "disattivato",
      });
      tx.update(targetRef, { tenantMemberships: memberships });
      return;
    }

    if (azione === "riattiva") {
      memberships[tenantId] = Object.assign({}, memberships[tenantId], {
        stato: "attivo",
      });
      tx.update(targetRef, { tenantMemberships: memberships });
      return;
    }

    if (azione === "rimuovi") {
      // Se tenantId deprecato == tenantId, delete della chiave riattiverebbe il ramo deprecato:
      // imposta stato 'rimosso' sulla membership (chiave resta).
      if (targetData.tenantId === tenantId) {
        memberships[tenantId] = Object.assign({}, memberships[tenantId], {
          stato: "rimosso",
        });
        tx.update(targetRef, { tenantMemberships: memberships });
      } else {
        tx.update(targetRef, {
          [`tenantMemberships.${tenantId}`]: FieldValue.delete(),
        });
      }
      return;
    }

    if (azione === "ruoli") {
      memberships[tenantId] = Object.assign({}, memberships[tenantId], {
        ruoli: nextRolesForRuoli,
      });
      tx.update(targetRef, { tenantMemberships: memberships });
    }
  });

  return { ok: true, azione, uid: targetUid, tenantId };
}

module.exports = {
  handleElencaUtentiTenant,
  handleGestisciMembershipUtente,
  serializeUserForTenant,
  targetBelongs,
  countActiveAdmins,
};
