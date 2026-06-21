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

module.exports = {
  handleCreateStripeCheckoutSession,
  handleFulfillStripeCheckout,
  handleSyncStripeSubscription,
  syncTenantFromStripeSubscription,
  applyPlanToTenant,
  applyModulePurchaseToTenant,
  applyBundlePurchaseToTenant,
};
