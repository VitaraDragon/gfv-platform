/**
 * Percorso reale dell'onboarding: JSON del modello → pulizia della function
 * → turno della chat. Non un helper con il nome già uguale alla varietà.
 * Sequenza detta da Pier il 2026-11-08, ripetuta da stato pulito.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  preparaTurnoOnboarding,
  serializzaRaccolti,
} from '../../landing/src/lib/tony-aiuto-account.js';
import {
  leggiSessioneIntervista,
  salvaSessioneIntervista,
} from '../../landing/src/lib/tony-sessione-intervista.js';

const require = createRequire(import.meta.url);
const {
  applicaNomeTerrenoDaDomanda,
  applicaSuperficieDaDomanda,
  rispostaAccountDaTesto,
  testoSeMancaNomeTerreno,
} = require('../../functions/lib/tony-landing-account.js');

function storageFinto() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

/**
 * Stesso ordine di tony-landing-ask (risposta, superficie, nome, testo)
 * e di TonyChat (preparaTurnoOnboarding sul payload done).
 */
function turnoRuntime(stato, domanda, modello) {
  const raccolti = serializzaRaccolti(stato.dati);
  let pulita = rispostaAccountDaTesto(JSON.stringify(modello), {
    raccolti,
    argomento: stato.passo,
  });
  pulita.dati = applicaSuperficieDaDomanda(domanda, pulita.dati);
  pulita.dati = applicaNomeTerrenoDaDomanda(domanda, pulita.dati);
  pulita.testo = testoSeMancaNomeTerreno(pulita.testo, pulita.dati);
  if (pulita.dati && pulita.dati.nomeTerrenoMancante != null) {
    delete pulita.dati.nomeTerrenoMancante;
  }
  const client = preparaTurnoOnboarding({
    domanda,
    passo: stato.passo,
    datiAttuali: stato.dati,
    datiNuovi: pulita.dati,
    testo: pulita.testo,
  });
  stato.dati = client.dati.dati;
  stato.passo = client.passo || stato.passo;
  return {
    testo: client.testo || pulita.testo,
    bloccaAvanti: client.bloccaAvanti,
    passo: stato.passo,
    poderi: (stato.dati.poderi || []).map((p) => p.nome),
    terreni: stato.dati.terreni || [],
  };
}

function statoPulito() {
  return { passo: 'sede', dati: { sede: null, poderi: [], terreni: [] } };
}

const CONFERMA = 'Ok, ho un terreno. Ne hai altri o vediamo il riepilogo?';

function nomeModello(modo, varieta) {
  if (modo === 'nullo') return null;
  if (modo === 'varieta') return varieta;
  return 'Appezzamento ' + varieta;
}

function sequenzaPier(modo) {
  const stato = statoPulito();
  const visti = [];
  visti.push(
    turnoRuntime(stato, 'lugo via paurosa 145', {
      testo: 'Ok, ho la sede. Ora dimmi i nomi dei tuoi poderi.',
      sede: { indirizzo: 'via paurosa 145', citta: 'Lugo', cap: null, provincia: 'RA' },
      poderi: [],
      terreni: [],
      fatto: false,
    })
  );
  visti.push(
    turnoRuntime(stato, 'colombaia', {
      testo:
        'Ok, ho un podere. Ora dimmi i nomi dei tuoi terreni, la superficie in ettari e la coltura. Ne hai zero su 5.',
      poderi: [{ nome: 'colombaia' }],
      terreni: [],
      fatto: false,
    })
  );
  const frasi = [
    ['ho 3 ha di trebbiano', CONFERMA, 3, 'Vite da Vino', 'Trebbiano'],
    ['4 ha di peschi', CONFERMA, 4, 'Pesco', 'Peschi'],
    [
      '12 di seminativo',
      'Che cosa ci coltivi nel terreno di 12 ettari? Grano, mais, orzo…',
      12,
      null,
      'Seminativo',
    ],
    ['mais', CONFERMA, 12, 'Mais', 'Mais'],
    ['7 di vite', CONFERMA, 7, 'Vite da Vino', 'Vite'],
    [
      '6 di meloni',
      "Con l'account gratuito arrivi a 5 terreni. Gli altri li aggiungi passando al Base, quando vuoi.",
      6,
      'Meloni',
      'Meloni',
    ],
  ];
  for (const [domanda, testo, superficie, coltura, varieta] of frasi) {
    visti.push(
      turnoRuntime(stato, domanda, {
        testo,
        poderi: [],
        terreni: [
          {
            nome: nomeModello(modo, varieta),
            superficie,
            coltura,
            podere: 'colombaia',
          },
        ],
        fatto: true,
      })
    );
  }
  return { stato, visti };
}

