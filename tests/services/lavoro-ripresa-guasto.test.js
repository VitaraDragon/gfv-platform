import { describe, expect, it } from 'vitest';
import {
  AZZERA_CAMPO,
  lavoroSospesoDaGuasto,
  statoDopoRipresa,
  buildRiprendiLavoroPatch,
  patchRipresaPerFirestore,
  haAltriGuastiApertiStessoLavoro,
  esitoRipresaDopoGuasto,
  testoToastRipresa,
  statoPerSelectModifica,
  erroreSalvataggioStato
} from '../../core/services/lavoro-ripresa-guasto.js';

describe('lavoroSospesoDaGuasto', () => {
  it('riconosce la causa scritta dalla sospensione', () => {
    expect(lavoroSospesoDaGuasto({
      stato: 'sospeso',
      sospensioneCausa: 'Guasto macchina grave'
    })).toBe(true);
    expect(lavoroSospesoDaGuasto({
      stato: 'sospeso',
      sospensioneCausa: 'guasto: olio'
    })).toBe(true);
    expect(lavoroSospesoDaGuasto({
      stato: 'sospeso',
      sospensioneCausa: 'Segnalazione grave'
    })).toBe(true);
  });

  it('non tocca maltempo né un lavoro che non è sospeso', () => {
    expect(lavoroSospesoDaGuasto({
      stato: 'sospeso',
      sospensioneCausa: 'Maltempo'
    })).toBe(false);
    expect(lavoroSospesoDaGuasto({
      stato: 'in_corso',
      sospensioneCausa: 'Guasto macchina grave'
    })).toBe(false);
  });

  it('accetta il motivo storico se la causa nuova manca', () => {
    expect(lavoroSospesoDaGuasto({
      stato: 'sospeso',
      motivoSospensione: 'Guasto macchina grave'
    })).toBe(true);
    expect(lavoroSospesoDaGuasto({
      stato: 'sospeso',
      motivoSospensione: 'Segnalazione grave'
    })).toBe(true);
    expect(lavoroSospesoDaGuasto({
      stato: 'sospeso',
      sospensioneCausa: 'Maltempo',
      motivoSospensione: 'Guasto macchina grave'
    })).toBe(false);
  });
});

describe('statoDopoRipresa', () => {
  it('in corso se c’è avanzamento, assegnato se il lavoro non è partito', () => {
    expect(statoDopoRipresa({ percentualeCompletamento: 21.6 })).toBe('in_corso');
    expect(statoDopoRipresa({ superficieTotaleLavorata: 0.4 })).toBe('in_corso');
    expect(statoDopoRipresa({ oreRegistrate: 2 })).toBe('in_corso');
    expect(statoDopoRipresa({ zoneLavorate: [{ id: 'z1' }] })).toBe('in_corso');
    expect(statoDopoRipresa({ percentualeCompletamento: 0 })).toBe('assegnato');
    expect(statoDopoRipresa({})).toBe('assegnato');
  });
});

describe('buildRiprendiLavoroPatch', () => {
  it('non scrive mai attivo e azzera la sospensione', () => {
    const now = new Date('2026-10-10T10:00:00Z');
    const patch = buildRiprendiLavoroPatch({ percentualeCompletamento: 10 }, now);
    expect(patch.stato).toBe('in_corso');
    expect(patch.stato).not.toBe('attivo');
    expect(patch.sospensioneCausa).toBe(AZZERA_CAMPO);
    expect(patch.sospensioneIl).toBe(AZZERA_CAMPO);
    expect(patch.aggiornatoIl).toBe(now);
    expect(JSON.stringify(patch)).not.toContain('attivo');

    const vuoto = buildRiprendiLavoroPatch({}, now);
    expect(vuoto.stato).toBe('assegnato');
  });

  it('converte il marcatore nel valore di deleteField', () => {
    const patch = buildRiprendiLavoroPatch({}, new Date());
    const pronto = patchRipresaPerFirestore(patch, () => 'DELETE');
    expect(pronto.stato).toBe('assegnato');
    expect(pronto.sospensioneCausa).toBe('DELETE');
    expect(pronto.sospensioneIl).toBe('DELETE');
  });
});

describe('altri guasti aperti sullo stesso lavoro', () => {
  const guasti = [
    { id: 'g1', lavoroId: 'L1', stato: 'risolto' },
    { id: 'g2', lavoroId: 'L1', stato: 'in-attesa' },
    { id: 'g3', lavoroId: 'L2', stato: 'in-attesa' }
  ];

  it('blocca la ripresa se ne resta uno aperto', () => {
    expect(haAltriGuastiApertiStessoLavoro(guasti, 'L1', 'g1')).toBe(true);
    const lavoro = { id: 'L1', stato: 'sospeso', sospensioneCausa: 'Guasto macchina grave' };
    expect(esitoRipresaDopoGuasto({ lavoro, guasti, guastoId: 'g1' }).riprendi).toBe(false);
    expect(testoToastRipresa('Controllo ristagni', { altroGuasto: true }))
      .toBe('Guasto risolto. Il lavoro è ancora sospeso per un altro guasto.');
  });

  it('riprende quando l’unico guasto del lavoro è quello appena chiuso', () => {
    const solo = [{ id: 'g1', lavoroId: 'L1', stato: 'in-attesa' }];
    const lavoro = { id: 'L1', stato: 'sospeso', sospensioneCausa: 'Guasto macchina grave', percentualeCompletamento: 21.6 };
    expect(esitoRipresaDopoGuasto({ lavoro, guasti: solo, guastoId: 'g1' }).riprendi).toBe(true);
    expect(testoToastRipresa('Controllo ristagni', { ripreso: true }))
      .toBe('Guasto risolto. Il lavoro "Controllo ristagni" è ripreso.');
    expect(testoToastRipresa('Controllo ristagni', { fallita: true }))
      .toContain('Gestione lavori');
  });
});

describe('statoPerSelectModifica', () => {
  it('mappa attivo a in corso e blocca uno stato sconosciuto', () => {
    expect(statoPerSelectModifica('attivo').valore).toBe('in_corso');
    expect(statoPerSelectModifica('in_corso').nonValido).toBe(false);
    const strano = statoPerSelectModifica('bozza');
    expect(strano.nonValido).toBe(true);
    expect(strano.etichettaExtra).toBe('Stato non valido: bozza');
    expect(erroreSalvataggioStato('__non_valido__')).toMatch(/stato valido/i);
    expect(erroreSalvataggioStato('')).toMatch(/stato valido/i);
    expect(erroreSalvataggioStato('attivo')).toMatch(/stato valido/i);
    expect(erroreSalvataggioStato('in_corso')).toBe('');
  });
});
