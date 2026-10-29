// @vitest-environment jsdom
/**
 * Landing passo 12c — correzioni scena Tony (contenitore, idle su errore, statico, dissolvenze).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  attesaPrimaDiParlareMs,
  bussataAutomaticaConsentita,
  BUSSATA_AUTOMATICA_MS,
  DIMENSIONI_TONY_STATICO,
  DISSOLVENZA_STATICO_MS,
  MIN_SCRIVE_MS,
  percorsoTonyStatico,
  prossimoStato,
  scalettaClip,
  sicurezzaEntrataMs,
  tempiVoce,
} from '../../landing/src/lib/tony-bussa-logica.js';
import { creaPlayerClip } from '../../landing/src/lib/tony-clip-player.js';
import {
  clipFinteAssenti,
  parametroFinto,
} from '../../landing/src/lib/tony-chat-finto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

function leggi(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

function md5File(rel) {
  return createHash('md5').update(fs.readFileSync(path.join(repoRoot, rel))).digest('hex');
}

function pngHeader(rel) {
  const buf = fs.readFileSync(path.join(repoRoot, rel));
  const larghezza = buf.readUInt32BE(16);
  const altezza = buf.readUInt32BE(20);
  const tipoColore = buf[25];
  return { larghezza, altezza, tipoColore };
}

describe('Riduci desktop (punto 15)', () => {
  it('LandingHome ha Riduci / Parla con Tony senza smontare lo stage', () => {
    const home = leggi('landing/src/views/LandingHome.vue');
    const testi = leggi('landing/src/content/testi-landing.js');
    expect(testi).toMatch(/riduci:\s*'Riduci'/);
    expect(testi).toMatch(/ripristina:\s*'Parla con Tony'/);
    expect(home).toMatch(/tonyRidotto/);
    expect(home).toMatch(/v-show="!tonyRidotto"/);
    expect(home).toMatch(/tony-btn-riduci/);
    expect(home).toMatch(/tony-btn-riapri/);
  });
});

describe('MIN_SCRIVE e bussata automatica', () => {
  it('attesaPrimaDiParlareMs rispetta il minimo scrive', () => {
    expect(MIN_SCRIVE_MS).toBe(1800);
    expect(
      attesaPrimaDiParlareMs({
        clipCorrente: 'scrive',
        msDaInizioClip: 300,
      })
    ).toBe(1500);
    expect(
      attesaPrimaDiParlareMs({
        clipCorrente: 'scrive',
        msDaInizioClip: 2000,
      })
    ).toBe(0);
    expect(
      attesaPrimaDiParlareMs({
        clipCorrente: 'scrive',
        msDaInizioClip: 300,
        riduciMovimento: true,
      })
    ).toBe(0);
    expect(
      attesaPrimaDiParlareMs({ clipCorrente: 'idle', msDaInizioClip: 0 })
    ).toBe(0);
  });

  it('bussataAutomaticaConsentita una volta per sessione', () => {
    expect(BUSSATA_AUTOMATICA_MS).toBe(8000);
    expect(bussataAutomaticaConsentita({})).toBe(true);
    expect(bussataAutomaticaConsentita({ sessioneGiaBussato: true })).toBe(false);
    expect(bussataAutomaticaConsentita({ rinunciaSalvata: true })).toBe(false);
    expect(bussataAutomaticaConsentita({ paginaNascosta: true })).toBe(false);
    expect(bussataAutomaticaConsentita({ stageAperto: true })).toBe(false);
    expect(bussataAutomaticaConsentita({ avvisoAperto: true })).toBe(false);
  });
});

describe('scalettaClip passo 12c', () => {
  it('entra→idle vuota; altre righe invariate', () => {
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
    expect(scalettaClip('scrive', 'parla')).toEqual(['talking']);
    expect(scalettaClip('pensa', 'parla')).toEqual(['talking']);
    expect(scalettaClip('idle', 'esce')).toEqual(['exit']);
    expect(scalettaClip('pensa', 'statico')).toEqual([]);
  });
});

describe('stati servizioSpento e clipNonPronta', () => {
  it('errore servizio → idle; clip non pronta → statico', () => {
    for (const s of ['idle', 'ascolta', 'pensa', 'scrive']) {
      expect(prossimoStato(s, 'servizioSpento')).toBe('idle');
    }
    expect(prossimoStato('bussa', 'clipNonPronta')).toBe('statico');
    expect(prossimoStato('entra', 'clipNonPronta')).toBe('statico');
    expect(prossimoStato('statico', 'saluta')).toBe('esce');
  });
});

describe('immagini statiche idle', () => {
  const desktopRel = 'landing/public/tony-live/static/tony-static-idle-desktop.png';
  const mobileRel = 'landing/public/tony-live/static/tony-static-idle-mobile.png';

  it('percorsi, MD5, dimensioni PNG e DIMENSIONI_TONY_STATICO', () => {
    expect(percorsoTonyStatico('desktop')).toBe('/tony-live/static/tony-static-idle-desktop.png');
    expect(percorsoTonyStatico('mobile')).toBe('/tony-live/static/tony-static-idle-mobile.png');
    expect(percorsoTonyStatico()).toBe('/tony-live/static/tony-static-idle-desktop.png');

    expect(fs.existsSync(path.join(repoRoot, desktopRel))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, mobileRel))).toBe(true);
    expect(md5File(desktopRel)).toBe('8866c3facb420f9ceac7a20e45f1f47c');
    expect(md5File(mobileRel)).toBe('131d51007b3d78ec561344c1a3c9767a');

    const d = pngHeader(desktopRel);
    const m = pngHeader(mobileRel);
    expect(d).toEqual({ larghezza: 576, altezza: 720, tipoColore: 6 });
    expect(m).toEqual({ larghezza: 432, altezza: 540, tipoColore: 6 });
    expect(DIMENSIONI_TONY_STATICO.desktop).toEqual({ larghezza: 576, altezza: 720 });
    expect(DIMENSIONI_TONY_STATICO.mobile).toEqual({ larghezza: 432, altezza: 540 });

    expect(
      fs.existsSync(path.join(repoRoot, 'landing/public/tony-live/static/tony-static.png'))
    ).toBe(true);
  });
});

describe('player contenitore pulito', () => {
  /** @type {HTMLDivElement} */
  let host;
  let playSpy;
  let pauseSpy;

  let loadSpy;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function playMock() {
      this.dispatchEvent(new Event('playing'));
      return Promise.resolve();
    });
    pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    loadSpy = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  });

  afterEach(() => {
    playSpy.mockRestore();
    pauseSpy.mockRestore();
    loadSpy.mockRestore();
    if (host.parentNode) host.parentNode.removeChild(host);
    vi.useRealTimers();
  });

  it('dopo rivelazione al massimo 2 figli, poi 1; ferma svuota; riuso WebM', async () => {
    vi.useFakeTimers();
    const player = creaPlayerClip({ contenitore: host, formato: 'webm' });
    const urlA = '/tony-live/a.webm';
    const urlB = '/tony-live/b.webm';

    const preA = player.precarica(urlA);
    const nascosto = document.body.querySelector('video');
    if (nascosto) {
      Object.defineProperty(nascosto, 'readyState', { configurable: true, get: () => 4 });
      nascosto.dispatchEvent(new Event('loadeddata'));
    }
    await preA;

    player.suona(urlA, { loop: true, durataMs: 4000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(host.childElementCount).toBeLessThanOrEqual(2);
    expect(host.childElementCount).toBe(1);

    player.suona(urlB, { loop: true, durataMs: 4000, dissolvenzaMs: 150 });
    await vi.advanceTimersByTimeAsync(0);
    expect(host.childElementCount).toBeLessThanOrEqual(2);
    await vi.advanceTimersByTimeAsync(250);
    expect(host.childElementCount).toBe(1);

    player.ferma();
    expect(host.childElementCount).toBe(0);

    const p3 = creaPlayerClip({ contenitore: host, formato: 'webm' });
    expect(host.childElementCount).toBe(0);

    const pre3 = p3.precarica(urlA);
    const nascosto3 = document.body.querySelector('video');
    if (nascosto3) {
      Object.defineProperty(nascosto3, 'readyState', { configurable: true, get: () => 4 });
      nascosto3.dispatchEvent(new Event('loadeddata'));
    }
    await pre3;

    p3.suona(urlA, { loop: true, durataMs: 4000 });
    await vi.advanceTimersByTimeAsync(0);
    const v1 = host.querySelector('video');
    expect(v1).toBeTruthy();
    p3.suona(urlA, { loop: true, durataMs: 4000 });
    await vi.advanceTimersByTimeAsync(0);
    const v2 = host.querySelector('video');
    expect(v2).toBe(v1);
    expect(Number(v2.currentTime)).toBe(0);
    expect(playSpy).toHaveBeenCalled();

    p3.ferma();
    expect(host.childElementCount).toBe(0);

    const p4 = creaPlayerClip({ contenitore: host, formato: 'webm' });
    p4.suona('/x1.webm', { loop: true, durataMs: 1000 });
    p4.suona('/x2.webm', { loop: true, durataMs: 1000 });
    p4.suona('/x3.webm', { loop: true, durataMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(host.childElementCount).toBeLessThanOrEqual(2);
    p4.ferma();
    expect(host.childElementCount).toBe(0);
  });

  it('allaFineDelGiro WebM usa duration − currentTime', () => {
    vi.useFakeTimers();
    const player = creaPlayerClip({ contenitore: host, formato: 'webm' });
    player.suona('/t.webm', { loop: true, durataMs: 2375 });
    const video = host.querySelector('video');
    expect(video).toBeTruthy();
    Object.defineProperty(video, 'duration', { configurable: true, get: () => 2.375 });
    Object.defineProperty(video, 'currentTime', { configurable: true, get: () => 0.5, set: () => {} });
    // forza rivelazione
    video.dispatchEvent(new Event('playing'));
    const cb = vi.fn();
    const id = player.allaFineDelGiro(2375, cb);
    expect(id).toBeTruthy();
    vi.advanceTimersByTime(1820);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(cb).toHaveBeenCalled();
    player.ferma();
  });
});

describe('WebP una volta sola', () => {
  it('fetch una volta, createObjectURL per ogni suona, niente ?r=', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const blob = new Blob(['fake'], { type: 'image/webp' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => blob,
    });
    vi.stubGlobal('fetch', fetchMock);

    let blobN = 0;
    const createFn = vi.fn(() => {
      blobN += 1;
      return 'blob:test-' + blobN;
    });
    const revokeFn = vi.fn();
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = createFn;
      URL.revokeObjectURL = revokeFn;
    } else {
      vi.spyOn(URL, 'createObjectURL').mockImplementation(createFn);
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeFn);
    }

    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === 'img') {
        el.decode = () => Promise.resolve();
      }
      return el;
    });

    const player = creaPlayerClip({ contenitore: host, formato: 'webp' });
    const url = '/tony-live/idle.webp';
    await player.precarica(url);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    player.suona(url, { loop: true, durataMs: 4000 });
    await Promise.resolve();
    await Promise.resolve();

    // stessa clip di nuovo: nuovo object URL, niente secondo fetch
    // (ripartiStesso o nuovo livello da blob in cache)
    player.suona('/altro-per-forzare-cambio.webp', { loop: true, durataMs: 4000 });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    player.suona(url, { loop: true, durataMs: 4000 });
    await Promise.resolve();
    await Promise.resolve();

    player.suona(url, { loop: true, durataMs: 4000 });
    await Promise.resolve();
    await Promise.resolve();

    // idle.webp fetchato una sola volta; altro.webP una volta
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes('idle.webp')).length).toBe(1);
    expect(createFn.mock.calls.length).toBeGreaterThanOrEqual(3);

    const sorgente = leggi('landing/src/lib/tony-clip-player.js');
    expect(sorgente.includes("'r='")).toBe(false);
    expect(sorgente.includes('"r="')).toBe(false);

    player.ferma();
    expect(revokeFn).toHaveBeenCalled();
    vi.unstubAllGlobals();
    document.createElement.mockRestore?.();
    if (host.parentNode) host.parentNode.removeChild(host);
  });
});

