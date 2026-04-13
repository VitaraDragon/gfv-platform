/**
 * Genera core/config/tony-routes.json scandendo core/ e modules/ per *-standalone.html.
 * Esegui: npm run generate:tony-routes
 * Tony usa questo file (se caricato dal widget) per scoprire le rotte disponibili (supporto evolutivo).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CORE = path.join(ROOT, 'core');
const MODULES = path.join(ROOT, 'modules');
const OUT_FILE = path.join(ROOT, 'core', 'config', 'tony-routes.json');

/** Da nome file a target e label (es. vendemmia-standalone.html -> vendemmia, Vendemmia) */
function fileToTargetAndLabel(relPath, moduleName) {
  const base = path.basename(relPath, '-standalone.html');
  const target = base
    .replace(/([A-Z])/g, (m) => m.toLowerCase())
    .replace(/^vigneto-/, '')
    .replace(/^frutteto-/, '')
    .replace(/-/g, ' ');
  const label = base
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return { target: target || base, label };
}

function scanDir(dir, prefix = '') {
  const entries = [];
  if (!fs.existsSync(dir)) return entries;
  const names = fs.readdirSync(dir);
  for (const name of names) {
    const full = path.join(dir, name);
    const rel = (prefix ? prefix + '/' : '') + name;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      entries.push(...scanDir(full, rel));
    } else if (name.endsWith('-standalone.html')) {
      entries.push(rel);
    }
  }
  return entries;
}

