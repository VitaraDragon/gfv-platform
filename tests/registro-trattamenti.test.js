import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';
import {
  MAPPA_DESTINAZIONE_VIGNETO,
  colturaSchedaRegistro,
  aliasColturaScheda
} from '../core/config/registro-trattamenti-specie.js';
import {
  testoStatoLetturaScheda,
  htmlSemaforoLetturaScheda,
  calcolaAcqua,
  calcolaMiscela,
  doseBottePiena,
  avvisoImpieghiEIntervallo,
  avvisoDiluizione,
  valutaCancellazioneRegistro,
  registroToCsv,
  registroToXml,
  righeExportRegistro,
  NOTA_PASSAGGIO_NON_REGISTRATO,
  vociMenuScheda,
  piuFinestreInMenu,
  chiaveConfermaScheda,
  unisciConfermaSpecie,
  rangeDoseAvviso,
  schedaDaRileggere,
  htmlAvvisoRevoca,
  htmlNotaFontiEtichetta,
  AVVISO_ETICHETTA_AUTOMATICA
} from '../shared/js/registro-trattamenti.js';
import fs from 'fs';

const require = createRequire(import.meta.url);
const scheda = require('../functions/lib/registro-trattamenti-scheda-core.js');
const { testoDaPdf } = require('../functions/lib/etichetta-pdf.js');
const lettura = fs.readFileSync(new URL('../functions/registro-trattamenti-lettura.js', import.meta.url), 'utf8');

describe('specie della scheda', () => {
  it('mappa il vigneto e non indovina il misto', () => {
    expect(colturaSchedaRegistro({ modulo: 'vigneto', destinazioneUva: 'vino' })).toBe('vite da vino');
    expect(colturaSchedaRegistro({ modulo: 'vigneto', destinazioneUva: 'vendita_uva' })).toBe('vite da tavola');
    expect(colturaSchedaRegistro({ modulo: 'vigneto', destinazioneUva: 'misto' })).toBeNull();
    expect(MAPPA_DESTINAZIONE_VIGNETO.misto).toBeNull();
  });

  it('mappa frutteto e seminativo, e lascia stare ciò che non conosce', () => {
    expect(colturaSchedaRegistro({ modulo: 'frutteto', specie: 'Melo' })).toBe('melo');
    expect(colturaSchedaRegistro({ modulo: 'frutteto', specie: 'Altro' })).toBeNull();
    expect(colturaSchedaRegistro({ modulo: 'seminativo', colturaNome: 'Grano' })).toBe('frumento');
    expect(colturaSchedaRegistro({ modulo: 'seminativo', colturaNome: 'Coltura inventata' })).toBeNull();
    expect(aliasColturaScheda('frumento')).toContain('grano');
  });
});

describe('miscela', () => {
  it('calcola la botte piena come nell\'esempio Folpan e Karathane', () => {
    expect(doseBottePiena(1.25, 4)).toBe(5);
    expect(doseBottePiena(0.25, 4)).toBe(1);
    expect(doseBottePiena(1.25, 15)).toBe(18.75);
    expect(doseBottePiena(0.25, 15)).toBe(3.75);
  });

  it('ricava l\'acqua mancante dagli ettari', () => {
    expect(calcolaAcqua({ ettari: 2, ettolitriPerEttaro: 4 }).ettolitriTotali).toBe(8);
    expect(calcolaAcqua({ ettari: 2, ettolitriTotali: 8 }).ettolitriPerEttaro).toBe(4);
  });

  it('sull\'ultima botte parziale non carica la dose della botte piena', () => {
    const miscela = calcolaMiscela({
      ettari: 1,
      ettolitriTotali: 6,
      capacitaBotteQuintali: 4,
      nomeAttrezzo: 'Florida',
      prodotti: [{ nome: 'Folpan', dosePerEttaro: 2, dosePerEttolitro: 1.25, unita: 'kg' }]
    });
    expect(miscela.prodotti[0].doseBottePiena).toBe(5);
    expect(miscela.ultimaBotte.ettolitri).toBe(2);
    expect(miscela.ultimaBotte.prodotti[0].quantita).toBe(2.5);
    expect(miscela.prodotti[0].quantita).toBe(2);
  });

  it('senza quintali non inventa la botte', () => {
    const miscela = calcolaMiscela({
      ettari: 1,
      ettolitriPerEttaro: 4,
      prodotti: [{ nome: 'Folpan', dosePerEttaro: 1, dosePerEttolitro: 1.25 }]
    });
    expect(miscela.prodotti[0].doseBottePiena).toBeNull();
    expect(miscela.ultimaBotte).toBeNull();
  });
});

