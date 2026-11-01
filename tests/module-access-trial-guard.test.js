/**
 * Guardia: niente letture grezze di tenant.modules per gate/UI,
 * salvo eccezioni note (scritture fatturazione, punti rimandati PR #323, file non toccabili).
 * @vitest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = join(process.cwd());
const SCAN_ROOTS = [join(ROOT, 'core'), join(ROOT, 'modules')];
const EXT = new Set(['.js', '.html']);

/** Stesso schema della ricerca del prompt. */
const RAW_MODULES_RE =
  /\.modules( \|\||\.includes|\.some|\.indexOf| &&|\))|Array\.isArray\([a-zA-Z]+\??\.modules\)|data\(\)\??\.modules/g;

/**
 * Eccezioni ammesse (path POSIX relativi alla root repo + numero riga 1-based).
 * Solo: giusti così come sono + 7 punti rimandati PR #323 + file esplicitamente non toccabili
 * (Tony / landing #323 / catalogo bundle / resolver stesso) che ancora matchano il pattern.
 */
const ALLOWED = [
  // --- Giusti così come sono (moduli pagati / fallback / log) ---
  {
    file: 'core/services/tenant-service.js',
    line: 49,
    reason: 'Fallback se resolveEffectiveModules non carica: resta sui soli moduli pagati.',
  },
  {
    file: 'core/services/tenant-service.js',
    line: 459,
    reason: 'Aggiunta di un modulo pagato: deve scrivere solo su tenant.modules.',
  },
  {
    file: 'core/services/tenant-service.js',
    line: 494,
    reason: 'Rimozione di un modulo pagato: deve filtrare solo tenant.modules.',
  },
  {
    file: 'modules/report/views/report-standalone.html',
    line: 494,
    reason: 'Solo console.log di debug, non decide accesso.',
  },
  {
    file: 'modules/vigneto/js/vigneto-dashboard-page.js',
    line: 83,
    reason: 'Solo console.log di debug, non decide accesso.',
  },

  // --- Da fare dopo la PR #323 (7 punti rimandati) ---
  {
    file: 'core/admin/impostazioni-standalone.html',
    line: 967,
    reason: 'Rimandato: file della PR #323 (landing).',
  },
  {
    file: 'core/admin/impostazioni-standalone.html',
    line: 1053,
    reason: 'Rimandato: file della PR #323 (landing).',
  },
  {
    file: 'core/admin/impostazioni-standalone.html',
    line: 3808,
    reason: 'Rimandato: file della PR #323 (landing).',
  },
  {
    file: 'core/admin/impostazioni-standalone.html',
    line: 3880,
    reason: 'Rimandato: file della PR #323 (landing).',
  },
  {
    file: 'core/attivita-standalone.html',
    line: 1577,
    reason: 'Rimandato: file della PR #323 (landing).',
  },
  {
    file: 'core/terreni-standalone.html',
    line: 1116,
    reason: 'Rimandato: file della PR #323 (landing).',
  },
  {
    file: 'core/terreni-test-bootstrap.html',
    line: 1105,
    reason: 'Rimandato: file della PR #323 (landing).',
  },

  // --- Non toccare in questo lavoro (Tony / landing #323 / catalogo / resolver) ---
  {
    file: 'core/dashboard-standalone.html',
    line: null,
    reason: 'File della PR #323: non toccare in questa PR.',
  },
  {
    file: 'core/js/gfv-tony-loader.js',
    line: null,
    reason: 'Tony: non toccare; usa già publishTenantForTony con moduli effettivi altrove.',
  },
  {
    file: 'core/js/tony/main.js',
    line: null,
    reason: 'Tony: non toccare in questa PR.',
  },
  {
    file: 'core/config/tony-module-gate.js',
    line: null,
    reason: 'Tony: non toccare in questa PR.',
  },
  {
    file: 'core/admin/abbonamento-standalone.html',
    line: null,
    reason: 'Catalogo bundle / UI abbonamento: non è gate tenant; logica prova non va cambiata qui.',
  },
  {
    file: 'core/config/subscription-plans.js',
    line: null,
    reason: 'Catalogo piani/bundle: campo modules del pacchetto, non del tenant.',
  },
  {
    file: 'core/utils/module-access-resolver.js',
    line: null,
    reason: 'Punto unico getPaidModuleIds / bundle catalog: deve leggere i moduli pagati grezzi.',
  },
  {
    file: 'core/js/dashboard-quick-bar.js',
    line: 697,
    reason: 'meta.modules del catalogo quick-bar, non tenant.modules.',
  },
  {
    file: 'core/js/standalone-bootstrap.js',
    line: 53,
    reason: 'Solo commento JSDoc («con .modules»), nessuna lettura runtime.',
  },
  {
    file: 'modules/vendemmia-meccanica/views/vm-home-standalone.html',
    line: 344,
    reason: 'Usa auth.modules già risolti da vm-page-auth (lista effettiva), non tenant.modules grezzo.',
  },
];

function toPosix(p) {
  return p.split(sep).join('/');
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else {
      const lower = name.toLowerCase();
      if (EXT.has(lower.slice(lower.lastIndexOf('.')))) out.push(full);
    }
  }
  return out;
}

function lineNumberAt(src, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (src.charCodeAt(i) === 10) line++;
  }
  return line;
}

function isAllowed(filePosix, line) {
  return ALLOWED.some((ex) => {
    if (ex.file !== filePosix) return false;
    if (ex.line == null) return true;
    return ex.line === line;
  });
}

describe('module-access trial guard', () => {
  it('non lascia letture grezze di modules fuori dalle eccezioni', () => {
    const files = SCAN_ROOTS.flatMap((r) => walk(r));
    const offenders = [];

    for (const abs of files) {
      const filePosix = toPosix(relative(ROOT, abs));
      const src = readFileSync(abs, 'utf8');
      RAW_MODULES_RE.lastIndex = 0;
      let m;
      while ((m = RAW_MODULES_RE.exec(src)) !== null) {
        const line = lineNumberAt(src, m.index);
        if (!isAllowed(filePosix, line)) {
          offenders.push(`${filePosix}:${line}: ${m[0]}`);
        }
      }
    }

    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
