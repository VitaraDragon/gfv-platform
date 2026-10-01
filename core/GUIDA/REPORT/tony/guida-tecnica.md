# Tony — guida tecnica modulo Report

Modulo: **`report`**. Hub: `modules/report/views/report-dashboard-standalone.html` (`hasReportModuleAccess`).

| Area | Path |
|------|------|
| Hub | `report-dashboard-standalone.html` |
| Terreni | `report-terreni-standalone.html` |
| Vigneto MVP | `report-standalone.html` (solo se `vigneto` in modules) |

Card «soon» (frutteto, magazzino, manodopera, contoTerzi, sintesi, economici): `href: '#'` + badge In sviluppo — **non** navigare come pagine reali.

Catalog dashboard: `MODULE_CATALOG.report` in `dashboard-hub.js`.

Guide: `REPORT/utente/guida.md`, `guida-sintesi.md`. Caricate da `tony-service.js` (`GUIDA_LOAD_ENTRIES` + `guida_sintesi_*`).

## Page-map / tony-nav

| Target | Path |
|--------|------|
| `report` | `modules/report/views/report-dashboard-standalone.html` |
| `report terreni` | `modules/report/views/report-terreni-standalone.html` |
| `report vigneto` | `modules/report/views/report-standalone.html` |

In `tony-routes.json`, `TONY_PAGE_MAP`, gate modulo `report`, quick-reply «portami al report». Sintesi: `guida_sintesi_report`.

