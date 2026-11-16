import { createRequire } from 'module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  htmlSemaforoLetturaScheda,
  testoStatoLetturaScheda,
  NOTA_REGISTRO_PRIVATO,
  unisciConfermaSpecie,
  rangeDoseAvviso
} from '../shared/js/registro-trattamenti.js';
import {
  htmlPannelloOpenData,
  registroConfermaBloccata,
  registroConfermaManuale
} from '../shared/js/registro-trattamenti-form.js';

const require = createRequire(import.meta.url);
const scheda = require('../functions/lib/registro-trattamenti-scheda-core.js');
const here = path.dirname(fileURLToPath(import.meta.url));

const HEADER = [
  'num_registrazione',
  'denominazione_prodotto',
  'ragione_sociale',
  'sostanze_attive',
  'stato_amministrativo',
  'data_scadenza_autorizzazione',
  'data_decreto_revoca',
  'data_decorrenza_revoca'
].join(';');

function riga(campi) {
  return [
    campi.numero,
    campi.nome,
    campi.titolare || '',
    campi.sostanze || '',
    campi.stato,
    campi.scadenza || '-',
    campi.decreto || '-',
    campi.decorrenza || '-'
  ].join(';');
}

const csvCupravit = [
  HEADER,
  riga({
    numero: '002513',
    nome: 'CUPRAVIT',
    titolare: 'BAYER CROPSCIENCE S.R.L.',
    sostanze: 'RAME',
    stato: 'Revocato',
    decreto: '31/12/2003',
    decorrenza: '30/07/2004'
  }),
  riga({
    numero: '015663',
    nome: 'CUPRAVIT 35 WG',
    titolare: 'MANICA S.P.A.',
    sostanze: 'RAME',
    stato: 'Ri-registrato',
    scadenza: '30/06/2029'
  })
].join('\n');

const csvThiovit = [
  HEADER,
  riga({
    numero: '011339',
    nome: 'THIOVIT',
    titolare: 'ALTRO',
    sostanze: 'ZOLFO',
    stato: 'Ri-registrato'
  }),
  riga({
    numero: '002923',
    nome: 'TIOVIT JET',
    titolare: 'SYNGENTA ITALIA S.P.A.',
    sostanze: 'ZOLFO',
    stato: 'Ri-registrato',
    scadenza: '31/07/2027'
  })
].join('\n');

const csvFolpan = [
  HEADER,
  riga({ numero: '000100', nome: 'FOLPAN 80 WDG', titolare: 'ADAMA', sostanze: 'FOLPET', stato: 'Autorizzato' }),
  riga({ numero: '000200', nome: 'FOLPAN GOLD', titolare: 'ADAMA', sostanze: 'FOLPET', stato: 'Autorizzato' }),
  riga({ numero: '16273', nome: 'SIVANTO PRIME', titolare: 'BAYER', sostanze: 'FLUPYRADIFURONE', stato: 'Autorizzato' })
].join('\n');

