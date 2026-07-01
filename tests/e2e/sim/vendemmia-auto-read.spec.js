import { test, expect } from '@playwright/test';
import { runVendemmiaAutoReadAssertions } from './scenarios/vendemmia-auto-read.mjs';

test.describe('GFV Farm Simulator — vendemmia auto read (catena A)', () => {
  test('manager → lista vendemmia stub da lavoro con link e badge', async ({ page }) => {
    await runVendemmiaAutoReadAssertions(page, expect);
  });
});
