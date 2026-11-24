/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  bumpOreMacchinaPerMezzo,
  costiMacchineFromOreMap,
  manutenzioneStatus,
  oreMacchinaMapFromAttivita,
  oreMacchinaMapFromOreDocs,
  resolveCostoOraMacchina
} from '../modules/report/services/report-macchine-shared.js';
import { sumCostoMacchineLikeEconomici } from '../modules/report/services/report-macchine-aggregate.js';

describe('report-macchine-shared', () => {
  it('accumula ore su trattore e attrezzo distinti (stessa regola Economici)', () => {
    /** @type {Record<string, number>} */
    const map = {};
    bumpOreMacchinaPerMezzo(map, {
      oreMacchina: 3,
      macchinaId: 't1',
      attrezzoId: 'a1',
      stato: 'validate'
    });
    expect(map).toEqual({ t1: 3, a1: 3 });
  });

  it('non raddoppia se attrezzoId === macchinaId', () => {
    /** @type {Record<string, number>} */
    const map = {};
    bumpOreMacchinaPerMezzo(map, { oreMacchina: 2, macchinaId: 'x', attrezzoId: 'x' });
    expect(map).toEqual({ x: 2 });
  });

  it('resolveCostoOraMacchina: missing se assente o ≤0', () => {
    const m = new Map([['ok', 40], ['zero', 0]]);
    expect(resolveCostoOraMacchina(m, 'ok')).toEqual({ inAnagrafica: true, costoOra: 40, missing: false });
    expect(resolveCostoOraMacchina(m, 'zero').missing).toBe(true);
    expect(resolveCostoOraMacchina(m, 'ghost').missing).toBe(true);
  });

  it('costiMacchineFromOreMap: costo null se manca costoOra (mai 0 silenzioso)', () => {
    const macchineById = new Map([['t1', 50], ['a1', 0]]);
    const nomi = new Map([['t1', 'Fiat'], ['a1', 'Erpice']]);
    const r = costiMacchineFromOreMap({ t1: 2, a1: 2 }, macchineById, nomi, {
      tipo: 'Aratura',
      dataIso: '2026-03-01',
      hasParco: true
    });
    expect(r.missingMacchine).toBe(true);
    expect(r.costoMacchine).toBe(null);
    expect(r.voci.some((v) => v.prezzoMancante)).toBe(true);
  });

  it('totale macchine (ore×costoOra) allineato a Economici a parità di input', () => {
    const macchineById = new Map([['t1', 40], ['a1', 10]]);
    const nomi = new Map([['t1', 'T'], ['a1', 'A']]);
    const oreDocs = [
      { stato: 'validate', oreNette: 4, oreMacchina: 4, macchinaId: 't1', attrezzoId: 'a1', operaioId: 'o1' },
      { stato: 'da_validare', oreNette: 2, oreMacchina: 2, macchinaId: 't1' }
    ];
    const oreMap = oreMacchinaMapFromOreDocs(oreDocs, { soloValidate: true });
    const lav = costiMacchineFromOreMap(oreMap, macchineById, nomi, {
      tipo: 'Aratura',
      dataIso: '2026-01-10',
      hasParco: true
    });
    // 4 h × 40 + 4 h × 10 = 200; da_validare escluse
    expect(lav.costoMacchine).toBe(200);

    const diarioMap = oreMacchinaMapFromAttivita({
      oreMacchina: 1,
      macchinaId: 't1',
      terrenoId: 'campo',
      data: '2026-01-11',
      tipoLavoro: 'Altro'
    });
    const att = costiMacchineFromOreMap(diarioMap, macchineById, nomi, {
      tipo: 'Altro',
      dataIso: '2026-01-11',
      origine: 'diario',
      hasParco: true
    });
    expect(att.costoMacchine).toBe(40);

    const totale = sumCostoMacchineLikeEconomici(
      [{
        terrenoId: 'campo',
        dataIso: '2026-01-10',
        tipoLavoro: 'Aratura',
        costoMacchine: lav.costoMacchine,
        missingMacchine: lav.missingMacchine
      }],
      [{
        terrenoId: 'campo',
        dataIso: '2026-01-11',
        tipoLavoro: 'Altro',
        lavoroId: null,
        clienteId: null,
        costoMacchine: att.costoMacchine,
        missingMacchine: att.missingMacchine
      }]
    );
    expect(totale.value).toBe(240);
    expect(totale.partial).toBe(false);
  });

  it('manutenzioneStatus: superata quando oreAttuali ≥ soglia; fallback oreIniziali', () => {
    expect(manutenzioneStatus({ oreAttuali: 1200, oreProssimaManutenzione: 1000 }).superata).toBe(true);
    expect(manutenzioneStatus({ oreIniziali: 500, oreProssimaManutenzione: 800 }).oreAttuali).toBe(500);
    expect(manutenzioneStatus({ oreAttuali: 100, oreProssimaManutenzione: 200 }).superata).toBe(false);
  });

  it('oreMacchinaMapFromAttivita: unici id', () => {
    expect(oreMacchinaMapFromAttivita({ oreMacchina: 5, macchinaId: 't1', attrezzoId: 'a1' }))
      .toEqual({ t1: 5, a1: 5 });
  });
});
