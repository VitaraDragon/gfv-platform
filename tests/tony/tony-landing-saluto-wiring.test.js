/**
 * Wiring del saluto landing in main.js: locale (zero CF), apertura compatta senza focus, niente pulsanti.
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
    expect(build).toMatch(/^\d{4}-\d{2}-\d{2}[a-z]$/);
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

  it('niente pulsanti del percorso né Chiudi percorso; il saluto resta persistito', () => {
    expect(show).not.toMatch(/APRI_PAGINA/);
    expect(show).not.toMatch(/tony-landing-passo/);
    expect(show).not.toMatch(/tony-landing-chiudi/);
    expect(show).not.toMatch(/Chiudi percorso/);
    expect(show).not.toMatch(/Usa i pulsanti qui sotto/);
    expect(show).toMatch(/salutoFatto = true/);
    expect(show).toMatch(/ultimoRiprendiGiorno = oggi/);
  });

  it('riprendi non mostra niente: solo tipo saluto arriva ad appendMessage', () => {
    const guard = show.indexOf("if (args.tipo !== 'saluto') return false;");
    const append = show.indexOf("appendMessage(testo, 'tony')");
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(append).toBeGreaterThan(guard);
    const schedGuard = sched.indexOf("if (dec.tipo !== 'saluto') return;");
    const schedShow = sched.indexOf('__tonyLandingSalutoShow({');
    expect(schedGuard).toBeGreaterThanOrEqual(0);
    expect(schedShow).toBeGreaterThan(schedGuard);
  });

  it('scheduler: aspetta __gfvTenantData e richiede il marker setup landing', () => {
    expect(sched).toMatch(/__gfvTenantData/);
    expect(sched).toMatch(/tonyLandingSetupCompletatoIl/);
    expect(sched).toMatch(/decidiSalutoLanding\(/);
  });
});
