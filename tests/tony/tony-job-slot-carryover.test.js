import { describe, expect, it } from 'vitest';
import { dropStaleJobCarryover } from '../../core/js/tony/engine.js';

function pushUser(history, text) {
  history.push({ role: 'user', parts: [{ text }] });
}

function pushModel(history, text) {
  history.push({ role: 'model', parts: [{ text }] });
}

describe('cambio lavoro: niente campo e ore del turno prima', () => {
  it('oliveto → ore → mietuto → grano → quello grande', () => {
    const history = [];

    pushUser(history, "o' fatto la vigna stamani");
    let out = dropStaleJobCarryover('Ok, registro sulla Vigna.', null, history, "o' fatto la vigna stamani");
    expect(out.text.toLowerCase()).toContain('vigna');
    pushModel(history, out.text);

    pushUser(history, "no aspetta, non la vigna, l'oliveto");
    out = dropStaleJobCarryover("Ok, registro sull'Oliveto del poggio.", null, history, "no aspetta, non la vigna, l'oliveto");
    expect(out.text.toLowerCase()).toContain('oliveto');
    pushModel(history, out.text);

    pushUser(history, 'due ore. anzi tre');
    out = dropStaleJobCarryover("Ok, registro tre ore sull'Oliveto del poggio.", null, history, 'due ore. anzi tre');
    expect(out.text.toLowerCase()).toContain('tre ore');
    expect(out.text.toLowerCase()).toContain('oliveto');
    pushModel(history, out.text);

    pushUser(history, 'mietuto');
    out = dropStaleJobCarryover("Ok, segno la raccolta sull'Oliveto del poggio.", null, history, 'mietuto');
    expect(out.text.toLowerCase()).not.toContain('oliveto');
    expect(out.text.toLowerCase()).not.toContain('tre ore');
    expect(out.text.toLowerCase()).toMatch(/appezzament|mietit|raccolt/);
    pushModel(history, out.text);

    pushUser(history, 'il grano');
    out = dropStaleJobCarryover('Ok, mietitura nel Campo del grano.', null, history, 'il grano');
    expect(out.text.toLowerCase()).toContain('grano');
    expect(out.text.toLowerCase()).not.toContain('oliveto');
    expect(out.text.toLowerCase()).not.toContain('tre ore');
    pushModel(history, out.text);

    pushUser(history, 'quello grande');
    out = dropStaleJobCarryover(
      'Ok, registro la mietitura del grano nel Campo del grano per tre ore.',
      {
        type: 'INJECT_FORM_DATA',
        formId: 'attivita-form',
        formData: {
          'attivita-terreno': 'Oliveto del poggio',
          'attivita-ore': '3',
        },
      },
      history,
      'quello grande'
    );
    expect(out.text.toLowerCase()).toContain('grano');
    expect(out.text.toLowerCase()).not.toContain('tre ore');
    expect(out.text.toLowerCase()).not.toContain('oliveto');
    expect(out.command.formData['attivita-terreno']).toBeUndefined();
    expect(out.command.formData['attivita-ore']).toBeUndefined();
  });

  it('mietuto con campo e ore nello stesso messaggio li tiene', () => {
    const history = [{ role: 'user', parts: [{ text: 'mietuto nel campo del grano per tre ore' }] }];
    const out = dropStaleJobCarryover(
      'Ok, registro la mietitura nel Campo del grano per tre ore.',
      {
        type: 'OPEN_MODAL',
        id: 'attivita-modal',
        fields: { 'attivita-terreno': 'Campo del grano', 'attivita-ore': '3' },
      },
      history,
      'mietuto nel campo del grano per tre ore'
    );
    expect(out.text.toLowerCase()).toContain('grano');
    expect(out.text.toLowerCase()).toContain('tre ore');
    expect(out.command.fields['attivita-terreno']).toBe('Campo del grano');
    expect(out.command.fields['attivita-ore']).toBe('3');
  });
});
