import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const PAGES = [
  {
    file: 'core/auth/login-standalone.html',
    formId: 'login-form',
    buttonId: 'login-button',
    label: 'Accedi',
  },
  {
    file: 'core/auth/login.html',
    formId: 'login-form',
    buttonId: 'login-button',
    label: 'Accedi',
  },
  {
    file: 'core/auth/registrazione-standalone.html',
    formId: 'register-form',
    buttonId: 'register-button',
    label: 'Crea Account',
  },
  {
    file: 'core/auth/registrazione-invito-standalone.html',
    formId: 'register-form',
    buttonId: 'register-button',
    label: 'Completa Registrazione',
  },
  {
    file: 'core/auth/reset-password-standalone.html',
    formId: 'reset-form',
    buttonId: 'reset-button',
    label: 'Imposta Nuova Password',
  },
];

const guardSrc = readFileSync('core/auth/auth-form-guard.js', 'utf8');

function runGuard(search, forms, scrubbedFlag) {
  const logs = [];
  let href = `https://vitaradragon.github.io/gfv-platform/core/auth/login-standalone.html${search}`;
  const location = {
    get search() {
      return new URL(href).search;
    },
    get pathname() {
      return new URL(href).pathname;
    },
    get hash() {
      return new URL(href).hash;
    },
  };
  const document = {
    readyState: 'complete',
    forms,
    querySelectorAll(sel) {
      if (sel === 'form') return forms;
      return [];
    },
    addEventListener() {},
  };
  const sandbox = {
    URLSearchParams,
    document,
    history: {
      replaceState(_state, _title, next) {
        href = `https://vitaradragon.github.io${next}`;
      },
    },
    console: {
      log: (...args) => logs.push(args.map(String).join(' ')),
      info: (...args) => logs.push(args.map(String).join(' ')),
      debug: (...args) => logs.push(args.map(String).join(' ')),
      warn: (...args) => logs.push(args.map(String).join(' ')),
      error: (...args) => logs.push(args.map(String).join(' ')),
    },
  };
  sandbox.window = sandbox;
  sandbox.window.location = location;
  if (scrubbedFlag) sandbox.window.__gfvScrubbedPassword = 1;
  const context = createContext(sandbox);
  runInContext(guardSrc, context);
  return { href, logs, api: sandbox.window.gfvMarkAuthFormReady };
}

describe('auth form query guard', () => {
  it('non logga e non tiene email/password in query', () => {
    const secret = 'LeakPassw0rd!';
    const { href, logs } = runGuard(
      `?email=leak-user%40example.com&password=${encodeURIComponent(secret)}&registered=true&emulator=1&passwordReset=true#ok`,
      []
    );
    const url = new URL(href);
    expect(url.searchParams.has('password')).toBe(false);
    expect(url.searchParams.has('email')).toBe(false);
    expect(url.searchParams.get('registered')).toBe('true');
    expect(url.searchParams.get('emulator')).toBe('1');
    expect(url.searchParams.get('passwordReset')).toBe('true');
    expect(url.hash).toBe('#ok');
    expect(logs.join('\n')).not.toContain(secret);
    expect(logs.join('\n')).not.toContain('password=');
  });

  it('tiene token, oobCode e mode', () => {
    const { href } = runGuard('?token=abc&oobCode=code&mode=resetPassword&apiKey=k&email=a%40b.c&password=x', []);
    const url = new URL(href);
    expect(url.searchParams.get('token')).toBe('abc');
    expect(url.searchParams.get('oobCode')).toBe('code');
    expect(url.searchParams.get('mode')).toBe('resetPassword');
    expect(url.searchParams.get('apiKey')).toBe('k');
    expect(url.searchParams.has('email')).toBe(false);
    expect(url.searchParams.has('password')).toBe(false);
  });

  it('svuota i campi password se la query li conteneva e blocca il submit', () => {
    let prevented = false;
    const password = { type: 'password', value: 'prefilled-from-query' };
    const form = {
      attrs: {},
      getAttribute(name) {
        return this.attrs[name] || null;
      },
      setAttribute(name, value) {
        this.attrs[name] = String(value);
      },
      querySelector(sel) {
        return sel === 'input[type="password"]' ? password : null;
      },
      querySelectorAll(sel) {
        return sel === 'input[type="password"]' ? [password] : [];
      },
      addEventListener(type, fn) {
        if (type === 'submit') {
          const ev = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; prevented = true; } };
          fn(ev);
        }
      },
    };
    runGuard('?password=secret', [form]);
    expect(form.getAttribute('method')).toBe('post');
    expect(form.getAttribute('data-gfv-auth-guard')).toBe('1');
    expect(password.value).toBe('');
    expect(prevented).toBe(true);
  });

  it('svuota la password anche se la query è già stata ripulita inline', () => {
    const password = { type: 'password', value: 'prefilled-from-query' };
    const form = {
      attrs: {},
      getAttribute(name) { return this.attrs[name] || null; },
      setAttribute(name, value) { this.attrs[name] = String(value); },
      querySelector(sel) { return sel === 'input[type="password"]' ? password : null; },
      querySelectorAll(sel) { return sel === 'input[type="password"]' ? [password] : []; },
      addEventListener() {},
    };
    const { href } = runGuard('?registered=true', [form], true);
    expect(password.value).toBe('');
    expect(new URL(href).searchParams.get('registered')).toBe('true');
    expect(new URL(href).searchParams.has('password')).toBe(false);
  });

  it('gfvMarkAuthFormReady riabilita il pulsante con l\'etichetta originale', () => {
    const button = { disabled: true, textContent: 'Caricamento…', getAttribute: () => 'Accedi' };
    const form = {
      attrs: {},
      getAttribute(name) { return this.attrs[name] || null; },
      setAttribute(name, value) { this.attrs[name] = String(value); },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      addEventListener() {},
    };
    const { api } = runGuard('', []);
    api(form, button);
    expect(form.getAttribute('data-gfv-auth-ready')).toBe('1');
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe('Accedi');
  });

  it.each(PAGES)('$file ha post, guard early e pulsante fermo', (page) => {
    const html = readFileSync(page.file, 'utf8');
    const guardAt = html.indexOf('auth-form-guard.js');
    const inlineAt = html.indexOf('history.replaceState');
    const moduleAt = html.indexOf('<script type="module"');
    const formTag = html.match(new RegExp(`<form\\b[^>]*id="${page.formId}"[^>]*>`));
    const buttonTag = html.match(new RegExp(`<button\\b[^>]*id="${page.buttonId}"[^>]*>`));
    expect(formTag, page.file).toBeTruthy();
    expect(formTag[0]).toMatch(/method="post"/);
    expect(formTag[0]).toMatch(/onsubmit="return false"/);
    expect(buttonTag, page.file).toBeTruthy();
    expect(buttonTag[0]).toMatch(/\bdisabled\b/);
    expect(buttonTag[0]).toContain(`data-ready-label="${page.label}"`);
    expect(inlineAt).toBeGreaterThan(-1);
    expect(guardAt).toBeGreaterThan(inlineAt);
    expect(moduleAt).toBeGreaterThan(guardAt);
    expect(html).toContain('gfvMarkAuthFormReady');
    expect(html).toContain('__gfvScrubbedPassword');
    expect(html).toContain('name="referrer" content="origin"');
    const rewriteAt = html.indexOf('location.replace(p.replace');
    if (rewriteAt !== -1) expect(inlineAt).toBeLessThan(rewriteAt);
  });

  it('il guard non stampa la search', () => {
    expect(guardSrc).not.toMatch(/console\.(log|debug|info|warn|error)/);
  });
});
