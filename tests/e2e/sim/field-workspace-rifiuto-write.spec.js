/**
 * GFV Farm Simulator — il caposquadra rifiuta ore dal telefono con un motivo.
 */
import { test, expect } from './helpers/gfv-test.js';
import { runFieldWorkspaceRifiutoAssertions } from './scenarios/field-workspace-rifiuto.mjs';

test.describe('GFV Farm Simulator — rifiuto ore da telefono', () => {
  test('caposquadra rifiuta la riga marker dal workspace e la coda la perde', async ({ page }) => {
    await runFieldWorkspaceRifiutoAssertions(page, expect);
  });
});
