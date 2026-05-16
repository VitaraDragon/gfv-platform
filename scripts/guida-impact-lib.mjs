/**
 * Logica condivisa: mappa path → moduli GUIDA + checklist path documentazione.
 * Usato da guida-impact.mjs e guida-suggest-prompt.mjs.
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @typedef {{ prefix?: string, includes?: string, modules: string[], label?: string }} Rule */

export const DEFAULT_MAP_PATH = path.join(__dirname, 'guida-code-map.json');
export const REPO_ROOT = path.resolve(__dirname, '..');

export function normalizeRel(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .trim();
}

/**
 * @param {string} file
 * @param {Rule[]} rulesSorted
 * @param {string[]} validModules
 */
export function modulesForPath(file, rulesSorted, validModules) {
  const f = normalizeRel(file);
  const hits = new Set();

  if (f.startsWith('docs-sviluppo/GUIDA/') || f.startsWith('core/GUIDA/')) {
    const rest = f.replace(/^docs-sviluppo\/GUIDA\//, '').replace(/^core\/GUIDA\//, '');
    const mod = rest.split('/')[0];
    if (validModules.includes(mod)) hits.add(mod);
  }

  for (const r of rulesSorted) {
    if (r.includes && f.includes(r.includes)) {
      r.modules.forEach((m) => hits.add(m));
    }
  }
  for (const r of rulesSorted) {
    if (r.prefix && f.startsWith(r.prefix)) {
      r.modules.forEach((m) => hits.add(m));
    }
  }

  if (hits.size === 0) {
    if (f.startsWith('core/') || f.startsWith('landing/')) hits.add('CORE');
    else if (f.startsWith('modules/')) hits.add('INTERSEZIONI');
  }

  return [...hits];
}

export function sortRules(rules) {
  const withPrefix = rules.filter((r) => r.prefix);
  const prefixSorted = [...withPrefix].sort((a, b) => (b.prefix || '').length - (a.prefix || '').length);
  const noPrefix = rules.filter((r) => !r.prefix);
  return [...prefixSorted, ...noPrefix];
}

export function defaultBase(cwd = REPO_ROOT) {
  for (const ref of ['origin/main', 'main']) {
    try {
      execSync(`git rev-parse --verify ${ref}`, { cwd, stdio: 'ignore' });
      return ref;
    } catch {
      /* continue */
    }
  }
  return 'HEAD~1';
}

export function gitNameOnly(base, head, cwd = REPO_ROOT) {
  const cmd = `git diff --name-only ${base} ${head}`;
  const out = execSync(cmd, { cwd, encoding: 'utf8' });
  return out
    .split(/\r?\n/)
    .map((l) => normalizeRel(l))
    .filter(Boolean);
}

export function orderModules(mods, order) {
  const set = new Set(mods);
  const out = [];
  for (const m of order) {
    if (set.has(m)) out.push(m);
  }
  for (const m of mods) {
    if (!out.includes(m)) out.push(m);
  }
  return out;
}

/** Righe checklist (testo) per report markdown */
export function checklistForModule(mod) {
  const base = `docs-sviluppo/GUIDA/${mod}`;
  const mirror = `core/GUIDA/${mod}`;
  if (mod === 'MANODOPERA') {
    return [
      `${base}/utente/guida.md`,
      `${base}/utente/guida-sintesi.md`,
      `${base}/utente/guida-manager.md`,
      `${base}/utente/guida-caposquadra.md`,
      `${base}/utente/guida-operaio.md`,
      `${base}/tony/guida-tecnica.md`,
      `(mirror) ${mirror}/… stessi path`
    ];
  }
  if (mod === 'INTERSEZIONI') {
    return [`${base}/tony/intersezioni.md`, `(mirror) ${mirror}/tony/intersezioni.md`];
  }
  return [
    `${base}/utente/guida.md`,
    `${base}/utente/guida-sintesi.md`,
    `${base}/tony/guida-tecnica.md`,
    `(mirror) ${mirror}/… stessi path`
  ];
}

/**
 * Path concreti sotto docs-sviluppo/GUIDA da proporre in modifica (no righe descrittive).
 * @param {string} mod
 * @returns {string[]}
 */
export function docPathsToTouchForModule(mod) {
  const b = `docs-sviluppo/GUIDA/${mod}`;
  if (mod === 'MANODOPERA') {
    return [
      `${b}/utente/guida.md`,
      `${b}/utente/guida-sintesi.md`,
      `${b}/utente/guida-manager.md`,
      `${b}/utente/guida-caposquadra.md`,
      `${b}/utente/guida-operaio.md`,
      `${b}/tony/guida-tecnica.md`
    ];
  }
  if (mod === 'INTERSEZIONI') {
    return [`${b}/tony/intersezioni.md`];
  }
  return [`${b}/utente/guida.md`, `${b}/utente/guida-sintesi.md`, `${b}/tony/guida-tecnica.md`];
}

/** Mirror sotto core/GUIDA per ogni path docs-sviluppo */
export function mirrorPath(docPath) {
  return docPath.replace(/^docs-sviluppo\/GUIDA\//, 'core/GUIDA/');
}

/**
 * @param {string} mapPath
 * @returns {{ order: string[], rules: Rule[] }}
 */
export function loadGuidaMap(mapPath = DEFAULT_MAP_PATH) {
  const raw = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  return {
    order: raw.modulesOrder || [],
    rules: sortRules(raw.rules || [])
  };
}

/**
 * @param {string[]} files
 * @param {{ order: string[], rules: Rule[] }} map
 */
export function computeImpact(files, map) {
  const byModule = new Map();
  const unmatched = [];
  for (const f of files) {
    const mods = modulesForPath(f, map.rules, map.order);
    if (mods.length === 0) unmatched.push(f);
    for (const m of mods) {
      if (!byModule.has(m)) byModule.set(m, []);
      byModule.get(m).push(f);
    }
  }
  const allMods = orderModules([...byModule.keys()], map.order);
  return { files, byModule, allMods, unmatched };
}

export function gitUnifiedDiff(base, head, paths, cwd = REPO_ROOT) {
  if (!paths.length) return '';
  const r = spawnSync('git', ['diff', base, head, '--', ...paths], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });
  if (r.error) return `/* errore git diff: ${r.error.message} */\n`;
  return (r.stdout || '') + (r.stderr && !r.stdout ? r.stderr : '');
}
