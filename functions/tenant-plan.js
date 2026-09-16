"use strict";

/**
 * Piano abbonamento del tenant — unica regola lato server.
 *
 * Il documento `tenants/{id}` ha due campi storici: la registrazione scrive solo
 * `piano: 'free'`, Stripe (`applyPlanToTenant`) scrive `plan`. Dopo un upgrade il doc
 * contiene entrambi: `plan` deve vincere, altrimenti un tenant Base risulta ancora Free.
 *
 * Il client (`core/js/gfv-tony-loader.js`, widget Tony) mostra Tony anche quando `plan`
 * è rimasto `free` ma esiste un abbonamento Stripe Base attivo; qui applichiamo la stessa
 * regola, così il FAB non compare per poi vedersi rifiutare ogni chiamata dalle CF.
 */

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "expiring"]);

/**
 * @param {unknown} raw
 * @returns {'free'|'base'}
 */
function normalizeSubscriptionPlanId(raw) {
  if (raw == null || raw === "") return "base";
  const p = String(raw).trim().toLowerCase();
  if (p === "free" || p === "freemium") return "free";
  return "base";
}

/**
 * Valore grezzo del piano dal doc tenant (`plan` prima di `piano`).
 * @param {object|null|undefined} tenantData
 * @returns {unknown}
 */
function rawPlanFromTenant(tenantData) {
  const td = tenantData || {};
  return td.plan != null && td.plan !== "" ? td.plan : td.piano;
}

/**
 * Abbonamento Stripe del piano Base ancora valido (status assente = attivo, come il client).
 * @param {object|null|undefined} tenantData
 */
function hasActiveStripeBaseSubscription(tenantData) {
  const td = tenantData || {};
  if (!td.stripeSubscriptionId) return false;
  const status = td.status ? String(td.status).trim().toLowerCase() : "active";
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status);
}

/**
 * Piano effettivo del tenant.
 * @param {object|null|undefined} tenantData - dati `tenants/{id}`
 * @param {{ fallbackRaw?: unknown }} [opts] - valore usato se il doc non ha né `plan` né `piano`
 * @returns {'free'|'base'}
 */
function resolveTenantPlanId(tenantData, opts) {
  const td = tenantData || {};
  let raw = rawPlanFromTenant(td);
  if ((raw == null || raw === "") && opts && opts.fallbackRaw != null) {
    raw = opts.fallbackRaw;
  }
  const planId = normalizeSubscriptionPlanId(raw);
  if (planId === "free" && hasActiveStripeBaseSubscription(td)) return "base";
  return planId;
}

module.exports = {
  normalizeSubscriptionPlanId,
  rawPlanFromTenant,
  hasActiveStripeBaseSubscription,
  resolveTenantPlanId,
};