describe('avvisi', () => {
  const conferma = { impieghiMassimiAnno: 2, giorniMinimiTraPassaggi: 7 };

  it('non conta un altro campo e non blocca', () => {
    const esito = avvisoImpieghiEIntervallo({
      data: '2026-08-10',
      terrenoId: 'campo-a',
      prodottoId: 'p1',
      nome: 'Folpan',
      conferma,
      precedenti: [
        { data: '2026-08-01', terrenoId: 'campo-b', prodottoId: 'p1' },
        { data: '2026-07-01', terrenoId: 'campo-a', prodottoId: 'p1' }
      ]
    });
    expect(esito.blocca).toBe(false);
    expect(esito.avvisi).toEqual([]);
  });

  it('avvisa se si è già al massimo o se l\'ultimo passaggio è troppo vicino', () => {
    const max = avvisoImpieghiEIntervallo({
      data: '2026-08-20',
      terrenoId: 'campo-a',
      prodottoId: 'p1',
      nome: 'Folpan',
      conferma,
      precedenti: [
        { data: '2026-06-01', terrenoId: 'campo-a', prodottoId: 'p1' },
        { data: '2026-07-01', terrenoId: 'campo-a', prodottoId: 'p1' }
      ]
    });
    expect(max.avvisi[0]).toMatch(/numero massimo/);
    const vicino = avvisoImpieghiEIntervallo({
      data: '2026-08-04',
      terrenoId: 'campo-a',
      prodottoId: 'p1',
      nome: 'Folpan',
      conferma,
      precedenti: [{ data: '2026-08-01', terrenoId: 'campo-a', prodottoId: 'p1' }],
      includiNotaNonRegistrato: true
    });
    expect(vicino.avvisi[0]).toMatch(/troppo vicino/);
    expect(vicino.avvisi).toContain(NOTA_PASSAGGIO_NON_REGISTRATO);
  });

  it('senza conferma dice che il controllo non si può fare', () => {
    const esito = avvisoImpieghiEIntervallo({
      data: '2026-08-10',
      terrenoId: 'campo-a',
      prodottoId: 'p1',
      nome: 'Folpan',
      conferma: null,
      precedenti: []
    });
    expect(esito.avvisi[0]).toMatch(/non si può fare/);
  });

  it('avvisa se prodotto e acqua non tornano con la dose per ettolitro', () => {
    expect(avvisoDiluizione({
      nome: 'Folpan',
      quantita: 8,
      ettolitriTotali: 4,
      dosePerEttolitro: 1.25
    })).toMatch(/non tornano/);
    expect(avvisoDiluizione({
      nome: 'Folpan',
      quantita: 5,
      ettolitriTotali: 4,
      dosePerEttolitro: 1.25
    })).toBeNull();
  });
});

