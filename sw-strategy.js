// Strategie di cache del service worker GFV, senza dipendenze dal browser.
// Il service worker lo carica con importScripts('sw-strategy.js'); vitest lo importa
// come modulo e legge globalThis.GFVSwStrategy (tests/sw-strategy.test.js).
(function (root) {
  'use strict';

  const PREFISSO_CACHE = 'gfv-platform-';
  // HTML e file senza ?v=: oltre questo tempo si usa la copia in cache, se c'è.
  const TIMEOUT_RETE_MS = 3000;
  // Senza copia in cache si aspetta la rete fino a qui, poi si annulla la richiesta
  // (un evento fetch aperto nel worker attivo blocca l'attivazione del nuovo).
  const ABORT_RETE_MS = 8000;

  const ESTENSIONI_STATICHE = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot)$/i;
  // Nome con hash di contenuto: app.3f2a9c1b.js, chunk-5d41402abc4b.css
  const NOME_CON_HASH = /[.-][0-9a-f]{8,}\.(?:js|mjs|css|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|json)$/i;

  function isLocalDevHost(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  }

  function hostGoogle(hostname) {
    return hostname.includes('firebase') ||
      hostname.includes('googleapis.com') ||
      hostname.includes('google.com') ||
      hostname.includes('gstatic.com');
  }

  /**
   * Decide come trattare una richiesta.
   * @param {{ method?: string, url: string, mode?: string, accept?: string, origineSw: string, swTest?: boolean }} r
   * @returns {'ignora'|'html'|'versionato'|'statico'|'rete'}
   *   ignora: niente respondWith, va in rete senza service worker
   *   html: rete prima, 3 s, poi cache
   *   versionato: cache prima nella cache della build (?v= o hash nel nome)
   *   statico: cache prima nella cache della build (immagini, font, icone)
   *   rete: rete prima, 3 s, poi cache (JS/CSS/JSON senza versione)
   */
  function classificaRichiesta(r) {
    if ((r.method || 'GET').toUpperCase() !== 'GET') return 'ignora';
    let url;
    try {
      url = new URL(r.url);
    } catch (e) {
      return 'ignora';
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'ignora';
    if (isLocalDevHost(url.hostname) && !r.swTest) return 'ignora';
    if (hostGoogle(url.hostname)) return 'ignora';
    if (url.origin !== r.origineSw) return 'ignora';
    // Guide Markdown (Tony e documentazione): sempre in rete, fuori dal service worker.
    if (/\.md$/i.test(url.pathname)) return 'ignora';
    if (r.mode === 'navigate' || String(r.accept || '').includes('text/html')) return 'html';
    if (url.searchParams.has('v') || NOME_CON_HASH.test(url.pathname)) return 'versionato';
    if (ESTENSIONI_STATICHE.test(url.pathname)) return 'statico';
    return 'rete';
  }

  function tempoBuild(nome) {
    const m = /^gfv-platform-t(\d+)$/.exec(nome);
    return m ? Number(m[1]) : 0;
  }

  /**
   * Cache GFV di build precedenti, dalla più recente.
   * Le cache di altre app sullo stesso origin (es. github.io) non vengono toccate.
   */
  function cachePrecedenti(nomi, corrente) {
    return nomi
      .filter((n) => n.startsWith(PREFISSO_CACHE) && n !== corrente)
      .sort((a, b) => tempoBuild(b) - tempoBuild(a));
  }

  /**
   * In activate si tiene la cache corrente e la più recente delle precedenti
   * (quella del worker uscente): alla prima visita dopo l'update fa da riserva
   * se la rete fallisce o tarda. Le altre GFV si cancellano: al massimo 2 cache.
   */
  function cacheDaEliminare(nomi, corrente) {
    return cachePrecedenti(nomi, corrente).slice(1);
  }

  /**
   * Rete prima. Dopo timeoutMs risponde con la copia in cache, se c'è; altrimenti
   * continua ad aspettare la rete. Se la rete fallisce: cache, poi fallback, poi errore.
   * deps: { rete(): Promise<Response>, daCache(): Promise<Response|null>,
   *         fallback?(): Promise<Response|null>, timeoutMs, setTimer, clearTimer }
   */
  function reteConTimeout(deps) {
    const setTimer = deps.setTimer || setTimeout;
    const clearTimer = deps.clearTimer || clearTimeout;
    const fallback = deps.fallback || (() => Promise.resolve(null));
    return new Promise((resolve, reject) => {
      let chiuso = false;
      const chiudi = (fn, valore) => {
        if (chiuso) return;
        chiuso = true;
        fn(valore);
      };
      const timer = setTimer(() => {
        Promise.resolve()
          .then(() => deps.daCache())
          .then((copia) => { if (copia) chiudi(resolve, copia); })
          .catch(() => {});
      }, deps.timeoutMs == null ? TIMEOUT_RETE_MS : deps.timeoutMs);
      Promise.resolve()
        .then(() => deps.rete())
        .then((risposta) => {
          clearTimer(timer);
          chiudi(resolve, risposta);
        }, (errore) => {
          clearTimer(timer);
          if (chiuso) return;
          Promise.resolve()
            .then(() => deps.daCache())
            .then((copia) => copia || fallback())
            .then((copia) => (copia ? chiudi(resolve, copia) : chiudi(reject, errore)),
              () => chiudi(reject, errore));
        });
    });
  }

  /**
   * Cache prima, solo nella cache della build corrente: ogni build riscarica una volta
   * i suoi file, così un ?v= non aggiornato dopo una modifica resta vecchio al massimo
   * fino al deploy successivo. Se manca va in rete; se la rete fallisce prova daRiserva
   * (cache delle build precedenti).
   * deps: { daCorrente(), rete(), daRiserva?() }
   */
  function cachePrima(deps) {
    return Promise.resolve()
      .then(() => deps.daCorrente())
      .then((copia) => {
        if (copia) return copia;
        return Promise.resolve()
          .then(() => deps.rete())
          .catch((errore) => {
            const riserva = deps.daRiserva ? deps.daRiserva() : null;
            return Promise.resolve(riserva).then((r) => {
              if (r) return r;
              throw errore;
            });
          });
      });
  }

  const api = {
    PREFISSO_CACHE,
    TIMEOUT_RETE_MS,
    ABORT_RETE_MS,
    isLocalDevHost,
    classificaRichiesta,
    cachePrecedenti,
    cacheDaEliminare,
    reteConTimeout,
    cachePrima
  };
  root.GFVSwStrategy = api;
})(globalThis);
