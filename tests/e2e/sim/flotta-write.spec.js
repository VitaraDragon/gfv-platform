import { test, expect } from './helpers/gfv-test.js';
import { runFlottaWriteAssertions } from './scenarios/flotta-write.mjs';

test.describe('GFV Farm Simulator — flotta write (parco macchine)', () => {
  test('manager → nuovo mezzo flotta marker → riga in tabella', async ({ page }) => {
    test.setTimeout(240_000);
    await runFlottaWriteAssertions(page, expect);
  });
});
