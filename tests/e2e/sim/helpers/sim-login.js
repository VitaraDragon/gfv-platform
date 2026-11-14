/**
 * Login emulator via pagina dev sim — stesso flusso di simulator-dev-standalone.html.
 * @module tests/e2e/sim/helpers/sim-login
 */

import { simE2eTimeout } from './sim-e2e-timeouts.mjs';
import {
  armLoginDiretto,
  gotoDirect,
  loginDiretto,
  loginPayloadFromEntry,
  personaByRole,
} from './login-diretto.js';

export const DASHBOARD_PATH = '/core/dashboard-standalone.html?emulator=1';

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
export const GESTISCI_UTENTI_PATH =
  '/core/admin/gestisci-utenti-standalone.html?emulator=1';
export const IMPOSTAZIONI_PATH = '/core/admin/impostazioni-standalone.html?emulator=1';
export const GESTIONE_LAVORI_PATH =
  '/core/admin/gestione-lavori-standalone.html?emulator=1';
export const VALIDAZIONE_ORE_PATH =
  '/core/admin/validazione-ore-standalone.html?emulator=1';
export const MACCHINE_DASHBOARD_PATH =
  '/modules/macchine/views/macchine-dashboard-standalone.html?emulator=1';
export const GUASTI_LIST_PATH =
  '/modules/macchine/views/guasti-list-standalone.html?emulator=1';
export const SEGNALAZIONE_GUASTI_PATH =
  '/core/admin/segnalazione-guasti-standalone.html?emulator=1';
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
export const MAPPA_AZIENDALE_PATH = '/core/mappa-aziendale-standalone.html?emulator=1';
export const STATISTICHE_CORE_PATH = '/core/statistiche-standalone.html?emulator=1';
export const VIGNETO_STATISTICHE_PATH =
  '/modules/vigneto/views/vigneto-statistiche-standalone.html?emulator=1';
export const GESTIONE_MACCHINE_PATH =
  '/core/admin/gestione-macchine-standalone.html?emulator=1';
export const GESTIONE_GUASTI_ADMIN_PATH =
  '/core/admin/gestione-guasti-standalone.html?emulator=1';
export const NUOVO_PREVENTIVO_PATH =
  '/modules/conto-terzi/views/nuovo-preventivo-standalone.html?emulator=1';
export const COMPENSI_OPERAI_PATH =
  '/core/admin/compensi-operai-standalone.html?emulator=1';
export const SEGNATURA_ORE_PATH = '/core/segnatura-ore-standalone.html?emulator=1';
export const STATISTICHE_LAVORATORE_PATH =
  '/core/mobile/statistiche-lavoratore-standalone.html?emulator=1';
export const VENDEMMIA_PATH =
  '/modules/vigneto/views/vendemmia-standalone.html?emulator=1';
export const CALCOLO_MATERIALI_PATH =
  '/modules/vigneto/views/calcolo-materiali-standalone.html?emulator=1';
export const PIANIFICA_IMPIANTO_PATH =
  '/modules/vigneto/views/pianifica-impianto-standalone.html?emulator=1';
export const FRUTTETO_DASHBOARD_PATH =
  '/modules/frutteto/views/frutteto-dashboard-standalone.html?emulator=1';
export const FRUTTETI_LIST_PATH =
  '/modules/frutteto/views/frutteti-standalone.html?emulator=1';
export const FRUTTETO_POTATURA_LIST_PATH =
  '/modules/frutteto/views/potatura-standalone.html?emulator=1';
export const FRUTTETO_TRATTAMENTI_LIST_PATH =
  '/modules/frutteto/views/trattamenti-standalone.html?emulator=1';
export const FRUTTETO_CONCIMATIONS_LIST_PATH =
  '/modules/frutteto/views/concimazioni-standalone.html?emulator=1';
export const RACCOLTA_FRUTTA_PATH =
  '/modules/frutteto/views/raccolta-frutta-standalone.html?emulator=1';

const SEED_VERSION = 2;

/** Tenant predefinito E2E viticola (CI triple-seed: evita pick del frutteto/misto più recente). */
export const DEFAULT_VITICOLA_E2E_TEMPLATE = 'viticola-conto-terzi-manodopera';
export const DEFAULT_FRUTTETO_E2E_TEMPLATE = 'frutteto-solo-titolare';
export const DEFAULT_MISTA_E2E_TEMPLATE = 'mista-viticola-frutteto-conto-terzi-manodopera';

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

  const res = await page.request.get('/simulator/manifest.json');
  if (!res.ok()) throw new Error(`manifest non trovato (${res.status()})`);
  const entries = await res.json();

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
  await page.waitForURL(/scadenze-list-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Scadenze' }).waitFor({ timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(() => {
    const container = document.getElementById('table-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (container.querySelector('.scadenze-table tbody tr')) return true;
    const empty = container.querySelector('.empty-state');
    return empty && !/Caricamento/i.test(empty.textContent || '');
  }, { timeout: simE2eTimeout(60_000) });

  await page.locator('.scadenze-table .status-dot').first().waitFor({ timeout: simE2eTimeout(60_000) });
}

/** Naviga alla lista scadenze parco (sessione emulator da login dev). */
export async function gotoScadenzeList(page) {
  await gotoDirect(page, SCADENZE_LIST_PATH);
  await waitForScadenzeListLoaded(page);
}

/** Attende caricamento lista terreni (Firestore + render tabella). */
export async function waitForTerreniListLoaded(page) {
  await page.waitForURL(/terreni-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Terreni' }).waitFor({ timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(() => {
    const container = document.getElementById('terreni-container');
    if (!container) return false;
    if (/Caricamento terreni/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.terreno-row').length >= 4;
  }, { timeout: simE2eTimeout(60_000) });

  await page.locator('#terreni-container .alert-dot').first().waitFor({ timeout: simE2eTimeout(60_000) });
}

/** Naviga alla lista terreni (sessione emulator da login dev). */
export async function gotoTerreniList(page) {
  await gotoDirect(page, TERRENI_LIST_PATH);
  await waitForTerreniListLoaded(page);
}

