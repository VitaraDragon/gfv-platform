import { test, expect } from '@playwright/test';
import { runVendemmiaCompletaWriteAssertions } from './scenarios/vendemmia-completa-write.mjs';

test.describe('GFV Farm Simulator — vendemmia completa write (catena A)', () => {
  test('manager completa vendemmia stub da lavoro', async ({ page }) => {
    await runVendemmiaCompletaWriteAssertions(page, expect);
  });
});
