/**
 * Regressione: ogni `handleXxx(` usato in functions/index.js deve essere
 * dichiarato o importato nello stesso file.
 *
 * Il 2026-06-23 un commit ha rimosso `require("./stripe-webhooks")` lasciando
 * `handleStripeWebhookRequest(...)` nel body di `exports.stripeWebhook`: in
 * produzione ogni evento Stripe falliva con ReferenceError (HTTP 500) e nessun
 * test lo intercettava perché i test importano i moduli, non index.js.
 * Su functions/ non gira ESLint (no-undef), quindi il controllo è qui.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(here, '../functions/index.js');

function stripCommentsAndStrings(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``')
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''");
}

describe('functions/index.js — handler usati sono dichiarati o importati', () => {
  const src = stripCommentsAndStrings(readFileSync(indexPath, 'utf8'));

  const used = new Set();
  for (const m of src.matchAll(/\b(handle[A-Z]\w*)\s*\(/g)) used.add(m[1]);

  const declared = new Set();
  for (const m of src.matchAll(/\bfunction\s+(handle[A-Z]\w*)\s*\(/g)) declared.add(m[1]);
  for (const m of src.matchAll(/\b(?:const|let|var)\s+(handle[A-Z]\w*)\s*=/g)) declared.add(m[1]);
  for (const m of src.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\(/g)) {
    m[1]
      .split(',')
      .map((s) => s.trim().split(':').pop().trim())
      .filter(Boolean)
      .forEach((name) => declared.add(name));
  }

  it('nessun handleXxx non definito', () => {
    const missing = [...used].filter((name) => !declared.has(name)).sort();
    expect(missing).toEqual([]);
  });

  it('stripeWebhook importa handleStripeWebhookRequest da ./stripe-webhooks', () => {
    expect(used.has('handleStripeWebhookRequest')).toBe(true);
    expect(src).toMatch(/\{\s*handleStripeWebhookRequest\s*\}\s*=\s*require\(""\)/);
  });
});
