/**
 * Login emulator via pagina dev sim — stesso flusso di simulator-dev-standalone.html.
 * @module tests/e2e/sim/helpers/sim-login
 */

export const SIM_DEV_PATH = '/core/dev/simulator-dev-standalone.html?emulator=1';
export const SCADENZE_LIST_PATH =
  '/modules/macchine/views/scadenze-list-standalone.html?emulator=1';
export const TERRENI_LIST_PATH = '/core/terreni-standalone.html?emulator=1';
export const ATTIVITA_LIST_PATH = '/core/attivita-standalone.html?emulator=1';
export const MOVIMENTI_LIST_PATH =
  '/modules/magazzino/views/movimenti-standalone.html?emulator=1';
export const POTATURA_LIST_PATH =
  '/modules/vigneto/views/potatura-standalone.html?emulator=1';
export const TRATTAMENTI_LIST_PATH =
  '/modules/vigneto/views/trattamenti-standalone.html?emulator=1';
export const CONCIMATIONS_LIST_PATH =
  '/modules/vigneto/views/concimazioni-standalone.html?emulator=1';

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

/** Attende caricamento diario attività (Firestore + render tabella). */
export async function waitForAttivitaListLoaded(page) {
  await page.waitForURL(/attivita-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Diario Attività' }).waitFor({ timeout: 60_000 });

  await page.waitForFunction(() => {
    const container = document.getElementById('attivita-container');
    if (!container || container.style.display === 'none') return false;
    if (/Caricamento attività/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.attivita-row').length >= 15;
  }, { timeout: 60_000 });

  await page.locator('#attivita-container .attivita-row').first().waitFor({ timeout: 60_000 });
}

/** Naviga al diario attività (sessione emulator da login dev). */
export async function gotoAttivitaList(page) {
  await page.goto(ATTIVITA_LIST_PATH);
  await waitForAttivitaListLoaded(page);
}

/** Attende caricamento lista movimenti magazzino (Firestore + render tabella). */
export async function waitForMovimentiListLoaded(page) {
  await page.waitForURL(/movimenti-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Movimenti Magazzino' }).waitFor({ timeout: 60_000 });

  await page.waitForFunction(() => {
    const container = document.getElementById('movimenti-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento movimenti/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.movimenti-table tbody tr').length >= 10;
  }, { timeout: 60_000 });

  await page.locator('#movimenti-container .movimenti-table tbody tr').first().waitFor({
    timeout: 60_000,
  });
}

/** Naviga alla lista movimenti magazzino (sessione emulator da login dev). */
export async function gotoMovimentiList(page) {
  await page.goto(MOVIMENTI_LIST_PATH);
  await waitForMovimentiListLoaded(page);
}

async function waitForVignetoTableLoaded(page, { h1Text, minRows, tbodySelector }) {
  await page.locator('h1').filter({ hasText: h1Text }).waitFor({ timeout: 60_000 });

  await page.waitForFunction(
    ({ min, tbodySel }) => {
      const wrap = document.getElementById('table-wrap');
      if (!wrap || wrap.style.display === 'none') return false;
      const loading = document.getElementById('loading');
      if (loading && loading.style.display !== 'none' && /Caricamento/i.test(loading.textContent || '')) {
        return false;
      }
      return document.querySelectorAll(tbodySel).length >= min;
    },
    { min: minRows, tbodySel: tbodySelector },
    { timeout: 60_000 }
  );

  await page.locator(tbodySelector).first().waitFor({ timeout: 60_000 });
}

/** Attende caricamento lista potature vigneto. */
export async function waitForPotaturaListLoaded(page) {
  await page.waitForURL(/potatura-standalone\.html/, { timeout: 60_000 });
  await waitForVignetoTableLoaded(page, {
    h1Text: 'Potatura Vigneto',
    minRows: 3,
    tbodySelector: '#table-wrap tbody tr',
  });
}

export async function gotoPotaturaList(page) {
  await page.goto(POTATURA_LIST_PATH);
  await waitForPotaturaListLoaded(page);
}

/** Attende caricamento lista trattamenti fitosanitari vigneto. */
export async function waitForTrattamentiListLoaded(page) {
  await page.waitForURL(/trattamenti-standalone\.html/, { timeout: 60_000 });
  await waitForVignetoTableLoaded(page, {
    h1Text: 'Trattamenti Vigneto',
    minRows: 6,
    tbodySelector: '#table-wrap tbody tr',
  });
}

export async function gotoTrattamentiList(page) {
  await page.goto(TRATTAMENTI_LIST_PATH);
  await waitForTrattamentiListLoaded(page);
}

/** Attende caricamento lista concimazioni vigneto. */
export async function waitForConcimazioniListLoaded(page) {
  await page.waitForURL(/concimazioni-standalone\.html/, { timeout: 60_000 });
  await waitForVignetoTableLoaded(page, {
    h1Text: 'Concimazioni Vigneto',
    minRows: 3,
    tbodySelector: '#table-wrap tbody tr',
  });
}

export async function gotoConcimazioniList(page) {
  await page.goto(CONCIMATIONS_LIST_PATH);
  await waitForConcimazioniListLoaded(page);
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
