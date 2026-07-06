"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { assertManagerOrAdminForTenant } = require("./email-resend");
const BUNDLES_CATALOG = require("./config/bundles-catalog.json");

const MODULE_TRIAL_DAYS = 30;
const TRIAL_STATUS_ACTIVE = "active";
const TRIAL_STATUS_EXPIRED = "expired";
const TRIAL_STATUS_CONVERTED = "converted";

/** Allineato a core/config/subscription-plans.js AVAILABLE_MODULES (available: true). */
const AVAILABLE_MODULE_IDS = [
  "manodopera",
  "parcoMacchine",
  "contoTerzi",
  "vendemmiaMeccanica",
  "vigneto",
  "frutteto",
  "magazzino",
  "tony",
  "report",
  "meteo",
];

/** Prerequisiti modulo — allineato a requiresModules in subscription-plans.js */
const MODULE_REQUIRES = {
  vendemmiaMeccanica: ["contoTerzi"],
};

function getMissingRequiredModules(tenant, moduleId, now = new Date()) {
  const required = MODULE_REQUIRES[moduleId];
  if (!required || !required.length) return [];
  const effective = resolveEffectiveModules(tenant, now);
  const covered = getModulesCoveredByActiveBundles(tenant);
  return required.filter((id) => !effective.includes(id) && !covered.has(id));
}

