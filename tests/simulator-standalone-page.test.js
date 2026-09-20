/**
 * @vitest-environment node
 */
import { describe, expect, test, afterEach } from 'vitest';
import {
  waitForStandaloneReady,
  resolveAuthUser,
  resolveAuthUserWithRetry,
} from '../core/js/simulator-standalone-page.js';

describe('waitForStandaloneReady', () => {
  afterEach(() => {
    delete globalThis.GFVStandaloneReady;
  });

  test('attende la promise se arriva dopo il primo tick', async () => {
    const ready = waitForStandaloneReady(2000);
    await new Promise((r) => setTimeout(r, 40));
    let resolved = false;
    globalThis.GFVStandaloneReady = Promise.resolve().then(() => {
      resolved = true;
    });
    await ready;
    expect(resolved).toBe(true);
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
