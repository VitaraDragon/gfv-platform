"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const { assertManagerOrAdminForTenant } = require("./email-resend");

/** Allineare a core/config/subscription-plans.js (STRIPE_PRICE_IDS). */
const STRIPE_PRICE_IDS = require("./config/stripe-prices.json");
const BUNDLES_CATALOG = require("./config/bundles-catalog.json");
const STRIPE_ENV = process.env.STRIPE_ENV || "test";

function getStripeClient(apiKey) {
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) {
    throw new HttpsError("failed-precondition", "Stripe non configurato sul server.");
  }
  if (!/^sk_(test|live)_/.test(key)) {
    throw new HttpsError(
      "failed-precondition",
      "STRIPE_SECRET_KEY non valida sul server (attesa sk_test_… o sk_live_…)."
    );
  }
  return new Stripe(key);
}

function wrapStripeError(err) {
  if (!err || typeof err !== "object") {
    throw new HttpsError("internal", "Errore Stripe imprevisto.");
  }
  const type = err.type || err.rawType || "";
  if (type === "StripeAuthenticationError") {
    throw new HttpsError(
      "failed-precondition",
      "Chiave Stripe non valida sul server. Reimposta STRIPE_SECRET_KEY e ridistribuisci le functions."
    );
  }
  const msg =
    (err.raw && err.raw.message) ||
    err.message ||
    "Errore Stripe durante il checkout.";
  throw new HttpsError("failed-precondition", String(msg));
}

function getPriceIdForCatalog(catalogId) {
  const envMap = STRIPE_PRICE_IDS[STRIPE_ENV] || {};
  const priceId = envMap[catalogId];
  return typeof priceId === "string" && priceId.startsWith("price_") ? priceId : null;
}

function normalizePlanId(raw) {
  if (raw == null || raw === "") return "base";
  const p = String(raw).trim().toLowerCase();
  if (p === "free" || p === "freemium") return "free";
  if (["starter", "professional", "enterprise", "base"].includes(p)) return "base";
  return "base";
}

/** URL di ritorno Checkout: https in produzione; localhost http ammesso in test Stripe. */
function safeCheckoutReturnUrl(u) {
  if (!u || typeof u !== "string") return null;
  const t = u.trim();
  if (/^https:\/\/.+/i.test(t)) return t;
  if (
    STRIPE_ENV === "test" &&
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(t)
  ) {
    return t;
  }
  return null;
}

function resolveCheckoutRequest(data) {
  const checkoutType =
    data.checkoutType ||
    (data.moduleId ? "module" : data.bundleId ? "bundle" : "plan");
  const catalogId =
    data.catalogId || data.planId || data.moduleId || data.bundleId || "base";
  return { checkoutType, catalogId: String(catalogId) };
}

/**
 * Applica abbonamento piano Base al tenant Firestore.
 */
async function applyPlanToTenant(db, tenantId, planId, stripeInfo = {}) {
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) {
    throw new HttpsError("not-found", "Tenant non trovato.");
  }
  const existing = tenantSnap.data() || {};
  const updates = {
    plan: planId,
    status: "active",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (stripeInfo.customerId) updates.stripeCustomerId = stripeInfo.customerId;
  if (stripeInfo.subscriptionId) updates.stripeSubscriptionId = stripeInfo.subscriptionId;
  if (stripeInfo.currentPeriodEnd) {
    updates.expiryDate = admin.firestore.Timestamp.fromMillis(stripeInfo.currentPeriodEnd * 1000);
  }
  if (stripeInfo.subscriptionStatus === "active" || stripeInfo.subscriptionStatus === "trialing") {
    updates.status = "active";
  } else if (stripeInfo.subscriptionStatus === "canceled" || stripeInfo.subscriptionStatus === "unpaid") {
    updates.status = "expired";
  }
  if (!existing.startDate) {
    updates.startDate = admin.firestore.FieldValue.serverTimestamp();
  }
  await tenantRef.update(updates);
}

