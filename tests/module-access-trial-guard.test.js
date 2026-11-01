/**
 * Guardia: niente letture grezze di tenant.modules per gate/UI,
 * salvo eccezioni note (scritture fatturazione, punti rimandati PR #323, file non toccabili).
 * Le eccezioni usano file + pezzo di testo della riga (non il numero di riga),
 * così restano valide anche se una PR precedente sposta le righe.
 * @vitest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = join(process.cwd());
const SCAN_ROOTS = [join(ROOT, 'core'), join(ROOT, 'modules'), join(ROOT, 'functions')];
const EXT = new Set(['.js', '.html']);

/** Stesso schema della ricerca del prompt. */
const RAW_MODULES_RE =
  /\.modules( \|\||\.includes|\.some|\.indexOf| &&|\))|Array\.isArray\([a-zA-Z]+\??\.modules\)|data\(\)\??\.modules/g;

/**
 * Eccezioni ammesse.
 * - `snippet`: pezzo di testo che deve comparire sulla riga del match
 * - senza `snippet`: tutto il file è ammesso (solo Tony / functions ammessi interi)
 */
const ALLOWED = [
  // --- Giusti così come sono (moduli pagati / fallback / log) ---
  {
    file: 'core/services/tenant-service.js',
    snippet: 'Array.isArray(tenant.modules) ? tenant.modules.slice() : []',
    reason: 'Fallback se resolveEffectiveModules non carica: resta sui soli moduli pagati.',
  },
  {
    file: 'core/services/tenant-service.js',
    snippet: 'Array.isArray(tenant.modules) ? [...tenant.modules] : []',
    reason: 'Aggiunta di un modulo pagato: deve scrivere solo su tenant.modules.',
  },
  {
    file: 'core/services/tenant-service.js',
    snippet: "(tenant.modules || []).filter(m => m !== moduleName)",
    reason: 'Rimozione di un modulo pagato: deve filtrare solo tenant.modules.',
  },
  {
    file: 'modules/report/views/report-standalone.html',
    snippet: "console.log('[REPORT] tenant modules:', tenant?.modules)",
    reason: 'Solo console.log di debug, non decide accesso.',
  },
  {
    file: 'modules/vigneto/js/vigneto-dashboard-page.js',
    snippet: "console.log('[VIGNETO-DASHBOARD] Tenant modules:', tenant?.modules)",
    reason: 'Solo console.log di debug, non decide accesso.',
  },

  // --- Da fare dopo la PR #323 (7 punti rimandati) ---
  {
    file: 'core/admin/impostazioni-standalone.html',
    snippet: 'Array.isArray(tenantData?.modules) ? tenantData.modules : []',
    reason: 'Rimandato: file della PR #323 (landing).',
  },
  {
    file: 'core/admin/impostazioni-standalone.html',
    snippet: 'Array.isArray(td?.modules) ? td.modules : []',
    reason: 'Rimandato: file della PR #323 (landing).',
  },
  {
    file: 'core/admin/impostazioni-standalone.html',
    snippet: "tenantData.modules && tenantData.modules.includes('contoTerzi')",
    reason: 'Rimandato: file della PR #323 (landing).',
  },
  {
    file: 'core/admin/impostazioni-standalone.html',
    snippet: "tenantData.modules && tenantData.modules.includes('manodopera')",
    reason: 'Rimandato: file della PR #323 (landing).',
  },
  {
    file: 'core/attivita-standalone.html',
    snippet: 'availableModules = tenantData.modules || []',
    reason: 'Rimandato: file della PR #323 (landing).',
  },
  {
    file: 'core/terreni-standalone.html',
    snippet: 'Array.isArray(tenantData?.modules) ? tenantData.modules : []',
    reason: 'Rimandato: file della PR #323 (landing).',
  },
  {
    file: 'core/terreni-test-bootstrap.html',
    snippet: 'Array.isArray(tenantData?.modules) ? tenantData.modules : []',
    reason: 'Rimandato: file della PR #323 (landing).',
  },

  // --- Catalogo / UI abbonamento / resolver: singole righe ---
  {
    file: 'core/dashboard-standalone.html',
    snippet: 'hasTony(window.__gfvTenantData.modules)',
    reason: 'File della PR #323: controllo di riserva Tony; non toccare in questa PR.',
  },
  {
    file: 'core/admin/abbonamento-standalone.html',
    snippet: 'altro && Array.isArray(altro.modules)',
    reason: 'Catalogo bundle: campo modules del pacchetto, non gate tenant.',
  },
  {
    file: 'core/admin/abbonamento-standalone.html',
    snippet: 'bundle && Array.isArray(bundle.modules)',
    reason: 'Catalogo bundle: campo modules del pacchetto, non gate tenant.',
  },
  {
    file: 'core/admin/abbonamento-standalone.html',
    snippet: '!bundle.modules.includes(modId)',
    reason: 'Catalogo bundle: campo modules del pacchetto, non gate tenant.',
  },
  {
    file: 'core/admin/abbonamento-standalone.html',
    snippet: "bundle.modules.includes('report')",
    reason: 'Catalogo bundle in UI abbonamento: non è gate tenant.',
  },
  {
    file: 'core/config/subscription-plans.js',
    snippet: '!bundle || !Array.isArray(bundle.modules)',
    reason: 'Catalogo piani/bundle: campo modules del pacchetto, non del tenant.',
  },
  {
    file: 'core/config/subscription-plans.js',
    snippet: 'sumModulePrices(bundle.modules)',
    reason: 'Catalogo piani/bundle: campo modules del pacchetto, non del tenant.',
  },
  {
    file: 'core/config/subscription-plans.js',
    snippet: 'bundle.modules.includes(modId)',
    reason: 'Catalogo piani/bundle: campo modules del pacchetto, non del tenant.',
  },
  {
    file: 'core/utils/module-access-resolver.js',
    snippet: 'Array.isArray(tenant?.modules) ? [...tenant.modules] : []',
    reason: 'getPaidModuleIds: deve leggere i soli moduli pagati grezzi.',
  },
  {
    file: 'core/utils/module-access-resolver.js',
    snippet: 'bundle && Array.isArray(bundle.modules)',
    reason: 'Catalogo bundle nel resolver: modules del pacchetto, non gate grezzo tenant.',
  },

  // --- Altri match ammessi (non gate tenant) ---
  {
    file: 'core/js/dashboard-quick-bar.js',
    snippet: 'meta.modules && meta.modules.length',
    reason: 'meta.modules del catalogo quick-bar, non tenant.modules.',
  },
  {
    file: 'core/js/standalone-bootstrap.js',
    snippet: 'Dati tenant (con .modules) o null',
    reason: 'Solo commento JSDoc («con .modules»), nessuna lettura runtime.',
  },
  {
    file: 'modules/vendemmia-meccanica/views/vm-home-standalone.html',
    snippet: 'tenantHasManodopera(auth && auth.modules)',
    reason: 'Usa auth.modules già risolti da vm-page-auth (lista effettiva), non tenant.modules grezzo.',
  },

  // --- Tony: esclusione di tutto il file (ok) ---
  {
    file: 'core/js/gfv-tony-loader.js',
    reason: 'Tony: non toccare; alcuni fallback leggono ancora solo moduli pagati.',
  },
  {
    file: 'core/js/tony/main.js',
    reason: 'Tony: non toccare in questa PR.',
  },
  {
    file: 'core/config/tony-module-gate.js',
    reason: 'Tony: non toccare in questa PR.',
  },

  // --- functions/: eccezioni ammesse intere ---
  {
    file: 'functions/index.js',
    reason: 'Tony / resolveTenantSubscription: non toccare in questa PR.',
  },
  {
    file: 'functions/module-trial.js',
    reason: 'getPaidModuleIds e catalogo pacchetti: deve restare sui moduli pagati grezzi.',
  },
  {
    file: 'functions/stripe-billing.js',
    reason: 'Fatturazione: scrive/legge solo moduli pagati.',
  },
  {
    file: 'functions/registra-pieno-campo.js',
    reason: 'Conta già le prove accanto a modules pagati.',
  },
  {
    file: 'functions/tony-module-recommendations.js',
    reason: 'Elenchi dei pacchetti di configurazione, non moduli del tenant.',
  },
];

