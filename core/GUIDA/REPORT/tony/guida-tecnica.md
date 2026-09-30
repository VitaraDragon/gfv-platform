# Tony — guida tecnica modulo Report

Modulo: **`report`**. Hub: `modules/report/views/report-dashboard-standalone.html` (`hasReportModuleAccess`).

| Area | Path |
|------|------|
| Hub | `report-dashboard-standalone.html` |
| Terreni | `report-terreni-standalone.html` |
| Vigneto MVP | `report-standalone.html` (solo se `vigneto` in modules) |

Card «soon» (frutteto, magazzino, manodopera, contoTerzi, sintesi, economici): `href: '#'` + badge In sviluppo — **non** navigare come pagine reali.

Catalog dashboard: `MODULE_CATALOG.report` in `dashboard-hub.js`.

Guide: `REPORT/utente/guida.md`, `guida-sintesi.md`. Aggiungere a `GUIDA_LOAD_ENTRIES` / sintesi Tony quando si vuole il load automatico in runtime.
