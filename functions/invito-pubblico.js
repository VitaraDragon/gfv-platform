/**
 * Invito pubblico (link email di registrazione): lookup Admin per token.
 * I campi restituiti sono un allowlist — niente dump del documento.
 */

const INVITO_TOKEN_MIN_LEN = 10;
const INVITO_TOKEN_MAX_LEN = 200;

class InvitoPubblicoError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "InvitoPubblicoError";
    this.code = code;
  }
}

function isInvitoTokenValid(token) {
  return typeof token === "string" && token.length >= INVITO_TOKEN_MIN_LEN && token.length <= INVITO_TOKEN_MAX_LEN;
}

function firestoreValueToDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    try {
      return value.toDate();
    } catch (_) {
      return null;
    }
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }
  return null;
}

function firestoreTimestampToIso(value) {
  const d = firestoreValueToDate(value);
  return d ? d.toISOString() : null;
}

function normalizeRuoli(ruoli) {
  if (Array.isArray(ruoli)) {
    return ruoli.map((r) => String(r)).filter(Boolean);
  }
  if (typeof ruoli === "string" && ruoli.trim()) {
    return [ruoli.trim()];
  }
  if (ruoli && typeof ruoli === "object") {
    return Object.values(ruoli).map((r) => String(r)).filter(Boolean);
  }
  return [];
}

function sanitizeInvitoForPublic(id, data) {
  const src = data && typeof data === "object" ? data : {};
  return {
    id: String(id || ""),
    email: typeof src.email === "string" ? src.email : "",
    nome: typeof src.nome === "string" ? src.nome : "",
    cognome: typeof src.cognome === "string" ? src.cognome : "",
    ruoli: normalizeRuoli(src.ruoli),
    stato: typeof src.stato === "string" ? src.stato : "",
    scadeIl: firestoreTimestampToIso(src.scadeIl),
    isExistingUser: src.isExistingUser === true || src.isExistingUser === "true",
    tenantId: typeof src.tenantId === "string" ? src.tenantId : "",
    token: typeof src.token === "string" ? src.token : "",
    inviatoDa: typeof src.inviatoDa === "string" ? src.inviatoDa : "",
    cellulare: typeof src.cellulare === "string" ? src.cellulare : "",
  };
}

function isInvitoScaduto(scadeIl, now = new Date()) {
  const d = firestoreValueToDate(scadeIl);
  if (!d) return false;
  return now > d;
}

function pickInvitoFromDocs(docs) {
  if (!Array.isArray(docs) || docs.length === 0) return null;
  const mapped = docs.map((doc) => ({
    id: doc.id,
    data: typeof doc.data === "function" ? doc.data() : doc.data || {},
  }));
  const pending = mapped.filter((d) => d.data && d.data.stato === "invitato");
  const chosen = pending.length > 0 ? pending[0] : mapped[0];
  if (mapped.length > 1) {
    console.warn("[getInvitoPubblico] token duplicato (più documenti)", String(chosen.data.token || "").substring(0, 12));
  }
  return chosen;
}

async function findInvitoByTokenForPublic(db, token) {
  if (!isInvitoTokenValid(token)) return null;
  const snap = await db.collection("inviti").where("token", "==", token).limit(5).get();
  if (!snap || snap.empty) return null;
  return pickInvitoFromDocs(snap.docs);
}

async function handleGetInvitoPubblico(db, token, now = new Date()) {
  if (!isInvitoTokenValid(token)) {
    throw new InvitoPubblicoError("invalid-argument", "Token non valido.");
  }
  const found = await findInvitoByTokenForPublic(db, token);
  if (!found) {
    throw new InvitoPubblicoError("not-found", "Token invalido o già utilizzato.");
  }
  if (!found.data || found.data.stato !== "invitato") {
    throw new InvitoPubblicoError("not-found", "Token invalido o già utilizzato.");
  }
  if (isInvitoScaduto(found.data.scadeIl, now)) {
    throw new InvitoPubblicoError(
      "failed-precondition",
      "Token scaduto. Contatta l'amministratore per un nuovo invito."
    );
  }
  return {
    ok: true,
    invito: sanitizeInvitoForPublic(found.id, found.data),
  };
}

module.exports = {
  INVITO_TOKEN_MIN_LEN,
  INVITO_TOKEN_MAX_LEN,
  InvitoPubblicoError,
  isInvitoTokenValid,
  firestoreValueToDate,
  firestoreTimestampToIso,
  normalizeRuoli,
  sanitizeInvitoForPublic,
  isInvitoScaduto,
  pickInvitoFromDocs,
  findInvitoByTokenForPublic,
  handleGetInvitoPubblico,
};
