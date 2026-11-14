/**
 * Login emulator senza la pagina dev: una init script, poi la pagina del test.
 * L'app rifà l'accesso con ensureSimulatorSession.
 * @module tests/e2e/sim/helpers/login-diretto
 */

import { simE2eTimeout } from './sim-e2e-timeouts.mjs';

const PASSWORD = 'SimGFV2026!';

/**
 * @param {object} entry
 * @param {object} [persona]
 */
export function loginPayloadFromEntry(entry, persona) {
  const who = persona || entry;
  if (!who || !who.email) {
    throw new Error(`Login diretto: entry senza email (tenant ${entry && entry.tenantId ? entry.tenantId : '?'})`);
  }
  return {
    email: who.email,
    password: who.password || PASSWORD,
    tenantId: (entry && entry.tenantId) || who.tenantId || '',
    userId: who.userId || who.uid || (entry && entry.userId) || '',
  };
}

/**
 * @param {object} entry
 * @param {string} role
 */
export function personaByRole(entry, role) {
  const list = Array.isArray(entry && entry.personas) ? entry.personas : [];
  const found = list.find((p) => Array.isArray(p.ruoli) && p.ruoli.includes(role));
  if (!found) {
    throw new Error(
      `Login diretto: nessuna persona «${role}» nel tenant ${entry && entry.tenantId ? entry.tenantId : '?'}`
    );
  }
  return found;
}

function nextToken(page) {
  page.__gfvLoginSeq = (page.__gfvLoginSeq || 0) + 1;
  return page.__gfvLoginSeq;
}

async function installLoginScript(page, payload) {
  const token = nextToken(page);
  await page.addInitScript((data) => {
    try {
      // L'indizio «workspace» resta dopo un operaio o un capo. Sulle pagine desktop
      // la guardia di rotta rimanda al workspace, e il workspace rimanda in dashboard.
      var path = (location && location.pathname) || '';
      var campo = /field-workspace|segnatura-ore-standalone|lavori-caposquadra|validazione-ore-standalone|segnalazione-guasti|statistiche-lavoratore|guida-manodopera/.test(path);
      if (!campo) {
        localStorage.setItem('gfv_ingresso_ultimo', 'dashboard');
        sessionStorage.removeItem('gfv_tony_utente_ruoli');
        sessionStorage.removeItem('gfv_workspace_rimbalzi');
      }
    } catch (_) { /* storage bloccato */ }
    try {
      const current = Number(sessionStorage.getItem('gfv_e2e_login_seq') || '0');
      if (data.token < current) return;
      if (data.token === current && sessionStorage.getItem('gfv_e2e_login_diretto') === '1') return;
      sessionStorage.setItem('gfv_e2e_login_seq', String(data.token));
      sessionStorage.setItem('gfv_sim_pending_login', JSON.stringify({
        email: data.email,
        password: data.password,
        tenantId: data.tenantId,
        userId: data.userId,
      }));
      if (data.tenantId) sessionStorage.setItem('gfv_current_tenant_id', data.tenantId);
      if (data.userId) sessionStorage.setItem('gfv_expected_user_id', data.userId);
      localStorage.setItem('gfv_firebase_emulator', '1');
      sessionStorage.setItem('gfv_e2e_login_diretto', '1');
    } catch (_) { /* storage bloccato */ }
  }, { ...payload, token });
  page.__gfvPendingPayload = payload;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ email: string, password?: string, tenantId?: string, userId?: string }} payload
 * @param {string} target
 */
async function assertLoginDiretto(page, payload, target) {
  const timeout = simE2eTimeout(30_000);
  let outcome = null;
  try {
    const handle = await page.waitForFunction(() => {
      const status = document.getElementById('status');
      const statusText = ((status && status.textContent) || '').trim();
      const err = !!(status && /\berr\b/.test(status.className) && statusText);
      if (err) return { ok: false, status: statusText, href: location.href };
      if (/login-standalone\.html/.test(location.pathname)
        && !/Accesso in corso|Caricamento/i.test(document.body ? document.body.innerText : '')) {
        return { ok: false, status: statusText || 'reindirizzato al login', href: location.href };
      }
      const pending = sessionStorage.getItem('gfv_sim_pending_login');
      const tenant = sessionStorage.getItem('gfv_current_tenant_id');
      if (tenant && !pending) return { ok: true, href: location.href, status: statusText };
      return null;
    }, { timeout });
    outcome = await handle.jsonValue();
  } catch (_) {
    outcome = await page.evaluate(() => ({
      ok: false,
      href: location.href,
      status: ((document.getElementById('status') || {}).textContent || '').trim(),
    })).catch(() => ({ ok: false, href: target, status: '' }));
  }
  if (!outcome || outcome.ok === false) {
    const href = (outcome && outcome.href) || target;
    const status = (outcome && outcome.status) || '(vuoto)';
    throw new Error(`Login diretto fallito: pagina ${href}, utente ${payload.email}, #status: ${status}`);
  }
}

/**
 * Se la pagina ha rimandato in dashboard mentre il login finiva, si riprova la destinazione.
 * @param {import('@playwright/test').Page} page
 * @param {string} target
 */
async function riprovaSeRimbalzo(page, target) {
  const atteso = target.split('?')[0].split('/').pop();
  if (!atteso || page.url().includes(atteso)) return;
  await page.goto(target);
}

/**
 * Imposta la sessione e apre subito la pagina del test.
 * @param {import('@playwright/test').Page} page
 * @param {object} entry
 * @param {string} target
 */
export async function loginDiretto(page, entry, target) {
  const payload = entry && entry.email && entry.tenantId && entry.password
    ? entry
    : loginPayloadFromEntry(entry);
  if (!target) {
    throw new Error(`Login diretto: pagina mancante (utente ${payload.email})`);
  }
  await installLoginScript(page, payload);
  page.__gfvPendingPayload = null;
  await page.goto(target);
  await assertLoginDiretto(page, payload, target);
  await riprovaSeRimbalzo(page, target);
}

/**
 * Prepara il login: la prossima gotoDirect apre la pagina del test.
 * @param {import('@playwright/test').Page} page
 * @param {object} entry
 */
export async function armLoginDiretto(page, entry) {
  const payload = entry && entry.email && entry.tenantId && entry.password
    ? entry
    : loginPayloadFromEntry(entry);
  await installLoginScript(page, payload);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} path
 */
export async function gotoDirect(page, path) {
  const payload = page.__gfvPendingPayload;
  if (payload) {
    page.__gfvPendingPayload = null;
    await page.goto(path);
    await assertLoginDiretto(page, payload, path);
    await riprovaSeRimbalzo(page, path);
    return;
  }
  await page.goto(path);
}
