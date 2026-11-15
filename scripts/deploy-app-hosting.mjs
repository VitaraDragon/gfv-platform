/**
 * Pubblica solo l'hosting dell'app (target app).
 * Rifiuta se HEAD non è esattamente origin/main o se il working tree è sporco.
 * Il predeploy del target lancia npm run build:app.
 * Non eseguirlo da un branch di lavoro.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {{ head: string, originMain: string, porcelain: string }} stato
 * @returns {string[]} motivi di rifiuto, vuoto se il deploy è ammesso
 */
export function motiviRifiutoDeployApp({ head, originMain, porcelain }) {
  const motivi = [];
  if (!head || !originMain || head !== originMain) {
    motivi.push(`HEAD ${head || '(vuoto)'} non è origin/main ${originMain || '(vuoto)'}`);
  }
  if (String(porcelain || '').trim()) motivi.push('working tree sporco');
  return motivi;
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function avviatoDaCli() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (avviatoDaCli()) {
  const motivi = motiviRifiutoDeployApp({
    head: git(['rev-parse', 'HEAD']),
    originMain: git(['rev-parse', 'origin/main']),
    porcelain: git(['status', '--porcelain']),
  });

  if (motivi.length) {
    console.error(`deploy:app rifiutato: ${motivi.join('; ')}`);
    process.exit(1);
  }

  const firebase = path.join(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
  execFileSync(process.execPath, [firebase, 'deploy', '--only', 'hosting:app', '--project', 'gfv-platform'], {
    cwd: root,
    stdio: 'inherit',
  });
}
