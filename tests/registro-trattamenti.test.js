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
  voceUnicaDaCompilare,
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
    expect(colturaSchedaRegistro({ modulo: 'frutteto', specie: 'Olivo' })).toBe('olivo');
    expect(colturaSchedaRegistro({ modulo: 'frutteto', specie: 'Limone' })).toBe('limone');
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
    expect(righe.righe[0].colturaScheda).toBe('olivo');
    expect(righe.righe[0].avversita).toBe("Tignola dell'olivo");
    expect(righe.righe[0].doseMinHa).toBe(0.5);
    expect(righe.righe[0].doseMaxHa).toBe(2);
    expect(righe.righe[0].unitaDose).toBe('aerosol');
    expect(righe.righe[0].affidabilita).toBe('alta');
    const doppia = scheda.estraiRigheAffidabili(
      'Tignola dell\'ulivo e Tignola degli agrumi. Numero massimo di erogatori: 100-200 dispenser/ha. Da utilizzare su colture di olivo e limoni. Testo di riempimento per superare gli ottanta caratteri richiesti dalla lettura dell\'etichetta.'
    );
    expect(doppia.righe.map((riga) => riga.colturaScheda)).toEqual(['olivo']);
    expect(doppia.righe[0].avversita).toBe("Tignola dell'ulivo");
    const spray = scheda.estraiRigheAffidabili(
      'Vite da vino: Peronospora, dose 1,5-2 kg/ha, carenza 28 giorni, numero massimo di trattamenti: 3, intervallo minimo di 10 giorni. Melo: Ticchiolatura, dose 1-1,2 kg/ha, carenza 21 giorni. Testo lungo abbastanza da essere un\'etichetta vera e non un frammento corto.'
    );
    const vino = vociMenuScheda({ righe: spray.righe, specie: 'vite da vino', alias: aliasColturaScheda('vite da vino') });
    const melo = vociMenuScheda({ righe: spray.righe, specie: 'melo', alias: aliasColturaScheda('melo') });
    expect(vino).toHaveLength(1);
    expect(vino[0].giorniCarenza).toBe(28);
    expect(vino[0].impieghiMassimiAnno).toBe(3);
    expect(vino[0].giorniMinimiTraPassaggi).toBe(10);
    expect(melo[0].avversita).toBe('Ticchiolatura');
    expect(melo[0].giorniCarenza).toBe(21);
    expect(voceUnicaDaCompilare(vino)).toBe(vino[0]);
    expect(voceUnicaDaCompilare(spray.righe)).toBeNull();
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

  it('legge tre etichette e tiene, per il campo, solo la coltura di quel terreno', async () => {
    const aomate = await testoDaPdf(fs.readFileSync(new URL('./fixtures/etichette/018577-aomate-prays.pdf', import.meta.url)));
    const mister = await testoDaPdf(fs.readFileSync(new URL('./fixtures/etichette/018592-mister-p-2024.pdf', import.meta.url)));
    const praystec = await testoDaPdf(fs.readFileSync(new URL('./fixtures/etichette/018651-praystec-2024.pdf', import.meta.url)));
    expect(aomate).toMatch(/AOMATE/i);
    expect(mister).toMatch(/MISTER P 2024/);
    expect(praystec).toMatch(/PRAYSTEC 2024/);
    const righeAomate = scheda.estraiRigheAffidabili(aomate).righe;
    expect(righeAomate.map((riga) => riga.colturaScheda).sort()).toEqual(['limone', 'olivo']);
    expect(vociMenuScheda({ righe: righeAomate, specie: 'olivo', alias: aliasColturaScheda('olivo') }).map((voce) => voce.avversita)).toEqual(["Tignola dell'ulivo"]);
    expect(vociMenuScheda({ righe: righeAomate, specie: 'limone', alias: aliasColturaScheda('limone') }).map((voce) => voce.avversita)).toEqual(['Tignola degli agrumi']);
    expect(vociMenuScheda({ righe: righeAomate, specie: 'melo', alias: aliasColturaScheda('melo') })).toEqual([]);
    expect(righeAomate.every((riga) => riga.impieghiMassimiAnno === 1 && riga.doseMinHa === 100 && riga.doseMaxHa === 200)).toBe(true);
    const rigaMister = scheda.estraiRigheAffidabili(mister).righe[0];
    expect(rigaMister.colturaScheda).toBe('olivo');
    expect(rigaMister.avversita).toMatch(/Tignola dell'olivo/i);
    expect(rigaMister.doseMinHa).toBe(0.5);
    expect(rigaMister.doseMaxHa).toBe(2);
    expect(rigaMister.unitaDose).toBe('aerosol');
    expect(rigaMister.impieghiMassimiAnno).toBe(1);
    const rigaPray = scheda.estraiRigheAffidabili(praystec).righe[0];
    expect(rigaPray.colturaScheda.toLowerCase()).toBe('olivo');
    expect(rigaPray.doseMinHa).toBe(100);
    expect(rigaPray.doseMaxHa).toBe(300);
    expect(rigaPray.unitaDose).toBe('diffusori');
    expect(rigaPray.giorniCarenza).toBe(0);
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

describe('etichetta con più colture', () => {
  const testo = [
    'EPOCHE DI APPLICAZIONE',
    'Melo: contro Podosphaera leucotricha, intervenire in modo preventivo con 60- mL/hL di prodotto, ogni 10 giorni, dallo stadio di prefioritura fino a maturazione.',
    'Vite da vino e da tavola: contro Uncinula necator, intervenire in modo preventivo con 100 mL/hL di prodotto, ogni 10 giorni, da inizio germogliamento a maturazione.',
    'Pesco, Albicocco e Nettarino: contro Sphaerotheca pannosa, intervenire in modo preventivo con 100 mL/hL di prodotto, ogni 10 giorni, dallo stadio di piena fioritura fino a maturazione.',
    'Melone, Cocomero e Zucca: contro Podosphaera fusca e Erysiphe cichoracearum, intervenire in modo preventivo, ogni 10 giorni, dallo stadio di 2 foglie vere fino a maturazione.',
    'Pomodoro (ad esclusione di Pomodoro ciliegino), Melanzana e Peperone: contro Leveillula taurica, intervenire in modo preventivo, ogni 10-12 giorni, dallo stadio di 2 foglie vere fino a maturazione.',
    'DOSAGGI E MODALITA DI IMPIEGO Coltura Dose (L/ha) N° massimo Applicazioni',
    'Melo 0,9 4 Pesco, Albicocco e Nettarine 0,75–1 4 Vite da vino e da tavola 0,8–1,5 4',
    'Melone, Cocomero, Zucca (in pieno campo e serra) 1 Pieno campo: 4 Serra: 3',
    'Pomodoro (ad esclusione di Pomodoro ciliegino), Melanzana, Peperone (in pieno campo e serra) 1–2 4',
    'N.B. Impiegare il dosaggio più elevato nel caso di forte pressione di malattia.',
    'INTERVALLO TRA L\'ULTIMO TRATTAMENTO E LA RACCOLTA: 1 giorno per Melone, Cocomero, Zucca, 3 giorni per Pomodoro (ad esclusione di Pomodoro ciliegino), Peperone, Melanzana; 7 giorni per Pesco, Albicocco, Nettarine; 14 giorni per Melo, Vite da tavola e da vino.'
  ].join(' ');

  it('unisce epoca, tabella e carenza e lascia al campo la sua coltura', () => {
    const righe = scheda.estraiRigheAffidabili(testo).righe;
    const vino = vociMenuScheda({ righe, specie: 'vite da vino', alias: aliasColturaScheda('vite da vino') });
    expect(vino).toHaveLength(1);
    expect(vino[0].avversita).toBe('Uncinula necator');
    expect(vino[0].doseMinHa).toBe(0.8);
    expect(vino[0].doseMaxHa).toBe(1.5);
    expect(vino[0].doseMinHl).toBe(100);
    expect(vino[0].unitaDoseHa).toBe('l');
    expect(vino[0].unitaDoseHl).toBe('ml');
    expect(vino[0].impieghiMassimiAnno).toBe(4);
    expect(vino[0].giorniMinimiTraPassaggi).toBe(10);
    expect(vino[0].giorniCarenza).toBe(14);
    expect(vociMenuScheda({ righe, specie: 'vite da tavola', alias: aliasColturaScheda('vite da tavola') })[0].doseMaxHa).toBe(1.5);
    const melo = vociMenuScheda({ righe, specie: 'melo', alias: aliasColturaScheda('melo') })[0];
    expect(melo.doseMinHa).toBe(0.9);
    expect(melo.doseMaxHl).toBe(60);
    expect(melo.giorniCarenza).toBe(14);
    const pesco = vociMenuScheda({ righe, specie: 'pesco', alias: aliasColturaScheda('pesco') });
    expect(pesco.map((voce) => voce.colturaScheda)).toEqual(['pesco']);
    expect(pesco[0].giorniCarenza).toBe(7);
    expect(righe.some((riga) => riga.colturaScheda === 'nettarine')).toBe(true);
    expect(righe.some((riga) => /ciliegino/i.test(riga.colturaScheda))).toBe(false);
    const melone = vociMenuScheda({ righe, specie: 'melone', alias: ['melone'] });
    expect(melone.every((voce) => voce.pienoCampo !== false && voce.impieghiMassimiAnno === 4)).toBe(true);
    expect(melone.map((voce) => voce.avversita).sort()).toEqual(['Erysiphe cichoracearum', 'Podosphaera fusca']);
    expect(righe.find((riga) => riga.colturaScheda === 'melone' && riga.pienoCampo === false).impieghiMassimiAnno).toBe(3);
  });
});

describe('etichette con tabella o frase', () => {
  it('legge coltura, patogeno, dose e carenza di una tabella', () => {
    const testo = [
      'Modalità di impiego e dosi Coltura Patogeno dose grammi/ 100 litri dose in Kg per ettaro Modalità / epoca di applicazione',
      'Pomodoro, melanzana (pieno campo) Muffa grigia: Botrytis cinerea 60-80 0,8 Effettuare un massimo di 3 trattamenti, intervenendo ad intervalli di 10-14 giorni.',
      'Pero (pieno campo) Maculatura bruna: Stemphylium vesicarium 60-80 1 Effettuare un massimo di 3 trattamenti ad intervalli di 10 giorni.',
      'Sospendere i trattamenti prima della raccolta: pero: 3 giorni; pomodoro e melanzana: 3 giorni ATTENZIONE'
    ].join(' ');
    const righe = scheda.estraiRigheAffidabili(testo).righe;
    const pomodoro = righe.filter((riga) => riga.colturaScheda === 'pomodoro');
    expect(pomodoro.map((riga) => riga.avversita)).toEqual(['Muffa grigia']);
    expect(pomodoro[0].doseMinHl).toBe(60);
    expect(pomodoro[0].doseMaxHl).toBe(80);
    expect(pomodoro[0].unitaDoseHl).toBe('g');
    expect(pomodoro[0].doseMinHa).toBe(0.8);
    expect(pomodoro[0].unitaDoseHa).toBe('kg');
    expect(pomodoro[0].impieghiMassimiAnno).toBe(3);
    expect(pomodoro[0].giorniMinimiTraPassaggi).toBe(10);
    expect(pomodoro[0].giorniCarenza).toBe(3);
    const pero = righe.find((riga) => riga.colturaScheda === 'pero');
    expect(pero.avversita).toBe('Maculatura bruna');
    expect(pero.doseMaxHa).toBe(1);
  });

  it('legge la frase contro e il numero massimo che segue', () => {
    const testo = "DOSI D'IMPIEGO Pomacee Melo - Contro ticchiolatura (Venturia inaequalis) e cancri rameali (Nectria galligena): 0,5-0,75 kg/ha (33-50 g/hl). Non superare i 6 trattamenti totali per anno. Eseguire i trattamenti ad intervalli di 5 giorni per la dose più bassa e ad intervalli di 7 giorni per la dose più alta. Sospendere i trattamenti 42 GIORNI prima della raccolta di mele. ATTENZIONE";
    const righe = scheda.estraiRigheAffidabili(testo).righe;
    expect(righe.map((riga) => riga.avversita).sort()).toEqual(['Cancri rameali', 'Ticchiolatura']);
    expect(righe.every((riga) => riga.colturaScheda === 'melo' && riga.doseMinHa === 0.5 && riga.doseMaxHa === 0.75)).toBe(true);
    expect(righe.every((riga) => riga.doseMinHl === 33 && riga.unitaDoseHl === 'g' && riga.impieghiMassimiAnno === 6)).toBe(true);
    expect(righe.every((riga) => riga.giorniMinimiTraPassaggi === 5 && riga.giorniCarenza === 42)).toBe(true);
  });

  it('legge dose, intervallo e massimo sulla stessa riga e tiene la lebbra', () => {
    const testo = 'Coltura Malattia Dose prodotto (kg/ha) Intervallo tra i trattamenti Numero massimo di trattamenti Olivo (olive da olio e da tavola) Occhio di pavone (Spilocaea oleagina) 0,5 21 gg 2 Lebbra (Colletotrichum spp.) Pero Ticchiolatura (Venturia pirina) 0,5 8 gg 3 Sospendere i trattamenti: 21 GIORNI prima della raccolta per pero; 100 GIORNI prima della raccolta per olivo. ATTENZIONE';
    const righe = scheda.estraiRigheAffidabili(testo).righe;
    const olivo = righe.filter((riga) => riga.colturaScheda === 'olivo');
    expect(olivo.map((riga) => riga.avversita).sort()).toEqual(['Lebbra', 'Occhio di pavone']);
    expect(olivo.every((riga) => riga.doseMinHa === 0.5 && riga.impieghiMassimiAnno === 2 && riga.giorniMinimiTraPassaggi === 21 && riga.giorniCarenza === 100)).toBe(true);
    const pero = righe.find((riga) => riga.colturaScheda === 'pero');
    expect(pero.avversita).toBe('Ticchiolatura');
    expect(pero.giorniMinimiTraPassaggi).toBe(8);
    expect(pero.impieghiMassimiAnno).toBe(3);
    expect(pero.giorniCarenza).toBe(21);
  });

  it('separa 1 giorno da 3 giorni e non tiene un latino spezzato', () => {
    const testo = [
      'Coltura Patogeno dose grammi/ 100 litri dose in Kg per ettaro',
      'Fagioli da granella (pieno campo) Sclerotinia, Antracnosi e muffa grigia Sclerotinia spp Colletotric hum spp Botrytis cinerea - 1 Effettuare un massimo di 2 trattamenti a cadenza di 10-14 giorni.',
      'Kiwi Muffa grigia Botrytis cinerea 80 0,8 Massimo 2 trattamenti con un intervallo di 7 giorni.',
      'Cetriolo e zucchino Peronospora 80 0,5',
      'Pomodoro Peronospora 80 0,5',
      'Sospendere i trattamenti: 1 GIORNO prima della raccolta per cetriolo e zucchino, 3 GIORNI prima della raccolta per pomodoro. ATTENZIONE'
    ].join(' ');
    const righe = scheda.estraiRigheAffidabili(testo).righe;
    const fagioli = righe.filter((riga) => riga.colturaScheda === 'fagiolo');
    expect(fagioli.map((riga) => riga.avversita).sort()).toEqual(['Antracnosi', 'Muffa grigia', 'Sclerotinia']);
    expect(fagioli.every((riga) => riga.doseMinHa === 1 && riga.doseMinHl == null && riga.impieghiMassimiAnno === 2 && riga.giorniMinimiTraPassaggi === 10)).toBe(true);
    const kiwi = righe.find((riga) => riga.colturaScheda === 'actinidia');
    expect(kiwi.avversita).toBe('Muffa grigia');
    expect(kiwi.doseMinHl).toBe(80);
    expect(kiwi.doseMinHa).toBe(0.8);
    expect(righe.find((riga) => riga.colturaScheda === 'cetriolo').giorniCarenza).toBe(1);
    expect(righe.find((riga) => riga.colturaScheda === 'zucchino').giorniCarenza).toBe(1);
    expect(righe.find((riga) => riga.colturaScheda === 'pomodoro').giorniCarenza).toBe(3);
  });
});

describe('lettura Gemini dell\'etichetta', () => {
  const { leggiPagineEtichetta } = require('../functions/lib/etichetta-gemini.js');
  const citazione = 'Pesco Monilia laxa 0,4 kg/ha 40 g/hl massimo 3 trattamenti, intervallo di 7 giorni';
  const proposta = {
    coltura: 'Pesco',
    avversita: 'Monilia laxa',
    citazione,
    pienoCampo: true,
    doseMinHa: 0.4,
    doseMaxHa: 0.4,
    unitaHa: 'kg',
    doseMinHl: 40,
    doseMaxHl: 40,
    unitaHl: 'g',
    impieghiMassimiAnno: 3,
    giorniMinimiTraPassaggi: 7
  };

  it('tiene la riga solo se le due letture coincidono e la citazione lega i numeri', async () => {
    const esito = await leggiPagineEtichetta(Buffer.from('pdf'), async () => JSON.stringify({ righe: [proposta] }));
    expect(esito.stato).toBe('pronta');
    expect(esito.righe).toHaveLength(1);
    expect(esito.righe[0].colturaScheda).toBe('pesco');
    expect(esito.righe[0].doseMinHa).toBe(0.4);
    expect(esito.righe[0].doseMinHl).toBe(40);
    expect(esito.righe[0].impieghiMassimiAnno).toBe(3);
    expect(esito.righe[0].giorniMinimiTraPassaggi).toBe(7);
    expect(esito.righe[0].affidabilita).toBe('alta');
  });

  it('scarta la dose di un\'altra coltura, la serra non scritta e la lettura che non torna', async () => {
    const doppia = Object.assign({}, proposta, {
      citazione: 'Pesco Monilia laxa 0,4 kg/ha e 0,8 kg/ha'
    });
    const doppiaEsito = await leggiPagineEtichetta(Buffer.from('pdf'), async () => JSON.stringify({ righe: [doppia] }));
    expect(doppiaEsito.righe).toEqual([]);
    expect(doppiaEsito.motivo).toBe('estrazione_incerta');

    const serra = Object.assign({}, proposta, { pienoCampo: true, citazione: 'Pesco in serra Monilia laxa 0,4 kg/ha 40 g/hl massimo 3 trattamenti, intervallo di 7 giorni' });
    const serraEsito = await leggiPagineEtichetta(Buffer.from('pdf'), async () => JSON.stringify({ righe: [serra] }));
    expect(serraEsito.righe).toEqual([]);

    let turno = 0;
    const diversa = await leggiPagineEtichetta(Buffer.from('pdf'), async () => {
      turno += 1;
      const riga = turno === 1 ? proposta : Object.assign({}, proposta, { doseMinHa: 0.8, doseMaxHa: 0.8, citazione: 'Pesco Monilia laxa 0,8 kg/ha 40 g/hl massimo 3 trattamenti, intervallo di 7 giorni' });
      return JSON.stringify({ righe: [riga] });
    });
    expect(diversa.righe).toEqual([]);
  });

  it('non usa le regole sul testo se la lettura Gemini non ha righe', () => {
    const csv = [
      'num_registrazione;denominazione_prodotto;sostanze_attive;stato_amministrativo;data_scadenza_autorizzazione;data_decreto_revoca;data_decorrenza_revoca',
      '12862;CANTUS;BOSCALID;Autorizzato;-;-;-'
    ].join('\n');
    const vuoto = scheda.componiArchivioProdotto({
      csv,
      nome: 'Cantus',
      righeLette: [],
      motivoLettura: 'estrazione_incerta',
      testoEtichetta: 'Pesco: contro Monilia, dose 0,4 kg/ha.'
    });
    expect(vuoto.stato).toBe('da_verificare');
    expect(vuoto.righe).toEqual([]);
    const letta = scheda.componiArchivioProdotto({
      csv,
      nome: 'Cantus',
      righeLette: [{
        colturaScheda: 'pesco',
        avversita: 'Monilia laxa',
        pienoCampo: true,
        doseMinHa: 0.4,
        doseMaxHa: 0.4,
        unitaDoseHa: 'kg',
        affidabilita: 'alta'
      }]
    });
    expect(letta.stato).toBe('pronta');
    expect(letta.righe).toHaveLength(1);
    expect(letta.righe[0].colturaScheda).toBe('pesco');
  });

  it('la pagina di errore del Ministero non conta come etichetta assente', () => {
    expect(scheda.esitoRispostaMinistero(200, "Si e' verificato un errore durante l'operazione")).toBe('errore');
    expect(scheda.esitoRispostaMinistero(403, '')).toBe('bloccato');
    expect(scheda.esitoRispostaMinistero(200, '<td>018577</td>')).toBe('ok');
  });
});
