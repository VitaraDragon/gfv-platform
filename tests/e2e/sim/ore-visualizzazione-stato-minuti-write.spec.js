/**
 * GFV Farm Simulator — stato attuale in Validazione ore e minuti nel tab Ore.
 */
import { test, expect } from '@playwright/test';
import { runOreVisualizzazioneStatoMinutiAssertions } from './scenarios/ore-visualizzazione-stato-minuti.mjs';

test.describe('GFV Farm Simulator — ore validate in minuti', () => {
  test('riga rifiutata e poi validata: stato Validata e 20 min nel tab Ore', async ({ page }) => {
    await runOreVisualizzazioneStatoMinutiAssertions(page, expect);
  });
});
