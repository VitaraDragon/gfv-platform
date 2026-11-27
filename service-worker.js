// Service Worker per PWA - GFV Platform
//
// SW_CACHE_BUILD_ID: aggiornato da scripts/bump-pwa-cache-version.mjs (hook pre-commit
// in .githooks) oppure da `npm run bump:pwa-cache`. Ogni commit ottiene un ID nuovo
// così CACHE_NAME cambia; in activate() si cancellano le cache gfv-platform-* precedenti.
// Setup hook (una tantum): git config core.hooksPath .githooks
const SW_CACHE_BUILD_ID = 't1795783391781';
const CACHE_NAME = 'gfv-platform-' + SW_CACHE_BUILD_ID;

// Scelta della strategia e pulizia cache: funzioni pure in sw-strategy.js (test vitest).
importScripts('sw-strategy.js?v=' + encodeURIComponent(SW_CACHE_BUILD_ID));
const STRATEGIA = self.GFVSwStrategy;

function swTestLocaleAttivo() {
  try {
    return new URL(self.location.href).searchParams.get('swTest') === '1';
  } catch (error) {
    return false;
  }
}

// Installazione: precache solo dell'icona FAB Tony (evita flash emoji/lettera a rete lenta).
// Il resto della cache nasce al primo fetch dopo activate, così un worker in attesa poi
// superato non lascia una cache vuota che activate() prenderebbe per «la precedente».
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      let iconUrl = 'core/images/tony-icon.png';
      try {
        iconUrl = new URL('core/images/tony-icon.png', self.registration.scope).href;
      } catch (e) { /* keep relative */ }
      return cache.add(iconUrl).catch(() => { /* icona opzionale: non blocca install */ });
    })
  );
});

// skipRichiesto: un client ha chiesto l'attivazione. paginaGestisceReload: la pagina di
// questa build ricarica da sola su controllerchange. I client vecchi non mandano il flag:
// dopo l'attivazione si naviga una volta, così non restano sulla shell del worker precedente.
let skipRichiesto = false;
let paginaGestisceReload = false;
// fetch() ancora aperte nel worker attivo. skipWaiting del worker in attesa non parte
// finché queste non si chiudono, anche se la pagina ha già avuto la risposta dalla cache.
const retiAperte = new Set();

function annullaRetiAperte() {
  retiAperte.forEach((controllo) => {
    try { controllo.abort(); } catch (e) { /* ignore */ }
  });
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'GFV_LIBERA_FETCH') {
    annullaRetiAperte();
    const fonte = event.source;
    // Il thread è in esecuzione: la pagina manda skipWaiting solo dopo l'ack,
    // così Chrome azzera l'idle (altrimenti resta 30 s e un poll lo tiene sveglio).
    setTimeout(() => {
      if (fonte && fonte.postMessage) fonte.postMessage({ type: 'GFV_LIBERA_OK' });
    }, 0);
    return;
  }
  if (data.type === 'GFV_SKIP_WAITING') {
    skipRichiesto = true;
    if (data.paginaGestisceReload === true) paginaGestisceReload = true;
    // Senza waitUntil: waitUntil(skipWaiting()) può restare in attesa di se stesso e non attivare mai.
    const porta = event.ports && event.ports[0];
    self.skipWaiting().then(() => {
      if (!porta) return;
      porta.postMessage({ type: 'GFV_SKIP_ACK', ok: true, waiting: !!self.registration.waiting });
    }).catch((error) => {
      if (!porta) return;
      porta.postMessage({
        type: 'GFV_SKIP_ACK',
        ok: false,
        waiting: !!self.registration.waiting,
        errore: String((error && error.message) || error)
      });
    });
    return;
  }
  if (data.type === 'GFV_GET_BUILD') {
    const risposta = { type: 'GFV_BUILD', buildId: SW_CACHE_BUILD_ID };
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(risposta);
    } else if (event.source && event.source.postMessage) {
      event.source.postMessage(risposta);
    }
  }
});

// Attivazione: cancella ogni cache gfv-platform-* precedente. Non resta una shell vecchia
// da servire se la rete tarda. Le cache di altre app sullo stesso origin restano.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        STRATEGIA.cacheDaEliminare(cacheNames, CACHE_NAME).map((cacheName) => {
          console.log('Service Worker: Rimozione cache vecchia', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
      .then(() => {
        if (!skipRichiesto || paginaGestisceReload || !self.clients || typeof self.clients.matchAll !== 'function') return null;
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((finestre) => {
          return Promise.all(finestre.map((client) => {
            if (!client || !client.url || typeof client.navigate !== 'function') return null;
            return client.navigate(client.url);
          }));
        });
      })
  );
});

