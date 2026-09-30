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

