/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FRASE_CONFERMA_CONTROLLATA,
  FRASE_VALORE_ESTRATTO,
  MSG_ETICHETTA_COLTURA_ASSENTE,
  MSG_ETICHETTA_DA_RICONTROLLARE,
  MSG_ETICHETTA_MANCANTE,
  MSG_ETICHETTA_NON_ESTRATTA,
  TESTO_VALORI_ETICHETTA,
  candidatiColtura,
  dataRevisioneOpenData,
  numeroFileEtichetta,
  percorsoValoriEtichetta,
  preparaEtichetta,
  righePerColtura,
  testoConsultaEtichetta
} from '../shared/js/registro-trattamenti-etichetta.js';
import {
  campiConfermaRiga,
  numeroSingoloTesto
} from '../shared/js/registro-trattamenti.js';
import {
  attaccaScelteEtichetta,
  htmlPannelloOpenData,
  leggiCampiAzienda,
  registroConfermaManuale
} from '../shared/js/registro-trattamenti-form.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dati = path.join(root, 'shared/data/fitofarmaci-etichette');

function leggi(rel) {
  return JSON.parse(readFileSync(path.join(dati, rel), 'utf8'));
}

const vocabolario = leggi('colture-vocabolario.json');
const sivanto = leggi('per-registrazione/016273.json');
const thiopron = leggi('per-registrazione/000013.json');
const folpan = leggi('per-registrazione/008601.json');

function valoreInput(html, classe) {
  const m = String(html).match(new RegExp('class="[^"]*\\b' + classe + '\\b[^"]*"[^>]*value="([^"]*)"'));
  return m ? m[1] : null;
}

function esitoProdotto(prodotto) {
  return {
    prodotti: [prodotto],
    dataLettura: '2026-11-16',
    fonte: 'open data'
  };
}

const sivantoAnagrafica = {
  denominazione: 'SIVANTO PRIME',
  numeroRegistrazione: '016273',
  titolare: 'BAYER',
  principioAttivo: 'flupyradifurone',
  stato: 'Autorizzato'
};

describe('normalizzazione colture', () => {
  it('porta Fagiolini al singolare e usa i sinonimi', () => {
    expect(candidatiColtura('Fagiolini', vocabolario)).toContain('fagiolino');
    expect(candidatiColtura('Fagiolini', vocabolario)).not.toContain('fagiolo');
    expect(candidatiColtura('Anguria', vocabolario)).toContain('cocomero');
    expect(candidatiColtura('Patate', vocabolario)).toContain('patata');
  });

  it('fagiolino trova la riga Fagiolo, fagiolino, fava e Pesco una riga DRUPACEE', () => {
    const fagiolino = righePerColtura(sivanto, 'Fagiolini', vocabolario);
    expect(fagiolino.length).toBeGreaterThan(0);
    expect(fagiolino.every((riga) => (riga.colture || []).includes('fagiolino'))).toBe(true);
    expect(fagiolino.some((riga) => /Fagiolo, fagiolino, fava/.test(JSON.stringify(riga)))).toBe(true);

    const pesco = righePerColtura(thiopron, 'Pesco', vocabolario);
    expect(pesco.some((riga) => /DRUPACEE/.test(riga.coltura || ''))).toBe(true);
  });
});

