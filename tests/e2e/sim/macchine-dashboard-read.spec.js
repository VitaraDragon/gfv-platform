import { test, expect } from '@playwright/test';
import { runMacchineDashboardReadAssertions } from './scenarios/macchine-dashboard-read.mjs';

test.describe('GFV Farm Simulator — macchine dashboard read', () => {
  test('KPI numerici dashboard parco macchine', async ({ page }) => {
    await runMacchineDashboardReadAssertions(page, expect);
  });
});
