/**
 * Build di dist-app: solo file git tracciati nell'allow-list dell'app.
 * Uso: node scripts/build-app-hosting.mjs
 *      node scripts/build-app-hosting.mjs --check
 *
 * --check non ricopia: valida dist-app già generata.
 * La build esegue lo stesso controllo e termina con errore se fallisce.
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRel = 'dist-app';
const distAbs = path.join(root, distRel);
const ORIGIN = 'https://gfv-platform-app.web.app';

const ROOT_FILES = new Set(['service-worker.js', 'sw-strategy.js', 'manifest.json']);

/**
 * Due riferimenti già rotti anche su Pages. Non sistemarli: il check li ammette.
 * @type {Set<string>}
 */
const KNOWN_BROKEN = new Set([
  'core/config/tony-module-recommendations.js -> ./tony-module-recommendations.json',
  'core/dashboard-standalone.html -> ../auth/registrazione-standalone.html',
]);

const REQUIRED = [
  'index.html',
  '404.html',
  'service-worker.js',
  'sw-strategy.js',
  'manifest.json',
  'core/auth/login-standalone.html',
  'core/config/firebase-config.js',
  'documentazione-utente/index.html',
];

const INDEX_HTML = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>GFV</title>
<meta http-equiv="refresh" content="0;url=core/auth/login-standalone.html">
<script>
location.replace('core/auth/login-standalone.html' + location.search + location.hash);
</script>
</head>
<body>
<p><a href="core/auth/login-standalone.html">Vai al login</a></p>
</body>
</html>
`;

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>Pagina non trovata</title>
</head>
<body>
<p>Pagina non trovata.</p>
<p><a href="/core/auth/login-standalone.html">Vai al login</a></p>
</body>
</html>
`;

/** @param {string} rel */
export function isAllowedGuideMd(rel) {
  if (rel === 'core/GUIDA/README.md' || rel === 'core/guida-app/README.md') return false;
  if (/(^|\/)README\.md$/i.test(rel)) return false;
  if (/^core\/GUIDA\/(?:[^/]+\/)+utente\/[^/]+\.md$/.test(rel)) return true;
  if (/^core\/GUIDA\/(?:[^/]+\/)+tony\/[^/]+\.md$/.test(rel)) return true;
  if (/^core\/guida-app\/moduli\/[^/]+\.md$/.test(rel)) return true;
  return false;
}

/** @param {string} rel */
export function isIncluded(rel) {
  const norm = rel.replace(/\\/g, '/');
  if (ROOT_FILES.has(norm)) return true;
  if (norm.startsWith('documentazione-utente/')) {
    return /^documentazione-utente\/[^/]+\.html$/.test(norm);
  }
  if (norm.startsWith('icons/')) return norm !== 'icons/README.txt';
  if (norm.startsWith('shared/') || norm.startsWith('vendor/')) {
    return !norm.endsWith('.md');
  }
  if (norm.startsWith('core/') || norm.startsWith('modules/')) return !isExcludedAppFile(norm);
  return false;
}

/** @param {string} rel */
function isExcludedAppFile(rel) {
  if (rel.startsWith('core/dev/')) return true;
  if (rel.endsWith('-test-bootstrap.html')) return true;
  if (rel === 'core/auth/login.html' || rel === 'core/dashboard.html' || rel === 'core/init.js') return true;
  if (rel === 'core/admin/fix-utente-mancante.html') return true;
  if (rel.endsWith('.example.js')) return true;
  if (rel === 'core/admin/template-email-invito-semplice.html') return true;
  if (/^modules\/conto-terzi\/template-email-preventivo.*\.html$/.test(rel)) return true;
  if (rel.endsWith('.md') && !isAllowedGuideMd(rel)) return true;
  return false;
}

function trackedFiles() {
  const buf = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
  });
  return buf.toString('utf8').split('\0').filter(Boolean).map((rel) => rel.replace(/\\/g, '/'));
}

