/**
 * Wiring del saluto landing in main.js: locale (zero CF), apertura compatta senza focus, step via APRI_PAGINA.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'core/js/tony/main.js'), 'utf8');
const start = src.indexOf('window.__tonyLandingSalutoShow = function');
const end = src.indexOf('window.__tonyPromptLavoroSaveLocal = function');
const show = src.slice(start, end);
const schedStart = src.indexOf('function scheduleTonyLandingSaluto');
const sched = src.slice(schedStart, schedStart + 3500);

describe('main.js: saluto landing', () => {
  it('importa gli helper puri con ?v= uguale al build', () => {
    const build = src.match(/TONY_CLIENT_BUILD\s*=\s*'([^']+)'/)[1];
    expect(build).toBe('2026-11-02a');
    expect(src).toMatch(
      new RegExp("from './tony-landing-saluto\\.js\\?v=" + build + "'")
    );
    for (const fn of ['decidiSalutoLanding', 'costruisciMessaggioSaluto', 'leggiStatoPercorsoLocale', 'salvaStatoPercorsoLocale', 'messaggioRiprendi', 'haPinSede']) {
      expect(src).toContain(fn);
    }
  });

  it('messaggio solo locale: niente sendMessage / CF, push in chatHistory come proactive', () => {
    expect(start).toBeGreaterThan(0);
    expect(show).not.toMatch(/sendMessage\(|tonyAsk|Tony\.ask|callCloudFunction/);
    expect(show).toMatch(/appendMessage\(testo, 'tony'\)/);
    expect(show).toMatch(/chatHistory\.push\(\{ role: 'model'/);
  });

  it('apertura compatta su schermi stretti: nessun inputEl.focus', () => {
    expect(show).toMatch(/tonyIsCoarsePointerOrMobile\(\)/);
    expect(show).not.toMatch(/inputEl\.focus/);
    expect(show).toMatch(/panel\.classList\.add\('is-open'\)/);
  });

  it('step: APRI_PAGINA su impostazioni/terreni/attivita via helper; chiudi percorso persiste', () => {
    expect(show).toMatch(/type: 'APRI_PAGINA', target: p\.target/);
    expect(show).toMatch(/percorsoChiuso = true/);
    expect(show).toMatch(/passiVisti\[p\.id\] = true/);
    expect(show).toMatch(/salutoFatto = true/);
    expect(show).toMatch(/ultimoRiprendiGiorno = oggi/);
  });

  it('scheduler: aspetta __gfvTenantData e richiede il marker setup landing', () => {
    expect(sched).toMatch(/__gfvTenantData/);
    expect(sched).toMatch(/tonyLandingSetupCompletatoIl/);
    expect(sched).toMatch(/decidiSalutoLanding\(/);
  });
});