async function applyModulePurchaseToTenant(db, tenantId, moduleId, stripeInfo = {}) {
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) {
    throw new HttpsError("not-found", "Tenant non trovato.");
  }
  const existing = tenantSnap.data() || {};
  const modules = Array.isArray(existing.modules) ? [...existing.modules] : [];
  if (!modules.includes(moduleId)) modules.push(moduleId);

  const stripeAddons = Object.assign({}, existing.stripeAddons || {});
  stripeAddons[moduleId] = {
    type: "module",
    subscriptionId: stripeInfo.subscriptionId || null,
    periodEnd: stripeInfo.currentPeriodEnd || null,
    updatedAt: Date.now(),
  };

  const updates = {
    modules,
    stripeAddons,
    status: "active",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (stripeInfo.customerId && !existing.stripeCustomerId) {
    updates.stripeCustomerId = stripeInfo.customerId;
  }
  await tenantRef.update(updates);
}

async function applyBundlePurchaseToTenant(db, tenantId, bundleId, stripeInfo = {}) {
  const bundle = BUNDLES_CATALOG[bundleId];
  if (!bundle || !Array.isArray(bundle.modules)) {
    throw new HttpsError("failed-precondition", `Bundle "${bundleId}" non configurato sul server.`);
  }
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) {
    throw new HttpsError("not-found", "Tenant non trovato.");
  }
  const existing = tenantSnap.data() || {};
  const modules = new Set(Array.isArray(existing.modules) ? existing.modules : []);
  bundle.modules.forEach((m) => modules.add(m));

  const activeBundles = Array.isArray(existing.activeBundles) ? [...existing.activeBundles] : [];
  if (!activeBundles.includes(bundleId)) activeBundles.push(bundleId);

  const stripeAddons = Object.assign({}, existing.stripeAddons || {});
  stripeAddons[bundleId] = {
    type: "bundle",
    subscriptionId: stripeInfo.subscriptionId || null,
    periodEnd: stripeInfo.currentPeriodEnd || null,
    modules: bundle.modules,
    updatedAt: Date.now(),
  };

  const updates = {
    modules: Array.from(modules),
    activeBundles,
    stripeAddons,
    status: "active",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (stripeInfo.customerId && !existing.stripeCustomerId) {
    updates.stripeCustomerId = stripeInfo.customerId;
  }
  await tenantRef.update(updates);
}

async function fetchSubscriptionPeriodEnd(stripe, subscriptionId) {
  if (!subscriptionId) return { currentPeriodEnd: null, subscriptionStatus: null };
  try {
    const sub = await stripe.subscriptions.retrieve(String(subscriptionId));
    let currentPeriodEnd = sub.current_period_end || null;
    if (!currentPeriodEnd && sub.items && Array.isArray(sub.items.data) && sub.items.data[0]) {
      currentPeriodEnd = sub.items.data[0].current_period_end || null;
    }
    return {
      currentPeriodEnd,
      subscriptionStatus: sub.status || null,
    };
  } catch (err) {
    console.error("[fetchSubscriptionPeriodEnd]", err.message || err);
    wrapStripeError(err);
  }
  return { currentPeriodEnd: null, subscriptionStatus: null };
}

async function syncTenantFromStripeSubscription(db, stripeApiKey, tenantId) {
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnap.exists) {
    throw new HttpsError("not-found", "Tenant non trovato.");
  }
  const tenant = tenantSnap.data() || {};
  const subscriptionId = tenant.stripeSubscriptionId;
  if (!subscriptionId) {
    throw new HttpsError("failed-precondition", "Nessun abbonamento Stripe collegato a questo tenant.");
  }
  const stripe = getStripeClient(stripeApiKey);
  const { currentPeriodEnd, subscriptionStatus } = await fetchSubscriptionPeriodEnd(stripe, subscriptionId);
  if (!currentPeriodEnd) {
    throw new HttpsError("failed-precondition", "Impossibile leggere la scadenza da Stripe.");
  }
  const planId = tenant.plan || tenant.piano || "base";
  await applyPlanToTenant(db, tenantId, planId === "free" ? "base" : planId, {
    customerId: tenant.stripeCustomerId,
    subscriptionId,
    currentPeriodEnd,
    subscriptionStatus,
  });
  return {
    ok: true,
    expiryDate: new Date(currentPeriodEnd * 1000).toISOString(),
    subscriptionStatus,
  };
}

