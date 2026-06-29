/**
 * GFV Farm Simulator v5 — scenario write: segnalazione guasto.
 */
import { test, expect } from '@playwright/test';
import { runGuastiWriteAssertions } from './scenarios/guasti-write.mjs';

test.describe('GFV Farm Simulator v5 — write guasto', () => {
  test('operaio segnala → manager vede in elenco officina', async ({ page }) => {
    await runGuastiWriteAssertions(page, expect);
  });
});
