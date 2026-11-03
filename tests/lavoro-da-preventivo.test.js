/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  filtraLavoriPerDiarioContoTerzi,
  lavoroDaPreventivo
} from '../modules/conto-terzi/js/lavoro-da-preventivo.js';
import { lavoriDiarioContoTerziVisibili } from '../core/js/attivita-controller.js';

describe('lavoroDaPreventivo (#32)', () => {
  const preventivo = {
    id: 'p1',
    numero: 'CT-1',
    tipoLavoro: 'Potatura',
    coltura: 'Vite',
    clienteId: 'c1',
    note: 'nota'
  };

  it('senza Manodopera → in_corso e link al Diario', () => {
    const r = lavoroDaPreventivo(preventivo, { hasManodopera: false, terrenoId: 't1' });
    expect(r.stato).toBe('in_corso');
    expect(r.lavoroData.stato).toBe('in_corso');
    expect(r.registroHref).toContain('attivita-standalone.html');
    expect(r.toastMessage).toMatch(/Diario Conto Terzi/i);
  });

  it('con Manodopera → da_pianificare', () => {
    const r = lavoroDaPreventivo(preventivo, { hasManodopera: true, terrenoId: 't1' });
    expect(r.stato).toBe('da_pianificare');
    expect(r.lavoroData.stato).toBe('da_pianificare');
    expect(r.registroHref).toContain('gestione-lavori');
    expect(r.toastMessage).toMatch(/Gestione Lavori/i);
  });
});

describe('populateLavoriDropdown / filtro CT senza Manodopera', () => {
  const lavori = [
    { id: 'a', stato: 'in_corso', clienteId: 'c1', nome: 'A' },
    { id: 'b', stato: 'da_pianificare', clienteId: 'c1', nome: 'B' },
    { id: 'c', stato: 'da_pianificare', clienteId: null, nome: 'C' },
    { id: 'd', stato: 'completato', clienteId: 'c1', nome: 'D' }
  ];

  it('senza Manodopera un lavoro CT da_pianificare compare', () => {
    const filtrati = filtraLavoriPerDiarioContoTerzi(lavori, { hasManodopera: false });
    expect(filtrati.map((l) => l.id).sort()).toEqual(['a', 'b']);
    expect(lavoriDiarioContoTerziVisibili(lavori, false).map((l) => l.id).sort()).toEqual(['a', 'b']);
  });

  it('con Manodopera i da_pianificare non compaiono', () => {
    const filtrati = filtraLavoriPerDiarioContoTerzi(lavori, { hasManodopera: true });
    expect(filtrati.map((l) => l.id)).toEqual(['a']);
    expect(lavoriDiarioContoTerziVisibili(lavori, true).map((l) => l.id)).toEqual(['a']);
  });
});