function build() {
  rmSync(distAbs, { recursive: true, force: true });
  mkdirSync(distAbs, { recursive: true });
  let copied = 0;
  for (const rel of trackedFiles()) {
    if (!isIncluded(rel)) continue;
    const src = path.join(root, rel);
    if (!existsSync(src) || !statSync(src).isFile()) continue;
    const dest = path.join(distAbs, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    cpSync(src, dest);
    copied += 1;
  }
  writeFileSync(path.join(distAbs, 'index.html'), INDEX_HTML, 'utf8');
  writeFileSync(path.join(distAbs, '404.html'), NOT_FOUND_HTML, 'utf8');
  return copied;
}

/** @param {string} dir @param {string[]} out @param {string} prefix */
function walkRel(dir, out, prefix) {
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    const st = statSync(abs);
    if (st.isDirectory()) walkRel(abs, out, rel);
    else if (st.isFile()) out.push(rel.replace(/\\/g, '/'));
  }
  return out;
}

/** @param {string} rel */
function isForbiddenOutput(rel) {
  const prefixes = [
    'docs-sviluppo/',
    'tests/',
    'functions/',
    '.github/',
    'node_modules/',
    'landing/',
    'simulator/',
    'mobile-config/',
    'scripts/',
    '.cursor/',
    'core/dev/',
  ];
  if (prefixes.some((p) => rel === p.slice(0, -1) || rel.startsWith(p))) return `percorso vietato ${rel}`;
  const base = path.posix.basename(rel);
  if (rel.endsWith('.example.js')) return `example.js ${rel}`;
  if (rel.endsWith('-test-bootstrap.html')) return `bootstrap di test ${rel}`;
  if (rel === 'core/auth/login.html' || rel === 'core/dashboard.html' || rel === 'core/init.js') {
    return `pagina legacy ${rel}`;
  }
  if (base === 'fix-utente-mancante.html') return `fix-utente-mancante ${rel}`;
  if (rel === 'core/admin/template-email-invito-semplice.html') return `template EmailJS ${rel}`;
  if (/^modules\/conto-terzi\/template-email-preventivo.*\.html$/.test(rel)) return `template EmailJS ${rel}`;
  if (rel === 'icons/README.txt') return `README icone ${rel}`;
  if (rel === 'core/GUIDA/README.md' || rel === 'core/guida-app/README.md') return `README guida ${rel}`;
  if (/(^|\/)README\.md$/i.test(rel) && rel.startsWith('core/GUIDA/')) return `README guida ${rel}`;
  if (rel.endsWith('.md') && !isAllowedGuideMd(rel)) return `markdown fuori allow-list ${rel}`;
  if (['package.json', 'cors.json', 'firestore.rules', 'firestore.indexes.json', 'storage.rules',
    'icon-generator.html', 'tony-code-per-gemini.html', 'temp_clienti_structure.txt', 'start-server.bat',
  ].includes(rel) || ['icon-generator.html', 'tony-code-per-gemini.html'].includes(base)) {
    return `file di repo escluso ${rel}`;
  }
  return '';
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

function scriptSource(src) {
  const blocks = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src))) {
    if (!/\bsrc\s*=/.test(m[1])) blocks.push(m[2]);
  }
  return blocks.join('\n');
}

/** @param {string} spec */
function skipSpecifier(spec) {
  const s = String(spec || '').trim();
  if (!s || s.startsWith('#') || s.startsWith('?')) return true;
  if (s.startsWith('//')) return true;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return true;
  return false;
}

/** @param {string} spec */
function bareSpecifier(spec) {
  return String(spec).trim().split('#')[0].split('?')[0];
}

/**
 * Risolve un riferimento come farebbe il browser sull'origine dell'app.
 * @param {string} fromRel
 * @param {string} spec
 * @returns {string} percorso relativo a dist-app, senza slash iniziale
 */
