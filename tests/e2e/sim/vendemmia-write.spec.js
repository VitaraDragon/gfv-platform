import { test, expect } from './helpers/gfv-test.js';
import { runVendemmiaWriteAssertions } from './scenarios/vendemmia-write.mjs';

test.describe('GFV Farm Simulator — vendemmia write', () => {
  test('manager registra nuova vendemmia marker', async ({ page }) => {
    await runVendemmiaWriteAssertions(page, expect);
  });
});
