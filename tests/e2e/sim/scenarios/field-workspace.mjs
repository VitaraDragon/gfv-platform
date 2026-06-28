/**
 * Assert DOM field workspace mobile — condiviso tra spec Playwright e runner Node.
 * Seed template viticola-manodopera* / viticola-conto-terzi-manodopera:
 * 1 capo, 3 operai, squadra, lavori squadra + autonomo, ore simulate, comunicazioni
 * — validati da inspectManodoperaSeed + sim:audit; assert su DOM visibile.
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */

async function countWorkOptions(page) {
  return page.evaluate(() => {
    const select = document.getElementById('selected-work');
    if (!select) return 0;
    return Array.from(select.options).filter((o) => o.value).length;
  });
}

/** Assert workspace caricato per ruolo operaio. */
export async function runOperaioFieldWorkspaceAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/field-workspace-standalone\.html/);
  await expect(page.locator('#field-swiper')).toBeVisible();

  const statusText = await page.locator('#field-mobile-status').textContent();
  expect(statusText || '').toMatch(/Workspace mobile attivo/i);

  await expect(page.locator('#field-toolbar-user')).toBeVisible();
  const userName = await page.locator('#field-toolbar-user-name').textContent();
  expect((userName || '').trim().length).toBeGreaterThan(0);

  const rolesText = await page.locator('#field-toolbar-user-roles').textContent();
  expect(rolesText || '').toMatch(/Operaio/i);

  expect(await countWorkOptions(page)).toBeGreaterThanOrEqual(1);

  await expect(page.locator('#selected-work')).toBeVisible();
  await expect(page.locator('label[for="selected-work"]')).toHaveText(/Lavori assegnati/i);

  await expect(page.locator('#quick-hours-form')).toBeAttached();
  await expect(page.locator('#ora-data')).toBeAttached();
  await expect(page.locator('#ora-start')).toBeAttached();
  await expect(page.locator('#ora-end')).toBeAttached();

  const receivedComm = page.locator('#received-communications-list');
  await expect(receivedComm).toBeAttached();
  const commText = (await receivedComm.textContent()) || '';
  expect(commText).not.toMatch(/Caricamento comunicazioni/i);
}

/** Assert workspace caricato per ruolo caposquadra (+ sezioni capo). */
export async function runCapoFieldWorkspaceAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/field-workspace-standalone\.html/);
  await expect(page.locator('#field-swiper')).toBeVisible();

  const statusText = await page.locator('#field-mobile-status').textContent();
  expect(statusText || '').toMatch(/Workspace mobile attivo/i);

  await expect(page.locator('#field-toolbar-user')).toBeVisible();
  const userName = await page.locator('#field-toolbar-user-name').textContent();
  expect((userName || '').trim().length).toBeGreaterThan(0);

  const rolesText = await page.locator('#field-toolbar-user-roles').textContent();
  expect(rolesText || '').toMatch(/Caposquadra/i);

  expect(await countWorkOptions(page)).toBeGreaterThanOrEqual(1);

  await expect(page.locator('#inline-validate-hours-section')).toBeVisible();
  await expect(page.locator('#inline-team-section')).toBeVisible();
  await expect(page.locator('#inline-segnala-assenza-section')).toBeVisible();

  await expect(page.locator('#quick-communication-form')).toBeAttached();
  await expect(page.locator('#quick-hours-form')).toBeAttached();

  const sentComm = page.locator('#sent-communications-list');
  await expect(sentComm).toBeAttached();
  const sentText = (await sentComm.textContent()) || '';
  expect(sentText).not.toMatch(/Caricamento comunicazioni inviate/i);

  const pendingAll = page.locator('#pending-hours-all-list');
  await expect(pendingAll).toBeAttached();
  const pendingText = (await pendingAll.textContent()) || '';
  expect(pendingText).not.toMatch(/Caricamento ore da validare/i);
}

/** Scenario completo: operaio poi capo (login persona dedicato per sub-flow). */
export async function runFieldWorkspaceAssertions(page, expect) {
  await runOperaioFieldWorkspaceAssertions(page, expect);
  await runCapoFieldWorkspaceAssertions(page, expect);
}