describe('ricerca sul CSV', () => {
  it('legge il titolare dalla colonna ragione_sociale', () => {
    const righe = scheda.parsaCsvFitosanitari(csvCupravit);
    const proposto = righe.find((r) => r.numeroRegistrazione === '015663');
    expect(proposto.titolare).toBe('MANICA S.P.A.');
    expect(scheda.eAutorizzato(proposto)).toBe(true);
    expect(scheda.eAutorizzato(righe.find((r) => r.numeroRegistrazione === '002513'))).toBe(false);
    expect(scheda.classificaStatoAmministrativo('Scaduto')).toBe('scaduto');
    expect(scheda.classificaStatoAmministrativo('Sospeso')).toBe('sospeso');
    expect(scheda.classificaStatoAmministrativo('Rinnovato Art. 43 Reg. 1107/2009')).toBe('autorizzato');
  });

  it('con Cupravit propone il prodotto ancora in commercio e mostra il revocato', () => {
    const righe = scheda.parsaCsvFitosanitari(csvCupravit);
    const trovata = scheda.trovaRegistrazioneUnica(righe, 'Cupravit');
    expect(trovata.esito).not.toBe('unica');
    expect(trovata.prodotto.numeroRegistrazione).toBe('015663');
    expect(trovata.prodotti.map((p) => p.numeroRegistrazione)).toEqual(['015663', '002513']);
    expect(trovata.prodotti.find((p) => p.numeroRegistrazione === '002513').stato).toBe('Revocato');
    const html = htmlPannelloOpenData({
      esito: scheda.componiRispostaScheda({
        csv: csvCupravit,
        nome: 'Cupravit',
        urlCsv: '/opendata/PROD_FTS_6_20261116.csv'
      }),
      nome: 'Cupravit'
    });
    expect(html.indexOf('015663')).toBeLessThan(html.indexOf('002513'));
    expect(html).toContain('Revocato');
    expect(html).toContain('30/07/2004');
    expect(html).toContain('data-scegli-prodotto');
    expect(html).not.toContain('registro-dose-ha');
  });

  it('accetta le varianti di grafia di Thiovit Jet e non aggancia Folpan a Folpan Gold', () => {
    const righe = scheda.parsaCsvFitosanitari(csvThiovit);
    ['Thiovit Jet', 'thiovit-jet', 'TIOVIT JET'].forEach((nome) => {
      const trovata = scheda.trovaRegistrazioneUnica(righe, nome);
      expect(trovata.esito).toBe('unica');
      expect(trovata.prodotto.numeroRegistrazione).toBe('002923');
    });
    expect(scheda.chiaveCompatta('Folpan')).not.toBe(scheda.chiaveCompatta('Folpan Gold'));
    const folpan = scheda.parsaCsvFitosanitari(csvFolpan);
    expect(scheda.trovaRegistrazioneUnica(folpan, 'Folpan Gold').prodotto.numeroRegistrazione).toBe('000200');
    expect(scheda.trovaRegistrazioneUnica(folpan, 'Folpan').esito).toBe('nome_non_univoco');
    expect(scheda.trovaRegistrazioneUnica(folpan, 'Folpan').prodotto).toBeNull();
    expect(scheda.trovaRegistrazioneUnica(folpan, 'Folpan 80 WDG').prodotto.numeroRegistrazione).toBe('000100');
    expect(scheda.trovaRegistrazioneUnica(folpan, 'Sivanto Prime').prodotto.numeroRegistrazione).toBe('16273');
  });

  it('ignora una tabella impieghi e non restituisce righe di dose', () => {
    const risposta = scheda.componiRispostaScheda({
      csv: csvFolpan,
      nome: 'Sivanto Prime',
      specie: 'vite da vino',
      urlCsv: '/sites/default/files/opendata/PROD_FTS_6_20261116.csv',
      htmlScheda: '<table><tr><td>Vite</td><td>Peronospora</td><td>1,5</td></tr></table>'
    });
    expect(risposta.righe).toEqual([]);
    expect(risposta.dataLettura).toBe('2026-11-16');
    expect(risposta.prodotti[0].numeroRegistrazione).toBe('16273');
    expect(risposta.prodotti[0].titolare).toBe('BAYER');
    const callable = readFileSync(path.join(here, '../functions/registro-trattamenti-scheda.js'), 'utf8');
    expect(callable).not.toMatch(/htmlScheda/);
    const index = readFileSync(path.join(here, '../functions/index.js'), 'utf8');
    expect(index).not.toMatch(/registro-trattamenti-lettura/);
    expect(index).toMatch(/leggiSchedaRegistroTrattamento/);
  });
});