describe('conservazione ed export', () => {
  it('non cancella in silenzio un trattamento confermato prima dei tre anni', () => {
    const recente = valutaCancellazioneRegistro({
      data: '2026-06-01',
      prodotti: [{ confermatoIl: '2026-06-01T10:00:00.000Z', avversita: 'peronospora' }]
    }, { ora: new Date('2026-10-13') });
    expect(recente.consentita).toBe(false);
    expect(recente.messaggio).toMatch(/tre anni/);
    expect(recente.messaggio).toMatch(/magazzino/);
    const dopoExport = valutaCancellazioneRegistro({
      data: '2026-06-01',
      prodotti: [{ confermatoIl: '2026-06-01T10:00:00.000Z' }]
    }, { ora: new Date('2026-10-13'), exportConfermato: true });
    expect(dopoExport.consentita).toBe(true);
  });

  it('scrive il nome del terreno e non la dose a botte', () => {
    const righe = righeExportRegistro([{
      azienda: 'Azienda Rossi',
      data: '2026-08-01',
      terreno: 'Barricato',
      coltura: 'uva da vino',
      ettari: 1.2,
      operatore: 'Mario',
      macchina: 'Florida',
      acquaEttolitriTotali: 4,
      acquaEttolitriPerEttaro: 4,
      prodotti: [{
        prodotto: 'Folpan',
        quantita: 2,
        unita: 'kg',
        dosaggio: 1.5,
        dosePerEttolitroScheda: 1.25,
        avversita: 'peronospora',
        giorniCarenzaConfermata: 28,
        specieUsata: 'uva da vino',
        confermatoDa: 'Anna',
        confermatoIl: '2026-08-01T08:00:00.000Z',
        riferimentoRiga: { nomeProdotto: 'Folpan', numeroRegistrazione: '123', colturaScheda: 'uva da vino' },
        principioAttivo: 'folpet',
        fonteScheda: 'Ministero della Salute',
        dataLetturaScheda: '2026-10-12'
      }]
    }]);
    const csv = registroToCsv(righe);
    expect(csv).toContain('Barricato');
    expect(csv).not.toMatch(/dose_botte|indicazioni_di_pericolo/);
    expect(csv).not.toMatch(/SIAN|fascicolo|quaderno/i);
    const xml = registroToXml(righe);
    expect(xml).toContain('<terreno>Barricato</terreno>');
    expect(xml).toContain('privato="true"');
  });
});

describe('parser scheda', () => {
  const csv = [
    'num_registrazione;denominazione_prodotto;sostanze_attive;stato_amministrativo',
    '000100;FOLPAN 80 WDG;FOLPET;Autorizzato',
    '000200;ALTRO;RAME;Revocato'
  ].join('\n');
  const html = `<table><tr><th>Coltura</th><th>Avversità</th><th>Carenza</th><th>Numero massimo</th><th>Intervallo</th><th>Dose ettaro</th><th>Dose ettolitro</th></tr>
    <tr><td>Vite da vino</td><td>Peronospora</td><td>28</td><td>2</td><td>7</td><td>1.5</td><td>1.25</td></tr>
    <tr><td>Vite</td><td>Botrite</td><td>21</td><td>2</td><td>7</td><td>1</td><td>1</td></tr>
    <tr><td>Uva spina</td><td>Oidio</td><td>7</td><td>2</td><td>7</td><td>1</td><td>1</td></tr>
    <tr><td>Vite da vino in serra</td><td>Oidio</td><td>10</td><td>4</td><td>5</td><td>1</td><td>1</td></tr>
    <tr><td>Melo</td><td>Ticchiolatura</td><td>21</td><td>3</td><td>7</td><td>1</td><td>0.5</td></tr></table>`;

  it('trova il prodotto e tiene solo la specie, senza la serra', () => {
    const url = scheda.estraiUrlCsv('<a href="/sites/default/files/opendata/PROD_FTS_6_20261012.csv">Scarica</a>');
    expect(url).toContain('PROD_FTS_6_20261012.csv');
    const risposta = scheda.componiRispostaScheda({
      csv,
      htmlScheda: html,
      nome: 'Folpan',
      specie: 'vite da vino',
      alias: aliasColturaScheda('vite da vino'),
      urlCsv: url
    });
    expect(risposta.prodotti[0].numeroRegistrazione).toBe('000100');
    expect(risposta.prodotti[0].principioAttivo).toBe('FOLPET');
    expect(risposta.dataLettura).toBe('2026-10-12');
    expect(risposta.righe).toHaveLength(1);
    expect(risposta.righe[0].avversita).toBe('Peronospora');
    expect(risposta.righe[0].giorniCarenza).toBe(28);
    expect(risposta.schedaImpieghi).toBe('letta');
  });

  it('senza tabella impieghi non inventa le righe', () => {
    const risposta = scheda.componiRispostaScheda({
      csv,
      htmlScheda: '',
      nome: 'Folpan',
      specie: 'uva da vino',
      alias: [],
      urlCsv: ''
    });
    expect(risposta.righe).toEqual([]);
    expect(risposta.schedaImpieghi).toBe('non_letta');
  });
});

