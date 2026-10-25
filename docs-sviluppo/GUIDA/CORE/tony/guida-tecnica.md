# Core — guida tecnica Tony

Contesto: GFV Platform **senza moduli opzionali attivi** su `tenants.modules` (array vuoto o solo metadati senza moduli da `AVAILABLE_MODULES`). Piano Free o Base con zero moduli acquistati.

Fonti codice prioritarie: [`core/config/subscription-plans.js`](../../../../core/config/subscription-plans.js), [`core/js/dashboard-controller.js`](../../../../core/js/dashboard-controller.js), [`core/js/dashboard-sections.js`](../../../../core/js/dashboard-sections.js), [`core/services/tony-service.js`](../../../../core/services/tony-service.js), [`core/js/tony/main.js`](../../../../core/js/tony/main.js).

---

## Moduli (id `AVAILABLE_MODULES`)

`manodopera`, `parcoMacchine`, `contoTerzi`, `vigneto`, `frutteto`, `seminativo` (completo su **main**), `oliveto` (non disponibile), `magazzino`, `tony` (Tony Avanzato operativo), `report`, `meteo`, `vendemmiaMeccanica`.

Accesso effettivo = moduli pagati **+** trial attivi (`module-access-resolver.js`, `MODULE_TRIAL_DAYS = 30`, un trial attivo alla volta). Senza id attivo (pagato o trial), le relative card/azioni non devono essere documentate come disponibili nell’esperienza Core-only.

---

## Dashboard (`dashboard-controller.js` / `dashboard-sections.js` / `dashboard-hub.js`)

Layout **panoramica** (manager/admin, non solo operaio/caposquadra):

- `createDashboardModuleSidebar` — pulsante **Moduli** + pannello; variant `core` (Terreni, Diario, Statistiche, Abbonamento + tile moduli attivi) vs `manodopera` (+ Amministrazione, Statistiche manodopera, Manodopera, …).
- `createDashboardPanoramaHubSection` — **Richiede attenzione** (`refreshAttention` in `dashboard-hub.js`: sotto scorta, **prezziInAttesa**, guasti (aperti = `isGuastoAttivo` da `core/services/guasto-stati.js`: risolti, annullati, riparati e chiusi esclusi), scadenze mezzi, affitti, da pianificare CT+manodopera, ore da validare), **Per te oggi**, **Accessi rapidi** (pin ★ + recenti per `userId` in localStorage).
- `createDashboardQuickBarSection` — **I miei accessi** (5 slot, modale **Configura**, catalogo in `dashboard-quick-bar.js`).
- `createDashboardDeadlinesRow` — **Scadenze amministrazione** + **In arrivo**.
- `createDashboardMeteoSection` — widget riga `.dashboard-meteo-row`; visibile se `planId !== 'free'`; titolo **Meteo sede** vs **Meteo** se modulo `meteo`; sede da Impostazioni (`dashboard-meteo.js`).
- Pin tile: `wrapTilesWithPinShells` + stella su `.dashboard-module-tile` (anche voci nel menu Moduli).

**Rami layout (`renderDashboard`):**

