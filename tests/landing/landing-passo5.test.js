/**
 * Landing passo 5 — Tony bussa ed entra (Vitest puro, niente browser né rete).
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GIORNI_GUIDA_TONY,
  TONY_BUSSA_ATTIVO,
  VERSIONE_AVVISO_TONY,
} from '../../landing/src/config/landing-config.js';
import { testiLanding } from '../../landing/src/content/testi-landing.js';
import { applicaMascheraAlfa } from '../../landing/src/lib/stacked-alpha-player.js';
import {
  dovrebbeVibrare,
  formatoClip,
  leggiPresaVisione,
  percorsoClip,
  percorsiAudio,
  prossimoStato,
  salvaPresaVisione,
  SCHEMA_VIBRAZIONE,
  tempiScena,
  tonyBussaVisibile,
  varianteScena,
} from '../../landing/src/lib/tony-bussa-logica.js';
import { raccogliStringhe } from './aiuto-stringhe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

const SAFARI_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1';
const CHROME_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
const FIREFOX =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

function leggi(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

function fileDaPercorsoWeb(webPath) {
  const rel = String(webPath || '').replace(/^\/+/, '');
  return path.join(repoRoot, 'landing', 'public', rel);
}

function memoria() {
  const dati = new Map();
  return {
    getItem(chiave) {
      return dati.has(chiave) ? dati.get(chiave) : null;
    },
    setItem(chiave, valore) {
      dati.set(chiave, String(valore));
    },
  };
}

describe('flag Tony bussa', () => {
  it('TONY_BUSSA_ATTIVO è false e la versione dell’avviso è quella del 26 ottobre 2026', () => {
    expect(TONY_BUSSA_ATTIVO).toBe(false);
    expect(VERSIONE_AVVISO_TONY).toBe('avviso-tony-2026-10-26');
  });
});

describe('tonyBussaVisibile', () => {
  it('flag spento e build normale: falso anche con ?tonybussa=1', () => {
    expect(
      tonyBussaVisibile({ flag: false, dev: false, query: '?tonybussa=1' })
    ).toBe(false);
  });

  it('flag spento, sviluppo e ?tonybussa=1: vero', () => {
    expect(tonyBussaVisibile({ flag: false, dev: true, query: '?tonybussa=1' })).toBe(
      true
    );
  });

  it('flag spento e sviluppo senza parametro: falso', () => {
    expect(tonyBussaVisibile({ flag: false, dev: true, query: '' })).toBe(false);
  });

  it('flag acceso: vero anche senza parametro e fuori dallo sviluppo', () => {
    expect(tonyBussaVisibile({ flag: true, dev: false, query: '' })).toBe(true);
  });
});

describe('varianteScena', () => {
  it('sotto 768 è mobile, da 768 in su è desktop', () => {
    expect(varianteScena(375)).toBe('mobile');
    expect(varianteScena(767)).toBe('mobile');
    expect(varianteScena(768)).toBe('desktop');
    expect(varianteScena(1440)).toBe('desktop');
  });
});

describe('formatoClip', () => {
  it('Safari macOS, iPhone Safari e iPhone Chrome usano webp', () => {
    expect(formatoClip({ userAgent: SAFARI_MAC, webmAlfaSupportato: true })).toBe('webp');
    expect(formatoClip({ userAgent: IPHONE_SAFARI, webmAlfaSupportato: true })).toBe(
      'webp'
    );
    expect(formatoClip({ userAgent: IPHONE_CHROME, webmAlfaSupportato: true })).toBe(
      'webp'
    );
  });

  it('Chrome, Edge, Firefox e Chrome Android con WebM usano webm', () => {
    for (const ua of [CHROME_DESKTOP, EDGE, FIREFOX, CHROME_ANDROID]) {
      expect(formatoClip({ userAgent: ua, webmAlfaSupportato: true })).toBe('webm');
    }
  });

  it('Chrome senza WebM alfa ricade sullo stacked', () => {
    expect(formatoClip({ userAgent: CHROME_DESKTOP, webmAlfaSupportato: false })).toBe(
      'stacked'
    );
  });
});

describe('percorsi clip e audio', () => {
  const varianti = ['desktop', 'mobile'];
  const formati = ['webm', 'webp', 'stacked'];

  it('ogni combinazione esiste in landing/public', () => {
    for (const nome of ['entry', 'idle', 'exit']) {
      for (const variante of varianti) {
        for (const formato of formati) {
          const web = percorsoClip(nome, variante, formato);
          expect(fs.existsSync(fileDaPercorsoWeb(web)), web).toBe(true);
        }
      }
    }
    for (const variante of varianti) {
      const audio = percorsiAudio(variante);
      for (const formato of ['mp3', 'ogg']) {
        for (const chiave of ['bussata', 'terzo', 'whoosh']) {
          const web = audio[chiave][formato];
          expect(fs.existsSync(fileDaPercorsoWeb(web)), web).toBe(true);
        }
      }
    }
  });

  it('rispetta i pesi del brief', () => {
    const limiteEntry = { desktop: 1.8 * 1024 * 1024, mobile: 1.2 * 1024 * 1024 };
    const limiteLoop = { desktop: 800 * 1024, mobile: 500 * 1024 };
    for (const variante of varianti) {
      for (const formato of formati) {
        const entry = fs.statSync(
          fileDaPercorsoWeb(percorsoClip('entry', variante, formato))
        ).size;
        const loop = fs.statSync(
          fileDaPercorsoWeb(percorsoClip('idle', variante, formato))
        ).size;
        expect(entry).toBeLessThanOrEqual(limiteEntry[variante]);
        expect(loop).toBeLessThanOrEqual(limiteLoop[variante]);
      }
      const audio = percorsiAudio(variante);
      for (const formato of ['mp3', 'ogg']) {
        let somma = 0;
        for (const chiave of ['bussata', 'terzo', 'whoosh']) {
          somma += fs.statSync(fileDaPercorsoWeb(audio[chiave][formato])).size;
        }
        expect(somma).toBeLessThanOrEqual(60 * 1024);
      }
    }
  });
});

describe('tempiScena', () => {
  it('colpi, entrata e ripiego statico', () => {
    const tempi = tempiScena({ variante: 'desktop', riduciMovimento: false });
    expect(tempi.colpiMs).toEqual([400, 700, 1100]);
    expect(tempi.entrataMs).toBe(2000);
    expect(tempi.staticoMs).toBe(5000);
    expect(tempi.avvioSuonoBussataMs).toBe(0);
    expect(tempi.dissolvenzaAvvisoMs).toBe(200);
    expect(tempi.durataScossoneMs).toBe(80);
    expect(tempi.scossonePx).toEqual([2, 2, 2]);
    expect(tempi.impronta).toEqual({ aMs: 1100, durataMs: 400 });
  });

  it('con riduci movimento niente scossone e niente impronta', () => {
    const tempi = tempiScena({ variante: 'desktop', riduciMovimento: true });
    expect(tempi.scossonePx).toEqual([]);
    expect(tempi.impronta).toBeNull();
  });

  it('l’impronta c’è solo su desktop', () => {
    const mobile = tempiScena({ variante: 'mobile', riduciMovimento: false });
    expect(mobile.impronta).toBeNull();
    expect(mobile.scossonePx.every((px) => px >= 1 && px <= 2)).toBe(true);
  });
});

describe('vibrazione', () => {
  it('lo schema è quello del brief', () => {
    expect([...SCHEMA_VIBRAZIONE]).toEqual([40, 260, 40, 340, 60]);
  });

  it('mai su desktop, mai senza vibrate, mai con riduci movimento', () => {
    expect(
      dovrebbeVibrare({ variante: 'desktop', haVibrate: true, riduciMovimento: false })
    ).toBe(false);
    expect(
      dovrebbeVibrare({ variante: 'mobile', haVibrate: false, riduciMovimento: false })
    ).toBe(false);
    expect(
      dovrebbeVibrare({ variante: 'mobile', haVibrate: true, riduciMovimento: true })
    ).toBe(false);
    expect(
      dovrebbeVibrare({ variante: 'mobile', haVibrate: true, riduciMovimento: false })
    ).toBe(true);
  });
});

describe('presa visione', () => {
  it('salva e rilegge la stessa versione; una versione diversa va rifatta', () => {
    const storage = memoria();
    expect(salvaPresaVisione(storage, VERSIONE_AVVISO_TONY, '2026-10-26T10:00:00.000Z')).toBe(
      true
    );
    expect(leggiPresaVisione(storage, VERSIONE_AVVISO_TONY).vista).toBe(true);
    expect(leggiPresaVisione(storage, 'avviso-tony-altra').vista).toBe(false);
  });

  it('se localStorage lancia errori non si rompe e la casella si mostra', () => {
    const rotto = {
      getItem() {
        throw new Error('bloccato');
      },
      setItem() {
        throw new Error('bloccato');
      },
    };
    expect(() => salvaPresaVisione(rotto, VERSIONE_AVVISO_TONY, 'adesso')).not.toThrow();
    expect(salvaPresaVisione(rotto, VERSIONE_AVVISO_TONY, 'adesso')).toBe(false);
    expect(() => leggiPresaVisione(rotto, VERSIONE_AVVISO_TONY)).not.toThrow();
    expect(leggiPresaVisione(rotto, VERSIONE_AVVISO_TONY).vista).toBe(false);
    expect(leggiPresaVisione(null, VERSIONE_AVVISO_TONY).vista).toBe(false);
  });
});

describe('prossimoStato', () => {
  it('percorre nascosto, avviso, bussata, entrata, idle, uscita', () => {
    let stato = 'nascosto';
    stato = prossimoStato(stato, 'apri');
    expect(stato).toBe('avviso');
    stato = prossimoStato(stato, 'conferma');
    expect(stato).toBe('bussa');
    stato = prossimoStato(stato, 'bussataFinita');
    expect(stato).toBe('entra');
    stato = prossimoStato(stato, 'entrataFinita');
    expect(stato).toBe('idle');
    stato = prossimoStato(stato, 'saluta');
    expect(stato).toBe('esce');
    stato = prossimoStato(stato, 'uscitaFinita');
    expect(stato).toBe('nascosto');
  });

  it('«No, grazie» dalla casella torna a nascosto', () => {
    expect(prossimoStato('avviso', 'rinuncia')).toBe('nascosto');
  });

  it('clip non pronta porta allo statico', () => {
    expect(prossimoStato('bussa', 'clipNonPronta')).toBe('statico');
    expect(prossimoStato('statico', 'saluta')).toBe('esce');
  });

  it('un evento non previsto non cambia stato', () => {
    expect(prossimoStato('idle', 'apri')).toBe('idle');
    expect(prossimoStato('nascosto', 'saluta')).toBe('nascosto');
    expect(prossimoStato('bussa', 'pippo')).toBe('bussa');
  });
});

describe('testi del passo 5', () => {
  const testoTony = raccogliStringhe(testiLanding.tonyBussa).join('\n');

  it('nessuna parola vietata nei testi nuovi', () => {
    const vietate = [
      /certificat/i,
      /collegato al SIAN/i,
      /a norma/i,
      /\bregistro\b/i,
      /quaderno di campagna/i,
      /fattur/i,
    ];
    for (const re of vietate) {
      expect(testoTony).not.toMatch(re);
    }
  });

  it('non promette di aprire pagine o fare operazioni', () => {
    expect(testoTony).not.toMatch(/ti porto/i);
    expect(testoTony).not.toMatch(/\bapro\b/i);
    expect(testoTony).not.toMatch(/registro io/i);
    expect(testoTony).not.toMatch(/compilo/i);
    expect(testoTony).toContain('ti guido');
    expect(testoTony).toContain(String(GIORNI_GUIDA_TONY));
  });

  it('la prima casella dice le cose obbligatorie, compresa la protezione scritta per intero', () => {
    expect(testoTony).toContain('non una persona');
    expect(testoTony).toContain('Gemini');
    expect(testoTony).toContain('ElevenLabs');
    expect(testoTony).toContain('48 ore');
    expect(testoTony).toContain('maggiorenni');
    expect(testoTony).toContain('Google reCAPTCHA');
  });

  it('non c’è più «dicembre» nei testi né nella home', () => {
    expect(leggi('landing/src/content/testi-landing.js').toLowerCase()).not.toContain(
      'dicembre'
    );
    expect(leggi('landing/src/views/LandingHome.vue').toLowerCase()).not.toContain('dicembre');
    expect(leggi('landing/src/views/LandingHome.vue')).not.toContain('cta-whisper');
  });
});

describe('caricamento pigro e pulsanti con flag spento', () => {
  it('TonyStage entra solo con import() e le clip non sono nel resto dei sorgenti', () => {
    const home = leggi('landing/src/views/LandingHome.vue');
    expect(home).not.toMatch(/import\s+TonyStage\s+from/);
    expect(home).toMatch(/import\(\s*['"]\.\.\/components\/TonyStage\.vue['"]\s*\)/);

    const radice = path.join(repoRoot, 'landing', 'src');
    const file = [];
    function cammina(dir) {
      for (const nome of fs.readdirSync(dir)) {
        const pieno = path.join(dir, nome);
        if (fs.statSync(pieno).isDirectory()) {
          cammina(pieno);
          continue;
        }
        if (/\.(vue|js|ts|css|html|md)$/.test(nome)) file.push(pieno);
      }
    }
    cammina(radice);
    for (const pieno of file) {
      const rel = path.relative(repoRoot, pieno).replaceAll('\\', '/');
      if (rel === 'landing/src/lib/tony-bussa-logica.js') continue;
      expect(fs.readFileSync(pieno, 'utf8'), rel).not.toContain('/tony-live/');
    }
  });

  it('i tre «Vuoi provare GFV?» restano link alla registrazione nel template', () => {
    const home = leggi('landing/src/views/LandingHome.vue');
    const ancore = [...home.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
    const prova = ancore.filter(
      (tag) => tag.includes('class="btn-primary"') && tag.includes(':href="URL_REGISTRAZIONE"')
    );
    expect(prova).toHaveLength(3);
  });
});

describe('maschera alfa dello stacked', () => {
  it('il bianco della metà bassa resta visibile e il nero diventa trasparente', () => {
    const colore = new Uint8ClampedArray([10, 20, 30, 255, 1, 2, 3, 255]);
    const alfa = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
    applicaMascheraAlfa(colore, alfa);
    expect(colore[3]).toBe(255);
    expect(colore[7]).toBe(0);
    expect(colore[0]).toBe(10);
  });
});

describe('clip idle nascosta durante l’entrata', () => {
  it('TonyStage usa tony-clip-player (due livelli: niente doppio Tony, passo 12a)', () => {
    const stage = leggi('landing/src/components/TonyStage.vue');
    expect(stage).toContain("from '../lib/tony-clip-player.js'");
    expect(stage).toContain('creaPlayerClip');
    expect(stage).toContain('tony-player-host');
    // Niente più un <video>/<canvas> per clip: il player sovrappone due livelli.
    expect(stage).not.toContain('ref="videoIdle"');
    expect(stage).not.toContain('ref="canvasIdle"');
    const player = leggi('landing/src/lib/tony-clip-player.js');
    expect(player).toContain('livelloA');
    expect(player).toContain('livelloB');
    expect(player).toContain('onPrimoFotogramma');
  });
});
