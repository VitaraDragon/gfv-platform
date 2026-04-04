/**
 * Inizializzazione Sentry per Cloud Functions (deve essere caricata prima di altri require).
 * DSN: progetto Sentry `node-gcpfunctions` (org `sabbie-gialle`). Imposta SENTRY_DSN su Cloud Run / secrets.
 * @see https://docs.sentry.io/platforms/javascript/guides/firebase/
 */
"use strict";

const Sentry = require("@sentry/node");

const dsn = process.env.SENTRY_DSN;
if (dsn && String(dsn).trim() !== "") {
  const traces =
    process.env.SENTRY_TRACES_SAMPLE_RATE !== undefined
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : 0.2;
  Sentry.init({
    dsn: String(dsn).trim(),
    environment:
      process.env.SENTRY_ENVIRONMENT ||
      process.env.GCLOUD_PROJECT ||
      "production",
    sendDefaultPii: true,
    tracesSampleRate: Number.isFinite(traces) ? Math.min(1, Math.max(0, traces)) : 0.2,
  });
} else {
  console.warn("[Sentry] SENTRY_DSN non impostato: monitoring disattivato.");
}