describe('esito nel form', () => {
  const esitoRevoca = scheda.componiRispostaScheda({
    csv: [
      HEADER,
      riga({
        numero: '002513',
        nome: 'CUPRAVIT',
        titolare: 'BAYER CROPSCIENCE S.R.L.',
        sostanze: 'RAME',
        stato: 'Revocato',
        decorrenza: '30/07/2004'
      })
    ].join('\n'),
    nome: 'Cupravit',
    urlCsv: '/opendata/PROD_FTS_6_20261116.csv'
  });

  it('mostra attribuzione IODL, la data del CSV e l\'avviso sull\'etichetta', () => {
    const html = htmlPannelloOpenData({ esito: esitoRevoca, nome: 'Cupravit' });
    expect(html).toContain('IODL 2.0');
    expect(html).toContain('https://www.dati.gov.it/iodl/2.0/');
    expect(html).toContain('https://www.dati.salute.gov.it/it/dataset/fitosanitari/');
    expect(html).toContain('16/11/2026');
    expect(html).toContain("Verifica sempre l'etichetta autorizzata: è quella che fa fede.");
    expect(NOTA_REGISTRO_PRIVATO).not.toMatch(/scheda pubblica/i);
    expect(NOTA_REGISTRO_PRIVATO).toMatch(/non invia il file al SIAN/i);
  });

  it('per un revocato, scaduto o sospeso mostra il banner e non propone dosi', () => {
    const html = htmlPannelloOpenData({
      esito: {
        ...esitoRevoca,
        righe: [{ avversita: 'Peronospora', doseMinHa: 1.5, giorniCarenza: 28 }]
      },
      nome: 'Cupravit'
    });
    expect(html).toContain('registro-banner-stato');
    expect(html).toContain('Revocato');
    expect(html).toContain('30/07/2004');
    expect(html).not.toContain('Peronospora');
    expect(html).not.toContain('registro-dose-ha');
    expect(html).toContain('data-conferma-bloccata');
    const registro = registroConfermaBloccata(esitoRevoca.prodotti[0], {
      fonte: esitoRevoca.fonte,
      dataLettura: esitoRevoca.dataLettura,
      utente: 'Anna'
    });
    expect(registro.numeroRegistrazione).toBeUndefined();
    expect(registro.riferimentoRiga.numeroRegistrazione).toBe('002513');
    expect(registro.avversita).toBeUndefined();
    expect(registro.dosePerEttaroScheda).toBeUndefined();
    expect(registro.dosePerEttolitroScheda).toBeUndefined();
    expect(registro.giorniCarenzaConfermata).toBeUndefined();
    expect(registro.impieghiMassimiAnno).toBeUndefined();
    expect(registro.giorniMinimiTraPassaggi).toBeUndefined();
    expect(registro.dosaggio).toBeUndefined();

    const scaduto = htmlPannelloOpenData({
      esito: scheda.componiRispostaScheda({
        csv: [HEADER, riga({ numero: '1', nome: 'VECCHIO', stato: 'Scaduto', scadenza: '01/01/2020' })].join('\n'),
        nome: 'Vecchio',
        urlCsv: '/opendata/PROD_FTS_6_20261116.csv'
      }),
      nome: 'Vecchio'
    });
    expect(scaduto).toContain('Scaduto');
    expect(scaduto).toContain('01/01/2020');
    expect(scaduto).not.toContain('registro-dose-ha');
    const sospeso = htmlPannelloOpenData({
      esito: scheda.componiRispostaScheda({
        csv: [HEADER, riga({ numero: '2', nome: 'FERMO', stato: 'Sospeso', decorrenza: '02/02/2024' })].join('\n'),
        nome: 'Fermo',
        urlCsv: '/opendata/PROD_FTS_6_20261116.csv'
      }),
      nome: 'Fermo'
    });
    expect(sospeso).toContain('Sospeso');
    expect(sospeso).toContain('02/02/2024');
  });

  it('su un prodotto in commercio fa scrivere i dati all\'azienda e ripropone la conferma già data', () => {
    const esito = scheda.componiRispostaScheda({
      csv: csvThiovit,
      nome: 'Thiovit Jet',
      urlCsv: '/opendata/PROD_FTS_6_20261116.csv'
    });
    const conferma = {
      avversita: 'Oidio',
      confermatoIl: '2026-10-13T10:00:00.000Z',
      dosePerEttaroScheda: 1.5,
      giorniCarenzaConfermata: 5,
      specieUsata: 'vite da vino',
      riferimentoRiga: { colturaScheda: 'vite da vino', nomeProdotto: 'TIOVIT JET', numeroRegistrazione: '002923' }
    };
    const html = htmlPannelloOpenData({
      esito,
      nome: 'Thiovit Jet',
      specie: 'vite da vino',
      conferma
    });
    expect(html).toMatch(/inserita dalla tua azienda il/i);
    expect(html).toContain('13/10/2026');
    expect(html).toContain('Non è un dato del Ministero');
    expect(html).toContain('registro-dose-ha');
    expect(html).toContain('value="1.5"');
    expect(html).toContain('value="Oidio"');
    expect(html).not.toMatch(/scheda pubblica|dato ufficiale/i);
    const registro = registroConfermaManuale(esito.prodotti[0], {
      coltura: 'vite da vino',
      avversita: 'Oidio',
      doseHa: '1,5',
      doseHl: '0,5',
      carenza: '5',
      massimo: '2',
      intervallo: '7'
    }, { fonte: esito.fonte, dataLettura: esito.dataLettura, utente: 'Anna', ora: '2026-11-16T09:00:00.000Z' });
    expect(registro.avversita).toBe('Oidio');
    expect(registro.dosaggio).toBe(1.5);
    expect(registro.dosePerEttolitroScheda).toBe(0.5);
    expect(registro.giorniCarenzaConfermata).toBe(5);
    expect(registro.impieghiMassimiAnno).toBe(2);
    expect(registro.giorniMinimiTraPassaggi).toBe(7);
    expect(registro.confermatoDa).toBe('Anna');
    expect(registro.titolare).toBe('SYNGENTA ITALIA S.P.A.');
    const unito = unisciConfermaSpecie({ nome: 'TIOVIT JET' }, 'vite da vino', registro);
    expect(unito.confermeSpecie.vite_da_vino.avversita).toBe('Oidio');
    expect(unito.statoAmministrativoScheda).toBe('Ri-registrato');
    expect(unito.titolare).toBe('SYNGENTA ITALIA S.P.A.');
    expect(chiaveUtile(unito)).toBe('Oidio');
    expect(rangeDoseAvviso({ confermatoIl: registro.confermatoIl, doseMinHa: null, doseMaxHa: null, dosaggio: 4 }, { dosaggioMax: 3 }).max).toBe(3);
  });

  it('se il nome non c\'è non inventa nulla e lascia il link da aprire', () => {
    const html = htmlPannelloOpenData({
      esito: scheda.componiRispostaScheda({ csv: csvFolpan, nome: 'Prodotto inesistente', urlCsv: '' }),
      nome: 'Prodotto inesistente'
    });
    expect(html).toContain('Non trovo');
    expect(html).toContain('https://fitosanitari.salute.gov.it/');
    expect(html).not.toContain('registro-dose-ha');
    expect(html).not.toContain('data-conferma-manuale');
  });
});

