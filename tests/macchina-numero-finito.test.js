import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { numeroFinito } from '../shared/js/registro-trattamenti.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('Macchina — numeroFinito su ore', () => {
  it('numeroFinito: null, vuoto e NaN → null', () => {
    expect(numeroFinito(null)).toBeNull();
    expect(numeroFinito('')).toBeNull();
    expect(numeroFinito(NaN)).toBeNull();
    expect(numeroFinito(120)).toBe(120);
  });

  it('Macchina usa numeroFinito per ore e km', () => {
    const src = readFileSync(path.join(root, 'modules/parco-macchine/models/Macchina.js'), 'utf8');
    expect(src).toMatch(/import\s*\{\s*numeroFinito\s*\}\s*from/);
    expect(src).toMatch(/oreProssimaManutenzione\s*=\s*numeroFinito/);
    expect(src).toMatch(/oreInizialiN\s*=\s*numeroFinito/);
    expect(src).toMatch(/oreAttualiN\s*=\s*numeroFinito/);
  });
});
