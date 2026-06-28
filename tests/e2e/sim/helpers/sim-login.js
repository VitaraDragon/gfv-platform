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
export const TRATTORI_LIST_PATH =
  '/modules/macchine/views/trattori-list-standalone.html?emulator=1';
export const ATTREZZI_LIST_PATH =
  '/modules/macchine/views/attrezzi-list-standalone.html?emulator=1';
export const FLOTTA_LIST_PATH =
  '/modules/macchine/views/flotta-list-standalone.html?emulator=1';
export const PRODOTTI_LIST_PATH =
  '/modules/magazzino/views/prodotti-standalone.html?emulator=1';
export const VIGNETI_LIST_PATH =
  '/modules/vigneto/views/vigneti-standalone.html?emulator=1';
export const GESTIONE_LAVORI_PATH =
  '/core/admin/gestione-lavori-standalone.html?emulator=1';
export const VALIDAZIONE_ORE_PATH =
  '/core/admin/validazione-ore-standalone.html?emulator=1';
export const MACCHINE_DASHBOARD_PATH =
  '/modules/macchine/views/macchine-dashboard-standalone.html?emulator=1';
export const GUASTI_LIST_PATH =
  '/modules/macchine/views/guasti-list-standalone.html?emulator=1';
export const MAGAZZINO_HOME_PATH =
  '/modules/magazzino/views/magazzino-home-standalone.html?emulator=1';
export const TRACCIABILITA_CONSUMI_PATH =
  '/modules/magazzino/views/tracciabilita-consumi-standalone.html?emulator=1';
export const VIGNETO_DASHBOARD_PATH =
  '/modules/vigneto/views/vigneto-dashboard-standalone.html?emulator=1';
export const CONTO_TERZI_HOME_PATH =
  '/modules/conto-terzi/views/conto-terzi-home-standalone.html?emulator=1';
export const MAPPA_CLIENTI_PATH =
  '/modules/conto-terzi/views/mappa-clienti-standalone.html?emulator=1';
export const MANODOPERA_HOME_PATH =
  '/modules/manodopera/views/manodopera-home-standalone.html?emulator=1';
export const GESTIONE_OPERAI_PATH =
  '/core/admin/gestione-operai-standalone.html?emulator=1';
export const GESTIONE_SQUADRE_PATH =
  '/core/admin/gestione-squadre-standalone.html?emulator=1';
export const STATISTICHE_MANODOPERA_PATH =
  '/core/admin/statistiche-manodopera-standalone.html?emulator=1';
export const LAVORI_CAPOSQUADRA_PATH =
  '/core/admin/lavori-caposquadra-standalone.html?emulator=1';

const SEED_VERSION = 2;

/**
 * Sceglie entry manifest per login E2E (ordinamento createdAt desc).
 * @param {import('@playwright/test').Page} page
 * @param {{
 *   templateIncludes?: string,
 *   preferTemplateId?: string,
 *   preferSeedComplete?: boolean,
 *   requirePersonas?: boolean,
 *   excludeRegimeMax?: boolean,
 * }} [options]
 */
export async function pickManifestEntry(page, options = {}) {
  const {
    templateIncludes,
    preferTemplateId,
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
  if (preferTemplateId) {
    const exact = filtered.filter((e) => e.templateId === preferTemplateId);
    if (exact.length) filtered = exact;
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
    preferTemplateId: 'viticola-conto-terzi-manodopera',
  });
}

/** Login manager su tenant con manodopera (gestione lavori / validazione ore). */
export async function loginAsManagerManodopera(page, options = {}) {
  return loginAsManagerFromDevPage(page, {
    ...options,
    templateIncludes: 'manodopera',
    preferTemplateId: 'viticola-conto-terzi-manodopera',
  });
}

