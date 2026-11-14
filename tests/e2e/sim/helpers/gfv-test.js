import { test as base, expect } from '@playwright/test';
import { blockExternalTestNetwork } from './block-external-network.js';

export const test = base.extend({
  context: async ({ context }, use) => {
    await blockExternalTestNetwork(context);
    await use(context);
  },
});

export { expect };
