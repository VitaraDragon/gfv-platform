#!/usr/bin/env node
/**
 * Report: quali cartelle GUIDA/<MODULO> probabilmente vanno aggiornate dopo un diff Git.
 *
 * Uso:
 *   npm run guida:impact
 *   npm run guida:impact -- --base origin/main --head HEAD
 *   node scripts/guida-impact.mjs --base main --head HEAD~10
 *
 * Opzioni:
 *   --base <ref>    ref iniziale (default: origin/main, poi main, poi HEAD~1)
 *   --head <ref>    ref finale (default: HEAD)
 *   --format md|json   (default: md)
 *   --no-git        legge lista file da stdin (uno per riga) invece del diff
 */

import fs from 'node:fs';
import {
  DEFAULT_MAP_PATH,
  REPO_ROOT,
  checklistForModule,
  computeImpact,
  defaultBase,
  gitNameOnly,
  loadGuidaMap
} from './guida-impact-lib.mjs';

function parseArgs(argv) {
  const out = { base: null, head: null, format: 'md', noGit: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') out.base = argv[++i];
    else if (a === '--head') out.head = argv[++i];
    else if (a === '--format') out.format = argv[++i];
    else if (a === '--no-git') out.noGit = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`guida-impact.mjs — report moduli GUIDA da diff Git

Uso:
  npm run guida:impact
  npm run guida:impact -- --base origin/main --head HEAD
  node scripts/guida-impact.mjs --format json

Opzioni:
  --base <ref>     default: origin/main, main o HEAD~1
  --head <ref>     default: HEAD
  --format md|json default: md
  --no-git         legge path da stdin (uno per riga)
`);
    process.exit(0);
  }

  const map = loadGuidaMap(DEFAULT_MAP_PATH);

  let files = [];
  if (args.noGit) {
    files = fs.readFileSync(0, 'utf8').split(/\r?\n/).map((l) => l.replace(/\\/g, '/').trim()).filter(Boolean);
  } else {
    const base = args.base || defaultBase(REPO_ROOT);
    const head = args.head || 'HEAD';
    try {
      files = gitNameOnly(base, head, REPO_ROOT);
    } catch (e) {
      console.error(`Errore git (${base}…${head}):`, e.message || e);
      process.exit(1);
    }
  }

  const { byModule, allMods, unmatched } = computeImpact(files, map);

  if (args.format === 'json') {
    console.log(
      JSON.stringify(
        {
          files,
          modules: allMods,
          byModule: Object.fromEntries(byModule),
          unmatched
        },
        null,
        2
      )
    );
    return;
  }

  const MARKER = '<!-- gfv-guida-impact-bot -->';
  let md = `${MARKER}\n`;
  md += `### Guida GFV — impatto documentazione (auto)\n\n`;
  md += `File analizzati: **${files.length}**. Aggiorna dopo tua revisione **sintesi** + **guida utente** + **guida Tony** per i moduli elencati; poi mirror \`core/GUIDA/\` se la fonte è \`docs-sviluppo/GUIDA/\`.\n\n`;
  md += `#### File toccati\n\n`;
  for (const f of files) md += `- \`${f}\`\n`;
  md += `\n#### Moduli GUIDA suggeriti\n\n`;
  if (allMods.length === 0) {
    md += `_Nessun modulo mappato (solo path non classificati o lista vuota)._\n\n`;
  }
  for (const m of allMods) {
    md += `**${m}** — file che hanno attivato la mappa:\n`;
    for (const p of byModule.get(m) || []) md += `- \`${p}\`\n`;
    md += `\nChecklist file tipici:\n`;
    for (const line of checklistForModule(m)) md += `- [ ] ${line}\n`;
    md += '\n';
  }
  if (unmatched.length) {
    md += `#### Senza mappatura automatica\n\n`;
    md += `Rivedi manualmente se toccano UX o Tony:\n\n`;
    for (const f of unmatched) md += `- \`${f}\`\n`;
    md += '\n';
  }
  md += `---\n_Generato da \`npm run guida:impact\` / workflow PR._\n`;
  console.log(md);
}

main();
