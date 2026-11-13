/**
 * Quantità in formato italiano: virgola decimale, punto delle migliaia, niente zeri fissi.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatQuantita, valoreQuantitaGrezzo } from '../shared/js/formato-quantita.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|mjs|html)$/.test(name)) out.push(full);
  }
  return out;
}

describe('formatQuantita', () => {
  it('formato italiano, fino a 3 decimali, con le migliaia', () => {
    expect(formatQuantita(930)).toBe('930');
    expect(formatQuantita(930.5)).toBe('930,5');
    expect(formatQuantita(1234.567)).toBe('1.234,567');
    expect(formatQuantita(0.001)).toBe('0,001');
    expect(formatQuantita(1e6)).toBe('1.000.000');
    expect(formatQuantita(0.1 + 0.2)).toBe('0,3');
    expect(formatQuantita(-0)).toBe('0');
    expect(formatQuantita(0)).toBe('0');
  });

  it('null, NaN e non numerico restituiscono il segnaposto', () => {
    expect(formatQuantita(null)).toBe('-');
    expect(formatQuantita(undefined)).toBe('-');
    expect(formatQuantita(Number.NaN)).toBe('-');
    expect(formatQuantita('')).toBe('-');
    expect(formatQuantita('abc')).toBe('-');
    expect(formatQuantita(null, 'kg', '—')).toBe('—');
    expect(formatQuantita(Number.NaN, '', '—')).toBe('—');
  });

  it('aggiunge l’unità dopo uno spazio solo se il numero c’è', () => {
    expect(formatQuantita(930, 'kg')).toBe('930 kg');
    expect(formatQuantita(1234.5, 'L')).toBe('1.234,5 L');
    expect(formatQuantita(930, '  kg  ')).toBe('930 kg');
    expect(formatQuantita(930, '')).toBe('930');
    expect(formatQuantita(null, 'kg')).toBe('-');
  });

  it('data-valore resta il numero grezzo, con -0 riportato a 0', () => {
    expect(valoreQuantitaGrezzo(0.25)).toBe('0.25');
    expect(valoreQuantitaGrezzo(0.1 + 0.2)).toBe(String(0.1 + 0.2));
    expect(valoreQuantitaGrezzo(-0)).toBe('0');
    expect(valoreQuantitaGrezzo(null)).toBe('');
    expect(valoreQuantitaGrezzo(Number.NaN)).toBe('');
  });
});

describe('quantità: niente toFixed(3) e niente testo nel value', () => {
  const files = ['modules', 'shared'].flatMap((dir) => walk(path.join(root, dir), []));

  it('modules/ e shared/ non usano toFixed(3) sulle quantità', () => {
    const hits = files.filter((file) => /\.toFixed\(\s*3\s*\)/.test(readFileSync(file, 'utf8')));
    expect(hits.map((file) => path.relative(root, file))).toEqual([]);
  });

  it('formatQuantita non finisce in un .value', () => {
    const bad = /\.value\s*=\s*[^;\n]*formatQuantita|value\s*=\s*["']\$\{\s*formatQuantita|formattaQuantita\([^)]*\)\s*(?:;|\n)\s*\S*\.value/;
    const hits = files.filter((file) => bad.test(readFileSync(file, 'utf8')));
    expect(hits.map((file) => path.relative(root, file))).toEqual([]);
  });
});
