/**
 * Accettazione invito: unico punto server che scrive membership su users e stato su inviti.
 * Il client crea/accede Auth, poi chiama questa callable autenticata.
 */

const {
  findInvitoByTokenForPublic,
  isInvitoScaduto,
  InvitoPubblicoError,
  normalizeRuoli,
} = require("./invito-pubblico");

const {
  belongsToTenant,
  rolesForTenant,
  isManagerOrAdmin,
  isAmministratore,
  hasMembershipKey,
  RUOLI_VALIDI,
} = require("./lib/tenant-membership-access");

const RUOLI_AMMESSI = RUOLI_VALIDI.slice();

class AccettaInvitoError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AccettaInvitoError";
    this.code = code;
  }
}

function emailNorm(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function ruoliInvitoValidi(ruoli) {
  const list = normalizeRuoli(ruoli);
  if (list.length === 0) return null;
  if (!list.every((r) => RUOLI_AMMESSI.includes(r))) return null;
  return list;
}

function membershipAttiva(userData, tenantId) {
  return belongsToTenant(userData, tenantId) && hasMembershipKey(userData, tenantId);
}

/**
 * Membro legacy: tenantId deprecato uguale al tenant dell'invito, senza chiave membership, non disattivato.
 * Non va migrato/sovrascritto con i ruoli dell'invito (evita declassamento del titolare).
 */
function membroLegacyAttivoSenzaMembership(userData, tenantId) {
  if (!userData || !tenantId) return false;
  if (hasMembershipKey(userData, tenantId)) return false;
  return belongsToTenant(userData, tenantId) && userData.tenantId === tenantId;
}

function isManagerOrAdminAttivo(userData, tenantId) {
  return isManagerOrAdmin(userData, tenantId);
}

function isAmministratoreAttivo(userData, tenantId) {
  return isAmministratore(userData, tenantId);
}

/**
 * Nome/cognome dall'invito solo se sul doc utente sono vuoti (come campiNomeDaInvitoSeVuoti client).
 */
function campiNomeDaInvitoSeVuoti(userData, invito) {
  const u = userData && typeof userData === "object" ? userData : {};
  const inv = invito && typeof invito === "object" ? invito : {};
  const patch = {};
  if (!String(u.nome || "").trim() && String(inv.nome || "").trim()) {
    patch.nome = String(inv.nome).trim();
  }
  if (!String(u.cognome || "").trim() && String(inv.cognome || "").trim()) {
    patch.cognome = String(inv.cognome).trim();
  }
  return patch;
}

/**
 * Migra tenantId deprecato in tenantMemberships se manca la chiave.
 */
function migraTenantIdDeprecato(memberships, userData) {
  const out = Object.assign({}, memberships || {});
  const legacy = userData && typeof userData.tenantId === "string" ? userData.tenantId : "";
  if (!legacy) return out;
  if (out[legacy]) return out;
  out[legacy] = {
    ruoli: Array.isArray(userData.ruoli) ? userData.ruoli.slice() : [],
    stato: userData.stato || "attivo",
    tenantIdPredefinito: true,
  };
  return out;
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ auth?: { uid: string, token?: { email?: string } } }} request
 * @param {{ token?: string }} data
 * @param {Date} [now]
 */
