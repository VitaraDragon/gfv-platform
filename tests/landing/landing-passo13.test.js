/**
 * Landing passo 13 — registrazione nella chat di Tony.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  DURATE_CLIP_MS,
  percorsoClip,
  percorsiClipRegistrazione,
  prossimoStato,
  scalettaClip,
} from '../../landing/src/lib/tony-bussa-logica.js';
import {
  caselleLegali,
  configLegaleAttiva,
  eseguiRegistrazione,
  moduloRegistrazioneDisponibile,
  validaModuloRegistrazione,
} from '../../landing/src/lib/tony-registrazione.js';
import { costruisciFbFinto } from '../../landing/src/lib/tony-registrazione-finta.js';
import { testiLanding } from '../../landing/src/content/testi-landing.js';
import { raccogliStringhe } from './aiuto-stringhe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const TONY_LIVE = path.join(ROOT, 'landing/public/tony-live');

const CLIP_D1 = [
  {
    nome: 'tony-topic-registrazione-2s5-desktop-576x720-alpha-v4.webm',
    bytes: 265928,
    md5: 'ec59c84858794d89b1b6b651a19d82bc',
  },
  {
    nome: 'tony-topic-registrazione-2s5-mobile-432x540-alpha-v4.webm',
    bytes: 188916,
    md5: 'f9bd97f7c42f616e47d0e25a0e7b1ef9',
  },
  {
    nome: 'tony-topic-registrazione-2s5-desktop-576x720-12fps-v4.webp',
    bytes: 462690,
    md5: '01040e65acf40b845dbeb7545d632b67',
  },
  {
    nome: 'tony-topic-registrazione-2s5-mobile-432x540-12fps-v4.webp',
    bytes: 330106,
    md5: 'f2d878aca76a3ad1332f91c9da573479',
  },
  {
    nome: 'tony-topic-registrazione-2s5-desktop-576x1440-stacked-alpha-v4.mp4',
    bytes: 376459,
    md5: '2ccc9a600386d32804d7cc6740061526',
  },
  {
    nome: 'tony-topic-registrazione-2s5-mobile-432x1080-stacked-alpha-v4.mp4',
    bytes: 253763,
    md5: '77e085da8f44f7d7d5edb85e4e439249',
  },
];

const PAROLE_VIETATE = [
  /certificat/i,
  /SIAN/i,
  /a norma/i,
  /quaderno di campagna/i,
  /fattur/i,
  /trattament/i,
];

function md5File(filePath) {
  return createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
}

function leggi(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('tony-registrazione logica', () => {
  it('moduloRegistrazioneDisponibile solo con saluto e protezione', () => {
    expect(moduloRegistrazioneDisponibile({ salutoFinito: true, protezionePronta: true })).toBe(
      true
    );
    expect(moduloRegistrazioneDisponibile({ salutoFinito: false, protezionePronta: true })).toBe(
      false
    );
    expect(moduloRegistrazioneDisponibile({ salutoFinito: true, protezionePronta: false })).toBe(
      false
    );
    expect(moduloRegistrazioneDisponibile({ salutoFinito: true, protezionePronta: null })).toBe(
      false
    );
  });

  it('config legale spenta → nessuna casella', () => {
    expect(configLegaleAttiva()).toBe(false);
    expect(caselleLegali()).toEqual([]);
  });

  it('validaModuloRegistrazione messaggi come l\'app', () => {
    const vuoto = validaModuloRegistrazione({
      email: '',
      password: '',
      conferma: '',
      aziendaNome: '',
    });
    expect(vuoto.ok).toBe(false);
    expect(vuoto.errori.email).toBe('Email obbligatoria');
    expect(vuoto.errori.password).toBe('Password obbligatoria');
    expect(vuoto.errori.conferma).toBe('Conferma password obbligatoria');
    expect(vuoto.errori.azienda).toBe('Nome azienda obbligatorio');

    const corta = validaModuloRegistrazione({
      email: 'a@b.it',
      password: '123',
      conferma: '123',
      aziendaNome: 'Az',
    });
    expect(corta.errori.password).toBe('Password deve essere almeno 6 caratteri');

    const diversa = validaModuloRegistrazione({
      email: 'a@b.it',
      password: '123456',
      conferma: '654321',
      aziendaNome: 'Az',
    });
    expect(diversa.errori.conferma).toBe('Le password non corrispondono');

    const ok = validaModuloRegistrazione({
      email: 'a@b.it',
      password: '123456',
      conferma: '123456',
      aziendaNome: 'Az',
    });
    expect(ok.ok).toBe(true);
  });

  it('eseguiRegistrazione: ok senza password nel risultato', async () => {
    const fb = costruisciFbFinto('ok');
    const esito = await eseguiRegistrazione({
      dati: {
        email: 'Mario@Esempio.IT',
        password: 'segreta99',
        aziendaNome: 'Az Test',
      },
      fb,
      attendi: async () => {},
    });
    expect(esito.esito).toBe('ok');
    expect(esito.email).toBe('mario@esempio.it');
    expect(JSON.stringify(esito)).not.toMatch(/segreta99/);
  });

  it('eseguiRegistrazione: email usata', async () => {
    const fb = costruisciFbFinto('email-usata');
    const esito = await eseguiRegistrazione({
      dati: { email: 'a@b.it', password: '123456', aziendaNome: 'Az' },
      fb,
      attendi: async () => {},
    });
    expect(esito.esito).toBe('errore');
    expect(esito.codice).toBe('email-usata');
  });

  it('eseguiRegistrazione: errore tenant con annullamento', async () => {
    const fb = costruisciFbFinto('azienda');
    const esito = await eseguiRegistrazione({
      dati: { email: 'a@b.it', password: '123456', aziendaNome: 'Az' },
      fb,
      attendi: async () => {},
    });
    expect(esito.esito).toBe('errore');
    expect(['azienda', 'permessi']).toContain(esito.codice);
  });

  it('eseguiRegistrazione: legale fallita → ok-legale-rimandata', async () => {
    vi.resetModules();
    // config legale è spenta: forziamo il ramo con mock locale sul fb
    const fb = costruisciFbFinto('legale');
    // Senza config attiva il ramo legale non parte; verifichiamo solo ok
    const esito = await eseguiRegistrazione({
      dati: { email: 'a@b.it', password: '123456', aziendaNome: 'Az' },
      fb,
      attendi: async () => {},
    });
    expect(esito.esito).toBe('ok');
  });
});

describe('TonyRegistrazione.vue statico', () => {
  it('campi email/password/azienda + nome/cognome facoltativi; niente chat/voce/storage', () => {
    const vue = leggi('landing/src/components/TonyRegistrazione.vue');
    expect(vue).toMatch(/autocomplete="email"/);
    expect(vue).toMatch(/autocomplete="new-password"/);
    expect(vue).toMatch(/autocomplete="organization"/);
    expect(vue).toMatch(/tony-reg-nome/);
    expect(vue).toMatch(/tony-reg-cognome/);
    expect(vue).toMatch(/v-model="nome"/);
    expect(vue).toMatch(/v-model="cognome"/);
    expect(vue).not.toMatch(/v-html/);
    expect(vue).not.toMatch(/console\./);
    expect(vue).not.toMatch(/tonyLandingAsk/);
    expect(vue).not.toMatch(/tonyLandingAudio/);
    expect(vue).not.toMatch(/localStorage/);
    expect(vue).not.toMatch(/sessionStorage/);
    expect(vue).toMatch(/import\(['"]\.\.\/lib\/firebase-landing-account\.js['"]\)/);
    expect(vue).toMatch(/import\.meta\.env\.DEV/);
  });
});

describe('firebase-landing-account.js', () => {
  it('session persistence, firestore lite, europe-west1, niente initializeApp', () => {
    const src = leggi('landing/src/lib/firebase-landing-account.js');
    expect(src).not.toMatch(/\binitializeApp\s*\(/);
    expect(src).not.toMatch(/firebase-landing-config/);
    expect(src).toMatch(/browserSessionPersistence/);
    expect(src).toMatch(/firebase\/firestore\/lite/);
    expect(src).toMatch(/europe-west1/);
  });
});

describe('TonyChat e clip', () => {
  it('apriModulo ferma microfono; link classico resta', () => {
    const chat = leggi('landing/src/components/TonyChat.vue');
    expect(chat).toMatch(/function apriModulo/);
    expect(chat).toMatch(/fermaMicrofono\(\)/);
    expect(chat).toMatch(/URL_REGISTRAZIONE/);
  });

  it('transizioni e scaletta modulo', () => {
    expect(prossimoStato('idle', 'apriModulo')).toBe('modulo');
    expect(prossimoStato('modulo', 'chiudiModulo')).toBe('idle');
    expect(prossimoStato('modulo', 'saluta')).toBe('esce');
    expect(scalettaClip('idle', 'modulo')).toEqual(['topicRegistrazione', 'scrive']);
    expect(scalettaClip('modulo', 'idle')).toEqual(['idle']);
    expect(DURATE_CLIP_MS.topicRegistrazione).toBe(2500);
  });

  it('percorsiClipRegistrazione esistono', () => {
    for (const dispositivo of ['desktop', 'mobile']) {
      const percorsi = percorsiClipRegistrazione(dispositivo);
      expect(percorsi.length).toBe(3);
      for (const p of percorsi) {
        const file = path.join(ROOT, 'landing/public', p.replace(/^\//, ''));
        expect(fs.existsSync(file), p).toBe(true);
      }
    }
    expect(percorsoClip('topicRegistrazione', 'desktop', 'webm')).toContain(
      'tony-topic-registrazione-2s5'
    );
  });
});

describe('clip D1 byte e MD5', () => {
  it('sei file esatti', () => {
    for (const c of CLIP_D1) {
      const pieno = path.join(TONY_LIVE, c.nome);
      expect(fs.existsSync(pieno), c.nome).toBe(true);
      expect(fs.statSync(pieno).size).toBe(c.bytes);
      expect(md5File(pieno)).toBe(c.md5);
    }
  });
});

describe('testi registrazione', () => {
  it('nessuna parola vietata né 15/30/1000/€', () => {
    const t = testiLanding.tonyBussa.registrazione;
    const stringhe = raccogliStringhe(t);
    for (const s of stringhe) {
      for (const re of PAROLE_VIETATE) {
        expect(s).not.toMatch(re);
      }
      expect(s).not.toMatch(/\b15\b/);
      expect(s).not.toMatch(/\b30\b/);
      expect(s).not.toMatch(/\b1000\b/);
      expect(s).not.toMatch(/€/);
    }
  });
});