describe('lettura in anagrafica', () => {
  const csv = [
    'num_registrazione;denominazione_prodotto;sostanze_attive;stato_amministrativo',
    '16273;SIVANTO PRIME;FLUPYRADIFURONE;Autorizzato',
    '100;FOLPAN 80 WDG;FOLPET;Autorizzato',
    '200;FOLPAN GOLD;FOLPET;Autorizzato'
  ].join('\n');

  it('non scambia Folpan con Folpan Gold', () => {
    const righe = scheda.parsaCsvFitosanitari(csv);
    expect(scheda.trovaRegistrazioneUnica(righe, 'Folpan Gold').prodotto.numeroRegistrazione).toBe('200');
    expect(scheda.trovaRegistrazioneUnica(righe, 'Folpan').esito).toBe('nome_non_univoco');
    expect(scheda.trovaRegistrazioneUnica(righe, 'Folpan 80 WDG').prodotto.numeroRegistrazione).toBe('100');
    expect(scheda.trovaRegistrazioneUnica(righe, 'Sivanto Prime').prodotto.numeroRegistrazione).toBe('16273');
  });

  it('propone solo la dose che l\'etichetta lega a una coltura e a un\'avversità', () => {
    const chiara = 'Feromone per la lotta contro Prays oleae (Tignola dell\'olivo) su olivo. DOSI D\'APPLICAZIONE: Olivo: 0.5 - 2 aerosol/ha.';
    const righe = scheda.estraiRigheAffidabili(chiara);
    expect(righe.righe).toHaveLength(1);
    expect(righe.righe[0].colturaScheda).toBe('Olivo');
    expect(righe.righe[0].avversita).toBe("Tignola dell'olivo");
    expect(righe.righe[0].doseMinHa).toBe(0.5);
    expect(righe.righe[0].doseMaxHa).toBe(2);
    expect(righe.righe[0].unitaDose).toBe('aerosol');
    expect(righe.righe[0].affidabilita).toBe('alta');
    const doppia = scheda.estraiRigheAffidabili(
      'Tignola dell\'ulivo e Tignola degli agrumi. Numero massimo di erogatori: 100-200 dispenser/ha. Da utilizzare su colture di olivo e limoni.'
    );
    expect(doppia.motivo).toBe('estrazione_incerta');
    expect(doppia.righe).toEqual([]);
  });

  it('un prodotto revocato non propone avversità né dosi', () => {
    const csv = [
      'num_registrazione;denominazione_prodotto;sostanze_attive;stato_amministrativo;data_scadenza_autorizzazione;data_decreto_revoca;data_decorrenza_revoca',
      '100;ALTRO;RAME;Revocato;-;01/03/2026;14/07/2026'
    ].join('\n');
    const archivio = scheda.componiArchivioProdotto({
      csv,
      nome: 'Altro',
      urlCsv: '/opendata/PROD_FTS_6_20261012.csv',
      testoEtichetta: 'Olivo: 1-2 l/ha. Tignola dell\'olivo.',
      oraMs: Date.parse('2026-10-14T00:00:00.000Z')
    });
    expect(archivio.revocatoOScaduto).toBe(true);
    expect(archivio.dataRevocaOScadenza).toBe('14/07/2026');
    expect(archivio.testoRevoca).toBe('Prodotto revocato/scaduto il 14/07/2026: verifica i termini di vendita e di utilizzo nel decreto di revoca');
    expect(archivio.righe).toEqual([]);
    expect(archivio.stato).toBe('da_verificare');
    const html = htmlAvvisoRevoca({ revocatoOScaduto: true, dataRevocaOScadenza: '14/07/2026' });
    expect(html).toContain('Prodotto revocato/scaduto il 14/07/2026');
    expect(html).toContain('#9b1c1c');
  });

  it('un nome ambiguo o assente non diventa una scheda pronta', () => {
    const ambiguo = scheda.componiArchivioProdotto({ csv, nome: 'Folpan' });
    expect(ambiguo.stato).toBe('da_riprovare');
    expect(ambiguo.motivo).toBe('nome_non_univoco');
    expect(ambiguo.righe).toEqual([]);
    expect(ambiguo.numeroRegistrazione).toBeNull();
    const assente = scheda.componiArchivioProdotto({ csv, nome: 'Prodotto inesistente' });
    expect(assente.motivo).toBe('non_trovato');
  });

  it('mette in coda un fitofarmaco nuovo o rinominato, uno alla volta', () => {
    expect(scheda.richiedeLetturaScheda(null, { categoria: 'fitofarmaci', nome: 'Folpan Gold' })).toBe(true);
    expect(scheda.richiedeLetturaScheda(
      { categoria: 'fitofarmaci', nome: 'Folpan Gold', letturaSchedaStato: 'pronta' },
      { categoria: 'fitofarmaci', nome: 'Folpan Gold', letturaSchedaStato: 'in_corso' }
    )).toBe(false);
    expect(scheda.richiedeLetturaScheda(
      { categoria: 'fitofarmaci', nome: 'Folpan' },
      { categoria: 'fitofarmaci', nome: 'Folpan Gold' }
    )).toBe(true);
    expect(scheda.richiedeLetturaScheda(null, { categoria: 'fertilizzanti', nome: 'Urea' })).toBe(false);
    const ora = Date.parse('2026-10-13T16:00:00.000Z');
    const scelto = scheda.scegliProdottoInPagina([
      { id: 'a', categoria: 'fitofarmaci', nome: 'A', letturaSchedaStato: 'pronta', controlloSchedaAt: '2026-10-13T12:00:00.000Z', dataEtichettaLettaAt: '2026-10-13T12:00:00.000Z' },
      { id: 'b', categoria: 'fitofarmaci', nome: 'B', letturaSchedaStato: 'da_riprovare', letturaSchedaAggiornataAt: '2026-10-13T15:00:00.000Z' },
      { id: 'c', categoria: 'fitofarmaci', nome: 'C' },
      { id: 'd', categoria: 'fitofarmaci', nome: 'D', letturaSchedaStato: 'in_corso' }
    ], ora, scheda.ATTESA_RIPROVA_MS);
    expect(scelto.id).toBe('d');
    expect(scelto.modoLettura).toBe('completa');
    const diNuovo = scheda.scegliProdottoInPagina([
      { id: 'b', categoria: 'fitofarmaci', nome: 'B', letturaSchedaStato: 'da_riprovare', letturaSchedaAggiornataAt: '2026-10-13T08:00:00.000Z' }
    ], ora, scheda.ATTESA_RIPROVA_MS);
    expect(diNuovo.id).toBe('b');
  });

  it('accanto al fitofarmaco mette il semaforo, senza un pulsante', () => {
    expect(testoStatoLetturaScheda({ categoria: 'fertilizzanti' })).toBe('');
    expect(htmlSemaforoLetturaScheda({ categoria: 'fertilizzanti', nome: 'Urea' })).toBe('');
    expect(htmlSemaforoLetturaScheda({ categoria: 'fitofarmaci' })).toContain('gfv-semaforo--yellow');
    expect(htmlSemaforoLetturaScheda({ categoria: 'fitofarmaci', letturaSchedaStato: 'in_corso' })).toContain('gfv-semaforo--yellow');
    const verde = htmlSemaforoLetturaScheda({ categoria: 'fitofarmaci', letturaSchedaStato: 'pronta' });
    expect(verde).toContain('gfv-semaforo--green');
    expect(verde).toContain('Scheda letta');
    const rosso = htmlSemaforoLetturaScheda({
      categoria: 'fitofarmaci',
      letturaSchedaStato: 'da_riprovare',
      letturaSchedaMotivo: 'nome_non_univoco'
    });
    expect(rosso).toContain('gfv-semaforo--red');
    expect(rosso).not.toContain('gfv-semaforo--pulse');
    expect(rosso).toMatch(/non corrisponde a una sola/);
    expect(rosso).not.toMatch(/<button/i);
  });
});

