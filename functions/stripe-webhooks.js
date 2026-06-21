"use strict";

const Stripe = require("stripe");
const {
  syncAddonFromStripeSubscription,
  handleStripeInvoicePaymentFailed,
} = require("./stripe-billing");

function getStripeClients(apiKey, webhookSecret) {
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  const secret = typeof webhookSecret === "string" ? webhookSecret.trim() : "";
  if (!key || !/^sk_(test|live)_/.test(key)) {
    throw new Error("STRIPE_SECRET_KEY non configurata.");
  }
  if (!secret || !secret.startsWith("whsec_")) {
    throw new Error("STRIPE_WEBHOOK_SECRET non configurata.");
  }
  return {
    stripe: new Stripe(key),
    webhookSecret: secret,
  };
}

/**
 * HTTP handler Stripe webhook (raw body richiesto).
 */
async function handleStripeWebhookRequest(db, stripeApiKey, webhookSecret, req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  let stripe;
  let whSecret;
  try {
    const clients = getStripeClients(stripeApiKey, webhookSecret);
    stripe = clients.stripe;
    whSecret = clients.webhookSecret;
  } catch (err) {
    console.error("[stripeWebhook] config:", err.message || err);
    res.status(500).send("Stripe webhook non configurato.");
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    res.status(400).send("Missing stripe-signature");
    return;
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    console.error("[stripeWebhook] rawBody assente — verificare onRequest Firebase v2");
    res.status(400).send("Webhook requires raw body");
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, whSecret);
  } catch (err) {
    console.error("[stripeWebhook] signature:", err.message || err);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case "customer.subscription.updated":
        await syncAddonFromStripeSubscription(db, event.data.object, event.type);
        break;
      case "customer.subscription.deleted":
        await syncAddonFromStripeSubscription(db, event.data.object, event.type);
        break;
      case "invoice.payment_failed":
        await handleStripeInvoicePaymentFailed(db, event.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error("[stripeWebhook] handler:", event.type, err.message || err);
    res.status(500).send("Webhook handler failed");
    return;
  }

  res.status(200).json({ received: true, type: event.type });
}

module.exports = {
  handleStripeWebhookRequest,
};
