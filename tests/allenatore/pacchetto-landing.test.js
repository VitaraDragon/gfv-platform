/**
 * Primo pacchetto dell'allenatore: intervista account sulla landing.
 *
 * Un pacchetto è situazioni + varianti di frase + esito strutturato + dialoghi
 * congelati. Gira con Vitest (niente voce, niente browser, niente motore di eval).
 *
 * Come congelare un dialogo che Pier incolla dopo un ritest
 * ---------------------------------------------------------
 * 1. Incolla i turni (frase utente, cosa Tony doveva rispondere, esito dei campi).
 * 2. Aggiungi uno `it` che esegue la sequenza con `turno()` e asserisce lo stato
 *    (sede, poderi, terreni), il prossimo passo, se il riepilogo si apre, i testi
 *    che devono comparire e quelli che non devono.
 * 3. Se il ritest ha trovato un buco, aggiungi anche varianti dello stesso intento
 *    (frase pulita, refuso, fuori tema, errore dell'utente), non solo la trascrizione.
 * 4. Non allentare le asserzioni dei dialoghi già verdi per far passare il caso nuovo.
 * 5. Il test non dichiara che voce o browser siano verificati: la conferma vera
 *    resta la prova di Pier sul canale, soprattutto a voce, sui pochi percorsi d'oro.
 *
 * I 57 casi della PR #377 restano in
 * tests/landing/landing-ettari-non-conteggio-informativa.test.js (stesso `turno()`).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { turno } from './turno-intervista.js';
import {
  BUSSATA_AUTOMATICA_ATTIVA,
  bussataAutomaticaConsentita,
} from '../../landing/src/lib/tony-bussa-logica.js';
import {
  domandaDiRientro,
  interpretaFraseTerreni,
  messaggioSoloConteggioTerreni,
  normalizzaColturaCatalogo,
  numeroEttariDetto,
  numeroTerreniDetto,
  righeRiepilogo,
} from '../../landing/src/lib/tony-aiuto-account.js';
import { MESSAGGI_CHAT, testoVisibileAccount } from '../../landing/src/lib/tony-chat-logica.js';
import { LANDING_ATTIVA, TONY_BUSSA_ATTIVO } from '../../landing/src/config/landing-config.js';
import { testiLanding } from '../../landing/src/content/testi-landing.js';

const require = createRequire(import.meta.url);
const {
  numeroTerreniDetto: numeroTerreniDettoServer,
  messaggioSoloConteggioTerreni: soloConteggioServer,
  sembraIndirizzo: sembraIndirizzoServer,
  promptSistemaAccount,
  risolviColturaConSinonimi,
} = require('../../functions/lib/tony-landing-account.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SEDE_FAENZA = {
  indirizzo: 'via monte coralli 3',
  citta: 'Faenza',
  provincia: 'RA',
  cap: null,
};

const TESTO_LEGALE_INFORMATIVA =
  "Le risposte a Tony passano da Google (Gemini) e, se usi la voce, da ElevenLabs. Le salviamo nel tuo account solo quando confermi il riepilogo. Dettagli nell'Informativa privacy.";

function statoEttari() {
  return {
    passo: 'terreni',
    dati: {
      sede: Object.assign({}, SEDE_FAENZA),
      poderi: [{ nome: 'gattona' }],
      terreni: [
        { nome: 'Discesa', superficie: 3, coltura: 'Grano' },
        { nome: 'Melograno', superficie: null, coltura: 'Melograno' },
      ],
    },
  };
}

function statoTerreni(terreni) {
  return {
    passo: 'terreni',
    dati: {
      sede: Object.assign({}, SEDE_FAENZA),
      poderi: [{ nome: 'gattona' }],
      terreni: terreni,
    },
  };
}

function dueCompleti() {
  return statoTerreni([
    { nome: 'Discesa', superficie: 3, coltura: 'Grano' },
    { nome: 'Melograno', superficie: 6, coltura: 'Melograno' },
  ]);
}

describe('flag e ingresso: solo al clic, bussata spenta', () => {
  it('LANDING_ATTIVA e TONY_BUSSA_ATTIVO restano false', () => {
    expect(LANDING_ATTIVA).toBe(false);
    expect(TONY_BUSSA_ATTIVO).toBe(false);
    expect(BUSSATA_AUTOMATICA_ATTIVA).toBe(false);
    expect(bussataAutomaticaConsentita({})).toBe(false);
    expect(testiLanding.hero.ctaPrincipale).toBe('Vuoi provare GFV?');
    const home = fs.readFileSync(path.join(root, 'landing/src/views/LandingHome.vue'), 'utf8');
    expect(home).toContain('onVuoiProvare');
    expect(home).toMatch(/if\s*\(\s*BUSSATA_AUTOMATICA_ATTIVA\s*\)/);
  });
});

describe('informativa visibile e bloccante, testo legale invariato', () => {
  it('senza «Ho capito, chiedi» non si prosegue quando il riquadro è visibile; il passo invito no', () => {
    expect(testiLanding.tonyBussa.aiuto.informativa).toBe(TESTO_LEGALE_INFORMATIVA);
    expect(testiLanding.tonyBussa.aiuto.informativaHoCapito).toBe('Ho capito, chiedi');
    const chat = fs.readFileSync(path.join(root, 'landing/src/components/TonyChat.vue'), 'utf8');
    expect(chat).toContain('aria-modal="true"');
    expect(chat).toContain('informativaBloccante');
    expect(chat).toMatch(
      /faseAiuto\.value &&\s*informativaAiutoVisibile\.value &&\s*passoAiuto\.value !== 'invito'/
    );
    expect(chat).toContain('if (informativaBloccante.value) return');
    expect(chat).toMatch(/v-if="!informativaBloccante"/);
    expect(chat).toMatch(/v-if="faseAiuto && informativaAiutoVisibile"/);
    expect(chat).not.toMatch(/informativa-chiudi/);
    expect(chat).toContain('onHoCapitoInformativaAiuto');
    expect(chat).toContain('ta.informativaHoCapito');
    expect(chat).toMatch(/background:\s*#fff8e8/);
  });
});

describe('ettari in attesa: nudo, in parole, refuso etari, anche > 5', () => {
  it.each([
    ['6', 6],
    ['6 ha', 6],
    ['6 ettari', 6],
    ['6 etari', 6],
    ['sei', 6],
    ['sei ettari', 6],
    ['sei etari', 6],
    ['sono 6', 6],
    ['ho 6', 6],
    ['7', 7],
    ['8', 8],
    ['10', 10],
    ['11', 11],
    ['sette', 7],
  ])('%j → %i ha su Melograno, niente limite/primo/scheda', (inp, atteso) => {
    expect(numeroTerreniDetto(inp)).toBe(null);
    expect(numeroTerreniDettoServer(inp)).toBe(null);
    expect(numeroEttariDetto(inp, { inAttesaEttari: true })).toBe(atteso);
    const stato = statoEttari();
    const esito = turno(stato, inp, {
      testo:
        "Con l'account gratuito arrivi a 5 terreni. Dimmi il primo terreno: come si chiama, quanti ettari e cosa ci coltivi?",
      terreni: [{ nome: 'Melograno', superficie: atteso, coltura: 'Melograno' }],
      fatto: false,
    });
    expect(esito.terreni.find((t) => t.nome === 'Melograno')).toMatchObject({
      superficie: atteso,
      coltura: 'Melograno',
    });
    expect(esito.terreni.find((t) => t.nome === 'Discesa')).toMatchObject({
      superficie: 3,
      coltura: 'Grano',
    });
    expect(esito.testo).toMatch(/Ne hai altri o vediamo il riepilogo/i);
    expect(esito.testo).not.toMatch(/account gratuito arrivi a/i);
    expect(esito.testo).not.toMatch(/Dimmi il primo terreno/i);
    expect(esito.apriRiepilogo).toBe(false);
  });
});

describe('conteggio esplicito, anche con refuso sulla parola terreni', () => {
  it.each([
    ['7 terreni', 7],
    ['ne ho 8', 8],
    ['ce ne sono 6', 6],
    ["ce n'è 4", 4],
    ['ce n\u2019è 4', 4],
    ['ho 8 campi', 8],
    ['10 appezzamenti', 10],
    ['7 tereni', 7],
    ['8 terenri', 8],
    ['9 terrni', 9],
  ])('numeroTerreniDetto(%j) → %i (client=server)', (inp, out) => {
    expect(numeroTerreniDetto(inp)).toBe(out);
    expect(numeroTerreniDettoServer(inp)).toBe(out);
    expect(messaggioSoloConteggioTerreni(inp)).toBe(true);
    expect(soloConteggioServer(inp)).toBe(true);
    expect(numeroEttariDetto(inp)).toBe(null);
  });

  it.each([
    ['7 terreni', true],
    ['ne ho 8', true],
    ['ce ne sono 6', true],
    ['ho 8 campi', true],
    ['10 appezzamenti', true],
    ['7 tereni', true],
    ["ce n'è 4", false],
  ])('0 raccolti, %j: primo terreno, avviso solo se > 5, niente scheda', (inp, avviso) => {
    const stato = statoTerreni([]);
    const esito = turno(stato, inp, { testo: 'Ok.', terreni: [], fatto: true });
    expect(esito.terreni).toHaveLength(0);
    expect(esito.testo).toMatch(/Dimmi il primo terreno/i);
    expect(esito.apriRiepilogo).toBe(false);
    if (avviso) expect(esito.testo).toMatch(/account gratuito arrivi a 5/i);
    else expect(esito.testo).not.toMatch(/account gratuito arrivi a/i);
  });

  it.each(['ho 8 campi', '7 tereni', '10 appezzamenti'])(
    'già 2 terreni, %j: avviso e «Ne hai altri», non il primo',
    (inp) => {
      const stato = dueCompleti();
      const esito = turno(stato, inp, { testo: 'Ok.', terreni: [], fatto: true });
      expect(esito.terreni).toHaveLength(2);
      expect(esito.testo).toMatch(/account gratuito arrivi a 5/i);
      expect(esito.testo).toMatch(/Ne hai altri/i);
      expect(esito.testo).not.toMatch(/Dimmi il primo terreno/i);
      expect(esito.apriRiepilogo).toBe(false);
    }
  );
});

describe('sede che sembra un campo', () => {
  it.each([
    'via monte coralli 3 faenza',
    'via monte corali 3 faenza',
    'v.le monte coralli 3 faenza',
  ])('%j resta sede Faenza/RA, non un terreno', (inp) => {
    expect(sembraIndirizzoServer(inp)).toBe(true);
    const stato = { passo: 'sede', dati: { sede: null, poderi: [], terreni: [] } };
    const esito = turno(stato, inp, {
      testo: 'Hai dei poderi?',
      sede: Object.assign({}, SEDE_FAENZA),
      poderi: [],
      terreni: [{ nome: 'Coralli', superficie: 3, coltura: 'Grano' }],
    });
    expect(esito.sede).toMatchObject({
      indirizzo: expect.stringMatching(/monte coralli 3/i),
      citta: 'Faenza',
      provincia: 'RA',
    });
    expect(esito.sede.cap == null || esito.sede.cap === '').toBe(true);
    expect(esito.terreni).toHaveLength(0);
    expect(esito.apriRiepilogo).toBe(false);
  });

  it.each(['monte coralli 3', 'coralli 3 faenza'])(
    '%j è ambiguo: Tony chiede la sede e non inventa',
    (inp) => {
      const stato = { passo: 'sede', dati: { sede: null, poderi: [], terreni: [] } };
      const esito = turno(stato, inp, {
        testo: 'Ho segnato la sede e un terreno Coralli.',
        sede: Object.assign({}, SEDE_FAENZA),
        terreni: [{ nome: 'Coralli', superficie: 3, coltura: 'Grano' }],
        fatto: true,
      });
      expect(esito.sede == null).toBe(true);
      expect(esito.terreni).toHaveLength(0);
      expect(esito.testo).toBe(testiLanding.tonyBussa.aiuto.domandaSede);
      expect(esito.apriRiepilogo).toBe(false);
    }
  );
});

describe('nome che coincide con la coltura', () => {
  it('entrambi detti senza refuso: nome e coltura Melograno', () => {
    const stato = statoTerreni([{ nome: 'Discesa', superficie: 3, coltura: 'Grano' }]);
    const esito = turno(stato, 'un terreno a melograno e lo chiamiamo melograno', {
      testo: 'Quanti ettari ha?',
      terreni: [{ nome: 'Melograno', superficie: null, coltura: 'Melograno' }],
    });
    const melo = esito.terreni.find((t) => t.nome === 'Melograno');
    expect(melo).toMatchObject({ nome: 'Melograno', coltura: 'Melograno' });
    expect(melo.superficie == null).toBe(true);
    expect(esito.apriRiepilogo).toBe(false);
    expect(esito.testo).not.toMatch(/Dimmi il primo terreno/i);
  });

  it('entrambi detti con refuso: il nome resta come detto, la coltura è il catalogo', () => {
    const stato = statoTerreni([{ nome: 'Discesa', superficie: 3, coltura: 'Grano' }]);
    const esito = turno(stato, 'un terreno a melogrno e si ciama melogrno', {
      testo: 'Quanti ettari ha?',
      terreni: [{ nome: 'melogrno', superficie: null, coltura: 'melogrno' }],
    });
    const melo = esito.terreni.find((t) => t.coltura === 'Melograno' && t.nome !== 'Discesa');
    expect(melo).toMatchObject({ nome: 'Melogrno', coltura: 'Melograno' });
    expect(melo.superficie == null).toBe(true);
    expect(esito.testo).toMatch(/Quanti ettari ha/i);
    expect(esito.apriRiepilogo).toBe(false);
    expect(esito.testo).not.toMatch(/Dimmi il primo terreno/i);
  });

  it('Prugneto e prugne restano distinti', () => {
    const stato = statoTerreni([]);
    const esito = turno(stato, 'prugneto 8 ha prugne', {
      testo: 'Ok.',
      terreni: [{ nome: 'prugneto', superficie: 8, coltura: 'Prugne' }],
    });
    expect(esito.terreni[0]).toMatchObject({
      nome: 'Prugneto',
      superficie: 8,
      coltura: 'Prugne',
    });
    expect(esito.apriRiepilogo).toBe(false);
  });

  it('manca il nome: chiede, tiene gli ettari e la coltura, non apre la scheda', () => {
    const stato = statoTerreni([]);
    const esito = turno(stato, '8 ha di prugne', {
      testo: 'Ok, un terreno Prugne di 8 ettari a Prugne.',
      terreni: [{ nome: 'Prugne', superficie: 8, coltura: 'Prugne' }],
    });
    expect(esito.terreni).toHaveLength(1);
    expect(esito.terreni[0].superficie).toBe(8);
    expect(esito.terreni[0].coltura).toBe('Prugne');
    expect(esito.terreni[0].nome == null || esito.terreni[0].nome === '').toBe(true);
    expect(esito.testo).toMatch(/come si chiama/i);
    expect(esito.apriRiepilogo).toBe(false);
  });

  it('risposta breve al nome, anche se è una coltura', () => {
    const stato = statoTerreni([
      { nome: null, superficie: 8, coltura: 'Prugne', nomeChiesto: true },
    ]);
    const esito = turno(stato, 'prugneto', {
      testo: 'Come si chiama questo terreno?',
      terreni: [{ nome: 'prugneto', superficie: 8, coltura: 'Prugne' }],
    });
    expect(esito.terreni[0]).toMatchObject({
      nome: 'Prugneto',
      superficie: 8,
      coltura: 'Prugne',
    });
    expect(esito.apriRiepilogo).toBe(false);
  });
});

describe('fuori tema a metà intervista', () => {
  it.each([
    ['che tempo fa?', 'Quanti ettari ha?'],
    ['quanto costa?', 'Quanti ettari ha?'],
    ['bella giornata', 'Quanti ettari ha?'],
  ])('%j mentre mancano gli ettari: ripete la domanda, non butta i dati', (inp, atteso) => {
    const stato = statoEttari();
    const esito = turno(stato, inp, {
      testo: 'Facciamo così: controlla il riepilogo e completa lì.',
      terreni: [],
      fatto: true,
      fuoriTema: true,
    });
    expect(esito.testo).toBe(atteso);
    expect(esito.apriRiepilogo).toBe(false);
    expect(esito.testo).not.toMatch(/Facciamo così/i);
    expect(esito.terreni.find((t) => t.nome === 'Discesa')).toMatchObject({
      superficie: 3,
      coltura: 'Grano',
    });
    expect(esito.terreni.find((t) => t.nome === 'Melograno').superficie == null).toBe(true);
  });

  it('chiacchiera con i terreni già raccolti: torna sul binario, scheda chiusa', () => {
    const stato = dueCompleti();
    const esito = turno(stato, 'come stai?', {
      testo: 'Facciamo così: controlla il riepilogo e completa lì.',
      terreni: [],
      fatto: true,
      fuoriTema: true,
    });
    expect(esito.testo).toMatch(/Ne hai altri o vediamo il riepilogo/i);
    expect(esito.apriRiepilogo).toBe(false);
    expect(esito.terreni).toHaveLength(2);
  });
});

describe('errore o correzione dell’utente', () => {
  it.each(['a quanti terreni siamo?', 'quanti ne ho?', 'siamo al terzo?', 'a quanti tereni siamo?'])(
    '%j con 2 terreni: N esatto, non il primo, scheda chiusa',
    (inp) => {
      const stato = dueCompleti();
      const esito = turno(stato, inp, {
        testo: 'Ne hai uno su 5. Dimmi il primo terreno.',
        terreni: [],
      });
      expect(esito.testo).toMatch(/Ne hai 2 su cinque terreni/i);
      expect(esito.testo).not.toMatch(/Dimmi il primo terreno/i);
      expect(esito.apriRiepilogo).toBe(false);
      expect(esito.terreni).toHaveLength(2);
    }
  );

  it.each(['dovrei dirti il terzo terreno...', 'dovrei dirti il terzo tereno'])(
    '%j chiede il terzo, non apre la scheda',
    (inp) => {
      const stato = dueCompleti();
      const esito = turno(stato, inp, {
        testo: 'Facciamo così: controlla il riepilogo e completa lì.',
        terreni: [],
        fatto: true,
      });
      expect(esito.testo).toMatch(/dimmi il terzo terreno/i);
      expect(esito.testo).not.toMatch(/Facciamo così/i);
      expect(esito.apriRiepilogo).toBe(false);
    }
  );

  it('solo il nome del prossimo terreno: non riparte dal primo', () => {
    const stato = dueCompleti();
    const esito = turno(stato, 'collina', {
      testo: 'Dimmi il primo terreno: come si chiama, quanti ettari e cosa ci coltivi?',
      terreni: [{ nome: 'Collina', superficie: null, coltura: null }],
      fatto: true,
    });
    expect(esito.terreni.find((t) => t.nome === 'Collina')).toBeTruthy();
    expect(esito.terreni.find((t) => t.nome === 'Discesa')).toBeTruthy();
    expect(esito.testo).toMatch(/Quanti ettari ha/i);
    expect(esito.testo).not.toMatch(/Dimmi il primo terreno/i);
    expect(esito.apriRiepilogo).toBe(false);
  });
});

describe('quinto terreno completo', () => {
  it('avviso del limite e scheda, niente «Ne hai altri?»', () => {
    const stato = statoTerreni([
      { nome: 'Discesa', superficie: 3, coltura: 'Grano' },
      { nome: 'Collina', superficie: 2, coltura: 'Mais' },
      { nome: 'Lago', superficie: 1, coltura: 'Orzo' },
      { nome: 'Cimelio', superficie: 4, coltura: 'Pesco' },
    ]);
    const esito = turno(stato, 'salamandra 7 ha noci', {
      testo: 'Ne hai altri o vediamo il riepilogo?',
      terreni: [{ nome: 'Salamandra', superficie: 7, coltura: 'Noce' }],
    });
    expect(esito.terreni).toHaveLength(5);
    expect(esito.terreni.find((t) => t.nome === 'Salamandra')).toMatchObject({
      superficie: 7,
      coltura: 'Noce',
    });
    expect(esito.apriRiepilogo).toBe(true);
    expect(esito.testo).toMatch(/limite di cinque terreni/i);
    expect(esito.testo).not.toMatch(/Ne hai altri/i);
  });
});

describe('dialogo congelato — ritest Pier 10 nov 2026', () => {
  it('sede, poderi, Discesa, Melograno + 6, conteggio, terzo; scheda solo se chiesta', () => {
    const stato = {
      passo: 'sede',
      dati: { sede: null, poderi: [], terreni: [] },
    };

    let esito = turno(stato, 'via monte coralli 3 faenza', {
      testo: 'Hai dei poderi?',
      sede: Object.assign({}, SEDE_FAENZA),
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
    expect(esito.apriRiepilogo).toBe(false);

    esito = turno(stato, 'un terreno a melograno e lo chiamiamo melograno', {
      testo: 'Quanti ettari ha?',
      terreni: [{ nome: 'Melograno', superficie: null, coltura: 'Melograno' }],
    });
    expect(esito.terreni.find((t) => t.nome === 'Melograno')).toMatchObject({
      nome: 'Melograno',
      coltura: 'Melograno',
    });
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

    esito = turno(stato, 'riepilogo', {
      testo: 'Ecco il riepilogo: controlla e conferma',
      terreni: [],
      fatto: true,
    });
    expect(esito.apriRiepilogo).toBe(true);
    expect(esito.chiedeRiepilogo).toBe(true);
    const righe = righeRiepilogo(stato.dati);
    expect(righe.sede.citta).toBe('Faenza');
    expect(righe.sede.provincia).toBe('RA');
    expect(righe.sede.indirizzo).toMatch(/monte coralli 3/i);
    expect(righe.sede.cap === '' || righe.sede.cap == null).toBe(true);
    expect(righe.poderi.some((p) => /gattona/i.test(p.nome))).toBe(true);
    const discesa = righe.terreni.find((t) => t.nome === 'Discesa');
    const melo = righe.terreni.find((t) => t.nome === 'Melograno');
    expect(discesa).toMatchObject({ superficie: '3', coltura: 'Grano' });
    expect(melo).toMatchObject({ superficie: '6', coltura: 'Melograno' });
  });
});

describe('sede senza la parola via', () => {
  const RIFIUTO = {
    testo: 'Non ho capito bene. Riprova con via e comune.',
    sede: null,
    poderi: [],
    terreni: [{ nome: 'Casale', superficie: 12, coltura: 'Grano' }],
    fatto: true,
  };

  function accetta(inp, modello) {
    const stato = { passo: 'sede', dati: { sede: null, poderi: [], terreni: [] } };
    const esito = turno(stato, inp, modello || RIFIUTO);
    expect(esito.voce, inp).toBe(esito.testo);
    expect(esito.terreni, inp).toHaveLength(0);
    expect(esito.apriRiepilogo, inp).toBe(false);
    if (/\d/.test(inp)) {
      expect(esito.passo, inp).toBe('poderi');
    } else {
      expect(esito.passo, inp).toBe('sede');
      expect(esito.testo, inp).toBe("Il numero civico, se ce l'hai, dimmelo pure.");
      expect(esito.testo, inp).not.toMatch(/poder/i);
    }
    expect(esito.testo, inp).not.toBe(testiLanding.tonyBussa.aiuto.domandaSede);
    expect(esito.testo, inp).not.toMatch(/riprova con via/i);
    expect(esito.sede == null, inp).toBe(false);
    expect(esito.sede.cap == null || esito.sede.cap === '', inp).toBe(true);
    return esito;
  }

  it('il prompt non richiede la parola via e non inventa il CAP', () => {
    const prompt = promptSistemaAccount('sede', { raccolti: '' });
    expect(prompt).toMatch(/senza la parola/);
    expect(prompt).toMatch(/non inventarlo/);
    expect(prompt).toMatch(/unico CAP/);
  });

  it.each(['località Casale 12', 'strada Granarolo 5'])(
    '%j si accetta, non è un terreno, e il civico c’è già',
    (inp) => {
      const esito = accetta(inp);
      expect(esito.sede.indirizzo).toBe(inp);
      expect(esito.testo).not.toMatch(/numero civico/i);
      expect(esito.testo).toMatch(/Hai dei poderi/i);
    }
  );

  it('podere Sasso, Brisighella è la sede, non un podere e non un terreno', () => {
    const esito = accetta('podere Sasso, Brisighella', {
      testo: 'Non ho capito bene. Riprova con via e comune.',
      sede: null,
      poderi: [{ nome: 'Sasso' }],
      terreni: [{ nome: 'Sasso', superficie: 1, coltura: 'Grano' }],
      fatto: true,
    });
    expect(esito.sede).toMatchObject({
      indirizzo: 'podere Sasso',
      citta: 'Brisighella',
      provincia: null,
    });
    expect(esito.poderi || []).toHaveLength(0);
    expect(esito.testo.match(/numero civico/gi)).toHaveLength(1);
  });

  it('Faenza, RA e il solo comune si accettano; il civico si chiede una volta e si resta sulla sede', () => {
    const faenza = accetta('Faenza, RA');
    expect(faenza.sede).toMatchObject({ citta: 'Faenza', provincia: 'RA', indirizzo: null });
    expect(faenza.testo).toBe("Il numero civico, se ce l'hai, dimmelo pure.");
    expect(faenza.testo).not.toMatch(/poder/i);

    const stato = { passo: 'sede', dati: { sede: null, poderi: [], terreni: [] } };
    const solo = turno(stato, 'Brisighella', RIFIUTO);
    expect(solo.voce).toBe(solo.testo);
    expect(solo.sede).toMatchObject({ citta: 'Brisighella', indirizzo: null });
    expect(solo.sede.cap == null || solo.sede.cap === '').toBe(true);
    expect(solo.terreni).toHaveLength(0);
    expect(solo.passo).toBe('sede');
    expect(solo.testo).toBe("Il numero civico, se ce l'hai, dimmelo pure.");

    const salta = turno(stato, "non ce l'ho", {
      testo: 'Ok, andiamo ai poderi.',
      poderi: [],
      terreni: [],
    });
    expect(salta.voce).toBe(salta.testo);
    expect(salta.testo).toBe('Hai uno o più poderi? Dimmi come li chiami.');
    expect(salta.passo).toBe('poderi');
    expect(salta.testo.match(/poderi/gi)).toHaveLength(1);

    const dopo = turno(stato, 'calanchi', {
      testo: 'Ok, Calanchi. Dimmi il primo terreno.',
      poderi: [{ nome: 'Calanchi' }],
      terreni: [],
    });
    expect(dopo.testo).not.toMatch(/numero civico/i);
    expect(dopo.testo).toMatch(/Dimmi il primo terreno/);
    expect(dopo.passo).toBe('terreni');
  });

  it('un CAP già vuoto resta vuoto anche se il modello non lo manda', () => {
    const esito = accetta('Faenza', {
      testo: 'Ok. Hai dei poderi?',
      sede: { indirizzo: null, citta: 'Faenza', cap: null, provincia: 'RA' },
      poderi: [],
      terreni: [],
    });
    expect(esito.sede.cap == null || esito.sede.cap === '').toBe(true);
    expect(esito.sede.citta).toBe('Faenza');
    expect(esito.testo.match(/numero civico/gi)).toHaveLength(1);
  });
});

describe('dialogo congelato — ritest Calanchi 10 nov 2026, dopo la #380', () => {
  const DIALOGO = [
    [
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
      'si 1',
      {
        testo: 'Dimmi il nome del podere.',
        poderi: [],
        terreni: [],
        fatto: false,
      },
    ],
    [
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
      'si chiama ponte è 12 ha a grano',
      {
        testo:
          'Ok, hai un terreno che si chiama Ponte, di dodici ettari a Grano. Ne hai altri o vediamo il riepilogo?',
        terreni: [{ nome: 'Ponte', superficie: 12, coltura: 'Grano', podere: 'Calanchi' }],
        fatto: false,
      },
    ],
    [
      'uno a prugne 8 ha',
      {
        testo: 'Come si chiama il terreno da 8 ettari di prugne?',
        terreni: [{ nome: null, superficie: 8, coltura: 'Prugne', podere: 'Calanchi' }],
        fatto: false,
      },
    ],
    [
      'prugneto',
      {
        testo:
          'Ok, hai un terreno che si chiama Prugneto, di otto ettari a Prugne. Ne hai tre su cinque terreni. Ne hai altri o vediamo il riepilogo?',
        terreni: [{ nome: 'Prugneto', superficie: 8, coltura: 'Prugne', podere: 'Calanchi' }],
        fatto: false,
      },
    ],
    [
      '3 ha di albicocche che si chiama discesa',
      {
        testo:
          'Ok, hai un terreno che si chiama Discesa, di tre ettari a Albicocche. Ne hai quattro su cinque terreni. Ne hai altri o vediamo il riepilogo?',
        terreni: [{ nome: 'Discesa', superficie: 3, coltura: 'Albicocche', podere: 'Calanchi' }],
        fatto: false,
      },
    ],
    [
      'ho 3 ha di ciliegi che si chiama ciliegi',
      {
        testo:
          "Ok, hai un terreno che si chiama Ciliegi, di tre ettari a Ciliegio. Hai raggiunto il limite di cinque terreni con l'account gratuito. Gli altri li aggiungi passando al Base, quando vuoi.",
        terreni: [{ nome: 'Ciliegi', superficie: 3, coltura: 'Ciliegio', podere: 'Calanchi' }],
        fatto: true,
      },
    ],
    [
      'ok...e adesso?',
      {
        testo:
          "Ora che abbiamo inserito i tuoi cinque terreni, puoi accedere all'app di Global Farm View per vederli e iniziare a gestire la tua azienda agricola.",
        terreni: [],
        fatto: false,
      },
    ],
    [
      'come faccio?',
      {
        testo:
          'Per iniziare, clicca sul pulsante "Crea il tuo account gratuito" che trovi in questa pagina. Ti chiederà la tua email, una password e il nome della tua azienda agricola.',
        terreni: [],
        fatto: false,
      },
    ],
  ];

  function gira() {
    const stato = { passo: 'sede', dati: { sede: null, poderi: [], terreni: [] } };
    const visti = DIALOGO.map(([domanda, modello]) => turno(stato, domanda, modello));
    return { stato, visti };
  }

  it('dopo il podere arriva la domanda sul primo terreno', () => {
    const { visti } = gira();
    const calanchi = visti[2];
    expect(calanchi.voce).toBe(calanchi.testo);
    expect(calanchi.testo).toMatch(/Dimmi il primo terreno/);
    expect(calanchi.passo).toBe('terreni');
    expect(calanchi.terreni).toEqual([]);
  });

  it('Prugneto è il secondo, non tre su cinque; il limite resta 5, non 4', () => {
    const { visti } = gira();
    expect(visti[5].voce).toBe(visti[5].testo);
    expect(visti[5].testo).toMatch(/ne hai due su cinque/i);
    expect(visti[5].testo).not.toMatch(/tre su cinque/i);
    expect(visti[6].testo).toMatch(/ne hai tre su cinque/i);
    expect(visti[6].testo).not.toMatch(/quattro su cinque/i);

    const ciliegi = visti[7];
    expect(ciliegi.voce).toBe(ciliegi.testo);
    expect(ciliegi.testo).toMatch(/quattro su cinque/);
    expect(ciliegi.testo).not.toMatch(/raggiunto il limite/i);
    expect(ciliegi.testo).not.toMatch(/passando al Base/i);
    expect(ciliegi.apriRiepilogo).toBe(false);
    expect(ciliegi.terreni).toHaveLength(4);
  });

  it('il finale non dice di cliccare Crea il tuo account', () => {
    const { visti } = gira();
    expect(visti[8].voce).toBe(visti[8].testo);
    expect(visti[8].testo).toMatch(/accedere all'app/i);
    expect(visti[8].testo).not.toMatch(/Crea il tuo account/i);
    expect(visti[9].voce).toBe(visti[9].testo);
    expect(visti[9].testo).not.toMatch(/Crea il tuo account/i);
    expect(visti[9].testo).toMatch(/email, una password/i);
    expect(visti[9].apriRiepilogo).toBe(false);
  });
});

const CIVICO = "Il numero civico, se ce l'hai, dimmelo pure.";
const PODERI = 'Hai uno o più poderi? Dimmi come li chiami.';
const ERRORE_VUOTO = 'In questo momento non riesco a risponderti. Intanto prova GFV!';

function statoSede() {
  return { passo: 'sede', dati: { sede: null, poderi: [], terreni: [] } };
}

function conta(testo, re) {
  return (String(testo || '').match(re) || []).length;
}

describe('dialogo congelato — ritest Pier 12 nov 2026', () => {
  function gira(modelloTrebbiano, modelloChiesetta, modelloSalitona) {
    const stato = statoSede();
    const visti = [];
    const g = (domanda, modello) => {
      visti.push(turno(stato, domanda, modello));
    };
    g('faenza ,RA', {
      testo: 'Perfetto, sede a Faenza. Hai uno o più poderi? Dimmi come li chiami.',
      sede: { citta: 'Faenza', provincia: 'RA', indirizzo: null },
      poderi: [],
      terreni: [],
    });
    g('via pergola 85', {
      testo: 'Hai uno o più poderi? Dimmi come li chiami. Hai uno o più poderi?',
      sede: { indirizzo: 'via pergola 85', citta: 'Faenza', provincia: 'RA' },
      poderi: [{ nome: 'Pergola' }],
      terreni: [{ nome: 'Pergola', superficie: 85, coltura: 'Grano' }],
    });
    g('castaldo', {
      testo:
        'Ok, il podere si chiama Castaldo. Dimmi il primo terreno: come si chiama, quanti ettari e cosa ci coltivi?',
      poderi: [{ nome: 'Castaldo' }],
      terreni: [],
    });
    g('castagno sono 4 ha di orzo', {
      testo:
        'Il terreno si chiama Castagno, ha quattro ettari e ci coltivi Orzo. Ne hai uno su cinque terreni. Ne hai altri o vediamo il riepilogo?',
      terreni: [{ nome: 'Castagno', superficie: 4, coltura: 'Orzo' }],
    });
    g('ho 3 ha di sangiovese', {
      testo: '',
      terreni: [{ nome: null, superficie: 3, coltura: 'Vite da Vino' }],
    });
    g('pallina', {
      testo:
        'Il terreno si chiama Pallina, ha tre ettari e ci coltivi Vite da Vino. Ne hai due su cinque terreni. Ne hai altri o vediamo il riepilogo?',
      terreni: [{ nome: 'Pallina', superficie: 3, coltura: 'Vite da Vino' }],
    });
    g('ho 6 ha di trebbiano', {
      testo: '',
      terreni: [{ nome: null, superficie: 6, coltura: 'Vite da Vino' }],
    });
    g('trebbiano', modelloTrebbiano);
    g('ho 4 ha di giuggole che si chiama chiesetta', modelloChiesetta);
    g('ho 7 ha di mais e si chiama salitona', modelloSalitona);
    return { stato, visti };
  }

  const trebbianoVuoto = {
    testo: '',
    terreni: [{ nome: null, superficie: 6, coltura: 'Vite da Vino' }],
  };
  const chiesettaVuota = {
    testo: '',
    terreni: [{ nome: 'Chiesetta', superficie: 4, coltura: 'Giuggole' }],
  };
  const salitonaRegistrata = {
    testo: 'Ho registrato Salitona, 7 ettari a Mais.',
    terreni: [{ nome: 'Salitona', superficie: 7, coltura: 'Mais' }],
  };

  it('sede una domanda, nome = coltura, conferme con conteggio, cinque terreni', () => {
    const { stato, visti } = gira(trebbianoVuoto, chiesettaVuota, salitonaRegistrata);

    const sede = visti[0];
    expect(sede.voce).toBe(sede.testo);
    expect(sede.testo).toBe(CIVICO);
    expect(sede.testo).not.toMatch(/poder/i);
    expect(sede.passo).toBe('sede');
    expect(sede.sede).toMatchObject({ citta: 'Faenza', provincia: 'RA' });

    const via = visti[1];
    expect(via.voce).toBe(via.testo);
    expect(via.sede.indirizzo).toMatch(/pergola 85/i);
    expect(via.sede.citta).toBe('Faenza');
    expect(via.sede.provincia).toBe('RA');
    expect(via.testo).toBe(PODERI);
    expect(conta(via.testo, /poderi/gi)).toBe(1);
    expect(via.passo).toBe('poderi');
    expect(via.terreni).toHaveLength(0);

    expect(visti[2].testo).toMatch(/Dimmi il primo terreno/);
    expect(visti[2].passo).toBe('terreni');
    expect(visti[2].poderi.map((p) => p.nome)).toEqual(['Castaldo']);

    expect(visti[3].terreni[0]).toMatchObject({
      nome: 'Castagno',
      superficie: 4,
      coltura: 'Orzo',
    });

    expect(visti[4].testo).toMatch(/Come si chiama/i);
    expect(visti[4].terreni[1].nome).toBeFalsy();

    const trebbiano = visti[7];
    expect(trebbiano.terreni.find((t) => t.nome === 'Trebbiano')).toMatchObject({
      superficie: 6,
      coltura: 'Vite da Vino',
    });
    expect(trebbiano.testo).toMatch(/Il terreno si chiama Trebbiano/i);
    expect(trebbiano.testo).toMatch(/Ne hai tre su cinque terreni/i);
    expect(trebbiano.testo).not.toMatch(/non riesco a risponderti/i);
    expect(trebbiano.voce).toBeTruthy();
    expect(trebbiano.voce).toBe(trebbiano.testo);

    const chiesetta = visti[8];
    expect(chiesetta.testo).toMatch(/Il terreno si chiama Chiesetta/i);
    expect(chiesetta.testo).toMatch(/Ne hai quattro su cinque terreni/i);
    expect(chiesetta.testo).toMatch(/Giuggole/);
    expect(chiesetta.voce).toBeTruthy();
    expect(chiesetta.voce).toBe(chiesetta.testo);
    expect(chiesetta.terreni.find((t) => t.nome === 'Chiesetta').coltura).toBe('Giuggole');

    const salitona = visti[9];
    expect(salitona.apriRiepilogo).toBe(true);
    expect(conta(salitona.testo, /limite di cinque terreni/gi)).toBe(1);
    expect(salitona.testo).not.toMatch(/Ne hai altri/i);
    expect(salitona.testo).toMatch(/Il terreno si chiama Salitona/i);
    expect(salitona.voce).toBe(salitona.testo);

    expect(stato.dati.terreni).toHaveLength(5);
    expect(stato.dati.terreni.map((t) => [t.nome, t.superficie, t.coltura])).toEqual([
      ['Castagno', 4, 'Orzo'],
      ['Pallina', 3, 'Vite da Vino'],
      ['Trebbiano', 6, 'Vite da Vino'],
      ['Chiesetta', 4, 'Giuggole'],
      ['Salitona', 7, 'Mais'],
    ]);
    expect(stato.dati.poderi.map((p) => p.nome)).toEqual(['Castaldo']);
    expect(ERRORE_VUOTO).not.toBe(salitona.testo);
  });

  it('«Ho registrato…» sul nome nudo e su Chiesetta dà la stessa conferma', () => {
    const { visti } = gira(
      {
        testo: 'Ho registrato il terreno Trebbiano.',
        terreni: [{ nome: 'Trebbiano', superficie: 6, coltura: 'Vite da Vino' }],
      },
      {
        testo: 'Ho registrato Chiesetta di 4 ettari a Giuggole.',
        terreni: [{ nome: null, superficie: 4, coltura: 'Giuggole' }],
      },
      {
        testo: '',
        terreni: [{ nome: 'Salitona', superficie: 7, coltura: 'Mais' }],
      }
    );
    expect(visti[7].testo).toMatch(/Il terreno si chiama Trebbiano/i);
    expect(visti[7].testo).toMatch(/Ne hai tre su cinque terreni/i);
    expect(visti[7].voce).toBe(visti[7].testo);
    expect(visti[8].testo).toMatch(/Il terreno si chiama Chiesetta/i);
    expect(visti[8].testo).toMatch(/Giuggole/);
    expect(visti[8].voce).toBeTruthy();
    expect(visti[9].apriRiepilogo).toBe(true);
    expect(visti[9].testo).not.toMatch(/Ne hai altri/i);
  });
});

describe('sede senza civico: una domanda, poi il civico o il salto', () => {
  it.each(['faenza ,RA', 'Faenza, RA', 'Faenza (RA)', 'faenza', 'località Casale'])(
    '%j → solo il civico, si resta sulla sede',
    (inp) => {
      const esito = turno(statoSede(), inp, {
        testo: 'Perfetto. Hai uno o più poderi? Dimmi come li chiami.',
        sede: null,
        poderi: [],
        terreni: [{ nome: 'Casale', superficie: 1, coltura: 'Grano' }],
      });
      expect(esito.voce).toBe(esito.testo);
      expect(esito.testo).toBe(CIVICO);
      expect(esito.testo).not.toMatch(/poder/i);
      expect(esito.passo).toBe('sede');
      expect(esito.terreni).toHaveLength(0);
      expect(esito.sede == null).toBe(false);
    }
  );

  it.each([
    ['85', /85/],
    ['via pergola 85', /pergola 85/i],
    ["non ce l'ho", null],
    ['dopo', null],
  ])('dopo Faenza, %j completa o salta e chiede i poderi una volta', (risposta, indirizzo) => {
    const stato = statoSede();
    turno(stato, 'Faenza, RA', { testo: '', sede: null, poderi: [], terreni: [] });
    const esito = turno(stato, risposta, {
      testo: '',
      sede: null,
      poderi: [{ nome: 'Fantasma' }],
      terreni: [],
    });
    expect(esito.voce).toBe(esito.testo);
    expect(esito.testo).toBe(PODERI);
    expect(conta(esito.testo, /poderi/gi)).toBe(1);
    expect(esito.passo).toBe('poderi');
    expect(esito.poderi || []).toHaveLength(0);
    if (indirizzo) expect(esito.sede.indirizzo).toMatch(indirizzo);
    expect(esito.sede.citta).toBe('Faenza');
  });
});

describe('nome uguale alla coltura, solo in risposta a «Come si chiama…?»', () => {
  function dopoDomanda(domandaNome, modello) {
    const stato = {
      passo: 'terreni',
      dati: {
        sede: { indirizzo: 'via pergola 85', citta: 'Faenza', provincia: 'RA' },
        poderi: [{ nome: 'Castaldo' }],
        terreni: [
          { nome: 'Castagno', superficie: 4, coltura: 'Orzo' },
          { nome: 'Pallina', superficie: 3, coltura: 'Vite da Vino' },
          { nome: null, superficie: 6, coltura: 'Vite da Vino', nomeChiesto: true },
        ],
      },
    };
    if (domandaNome === 'mais' || domandaNome === 'sangiovese') {
      stato.dati.terreni[2] = {
        nome: null,
        superficie: domandaNome === 'mais' ? 7 : 6,
        coltura: domandaNome === 'mais' ? 'Mais' : 'Vite da Vino',
        nomeChiesto: true,
      };
    }
    return turno(stato, domandaNome, modello);
  }

  it.each(['trebbiano', 'Trebbiano'])('%j tiene il nome e conferma con il conteggio', (inp) => {
    const esito = dopoDomanda(inp, {
      testo: '',
      terreni: [{ nome: null, superficie: 6, coltura: 'Vite da Vino' }],
    });
    expect(esito.terreni.find((t) => /trebbiano/i.test(t.nome || ''))).toMatchObject({
      superficie: 6,
      coltura: 'Vite da Vino',
    });
    expect(esito.testo).toMatch(/Il terreno si chiama Trebbiano/i);
    expect(esito.testo).toMatch(/Ne hai tre su cinque terreni/i);
    expect(esito.testo).not.toMatch(/non riesco/i);
    expect(esito.voce).toBe(esito.testo);
  });

  it('mais dopo «ho 7 ha di mais» è il nome', () => {
    const esito = dopoDomanda('mais', {
      testo: '',
      terreni: [{ nome: null, superficie: 7, coltura: 'Mais' }],
    });
    expect(esito.terreni.find((t) => t.nome === 'Mais')).toMatchObject({
      superficie: 7,
      coltura: 'Mais',
    });
    expect(esito.testo).toMatch(/Ne hai tre su cinque terreni/i);
    expect(esito.voce).toBeTruthy();
  });

  it('sangiovese nudo è il nome, non una coltura nuova', () => {
    const esito = dopoDomanda('sangiovese', {
      testo: 'Ho registrato Sangiovese.',
      terreni: [{ nome: null, superficie: 6, coltura: 'Vite da Vino' }],
    });
    expect(esito.terreni.find((t) => t.nome === 'Sangiovese')).toMatchObject({
      superficie: 6,
      coltura: 'Vite da Vino',
    });
    expect(esito.testo).toMatch(/Il terreno si chiama Sangiovese/i);
    expect(esito.voce).toBe(esito.testo);
  });

  it('«4 ha di trebbiano» senza nome esplicito chiede ancora come si chiama', () => {
    const stato = {
      passo: 'terreni',
      dati: {
        sede: { citta: 'Faenza', indirizzo: 'via pergola 85' },
        poderi: [{ nome: 'Castaldo' }],
        terreni: [],
      },
    };
    const esito = turno(stato, '4 ha di trebbiano', {
      testo: '',
      terreni: [{ nome: 'Trebbiano', superficie: 4, coltura: 'Vite da Vino' }],
    });
    expect(esito.terreni[0].nome).toBeFalsy();
    expect(esito.testo).toMatch(/Come si chiama/i);
  });
});

describe('nome nella stessa frase: che chiamiamo e chiamto', () => {
  function terreno(frase, modello) {
    const stato = {
      passo: 'terreni',
      dati: {
        sede: { citta: 'Faenza', indirizzo: 'via pergola 85' },
        poderi: [{ nome: 'Castaldo' }],
        terreni: [],
      },
    };
    return turno(stato, frase, modello || { testo: '', terreni: [] });
  }

  it('4 ha di trebbiano che chiamiamo vitaccia → Vitaccia, Vite da Vino', () => {
    const esito = terreno('4 ha di trebbiano che chiamiamo vitaccia', {
      testo: 'Come si chiama il terreno da 4 ettari di trebbiano?',
      terreni: [{ nome: 'Trebbiano', superficie: 4, coltura: 'Vite da Vino' }],
    });
    expect(esito.terreni[0]).toMatchObject({
      nome: 'Vitaccia',
      superficie: 4,
      coltura: 'Vite da Vino',
    });
    expect(esito.testo).not.toMatch(/Come si chiama/i);
    expect(esito.testo).toMatch(/Il terreno si chiama Vitaccia/i);
    expect(esito.voce).toBeTruthy();
  });

  it('ho 5 ha di mandorli chiamto collina → Collina, Mandorlo', () => {
    const esito = terreno('ho 5 ha di mandorli chiamto collina', {
      testo: 'Come si chiama?',
      terreni: [{ nome: null, superficie: 5, coltura: null }],
    });
    expect(esito.terreni[0]).toMatchObject({
      nome: 'Collina',
      superficie: 5,
      coltura: 'Mandorlo',
    });
    expect(esito.testo).not.toMatch(/Come si chiama/i);
  });

  it.each([
    ['chiamato discesona 4 ha di sangiovese', 'Discesona'],
    ['ho 4 ha di sangiovese che si chiama discesona', 'Discesona'],
    ['lo chiamiamo melograno 3 ha', 'Melograno'],
    ['3 ha di albicocche che si chiama discesa', 'Discesa'],
    ['detto vitaccia 4 ha di trebbiano', 'Vitaccia'],
    ['nome vitaccia 4 ha di trebbiano', 'Vitaccia'],
    ['lo chiamiamo vitaccia 4 ha di trebbiano', 'Vitaccia'],
  ])('%j tiene il nome %j', (frase, nome) => {
    const letto = interpretaFraseTerreni(frase)[0];
    expect(String(letto.nome || '').toLowerCase()).toBe(nome.toLowerCase());
    const esito = terreno(frase, {
      testo: '',
      terreni: [{ nome: null, superficie: letto.superficie, coltura: null }],
    });
    expect(String(esito.terreni[0].nome || '').toLowerCase()).toBe(nome.toLowerCase());
    expect(esito.testo).not.toMatch(/Come si chiama/i);
  });

  it('«4 ha di trebbiano» e «come lo chiamiamo?» non diventano il nome', () => {
    expect(interpretaFraseTerreni('4 ha di trebbiano')[0].nome).toBeFalsy();
    expect(interpretaFraseTerreni('come lo chiamiamo?')[0].nome).toBeFalsy();
    const stato = {
      passo: 'terreni',
      dati: {
        sede: { citta: 'Faenza', indirizzo: 'via 1' },
        poderi: [],
        terreni: [{ nome: null, superficie: 4, coltura: 'Vite da Vino', nomeChiesto: true }],
      },
    };
    const esito = turno(stato, 'come lo chiamiamo?', {
      testo: '',
      terreni: [{ nome: 'Come lo chiamiamo', superficie: 4, coltura: 'Vite da Vino' }],
    });
    expect(esito.terreni[0].nome).toBeFalsy();
  });

  it('chiamto da solo non è un nome', () => {
    const stato = {
      passo: 'terreni',
      dati: {
        sede: { citta: 'Faenza', indirizzo: 'via 1' },
        poderi: [],
        terreni: [{ nome: null, superficie: 5, coltura: 'Mandorlo', nomeChiesto: true }],
      },
    };
    const esito = turno(stato, 'chiamto', {
      testo: '',
      terreni: [{ nome: 'Chiamto', superficie: 5, coltura: 'Mandorlo' }],
    });
    expect(esito.terreni[0].nome).toBeFalsy();
  });
});

describe('coltura fuori catalogo: conferma con conteggio, scheda segnala dopo', () => {
  it.each([
    ['ho 4 ha di giuggole che si chiama chiesetta', 'Chiesetta', 4, 'Giuggole', ''],
    [
      '3 ha di zafferano che chiamiamo orto',
      'Orto',
      3,
      'Zafferano',
      'Come si chiama il terreno?',
    ],
    ['chiesetta 4 ha di giuggiolo', 'Chiesetta', 4, 'Giuggiolo', 'Ho registrato Chiesetta.'],
  ])('%j tiene la coltura detta', (frase, nome, ha, coltura, testoModello) => {
    const stato = {
      passo: 'terreni',
      dati: {
        sede: { citta: 'Faenza', indirizzo: 'via pergola 85' },
        poderi: [{ nome: 'Castaldo' }],
        terreni: [{ nome: 'Castagno', superficie: 4, coltura: 'Orzo' }],
      },
    };
    const esito = turno(stato, frase, {
      testo: testoModello,
      terreni: [{ nome, superficie: ha, coltura }],
    });
    expect(esito.terreni.find((t) => t.nome === nome)).toMatchObject({
      superficie: ha,
      coltura,
    });
    expect(esito.testo).toMatch(new RegExp('Il terreno si chiama ' + nome, 'i'));
    expect(esito.testo).toMatch(/su cinque terreni/i);
    expect(esito.voce).toBeTruthy();
    expect(esito.voce).toBe(esito.testo);
  });
});

describe('schedaIntro una volta, e niente frase di errore su ok vuoto', () => {
  it('la frase sta nell’intro della scheda e non viene spinta in chat', () => {
    const chat = fs.readFileSync(path.join(root, 'landing/src/components/TonyChat.vue'), 'utf8');
    const scheda = fs.readFileSync(
      path.join(root, 'landing/src/components/TonySchedaConferma.vue'),
      'utf8'
    );
    const intro = testiLanding.tonyBussa.aiuto.schedaIntro;
    expect(scheda).toContain('t.schedaIntro');
    expect(intro).toBe(
      'Ecco la tua azienda. Controlla e conferma: se qualcosa non va, correggilo qui.'
    );
    const corpo = chat.slice(chat.indexOf('function apriScheda'), chat.indexOf('function onTornaDallaScheda'));
    expect(corpo).not.toMatch(/messaggi\.value\.push\(\{\s*ruolo:\s*'tony',\s*testo:\s*ta\.schedaIntro/);
    expect(corpo).toContain("suonaFraseFissa('schedaIntro')");
    expect(chat).toContain("suonaFraseFissa('limiteCinqueRaggiunto')");
    expect(chat).toContain('introDopoVoce');
  });

  it('un esito ok in fase account con testo vuoto non mostra l’errore', () => {
    const rientro = domandaDiRientro('terreni', {
      terreni: [{ nome: 'Castagno', superficie: 4, coltura: 'Orzo' }],
    });
    const vis = testoVisibileAccount('', null, rientro);
    expect(vis.testo).toBe(rientro);
    expect(vis.testo).not.toBe(MESSAGGI_CHAT.errore);
    expect(vis.testo).not.toMatch(/non riesco a risponderti/i);
    expect(testoVisibileAccount('Il terreno si chiama Castagno.', '', rientro).testo).toBe(
      'Il terreno si chiama Castagno.'
    );
  });
});

describe('vitigni: stessa tabella sul client e sulla function', () => {
  it('trebbiano, sangiovese e albana vanno a Vite da Vino; ciliegio no; ciliegiolo sì', () => {
    for (const nome of ['trebbiano', 'sangiovese', 'albana']) {
      expect(normalizzaColturaCatalogo(nome)).toBe('Vite da Vino');
      expect(risolviColturaConSinonimi(nome)).toBe('Vite da Vino');
    }
    expect(normalizzaColturaCatalogo('ciliegio')).toBe('Ciliegio');
    expect(risolviColturaConSinonimi('ciliegio')).toBe('Ciliegio');
    expect(normalizzaColturaCatalogo('ciliegiolo')).toBe('Vite da Vino');
    expect(risolviColturaConSinonimi('ciliegiolo')).toBe('Vite da Vino');
  });
});

describe('dialogo congelato — ritest Pier 12 nov 2026, secondo giro', () => {
  function statoInizio() {
    return { passo: 'sede', dati: { sede: null, poderi: [], terreni: [] } };
  }

  function gira(colturaCiliegio) {
    const stato = statoInizio();
    const visti = [];
    const g = (domanda, modello) => {
      visti.push(turno(stato, domanda, modello));
    };
    g('faenza RA', {
      testo: 'Perfetto, sede a Faenza. Hai uno o più poderi? Dimmi come li chiami.',
      sede: { citta: 'Faenza', provincia: 'RA', indirizzo: null },
      poderi: [],
      terreni: [],
    });
    g('via celle 72', {
      testo: 'Hai uno o più poderi? Dimmi come li chiami. Hai uno o più poderi?',
      sede: { indirizzo: 'via celle 72', citta: 'Faenza', provincia: 'RA' },
      poderi: [{ nome: 'Celle' }],
      terreni: [{ nome: 'Celle', superficie: 72, coltura: 'Grano' }],
    });
    g('pustazz', {
      testo:
        'Ok, il podere si chiama Pustazz. Dimmi il primo terreno: come si chiama, quanti ettari e cosa ci coltivi?',
      poderi: [{ nome: 'Pustazz' }],
      terreni: [],
    });
    g('ciliegio è 7 ha e cè del trebbiano', {
      testo:
        'Il terreno si chiama Ciliegio, ha sette ettari e ci coltivi Ciliegio. Ne hai uno su cinque terreni. Ne hai altri o vediamo il riepilogo?',
      terreni: [{ nome: 'Ciliegio', superficie: 7, coltura: colturaCiliegio }],
    });
    g('ho un terreno che si chiama laghetto e sono 3 ha di giuggiole', {
      testo: 'Il terreno si chiama Laghetto, ha tre ettari e ci coltivi Giuggiole.',
      terreni: [{ nome: 'Laghetto', superficie: 3, coltura: 'Giuggiole' }],
    });
    g('ho 3 ha di orzo', {
      testo: '',
      terreni: [{ nome: null, superficie: 3, coltura: 'Orzo' }],
    });
    g('lungone', {
      testo: '',
      terreni: [{ nome: null, superficie: 3, coltura: 'Orzo' }],
    });
    g('ho 7 ha di trebbiano', {
      testo: '',
      terreni: [{ nome: null, superficie: 7, coltura: null }],
    });
    g('trebbiano', {
      testo: '',
      terreni: [{ nome: null, superficie: 7, coltura: 'Vite da Vino' }],
    });
    g('ho 4,7 ha di mandorlo che chiamo sassone', {
      testo: 'Ecco la tua azienda. Controlla e conferma: se qualcosa non va, correggilo qui.',
      terreni: [{ nome: 'Sassone', superficie: 4.7, coltura: 'Mandorlo' }],
    });
    return { stato, visti };
  }

  it('faenza, podere, cinque terreni: il trebbiano del Ciliegio è Vite da Vino', () => {
    for (const colturaCiliegio of ['Ciliegio', null, 'trebbiano']) {
      const { stato, visti } = gira(colturaCiliegio);

      const sede = visti[0];
      expect(sede.testo).toBe(CIVICO);
      expect(sede.testo).not.toMatch(/poder/i);
      expect(sede.voce).toBe(sede.testo);
      expect(sede.passo).toBe('sede');
      expect(sede.apriRiepilogo).toBe(false);

      const via = visti[1];
      expect(via.voce).toBe(via.testo);
      expect(via.sede).toMatchObject({
        indirizzo: expect.stringMatching(/celle 72/i),
        citta: 'Faenza',
        provincia: 'RA',
      });
      expect(via.testo).toBe(PODERI);
      expect(conta(via.testo, /poderi/gi)).toBe(1);
      expect(via.passo).toBe('poderi');
      expect(via.terreni).toHaveLength(0);
      expect(via.apriRiepilogo).toBe(false);

      expect(visti[2].testo).toMatch(/Dimmi il primo terreno/);
      expect(visti[2].passo).toBe('terreni');
      expect(visti[2].poderi.map((p) => p.nome)).toEqual(['Pustazz']);
      expect(visti[2].apriRiepilogo).toBe(false);

      const ciliegio = visti[3];
      expect(ciliegio.terreni[0]).toMatchObject({
        nome: 'Ciliegio',
        superficie: 7,
        coltura: 'Vite da Vino',
      });
      expect(ciliegio.testo).toMatch(/Il terreno si chiama Ciliegio/i);
      expect(ciliegio.testo).toMatch(/ci coltivi Vite da Vino/i);
      expect(ciliegio.testo).toMatch(/uno su cinque/i);
      expect(ciliegio.testo).not.toMatch(/ci coltivi Ciliegio/i);
      expect(ciliegio.voce).toBe(ciliegio.testo);
      expect(ciliegio.apriRiepilogo).toBe(false);

      const laghetto = visti[4];
      expect(laghetto.terreni.find((t) => t.nome === 'Laghetto')).toMatchObject({
        superficie: 3,
        coltura: 'Giuggiolo',
      });
      expect(laghetto.testo).toMatch(/ci coltivi Giuggiolo/i);
      expect(laghetto.testo).toMatch(/due su cinque/i);
      expect(laghetto.voce).toBe(laghetto.testo);
      expect(laghetto.apriRiepilogo).toBe(false);

      expect(visti[5].testo).toMatch(/Come si chiama/i);
      expect(visti[5].terreni.find((t) => t.superficie === 3 && t.coltura === 'Orzo').nome).toBeFalsy();
      expect(visti[5].apriRiepilogo).toBe(false);

      const lungone = visti[6];
      expect(lungone.terreni.find((t) => t.nome === 'Lungone')).toMatchObject({
        superficie: 3,
        coltura: 'Orzo',
      });
      expect(lungone.testo).toMatch(/tre su cinque/i);
      expect(lungone.voce).toBe(lungone.testo);
      expect(lungone.apriRiepilogo).toBe(false);

      const chiestoTrebbiano = visti[7];
      expect(chiestoTrebbiano.testo).toMatch(/Come si chiama/i);
      expect(
        chiestoTrebbiano.terreni.find((t) => t.superficie === 7 && !t.nome).coltura
      ).toBe('Vite da Vino');
      expect(chiestoTrebbiano.apriRiepilogo).toBe(false);

      const trebbiano = visti[8];
      expect(trebbiano.terreni.find((t) => t.nome === 'Trebbiano')).toMatchObject({
        superficie: 7,
        coltura: 'Vite da Vino',
      });
      expect(trebbiano.testo).toMatch(/quattro su cinque/i);
      expect(trebbiano.testo).toMatch(/ci coltivi Vite da Vino/i);
      expect(trebbiano.voce).toBe(trebbiano.testo);
      expect(trebbiano.apriRiepilogo).toBe(false);

      const sassone = visti[9];
      expect(sassone.terreni.find((t) => t.nome === 'Sassone')).toMatchObject({
        superficie: 4.7,
        coltura: 'Mandorlo',
      });
      expect(sassone.apriRiepilogo).toBe(true);
      expect(conta(sassone.testo, /limite di cinque terreni/gi)).toBe(1);
      expect(sassone.testo).not.toMatch(/Ne hai altri/i);
      expect(sassone.testo).not.toMatch(/Ecco la tua azienda/i);
      expect(sassone.testo).toMatch(/ci coltivi Mandorlo/i);
      expect(sassone.voce).toBe(sassone.testo);

      expect(stato.dati.terreni).toHaveLength(5);
      expect(stato.dati.terreni.map((t) => [t.nome, t.superficie, t.coltura])).toEqual([
        ['Ciliegio', 7, 'Vite da Vino'],
        ['Laghetto', 3, 'Giuggiolo'],
        ['Lungone', 3, 'Orzo'],
        ['Trebbiano', 7, 'Vite da Vino'],
        ['Sassone', 4.7, 'Mandorlo'],
      ]);
    }
  });
});

describe('la coltura detta vince sul nome del terreno', () => {
  function statoTerreno() {
    return {
      passo: 'terreni',
      dati: {
        sede: { citta: 'Faenza', provincia: 'RA', indirizzo: 'via celle 72' },
        poderi: [{ nome: 'Pustazz' }],
        terreni: [],
      },
    };
  }

  function modello(nome, superficie, coltura) {
    return {
      testo:
        'Il terreno si chiama ' +
        nome +
        ', ha ' +
        String(superficie).replace('.', ',') +
        ' ettari e ci coltivi ' +
        (coltura || nome) +
        '.',
      terreni: [{ nome, superficie, coltura }],
    };
  }

  it.each([
    ['ciliegio sono 7 ha di trebbiano', 'Ciliegio', 7, 'Vite da Vino', 'Ciliegio'],
    ['ciliegio sono 7 ha di trebbiano', 'Ciliegio', 7, 'Vite da Vino', 'Vite da Vino'],
    ["ciliegio è 7 ha e c'è del trebbiano", 'Ciliegio', 7, 'Vite da Vino', 'Ciliegio'],
    ["ciliegio è 7 ha e c'è del trebbiano", 'Ciliegio', 7, 'Vite da Vino', 'Vite da Vino'],
    ['ciliegio è 7 ha e ce del trebbiano', 'Ciliegio', 7, 'Vite da Vino', 'Ciliegio'],
    ['ciliegio è 7 ha e ce del trebbiano', 'Ciliegio', 7, 'Vite da Vino', null],
    ['ciliegio è 7 ha e cè del trebbiano', 'Ciliegio', 7, 'Vite da Vino', 'trebbiano'],
    ['ciliegio è 7 ha e cè del trebbiano', 'Ciliegio', 7, 'Vite da Vino', 'Ciliegio'],
    ['il pesco ha 2 ha di albicocco', 'Pesco', 2, 'Albicocche', 'Pesco'],
    ['il pesco ha 2 ha di albicocco', 'Pesco', 2, 'Albicocche', 'Albicocche'],
    ["melo 3 ha c'è del grano", 'Melo', 3, 'Grano', 'Melo'],
    ["melo 3 ha c'è del grano", 'Melo', 3, 'Grano', 'Grano'],
    ['melo 3 ha ce del grano', 'Melo', 3, 'Grano', 'Melo'],
    ['melo 3 ha ce del grano', 'Melo', 3, 'Grano', 'Grano'],
    ['noce 5 ettari a mais', 'Noce', 5, 'Mais', 'Noce'],
    ['noce 5 ettari a mais', 'Noce', 5, 'Mais', 'Mais'],
    ['ciliegiolo 2 ha di trebbiano', 'Ciliegiolo', 2, 'Vite da Vino', 'Ciliegiolo'],
    ['ciliegiolo 2 ha di trebbiano', 'Ciliegiolo', 2, 'Vite da Vino', 'Vite da Vino'],
    ['ciliegio 7 ha', 'Ciliegio', 7, 'Ciliegio', 'Ciliegio'],
  ])('%s → %s, %s ha, coltura %s (modello %j)', (frase, nome, ha, coltura, colturaModello) => {
    const esito = turno(statoTerreno(), frase, modello(nome, ha, colturaModello));
    expect(esito.terreni[0]).toMatchObject({ nome, superficie: ha, coltura });
    expect(esito.testo).toMatch(new RegExp('ci coltivi ' + coltura, 'i'));
    expect(esito.voce).toBe(esito.testo);
  });

  it('3 ha di sangiovese e poi il nome: Vite da Vino anche con coltura null', () => {
    const stato = statoTerreno();
    const chiesto = turno(stato, '3 ha di sangiovese', {
      testo: '',
      terreni: [{ nome: null, superficie: 3, coltura: null }],
    });
    expect(chiesto.testo).toMatch(/Come si chiama/i);
    expect(chiesto.terreni[0].nome).toBeFalsy();
    expect(chiesto.terreni[0].coltura).toBe('Vite da Vino');
    const dato = turno(stato, 'ronco', {
      testo: '',
      terreni: [{ nome: null, superficie: 3, coltura: null }],
    });
    expect(dato.terreni[0]).toMatchObject({
      nome: 'Ronco',
      superficie: 3,
      coltura: 'Vite da Vino',
    });
    expect(dato.testo).toMatch(/ci coltivi Vite da Vino/i);
    expect(dato.voce).toBe(dato.testo);
  });

  it('«ciliegio trebbiano 7 ha» non salva il nome come coltura', () => {
    // Due colture riconoscibili (Ciliegio e il vitigno trebbiano) e nessun
    // segnale di posizione: il nome non è seguito da è/sono/ha/ettari/una cifra,
    // non c'è «si chiama» e non c'è una particella (di, c'è, ce, cè, a, coltivo).
    // Non si sceglie. Il nome resta Ciliegio, la coltura resta vuota e si chiede.
    const esito = turno(statoTerreno(), 'ciliegio trebbiano 7 ha', {
      testo: 'Il terreno si chiama Ciliegio, ha sette ettari e ci coltivi Ciliegio.',
      terreni: [{ nome: 'Ciliegio', superficie: 7, coltura: 'Ciliegio' }],
    });
    expect(esito.terreni[0].nome).toBe('Ciliegio');
    expect(esito.terreni[0].superficie).toBe(7);
    expect(esito.terreni[0].coltura).toBeFalsy();
    expect(esito.testo).toBe('Che cosa ci coltivi nel terreno Ciliegio?');
    expect(esito.voce).toBe(esito.testo);
    expect(esito.testo).not.toMatch(/ci coltivi Ciliegio/i);
  });
});

describe('sede: civico sulla via, una domanda, voce = testo', () => {
  const MODELLO_VIA = {
    testo: 'Perfetto, sede in via Roma, Faenza. Hai uno o più poderi?',
    sede: { indirizzo: 'via Roma, Faenza', citta: null, cap: null, provincia: null },
    poderi: [],
    terreni: [{ nome: 'Roma', superficie: 1, coltura: 'Grano' }],
  };

  it('«via Roma, Faenza» poi «12»: via e comune restano, una domanda sui poderi', () => {
    const stato = statoSede();
    const prima = turno(stato, 'via Roma, Faenza', MODELLO_VIA);
    expect(prima.voce).toBe(prima.testo);
    expect(prima.testo).toBe(CIVICO);
    expect(prima.passo).toBe('sede');
    expect(prima.terreni).toHaveLength(0);
    expect(prima.sede).toMatchObject({ indirizzo: 'via Roma', citta: 'Faenza' });
    expect(prima.apriRiepilogo).toBe(false);

    const dopo = turno(stato, '12', {
      testo: 'Ok, 12.',
      sede: { indirizzo: '12', citta: null },
      poderi: [{ nome: 'Roma' }],
      terreni: [{ nome: 'Dodici', superficie: 12, coltura: 'Grano' }],
    });
    expect(dopo.voce).toBe(dopo.testo);
    expect(dopo.testo).toBe(PODERI);
    expect(conta(dopo.testo, /poderi/gi)).toBe(1);
    expect(dopo.testo).not.toMatch(/numero civico/i);
    expect(dopo.passo).toBe('poderi');
    expect(dopo.sede).toMatchObject({ indirizzo: 'via Roma 12', citta: 'Faenza' });
    expect(dopo.terreni).toHaveLength(0);
    expect(dopo.poderi).toHaveLength(0);
  });

  it('«via Roma a Faenza» poi il civico accoda il numero', () => {
    const stato = statoSede();
    const prima = turno(stato, 'via Roma a Faenza', {
      testo: 'Ok.',
      sede: { indirizzo: 'via Roma a Faenza', citta: null },
      terreni: [],
    });
    expect(prima.voce).toBe(prima.testo);
    expect(prima.testo).toBe(CIVICO);
    expect(prima.sede).toMatchObject({ indirizzo: 'via Roma', citta: 'Faenza' });
    const dopo = turno(stato, '12', { testo: '', sede: { indirizzo: '12' }, terreni: [] });
    expect(dopo.voce).toBe(dopo.testo);
    expect(dopo.sede).toMatchObject({ indirizzo: 'via Roma 12', citta: 'Faenza' });
    expect(dopo.passo).toBe('poderi');
    expect(dopo.testo).toBe(PODERI);
  });

  it('solo Faenza e poi 12: il numero è l’indirizzo, il comune resta', () => {
    const stato = statoSede();
    turno(stato, 'Faenza', { testo: 'Ok.', sede: null, poderi: [], terreni: [] });
    const dopo = turno(stato, '12', {
      testo: '',
      sede: { indirizzo: '12', citta: null },
      terreni: [{ nome: 'Dodici', superficie: 12 }],
    });
    expect(dopo.voce).toBe(dopo.testo);
    expect(dopo.sede).toMatchObject({ indirizzo: '12', citta: 'Faenza' });
    expect(dopo.passo).toBe('poderi');
    expect(dopo.testo).toBe(PODERI);
    expect(dopo.terreni).toHaveLength(0);
  });

  it.each([
    ['boh', 'boh'],
    ['non mi ricordo il numero', 'non mi ricordo'],
    ["non ce l'ho", 'salto'],
  ])('dopo il civico, %j va ai poderi senza una seconda domanda', (risposta) => {
    const stato = statoSede();
    turno(stato, 'via Roma, Faenza', MODELLO_VIA);
    const dopo = turno(stato, risposta, {
      testo: "Il numero civico, se ce l'hai, dimmelo pure.",
      sede: null,
      terreni: [{ nome: 'Extra', superficie: 1, coltura: 'Grano' }],
    });
    expect(dopo.voce).toBe(dopo.testo);
    expect(dopo.testo).toBe(PODERI);
    expect(dopo.testo).not.toMatch(/numero civico/i);
    expect(dopo.passo).toBe('poderi');
    expect(dopo.sede).toMatchObject({ indirizzo: 'via Roma', citta: 'Faenza' });
    expect(String(dopo.sede.indirizzo)).not.toMatch(/\d/);
    expect(dopo.terreni).toHaveLength(0);
  });

  it('«via Roma 12, Faenza» al primo colpo non chiede il civico', () => {
    const esito = turno(statoSede(), 'via Roma 12, Faenza', {
      testo: 'Non ho capito bene. Riprova con via e comune.',
      sede: { indirizzo: 'via Roma 12, Faenza', citta: null },
      poderi: [{ nome: 'Roma' }],
      terreni: [{ nome: 'Roma', superficie: 12, coltura: 'Vite' }],
    });
    expect(esito.voce).toBe(esito.testo);
    expect(esito.testo).not.toMatch(/numero civico/i);
    expect(esito.passo).toBe('poderi');
    expect(esito.sede).toMatchObject({ indirizzo: 'via Roma 12', citta: 'Faenza' });
    expect(esito.terreni).toHaveLength(0);
    expect(esito.poderi).toHaveLength(0);
  });
});
