import { test, expect } from '@playwright/test';
import { runGuastiResolveWriteAssertions } from './scenarios/guasti-resolve-write.mjs';

test.describe('GFV Farm Simulator — guasti resolve write', () => {
  test('manager risolve guasto marker in gestione guasti admin', async ({ page }) => {
    await runGuastiResolveWriteAssertions(page, expect);
  });
});
