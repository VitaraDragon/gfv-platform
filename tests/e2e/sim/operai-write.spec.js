import { test, expect } from '@playwright/test';
import { runOperaiWriteAssertions } from './scenarios/operai-write.mjs';

test.describe('GFV Farm Simulator — operai write', () => {
  test('manager salva nota scheda competenze operaio', async ({ page }) => {
    await runOperaiWriteAssertions(page, expect);
  });
});
