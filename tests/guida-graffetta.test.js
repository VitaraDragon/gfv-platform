/**
 * Guida: navigazione core via graffetta (non «Dashboard → Terreni») e riga Free corretta.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const SORGENTI = {
  'core/GUIDA/CORE/utente/guida-sintesi.md': read('core/GUIDA/CORE/utente/guida-sintesi.md'),
  'docs-sviluppo/GUIDA/CORE/utente/guida-sintesi.md': read('docs-sviluppo/GUIDA/CORE/utente/guida-sintesi.md'),
  'core/GUIDA/CORE/utente/guida.md': read('core/GUIDA/CORE/utente/guida.md'),
  'docs-sviluppo/GUIDA/CORE/utente/guida.md': read('docs-sviluppo/GUIDA/CORE/utente/guida.md'),
  'core/services/tony-guida-app.js': read('core/services/tony-guida-app.js'),
};

const VIETATI = [/Dashboard\s*→\s*Terreni/, /Dalla Dashboard apri/i, /Dashboard\s*→\s*Diario/];

describe('guida graffetta', () => {
  for (const [file, src] of Object.entries(SORGENTI)) {
    it(`${file}: cita la graffetta`, () => {
      expect(src).toMatch(/graffetta/i);
    });
    it(`${file}: nessun percorso «Dashboard → Terreni» / «Dalla Dashboard apri»`, () => {
      for (const re of VIETATI) expect(src).not.toMatch(re);
    });
  }

  it('guida-sintesi: Terreni si raggiunge dalla graffetta', () => {
    expect(SORGENTI['core/GUIDA/CORE/utente/guida-sintesi.md']).toMatch(/graffetta in alto a sinistra → Terreni/);
  });

  it('tony-guida-app: Impostazioni resta l’ingranaggio in alto a destra', () => {
    const src = SORGENTI['core/services/tony-guida-app.js'];
    expect(src).toMatch(/Impostazioni[^.]{0,80}ingranaggio[^.]{0,40}alto a destra|alto a destra[^.]{0,60}Impostazioni/);
  });

  it('guida-sintesi: riga Free non dice «no Tony» ma Tony Guida nei primi 7 giorni', () => {
    for (const f of ['core/GUIDA/CORE/utente/guida-sintesi.md', 'docs-sviluppo/GUIDA/CORE/utente/guida-sintesi.md']) {
      const riga = SORGENTI[f].split('\n').find((l) => /^- \*\*Free\*\*/.test(l));
      expect(riga, f).toBeTruthy();
      expect(riga).not.toMatch(/\*\*no\*\*\s+Tony\b/i);
      expect(riga).toMatch(/Tony Guida solo nei primi 7 giorni/);
    }
  });

  it('mirror core/GUIDA e docs-sviluppo/GUIDA CORE identici', () => {
    expect(SORGENTI['core/GUIDA/CORE/utente/guida-sintesi.md']).toBe(SORGENTI['docs-sviluppo/GUIDA/CORE/utente/guida-sintesi.md']);
    expect(SORGENTI['core/GUIDA/CORE/utente/guida.md']).toBe(SORGENTI['docs-sviluppo/GUIDA/CORE/utente/guida.md']);
  });
});
