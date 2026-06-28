/**
 * Login emulator via pagina dev sim — stesso flusso di simulator-dev-standalone.html.
 * @module tests/e2e/sim/helpers/sim-login
 */

export const SIM_DEV_PATH = '/core/dev/simulator-dev-standalone.html?emulator=1';
export const SCADENZE_LIST_PATH =
  '/modules/macchine/views/scadenze-list-standalone.html?emulator=1';
export const TERRENI_LIST_PATH = '/core/terreni-standalone.html?emulator=1';

/** Attende caricamento tabella scadenze parco macchine (Firestore + render). */
export async function waitForScadenzeListLoaded(page) {
  await page.waitForURL(/scadenze-list-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Scadenze' }).waitFor({ timeout: 60_000 });

  await page.waitForFunction(() => {
    const container = document.getElementById('table-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (container.querySelector('.scadenze-table tbody tr')) return true;
    const empty = container.querySelector('.empty-state');
    return empty && !/Caricamento/i.test(empty.textContent || '');
  }, { timeout: 60_000 });

  await page.locator('.scadenze-table .status-dot').first().waitFor({ timeout: 60_000 });
}

/** Naviga alla lista scadenze parco (sessione emulator da login dev). */
export async function gotoScadenzeList(page) {
  await page.goto(SCADENZE_LIST_PATH);
  await waitForScadenzeListLoaded(page);
}

/** Attende caricamento lista terreni (Firestore + render tabella). */
export async function waitForTerreniListLoaded(page) {
  await page.waitForURL(/terreni-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Terreni' }).waitFor({ timeout: 60_000 });

  await page.waitForFunction(() => {
    const container = document.getElementById('terreni-container');
    if (!container) return false;
    if (/Caricamento terreni/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.terreno-row').length >= 4;
  }, { timeout: 60_000 });

  await page.locator('#terreni-container .alert-dot').first().waitFor({ timeout: 60_000 });
}

/** Naviga alla lista terreni (sessione emulator da login dev). */
export async function gotoTerreniList(page) {
  await page.goto(TERRENI_LIST_PATH);
  await waitForTerreniListLoaded(page);
}

/** Attende che i widget scadenze dashboard abbiano finito il caricamento Firestore. */
export async function waitForDashboardDeadlinesLoaded(page) {
  await page.locator('.dashboard-deadlines-row').waitFor({ state: 'visible', timeout: 60_000 });
  await page.getByRole('heading', { name: /Scadenze amministrazione/i }).waitFor();
  await page.getByRole('heading', { name: /In arrivo/i }).waitFor();

  await page.waitForFunction(() => {
    const empty = document.getElementById('scadenze-amministrazione-empty');
    if (empty && !empty.hidden && /Caricamento/i.test(empty.textContent || '')) return false;
    return document.querySelectorAll('#scadenze-amministrazione-list .dashboard-deadline-row').length > 0;
  }, { timeout: 60_000 });

  await page.waitForFunction(() => {
    const empty = document.getElementById('in-arrivo-empty');
    if (empty && !empty.hidden && /Caricamento/i.test(empty.textContent || '')) return false;
    return document.querySelectorAll('#in-arrivo-list .dashboard-deadline-row').length > 0;
  }, { timeout: 60_000 });
}

/**
 * Apre la pagina dev, sceglie la prima azienda con seed completo (se presente), Entra come manager.
 * @param {import('@playwright/test').Page} page
 * @param {{ preferSeedComplete?: boolean }} [options]
 */
export async function loginAsManagerFromDevPage(page, options = {}) {
  const { preferSeedComplete = true } = options;

  await page.goto(SIM_DEV_PATH);

  const emptyMsg = page.getByText('Nessuna azienda in manifest');
  const cardLocator = page.locator('.card');

  await Promise.race([
    cardLocator.first().waitFor({ state: 'visible', timeout: 45_000 }),
    emptyMsg.waitFor({ state: 'visible', timeout: 45_000 }),
  ]);

  if (await emptyMsg.isVisible()) {
    throw new Error('Nessuna azienda in manifest — esegui npm run sim:run (con emulator attivo).');
  }

  let card = cardLocator.first();
  if (preferSeedComplete) {
    const seeded = page.locator('.card-new').first();
    if ((await seeded.count()) > 0) {
      card = seeded;
    }
  }

  await card.getByRole('button', { name: 'Entra come manager' }).click();
  await page.waitForURL(/dashboard-standalone\.html/, { timeout: 60_000 });
  await waitForDashboardDeadlinesLoaded(page);
}
