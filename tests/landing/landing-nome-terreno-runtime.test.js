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
  erroriNomeTerreniForm,
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
  let pulita = rispostaAccountDaTesto(JSON.stringify(modello), {
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
