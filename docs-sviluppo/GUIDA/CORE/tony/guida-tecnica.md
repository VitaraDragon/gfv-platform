# Core — guida tecnica Tony

Contesto: GFV Platform **senza moduli opzionali attivi** su `tenants.modules` (array vuoto o solo metadati senza moduli da `AVAILABLE_MODULES`). Piano Free o Base con zero moduli acquistati.

Fonti codice prioritarie: [`core/config/subscription-plans.js`](../../../../core/config/subscription-plans.js), [`core/js/dashboard-controller.js`](../../../../core/js/dashboard-controller.js), [`core/js/dashboard-sections.js`](../../../../core/js/dashboard-sections.js), [`core/services/tony-service.js`](../../../../core/services/tony-service.js), [`core/js/tony/main.js`](../../../../core/js/tony/main.js).

---

## Moduli (id `AVAILABLE_MODULES`)

`manodopera`, `parcoMacchine`, `contoTerzi`, `vigneto`, `frutteto`, `oliveto` (non disponibile), `magazzino`, `tony` (Tony Avanzato operativo), `report`, `meteo`, `vendemmiaMeccanica`.

Accesso effettivo = moduli pagati **+** trial attivi (`module-access-resolver.js`, `MODULE_TRIAL_DAYS = 30`, un trial attivo alla volta). Senza id attivo (pagato o trial), le relative card/azioni non devono essere documentate come disponibili nell’esperienza Core-only.

---

## Dashboard (`dashboard-controller.js` / `dashboard-sections.js` / `dashboard-hub.js`)

Layout **panoramica** (manager/admin, non solo operaio/caposquadra):

- `createDashboardModuleSidebar` — pulsante **Moduli** + pannello; variant `core` (Terreni, Diario, Statistiche, Abbonamento + tile moduli attivi) vs `manodopera` (+ Amministrazione, Statistiche manodopera, Manodopera, …).
- `createDashboardPanoramaHubSection` — **Richiede attenzione** (`refreshAttention` in `dashboard-hub.js`: sotto scorta, **prezziInAttesa**, guasti, scadenze mezzi, affitti, da pianificare CT+manodopera, ore da validare), **Per te oggi**, **Accessi rapidi** (pin ★ + recenti per `userId` in localStorage).
- `createDashboardQuickBarSection` — **I miei accessi** (5 slot, modale **Configura**, catalogo in `dashboard-quick-bar.js`).
- `createDashboardDeadlinesRow` — **Scadenze amministrazione** + **In arrivo**.
- `createDashboardMeteoSection` — widget riga `.dashboard-meteo-row`; visibile se `planId !== 'free'`; titolo **Meteo sede** vs **Meteo** se modulo `meteo`; sede da Impostazioni (`dashboard-meteo.js`).
- Pin tile: `wrapTilesWithPinShells` + stella su `.dashboard-module-tile` (anche voci nel menu Moduli).

**Rami layout (`renderDashboard`):**

- Manager/admin **senza** Manodopera: `dashboard-panorama-layout` (menu + hub + quick bar + scadenze + meteo se Base).
- Manager/admin **con** Manodopera: stesso blocco panoramica (variant menu `manodopera`); **non** monta `createManagerSection` sotto.
- Manager **con** moduli avanzati **senza** Manodopera: panoramica **+** tile modulo in `container` (`createVignetoCard`, `createMagazzinoCard`, …).
- Operaio/caposquadra soli: `createCoreBaseSection` o sezioni ruolo; messaggio se Manodopera assente.
- Header: **Invita collaboratore** se `hasManodopera` + manager/admin; **Mappa** se manager/admin.

Legacy (deprecato in UX utente): `createManagerSection`, card affitti standalone — sostituiti da hub/scadenze dove possibile.

---

## Pagine HTML Core (percorsi relativi tipici da `core/`)

| Pagina | File |
|--------|------|
| Dashboard | `dashboard-standalone.html` |
| Terreni | `terreni-standalone.html` |
| Diario attività | `attivita-standalone.html` |
| Statistiche base | `statistiche-standalone.html` |
| Abbonamento | `admin/abbonamento-standalone.html` |
| Amministrazione hub | `admin/amministrazione-standalone.html` |
| Utenti | `admin/gestisci-utenti-standalone.html` |
| Impostazioni | `admin/impostazioni-standalone.html` (header) |

