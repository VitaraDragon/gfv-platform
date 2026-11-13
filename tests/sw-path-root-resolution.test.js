/**
 * Il service worker resta registrato con il percorso relativo già nelle pagine.
 * Alla radice del sito (Hosting app) quel relativo non sale oltre l'origine e
 * diventa /service-worker.js. Su Pages il ramo assoluto resta /gfv-platform/service-worker.js.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = 'https://gfv-platform-app.web.app';
const PAGES = 'https://vitaradragon.github.io';

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist-app' || name === 'dist') continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function pagineCheRegistranoSw() {
  const files = [];
  for (const dir of ['core', 'modules', 'shared', 'documentazione-utente']) {
    const abs = path.join(root, dir);
    try {
      walk(abs, files);
    } catch {
      /* cartella assente */
    }
  }
  return files
    .map((full) => path.relative(root, full).split(path.sep).join('/'))
    .filter((rel) => readFileSync(path.join(root, rel), 'utf8').includes('registraServiceWorker(swPath)'))
    .sort();
}

const pagine = pagineCheRegistranoSw();

describe('risoluzione swPath alla radice e su Pages', () => {
  it('trova le pagine che registrano il service worker', () => {
    expect(pagine.length).toBeGreaterThanOrEqual(80);
  });

  it.each(pagine)('%s', (rel) => {
    const html = readFileSync(path.join(root, rel), 'utf8');
    const relativo = html.match(/['"]((?:\.\.\/)+service-worker\.js)['"]/)?.[1];
    const suPages = html.match(/['"](\/gfv-platform\/service-worker\.js)['"]/)?.[1];
    expect(relativo, 'manca il swPath relativo').toBeTruthy();
    expect(suPages).toBe('/gfv-platform/service-worker.js');

    const allaRadice = new URL(relativo, `${APP}/${rel}`);
    expect(allaRadice.origin).toBe(APP);
    expect(allaRadice.pathname).toBe('/service-worker.js');

    const pages = new URL(suPages, `${PAGES}/gfv-platform/${rel}`);
    expect(pages.pathname).toBe('/gfv-platform/service-worker.js');
  });
});
