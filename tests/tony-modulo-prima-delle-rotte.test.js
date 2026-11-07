/**
 * Il flag del modulo Tony va aggiornato prima di qualsiasi await successivo a Tony.init.
 * Altrimenti T-FLOW-014 inietta il preventivo nel buco e riceve «modulo Tony Avanzato non attivo».
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function initBody() {
  const src = readFileSync(resolve(process.cwd(), 'core/js/tony/main.js'), 'utf8');
  const start = src.indexOf('async function initTonyWhenReady()');
  const end = src.indexOf('\n    async function ', start + 10);
  expect(start).toBeGreaterThan(0);
  return src.slice(start, end > start ? end : start + 20000);
}

describe('modulo Tony prima del fetch delle rotte', () => {
  it('checkTonyModuleStatus(true) precede tony-routes.json', () => {
    const body = initBody();
    const initAt = body.indexOf('await Tony.init(app)');
    const checkAt = body.indexOf('checkTonyModuleStatus(true)');
    const routesAt = body.indexOf('tony-routes.json');
    expect(initAt).toBeGreaterThan(0);
    expect(checkAt).toBeGreaterThan(initAt);
    expect(routesAt).toBeGreaterThan(checkAt);
  });
});
