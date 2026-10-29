/**
 * Riproduce clip Tony in WebM, WebP o stacked con la stessa interfaccia.
 * Due livelli sovrapposti: la clip nuova appare sopra e la vecchia sparisce
 * solo al primo fotogramma della nuova (niente buco, niente doppio Tony).
 * Nel contenitore: al massimo 2 figli durante un passaggio, 1 a regime.
 */

import { avvia as avviaStacked } from './stacked-alpha-player.js';

/**
 * @param {{ contenitore: HTMLElement, formato: 'webm' | 'webp' | 'stacked', onErrore?: () => void }} opts
 */
export function creaPlayerClip({ contenitore, formato, onErrore }) {
  const host = contenitore;
  const fmt = formato === 'webp' || formato === 'stacked' ? formato : 'webm';
  const segnalaErrore = typeof onErrore === 'function' ? onErrore : () => {};

  /** @type {{ el: HTMLElement, ferma: () => void, fineTimer?: number, inizio?: number, durataMs?: number, url?: string, blobUrl?: string, tipo?: string } | null} */
  let livelloA = null;
  /** @type {{ el: HTMLElement, ferma: () => void, fineTimer?: number, inizio?: number, durataMs?: number, url?: string, blobUrl?: string, tipo?: string } | null} */
  let livelloB = null;
  /** @type {{ el: HTMLElement, ferma: () => void, fineTimer?: number, inizio?: number, durataMs?: number, url?: string, blobUrl?: string, tipo?: string } | null} */
  let livelloInArrivo = null;
  let attivo = 'a';
  let smontato = false;
  /** @type {Map<string, HTMLVideoElement | Blob | { canvas: HTMLCanvasElement, url: string }>} */
  const cache = new Map();
  /** @type {Set<string>} */
  const blobUrlsAttivi = new Set();
  /** @type {number} */
  let timerDissolvenza = 0;

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

  function pulisciFigliEstranei(tieni) {
    if (!host) return;
    const ok = new Set();
    if (tieni && tieni.el) ok.add(tieni.el);
    const daTogliere = [];
    for (let i = 0; i < host.childNodes.length; i += 1) {
      const n = host.childNodes[i];
      if (!ok.has(n)) daTogliere.push(n);
    }
    for (const n of daTogliere) {
      try {
        host.removeChild(n);
      } catch {
        /* già tolto */
      }
    }
  }

  function revocaBlob(url) {
    if (!url) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* già revocato */
    }
    blobUrlsAttivi.delete(url);
  }

  function parkInCache(livello) {
    if (!livello || !livello.el) return;
    const el = livello.el;
    if (livello.blobUrl) {
      revocaBlob(livello.blobUrl);
      livello.blobUrl = '';
    }
    if (el.parentNode) {
      try {
        el.parentNode.removeChild(el);
      } catch {
        /* già fuori */
      }
    }
    if (el instanceof HTMLVideoElement) {
      try {
        el.pause();
      } catch {
        /* già fermo */
      }
      el.style.cssText =
        'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
      try {
        if (el.parentNode !== document.body && document.body) {
          document.body.appendChild(el);
        }
      } catch {
        /* senza body nei test */
      }
    }
  }

  function nascondiEFerma(livello, { libera = false } = {}) {
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
    if (libera) {
      if (livello.blobUrl) revocaBlob(livello.blobUrl);
      if (livello.el && livello.el.parentNode) {
        try {
          livello.el.parentNode.removeChild(livello.el);
        } catch {
          /* già tolto */
        }
      }
    } else {
      parkInCache(livello);
    }
  }

  function fermaInArrivo() {
    if (!livelloInArrivo) return;
    const inArrivo = livelloInArrivo;
    livelloInArrivo = null;
    nascondiEFerma(inArrivo, { libera: false });
    const slot = altroSlot();
    if ((slot === 'a' ? livelloA : livelloB) === inArrivo) {
      setLivello(slot, null);
    }
  }

  function stileClip(el, z, opacita) {
    const op = typeof opacita === 'number' ? opacita : 1;
    el.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center bottom;background:transparent;z-index:' +
      z +
      ';opacity:' +
      op +
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
      return fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error('fetch');
          return r.blob();
        })
        .then((blob) => {
          cache.set(url, blob);
        })
        .catch(() =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              cache.set(url, /** @type {any} */ (img));
              resolve();
            };
            img.onerror = () => resolve();
            img.src = url;
          })
        );
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
      let chiuso = false;
      const chiudi = (mettiInCache) => {
        if (chiuso) return;
        chiuso = true;
        video.onloadeddata = null;
        video.onerror = null;
        if (mettiInCache) cache.set(url, video);
        resolve();
      };
      video.onloadeddata = () => chiudi(true);
      video.onerror = () => chiudi(false);
      video.src = url;
      try {
        if (document.body) document.body.appendChild(video);
        video.load();
      } catch {
        chiudi(false);
        return;
      }
      // jsdom e ambienti senza media: non restare appeso
      window.setTimeout(() => chiudi(video.readyState >= 2), 0);
    });
  }

  /**
   * @param {string} url
   * @param {{ loop?: boolean, durataMs?: number, onFine?: () => void, onInizio?: () => void, dissolvenzaMs?: number }} opzioni
   */
  function suona(url, opzioni = {}) {
    if (smontato || !host || !url) return;
    const loop = opzioni.loop === true;
    const durataMs = Number(opzioni.durataMs) > 0 ? Number(opzioni.durataMs) : 0;
    const onFine = typeof opzioni.onFine === 'function' ? opzioni.onFine : null;
    const onInizio = typeof opzioni.onInizio === 'function' ? opzioni.onInizio : null;
    const dissolvenzaMs =
      Number(opzioni.dissolvenzaMs) > 0 ? Number(opzioni.dissolvenzaMs) : 0;

    const visibile = livelloCorrente();
    if (visibile && visibile.url === url && visibile.el) {
      ripartiStesso(visibile, { loop, durataMs, onFine, onInizio });
      return;
    }

    fermaInArrivo();

    const slotNuovo = altroSlot();
    const vecchio = visibile;

    if (fmt === 'webp') {
      suonaWebp(url, { loop, durataMs, onFine, onInizio, dissolvenzaMs, slotNuovo, vecchio });
      return;
    }
    if (fmt === 'stacked') {
      suonaStacked(url, { loop, durataMs, onFine, onInizio, dissolvenzaMs, slotNuovo, vecchio });
      return;
    }
    suonaWebm(url, { loop, durataMs, onFine, onInizio, dissolvenzaMs, slotNuovo, vecchio });
  }

  function ripartiStesso(livello, { loop, durataMs, onFine, onInizio }) {
    const el = livello.el;
    livello.durataMs = durataMs;
    if (typeof livello.resetFine === 'function') livello.resetFine();
    if (typeof onInizio === 'function') {
      try {
        onInizio();
      } catch {
        /* ignore */
      }
    }
    if (el instanceof HTMLVideoElement) {
      try {
        el.loop = loop;
        el.currentTime = 0;
        el.play().catch(() => {});
      } catch {
        /* ignore */
      }
      livello.inizio = performance.now();
      if (!loop && onFine) {
        el.onended = () => {
          if (onFine) onFine();
        };
        if (durataMs > 0) {
          if (livello.fineTimer) clearTimeout(livello.fineTimer);
          livello.fineTimer = window.setTimeout(() => {
            if (onFine) onFine();
          }, durataMs + 1500);
        }
      }
      return;
    }
    livello.inizio = performance.now();
    if (!loop && durataMs > 0 && onFine) {
      if (livello.fineTimer) clearTimeout(livello.fineTimer);
      livello.fineTimer = window.setTimeout(onFine, durataMs);
    } else if (livello.tipo === 'webp' && livello.blobUrl) {
      // nuovo object URL → animazione WebP dal primo fotogramma
      const cached = cache.get(livello.url || '');
      if (cached instanceof Blob) {
        revocaBlob(livello.blobUrl);
        const nuovo = URL.createObjectURL(cached);
        blobUrlsAttivi.add(nuovo);
        livello.blobUrl = nuovo;
        /** @type {HTMLImageElement} */ (el).src = nuovo;
        const dec = /** @type {HTMLImageElement} */ (el).decode
          ? /** @type {HTMLImageElement} */ (el).decode()
          : Promise.resolve();
        dec.catch(() => {});
      }
    }
  }

  function rivelaNuovo(slotNuovo, livelloNuovo, vecchio, dissolvenzaMs, onInizio) {
    setLivello(slotNuovo, livelloNuovo);
    attivo = slotNuovo;
    livelloInArrivo = null;
    livelloNuovo.inizio = performance.now();
    if (typeof onInizio === 'function') {
      try {
        onInizio();
      } catch {
        /* ignore */
      }
    }

    const togliVecchio = () => {
      if (vecchio) {
        nascondiEFerma(vecchio, { libera: false });
        setLivello(slotNuovo === 'a' ? 'b' : 'a', null);
      }
      pulisciFigliEstranei(livelloNuovo);
    };

    if (dissolvenzaMs > 0 && vecchio && livelloNuovo.el) {
      stileClip(livelloNuovo.el, 2, 0);
      livelloNuovo.el.style.transition = 'opacity ' + dissolvenzaMs + 'ms ease';
      // forza reflow
      void livelloNuovo.el.offsetWidth;
      livelloNuovo.el.style.opacity = '1';
      if (timerDissolvenza) clearTimeout(timerDissolvenza);
      timerDissolvenza = window.setTimeout(() => {
        timerDissolvenza = 0;
        togliVecchio();
        if (livelloNuovo.el) {
          livelloNuovo.el.style.transition = '';
        }
      }, dissolvenzaMs + 80);
    } else {
      if (livelloNuovo.el) stileClip(livelloNuovo.el, 2, 1);
      togliVecchio();
    }
  }

  function registraInArrivo(slotNuovo, livello) {
    setLivello(slotNuovo, livello);
    livelloInArrivo = livello;
  }

  function suonaWebm(url, { loop, durataMs, onFine, onInizio, dissolvenzaMs, slotNuovo, vecchio }) {
    /** @type {HTMLVideoElement} */
    let video;
    const cached = cache.get(url);
    if (cached instanceof HTMLVideoElement) {
      video = cached;
    } else {
      video = document.createElement('video');
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.preload = 'auto';
      video.src = url;
      cache.set(url, video);
    }
    video.loop = loop;
    try {
      video.currentTime = 0;
    } catch {
      /* ignore */
    }
    stileClip(video, 2, dissolvenzaMs > 0 ? 0 : 1);
    if (video.parentNode && video.parentNode !== host) {
      try {
        video.parentNode.removeChild(video);
      } catch {
        /* ignore */
      }
    }
    if (video.parentNode !== host) host.appendChild(video);

    let fermato = false;
    let fineEmessa = false;
    let timerSicurezza = 0;
    let rivelato = false;

    const emettiFine = () => {
      if (fermato || fineEmessa || !onFine) return;
      fineEmessa = true;
      onFine();
    };

    const livelloNuovo = {
      el: video,
      url,
      tipo: 'webm',
      durataMs,
      fineTimer: 0,
      resetFine() {
        fineEmessa = false;
        if (timerSicurezza) {
          clearTimeout(timerSicurezza);
          timerSicurezza = 0;
        }
      },
      ferma() {
        fermato = true;
        if (timerSicurezza) clearTimeout(timerSicurezza);
        video.onended = null;
        video.onerror = null;
        video.onplaying = null;
        try {
          video.pause();
        } catch {
          /* già fermo */
        }
      },
    };
    registraInArrivo(slotNuovo, livelloNuovo);

    const alPrimo = () => {
      if (fermato || rivelato) return;
      rivelato = true;
      rivelaNuovo(slotNuovo, livelloNuovo, vecchio, dissolvenzaMs, onInizio);
      if (!loop && onFine) {
        video.onended = () => emettiFine();
        if (durataMs > 0) {
          timerSicurezza = window.setTimeout(emettiFine, durataMs + 1500);
          livelloNuovo.fineTimer = timerSicurezza;
        }
      }
    };

    video.onerror = () => {
      segnalaErrore();
      if (onFine) emettiFine();
    };

    const onPlaying = () => {
      video.removeEventListener('playing', onPlaying);
      if (typeof video.requestVideoFrameCallback === 'function') {
        try {
          video.requestVideoFrameCallback(() => alPrimo());
          return;
        } catch {
          /* fallback */
        }
      }
      alPrimo();
    };
    video.addEventListener('playing', onPlaying);
    video.play().catch(() => {
      segnalaErrore();
      if (onFine) emettiFine();
    });
  }

  function suonaWebp(url, { loop, durataMs, onFine, onInizio, dissolvenzaMs, slotNuovo, vecchio }) {
    const img = document.createElement('img');
    img.alt = '';
    stileClip(img, 2, dissolvenzaMs > 0 ? 0 : 1);
    host.appendChild(img);

    let fermato = false;
    let fineEmessa = false;
    let timer = 0;
    let blobUrl = '';

    const emettiFine = () => {
      if (fermato || fineEmessa || !onFine) return;
      fineEmessa = true;
      onFine();
    };

    const livelloNuovo = {
      el: img,
      url,
      tipo: 'webp',
      durataMs,
      blobUrl: '',
      fineTimer: 0,
      resetFine() {
        fineEmessa = false;
        if (timer) {
          clearTimeout(timer);
          timer = 0;
        }
      },
      ferma() {
        fermato = true;
        if (timer) clearTimeout(timer);
      },
    };
    registraInArrivo(slotNuovo, livelloNuovo);

    const dopoDecode = () => {
      if (fermato) return;
      rivelaNuovo(slotNuovo, livelloNuovo, vecchio, dissolvenzaMs, onInizio);
      if (!loop && durataMs > 0 && onFine) {
        timer = window.setTimeout(emettiFine, durataMs);
        livelloNuovo.fineTimer = timer;
      }
    };

    const avviaConSrc = (src) => {
      img.src = src;
      const dec = img.decode ? img.decode() : Promise.resolve();
      dec.then(dopoDecode).catch(() => {
        segnalaErrore();
        dopoDecode();
      });
    };

    const cached = cache.get(url);
    if (cached instanceof Blob) {
      blobUrl = URL.createObjectURL(cached);
      blobUrlsAttivi.add(blobUrl);
      livelloNuovo.blobUrl = blobUrl;
      avviaConSrc(blobUrl);
      return;
    }
    if (cached && typeof cached === 'object' && 'src' in /** @type {any} */ (cached)) {
      // Image di fallback da precarica
      avviaConSrc(url);
      return;
    }

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('fetch');
        return r.blob();
      })
      .then((blob) => {
        cache.set(url, blob);
        if (fermato) return;
        blobUrl = URL.createObjectURL(blob);
        blobUrlsAttivi.add(blobUrl);
        livelloNuovo.blobUrl = blobUrl;
        avviaConSrc(blobUrl);
      })
      .catch(() => {
        avviaConSrc(url);
      });
  }

  function suonaStacked(url, { loop, durataMs, onFine, onInizio, dissolvenzaMs, slotNuovo, vecchio }) {
    const canvas = document.createElement('canvas');
    stileClip(canvas, 2, dissolvenzaMs > 0 ? 0 : 1);
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
      url,
      tipo: 'stacked',
      durataMs,
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
    registraInArrivo(slotNuovo, livelloNuovo);

    sessione = avviaStacked(canvas, url, {
      loop,
      onPrimoFotogramma: () => {
        if (fermato) return;
        rivelaNuovo(slotNuovo, livelloNuovo, vecchio, dissolvenzaMs, onInizio);
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
   * Per loop: chiama onFine alla fine del giro in corso (mai 0 se appena partito).
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

    if (livello.tipo === 'webm' && livello.el instanceof HTMLVideoElement) {
      const video = livello.el;
      const dur = Number(video.duration);
      const cur = Number(video.currentTime);
      if (Number.isFinite(dur) && dur > 0 && Number.isFinite(cur)) {
        const attesa = Math.max(1, (dur - cur) * 1000);
        return window.setTimeout(onFine, attesa);
      }
    }

    const inizio =
      typeof livello.inizio === 'number' ? livello.inizio : performance.now();
    const trascorso = performance.now() - inizio;
    const giri = Math.max(1, Math.ceil(trascorso / ms) || 1);
    let attesa = inizio + giri * ms - performance.now();
    if (!(attesa > 0)) attesa = ms;
    return window.setTimeout(onFine, attesa);
  }

  function ferma() {
    smontato = true;
    if (timerDissolvenza) {
      clearTimeout(timerDissolvenza);
      timerDissolvenza = 0;
    }
    fermaInArrivo();
    nascondiEFerma(livelloA, { libera: true });
    nascondiEFerma(livelloB, { libera: true });
    livelloA = null;
    livelloB = null;
    livelloInArrivo = null;
    while (host && host.firstChild) {
      host.removeChild(host.firstChild);
    }
    for (const el of cache.values()) {
      if (el instanceof HTMLVideoElement) {
        try {
          el.pause();
        } catch {
          /* già fermo */
        }
        el.removeAttribute('src');
        try {
          if (typeof el.load === 'function') el.load();
        } catch {
          /* staccato / jsdom */
        }
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    }
    cache.clear();
    for (const u of blobUrlsAttivi) {
      try {
        URL.revokeObjectURL(u);
      } catch {
        /* ignore */
      }
    }
    blobUrlsAttivi.clear();
  }

  return {
    precarica,
    suona,
    ferma,
    allaFineDelGiro,
  };
}