/** Attende caricamento diario attività (Firestore + render tabella). */
export async function waitForAttivitaListLoaded(page) {
  await page.waitForURL(/attivita-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Diario Attività' }).waitFor({ timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(() => {
    const container = document.getElementById('attivita-container');
    if (!container || container.style.display === 'none') return false;
    if (/Caricamento attività/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.attivita-row').length >= 15;
  }, { timeout: simE2eTimeout(60_000) });

  await page.locator('#attivita-container .attivita-row').first().waitFor({ timeout: simE2eTimeout(60_000) });
}

/** Naviga al diario attività (sessione emulator da login dev). */
export async function gotoAttivitaList(page) {
  await gotoDirect(page, ATTIVITA_LIST_PATH);
  await waitForAttivitaListLoaded(page);
}

/** Attende caricamento lista movimenti magazzino (Firestore + render tabella). */
export async function waitForMovimentiListLoaded(page) {
  await page.waitForURL(/movimenti-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Movimenti Magazzino' }).waitFor({ timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(() => {
    const container = document.getElementById('movimenti-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento movimenti/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.movimenti-table tbody tr').length >= 10;
  }, { timeout: simE2eTimeout(60_000) });

  await page.locator('#movimenti-container .movimenti-table tbody tr').first().waitFor({
    timeout: simE2eTimeout(60_000),
  });
}

/** Naviga alla lista movimenti magazzino (sessione emulator da login dev). */
export async function gotoMovimentiList(page) {
  await gotoDirect(page, MOVIMENTI_LIST_PATH);
  await waitForMovimentiListLoaded(page);
}

async function waitForVignetoTableLoaded(page, { h1Text, minRows, tbodySelector }) {
  await page.locator('h1').filter({ hasText: h1Text }).waitFor({ timeout: simE2eTimeout(60_000) });

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
    { timeout: simE2eTimeout(60_000) }
  );

  await page.locator(tbodySelector).first().waitFor({ timeout: simE2eTimeout(60_000) });
}

/** Attende caricamento lista potature vigneto. */
export async function waitForPotaturaListLoaded(page) {
  await page.waitForURL(/potatura-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await waitForVignetoTableLoaded(page, {
    h1Text: 'Potatura Vigneto',
    minRows: 3,
    tbodySelector: '#table-wrap tbody tr',
  });
}

export async function gotoPotaturaList(page) {
  await gotoDirect(page, POTATURA_LIST_PATH);
  await waitForPotaturaListLoaded(page);
}

/** Attende caricamento lista trattamenti fitosanitari vigneto. */
export async function waitForTrattamentiListLoaded(page) {
  await page.waitForURL(/trattamenti-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await waitForVignetoTableLoaded(page, {
    h1Text: 'Trattamenti Vigneto',
    minRows: 6,
    tbodySelector: '#table-wrap tbody tr',
  });
}

export async function gotoTrattamentiList(page) {
  await gotoDirect(page, TRATTAMENTI_LIST_PATH);
  await waitForTrattamentiListLoaded(page);
}

/** Attende caricamento lista concimazioni vigneto. */
export async function waitForConcimazioniListLoaded(page) {
  await page.waitForURL(/concimazioni-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await waitForVignetoTableLoaded(page, {
    h1Text: 'Concimazioni Vigneto',
    minRows: 3,
    tbodySelector: '#table-wrap tbody tr',
  });
}

export async function gotoConcimazioniList(page) {
  await gotoDirect(page, CONCIMATIONS_LIST_PATH);
  await waitForConcimazioniListLoaded(page);
}

/** Attende caricamento lista clienti conto terzi. */
export async function waitForClientiListLoaded(page) {
  await page.waitForURL(/clienti-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Anagrafica Clienti' }).waitFor({ timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(() => {
    const container = document.getElementById('clienti-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento clienti/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.clienti-table tbody tr').length >= 3;
  }, { timeout: simE2eTimeout(60_000) });

  await page.locator('#clienti-container .clienti-table tbody tr').first().waitFor({
    timeout: simE2eTimeout(60_000),
  });
}

export async function gotoClientiList(page) {
  await gotoDirect(page, CLIENTI_LIST_PATH);
  await waitForClientiListLoaded(page);
}

/** Attende caricamento lista tariffe conto terzi. */
export async function waitForTariffeListLoaded(page) {
  await page.waitForURL(/tariffe-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Gestione Tariffe' }).waitFor({ timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(() => {
    const container = document.getElementById('tariffe-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento tariffe/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.tariffe-table tbody tr').length >= 8;
  }, { timeout: simE2eTimeout(60_000) });

  await page.locator('#tariffe-container .tariffe-table tbody tr').first().waitFor({
    timeout: simE2eTimeout(60_000),
  });
}

export async function gotoTariffeList(page) {
  await gotoDirect(page, TARIFFE_LIST_PATH);
  await waitForTariffeListLoaded(page);
}

/** Attende caricamento lista preventivi conto terzi. */
export async function waitForPreventiviListLoaded(page) {
  await page.waitForURL(/preventivi-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Preventivi' }).waitFor({ timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(() => {
    const container = document.getElementById('preventivi-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento preventivi/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.preventivi-table tbody tr').length >= 5;
  }, { timeout: simE2eTimeout(60_000) });

  await page.locator('#preventivi-container .preventivi-table tbody tr').first().waitFor({
    timeout: simE2eTimeout(60_000),
  });
}

export async function gotoPreventiviList(page) {
  await gotoDirect(page, PREVENTIVI_LIST_PATH);
  await waitForPreventiviListLoaded(page);
}

/** Attende caricamento terreni clienti dopo selezione cliente nel filtro. */
export async function waitForTerreniClientiLoaded(page, { minCards = 1 } = {}) {
  await page.waitForURL(/terreni-clienti-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Terreni Clienti' }).waitFor({ timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(
    (min) => document.querySelectorAll('#terreni-container .terreno-card').length >= min,
    minCards,
    { timeout: simE2eTimeout(60_000) }
  );

  await page.locator('#terreni-container .terreno-card').first().waitFor({ timeout: simE2eTimeout(60_000) });
}

