/**
 * Percorso reale dell'onboarding: JSON del modello → pulizia della function
 * → turno della chat. Non un helper con il nome già uguale alla varietà.
 * Sequenza detta da Pier il 2026-11-08, ripetuta da stato pulito.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  aprireSchedaPerFatto,
  decidiDopoRisposta,
  erroriNomeTerreniForm,
  fraseTerrenoSenzaRiepilogo,
  interpretaFraseTerreni,
  normalizzaColturaCatalogo,
  payloadDaScheda,
  preparaTurnoOnboarding,
  prossimoPasso,
  righeRiepilogo,
  serializzaRaccolti,
  sembraIndirizzo,
  utenteChiedeRiepilogo,
} from '../../landing/src/lib/tony-aiuto-account.js';
import { azionePerEsito, MESSAGGI_CHAT } from '../../landing/src/lib/tony-chat-logica.js';
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
  const grezzo = typeof modello === 'string' ? modello : JSON.stringify(modello);
  let pulita = rispostaAccountDaTesto(grezzo, {
    raccolti,
    argomento: stato.passo,
    domanda,
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
    troppi: client.dati.troppiTerreni === true,
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

const ORA = 1_700_000_000_000;

function nomeTrebbiano(modo) {
  if (modo === 'nullo') return null;
  if (modo === 'stringa') return 'null';
  return 'Appezzamento inventato';
}

function ripristina(stato) {
  const storage = storageFinto();
  expect(
    salvaSessioneIntervista(
      storage,
      {
        faseAiuto: true,
        aiutoFatto: false,
        messaggi: [{ ruolo: 'tony', testo: 'Come si chiama questo terreno?' }],
        storia: [],
        datiAiuto: stato.dati,
        passoAiuto: 'terreni',
        schedaAperta: false,
      },
      ORA
    )
  ).toBe(true);
  const letto = leggiSessioneIntervista(storage, ORA);
  return { passo: letto.passoAiuto, dati: letto.datiAiuto };
}

/**
 * Dialogo di Pier: Brisighella, podere Casetti, quattro terreni.
 * Al nome «collina» il modello rimanda anche la riga sentinella da 3 ha.
 */
function sequenzaCasetti(modo) {
  const stato = statoPulito();
  const turni = [
    [
      'brisighella via firenze 658',
      {
        testo: 'Ok, ho la sede. Ora i poderi.',
        sede: { indirizzo: 'via Firenze 658', citta: 'Brisighella', cap: null, provincia: null },
        poderi: [],
        terreni: [],
        fatto: false,
      },
    ],
    [
      'casetti',
      {
        testo: 'Ok, ho il podere Casetti.',
        poderi: [{ nome: 'Casetti' }],
        terreni: [],
        fatto: false,
      },
    ],
    [
      'quercione 4 ha di sangiovese',
      {
        testo: 'Ok, Quercione 4 ha.',
        terreni: [
          { nome: 'Quercione', superficie: 4, coltura: 'Sangiovese', podere: 'Casetti' },
        ],
        fatto: false,
      },
    ],
    [
      '7 ha di grano e si chiama pozzo',
      {
        testo: 'Ok, Pozzo. Ne hai 2 su 5.',
        terreni: [{ nome: 'Pozzo', superficie: 7, coltura: 'Grano', podere: 'Casetti' }],
        fatto: false,
      },
    ],
    [
      '35 ha di mais e si chiama seminativo',
      {
        testo: 'Ok, Seminativo. Ne hai 3 su 5.',
        terreni: [{ nome: 'Seminativo', superficie: 35, coltura: 'Mais', podere: 'Casetti' }],
        fatto: false,
      },
    ],
    [
      'ho 3 ha di trebbiano',
      {
        testo:
          'Ok, hai un terreno di 3 ettari di Vite da Vino. Come si chiama questo terreno? Ne hai quattro su 5.',
        terreni: [
          {
            nome: nomeTrebbiano(modo),
            superficie: 3,
            coltura: 'Vite da Vino',
            podere: 'Casetti',
          },
        ],
        fatto: false,
      },
    ],
  ];
  const visti = turni.map(([domanda, modello]) => turnoRuntime(stato, domanda, modello));
  const dopoTrebbiano = ripristina(stato);
  const collina = turnoRuntime(dopoTrebbiano, 'collina', {
    testo:
      'Ok, il terreno Collina ha 3 ettari di Vite da Vino. Ne hai altri o vediamo il riepilogo? Ne hai cinque su 5.',
    terreni: [
      {
        nome: nomeTrebbiano(modo),
        superficie: 3,
        coltura: 'Vite da Vino',
        podere: 'Casetti',
      },
      { nome: 'Collina', superficie: 3, coltura: 'Vite da Vino', podere: 'Casetti' },
    ],
    fatto: false,
  });
  const dopoNome = ripristina(dopoTrebbiano);
  return { visti, collina, dopoNome };
}

