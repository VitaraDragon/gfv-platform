// Service Worker per PWA - GFV Platform
const CACHE_NAME = 'gfv-platform-v1';

// Installazione Service Worker
// Non cachiamo file all'installazione - verranno cachati on-demand durante il fetch
// Questo rende il service worker più flessibile e funziona in qualsiasi ambiente
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache aperto e pronto');
        // Non blocchiamo l'installazione - i file verranno cachati on-demand
        return Promise.resolve();
      })
      .catch((error) => {
        console.error('Service Worker: Errore durante l\'apertura cache', error);
      })
  );
  // Forza l'attivazione immediata del nuovo service worker
  self.skipWaiting();
});

// Attivazione Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Rimozione cache vecchia', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Prendi il controllo di tutte le pagine immediatamente
  return self.clients.claim();
});

// Fetch - Strategia Network First con fallback Cache
self.addEventListener('fetch', (event) => {
  // Ignora richieste non GET
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  
  // Ignora richieste con schemi non supportati (chrome-extension, chrome, etc.)
  if (url.protocol === 'chrome-extension:' || 
      url.protocol === 'chrome:' ||
      url.protocol === 'moz-extension:' ||
      url.protocol === 'edge:' ||
      url.protocol === 'safari-extension:' ||
      !url.protocol.startsWith('http')) {
    return;
  }

  // Ignora richieste Firebase/Google APIs (devono sempre andare in rete)
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis.com') || 
      url.hostname.includes('google.com') ||
      url.hostname.includes('gstatic.com')) {
    return;
  }

  // Gestisci solo richieste dello stesso origin (evita problemi con CORS)
  try {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Solo cache risposte valide e con Content-Type supportato
          if (response.status === 200 && response.type === 'basic') {
            // Clona la risposta per poterla usare e salvare nella cache
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Verifica che la richiesta sia cachabile
                try {
                  cache.put(event.request, responseToCache).catch((error) => {
                    // Ignora errori di cache per richieste non supportate
                    // Non loggare errori per estensioni o richieste non standard
                    if (!url.protocol.includes('extension') && !url.protocol.includes('chrome')) {
                      console.warn('Service Worker: Impossibile cachare richiesta:', event.request.url);
                    }
                  });
                } catch (error) {
                  // Ignora errori di cache silenziosamente
                }
              })
              .catch((error) => {
                // Ignora errori di apertura cache silenziosamente
              });
          }
          
          return response;
        })
        .catch((error) => {
          // Se la rete fallisce, prova a recuperare dalla cache
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Se non c'è in cache, restituisci una risposta di fallback per HTML
            const acceptHeader = event.request.headers.get('accept');
            if (acceptHeader && acceptHeader.includes('text/html')) {
              // Prova prima con path assoluto, poi con path relativo
              return caches.match('/gfv-platform/index.html')
                .then(cached => cached || caches.match('/index.html'))
                .then(cached => cached || caches.match('index.html'));
            }
            // Per altre richieste, lancia l'errore originale
            throw error;
          });
        })
    );
  } catch (error) {
    // Se c'è un errore nella gestione della richiesta, ignora silenziosamente
    // Questo può accadere con estensioni del browser o richieste non standard
    return;
  }
});

