import { describe, it, expect } from 'vitest';
import { normalizeTonyCommand } from '../core/js/tony/engine.js';

describe('normalizeTonyCommand — alias INJECT/SUBMIT workspace campo', () => {
  it('INJECT + quick-hours-form → INJECT_FORM_DATA field-workspace-ore-form', () => {
    const cmd = normalizeTonyCommand({
      type: 'INJECT',
      target: 'quick-hours-form',
      parameters: { 'ora-start': '07:00', 'ora-end': '18:00', 'ora-break': '60' },
    });
    expect(cmd.type).toBe('INJECT_FORM_DATA');
    expect(cmd.formId).toBe('field-workspace-ore-form');
    expect(cmd.formData['ora-inizio']).toBe('07:00');
    expect(cmd.formData['ora-fine']).toBe('18:00');
    expect(cmd.formData['ora-pause']).toBe('60');
  });

  it('SUBMIT + quick-hours-form → QUICK_SAVE field-workspace-ore-form', () => {
    const cmd = normalizeTonyCommand({
      type: 'SUBMIT',
      target: 'quick-hours-form',
    });
    expect(cmd.type).toBe('QUICK_SAVE');
    expect(cmd.formId).toBe('field-workspace-ore-form');
  });

  it('action inject → INJECT_FORM_DATA con formId da target', () => {
    const cmd = normalizeTonyCommand({
      action: 'inject',
      target: 'field-workspace-ore-form',
      parameters: { 'ora-inizio': '08:00', 'ora-fine': '17:00' },
    });
    expect(cmd.type).toBe('INJECT_FORM_DATA');
    expect(cmd.formId).toBe('field-workspace-ore-form');
    expect(cmd.formData['ora-inizio']).toBe('08:00');
  });

  it('SUBMIT su altro form → SUBMIT_FORM', () => {
    const cmd = normalizeTonyCommand({
      type: 'SUBMIT',
      target: 'attivita-form',
    });
    expect(cmd.type).toBe('SUBMIT_FORM');
    expect(cmd.formId).toBe('attivita-form');
  });

  it('INJECT_FORM_DATA canonico invariato', () => {
    const cmd = normalizeTonyCommand({
      type: 'INJECT_FORM_DATA',
      formId: 'field-workspace-ore-form',
      formData: { 'ora-inizio': '07:00', 'ora-fine': '18:00', 'ora-pause': '30' },
    });
    expect(cmd.type).toBe('INJECT_FORM_DATA');
    expect(cmd.formData['ora-pause']).toBe('30');
  });
});
