/**
 * Submit del login prima dei moduli non deve mettere email/password nella query.
 */
import { test, expect } from '@playwright/test';
import { DEFAULT_VITICOLA_E2E_TEMPLATE, pickManifestEntry } from './helpers/sim-login.js';

const SECRET_EMAIL = 'leak-user@example.com';
const SECRET_PASSWORD = 'LeakPassw0rd!';

const PAGES = [
  {
    path: '/core/auth/login-standalone.html',
    form: '#login-form',
    button: '#login-button',
    label: 'Accedi',
    keep: 'registered=true&emulator=1',
    fields: [
      ['#email', SECRET_EMAIL],
      ['#password', SECRET_PASSWORD],
    ],
    enablesWhenReady: true,
  },
  {
    path: '/core/auth/login.html',
    form: '#login-form',
    button: '#login-button',
    label: 'Accedi',
    keep: 'passwordReset=true',
    fields: [
      ['#email', SECRET_EMAIL],
      ['#password', SECRET_PASSWORD],
    ],
    enablesWhenReady: true,
  },
  {
    path: '/core/auth/registrazione-standalone.html',
    form: '#register-form',
    button: '#register-button',
    label: 'Crea Account',
    keep: 'emulator=1',
    fields: [
      ['#nome', 'Mario'],
      ['#cognome', 'Rossi'],
      ['#email', SECRET_EMAIL],
      ['#password', SECRET_PASSWORD],
      ['#password-confirm', SECRET_PASSWORD],
      ['#azienda-nome', 'Azienda Test'],
    ],
    enablesWhenReady: true,
  },
  {
    path: '/core/auth/registrazione-invito-standalone.html',
    form: '#register-form',
    button: '#register-button',
    label: 'Completa Registrazione',
    keep: 'token=invite-token',
    fields: [
      ['#cellulare', '+39 333 123 4567'],
      ['#password', SECRET_PASSWORD],
      ['#password-confirm', SECRET_PASSWORD],
    ],
    enablesWhenReady: true,
  },
  {
    path: '/core/auth/reset-password-standalone.html',
    form: '#reset-form',
    button: '#reset-button',
    label: 'Imposta Nuova Password',
    keep: 'oobCode=code&mode=resetPassword&apiKey=k',
    fields: [
      ['#password', SECRET_PASSWORD],
      ['#confirm-password', SECRET_PASSWORD],
    ],
    enablesWhenReady: false,
  },
];

function assertClean(url) {
  const u = new URL(url);
  expect(u.searchParams.has('password')).toBe(false);
  expect(u.searchParams.has('email')).toBe(false);
  expect(u.searchParams.has('password-confirm')).toBe(false);
  expect(u.searchParams.has('confirm-password')).toBe(false);
  expect(url).not.toContain(SECRET_PASSWORD);
}

async function abortModules(page) {
  await page.route('**/*', (route) => {
    const req = route.request();
    const url = req.url();
    if (req.resourceType() === 'script' && !url.includes('auth-form-guard.js')) {
      return route.abort();
    }
    return route.continue();
  });
}

