import { test, expect } from './helpers/gfv-test.js';
import { runScadenzeWriteAssertions } from './scenarios/scadenze-write.mjs';

test.describe('GFV Farm Simulator — scadenze write', () => {
  test('manager aggiorna scadenza scaduta', async ({ page }) => {
    await runScadenzeWriteAssertions(page, expect);
  });
});
