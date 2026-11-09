/**
 * Parsing/merge terreni robusto (post-prova Quercie/Melograno).
 * Varianti strutturali + dialogo esatto di Pier come regressione.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  BUSSATA_AUTOMATICA_ATTIVA,
  bussataAutomaticaConsentita,
} from '../../landing/src/lib/tony-bussa-logica.js';
import {
  interpretaFraseTerreni,
  nomeLiberoSeInAttesa,
  preparaTurnoOnboarding,
  RE_SI_CHIAMA,
  serializzaRaccolti,
  togliConnettiviFinaliNome,
  unisciDati,
} from '../../landing/src/lib/tony-aiuto-account.js';

const require = createRequire(import.meta.url);
const {
  applicaNomeTerrenoDaDomanda,
  rispostaAccountDaTesto,
  togliConnettiviFinaliNome: togliServer,
  RE_SI_CHIAMA: RE_SI_CHIAMA_SERVER,
} = require('../../functions/lib/tony-landing-account.js');

function statoPulito() {
  return {
    passo: 'terreni',
    dati: {
      sede: { citta: 'Faenza', indirizzo: 'via monte coralli 13' },
      poderi: [{ nome: 'Carisa' }],
      terreni: [],
    },
  };
}

function turno(stato, domanda, modello) {
  const raccolti = serializzaRaccolti(stato.dati);
  const grezzo = typeof modello === 'string' ? modello : JSON.stringify(modello);
  let pulita = rispostaAccountDaTesto(grezzo, {
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
  return {
    testo: client.testo != null ? client.testo : pulita.testo,
    apriRiepilogo: client.apriRiepilogo === true,
    bloccaAvanti: client.bloccaAvanti === true,
    terreni: stato.dati.terreni || [],
  };
}

describe('bussata resta spenta', () => {
  it('non riattiva ingresso automatico', () => {
    expect(BUSSATA_AUTOMATICA_ATTIVA).toBe(false);
    expect(bussataAutomaticaConsentita({})).toBe(false);
  });
});

describe('(a) pulizia nome — verbi/copule/connettivi', () => {
  it.each([
    ['quercie sono', 'quercie'],
    ['lago è', 'lago'],
    ['campo misura', 'campo'],
    ['vigna sarebbe', 'vigna'],
    ['podere ed', 'podere'],
    ['Campo A', 'Campo A'],
    ['Campo E', 'Campo E'],
  ])('togliConnettiviFinaliNome(%j) → %j (client=server)', (inp, out) => {
    expect(togliConnettiviFinaliNome(inp)).toBe(out);
    expect(togliServer(inp)).toBe(out);
  });

  it('interpretaFraseTerreni non lascia «sono»/«è»/«e» nel nome o in coltura', () => {
    expect(interpretaFraseTerreni('quercie sono 1,5 ha e cè del trebbiano')[0]).toMatchObject({
      nome: 'quercie',
      superficie: 1.5,
      varieta: 'trebbiano',
    });
    expect(interpretaFraseTerreni('lago è 3 ha')[0]).toMatchObject({
      nome: 'lago',
      superficie: 3,
      varieta: null,
    });
    expect(interpretaFraseTerreni('cimelio ,è 2.7 ha ed è grano')[0]).toMatchObject({
      nome: 'cimelio',
      superficie: 2.7,
      varieta: 'grano',
    });
  });
});

describe('(b) riconoscimento nome — forme comuni', () => {
  const forme = [
    ['si chiama Lago 3 ha mais', 'lago'],
    ['si piama Lago 3 ha mais', 'lago'],
    ['lo chiamo Lago, 3 ha mais', 'lago'],
    ['lo chiamiamo Lago 3 ha mais', 'lago'],
    ['la chiamiamo Collina 2 ha grano', 'collina'],
    ['lo chiamano Pozzo 1 ha mais', 'pozzo'],
    ['chiamalo Noceto 6 ha noci', 'noceto'],
    ['chiamiamolo Storto 5 ha vite', 'storto'],
    ['il nome è Lago 3 ha mais', 'lago'],
    ['il nome del terreno è Lago 3 ha mais', 'lago'],
    ['nome Lago 3 ha mais', 'lago'],
    ['detto Lago, 3 ha mais', 'lago'],
    ['chiamato Lago 3 ha mais', 'lago'],
    ['ho 5 ha di melograno...lo chiamiamo melograno', 'melograno'],
  ];

  it.each(forme)('%j → nome %j', (frase, nome) => {
    const letto = interpretaFraseTerreni(frase)[0];
    expect(letto.nome && letto.nome.toLowerCase()).toBe(nome);
  });

  it('RE_SI_CHIAMA allineata client/server', () => {
    expect(RE_SI_CHIAMA.source).toBe(RE_SI_CHIAMA_SERVER.source);
  });
});

describe('(c) completamento del terreno in attesa', () => {
  it('coltura→ettari→nome e inverso senza perdere dati', () => {
    const a = unisciDati(
      { terreni: [] },
      { terreni: [{ nome: null, superficie: null, coltura: 'Vite da Vino' }] },
      'terreni'
    ).dati;
    const b = unisciDati(
      a,
      { terreni: [{ nome: 'Lago', superficie: 3, coltura: null }] },
      'terreni'
    ).dati;
    expect(b.terreni).toHaveLength(1);
    expect(b.terreni[0]).toMatchObject({
      nome: 'Lago',
      superficie: 3,
      coltura: 'Vite da Vino',
    });

    const c = unisciDati(
      { terreni: [] },
      { terreni: [{ nome: 'Quercie', superficie: 1.5, coltura: null }] },
      'terreni'
    ).dati;
    const d = unisciDati(
      c,
      { terreni: [{ nome: 'Quercie', superficie: 1.5, coltura: 'Vite da Vino' }] },
      'terreni'
    ).dati;
    expect(d.terreni[0].coltura).toBe('Vite da Vino');
  });

  it('«ho un terreno a trebbiano» + «lago è 3 ha» → un solo terreno', () => {
    const stato = statoPulito();
    turno(stato, 'ho un terreno a trebbiano', {
      testo: 'Come si chiama? Quanti ettari?',
      terreni: [{ nome: null, superficie: null, coltura: 'Vite da Vino' }],
    });
    expect(stato.dati.terreni).toHaveLength(1);
    const lago = turno(stato, 'lago è 3 ha', {
      testo: 'Ok, Lago.',
      terreni: [{ nome: 'Lago è', superficie: 3, coltura: 'È' }],
    });
    expect(lago.terreni).toHaveLength(1);
    expect(lago.terreni[0]).toMatchObject({
      nome: 'Lago',
      superficie: 3,
      coltura: 'Vite da Vino',
    });
  });
});

describe('(d) coltura di messaggio nuovo ≠ terreno precedente nominato', () => {
  it('Lago 3 ha senza coltura + 5 ha melograno → Melograno sul nuovo', () => {
    const base = unisciDati(
      { terreni: [] },
      { terreni: [{ nome: 'Lago', superficie: 3, coltura: null }] },
      'terreni'
    ).dati;
    const dopo = unisciDati(
      base,
      { terreni: [{ nome: null, superficie: 5, coltura: 'Melograno' }] },
      'terreni'
    ).dati;
    expect(dopo.terreni).toHaveLength(2);
    expect(dopo.terreni.find((t) => t.nome === 'Lago').coltura).toBeFalsy();
    expect(dopo.terreni.find((t) => t.superficie === 5).coltura).toBe('Melograno');
  });
});

describe('(e) domanda esplicita sul nome → risposta breve anche se coltura', () => {
  it('«melograno» dopo Come si chiama → nome Melograno, niente loop', () => {
    expect(
      nomeLiberoSeInAttesa('melograno', [
        { nome: null, superficie: 5, coltura: 'Melograno' },
      ])
    ).toBe('melograno');

    const stato = statoPulito();
    stato.dati.terreni = [
      { nome: null, superficie: 5, coltura: 'Melograno', nomeChiesto: true },
    ];
    const esito = turno(stato, 'melograno', {
      testo: 'Come si chiama il terreno da 5 ettari di Melograno?',
      terreni: [{ nome: null, superficie: 5, coltura: 'Melograno' }],
    });
    expect(esito.terreni[0].nome).toBe('Melograno');
    expect(esito.testo || '').not.toMatch(/Come si chiama/i);
  });

  it('con più pendenti disambigua per coltura omonima', () => {
    expect(
      nomeLiberoSeInAttesa('melograno', [
        { nome: null, superficie: 3, coltura: 'Vite da Vino' },
        { nome: null, superficie: 5, coltura: 'Melograno' },
      ])
    ).toBe('melograno');
  });
});

describe('(f) non ripetere la stessa domanda nome', () => {
  it('seconda risposta inutile → prosegui con nome vuoto', () => {
    const stato = statoPulito();
    const primo = turno(stato, 'ho 5 ha di melograno', {
      testo: 'Come si chiama?',
      terreni: [{ nome: null, superficie: 5, coltura: 'Melograno' }],
    });
    expect(primo.testo).toMatch(/Come si chiama/i);
    expect(stato.dati.terreni[0].nomeChiesto).toBe(true);

    const secondo = turno(stato, 'boh non so', {
      testo: 'Come si chiama il terreno da 5 ettari di Melograno?',
      terreni: [{ nome: null, superficie: 5, coltura: 'Melograno' }],
    });
    expect(secondo.testo || '').not.toMatch(/Come si chiama/i);
    expect(secondo.terreni[0].nome).toBeFalsy();
    expect(secondo.bloccaAvanti).toBe(false);
  });

  it('nuovo terreno completo mentre uno aspetta il nome → entrambi presenti', () => {
    const stato = statoPulito();
    turno(stato, 'ho 5 ha di melograno', {
      testo: 'Come si chiama?',
      terreni: [{ nome: null, superficie: 5, coltura: 'Melograno' }],
    });
    const dopo = turno(stato, 'ho 4 ha di sangiovese che si chiama discesona', {
      testo: 'Ok, Discesona.',
      terreni: [{ nome: 'Discesona', superficie: 4, coltura: 'Vite da Vino' }],
    });
    expect(dopo.terreni).toHaveLength(2);
    expect(dopo.terreni.map((t) => t.nome).filter(Boolean)).toContain('Discesona');
    expect(dopo.terreni.some((t) => t.superficie === 5 && !t.nome)).toBe(true);
  });
});

describe('varianti decimali e unità', () => {
  it.each([
    ['campo 1,5 ha mais', 1.5],
    ['campo 1.5 ha mais', 1.5],
    ['campo 2 ettari grano', 2],
    ['campo 1 ettaro mais', 1],
  ])('%j → superficie %s', (frase, sup) => {
    expect(interpretaFraseTerreni(frase)[0].superficie).toBe(sup);
  });
});

describe('dialogo esatto Pier — regressione Quercie/Melograno', () => {
  it('tabella attesa: Quercie Lago Cimelio Melograno Discesona', () => {
    const stato = statoPulito();

    turno(stato, 'quercie sono 1,5 ha e cè del trebbiano', {
      testo: 'Ok, Quercie.',
      terreni: [{ nome: 'Quercie sono', superficie: 1.5, coltura: 'Vite da Vino' }],
    });
    expect(stato.dati.terreni[0].nome).toBe('Quercie');
    expect(stato.dati.terreni[0].coltura).toBe('Vite da Vino');

    turno(stato, 'ho un terreno a trebbiano', {
      testo: 'Come si chiama? Quanti ettari?',
      terreni: [{ nome: null, superficie: null, coltura: 'Vite da Vino' }],
    });

    turno(stato, 'lago è 3 ha', {
      testo: 'Ok, Lago. Ne hai due su 5.',
      terreni: [{ nome: 'Lago è', superficie: 3, coltura: 'È' }],
    });
    expect(stato.dati.terreni).toHaveLength(2);
    expect(stato.dati.terreni[1] || stato.dati.terreni.find((t) => t.superficie === 3)).toMatchObject({
      nome: 'Lago',
      superficie: 3,
      coltura: 'Vite da Vino',
    });

    turno(stato, 'ho un terreno che si chiama cimelio ,è 2.7 ha ed è grano', {
      testo: 'Ok, Cimelio.',
      terreni: [{ nome: 'Cimelio', superficie: 2.7, coltura: 'Grano' }],
    });
    expect(stato.dati.terreni.find((t) => t.superficie === 2.7)).toMatchObject({
      nome: 'Cimelio',
      coltura: 'Grano',
    });

    turno(stato, 'ho 5 ha di melograno...lo chiamiamo melograno', {
      testo: 'Ok, Melograno.',
      terreni: [{ nome: null, superficie: 5, coltura: 'Melograno' }],
    });
    const melo = stato.dati.terreni.find((t) => t.superficie === 5);
    expect(melo.nome).toBe('Melograno');
    expect(melo.coltura).toBe('Melograno');
    // Lago non eredita Melograno
    expect(stato.dati.terreni.find((t) => t.nome === 'Lago').coltura).toBe('Vite da Vino');

    const quinto = turno(stato, 'ho 4 ha di sangiovese che si chiama discesona', {
      testo: 'Ok, Discesona. Ne hai cinque su 5. Ne hai altri o vediamo il riepilogo?',
      terreni: [{ nome: 'Discesona', superficie: 4, coltura: 'Vite da Vino' }],
    });
    expect(quinto.terreni).toHaveLength(5);
    expect(quinto.apriRiepilogo).toBe(true);
    expect(quinto.testo).not.toMatch(/Ne hai altri/i);

    const bySup = Object.fromEntries(
      quinto.terreni.map((t) => [String(t.superficie), t])
    );
    expect(bySup['1.5']).toMatchObject({ nome: 'Quercie', coltura: 'Vite da Vino' });
    expect(bySup['3']).toMatchObject({ nome: 'Lago', coltura: 'Vite da Vino' });
    expect(bySup['2.7']).toMatchObject({ nome: 'Cimelio', coltura: 'Grano' });
    expect(bySup['5']).toMatchObject({ nome: 'Melograno', coltura: 'Melograno' });
    expect(bySup['4']).toMatchObject({ nome: 'Discesona', coltura: 'Vite da Vino' });
  });
});
