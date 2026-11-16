import { describe, expect, it } from 'vitest';
import {
  MAPPA_DESTINAZIONE_VIGNETO,
  colturaSchedaRegistro,
  aliasColturaScheda
} from '../core/config/registro-trattamenti-specie.js';
import {
  calcolaAcqua,
  calcolaMiscela,
  doseBottePiena,
  avvisoImpieghiEIntervallo,
  avvisoDiluizione,
  valutaCancellazioneRegistro,
  registroToCsv,
  registroToXml,
  righeExportRegistro,
  NOTA_PASSAGGIO_NON_REGISTRATO
} from '../shared/js/registro-trattamenti.js';

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

  it('mappa orticole note e lascia null le sconosciute', () => {
    expect(colturaSchedaRegistro({ modulo: 'orticole', colturaNome: 'Pomodoro' })).toBe('pomodoro');
    expect(colturaSchedaRegistro({ modulo: 'orticole', colturaNome: 'Patate' })).toBe('patata');
    expect(colturaSchedaRegistro({ modulo: 'orticole', colturaNome: 'Cipolle' })).toBe('cipolla');
    expect(colturaSchedaRegistro({ modulo: 'orticole', colturaNome: 'Coltura inventata' })).toBeNull();
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
