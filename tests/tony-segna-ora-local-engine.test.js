import { describe, it, expect } from 'vitest';
import {
  SEGNA_ORE_ASK_FALLBACK,
  buildSegnaOreMissingFieldsMessage,
  listSegnaOreMissingRequired,
  userBlobAcknowledgesZeroPause,
  getSegnaOreDomFieldIds,
} from '../core/js/tony/tony-segna-ora-local-engine.js';

describe('tony-segna-ora-local-engine', () => {
  it('SEGNA_ORE_ASK_FALLBACK elenca tutti i campi principali', () => {
    expect(SEGNA_ORE_ASK_FALLBACK).toMatch(/inizio/i);
    expect(SEGNA_ORE_ASK_FALLBACK).toMatch(/fine/i);
    expect(SEGNA_ORE_ASK_FALLBACK).toMatch(/pausa/i);
  });

  it('listSegnaOreMissingRequired — tutti i campi se stato vuoto', () => {
    var missing = listSegnaOreMissingRequired({
      lavoroVal: '',
      dateVal: '',
      startVal: '',
      endVal: '',
      pauseVal: '',
    });
    expect(missing).toContain('data');
    expect(missing).toContain('orario di inizio');
    expect(missing).toContain('orario di fine');
  });

  it('listSegnaOreMissingRequired — solo pausa se orari ok', () => {
    var missing = listSegnaOreMissingRequired({
      lavoroVal: 'abc',
      dateVal: '2026-07-11',
      startVal: '07:00',
      endVal: '18:00',
      pauseVal: '',
    }, { requireLavoro: false });
    expect(missing).toEqual(['minuti di pausa']);
  });

  it('buildSegnaOreMissingFieldsMessage — richiesta raggruppata', () => {
    var msg = buildSegnaOreMissingFieldsMessage({
      lavoroVal: 'x',
      dateVal: '2026-07-11',
      startVal: '',
      endVal: '',
      pauseVal: '',
    }, { requireLavoro: false });
    expect(msg).toMatch(/Mi servono:/);
    expect(msg).toMatch(/inizio/);
    expect(msg).toMatch(/fine/);
  });

  it('buildSegnaOreMissingFieldsMessage — conferma save se completo', () => {
    var msg = buildSegnaOreMissingFieldsMessage({
      lavoroVal: 'x',
      dateVal: '2026-07-11',
      startVal: '07:00',
      endVal: '18:00',
      pauseVal: '0',
    }, { requireLavoro: false, pauseAcknowledged: true });
    expect(msg).toMatch(/salvare/i);
  });

  it('userBlobAcknowledgesZeroPause', () => {
    expect(userBlobAcknowledgesZeroPause('0')).toBe(true);
    expect(userBlobAcknowledgesZeroPause('nessuna pausa')).toBe(true);
    expect(userBlobAcknowledgesZeroPause('30')).toBe(false);
  });

  it('getSegnaOreDomFieldIds — mobile vs desktop', () => {
    expect(getSegnaOreDomFieldIds('quick-hours').start).toBe('ora-start');
    expect(getSegnaOreDomFieldIds('ora-modal').start).toBe('ora-inizio');
  });
});