async function handleAccettaInvito(db, request, data, now = new Date()) {
  if (!request || !request.auth || !request.auth.uid) {
    throw new AccettaInvitoError("unauthenticated", "Autenticazione richiesta.");
  }
  const uid = request.auth.uid;
  const tokenEmail = emailNorm(request.auth.token && request.auth.token.email);
  const token = data && data.token;

  const found = await findInvitoByTokenForPublic(db, token);
  if (!found) {
    throw new AccettaInvitoError("not-found", "Token invalido o già utilizzato.");
  }
  const invito = found.data || {};
  if (invito.stato !== "invitato") {
    throw new AccettaInvitoError("not-found", "Token invalido o già utilizzato.");
  }
  if (isInvitoScaduto(invito.scadeIl, now)) {
    throw new AccettaInvitoError(
      "failed-precondition",
      "Token scaduto. Contatta l'amministratore per un nuovo invito."
    );
  }

  if (!tokenEmail || emailNorm(invito.email) !== tokenEmail) {
    throw new AccettaInvitoError(
      "permission-denied",
      "L'email dell'account non corrisponde all'invito."
    );
  }

  const tenantId = typeof invito.tenantId === "string" ? invito.tenantId : "";
  if (!tenantId) {
    throw new AccettaInvitoError("failed-precondition", "Invito senza azienda.");
  }

  const ruoli = ruoliInvitoValidi(invito.ruoli);
  if (!ruoli) {
    throw new AccettaInvitoError(
      "invalid-argument",
      "Ruoli invito non validi."
    );
  }

  const inviatoDa = typeof invito.inviatoDa === "string" ? invito.inviatoDa : "";
  if (!inviatoDa) {
    throw new AccettaInvitoError("failed-precondition", "Invito senza mittente.");
  }

  const userRef = db.collection("users").doc(uid);
  const invitoRef = db.collection("inviti").doc(found.id);
  const mittenteRef = db.collection("users").doc(inviatoDa);

  const result = await db.runTransaction(async (tx) => {
    const invitoFresh = await tx.get(invitoRef);
    if (!invitoFresh.exists) {
      throw new AccettaInvitoError("not-found", "Token invalido o già utilizzato.");
    }
    const invitoData = invitoFresh.data() || {};
    if (invitoData.stato !== "invitato") {
      throw new AccettaInvitoError("not-found", "Token invalido o già utilizzato.");
    }
    if (emailNorm(invitoData.email) !== tokenEmail) {
      throw new AccettaInvitoError(
        "permission-denied",
        "L'email dell'account non corrisponde all'invito."
      );
    }
    if (String(invitoData.tenantId || "") !== tenantId) {
      throw new AccettaInvitoError("permission-denied", "Invito non valido.");
    }

    const mittenteSnap = await tx.get(mittenteRef);
    const mittenteData = mittenteSnap && mittenteSnap.exists ? mittenteSnap.data() : null;
    if (!isManagerOrAdminAttivo(mittenteData, tenantId)) {
      throw new AccettaInvitoError(
        "permission-denied",
        "Invito non più valido: il mittente non è manager o amministratore dell'azienda."
      );
    }
    // Solo un amministratore può invitare un altro amministratore.
    if (ruoli.includes("amministratore") && !isAmministratoreAttivo(mittenteData, tenantId)) {
      throw new AccettaInvitoError(
        "permission-denied",
        "Solo un amministratore può invitare un altro amministratore."
      );
    }

    const userSnap = await tx.get(userRef);
    const isNewUser = !userSnap.exists;
    let patchNome = {};

    if (isNewUser) {
      const membership = {
        ruoli: ruoli.slice(),
        stato: "attivo",
        dataInizio: now,
        creatoDa: inviatoDa,
        tenantIdPredefinito: true,
      };
      tx.set(userRef, {
        id: uid,
        email: tokenEmail,
        nome: typeof invitoData.nome === "string" ? invitoData.nome : "",
        cognome: typeof invitoData.cognome === "string" ? invitoData.cognome : "",
        ruoli: ruoli.slice(),
        tenantId: tenantId,
        tenantMemberships: { [tenantId]: membership },
        stato: "attivo",
        creatoDa: inviatoDa,
        creatoIl: now,
        ultimoAccesso: null,
        invitoId: found.id,
      });
    } else {
      const userData = userSnap.data() || {};
      if (membershipAttiva(userData, tenantId)) {
        throw new AccettaInvitoError(
          "already-exists",
          "Appartieni già a questa azienda"
        );
      }
      // Titolare/legacy con solo tenantId: non declassare con i ruoli dell'invito.
      if (membroLegacyAttivoSenzaMembership(userData, tenantId)) {
        throw new AccettaInvitoError(
          "already-exists",
          "Appartieni già a questa azienda"
        );
      }
      let memberships = migraTenantIdDeprecato(userData.tenantMemberships, userData);
      memberships[tenantId] = {
        ruoli: ruoli.slice(),
        stato: "attivo",
        dataInizio: now,
        creatoDa: inviatoDa,
        tenantIdPredefinito: false,
      };
      patchNome = campiNomeDaInvitoSeVuoti(userData, invitoData);
      const update = Object.assign({ tenantMemberships: memberships }, patchNome);
      tx.update(userRef, update);
    }

    tx.update(invitoRef, {
      stato: "accettato",
      accettatoIl: now,
      accettatoDa: uid,
    });

    return { ok: true, tenantId, isNewUser };
  });

  return result;
}

module.exports = {
  AccettaInvitoError,
  RUOLI_AMMESSI,
  emailNorm,
  ruoliInvitoValidi,
  membershipAttiva,
  membroLegacyAttivoSenzaMembership,
  isManagerOrAdminAttivo,
  isAmministratoreAttivo,
  campiNomeDaInvitoSeVuoti,
  migraTenantIdDeprecato,
  handleAccettaInvito,
};
