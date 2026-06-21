/**
 * Stripe — chiave pubblica (test/live) per Checkout lato client.
 * La secret key resta solo in Firebase Secrets (STRIPE_SECRET_KEY).
 *
 * @module core/config/stripe-config
 */

/** @type {'test'|'live'} */
export const STRIPE_ENV = 'test';

/** Publishable key — sicura nel frontend (modalità test). */
export const STRIPE_PUBLISHABLE_KEY =
  'pk_test_51TkTgm3nOKBd0FguIB50glzC3djV1o8NDmgvkxs34rIAuCohZyTQMVdbc7jly5CJVEH3Rgoo1pTonAIcl7fociKq00rEikv04j';
