import { cleanTextFromJsonResidue } from '../../core/js/tony/engine.js';

describe('cleanTextFromJsonResidue (riepilogo + commands leak)', () => {
  it('rimuove coda "commands" con QUICK_SAVE', () => {
    const raw =
      'text": "Ricapitolando: Lavoro: Erpicatura, Pausa: 45 minuti. Confermi?", "commands": [ { "type": "QUICK_SAVE", "formId": "quick-hours-form" } ]';
    const out = cleanTextFromJsonResidue(raw);
    expect(out).not.toMatch(/QUICK_SAVE/);
    expect(out).toMatch(/Ricapitolando/);
    expect(out).toMatch(/Confermi/);
  });
});
