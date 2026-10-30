/**
 * Passo 12a: clip Tony v6, chat a testo, filtro, stati, modello finto.
 */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  CLIP_IN_LOOP,
  DURATE_CLIP_MS,
  formatoClip,
  percorsoClip,
  percorsiClipDaPrecaricare,
  prossimoStato,
  scalettaClip,
  durataClipMs,
} from '../../landing/src/lib/tony-bussa-logica.js';
import {
  MAX_BATTUTE_STORIA,
  MAX_CARATTERI_BATTUTA_TONY,
  MAX_CARATTERI_DOMANDA,
  MESSAGGI_CHAT,
  azionePerEsito,
  aggiornaStoria,
  contieneDatiPersonaliChat,
  corpoRichiesta,
  creaLettoreSse,
  nuovaSessione,
  pulisciDomanda,
  validaDomanda,
} from '../../landing/src/lib/tony-chat-logica.js';
import { chiediATony } from '../../landing/src/lib/tony-chat-client.js';
import { chiediFinto, parametroFinto } from '../../landing/src/lib/tony-chat-finto.js';
import { URL_TONY_LANDING_ASK, TONY_BUSSA_ATTIVO } from '../../landing/src/config/landing-config.js';
import { testiLanding } from '../../landing/src/content/testi-landing.js';