describe('runtime: collina non duplica il 3 ha con nome null', () => {
  for (const modo of ['nullo', 'stringa', 'inventato']) {
    it('due volte da zero, JSON ' + modo + ', quattro terreni e niente sentinella', () => {
      for (let giro = 0; giro < 2; giro++) {
        const { visti, collina, dopoNome } = sequenzaCasetti(modo);
        expect(visti[2].terreni.map((t) => t.nome)).toEqual(['Quercione']);
        expect(visti[2].terreni[0].superficie).toBe(4);
        expect(visti[2].terreni[0].coltura).toMatch(/^sangiovese$/i);
        expect(visti[3].terreni.map((t) => t.nome)).toEqual(['Quercione', 'Pozzo']);
        expect(visti[3].terreni[1].coltura).toBe('Grano');
        expect(visti[4].terreni.map((t) => t.nome)).toEqual(['Quercione', 'Pozzo', 'Seminativo']);
        expect(visti[4].terreni[2].superficie).toBe(35);
        expect(visti[4].terreni[2].coltura).toBe('Mais');
        expect(visti[5].terreni).toHaveLength(4);
        expect(visti[5].terreni.find((t) => t.superficie === 3).nome).toBeFalsy();
        expect(visti[5].testo).toMatch(/Come si chiama il terreno da 3 ettari/i);
        expect(visti[5].bloccaAvanti).toBe(true);
        expect(visti[5].terreni.every((t) => t.podere === 'Casetti')).toBe(true);

        expect(collina.terreni).toHaveLength(4);
        expect(collina.troppi).toBe(false);
        expect(collina.testo).toMatch(/ne hai 4 su 5/i);
        expect(collina.testo).not.toMatch(/cinque su 5/i);
        const treHa = collina.terreni.filter((t) => t.superficie === 3);
        expect(treHa).toHaveLength(1);
        expect(treHa[0].nome).toBe('Collina');
        expect(treHa[0].coltura).toBe('Vite da Vino');
        expect(treHa[0].podere).toBe('Casetti');
        expect(collina.terreni.map((t) => t.nome)).toEqual([
          'Quercione',
          'Pozzo',
          'Seminativo',
          treHa[0].nome,
        ]);
        expect(collina.terreni.some((t) => /appezzamento inventato/i.test(String(t.nome || '')))).toBe(
          false
        );
        expect(collina.terreni.some((t) => /^null$/i.test(String(t.nome || '')))).toBe(false);

        const righe = righeRiepilogo(dopoNome.dati);
        expect(righe.terreni).toHaveLength(4);
        expect(righe.terreni.map((t) => t.nome)).toEqual([
          'Quercione',
          'Pozzo',
          'Seminativo',
          treHa[0].nome,
        ]);
        expect(righe.terreni.map((t) => t.superficie)).toEqual(['4', '7', '35', '3']);
        expect(righe.terreni.map((t) => t.coltura)).toEqual([
          visti[2].terreni[0].coltura,
          'Grano',
          'Mais',
          'Vite da Vino',
        ]);
        expect(righe.terreni.every((t) => t.podere === 'Casetti')).toBe(true);
        expect(righe.terreni.some((t) => /null/i.test(t.nome))).toBe(false);
        const payload = payloadDaScheda(
          { sede: righe.sede, poderi: righe.poderi, terreni: righe.terreni },
          'req-casetti'
        );
        expect(payload.terreni).toHaveLength(4);
        expect(payload.terreni.map((t) => t.nome)).toEqual([
          'Quercione',
          'Pozzo',
          'Seminativo',
          treHa[0].nome,
        ]);
        expect(payload.terreni.find((t) => t.nome === treHa[0].nome).superficie).toBe(3);
        expect(payload.terreni.some((t) => /null/i.test(t.nome))).toBe(false);
        expect(serializzaRaccolti(dopoNome.dati)).toMatch(/4 di 5/);
        expect(serializzaRaccolti(dopoNome.dati)).not.toMatch(/«null»/i);

        const quinto = turnoRuntime(dopoNome, 'oliveto 2 ha di olivo', {
          testo: 'Ok. Ne hai 4 su 5.',
          terreni: [{ nome: 'Oliveto', superficie: 2, coltura: 'Olivo', podere: 'Casetti' }],
          fatto: false,
        });
        expect(quinto.terreni).toHaveLength(5);
        expect(quinto.troppi).toBe(false);
        expect(quinto.terreni.map((t) => t.nome)).toContain('Oliveto');
        const sesto = turnoRuntime(dopoNome, '1 ha di orzo', {
          testo: 'Ok. Ne hai 6 su 5.',
          terreni: [{ nome: 'Orzo', superficie: 1, coltura: 'Orzo', podere: 'Casetti' }],
          fatto: false,
        });
        expect(sesto.terreni).toHaveLength(5);
        expect(sesto.troppi).toBe(true);
        expect(sesto.terreni.some((t) => t.superficie === 1)).toBe(false);
        expect(sesto.testo).toMatch(/ne hai 5 su 5/i);
      }
    });
  }

  it('la scheda e il payload rifiutano la stringa null anche se la sessione era già sporca', () => {
    const storage = storageFinto();
    salvaSessioneIntervista(
      storage,
      {
        faseAiuto: true,
        aiutoFatto: false,
        messaggi: [{ ruolo: 'tony', testo: 'Riepilogo' }],
        storia: [],
        datiAiuto: {
          sede: { indirizzo: 'via Firenze 658', citta: 'Brisighella' },
          poderi: [{ nome: 'Casetti' }],
          terreni: [
            { nome: 'Quercione', superficie: 4, coltura: 'Sangiovese', podere: 'Casetti' },
            { nome: 'Pozzo', superficie: 7, coltura: 'Grano', podere: 'Casetti' },
            { nome: 'Seminativo', superficie: 35, coltura: 'Mais', podere: 'Casetti' },
            { nome: 'null', superficie: 3, coltura: 'Vite da Vino', podere: 'Casetti' },
            { nome: 'Collina', superficie: 3, coltura: 'Vite da Vino', podere: 'Casetti' },
          ],
        },
        passoAiuto: 'scheda',
        schedaAperta: true,
      },
      ORA
    );
    const letto = leggiSessioneIntervista(storage, ORA);
    expect(letto.datiAiuto.terreni).toHaveLength(4);
    expect(letto.datiAiuto.terreni.some((t) => /null/i.test(String(t.nome || '')))).toBe(false);
    const righe = righeRiepilogo(letto.datiAiuto);
    expect(righe.terreni.map((t) => t.nome)).toEqual([
      'Quercione',
      'Pozzo',
      'Seminativo',
      'Collina',
    ]);
    const payload = payloadDaScheda(righe, 'req-sporca');
    expect(payload.terreni).toHaveLength(4);
    expect(payload.terreni.some((t) => /null/i.test(t.nome))).toBe(false);
    expect(erroriNomeTerreniForm([{ nome: 'null', superficie: '3', coltura: 'Vite da Vino' }])).toEqual([
      { campo: 'terreni[0].nome', errore: 'Scrivi il nome del terreno' },
    ]);
    expect(erroriNomeTerreniForm([{ nome: 'Seminativo', superficie: '35', coltura: 'Mais' }])).toEqual(
      []
    );
    expect(payloadDaScheda({ terreni: [{ nome: 'NULL', superficie: '3', coltura: 'Vite da Vino' }] }, 'x').terreni).toEqual([]);
    const src = fs.readFileSync(
      path.join(path.resolve(import.meta.dirname, '../..'), 'landing/src/components/TonySchedaConferma.vue'),
      'utf8'
    );
    expect(src).toContain('righeRiepilogo');
    expect(src).toContain('erroriNomeTerreniForm');
  });
});

const CAP =
  "Con l'account gratuito arrivi a cinque terreni. Gli altri li aggiungi passando al Base, quando vuoi.";

function terrenoModello(nome, superficie, coltura) {
  return { nome, superficie, coltura, podere: 'Barbona' };
}

/**
 * Dialogo di Pier dopo il rilascio 360. Il modello può rispondere bene,
 * rimandare la lista senza il quarto, mandare JSON rotto sul «4ha» compatto,
 * o salvare anche la coltura come secondo terreno.
 */
function dialogoCancello(modo) {
  const stato = statoPulito();
  const visti = [];
  visti.push(
    turnoRuntime(stato, 'cotignola via nuova 105', {
      testo: 'Ok, Cotignola, via Nuova 105. Ora dimmi il nome del tuo primo podere.',
      sede: { indirizzo: 'via Nuova 105', citta: 'Cotignola' },
      poderi: [],
      terreni: [],
      fatto: false,
    })
  );
  visti.push(
    turnoRuntime(stato, 'barbona', {
      testo: 'Ok, Barbona. Ora dimmi il nome del tuo primo terreno, la sua superficie in ettari e la coltura.',
      poderi: [{ nome: 'Barbona' }],
      terreni: [],
      fatto: false,
    })
  );

  const noti = () =>
    (stato.dati.terreni || []).map((t) =>
      terrenoModello(t.nome, t.superficie, t.coltura)
    );

  const primoRotto = modo === 'json-rotto';
  const primoFantasma = modo === 'fantasma';
  visti.push(
    turnoRuntime(
      stato,
      'laghetto 4ha grano',
      primoRotto
        ? 'non è json'
        : primoFantasma
          ? {
              testo: '',
              terreni: [
                terrenoModello('Laghetto', 4, 'Grano'),
                terrenoModello('grano', 4, 'Grano'),
              ],
              fatto: false,
            }
          : {
              testo: 'Ok, un terreno Laghetto di 4 ettari a Grano. Ne hai altri o vediamo il riepilogo?',
              terreni: [terrenoModello('Laghetto', 4, 'Grano')],
              fatto: false,
            }
    )
  );
  visti.push(
    turnoRuntime(stato, 'si chiama laghetto...4 ha a grano', {
      testo: 'Ok, un terreno Laghetto di 4 ettari a Grano. Ne hai altri o vediamo il riepilogo?',
      terreni: [terrenoModello('Laghetto', 4, 'Grano')],
      fatto: false,
    })
  );
  visti.push(
    turnoRuntime(stato, 'lagone 12 ha pesco', {
      testo: 'Ok, un terreno Lagone di dodici ettari a Pesco. Ne hai altri o vediamo il riepilogo?',
      terreni:
        modo === 'cumulativo'
          ? noti().concat([terrenoModello('Lagone', 12, 'Pesco')])
          : [terrenoModello('Lagone', 12, 'Pesco')],
      fatto: false,
    })
  );
  visti.push(
    turnoRuntime(stato, 'ho 3 ha di trebbiano', {
      testo: 'Ok, un terreno di tre ettari a Vite da Vino. Come si chiama questo terreno?',
      terreni:
        modo === 'cumulativo'
          ? noti().concat([terrenoModello(null, 3, 'Vite da Vino')])
          : [terrenoModello(null, 3, 'Vite da Vino')],
      fatto: false,
    })
  );
  visti.push(
    turnoRuntime(stato, 'collina', {
      testo: 'Ok, un terreno Collina di tre ettari a Vite da Vino. Ne hai altri o vediamo il riepilogo?',
      terreni: [terrenoModello('Collina', 3, 'Vite da Vino')],
      fatto: false,
    })
  );
  const primaDelQuarto = (stato.dati.terreni || []).length;
  visti.push(
    turnoRuntime(
      stato,
      'cancello 4 ha pompelmi',
      modo === 'cumulativo'
        ? {
            testo: CAP,
            terreni: noti(),
            fatto: true,
          }
        : modo === 'omesso'
          ? {
              testo: CAP,
              terreni: noti().filter((t) => t.superficie !== 4),
              fatto: true,
            }
          : {
              testo: CAP,
              terreni: [],
              fatto: true,
            }
    )
  );
  return { stato, visti, primaDelQuarto };
}

function schedaAttesa(dati) {
  const righe = righeRiepilogo(dati);
  const payload = payloadDaScheda(righe, 'req-cancello');
  return { righe, payload };
}

