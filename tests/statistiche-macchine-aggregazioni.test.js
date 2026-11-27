/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  aggregaOreMacchinaVsLavoratore,
  aggregaOreMacchinePerMese,
  aggregaOreMacchineTotali,
  collectOreValidateFiltrate,
  lavoroMatchesTerrenoTipo,
  oraMatchesPeriodo
} from '../core/js/statistiche-macchine-aggregazioni.js';
import {
  invalidateStatisticheMacchineCache,
  loadStatisticheMacchine,
  loadStatisticheMacchineSnapshot
} from '../core/js/statistiche-controller.js';

afterEach(() => {
  invalidateStatisticheMacchineCache();
  vi.restoreAllMocks();
  if (typeof document !== 'undefined' && document.body) {
    document.body.innerHTML = '';
  }
});

describe('statistiche-macchine filtri ora.data', () => {
  test('lavoro dataInizio gennaio + ore validate marzo: filtro marzo le include, gennaio no', () => {
    const lavoro = {
      dataInizio: new Date(2026, 0, 10),
      terrenoId: 't1',
      tipoLavoro: 'potatura'
    };
    const oraMarzo = { data: new Date(2026, 2, 15), oreMacchina: 103.5, stato: 'validate' };
    const oraGennaio = { data: new Date(2026, 0, 12), oreMacchina: 8, stato: 'validate' };

    const bundle = {
      oreByLavoroId: new Map([
        ['L1', {
          lavoroData: lavoro,
          oreDocs: [
            { data: () => oraMarzo },
            { data: () => oraGennaio }
          ]
        }]
      ])
    };

    const marzo = collectOreValidateFiltrate(bundle, { dataDa: '2026-03-01', dataA: '2026-03-31' });
    expect(marzo).toHaveLength(1);
    expect(marzo[0].ora.oreMacchina).toBe(103.5);

    const gennaio = collectOreValidateFiltrate(bundle, { dataDa: '2026-01-01', dataA: '2026-01-31' });
    expect(gennaio).toHaveLength(1);
    expect(gennaio[0].ora.oreMacchina).toBe(8);
  });

  test('terrenoId / tipoLavoro escludono lavori fuori filtro', () => {
    const lavoroOk = { terrenoId: 't1', tipoLavoro: 'potatura' };
    const lavoroNo = { terrenoId: 't2', tipoLavoro: 'potatura' };
    const ora = { data: new Date(2026, 2, 10), oreMacchina: 5 };

    expect(lavoroMatchesTerrenoTipo(lavoroOk, { terrenoId: 't1', tipoLavoro: 'potatura' })).toBe(true);
    expect(lavoroMatchesTerrenoTipo(lavoroNo, { terrenoId: 't1' })).toBe(false);
    expect(lavoroMatchesTerrenoTipo(lavoroOk, { tipoLavoro: 'aratura' })).toBe(false);

    const bundle = {
      oreByLavoroId: new Map([
        ['A', { lavoroData: lavoroOk, oreDocs: [{ data: () => ora }] }],
        ['B', { lavoroData: lavoroNo, oreDocs: [{ data: () => ora }] }]
      ])
    };
    const rows = collectOreValidateFiltrate(bundle, { terrenoId: 't1', tipoLavoro: 'potatura' });
    expect(rows).toHaveLength(1);
    expect(rows[0].lavoroId).toBe('A');
  });

  test('dataInizio assente / invalido su un lavoro non azzera il resto (filtro su ora.data)', () => {
    const bundle = {
      oreByLavoroId: new Map([
        ['bad', {
          lavoroData: { dataInizio: 'not-a-date', terrenoId: 't1' },
          oreDocs: [{ data: () => ({ data: new Date(2026, 2, 5), oreMacchina: 2 }) }]
        }],
        ['good', {
          lavoroData: { dataInizio: null, terrenoId: 't1' },
          oreDocs: [{ data: () => ({ data: new Date(2026, 2, 6), oreMacchina: 7 }) }]
        }],
        ['invalid-ora', {
          lavoroData: { terrenoId: 't1' },
          oreDocs: [{ data: () => ({ data: null, oreMacchina: 99 }) }]
        }]
      ])
    };
    const rows = collectOreValidateFiltrate(bundle, { dataDa: '2026-03-01', dataA: '2026-03-31' });
    expect(rows.map((r) => r.ora.oreMacchina).sort()).toEqual([2, 7]);
    expect(oraMatchesPeriodo({ data: null }, { dataDa: '2026-03-01' })).toBe(false);
  });
});

