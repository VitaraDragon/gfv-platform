/**
 * @vitest-environment node
 * Gate accesso: niente tenantData.modules grezzo nelle aree campo/vigneto/terreni.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

/** Eccezioni motivate (prezzo, resolver stesso, commenti). */
const ALLOWLIST = [
  /module-access-resolver\.js$/,
  /getPaidModuleIds/,
];

const RAW_PATTERNS = [
  /tenantData\s*\??\.\s*modules/,
  /tenant\s*\??\.\s*modules/,
  /\btd\s*\??\.\s*modules/,
  /\.data\(\)\s*\.modules/,
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(js|html)$/.test(name)) out.push(p);
  }
  return out;
}

function cartelleViewsModuli() {
  const root = join(ROOT, 'modules');
  const out = [];
  for (const name of readdirSync(root)) {
    const views = join(root, name, 'views');
    try {
      if (statSync(views).isDirectory()) out.push(views);
    } catch (e) { /* modulo senza views */ }
  }
  return out;
}

function lineeGrezze(filePath) {
  const src = readFileSync(filePath, 'utf8');
  const lines = src.split(/\r?\n/);
  const hits = [];
  lines.forEach((line, i) => {
    if (ALLOWLIST.some((re) => re.test(line) || re.test(filePath))) return;
    if (/getPaidModuleIds|prezzo|price|billing|Stripe/i.test(line)) return;
    if (/console\.(log|info|warn|debug)/.test(line)) return;
    if (RAW_PATTERNS.some((re) => re.test(line))) {
      // ok se è solo dentro resolveEffectiveModules / commento esplicito paid
      if (/resolveEffectiveModules|hasModuleAccessFromTenant|getPaidModuleIds|\/\/.*modules/.test(line)) {
        return;
      }
      hits.push({ line: i + 1, text: line.trim() });
    }
  });
  return hits;
}

describe('nessun gate grezzo su tenant.modules (#23/#31)', () => {
  const dirs = [
    join(ROOT, 'core', 'mobile'),
    join(ROOT, 'core', 'js'),
    join(ROOT, 'modules', 'vigneto', 'js'),
    ...cartelleViewsModuli(),
  ];
  const files = [
    join(ROOT, 'core', 'terreni-standalone.html'),
    ...dirs.flatMap((d) => walk(d)),
  ];

  it('file sotto core/mobile, core/js, views dei moduli, vigneto/js e terreni-standalone non decidono accesso con .modules grezzo', () => {
    const violazioni = [];
    for (const f of files) {
      const hits = lineeGrezze(f);
      for (const h of hits) {
        violazioni.push(`${relative(ROOT, f)}:${h.line}: ${h.text}`);
      }
    }
    expect(violazioni, violazioni.join('\n')).toEqual([]);
  });
});
