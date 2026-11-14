import { test as base, expect } from '@playwright/test';
import { blockExternalTestNetwork } from './block-external-network.js';
import { pickManifestEntry } from './sim-login.js';

export const test = base.extend({
  context: async ({ context }, use) => {
    await blockExternalTestNetwork(context);
    await use(context);
  },
  /** Entry del manifest per lo slot di questo worker (TEST_PARALLEL_INDEX). */
  tenantEntry: [async ({ browser }, use) => {
    const baseURL = process.env.GFV_E2E_BASE_URL || 'http://127.0.0.1:8000';
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    try {
      const entry = await pickManifestEntry(page, {
        preferTemplateId: 'viticola-conto-terzi-manodopera',
        preferSeedComplete: true,
        requirePersonas: true,
      });
      await use(entry);
    } finally {
      await context.close();
    }
  }, { scope: 'worker' }],
});

export { expect };
