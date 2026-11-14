/**
 * Entrata e uscita di magazzino nello stesso login.
 */
import { test, expect } from './helpers/gfv-test.js';
import { gotoMovimentiList, loginAsManagerFromDevPage } from './helpers/sim-login.js';
import { runMovimentiWriteAssertions } from './scenarios/movimenti-write.mjs';
import { runMovimentiUscitaWriteAssertions } from './scenarios/movimenti-uscita-write.mjs';

test.describe('GFV Farm Simulator — write movimenti magazzino', () => {
  test('un login: entrata e uscita restano in tabella', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsManagerFromDevPage(page);
    await gotoMovimentiList(page);
    await runMovimentiWriteAssertions(page, expect);
    await runMovimentiUscitaWriteAssertions(page, expect);
  });
});