describe('menu sul lavoro', () => {
  const righe = [
    { colturaScheda: 'VITE DA VINO', epoca: 'pre-fioritura', avversita: 'Peronospora', pienoCampo: true, giorniCarenza: 14, doseMinHa: 0.5, doseMaxHa: 0.7, unitaDose: 'l' },
    { colturaScheda: 'VITE DA VINO', epoca: 'dopo la fioritura', avversita: 'Peronospora', pienoCampo: true, giorniCarenza: 14, doseMinHa: 1, doseMaxHa: 1, unitaDose: 'l' },
    { colturaScheda: 'VITE', epoca: null, avversita: 'Botrite', pienoCampo: true, giorniCarenza: 21 },
    { colturaScheda: 'VITE DA TAVOLA', epoca: null, avversita: 'Oidio', pienoCampo: true, giorniCarenza: 14 },
    { colturaScheda: 'UVA SPINA', epoca: null, avversita: 'Oidio', pienoCampo: true, giorniCarenza: 7 },
    { colturaScheda: 'MELO', epoca: null, avversita: 'Ticchiolatura', pienoCampo: true, doseMinHa: 1, doseMaxHa: 1 },
    { colturaScheda: 'POMODORO IN SERRA', avversita: 'Afide', pienoCampo: false }
  ];
  const aliasVino = aliasColturaScheda('vite da vino');
  const aliasTavola = aliasColturaScheda('vite da tavola');

  it('propone le avversità della coltura e lascia scegliere l\'epoca', () => {
    const voci = vociMenuScheda({ righe, specie: 'vite da vino', alias: aliasVino });
    expect(voci.map((v) => v.colturaScheda)).toEqual(['VITE DA VINO', 'VITE DA VINO']);
    expect(voci.map((v) => v.epoca)).toEqual(['pre-fioritura', 'dopo la fioritura']);
    expect(voci.every((v) => v.avversita === 'Peronospora')).toBe(true);
    expect(piuFinestreInMenu(voci)).toBe(true);
    expect(vociMenuScheda({ righe, specie: 'melo', alias: aliasColturaScheda('melo') })).toHaveLength(1);
    expect(vociMenuScheda({ righe, specie: null })).toEqual([]);
    const tavola = vociMenuScheda({ righe, specie: 'vite da tavola', alias: aliasTavola });
    expect(tavola.map((v) => v.colturaScheda)).toEqual(['VITE DA TAVOLA']);
    expect(vociMenuScheda({ righe, specie: 'vite da vino', alias: aliasVino }).some((v) => v.colturaScheda === 'UVA SPINA')).toBe(false);
    expect(vociMenuScheda({ righe, specie: 'vite da vino', alias: aliasVino }).some((v) => v.colturaScheda === 'VITE')).toBe(false);
  });

  it('non propone la serra in pieno campo e ricorda la conferma già data', () => {
    const prima = vociMenuScheda({ righe, specie: 'vite da vino', alias: aliasVino })[0];
    const salvata = unisciConfermaSpecie({ nome: 'Sivanto' }, 'vite da vino', {
      ...prima,
      confermatoIl: '2026-10-13T10:00:00.000Z',
      riferimentoRiga: { colturaScheda: prima.colturaScheda, nomeProdotto: 'Sivanto', numeroRegistrazione: '16273' }
    });
    expect(salvata.confermeSpecie[chiaveConfermaScheda(prima)].avversita).toBe('Peronospora');
    expect(salvata.confermeSpecie.vite_da_vino.epoca).toBe('pre-fioritura');
    const diNuovo = vociMenuScheda({
      righe,
      specie: 'vite da vino',
      alias: aliasVino,
      conferme: salvata.confermeSpecie
    });
    expect(diNuovo[0].giaConfermata).toBe(true);
    expect(diNuovo[0].epoca).toBe('pre-fioritura');
    expect(rangeDoseAvviso({ confermatoIl: '2026-10-13', doseMinHa: 0.5, doseMaxHa: 0.7, dosaggio: 1 }, { dosaggioMax: 3 }).max).toBe(0.7);
    expect(rangeDoseAvviso({ dosaggio: 4 }, { dosaggioMax: 3 }).max).toBe(3);
  });
});

