import { test, expect } from '@playwright/test';
import { runOperaiWriteAssertions } from './scenarios/operai-write.mjs';

test.describe('GFV Farm Simulator — operai write', () => {
  test('manager aggiorna note contratto operaio', async ({ page }) => {
    await runOperaiWriteAssertions(page, expect);
  });
});
