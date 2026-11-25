/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  resolveAccontoIntent,
  parseImportoEuro,
  isConfermaAffermativa,
  todayIsoLocal
} from '../core/js/tony/tony-acconto-intent.js';

const cantinaX = {
  id: 'acq1',
  nome: 'Cantina X',
  categorieProdotto: ['uva']
};
const cantinaY = {
  id: 'acq2',
  nome: 'Cantina Y',
  categorieProdotto: ['uva']
};
const confX = {
  id: 'conf1',
  acquirenteId: 'acq1',
  categoriaProdotto: 'uva',
  annata: '2025',
  stato: 'aperto',
  labelBreve(nome) {
    return `Uva 2025, ${nome}`;
  }
};
const confY = {
  id: 'conf2',
  acquirenteId: 'acq2',
  categoriaProdotto: 'uva',
  annata: '2025',
  stato: 'aperto',
  labelBreve(nome) {
    return `Uva 2025, ${nome}`;
  }
};

describe('tony acconto intent', () => {
  it('parse importo con punto migliaia', () => {
    expect(parseImportoEuro('acconto 4.200 euro')).toBe(4200);
    expect(parseImportoEuro('4200 €')).toBe(4200);
  });

  it('caso univoco: una cantina e un conferimento → conferma', () => {
    const r = resolveAccontoIntent('è arrivato l’acconto della cantina, 4.200 euro', {
      acquirenti: [cantinaX],
      conferimenti: [confX],
      todayIso: '2026-03-20'
    });
    expect(r.handled).toBe(true);
    expect(r.stato).toBe('conferma');
    expect(r.replyText).toMatch(/4[\s.]?200\s*€/);
    expect(r.replyText).toMatch(/Uva 2025, Cantina X/);
    expect(r.pending).toEqual({
      importo: 4200,
      acquirenteId: 'acq1',
      conferimentoId: 'conf1',
      data: '2026-03-20',
      tipo: 'acconto'
    });
  });

  it('due cantine: chiede quale', () => {
    const r = resolveAccontoIntent('è arrivato l’acconto, 4200 euro', {
      acquirenti: [cantinaX, cantinaY],
      conferimenti: [confX, confY]
    });
    expect(r.stato).toBe('chiedi_acquirente');
    expect(r.opzioni).toHaveLength(2);
    expect(r.pending).toBeUndefined();
  });

  it('prodotto ambiguo: chiede categoria', () => {
    const r = resolveAccontoIntent('acconto 1000 euro', {
      acquirenti: [
        { id: '1', nome: 'Cantina', categorieProdotto: ['uva'] },
        { id: '2', nome: 'Mulino', categorieProdotto: ['seminativo'] }
      ],
      conferimenti: []
    });
    expect(r.stato).toBe('chiedi_prodotto');
  });

  it('conferma affermativa', () => {
    expect(isConfermaAffermativa('sì')).toBe(true);
    expect(isConfermaAffermativa('ok salva')).toBe(true);
    expect(isConfermaAffermativa('forse')).toBe(false);
  });

  it('todayIsoLocal a 00:30 locali (non UTC)', () => {
    const d = new Date(2026, 2, 20, 0, 30, 0);
    expect(todayIsoLocal(d)).toBe('2026-03-20');
    // In fuso a est di UTC (es. Italia) toISOString alle 00:30 locali è il giorno prima
    if (d.getTimezoneOffset() < 0) {
      expect(d.toISOString().slice(0, 10)).toBe('2026-03-19');
      expect(todayIsoLocal(d)).not.toBe(d.toISOString().slice(0, 10));
    }
    const r = resolveAccontoIntent('è arrivato l’acconto della cantina, 4.200 euro', {
      acquirenti: [cantinaX],
      conferimenti: [confX],
      now: d
    });
    expect(r.pending.data).toBe('2026-03-20');
  });
});
