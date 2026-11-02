/**
 * @vitest-environment node
 *
 * Regressione: onCall v2 (firebase-functions) chiama handler(request, response).
 * Se si passa direttamente un gestore con firma (request, db), il secondo argomento
 * diventa il responseProxy e rompe il fallback a admin.firestore().
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const indexPath = path.join(root, 'functions', 'index.js');
const requireFromFunctions = createRequire(path.join(root, 'functions', 'package.json'));

/** Conta i parametri dichiarati leggendo fn.toString() (non fn.length: i default non contano). */
function contaParametriDichiarati(fn) {
  const src = Function.prototype.toString.call(fn);
  const paren = src.match(/\(([^)]*)\)/);
  const inside = paren ? paren[1] : '';
  return String(inside)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length;
}

/** True se il gestore dichiara al massimo un parametro. */
function gestoreOnCallOk(fn) {
  return contaParametriDichiarati(fn) <= 1;
}

function bloccoExportOnCall(testo, nomeExport) {
  const marker = `exports.${nomeExport} = onCall(`;
  const start = testo.indexOf(marker);
  if (start < 0) return '';
  let i = start + marker.length;
  let depth = 1;
  let inStr = null;
  let escaped = false;
  while (i < testo.length && depth > 0) {
    const ch = testo[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === inStr) inStr = null;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
    } else if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    i += 1;
  }
  return testo.slice(start, i);
}

/** Ultimo argomento di ogni exports.X = onCall(...): nome nudo o null se freccia/altro. */
function nomiNudiOnCall(testo) {
  const risultati = [];
  const re = /exports\.(\w+)\s*=\s*onCall\s*\(/g;
  let m;
  while ((m = re.exec(testo)) !== null) {
    const nomeExport = m[1];
    let i = m.index + m[0].length;
    let depth = 1;
    let inStr = null;
    let escaped = false;
    while (i < testo.length && depth > 0) {
      const ch = testo[i];
      if (inStr) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === inStr) inStr = null;
      } else if (ch === '"' || ch === "'" || ch === '`') {
        inStr = ch;
      } else if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      i += 1;
    }
    const corpo = testo.slice(m.index + m[0].length, i - 1);
    const ultimo = corpo.split(',').pop().trim();
    const nudo = /^[A-Za-z_$][\w$]*$/.test(ultimo) ? ultimo : null;
    risultati.push({ nomeExport, ultimo, nudo });
  }
  return risultati;
}

/** Mappa nome importato -> percorso modulo da require("./…") in index.js. */
function mappaRequireHandle(testo) {
  const map = new Map();
  const re = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\("(\.\/[^"]+)"\)/g;
  let m;
  while ((m = re.exec(testo)) !== null) {
    const modPath = m[2];
    m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((part) => {
        const bits = part.split(':').map((s) => s.trim());
        const localName = bits.length > 1 ? bits[1] : bits[0];
        if (localName) map.set(localName, modPath);
      });
  }
  return map;
}

describe('onCall — gestore avvolto (response ≠ database)', () => {
  const testo = readFileSync(indexPath, 'utf8');

  it('registraAccettazioniLegali è avvolta, region europe-west1, senza App Check', () => {
    const corpo = bloccoExportOnCall(testo, 'registraAccettazioniLegali');
    expect(corpo).toMatch(/region:\s*"europe-west1"/);
    expect(corpo).toMatch(/\(request\)\s*=>\s*handleRegistraAccettazioniLegali\(request\)/);
    expect(corpo).not.toMatch(/,\s*handleRegistraAccettazioniLegali\s*\)/);
    expect(corpo).not.toMatch(/enforceAppCheck/);
  });

  it('nessun gestore passato direttamente a onCall dichiara più di un parametro', () => {
    const requires = mappaRequireHandle(testo);
    const nudi = nomiNudiOnCall(testo).filter((r) => r.nudo);
    expect(nudi.length).toBeGreaterThan(0);

    for (const { nomeExport, nudo } of nudi) {
      const modRel = requires.get(nudo);
      expect(
        modRel,
        `${nomeExport}: non trovo require("./…") per il gestore nudo "${nudo}"`
      ).toBeTruthy();
      const mod = requireFromFunctions(modRel);
      const fn = mod[nudo];
      expect(typeof fn, `${nomeExport}: ${nudo} non è una funzione exportata`).toBe('function');
      expect(
        gestoreOnCallOk(fn),
        `${nomeExport}: il gestore passato direttamente a onCall ha più di un parametro; avvolgilo: (request) => ${nudo}(request)`
      ).toBe(true);
    }
  });

  it('la regola segnala (request, db) e accetta (request)', () => {
    async function handleFinto(request, db) {}
    async function handleFinto2(request) {}
    expect(gestoreOnCallOk(handleFinto)).toBe(false);
    expect(gestoreOnCallOk(handleFinto2)).toBe(true);
    expect(contaParametriDichiarati(handleFinto)).toBe(2);
    expect(contaParametriDichiarati(handleFinto2)).toBe(1);
  });
});