describe('tempi e sorgenti', () => {
  it('sicurezzaEntrataMs, dissolvenze, sorgenti puliti', () => {
    expect(sicurezzaEntrataMs('desktop')).toBe(3042 + 1500);
    expect(sicurezzaEntrataMs('mobile')).toBe(2708 + 1500);
    expect(DISSOLVENZA_STATICO_MS).toBe(180);
    expect(tempiVoce().dissolvenzaBoccaMs).toBe(150);

    const stage = leggi('landing/src/components/TonyStage.vue');
    expect(stage).not.toContain("tony-figura--fade': riduciMovimento || fase === 'statico'");
    expect(stage).not.toContain('tony-figura--fade\': riduciMovimento || fase === \'statico\'');
    expect(stage).toMatch(/height:\s*55/);
    if (stage.includes('--ms-bocca')) {
      expect(stage).toContain('var(--ms-bocca)');
    }

    const home = leggi('landing/src/views/LandingHome.vue');
    expect(home).not.toContain('tonyfinto');
    expect(home).not.toContain('noclip');

    const playerSrc = leggi('landing/src/lib/tony-clip-player.js');
    expect(playerSrc.includes("'r='")).toBe(false);
    expect(playerSrc.includes('"r="')).toBe(false);
    expect(playerSrc).toContain('livelloA');
    expect(playerSrc).toContain('livelloB');
    expect(playerSrc).toContain('onPrimoFotogramma');
  });

  it('niente seconda entry: scaletta entra→idle vuota (funzione pura)', () => {
    expect(scalettaClip('entra', 'idle').includes('entry')).toBe(false);
    const stage = leggi('landing/src/components/TonyStage.vue');
    expect(stage).toContain("codaClip = ['entry', 'idle']");
  });
});