function resolveOnAppOrigin(fromRel, spec) {
  const bare = bareSpecifier(spec);
  const page = new URL(fromRel, `${ORIGIN}/`);
  const resolved = new URL(bare, page);
  if (resolved.origin !== ORIGIN) return '';
  let pathname = resolved.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    /* tieni il pathname così com'è */
  }
  return pathname.replace(/^\/+/, '');
}

/** @param {string} relPosix */
function fileExistsInDist(relPosix) {
  const rel = relPosix.replace(/\/+$/, '');
  if (!rel) return existsSync(path.join(distAbs, 'index.html'));
  const abs = path.join(distAbs, ...rel.split('/'));
  if (!existsSync(abs)) return false;
  const st = statSync(abs);
  if (st.isFile()) return true;
  if (st.isDirectory()) return existsSync(path.join(abs, 'index.html'));
  return false;
}

/** @param {string} spec */
function isDynamicSpecifier(spec) {
  return /[${+(]/.test(spec) || /\s/.test(spec) || spec.includes("'") || spec.includes('"');
}

/**
 * Percorso di file, non un modulo npm (`polygon-clipping`).
 * @param {string} spec
 */
function looksLikePath(spec) {
  const bare = bareSpecifier(spec);
  if (!bare || skipSpecifier(bare) || isDynamicSpecifier(bare)) return false;
  if (bare.startsWith('/') || bare.startsWith('./') || bare.startsWith('../') || bare.includes('/')) return true;
  return /\.[a-z0-9]{1,8}$/i.test(bare);
}

/**
 * @param {string} source
 * @returns {{ spec: string, kind: 'module' | 'document' | 'worker' }[]}
 */
function collectJsSpecifiers(source) {
  /** @type {{ spec: string, kind: 'module' | 'document' | 'worker' }[]} */
  const specs = [];
  const groups = [
    ['module', [
      /(?:^|[\s;}])(?:import|export)\s*(?:[\w*{}\s,$]*?\s*from\s*)?['"]([^'"]+)['"]/g,
      /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    ]],
    ['worker', [/\bimportScripts\(\s*['"]([^'"]+)['"]/g]],
    ['document', [
      /\bfetch\(\s*['"]([^'"]+)['"]/g,
      /\.register\(\s*['"]([^'"]+)['"]/g,
      /\.(?:src|href)\s*=\s*['"]([^'"]+)['"]/g,
    ]],
  ];
  for (const [kind, patterns] of groups) {
    for (const re of patterns) {
      for (const m of source.matchAll(re)) specs.push({ spec: m[1], kind });
    }
  }
  return specs;
}

/** @param {string} html */
function collectHtmlAttributes(html) {
  const specs = [];
  const re = /\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  for (const m of html.matchAll(re)) specs.push(m[1] ?? m[2] ?? '');
  return specs;
}

function readText(rel) {
  return readFileSync(path.join(distAbs, rel), 'utf8');
}

function preparedSource(rel) {
  const raw = readText(rel);
  if (!rel.endsWith('.html')) return { html: '', js: stripComments(raw), raw };
  const noComments = raw.replace(/<!--[\s\S]*?-->/g, ' ');
  return { html: noComments, js: stripComments(scriptSource(noComments)), raw: noComments };
}

/** Pagine HTML che caricano un modulo, anche attraverso altri import. */
function hostPagesOf(jsRel, importers) {
  const seen = new Set();
  const pages = [];
  const stack = [jsRel];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || seen.has(cur)) continue;
    seen.add(cur);
    for (const importer of importers.get(cur) || []) {
      if (importer.endsWith('.html')) pages.push(importer);
      else stack.push(importer);
    }
  }
  return pages;
}

function checkReferences(files) {
  /** @type {string[]} */
  const missing = [];
  const scanExt = new Set(['.html', '.js', '.mjs', '.cjs']);
  /** @type {Map<string, { html: string, js: string }>} */
  const prepared = new Map();
  for (const rel of files) {
    if (!scanExt.has(path.posix.extname(rel))) continue;
    const src = preparedSource(rel);
    prepared.set(rel, src);
  }

  /** @type {Map<string, Set<string>>} */
  const importers = new Map();
  const link = (target, from) => {
    if (!target || target === from) return;
    if (!importers.has(target)) importers.set(target, new Set());
    importers.get(target).add(from);
  };

  for (const [rel, src] of prepared) {
    const moduleSpecs = collectJsSpecifiers(src.js).filter((item) => item.kind === 'module' && looksLikePath(item.spec));
    for (const item of moduleSpecs) {
      try {
        link(resolveOnAppOrigin(rel, bareSpecifier(item.spec)), rel);
      } catch {
        /* il controllo sotto segnala l'URL */
      }
    }
    if (rel.endsWith('.html')) {
      for (const spec of collectHtmlAttributes(src.html)) {
        if (!looksLikePath(spec)) continue;
        const bare = bareSpecifier(spec);
        if (!/\.(?:js|mjs|cjs)$/i.test(bare)) continue;
        try {
          link(resolveOnAppOrigin(rel, bare), rel);
        } catch {
          /* idem */
        }
      }
    }
  }

  const consider = (rel, spec, baseRel) => {
    if (!looksLikePath(spec)) return;
    const bare = bareSpecifier(spec);
    const key = `${rel} -> ${bare}`;
    if (KNOWN_BROKEN.has(key)) return;
    let target = '';
    try {
      target = resolveOnAppOrigin(baseRel, bare);
    } catch {
      missing.push(`${key} (URL non valido)`);
      return;
    }
    if (!fileExistsInDist(target)) missing.push(`${key} → ${target || '(fuori origine)'}`);
  };

  for (const [rel, src] of prepared) {
    if (rel.endsWith('.html')) {
      for (const spec of collectHtmlAttributes(src.html)) consider(rel, spec, rel);
      for (const item of collectJsSpecifiers(src.js)) consider(rel, item.spec, rel);
      continue;
    }
    for (const item of collectJsSpecifiers(src.js)) {
      if (item.kind === 'document') {
        const pages = hostPagesOf(rel, importers);
        if (!pages.length) {
          consider(rel, item.spec, rel);
          continue;
        }
        if (!looksLikePath(item.spec)) continue;
        const bare = bareSpecifier(item.spec);
        const key = `${rel} -> ${bare}`;
        if (KNOWN_BROKEN.has(key)) continue;
        const bad = [];
        for (const page of pages) {
          let target = '';
          try {
            target = resolveOnAppOrigin(page, bare);
          } catch {
            bad.push(`${page} (URL non valido)`);
            continue;
          }
          if (!fileExistsInDist(target)) bad.push(`${page} → ${target || '(fuori origine)'}`);
        }
        if (bad.length) missing.push(`${key} [${bad.join('; ')}]`);
        continue;
      }
      consider(rel, item.spec, rel);
    }
  }
  return missing;
}

function checkGuides() {
  /** @type {string[]} */
  const problems = [];
  const dir = path.join(distAbs, 'documentazione-utente');
  if (!existsSync(dir)) return ['manca documentazione-utente/'];
  for (const name of readdirSync(dir)) {
    if (!name.startsWith('guida-') || !name.endsWith('-utente.html')) continue;
    const html = readFileSync(path.join(dir, name), 'utf8');
    const first = html.match(/['"](\.\.\/core\/GUIDA\/[^'"]+)['"]/);
    if (!first) {
      problems.push(`${name}: manca il candidato ../core/GUIDA/`);
      continue;
    }
    const spec = first[1];
    if (spec.endsWith('/')) {
      const names = [...html.matchAll(/data-file="([^"]+\.md)"/g)].map((m) => m[1]);
      const list = names.length ? names : ['guida.md'];
      for (const fileName of list) {
        const rel = path.posix.normalize(path.posix.join('documentazione-utente', spec, fileName));
        if (!fileExistsInDist(rel)) problems.push(`guida senza markdown ${rel}`);
      }
    } else {
      const rel = path.posix.normalize(path.posix.join('documentazione-utente', spec));
      if (!fileExistsInDist(rel)) problems.push(`guida senza markdown ${rel}`);
    }
  }
  return problems;
}

function checkManifest(files) {
  /** @type {string[]} */
  const problems = [];
  if (!files.includes('manifest.json')) return problems;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path.join(distAbs, 'manifest.json'), 'utf8'));
  } catch {
    return ['manifest.json non è JSON valido'];
  }
  const specs = [];
  if (typeof manifest.start_url === 'string') specs.push(manifest.start_url);
  for (const icon of manifest.icons || []) {
    if (icon && typeof icon.src === 'string') specs.push(icon.src);
  }
  for (const spec of specs) {
    if (skipSpecifier(spec)) continue;
    const target = resolveOnAppOrigin('manifest.json', bareSpecifier(spec));
    if (!fileExistsInDist(target)) problems.push(`manifest.json -> ${bareSpecifier(spec)}`);
  }
  return problems;
}

