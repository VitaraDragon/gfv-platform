import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const HTML_PATH = 'core/admin/impostazioni-standalone.html';

/** Stato letto dal callback Maps e da tryInitSedeMap / initSedeMap. */
const BINDINGS = ['sedeMap', 'sedeMarker', 'pendingSedeCoordinate', 'sedeMapInitAttempts'];

function moduleSource() {
  const html = readFileSync(HTML_PATH, 'utf8');
  const open = html.indexOf('<script type="module">');
  const close = html.indexOf('</script>', open);
  return html.slice(open + '<script type="module">'.length, close);
}

function callbackSource(src) {
  const start = src.indexOf('window.initGoogleMapsPodere = function()');
  const end = src.indexOf('};', start);
  return src.slice(start, end + 2);
}

describe('mappa sede impostazioni — init senza TDZ', () => {
  const src = moduleSource();
  const callbackAt = src.indexOf('window.initGoogleMapsPodere = function()');

  it('dichiara lo stato della mappa prima del callback Google Maps', () => {
    expect(callbackAt).toBeGreaterThan(0);
    for (const name of BINDINGS) {
      const decl = src.search(new RegExp(`\\blet\\s+${name}\\b`));
      expect(decl, name).toBeGreaterThanOrEqual(0);
      expect(decl, name).toBeLessThan(callbackAt);
      expect(src.slice(decl + 1).search(new RegExp(`\\blet\\s+${name}\\b`)), name).toBe(-1);
    }
    const body = callbackSource(src);
    expect(body).toContain('sedeMapInitAttempts = 0');
    expect(body).toContain('tryInitSedeMap()');
  });

  it('il callback azzera i tentativi senza ReferenceError', () => {
    const prelude = src.slice(0, callbackAt);
    const lets = BINDINGS.map((name) => {
      const match = prelude.match(new RegExp(`let\\s+${name}\\s*=\\s*[^;]+;`));
      expect(match, name).toBeTruthy();
      return match[0];
    }).join('\n');

    const sandbox = { window: null, result: null };
    sandbox.window = sandbox;
    const code = `
      ${lets}
      function tryInitSedeMap() {
        touched = {
          attempts: sedeMapInitAttempts,
          pending: pendingSedeCoordinate,
          map: sedeMap,
          marker: sedeMarker
        };
      }
      ${callbackSource(src)}
      window.initGoogleMapsPodere();
      result = {
        ready: window.googleMapsReadyPodere,
        attempts: sedeMapInitAttempts,
        touched: touched
      };
    `;
    runInContext(code, createContext(sandbox));
    expect(sandbox.result).toEqual({
      ready: true,
      attempts: 0,
      touched: {
        attempts: 0,
        pending: null,
        map: null,
        marker: null,
      },
    });
  });

  it('assegnare sedeMapInitAttempts prima del let è un ReferenceError', () => {
    const sandbox = { window: null };
    sandbox.window = sandbox;
    expect(() => runInContext(`
      window.initGoogleMapsPodere = function() {
        sedeMapInitAttempts = 0;
      };
      window.initGoogleMapsPodere();
      let sedeMapInitAttempts = 0;
    `, createContext(sandbox))).toThrow(/before initialization/);
  });
});
