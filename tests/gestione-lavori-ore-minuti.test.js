/**
 * @vitest-environment jsdom
 * Le ore del lavoro si vedono in ore e minuti. 0,333 h è 20 min, non 0h.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../core/services/firebase-service.js', () => ({
  collection: () => ({}),
  doc: (_db, _col, id) => ({ id }),
  getDocs: async () => ({
    forEach(cb) {
      cb({ data: () => ({ operaioId: 'ion', stato: 'validate', oreNette: 0.333 }) });
      cb({ data: () => ({ operaioId: 'matteo', stato: 'validate', oreNette: 0.5 }) });
    }
  }),
  getDoc: async (ref) => ({
    exists: () => true,
    data: () => (ref.id === 'ion'
      ? { nome: 'Ion', cognome: '' }
      : { nome: 'Matteo', cognome: '' })
  })
}));

import { loadDettaglioOre } from '../core/admin/js/gestione-lavori-controller.js';

const controllerSrc = readFileSync(
  join(process.cwd(), 'core/admin/js/gestione-lavori-controller.js'),
  'utf8'
);

describe('visualizzazione ore del lavoro', () => {
  it('non arrotonda le ore con Math.round seguito da h', () => {
    expect(controllerSrc).not.toMatch(/Math\.round\((?:[^()]|\([^()]*\))*\)\}h/);
    expect(controllerSrc).not.toMatch(/Math\.round\([^)\n]*\)\s*\+\s*['"]h['"]/);
    expect(controllerSrc).toContain('formattaOreMinuti(totaleValidate)');
    expect(controllerSrc).toContain('formattaOreMinuti(ore.validate)');
    expect(controllerSrc).toContain("from '../../services/ore-operai-logic.js'");
  });

  it('nel tab Ore 0,333 h sono 20 min e 0,5 h sono 30 min', async () => {
    document.body.innerHTML = '<div id="dettaglio-ore-content"></div>';
    await loadDettaglioOre(
      'lav1',
      [{ id: 'lav1', nome: 'Prova' }],
      'tenant',
      {},
      (value) => String(value ?? '')
    );
    const html = document.getElementById('dettaglio-ore-content').innerHTML;
    expect(html).toContain('✅ 0h 20min');
    expect(html).toContain('✅ 0h 30min');
    expect(html).toContain('>0h 50min<');
    expect(html).not.toContain('✅ 0h<');
    expect(html).not.toContain('✅ 1h');
  });
});
