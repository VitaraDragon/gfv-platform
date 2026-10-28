/**
 * @vitest-environment node
 * Base di conoscenza e prompt definitivo di Tony landing (passo 11).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_MODULES,
  BUNDLES,
  BILLING,
  SUBSCRIPTION_PLANS,
  monthlyToAnnual,
  canActivateModule
} from '../core/config/subscription-plans.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const radice = path.join(__dirname, '..');

const {
  generaContenuto,
  GIORNI_PROVA_MODULI
} = require('../functions/scripts/generate-tony-landing-kb.js');
const kb = require('../functions/config/tony-landing-kb.js');
const {
  FRASE_TRATTAMENTI,
  REGOLE_TONY_LANDING,
  PROMPT_SISTEMA_LANDING
} = require('../functions/lib/tony-landing-prompt.js');
const { TONY_GUIDA_ONBOARDING_DAYS } = require('../functions/tony-guida-onboarding.js');

const MESSAGGIO_RIGENERAZIONE =
  'rigenera con `node functions/scripts/generate-tony-landing-kb.js`';

function leggiTesto(relativo) {
  return fs.readFileSync(path.join(radice, relativo), 'utf8').replace(/\r\n/g, '\n');
}

function moduliDisponibili() {
  return AVAILABLE_MODULES.filter((m) => m.available === true);
}

function prezziModuliDisponibili() {
  return moduliDisponibili().map((m) => m.price);
}

function argsBuoni(extra) {
  return Object.assign(
    {
      piani: SUBSCRIPTION_PLANS,
      moduli: AVAILABLE_MODULES,
      billing: BILLING,
      prezzoAnnuoDaMensile: monthlyToAnnual,
      giorniGuidaFree: TONY_GUIDA_ONBOARDING_DAYS,
      giorniProvaModuli: GIORNI_PROVA_MODULI,
      testo: leggiTesto('functions/config/tony-landing-kb-testo.md')
    },
    extra || {}
  );
}

describe('1 — KB allineata', () => {
  it('generaContenuto coincide byte per byte con tony-landing-kb.js', () => {
    const atteso = leggiTesto('functions/config/tony-landing-kb.js');
    const generato = generaContenuto(argsBuoni());
    expect(generato, MESSAGGIO_RIGENERAZIONE).toBe(atteso);
  });
});

describe('2 — Numeri', () => {
  it('DATI_KB allineati a subscription-plans e guida', () => {
    expect(kb.DATI_KB.maxTerreniFree).toBe(SUBSCRIPTION_PLANS.free.maxTerreni);
    expect(kb.DATI_KB.maxAttivitaMeseFree).toBe(SUBSCRIPTION_PLANS.free.maxAttivitaMese);
    expect(kb.DATI_KB.prezzoBaseMese).toBe(SUBSCRIPTION_PLANS.base.price);
    expect(kb.DATI_KB.prezzoBaseAnno).toBe(
      monthlyToAnnual(SUBSCRIPTION_PLANS.base.price)
    );
    expect(kb.DATI_KB.giorniGuidaFree).toBe(TONY_GUIDA_ONBOARDING_DAYS);
    const prova = canActivateModule('free', 'vigneto');
    expect(prova.reason).toContain(kb.DATI_KB.giorniProvaModuli + ' giorni');
  });

  it('TESTO_KB contiene i numeri e non frasi vietate sui prezzi', () => {
    const t = kb.TESTO_KB;
    expect(t).toContain(String(kb.DATI_KB.maxTerreniFree));
    expect(t).toContain(String(kb.DATI_KB.maxAttivitaMeseFree));
    expect(t).toContain(String(kb.DATI_KB.giorniGuidaFree));
    expect(t).toContain(kb.DATI_KB.prezzoBaseMese + ' € al mese');
    expect(t).toContain(kb.DATI_KB.prezzoBaseAnno + " € l'anno pagati in anticipo");
    expect(t.toLowerCase()).not.toContain('per ora parti gratis');
    expect(t.toLowerCase()).not.toContain('rinnovo');
    expect(t.toLowerCase()).not.toContain('disdic');
  });
});

describe('2-bis — Range prezzi moduli', () => {
  it('min/max e testo allineati ai moduli available ora', () => {
    const prezzi = prezziModuliDisponibili();
    expect(kb.DATI_KB.prezzoModuliMin).toBe(Math.min(...prezzi));
    expect(kb.DATI_KB.prezzoModuliMax).toBe(Math.max(...prezzi));
    expect(kb.TESTO_KB).toContain(
      'da ' +
        kb.DATI_KB.prezzoModuliMin +
        ' € a ' +
        kb.DATI_KB.prezzoModuliMax +
        ' € al mese'
    );
    expect(kb.TESTO_KB).toContain('pagina Abbonamento');
  });

  it('controprove generaContenuto sul range', () => {
    const moduliCopia = structuredClone(AVAILABLE_MODULES);
    const meteo = moduliCopia.find((m) => m.id === 'meteo');
    expect(meteo).toBeTruthy();
    meteo.price = 9;
    const conNove = generaContenuto(argsBuoni({ moduli: moduliCopia }));
    expect(conNove).toContain('a 9 €');

    const moduliOliveto = structuredClone(AVAILABLE_MODULES);
    const oliveto = moduliOliveto.find((m) => m.id === 'oliveto');
    expect(oliveto).toBeTruthy();
    oliveto.price = 20;
    expect(oliveto.available).toBe(false);
    const conOliveto = generaContenuto(argsBuoni({ moduli: moduliOliveto }));
    expect(conOliveto).toContain(
      'da ' +
        kb.DATI_KB.prezzoModuliMin +
        ' € a ' +
        kb.DATI_KB.prezzoModuliMax +
        ' € al mese'
    );
    expect(conOliveto).not.toContain('a 20 €');

    const senzaPrezzo = structuredClone(AVAILABLE_MODULES);
    const vigneto = senzaPrezzo.find((m) => m.id === 'vigneto');
    vigneto.price = 0;
    expect(() => generaContenuto(argsBuoni({ moduli: senzaPrezzo }))).toThrow();

    const senzaCampo = structuredClone(AVAILABLE_MODULES);
    const frutteto = senzaCampo.find((m) => m.id === 'frutteto');
    delete frutteto.price;
    expect(() => generaContenuto(argsBuoni({ moduli: senzaCampo }))).toThrow();
  });

  it('nel TESTO_KB e ELENCO_MODULI_KB solo i quattro importi ammessi con €', () => {
    const ammessi = new Set([
      String(kb.DATI_KB.prezzoBaseMese),
      String(kb.DATI_KB.prezzoBaseAnno),
      String(kb.DATI_KB.prezzoModuliMin),
      String(kb.DATI_KB.prezzoModuliMax)
    ]);
    const insieme = kb.TESTO_KB + '\n' + kb.ELENCO_MODULI_KB;
    const trovati = insieme.match(/(\d+(?:[.,]\d+)?)\s*€/g) || [];
    for (const pezzo of trovati) {
      const num = pezzo.replace(/\s*€/, '').replace(',', '.');
      expect(ammessi.has(num) || ammessi.has(num.replace('.', ','))).toBe(true);
      // Normalizza: i prezzi interi sono senza virgola
      const intero = String(Number(num.replace(',', '.')));
      expect(ammessi.has(intero)).toBe(true);
    }
  });
});

describe('3 — Moduli', () => {
  it('id e ordine come AVAILABLE_MODULES available; niente Oliveto, prezzi, bundle', () => {
    const attesi = moduliDisponibili().map((m) => m.id);
    expect(kb.MODULI_KB.map((m) => m.id)).toEqual(attesi);
    const tutto = JSON.stringify(kb);
    expect(tutto.toLowerCase()).not.toContain('oliveto');
    for (const m of kb.MODULI_KB) {
      expect(m).not.toHaveProperty('price');
      expect(m).not.toHaveProperty('prezzo');
    }
    for (const b of BUNDLES) {
      expect(kb.TESTO_KB).not.toContain(b.name);
      expect(kb.ELENCO_MODULI_KB).not.toContain(b.name);
    }
    const vendemmia = kb.MODULI_KB.find((m) => m.id === 'vendemmiaMeccanica');
    expect(vendemmia.richiede).toEqual(['Conto Terzi']);
  });
});

describe('4 — Controlli dello script', () => {
  it('errori su testo e dati cattivi; due chiamate uguali → stessa stringa', () => {
    expect(() =>
      generaContenuto(argsBuoni({ testo: 'ciao [DA CONFERMARE: x]' }))
    ).toThrow(/DA CONFERMARE/);
    expect(() => generaContenuto(argsBuoni({ testo: '' }))).toThrow();
    expect(() =>
      generaContenuto(
        argsBuoni({
          testo: leggiTesto('functions/config/tony-landing-kb-testo.md') + '\n{{sconto}}'
        })
      )
    ).toThrow(/sconto/);
    expect(() =>
      generaContenuto(
        argsBuoni({
          testo:
            leggiTesto('functions/config/tony-landing-kb-testo.md') +
            '\nPierpaolo Rossi e mario@esempio.it'
        })
      )
    ).toThrow();
    expect(() =>
      generaContenuto(
        argsBuoni({
          piani: {
            free: SUBSCRIPTION_PLANS.free,
            base: Object.assign({}, SUBSCRIPTION_PLANS.base, { price: 0 })
          }
        })
      )
    ).toThrow();
    expect(() =>
      generaContenuto(argsBuoni({ moduli: [] }))
    ).toThrow();

    const moduliFattura = structuredClone(AVAILABLE_MODULES);
    moduliFattura.find((m) => m.id === 'meteo').description = 'Emmette fattura ai clienti';
    expect(() => generaContenuto(argsBuoni({ moduli: moduliFattura }))).toThrow();

    const moduliTratt = structuredClone(AVAILABLE_MODULES);
    moduliTratt.find((m) => m.id === 'vigneto').description = 'Gestione trattamenti vigneto';
    expect(() => generaContenuto(argsBuoni({ moduli: moduliTratt }))).toThrow();

    const testoVietato =
      leggiTesto('functions/config/tony-landing-kb-testo.md') + '\nIl prodotto è certificato.';
    expect(() => generaContenuto(argsBuoni({ testo: testoVietato }))).toThrow();

    const a = generaContenuto(argsBuoni());
    const b = generaContenuto(argsBuoni());
    expect(a).toBe(b);
  });
});

describe('5 — Parole vietate e frasi pericolose', () => {
  it('né KB né prompt contengono pezzi pericolosi', () => {
    const pezzi = [
      kb.TESTO_KB,
      kb.ELENCO_MODULI_KB,
      PROMPT_SISTEMA_LANDING
    ];
    for (const t of pezzi) {
      const low = t.toLowerCase();
      expect(low).not.toContain('certificat');
      expect(t).not.toContain('SIAN');
      expect(low).not.toContain('a norma');
      expect(t).not.toMatch(/\bregistro\b/i);
      expect(low).not.toContain('quaderno di campagna');
      expect(low).not.toContain('fattur');
      expect(t).not.toContain('Rossi');
      expect(t).not.toContain('Pierpaolo');
      expect(low).not.toContain('persona fisica');
      expect(t).not.toContain('partita IVA');
      expect(low).not.toContain('codice fiscale');
      expect(t).not.toContain('Stripe');
      expect(low).not.toContain('ti porta lì');
      expect(t).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      expect(low).not.toContain('ho salvato');
      expect(low).not.toContain('ti porto');
      expect(low).not.toContain('ti apro');
      expect(low).not.toContain('registro io');
    }
    expect(kb.TESTO_KB.toLowerCase()).not.toContain('trattament');
    expect(kb.ELENCO_MODULI_KB.toLowerCase()).not.toContain('trattament');
    expect(kb.TESTO_KB).not.toContain('[DA CONFERMARE');
    expect(kb.TESTO_KB).not.toContain('{{');
    expect(kb.ELENCO_MODULI_KB).not.toContain('{{');
    expect(kb.TESTO_KB).toContain('creato da un agricoltore');
    expect(kb.TESTO_KB).toContain('in fondo alla pagina');
  });
});

describe('6 — Regole nel prompt', () => {
  it('contiene pezzi obbligatori, KB, 12 regole, sotto 9000 caratteri', () => {
    const p = PROMPT_SISTEMA_LANDING;
    const low = p.toLowerCase();
    expect(p).toContain(FRASE_TRATTAMENTI);
    expect(low).toContain('solo');
    expect(p).toContain('GFV');
    expect(low).toContain('una sola frase');
    expect(low).toContain('non rivelare');
    expect(low).toContain('istruzioni');
    expect(low).toContain('consigli agronomici');
    expect(low).toContain('email');
    expect(low).toContain('password');
    expect(low).toContain('modulo');
    expect(p).toContain('Tony Avanzato');
    expect(low).toContain('non apre');
    expect(low).toContain('aver salvato');
    expect(low).toContain('60 parole');
    expect(low).toContain('range');
    expect(p).toContain('pagina Abbonamento');
    expect(low).toContain('intelligenza artificiale');
    expect(p).toContain('IVA');
    expect(p).toContain('Termini');
    expect(low).toContain('fondo della pagina');
    expect(low).toContain('solo se ti chiedono i limiti');
    expect(p).toContain(kb.TESTO_KB);
    expect(p).toContain(kb.ELENCO_MODULI_KB);
    expect(REGOLE_TONY_LANDING).toHaveLength(12);
    expect(p.length).toBeLessThan(9000);
  });
});

describe('7 — Isolamento', () => {
  it('file nuovi senza tenants/users né dipendenze Tony app', () => {
    const file = [
      'functions/lib/tony-landing-prompt.js',
      'functions/config/tony-landing-kb.js',
      'functions/scripts/generate-tony-landing-kb.js'
    ];
    for (const rel of file) {
      const t = leggiTesto(rel);
      expect(t).not.toMatch(/\btenants\b/);
      expect(t).not.toMatch(/\busers\b/);
      expect(t).not.toContain('firebase-admin');
      expect(t).not.toContain('handleTonyAskRequest');
      expect(t).not.toContain('tony-gemini-api');
      expect(t).not.toContain('tony-tts-provider');
      expect(t).not.toContain('require("./index")');
    }
    const promptSrc = leggiTesto('functions/lib/tony-landing-prompt.js');
    const requires = promptSrc.match(/\brequire\s*\(/g) || [];
    expect(requires).toHaveLength(1);
    expect(promptSrc).toContain('require("../config/tony-landing-kb")');
    const kbSrc = leggiTesto('functions/config/tony-landing-kb.js');
    expect(kbSrc).not.toMatch(/\brequire\s*\(/);
  });
});

describe('8 — Collegamento con la funzione', () => {
  it('tony-landing-ask usa PROMPT_SISTEMA_LANDING e non più il provvisorio', () => {
    const t = leggiTesto('functions/tony-landing-ask.js');
    expect(t).toContain('require("./lib/tony-landing-prompt")');
    expect(t).toContain('promptSistema: PROMPT_SISTEMA_LANDING');
    expect(t).not.toContain('PROMPT_SISTEMA_PROVVISORIO');
  });
});