async function waitForMezziTableLoaded(page, { urlPattern, h1Fragment, minRows }) {
  await page.waitForURL(urlPattern, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: h1Fragment }).waitFor({ timeout: 60_000 });

  await page.waitForFunction(
    (min) => {
      const container = document.getElementById('table-container');
      if (!container) return false;
      if (container.querySelector('.loading')) return false;
      if (/Caricamento/i.test(container.textContent || '')) return false;
      return container.querySelectorAll('.mezzi-table tbody tr').length >= min;
    },
    minRows,
    { timeout: 60_000 }
  );

  await page.locator('#table-container .mezzi-table tbody tr').first().waitFor({
    timeout: 60_000,
  });
}

export async function waitForTrattoriListLoaded(page) {
  await waitForMezziTableLoaded(page, {
    urlPattern: /trattori-list-standalone\.html/,
    h1Fragment: 'Trattori',
    minRows: 1,
  });
}

export async function gotoTrattoriList(page) {
  await page.goto(TRATTORI_LIST_PATH);
  await waitForTrattoriListLoaded(page);
}

export async function waitForAttrezziListLoaded(page) {
  await waitForMezziTableLoaded(page, {
    urlPattern: /attrezzi-list-standalone\.html/,
    h1Fragment: 'Attrezzature',
    minRows: 3,
  });
}

export async function gotoAttrezziList(page) {
  await page.goto(ATTREZZI_LIST_PATH);
  await waitForAttrezziListLoaded(page);
}

export async function waitForFlottaListLoaded(page) {
  await waitForMezziTableLoaded(page, {
    urlPattern: /flotta-list-standalone\.html/,
    h1Fragment: 'Flotta Aziendale',
    minRows: 4,
  });
}

export async function gotoFlottaList(page) {
  await page.goto(FLOTTA_LIST_PATH);
  await waitForFlottaListLoaded(page);
}