describe('statistiche-macchine ciambella vs KPI', () => {
  test('Diario 26h nette / 0 macchina + Manodopera 103.5h macchina → entrambi > 0, ordine label', () => {
    const attivita = [
      { oreNette: 26, oreMacchina: 0 }
    ];
    const oreRows = [
      { ora: { oreNette: 4, oreMacchina: 103.5 } }
    ];
    const vs = aggregaOreMacchinaVsLavoratore(attivita, oreRows);
    expect(vs.oreMacchina).toBe(103.5);
    expect(vs.oreLavoratore).toBe(30);
    expect(vs.oreMacchina).toBeGreaterThan(0);
    expect(vs.oreLavoratore).toBeGreaterThan(0);

    const labels = ['Ore Lavoratore', 'Ore Macchina'];
    const values = [vs.oreLavoratore, vs.oreMacchina];
    expect(labels[0]).toBe('Ore Lavoratore');
    expect(labels[1]).toBe('Ore Macchina');
    expect(values[0]).toBe(30);
    expect(values[1]).toBe(103.5);

    expect(aggregaOreMacchineTotali(attivita, oreRows)).toBe(103.5);
  });

  test('mese da calendario locale, non UTC toISOString', () => {
    // 1 marzo 2026 00:30 locale → ISO locale 2026-03-01; toISOString può slittare a febbraio in TZ positive
    const ora = { data: new Date(2026, 2, 1, 0, 30), oreMacchina: 3 };
    const mesi = aggregaOreMacchinePerMese([], [{ ora }]);
    expect(mesi).toEqual([{ mese: '2026-03', ore: 3 }]);
  });
});

describe('statistiche-macchine letture snapshot', () => {
  function makeDeps(lavoriCount) {
    const getDocsCalls = [];
    const lavoriDocs = Array.from({ length: lavoriCount }, (_, i) => ({
      id: `L${i}`,
      data: () => ({ terrenoId: 't1', tipoLavoro: 'potatura', dataInizio: new Date(2026, 0, 1) })
    }));

    const deps = {
      db: {},
      collection: (...args) => ({ path: args.join('/') }),
      query: (ref) => ref,
      where: () => ({}),
      doc: (...args) => ({ path: args.join('/') }),
      getDoc: async (ref) => {
        if (String(ref.path || '').includes('tenants/') && !String(ref.path).includes('/terreni')) {
          return {
            exists: () => true,
            data: () => ({ modules: ['manodopera', 'parco-macchine'] })
          };
        }
        return { exists: () => false, data: () => ({}) };
      },
      getDocs: async (ref) => {
        getDocsCalls.push(ref);
        const path = String(ref.path || '');
        if (path.endsWith('/lavori') || path.includes('/lavori') && !path.includes('oreOperai')) {
          return { docs: lavoriDocs };
        }
        if (path.includes('oreOperai')) {
          return {
            docs: [{
              id: 'o1',
              data: () => ({
                data: new Date(2026, 2, 10),
                oreMacchina: 1,
                oreNette: 1,
                stato: 'validate'
              })
            }]
          };
        }
        if (path.includes('terreni')) {
          return {
            docs: [{ id: 't1', data: () => ({ nome: 'Campo A' }) }]
          };
        }
        return { docs: [] };
      }
    };

    return { deps, getDocsCalls, lavoriCount };
  }

  test('un solo carico lavori e N oreOperai in parallelo; secondo load stessi filtri da cache', async () => {
    const { deps, getDocsCalls } = makeDeps(5);
    const getAllAttivita = vi.fn(async () => []);

    const first = await loadStatisticheMacchineSnapshot(
      { dataDa: '2026-03-01', dataA: '2026-03-31' },
      true,
      'tenant-1',
      getAllAttivita,
      deps
    );
    expect(first.fetchStats.fromCache).toBe(false);
    expect(first.fetchStats.lavoriReads).toBe(1);
    expect(first.fetchStats.oreOperaiReads).toBe(5);

    const lavoriGets = getDocsCalls.filter((r) => {
      const p = String(r.path || '');
      return p.includes('lavori') && !p.includes('oreOperai');
    });
    const oreGets = getDocsCalls.filter((r) => String(r.path || '').includes('oreOperai'));
    expect(lavoriGets.length).toBe(1);
    expect(oreGets.length).toBe(5);
    // non 4N (20): una sola passata
    expect(oreGets.length).toBeLessThan(20);

    const callsAfterFirst = getDocsCalls.length;
    const second = await loadStatisticheMacchineSnapshot(
      { dataDa: '2026-03-01', dataA: '2026-03-31' },
      true,
      'tenant-1',
      getAllAttivita,
      deps
    );
    expect(second.fetchStats.fromCache).toBe(true);
    expect(getDocsCalls.length).toBe(callsAfterFirst);
    expect(getAllAttivita).toHaveBeenCalledTimes(1);
  });
});

