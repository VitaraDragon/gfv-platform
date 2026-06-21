#!/usr/bin/env node
"use strict";

/**
 * Allinea expiryDate Firestore con Stripe (uso una tantum / manutenzione).
 * Uso: node scripts/repair-stripe-expiry.js "Sabbie Gialle"
 */

const { execSync } = require("child_process");
const path = require("path");

const tenantId = process.argv[2];
if (!tenantId) {
  console.error("Uso: node scripts/repair-stripe-expiry.js <tenantId>");
  process.exit(1);
}

const functionsDir = path.join(__dirname, "..", "functions");
const admin = require(path.join(functionsDir, "node_modules", "firebase-admin"));
const { syncTenantFromStripeSubscription } = require(path.join(functionsDir, "stripe-billing.js"));

if (!admin.apps.length) {
  admin.initializeApp({ projectId: "gfv-platform" });
}

const db = admin.firestore();

let stripeKey = process.env.STRIPE_SECRET_KEY || "";
if (!stripeKey) {
  try {
    stripeKey = execSync(
      "gcloud secrets versions access latest --secret=STRIPE_SECRET_KEY --project=gfv-platform",
      { encoding: "utf8" }
    ).trim();
  } catch (e) {
    console.error("Imposta STRIPE_SECRET_KEY o usa gcloud autenticato.");
    process.exit(1);
  }
}

syncTenantFromStripeSubscription(db, stripeKey, tenantId)
  .then((result) => {
    console.log("OK", tenantId, result);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Errore:", err.message || err);
    process.exit(1);
  });