export async function waitForProdottiListLoaded(page) {
  await page.waitForURL(/prodotti-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Anagrafica Prodotti' }).waitFor({ timeout: 60_000 });

  await page.waitForFunction(() => {
    const container = document.getElementById('prodotti-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento prodotti/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.prodotti-table tbody tr').length >= 5;
  }, { timeout: 60_000 });

  await page.locator('#prodotti-container .prodotti-table tbody tr').first().waitFor({
    timeout: 60_000,
  });
}

export async function gotoProdottiList(page) {
  await page.goto(PRODOTTI_LIST_PATH);
  await waitForProdottiListLoaded(page);
}

export async function waitForVignetiListLoaded(page) {
  await page.waitForURL(/vigneti-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Anagrafica Vigneti' }).waitFor({ timeout: 60_000 });

  await page.waitForFunction(() => {
    const loading = document.getElementById('loading');
    if (loading && loading.style.display !== 'none' && /Caricamento vigneti/i.test(loading.textContent || '')) {
      return false;
    }
    const table = document.getElementById('vigneti-table');
    if (!table || table.style.display === 'none') return false;
    return document.querySelectorAll('#vigneti-tbody tr').length >= 4;
  }, { timeout: 60_000 });

  await page.locator('#vigneti-tbody tr').first().waitFor({ timeout: 60_000 });
}

export async function gotoVignetiList(page) {
  await page.goto(VIGNETI_LIST_PATH);
  await waitForVignetiListLoaded(page);
}

export async function waitForGestioneLavoriLoaded(page) {
  await page.waitForURL(/gestione-lavori-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Gestione Lavori' }).waitFor({ timeout: 60_000 });

  await page.waitForFunction(() => {
    const container = document.getElementById('lavori-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento lavori/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.lavori-table tbody tr').length >= 3;
  }, { timeout: 90_000 });

  await page.locator('#lavori-container .lavori-table tbody tr').first().waitFor({
    timeout: 60_000,
  });
}

export async function gotoGestioneLavori(page) {
  await page.goto(GESTIONE_LAVORI_PATH);
  await waitForGestioneLavoriLoaded(page);
}

export async function waitForValidazioneOreLoaded(page) {
  await page.waitForURL(/validazione-ore-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Validazione Ore' }).waitFor({ timeout: 60_000 });

  await page.waitForFunction(() => {
    const container = document.getElementById('ore-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento ore/i.test(container.textContent || '')) return false;
    const stat = document.getElementById('stat-da-validare');
    const pending = stat ? parseInt(stat.textContent, 10) : 0;
    return pending >= 2 && container.querySelectorAll('.ore-table tbody tr').length >= 2;
  }, { timeout: 90_000 });
}

export async function gotoValidazioneOre(page) {
  await page.goto(VALIDAZIONE_ORE_PATH);
  await waitForValidazioneOreLoaded(page);
}

export async function waitForMacchineDashboardLoaded(page) {
  await page.waitForURL(/macchine-dashboard-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Gestione Parco Macchine' }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('card-trattori-value');
    const t = el && (el.textContent || '').trim();
    return t && t !== '—' && t !== '-';
  }, { timeout: 60_000 });
}

export async function gotoMacchineDashboard(page) {
  await page.goto(MACCHINE_DASHBOARD_PATH);
  await waitForMacchineDashboardLoaded(page);
}

export async function waitForGuastiListLoaded(page) {
  await page.waitForURL(/guasti-list-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Officina' }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const container = document.getElementById('table-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.guasti-table tbody tr').length >= 2;
  }, { timeout: 60_000 });
  await page.locator('#table-container .guasti-table tbody tr').first().waitFor({
    timeout: 60_000,
  });
}

export async function gotoGuastiList(page) {
  await page.goto(GUASTI_LIST_PATH);
  await waitForGuastiListLoaded(page);
}

export async function waitForMagazzinoHomeLoaded(page) {
  await page.waitForURL(/magazzino-home-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Prodotti e Magazzino' }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('stat-prodotti');
    const t = el && (el.textContent || '').trim();
    return t && t !== '-';
  }, { timeout: 60_000 });
}

export async function gotoMagazzinoHome(page) {
  await page.goto(MAGAZZINO_HOME_PATH);
  await waitForMagazzinoHomeLoaded(page);
}

export async function waitForTracciabilitaConsumiLoaded(page) {
  await page.waitForURL(/tracciabilita-consumi-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Tracciabilità consumi' }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const container = document.getElementById('tabella-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento/i.test(container.textContent || '')) return false;
    if (container.querySelector('.empty-state')) return false;
    const countEl = document.getElementById('righe-count');
    const n = countEl ? parseInt(countEl.textContent, 10) : 0;
    return n >= 8;
  }, { timeout: 90_000 });
}

export async function gotoTracciabilitaConsumi(page) {
  await page.goto(TRACCIABILITA_CONSUMI_PATH);
  await waitForTracciabilitaConsumiLoaded(page);
}

export async function waitForVignetoDashboardLoaded(page) {
  await page.waitForURL(/vigneto-dashboard-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'VIGNETO' }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('stat-numero-vigneti');
    const t = el && (el.textContent || '').trim();
    return t && t !== '-';
  }, { timeout: 90_000 });
}

export async function gotoVignetoDashboard(page) {
  await page.goto(VIGNETO_DASHBOARD_PATH);
  await waitForVignetoDashboardLoaded(page);
}

export async function waitForContoTerziHomeLoaded(page) {
  await page.waitForURL(/conto-terzi-home-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'CONTO TERZI' }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('stat-clienti');
    const t = el && (el.textContent || '').trim();
    return t && t !== '-';
  }, { timeout: 60_000 });
}

export async function gotoContoTerziHome(page) {
  await page.goto(CONTO_TERZI_HOME_PATH);
  await waitForContoTerziHomeLoaded(page);
}

export async function waitForMappaClientiLoaded(page) {
  await page.waitForURL(/mappa-clienti-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Mappa Clienti' }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('select-cliente');
    return el && el.querySelectorAll('option:not([value=""])').length >= 2;
  }, { timeout: 90_000 });
}

export async function gotoMappaClienti(page) {
  await page.goto(MAPPA_CLIENTI_PATH);
  await waitForMappaClientiLoaded(page);
}

