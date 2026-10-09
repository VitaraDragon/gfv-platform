# Tony — guida tecnica modulo Manodopera

Modulo in **`dashboard.moduli_attivi`** (chiave tipica `manodopera`). In contesto serializzato può comparire come elenco moduli dell’**azienda** corrente.

## Path standalone (relativi a `core/` e `core/admin/`)

| Area | File |
|------|------|
| **Home hub modulo** | `modules/manodopera/views/manodopera-home-standalone.html` |
| **Impegni giornalieri** | `modules/manodopera/views/impegni-giornalieri-standalone.html` |
| Versione mobile campo | `mobile/field-workspace-standalone.html` |
| Segnatura ore (desktop) | `segnatura-ore-standalone.html` |
| Validazione ore | `admin/validazione-ore-standalone.html` |
| Gestione lavori | `admin/gestione-lavori-standalone.html` |
| I miei lavori (dettaglio / zone) | `admin/lavori-caposquadra-standalone.html` |
| Statistiche manodopera (manager) | `admin/statistiche-manodopera-standalone.html` |
| Gestione squadre | `admin/gestione-squadre-standalone.html` |
| Gestione operai | `admin/gestione-operai-standalone.html` |
| Compensi operai | `admin/compensi-operai-standalone.html` |
| Statistiche lavoratore (embed mobile) | `mobile/statistiche-lavoratore-standalone.html` |

Navigazione admin → hub: `core/config/manodopera-hub-nav.js` (`wireManagerHomeLink`, label **← Dashboard**; hub modulo → home app: **← Dashboard Principale**).

Dashboard ingresso hub: `MODULE_CATALOG.manodopera` in `dashboard-hub.js`; tile `createManodoperaCard()` in `dashboard-sections.js` (menu **Moduli**, variant `manodopera`); **Per te oggi** → href hub; quick bar `manodoperaHome` in `dashboard-quick-bar.js`.

Con **Manodopera** attivo il controller **non** monta `createManagerSection` sotto la panoramica (card sparse legacy).

`page.pagePath` è il pathname corrente (es. contiene `manodopera-home`, `field-workspace`, `segnatura-ore`, `validazione-ore`, `gestione-operai`, …).

## Versione mobile (`field-workspace-standalone.html`)

- `window.currentTableData.pageType`: **`field_workspace`**; evento `table-data-ready` come da canone liste dove implementato.
- **Caposquadra:** slide visibili — `Lavoro`, `Comunicazioni` (classe `capo-only`), `Ore`, `Statistiche`; ordine swiper dopo init: Lavoro → Comunicazioni → Ore → Statistiche.
- **Operaio:** nascosta slide `Comunicazioni`; nascoste sezioni inline **La mia squadra** e **Valida ore** sullo slide Lavoro.
- Iframe dettaglio lavoro: `../admin/lavori-caposquadra-standalone.html?ws=classic&focusLavoroId=<id>&embed=mobile`.
- Comunicazioni caposquadra: collection `comunicazioni` con `destinatari`, `lavoroId`, `messaggio`, `data`, `orario`, `source: 'mobile_field_workspace'`.
- Ore inline: subcollection `lavori/{lavoroId}/oreOperai`, stato tipico **`da_validare`** dopo salvataggio operaio. Il proprietario modifica o elimina solo `da_validare` e `rifiutate` (il lavoro non cambia). Sovrapposizione stesso utente/giorno bloccata in client (`ORE_SOVRAPPOSTE`). Tony la controlla appena ha data, inizio e fine, prima di chiedere la pausa, e di nuovo al «sì» (`gfvOreControllaSovrapposizione`, alternativa da `primoOrarioLiberoDopo`). Il lavoro del riepilogo viene dal testo (`risolviLavoroDaTesto`), non dalla prima voce della lista. La pausa 0 del form non è confermata finché l’utente non la dice o non accetta il riepilogo. Macchina e attrezzo iniettati solo se nominati nel turno; altrimenti restano quelli del lavoro. Dopo la validazione: correggi / annulla / rifiuta con motivo (`storicoModifiche`); una riga `validate` non si cancella. Traccia con data e ora (`vociTracciaOra`). Il ricalcolo stelline (`profiliManodopera`) parte solo se chi agisce è manager o amministratore. Gli id del form ore restano quelli già mappati.
- **Pieno in campo** (⛽): scheda compare nella slide **Ore** sotto il form **Segna ore**, solo se `lavoroRichiedeRifornimento(lavoro)` (lavoro ha `macchinaId`, non solo attrezzo) + Magazzino attivo (gate `hasModuleAccessFromTenant`) + prodotti carburante in anagrafica. UI in `core/mobile/js/pieno-campo-ui.js` (bind form, load prodotti categoria `carburante`, label mezzo). Cloud Function `registraPienoCampo` (`functions/registra-pieno-campo.js` + core in `functions/lib/registra-pieno-campo-core.js`): tenant, lavoroId, prodottoId, quantità, data → crea movimento uscita con `origineCarburante: 'pieno'` + `macchinaId` dal lavoro; giacenza prodotto carburante **diminuisce** (atomico `increment`). Vedi anche `GUIDA/MAGAZZINO/tony/guida-tecnica.md` § Form Tony (carburante).

