/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgrarianYearBounds, getSolarYearBounds } from '../modules/report/js/report-time-range.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const viewsDir = join(root, 'modules/report/views');

/** Estrae argomenti delle chiamate a fnName( … ) su una sola riga / blocco bilanciato. */
function callArgs(source, fnName) {
  const out = [];
  const needle = `${fnName}(`;
  let from = 0;
  while (from < source.length) {
    const i = source.indexOf(needle, from);
    if (i < 0) break;
    let depth = 1;
    let j = i + needle.length;
    while (j < source.length && depth > 0) {
      const ch = source[j];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      j += 1;
    }
    out.push(source.slice(i + needle.length, j - 1).trim());
    from = j;
  }
  return out;
}

describe('report-time-range', () => {
  it('annata agraria 2025 (ref 15 nov) → 11/11/2025 – 10/11/2026', () => {
    const b = getAgrarianYearBounds(new Date(2025, 10, 15));
    expect(b.start.getFullYear()).toBe(2025);
    expect(b.start.getMonth()).toBe(10);
    expect(b.start.getDate()).toBe(11);
    expect(b.end.getFullYear()).toBe(2026);
    expect(b.end.getMonth()).toBe(10);
    expect(b.end.getDate()).toBe(10);
  });

  it('anno solare 2025 → 1 gen – 31 dic 2025', () => {
    const b = getSolarYearBounds(new Date(2025, 5, 15));
    expect(b.start.getFullYear()).toBe(2025);
    expect(b.start.getMonth()).toBe(0);
    expect(b.start.getDate()).toBe(1);
    expect(b.end.getFullYear()).toBe(2025);
    expect(b.end.getMonth()).toBe(11);
    expect(b.end.getDate()).toBe(31);
  });

  it('view report: getAgrarianYearBounds / getSolarYearBounds ricevono Date (o nessun arg)', () => {
    const htmlFiles = readdirSync(viewsDir).filter((f) => f.endsWith('.html'));
    expect(htmlFiles.length).toBeGreaterThan(0);

    const bad = [];
    for (const file of htmlFiles) {
      const source = readFileSync(join(viewsDir, file), 'utf8');
      for (const fn of ['getAgrarianYearBounds', 'getSolarYearBounds']) {
        for (const args of callArgs(source, fn)) {
          if (!args) continue; // nessun argomento → default new Date()
          if (/^new\s+Date\s*\(/.test(args)) continue;
          bad.push(`${file}: ${fn}(${args})`);
        }
      }
    }
    expect(bad, `chiamate con argomento non-Date:\n${bad.join('\n')}`).toEqual([]);
  });
});