describe('runtime: Cancello 4 ha pompelmi dopo il rilascio 360', () => {
  it('il compatto 4ha e la preposizione «a» si leggono, pompelmi non diventa Pompelmo', () => {
    expect(interpretaFraseTerreni('laghetto 4ha grano')).toEqual([
      { nome: 'laghetto', varieta: 'grano', superficie: 4 },
    ]);
    expect(interpretaFraseTerreni('si chiama laghetto...4 ha a grano')).toEqual([
      { nome: 'laghetto', varieta: 'grano', superficie: 4 },
    ]);
    expect(interpretaFraseTerreni('cancello 4 ha pompelmi')[0]).toMatchObject({
      nome: 'cancello',
      varieta: 'pompelmi',
      superficie: 4,
    });
    expect(normalizzaColturaCatalogo('pompelmi')).toBeNull();
    expect(normalizzaColturaCatalogo('Pompelmi')).toBeNull();
    expect(normalizzaColturaCatalogo('Pompelmo')).toBe('Pompelmo');
    expect(aprireSchedaPerFatto('cancello 4 ha pompelmi', true)).toBe(false);
    expect(aprireSchedaPerFatto('riepilogo', true)).toBe(true);
    const chat = fs.readFileSync(
      path.join(path.resolve(import.meta.dirname, '../..'), 'landing/src/components/TonyChat.vue'),
      'utf8'
    );
    expect(chat).toContain('utenteChiedeRiepilogo');
    expect(chat).not.toContain('esito.dati.fatto === true');
  });

  for (const modo of ['incrementale', 'cumulativo', 'omesso', 'json-rotto', 'fantasma']) {
    it('due giri puliti, modello ' + modo + ', quattro terreni e niente riepilogo', () => {
      for (let giro = 0; giro < 2; giro++) {
        const { stato, visti, primaDelQuarto } = dialogoCancello(modo);
        expect(visti[0].testo).toMatch(/podere/i);
        expect(stato.dati.sede.citta).toBe('Cotignola');
        expect(visti[1].poderi).toEqual(['Barbona']);
        expect(visti[2].terreni).toHaveLength(1);
        expect(visti[2].testo).not.toMatch(/Non ho capito bene/);
        expect(visti[2].testo).toMatch(/Laghetto/i);
        expect(visti[2].testo).toMatch(/Grano/);
        expect(visti[3].terreni).toHaveLength(1);
        expect(visti[3].terreni[0].nome).toMatch(/^laghetto$/i);
        expect(visti[3].terreni[0].superficie).toBe(4);
        expect(visti[3].terreni[0].coltura).toBe('Grano');
        expect(visti[4].terreni.map((t) => t.nome).join(' ')).toMatch(/lagone/i);
        expect(visti[5].terreni).toHaveLength(3);
        expect(visti[5].terreni.filter((t) => t.superficie === 3)).toHaveLength(1);
        expect(visti[5].testo).toMatch(/come si chiama/i);
        expect(visti[6].terreni).toHaveLength(3);
        expect(visti[6].terreni.find((t) => t.superficie === 3).nome).toMatch(/^collina$/i);
        expect(visti[6].terreni.find((t) => t.superficie === 3).coltura).toBe('Vite da Vino');
        expect(primaDelQuarto).toBe(3);
        expect(visti[7].troppi).toBe(false);
        expect(visti[7].testo).not.toMatch(/account gratuito/i);
        expect(visti[7].testo).not.toMatch(/Ecco la tua azienda/);
        expect(visti[7].terreni).toHaveLength(4);

        const nomi = visti[7].terreni.map((t) => String(t.nome || '').toLowerCase());
        expect(nomi.filter((n) => n === 'laghetto')).toHaveLength(1);
        expect(nomi).toEqual(expect.arrayContaining(['laghetto', 'lagone', 'collina', 'cancello']));
        const cancello = visti[7].terreni.find((t) => /^cancello$/i.test(t.nome));
        expect(cancello.superficie).toBe(4);
        expect(cancello.coltura).toMatch(/^pompelmi$/i);
        expect(cancello.coltura).not.toBe('Pompelmo');
        expect(cancello.coltura).not.toBe('Grano');
        expect(visti[7].terreni.find((t) => /^lagone$/i.test(t.nome)).superficie).toBe(12);
        expect(visti[7].terreni.find((t) => /^lagone$/i.test(t.nome)).coltura).toBe('Pesco');
        expect(visti[7].terreni.every((t) => t.podere === 'Barbona')).toBe(true);
        expect(stato.dati.poderi).toHaveLength(1);

        const storage = storageFinto();
        salvaSessioneIntervista(
          storage,
          {
            faseAiuto: true,
            aiutoFatto: false,
            messaggi: [{ ruolo: 'tony', testo: visti[7].testo }],
            storia: [],
            datiAiuto: stato.dati,
            passoAiuto: 'terreni',
            schedaAperta: false,
          },
          ORA + giro
        );
        const letto = leggiSessioneIntervista(storage, ORA + giro);
        expect(letto.datiAiuto.terreni).toHaveLength(4);
        const { righe, payload } = schedaAttesa(letto.datiAiuto);
        expect(righe.terreni).toHaveLength(4);
        expect(payload.terreni).toHaveLength(4);
        expect(payload.terreni.map((t) => t.nome.toLowerCase())).toEqual(
          expect.arrayContaining(['laghetto', 'lagone', 'collina', 'cancello'])
        );
        expect(payload.terreni.find((t) => /^cancello$/i.test(t.nome)).coltura).toMatch(/^pompelmi$/i);
        expect(serializzaRaccolti(letto.datiAiuto)).toMatch(/4 di 5/);
        expect(serializzaRaccolti(letto.datiAiuto)).toMatch(/Barbona/);
      }
    });
  }

  it('il quinto reale entra, il sesto no, e il quarto non apre il riepilogo', () => {
    const { stato } = dialogoCancello('cumulativo');
    expect(stato.dati.terreni).toHaveLength(4);
    const quinto = turnoRuntime(stato, 'oliveto 2 ha di olivo', {
      testo: CAP,
      terreni: [terrenoModello('Oliveto', 2, 'Olivo')],
      fatto: true,
    });
    expect(quinto.terreni).toHaveLength(5);
    expect(quinto.troppi).toBe(false);
    expect(quinto.testo).not.toMatch(/account gratuito/i);
    expect(aprireSchedaPerFatto('oliveto 2 ha di olivo', true)).toBe(false);
    const sesto = turnoRuntime(stato, 'prato 1 ha di orzo', {
      testo: CAP,
      terreni: [terrenoModello('Prato', 1, 'Orzo')],
      fatto: true,
    });
    expect(sesto.terreni).toHaveLength(5);
    expect(sesto.troppi).toBe(true);
    expect(sesto.terreni.some((t) => /^prato$/i.test(String(t.nome || '')))).toBe(false);
    expect(sesto.testo).toMatch(/account gratuito/i);
    expect(aprireSchedaPerFatto('no', true)).toBe(true);
  });
});

const CAP5 =
  "Con l'account gratuito arrivi a 5 terreni. Gli altri li aggiungi passando al Base, quando vuoi.";

function riga(nome, superficie, coltura) {
  return { nome, superficie, coltura, podere: 'Casetti' };
}

/**
 * Dialogo Faenza di Pier t1386u. Il modello sbaglia in modi diversi;
 * il percorso function → chat deve arrivare agli stessi cinque terreni.
 */