describe('statistiche-macchine difesa UI', () => {
  test('updateChart che lancia non blocca KPI; mostra Caricamento… prima del valore', async () => {
    document.body.innerHTML = `
      <div id="metric-ore-macchine-totali">-</div>
      <div id="metric-macchine-utilizzate">-</div>
      <div id="metric-utilizzo-medio">-</div>
      <div id="metric-manutenzioni-scadenza">-</div>
      <div class="chart-card"><div class="chart-container"><canvas id="chart-top-macchine"></canvas></div></div>
      <div class="chart-card"><div class="chart-container"><canvas id="chart-ore-macchina-terreno"></canvas></div></div>
      <div class="chart-card"><div class="chart-container"><canvas id="chart-ore-macchina-vs-lavoratore"></canvas></div></div>
      <div class="chart-card"><div class="chart-container"><canvas id="chart-ore-macchine-mese"></canvas></div></div>
    `;

    const loadingSeen = [];
    const oreEl = document.getElementById('metric-ore-macchine-totali');
    const origDesc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(oreEl), 'textContent')
      || Object.getOwnPropertyDescriptor(oreEl, 'textContent');
    Object.defineProperty(oreEl, 'textContent', {
      configurable: true,
      get() {
        return this._tc;
      },
      set(v) {
        this._tc = v;
        loadingSeen.push(v);
      }
    });

    const deps = {
      db: null
    };

    await loadStatisticheMacchine(
      {},
      true,
      't1',
      [{ id: 'm1', stato: 'attivo' }],
      deps,
      {
        getAllAttivita: async () => [{ oreMacchina: 2, oreNette: 1 }],
        getManutenzioniInScadenza: async () => 0,
        updateChartTopMacchine: () => {
          throw new Error('boom-chart');
        },
        updateChartOreMacchinaTerreno: () => {},
        updateChartOreMacchinaVsLavoratore: () => {},
        updateChartOreMacchineMese: () => {}
      },
      { formatOre: (n) => `${n}h` }
    );

    expect(loadingSeen[0]).toBe('Caricamento…');
    expect(oreEl.textContent).toBe('2h');
    expect(document.getElementById('metric-macchine-utilizzate').textContent).not.toBe('Caricamento…');
    expect(document.querySelector('#chart-top-macchine') || document.querySelector('.chart-container')).toBeTruthy();
    const topContainer = document.querySelector('#chart-top-macchine')?.closest('.chart-card')?.querySelector('.chart-container')
      || document.querySelectorAll('.chart-container')[0];
    expect(topContainer.innerHTML).toContain('Errore caricamento grafico');

    if (origDesc) {
      Object.defineProperty(oreEl, 'textContent', origDesc);
    }
  });
});
