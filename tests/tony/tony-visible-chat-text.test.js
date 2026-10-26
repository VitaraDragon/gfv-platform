import { describe, expect, it } from 'vitest';
import { cleanTextFromJsonResidue, resolveTonyUserVisibleText } from '../../core/js/tony/engine.js';

const RAW_COMMAND_MARKERS = [
  'OPEN_MODAL',
  'INJECT_FORM_DATA',
  'attivita-form',
  'attivita-modal',
  '"command"',
  '{"text"',
];

function expectSpeechOnly(text) {
  for (const marker of RAW_COMMAND_MARKERS) {
    expect(text).not.toContain(marker);
  }
  expect(text).not.toMatch(/^\s*\{/);
}

describe('chat Tony: niente JSON o comandi grezzi', () => {
  it('«quello grande»: JSON troncato con OPEN_MODAL resta solo la frase', () => {
    const raw = '{"text":"Prendo quello grande.","command":{"type":"OPEN_MODAL","id":"attiv';
    const visible = resolveTonyUserVisibleText(raw, { type: 'OPEN_MODAL', id: 'attivita-modal' });
    expect(visible.text).toBe('Prendo quello grande.');
    expectSpeechOnly(visible.text);
    expect(visible.command.type).toBe('OPEN_MODAL');
    expect(visible.command.id).toBe('attivita-modal');
    expect(cleanTextFromJsonResidue(raw)).toBe('Prendo quello grande.');
  });

  it('«con la mietitrebbia del vicino»: INJECT_FORM_DATA non entra in chat', () => {
    const raw = 'Uso la mietitrebbia del vicino. INJECT_FORM_DATA attivita-form {"attivita-note":"vicino"';
    const visible = resolveTonyUserVisibleText(raw, {
      type: 'INJECT_FORM_DATA',
      formId: 'attivita-form',
      formData: { 'attivita-note': 'mietitrebbia del vicino' },
    });
    expect(visible.text).toBe('Uso la mietitrebbia del vicino.');
    expectSpeechOnly(visible.text);
    expect(visible.command.type).toBe('INJECT_FORM_DATA');
    expect(visible.command.formId).toBe('attivita-form');
  });

  it('JSON completo nel testo: la frase è visibile e il comando è recuperato', () => {
    const raw = '{"text":"Uso la mietitrebbia del vicino.","command":{"type":"INJECT_FORM_DATA","formId":"attivita-form","formData":{"attivita-note":"vicino"}}}';
    const visible = resolveTonyUserVisibleText(raw, null);
    expect(visible.text).toBe('Uso la mietitrebbia del vicino.');
    expectSpeechOnly(visible.text);
    expect(visible.command.type).toBe('INJECT_FORM_DATA');
    expect(visible.command.formId).toBe('attivita-form');
  });

  it('replyText senza fence: OPEN_MODAL non viene stampato', () => {
    const raw = '{"action":"open_modal","modalId":"attivita-modal","replyText":"Apro il diario del campo grande.","formData":{}}';
    const visible = resolveTonyUserVisibleText(raw, null);
    expect(visible.text).toBe('Apro il diario del campo grande.');
    expectSpeechOnly(visible.text);
    expect(visible.command.type).toBe('OPEN_MODAL');
    expect(visible.command.id).toBe('attivita-modal');
  });

  it('id troncato non diventa un comando a metà', () => {
    const raw = '{"text":"Prendo quello grande.","command":{"type":"OPEN_MODAL","id":"attiv';
    const visible = resolveTonyUserVisibleText(raw, null);
    expect(visible.text).toBe('Prendo quello grande.');
    expect(visible.command).toBeNull();
  });
});
