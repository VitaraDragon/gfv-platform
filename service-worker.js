// Service Worker per PWA - GFV Platform
const CACHE_NAME = 'gfv-platform-v1';
// Usa path assoluti per compatibilità con GitHub Pages
const urlsToCache = [
  '/gfv-platform/',
  '/gfv-platform/index.html',
  '/gfv-platform/core/auth/login-standalone.html',
  '/gfv-platform/core/dashboard-standalone.html',
  '/gfv-platform/core/attivita-standalone.html',
  '/gfv-platform/core/terreni-standalone.html',
  '/gfv-platform/core/statistiche-standalone.html',
  '/gfv-platform/core/segnatura-ore-standalone.html',
  '/gfv-platform/icons/icon-192x192.png',
  '/gfv-platform/icons/icon-512x512.png',
  '/gfv-platform/core/styles/dashboard.css',
  '/gfv-platform/core/js/config-loader.js',
  '/gfv-platform/core/js/dashboard-utils.js',
  '/gfv-platform/core/js/dashboard-sections.js'
];

// Installazione Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache aperto');
        // Non bloccare l'installazione se alcuni file non vengono cachati
        return cache.addAll(urlsToCache).catch((error) => {
          console.warn('Service Worker: Alcuni file non sono stati cachati:', error);
        });
      })
      .catch((error) => {
        console.error('Service Worker: Errore durante il caching', error);
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

  // Ignora richieste Firebase/Google APIs (devono sempre andare in rete)
  const url = new URL(event.request.url);
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis.com') || 
      url.hostname.includes('google.com') ||
      url.hostname.includes('gstatic.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Solo cache risposte valide
        if (response.status === 200) {
          // Clona la risposta per poterla usare e salvare nella cache
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }
        
        return response;
      })
      .catch(() => {
        // Se la rete fallisce, prova a recuperare dalla cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se non c'è in cache, restituisci una risposta di fallback per HTML
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/gfv-platform/index.html');
          }
        });
      })
  );
});

