import { describe, it, expect, vi } from 'vitest';

vi.mock('../core/js/dashboard-data.js', () => {
  function calcolaAlertAffitto(dataScadenza) {
    if (!dataScadenza) return { colore: null, testo: '', giorni: null };
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const scadenza = dataScadenza instanceof Date ? dataScadenza : new Date(dataScadenza);
    scadenza.setHours(0, 0, 0, 0);
    const giorniRimanenti = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
    const mesiRimanenti = giorniRimanenti / 30;
    if (giorniRimanenti < 0) {
      return { colore: 'grey', testo: 'Scaduto', giorni: giorniRimanenti, mesi: null };
    }
    if (giorniRimanenti <= 30) {
      return {
        colore: 'red',
        testo: `${giorniRimanenti} giorni`,
        giorni: giorniRimanenti,
        mesi: mesiRimanenti,
      };
    }
    if (giorniRimanenti <= 180) {
      const mesi = Math.floor(mesiRimanenti);
      return {
        colore: 'yellow',
        testo: `~${mesi} mesi`,
        giorni: giorniRimanenti,
        mesi: mesiRimanenti,
      };
    }
    const mesi = Math.floor(mesiRimanenti);
    return {
      colore: 'green',
      testo: `~${mesi} mesi`,
      giorni: giorniRimanenti,
      mesi: mesiRimanenti,
    };
  }

  return {
    calcolaAlertAffitto,
    formattaDataScadenza: (d) => {
      const dt = d instanceof Date ? d : new Date(d);
      return dt.toLocaleDateString('it-IT');
    },
    loadLavoriDaPianificareCount: async () => 0,
    countOreDaValidareManager: async () => 0,
  };
});

vi.mock('../core/js/dashboard-counts-snapshot.js', () => ({
  getDashboardCountsSnapshot: () => null,
  ORE_READY_EVENT: 'dashboard-ore-ready',
}));

vi.mock('../core/js/dashboard-perf.js', () => ({
  dashboardPerfAsync: async (_label, fn) => fn(),
}));

import {
  calcolaUrgenzaData,
  fetchInArrivoItems,
  fetchScadenzeAmministrazioneItems,
} from '../core/js/dashboard-deadlines.js';
import { addDaysFromToday } from '../simulator/lib/seed-parco-macchine-details.js';

function daysFromToday(days) {
  return addDaysFromToday(days);
}

function makeMockDeps(collections) {
  return {
    db: {},
    collection: (_db, path) => ({ path }),
    getDocs: async (ref) => ({
      forEach: (fn) => {
        const rows = collections[ref.path] || [];
        rows.forEach((row) => {
          fn({
            id: row.id,
            data: () => row.data,
          });
        });
      },
    }),
  };
}

describe('dashboard-deadlines — semafori urgenza', () => {
  it('calcolaUrgenzaData — scaduto, rosso, giallo, verde', () => {
    expect(calcolaUrgenzaData(daysFromToday(-5)).colore).toBe('black');
    expect(calcolaUrgenzaData(daysFromToday(-5)).testo).toBe('Scaduto');

    expect(calcolaUrgenzaData(daysFromToday(3)).colore).toBe('red');
    expect(calcolaUrgenzaData(daysFromToday(3)).testo).toBe('3 gg');

    expect(calcolaUrgenzaData(daysFromToday(20)).colore).toBe('yellow');
    expect(calcolaUrgenzaData(daysFromToday(20)).testo).toBe('20 gg');

    expect(calcolaUrgenzaData(daysFromToday(200)).colore).toBe('green');
    expect(calcolaUrgenzaData(daysFromToday(200)).testo).toMatch(/^~\d+ mesi$/);
  });

  it('fetchInArrivoItems — profili sim parco (tagliando superato, manutenzione imminente, ok)', async () => {
    const kmBase = 45000;
    const deps = makeMockDeps({
      'tenants/sim_test/macchine': [
        {
          id: 'flotta-superata',
          data: {
            nome: 'Furgone Rosso',
            tipoMacchina: 'furgone',
            kmAttuali: kmBase + 12000,
            kmProssimaManutenzione: kmBase + 11500,
            prossimaManutenzione: daysFromToday(-3),
          },
        },
        {
          id: 'flotta-urgente',
          data: {
            nome: 'Furgone Blu',
            tipoMacchina: 'furgone',
            kmAttuali: kmBase + 200,
            kmProssimaManutenzione: kmBase + 500,
            prossimaManutenzione: daysFromToday(5),
          },
        },
        {
          id: 'trattore-ok',
          data: {
            nome: 'Trattore A',
            tipoMacchina: 'trattore',
            oreAttuali: 1200,
            oreProssimaManutenzione: 1350,
            prossimaManutenzione: daysFromToday(90),
          },
        },
      ],
    });

    const items = await fetchInArrivoItems(
      'sim_test',
      { hasManodopera: false, hasContoTerzi: false, availableModules: ['parcoMacchine'] },
      deps
    );

    const tagliando = items.find((it) => it.tipoLabel === 'Tagliando km' && it.titolo === 'Furgone Rosso');
    expect(tagliando).toBeTruthy();
    expect(tagliando.colore).toBe('black');
    expect(tagliando.dettaglio).toMatch(/Superato/);

    const kmRosso = items.find((it) => it.tipoLabel === 'Tagliando km' && it.titolo === 'Furgone Blu');
    expect(kmRosso).toBeTruthy();
    expect(kmRosso.colore).toBe('red');

    const manutenzione = items.find((it) => it.tipoLabel === 'Manutenzione' && it.titolo === 'Furgone Blu');
    expect(manutenzione).toBeTruthy();
    expect(manutenzione.colore).toBe('red');

    const trattore = items.find((it) => it.titolo === 'Trattore A');
    expect(trattore).toBeTruthy();
    expect(['green', 'yellow']).toContain(trattore.colore);
  });

  it('fetchScadenzeAmministrazioneItems — affitto e revisione/assicurazione per colore', async () => {
    const deps = makeMockDeps({
      'tenants/sim_test/terreni': [
        {
          id: 't-affitto-urgente',
          data: {
            nome: 'Podere Affitto',
            tipoPossesso: 'affitto',
            dataScadenzaAffitto: daysFromToday(10),
          },
        },
        {
          id: 't-proprio',
          data: {
            nome: 'Campo Proprio',
            tipoPossesso: 'proprieta',
            dataScadenzaAffitto: daysFromToday(10),
          },
        },
      ],
      'tenants/sim_test/macchine': [
        {
          id: 'm-revisione-scaduta',
          data: {
            nome: 'Trattore Revisione',
            prossimaRevisione: daysFromToday(-10),
            prossimaAssicurazione: daysFromToday(120),
          },
        },
      ],
    });

    const items = await fetchScadenzeAmministrazioneItems(
      'sim_test',
      ['parcoMacchine'],
      deps
    );

    const affitto = items.find((it) => it.tipoLabel === 'Affitto');
    expect(affitto).toBeTruthy();
    expect(affitto.colore).toBe('red');

    const revisione = items.find((it) => it.tipoLabel === 'Revisione');
    expect(revisione).toBeTruthy();
    expect(revisione.colore).toBe('black');
    expect(revisione.dettaglio).toMatch(/Scaduto/);

    const assicurazione = items.find((it) => it.tipoLabel === 'Assicurazione');
    expect(assicurazione).toBeTruthy();
    expect(assicurazione.colore).toBe('green');
  });
});
