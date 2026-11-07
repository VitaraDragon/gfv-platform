/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import {
  cleanTextFromJsonResidue,
  resolveTonyUserVisibleText,
  sanitizeTonyVisibleChatText,
  alignApriPaginaSpeechToTarget,
  resolveTarget,
  getUrlForTarget,
} from '../core/js/tony/engine.js';

const require = createRequire(import.meta.url);
const { extractTonyTextLoose } = require('../functions/tony-json-text.js');

function loadTonyFormInjector() {
  const code = readFileSync(resolve(process.cwd(), 'core/js/tony-form-injector.js'), 'utf8');
  vm.runInThisContext(code);
  return globalThis.TonyFormInjector;
}

function expectNoCommandLeak(text) {
  expect(text).not.toMatch(/,\s*["']?command["']?\s*:/i);
  expect(text).not.toMatch(/["']\s*,\s*["']?command["']?/i);
  expect(String(text).toLowerCase()).not.toContain('command:');
}

describe('EIMA — TTS non legge «, command:» (stream + clean)', () => {
  const fullWithNav =
    '{"text":"Ti porto alla gestione lavori.","command":{"type":"APRI_PAGINA","target":"gestione lavori"}}';
  const midLeak =
    'Ti porto alla gestione lavori.", "command": {"type":"APRI_PAGINA","target":"gestione lavori"}';
  const bareLeak = 'Ti porto alla gestione lavori. , command:';

  it('cleanTextFromJsonResidue: JSON completo con command nested → solo la frase', () => {
    const out = cleanTextFromJsonResidue(fullWithNav);
    expect(out).toBe('Ti porto alla gestione lavori.');
    expectNoCommandLeak(out);
  });

  it('sanitizeTonyVisibleChatText: stessa difesa (path streaming TTS)', () => {
    expect(sanitizeTonyVisibleChatText(fullWithNav)).toBe('Ti porto alla gestione lavori.');
    expect(sanitizeTonyVisibleChatText(midLeak)).toBe('Ti porto alla gestione lavori.');
    expect(sanitizeTonyVisibleChatText(bareLeak)).toBe('Ti porto alla gestione lavori.');
    expectNoCommandLeak(sanitizeTonyVisibleChatText(midLeak));
  });

  it('resolveTonyUserVisibleText + extractTonyTextLoose (server) restano allineati', () => {
    expect(resolveTonyUserVisibleText(fullWithNav, null).text).toBe('Ti porto alla gestione lavori.');
    expect(extractTonyTextLoose(fullWithNav).text).toBe('Ti porto alla gestione lavori.');
    expectNoCommandLeak(extractTonyTextLoose(midLeak).text);
  });
});

describe('EIMA — T-DIRTY002 speech/nav: Gestione lavori ≠ Potatura', () => {
  it('resolveTarget("gestione lavori") apre gestione-lavori, non potatura', () => {
    const resolved = resolveTarget('gestione lavori');
    expect(['lavori', 'gestione lavori']).toContain(resolved);
    const url = getUrlForTarget('gestione lavori', '/core/dashboard-standalone.html');
    expect(url).toMatch(/gestione-lavori-standalone\.html/);
    expect(url).not.toMatch(/potatura/i);
  });

  it('alignApriPaginaSpeechToTarget: testo «gestione lavori» + target potatura → parlato Potatura', () => {
    const out = alignApriPaginaSpeechToTarget(
      'Ti porto alla gestione lavori.',
      'potatura vigneto'
    );
    expect(out.toLowerCase()).toContain('potatura');
    expect(out.toLowerCase()).not.toContain('gestione lavori');
  });

  it('alignApriPaginaSpeechToTarget: target gestione lavori lascia il parlato coerente', () => {
    const out = alignApriPaginaSpeechToTarget(
      'Ti porto alla gestione lavori.',
      'gestione lavori'
    );
    expect(out.toLowerCase()).toContain('gestione lavori');
  });
});

describe('EIMA — persona assente (Luca) non viene assegnata', () => {
  beforeEach(() => {
    window.lavoriState = {
      operaiList: [
        { id: 'op-mario', nome: 'Mario', cognome: 'Rossi' },
        { id: 'op-giuseppe', nome: 'Giuseppe', cognome: 'Ferrari' },
      ],
      caposquadraList: [{ id: 'cap-1', nome: 'Pier', cognome: 'Best' }],
    };
    window.__tonyLavoroUnknownPersonMessage = '';
    window.__tonyLavoroInterviewPending = false;
  });

  it('sanitizeAmbiguousLavoroInterviewFields: «Luca» assente → campo tolto + messaggio chiarimento', () => {
    const api = loadTonyFormInjector();
    expect(typeof api.sanitizeAmbiguousLavoroInterviewFields).toBe('function');
    const fd = {
      'lavoro-operaio': 'Luca',
      'tipo-assegnazione': 'autonomo',
      'lavoro-stato': 'assegnato',
    };
    api.sanitizeAmbiguousLavoroInterviewFields(fd, 'assegna a Luca');
    expect(fd['lavoro-operaio']).toBeUndefined();
    expect(fd['tipo-assegnazione']).toBeUndefined();
    expect(String(window.__tonyLavoroUnknownPersonMessage || '')).toMatch(/Non ho trovato «Luca»/i);
  });

  it('promptLavoroInterviewMissing espone il chiarimento persona assente', async () => {
    const api = loadTonyFormInjector();
    window.__tonyLavoroUnknownPersonMessage =
      'Non ho trovato «Luca» tra gli operai. Ripeti nome e cognome come in elenco, oppure dimmi a chi assegnare.';
    const res = await api.promptLavoroInterviewMissing();
    expect(res.asked).toBe(true);
    expect(res.message).toMatch(/Non ho trovato «Luca»/i);
    expect(window.__tonyLavoroUnknownPersonMessage).toBe('');
  });

  it('resolveFromLavoriState non fa più fallback al nome grezzo per operai assenti', () => {
    const src = readFileSync(resolve(process.cwd(), 'core/js/tony-form-injector.js'), 'utf8');
    expect(src).toMatch(/resolveUserByName\(rawValue, list\) \|\| ''/);
    expect(src).not.toMatch(
      /caposquadraList \|\| stateKey === 'operaiList'\)[\s\S]{0,120}resolveUserByName\(rawValue, list\) \|\| rawValue/
    );
  });
});