describe('rilettura della scheda', () => {
  const csv = [
    'num_registrazione;denominazione_prodotto;sostanze_attive;stato_amministrativo;data_scadenza_autorizzazione;data_decreto_revoca;data_decorrenza_revoca',
    '16273;SIVANTO PRIME;FLUPYRADIFURONE;Autorizzato;31/12/2027;-;-',
    '100;ALTRO;RAME;Revocato;-;-;14/07/2026'
  ].join('\n');

  it('confronta numero, stato e data, e non tratta il primo silenzio come un cambiamento', () => {
    const righe = scheda.parsaCsvFitosanitari(csv);
    const sivanto = righe.find((r) => r.numeroRegistrazione === '16273');
    expect(scheda.dataVariazioneOpenData(sivanto)).toBe('31/12/2027');
    expect(scheda.dataVariazioneOpenData(righe.find((r) => r.numeroRegistrazione === '100'))).toBe('14/07/2026');
    const fermo = scheda.controlloLeggeroScheda({
      numeroRegistrazione: '16273',
      statoAmministrativoScheda: 'Autorizzato',
      dataVariazioneScheda: '31/12/2027'
    }, sivanto);
    expect(fermo.esito).toBe('invariato');
    const cambiato = scheda.controlloLeggeroScheda({
      numeroRegistrazione: '16273',
      statoAmministrativoScheda: 'Autorizzato',
      dataVariazioneScheda: '31/12/2026'
    }, sivanto);
    expect(cambiato.esito).toBe('cambiato');
    expect(scheda.controlloLeggeroScheda({ numeroRegistrazione: '16273' }, null).esito).toBe('non_trovato');
    expect(scheda.controlloLeggeroScheda({ numeroRegistrazione: '16273' }, sivanto).esito).toBe('invariato');
  });

  it('il controllo open data è settimanale, l\'etichetta al massimo una volta al mese', () => {
    const ora = Date.parse('2026-10-13T12:00:00.000Z');
    expect(schedaDaRileggere({ letturaSchedaStato: 'pronta', letturaSchedaCompletaAt: '2026-04-13T00:00:00.000Z' }, ora)).toBe(false);
    const fresca = {
      id: 'a',
      categoria: 'fitofarmaci',
      nome: 'A',
      letturaSchedaStato: 'pronta',
      letturaSchedaCompletaAt: '2026-10-01T00:00:00.000Z',
      controlloSchedaAt: '2026-10-12T00:00:00.000Z',
      dataEtichettaLettaAt: '2026-10-01T00:00:00.000Z'
    };
    expect(scheda.scegliProdottoInPagina([fresca], ora, scheda.ATTESA_RIPROVA_MS)).toBeNull();
    const daControllare = scheda.scegliProdottoInPagina([{
      ...fresca,
      controlloSchedaAt: '2026-10-01T00:00:00.000Z'
    }], ora, scheda.ATTESA_RIPROVA_MS);
    expect(daControllare.modoLettura).toBe('leggera');
    const etichettaVecchia = scheda.scegliProdottoInPagina([{
      ...fresca,
      dataEtichettaLettaAt: '2026-09-01T00:00:00.000Z',
      controlloSchedaAt: '2026-10-01T00:00:00.000Z'
    }], ora, scheda.ATTESA_RIPROVA_MS);
    expect(etichettaVecchia.modoLettura).toBe('completa');
    expect(lettura).not.toContain('https://www.sian.it');
  });
});

