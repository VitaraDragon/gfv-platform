# Core — guida tecnica Tony

Contesto: GFV Platform **senza moduli opzionali attivi** su `tenants.modules` (array vuoto o solo metadati senza moduli da `AVAILABLE_MODULES`). Piano Free o Base con zero moduli acquistati.

Fonti codice prioritarie: [`core/config/subscription-plans.js`](../../../../core/config/subscription-plans.js), [`core/js/dashboard-controller.js`](../../../../core/js/dashboard-controller.js), [`core/js/dashboard-sections.js`](../../../../core/js/dashboard-sections.js), [`core/services/tony-service.js`](../../../../core/services/tony-service.js), [`core/js/tony/main.js`](../../../../core/js/tony/main.js).

---

## Moduli (id `AVAILABLE_MODULES`)

`manodopera`, `parcoMacchine`, `contoTerzi`, `vigneto`, `frutteto`, `oliveto` (non disponibile), `magazzino`, `tony` (Tony Avanzato operativo), `report`.

Senza questi id in `tenants.modules`, le relative card/azioni non devono essere documentate come disponibili nell’esperienza Core-only.

---

## Dashboard (`dashboard-controller.js` / `dashboard-sections.js`)

- `hasOnlyCoreModules(availableModules)` → true se nessun modulo “avanzato” (tutto fuori `core` nel filter — vedi `dashboard-utils.js`).
- Manager/Admin **senza** `manodopera`: layout top-row con `createTerreniCard`, `createDiarioAttivitaCard`, `createAffittiScadenzaCard`, `createStatisticheCard(false)`, `createAbbonamentoCard`; mappa `createMappaAziendaleSection`; card modulo solo se `includes` modulo.
- Sezione Manager “Gestione Operativa” (`createManagerSection`) per core-only mostra solo Terreni, Diario, Statistiche nelle azioni rapide — **nessuna** Gestione Lavori in quel blocco quando `isCoreOnly`.
- `hasAdvancedModules` false → non montare sezioni Manodopera (manager manodopera, diario da lavori, caposquadra, operaio).
- **Invita collaboratore** (header): inteso legato a Manodopera + ruolo manager/admin — da nascondere con solo base (allineamento prodotto in corso).

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

- `free`: `maxTerreni`, `maxAttivitaMese`, `maxModules: 0` → nessun modulo acquistabile finché non si passa a Base.
- `base`: moduli pay-per-use (`calculateTotalPrice`, `canActivateModule`).

---

## Tony: comportamento atteso Core-only

- Widget presente globalmente.
- Modulo `tony` (Tony Avanzato): abilita navigazione operativa (`APRI_PAGINA`), form injection, comandi — vedi messaggi blocco in `main.js` quando modulo non attivo.
- **Intent prodotto documentato:** con solo base, Tony **guida** senza azioni su dati tenant né navigazione forzata né compilazione — allineare istruzioni sistema / CF se divergenza.

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

Pagine core che espongono tabelle: `terreni`, `attivita` (vedi canone `table-data-ready` in `tony/main.js` e `TONY_DECISIONI`).

---

## Note implementazione

- Allineare visibilità **Invita** e assenza **Tour** in header con guida utente Core.
- Ogni nuova card dashboard modulare: documentare sotto `GUIDA/<MODULO>/utente` e `tony`, non sotto Core.
