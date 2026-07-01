import { test, expect } from '@playwright/test';
import { runPreventiviInviaWriteAssertions } from './scenarios/preventivi-invia-write.mjs';

test.describe('GFV Farm Simulator — preventivi invia write (conto terzi)', () => {
  test('manager → bozza marker 8.88 ha → Invia → badge Inviato', async ({ page }) => {
    test.setTimeout(240_000);
    await runPreventiviInviaWriteAssertions(page, expect);
  });
});
