/**
 * Ettari ≠ conteggio, riepilogo solo al 5°/su richiesta, informativa bloccante.
 * Varianti + dialogo Pier 10 nov 2026 come regressione.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BUSSATA_AUTOMATICA_ATTIVA,
  bussataAutomaticaConsentita,
} from '../../landing/src/lib/tony-bussa-logica.js';
import {
  correzioneIndiceTerreno,
  decidiDopoRisposta,
  domandaSulConteggioTerreni,
  messaggioSoloConteggioTerreni,
  numeroEttariDetto,
  numeroTerreniDetto,
  preparaTurnoOnboarding,
  serializzaRaccolti,
} from '../../landing/src/lib/tony-aiuto-account.js';
import { LANDING_ATTIVA, TONY_BUSSA_ATTIVO } from '../../landing/src/config/landing-config.js';

const require = createRequire(import.meta.url);
const {
  numeroTerreniDetto: numeroTerreniDettoServer,
  messaggioSoloConteggioTerreni: soloConteggioServer,
  rispostaAccountDaTesto,
  applicaNomeTerrenoDaDomanda,
} = require('../../functions/lib/tony-landing-account.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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
  const nTerreni = (stato.dati.terreni || []).filter(
    (t) => t && (t.nome || typeof t.superficie === 'number' || t.coltura)
  ).length;
  const dopo = decidiDopoRisposta({
    passo: stato.passo,
    nTerreni,
    domanda,
    turniSenzaNovitaNelPasso: 0,
    domandeRimaste: 20,
    terreni: stato.dati.terreni,
  });
  return {
    testo: client.testo != null ? client.testo : pulita.testo,
    apriRiepilogo: client.apriRiepilogo === true || dopo.apriRiepilogo === true,
    azioneDopo: dopo.azione,
    terreni: stato.dati.terreni || [],
    sede: stato.dati.sede,
    poderi: stato.dati.poderi,
  };
}

describe('flag invariati', () => {
  it('non riattiva landing/bussata/ingresso automatico', () => {
    expect(LANDING_ATTIVA).toBe(false);
    expect(TONY_BUSSA_ATTIVO).toBe(false);
    expect(BUSSATA_AUTOMATICA_ATTIVA).toBe(false);
    expect(bussataAutomaticaConsentita({})).toBe(false);
  });
});

describe('(A) numero nudo = ettari, non conteggio', () => {
  it.each([
    ['6', null],
    ['sei', null],
    ['sono 6', null],
    ['ho 6', null],
    ['cinque', null],
    ['7', null],
    ['8', null],
    ['10', null],
    ['sette', null],
    ['6 ha', null],
    ['6 ettari', null],
    ['sei ettari', null],
    ['7 terreni', 7],
    ['ne ho 8', 8],
    ['ne ho 8 terreni', 8],
    ['ce ne sono 6', 6],
    ['ho 10 terreni', 10],
    ['ho 8 campi', 8],
    ['10 appezzamenti', 10],
    ['ho 6', null],
    ['sono 6', null],
    ['Colomba 7 ha pesco', null],
  ])('numeroTerreniDetto(%j) → %j (client=server)', (inp, out) => {
    expect(numeroTerreniDetto(inp)).toBe(out);
    expect(numeroTerreniDettoServer(inp)).toBe(out);
    expect(messaggioSoloConteggioTerreni(inp)).toBe(out != null);
    expect(soloConteggioServer(inp)).toBe(out != null);
  });

  it.each([
    ['6', 6],
    ['6 ha', 6],
    ['6 ettari', 6],
    ['sei', 6],
    ['sono 6', 6],
    ['ho 6', 6],
    ['7', 7],
    ['8', 8],
    ['10', 10],
    ['sette', 7],
    ['4', 4],
    ['7 terreni', null],
    ['ne ho 8 terreni', null],
    ['ne ho 6', null],
  ])('numeroEttariDetto(%j) → %j', (inp, out) => {
    expect(numeroEttariDetto(inp)).toBe(out);
  });

  it('in attesa ettari: ne ho 6 → 6 ha; 6 terreni resta conteggio', () => {
    expect(numeroEttariDetto('ne ho 6', { inAttesaEttari: true })).toBe(6);
    expect(numeroEttariDetto('6 terreni', { inAttesaEttari: true })).toBe(null);
  });

  it.each([
    '6',
    '6 ha',
    '6 ettari',
    'sei',
    'sono 6',
    'ho 6',
    '7',
    '8',
    '10',
    'sette',
  ])('terreno in attesa ettari: %j → superficie, Ne hai altri, niente limite/primo/scheda', (inp) => {
    const stato = {
      passo: 'terreni',
      dati: {
        sede: { indirizzo: 'via monte coralli 3', citta: 'Faenza', provincia: 'RA' },
        poderi: [{ nome: 'gattona' }],
        terreni: [
          { nome: 'Discesa', superficie: 3, coltura: 'Grano' },
          { nome: 'Melograno', superficie: null, coltura: 'Melograno' },
        ],
      },
    };
    const atteso = numeroEttariDetto(inp);
    const esito = turno(stato, inp, {
      testo: "Con l'account gratuito arrivi a 5 terreni. Dimmi il primo terreno: come si chiama, quanti ettari e cosa ci coltivi?",
      terreni: [{ nome: 'Melograno', superficie: atteso, coltura: 'Melograno' }],
      fatto: false,
    });
    const melo = esito.terreni.find((t) => t.nome === 'Melograno');
    expect(melo.superficie).toBe(atteso);
    expect(melo.coltura).toBe('Melograno');
    expect(esito.testo).toMatch(/Ne hai altri o vediamo il riepilogo/i);
    expect(esito.testo).not.toMatch(/account gratuito arrivi a/i);
    expect(esito.testo).not.toMatch(/Dimmi il primo terreno/i);
    expect(esito.apriRiepilogo).toBe(false);
    expect(esito.azioneDopo).toBe('resta');
  });

  it('altro incompleto in attesa: nome+coltura, poi 4 → 4 ha', () => {
    const stato = {
      passo: 'terreni',
      dati: {
        sede: null,
        poderi: [],
        terreni: [{ nome: 'Collina', superficie: null, coltura: 'Vite da Vino' }],
      },
    };
    const esito = turno(stato, '4', {
      testo: 'Ok.',
      terreni: [{ nome: 'Collina', superficie: 4, coltura: 'Vite da Vino' }],
    });
    expect(esito.terreni).toHaveLength(1);
    expect(esito.terreni[0]).toMatchObject({
      nome: 'Collina',
      superficie: 4,
      coltura: 'Vite da Vino',
    });
    expect(esito.testo).toMatch(/Ne hai altri/i);
    expect(esito.apriRiepilogo).toBe(false);
  });

  it('conteggio esplicito a inizio (0 raccolti): 7 terreni → avviso + primo, niente scheda', () => {
    const stato = {
      passo: 'terreni',
      dati: { sede: { citta: 'Faenza' }, poderi: [], terreni: [] },
    };
    const esito = turno(stato, '7 terreni', {
      testo: 'Ok.',
      terreni: [],
      fatto: true,
    });
    expect(esito.testo).toMatch(/account gratuito arrivi a 5/i);
    expect(esito.testo).toMatch(/Dimmi il primo terreno/i);
    expect(esito.apriRiepilogo).toBe(false);
    expect(esito.terreni).toHaveLength(0);
  });

  it('conteggio esplicito con già 2 terreni: ho 10 terreni → avviso + altri, non il primo', () => {
    const stato = {
      passo: 'terreni',
      dati: {
        sede: null,
        poderi: [],
        terreni: [
          { nome: 'A', superficie: 1, coltura: 'Grano' },
          { nome: 'B', superficie: 2, coltura: 'Mais' },
        ],
      },
    };
    const esito = turno(stato, 'ho 10 terreni', {
      testo: 'Ok.',
      terreni: [],
      fatto: true,
    });
    expect(esito.testo).toMatch(/account gratuito arrivi a 5/i);
    expect(esito.testo).toMatch(/Ne hai altri/i);
    expect(esito.testo).not.toMatch(/Dimmi il primo terreno/i);
    expect(esito.apriRiepilogo).toBe(false);
  });
});

describe('(B) riepilogo solo al quinto o su richiesta', () => {
  it('domandeRimaste <= 3 nel passo terreni con N < 5 → non apre scheda', () => {
    expect(
      decidiDopoRisposta({
        domandeRimaste: 2,
        passo: 'terreni',
        nTerreni: 2,
      }).apriRiepilogo
    ).toBe(false);
  });

  it('due turni conteggio/correzione → non apre scheda', () => {
    expect(domandaSulConteggioTerreni('a quanti terreni siamo?')).toBe(true);
    expect(correzioneIndiceTerreno('dovrei dirti il terzo terreno...')).toBe(true);
    expect(
      decidiDopoRisposta({
        turniSenzaNovitaNelPasso: 2,
        fuoriTema: 0,
        domandeRimaste: 10,
        passo: 'terreni',
        nTerreni: 2,
        domanda: 'a quanti terreni siamo?',
      }).apriRiepilogo
    ).toBe(false);
    expect(
      decidiDopoRisposta({
        turniSenzaNovitaNelPasso: 2,
        fuoriTema: 2,
        domandeRimaste: 10,
        passo: 'terreni',
        nTerreni: 2,
        domanda: 'dovrei dirti il terzo terreno',
      }).apriRiepilogo
    ).toBe(false);
  });

  it('a quanti terreni siamo? con 2 → Ne hai due su cinque, niente scheda', () => {
    const stato = {
      passo: 'terreni',
      dati: {
        sede: null,
        poderi: [],
        terreni: [
          { nome: 'Discesa', superficie: 3, coltura: 'Grano' },
          { nome: 'Melograno', superficie: 6, coltura: 'Melograno' },
        ],
      },
    };
    const esito = turno(stato, 'a quanti terreni siamo?', {
      testo: 'Ne hai uno su 5.',
      terreni: [],
    });
    expect(esito.testo).toMatch(/Ne hai 2 su cinque terreni/i);
    expect(esito.testo).toMatch(/Ne hai altri/i);
    expect(esito.testo).not.toMatch(/Dimmi il primo terreno/i);
    expect(esito.apriRiepilogo).toBe(false);
  });

  it('dovrei dirti il terzo terreno → chiede il terzo, niente scheda', () => {
    const stato = {
      passo: 'terreni',
      dati: {
        sede: null,
        poderi: [],
        terreni: [
          { nome: 'Discesa', superficie: 3, coltura: 'Grano' },
          { nome: 'Melograno', superficie: 6, coltura: 'Melograno' },
        ],
      },
    };
    const esito = turno(stato, 'dovrei dirti il terzo terreno...', {
      testo: 'Facciamo così: controlla il riepilogo e completa lì.',
      terreni: [],
      fatto: true,
    });
    expect(esito.testo).toMatch(/dimmi il terzo terreno/i);
    expect(esito.testo).not.toMatch(/Facciamo così/i);
    expect(esito.apriRiepilogo).toBe(false);
  });
});

describe('(C) informativa intervista visibile e bloccante', () => {
  it('overlay evidente, senza × che accetta, blocca input/chip/mic', () => {
    const chat = fs.readFileSync(
      path.join(root, 'landing/src/components/TonyChat.vue'),
      'utf8'
    );
    expect(chat).toMatch(/font-size:\s*1rem/);
    expect(chat).toMatch(/background:\s*#fff8e8/);
    expect(chat).toMatch(/border:\s*2px solid #0f4d32/);
    expect(chat).toContain('aria-modal="true"');
    expect(chat).toContain('if (informativaAiutoVisibile.value) return');
    expect(chat).toMatch(/v-if="!informativaAiutoVisibile"/);
    expect(chat).not.toMatch(/informativa-chiudi/);
    expect(chat).toContain('onHoCapitoInformativaAiuto');
    expect(chat).toContain('ta.informativaHoCapito');
  });
});

describe('dialogo Pier 10 nov — regressione completa', () => {
  it('sede → poderi → Discesa → Melograno + 6 ha → conteggio → terzo; niente deragliamento', () => {
    const stato = {
      passo: 'sede',
      dati: { sede: null, poderi: [], terreni: [] },
    };

    let esito = turno(stato, 'via monte coralli 3 faenza', {
      testo: 'Hai dei poderi?',
      sede: { indirizzo: 'via monte coralli 3', citta: 'Faenza', provincia: 'RA', cap: null },
      poderi: [],
      terreni: [],
    });
    expect(stato.dati.sede).toMatchObject({
      indirizzo: expect.stringMatching(/monte coralli 3/i),
      citta: 'Faenza',
      provincia: 'RA',
    });
    expect(stato.dati.terreni || []).toHaveLength(0);

    stato.passo = 'poderi';
    esito = turno(stato, 'si 1', {
      testo: 'Come si chiama il podere?',
      poderi: [],
      terreni: [],
    });
    esito = turno(stato, 'gattona', {
      testo: 'Ok, Gattona. Dimmi il primo terreno.',
      poderi: [{ nome: 'gattona' }],
      terreni: [],
    });
    expect(stato.dati.poderi.some((p) => /gattona/i.test(p.nome))).toBe(true);

    stato.passo = 'terreni';
    esito = turno(stato, 'discesa 3 ha grano', {
      testo: 'Ok, un terreno Discesa di 3 ettari a Grano. Ne hai altri o vediamo il riepilogo?',
      terreni: [{ nome: 'Discesa', superficie: 3, coltura: 'Grano' }],
    });
    expect(esito.terreni[0]).toMatchObject({
      nome: 'Discesa',
      superficie: 3,
      coltura: 'Grano',
    });
    expect(esito.testo).toMatch(/Ne hai altri o vediamo il riepilogo/i);

    esito = turno(stato, 'un terreno a melograno e lo chiamiamo melograno', {
      testo: 'Quanti ettari ha?',
      terreni: [{ nome: 'Melograno', superficie: null, coltura: 'Melograno' }],
    });
    const meloIncompleto = esito.terreni.find((t) => t.nome === 'Melograno');
    expect(meloIncompleto).toMatchObject({ nome: 'Melograno', coltura: 'Melograno' });
    expect(meloIncompleto.superficie == null || meloIncompleto.superficie === null).toBe(true);
    expect(esito.apriRiepilogo).toBe(false);

    esito = turno(stato, '6', {
      testo:
        "Con l'account gratuito arrivi a 5 terreni. Dimmi il primo terreno: come si chiama, quanti ettari e cosa ci coltivi?",
      terreni: [{ nome: 'Melograno', superficie: 6, coltura: 'Melograno' }],
    });
    expect(esito.terreni.find((t) => t.nome === 'Melograno').superficie).toBe(6);
    expect(esito.testo).toMatch(/Ne hai altri o vediamo il riepilogo/i);
    expect(esito.testo).not.toMatch(/account gratuito arrivi a/i);
    expect(esito.testo).not.toMatch(/Dimmi il primo terreno/i);
    expect(esito.apriRiepilogo).toBe(false);

    esito = turno(stato, 'a quanti terreni siamo?', {
      testo: 'Ne hai uno su 5. Dimmi il primo terreno.',
      terreni: [],
    });
    expect(esito.testo).toMatch(/Ne hai 2 su cinque terreni/i);
    expect(esito.testo).not.toMatch(/Dimmi il primo terreno/i);
    expect(esito.apriRiepilogo).toBe(false);

    esito = turno(stato, 'dovrei dirti il terzo terreno...', {
      testo: 'Facciamo così: controlla il riepilogo e completa lì.',
      terreni: [],
      fatto: true,
    });
    expect(esito.testo).toMatch(/terzo terreno/i);
    expect(esito.apriRiepilogo).toBe(false);

    expect(stato.dati.sede).toMatchObject({
      indirizzo: expect.stringMatching(/monte coralli 3/i),
      citta: 'Faenza',
      provincia: 'RA',
    });
    expect(stato.dati.poderi.some((p) => /gattona/i.test(p.nome))).toBe(true);
    expect(stato.dati.terreni.find((t) => t.nome === 'Discesa')).toMatchObject({
      superficie: 3,
      coltura: 'Grano',
    });
    expect(stato.dati.terreni.find((t) => t.nome === 'Melograno')).toMatchObject({
      superficie: 6,
      coltura: 'Melograno',
    });
  });
});