/**
 * Callable: crea Stripe Checkout Session (piano / modulo / bundle).
 * Body: { tenantId, checkoutType?, catalogId?, planId?, moduleId?, bundleId?, successUrl, cancelUrl }
 */
async function handleCreateStripeCheckoutSession(db, stripeApiKey, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autenticazione richiesta.");
  }
  const data = request.data || {};
  const tenantId = data.tenantId;
  const { checkoutType, catalogId } = resolveCheckoutRequest(data);
  const successUrl = safeCheckoutReturnUrl(data.successUrl);
  const cancelUrl = safeCheckoutReturnUrl(data.cancelUrl);

  if (!tenantId) {
    throw new HttpsError("invalid-argument", "tenantId obbligatorio.");
  }
  if (!successUrl || !cancelUrl) {
    throw new HttpsError(
      "invalid-argument",
      "successUrl e cancelUrl devono essere URL https validi (in test anche http://localhost o http://127.0.0.1)."
    );
  }

  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnap.exists) {
    throw new HttpsError("not-found", "Tenant non trovato.");
  }
  const tenantPlan = normalizePlanId(tenantSnap.data()?.plan || tenantSnap.data()?.piano);

  if (checkoutType === "plan") {
    if (catalogId === "free") {
      throw new HttpsError("invalid-argument", "Il piano Free non richiede pagamento.");
    }
  } else if (tenantPlan === "free") {
    throw new HttpsError(
      "failed-precondition",
      "Attiva prima il piano Base prima di acquistare moduli o bundle."
    );
  }

  const priceId = getPriceIdForCatalog(catalogId);
  if (!priceId) {
    throw new HttpsError(
      "failed-precondition",
      `Prezzo Stripe non configurato per "${catalogId}".`
    );
  }

  if (checkoutType === "bundle" && !BUNDLES_CATALOG[catalogId]) {
    throw new HttpsError("failed-precondition", `Bundle "${catalogId}" non riconosciuto.`);
  }

  await assertManagerOrAdminForTenant(db, request.auth.uid, tenantId);

  const stripe = getStripeClient(stripeApiKey);
  const email = request.auth.token && request.auth.token.email ? String(request.auth.token.email) : undefined;

  const successWithSession = successUrl.includes("?")
    ? `${successUrl}&checkout=success&session_id={CHECKOUT_SESSION_ID}`
    : `${successUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelWithFlag = cancelUrl.includes("?")
    ? `${cancelUrl}&checkout=cancelled`
    : `${cancelUrl}?checkout=cancelled`;

  const metadata = {
    tenantId,
    checkoutType,
    catalogId,
    uid: request.auth.uid,
  };
  if (checkoutType === "plan") metadata.planId = catalogId;
  if (checkoutType === "module") metadata.moduleId = catalogId;
  if (checkoutType === "bundle") metadata.bundleId = catalogId;

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successWithSession,
      cancel_url: cancelWithFlag,
      client_reference_id: tenantId,
      customer_email: email,
      metadata,
      subscription_data: { metadata },
    });
  } catch (err) {
    console.error("[createStripeCheckoutSession]", err.type || err.message);
    wrapStripeError(err);
  }

  if (!session.url) {
    throw new HttpsError("internal", "Impossibile avviare il checkout Stripe.");
  }

  return { url: session.url, sessionId: session.id, checkoutType, catalogId };
}

async function handleFulfillStripeCheckout(db, stripeApiKey, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autenticazione richiesta.");
  }
  const data = request.data || {};
  const tenantId = data.tenantId;
  const sessionId = data.sessionId;

  if (!tenantId || !sessionId) {
    throw new HttpsError("invalid-argument", "tenantId e sessionId obbligatori.");
  }

  await assertManagerOrAdminForTenant(db, request.auth.uid, tenantId);

  const stripe = getStripeClient(stripeApiKey);
  const session = await stripe.checkout.sessions.retrieve(String(sessionId), {
    expand: ["subscription"],
  });

  if (session.metadata && session.metadata.tenantId && session.metadata.tenantId !== tenantId) {
    throw new HttpsError("permission-denied", "Sessione non valida per questo tenant.");
  }
  if (session.client_reference_id && session.client_reference_id !== tenantId) {
    throw new HttpsError("permission-denied", "Sessione non valida per questo tenant.");
  }
  if (session.payment_status !== "paid" && session.status !== "complete") {
    throw new HttpsError("failed-precondition", "Pagamento non ancora completato.");
  }

  const meta = session.metadata || {};
  const checkoutType = meta.checkoutType || "plan";
  const catalogId = meta.catalogId || meta.planId || meta.moduleId || meta.bundleId || "base";

  let subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  let currentPeriodEnd = null;
  let subscriptionStatus = null;

  if (subscriptionId) {
    const period = await fetchSubscriptionPeriodEnd(stripe, subscriptionId);
    currentPeriodEnd = period.currentPeriodEnd;
    subscriptionStatus = period.subscriptionStatus;
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const stripeInfo = { customerId, subscriptionId, currentPeriodEnd, subscriptionStatus };

  if (checkoutType === "module") {
    await applyModulePurchaseToTenant(db, tenantId, catalogId, stripeInfo);
    return { ok: true, checkoutType, catalogId, subscriptionId: subscriptionId || null };
  }
  if (checkoutType === "bundle") {
    await applyBundlePurchaseToTenant(db, tenantId, catalogId, stripeInfo);
    return { ok: true, checkoutType, catalogId, subscriptionId: subscriptionId || null };
  }

  await applyPlanToTenant(db, tenantId, catalogId === "free" ? "base" : catalogId, stripeInfo);
  return { ok: true, checkoutType: "plan", catalogId, subscriptionId: subscriptionId || null, expiryDate: currentPeriodEnd };
}

async function handleSyncStripeSubscription(db, stripeApiKey, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autenticazione richiesta.");
  }
  const tenantId = request.data && request.data.tenantId;
  if (!tenantId) {
    throw new HttpsError("invalid-argument", "tenantId obbligatorio.");
  }
  await assertManagerOrAdminForTenant(db, request.auth.uid, tenantId);
  return syncTenantFromStripeSubscription(db, stripeApiKey, tenantId);
}

function normalizeAddonType(raw) {
  const t = String(raw || "").trim().toLowerCase();
  if (t === "bundle") return "bundle";
  return "module";
}

function expiryTimestampToUnixSeconds(expiryDate) {
  if (!expiryDate) return null;
  if (typeof expiryDate.toDate === "function") {
    return Math.floor(expiryDate.toDate().getTime() / 1000);
  }
  if (typeof expiryDate === "number") {
    return expiryDate > 1e12 ? Math.floor(expiryDate / 1000) : Math.floor(expiryDate);
  }
  const parsed = new Date(expiryDate);
  return Number.isNaN(parsed.getTime()) ? null : Math.floor(parsed.getTime() / 1000);
}

function modulesStillCoveredByOtherAddons(modules, activeBundles, stripeAddons, excludeAddonId) {
  const covered = new Set();
  activeBundles.forEach((bundleId) => {
    const bundle = BUNDLES_CATALOG[bundleId];
    if (bundle && Array.isArray(bundle.modules)) {
      bundle.modules.forEach((m) => covered.add(m));
    }
  });
  Object.entries(stripeAddons || {}).forEach(([id, addon]) => {
    if (id === excludeAddonId) return;
    if (addon && addon.type === "module") covered.add(id);
  });
  return covered;
}

/**
 * Rimuove addon scaduto/cancellato da tenant (modules, activeBundles, stripeAddons).
 */
async function finalizeAddonDeactivation(db, tenantId, addonId, addonType) {
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) return { ok: false, reason: "tenant_not_found" };

  const existing = tenantSnap.data() || {};
  const stripeAddons = Object.assign({}, existing.stripeAddons || {});
  delete stripeAddons[addonId];

  let modules = Array.isArray(existing.modules) ? [...existing.modules] : [];
  let activeBundles = Array.isArray(existing.activeBundles) ? [...existing.activeBundles] : [];

  if (addonType === "bundle") {
    activeBundles = activeBundles.filter((id) => id !== addonId);
    const bundle = BUNDLES_CATALOG[addonId];
    if (bundle && Array.isArray(bundle.modules)) {
      const stillCovered = modulesStillCoveredByOtherAddons(modules, activeBundles, stripeAddons, addonId);
      modules = modules.filter((modId) => !bundle.modules.includes(modId) || stillCovered.has(modId));
    }
  } else {
    modules = modules.filter((modId) => modId !== addonId);
    activeBundles = activeBundles.filter((bundleId) => {
      const bundle = BUNDLES_CATALOG[bundleId];
      if (!bundle || !Array.isArray(bundle.modules)) return true;
      return bundle.modules.every((modId) => modId === addonId || modules.includes(modId));
    });
  }

  await tenantRef.update({
    modules,
    activeBundles,
    stripeAddons,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, modules, activeBundles };
}

async function markAddonPendingDeactivation(db, tenantId, addonId, addonType, deactivatesAtUnix) {
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) {
    throw new HttpsError("not-found", "Tenant non trovato.");
  }
  const existing = tenantSnap.data() || {};
  const stripeAddons = Object.assign({}, existing.stripeAddons || {});
  const prev = stripeAddons[addonId] || { type: addonType };
  stripeAddons[addonId] = Object.assign({}, prev, {
    type: addonType,
    pendingDeactivation: true,
    cancelAtPeriodEnd: true,
    deactivatesAt: deactivatesAtUnix,
    periodEnd: deactivatesAtUnix,
    updatedAt: Date.now(),
  });

  await tenantRef.update({
    stripeAddons,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    addonId,
    addonType,
    deactivatesAt: deactivatesAtUnix,
    deactivatesAtIso: deactivatesAtUnix ? new Date(deactivatesAtUnix * 1000).toISOString() : null,
  };
}

async function clearAddonPendingDeactivation(db, tenantId, addonId, addonType, periodEndUnix) {
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) {
    throw new HttpsError("not-found", "Tenant non trovato.");
  }
  const existing = tenantSnap.data() || {};
  const stripeAddons = Object.assign({}, existing.stripeAddons || {});
  const prev = stripeAddons[addonId] || { type: addonType };
  stripeAddons[addonId] = Object.assign({}, prev, {
    type: addonType,
    pendingDeactivation: false,
    cancelAtPeriodEnd: false,
    deactivatesAt: null,
    periodEnd: periodEndUnix || prev.periodEnd || null,
    updatedAt: Date.now(),
  });

  await tenantRef.update({
    stripeAddons,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, addonId };
}

function resolveAddonStripeRecord(tenant, addonId, addonType) {
  const stripeAddons = tenant.stripeAddons || {};
  if (stripeAddons[addonId]) {
    return { addon: stripeAddons[addonId], billingKey: addonId };
  }
  if (addonType === "module") {
    const activeBundles = Array.isArray(tenant.activeBundles) ? tenant.activeBundles : [];
    for (const bundleId of activeBundles) {
      const bundle = BUNDLES_CATALOG[bundleId];
      if (bundle && bundle.modules.includes(addonId) && stripeAddons[bundleId]) {
        return {
          addon: stripeAddons[bundleId],
          billingKey: bundleId,
          billedViaBundleId: bundleId,
        };
      }
    }
  }
  return { addon: null, billingKey: addonId };
}

/**
 * Callable: disattiva modulo/bundle a fine periodo (cancel_at_period_end su Stripe).
 * Body: { tenantId, addonId, addonType?: 'module'|'bundle' }
 */
async function handleCancelStripeAddon(db, stripeApiKey, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autenticazione richiesta.");
  }
  const data = request.data || {};
  const tenantId = data.tenantId;
  const addonId = data.addonId || data.moduleId || data.bundleId;
  const addonType = normalizeAddonType(data.addonType || (data.bundleId ? "bundle" : "module"));

  if (!tenantId || !addonId) {
    throw new HttpsError("invalid-argument", "tenantId e addonId obbligatori.");
  }

  await assertManagerOrAdminForTenant(db, request.auth.uid, tenantId);

  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnap.exists) {
    throw new HttpsError("not-found", "Tenant non trovato.");
  }
  const tenant = tenantSnap.data() || {};

  if (addonType === "bundle") {
    if (!Array.isArray(tenant.activeBundles) || !tenant.activeBundles.includes(addonId)) {
      throw new HttpsError("failed-precondition", "Il bundle non è attivo.");
    }
  } else if (!Array.isArray(tenant.modules) || !tenant.modules.includes(addonId)) {
    throw new HttpsError("failed-precondition", "Il modulo non è attivo.");
  }

  const { addon, billingKey, billedViaBundleId } = resolveAddonStripeRecord(tenant, addonId, addonType);
  if (addonType === "module" && billedViaBundleId) {
    throw new HttpsError(
      "failed-precondition",
      `Il modulo è incluso nel bundle attivo. Disattiva il bundle "${billedViaBundleId}".`
    );
  }

  if (addon && addon.pendingDeactivation) {
    return {
      ok: true,
      alreadyPending: true,
      addonId: billingKey,
      deactivatesAt: addon.deactivatesAt || addon.periodEnd || null,
    };
  }

  const subscriptionId = addon && addon.subscriptionId ? String(addon.subscriptionId) : null;
  if (!subscriptionId) {
    await finalizeAddonDeactivation(db, tenantId, billingKey, addonType === "bundle" ? "bundle" : "module");
    return {
      ok: true,
      immediate: true,
      addonId: billingKey,
      message: "Addon senza abbonamento Stripe collegato: disattivazione immediata.",
    };
  }

  const stripe = getStripeClient(stripeApiKey);
  let deactivatesAtUnix = addon.periodEnd || null;
  try {
    const sub = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    deactivatesAtUnix = sub.current_period_end || deactivatesAtUnix;
    if (!deactivatesAtUnix && sub.items && sub.items.data && sub.items.data[0]) {
      deactivatesAtUnix = sub.items.data[0].current_period_end || null;
    }
  } catch (err) {
    console.error("[cancelStripeAddon]", err.message || err);
    wrapStripeError(err);
  }

  if (!deactivatesAtUnix) {
    deactivatesAtUnix = expiryTimestampToUnixSeconds(tenant.expiryDate);
  }

  const result = await markAddonPendingDeactivation(
    db,
    tenantId,
    billingKey,
    addonType,
    deactivatesAtUnix
  );

  return Object.assign({ ok: true, immediate: false }, result);
}

/**
 * Callable: annulla disattivazione programmata (cancel_at_period_end = false).
 * Body: { tenantId, addonId, addonType?: 'module'|'bundle' }
 */
async function handleReactivateStripeAddon(db, stripeApiKey, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autenticazione richiesta.");
  }
  const data = request.data || {};
  const tenantId = data.tenantId;
  const addonId = data.addonId || data.moduleId || data.bundleId;
  const addonType = normalizeAddonType(data.addonType || (data.bundleId ? "bundle" : "module"));

  if (!tenantId || !addonId) {
    throw new HttpsError("invalid-argument", "tenantId e addonId obbligatori.");
  }

  await assertManagerOrAdminForTenant(db, request.auth.uid, tenantId);

  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnap.exists) {
    throw new HttpsError("not-found", "Tenant non trovato.");
  }
  const tenant = tenantSnap.data() || {};
  const { addon, billingKey } = resolveAddonStripeRecord(tenant, addonId, addonType);

  if (!addon || !addon.pendingDeactivation) {
    throw new HttpsError("failed-precondition", "Nessuna disattivazione programmata per questo addon.");
  }

  const subscriptionId = addon.subscriptionId ? String(addon.subscriptionId) : null;
  let periodEndUnix = addon.periodEnd || addon.deactivatesAt || null;

  if (subscriptionId) {
    const stripe = getStripeClient(stripeApiKey);
    try {
      const sub = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
      periodEndUnix = sub.current_period_end || periodEndUnix;
    } catch (err) {
      console.error("[reactivateStripeAddon]", err.message || err);
      wrapStripeError(err);
    }
  }

  await clearAddonPendingDeactivation(db, tenantId, billingKey, addonType, periodEndUnix);
  return { ok: true, addonId: billingKey, periodEnd: periodEndUnix };
}

async function findTenantIdBySubscriptionId(db, subscriptionId) {
  if (!subscriptionId) return null;
  const sid = String(subscriptionId);
  const byBase = await db.collection("tenants").where("stripeSubscriptionId", "==", sid).limit(1).get();
  if (!byBase.empty) return byBase.docs[0].id;

  const tenantsSnap = await db.collection("tenants").get();
  for (const docSnap of tenantsSnap.docs) {
    const addons = docSnap.data()?.stripeAddons || {};
    for (const entry of Object.values(addons)) {
      if (entry && String(entry.subscriptionId) === sid) {
        return docSnap.id;
      }
    }
  }
  return null;
}

async function syncAddonFromStripeSubscription(db, subscription, eventType) {
  const meta = subscription.metadata || {};
  let tenantId = meta.tenantId || null;
  if (!tenantId) {
    tenantId = await findTenantIdBySubscriptionId(db, subscription.id);
  }
  if (!tenantId) {
    console.warn("[stripe-webhook] tenant non trovato per subscription", subscription.id);
    return { ok: false, reason: "tenant_not_found" };
  }

  const checkoutType = meta.checkoutType || "plan";
  const catalogId = meta.catalogId || meta.planId || meta.moduleId || meta.bundleId || null;
  const status = subscription.status || "";
  const cancelAtPeriodEnd = !!subscription.cancel_at_period_end;
  let periodEnd = subscription.current_period_end || null;
  if (!periodEnd && subscription.items && subscription.items.data && subscription.items.data[0]) {
    periodEnd = subscription.items.data[0].current_period_end || null;
  }

  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const tenant = tenantSnap.data() || {};
  const isBaseSubscription = String(tenant.stripeSubscriptionId || "") === String(subscription.id);

  if (isBaseSubscription || checkoutType === "plan") {
    if (status === "canceled" || status === "unpaid" || eventType === "customer.subscription.deleted") {
      await db.collection("tenants").doc(tenantId).update({
        status: "expired",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { ok: true, tenantId, scope: "plan", action: "expired" };
    }
    await applyPlanToTenant(db, tenantId, tenant.plan || tenant.piano || "base", {
      customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
      subscriptionId: subscription.id,
      currentPeriodEnd: periodEnd,
      subscriptionStatus: status,
    });
    return { ok: true, tenantId, scope: "plan", action: "sync" };
  }

  let addonId = catalogId;
  let addonType = checkoutType === "bundle" ? "bundle" : "module";
  if (!addonId) {
    for (const [id, entry] of Object.entries(tenant.stripeAddons || {})) {
      if (entry && String(entry.subscriptionId) === String(subscription.id)) {
        addonId = id;
        addonType = entry.type === "bundle" ? "bundle" : "module";
        break;
      }
    }
  }
  if (!addonId) {
    return { ok: false, reason: "missing_catalog_id" };
  }

  if (status === "canceled" || eventType === "customer.subscription.deleted") {
    await finalizeAddonDeactivation(db, tenantId, addonId, addonType);
    return { ok: true, tenantId, addonId, action: "finalized" };
  }

  if (cancelAtPeriodEnd) {
    await markAddonPendingDeactivation(db, tenantId, addonId, addonType, periodEnd);
    return { ok: true, tenantId, addonId, action: "pending_deactivation" };
  }

  await clearAddonPendingDeactivation(db, tenantId, addonId, addonType, periodEnd);
  return { ok: true, tenantId, addonId, action: "reactivated" };
}

async function handleStripeInvoicePaymentFailed(db, invoice) {
  const subscriptionId =
    typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!subscriptionId) return { ok: false, reason: "no_subscription" };

  const tenantId = await findTenantIdBySubscriptionId(db, subscriptionId);
  if (!tenantId) return { ok: false, reason: "tenant_not_found" };

  await db.collection("tenants").doc(tenantId).update({
    billingPaymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, tenantId };
}

module.exports = {
  handleCreateStripeCheckoutSession,
  handleFulfillStripeCheckout,
  handleSyncStripeSubscription,
  handleCancelStripeAddon,
  handleReactivateStripeAddon,
  syncTenantFromStripeSubscription,
  syncAddonFromStripeSubscription,
  handleStripeInvoicePaymentFailed,
  finalizeAddonDeactivation,
  applyPlanToTenant,
  applyModulePurchaseToTenant,
  applyBundlePurchaseToTenant,
  normalizeAddonType,
  expiryTimestampToUnixSeconds,
};
