/**
 * B7 — Pieno per manager senza Manodopera (static + parser).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCarburanteMovimentoQuery } from '../modules/magazzino/lib/carburante-movimento.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('B7 pieno manager', () => {
  it('parseCarburanteMovimentoQuery espone macchinaId', () => {
    expect(
      parseCarburanteMovimentoQuery('?categoria=carburante&tipo=uscita&pieno=1&macchinaId=abc').macchinaId
    ).toBe('abc');
  });

  it('quick bar: pienoCarburante senza Manodopera, con Magazzino+Parco Macchine, manager/admin', () => {
    const qb = read('core/js/dashboard-quick-bar.js');
    expect(qb).toMatch(/pienoCarburante:\s*\{[\s\S]*?requireManodopera:\s*false/m);
    expect(qb).toMatch(/pienoCarburante:\s*\{[\s\S]*?modules:\s*\[[\s\S]*?magazzino[\s\S]*?parcoMacchine/m);
    expect(qb).toMatch(/pienoCarburante:\s*\{[\s\S]*?visibleForRoles:\s*\[[\s\S]*?manager[\s\S]*?amministratore/m);
    expect(qb).toMatch(/pieno=1/);
  });

  it('Diario: link Pieno con macchinaId quando Magazzino+Parco', () => {
    const ctrl = read('core/js/attivita-controller.js');
    expect(ctrl).toMatch(/mostraPienoAttivita/);
    expect(ctrl).toMatch(/pieno=1&macchinaId=/);
  });

  it('workspace continua a rimandare via il manager (non aperto a manager)', () => {
    const ws = read('core/mobile/js/field-workspace-controller.js');
    expect(ws).toMatch(/rimandaDashboardTemporanea/);
  });
});
