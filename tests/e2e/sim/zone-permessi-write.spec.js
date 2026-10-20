import { test } from '@playwright/test';
import { runZonePermessiWrite } from './scenarios/zone-permessi-write.mjs';

test.describe('permessi zone in campo', () => {
  test('l’operaio segna solo i lavori autonomi e la create sulla squadra è negata', async ({ page }) => {
    test.setTimeout(180_000);
    await runZonePermessiWrite(page, test.expect);
  });
});
