import { test, expect } from '@playwright/test';
import { runGuastiResolveWriteAssertions } from './scenarios/guasti-resolve-write.mjs';

test.describe('GFV Farm Simulator — guasti resolve write', () => {
  test('manager risolve guasto marker in lista officina guasti', async ({ page }) => {
    test.setTimeout(120_000);
    await runGuastiResolveWriteAssertions(page, expect);
  });
});