/** Naviga a terreni clienti e seleziona il primo cliente nel filtro. */
export async function gotoTerreniClientiList(page) {
  await gotoDirect(page, TERRENI_CLIENTI_PATH);
  await page.waitForURL(/terreni-clienti-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Terreni Clienti' }).waitFor({ timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(() => {
    const select = document.getElementById('filter-cliente');
    return select && select.options.length > 1;
  }, { timeout: simE2eTimeout(60_000) });

  const select = page.locator('#filter-cliente');
  const firstClienteValue = await select.locator('option').nth(1).getAttribute('value');
  await select.selectOption(firstClienteValue || { index: 1 });
  await waitForTerreniClientiLoaded(page);
}

/** Attende che i widget scadenze dashboard abbiano finito il caricamento Firestore. */
export async function waitForDashboardDeadlinesLoaded(page) {
  await page.locator('.dashboard-deadlines-row').waitFor({ state: 'visible', timeout: simE2eTimeout(60_000) });
  await page.getByRole('heading', { name: /Scadenze amministrazione/i }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.getByRole('heading', { name: /In arrivo/i }).waitFor({ timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(() => {
    const empty = document.getElementById('scadenze-amministrazione-empty');
    if (empty && !empty.hidden && /Caricamento/i.test(empty.textContent || '')) return false;
    return document.querySelectorAll('#scadenze-amministrazione-list .dashboard-deadline-row').length > 0;
  }, { timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(() => {
    const empty = document.getElementById('in-arrivo-empty');
    if (empty && !empty.hidden && /Caricamento/i.test(empty.textContent || '')) return false;
    return document.querySelectorAll('#in-arrivo-list .dashboard-deadline-row').length > 0;
  }, { timeout: simE2eTimeout(60_000) });
}

/**
 * Dopo il click di login: o si arriva alla pagina attesa, o #status.err e si fallisce subito.
 * @param {import('@playwright/test').Page} page
 * @param {RegExp} urlPattern
 * @param {number} [timeoutMs]
 */
function waitForLoginLeaveDevPage(page, urlPattern, timeoutMs) {
  const timeout = timeoutMs || simE2eTimeout(60_000);
  const urlWait = page.waitForURL(urlPattern, { timeout }).then(() => 'url');
  const errWait = page.locator('#status.err').waitFor({ state: 'visible', timeout }).then(() => 'err');
  return Promise.race([urlWait, errWait]).then(async (outcome) => {
    urlWait.catch(() => {});
    errWait.catch(() => {});
    if (outcome === 'err') {
      const msg = ((await page.locator('#status').textContent()) || '').trim();
      throw new Error(`Login non riuscito: ${msg || 'errore in #status'}`);
    }
  });
}

function managerPickOptions(options = {}) {
  const pickOptions = {
    preferSeedComplete: true,
    ...options,
  };
  delete pickOptions.viaDevPage;
  delete pickOptions.target;
  delete pickOptions.defer;
  if (!pickOptions.preferTemplateId && !pickOptions.templateIncludes) {
    pickOptions.preferTemplateId = DEFAULT_VITICOLA_E2E_TEMPLATE;
  }
  return pickOptions;
}

/** Login dalla pagina dev (smoke e dashboard-deadlines). */
async function loginAsManagerViaDevPage(page, options = {}) {
  const pickOptions = managerPickOptions(options);

  await page.goto(SIM_DEV_PATH);

  const emptyMsg = page.getByText('Nessuna azienda in manifest');
  const cardLocator = page.locator('.card');

  await Promise.race([
    cardLocator.first().waitFor({ state: 'visible', timeout: simE2eTimeout(45_000) }),
    emptyMsg.waitFor({ state: 'visible', timeout: simE2eTimeout(45_000) }),
  ]);

  if (await emptyMsg.isVisible()) {
    throw new Error('Nessuna azienda in manifest — esegui npm run sim:run (con emulator attivo).');
  }

  const entry = await pickManifestEntry(page, pickOptions);
  const card = page.locator('.card').filter({ hasText: entry.tenantId });
  if ((await card.count()) === 0) {
    throw new Error(`Card non trovata per tenant ${entry.tenantId}`);
  }

  const pendingDash = waitForLoginLeaveDevPage(page, /dashboard-standalone\.html/);
  await card.getByRole('button', { name: 'Entra come manager' }).click();
  await pendingDash;
  await waitForDashboardDeadlinesLoaded(page);
  return entry;
}

/**
 * Login manager. Di solito arma il login diretto: la goto successiva apre la pagina del test.
 * `viaDevPage` resta il percorso della pagina dev. `target` apre subito quella pagina.
 * @param {import('@playwright/test').Page} page
 * @param {{ preferSeedComplete?: boolean, templateIncludes?: string, preferTemplateId?: string, viaDevPage?: boolean, target?: string }} [options]
 */
export async function loginAsManagerFromDevPage(page, options = {}) {
  if (options.viaDevPage) return loginAsManagerViaDevPage(page, options);
  const entry = await pickManifestEntry(page, managerPickOptions(options));
  const payload = loginPayloadFromEntry(entry);
  if (options.target) {
    await loginDiretto(page, payload, options.target);
    if (/dashboard-standalone\.html/.test(options.target)) await waitForDashboardDeadlinesLoaded(page);
    return entry;
  }
  await armLoginDiretto(page, payload);
  return entry;
}

/** Login manager su tenant template viticola-conto-terzi* (scenario v4 #7). */
export async function loginAsManagerContoTerzi(page, options = {}) {
  return loginAsManagerFromDevPage(page, {
    ...options,
    templateIncludes: 'conto-terzi',
    preferTemplateId: DEFAULT_VITICOLA_E2E_TEMPLATE,
  });
}

/** Login manager su tenant con manodopera (gestione lavori / validazione ore). */
export async function loginAsManagerManodopera(page, options = {}) {
  const pickOptions = {
    preferTemplateId: DEFAULT_VITICOLA_E2E_TEMPLATE,
    ...options,
  };
  // Only filter by templateIncludes when no preferTemplateId is explicitly set
  // (e.g. from scenario.requiresSeedProfile); otherwise lab-trimestre-full would be filtered out
  if (!options.preferTemplateId) {
    pickOptions.templateIncludes = 'manodopera';
  }
  return loginAsManagerFromDevPage(page, pickOptions);
}

async function waitForMezziTableLoaded(page, { urlPattern, h1Fragment, minRows }) {
  await page.waitForURL(urlPattern, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: h1Fragment }).waitFor({ timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(
    (min) => {
      const container = document.getElementById('table-container');
      if (!container) return false;
      if (container.querySelector('.loading')) return false;
      if (/Caricamento/i.test(container.textContent || '')) return false;
      return container.querySelectorAll('.mezzi-table tbody tr').length >= min;
    },
    minRows,
    { timeout: simE2eTimeout(60_000) }
  );

  await page.locator('#table-container .mezzi-table tbody tr').first().waitFor({
    timeout: simE2eTimeout(60_000),
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
  await gotoDirect(page, TRATTORI_LIST_PATH);
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
  await gotoDirect(page, ATTREZZI_LIST_PATH);
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
  await gotoDirect(page, FLOTTA_LIST_PATH);
  await waitForFlottaListLoaded(page);
}

export async function waitForProdottiListLoaded(page) {
  await page.waitForURL(/prodotti-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Anagrafica Prodotti' }).waitFor({ timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(() => {
    const container = document.getElementById('prodotti-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento prodotti/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.prodotti-table tbody tr').length >= 5;
  }, { timeout: simE2eTimeout(60_000) });

  await page.locator('#prodotti-container .prodotti-table tbody tr').first().waitFor({
    timeout: simE2eTimeout(60_000),
  });
}

export async function gotoProdottiList(page) {
  await gotoDirect(page, PRODOTTI_LIST_PATH);
  await waitForProdottiListLoaded(page);
}

export async function waitForVignetiListLoaded(page, { minRows = 4 } = {}) {
  await page.waitForURL(/vigneti-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Anagrafica Vigneti' }).waitFor({ timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(
    (min) => {
      const loading = document.getElementById('loading');
      if (loading && loading.style.display !== 'none' && /Caricamento vigneti/i.test(loading.textContent || '')) {
        return false;
      }
      const table = document.getElementById('vigneti-table');
      if (!table || table.style.display === 'none') return false;
      return document.querySelectorAll('#vigneti-tbody tr').length >= min;
    },
    minRows,
    { timeout: simE2eTimeout(60_000) }
  );

  await page.locator('#vigneti-tbody tr').first().waitFor({ timeout: simE2eTimeout(60_000) });
}

export async function gotoVignetiList(page, options = {}) {
  await gotoDirect(page, VIGNETI_LIST_PATH);
  await waitForVignetiListLoaded(page, options);
}

export async function waitForGestioneLavoriLoaded(page) {
  await page.waitForURL(/gestione-lavori-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Gestione Lavori' }).waitFor({ timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(() => {
    const container = document.getElementById('lavori-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento lavori/i.test(container.textContent || '')) return false;
    if (container.querySelectorAll('.lavori-table tbody tr').length < 3) return false;
    const hasAssigneeCol = /Caposquadra/i.test(
      (container.querySelector('.lavori-table thead') && container.querySelector('.lavori-table thead').textContent) || ''
    );
    if (hasAssigneeCol && !container.querySelector('.caposquadra-name')) return false;
    return true;
  }, { timeout: 90_000 });

  await page.locator('#lavori-container .lavori-table tbody tr').first().waitFor({
    timeout: simE2eTimeout(60_000),
  });
}

export async function gotoGestioneLavori(page) {
  await gotoDirect(page, GESTIONE_LAVORI_PATH);
  await waitForGestioneLavoriLoaded(page);
}

export async function waitForValidazioneOreLoaded(page) {
  await page.waitForURL(/validazione-ore-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Validazione Ore' }).waitFor({ timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(() => {
    const container = document.getElementById('ore-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento ore/i.test(container.textContent || '')) return false;
    const stat = document.getElementById('stat-da-validare');
    if (!stat) return false;
    const raw = stat.getAttribute('data-righe');
    const pending = raw != null && raw !== ''
      ? parseInt(raw, 10)
      : parseInt(stat.textContent, 10);
    return pending >= 2 && container.querySelectorAll('.ore-table tbody tr').length >= 2;
  }, { timeout: 90_000 });
}

export async function gotoValidazioneOre(page) {
  await gotoDirect(page, VALIDAZIONE_ORE_PATH);
  await waitForValidazioneOreLoaded(page);
}

export async function waitForMacchineDashboardLoaded(page) {
  await page.waitForURL(/macchine-dashboard-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Gestione Parco Macchine' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const el = document.getElementById('card-trattori-value');
    const t = el && (el.textContent || '').trim();
    return t && t !== '—' && t !== '-';
  }, { timeout: simE2eTimeout(60_000) });
}

export async function gotoMacchineDashboard(page) {
  await gotoDirect(page, MACCHINE_DASHBOARD_PATH);
  await waitForMacchineDashboardLoaded(page);
}

export async function waitForGuastiListLoaded(page) {
  await page.waitForURL(/guasti-list-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Officina' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const container = document.getElementById('table-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.guasti-table tbody tr').length >= 2;
  }, { timeout: simE2eTimeout(60_000) });
  await page.locator('#table-container .guasti-table tbody tr').first().waitFor({
    timeout: simE2eTimeout(60_000),
  });
}

export async function gotoGuastiList(page) {
  await gotoDirect(page, GUASTI_LIST_PATH);
  await waitForGuastiListLoaded(page);
}

export async function waitForSegnalazioneGuastiLoaded(page) {
  await page.waitForURL(/segnalazione-guasti-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Segnalazione Guasti' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.locator('#segnala-guasto-form #tipo-generico').waitFor({ state: 'visible', timeout: 90_000 });
  await page.waitForFunction(() => {
    const alertText = (document.getElementById('alert-container')?.textContent || '').trim();
    return !/solo per operai|solo con il modulo Parco Macchine attivo/i.test(alertText);
  }, { timeout: 90_000 });
}

export async function gotoSegnalazioneGuasti(page) {
  await gotoDirect(page, SEGNALAZIONE_GUASTI_PATH);
  await waitForSegnalazioneGuastiLoaded(page);
}

export async function waitForMagazzinoHomeLoaded(page) {
  await page.waitForURL(/magazzino-home-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Prodotti e Magazzino' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const el = document.getElementById('stat-prodotti');
    const t = el && (el.textContent || '').trim();
    return t && t !== '-';
  }, { timeout: simE2eTimeout(60_000) });
}

export async function gotoMagazzinoHome(page) {
  await gotoDirect(page, MAGAZZINO_HOME_PATH);
  await waitForMagazzinoHomeLoaded(page);
}

export async function waitForTracciabilitaConsumiLoaded(page) {
  await page.waitForURL(/tracciabilita-consumi-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Tracciabilità consumi' }).waitFor({ timeout: simE2eTimeout(60_000) });
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
  await gotoDirect(page, TRACCIABILITA_CONSUMI_PATH);
  await waitForTracciabilitaConsumiLoaded(page);
}

export async function waitForVignetoDashboardLoaded(page) {
  await page.waitForURL(/vigneto-dashboard-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'VIGNETO' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const el = document.getElementById('stat-numero-vigneti');
    const t = el && (el.textContent || '').trim();
    return t && t !== '-';
  }, { timeout: 90_000 });
}

export async function gotoVignetoDashboard(page) {
  await gotoDirect(page, VIGNETO_DASHBOARD_PATH);
  await waitForVignetoDashboardLoaded(page);
}

export async function waitForContoTerziHomeLoaded(page) {
  await page.waitForURL(/conto-terzi-home-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'CONTO TERZI' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const el = document.getElementById('stat-clienti');
    const t = el && (el.textContent || '').trim();
    return t && t !== '-';
  }, { timeout: simE2eTimeout(60_000) });
}

export async function gotoContoTerziHome(page) {
  await gotoDirect(page, CONTO_TERZI_HOME_PATH);
  await waitForContoTerziHomeLoaded(page);
}

export async function waitForMappaClientiLoaded(page) {
  await page.waitForURL(/mappa-clienti-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Mappa Clienti' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const el = document.getElementById('select-cliente');
    return el && el.querySelectorAll('option:not([value=""])').length >= 2;
  }, { timeout: 90_000 });
}

export async function gotoMappaClienti(page) {
  await gotoDirect(page, MAPPA_CLIENTI_PATH);
  await waitForMappaClientiLoaded(page);
}

export async function waitForManodoperaHomeLoaded(page) {
  await page.waitForURL(/manodopera-home-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Manodopera' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.getByRole('link', { name: /Gestione Lavori/i }).first().waitFor({ timeout: simE2eTimeout(60_000) });
}

export async function gotoManodoperaHome(page) {
  await gotoDirect(page, MANODOPERA_HOME_PATH);
  await waitForManodoperaHomeLoaded(page);
}

export async function waitForGestioneOperaiLoaded(page) {
  await page.waitForURL(/gestione-operai-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Gestione Operai' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const container = document.getElementById('operai-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    return container.querySelectorAll('.operai-table tbody tr').length >= 3;
  }, { timeout: 90_000 });
}

export async function gotoGestioneOperai(page) {
  await gotoDirect(page, GESTIONE_OPERAI_PATH);
  await waitForGestioneOperaiLoaded(page);
}

export async function waitForGestioneSquadreLoaded(page) {
  await page.waitForURL(/gestione-squadre-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Gestione Squadre' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const container = document.getElementById('squadre-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    return container.querySelectorAll('.squadre-table tbody tr').length >= 1;
  }, { timeout: 90_000 });
}

export async function gotoGestioneSquadre(page) {
  await gotoDirect(page, GESTIONE_SQUADRE_PATH);
  await waitForGestioneSquadreLoaded(page);
}

export async function waitForStatisticheManodoperaLoaded(page) {
  await page.waitForURL(/statistiche-manodopera-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Statistiche Manodopera' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const el = document.getElementById('stat-lavori-totali');
    const t = el && (el.textContent || '').trim();
    return t && t !== '-';
  }, { timeout: 90_000 });
}

export async function gotoStatisticheManodopera(page) {
  await gotoDirect(page, STATISTICHE_MANODOPERA_PATH);
  await waitForStatisticheManodoperaLoaded(page);
}

export async function waitForLavoriCaposquadraLoaded(page) {
  await page.waitForURL(/lavori-caposquadra-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'I Miei Lavori' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const container = document.getElementById('lavori-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    if (/Caricamento lavori/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.lavoro-card').length >= 1;
  }, { timeout: 90_000 });
}

