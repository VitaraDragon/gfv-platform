import { test, expect } from '@playwright/test';
import { runAttrezziWriteAssertions } from './scenarios/attrezzi-write.mjs';

test.describe('GFV Farm Simulator — attrezzi write', () => {
  test('manager crea nuova attrezzatura da lista', async ({ page }) => {
    await runAttrezziWriteAssertions(page, expect);
  });
});