function dialogoFaenza(modo) {
  const stato = statoPulito();
  const visti = [];
  visti.push(
    turnoRuntime(stato, 'faenza via pergola 67', {
      testo: 'Ho registrato la sede. Ecco il riepilogo: controlla e conferma',
      sede: { indirizzo: 'via pergola 67', citta: 'Faenza', cap: null, provincia: 'RA' },
      poderi: [],
      terreni: [],
      fatto: true,
    })
  );
  visti.push(
    turnoRuntime(stato, 'casetti', {
      testo: 'Hai altri poderi o passiamo ai terreni?',
      poderi: [{ nome: 'casetti' }],
      terreni: [],
      fatto: false,
    })
  );
  visti.push(
    turnoRuntime(stato, 'passiamo ai terreni', {
      testo: 'Dimmi il nome di un terreno, la sua superficie in ettari e la coltura. Ne hai zero su 5.',
      poderi: [],
      terreni: [],
      fatto: false,
    })
  );

  const noti = () =>
    (stato.dati.terreni || []).map((t) => ({
      nome: t.nome,
      superficie: t.superficie,
      coltura: t.coltura,
      podere: t.podere,
    }));

  const laghetto =
    modo === 'doppio'
      ? [riga('Laghetto', 5, 'Grano'), riga('Grano', 5, 'Grano')]
      : modo === 'cumulativo'
        ? [riga('Laghetto grano', 5, 'Grano')]
        : [riga('Laghetto', 5, 'Grano')];
  visti.push(
    turnoRuntime(
      stato,
      'laghetto grano 5 ha',
      modo === 'json-rotto'
        ? 'non è json'
        : modo === 'omesso'
          ? { testo: CAP5, terreni: [], fatto: true }
          : { testo: 'Ne hai altri o vediamo il riepilogo?', terreni: laghetto, fatto: false }
    )
  );

  visti.push(
    turnoRuntime(
      stato,
      'querecione 7 ha mais',
      modo === 'json-rotto'
        ? '{testo rotto'
        : modo === 'omesso'
          ? { testo: CAP5, terreni: noti().filter((t) => t.superficie !== 7), fatto: true }
          : {
              testo: 'Ne hai altri o vediamo il riepilogo?',
              terreni: modo === 'cumulativo' ? noti().concat([riga('Quercione', 7, 'Mais')]) : [riga('querecione', 7, 'Mais')],
              fatto: false,
            }
    )
  );

  visti.push(
    turnoRuntime(
      stato,
      'cazun 6 ha peso',
      modo === 'json-rotto'
        ? 'ancora rotto'
        : modo === 'omesso'
          ? { testo: CAP5, terreni: [], fatto: true }
          : {
              testo: 'Ne hai altri o vediamo il riepilogo?',
              terreni:
                modo === 'cumulativo'
                  ? noti().concat([riga('cazun', 6, 'peso')])
                  : [riga('cazun', 6, 'peso')],
              fatto: false,
            }
    )
  );

  const primaDiPesco = (stato.dati.terreni || []).length;
  visti.push(
    turnoRuntime(
      stato,
      'pesco',
      modo === 'pesco-nuovo' || modo === 'incrementale'
        ? {
            testo: 'Come si chiama il terreno da 6 ettari di Pesco?',
            terreni: [{ nome: 'Pesco', superficie: 6, coltura: 'Pesco', podere: 'Casetti' }],
            fatto: true,
          }
        : modo === 'json-rotto'
          ? 'pesco'
          : {
              testo: 'Ne hai altri o vediamo il riepilogo?',
              terreni:
                modo === 'cumulativo'
                  ? noti().map((t) =>
                      /^cazun$/i.test(String(t.nome || '')) ? riga('cazun', 6, 'Pesco') : t
                    )
                  : [riga('cazun', 6, 'Pesco')],
              fatto: false,
            }
    )
  );

  visti.push(
    turnoRuntime(
      stato,
      'cancello 7 ha trebbiano',
      modo === 'json-rotto'
        ? 'rotto di nuovo'
        : modo === 'omesso'
          ? { testo: CAP5, terreni: noti().filter((t) => t.superficie !== 7), fatto: true }
          : {
              testo: 'Ne hai altri o vediamo il riepilogo?',
              terreni:
                modo === 'cumulativo'
                  ? noti().concat([riga('cancello', 7, 'Vite da Vino')])
                  : [riga('cancello', 7, 'Vite da Vino')],
              fatto: false,
            }
    )
  );

  const primaDellaCollina = (stato.dati.terreni || []).length;
  visti.push(
    turnoRuntime(
      stato,
      'collina 12 ha noci',
      modo === 'json-rotto'
        ? 'json spezzato'
        : {
            testo: CAP5,
            terreni:
              modo === 'omesso' || modo === 'pesco-nuovo'
                ? noti()
                : modo === 'cumulativo'
                  ? noti().concat([riga('Collina', 12, 'Noce')])
                  : [riga('Collina', 12, 'Noce')],
            fatto: true,
          }
    )
  );
  return { stato, visti, primaDiPesco, primaDellaCollina };
}

function attesiFaenza(terreni, modo) {
  const perNome = (re) => terreni.find((t) => re.test(String(t.nome || '')));
  expect(terreni).toHaveLength(5);
  expect(terreni.map((t) => String(t.nome || '').toLowerCase()).sort()).toEqual([
    'cancello',
    'cazun',
    'collina',
    'laghetto',
    'querecione',
  ]);
  expect(perNome(/^laghetto$/i)).toMatchObject({ superficie: 5, coltura: 'Grano' });
  expect(perNome(/^querecione$/i)).toMatchObject({ superficie: 7, coltura: 'Mais' });
  expect(String(perNome(/^querecione$/i).nome)).not.toMatch(/quercione/i);
  expect(perNome(/^cazun$/i)).toMatchObject({ superficie: 6, coltura: 'Pesco' });
  const cancello = perNome(/^cancello$/i);
  expect(cancello.superficie).toBe(7);
  if (modo === 'json-rotto' || modo === 'omesso') expect(cancello.coltura).toMatch(/^trebbiano$/i);
  else expect(cancello.coltura).toBe('Vite da Vino');
  const collina = perNome(/^collina$/i);
  expect(collina).toMatchObject({ superficie: 12, coltura: 'Noci' });
  expect(collina.coltura).not.toBe('Noce');
  expect(terreni.every((t) => String(t.podere || '').toLowerCase() === 'casetti')).toBe(true);
  expect(terreni.filter((t) => !t.nome || /^pesco$/i.test(String(t.nome)))).toHaveLength(0);
}

describe('runtime: quinto terreno collina 12 ha noci, Faenza t1386u', () => {
  it('catalogo: Noci non è Noce, grano si stacca dal nome, peso non è una coltura', () => {
    expect(normalizzaColturaCatalogo('noci')).toBeNull();
    expect(normalizzaColturaCatalogo('Noci')).toBeNull();
    expect(normalizzaColturaCatalogo('Noce')).toBe('Noce');
    expect(normalizzaColturaCatalogo('peso')).toBeNull();
    expect(normalizzaColturaCatalogo('pesco')).toBe('Pesco');
    expect(interpretaFraseTerreni('laghetto grano 5 ha')).toEqual([
      { nome: 'laghetto', varieta: 'grano', superficie: 5 },
    ]);
    expect(interpretaFraseTerreni('querecione 7 ha mais')[0]).toMatchObject({
      nome: 'querecione',
      varieta: 'mais',
      superficie: 7,
    });
    expect(interpretaFraseTerreni('collina 12 ha noci')[0]).toMatchObject({
      nome: 'collina',
      varieta: 'noci',
      superficie: 12,
    });
    expect(interpretaFraseTerreni('campo vecchio 5 ha')[0].nome).toBe('campo vecchio');
    expect(aprireSchedaPerFatto('faenza via pergola 67', true)).toBe(false);
    expect(aprireSchedaPerFatto('pesco', true)).toBe(false);
    expect(aprireSchedaPerFatto('collina 12 ha noci', true)).toBe(false);
    expect(aprireSchedaPerFatto('riepilogo', true)).toBe(true);
    expect(aprireSchedaPerFatto('riepilogo', false)).toBe(false);
  });

  for (const modo of ['incrementale', 'cumulativo', 'omesso', 'json-rotto', 'doppio', 'pesco-nuovo']) {
    it('due giri puliti, modello ' + modo + ', cinque terreni e un Casetti', () => {
      for (let giro = 0; giro < 2; giro++) {
        const { stato, visti, primaDiPesco, primaDellaCollina } = dialogoFaenza(modo);
        expect(visti[0].testo).toMatch(/Hai uno o più poderi/i);
        expect(visti[0].testo).not.toMatch(/riepilogo/i);
        expect(visti[0].passo).toBe('poderi');
        expect(stato.dati.sede.citta).toBe('Faenza');
        expect(visti[1].poderi.map((p) => p.toLowerCase())).toEqual(['casetti']);
        expect(visti[2].passo).toBe('terreni');
        expect(visti[3].terreni).toHaveLength(1);
        expect(visti[3].terreni[0].nome).toMatch(/^laghetto$/i);
        expect(visti[3].terreni[0].coltura).toBe('Grano');
        expect(visti[3].terreni[0].superficie).toBe(5);
        expect(visti[3].testo).not.toMatch(/account gratuito/i);
        expect(String(visti[4].terreni.find((t) => t.superficie === 7).nome)).toMatch(/^querecione$/i);
        expect(primaDiPesco).toBe(3);
        expect(visti[6].terreni.find((t) => /^cazun$/i.test(t.nome)).coltura).toBe('Pesco');
        expect(visti[6].terreni.filter((t) => t.superficie === 6)).toHaveLength(1);
        expect(visti[6].testo).not.toMatch(/come si chiama/i);
        expect(aprireSchedaPerFatto('pesco', true)).toBe(false);
        expect(primaDellaCollina).toBe(4);
        expect(visti[8].troppi).toBe(false);
        expect(visti[8].terreni).toHaveLength(5);
        expect(visti[8].testo).not.toMatch(/account gratuito/i);
        expect(visti[8].testo).toMatch(/Collina/i);
        expect(visti[8].testo).toMatch(/Noci/);
        expect(aprireSchedaPerFatto('collina 12 ha noci', true)).toBe(false);
        attesiFaenza(visti[8].terreni, modo);
        expect(stato.dati.poderi).toHaveLength(1);

        const storage = storageFinto();
        salvaSessioneIntervista(
          storage,
          {
            faseAiuto: true,
            aiutoFatto: false,
            messaggi: [{ ruolo: 'tony', testo: visti[8].testo }],
            storia: [],
            datiAiuto: stato.dati,
            passoAiuto: 'terreni',
            schedaAperta: false,
          },
          ORA + giro
        );
        const letto = leggiSessioneIntervista(storage, ORA + giro);
        const { righe, payload } = schedaAttesa(letto.datiAiuto);
        expect(righe.terreni).toHaveLength(5);
        expect(payload.terreni).toHaveLength(5);
        expect(payload.poderi).toHaveLength(1);
        attesiFaenza(payload.terreni, modo);
        expect(erroriNomeTerreniForm(payload.terreni)).toEqual([]);
        expect(serializzaRaccolti(letto.datiAiuto)).toMatch(/5 di 5/);
      }
    });
  }

  it('il sesto reale è respinto e i cinque restano', () => {
    const { stato } = dialogoFaenza('pesco-nuovo');
    expect(stato.dati.terreni).toHaveLength(5);
    const sesto = turnoRuntime(stato, 'bosco 3 ha di querce', {
      testo: CAP5,
      terreni: [riga('Bosco', 3, 'Querce')],
      fatto: true,
    });
    expect(sesto.terreni).toHaveLength(5);
    expect(sesto.troppi).toBe(true);
    expect(sesto.testo).toMatch(/account gratuito/i);
    expect(sesto.terreni.some((t) => /^bosco$/i.test(String(t.nome || '')))).toBe(false);
    attesiFaenza(sesto.terreni);
    expect(aprireSchedaPerFatto('bosco 3 ha di querce', true)).toBe(false);
  });
});