export async function gotoLavoriCaposquadra(page) {
  await gotoDirect(page, LAVORI_CAPOSQUADRA_PATH);
  await waitForLavoriCaposquadraLoaded(page);
}

/** Attende caricamento field workspace mobile (Firestore + lavori assegnati). */
export async function waitForFieldWorkspaceLoaded(page) {
  await page.waitForURL(/field-workspace-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('#field-swiper').waitFor({ state: 'visible', timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(() => {
    const status = document.getElementById('field-mobile-status');
    if (!status) return false;
    const text = (status.textContent || '').trim();
    if (!text || /Inizializzazione/i.test(text) || /Caricamento workspace/i.test(text)) {
      return false;
    }
    return !/login/i.test(text);
  }, { timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(() => {
    const select = document.getElementById('selected-work');
    if (!select) return false;
    return Array.from(select.options).filter((o) => o.value).length >= 1;
  }, { timeout: simE2eTimeout(60_000) });

  await page.waitForFunction(() => {
    const toolbar = document.getElementById('field-toolbar-user');
    const name = document.getElementById('field-toolbar-user-name');
    if (!toolbar || toolbar.hidden) return false;
    return !!(name && (name.textContent || '').trim());
  }, { timeout: simE2eTimeout(60_000) });
}

/** Naviga al field workspace (sessione emulator già attiva). */
export async function gotoFieldWorkspace(page) {
  await gotoDirect(page, FIELD_WORKSPACE_PATH);
  await waitForFieldWorkspaceLoaded(page);
}

function personaPickOptions(options = {}) {
  const pickOptions = {
    templateIncludes: 'manodopera',
    preferTemplateId: 'viticola-conto-terzi-manodopera',
    preferSeedComplete: true,
    requirePersonas: true,
    excludeRegimeMax: true,
    ...options,
  };
  delete pickOptions.waitForWorkspace;
  delete pickOptions.viaDevPage;
  delete pickOptions.target;
  delete pickOptions.role;
  return pickOptions;
}

/** Login persona dalla pagina dev. */
async function loginAsPersonaViaDevPage(page, personaButtonPattern, options = {}) {
  const { waitForWorkspace = true } = options;

  await page.goto(SIM_DEV_PATH);

  const emptyMsg = page.getByText('Nessuna azienda in manifest');
  const cardLocator = page.locator('.card');

  await Promise.race([
    cardLocator.first().waitFor({ state: 'visible', timeout: simE2eTimeout(45_000) }),
    emptyMsg.waitFor({ state: 'visible', timeout: simE2eTimeout(45_000) }),
  ]);

  if (await emptyMsg.isVisible()) {
    throw new Error('Nessuna azienda in manifest — esegui npm run sim:run (con emulator attivo).');
  }

  const entry = await pickManifestEntry(page, personaPickOptions(options));

  const card = page.locator('.card').filter({ hasText: entry.tenantId });
  if ((await card.count()) === 0) {
    throw new Error(`Card non trovata per tenant ${entry.tenantId}`);
  }

  const personaBtn = card.getByRole('button', { name: personaButtonPattern }).first();
  const pendingPersona = waitForLoginLeaveDevPage(page, /field-workspace-standalone\.html/, 90_000);
  await personaBtn.click();
  await pendingPersona;
  if (waitForWorkspace) {
    await waitForFieldWorkspaceLoaded(page);
  }
  return entry;
}

async function loginAsPersonaFromDevPage(page, role, options = {}) {
  const { waitForWorkspace = true } = options;
  if (options.viaDevPage) {
    const pattern = role === 'caposquadra' ? /Capo \(mobile\)/ : /Operaio \(mobile\)/;
    return loginAsPersonaViaDevPage(page, pattern, options);
  }
  const entry = await pickManifestEntry(page, personaPickOptions(options));
  const payload = loginPayloadFromEntry(entry, personaByRole(entry, role));
  const dest = options.target || (waitForWorkspace ? FIELD_WORKSPACE_PATH : '');
  if (!dest) {
    await armLoginDiretto(page, payload);
    return entry;
  }
  await loginDiretto(page, payload, dest);
  if (waitForWorkspace && /field-workspace-standalone\.html/.test(dest)) {
    await waitForFieldWorkspaceLoaded(page);
  }
  return entry;
}

/** Login caposquadra mobile su tenant manodopera (scenario v4 #8). */
export async function loginAsCapoFromDevPage(page, options = {}) {
  return loginAsPersonaFromDevPage(page, 'caposquadra', options);
}

/** Login operaio mobile su tenant manodopera (scenario v4 #8). */
export async function loginAsOperaioFromDevPage(page, options = {}) {
  return loginAsPersonaFromDevPage(page, 'operaio', options);
}

/** Login capo + navigazione desktop I miei lavori (scenario 19). */
export async function loginAsCapoForLavoriDesktop(page, options = {}) {
  await loginAsPersonaFromDevPage(page, 'caposquadra', {
    ...options,
    waitForWorkspace: false,
  });
  await gotoLavoriCaposquadra(page);
}

export async function waitForMappaAziendaleLoaded(page) {
  await page.waitForURL(/mappa-aziendale-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Mappa aziendale' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const root = document.getElementById('mappa-page-root');
    if (!root) return false;
    if (root.querySelector('.loading') && !document.getElementById('mappa-aziendale-container')) {
      return false;
    }
    return !!document.getElementById('mappa-aziendale-container');
  }, { timeout: 90_000 });
}

export async function gotoMappaAziendale(page) {
  await gotoDirect(page, MAPPA_AZIENDALE_PATH);
  await waitForMappaAziendaleLoaded(page);
}

export async function waitForStatisticheCoreLoaded(page) {
  await page.waitForURL(/statistiche-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Statistiche e Dashboard' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const el = document.getElementById('metric-terreni');
    const t = el && (el.textContent || '').trim();
    return t && t !== '-' && parseInt(t, 10) >= 4;
  }, { timeout: 90_000 });
}

export async function gotoStatisticheCore(page) {
  await gotoDirect(page, STATISTICHE_CORE_PATH);
  await waitForStatisticheCoreLoaded(page);
}

export async function waitForVignetoStatisticheLoaded(page) {
  await page.waitForURL(/vigneto-statistiche-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'STATISTICHE VIGNETO' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const sel = document.getElementById('filtro-vigneto');
    return sel && sel.querySelectorAll('option:not([value=""])').length >= 1;
  }, { timeout: 90_000 });
}

export async function gotoVignetoStatistiche(page) {
  await gotoDirect(page, VIGNETO_STATISTICHE_PATH);
  await waitForVignetoStatisticheLoaded(page);
}

export async function waitForGestioneMacchineLoaded(page) {
  await page.waitForURL(/gestione-macchine-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Gestione Macchine' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const container = document.getElementById('macchine-container');
    if (!container) return false;
    if (container.querySelector('.loading')) return false;
    return container.querySelectorAll('.macchine-table tbody tr').length >= 8;
  }, { timeout: 90_000 });
}

export async function gotoGestioneMacchine(page) {
  await gotoDirect(page, GESTIONE_MACCHINE_PATH);
  await waitForGestioneMacchineLoaded(page);
}

export async function waitForGestioneGuastiAdminLoaded(page) {
  await page.waitForURL(/gestione-guasti-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Gestione Guasti' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const totali = document.getElementById('stat-totali');
    const t = (totali?.textContent || '').trim();
    if (!t || t === '-') return false;
    const n = parseInt(t, 10);
    if (!Number.isFinite(n) || n < 1) return false;
    const list = document.getElementById('guasti-list');
    if (!list || /Caricamento guasti/i.test(list.textContent || '')) return false;
    return true;
  }, { timeout: 90_000 });
}

