import { test, expect } from '@playwright/test';
import {
  runLavoriCaposquadraWriteAssertions,
  runLavoroZonaAlCentoVisibileInSegnaOre,
} from './scenarios/lavori-caposquadra-write.mjs';

test.describe('GFV Farm Simulator — lavori caposquadra write', () => {
  test('capo sospende lavoro assegnato con marker causa', async ({ page }) => {
    await runLavoriCaposquadraWriteAssertions(page, expect);
  });

  test('zona al 100% resta in Segna ore per l’operaio senza ore', async ({ page }) => {
    test.setTimeout(240_000);
    await runLavoroZonaAlCentoVisibileInSegnaOre(page, expect);
  });
});
