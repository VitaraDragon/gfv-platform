/**
 * @vitest-environment node
 */
import { describe, expect, test, afterEach } from 'vitest';
import { settleStandaloneReady } from '../core/js/standalone-ready.js';
import {
  waitForStandaloneReady,
  resolveAuthUser,
  resolveAuthUserWithRetry,
} from '../core/js/simulator-standalone-page.js';

describe('waitForStandaloneReady', () => {
  afterEach(() => {
    delete globalThis.GFVStandaloneReady;
    delete globalThis.__gfvStandaloneReadyResolve;
    delete globalThis.__gfvStandaloneReadyReject;
  });

  test('attende il settle del placeholder se il bootstrap arriva dopo', async () => {
    const ready = waitForStandaloneReady(2000);
    await new Promise((r) => setTimeout(r, 20));
    settleStandaloneReady(true);
    await expect(ready).resolves.toBeUndefined();
  });

  test('propaga il reject del bootstrap, non lo ingoia', async () => {
    const ready = waitForStandaloneReady(2000);
    await new Promise((r) => setTimeout(r, 20));
    settleStandaloneReady(false, new Error('bootstrap failed'));
    await expect(ready).rejects.toThrow('bootstrap failed');
  });

  test('risolve subito se la promise è già presente', async () => {
    globalThis.GFVStandaloneReady = Promise.resolve();
    await expect(waitForStandaloneReady(500)).resolves.toBeUndefined();
  });
});

describe('resolveAuthUser (retry post-bootstrap)', () => {
  test('usa currentUser al secondo tentativo dopo authStateReady', async () => {
    const user = { uid: 'u1' };
    let readyCalls = 0;
    const auth = {
      currentUser: null,
      async authStateReady() {
        readyCalls += 1;
        auth.currentUser = user;
      },
    };
    const got = await resolveAuthUser(auth);
    expect(got).toEqual(user);
    expect(readyCalls).toBe(1);
    expect(resolveAuthUserWithRetry).toBe(resolveAuthUser);
  });
});
