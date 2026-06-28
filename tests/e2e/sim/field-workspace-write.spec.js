/**
 * GFV Farm Simulator v5 — scenario write: ore mobile (field workspace operaio).
 */
import { test, expect } from '@playwright/test';
import { runFieldWorkspaceOreWriteAssertions } from './scenarios/field-workspace-write.mjs';

test.describe('GFV Farm Simulator v5 — write ore mobile', () => {
  test('operaio → Segna ore → manager vede coda validazione', async ({ page }) => {
    await runFieldWorkspaceOreWriteAssertions(page, expect);
  });
});