describe('Sivanto Prime su fagiolino', () => {
  const vista = preparaEtichetta({
    scheda: sivanto,
    coltura: 'fagiolino',
    vocabolario
  });
  const html = htmlPannelloOpenData({
    esito: esitoProdotto(sivantoAnagrafica),
    nome: 'Sivanto Prime',
    specie: 'fagiolino',
    etichetta: vista
  });

  it('scrive da solo dose per hl e dose per ha', () => {
    expect(vista.avversita).toHaveLength(1);
    expect(vista.avversitaScelta).toBeTruthy();
    expect(valoreInput(html, 'registro-dose-hl')).toBe('80');
    expect(valoreInput(html, 'registro-dose-ha')).toBe('0,375');
    expect(html).toContain('ml/hl');
    expect(html).toContain('l/ha');
    expect(html).toContain('da etichetta, pag. 3');
    expect(html).toContain('mostra frase');
    expect(html).toContain(TESTO_VALORI_ETICHETTA);
    expect(html).toContain(testoConsultaEtichetta('016273'));
    expect(html).toContain(sivanto.fonte);
    expect(html).toContain('titolare ' + sivanto.titolare);
    expect(html).toContain('etichetta del ' + sivanto.data_etichetta);
    expect(html).toContain('estratto il 17/11/2026');
    expect(html).toContain(FRASE_VALORE_ESTRATTO);
    expect(html).toContain(FRASE_CONFERMA_CONTROLLATA);
    expect(html).toContain('registro-valore-da-etichetta');
    expect(html).not.toMatch(/href="[^"]*fitosanitari\.salute\.gov\.it/);
    expect(html).toContain('iodl/2.0');
    expect(html).toContain('dati.salute.gov.it');
  });

  it('propone le due carenze e i due massimi, senza scegliere un numero', () => {
    expect(valoreInput(html, 'registro-carenza')).toBe('');
    expect(html).toContain('7 giorni');
    expect(html).toContain('non necessaria');
    expect(html).toContain('trattamento tardivo');
    expect(html).toContain('trattamento precoce');
    expect(valoreInput(html, 'registro-massimo')).toBe('');
    expect(html).toContain("all'anno");
    expect(html).toContain('ogni 2 anni');
    expect(html).toContain('applicazioni tardive');
    expect(html).toContain('applicazioni precoci');
    expect(html.indexOf('Scegli la riga che vale per il tuo caso'))
      .toBeLessThan(html.indexOf('class="registro-voci-etichetta"'));
  });
});

