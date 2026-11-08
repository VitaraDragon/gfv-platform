/**
 * Percorso reale dell'onboarding: JSON del modello → pulizia della function
 * → turno della chat. Non un helper con il nome già uguale alla varietà.
 * Sequenza detta da Pier il 2026-11-08, ripetuta da stato pulito.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  aprireSchedaPerFatto,
  erroriNomeTerreniForm,
  interpretaFraseTerreni,
  normalizzaColturaCatalogo,
  payloadDaScheda,
  preparaTurnoOnboarding,
  righeRiepilogo,
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
    expect(chat).toContain('aprireSchedaPerFatto');
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
