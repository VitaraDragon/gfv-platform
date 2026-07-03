import { test, expect } from '@playwright/test';
import { runScadenzeWriteAssertions } from './scenarios/scadenze-write.mjs';

test.describe('GFV Farm Simulator — scadenze write', () => {
  test('manager aggiorna scadenza scaduta', async ({ page }) => {
    await runScadenzeWriteAssertions(page, expect);
  });
});
