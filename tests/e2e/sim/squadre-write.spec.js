import { test, expect } from './helpers/gfv-test.js';
import { runSquadreWriteAssertions } from './scenarios/squadre-write.mjs';

test.describe('GFV Farm Simulator — squadre write', () => {
  test('manager crea nuova squadra', async ({ page }) => {
    await runSquadreWriteAssertions(page, expect);
  });
});