function main() {
  const routes = [];

  // Core (esclusi auth che non hanno Tony)
  const coreFiles = scanDir(CORE).filter(
    (f) =>
      !f.startsWith('auth/') ||
      f === 'auth/login-standalone.html' ||
      f === 'auth/registrazione-standalone.html' ||
      f === 'auth/reset-password-standalone.html' ||
      f === 'auth/registrazione-invito-standalone.html'
  );
  for (const f of coreFiles) {
    const rel = f.replace(/\\/g, '/');
    const fullPath = rel.startsWith('core/') ? rel : 'core/' + rel;
    const { target, label } = fileToTargetAndLabel(rel, 'core');
    let targetKey = target.replace(/\s+/g, ' ');
    if (rel.includes('admin/')) {
      if (rel.includes('gestione-lavori')) targetKey = 'lavori';
      else if (rel.includes('lavori-caposquadra')) targetKey = 'lavori caposquadra';
      else if (rel.includes('validazione-ore')) targetKey = 'validazione ore';
      else if (rel.includes('statistiche-manodopera')) targetKey = 'statistiche manodopera';
      else if (rel.includes('gestisci-utenti')) targetKey = 'gestisci utenti';
      else if (rel.includes('gestione-squadre')) targetKey = 'gestione squadre';
      else if (rel.includes('gestione-operai')) targetKey = 'gestione operai';
      else if (rel.includes('compensi-operai')) targetKey = 'compensi operai';
      else if (rel.includes('gestione-macchine')) targetKey = 'gestione macchine';
      else if (rel.includes('gestione-guasti')) targetKey = 'gestione guasti admin';
      else if (rel.includes('segnalazione-guasti')) targetKey = 'segnalazione guasti';
      else if (rel.includes('amministrazione')) targetKey = 'amministrazione';
      else if (rel.includes('abbonamento')) targetKey = 'abbonamento';
      else if (rel.includes('impostazioni')) targetKey = 'impostazioni';
      else if (rel.includes('report')) targetKey = 'report';
    } else {
      if (rel.includes('dashboard')) targetKey = 'dashboard';
      else if (rel.includes('terreni')) targetKey = 'terreni';
      else if (rel.includes('attivita')) targetKey = 'attivita';
      else if (rel.includes('segnatura-ore')) targetKey = 'segnatura ore';
      else if (rel.includes('statistiche') && !rel.includes('admin')) targetKey = 'statistiche';
    }
    routes.push({
      target: targetKey,
      path: fullPath,
      label: label,
      module: 'core',
    });
  }

  // Modules
  if (fs.existsSync(MODULES)) {
    const modDirs = fs.readdirSync(MODULES);
    for (const mod of modDirs) {
      const modPath = path.join(MODULES, mod);
      if (!fs.statSync(modPath).isDirectory()) continue;
      const viewsPath = path.join(modPath, 'views');
      if (!fs.existsSync(viewsPath)) continue;
      const files = scanDir(viewsPath).map((f) => path.join('modules', mod, 'views', f).replace(/\\/g, '/'));
      for (const f of files) {
        const rel = f.replace('modules/' + mod + '/views/', '');
        const fullPath = f;
        const { target, label } = fileToTargetAndLabel(rel, mod);
        let targetKey = target.replace(/\s+/g, ' ');
        if (mod === 'vigneto') {
          if (rel.includes('vigneto-dashboard')) targetKey = 'vigneto';
          else if (rel.includes('vigneti')) targetKey = 'vigneti';
          else if (rel.includes('vendemmia')) targetKey = 'vendemmia';
          else if (rel.includes('potatura')) targetKey = 'potatura vigneto';
          else if (rel.includes('concimazioni')) targetKey = 'concimazioni vigneto';
          else if (rel.includes('trattamenti')) targetKey = 'trattamenti vigneto';
          else if (rel.includes('vigneto-statistiche')) targetKey = 'statistiche vigneto';
          else if (rel.includes('calcolo-materiali')) targetKey = 'calcolo materiali';
          else if (rel.includes('pianifica-impianto')) targetKey = 'pianificazione impianto';
        } else if (mod === 'frutteto') {
          if (rel.includes('frutteto-dashboard')) targetKey = 'frutteto';
          else if (rel.includes('frutteti')) targetKey = 'frutteti';
          else if (rel.includes('frutteto-statistiche')) targetKey = 'statistiche frutteto';
          else if (rel.includes('raccolta-frutta')) targetKey = 'raccolta frutta';
          else if (rel.includes('potatura')) targetKey = 'potatura frutteto';
          else if (rel.includes('concimazioni')) targetKey = 'concimazioni frutteto';
          else if (rel.includes('trattamenti')) targetKey = 'trattamenti frutteto';
        } else if (mod === 'magazzino') {
          if (rel.includes('magazzino-home')) targetKey = 'magazzino';
          else if (rel.includes('prodotti')) targetKey = 'prodotti';
          else if (rel.includes('movimenti')) targetKey = 'movimenti';
        } else if (mod === 'conto-terzi') {
          if (rel.includes('conto-terzi-home')) targetKey = 'conto terzi';
          else if (rel.includes('clienti')) targetKey = 'clienti';
          else if (rel.includes('preventivi')) targetKey = 'preventivi';
          else if (rel.includes('tariffe')) targetKey = 'tariffe';
          else if (rel.includes('terreni-clienti')) targetKey = 'terreni clienti';
          else if (rel.includes('mappa-clienti')) targetKey = 'mappa clienti';
          else if (rel.includes('nuovo-preventivo')) targetKey = 'nuovo preventivo';
          else if (rel.includes('accetta-preventivo')) targetKey = 'accetta preventivo';
        } else if (mod === 'report') {
          if (rel.includes('report-dashboard')) targetKey = 'report';
          else if (rel.includes('report-terreni')) targetKey = 'report terreni';
          else if (rel.includes('report-standalone')) targetKey = 'report vigneto';
          else targetKey = 'report';
        } else if (mod === 'macchine') {
          if (rel.includes('macchine-dashboard')) targetKey = 'macchine';
          else if (rel.includes('trattori-list')) targetKey = 'elenco trattori';
          else if (rel.includes('attrezzi-list')) targetKey = 'elenco attrezzi';
          else if (rel.includes('flotta-list')) targetKey = 'elenco flotta';
          else if (rel.includes('scadenze-list')) targetKey = 'scadenze';
          else if (rel.includes('guasti-list')) targetKey = 'guasti';
        }
        routes.push({
          target: targetKey,
          path: fullPath,
          label: label,
          module: mod,
        });
      }
    }
  }

  const configDir = path.dirname(OUT_FILE);
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify({ routes, generatedAt: new Date().toISOString() }, null, 2), 'utf8');
  console.log('[generate-tony-routes] Scritte', routes.length, 'rotte in', OUT_FILE);
}

main();