describe('clic sulla voce, Sivanto su fagiolino', () => {
  function bottone(box, campo, testo) {
    return [...box.querySelectorAll('.registro-voce-etichetta')].find((b) => {
      return b.getAttribute('data-campo') === campo && b.textContent.includes(testo);
    });
  }

  function pannello() {
    const vista = preparaEtichetta({
      scheda: sivanto,
      coltura: 'fagiolino',
      vocabolario
    });
    document.body.innerHTML = '<div id="registro-scheda-esito">' + htmlPannelloOpenData({
      esito: esitoProdotto(sivantoAnagrafica),
      nome: 'Sivanto Prime',
      specie: 'fagiolino',
      etichetta: vista
    }) + '</div>';
    const box = document.getElementById('registro-scheda-esito');
    attaccaScelteEtichetta(box, vista);
    return box;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('scrive 7 in carenza, 1 nel massimo, e non necessaria non scrive 0', () => {
    const box = pannello();
    const carenza = box.querySelector('.registro-carenza');
    const massimo = box.querySelector('.registro-massimo');
    expect(carenza.value).toBe('');
    expect(massimo.value).toBe('');

    const sette = bottone(box, 'carenza', '7 giorni');
    expect(sette.getAttribute('data-valore-etichetta')).toBe('7');
    expect(sette.hasAttribute('data-valore')).toBe(false);
    sette.click();
    expect(carenza.value).toBe('7');
    expect(carenza.classList.contains('registro-valore-da-etichetta')).toBe(true);
    expect(carenza.closest('label').nextElementSibling.textContent).toContain('da etichetta');
    expect(sette.classList.contains('registro-voce-selezionata')).toBe(true);
    expect(sette.getAttribute('aria-pressed')).toBe('true');
    expect(box.querySelector('.registro-dicitura-etichetta').textContent).toContain(FRASE_VALORE_ESTRATTO);

    const non = bottone(box, 'carenza', 'non necessaria');
    non.click();
    expect(carenza.value).toBe('');
    expect(carenza.value).not.toBe('0');
    expect(carenza.closest('label').nextElementSibling.textContent).toContain('non necessaria, da etichetta');
    expect(non.classList.contains('registro-voce-selezionata')).toBe(true);
    expect(sette.classList.contains('registro-voce-selezionata')).toBe(false);
    const campi = leggiCampiAzienda(box);
    expect(campi.origineValori.carenza.nonNecessario).toBe(true);
    expect(campi.origineValori.carenza.origine).toBe('etichetta');
    const registro = registroConfermaManuale(sivantoAnagrafica, campi);
    expect(registro.giorniCarenzaConfermata).toBeNull();
    expect(registro.carenzaNonNecessaria).toBe(true);
    expect(registro.origineValori.carenza.nonNecessario).toBe(true);

    const anno = bottone(box, 'massimo', "all'anno");
    const biennio = bottone(box, 'massimo', 'ogni 2 anni');
    anno.click();
    expect(massimo.value).toBe('1');
    expect(anno.classList.contains('registro-voce-selezionata')).toBe(true);
    expect(biennio.classList.contains('registro-voce-selezionata')).toBe(false);
    expect(non.classList.contains('registro-voce-selezionata')).toBe(true);
    biennio.click();
    expect(massimo.value).toBe('1');
    expect(massimo.getAttribute('data-periodo')).toBe('ogni 2 anni');
    expect(biennio.classList.contains('registro-voce-selezionata')).toBe(true);
    expect(anno.classList.contains('registro-voce-selezionata')).toBe(false);
  });

  it('mostra frase si apre sotto la voce e si richiude', () => {
    const box = pannello();
    const pulsanti = [...box.querySelectorAll('[data-mostra-frase]')];
    expect(pulsanti.length).toBeGreaterThan(0);
    pulsanti.forEach((btn) => {
      const blocco = btn.closest('.registro-blocco-fonte');
      const frase = blocco.querySelector('.registro-citazione');
      expect(btn.parentElement.contains(frase)).toBe(false);
      expect(frase.hidden).toBe(true);
      expect(btn.textContent).toBe('mostra frase');
      btn.click();
      expect(frase.hidden).toBe(false);
      expect(frase.style.display).toBe('block');
      expect(frase.style.fontStyle).toBe('italic');
      expect(frase.textContent.startsWith('«')).toBe(true);
      expect(btn.textContent).toBe('nascondi frase');
      btn.click();
      expect(frase.hidden).toBe(true);
      expect(btn.textContent).toBe('mostra frase');
    });
  });
});

describe('senza file e con intervallo di dose', () => {
  it('se il file non c\'è non inventa numeri', () => {
    const html = htmlPannelloOpenData({
      esito: esitoProdotto({
        denominazione: 'PRODOTTO SENZA FILE',
        numeroRegistrazione: '999999',
        stato: 'Autorizzato'
      }),
      nome: 'Prodotto senza file',
      specie: 'melo',
      etichetta: preparaEtichetta({ scheda: null, coltura: 'melo', vocabolario })
    });
    expect(html).toContain(MSG_ETICHETTA_MANCANTE.split(':')[0]);
    expect(html).toContain(testoConsultaEtichetta('999999'));
    expect(html).not.toMatch(/href="[^"]*fitosanitari\.salute\.gov\.it/);
    expect(valoreInput(html, 'registro-dose-ha')).toBe('');
    expect(valoreInput(html, 'registro-dose-hl')).toBe('');
    expect(valoreInput(html, 'registro-carenza')).toBe('');
    expect(html).not.toContain('value="0,375"');
    expect(html).not.toContain('value="80"');
  });

  it('un intervallo non riempie il campo e mostra le voci', () => {
    const prima = preparaEtichetta({ scheda: thiopron, coltura: 'vite', vocabolario });
    expect(prima.avversita.length).toBeGreaterThan(1);
    expect(prima.avversitaScelta).toBeNull();
    expect(prima.campi.doseHa.scrivi).toBe('');
    const escoriosi = prima.avversita.find((a) => /escoriosi/i.test(a.testo));
    const vista = preparaEtichetta({
      scheda: thiopron,
      coltura: 'vite',
      vocabolario,
      avversitaScelta: escoriosi.chiave
    });
    const html = htmlPannelloOpenData({
      esito: esitoProdotto({
        denominazione: 'THIOPRON',
        numeroRegistrazione: '000013',
        stato: 'Autorizzato'
      }),
      nome: 'Thiopron',
      specie: 'vite',
      etichetta: vista
    });
    expect(valoreInput(html, 'registro-dose-ha')).toBe('');
    expect(html).toContain('da 4 a 6 l/ha');
    expect(numeroSingoloTesto('da 4 a 6')).toBeNull();
    expect(numeroSingoloTesto('4-8')).toBeNull();
  });

  it('distingue coltura non estratta e coltura assente, senza parlare di autorizzazione', () => {
    const nonEstratta = preparaEtichetta({
      scheda: { righe: [], colture_non_estratte: ['melo'], url_etichetta: 'https://etichetta.example/melo' },
      coltura: 'Meli',
      vocabolario
    });
    expect(nonEstratta.stato).toBe('non-estratta');
    expect(nonEstratta.messaggio).toBe(MSG_ETICHETTA_NON_ESTRATTA);
    const assente = preparaEtichetta({
      scheda: {
        righe: [{ id: 'x', coltura: 'Vite', colture: ['vite'], avversita: 'oidio', dose_ha: [{ min: 1, max: 1, unita: 'l/ha' }] }],
        colture_non_estratte: [],
        url_etichetta: 'https://etichetta.example/vite'
      },
      coltura: 'melo',
      vocabolario
    });
    expect(assente.stato).toBe('coltura-assente');
    expect(assente.messaggio).toBe(MSG_ETICHETTA_COLTURA_ASSENTE);
    expect(assente.messaggio).not.toMatch(/autorizz/i);
    expect(assente.campi.doseHa.scrivi).toBe('');
  });

  it('Thiopron su rosa è in colture non estratte e non mostra numeri', () => {
    const vista = preparaEtichetta({ scheda: thiopron, coltura: 'rosa', vocabolario });
    expect(thiopron.colture_non_estratte).toContain('rosa');
    expect(vista.stato).toBe('non-estratta');
    expect(vista.messaggio).toBe(MSG_ETICHETTA_NON_ESTRATTA);
    expect(vista.campi.doseHa.scrivi).toBe('');
    expect(vista.campi.doseHl.scrivi).toBe('');
    const html = htmlPannelloOpenData({
      esito: esitoProdotto({
        denominazione: 'THIOPRON',
        numeroRegistrazione: '000013',
        stato: 'Autorizzato'
      }),
      nome: 'Thiopron',
      specie: 'rosa',
      etichetta: vista
    });
    expect(html).toContain(MSG_ETICHETTA_NON_ESTRATTA);
    expect(html).toContain(testoConsultaEtichetta('000013'));
    expect(html).not.toMatch(/href="[^"]*fitosanitari\.salute\.gov\.it/);
    expect(valoreInput(html, 'registro-dose-ha')).toBe('');
    expect(valoreInput(html, 'registro-dose-hl')).toBe('');
    expect(valoreInput(html, 'registro-carenza')).toBe('');
    expect(html).not.toContain('registro-valore-da-etichetta');
    expect(html).not.toContain(FRASE_CONFERMA_CONTROLLATA);
  });

  it('non riempie se la revisione è successiva alla data etichetta', () => {
    expect(dataRevisioneOpenData({
      dataRegistrazione: '01/01/2027',
      dataScadenzaAutorizzazione: '30/06/2030',
      dataDecretoRevoca: '01/01/2020',
      dataDecorrenzaRevoca: '01/02/2020'
    })).toBe('');
    expect(dataRevisioneOpenData({ dataRevisione: '09/09/2026' })).toBe('09/09/2026');

    const ferma = preparaEtichetta({
      scheda: sivanto,
      coltura: 'fagiolino',
      vocabolario,
      dataRevisione: '09/09/2026'
    });
    expect(ferma.stato).toBe('da-ricontrollare');
    expect(ferma.messaggio).toBe(MSG_ETICHETTA_DA_RICONTROLLARE);
    expect(ferma.campi.doseHa.scrivi).toBe('');
    expect(ferma.campi.doseHl.scrivi).toBe('');
    expect(ferma.avversita).toEqual([]);
    expect(ferma.meta.dataEtichetta).toBe('08/09/2026');
    const html = htmlPannelloOpenData({
      esito: esitoProdotto(sivantoAnagrafica),
      nome: 'Sivanto Prime',
      specie: 'fagiolino',
      etichetta: ferma
    });
    expect(html).toContain(MSG_ETICHETTA_DA_RICONTROLLARE);
    expect(valoreInput(html, 'registro-dose-ha')).toBe('');
    expect(valoreInput(html, 'registro-dose-hl')).toBe('');
    expect(html).not.toContain('value="0,375"');
    expect(html).not.toContain('value="80"');
    expect(html).not.toContain(FRASE_CONFERMA_CONTROLLATA);

    const stessa = preparaEtichetta({
      scheda: sivanto,
      coltura: 'fagiolino',
      vocabolario,
      dataRevisione: '08/09/2026'
    });
    expect(stessa.stato).toBe('pronto');
    expect(stessa.campi.doseHa.scrivi).toBe('0,375');
  });
});

