import { test, expect } from '@playwright/test';
import { runSegnaturaOreWriteAssertions } from './scenarios/segnatura-ore-write.mjs';

test.describe('GFV Farm Simulator — segnatura ore write', () => {
  test('capo segna ore desktop → manager vede in validazione', async ({ page }) => {
    await runSegnaturaOreWriteAssertions(page, expect);
  });
});
