import { describe, expect, it } from 'vitest';
import {
  STATI_LAVORO_SOSPENDIBILI,
  buildSospendiLavoroPatch,
  formatSospensioneCausa,
  isLavoroStatoSospendibile,
  parseSospensioneCausa,
  sospensioneFieldsForModificaSave,
  validateSospensioneInput,
} from '../../core/services/lavoro-sospensione.js';

describe('sospensione operativa vs standby assenza', () => {
  it('il bottone manager segue gli stati del Capo, non lo standby', () => {
    expect(STATI_LAVORO_SOSPENDIBILI).toEqual(['assegnato', 'in_corso', 'attivo']);
    for (const stato of ['assegnato', 'in_corso', 'attivo', '', null, undefined]) {
      expect(isLavoroStatoSospendibile(stato)).toBe(true);
    }
    for (const stato of [
      'sospeso',
      'in_standby',
      'completato',
      'completato_da_approvare',
      'annullato',
      'da_pianificare',
    ]) {
      expect(isLavoroStatoSospendibile(stato)).toBe(false);
    }
  });

  it('maltempo e guasto accettano la nota; Altro senza nota no', () => {
    expect(formatSospensioneCausa('maltempo', '')).toBe('Maltempo');
    expect(formatSospensioneCausa('maltempo', ' grandine ')).toBe('Maltempo: grandine');
    expect(formatSospensioneCausa('guasto', '')).toBe('Guasto');
    expect(formatSospensioneCausa('guasto', 'trattore')).toBe('Guasto: trattore');
    expect(validateSospensioneInput('altro', '').ok).toBe(false);
    expect(validateSospensioneInput('altro', 'nebbia fitta').causa).toBe('Altro: nebbia fitta');
    expect(validateSospensioneInput('', '').ok).toBe(false);
    expect(validateSospensioneInput('ferie', '').ok).toBe(false);
  });

  it('la patch di sospendiLavoro è sospeso + causa, senza campi standby', () => {
    const now = new Date('2026-10-07T10:00:00');
    const missing = buildSospendiLavoroPatch('  ');
    expect(missing.ok).toBe(false);
    expect(missing.patch).toBeNull();

    const built = buildSospendiLavoroPatch('Maltempo', now);
    expect(built.ok).toBe(true);
    expect(Object.keys(built.patch).sort()).toEqual([
      'aggiornatoIl',
      'sospensioneCausa',
      'sospensioneIl',
      'stato',
    ]);
    expect(built.patch.stato).toBe('sospeso');
    expect(built.patch.sospensioneCausa).toBe('Maltempo');
    expect(built.patch.sospensioneIl).toBe(now);
    expect(built.patch.aggiornatoIl).toBe(now);
    expect(built.patch.standbyCausa).toBeUndefined();
    expect(built.patch.standbyNota).toBeUndefined();
    expect(built.patch.standbyGiornoKey).toBeUndefined();
    expect(JSON.stringify(built.patch)).not.toContain('in_standby');
  });

  it('Modifica: passaggio a sospeso scrive la causa e il timestamp', () => {
    const plan = sospensioneFieldsForModificaSave({
      nuovoStato: 'sospeso',
      statoPrecedente: 'assegnato',
      motivo: 'guasto',
      note: '',
      sospensioneCausaEsistente: '',
      hasSospensioneIl: false,
    });
    expect(plan.ok).toBe(true);
    expect(plan.fields).toEqual({
      sospensioneCausa: 'Guasto',
      writeSospensioneIl: true,
    });
    expect(plan.fields.standbyCausa).toBeUndefined();
  });

  it('Modifica: senza motivo non salva; se non è sospeso non inventa campi', () => {
    const blocked = sospensioneFieldsForModificaSave({
      nuovoStato: 'sospeso',
      statoPrecedente: 'in_corso',
      motivo: '',
      note: '',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.fields).toBeNull();

    const altro = sospensioneFieldsForModificaSave({
      nuovoStato: 'sospeso',
      statoPrecedente: 'assegnato',
      motivo: 'altro',
      note: '',
    });
    expect(altro.ok).toBe(false);

    const aperto = sospensioneFieldsForModificaSave({
      nuovoStato: 'in_corso',
      statoPrecedente: 'assegnato',
      motivo: 'maltempo',
      note: 'pioggia',
    });
    expect(aperto).toEqual({ ok: true, fields: null });

    const ripreso = sospensioneFieldsForModificaSave({
      nuovoStato: 'in_corso',
      statoPrecedente: 'sospeso',
      sospensioneCausaEsistente: 'Guasto macchina grave',
      hasSospensioneIl: true,
    });
    expect(ripreso).toEqual({ ok: true, fields: { clearSospensione: true } });
  });

  it('Modifica: lavoro già sospeso non ricalcola sospensioneIl e tiene il testo del Capo', () => {
    expect(parseSospensioneCausa('pioggia forte')).toEqual({
      motivo: 'altro',
      note: 'pioggia forte',
    });
    const invariata = sospensioneFieldsForModificaSave({
      nuovoStato: 'sospeso',
      statoPrecedente: 'sospeso',
      motivo: 'altro',
      note: 'pioggia forte',
      sospensioneCausaEsistente: 'pioggia forte',
      hasSospensioneIl: true,
    });
    expect(invariata.fields).toEqual({
      sospensioneCausa: 'pioggia forte',
      writeSospensioneIl: false,
    });

    const cambio = sospensioneFieldsForModificaSave({
      nuovoStato: 'sospeso',
      statoPrecedente: 'sospeso',
      motivo: 'maltempo',
      note: 'grandine',
      sospensioneCausaEsistente: 'Guasto',
      hasSospensioneIl: true,
    });
    expect(cambio.fields).toEqual({
      sospensioneCausa: 'Maltempo: grandine',
      writeSospensioneIl: false,
    });
  });
});
