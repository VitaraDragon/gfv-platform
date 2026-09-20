/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, test } from 'vitest';
import {
  ensureStandaloneReadyPlaceholder,
  settleStandaloneReady,
} from '../core/js/standalone-ready.js';

describe('standalone-ready placeholder', () => {
  afterEach(() => {
    delete globalThis.GFVStandaloneReady;
    delete globalThis.__gfvStandaloneReadyResolve;
    delete globalThis.__gfvStandaloneReadyReject;
  });

  test('ensure è idempotente e settle sblocca chi attende', async () => {
    const first = ensureStandaloneReadyPlaceholder();
    const second = ensureStandaloneReadyPlaceholder();
    expect(second).toBe(first);
    expect(globalThis.GFVStandaloneReady).toBe(first);

    let settled = false;
    const waiter = first.then(() => {
      settled = true;
    });
    settleStandaloneReady(true);
    await waiter;
    expect(settled).toBe(true);
  });

  test('settle reject propaga l\'errore', async () => {
    const ready = ensureStandaloneReadyPlaceholder();
    settleStandaloneReady(false, new Error('bootstrap failed'));
    await expect(ready).rejects.toThrow('bootstrap failed');
  });
});
