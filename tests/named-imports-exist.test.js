/**
 * Regressione: ogni import nominato relativo (`import { a, b as c } from './rel.js'`)
 * in core/, modules/ e shared/ deve nominare un export reale del file di destinazione.
 *
 * Il 2026-11-17 `modules/orticole/js/trattamenti-page.js` importava
 * `chiediRiletturaScheda` e `leggiRigheSchedaProdotto` da un modulo che esporta
 * solo `leggiSchedaRegistroTrattamento`. Il modulo ES non si carica e le pagine
 * Trattamenti e Concimazioni restano su «Caricamento...».
 *
 * `export *` è accettato: se è relativo si seguono gli export del bersaglio;
 * se non è risolvibile, il modulo è considerato aperto.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const SCAN_DIRS = ['core', 'modules', 'shared'];
const EXT = /\.(js|mjs|html)$/;

const NAMED_IMPORT = /\bimport\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g;
const EXPORT_FN = /(?:^|[\s;}])export\s+(?:async\s+)?function\s*\*?\s*([\w$]+)/g;
const EXPORT_CLASS = /(?:^|[\s;}])export\s+class\s+([\w$]+)/g;
const EXPORT_DECL = /(?:^|[\s;}])export\s+(?:const|let|var)\s+/g;
const EXPORT_LIST = /(?:^|[\s;}])export\s*\{([^}]+)\}/g;
const EXPORT_STAR_AS = /(?:^|[\s;}])export\s*\*\s*as\s+([\w$]+)\s+from\s*['"][^'"]+['"]/g;
const EXPORT_STAR = /(?:^|[\s;}])export\s*\*\s*from\s*['"]([^'"]+)['"]/g;

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

function isRelative(spec) {
  return spec.startsWith('./') || spec.startsWith('../');
}

function importedNames(clause) {
  const names = [];
  for (const raw of clause.split(',')) {
    const part = raw.replace(/^\s*type\s+/, '').trim();
    if (!part) continue;
    const asMatch = part.match(/^([\w$]+)\s+as\s+[\w$]+$/);
    if (asMatch) {
      names.push(asMatch[1]);
      continue;
    }
    const id = part.match(/^([\w$]+)$/);
    if (id) names.push(id[1]);
  }
  return names;
}

function exportedNamesFromClause(clause) {
  const names = [];
  for (const raw of clause.split(',')) {
    const part = raw.replace(/^\s*type\s+/, '').trim();
    if (!part) continue;
    const asMatch = part.match(/^(?:[\w$]+)\s+as\s+([\w$]+)$/);
    if (asMatch) {
      if (asMatch[1] !== 'default') names.push(asMatch[1]);
      continue;
    }
    const id = part.match(/^([\w$]+)$/);
    if (id && id[1] !== 'default') names.push(id[1]);
  }
  return names;
}

function addBindingNames(fragment, names) {
  let i = 0;
  const s = fragment.trim();
  while (i < s.length) {
    while (i < s.length && /[\s,]/.test(s[i])) i += 1;
    if (i >= s.length) break;
    if (s[i] === '{' || s[i] === '[') {
      const open = s[i];
      const close = open === '{' ? '}' : ']';
      let depth = 0;
      const start = i;
      for (; i < s.length; i += 1) {
        if (s[i] === open) depth += 1;
        else if (s[i] === close) {
          depth -= 1;
          if (depth === 0) {
            i += 1;
            break;
          }
        }
      }
      const inner = s.slice(start + 1, i - 1);
      if (open === '{') {
        inner.split(',').forEach((piece) => {
          const bits = piece.split(':');
          const name = bits[bits.length - 1].trim().match(/^([\w$]+)/);
          if (name) names.add(name[1]);
        });
      } else {
        inner.split(',').forEach((piece) => {
          const name = piece.trim().match(/^([\w$]+)/);
          if (name) names.add(name[1]);
        });
      }
      continue;
    }
    const id = s.slice(i).match(/^([\w$]+)/);
    if (!id) break;
    names.add(id[1]);
    i += id[1].length;
    let depth = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === '(' || ch === '{' || ch === '[') depth += 1;
      else if (ch === ')' || ch === '}' || ch === ']') depth -= 1;
      else if (ch === ',' && depth === 0) {
        i += 1;
        break;
      } else if (ch === ';' && depth === 0) return;
      i += 1;
    }
  }
}

const exportCache = new Map();

function resolveSpecifier(fromFile, spec) {
  const clean = spec.split(/[?#]/)[0];
  return path.resolve(path.dirname(fromFile), clean);
}

function collectExports(filePath, stack = new Set()) {
  const key = path.normalize(filePath);
  if (exportCache.has(key)) return exportCache.get(key);
  const empty = { names: new Set(), open: false };
  if (stack.has(key) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    exportCache.set(key, empty);
    return empty;
  }
  stack.add(key);
  const names = new Set();
  let open = false;
  const src = stripComments(readFileSync(filePath, 'utf8'));

  for (const match of src.matchAll(EXPORT_FN)) names.add(match[1]);
  for (const match of src.matchAll(EXPORT_CLASS)) names.add(match[1]);
  for (const match of src.matchAll(EXPORT_STAR_AS)) names.add(match[1]);

  for (const match of src.matchAll(EXPORT_DECL)) {
    const start = match.index + match[0].length;
    const rest = src.slice(start);
    const end = rest.search(/;|\nexport\b|\n(?:async\s+)?function\b|\nclass\b/);
    addBindingNames(end === -1 ? rest : rest.slice(0, end), names);
  }

  const withoutStarAs = src.replace(EXPORT_STAR_AS, ' ');
  for (const match of withoutStarAs.matchAll(EXPORT_LIST)) {
    exportedNamesFromClause(match[1]).forEach((name) => names.add(name));
  }
  for (const match of withoutStarAs.matchAll(EXPORT_STAR)) {
    const spec = match[1];
    if (!isRelative(spec)) {
      open = true;
      continue;
    }
    const target = resolveSpecifier(filePath, spec);
    const inner = collectExports(target, stack);
    inner.names.forEach((name) => names.add(name));
    if (inner.open) open = true;
  }

  const result = { names, open };
  exportCache.set(key, result);
  stack.delete(key);
  return result;
}

function scan() {
  const files = [];
  for (const dir of SCAN_DIRS) {
    const full = path.join(root, dir);
    if (existsSync(full)) walk(full, files);
  }

  const missing = [];
  let checked = 0;

  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const source = stripComments(scriptSource(file, readFileSync(file, 'utf8')));
    for (const match of source.matchAll(NAMED_IMPORT)) {
      const spec = match[2].split(/[?#]/)[0];
      if (!isRelative(spec)) continue;
      const names = importedNames(match[1]);
      if (!names.length) continue;
      checked += 1;
      const target = resolveSpecifier(file, spec);
      const exported = collectExports(target);
      if (exported.open) continue;
      const absent = names.filter((name) => !exported.names.has(name));
      if (absent.length) {
        missing.push(`${rel} -> ${spec} : ${absent.join(', ')}`);
      }
    }
  }
  return { files: files.length, checked, missing };
}

describe('import nominati relativi (core/, modules/, shared/)', () => {
  const result = scan();

  it('scansiona un numero plausibile di file e import nominati', () => {
    expect(result.files).toBeGreaterThan(200);
    expect(result.checked).toBeGreaterThan(50);
  });

  it('ogni nome importato è esportato dal file di destinazione', () => {
    expect(
      result.missing,
      `Import nominati assenti (il modulo ES non parte):\n  ${result.missing.join('\n  ')}`
    ).toEqual([]);
  });
});
