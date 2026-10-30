/**
 * Passo 12a: clip Tony v4, chat a testo, filtro, stati, modello finto.
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

const MD5_CLIP_V4 = {
  'tony-entry-h1-mano-bordo-desktop-576x1440-stacked-alpha-v4.mp4': 'd56145655e8373b5578a0dd5d9610a6e',
  'tony-entry-h1-mano-bordo-desktop-576x720-12fps-v4.webp': '5d2be8ecbde35ef42cecee37453e570e',
  'tony-entry-h1-mano-bordo-desktop-576x720-alpha-v4.webm': 'efe331379028544ba78604e004de4fc9',
  'tony-entry-h2-saluto-mobile-432x1080-stacked-alpha-v4.mp4': '9af9c5fcf8d254b022ec1dffdf020d6e',
  'tony-entry-h2-saluto-mobile-432x540-12fps-v4.webp': '3c8a63ba37537598b062333eda0a9d30',
  'tony-entry-h2-saluto-mobile-432x540-alpha-v4.webm': '2d5b6090acabeec97a056f6eae23cf85',
  'tony-exit-2s-veloce-desktop-576x1440-stacked-alpha-v4.mp4': 'eb06615729a399db74a451a87496a3c3',
  'tony-exit-2s-veloce-desktop-576x720-12fps-v4.webp': '48c1e929682ba893a3b8e7799fd38d42',
  'tony-exit-2s-veloce-desktop-576x720-alpha-v4.webm': '4bea84f390f7281010ed5031582a5634',
  'tony-exit-2s-veloce-mobile-432x1080-stacked-alpha-v4.mp4': 'a308205084e51f5afa80e527d30f8a1a',
  'tony-exit-2s-veloce-mobile-432x540-12fps-v4.webp': 'b9eb6db5ccc22c103870aff67875b041',
  'tony-exit-2s-veloce-mobile-432x540-alpha-v4.webm': 'aebc9ca0739d7c29bc01721175eecfaf',
  'tony-idle-loop-desktop-576x1440-stacked-alpha-v4.mp4': '3ec4e3161deabab75ad8346ed483d331',
  'tony-idle-loop-desktop-576x720-12fps-v4.webp': 'a7912e776d0e136e3250fd4b24a38e9d',
  'tony-idle-loop-desktop-576x720-alpha-v4.webm': 'f7d97adbe05451b99bc26cce15c61f72',
  'tony-idle-loop-mobile-432x1080-stacked-alpha-v4.mp4': 'f5e7a7fcbadd9e92e1ca09e338ac676e',
  'tony-idle-loop-mobile-432x540-12fps-v4.webp': 'd393429f4e4a13a7c8381087849a7ca5',
  'tony-idle-loop-mobile-432x540-alpha-v4.webm': 'd568f9399c088ff5ddb842fc8f1443ab',
  'tony-listen-loop-desktop-576x1440-stacked-alpha-v4.mp4': 'd37b7fe09faa8458ee41ce678271880c',
  'tony-listen-loop-desktop-576x720-12fps-v4.webp': '4b7e652caa2d758e567ae14c6539e639',
  'tony-listen-loop-desktop-576x720-alpha-v4.webm': '234abd9d738225634cc1ce622da33dcd',
  'tony-listen-loop-mobile-432x1080-stacked-alpha-v4.mp4': '2a5c716faf6a92d478204c30f09de036',
  'tony-listen-loop-mobile-432x540-12fps-v4.webp': '2eddaa4985e9f3f89e5764ac9f8d811f',
  'tony-listen-loop-mobile-432x540-alpha-v4.webm': '7b5c2b9ef1cf69b55c323bea027ccda2',
  'tony-listen-lower-desktop-576x1440-stacked-alpha-v4.mp4': '24694a41610cc29d9df13b92f6f7ba17',
  'tony-listen-lower-desktop-576x720-12fps-v4.webp': '2af3bb3e137d3692fabc8e1fbdeb6c34',
  'tony-listen-lower-desktop-576x720-alpha-v4.webm': '3e8a3ba29727110314befa6e62041ec3',
  'tony-listen-lower-mobile-432x1080-stacked-alpha-v4.mp4': '3a53433b12db302b0668e4126d0ef7b5',
  'tony-listen-lower-mobile-432x540-12fps-v4.webp': 'e15717fdd9f3318d5f4d2bb347f0e00a',
  'tony-listen-lower-mobile-432x540-alpha-v4.webm': 'b4f983181e8e76ce4f8995313c01476c',
  'tony-listen-raise-desktop-576x1440-stacked-alpha-v4.mp4': '59604dcfca61860c3b7e1d42ce564312',
  'tony-listen-raise-desktop-576x720-12fps-v4.webp': 'fbd7169dba1b12c7feebb8c079328c9c',
  'tony-listen-raise-desktop-576x720-alpha-v4.webm': 'ecd3727151bcfe2053cecb1255539e9b',
  'tony-listen-raise-mobile-432x1080-stacked-alpha-v4.mp4': 'cccf8e1a45e4b2f43b7ed8a112be633d',
  'tony-listen-raise-mobile-432x540-12fps-v4.webp': 'c47b15d502425f34e4cbc50513444e1f',
  'tony-listen-raise-mobile-432x540-alpha-v4.webm': 'cfa3910a9d072fdd4479f2868c7a7ad1',
  'tony-scrive-hs1-taccuino-desktop-576x1440-stacked-alpha-v4.mp4': '80eafb8b4709d422827d35964c6d4c99',
  'tony-scrive-hs1-taccuino-desktop-576x720-12fps-v4.webp': 'a4419d1891be94e455431a51ef0c1374',
  'tony-scrive-hs1-taccuino-desktop-576x720-alpha-v4.webm': 'a09868735f2aa35dd910f555fce79db8',
  'tony-scrive-hs1-taccuino-mobile-432x1080-stacked-alpha-v4.mp4': 'c033cb1eefdd125f495d92d1bcbb12b3',
  'tony-scrive-hs1-taccuino-mobile-432x540-12fps-v4.webp': 'afed906ae0d71312e82ee05c69c591e3',
  'tony-scrive-hs1-taccuino-mobile-432x540-alpha-v4.webm': '4ecd2635a7b28d8e1d976302c1803dfa',
  'tony-talking-loop-desktop-576x1440-stacked-alpha-v4.mp4': 'a50677306973eaa238abff916c8b823e',
  'tony-talking-loop-desktop-576x720-12fps-v4.webp': 'b0d4ee75e94a98c24e2a04201be6d4a5',
  'tony-talking-loop-desktop-576x720-alpha-v4.webm': '1a8dff2e47acd898ae2ee700400d5a22',
  'tony-talking-loop-mobile-432x1080-stacked-alpha-v4.mp4': '8b712f99d6f4061e62560f3d2491a713',
  'tony-talking-loop-mobile-432x540-12fps-v4.webp': 'bd8e6efd97121ba3f78ddc87235eeca3',
  'tony-talking-loop-mobile-432x540-alpha-v4.webm': '2a51eec56aa831725bb6b3f2e0db1c34',
  'tony-thinking-desktop-576x1440-stacked-alpha-v4.mp4': '887d30efe60f78c49cc64b4eaa161b79',
  'tony-thinking-desktop-576x720-12fps-v4.webp': 'eee5541808e692bac1baa9bc562c8300',
  'tony-thinking-desktop-576x720-alpha-v4.webm': 'e0d10e7dc4e262b726e2995bb01432cc',
  'tony-thinking-mobile-432x1080-stacked-alpha-v4.mp4': '8d3058d9671db5e4641152039ee4aa3d',
  'tony-thinking-mobile-432x540-12fps-v4.webp': 'a98b55558157035410f71ecc5517a3cc',
  'tony-thinking-mobile-432x540-alpha-v4.webm': 'b837e6576e5c5d91b83deefd8a93a694',
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

/** Clip topic registrazione (passo 13) e sede/poderi/terreni (passo 14): ammesse fuori dai 54. */
const CLIP_TOPIC_REGISTRAZIONE_PASSO13 = new Set([
  'tony-topic-registrazione-2s5-desktop-576x720-alpha-v4.webm',
  'tony-topic-registrazione-2s5-mobile-432x540-alpha-v4.webm',
  'tony-topic-registrazione-2s5-desktop-576x720-12fps-v4.webp',
  'tony-topic-registrazione-2s5-mobile-432x540-12fps-v4.webp',
  'tony-topic-registrazione-2s5-desktop-576x1440-stacked-alpha-v4.mp4',
  'tony-topic-registrazione-2s5-mobile-432x1080-stacked-alpha-v4.mp4',
  'tony-topic-sede-desktop-576x720-alpha-v4.webm',
  'tony-topic-sede-mobile-432x540-alpha-v4.webm',
  'tony-topic-sede-desktop-576x720-12fps-v4.webp',
  'tony-topic-sede-mobile-432x540-12fps-v4.webp',
  'tony-topic-sede-desktop-576x1440-stacked-alpha-v4.mp4',
  'tony-topic-sede-mobile-432x1080-stacked-alpha-v4.mp4',
  'tony-topic-poderi-2s5-desktop-576x720-alpha-v4.webm',
  'tony-topic-poderi-2s5-mobile-432x540-alpha-v4.webm',
  'tony-topic-poderi-2s5-desktop-576x720-12fps-v4.webp',
  'tony-topic-poderi-2s5-mobile-432x540-12fps-v4.webp',
  'tony-topic-poderi-2s5-desktop-576x1440-stacked-alpha-v4.mp4',
  'tony-topic-poderi-2s5-mobile-432x1080-stacked-alpha-v4.mp4',
  'tony-topic-terreni-desktop-576x720-alpha-v4.webm',
  'tony-topic-terreni-mobile-432x540-alpha-v4.webm',
  'tony-topic-terreni-desktop-576x720-12fps-v4.webp',
  'tony-topic-terreni-mobile-432x540-12fps-v4.webp',
  'tony-topic-terreni-desktop-576x1440-stacked-alpha-v4.mp4',
  'tony-topic-terreni-mobile-432x1080-stacked-alpha-v4.mp4',
]);

