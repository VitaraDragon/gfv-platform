import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildTonyGenerationConfig,
  streamGeminiGenerateContent,
  extractGeminiFinishMeta,
  recordTonyGeminiFinish,
  looksLikeTruncatedStructuredJson,
  appendMaxTokensNotice,
  TONY_MAX_TOKENS_NOTICE,
  TONY_MAX_OUTPUT_DEFAULT,
} from '../functions/tony-gemini-api.js';

function readRepo(rel) {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe('buildTonyGenerationConfig', () => {
  it('gemini-2.5-flash: thinkingBudget 0 e maxOutputTokens >= 4096', () => {
    const cfg = buildTonyGenerationConfig('gemini-2.5-flash', { structured: false });
    expect(cfg.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(cfg.maxOutputTokens).toBeGreaterThanOrEqual(TONY_MAX_OUTPUT_DEFAULT);
    expect(cfg.maxOutputTokens).toBeGreaterThanOrEqual(4096);
  });

  it('gemini-2.5-flash structured: temperature più bassa', () => {
    const cfg = buildTonyGenerationConfig('gemini-2.5-flash', { structured: true });
    expect(cfg.temperature).toBe(0.3);
    expect(cfg.thinkingConfig.thinkingBudget).toBe(0);
  });

  it('gemini-2.5-pro: nessun thinkingBudget 0', () => {
    const cfg = buildTonyGenerationConfig('gemini-2.5-pro', {});
    expect(cfg.thinkingConfig).toBeUndefined();
    const retry = buildTonyGenerationConfig('gemini-2.5-pro', { maxTokensRetry: true });
    expect(retry.thinkingConfig?.thinkingBudget).not.toBe(0);
    expect(retry.thinkingConfig?.thinkingBudget).toBeGreaterThanOrEqual(128);
  });

  it('gemini-3-*: nessun thinkingBudget', () => {
    const cfg = buildTonyGenerationConfig('gemini-3-flash-preview', {});
    expect(cfg.thinkingConfig).toBeUndefined();
    const retry = buildTonyGenerationConfig('gemini-3-pro-preview', { maxTokensRetry: true });
    expect(retry.thinkingConfig?.thinkingBudget).toBeUndefined();
    expect(retry.thinkingConfig?.thinkingLevel).toBe('low');
  });
});

describe('streamGeminiGenerateContent finishReason', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function sseResponse(chunks) {
    const encoder = new TextEncoder();
    let i = 0;
    return {
      ok: true,
      body: {
        getReader() {
          return {
            async read() {
              if (i >= chunks.length) return { done: true, value: undefined };
              const value = encoder.encode(chunks[i++]);
              return { done: false, value };
            },
          };
        },
      },
      headers: { get: () => null },
      async text() {
        return '';
      },
      async json() {
        return {};
      },
    };
  }

  it('ultimo chunk MAX_TOKENS + thoughtsTokenCount → text e finishReason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          'data: {"candidates":[{"content":{"parts":[{"text":"Ciao partial"}]}}]}\n\n',
          'data: {"candidates":[{"content":{"parts":[{"text":" fine"}]},"finishReason":"MAX_TOKENS"}],"usageMetadata":{"thoughtsTokenCount":900,"promptTokenCount":100,"candidatesTokenCount":50}}\n\n',
        ])
      )
    );
    const deltas = [];
    const out = await streamGeminiGenerateContent('https://example.test/stream', {}, (d) =>
      deltas.push(d)
    );
    expect(out.text).toBe('Ciao partial fine');
    expect(out.finishReason).toBe('MAX_TOKENS');
    expect(out.usageMetadata.thoughtsTokenCount).toBe(900);
    expect(deltas.join('')).toBe('Ciao partial fine');
  });

  it('finishReason STOP invariato', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          'data: {"candidates":[{"content":{"parts":[{"text":"Ok completo."}]},"finishReason":"STOP"}],"usageMetadata":{"thoughtsTokenCount":0}}\n\n',
        ])
      )
    );
    const out = await streamGeminiGenerateContent('https://example.test/stream', {});
    expect(out.text).toBe('Ok completo.');
    expect(out.finishReason).toBe('STOP');
  });
});

