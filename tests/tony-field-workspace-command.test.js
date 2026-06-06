import { describe, it, expect } from 'vitest';
import { normalizeFieldWorkspaceTonyResult } from '../functions/tony-field-workspace-command.js';

describe('normalizeFieldWorkspaceTonyResult — CF post-process', () => {
  it('INJECT + quick-hours-form → INJECT_FORM_DATA canonico', () => {
    const out = normalizeFieldWorkspaceTonyResult({
      text: 'Ok.',
      command: {
        type: 'INJECT',
        target: 'quick-hours-form',
        parameters: { 'ora-start': '07:00', 'ora-end': '18:00', 'ora-break': '60' },
      },
    });
    expect(out.command.type).toBe('INJECT_FORM_DATA');
    expect(out.command.formId).toBe('field-workspace-ore-form');
    expect(out.command.formData['ora-inizio']).toBe('07:00');
    expect(out.command.formData['ora-pause']).toBe('60');
  });

  it('SUBMIT + quick-hours-form → QUICK_SAVE', () => {
    const out = normalizeFieldWorkspaceTonyResult({
      text: 'Salvo.',
      command: { type: 'SUBMIT', target: 'quick-hours-form' },
    });
    expect(out.command.type).toBe('QUICK_SAVE');
    expect(out.command.formId).toBe('field-workspace-ore-form');
  });

  it('lascia invariato comando già canonico', () => {
    const out = normalizeFieldWorkspaceTonyResult({
      text: 'Compilo.',
      command: {
        type: 'INJECT_FORM_DATA',
        formId: 'field-workspace-ore-form',
        formData: { 'ora-inizio': '08:00', 'ora-fine': '17:00' },
      },
    });
    expect(out.command.type).toBe('INJECT_FORM_DATA');
    expect(out.command.formData['ora-inizio']).toBe('08:00');
  });
});