export async function waitForManodoperaHomeLoaded(page) {
  await page.waitForURL(/manodopera-home-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Manodopera' }).waitFor({ timeout: 60_000 });
  await page.getByRole('link', { name: /Gestione Lavori/i }).first().waitFor({ timeout: 60_000 });
}

export async function gotoManodoperaHome(page) {
  await page.goto(MANODOPERA_HOME_PATH);
  await waitForManodoperaHomeLoaded(page);
}

export async function waitForGestioneOperaiLoaded(page) {
  await page.waitForURL(/gestione-operai-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Gestione Operai' }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const container = document.getElementById('operai-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    return container.querySelectorAll('.operai-table tbody tr').length >= 3;
  }, { timeout: 90_000 });
}

export async function gotoGestioneOperai(page) {
  await page.goto(GESTIONE_OPERAI_PATH);
  await waitForGestioneOperaiLoaded(page);
}

export async function waitForGestioneSquadreLoaded(page) {
  await page.waitForURL(/gestione-squadre-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Gestione Squadre' }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const container = document.getElementById('squadre-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    return container.querySelectorAll('.squadre-table tbody tr').length >= 1;
  }, { timeout: 90_000 });
}

export async function gotoGestioneSquadre(page) {
  await page.goto(GESTIONE_SQUADRE_PATH);
  await waitForGestioneSquadreLoaded(page);
}

export async function waitForStatisticheManodoperaLoaded(page) {
  await page.waitForURL(/statistiche-manodopera-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'Statistiche Manodopera' }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('stat-lavori-totali');
    const t = el && (el.textContent || '').trim();
    return t && t !== '-';
  }, { timeout: 90_000 });
}

export async function gotoStatisticheManodopera(page) {
  await page.goto(STATISTICHE_MANODOPERA_PATH);
  await waitForStatisticheManodoperaLoaded(page);
}

export async function waitForLavoriCaposquadraLoaded(page) {
  await page.waitForURL(/lavori-caposquadra-standalone\.html/, { timeout: 60_000 });
  await page.locator('h1').filter({ hasText: 'I Miei Lavori' }).waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const container = document.getElementById('lavori-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento lavori/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.lavoro-card').length >= 1;
  }, { timeout: 90_000 });
}

export async function gotoLavoriCaposquadra(page) {
  await page.goto(LAVORI_CAPOSQUADRA_PATH);
  await waitForLavoriCaposquadraLoaded(page);
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
  const { waitForWorkspace = true } = options;

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
    preferTemplateId: 'viticola-conto-terzi-manodopera',
    preferSeedComplete: true,
    requirePersonas: true,
    excludeRegimeMax: true,
    ...options,
  });

  const card = page.locator('.card').filter({ hasText: entry.tenantId });
  if ((await card.count()) === 0) {
    throw new Error(`Card non trovata per tenant ${entry.tenantId}`);
  }

  const personaBtn = card.getByRole('button', { name: personaButtonPattern }).first();
  await Promise.all([
    page.waitForURL(/field-workspace-standalone\.html/, { timeout: 90_000 }),
    personaBtn.click(),
  ]);
  if (waitForWorkspace) {
    await waitForFieldWorkspaceLoaded(page);
  }
}

/** Login caposquadra mobile su tenant manodopera (scenario v4 #8). */
export async function loginAsCapoFromDevPage(page, options = {}) {
  return loginAsPersonaFromDevPage(page, /Capo \(mobile\)/, options);
}

/** Login operaio mobile su tenant manodopera (scenario v4 #8). */
export async function loginAsOperaioFromDevPage(page, options = {}) {
  return loginAsPersonaFromDevPage(page, /Operaio \(mobile\)/, options);
}

/** Login capo + navigazione desktop I miei lavori (scenario 19). */
export async function loginAsCapoForLavoriDesktop(page, options = {}) {
  await loginAsPersonaFromDevPage(page, /Capo \(mobile\)/, {
    ...options,
    waitForWorkspace: false,
  });
  await gotoLavoriCaposquadra(page);
}
