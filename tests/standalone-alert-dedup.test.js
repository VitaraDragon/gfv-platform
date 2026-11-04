/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showStandaloneAlert } from '../core/js/standalone-alert.js';

describe('standalone-alert dedup', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.gfvShowAlert;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('stesso testo non duplica; massimo 3 toast', async () => {
    // Ricarica il modulo globale senza gfvShowAlert già impostato
    const { showStandaloneAlert: show } = await import('../core/js/standalone-alert.js');
    show('Ciao', 'error', 6000);
    show('Ciao', 'error', 6000);
    let layer = document.getElementById('gfv-standalone-toast-layer');
    expect(layer.querySelectorAll('.alert')).toHaveLength(1);

    show('Uno', 'info', 6000);
    show('Due', 'info', 6000);
    show('Tre', 'info', 6000);
    show('Quattro', 'info', 6000);
    layer = document.getElementById('gfv-standalone-toast-layer');
    expect(layer.querySelectorAll('.alert').length).toBeLessThanOrEqual(3);
  });
});