function salvaInCache(request, response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return;
  let copia;
  try {
    copia = response.clone();
  } catch (e) {
    return;
  }
  caches.open(CACHE_NAME)
    .then((cache) => cache.put(request, copia))
    .catch(() => { /* richiesta non cachabile: si ignora */ });
}

function cercaInCorrente(request) {
  return caches.open(CACHE_NAME).then((cache) => cache.match(request)).catch(() => null);
}

function cercaInPrecedenti(request) {
  return caches.keys().then((nomi) => {
    let catena = Promise.resolve(null);
    STRATEGIA.cachePrecedenti(nomi, CACHE_NAME).forEach((nome) => {
      catena = catena.then((trovata) => trovata || caches.open(nome).then((c) => c.match(request)));
    });
    return catena;
  }).catch(() => null);
}

function daCachePerTipo(request, tipo) {
  return caches.keys().then((nomi) => {
    const trovate = [];
    const aggiungi = (cache, risposta) => {
      trovate.push({ cache: cache, risposta: risposta || null });
    };
    return cercaInCorrente(request).then((corrente) => {
      aggiungi(CACHE_NAME, corrente);
      if (!STRATEGIA.puoUsareCachePrecedente(tipo)) {
        return STRATEGIA.scegliDaCache(trovate, CACHE_NAME, tipo);
      }
      let catena = Promise.resolve();
      STRATEGIA.cachePrecedenti(nomi, CACHE_NAME).forEach((nome) => {
        catena = catena.then(() => caches.open(nome).then((cache) => cache.match(request)).then((risposta) => {
          aggiungi(nome, risposta);
        }));
      });
      return catena.then(() => STRATEGIA.scegliDaCache(trovate, CACHE_NAME, tipo));
    });
  }).catch(() => null);
}

function paginaDiRiserva(request) {
  const accept = request.headers.get('accept') || '';
  if (request.mode !== 'navigate' && !accept.includes('text/html')) return Promise.resolve(null);
  return daCachePerTipo('/gfv-platform/index.html', 'html')
    .then((r) => r || daCachePerTipo('/index.html', 'html'))
    .then((r) => r || daCachePerTipo('index.html', 'html'));
}

function rilasciaControllo(controllo) {
  if (controllo) retiAperte.delete(controllo);
}

// Il fetch() si risolve alle intestazioni, ma Chrome tiene il worker «con lavoro»
// finché il corpo non è letto. Senza questo, skipWaiting aspetta fino a 5 minuti.
function osservaCorpo(response, controllo) {
  if (!controllo) return;
  let corpo = null;
  try {
    corpo = response && response.clone ? response.clone().body : null;
  } catch (e) {
    rilasciaControllo(controllo);
    return;
  }
  if (!corpo || typeof corpo.getReader !== 'function') {
    rilasciaControllo(controllo);
    return;
  }
  const reader = corpo.getReader();
  const leggi = () => {
    reader.read().then((passo) => {
      if (passo.done) {
        rilasciaControllo(controllo);
        return;
      }
      leggi();
    }).catch(() => {
      try { reader.cancel(); } catch (e) { /* ignore */ }
      rilasciaControllo(controllo);
    });
  };
  leggi();
}

// Rete. Annullata dopo ABORT_RETE_MS se le intestazioni non arrivano: un evento fetch
// aperto nel worker attivo rimanda l'attivazione del worker nuovo.
// Le navigazioni non hanno il timer: senza copia in cache l'annullo dava solo la pagina
// di errore del browser. Il controller resta finché il corpo non finisce, così
// GFV_LIBERA_FETCH può chiudere un corpo rimasto aperto.
function daRete(request, modoCache, senzaAnnullo) {
  const controllo = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controllo && !senzaAnnullo ? setTimeout(() => controllo.abort(), STRATEGIA.ABORT_RETE_MS) : 0;
  if (controllo) retiAperte.add(controllo);
  const opzioni = {};
  if (modoCache) opzioni.cache = modoCache;
  if (controllo) opzioni.signal = controllo.signal;
  const risposta = fetch(request, opzioni).then((response) => {
    if (timer) clearTimeout(timer);
    salvaInCache(request, response);
    osservaCorpo(response, controllo);
    return response;
  }, (errore) => {
    if (timer) clearTimeout(timer);
    rilasciaControllo(controllo);
    throw errore;
  });
  risposta.annulla = () => {
    if (controllo) controllo.abort();
  };
  return risposta;
}

