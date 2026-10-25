/**
 * Membership autorevole per tenant: se esiste tenantMemberships[t], decidono
 * solo stato e ruoli di quella chiave; tenantId/ruoli deprecati valgono solo
 * se la chiave t manca. Allineato a firestore.rules belongsToTenant/hasRole.
 */

const RUOLI_VALIDI = ["amministratore", "manager", "caposquadra", "operaio"];

function hasMembershipKey(userData, tenantId) {
  if (!userData || !tenantId) return false;
  const memberships = userData.tenantMemberships;
  if (!memberships || typeof memberships !== "object") return false;
  return Object.prototype.hasOwnProperty.call(memberships, tenantId);
}

function membershipOf(userData, tenantId) {
  if (!hasMembershipKey(userData, tenantId)) return null;
  return userData.tenantMemberships[tenantId] || null;
}

function isMembershipAttiva(membership) {
  if (!membership || typeof membership !== "object") return false;
  return membership.stato == null || membership.stato === "attivo";
}

/**
 * Appartenenza attiva al tenant.
 * @param {Object|null|undefined} userData
 * @param {string|null|undefined} tenantId
 * @returns {boolean}
 */
function belongsToTenant(userData, tenantId) {
  if (!userData || !tenantId) return false;
  if (hasMembershipKey(userData, tenantId)) {
    return isMembershipAttiva(membershipOf(userData, tenantId));
  }
  if (userData.tenantId === tenantId) {
    return (userData.stato || "attivo") !== "disattivato";
  }
  return false;
}

/**
 * Ruoli effettivi per il tenant (lista vuota se non attivo / non appartiene).
 * @param {Object|null|undefined} userData
 * @param {string|null|undefined} tenantId
 * @returns {string[]}
 */
function rolesForTenant(userData, tenantId) {
  if (!userData || !tenantId) return [];
  if (hasMembershipKey(userData, tenantId)) {
    const m = membershipOf(userData, tenantId);
    if (!isMembershipAttiva(m)) return [];
    return Array.isArray(m.ruoli) ? m.ruoli.map(String) : [];
  }
  if (userData.tenantId === tenantId && Array.isArray(userData.ruoli)) {
    if ((userData.stato || "attivo") === "disattivato") return [];
    return userData.ruoli.map(String);
  }
  return [];
}

/**
 * @param {Object|null|undefined} userData
 * @param {string} role
 * @param {string|null|undefined} tenantId
 * @returns {boolean}
 */
function hasRole(userData, role, tenantId) {
  if (!role) return false;
  return rolesForTenant(userData, tenantId).includes(String(role));
}

/**
 * @param {Object|null|undefined} userData
 * @param {string|null|undefined} tenantId
 * @returns {boolean}
 */
function isManagerOrAdmin(userData, tenantId) {
  const roles = rolesForTenant(userData, tenantId);
  return roles.includes("manager") || roles.includes("amministratore");
}

/**
 * @param {Object|null|undefined} userData
 * @param {string|null|undefined} tenantId
 * @returns {boolean}
 */
function isAmministratore(userData, tenantId) {
  return rolesForTenant(userData, tenantId).includes("amministratore");
}

/**
 * Migra tenantId deprecato in membership se manca la chiave (in-memory).
 * @param {Object|null|undefined} userData
 * @returns {Object} copia di tenantMemberships eventualmente arricchita
 */
function ensureMembershipFromDeprecated(userData) {
  const out = Object.assign({}, (userData && userData.tenantMemberships) || {});
  const legacy = userData && typeof userData.tenantId === "string" ? userData.tenantId : "";
  if (!legacy || out[legacy]) return out;
  out[legacy] = {
    ruoli: Array.isArray(userData.ruoli) ? userData.ruoli.slice() : [],
    stato: userData.stato || "attivo",
    tenantIdPredefinito: true,
  };
  return out;
}

/**
 * Normalizza lista ruoli contro allowlist chiusa.
 * @param {unknown} ruoli
 * @returns {string[]|null} null se vuota o non valida
 */
function normalizeRuoliValidi(ruoli) {
  if (!Array.isArray(ruoli)) return null;
  const cleaned = [];
  const seen = new Set();
  for (const r of ruoli) {
    const s = String(r || "").trim();
    if (!RUOLI_VALIDI.includes(s) || seen.has(s)) continue;
    seen.add(s);
    cleaned.push(s);
  }
  return cleaned.length > 0 ? cleaned : null;
}

module.exports = {
  RUOLI_VALIDI,
  hasMembershipKey,
  membershipOf,
  isMembershipAttiva,
  belongsToTenant,
  rolesForTenant,
  hasRole,
  isManagerOrAdmin,
  isAmministratore,
  ensureMembershipFromDeprecated,
  normalizeRuoliValidi,
};
