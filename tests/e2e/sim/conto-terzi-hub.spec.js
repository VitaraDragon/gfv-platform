import { test, expect } from '@playwright/test';
import {
  gotoContoTerziHome,
  gotoMappaClienti,
  loginAsManagerContoTerzi,
} from './helpers/sim-login.js';
import {
  runContoTerziHomeAssertions,
  runMappaClientiAssertions,
} from './scenarios/conto-terzi-hub.mjs';

test.describe('GFV Farm Simulator — hub conto terzi', () => {
  test('pagina dev (conto terzi) → home + mappa clienti', async ({ page }) => {
    await loginAsManagerContoTerzi(page);
    await gotoContoTerziHome(page);
    await runContoTerziHomeAssertions(page, expect);
    await gotoMappaClienti(page);
    await runMappaClientiAssertions(page, expect);
  });
});
