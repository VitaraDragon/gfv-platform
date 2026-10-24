# Tony — guida tecnica Vendemmia meccanica

Modulo: **`vendemmiaMeccanica`**. Auth pagina: `modules/vendemmia-meccanica/js/vm-page-auth.js`.

| Pagina | Path |
|--------|------|
| Hub | `modules/vendemmia-meccanica/views/vm-home-standalone.html` |
| Piano stagione | `piano-stagione-standalone.html` |
| Calcolatore | `calcolatore-standalone.html` |
| Calcoli salvati | `calcoli-salvati-standalone.html` |
| Tariffe | `tariffe-vm-standalone.html` |
| Bilancio | `bilancio-vm-standalone.html` |

Intersezioni: Conto terzi (clienti, terreni, preventivi, lavori). Vedi `INTERSEZIONI/tony/intersezioni.md` § 2.7.

Guide: `VENDEMMIA_MECCANICA/utente/guida.md`, `guida-sintesi.md`. Caricate da `tony-service.js` (`GUIDA_LOAD_ENTRIES` + `guida_sintesi_*`).

## Page-map / tony-nav

| Target | Path |
|--------|------|
| `vendemmia meccanica` / `vendemmia meccanizzata` / `vm home` | `modules/vendemmia-meccanica/views/vm-home-standalone.html` |
| `piano stagione` / `piano stagione vm` | `…/piano-stagione-standalone.html` |
| `calcolatore` / `calcolatore vendemmia meccanica` | `…/calcolatore-standalone.html` |
| `calcoli salvati` | `…/calcoli-salvati-standalone.html` |
| `tariffe vm` | `…/tariffe-vm-standalone.html` |
| `bilancio vm` | `…/bilancio-vm-standalone.html` |

Gate: `vendemmiaMeccanica`. Quick-reply: «portami alla vendemmia meccanica». Sintesi: `guida_sintesi_vendemmia_meccanica`.

## Zone escluse e superficie (#239)

- `services/zone-escluse-service.js` `getPolygonClippingLib()` ora delega a `loadPolygonClipping()` di `core/services/zone-lavorate-area.js` (browser: `vendor/polygon-clipping-0.15.7.umd.min.js`, caricato da `piano-stagione-standalone.html` al posto di `node_modules`; Node: import npm). Nessun cambio di comportamento per l’utente. Import `zone-escluse-service.js?v=2026-10-20a` in `vm-zone-mappa.js`, `piano-stagione-service.js`, `lavoro-piano-sync-service.js`, Piano stagione.
- `sumSuperficieHaZoneLavorate` in `lavoro-piano-sync-service.js` resta **somma semplice** delle zone lavorate (non l’unione usata da Gestione lavori e I miei lavori): con zone sovrapposte gli ettari sincronizzati sul piano possono differire dalla superficie lavorata di Gestione lavori.