## Target motore (`core/js/tony/engine.js`)

Alias: **segnatura ore** / **segnare ore**, **validazione ore** / **validare ore**, **lavori caposquadra** / **i miei lavori**, **statistiche manodopera** / **statistiche ore**, **gestione squadre** / **squadre**, **gestione operai** / **operai**, **compensi operai** / **compensi**, **manodopera** / **home manodopera** / **dashboard manodopera** → hub `manodopera-home-standalone.html`, **impegni giornalieri** / **impegni giorno** → `impegni-giornalieri-standalone.html` (`tony-routes.json` + `NAV_TARGET_RULES`).

## pageType / Tony

- **`lavori`** — gestione lavori manager.  
- **`impegni_giornalieri`** — vista impegni giorno (`manodopera-impegni-giorno-service.js` / logic pura); merge `setContext('page')` + `table-data-ready`.  
- **`field_workspace`** / **`lavori_caposquadra`** — `_resolveFieldWorkspaceTableDataForEnumerate` in `tony-service.js`.

## Form Tony (avanzato)

- **Segnatura ore:** `ora-modal`, mapping **ora**; su versione mobile form inline `quick-hours-form` / contesto `field-workspace-ore-form` in mapping. Scelta lavoro: `risolviLavoroDaTesto` in `core/js/tony/tony-ora-lavoro-match.js` (a parità di punteggio vince il lavoro di oggi; senza data non conta come oggi). Il modal si apre solo se il lavoro è univoco e segnabile. Un lavoro `sospeso` non entra nel dropdown (`isLavoroInDropdownSegnaOre` → false) e non riceve ore nuove: `risolviLavoroDaTesto` restituisce `stato: 'sospeso'`, con la ripresa tra i candidati se `ripresaDaLavoroId` coincide. «Tutto pronto» senza nome, da motore locale, modello, streaming o voce, passa da `tonyTestoUscitaSegnaOre` (`riepilogoSegnaOreAmmesso`): se manca il nome diventa la domanda sul lavoro. La guardia vale se c’è il form Segna ore o se la pagina è `segnatura_ore`, non solo con il profilo campo. In lista il badge del sospeso è «Sospeso». La data è `risolviDataSegnaOre`: vale quella detta nel messaggio nuovo; se non c’è ed è una richiesta nuova, è oggi; si tiene la data in corso solo se si risponde a pausa, lavoro, orario o «sì». «Tutto pronto» include «oggi gg/mm», «ieri gg/mm» o «il gg/mm». Annulla, cambio pagina e `pagehide` chiamano `tonyAzzeraSegnaOreInAttesa`: senza conferma in attesa e, sul modulo desktop, senza modal aperto, il «sì» non salva. Etichetta sola lettura `#ora-data-it` (gg/mm/aaaa con giorno); `#ora-data` resta `type=date` e il valore salvato resta ISO. Il salvataggio emette `gfv-ora-salvata` o `gfv-ora-salvataggio-errore`. Tony aspetta l'evento fino a 15 secondi; il toast è solo il ripiego. `interpretaEsitoSalvataggioOra` sceglie in attesa, già valida, errore vero o esito sconosciuto. `messaggioConfermaSalvataggioOra` scrive «Fatto» con lavoro, data e fascia, oppure il motivo vero. Se la chat ripristinata chiede ancora «Vuoi salvare?», `togliConfermeSalvataggioVecchie` toglie quella domanda, il «sì» subito dopo e la nota «Questa richiesta è scaduta»: non si salvano e non tornano. I messaggi scritti prima che Tony sia pronto restano in coda (`accodaInvio`) e partono da soli. Il totale del giorno usa `riepilogoGiornoDopoEliminazione` e `riepilogoGiornoDopoSalvataggio` e si disegna subito. L'ingresso dopo il login è `decidiIngressoDopoLogin`: una volta sola, verso l'area di lavoro o la dashboard.
- **Lavori:** `lavoro-form` / checklist (assegnazioni squadra/autonomo).

