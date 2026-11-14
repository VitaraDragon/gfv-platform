/**
 * Sede landing: il civico si accoda alla via, si chiede una volta, la voce
 * segue il testo in chat. Stessi helper su client e server.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  DOMANDA_PODERI,
  preparaTurnoOnboarding,
  separaViaEComune,
  serializzaRaccolti,
  unisciCivicoAllaSede,
  unisciDati,
} from '../../landing/src/lib/tony-aiuto-account.js';
import { decidiVoceESchermo, testoPerBigliettoVoce } from '../../landing/src/lib/tony-chat-logica.js';
import {
  costruisciSessioneIntervista,
  leggiSessioneIntervista,
  salvaSessioneIntervista,
} from '../../landing/src/lib/tony-sessione-intervista.js';

const require = createRequire(import.meta.url);
const { rispostaAccountDaTesto } = require('../../functions/lib/tony-landing-account.js');

const CIVICO = "Il numero civico, se ce l'hai, dimmelo pure.";
const PODERI = DOMANDA_PODERI;

function storageFinto() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

function turnoClient(datiAttuali, domanda, datiNuovi, testo) {
  return preparaTurnoOnboarding({
    domanda,
    passo: 'sede',
    datiAttuali,
    datiNuovi,
    testo,
  });
}

describe('separaViaEComune e unisciCivicoAllaSede', () => {
  it.each([
    ['via Roma, Faenza', 'via Roma', 'Faenza', null],
    ['via Roma a Faenza', 'via Roma', 'Faenza', null],
    ['via Roma 12, Faenza', 'via Roma 12', 'Faenza', null],
    ['via Roma, Faenza RA', 'via Roma', 'Faenza', 'RA'],
  ])('%s → %s, %s', (indirizzo, via, citta, provincia) => {
    expect(separaViaEComune({ indirizzo, citta: null, cap: null, provincia: null })).toMatchObject({
      indirizzo: via,
      citta,
      provincia,
    });
  });

  it('non tratta una sigla o un CAP come comune', () => {
    expect(separaViaEComune({ indirizzo: 'via Roma, RA', citta: null }).indirizzo).toBe('via Roma, RA');
    expect(separaViaEComune({ indirizzo: 'via Roma, 48018', citta: null }).citta).toBeFalsy();
  });

  it('accoda il civico alla via e, se c’è solo il comune, lascia il numero', () => {
    expect(
      unisciCivicoAllaSede({ indirizzo: 'via Roma, Faenza', citta: null, cap: null, provincia: null }, '12')
    ).toMatchObject({ indirizzo: 'via Roma 12', citta: 'Faenza' });
    expect(
      unisciCivicoAllaSede(
        { indirizzo: null, citta: 'Faenza', cap: null, provincia: 'RA' },
        '12'
      )
    ).toMatchObject({ indirizzo: '12', citta: 'Faenza', provincia: 'RA' });
    expect(
      unisciCivicoAllaSede(
        { indirizzo: 'via Roma', citta: 'Faenza', cap: '48018', provincia: 'RA' },
        'via Roma 12, Faenza'
      )
    ).toMatchObject({ indirizzo: 'via Roma 12', citta: 'Faenza', cap: '48018', provincia: 'RA' });
  });

  it('Via Celle + Faenza resta il comune quando arriva il civico già sulla via', () => {
    const prima = unisciDati(
      { sede: null, poderi: [], terreni: [] },
      { sede: { indirizzo: 'Via Celle', citta: 'Faenza', cap: null, provincia: null } },
      'sede'
    );
    const dopo = unisciDati(
      prima.dati,
      { sede: { indirizzo: 'Via Celle 12', citta: null, cap: null, provincia: 'RA' } },
      'sede'
    );
    expect(dopo.dati.sede).toEqual({
      indirizzo: 'Via Celle 12',
      citta: 'Faenza',
      cap: null,
      provincia: 'RA',
    });
  });
});

describe('client: civico una volta, via e comune restano', () => {
  const vuoto = { sede: null, poderi: [], terreni: [] };
  const modelloVia = {
    sede: { indirizzo: 'via Roma, Faenza', citta: null },
    poderi: [],
    terreni: [{ nome: 'Roma', superficie: 1, coltura: 'Grano' }],
  };

  it('«via Roma, Faenza» spezza via e comune e chiede il civico una volta', () => {
    const t = turnoClient(vuoto, 'via Roma, Faenza', modelloVia, 'Hai uno o più poderi?');
    expect(t.dati.dati.sede).toMatchObject({ indirizzo: 'via Roma', citta: 'Faenza' });
    expect(t.dati.dati.terreni).toHaveLength(0);
    expect(t.passo).toBe('sede');
    expect(t.testo).toBe(CIVICO);
    expect(t.dati.dati.civicoGiaChiesto).toBe(true);
  });

  it('poi «12» diventa via Roma 12 a Faenza e si passa ai poderi', () => {
    const prima = turnoClient(vuoto, 'via Roma, Faenza', modelloVia, 'Ok.');
    const dopo = turnoClient(
      prima.dati.dati,
      '12',
      { sede: { indirizzo: '12', citta: null }, terreni: [{ nome: 'Dodici', superficie: 12 }] },
      'Ok, 12.'
    );
    expect(dopo.dati.dati.sede).toMatchObject({ indirizzo: 'via Roma 12', citta: 'Faenza' });
    expect(dopo.passo).toBe('poderi');
    expect(dopo.testo).toBe(PODERI);
    expect(dopo.dati.dati.terreni).toHaveLength(0);
  });

  it('solo Faenza e poi 12 tiene il numero come indirizzo', () => {
    const prima = turnoClient(vuoto, 'Faenza', { sede: null, terreni: [] }, 'Ok.');
    const dopo = turnoClient(
      prima.dati.dati,
      '12',
      { sede: { indirizzo: '12', citta: null }, terreni: [] },
      ''
    );
    expect(dopo.dati.dati.sede).toMatchObject({ indirizzo: '12', citta: 'Faenza' });
    expect(dopo.passo).toBe('poderi');
    expect(dopo.testo).toBe(PODERI);
  });

  it.each(['boh', 'non mi ricordo il numero', "non ce l'ho"])(
    'dopo il civico, %j va ai poderi senza ririchiedere',
    (risposta) => {
      const prima = turnoClient(vuoto, 'via Roma, Faenza', modelloVia, 'Ok.');
      const dopo = turnoClient(
        prima.dati.dati,
        risposta,
        { sede: null, terreni: [{ nome: 'Boh', superficie: 1, coltura: 'Grano' }] },
        'Ripeti il civico.'
      );
      expect(dopo.passo).toBe('poderi');
      expect(dopo.testo).toBe(PODERI);
      expect(dopo.testo).not.toMatch(/numero civico/i);
      expect(dopo.dati.dati.sede).toMatchObject({ indirizzo: 'via Roma', citta: 'Faenza' });
      expect(dopo.dati.dati.sede.indirizzo).not.toMatch(/\d/);
      expect(dopo.dati.dati.terreni).toHaveLength(0);
    }
  );

  it('via già numerata al primo colpo non chiede il civico', () => {
    const t = turnoClient(
      vuoto,
      'via Roma 12, Faenza',
      {
        sede: { indirizzo: 'via Roma 12, Faenza', citta: null },
        poderi: [{ nome: 'Roma' }],
        terreni: [{ nome: 'Roma', superficie: 12, coltura: 'Vite' }],
      },
      'Non ho capito bene. Riprova con via e comune.'
    );
    expect(String(t.testo || '')).not.toMatch(/numero civico/i);
    expect(t.passo).toBe('poderi');
    expect(t.dati.dati.sede).toMatchObject({ indirizzo: 'via Roma 12', citta: 'Faenza' });
    expect(t.dati.dati.terreni).toHaveLength(0);
    expect(t.dati.dati.poderi).toHaveLength(0);
  });
});

describe('server: stessa unione e stessa domanda unica', () => {
  it('spezza via e comune e, al civico, accoda il numero', () => {
    const prima = rispostaAccountDaTesto(
      JSON.stringify({
        testo: 'Sede presa. Hai dei poderi?',
        sede: { indirizzo: 'via Roma, Faenza', citta: null },
        terreni: [{ nome: 'Roma', superficie: 1, coltura: 'Grano' }],
      }),
      { argomento: 'sede', domanda: 'via Roma, Faenza', raccolti: '' }
    );
    expect(prima.dati.sede).toMatchObject({ indirizzo: 'via Roma', citta: 'Faenza' });
    expect(prima.dati.terreni).toHaveLength(0);
    expect(prima.testo).toBe(CIVICO);

    const raccolti = serializzaRaccolti({
      sede: prima.dati.sede,
      civicoGiaChiesto: true,
      poderi: [],
      terreni: [],
    });
    expect(raccolti).toMatch(/Civico già chiesto/);
    const dopo = rispostaAccountDaTesto(
      JSON.stringify({
        testo: 'Ok.',
        sede: { indirizzo: '12', citta: null },
        terreni: [{ nome: 'Dodici', superficie: 12, coltura: 'Grano' }],
      }),
      { argomento: 'sede', domanda: '12', raccolti }
    );
    expect(dopo.dati.sede).toMatchObject({ indirizzo: 'via Roma 12', citta: 'Faenza' });
    expect(dopo.dati.terreni).toHaveLength(0);
    expect(dopo.testo).toBe(PODERI);
  });

  it('Faenza e poi 12 lascia il numero e il comune', () => {
    const raccolti = serializzaRaccolti({
      sede: { indirizzo: null, citta: 'Faenza', cap: null, provincia: null },
      civicoGiaChiesto: true,
      poderi: [],
      terreni: [],
    });
    const dopo = rispostaAccountDaTesto(
      JSON.stringify({ testo: '', sede: { indirizzo: '12' }, terreni: [] }),
      { argomento: 'sede', domanda: '12', raccolti }
    );
    expect(dopo.dati.sede).toMatchObject({ indirizzo: '12', citta: 'Faenza' });
    expect(dopo.testo).toBe(PODERI);
  });

  it.each(['boh', "non ce l'ho"])('«%s» non ripete il civico', (domanda) => {
    const raccolti = serializzaRaccolti({
      sede: { indirizzo: 'via Roma', citta: 'Faenza' },
      civicoGiaChiesto: true,
      poderi: [],
      terreni: [],
    });
    const out = rispostaAccountDaTesto(
      JSON.stringify({
        testo: 'Il numero civico, se ce l\'hai, dimmelo pure.',
        sede: null,
        terreni: [{ nome: 'Boh', superficie: 1 }],
      }),
      { argomento: 'sede', domanda, raccolti }
    );
    expect(out.testo).toBe(PODERI);
    expect(out.testo).not.toMatch(/numero civico/i);
    expect(out.dati.terreni).toHaveLength(0);
    expect(out.dati.sede).toBeNull();
  });

  it('la storia, se manca il flag, basta a non ripetere la domanda', () => {
    const out = rispostaAccountDaTesto(
      JSON.stringify({ testo: 'Ancora il civico?', terreni: [] }),
      {
        argomento: 'sede',
        domanda: 'ok',
        raccolti: 'Sede: via Roma, Faenza',
        storia: [{ ruolo: 'tony', testo: CIVICO }],
      }
    );
    expect(out.testo).toBe(PODERI);
    expect(out.testo).not.toMatch(/numero civico/i);
  });

  it('via già numerata al primo colpo non chiede il civico', () => {
    const out = rispostaAccountDaTesto(
      JSON.stringify({
        testo: 'Non ho capito bene. Riprova con via e comune.',
        sede: { indirizzo: 'via Roma 12, Faenza', citta: null },
        poderi: [{ nome: 'Roma' }],
        terreni: [{ nome: 'Roma', superficie: 12, coltura: 'Vite' }],
      }),
      { argomento: 'sede', domanda: 'via Roma 12, Faenza', raccolti: '' }
    );
    expect(out.testo).toBe('Hai dei poderi?');
    expect(out.testo).not.toMatch(/numero civico/i);
    expect(out.dati.sede).toMatchObject({ indirizzo: 'via Roma 12', citta: 'Faenza' });
    expect(out.dati.terreni).toHaveLength(0);
    expect(out.dati.poderi).toHaveLength(0);
  });
});

describe('il flag del civico sopravvive a un F5', () => {
  it('sessionStorage tiene civicoGiaChiesto', () => {
    const st = storageFinto();
    salvaSessioneIntervista(st, {
      faseAiuto: true,
      aiutoFatto: false,
      messaggi: [{ ruolo: 'tony', testo: CIVICO }],
      storia: [{ ruolo: 'tony', testo: CIVICO }],
      datiAiuto: {
        sede: { indirizzo: 'via Roma', citta: 'Faenza' },
        poderi: [],
        terreni: [],
        civicoGiaChiesto: true,
      },
      passoAiuto: 'sede',
      schedaAperta: false,
    });
    const rec = leggiSessioneIntervista(st, Date.now());
    expect(rec.datiAiuto.civicoGiaChiesto).toBe(true);
    expect(rec.datiAiuto.sede).toMatchObject({ indirizzo: 'via Roma', citta: 'Faenza' });
    expect(
      costruisciSessioneIntervista({ datiAiuto: { civicoGiaChiesto: false } }, 1).datiAiuto
        .civicoGiaChiesto
    ).toBe(false);
  });
});

describe('voce = testo in chat', () => {
  const firmato = CIVICO;
  const id = 'a1b2c3d4e5f6789012345678abcdef01';

  it('se il turno riscriverebbe la frase, lo schermo resta sul testo firmato e l’audio parte', () => {
    const d = decidiVoceESchermo({
      esitoTesto: firmato,
      turnoTesto: firmato + ' ' + PODERI,
      rientro: 'Dove è la sede legale?',
      haBiglietto: true,
    });
    expect(d.testoSchermo).toBe(d.testoAudio);
    expect(d.testoAudio).toBe(firmato);
    expect(d.sostituisci).toBe(false);
    expect(d.chiamaAudio).toBe(true);
    expect(testoPerBigliettoVoce({ testo: firmato, idVoce: id }, firmato + ' ' + PODERI, d.testoSchermo)).toBe(
      firmato
    );
  });

  it('se chat e biglietto coincidono, il testo mandato all’audio è quello mostrato', () => {
    const d = decidiVoceESchermo({
      esitoTesto: PODERI,
      turnoTesto: PODERI,
      rientro: '',
      haBiglietto: true,
    });
    expect(d.chiamaAudio).toBe(true);
    expect(d.testoSchermo).toBe(PODERI);
    expect(testoPerBigliettoVoce({ testo: PODERI }, 'altro', d.testoSchermo)).toBe(PODERI);
  });

  it('senza testo firmato non si chiama l’audio su una frase diversa', () => {
    const d = decidiVoceESchermo({
      esitoTesto: '',
      turnoTesto: '',
      rientro: 'Dove è la sede legale?',
      haBiglietto: true,
    });
    expect(d.testoSchermo).toBe('Dove è la sede legale?');
    expect(d.chiamaAudio).toBe(false);
    expect(d.testoAudio).toBe(d.testoSchermo);
  });
});
