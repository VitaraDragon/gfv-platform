import { describe, test, expect } from 'vitest';
import {
  isLavoroVendemmiaMeccanica,
  isPreventivoVendemmiaMeccanica,
  isPreventivoAccettato,
  deriveAnnoStagioneFromPreventivo,
  countZoneLavorateSameDay,
  toDateKeyString,
  getSogliaMinimaSegnaCompletato,
  isCompletamentoParzialeTracciato,
  getEtichettaSegnaCompletato,
  isPianoStagioneLinkedToLavoro
} from '../../modules/vendemmia-meccanica/services/lavoro-vm-utils.js';

describe('lavoro-vm-utils', () => {
  test('isPreventivoVendemmiaMeccanica e deriveAnnoStagioneFromPreventivo', () => {
    expect(isPreventivoVendemmiaMeccanica({ tipoLavoro: 'Vendemmia meccanica' })).toBe(true);
    expect(isPreventivoVendemmiaMeccanica({ tipoLavoro: 'Potatura' })).toBe(false);
    expect(deriveAnnoStagioneFromPreventivo({ dataPrevista: '2026-09-15' }, 2025)).toBe(2026);
    expect(isPreventivoAccettato('accettato_manager')).toBe(true);
    expect(isPreventivoAccettato('inviato')).toBe(false);
  });

  test('isLavoroVendemmiaMeccanica per tipo lavoro', () => {
    expect(isLavoroVendemmiaMeccanica({ tipoLavoro: 'Vendemmia meccanica' })).toBe(true);
    expect(isLavoroVendemmiaMeccanica({ tipoLavoro: 'Potatura' })).toBe(false);
  });

  test('isLavoroVendemmiaMeccanica CT con preventivo', () => {
    expect(isLavoroVendemmiaMeccanica({
      tipoLavoro: 'Vendemmia',
      clienteId: 'c1',
      preventivoId: 'p1'
    }, { hasVmModule: true })).toBe(true);
  });

  test('countZoneLavorateSameDay', () => {
    const zones = [
      { dataKeyString: '2026-07-05' },
      { dataKeyString: '2026-07-05' },
      { dataKeyString: '2026-07-04' }
    ];
    expect(countZoneLavorateSameDay(zones, '2026-07-05')).toBe(2);
  });

  test('getSogliaMinimaSegnaCompletato — VM consente chiusura parziale', () => {
    expect(getSogliaMinimaSegnaCompletato({ tipoLavoro: 'Potatura' })).toBe(90);
    expect(getSogliaMinimaSegnaCompletato({ tipoLavoro: 'Vendemmia meccanica' }, { hasVmModule: true })).toBe(10);
    expect(getSogliaMinimaSegnaCompletato({ ripresaDaLavoroId: 'x' })).toBe(2);
  });

  test('isCompletamentoParzialeTracciato e etichetta', () => {
    const vm = { tipoLavoro: 'Vendemmia meccanica' };
    expect(isCompletamentoParzialeTracciato(75, vm, { hasVmModule: true })).toBe(true);
    expect(getEtichettaSegnaCompletato(75, vm, { hasVmModule: true })).toContain('parziale');
    expect(isCompletamentoParzialeTracciato(95, vm, { hasVmModule: true })).toBe(false);
  });

  test('toDateKeyString', () => {
    expect(toDateKeyString(new Date('2026-07-05T10:00:00Z'))).toBe('2026-07-05');
  });

  test('isPianoStagioneLinkedToLavoro', () => {
    expect(isPianoStagioneLinkedToLavoro(null, 'l1')).toBe(false);
    expect(isPianoStagioneLinkedToLavoro({ vendemmiato: true, lavoroId: 'l1' }, 'l1')).toBe(true);
    expect(isPianoStagioneLinkedToLavoro({ vendemmiato: true, lavoroId: 'l2' }, 'l1')).toBe(false);
    expect(isPianoStagioneLinkedToLavoro({ vendemmiato: true }, 'l1')).toBe(true);
  });
});
