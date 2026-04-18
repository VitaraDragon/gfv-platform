# 📋 Cosa Abbiamo Fatto - Riepilogo Core

**Ultimo aggiornamento documentazione (verifica codice/doc): 2026-04-18.**

## ✅ Tony / Gemini: retry 429 e messaggio utente (2026-04-18)

- `functions/index.js` **`callGeminiWithRetry`**: fino a **6** tentativi; su **429** attesa più lunga (header `Retry-After` se presente, altrimenti backoff 2s→4s→…); errore finale **`HttpsError` `resource-exhausted`** con testo in italiano invece di generico `internal`.
- `core/js/tony/main.js`: **`tonyFormatCallableError`** in chat per `resource-exhausted` / 429 (invito a riprovare dopo 30–60 s). **Deploy `functions`** necessario per la parte Cloud.

## ✅ Manodopera: piano design sostituzioni / equipaggio in repo (2026-04-18)

- Aggiunto **`docs-sviluppo/tony/PIANO_SOSTITUZIONE_MANODOPERA_SQUADRE.md`**: design per shortlist sostituti, disponibilità automatica da lavori, competenze in anagrafica, policy tenant, integrazione Tony; riferimento in **`docs-sviluppo/tony/README.md`** e in **`.cursor/rules/tony-agent-onboarding.mdc`** (dopo i tre punti di lettura iniziale), così ogni nuovo agente vede il file da leggere prima di implementare su manodopera/squadre.

## ✅ PWA: bump cache a ogni commit (hook Git) (2026-04-18)

- `scripts/bump-pwa-cache-version.mjs` aggiorna **`SW_CACHE_BUILD_ID`** (`t` + timestamp ms) in `service-worker.js`; `CACHE_NAME = 'gfv-platform-' + SW_CACHE_BUILD_ID`.
- **`.githooks/pre-commit`**: esegue lo script e `git add service-worker.js`. Attivazione una tantum: **`npm run setup:hooks`** (`git config core.hooksPath .githooks`). Manuale: **`npm run bump:pwa-cache`**; saltare hook: `git commit --no-verify`.
- Dettaglio: **`docs-sviluppo/GUIDA_PWA.md`**, **`.githooks/README.md`**.

## ✅ Tony profilo campo: server (`tonyAsk`) — niente leak tariffe/terreni/clienti (2026-04-17)

- `functions/index.js`: se i ruoli non arrivano dal client, **fallback ruoli da Firestore** `users/{uid}`; **`buildContextAzienda` non viene chiamato** per operaio/caposquadra (già così); **`sanitizeContextForTonyField`** riduce il JSON inviato a Gemini (no tabellari completi; solo `lavori` sintetici se `pageType` lavori).
- Risposta **deterministica** (senza Gemini) per domande classificate come dati aziendali (`isTonyFieldBizDataQuestion`: tariffe, elenco terreni/campi, clienti/preventivi/magazzino in elenco).
- **Treasure Map / structured** disattivata se `tonyFieldProfile` (`useStructuredFormOutput` richiede `!tonyFieldProfile`).
- `SYSTEM_INSTRUCTION_TONY_FIELD` rafforzata (vietato elencare cataloghi anche se compaiono nel contesto).

## ✅ Profilo campo: blocco navigazione senza alert nativo (2026-04-17)

- `core/js/tony/main.js`: se APRI_PAGINA / OPEN_MODAL è bloccato per profilo campo, messaggio in chat (`showMessageInChat`) + TTS breve tramite `tonyNotifyFieldProfileBlocked`, al posto di `window.alert`.
- Stesso file: niente doppio messaggio (onComplete non richiama `triggerAction` per APRI_PAGINA se la CF ha già restituito `command`); niente terza bolla con testo modello tipo «ti porto al magazzino» (`suppressAssistantTextFieldGuard` + `finalSpeech` vuoto).

## ✅ Profilo campo: `initContextWithModules` con ruoli + guard APRI_PAGINA (2026-04-17)

- **Problema:** su pagine manodopera (es. lavori caposquadra) Tony inizializzava solo `moduli_attivi` senza `utente_corrente.ruoli` → `getTonyFieldProfileFromContext()` era sempre `null` → nessun blocco client su `APRI_PAGINA` (es. terreni) e la Cloud Function non applicava `SYSTEM_INSTRUCTION_TONY_FIELD`.
- `core/services/tony-service.js`: `initContextWithModules(modules, { tenantId, utente_corrente, maxRetries })` (secondo argomento numerico = solo retry, retrocompatibile); salvataggio opzionale di `gfv_tony_utente_ruoli` in sessionStorage.
- `core/js/tony/field-role-guard.js`: se mancano i ruoli nel context Tony, fallback lettura `sessionStorage` (dopo dashboard o init con ruoli).
- `core/js/tony/main.js`: `setTonyContext` persiste `gfv_tony_utente_ruoli` quando arriva `utente_corrente.ruoli`.
- Pagine aggiornate: `lavori-caposquadra-standalone.html`, `segnatura-ore-standalone.html`, `validazione-ore-standalone.html`, `impostazioni-standalone.html` (anche ramo non-manager) — passano `tenantId` e `utente_corrente` a Tony.

## ✅ Workspace campo: Tony widget + contesto ruoli (2026-04-17)

- `core/mobile/field-workspace-standalone.html`: caricamento `tony-widget-standalone.js` + CSS (stesso pattern della dashboard, base `../` fuori da GitHub Pages).
- `core/mobile/js/field-workspace-controller.js`: dopo login e `refreshWorkspaceData`, `setTonyContext` / `Tony.setContext('dashboard', …)` con `tenantId`, `moduli_attivi`, `utente_corrente.ruoli` e nome; retry a intervalli se il widget non è ancora inizializzato; `syncTonyModules(availableModules)` come sulle altre standalone. Così `tonyAsk` riceve il profilo campo anche senza passare dalla dashboard.

## ✅ Impostazioni: rimosse comunicazioni squadra per caposquadra (2026-04-17)

- `core/admin/impostazioni-standalone.html`: eliminate la card «Comunicazioni Squadra» / «Comunicazioni inviate» e il relativo JavaScript. Le comunicazioni restano solo nel workspace mobile dedicato (slide previste dal flusso caposquadra), coerente con il confine «schermate consentite per ruolo»; la pagina Impostazioni resta per account, password e (per i manager) sezioni azienda.

## ✅ Statistiche campo manodopera: solo «le tue» ore (2026-04-16)

- Nuova pagina `core/mobile/statistiche-lavoratore-standalone.html`: grafici basati esclusivamente su `oreOperai` con `operaioId ===` utente corrente (nessuna aggregazione tra operai), escluso stato `rifiutate`; tipi lavoro da anagrafica incarichi. Stessi gate del workspace mobile (ruolo campo + modulo `manodopera`). La slide Statistiche del workspace punta a questa pagina invece della dashboard/diario `statistiche-standalone.html?embed=field`.
- Stessa pagina: metriche e grafico «ore su incarichi con trattore/attrezzo» incrociando incarichi **assegnati all’utente** (come in gestione lavori) con `macchinaId` / `attrezzoId` sul documento lavoro; nomi mezzi da `tenants/.../macchine`. Se sul lavoro c’è sia trattore sia attrezzo, le ore sono attribuite al trattore per il grafico per mezzo.

## ✅ Workspace mobile: rimossa slide «Lavoro selezionato» (2026-04-16)

- Eliminata la schermata duplicata tra «Segna ore» e «Statistiche»; dopo le ore lo swipe porta direttamente alle statistiche.
- Il link «Apri in finestra intera» (lavori caposquadra) è spostato sotto l’iframe nella slide «Segna ore».
- Ordine slide caposquadra aggiornato: Lavoro → Comunicazioni → Ore → Statistiche; `openSlide=dettaglio-lavoro` / `lavoro-selezionato` in URL continua a mappare sulla slide Ore (compatibilità).

## ✅ Mappa mobile: ritorno su dettaglio lavoro + salvataggio robusto (2026-04-16)

- In uscita da `mapOnly` il rientro salva e ripristina `focusLavoroId` + `openSlide=segna-ore` (slide «Segna ore» con iframe dettaglio/traccia), così dopo `Annulla` o salvataggio si torna alla schermata ore invece della prima slide o del solo dettaglio card.
- In mappa full-screen aggiunto pulsante `🔒 Chiudi segmento` per chiudere manualmente la traccia senza dover centrare il primo punto.
- `Salva Zona` ora usa anche un handler click esplicito (`handleSalvaZonaClick`) con log `[GFV-MAP-TRACE]` su click/start/addDoc/success/error per diagnosticare subito eventuali blocchi.

## ✅ Mappa `mapOnly`: ritorno al workspace mobile e fix schermata bloccata (2026-04-16)

- Chiusura modale tracciamento in modalità `mapOnly=1`: redirect a `field-workspace-standalone.html` (URL salvato dal parent iframe prima del salto su `window.top`, altrimenti fallback `../mobile/...?ws=mobile` + `focusLavoroId` se presente), così lo swipe del wizard torna disponibile invece di restare sulla pagina lavori top-level.
- Rimosso guard `sessionStorage` sull’auto-apertura traccia: in combinazione con `map-only` poteva saltare l’apertura del modal lasciando pagina vuota fino a “clear site data”.
- Log diagnostici prefisso `[GFV-MAP-TRACE]` su apertura fullscreen, auto-open e chiusura `mapOnly`.

## ✅ Workspace mobile caposquadra: conferme 1/N e dettaglio lavoro compatto embed (2026-04-16)

- `Comunicazioni inviate` ora mostra conferme in formato desktop `👍 conferme/destinatari` (es. `1/4`) invece del solo numero assoluto.
- In invio comunicazione da mobile viene salvato anche `destinatari` (lista operai assegnati al lavoro) per rendere stabile il calcolo `conferme/target`.
- Iframe dettaglio lavoro sotto `Segna ore` passa in modalità compatta (`embed=mobile`) con header/badge di focus nascosti e layout info ordini manager più denso (2 colonne), così si recupera spazio verticale.

## ✅ Workspace mobile caposquadra: pull-to-refresh, lista squadra compatta, mappa full-screen (2026-04-16)

- Prima schermata senza pulsanti `Aggiorna elenco`/`Elenco completo`; aggiornamento dati con gesto pull-to-refresh (swipe dall'alto verso il basso) sulla prima slide.
- Lista operai squadra resa più compatta con griglia multi-colonna per ridurre lo spazio verticale occupato.
- Nel dettaglio lavori in embed mobile nascosti i link di rientro dashboard e apertura `Traccia Segmento Lavorato` in modal full-screen, con indicazioni mappa sempre visibili.

## ✅ Workspace mobile caposquadra: fix 2-colonne squadra e mappa truly full-screen (2026-04-16)

- Griglia operai prima schermata forzata a 2 colonne (rimosso fallback automatico 1-colonna sotto 420px) per massimizzare il risparmio verticale.
- Modal `Traccia Segmento Lavorato` in embed mobile portata a modalità `map-fullscreen`: viene mostrata solo la mappa a schermo intero con header/chiusura e controlli in overlay.
- Azioni `Salva Zona` / `Annulla` spostate in overlay inferiore sulla mappa per utilizzo comodo su smartphone.

## ✅ Traccia segmento da iframe: apertura top-level full-screen (2026-04-16)

- Risolto il limite tecnico dell'iframe: in modalità mobile embed il bottone `Traccia Segmento Lavorato` ora porta la pagina lavori in `window.top` con query `traceLavoroId`.
- All'arrivo su pagina top-level, la modale di tracciamento viene aperta automaticamente in full-screen reale e il parametro `traceLavoroId` viene rimosso dall'URL con `history.replaceState`.
- Aggiunto fail-safe anti-loop su `traceLavoroId` con guard in `sessionStorage` e pulizia URL in chiusura modale, per evitare blocchi dopo refresh o aperture ripetute.
- Fix definitivo loop: `traceLavoroId` non viene più riutilizzato dopo il primo auto-avvio (`pendingTraceLavoroId` azzerato) e resta azzerato anche su `Annulla`.
- Introdotta modalità dedicata `mapOnly=1`: la tracciatura full-screen viene avviata solo in questa modalità, con uscita pulita su `Annulla` verso URL senza `traceLavoroId`/`mapOnly`.

## ✅ Workspace mobile campo (caposquadra): UI, dettaglio lavoro, squadra, statistiche embed (2026-04-15)

- Allineati header e schede swipe a palette GFV (verde, card coerenti con resto app) in `core/mobile/css/field-workspace.css` e `core/mobile/field-workspace-standalone.html`.
- Dettaglio lavoro: `lavori-caposquadra-standalone.html` supporta `focusLavoroId` in query (solo incarico selezionato + banner “mostra tutti”); iframe nella slide «Segna ore» punta a quell’URL; link “Apri in finestra intera”.
- Squadra: rimossa dipendenza da iframe `gestione-squadre`; elenco operai da Firestore (`squadre` + `users`), righe cliccabili e modal contatti (tel / mailto).
- Statistiche in iframe: `statistiche-standalone.html?embed=field` con CSS compatto e `resize` Chart.js post-carico; contenitore slide più alto per leggibilità grafici.

## ✅ Workspace mobile caposquadra: squadra+valida ore inline e comunicazioni inviate (2026-04-16)

- Prima schermata aggiornata con blocchi inline `La mia squadra` e `Valida ore` sotto la selezione lavoro, mantenendo il flusso swipe richiesto (senza slide squadra separata).
- Aggiunta validazione rapida ore (`da_validare`) direttamente da mobile workspace con azioni `Approva` / `Rifiuta` e update stato su `oreOperai`.
- Slide comunicazioni estesa con sezione `Comunicazioni inviate` (ultimi invii del caposquadra) per feedback immediato.
- Reintrodotte icone stile desktop (emoji operative nei titoli/CTA principali) su squadra, comunicazioni, ore, lavori e statistiche.

## ✅ Workspace mobile caposquadra: header compatto a icone + dettaglio lavoro sotto segna ore (2026-04-16)

- Header ridotto in altezza con sola toolbar icone (`mobile`, `desktop`, `opzioni`) e menu impostazioni account su icona ingranaggio.
- Stato versione attiva reso visibile graficamente (tasto mobile/desktop in stato `active`).
- Slide `Segna ore` estesa con blocco `Dettaglio lavoro operativo` (iframe focus lavoro) per avere subito ordini manager/tracciamento/sospensione nella stessa schermata.
- Sezione `Comunicazioni inviate` aggiornata con contatore conferme di ricezione (`conferme.length`) per ogni invio.

## ✅ Guida app - riscrittura completa struttura modulare (2026-04-14)

- Riscritta la guida utente in `docs-sviluppo/guida-app/` per allinearla alle evoluzioni recenti dell'app: `README.md`, `core.md`, `intersezioni-moduli.md`, `moduli/terreni.md`, `moduli/lavori-attivita.md`, `moduli/vigneto.md`, `moduli/frutteto.md`, `moduli/magazzino.md`, `moduli/conto-terzi.md`.
- Nuova impostazione centrata su: piani e moduli attivi, ruolo utente, differenza Tony Guida/Tony Avanzato, connessioni cross-modulo e flussi end-to-end.
- Mantenuto il pulsante `Guide` come canale documentale primario anche in ottica freemium (assenza Tony), con guida orientata a consultazione pratica.
- Rifinito il tono editoriale in chiave dettagliata ma amichevole, con sezioni operative "flusso consigliato" per modulo e linguaggio piu user friendly.
- Aggiunte sezioni pratiche "Se devi fare X, vai qui" e esempi rapidi per ruolo per rendere la guida ancora piu consultabile dagli utenti finali.
- Uniformata la struttura finale di tutti i file guida (Core, Intersezioni e moduli) con pattern coerente per consultazione rapida da utenti e operatori.
- Sincronizzata anche la copia runtime `core/guida-app/` con la versione user-friendly, rimuovendo riferimenti tecnici non utili all'utente finale (API/librerie/configurazioni).
- Ripristinato il pulsante `Guide` della dashboard verso la guida HTML user-facing (`documentazione-utente/index.html`) per evitare apertura del markdown grezzo non adatto all'utente finale.
- Cambio temporaneo: pulsante `Guide` riportato a `core/guida-app/README.md` per revisione contenuti della nuova guida; `documentazione-utente/` mantenuta come riferimento impaginazione da riallineare.
- `documentazione-utente/index.html` riallineata: mantiene l'impaginazione HTML user-friendly ma carica i contenuti aggiornati da `core/guida-app/*.md` (Core, moduli, intersezioni). Pulsante `Guide` riportato al percorso HTML user-facing.
- Revisione contenuti guida in chiave utente finale: aggiunti dettagli operativi su attivazione moduli/abbonamento, inviti e gestione ruoli operativi, sezioni "se fai questo, cosa succede", esempi pratici per flusso. Rimossi termini tecnici (ID/API/path interni).
- Ulteriore pulizia lessicale nella guida utente runtime: sostituiti ultimi termini tecnici residui con linguaggio operativo comprensibile (es. "tenant" -> "azienda selezionata").
- Estensione copertura guida user-facing: aggiunte sezioni complete su Amministrazione, Parco Macchine e Guasti, Statistiche e Report; ampliati i flussi tra ruoli (operaio -> caposquadra -> manager), scadenze/sotto-scorta e passaggi operativi con esempi pratici.
- Pulizia ulteriore guida utente: rimossi blocchi di manutenzione interna ("come aggiornare la guida") dalle pagine visibili agli utenti finali.
- Pulizia lessicale finale cross-modulo: sostituiti riferimenti a nomi file tecnici (es. `intersezioni-moduli.md`) con riferimenti leggibili per utenti finali (es. "Sezione Intersezioni tra moduli"), sia in `core/guida-app` sia nelle sorgenti `docs-sviluppo/guida-app`.

## ✅ Tony Guida - piano operativo aggiornamento completo documentazione (2026-04-14)

- Definito e documentato in `docs-sviluppo/tony/STATO_ATTUALE.md` (sezione 10) il piano strutturato per riallineare guida utente e conoscenza Tony dopo mesi di evoluzioni app.
- Scelta architetturale formalizzata: audit parallelo per modulo (subagent), consolidamento editoriale unico, gate qualitativo finale con verifica mirata UI.
- Chiarite le fonti da mantenere allineate: guida modulare `docs-sviluppo/guida-app/*.md` e fallback runtime Tony `core/services/tony-guida-app.js` (`GUIDA_APP_PER_TONY`).
- Introdotte regole anti-omissione, output standard dei report modulo (`Nuovo/Modificato/Rimosso/Da verificare in UI`) e ordine consigliato di esecuzione per backlog ampio.

## ✅ Concimazioni vigneto / frutteto: prefisso log console Tony (2026-04-11)

- **Problema**: nel fallback `initTonyContext` la pagina **concimazioni vigneto** loggava `[Vigneto Trattamenti]` (ambiguo con trattamenti fitosanitari); il frutteto usava `[Frutteto Trattamenti]`.
- **Intervento**: `modules/vigneto/views/concimazioni-standalone.html` → `[Concimazioni vigneto]`; `modules/frutteto/views/concimazioni-standalone.html` → `[Concimazioni frutteto]`.

## 📌 Modulo Report — progettazione (2026-04-11)

- **Documento di dettaglio evolutivo** (brainstorming + spec): `docs-sviluppo/MODULO_REPORT_PROGETTAZIONE.md` — dashboard a card per modulo, Terreni sempre prima nel modulo report, ordine card = attivazione moduli, Sintesi/Economici, stesso motore UI/Tony, gating `report` + moduli dominio; riferimenti codice `modules/report/`. Aggiornare quel file man mano che si definiscono KPI e implementazione.

## ✅ Modulo Report — attivazione da Abbonamento (2026-04-11)

- **`core/config/subscription-plans.js`**: modulo `report` impostato **`available: true`** (prima “Prossimamente”); descrizione aggiornata alla dashboard per area.
- **`core/admin/abbonamento-standalone.html`**: pulsante **“Apri Report”** sui moduli singoli attivi `report`; nei **bundle** che includono `report`, pulsante **“Apri modulo Report”** verso `report-dashboard-standalone.html`.

## ✅ Modulo Report — prima implementazione UI (2026-04-11)

- **Ingresso**: Dashboard principale → `modules/report/views/report-dashboard-standalone.html` (modulo `report` + ruoli Manager/Amministratore).
- **Dashboard modulo**: card **Terreni** (sempre), **Vigneto** → `report-standalone.html` se modulo attivo, altre aree placeholder “In sviluppo”, **Sintesi** / **Economici** placeholder.
- **Report Terreni**: `report-terreni-standalone.html` — selettore annata agraria (11 nov–10 nov) / anno solare / intervallo; card per terreno aziendale (dati da Firestore); testo su integrazione concimi/trattamenti/ore in arrivo.
- **File**: `modules/report/js/report-access.js`, `report-time-range.js`; **Tony** `engine.js` target `report`, `report terreni`, `report vigneto`; `tony-routes.json` aggiornato; link da `dashboard-sections.js` e header `report-standalone.html`.

## ✅ Modulo Report — Terreni: aggregati reali (2026-04-11)

- **`modules/report/services/report-terreni-service.js`**: per ogni terreno aziendale, collega vigneti/frutteti (`terrenoId`), somma nel periodo **trattamenti** (concimi = `tipoTrattamento === 'fertilizzante'`, altrimenti fitosanitari; kg da `prodotti[].quantita`), **vendemmie** (`quantitaQli`) per vigneto, **ore** da `attivita` (`oreNette`, filtro `data`). Alert: affitto in scadenza (≤120 gg), assenza colture collegate.
- **`report-terreni-standalone.html`**: card con numeri; periodo personalizzato con inizio/fine giornata; ricarica al cambio periodo.
- **Correzione (2026-04-11)**: query **attività** su `data` come **stringhe ISO** (`YYYY-MM-DD`, come nel modello `Attivita`), non Timestamp — altrimenti ore sempre 0; esclusi record con `clienteId` (conto terzi). **Kg trattamenti**: se `quantita` assente, stima come in UI (`dosaggio × superficieTrattata`). Superficie terreno in card con **2 decimali**.

## ✅ Tony — trattamento: «ok entrambi» senza flag + inject attivita-form (2026-04-11)

- **Problema**: conferma flag dopo un messaggio Tony senza «Vuoi che…» non passava `lastAssistantAskedTrattamentoSensitiveFlags`; `formData` solo checkbox non matchava `isTrattamentoCampoData` → **formId attivita-form** e inject bloccato con modal trattamento aperto.
- **Intervento**: `functions/index.js` — `lastTonyMentionedTrattamentoAnagrafeAndScarico` + `treatAsFlagConfirmTurn`; routing `form-trattamento` se **qualsiasi** chiave `trattamento-*`; `resolveTrattamentoFlagsFromFollowUp`: `entrambi`; replyText che prometteva flag senza payload → domanda esplicita; `tony-service.js` stesso routing da blocco \`\`\`json. `main.js` — ignora `INJECT attivita-form` se `modal-trattamento` attivo. Deploy functions.

## ✅ Tony — trattamento: troppi messaggi / troppo veloce (2026-04-11)

- **Problema**: dopo l’inject sul modal concimazioni/trattamenti, il timer proattivo «Form completo, confermi salvataggio?» (~2,8s + 7s) mandava un **secondo** messaggio alla CF mentre l’utente doveva ancora rispondere alla domanda su anagrafe/scarico → risposte duplicate, inject ripetuti, a volte `INJECT` su **attivita-form**.
- **Intervento**: `core/js/tony/main.js` — **disattivato** il post-inject proattivo solo per `form-trattamento` (il testo della CF già invita a «ok salva»). `functions/index.js` — sanitizzazione testo: «Confermo il salvataggio» anche senza «del trattamento»; deduplica del paragrafo hint ripetuto. Deploy functions per la parte testo.

## ✅ Tony — trattamento: SAVE_ACTIVITY bloccato «Pulsante Salva non disponibile» (2026-04-11)

- **Problema**: con `modal-trattamento` aperto, `SmartFormFiller.validateBeforeSave` usava un selettore con **`.btn-primary`**: il primo match era **«Traccia»** (prima del vero **Salva** `type="submit"`); se quel pulsante non passava `_isVisible`, `submitAvailable` era false.
- **Intervento**: `core/js/tony-smart-filler.js` — `_resolveSubmitControl`: prima `button[type="submit"]` nel form, poi selettore schema o `.btn-primary`; `core/js/tony/main.js` — con `modal-trattamento` attivo, validazione solo `tonyCheckFormCompletenessSafe` e click su `#form-trattamento button[type="submit"]`. Solo asset JS (niente deploy functions).

## ✅ Tony — trattamento: «ok salva» non emetteva SAVE_ACTIVITY (2026-04-11)

- **Problema**: dopo la domanda su anagrafe/scarico, messaggi come **«ok salva»** facevano match su `\bok\b` in `resolveTrattamentoFlagsFromFollowUp` → `trattamentoUserConfirmsFlagsFromPreviousTonyQuestion` true → la CF **annullava** `SAVE_ACTIVITY` pensando fosse solo conferma flag.
- **Intervento**: `functions/index.js` — all’inizio di `resolveTrattamentoFlagsFromFollowUp`, intento esplicito di salvataggio (`ok salva`, `sì salva`, `salva`, `conferma salvataggio`, …) → `{ anagrafe: null, scarico: null }`; prompt trattamento: riga su `action: "save"` quando `requiredEmpty` è vuoto. **Deploy** `firebase deploy --only functions`.

## ✅ Tony — trattamento: testo «salvato» senza salvataggio reale (2026-04-11)

- **Problema**: dopo conferma flag (anagrafe/scarico), `replyText` diceva «Confermo il salvataggio del trattamento» pur essendo solo **INJECT** (nessun submit).
- **Intervento**: `functions/index.js` — `sanitizeTrattamentoCampoReplyText` su ogni `INJECT_FORM_DATA` `form-trattamento`; prompt Treasure Map; blocco `action: save` se il messaggio è solo conferma flag dopo la domanda Tony; retry Treasure Map allineato (formId trattamento + sanitize). Deploy functions.

## ✅ Tony — trattamento: conferma anagrafe/scarico + proattività salvataggio (2026-04-11)

- **Problema**: con solo dosaggio/prodotto, il modello (o enrich) impostava **anagrafe** e **scarico magazzino** senza chiedere; il modal trattamento non aveva il **timer proattivo** post-inject come magazzino/preventivo.
- **Intervento**: `functions/index.js` — `sanitizeTrattamentoCampoSensitiveFlags` (sostituisce l’enrich automatico su frasi); prompt `SYSTEM_INSTRUCTION_TRATTAMENTO_CAMPO_STRUCTURED` + regola **5e**: chiedere conferma prima delle checkbox sensibili; accettare i flag solo su richiesta esplicita («registra lo scarico», «usa superficie da anagrafe») o risposta al turno precedente che chiedeva conferma. `core/js/tony/main.js` — dopo inject `form-trattamento`, stesso schema **POST_INJECT_CHECK_DELAY_MS** + **IDLE_REMINDER_MS** → «Form completo, confermi salvataggio?». Deploy functions.

## ✅ Tony — trattamento: checkbox «superficie da anagrafe terreni» (2026-04-11)

- **Problema**: frasi tipo «abbiamo trattato tutta la superficie» non allineavano gli ha da anagrafe; il client non riallineava dopo l’injection.
- **Intervento**: `tony-form-injector.js` — dopo inject, `syncSuperficieAnagrafeAfterTonyInject` (vigneto + frutteto); la parte «quando impostare il flag» è ora governata da **sanitize + conferma** (voce sopra), non più da enrich automatico su frasi.

## ✅ Tony — form trattamento/concimazione: checkbox non si spuntavano (2026-04-11)

- **Causa**: merge `INJECT_FORM_DATA` con `form.fields` del contesto copiava le checkbox dal DOM (`false`) anche quando la Cloud Function non le inviava, reiniettando sempre false.
- **Fix**: `core/js/tony/main.js` — per `trattamento-superficie-anagrafe`, `trattamento-prosegue-precedente`, `trattamento-registra-scarico-magazzino` non si mergea dal DOM se la chiave non è nel comando; prompt CF rafforzato su boolean JSON. Nessun deploy functions obbligatorio (solo asset JS).

## ✅ Tony — concimazioni/trattamenti campo: dose per ettaro vs totale (2026-04-11)

- **Problema**: «2 qli per ettaro» veniva interpretato come quantità totale sul campo → dosaggio = (2×100)/ha (es. 222 kg/ha su 0,90 ha) invece di **200 kg/ha**.
- **Intervento**: `functions/index.js` — prompt Treasure Map trattamento (`SYSTEM_INSTRUCTION_TRATTAMENTO_CAMPO_STRUCTURED` + regola 5e), esempi JSON corretti; `enrichTrattamentoCampoProdottiFromUserMessage` con **history**: distinzione dose/ha (testo «per ettaro» o ultima domanda Tony «dosaggio … per ettaro») vs totale; correzione se il modello emette ancora il dosaggio sbagliato. `core/config/tony-form-mapping.js` allineato. **Deploy** `firebase deploy --only functions` per attivare la CF.

## ✅ Tony TTS — unità parlate (ERP: quintali, litri, ettari, kg, mq…) (2026-04-11)

- **Problema**: in voce, sigle («q.li», «L», «ha»…) suonano male; i riepiloghi movimenti usavano il codice unità dal prodotto.
- **Intervento**: `core/js/tony/voice.js` — `expandSpokenUnitsForItalianTTS` in `pulisciTestoPerVoce` (**copre tutte le risposte Tony lette in TTS**, qualunque pagina): q.li/ql → quintali; numero+L/l → litri; **numero + spazio + `ha` → ettari**; hl, kg, g, mq/m2/m², m3/mc, ml. `functions/index.js` — `formatUnitaMisuraPerVoce` allineato (movimenti + stesso lessico); prompt ADVANCED (VOCE E LETTURA); vendemmia summary aggregati in «quintali». **Non** è uno sweep di ogni cella HTML: le tabelle restano come sono; la voce normalizza il testo del messaggio Tony. Deploy functions se si aggiornano i prompt.

## ✅ Tony — gestione vendemmia: currentTableData + CF (2026-04-11)

- **Problema**: sulla pagina vendemmia Tony rispondeva "non ho informazioni sui movimenti di vendemmia" perché la lista non entrava nel contesto pagina (solo moduli attivi su dashboard).
- **Intervento**: `vendemmia-standalone.html` — `window.currentTableData` (`pageType: vendemmia`), **vendemmiaAggregates** (totale q.li per varietà) + summary arricchito; merge `setContext('page')`, evento `table-data-ready`; `tony-service.js` — sanitizer dedicato vendemmia; `main.js` — `FILTER_TABLE` per vigneto/varieta/anno; `functions/index.js` — eccezione vendemmia, somma obbligatoria q.li su domande quantitative, FILTRO TABELLA VENDEMMIA. **Deploy** `firebase deploy --only functions` dopo ogni aggiornamento prompt.

## ✅ UI date: formato lungo italiano ovunque (2026-04-11)

- **Obiettivo**: stesso stile “10 aprile 2026” (e “sabato 10 aprile 2026” dove serviva il giorno) al posto di DD/MM/YYYY o `toLocaleDateString` corto, allineato a Tony/TTS.
- **Modulo**: `core/js/date-format-it.js` — aggiunti `dateLikeToLocalCalendarIso`, `formatDateLikeToItalianLongLocal`, `formatDateLikeToItalianLongWeekday`, `formatDateTimeItalianReadable`.
- **Aggiornati** (estratto): dashboard (`dashboard-data.js`, `dashboard-utils-extended.js`, `dashboard-standalone.html` guasti), terreni utils, gestione macchine/lavori/attività/maps, liste parco macchine (scadenze, guasti), magazzino (movimenti, tracciabilità), vigneto/frutteto (concimazioni, trattamenti, potatura, raccolta, dashboard frutteto), report, preventivi, conto terzi.
- **Completamento sweep**: `gestione-operai`, `statistiche-manodopera`, `lavori-caposquadra`, `abbonamento`, `vendemmia-standalone`, `vigneto-dashboard-standalone`, `calcolo-materiali-standalone` (anche PDF), `impostazioni` (lista comunicazioni con `formatDateLikeToItalianLongWeekday`), `gestisci-utenti`, `gestione-guasti`, `segnalazione-guasti`. Restano `toLocaleString('it-IT')` solo per **numeri** (kg, €, ore, unità), non per date.

## ✅ Tony — date leggibili ovunque (liste client + Context Builder) (2026-04-11)

- **Problema**: ISO `YYYY-MM-DD` in contesto pagina (attività, terreni affitto, lavori) e in `summaryScadenze` / elenco mezzi risultava poco adatto a voce/TTS.
- **Intervento**: modulo **`core/js/date-format-it.js`** (`formatIsoDateToItalianLong`, `dateLikeToIsoDateString`); **`attivita-controller.js`** e **`gestione-lavori-controller.js`** aggiungono `dataItaliana` / `dataInizioItaliana`; **`terreni-standalone`** e **`terreni-test-bootstrap`**: `scadenzaItaliana`; **`tony-service.js`**: sanitizzazione `attivita`, **`lavori`** dedicato, `terreni` preferisce `scadenzaItaliana`; **`functions/index.js`**: `formatScadenzaItaliana`, `buildSummaryScadenze` con testi umani per affitti e dettaglio mezzi (revisione/assicurazione). Deploy functions se si usa il riepilogo scadenze lato server.

## ✅ Tony — movimenti magazzino: date in italiano nel riepilogo server (2026-04-11)

- **Problema**: `summaryMovimentiRecenti` usava date ISO (`2026-04-10`) e quantità con artefatti float; in voce/TTS suona innaturale (“duezeroduesei…”).
- **Intervento**: `functions/index.js` — `formatDataItaliana` (es. "10 aprile 2026"), `formatQuantitaMovimento`; ogni voce in `movimentiRecenti` include **`dataItaliana`**; testo riassuntivo e istruzione ELENCO DATI: date leggibili in italiano in risposta. Deploy functions.

## ✅ Tony Context Builder — sotto scorta magazzino + campo prodotti Firestore (2026-04-11)

- **Problema**: dalla home magazzino (senza `currentTableData`) le domande su «sotto scorta» ricevevano «non ho dati». In `buildContextAzienda` i prodotti venivano letti con campo **`sogliaMinima`** mentre in Firestore/ERP il campo è **`scortaMinima`** → soglie e giacenze non arrivavano al modello.
- **Intervento**: `functions/index.js` — `getCollectionLight` prodotti con `scortaMinima`, `sogliaMinima`, `codice`, `attivo`; **`buildSummarySottoScorta`** → `azienda.summarySottoScorta` + `azienda.prodottiSottoScorta`; istruzioni Gemini e **reminder** su domande scorte; eccezione navigazione «già in home magazzino»; **prompt user** con reminder obbligatorio su scorte.
- **`magazzino-home-standalone.html`**: `Tony.setContext('page', { pagePath, pageTitle })` così la Cloud Function riconosce il path (home vs sottopagine).
- **Deploy**: `firebase deploy --only functions` (o almeno `tonyAsk`).

## ✅ Documentazione — allineamento verificato con il codice (2026-04-11)

- **`TONY_DECISIONI_E_REQUISITI.md` §8.3**: elenco `currentTableData` aggiornato rispetto a `tony/STATO_ATTUALE.md` (include Conto terzi, concimazioni vigneto/frutteto, tracciabilità consumi, ecc.).
- **`DOBBIAMO_ANCORA_FARE.md` §1.1**: corretto — le regole `inviti` in `firestore.rules` non sono più `allow create: if true` (già fix 2026-04-04; riallineamento testuale).
- **`docs-sviluppo/tony/README.md`**: data ultimo aggiornamento.
- **Codice verificato**: `buildContextAzienda` (`functions/index.js`) senza `summarySottoScorta` (solo `prodotti` con giacenza/soglia); nessun handler `MOSTRA_GRAFICO` in `core/js/tony/`; `main.js` con `console.log` non condizionati da `__TONY_DEBUG` (come da backlog snellimento).

## ✅ Gestione utenti — link inviti email: base URL allineato a dove l’app è ospitata (2026-04-10)

- **Situazione**: su `globalfarmview.net` per ora solo landing; ERP di test su **GitHub Pages**. I link nelle mail di invito devono puntare a GitHub finché l’app non è deployata sul dominio.
- **Intervento**: `core/admin/gestisci-utenti-standalone.html` — `APP_BASE_URL` esplicito `https://vitaradragon.github.io/gfv-platform` + commento per passare a `https://globalfarmview.net` quando l’ERP sarà su quel dominio.

## ✅ Login standalone — rimosso EmailJS inutilizzato (reset password resta Firebase Auth) (2026-04-10)

- **Contesto**: script EmailJS caricato ma mai usato; reset già tramite `sendPasswordResetEmail`.
- **Intervento**: `core/auth/login-standalone.html` — rimossi script EmailJS; commenti aggiornati (template reset da Firebase Console; eventuale parità mittente Resend solo con Callable + Admin SDK).

## ✅ Email transazionali — Resend da Cloud Function (inviti + preventivi), fine EmailJS su quelle pagine (2026-04-10)

- **Obiettivo**: invio professionale con mittente `Global Farm View <no-reply@globalfarmview.net>`; API key solo server-side.
- **Intervento**: `functions/email-resend.js` (HTML + escape, verifica manager/admin sul tenant); `functions/index.js` — callable **`sendTransactionalEmail`** (`type`: `invite` | `preventivo`), secret **`RESEND_API_KEY`**; `functions/.env.example`. Client: `getHttpsCallable('sendTransactionalEmail')` in `core/services/firebase-service.js`; `preventivi-standalone.html` e `gestisci-utenti-standalone.html` — rimosso EmailJS, chiamata alla callable. **Deploy**: `firebase functions:secrets:set RESEND_API_KEY` poi deploy functions; **ruotare** qualsiasi chiave mai esposta in chat/issue.

## ✅ Tony — form-trattamento: checkbox (scarico magazzino, anagrafe, prosegue precedente) (2026-04-09)

- **Problema**: l’injector impostava `el.value` su tutti gli `INPUT`; per le **checkbox** serve `checked` + eventi `change`, quindi non si spuntavano (funzionavano number/select/textarea). In mappa mancavano le chiavi `trattamento-superficie-anagrafe`, `trattamento-prosegue-precedente`, `trattamento-registra-scarico-magazzino`.
- **Intervento**: `core/js/tony-form-injector.js` — ramo checkbox in `setInputValue`; `core/config/tony-form-mapping.js` — campi + `injectionOrder`; `core/js/tony/main.js` — `buildTonyFormContext` usa `true`/`false` per valore checkbox; `functions/index.js` — regola **5e** e `SYSTEM_INSTRUCTION_TRATTAMENTO_CAMPO_STRUCTURED` con le tre chiavi booleane opzionali.

## ✅ Tony — concimazioni/trattamenti campo: stesso canone dei trattamenti (dosaggio kg/ha primario) (2026-04-09)

- **Scelta prodotto**: dato **primario** in righe prodotto = **dosaggio ad ettaro (kg/ha)**; quantità totale e costi = derivati nel form (come trattamenti). Se l’utente dice solo ql/kg totali, si **converte in dosaggio** e si inietta **dosaggio** (non più `quantitaTotaleKg` sulla riga come flusso principale).
- **Intervento**: `functions/index.js` — regola **5e** + `SYSTEM_INSTRUCTION_TRATTAMENTO_CAMPO_STRUCTURED`; **`enrichTrattamentoCampoProdottiFromUserMessage`** imposta **dosaggio** da messaggio + ha (contesto/form). `tony-form-injector.js` — se **dosaggio** valido nella riga, **non** lo sovrascrive con derivazione da ql; fallback ql/kg→dosaggio solo se dosaggio assente. `tony-form-mapping.js` — testi allineati. (Race INJECT modal: voci precedenti in questo file.)

## ✅ Tony — registro campo: niente diario su «ql/concime» con modal Completa; Treasure Map senza formId fragile (2026-04-09)

- **Problema**: con modal «Completa» aperto, frasi tipo «abbiamo usato 2 ql di nitrophoska» facevano ancora scattare la regola diario → `OPEN_MODAL` `attivita-modal` e navigazione verso attività; in console anche `value "NaN"` sugli input dosaggio riga prodotto.
- **Intervento**: `functions/index.js` — eccezione esplicita alla regola DIARIO se `form-trattamento` / `modal-trattamento`; Treasure Map trattamento anche su pagina registro (concimazioni/trattamenti vigneto o frutteto) con messaggio prodotti/quantità, esclusi intenti filtro lista; istruzione structured: fill_form se path registro anche senza `form.formId` nel contesto. `core/js/tony/main.js` — contesto form da `#modal-trattamento` se il generico `.modal.active` non basta; prefisso `trattamento-` in `isRelevant`; **ignora** `OPEN_MODAL` `attivita-modal` se `#modal-trattamento` è attivo. Quattro HTML `concimazioni-standalone` / `trattamenti-standalone` (vigneto + frutteto) — dosaggio in `<input type="number">` solo se `Number.isFinite`.

## ✅ Tony — form `form-trattamento` (concimazioni / trattamenti campo): prodotti + dosaggio (2026-04-09)

- **Obiettivo**: INJECT da chat quando il modal «Completa» è aperto, con righe prodotto risolte da magazzino (`ctx.azienda.prodotti` o anagrafica pagina).
- **Intervento**: `core/config/tony-form-mapping.js` — `TRATTAMENTO_CAMPO_FORM_MAP` (chiavi `trattamento-prodotti`, note, superficie, copertura). `core/js/tony-form-injector.js` — `injectTrattamentoCampoForm`. `core/js/tony/main.js` — `INJECT_FORM_DATA` per `form-trattamento` / `trattamento-concimazione-form` se `#modal-trattamento` attivo. `functions/index.js` — regola **5e**, Treasure Map `SYSTEM_INSTRUCTION_TRATTAMENTO_CAMPO_STRUCTURED`, inferenza `formId` su `fill_form` con chiavi trattamento-*. Pagine `concimazioni-standalone.html` e `trattamenti-standalone.html` (vigneto + frutteto) — `window.__tonyTrattamentoCampoApi` (`renderProdotti`, `getProdottiAnagrafica`).

## ✅ Registro concimazioni — prefill costi manodopera/macchina e testo giorni di carenza (2026-04-09)

- **Problema**: in modal «Completa concimazione» i costi potevano restare a 0 se le ore erano solo `da_validare` (non ancora validate), pur essendo già visibili altrove; mancava chiarimento sul campo giorni di carenza per interventi solo concime.
- **Intervento**: `calcolaCostiLavoro` in `lavori-vigneto-service.js` e `lavori-frutteto-service.js` — opzione `includeDaValidarePerPrefill` (secondo passaggio se il primo calcolo dà entrambi i costi a 0). `getDatiPrecompilazioneTrattamento` (trattamenti vigneto/frutteto) — uso di quella opzione, fallback `lavoro.costi` se presente su documento, tabella macchine da ore `validate` + `da_validare`. Modello `Lavoro` — campo opzionale `costi` letto da Firestore. Pagine `concimazioni-standalone.html` (vigneto/frutteto) — testo esplicativo sotto «Giorni di carenza».

## ✅ Tony Gestione Lavori — «A chi assegni?», verbi al futuro per macchine, timer proattivo (2026-04-08)

- **Problema**: con «per Luca nel pinot» la chat chiedeva comunque «A chi assegni?»; per lavori pianificati il testo usava «hai usato» (adatto al diario); il timer proattivo poteva ridondare su assegnazione o macchine.
- **Intervento**: `functions/index.js` — regole **VIETATO** «A chi assegni?» se nella frase c’è già assegnazione o se operaio/caposquadra hanno ✓; blocco **LAVORI PIANIFICATI** (futuro/intenzione per trattore/attrezzo, mai «hai usato» in **lavoro-form**). `core/js/tony/main.js` — `tonyUserMentionedLavoroAssignee`, `tonySanitizeLavoroOperaioQuestionInReply` sulla risposta; timer proattivo lavoro: skip se l’utente ha già nominato assegnatario o macchine; messaggio macchine con «attrezzo» invece di «erpice» generico; `buildForcedLavoroPrompt` allineato. `core/js/tony-form-injector.js` — messaggi disambiguazione **lavoro-form** con «vuoi usare» / voice coerente (diario attività resta al passato dove serve).

## ✅ Tony Gestione Lavori — meno domande ridondanti su data/durata e su «Configuro le macchine» (2026-04-08)

- **Problema**: con "inizio domani durata un giorno" nel primo messaggio Tony chiedeva comunque quando iniziare / quanti giorni; ripeteva "Configuro le macchine" anche a form già coerente.
- **Intervento**: `functions/index.js` — `SYSTEM_INSTRUCTION_LAVORO_STRUCTURED` + OPEN_MODAL checklist: estrazione esplicita di **lavoro-data-inizio** / **lavoro-durata** da linguaggio naturale (domani, durata un giorno, ecc.), divieto di domande su data/durata se inferibili; blocco **ANTI-RIPETIZIONE** su replyText fissi. `core/js/tony/main.js` — `tonySanitizeLavoroDataDurataQuestionInReply` + hint in `buildForcedLavoroPrompt`.

## ✅ Gestione Lavori — dropdown attrezzo visibile e compatibile con Tony inject (2026-04-08)

- **Problema**: con trattore selezionato il gruppo **attrezzo** poteva restare nascosto (`!trattore.cavalli`), oppure l’elenco escludeva attrezzi senza `cavalliMinimiRichiesti`; le opzioni `in_uso` erano `disabled` e il browser non applicava `value` (log: `lavoro-attrezzo` iniettato ma `DOM value=""`).
- **Intervento**: `core/admin/js/gestione-lavori-controller.js` — `populateAttrezziDropdown`: mostra sempre il blocco attrezzo con trattore valido; filtro CV allineato al diario (min mancante → 0); senza CV sul trattore si elencano tutti gli attrezzi non dismessi; niente `disabled` sulle opzioni (come attività). `core/js/tony-form-injector.js` — prima di `lavoro-attrezzo` ridispatch `change` sul trattore, attesa `waitForSelectOptionsWithValue`, delay trattore 450 ms.

## ✅ Tony — disambiguazione trattore/attrezzo in chat (2026-04-08)

- **Problema**: con più trincia (o più trattori) compatibili l’injector non sceglieva e non guidava l’utente; sul diario l’attività usava `find` e poteva selezionare il primo attrezzo a caso.
- **Intervento**: `core/js/tony-form-injector.js` — evento `tony-macchine-disambiguation` con elenco opzioni e istruzioni; **un solo** trattore/attrezzo compatibile → impostazione automatica (e refresh attrezzi dopo trattore); più opzioni → messaggio. `core/js/tony/main.js` — listener: messaggio in chat + TTS breve. `tony-form-mapping.js` — istruzione structured: dopo l’elenco l’utente risponde col nome per INJECT/SET_FIELD.
- **Agg. stesso giorno — trattore + CV**: se **`lavoro-attrezzo`** / **`attivita-attrezzo`** è risolvibile in anagrafica con `cavalliMinimiRichiesti`, la scelta trattore usa solo trattori con `cavalli` sufficienti; più candidati → disambiguazione con soglia CV nel testo; zero candidati → messaggio esplicito (potenza insufficiente o nessun trattore attivo).

## ✅ Tony — trattori compatibili per CV quando l’attrezzo è già noto (2026-04-08)

- **Obiettivo**: non proporre tutto il parco quando l’attrezzo è già noto; allineare la scelta a `cavalli` ≥ `cavalliMinimiRichiesti` come in anagrafica macchine.
- **Intervento**: `core/js/tony-form-injector.js` — `resolveAttrezzoFromState`, `trattoriCompatibiliCv`, integrati in `injectLavoroForm` e `injectAttivitaForm` (trattore vuoto, attrezzo risolto senza ambiguità); senza attrezzo risolto resta il fallback sul select DOM.

## ✅ Tony — default lavorazioni meccaniche + copertura da terreno (2026-04-08)

- **Obiettivo**: rendere più stabile l’iniezione su attività/lavori quando l’utente non esplicita manuale/meccanico e quando la copertura (Generale / Tra le File / Sulla Fila) va dedotta dal tipo terreno.
- **Intervento config**: `core/config/tony-form-mapping.js` — nuova policy centralizzata `LAVORAZIONI_DEFAULTS_TONY` (keyword default meccanico, keyword lavorazioni che richiedono macchine, regole copertura per terreni a filari vs seminativi), esposta in `window.TONY_FORM_MAPPING`.
- **Intervento injector**: `core/js/tony-form-injector.js` — applicazione policy in `injectAttivitaForm` e `injectLavoroForm`: forzatura copertura coerente col terreno, preferenza meccanica per lavorazioni tipiche (trinciatura/erpicatura/fresatura/diserbo/concimazione/trattamenti) se non esplicitato dall’utente, e auto-selezione trattore/attrezzo solo quando disponibile un unico candidato.

## ✅ Tracciabilità consumi — totali in risposta (consumiAggregates + CF) (2026-04-07)

- **Problema**: dopo FILTER_TABLE corretto, Tony rispondeva con «sommo le quantità, un attimo…» senza cifre: istruzioni «text breve con command» + ordine «filtra poi somma» come se il secondo passo avvenisse dopo l’esecuzione client (non così).
- **Intervento**: `tracciabilita-consumi-standalone.html` — `consumiAggregates` (totali per terreno+prodotto+unità, categorie fertilizzanti/fitofarmaci) su ogni render; `functions/index.js` — eccezione obbligo numeri nel `text` per domande quantità; somma nello stesso turno da contesto inviato; reminder + FILTRO TABELLA allineati a `consumiAggregates`.

## ✅ Tracciabilità consumi — filtro terreno + items per totali (Tony) (2026-04-07)

- **UI**: `modules/magazzino/views/tracciabilita-consumi-standalone.html` — select `filter-terreno` (anagrafica terreni), `resolveTerrenoForMovimento` da trattamento (vigneto/frutteto → `terrenoId`) o da lavoro/attività; `filterRows` per categoria + terreno; `currentTableData.items` arricchiti con `terreno`, `terrenoId`, `prodottoId`, `unitaMisura`, `contestoColtura` opzionale; summary con terreno filtrato.
- **Client Tony**: `core/js/tony/main.js` — `FILTER_KEY_MAP.tracciabilita_consumi.terreno`, matchByText su nome terreno.
- **Cloud Function**: `functions/index.js` — istruzioni FILTER_TABLE / LISTA / reminder per terreno e somme su `items` (stessa unità di misura).

## ✅ Tony — Concimazioni Vigneto/Frutteto: currentTableData + FILTER_TABLE + tracciabilità (2026-04-07)

- **Problema**: le pagine standalone Concimazioni (vigneto e frutteto) non esponevano agli “occhi” di Tony la lista visibile (`window.currentTableData`, merge `setContext('page')`, evento `table-data-ready`) come le altre liste; sulla Tracciabilità consumi mancava simmetria lato modello/client per `FILTER_TABLE`.
- **Intervento**: `modules/vigneto/views/concimazioni-standalone.html` e `modules/frutteto/views/concimazioni-standalone.html` — placeholder iniziale (`concimazioni_vigneto` / `concimazioni_frutteto`), fallback nel modulo, `pushTonyListContext` dopo ogni `loadTrattamenti` (anche elenco vuoto) con `items` allineati alle colonne (data, vigneto/frutteto, lavoroAttivita, terreno, prodotto, superficieHa, costoEuro, ids, completato, avvisoDosaggio). `core/js/tony/main.js` — `FILTER_KEY_MAP` + fallback `pageType` da path per concimazioni e `tracciabilita_consumi`, reset filtri, match testuale vigneto/frutteto, categoria tracciabilità con `normalizeTonyProdottiCategoriaValue`. `functions/index.js` — eccezioni navigazione, blocchi FILTRO TABELLA, reminder filtro per CF. `tracciabilita-consumi-standalone.html` — testo placeholder summary allineato al canone.
- **Rotte**: non modificate (già mappate altrove).
- **Agg.**: Istruzioni CF + reminder runtime su **Tracciabilità consumi**: «concimazioni» sulla stessa pagina = filtro **fertilizzanti**, non invito ad aprire il registro Concimazioni; «trattamenti» (fitosanitari) = **fitofarmaci** con testo allineato; `isTracciabilitaFilterLikeRequest` esteso (concimazioni/trattamenti).

## ✅ Tony Gestione Lavori — niente domanda ridondante su trattore/attrezzo (2026-04-07)

- **Problema**: il modello poteva ancora chiedere «Quale trattore e attrezzo…» nel testo della risposta anche quando l’utente aveva già indicato mezzi (es. «con Agrifull e nebulizzatore»); il check post-iniettivo `isMeccanico` non considerava i tipi lavoro con «meccanico» nel nome (es. trattamento anticrittogamico meccanico).
- **Intervento** (`core/js/tony/main.js`): helper `tonyUserMentionedLavoroMacchine` + `tonySanitizeLavoroMacchineQuestionInReply` sul testo mostrato dopo la risposta; istruzioni extra nel prompt forzato Gestione Lavori per valorizzare subito `lavoro-trattore` / `lavoro-attrezzo`; `isMeccanico` esteso con `\bmeccanic[oa]\b` sul nome tipo; reminder proattivo «mancano macchine» non inviato se `tony_last_user_message` contiene già riferimenti a trattore/attrezzo (evita doppio messaggio prima di una seconda `INJECT_FORM_DATA`).
- **Ambito**: la logica di **default categoria/sottocategoria/tipo** per «solo trattamento» resta in `trattamenti-lavoro-defaults.js` + injector; l’**iniezione strutturata** nel `lavoro-form` (ordine campi, attese sui select, merge contesto, second pass dopo terreno) e il **prompt forzato** su Gestione Lavori valgono per **qualunque lavorazione** compilata tramite quel modal, non solo trattamenti fitosanitari.

## ✅ Tony — augment Gestione Lavori non in chatHistory / UI modello (2026-04-08)

- **Problema**: il blocco `[ISTRUZIONE CLIENT OBBLIGATORIA]` aggiunto lato widget al prompt finiva in `Tony.chatHistory`, `tony_last_user_message` e poteva essere **ripetuto dal modello** o confondere navigazione (es. «portami a concimazioni» attivava i keyword `concimaz`).
- **Intervento**: `core/services/tony-service.js` — opzione `historyUserMessage`: cronologia e sessionStorage usano il testo utente reale; al Cloud Function resta `message` con augment. `core/js/tony/main.js` — invio `historyUserMessage` solo quando il prompt inviato differisce dal messaggio mostrato; `shouldForceLavoroStructuredReply` esclude frasi di **navigazione** (`portami`, `vai a`, …) e sostituisce il keyword troppo largo `concimaz` con `\bconcimazione\b` / `\bconcima\b` / `\bconcimiamo\b`.

## ✅ Magazzino – Tracciabilità consumi: catene sospeso/ripresa + doc (2026-04-05)

- **Vista raggruppata** (`modules/magazzino/views/tracciabilita-consumi-standalone.html`): collasso in **una scheda** dei trattamenti collegati da `prosegueDaTrattamentoId` (stessa coltura nel filtro corrente), con **data di testata = ultimo passaggio**, totali prodotti per sessione, pulsante **«Dettaglio per data e dosi»** (modale per passaggio); testi informativi in pagina aggiornati. Split per **stessa coltura / più trattamenti senza legame** resta attivo (non si confondono interventi indipendenti).
- **Gestione lavori** (`core/admin/gestione-lavori-standalone.html`, `core/services/lavori-service.js`): creazione lavoro di ripresa con **`dataInizio` scelta** dall’utente (modale; default oggi).
- **Documentazione**: `docs-sviluppo/MAGAZZINO_APPENDICE_TRACCIABILITA_DASHBOARD_E_SCARICO.md` (§9), `documentazione-utente/04-FUNZIONALITA/PRODOTTI_E_MAGAZZINO.md`, `documentazione-utente/04-FUNZIONALITA/GESTIONE_LAVORI.md`, `docs-sviluppo/guida-app/moduli/magazzino.md`.

## ✅ Trattamenti Vigneto / Frutteto – performance lista + superficie da anagrafe (2026-04-05)

- **Performance lista (lavori/attività categoria Trattamenti)**  
  - **Problema**: per ogni riga si ripetevano ricerche globali su tutti i vigneti/frutteti e tutte le sottocollezioni trattamenti; lookup ripetuti su tipi lavoro/categorie; vista “tutti” in sequenza.  
  - **Intervento**: indice trattamenti costruito **per terreno** (tutti i vigneti o frutteti sullo stesso `terrenoId` in parallelo) + mappe `lavoroId` / `attivitaId` → trattamento; **cache** per `isTipoLavoroCategoriaTrattamenti` nel singolo caricamento; **`Promise.all`** per la vista “tutti i vigneti/frutteti”; **`findTrattamentoByLavoroId` / `ByAttivitaId`** limitati al terreno del lavoro/attività (letture parallele sui soli contesti collegati).  
  - **File**: `modules/vigneto/services/trattamenti-vigneto-service.js`, `modules/frutteto/services/trattamenti-frutteto-service.js`.

- **Superficie = anagrafe terreno (opzione “tutto il terreno”)**  
  - **Campo modello**: `superficieDaAnagrafeTerreno` (boolean) su `TrattamentoVigneto` e `TrattamentoFrutteto`.  
  - **UI**: checkbox nel modal trattamenti; se attiva e il terreno ha **superficie** in anagrafe: campo ha in sola lettura allineato al terreno, pulsante mappa disabilitato, apertura mappa non necessaria per l’area; in salvataggio si rilegge la superficie dal terreno e si azzera `poligonoTrattamento`. Se manca la superficie in anagrafe, la checkbox resta disabilitata con messaggio esplicativo.  
  - **`syncTrattamentoFromLavoro`**: aggiorna `superficieTrattata` dal terreno **solo** se `superficieDaAnagrafeTerreno` è true (non sovrascrive aree da mappa).  
  - **File**: modelli `TrattamentoVigneto.js`, `TrattamentoFrutteto.js`; `trattamenti-vigneto-service.js`, `trattamenti-frutteto-service.js`; viste `modules/vigneto/views/trattamenti-standalone.html`, `modules/frutteto/views/trattamenti-standalone.html`.

- **Documentazione utente/sviluppo aggiornata**: `documentazione-utente/04-FUNZIONALITA/TRATTAMENTI_VIGNETO_FRUTTETO.md`; `docs-sviluppo/guida-app/moduli/vigneto.md` e `frutteto.md` (e copie in `core/guida-app/moduli/`).

## ✅ Magazzino – scarico automatico da trattamenti Vigneto/Frutteto (2026-04)

- **Implementazione**: servizio `modules/magazzino/services/trattamento-scarico-magazzino-service.js` (`syncScarichiMagazzinoTrattamento`, prezzo da anagrafica prodotto o costo/quantità riga); `magazzinoMovimentoIds` su documento trattamento; `updateTrattamento` / `deleteTrattamento` in `trattamenti-vigneto-service.js` e `trattamenti-frutteto-service.js`; checkbox **«Registra scarico in magazzino»** nelle pagine `trattamenti-standalone.html` (modulo `magazzino` attivo); campi origine su `MovimentoMagazzino`; fix `prezzoUnitario` null vs NaN nel modello movimento; tabella movimenti con formattazione prezzi sicura; mappa trattamenti con coordinate poligono validate (vigneto/frutteto).
- **Verifica utente**: flusso da **Diario (attività)** e da **Gestione lavori** — colonna **Lavoro** valorizzata quando presente `lavoroId`; **Attività** quando presente solo `attivitaId`.
- **Documentazione aggiornata**: `MAGAZZINO_APPENDICE_TRACCIABILITA_DASHBOARD_E_SCARICO.md` (§5 stato implementato), `ANALISI_MODULO_MAGAZZINO.md` (nota Fase 3), `documentazione-utente/.../PRODOTTI_E_MAGAZZINO.md`, `docs-sviluppo/guida-app/moduli/magazzino.md`.

## ✅ Sicurezza preventivi pubblici — Cloud Functions + rules (2026-04-04, doc agg. indici/secret 2026-04-04)

- **Problema**: letture pubbliche Firestore su `tenants`, `clienti`, `preventivi` per la pagina `accetta-preventivo-standalone.html` (enumerazione tenant, query token, update cliente).
- **Soluzione**:
  - **`functions/index.js`**: callable **`getPreventivoPubblico`** e **`aggiornaStatoPreventivoPubblico`** (Admin SDK, `collectionGroup('preventivi')` su `tokenAccettazione`), `cors: true`, `invoker: "public"`, regione **`europe-west1`**. **Senza** `secrets: [sentryDsn]` su queste due (evita 500 se il secret non è legato a Cloud Run; vedi `functions/README.md`).
  - **`firestore.rules`**: lettura `tenants` / `clienti` / `preventivi` solo **`isAuthenticated() && belongsToTenant`**; update preventivi solo manager/admin (niente update anonimo).
  - **`firebase.json`**: `firestore` include **`indexes`: `firestore.indexes.json`** — obbligatorio affinché `firebase deploy --only firestore:indexes` pubblichi davvero gli indici.
  - **`firestore.indexes.json`**: per `tokenAccettazione` su collection group **`preventivi`** si usa un **field override** (scope COLLECTION + COLLECTION_GROUP), non una voce “composito” a un campo sola (Firestore risponde 400 *index is not necessary*). Altri indici (es. `tariffe`) e override esistenti (es. `oreOperai`) restano nel file.
  - **`accetta-preventivo-standalone.html`**: niente più `getDocs` sui tenant né lettura `clienti`; usa solo le callable.
- **Deploy**: `firebase deploy --only functions,firestore:rules,firestore:indexes` (e hosting se serve). Callable da deployare esplicitamente se mancanti (404 sulla URL). Warning Tony `moduli_attivi` sulla pagina pubblica: atteso (nessun tenant/moduli).
- **Riferimenti**: perimetro e checklist deploy → **`docs-sviluppo/SICUREZZA_FLUSSI.md`**; allineamento architetturale (Master Plan §6.3) → **`docs-sviluppo/tony/MASTER_PLAN.md`**.

## ✅ Sicurezza Firestore — inviti: chiusura `create` aperto (2026-04-04)

- **`firestore.rules`** (`match /inviti/{invitoId}`): rimosso `allow create: if true` (test). Creazione consentita solo se utente autenticato, `inviatoDa == request.auth.uid`, `stato == 'invitato'`, campi minimi (`email`, `token`, `tenantId`), e **`belongsToTenant` + `isManagerOrAdmin`** sul `tenantId` indicato.
- **Deploy**: `firebase deploy --only firestore:rules` quando si aggiornano le rules.

## ✅ Dashboard — tenant Tony / briefing vocale / GitHub Pages (2026-04-04)

- **`core/dashboard-standalone.html`**
  - **`resolveCurrentTenantId(userData)`**: da utenti con solo `tenantMemberships` (es. dopo invito) deriva il tenant e chiama **`setCurrentTenantId`**, così i servizi non vedono più «Nessun tenant corrente».
  - **`loadTonyVignetoContext(availableModules, tenantIdExplicit)`**: passa il tenant esplicito e sincronizza `tenant-service` prima di `getStatisticheVigneto` (evita race al reload).
  - **`checkGlobalStatus(tenantId, ruoli)`**: caricamento + messaggio vocale su scorte/scadenze/guasti **solo** per ruoli **`manager`** e **`amministratore`**; operaio e caposquadra non ricevono quel promemoria.
- **Deploy GitHub Pages (`/gfv-platform/`)**
  - **`.gitignore`**: eccezioni `!manifest.json`, `!core/config/tony-routes.json`, `!firestore.indexes.json` (prima `*.json` escludeva file necessari al sito → 404).
  - **Link PWA**: sostituito `href="/manifest.json"` con percorsi **relativi** per pagine in `core/`, `core/auth/`, `modules/*/views/`, e `manifest.json` in root.
  - **`core/config/tony-routes.json`** versionato: Tony logga `[Tony] Rotte disponibili caricate: N` senza 404.

## ✅ Magazzino – Appendice tracciabilità / dashboard a card / viste tematiche (2026-04-02)

- Nuovo **`docs-sviluppo/MAGAZZINO_APPENDICE_TRACCIABILITA_DASHBOARD_E_SCARICO.md`**: decisioni su home Magazzino a card, elenchi tematici (trattamenti, concimazioni, ricambi, sementi, …), fonti dati (movimenti + attività + lavori + trattamenti), principi implementativi, stato scarico automatico (non ancora in codice).
- **`docs-sviluppo/ANALISI_MODULO_MAGAZZINO.md`**: §7 con rimando all’appendice.

## ✅ Tony — Movimenti standalone: merge `setContext('page')` come pagine golden (2026-04-02)

- **`modules/magazzino/views/movimenti-standalone.html`**: `renderMovimenti` usa `Object.assign({}, page, { pageType, tableDataSummary, currentTableData })` invece di sostituire tutto il contesto `page`, allineato a `prodotti-standalone` e a `.cursor/rules/tony-pagina-lista-e-form.mdc`.

## ✅ Tony — Context Builder: movimenti magazzino in ctx.azienda (2026-04-02)

- **Cloud Function** (`functions/index.js`): `buildContextAzienda` carica gli ultimi **50** documenti da `movimentiMagazzino` (`orderBy data desc`), arricchiti con **prodottoNome** / unità da `prodotti`; espone **`movimentiRecenti`** e **`summaryMovimentiRecenti`** così Tony può rispondere su carichi/scarichi anche **fuori dalla pagina Movimenti** (lista completa e filtri restano su `currentTableData` + `FILTER_TABLE` in pagina).
- **Prompt**: istruzioni ELENCO DATI + reminder `movimentiReminder` quando la domanda riguarda movimenti/filtri senza essere sulla lista.
- **Deploy**: richiede `firebase deploy --only functions` (o equivalente) per attivare in produzione.

## ✅ Tony — Master Plan: tabella fasi e roadmap §9 allineate a STATO_ATTUALE (2026-04-02)

- **`docs-sviluppo/tony/MASTER_PLAN.md`**: versione 1.2, data 2026-04-02; Fasi 2–6 e criteri aggiornati (Fase 6 **Parziale** con nota magazzino/proattività); §9 Roadmap coerente.
- **`docs-sviluppo/tony/STATO_ATTUALE.md`**: righe riepilogo Fase 4 e 6 allineate al Master Plan.

## ✅ Tony — Magazzino: guard SAVE follow-up (2026-04-02)

- **Problema**: dopo il blocco in `tony-service` compariva comunque un secondo `ESEGUO COMANDO SAVE_ACTIVITY` (prompt vuoto sul secondo turno o `formId` assente nel contesto) oppure il **fallback** `main.js` testo→`SAVE_ACTIVITY` su «prodotto salvato» senza comando.
- **Fix**: guard magazzino senza richiedere `upSave` truthy; fallback per pathname `prodotti`/`movimenti` se `formId` manca; **fallback testo→SAVE** disattivato su anagrafica magazzino salvo ultimo messaggio utente in sessionStorage = conferma esplicita («ok salva», …).

## ✅ Tony — Magazzino: niente SAVE automatico su solo descrizione + merge INJECT ravvicinati (2026-04-02)

- **Problema**: dopo `APRI_PAGINA` + inject post-nav la CF poteva restituire `INJECT_FORM_DATA` e subito `SAVE_ACTIVITY` sullo stesso messaggio utente (descrizione prodotto, non «ok salva») → doppio inject e salvataggio senza conferma.
- **tony-service** (`core/services/tony-service.js`): se il comando è `SAVE_ACTIVITY` e il contesto form è `prodotto-form` / `movimento-form`, si esegue solo se il messaggio utente sembra una **conferma esplicita** (`_magazzinoUserPromptLooksLikeSaveConfirm`); altrimenti il comando non viene emesso.
- **Widget** (`core/js/tony/main.js`): due `INJECT_FORM_DATA` sullo stesso form entro 15s uniscono `formData` (post-nav + risposta CF).
- **Cloud Function** (`functions/index.js`): nota in regola **5d** (deploy per il prompt).

## ✅ Tony — Prodotto: giorni di carenza solo per fitofarmaci (2026-04-02)

- **Regola**: i giorni di carenza in anagrafica servono **solo** per la categoria **fitofarmaci**; per tutte le altre categorie non si chiedono (né in intervista né come obbligo logico).
- **Mapping** (`core/config/tony-form-mapping.js`): `prodottoCategoriaRichiedeGiorniCarenza: ['fitofarmaci']` (allowlist); `SYSTEM_INSTRUCTION_MAGAZZINO_FORMS` e descrizione campo allineati.
- **Widget** (`core/js/tony/main.js`): `tonyGetMagazzinoInterviewEmpty` toglie `prodotto-giorni-carenza` da `interviewEmpty` se la categoria non è `fitofarmaci` (o non è ancora scelta).
- **Cloud Function** (`functions/index.js`): regola **5d** (deploy se si usa il prompt remoto).

## ✅ Tony — SAVE_ACTIVITY e promemoria «Form completo, confermi salvataggio?» (2026-04-02)

- **Problema**: il messaggio proattivo veniva inviato alla CF come «domanda utente»; il modello rispondeva con `SAVE_ACTIVITY` + «Attività salvata!» e **tony-service** eseguiva `triggerAction` **prima** di `onComplete`, quindi il blocco in `main.js` non impediva il salvataggio (coda già accodata).
- **Fix**: `Tony.ask` / `askStream` ricevono `proactive: true` insieme a `skipUserHistory`; in **tony-service** se `proactive` e prompt = verifica modulo (`confermi salvataggio` / `form completo confermi`) **non** si emette `SAVE_ACTIVITY` e si sostituisce il testo fuorviante. **CF** regola **0b** (prompt interno ≠ conferma utente).

## ✅ Tony — Magazzino: proattività dopo SET_FIELD + conferma salvataggio corretta (2026-04-02)

- **Problema**: dopo `SET_FIELD` solo sul nome (senza `INJECT`) non partiva il timer post-inject → Tony restava muto fino al messaggio utente; dopo «ok salva» il testo del modello diceva «Attività salvata» anche su prodotti/movimenti.
- **Widget** (`core/js/tony/main.js`): debounce 2s su `SET_FIELD` con prefisso `prodotto-` / `mov-` → `runTonyMagazzinoProactiveFromSetField` (stessa logica missing / «Form completo, confermi salvataggio?», idle più breve se il form è già completo); normalizzazione testo in `onComplete` per `SAVE_ACTIVITY` su path prodotti/movimenti; messaggio chat nel ramo `SAVE_ACTIVITY` bloccato + modal assente distingue prodotti/movimenti/lavori.
- **Cloud Function** (`functions/index.js`): regole **0** e **6** — testi di conferma prodotto/movimento vs diario attività. **Deploy Functions** per il prompt.

## ✅ Prodotti standalone — allineamento canone Tony liste (2026-04-02)

- **Già presente**: placeholder `currentTableData`, aggiornamento a ogni render, merge `setContext('page', …)`, evento `table-data-ready`.
- **Completamenti** (`prodotti-standalone.html`): commento canone; `items` con **`id`** (Firestore) + `unitaMisura`; summary singolare/plurale.

## ✅ Tony — Magazzino: domande anche su campi non obbligatori (`interviewEmpty`) (2026-04-02)

- **Obiettivo**: dopo il nome (o i required) Tony continua a guidare su categoria, unità, scorta, prezzo, dosaggi, carenza (prodotto) e opzionali movimento (confezione, prezzo, note, collegamenti).
- **Mapping** (`core/config/tony-form-mapping.js`): `tonyInterviewFieldIds` su `PRODOTTO_FORM_MAP` e `MOVIMENTO_FORM_MAP`.
- **Widget** (`core/js/tony/main.js`): `tonyGetMagazzinoInterviewEmpty`, `tonyMagazzinoInterviewLabels`; contesto form con `interviewEmpty`; timer proattivi post-OPEN_MODAL / post-INJECT considerano required + interview.
- **Cloud Function** (`functions/index.js`): regola **5d** aggiornata (deploy se si usa il prompt lato server).

## ✅ Tony standalone: caricare `tony-form-mapping.js` prima dell’injector (2026-04-02)

- **Problema**: su `prodotti-standalone` (e altre pagine che usano solo `tony-widget-standalone.js`) `window.TONY_FORM_MAPPING` non era definito → `injectProdottoForm` / `injectMovimentoForm` log «mapping mancante» e `INJECT_FORM_DATA` falliva anche con `formData` valido.
- **Fix** (`core/js/tony-widget-standalone.js`): caricamento sequenziale `../config/tony-form-mapping.js` poi schemas/filler/injector come prima.

## ✅ Tony — Proattività form: `getCurrentFormContext` fuori scope + OPEN_MODAL magazzino (2026-04-02)

- **Problema**: `getCurrentFormContext` era definito solo dentro `if (sendBtn) { … }`, mentre `processTonyCommand` è nello scope dell’IIFE: nei timer post-`INJECT_FORM_DATA` `typeof getCurrentFormContext === 'function'` era sempre falso → nessun messaggio «Form completo…» / campi mancanti. Stesso limite per **OPEN_MODAL** su `prodotto-modal` / `movimento-modal` senza `fields`: nessun inject → nessun timer.
- **Fix** (`core/js/tony/main.js`): `window.__tonyGetCurrentFormContext = getCurrentFormContext` e sostituzione delle chiamate usate da `processTonyCommand` con `window.__tonyGetCurrentFormContext`. Dopo `OPEN_MODAL` magazzino senza payload campi, stesso schema di timer (`POST_INJECT_CHECK_DELAY_MS` + `IDLE_REMINDER_MS`) del post-inject.

## ✅ Tony — INJECT_FORM_DATA: alias `fields` / `fieldValues` → `formData` (2026-04-02)

- **Problema**: la CF a volte emetteva `INJECT_FORM_DATA` con `fieldValues` o `fields` invece di `formData`; il widget saltava l’inject (`formData vuoto`) e il salvataggio non partiva.
- **Fix** (`core/js/tony/main.js`): normalizzazione all’ingresso del caso `INJECT_FORM_DATA` (anche `params.formData` / `params.fields`). Istruzione **5c** in `functions/index.js`: canone `formData` + deploy Functions.
- **Deploy (2026-04-02)**: in **5c** non vanno usati **backtick** attorno a esempi JSON dentro `SYSTEM_INSTRUCTION_ADVANCED` (template literal `` ` ``): rompono il parse. Testo esempio riscritto senza backtick.

## ✅ Tony — Magazzino: post-inject proattivo + fallback SAVE (prodotto/movimento) (2026-04-02)

- **Obiettivo**: stesso pattern di attività dopo `INJECT_FORM_DATA`: merge valori già nel form, timer `POST_INJECT_CHECK_DELAY_MS` + `IDLE_REMINDER_MS`, `__tonyProactiveFormState`, messaggio «Form completo, confermi salvataggio?» oppure elenco campi required ancora vuoti.
- **Widget** (`core/js/tony/main.js`): ramo `INJECT_FORM_DATA` per `prodotto-form` e `movimento-form` allineato ad attività; fallback testo-modello senza comando → `SAVE_ACTIVITY` anche per form magazzino completi (`prodotto-form` / `movimento-form`).
- **Cloud Function** (`functions/index.js`): regola **5d** (form magazzino già aperti, summary/requiredEmpty, `SAVE_ACTIVITY` su conferma). **Deploy Functions** per il prompt.
- **Mapping** (`core/config/tony-form-mapping.js`): `SYSTEM_INSTRUCTION_MAGAZZINO_FORMS` aggiornato (nome obbligatorio, hint post-iniezione / SAVE).

## ✅ Tony — Prodotti: FILTER_TABLE categoria, sinonimi (fertilizzante/concime → fertilizzanti) (2026-04-02)

- **Problema**: il modello inviava `categoria` in linguaggio naturale (es. «fertilizzante», «concime») mentre il `<select id="filter-categoria">` usa solo value `fertilizzanti`, `fitofarmaci`, ecc. — il filtro non si applicava (lista invariata).
- **Fix** (`core/js/tony/main.js`): `normalizeTonyProdottiCategoriaValue` + `matchByText` per `categoria` su pagina prodotti; fallback fuzzy sulle option di `#filter-categoria`; stesso trattamento nel ramo retrocompat `filterType`/`value`. Istruzione CF aggiornata in `functions/index.js` (deploy Functions per il prompt).
- **Bug reale (lista che non si aggiornava)**: il batch `dispatchEvent('change')` sui filtri **escludeva sempre** `id === 'filter-categoria'` (workaround storico per i terreni, dove il change è già emesso nel blocco dedicato). Su **prodotti** lo stesso id alimenta `renderProdotti` solo via `onchange` → valore impostato ma tabella invariata. **Fix**: escludere `filter-categoria` dal batch solo se `pageType === 'terreni'`.
- **Reset filtri prodotti**: `#filter-search` usa `oninput`, non `onchange` — sul reset si azzerava il valore ma l’ultimo `renderProdotti` restava con il testo di ricerca ancora applicato logicamente. **Fix**: nel ramo reset `FILTER_TABLE`, dopo `change` su `input[id^="filter-"]` emettere anche `input`.

## ✅ Tony — Magazzino: FILTER_TABLE prodotti/movimenti + form mapping prodotto/movimento (2026-04-02)

- **Obiettivo**: filtri vocali/strutturati sulla lista prodotti e movimenti (senza fallback ai filtri terreni); compilazione guidata form `#prodotto-form` / `#movimento-modal` via `OPEN_MODAL` + `fields`, `INJECT_FORM_DATA`, navigazione cross-page con pending.
- **Widget** (`core/js/tony/main.js`): `FILTER_KEY_MAP` per `pageType` prodotti/movimenti; risoluzione `pageType` da path (`prodotti` / `movimenti`); reset filtri su input+select; `matchByText` per filtro prodotto su movimenti; `OPEN_MODAL` apre con `btn-nuovo-prodotto` / `btn-nuovo-movimento` quando presenti; coda `INJECT_FORM_DATA` per `prodotto-form` / `movimento-form`; `SET_FIELD` auto-open + fallback `APRI_PAGINA` prodotti/movimenti; `checkTonyPendingAfterNav` per modal magazzino.
- **Mapping** (`core/config/tony-form-mapping.js`): `PRODOTTO_FORM_MAP`, `MOVIMENTO_FORM_MAP`, `SYSTEM_INSTRUCTION_MAGAZZINO_FORMS`.
- **Injector** (`core/js/tony-form-injector.js`): `resolveValueMagazzino`, `injectProdottoForm`, `injectMovimentoForm`, attesa select e match testuale `mov-prodotto` in `setSelectValue`.
- **Cloud Function** (`functions/index.js`): eccezioni navigazione prodotti/movimenti; blocchi FILTRO TABELLA PRODOTTI / MOVIMENTI; regola 5c magazzino; `filterReminder` + pagine `isProdottiPage` / `isMovimentiPage` con regex dedicate.
- **Deploy**: necessario deploy Firebase Functions per le istruzioni CF.

## ✅ Tony — Gestione preventivi: invio email e accettazione manager (PREVENTIVO_LIST_ACTION) (2026-04-02)

- **Obiettivo**: da voce/testo (es. «invia il preventivo a Fabbri per email», «accetta il preventivo di Stefano») Tony esegue le stesse azioni dei pulsanti Invia / Accetta sulla lista.
- **Cloud Function** (`functions/index.js`): contesto `azienda.preventivi` arricchito con `tipoLavoro` e `coltura`; risoluzione deterministica cliente + filtro stato + disambiguazione per numero preventivo e match su tipo lavoro/colture nel messaggio; comando `PREVENTIVO_LIST_ACTION` con `params.action` `invia` | `accetta_manager` e `preventivoId`; `applyPreventivoListActionResolution` prima del return; istruzioni in `SYSTEM_INSTRUCTION_ADVANCED`.
- **Widget** (`core/js/tony/main.js`): gestione comando; se non sei sulla pagina preventivi → `sessionStorage` `tony_pending_preventivi_action` + dialogo navigazione verso Gestione preventivi.
- **Pagina** (`preventivi-standalone.html`): `currentTableData.items` con `id`, `tipoLavoro`, `coltura`; `window.tonyPreventivoListAction` chiama `inviaPreventivo` / `accettaPreventivoManager`; esecuzione pending dopo `loadPreventivi`.
- **Deploy**: necessario deploy Firebase Functions.

## ✅ Nuovo Preventivo: match tariffe — tipo lavoro da select vs anagrafica (meccanico / prefisso) (2026-03-27)

- **Problema (log)**: totale 0 € con `tipoLavoro` **"Diserbo Meccanico Sulla Fila"** nel form mentre in Tariffe compaiono **"Diserbo"**, **"Diserbo sulla Fila"** (nessun `===`).
- **Fix** (`nuovo-preventivo-standalone.html`): `_normTipoLavoroTariffKey` (minuscolo, accenti, rimozione token **meccanico**); `_scoreTipoLavoroTariff` (uguaglianza chiave **oppure** form che inizia con tipo tariffa + confine parola); `_pickBestTariffaRow` / `_findTariffaPreventivo` sostituiscono il doppio `.find` con uguaglianza stretta — preferenza al tipo tariffa **più lungo** se più righe sono prefisso.

## ✅ TonyFormInjector: `lavoro-sottocategoria` — attesa opzione per id (race dopo categoria) (2026-03-27)

- **Problema (log)**: inject con id sottocategoria (es. `TGRqBo8sp3a025GfHzqz`) ma log `DOM value=""` — `waitForSelectOptions(..., 2)` si sbloccava appena c’erano 2 option, **prima** che l’opzione con quell’**id** fosse nel DOM (popolamento async dopo `lavoro-categoria-principale`).
- **Fix** (`core/js/tony-form-injector.js`): dopo `waitForSelectOptions` su preventivo-form, se il valore da iniettare è un id documento Firestore, **`waitForSelectOptionValue('lavoro-sottocategoria', id, 12000)`** prima di `setFieldValue`.

## ✅ Nuovo Preventivo: calcolo totale da tariffe — confronti normalizzati + ricalcolo dopo coltura (2026-03-27)

- **Problema**: form compilato correttamente ma totali a 0 €; spesso tariffa esistente ma **stringhe non identiche** (tipo lavoro / tipo campo) o primo `calcolaTotale` eseguito prima che la coltura fosse impostata dal flusso async sul terreno.
- **Fix** (`modules/conto-terzi/views/nuovo-preventivo-standalone.html`): helper `_normStrPrev` / `_normTipoCampoPrev` per match con `tariffe`; precompilazione `tipo-campo` dal terreno con mapping minuscolo (`collina` vs `Collina`); dopo selezione coltura in `onTerrenoChange` → `setTimeout(calcolaTotale, 80)`; `console.warn` con chiavi ricerca e elenco tipi lavoro presenti in tariffe se nessun match.

## ✅ Cloud Function tonyAsk: preventivo — non chiedere superficie nello stesso turno del terreno (2026-03-27)

- **Problema (dialogo utente)**: dopo scelta terreno (disambiguazione), Tony chiedeva ancora «qual è la superficie in ettari?» mentre il form aveva già (o stava per) precompilare la superficie da `onTerrenoChange` (log: `Superficie precompilata`, poi `requiredEmpty: []`).
- **Causa**: nel reply del modello, il contesto form può essere **indietro di un passo** rispetto all’inject lato browser; chiedere superficie nello **stesso** turno in cui si passa `terreno-id` è fuorviante.
- **Fix** (`functions/index.js`, `SYSTEM_INSTRUCTION_PREVENTIVO_STRUCTURED`): regola esplicita — nello stesso turno in cui si emette fill con **terreno-id**, non chiedere ettari; chiedere superficie solo se resta vuota ai turni successivi o per modifica volontaria.
- **Deploy**: necessario deploy Firebase Functions.

## ✅ Tony widget: guardia anti-sovrascrittura lavorazione (secondo INJECT CF) — Nuovo Preventivo (2026-03-27)

- **Problema (log utente)**: dopo un primo inject corretto (es. Trinciatura tra le file), un secondo `INJECT_FORM_DATA` dalla Cloud Function poteva sovrascrivere categoria/sottocategoria/tipo con valori incoerenti (es. Diserbo / Meccanico), lasciando `lavoro-sottocategoria` vuoto e impedendo il salvataggio.
- **Fix** (`core/js/tony/main.js`): `tonyStripConflictingPreventivoLavorazione` applicata prima di `injectPreventivoForm` — se `#tipo-lavoro` nel DOM ha già un valore e il payload propone un’altra lavorazione (o solo categoria/sottocategoria senza tipo coerente), si rimuovono dal payload `tipo-lavoro`, `lavoro-categoria-principale`, `lavoro-sottocategoria`. Override esplicito possibile con `formData._tonyAllowLavorazioneOverride` se in futuro servisse forzare un cambio.
- **Correzione (stesso giorno, log `-- Seleziona tipo lavoro --`)**: la prima opzione del select ha `value=""` ma testo visibile non vuoto; la guardia scambiava il placeholder per un tipo già scelto e **strappava** categoria/tipo dal primo inject. Aggiunti `tonyIsPreventivoTipoLavoroUnset` (value vuoto, testo `--…`, «Seleziona tipo lavoro») → in quel caso **nessuna** strip. **Post-nav**: `userPromptNav` per enrich completamento usa anche `tonyGetUserPromptForPendingNav()` se manca in intent/sessionStorage (fallback `chatHistory`).

## ✅ Cloud Function tonyAsk: preventivo allineato a «crea lavoro da ovunque» (2026-03-27)

- **Obiettivo**: stesso livello di **entry point esplicito** e **indipendenza dalla dashboard** (vigneto, magazzino, ecc.) del flusso Gestione Lavori; il preventivo è una **pagina standalone**, non il diario.
- **Modifiche** (`functions/index.js`): blocco **ENTRY POINT NUOVO PREVENTIVO** in `SYSTEM_INSTRUCTION_ADVANCED` (vietato `attivita-modal` per intent preventivo; testo tipo «Ti porto al nuovo preventivo»; esempi JSON); distinzione Lavori/Attività/**Preventivo**; regola **5b** rafforzata; **Treasure Map**: `isCreaPreventivoIntent` esteso (offerta per…, conto terzi, mi serve…, bozza per…, ecc.); **sempre** modalità strutturata se intent preventivo (anche se il messaggio matcha anche crea lavoro); **ordine istruzioni**: Preventivo **prima** di Lavori/Attività così non si cade nel diario; contesto sintetico anche quando coesiste intent lavoro; `SYSTEM_INSTRUCTION_PREVENTIVO_STRUCTURED` con enfasi pagina standalone e divieto diaprire diario; fallback retry: se nessun field inferibile ma intent preventivo da altra pagina → **APRI_PAGINA** `nuovo preventivo` + `_tonyPendingModal`.
- **Deploy**: necessario deploy Firebase Functions perché cambia solo la CF.
- **Follow-up (stesso giorno)**: `apri_pagina` / Treasure Map chiamava `buildPreventivoOpenModalFields` solo se `formData` non vuoto → pending intent spesso con **solo cliente-id**. Ora: per target preventivo si merge sempre inferenza + `params.formData`; `open_modal` preventivo anche senza formData; **inferPreventivoFallbackFormData**: match tipo lavoro per token (es. trinciatura → "Trinciatura tra le file"); path **legacy** `APRI_PAGINA` preventivo con `buildPreventivoOpenModalFields` uguale a OPEN_MODAL.

## ✅ Tony: cross-page Nuovo Preventivo senza re-inviare messaggio — `tony_last_user_message` + post-nav enrich (2026-03-27)

- **Problema**: dopo navigazione da altra pagina il form non si compilava finché l’utente non rimandava lo stesso messaggio su Nuovo Preventivo. Cause: (1) **race** — `triggerAction(APRI_PAGINA)` avveniva prima di `_pushChatTurn` nel service, quindi al click «Apri pagina» `tonyGetLastUserMessageText()` poteva essere vuoto e `userPromptForPending` non salvato; (2) enrich post-nav a 14s con gate su `requiredEmpty` non partiva se il contesto non era ancora pronto.
- **Fix**: in `tony-service.js` `ask()` salva subito `sessionStorage` `tony_last_user_message` per ogni turno utente (non proattivi); in `main.js` `tonyGetUserPromptForPendingNav()` = chatHistory **o** quella chiave; fallback lettura anche in `checkTonyPendingAfterNav`; se non c’erano `fields` nel pending, **ask** di completamento dopo **4s** senza gate su `requiredEmpty` (se c’erano fields inject, resta 14s + gate come prima).

## ✅ Tony widget: APRI_PAGINA «nuovo preventivo» senza fields — salvataggio `tony_pending_intent` (2026-03-27)

- **Problema**: da magazzino (o altre pagine), dopo conferma dialog la navigazione a `nuovo-preventivo-standalone.html` avveniva ma **nessuna** iniezione / coda `pending-after-nav`: la Cloud Function o `onComplete` potevano passare solo `{ target }` senza `_tonyPendingModal` né `fields` → `pendingModal` restava vuoto e **non** si scriveva `sessionStorage` `tony_pending_intent`.
- **Fix** (`core/js/tony/main.js`): se il target normalizzato contiene «nuovo» + «preventivo», si imposta sempre `pendingModal = 'preventivo-form'` (oltre al caso già gestito con `fields`); log `[Tony] tony_pending_intent salvato`; **`onComplete`** ora passa a `triggerAction('APRI_PAGINA', …)` anche `_tonyPendingModal` / `_tonyPendingFields` / `fields` se presenti sul comando; **`processTonyCommand` APRI_PAGINA** allineato con lo stesso salvataggio intent (path senza `onAction`).

## ✅ Tony widget: OPEN_MODAL attivita-modal + campi preventivo → Nuovo Preventivo, non Diario (2026-03-27)

- **Problema (log utente)**: da pagina senza `attivita-modal`, Cloud Function rispondeva `OPEN_MODAL` `attivita-modal` con `fields` da preventivo; il client faceva sempre fallback «apro Diario Attività».
- **Fix** (`core/js/tony/main.js`): helper `tonyPayloadLooksLikePreventivoFormData` (stessa logica già usata per coercizione `INJECT_FORM_DATA` attivita→preventivo); prima del fallback Diario e nel fallback pagina dopo OPEN_MODAL fallito, se i campi sono chiaramente preventivo si chiama `APRI_PAGINA` verso Nuovo Preventivo con `_tonyPendingModal: 'preventivo-form'`.
- **Estensione (stesso giorno, log `lavoro-modal`)**: stesso errore con `OPEN_MODAL` `lavoro-modal` → fallback pagina «lavori». Aggiunto ramo analogo + fallback; **correzione helper**: `lavoro-categoria-principale` / `lavoro-sottocategoria` non contano più come campi del modal Gestione Lavori (sono del preventivo), altrimenti il payload tipico veniva scartato.
- **Open modal senza `fields` (log utente: solo `{ type: 'OPEN_MODAL', id: 'lavoro-modal' }`)**: l’euristica sui campi non basta. Aggiunti `tonyLastUserMessageSuggestsPreventivo` (ultimo messaggio utente in `chatHistory`: preventivo / nuovo preventivo / conto terzi, ecc.) e `tonyOpenModalShouldRouteToPreventivo` = campi **o** chat; usati per `attivita-modal` / `lavoro-modal` e per il fallback dopo OPEN_MODAL fallito.
- **Post-nav Nuovo Preventivo senza formData completo**: in `sessionStorage` (`tony_pending_intent`) si salva anche `userPromptForPending` (ultimo messaggio utente al click “Apri pagina”). Dopo inject pendente, se il form ha ancora molti required vuoti (es. `cliente-id` o ≥4 campi), dopo ~14s parte un `Tony.ask(..., { skipUserHistory: true })` con suffisso contesto per ottenere `INJECT_FORM_DATA` completo dalla Cloud Function — **non serve deploy Firebase** per questa parte client.

## ✅ Tony: rimossa instrumentazione debug sessione 7e2215 (2026-03-27)

- **Contesto**: flusso preventivo verificato ok in console utente.
- **Pulizia**: eliminati `fetch` verso ingest locale e log `[Tony Debug 7e2215]` in `tony-service.js`, `tony-form-injector.js`, `main.js` (preventivo), `functions/index.js` (`enrichPreventivoCommandFormData`); rimossi i `console.log` più rumorosi `[DEBUG CURSOR]` su `getCurrentFormContext` / `sendMessage` / jQuery in `main.js`.

## ✅ Tony widget: disambiguazione terreno senza suffisso «Rispondi con il nome…» (2026-03-27)

- **Richiesta UX**: la domanda breve («Dobbiamo lavorare su A o B?») basta; rimossa la seconda riga «Rispondi con il nome (anche a voce).» da chat (e quindi anche dalla TTS quando coincideva col testo mostrato).
- **Fix** (`core/js/tony/main.js`): ramo `__tonyPreventivoTerrenoDisambiguation` e ramo multi-terreno filtrato dopo inject preventivo.

## ✅ Tony widget: domanda terreno breve + lettura TTS (2026-03-27)

- **Problema**: la disambiguazione terreno in chat era troppo lunga (elenco con coltura/ha) e **non** veniva letta ad alta voce; l’utente voleva una frase tipo «Dobbiamo lavorare su X o Y?» come negli altri flussi con `Tony.speak`.
- **Fix** (`core/js/tony/main.js`): helper `buildPreventivoTerrenoChoiceQuestion` + `appendPreventivoTerrenoAskAndSpeak` (chat + `window.Tony.speak`); fino a 5 nomi messaggio corto; oltre, elenco solo nomi in chat e TTS breve che rimanda alla chat.

## ✅ Tony widget: elenco disambiguazione terreni filtrato per hint (messaggio utente / coltura) (2026-03-27)

- **Problema**: dopo l’inject senza `terreno-id` l’elenco in chat includeva **tutti** i terreni del cliente; serviva restringere ai soli con **match parziale** (es. «Trebbiano» → solo terreni con nome/coltura che richiamano trebbiano, incluso typo tipo trebbiamo).
- **Fix** (`core/js/tony/main.js`): hint da `coltura` / testo non-id in `formData` + ultimo turno utente in `Tony.chatHistory`; token normalizzati (stopword comuni); match su blob nome+colture+podere; prefisso 5–6 caratteri e regola dedicata `trebb*`. Se il filtro dà **un** solo terreno, messaggio dedicato; se **nessun** match, fallback all’elenco completo con prefisso esplicativo. Helper in **scope IIFE** (stesso di `processTonyCommand`).

## ✅ Tony widget: dopo inject preventivo senza `terreno-id`, domanda esplicita se il cliente ha più terreni (2026-03-27)

- **Problema (log utente)**: CF corretta (`hasCmdTerreno: false`) e inject a 4 campi senza terreno; mancava un messaggio in chat tipo «terreno A o B?» e partiva subito il proattivo su data/coltura.
- **Fix** (`core/js/tony/main.js`): dopo `injectPreventivoForm`, se c’è `cliente-id` nel payload, non c’è `terreno-id`, `preventivoState.terreni` ha più elementi e il select terreno è ancora vuoto (con retry breve per `loadTerreniCliente`), Tony invia in chat l’elenco terreni (nome, coltura, ha) e **non** avvia il timer proattivo finché l’utente non ha chiarito (stesso pattern del ramo `__tonyPreventivoTerrenoDisambiguation`).

## ✅ Tony Cloud Function: preventivo — merge infer+enriched reintroduceva terreno-id; legacy OPEN_MODAL senza enrich (2026-03-27)

- **Problema (log utente)**: dopo deploy restava `hasCmdTerreno: true`; in chat un terreno e in pagina un altro. Evidenza: il merge `{ ...inferred, ...enriched }` dopo `enrichPreventivoCommandFormData` **reinseriva** `terreno-id` dall’inferenza quando il guardrail l’aveva rimosso. Inoltre il path **legacy** (JSON `text`+`command` senza blocco Treasure Map) **non** chiamava l’enrichment su `OPEN_MODAL` → `fields` passavano al client senza guardrail.
- **Fix** (`functions/index.js`): introdotto `buildPreventivoOpenModalFields` (inferenza + campi modello → un solo `enrichPreventivoCommandFormData`). Sostituiti i merge su Treasure Map / retry per `open_modal` e `APRI_PAGINA` preventivo. Prima del `return` sul path legacy, stesso trattamento per `OPEN_MODAL` con `id` preventivo. Se il modello aveva `terreno-id` e dopo il guardrail non c’è più, `text` di risposta viene sostituito con un messaggio neutro che **non** nomina un terreno scelto.

## ✅ Tony Cloud Function: guardrail preventivo — più terreni per cliente senza nome terreno nel messaggio (2026-03-27)

- **Problema (log console)**: `OPEN_MODAL` con `fields['terreno-id']` già valorizzato mentre l’utente citava solo la coltura (“Trebbiano”); il testo di Tony confermava un terreno specifico. Evidenza: `parsedData snapshot { hasCmdTerreno: true }` in `tony-service.js`.
- **Causa**: il guardrail precedente rimuoveva `terreno-id` solo se più terreni condividevano la **stessa** stringa `coltura` in anagrafica; con colture diverse su terreni ugualmente “ambigui” per l’utente non scattava.
- **Fix** (`functions/index.js` → `enrichPreventivoCommandFormData`): se il cliente ha **più di un terreno** nel pool e il messaggio **non contiene il nome normalizzato** del terreno scelto dal modello, `terreno-id` viene rimosso dal comando così l’injector/chat possono chiedere la scelta. Se il valore non è risolvibile nel pool cliente, viene rimosso altrettanto.

## ✅ Tony Cloud Function: `data-prevista` solo se data esplicita utente (2026-03-26)

- **Problema**: Tony impostava autonomamente `data-prevista` nel preventivo anche senza una data detta dall’utente.
- **Fix** (`functions/index.js`): aggiunto guardrail `userMentionsExplicitDate(...)`; se nel messaggio utente non c’è una data esplicita (oggi/domani/giorno settimana/data numerica), `data-prevista` viene rimossa dal `formData` prima dell’`INJECT_FORM_DATA`.

## ✅ Tony Cloud Function: match terreno parziale testo (albicocchi/albicocche) + hint ambiguità (2026-03-26)

- **Problema**: con testo parziale (es. "albicocchi") il terreno non sempre veniva inferito; funzionava solo con nome più vicino al valore anagrafico.
- **Fix** (`functions/index.js`): inferenza terreno preventivo estesa con token parziali e radice lessicale (es. `albicocc`) su nome/coltura terreno.
- **Ambiguità**: se più candidati hanno score simile, la function passa un hint testuale (`terreno-id` come token) per attivare la disambiguazione lato client invece di lasciare il campo vuoto.

## ✅ Tony Cloud Function: arricchimento `formData` preventivo quando manca `terreno-id` (2026-03-26)

- **Problema (log utente)**: comando `INJECT_FORM_DATA preventivo-form` con 4 campi senza `terreno-id` => niente precompilazione coltura/superficie.
- **Fix** (`functions/index.js`): aggiunto `enrichPreventivoCommandFormData` che integra i campi mancanti (`cliente-id`, `tipo-lavoro`, `terreno-id`) usando inferenza da messaggio+contesto anche quando esiste già un comando Treasure Map.
- **Match terreno più robusto lato function**: scoring token/fuzzy su nome/coltura del terreno; se c'è un match dominante lo usa come hint terreno.

## ✅ Tony Cloud Function: retry 429 + fallback preventivo strutturato (2026-03-26)

- **Rate limit Gemini**: in `functions/index.js` introdotto `callGeminiWithRetry` (retry con backoff su 429/500/503) per ridurre i `500` dovuti a `RESOURCE_EXHAUSTED`.
- **Guardrail preventivo**: se `terreno-id` sembra un id ma non è verificabile nei terreni del cliente nel contesto, viene rimosso dal comando per evitare inject errati.
- **Fallback Treasure Map**: se il modello non produce comando utile in modalità preventivo, la funzione genera un `INJECT_FORM_DATA` sintetico (`preventivo-form`) con i campi inferibili da messaggio+contesto (cliente/tipo/terreno) invece di restituire “nessun comando”.

## ✅ Tony – Nuovo Preventivo: regola filari estesa a frutteto (Albicocche => Tra le File) (2026-03-26)

- **Problema (log utente)**: con terreno a `Albicocche` la sottocategoria restava `Generale` invece di `Tra le File`.
- **Fix** (`core/js/tony-form-injector.js`): estesa `terrenoHasFilariColtura` con alias campi coltura e dizionario colture arboree/frutteto (albicocco, pesco, ciliegio, susino, pero, melo, ecc.) per applicare coerentemente la regola filari come su vigneto.

## ✅ Tony – Nuovo Preventivo: log diagnostici + fallback su id terreno non presente nel DOM (2026-03-26)

- **Diagnostica** (`core/js/tony-form-injector.js`): log estesi su `terreno-id` con hint/resolved e dump valori option (`value::text`) quando il browser rifiuta il value.
- **Fallback runtime**: se l’id richiesto non esiste nelle option correnti, prova coercion; se nel select c’è un solo terreno lo seleziona automaticamente, se i terreni sono multipli attiva disambiguazione utente in chat.
- **UX** (`core/js/tony/main.js`): durante disambiguazione preventivo, stop ai reminder proattivi per evitare messaggi fuorvianti finché l’utente non sceglie il terreno.

## ✅ Tony – Nuovo Preventivo: disambiguazione terreno su match parziale (2026-03-26)

- **Nuova regola**: se `terreno-id` è un hint parziale (es. `trebbiano`) e matcha **1 solo terreno**, Tony seleziona automaticamente quel terreno.
- **Disambiguazione**: se i match sono multipli, l’injector non forza una scelta e Tony chiede chiarimento in chat, elencando i terreni candidati.

## ✅ Tony – Nuovo Preventivo: match terreno più elastico su hint coltura (2026-03-26)

- **Problema (log utente)**: con hint `trebbiano`, `terreno-id` restava testuale e il browser non selezionava il `<select>`.
- **Fix** (`core/js/tony-form-injector.js`): `resolveTerrenoIdForPreventivo` esteso con alias campi (`colturaSottoCategoria`, `colturaDettaglio.*`) + scoring token/fuzzy su blob terreno per scegliere l’id più probabile quando l’hint non è un id Firestore.

## ✅ Tony – Nuovo Preventivo: ordine iniezione cliente → terreno → lavorazione (2026-03-26)

- **Problema (test console)**: con ordine precedente la cascata lavorazione partiva prima della selezione terreno; il campo `terreno-id` restava instabile/non selezionato.
- **Fix** (`core/js/tony-form-injector.js`): `INJECTION_ORDER_PREVENTIVO` aggiornato a `cliente-id` → `terreno-id` → `lavoro-categoria-principale` → `lavoro-sottocategoria` → `tipo-lavoro` (poi campi coltura/morfologia/superficie).

## ✅ Tony – Nuovo Preventivo: parità Gestione Lavori su hint terreno (2026-03-26)

- **Problema (log utente)**: `terreno-id` arrivava come hint coltura (es. `trebbiano`) e il select aveva `option.value = id`; il browser rifiutava il value (`DOM value=""`).
- **Fix** (`core/js/tony-form-injector.js`): `coercePreventivoTerrenoSelectToDomOption` ora applica il criterio già usato in Gestione Lavori, cercando per campi terreno/coltura (`nome`, `coltura`, `colturaSottocategoria`, `colturaCategoria` e alias legacy) e mappando al `value` reale presente nelle `<option>`.

## ✅ Tony – Nuovo Preventivo: `terreno-id` id nelle opzioni ma DOM rifiuta il value (2026-03-26)

- **Problema (log utente)**: `preventivo terreno-id: browser non ha accettato il value` con `opzioni=3` e `onTerrenoChange` con valore vuoto: l’id risolto (es. da contesto CF) non coincide con i `value` delle `<option>` effettive (disallineamento `preventivoState.terreni` vs select dopo cascata / race).
- **Fix** (`core/js/tony-form-injector.js`): **`coercePreventivoTerrenoSelectToDomOption`** prima di `setSelectValue` su `terreno-id` + `preventivo-form` — se l’id non è nelle option, riallinea con hint raw, `resolveTerrenoIdViaDomSelect`, nome da stato o match sul testo opzione (`nome (ha)`). **`resolveTipoLavoroToNome`**: match `search.indexOf(n)` solo se `n.length >= 3` per ridurre fuzzy errati.

## ✅ Tony – Nuovo Preventivo: terreno-id vuoto (race `loadTerreniCliente`) (2026-03-26)

- **Problema**: Log injector `terreno-id = "<id>"` ma `onTerrenoChange` con valore vuoto: il browser non applica `value` se l’`<option>` non c’è; `loadTerreniCliente` async può rifare `innerHTML` durante l’inject; una risposta Firestore lenta poteva sovrascrivere una più recente.
- **Fix**: `nuovo-preventivo-standalone.html` — **`_loadTerreniClienteGen`** (solo l’ultimo fetch aggiorna il DOM); **`window.__preventivoAwaitTerreniClienteReady`** + **`_loadTerreniClientePromise`**. `tony-form-injector.js` — **`awaitPreventivoTerreniFetchDone`** dopo cliente e prima di `terreno-id`; **`setSelectValue`**: fallback **`selectedIndex`** e log con **valore DOM effettivo**.
- **Fix 2 (hint coltura in `terreno-id`)**: se la CF invia es. `"trebbiano"` invece dell’id Firestore, **`waitForSelectOptionValue(value)`** non trova mai l’opzione (i `value` sono id). Ora: **`resolveTerrenoIdForPreventivo`** arricchito (campi coltura extra, blob testuale, incrocio **`colturePerCategoriaPreventivo`** → `colturaId` / nomi); **`resolveTerrenoIdViaDomSelect`** sul testo delle `<option>`; **`resolveValuePreventivo('terreno-id')`** con fallback DOM; in **`injectForm`**, se dopo resolver non è un id documento → solo **`waitForSelectOptions`** (non wait su value hint).

## ✅ Tony – Nuovo Preventivo: iniezione instabile vs Gestione Lavori (race bootstrap + cascata tipo) (2026-03-26)

- **Problema**: Con `INJECT_FORM_DATA` a `delayMs: 0` sulla pagina, l’injector partiva spesso **prima** che `loadTipiLavoro` / `loadColture` avessero popolato stato e dropdown → `preventivoState` assente o liste vuote, oppure `#tipo-lavoro` ancora senza opzioni dopo `change` su categoria ( **`loadTipiLavoro` async** ): match tipo/coltura falliti o campi vuoti. La pre-sync cliente+terreno scattava **solo** se c’era anche `tipo-lavoro`, quindi con cliente+terreno senza tipo la lista terreni non era garantita prima della cascata.
- **Fix** (`core/js/tony-form-injector.js`): **`waitForPreventivoPageDataReady`** (max 20s) prima dello swap `lavoriState` → attende tipi lavoro, categorie lavoro e categorie colture (o DOM `#coltura-categoria`); **`waitForSelectOptions`** con `maxMs` configurabile e **14s** per `#tipo-lavoro` sul preventivo; delay post-categoria/sottocategoria **900ms**; pre-sync **cliente + terreno** quando entrambi presenti (indipendente dal tipo); **`resolveValuePreventivo`** + **`setSelectValue`** per **`coltura`** (match fuzzy come tipo lavoro). Controllo DOM `#preventivo-form` prima dell’attesa.

## ✅ Tony – Nuovo Preventivo da altra pagina + messaggi “fantasma” in chat (2026-03-24)

- **Navigazione**: `checkTonyPendingAfterNav` richiedeva `path.indexOf(targetSlug)` stretto; path/file con varianti (`nuovo_preventivo`, `preventivo-standalone`) potevano far saltare l’intent. Ora per `modalId === 'preventivo-form'` si accetta anche path “nuovo preventivo” o presenza di `#preventivo-form`; polling fino a ~7s; `APRI_PAGINA` con `fields` e target “nuovo preventivo” imposta `_tonyPendingModal` se mancante. `OPEN_MODAL`: alias `preventivo` per aprire la pagina. **Cloud Function**: Treasure Map accetta `action: "apri_pagina"` / `APRI_PAGINA` con `params.target` e `formData` + `_tonyPendingModal` per preventivo; istruzione preventivo aggiornata.
- **Dialogo interno visibile**: i promemoria proattivi (`sendMessage(..., { proactive: true })`) non aggiungono bolla utente in UI ma venivano comunque salvati in `Tony.chatHistory` → ripristino sessione mostrava frasi non scritte dall’utente. `tony-service.js`: `ask`/`askStream` con `skipUserHistory`; `main.js` passa `skipUserHistory: !!opts.proactive`. Corretto anche ritorno mancante dopo `INJECT_FORM_DATA` nel ramo callable (evita caduta nel ramo modello).

## ✅ Tony – Preventivo: niente salvataggio automatico dopo promemoria proattivo (2026-03-24)

- **Problema**: Il timer invia «Form completo, confermi salvataggio?»; il modello rispondeva con `action: "save"` → `SAVE_ACTIVITY` senza che l’utente avesse detto sì/salva.
- **Fix**: `functions/index.js` — se il messaggio utente coincide col promemoria proattivo (`tonyIsProactiveSaveReminderUserMessage`), non emettere `SAVE_ACTIVITY`; testo che chiede esplicitamente conferma (sì / salva). Istruzioni aggiornate in `SYSTEM_INSTRUCTION_PREVENTIVO_STRUCTURED`. `core/js/tony/main.js` — guard in `onComplete` che annulla `SAVE_ACTIVITY` se `opts.proactive` e stesso testo (doppia rete se la CF non è deployata).

## ✅ Tony – Nuovo Preventivo: SAVE_ACTIVITY bloccato (Nessun modal attivo) (2026-03-24)

- **Problema**: Con form completo, il modello emette `SAVE_ACTIVITY` come per il Diario attività; `SmartFormFiller.validateBeforeSave()` richiede `.modal.active` → `missingFields: ['Nessun modal attivo']` → salvataggio mai eseguito (pagina standalone senza modal).
- **Fix**: `core/js/tony/main.js` — se esiste `#preventivo-form`, validazione con `checkFormCompleteness()` e click su `button[type="submit"]` dentro quel form; niente fallback chat finto “salvato” per quel caso.
- **Fix 2 (ReferenceError)**: `checkFormCompleteness` è definita dentro `if (sendBtn)` mentre `processTonyCommand` è nello scope IIFE → `checkFormCompleteness is not defined`. Aggiunti `tonyCheckFormCompletenessSafe()` e `window.__tonyCheckFormCompleteness` assegnato dopo la definizione.

## ✅ Tony – Nuovo Preventivo: data prevista non iniettata + Diario attività per errore (2026-03-24)

- **Problema**: Il modello spesso emette la data come `attivita-data` (o `dataPrevista` / `data_prevista`) invece di `data-prevista` → routing ```json verso `attivita-form` → `OPEN_MODAL` su pagina senza modal → navigazione al Diario. Inoltre `resolveValuePreventivo` non normalizzava la data per `<input type="date">` (es. "oggi", DD/MM/YYYY).
- **Fix**: `tony-service.js` — su pagina/contesto Nuovo Preventivo, alias verso `data-prevista` prima del routing; hint `dataPrevista` / `data_prevista`. `main.js` — stesso alias prima della coercizione attivita→preventivo; `prevFieldHints` esteso (`data-prevista`, `giorni-scadenza`, `note`). `tony-form-injector.js` — `normalizeDateForPreventivoInput` + case `data-prevista` in `resolveValuePreventivo`.

## ✅ Tony – Nuovo Preventivo: `terreno-id` da coltura / nome (non solo parcello) (2026-03-24)

- **Problema**: La CF può inviare in `terreno-id` la **coltura** (es. `"trebbiano"`) mentre il select usa **id Firestore** e il testo è il **nome del terreno**. `_resolveByName` solo su `nome` non matchava → `setSelectValue` impostava un value inesistente → `onTerrenoChange` con valore vuoto e lavorazione/coltura non propagate.
- **Fix**: `tony-form-injector.js` — `resolveTerrenoIdForPreventivo` (id esatto, nome, poi coltura / sottocoltura / categoria coltura); `resolveValuePreventivo` lo usa per `terreno-id`. Dopo il pre-sync cliente, se l’id risolto è in `preventivoState.terreni`, **`fd['terreno-id']` viene sostituito con quell’id** così `deriveParentsFromTipoLavoro` e il loop `injectForm` lavorano con il valore reale del select.

## ✅ Tony – Nuovo Preventivo: attesa post–cliente come Gestione Lavori (2026-03-24)

- **Problema**: Dopo pre-inject `cliente-id`, `loadTerreniCliente()` (async) non aveva tempo sufficiente rispetto al modal Lavori, dove `INJECT_FORM_DATA` è accodato con **`delayMs: 1800`** dopo `openCreaModal()`; sul preventivo bastavano **650ms** → terreno/tipo e derive filari spesso fallivano.
- **Fix**: `tony-form-injector.js` — costante **`PREVENTIVO_POST_CLIENTE_MS = 1800`** (stesso ordine di grandezza di `main.js` `open-modal-fields`); `DELAYS_PREVENTIVO['cliente-id']` allineato; dopo pre-sync cliente **`waitForPreventivoTerrenoSelectHydrated`** (≥2 option oppure placeholder stabile dopo 6s+0.5s, max 12s) prima di `waitForPreventivoStateContainsTerreno` / derive / resto inject.

## ✅ Tony – Nuovo Preventivo: INJECT senza ritardo in coda (2026-03-24)

- **Problema**: `INJECT_FORM_DATA` da `triggerAction` → `onAction` veniva accodato con `getTonyQueueDelayByType` = **400ms** anche su pagina Nuovo Preventivo dove `#preventivo-form` è già presente → sensazione di iniezione non “immediata” dopo la risposta CF.
- **Fix**: `main.js` — se `formId === 'preventivo-form'` e il nodo `#preventivo-form` esiste, `enqueueTonyCommand` con **`delayMs: 0`** (l’iniezione resta async per i delay interni dell’injector tra dropdown dipendenti).

## ✅ Ripristino: allineamento al fix data-prevista (Fase 4), senza patch successive (2026-03-24)

- **Richiesta**: Tornare al comportamento coerente con l’analisi «alias data / routing ```json → preventivo-form»; annullare tentativi successivi che avevano destabilizzato il flusso.
- **Codice**: `tony-service.js` — `_pushChatTurn` di nuovo **senza** turno user in history se `skipUserHistory`; rimosso `_coerceCallableInjectToPreventivo`. `main.js` — `restoreTonyState` e `doDisplay` senza `_tonyProactiveInternal` / dedupe messaggi Tony. `functions/index.js` — routing Treasure Map `fill_form` di nuovo solo con `explicitPreventivo` (cliente-id + campi), senza `tonyResolveTreasureMapInjectFormId`. `tony-form-injector.js` — pre-sync cliente con `delay(650)`; niente evento `preventivo-terreni-loaded` né `resolveTerrenoIdForPreventivo`; `terreno-id` risolto solo con `_resolveByName` sul nome. `nuovo-preventivo-standalone.html` — rimosso `dispatchEvent` in `loadTerreniCliente`.

## ✅ Nuovo Preventivo – data prevista prima del salvataggio / Tony proattivo (2026-03-24)

- **Problema**: `#data-prevista` non era `required` → dopo inject `requiredEmpty` risultava vuoto → timer proattivo chiedeva subito conferma salvataggio; il salvataggio poteva comunque creare documenti con `dataPrevista: null`.
- **Fix**: `nuovo-preventivo-standalone.html` — `required` su `data-prevista`, label/testo guida; `handleSalvaPreventivo` verifica la data. `main.js` — messaggio proattivo mirato se manca `data-prevista`. `functions/index.js` — in `SYSTEM_INSTRUCTION_PREVENTIVO_STRUCTURED`, non proporre save se la data è vuota nel formSummary.

## ✅ Tony – Generale → Tra le File (vite/frutteto) su terreni Firestore camelCase (2026-03-24)

- **Problema**: Su Nuovo Preventivo (e in parte Gestione Lavori) il terreno ha `coltura` testuale (es. "Vite da Vino") e `colturaCategoria` come id; la logica usava solo `coltura_categoria || coltura` e la regex non vedeva "vite". In preventivo l’override Generale→Tra le File era solo nel ramo `else if (existingSub === 'generale')`, mentre la sottocategoria derivata veniva scritta nel ramo `if (!existingSub)`, quindi l’override non partiva mai.
- **Fix**: `tony-form-injector.js` — `terrenoHasFilariColtura(terreno)` (blob da coltura, camelCase, nome); usata in `deriveParentsFromTipoLavoro` per disambiguare Erpicatura; in `injectPreventivoForm` blocco post-derive se sottocategoria è ancora "Generale"; stesso criterio in `injectLavoroForm`.
- **Fix 2 (derive ancora Generale)**: `preventivoState.terreni` si popola solo dopo `loadTerreniCliente` (change cliente). Il derive partiva prima dell’inject → lista terreni vuota. Ora: pre-inject `cliente-id`, attesa `waitForPreventivoStateContainsTerreno`, refresh `lavoriState.terreniList`, poi `deriveParentsFromTipoLavoro`.
- **Fix 3 (terreno non impostato dopo pre-sync)**: il secondo `setFieldValue` su `cliente-id` nel loop `injectForm` rilanciava `loadTerreniCliente` e svuotava/ritardava il select → `terreno-id` non restava applicato. Ora `injectForm` accetta `skipFieldIds` e, se è già stato fatto il pre-sync cliente+terreno, si salta `cliente-id` nel loop; second pass `waitForSelectOptionValue` per terreno portato a 10s. **Cloud Function**: in `SYSTEM_INSTRUCTION_PREVENTIVO_STRUCTURED`, terreno-id obbligatorio quando il terreno è noto (non omettere solo perché il tipo è già "Tra le File").
- **Fix 4 (terreno perso + Diario attività)**: `INJECTION_ORDER_PREVENTIVO`: `terreno-id` **dopo** categoria/sottocategoria/`tipo-lavoro` così `loadTipiLavoro` non interferisce col select terreno; `loadTerreniCliente` con `innerHTML` poteva emettere change vuoti prima. **tony-service.js**: routing ```json → `preventivo-form` anche su pagina `nuovo-preventivo` / `formId` preventivo se le chiavi sembrano preventivo **senza** richiedere `cliente-id` nel secondo messaggio (evita default `attivita-form` → apertura Diario). **main.js**: coercizione `attivita-form` → `preventivo-form` se `#preventivo-form` esiste e formData ha chiavi preventivo.

## ✅ Tony – Nuovo Preventivo: terreno dopo cliente (race loadTerreniCliente) (2026-03-24)

- **Problema**: Dopo `cliente-id`, la pagina chiama `loadTerreniCliente()` (Firestore async) e ricostruisce `#terreno-id`. L’injector impostava `terreno-id` con un delay fisso: opzione assente o select ricostruito dopo → terreno vuoto, `onTerrenoChange` senza id, superficie non precompilata.
- **Fix**: In `tony-form-injector.js`, `waitForSelectOptionValue` prima di iniettare `terreno-id` e second pass post-`injectForm` se il valore non coincide con l’id risolto.

## ✅ Tony – timer proattivo post-inject Nuovo Preventivo (2026-03-24)

- Dopo `INJECT_FORM_DATA` su `preventivo-form`: stesso schema di Diario/Gestione Lavori (`POST_INJECT_CHECK_DELAY_MS` → contesto form → `IDLE_REMINDER_MS` → `__tonyTriggerAskForMissingFields` / `__tonyTriggerAskForSaveConfirmation`). Il callback non usa `.modal.active` ma presenza di `#preventivo-form` in pagina.
- **Fix 2026-03-24 (console: formCtx non disponibile dopo retry)**: `getCurrentFormContext` usa `#preventivo-form` se presente (id unico nel repo, senza filtro su pathname). Il check proattivo chiama `window.__tonyBuildTonyFormContext` sul nodo `#preventivo-form` così i timer async non dipendono dal binding di `getCurrentFormContext` definito nel blocco `if (sendBtn)`.

## ✅ Tony – compilazione form Nuovo Preventivo (Conto Terzi) (2026-03-24)

- **Obiettivo**: Stessa catena di Gestione Lavori: `PREVENTIVO_FORM_MAP` in `tony-form-mapping.js`, `injectPreventivoForm` in `tony-form-injector.js` (mirror `preventivoState` → `lavoriState` per `deriveParentsFromTipoLavoro`, `updateColtureDropdownPreventivo` dopo `coltura-categoria`, match `cliente-id` / `tipo-lavoro` / `terreno-id` nei select), `main.js` (`getCurrentFormContext` da `#preventivo-form` su path `nuovo-preventivo`, `INJECT_FORM_DATA` + navigazione con intent pendente, `OPEN_MODAL` preventivo-form / nuovo-preventivo, `pageMap` e `checkTonyPendingAfterNav`).
- **Pagina**: `nuovo-preventivo-standalone.html` espone già `window.preventivoState` via `syncPreventivoTonyState()`.
- **Cloud Function**: `SYSTEM_INSTRUCTION_PREVENTIVO_STRUCTURED`, Treasure Map su pagina/form preventivo, routing `fill_form` → `formId: preventivo-form` quando i campi sono da Nuovo Preventivo (es. `cliente-id` + `tipo-lavoro`, senza `lavoro-tipo-lavoro`).
- **tony-service.js**: blocco ```json client-side → `INJECT_FORM_DATA` con `formId` preventivo vs lavoro vs attività.

## ✅ Conto Terzi – Nuovo preventivo: fix `app is not defined` (2026-03-24)

- **Problema**: `loadCategorieLavori`, `loadTipiLavoro`, `loadCategorieColturePreventivo`, `loadColturePerCategoriaPreventivo` (e uso servizi colture) chiamavano `setFirebaseInstances({ app, db, auth })` senza che `app` fosse definita.
- **Fix**: `import getAppInstance` e `const app = getAppInstance()` subito dopo `initializeFirebase` in `modules/conto-terzi/views/nuovo-preventivo-standalone.html`.

---

## ✅ Conto Terzi – Tony pagina Terreni Clienti (2026-03-23) - COMPLETATO

### Obiettivo
Estendere il supporto Tony alla pagina **Terreni Clienti** (Conto terzi): currentTableData per domande sulla lista, FILTER_TABLE per filtro cliente.

### Implementazione
- **modules/conto-terzi/views/terreni-clienti-standalone.html**: (1) Placeholder `window.currentTableData` (pageType 'terreniClienti'). (2) Fallback all'inizio del modulo. (3) In `renderTerreni(terreniList)`: build summary (es. "Ci sono X terreni per [cliente] in elenco."), items (nome, cliente, superficie, coltura, podere); `window.currentTableData`, `Tony.setContext('page', ...)`, evento `table-data-ready`.
- **core/js/tony/main.js**: pageType da path se contiene "terreni-clienti"; FILTER_KEY_MAP **terreniClienti**: cliente → filter-cliente (matchByText per nome ragione sociale); reset filtri per terreniClienti.
- **functions/index.js**: FILTRO TABELLA TERRENI CLIENTI (params: cliente, reset); LISTA CORRENTE aggiornata con pagina terreni clienti (items: nome, cliente, superficie, coltura, podere); isTerreniClientiPage, isTerreniClientiFilterLikeRequest; filterReminder esteso a (isTerreniClientiPage && isTerreniClientiFilterLikeRequest). SOMMA ETTARI: specificato "NON terreni-clienti" per evitare conflitto.
- **core/services/tony-service.js**: sanitizer per pageType 'terreniClienti' (items con nome, cliente, superficie, coltura, podere).

### Risultato
Sulla pagina Terreni Clienti l'utente può chiedere "quanti terreni?", "quali terreni ha Rossi?", "mostrami i terreni di Luca", "pulisci filtri" e Tony risponde usando la lista visibile e applica il filtro cliente con FILTER_TABLE.

### Calcolo spesa lavorazioni (modal mappa – 2026-03-23)
- **Problema**: La tabella lavorazioni nel modal mappa terreno usava `getTariffaProprietario`, errato per Conto Terzi.
- **Soluzione**: Rimosso tariffa proprietario. Spesa calcolata con:
  - **Attività con lavoroId**: da `lavori/{id}/oreOperai` (stato `validate`) – manodopera da `getTariffaOperaio` (modulo Manodopera), macchine/attrezzi da `getMacchina(id).costoOra` (modulo Parco Macchine). Cache per `lavoroId` per evitare duplicati (più attività stesso lavoro → costo mostrato solo sulla prima riga, altre "(v. sopra)").
  - **Attività senza lavoroId**: solo costi macchine (se `macchinaId`/`attrezzoId` e `oreMacchina`).
  - **Fallback Tariffe Conto Terzi**: quando il costo da operai+macchine è 0, si usa la tariffa dalla sezione Tariffe (tipoLavoro + coltura + tipoCampo). Match come in preventivi: prima specifica per coltura, poi generica per categoria. Costo = tariffaFinale × superficie terreno.
- **Check moduli**: `hasModuleAccess('parcoMacchine')` e `hasModuleAccess('manodopera')` prima di calcolare costi.
- **File**: `modules/conto-terzi/views/terreni-clienti-standalone.html` – funzione `calcCostoAttivita`, `findTariffaPerAttivita`.

---

## ✅ Conto Terzi – Tony pagina Tariffe (2026-03-18) - COMPLETATO

### Obiettivo
Estendere il supporto Tony alla pagina **Tariffe** (Conto terzi): currentTableData per domande sulla lista, FILTER_TABLE per filtri (tipo lavoro, coltura, tipo campo, attive/disattivate).

### Implementazione
- **modules/conto-terzi/views/tariffe-standalone.html**: (1) Placeholder `window.currentTableData` (pageType 'tariffe'). (2) Fallback dopo getDb(). (3) In `renderTariffe(tariffeList)`: build summary (totale tariffe, attive, disattivate), items (tipoLavoro, coltura, tipoCampo, tariffaBase, coefficiente, attiva, tariffaFinale); `window.currentTableData`, `Tony.setContext('page', ...)`, evento `table-data-ready`.
- **core/js/tony/main.js**: pageType da path se contiene "tariffe"; FILTER_KEY_MAP **tariffe**: tipoLavoro → filter-tipo-lavoro, coltura → filter-coltura, tipoCampo → filter-tipo-campo, attiva → filter-attiva; reset filtri per tariffe (select + input).
- **functions/index.js**: FILTRO TABELLA TARIFFE (params: tipoLavoro, coltura, tipoCampo, attiva, reset); LISTA CORRENTE aggiornata con pagina tariffe e items; isTariffePage, isTariffeFilterLikeRequest, tariffeReminder; filterReminder esteso a (isTariffePage && isTariffeFilterLikeRequest).
- **core/services/tony-service.js**: sanitizer per pageType 'tariffe' (items con tipoLavoro, coltura, tipoCampo, tariffaBase, coefficiente, attiva, tariffaFinale).

### Risultato
Sulla pagina Tariffe l'utente può chiedere "quante tariffe?", "quante attive?", "mostrami le tariffe per erpicatura/vigneto", "solo le attive", "tariffe in pianura", "pulisci filtri" e Tony risponde usando la tabella visibile e applica i filtri con FILTER_TABLE.

### Context Builder tariffe da qualsiasi pagina (2026-03-18)
- **functions/index.js**: In **buildContextAzienda** aggiunto fetch `tariffe` (id, tipoLavoro, coltura, categoriaColturaId, tipoCampo, attiva, limite 200); esposti in `ctx.azienda.tariffe`. Istruzioni **TARIFFE (da qualsiasi pagina)**: "Quante tariffe abbiamo?" → conta azienda.tariffe.length; "Quante tariffe attive/disattivate?" → filtra per attiva; se sulla pagina Tariffe usare page.currentTableData, altrimenti azienda.tariffe. **extraBlocks** ELENCO DATI: citati "quante tariffe", "quante tariffe attive". **tariffeReminder**: quando la domanda è sulle tariffe e l'utente non è sulla pagina Tariffe, si inietta reminder per usare azienda.tariffe (conteggio, attive).

### Tony – domande sui costi delle tariffe (2026-03-18)
- **Context Builder**: aggiunti **tariffaBase** e **coefficiente** al fetch tariffe per calcolare tariffaFinale (€/ha).
- **functions/index.js**: Nuova sezione **DOMANDE SUI COSTI DELLE TARIFFE** nelle istruzioni. Tony risponde a domande tipo "Quanto costa aratura nel seminativo in pianura?", "Quanto costa erpicare mais in collina?" da qualsiasi pagina usando azienda.tariffe, azienda.categorie, azienda.colture, azienda.tipiLavoro.
- **Due casi**: (A) Utente dice CATEGORIA (seminativo, vigneto, frutteto) → categoriaId da azienda.categorie. (B) Utente dice COLTURA (mais, grano, albicocche) → cerca in azienda.colture per nome, prendi categoriaId, nome categoria da azienda.categorie.
- **Algoritmo**: tipoCampo (pianura/collina/montagna); tipoLavoro (match flessibile su azienda.tipiLavoro: aratura→Aratura/Erpicatura, diserbare→Diserbo, ecc.); cerca tariffa specifica per coltura (se caso B), altrimenti fallback su tariffa generica (coltura vuota, categoriaColturaId); tariffaFinale = tariffaBase × coefficiente.
- **Fallback coltura (2026-03-18)**: se l'utente chiede tariffa per una COLTURA (mais, albicocche) non presente in tariffe, Tony propone la tariffa generica per la categoria: "Non è presente una tariffa specifica per il [Mais], ma la tariffa generica per il [Seminativo] costa X €/ettaro." (es. mais→Seminativo, albicocche→Frutteto).
- **isTariffeCostQuestion** + **tariffeReminder** potenziato per domande di costo con istruzioni passo-passo; **extraBlocks** ELENCO DATI aggiornato.

---

## ✅ Conto Terzi – Filtro "Categoria lavoro" in Preventivi (2026-03-18) - COMPLETATO

### Obiettivo
Filtrare i preventivi per **categoria della lavorazione** (es. Vendemmia, Potatura, Lavorazione del terreno): l’utente sceglie una categoria e vede tutti i preventivi il cui tipo lavoro appartiene a quella categoria (o alle sue sottocategorie).

### Implementazione
- **modules/conto-terzi/views/preventivi-standalone.html**: (1) Select "Categoria lavoro" (`#filter-categoria-lavoro`) prima di "Tipo lavoro". (2) Variabili `tipiLavoroList`, `categorieLavoriPrincipali`, `sottocategorieLavoriMap`. (3) `loadCategorieETipiLavoro()`: carica categorie con `applicabileA === 'lavori' || 'entrambi'` (principali senza parentId, sottocategorie con parentId) e tipi lavoro da `tenants/{tenantId}/tipiLavoro`. (4) `getTipiLavoroNamesForCategoriaId(catId)`: restituisce i nomi dei tipi lavoro per categoria/sottocategoria. (5) `populateCategoriaLavoroFilter()`: riempie il select con principali + sottocategorie (con "—" per le sottocategorie). (6) In `filterPreventivi()`: se è selezionata una categoria lavoro, si filtra per `preventivo.tipoLavoro` incluso nell’elenco dei tipi di quella categoria (match case-insensitive). (7) Init: chiamata a `loadCategorieETipiLavoro()` e `populateCategoriaLavoroFilter()` dopo load colture/categorie; in `setupFilters()` e `resetFilters()` gestione di `#filter-categoria-lavoro`.
- **core/js/tony/main.js**: FILTER_KEY_MAP preventivi: aggiunto `categoriaLavoro: 'filter-categoria-lavoro'`. Per preventivi, `matchByText` abilitato per `categoriaLavoro` (Tony può inviare il nome categoria, es. "Vendemmia", e il client imposta il select per testo).
- **functions/index.js**: FILTRO TABELLA PREVENTIVI: documentato param `categoriaLavoro` (nome categoria lavorazione: Raccolta, Lavorazione del terreno, Potatura, Trattamenti, ecc.). Regola vendemmia: per "vendemmia"/"vendemmie" usare sempre `categoriaLavoro: "Raccolta"` (Vendemmia è sottocategoria di Raccolta; nel filtro compare solo la categoria principale). Esempi: "fammi vedere le vendemmie" → `categoriaLavoro: "Raccolta"`, risposta "Ecco i preventivi di raccolta (inclusa vendemmia).". Esteso `isPreventiviFilterLikeRequest` per frasi tipo "vendemmie", "potature", "lavorazioni del terreno", "raccolte", "trattamenti".

### Risultato
Sulla pagina Preventivi l’utente può filtrare per categoria lavoro (dropdown) e Tony può applicare lo stesso filtro con "fammi vedere le vendemmie", "solo potature", "lavorazioni del terreno", ecc. tramite FILTER_TABLE con `categoriaLavoro`. **Fix vendemmia (2026-03-18)**: nelle istruzioni CF è stato stabilito che per "vendemmia"/"vendemmie" si usi sempre `categoriaLavoro: "Raccolta"` (Vendemmia è sottocategoria di Raccolta e nel filtro compare solo la categoria principale), con risposta "Ecco i preventivi di raccolta (inclusa vendemmia).".

---

## ✅ Conto Terzi – FILTER_TABLE Clienti e Preventivi (2026-03-18) - COMPLETATO

### Obiettivo
Permettere a Tony di filtrare la tabella quando l'utente è sulla pagina **Clienti** o **Preventivi** (es. "mostrami solo gli attivi", "solo le bozze", "filtra per sospesi", "pulisci filtri") tramite il comando FILTER_TABLE.

### Implementazione
- **core/js/tony/main.js**: (1) Riconoscimento pageType da path: se path contiene "clienti" o "preventivi" usa pageType clienti/preventivi (anche in assenza di currentTableData). (2) FILTER_KEY_MAP: aggiunti clienti (stato → filter-stato, ricerca → filter-search) e preventivi (stato → filter-stato, ricerca → filter-search). (3) Reset filtri: per clienti e preventivi come per attivita si resettano sia select sia input (filter-stato e filter-search).
- **functions/index.js**: (1) System instruction: nuove sezioni "FILTRO TABELLA CLIENTI" e "FILTRO TABELLA PREVENTIVI" con params (stato, ricerca, reset), esempi e valori stato (clienti: attivo|sospeso|archiviato; preventivi: bozza|inviato|accettato_email|accettato_manager|rifiutato|scaduto|pianificato|annullato). (2) LISTA CORRENTE: citato che su pagina clienti/preventivi le richieste di filtro vanno risposte con FILTER_TABLE. (3) filterReminder: aggiunti isClientiFilterLikeRequest e isPreventiviFilterLikeRequest; se (isClientiPage && isClientiFilterLikeRequest) o (isPreventiviPage && isPreventiviFilterLikeRequest) si inietta il reminder per rispondere con JSON FILTER_TABLE.

### Risultato
Sulla pagina Clienti l'utente può dire "solo gli attivi", "sospesi", "archiviati", "pulisci filtri" e Tony applica il filtro; sulla pagina Preventivi "solo le bozze", "inviati", "accettati", "pulisci filtri" con comando FILTER_TABLE.

### Estensione ricerca testuale Clienti (2026-03-18)
- **functions/index.js**: FILTRO TABELLA CLIENTI: esempi per param **ricerca** ("cerca clienti Rossi", "trova Rossi" → params.ricerca); esteso **isClientiFilterLikeRequest** per frasi tipo "cerca clienti", "trova clienti", "clienti con ragione sociale X" così il filter reminder viene iniettato e Tony risponde con FILTER_TABLE anche per ricerca per testo.
- **core/js/tony/main.js**: per FILTER_TABLE, sugli elementi **input** (es. filter-search clienti) viene dispatchato anche l’evento **input** oltre a **change**, così la pagina Clienti che ascolta `input` su filter-search applica correttamente il filtro quando Tony invia `params.ricerca`.

---

## ✅ Conto Terzi – Preventivi e Tony (2026-03-18) - COMPLETATO

### Obiettivo
Estendere il supporto Tony al modulo Conto Terzi per i **preventivi**: rispondere a "Quanti preventivi abbiamo?", "Quanti in bozza/inviati/accettati?", "Quanti preventivi per [cliente]?" da qualsiasi pagina (inclusa Dashboard Conto terzi) e sulla pagina Preventivi usare la tabella visibile.

### Implementazione
- **functions/index.js**: (1) Context Builder: fetch `preventivi` (id, numero, clienteId, stato, limite 200), esposti in `ctx.azienda.preventivi`. (2) System instruction: nuova sezione "PREVENTIVI (da qualsiasi pagina)" con regole per conteggio totale, filtro per stato, conteggio per cliente (match ragioneSociale in azienda.clienti → id → conta preventivi per clienteId). (3) LISTA CORRENTE: citata pagina preventivi con items (numero, cliente, stato, totale). (4) Reminder dinamico: domanda preventivi e pagina Preventivi con currentTableData → reminder usa page; altrimenti se azienda.preventivi presente → reminder usa azienda.preventivi. (5) extraBlocks ELENCO DATI: citati "quanti preventivi", "quanti in bozza/inviati/accettati", "quanti preventivi per [cliente]".
- **modules/conto-terzi/views/preventivi-standalone.html**: placeholder `window.currentTableData` (pageType 'preventivi'); fallback dopo getDb(); in `renderPreventivi`: build summary (conteggi per stato), items (numero, cliente, stato, totale), `window.currentTableData`, `Tony.setContext('page', ...)`, evento `table-data-ready`.
- **core/services/tony-service.js**: sanitizer per `pageType === 'preventivi'` (items con numero, cliente, stato, totale).

### Risultato
Tony risponde alle domande sui preventivi usando `context.azienda.preventivi` da qualsiasi pagina; sulla pagina Gestione Preventivi usa `page.currentTableData` per coerenza con la tabella visibile. **Verificato in uso (2026-03-18)**: funziona correttamente (es. "quanti preventivi?", "quanti in bozza?", "quanti preventivi per [cliente]?" da qualsiasi pagina e dalla lista Preventivi).

---

## ✅ Context Builder – clienti con stato e totaleLavori (2026-03-18) - COMPLETATO

### Obiettivo
Permettere a Tony di rispondere a "Quanti clienti abbiamo?", "Quanti clienti attivi?", "Quanti lavori per [cliente]?" da **qualsiasi pagina** (inclusa Dashboard Conto terzi), senza dipendere solo da currentTableData (che sulla dashboard non è impostato).

### Implementazione
- **functions/index.js**: (1) In `buildContextAzienda`, fetch clienti con campi aggiuntivi: `["id", "ragioneSociale", "stato", "totaleLavori"]`. (2) In SYSTEM_INSTRUCTION_ADVANCED: nuova sezione "CLIENTI (da qualsiasi pagina)" che indica di usare `azienda.clienti` per conteggio totale, filtro stato === "attivo", e totaleLavori per nome cliente; aggiornata la riga "azienda.clienti" in "DOMANDE INFORMATIVE SUI TERRENI" con stato e totaleLavori. (3) Reminder dinamico: se domanda clienti e si è sulla pagina Clienti con currentTableData → reminder usa page; altrimenti se azienda.clienti presente → reminder usa azienda.clienti. (4) extraBlocks ELENCO DATI: citati "quanti clienti", "quanti attivi", "quanti lavori per [cliente]" e azienda.clienti con stato/totaleLavori. (5) **2026-03-18 fix totaleLavori**: in Context Builder viene effettuato anche il fetch della collection `lavori` (solo campo `clienteId`, limite 500); `totaleLavori` per ogni cliente è ricalcolato contando i lavori con quel `clienteId`, così la risposta "quanti lavori per [cliente]?" è corretta anche se il documento cliente non ha mai ricevuto `aggiornaStatisticheCliente`.

### Risultato
Tony risponde alle tre domande usando `context.azienda.clienti` dal Context Builder anche da Dashboard o altre pagine; sulla pagina Clienti può continuare a usare currentTableData per coerenza con la tabella visibile. **Verificato in uso (2026-03-18)**: funziona correttamente (es. "quanti clienti abbiamo?", "quanti lavori per [nome]?" con totaleLavori calcolato dalla collection lavori).

---

## ✅ Tony – currentTableData pagina Clienti (2026-03-18) - COMPLETATO

### Obiettivo
Estendere la lettura tabelle di Tony alla lista Clienti (Conto terzi) così Tony può rispondere a domande tipo "Quanti clienti?", "Cosa c'è in lista?", "Quanti attivi?" quando l'utente è sulla pagina Clienti.

### Implementazione
- **modules/conto-terzi/views/clienti-standalone.html**: (1) Placeholder in testa: `window.currentTableData = { pageType: 'clienti', summary: 'Caricamento dati in corso...', items: [] }`. (2) Fallback all'inizio del modulo dopo getDb(). (3) In `renderClienti(clientiList)`: blocco currentTableData all'inizio (prima del check lista vuota): summary con conteggio totale e per stato (attivi, sospesi, archiviati), items con ragioneSociale, partitaIva, email, telefono, stato, totaleLavori; `window.Tony.setContext('page', ...)`; `dispatchEvent('table-data-ready', ...)`.

### Risultato
Sulla pagina Clienti Tony riceve il contesto della tabella e può rispondere in base a `page.tableDataSummary` e `page.currentTableData`. Prossimi passi: stesso pattern per Preventivi, Vigneti, Frutteti, ecc.; FILTER_TABLE per Clienti (opzionale) richiederebbe FILTER_KEY_MAP clienti in main.js e istruzioni in functions.

### Fix CF (stesso giorno)
- **functions/index.js**: aggiunta regola "LISTA CORRENTE (page.currentTableData)" in SYSTEM_INSTRUCTION_ADVANCED: per qualsiasi pagina con tabella (clienti, prodotti, movimenti, …), se `page.currentTableData` è presente, usare sempre `page.tableDataSummary` e `page.currentTableData.items` per domande tipo "quanti X?", "quanti sono attivi?", "quanti sospesi?"; non rispondere "non ho dati sullo stato" se i dati sono in currentTableData. Risolve il caso "quanti sono attivi?" sulla pagina Clienti.

---

## ✅ Responsive centralizzato – Fase A (2026-03-18) - COMPLETATO

### Obiettivo
Avviare il sistema responsive condiviso per le pagine standalone: CSS centralizzato, pagina pilota collegata, linea guida con istruzioni d’uso.

### Implementazione
- **core/styles/responsive-standalone.css**: nuovo foglio con solo media query (1024, 768, 480) e regole per `.container`, `.content`, `.header`, `.header-actions`, `.filters`, `.stats-grid`, `.table-responsive`, `.form-row`, `.action-buttons`, `.modal-content`, `.section-header`. Nessuno stile di base (colori/font) per non sovrascrivere le singole pagine.
- **core/admin/gestione-lavori-standalone.html**: aggiunto `<link rel="stylesheet" href="../styles/responsive-standalone.css">`; aggiunta classe `table-responsive` al div `#lavori-container`; rimosse le media query 768/480 duplicate (ora lette dal CSS condiviso).
- **docs-sviluppo/LINEA_GUIDA_RESPONSIVE_STANDALONE.md**: aggiunta sezione §6 "Come usare il sistema" con path del file, come includerlo, struttura HTML e classe `table-responsive`, e indicazione della pagina pilota (Gestione Lavori).

### Risultato
Gestione Lavori usa il responsive dal foglio condiviso; aspetto e funzionalità invariati. Prossimi passi (Fase B): collegare Dashboard, Terreni, Gestione Macchine allo stesso CSS e rimuovere duplicati.

---

## ✅ Responsive centralizzato – Fase B (2026-03-18) - COMPLETATO

### Obiettivo
Collegare Dashboard, Terreni e Gestione Macchine al CSS condiviso e rimuovere le media query duplicate.

### Implementazione
- **core/styles/responsive-standalone.css**: aggiunte regole per la Dashboard (`.dashboard-container`, `.dashboard-header`, `.dashboard-content`, `.quick-actions`, `.action-card`, `.header-actions` dentro dashboard, `.user-info`, `.logout-button`) nei breakpoint 768px e 480px, così una sola fonte per tutto il responsive delle pagine core.
- **core/dashboard-standalone.html**: aggiunto `<link rel="stylesheet" href="styles/responsive-standalone.css">`.
- **core/styles/dashboard.css**: rimosso il blocco `@media (max-width: 768px)` e `@media (max-width: 480px)` (padding, header, stats-grid, header-actions, pulsanti); sostituito con commento che rimanda a `responsive-standalone.css`.
- **core/terreni-standalone.html**: aggiunto `<link rel="stylesheet" href="./styles/responsive-standalone.css">`; rimosso il secondo `@media (max-width: 768px)` che conteneva solo `.header` e `.modal-content` (ora nel CSS condiviso). Mantenuto il primo `@media 768` per `.terreni-header` / `.terreno-row` (layout a card specifico).
- **core/admin/gestione-macchine-standalone.html**: aggiunto `<link rel="stylesheet" href="../styles/responsive-standalone.css">`; aggiunta classe `table-responsive` al div `#macchine-container`; rimosso l’intero `@media (max-width: 768px)` (tabella, filtri, form-row, action-buttons ora dal CSS condiviso).

### Risultato
Le quattro pagine core (Dashboard, Terreni, Gestione Lavori, Gestione Macchine) usano tutte `responsive-standalone.css`; comportamento e aspetto invariati. Prossimo passo (Fase C): estendere ai moduli (Vigneto, Frutteto, Conto terzi, Magazzino, ecc.).

---

## ✅ Responsive centralizzato – Fase C (2026-03-18) - COMPLETATO

### Obiettivo
Estendere il CSS condiviso alle home e alle liste dei moduli (Vigneto, Frutteto, Conto terzi, Magazzino, Parco Macchine).

### Implementazione
- **Home moduli** (link a `../../../core/styles/responsive-standalone.css` + rimozione @media 768 duplicate):  
  `conto-terzi-home-standalone.html`, `magazzino-home-standalone.html`, `vigneto-dashboard-standalone.html`, `frutteto-dashboard-standalone.html`, `macchine-dashboard-standalone.html` (modules/macchine).
- **Liste con tabelle** (link + classe `table-responsive` sul container):  
  Conto terzi: `clienti-standalone.html`, `preventivi-standalone.html`.  
  Magazzino: `prodotti-standalone.html`, `movimenti-standalone.html`.  
  Vigneto: `vigneti-standalone.html` (.table-container).  
  Frutteto: `frutteti-standalone.html` (.table-container).  
  Parco Macchine: `flotta-list-standalone.html`, `trattori-list-standalone.html`, `attrezzi-list-standalone.html`, `guasti-list-standalone.html`, `scadenze-list-standalone.html` (id="table-container").

### Risultato
Tutte le home e le principali liste dei moduli usano il responsive condiviso; aspetto e funzionalità invariati. Le nuove standalone da sviluppare possono includere `responsive-standalone.css` e la classe `table-responsive` dove serve.

---

## ✅ Responsive centralizzato – Priorità alta e media (2026-03-18) - COMPLETATO

### Obiettivo
Collegare al CSS condiviso le pagine ad alta priorità (diario, segnatura ore, impostazioni, gestione operai/squadre, nuovo preventivo, guasti, validazione ore) e a priorità media (vendemmia, potatura, trattamenti, raccolta frutta, tariffe, terreni clienti, lavori caposquadra).

### Implementazione
- **Priorità alta**: `attivita-standalone.html` (Diario), `segnatura-ore-standalone.html`, `impostazioni-standalone.html`, `gestione-operai-standalone.html`, `gestione-squadre-standalone.html`, `nuovo-preventivo-standalone.html`, `segnalazione-guasti-standalone.html`, `validazione-ore-standalone.html`, `gestione-guasti-standalone.html`. Aggiunto `<link>` a `responsive-standalone.css`; rimosse o ridotte @media 768 duplicate; aggiunta classe `table-responsive` ai container tabella dove presente (operai, squadre, ore, lavori segnatura ore, lavori caposquadra, guasti-list).
- **Priorità media**: `vendemmia-standalone.html`, `potatura-standalone.html` (vigneto e frutteto), `trattamenti-standalone.html` (vigneto e frutteto), `raccolta-frutta-standalone.html`, `tariffe-standalone.html`, `terreni-clienti-standalone.html`, `lavori-caposquadra-standalone.html`. Stesso schema: link al CSS condiviso, rimozione @media duplicate (salvo regole specifiche come `.terreni-grid`, `.lavoro-info`), `table-responsive` su tariffe-container e lavori-container.

### Risultato
Altre ~20 pagine usano il responsive condiviso.

---

## ✅ Responsive centralizzato – Tutte le pagine (2026-03-18) - COMPLETATO

### Obiettivo
Collegare al CSS condiviso tutte le pagine standalone rimanenti per coerenza completa: grafici/statistiche, report, amministrazione, auth, mappe, accetta preventivo, calcolo materiali, pianifica impianto.

### Implementazione
Aggiunto `<link rel="stylesheet" href=".../responsive-standalone.css">` (path adeguato per core/, core/admin/, core/auth/, modules/.../views/) a: **core** `statistiche-standalone.html`; **core/admin** `report-standalone.html`, `amministrazione-standalone.html`, `compensi-operai-standalone.html`, `statistiche-manodopera-standalone.html`, `abbonamento-standalone.html`, `gestisci-utenti-standalone.html`; **core/auth** `login-standalone.html`, `registrazione-standalone.html`, `registrazione-invito-standalone.html`, `reset-password-standalone.html`; **modules** `vigneto-statistiche-standalone.html`, `frutteto-statistiche-standalone.html`, `mappa-clienti-standalone.html`, `accetta-preventivo-standalone.html`, `calcolo-materiali-standalone.html`, `pianifica-impianto-standalone.html`; **modules/report** `report-standalone.html`.

### Risultato
Tutte le pagine standalone dell’app includono il responsive condiviso; comportamento e grafici/report restano invariati e potranno essere modificati in seguito senza conflitti.

---

## ✅ Tour interattivi disabilitati a livello piattaforma (2026-03-18) - COMPLETATO

### Obiettivo
Disabilitare il tour (inibizione) su tutte le pagine senza rimuovere codice: soluzione semplice e reversibile.

### Implementazione
- **core/styles/tour.css**: regola che nasconde i pulsanti tour (`#dashboard-tour-button`, `#terreni-tour-button`, `#macchine-tour-button`, `#lavori-tour-button`) con `display: none !important`.
- **Flag globale**: nelle 4 pagine con tour (dashboard, terreni, gestione-macchine, gestione-lavori) e in `terreni-test-bootstrap.html` è impostato in `<head>`: `<script>window.GFV_TOUR_DISABLED = true;</script>`.
- **Moduli tour** (`dashboard-tour.js`, `terreni-tour.js`, `gestione-macchine-tour.js`, `gestione-lavori-tour.js`): all’inizio di `setup*` e `maybeAutoStart*` è stato aggiunto il controllo `if (window.GFV_TOUR_DISABLED) return;` così non viene eseguito né il setup del pulsante né l’auto-avvio.

### Risultato
Tour non visibile e non avviabile. Per riattivarlo: rimuovere il flag dalle pagine (o impostare `GFV_TOUR_DISABLED = false`) e rimuovere/commentare la regola in `tour.css`.

---

> **Nota architettura Tony (2026-02)**: `tony-widget-standalone.js` è ora un loader snello; la logica è in `core/js/tony/` (main.js orchestratore, ui.js FAB/chat/dialog, engine.js mappe e resolve, voice.js TTS). I riferimenti storici a "tony-widget-standalone.js" nei paragrafi sotto indicano il sistema widget nel suo insieme; le funzioni menzionate risiedono in `tony/main.js` e moduli collegati.

## ✅ Tony Lavori: no "Vuoi che salvi?" al primo messaggio se mancano trattore/attrezzo (2026-03-14) - COMPLETATO

### Obiettivo
Al primo messaggio (open_modal + formData) per un lavoro meccanico, se in formData non ci sono ancora lavoro-trattore e lavoro-attrezzo, il replyText non deve contenere "Vuoi che salvi il lavoro?"; deve chiedere solo trattore/attrezzo (es. "Quale trattore e attrezzo prevedi di usare?").

### Implementazione
- **functions/index.js** (SYSTEM_INSTRUCTION_LAVORO_STRUCTURED):
  - **PRIMO MESSAGGIO (open_modal)**: se tipo lavoro è MECCANICO e in formData non ci sono sia lavoro-trattore sia lavoro-attrezzo, replyText non deve mai contenere "Vuoi che salvi il lavoro?" o "confermi salvataggio?"; chiedere solo trattore/attrezzo. La domanda di salvataggio solo quando il form è completo.
  - Regola generale replyText: se open_modal/fill_form, tipo MECCANICO e in formData mancano lavoro-trattore o lavoro-attrezzo, replyText non deve contenere "Vuoi che salvi?"; chiedere solo ciò che manca.

### Risultato
- Primo messaggio tipo "Ho creato un lavoro di Trinciatura Kaki... Quale trattore e attrezzo prevedi di usare?" senza "Vuoi che salvi il lavoro?". La richiesta di salvataggio compare solo dopo che l'utente ha indicato trattore/attrezzo (o quando il lavoro non è meccanico).

---

## ✅ Tony Lavori: form già aperto no open_modal/re-inject + no "Quale attrezzo?" se compilato o unico (2026-03-14) - COMPLETATO

### Obiettivo
Con modal lavoro già aperto non riaprire il modal né ri-iniettare tutto il form (evitare doppia iniezione dopo messaggio proattivo). Non chiedere "Quale attrezzo?" se in formSummary l'attrezzo è già ✓ o se c'è un solo attrezzo compatibile (l'injector lo compila).

### Implementazione
- **functions/index.js** (SYSTEM_INSTRUCTION_LAVORO_STRUCTURED):
  - **STATO MODAL**: Se `form.formId === "lavoro-form"` (modal già aperto) è **vietato** emettere action `open_modal`. Rispondere solo con `ask` (replyText con domanda) o `fill_form` con **solo** i campi nuovi (es. solo lavoro-trattore + lavoro-attrezzo se l'utente dice "agrifull" e c'è un solo attrezzo). Per messaggi proattivi ("Form aperto con campi mancanti", "Mancano solo trattore e attrezzo"): rispondere con action `ask` e replyText con la domanda (es. "Quale trattore? ..."); **non includere formData** (formData vuoto `{}`) così il client non esegue INJECT.
  - **PRIORITÀ requiredEmpty**: Se requiredEmpty è vuoto, non emettere fill_form con molti campi; non emettere open_modal se form è già aperto. Se si deve solo chiedere (es. "Quale trattore?") rispondere con action `ask` e replyText, senza formData e senza open_modal.
  - **Attrezzo**: Se in formSummary lavoro-attrezzo ha ✓, non scrivere mai "Quale attrezzo?" in replyText. Quando l'utente nomina solo il trattore (es. "agrifull") e c'è un solo attrezzo compatibile: mettere in formData sia lavoro-trattore sia lavoro-attrezzo e replyText "Configuro le macchine." o "Trattore e attrezzo impostati."; mai "Quale attrezzo?".

### Risultato
- Alla risposta al reminder proattivo la CF restituisce solo `ask` con testo (formData vuoto), quindi nessun OPEN_MODAL né INJECT; niente doppia iniezione. Tony non chiede l'attrezzo se è già compilato o se è unico (compilato dall'injector o dalla CF in un colpo solo).

---

## ✅ Tony: muto durante iniezione + replyText senza domande quando form completo (2026-03-14) - COMPLETATO

### Obiettivo
Evitare sovrapposizione tra Timer Proattivo (idle), domande della CF e attività dell'Injector: niente messaggi doppi o inutili durante l'iniezione; quando requiredEmpty è vuoto o si stanno inferendo le macchine, risposta solo comando + testo breve di conferma; niente domanda sul nome se già in formData.

### Implementazione
- **core/js/tony/main.js** (muto durante INJECT):
  - All'avvio di INJECT_FORM_DATA: cancellazione di `__tonyProactiveAskTimerId` e `__tonyIdleReminderTimerId`, azzeramento di `__tonyProactiveFormState`, flag `__tonyInjectionInProgress = true`. Il timer proattivo non parte durante l'iniezione e si resetta a ogni nuovo avvio INJECT.
  - Alla scadenza dell'idle (lavoro e attività): se `__tonyInjectionInProgress` è true, il callback non esegue (nessun messaggio automatico durante iniezione).
  - Alla fine dell'iniezione (`.then(ok)`): `__tonyInjectionInProgress = false`; poi avvio post-inject delay e idle come prima. Stesso comportamento per attivita-form; flag resettato anche in casi di break (modal non aperto, formId non supportato, formData vuoto).
- **functions/index.js** (verifica reale pre-domanda + priorità injector + no domanda nome):
  - **VERIFICA REALE PRE-DOMANDA**: se `requiredEmpty` è vuoto, è vietato inviare replyText con domande ("quale?", "vuoi?", "come vuoi chiamare?", "quale trattore/attrezzo?"). Solo testo brevissimo di conferma: "Configuro le macchine.", "Lavoro pronto.", "Salvo il lavoro.", "Fatto!".
  - Se formData include lavoro-trattore/lavoro-attrezzo (anche dedotti): replyText solo conferma ("Configuro le macchine."); mai chiedere l'attrezzo in chat se è unico o se lo stai già mettendo in formData (priorità all'inferenza dell'injector).
  - Se formData contiene **lavoro-nome**: replyText non deve mai contenere "Come vuoi chiamare il lavoro?" o simili.
  - Eccezione requiredEmpty vuoto: consentito fill_form con solo lavoro-trattore e lavoro-attrezzo (dedotti) e replyText "Configuro le macchine.". Punto 3 COMPORTAMENTO PROATTIVO: non suggerire "Come vuoi chiamare questo lavoro?" in replyText se lavoro-nome è già in formData.

### Risultato
- Durante l'iniezione nessun messaggio automatico del timer; timer resettato a ogni INJECT. Con form completo o solo macchine da inferire, la CF risponde con comando (inject/save) e testo breve, senza domande. Niente domanda sull'attrezzo se unico o in formData; niente "Come vuoi chiamare il lavoro?" se il nome è già in formData.

---

## ✅ Tony: messaggi proattivi (timer) non in chat – solo risposta Tony (2026-03-14) - COMPLETATO

### Obiettivo
I messaggi inviati in automatico dal timer proattivo (es. "Mancano solo trattore e attrezzo...", "Form completo, confermi salvataggio?") non devono apparire in chat come se li avesse scritti l'utente; devono restare un "pensiero" interno che attiva la CF. In chat si vede solo la risposta di Tony.

### Implementazione
- **core/js/tony/main.js**:
  - `sendMessage(overrideText, opts)`: nuova opzione `opts.proactive`. Se `proactive: true`, non si aggiunge il testo come messaggio utente (`appendMessage(text, 'user')`) e non si svuota l'input; il testo viene solo usato per la richiesta alla CF e in chat compare solo la risposta di Tony.
  - `__tonyTriggerAskForMissingFields` e `__tonyTriggerAskForSaveConfirmation` chiamano `sendMessage(..., { proactive: true })`.

### Risultato
- Quando scatta il timer di inattività, la domanda proattiva non viene mostrata in chat; l'utente vede solo la risposta di Tony (es. "Configuro le macchine.", "Vuoi che salvi il lavoro?"). Niente più doppie bolle (messaggio automatico + risposta).

---

## ✅ Tony Lavori: chiedere trattore se 2+ compatibili + save solo dopo conferma esplicita (2026-03-14) - COMPLETATO

### Obiettivo
Con più trattori compatibili Tony deve chiedere quale usare (non compilare a caso). Salvataggio solo dopo conferma esplicita dell'utente ("salva", "sì", "conferma"); il messaggio "Form completo, confermi salvataggio?" (timer) non deve essere interpretato come conferma.

### Implementazione
- **functions/index.js** (SYSTEM_INSTRUCTION_LAVORO_STRUCTURED):
  - **TRATTORE**: Se in azienda.trattori ci sono 2 o più trattori (o 2+ compatibili con l'attrezzo), NON mettere lavoro-trattore in formData; rispondere con action "ask" e replyText "Quale trattore vuoi usare? [elenco nomi]". Compilare lavoro-trattore SOLO se c'è UN SOLO trattore compatibile.
  - **Save solo dopo conferma**: Emettere action "save" SOLO se il messaggio utente è conferma esplicita ("salva", "sì", "conferma", "ok salva", "sì salva"). Se il messaggio è "Form completo, confermi salvataggio?" o "Form aperto con campi mancanti" (reminder timer), rispondere con action "ask" e replyText "Vuoi che salvi il lavoro?", MAI action "save". Regola 10 e MESSAGGIO DOPO SALVATAGGIO aggiornate di conseguenza.

### Risultato
- Con più trattori Tony chiede "Quale trattore vuoi usare? Agrifull, ..." e non compila da solo. Il salvataggio avviene solo quando l'utente scrive "salva" (o equivalente), non quando scatta il timer "Form completo, confermi salvataggio?".

---

## ✅ Tony Lavori: non chiedere campi già compilati + deduzione un solo attrezzo/trattore (2026-03-14) - COMPLETATO

### Obiettivo
Evitare che Tony chieda trattore/attrezzo quando sono già in formSummary (✓) e, quando nel parco macchine c'è un solo attrezzo (es. una sola trincia) o un solo trattore compatibile, compilarlo direttamente senza chiedere.

### Implementazione
- **functions/index.js** (SYSTEM_INSTRUCTION_LAVORO_STRUCTURED):
  - **NON CHIEDERE CAMPI GIÀ COMPILATI**: prima di chiedere "quale trattore/attrezzo?" controllare sempre formSummary; se lavoro-trattore, lavoro-attrezzo o lavoro-operatore-macchina hanno ✓, non chiedere quel campo.
  - **DEDUZIONE UN SOLO MEZZO**: usare azienda.trattori e azienda.attrezzi; filtrare attrezzi per tipo lavoro (Trinciatura→trincia, Erpicatura→erpice, Pre-potatura→potat, ecc.). Se un solo attrezzo compatibile → metterlo in formData con action fill_form e non chiedere. Stessa regola per un solo trattore (o un solo compatibile con l'attrezzo). Chiedere solo quando ci sono 2+ opzioni.
  - Regola "requiredEmpty vuoto + tipo meccanico + macchine vuote" aggiornata: prima applicare deduzione; se dopo deduzione non manca nulla → chiedere solo conferma salvataggio; altrimenti chiedere solo ciò che manca.
  - TRIGGER "Form aperto" allineato: non chiedere campi con ✓; applicare deduzione prima di ask.

### Risultato
- Tony non ripete domande su trattore/attrezzo già compilati; con un solo mezzo in parco lo imposta direttamente (es. una trincia → compilata senza chiedere "quale trincia?").

---

## ✅ Tony Lavori: stop loop iniezione + domanda macchine + no save senza macchine (2026-03-14) - COMPLETATO

### Obiettivo
Evitare che Tony, dopo il reminder "campi mancanti", ri-inietti tutto il form (loop), chieda il nome già compilato, o emetta save con trattore/attrezzo vuoti per lavori meccanici.

### Implementazione
- **functions/index.js** (SYSTEM_INSTRUCTION_LAVORO):
  - **Stop loop**: se `requiredEmpty` è vuoto, NON emettere mai `fill_form` né formData (evita ri-compilazione e reset).
  - **Macchine prima di save**: se requiredEmpty vuoto ma tipo meccanico e lavoro-trattore/lavoro-attrezzo vuoti → rispondere SOLO con action "ask" e replyText che chiede quale trattore e attrezzo; NON formData, NON save.
  - **Save solo se ok**: save consentito solo se (tipo non meccanico O macchine compilate O utente ha detto "no macchine"). Mai save se tipo meccanico e trattore/attrezzo vuoti (salvo utente esplicito "salva così").
  - **Trigger "Form aperto con campi mancanti"**: quando il messaggio è di quel tipo e form è lavoro-form, se requiredEmpty vuoto ma macchine vuote e tipo meccanico → solo ask con domanda macchine; non chiedere campi già con ✓.
- **core/js/tony/main.js**:
  - Stato proattivo lavoro: aggiunto `needsMacchineOnly: true` quando `!hasRequiredEmpty && needsMacchine`.
  - Alla scadenza idle, se `state.needsMacchineOnly` → invio messaggio specifico: "Mancano solo trattore e attrezzo per questo lavoro meccanico. Quale trattore e erpice vuoi usare?" invece del generico "Form aperto con campi mancanti da compilare".
  - `__tonyTriggerAskForMissingFields(optionalMessage)`: accetta messaggio opzionale per guidare la CF.

### Risultato
- Nessun loop INJECT dopo il reminder; Tony chiede solo trattore/attrezzo (o "confermi salvataggio?" se form completo); nessun save con macchine vuote per lavori meccanici.

---

## ✅ Tony: timer proattivo form (check post-inject + reminder inattività) (2026-03-14) - COMPLETATO

### Obiettivo
Riordinare il flusso reminder: dopo l'iniezione dare tempo al form di stabilizzarsi, fare un check per sapere cosa chiedere in caso di inattività, poi avviare il timer di inattività. Se l'utente sta zitto, Tony ricorda campi mancanti oppure conferma salvataggio.

### Implementazione
- **core/js/tony/main.js**:
  - Costanti: `POST_INJECT_CHECK_DELAY_MS` (2800 ms), `IDLE_REMINDER_MS` (7000 ms).
  - Dopo INJECT_FORM_DATA (lavoro-form e attivita-form): si cancella eventuale timer idle precedente; si avvia un solo timer di ritardo (post-inject). Alla scadenza: check con `getCurrentFormContext()` (requiredEmpty; per lavoro-form anche needsMacchine). Stato salvato in `window.__tonyProactiveFormState` (type: `ready_for_save` | `missing_fields`, formId, modalId). Poi parte il timer di inattività (`__tonyIdleReminderTimerId`). Alla scadenza dell'idle: se modal ancora aperto, si invoca il trigger corretto (AskForSaveConfirmation o AskForMissingFields) e si azzera lo stato.
  - In `sendMessage`: si cancellano sia il timer post-inject sia il timer idle e si azzera `__tonyProactiveFormState`, così ogni nuovo messaggio utente resetta il flusso; dopo una risposta e un eventuale nuovo INJECT il ciclo riparte (delay → check → idle).

### Risultato
- Flusso: iniezione → ~2,8 s stabilizzazione → check → stato salvato → 7 s inattività → reminder (campi mancanti o "confermi salvataggio?"). Se l'utente scrive/parla prima, timer e stato si azzerano.

---

## ✅ Tony Lavori: parità proattività con Attività (2026-03-08) - COMPLETATO

### Obiettivo
Form Lavori non proattivo: non compilava tutto in un colpo, non chiedeva cosa serviva. Allineare al comportamento Attività.

### Implementazione
- **functions/index.js**:
  - COMPORTAMENTO PROATTIVO per Lavori: compila tutto in un colpo, chiedi il resto in replyText, CHECKLIST prima di fill_form.
  - OPEN_MODAL con formData: quando action "open_modal", passa formData come `fields` nel comando (client li inietta dopo apertura).
  - useStructuredFormOutput esteso: anche quando utente su pagina lavori con intent "crea lavoro" e modal chiuso → usa istruzione Lavori con form sintetico.
  - MODAL CHIUSO in SYSTEM_INSTRUCTION_LAVORO: se form null, rispondi open_modal + formData completo.
  - OPEN_MODAL CHECKLIST LAVORI nella regola generica.
- **main.js**: generateFormSummary: pattern placeholder esteso per "-- Seleziona categoria/tipo" (no ✓ su select con placeholder).

### Risultato
- "Crea lavoro erpicatura nel Sangiovese" → OPEN_MODAL con fields completi (nome, terreno, categoria, sottocategoria, tipo, data, durata, stato).
- Form aperto: compila tutto inferibile + chiedi in replyText il prossimo dato mancante.
- formSummary corretto: no ✓ su placeholder.

---

## ✅ Tony: regole CF, formSummary, deriveParents (2026-03-08) - COMPLETATO

### Obiettivo
Risolvere: Tony chiede sottocategoria anche con form completo; messaggio varietà usato per lavori normali; formSummary con ✓ su placeholder; disambiguazione tipo lavoro senza terreno.

### Implementazione
- **main.js**: `getCurrentFormContext` ora include `requiredEmpty` (array ID campi required vuoti) nel contesto inviato alla CF. `generateFormSummary`: non mettere ✓ su SELECT con displayVal che matcha placeholder (Seleziona..., -- Nessuna --, ecc.).
- **functions/index.js**: PRIORITÀ ASSOLUTA per Attività e Lavori: se `form.requiredEmpty` vuoto → action "save" senza altre domande. MESSAGGIO VARIETÀ: frase "Completa manualmente dettagli tecnici (varietà, distanze)" SOLO per Impianto Nuovo Vigneto/Frutteto. SOTTOCATEGORIA PER CATEGORIA: Potatura → Manuale/Meccanico; Lavorazione terreno → Tra le File/Sulla Fila/Generale.
- **tony-form-injector.js**: `deriveParentsFromTipoLavoro(tipoNome, context, formData)`: quando ci sono più match (es. Erpicatura vs Erpicatura Tra le File), usa `formData['lavoro-terreno']` per disambiguare: terreno con filari (Vite/Frutteto/Olivo) → preferisce tipo "Tra le File"/"Sulla Fila"; Seminativo → preferisce tipo senza.

### Risultato
- Form completo (requiredEmpty vuoto) → Tony salva senza chiedere.
- formSummary corretto: no ✓ su select con placeholder.
- Messaggio varietà solo per Impianti.
- Disambiguazione Erpicatura/Trinciatura corretta in base al terreno.

---

## ✅ Form Lavori: allineamento injector ad Attività (2026-03-08) - COMPLETATO

### Obiettivo
Risolvere problemi di compilazione form lavori: terreno non applicato (ID non nelle options), sottocategoria/tipo non popolati in tempo, ordine iniezione incoerente con Attività.

### Implementazione
- **tony-form-mapping.js**: `injectionOrder` per LAVORO_FORM_MAP: `lavoro-terreno` spostato subito dopo `lavoro-nome`, prima di categoria/sottocategoria/tipo (come Attività: terreno prima dei dropdown dipendenti).
- **tony-form-injector.js**:
  - `waitForSelectOptions` per `lavoro-sottocategoria` e `lavoro-tipo-lavoro` prima di `setFieldValue` (come per `attivita-sottocategoria`).
  - `setSelectValue` per `lavoro-terreno`: match parziale su `option.text` (formato "nome (X Ha)") quando value non è nelle options; se value è ID non presente, lookup in `lavoriState.terreniList` per nome e match per nome.
- **DELAYS_LAVORO**: `lavoro-terreno` 500 ms.

### Risultato
- Terreno applicato correttamente anche quando ID non presente nelle options (match per nome).
- Sottocategoria e tipo lavoro popolati prima dell'iniezione grazie a `waitForSelectOptions`.
- Ordine iniezione coerente con Attività: terreno → categoria → sottocategoria → tipo.

---

## ✅ Tony: Entry Point "Crea lavoro" da ovunque (2026-03-08) - COMPLETATO

### Obiettivo
Parità con Attività: quando l'utente dice "Crea un lavoro di erpicatura nel Sangiovese" (o simile) da qualsiasi pagina (es. Dashboard), Tony deve aprire il modal Crea Lavoro su Gestione Lavori e compilare i campi inferibili.

### Implementazione
- **functions/index.js**: ENTRY POINT CREA LAVORO aggiunto. Se l'utente vuole creare un nuovo lavoro (es. "crea un lavoro", "nuovo lavoro", "crea lavoro di erpicatura nel Sangiovese") e form.formId ≠ "lavoro-form", usa OPEN_MODAL id "lavoro-modal" con fields. Text: "Ti porto a gestione lavori."
- Regola 5: se form.formId === "lavoro-form" (form già aperto), usa INJECT_FORM_DATA.
- Esempi aggiunti: "Crea un lavoro", "Crea un lavoro di erpicatura nel Sangiovese", "Nuovo lavoro potatura nel Pinot assegnato a Luca".

### Risultato
- "Crea un lavoro di erpicatura nel Sangiovese" da Dashboard → Tony naviga a gestione lavori, apre modal, compila terreno, tipo, sottocategoria, ecc.
- Flusso simmetrico a "Ho trinciato 6 ore" → attivita-modal.

---

## ✅ Gestione Lavori: currentTableData + FILTER_TABLE Tony (2026-03-08) - COMPLETATO

### Obiettivo
Estendere `currentTableData` e `FILTER_TABLE` alla pagina Gestione Lavori, permettendo a Tony di leggere i dati della lista e filtrare per stato, progresso, caposquadra, terreno, tipo.

### Implementazione

#### 1. Placeholder e fallback (gestione-lavori-standalone.html)
- Script placeholder: `window.currentTableData = { pageType: 'lavori', summary: 'Caricamento dati in corso...', items: [] }` prima del modulo.
- Fallback IIFE all'inizio del modulo se `summary` vuoto.

#### 2. Blocco currentTableData (gestione-lavori-controller.js, renderLavori)
- Summary: "Nessun lavoro in elenco." oppure "Ci sono N lavori in elenco."
- Items: id, nome, terreno, stato, tipo, caposquadra (da terreniList e caposquadraList).
- Chiamate: `setContext`, `__tonyTableDataBuffer`, evento `table-data-ready`.

#### 3. FILTER_TABLE (main.js)
- Mappa `pageType → keyToId` estesa con `lavori`: stato, progresso, caposquadra, terreno, tipo.
- `pageType` da `window.currentTableData?.pageType` o path (gestione-lavori, lavori).
- matchByText per terreno e caposquadra (nomi dinamici).
- Logica pageType esplicita (non più binaria attivita/terreni).

#### 4. Istruzioni Cloud Function (functions/index.js)
- ECCEZIONE LAVORI: se già su gestione-lavori e l'utente chiede di filtrare, usare FILTER_TABLE invece di APRI_PAGINA.
- Sezione FILTRO TABELLA LAVORI: params (stato, progresso, caposquadra, terreno, tipo), mappature linguaggio naturale, esempi.
- filterReminder: aggiunto `isLavoriPage` e `isLavoriFilterLikeRequest` per iniezione prompt.

### File toccati
- `core/admin/gestione-lavori-standalone.html` (placeholder)
- `core/admin/js/gestione-lavori-controller.js` (renderLavori)
- `core/js/tony/main.js` (FILTER_TABLE, FILTER_KEY_MAP lavori)
- `functions/index.js` (ECCEZIONE LAVORI, FILTRO TABELLA LAVORI, filterReminder)
- `docs-sviluppo/RIEPILOGO_CURRENTTABLEDATA_PER_MODULO_LISTE.md`
- `docs-sviluppo/tony/STATO_ATTUALE.md`

### Risultato
- Tony può filtrare la lista lavori per stato ("lavori in corso"), progresso ("in ritardo"), terreno ("nel Sangiovese"), caposquadra, tipo (interni/conto terzi).
- Coerenza con pattern terreni/attivita; scalabile ad altre pagine lista.

---

## ✅ Gestione Lavori: filtri tipo lavoro e operaio (2026-03-08) - COMPLETATO

### Obiettivo
Aggiungere filtri per **tipo lavoro** (vendemmia, erpicatura, potatura, ecc.) e **operaio** alla pagina Gestione Lavori, risolvendo il problema per cui Tony rispondeva "Ecco le vendemmie" senza applicare alcun filtro.

### Implementazione

#### 1. Nuovi filtri HTML (gestione-lavori-standalone.html)
- `filter-tipo-lavoro`: select popolato da tipiLavoroList
- `filter-operaio`: select popolato da operaiList (visibile solo con modulo Manodopera)

#### 2. Controller (gestione-lavori-controller.js)
- `populateTipoLavoroFilter(tipiLavoroList)`: popola select con value=nome
- `populateOperaioFilter(operaiList)`: popola select con value=id
- `loadTipiLavoro`: callback `populateTipoLavoroFilterCallback` per popolare filtro
- `loadOperai`: callback `populateOperaioFilter` per popolare filtro
- `setupManodoperaVisibility`: nasconde filter-operaio quando Manodopera non attivo
- `currentTableData` items: aggiunti `tipoLavoro`, `operaio`; `tipo` ora indica interno/conto_terzi

#### 3. Logica filtri (gestione-lavori-events.js)
- `applyFilters`: tipoLavoro (match su tipoLavoro, tipoLavoroNome, categoriaLavoroNome), operaio (solo con Manodopera)
- `clearFilters`: reset filter-tipo-lavoro, filter-operaio
- **Fix match filtro tipo lavoro**: match case-insensitive; supporto nomi parziali (es. "Trinciatura" matcha "Trinciatura tra le file"); risoluzione `tipoLavoroId` tramite `tipiLavoroList`; `applyFilters` riceve `tipiLavoroList` come 5° parametro

#### 4. Tony FILTER_TABLE (main.js, functions/index.js)
- keyToId lavori: tipoLavoro→filter-tipo-lavoro, operaio→filter-operaio
- matchByText per tipoLavoro e operaio (nomi dinamici)
- Istruzioni CF: mappature "vendemmie"→tipoLavoro: "Vendemmia", "lavori di Pier"→operaio
- filterReminder: aggiunti vendemmi, erpicatur, potatur, operaio

### File toccati
- `core/admin/gestione-lavori-standalone.html`
- `core/admin/js/gestione-lavori-controller.js`
- `core/admin/js/gestione-lavori-events.js`
- `core/js/tony/main.js`
- `functions/index.js`
- `docs-sviluppo/RIEPILOGO_CURRENTTABLEDATA_PER_MODULO_LISTE.md`
- `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md`

### Risultato
- "Mostrami le vendemmie" / "Ecco le vendemmie" applica correttamente il filtro tipo lavoro.
- "Lavori di Pier" (operaio) filtra per operaio assegnato.
- Filtro operaio visibile solo con modulo Manodopera attivo.
- Selezione manuale dal dropdown tipo lavoro: filtra correttamente grazie al match flessibile (case-insensitive, nomi parziali).

---

## ✅ Pulizia documentazione Tony – archivio (2026-03-08) - COMPLETATO

### Obiettivo
Ridurre sovrapposizioni e confusione nella documentazione Tony: archiviare i documenti sostituiti dalla cartella consolidata `docs-sviluppo/tony/`.

### Implementazione
- Creata cartella `docs-sviluppo/archivio/` con README.
- Spostati in archivio:
  - `MASTER_PLAN_TONY_UNIVERSAL.md` → sostituito da `tony/MASTER_PLAN.md`
  - `STATO_TONY_2026-03-08.md` → sostituito da `tony/STATO_ATTUALE.md`
- Aggiunto banner "ARCHIVIATO" in cima ai file archiviati.
- Aggiornato `DOBBIAMO_ANCORA_FARE.md`: nota che §1.3 "diario attività" è fatto (currentTableData attivita in attivita-controller.js).
- Aggiornati riferimenti in: ANALISI_SUBAGENT_MASTER_PLAN, CONTEXT_BUILDER_SPECIFICHE, TONY_SVILUPPO_2026-03, TONY_DECISIONI_E_REQUISITI.

### File toccati
- `docs-sviluppo/archivio/` (nuova cartella)
- `docs-sviluppo/DOBBIAMO_ANCORA_FARE.md`
- `docs-sviluppo/ANALISI_SUBAGENT_MASTER_PLAN.md`
- `docs-sviluppo/CONTEXT_BUILDER_SPECIFICHE_SVILUPPO.md`
- `docs-sviluppo/TONY_SVILUPPO_2026-03_VIGNETO_E_COMPILAZIONE.md`
- `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md`
- `docs-sviluppo/tony/README.md`
- `.cursor/rules/project-guardian-tony.mdc` (nuova regola)

### Aggiornamento regole (stesso giorno)
- Creata `.cursor/rules/project-guardian-tony.mdc` – PROJECT GUARDIAN con riferimento a `tony/MASTER_PLAN.md` (path aggiornato da MASTER_PLAN_TONY_UNIVERSAL).

### Verifica pattern currentTableData/FILTER_TABLE (stesso giorno)
- Verificato sul codice: pattern attivita/terreni conforme al RIEPILOGO_CURRENTTABLEDATA.
- Aggiornato RIEPILOGO con: differenze implementative (§6), keyToId verificato (§7), limitazione FILTER_TABLE (solo attivita/terreni), procedura per nuove pagine (§8).

---

## ✅ Attività: filtro Origine (Tutte | Solo azienda | Solo conto terzi) + Tony FILTER_TABLE (2026-03-08) - COMPLETATO

### Obiettivo
Aggiungere il filtro **Origine** alla pagina Attività per distinguere lavorazioni interne (azienda) da conto terzi. La lista include entrambe le tipologie (con colorazione diversa per le righe conto terzi); il filtro permette di isolare una o l'altra. Tony deve poter filtrare per origine via comando vocale/testo.

### Implementazione

#### 1. Layout (attivita-standalone.html)
- Nuovo select **Origine** a destra del filtro Coltura: opzioni "Tutte", "Solo azienda", "Solo conto terzi".
- Event listener `change` su `filter-origine` che chiama `applyFilters`.

#### 2. Logica filtro (attivita-events.js)
- Lettura `filter-origine` in `applyFilters`; valore `origine` = "azienda" | "contoTerzi" | "".
- **Solo azienda**: esclude attività con `clienteId` valorizzato.
- **Solo conto terzi**: esclude attività senza `clienteId`.
- Integrato in entrambi i rami (modalità completati e filtri normali).
- `clearFilters` resetta anche `filter-origine`.

#### 3. Tony FILTER_TABLE (main.js)
- `keyToId` attivita: aggiunto `origine: 'filter-origine'`.
- `matchByText` per `origine`: mappa "solo azienda", "solo conto terzi" alle opzioni del select.
- Valori params: `origine: "azienda"` o `origine: "contoTerzi"`.

#### 4. Istruzioni Cloud Function (functions/index.js)
- FORMATO params: aggiunto `origine` (valori "azienda" o "contoTerzi").
- Regola ORIGINE: "solo azienda" / "attività aziendali" → `origine: "azienda"`; "solo conto terzi" → `origine: "contoTerzi"`.
- Esempi: "solo attività aziendali", "solo conto terzi".

### File toccati
- `core/attivita-standalone.html` (select Origine, listener)
- `core/js/attivita-events.js` (applyFilters, clearFilters)
- `core/js/tony/main.js` (keyToId, matchByText)
- `functions/index.js` (istruzioni CF)

### Risultato
- Filtro Origine integrato nel layout, coerenza con filtri esistenti (terreno, tipo lavoro, coltura).
- Tony può filtrare per origine: "mostrami solo le attività aziendali", "solo conto terzi".

---

## ✅ Tony Form Attività: fallback SAVE_ACTIVITY, sottocategoria Frutteto, istruzioni CF (2026-03-02) - COMPLETATO

### Obiettivo
Correggere regressioni nel flusso registrazione attività: (1) fallback SAVE_ACTIVITY che si attivava su domande come "Quali orari hai fatto?"; (2) Erpicatura/Trinciatura impostata come "Generale" anche su terreni Frutteto (Kaki) invece di "Tra le File"; (3) rafforzare istruzioni CF per sottocategoria da terreno.

### Implementazione

#### 1. Fix fallback SAVE_ACTIVITY (main.js)
- **Problema**: il regex includeva "fatto", quindi "Quali orari hai fatto? Inizio e fine." attivava il salvataggio.
- **Soluzione**: esclusione domande (`txt.indexOf('?') >= 0` o inizio con "quali", "quante", "come", ecc.); regex più restrittiva: `salvat[ao](?:\s|!|\.|$)|confermato!|ok salvo|perfetto salvo|attività salvata` (rimosso "fatto").

#### 2. Injector: sottocategoria Generale su terreni con filari (tony-form-injector.js)
- **Problema**: Tony inviava `attivita-sottocategoria = "Generale"`; l'injector lo preservava come "esplicita utente" anche per terreni Frutteto (Kaki).
- **Soluzione**: se `formData['attivita-sottocategoria']` è "Generale" e il terreno ha coltura_categoria in [Vite, Frutteto, Olivo, Arboreo, Alberi], l'injector **sovrascrive** con "Tra le File". Usa `attivitaState.terreniList` e `terreno.coltura_categoria`.

#### 3. Istruzioni Cloud Function (functions/index.js)
- **Regola critica**: Erpicatura/Trinciatura su terreno con coltura_categoria in [Vite, Frutteto, Olivo] → SEMPRE `attivita-sottocategoria = "Tra le File"`, attivita-tipo-lavoro-gerarchico = "Erpicatura Tra le File" o "Trinciatura tra le file". MAI "Generale". Esempio: "Kaki è un frutteto → usa Tra le File".
- **Contesto attivita**: aggiunto `ctxFinal.attivita.terreni` e `ctxFinal.attivita.colture_con_filari = ["Vite","Frutteto","Olivo"]` quando disponibili dati aziendali.
- **Eccezione**: se l'utente dice "generale" ma il terreno ha filari → IGNORA e usa "Tra le File".

#### 4. Fix terreniList su cambio terreno (attivita-standalone.html)
- **Problema**: al cambio terreno (listener change su attivita-terreno), `window.attivitaState.terreniList` veniva sovrascritta con `terreni` senza `coltura_categoria`, impedendo all'injector di derivare correttamente la sottocategoria.
- **Soluzione**: nel listener, mappare terreni con `mapColturaToCategoria` per preservare `coltura_categoria`.

### File toccati
- `core/js/tony/main.js` (fallback SAVE_ACTIVITY)
- `core/js/tony-form-injector.js` (override Generale su terreno con filari)
- `functions/index.js` (regola sottocategoria, attivita.terreni, colture_con_filari)
- `core/attivita-standalone.html` (terreniList con coltura_categoria al cambio terreno)

### Documentazione
- `docs-sviluppo/COSA_ABBIAMO_FATTO.md` (questa sezione)
- `core/config/tony-form-mapping.js` (TERRENO_SOTTOCATEGORIA_PREFERENCE già esistente)

### Risultato
- "Quali orari hai fatto?" non attiva più SAVE_ACTIVITY; Tony può chiedere gli orari senza tentativi di salvataggio.
- Erpicatura/Trinciatura su Frutteto (es. Kaki) usa correttamente "Tra le File"; l'injector corregge anche quando Tony invia "Generale" per errore.
- Coerenza con Master Plan Tony (sistema centralizzato, no patch per singola pagina).

---

## ✅ Tony: fix jQuery openAndInject, deduplicazione doppio salvataggio (2026-03-02) - COMPLETATO

### Obiettivo
Risolvere l'errore `$ is not defined` in `checkTonyPendingAfterNav` su pagine senza jQuery (es. attivita-standalone) e il doppio salvataggio attività (INJECT_FORM_DATA e SAVE_ACTIVITY eseguiti due volte).

### Implementazione

#### 1. Fix jQuery in openAndInject (main.js)
- Su pagine come `attivita-standalone.html` jQuery non è caricato; `checkTonyPendingAfterNav` usava `$` direttamente per aprire il modal, causando `ReferenceError: $ is not defined`.
- Sostituito l'uso di `$` con un controllo sicuro: `var jq = (typeof window.$ === 'function' && window.$.fn && window.$.fn.modal) ? window.$ : null; if (jq) { jq('#' + modalId).modal('show'); } else { el.classList.add('active'); }`.
- Applicato in tutti e 4 i rami di `openAndInject` (attivita-modal, lavoro-modal, terreno-modal, ramo generico).

#### 2. Deduplicazione doppio enqueue (main.js onComplete)
- Il comando veniva accodato due volte: (1) tony-service chiama `triggerAction()` → onAction callback → enqueueTonyCommand (source: 'onAction-callback'); (2) tony-service restituisce `{ text, command }` → main.js onComplete → enqueueTonyCommand (source: 'response-direct').
- Risultato: INJECT_FORM_DATA e SAVE_ACTIVITY eseguiti due volte → due attività identiche salvate.
- Fix: in `onComplete`, quando `rawData` è un oggetto con `command` (risposta diretta dal service), si salta l'enqueue perché `triggerAction` ha già fatto partire l'onAction callback.
- Codice: `var responseFromService = (typeof rawData === 'object' && rawData && rawData.command); if (responseFromService) { /* skip */ } else if (...) { enqueueTonyCommand(...); }`.

### File toccati
- `core/js/tony/main.js`

### Documentazione
- `docs-sviluppo/COSA_ABBIAMO_FATTO.md` (questa sezione)
- `docs-sviluppo/TONY_FUNZIONI_E_SOLUZIONI_TECNICHE.md` (§4.6 Coda comandi e deduplicazione)

### Risultato
- Flusso "registra attività" da Dashboard → Diario Attività → apertura modal → iniezione campi → salvataggio funziona senza errori JS e senza doppi salvataggi.
- Tony operativo su tutte le pagine (magazzino, macchine, ecc.) per navigazione, domande informative e registrazione attività (con redirect al Diario).

---

## ✅ Tony Terreni: contesto, domande informative, superficie (2026-02-25) - COMPLETATO

### Obiettivo
Tony sulla pagina terreni eseguiva correttamente FILTER_TABLE e SUM_COLUMN ma non rispondeva a domande come "quanti terreni ho?", "quali sono i terreni?", "quanti ettari ha il Pinot?", "quando scade l'affitto del Morini?". Serve che Tony usi i dati in `page.currentTableData` per risposte informative senza comandi.

### Implementazione

#### 1. Lettura robusta currentTableData (main.js)
- Su path terreni: prova `window.currentTableData`, `window.top.currentTableData`, `window.__tonyTableDataBuffer`. Usa il primo con items validi.
- Fallback garantisce dati anche con eventi `table-data-ready` emessi prima del listener.

#### 2. Sanificazione contesto (tony-service.js)
- Campi items inviati a Gemini: `id`, `nome`, `podere`, `coltura`, `tipoPossesso`, `scadenza`, `superficie` (arrotondata a 2 decimali).
- Fallback `item.nome || item.name || 'Senza nome'`.

#### 3. Istruzioni Cloud Function
- **DOMANDE INFORMATIVE**: usare `page.tableDataSummary` per conteggio; `items[].nome` per elenco; `items[].superficie` per superficie singolo terreno; `items[].scadenza` per scadenze affitto. Vietato "non posso mostrare/calcolare" quando i dati sono in contesto.
- **Formato risposta**: sempre JSON (`{"text": "...", "command": null}` o con command); vietato solo testo.
- **Command vuoto**: rimosso prima del return se senza `type`.

#### 4. Client: esecuzione comandi
- `commandToExecute.type` obbligatorio; comandi `{}` non eseguiti (evita log "ESEGUO COMANDO: {}").

### File toccati
- `core/js/tony/main.js`, `core/services/tony-service.js`, `functions/index.js`

### Documentazione
- `docs-sviluppo/TONY_FUNZIONI_E_SOLUZIONI_TECNICHE.md` (§10)
- `docs-sviluppo/RIEPILOGO_CURRENTTABLEDATA_PER_MODULO_LISTE.md` (terreni-standalone ora dotato)

---

## ✅ Tony: auto-discovery moduli, persistenza sessionStorage, blocco preventivo, sub-agenti, SmartFormValidator, rotte (2026-02-23) - COMPLETATO

### Obiettivo
Rendere il widget Tony autonomo sulle pagine che non passano `moduli_attivi` (es. prodotti-standalone, sottopagine moduli): recupero automatico da sessionStorage o variabili globali, persistenza tra navigazioni, ritardo breve prima dell’invio per evitare la risposta “Attiva il modulo Tony Avanzato” a utenti che lo hanno già. Allineare la documentazione a sub-agenti (Vignaiolo/Logistico), skill SmartFormValidator e mappa rotte evolutiva.

### Implementazione

#### 1. Auto-discovery moduli (tony-widget-standalone.js)
- **getModuliFromDiscovery()**: se `moduli_attivi` nel context è vuoto, il widget cerca in ordine: (1) `sessionStorage` chiave `tony_moduli_attivi`, (2) `window.userModules`, (3) `window.tenantConfig.modules` o `window.tenant.modules`. Restituisce il primo array non vuoto trovato.
- **saveModuliToStorage(arr)**: salva l’array moduli in `sessionStorage` con chiave `tony_moduli_attivi`. Chiamata ogni volta che Tony riceve moduli (setTonyContext, syncTonyModules apply, evento tony-module-updated, saveTonyState).
- **checkTonyModuleStatus**: se il context non ha moduli, chiama `getModuliFromDiscovery()`; se trova un array, fa `Tony.setContext('dashboard', { moduli_attivi: discovered })`, `saveModuliToStorage(discovered)` e ricalcola `isTonyAdvancedActive`. Log: `[Tony] Moduli ripristinati da auto-discovery (sessionStorage/window): N`.

#### 2. Persistenza sessionStorage
- Quando una pagina (es. Dashboard) imposta i moduli tramite `syncTonyModules(modules)` o `setTonyContext({ moduli_attivi })`, i moduli vengono salvati in sessionStorage.
- Su navigazione verso un’altra pagina (es. prodotti-standalone) il widget legge da sessionStorage e reinietta il context, così Tony resta in modalità “Modulo avanzato: ATTIVO” senza che la pagina prodotti chiami syncTonyModules.
- **restoreTonyState**: all’avvio, se in sessionStorage c’è `tony_moduli_attivi`, viene applicato a `Tony.setContext('dashboard', { moduli_attivi })` e emesso `tony-module-updated`.

#### 3. Blocco preventivo prima dell’invio
- In **sendRequestWithContext**, prima di inviare alla Cloud Function: se `moduli_attivi` nel context è vuoto, il widget chiama `getModuliFromDiscovery()`; se trova moduli, applica il context, `saveModuliToStorage`, `window.__tonyCheckModuleStatus(true)` e **attende 150 ms** (`setTimeout(doActualSend, 150)`) prima di eseguire l’invio reale. In questo modo la richiesta parte con moduli già popolati e la CF non risponde “Attiva il modulo”.

#### 4. Sub-agenti e SmartFormValidator (functions/index.js)
- **SmartFormValidator (skill)**: regola prioritaria iniettata nell’istruzione quando Tony avanzato è attivo: prima di emettere comandi che registrano dati (INJECT_FORM_DATA, SAVE_ACTIVITY, ecc.), Tony deve controllare `[CONTESTO].form` e i campi required; se manca un dato essenziale (terreno, data, ore, Grado Babo, quantità, ecc.) non deve inviare il JSON ma chiedere esplicitamente l’informazione mancante.
- **Sub-agente Vignaiolo**: se `context.page.pagePath` contiene `/vigneto/`, viene iniettato un blocco di personalità “esperto di viticoltura” (vendemmia, grado Babo, potatura, trattamenti, statistiche vigneto, calcolo materiali, pianificazione impianto).
- **Sub-agente Logistico**: se `context.page.pagePath` contiene `/magazzino/`, viene iniettato un blocco “esperto di gestione scorte” (prodotti, movimenti, carico/scarico, UDM).
- **TONY_TARGETS_EXTENDED**: mappa target completa con sottopagine (vendemmia, potatura vigneto/frutteto, trattamenti, raccolta frutta, prodotti, movimenti, nuovo preventivo, accetta preventivo, ecc.); se `context.page.availableRoutes` è presente, Tony può usare anche quei target per la navigazione.

#### 5. Rotte e supporto evolutivo
- **core/config/tony-routes.json**: elenco rotte generate da script (target, path, label, module). Il widget lo carica all’init e lo invia in `context.page.availableRoutes`.
- **scripts/generate-tony-routes.cjs**: script Node (CommonJS) che scandisce `core/` e `modules/` per `*-standalone.html` e scrive `core/config/tony-routes.json`. Comando: `npm run generate:tony-routes`. Per nuove cartelle in modules/, rieseguire lo script per aggiornare la mappa.
- **context.page**: il widget invia prima di ogni `ask`: `pagePath` (pathname), `availableTargets` (chiavi di TONY_PAGE_MAP), `availableRoutes` (array da tony-routes.json se caricato). La CF usa `pagePath` per attivare i sub-agenti.
- **TONY_PAGE_MAP**: aggiunti target `nuovo preventivo`, `accetta preventivo`.

### File toccati
- `core/js/tony-widget-standalone.js` (loader) + `core/js/tony/` (main.js: getModuliFromDiscovery, saveModuliToStorage, syncTonyModules, sendRequestWithContext, context.page; engine.js: TONY_PAGE_MAP/LABEL)
- `core/config/tony-routes.json` (nuovo, generato da script)
- `scripts/generate-tony-routes.cjs` (nuovo; .js rinominato in .cjs per compatibilità ES module)
- `package.json` (script generate:tony-routes → node scripts/generate-tony-routes.cjs)
- `functions/index.js` (SMARTFORMVALIDATOR_RULE, SUBAGENT_VIGNAIOLO, SUBAGENT_LOGISTICO, TONY_TARGETS_EXTENDED; iniezione blocchi in base a ctx.page.pagePath e isTonyAdvanced)

### Documentazione aggiornata
- `docs-sviluppo/COSA_ABBIAMO_FATTO.md` (questa sezione)
- `docs-sviluppo/GUIDA_SVILUPPO_TONY.md` (§9 Auto-discovery e persistenza moduli; §8.4 Skill e sub-agenti; §11 file)
- `docs-sviluppo/TONY_FUNZIONI_E_SOLUZIONI_TECNICHE.md` (§2.3d Auto-discovery e persistenza; §4 backend SmartFormValidator, sub-agenti, context.page, rotte)
- `docs-sviluppo/CHECKLIST_TONY.md` (voci 4.13, 4.14, 3.8, 3.9)

### Risultato
- Su pagine come prodotti-standalone (che non chiamano syncTonyModules), il widget recupera i moduli da sessionStorage (salvati in una pagina precedente, es. Dashboard) o da window.userModules/tenantConfig; in console compare “Modulo avanzato: ATTIVO” e Tony non risponde più “Attiva il modulo Tony Avanzato” alla domanda “cosa devo fare”.
- Sub-agenti e SmartFormValidator rendono Tony coerente con il contesto (vigneto/magazzino) e con la validazione dei form prima di emettere comandi.
- Rotte e script .cjs permettono di estendere la mappa quando si aggiungono nuove pagine o moduli.

---

## ✅ Tony: contesto moduli, navigazione da tutte le pagine, Cloud Function robusta (2026-02-23) - COMPLETATO

### Obiettivo
Risolvere il problema per cui Tony, da pagine diverse dalla dashboard (es. Terreni, Frutteto), non riceveva correttamente i moduli attivi e rispondeva con il template “base” (“attiva il modulo Tony Avanzato”), bloccando la navigazione. Uniformare l’inizializzazione del contesto su tutte le pagine standalone e rendere la Cloud Function robusta nella lettura dei moduli e nella scelta dell’istruzione avanzata.

### Implementazione

#### 1. Helper globale `syncTonyModules` (tony-widget-standalone.js)
- **Definizione**: `window.syncTonyModules(modules, options)` definita a livello script (subito dopo `injectWidget()`), così è disponibile anche prima che Tony sia inizializzato.
- **Uso**: qualsiasi pagina standalone, dopo aver caricato i dati tenant, può chiamare `syncTonyModules(modules)` dove `modules` è l’array dei moduli attivi (es. `tenant.modules`).
- **Comportamento**: se esiste `window.setTonyContext` chiama `setTonyContext({ moduli_attivi: arr })`; altrimenti, se esiste `Tony.setContext`, imposta il context e emette l’evento `tony-module-updated`; se nessuno dei due è disponibile (widget non ancora pronto), **riprova ogni 400 ms per 25 volte** (~10 s). Opzione `syncTonyModules(modules, { retry: false })` per disabilitare il retry.
- **Controllo di sicurezza**: se l’array `modules` è vuoto e il contesto esistente di Tony contiene già un array di moduli non vuoto, **non si sovrascrive** il contesto (una pagina “smemorata” non cancella i permessi già ricevuti). Log: `[Tony Sync] Array vuoto ignorato: contesto già popolato con N moduli. Non sovrascrivo.`
- **Log di debug**: `[Tony Sync] Ricevuti moduli: <array>` oppure `(vuoto)` per capire chi invia l’array.

#### 2. Bypass totale navigazione (widget)
- **onAction**: la gestione di `APRI_PAGINA` e `apri_modulo` è stata spostata **prima** del controllo `isTonyAdvancedActive`: la navigazione viene sempre eseguita, anche se il context moduli non è ancora caricato.
- **onComplete**: `allowExecute` per i comandi di tipo `APRI_PAGINA` / `apri_modulo` è sempre `true` (variabile `isNavOpenPage`), indipendentemente da `isTonyAdvancedActive`.
- **processTonyCommand**: se il comando è `APRI_PAGINA` o `apri_modulo`, non si applica il blocco “modulo non attivo”; si procede direttamente allo `switch` che gestisce la navigazione.
- In sintesi: i comandi di navigazione **ignorano completamente** lo stato `isTonyAdvancedActive`; se l’utente chiede di navigare, Tony esegue sempre.

#### 3. Dashboard di modulo: iniezione moduli e forzatura (Frutteto, Vigneto)
- **Frutteto** (`frutteto-dashboard-standalone.html`): dopo aver letto `modules` da `tenant.modules`, si forzano nell’array i moduli `frutteto` e `tony` se mancanti (l’utente è nella dashboard Frutteto, quindi devono essere presenti). Poi si chiama `syncTonyModules(modules)` (con fallback su `setTonyContext` o su `dispatchEvent('tony-module-updated')`).
- **Vigneto** (`vigneto-dashboard-standalone.html`): stessa logica unificata: dopo aver ottenuto `modules` dal tenant si chiama `syncTonyModules(modules)` con gli stessi fallback.
- In entrambe le dashboard è stato rimosso il blocco custom con `initContextWithModules` + retry manuale; rimane una sola chiamata all’helper.

#### 4. Cloud Function `tonyAsk` (functions/index.js)
- **Lettura payload**: non si usa più la destrutturazione `const { message, context, history } = request.data`. Si legge esplicitamente `reqData = request.data`, `message = reqData.message`, `ctx = reqData.context`, `history = reqData.history`.
- **Check moduli robusto**: `moduli_attivi` viene letto dal path inviato dal client: prima `ctx.dashboard.moduli_attivi`, poi `ctx.dashboard.info_azienda.moduli_attivi`, poi `ctx.moduli_attivi` e `ctx.info_azienda.moduli_attivi`. Uso di `ctx` ovunque (form, Treasure Map) invece di `context`.
- **Stato avanzato**: costante `isTonyAdvanced = true` se l’array moduli contiene `'tony'` (confronto case-insensitive). Se `isTonyAdvanced` è vero si usa **sempre** `SYSTEM_INSTRUCTION_ADVANCED`.
- **Iniezione esplicita nel prompt**: quando `isTonyAdvanced` è vero, all’inizio del prompt inviato a Gemini si aggiunge:  
  `STATO UTENTE: Tony Avanzato ATTIVO. Moduli disponibili: [elenco]. Hai il permesso totale di usare APRI_PAGINA e tutte le altre funzioni JSON.`
- **Default navigazione**: nella system instruction ADVANCED è stata aggiunta la regola **DEFAULT NAVIGAZIONE**: la navigazione verso le pagine base (Home, Dashboard, Terreni, Vigneto, Frutteto, Magazzino, Macchine, Manodopera) deve essere **sempre** consentita tramite JSON `APRI_PAGINA`, poiché non modifica dati. Nella instruction BASE è stata aggiunta **ECCEZIONE NAVIGAZIONE**: se l’utente chiede esplicitamente di andare a Home, Dashboard, Terreni, Vigneto o Frutteto, rispondere comunque con il JSON `APRI_PAGINA` e il target corretto.
- **Fallback navigazione**: se l’array moduli è vuoto ma il messaggio è chiaramente una richiesta di navigazione (parole come *portami*, *apri*, *dashboard*, *home*, *terreni*, *vigneto*, *frutteto*, ecc.), si imposta comunque `isTonyAdvanced = true` e si usa l’istruzione avanzata.
- **Log di debug**: log delle chiavi di `request.data`, presenza di `ctx.dashboard`, `moduli_attivi` e `isTonyAdvanced` per diagnosi in Firebase Console.

#### 5. Mappa target
- La mappa dei target nella Cloud Function (SYSTEM_INSTRUCTION_ADVANCED) è allineata al widget: dashboard, terreni, vigneto, frutteto, magazzino, parcoMacchine, manodopera, oliveto, lavori, attivita (e relativi alias).

#### 6. Normalizzazione command da Cloud Function (tony-widget-standalone.js)
- La CF restituisce il comando nel formato `command: { action: 'APRI_PAGINA', params: { target: 'vigneto' } }`, mentre il widget e `processTonyCommand` si aspettano `type` (e `enqueueTonyCommand` scarta i comandi senza `type`). Se il comando ha `action` ma non `type`, viene normalizzato: si imposta `type = action` e si copiano le proprietà di `params` sull’oggetto (es. `target`), così il branch APRI_PAGINA e la coda comandi ricevono un oggetto valido e la navigazione (dialog + redirect) viene eseguita.

#### 7. Base path per URL di navigazione (evitare 404 da smartphone/online)
- Quando l’app è servita in una sottocartella (es. `/gfv-platform/` su GitHub Pages o altro host), `getUrlForTarget` restituiva path dalla root (es. `/core/terreni-standalone.html`), causando 404 perché la pagina reale è sotto `/gfv-platform/core/...`. In `getUrlForTarget` si rileva se `window.location.pathname` contiene `/gfv-platform/` e in quel caso si usa il prefisso `/gfv-platform` negli URL generati (es. `/gfv-platform/core/terreni-standalone.html`). In locale (path senza `/gfv-platform/`) non si aggiunge alcun prefisso.

### File toccati
- `core/js/tony-widget-standalone.js` (syncTonyModules, controllo array vuoto, log, bypass navigazione in onAction/onComplete/processTonyCommand; normalizzazione command action→type; base path in getUrlForTarget)
- `modules/frutteto/views/frutteto-dashboard-standalone.html` (forzatura frutteto/tony, syncTonyModules)
- `modules/vigneto/views/vigneto-dashboard-standalone.html` (syncTonyModules con fallback)
- `functions/index.js` (lettura esplicita request.data, ctx.dashboard.moduli_attivi, isTonyAdvanced, iniezione prompt, default/eccezione navigazione, fallback richiesta navigazione, log, uso di ctx ovunque)

### Documentazione aggiornata
- `docs-sviluppo/COSA_ABBIAMO_FATTO.md` (questa sezione)
- `docs-sviluppo/TONY_FUNZIONI_E_SOLUZIONI_TECNICHE.md` (riferimento a syncTonyModules, bypass navigazione, CF)

### Risultato
- Da qualsiasi pagina standalone (Terreni, Frutteto, Vigneto, ecc.) che chiama `syncTonyModules(modules)` (o che ha la forzatura come in Frutteto), Tony riceve i moduli corretti e la Cloud Function usa l’istruzione avanzata, restituendo il JSON di navigazione. La navigazione (APRI_PAGINA / apri_modulo) funziona sempre, anche con context temporaneamente vuoto, grazie al bypass lato widget. In caso di payload o path errati, il fallback “richiesta navigazione” in CF forza comunque l’istruzione avanzata per le frasi di navigazione.
- La normalizzazione del comando (action → type) assicura che dialog e redirect vengano sempre eseguiti quando la CF restituisce il formato `{ action, params }`. Il base path in `getUrlForTarget` evita il 404 quando l’app è aperta da smartphone/online sotto una sottocartella (es. `/gfv-platform/`).

---

## ✅ Tony: compilazione form Lavori – sottocategoria, tipo lavoro, macchine, messaggio (2026-02-16) - COMPLETATO

### Obiettivo
Far compilare correttamente il form **Crea Nuovo Lavoro** tramite Tony al primo tentativo: sottocategoria "Tra le File" (non "Generale") per vigneti/frutteti/oliveti, tipo "Erpicatura Tra le File" (non Trinciatura), macchine quando richiesto, stato "Assegnato" per default, messaggio finale adeguato.

### Implementazione

#### Sottocategoria e tipo lavoro
- **Contesto lavori**: ogni terreno ha `coltura_categoria` (Vite, Frutteto, Olivo, Seminativo); `colture_con_filari: ['Vite','Frutteto','Olivo']`
- **Regole SYSTEM_INSTRUCTION**: terreno con filari → sottocategoria SOLO "Tra le File" o "Sulla Fila"; tipo generico (erpicatura, trinciatura) + filari → tipo specifico "Erpicatura Tra le File", ecc.
- **Disambiguazione**: Erpicatura ≠ Trinciatura; se utente dice "erpicatura" usa sempre "Erpicatura Tra le File"

#### Macchine e stato
- Se utente dice "completo di macchine" → includi subito trattore e attrezzo da trattoriList/attrezziList
- Stato default: "assegnato" se caposquadra/operaio compilato; "da_pianificare" solo senza assegnazione

#### Messaggio quando form completo
- Lavori normali: "Ho compilato tutto. Vuoi che salvi il lavoro?"
- Messaggio "Completa manualmente i dettagli tecnici (varietà, distanze)" SOLO per Impianto Nuovo Vigneto/Frutteto

#### Contesto e parametri
- `gestione-lavori-standalone.html`: `coltura_categoria` e `colture_con_filari` nel contesto Tony; `?openModal=crea` per aprire modal Crea Lavoro all'avvio

### File toccati
- `core/js/attivita-utils.js` (mapColturaToCategoria: rimosse varietà)
- `core/admin/gestione-lavori-standalone.html` (contesto coltura_categoria, colture_con_filari, openModal=crea)
- `functions/index.js` (SYSTEM_INSTRUCTION_LAVORO_STRUCTURED)
- `core/config/tony-form-mapping.js` (lavoro-stato description)

### Documentazione
- **Nuovo:** `docs-sviluppo/TONY_COMPILAZIONE_LAVORI_2026-02.md` – documentazione completa

---

## ✅ Tony: comportamento risposta/conferma, dialog custom, widget su tutte le pagine (2026-02-05) - COMPLETATO

### Obiettivo
Migliorare l’esperienza con Tony: (1) risposta prima e apertura pagina solo dopo conferma utente quando la richiesta non è esplicita di navigazione; (2) sostituire il popup nativo di conferma con un dialog in stile app; (3) rendere Tony disponibile su tutte le pagine dell’app (non solo in dashboard) tramite un loader unico.

### Implementazione

#### Comportamento risposta / conferma apertura pagina
- **System instruction** (in `core/services/tony-service.js` e `functions/index.js`): per domande tipo “come fare” (es. “Come si crea un terreno?”) Tony deve **prima spiegare i passi** (usando la guida app) e **non** includere `APRI_PAGINA` nella stessa risposta; può solo proporre in testo: “Se vuoi andare alla pagina [X], dimmi ‘apri’ o ‘sì’ e te la apro.” L’apertura avviene solo quando l’utente conferma in un messaggio successivo. Per richieste **esplicite** di navigazione (“Portami ai terreni”, “Apri gestione lavori”) Tony continua a includere subito `APRI_PAGINA`.
- Stessa logica per suggerimenti (es. “Dove vedo la produzione uva?”): risposta testuale + invito, senza azione nella stessa risposta.

#### Dialog conferma (al posto di `confirm()`)
- In **dashboard** (poi centralizzato nel loader): sostituito `confirm()` con un **dialog custom** in stile Tony: overlay semitrasparente, box con messaggio “Aprire la pagina «Terreni»?” e pulsanti **Annulla** / **Apri**. Stili in `core/styles/tony-widget.css` (`.tony-confirm-overlay`, `.tony-confirm-box`, `.tony-confirm-btn`). La navigazione avviene solo se l’utente clicca **Apri**; click su overlay o Annulla chiude senza navigare.

#### Tony su tutte le pagine (loader standalone)
- Creato **`core/js/tony-widget-standalone.js`**: loader unico che (1) inietta il CSS da `../styles/tony-widget.css` (rispetto allo script), (2) inietta nel DOM FAB, pannello chat e dialog conferma, (3) imposta la logica chat (appendMessage, send, open/close), (4) imposta il dialog di conferma e `window.showTonyConfirmDialog(message)`, (5) calcola gli URL di navigazione in base a `window.location.pathname` (mappa target → path da root, poi path relativo dalla pagina corrente), (6) fa polling per `getAppInstance()` (fino a ~10 s) e poi inizializza Tony, registra `onAction` per `APRI_PAGINA` con conferma e navigazione.
- **Dashboard**: rimossi FAB, pannello, dialog e tutto lo script Tony inline; lasciati solo `<link href="styles/tony-widget.css">` e `<script type="module" src="js/tony-widget-standalone.js">`.
- **Altre pagine**: aggiunto lo stesso snippet (link CSS + script module) con path relativo a `core/`:
  - **Core** (stesso livello di dashboard): `terreni-standalone`, `attivita-standalone`, `statistiche-standalone`, `segnatura-ore-standalone` → `styles/tony-widget.css`, `js/tony-widget-standalone.js`.
  - **Core/admin**: tutte le standalone (gestione-lavori, amministrazione, gestione-guasti, segnalazione-guasti, gestisci-utenti, gestione-operai, gestione-squadre, compensi-operai, gestione-macchine, statistiche-manodopera, validazione-ore, abbonamento, impostazioni, lavori-caposquadra, report) → `../styles/tony-widget.css`, `../js/tony-widget-standalone.js`.
  - **Modules**: tutte le view standalone di vigneto, frutteto, magazzino, conto-terzi, report → `../../../core/styles/tony-widget.css`, `../../../core/js/tony-widget-standalone.js`.
- **Escluse** (nessuno snippet Tony): login, registrazione, reset-password, registrazione-invito, fix-utente-mancante, accetta-preventivo (opzionale; lo snippet è stato aggiunto per coerenza).

### File toccati
- `core/services/tony-service.js` (system instruction: “SPIEGA PRIMA, CHIEDI CONFERMA PER APRIRE”, no APRI_PAGINA per “come fare”)
- `functions/index.js` (stessa system instruction)
- `core/styles/tony-widget.css` (stili dialog conferma)
- `core/dashboard-standalone.html` (rimozione HTML/script Tony, aggiunta loader; rimosso blocco init/dialog dal modulo script)
- **Nuovo:** `core/js/tony-widget-standalone.js` (loader: inject DOM/CSS, chat UI, confirm dialog, getUrlForTarget, init Tony con polling)
- **Core:** `terreni-standalone.html`, `attivita-standalone.html`, `statistiche-standalone.html`, `segnatura-ore-standalone.html`
- **Core/admin:** tutte le *-standalone.html elencate sopra
- **Modules:** tutte le view *-standalone.html di vigneto, frutteto, magazzino, conto-terzi, report

### Documentazione aggiornata
- `docs-sviluppo/COSA_ABBIAMO_FATTO.md` (questa sezione)
- `docs-sviluppo/CHECKLIST_TONY.md` (voci conferma, dialog, widget globale)
- `docs-sviluppo/GUIDA_SVILUPPO_TONY.md` (comportamento, dialog, Tony su tutte le pagine, file loader)

### Risultato
- Tony risponde prima e propone l’apertura pagina solo in testo quando la richiesta non è esplicita; l’utente conferma con “sì”/“apri” nel turno successivo. Conferma lato client sempre tramite dialog in stile app (no popup nativo). Tony è disponibile su tutte le pagine dell’app (FAB in basso a destra) tramite un unico loader che risolve gli URL in base al pathname.

---

## ✅ Migrazione Firebase 11 e firebase-service (2026-02-05) - COMPLETATO

### Obiettivo
Eliminare gli errori in console tipo *"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore"* unificando l’uso del Firebase SDK: tutta l’app usa **Firebase 11** e si appoggia a **`core/services/firebase-service.js`** per inizializzazione e operazioni Firestore/Auth. Nessuna pagina o modulo deve più importare o inizializzare Firebase 10.7.1 in modo locale.

### Implementazione

#### Pagine HTML (core, admin, moduli)
- **Core:** `registrazione-standalone`, `reset-password-standalone`, `segnatura-ore-standalone`, `login.html` (reset password).
- **Admin:** `validazione-ore`, `statistiche-manodopera`, `gestione-macchine`, `gestione-guasti`, `segnalazione-guasti`, `gestione-lavori`, `abbonamento`, `lavori-caposquadra`, `gestione-squadre`, `gestione-operai`, `compensi-operai`, `fix-utente-mancante`, `amministrazione`, `gestisci-utenti`.
- **Auth:** `registrazione-invito-standalone`.
- **Moduli:** tutte le view standalone di **vigneto** (pianifica-impianto, vendemmia, statistiche, calcolo-materiali, vigneti, dashboard, potatura, trattamenti), **frutteto** (statistiche, frutteti, raccolta-frutta, dashboard, potatura, trattamenti), **conto-terzi** (clienti, preventivi, accetta-preventivo, mappa-clienti, home, nuovo-preventivo, terreni-clienti, tariffe), **magazzino** (home, prodotti, movimenti), **report**.

In tutte le pagine: rimossi gli import CDN Firebase 10.7.1; inizializzazione sostituita con `initializeFirebase(firebaseConfig)` e `getAppInstance()`, `getAuthInstance()`, `getDb()`; funzioni Auth non esportate dal service (es. `signInWithEmailAndPassword`, `sendPasswordResetEmail`, `createUserWithEmailAndPassword`) importate da **firebase-auth.js 11.0.0**; import dinamici 10.7.1 sostituiti con `firebase-service.js` o funzioni già in pagina.

#### File JavaScript
- **Core:** `tenant-service.js`, `auth-service.js` (Auth 11 + firebase-service), `terreni-controller.js`, `attivita-events.js`, `attivita-controller.js`, `terreni-events.js`.
- **Admin:** `gestione-lavori-controller.js`, `gestione-lavori-maps.js`, `gestione-lavori-events.js`.
- **Servizi core:** `ore-service.js`, `calcolo-compensi-service.js` (uso di `getDb()` al posto di `initializeApp` + `getFirestore`).
- **Moduli:** servizi vigneto (trattamenti, lavori, potatura, vendemmia, statistiche aggregate), frutteto (lavori, statistiche aggregate, potatura, trattamenti), **parco-macchine** `macchine-utilizzo-service.js` (Firebase 11 + `getDb` da firebase-service).

Tutti gli import dinamici da `https://www.gstatic.com/firebasejs/10.7.1/...` sono stati sostituiti con import da `firebase-service.js` (path relativo in base alla cartella del file) o con Auth/Storage 11.0.0 dove il service non re-esporta quelle funzioni.

### File toccati (riepilogo)
- **Core:** `core/services/tenant-service.js`, `core/services/auth-service.js`, `core/services/ore-service.js`, `core/services/calcolo-compensi-service.js`, `core/js/terreni-controller.js`, `core/js/attivita-events.js`, `core/js/attivita-controller.js`, `core/js/terreni-events.js`, tutte le HTML standalone e auth in `core/` e `core/admin/`.
- **Moduli:** view e servizi in `modules/vigneto/`, `modules/frutteto/`, `modules/conto-terzi/`, `modules/magazzino/`, `modules/report/`, `modules/parco-macchine/services/macchine-utilizzo-service.js`.

### Documentazione aggiornata
- `docs-sviluppo/COSA_ABBIAMO_FATTO.md` (questa sezione)
- `docs-sviluppo/GUIDA_SVILUPPO_TONY.md` (riferimento stack Firebase 11)
- `docs-sviluppo/CHECKLIST_TONY.md` (voce dipendenze Firebase 11)

### Risultato
- Nessun riferimento residuo a Firebase 10.7.1 in `.html` e `.js`. L’app usa un solo SDK (Firebase 11) e un solo punto di inizializzazione (`firebase-service.js`), evitando il conflitto tra istanze Firestore 10 e 11 che generava l’errore in console.

---

## ✅ Tony (assistente IA): Cloud Function, regione, GEMINI_API_KEY, manifest, test (2026-02-05) - COMPLETATO

### Obiettivo
Completare il deploy della Cloud Function **tonyAsk** (Gemini) per Tony, risolvere CORS/regione, documentare dove impostare la chiave API e come provare Tony. Correggere il 404 del manifest.json.

### Implementazione

#### Deploy Cloud Function
- **tonyAsk** (callable) deployata in **europe-west1**, Node.js 20, Firebase Functions v2 (`firebase-functions/v2/https`).
- Funzione: riceve `message` e `context`, verifica `request.auth`, chiama API REST Gemini con system instruction Tony, restituisce `{ text }`.
- File: `functions/index.js`, `functions/package.json` (engines node 20).

#### Regione e CORS
- Il client chiamava `us-central1` (default di `getFunctions(app)`); la function è in **europe-west1** → CORS/404.
- In **tony-service.js**: `getFunctions(app)` sostituito con **`getFunctions(app, 'europe-west1')`** così le chiamate vanno alla function corretta.

#### Chiave Gemini (GEMINI_API_KEY)
- Impostata come **variabile d'ambiente** nella revisione Cloud Run (la function v2 gira su Cloud Run).
- Percorso: **Google Cloud Console** → Cloud Run → servizio **tonyask** → Modifica nuova revisione → Container → Variabili e secret → Aggiungi variabile: Nome `GEMINI_API_KEY`, Valore (API key da [Google AI Studio](https://aistudio.google.com/apikey)) → Distribuisci.
- In alternativa (futuro): Secret Manager + `defineSecret` nel codice function.

#### Manifest.json 404
- I link in tutte le pagine puntavano a `/gfv-platform/manifest.json`; con server root = cartella progetto il path non esisteva.
- Sostituito **`/gfv-platform/manifest.json`** con **`/manifest.json`** in: `core/dashboard-standalone.html`, `index.html`, `core/attivita-standalone.html`, `core/terreni-standalone.html`, `core/auth/login-standalone.html`, `core/statistiche-standalone.html`, tutte le view standalone di frutteto e vigneto (raccolta, frutteti, vigneti, calcolo-materiali, statistiche, vendemmia, pianifica-impianto).

#### Come provare Tony
- Dashboard caricata e utente loggato → in console: **`await Tony.ask("Ciao")`** o **`await Tony.ask("Apri il modulo attività")`**.
- Tony risponde con testo + eventuale azione in JSON (es. `{"action": "apri_modulo", "params": {"modulo": "attività"}}`). L’esecuzione effettiva delle azioni (navigazione, ecc.) richiede `Tony.onAction(callback)` da collegare in un secondo momento.

#### Cleanup policy (opzionale)
- Al primo deploy la CLI ha chiesto i giorni di retention per le immagini container; impostati 7 giorni. Se la policy non si applica: `firebase functions:artifacts:setpolicy` o `firebase deploy --only functions --force`.

### File toccati
- `core/services/tony-service.js` (getFunctions con region `europe-west1`)
- `core/dashboard-standalone.html`, `index.html`, `core/attivita-standalone.html`, `core/terreni-standalone.html`, `core/auth/login-standalone.html`, `core/statistiche-standalone.html`
- `modules/frutteto/views/raccolta-frutta-standalone.html`, `frutteti-standalone.html`, `frutteto-statistiche-standalone.html`
- `modules/vigneto/views/vigneti-standalone.html`, `calcolo-materiali-standalone.html`, `vigneto-statistiche-standalone.html`, `vendemmia-standalone.html`, `pianifica-impianto-standalone.html`

### Documentazione aggiornata
- `docs-sviluppo/GUIDA_SVILUPPO_TONY.md` (sezione implementazione, regione, GEMINI_API_KEY, come provare)
- `functions/README.md` (regione europe-west1, dove impostare GEMINI_API_KEY in Cloud Run)
- `README.md` (menzione assistente Tony)

### Risultato
- Tony operativo via Cloud Function in europe-west1; chiave Gemini configurata in Cloud Run; client con regione corretta; manifest non più 404. Test da console con `await Tony.ask("...")` funzionante.

---

## ✅ Trattamenti Vigneto/Frutteto: alert dosaggio, bollino verde, pulsante Modifica, costi in dashboard (2026-02-03) - COMPLETATO

### Obiettivo
Rendere i trattamenti coerenti con la specifica (avviso dosaggio fuori range), migliorare la UX (bollino verde se tutto ok, pulsante Modifica visibile) e correggere le statistiche dashboard (inclusione costi prodotti dei trattamenti nel totale spese).

### Implementazione

#### Alert dosaggio (Vigneto e Frutteto)
- In `trattamenti-standalone.html` (Vigneto e Frutteto): funzione **validaDosaggiProdotti(rowsProdotti)** che confronta il dosaggio inserito con dosaggioMin/dosaggioMax in anagrafica prodotto; restituisce messaggio "Dosaggio superiore/inferiore al consigliato per [nome]".
- In **salvataggio**: se il dosaggio è fuori range non si blocca più il salvataggio; viene mostrato un **confirm** "Attenzione: [messaggio]. Salvare comunque?"; l’utente può confermare e salvare ugualmente.
- In **lista**: colonna **Avvisi** con icona ⚠️ se almeno un prodotto ha dosaggio fuori range (tooltip con dettaglio); **bollino verde** (stile come affitti/contratti: `.alert-badge.green`) se tutto ok; "-" per righe senza trattamento (Completa).

#### Pulsante Modifica visibile (Vigneto e Frutteto)
- Allineamento al modulo Potatura: in lista il pulsante "Modifica" è passato da **btn-primary** a **btn-secondary** (grigio, visibile in tabella).
- Aggiunta regola **`.modal .btn-primary`** (background #007bff, hover #0056b3) in entrambe le view trattamenti, così i pulsanti primari nel modal sono blu solidi e leggibili.

#### Costi trattamenti nelle statistiche dashboard
- **Problema**: in `aggregaSpeseVignetoAnno` il campo `speseProdottiAnno` era inizializzato a 0 e mai popolato; in `aggregaSpeseFruttetoAnno` i costi prodotti arrivavano solo da `lavoro.costoProdotti` (non valorizzato dai trattamenti). I costi dei trattamenti (documenti in vigneti/{id}/trattamenti e frutteti/{id}/trattamenti) non entravano nel totale spese della dashboard.
- **Vigneto** (`lavori-vigneto-service.js`): prima del calcolo di `costoTotaleAnno` viene caricata la lista trattamenti per vigneto e anno (`getTrattamenti(vignetoId, { anno })`); per ogni trattamento si somma il costo prodotti (somma `prodotti[].costo` o `costoProdotto`) in `spese.speseProdottiAnno`.
- **Frutteto** (`lavori-frutteto-service.js`): stessa logica; caricamento trattamenti per frutteto e anno e somma costi prodotti in `spese.speseProdottiAnno`.
- Le card "Spese totali" (e dettaglio spese) nelle dashboard Vigneto e Frutteto includono ora correttamente i costi prodotti dei trattamenti.

#### Documentazione
- `documentazione-utente/04-FUNZIONALITA/TRATTAMENTI_VIGNETO_FRUTTETO.md`: aggiornato il paragrafo sul dosaggio (avviso in salvataggio con conferma, colonna Avvisi e bollino verde in lista).

### File toccati
- `modules/vigneto/views/trattamenti-standalone.html` (validaDosaggiProdotti, avvisoDosaggioTrattamento, colonna Avvisi, bollino verde, CSS alert-badge; save con confirm; Modifica btn-secondary; .modal .btn-primary)
- `modules/frutteto/views/trattamenti-standalone.html` (stesse modifiche)
- `modules/vigneto/services/lavori-vigneto-service.js` (aggregaSpeseVignetoAnno: caricamento trattamenti e somma costi prodotti in speseProdottiAnno)
- `modules/frutteto/services/lavori-frutteto-service.js` (aggregaSpeseFruttetoAnno: caricamento trattamenti e somma costi prodotti in speseProdottiAnno)
- `documentazione-utente/04-FUNZIONALITA/TRATTAMENTI_VIGNETO_FRUTTETO.md`

### Risultato
- Alert dosaggio: l’utente è avvisato se il dosaggio è fuori range ma può salvare; in lista si vede subito quali trattamenti hanno avvisi (⚠️) e quali sono ok (bollino verde).
- Pulsante Modifica visibile in lista trattamenti (come in Potatura).
- Le statistiche "Spese totali" nelle dashboard Vigneto e Frutteto includono i costi prodotti dei trattamenti.

---

## ✅ Verifica caricamento dashboard vigneto – test su server locale (2026-02-01) - COMPLETATO

### Obiettivo
Verificare il caricamento della dashboard del modulo vigneto su ambiente locale e confermare il miglioramento dei tempi dopo le ottimizzazioni.

### Cosa è stato fatto
- **URL di test**: uso del server locale `http://127.0.0.1:8000/` (l’app online non è aggiornata; si lavora lato server).
- **Pagina verificata**: `http://127.0.0.1:8000/modules/vigneto/views/vigneto-dashboard-standalone.html`.
- **Flusso**: login manuale con credenziali; navigazione alla dashboard vigneto; verifica tramite browser (snapshot/screenshot) che statistiche e tabelle si popolino correttamente (sezione Panoramica: Produzione Anno, Resa media, Spese vendemmia, Spese totali, ecc.).
- **Risultato**: caricamento confermato; nessun errore visibile; statistiche e card popolate.

### Tempo di caricamento
- **Prima** (riferimento utente): ~7 secondi per la dashboard vigneto.
- **Dopo** (feedback utente): ~4 secondi — miglioramento di circa 3 secondi.

### File / documentazione
- Nessuna modifica al codice in questa sessione; solo verifica in browser e aggiornamento di COSA_ABBIAMO_FATTO e RIEPILOGO_LAVORI.

### Nota
- Per ulteriori riduzioni (es. sotto i 2–3 s) si può intervenire su: retry `tenantId`, letture duplicate utente/vigneti, caricamento parallelo di statistiche/vendemmie/lavori (già analizzato in precedenza).

---

## ✅ Allineamento modulo Frutteto al Vigneto: lavori, raccolta, modello (2026-02-01) - COMPLETATO

### Obiettivo
Allineare il modulo Frutteto al Vigneto su: aggregazione spese per categoria (potatura, trattamenti, raccolta, lavorazione terreno, ecc.), metodo `isCompleta()` su RaccoltaFrutta, modello Frutteto (spese prodotti e costi anno), naming API (`costoTotaleAnno`). Esclusa la sezione Trattamenti (da affrontare separatamente).

### Implementazione

#### Lavori Frutteto – Categorie di spesa
- In `lavori-frutteto-service.js`: aggiunte **normalizzaTipoLavoro**, **getCategoriaManodoperaPerTipoLavoro** (mappatura tipo lavoro → categoria: potatura, trattamenti, raccolta, lavorazione_terreno, diserbo, semina_piantagione, gestione_verde, trasporto, manutenzione, altro) e **aggiungiManodoperaPerCategoria**.
- **aggregaSpeseFruttetoAnno**: per ogni lavoro e per le attività dirette del diario si usa la categoria (non più solo “raccolta/frutta”); creazione chiavi dinamiche (manodoperaPotatura, manodoperaTrattamenti, manodoperaRaccolta, ecc.); in uscita vengono valorizzati spesePotaturaAnno, speseTrattamentiAnno, speseRaccoltaAnno dalle chiavi dinamiche; restituiti anche **costoTotaleAnno** (come nel vigneto); arrotondo a 2 decimali (escluse chiavi _nome).

#### RaccoltaFrutta – isCompleta()
- In `RaccoltaFrutta.js`: aggiunto metodo **isCompleta()** (true se valorizzati quantità kg, superficie ettari, specie e varietà), allineato al concetto di Vendemmia.

#### Modello Frutteto
- In `Frutteto.js`: aggiunto campo **speseProdottiAnno** nel costruttore; override **calcolaCostoTotaleAnno()** che include tutte le spese (manodopera, macchine, prodotti, trattamenti, potatura, raccolta, altro).

#### Frutteti-service
- Rimosso il workaround che copiava speseProdottiAnno in speseAltroAnno (il modello gestisce ora speseProdottiAnno e il costo anno).

#### Statistiche
- In `frutteto-statistiche-service.js`: per il singolo frutteto si usa **speseAgg.costoTotaleAnno ?? speseAgg.speseTotaleAnno** per coerenza con l’API di aggregazione.

### File toccati
- `modules/frutteto/services/lavori-frutteto-service.js` (categorizzazione tipo lavoro, aggregaSpese con categorie e costoTotaleAnno)
- `modules/frutteto/models/RaccoltaFrutta.js` (isCompleta)
- `modules/frutteto/models/Frutteto.js` (speseProdottiAnno, calcolaCostoTotaleAnno)
- `modules/frutteto/services/frutteti-service.js` (rimozione workaround speseProdottiAnno)
- `modules/frutteto/services/frutteto-statistiche-service.js` (uso costoTotaleAnno da aggregazione)

### Risultato
- Frutteto allineato al vigneto su: aggregazione spese per categoria (potatura, trattamenti, raccolta, lavorazione terreno, ecc.), API costoTotaleAnno, modello Frutteto con spese prodotti e costi anno, RaccoltaFrutta con isCompleta(). Sezione Trattamenti (es. isTroppoVicinoARaccolta) lasciata da parte come concordato.

---

## ✅ Potatura e Trattamenti: pagine e card Vigneto/Frutteto + piano da lavori (2026-01-31) - COMPLETATO

### Obiettivo
Allineare il modulo Vigneto al Frutteto con pagine dedicate **Potatura** e **Trattamenti** (liste + modal CRUD) e card nelle dashboard; pianificare l’evoluzione “Potatura/Trattamenti da lavori e attività” (dati base da lavoro/attività, dati aggiuntivi compilabili).

### Implementazione

#### Pagine Potatura e Trattamenti – Modulo Frutteto (già presenti)
- **Potatura:** `modules/frutteto/views/potatura-standalone.html` – filtro frutteto/anno, tabella potature, modal Nuova/Modifica (tipo, parcella, piante potate, operai, ore, costi). Integrazione con `potatura-frutteto-service.js`.
- **Trattamenti:** `modules/frutteto/views/trattamenti-standalone.html` – stessa struttura, modal con prodotto, dosaggio, tipo, operatore, superficie, costi, giorni di carenza. Integrazione con `trattamenti-frutteto-service.js`.
- Dashboard Frutteto: card **Potatura** e **Trattamenti** nelle Azioni rapide.

#### Pagine Potatura e Trattamenti – Modulo Vigneto (aggiunte)
- **Potatura:** `modules/vigneto/views/potatura-standalone.html` – filtro vigneto/anno, tabella (tipo invernale/verde/rinnovo/spollonatura), ceppi potati, ore, costi; modal CRUD. Integrazione con `potatura-vigneto-service.js`.
- **Trattamenti:** `modules/vigneto/views/trattamenti-standalone.html` – stessa logica del frutteto, tema vigneto, integrazione con `trattamenti-vigneto-service.js`.
- Dashboard Vigneto: card **Potatura** e **Trattamenti** nelle Azioni rapide (dopo Vendemmia, prima Statistiche).

#### Piano “Potatura e Trattamenti da lavori e attività”
- Creato **`PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`** con: origine dati da Gestione lavori e Diario; riconoscimento per categoria (Potatura/Trattamenti); collegamento vigneto/frutteto tramite terreno (1:1); stesso procedimento di Vendemmia e Raccolta; creazione solo da lavoro/attività; dati base in sola lettura nelle pagine dedicate; dati aggiuntivi compilabili; implicazioni da definire in fase di analisi (dove salvare dati aggiuntivi, link lavoro ↔ record, campo categoria, relazione terreno–vigneto/frutteto).

### File toccati
- `modules/frutteto/views/potatura-standalone.html`, `modules/frutteto/views/trattamenti-standalone.html` (già presenti)
- `modules/frutteto/views/frutteto-dashboard-standalone.html` (card Potatura e Trattamenti)
- `modules/vigneto/views/potatura-standalone.html`, `modules/vigneto/views/trattamenti-standalone.html` (nuovi)
- `modules/vigneto/views/vigneto-dashboard-standalone.html` (card Potatura e Trattamenti)
- `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md` (nuovo)

### Risultato
- Moduli Vigneto e Frutteto allineati: entrambi hanno pagine Potatura e Trattamenti e card in dashboard (attualmente inserimento manuale).
- Piano scritto per l’evoluzione “dati da lavori/attività + dati aggiuntivi compilabili, base in sola lettura” da implementare in seguito.

---

## ✅ Lista condivisa Calcolo materiali, forma allevamento Pianificazione frutteto, pali frutteto, Gestione lavori Impianto Frutteto (2026-01-31) - COMPLETATO

### Obiettivo
Allineare il Calcolo materiali e la Pianificazione alla stessa lista forma di allevamento; adattare i default distanza/altezza pali per il frutteto alla forma; dare all’Impianto Nuovo Frutteto in Gestione lavori lo stesso comportamento del vigneto (form dati + creazione anagrafica alla conferma).

### Implementazione

#### Lista condivisa forma di allevamento in Calcolo materiali
- Il dropdown "Tipo impianto" in Calcolo materiali ora usa le **stesse liste** di Pianificazione nuovo impianto: **vigneto** = `getFormeAllevamentoList()`; **frutteto** = `FORME_ALLEVAMENTO_FRUTTETO` + custom da localStorage. Precompilazione da `pianificazione.formaAllevamento`; in invio al service si passa la chiave tecnica (`getChiaveTecnica` / `normalizeFormaAllevamentoToKey`). Descrizione e placeholder risolvono la config da valore selezionato (vigneto: `getConfigurazioneImpianto`).

#### Forma di allevamento in Pianificazione nuovo impianto per frutteto
- Il gruppo "Forma di allevamento" è mostrato anche per **frutteto** (e oliveto), in base a `showFormaAllevamento` nella config coltura. Precompilazione e salvataggio della forma anche per frutteto/oliveto (valore selezionato; per vigneto si continua a salvare la chiave tecnica).

#### Calcolo materiali frutteto – Distanza e altezza pali per forma
- In `TIPI_IMPIANTO_FRUTTETO` aggiunti **distanzaPali** e **altezzaPali** (metri) per forma: fusetto/leader 7 m / 3,2 m; palmetta/spalliera/cordone 4 m / 3,2 m; pergola 5 m / 3,5 m; vaso 6 m / 3 m; altro 5 m / 3 m. Nel modal Calcolo materiali, per frutteto/oliveto, al cambio forma vengono precompilati Distanza tra Pali e Altezza Pali.

#### Gestione lavori – Impianto Nuovo Frutteto come vigneto
- Scelta "Impianto Nuovo Frutteto" e pianificazione frutteto: compare il **form Dati Frutteto** (Specie, Varietà, Anno, Forma Allevamento, distanze/superficie/densità readonly, Note) con precompilazione dalla pianificazione e dropdown da `specie-fruttifere.js` + localStorage. Modali ➕ per specie/varietà/forma. Alla conferma del lavoro viene chiamata **creaFruttetoDaLavoro** che crea l’anagrafica frutteto con `createFrutteto()`. `setFruttetoFormRequired` evita che i campi del form nascosto blocchino il submit.

### File toccati
- `modules/vigneto/views/calcolo-materiali-standalone.html`, `modules/vigneto/services/calcolo-materiali-service.js`, `modules/vigneto/views/pianifica-impianto-standalone.html`
- `core/admin/gestione-lavori-standalone.html`, `core/admin/js/gestione-lavori-events.js`

### Risultato
- Stessa lista forma di allevamento in Pianificazione e Calcolo materiali (vigneto e frutteto); precompilazione corretta dalla pianificazione.
- Forma di allevamento visibile e salvata in Pianificazione anche per frutteto.
- Default distanza/altezza pali nel Calcolo materiali frutteto coerenti con la forma scelta.
- Impianto Nuovo Frutteto in Gestione lavori con form dati e creazione anagrafica alla conferma, come per il vigneto.

---

## ✅ Raccolta Frutta: sistemazione completa (zone lavorate, superficie, colonna Lavoro, Dashboard e pulsanti) (2026-01-31) - COMPLETATO

### Obiettivo
Sistemare la pagina Gestione Raccolta Frutta: sincronizzare la zona tracciata dal lavoro (zone lavorate), formattare correttamente la superficie, allineare la tabella alla Vendemmia con la colonna Lavoro e il link "Vedi Lavoro", completare la navigazione verso la dashboard del modulo Frutteto e allineare l’ordine dei pulsanti nell’header.

### Implementazione

#### Sincronizzazione zona da lavoro (zone lavorate)
- La zona tracciata dagli operai/capisquadra (`zoneLavorate` nel documento lavoro) non era visibile nelle mappe di Gestione Raccolta Frutta.
- Aggiunta la funzione `loadPoligonoFromZoneLavorate(lavoroId)` che recupera la prima zona chiusa dalla sottocollezione `zoneLavorate` del lavoro.
- In `openEditRaccolta()`: se la raccolta è collegata a un `lavoroId` e non ha ancora un poligono proprio, viene richiamata `loadPoligonoFromZoneLavorate()` per pre-popolare `poligonoCoords` con la zona del lavoro. La zona tracciata dall’operaio/caposquadra appare così nella mappa e viene salvata sul documento di raccolta al primo salvataggio.

#### Formattazione superficie (ha)
- La "Superficie raccolta (ha)" nel modal di creazione/modifica non era formattata in modo uniforme. Ora il valore viene formattato con **due decimali** (`.toFixed(2)`) quando viene letto dai dati della raccolta o dalla superficie calcolata dal lavoro collegato.

#### Colonna "Lavoro" e link "Vedi Lavoro"
- Nella tabella lista vendemmie è presente il link "🔗 Vedi Lavoro" per le righe collegate a un lavoro; nella tabella raccolte mancava. Aggiunta la colonna **Lavoro** nella tabella raccolte: se la raccolta è collegata a un lavoro, viene mostrato il link "🔗 Vedi Lavoro" (stile a tema Frutteto) che apre la pagina gestione lavori filtrata per quel lavoro.

#### Pulsante Dashboard e ordine pulsanti
- **Pulsante Dashboard**: Il link "← Dashboard" aveva `href="#"`. Impostato `href="frutteto-dashboard-standalone.html"` e listener con `resolvePath('./frutteto-dashboard-standalone.html')`.
- **Ordine pulsanti**: Allineato a Vendemmia: **Nuova raccolta** → **← Frutteti** → **← Dashboard**. Icona pulsante Frutteti uniformata da ⬅ a ←.

### File toccati
- `modules/frutteto/views/raccolta-frutta-standalone.html` (loadPoligonoFromZoneLavorate, sync in openEditRaccolta, superficie .toFixed(2), colonna Lavoro e link Vedi Lavoro, href Dashboard, listener resolvePath, ordine e stile pulsanti header).

### Risultato
- Zona tracciata dal lavoro visibile e sincronizzata nella mappa di modifica raccolta.
- Superficie raccolta (ha) sempre mostrata con due decimali.
- Tabella raccolte allineata alla Vendemmia con colonna Lavoro e link "🔗 Vedi Lavoro".
- Navigazione alla dashboard Frutteto e ordine pulsanti come in Gestione Vendemmia.

---

## ✅ Tracciamento zona, cursore e dropdown terreni (2026-01-30) - COMPLETATO

### Obiettivo
Migliorare il tracciamento dell’area nella Gestione Raccolta Frutta (cursore crosshair come in Vendemmia, snap, validazione, doppio clic) e far mostrare nei dropdown il nome del terreno e il podere invece dell’id.

### Implementazione

#### Tracciamento zona – Cursore crosshair (Raccolta Frutta)
- In Raccolta Frutta il CSS prevedeva il crosshair con `.modal-mappa-body.drawing-mode` ma la classe non veniva mai applicata.
- Aggiunte funzioni `applicaCursoreCrosshair()` e `rimuoviCursoreCrosshair()` (classe + cursore su container e div/canvas Google Maps).
- Chiamate in: avvio tracciamento, chiusura poligono (click vicino al primo punto), chiusura modal, elimina poligono.
- Toggle "Pausa tracciamento": se già in tracciamento, un click sul pulsante mette in pausa senza cancellare il poligono.
- Listener `remove_at` sul path del poligono per aggiornare superficie/punti quando si elimina un vertice.

#### Allineamento tracciamento Raccolta Frutta a Vendemmia
- **Snap**: costanti `SNAP_DISTANCE_METERS = 5`, `VERTEX_SNAP_DISTANCE_METERS = 8`; helper `findNearestVertex`, `findNearestPointOnBoundary`, `getClosestPointOnSegment`, `getDistanceToBoundary`, `movePointInsideBoundary`, `getPolygonCenterRaccolta`. Shift per disabilitare lo snap.
- **Doppio clic**: due click entro 300 ms terminano il tracciamento (come "Pausa") senza chiudere il poligono.
- **Validazione**: il punto deve essere dentro i confini del terreno; tolleranza 3 m; se agganciato al confine ma fuori, spostamento verso l’interno.
- **Feedback visivo**: marker verde (cerchio) per ~1 s quando si applica lo snap.

#### Dropdown terreni – Nome e podere al posto dell’id
- **Pagina Frutteti** (`frutteti-standalone.html`): introdotta `getTerrenoLabel(t)` (nome, podere, mai id). Dropdown "Terreno" e filtro "Tutti i terreni" usano `getTerrenoLabel(t)`. `getTerrenoNome(terrenoId)` in tabella restituisce `getTerrenoLabel(t)`.
- **Gestione Raccolta** (`raccolta-frutta-standalone.html`): caricamento terreni con `getAllTerreni()` in `loadFrutteti()`. Aggiunte `getTerrenoLabel(t)` e `getFruttetoOptionLabel(f)` (Specie Varietà – Nome terreno – Podere). Dropdown "Frutteto" e filtro mostrano questa label invece di `terrenoId`. Colonna Frutteto in tabella usa `getFruttetoOptionLabel(f)` tramite `getFruttetoLabel(fruttetoId)`.

### File toccati
- `modules/frutteto/views/raccolta-frutta-standalone.html` (cursore crosshair, helper snap/validazione, doppio clic, terreni e label dropdown/tabella).
- `modules/frutteto/views/frutteti-standalone.html` (getTerrenoLabel, dropdown e tabella con nome/podere).

### Risultato
- Tracciamento area Raccolta Frutta allineato a Vendemmia (crosshair, snap, validazione, doppio clic, marker snap).
- Nei dropdown e in tabella non compare più l’id del terreno; si vedono nome del terreno e podere (e, dove applicabile, specie/varietà).

---

## ✅ Allineamento moduli Frutteto e Vigneto (2026-01-29) - COMPLETATO

### Obiettivo
Allineare anagrafica e dashboard tra modulo Frutteto e modulo Vigneto: stesso comportamento per spese (lavori + attività da diario), elenco lavori con attività "Da diario", dettaglio spese con cambio anno automatico, totale spese sempre calcolato al volo.

### Implementazione

#### Dashboard – Totale spese e elenco lavori
- **Frutteto**: Totale spese già calcolato con `aggregaSpeseFruttetoAnno` (lavori + attività dirette diario). Elenco lavori esteso con `getAttivitaDirettePerTerreno`: in tabella compaiono sia i lavori (link "Dettaglio") sia le attività da diario (badge "Da diario"). Servizio `getStatisticheFrutteto` usa `aggregaSpeseFruttetoAnno` per il totale.
- **Vigneto**: Aggiunta card "Spese totali (€)" in dashboard; valore sempre calcolato al volo con `aggregaSpeseVignetoAnno` (non dipende da "Ricalcola spese"). Elenco lavori esteso con `getAttivitaDirettePerTerreno`: stessa tabella unificata con badge "Da diario" per attività da diario. In `lavori-vigneto-service.js` aggiunto `getAttivitaDirettePerTerreno` e `costoTotaleAnno` nel return di `aggregaSpeseVignetoAnno`; in `vigneto-statistiche-service.js` `getStatisticheVigneto` ora calcola sempre `costoTotaleAnno` al volo (singolo vigneto, tutti i vigneti, fallback).

#### Anagrafica – Dettaglio spese e selettore anno
- **Vigneto**: Sul select "Anno" del modal Dettaglio Spese aggiunto listener `change` che richiama `loadDettaglioSpese()`: cambiando anno i dettagli si ricaricano senza cliccare "Aggiorna".
- **Frutteto**: Stesso comportamento: listener `change` sul select anno nel modal Dettaglio Spese per ricaricare automaticamente i dettagli.

#### UI e documentazione
- **Frutteto**: Icona card "Gestione Raccolta Frutta" cambiata da 🧺 a 📦 (casse di frutta); stesso icona per stato vuoto "Nessuna raccolta trovata".
- **Documento indirizzo**: Creato `PIANIFICA_IMPIANTO_CALCOLO_MATERIALI_CONDIVISI.md` con decisioni per modulo condiviso Pianifica impianto e Calcolo materiali (opzione C, filtro coltura, precompilazione da terreno, modello dati unico, UX identica).

### File toccati (allineamento)
- Moduli Frutteto: `lavori-frutteto-service.js` (getAttivitaDirettePerTerreno, export), `frutteto-statistiche-service.js` (aggregaSpeseFruttetoAnno, getLavoriFrutteto con attività diario), `frutteto-dashboard-standalone.html` (tabella lavori con "Da diario", icona 📦), `frutteti-standalone.html` (listener change su select anno dettaglio spese).
- Moduli Vigneto: `lavori-vigneto-service.js` (getAttivitaDirettePerTerreno, costoTotaleAnno in aggregaSpeseVignetoAnno), `vigneto-statistiche-service.js` (getAttivitaDirettePerTerreno, getLavoriVigneto con attività diario, costoTotaleAnno sempre al volo), `vigneto-dashboard-standalone.html` (card Spese totali, tabella lavori con "Da diario", stile .badge-diario), `vigneti-standalone.html` (listener change su select anno dettaglio spese).
- Creato: `PIANIFICA_IMPIANTO_CALCOLO_MATERIALI_CONDIVISI.md`.

### Risultato
- Moduli Frutteto e Vigneto allineati su anagrafica e funzioni dashboard (totale spese lavori+diario, elenco lavori con "Da diario", dettaglio spese con anno che ricarica, totale sempre aggiornato senza "Ricalcola spese").
- Direzione chiara per modulo condiviso Pianifica impianto / Calcolo materiali.

---

## ✅ Fase 1 – Base comune moduli Frutteto/Oliveto (2026-01-27) - COMPLETATO

### Obiettivo
Preparare l’architettura per i moduli Frutteto e Oliveto riutilizzando il vigneto tramite una classe base condivisa, senza clonare codice.

### Implementazione
- ✅ **BaseColtura** (`shared/models/BaseColtura.js`): classe base con campi e metodi comuni (anagrafica, tracciamento, rese, spese/costi, validate, calcoli margini/ROI) da `PLAN_MODULI_COLTURA_SPECIALIZZATI.md`.
- ✅ **Vigneto** (`modules/vigneto/models/Vigneto.js`): ora estende `BaseColtura`; mantiene solo campi e logica specifici (tipoPalo, destinazioneUva, cantina, rese qli/ha, spese vendemmia/cantina/prodotti); compatibilità Firestore conservata (dataUltimaVendemmia, alias).
- ✅ **Verifica**: test manuale su anagrafica vigneti e vendemmia; tutto funzionante.
- ✅ **Tooling**: script `npm start` e `start-server.bat` aggiornati per usare `http-server` da dipendenze di progetto.

### File toccati
- Creato: `shared/models/BaseColtura.js`
- Modificati: `modules/vigneto/models/Vigneto.js`, `package.json`, `start-server.bat`, `GUIDA_SVILUPPO_MODULI_FRUTTETO_OLIVETO.md`
- Creato: `RIEPILOGO_LAVORI_2026-01-27.md`

### Riferimenti
- `GUIDA_SVILUPPO_MODULI_FRUTTETO_OLIVETO.md` (Fase 1 completata; prossimo: Fase 2 – Modulo Frutteto)
- `PLAN_MODULI_COLTURA_SPECIALIZZATI.md`

---

## ✅ Fix Precompilazione Coltura nei Preventivi (2026-01-05) - COMPLETATO

### Obiettivo
Risolvere il problema del dropdown coltura che rimaneva vuoto quando si selezionava un terreno nel form di creazione preventivo, nonostante dovesse essere precompilato automaticamente con i dati del terreno.

### Implementazione

#### 1. Rendere Variabile Colture Globale ✅
- **Problema**: `colturePerCategoriaPreventivo` era una variabile locale non sempre accessibile quando necessario
- **Causa**: La variabile era dichiarata con `let` nello scope locale, causando problemi di accesso tra funzioni
- **Soluzione**: 
  - Resa la variabile globale come `window.colturePerCategoriaPreventivo` (allineata con `attivita-standalone.html`)
  - Aggiornate tutte le funzioni per usare la variabile globale
  - Mantenuta anche la variabile locale per retrocompatibilità
- **File Modificati**:
  - ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` - Resa variabile globale e aggiornate tutte le referenze

#### 2. Migliorata Logica di Precompilazione Coltura ✅
- **Problema**: La coltura del terreno non veniva trovata o precompilata correttamente
- **Causa**: 
  - Le colture potevano non essere ancora caricate quando si selezionava il terreno
  - La ricerca della categoria non usava il servizio centralizzato
  - Mismatch tra ID categoria del terreno e chiavi disponibili
- **Soluzione**: 
  - Aggiunto controllo per verificare che le colture siano caricate prima di procedere
  - Implementato uso del servizio `getColturaByNome` per trovare la categoria (come in `attivita-standalone.html`)
  - Aggiunto fallback per cercare la coltura in tutte le categorie disponibili
  - Verifica che la categoria esista nel dropdown prima di usarla
  - Meccanismo di polling per attendere che il dropdown sia popolato prima di selezionare la coltura
- **File Modificati**:
  - ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` - Migliorata funzione `onTerrenoChange()` con logica robusta

#### 3. Migliorata Funzione updateColtureDropdownPreventivo ✅
- **Problema**: Il dropdown colture non veniva popolato correttamente quando cambiava la categoria
- **Causa**: 
  - Mancava verifica che le colture fossero caricate
  - Non gestiva correttamente il caso di categorie senza colture
  - Non ordinava le colture per nome
- **Soluzione**: 
  - Aggiunta verifica che `colturePerCategoriaPreventivo` sia popolato
  - Gestione caso categorie senza colture
  - Ordinamento colture per nome
  - Uso della variabile globale per accesso sicuro
- **File Modificati**:
  - ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` - Migliorata funzione `updateColtureDropdownPreventivo()`

#### 4. Aggiunti Log Dettagliati per Debug ✅
- **Obiettivo**: Facilitare il debug di problemi futuri
- **Implementazione**: 
  - Aggiunti log dettagliati in tutte le funzioni chiave:
    - `onTerrenoChange()` - Log per tracciare selezione terreno e precompilazione
    - `updateColtureDropdownPreventivo()` - Log per tracciare popolamento dropdown
    - `loadColturePerCategoriaPreventivo()` - Log per tracciare caricamento colture
    - `loadColture()` - Log per tracciare completamento caricamento
  - Log con emoji per identificazione rapida (🔵, 🟢, 🟡, ✅, ⚠️, ❌)
- **File Modificati**:
  - ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` - Aggiunti log in tutte le funzioni chiave

### Test Completati
- ✅ **Precompilazione Superficie**: Funziona correttamente quando si seleziona un terreno
- ✅ **Precompilazione Tipo Campo**: Funziona correttamente quando si seleziona un terreno
- ✅ **Precompilazione Categoria Coltura**: La categoria viene selezionata automaticamente
- ✅ **Precompilazione Coltura**: Il dropdown viene popolato e la coltura viene selezionata automaticamente
- ✅ **Gestione Colture Non Caricate**: Se le colture non sono caricate, vengono caricate automaticamente
- ✅ **Gestione Categoria Non Trovata**: Se la categoria non è trovata, viene cercata in tutte le categorie disponibili

### File Modificati
- ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html`
  - Resa variabile `colturePerCategoriaPreventivo` globale
  - Migliorata funzione `onTerrenoChange()` con logica robusta
  - Migliorata funzione `updateColtureDropdownPreventivo()`
  - Aggiunti log dettagliati per debug
  - Aggiunto uso servizio `getColturaByNome` per trovare categoria
  - Aggiunto meccanismo di polling per attendere popolamento dropdown

### Note Tecniche
- La soluzione è allineata con l'implementazione in `attivita-standalone.html` per coerenza
- I log di debug sono stati mantenuti per facilitare troubleshooting futuro
- La variabile globale garantisce accesso sicuro da tutte le funzioni

---

## ✅ Fix Caricamento Ore per Operaio e Duplicazioni in Dettaglio Lavori (2026-01-05) - COMPLETATO

### Obiettivo
Risolvere il problema della sezione "Ore per Operaio" che rimaneva in caricamento nella tab Panoramica dei dettagli lavoro, e correggere le duplicazioni delle statistiche quando si cambiava tab.

### Implementazione

#### 1. Aggiunta Sezione "Ore per Operaio" nella Panoramica ✅
- **Problema**: La sezione "Ore per Operaio" nella tab Panoramica rimaneva in caricamento e non mostrava i dati
- **Causa**: La funzione `loadDettaglioOverview` caricava solo i totali delle ore ma non raggruppava per operaio né caricava i nomi degli operai
- **Soluzione**: 
  - Aggiunta logica per raggruppare le ore per operaio (validate, da validare, rifiutate)
  - Aggiunto caricamento dei nomi degli operai dal database
  - Aggiunta sezione "Ore per Operaio" nell'HTML della Panoramica con lo stesso formato della tab "Ore"
- **File Modificati**:
  - ✅ `core/admin/js/gestione-lavori-controller.js` - Modificata `loadDettaglioOverview` per includere raggruppamento ore per operaio e caricamento nomi

#### 2. Risolto Problema Duplicazione Statistiche ✅
- **Problema**: Quando si apriva la tab "Ore" e poi si tornava alla "Panoramica", le statistiche venivano duplicate
- **Causa**: `loadDettaglioOverview` veniva chiamata due volte: una da `switchTab` e una direttamente da `openDettaglioModal`
- **Soluzione**: 
  - Rimossa la chiamata ridondante in `openDettaglioModal` (switchTab già chiama loadDettaglioOverview)
  - Aggiunto flag `isLoadingOverview` per evitare chiamate multiple simultanee
  - Migliorata pulizia del container prima di ogni caricamento
- **File Modificati**:
  - ✅ `core/admin/js/gestione-lavori-events.js` - Rimossa chiamata ridondante in `openDettaglioModal`
  - ✅ `core/admin/js/gestione-lavori-controller.js` - Aggiunto flag per evitare chiamate multiple

#### 3. Risolto Problema Scritta "Caricamento statistiche ore..." ✅
- **Problema**: La scritta "Caricamento statistiche ore..." rimaneva visibile anche dopo il caricamento
- **Causa**: Problema con la visibilità dei tab e gestione del container
- **Soluzione**: 
  - Migliorata gestione della visibilità dei tab (display: none/block)
  - Aggiunta pulizia completa del container prima di ogni caricamento
  - Rimossa doppia chiamata che causava problemi di timing
- **File Modificati**:
  - ✅ `core/admin/js/gestione-lavori-events.js` - Migliorata gestione visibilità tab in `switchTab`
  - ✅ `core/admin/js/gestione-lavori-controller.js` - Migliorata pulizia container

#### 4. Rimozione Simbolo "Poligono" dalla Lista Zone ✅
- **Problema**: Il simbolo "Poligono" nella lista delle zone lavorate era ridondante e confuso
- **Soluzione**: Rimosso l'indicatore del tipo di zona (poligono/segmento) dalla lista
- **File Modificati**:
  - ✅ `core/admin/js/gestione-lavori-maps.js` - Rimossa riga che mostrava "🔷 Poligono" o "📏 Segmento"

### Test Completati
- ✅ **Sezione Ore per Operaio**: Si carica correttamente nella tab Panoramica
- ✅ **Nessuna duplicazione**: Le statistiche non si duplicano più quando si cambia tab
- ✅ **Scritta caricamento**: Non rimane più visibile dopo il caricamento
- ✅ **Lista zone**: Più pulita senza simbolo "Poligono"

### Risultato
- ✅ **Problema caricamento risolto**: La sezione "Ore per Operaio" si carica correttamente nella Panoramica
- ✅ **Problema duplicazione risolto**: Le statistiche non si duplicano più
- ✅ **Problema scritta risolto**: La scritta di caricamento non rimane più visibile
- ✅ **UI migliorata**: Lista zone più pulita senza simboli ridondanti
- ✅ **Codice pulito**: Tutti i log di debug rimossi

---

## ✅ Fix Dropdown Attrezzi e Tipo Assegnazione in Gestione Lavori (2026-01-03) - COMPLETATO

### Obiettivo
Risolvere il problema del dropdown attrezzi che non compariva quando si selezionava un trattore nel modulo conto terzi, e correggere il problema del tipo di assegnazione dove il caposquadra rimaneva obbligatorio anche per lavori autonomi.

### Implementazione

#### 1. Fix Dropdown Attrezzi Non Visibile ✅
- **Problema**: Quando si creava un lavoro nel modulo conto terzi e si selezionava un trattore, il dropdown degli attrezzi non compariva
- **Causa**: `setupMacchineHandlers` non veniva chiamato quando il modal veniva aperto, quindi il listener sul cambio del trattore non era configurato
- **Soluzione**: 
  - Aggiunto `MutationObserver` che monitora quando il modal lavoro diventa attivo
  - Quando il modal diventa attivo, vengono configurati automaticamente sia `setupTipoAssegnazioneHandlers` che `setupMacchineHandlers`
  - Questo garantisce che gli handler siano sempre configurati, indipendentemente da come viene aperto il modal
- **File Modificati**:
  - ✅ `core/admin/gestione-lavori-standalone.html` - Aggiunto MutationObserver per configurare handler quando modal diventa attivo
  - ✅ `core/admin/js/gestione-lavori-events.js` - Migliorato `setupMacchineHandlers` per gestire correttamente il cambio trattore

#### 2. Fix Tipo Assegnazione (Caposquadra Obbligatorio) ✅
- **Problema**: Quando si selezionava "Lavoro Autonomo", il caposquadra rimaneva obbligatorio invece di diventare opzionale
- **Causa**: I listener sui radio button venivano persi quando gli elementi venivano clonati o ricreati
- **Soluzione**: 
  - Cambiato approccio da listener diretti sui radio button a event delegation sul form
  - Event delegation funziona anche quando gli elementi vengono clonati o ricreati
  - La funzione `updateVisibility()` riacquista i riferimenti ai radio button ogni volta per essere sicuri
- **File Modificati**:
  - ✅ `core/admin/js/gestione-lavori-events.js` - Modificato `setupTipoAssegnazioneHandlers` per usare event delegation sul form

#### 3. Pulizia Log di Debug ✅
- **Obiettivo**: Rimuovere tutti i log di debug aggiunti durante il troubleshooting
- **File Modificati**:
  - ✅ `core/admin/gestione-lavori-standalone.html` - Rimossi log da `loadAttrezziWrapper`, `populateTrattoriDropdownWrapper`, `populateAttrezziDropdownWrapper`, `setupMacchineHandlersWrapper`, `openCreaModalWrapper`, e MutationObserver
  - ✅ `core/admin/js/gestione-lavori-events.js` - Rimossi log da `setupTipoAssegnazioneHandlers`, `setupMacchineHandlers`, e `openCreaModal`
  - ✅ `core/admin/js/gestione-lavori-controller.js` - Rimossi log da `populateAttrezziDropdown` e `populateTrattoriDropdown`

### Test Completati
- ✅ **Dropdown attrezzi**: Compare correttamente quando si seleziona un trattore
- ✅ **Tipo assegnazione squadra**: Caposquadra obbligatorio, operaio nascosto
- ✅ **Tipo assegnazione autonomo**: Operaio obbligatorio, caposquadra non obbligatorio e nascosto
- ✅ **Modal observer**: Handler configurati correttamente quando il modal diventa attivo
- ✅ **Event delegation**: Funziona correttamente anche quando gli elementi vengono ricreati

### Risultato
- ✅ **Problema dropdown attrezzi risolto**: Il dropdown ora compare correttamente quando si seleziona un trattore
- ✅ **Problema tipo assegnazione risolto**: Il caposquadra non è più obbligatorio per lavori autonomi
- ✅ **Codice pulito**: Tutti i log di debug rimossi
- ✅ **Robustezza migliorata**: Event delegation garantisce che gli handler funzionino anche quando gli elementi vengono ricreati

---

## ✅ Fix Dropdown Tipi Lavoro Multitenant e Pulizia Log (2026-01-03) - COMPLETATO

### Obiettivo
Risolvere il problema del dropdown tipi di lavoro vuoto durante il test multitenant e pulire i log di debug non necessari.

### Implementazione

#### 1. Fix Dropdown Tipi Lavoro Vuoto ✅
- **Problema**: Il dropdown dei tipi di lavoro specifico rimaneva vuoto dopo aver selezionato categoria principale e sottocategoria
- **Causa**: Il tenant "rosso" non aveva tipi di lavoro inizializzati nella collection `tenants/{tenantId}/tipiLavoro`
- **Soluzione**: 
  - Aggiunto controllo automatico in `loadTipiLavoro()`: se la collection è vuota, inizializza automaticamente i tipi predefiniti
  - La funzione `initializeTipiLavoroPredefiniti()` viene chiamata automaticamente quando necessario
  - Aggiunti log dettagliati per tracciare il flusso (poi rimossi dopo il fix)
- **File Modificati**:
  - ✅ `core/js/attivita-controller.js` - Aggiunto controllo e inizializzazione automatica in `loadTipiLavoro()`
  - ✅ `core/services/tipi-lavoro-service.js` - Migliorati log in `initializeTipiLavoroPredefiniti()` e `getAllTipiLavoro()`
  - ✅ `core/services/firebase-service.js` - Aggiunti log in `getCollectionData()` e `getCollection()` (poi rimossi)

#### 2. Pulizia Log di Debug ✅
- **Obiettivo**: Rimuovere tutti i log di debug non necessari per produzione
- **File Modificati**:
  - ✅ `core/js/attivita-controller.js` - Rimossi log da `loadTipiLavoro()` e `populateTipoLavoroDropdown()`
  - ✅ `core/services/tipi-lavoro-service.js` - Rimossi log da `getAllTipiLavoro()` e `initializeTipiLavoroPredefiniti()`
  - ✅ `core/services/firebase-service.js` - Rimossi log da `getCollectionData()` e `getCollection()`
  - ✅ `core/js/terreni-events.js` - Rimossi log da `handleSaveTerreno()`
  - ✅ `core/js/terreni-maps.js` - Rimossi log da `initMap()`, `toggleDrawing()`, click listener
  - ✅ `core/js/terreni-tour.js` - Rimosso log da tooltip
  - ✅ `core/terreni-standalone.html` - Rimossi log da `updateState()`, `initMapWrapper()`, `toggleDrawingWrapper()`
  - ✅ `core/attivita-standalone.html` - Rimossi log da callback `populateTipoLavoroDropdownCallback`

### Test Completati
- ✅ **Inizializzazione automatica**: 66 tipi di lavoro creati automaticamente per il tenant "rosso"
- ✅ **Dropdown popolato**: Dropdown funziona correttamente per tutte le categorie e sottocategorie
- ✅ **Filtri categoria**: Filtro per categoria principale e sottocategoria funzionante
- ✅ **Salvataggio attività**: Attività salvata con successo con tipo di lavoro selezionato

### Risultato
- ✅ **Problema risolto**: Il dropdown ora si popola correttamente dopo la selezione di categoria/sottocategoria
- ✅ **Codice pulito**: Tutti i log di debug rimossi, mantenuti solo `console.error` per errori critici
- ✅ **Inizializzazione automatica**: I tipi di lavoro vengono inizializzati automaticamente per nuovi tenant

---

## ✅ Test Multitenant e Fix Tracciamento Terreni (2026-01-03) - COMPLETATO

### Obiettivo
Testare il sistema multitenant con nuovo utente e risolvere problemi nel tracciamento e salvataggio dei confini dei terreni.

### Implementazione

#### 1. Fix Tracciamento Confini Terreno ✅
- **Problema**: Click listener sulla mappa non rilevava correttamente lo stato `isDrawing`
- **Causa**: Il listener usava `state.isDrawing` dalla closure invece dello state corrente
- **Soluzione**: 
  - Modificato `initMap()` per accettare parametro `getState` che legge sempre lo state corrente
  - Click listener ora usa `getState()` invece di `state` dalla closure
- **File Modificati**:
  - ✅ `core/js/terreni-maps.js` - Aggiunto parametro `getState`, modificato click listener
  - ✅ `core/terreni-standalone.html` - Modificato `initMapWrapper()` per passare `getState`, rimosso `window.toggleDrawing` duplicato

#### 2. Fix Salvataggio Terreno - Async/Await ✅
- **Problema**: Errore `Cannot use 'in' operator to search for '_delegate' in undefined` durante salvataggio
- **Causa**: `getTerreniCollection()` è async ma veniva chiamata senza `await`, restituendo Promise invece di collection reference
- **Soluzione**: 
  - Aggiunto `await` a tutte le chiamate di `getTerreniCollectionCallback()`
  - Aggiunto controllo per verificare che la collection non sia `null` o `undefined`
- **File Modificati**:
  - ✅ `core/js/terreni-events.js` - Aggiunto `await` in `handleSaveTerreno()` e `handleDeleteTerreno()`

#### 3. Fix Conversione Coordinate Poligono ✅
- **Problema**: Coordinate poligono non venivano salvate correttamente in Firestore
- **Causa**: Oggetti `LatLng` di Google Maps non sono serializzabili direttamente
- **Soluzione**: 
  - Creata funzione helper `getLatLng()` che gestisce sia oggetti `LatLng` (con metodi) che oggetti semplici (con proprietà)
  - Migliorata conversione coordinate per Firestore
  - Aggiunta pulizia dati (rimozione `undefined` e `null`)
- **File Modificati**:
  - ✅ `core/js/terreni-events.js` - Aggiunta funzione `getLatLng()`, migliorata conversione coordinate

#### 4. Aggiunta Log per Debugging ✅
- **File Modificati**:
  - ✅ `core/js/terreni-maps.js` - Log per inizializzazione mappa, click, toggle drawing
  - ✅ `core/js/terreni-events.js` - Log per salvataggio, collection reference, dati
  - ✅ `core/terreni-standalone.html` - Log per updateState, wrapper functions

### Test Completati
- ✅ **Registrazione nuovo utente**: Crea correttamente nuovo tenant con ruolo `amministratore`
- ✅ **Tracciamento confini**: Funziona correttamente, poligono visualizzato sulla mappa
- ✅ **Creazione terreno con poligono**: Terreno salvato correttamente in Firestore con coordinate
- ✅ **Calcolo superficie**: Superficie calcolata automaticamente dal poligono
- ✅ **Permessi Firestore**: Solo manager/admin possono creare terreni (verificato)

### Risultati
- ✅ **3 problemi critici risolti** (tracciamento, salvataggio, conversione coordinate)
- ✅ **Sistema multitenant testato e funzionante**
- ✅ **Log completi** per facilitare debugging futuro
- ✅ **Codice più robusto** con gestione errori migliorata

### Documentazione
- ✅ Creato documento dedicato: `TEST_MULTITENANT_2026-01-03.md` con dettagli completi

---

## ✅ Completamento Standardizzazione Servizi (2026-01-03) - COMPLETATO

### Obiettivo
Completare la standardizzazione dei servizi centralizzati migrando tutti i file rimanenti a usare `service-helper.js` per macchine e terreni, risolvendo problemi di indici Firestore e garantendo che tutti i campi necessari siano disponibili.

### Implementazione

#### 1. Migrazione Segnatura Ore - Macchine ✅
- **File**: `core/segnatura-ore-standalone.html`
- **Modifica**: Sostituita funzione `loadMacchine()` (~70 righe) con versione che usa `loadMacchineViaService` (~15 righe)
- **Risultato**: Codice semplificato, pattern standardizzato, fallback automatico per ambiente `file://`

#### 2. Migrazione Attività - Terreni ✅
- **File**: `core/js/attivita-controller.js`
- **Modifica**: Migrato `loadTerreni()` a usare `loadTerreniViaService`
- **Caratteristiche**:
  - Supporto modalità Conto Terzi (carica terreni aziendali + clienti se necessario)
  - Mantenuta logica di filtraggio lato client per compatibilità
  - Aggiunti parametri `app` e `auth` alla funzione
- **File Modificati**:
  - ✅ `core/js/attivita-controller.js` - Funzione `loadTerreni()` migrata
  - ✅ `core/attivita-standalone.html` - Wrapper aggiornato per passare `app` e `auth`

#### 3. Migrazione Dashboard Maps - Terreni ✅
- **File**: `core/js/dashboard-maps.js`
- **Modifica**: Migrato caricamento terreni a usare `loadTerreniViaService`
- **Fix**: Ripristinati `collection` e `getDocs` nelle dependencies (necessari per funzioni interne)
- **File Modificati**:
  - ✅ `core/js/dashboard-maps.js` - Caricamento terreni migrato, dependencies corrette
  - ✅ `core/dashboard-standalone.html` - Aggiunto `app` alle dependencies

#### 4. Migrazione Terreni Clienti - Terreni ✅
- **File**: `modules/conto-terzi/views/terreni-clienti-standalone.html`
- **Modifica**: Migrato `loadTerreni()` a usare `loadTerreniViaService` con filtro `clienteId`
- **Fix**: Corretto percorso import da `../../../../` a `../../../`
- **Risultato**: Codice semplificato (~30 righe → ~15 righe)

#### 5. Fix Indice Composito Firestore ✅
- **Problema**: Query con filtro `clienteId` + `orderBy` richiedono indice composito Firestore
- **Soluzione**: 
  - Modificato `terreni-service.js` per filtrare/ordinare lato client quando c'è `clienteId`
  - Modificato `fallbackDirectFirestore` in `service-helper.js` per gestire stesso caso
  - Evita necessità di creare indici compositi
- **File Modificati**:
  - ✅ `core/services/terreni-service.js` - Gestione filtro lato client per `clienteId`
  - ✅ `core/services/service-helper.js` - Fallback intelligente per indice composito

#### 6. Fix Campo Coltura - Precompilazione Diario Attività ✅
- **Problema**: Campo `coltura` non disponibile nei terreni caricati, precompilazione non funzionava
- **Causa**: Modello `Terreno` non includeva `coltura` nel costruttore
- **Soluzione**:
  - Aggiunto `coltura` al modello `Terreno` (costruttore e documentazione)
  - Modificato `terreni-service.js` per salvare dati originali come `_originalData`
  - Migliorato converter in `service-helper.js` per preferire dati originali
- **File Modificati**:
  - ✅ `core/models/Terreno.js` - Aggiunto campo `coltura`
  - ✅ `core/services/terreni-service.js` - Salvataggio dati originali
  - ✅ `core/services/service-helper.js` - Converter migliorato per preservare `coltura`

### Risultati
- ✅ **4 file migrati** a usare servizi centralizzati
- ✅ **~150+ righe di codice** rimosse (duplicazione eliminata)
- ✅ **Pattern standardizzato** in tutta l'applicazione
- ✅ **Precompilazione coltura** funzionante nel diario attività
- ✅ **Gestione indici** automatica (evita errori Firestore)
- ✅ **Nessun errore linting**

### Test Completati
- ✅ `core/attivita-standalone.html` - Dropdown terreni e precompilazione coltura funzionanti
- ✅ `core/dashboard-standalone.html` - Mappa aziendale con terreni funzionante
- ✅ `modules/conto-terzi/views/terreni-clienti-standalone.html` - Caricamento terreni cliente funzionante
- ✅ `core/segnatura-ore-standalone.html` - **Flusso completo testato e funzionante**:
  - Creazione lavoro e assegnazione all'operaio ✅
  - Segnatura ore da parte dell'operaio (trattorista) ✅
  - Comunicazione ore al manager ✅
  - Validazione ore da parte del manager ✅
  - Tracciamento zona lavorata (visibile in dashboard) ✅
  - Ore validate visibili dall'operaio dopo validazione ✅
  - Alert superamento soglia ore manutenzione trattore/attrezzo ✅

---

## ✅ Fix Service Worker e Correzioni Moduli Attività (2026-01-03) - COMPLETATO

### Obiettivo
Risolvere errori nel service worker e correggere problemi nei moduli attività relativi a wrapper mancanti e filtri categorie.

### Implementazione

#### 1. Fix Service Worker - Errore "Failed to convert value to 'Response'" ✅
- **Problema**: Service worker restituiva errori "Failed to convert value to 'Response'" per alcune richieste
- **Causa**: Promise che poteva risolvere con `undefined` o errori non gestiti correttamente
- **Soluzione**: 
  - Riscritto handler fetch per garantire sempre una `Response` valida
  - Aggiunto catch finale per gestire tutti i casi edge
  - Verifiche esplicite che ogni risposta sia un'istanza valida di `Response`
  - Gestione corretta fallback cache con risposte di errore valide
- **File Modificati**:
  - ✅ `service-worker.js` - Riscritto handler fetch con gestione errori robusta

#### 2. Fix populateSottocategorieLavoro - Wrapper Mancante ✅
- **Problema**: Errore `Cannot read properties of undefined (reading 'get')` quando si modifica un'attività
- **Causa**: Alla riga 2538 veniva passato `populateSottocategorieLavoroModule` invece del wrapper `populateSottocategorieLavoro`
- **Soluzione**: 
  - Corretto passaggio del wrapper invece del modulo direttamente
  - Il wrapper gestisce correttamente il passaggio di `sottocategorieLavoriMap` al modulo
- **File Modificati**:
  - ✅ `core/attivita-standalone.html` - Corretto passaggio wrapper alla riga 2538

#### 3. Fix populateTrattoriDropdown - Wrapper Mancante ✅
- **Problema**: Errore `macchineList.filter is not a function` quando si modifica un'attività
- **Causa**: Alla riga 2542 veniva passato `populateTrattoriDropdownModule` invece del wrapper `populateTrattoriDropdown`
- **Soluzione**: 
  - Corretto passaggio del wrapper invece del modulo direttamente
  - Il wrapper gestisce correttamente il caso in cui viene chiamato con solo l'ID trattore
  - Corretto anche `populateAttrezziDropdown` per coerenza
- **File Modificati**:
  - ✅ `core/attivita-standalone.html` - Corretto passaggio wrapper alle righe 2542-2543

#### 4. Filtro Categorie di Test - Esclusione "test categoria refactoring" ✅
- **Problema**: Categoria di test "test categoria refactoring" appariva nei dropdown categorie lavori
- **Causa**: Categoria presente nei dati Firestore e caricata senza filtri
- **Soluzione**: 
  - Aggiunto filtro per escludere categorie il cui nome contiene "test" (case-insensitive)
  - Applicato in tutti i punti dove vengono caricate categorie lavori:
    - Core: `attivita-controller.js` (2 posti: file:// e servizio)
    - Admin: `gestione-lavori-controller.js`
    - Conto Terzi: `nuovo-preventivo-standalone.html` (2 posti)
    - Conto Terzi: `tariffe-standalone.html` (2 posti)
- **File Modificati**:
  - ✅ `core/js/attivita-controller.js` - Aggiunto filtro esclusione categorie test
  - ✅ `core/admin/js/gestione-lavori-controller.js` - Aggiunto filtro esclusione categorie test
  - ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` - Aggiunto filtro esclusione categorie test
  - ✅ `modules/conto-terzi/views/tariffe-standalone.html` - Aggiunto filtro esclusione categorie test

### Vantaggi
- ✅ **Service Worker Stabile**: Nessun errore "Failed to convert value to 'Response'"
- ✅ **Modifica Attività Funzionante**: Nessun errore quando si modifica un'attività
- ✅ **Dropdown Puliti**: Categorie di test non appaiono più nei dropdown
- ✅ **Coerenza**: Stesso comportamento in tutti i moduli (core, admin, conto terzi)

### Stato
✅ **COMPLETATO** (2026-01-03)

Il service worker funziona correttamente senza errori, la modifica delle attività funziona senza problemi e le categorie di test sono filtrate in tutti i moduli.

---

## ✅ Fix Logout e Miglioramenti Comunicazione Rapida (2025-12-28) - COMPLETATO

### Obiettivo
Risolvere problemi di logout per account caposquadra e migliorare la funzionalità di comunicazione rapida con feedback all'utente e riepilogo nella dashboard.

### Implementazione

#### 1. Fix Logout Caposquadra ✅
- **Problema**: Errore `ReferenceError: manutenzioniUnsubscribe is not defined` durante il logout
- **Causa**: Variabili `manutenzioniUnsubscribe` e `guastiUnsubscribe` usate ma non dichiarate
- **Soluzione**: 
  - Dichiarate variabili all'inizio dello script module in `dashboard-standalone.html`
  - Inizializzate a `null` per gestire correttamente la pulizia dei listener real-time
- **File Modificati**:
  - ✅ `core/dashboard-standalone.html` - Aggiunte dichiarazioni variabili

#### 2. Miglioramento Comunicazione Rapida ✅
- **Problema**: Comunicazione rapida non mostrava messaggi di errore o successo
- **Soluzione**:
  - Migliorato wrapper `handleSendComunicazioneRapida` con controlli completi
  - Aggiunti messaggi di errore chiari per ogni caso:
    - Utente non autenticato
    - Dati utente non trovati
    - Tenant non trovato
    - Nessun lavoro attivo disponibile
  - Aggiunto logging per debug
  - Migliorata gestione errori nella funzione del modulo
  - Aggiunto logging quando comunicazione viene inviata con successo
- **File Modificati**:
  - ✅ `core/dashboard-standalone.html` - Wrapper migliorato con controlli
  - ✅ `core/js/dashboard-events.js` - Gestione errori migliorata, logging aggiunto

#### 3. Riepilogo Comunicazioni Inviate nella Dashboard Caposquadra ✅
- **Obiettivo**: Mostrare riepilogo comunicazioni inviate con statistiche conferme direttamente nella dashboard
- **Implementazione**:
  - Creata funzione `loadComunicazioniInviateCaposquadra` in `dashboard-data.js`
  - Aggiunta sezione "Comunicazioni Inviate" nella dashboard caposquadra
  - Mostra solo l'ultima comunicazione inviata con:
    - Podere e terreno
    - Data e orario formattati
    - Statistiche conferme colorate (rosso <50%, giallo ≥50%, verde 100%)
    - Badge stato (Attiva/Completata)
    - Link Google Maps se coordinate disponibili
  - Link "Vedi tutte →" per andare alle Impostazioni se ci sono più comunicazioni
- **File Modificati**:
  - ✅ `core/js/dashboard-data.js` - Funzione `loadComunicazioniInviateCaposquadra`
  - ✅ `core/js/dashboard-sections.js` - Sezione HTML comunicazioni inviate
  - ✅ `core/js/dashboard-controller.js` - Integrazione chiamata funzione
  - ✅ `core/dashboard-standalone.html` - Import e callback aggiunti

### Vantaggi
- ✅ **Logout Funzionante**: Nessun errore durante logout per tutti i ruoli
- ✅ **Feedback Utente**: Messaggi chiari durante invio comunicazione rapida
- ✅ **Visibilità Conferme**: Caposquadra vede subito statistiche conferme nella dashboard
- ✅ **UX Migliorata**: Informazioni importanti sempre visibili senza navigare

### Stato
✅ **COMPLETATO** (2025-12-28)

Il logout funziona correttamente per tutti i ruoli e la comunicazione rapida fornisce feedback chiaro all'utente. Il caposquadra può vedere immediatamente le statistiche delle conferme nella dashboard.

---

## ✅ Link Impostazioni nell'Header (2025-12-24) - COMPLETATO

### Obiettivo
Aggiungere il link alle impostazioni nell'header delle pagine chiave per permettere accesso rapido senza dover tornare alla dashboard, migliorando la navigazione e l'usabilità.

### Implementazione

#### 1. Link Impostazioni nell'Header ✅
- **Pagine Modificate**: 9 pagine selezionate dove è necessario configurare elementi (tipi lavoro, colture, poderi, categorie, ecc.)
- **Stile**: Coerente con dashboard (icona ⚙️ + testo "Impostazioni")
- **Posizionamento**: Nell'header-actions, prima del link Dashboard
- **Visibilità**: Link nascosto di default, mostrato solo a Manager/Amministratore

#### 2. Pagine Core Base ✅
- **File**: `core/terreni-standalone.html`
  - Link per aggiungere rapidamente poderi, colture
- **File**: `core/attivita-standalone.html`
  - Link per aggiungere rapidamente tipi lavoro, colture

#### 3. Pagine Admin/Manodopera ✅
- **File**: `core/admin/gestione-lavori-standalone.html`
  - Link per aggiungere rapidamente tipi lavoro
- **File**: `core/admin/gestione-macchine-standalone.html`
  - Link per aggiungere rapidamente categorie attrezzi
- **File**: `core/admin/gestisci-utenti-standalone.html`
  - Link per configurare ruoli/permessi
- **File**: `core/segnatura-ore-standalone.html`
  - Link per aggiungere rapidamente tipi lavoro

#### 4. Pagine Modulo Conto Terzi ✅
- **File**: `modules/conto-terzi/views/preventivi-standalone.html`
  - Link per aggiungere rapidamente tipi lavoro, colture
- **File**: `modules/conto-terzi/views/nuovo-preventivo-standalone.html`
  - Link per aggiungere rapidamente tipi lavoro, colture
- **File**: `modules/conto-terzi/views/tariffe-standalone.html`
  - Link per aggiungere rapidamente colture, tipi lavoro

#### 5. Logica Permessi ✅
- **Controllo Ruoli**: Verifica ruoli utente dopo caricamento dati
- **Visibilità Condizionale**: Link mostrato solo se utente ha ruolo Manager o Amministratore
- **Percorsi Relativi**: Percorsi corretti per ogni pagina (core, admin, moduli)

### File Modificati
- ✅ `core/terreni-standalone.html` - Aggiunto link + logica permessi
- ✅ `core/attivita-standalone.html` - Aggiunto link + logica permessi
- ✅ `core/admin/gestione-lavori-standalone.html` - Aggiunto link + logica permessi
- ✅ `core/admin/gestione-macchine-standalone.html` - Aggiunto link + logica permessi
- ✅ `core/admin/gestisci-utenti-standalone.html` - Aggiunto link + logica permessi
- ✅ `core/segnatura-ore-standalone.html` - Aggiunto link + logica permessi
- ✅ `modules/conto-terzi/views/preventivi-standalone.html` - Aggiunto link + logica permessi
- ✅ `modules/conto-terzi/views/nuovo-preventivo-standalone.html` - Aggiunto link + logica permessi
- ✅ `modules/conto-terzi/views/tariffe-standalone.html` - Aggiunto link + logica permessi

### Vantaggi
- ✅ **Navigazione Migliorata**: Accesso rapido alle impostazioni senza tornare alla dashboard
- ✅ **UX Coerente**: Stesso stile e comportamento della dashboard in tutte le pagine
- ✅ **Sicurezza**: Link visibile solo agli utenti autorizzati
- ✅ **Produttività**: Risparmio di tempo quando serve configurare elementi mancanti

### Stato
✅ **COMPLETATO** (2025-12-24)

Il link alle impostazioni è ora disponibile nelle pagine chiave dove è necessario configurare elementi, migliorando significativamente la navigazione e l'usabilità dell'applicazione.

---

## ✅ Segnalazione Guasti Generici e Mappa Interattiva (2025-12-24) - COMPLETATO

### Obiettivo
Aggiungere la possibilità di segnalare guasti "generici" non legati a macchine/attrezzature (frane, voragini, problemi infrastrutturali, ecc.) e implementare una mappa interattiva per la localizzazione precisa del problema.

### Implementazione

#### 1. Sistema Segnalazione Guasti Generici ✅
- **File**: `core/admin/segnalazione-guasti-standalone.html`
- **Modifiche**:
  - Aggiunto radio button per scegliere tra "Guasto Macchina/Attrezzo" e "Segnalazione Generica"
  - Sezione form dinamica che mostra campi diversi in base al tipo selezionato
  - Campi specifici per guasti generici:
    - `ubicazione`: Campo testo per indicare dove si trova il problema
    - `tipoProblema`: Dropdown con opzioni (Frana, Voragine, Danno infrastruttura, ecc.)
    - Pre-compilazione automatica ubicazione dal lavoro corrente (podere + terreno)
  - Salvataggio dati: `tipoGuasto: 'generico'`, `ubicazione`, `tipoProblema`, `coordinateProblema` (se marker posizionato)

#### 2. Mappa Interattiva con Marker ✅
- **File**: `core/admin/segnalazione-guasti-standalone.html`
- **Funzionalità**:
  - Container mappa Google Maps (400px altezza) nella sezione generico
  - Visualizzazione confini terreno (poligono rosso) se disponibili
  - Click sulla mappa per posizionare marker rosso draggable
  - Salvataggio coordinate precise del marker (`coordinateProblema: {lat, lng}`)
  - Feedback visivo: status text che mostra coordinate in tempo reale
  - Info window sul marker con coordinate precise
  - Cursore crosshair sulla mappa per indicare interattività
- **Caricamento API**:
  - Caricamento diretto `google-maps-config.js` (come altri file)
  - Gestione asincrona con callback per inizializzazione corretta
  - Verifica completa che Google Maps sia caricato prima di usare API

#### 3. Visualizzazione Guasti Generici ✅
- **File**: `core/admin/gestione-guasti-standalone.html`
- **Modifiche**:
  - Filtro per tipo guasto (Macchina/Generico)
  - Badge distintivo "🌍 Generico" per guasti generici
  - Visualizzazione `ubicazione` e `tipoProblema` nei dettagli
  - Link "Visualizza sulla mappa" per guasti con coordinate (apre Google Maps con marker)
  - Gestione coordinate in diversi formati (oggetto, GeoPoint Firestore)
- **File**: `core/dashboard-standalone.html`
- **Modifiche**:
  - Visualizzazione guasti generici nella dashboard manager
  - Icona 🌍 per guasti generici
  - Titolo formato: "Tipo Problema - Ubicazione"
  - Sezione "Ultimi Risolti" aggiornata per gestire guasti generici

#### 4. Fix Permessi Firestore Utenti ✅
- **File**: `core/admin/gestione-guasti-standalone.html`
- **Problema**: `loadUsers()` cercava di leggere tutti gli utenti senza filtri, violando regole Firestore
- **Soluzione**: Aggiunto filtro per `tenantId` usando query:
  ```javascript
  const q = query(usersRef, where('tenantId', '==', currentTenantId));
  ```
- **Risultato**: Nomi operai ora visualizzati correttamente (non più "Operaio sconosciuto")

#### 5. Link Visualizzazione Mappa Guasti ✅
- **File**: `core/admin/gestione-guasti-standalone.html`
- **Funzionalità**:
  - Pulsante "🗺️ Visualizza sulla mappa" per guasti generici con coordinate
  - Link diretto a Google Maps con zoom 18 sul punto esatto
  - Visualizzazione coordinate testuali sotto il pulsante
  - Gestione diversi formati coordinate (retrocompatibilità)

#### 6. Filtri e Query Aggiornati ✅
- **File**: `core/admin/gestione-macchine-standalone.html`
- **Modifiche**:
  - Query storico guasti filtra solo `tipoGuasto === 'macchina'`
  - Guasti generici non appaiono nello storico macchine
- **File**: `core/admin/gestione-guasti-standalone.html`
- **Modifiche**:
  - Filtro dropdown per tipo guasto
  - Logica filtri aggiornata per includere tipo guasto

### File Modificati
- ✅ `core/admin/segnalazione-guasti-standalone.html` - Form con tipo guasto, mappa interattiva, pre-compilazione ubicazione
- ✅ `core/admin/gestione-guasti-standalone.html` - Visualizzazione guasti generici, link mappa, fix permessi utenti
- ✅ `core/dashboard-standalone.html` - Visualizzazione guasti generici in dashboard
- ✅ `core/admin/gestione-macchine-standalone.html` - Filtro tipo guasto nello storico

### Vantaggi
- ✅ **Segnalazioni complete**: Possibilità di segnalare qualsiasi problema, non solo guasti macchine
- ✅ **Localizzazione precisa**: Marker sulla mappa per indicare punto esatto del problema
- ✅ **Visualizzazione confini**: Confini terreno visibili per contesto geografico
- ✅ **Link diretto mappa**: Manager può aprire Google Maps con un click per vedere posizione precisa
- ✅ **Dati operai corretti**: Nomi operai visualizzati correttamente grazie a fix permessi
- ✅ **Retrocompatibilità**: Guasti esistenti senza `tipoGuasto` default a 'macchina'

### Stato
✅ **COMPLETATO** (2025-12-24)

Il sistema ora supporta segnalazioni generiche con localizzazione precisa tramite mappa interattiva, migliorando significativamente la capacità di tracciare e gestire problemi sul campo.

---

## 🎯 Distinzione Importante

### "Core" = Fondamenta Tecniche (Quello che abbiamo fatto)

Il **core** che abbiamo sviluppato finora è la **base tecnica** dell'applicazione:

```
core/
├── services/          ✅ Servizi base (backend/logica)
│   ├── firebase-service.js      # Operazioni database
│   ├── auth-service.js          # Autenticazione
│   ├── tenant-service.js        # Multi-tenant
│   ├── permission-service.js    # Controllo permessi
│   └── role-service.js            # Gestione ruoli
│
└── models/            ✅ Modelli dati base
    ├── Base.js        # Classe base per modelli
    └── User.js         # Modello utente
```

**Cosa fa**: Fornisce le funzionalità base che TUTTE le parti dell'app useranno.

---

### "Applicazione" = Core + Moduli + UI (Da sviluppare)

L'applicazione completa includerà:

```
gfv-platform/
├── core/              ✅ FATTO - Servizi base
│   ├── services/      ✅ FATTO
│   ├── models/        ✅ FATTO
│   ├── auth/          ❌ DA FARE - UI autenticazione
│   ├── tenant/        ❌ DA FARE - UI gestione tenant
│   └── subscription/  ❌ DA FARE - UI abbonamenti
│
├── modules/           ✅ IN SVILUPPO - Moduli applicativi
│   ├── conto-terzi/   ✅ Fase 1 MVP completata (2025-12-07)
│   │   ├── models/Cliente.js
│   │   ├── services/clienti-service.js
│   │   └── views/ (3 pagine)
│   ├── parco-macchine/ ✅ Completato
│   ├── vendemmia/     ❌ Da refactorizzare da vecchia app
│   ├── clienti/       ❌ Da refactorizzare da vecchia app
│   ├── bilancio/      ❌ Da refactorizzare da vecchia app
│   └── ...
│
└── shared/            ❌ DA SVILUPPARE - Componenti condivisi
    ├── components/    ❌ Widget riutilizzabili
    ├── utils/         ❌ Utility functions
    └── styles/        ❌ Stili globali
```

---

## ✅ Cosa Abbiamo Fatto (Core Base)

### 1. Servizi Core ✅
- **Firebase Service**: Operazioni database con multi-tenant
- **Auth Service**: Login, registrazione, gestione sessione
- **Tenant Service**: Isolamento dati per tenant
- **Permission Service**: Controllo permessi basato su ruoli
- **Role Service**: Assegnazione/rimozione ruoli

### 2. Modelli Base ✅
- **Base Model**: Classe base per tutti i modelli
- **User Model**: Modello utente con ruoli e tenant

### 3. Configurazione ✅
- **Firebase**: Progetto configurato (Web, Android, iOS)
- **Git**: Repository separato creato

---

## ❌ Cosa Manca (Applicazione Completa)

### 1. UI Core (Da sviluppare)
- **auth/**: Pagine login, registrazione, reset password
- **tenant/**: Gestione tenant, configurazione azienda
- **subscription/**: Gestione abbonamenti, moduli attivi

### 2. Moduli Applicativi (Da sviluppare/refactorizzare)
- **vendemmia/**: Calcolatore vendemmia (da vecchia app)
- **clienti/**: Anagrafica clienti (da vecchia app)
- **bilancio/**: Report e statistiche (da vecchia app)

### 3. Componenti Condivisi (Da sviluppare)
- **components/**: Widget riutilizzabili (bottoni, form, tabelle)
- **utils/**: Funzioni utility (date, formattazione, validazione)
- **styles/**: Stili globali, tema, design system

---

## ✅ Validazione Obbligatoria Dati Lavori e Finestra Recupero (2025-12-20) - COMPLETATO

### Obiettivo
Risolvere il problema per cui trattoristi e caposquadra potevano completare un lavoro prima di segnare le ore, perdendo la possibilità di inserirle. Implementare validazione obbligatoria e finestra temporale per recupero.

### Problema Identificato
- Trattoristi potevano tracciare zone lavorate e segnare come completato il lavoro come prima cosa
- A quel punto non potevano più segnare le ore perché il lavoro non compariva più nella lista
- Mancava un ordine temporale obbligatorio per garantire che tutti i dati fossero compilati

### Implementazione

#### Validazione Obbligatoria Dati
- ✅ **Funzioni helper**: Aggiunte funzioni `verificaOreSegnate()` e `verificaZoneLavorate()` in dashboard-standalone.html
- ✅ **Funzioni helper**: Aggiunte funzioni `verificaOreSegnateLavoro()` e `verificaZoneLavorateLavoro()` in lavori-caposquadra-standalone.html
- ✅ **Blocco completamento**: Modificata `segnaLavoroCompletato()` in dashboard per validare ore e zone prima di completare
- ✅ **Blocco completamento**: Modificata `segnaCompletato()` in lavori-caposquadra per validare ore e zone prima di completare
- ✅ **Messaggi chiari**: Messaggi di errore specifici che indicano esattamente quali dati mancano
- ✅ **Zone obbligatorie per trattoristi**: Zone lavorate ora obbligatorie anche per trattoristi (non più opzionali)

#### Finestra Temporale Recupero
- ✅ **Lavori completati recenti**: Modificata `loadLavori()` in segnatura-ore-standalone.html per includere lavori completati negli ultimi 7 giorni
- ✅ **Sezione dedicata**: Lavori completati mostrati in sezione separata "Lavori Completati Recenti (ultimi 7 giorni)"
- ✅ **Badge distintivo**: Badge giallo distintivo per lavori completati recenti
- ✅ **Messaggio informativo**: Spiegazione che si possono ancora segnare ore per questi lavori
- ✅ **Calcolo data limite**: Data limite calcolata come 7 giorni fa dalla data corrente

### File Modificati
- `core/dashboard-standalone.html` - Funzioni helper e validazione in `segnaLavoroCompletato()`
- `core/admin/lavori-caposquadra-standalone.html` - Funzioni helper e validazione in `segnaCompletato()`
- `core/segnatura-ore-standalone.html` - Modificata `loadLavori()` e `renderLavori()` per includere lavori completati recenti

### Risultato
- ✅ Nessun lavoro può essere completato senza dati obbligatori (ore e zone)
- ✅ Ordine temporale garantito: zone → ore → completamento
- ✅ Possibilità di recuperare ore anche dopo completamento (finestra 7 giorni)
- ✅ Esperienza utente migliorata con validazioni chiare e messaggi informativi
- ✅ Prevenzione errori dell'utente con blocchi mirati

---

## ✅ Badge Conto Terzi e Filtri per Categoria nel Diario Attività (2025-12-18) - COMPLETATO

### Obiettivo
Migliorare l'identificazione delle attività conto terzi nel diario attività e implementare filtri per categoria per Tipo Lavoro e Colture, raggruppando automaticamente tutte le varianti.

### Implementazione

#### Badge Conto Terzi
- ✅ **Badge nella colonna Tipo Lavoro**: Aggiunto badge "💼 Conto Terzi" nella colonna "Tipo Lavoro" per tutte le attività conto terzi
- ✅ **Visibilità sempre garantita**: Il badge è visibile anche quando la colonna "Cliente" non è presente (modalità core senza modulo conto terzi attivo)
- ✅ **Coerenza con dashboard**: Stesso stile e comportamento del badge presente nella dashboard manager

#### Filtri per Categoria

##### Filtro Tipo Lavoro
- ✅ **Dropdown con categorie**: Il filtro mostra le categorie principali (es. "Lavorazione del Terreno", "Potatura", "Trattamenti") invece dei tipi specifici
- ✅ **Raggruppamento automatico**: Selezionando una categoria, vengono mostrate tutte le attività con tipi lavoro appartenenti a quella categoria
- ✅ **Mapping intelligente**: Usa `categoriaId` dalla struttura gerarchica per mappare tipo lavoro → categoria
- ✅ **Fallback**: Se le categorie non sono ancora caricate, usa categorie predefinite

##### Filtro Colture
- ✅ **Dropdown con categorie**: Il filtro mostra le categorie principali (Vite, Frutteto, Seminativo, Orto, Prato, Olivo, Agrumeto, Bosco) invece delle colture specifiche
- ✅ **Raggruppamento automatico**: Selezionando una categoria (es. "Frutteto"), vengono mostrate tutte le attività con colture appartenenti a quella categoria (Albicocche, Pesche, Mele, Pere, ecc.)
- ✅ **Mapping intelligente**: Usa funzione `mapColturaToCategoria()` per mappare coltura specifica → categoria generica
- ✅ **Sempre disponibile**: Categorie hardcoded, sempre disponibili anche se le colture non sono ancora caricate

#### Funzioni di Mapping
- ✅ **`mapColturaToColorCategory()`**: Spostata in `shared/utils/map-colors.js` per riutilizzo in tutta l'applicazione
- ✅ **`mapColturaToCategoria()`**: Funzione helper locale sincrona per uso nei filtri
- ✅ **Mapping tipo lavoro**: Logica per trovare categoria tramite `categoriaId` in `tipiLavoroList`

#### Popolamento Dropdown
- ✅ **Funzioni dedicate**: Create `populateFiltroTipoLavoro()` e `populateFiltroColture()` per gestire il popolamento
- ✅ **Chiamate multiple**: I filtri vengono popolati sia in `loadListePersonalizzate()` che dopo il caricamento completo dei dati
- ✅ **Inizializzazione garantita**: `loadCategorieLavori()` viene sempre chiamata all'inizializzazione per assicurare che le categorie siano disponibili

### File Modificati
- `core/attivita-standalone.html` - Aggiunto badge conto terzi, implementati filtri per categoria, funzioni di mapping
- `shared/utils/map-colors.js` - Aggiunta funzione `mapColturaToColorCategory()` e `getColturaCategories()`

### Risultato
- ✅ Attività conto terzi facilmente identificabili con badge visibile
- ✅ Filtri più intuitivi e organizzati per categoria
- ✅ Raggruppamento automatico di tutte le varianti (es. tutte le varietà di vite, tutti i frutti, ecc.)
- ✅ Esperienza utente migliorata con filtri più semplici e logici

---

## ✅ Ottimizzazione Colori e Visibilità Mappe (2025-12-18) - COMPLETATO

### Obiettivo
Migliorare la visibilità dei perimetri delle mappe e implementare una palette colori più distinta e visibile per le diverse colture su tutte le mappe dell'applicazione.

### Implementazione

#### Palette Colori Ottimizzata
- ✅ **Nuova palette colori visibile**: Implementata palette con colori fill e stroke distinti per ogni categoria coltura
  - Vite: Rosso scuro brillante (#DC143C) / Rosso scuro perimetro (#8B0000)
  - Frutteto: Arancione brillante (#FF6600) / Arancione scuro perimetro (#CC5500)
  - Seminativo: Giallo oro (#FFD700) / Giallo scuro perimetro (#B8860B)
  - Orto: Verde lime brillante (#00FF00) / Verde scuro perimetro (#00AA00)
  - Prato: Verde chiaro (#90EE90) / Verde scuro perimetro (#228B22)
  - Olivo: Viola medio (#9370DB) / Viola scuro perimetro (#6A5ACD)
  - Agrumeto: Arancione (#FFA500) / Arancione scuro perimetro (#FF8C00)
  - Bosco: Marrone sella (#8B4513) / Marrone scuro perimetro (#654321)
  - Default: Blu dodger (#1E90FF) / Blu scuro perimetro (#0066CC) - invece di verde

#### Miglioramento Visibilità Perimetri
- ✅ **Stroke più spesso**: Aumentato `strokeWeight` da 2px a 3px
- ✅ **Opacità massima**: Aumentato `strokeOpacity` da 0.8 a 1.0
- ✅ **Colori stroke scuri**: Ogni categoria ha una versione scura del colore per il perimetro per massima visibilità

#### Mapping Intelligente Colture
- ✅ **Funzione `mapColturaToColorCategory()`**: Implementata funzione che mappa automaticamente colture specifiche a categorie generiche
  - Esempi: "Vite da Vino" → "Vite", "Albicocche" → "Frutteto", "Pomodoro" → "Orto"
  - Supporta mapping per tutte le varianti di colture (Vite da Tavola, Vite da Vino, tutte le varietà di frutti, ecc.)
  - Usa anche la categoria se disponibile nel terreno per mapping più accurato

#### Fix Bug Mappa Clienti
- ✅ **Eliminato bagliore bianco**: Risolto problema del flash bianco durante il cambio cliente nella mappa clienti
  - Implementata creazione anticipata dei nuovi poligoni prima della rimozione dei vecchi
  - Eliminato gap temporale tra rimozione vecchi elementi e aggiunta nuovi
  - Cambiato background container da grigio chiaro (#f0f0f0) a nero scuro (#1a1a1a)

#### Coerenza tra Mappe
- ✅ **Stessa palette su tutte le mappe**: Applicata la stessa palette colori e parametri a:
  - Dashboard (`core/dashboard-standalone.html`)
  - Gestione Terreni (`core/terreni-standalone.html`)
  - Mappa Clienti (`modules/conto-terzi/views/mappa-clienti-standalone.html`)

#### Tracciamento Confini Terreni
- ✅ **Colore dinamico in base a coltura**: Il tracciamento confini in "Gestione Terreni" ora usa il colore della coltura selezionata invece di sempre verde
- ✅ **Listener per cambio coltura**: Implementato listener che aggiorna il colore del poligono quando si cambia la coltura selezionata

### File Modificati
- `core/dashboard-standalone.html` - Aggiornata palette colori e parametri perimetri
- `core/terreni-standalone.html` - Aggiunta palette colori, mapping colture, colore dinamico tracciamento
- `modules/conto-terzi/views/mappa-clienti-standalone.html` - Aggiornata palette colori, fix bug cambio cliente
- `shared/utils/map-colors.js` - Creato file centralizzato per palette colori (per uso futuro)

### Risultato
- ✅ Perimetri terreni molto più visibili su mappa satellitare
- ✅ Colori distinti e riconoscibili per ogni categoria coltura
- ✅ Nessun bagliore bianco durante cambio cliente nella mappa clienti
- ✅ Coerenza visiva tra tutte le mappe dell'applicazione
- ✅ Leggende aggiornate con i nuovi colori

---

## ✅ Miglioramenti Modulo Conto Terzi - Registrazione Ore e UI (2025-12-13)

### Modifiche Form Rapido Conto Terzi
- ✅ **Sostituito campo singolo "Ore Lavorate"** con sistema completo ora inizio/fine/pause
- ✅ **Aggiunto calcolo automatico ore nette** nel form rapido attività conto terzi
- ✅ **Modificato `salvaAttivitaRapida`** per leggere orari invece di ore singole
- ✅ **Validazione completa orari** (ora fine > ora inizio, ore nette > 0)
- ✅ **Event listeners** per calcolo automatico in tempo reale

### Modifiche Modal Principale Attività Conto Terzi
- ✅ **Sostituito campo "Ore Lavorate"** con sistema ora inizio/fine/pause
- ✅ **Aggiunto calcolo automatico ore nette** anche nel modal principale
- ✅ **Funzione `updateOreNetteContoTerzi`** per aggiornamento automatico
- ✅ **Modificato `handleSaveAttivita`** per calcolare ore nette da orari

### Miglioramenti Funzione `generaVoceDiarioContoTerzi`
- ✅ **Aggiunto parametro opzionale `orariOpzionali`** per passare orari dalla attività salvata
- ✅ **Riutilizzo orari** invece di default quando disponibili
- ✅ **Implementato in entrambi i file**: `attivita-standalone.html` e `gestione-lavori-standalone.html`

### Correzione Visualizzazione Lavori Completati Conto Terzi
- ✅ **Ore visualizzate correttamente**: usa `totaleOreAttivita` quando Manodopera non attivo
- ✅ **Percentuale completamento**: 100% quando lavoro completato senza zone tracciate
- ✅ **Raggruppamento ore per data**: unisce ore attività con ore validate per dettagli giornalieri
- ✅ **Visualizzazione superficie**: mostra solo superficie totale quando non ci sono zone tracciate

### Correzione UI Pagina "Lavori da Pianificare"
- ✅ **Gradiente blu invece di verde** quando aperta da dashboard conto terzi
- ✅ **Rilevamento automatico modalità conto terzi** da parametri URL
- ✅ **Script nell'head** per applicare stili immediatamente (evita flash verde)
- ✅ **Link dashboard corretto**: torna alla dashboard conto terzi invece che principale
- ✅ **Titolo aggiornato**: "Lavori da Pianificare - Conto Terzi"

### Miglioramenti Card Statistiche
- ✅ **Colori distintivi per card progresso**:
  - In Ritardo: gradiente rosso (`#dc3545` → `#c82333`)
  - In Tempo: gradiente verde (`#28a745` → `#218838`)
  - In Anticipo: gradiente blu chiaro (`#17a2b8` → `#138496`)
- ✅ **Esclusione dalla regola generale** che applica blu a tutte le card
- ✅ **Testo bianco** per buon contrasto su sfondi colorati

### Correzioni Tecniche
- ✅ **Rimosso script inline** dal template literal per evitare errori di sintassi
- ✅ **Funzione `initCalcoloOreNetteRapido`** separata per inizializzazione form rapidi
- ✅ **Rimozione attributo `required`** dai campi Conto Terzi quando sezione nascosta
- ✅ **Rilevamento modalità conto terzi** migliorato con controllo parametri URL

### File Modificati
- `core/attivita-standalone.html` - Form rapido, modal principale, visualizzazione lavori completati
- `core/admin/gestione-lavori-standalone.html` - Stili UI, link dashboard, card statistiche
- `core/models/Attivita.js` - Già aggiornato in precedenza con `clienteId` e `lavoroId`

### Risultato
- ✅ Nessuna duplicazione inserimento ore: sistema unificato ora inizio/fine/pause
- ✅ Calcolo automatico ore nette in tutti i form
- ✅ UI coerente con tema Conto Terzi (blu) invece di verde
- ✅ Statistiche ben visibili con colori distintivi
- ✅ Navigazione corretta tra dashboard e pagine

---

## ✅ Uniformazione Stile Statistiche Colorato (2025-01-26)

### Obiettivo
Uniformare lo stile di tutte le statistiche applicando gradienti colorati per creare coerenza visiva in tutta l'applicazione.

### Implementazione

#### Statistiche Manodopera
- **File modificato**: `core/admin/statistiche-manodopera-standalone.html`
- Statistiche Lavori: 4 card colorate (Blu, Arancione, Verde, Viola)
- Statistiche Ore: 4 card colorate (Verde, Arancione, Viola)
- Statistiche Squadre: 4 card colorate (Blu, Verde)
- Statistiche Superficie: 3 card colorate (Verde, Blu, Viola)
- Report Ore Operai: 4 card aggregate colorate

#### Statistiche Core Base
- **File modificato**: `core/statistiche-standalone.html`
- Card "Terreni Totali" colorata (Blu) per coerenza
- Statistiche Terreni e Macchine già colorate, verificate

#### Palette Colori
- Blu: metriche neutre/informative
- Verde: metriche positive
- Arancione: metriche intermedie
- Viola: metriche speciali
- Rosso: metriche critiche
- Turchese: metriche informative alternative

---

## ✅ Gestione Affitti Terreni e Statistiche (2025-01-26)

### Obiettivo
Aggiungere la possibilità di specificare se un terreno è di proprietà o in affitto, con monitoraggio scadenze e statistiche complete.

### Implementazione

#### Modello Terreno Esteso
- **File modificato**: `core/models/Terreno.js`
- Campo `tipoPossesso`: "proprieta" | "affitto" (default: "proprieta")
- Campo `dataScadenzaAffitto`: Data scadenza contratto (obbligatorio se affitto)
- Campo `canoneAffitto`: Canone mensile in euro (opzionale)
- Validazione: Data scadenza obbligatoria per terreni in affitto
- Retrocompatibilità: Terreni esistenti senza campo considerati "proprietà"

#### Sistema Alert Scadenza
- **File modificato**: `core/terreni-standalone.html`
- Traffic light system: Verde (>6 mesi), Giallo (1-6 mesi), Rosso (≤1 mese), Grigio (scaduto)
- Visualizzazione: Pallini colorati nella lista terreni con tooltip
- Filtri: Per tipo possesso e alert scadenza

#### Card Dashboard Affitti
- **File modificato**: `core/dashboard-standalone.html`, `core/js/dashboard-sections.js`
- Card "Affitti in Scadenza" per Core Base e Manager
- Mostra solo affitti urgenti (rosso/giallo), massimo 5
- Link diretto a gestione terreni

#### Statistiche Terreni
- **File modificato**: `core/statistiche-standalone.html`, `core/admin/statistiche-manodopera-standalone.html`
- 8 metriche: Totali, Proprietà, Affitto, Superficie, Canoni
- Grafici Chart.js: Distribuzione terreni e superficie
- Lista affitti in scadenza completa

#### Layout Core Base Ottimizzato
- **File modificato**: `core/dashboard-standalone.html`, `core/styles/dashboard.css`
- Layout con 5 card sopra mappa (Terreni, Diario, Affitti, Statistiche, Abbonamento)
- Larghezza ottimizzata: 240px (desktop), 220px (tablet)
- Padding ridotto per card più compatte

---

## ✅ Sistema Categorie Gerarchico Unificato (2025-01-23)

### Obiettivo
Unificare le categorie di attrezzi e lavori in un unico sistema gerarchico per evitare duplicazioni e migliorare l'organizzazione.

### Modello Unificato
- **File creato**: `core/models/Categoria.js`
- Struttura gerarchica con `parentId` per sottocategorie
- Campo `applicabileA` per specificare se categoria si applica ad attrezzi/lavori/entrambi
- 10 categorie principali predefinite + sottocategorie

### Servizio Unificato
- **File creato**: `core/services/categorie-service.js`
- CRUD completo categorie
- Supporto gerarchico completo
- Funzioni per ottenere struttura gerarchica

### Migrazione Automatica
- Migrazione automatica da `categorieAttrezzi` → `categorie`
- Migrazione automatica da `categorieLavori` → `categorie`
- Creazione automatica categorie predefinite mancanti
- Idempotente e sicura

### UI Gerarchica
- Dropdown categoria principale + sottocategoria dinamica
- Event listener automatici per mostrare sottocategorie
- Filtri migliorati per includere sottocategorie
- Supporto completo per creazione tipi lavoro specifici

### File Modificati
- `core/admin/gestione-macchine-standalone.html` - UI gerarchica attrezzi
- `core/admin/gestione-lavori-standalone.html` - UI gerarchica lavori
- `modules/parco-macchine/models/Macchina.js` - Usa categoriaId unificato
- `core/models/TipoLavoro.js` - Usa categoriaId unificato

---

## 🎯 Risposta alla Tua Domanda

### "Il core è solo quello che abbiamo fatto?"

**SÌ e NO**:

- **SÌ**: Abbiamo fatto il **core tecnico** (servizi e modelli base)
- **NO**: Manca ancora il **core UI** (pagine auth, tenant, subscription)
- **NO**: Manca l'**applicazione** (moduli vendemmia, clienti, bilancio)

### "Il core è la parte che sviluppiamo adesso?"

**SÌ**: Il core tecnico è fatto. Ora possiamo:
1. Sviluppare i moduli applicativi (vendemmia, clienti, bilancio)
2. Creare le UI core (auth, tenant, subscription)
3. Creare componenti condivisi

---

## 📊 Confronto: Vecchia App vs Nuova App

### Vecchia App (Monolitica)
```
vecchia app/
├── index.html          # Tutto insieme
├── anagrafica_clienti.html
├── bilancio.html
└── [tutto in file HTML grandi]
```

### Nuova App (Modulare) - Target
```
gfv-platform/
├── core/               ✅ Base tecnica (FATTO)
│   └── services/      ✅ FATTO
│
├── modules/            ❌ Moduli (DA FARE)
│   ├── vendemmia/     ❌ Da refactorizzare
│   ├── clienti/        ❌ Da refactorizzare
│   └── bilancio/      ❌ Da refactorizzare
│
└── shared/             ❌ Condivisi (DA FARE)
```

---

## 🚀 Prossimi Passi di Sviluppo

### Fase 1: Core UI (Prossimo)
- [ ] Pagine autenticazione (login, registrazione)
- [ ] Dashboard base
- [ ] Gestione tenant/azienda

### Fase 2: Moduli (Dopo)
- [ ] Refactorizzare modulo vendemmia da vecchia app
- [ ] Refactorizzare modulo clienti da vecchia app
- [ ] Refactorizzare modulo bilancio da vecchia app

### Fase 3: Componenti (In parallelo)
- [ ] Componenti UI riutilizzabili
- [ ] Design system
- [ ] Utility functions

---

## 💡 In Sintesi

**Core tecnico** = ✅ FATTO (servizi, modelli, configurazione)  
**Core UI** = ❌ DA FARE (pagine auth, tenant, subscription)  
**Moduli** = ❌ DA FARE (vendemmia, clienti, bilancio)  
**Componenti** = ❌ DA FARE (widget, utils, styles)

**Il core che abbiamo fatto è la FONDAMENTA. Ora possiamo costruire l'applicazione sopra!** 🏗️

---

## 📝 Aggiornamenti Recenti (2025-01-20)

### Dashboard Ruoli Ottimizzate ✅
- **Dashboard Operaio**: Rimossa visualizzazione Core Base (terreni, diario attività, statistiche, abbonamento)
  - Visualizza solo: Comunicazioni dal Caposquadra, Lavori di Oggi, Segna Ore, Le Mie Ore
  - Statistiche personali: Lavori Oggi, Ore Segnate, Stato
  - Sezione "Le Mie Ore" con riepilogo (Validate/Da validare/Rifiutate) e ultime 5 ore segnate
- **Dashboard Caposquadra**: Rimossa visualizzazione Core Base
  - Visualizza solo: Statistiche squadra, Comunicazione Rapida, Azioni Rapide, Lavori Recenti
- **Logica**: Core Base nascosto solo se utente è SOLO Operaio o SOLO Caposquadra
- **File modificati**: `core/dashboard-standalone.html`

### Diario da Lavori Automatico ✅
- **Campo Tipo Lavoro**: Aggiunto campo obbligatorio `tipoLavoro` al modello Lavoro
  - Validazione: campo obbligatorio
  - Dropdown popolato dalle liste personalizzate (predefiniti + custom)
- **Form Lavori**: Aggiunto dropdown Tipo Lavoro nel form creazione/modifica lavoro
  - Caricamento automatico tipi lavoro dalle liste personalizzate
  - Salvataggio tipo lavoro nel documento lavoro
- **Generazione Automatica Attività**: Funzione per generare attività dalle ore validate
  - Raggruppa ore validate per data e lavoro
  - Calcola orario inizio (prima ora) e fine (ultima ora) del giorno
  - Somma pause e ore nette totali
  - Conta numero operai che hanno lavorato
  - Recupera dati terreno (nome, coltura) e lavoro (tipo lavoro)
- **Vista Dashboard Manager**: Nuova sezione "Diario da Lavori"
  - Tabella con colonne: Data, Terreno, Tipo Lavoro, Coltura, Orario, Ore, Operai, Lavoro
  - Mostra ultime 20 attività generate
  - Ordinamento per data (più recenti prima)
  - Messaggio quando non ci sono attività
- **File modificati**: 
  - `core/models/Lavoro.js`
  - `core/admin/gestione-lavori-standalone.html`
  - `core/dashboard-standalone.html`

### Sistema Comunicazioni Squadra e Separazione Impostazioni ✅
- Separazione impostazioni per ruolo:
  - Manager/Amministratore: tutte le sezioni (Azienda, Poderi, Liste, Account, Password)
  - Caposquadra: solo Comunicazioni Squadra + Account + Password
  - Operaio: solo Account + Password
- Scheda veloce comunicazioni nella dashboard caposquadra:
  - Card "Invia Comunicazione Rapida" direttamente nella dashboard
  - Pre-compilazione automatica podere, campo e lavoro dal primo lavoro attivo
  - Dropdown per selezionare lavoro se ce ne sono più di uno
  - Solo orario (default 7:00) e note da compilare
  - Invio rapido in un click
- Sistema comunicazioni di ritrovo per caposquadra:
  - Pre-compilazione automatica podere/terreno dal lavoro assegnato
  - Dropdown selezione lavoro per pre-compilare automaticamente
  - Invio comunicazione alla squadra con notifica nella dashboard operai
  - Lista comunicazioni inviate con statistiche conferme
  - Versione completa nelle Impostazioni per casi particolari
- Visualizzazione comunicazioni nella dashboard operaio:
  - Card comunicazioni attive con dettagli (podere, campo, data, orario)
  - Conferma ricezione obbligatoria
  - Link Google Maps per indicazioni al podere geolocalizzato
  - Stato visivo (giallo se non confermata, verde se confermata)

### Campo Cellulare per Utenti ✅
- Aggiunto campo cellulare opzionale nel form invito utente (Manager)
- Campo cellulare obbligatorio nella registrazione via invito
- Visualizzazione contatti squadra per caposquadra con link cliccabili (`mailto:` e `tel:`)
- Validazione formato cellulare

### Gestione Poderi ✅
- Aggiunta sezione "Gestione Poderi" in Impostazioni
- Integrazione Google Maps con visualizzazione satellitare
- Marker draggable per posizionamento preciso poderi
- Ricerca indirizzo con geocoding e reverse geocoding
- Campo podere nei terreni con dropdown
- Salvataggio coordinate poderi per indicazioni stradali

**File modificati**:
- `core/admin/gestisci-utenti-standalone.html`
- `core/auth/registrazione-invito-standalone.html`
- `core/admin/gestione-squadre-standalone.html`
- `core/admin/impostazioni-standalone.html`
- `core/terreni-standalone.html`
- `core/models/Terreno.js`
- `core/dashboard-standalone.html`

## 📝 Aggiornamenti Recenti (2025-01-20)

### Riorganizzazione Dashboard Manager con Manodopera Attivo ✅
- **Problema**: Dashboard confusa con duplicazione tra diario manuale Core Base e diario automatico
- **Soluzione**: 
  - Core Base nascosto quando Manodopera è attivo (Manager e Amministratore)
  - Card Amministrazione che porta a pagina dedicata
  - Card Statistiche che porta a pagina dedicata
  - Sezione Gestione Manodopera completa mantenuta
  - Diario da Lavori come sezione principale
- **Risultato**: Dashboard più pulita, organizzata e intuitiva
- **File modificati**: `core/dashboard-standalone.html`

### Pagina Amministrazione Dedicata ✅
- **File creato**: `core/admin/amministrazione-standalone.html`
- **Funzionalità**:
  - Statistiche: Piano Attuale, Moduli Attivi, Utenti Totali
  - Card cliccabili: Gestisci Utenti, Gestione Squadre, Abbonamento
  - Design coerente con altre pagine admin
  - Verifica permessi automatica

### Pagina Statistiche Manodopera Dedicata ✅
- **File creato**: `core/admin/statistiche-manodopera-standalone.html`

### Calcolo Compensi Operai ✅
- **File creato**: `core/admin/compensi-operai-standalone.html`
- **Funzionalità**: Pagina dedicata per calcolo compensi operai
- **Sistema tariffe**: Tariffe default configurabili per tipo operaio + tariffe personalizzate per singolo operaio
- **Calcolo automatico**: Basato su ore validate nel periodo selezionato
- **Esportazione Excel**: Formato professionale con logo aziendale, colori, formattazione completa
- **Formato ore**: Leggibile (es. "64h 10min" invece di "64.17")
- **Accesso**: Solo Manager/Amministratore, richiede modulo Manodopera attivo
- **Statistiche implementate**:
  - Lavori: Totali, Attivi, Completati, Pianificati
  - Ore: Validate (Mese/Totale), Da Validare, Media Ore/Giorno
  - Squadre: Totali, Attive, Operai Totali, Operai Online
  - Superficie: Lavorata, Totale Terreni, % Lavorata
- **Struttura modulare**: Facile aggiungere nuove statistiche in futuro
- **File modificati**: `core/dashboard-standalone.html` (aggiunta card Statistiche)

### Mappa Aziendale Dashboard Manager ✅
- **Layout superiore dashboard Manager**:
  - Riga superiore con layout a 2 colonne:
    - Sinistra: 3 card verticali (Amministrazione, Statistiche, Terreni)
    - Destra: Mappa Aziendale grande che occupa tutto lo spazio disponibile
  - Layout responsive: su schermi <1024px le card si impilano sopra la mappa
- **Mappa satellitare completa**:
  - Visualizzazione tutti i terreni con confini geolocalizzati (poligoni)
  - Mappa satellitare Google Maps con zoom automatico su tutti i terreni
  - Colori distinti per coltura (palette predefinita: Vite, Frutteto, Seminativo, ecc.)
  - Legenda colture dinamica (si aggiorna in base ai terreni presenti)
  - Click su terreno per vedere info dettagliate (nome, podere, coltura, superficie, note)
  - Info window con link diretto a dettagli terreno
  - Visualizzazione solo terreni con mappa tracciata
- **Responsive design**:
  - Desktop (>1200px): colonna sinistra 280px, mappa occupa il resto
  - Tablet (1024-1200px): colonna sinistra 260px, mappa più larga
  - Tablet piccolo (<1024px): layout verticale (card sopra, mappa sotto)
  - Mobile (<768px): mappa compatta con altezza ridotta
  - Ridimensionamento automatico mappa al cambio dimensione finestra
- **Integrazione dashboard**:
  - Mappa visibile per Manager e Amministratore
  - Posizionata in alto dopo le card Amministrazione/Statistiche
  - Sotto la mappa: Gestione Manodopera e Diario da Lavori
  - Allineamento perfetto con margine destro sezione "Gestione Manodopera"
- **File modificati**: `core/dashboard-standalone.html`

### Miglioramenti Mappa Aziendale Fase 2 ✅ COMPLETATI (2025-01-20)

**1. Overlay Lavori Attivi** ✅
- Visualizzazione zone lavorate come poligoni verdi semi-trasparenti sulla mappa
- Toggle nell'header per mostrare/nascondere overlay
- Info window con dettagli lavoro quando si clicca su zona lavorata
- Caricamento automatico lavori attivi e zone lavorate dal modulo Manodopera
- Legenda aggiornata con sezione "Zone Lavorate"

**2. Filtri Podere e Coltura** ✅
- Dropdown filtri nell'header mappa (Podere e Coltura)
- Filtraggio dinamico terreni visualizzati sulla mappa
- Filtri combinabili (podere E coltura)
- Legenda aggiornata automaticamente in base ai filtri attivi
- Zoom automatico sui terreni filtrati

**3. Indicatori Stato Lavori** ✅
- Marker colorati per ogni lavoro attivo sulla mappa
- Colori: rosso (in ritardo), giallo (in tempo), verde (in anticipo), blu (in corso)
- Marker posizionati al centro del terreno associato
- Info window completa con dettagli lavoro (nome, terreno, tipo, stato, progresso, superficie, date)
- Toggle nell'header per mostrare/nascondere indicatori
- Legenda aggiornata con spiegazione colori indicatori

**4. Zoom Automatico Migliorato** ✅
- Padding personalizzato (50px standard, 100px per aree grandi) per evitare taglio bordi
- Zoom intelligente basato su dimensione area:
  - Terreni molto piccoli: zoom ravvicinato (livello 18)
  - Terreni normali: zoom automatico con padding standard
  - Aree molto grandi: zoom più lontano con padding maggiore
- Zoom automatico quando si applicano filtri
- Gestione responsive al ridimensionamento finestra

**File modificati**: `core/dashboard-standalone.html`

## 📝 Aggiornamenti Recenti (2025-01-20) - Mappa Aziendale

### Mappa Aziendale Dashboard Manager ✅
- **Layout superiore dashboard Manager**:
  - Riga superiore con layout a 2 colonne:
    - Sinistra: 3 card verticali (Amministrazione, Statistiche, Terreni)
    - Destra: Mappa Aziendale grande che occupa tutto lo spazio disponibile
  - Layout responsive: su schermi <1024px le card si impilano sopra la mappa
- **Mappa satellitare completa**:
  - Visualizzazione tutti i terreni con confini geolocalizzati (poligoni)
  - Mappa satellitare Google Maps con zoom automatico su tutti i terreni
  - Colori distinti per coltura (palette predefinita)
  - Legenda colture dinamica
  - Click su terreno per vedere info dettagliate
  - Responsive design per tutti i dispositivi
- **Integrazione dashboard**:
  - Mappa visibile per Manager e Amministratore
  - Posizionata in alto dopo le card Amministrazione/Statistiche
  - Sotto la mappa: Gestione Manodopera e Diario da Lavori
  - Allineamento perfetto con margine destro sezione "Gestione Manodopera"

**File modificati**: `core/dashboard-standalone.html`

### Miglioramenti Pianificati Mappa Aziendale (Fase 2)
**Priorità implementazione**:
1. **Overlay Lavori Attivi** (Alta priorità) - Visualizzazione zone lavorate sulla mappa
2. **Filtri (Podere, Coltura)** (Media priorità) - Filtrare terreni per podere/coltura
3. **Indicatori Stato Lavori** (Media priorità) - Marker colorati per lavori attivi
4. **Zoom Automatico Migliorato** (Bassa priorità) - Miglioramenti zoom esistente

## 📝 Aggiornamenti Recenti (2025-01-21)

### Gestione Contratti Operai ✅
**Data completamento**: 2025-01-21

**File creati**:
- `core/admin/gestione-operai-standalone.html` - Pagina dedicata gestione contratti operai

**File modificati**:
- `core/models/User.js` - Aggiunti campi contratto (tipoOperaio, tipoContratto, dataInizioContratto, dataScadenzaContratto, noteContratto)
- `core/dashboard-standalone.html` - Aggiunto link Gestione Operai nella sezione Amministrazione
- `core/admin/amministrazione-standalone.html` - Aggiunta card Gestione Operai

**Funzionalità implementate**:
- ✅ Pagina Gestione Operai con filtro automatico per ruolo "operaio"
- ✅ Tabella completa con colonne: Nome, Email, Tipo Operaio, Tipo Contratto, Data Inizio, Data Scadenza, Alert, Azioni
- ✅ Tipi Operai: 6 tipi predefiniti (Semplice, Specializzato, Trattorista, Meccanico, Elettricista, Altro)
- ✅ Gestione Contratti: Tipo Contratto (Stagionale/Determinato/Indeterminato), Date Inizio/Scadenza, Note
- ✅ Sistema Semaforo Alert: Verde (>30 giorni), Giallo (8-30 giorni), Rosso (0-7 giorni), Grigio (scaduto)
- ✅ Filtri Avanzati: Per Stato, Tipo Contratto, Tipo Operaio, Alert
- ✅ Storico Contratti: Contratti scaduti rimangono visibili per storico
- ✅ Validazione: Data scadenza >= data inizio, campi obbligatori verificati
- ✅ Permessi: Solo Manager/Amministratore può vedere/modificare contratti

**Vantaggi**:
- ✅ Scadenziario completo per monitorare rinnovi contratti
- ✅ Sistema alert automatico per non perdere scadenze
- ✅ Tipi operai pronti per calcolo compensi futuri
- ✅ Storico completo contratti per tracciabilità
- ✅ Semplice e funzionale, senza complessità normative

**File modificati**:
- `core/models/User.js`
- `core/admin/gestione-operai-standalone.html`
- `core/dashboard-standalone.html`
- `core/admin/amministrazione-standalone.html`

### Report Ore Operai con Filtri Avanzati ✅
**Data completamento**: 2025-01-21

**File modificati**:
- `core/admin/statistiche-manodopera-standalone.html` - Aggiunta sezione Report Ore Operai completa

**Funzionalità implementate**:
- ✅ Sezione Report Ore Operai nella pagina Statistiche Manodopera
- ✅ Filtri periodo: Oggi / Questa Settimana / Questo Mese / Personalizzato
- ✅ Filtro per Tipo Operaio: Tutti i 6 tipi disponibili
- ✅ Filtro per Singolo Operaio: Dropdown con lista operai completa
- ✅ Aggiornamento automatico con debounce (700ms) quando si cambiano i filtri
- ✅ Statistiche aggregate: Ore Totali, Media Ore/Giorno, Giorni Lavorati, Operai Attivi
- ✅ Statistiche per tipo operaio: Card con ore aggregate per categoria
- ✅ Tabella report operai: Colonne complete con ordinamento automatico
- ✅ Formattazione ore leggibile (es. "8h 30min")
- ✅ Colori distinti per ore validate (verde) e da validare (giallo)
- ✅ Pulsante "Pulisci Filtri" per reset rapido

**Vantaggi**:
- ✅ Analisi rapida ore lavorate per periodo/tipo/singolo operaio
- ✅ Aggiornamento automatico senza click ripetuti (miglior UX)
- ✅ Statistiche aggregate sempre aggiornate in base ai filtri
- ✅ Flessibilità filtri combinati per analisi approfondite
- ✅ Performance ottimizzata con debounce per evitare query multiple

**File modificati**:
- `core/admin/statistiche-manodopera-standalone.html`

### Calcolo Compensi Operai ✅
**Data completamento**: 2025-01-23

**File creati**:
- `core/admin/compensi-operai-standalone.html` - Pagina dedicata calcolo compensi operai

**File modificati**:
- `core/models/User.js` - Aggiunto campo `tariffaPersonalizzata`
- `core/admin/impostazioni-standalone.html` - Aggiunta sezione "Tariffe Operai"
- `core/admin/gestione-operai-standalone.html` - Aggiunto campo tariffa personalizzata
- `core/admin/statistiche-manodopera-standalone.html` - Rimossa sezione compensi, aggiunto link
- `core/dashboard-standalone.html` - Aggiunto link Compensi Operai
- `core/admin/amministrazione-standalone.html` - Aggiunta card Compensi Operai

**Funzionalità implementate**:
- ✅ Pagina dedicata per calcolo compensi (separata da Statistiche)
- ✅ Sistema tariffe: default per tipo operaio + personalizzate per singolo operaio
- ✅ Calcolo automatico basato su ore validate nel periodo selezionato
- ✅ Filtri: periodo (oggi/settimana/mese/personalizzato), tipo operaio, singolo operaio
- ✅ Statistiche aggregate: compenso totale, operai compensati, ore compensate, media
- ✅ Formato ore leggibile: "64h 10min" invece di "64.17"
- ✅ Esportazione Excel professionale:
  - Formato .xlsx nativo (nessun alert Excel)
  - Logo aziendale grande e leggibile (righe 1-7)
  - Formattazione completa con colori (intestazioni verdi, righe alternate, colonna compensi evidenziata)
  - Formato numeri: ore leggibili, tariffe e compensi in euro italiano
  - Tabella inizia dalla riga 8 con margine superiore corretto

**Vantaggi**:
- ✅ Gestione finanziaria dedicata (non più in Statistiche)
- ✅ Sistema tariffe flessibile e scalabile
- ✅ Esportazione professionale pronta per condivisione/documentazione
- ✅ Pronto per integrazione futura con modulo Bilancio

**File modificati**:
- `core/admin/compensi-operai-standalone.html`
- `core/admin/statistiche-manodopera-standalone.html`
- `core/admin/impostazioni-standalone.html`
- `core/admin/gestione-operai-standalone.html`
- `core/models/User.js`
- `core/dashboard-standalone.html`
- `core/admin/amministrazione-standalone.html`

### Fix Superficie Lavorata Dashboard Manager ✅
**Data completamento**: 2025-01-21

**Problema risolto**:
- La card "Superficie Lavorata" nella dashboard Manager mostrava sempre 0.00 HA
- Causa: campo cercato era `superficieLavorata` invece di `superficieTotaleLavorata`

**Correzioni applicate**:
- ✅ Corretto campo nella dashboard Manager (`loadManagerManodoperaStats()`)
- ✅ Corretto campo nella pagina Statistiche (`loadSuperficieStats()`)
- ✅ Corretti riferimenti in Gestione Lavori con fallback per compatibilità
- ✅ Migliorata funzione `loadProgressiLavoro()` per usare prima campo documento

**Risultato**:
- ✅ La superficie lavorata ora mostra correttamente gli ettari lavorati
- ✅ Dati calcolati dalle zone tracciate dai caposquadra
- ✅ Compatibilità con lavori vecchi senza campo aggiornato

**File modificati**:
- `core/dashboard-standalone.html`
- `core/admin/statistiche-manodopera-standalone.html`
- `core/admin/gestione-lavori-standalone.html`

## 📝 Aggiornamenti Recenti (2025-01-23)

### Separazione Dashboard Core Base/Modulo Manodopera ✅
**Data completamento**: 2025-01-23

**Problema risolto**: Dashboard mostrava sezioni Amministrazione e mappa avanzata anche quando il modulo Manodopera era disattivato, creando confusione.

**Soluzione implementata**:
- ✅ **Dashboard pulita senza Manodopera**:
  - Rimossa completamente sezione Amministrazione quando Manodopera è disattivato
  - Link "Invita Collaboratore" nell'header nascosto quando Manodopera è disattivato
  - Solo funzionalità Core Base visibili (Terreni, Diario Attività, Statistiche, Abbonamento)
- ✅ **Mappa semplificata Core Base**:
  - Versione base quando Manodopera è disattivato: solo visualizzazione terreni
  - Nessun filtro avanzato, overlay lavori, indicatori lavori
  - Legenda base solo con colture
- ✅ **Mappa completa con Manodopera**:
  - Mantiene tutte le funzionalità avanzate quando Manodopera è attivo
  - Filtri, overlay, indicatori disponibili

**Vantaggi**:
- ✅ Dashboard pulita e focalizzata quando Manodopera è disattivato
- ✅ Separazione logica chiara tra Core Base e moduli avanzati
- ✅ Mappa semplificata funziona correttamente senza dipendenze dal modulo

**File modificati**: `core/dashboard-standalone.html`

### Fix Configurazione Google Maps ✅
**Data completamento**: 2025-01-23

**Problema risolto**: Google Maps API key non veniva caricata correttamente, mappa non visualizzata.

**Soluzione implementata**:
- ✅ Corretto percorso file config Google Maps
- ✅ Caricamento config prima di inizializzare API
- ✅ Gestione corretta timing: config → Firebase → Google Maps API
- ✅ Controlli dimensioni container
- ✅ Resize trigger per forzare rendering
- ✅ Logging dettagliato per debugging

**Risultato**:
- ✅ Mappa visualizzata correttamente sia con che senza Manodopera
- ✅ Config caricato correttamente da file locale o fallback GitHub
- ✅ Funziona sia in locale che online

**File modificati**: `core/dashboard-standalone.html`

### Refactoring Dashboard Standalone ✅
**Data completamento**: 2025-01-23

**Problema identificato**:
- File `dashboard-standalone.html` troppo grande (4864 righe)
- Mix di HTML, CSS e JavaScript nello stesso file
- Difficile manutenzione e debugging

**Soluzione implementata**:
- ✅ **CSS estratto**: ~515 righe → `styles/dashboard.css`
- ✅ **Config Loader estratto**: ~240 righe → `js/config-loader.js`
- ✅ **Utility Functions estratte**: ~110 righe → `js/dashboard-utils.js`
- ✅ **Sezioni Dashboard estratte**: ~600+ righe → `js/dashboard-sections.js`

**Risultati**:
- ✅ Riduzione file HTML: **4864 → 3374 righe (-30.6%)**
- ✅ Codice più modulare e organizzato
- ✅ Funzionalità mantenute al 100%
- ✅ Compatibile con `file://` e server HTTP

**File creati**:
- `core/styles/dashboard.css`
- `core/js/config-loader.js`
- `core/js/dashboard-utils.js`
- `core/js/dashboard-sections.js`

**File modificati**:
- `core/dashboard-standalone.html`

---

## 🔧 Sistema Segnalazione e Gestione Guasti Macchine (2025-01-24)

### Funzionalità Implementate

#### 1. Segnalazione Guasti Operai
- ✅ Pagina dedicata per operai (`core/admin/segnalazione-guasti-standalone.html`)
- ✅ Precompilazione automatica campi:
  - Trattore assegnato al lavoro corrente
  - Attrezzo assegnato al lavoro corrente
  - Lavoro attivo più recente
- ✅ Supporto lavori autonomi e lavori di squadra
- ✅ Selezione gravità guasto (grave/non grave)
- ✅ Campo dettagli guasto
- ✅ Aggiornamento automatico stato macchine
- ✅ Sospensione automatica lavori per guasti gravi
- ✅ Risoluzione guasti con note e costo riparazione

#### 2. Gestione Guasti Manager
- ✅ Pagina dedicata per manager (`core/admin/gestione-guasti-standalone.html`)
- ✅ Visualizzazione tutti i guasti (aperti e risolti)
- ✅ Filtri per stato, gravità, macchina
- ✅ Azioni manager:
  - Approvare continuazione lavoro (guasti non gravi)
  - Sospendere lavoro (qualsiasi guasto)
  - Risolvere guasto
  - Riaprire guasto risolto
- ✅ Storico guasti per macchina
- ✅ Integrazione dashboard manager (card real-time)

#### 3. Correzioni e Miglioramenti
- ✅ Fix errori sintassi ES6 modules (import statements)
- ✅ Fix ricerca lavori attivi (stati multipli)
- ✅ Fix visualizzazione terreno nella dashboard operaio
- ✅ Fix calcolo automatico stato progresso marcatori mappa
- ✅ Fix precompilazione automatica campi
- ✅ Fix gestione lavori assegnati tramite caposquadra

#### 4. Calcolo Stato Progresso Lavori
- ✅ Calcolo automatico `giorniEffettivi` dalla `dataInizio`
- ✅ Calcolo automatico `percentualeCompletamento` da superficie
- ✅ Calcolo automatico `statoProgresso` (in_ritardo/in_tempo/in_anticipo)
- ✅ Marcatori mappa colorati con stato progresso

**File creati**:
- `core/admin/segnalazione-guasti-standalone.html` (NUOVO)
- `core/admin/gestione-guasti-standalone.html` (NUOVO)

**File modificati**:
- `core/dashboard-standalone.html` (card guasti + calcolo progresso)
- `core/js/dashboard-sections.js` (link segnalazione guasti)

---

## 🚜 Integrazione Modulo Macchine nel Core Base ✅ (2025-01-24)

### Obiettivo
Integrare il modulo Parco Macchine nel Core Base per permettere tracciamento macchine anche senza modulo Manodopera, con compatibilità totale quando Manodopera viene aggiunto successivamente.

### Funzionalità Implementate

#### 1. Service Unificato Macchine Utilizzo ✅
- **File creato**: `modules/parco-macchine/services/macchine-utilizzo-service.js`
- Funzione riutilizzabile `aggiornaOreMacchinaDaUtilizzo()` per aggiornare ore macchine
- Verifica automatica manutenzioni e alert quando superate
- Usabile da Core Base (Diario Attività) e modulo Manodopera (Segna Ore/Validazione Ore)
- Calcolo ore macchina default basato su ore lavoratore

#### 2. Diario Attività con Macchine ✅
- **File modificato**: `core/attivita-standalone.html`
- Campo "Ora fine" reso opzionale (non più obbligatorio)
- Dropdown trattori e attrezzi (solo se modulo Parco Macchine attivo)
- Compatibilità attrezzi basata su CV trattore (filtro automatico)
- Campo ore macchina separato da ore lavoratore
- **Liberazione automatica macchine** quando c'è "ora fine" (attività completata)
- **Impostazione "in_uso"** quando non c'è "ora fine" (attività in corso)
- **Controllo conflitti orario**: previene sovrapposizioni stessa macchina/attrezzo stesso orario/data
- **Fallback automatico**: libera macchine di attività del giorno precedente senza "ora fine"
- Visualizzazione macchine nella lista attività
- Gestione modifica attività: libera macchine vecchie se cambiate, gestisce aggiunta/rimozione "ora fine"
- **Struttura gerarchica tipi lavoro** (2025-01-24):
  - Quando Macchine o Manodopera attivo, usa struttura gerarchica (Categoria → Sottocategoria → Tipo Lavoro)
  - Lista piatta rimane disponibile quando nessun modulo attivo
  - Compatibilità completa: stessa logica sia con solo Macchine, sia con Manodopera attivo
  - Campo coltura aggiunto anche nella struttura gerarchica, popolato automaticamente dai terreni
  - Modali per creare categorie e tipi lavoro direttamente dal diario
  - Layout modali corretto con pulsanti sempre visibili (z-index, padding, stili)
  - Gestione errori CORS per ambiente file:// migliorata

#### 3. Gestione Lavori con Macchine ✅
- **File modificato**: `core/admin/gestione-lavori-standalone.html`
- Liberazione automatica macchine quando lavoro completato/approvato
- Correzione automatica macchine di lavori già completati (funzione `correggiMacchineLavoriCompletati()`)
- Popolamento dropdown trattori quando si apre modal creazione/modifica lavoro
- Log dettagliati per debugging gestione macchine

#### 4. Lavori Caposquadra con Macchine ✅
- **File modificato**: `core/admin/lavori-caposquadra-standalone.html`
- Liberazione automatica macchine quando lavoro raggiunge 100% completamento

#### 5. Refactoring Validazione Ore ✅ (2025-01-24)
- **File modificato**: `core/admin/validazione-ore-standalone.html`
- Rimossa funzione duplicata `aggiornaOreMacchina()` (75+ righe di codice duplicato)
- Sostituita con chiamata al service unificato `macchine-utilizzo-service.js`
- Aggiunta funzione `loadMacchineUtilizzoService()` per caricamento dinamico del service
- Gestione ambiente file:// (CORS) migliorata
- Zero duplicazione codice: logica centralizzata nel service unificato
- Compatibilità totale mantenuta: stesse funzionalità, codice più pulito e manutenibile
- Le ore macchina vengono aggiornate solo alla validazione (non alla segnatura)

#### 6. Correzione Barra Progresso Lavori Completati ✅ (2025-01-24)
- **Problema identificato**: Lavori completati (soprattutto conto terzi) mostravano barra progresso a 0% anche se completati
- **File modificato**: `core/dashboard-standalone.html`
  - Funzione `loadRecentLavoriManagerManodopera()`: aggiunta visualizzazione barra progresso
  - Funzione `loadRecentLavori()`: aggiunta visualizzazione barra progresso
  - Lavori completati mostrano automaticamente 100% se `percentualeCompletamento` è 0 o mancante
  - Badge "Conto Terzi" visualizzato correttamente nella lista lavori recenti
  - Caricamento terreni per calcolo percentuale se mancante
- **File modificato**: `core/admin/gestione-lavori-standalone.html`
  - Correzione calcolo percentuale per lavori completati nella tabella
  - Lavori completati mostrano 100% anche se `percentualeCompletamento` è 0 o mancante
  - Calcolo automatico percentuale da superficie lavorata/totale se mancante
  - Logica: se `stato === 'completato'` e `percentuale === 0`, imposta `percentuale = 100`

### Caratteristiche Principali

**Tracciamento Accurato**:
- Ore precise per terreno e macchina
- Possibilità di tracciare utilizzo macchina per ogni campo lavorato
- Statistiche accurate per macchina/attrezzo

**Gestione Automatica Stati**:
- Macchine liberate automaticamente quando attività completata (con "ora fine")
- Macchine impostate come "in_uso" quando attività in corso (senza "ora fine")
- Fallback automatico per attività del giorno precedente

**Controllo Conflitti**:
- Previene sovrapposizioni di orario per stessa macchina/attrezzo
- Permette utilizzo stesso trattore/attrezzo in orari diversi
- Gestisce correttamente attività completate vs attività in corso

**Compatibilità Moduli**:
- Funziona con solo Core Base + modulo Macchine
- Funziona con Core Base + modulo Macchine + modulo Manodopera
- Zero perdita dati quando si aggiungono/rimuovono moduli

### File Creati/Modificati
- ✅ `modules/parco-macchine/services/macchine-utilizzo-service.js` (NUOVO)
- ✅ `core/attivita-standalone.html` (MODIFICATO)
- ✅ `core/admin/gestione-lavori-standalone.html` (MODIFICATO)
- ✅ `core/admin/lavori-caposquadra-standalone.html` (MODIFICATO)
- ✅ `core/statistiche-standalone.html` (MODIFICATO - Sezione Statistiche Macchine aggiunta)
- ✅ `core/admin/validazione-ore-standalone.html` (MODIFICATO - Refactoring service unificato, 2025-01-24)
- ✅ `core/dashboard-standalone.html` (MODIFICATO - Correzione barra progresso lavori completati, 2025-01-24)

#### 5. Statistiche Macchine ✅
- **File modificato**: `core/statistiche-standalone.html`
- **Sezione "Statistiche Macchine"** (visibile solo se modulo Parco Macchine attivo):
  - **Metriche Cards**:
    - Ore Macchine Totali (somma di tutte le ore macchina nel periodo)
    - Macchine Utilizzate (numero di macchine diverse utilizzate)
    - Manutenzioni in Scadenza (conteggio prossimi 30 giorni / 50 ore)
    - Utilizzo Medio Macchina (ore medie per macchina)
  - **Grafici**:
    - Top 5 Macchine Più Utilizzate (bar chart orizzontale)
    - Ore Macchina per Terreno (bar chart verticale)
    - Ore Macchina vs Ore Lavoratore (grafico a ciambella comparativo)
    - Ore Macchine per Mese (line chart temporale)
  - **Dati unificati**: Combina dati da:
    - Attività Core Base (Diario Attività)
    - Ore operai (se modulo Manodopera attivo)
  - **Filtri applicati**: I filtri periodo/terreno/tipo lavoro si applicano anche alle statistiche macchine
  - **Compatibilità**: Funziona con e senza modulo Manodopera

## 📝 Aggiornamenti Recenti (2025-01-24)

### Refactoring Macchine e Correzione Barra Progresso (2025-01-24)

#### Refactoring Validazione Ore ✅
- **File modificato**: `core/admin/validazione-ore-standalone.html`
- Rimossa funzione duplicata `aggiornaOreMacchina()` (75+ righe di codice duplicato)
- Sostituita con chiamata al service unificato `macchine-utilizzo-service.js`
- Aggiunta funzione `loadMacchineUtilizzoService()` per caricamento dinamico del service
- Gestione ambiente file:// (CORS) migliorata
- Zero duplicazione codice: logica centralizzata nel service unificato
- Compatibilità totale mantenuta: stesse funzionalità, codice più pulito e manutenibile
- Le ore macchina vengono aggiornate solo alla validazione (non alla segnatura)

#### Correzione Barra Progresso Lavori Completati ✅
- **Problema identificato**: Lavori completati (soprattutto conto terzi) mostravano barra progresso a 0% anche se completati
- **File modificato**: `core/dashboard-standalone.html`
  - Funzione `loadRecentLavoriManagerManodopera()`: aggiunta visualizzazione barra progresso
  - Funzione `loadRecentLavori()`: aggiunta visualizzazione barra progresso
  - Lavori completati mostrano automaticamente 100% se `percentualeCompletamento` è 0 o mancante
  - Badge "Conto Terzi" visualizzato correttamente nella lista lavori recenti
  - Caricamento terreni per calcolo percentuale se mancante
- **File modificato**: `core/admin/gestione-lavori-standalone.html`
  - Correzione calcolo percentuale per lavori completati nella tabella
  - Lavori completati mostrano 100% anche se `percentualeCompletamento` è 0 o mancante
  - Calcolo automatico percentuale da superficie lavorata/totale se mancante
  - Logica: se `stato === 'completato'` e `percentuale === 0`, imposta `percentuale = 100`

---

### Correzione Tour Terreni (2025-01-24)

### Problema Identificato
Il tour della pagina terreni aveva problemi di posizionamento dei popup:
- Popup che coprivano elementi importanti (barra ricerca)
- Overlay evidenziato non allineato correttamente agli elementi
- Popup non leggibili o tagliati
- Problemi di refresh quando si navigava avanti/indietro nel tour

### Soluzioni Implementate

#### 1. Wrapper Barra Ricerca ✅
- **File modificato**: `core/terreni-standalone.html`
- **Problema**: L'overlay evidenziato non era allineato con la barra di ricerca
- **Soluzione**: Creato wrapper `#map-search-wrapper` che contiene input e pulsante "Cerca"
- **Risultato**: Overlay ora evidenzia correttamente l'area della barra di ricerca

#### 2. Posizionamento Popup Ottimizzato ✅
- **Popup barra ricerca**: Posizionato a sinistra (`position: 'left'`) per non coprire l'input
- **Popup tracciamento confini**: Posizionamento dinamico (~60% viewport) per ottimale leggibilità
- **Funzione `ensureTooltipVisible()`**: Gestisce posizionamento adattivo in base a dimensioni schermo
- **Margini dinamici**: Mobile (30px), Tablet (25px), Desktop (20px)

#### 3. Refresh Overlay Corretto ✅
- **Problema**: Overlay non si aggiornava correttamente quando si navigava avanti
- **Soluzione**: Logica di refresh con tentativi multipli (50ms, 150ms, 300ms, 500ms)
- **Calcolo diretto coordinate**: Overlay posizionato usando `getBoundingClientRect()` dell'elemento target
- **Gestione scroll**: Include `window.scrollY` e `window.scrollX` per coordinate corrette

#### 4. Gestione Modal Migliorata ✅
- **Apertura temporanea**: Modal aperto temporaneamente per costruire step correttamente
- **Chiusura/riapetura**: Modal chiuso prima del tour, riaperto quando necessario
- **Scroll intelligente**: Scroll automatico quando si apre/chiude il modal

#### 5. Ordine Step Ottimizzato ✅
- **Nuovo ordine**: Header → Pulsante aggiungi → Form/Mappa → Lista terreni
- **Lista terreni alla fine**: Spostata dopo tutti gli step del modal per migliore UX
- **Gestione apertura/chiusura**: Modal aperto per step form/mappa, chiuso per lista

### Caratteristiche Finali
- ✅ Popup sempre leggibili e posizionati correttamente
- ✅ Overlay evidenziato allineato perfettamente agli elementi
- ✅ Navigazione fluida avanti/indietro senza problemi di posizionamento
- ✅ Adattivo a diverse dimensioni schermo (mobile, tablet, desktop)
- ✅ Scroll automatico intelligente per mantenere tutto visibile

**File modificati**: `core/terreni-standalone.html`

---

## 📝 Aggiornamenti Recenti (2025-12-09) - Fix Statistiche e Permessi

### 1. Fix Visualizzazione Caposquadra nelle Statistiche Manodopera ✅

**Problema Identificato**:
- I caposquadra non venivano visualizzati correttamente nella tabella statistiche
- Il campo "Tipo Operaio" risultava vuoto per i caposquadra senza `tipoOperaio` impostato
- Il sistema leggeva solo `tipoOperaio`, ignorando il ruolo `caposquadra`

**Soluzione Implementata**:
- **Funzione `getTipoOperaioDisplay()`**: Combina ruolo e tipoOperaio per visualizzazione corretta
  - Se è caposquadra senza `tipoOperaio` → mostra "Caposquadra"
  - Se è caposquadra con `tipoOperaio` → mostra "Caposquadra - Trattorista" (esempio)
  - Se è solo operaio → mostra solo il tipoOperaio
- **Salvataggio ruoli**: Ora vengono salvati anche i `ruoli` quando si caricano i dati degli operai
- **Filtro aggiornato**: Aggiunta opzione "Caposquadra" nel dropdown filtro
- **Dropdown operai**: Ora include anche i caposquadra (non solo gli operai)

**Caratteristiche**:
- ✅ I caposquadra compaiono sempre nelle statistiche, anche senza `tipoOperaio` impostato
- ✅ Distinzione mantenuta tra ruolo (permessi) e tipo (classificazione)
- ✅ Possibilità di filtrare per "Caposquadra" nel dropdown
- ✅ Statistiche per tipo ora mostrano anche "Caposquadra" come categoria separata

**File modificati**: `core/admin/statistiche-manodopera-standalone.html`

---

### 2. Fix Permessi Firestore per Categorie Attrezzi ✅

**Problema Identificato**:
- Errore "Missing or insufficient permissions" in `gestione-macchine-standalone.html`
- La collezione `categorieAttrezzi` (vecchia collezione per migrazione) non aveva regole Firestore

**Soluzione Implementata**:
- Aggiunta regola Firestore per `categorieAttrezzi`:
  - **Lettura**: permessa per utenti autenticati del tenant
  - **Scrittura**: permessa solo per Manager/Amministratore del tenant
- Stessa logica della regola per `categorieLavori` (altra collezione vecchia per migrazione)

**File modificati**: `firestore.rules`

---

### 3. Fix Funzione escapeHtml Mancante in Statistiche ✅

**Problema Identificato**:
- Errore `ReferenceError: escapeHtml is not defined` in `statistiche-standalone.html`
- La funzione veniva chiamata ma non era definita nel file

**Soluzione Implementata**:
- Aggiunta funzione `escapeHtml()` per prevenire XSS quando si inserisce testo nell'HTML
- Funzione posizionata prima di `loadStatisticheTerreni()` dove viene utilizzata

**File modificati**: `core/statistiche-standalone.html`

---

## 📝 Aggiornamenti Recenti (2025-12-10) - Supporto Operai Autonomi e Comunicazioni

### 1. Regole Firestore per Comunicazioni ✅

**Problema Identificato**:
- Gli operai non potevano leggere le comunicazioni del tenant
- Gli operai non potevano confermare la ricezione delle comunicazioni (aggiornare campo `conferme`)

**Soluzione Implementata**:
- Aggiunta regola Firestore per `/tenants/{tenantId}/comunicazioni/{comunicazioneId}`:
  - **Lettura**: permessa per utenti autenticati del tenant (`isAuthenticated() && belongsToTenant(tenantId)`)
  - **Creazione**: permessa per caposquadra e manager/admin (`hasRole('caposquadra') || isManagerOrAdmin()`)
  - **Aggiornamento**: permessa per caposquadra/manager/admin O per operai che aggiornano solo il campo `conferme`
  - **Eliminazione**: permessa solo per manager/admin

**Caratteristiche**:
- ✅ Operai possono leggere tutte le comunicazioni del loro tenant
- ✅ Operai possono confermare la ricezione aggiornando il campo `conferme`
- ✅ Caposquadra e manager possono creare e gestire comunicazioni
- ✅ Solo manager/admin possono eliminare comunicazioni

**File modificati**: `firestore.rules`

---

### 2. Supporto Operai Autonomi - Segnatura Lavori Completati ✅

**Problema Identificato**:
- Gli operai autonomi non potevano segnare come completato i lavori autonomi assegnati a loro
- La funzione `segnaCompletato` in `lavori-caposquadra-standalone.html` supportava solo i caposquadra per lavori di squadra
- Le regole Firestore per `lavori` non permettevano agli operai di aggiornare i lavori autonomi

**Soluzione Implementata**:

#### A. Regole Firestore per Lavori - Operai Autonomi
- Aggiunta regola per permettere agli operai di aggiornare lavori autonomi assegnati a loro:
  - **Condizioni**: `hasRole('operaio') && resource.data.operaioId == request.auth.uid && resource.data.caposquadraId == null`
  - **Campi permessi**: `stato`, `percentualeCompletamentoTracciata`, `completatoDa`, `completatoIl`, `aggiornatoIl`
  - **Stati permessi**: `completato_da_approvare`, `in_corso`, o mantenere lo stato corrente
- Aggiunto campo `percentualeCompletamentoTracciata` alla lista dei campi permessi per operai

#### B. Funzione `segnaCompletato` Aggiornata
- **Supporto doppio**: Ora supporta sia caposquadra (lavori di squadra) che operai (lavori autonomi)
- **Verifica permessi**:
  - Per caposquadra: verifica che il lavoro sia di squadra (`caposquadraId == userId && operaioId == null`)
  - Per operai: verifica che il lavoro sia autonomo (`operaioId == userId && caposquadraId == null`)
- **Log di debug**: Aggiunti log dettagliati per tracciare:
  - Dati lavoro (ID, nome, caposquadraId, operaioId, stato)
  - Utente corrente (ID, ruoli)
  - Campi aggiornati
  - Esito operazione

#### C. Logica Visualizzazione Lavori Migliorata
- **Lavori "assegnato"**: Ora vengono mostrati anche se la data inizio è futura
- **Lavori "in_corso"**: Mostrati solo se la data inizio è oggi o passata
- **Log di debug**: Aggiunti log per tracciare totale lavori, lavori diretti, lavori inclusi

**Caratteristiche**:
- ✅ Operai autonomi possono segnare come completato i lavori autonomi assegnati a loro
- ✅ Caposquadra possono segnare come completato i lavori di squadra assegnati a loro
- ✅ Validazione permessi lato client e server (Firestore rules)
- ✅ Log dettagliati per debugging e tracciamento operazioni
- ✅ Messaggi di errore specifici per tipo di lavoro (squadra vs autonomo)

**File modificati**: 
- `firestore.rules`
- `core/admin/lavori-caposquadra-standalone.html`
- `core/dashboard-standalone.html`

---

### 3. Log di Debug Aggiunti ✅

**Miglioramenti Debug**:
- **`loadLavori()` in lavori-caposquadra-standalone.html**: Log per `isCaposquadra`, `isOperaio`, `userId`, `totaleLavori`
- **`segnaCompletato()`**: Log dettagliati per dati lavoro, utente corrente, permessi, campi aggiornati
- **`loadComunicazioniOperaio()` in dashboard-standalone.html**: Log per tracciare caricamento e filtraggio comunicazioni
- **`loadLavoriOggiOperaio()`**: Log per totale lavori, lavori diretti, lavori inclusi

**Caratteristiche**:
- ✅ Debug completo per tracciare flusso dati e permessi
- ✅ Facilita identificazione problemi di permessi o logica
- ✅ Log strutturati con emoji per facile identificazione

**File modificati**: 
- `core/admin/lavori-caposquadra-standalone.html`
- `core/dashboard-standalone.html`

---

## ✅ Evidenziazione Visiva Lavori Conto Terzi (2025-12-10)

### Obiettivo
Rendere immediatamente riconoscibili i lavori conto terzi rispetto ai lavori interni, sia nella gestione lavori che nel diario da lavori della dashboard.

### Implementazione

#### Gestione Lavori
- **File modificato**: `core/admin/gestione-lavori-standalone.html`
- **Filtro "Tipo Lavoro"**: Aggiunto filtro per separare lavori interni da conto terzi
  - Opzioni: Tutti i lavori, Lavori Interni, Conto Terzi
- **Evidenziazione visiva**: Gradiente blu/azzurro (`#E3F2FD` → `#BBDEFB`) per lavori conto terzi
  - Bordo sinistro blu (`#1976D2`)
  - Badge "💼 Conto Terzi" accanto al nome lavoro
  - Hover con gradiente più scuro
- **Logica filtraggio**: Filtra in base al campo `clienteId` (se presente = conto terzi)
- **Applicato a tutte le sezioni**: Tabella lavori normali e sezione lavori in attesa di approvazione

#### Dashboard - Diario da Lavori
- **File modificato**: `core/dashboard-standalone.html`
- **Evidenziazione visiva**: Stesso gradiente blu/azzurro per lavori conto terzi
  - Badge "💼 Conto Terzi" accanto al tipo lavoro
  - Stile CSS inline per evitare conflitti
- **Campo clienteId**: Aggiunto all'oggetto attività quando viene creata dalla funzione `loadDiarioDaLavori()`

### Caratteristiche
- ✅ Stile coerente con sezione Conto Terzi (colori blu distintivi)
- ✅ Riconoscimento immediato a colpo d'occhio
- ✅ Filtro funzionante insieme agli altri filtri esistenti
- ✅ Compatibile con tutti i moduli attivi

**File modificati**:
- `core/admin/gestione-lavori-standalone.html`
- `core/dashboard-standalone.html`

---

## ✅ Pianificazione Lavori Conto Terzi senza Manodopera (2025-12-10) - COMPLETATO

### Problema Risolto
Quando un utente ha solo **Core Base + Conto Terzi** (o **Core Base + Parco Macchine + Conto Terzi**), può creare lavori da preventivi accettati e ora può anche pianificarli perché la pagina "Gestione Lavori" è accessibile anche senza il modulo Manodopera attivo.

### Scenario Realistico
Piccolo proprietario che:
- Fa lavori conto terzi per clienti
- Ha trattori/attrezzi da gestire (Parco Macchine)
- Lavora da solo o con pochi collaboratori
- Non ha bisogno di gestione squadre/operai (Manodopera)

### Soluzione Implementata: Opzione 1 Rivista

**"Gestione Lavori" accessibile anche senza Manodopera**, con modalità semplificata:

#### Quando Manodopera NON è attivo:
- ✅ Mostra solo pianificazione base:
  - Nome lavoro
  - Terreno
  - Tipo lavoro
  - Data inizio
  - Durata prevista
  - Note
  - Stato (da_pianificare → in_corso → completato)
- ✅ Se Parco Macchine attivo: mostra anche assegnazione macchine (trattore/attrezzo)
- ✅ Nascondi completamente:
  - Assegnazione caposquadra/operai
  - Gestione squadre
  - Tracciamento zone lavorate
  - Segnatura/validazione ore
- ✅ Se lavoro ha `clienteId` (conto terzi): mostra anche dati cliente
- ✅ Generazione automatica voce diario quando lavoro completato

#### Quando Manodopera è attivo:
- ✅ Mostra tutte le funzionalità complete (come prima)

### Implementazione Tecnica
- ✅ Funzione `setupManodoperaVisibility()` nasconde/mostra elementi in base al modulo attivo
- ✅ Validazione semplificata: richiede solo terreno quando Manodopera non attivo
- ✅ Stato default `in_corso` quando Manodopera non attivo
- ✅ Funzione `generaVoceDiarioContoTerzi()` crea attività automaticamente
- ✅ Supporto completo Parco Macchine anche senza Manodopera
- ✅ Filtro `da_pianificare` funziona anche senza Manodopera

### Vantaggi
- ✅ Funziona in tutti gli scenari realistici
- ✅ Non duplica codice (una sola pagina che si adatta)
- ✅ Scalabile (se aggiungi Manodopera dopo, tutto funziona già)
- ✅ Non cambia il Core Base (pianificazione rimane opzionale)

### Impatto
- **Core Base**: Rimane "solo diario" per default
- **Pianificazione lavori**: Diventa disponibile solo se crei lavori da preventivi o manualmente
- **Non obbligatoria**: Puoi continuare a usare solo il diario attività

### File Modificati
- ✅ `core/admin/gestione-lavori-standalone.html` - Funzione `setupManodoperaVisibility()`, validazione semplificata, generazione voce diario

### Stato
✅ **Completato** (2025-12-10)

**File da modificare**:
- `core/admin/gestione-lavori-standalone.html` - Rimuovere blocco Manodopera, aggiungere modalità semplificata

---

## 🆕 Modifiche 2025-12-14

### Branding Email Preventivi con Logo Aziendale ✅ COMPLETATO

#### Configurazione Firebase Storage CORS
- ✅ **Installato Google Cloud SDK**: Installato Google Cloud SDK su Windows per accesso a `gsutil`
- ✅ **Configurato CORS Storage**: Configurato CORS sul bucket Firebase Storage (`gfv-platform.firebasestorage.app`) per permettere richieste da:
  - `https://vitaradragon.github.io` (GitHub Pages)
  - `http://localhost:*` (sviluppo locale)
  - `http://127.0.0.1:*` (sviluppo locale)
- ✅ **File creati**:
  - `cors.json`: Configurazione CORS per bucket Storage
  - `CONFIGURA_CORS_STORAGE.md`: Guida dettagliata per configurazione CORS
- ✅ **Comandi eseguiti**:
  ```bash
  gcloud init  # Configurazione progetto gfv-platform
  gsutil cors set cors.json gs://gfv-platform.firebasestorage.app
  gsutil cors get gs://gfv-platform.firebasestorage.app  # Verifica
  ```

#### Caricamento Logo Aziendale
- ✅ **Upload logo**: Implementata funzionalità completa per caricare logo aziendale nelle Impostazioni
  - File: `core/admin/impostazioni-standalone.html`
  - Input file con preview
  - Validazione file (solo immagini, max 2MB)
  - Normalizzazione tenant ID per percorsi Storage
  - Upload su Firebase Storage con metadata
  - Salvataggio `logoUrl` in Firestore tenant document
- ✅ **Eliminazione logo**: Implementata funzionalità per rimuovere logo esistente
  - Eliminazione da Firebase Storage
  - Rimozione `logoUrl` da Firestore
- ✅ **Visualizzazione logo**: Logo mostrato nell'anteprima e nelle email preventivi
- ✅ **Gestione errori**: Messaggi specifici per:
  - CORS errors
  - Permission errors
  - Network errors
  - Bucket not found
  - File protocol (file://) warnings

#### Regole Firebase Storage
- ✅ **File creato**: `storage.rules`
- ✅ **Regole implementate**:
  - Solo utenti autenticati del tenant possono upload/delete loghi
  - Validazione dimensione file (max 2MB)
  - Validazione content type (solo immagini)
  - Percorso: `tenants/{tenantId}/logo_*.{ext}`
- ✅ **Firebase.json aggiornato**: Aggiunta sezione `storage` con riferimento a `storage.rules`

#### Template Email Preventivi
- ✅ **Template EmailJS aggiornato**: Template completo con branding aziendale
  - Header più alto (40px padding, min-height 120px) per spazio logo
  - Logo aziendale nell'header (se presente)
  - Nome azienda ben formattato (bianco, 36px, bold, text-shadow)
  - Footer con dati azienda completi (nome, indirizzo, telefono, email, P.IVA)
- ✅ **Variabili EmailJS**:
  - `logo_url`: URL del logo (solo URL, non HTML)
  - `nome_azienda`: Nome azienda per header
  - `nome_azienda_footer`: Nome azienda per footer
  - `indirizzo_azienda`, `telefono_azienda`, `email_azienda`, `piva_azienda`: Dati azienda
- ✅ **File modificato**: `modules/conto-terzi/views/preventivi-standalone.html`
  - Preparazione variabili azienda per template email
  - Invio `logo_url` invece di HTML per evitare problemi EmailJS
  - Debug logging per verifica dati inviati

#### Risoluzione Problemi EmailJS
- ✅ **Problema "corrupted variables"**: Risolto usando solo URL per logo invece di HTML nelle variabili
- ✅ **Template HTML**: Template configurato correttamente per HTML con variabili semplici
- ✅ **Rendering logo**: Logo renderizzato correttamente usando `{{logo_url}}` direttamente nel tag `<img>`

#### Documentazione
- ✅ **File aggiornati**:
  - `GUIDA_CONFIGURAZIONE_FIREBASE.md`: Aggiunta sezione "STEP 9: Configura Firebase Storage"
  - `CONFIGURA_CORS_STORAGE.md`: Guida completa per configurazione CORS
  - `ISTRUZIONI_TEMPLATE_EMAIL_PREVENTIVO.md`: Aggiornate variabili EmailJS con dati azienda

### Risultato Finale
- ✅ Logo aziendale visibile nelle email preventivi
- ✅ Nome azienda ben formattato e leggibile nell'header email
- ✅ Dati azienda completi nel footer email
- ✅ Email funzionanti senza errori
- ✅ Branding aziendale invece di "GFV Platform" nelle email preventivi

---

## ✅ Rimozione Log Debug Completa (2025-01-26)

### Obiettivo
Rimuovere tutti i log di debug (`console.log`, `console.debug`, `console.info`) dal codice per preparare l'applicazione alla produzione, mantenendo solo i log critici (`console.error`, `console.warn`).

### Implementazione

#### Metodo Utilizzato
- ✅ **Script PowerShell automatico**: Creato script per rimozione batch di tutti i log
- ✅ **Pattern matching intelligente**: Rimuove righe con `console.log/debug/info` mantenendo indentazione corretta
- ✅ **Backup automatici**: Ogni file viene salvato con estensione `.backup` prima della modifica
- ✅ **Gestione multilinea**: Pattern regex gestisce anche log complessi con template literals

#### File Principali Processati
- ✅ **dashboard-standalone.html**: 180 log → 0 log
- ✅ **gestione-lavori-standalone.html**: 68 log → 0 log
- ✅ **attivita-standalone.html**: 36 log → 0 log
- ✅ **terreni-standalone.html**: 27 log → 0 log

#### File Secondari Processati
- ✅ **48 file HTML/JS** nella cartella `core/` processati automaticamente
- ✅ **314 log rimossi** dai file secondari
- ✅ File di autenticazione, admin, servizi, modelli tutti puliti

### Risultati

#### Statistiche Finali
- ✅ **Totale log rimossi**: 625 log
- ✅ **File processati**: 52 file (4 principali + 48 secondari)
- ✅ **Log rimanenti**: Solo 2 log nei file di documentazione (.md) - parte della documentazione, non da rimuovere
- ✅ **Tempo impiegato**: ~2 ore (incluso sviluppo script e verifica)

#### Tipi di Log Rimossi
- ✅ Log tour interattivi (`[TOUR DEBUG]`)
- ✅ Log caricamento dati Firebase
- ✅ Log inizializzazione Google Maps
- ✅ Log autenticazione e gestione ruoli
- ✅ Log tracciamento e validazione
- ✅ Log migrazione dati
- ✅ Log statistiche e calcoli

#### Log Mantenuti
- ✅ `console.error`: Per errori critici
- ✅ `console.warn`: Per warning importanti
- ✅ Log nei file di documentazione (.md): Parte della documentazione

### Vantaggi
- ✅ **Performance**: Nessun overhead da log inutili in produzione
- ✅ **Sicurezza**: Nessun leak di informazioni sensibili nella console
- ✅ **Professionalità**: Console pulita per utenti finali
- ✅ **Manutenibilità**: Codice più pulito e leggibile
- ✅ **Pronto per produzione**: Codice ottimizzato per deployment

### File Modificati
- ✅ Tutti i file HTML/JS nella cartella `core/` (52 file totali)
- ✅ File di backup creati automaticamente (poi rimossi)

### Stato
✅ **COMPLETATO** (2025-01-26)

Il codice è ora completamente pulito da log di debug e pronto per la produzione.

---

## 🔧 Miglioramento Sistema Guasti: Distinzione Trattore/Attrezzo (2025-01-26)

### Problema Identificato
Quando veniva segnalato un guasto per una combinazione "Trattore + Attrezzo", il sistema salvava entrambi gli ID ma non distingueva quale componente aveva effettivamente il guasto. Questo causava:
- **Storico guasti errato**: Lo storico dell'attrezzo non mostrava i guasti perché la query cercava solo per `macchinaId`
- **Tracciabilità imprecisa**: Impossibile sapere se un guasto era del trattore o dell'attrezzo
- **Gestione manutenzione**: Difficile gestire correttamente la manutenzione dei singoli componenti

### Soluzione Implementata

#### 1. Campo `componenteGuasto` nel Form Segnalazione ✅
- **File**: `core/admin/segnalazione-guasti-standalone.html`
- **Modifica**: Aggiunto dropdown obbligatorio "Componente con guasto" sempre visibile
- **Opzioni**: 
  - `trattore` - Guasto del trattore
  - `attrezzo` - Guasto dell'attrezzo
  - `entrambi` - Guasto di entrambi i componenti
- **Pre-selezione automatica**: Il dropdown si aggiorna automaticamente in base ai dropdown trattore/attrezzo selezionati
- **Validazione**: Verifica coerenza tra componente selezionato e trattore/attrezzo scelti

#### 2. Salvataggio e Gestione Stato ✅
- **File**: `core/admin/segnalazione-guasti-standalone.html`
- **Modifiche**:
  - Campo `componenteGuasto` salvato nel documento guasto
  - Aggiornamento stato macchina/attrezzo **solo** se il guasto riguarda quel componente specifico
  - Risoluzione guasto: ripristino stato solo per il componente interessato

#### 3. Query Storico Guasti Migliorata ✅
- **File**: `core/admin/gestione-macchine-standalone.html`
- **Modifiche**:
  - **Per trattori**: Cerca guasti dove `macchinaId` corrisponde E `componenteGuasto` è `'trattore'` o `'entrambi'`
  - **Per attrezzi**: Cerca guasti dove `attrezzoId` corrisponde E `componenteGuasto` è `'attrezzo'` o `'entrambi'`
  - Filtraggio in memoria per maggiore flessibilità (evita problemi con indici Firestore)

#### 4. Visualizzazione Migliorata ✅
- **File**: `core/admin/gestione-macchine-standalone.html`
- **Modifiche**:
  - Badge colorato che indica il componente interessato (Trattore, Attrezzo, Entrambi)
  - Visualizzazione aggiornata nella lista guasti per mostrare correttamente il componente

#### 5. Retrocompatibilità ✅
- Gestione di guasti esistenti senza campo `componenteGuasto` (default: `'trattore'`)
- Nessun breaking change per dati legacy

### Vantaggi
- ✅ **Storico corretto**: Lo storico del trattore mostra solo guasti del trattore, quello dell'attrezzo solo guasti dell'attrezzo
- ✅ **Tracciabilità precisa**: Chiaro quale componente ha avuto il guasto
- ✅ **Gestione manutenzione migliorata**: Possibilità di gestire correttamente la manutenzione dei singoli componenti
- ✅ **UX migliorata**: Pre-selezione automatica del componente riduce errori dell'utente
- ✅ **Retrocompatibilità**: Funziona con dati esistenti

### File Modificati
- ✅ `core/admin/segnalazione-guasti-standalone.html` - Form segnalazione con dropdown componente
- ✅ `core/admin/gestione-macchine-standalone.html` - Query e visualizzazione storico guasti migliorata

### Stato
✅ **COMPLETATO** (2025-01-26)

Il sistema di segnalazione guasti ora distingue correttamente tra trattore e attrezzo, permettendo una gestione più precisa della manutenzione.

## ✅ Ripristino Funzione Comunicazione Rapida Dashboard Caposquadra (2025-12-28) - COMPLETATO

### Obiettivo
Ripristinare la funzionalità di comunicazione rapida nella dashboard del caposquadra che era rimasta bloccata in "Caricamento lavori..." a causa della mancanza della funzione `renderComunicazioneRapidaForm`.

### Problema Identificato
- La sezione "Invia Comunicazione Rapida alla Squadra" nella dashboard del caposquadra rimaneva bloccata in "Caricamento lavori..."
- La funzione `window.renderComunicazioneRapidaForm` non era definita nel codice
- Durante un refactoring precedente, la funzione era stata rimossa dal file HTML ma non era stata ricreata in un modulo JavaScript
- Il codice in `loadComunicazioneRapida` cercava di chiamare la funzione ma non la trovava, quindi il form non veniva mai renderizzato

### Implementazione

#### 1. Creazione Funzione `renderComunicazioneRapidaForm` ✅
- **File**: `core/js/dashboard-data.js`
- Funzione esportata che renderizza il form HTML per la comunicazione rapida
- Legge i lavori attivi da `window.lavoriAttiviCaposquadra`
- Pre-compila automaticamente podere, terreno e lavoro dal primo lavoro attivo
- Mostra dropdown per selezionare lavoro se ce ne sono più di uno
- Include escape HTML per sicurezza dei dati inseriti

#### 2. Form HTML Renderizzato ✅
- **Campi del form**:
  - Dropdown selezione lavoro (se più lavori disponibili) o nome lavoro (se un solo lavoro)
  - Podere (campo di sola lettura, pre-compilato)
  - Campo/Terreno (campo di sola lettura, pre-compilato)
  - Orario di ritrovo (input time, default 07:00, obbligatorio)
  - Note (textarea opzionale)
  - Area messaggi per feedback successo/errore
  - Pulsante "Invia Comunicazione"

#### 3. Integrazione nel File Dashboard ✅
- **File**: `core/dashboard-standalone.html`
- Aggiunto import della funzione `renderComunicazioneRapidaForm` dal modulo `dashboard-data.js`
- Creato wrapper globale `window.renderComunicazioneRapidaForm` per compatibilità con attributi HTML `onchange`/`onsubmit`
- La funzione è ora disponibile globalmente e viene chiamata correttamente da `loadComunicazioneRapida`

#### 4. Event Handler Collegati ✅
- `handleRapidaLavoroChange()` - Aggiorna podere/terreno quando cambia il lavoro selezionato
- `handleSendComunicazioneRapida()` - Gestisce l'invio della comunicazione alla squadra
- `showRapidaMessage()` - Mostra messaggi di successo/errore

### Funzionalità Ripristinata
- ✅ Form di comunicazione rapida si carica correttamente
- ✅ Pre-compilazione automatica podere, terreno e lavoro
- ✅ Dropdown per selezionare lavoro se più lavori attivi
- ✅ Invio comunicazione rapida alla squadra con un click
- ✅ Coordinate podere salvate automaticamente (se disponibili) per Google Maps
- ✅ Link "Indicazioni" nella dashboard operai per raggiungere il punto di ritrovo

### File Modificati
- ✅ `core/js/dashboard-data.js` - Aggiunta funzione `renderComunicazioneRapidaForm` con escape HTML
- ✅ `core/dashboard-standalone.html` - Aggiunto import e wrapper globale per la funzione

### Note Tecniche
- La funzione usa `window.lavoriAttiviCaposquadra` (popolato da `loadComunicazioneRapida`)
- Escape HTML implementato per sicurezza (previene XSS)
- La funzione è modulare e può essere facilmente estesa in futuro
- Compatibilità mantenuta con event handler esistenti tramite wrapper globali

### Stato
✅ **COMPLETATO** (2025-12-28)

La comunicazione rapida nella dashboard del caposquadra è ora completamente funzionante. Il form si carica correttamente e permette di inviare comunicazioni alla squadra con pre-compilazione automatica dei dati dal lavoro selezionato.

---

## ✅ Fix Sistema Multi-Tenant: Switch Tenant e Dashboard (2026-01-12) - COMPLETATO

### Obiettivo
Risolvere i problemi del sistema multi-tenant dopo l'implementazione iniziale:
1. Lo switch tra tenant non funzionava correttamente
2. La dashboard mostrava sempre i dati del tenant precedente invece di quello corrente
3. I ruoli non venivano filtrati per il tenant corrente

### Implementazione

#### 1. Fix Switch Tenant - Problema getUserTenants() ✅
- **Problema**: Quando `switchTenant()` chiamava `getUserTenants()`, la variabile locale `currentUser` era `null`, causando l'errore "Utente non ha accesso a questo tenant"
- **Causa**: `getUserTenants()` dipendeva da `currentUser` locale che non era sempre sincronizzato con Firebase Auth
- **Soluzione**: 
  - Modificato `switchTenant()` per ottenere direttamente l'utente da Firebase Auth usando `getAuthInstance().currentUser`
  - Passato esplicitamente l'`userId` a `getUserTenants(userId)` invece di fare affidamento su `currentUser` locale
  - Aggiunto fallback in `getUserTenants()` per usare Firebase Auth direttamente se `currentUser` è `null`
- **File Modificati**:
  - ✅ `core/services/tenant-service.js` - Modificato `switchTenant()` e `getUserTenants()` per usare Firebase Auth come fonte affidabile

#### 2. Fix Dashboard - Filtro Ruoli per Tenant Corrente ✅
- **Problema**: La dashboard mostrava sempre la vista del tenant precedente perché usava `userData.ruoli` (tutti i ruoli dell'utente) invece dei ruoli filtrati per il tenant corrente
- **Causa**: `renderDashboard()` riceveva `userDataNormalized` con tutti i ruoli dell'utente, non filtrati per il tenant corrente
- **Soluzione**: 
  - Modificato il caricamento dati utente nella dashboard per usare `getUserRolesForTenant(currentTenantId, user.uid)` invece di `userData.ruoli`
  - Aggiunto fallback a `userData.ruoli` deprecato solo se non ci sono ruoli per il tenant corrente (retrocompatibilità)
  - Aggiornato `userDataNormalized` per includere `tenantId: currentTenantId` invece del tenant deprecato
- **File Modificati**:
  - ✅ `core/dashboard-standalone.html` - Modificato caricamento dati utente per filtrare ruoli per tenant corrente

#### 3. Fix Caricamento Dati - Uso getCurrentTenantId() invece di userData.tenantId ✅
- **Problema**: Le funzioni di caricamento dati (mappa, statistiche, lavori) usavano `userData.tenantId` deprecato che conteneva sempre il tenant originale, causando il caricamento dei dati del tenant sbagliato
- **Causa**: Tutte le funzioni `load*` usavano `userData.tenantId` invece di `getCurrentTenantId()` per ottenere il tenant corrente
- **Soluzione**: 
  - Modificato `loadManagerManodoperaStats()` per usare `getCurrentTenantId()` invece di `userData.tenantId`
  - Modificato `loadMappaAziendale()` per usare `getCurrentTenantId()` invece di `userData.tenantId`
  - Modificato `loadAndDrawZoneLavorate()` per usare `getCurrentTenantId()` invece di `userData.tenantId`
  - Modificato `loadAndDrawIndicatoriLavori()` per usare `getCurrentTenantId()` invece di `userData.tenantId`
  - Aggiunto fallback a `userData.tenantId` per retrocompatibilità
- **File Modificati**:
  - ✅ `core/js/dashboard-data.js` - Modificato `loadManagerManodoperaStats()` per usare tenant corrente
  - ✅ `core/js/dashboard-maps.js` - Modificato `loadMappaAziendale()`, `loadAndDrawZoneLavorate()`, `loadAndDrawIndicatoriLavori()` per usare tenant corrente

#### 4. Fix Caricamento Moduli Tenant Corrente ✅
- **Problema**: I moduli disponibili venivano caricati dal tenant deprecato invece che dal tenant corrente
- **Causa**: Il codice usava `userData.tenantId` per caricare i moduli dal documento tenant
- **Soluzione**: 
  - Modificato il caricamento moduli per usare `getCurrentTenantId()` invece di `userData.tenantId`
  - Applicato sia nel flusso principale che nel flusso di creazione documento utente
- **File Modificati**:
  - ✅ `core/dashboard-standalone.html` - Modificato caricamento moduli per usare tenant corrente

#### 5. Pulizia Log Debug ✅
- **Obiettivo**: Rimuovere tutti i log di debug aggiunti durante il troubleshooting, mantenendo solo gli errori critici
- **Implementazione**: 
  - Rimossi tutti i log `console.error` con prefissi `[GET_USER_TENANTS]`, `[SWITCH_TENANT]`, `[DASHBOARD]`, `[LOAD_MAPPA]`, `[ACCEPT_INVITO]`, `[REGISTRAZIONE]`
  - Mantenuti solo i log di errore critici (`console.error` per errori reali, `console.warn` per warning)
  - Rimossi log informativi che non sono necessari in produzione
- **File Modificati**:
  - ✅ `core/services/tenant-service.js` - Rimossi log debug da `getUserTenants()`, `switchTenant()`, `clearUserTenantsCache()`
  - ✅ `core/dashboard-standalone.html` - Rimossi log per tenant corrente, ruoli e moduli
  - ✅ `core/js/dashboard-data.js` - Rimosso log warning in `loadManagerManodoperaStats()`
  - ✅ `core/js/dashboard-maps.js` - Rimosso log warning in `loadAndDrawZoneLavorate()`
  - ✅ `core/services/invito-service-standalone.js` - Rimossi log debug, mantenuti solo errori critici
  - ✅ `core/auth/registrazione-invito-standalone.html` - Rimossi log debug, mantenuti solo errori critici

### Test Completati
- ✅ **Switch Tenant**: Funziona correttamente tra SABBIE GIALLE e ROSSO
- ✅ **Ruoli Filtrati**: La dashboard mostra i ruoli corretti per ogni tenant (manager in SABBIE GIALLE, caposquadra in ROSSO)
- ✅ **Dati Isolati**: I dati caricati (mappa, statistiche, lavori) appartengono al tenant corrente
- ✅ **Moduli Corretti**: I moduli disponibili sono quelli del tenant corrente
- ✅ **Vista Dashboard**: La dashboard mostra la vista corretta in base ai ruoli del tenant corrente

### File Modificati
- ✅ `core/services/tenant-service.js`
  - Modificato `switchTenant()` per usare Firebase Auth direttamente
  - Modificato `getUserTenants()` per aggiungere fallback a Firebase Auth
  - Rimossi log debug
- ✅ `core/dashboard-standalone.html`
  - Modificato caricamento dati utente per filtrare ruoli per tenant corrente
  - Modificato caricamento moduli per usare tenant corrente
  - Rimossi log debug
- ✅ `core/js/dashboard-data.js`
  - Modificato `loadManagerManodoperaStats()` per usare `getCurrentTenantId()`
  - Rimosso log warning
- ✅ `core/js/dashboard-maps.js`
  - Modificato `loadMappaAziendale()` per usare `getCurrentTenantId()`
  - Modificato `loadAndDrawZoneLavorate()` per usare `getCurrentTenantId()`
  - Modificato `loadAndDrawIndicatoriLavori()` per usare `getCurrentTenantId()`
  - Rimosso log warning
- ✅ `core/services/invito-service-standalone.js`
  - Rimossi log debug, mantenuti solo errori critici
- ✅ `core/auth/registrazione-invito-standalone.html`
  - Rimossi log debug, mantenuti solo errori critici

### Note Tecniche
- Il sistema multi-tenant ora funziona correttamente con isolamento completo dei dati per tenant
- I ruoli vengono filtrati correttamente per ogni tenant, permettendo a un utente di avere ruoli diversi in tenant diversi
- La dashboard si aggiorna correttamente quando si cambia tenant, mostrando i dati e la vista corretti
- Tutti i servizi ora usano `getCurrentTenantId()` invece di `userData.tenantId` deprecato per garantire coerenza
- Il codice è pulito e pronto per la produzione senza log di debug

### Stato
✅ **COMPLETATO** (2026-01-12)

Il sistema multi-tenant è ora completamente funzionante. Gli utenti possono appartenere a più tenant con ruoli diversi, e lo switch tra tenant funziona correttamente con isolamento completo dei dati e delle viste dashboard.


## 2026-03-26 - Tony preventivo da qualsiasi pagina: fix coercion cross-page

### Problema
- In alcuni casi la Cloud Function restituiva `INJECT_FORM_DATA` con `formId: "attivita-form"` ma con chiavi del preventivo (`cliente-id`, `tipo-lavoro`, `coltura-categoria`, ecc.).
- La coercion verso `preventivo-form` avveniva solo quando `#preventivo-form` era già nel DOM, quindi fuori dalla pagina Nuovo Preventivo il comando poteva non attivare il flusso corretto cross-page.

### Soluzione
- Aggiornato `core/js/tony/main.js` nel ramo `INJECT_FORM_DATA`:
  - rilevamento "payload preventivo" su `attivita-form` eseguito **prima** dei controlli DOM;
  - coercion immediata a `formId: "preventivo-form"` anche quando il form non è presente nella pagina corrente;
  - mantenuto il flusso standard scalabile: `INJECT_FORM_DATA` → guard `preventivo-form` assente → `APRI_PAGINA` con `_tonyPendingModal/_tonyPendingFields` → iniezione post-navigazione.

### Risultato
- Richiesta "crea/compila preventivo" più robusta da qualunque pagina, senza dipendere dalla presenza iniziale di `#preventivo-form` nel DOM.
- Nessuna patch locale per singola pagina: comportamento centralizzato nel core Tony.

## 2026-03-26 - Preventivo: fallback terreno automatico per cliente univoco

### Problema
- In alcuni flussi cross-page il comando `INJECT_FORM_DATA` per `preventivo-form` arrivava senza `terreno-id` (solo cliente + lavorazione), quindi la pagina Nuovo Preventivo restava con campi mancanti anche quando nel contesto cliente era disponibile un terreno univoco.

### Soluzione
- Aggiornata `enrichPreventivoCommandFormData` in `functions/index.js`:
  - mantiene l’arricchimento esistente (`cliente-id`, `tipo-lavoro`, `terreno-id` da inferenza fuzzy);
  - aggiunge fallback contestuale robusto: se `terreno-id` manca e per il `cliente-id` risulta un solo terreno cliente in `ctx.azienda.terreniClienti`, imposta automaticamente `terreno-id` con quell’elemento;
  - se `cliente-id` arriva come testo (ragione sociale) lo normalizza e lo converte all’ID cliente prima del filtro terreni.

### Risultato
- Da qualsiasi pagina, la compilazione preventivo mantiene il terreno quando il contesto è univoco lato cliente, riducendo i casi di inject parziale.

## 2026-03-26 - Preventivo cross-page: disambiguazione terreno su clienti multi-terreno

### Problema
- Quando il cliente aveva più terreni, in alcuni messaggi cross-page il payload iniziale non includeva `terreno-id` e il fallback univoco non poteva attivarsi; il risultato era un inject parziale (cliente + lavorazione) senza terreno.

### Soluzione
- Rafforzata `enrichPreventivoCommandFormData` in `functions/index.js`:
  - se `terreno-id` manca e il cliente ha più terreni, calcola uno scoring testuale sui terreni del cliente (nome + coltura) usando match diretti e token/radici lessicali;
  - imposta automaticamente `terreno-id` **solo** se emerge un match univoco forte (top score dominante), evitando selezioni ambigue;
  - mantiene il fallback precedente per il caso univoco (cliente con un solo terreno).

### Risultato
- Maggiore probabilità di precompilare correttamente il terreno anche da pagine diverse da Nuovo Preventivo, con comportamento sicuro in caso di ambiguità.

## 2026-03-26 - Preventivo cross-page: fix arricchimento su APRI_PAGINA/OPEN_MODAL

### Problema
- Nei flussi cross-page il comando effettivo lato client era spesso `pending-after-nav INJECT_FORM_DATA` derivato da `APRI_PAGINA`/`OPEN_MODAL` con `fields`.
- L’arricchimento preventivo (`enrichPreventivoCommandFormData`) era applicato solo ai comandi `INJECT_FORM_DATA` diretti, non ai `fields` di navigazione/apertura modal; risultato: payload con 4 campi senza `terreno-id`.

### Soluzione
- Aggiornato `functions/index.js` nei rami structured (prima risposta + retry):
  - su `open_modal` con modal preventivo: `fields` passano da `enrichPreventivoCommandFormData(...)`;
  - su `apri_pagina` verso target preventivo: `fields` passano da `enrichPreventivoCommandFormData(...)` prima di essere salvati come pending intent.

### Risultato
- Il pending intent cross-page verso Nuovo Preventivo arriva già arricchito (incluso `terreno-id` quando deducibile), evitando l’iniezione parziale osservata nei log.

## 2026-03-26 - Preventivo: stop auto-selezione terreno in ambiguità (es. 2 Trebbiano)

### Problema
- In caso di cliente con più terreni omonimi/simili (es. due "Trebbiano"), il fallback aggressivo poteva auto-selezionare un `terreno-id` invece di chiedere disambiguazione.

### Soluzione
- Semplificata la policy in `enrichPreventivoCommandFormData` (`functions/index.js`):
  - rimossa auto-selezione su clienti con 2+ terreni;
  - mantenuta auto-selezione solo nel caso sicuro `pool.length === 1`;
  - lasciata la disambiguazione al flusso standard (hint/fallback e domanda utente successiva).

### Risultato
- Evitata la scelta silenziosa del terreno sbagliato in scenari ambigui; Tony deve chiedere quale terreno usare quando i candidati sono multipli.

## 2026-03-26 - Preventivo: guardrail anti-selezione implicita su coltura ambigua

### Problema
- Anche senza fallback aggressivo, in alcuni casi `terreno-id` arrivava già valorizzato dal modello e veniva mantenuto, causando selezione automatica quando il cliente aveva più terreni con stessa coltura (es. due Trebbiano/Vite da Vino).

### Soluzione
- Rafforzato `enrichPreventivoCommandFormData` (`functions/index.js`) con controllo di ambiguità:
  - se `terreno-id` è presente e il cliente ha più terreni;
  - se il messaggio non contiene il nome esplicito del terreno selezionato;
  - e se esistono più candidati con stessa coltura del terreno selezionato;
  - allora `terreno-id` viene rimosso per forzare la disambiguazione in chat.

### Risultato
- In scenari ambigui per coltura omonima, Tony non deve più scegliere in automatico un terreno “a caso”, ma chiedere quale terreno intende l’utente.

## 2026-03-26 - Preventivo cross-page: merge resiliente fields dopo guardrail terreno

### Problema
- In alcuni giri il guardrail rimuoveva `terreno-id` ambiguo dai `fields` preventivo in `OPEN_MODAL`/`APRI_PAGINA`, e il payload risultava troppo povero o vuoto, causando mancata iniezione post-navigazione.

### Soluzione
- Nei rami structured (`open_modal` e `apri_pagina`, inclusi retry) di `functions/index.js`:
  - i `fields` preventivo vengono costruiti con merge `inferPreventivoFallbackFormData(...) + enrichPreventivoCommandFormData(...)`;
  - i `fields` vengono allegati al comando solo se non vuoti, preservando cliente/tipo-lavoro anche quando `terreno-id` viene eliminato dal guardrail.

### Risultato
- Cross-page più robusto: niente auto-selezione terreno in ambiguità, ma iniezione comunque parziale dei campi sicuri (cliente/lavorazione) invece di “nessuna compilazione”.

## 2026-04-14 - Vendemmia: metadato posizione GPS opzionale

### Problema
- Nel flusso `modules/vigneto/views/vendemmia-standalone.html` mancava la possibilità di salvare e visualizzare una posizione approssimativa per la registrazione vendemmia, mentre lo stesso pattern era già disponibile in altri flussi agricoli.

### Soluzione
- Aggiunta UI in modal vendemmia con checkbox `vendemmia-includi-posizione`, pulsante `btn-vendemmia-posizione-gps` e stato acquisizione.
- Integrato `core/js/geo-capture.js` per acquisizione GPS e gestione errori geolocalizzazione.
- Esteso salvataggio form per includere `posizioneRilevamento` solo se richiesto.
- Aggiornato rendering tabella vendemmie con nuova colonna `Posizione` (coordinate, accuratezza ±m e badge sorgente GPS/MAPPA).
- Allineato modello `modules/vigneto/models/Vendemmia.js` con la proprietà `posizioneRilevamento`.
- Allineata propagazione dati automatica da attività in `modules/vigneto/services/vendemmia-service.js` (`createVendemmiaFromAttivita`).

### Risultato
- La vendemmia ora supporta tracciabilità GPS leggera opzionale end-to-end (acquisizione, persistenza, visualizzazione), coerente con gli altri flussi già aggiornati.
- Nota evolutiva concordata: il flusso "campioni" non esiste ancora; in seconda fase verrà valutata una mappa dedicata per punti campione (raccolta/profilazione maturazione) riusando il medesimo pattern GPS opzionale.

## 2026-04-14 - Mini-spec tecnica futura: GPS campioni

### Contesto
- Confermato con l'utente che il flusso "campioni" non è ancora presente in applicazione e non richiede implementazione runtime immediata.

### Decisione
- Definita mini-spec tecnica documentale per fase successiva: modello dati standard `posizioneRilevamento`, UI opzionale non bloccante, mappa multipunto campioni, rendering con accuratezza e integrazione futura in `currentTableData`/`FILTER_TABLE`.
- Aggiunta checklist "pronta sprint" (10 step) con ordine implementativo, output atteso e verifica per ogni step.

### Risultato
- Backlog GPS campioni ora esplicito e pronto all'esecuzione senza ambiguità su scope tecnico e criteri di implementazione.

## 2026-04-14 - Guida utente: passaggio a manuale operativo completo

### Problema
- La guida risultava ancora troppo sintetica in alcune sezioni: utile come riepilogo, ma non sufficiente per guidare un utente inesperto passo-passo su attività delicate.

### Soluzione
- Estesa la guida runtime in `core/guida-app` con struttura operativa uniforme:
  - procedure complete con percorso schermata, posizione pulsanti, passi numerati, controllo finale e errori frequenti;
  - flussi completi per ruoli (operaio, caposquadra, manager);
  - esempi pratici di utilizzo Tony (guida/operativo dove disponibile).
- Rafforzate sezioni chiave:
  - `README.md`, `core.md`, `intersezioni-moduli.md`;
  - moduli: amministrazione, terreni, lavori-attivita, vigneto, frutteto, magazzino, conto-terzi, parco-macchine, statistiche-report.
- Allineata la sorgente editoriale `docs-sviluppo/guida-app` con:
  - stessa impostazione operativa;
  - rimozione lessico tecnico non utente;
  - aggiunta moduli mancanti (`amministrazione.md`, `parco-macchine.md`, `statistiche-report.md`).

### Risultato
- La guida ora e` impostata come manuale operativo completo (non rapido), con focus su "dove cliccare, cosa succede dopo e come verificare il risultato" in ogni area principale dell'app.

## 2026-04-14 - Trigger deploy documentazione guida

### Contesto
- Eseguito aggiornamento minimo di tracciamento per innescare un nuovo deploy della guida dopo il completamento della riscrittura operativa.

### Risultato
- Nuovo commit documentale pronto per pubblicazione e verifica online.
- Trigger manuale deploy confermato alle 18:22 (ora locale) con aggiornamento tracciato in changelog.

## 2026-04-15 - Workspace mobile dedicato operaio/caposquadra (fase iniziale)

### Contesto
- Richiesta UX mobile-first per ruoli campo (`operaio`, `caposquadra`) mantenendo invariata l'interfaccia manager/admin.

### Soluzione
- Introdotto routing condizionale in dashboard con preferenza utente (`auto` / `classic` / `mobile`) e decisione centralizzata ruolo+device.
- Rifatta la shell mobile in modalità wizard a **swipe orizzontale** (destra→sinistra) con navigazione `C`:
  - swipe touch
  - indicatori a pallini
  - bottoni fissi `Indietro/Avanti`
- Impostata la prima schermata su **selezione lavoro** con proposta rapida e selezione esplicita utente.
- Sequenza base:
  - `Seleziona lavoro`
  - `Segna Ore` (iframe su `core/segnatura-ore-standalone.html`)
  - `Traccia Zone` (iframe su `core/admin/lavori-caposquadra-standalone.html`)
  - `Statistiche rapide` (iframe su `core/statistiche-standalone.html`)
- Per `caposquadra` aggiunte slide extra:
  - `Squadra` (iframe su `core/admin/gestione-squadre-standalone.html`)
  - `Comunicazioni` con form rapido di invio su collection `comunicazioni` tenant.
- Inseriti toggle espliciti:
  - passaggio a versione classica
  - ritorno a comportamento automatico mobile
  - card di accesso "Workspace Mobile" nelle aree dashboard di operaio/caposquadra.

### Risultato
- Primo rilascio operativo del workspace mobile campo con ingresso automatico su smartphone per ruoli target e fallback sicuro alla dashboard classica.

