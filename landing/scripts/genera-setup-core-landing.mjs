/**
 * Genera la versione ES di tony-landing-setup-core per la landing.
 * Uso: node landing/scripts/genera-setup-core-landing.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HEADER =
  '// FILE GENERATO da functions/lib/tony-landing-setup-core.js: non modificare a mano.\n' +
  '// Per rigenerarlo: node landing/scripts/genera-setup-core-landing.mjs\n';

const REQUIRE_RE =
  /const\s*\{\s*COLTURE_PREDEFINITE\s*,\s*CATEGORIE_COLTURE_PREDEFINITE\s*\}\s*=\s*require\s*\(\s*["']\.\.\/config\/colture-predefinite["']\s*\)\s*;/;

/**
 * @param {string} sorgenteCore
 * @param {string} sorgenteColture
 * @returns {string}
 */
export function generaTesto(sorgenteCore, sorgenteColture) {
  const core = String(sorgenteCore ?? '');
  const colture = String(sorgenteColture ?? '');

  if (!REQUIRE_RE.test(core)) {
    throw new Error(
      'genera-setup-core-landing: require di colture-predefinite non trovato come atteso'
    );
  }

  const matchExport = core.match(
    /module\.exports\s*=\s*\{([\s\S]*?)\};?\s*$/m
  );
  if (!matchExport) {
    throw new Error(
      'genera-setup-core-landing: module.exports atteso non trovato'
    );
  }
  const nomi = matchExport[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!nomi.length) {
    throw new Error('genera-setup-core-landing: module.exports vuoto');
  }

  const matchColture = colture.match(
    /const COLTURE_PREDEFINITE = Object\.freeze\(\[[\s\S]*?\n\]\);/
  );
  const matchCategorie = colture.match(
    /const CATEGORIE_COLTURE_PREDEFINITE = Object\.freeze\(\[[\s\S]*?\n\]\);/
  );
  if (!matchColture || !matchCategorie) {
    throw new Error(
      'genera-setup-core-landing: elenco colture/categorie non trovato'
    );
  }

  let corpo = core;
  corpo = corpo.replace(/^"use strict";\s*\n/, '');
  corpo = corpo.replace(
    REQUIRE_RE,
    matchColture[0] + '\n\n' + matchCategorie[0]
  );
  const nomiEsportati = nomi.slice();
  if (nomiEsportati.indexOf('COLTURE_PREDEFINITE') < 0) {
    nomiEsportati.push('COLTURE_PREDEFINITE');
  }
  if (nomiEsportati.indexOf('CATEGORIE_COLTURE_PREDEFINITE') < 0) {
    nomiEsportati.push('CATEGORIE_COLTURE_PREDEFINITE');
  }
  corpo = corpo.replace(
    /module\.exports\s*=\s*\{[\s\S]*?\};?\s*$/m,
    'export { ' + nomiEsportati.join(', ') + ' };'
  );

  return HEADER + '\n' + corpo.trim() + '\n';
}

function main() {
  const qui = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(qui, '../..');
  const pathCore = path.join(root, 'functions/lib/tony-landing-setup-core.js');
  const pathColture = path.join(root, 'functions/config/colture-predefinite.js');
  const outDir = path.join(root, 'landing/src/lib/generati');
  const outFile = path.join(outDir, 'tony-landing-setup-core.js');

  const sorgenteCore = fs.readFileSync(pathCore, 'utf8');
  const sorgenteColture = fs.readFileSync(pathColture, 'utf8');
  const testo = generaTesto(sorgenteCore, sorgenteColture);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, testo, 'utf8');
  process.stdout.write('scritto ' + outFile + '\n');
}

const entrato =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (entrato) main();