export function checkDistApp() {
  if (!existsSync(distAbs)) {
    throw new Error('dist-app assente: esegui npm run build:app');
  }
  const files = walkRel(distAbs, [], '');
  /** @type {string[]} */
  const problems = [];
  for (const rel of REQUIRED) {
    if (!files.includes(rel)) problems.push(`manca il file obbligatorio ${rel}`);
  }
  const index = files.includes('index.html') ? readFileSync(path.join(distAbs, 'index.html'), 'utf8') : '';
  if (index && (!index.includes('location.search') || !index.includes('location.hash'))) {
    problems.push('index.html non conserva search e hash');
  }
  if (index && !index.includes('http-equiv="refresh"')) problems.push('index.html senza meta di riserva');
  const notFound = files.includes('404.html') ? readFileSync(path.join(distAbs, '404.html'), 'utf8') : '';
  if (notFound && !notFound.includes('core/auth/login-standalone.html')) {
    problems.push('404.html senza link al login');
  }
  let guidaMd = 0;
  let moduliMd = 0;
  for (const rel of files) {
    const why = isForbiddenOutput(rel);
    if (why) problems.push(why);
    if (isAllowedGuideMd(rel) && rel.startsWith('core/GUIDA/')) guidaMd += 1;
    if (isAllowedGuideMd(rel) && rel.startsWith('core/guida-app/moduli/')) moduliMd += 1;
  }
  if (guidaMd < 1) problems.push('manca almeno un .md sotto core/GUIDA/');
  if (moduliMd < 1) problems.push('manca almeno un .md sotto core/guida-app/moduli/');
  problems.push(...checkGuides());
  problems.push(...checkManifest(files));
  problems.push(...checkReferences(files));
  return { files: files.length, problems };
}

function report(problems) {
  const cap = 80;
  const shown = problems.slice(0, cap);
  const extra = problems.length - shown.length;
  const lines = shown.map((p) => `- ${p}`);
  if (extra > 0) lines.push(`- … e altri ${extra}`);
  return lines.join('\n');
}

function avviatoDaCli() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (avviatoDaCli()) {
  const checkOnly = process.argv.includes('--check');
  if (!checkOnly) {
    const copied = build();
    console.log(`build:app: ${copied} file tracciati copiati in ${distRel}`);
  }
  const { files, problems } = checkDistApp();
  if (problems.length) {
    console.error(`build:app: check fallito (${problems.length})\n${report(problems)}`);
    process.exit(1);
  }
  console.log(`build:app: check ok (${files} file in ${distRel})`);
}
