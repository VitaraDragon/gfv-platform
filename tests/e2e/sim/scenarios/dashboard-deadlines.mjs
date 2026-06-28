/**
 * Assert DOM widget scadenze dashboard — condiviso tra spec Playwright e runner Node.
 * Dati seed (4 affitti, semafori) validati da v3; qui assert su ciò che il widget mostra (max 8 righe).
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runDashboardDeadlinesAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/dashboard-standalone\.html/);
  await expect(page.locator('#user-info')).not.toHaveText('Caricamento...');

  const scadenzeList = page.locator('#scadenze-amministrazione-list');
  const affittiRows = scadenzeList.locator('.dashboard-deadline-row', {
    has: page.locator('.dashboard-deadline-row__type', { hasText: 'Affitto' }),
  });

  const affittiCount = await affittiRows.count();
  expect(affittiCount).toBeGreaterThanOrEqual(2);

  const dettagliAffitti = await affittiRows.locator('.dashboard-deadline-row__detail').allTextContents();
  const hasSemaforoAffitto = dettagliAffitti.some(
    (d) => /Scaduto|\(\d+ giorni\)|\(~\d+ mesi\)/i.test(d)
  );
  expect(hasSemaforoAffitto).toBe(true);

  const inArrivoRows = page.locator('#in-arrivo-list .dashboard-deadline-row');
  expect(await inArrivoRows.count()).toBeGreaterThanOrEqual(3);

  const tipiInArrivo = await inArrivoRows.locator('.dashboard-deadline-row__type').allTextContents();
  const hasMacchine = tipiInArrivo.some((t) =>
    /Tagliando km|Manutenzione ore|Manutenzione/i.test(t)
  );
  expect(hasMacchine).toBe(true);

  await expect(
    scadenzeList.locator('.dashboard-deadline-footer a', { hasText: /scadenze mezzi/i })
  ).toBeVisible();
}