describe('FOLPAN 80 WDG su vite', () => {
  function vistaPeronospora(coltura) {
    const prima = preparaEtichetta({ scheda: folpan, coltura, vocabolario });
    const peronospora = prima.avversita.find((a) => /peronospora/i.test(a.testo) && /plasmopara viticola/i.test(a.testo));
    expect(peronospora).toBeTruthy();
    return preparaEtichetta({
      scheda: folpan,
      coltura,
      vocabolario,
      avversitaScelta: peronospora.chiave
    });
  }

  function pannello(coltura, vista) {
    return htmlPannelloOpenData({
      esito: esitoProdotto({
        denominazione: 'FOLPAN 80 WDG',
        numeroRegistrazione: '008601',
        titolare: 'ADAMA ITALIA S.R.L.',
        stato: 'Autorizzato'
      }),
      nome: 'FOLPAN 80 WDG',
      specie: coltura,
      etichetta: vista
    });
  }

  it('su vite da vino la dose è un intervallo da scegliere, carenza 28, massimo 10 e intervallo 7-10, pag. 1', () => {
    const vista = vistaPeronospora('vite da vino');
    expect(vista.stato).toBe('pronto');
    expect(vista.campi.doseHa.scrivi).toBe('');
    expect(vista.campi.doseHl.scrivi).toBe('');
    expect(vista.campi.doseHa.voci.map((v) => v.testo)).toEqual(['da 1,25 a 1,5 kg/ha']);
    expect(vista.campi.doseHl.voci.map((v) => v.testo)).toEqual(['da 125 a 150 g/hl']);
    expect(vista.campi.carenza.scrivi).toBe('28');
    expect(vista.campi.massimo.scrivi).toBe('10');
    expect(vista.campi.massimo.voci.map((v) => v.testo)).toEqual(["10 all'anno"]);
    expect(vista.campi.intervallo.scrivi).toBe('');
    expect(vista.campi.intervallo.voci.map((v) => v.testo)).toEqual(['da 7 a 10 giorni']);

    const html = pannello('vite da vino', vista);
    expect(valoreInput(html, 'registro-dose-ha')).toBe('');
    expect(valoreInput(html, 'registro-dose-hl')).toBe('');
    expect(html).toMatch(/class="registro-voce-etichetta"[^>]*>da 1,25 a 1,5 kg\/ha<\/button>/);
    expect(html).toMatch(/class="registro-voce-etichetta"[^>]*>da 125 a 150 g\/hl<\/button>/);
    expect(valoreInput(html, 'registro-carenza')).toBe('28');
    expect(html).toContain('Carenza (giorni)');
    expect(valoreInput(html, 'registro-massimo')).toBe('10');
    expect(html).toContain("10 all'anno");
    expect(valoreInput(html, 'registro-intervallo')).toBe('');
    expect(html).toMatch(/class="registro-voce-etichetta"[^>]*>da 7 a 10 giorni<\/button>/);
    expect(html.match(/da etichetta, pag\. 1/g)).toHaveLength(6);
    expect(html).not.toMatch(/da etichetta, pag\. (?!1\b)/);
    expect(html).not.toMatch(/href="[^"]*fitosanitari\.salute\.gov\.it/);
  });

  it('su vite da tavola la carenza è 56 giorni e il massimo 4 con clima siccitoso', () => {
    const vista = vistaPeronospora('vite da tavola');
    expect(vista.campi.carenza.scrivi).toBe('56');
    expect(vista.campi.carenza.voci.map((v) => v.testo)).toEqual(['56 giorni']);
    expect(vista.campi.massimo.scrivi).toBe('4');
    expect(vista.campi.massimo.voci.map((v) => v.testo)).toEqual(['4 — con clima siccitoso']);
    const html = pannello('vite da tavola', vista);
    expect(valoreInput(html, 'registro-carenza')).toBe('56');
    expect(valoreInput(html, 'registro-massimo')).toBe('4');
    expect(html).toContain('con clima siccitoso');
    expect(html).toContain('da etichetta, pag. 1');
    expect(html).not.toMatch(/href="[^"]*fitosanitari\.salute\.gov\.it/);
  });
});