function formatMissingModulesReason(missingIds) {
  const labels = {
    contoTerzi: "Conto Terzi",
    manodopera: "Manodopera",
    vendemmiaMeccanica: "Vendemmia Meccanica",
  };
  return missingIds.map((id) => labels[id] || id).join(", ");
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "number") {
    return new Date(value > 1e12 ? value : value * 1000);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isTrialRecordActive(record, now = new Date()) {
  if (!record || record.status !== TRIAL_STATUS_ACTIVE) return false;
  const endsAt = toDate(record.endsAt);
  if (!endsAt) return false;
  return endsAt > now;
}

function getPaidModuleIds(tenant) {
  return Array.isArray(tenant?.modules) ? [...tenant.modules] : [];
}

function getModulesCoveredByActiveBundles(tenant) {
  const activeBundles = Array.isArray(tenant?.activeBundles) ? tenant.activeBundles : [];
  const covered = new Set();
  activeBundles.forEach((bundleId) => {
    const bundle = BUNDLES_CATALOG[bundleId];
    if (bundle && Array.isArray(bundle.modules)) {
      bundle.modules.forEach((m) => covered.add(m));
    }
  });
  return covered;
}

function getActiveTrialModuleIds(moduleTrials, now = new Date()) {
  const trials = moduleTrials && typeof moduleTrials === "object" ? moduleTrials : {};
  return Object.keys(trials).filter((id) => isTrialRecordActive(trials[id], now));
}

function resolveEffectiveModules(tenant, now = new Date()) {
  const paid = getPaidModuleIds(tenant);
  const trialIds = getActiveTrialModuleIds(tenant?.moduleTrials, now);
  return Array.from(new Set([...paid, ...trialIds]));
}

function canStartModuleTrial(tenant, moduleId, now = new Date()) {
  if (!moduleId || typeof moduleId !== "string") {
    return { canStart: false, reason: "Modulo non valido." };
  }
  if (!AVAILABLE_MODULE_IDS.includes(moduleId)) {
    return { canStart: false, reason: "Modulo non disponibile per la prova." };
  }

  const missingRequired = getMissingRequiredModules(tenant, moduleId, now);
  if (missingRequired.length) {
    return {
      canStart: false,
      reason: `Attiva prima: ${formatMissingModulesReason(missingRequired)}.`,
    };
  }

  const paid = getPaidModuleIds(tenant);
  if (paid.includes(moduleId)) {
    return { canStart: false, reason: "Modulo già attivo." };
  }

  const coveredByBundle = getModulesCoveredByActiveBundles(tenant);
  if (coveredByBundle.has(moduleId)) {
    return { canStart: false, reason: "Modulo già incluso in un bundle attivo." };
  }

  const trials = tenant?.moduleTrials || {};
  if (trials[moduleId]) {
    return { canStart: false, reason: "Hai già usato la prova gratuita per questo modulo." };
  }

  const activeTrialIds = getActiveTrialModuleIds(trials, now);
  if (activeTrialIds.length > 0 && !activeTrialIds.includes(moduleId)) {
    return {
      canStart: false,
      reason:
        "Puoi avere un solo modulo in prova alla volta. Attendi la scadenza o attiva l'abbonamento.",
    };
  }

  return { canStart: true, reason: "" };
}

/**
 * Marca trial scaduti in Firestore (accesso già negato dalla risoluzione lazy).
 * @returns {Promise<{ expired: string[] }>}
 */
async function expireStaleModuleTrials(db, tenantId, tenant, now = new Date()) {
  const trials = tenant?.moduleTrials || {};
  const expired = [];
  const updates = {};

  Object.entries(trials).forEach(([moduleId, record]) => {
    if (!record || record.status !== TRIAL_STATUS_ACTIVE) return;
    const endsAt = toDate(record.endsAt);
    if (!endsAt || endsAt > now) return;
    expired.push(moduleId);
    updates[`moduleTrials.${moduleId}.status`] = TRIAL_STATUS_EXPIRED;
    updates[`moduleTrials.${moduleId}.expiredAt`] = admin.firestore.FieldValue.serverTimestamp();
  });

  if (expired.length === 0) {
    return { expired: [] };
  }

  updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  await db.collection("tenants").doc(tenantId).update(updates);
  return { expired };
}

function markModuleTrialConverted(moduleTrials, moduleId) {
  const trials = Object.assign({}, moduleTrials || {});
  if (!trials[moduleId]) return trials;
  trials[moduleId] = Object.assign({}, trials[moduleId], {
    status: TRIAL_STATUS_CONVERTED,
    convertedAt: Date.now(),
  });
  return trials;
}

function markBundleTrialsConverted(moduleTrials, moduleIds) {
  const trials = Object.assign({}, moduleTrials || {});
  moduleIds.forEach((moduleId) => {
    if (!trials[moduleId]) return;
    trials[moduleId] = Object.assign({}, trials[moduleId], {
      status: TRIAL_STATUS_CONVERTED,
      convertedAt: Date.now(),
    });
  });
  return trials;
}

/**
 * Callable: avvia prova gratuita modulo (30 giorni, anche piano Free).
 * Body: { tenantId, moduleId }
 */
async function handleStartModuleTrial(db, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autenticazione richiesta.");
  }

  const data = request.data || {};
  const tenantId = data.tenantId;
  const moduleId = typeof data.moduleId === "string" ? data.moduleId.trim() : "";

  if (!tenantId) {
    throw new HttpsError("invalid-argument", "tenantId obbligatorio.");
  }
  if (!moduleId) {
    throw new HttpsError("invalid-argument", "moduleId obbligatorio.");
  }

  await assertManagerOrAdminForTenant(db, request.auth.uid, tenantId);

  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) {
    throw new HttpsError("not-found", "Tenant non trovato.");
  }

  const tenant = tenantSnap.data() || {};
  const now = new Date();

  await expireStaleModuleTrials(db, tenantId, tenant, now);
  const freshSnap = await tenantRef.get();
  const freshTenant = freshSnap.data() || {};

  const check = canStartModuleTrial(freshTenant, moduleId, now);
  if (!check.canStart) {
    throw new HttpsError("failed-precondition", check.reason);
  }

  const startedAt = admin.firestore.Timestamp.fromDate(now);
  const endsAtDate = new Date(now.getTime() + MODULE_TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const endsAt = admin.firestore.Timestamp.fromDate(endsAtDate);

  const moduleTrials = Object.assign({}, freshTenant.moduleTrials || {});
  moduleTrials[moduleId] = {
    moduleId,
    status: TRIAL_STATUS_ACTIVE,
    startedAt,
    endsAt,
    startedBy: request.auth.uid,
  };

  await tenantRef.update({
    moduleTrials,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const effectiveModules = resolveEffectiveModules(
    Object.assign({}, freshTenant, { moduleTrials }),
    now
  );

  return {
    ok: true,
    moduleId,
    trialDays: MODULE_TRIAL_DAYS,
    endsAt: endsAtDate.toISOString(),
    effectiveModules,
  };
}

/**
 * Callable: allinea trial scaduti e restituisce stato moduli effettivi.
 * Body: { tenantId }
 */
async function handleSyncModuleTrials(db, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autenticazione richiesta.");
  }

  const tenantId = request.data && request.data.tenantId;
  if (!tenantId) {
    throw new HttpsError("invalid-argument", "tenantId obbligatorio.");
  }

  await assertManagerOrAdminForTenant(db, request.auth.uid, tenantId);

  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) {
    throw new HttpsError("not-found", "Tenant non trovato.");
  }

  const tenant = tenantSnap.data() || {};
  const now = new Date();
  const { expired } = await expireStaleModuleTrials(db, tenantId, tenant, now);

  const freshSnap = await tenantRef.get();
  const freshTenant = freshSnap.data() || {};
  const paidModules = getPaidModuleIds(freshTenant);
  const trialModuleIds = getActiveTrialModuleIds(freshTenant.moduleTrials, now);

  return {
    ok: true,
    expired,
    paidModules,
    trialModuleIds,
    effectiveModules: resolveEffectiveModules(freshTenant, now),
    moduleTrials: freshTenant.moduleTrials || {},
  };
}

module.exports = {
  MODULE_TRIAL_DAYS,
  AVAILABLE_MODULE_IDS,
  isTrialRecordActive,
  getPaidModuleIds,
  getActiveTrialModuleIds,
  resolveEffectiveModules,
  canStartModuleTrial,
  expireStaleModuleTrials,
  markModuleTrialConverted,
  markBundleTrialsConverted,
  handleStartModuleTrial,
  handleSyncModuleTrials,
};
