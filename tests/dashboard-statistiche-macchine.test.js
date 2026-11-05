import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('Statistiche macchine raggiungibili', () => {
  it('quick bar: voce con Parco Macchine, anche se Manodopera è attivo', () => {
    const qb = read('core/js/dashboard-quick-bar.js');
    expect(qb).toMatch(/statisticheMacchine:\s*\{/);
    expect(qb).toMatch(/label:\s*'Statistiche macchine'/);
    expect(qb).toMatch(/#statistiche-macchine-section/);
    expect(qb).toMatch(/modules:\s*\['parcoMacchine'\]/);
    expect(qb).toMatch(/'statisticheMacchine'/);
  });

  it('dashboard hub/menu e Parco Macchine espongono il link', () => {
    const sections = read('core/js/dashboard-sections.js');
    expect(sections).toMatch(/createStatisticheMacchineCard/);
    expect(sections).toMatch(/Statistiche macchine/);
    const dash = read('modules/macchine/views/macchine-dashboard-standalone.html');
    expect(dash).toMatch(/statistiche-standalone\.html#statistiche-macchine-section/);
  });
});
