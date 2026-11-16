import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RE = /sian\.it|mimffitopub/i;

function fileDiCodice(name) {
  return /\.(js|mjs|cjs|html|css|json|yml|yaml)$/i.test(name);
}

/**
 * functions/: salta node_modules, config e test.
 * shared, core e modules si scandiscono tutti.
 */
function salta(radice, nome) {
  if (radice !== 'functions') return false;
  return nome === 'node_modules' || nome === 'config' || nome === 'test' || nome === 'tests';
}

function walk(dir, radice, out) {
  for (const name of readdirSync(dir)) {
    if (salta(radice, name)) continue;
    const abs = path.join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, radice, out);
    else if (fileDiCodice(name)) out.push(abs);
  }
}

describe('nessun indirizzo SIAN nel codice di produzione', () => {
  it('non trova sian.it né mimfFitoPub', () => {
    const hits = [];
    ['functions', 'shared', 'core', 'modules'].forEach((radice) => {
      const files = [];
      walk(path.join(root, radice), radice, files);
      files.forEach((file) => {
        const text = readFileSync(file, 'utf8');
        if (RE.test(text)) hits.push(path.relative(root, file).replace(/\\/g, '/'));
      });
    });
    expect(hits).toEqual([]);
  });
});
