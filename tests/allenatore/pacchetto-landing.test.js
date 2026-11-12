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
  messaggioSoloConteggioTerreni,
  numeroEttariDetto,
  numeroTerreniDetto,
  righeRiepilogo,
} from '../../landing/src/lib/tony-aiuto-account.js';
import { LANDING_ATTIVA, TONY_BUSSA_ATTIVO } from '../../landing/src/config/landing-config.js';
import { testiLanding } from '../../landing/src/content/testi-landing.js';

const require = createRequire(import.meta.url);
const {
  numeroTerreniDetto: numeroTerreniDettoServer,
  messaggioSoloConteggioTerreni: soloConteggioServer,
  sembraIndirizzo: sembraIndirizzoServer,
  promptSistemaAccount,
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
    expect(esito.passo, inp).toBe('poderi');
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

  it('Faenza, RA e il solo comune si accettano; il civico si chiede una volta', () => {
    const faenza = accetta('Faenza, RA');
    expect(faenza.sede).toMatchObject({ citta: 'Faenza', provincia: 'RA', indirizzo: null });
    expect(faenza.testo.match(/numero civico/gi)).toHaveLength(1);

    const stato = { passo: 'sede', dati: { sede: null, poderi: [], terreni: [] } };
    const solo = turno(stato, 'Brisighella', RIFIUTO);
    expect(solo.voce).toBe(solo.testo);
    expect(solo.sede).toMatchObject({ citta: 'Brisighella', indirizzo: null });
    expect(solo.sede.cap == null || solo.sede.cap === '').toBe(true);
    expect(solo.terreni).toHaveLength(0);
    expect(solo.passo).toBe('poderi');
    expect(solo.testo.match(/numero civico/gi)).toHaveLength(1);

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