export async function gotoGestioneGuastiAdmin(page) {
  await gotoDirect(page, GESTIONE_GUASTI_ADMIN_PATH);
  await waitForGestioneGuastiAdminLoaded(page);
  await page.evaluate(() => {
    if (typeof window.resetFilters === 'function') window.resetFilters();
  });
  await page.waitForFunction(() => {
    const list = document.getElementById('guasti-list');
    if (!list || /Caricamento guasti/i.test(list.textContent || '')) return false;
    const n = parseInt(document.getElementById('stat-totali')?.textContent || '0', 10);
    if (!Number.isFinite(n) || n < 1) return false;
    return list.querySelectorAll('.guasto-item').length >= 1 || list.querySelector('.empty-state') !== null;
  }, { timeout: 90_000 });
}

export async function waitForNuovoPreventivoLoaded(page) {
  await page.waitForURL(/nuovo-preventivo-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Nuovo Preventivo' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const cliente = document.getElementById('cliente-id');
    const categoria = document.getElementById('lavoro-categoria-principale');
    return (
      cliente &&
      cliente.querySelectorAll('option:not([value=""])').length >= 2 &&
      categoria &&
      categoria.querySelectorAll('option:not([value=""])').length >= 1
    );
  }, { timeout: 90_000 });
}

export async function gotoNuovoPreventivo(page) {
  await gotoDirect(page, NUOVO_PREVENTIVO_PATH);
  await waitForNuovoPreventivoLoaded(page);
}

