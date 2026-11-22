/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  aggiornaBannerConformita,
  collegaBannerConformita,
  htmlMetaRegistro,
  htmlPannelloOpenData,
  leggiRegistroRiga,
  ripristinaCardProdottoSalvato,
  scriviEsitoScheda,
  serializzaRegistroRiga
} from '../shared/js/registro-trattamenti-form.js';
import { messaggioDoseFuoriRiga, rigaHaConferma, righeProdottiPerForm, valutaCancellazioneRegistro } from '../shared/js/registro-trattamenti.js';
import { numeroRegistrazioneRiga } from '../shared/js/registro-trattamenti-conformita.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dati = path.join(root, 'shared/data/fitofarmaci-etichette');
const folpan = JSON.parse(readFileSync(path.join(dati, 'per-registrazione/008601.json'), 'utf8'));
const indice = JSON.parse(readFileSync(path.join(dati, 'indice.json'), 'utf8'));
const vocabolario = JSON.parse(readFileSync(path.join(dati, 'colture-vocabolario.json'), 'utf8'));

const unitaAmbigua = {
  numero_registrazione: '000001',
  righe: [{
    id: '000001-1',
    coltura: 'VITE',
    colture: ['vite da vino'],
    avversita: 'Peronospora',
    dose_ha: [
      { min: 1, max: 2, unita: 'kg/ha' },
      { min: 1, max: 2, unita: 'l/ha' }
    ],
    dose_hl: [],
    carenza: [],
    max_trattamenti: [],
    intervallo_giorni: []
  }]
};

function fetchMock(url) {
  const u = String(url);
  let json = null;
  if (u.includes('indice.json')) json = indice;
  else if (u.includes('colture-vocabolario')) json = vocabolario;
  else if (u.includes('008601')) json = folpan;
  else if (u.includes('000001')) json = unitaAmbigua;
  if (!json) return Promise.resolve({ ok: false, json: async () => null });
  return Promise.resolve({ ok: true, json: async () => json });
}

function registro(over = {}) {
  return serializzaRegistroRiga({
    avversita: 'Peronospora (Plasmopara viticola)',
    specieUsata: 'vite da vino',
    riferimentoRiga: {
      nomeProdotto: 'FOLPAN 80 WDG',
      numeroRegistrazione: '008601',
      colturaScheda: 'vite da vino'
    },
    ...over
  });
}

function rigaProdotto({ idx = 0, nome = 'folpan 80 wdg', dose = '2', unita = '-', json = '' } = {}) {
  return `<tr data-idx="${idx}">
    <td>
      <select class="prodotto-select"><option value="" selected>— Seleziona o Altro —</option></select>
      <input class="prodotto-nome-altro" value="${nome}">
      <input type="hidden" class="registro-json" value="${json}">
    </td>
    <td>
      <input class="prodotto-dosaggio" value="${dose}">
      <span class="registro-pallino-riga"></span>
    </td>
    <td>
      <span class="prodotto-unita">${unita}</span>
      <select class="prodotto-unita-scelta" hidden aria-label="Unità della dose">
        <option value="">Unità</option>
        <option value="kg">kg</option>
        <option value="l">L</option>
        <option value="g">g</option>
        <option value="ml">ml</option>
      </select>
    </td>
  </tr>`;
}

function monta(righe) {
  document.body.innerHTML = `
    <div id="registro-semaforo-banner" hidden></div>
    <input id="trattamento-id" value="t1">
    <input id="trattamento-data" value="2026-11-19">
    <input id="trattamento-superficie" value="1">
    <input id="trattamento-acqua-hl-ha" value="10">
    <table><tbody id="tbody-prodotti-trattamento">${righe}</tbody></table>
    <div id="registro-scheda-esito"></div>
  `;
}

function banner() {
  return document.getElementById('registro-semaforo-banner');
}

function colore() {
  const el = banner().querySelector('[data-colore]');
  return el ? el.getAttribute('data-colore') : '';
}

const opts = { specie: () => 'vite da vino' };