function chiaveUtile(unito) {
  const conferma = unito.confermeSpecie[Object.keys(unito.confermeSpecie).find((k) => k.includes('oidio'))];
  return conferma && conferma.avversita;
}

describe('semaforo in magazzino', () => {
  it('usa lo stato del CSV e non parla di scheda letta', () => {
    expect(testoStatoLetturaScheda({ categoria: 'fertilizzanti', statoAmministrativoScheda: 'Autorizzato' })).toBe('');
    expect(htmlSemaforoLetturaScheda({ categoria: 'fitofarmaci', nome: 'Cupravit' })).toBe('');
    expect(htmlSemaforoLetturaScheda({
      categoria: 'fitofarmaci',
      letturaSchedaStato: 'pronta'
    })).toBe('');
    const verde = htmlSemaforoLetturaScheda({
      categoria: 'fitofarmaci',
      statoAmministrativoScheda: 'Ri-registrato'
    });
    expect(verde).toContain('gfv-semaforo--green');
    expect(verde).toContain('Ri-registrato');
    expect(verde).not.toMatch(/Scheda letta|in lettura|In attesa/i);
    const rosso = htmlSemaforoLetturaScheda({
      categoria: 'fitofarmaci',
      statoAmministrativoScheda: 'Revocato'
    });
    expect(rosso).toContain('gfv-semaforo--red');
    expect(rosso).toContain('Revocato');
    expect(htmlSemaforoLetturaScheda({
      categoria: 'fitofarmaci',
      statoAmministrativoScheda: 'Scaduto'
    })).toContain('gfv-semaforo--red');
    expect(htmlSemaforoLetturaScheda({
      categoria: 'fitofarmaci',
      statoAmministrativoScheda: 'Sospeso'
    })).toContain('gfv-semaforo--red');
    expect(rosso).not.toMatch(/<button/i);
  });
});