function toPosix(p) {
  return p.split(sep).join('/');
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    const rel = toPosix(relative(ROOT, full));
    // scripts Cloud Function: ammessi per intero (fuori dal perimetro gate client)
    if (rel === 'functions/scripts' || rel.startsWith('functions/scripts/')) continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else {
      const lower = name.toLowerCase();
      if (EXT.has(lower.slice(lower.lastIndexOf('.')))) out.push(full);
    }
  }
  return out;
}

function lineTextAt(src, index) {
  const lineStart = src.lastIndexOf('\n', index - 1) + 1;
  let lineEnd = src.indexOf('\n', index);
  if (lineEnd < 0) lineEnd = src.length;
  return src.slice(lineStart, lineEnd);
}

function lineNumberAt(src, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (src.charCodeAt(i) === 10) line++;
  }
  return line;
}

function isAllowed(filePosix, lineText) {
  return ALLOWED.some((ex) => {
    if (ex.file !== filePosix) return false;
    if (!ex.snippet) return true;
    return lineText.includes(ex.snippet);
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
        const lineText = lineTextAt(src, m.index);
        if (!isAllowed(filePosix, lineText)) {
          const line = lineNumberAt(src, m.index);
          offenders.push(`${filePosix}:${line}: ${m[0]}`);
        }
      }
    }

    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