const require = createRequire(import.meta.url);
const {
  COSTANTI,
  MESSAGGI,
  validaRichiesta,
  contieneDatiPersonali,
} = require('../../functions/lib/tony-landing-limiti.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const TONY_LIVE = path.join(ROOT, 'landing/public/tony-live');

const MD5_CLIP_V6 = {
  'tony-entry-h1-mano-bordo-desktop-576x1440-stacked-alpha-v6.mp4': '0d4ab6a3b68bd9b63ff0812d0abe46e0',
  'tony-entry-h1-mano-bordo-desktop-576x720-12fps-v6.webp': '921964897cca6c90808ea72f0ce12f00',
  'tony-entry-h1-mano-bordo-desktop-576x720-alpha-v6.webm': 'b4e13c14afd554c9f582fba0308632f0',
  'tony-entry-h2-saluto-mobile-432x1080-stacked-alpha-v6.mp4': 'd6e028ce48a540e5b5455876b27e0df9',
  'tony-entry-h2-saluto-mobile-432x540-12fps-v6.webp': '4560a26d02e375a08adcda90aca185d6',
  'tony-entry-h2-saluto-mobile-432x540-alpha-v6.webm': '8930dcad873f1d5fecc0dcffde280fa8',
  'tony-exit-2s-veloce-desktop-576x1440-stacked-alpha-v6.mp4': '3b08f7c5dc849c634119a3dd275a4046',
  'tony-exit-2s-veloce-desktop-576x720-12fps-v6.webp': 'c13722427d3f1dddf20b10c1f45db375',
  'tony-exit-2s-veloce-desktop-576x720-alpha-v6.webm': 'ca2f53dbdd53202420d7ab29855dc07a',
  'tony-exit-2s-veloce-mobile-432x1080-stacked-alpha-v6.mp4': 'd9eb845addf5316db37761a9b5896648',
  'tony-exit-2s-veloce-mobile-432x540-12fps-v6.webp': '3221ceae8c9bf59891482ee100f0b6b7',
  'tony-exit-2s-veloce-mobile-432x540-alpha-v6.webm': '6889eb5ea67f1397b03796901da6a5ff',
  'tony-idle-loop-desktop-576x1440-stacked-alpha-v6.mp4': '6aec7bd369a2df42f128c015bbbe106c',
  'tony-idle-loop-desktop-576x720-12fps-v6.webp': 'c39ae1212355cd78f1852c6e8d4f8f4c',
  'tony-idle-loop-desktop-576x720-alpha-v6.webm': '72d99874d148bda78165fc3af86ba0a6',
  'tony-idle-loop-mobile-432x1080-stacked-alpha-v6.mp4': 'dfbcc227914cf1563c04ce97be3cfc59',
  'tony-idle-loop-mobile-432x540-12fps-v6.webp': 'adca086758a769b37efcf022f2712e77',
  'tony-idle-loop-mobile-432x540-alpha-v6.webm': '20767a766641bdc9a8c64845277bb1ae',
  'tony-listen-loop-desktop-576x1440-stacked-alpha-v6.mp4': 'd6f28efad5c50a713c1b9b8ed8140f7a',
  'tony-listen-loop-desktop-576x720-12fps-v6.webp': '1033508cb3ac270f4213229d63e3e42c',
  'tony-listen-loop-desktop-576x720-alpha-v6.webm': 'f6993e9f15edbc50411f3439ca760ca5',
  'tony-listen-loop-mobile-432x1080-stacked-alpha-v6.mp4': '71f3d44b3fed05d84489ea2f285292fa',
  'tony-listen-loop-mobile-432x540-12fps-v6.webp': '524285cb63dd47e18565d24ff3d001d1',
  'tony-listen-loop-mobile-432x540-alpha-v6.webm': 'da474c820c2b909b8bdd137a2a91d8e5',
  'tony-listen-lower-desktop-576x1440-stacked-alpha-v6.mp4': 'f683acb3ed8808fad15b5f87c209fab7',
  'tony-listen-lower-desktop-576x720-12fps-v6.webp': 'b518f0a5a4c5702e9b520a01ac0cac97',
  'tony-listen-lower-desktop-576x720-alpha-v6.webm': 'c92b5e283b62074cd5e2d19d321648f0',
  'tony-listen-lower-mobile-432x1080-stacked-alpha-v6.mp4': '5dda79c6f94c669c367af608249278a0',
  'tony-listen-lower-mobile-432x540-12fps-v6.webp': 'debec1ac14559f98735d88a30dc588c8',
  'tony-listen-lower-mobile-432x540-alpha-v6.webm': '6c05b24fab46cf67a1379b5d0e5f96f4',
  'tony-listen-raise-desktop-576x1440-stacked-alpha-v6.mp4': '8874ad4ee2348914c9320f7965bf93c2',
  'tony-listen-raise-desktop-576x720-12fps-v6.webp': '5be5ac3d77a43b4ef752b2ceeb49ab92',
  'tony-listen-raise-desktop-576x720-alpha-v6.webm': '986332c6026b5615d6ea89ab4ab97293',
  'tony-listen-raise-mobile-432x1080-stacked-alpha-v6.mp4': '4a408576b035398f9f9a433259e3e11a',
  'tony-listen-raise-mobile-432x540-12fps-v6.webp': 'd45d948d3f1bdffecac3df8798d8e091',
  'tony-listen-raise-mobile-432x540-alpha-v6.webm': '28881cbff2ee327d6f3b79a6828ef324',
  'tony-scrive-hs1-taccuino-desktop-576x1440-stacked-alpha-v6.mp4': 'c9b789fcd14a124507fbd00b6fcda6ca',
  'tony-scrive-hs1-taccuino-desktop-576x720-12fps-v6.webp': '2654968855a1f4191ca89a36dc0e89af',
  'tony-scrive-hs1-taccuino-desktop-576x720-alpha-v6.webm': '6b527dcdb83265abb26625f8caf55955',
  'tony-scrive-hs1-taccuino-mobile-432x1080-stacked-alpha-v6.mp4': 'c4bf9ba094c806b42914e35a1074c48c',
  'tony-scrive-hs1-taccuino-mobile-432x540-12fps-v6.webp': '36f22c2a22788525d0daf30b23054a08',
  'tony-scrive-hs1-taccuino-mobile-432x540-alpha-v6.webm': 'f6836b4022cbf40327bad8a1ed75715c',
  'tony-talking-loop-desktop-576x1440-stacked-alpha-v6.mp4': '30748519611267b17e9164cbbd629fd2',
  'tony-talking-loop-desktop-576x720-12fps-v6.webp': '3fdc4c0d95bc3bea9705ad4f8930e05b',
  'tony-talking-loop-desktop-576x720-alpha-v6.webm': '9595e6cc14e0061c77b0a34c39f5fb2a',
  'tony-talking-loop-mobile-432x1080-stacked-alpha-v6.mp4': '362ef6501f6abedf0c75b56085771233',
  'tony-talking-loop-mobile-432x540-12fps-v6.webp': 'edd278ad75a97591e61c47cff331f5da',
  'tony-talking-loop-mobile-432x540-alpha-v6.webm': '6c1fe0025d428f24a320de8aa20aa8f8',
  'tony-thinking-desktop-576x1440-stacked-alpha-v6.mp4': '0bbc775e146899653155512ddd461014',
  'tony-thinking-desktop-576x720-12fps-v6.webp': '04c1d4ab1572b6876e6c7245087f53fd',
  'tony-thinking-desktop-576x720-alpha-v6.webm': '068e3baa618da1a8bca33754569046b1',
  'tony-thinking-mobile-432x1080-stacked-alpha-v6.mp4': 'b64c565c20a2209633c59e9986d7a1bb',
  'tony-thinking-mobile-432x540-12fps-v6.webp': '16163eb04f882a16f1f14156d15cc86f',
  'tony-thinking-mobile-432x540-alpha-v6.webm': 'fd2faa87725604b7b9a0c8acf0786788',
};

const NOMI_CLIP = [
  'entry',
  'idle',
  'listenRaise',
  'listenLoop',
  'listenLower',
  'thinking',
  'scrive',
  'talking',
  'exit',
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

function fileDaWeb(web) {
  return path.join(ROOT, 'landing/public', web.replace(/^\//, ''));
}

/** Clip topic (passo 13–14): ammesse fuori dai 54. */
const CLIP_TOPIC_PASSO13_14 = new Set([
  'tony-topic-poderi-2s5-desktop-576x1440-stacked-alpha-v6.mp4',
  'tony-topic-poderi-2s5-desktop-576x720-12fps-v6.webp',
  'tony-topic-poderi-2s5-desktop-576x720-alpha-v6.webm',
  'tony-topic-poderi-2s5-mobile-432x1080-stacked-alpha-v6.mp4',
  'tony-topic-poderi-2s5-mobile-432x540-12fps-v6.webp',
  'tony-topic-poderi-2s5-mobile-432x540-alpha-v6.webm',
  'tony-topic-registrazione-2s5-desktop-576x1440-stacked-alpha-v6.mp4',
  'tony-topic-registrazione-2s5-desktop-576x720-12fps-v6.webp',
  'tony-topic-registrazione-2s5-desktop-576x720-alpha-v6.webm',
  'tony-topic-registrazione-2s5-mobile-432x1080-stacked-alpha-v6.mp4',
  'tony-topic-registrazione-2s5-mobile-432x540-12fps-v6.webp',
  'tony-topic-registrazione-2s5-mobile-432x540-alpha-v6.webm',
  'tony-topic-sede-desktop-576x1440-stacked-alpha-v6.mp4',
  'tony-topic-sede-desktop-576x720-12fps-v6.webp',
  'tony-topic-sede-desktop-576x720-alpha-v6.webm',
  'tony-topic-sede-mobile-432x1080-stacked-alpha-v6.mp4',
  'tony-topic-sede-mobile-432x540-12fps-v6.webp',
  'tony-topic-sede-mobile-432x540-alpha-v6.webm',
  'tony-topic-terreni-desktop-576x1440-stacked-alpha-v6.mp4',
  'tony-topic-terreni-desktop-576x720-12fps-v6.webp',
  'tony-topic-terreni-desktop-576x720-alpha-v6.webm',
  'tony-topic-terreni-mobile-432x1080-stacked-alpha-v6.mp4',
  'tony-topic-terreni-mobile-432x540-12fps-v6.webp',
  'tony-topic-terreni-mobile-432x540-alpha-v6.webm',
]);

describe('clip v6 nel repo', () => {
  it('esattamente i 54 file di MD5_CLIP_V6 (topic esclusi)', () => {
    const files = fs
      .readdirSync(TONY_LIVE)
      .filter((f) => fs.statSync(path.join(TONY_LIVE, f)).isFile())
      .filter((f) => !CLIP_TOPIC_PASSO13_14.has(f))
      .sort();
    const attesi = Object.keys(MD5_CLIP_V6).sort();
    expect(files).toEqual(attesi);
    for (const nome of attesi) {
      expect(md5File(path.join(TONY_LIVE, nome))).toBe(MD5_CLIP_V6[nome]);
    }
    for (const nome of files) {
      expect(nome.includes('-v6')).toBe(true);
      expect(nome.startsWith('tony-topic-')).toBe(false);
      expect(nome.startsWith('tony-thinking-2s5')).toBe(false);
      expect(nome.endsWith('.wav')).toBe(false);
      expect(nome.endsWith('.zip')).toBe(false);
      expect(nome.endsWith('.md')).toBe(false);
      expect(nome).not.toBe('tony-stacked-alpha-player.js');
    }
  });

  it('tutte le clip usano v6 (niente override talking)', () => {
    for (const nome of NOMI_CLIP) {
      for (const variante of ['desktop', 'mobile']) {
        for (const formato of ['webm', 'webp', 'stacked']) {
          const web = percorsoClip(nome, variante, formato);
          expect(web).toContain('-v6.');
          expect(fs.existsSync(fileDaWeb(web)), web).toBe(true);
        }
      }
    }
  });
});

describe('percorsi e durate', () => {
  it('percorsoClip per ogni clip/variante/formato esiste', () => {
    for (const nome of NOMI_CLIP) {
      for (const variante of ['desktop', 'mobile']) {
        for (const formato of ['webm', 'webp', 'stacked']) {
          const web = percorsoClip(nome, variante, formato);
          expect(web, `${nome}/${variante}/${formato}`).toBeTruthy();
          expect(fs.existsSync(fileDaWeb(web)), web).toBe(true);
        }
      }
    }
    expect(percorsoClip('entry', 'desktop', 'webm')).toContain('entry-h1-mano-bordo');
    expect(percorsoClip('entry', 'mobile', 'webm')).toContain('entry-h2-saluto');
    expect(percorsoClip('exit', 'desktop', 'webm')).toContain('exit-2s-veloce');
    expect(percorsoClip('sconosciuta', 'desktop', 'webm')).toBe('');
    expect(percorsoClip('idle', 'desktop', 'avi')).toBe('');
  });

  it('durate e CLIP_IN_LOOP', () => {
    expect(durataClipMs('entry', 'desktop')).toBe(3042);
    expect(durataClipMs('entry', 'mobile')).toBe(2708);
    expect(durataClipMs('idle')).toBe(4000);
    expect(durataClipMs('listenRaise')).toBe(1833);
    expect(durataClipMs('listenLoop')).toBe(2583);
    expect(durataClipMs('listenLower')).toBe(1833);
    expect(durataClipMs('thinking')).toBe(2375);
    expect(durataClipMs('scrive')).toBe(3583);
    expect(durataClipMs('talking')).toBe(7500);
    expect(durataClipMs('exit')).toBe(2000);
    expect(DURATE_CLIP_MS.idle).toBe(4000);
    expect([...CLIP_IN_LOOP]).toEqual(['idle', 'listenLoop', 'scrive', 'talking']);
  });

  it('pesi sotto i limiti', () => {
    const limiteTotale = { desktop: 6200000, mobile: 4400000 };
    const limiteEntry = { desktop: 1.8 * 1024 * 1024, mobile: 1.2 * 1024 * 1024 };
    const limiteLoop = { desktop: 850 * 1024, mobile: 600 * 1024 };
    // talking v6 ~7,5 s: WebP desktop ~1,72 MB
    const limiteTalking = { desktop: 1.8 * 1024 * 1024, mobile: 1.25 * 1024 * 1024 };
    for (const variante of ['desktop', 'mobile']) {
      for (const formato of ['webm', 'webp', 'stacked']) {
        let somma = 0;
        for (const nome of NOMI_CLIP) {
          const web = percorsoClip(nome, variante, formato);
          const size = fs.statSync(fileDaWeb(web)).size;
          somma += size;
          if (nome === 'entry') expect(size).toBeLessThanOrEqual(limiteEntry[variante]);
          if (nome === 'talking') {
            expect(size).toBeLessThanOrEqual(limiteTalking[variante]);
          } else if (CLIP_IN_LOOP.includes(nome)) {
            expect(size).toBeLessThanOrEqual(limiteLoop[variante]);
          }
        }
        expect(somma).toBeLessThanOrEqual(limiteTotale[variante]);
        expect(percorsiClipDaPrecaricare(variante, formato).length).toBe(9);
      }
    }
  });
});

describe('formatoClip Safari → webp', () => {
  const SAFARI_MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
  const IPHONE_SAFARI =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const IPHONE_CHROME =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/118.0.5993.69 Mobile/15E148 Safari/604.1';
  const CHROME_MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36';
  const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36';
  const EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36 Edg/118.0.0.0';
  const FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/118.0';
  const ANDROID =
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36';

  it('Safari e iOS → webp', () => {
    expect(formatoClip({ userAgent: SAFARI_MAC, webmAlfaSupportato: true })).toBe('webp');
    expect(formatoClip({ userAgent: IPHONE_SAFARI, webmAlfaSupportato: true })).toBe('webp');
    expect(formatoClip({ userAgent: IPHONE_CHROME, webmAlfaSupportato: true })).toBe('webp');
    expect(
      formatoClip({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15',
        maxTouchPoints: 5,
        webmAlfaSupportato: true,
      })
    ).toBe('webp');
  });

  it('Chrome/Edge/Firefox/Android con WebM → webm, senza → stacked', () => {
    expect(
      formatoClip({ userAgent: CHROME_MAC, maxTouchPoints: 0, webmAlfaSupportato: true })
    ).toBe('webm');
    for (const ua of [CHROME, EDGE, FIREFOX, ANDROID]) {
      expect(formatoClip({ userAgent: ua, webmAlfaSupportato: true })).toBe('webm');
    }
    expect(formatoClip({ userAgent: CHROME, webmAlfaSupportato: false })).toBe('stacked');
  });
});

describe('stati e scalettaClip', () => {
  it('transizioni nuove e vecchie', () => {
    expect(prossimoStato('idle', 'ascoltoIniziato')).toBe('ascolta');
    expect(prossimoStato('ascolta', 'ascoltoFinito')).toBe('idle');
    expect(prossimoStato('idle', 'domandaInviata')).toBe('pensa');
    expect(prossimoStato('ascolta', 'domandaInviata')).toBe('pensa');
    expect(prossimoStato('pensa', 'testoArrivato')).toBe('scrive');
    expect(prossimoStato('scrive', 'rispostaFinita')).toBe('idle');
    expect(prossimoStato('pensa', 'rispostaFinita')).toBe('idle');
    expect(prossimoStato('idle', 'servizioSpento')).toBe('idle');
    expect(prossimoStato('idle', 'voceIniziata')).toBe('parla');
    expect(prossimoStato('parla', 'voceFinita')).toBe('idle');
    expect(prossimoStato('statico', 'domandaInviata')).toBe('statico');
    expect(prossimoStato('statico', 'saluta')).toBe('esce');
    expect(prossimoStato('entra', 'entrataFinita')).toBe('idle');
  });

  it('scalettaClip', () => {
    expect(scalettaClip('entra', 'idle')).toEqual([]);
    expect(scalettaClip('idle', 'ascolta')).toEqual(['listenRaise', 'listenLoop']);
    expect(scalettaClip('ascolta', 'idle')).toEqual(['listenLower', 'idle']);
    expect(scalettaClip('ascolta', 'pensa')).toEqual(['listenLower', 'thinking']);
    expect(scalettaClip('idle', 'pensa')).toEqual(['thinking']);
    expect(scalettaClip('pensa', 'scrive')).toEqual(['scrive']);
    expect(scalettaClip('scrive', 'idle')).toEqual(['idle']);
    expect(scalettaClip('pensa', 'idle')).toEqual(['idle']);
    expect(scalettaClip('idle', 'parla')).toEqual(['talking']);
    expect(scalettaClip('parla', 'idle')).toEqual(['idle']);
    expect(scalettaClip('idle', 'esce')).toEqual(['exit']);
    expect(scalettaClip('pensa', 'statico')).toEqual([]);
  });
});

describe('logica chat', () => {
  it('pulisci e valida', () => {
    expect(pulisciDomanda('  ciao   mondo  ')).toBe('ciao mondo');
    expect(validaDomanda('').ok).toBe(false);
    expect(validaDomanda('').motivo).toBe('vuota');
    expect(validaDomanda('a'.repeat(300)).ok).toBe(true);
    expect(validaDomanda('a'.repeat(301)).motivo).toBe('troppo-lunga');
    expect(validaDomanda('mario@example.com').motivo).toBe('dati-personali');
  });

  it('sessione e storia', () => {
    const s1 = nuovaSessione(() => 'abcdef0123456789');
    expect(s1.length).toBeGreaterThanOrEqual(16);
    expect(s1.length).toBeLessThanOrEqual(64);
    expect(/^[A-Za-z0-9-]+$/.test(s1)).toBe(true);
    const s2 = nuovaSessione();
    expect(s2.length).toBeGreaterThanOrEqual(16);
    const base = [{ ruolo: 'utente', testo: 'a' }];
    const nuova = aggiornaStoria(base, { ruolo: 'tony', testo: 'b'.repeat(700) });
    expect(base.length).toBe(1);
    expect(nuova[1].testo.length).toBe(600);
    let storia = [];
    for (let i = 0; i < 8; i += 1) {
      storia = aggiornaStoria(storia, {
        ruolo: i % 2 === 0 ? 'utente' : 'tony',
        testo: 'x' + i,
      });
    }
    expect(storia.length).toBe(6);
    const corpo = corpoRichiesta({ domanda: 'Ciao', sessione: s1, storia });
    expect(Object.keys(corpo).sort()).toEqual(['domanda', 'sessione', 'storia']);
  });

  it('allineato alla funzione', () => {
    expect(MAX_CARATTERI_DOMANDA).toBe(COSTANTI.MAX_CARATTERI_DOMANDA);
    expect(MAX_BATTUTE_STORIA).toBe(COSTANTI.MAX_BATTUTE_STORIA);
    expect(MAX_CARATTERI_BATTUTA_TONY).toBe(COSTANTI.MAX_CARATTERI_BATTUTA_TONY);
    for (const k of Object.keys(MESSAGGI_CHAT)) {
      expect(MESSAGGI_CHAT[k]).toBe(MESSAGGI[k]);
    }
    const sess = nuovaSessione(() => 'abcdef0123456789-XYZ');
    let storia = [];
    for (let i = 0; i < 8; i += 1) {
      storia = aggiornaStoria(storia, {
        ruolo: i % 2 === 0 ? 'utente' : 'tony',
        testo: 'battuta ' + i,
      });
    }
    const corpo = corpoRichiesta({ domanda: 'Quanto costa?', sessione: sess, storia });
    const v = validaRichiesta(corpo);
    expect(v.ok).toBe(true);
    const sess2 = nuovaSessione();
    expect(validaRichiesta(corpoRichiesta({ domanda: 'Ciao', sessione: sess2, storia: [] })).ok).toBe(
      true
    );
  });
});

describe('filtro dati personali', () => {
  const bloccati = [
    'mario.rossi@example.com',
    'Scrivi a Mario.Rossi@Example.COM per favore',
    'password: prova123',
    'pwd=segreta',
    'passwd: abc',
    'pass=xyz',
    'la mia password è segreta',
    'PASSWORD: MAIUSCOLE',
    'la password sarebbe prova',
    'email test@gfvagri.com',
    'user@dominio.it ciao',
    "parola d'ordine: 1234",
  ];
  const ok = [
    'Come cambio la password?',
    'Ho dimenticato la password, cosa faccio?',
    'Ho perso la mia password, come faccio?',
    'Serve una password per entrare?',
    'Quanto costa?',
    'Cosa fa GFV?',
    'ci vediamo @ casa',
    'Come funziona il login?',
  ];

  it('blocca e lascia passare', () => {
    for (const t of bloccati) expect(contieneDatiPersonaliChat(t), t).toBe(true);
    for (const t of ok) expect(contieneDatiPersonaliChat(t), t).toBe(false);
  });

  it('tutto ciò che blocca la funzione lo blocca anche la pagina', () => {
    const esempiFunzione = [
      'a@b.co',
      'password: x',
      'Password=y',
      'testo password: valore',
    ];
    for (const t of esempiFunzione) {
      if (contieneDatiPersonali(t)) {
        expect(contieneDatiPersonaliChat(t), t).toBe(true);
      }
    }
  });
});

describe('lettore SSE', () => {
  const esempio =
    ': tony-landing-ask-open\n\n' +
    'event: chunk\ndata: {"delta":"Ciao "}\n\n' +
    'event: chunk\ndata: {"delta":"mondo"}\n\n' +
    'event: chunk\ndata: {"delta":"!"}\n\n' +
    'event: done\ndata: {"codice":"ok","testo":"Ciao mondo!","voce":false,"domandeRimaste":14,"mostraRegistrazione":false}\n\n';

  it('commento, chunk e done anche spezzati', () => {
    for (let taglio = 1; taglio < esempio.length; taglio += 7) {
      const lettore = creaLettoreSse();
      const eventi = [
        ...lettore.aggiungi(esempio.slice(0, taglio)),
        ...lettore.aggiungi(esempio.slice(taglio)),
      ];
      const chunk = eventi.filter((e) => e.evento === 'chunk');
      const done = eventi.filter((e) => e.evento === 'done');
      expect(chunk.length).toBe(3);
      expect(done.length).toBe(1);
      expect(done[0].dati.codice).toBe('ok');
    }
  });

  it('\\r\\n e JSON rotto', () => {
    const lettore = creaLettoreSse();
    const ev = lettore.aggiungi(
      'event: chunk\r\ndata: {"delta":"ok"}\r\n\r\nevent: chunk\r\ndata: {rotto\r\n\r\n'
    );
    expect(ev.some((e) => e.evento === 'chunk' && e.dati.delta === 'ok')).toBe(true);
    expect(() => lettore.aggiungi('event: done\ndata: {no\n\n')).not.toThrow();
  });
});

describe('azionePerEsito', () => {
  it('tabella C5', () => {
    expect(azionePerEsito({ codice: 'ok', testo: 'Ciao', domandeRimaste: 3 }).tipo).toBe(
      'risposta'
    );
    expect(azionePerEsito({ codice: 'ok', testo: '', domandeRimaste: 3 }).testo).toBe(
      MESSAGGI_CHAT.errore
    );
    expect(azionePerEsito({ codice: 'ok', testo: 'x', domandeRimaste: 0 }).tipo).toBe('limite');
    expect(azionePerEsito({ codice: 'limite-sessione', testo: 'Limite' }).tipo).toBe('limite');
    expect(azionePerEsito({ codice: 'limite-giorno', testo: 'Limite' }).campoAttivo).toBe(false);
    expect(azionePerEsito({ codice: 'dati-personali', testo: 'D' }).tipo).toBe('filtro');
    expect(azionePerEsito({ codice: 'spento', testo: 'S' }).tipo).toBe('statico');
    expect(azionePerEsito({ codice: 'tetto', testo: 'T' }).tipo).toBe('statico');
    expect(azionePerEsito({ codice: 'limite-globale', testo: 'G' }).tipo).toBe('statico');
    expect(azionePerEsito({ codice: 'errore' }).tipo).toBe('statico');
    expect(azionePerEsito({ codice: 'app-check-mancante' }).testo).toBe(MESSAGGI_CHAT.spento);
    expect(azionePerEsito({ http: 401, codice: 'x' }).tipo).toBe('statico');
    expect(azionePerEsito({ http: 503 }).tipo).toBe('statico');
    expect(azionePerEsito({ codice: 'rete' }).tipo).toBe('statico');
    expect(azionePerEsito({ codice: 'boh' }).tipo).toBe('statico');
  });
});

describe('chiediATony con fetch finto', () => {
  it('token null → nessuna rete', async () => {
    let chiamate = 0;
    const esito = await chiediATony({
      domanda: 'Ciao',
      sessione: 'abcdef0123456789',
      storia: [],
      ottieniToken: async () => null,
      fetchFn: async () => {
        chiamate += 1;
        return new Response('');
      },
    });
    expect(chiamate).toBe(0);
    expect(esito.codice).toBe('app-check-mancante');
  });

  it('POST, header e stream', async () => {
    const pezzi = [];
    const body =
      ': open\n\nevent: chunk\ndata: {"delta":"He"}\n\nevent: chunk\ndata: {"delta":"i"}\n\nevent: done\ndata: {"codice":"ok","testo":"Hei","voce":false,"domandeRimaste":13,"mostraRegistrazione":false}\n\n';
    const encoder = new TextEncoder();
    const esito = await chiediATony({
      domanda: 'Ciao',
      sessione: 'abcdef0123456789',
      storia: [],
      ottieniToken: async () => 'tok-test',
      onPezzo: (d) => pezzi.push(d),
      fetchFn: async (url, opts) => {
        expect(url).toBe(URL_TONY_LANDING_ASK);
        expect(opts.method).toBe('POST');
        expect(opts.headers['Content-Type']).toBe('application/json');
        expect(opts.headers['X-Firebase-AppCheck']).toBe('tok-test');
        const corpo = JSON.parse(opts.body);
        expect(Object.keys(corpo).sort()).toEqual(['domanda', 'sessione', 'storia']);
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(body));
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      },
    });
    expect(pezzi.join('')).toBe('Hei');
    expect(esito.codice).toBe('ok');
    expect(esito.testo).toBe('Hei');
  });

  it('401/503/senza done/fetch che lancia', async () => {
    const e401 = await chiediATony({
      domanda: 'x',
      sessione: 'abcdef0123456789',
      storia: [],
      ottieniToken: async () => 't',
      fetchFn: async () =>
        new Response(JSON.stringify({ codice: 'app-check-non-valido' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
    });
    expect(e401.http).toBe(401);

    const e503 = await chiediATony({
      domanda: 'x',
      sessione: 'abcdef0123456789',
      storia: [],
      ottieniToken: async () => 't',
      fetchFn: async () => new Response('{}', { status: 503 }),
    });
    expect(e503.http).toBe(503);

    const senzaDone = await chiediATony({
      domanda: 'x',
      sessione: 'abcdef0123456789',
      storia: [],
      ottieniToken: async () => 't',
      fetchFn: async () => {
        const stream = new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode('event: chunk\ndata: {"delta":"a"}\n\n'));
            c.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      },
    });
    expect(senzaDone.codice).toBe('errore');

    const rete = await chiediATony({
      domanda: 'x',
      sessione: 'abcdef0123456789',
      storia: [],
      ottieniToken: async () => 't',
      fetchFn: async () => {
        throw new Error('offline');
      },
    });
    expect(rete.codice).toBe('rete');
  });
});

describe('modello finto', () => {
  it('parametroFinto', () => {
    expect(parametroFinto('')).toBe(null);
    expect(parametroFinto('?tonyfinto=1')).toBe('ok');
    expect(parametroFinto('?tonyfinto=spento')).toBe('spento');
    expect(parametroFinto('?tonyfinto=xyz')).toBe('ok');
  });

  it('chiediFinto scenari', async () => {
    vi.useFakeTimers();
    const pezzi = [];
    const p = chiediFinto({
      domanda: 'Cosa fa GFV?',
      storia: [],
      sessione: 'abcdef0123456789',
      onPezzo: (d) => pezzi.push(d),
      scenario: 'ok',
      sleepFn: (ms) => new Promise((r) => setTimeout(r, ms)),
    });
    await vi.runAllTimersAsync();
    const esito = await p;
    expect(esito.codice).toBe('ok');
    expect(pezzi.length).toBeGreaterThan(0);

    for (const [sc, codice] of [
      ['spento', 'spento'],
      ['tetto', 'tetto'],
      ['limite', 'limite-sessione'],
      ['dati', 'dati-personali'],
      ['errore', 'errore'],
      ['rete', 'rete'],
      ['appcheck', 'app-check-mancante'],
    ]) {
      const e = await chiediFinto({
        domanda: 'x',
        storia: [],
        sessione: 'abcdef0123456789',
        scenario: sc,
        sleepFn: async () => {},
      });
      expect(e.codice).toBe(codice);
    }
    vi.useRealTimers();
  });
});

describe('firebase e rete nei file nuovi', () => {
  const nuovi = [
    'landing/src/lib/tony-chat-logica.js',
    'landing/src/lib/tony-chat-client.js',
    'landing/src/lib/tony-chat-finto.js',
    'landing/src/lib/tony-clip-player.js',
    'landing/src/components/TonyChat.vue',
  ];

  it('nessun firebase nei file nuovi; finto solo in DEV', () => {
    for (const rel of nuovi) {
      const testo = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(testo.toLowerCase()).not.toContain('firebase-landing');
      expect(testo).not.toMatch(/from ['"]firebase\//);
      expect(testo).not.toContain('initializeApp');
    }
    const client = fs.readFileSync(path.join(ROOT, 'landing/src/lib/tony-chat-client.js'), 'utf8');
    expect(client).not.toContain('tony-chat-finto');
    const chat = fs.readFileSync(path.join(ROOT, 'landing/src/components/TonyChat.vue'), 'utf8');
    expect(chat).toMatch(/import\.meta\.env\.DEV/);
    expect(chat).toMatch(/import\(['"]\.\.\/lib\/tony-chat-finto/);
    expect(chat).not.toContain('tonyfinto');
    expect(chat).not.toContain('modello finto');
    const logica = fs.readFileSync(
      path.join(ROOT, 'landing/src/lib/tony-chat-logica.js'),
      'utf8'
    );
    expect(logica).not.toContain('tonyfinto');
    expect(URL_TONY_LANDING_ASK).toBe(
      'https://europe-west1-gfv-platform.cloudfunctions.net/tonyLandingAsk'
    );
    const config = fs.readFileSync(path.join(ROOT, 'landing/src/config/landing-config.js'), 'utf8');
    expect(config).toContain(URL_TONY_LANDING_ASK);
    for (const rel of nuovi) {
      if (rel.includes('landing-config')) continue;
      const t = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      if (rel.includes('tony-chat-client') || rel.includes('tony-chat-finto')) continue;
      expect(t).not.toContain('europe-west1-gfv-platform.cloudfunctions.net/tonyLandingAsk');
    }
  });
});

describe('testi e flag', () => {
  it('etichetta, chip, niente parole vietate né numeri limiti', () => {
    const tb = testiLanding.tonyBussa;
    expect(tb.etichetta).toBe('Tony · assistente virtuale con IA');
    expect(tb.chip).toEqual(['Cosa fa GFV?', 'Quanto costa?', 'Come mi aiuta Tony?']);
    const nuovi = [
      ...tb.chip,
      tb.segnapostoCampo,
      tb.invia,
      tb.microfono,
      tb.microfonoMobile,
      tb.ascolto,
      tb.pensaLettoreSchermo,
      tb.domandaNascosta,
      tb.troppoLunga,
      tb.etichettaCampo,
      ...Object.values(MESSAGGI_CHAT),
    ].join('\n');
    for (const re of PAROLE_VIETATE) expect(nuovi).not.toMatch(re);
    expect(nuovi).not.toMatch(/\b15\b/);
    expect(nuovi).not.toMatch(/\b30\b/);
    expect(nuovi).not.toMatch(/\b1000\b/);
    expect(nuovi).not.toContain('€');
    expect(TONY_BUSSA_ATTIVO).toBe(false);
  });

  it('nessun console del testo nei file nuovi', () => {
    const nuovi = [
      'landing/src/lib/tony-chat-logica.js',
      'landing/src/lib/tony-chat-client.js',
      'landing/src/lib/tony-chat-finto.js',
      'landing/src/lib/tony-clip-player.js',
      'landing/src/components/TonyChat.vue',
    ];
    for (const rel of nuovi) {
      const testo = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(testo).not.toMatch(/console\.\w+\([^)]*\b(domanda|delta)\b/);
    }
  });
});
