import { describe, it, expect } from 'vitest';
import {
  SEGNA_ORE_ASK_FALLBACK,
  buildSegnaOreMissingFieldsMessage,
  listSegnaOreMissingRequired,
  userBlobAcknowledgesZeroPause,
  extractSegnaOrePauseMinutesFromUserBlob,
  getSegnaOreDomFieldIds,
  filtraCampiMezzoNonNominati,
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

  it('buildSegnaOreMissingFieldsMessage — il riepilogo dice il lavoro', () => {
    var msg = buildSegnaOreMissingFieldsMessage({
      lavoroVal: 'rip',
      dateVal: '2026-10-08',
      startVal: '17:00',
      endVal: '17:30',
      pauseVal: '0',
    }, {
      requireLavoro: true,
      pauseAcknowledged: true,
      lavoroNome: 'Ripristino pali',
      macchinaNome: 'Fiat 880 DT',
      attrezzoNome: 'Berti',
    });
    expect(msg).toMatch(/Tutto pronto: Ripristino pali, dalle 17:00 alle 17:30, pausa 0 min, Fiat 880 DT e Berti/);
    expect(msg).toMatch(/Vuoi salvare/);
  });

  it('userBlobAcknowledgesZeroPause', () => {
    expect(userBlobAcknowledgesZeroPause('0')).toBe(true);
    expect(userBlobAcknowledgesZeroPause('nessuna pausa')).toBe(true);
    expect(userBlobAcknowledgesZeroPause('30')).toBe(false);
  });

  it('extractSegnaOrePauseMinutesFromUserBlob — vocale «con pausa 30»', () => {
    expect(extractSegnaOrePauseMinutesFromUserBlob('dalle 7:00 alle 17:30 con pausa 30')).toBe(30);
    expect(extractSegnaOrePauseMinutesFromUserBlob('dalle 6 alle 18 con 30 min di pausa')).toBe(30);
    expect(extractSegnaOrePauseMinutesFromUserBlob('dalle 6 alle 18')).toBeNull();
  });

  it('getSegnaOreDomFieldIds — mobile vs desktop', () => {
    expect(getSegnaOreDomFieldIds('quick-hours').start).toBe('ora-start');
    expect(getSegnaOreDomFieldIds('ora-modal').start).toBe('ora-inizio');
  });

  it('la pausa 0 del form non conta finché non è confermata', () => {
    var missing = listSegnaOreMissingRequired({
      lavoroVal: 'abc',
      dateVal: '2026-10-08',
      startVal: '10:00',
      endVal: '11:00',
      pauseVal: '0',
    }, { requireLavoro: false });
    expect(missing).toEqual(['minuti di pausa']);
    var ok = listSegnaOreMissingRequired({
      lavoroVal: 'abc',
      dateVal: '2026-10-08',
      startVal: '10:00',
      endVal: '11:00',
      pauseVal: '0',
    }, { requireLavoro: false, pauseAcknowledged: true });
    expect(ok).toEqual([]);
  });

  it('userBlobAcknowledgesZeroPause riconosce pausa 0 nella frase', () => {
    expect(userBlobAcknowledgesZeroPause('dalle 10 alle 11 pausa 0')).toBe(true);
    expect(userBlobAcknowledgesZeroPause('pausa 0')).toBe(true);
    expect(userBlobAcknowledgesZeroPause('senza pausa')).toBe(true);
  });

  it('filtraCampiMezzoNonNominati scarta i mezzi non detti e tiene quelli nominati', () => {
    var conMezzi = {
      'ora-lavoro': 'lav1',
      'ora-macchina': 'Landini',
      'ora-attrezzo': 'rimorchio',
      'ora-ore-macchina': '2',
    };
    var scartati = filtraCampiMezzoNonNominati(conMezzi, 'dalle 10 alle 11 pausa 0');
    expect(scartati['ora-lavoro']).toBe('lav1');
    expect(scartati['ora-macchina']).toBeUndefined();
    expect(scartati['ora-attrezzo']).toBeUndefined();
    expect(scartati['ora-ore-macchina']).toBeUndefined();

    var tenuti = filtraCampiMezzoNonNominati(conMezzi, 'uso il trattore Landini');
    expect(tenuti['ora-macchina']).toBe('Landini');
    expect(tenuti['ora-attrezzo']).toBe('rimorchio');
  });

  it('filtraCampiMezzoNonNominati scarta Landini e Rimorchio se il modello li copia e l’utente non li nomina', () => {
    var daModello = {
      'ora-lavoro': 'potatura',
      'ora-macchina': 'Landini',
      'ora-attrezzo': 'Rimorchio',
    };
    var senza = filtraCampiMezzoNonNominati(daModello, 'segna le ore dalle 10 alle 11 sul lavoro potatura');
    expect(senza['ora-lavoro']).toBe('potatura');
    expect(senza['ora-macchina']).toBeUndefined();
    expect(senza['ora-attrezzo']).toBeUndefined();

    var conLandini = filtraCampiMezzoNonNominati(daModello, 'segna le ore dalle 10 alle 11 sul lavoro potatura col Landini');
    expect(conLandini['ora-macchina']).toBe('Landini');
    expect(conLandini['ora-attrezzo']).toBe('Rimorchio');
  });
});
