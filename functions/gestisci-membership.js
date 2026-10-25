/**
 * Gestione membership utenti per tenant (Admin SDK).
 * elencaUtentiTenant / gestisciMembershipUtente — mai delete del doc users.
 */

const { FieldValue, FieldPath } = require("firebase-admin/firestore");
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

/**
 * Target ha (o aveva) ruolo amministratore nel tenant, qualunque sia lo stato membership.
 * Se la chiave membership manca, usa i ruoli deprecati.
 */
function targetHadAdminRole(userData, tenantId) {
  if (!userData || !tenantId) return false;
  if (hasMembershipKey(userData, tenantId)) {
    const m = userData.tenantMemberships[tenantId] || {};
    const roles = Array.isArray(m.ruoli) ? m.ruoli.map(String) : [];
    return roles.includes("amministratore");
  }
  if (userData.tenantId === tenantId) {
    const roles = Array.isArray(userData.ruoli) ? userData.ruoli.map(String) : [];
    return roles.includes("amministratore");
  }
  return false;
}

function membershipStatoForTenant(userData, tenantId) {
  if (hasMembershipKey(userData, tenantId)) {
    const m = userData.tenantMemberships[tenantId] || {};
    return m.stato || "attivo";
  }
  if (userData.tenantId === tenantId) {
    return userData.stato || "attivo";
  }
  return "attivo";
}

function ensureTenantMembershipMap(targetData, tenantId) {
  let memberships = ensureMembershipFromDeprecated(targetData);
  if (!memberships[tenantId] && targetData.tenantId === tenantId) {
    memberships[tenantId] = {
      ruoli: Array.isArray(targetData.ruoli) ? targetData.ruoli.slice() : [],
      stato: targetData.stato || "attivo",
      tenantIdPredefinito: true,
    };
  }
  return memberships;
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
    // Indice mancante: log e continua con tenantId (fail-safe elenco).
    console.warn("[elencaUtentiTenant] query membership:", err && err.message);
  }

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

function bumpActiveAdmin(seen, countRef, uid, data, tenantId, excludeUid) {
  if (!uid || uid === excludeUid || seen.has(uid)) return;
  const roles = rolesForTenant(data, tenantId);
  if (!roles.includes("amministratore")) return;
  seen.add(uid);
  countRef.n += 1;
}

/**
 * Conteggio admin attivi (fuori transazione). Se la query membership fallisce → blocca.
 */
async function countActiveAdmins(db, tenantId, excludeUid) {
  const seen = new Set();
  const countRef = { n: 0 };

  const byDep = await db.collection("users").where("tenantId", "==", tenantId).get();
  byDep.forEach((s) => bumpActiveAdmin(seen, countRef, s.id, s.data() || {}, tenantId, excludeUid));

  try {
    const byMem = await db
      .collection("users")
      .where(`tenantMemberships.${tenantId}.stato`, "==", "attivo")
      .get();
    byMem.forEach((s) => bumpActiveAdmin(seen, countRef, s.id, s.data() || {}, tenantId, excludeUid));
  } catch (err) {
    console.warn("[countActiveAdmins] membership query:", err && err.message);
    throw new HttpsError(
      "failed-precondition",
      "Impossibile verificare gli amministratori attivi (indice membership mancante)."
    );
  }

  return countRef.n;
}

/**
 * Conteggio admin attivi dentro transazione (tx.get su query).
 * Se la query membership fallisce → blocca (niente fail-soft).
 */
async function countActiveAdminsInTx(db, tx, tenantId, excludeUid) {
  const seen = new Set();
  const countRef = { n: 0 };

  const byDep = await tx.get(db.collection("users").where("tenantId", "==", tenantId));
  byDep.forEach((s) => bumpActiveAdmin(seen, countRef, s.id, s.data() || {}, tenantId, excludeUid));

  let byMem;
  try {
    byMem = await tx.get(
      db.collection("users").where(`tenantMemberships.${tenantId}.stato`, "==", "attivo")
    );
  } catch (err) {
    console.warn("[countActiveAdminsInTx] membership query:", err && err.message);
    throw new HttpsError(
      "failed-precondition",
      "Impossibile verificare gli amministratori attivi (indice membership mancante)."
    );
  }
  byMem.forEach((s) => bumpActiveAdmin(seen, countRef, s.id, s.data() || {}, tenantId, excludeUid));

  return countRef.n;
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

  if ((azione === "disattiva" || azione === "rimuovi") && targetUid === callerUid) {
    throw new HttpsError(
      "failed-precondition",
      "Non puoi disattivare o rimuovere te stesso da questa azienda (uscita volontaria fuori perimetro)."
    );
  }

  let nextRolesForRuoli = null;
  if (azione === "ruoli") {
    nextRolesForRuoli = normalizeRuoliValidi(data.ruoli);
    if (!nextRolesForRuoli) {
      throw new HttpsError("invalid-argument", "Ruoli non validi.");
    }
  }

  const callerRef = db.collection("users").doc(callerUid);
  const targetRef = db.collection("users").doc(targetUid);

  await db.runTransaction(async (tx) => {
    const callerSnap = await tx.get(callerRef);
    if (!callerSnap.exists) {
      throw new HttpsError("permission-denied", "Utente non trovato.");
    }
    const callerData = callerSnap.data() || {};
    if (!isManagerOrAdmin(callerData, tenantId)) {
      throw new HttpsError(
        "permission-denied",
        "Serve ruolo manager o amministratore attivo del tenant."
      );
    }

    const targetSnap = await tx.get(targetRef);
    if (!targetSnap.exists) {
      throw new HttpsError("not-found", "Utente target non trovato.");
    }
    const targetData = targetSnap.data() || {};

    if (!targetBelongs(targetData, tenantId)) {
      throw new HttpsError("permission-denied", "L'utente non appartiene a questo tenant.");
    }

    const wasAdmin = targetHadAdminRole(targetData, tenantId);
    if (wasAdmin && !isAmministratore(callerData, tenantId)) {
      throw new HttpsError(
        "permission-denied",
        "Solo un amministratore può modificare un altro amministratore."
      );
    }

    if (
      nextRolesForRuoli &&
      nextRolesForRuoli.includes("amministratore") &&
      !isAmministratore(callerData, tenantId)
    ) {
      throw new HttpsError(
        "permission-denied",
        "Solo un amministratore può assegnare il ruolo amministratore."
      );
    }

    const previewStato = membershipStatoForTenant(targetData, tenantId);

    if (azione === "riattiva") {
      if (previewStato === "rimosso") {
        throw new HttpsError(
          "failed-precondition",
          "Utente rimosso: serve un nuovo invito."
        );
      }
      if (previewStato !== "disattivato") {
        throw new HttpsError(
          "failed-precondition",
          "Si può riattivare solo un utente disattivato."
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
      const otherAdmins = await countActiveAdminsInTx(db, tx, tenantId, targetUid);
      if (otherAdmins < 1) {
        throw new HttpsError(
          "failed-precondition",
          "Non puoi togliere l'ultimo amministratore attivo del tenant."
        );
      }
    }

    let memberships = ensureTenantMembershipMap(targetData, tenantId);
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
        tx.update(
          targetRef,
          new FieldPath("tenantMemberships", tenantId),
          FieldValue.delete()
        );
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
  targetHadAdminRole,
  countActiveAdmins,
  countActiveAdminsInTx,
};
