import { test, expect } from '@playwright/test';
import { runGestioneMacchineWriteAssertions } from './scenarios/gestione-macchine-write.mjs';

test.describe('GFV Farm Simulator — gestione macchine write', () => {
  test('manager crea nuova macchina trattore marker', async ({ page }) => {
    await runGestioneMacchineWriteAssertions(page, expect);
  });
});
