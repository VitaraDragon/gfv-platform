/**
 * Regressione: ogni import relativo (`./`, `../`) nel codice servito al browser
 * deve puntare a un file presente nel repository e restare dentro il sito.
 *
 * Il 2026-09-05 un commit ha aggiunto in gestione-lavori-maps.js l'import di
 * `../../js/demo-map-privacy.js` senza committare il file: 404 → l'intero
 * `<script type="module">` di Gestione Lavori non partiva, in produzione per
 * undici giorni. I test Playwright lo segnalavano solo dopo 10 minuti di CI.
 *
 * Secondo caso coperto: percorsi che risalgono sopra la radice del repo
 * (`../../../modules/...` da `core/admin/`). In locale il browser tronca a `/`
 * e funzionano; su GitHub Pages il sito vive in `/gfv-platform/`, quindi
 * puntano fuori dal sito → 404.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const SCAN_DIRS = ['core', 'modules', 'shared'];
const SCAN_FILES = ['index.html'];
const EXT = /\.(js|mjs|html)$/;

/**
 * Eccezioni note: `file sorgente -> specifier`.
 * Non allargare senza motivo: ogni voce è un import che in produzione fallisce.
 */
const KNOWN_EXCEPTIONS = new Set([
  // JSON generato da functions/scripts/generate-tony-configs.js, in .gitignore (mirror per test Node).
  'core/config/tony-module-recommendations.js -> ./tony-module-recommendations.json',
  // Pagine legacy pre-standalone, non linkate dal sito: si referenziano solo tra loro.
  'core/dashboard.html -> ./firebase-config.js',
  'core/auth/login.html -> ../firebase-config.js',
]);

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.test(name)) out.push(full);
  }
  return out;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

/** Solo il JS inline degli HTML: gli attributi `src` sono un'altra classe di errore. */
function scriptSource(file, src) {
  if (!file.endsWith('.html')) return src;
  const blocks = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src))) {
    if (!/\bsrc\s*=/.test(m[1])) blocks.push(m[2]);
  }
  return blocks.join('\n');
}

const STATIC_IMPORT = /(?:^|[\s;}])(?:import|export)\s*(?:[\w*{}\s,$]*?\s*from\s*)?['"](\.\.?\/[^'"]+)['"]/g;
const DYNAMIC_IMPORT = /\bimport\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g;

function collectSpecifiers(source) {
  const specs = [];
  for (const re of [STATIC_IMPORT, DYNAMIC_IMPORT]) {
    for (const m of source.matchAll(re)) specs.push(m[1].split(/[?#]/)[0]);
  }
  return specs;
}

function scan() {
  const files = [];
  for (const d of SCAN_DIRS) {
    const full = path.join(root, d);
    if (existsSync(full)) walk(full, files);
  }
  for (const f of SCAN_FILES) {
    const full = path.join(root, f);
    if (existsSync(full)) files.push(full);
  }

  const missing = [];
  const escaping = [];
  let checked = 0;

  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const source = stripComments(scriptSource(file, readFileSync(file, 'utf8')));
    for (const spec of collectSpecifiers(source)) {
      const key = `${rel} -> ${spec}`;
      if (KNOWN_EXCEPTIONS.has(key)) continue;
      checked++;
      const target = path.resolve(path.dirname(file), spec);
      const insideRoot = target === root || target.startsWith(root + path.sep);
      if (!insideRoot) escaping.push(key);
      else if (!existsSync(target)) missing.push(key);
    }
  }
  return { files: files.length, checked, missing, escaping };
}

describe('import relativi nel codice browser (core/, modules/, shared/, index.html)', () => {
  const result = scan();

  it('scansiona un numero plausibile di file e import', () => {
    expect(result.files).toBeGreaterThan(200);
    expect(result.checked).toBeGreaterThan(300);
  });

  it('ogni import relativo punta a un file esistente nel repository', () => {
    expect(
      result.missing,
      `Import verso file assenti (404 in produzione, pagina bloccata se statico):\n  ${result.missing.join('\n  ')}`
    ).toEqual([]);
  });

  it('nessun import risale sopra la radice del sito (GitHub Pages serve /gfv-platform/)', () => {
    expect(
      result.escaping,
      `Percorsi che escono dalla radice del repo:\n  ${result.escaping.join('\n  ')}`
    ).toEqual([]);
  });

  it('le eccezioni note sono ancora necessarie', () => {
    const stale = [...KNOWN_EXCEPTIONS].filter((key) => {
      const [rel, spec] = key.split(' -> ');
      const file = path.join(root, rel);
      if (!existsSync(file)) return true;
      return existsSync(path.resolve(path.dirname(file), spec));
    });
    expect(stale, `Eccezioni da rimuovere da KNOWN_EXCEPTIONS: ${stale.join(', ')}`).toEqual([]);
  });
});