## Zone lavorate (dettaglio lavoro)

- UI: `admin/lavori-caposquadra-standalone.html` (iframe da field-workspace).
- Motore **due punti** (default se terreno ha poligono): `core/js/zona-lavorata-slice.js` (`slicePolygonBetweenPoints`); modalità `zonaDrawMode` `slice` | `manual`.
- Flag: `zonaLavorataDuePunti` in `core/config/feature-flags.js` — **`enabledAlways: true`** (promossa; non dipende più dallo switch Prova/Pubblicata).
- Delete lavoro manager: `core/services/lavoro-delete-cascade.js` (+ utils) da `openEliminaModal` in `gestione-lavori-events.js` — cascata su ore, zone, comunicazioni, ecc.



## Assenze e sostituzioni

| Pezzo | Path |
|-------|------|
| UI manager | `core/admin/js/gestione-lavori-assenze-ui.js` (+ modali in `gestione-lavori-standalone.html`) |
| Standby assenza | `core/services/lavoro-standby-assenza-service.js` |
| Assegna sostituto / prestito | `core/services/lavoro-sostituzione-assenza-service.js` |
| Shortlist | `manodopera-sostituti-shortlist-logic.js` / `-service.js`; policy `manodopera-sostituzione-policy-config.js` |
| Roster giorno | `manodopera-roster-giorno-logic.js`; impegni `manodopera-impegni-giorno-*.js` |
| Campo | `field-workspace` — `segnalaAssenza`, banner `lavoro-sostituto-banner`; context `lavoro-sostituto-context.js` |
| Config tipi assenza | `core/config/manodopera-assenze-config.js` |
| Skill / stelle | `manodopera-skills-config.js`; UI scheda in `gestione-operai-standalone.html` |
| Semaforo severità | `manodopera-problema-severita-logic.js` (rosso/giallo) |
| Tony giorno | `functions/tony-manodopera-giorno-context.js` (roster + shortlist materializzata; «chi è libero / candidati» senza ricalcolo client inventato) |
| Push | `assenza_turno` in `notification-catalog.js` → Gestione lavori / field-workspace |

Flusso: segnalazione → conferma manager → `in_standby` se sotto minimo → shortlist (max ~4, skill + prossimità terreno/podere) → sostituto o prestito (`manodoperaPrestata` su origine). Anagrafica squadra globale **non** riscritta dal prestito.

## Notifiche push (ciclo lavoro / assenze)

Eventi Manodopera-centrici in `notification-catalog.js` (vedi anche `CORE/tony/guida-tecnica.md` § Notifiche push): comunicazione, lavoro assegnato, conferme in ritardo, ore da validare, lavoro da approvare/sospeso, assenza oggi. Prefs in Impostazioni; FCM da field-workspace / dashboard. WhatsApp solo escalation assenza.

## Guide utente per ruolo

- `MANODOPERA/utente/guida.md` (indice), `guida-manager.md`, `guida-caposquadra.md`, `guida-operaio.md`.

## Riassunto contesto client

- **`MANODOPERA/utente/guida-sintesi.md`** → **`context.guida_sintesi_manodopera`** (`tony-service.js`, dedup primo turno).