describe('MAX_TOKENS ripiego helper', () => {
  it('recordTonyGeminiFinish logga e torna true su MAX_TOKENS', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const perf = {};
    const hit = recordTonyGeminiFinish(
      perf,
      {
        finishReason: 'MAX_TOKENS',
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          thoughtsTokenCount: 30,
        },
      },
      'gemini-2.5-flash',
      'testo tagliato'
    );
    expect(hit).toBe(true);
    expect(perf.finishReason).toBe('MAX_TOKENS');
    expect(perf.thoughtsTokenCount).toBe(30);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('JSON strutturato troncato → looksLikeTruncatedStructuredJson', () => {
    expect(looksLikeTruncatedStructuredJson('```json\n{"action":"fill_form"')).toBe(true);
    expect(
      looksLikeTruncatedStructuredJson(
        '```json\n{"action":"ask","replyText":"Ok","formData":{}}\n```'
      )
    ).toBe(false);
  });

  it('appendMaxTokensNotice non lascia testo senza avviso', () => {
    const out = appendMaxTokensNotice('…ma poi ti appare');
    expect(out).toContain(TONY_MAX_TOKENS_NOTICE);
    expect(out).toContain('…ma poi ti appare');
  });

  it('extractGeminiFinishMeta legge candidates e usage', () => {
    const meta = extractGeminiFinishMeta({
      candidates: [{ finishReason: 'STOP' }],
      usageMetadata: { thoughtsTokenCount: 1 },
    });
    expect(meta.finishReason).toBe('STOP');
    expect(meta.usageMetadata.thoughtsTokenCount).toBe(1);
  });
});

describe('nomi reali app (Vite / navigazione)', () => {
  it('niente categoria Vigneto in form mapping e prompt terreno/preventivo', () => {
    const mapping = readRepo('core/config/tony-form-mapping.js');
    expect(mapping).not.toMatch(/Categoria coltura \(Frutteto, Vigneto/);
    expect(mapping).toMatch(/Categoria coltura \(Frutteto, Vite/);

    const indexJs = readRepo('functions/index.js');
    expect(indexJs).not.toMatch(/terreno-coltura-categoria "Vigneto"/);
    expect(indexJs).toMatch(/terreno-coltura-categoria "Vite"/);
    expect(indexJs).toMatch(/categoriaColtura": "Vite"/);
    // Filtro elenco Terreni resta legittimo
    expect(indexJs).toMatch(/"categoria": "Vigneto"/);
  });

  it('GUIDA navigazione: niente pulsante Moduli / I miei accessi come voce menu', () => {
    const coreGuida = readRepo('core/GUIDA/CORE/utente/guida.md');
    expect(coreGuida).not.toMatch(/pulsante \*\*Moduli\*\*/);
    expect(coreGuida).not.toMatch(/Il pulsante \*\*Moduli\*\*/);
    expect(coreGuida).toMatch(/Apri o chiudi i moduli/);
    expect(coreGuida).toMatch(/non è una voce di menu/);
    expect(coreGuida).toMatch(/pulsante moduli in alto a sinistra/);

    const sintesi = readRepo('core/GUIDA/CORE/utente/guida-sintesi.md');
    expect(sintesi).not.toMatch(/pulsante \*\*Moduli\*\*/);
    expect(sintesi).toMatch(/sezione della dashboard/);
    expect(sintesi).toMatch(/pulsante moduli in alto a sinistra/);

    const inter = readRepo('core/GUIDA/INTERSEZIONI/tony/intersezioni.md');
    expect(inter).toMatch(/Regola unica nomi comandi/);
    expect(inter).toMatch(/Apri o chiudi i moduli/);

    const guidaApp = readRepo('core/services/tony-guida-app.js');
    expect(guidaApp).toMatch(/In alto a SINISTRA: pulsante moduli/);
    expect(guidaApp).toMatch(/icona graffetta/);
    expect(guidaApp).not.toMatch(/card cliccabili per le varie sezioni/);
  });

  it('GUIDA/contesto Tony: graffetta/moduli mai «in alto a destra»', () => {
    const files = [
      'core/services/tony-guida-app.js',
      'core/GUIDA/CORE/utente/guida.md',
      'core/GUIDA/CORE/utente/guida-sintesi.md',
      'core/GUIDA/CORE/tony/guida-tecnica.md',
      'core/GUIDA/INTERSEZIONI/tony/intersezioni.md',
      'core/GUIDA/TONY/utente/guida.md',
      'core/js/dashboard-tour.js',
      'docs-sviluppo/GUIDA/CORE/utente/guida.md',
      'docs-sviluppo/GUIDA/CORE/utente/guida-sintesi.md',
      'docs-sviluppo/GUIDA/CORE/tony/guida-tecnica.md',
      'docs-sviluppo/GUIDA/INTERSEZIONI/tony/intersezioni.md',
      'docs-sviluppo/GUIDA/TONY/utente/guida.md',
    ];
    // Graffetta/moduli associati a «in alto a destra» (falso: è a sinistra)
    const bad = /(?:graffett|pulsante moduli|Apri o chiudi i moduli)[^\n.]{0,80}in alto a destra|in alto a destra[^\n.]{0,80}(?:graffett|pulsante moduli|Apri o chiudi i moduli)/i;
    for (const rel of files) {
      expect(readRepo(rel), rel).not.toMatch(bad);
    }
  });
});