export async function waitForCompensiOperaiLoaded(page) {
  await page.waitForURL(/compensi-operai-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Compensi Operai' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const tbody = document.getElementById('compensi-body');
    if (!tbody) return false;
    return !tbody.querySelector('.loading');
  }, { timeout: 90_000 });
}

export async function gotoCompensiOperai(page) {
  await gotoDirect(page, COMPENSI_OPERAI_PATH);
  await waitForCompensiOperaiLoaded(page);
}

export async function waitForSegnaturaOreLoaded(page) {
  await page.waitForURL(/segnatura-ore-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Segna Ore Lavorate' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const lavori = document.getElementById('lavori-container');
    const ore = document.getElementById('ore-container');
    if (!lavori || !ore) return false;
    if (lavori.querySelector('.loading') || ore.querySelector('.loading')) return false;
    const lavoriReady =
      lavori.querySelectorAll('.lavoro-card').length >= 1 ||
      lavori.querySelector('.empty-state') !== null ||
      lavori.querySelector('.lavori-list') !== null;
    const oreReady =
      ore.querySelector('.ore-table') !== null ||
      ore.querySelector('.empty-state') !== null;
    return lavoriReady && oreReady;
  }, { timeout: 90_000 });
}

export async function gotoSegnaturaOre(page) {
  await gotoDirect(page, SEGNATURA_ORE_PATH);
  await waitForSegnaturaOreLoaded(page);
}

