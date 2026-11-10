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
  it('senza «Ho capito, chiedi» non si prosegue; niente × che accetta', () => {
    expect(testiLanding.tonyBussa.aiuto.informativa).toBe(TESTO_LEGALE_INFORMATIVA);
    expect(testiLanding.tonyBussa.aiuto.informativaHoCapito).toBe('Ho capito, chiedi');
    const chat = fs.readFileSync(path.join(root, 'landing/src/components/TonyChat.vue'), 'utf8');
    expect(chat).toContain('aria-modal="true"');
    expect(chat).toContain('if (informativaAiutoVisibile.value) return');
    expect(chat).toMatch(/v-if="!informativaAiutoVisibile"/);
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