describe('bussata automatica in LandingHome', () => {
  it('timer, sessione e warm-up OPTIONS', () => {
    const home = leggi('landing/src/views/LandingHome.vue');
    expect(home).toContain('BUSSATA_AUTOMATICA_MS');
    expect(home).toContain('bussataAutomaticaConsentita');
    expect(home).toContain('CHIAVE_BUSSATA_SESSIONE');
    expect(home).toMatch(/method:\s*['"]OPTIONS['"]/);
    expect(home).toContain('URL_TONY_LANDING_ASK');
    expect(home).toContain('URL_TONY_LANDING_AUDIO');
  });
});

describe('TonyChat informativa e riepilogo', () => {
  it('informativa aiuto una volta e riepilogo sempre in fase aiuto', () => {
    const chat = leggi('landing/src/components/TonyChat.vue');
    expect(chat).toContain('CHIAVE_INFORMATIVA_AIUTO');
    expect(chat).toContain('informativaAiutoVisibile');
    expect(chat).toContain('informativaHoCapito');
    expect(chat).toContain('@click="onChipAiuto(ta.chipRiepilogo)"');
    expect(chat).not.toMatch(/v-if="haDatiAiuto\(\)"[\s\S]{0,200}chipRiepilogo/);
    expect(chat).not.toMatch(/chipRiepilogo[\s\S]{0,80}v-if="haDatiAiuto\(\)"/);
  });
});

describe('modo di prova clip assenti', () => {
  it('clipFinteAssenti e parametroFinto noclip', () => {
    expect(clipFinteAssenti('?tonyfinto=noclip')).toBe(true);
    expect(clipFinteAssenti('?tonyfinto=1')).toBe(false);
    expect(clipFinteAssenti('?tonyfinto=errore')).toBe(false);
    expect(clipFinteAssenti('')).toBe(false);
    expect(parametroFinto('?tonyfinto=noclip')).toBe('ok');
  });
});
