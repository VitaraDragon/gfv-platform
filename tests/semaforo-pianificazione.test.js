/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { conteggioTrattamentiEtichetta, parolaConformita } from '../shared/js/registro-trattamenti-conformita.js';
import { righeTrattamentoDaMiscela, rigaDelFiltroImpianto, rigaHaConferma, valutaCancellazioneRegistro } from '../shared/js/registro-trattamenti.js';
import { mostraNotaPassaggioNonRegistrato } from '../shared/js/registro-trattamenti-lavoro-semaforo.js';
import { registroConfermaManuale } from '../shared/js/registro-trattamenti-form.js';
import {
  allineaTrattamentiAiLavori,
  unisciPassaggiLavoriPianificati
} from '../shared/js/registro-trattamenti-passaggi.js';
import {
  avvisoCarenzaRaccolta,
  htmlAvvisoCarenza,
  tipoLavoroRaccolta,
  valutaTrattamentoPianificato
} from '../shared/js/semaforo-etichetta-pianificazione.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folpan = JSON.parse(readFileSync(path.join(root, 'shared/data/fitofarmaci-etichette/per-registrazione/008601.json'), 'utf8'));
const vocabolario = JSON.parse(readFileSync(path.join(root, 'shared/data/fitofarmaci-etichette/colture-vocabolario.json'), 'utf8'));

