/**
 * Riproduce clip Tony in WebM, WebP o stacked con la stessa interfaccia.
 * Due livelli sovrapposti: la clip nuova appare sopra e la vecchia sparisce
 * solo al primo fotogramma della nuova (niente buco, niente doppio Tony).
 */

import { avvia as avviaStacked } from './stacked-alpha-player.js';

/**
 * @param {{ contenitore: HTMLElement, formato: 'webm' | 'webp' | 'stacked', onErrore?: () => void }} opts
 */
export function creaPlayerClip({ contenitore, formato, onErrore }) {
  const host = contenitore;
  const fmt = formato === 'webp' || formato === 'stacked' ? formato : 'webm';
  const segnalaErrore = typeof onErrore === 'function' ? onErrore : () => {};

  /** @type {{ el: HTMLElement, ferma: () => void, fineTimer?: number } | null} */
  let livelloA = null;
  /** @type {{ el: HTMLElement, ferma: () => void, fineTimer?: number } | null} */
  let livelloB = null;
  let attivo = 'a';
  let smontato = false;
  let contatoreWebp = 0;
  /** @type {Map<string, HTMLVideoElement | HTMLImageElement>} */
  const cache = new Map();

  function livelloCorrente() {
    return attivo === 'a' ? livelloA : livelloB;
  }

  function setLivello(slot, valore) {
    if (slot === 'a') livelloA = valore;
    else livelloB = valore;
  }

  function altroSlot() {
    return attivo === 'a' ? 'b' : 'a';
  }

  function nascondiEFerma(livello) {
    if (!livello) return;
    if (livello.fineTimer) {
      clearTimeout(livello.fineTimer);
      livello.fineTimer = 0;
    }
    try {
      livello.ferma();
    } catch {
      /* già fermo */
    }
    if (livello.el && livello.el.parentNode) {
      livello.el.parentNode.removeChild(livello.el);
    }
  }

  function stileClip(el, z) {
    el.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:transparent;z-index:' +
      z +
      ';';
    el.setAttribute('aria-hidden', 'true');
  }

  /**
   * @param {string} url
   * @returns {Promise<void>}
   */
  function precarica(url) {
    if (!url || smontato) return Promise.resolve();
    if (cache.has(url)) return Promise.resolve();
    if (fmt === 'webp') {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const dec = img.decode ? img.decode() : Promise.resolve();
          dec
            .then(() => {
              cache.set(url, img);
              resolve();
            })
            .catch(() => {
              cache.set(url, img);
              resolve();
            });
        };
        img.onerror = () => resolve();
        img.src = url;
      });
    }
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-hidden', 'true');
      video.style.cssText =
        'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
      const fine = () => {
        video.onloadeddata = null;
        video.onerror = null;
        cache.set(url, video);
        resolve();
      };
      video.onloadeddata = fine;
      video.onerror = () => {
        video.onloadeddata = null;
        video.onerror = null;
        resolve();
      };
      video.src = url;
      try {
        document.body.appendChild(video);
        video.load();
      } catch {
        resolve();
      }
    });
  }

  /**
   * @param {string} url
   * @param {{ loop?: boolean, durataMs?: number, onFine?: () => void, aspettaFineGiro?: boolean }} opzioni
   */
  function suona(url, opzioni = {}) {
    if (smontato || !host || !url) return;
    const loop = opzioni.loop === true;
    const durataMs = Number(opzioni.durataMs) > 0 ? Number(opzioni.durataMs) : 0;
    const onFine = typeof opzioni.onFine === 'function' ? opzioni.onFine : null;
    const slotNuovo = altroSlot();
    const vecchio = livelloCorrente();

    if (fmt === 'webp') {
      suonaWebp(url, { loop, durataMs, onFine, slotNuovo, vecchio });
      return;
    }
    if (fmt === 'stacked') {
      suonaStacked(url, { loop, durataMs, onFine, slotNuovo, vecchio });
      return;
    }
    suonaWebm(url, { loop, durataMs, onFine, slotNuovo, vecchio });
  }

  function rivelaNuovo(slotNuovo, livelloNuovo, vecchio) {
    setLivello(slotNuovo, livelloNuovo);
    attivo = slotNuovo;
    if (vecchio) {
      nascondiEFerma(vecchio);
      setLivello(slotNuovo === 'a' ? 'b' : 'a', null);
    }
  }

  function suonaWebm(url, { loop, durataMs, onFine, slotNuovo, vecchio }) {
    const video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    video.loop = loop;
    video.src = url;
    stileClip(video, 2);
    host.appendChild(video);

    let fermato = false;
    let fineEmessa = false;
    let timerSicurezza = 0;
    let timerFine = 0;

    const emettiFine = () => {
      if (fermato || fineEmessa || !onFine) return;
      fineEmessa = true;
      onFine();
    };

    const livelloNuovo = {
      el: video,
      fineTimer: 0,
      ferma() {
        fermato = true;
        if (timerSicurezza) clearTimeout(timerSicurezza);
        if (timerFine) clearTimeout(timerFine);
        try {
          video.pause();
        } catch {
          /* già fermo */
        }
        video.onended = null;
        video.onerror = null;
        video.onloadeddata = null;
      },
    };

    const alPrimo = () => {
      if (fermato) return;
      rivelaNuovo(slotNuovo, livelloNuovo, vecchio);
      if (!loop && onFine) {
        video.onended = () => emettiFine();
        if (durataMs > 0) {
          timerSicurezza = window.setTimeout(emettiFine, durataMs + 1500);
          livelloNuovo.fineTimer = timerSicurezza;
        }
      } else if (loop && onFine && durataMs > 0) {
        /* per uscire a fine giro il chiamante gestisce il timer fuori */
      }
    };

    video.onerror = () => {
      segnalaErrore();
      if (onFine) emettiFine();
    };

    if (video.readyState >= 2) {
      alPrimo();
      video.play().catch(() => {});
    } else {
      video.onloadeddata = () => {
        alPrimo();
        video.play().catch(() => {});
      };
      video.play().catch(() => {});
    }
  }

  function suonaWebp(url, { loop, durataMs, onFine, slotNuovo, vecchio }) {
    contatoreWebp += 1;
    const src = url + (url.includes('?') ? '&' : '?') + 'r=' + contatoreWebp;
    const img = document.createElement('img');
    img.alt = '';
    stileClip(img, 2);
    img.src = src;
    host.appendChild(img);

    let fermato = false;
    let fineEmessa = false;
    let timer = 0;
    const inizio = performance.now();

    const emettiFine = () => {
      if (fermato || fineEmessa || !onFine) return;
      fineEmessa = true;
      onFine();
    };

    const livelloNuovo = {
      el: img,
      inizio,
      durataMs,
      fineTimer: 0,
      ferma() {
        fermato = true;
        if (timer) clearTimeout(timer);
      },
    };

    const dopoDecode = () => {
      if (fermato) return;
      rivelaNuovo(slotNuovo, livelloNuovo, vecchio);
      if (!loop && durataMs > 0 && onFine) {
        timer = window.setTimeout(emettiFine, durataMs);
        livelloNuovo.fineTimer = timer;
      } else if (loop && onFine && durataMs > 0) {
        /* loop: il browser ripete; onFine a fine giro lo decide il chiamante */
      }
    };

    const dec = img.decode ? img.decode() : Promise.resolve();
    dec.then(dopoDecode).catch(() => {
      segnalaErrore();
      dopoDecode();
    });
  }

  function suonaStacked(url, { loop, durataMs, onFine, slotNuovo, vecchio }) {
    const canvas = document.createElement('canvas');
    stileClip(canvas, 2);
    host.appendChild(canvas);

    let fermato = false;
    let fineEmessa = false;
    let timerSicurezza = 0;
    /** @type {{ ferma: () => void } | null} */
    let sessione = null;

    const emettiFine = () => {
      if (fermato || fineEmessa || !onFine) return;
      fineEmessa = true;
      onFine();
    };

    const livelloNuovo = {
      el: canvas,
      fineTimer: 0,
      ferma() {
        fermato = true;
        if (timerSicurezza) clearTimeout(timerSicurezza);
        try {
          sessione?.ferma();
        } catch {
          /* già fermo */
        }
        sessione = null;
      },
    };

    sessione = avviaStacked(canvas, url, {
      loop,
      onPrimoFotogramma: () => {
        if (fermato) return;
        rivelaNuovo(slotNuovo, livelloNuovo, vecchio);
        if (!loop && durataMs > 0) {
          timerSicurezza = window.setTimeout(emettiFine, durataMs + 1500);
          livelloNuovo.fineTimer = timerSicurezza;
        }
      },
      onFine: () => {
        if (!loop) emettiFine();
      },
    });
  }

  /**
   * Per loop WebP/WebM: chiama onFine alla fine del giro in corso.
   * @param {number} durataMs
   * @param {() => void} onFine
   * @returns {number} id del timeout
   */
  function allaFineDelGiro(durataMs, onFine) {
    const livello = livelloCorrente();
    const ms = Number(durataMs);
    if (!livello || !(ms > 0) || typeof onFine !== 'function') {
      if (typeof onFine === 'function') onFine();
      return 0;
    }
    const inizio =
      typeof livello.inizio === 'number' ? livello.inizio : performance.now() - ms;
    const trascorso = performance.now() - inizio;
    const giri = Math.max(1, Math.ceil(trascorso / ms));
    const attesa = inizio + giri * ms - performance.now();
    return window.setTimeout(onFine, Math.max(0, attesa));
  }

  function ferma() {
    smontato = true;
    nascondiEFerma(livelloA);
    nascondiEFerma(livelloB);
    livelloA = null;
    livelloB = null;
    for (const el of cache.values()) {
      if (el instanceof HTMLVideoElement) {
        try {
          el.pause();
        } catch {
          /* già fermo */
        }
        el.removeAttribute('src');
        try {
          el.load();
        } catch {
          /* staccato */
        }
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    }
    cache.clear();
  }

  return {
    precarica,
    suona,
    ferma,
    allaFineDelGiro,
  };
}