const CAP5_POZZO =
  "Con l'account gratuito arrivi a 5 terreni. Gli altri li aggiungi passando al Base, quando vuoi.";

function rigaBarbavara(nome, superficie, coltura) {
  return { nome, superficie, coltura, podere: 'Barbavara' };
}

/**
 * Come TonyChat dopo la correzione: preparaTurno riceve il testo della function,
 * non il messaggio di errore che azionePerEsito mette al posto di una stringa vuota.
 * La scheda segue gli stessi tre rami di TonyChat.vue.
 */
function turnoUi(stato, domanda, modello, meta) {
  const raccolti = serializzaRaccolti(stato.dati);
  const grezzo = typeof modello === 'string' ? modello : JSON.stringify(modello);
  let pulita = rispostaAccountDaTesto(grezzo, {
    raccolti,
    argomento: stato.passo,
    domanda,
  });
  const srvTerreni = pulita.dati && Array.isArray(pulita.dati.terreni) ? pulita.dati.terreni : [];
  const srv = {
    testo: pulita.testo,
    troppi: pulita.troppiTerreni === true,
    fatto: !!(pulita.dati && pulita.dati.fatto),
    n: srvTerreni.length,
    nomi: srvTerreni.map((t) => t && t.nome),
  };
  if (pulita.dati) {
    pulita.dati = applicaSuperficieDaDomanda(domanda, pulita.dati);
    pulita.dati = applicaNomeTerrenoDaDomanda(domanda, pulita.dati);
    pulita.testo = testoSeMancaNomeTerreno(pulita.testo, pulita.dati);
    if (pulita.dati.nomeTerrenoMancante != null) delete pulita.dati.nomeTerrenoMancante;
  }
  const esito = {
    codice: 'ok',
    testo: pulita.testo,
    fase: 'account',
    dati: pulita.dati,
    troppiTerreni: pulita.troppiTerreni === true,
    domandeRimaste: meta && typeof meta.rimaste === 'number' ? meta.rimaste : 22,
  };
  const azione = azionePerEsito(esito);
  const prima = (stato.dati.terreni || []).length;
  const client = preparaTurnoOnboarding({
    domanda,
    passo: stato.passo,
    datiAttuali: stato.dati,
    datiNuovi: esito.dati,
    testo: typeof esito.testo === 'string' ? esito.testo : '',
  });
  stato.dati = client.dati.dati;
  stato.passo = client.passo || stato.passo;
  const novita = JSON.stringify(stato.dati) !== JSON.stringify(meta && meta.primaDati);
  const dopo = decidiDopoRisposta({
    nuoviDati: (stato.dati.terreni || []).length > prima,
    turniSenzaNovitaNelPasso: (stato.dati.terreni || []).length > prima ? 0 : 1,
    domandeRimaste: esito.domandeRimaste,
    passo: stato.passo,
  });
  const frase = fraseTerrenoSenzaRiepilogo(domanda);
  let scheda = false;
  if (!client.bloccaAvanti && !client.vaiATerreni) {
    if ((dopo.azione === 'riepilogo' || dopo.apriRiepilogo) && !frase && stato.passo !== 'sede') {
      scheda = true;
    } else if (dopo.azione === 'prossimoPasso' && !prossimoPasso(stato.passo) && !frase) {
      scheda = true;
    } else if (aprireSchedaPerFatto(domanda, esito.dati && esito.dati.fatto) || utenteChiedeRiepilogo(domanda)) {
      scheda = true;
    }
  }
  const righe = righeRiepilogo(stato.dati).terreni.filter((t) => t.nome || t.superficie || t.coltura);
  const mostrato = client.testo != null && String(client.testo).trim() ? client.testo : azione.testo;
  return {
    srv,
    mostrato,
    azione: azione.testo,
    scheda,
    passo: stato.passo,
    n: (stato.dati.terreni || []).length,
    righe,
    troppi: client.dati.troppiTerreni === true,
    prima,
    novita,
  };
}

function dialogoPozzo(quinto) {
  const stato = statoPulito();
  const visti = [];
  const gira = (domanda, modello) => {
    visti.push(turnoUi(stato, domanda, modello));
  };
  gira('faenza via monte coralli 5', {
    testo: 'Ho registrato la sede. Ecco il riepilogo: controlla e conferma',
    sede: { indirizzo: 'via monte coralli 5', citta: 'Faenza', cap: null, provincia: 'RA' },
    poderi: [],
    terreni: [],
    fatto: true,
  });
  gira('barbavara', {
    testo: 'Hai un podere che si chiama Barbavara. Ne hai altri o passiamo ai terreni?',
    poderi: [{ nome: 'Barbavara' }],
    terreni: [],
    fatto: false,
  });
  gira('passiamo ai terreni', {
    testo: 'Dimmi il nome di un terreno, la sua superficie in ettari e la coltura. Ne hai zero su 5.',
    terreni: [],
    fatto: false,
  });
  gira('laghetto...4 ha trebbiano', {
    testo: 'Ne hai altri o vediamo il riepilogo?',
    terreni: [
      rigaBarbavara('Laghetto', 4, 'Vite da Vino'),
      rigaBarbavara('Trebbiano', 4, 'Vite da Vino'),
    ],
    fatto: false,
  });
  gira('collinetta 6 ha pesco', {
    testo: 'Ne hai altri o vediamo il riepilogo?',
    terreni: [rigaBarbavara('Collinetta', 6, 'Pesco')],
    fatto: false,
  });
  gira('cancello 7 ha giuggiolo', {
    testo: 'Ne hai altri o vediamo il riepilogo?',
    terreni: [
      rigaBarbavara('Cancello', 7, 'Giuggiolo'),
      rigaBarbavara('Giuggiolo', 7, 'Giuggiolo'),
    ],
    fatto: false,
  });
  gira('12 ha grano si chiama chiesetta', {
    testo: 'Ne hai altri o vediamo il riepilogo?',
    terreni: [
      rigaBarbavara('Grano', 12, 'Grano'),
      rigaBarbavara('Chiesetta', 12, 'Grano'),
    ],
    fatto: false,
  });
  const noti = () =>
    (stato.dati.terreni || []).map((t) => rigaBarbavara(t.nome, t.superficie, t.coltura));
  gira(quinto.domanda, quinto.modello(noti));
  return { stato, visti };
}