// cache:'no-cache' rivalida (304 se invariato) e non riusa la copia HTTP max-age=600
// di GitHub Pages sui file senza ?v=.
function rispostaReteConTimeout(request) {
  let richiesta = null;
  return STRATEGIA.reteConTimeout({
    rete: () => {
      richiesta = daRete(request, 'no-cache', request.mode === 'navigate');
      return richiesta;
    },
    daCache: () => daCachePerTipo(request, 'html'),
    fallback: () => paginaDiRiserva(request),
    timeoutMs: STRATEGIA.TIMEOUT_RETE_MS,
    annullaRete: () => {
      if (richiesta && typeof richiesta.annulla === 'function') richiesta.annulla();
    }
  });
}

// Il file si riscarica una volta per build con cache:'no-cache' (304 se invariato):
// la copia HTTP max-age=600 di GitHub Pages non entra nella cache della build nuova.
function rispostaCachePrima(request, tipo) {
  return STRATEGIA.cachePrima({
    daCorrente: () => cercaInCorrente(request),
    rete: () => daRete(request, 'no-cache'),
    daRiserva: () => (STRATEGIA.puoUsareCachePrecedente(tipo) ? cercaInPrecedenti(request) : null)
  });
}

// Fetch:
// - versionato (?v= o hash nel nome): cache prima, solo nella cache della build corrente
//   (niente shell dalla build precedente, neanche se la rete è giù);
// - statico (immagini, font, icone): cache prima; la build precedente è riserva solo per questi;
// - HTML/navigazioni e file senza versione: rete prima, dopo 3 s solo la cache della build corrente;
// - .md, cross-origin, Firebase/Google, non GET, localhost senza ?swTest=1: non intercettati.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  let tipo = 'ignora';
  try {
    tipo = STRATEGIA.classificaRichiesta({
      method: request.method,
      url: request.url,
      mode: request.mode,
      accept: request.headers.get('accept') || '',
      origineSw: self.location.origin,
      swTest: swTestLocaleAttivo()
    });
  } catch (e) {
    return;
  }
  if (tipo === 'ignora') return;
  if (tipo === 'versionato' || tipo === 'statico') {
    event.respondWith(rispostaCachePrima(request, tipo));
    return;
  }
  // Con un worker già in attesa, la navigazione del reload non deve aprire una
  // rete senza fine: Chrome non attiva il worker nuovo finché questo ha lavoro,
  // e il timer di idle è 30 s (il lame duck arriva a 5 minuti). La shell in cache
  // è quella del worker attivo; lo skipWaiting della pagina pulita fa il resto.
  if (self.registration && self.registration.waiting) {
    const tipoCache = tipo === 'html' ? 'html' : 'rete';
    event.respondWith(daCachePerTipo(request, tipoCache).then((copia) => {
      if (copia) return copia;
      return rispostaReteConTimeout(request);
    }));
    return;
  }
  event.respondWith(rispostaReteConTimeout(request));
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    try {
      payload = { body: event.data ? event.data.text() : '' };
    } catch (e2) {
      payload = {};
    }
  }
  const data = payload.data || payload;
  const notification = payload.notification || {};
  const title = notification.title || data.title || 'GFV';
  const body = notification.body || data.body || '';
  const url = data.url || notification.click_action || '';
  let iconUrl = 'core/images/icon-192x192.png';
  try {
    iconUrl = new URL('core/images/icon-192x192.png', self.registration.scope).href;
  } catch (e) { /* path relativo se lo scope non è un URL valido */ }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: iconUrl,
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || '';
  let target = self.registration.scope;
  try {
    target = raw ? new URL(raw, self.registration.scope).href : self.registration.scope;
  } catch (err) {
    target = self.registration.scope;
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (typeof client.navigate === 'function') {
            return client.navigate(target).then((c) => (c && c.focus ? c.focus() : client.focus()));
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })
  );
});

