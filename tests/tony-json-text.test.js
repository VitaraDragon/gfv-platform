import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const {
  extractTonyTextLoose,
  postProcessTonyUnstructuredResponse,
} = require('../functions/tony-json-text.js');
const { TONY_MAX_TOKENS_NOTICE } = require('../functions/tony-gemini-api.js');

const MALFORMED_VITE =
  '{"text": "Per un terreno con la vite, la categoria coltura da scegliere è "Vite".", "command": null}';
const MALFORMED_VITE_NO_CMD =
  '{"text": "Per un terreno con la vite, la categoria coltura da scegliere è "Vite"."}';
const EXPECTED_VITE =
  'Per un terreno con la vite, la categoria coltura da scegliere è "Vite".';

describe('extractTonyTextLoose (server)', () => {
  it('JSON valido con \\"Vite\\" → testo pulito', () => {
    const raw =
      '{"text": "Per un terreno con la vite, la categoria coltura da scegliere è \\"Vite\\".", "command": null}';
    const out = extractTonyTextLoose(raw);
    expect(out.text).toBe(EXPECTED_VITE);
    expect(out.command).toBeNull();
    expect(out.text).not.toMatch(/text"\s*:/);
  });

  it('JSON con virgolette interne non escapate + command null → testo, mai grezzo né Ok.', () => {
    const out = extractTonyTextLoose(MALFORMED_VITE);
    expect(out.text).toBe(EXPECTED_VITE);
    expect(out.command).toBeNull();
    expect(out.text).not.toContain('text":');
    expect(out.text).not.toBe('Ok.');
  });

  it('JSON malformato senza command → stesso testo pulito', () => {
    const out = extractTonyTextLoose(MALFORMED_VITE_NO_CMD);
    expect(out.text).toBe(EXPECTED_VITE);
    expect(out.command).toBeNull();
  });

  it('JSON senza fence e dentro fence ```json', () => {
    const plain = extractTonyTextLoose('{"text": "Ciao dal campo.", "command": null}');
    expect(plain.text).toBe('Ciao dal campo.');
    const fenced = extractTonyTextLoose('```json\n{"text": "Ciao dal campo.", "command": null}\n```');
    expect(fenced.text).toBe('Ciao dal campo.');
  });

  it('testo semplice → invariato', () => {
    const out = extractTonyTextLoose('Oggi puoi potare il Sangiovese.');
    expect(out.text).toBe('Oggi puoi potare il Sangiovese.');
    expect(out.command).toBeNull();
  });

  it('avviso MAX_TOKENS dopo JSON valido → testo + avviso, niente graffe', () => {
    const raw =
      '{"text": "Ecco i terreni.", "command": null}\n\n' + TONY_MAX_TOKENS_NOTICE;
    const out = extractTonyTextLoose(raw);
    expect(out.text).toContain('Ecco i terreni.');
    expect(out.text).toContain(TONY_MAX_TOKENS_NOTICE);
    expect(out.text).not.toMatch(/[{}]/);
  });

  it('avviso MAX_TOKENS dopo JSON malformato → testo + avviso, niente graffe', () => {
    const raw = MALFORMED_VITE + '\n\n' + TONY_MAX_TOKENS_NOTICE;
    const out = extractTonyTextLoose(raw);
    expect(out.text).toContain(EXPECTED_VITE);
    expect(out.text).toContain(TONY_MAX_TOKENS_NOTICE);
    expect(out.text).not.toMatch(/[{}]/);
    expect(out.text).not.toContain('text":');
  });

  it('JSON con command APRI_PAGINA valido', () => {
    const raw =
      '{"text": "Ti porto ai terreni.", "command": {"type": "APRI_PAGINA", "params": {"target": "terreni"}}}';
    const out = extractTonyTextLoose(raw);
    expect(out.text).toBe('Ti porto ai terreni.');
    expect(out.command).toEqual({
      type: 'APRI_PAGINA',
      params: { target: 'terreni' },
    });
  });

  it('JSON con command e parametri (FILTER_TABLE)', () => {
    const raw =
      '{"text": "Ecco i preventivi per la categoria «Vite».", "command": {"type": "FILTER_TABLE", "params": {"categoriaColtura": "Vite"}}}';
    const out = extractTonyTextLoose(raw);
    expect(out.text).toBe('Ecco i preventivi per la categoria «Vite».');
    expect(out.command.type).toBe('FILTER_TABLE');
    expect(out.command.params.categoriaColtura).toBe('Vite');
  });

  it('JSON troncato → nessun comando, testo ripulito', () => {
    const raw =
      '{"text": "Ti porto al diario.", "command": {"type": "OPEN_MODAL", "id": "attiv';
    const out = extractTonyTextLoose(raw);
    expect(out.text).toBe('Ti porto al diario.');
    expect(out.command).toBeNull();
    expect(out.text).not.toMatch(/[{}]/);
  });

  it('Base: JSON valido con sola chiave text → testo pulito', () => {
    const raw = '{"text": "Dal menu apri Terreni e scegli la categoria «Vite»."}';
    const out = extractTonyTextLoose(raw);
    expect(out.text).toBe('Dal menu apri Terreni e scegli la categoria «Vite».');
    expect(out.command).toBeNull();
  });
});

describe('postProcessTonyUnstructuredResponse', () => {
  it('Base non lascia grezzo un JSON solo-text', () => {
    const out = postProcessTonyUnstructuredResponse(
      '{"text": "Scegli la categoria «Vite»."}',
      { isTonyAdvancedActive: false }
    );
    expect(out.text).toBe('Scegli la categoria «Vite».');
    expect(out.command).toBeUndefined();
  });

  it('Advanced: se parsed è ancora grezzo, usa estrazione tollerante', () => {
    const out = postProcessTonyUnstructuredResponse(MALFORMED_VITE, {
      isTonyAdvancedActive: true,
      parsed: { text: MALFORMED_VITE },
    });
    expect(out.text).toBe(EXPECTED_VITE);
    expect(out.text).not.toContain('text":');
  });
});
