/**
 * Assert pagine manodopera residue template (compensi, segnatura ore, segnalazione, stats operaio).
 * @param {import('playwright-core').Page} page
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function runCompensiOperaiReadAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/compensi-operai-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Compensi Operai' })).toBeVisible();

  await expect(page.locator('#filter-operaio')).toBeVisible();
  await expect(page.locator('#compensi-body .loading')).toHaveCount(0);

  const statOperai = page.locator('#stat-operai-compensati');
  await expect(statOperai).not.toHaveText('-');
}

export async function runSegnaturaOreReadAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/segnatura-ore-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Segna Ore Lavorate' })).toBeVisible();

  const lavoriContainer = page.locator('#lavori-container');
  await expect(lavoriContainer.locator('.loading')).toHaveCount(0);
  expect(
    (await lavoriContainer.locator('.lavoro-card').count()) +
      (await lavoriContainer.locator('.empty-state').count())
  ).toBeGreaterThanOrEqual(1);

  const oreContainer = page.locator('#ore-container');
  await expect(oreContainer.locator('.loading')).toHaveCount(0);
}

export async function runSegnalazioneGuastiReadAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/segnalazione-guasti-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Segnalazione Guasti' })).toBeVisible();
  await expect(page.locator('#segnala-guasto-form #tipo-generico')).toBeVisible();
  await expect(page.locator('#tipo-macchina')).toBeVisible();
}

export async function runStatisticheLavoratoreReadAssertions(page, expect) {
  expect.configure({ timeout: 45_000 });

  await expect(page).toHaveURL(/statistiche-lavoratore-standalone\.html/);
  await expect(page.locator('h1').filter({ hasText: 'Le tue statistiche' })).toBeVisible();

  await expect(page.locator('#loading-el')).toHaveCount(0);
  await expect(page.locator('#m-ore')).not.toHaveText('—');
  await expect(page.locator('#f-apply')).toBeVisible();
}
