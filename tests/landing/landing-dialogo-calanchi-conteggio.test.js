/**
 * Dialogo congelato di Pier (prova-tony, main 604c7872): voce = testo server,
 * chat = testo client. Conteggio = terreni con nome; limite solo al quinto.
 *
 * Eccezioni voce/chat volute (riscrittura client già prevista, non questo bug):
 * nessuna nel dialogo a quattro terreni. Al quinto il client aggiunge la frase
 * di limite e toglie «Ne hai altri» (apertura riepilogo): la voce resta sul
 * testo del modello se quello non diceva già il limite.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  LANDING_ATTIVA,
  TONY_BUSSA_ATTIVO,
} from '../../landing/src/config/landing-config.js';
import {
  BUSSATA_AUTOMATICA_ATTIVA,
  bussataAutomaticaConsentita,
} from '../../landing/src/lib/tony-bussa-logica.js';
import {
  preparaTurnoOnboarding,
  righeRiepilogo,
  serializzaRaccolti,
} from '../../landing/src/lib/tony-aiuto-account.js';

const require = createRequire(import.meta.url);
const {
  applicaNomeTerrenoDaDomanda,
  promptSistemaAccount,
  rispostaAccountDaTesto,
} = require('../../functions/lib/tony-landing-account.js');

function statoIniziale() {
  return {
    passo: 'sede',
    dati: { sede: null, poderi: [], terreni: [] },
  };
}

function turno(stato, domanda, modello) {
  const raccolti = serializzaRaccolti(stato.dati);
  const grezzo = typeof modello === 'string' ? modello : JSON.stringify(modello);
  const pulita = rispostaAccountDaTesto(grezzo, {
    raccolti,
    argomento: stato.passo,
    domanda,
  });
  if (pulita.dati) {
    pulita.dati = applicaNomeTerrenoDaDomanda(domanda, pulita.dati);
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
  const testoChat = client.testo != null ? client.testo : pulita.testo;
  return {
    voce: pulita.testo,
    testoChat,
    apriRiepilogo: client.apriRiepilogo === true,
    vaiATerreni: client.vaiATerreni === true,
    passo: stato.passo,
    terreni: stato.dati.terreni || [],
    poderi: stato.dati.poderi || [],
    troppi: client.dati.troppiTerreni === true,
  };
}

const DIALOGO = [
  [
    'sede',
    'via monte coralli 3 faenza',
    {
      testo: 'Ok, la sede legale è in via Monte Coralli 3 a Faenza. Hai dei poderi?',
      sede: { indirizzo: 'via Monte Coralli 3', citta: 'Faenza', provincia: 'RA' },
      poderi: [],
      terreni: [],
      fatto: false,
    },
  ],
  [
    'poderi',
    'si 1',
    {
      testo: 'Dimmi il nome del podere.',
      poderi: [],
      terreni: [],
      fatto: false,
    },
  ],
  [
    'poderi',
    'calanchi',
    {
      testo:
        'Ok, il podere si chiama Calanchi. Dimmi il primo terreno: come si chiama, quanti ettari e cosa ci coltivi?',
      poderi: [{ nome: 'Calanchi' }],
      terreni: [],
      fatto: false,
    },
  ],
  [
    'terreni',
    'si chiama ponte è 12 ha a grano',
    {
      testo:
        'Ok, hai un terreno che si chiama Ponte, di dodici ettari a Grano. Ne hai altri o vediamo il riepilogo?',
      terreni: [{ nome: 'Ponte', superficie: 12, coltura: 'Grano', podere: 'Calanchi' }],
      fatto: false,
    },
  ],
  [
    'terreni',
    'uno a prugne 8 ha',
    {
      testo: 'Come si chiama il terreno da 8 ettari di prugne?',
      terreni: [{ nome: null, superficie: 8, coltura: 'Prugne', podere: 'Calanchi' }],
      fatto: false,
    },
  ],
  [
    'terreni',
    'prugneto',
    {
      testo:
        'Ok, hai un terreno che si chiama Prugneto, di otto ettari a Prugne. Ne hai tre su cinque terreni. Ne hai altri o vediamo il riepilogo?',
      terreni: [{ nome: 'Prugneto', superficie: 8, coltura: 'Prugne', podere: 'Calanchi' }],
      fatto: false,
    },
  ],
  [
    'terreni',
    '3 ha di albicocche che si chiama discesa',
    {
      testo:
        'Ok, hai un terreno che si chiama Discesa, di tre ettari a Albicocche. Ne hai quattro su cinque terreni. Ne hai altri o vediamo il riepilogo?',
      terreni: [{ nome: 'Discesa', superficie: 3, coltura: 'Albicocche', podere: 'Calanchi' }],
      fatto: false,
    },
  ],
  [
    'terreni',
    'ho 3 ha di ciliegi che si chiama ciliegi',
    {
      testo:
        "Ok, hai un terreno che si chiama Ciliegi, di tre ettari a Ciliegio. Hai raggiunto il limite di cinque terreni con l'account gratuito. Gli altri li aggiungi passando al Base, quando vuoi.",
      terreni: [{ nome: 'Ciliegi', superficie: 3, coltura: 'Ciliegio', podere: 'Calanchi' }],
      fatto: true,
    },
  ],
  [
    'terreni',
    'ok...e adesso?',
    {
      testo:
        'Ora che abbiamo inserito i tuoi cinque terreni, puoi accedere all\'app di Global Farm View per vederli e iniziare a gestire la tua azienda agricola.',
      terreni: [],
      fatto: false,
    },
  ],
  [
    'terreni',
    'come faccio?',
    {
      testo:
        'Per iniziare, clicca sul pulsante "Crea il tuo account gratuito" che trovi in questa pagina. Ti chiederà la tua email, una password e il nome della tua azienda agricola.',
      terreni: [],
      fatto: false,
    },
  ],
];

describe('flag landing invariati', () => {
  it('non riaccende landing, bussata né ingresso automatico', () => {
    expect(LANDING_ATTIVA).toBe(false);
    expect(TONY_BUSSA_ATTIVO).toBe(false);
    expect(BUSSATA_AUTOMATICA_ATTIVA).toBe(false);
    expect(bussataAutomaticaConsentita({})).toBe(false);
  });
});

describe('dialogo Calanchi — conteggio e finale', () => {
  function gira() {
    const stato = statoIniziale();
    const visti = DIALOGO.map(([, domanda, modello]) => turno(stato, domanda, modello));
    return { stato, visti };
  }

  it('voce e chat coincidono a ogni turno del dialogo congelato', () => {
    const { visti } = gira();
    visti.forEach((t, i) => {
      expect(t.testoChat, DIALOGO[i][1]).toBe(t.voce);
    });
  });

  it('A: dopo Calanchi la chat dice il primo terreno e il passo è terreni', () => {
    const { stato, visti } = gira();
    const calanchi = visti[2];
    expect(calanchi.voce).toBe(calanchi.testoChat);
    expect(calanchi.testoChat).toMatch(/Dimmi il primo terreno/);
    expect(calanchi.passo).toBe('terreni');
    expect(calanchi.vaiATerreni).toBe(false);
    expect(calanchi.terreni).toEqual([]);
    expect(visti[1].terreni).toEqual([]);
    expect(visti[1].poderi).toEqual([]);
    expect(stato.dati.poderi.map((p) => p.nome)).toEqual(['Calanchi']);
  });

  it('B: il conteggio detto è i terreni con nome; il limite non scatta a quattro', () => {
    const { stato, visti } = gira();
    expect(visti[5].voce).toMatch(/ne hai due su cinque/i);
    expect(visti[5].testoChat).toMatch(/ne hai due su cinque/i);
    expect(visti[5].voce).not.toMatch(/tre su cinque/i);
    expect(visti[6].voce).toMatch(/ne hai tre su cinque/i);
    expect(visti[6].testoChat).toMatch(/ne hai tre su cinque/i);
    expect(visti[6].voce).not.toMatch(/quattro su cinque/i);

    const ciliegi = visti[7];
    const attesoCiliegi =
      'Ok, hai un terreno che si chiama Ciliegi, di tre ettari a Ciliegio. Ne hai quattro su cinque terreni. Ne hai altri o vediamo il riepilogo?';
    expect(ciliegi.voce).toBe(attesoCiliegi);
    expect(ciliegi.testoChat).toBe(attesoCiliegi);
    expect(ciliegi.voce).toMatch(/quattro su cinque/);
    expect(ciliegi.testoChat).toMatch(/quattro su cinque/);
    expect(ciliegi.voce).not.toMatch(/raggiunto il limite/i);
    expect(ciliegi.testoChat).not.toMatch(/raggiunto il limite/i);
    expect(ciliegi.voce).not.toMatch(/passando al Base/i);
    expect(ciliegi.testoChat).not.toMatch(/passando al Base/i);
    expect(ciliegi.apriRiepilogo).toBe(false);
    expect(ciliegi.terreni).toHaveLength(4);

    const righe = righeRiepilogo(stato.dati);
    expect(righe.terreni).toHaveLength(4);
    expect(righe.sede.citta).toBe('Faenza');
    expect(righe.sede.provincia).toBe('RA');
    expect(righe.sede.indirizzo).toMatch(/Monte Coralli 3/i);
    expect(righe.poderi.map((p) => p.nome)).toEqual(['Calanchi']);
    expect(righe.terreni.map((t) => t.nome)).toEqual(['Ponte', 'Prugneto', 'Discesa', 'Ciliegi']);
    expect(righe.terreni.map((t) => t.superficie)).toEqual(['12', '8', '3', '3']);
    expect(righe.terreni.map((t) => t.coltura)).toEqual([
      'Grano',
      'Prugne',
      'Albicocche',
      'Ciliegio',
    ]);
    expect(righe.terreni.every((t) => t.podere === 'Calanchi')).toBe(true);
  });

  it('dopo le prugne senza nome il raccolto avvisa che il nome non è un terreno in più', () => {
    const stato = statoIniziale();
    DIALOGO.slice(0, 5).forEach(([, domanda, modello]) => turno(stato, domanda, modello));
    const testo = serializzaRaccolti(stato.dati);
    expect(testo).toMatch(/Terreni già raccolti: 2 di 5/);
    expect(testo).toMatch(/in attesa del nome/);
    expect(testo).toMatch(/NON è un terreno in più/);
  });

  it('C: solo l’invito a creare l’account esce; app e profilo restano', () => {
    const { visti } = gira();
    const adesso = visti[8];
    expect(adesso.voce).toBe(adesso.testoChat);
    expect(adesso.voce).toMatch(/accedere all'app/i);
    expect(adesso.voce).toMatch(/iniziare a gestire la tua azienda/i);
    expect(adesso.voce).not.toMatch(/Crea il tuo account/i);
    expect(adesso.voce).not.toMatch(/registr/i);
    expect(adesso.apriRiepilogo).toBe(false);

    const come = visti[9];
    expect(come.voce).toBe(come.testoChat);
    expect(come.voce).not.toMatch(/Crea il tuo account/i);
    expect(come.voce).toBe(
      'Ti chiederà la tua email, una password e il nome della tua azienda agricola.'
    );
    expect(come.apriRiepilogo).toBe(false);

    const lecite =
      'Quando vedi il riepilogo, clicca sul pulsante «Sì, salva» per confermare. Email e password le cambi dal tuo profilo.';
    const conInvito =
      'Quando vedi il riepilogo, clicca sul pulsante «Sì, salva» per confermare. Per iniziare, clicca sul pulsante «Crea il tuo account gratuito». Email e password le cambi dal tuo profilo.';
    const statoFrasi = {
      passo: 'terreni',
      dati: {
        sede: { indirizzo: 'via Roma 1', citta: 'Faenza', provincia: 'RA' },
        poderi: [{ nome: 'Calanchi' }],
        terreni: [{ nome: 'Ponte', superficie: 12, coltura: 'Grano', podere: 'Calanchi' }],
      },
    };
    const tiene = turno(statoFrasi, 'vediamo il riepilogo', {
      testo: lecite,
      terreni: [],
      fatto: false,
    });
    expect(tiene.voce).toBe(lecite);
    expect(tiene.testoChat).toBe(lecite);
    const pulito = turno(
      {
        passo: 'terreni',
        dati: {
          sede: { indirizzo: 'via Roma 1', citta: 'Faenza', provincia: 'RA' },
          poderi: [{ nome: 'Calanchi' }],
          terreni: [{ nome: 'Ponte', superficie: 12, coltura: 'Grano', podere: 'Calanchi' }],
        },
      },
      'vediamo il riepilogo',
      { testo: conInvito, terreni: [], fatto: false }
    );
    expect(pulito.voce).toBe(lecite);
    expect(pulito.testoChat).toBe(lecite);

    const prompt = promptSistemaAccount('terreni', {
      raccolti: 'Terreni già raccolti: 4 di 5\nTerreno «Ponte»',
    });
    expect(prompt).toMatch(/già creato l'account/);
    expect(prompt).toMatch(/in attesa del nome/);
  });

  it('variante: il quinto apre il riepilogo, il sesto è respinto', () => {
    const { stato, visti } = gira();
    expect(visti[7].terreni).toHaveLength(4);
    const quinto = turno(stato, 'pozzo 2 ha a mais', {
      testo:
        'Ok, hai un terreno che si chiama Pozzo, di due ettari a Mais. Ne hai altri o vediamo il riepilogo?',
      terreni: [{ nome: 'Pozzo', superficie: 2, coltura: 'Mais', podere: 'Calanchi' }],
      fatto: true,
    });
    expect(quinto.terreni).toHaveLength(5);
    expect(quinto.apriRiepilogo).toBe(true);
    expect(quinto.testoChat).toMatch(/limite di cinque terreni/i);
    expect(quinto.testoChat).not.toMatch(/Ne hai altri/i);
    expect(quinto.troppi).toBe(false);

    const sesto = turno(stato, 'bosco 1 ha di orzo', {
      testo:
        "Con l'account gratuito arrivi a 5 terreni. Gli altri li aggiungi passando al Base, quando vuoi.",
      terreni: [{ nome: 'Bosco', superficie: 1, coltura: 'Orzo', podere: 'Calanchi' }],
      fatto: true,
    });
    expect(sesto.terreni).toHaveLength(5);
    expect(sesto.troppi).toBe(true);
    expect(sesto.apriRiepilogo).toBe(false);
    expect(sesto.terreni.some((t) => /bosco/i.test(String(t.nome || '')))).toBe(false);
    expect(sesto.testoChat).toMatch(/account gratuito/i);
    expect(sesto.testoChat).toMatch(/passando al Base/i);
  });
});

describe('si 2 — due nomi di podere prima dei terreni', () => {
  it('non passa ai terreni finché il server non chiede il primo terreno', () => {
    const stato = statoIniziale();
    turno(stato, 'via roma 1 faenza', {
      testo: 'Hai dei poderi?',
      sede: { indirizzo: 'via Roma 1', citta: 'Faenza', provincia: 'RA' },
      poderi: [],
      terreni: [],
      fatto: false,
    });
    const si2 = turno(stato, 'si 2', {
      testo: 'Dimmi il nome del primo podere.',
      poderi: [],
      terreni: [],
      fatto: false,
    });
    expect(si2.passo).toBe('poderi');
    expect(si2.terreni).toEqual([]);
    expect(si2.testoChat).toMatch(/primo podere/i);
    expect(si2.voce).toBe(si2.testoChat);

    const primo = turno(stato, 'calanchi', {
      testo: 'Ok, Calanchi. Dimmi il secondo podere.',
      poderi: [{ nome: 'Calanchi' }],
      terreni: [],
      fatto: false,
    });
    expect(primo.passo).toBe('poderi');
    expect(primo.poderi.map((p) => p.nome)).toEqual(['Calanchi']);
    expect(primo.terreni).toEqual([]);
    expect(primo.testoChat).toMatch(/secondo podere/i);
    expect(primo.testoChat).not.toMatch(/primo terreno/i);
    expect(primo.voce).toBe(primo.testoChat);

    const secondo = turno(stato, 'rio', {
      testo:
        'Ok, il podere si chiama Rio. Dimmi il primo terreno: come si chiama, quanti ettari e cosa ci coltivi?',
      poderi: [{ nome: 'Rio' }],
      terreni: [],
      fatto: false,
    });
    expect(secondo.passo).toBe('terreni');
    expect(secondo.vaiATerreni).toBe(false);
    expect(secondo.poderi.map((p) => p.nome)).toEqual(['Calanchi', 'Rio']);
    expect(secondo.terreni).toEqual([]);
    expect(secondo.testoChat).toMatch(/Dimmi il primo terreno/);
    expect(secondo.voce).toBe(secondo.testoChat);
  });
});
