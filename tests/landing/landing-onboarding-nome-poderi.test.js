/**
 * Onboarding landing: nome del terreno distinto da varietà/ettari,
 * domanda facoltativa sui poderi.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  DOMANDA_PODERI,
  allineaPassoAiuto,
  correggiTerreniEstratti,
  interpretaFraseTerreni,
  messaggioNegaPoderi,
  preparaTurnoOnboarding,
  unisciDati,
} from '../../landing/src/lib/tony-aiuto-account.js';
import {
  costruisciSessioneIntervista,
  leggiSessioneIntervista,
  salvaSessioneIntervista,
} from '../../landing/src/lib/tony-sessione-intervista.js';

const require = createRequire(import.meta.url);
const {
  applicaNomeTerrenoDaDomanda,
  promptSistemaAccount,
  testoSeMancaNomeTerreno,
} = require('../../functions/lib/tony-landing-account.js');

const SEDE = { indirizzo: 'Via Celle', citta: 'Faenza', cap: null, provincia: null };

function storageFinto() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

describe('nome terreno: varietà e ettari non sono il nome', () => {
  it('«ho 3 Ha di trebbiano» non è un nome esplicito', () => {
    expect(interpretaFraseTerreni('ho 3 Ha di trebbiano')).toEqual([
      { nome: null, varieta: 'trebbiano', superficie: 3 },
    ]);
    const terreni = correggiTerreniEstratti(
      'ho 3 Ha di trebbiano',
      [{ nome: 'Trebbiano', superficie: 3, coltura: 'Vite da Vino', podere: null }],
      []
    );
    expect(terreni[0].nome).toBeNull();
    expect(terreni[0].superficie).toBe(3);
    expect(terreni[0].coltura).toBe('Vite da Vino');
  });

  it('«3 ha Trebbiano» non è un nome esplicito', () => {
    const terreni = correggiTerreniEstratti(
      '3 ha Trebbiano',
      [{ nome: 'Trebbiano', superficie: 3, coltura: null }],
      []
    );
    expect(terreni[0].nome).toBeNull();
    expect(terreni[0].superficie).toBe(3);
    expect(terreni[0].coltura).toBe('Trebbiano');
  });

  it('nome già esplicito: non lo scarta e non richiede di nuovo', () => {
    const frase = 'il terreno si chiama Vigna Alta, ho 3 ha di trebbiano';
    const terreni = correggiTerreniEstratti(
      frase,
      [{ nome: 'Trebbiano', superficie: 3, coltura: 'Vite da Vino' }],
      []
    );
    expect(terreni[0].nome).toBe('Vigna Alta');
    expect(terreni[0].superficie).toBe(3);
    const turno = preparaTurnoOnboarding({
      domanda: frase,
      passo: 'terreni',
      datiAttuali: {
        sede: SEDE,
        poderi: [{ nome: 'Casetti' }],
        terreni: [],
        senzaPoderi: true,
      },
      datiNuovi: {
        terreni: [{ nome: 'Trebbiano', superficie: 3, coltura: 'Vite da Vino' }],
        fatto: true,
      },
      testo: 'Come si chiama il terreno Trebbiano?',
    });
    expect(turno.dati.dati.terreni[0].nome).toBe('Vigna Alta');
    expect(turno.dati.dati.terreni[0].coltura).toBe('Vite da Vino');
    expect(turno.testo || '').not.toMatch(/come si chiama/i);
    expect(turno.bloccaAvanti).toBe(false);
  });

  it('più terreni: chiede il nome solo dove manca', () => {
    const frase = 'Vigna Alta: 3 ha di trebbiano e 2 ha di sangiovese';
    const turno = preparaTurnoOnboarding({
      domanda: frase,
      passo: 'terreni',
      datiAttuali: {
        sede: SEDE,
        poderi: [{ nome: 'Casetti' }],
        terreni: [],
      },
      datiNuovi: {
        terreni: [
          { nome: 'Trebbiano', superficie: 3, coltura: 'Vite da Vino' },
          { nome: 'Sangiovese', superficie: 2, coltura: 'Vite da Vino' },
        ],
      },
      testo: 'Ho segnato Trebbiano e Sangiovese.',
    });
    const nomi = turno.dati.dati.terreni.map((t) => t.nome);
    expect(nomi).toContain('Vigna Alta');
    expect(nomi).not.toContain('Sangiovese');
    expect(turno.testo).toMatch(/Come si chiama/);
    expect(turno.testo).toMatch(/sangiovese/i);
    expect(turno.testo).not.toMatch(/Vigna Alta/);
    expect(turno.dati.dati.terreni.find((t) => t.superficie === 2).superficie).toBe(2);
  });

  it('la risposta successiva riempie il nome e tiene ettari e coltura', () => {
    const prima = preparaTurnoOnboarding({
      domanda: 'ho 3 Ha di trebbiano',
      passo: 'terreni',
      datiAttuali: { sede: SEDE, poderi: [{ nome: 'Casetti' }], terreni: [] },
      datiNuovi: {
        terreni: [{ nome: 'Trebbiano', superficie: 3, coltura: 'Vite da Vino' }],
      },
      testo: 'Terreno Trebbiano registrato.',
    });
    expect(prima.dati.dati.terreni[0].nome).toBeFalsy();
    expect(prima.testo).toMatch(/Come si chiama il terreno da 3 ettari di trebbiano/i);
    const dopo = preparaTurnoOnboarding({
      domanda: 'Vigna del rio',
      passo: 'terreni',
      datiAttuali: prima.dati.dati,
      datiNuovi: { terreni: [{ nome: 'Trebbiano', superficie: 3, coltura: 'Vite da Vino' }] },
      testo: 'Ok.',
    });
    expect(dopo.dati.dati.terreni).toHaveLength(1);
    expect(dopo.dati.dati.terreni[0].nome).toBe('Vigna del rio');
    expect(dopo.dati.dati.terreni[0].superficie).toBe(3);
    expect(dopo.dati.dati.terreni[0].coltura).toBe('Vite da Vino');
    expect(dopo.bloccaAvanti).toBe(false);
  });
});

describe('poderi facoltativi', () => {
  it('dopo la sede, gli ettari non saltano la domanda', () => {
    const turno = preparaTurnoOnboarding({
      domanda: 'ho 3 Ha di trebbiano',
      passo: 'sede',
      datiAttuali: { sede: SEDE, poderi: [], terreni: [] },
      datiNuovi: {
        terreni: [{ nome: 'Trebbiano', superficie: 3, coltura: 'Vite da Vino' }],
        fatto: true,
      },
      testo: 'Ho segnato il terreno Trebbiano.',
    });
    expect(turno.passo).toBe('poderi');
    expect(turno.bloccaAvanti).toBe(true);
    expect(turno.testo).toBe(
      'Tengo il terreno da 3 ettari di trebbiano. ' + DOMANDA_PODERI
    );
    expect(turno.dati.dati.terreni[0].nome).toBeFalsy();
    expect(turno.dati.dati.terreni[0].superficie).toBe(3);
    expect(turno.dati.dati.sede.citta).toBe('Faenza');
  });

  it('un no non inventa poderi e poi chiede il nome', () => {
    expect(messaggioNegaPoderi('no', 'poderi')).toBe(true);
    expect(messaggioNegaPoderi('no', 'terreni')).toBe(false);
    const turno = preparaTurnoOnboarding({
      domanda: 'non ho poderi',
      passo: 'poderi',
      datiAttuali: {
        sede: SEDE,
        poderi: [],
        terreni: [{ nome: '', superficie: 3, coltura: 'Vite da Vino' }],
      },
      datiNuovi: { poderi: [], terreni: [], fatto: true },
      testo: 'Allora il terreno si chiama Trebbiano.',
    });
    expect(turno.dati.dati.poderi).toEqual([]);
    expect(turno.dati.dati.senzaPoderi).toBe(true);
    expect(turno.passo).toBe('terreni');
    expect(turno.testo).toMatch(/senza poderi/i);
    expect(turno.testo).toMatch(/Come si chiama/);
    expect(turno.dati.dati.terreni[0].superficie).toBe(3);
  });

  it('«sì» con un nome e ripetizione spontanea non duplicano', () => {
    const primo = unisciDati(
      { sede: SEDE, poderi: [], terreni: [] },
      { poderi: [{ nome: 'Podere Casetti' }] },
      'poderi'
    );
    expect(primo.dati.poderi.map((p) => p.nome)).toEqual(['Podere Casetti']);
    const spontaneo = unisciDati(
      primo.dati,
      { poderi: [{ nome: 'Casetti' }] },
      'terreni'
    );
    expect(spontaneo.dati.poderi).toHaveLength(1);
    expect(spontaneo.dati.poderi[0].nome).toBe('Podere Casetti');
    const associato = unisciDati(
      spontaneo.dati,
      {
        terreni: [{ nome: 'Vigna Alta', superficie: 3, coltura: 'Vite da Vino', podere: null }],
      },
      'terreni'
    );
    expect(associato.dati.terreni[0].podere).toBe('Podere Casetti');
    expect(
      allineaPassoAiuto('terreni', associato.dati, { poderi: [{ nome: 'Casetti' }] }, 'ho un podere')
    ).toBe('terreni');
  });

  it('«No, solo quello» con un podere passa ai terreni', () => {
    expect(
      allineaPassoAiuto(
        'poderi',
        { sede: SEDE, poderi: [{ nome: 'Nord' }], terreni: [] },
        {},
        'No, solo quello'
      )
    ).toBe('terreni');
  });
});

describe('indirizzo correggibile e dati tenuti', () => {
  it('il civico aggiorna la via e non cancella il comune', () => {
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

  it('il terreno senza nome sopravvive al salvataggio della chat', () => {
    const st = storageFinto();
    const dati = {
      sede: SEDE,
      poderi: [],
      terreni: [{ nome: '', superficie: 3, coltura: 'Vite da Vino', podere: null }],
      senzaPoderi: true,
    };
    salvaSessioneIntervista(st, {
      faseAiuto: true,
      aiutoFatto: false,
      messaggi: [{ ruolo: 'tony', testo: 'Come si chiama?' }],
      storia: [],
      datiAiuto: dati,
      passoAiuto: 'terreni',
      schedaAperta: false,
    });
    const rec = leggiSessioneIntervista(st, Date.now());
    expect(rec.datiAiuto.terreni[0].superficie).toBe(3);
    expect(rec.datiAiuto.terreni[0].coltura).toBe('Vite da Vino');
    expect(rec.datiAiuto.terreni[0].nome).toBe('');
    expect(rec.datiAiuto.sede.citta).toBe('Faenza');
    expect(rec.datiAiuto.senzaPoderi).toBe(true);
    expect(costruisciSessioneIntervista({ password: 'x' }, 1)).not.toHaveProperty('password');
  });
});

describe('stessa regola sul server, senza deploy in questo turno', () => {
  it('annulla Trebbiano come nome e chiede il nome', () => {
    const dati = applicaNomeTerrenoDaDomanda('ho 3 Ha di trebbiano', {
      terreni: [{ nome: 'Trebbiano', superficie: 3, coltura: 'Vite da Vino' }],
    });
    expect(dati.terreni[0].nome).toBeNull();
    expect(dati.terreni[0].superficie).toBe(3);
    expect(dati.terreni[0].coltura).toBe('Vite da Vino');
    expect(testoSeMancaNomeTerreno('Fatto.', dati)).toMatch(/Come si chiama/);
    expect(testoSeMancaNomeTerreno('Fatto.', dati)).toMatch(/trebbiano|Vite da Vino/i);
  });

  it('un nome esplicito resta', () => {
    const dati = applicaNomeTerrenoDaDomanda('si chiama Vigna Alta, 3 ha di trebbiano', {
      terreni: [{ nome: 'Vigna Alta', superficie: 3, coltura: 'Vite da Vino' }],
    });
    expect(dati.terreni[0].nome).toBe('Vigna Alta');
    expect(dati.nomeTerrenoMancante).toBeUndefined();
  });

  it('il prompt distingue nome e poderi facoltativi', () => {
    const prompt = promptSistemaAccount('poderi', { raccolti: '' });
    expect(prompt).toMatch(/non è la coltura/i);
    expect(prompt).toMatch(/facoltativ/i);
    expect(prompt).toMatch(/non inventa poderi/i);
  });
});