function attesiPozzo(terreni, colturaPozzo) {
  expect(terreni).toHaveLength(5);
  const per = (re) => terreni.find((t) => re.test(String(t.nome || '')));
  expect(per(/^laghetto$/i)).toMatchObject({ superficie: 4 });
  expect(['Vite da Vino', 'Trebbiano']).toContain(per(/^laghetto$/i).coltura);
  expect(per(/^collinetta$/i)).toMatchObject({ superficie: 6, coltura: 'Pesco' });
  expect(per(/^cancello$/i)).toMatchObject({ superficie: 7, coltura: 'Giuggiolo' });
  expect(per(/^chiesetta$/i)).toMatchObject({ superficie: 12, coltura: 'Grano' });
  expect(per(/^pozzo$/i)).toMatchObject({ superficie: 8, coltura: colturaPozzo });
  expect(per(/^pozzo$/i).coltura).not.toBe(colturaPozzo === 'Noci' ? 'Noce' : 'Noci');
  expect(terreni.every((t) => String(t.podere || '').toLowerCase() === 'barbavara')).toBe(true);
  expect(new Set(terreni.map((t) => String(t.nome || '').toLowerCase())).size).toBe(5);
}

describe('runtime: quinto Pozzo 8 ha noci, Barbavara t1388u', () => {
  it('il parser tiene nome-dopo, nome-prima, noci, noce e mais', () => {
    expect(normalizzaColturaCatalogo('noci')).toBeNull();
    expect(normalizzaColturaCatalogo('giuggiolo')).toBe('Giuggiolo');
    expect(interpretaFraseTerreni('8 ha di noci che si chiama pozzo')[0]).toMatchObject({
      nome: 'pozzo',
      varieta: 'noci',
      superficie: 8,
    });
    expect(interpretaFraseTerreni('pozzo 8 ha noci')[0]).toMatchObject({
      nome: 'pozzo',
      varieta: 'noci',
      superficie: 8,
    });
    expect(interpretaFraseTerreni('8 ha di mais che si chiama pozzo')[0]).toMatchObject({
      nome: 'pozzo',
      varieta: 'mais',
      superficie: 8,
    });
    expect(interpretaFraseTerreni('8 ha di noce che si chiama pozzo')[0]).toMatchObject({
      nome: 'pozzo',
      varieta: 'noce',
      superficie: 8,
    });
    expect(interpretaFraseTerreni('noci 8 ha che si chiama pozzo')[0]).toMatchObject({
      nome: 'pozzo',
      varieta: 'noci',
      superficie: 8,
    });
    expect(interpretaFraseTerreni('12 ha grano si chiama chiesetta')[0]).toMatchObject({
      nome: 'chiesetta',
      varieta: 'grano',
      superficie: 12,
    });
    expect(interpretaFraseTerreni('faenza via monte coralli 5')[0].superficie).toBeNull();
    expect(sembraIndirizzo('via monte coralli 5 faenza')).toBe(true);
    expect(interpretaFraseTerreni('via monte coralli 5 faenza')[0].superficie).toBeNull();
    expect(interpretaFraseTerreni('ho 3 ha di sangiovese che si piama paletto')[0]).toMatchObject({
      nome: 'paletto',
      varieta: 'sangiovese',
      superficie: 3,
    });
    expect(aprireSchedaPerFatto('faenza via monte coralli 5', true)).toBe(false);
    expect(aprireSchedaPerFatto('8 ha di noci che si chiama pozzo', true)).toBe(false);
    expect(utenteChiedeRiepilogo('8 ha di noci che si chiama pozzo')).toBe(false);
  });

  it('la chat non sostituisce il testo vuoto della sede con l errore', () => {
    const src = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../../landing/src/components/TonyChat.vue'),
      'utf8'
    );
    expect(src).toMatch(/typeof esito\.testo === 'string' \? esito\.testo/);
    const vuoto = azionePerEsito({ codice: 'ok', testo: '', fase: 'account' });
    expect(vuoto.testo).toBe(MESSAGGI_CHAT.errore);
    const stato = statoPulito();
    const sede = turnoUi(stato, 'faenza via monte coralli 5', {
      testo: 'Ho registrato la sede. Ecco il riepilogo: controlla e conferma',
      sede: { indirizzo: 'via monte coralli 5', citta: 'Faenza' },
      poderi: [],
      terreni: [],
      fatto: true,
    });
    expect(sede.mostrato).toMatch(/Hai uno o più poderi/i);
    expect(sede.mostrato).not.toMatch(/riepilogo/i);
    expect(sede.mostrato).not.toMatch(/non riesco a risponderti/i);
    expect(sede.scheda).toBe(false);
    expect(sede.passo).toBe('poderi');
    const variante = turnoUi(statoPulito(), 'faenza via monte coralli 5', {
      testo: 'Ti faccio vedere il riepilogo: controlla e conferma',
      sede: { indirizzo: 'via monte coralli 5', citta: 'Faenza' },
      poderi: [],
      terreni: [],
      fatto: true,
    });
    expect(variante.mostrato).not.toMatch(/riepilogo/i);
    expect(variante.scheda).toBe(false);
  });

  for (const spec of [
    {
      nome: 'incrementale',
      domanda: '8 ha di noci che si chiama pozzo',
      coltura: 'Noci',
      modello: () => ({
        testo: CAP5_POZZO,
        terreni: [rigaBarbavara('Pozzo', 8, 'Noce')],
        fatto: true,
      }),
    },
    {
      nome: 'cumulativo',
      domanda: '8 ha di noci che si chiama pozzo',
      coltura: 'Noci',
      modello: (noti) => ({
        testo: CAP5_POZZO,
        terreni: noti().concat([rigaBarbavara('Pozzo', 8, 'Noce')]),
        fatto: true,
      }),
    },
    {
      nome: 'omesso',
      domanda: '8 ha di noci che si chiama pozzo',
      coltura: 'Noci',
      modello: (noti) => ({ testo: CAP5_POZZO, terreni: noti(), fatto: true }),
    },
    {
      nome: 'json-rotto',
      domanda: '8 ha di noci che si chiama pozzo',
      coltura: 'Noci',
      modello: () => '{ questo non è json',
    },
    {
      nome: 'doppio-noci-e-pozzo',
      domanda: '8 ha di noci che si chiama pozzo',
      coltura: 'Noci',
      modello: (noti) => ({
        testo: CAP5_POZZO,
        terreni: noti().concat([
          rigaBarbavara('Noci', 8, 'Noce'),
          rigaBarbavara('Pozzo', 8, 'Noce'),
        ]),
        fatto: true,
      }),
      serverTienePozzo: true,
    },
    {
      nome: 'solo-nome-noci',
      domanda: '8 ha di noci che si chiama pozzo',
      coltura: 'Noci',
      modello: () => ({
        testo: CAP5_POZZO,
        terreni: [rigaBarbavara('Noci', 8, 'Noce')],
        fatto: true,
      }),
    },
    {
      nome: 'senza-nome',
      domanda: '8 ha di noci che si chiama pozzo',
      coltura: 'Noci',
      modello: (noti) => ({
        testo: CAP5_POZZO,
        terreni: noti().concat([rigaBarbavara(null, 8, 'Noce')]),
        fatto: true,
      }),
    },
    {
      nome: 'nome-prima',
      domanda: 'pozzo 8 ha noci',
      coltura: 'Noci',
      modello: () => ({
        testo: CAP5_POZZO,
        terreni: [rigaBarbavara('Noce', 8, 'Noce')],
        fatto: true,
      }),
    },
    {
      nome: 'quinto-mais',
      domanda: '8 ha di mais che si chiama pozzo',
      coltura: 'Mais',
      modello: (noti) => ({
        testo: CAP5_POZZO,
        terreni: noti().concat([rigaBarbavara('Mais', 8, 'Mais')]),
        fatto: true,
      }),
    },
    {
      nome: 'quinto-noce',
      domanda: '8 ha di noce che si chiama pozzo',
      coltura: 'Noce',
      modello: () => ({
        testo: 'Ne hai altri o vediamo il riepilogo?',
        terreni: [rigaBarbavara('Pozzo', 8, 'Noce')],
        fatto: false,
      }),
    },
  ]) {
    it('due giri, ' + spec.nome + ', cinque righe e niente scheda', () => {
      for (let giro = 0; giro < 2; giro++) {
        const { stato, visti } = dialogoPozzo(spec);
        expect(visti[0].n).toBe(0);
        expect(visti[0].scheda).toBe(false);
        expect(visti[0].mostrato).not.toMatch(/riepilogo/i);
        expect(visti[1].n).toBe(0);
        expect(visti[2].passo).toBe('terreni');
        expect(visti[2].n).toBe(0);
        expect(visti[3].n).toBe(1);
        expect(visti[4].n).toBe(2);
        expect(visti[5].n).toBe(3);
        expect(visti[5].righe.find((t) => /^cancello$/i.test(t.nome)).coltura).toBe('Giuggiolo');
        expect(visti[6].n).toBe(4);
        expect(visti[6].righe.find((t) => /^chiesetta$/i.test(t.nome))).toMatchObject({
          superficie: '12',
          coltura: 'Grano',
        });
        const quinto = visti[7];
        expect(quinto.prima).toBe(4);
        expect(quinto.n).toBe(5);
        expect(quinto.righe).toHaveLength(5);
        expect(quinto.troppi).toBe(false);
        expect(quinto.scheda).toBe(false);
        expect(quinto.mostrato).not.toMatch(/account gratuito/i);
        expect(quinto.mostrato).not.toMatch(/^Va bene\.$/);
        if (spec.nome !== 'quinto-noce') {
          expect(quinto.mostrato).toMatch(/Pozzo/);
          expect(quinto.mostrato).toMatch(new RegExp(spec.coltura));
        }
        if (spec.serverTienePozzo) {
          expect(quinto.srv.troppi).toBe(false);
          expect(quinto.srv.nomi.some((n) => /^pozzo$/i.test(String(n || '')))).toBe(true);
          expect(quinto.srv.nomi.some((n) => /^noci$/i.test(String(n || '')))).toBe(false);
        }
        attesiPozzo(stato.dati.terreni, spec.coltura);
        const storage = storageFinto();
        salvaSessioneIntervista(
          storage,
          {
            faseAiuto: true,
            aiutoFatto: false,
            messaggi: [{ ruolo: 'tony', testo: quinto.mostrato }],
            storia: [],
            datiAiuto: stato.dati,
            passoAiuto: 'terreni',
            schedaAperta: false,
          },
          ORA + 20 + giro
        );
        const letto = leggiSessioneIntervista(storage, ORA + 20 + giro);
        const righe = righeRiepilogo(letto.datiAiuto).terreni.filter(
          (t) => t.nome || t.superficie || t.coltura
        );
        expect(righe).toHaveLength(5);
        expect(righe.find((t) => /^pozzo$/i.test(t.nome)).coltura).toBe(spec.coltura);
      }
    });
  }

  it('solo il sesto è respinto, il riepilogo solo se chiesto', () => {
    const { stato, visti } = dialogoPozzo({
      domanda: '8 ha di noci che si chiama pozzo',
      modello: (noti) => ({
        testo: CAP5_POZZO,
        terreni: noti().concat([
          rigaBarbavara('Noci', 8, 'Noce'),
          rigaBarbavara('Pozzo', 8, 'Noce'),
        ]),
        fatto: true,
      }),
    });
    expect(visti[7].n).toBe(5);
    expect(visti[7].scheda).toBe(false);
    const sesto = turnoUi(stato, 'bosco 1 ha di orzo', {
      testo: CAP5_POZZO,
      terreni: [rigaBarbavara('Bosco', 1, 'Orzo')],
      fatto: true,
    });
    expect(sesto.n).toBe(5);
    expect(sesto.troppi).toBe(true);
    expect(sesto.srv.troppi).toBe(true);
    expect(sesto.mostrato).toMatch(/account gratuito/i);
    expect(sesto.scheda).toBe(false);
    expect(sesto.righe.some((t) => /^bosco$/i.test(t.nome))).toBe(false);
    expect(sesto.righe.some((t) => /^pozzo$/i.test(t.nome))).toBe(true);
    const chiesto = turnoUi(stato, 'vediamo il riepilogo', {
      testo: 'Ecco il riepilogo: controlla e conferma',
      terreni: [],
      fatto: true,
    });
    expect(chiesto.scheda).toBe(true);
    expect(chiesto.n).toBe(5);
  });
});

