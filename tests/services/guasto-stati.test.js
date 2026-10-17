import { describe, expect, it } from 'vitest';
import {
  STATI_GUASTO_CHIUSI,
  normalizzaStatoGuasto,
  isGuastoNonDeciso,
  isGuastoChiuso,
  isGuastoAttivo,
  chiaveBadgeStatoGuasto
} from '../../core/services/guasto-stati.js';

describe('normalizzaStatoGuasto', () => {
  it('assente, vuoto o null diventano in-attesa', () => {
    expect(normalizzaStatoGuasto(undefined)).toBe('in-attesa');
    expect(normalizzaStatoGuasto(null)).toBe('in-attesa');
    expect(normalizzaStatoGuasto('')).toBe('in-attesa');
    expect(normalizzaStatoGuasto('   ')).toBe('in-attesa');
  });

  it('toglie spazi e mette in minuscolo', () => {
    expect(normalizzaStatoGuasto('  RISOLTO ')).toBe('risolto');
    expect(normalizzaStatoGuasto('Annullato')).toBe('annullato');
  });
});

describe('decisioni e chiusura', () => {
  it('senza stato il guasto non è deciso ed è attivo', () => {
    for (const stato of [undefined, null, '', '   ', 'in-attesa', ' IN-ATTESA ']) {
      expect(isGuastoNonDeciso(stato), String(stato)).toBe(true);
      expect(isGuastoChiuso(stato), String(stato)).toBe(false);
      expect(isGuastoAttivo(stato), String(stato)).toBe(true);
    }
  });

  it('risolto, annullato, riparato e chiuso sono chiusi', () => {
    expect(STATI_GUASTO_CHIUSI).toEqual(['risolto', 'annullato', 'riparato', 'chiuso']);
    for (const stato of ['risolto', 'annullato', 'riparato', 'chiuso', ' Riparato ']) {
      expect(isGuastoChiuso(stato), stato).toBe(true);
      expect(isGuastoAttivo(stato), stato).toBe(false);
      expect(isGuastoNonDeciso(stato), stato).toBe(false);
    }
  });

  it('approvato, sospeso e uno stato sconosciuto sono attivi ma già decisi', () => {
    for (const stato of ['approvato-continuazione', 'sospeso', 'boh', ' BOH ']) {
      expect(isGuastoAttivo(stato), stato).toBe(true);
      expect(isGuastoNonDeciso(stato), stato).toBe(false);
      expect(isGuastoChiuso(stato), stato).toBe(false);
    }
  });
});

describe('chiaveBadgeStatoGuasto', () => {
  it('riparato e chiuso usano il badge risolto', () => {
    expect(chiaveBadgeStatoGuasto('riparato')).toBe('risolto');
    expect(chiaveBadgeStatoGuasto('chiuso')).toBe('risolto');
    expect(chiaveBadgeStatoGuasto('risolto')).toBe('risolto');
  });

  it('tiene le chiavi note e segna sconosciuto il resto', () => {
    expect(chiaveBadgeStatoGuasto(null)).toBe('in-attesa');
    expect(chiaveBadgeStatoGuasto('approvato-continuazione')).toBe('approvato-continuazione');
    expect(chiaveBadgeStatoGuasto('sospeso')).toBe('sospeso');
    expect(chiaveBadgeStatoGuasto('annullato')).toBe('annullato');
    expect(chiaveBadgeStatoGuasto('boh')).toBe('sconosciuto');
  });
});