test.describe('Auth form: niente segreti in query', () => {
  test('click prima dei moduli non mette email o password nell\'URL', async ({ page }) => {
    const leaked = [];
    page.on('request', (req) => {
      if (/[?&](email|password|password-confirm|confirm-password)=/i.test(req.url())) {
        leaked.push(req.url());
      }
    });
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes(SECRET_PASSWORD) || /[?&]password=/i.test(text)) {
        leaked.push('console:' + text);
      }
    });

    for (const spec of PAGES) {
      await abortModules(page);
      await page.goto(spec.path);
      await expect(page.locator(spec.button)).toBeDisabled();
      const method = await page.locator(spec.form).getAttribute('method');
      expect(method).toBe('post');

      const submitted = await page.evaluate(({ formSel, buttonSel, fields }) => {
        const form = document.querySelector(formSel);
        fields.forEach(([sel, value]) => {
          const el = form.querySelector(sel);
          if (!el) return;
          el.disabled = false;
          el.value = value;
        });
        const button = document.querySelector(buttonSel);
        button.disabled = false;
        return new Promise((resolve) => {
          form.addEventListener('submit', () => resolve('fired'));
          try {
            form.requestSubmit();
          } catch (err) {
            resolve('throw:' + (err && err.message ? err.message : 'requestSubmit'));
          }
          setTimeout(() => resolve('not-fired'), 400);
        });
      }, { formSel: spec.form, buttonSel: spec.button, fields: spec.fields });
      expect(submitted).toBe('fired');

      assertClean(page.url());
      expect(page.url()).toContain(spec.path.replace(/^\//, '').split('/').pop());
      await page.unroute('**/*');
    }
    expect(leaked).toEqual([]);
  });

  test('submit nativo senza listener non mette la password in query', async ({ page }) => {
    const leaked = [];
    page.on('request', (req) => {
      if (/[?&](email|password)=/i.test(req.url())) leaked.push(`${req.method()} ${req.url()}`);
    });
    await page.goto('/core/auth/login-standalone.html');
    await page.evaluate(() => {
      const form = document.getElementById('login-form');
      document.getElementById('email').value = 'leak-user@example.com';
      document.getElementById('password').value = 'LeakPassw0rd!';
      form.submit();
    });
    await page.waitForLoadState('domcontentloaded');
    assertClean(page.url());
    expect(leaked).toEqual([]);
  });

  test('all\'avvio ripulisce email e password e non precompila la password', async ({ page }) => {
    const logs = [];
    const refererLeaks = [];
    page.on('console', (msg) => logs.push(msg.text()));
    page.on('request', (req) => {
      if (req.resourceType() === 'document') return;
      const referer = req.headers().referer || '';
      if (/[?&](email|password)=/i.test(req.url()) || /[?&](email|password)=/i.test(referer)) {
        refererLeaks.push(req.resourceType());
      }
    });
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('input[type="password"]').forEach((el) => {
          el.value = 'prefilled-from-query';
        });
      });
    });

    for (const spec of PAGES) {
      const dirty = `${spec.path}?email=${encodeURIComponent(SECRET_EMAIL)}&password=${encodeURIComponent(SECRET_PASSWORD)}&${spec.keep}`;
      await page.goto(dirty);
      assertClean(page.url());
      const kept = new URLSearchParams(spec.keep);
      const got = new URL(page.url()).searchParams;
      for (const [key, value] of kept) {
        expect(got.get(key)).toBe(value);
      }
      const passwords = page.locator(`${spec.form} input[type="password"]`);
      const count = await passwords.count();
      for (let i = 0; i < count; i++) {
        expect(await passwords.nth(i).inputValue()).toBe('');
      }
    }
    expect(logs.join('\n')).not.toContain(SECRET_PASSWORD);
    expect(refererLeaks).toEqual([]);
  });

  test('a moduli pronti il listener resta agganciato e il pulsante si riabilita', async ({ page }) => {
    const readyPaths = new Set([
      '/core/auth/login-standalone.html',
      '/core/auth/registrazione-standalone.html',
    ]);
    for (const spec of PAGES) {
      if (!readyPaths.has(spec.path)) continue;
      await page.goto(`${spec.path}?emulator=1`);
      await page.waitForFunction(({ formSel, buttonSel }) => {
        const form = document.querySelector(formSel);
        const button = document.querySelector(buttonSel);
        if (!form || !button) return false;
        return form.getAttribute('data-gfv-auth-ready') === '1' || !button.disabled;
      }, { formSel: spec.form, buttonSel: spec.button }, { timeout: 30000 });
      await expect(page.locator(spec.button)).toBeEnabled();
      await expect(page.locator(spec.button)).toHaveText(spec.label);

      const heard = await page.evaluate(({ formSel, fields }) => {
        const form = document.querySelector(formSel);
        fields.forEach(([sel, value]) => {
          const el = form.querySelector(sel);
          if (!el) return;
          el.disabled = false;
          el.value = value;
        });
        return new Promise((resolve) => {
          form.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            resolve('fired');
          }, true);
          try {
            form.requestSubmit();
          } catch (err) {
            resolve('throw:' + (err && err.message ? err.message : 'requestSubmit'));
          }
          setTimeout(() => resolve('not-fired'), 400);
        });
      }, { formSel: spec.form, fields: spec.fields });
      expect(heard).toBe('fired');
      assertClean(page.url());
    }

    await page.goto('/core/auth/reset-password-standalone.html');
    await expect(page.locator('#reset-button')).toBeDisabled();
    expect(await page.locator('#reset-form').getAttribute('data-gfv-auth-ready')).not.toBe('1');
  });

  test('login con credenziali del seed arriva in dashboard senza segreti in query', async ({ page }) => {
    test.skip(!process.env.CI && process.env.GFV_AUTH_LOGIN_E2E !== '1', 'Richiede emulator e manifest del job sim:e2e');
    await page.goto('/core/auth/login-standalone.html?emulator=1');
    const entry = await pickManifestEntry(page, {
      preferTemplateId: DEFAULT_VITICOLA_E2E_TEMPLATE,
      preferSeedComplete: true,
    });
    await expect(page.locator('#login-button')).toBeEnabled({ timeout: 30000 });
    await page.fill('#email', entry.email);
    await page.fill('#password', 'SimGFV2026!');
    await page.click('#login-button');

    const selector = page.locator('.tenant-selector-item').first();
    await Promise.race([
      page.waitForURL(/dashboard-standalone\.html/, { timeout: 60000 }),
      selector.waitFor({ state: 'visible', timeout: 60000 }),
    ]);
    if (await selector.isVisible()) {
      await selector.click();
      await page.waitForURL(/dashboard-standalone\.html/, { timeout: 60000 });
    }
    assertClean(page.url());
    expect(page.url()).not.toContain('SimGFV2026');
  });
});
