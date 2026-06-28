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
export const CLIENTI_LIST_PATH =
  '/modules/conto-terzi/views/clienti-standalone.html?emulator=1';
export const TARIFFE_LIST_PATH =
  '/modules/conto-terzi/views/tariffe-standalone.html?emulator=1';
export const PREVENTIVI_LIST_PATH =
  '/modules/conto-terzi/views/preventivi-standalone.html?emulator=1';
export const TERRENI_CLIENTI_PATH =
  '/modules/conto-terzi/views/terreni-clienti-standalone.html?emulator=1';
export const FIELD_WORKSPACE_PATH =
  '/core/mobile/field-workspace-standalone.html?emulator=1';

const SEED_VERSION = 2;

/**
 * Sceglie entry manifest per login E2E (ordinamento createdAt desc).
 * @param {import('@playwright/test').Page} page
 * @param {{
 *   templateIncludes?: string,
 *   preferSeedComplete?: boolean,
 *   requirePersonas?: boolean,
 *   excludeRegimeMax?: boolean,
 * }} [options]
 */
export async function pickManifestEntry(page, options = {}) {
  const {
    templateIncludes,
    preferSeedComplete = true,
    requirePersonas = false,
    excludeRegimeMax = false,
  } = options;

  const entries = await page.evaluate(async () => {
    const res = await fetch('/simulator/manifest.json');
    if (!res.ok) throw new Error('manifest non trovato');
    return res.json();
  });

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('manifest vuoto — esegui npm run sim:run (con emulator attivo).');
  }

  let filtered = [...entries];
  if (templateIncludes) {
    filtered = filtered.filter((e) => (e.templateId || '').includes(templateIncludes));
    if (!filtered.length) {
      throw new Error(
        `Nessun tenant templateId matching "${templateIncludes}" — esegui npm run sim:run -- --template=viticola-conto-terzi-manodopera`
      );
    }
  }
  if (requirePersonas) {
    filtered = filtered.filter((e) => Array.isArray(e.personas) && e.personas.length > 1);
    if (!filtered.length) {
      throw new Error(
        'Nessun tenant con personas[] — esegui npm run sim:run -- --template=viticola-conto-terzi-manodopera'
      );
    }
  }
  if (excludeRegimeMax) {
    filtered = filtered.filter((e) => !(e.templateId || '').includes('regime-max'));
    if (!filtered.length) {
      throw new Error(
        'Solo tenant regime-max in manifest — preferire viticola-conto-terzi-manodopera (npm run sim:run -- --template=viticola-conto-terzi-manodopera)'
      );
    }
  }
  if (preferSeedComplete) {
    const seeded = filtered.filter((e) => (e.seedVersion || 0) >= SEED_VERSION);
    if (seeded.length) filtered = seeded;
  }

  filtered.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  return filtered[0];
}

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