beforeEach(() => {
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('banner semaforo sul form', () => {
  it('1,4 kg con unità «-» e pannello vuoto è verde', async () => {
    monta(rigaProdotto({ dose: '1.4', json: registro() }));
    await aggiornaBannerConformita(opts);
    expect(colore()).toBe('verde');
    expect(banner().textContent).toContain("Conforme all'etichetta");
    expect(document.getElementById('registro-scheda-esito').textContent).toBe('');
  });

  it('2 kg scritti a mano con unità «-» sono rossi su ha e hl', async () => {
    monta(rigaProdotto({ dose: '2', json: registro({ numeroRegistrazioneLetto: '008601' }) }));
    await aggiornaBannerConformita(opts);
    expect(colore()).toBe('rosso');
    expect(banner().textContent).toContain('1,25–1,5 kg/ha');
    expect(banner().textContent).toContain('200 g/hl');
    expect(banner().textContent).toContain('125–150 g/hl');
    expect(banner().textContent).not.toMatch(/\b(usa|riduci|aumenta|consigliat)/i);
  });

  it('riconosce folpan 80 wdg solo dal nome, senza Leggi scheda', async () => {
    monta(rigaProdotto({
      dose: '2',
      json: registro({
        numeroRegistrazioneLetto: null,
        riferimentoRiga: { nomeProdotto: '', numeroRegistrazione: '', colturaScheda: 'vite da vino' }
      })
    }));
    await aggiornaBannerConformita(opts);
    expect(colore()).toBe('rosso');
    expect(banner().textContent).toContain('200 g/hl');
  });

  it('un revocato ha un solo banner rosso, con la data', async () => {
    monta(rigaProdotto({
      dose: '1.4',
      json: registro({
        statoAmministrativoScheda: 'Revocato',
        dataVariazioneScheda: '01/03/2025'
      })
    }));
    document.getElementById('registro-scheda-esito').innerHTML = htmlPannelloOpenData({
      esito: {
        prodotti: [{
          denominazione: 'FOLPAN 80 WDG',
          numeroRegistrazione: '008601',
          stato: 'Revocato',
          dataDecorrenzaRevoca: '01/03/2025'
        }]
      },
      nome: 'FOLPAN 80 WDG'
    });
    await aggiornaBannerConformita(opts);
    expect(colore()).toBe('rosso');
    expect(banner().textContent).toContain('revocato dal 01/03/2025');
    expect(banner().textContent).toContain('19/11/2026');
    expect(document.querySelector('.registro-banner-stato')).toBeNull();
    expect(document.body.textContent).toContain('Non propongo dose, carenza né avversità.');
  });

  it('senza file JSON il banner è grigio Nessun dato d\'etichetta', async () => {
    monta(rigaProdotto({
      nome: 'Prodotto fantasma',
      dose: '1',
      json: serializzaRegistroRiga({
        numeroRegistrazioneLetto: '999999',
        riferimentoRiga: { nomeProdotto: 'Prodotto fantasma', numeroRegistrazione: '999999', colturaScheda: 'vite da vino' }
      })
    }));
    await aggiornaBannerConformita(opts);
    expect(colore()).toBe('grigio');
    expect(banner().textContent).toContain("Nessun dato d'etichetta");
  });

  it('nella miscela il banner è il colore peggiore e ogni riga ha il suo pallino', async () => {
    monta([
      rigaProdotto({ idx: 0, nome: 'FOLPAN 80 WDG', dose: '2', json: registro() }),
      rigaProdotto({ idx: 1, nome: 'FOLPAN 80 WDG', dose: '1.4', json: registro() })
    ].join(''));
    await aggiornaBannerConformita(opts);
    expect(colore()).toBe('rosso');
    expect(banner().textContent).toContain('FOLPAN 80 WDG');
    const pallini = [...document.querySelectorAll('.registro-pallino-riga .gfv-semaforo')];
    expect(pallini[0].className).toContain('gfv-semaforo--red');
    expect(pallini[1].className).toContain('gfv-semaforo--green');
    expect(pallini[0].getAttribute('role')).toBe('img');
    expect(pallini[0].getAttribute('aria-label')).toBeTruthy();
  });

  it('il banner resta dopo Conferma e si aggiorna con la dose', async () => {
    monta(rigaProdotto({ dose: '2', json: registro() }));
    await aggiornaBannerConformita(opts);
    expect(colore()).toBe('rosso');
    document.getElementById('registro-scheda-esito').innerHTML = '<p>Conferma dell\'azienda registrata. Si può salvare il trattamento.</p>';
    expect(colore()).toBe('rosso');
    expect(banner().textContent).toContain('1,25–1,5 kg/ha');
    document.querySelector('.prodotto-dosaggio').value = '1.4';
    await aggiornaBannerConformita(opts);
    expect(colore()).toBe('verde');
    expect(banner().textContent).toContain("Conforme all'etichetta");
    expect(document.getElementById('registro-scheda-esito').textContent).toContain('Conferma dell\'azienda registrata');
  });

  it('unità ambigua: grigio, con la scelta accanto alla riga', async () => {
    monta(rigaProdotto({
      nome: 'Prova unità',
      dose: '1',
      json: serializzaRegistroRiga({
        avversita: 'Peronospora',
        numeroRegistrazioneLetto: '000001',
        riferimentoRiga: { nomeProdotto: 'Prova unità', numeroRegistrazione: '000001', colturaScheda: 'vite da vino' }
      })
    }));
    await aggiornaBannerConformita(opts);
    expect(colore()).toBe('grigio');
    expect(banner().textContent).toMatch(/unit[aà] mancante/i);
    expect(colore()).not.toBe('rosso');
    expect(colore()).not.toBe('verde');
    const scelta = document.querySelector('.prodotto-unita-scelta');
    expect(scelta.hidden).toBe(false);
  });

  it('senza Conferma, avversità scelta e dose in intervallo: banner giallo', async () => {
    monta(rigaProdotto({ dose: '1.4', json: '' }));
    const box = document.getElementById('registro-scheda-esito');
    box.setAttribute('data-riga-idx', '0');
    box.innerHTML = `<select class="registro-avversita-scelta">
      <option value="peronospora" selected>Peronospora (Plasmopara viticola)</option>
    </select>
    <input class="registro-avversita" value="">`;
    await aggiornaBannerConformita(opts);
    expect(colore()).toBe('giallo');
    expect(banner().textContent).toContain("Conferma l'avversità");
    expect(colore()).not.toBe('verde');
    const pallino = document.querySelector('.registro-pallino-riga .gfv-semaforo');
    expect(pallino.className).toContain('gfv-semaforo--yellow');
  });

  it('avversità pianificata: giallo, riga non confermata, cancellazione libera', async () => {
    const json = serializzaRegistroRiga({
      avversitaPianificata: 'Peronospora (Plasmopara viticola)',
      specieUsata: 'vite da vino',
      riferimentoRiga: {
        nomeProdotto: 'FOLPAN 80 WDG',
        numeroRegistrazione: '008601',
        colturaScheda: 'vite da vino'
      }
    });
    monta(rigaProdotto({ dose: '1.4', json }));
    await aggiornaBannerConformita(opts);
    expect(colore()).toBe('giallo');
    expect(banner().textContent).toContain("Conferma l'avversità");
    const riga = leggiRegistroRiga(document.querySelector('tr'));
    expect(rigaHaConferma(riga)).toBe(false);
    expect(valutaCancellazioneRegistro({
      data: '2026-08-01',
      prodotti: [riga]
    }, { ora: new Date('2026-11-22') }).consentita).toBe(true);
  });

  it('dopo Conferma, correggere la dose aggiorna il JSON e tiene avversità e numero', async () => {
    monta(rigaProdotto({
      dose: '1.4',
      nome: 'Folpan',
      json: registro({
        confermatoIl: '2026-11-21T10:00:00.000Z',
        numeroRegistrazioneLetto: '008601',
        dosePerEttaroScheda: 1.4,
        origineValori: { doseHa: { origine: 'etichetta', idRiga: '008601-00137' } }
      })
    }));
    await collegaBannerConformita(opts);
    const dose = document.querySelector('.prodotto-dosaggio');
    dose.value = '1.3';
    dose.dispatchEvent(new Event('input', { bubbles: true }));
    const json = leggiRegistroRiga(document.querySelector('tr'));
    expect(json.dosePerEttaroScheda).toBe(1.3);
    expect(json.avversita).toContain('Peronospora');
    expect(json.numeroRegistrazioneLetto).toBe('008601');
    expect(json.confermatoIl).toBe('2026-11-21T10:00:00.000Z');
    expect(json.origineValori.doseHa.origine).toBe('azienda');
    expect(json.origineValori.doseHa.idRiga).toBeUndefined();
  });
});

describe('salvataggio e rilettura Folpan scritto a mano', () => {
  const payload = {
    prodottoId: null,
    prodotto: 'Folpan',
    dosaggio: 1.4,
    unitaDosaggio: 'kg',
    quantita: 1.4,
    costo: 0,
    avversita: 'Peronospora (Plasmopara viticola)',
    confermatoIl: '2026-11-21T10:00:00.000Z',
    confermatoDa: 'Azienda',
    numeroRegistrazioneLetto: '008601',
    specieUsata: 'vite da vino',
    riferimentoRiga: {
      nomeProdotto: 'FOLPAN 80 WDG',
      numeroRegistrazione: '008601',
      colturaScheda: 'vite da vino'
    },
    dosePerEttaroScheda: 1.4,
    doseMinHa: 1.25,
    doseMaxHa: 1.5,
    unitaDose: 'kg/ha'
  };

  it('il payload di salvataggio tiene avversità, conferma e numero', () => {
    expect(payload.avversita).toContain('Peronospora');
    expect(payload.confermatoIl).toBeTruthy();
    expect(payload.numeroRegistrazioneLetto).toBe('008601');
    expect(payload.riferimentoRiga.numeroRegistrazione).toBe('008601');
  });

  it('righeProdottiPerForm rilegge la conferma; il mapping stretto la perde', () => {
    const stretto = {
      prodottoId: payload.prodottoId || null,
      prodotto: payload.prodotto || '',
      dosaggio: payload.dosaggio,
      unitaDosaggio: payload.unitaDosaggio || null,
      quantita: payload.quantita,
      costo: payload.costo
    };
    expect(stretto.avversita).toBeUndefined();
    expect(stretto.confermatoIl).toBeUndefined();
    expect(stretto.numeroRegistrazioneLetto).toBeUndefined();
    expect(numeroRegistrazioneRiga(stretto, null, indice)).toBe('');

    const riletta = righeProdottiPerForm([payload])[0];
    document.body.innerHTML = htmlMetaRegistro(riletta);
    expect(document.body.textContent).toContain('Confermato: Peronospora');
    const dalJson = leggiRegistroRiga(document.body);
    expect(dalJson.avversita).toContain('Peronospora');
    expect(numeroRegistrazioneRiga({ ...riletta, ...dalJson }, null, indice)).toBe('008601');
  });

  it('in riapertura la card mostra FOLPAN 80 WDG e 008601 senza Leggi scheda', async () => {
    const salvata = {
      ...payload,
      titolare: 'ADAMA',
      principioAttivo: 'folpet',
      statoAmministrativoScheda: 'Autorizzato',
      dataScadenzaAutorizzazioneScheda: '31/10/2040'
    };
    const riletta = righeProdottiPerForm([salvata])[0];
    expect(riletta.titolare).toBe('ADAMA');
    expect(riletta.principioAttivo).toBe('folpet');
    expect(riletta.dataScadenzaAutorizzazioneScheda).toBe('31/10/2040');
    expect(riletta.numeroRegistrazioneLetto).toBe('008601');
    expect(riletta.prodotto).toBe('Folpan');

    document.body.innerHTML = '<div id="registro-scheda-esito"></div><input class="prodotto-nome-altro" value="Folpan">';
    scriviEsitoScheda('');
    const vuoto = document.getElementById('registro-scheda-esito').textContent;
    expect(vuoto).not.toContain('FOLPAN 80 WDG');
    expect(vuoto).not.toContain('008601');

    await ripristinaCardProdottoSalvato([riletta], { caricaScheda: async (numero) => (numero === '008601' ? folpan : null) });
    const testo = document.getElementById('registro-scheda-esito').textContent;
    expect(testo).toContain('FOLPAN 80 WDG');
    expect(testo).toContain('008601');
    expect(testo).toContain('ADAMA');
    expect(testo).toContain('folpet');
    expect(testo).not.toContain('1,4');
    expect(testo).not.toMatch(/consigliat/i);

    const pagine = [
      'shared/js/trattamenti-coltura-page.js',
      'modules/seminativo/js/trattamenti-page.js',
      'modules/orticole/js/trattamenti-page.js'
    ];
    pagine.forEach((file) => {
      expect(readFileSync(path.join(root, file), 'utf8')).toContain('ripristinaCardProdottoSalvato(');
    });
  });

  it('scheda nata dal piano: tendina solo etichetta, preseleziona soltanto se è una', async () => {
    document.body.innerHTML = '<div id="registro-scheda-esito"></div>';
    await ripristinaCardProdottoSalvato([{
      prodotto: 'Folpan',
      avversitaPianificata: 'Peronospora (Plasmopara viticola)',
      numeroRegistrazioneLetto: '008601',
      riferimentoRiga: { nomeProdotto: 'FOLPAN 80 WDG', numeroRegistrazione: '008601', colturaScheda: '' }
    }], {
      coltura: 'vite da vino',
      caricaScheda: async () => folpan,
      caricaVocabolario: async () => vocabolario
    });
    const box = document.getElementById('registro-scheda-esito');
    const select = box.querySelector('select.registro-avversita-scelta');
    expect(select).toBeTruthy();
    expect(select.value).toBe('');
    expect(select.textContent).toContain('Peronospora');
    expect(select.innerHTML).not.toMatch(/Altra/);
    expect(box.textContent).toContain('In pianificazione:');
    expect(box.textContent).not.toMatch(/kg\/ha|consigliat/i);

    await ripristinaCardProdottoSalvato([{
      prodotto: 'Prova',
      avversitaPianificata: 'Peronospora',
      numeroRegistrazioneLetto: '000099'
    }], {
      coltura: 'vite da vino',
      caricaScheda: async () => ({
        nome_prodotto: 'PROVA UNA',
        numero_registrazione: '000099',
        righe: [{
          id: '1',
          coltura: 'VITE',
          colture: ['vite da vino'],
          avversita: 'Oidio',
          dose_ha: [],
          dose_hl: [],
          carenza: [],
          max_trattamenti: [],
          intervallo: []
        }]
      }),
      caricaVocabolario: async () => vocabolario
    });
    const scelta = document.querySelector('#registro-scheda-esito select');
    expect(scelta.selectedOptions[0].textContent).toContain('Oidio');
    expect(document.getElementById('registro-scheda-esito').textContent).not.toContain('In pianificazione');
  });

  it('la pagina non rimette il mapping stretto in Modifica, Completa e precedente', () => {
    const src = readFileSync(path.join(root, 'shared/js/trattamenti-coltura-page.js'), 'utf8');
    expect(src).toContain('function righeFormDaTrattamento');
    expect((src.match(/righeFormDaTrattamento\(/g) || []).length).toBeGreaterThanOrEqual(4);
    expect(src).not.toContain('prodottoId: r.prodottoId || null, prodotto: r.prodotto || \'\'');
  });

  it('Folpan 2 kg/ha su Peronospora usa 1,25–1,5 anche senza prodottoId', () => {
    const msg = messaggioDoseFuoriRiga({
      prodottoId: null,
      prodotto: 'Folpan',
      dosaggio: 2,
      avversita: 'Peronospora',
      specieUsata: 'vite da vino',
      riferimentoRiga: {
        nomeProdotto: 'FOLPAN 80 WDG',
        numeroRegistrazione: '008601',
        colturaScheda: 'vite da vino'
      }
    }, null, folpan);
    expect(msg).toContain('1,25–1,5 kg/ha');
    expect(msg).not.toMatch(/\b(usa|riduci|aumenta|consigliat)/i);
    expect(messaggioDoseFuoriRiga({
      prodottoId: null,
      prodotto: 'Folpan',
      dosaggio: 1.4,
      avversita: 'Peronospora',
      riferimentoRiga: { colturaScheda: 'vite da vino', numeroRegistrazione: '008601', nomeProdotto: 'FOLPAN 80 WDG' }
    }, null, folpan)).toBeNull();
  });
});
