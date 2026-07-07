#!/usr/bin/env node
/** Tony E2E live tier 3 — CF produzione (GEMINI già su Cloud Run). */
process.env.GFV_TONY_E2E_PROD_CF = '1';
process.env.GFV_TONY_E2E_LIVE = '1';
await import('./load-functions-secret-local.mjs');
await import('./sim-tony-e2e-run.mjs');
