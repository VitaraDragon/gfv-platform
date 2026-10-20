import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { runZoneSostitutoMappa } from './scenarios/zone-sostituto-mappa.mjs';

const fakeMaps = path.join(path.dirname(fileURLToPath(import.meta.url)), 'helpers/fake-google-maps.js');

test.describe('zone del sostituto sulla mappa', () => {
  test('il sostituto vede le zone del titolare e può segnarne', async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript({ path: fakeMaps });
    await runZoneSostitutoMappa(page, test.expect);
  });
});
