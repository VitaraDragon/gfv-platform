/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aggiornaBannerConformita, htmlPannelloOpenData, serializzaRegistroRiga } from '../shared/js/registro-trattamenti-form.js';

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
});
