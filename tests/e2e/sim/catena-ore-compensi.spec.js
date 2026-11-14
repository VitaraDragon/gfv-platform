/**
 * Ore mobile, validazione e compensi sullo stesso worker e sullo stesso slot.
 * Con più worker il prefisso z- non basta: un altro slot non vede le ore appena scritte.
 */
import { test, expect } from './helpers/gfv-test.js';
import { gotoValidazioneOre, loginAsManagerManodopera } from './helpers/sim-login.js';
import { runFieldWorkspaceOreWriteAssertions } from './scenarios/field-workspace-write.mjs';
import { runValidazioneOreWriteAssertions } from './scenarios/validazione-ore-write.mjs';
import { runCompensiWriteAssertions } from './scenarios/compensi-write.mjs';

test.describe.configure({ mode: 'serial' });

test.describe('catena ore → validazione → compensi', () => {
  test('operaio segna ore e il manager vede la coda', async ({ page }) => {
    await runFieldWorkspaceOreWriteAssertions(page, expect);
  });

  test('il manager valida la riga marker', async ({ page }) => {
    await loginAsManagerManodopera(page);
    await gotoValidazioneOre(page);
    await runValidazioneOreWriteAssertions(page, expect);
  });

  test('il manager calcola i compensi del mese', async ({ page }) => {
    test.setTimeout(120_000);
    await runCompensiWriteAssertions(page, expect);
  });
});