describe('runtime: Pozzo Trebbiano e Salita 12 mais, Bruciata t1392u', () => {
  it('il parser stacca la varietà prima degli ettari e il numero senza unità', () => {
    expect(normalizzaColturaCatalogo('trebbiano')).toBeNull();
    expect(normalizzaColturaCatalogo('sangiovese')).toBeNull();
    expect(normalizzaColturaCatalogo('albicocche')).toBe('Albicocche');
    expect(normalizzaColturaCatalogo('mandorlo')).toBe('Mandorlo');
    expect(normalizzaColturaCatalogo('mais')).toBe('Mais');
    expect(interpretaFraseTerreni('pozzo trebbiano 5 ha')[0]).toMatchObject({
      nome: 'pozzo',
      varieta: 'trebbiano',
      superficie: 5,
    });
    expect(interpretaFraseTerreni('collina sangiovese 4 ha')[0]).toMatchObject({
      nome: 'collina',
      varieta: 'sangiovese',
      superficie: 4,
    });
    expect(interpretaFraseTerreni('cancello mandorlo 7 ha')[0]).toMatchObject({
      nome: 'cancello',
      varieta: 'mandorlo',
      superficie: 7,
    });
    expect(interpretaFraseTerreni('salita 12 mais')[0]).toMatchObject({
      nome: 'salita',
      varieta: 'mais',
      superficie: 12,
    });
    expect(interpretaFraseTerreni('buca 5 ha albicocche')[0]).toMatchObject({
      nome: 'buca',
      varieta: 'albicocche',
      superficie: 5,
    });
    expect(interpretaFraseTerreni('campo vecchio 5 ha')[0].nome).toBe('campo vecchio');
    expect(interpretaFraseTerreni('faenza via monte coralli 8')[0].superficie).toBeNull();
  });

  function rigaBruciata(nome, superficie, coltura) {
    return { nome, superficie, coltura, podere: 'Bruciata' };
  }

  function dialogoBruciata() {
    const stato = statoPulito();
    const visti = [];
    const gira = (domanda, modello) => visti.push(turnoUi(stato, domanda, modello));
    gira('faenza via monte coralli 8', {
      testo: 'Ho registrato la sede. Ecco il riepilogo: controlla e conferma',
      sede: { indirizzo: 'via monte coralli 8', citta: 'Faenza' },
      poderi: [],
      terreni: [],
      fatto: true,
    });
    gira('bruciata', {
      testo: 'Ok, il primo podere si chiama Bruciata. Ne hai altri o passiamo ai terreni?',
      poderi: [{ nome: 'Bruciata' }],
      terreni: [],
      fatto: false,
    });
    gira('terreni', {
      testo: 'Dimmi il nome di un terreno, la sua superficie in ettari e la coltura. Ne hai zero su 5.',
      terreni: [],
      fatto: false,
    });
    gira('pozzo trebbiano 5 ha', {
      testo: 'Che cosa ci coltivi nel terreno Pozzo Trebbiano?',
      terreni: [rigaBruciata('Pozzo Trebbiano', 5, null)],
      fatto: false,
    });
    gira('collina sangiovese 4 ha', {
      testo: 'Ne hai altri o vediamo il riepilogo? Ne hai due su 5.',
      terreni: [rigaBruciata('Collina Sangiovese', 4, null)],
      fatto: false,
    });
    gira('cancello mandorlo 7 ha', {
      testo: 'Ne hai altri o vediamo il riepilogo? Ne hai tre su 5.',
      terreni: [rigaBruciata('Cancello', 7, 'Mandorlo')],
      fatto: false,
    });
    gira('salita 12 mais', {
      testo: 'Come si chiama il terreno da 12 ettari?',
      terreni: [rigaBruciata(null, 12, 'Mais')],
      fatto: true,
    });
    gira('buca 5 ha albicocche', {
      testo: 'Ne hai altri o vediamo il riepilogo? Ne hai cinque su 5.',
      terreni: [rigaBruciata('Buca', 5, 'Albicocche')],
      fatto: false,
    });
    return { stato, visti };
  }

  function schedaAttesa(righe) {
    const per = (re) => righe.find((t) => re.test(String(t.nome || '')));
    expect(per(/^pozzo$/i)).toMatchObject({ superficie: '5', coltura: 'Trebbiano' });
    expect(per(/^pozzo$/i).nome).not.toMatch(/trebbiano/i);
    expect(per(/^collina$/i)).toMatchObject({ superficie: '4', coltura: 'Sangiovese' });
    expect(per(/^collina$/i).nome).not.toMatch(/sangiovese/i);
    expect(per(/^cancello$/i)).toMatchObject({ superficie: '7', coltura: 'Mandorlo' });
    expect(per(/^salita$/i)).toMatchObject({ superficie: '12', coltura: 'Mais' });
    expect(per(/^buca$/i)).toMatchObject({ superficie: '5', coltura: 'Albicocche' });
    expect(righe.every((t) => String(t.podere || '').toLowerCase() === 'bruciata')).toBe(true);
    expect(new Set(righe.map((t) => String(t.nome || '').toLowerCase())).size).toBe(5);
  }

  it('due giri, cinque terreni in scheda e il sesto respinto', () => {
    for (let giro = 0; giro < 2; giro++) {
      const { stato, visti } = dialogoBruciata();
      expect(visti[0].mostrato).toMatch(/Hai uno o più poderi/i);
      expect(visti[0].mostrato).not.toMatch(/riepilogo/i);
      expect(visti[0].scheda).toBe(false);
      expect(visti[0].n).toBe(0);
      expect(visti[1].passo).toBe('poderi');
      expect(stato.dati.poderi.map((p) => p.nome)).toEqual(['Bruciata']);
      expect(visti[2].passo).toBe('terreni');
      expect(visti[2].n).toBe(0);
      expect(visti[3].n).toBe(1);
      expect(visti[3].scheda).toBe(false);
      expect(visti[3].mostrato).not.toMatch(/ci coltivi/i);
      expect(visti[3].mostrato).not.toMatch(/Pozzo Trebbiano/i);
      expect(visti[3].righe[0]).toMatchObject({ nome: 'Pozzo', superficie: '5', coltura: 'Trebbiano' });
      expect(visti[6].n).toBe(4);
      expect(visti[6].scheda).toBe(false);
      expect(visti[6].mostrato).not.toMatch(/come si chiama/i);
      expect(visti[6].righe.find((t) => /^salita$/i.test(t.nome))).toMatchObject({
        superficie: '12',
        coltura: 'Mais',
      });
      expect(visti[7].n).toBe(5);
      expect(visti[7].scheda).toBe(false);
      schedaAttesa(visti[7].righe);
      const sesto = turnoUi(stato, 'coriandolo 12 ha orzo', {
        testo: "Con l'account gratuito arrivi a cinque terreni. Gli altri li aggiungi passando al Base, quando vuoi.",
        terreni: [rigaBruciata('Coriandolo', 12, 'Orzo')],
        fatto: true,
      });
      expect(sesto.n).toBe(5);
      expect(sesto.troppi).toBe(true);
      expect(sesto.srv.troppi).toBe(true);
      expect(sesto.scheda).toBe(false);
      expect(sesto.mostrato).toMatch(/account gratuito/i);
      expect(sesto.righe.some((t) => /^coriandolo$/i.test(t.nome))).toBe(false);
      expect(sesto.righe.find((t) => /^salita$/i.test(t.nome))).toMatchObject({
        superficie: '12',
        coltura: 'Mais',
      });
      schedaAttesa(sesto.righe);
    }
  });
});

