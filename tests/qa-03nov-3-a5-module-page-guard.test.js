import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  richiediModulo,
  nomeModuloLeggibile,
  messaggioModuloDisattivo,
  moduloEffettivoAttivo,
} from '../core/js/module-page-guard.js';

describe('A5 — module-page-guard', () => {
  const now = new Date('2026-11-03T12:00:00Z');

  it('passa se modulo pagato, in prova o coperto da bundle', () => {
    expect(moduloEffettivoAttivo({ modules: ['magazzino'] }, 'magazzino', now)).toBe(true);
    expect(
      moduloEffettivoAttivo(
        {
          modules: [],
          moduleTrials: {
            magazzino: { status: 'active', endsAt: new Date('2026-12-01') },
          },
        },
        'magazzino',
        now
      )
    ).toBe(true);
    expect(
      moduloEffettivoAttivo(
        { modules: [], activeBundles: ['gfv-completo'], moduleTrials: {} },
        'magazzino',
        now
      )
    ).toBe(true);
  });

  it('spento → messaggio con nome leggibile e richiediModulo false', () => {
    expect(nomeModuloLeggibile('parcoMacchine')).toMatch(/Parco Macchine/i);
    expect(messaggioModuloDisattivo('magazzino')).toMatch(/Magazzino/);
    expect(messaggioModuloDisattivo('magazzino')).toMatch(/Abbonamento/);
    expect(richiediModulo({ modules: [] }, 'magazzino', { container: null })).toBe(false);
    expect(richiediModulo({ modules: ['magazzino'] }, 'magazzino', { container: null })).toBe(true);
  });

  it('ogni pagina magazzino/macchine/conto-terzi importa il guard', () => {
    const roots = [
      'modules/magazzino/views',
      'modules/macchine/views',
      'modules/conto-terzi/views',
    ];
    const missing = [];
    for (const root of roots) {
      const dir = join(process.cwd(), root);
      for (const name of readdirSync(dir)) {
        if (!name.endsWith('.html')) continue;
        if (name.includes('test-bootstrap')) continue;
        const src = readFileSync(join(dir, name), 'utf8');
        if (!src.includes('module-page-guard')) {
          missing.push(`${root}/${name}`);
        }
      }
    }
    expect(missing, `Pagine senza guard: ${missing.join(', ')}`).toEqual([]);
  });
});