describe('runtime: nome terreno nella sequenza di Pier', () => {
  for (const modo of ['nullo', 'inventato', 'varieta']) {
    it('due volte da zero, modello ' + modo + ', chiede il nome e tiene i dati', () => {
      for (let giro = 0; giro < 2; giro++) {
        const { stato, visti } = sequenzaPier(modo);
        expect(visti[0].testo).toMatch(/poderi/i);
        expect(visti[0].testo).not.toMatch(/come si chiama/i);
        expect(visti[1].poderi).toEqual(['colombaia']);
        expect(visti[2].testo).toMatch(/Come si chiama il terreno da 3 ettari di trebbiano/i);
        expect(visti[2].bloccaAvanti).toBe(true);
        expect(visti[2].terreni).toHaveLength(1);
        expect(visti[2].terreni[0].superficie).toBe(3);
        expect(visti[2].terreni[0].nome).toBeFalsy();
        expect(visti[3].testo).toMatch(/come si chiama/i);
        expect(visti[3].testo).not.toMatch(/^Ok, ho un terreno/i);
        expect(visti[4].testo).toMatch(/Che cosa ci coltivi/);
        expect(visti[4].testo).not.toMatch(/come si chiama/i);
        expect(visti[4].terreni.filter((t) => t.superficie === 12)).toHaveLength(1);
        expect(visti[4].terreni.find((t) => t.superficie === 12).coltura).toBeFalsy();
        expect(visti[5].testo).toMatch(/come si chiama/i);
        expect(visti[5].testo).toMatch(/12 ettari di Mais/i);
        expect(visti[5].testo).not.toMatch(/Ok, ho un terreno/);
        expect(visti[5].terreni.filter((t) => t.superficie === 12)).toHaveLength(1);
        expect(visti[5].terreni.find((t) => t.superficie === 12).coltura).toBe('Mais');
        expect(visti[6].testo).toMatch(/come si chiama/i);
        expect(visti[7].testo).toMatch(/come si chiama/i);
        expect(visti[7].testo).not.toMatch(/account gratuito/i);
        expect(stato.dati.terreni).toHaveLength(5);
        expect(stato.dati.poderi.map((p) => p.nome)).toEqual(['colombaia']);
        expect(stato.dati.terreni.map((t) => t.superficie)).toEqual([3, 4, 12, 7, 6]);
        expect(stato.dati.terreni.every((t) => !t.nome)).toBe(true);
        expect(stato.dati.terreni.every((t) => t.podere === 'colombaia')).toBe(true);
        expect(stato.dati.sede.citta).toBe('Lugo');
      }
    });
  }

  it('il nome detto dopo la domanda non duplica ettari, coltura e podere', () => {
    const stato = statoPulito();
    turnoRuntime(stato, 'lugo via paurosa 145', {
      testo: 'Ok, ho la sede.',
      sede: { indirizzo: 'via paurosa 145', citta: 'Lugo' },
      poderi: [],
      terreni: [],
      fatto: false,
    });
    turnoRuntime(stato, 'colombaia', {
      testo: 'Ok, ho un podere.',
      poderi: [{ nome: 'colombaia' }],
      terreni: [],
      fatto: false,
    });
    const chiesto = turnoRuntime(stato, 'ho 3 ha di trebbiano', {
      testo: CONFERMA,
      terreni: [{ nome: 'Appezzamento', superficie: 3, coltura: 'Vite da Vino', podere: 'colombaia' }],
      fatto: true,
    });
    expect(chiesto.testo).toMatch(/Come si chiama/);
    const nominato = turnoRuntime(stato, 'Vigna del rio', {
      testo: 'Ok, ho un terreno.',
      terreni: [{ nome: 'Trebbiano', superficie: 3, coltura: 'Vite da Vino', podere: 'colombaia' }],
      fatto: true,
    });
    expect(nominato.terreni).toHaveLength(1);
    expect(nominato.terreni[0].nome).toBe('Vigna del rio');
    expect(nominato.terreni[0].superficie).toBe(3);
    expect(nominato.terreni[0].coltura).toBe('Vite da Vino');
    expect(nominato.terreni[0].podere).toBe('colombaia');
    expect(nominato.testo || '').not.toMatch(/come si chiama/i);
    expect(nominato.poderi).toEqual(['colombaia']);
  });

  it('nome già esplicito: non lo scarta e non lo richiede', () => {
    const stato = statoPulito();
    turnoRuntime(stato, 'lugo via paurosa 145', {
      testo: 'Ok, ho la sede.',
      sede: { indirizzo: 'via paurosa 145', citta: 'Lugo' },
      poderi: [],
      terreni: [],
      fatto: false,
    });
    turnoRuntime(stato, 'colombaia', {
      testo: 'Ok, ho un podere.',
      poderi: [{ nome: 'colombaia' }],
      terreni: [],
      fatto: false,
    });
    const frase = 'il terreno si chiama Vigna Alta, ho 3 ha di trebbiano';
    const esito = turnoRuntime(stato, frase, {
      testo: 'Come si chiama il terreno Trebbiano?',
      terreni: [{ nome: 'Trebbiano', superficie: 3, coltura: 'Vite da Vino', podere: 'colombaia' }],
      fatto: true,
    });
    expect(esito.terreni).toHaveLength(1);
    expect(esito.terreni[0].nome).toBe('Vigna Alta');
    expect(esito.terreni[0].superficie).toBe(3);
    expect(esito.terreni[0].coltura).toBe('Vite da Vino');
    expect(esito.terreni[0].podere).toBe('colombaia');
    expect(esito.testo).not.toMatch(/come si chiama/i);
    expect(esito.bloccaAvanti).toBe(false);
    expect(esito.poderi).toEqual(['colombaia']);
  });

  it('la sessione tiene il terreno senza nome e il podere, poi il turno successivo', () => {
    const stato = statoPulito();
    turnoRuntime(stato, 'lugo via paurosa 145', {
      testo: 'Ok, ho la sede.',
      sede: { indirizzo: 'via paurosa 145', citta: 'Lugo' },
      poderi: [],
      terreni: [],
      fatto: false,
    });
    turnoRuntime(stato, 'colombaia', {
      testo: 'Ok, ho un podere.',
      poderi: [{ nome: 'colombaia' }],
      terreni: [],
      fatto: false,
    });
    turnoRuntime(stato, 'ho 3 ha di trebbiano', {
      testo: CONFERMA,
      terreni: [{ nome: null, superficie: 3, coltura: 'Vite da Vino', podere: 'colombaia' }],
      fatto: false,
    });
    const storage = storageFinto();
    expect(
      salvaSessioneIntervista(storage, {
        faseAiuto: true,
        aiutoFatto: false,
        messaggi: [{ ruolo: 'tony', testo: 'Come si chiama?' }],
        storia: [],
        datiAiuto: stato.dati,
        passoAiuto: stato.passo,
        schedaAperta: false,
      })
    ).toBe(true);
    const letto = leggiSessioneIntervista(storage, Date.now());
    expect(letto.datiAiuto.poderi.map((p) => p.nome)).toEqual(['colombaia']);
    expect(letto.datiAiuto.terreni).toHaveLength(1);
    expect(letto.datiAiuto.terreni[0].nome).toBeFalsy();
    expect(letto.datiAiuto.terreni[0].superficie).toBe(3);
    const dopo = {
      passo: letto.passoAiuto,
      dati: letto.datiAiuto,
    };
    const nome = turnoRuntime(dopo, 'Vigna del rio', {
      testo: 'Ok.',
      terreni: [{ nome: 'Trebbiano', superficie: 3, coltura: 'Vite da Vino' }],
      fatto: false,
    });
    expect(nome.terreni).toHaveLength(1);
    expect(nome.terreni[0].nome).toBe('Vigna del rio');
    expect(nome.terreni[0].superficie).toBe(3);
    expect(nome.poderi).toEqual(['colombaia']);
  });
});