const CLIP_TALKING_V5 = new Set([
  'tony-talking-loop-desktop-576x1440-stacked-alpha-v5.mp4',
  'tony-talking-loop-desktop-576x720-12fps-v5.webp',
  'tony-talking-loop-desktop-576x720-alpha-v5.webm',
  'tony-talking-loop-mobile-432x1080-stacked-alpha-v5.mp4',
  'tony-talking-loop-mobile-432x540-12fps-v5.webp',
  'tony-talking-loop-mobile-432x540-alpha-v5.webm',
]);

describe('clip v4 nel repo', () => {
  it('esattamente i 54 file di MD5_CLIP_V4 (talking v5 esclusa)', () => {
    const files = fs
      .readdirSync(TONY_LIVE)
      .filter((f) => fs.statSync(path.join(TONY_LIVE, f)).isFile())
      .filter((f) => !CLIP_TOPIC_REGISTRAZIONE_PASSO13.has(f))
      .filter((f) => !CLIP_TALKING_V5.has(f))
      .sort();
    const attesi = Object.keys(MD5_CLIP_V4).sort();
    expect(files).toEqual(attesi);
    for (const nome of attesi) {
      expect(md5File(path.join(TONY_LIVE, nome))).toBe(MD5_CLIP_V4[nome]);
    }
    for (const nome of files) {
      expect(nome.includes('-v4')).toBe(true);
      expect(nome.startsWith('tony-topic-')).toBe(false);
      expect(nome.startsWith('tony-thinking-2s5')).toBe(false);
      expect(nome.endsWith('.wav')).toBe(false);
      expect(nome.endsWith('.zip')).toBe(false);
      expect(nome.endsWith('.md')).toBe(false);
      expect(nome).not.toBe('tony-stacked-alpha-player.js');
    }
  });

  it('clip talking v5 presenti e usate da percorsoClip', () => {
    for (const nome of CLIP_TALKING_V5) {
      expect(fs.existsSync(path.join(TONY_LIVE, nome)), nome).toBe(true);
    }
    for (const variante of ['desktop', 'mobile']) {
      for (const formato of ['webm', 'webp', 'stacked']) {
        const web = percorsoClip('talking', variante, formato);
        expect(web).toContain('talking-loop');
        expect(web).toContain('-v5.');
        expect(fs.existsSync(fileDaWeb(web)), web).toBe(true);
      }
    }
    expect(percorsoClip('idle', 'desktop', 'webm')).toContain('-v4.');
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
    const limiteTotale = { desktop: 6000000, mobile: 4000000 };
    const limiteEntry = { desktop: 1.8 * 1024 * 1024, mobile: 1.2 * 1024 * 1024 };
    const limiteLoop = { desktop: 800 * 1024, mobile: 500 * 1024 };
    // talking v5 ~7,5 s: WebP desktop ~1,5 MB
    const limiteTalking = { desktop: 1.6 * 1024 * 1024, mobile: 1.1 * 1024 * 1024 };
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