- Manager/admin **senza** Manodopera: `dashboard-panorama-layout` (menu + hub + quick bar + scadenze + meteo se Base).
- Manager/admin **con** Manodopera: stesso blocco panoramica (variant menu `manodopera`); **non** monta `createManagerSection` sotto.
- Manager **con** moduli avanzati **senza** Manodopera: panoramica **+** tile modulo in `container` (`createVignetoCard`, `createMagazzinoCard`, …).
- Operaio/caposquadra soli: `createCoreBaseSection` o sezioni ruolo; messaggio se Manodopera assente.
- Ingresso dopo il login (#169): prima di disegnare, `applicaIngressoDopoLogin` → `spiegaIngressoDopoLogin` (`core/js/tony/tony-ingresso-login.js`) decide una volta sola workspace / dashboard / errore; `?ws=classic&una_volta=1` non salva la preferenza. Dettaglio in `GUIDA/MANODOPERA/tony/guida-tecnica.md` § Versione mobile.
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

## Inviti (registrazione da link)

- Lookup token **solo** via Cloud Function callable **`getInvitoPubblico`** (`functions/invito-pubblico.js`); client: `core/services/invito-service-standalone.js` (`fetchInvitoByToken`).
- Nessuna query Firestore pubblica sugli inviti (rules chiuse); risposta allowlist sanitizzata. Dal #281 la risposta **non** contiene più `cellulare`, `token` e `stato` (il token il client lo ha dall’URL, lo stato è sempre `invitato`): in `registrazione-invito-standalone.html` il campo cellulare **non** è più precompilato, lo digita l’invitato (obbligatorio). Il cellulare inserito dal manager in **Invita Utente** resta sul doc `inviti` (non esce dalla callable pubblica).
- **Accettazione (#283):** il client crea/accede Auth e poi chiama la callable autenticata **`accettaInvito`** (`functions/accetta-invito.js`, export in `functions/index.js`, regione `europe-west1`), unico punto che scrive `users.tenantMemberships` e `inviti.stato = 'accettato'` (transazione Admin SDK). `acceptInvito` in `core/services/invito-service-standalone.js` passa dalla callable; codici HttpsError ammessi: `unauthenticated`, `invalid-argument`, `not-found` («Token invalido o già utilizzato.»), `failed-precondition` («Token scaduto. Contatta l'amministratore per un nuovo invito.», «Invito senza azienda.», «Invito senza mittente.»), `permission-denied` («L'email dell'account non corrisponde all'invito.», «Invito non valido.», «Invito non più valido: il mittente non è manager o amministratore dell'azienda.», «Solo un amministratore può invitare un altro amministratore.»), `already-exists` → client «Appartieni già a questa azienda». Il membro legacy (`tenantId` uguale senza membership) non viene declassato con i ruoli dell'invito. `campiNomeDaInvitoSeVuoti` ora è applicato **lato server** in `accetta-invito.js` (nome/cognome dall’invito solo se vuoti su `users`, 8899ca5). Test `tests/accetta-invito-functions.test.js`, `tests/invito-client-no-public-query.test.js`, `tests/services/invito-pubblico.test.js`.
- **Rules `users` (#283):** read = proprio doc o `resource.data.tenantId` di un tenant a cui si appartiene (`belongsToTenant`); niente più lettura globale per manager/admin (quindi niente controllo «email già esistente» lato client in **Gestisci utenti**: `isExistingUser = false`, il doppione lo rifiuta `accettaInvito` con `already-exists`). Create = profilo senza campi autorizzativi (`userHasAuthOrContractFields`) oppure `isOwnCompanyRegistrationCreate()` (un solo ruolo `amministratore`, membership unica sul tenant creato da sé). Update = proprio doc con lista bianca `userSelfProfileKeysOnly` (nome, cognome, telefono, cellulare, ultimoAccesso, isOnline, lastSeen, notificationPrefs, aggiornatoIl) oppure manager/admin dello stesso `tenantId` **solo** su campi contratto (`tipoOperaio`, `tipoContratto`, `dataInizioContratto`, `dataScadenzaContratto`, `noteContratto`, `tariffaPersonalizzata`). Delete client vietato. Effetto in **Gestisci utenti** (`admin/gestisci-utenti-standalone.html`): **Modifica ruoli**, attiva/disattiva utente e rimozione utente vanno in `permission-denied` e mostrano «Non puoi modificare i ruoli da questa pagina (blocco di sicurezza). La gestione ruoli sarà ripristinata a breve lato server.» / «Non puoi cambiare lo stato utente da questa pagina (blocco di sicurezza). Sarà ripristinato a breve lato server.» / «Non puoi rimuovere documenti utente dal client (blocco di sicurezza). Sarà gestito a breve lato server.» (parte 1: callable per ruoli/stato non ancora presente). `core/services/role-service.js` (`assignRole`, `removeRole`, `assignRoles`, `setRoles`) è disabilitato. `admin/fix-utente-mancante.html` mostra solo «Questo strumento è disabilitato per sicurezza…». `auth/login.html` (pagina legacy, non il login-standalone) non interroga più `users` per email. Rules `inviti`: create solo manager/admin a proprio nome; update client solo `invitato → annullato` (**Annulla invito**); delete manager/admin (**Rimuovi invito**). Test `tests/firestore-users-membership-rules.test.js`, `tests/users-membership-client-static.test.js`.

## Gate Manodopera ↔ Diario

- Helper: `core/config/manodopera-diario-gate.js` — `tenantHasManodopera(modules)`, `registroLavoriHref({ hasManodopera, stato, from })`, `applyRegistroLavoriLinks(root, hasManodopera)` (riscrive i link `data-gfv-registro` = `in_corso` / `completato` / `da_pianificare` / `conto_terzi`), `applyDiarioVsLavoroCta(root, hasManodopera)` (`#link-diario` vs `#link-nuovo-lavoro`).
- **Manodopera spenta:** `attivita-standalone.html` editabile (`body[data-gfv-diario="editabile"]`); `admin/gestione-lavori-standalone.html` aggiunge `body.gestione-lavori-bloccata` e mostra `#gestione-lavori-gate` («Modulo Manodopera non attivo»); link `da_pianificare` nascosti; registri conto terzi → Diario `?contoTerzi=true&stato=…`.
- **Manodopera accesa:** Diario = storico (`data-gfv-diario="storico"`, `#diario-sola-lettura` visibile, `#btn-aggiungi-attivita` nascosto, niente modifica/elimina in `attivita-controller.js`; `openAttivitaModal` / `confirmDeleteAttivita` mostrano alert info). Link conto terzi → `gestione-lavori-standalone.html?contoTerzi=true&stato=…` (filtro tipo `conto_terzi`).
- Dashboard: `dashboard-hub.js` toglie `diarioAttivita` da pin/recenti e da **Per te oggi** con Manodopera (senza Manodopera: Diario + Terreni); `dashboard-quick-bar.js` e shell `ui-pelle-state.js` usano `hideWhenManodopera` sulla voce Diario (fuori dal menu Moduli); `hrefWhenManodopera` per le voci conto terzi; `dashboard-deadlines.js` footer **In arrivo** di default → Diario (Parco Macchine → scadenze mezzi); shell voce **Gestione lavori** con `requireManodopera`.
- **Migrazione dati all’on/off Manodopera (#133):** `core/services/manodopera-migrazione-service.js` (`allineaDatiManodopera`, `contaLavoriApertiTenant`, `elencoAttivitaSolaLettura`) + `manodopera-migrazione-logic.js` (`messaggioLavoriAperti`, `formatToastMigrazione`, `motivoSolaLetturaAttivita` → codici `tipo-altro` / `ct-incompleto` / `campi-vuoti`; in guida utente etichette «Tipo Altro» / «Conto terzi incompleto» / «Campi obbligatori mancanti» — UI può ancora mostrare i codici grezzi, da fare in coda prodotto). **Trigger solo pagina Abbonamento:** `admin/abbonamento-standalone.html` (`preparaDisattivazioneManodopera` con dialog «Lavori ancora aperti», `allineaManodoperaUi` al caricamento tenant e dopo cambio piano/moduli / ricarico post-Stripe; spinner sopra `SOGLIA_SPINNER_MIGRAZIONE` = 20 documenti) e `tenant-service.js` `addModuleToTenant` / `removeModuleFromTenant` (errore `MANODOPERA_LAVORI_APERTI` senza `confermaLavoriAperti`). Se il modulo scade o viene revocato **senza** aprire Abbonamento, la migrazione **non** parte finché non si apre quella pagina. Auto-migrazione altrove = backlog prodotto. Copia idempotente: attività → `lavori` (chiusa → `completato`, oggi senza fine → `in_corso`; validazione dedicata che accetta date oltre ~1 anno), lavori → attività Diario **editabili** (annullato con nota). Nessuna cancellazione; non mappabili in `#attivita-precedenti-section` di `gestione-lavori-standalone.html` (solo con Manodopera).
- **Cascata tipo lavoro Diario (#136):** `attivita-standalone.html` usa sempre la struttura gerarchica `#attivita-categoria-principale` → `#attivita-sottocategoria` (gruppo visibile solo se la categoria ne ha) → `#attivita-tipo-lavoro-gerarchico`; aggancio in `core/js/attivita-events.js` / `attivita-controller.js` + `core/js/lavoro-cascade-filters.js` (padre salvato come codice o tipo legato a sottocategoria). Stessa logica in modifica lavoro (`admin/js/gestione-lavori-events.js`). Date input su giorno locale (#138).
- Pagine che applicano il gate CTA: home Conto Terzi, hub Vendemmia Meccanica (Lavori CT), Seminativo lavorazioni/trattamenti/**concimazioni**/raccolta (`applyDiarioVsLavoroCta`). Tony: frasi lavoro fatto → `tony-lavoro-fatto-nav.js` (vedi guida tecnica TONY); con Manodopera destinazione Gestione lavori, non Diario.

`gestione-lavori-standalone.html`, `segnatura-ore-standalone.html`, `validazione-ore-standalone.html`, workspace campo: **perimetro Manodopera** / ruoli operativi — non Core-only per la guida utente; restano in guida `MANODOPERA` / `lavori-attivita` legacy.

---

## Piani (`SUBSCRIPTION_PLANS`)

- `free`: `maxTerreni` 5, `maxAttivitaMese` 30, `maxModules: 0` → nessun modulo **acquistabile** e, dal #289 (decisione prodotto 24/10/2026, annulla quella del 22/06), **nessuna prova**: `canStartModuleTrial` (client `core/utils/module-access-resolver.js` e server `functions/module-trial.js`) rifiuta se `resolveTenantPlanId(tenant) !== 'base'` con `MODULE_TRIAL_REQUIRES_BASE_REASON` «La prova gratuita dei moduli è disponibile con il piano Base.»; in Abbonamento `toggleModule` usa `resolveModuleToggleIntent` (`already_active` / `require_base` / `start_trial` / `purchase`): con Free mostra l’alert senza dialog né callable. Testo sezione «Moduli Disponibili»: «…prova gratuita di 30 giorni (piano Base, un modulo alla volta).»; `canActivateModule('free')` → «Piano Free: passa al piano Base per acquistare moduli o avviare la prova gratuita di 30 giorni.». Tony bloccato (`applyTonyFreemiumGate` in `main.js`); meteo dashboard nascosto.
- `resolveTenantPlanId(tenantData)` in `core/config/subscription-plans.js` (allineato a `functions/tenant-plan.js`): `plan` vince su `piano`; Free con `stripeSubscriptionId` e `status` in `active` / `trialing` / `expiring` (assente = attivo) ⇒ `base`. Helper `rawPlanFromTenant`, `hasActiveStripeBaseSubscription`.
- **Moduli effettivi (#289):** `getEffectiveModulesFromTenant(tenantDocData)` (= `resolveEffectiveModules`: pagati + prove attive) è il punto unico da usare al posto di `tenant.modules` grezzo. Ora lo usano anche `admin/gestione-lavori-standalone.html` (flag `hasManodoperaModule`, `hasParcoMacchineModule`, `hasContoTerziModule`, `hasVendemmiaMeccanicaModule` e contesto Tony `initContextWithModules`) e `modules/manodopera/views/manodopera-home-standalone.html` (gate «Il modulo Manodopera non è attivo per la tua azienda.» e contatori): con Manodopera **in prova** entrambe le pagine si aprono come con il modulo pagato. Test `tests/module-access-resolver.test.js`, `tests/module-trial.test.js`, fixture `tests/fixtures/module-trial-plan-cases.js`.
- `base`: terreni/attività illimitati; moduli pay-per-use (`calculateTotalPrice`, `canActivateModule`) + prova 30gg (un modulo alla volta, solo Base); **Tony Guida** (widget + `tonyAsk`); consigli moduli (`tony-module-recommendations.js`, solo Base, non Free/Avanzato).
- Modulo `tony` in `AVAILABLE_MODULES`: **Tony Avanzato** (automazioni), separato da Tony Guida del Base.

### Billing backend (Stripe)

Cloud Functions **`functions/stripe-billing.js`** + **`functions/stripe-webhooks.js`** gestiscono sottoscrizioni e pagamenti per la pagina **Abbonamento**. UX utente descritta in `GUIDA/CORE/utente/guida.md` sezione Abbonamento; dettagli tecnici integrazione Stripe in quei CF.

**Campi billing non scrivibili dal client (#285).** In `firestore.rules` (`match /tenants/{tenantId}`) l’update client è negato se tocca `toccaCampiFatturazione()` (`plan`, `piano`, `modules`, `moduli`, `moduleTrials`, `activeBundles`, `stripeCustomerId`, `stripeSubscriptionId`, `stripeAddons`, `subscriptionStatus`, `status`, `stato`, `expiryDate`, …); create ammesso solo Free senza moduli/Stripe (`tenantCreateIsFreeWithoutBilling()`); `allow delete: if false`. Li scrivono solo le CF (`stripe-billing.js`, `stripe-webhooks.js`, `module-trial.js`: commento «ogni nuovo campo di billing va aggiunto a `toccaCampiFatturazione()`»). Abbonamento (`admin/abbonamento-standalone.html`) usa solo callable: `createStripeCheckoutSession` / `fulfillStripeCheckout` / `syncStripeSubscription`, `startModuleTrial` / `syncModuleTrials`, `cancelStripeAddon` / `reactivateStripeAddon`. Rimossi la sezione **«Costruisci il tuo Piano»** (`toggleBuildPlan`, `applyCustomPlan`) e l’inizializzazione client di `expiryDate`/`startDate`. `selectPlan`: Free → Base solo via Stripe Checkout; downgrade/Free → alert «Il passaggio a un piano inferiore non è ancora disponibile dall'app. Per annullare l'abbonamento contatta l'assistenza.»; altri cambi → «L'upgrade del piano avviene solo tramite pagamento Stripe. Usa «Passa al Piano Base» oppure contatta l'assistenza.». In `auth/registrazione-standalone.html` il rollback non può più cancellare il tenant (resta un doc Free orfano, atteso). `tenant-service.js`: `addModuleToTenant` / rimozione moduli marcate «non usare dal browser». Test `tests/firestore-tenant-billing-rules.test.js`.

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

## Onboarding titolare nuovo (Tony Guida)

Decisione prodotto 23/10/2026: un terreno si può salvare senza coltura. Il Diario no. Follow-up stesso giorno: testi utente **senza asterischi**; **Podere facoltativo** (setup può andare Impostazioni → Terreni senza creare poderi).

- Form Terreni `terreni-standalone.html`: `Nome Terreno` e `Tipo Possesso` hanno `required`. `Categoria Coltura` (`#terreno-coltura-categoria`) e `Coltura` (`#terreno-coltura`) **non** sono `required`. Non aggiungere `required` da questa guida. Pulsanti: `#add-terreno-button` «+ Aggiungi Terreno», titolo modale «Aggiungi Terreno» / «Modifica Terreno», riga `editTerreno` con `title="Modifica"`, submit «Salva Terreno».
- Impostazioni `admin/impostazioni-standalone.html` (header ⚙️ Impostazioni, sottotitolo «Configura azienda e account»): Informazioni Azienda → «Salva Impostazioni Azienda»; Account → «Salva Impostazioni Account»; Poderi → «➕ Aggiungi Podere» (submit del modale: «Salva»). Dal form terreno, link «Gestisci poderi nelle impostazioni».
- Diario `attivita-standalone.html`: «Coltura \*» (`#attivita-coltura-gerarchica`, `required`) si precompila da `terreno.coltura` (change su `#attivita-terreno`; elenco anche da `populateColtureFromTerreni` in `attivita-controller.js`). Se `terreno.coltura` manca, l’elenco resta senza voci utili e il salvataggio si ferma con l’alert già in `attivita-events.js` («La coltura è obbligatoria»). Non rendere la coltura opzionale e non cambiare quel messaggio. Hint sotto il campo: rimanda a Terreni → ✏️ Modifica → Categoria Coltura e Coltura → Salva Terreno.
- Intent Tony Guida: spiegare il recupero con Modifica, non bypassare il gate; nelle frasi utente zero `*` / «asterisco»; Podere solo se serve. Testi utente in `CORE/utente/guida.md` e `guida-sintesi.md` (niente path `.html`). Script click-per-click nel fallback `GUIDA_APP_PER_TONY` (`core/services/tony-guida-app.js`), blocco `ONBOARDING TITOLARE NUOVO`. Benvenuto prova Free: `tonyGuidaOnboardingWelcomeMessage` in `core/config/tony-guida-onboarding.js`. Il mirror `functions/tony-guida-onboarding.js` non va aggiornato insieme (vincolo Cloud Functions); eventuale allineamento del prompt nota «primi passi» solo su richiesta esplicita.

## Terreni — categorie coltura senza doppioni (#277)

- `core/js/terreni-categorie-colture.js`: `dedupeCategorieColture` (chiave `codice` normalizzato, altrimenti `nome`; tra doppioni vince quella con colture, poi `predefinita`, poi `ordine`, poi id) e `popolaSelectCategorieColture` su `#terreno-coltura-categoria`. Usati in `loadCategorieColtureTerreni`, `loadColturePerCategoriaTerreni` (nuovo parametro `categorieColtureTerreni`) e a fine `loadColture` in `core/js/terreni-controller.js`.
- Se il caricamento colture fallisce (fallback liste personalizzate), il select categorie mostra «-- Errore caricamento colture: riprova o ricarica la pagina --» e lo stato categorie del form viene svuotato (niente categorie orfane senza colture).
- `core/services/categorie-service.js` `initializeCategoriePredefinite`: dal #279 legge con `leggiCategorieGrezze` (lancia se la lettura fallisce: niente seed su errore), vedi sezione Catalogo sotto. Test `tests/terreni-categorie-colture.test.js`.

## Catalogo — voci omonime unite e seed idempotente (#279, #287)

- **Unione in lettura** (`core/js/catalogo-dedupe.js`, funzioni pure): due documenti con stesso `codice` (o `nome`+`applicabileA` se manca il codice) sono la stessa voce (`chiaveCatalogo`). Canonico deterministico (`confrontaCanonico`: predefinita → `createdAt` più vecchio → id byte); gli altri diventano alias (`raggruppaCategorie` → `canoniche` con `aliasIds` + `aliasToCanon`; sottocategorie raggruppate per padre canonico). Helper: `canonicoDi`, `aliasMapDaCanoniche`, `dedupePerNome`, `unisciColturePerCategoria`, `dedupeTipiLavoro`, `mappeCodiceCanonico`, `trovaCategoriaPerColtura`. Usati in `core/js/terreni-controller.js` / `terreni-events.js` (al posto di `dedupeCategorieColture` del #277), `core/js/attivita-controller.js`, `core/js/lavoro-cascade-filters.js` (cascata categoria → sottocategoria → tipo, riferimenti riportati sul canonico), `modules/frutteto/js/frutteti-page.js`, `modules/seminativo/services/seminativi-service.js`. **Nessun documento viene cancellato o riscritto**: i doppioni restano in Firestore, l’utente vede una voce sola; i riferimenti salvati su un alias vengono risolti verso il canonico in lettura.
- **Seed idempotente** (`core/services/catalogo-seed.js`): id deterministici `seed_<slug codice/nome>` (`idSeed`, `slugCatalogo`), lock in memoria per tenant (`conLockSeed`: una sola esecuzione alla volta anche da più tab/pagine), nessuna scrittura se la lettura fallisce (`leggiCategorieGrezze` ecc. lanciano). Dal #287 `scriviSeedBatch` scrive **solo le voci predefinite mancanti** in `writeBatch` (max `SEED_BATCH_MAX_OPS` 500, `set` merge con `createdAt`/`updatedAt` server): il seed completa le voci predefinite che mancano anche se il catalogo non è vuoto (prima `impostazioni-standalone.html` aveva una lista `COLTURE_PREDEFINITE` propria e ri-seedava solo sotto 20 colture). Servizi: `categorie-service.js`, `colture-service.js` (`initializeColturePredefinite`), `tipi-lavoro-service.js`, `liste-service.js`; chiamanti allineati: `admin/impostazioni-standalone.html`, `admin/js/gestione-lavori-controller.js`, `core/js/attivita-controller.js`, `core/js/terreni-controller.js`, Conto terzi `nuovo-preventivo-standalone.html`, `tariffe-standalone.html`, `terreni-clienti-standalone.html`. Test `tests/catalogo-dedupe.test.js`, `tests/catalogo-doppioni-scenario.test.js`, `tests/catalogo-seed-idempotente.test.js`, `tests/moduli-identificatori-definiti.test.js`.
- Guida utente: solo l’effetto (una voce per nome negli elenchi; le predefinite mancanti ricompaiono da sole).

## Terreni — disegno confini (Fase 1b)

- UI: `terreni-standalone.html` → **Traccia Confini**. Motore: `core/js/terreni-maps.js` + helper puri `core/js/terreni-draw-helpers.js` (test `tests/terreni-draw-helpers.test.js`).
- Comportamento: tap angoli; chiusura vicino al primo vertice o doppio tap; **Togli ultimo**; overlay terreni già in anagrafe; snap bordo/vertice (anche in ritocco). Stesso `polygonCoords` + `updateAreaInfo`.
- Tony **non** traccia poligoni (`MASTER_PLAN` §10, `TONY_DECISIONI` §21.14). Può aprire Terreni e spiegare i passi.
- Niente «Proponi confine» / SAM (no-go 2026-09-05). Stesso disegno su terreni clienti CT.

---

## Note implementazione

- Hub attenzione e scadenze condividono snapshot `dashboard-counts-snapshot.js` (incl. `prezziInAttesa`).
- **Completato senza zone (#239):** `core/js/lavoro-progresso-display.js` (`lavoroCompletatoSenzaZone`, `ETICHETTA_COMPLETATO_SENZA_ZONE` «✅ Completato (nessuna zona tracciata)») sostituisce il 100% forzato nei lavori recenti della dashboard (`dashboard-data.js`, import `?v=2026-10-20a` in dashboard, counts snapshot, scadenze, meteo, quick bar) e nei dettagli dei lavori completati del Diario (`caricaDettagliLavoriCompletati` in `attivita-controller.js`: «✅ Completamento: ✅ Completato (nessuna zona tracciata)», senza barra). Nel Diario la superficie del giorno resta somma semplice delle zone (non unione); chiavi data delle zone in data locale (`dateLikeToLocalCalendarIso`, anche `attivita-maps.js`). Dettaglio permessi e unione zone: `GUIDA/MANODOPERA/tony/guida-tecnica.md` § Zone lavorate.
- **Librerie vendorizzate:** `vendor/polygon-clipping-0.15.7.umd.min.js` (caricata da Gestione lavori, I miei lavori, Piano stagione VM; `loadPolygonClipping` in `core/services/zone-lavorate-area.js`): le pagine pubblicate non caricano più da `node_modules` (test `tests/published-no-node-modules.test.js`). Nessuna precache nel service worker.
- Nuove tile o voci menu Moduli: documentare sotto `GUIDA/<MODULO>/utente` e `tony`; aggiornare `MODULE_CATALOG` in `dashboard-hub.js` se serve pin/accessi rapidi.
- Ogni nuova card dashboard modulare: documentare sotto `GUIDA/<MODULO>/utente` e `tony`, non sotto Core (salvo panoramica trasversale qui).

## Notifiche push (FCM)

Distinte dai segnali **Tony in-app** (`tony-proactive-signals.js` / briefing dashboard).

| Pezzo | Path |
|-------|------|
| Catalogo eventi + default prefs + deep link | `core/config/notification-catalog.js` (mirror CF `functions/lib/` via `scripts/sync-notification-modules.cjs`) |
| Policy finestra oraria / coalesce / WA | `core/services/notification-policy.js` |
| Prefs utente `users/{uid}.notificationPrefs` | `core/services/notification-prefs-service.js` — UI `admin/impostazioni-standalone.html` scheda **Notifiche** |
| Registrazione token FCM | `core/js/notification-fcm-client.js` (`startNotificationFcm` / `Background`) — dashboard, impostazioni, field-workspace |
| SW push + click → deep link | `service-worker.js` (`push`, `notificationclick`) |
| Mark seen assenza | `core/services/notification-events-client.js` |
| Dispatch CF | `functions/notification-dispatch.js` — trigger create/write su comunicazioni, lavori, oreOperai, assenze; schedule `processNotificationQueue` |

Eventi catalogo (abilitati): `comunicazione_destinatario`, `lavoro_assegnato`, `conferme_in_ritardo`, `ore_da_validare` (coalesce giorno), `lavoro_completato_da_approvare`, `lavoro_sospeso`, `assenza_turno` (escalation WhatsApp opzionale). Prefs default: `pushEnabled` true, finestra `05:00–21:00` `Europe/Rome`, `confermaTimeoutHours` 6, `assenzaPushEnabled` true, `whatsappEnabled` false. Token in `notificationPrefs.fcmTokens` (max 5). Senza `vapidKey` in firebase-config: no token, eventi Firestore comunque creabili.

## PWA

- Banner install: `core/js/pwa-install-banner.js` (pagine auth; `beforeinstallprompt` / hint iOS).
- Service worker root: `service-worker.js` (cache + handler `push` / `notificationclick`). Dal #237 **non** fa più `skipWaiting()` in `install`: il worker nuovo resta in attesa finché la pagina non manda `{ type: 'GFV_SKIP_WAITING' }`; risponde a `{ type: 'GFV_GET_BUILD' }` con `{ type: 'GFV_BUILD', buildId: SW_CACHE_BUILD_ID }` (MessageChannel). Su localhost non intercetta il fetch salvo `?swTest=1` sull’URL del worker (solo test).
- **Barra «C’è una nuova versione» (#237):** `core/js/app-update.js` (`registraServiceWorker(swPath)`, una sola registrazione per pagina). Registrano: `login-standalone.html`, `registrazione-invito-standalone.html`, `dashboard-standalone.html`, `attivita-standalone.html`, `statistiche-standalone.html`, `terreni-standalone.html`, `segnatura-ore-standalone.html`, `admin/impostazioni-standalone.html`, `mobile/js/field-workspace-controller.js`; dal #259 anche tutte le altre pagine `core/admin/*-standalone.html` (abbonamento, amministrazione, compensi operai, gestione guasti/lavori/macchine/operai/squadre, gestisci utenti, lavori caposquadra, report, statistiche manodopera, validazione ore), `core/mappa-aziendale-standalone.html`, `core/mobile/statistiche-lavoratore-standalone.html` e le viste `modules/*/views/*-standalone.html` (conto terzi, frutteto, macchine, magazzino, manodopera, meteo, report, seminativo, vigneto) con lo stesso blocco `<script type="module">` che importa `registraServiceWorker` da `core/js/app-update.js?v=…` (path SW `/gfv-platform/service-worker.js` su Pages, altrimenti relativo). Sempre #259: `skipPageTurn` in `core/js/ui-pelle.js` aggancia `.catch` a `viewTransition.ready` (niente AbortError in console sul ritorno da bfcache) e il campo legge `sessionStorage` `gfv_ingresso_deciso_at` una sola volta (F5 non è un ingresso dalla dashboard); test `tests/console-ingresso-transizioni.test.js`. `notification-fcm-client.js` (`ensureServiceWorker`) passa dallo stesso modulo. `segnalazione-guasti-standalone.html` importa il modulo solo per l’ascolto form (nell’iframe del campo segna sporco anche `window.parent`). Su localhost registra solo con `?swTest=1` (`registrazioneConsentita`). Controllo `registration.update()` all’avvio, su `visibilitychange` → visible e ogni `INTERVALLO_AGGIORNAMENTO_MS` (15 min). Barra `#gfv-app-update-bar` (testo `update.available`, pulsante `#gfv-app-update-btn` `update.action`, chiavi in `core/config/field-ui-i18n.js`, lingua `leggiLinguaCampo`) solo se `deveMostrareBarra`: la pagina aveva un controller al caricamento (non al primo avvio) **e** c’è un worker `waiting` / `installed`. z-index 10100 sopra modal e Tony; classe `html.gfv-update-bar-visibile` sposta `.field-bottom-nav`, `.modal-content`, `.tony-widget-fab`, `.tony-widget-panel`. Click: se `window.__gfvFormSporco` (input `isTrusted` dentro un `<form>`, azzerato dopo salvataggio ore/guasto) o `__gfvSalvataggioInCorso` / `__gfvOreSalvataggioInCorso` → dialogo `#gfv-app-update-confirm` «Hai dati non salvati: aggiorni lo stesso?» (`#gfv-app-update-annulla` / Esc = niente reload, barra resta; `#gfv-app-update-conferma` = procede). Poi `GFV_SKIP_WAITING` (ripetuto ogni 400 ms finché il worker resta in attesa, fino a `ATTESA_ATTIVAZIONE_MS` = 10 s) e reload su `controllerchange` dopo Aggiorna (`deveRicaricareSuControllerChange`), una volta per build (`sessionStorage` `gfv-sw-reload-<buildId>`; reload in `setTimeout` 0 e di nuovo a 1,5 s). Dal 717016d dopo Aggiorna la barra passa a `statoBarra = 'inCorso'`: testo `update.inProgress` «Aggiornamento in corso…» (riserva `TESTO_RISERVA` se il catalogo in cache è vecchio), pulsante nascosto e `aria-busy`. Se `controllerchange` non arriva entro 10 s (`attesaScaduta`): con `deveRicaricareDopoAttesa({ ricaricando, formSporco, salvataggioInCorso })` vero → `ricaricaSenzaControllerChange` (`location.reload()`, poi dopo `RIPROVA_NAVIGAZIONE_MS` 1,5 s `location.replace(urlPerRiprovaNavigazione(location))` senza `#`); con dati non salvati o salvataggio in corso niente reload, la barra torna «disponibile» e `tentativoScaduto = true` (il prossimo Aggiorna, dopo l’eventuale dialogo, ricarica subito). z-index della barra ora 2147483646, dialogo 2147483647. Form sporchi (#243): `segnaFormSporco` / `segnaFormSalvato` tengono un `Set` di form; `__gfvFormSporco` è vero se il set non è vuoto (propagato a `window.parent`); `reset` di un form e l’evento `gfv:form-salvato` (`EVENTO_FORM_SALVATO`, `detail.form`) lo spengono. Lo emettono dopo il salvataggio `admin/impostazioni-standalone.html` (azienda, account, notifiche, coefficienti morfologia, nuova categoria coltura), `core/js/attivita-events.js` (`#attivita-form`) e `core/js/terreni-events.js` (`#terreno-form`); un form con `data-gfv-senza-avviso` (login) non conta mai. Le guide utente non descrivono un avviso «dati non salvati» dopo il salvataggio: è un caso non voluto (corretto con #243, decisione Coord 22/10); se una pagina lo mostra ancora va segnalato come difetto, non spiegato come normale. Chat Tony: salvata in `sessionStorage` `tony_session_state` su `beforeunload` e ripristinata dopo il reload. Test: `tests/app-update.test.js`, `tests/app-update-attesa.test.js`, `tests/app-update-form-sporco.test.js`, `tests/e2e/sim/app-update.spec.js`, `tests/versioned-imports-consistency.test.js` (coerenza `?v=` degli import).
- **Strategie del service worker (#249, #257):** funzioni pure in `sw-strategy.js` (`self.GFVSwStrategy`, caricato con `importScripts('sw-strategy.js?v=<build>')`; test `tests/sw-strategy.test.js`). `classificaRichiesta`: `html` (navigazioni o `Accept: text/html`) e `rete` (JS/CSS/JSON senza `?v=`) = rete prima, dopo `TIMEOUT_RETE_MS` 3 s la copia in cache se c’è, altrimenti si continua ad aspettare la rete; `versionato` (`?v=` o hash nel nome) e `statico` (immagini, font, icone) = cache prima nella cache della build corrente (`cachePrima`); `.md` = `ignora` (le guide non passano dal SW); esclusi anche non-GET, altri origin, host Firebase/Google e localhost senza `?swTest=1`. In `activate` si tengono la cache corrente e la più recente delle precedenti (`cacheDaEliminare` = `cachePrecedenti(...).slice(1)`), usata come riserva se la rete fallisce; le cache di altre app sullo stesso origin non si toccano. Senza copia in cache una richiesta di rete si annulla dopo `ABORT_RETE_MS` 8 s, **ma non le navigazioni** (#257, `daRete(request, modo, senzaAnnullo)` con `request.mode === 'navigate'`): prima l’annullo dava la pagina di errore del browser; test `tests/sw-navigazione-senza-annullo.test.js`. Nessun effetto da descrivere in guida utente (pagine solo più rapide).
- **Dashboard manager, letture (#253):** `core/js/dashboard-avvio-letture.js` (`leggiUtenteETenantAvvio`: `users/{uid}` e il tenant già scelto in `sessionStorage` letti in parallelo; `leggiTenantDocAvvio` riusa la lettura se il tenant risolto è lo stesso), `core/js/dashboard-letture-condivise.js` (terreni e macchine letti una volta e condivisi), `dashboard-counts-snapshot.js` / `dashboard-deadlines.js` (niente query ore sui lavori non assegnati), `tenant-service.js` (elenco aziende per «cambia azienda» dal documento utente già letto, senza lettura dei nomi con una sola azienda). Test `tests/dashboard-manager-letture.test.js`. Nessun cambio visibile oltre ai tempi.
- **Dashboard, card meteo (#257):** `core/styles/dashboard.css` `align-content: start` sulla griglia accanto al meteo: con molti avvisi meteo lo spazio in più resta sotto le card, non dentro (test `tests/dashboard-meteo-side-css.test.js`).

## Email transazionali

Callable / helper `functions/email-resend.js` (Resend, mittente piattaforma): usate per **inviti** e **preventivi** (e flussi correlati), non per le push. Dettaglio UX in guide Manodopera (inviti) e Conto terzi (invio preventivo).

## Pelle Proposta (solo sotto al cofano — non in guida utente)

Implementazione UI ufficio su **main**: flag `uiPelleProposta` (`feature-flags.js`, `enabledAlways: true`); `core/js/ui-pelle.js`, `ui-pelle-state.js`, `ui-pelle-icons.js`, CSS `ui-pelle-proposta.css`. Spenta su campo (`field-workspace`), login, e `data-gfv-pelle-host="0"`. Dal #202 spenta anche sulle pagine ufficio aperte da operaio/caposquadra (es. Impostazioni account): `nascondiShellPerProfiloCampo` in `ui-pelle-state.js` (ultimo ingresso `workspace` → niente barra; `dashboard` → barra, anche per un manager che è anche caposquadra; senza ingresso decidono i ruoli in sessione) e lo script inline in testa alle pagine non mette `data-pelle="proposta"` se `gfv_ingresso_ultimo` è `workspace`. **Non** spiegare all’utente skin/tema: i flussi prodotto restano gli stessi. Su develop il codice può mancare.

## Auth / sessione

| Pagina | Path |
|--------|------|
| Login | `core/auth/login-standalone.html` (`sendPasswordResetEmail` → reset) |
| Reset password | `core/auth/reset-password-standalone.html` |
| Registrazione nuova azienda | `core/auth/registrazione-standalone.html` |
| Registrazione da invito | `core/auth/registrazione-invito-standalone.html` + CF `getInvitoPubblico` |

Multi-azienda: selezione tenant in sessione (cambia azienda). Non spiegare all’utente Firebase Auth oltre «email/password / link invito / reset».

## Nome e cognome del titolare (8899ca5)

**Effetti visibili già a flag spento:**
- Impostazioni → Account (`admin/impostazioni-standalone.html`): `#account-nome` / `#account-cognome` **non** più `required` (etichette «Nome» / «Cognome» senza asterisco). Hint `#account-nome-suggerimento` «Aggiungi nome e cognome: compariranno nei registri e negli elenchi.» visibile solo se entrambi vuoti (`aggiornaSuggerimentoNomeAccount`, aggiornato su `input`). `handleSaveAccount` salva i valori con trim (anche vuoti) e allinea `displayName` di Firebase Auth con `updateProfile(user, { displayName: displayNameDaNomeCognome(nome, cognome) })` (stringa vuota se entrambi vuoti).
- Dashboard: `#user-info` e `Tony.setContext('dashboard').utente_corrente.nome` usano `getNomeVisualizzato` (`core/js/nome-visualizzato.js`): nome+cognome → nome azienda (`tenants.nome`) → parte email prima di `@` → `''`. Mai «undefined».
- Inviti: vedi sezione Inviti (`campiNomeDaInvitoSeVuoti`).

**Dietro flag spento (non in guida utente):** `NOME_TITOLARE_FACOLTATIVO_ATTIVO = false` in `core/config/nome-titolare-config.js`. Solo con flag `true` **e** `?da=landing` (`isDaLanding`, `isNomeCognomeFacoltativi` in `core/js/nome-titolare-helpers.js`) `auth/registrazione-standalone.html` toglie `required`, etichette «Nome (facoltativo)» / «Cognome (facoltativo)», salta la validazione e scrive su `users` solo i campi compilati (`buildCampiNomeCognomeSeCompilati`). La landing (`landing/src/config/landing-config.js`) punta già a `URL_REGISTRAZIONE` con `?da=landing`; a flag spento la registrazione chiede nome e cognome come prima. Helper URL: `urlRegistrazioneConDaLanding`, `preservaDaLandingSuUrl`. Test: `tests/nome-titolare-passo4.test.js`, `tests/nome-visualizzato.test.js`.

## Accettazione documenti legali (preparata, flag spento — non in guida utente)

#190/#192/#194: caselle di accettazione in registrazione e presa visione nell’invito, ri-accettazione al primo ingresso. **Flag spento:** `ACCETTAZIONE_LEGALE_ATTIVA = false` in `core/config/accettazione-legale-config.js` (`DOCUMENTI_LEGALI` con URL/versioni vuote, da compilare prima di accendere). Regole pure `core/services/accettazione-legale.js`; gate `core/js/accettazione-legale-gate.js` (importato solo con flag acceso; spento non chiama la rete e non disegna nulla); callable `registraAccettazioniLegali` in `functions/accettazione-legale.js` + `functions/lib/accettazione-legale-core.js` (collection `accettazioniLegali`, solo Admin SDK). Oggi registrazione e invito restano come prima: **non** descrivere all’utente caselle o documenti legali.

**#281 (sempre dietro flag spento):**
- Registrazione (`auth/registrazione-standalone.html`) e invito (`auth/registrazione-invito-standalone.html`): l’accettazione si registra **dopo** che account e membership esistono, via `registraAccettazioneDopoAccount` (`core/js/accettazione-legale-registrazione.js`, esiti `saltata` / `registrata` / `rimandata`, non lancia mai). Se fallisce solo la callable **niente rollback** (niente `deleteUser`): messaggio `messaggioFineRegistrazione` «✅ Account creato. Conferma le condizioni al primo accesso. Reindirizzamento alla dashboard...» e il gate la richiede al primo ingresso. A flag spento la callable non è mai chiamata.
- Gate (`core/js/accettazione-legale-gate.js`, usato da `dashboard-standalone.html` e `mobile/field-workspace-standalone.html`): con flag acceso **mai fail-open**. Se lo stato non si legge: overlay bloccante `#accettazione-legale-gate-errore` «Non riesco a verificare le condizioni di uso. Controlla la connessione e riprova.» con **Riprova** (rilegge) ed **Esci** (logout → login-standalone); se i moduli del gate non si caricano, overlay con solo **Riprova** (reload). Il controller del campo parte solo dopo il gate. Tenant e ruoli: `risolviTenantERuoli` (contesto pagina → tenant corrente con membership → campi legacy).
- **Accettazioni per azienda:** `azione: 'stato'` richiede `tenantId` (altrimenti `invalid-argument` «Azienda mancante.») e verifica la membership («Non appartieni a questa azienda.»); id riga `uid_tenantId_tipo_versione` (chi entra in una seconda azienda accetta di nuovo; stessa azienda/documento/versione non si sovrascrive). Test `tests/accettazione-legale-gate.test.js`, `tests/accettazione-legale-registrazione.test.js`, `tests/accettazione-legale-functions.test.js`.