describe('etichette reali del Ministero', () => {
  const html = fs.readFileSync(new URL('./fixtures/etichette/elenco-sostanza-849.html', import.meta.url), 'utf8');

  it('collega il numero di registrazione all\'indirizzo del PDF', () => {
    const righe = scheda.parsaElencoEtichetteMinistero(html);
    const aomate = scheda.rigaEtichettaPerNumero(righe, '018577');
    const mister = scheda.rigaEtichettaPerNumero(righe, '18592');
    const praystec = scheda.rigaEtichettaPerNumero(righe, '018651');
    expect(aomate.urlEtichetta).toBe('https://www.fitosanitari.salute.gov.it/fitosanitariws_new/EtichettaServlet?id=44088');
    expect(aomate.dataEtichetta).toBe('05/02/2025');
    expect(mister.urlEtichetta).toBe('https://www.fitosanitari.salute.gov.it/fitosanitariws_new/EtichettaServlet?id=42303');
    expect(praystec.urlEtichetta).toBe('https://www.fitosanitari.salute.gov.it/fitosanitariws_new/EtichettaServlet?id=42464');
    expect(mister.stato).toMatch(/Scaduto/i);
    expect(scheda.avvisoRevocaOScadenza({ stato: mister.stato, dataScadenzaAutorizzazione: '05/07/2024' }, Date.parse('2026-10-14T00:00:00.000Z')).testo)
      .toContain('Prodotto revocato/scaduto il 05/07/2024');
  });

  it('legge tre etichette diverse e non inventa la dose se la coltura non è univoca', async () => {
    const aomate = await testoDaPdf(fs.readFileSync(new URL('./fixtures/etichette/018577-aomate-prays.pdf', import.meta.url)));
    const mister = await testoDaPdf(fs.readFileSync(new URL('./fixtures/etichette/018592-mister-p-2024.pdf', import.meta.url)));
    const praystec = await testoDaPdf(fs.readFileSync(new URL('./fixtures/etichette/018651-praystec-2024.pdf', import.meta.url)));
    expect(aomate).toMatch(/AOMATE/i);
    expect(mister).toMatch(/MISTER P 2024/);
    expect(praystec).toMatch(/PRAYSTEC 2024/);
    expect(scheda.estraiRigheAffidabili(aomate).righe).toEqual([]);
    const rigaMister = scheda.estraiRigheAffidabili(mister).righe[0];
    expect(rigaMister.colturaScheda).toBe('Olivo');
    expect(rigaMister.avversita).toMatch(/Tignola dell'olivo/i);
    expect(rigaMister.doseMinHa).toBe(0.5);
    expect(rigaMister.doseMaxHa).toBe(2);
    expect(rigaMister.unitaDose).toBe('aerosol');
    const rigaPray = scheda.estraiRigheAffidabili(praystec).righe[0];
    expect(rigaPray.colturaScheda.toLowerCase()).toBe('olivo');
    expect(rigaPray.doseMinHa).toBe(100);
    expect(rigaPray.doseMaxHa).toBe(300);
    expect(rigaPray.unitaDose).toBe('diffusori');
    const nota = htmlNotaFontiEtichetta({
      dataEtichetta: '08/03/2024',
      urlEtichetta: 'https://www.fitosanitari.salute.gov.it/fitosanitariws_new/EtichettaServlet?id=42303'
    });
    expect(nota).toContain('Fonte: etichetta autorizzata del 08/03/2024 – Ministero della Salute');
    expect(nota).toContain('https://www.dati.gov.it/iodl/2.0/');
    expect(nota).toContain(AVVISO_ETICHETTA_AUTOMATICA);
    expect(nota).not.toMatch(/approva GFV|dose consigliata/i);
  });
});