/**
 * Dialogo reale prova-tony (main 25dd0175): sede «via monte coralli 5 faenza»
 * generava un terreno fantasma (5 ha, coltura Faenza), contatore sfalsato,
 * Chiesetta respinta come sesto. Verifica function + client sullo stesso turno.
 */
function dialogoMonteCoralliLoghetto() {
  const stato = statoPulito();
  const visti = [];
  const gira = (domanda, modello) => {
    visti.push(turnoRuntime(stato, domanda, modello));
  };
  gira('via monte coralli 5 faenza', {
    testo: 'Ok, ho la sede. Hai dei poderi?',
    sede: { indirizzo: 'via monte coralli 5', citta: 'Faenza', cap: null, provincia: 'RA' },
    poderi: [],
    terreni: [{ nome: 'Via monte coralli', superficie: 5, coltura: 'Faenza' }],
    fatto: false,
  });
  gira('loghetto', {
    testo: 'Ok, ho un podere. Passiamo ai terreni.',
    poderi: [{ nome: 'loghetto' }],
    terreni: [],
    fatto: false,
  });
  gira('passiamo ai terreni', {
    testo: 'Dimmi nome, ettari e coltura. Ne hai zero su 5.',
    terreni: [],
    fatto: false,
  });
  gira('quercia 3 ha sorgo', {
    testo: 'Ok. Ne hai due su 5.',
    terreni: [{ nome: 'Quercia', superficie: 3, coltura: 'Sorgo', podere: 'loghetto' }],
    fatto: false,
  });
  gira('ho 3 ha di sangiovese che si piama paletto', {
    testo: 'Come si chiama questo terreno?',
    terreni: [{ nome: null, superficie: 3, coltura: 'Sangiovese', podere: 'loghetto' }],
    fatto: false,
  });
  gira('ho un campo di grano che si chiama collina', {
    testo: 'Ne hai cinque su 5.',
    terreni: [{ nome: 'Collina', superficie: null, coltura: 'Grano', podere: 'loghetto' }],
    fatto: false,
  });
  gira('12', {
    testo: 'Ok, 12 ettari.',
    terreni: [{ nome: 'Collina', superficie: 12, coltura: 'Grano', podere: 'loghetto' }],
    fatto: false,
  });
  gira('3 ha di prugne chiamato lago', {
    testo: 'Ok, aggiunto.',
    terreni: [{ nome: 'Lago', superficie: 3, coltura: 'Prugne', podere: 'loghetto' }],
    fatto: false,
  });
  gira('6 ha di mele che si chiama chiesetta', {
    testo:
      "Con l'account gratuito arrivi a 5 terreni. Gli altri li aggiungi passando al Base, quando vuoi.",
    terreni: [{ nome: 'Chiesetta', superficie: 6, coltura: 'Melo', podere: 'loghetto' }],
    fatto: true,
  });
  gira('2 ha di orzo chiamato extra', {
    testo:
      "Con l'account gratuito arrivi a 5 terreni. Gli altri li aggiungi passando al Base, quando vuoi.",
    terreni: [{ nome: 'Extra', superficie: 2, coltura: 'Orzo', podere: 'loghetto' }],
    fatto: true,
  });
  return { stato, visti };
}

describe('runtime: dialogo Monte Coralli / Loghetto (fantasma sede)', () => {
  it('nessun terreno dalla sede, contatore reale, Chiesetta quinto, sesto respinto', () => {
    const { stato, visti } = dialogoMonteCoralliLoghetto();

    expect(visti[0].terreni).toHaveLength(0);
    expect(stato.dati.sede.citta).toBe('Faenza');
    expect(visti[1].poderi).toEqual(['loghetto']);

    expect(visti[3].terreni).toHaveLength(1);
    expect(visti[3].terreni[0].nome).toMatch(/^quercia$/i);
    expect(visti[3].testo).toMatch(/ne hai\s+1\s+su\s+5/i);
    expect(visti[3].testo).not.toMatch(/ne hai\s+due\s+su\s+5/i);

    expect(visti[4].terreni.map((t) => String(t.nome || '').toLowerCase())).toEqual([
      'quercia',
      'paletto',
    ]);

    expect(visti[5].terreni).toHaveLength(3);
    expect(visti[5].testo).toMatch(/ne hai\s+3\s+su\s+5/i);

    expect(visti[7].terreni).toHaveLength(4);
    expect(visti[7].terreni.map((t) => String(t.nome || '').toLowerCase())).toEqual([
      'quercia',
      'paletto',
      'collina',
      'lago',
    ]);

    expect(visti[8].troppi).toBe(false);
    expect(visti[8].terreni).toHaveLength(5);
    expect(visti[8].terreni.map((t) => String(t.nome || '').toLowerCase())).toEqual([
      'quercia',
      'paletto',
      'collina',
      'lago',
      'chiesetta',
    ]);
    expect(visti[8].testo).not.toMatch(/account gratuito/i);

    expect(visti[9].troppi).toBe(true);
    expect(visti[9].terreni).toHaveLength(5);
    expect(visti[9].terreni.some((t) => /^extra$/i.test(String(t.nome || '')))).toBe(false);
    expect(visti[9].testo).toMatch(/account gratuito/i);

    expect(
      stato.dati.terreni.some(
        (t) =>
          /monte coralli/i.test(String(t.nome || '')) ||
          /faenza/i.test(String(t.coltura || ''))
      )
    ).toBe(false);
  });

  it('function: sede con terreno fantasma nel JSON non passa terreni', () => {
    const out = rispostaAccountDaTesto(
      JSON.stringify({
        testo: 'Ok sede',
        sede: { indirizzo: 'via monte coralli 5', citta: 'Faenza' },
        poderi: [],
        terreni: [{ nome: 'Via monte coralli', superficie: 5, coltura: 'Faenza' }],
        fatto: false,
      }),
      { argomento: 'sede', domanda: 'via monte coralli 5 faenza', raccolti: '' }
    );
    expect(out.dati.terreni).toEqual([]);
    expect(out.dati.sede.citta).toBe('Faenza');
  });
});
