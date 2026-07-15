import { describe, expect, it, beforeEach } from 'vitest';
import {
  ensureMacchinaOptionInSelect,
  populateTrattoriDropdown,
  populateAttrezziDropdown,
  populateOperaiDropdown,
  manodoperaUserMatchesId,
} from '../core/admin/js/gestione-lavori-controller.js';

function setupSelect(id) {
  const select = document.createElement('select');
  select.id = id;
  document.body.appendChild(select);
  return select;
}

describe('gestione lavori — macchine form', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('ensureMacchinaOptionInSelect aggiunge trattore assegnato assente dalla lista', () => {
    const select = setupSelect('lavoro-trattore');
    ensureMacchinaOptionInSelect(select, 't1', [], 'Trattore assegnato');
    expect(select.value).toBe('');
    select.value = 't1';
    expect(select.value).toBe('t1');
    expect(select.options.length).toBe(1);
  });

  it('populateTrattoriDropdown seleziona trattore in_uso se è quello del lavoro', () => {
    setupSelect('lavoro-trattore');
    populateTrattoriDropdown(
      [{ id: 't1', nome: 'Fendt', stato: 'in_uso', cavalli: 120 }],
      't1'
    );
    const select = document.getElementById('lavoro-trattore');
    expect(select.value).toBe('t1');
  });

  it('populateAttrezziDropdown include attrezzo assegnato anche se CV incompatibile', () => {
    setupSelect('lavoro-trattore');
    setupSelect('lavoro-attrezzo');
    const attrezzoGroup = document.createElement('div');
    attrezzoGroup.id = 'attrezzo-group';
    document.body.appendChild(attrezzoGroup);

    populateAttrezziDropdown(
      't1',
      [{ id: 't1', nome: 'Fendt', cavalli: 50 }],
      [{ id: 'a1', nome: 'Erpice pesante', cavalliMinimiRichiesti: 100, stato: 'disponibile' }],
      () => 'Cat',
      'a1'
    );

    const select = document.getElementById('lavoro-attrezzo');
    expect(select.value).toBe('a1');
    expect(Array.from(select.options).some((o) => o.value === 'a1')).toBe(true);
  });

  it('manodoperaUserMatchesId accetta id doc o uid auth', () => {
    const op = { id: 'doc123', uid: 'auth456' };
    expect(manodoperaUserMatchesId(op, 'doc123')).toBe(true);
    expect(manodoperaUserMatchesId(op, 'auth456')).toBe(true);
    expect(manodoperaUserMatchesId(op, 'other')).toBe(false);
  });

  it('populateOperaiDropdown seleziona operaio per uid salvato nel lavoro', () => {
    setupSelect('lavoro-operaio');
    populateOperaiDropdown(
      [{ id: 'doc123', uid: 'auth456', nome: 'Mario', cognome: 'Rossi' }],
      'auth456'
    );
    const select = document.getElementById('lavoro-operaio');
    expect(select.value).toBe('doc123');
  });
});
