import { describe, expect, it } from 'vitest';
import { macchinaSelezionabile, suffissoMacchinaNonSelezionabile } from '../core/js/macchina-selezionabile.js';

describe('macchinaSelezionabile', () => {
  const guasta = { id: 'm1', nome: 'Lamborghini', stato: 'guasto', tipoMacchina: 'trattore' };
  const inCorso = { id: 'm2', nome: 'Fiat', stato: 'guasto-lavoro-in-corso', tipoMacchina: 'trattore' };
  const officina = { id: 'm3', nome: 'Same', stato: 'in_manutenzione', tipoMacchina: 'trattore' };
  const dismessa = { id: 'm4', nome: 'Vecchia', stato: 'dismesso', tipoMacchina: 'trattore' };
  const libera = { id: 'm5', nome: 'Fendt', stato: 'disponibile', tipoMacchina: 'trattore' };

  it('esclude guasto, guasto in corso, manutenzione e dismesso nei form nuovi', () => {
    for (const ctx of ['nuovo-lavoro', 'nuove-ore', 'nuovo-guasto']) {
      expect(macchinaSelezionabile(guasta, { contesto: ctx }).ok).toBe(false);
      expect(macchinaSelezionabile(inCorso, { contesto: ctx }).ok).toBe(false);
      expect(macchinaSelezionabile(officina, { contesto: ctx }).ok).toBe(false);
      expect(macchinaSelezionabile(dismessa, { contesto: ctx }).ok).toBe(false);
      expect(macchinaSelezionabile(libera, { contesto: ctx }).ok).toBe(true);
    }
  });

  it('in sola visualizzazione le mostra tutte', () => {
    expect(macchinaSelezionabile(guasta, { contesto: 'visualizzazione' }).ok).toBe(true);
    expect(macchinaSelezionabile(dismessa, 'visualizzazione').ok).toBe(true);
  });

  it('il mezzo già assegnato al lavoro che si modifica resta selezionabile', () => {
    expect(macchinaSelezionabile(guasta, {
      contesto: 'nuovo-lavoro',
      giaAssegnataAlLavoro: true
    }).ok).toBe(true);
    expect(macchinaSelezionabile(guasta, {
      contesto: 'nuovo-guasto',
      giaAssegnataAlLavoro: true
    }).ok).toBe(false);
  });

  it('un guasto aperto sulla stessa macchina la segna già in guasto', () => {
    const esito = macchinaSelezionabile(libera, { contesto: 'nuovo-guasto', guastoAperto: true });
    expect(esito.ok).toBe(false);
    expect(suffissoMacchinaNonSelezionabile(esito)).toBe(' (già in guasto)');
  });
});
