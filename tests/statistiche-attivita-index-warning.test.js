/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAllAttivita,
  notifyMissingFirestoreIndex,
  resetStatisticheIndexWarning
} from '../core/js/statistiche-controller.js';

beforeEach(() => {
  document.body.innerHTML = `<div id="statistiche-index-warning"></div>`;
  resetStatisticheIndexWarning();
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  resetStatisticheIndexWarning();
});

describe('statistiche — avviso indice Firestore una sola volta', () => {
  it('notifyMissingFirestoreIndex mostra il banner una sola volta con link cliccabile', () => {
    notifyMissingFirestoreIndex('https://console.firebase.google.com/index-1');
    notifyMissingFirestoreIndex('https://console.firebase.google.com/index-2');

    const el = document.getElementById('statistiche-index-warning');
    expect(el.classList.contains('is-visible')).toBe(true);
    expect(el.textContent).toContain('Necessario creare un indice Firestore');
    expect(el.getAttribute('data-index-link')).toContain('index-1');
    const anchor = el.querySelector('a');
    expect(anchor).toBeTruthy();
    expect(anchor.getAttribute('href')).toContain('index-1');
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toBe('noopener');
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('getAllAttivita con failed-precondition ripetuto non fa alert multipli', async () => {
    const indexError = {
      code: 'failed-precondition',
      message:
        'The query requires an index. You can create it here: https://console.firebase.google.com/project/x/indexes?create_composite=abc'
    };

    const getDocs = vi.fn(async () => {
      throw indexError;
    });
    const query = vi.fn((...args) => args);
    const where = vi.fn((...args) => args);
    const orderBy = vi.fn((...args) => args);
    const collection = vi.fn(() => ({ path: 'tenants/t1/attivita' }));

    const deps = {
      db: {},
      auth: { currentUser: null },
      query,
      where,
      orderBy,
      getDocs,
      collection
    };

    const results = await Promise.all([
      getAllAttivita('t1', { terrenoId: 'ter1', dataDa: '2026-01-01' }, deps, null),
      getAllAttivita('t1', { terrenoId: 'ter1', dataDa: '2026-01-01' }, deps, null),
      getAllAttivita('t1', { terrenoId: 'ter1', dataDa: '2026-01-01' }, deps, null),
      getAllAttivita('t1', { terrenoId: 'ter1', dataDa: '2026-01-01' }, deps, null),
      getAllAttivita('t1', { terrenoId: 'ter1', dataDa: '2026-01-01' }, deps, null),
      getAllAttivita('t1', { terrenoId: 'ter1', dataDa: '2026-01-01' }, deps, null),
      getAllAttivita('t1', { terrenoId: 'ter1', dataDa: '2026-01-01' }, deps, null)
    ]);

    expect(results.every((r) => Array.isArray(r) && r.length === 0)).toBe(true);
    expect(window.alert).not.toHaveBeenCalled();
    const el = document.getElementById('statistiche-index-warning');
    expect(el.classList.contains('is-visible')).toBe(true);
    expect(el.textContent).toContain('Necessario creare un indice Firestore');
  });
});