/** Attende caricamento lista clienti conto terzi. */
export async function waitForClientiListLoaded(page) {
  await page.waitForURL(/clienti-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Anagrafica Clienti' }).waitFor({ timeout: 60_000 });

  await page.waitForFunction(() => {
    const container = document.getElementById('clienti-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento clienti/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.clienti-table tbody tr').length >= 3;
  }, { timeout: 60_000 });

  await page.locator('#clienti-container .clienti-table tbody tr').first().waitFor({
    timeout: 60_000,
  });
}

export async function gotoClientiList(page) {
  await page.goto(CLIENTI_LIST_PATH);
  await waitForClientiListLoaded(page);
}

/** Attende caricamento lista tariffe conto terzi. */
export async function waitForTariffeListLoaded(page) {
  await page.waitForURL(/tariffe-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Gestione Tariffe' }).waitFor({ timeout: 60_000 });

  await page.waitForFunction(() => {
    const container = document.getElementById('tariffe-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento tariffe/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.tariffe-table tbody tr').length >= 8;
  }, { timeout: 60_000 });

  await page.locator('#tariffe-container .tariffe-table tbody tr').first().waitFor({
    timeout: 60_000,
  });
}

export async function gotoTariffeList(page) {
  await page.goto(TARIFFE_LIST_PATH);
  await waitForTariffeListLoaded(page);
}

/** Attende caricamento lista preventivi conto terzi. */
export async function waitForPreventiviListLoaded(page) {
  await page.waitForURL(/preventivi-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Preventivi' }).waitFor({ timeout: 60_000 });

  await page.waitForFunction(() => {
    const container = document.getElementById('preventivi-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento preventivi/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.preventivi-table tbody tr').length >= 5;
  }, { timeout: 60_000 });

  await page.locator('#preventivi-container .preventivi-table tbody tr').first().waitFor({
    timeout: 60_000,
  });
}

export async function gotoPreventiviList(page) {
  await page.goto(PREVENTIVI_LIST_PATH);
  await waitForPreventiviListLoaded(page);
}

/** Attende caricamento terreni clienti dopo selezione cliente nel filtro. */
export async function waitForTerreniClientiLoaded(page, { minCards = 1 } = {}) {
  await page.waitForURL(/terreni-clienti-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Terreni Clienti' }).waitFor({ timeout: 60_000 });

  await page.waitForFunction(
    (min) => document.querySelectorAll('#terreni-container .terreno-card').length >= min,
    minCards,
    { timeout: 60_000 }
  );

  await page.locator('#terreni-container .terreno-card').first().waitFor({ timeout: 60_000 });
}

/** Naviga a terreni clienti e seleziona il primo cliente nel filtro. */
export async function gotoTerreniClientiList(page) {
  await page.goto(TERRENI_CLIENTI_PATH);
  await page.waitForURL(/terreni-clienti-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Terreni Clienti' }).waitFor({ timeout: 60_000 });

  await page.waitForFunction(() => {
    const select = document.getElementById('filter-cliente');
    return select && select.options.length > 1;
  }, { timeout: 60_000 });

  const select = page.locator('#filter-cliente');
  const firstClienteValue = await select.locator('option').nth(1).getAttribute('value');
  await select.selectOption(firstClienteValue || { index: 1 });
  await waitForTerreniClientiLoaded(page);
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
 * Apre la pagina dev, sceglie tenant da manifest, Entra come manager.
 * @param {import('@playwright/test').Page} page
 * @param {{ preferSeedComplete?: boolean, templateIncludes?: string }} [options]
 *   templateIncludes — es. `conto-terzi` per scenario #7; manodopera in #8
 */
export async function loginAsManagerFromDevPage(page, options = {}) {
  const { preferSeedComplete = true, templateIncludes } = options;

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

  const entry = await pickManifestEntry(page, { templateIncludes, preferSeedComplete });
  const card = page.locator('.card').filter({ hasText: entry.tenantId });
  if ((await card.count()) === 0) {
    throw new Error(`Card non trovata per tenant ${entry.tenantId}`);
  }

  await card.getByRole('button', { name: 'Entra come manager' }).click();
  await page.waitForURL(/dashboard-standalone\.html/, { timeout: 60_000 });
  await waitForDashboardDeadlinesLoaded(page);
}

/** Login manager su tenant template viticola-conto-terzi* (scenario v4 #7). */
export async function loginAsManagerContoTerzi(page, options = {}) {
  return loginAsManagerFromDevPage(page, {
    ...options,
    templateIncludes: 'conto-terzi',
  });
}

/** Attende caricamento field workspace mobile (Firestore + lavori assegnati). */
export async function waitForFieldWorkspaceLoaded(page) {
  await page.waitForURL(/field-workspace-standalone\.html/, { timeout: 60_000 });
  await page.locator('#field-swiper').waitFor({ state: 'visible', timeout: 60_000 });

  await page.waitForFunction(() => {
    const status = document.getElementById('field-mobile-status');
    if (!status) return false;
    const text = (status.textContent || '').trim();
    if (!text || /Inizializzazione/i.test(text) || /Caricamento workspace/i.test(text)) {
      return false;
    }
    return !/login/i.test(text);
  }, { timeout: 60_000 });

  await page.waitForFunction(() => {
    const select = document.getElementById('selected-work');
    if (!select) return false;
    return Array.from(select.options).filter((o) => o.value).length >= 1;
  }, { timeout: 60_000 });

  await page.waitForFunction(() => {
    const toolbar = document.getElementById('field-toolbar-user');
    const name = document.getElementById('field-toolbar-user-name');
    if (!toolbar || toolbar.hidden) return false;
    return !!(name && (name.textContent || '').trim());
  }, { timeout: 60_000 });
}

/** Naviga al field workspace (sessione emulator già attiva). */
export async function gotoFieldWorkspace(page) {
  await page.goto(FIELD_WORKSPACE_PATH);
  await waitForFieldWorkspaceLoaded(page);
}

async function loginAsPersonaFromDevPage(page, personaButtonPattern, options = {}) {
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

  const entry = await pickManifestEntry(page, {
    templateIncludes: 'manodopera',
    preferSeedComplete: true,
    requirePersonas: true,
    excludeRegimeMax: true,
    ...options,
  });

  const card = page.locator('.card').filter({ hasText: entry.tenantId });
  if ((await card.count()) === 0) {
    throw new Error(`Card non trovata per tenant ${entry.tenantId}`);
  }

  await card.getByRole('button', { name: personaButtonPattern }).first().click();
  await waitForFieldWorkspaceLoaded(page);
}

/** Login caposquadra mobile su tenant manodopera (scenario v4 #8). */
export async function loginAsCapoFromDevPage(page, options = {}) {
  return loginAsPersonaFromDevPage(page, /Capo \(mobile\)/, options);
}

/** Login operaio mobile su tenant manodopera (scenario v4 #8). */
export async function loginAsOperaioFromDevPage(page, options = {}) {
  return loginAsPersonaFromDevPage(page, /Operaio \(mobile\)/, options);
}