export async function waitForStatisticheLavoratoreLoaded(page) {
  await page.waitForURL(/statistiche-lavoratore-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Le tue statistiche' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    if (document.getElementById('loading-el')) return false;
    const ore = document.getElementById('m-ore');
    return ore && (ore.textContent || '').trim() !== '—';
  }, { timeout: 90_000 });
}

export async function gotoStatisticheLavoratore(page) {
  await gotoDirect(page, STATISTICHE_LAVORATORE_PATH);
  await waitForStatisticheLavoratoreLoaded(page);
}

export async function waitForVendemmiaLoaded(page) {
  await page.waitForURL(/vendemmia-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Gestione Vendemmia' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const loading = document.getElementById('loading');
    if (loading && loading.offsetParent !== null) return false;
    const table = document.getElementById('vendemmie-table');
    const empty = document.getElementById('empty-state');
    return (
      (table && table.style.display !== 'none') ||
      (empty && empty.style.display !== 'none')
    );
  }, { timeout: 90_000 });
}

export async function gotoVendemmia(page) {
  await gotoDirect(page, VENDEMMIA_PATH);
  await waitForVendemmiaLoaded(page);
}

export async function waitForCalcoloMaterialiLoaded(page) {
  await page.waitForURL(/calcolo-materiali-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Calcolo Materiali Impianto' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const table = document.getElementById('table-pianificazioni');
    if (!table) return false;
    const cell = table.querySelector('tbody td');
    return cell && !/Caricamento pianificazioni/i.test(cell.textContent || '');
  }, { timeout: 90_000 });
}

export async function gotoCalcoloMateriali(page) {
  await gotoDirect(page, CALCOLO_MATERIALI_PATH);
  await waitForCalcoloMaterialiLoaded(page);
}

export async function waitForPianificaImpiantoLoaded(page) {
  await page.waitForURL(/pianifica-impianto-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('#headerTitolo').filter({ hasText: 'Pianificazione' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const sel = document.getElementById('terrenoSelect');
    return sel && sel.querySelectorAll('option:not([value=""])').length >= 1;
  }, { timeout: 90_000 });
}

export async function gotoPianificaImpianto(page) {
  await gotoDirect(page, PIANIFICA_IMPIANTO_PATH);
  await waitForPianificaImpiantoLoaded(page);
}

export async function waitForGestisciUtentiLoaded(page) {
  await page.waitForURL(/gestisci-utenti-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Gestisci Utenti' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const container = document.getElementById('users-container');
    if (!container) return false;
    if (/solo con il modulo Manodopera/i.test(container.textContent || '')) return false;
    return container.querySelectorAll('.users-table tbody tr').length >= 4;
  }, { timeout: 90_000 });
}