function giorno(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function legami(scheda) {
  return {
    vocabolario,
    schedaPerRiga: () => scheda,
    riconoscimentoPerRiga: () => (scheda ? 'scheda' : 'non_riconosciuto')
  };
}

function pianifica({
  dose = 1.4,
  avversita = 'Peronospora (Plasmopara viticola)',
  specie = 'vite da vino',
  precedenti = [],
  lavoroId = '',
  data = '2026-08-01',
  scheda = folpan,
  nome = 'FOLPAN 80 WDG'
} = {}) {
  return valutaTrattamentoPianificato({
    miscela: {
      prodotti: [{ nome, dosePerEttaro: dose, unita: 'kg', avversitaPianificata: avversita }]
    },
    data: giorno(data),
    terrenoId: 't1',
    specie,
    lavoroId,
    precedenti,
    legami: legami(scheda),
    oggi: giorno(data)
  });
}

function passaggio(id, data) {
  return { id, data: giorno(data), terrenoId: 't1', prodottoId: null, nome: 'FOLPAN 80 WDG' };
}

describe('valutaTrattamentoPianificato', () => {
  it('Folpan su uva da vino, Peronospora, 1,4 kg/ha è verde e dice quanti ne restano', () => {
    const esito = pianifica();
    expect(esito.colore).toBe('verde');
    expect(esito.motivi.some((m) => m.codice === 'trattamenti_restanti' && /ne restano/.test(m.testo))).toBe(true);
    expect(esito.motivi.some((m) => m.colore === 'rosso' || String(m.codice || '').startsWith('carenza'))).toBe(false);
    expect(esito.testiDaConfermare).toEqual([]);
  });

  it('3 kg/ha è rosso, fuori intervallo, e la carenza non compare', () => {
    const esito = pianifica({ dose: 3 });
    expect(esito.colore).toBe('rosso');
    expect(esito.motivi.some((m) => /fuori dall'intervallo/.test(m.testo))).toBe(true);
    expect(esito.motivi.some((m) => /carenza|Si potrà raccogliere/i.test(m.testo || ''))).toBe(false);
    expect(esito.testiDaConfermare.some((t) => /fuori dall'intervallo/.test(t))).toBe(true);
  });

  it('senza avversità resta rosso o grigio, ma il conteggio si fa se il massimo è uguale', () => {
    const esito = pianifica({ avversita: '' });
    expect(['rosso', 'grigio']).toContain(esito.colore);
    expect(esito.motivi.some((m) => m.codice === 'trattamenti_restanti' && /ne restano/.test(m.testo))).toBe(true);
  });

  it('coltura assente in etichetta è rossa', () => {
    const esito = pianifica({ specie: 'olivo' });
    expect(esito.colore).toBe('rosso');
    expect(esito.motivi.some((m) => /In etichetta non trovo questa coltura/.test(m.testo))).toBe(true);
  });

  it('avversità assente in etichetta è rossa', () => {
    const esito = pianifica({ avversita: 'Ruggine inventata' });
    expect(esito.colore).toBe('rosso');
    expect(esito.motivi.some((m) => m.codice === 'avversita_altra')).toBe(true);
  });

  it('l\'undicesimo passaggio nell\'anno è rosso', () => {
    const precedenti = Array.from({ length: 10 }, (_, i) => passaggio('p' + i, '2026-01-' + String(i + 1).padStart(2, '0')));
    const esito = pianifica({ precedenti });
    expect(esito.motivi.some((m) => m.codice === 'troppi_trattamenti')).toBe(true);
    expect(esito.colore).toBe('rosso');
  });

  it('uva da tavola, massimo 4 senza periodo, nota sull\'anno solare', () => {
    const esito = pianifica({
      specie: 'vite da tavola',
      avversita: 'Escoriosi (Phomopsis viticola)',
      dose: 2
    });
    expect(esito.motivi.some((m) => /anno solare/.test(m.testo || ''))).toBe(true);
  });

  it('max_trattamenti vuoto: nessun motivo di conteggio', () => {
    const scheda = {
      righe: [{
        id: 'x',
        colture: ['vite da vino'],
        avversita: 'Peronospora',
        dose_ha: [{ min: 1, max: 2, unita: 'kg/ha' }],
        dose_hl: [],
        carenza: [{ giorni: 7 }],
        max_trattamenti: [],
        intervallo_giorni: [],
        ambiente: []
      }]
    };
    const esito = pianifica({ scheda, avversita: 'Peronospora' });
    expect(esito.motivi.some((m) => ['trattamenti_restanti', 'troppi_trattamenti', 'periodo_conteggio'].includes(m.codice))).toBe(false);
  });

  it('prodotto senza scheda è grigio, mai rosso', () => {
    const esito = pianifica({ scheda: null, nome: 'PRODOTTO SENZA SCHEDA' });
    expect(esito.colore).toBe('grigio');
    expect(parolaConformita(esito)).toBe("Nessun dato d'etichetta");
    expect(esito.motivi.some((m) => m.colore === 'rosso')).toBe(false);
  });

  it('una riga Errore con nome breve conta; annullata e fuori data no', () => {
    const errore = {
      id: 'err',
      data: giorno('2026-11-20'),
      terrenoId: 't1',
      prodottoId: 'magazzino-altro',
      nome: 'Folpan',
      numeroRegistrazioneLetto: '8601',
      stato: 'errore'
    };
    const prima = pianifica({ data: '2026-11-15', precedenti: [errore] });
    const dopo = pianifica({ data: '2026-11-21', precedenti: [errore] });
    const conAltri = pianifica({
      data: '2026-11-15',
      precedenti: [errore, {
        id: 'piano',
        data: giorno('2026-06-01'),
        terrenoId: 't1',
        nome: 'FOLPAN 80 WDG',
        stato: 'assegnato',
        pianificato: true
      }, {
        id: 'ann',
        data: giorno('2026-06-02'),
        terrenoId: 't1',
        nome: 'FOLPAN 80 WDG',
        stato: 'annullato'
      }, {
        id: 'vecchio',
        data: giorno('2025-11-20'),
        terrenoId: 't1',
        nome: 'FOLPAN 80 WDG'
      }]
    });
    expect(prima.motivi.some((m) => /sarebbe il 1°/.test(m.testo || ''))).toBe(true);
    expect(prima.motivi.some((m) => /ne restano 9/.test(m.testo || ''))).toBe(true);
    expect(dopo.motivi.some((m) => /sarebbe il 2°/.test(m.testo || ''))).toBe(true);
    expect(dopo.motivi.some((m) => /ne restano 8/.test(m.testo || ''))).toBe(true);
    expect(conAltri.motivi.some((m) => /sarebbe il 2°/.test(m.testo || ''))).toBe(true);
  });

  it('la scheda stub dello stesso lavoro non conta', () => {
    const precedenti = [
      passaggio('p1', '2026-06-01'),
      { ...passaggio('stub', '2026-08-01'), lavoroId: 'L1' }
    ];
    const esito = pianifica({ precedenti, lavoroId: 'L1' });
    expect(esito.motivi.some((m) => /sarebbe il 2°/.test(m.testo || ''))).toBe(true);
    expect(esito.motivi.some((m) => m.codice === 'troppi_trattamenti')).toBe(false);
  });
});

describe('lavori pianificati, annullati e spostati', () => {
  const prodotto = { nome: 'FOLPAN 80 WDG', dosePerEttaro: 1.4, unita: 'kg' };

  it('un lavoro di seminativo conta una volta; annullato no; scheda già presente non raddoppia', () => {
    const lavori = [
      { id: 'a', terrenoId: 't1', stato: 'assegnato', tipoLavoro: 'Trattamento', dataInizio: giorno('2026-03-01'), miscelaPrevista: { prodotti: [prodotto] } },
      { id: 'b', terrenoId: 't1', stato: 'annullato', tipoLavoro: 'Trattamento', dataInizio: giorno('2026-04-01'), miscelaPrevista: { prodotti: [prodotto] } },
      { id: 'c', terrenoId: 't1', stato: 'assegnato', tipoLavoro: 'Trattamento', dataInizio: giorno('2026-05-01'), miscelaPrevista: { prodotti: [prodotto] } }
    ];
    const passaggi = [{ id: 'scheda-c', lavoroId: 'c', data: giorno('2026-01-01'), terrenoId: 't1', nome: 'FOLPAN 80 WDG' }];
    const uniti = unisciPassaggiLavoriPianificati(passaggi, lavori, { terrenoId: 't1', includiLavoriSenzaScheda: true });
    const diA = uniti.filter((p) => p.lavoroId === 'a');
    expect(diA).toHaveLength(1);
    expect(diA[0].pianificato).toBe(true);
    expect(uniti.some((p) => p.lavoroId === 'b')).toBe(false);
    expect(uniti.filter((p) => p.lavoroId === 'c')).toHaveLength(1);
    expect(uniti.find((p) => p.lavoroId === 'c').data).toEqual(giorno('2026-05-01'));
  });

  it('vigneto: lavoro annullato non conta; lavoro spostato vale con la data nuova', () => {
    const passaggi = [
      { id: 's1', lavoroId: 'ann', data: giorno('2026-08-01'), terrenoId: 't1', nome: 'FOLPAN 80 WDG' },
      { id: 's2', lavoroId: 'spost', data: giorno('2025-08-01'), terrenoId: 't1', nome: 'FOLPAN 80 WDG' }
    ];
    const lavori = [
      { id: 'ann', terrenoId: 't1', stato: 'annullato', tipoLavoro: 'Trattamento', dataInizio: giorno('2026-08-01') },
      { id: 'spost', terrenoId: 't1', stato: 'assegnato', tipoLavoro: 'Trattamento', dataInizio: giorno('2026-08-10') }
    ];
    const uniti = unisciPassaggiLavoriPianificati(passaggi, lavori, { terrenoId: 't1' });
    expect(uniti.some((p) => p.lavoroId === 'ann')).toBe(false);
    expect(uniti.find((p) => p.lavoroId === 'spost').data).toEqual(giorno('2026-08-10'));
    const esito = pianifica({
      data: '2026-08-12',
      precedenti: uniti,
      avversita: 'Peronospora (Plasmopara viticola)'
    });
    expect(esito.motivi.some((m) => m.codice === 'intervallo_corto')).toBe(true);
  });

  it('allinea le schede senza riscriverle: annullato escluso, data nuova sul pianificato', () => {
    const schede = [
      { id: 's1', lavoroId: 'ann', data: giorno('2026-08-01'), prodotti: [{ prodotto: 'FOLPAN 80 WDG' }] },
      { id: 's2', lavoroId: 'vivo', data: giorno('2025-01-01'), prodotti: [{ prodotto: 'FOLPAN 80 WDG' }] }
    ];
    const out = allineaTrattamentiAiLavori(schede, [
      { id: 'ann', stato: 'annullato', dataInizio: giorno('2026-08-01') },
      { id: 'vivo', stato: 'assegnato', dataInizio: giorno('2026-07-01') }
    ]);
    expect(out.map((t) => t.id)).toEqual(['s2']);
    expect(out[0].data).toEqual(giorno('2026-07-01'));
    expect(schede[1].data).toEqual(giorno('2025-01-01'));
  });
});

describe('conteggioTrattamentiEtichetta', () => {
  it('ordinale, restanti, finestra di 730 giorni e restanti mai negativi', () => {
    const riga = { max_trattamenti: [{ numero: 2, periodo: 'ogni 2 anni' }] };
    const input = {
      trattamento: { data: giorno('2026-08-01'), terrenoId: 't1', id: 'nuovo' },
      riga: { prodotto: 'FOLPAN 80 WDG', prodottoId: 'folpan' },
      precedenti: [
        { id: 'vecchio', data: giorno('2024-01-01'), terrenoId: 't1', nome: 'FOLPAN 80 WDG' },
        { id: 'recente', data: giorno('2026-06-01'), terrenoId: 't1', nome: 'FOLPAN 80 WDG' },
        { id: 'altro', data: giorno('2026-07-01'), terrenoId: 't1', nome: 'ALTRO' }
      ]
    };
    const conto = conteggioTrattamentiEtichetta(input, riga);
    expect(conto[0].ordinale).toBe(2);
    expect(conto[0].restanti).toBe(0);
    const troppi = conteggioTrattamentiEtichetta({
      ...input,
      precedenti: [
        { id: 'a', data: giorno('2026-01-01'), terrenoId: 't1', nome: 'FOLPAN 80 WDG' },
        { id: 'b', data: giorno('2026-02-01'), terrenoId: 't1', nome: 'FOLPAN 80 WDG' },
        { id: 'c', data: giorno('2026-03-01'), terrenoId: 't1', nome: 'FOLPAN 80 WDG' }
      ]
    }, riga);
    expect(troppi[0].oltre).toBe(true);
    expect(troppi[0].restanti).toBe(0);
  });
});

describe('avvisoCarenzaRaccolta', () => {
  function trattamento(data, avversita, extra = {}) {
    return {
      id: 't',
      data: giorno(data),
      prodotti: [{ prodotto: 'FOLPAN 80 WDG', avversita, unitaDosaggio: 'kg', dosaggio: 1.4, ...extra }]
    };
  }

  it('Folpan uva da vino, 15/08, vendemmia 01/09: non prima del 12/09', () => {
    const esito = avvisoCarenzaRaccolta({
      dataRaccolta: giorno('2026-09-01'),
      coltura: 'vite da vino',
      verbo: 'vendemmiare',
      trattamenti: [trattamento('2026-08-15', 'Peronospora (Plasmopara viticola)')],
      ...legami(folpan)
    });
    expect(esito.testo).toContain('Non si può vendemmiare prima del 12/09/2026');
    expect(esito.testo).toContain('FOLPAN 80 WDG');
    expect(esito.testo).toContain('28 giorni da etichetta');
  });

  it('vendemmia il 12/09 non mostra l\'avviso', () => {
    const esito = avvisoCarenzaRaccolta({
      dataRaccolta: giorno('2026-09-12'),
      coltura: 'vite da vino',
      verbo: 'vendemmiare',
      trattamenti: [trattamento('2026-08-15', 'Peronospora (Plasmopara viticola)')],
      ...legami(folpan)
    });
    expect(esito.testo).toBe('');
  });

  it('uva da tavola usa 56 giorni', () => {
    const esito = avvisoCarenzaRaccolta({
      dataRaccolta: giorno('2026-09-01'),
      coltura: 'vite da tavola',
      verbo: 'vendemmiare',
      trattamenti: [trattamento('2026-08-15', 'Escoriosi (Phomopsis viticola)')],
      ...legami(folpan)
    });
    expect(esito.testo).toContain('10/10/2026');
    expect(esito.testo).toContain('56 giorni da etichetta');
  });

  it('più prodotti: vale la data più tardi', () => {
    const altro = {
      righe: [{
        id: 'z',
        colture: ['vite da vino'],
        avversita: 'Oidio',
        dose_ha: [],
        dose_hl: [],
        carenza: [{ giorni: 40 }],
        max_trattamenti: [],
        intervallo_giorni: [],
        ambiente: []
      }]
    };
    const esito = avvisoCarenzaRaccolta({
      dataRaccolta: giorno('2026-09-01'),
      coltura: 'vite da vino',
      verbo: 'vendemmiare',
      trattamenti: [{
        id: 'mix',
        data: giorno('2026-08-15'),
        prodotti: [
          { prodotto: 'FOLPAN 80 WDG', avversita: 'Peronospora (Plasmopara viticola)' },
          { prodotto: 'ALTRO', avversita: 'Oidio' }
        ]
      }],
      schedaPerRiga: (riga) => (riga.prodotto === 'ALTRO' ? altro : folpan),
      vocabolario
    });
    expect(esito.testo.startsWith('Non si può vendemmiare prima del 24/09/2026')).toBe(true);
    expect(esito.testo).toContain('e un altro trattamento ancora in carenza');
    expect((esito.testo.match(/Non si può/g) || []).length).toBe(1);
  });

  it('sette trattamenti: una frase, il più tardi, e gli altri nel details', () => {
    const trattamenti = Array.from({ length: 7 }, (_, i) => trattamento('2026-08-' + String(i + 1).padStart(2, '0'), 'Peronospora (Plasmopara viticola)'));
    const esito = avvisoCarenzaRaccolta({
      dataRaccolta: giorno('2026-08-20'),
      coltura: 'vite da vino',
      verbo: 'vendemmiare',
      trattamenti,
      ...legami(folpan)
    });
    expect((esito.testo.match(/Non si può vendemmiare/g) || []).length).toBe(1);
    expect(esito.testo).toContain('e altri 6 trattamenti ancora in carenza');
    expect(esito.testo).toContain('fine carenza');
    const html = htmlAvvisoCarenza(esito);
    expect(html).toContain('<details>');
    expect(html).not.toContain('<details open');
    expect((html.match(/Non si può vendemmiare/g) || []).length).toBe(1);
  });

  it('frutteto e seminativo usano raccogliere', () => {
    const esito = avvisoCarenzaRaccolta({
      coltura: 'melo',
      verbo: 'raccogliere',
      trattamenti: [],
      schedaPerRiga: () => null
    });
    expect(esito.testo).toBe('');
    const con = avvisoCarenzaRaccolta({
      dataRaccolta: null,
      coltura: 'vite da vino',
      verbo: 'raccogliere',
      trattamenti: [trattamento('2026-08-15', 'Peronospora (Plasmopara viticola)')],
      ...legami(folpan)
    });
    expect(con.testo.startsWith('Non si può raccogliere prima del 12/09/2026')).toBe(true);
  });

  it('carenza vuota, non necessaria o senza scheda: nessun avviso', () => {
    const vuota = {
      righe: [{
        id: 'v',
        colture: ['vite da vino'],
        avversita: 'Peronospora',
        carenza: [],
        dose_ha: [],
        dose_hl: [],
        max_trattamenti: [],
        intervallo_giorni: [],
        ambiente: []
      }]
    };
    const nonServe = {
      righe: [{
        id: 'n',
        colture: ['vite da vino'],
        avversita: 'Peronospora',
        carenza: [{ non_necessario: true }],
        dose_ha: [],
        dose_hl: [],
        max_trattamenti: [],
        intervallo_giorni: [],
        ambiente: []
      }]
    };
    [vuota, nonServe, null].forEach((scheda) => {
      const esito = avvisoCarenzaRaccolta({
        dataRaccolta: giorno('2026-08-20'),
        coltura: 'vite da vino',
        verbo: 'vendemmiare',
        trattamenti: [trattamento('2026-08-15', 'Peronospora')],
        ...legami(scheda)
      });
      expect(esito.testo).toBe('');
    });
  });

  it('righe ambigue con carenze diverse: la più lunga, con la nota', () => {
    const scheda = {
      righe: [
        { id: 'a', colture: ['vite da vino'], avversita: 'Peronospora', carenza: [{ giorni: 10 }], dose_ha: [], dose_hl: [], max_trattamenti: [], intervallo_giorni: [], ambiente: [] },
        { id: 'b', colture: ['vite da vino'], avversita: 'Oidio', carenza: [{ giorni: 40 }], dose_ha: [], dose_hl: [], max_trattamenti: [], intervallo_giorni: [], ambiente: [] }
      ]
    };
    const esito = avvisoCarenzaRaccolta({
      dataRaccolta: giorno('2026-09-01'),
      coltura: 'vite da vino',
      verbo: 'vendemmiare',
      trattamenti: [trattamento('2026-08-15', '')],
      ...legami(scheda)
    });
    expect(esito.testo).toContain('24/09/2026');
    expect(esito.testo).toContain('40 giorni da etichetta');
    expect(esito.testo).toContain('valore più lungo');
  });

  it('senza data di raccolta mostra comunque la data minima', () => {
    const esito = avvisoCarenzaRaccolta({
      coltura: 'vite da vino',
      verbo: 'vendemmiare',
      trattamenti: [trattamento('2026-08-15', 'Peronospora (Plasmopara viticola)')],
      ...legami(folpan)
    });
    expect(esito.testo).toContain('12/09/2026');
  });

  it('la nota di ieri compare solo se il passaggio del giorno prima non è registrato', () => {
    const oggi = giorno('2026-11-22');
    const base = {
      eTrattamento: true,
      dataLavoro: '2026-11-21',
      oggi,
      lavoroId: 'L21',
      lavoroCompletato: false,
      precedenti: []
    };
    expect(mostraNotaPassaggioNonRegistrato(base)).toBe(true);
    expect(mostraNotaPassaggioNonRegistrato({ ...base, eTrattamento: false })).toBe(false);
    expect(mostraNotaPassaggioNonRegistrato({
      ...base,
      dataLavoro: '2026-11-10',
      precedenti: [{ id: 'reg', data: giorno('2026-11-09'), terrenoId: 't1', nome: 'FOLPAN 80 WDG', stato: 'completato' }]
    })).toBe(false);
    expect(mostraNotaPassaggioNonRegistrato({
      ...base,
      dataLavoro: '2026-11-10',
      precedenti: [{ id: 'bozza', data: giorno('2026-11-09'), pianificato: true, stato: 'assegnato' }]
    })).toBe(true);
  });

  it('il filtro coltura tiene solo le righe di quel vigneto', () => {
    expect(rigaDelFiltroImpianto('sang', 'sang', ['sang', 'merlot'])).toBe(true);
    expect(rigaDelFiltroImpianto('sang', 'merlot', ['sang', 'merlot'])).toBe(false);
    expect(rigaDelFiltroImpianto('sang', '', ['sang', 'merlot'])).toBe(false);
    expect(rigaDelFiltroImpianto('sang', '', ['sang'])).toBe(true);
    expect(rigaDelFiltroImpianto('sang', '', ['sang', 'merlot'], { tutti: true })).toBe(true);
    expect(rigaDelFiltroImpianto('merlot', '', ['sang', 'merlot'], { tutti: true })).toBe(false);
  });

  it('riconosce raccolta e vendemmia', () => {
    expect(tipoLavoroRaccolta('Vendemmia manuale').eRaccolta).toBe(true);
    expect(tipoLavoroRaccolta('Vendemmia manuale').vendemmia).toBe(true);
    expect(tipoLavoroRaccolta('Raccolta frutta').eRaccolta).toBe(true);
    expect(tipoLavoroRaccolta('Raccolta').raccolta).toBe(true);
    expect(tipoLavoroRaccolta('Trattamento').eRaccolta).toBe(false);
    expect(tipoLavoroRaccolta('Potatura').eRaccolta).toBe(false);
  });
});

describe('righeTrattamentoDaMiscela', () => {
  it('tiene l\'avversità pianificata come suggerimento, senza confermarla', () => {
    const righe = righeTrattamentoDaMiscela({
      prodotti: [{ nome: 'FOLPAN 80 WDG', dosePerEttaro: 1.4, avversitaPianificata: 'Peronospora (Plasmopara viticola)' }]
    }, 1);
    const riga = righe.prodotti[0];
    expect(riga.avversitaPianificata).toBe('Peronospora (Plasmopara viticola)');
    expect(riga.avversita).toBeUndefined();
    expect(rigaHaConferma(riga)).toBe(false);
    const agganciata = righeTrattamentoDaMiscela({
      prodotti: [{
        nome: 'Folpan',
        dosePerEttaro: 1.4,
        avversitaPianificata: 'Peronospora (Plasmopara viticola)',
        numeroRegistrazioneLetto: '008601',
        riferimentoRiga: {
          nomeProdotto: 'FOLPAN 80 WDG',
          numeroRegistrazione: '008601',
          colturaScheda: ''
        }
      }]
    }, 1).prodotti[0];
    expect(agganciata.numeroRegistrazioneLetto).toBe('008601');
    expect(agganciata.riferimentoRiga.nomeProdotto).toBe('FOLPAN 80 WDG');
    expect(agganciata.avversita).toBeUndefined();
    expect(agganciata.confermatoIl).toBeUndefined();
    expect(rigaHaConferma(agganciata)).toBe(false);
    const trattamento = { data: '2026-08-01', prodotti: [riga] };
    expect(valutaCancellazioneRegistro(trattamento, { ora: new Date('2026-11-22') }).consentita).toBe(true);
    const confermata = registroConfermaManuale(
      { denominazione: 'FOLPAN 80 WDG', numeroRegistrazione: '008601' },
      { avversita: 'Peronospora (Plasmopara viticola)', coltura: 'vite da vino' }
    );
    expect(rigaHaConferma(confermata)).toBe(true);
    expect(valutaCancellazioneRegistro({
      data: '2026-08-01',
      prodotti: [confermata]
    }, { ora: new Date('2026-11-22'), exportConfermato: false }).consentita).toBe(false);
  });
});