`gestione-lavori-standalone.html`, `segnatura-ore-standalone.html`, `validazione-ore-standalone.html`, workspace campo: **perimetro Manodopera** / ruoli operativi — non Core-only per la guida utente; restano in guida `MANODOPERA` / `lavori-attivita` legacy.

---

## Piani (`SUBSCRIPTION_PLANS`)

- `free`: `maxTerreni` 5, `maxAttivitaMese` 30, `maxModules: 0` → nessun modulo **acquistabile**; **trial 30gg** un modulo alla volta (`canStartModuleTrial` / Abbonamento UI); Tony bloccato (`applyTonyFreemiumGate` in `main.js`); meteo dashboard nascosto.
- `base`: terreni/attività illimitati; moduli pay-per-use (`calculateTotalPrice`, `canActivateModule`) + stesso trial; **Tony Guida** (widget + `tonyAsk`); consigli moduli (`tony-module-recommendations.js`, solo Base, non Free/Avanzato).
- Modulo `tony` in `AVAILABLE_MODULES`: **Tony Avanzato** (automazioni), separato da Tony Guida del Base.

---

## Tony: comportamento atteso Core-only / Base

- **Free:** widget nascosto; CF rifiutano richieste.
- **Base:** widget visibile; **Tony Guida** — spiegazioni + `consigliModuli` / `tryTonyModuleAdvisorQuickReply`; **senza** modulo `tony` → no navigazione/form injection (`isTonyAdvancedActive` false).
- Modulo `tony`: Tony Avanzato — `APRI_PAGINA`, form injection, filtri; briefing vocale dashboard (`tonyDashboardBriefingVoiceAllowed` richiede modulo `tony`). Foto bolla/fattura: anche modulo `magazzino` + manager/admin — dettaglio in `GUIDA/TONY` e `GUIDA/MAGAZZINO`.
- Intent prodotto: con solo Base, Tony **guida** e suggerisce moduli; automazioni solo con modulo `tony`.

---

## Caricamento guida per il modello (`tony-service.js`)

- Guida completa: fetch concatenato da `core/GUIDA/` poi `docs-sviluppo/GUIDA/` (vedi `GUIDA_LOAD_ENTRIES`).
- Fallback: `GUIDA_APP_PER_TONY` in [`tony-guida-app.js`](../../../../core/services/tony-guida-app.js).

---

## Migrazione documentazione

- Legacy: `docs-sviluppo/guida-app/` — moduli sotto `moduli/*.md` ancora caricati fino a migrazione in `GUIDA/<AMBITO>/tony/`.
- `INTERSEZIONI/tony/intersezioni.md` sostituisce progressivamente `intersezioni-moduli.md` duplicato.

---

## currentTableData

Pagine core tipiche: `terreni`, `attivita`. Con moduli attivi molte altre liste espongono `pageType` (lavori, impegni_giornalieri, prodotti, …) — vedi guide modulo e canone `table-data-ready` in `tony/main.js`.

## Mappa

`dashboard-maps.js` / `mappa-aziendale-standalone.html`: con Manodopera — layer Allarmi (pin `!`), progresso, zone lavorate; dettaglio in `GUIDA/MANODOPERA`.

## Terreni — disegno confini (Fase 1b)

- UI: `terreni-standalone.html` → **Traccia Confini**. Motore: `core/js/terreni-maps.js` + helper puri `core/js/terreni-draw-helpers.js` (test `tests/terreni-draw-helpers.test.js`).
- Comportamento: tap angoli; chiusura vicino al primo vertice o doppio tap; **Togli ultimo**; overlay terreni già in anagrafe; snap bordo/vertice (anche in ritocco). Stesso `polygonCoords` + `updateAreaInfo`.
- Tony **non** traccia poligoni (`MASTER_PLAN` §10, `TONY_DECISIONI` §21.14). Può aprire Terreni e spiegare i passi.
- Niente «Proponi confine» / SAM (no-go 2026-09-05). Stesso disegno su terreni clienti CT.

---

## Note implementazione

- Hub attenzione e scadenze condividono snapshot `dashboard-counts-snapshot.js` (incl. `prezziInAttesa`).
- Nuove tile o voci menu Moduli: documentare sotto `GUIDA/<MODULO>/utente` e `tony`; aggiornare `MODULE_CATALOG` in `dashboard-hub.js` se serve pin/accessi rapidi.
- Ogni nuova card dashboard modulare: documentare sotto `GUIDA/<MODULO>/utente` e `tony`, non sotto Core (salvo panoramica trasversale qui).
