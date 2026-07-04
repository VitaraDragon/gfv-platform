import { test, expect } from '@playwright/test';
import { runLavoriCaposquadraWriteAssertions } from './scenarios/lavori-caposquadra-write.mjs';

test.describe('GFV Farm Simulator — lavori caposquadra write', () => {
  test('capo sospende lavoro assegnato con marker causa', async ({ page }) => {
    await runLavoriCaposquadraWriteAssertions(page, expect);
  });
});
