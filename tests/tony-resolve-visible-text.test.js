import { describe, it, expect } from 'vitest';
import {
  extractTonyTextLoose,
  resolveTonyUserVisibleText,
} from '../core/js/tony/engine.js';

const MALFORMED_VITE =
  '{"text": "Per un terreno con la vite, la categoria coltura da scegliere è "Vite".", "command": null}';
const EXPECTED_VITE =
  'Per un terreno con la vite, la categoria coltura da scegliere è "Vite".';

describe('resolveTonyUserVisibleText (client difesa JSON grezzo)', () => {
  it('JSON valido con \\"Vite\\" → testo pulito', () => {
    const raw =
      '{"text": "Per un terreno con la vite, la categoria coltura da scegliere è \\"Vite\\".", "command": null}';
    const visible = resolveTonyUserVisibleText(raw, null);
    expect(visible.text).toBe(EXPECTED_VITE);
    expect(visible.text).not.toMatch(/text"\s*:/);
  });

  it('JSON malformato con virgolette interne → testo, mai text": né Ok.', () => {
    const visible = resolveTonyUserVisibleText(MALFORMED_VITE, null);
    expect(visible.text).toBe(EXPECTED_VITE);
    expect(visible.text).not.toContain('text":');
    expect(visible.text).not.toBe('Ok.');
  });

  it('JSON malformato senza command → stesso testo', () => {
    const raw =
      '{"text": "Per un terreno con la vite, la categoria coltura da scegliere è "Vite"."}';
    const visible = resolveTonyUserVisibleText(raw, null);
    expect(visible.text).toBe(EXPECTED_VITE);
  });

  it('fence ```json → testo pulito', () => {
    const raw = '```json\n{"text": "Ciao.", "command": null}\n```';
    const visible = resolveTonyUserVisibleText(raw, null);
    expect(visible.text).toBe('Ciao.');
  });

  it('testo semplice → invariato', () => {
    const visible = resolveTonyUserVisibleText('Potatura nel Sangiovese.', null);
    expect(visible.text).toBe('Potatura nel Sangiovese.');
  });

  it('MAX_TOKENS dopo JSON malformato → testo + avviso', () => {
    const notice = 'La risposta si è interrotta: chiedimi di continuare.';
    const raw = MALFORMED_VITE + '\n\n' + notice;
    const visible = resolveTonyUserVisibleText(raw, null);
    expect(visible.text).toContain(EXPECTED_VITE);
    expect(visible.text).toContain(notice);
    expect(visible.text).not.toMatch(/[{}]/);
  });

  it('command APRI_PAGINA estratto', () => {
    const raw =
      '{"text": "Ti porto ai terreni.", "command": {"type": "APRI_PAGINA", "params": {"target": "terreni"}}}';
    const visible = resolveTonyUserVisibleText(raw, null);
    expect(visible.text).toBe('Ti porto ai terreni.');
    expect(visible.command.type).toBe('APRI_PAGINA');
    expect(visible.command.target).toBe('terreni');
  });

  it('JSON troncato → nessun comando, testo ripulito', () => {
    const raw =
      '{"text": "Ti porto al diario.", "command": {"type": "OPEN_MODAL", "id": "attiv';
    const visible = resolveTonyUserVisibleText(raw, null);
    expect(visible.text).toBe('Ti porto al diario.');
    expect(visible.command).toBeNull();
  });

  it('Base: sola chiave text → testo pulito', () => {
    const raw = '{"text": "Scegli la categoria «Vite»."}';
    const visible = resolveTonyUserVisibleText(raw, null);
    expect(visible.text).toBe('Scegli la categoria «Vite».');
  });

  it('stream: chunk poi done con JSON malformato → fumetto finale solo testo', () => {
    // Simula chunk parziali già mostrati, poi done.text grezzo (come tonyAskStream)
    const chunks = ['Per un terreno', ' con la vite'];
    void chunks;
    const doneText = MALFORMED_VITE;
    const finalBubble = resolveTonyUserVisibleText(doneText, null);
    expect(finalBubble.text).toBe(EXPECTED_VITE);
    expect(finalBubble.text).not.toContain('text":');
    expect(finalBubble.text).not.toMatch(/^\s*\{/);
  });

  it('extractTonyTextLoose client allineato al caso Vite', () => {
    const out = extractTonyTextLoose(MALFORMED_VITE);
    expect(out.text).toBe(EXPECTED_VITE);
  });
});
