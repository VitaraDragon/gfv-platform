/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataGiorno } from '../shared/js/registro-trattamenti-conformita.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dati = path.join(root, 'shared/data/fitofarmaci-etichette');
const karate = JSON.parse(readFileSync(path.join(dati, 'per-registrazione/012940.json'), 'utf8'));
const cidelyScheda = JSON.parse(readFileSync(path.join(dati, 'per-registrazione/015449.json'), 'utf8'));
const indice = JSON.parse(readFileSync(path.join(dati, 'indice.json'), 'utf8'));
const vocabolario = JSON.parse(readFileSync(path.join(dati, 'colture-vocabolario.json'), 'utf8'));

const stato = vi.hoisted(() => ({
  seminativo: [],
  orticole: [],
  lavori: [],
  frutteto: [],
  specie: ''
}));

vi.mock('../modules/vigneto/services/vigneti-service.js', () => ({
  getAllVigneti: async () => []
}));
vi.mock('../modules/vigneto/services/trattamenti-vigneto-service.js', () => ({
  getTrattamenti: async () => []
}));
vi.mock('../modules/frutteto/services/frutteti-service.js', () => ({
  getAllFrutteti: async () => []
}));
vi.mock('../modules/frutteto/services/trattamenti-frutteto-service.js', () => ({
  getTrattamenti: async () => stato.frutteto
}));
vi.mock('../modules/seminativo/services/trattamenti-service.js', () => ({
  getAllTrattamentiSeminativo: async () => stato.seminativo
}));
vi.mock('../modules/orticole/services/trattamenti-service.js', () => ({
  getAllTrattamentiOrticole: async () => stato.orticole
}));
vi.mock('../core/services/lavori-service.js', () => ({
  getLavoriByTerreno: async () => stato.lavori
}));
vi.mock('../shared/js/registro-trattamenti-passaggi.js', async () => {
  const actual = await vi.importActual('../shared/js/registro-trattamenti-passaggi.js');
  return {
    ...actual,
    contestoRegistroTerreno: async () => ({ specie: stato.specie || 'frumento', passaggi: [] })
  };
});

const prodottoMiscela = {
  nome: 'KARATE ZEON 1.5',
  dosePerEttaro: 1,
  unita: 'l',
  avversitaPianificata: 'Afidi',
  numeroRegistrazioneLetto: '012940',
  riferimentoRiga: {
    nomeProdotto: 'KARATE ZEON 1.5',
    numeroRegistrazione: '012940',
    colturaScheda: 'frumento'
  }
};

function lavoroTrattamento(statoLavoro) {
  return {
    id: 'lav-tr',
    terrenoId: 't-grano',
    stato: statoLavoro,
    tipoLavoro: 'Trattamento',
    dataInizio: '2026-06-01',
    miscelaPrevista: { prodotti: [prodottoMiscela] }
  };
}

function giornoUguale(value, iso) {
  const a = dataGiorno(value);
  const b = dataGiorno(iso);
  return a && b && a.getTime() === b.getTime();
}

function fetchMock(url) {
  const u = String(url);
  let json = null;
  if (u.includes('indice.json')) json = indice;
  else if (u.includes('colture-vocabolario')) json = vocabolario;
  else if (u.includes('012940')) json = karate;
  else if (u.includes('015449')) json = cidelyScheda;
  if (!json) return Promise.resolve({ ok: false, json: async () => null });
  return Promise.resolve({ ok: true, json: async () => json });
}

