import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('A3 — nessun prezzo flash hardcoded in Abbonamento', () => {
  const src = readFileSync(
    new URL('../core/admin/abbonamento-standalone.html', import.meta.url),
    'utf8'
  );

  it('piano corrente non ha prezzo o nome piano scritti a mano prima del caricamento', () => {
    expect(src).toMatch(/id="current-plan-name">…</);
    expect(src).toMatch(/id="current-plan-price">…</);
    expect(src).not.toMatch(/id="current-plan-price">€\d/);
    expect(src).not.toMatch(/id="current-plan-name">Base</);
  });

  it('sezione upgrade non ha €5/€60 fissi nell\'HTML', () => {
    expect(src).toContain('id="upgrade-base-monthly"');
    expect(src).toContain('id="upgrade-base-annual"');
    expect(src).not.toMatch(/id="upgrade-base-monthly">€5/);
    expect(src).not.toMatch(/Fatturato <strong>€60\/anno<\/strong>/);
  });
});