describe('conferma', () => {
  it('salva l\'origine e non rompe una conferma senza origine', () => {
    const registro = registroConfermaManuale(sivantoAnagrafica, {
      coltura: 'fagiolino',
      avversita: 'afidi (Aphis gossypii, Aphis fabae)',
      doseHa: '0,375',
      doseHl: '80',
      carenza: 'non necessaria',
      massimo: '1',
      origineValori: {
        doseHa: { origine: 'etichetta', pagina: 3, idRiga: '016273-02371', unita: 'l/ha' },
        doseHl: { origine: 'etichetta', pagina: 3, idRiga: '016273-02371', unita: 'ml/hl' },
        carenza: { origine: 'etichetta', pagina: 5, idRiga: '016273-02371', nonNecessario: true },
        massimo: { origine: 'etichetta', pagina: 3, idRiga: '016273-02371', periodo: 'ogni 2 anni' },
        avversita: { origine: 'azienda' },
        dataEtichetta: '08/09/2026'
      }
    }, { utente: 'Anna', ora: '2026-11-17T10:00:00.000Z' });
    expect(registro.dosaggio).toBe(0.375);
    expect(registro.dosePerEttolitroScheda).toBe(80);
    expect(registro.giorniCarenzaConfermata).toBeNull();
    expect(registro.carenzaNonNecessaria).toBe(true);
    expect(registro.impieghiMassimiAnno).toBe(1);
    expect(registro.origineValori.doseHa.origine).toBe('etichetta');
    expect(registro.origineValori.doseHa.pagina).toBe(3);
    expect(registro.origineValori.massimo.periodo).toBe('ogni 2 anni');
    expect(registro.origineValori.avversita.origine).toBe('azienda');
    expect(registro.origineValori.dataEtichetta).toBe('08/09/2026');

    const intervallo = registroConfermaManuale(sivantoAnagrafica, {
      doseHa: 'da 4 a 6',
      origineValori: { doseHa: { origine: 'etichetta', pagina: 1, idRiga: '000013-00002', testo: 'da 4 a 6' } }
    });
    expect(intervallo.dosaggio).toBeUndefined();
    expect(intervallo.dosePerEttaroScheda).toBeNull();
    expect(intervallo.origineValori.doseHa.testo).toBe('da 4 a 6');

    const vecchia = campiConfermaRiga({
      avversita: 'oidio',
      confermatoIl: '2020-01-01T00:00:00.000Z',
      dosePerEttaroScheda: 1.5
    });
    expect(vecchia.origineValori).toBeNull();
    expect(vecchia.carenzaNonNecessaria).toBeNull();
    expect(vecchia.dosePerEttaroScheda).toBe(1.5);
    expect(vecchia.avversita).toBe('oidio');
  });

  it('numera il file a sei cifre', () => {
    expect(numeroFileEtichetta('16273')).toBe('016273');
    expect(percorsoValoriEtichetta('16273', '/gfv-platform')).toBe(
      '/gfv-platform/shared/data/fitofarmaci-etichette/per-registrazione/016273.json'
    );
    expect(percorsoValoriEtichetta('016273', '/')).not.toMatch(/^\/\//);
  });
});