export async function gotoGestisciUtenti(page) {
  await gotoDirect(page, GESTISCI_UTENTI_PATH);
  await waitForGestisciUtentiLoaded(page);
}

export async function waitForImpostazioniLoaded(page) {
  await page.waitForURL(/impostazioni-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Impostazioni' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const nome = document.getElementById('account-nome');
    const cognome = document.getElementById('account-cognome');
    const email = document.getElementById('account-email');
    return (
      nome &&
      cognome &&
      email &&
      (nome.value || '').trim().length >= 2 &&
      (cognome.value || '').trim().length >= 2 &&
      (email.value || '').includes('@')
    );
  }, { timeout: 90_000 });
}

export async function gotoImpostazioni(page) {
  await gotoDirect(page, IMPOSTAZIONI_PATH);
  await waitForImpostazioniLoaded(page);
}

/** Login manager su tenant template frutteto-solo-titolare (M4). */
export async function loginAsManagerFrutteto(page, options = {}) {
  return loginAsManagerFromDevPage(page, {
    ...options,
    preferTemplateId: DEFAULT_FRUTTETO_E2E_TEMPLATE,
  });
}

/** Login manager su tenant misto viticola + frutteto + CT + manodopera (CI triple-seed). */
export async function loginAsManagerMisto(page, options = {}) {
  return loginAsManagerFromDevPage(page, {
    ...options,
    preferTemplateId: DEFAULT_MISTA_E2E_TEMPLATE,
  });
}

async function waitForFruttetoTableLoaded(page, { h1Text, minRows, tbodySelector }) {
  await page.locator('h1').filter({ hasText: h1Text }).waitFor({ timeout: simE2eTimeout(60_000) });
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
    { timeout: simE2eTimeout(60_000) }
  );
  await page.locator(tbodySelector).first().waitFor({ timeout: simE2eTimeout(60_000) });
}

export async function waitForFruttetoPotaturaListLoaded(page) {
  await page.waitForURL(/frutteto\/views\/potatura-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await waitForFruttetoTableLoaded(page, {
    h1Text: 'Potatura Frutteto',
    minRows: 3,
    tbodySelector: '#table-wrap tbody tr',
  });
}

export async function gotoFruttetoPotaturaList(page) {
  await gotoDirect(page, FRUTTETO_POTATURA_LIST_PATH);
  await waitForFruttetoPotaturaListLoaded(page);
}

export async function waitForFruttetoTrattamentiListLoaded(page) {
  await page.waitForURL(/frutteto\/views\/trattamenti-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await waitForFruttetoTableLoaded(page, {
    h1Text: 'Trattamenti Frutteto',
    minRows: 6,
    tbodySelector: '#tbody-trattamenti tr',
  });
}

export async function gotoFruttetoTrattamentiList(page) {
  await gotoDirect(page, FRUTTETO_TRATTAMENTI_LIST_PATH);
  await waitForFruttetoTrattamentiListLoaded(page);
}

export async function waitForFruttetoConcimazioniListLoaded(page) {
  await page.waitForURL(/frutteto\/views\/concimazioni-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await waitForFruttetoTableLoaded(page, {
    h1Text: 'Concimazioni Frutteto',
    minRows: 3,
    tbodySelector: '#table-wrap tbody tr',
  });
}

export async function gotoFruttetoConcimazioniList(page) {
  await gotoDirect(page, FRUTTETO_CONCIMATIONS_LIST_PATH);
  await waitForFruttetoConcimazioniListLoaded(page);
}

export async function waitForFruttetiListLoaded(page, { minRows = 4 } = {}) {
  await page.waitForURL(/frutteti-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Anagrafica Frutteti' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(
    (min) => {
      const table = document.getElementById('frutteti-table');
      const tbody = document.getElementById('frutteti-table-body');
      return table && table.style.display !== 'none' && tbody && tbody.querySelectorAll('tr').length >= min;
    },
    minRows,
    { timeout: simE2eTimeout(60_000) }
  );
}

export async function gotoFruttetiList(page, options = {}) {
  await gotoDirect(page, FRUTTETI_LIST_PATH);
  await waitForFruttetiListLoaded(page, options);
}

export async function waitForFruttetoDashboardLoaded(page) {
  await page.waitForURL(/frutteto-dashboard-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'FRUTTETO' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const el = document.getElementById('stat-numero-frutteti');
    const t = el && (el.textContent || '').trim();
    return t && t !== '-';
  }, { timeout: 90_000 });
}

export async function gotoFruttetoDashboard(page) {
  await gotoDirect(page, FRUTTETO_DASHBOARD_PATH);
  await waitForFruttetoDashboardLoaded(page);
}

export async function waitForRaccoltaFruttaListLoaded(page) {
  await page.waitForURL(/raccolta-frutta-standalone\.html/, { timeout: simE2eTimeout(60_000) });
  await page.locator('h1').filter({ hasText: 'Raccolta Frutta' }).waitFor({ timeout: simE2eTimeout(60_000) });
  await page.waitForFunction(() => {
    const container = document.getElementById('table-container-raccolte');
    const loading = document.getElementById('loading-raccolte');
    if (loading && loading.style.display !== 'none') return false;
    return container && container.style.display !== 'none'
      && document.querySelectorAll('#raccolte-table-body tr').length >= 1;
  }, { timeout: simE2eTimeout(60_000) });
}

export async function gotoRaccoltaFrutta(page) {
  await gotoDirect(page, RACCOLTA_FRUTTA_PATH);
  await waitForRaccoltaFruttaListLoaded(page);
}