describe('carenza raccolta seminativo e orticole', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    stato.seminativo = [];
    stato.orticole = [];
    stato.lavori = [];
    stato.frutteto = [];
    stato.specie = '';
    document.body.innerHTML = '';
  });

  it('la data di raccolta è quella del lavoro, oppure la chiusura se c\'è', async () => {
    const { dataRaccoltaPerCarenza } = await import('../shared/js/avviso-carenza-raccolta.js');
    expect(giornoUguale(
      dataRaccoltaPerCarenza({ stato: 'assegnato', dataInizio: '2026-06-20' }, '2026-06-18'),
      '2026-06-18'
    )).toBe(true);
    expect(giornoUguale(
      dataRaccoltaPerCarenza({
        stato: 'assegnato',
        dataInizio: '2026-06-20',
        completatoIl: '2026-07-05'
      }, '2026-06-18'),
      '2026-06-18'
    )).toBe(true);
    expect(giornoUguale(
      dataRaccoltaPerCarenza({ stato: 'completato', dataInizio: '2026-06-20' }, '2026-06-20'),
      '2026-06-20'
    )).toBe(true);
    expect(giornoUguale(
      dataRaccoltaPerCarenza({
        stato: 'completato',
        dataInizio: '2026-06-20',
        completatoIl: '2026-07-05',
        approvatoIl: '2026-07-02'
      }, '2026-06-20'),
      '2026-07-05'
    )).toBe(true);
    expect(giornoUguale(
      dataRaccoltaPerCarenza({
        stato: 'completato_da_approvare',
        dataInizio: '2026-06-20',
        approvatoIl: '2026-07-02'
      }, '2026-06-20'),
      '2026-07-02'
    )).toBe(true);
  });

  it('un trattamento eseguito senza scheda avvisa, uno solo pianificato no', async () => {
    stato.lavori = [lavoroTrattamento('completato')];
    const {
      aggiornaAvvisoCarenzaRaccolta,
      caricaTrattamentiPerCarenza,
      dataRaccoltaPerCarenza
    } = await import('../shared/js/avviso-carenza-raccolta.js');
    const { unisciPassaggiLavoriPianificati } = await import('../shared/js/registro-trattamenti-passaggi.js');

    const trattamenti = await caricaTrattamentiPerCarenza({ terrenoId: 't-grano' });
    expect(trattamenti.map((voce) => voce.id)).toEqual(['lavoro:lav-tr']);
    expect(trattamenti[0].prodotti[0].numeroRegistrazioneLetto).toBe('012940');

    const box = document.createElement('div');
    box.id = 'avviso-carenza-raccolta';
    const esito = await aggiornaAvvisoCarenzaRaccolta({
      box,
      dataRaccolta: '2026-06-10',
      coltura: 'frumento',
      verbo: 'raccogliere',
      trattamenti,
      terrenoId: 't-grano',
      lavori: stato.lavori
    });
    expect(esito.testo.startsWith('Non si può raccogliere prima del ')).toBe(true);
    expect(box.hidden).toBe(false);
    expect(box.textContent).toContain('Non si può raccogliere prima del');

    const dopo = new Date(esito.dataMinima.getFullYear(), esito.dataMinima.getMonth(), esito.dataMinima.getDate() + 1);
    const chiuso = await aggiornaAvvisoCarenzaRaccolta({
      box,
      dataRaccolta: dataRaccoltaPerCarenza({
        stato: 'completato',
        dataInizio: '2026-06-10',
        completatoIl: dopo
      }, '2026-06-10'),
      coltura: 'frumento',
      verbo: 'raccogliere',
      trattamenti,
      terrenoId: 't-grano',
      lavori: stato.lavori
    });
    expect(chiuso.testo).toBe('');
    expect(box.hidden).toBe(true);

    stato.lavori = [lavoroTrattamento('assegnato')];
    const pianificati = await caricaTrattamentiPerCarenza({ terrenoId: 't-grano' });
    expect(pianificati).toEqual([]);
    const piano = await aggiornaAvvisoCarenzaRaccolta({
      box,
      dataRaccolta: '2026-06-10',
      coltura: 'frumento',
      verbo: 'raccogliere',
      trattamenti: pianificati,
      terrenoId: 't-grano',
      lavori: stato.lavori
    });
    expect(piano.testo).toBe('');
    expect(box.hidden).toBe(true);

    const uniti = unisciPassaggiLavoriPianificati([], stato.lavori, {
      terrenoId: 't-grano',
      includiLavoriSenzaScheda: true
    });
    expect(uniti.some((passaggio) => passaggio.pianificato === true && passaggio.lavoroId === 'lav-tr')).toBe(true);
  });

  it('se la scheda c\'è già non duplica il lavoro, e vale anche con le orticole vuote', async () => {
    stato.lavori = [lavoroTrattamento('completato')];
    stato.seminativo = [{
      id: 'scheda-1',
      lavoroId: 'lav-tr',
      data: '2026-06-01',
      stato: 'completato',
      terrenoId: 't-grano',
      prodotti: [{
        prodotto: 'KARATE ZEON 1.5',
        dosaggio: 1,
        avversita: 'Afidi',
        numeroRegistrazioneLetto: '012940',
        riferimentoRiga: prodottoMiscela.riferimentoRiga
      }]
    }];
    const { caricaTrattamentiPerCarenza } = await import('../shared/js/avviso-carenza-raccolta.js');
    const letti = await caricaTrattamentiPerCarenza({ terrenoId: 't-grano' });
    expect(letti.map((voce) => voce.id)).toEqual(['scheda-1']);
    expect(stato.orticole).toEqual([]);
  });

  it('in Gestione lavori la Raccolta sul seminativo mostra l\'avviso e non blocca', async () => {
    stato.lavori = [lavoroTrattamento('completato')];
    document.body.innerHTML = `
      <select id="lavoro-tipo-lavoro"><option value="raccolta">Raccolta</option></select>
      <input id="lavoro-terreno" value="t-grano">
      <input id="lavoro-data-inizio" value="2026-06-10">
      <input id="lavoro-id" value="">
      <div id="lavoro-avviso-carenza" hidden></div>`;
    const { aggiornaAvvisoCarenzaLavoro } = await import('../core/admin/js/gestione-lavori-events.js');
    await aggiornaAvvisoCarenzaLavoro({
      lavoriList: stato.lavori,
      terreniList: [{ id: 't-grano', coltura: 'Grano' }]
    });
    const box = document.getElementById('lavoro-avviso-carenza');
    expect(box.hidden).toBe(false);
    expect(box.textContent).toContain('Non si può raccogliere prima del');

    document.getElementById('lavoro-id').value = 'lav-rac';
    await aggiornaAvvisoCarenzaLavoro({
      lavoriList: [
        lavoroTrattamento('completato'),
        {
          id: 'lav-rac',
          terrenoId: 't-grano',
          stato: 'completato',
          tipoLavoro: 'Raccolta',
          dataInizio: '2026-06-10',
          completatoIl: '2099-01-01'
        }
      ],
      terreniList: [{ id: 't-grano', coltura: 'Grano' }]
    });
    expect(box.hidden).toBe(true);
    expect(box.textContent).toBe('');

    stato.lavori = [lavoroTrattamento('assegnato')];
    document.getElementById('lavoro-id').value = '';
    document.getElementById('lavoro-data-inizio').value = '2026-06-10';
    await aggiornaAvvisoCarenzaLavoro({
      lavoriList: stato.lavori,
      terreniList: [{ id: 't-grano', coltura: 'Grano' }]
    });
    expect(box.hidden).toBe(true);
    expect(box.textContent).toBe('');
  });

  it('con coltura scheda vuota il grano eseguito avvisa lo stesso', async () => {
    const senzaColtura = {
      ...prodottoMiscela,
      riferimentoRiga: { ...prodottoMiscela.riferimentoRiga, colturaScheda: '' }
    };
    stato.lavori = [{
      ...lavoroTrattamento('completato'),
      miscelaPrevista: { prodotti: [senzaColtura] }
    }];
    const { aggiornaAvvisoCarenzaRaccolta, caricaTrattamentiPerCarenza } = await import('../shared/js/avviso-carenza-raccolta.js');
    const trattamenti = await caricaTrattamentiPerCarenza({ terrenoId: 't-grano' });
    const box = document.createElement('div');
    const esito = await aggiornaAvvisoCarenzaRaccolta({
      box,
      dataRaccolta: '2026-06-10',
      coltura: 'frumento',
      verbo: 'raccogliere',
      trattamenti,
      terrenoId: 't-grano',
      lavori: stato.lavori
    });
    expect(esito.testo.startsWith('Non si può raccogliere prima del')).toBe(true);
    expect(box.hidden).toBe(false);

    stato.lavori = [{
      ...lavoroTrattamento('assegnato'),
      miscelaPrevista: { prodotti: [senzaColtura] }
    }];
    const assegnati = await caricaTrattamentiPerCarenza({ terrenoId: 't-grano' });
    const boxAssegnato = document.createElement('div');
    const niente = await aggiornaAvvisoCarenzaRaccolta({
      box: boxAssegnato,
      dataRaccolta: '2026-06-10',
      coltura: 'frumento',
      verbo: 'raccogliere',
      trattamenti: assegnati,
      terrenoId: 't-grano',
      lavori: stato.lavori
    });
    expect(niente.testo).toBe('');
    expect(boxAssegnato.hidden).toBe(true);
  });

  it('CIDELY sul pesco: raccolta del 25/11 non prima del 06/12, e da assegnato no', async () => {
    const cidely = {
      nome: 'CIDELY',
      dosePerEttaro: 0.5,
      unita: 'l',
      avversitaPianificata: 'Oidio (Sphaerotheca pannosa)',
      numeroRegistrazioneLetto: '015449',
      riferimentoRiga: {
        nomeProdotto: 'CIDELY',
        numeroRegistrazione: '015449',
        colturaScheda: ''
      }
    };
    const lavoroPesco = (statoLavoro) => ({
      id: 'lav-pesco',
      terrenoId: 't-pesco',
      stato: statoLavoro,
      tipoLavoro: 'Anticrittogamico',
      dataInizio: '2026-11-22',
      miscelaPrevista: { prodotti: [cidely] }
    });
    stato.specie = 'pesco';
    stato.lavori = [lavoroPesco('completato')];
    stato.frutteto = [{
      id: 'scheda-pesco',
      lavoroId: 'lav-pesco',
      data: '2026-11-22',
      stato: 'completato',
      terrenoId: 't-pesco',
      prodotti: [{
        prodotto: 'CIDELY',
        dosaggio: 0.5,
        numeroRegistrazioneLetto: '015449',
        riferimentoRiga: {
          nomeProdotto: 'CIDELY',
          numeroRegistrazione: '015449',
          colturaScheda: ''
        }
      }]
    }];
    const { aggiornaAvvisoCarenzaRaccolta, caricaTrattamentiPerCarenza } = await import('../shared/js/avviso-carenza-raccolta.js');
    const conScheda = await caricaTrattamentiPerCarenza({ fruttetoId: 'f1', terrenoId: 't-pesco' });
    expect(conScheda.map((voce) => voce.id)).toEqual(['scheda-pesco']);
    expect(conScheda[0].prodotti[0].avversita).toBe('Oidio (Sphaerotheca pannosa)');
    const box = document.createElement('div');
    const esito = await aggiornaAvvisoCarenzaRaccolta({
      box,
      dataRaccolta: '2026-11-25',
      coltura: 'pesco',
      verbo: 'raccogliere',
      trattamenti: conScheda,
      terrenoId: 't-pesco',
      lavori: stato.lavori
    });
    expect(esito.testo.startsWith('Non si può raccogliere prima del 06/12/2026')).toBe(true);
    expect(box.hidden).toBe(false);

    stato.frutteto = [];
    const soloLavoro = await caricaTrattamentiPerCarenza({ fruttetoId: 'f1', terrenoId: 't-pesco' });
    expect(soloLavoro.map((voce) => voce.id)).toEqual(['lavoro:lav-pesco']);
    const boxLavoro = document.createElement('div');
    const dalLavoro = await aggiornaAvvisoCarenzaRaccolta({
      box: boxLavoro,
      dataRaccolta: '2026-11-25',
      coltura: 'pesco',
      verbo: 'raccogliere',
      trattamenti: soloLavoro,
      terrenoId: 't-pesco',
      lavori: stato.lavori
    });
    expect(dalLavoro.testo.startsWith('Non si può raccogliere prima del 06/12/2026')).toBe(true);

    stato.lavori = [lavoroPesco('assegnato')];
    const assegnati = await caricaTrattamentiPerCarenza({ fruttetoId: 'f1', terrenoId: 't-pesco' });
    expect(assegnati).toEqual([]);
    const boxAssegnato = document.createElement('div');
    const niente = await aggiornaAvvisoCarenzaRaccolta({
      box: boxAssegnato,
      dataRaccolta: '2026-11-25',
      coltura: 'pesco',
      verbo: 'raccogliere',
      trattamenti: assegnati,
      terrenoId: 't-pesco',
      lavori: stato.lavori
    });
    expect(niente.testo).toBe('');
    expect(boxAssegnato.hidden).toBe(true);
  });
});
