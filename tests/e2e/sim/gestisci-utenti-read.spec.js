import { test, expect } from '@playwright/test';
import { runGestisciUtentiReadAssertions } from './scenarios/gestisci-utenti-read.mjs';

test.describe('GFV Farm Simulator — gestisci utenti read', () => {
  test('manager vede lista utenti seed manodopera', async ({ page }) => {
    await runGestisciUtentiReadAssertions(page, expect);
  });
});
