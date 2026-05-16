#!/usr/bin/env node
/**
 * Genera un file markdown con istruzioni + diff (troncato) per far aggiornare
 * le guide (utente, sintesi, Tony) e i mirror da un agente dopo approvazione umana.
 *
 * Uso:
 *   npm run guida:suggest
 *   npm run guida:suggest -- --base origin/main --head HEAD --out scripts/guida-suggest-output/prompt.md
 *   --max-chars 100000   limite caratteri per il blocco diff (default 100000)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REPO_ROOT,
  computeImpact,
  defaultBase,
  docPathsToTouchForModule,
  gitNameOnly,
  gitUnifiedDiff,
  loadGuidaMap,
  mirrorPath,
  DEFAULT_MAP_PATH
} from './guida-impact-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.join(__dirname, 'guida-suggest-output', 'prompt.md');

function parseArgs(argv) {
  const out = {
    base: null,
    head: null,
    outPath: DEFAULT_OUT,
    maxChars: 100000,
    noGit: false,
    help: false
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') out.base = argv[++i];
    else if (a === '--head') out.head = argv[++i];
    else if (a === '--out') out.outPath = path.resolve(argv[++i]);
    else if (a === '--max-chars') out.maxChars = Math.max(5000, parseInt(argv[++i], 10) || 100000);
    else if (a === '--no-git') out.noGit = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function truncate(s, max) {
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n\n<!-- … diff troncato: ${s.length} caratteri, limite ${max} -->\n`;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`guida-suggest-prompt.mjs — genera prompt per aggiornare le guide

Uso:
  npm run guida:suggest
  npm run guida:suggest -- --out ./mio-prompt.md --max-chars 80000

Opzioni:
  --base --head     come guida:impact
  --out <file>      default: scripts/guida-suggest-output/prompt.md
  --max-chars N     default 100000
  --no-git          stdin: path modificati (uno per riga)
`);
    process.exit(0);
  }

  const map = loadGuidaMap(DEFAULT_MAP_PATH);
  const baseRef = args.base || defaultBase(REPO_ROOT);
  const headRef = args.head || 'HEAD';

  let files = [];
  if (args.noGit) {
    files = fs.readFileSync(0, 'utf8').split(/\r?\n/).map((l) => l.replace(/\\/g, '/').trim()).filter(Boolean);
  } else {
    try {
      files = gitNameOnly(baseRef, headRef, REPO_ROOT);
    } catch (e) {
      console.error(`Errore git (${baseRef}…${headRef}):`, e.message || e);
      process.exit(1);
    }
  }

  const { byModule, allMods, unmatched } = computeImpact(files, map);

  const docPrimary = [];
  const seen = new Set();
  for (const mod of allMods) {
    for (const p of docPathsToTouchForModule(mod)) {
      if (!seen.has(p)) {
        seen.add(p);
        docPrimary.push(p);
      }
    }
  }
  const docMirrors = docPrimary.map(mirrorPath);

  let diffBlock;
  if (args.noGit) {
    diffBlock =
      '_(Nessun diff automatico in modalità --no-git. Incolla qui un `git diff` se serve, oppure riesegui senza --no-git.)_\n';
  } else {
    const diffRaw = gitUnifiedDiff(baseRef, headRef, files, REPO_ROOT);
    diffBlock = truncate(diffRaw, args.maxChars);
  }

  const lines = [];
  lines.push('# Prompt — aggiornamento guide GFV (bozza assistita)');
  lines.push('');
  lines.push('**Contesto:** sono stati modificati file nel repo; la mappa in `scripts/guida-code-map.json` indica quali moduli `GUIDA/` probabilmente richiedono allineamento.');
  lines.push('');
  lines.push('## Istruzioni per l’agente (da eseguire solo dopo approvazione umana)');
  lines.push('');
  lines.push('1. **Modifica solo** i file elencati in «Documentazione da aggiornare» (fonte `docs-sviluppo/GUIDA/` e, se esistono, gli stessi path sotto `core/GUIDA/` — mirror).');
  lines.push('2. **Non** modificare `docs-sviluppo/COSA_ABBIAMO_FATTO.md`, `docs-sviluppo/tony/STATO_ATTUALE.md`, `MASTER_PLAN`, `TONY_DECISIONI_*` salvo richiesta esplicita del maintainer.');
  lines.push('3. Nelle **guide utente**: linguaggio semplice, struttura con percorso / indice / mini-guide dove già presente; nessun nome file `.html` nel testo rivolto all’utente finale.');
  lines.push('4. Nelle **sintesi** (`guida-sintesi.md`): testo breve per Tony (token); allinea alle modifiche funzionali del diff.');
  lines.push('5. In **`tony/guida-tecnica.md`**: path, form, comandi, limiti ruolo/piano; niente prosa utente lunga.');
  lines.push('6. Se un modulo non è realmente impattato dal diff, **non** cambiare quella guida (usa il diff come prova).');
  lines.push('7. **Checklist obbligatoria:** sotto è incollato il contenuto di `scripts/GUIDA-AGGIORNAMENTO-CHECKLIST.md` — seguire **tutti** i punti applicabili (mirror, MANODOPERA multi-file, INTERSEZIONI, HTML documentazione, ecc.) prima di dichiarare completato.');
  lines.push('');

  const checklistPath = path.join(__dirname, 'GUIDA-AGGIORNAMENTO-CHECKLIST.md');
  let checklistBody = '';
  try {
    checklistBody = fs.readFileSync(checklistPath, 'utf8').trim();
  } catch {
    checklistBody = '_(File non trovato: `scripts/GUIDA-AGGIORNAMENTO-CHECKLIST.md`)_';
  }
  lines.push('## Checklist obbligatoria (dal repo)');
  lines.push('');
  lines.push(checklistBody);
  lines.push('');

  lines.push('## Moduli impattati');
  lines.push('');
  if (allMods.length === 0) {
    lines.push('_Nessun modulo mappato._');
  } else {
    for (const m of allMods) {
      lines.push(`### ${m}`);
      lines.push('');
      lines.push('File codice che hanno contribuito alla mappa:');
      for (const p of byModule.get(m) || []) lines.push(`- \`${p}\``);
      lines.push('');
    }
  }
  if (unmatched.length) {
    lines.push('## Path senza regola in guida-code-map.json');
    lines.push('');
    for (const u of unmatched) lines.push(`- \`${u}\``);
    lines.push('');
  }
  lines.push('## Documentazione da aggiornare (fonte + mirror)');
  lines.push('');
  lines.push('### Primaria (`docs-sviluppo/GUIDA/`)');
  for (const p of docPrimary) lines.push(`- [ ] \`${p}\``);
  lines.push('');
  lines.push('### Mirror (`core/GUIDA/`) — stessi contenuti se usate la convenzione mirror');
  for (const p of docMirrors) lines.push(`- [ ] \`${p}\``);
  lines.push('');
  lines.push(`## Diff codice (refs: \`${baseRef}\` → \`${headRef}\`, troncato)`);
  lines.push('');
  lines.push('```diff');
  lines.push(diffBlock || '(nessun diff o diff vuoto)');
  lines.push('```');
  lines.push('');
  lines.push('---');
  lines.push(`_Generato da \`npm run guida:suggest\` — non committare questo file se è sotto \`scripts/guida-suggest-output/\` (gitignored)._`);

  const body = lines.join('\n');
  const outDir = path.dirname(args.outPath);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(args.outPath, body, 'utf8');
  console.error(`Scritto: ${args.outPath} (${body.length} caratteri)`);
}

main();
