# Piano ottimizzazione performance Tony

**Data**: 2026-06-04 (rev. 15)  
**Stato**: Fase 0–2b ✅ · **Fase 3** (SSE + pattern attività + Treasure Map) ✅ · **Fase 3b** crea lavoro entity-first ✅ **canary E2E chiuso** (2026-05-25) · **3b estensioni intervista client-side** ✅ (2026-05-30) · **3b.8** ✅ (2026-05-31) · **3b.8 ack tipo stem-only** ✅ E2E (2026-06-03) · **3b.9 magazzino** ✅ (3b-C15…**C19**, 2026-06-02) · **3b.10 segna ore workspace** ✅ (**3b-C21**, 2026-06-04) · **Fase 4** ✅ **chiusa in produzione** (4.1–4.3 deploy 2026-06-03; **4.4** deferred)  
**Obiettivo tecnico**: Ridurre latenza percepita e costo API **senza** ridurre la capacità di Tony di conoscere e usare i dati aziendali.

**Obiettivo prodotto (north star)**: Tony deve essere il **braccio destro dell’agricoltore** — consultare **tutti** i dati rilevanti dell’azienda (da qualsiasi pagina), usarli per **risposte, consigli, avvisi e azioni** (compilazione form, navigazione, proattività). Questo piano **non** restringe quella visione: la rende **sostenibile** (veloce e affidabile). Un Tony lento o inconsistente non diventa mai il braccio destro di nessuno.

**Riferimenti**: `tony/MASTER_PLAN.md` (visione §1, Fase 3 Context Builder, Fase 6 proattività), `tony/STATO_ATTUALE.md`, `CONTEXT_BUILDER_SPECIFICHE_SVILUPPO.md`, `functions/index.js` (`tonyAsk`, `buildContextAzienda`), `functions/meteo-service.js` (pattern quick reply + cache).

**Fuori scope di questo piano** (track separati):
- Consultazione **storica multi-anno** e confronti temporali strutturati (aggregati per anno, trend, “rispetto allo scorso anno”): iniziativa **trasversale app** — vedi §9; necessaria per consigli basati sul passato, ma non implementata qui.
- Rewrite stack (React/Flutter), offline IndexedDB completo, satellite/IoT.

---

## 0. Perché performance e “braccio destro” vanno insieme

| Esigenza agricoltore | Cosa serve a Tony | Cosa abilita questo piano |
|----------------------|-------------------|---------------------------|
| “Quanto costa / cosa ho in scorta / quali scadenze?” | Dati azienda sempre raggiungibili, risposta **affidabile e rapida** | Quick reply + cache (binario A) |
| “Posso trattare giovedì? L’erpice regge?” | Meteo + praticabilità + **stato mezzi/guasti** nello stesso filo | Router conservativo + tier multi-dominio |
| “Crea lavoro / segna ore / preventivo” | Cross-page + form injection | Binario C invariato, context mirato |
| “Cosa devo fare oggi? / Ho notato X” | RIASSUNTO, briefing, proattività cross-modulo | Tier T1 + summary; Fase 6 Master Plan |
| Consigli che incrociano moduli | Context Builder + Gemini quando serve ragionamento | Meno token sprecati → più budget per binario C |

**Principio cardine**: *velocità su ciò che è deterministico; intelligenza piena su ciò che è complesso* — non l’opposto.

---

## 1. Problema

### 1.1 Perché il meteo sembra più veloce

Il flusso meteo operativo (2026-05) è più rapido perché:

1. Dati meteo in **cache Firestore** (`meteoCache`, TTL ~15 min).
2. Quick reply **prima di Gemini** (`tryMeteoOperativoQuickReply`, ecc.).
3. Risposta spesso solo testo, senza JSON comandi.

È il **modello da replicare** per altre consultazioni: dati in cache/slice + regole + bypass LLM quando la risposta è nota.

### 1.2 Perché il resto è più lento (e perché frena la visione “braccio destro”)

1. **`buildContextAzienda`** — ~13 fetch Firestore **a ogni turno** (manager/admin), anche per “ciao”.
2. **Context JSON enorme** nel prompt Gemini (“prompt fat”).
3. **System instruction pesante** (regole non sempre pertinenti al turno).
4. **Gemini end-to-end** — nessuno streaming reale dalla CF (`askStream` → fallback `ask()`).
5. **Treasure Map retry** — possibile seconda chiamata Gemini.
6. **TTS serializzato** dopo il testo.

L’agricoltore che chiede cinque cose al giorno in campo **abbandona** un assistente da 3–4 secondi. Le ottimizzazioni servono a far usare Tony **come strumento quotidiano**, non solo demo.

Cross-page e inject form **non sono la causa** della lentezza end-to-end su **crea lavoro** quando il messaggio iniziale è già completo: il collo di bottiglia osservato (2026-05-25) è **multi-turno Gemini + inject parziali + timer proattivo** — vedi §1.3 e **Fase 3b**.

### 1.3 Comportamento reale — crea lavoro (campo, 2026-05-25)

**Contesto:** manager, tenant con manodopera attiva, da Dashboard o dopo nav a Gestione Lavori, messaggio unico ricco di entità.

**Messaggio utente (esempio reale):**

> crea un lavoro per luca… erpicatura trebbiano con agrifull e erpice rotante… inizio mercoledì e durata 1 giorno

**Esito prodotto:** ✅ lavoro compilato e *«Vuoi che salvi?»* — flusso cross-page + `lavoro-form` funziona.

**Esperienza utente:** ❌ troppo lenta; ❌ domande su dati **già nel messaggio** (trattore, assegnatario).

**Dialogo osservato:**

1. Tony: «Ti porto a gestione lavori» → chiede quale **trattore** (elenca Agrifull, Nuovo T5, cingolino) — utente aveva già detto **agrifull**.
2. Utente: «agrifull» → Tony: «A chi lo assegno?» — utente aveva già detto **luca**.
3. Utente: «a luca» → «Lavoro pronto. Vuoi che salvi?»

**Console browser (sequenza tipica):**

| Fase | Evidenza | Implicazione |
|------|----------|--------------|
| Nav + 1° inject | `INJECT_FORM_DATA` con **8 campi** (nome, terreno, tipo, date — **senza** operaio/macchine/assegnazione) | Primo colpo incompleto |
| Timer proattivo | `missing_fields hasRequiredEmpty=true needsMacchine=true` | Innesca follow-up mentre l’utente risponde in chat |
| CF #1 | `tonyAskStream completata in ~33133 ms` | Turno Gemini pesante (~33 s) |
| CF #2 | `~3794 ms` + secondo inject **12 campi** (trattore/attrezzo, caposquadra vuoto) | Macchine ok, assegnazione ancora mancante |
| CF #3 | `~34089 ms` + inject **14 campi** (autonomo, luca, macchine, stato assegnato) | Terzo round per completare |
| Inject ripetuti | Ogni turno re-inietta nome/terreno/categoria + pause dropdown (`700+500+750+400+450+150 ms`) | ~3 s locali × 3 inject ≈ 9 s solo attese |
| Context tabella | `Contesto tabella inviato alla CF: lavori 68 righe` (più volte) | Prompt gonfiato su follow-up form |

**Metriche CF (canary precedente, stesso binario C):** `streamUsed=true`, `timeToFirstChunkMs` ~5 s su turno singolo — la Fase 3 ha risolto **SSE/fallback**; **non** il multi-turno conversazionale.

**Diagnosi (allineata al principio piano §2):**

- Oggi il binario C su crea lavoro segue ancora troppo il modello *«compilo un po’ e intervisto»* (Master Plan UX) anche quando il messaggio è **entity-dense**.
- Serve **entity-first**: estrarre operaio, terreno, tipo lavoro, trattore, attrezzo, data, durata **al primo turno**; chiedere **solo** se ambiguo (2 Luca, 0 match trattore, terreno multiplo).
- Non confondere con quick reply binario A (§5.5): resta Gemini + `INJECT_FORM_DATA`, ma con **first-shot completo** e **meno round-trip**.

**Riferimento decisioni:** `TONY_DECISIONI_E_REQUISITI.md` §19.6.10.

### 1.4 Comportamento target — crea lavoro post Fase 3b (2026-05-25)

**Messaggio canary (entity-dense, senza trattore nel testo):**

> crea lavoro per luca inizio mercoledì durata 1 giorno erpicatura larghetta

**Esito prodotto:** ✅ form compilato (13 campi incluso durata); **1 sola domanda** (trattore: Agrifull vs Nuovo T5 — attrezzo inferito da tipo); risposta breve **`t5`** o **`agrifull`** → inject client-side → «Vuoi che salvi?» → conferma locale **senza** round-trip CF sulla risposta macchine.

**Metriche osservate (tenant Sabbie Gialle, Gestione Lavori):**

| Fase | Evidenza | vs baseline §1.3 |
|------|----------|-------------------|
| 1° turno CF | `tonyAskStream` ~**0,9–1,8 s** (entity-first + OPEN_MODAL + inject) | da ~33 s |
| Inject client | ~**6–7 s** (`lavori-form-data-ready` + `loadLavori` differito, delay ridotti) | da ~10–15 s percepiti |
| Disamb. trattore | Evento `tony-macchine-disambiguation`; **no** auto-invento trattore se 2+ compatibili | prima chiedeva anche trattore già detto |
| Risposta macchine | `[Tony] Intercept macchine reply client-side: t5` — **0 ms CF** | prima ~5 s CF + domanda ripetuta |
| Salvataggio | `__tonyPromptLavoroSaveLocal` + `SAVE_ACTIVITY` locale su «sì/salva» | prima blocco input / CF lenta con 68 lavori in contesto |
| Sottocategoria | **Tra le File** forzata da coltura terreno Larghetta — **nessuna** domanda Tony su tipo/sottocategoria | vedi §3b.2 |

**Decisione prodotto (estensioni performance):** replicare il pattern **intercept + inject + conferma locale** su **attrezzo** multiplo ✅, **intervista campi mancanti** ✅, **conferma salvataggio** ✅, **disamb. tipo lavoro** ✅ (2 livelli manuale/meccanica, solo stem ambivalenti); **operaio ambiguo autonomo** ✅ (2026-05-31); **terreno ambiguo** ✅ (2026-05-31); **save preventivo** ✅ (3b-C14, 2026-05-31); **save magazzino** ✅ (3b-C15, 2026-05-31); **creazione movimento entrata + prezzo catalogo + save movimento** ✅ (3b-C16, 2026-06-02); **creazione movimento uscita E2E** ✅ (3b-C17, 2026-06-02); **creazione prodotto + dosaggio/carenza obbligatori** ✅ (3b-C18, 2026-06-02); **cross-page magazzino prodotto + movimento** ✅ (3b-C19, 2026-06-02) — **non** su sottocategoria lavoro (deterministico da coltura). Vedi `TONY_DECISIONI_E_REQUISITI.md` §14.4–§14.7.

**Test automatici:** `tests/tony-lavoro-entity-parser.test.js`, `tests/tony-lavoro-trattore-disamb.test.js`, `tests/tony-lavoro-attrezzo-disamb.test.js`, **`tests/tony-lavoro-interview-client.test.js` (28)**.

### 1.5 Comportamento post estensioni intervista (2026-05-30)

**Contesto:** flusso **creation interview** su Gestione Lavori — campi mancanti dopo il primo turno CF, disamb. macchine/tipo, conferma salvataggio. Obiettivo performance: **zero round-trip CF** su ogni risposta breve utente fino al save.

**Problemi osservati (pre-fix):**

| Sintomo | Causa | Impatto performance/UX |
|---------|-------|------------------------|
| `t5` / `agrifull` → «Non ho capito» | Pipeline intervista e macchine parallele; typo handler macchine | Utente ripete o va in CF |
| «salva» dopo «Vuoi che salvi?» → «Non ho capito» | Intercept save **dopo** creation flow | Blocco salvataggio locale |
| «crea lavoro per gaia» → chiede comunque «A chi?» | `openCreaModal` non atteso; operai non pronti; prefix intent non strippato | Turni intervista ridondanti |
| «potatura» → messaggio generico | Nessuna disamb. tipo stile macchine | Utente non sa cosa rispondere |
| «pier» in squadra → null | Match su operai **e** caposquadra | Turno perso + possibile CF |

**Fix e guadagno (tutti client-side, 0 ms CF per turno):**

| Area | Implementazione | Esito canary |
|------|-----------------|--------------|
| Turn unificato | `applyLavoroCreationTurn` — un handler intervista + macchine + schedule | ✅ erpicatura autonomo + potatura squadra |
| Ordine intercept | Save confirm **prima** di creation flow; macchine **prima** di intervista quando fase attiva | ✅ «salva» → `SAVE_ACTIVITY` locale |
| Hint messaggio iniziale | `stripLavoroCreationIntentPrefix`, `waitForLavoriManodoperaReady`, await `openCreaModal()` | ✅ «crea lavoro per gaia» salta domanda persona |
| Squadra | Caposquadra solo su `caposquadraList`; disamb. omonimi (Pier Best/Top) | ✅ lavoro squadra salvato |
| Tipo lavoro | Disamb. flat + **2 livelli** manuale/meccanica (`LAVORAZIONI_DEFAULTS_TONY.manualMechChoiceStems` / `manualMechSkipStems`) | ✅ potatura → manuale → produzione |
| Prompt salva | `lavoroInterviewReadyForSave`, `syncLavoroOperatoreMacchinaIfNeeded`, `__tonyPromptLavoroSaveLocal` | ✅ conferma locale end-to-end |

**Messaggi canary verificati (2026-05-30):**

1. Autonomo erpicatura: Gabriele + erpicatura → macchine → «salva» → `nuovoLavoroId`
2. Squadra potatura: Pier (disamb.) → potatura → manuale → variante → save
3. Hint persona: «crea lavoro per gaia» → terreno diretto (no «A chi?»)

**Metriche attese vs §1.3 baseline:** intervista completa (5–8 risposte brevi) **senza CF aggiuntive**; solo il **1° turno** resta binario C (~1–2 s SSE). Risparmio cumulativo vs multi-turno Gemini: **~15–60 s** per lavoro creato per intervista.

### 1.6 Fix intervista §3b.8 (2026-05-31)

**Contesto:** canary browser post-rev.6 — regressioni su disamb. persona, potatura meccanica senza macchine, vendemmia squadra; **rev.9** — regressione «a Luca» saltava operaio (hint tipo pending + disamb. solo su patch vuota).

| Fix | Implementazione | Esito canary |
|-----|-----------------|--------------|
| Operaio ambiguo autonomo | `__tonyLavoroPersonDisambCandidates`, `__tonyLavoroConfirmedAssignMode`, `getConfirmedLavoroInterviewAssignMode()` (ignora default DOM `tipo-squadra` finché non confermato) | ✅ «Luca» → elenco → fabbri → 0 CF |
| **Priorità disamb. persona vs tipo pending** | `lavoroInterviewCanApplyPendingTipoHint`, `lavoroInterviewPersonDisambPending`, ritorno disamb. anche se patch non vuota; `getLavoroInterviewRequiredEmpty` forza `lavoro-operaio` se autonomo; inject radio autonomo → delay → select operaio | ✅ **3b-C13** cross-page sangiovese×2 → «a Luca» → fabbri → autonomo DOM → trinciatura → save |
| Potatura stem + coltura | Policy filari su stem-only (`findTipoLavoroInInterviewText`); M/M **prima** di `amb.auto` erpicatura | ✅ pinot + erpicatura → Tra le File auto |
| Gate macchine post M/M | `inferRequiresMachineFromTipo` ← `classifyTipoLavoroModo` + `__tonyLavoroTipoModo`; tipo manuale azzera trattore/attrezzo in patch | ✅ potatura meccanica → trattore+attrezzo; manuale → skip macchine |
| Policy M/M prodotto | Domanda solo se stem in `manualMechChoiceStems` **e** catalogo ha **entrambe** le modalità (`hasMan && hasMech`); `manualMechSkipStems` (erpicatura, trinciatura, …) salta livello 1 | ✅ vendemmia vite → M/M; erpicatura → no M/M |
| Cross-page crea lavoro | `tony_pending_lavoro_local_intent`, `sanitizeAmbiguousLavoroInterviewFields`, `resolveUserByName` null se multi-match | ✅ da altra pagina «crea lavoro per luca» → disamb locale, no auto-pick |

**Messaggi canary verificati (2026-05-31):**

4. Autonomo potatura meccanica: Luca (disamb.) → pinot → potatura → meccanica → variante → macchine (`agrifull`) → save
5. Squadra vendemmia: Pier Best → sangiovese → vendemmia → manuale → **Vendemmia Manuale** (no macchine) → save + vendemmia auto
6. **E2E cross-page (3b-C13):** sangiovese×2 → pannelli → «a Luca» → fabbri → trinciatura → domani/1 → agrifull → save (0 CF follow-up)

~~**Residuo UX (non performance):** ack esplicito tipo in chat dopo stem vago («dobbiamo trinciare») — inject OK, messaggio salta a data.~~ → **chiuso §1.8** (2026-06-03).

### 1.7 Magazzino client-side — save locale + creazione movimento (2026-05-31 → 2026-06-02)

**Contesto:** estendere il pattern §3b.8 (intercept + inject + conferma locale, **0 CF** su follow-up) al modulo **Magazzino** (`prodotto-form`, `movimento-form`). Canary browser **3b-C15…C19** — **tutti PASS E2E** (2026-06-02).

**Problemi osservati (pre-fix):**

| Sintomo | Causa | Impatto performance/UX |
|---------|-------|------------------------|
| «salva» dopo form prodotto → «Prodotto salvato!» senza record | CF fake save; intercept save assente su magazzino | Utente crede di aver salvato; retry o CF |
| «crea entrata nimrod 10 unità» → intervista CF → «Movimento registrato!» | CF conduce dialogo testuale senza OPEN_MODAL/INJECT | 2–4 round CF inutili; nessun movimento in lista |
| Form movimento completo ma no prompt save | Campi opzionali (confezione, prezzo) in `interviewEmpty` | Timer proattivo bloccato; CF chiede opzionali |
| Entrata senza prezzo | Anagrafica ha `prezzoUnitario` ma inject non lo propaga | Turno utente o CF aggiuntivo |

**Fix e guadagno (client-side, 0 ms CF per turno salva/creazione):**

| Area | Implementazione | Esito canary |
|------|-----------------|--------------|
| Save locale prodotto/movimento | `TONY_FORM_SAVE_LOCAL_CONFIG` + `tryInterceptMagazzinoSaveBeforeCf`; timer post-inject **800 ms** | ✅ **3b-C15** |
| Anti fake save CF | `isTonyMagazzinoCfFakeSaveText`; regola CF **0** creazione movimento | ✅ no «Prodotto/Movimento salvato!» spurio |
| Creazione movimento locale | `tony-movimento-create-local.js` — parse + OPEN_MODAL + inject + **cross-page** | ✅ **3b-C16/C17/C19** |
| Creazione prodotto locale | `tony-prodotto-create-local.js` — parse + OPEN_MODAL + inject + **cross-page** | ✅ **3b-C18/C19** |
| Readiness movimento | `magazzinoProactiveReadyForSave` — solo required HTML per prompt save | ✅ prompt canonico senza intervista opzionali |
| Prezzo entrata da catalogo | `movimento-prezzo-catalogo.js` + enrich inject + `applyMovPrezzoCatalogoToDom` | ✅ Nimrod 45 € post-inject |

**Messaggi canary verificati:**

7. **3b-C15 (2026-05-31):** prodotti-standalone → inject Roundup fitofarmaci → «Vuoi che salvi il prodotto?» → «salva» → `Salva prodotto-form: conferma utente locale` + `SAVE_ACTIVITY`; **0** `tonyAskStream` sulla conferma.
8. **3b-C16 (2026-06-02):** movimenti-standalone → «crea entrata nimrod 10 unità» → creazione locale (no CF intervista) → modal + prezzo 45 € → «Vuoi che salvi il movimento?» → «salva» → `Salva movimento-form: conferma utente locale` + `SAVE_ACTIVITY`; movimento in lista.
9. **3b-C17 (2026-06-02):** movimento uscita E2E — v. sopra.
10. **3b-C18 (2026-06-02):** prodotti → «crea prodotto roundup fitofarmaci litri scorta 50 prezzo 45 dosaggio 0.5-1 carenza 30» → creazione locale **0 CF** → modal + inject 8 campi → save locale — **PASS E2E browser**.
11. **3b-C19 (2026-06-02):** cross-page — abbonamento → prodotto (8 campi); **conto terzi** → «crea entrata nimrod 10 unità» → movimenti + inject 4 campi — **PASS E2E browser**.

**Metriche attese vs baseline CF multi-turno movimento:** creazione + save **1× CF max** (solo se entity-first cloud necessario) o **0 CF** se parse locale completo; conferma save sempre **0 CF**. Risparmio vs intervista CF movimento: **~10–30 s** per movimento creato via chat.

### 1.8 Ack tipo stem-only in intervista lavoro (2026-06-03)

**Contesto:** residuo UX §1.6 — con terreno già nel form, stem vago (`dobbiamo trinciare`, `erpicare`) auto-pickava il tipo (`manualMechSkipStems`) ma Tony passava subito alla domanda successiva (data/persona) **senza** confermare in chat quale tipo era stato scelto.

| Fix | Implementazione | Esito |
|-----|-----------------|-------|
| Ack proattivo locale | `buildLavoroTipoStemOnlyAckMessage`, `shouldAckLavoroTipoStemOnlyAutoPick`, `prependLavoroTipoStemOnlyAck` in `tony-form-injector.js` | ✅ messaggio «Ok, [Tipo] su [Terreno]. [prossima domanda]» |
| Scope | Solo auto-pick stem-only; **esclusi** disamb. esplicita, risposta M/M, correzione tipo | ✅ potatura → ancora domanda M/M, no ack spurio |
| Performance | Concatena ack + `buildNextLavoroInterviewMessage` in `applyLavoroInterviewFromUserReply` | ✅ **0 CF** (stesso intercept client-side §3b.8) |

**Messaggio canary verificato (2026-06-03):**

12. **3b-C20 (E2E browser):** `gestione-lavori-standalone.html` — terreno **Larghetta** già impostato → «dobbiamo trinciare» → **«Ok, Trinciatura tra le file su larghetta. È un lavoro di squadra o lo assegno a una persona?»** → disamb. Luca (fabbri) → domani / 1 → disamb. trattore (agrifull) → «Vuoi che salvi il lavoro?» → **salva** → record in lista; console solo `Intercept intervista lavoro client-side`, **0** `tonyAskStream` sui follow-up.

**Test:** `tony-lavoro-interview-client.test.js` — **37 pass** (caso «dobbiamo trinciare»).

### 1.9 Segna ore workspace campo — intervista + save locale (2026-06-04)

**Contesto:** profilo **operaio/caposquadra** su `field-workspace-standalone.html`, form inline `#quick-hours-form` (`field-workspace-ore-form`). Obiettivo performance: stesso pattern §3b.7–§3b.9 — **0 CF** su ogni turno dopo l’avvio intervista; submit reale Firestore senza fake save CF.

**Problemi osservati (pre-fix):**

| Sintomo | Causa | Impatto performance/UX |
|---------|-------|------------------------|
| «segniamo le ore» → CF lenta / fake save | Nessun intercept intent; CF emette `INJECT`/`SUBMIT` ignorati | Round-trip inutili; utente crede di aver salvato |
| Turni «alle 7» / «18 30» ancora in CF | Mancava intercept singolo orario + sync `chatHistory` | Latenza + orari invertiti |
| «ok» dopo pausa 0 → loop «indica pausa» | Doppio gate: `quickHoursDomReadyForTonySave` OK ma `tonySalvaQuickHoursWorkspace` guardava solo ultimo messaggio | Save bloccato nonostante log «conferma locale» |
| Ore nette `10.75` | Display decimale grezzo | UX campo |

**Fix e guadagno (client-side, 0 ms CF per turno intervista/save):**

| Area | Implementazione | Esito canary |
|------|-----------------|--------------|
| Intent + blocco CF | `tryInterceptSegnaOreIntentBeforeCf`, `tonyMessageIsFieldWorkspaceSegnaOreTurn`, flag `__tonySegnaOraLocalInterviewAt` | ✅ avvio intervista 0 CF |
| Orari elastici | `engine.js` — `18:30`, `18,30`, `18 30`, ora nuda `7`/`18` | ✅ inject locale singolo campo |
| Pausa | `tryInterceptSegnaOrePauseBeforeCf`, `__tonyQuickHoursPauseAckAt`, «nessuna»/«0» | ✅ pausa inject + domanda save |
| Save | `tryInterceptQuickHoursSaveBeforeCf` + `tonySalvaQuickHoursWorkspace` + `tonyQuickHoursUserAcknowledgedPause` (tutti i turni + flag) | ✅ `[Tony] SALVA: submit su quick-hours-form` |
| CF alias | `tony-field-workspace-command.js` — INJECT/SUBMIT → INJECT_FORM_DATA/QUICK_SAVE | ✅ nessun comando sconosciuto |
| Display | `field-workspace-controller.js` — `formatOreNette` | ✅ «11h», «12h 30min» |

**Messaggio canary verificato (2026-06-04):**

13. **3b-C21 (E2E browser):** workspace mobile operaio — «segniamo le ore» → `7` / `18` (o formati elastici) → pausa `0` o «nessuna» → **«ok»** → console `Salva rapido workspace` + `SALVA: submit su quick-hours-form`; record in **Validazione ore** manager (lavoro autonomo); intervista intera **0 CF**.

**Metriche attese vs baseline CF multi-turno segna ore:** intervista completa (4–6 risposte brevi) **senza CF**; solo eventuale 1× CF se messaggio fuori pattern locale. Risparmio vs intervista CF ore: **~10–40 s** per turno segnato via chat.

**Test:** `tests/tony-form-save-local.test.js` (**28**), `tests/tony-segna-ora-time-range.test.js` (**14**).

---

## 2. Principi guida

| Principio | Significato |
|-----------|-------------|
| **Onniscenza operativa, non prompt infinito** | Tony deve poter **accedere** a tutti i dati; non deve **caricarli tutti** in ogni messaggio. |
| **Configurazione > codice** | Router e quick reply come mappe/ config (`QUICK_REPLY_MAP`), non `if` sparsi in `index.js`. |
| **Deterministico prima, Gemini dopo** | Numeri, tariffe, scorte, scadenze → dati + regole. Consigli complessi → Gemini con slice giusto. |
| **Context on demand (tier)** | Fetch mirato per intent; in dubbio **tier più alto**, mai tier troppo basso. |
| **Slim prompt, dati pieni lato server** | Quick reply leggono dati completi dalla cache; Gemini riceve summary + slice rilevante. |
| **Separare lettura vs scrittura** | Consultazione/avvisi → A/B. Form / crea record → C. |
| **Cache server (Firestore), non browser** | Coerenza tra istanze CF; vedi §4.3. |
| **Router conservativo** | Messaggi multi-dominio o ambigui → tier union o fallback Gemini con context ampio. |
| **Profilo campo** | Invariato; operaio/caposquadra con scope dedicato. |

---

## 3. Cosa NON fare

- Sacrificare accesso ai dati (tier troppo basso, quick reply troppo aggressive).
- Quick reply su crea lavoro / preventivo / disambiguazione form.
- Context slim che toglie trattori/tipi lavoro/terreni su intent **operativo** (T3).
- Cache solo in memoria istanza CF **senza** persistenza condivisa (vedi §4.3).
- Cache lunga (>5 min) su dati operativi volatili senza invalidazione.
- Rewrite React/Flutter per performance.
- IndexedDB come leva principale Tony online da Dashboard.
- Sacrificare SAVE_ACTIVITY con conferma.

---

## 4. Architettura target

### 4.1 Pipeline `tonyAsk` (ordine esecuzione)

```
1. Auth, piano, modulo tony, profilo campo (invariato)
2. Intent router (regex + keyword, no LLM) → binario A/B/C + tierCalculated + tierUsed
3. resolveEffectiveTierMax (boost quick reply; binario C min T3; ambiguous/low confidence → T4)
4. buildContext: cache Firestore hit (T4 payload → slice tier) o buildContextAziendaTier(fetch cumulativi)
5. Gate moduli tenant (tony-module-gate) su quick reply e APRI_PAGINA
6. Quick reply deterministiche QUICK_REPLY_MAP (se match + dati + modulo attivo) → return
7. Meteo quick reply (condizionale):
   - tryMeteoPreventivoDateQuickReply se preventivo-form + tipo-lavoro + messaggio solo data (2026-05-24)
   - altrimenti tryMeteoOperativo / Giorno / Condizioni se isTonyMeteoQuestion (non creation intent)
8. PREVENTIVO_LIST_ACTION deterministico (prima di Gemini)
9. Gemini + Treasure Map solo se necessario (binario B/C)
10. Post-process (guardrail preventivo, validazione comandi, enrich formData, ecc.)
```

**Ordine importante**: router **prima** del fetch (per tier), quick reply/meteo **dopo** fetch/cache (servono dati), **prima** di Gemini.

**Fetch tier-aware** (`buildContextAziendaTier`): T1 = 4 query · T2 = +8 (12 totali) · T4 = +1 movimenti (13 totali). T3 non aggiunge fetch: riusa T1+T2 e slice include terreni/macchine/trattori.

### 4.2 Tre binari di risposta

| Binario | Esempi | Motore | Ruolo “braccio destro” |
|---------|--------|--------|------------------------|
| **A — Istantaneo** | Meteo; tariffe; scorte; scadenze; conteggi | Quick reply CF | Fatti certi, subito |
| **B — Istruzionale** | APRI_PAGINA; FILTER_TABLE ovvio; RIASSUNTO | Comando / Gemini minimo | Porta dove serve + evidenza dashboard |
| **C — Ragionamento** | Crea lavoro; consiglio multi-modulo; form complessi | Gemini + comandi | Consulenza e azioni |

Consigli del tipo *“considerando meteo, scorte e scadenze…”* possono essere **A+A+testo** (quick reply concatenate) o **C** se il ragionamento è aperto — il router deve riconoscere messaggi **multi-dominio** (§4.5).

### 4.3 Cache Context Builder (server)

**Problema istanze CF stateless**: variabile globale in memoria → cache hit solo se stesso container; cold start / scale-out = miss ripetuti.

**Scelta consigliata (v1)**:

| Layer | Ruolo |
|-------|--------|
| **Firestore** `tenants/{tenantId}/tonyContextCache/latest` | Fonte condivisa tra istanze; payload JSON + `expiresAt` |
| **Memoria istanza** (opzionale) | LRU locale sopra Firestore per hot path; invalidazione se `expiresAt` passato |

**TTL**: 90–180 secondi (configurabile per tenant).

**Cosa cacheare**: output `buildContextAzienda` completo **oppure** slice per tier pre-calcolate (fase 2).

**Costo**: 1 read Firestore per turno (cache hit) vs 13+ query — netto molto positivo.

**Invalidazione (fase 2+)**: opzionale su write critiche (prodotto, preventivo, guasto chiuso).

**Non** usare localStorage/IndexedDB browser per context aziendale Tony online.

### 4.4 Context tier / slice

| Tier | Quando | Dati (indicativo) |
|------|--------|-------------------|
| **T0** | Profilo campo | page, form, lavori assegnati |
| **T1** | RIASSUNTO, avvisi, domande generiche | summaryScadenze, summarySottoScorta, guastiAperti (summary), conteggi |
| **T2** | Business / costi | + tariffe, clienti, preventivi, tipiLavoro, categorie, colture |
| **T3** | Form operativo | + trattori, attrezzi, terreni, terreniClienti |
| **T4** | Magazzino dettaglio | + prodotti, movimentiRecenti, prodottiSottoScorta |
| **Meteo** | Pianificazione / domanda meteo | buildContextMeteo (condizionale) |

Il router calcola **`tierMax = max(tier rilevati)`** se il messaggio tocca più ambiti (§4.5).

**Gemini**: riceve tier appropriato; array lunghi sostituiti da **summary** dove il tier lo consente, ma **mai** omissione di dati necessari al binario C.

### 4.5 Router conservativo e messaggi multi-dominio

**Rischio**: falsi negativi — frase che mescola domini e il tier è troppo basso.

*Esempio*: «Devo fare un trattamento urgente domani, l’erpice è a posto?»  
→ tocca **meteo/trattamento** (T3/meteo), **macchine/guasti** (T1/T3), possibilmente **magazzino** (T4).

**Regole router**:

1. **Più keyword su tier diversi** → `tierMax = max(Ti)` (es. T4 se c’è magazzino + T3 form).
2. **Ambiguità** (confidence bassa) → tier **T4 pieno** (`resolveEffectiveTierMax` — 2026-05-24).
3. **Quick reply parziale ammessa** solo se risposta **esplicitamente** copre tutte le sotto-domande richieste; altrimenti **fallback Gemini** con tierMax.
4. **Mai** binario A su intent che richiede anche binario C nello stesso turno, salvo risposta strutturata multi-blocco documentata.

### 4.6 Shadow mode router (Fase 2a) ✅ completata → tier enforcement attivo (Fase 2b)

**Fase 2a (2026-05-23):** router classificava ogni messaggio manager; log `[Tony Perf]` con `routerBinario`, `routerTierCalculated`, `routerTierUsed: T4_full` (context pieno, nessun taglio).

**Fase 2b (2026-05-24):** `tierUsed` = tier effettivo fetch (`resolveEffectiveTierMax` in `tony-context-tier.js`). Cache: build T4 → slice al tier richiesto su hit.

| Campo log `[Tony Perf]` | Significato post-2b |
|-------------------------|---------------------|
| `routerTierCalculated` | Tier stimato dal router (domini/keyword) |
| `routerTierUsed` | Tier effettivo fetch + prompt slice |
| `cacheHit` | Hit su `tenants/{id}/tonyContextCache/latest` |
| `quickReplyHit` | id mappa o `meteo` / `meteo_preventivo_data` / `preventivo_list_action` |
| `buildContextAziendaMs` | Tempo fetch+assemble (0 se cache hit senza rebuild) |

**Validazione produzione (2026-05-24):** `npm run tony:perf-review --days=7 --limit=150` — **62/80** log con router hanno `routerTierUsed` ≠ `T4_full` (T2×2, T3×5, T4×55; residuo 18× `T4_full` revisioni vecchie). Baseline pre-2b: 100% `T4_full`. Campione binario A piccolo (5 log) — generare più traffico consultazione per confermare T1/T2 su tariffe/scorte/RIASSUNTO.

**Canary manuale locale (2026-05-25):** 8/8 su `localhost:8000` (Sabbie Gialle) — binario A/B/C incluso preventivo multi-turno E2E (terreno → meteo data → conferma martedì). GitHub Pages non valido (Tony base disattivato).

**Review CLI:** `scripts/tony-perf-log-review.mjs` — 8 scenari smoke router locale + aggregazione log gcloud.

---

## 5. Quick reply deterministiche

### 5.1 Pattern meteo (già validato + estensione preventivo 2026-05-24)

`functions/meteo-service.js` + `functions/tony-meteo-rules.js` — invocati **prima** di Gemini.

| Hook | Quando | Binario effettivo | Note performance |
|------|--------|-------------------|------------------|
| `tryMeteoOperativoQuickReply` | Domanda operativa con giorno/data («posso trinciare domani?») | **A** | Bypass Gemini; ~1–3 s |
| `tryMeteoGiornoQuickReply` / `Condizioni` | Consultazione previsioni | **A** | Idem |
| **`tryMeteoPreventivoDateQuickReply`** | `#preventivo-form` aperto, `tipo-lavoro` compilato, messaggio **solo data** («mercoledì») | **A** (meteo) su turno **C** (form) | Valuta pioggia/praticabilità **senza** inject data se sconsigliato; log `quickReplyHit: meteo_preventivo_data`. Conferma data («ok allora facciamo martedì») → **Gemini** (no secondo hook meteo). |

**Guard creazione:** `isTonyOperationalCreationIntent` (`tony-quick-replies.js`) — «crea preventivo…», «dobbiamo trinciare…» **non** attivano meteo operativo generico; il hook preventivo-data resta attivo solo con form già in compilazione e messaggio data-only (`isTonyPreventivoDateMeteoEval`).

**Correzioni form:** `isTonyPreventivoFormFieldCorrection` — «sottocategoria TRA LE FILE» non attiva meteo (evita loop su binario C).

### 5.2 Struttura configurabile — `QUICK_REPLY_MAP`

Principio **configurazione > codice**. File dedicato `functions/tony-quick-replies.js`:

```javascript
// Esempio struttura (non implementazione)
const QUICK_REPLY_MAP = [
  {
    id: 'query_scorte',
    keywords: [/sotto\s*scorta/i, /scorte\s*basse/i, /esaurito/i],
    tierRequired: 'T1',
    domains: ['magazzino'],
    execute(ctx) { return formatSottoScorta(ctx.azienda); }
  },
  {
    id: 'query_tariffa_costo',
    keywords: [/quanto\s+costa/i, /tariffa/i, /listino/i, /€\s*\/\s*ha/i],
    tierRequired: 'T2',
    domains: ['conto_terzi', 'tariffe'],
    execute(ctx, message) { return resolveTariffaDeterministica(ctx, message); }
  }
  // … estendibile senza toccare index.js
];
```

**Campi utili per voce mappa**: `id`, `keywords`, `tierRequired`, `domains`, `confidence`, `execute(ctx, message, history)`.

**Integrazione**: loop in `tonyAsk` dopo cache context; primo match con confidence sufficiente; altrimenti prosegui verso Gemini.

### 5.3 Candidati Fase 1 (lettura — braccio destro “fatti immediati”)

| Intent | Fonte | Output |
|--------|-------|--------|
| Sotto scorta / prodotti critici | summarySottoScorta, prodottiSottoScorta | Testo + elenco |
| Scadenze (affitti, mezzi) | summaryScadenze | Testo |
| Quanto costa [lavoro] × [campo/coltura] | tariffe + tipiLavoro + categorie | €/ha deterministico |
| Quanti clienti / preventivi / tariffe | rispettive collection | Conteggi + breakdown stato |
| Ultimi movimenti magazzino | summaryMovimentiRecenti | Testo |
| Guasti aperti (conteggio / elenco breve) | guastiAperti | Testo |
| PREVENTIVO_LIST_ACTION verb chiaro | logica esistente | Comando **prima** di Gemini |
| Meteo | già implementato | — |

### 5.4 Candidati Fase 2

- FILTER_TABLE ovvio + pageType corrente.
- SUM_COLUMN quando `currentTableData` presente.
- Field workspace enumerate jobs (estensione client). ✅ «quali lavori» locale — 2026-05-06
- **Segna ore workspace** intervista + save locale 0 CF. ✅ **3b-C21** — 2026-06-04 (§1.9)
- Blocchi consiglio **deterministico** semplici (es. “sotto scorta + trattamento citato” → avviso prodotto mancante) — avvicina Fase 6 proattività.

### 5.5 Mai in quick reply (restano Gemini + comandi)

- Crea lavoro / attività / preventivo con inferenza multi-campo (primo turno) — **primo turno** resta binario C; **follow-up** su form lavoro aperto (macchine, intervista campi, tipo, save) → **client-side** (2026-05-25–30, §3b.7–§3b.8).
- form-trattamento con righe prodotto e flag sensibili.
- Disambiguazione terreno/macchine multipli al **primo** turno (prima dell’inject) — resta Gemini/parser entity-first; dopo inject, risposta breve macchine **no CF**.
- Consigli strategici aperti (“come organizzo la stagione?”) senza dati strutturati.
- Qualsiasi **write** senza conferma utente.

**Eccezione documentata (2026-05-24):** valutazione meteo su **data prevista** durante compilazione preventivo — quick reply **solo lettura** (nessun write); coerente con principio «deterministico prima, Gemini dopo» su fatti meteo noti. Non sostituisce il flusso creazione preventivo (binario C).

---

## 6. Ottimizzazioni Gemini e client

### 6.1 Streaming CF → widget

`askStream` oggi con callable = blocco singolo. Target: chunk testo → percezione immediata su binario C (consigli e form).

### 6.2 TTS decoupled (Fase 1)

Testo in chat subito; `getTonyAudio` in parallelo. Critico in campo con guanti/voce.

### 6.3 Treasure Map — meno retry

First-shot migliore; pattern top-N deterministici con fallback Gemini.

### 6.4 Prompt diet ✅ (Fase 2b — `tonyAsk` post-router)

Regole aggiuntive al system instruction **condizionali** al turno (`functions/index.js`):

| Blocco | Condizione |
|--------|------------|
| Regole meteo / pianificazione | `includeMeteoRules`: domanda meteo, dominio `meteo`, pagina `meteo_dashboard` |
| Magazzino / scorte | `includeMagazzinoRules`: tier ≥ T1 + dominio magazzino o path |
| Tariffe / clienti / preventivi | `includeTariffeRules`: tier ≥ T2 + conto terzi |
| Terreni / mezzi / manodopera | `includeTerreniMezziRules`: tier ≥ T3 + domini operativi |
| Subagent vigneto/frutteto | path pagina (non su binario A) |
| ELENCO DATI (tariffe/scadenze/scorte) | solo se blocco pertinente incluso |

Binario **C**, messaggio **ambiguous**, o tier **T4** → `needsFullPrompt = true` (conservativo).

Context JSON inviato a Gemini = slice tier (`sliceContextAziendaToTier`); chiave `_contextTier` nel payload.

### 6.5 Feedback UI

Indicatore “Sto controllando…” entro 100–200 ms.

---

## 7. Garanzie prodotto (dopo ottimizzazioni)

| Capacità “braccio destro” | Stato atteso |
|---------------------------|--------------|
| Consultare dati azienda da **qualsiasi pagina** (tariffe, clienti, scorte, scadenze, meteo…) | ✅ Meglio (veloce + affidabile su binario A) |
| Consigli che usano **più fonti** (meteo + mezzi + magazzino) | ✅ Router tierMax + tier enforcement (Fase 2b); ambiguous → T4 |
| Avvisi / RIASSUNTO / briefing | ✅ Tier T1; allineato Fase 6 Master Plan |
| Meteo su data prevista (preventivo in compilazione) | ✅ Quick reply `meteo_preventivo_data` (2026-05-24) |
| Cross-page, inject form, SAVE con conferma | ✅ Binario C invariato; lavoro: intervista + macchine + tipo + save **tutti locali** post 1° CF (2026-05-25–30); **segna ore workspace** intervista + save **tutti locali** 0 CF (2026-06-04) |
| Proattività “Ho notato X” (futuro) | ✅ Più headroom API; slice T1/T4 |
| Storico multi-anno / confronti anno | ⏳ Progetto app §9 — non questo piano |

---

## 8. Storico multi-anno e consigli nel tempo

Consultazione **anni precedenti** (vendemmia, trattamenti, ore, costi, rese, confronti) è **parte della visione** “braccio destro” ma **non** di questo piano di performance.

Quando il progetto trasversale sarà definito:

- Adapter Context Builder: **aggregati per anno/modulo** (non dump raw nel prompt).
- Quick reply e tier includeranno slice **`storico`** on demand.
- Tony potrà rispondere *“quest’anno vs 2025”* con la **stessa** architettura tier + cache, senza tornare al context pieno sempre.

Fino ad allora: ottimizzazioni su **dati correnti e summary** già in `buildContextAzienda`.

---

## 9. Roadmap implementazione

### Fase 0 — Misura (1–2 giorni) ✅ (2026-05-23)

- Log timing in `tonyAsk`: cache hit/miss, buildContext ms, meteo ms, quick reply hit, Gemini ms, retry count, binario/tier (`[Tony Perf]` JSON in log CF).
- Baseline p50/p95: meteo, tariffa, scorte, crea lavoro, consiglio misto — **da raccogliere in produzione**.
- **CLI review:** `npm run tony:perf-review` (`scripts/tony-perf-log-review.mjs`) — smoke 8 scenari + aggregazione log gcloud. Prima baseline (pre-2b, 2026-05-24): cacheHit 72%, quick reply meteo/tariffe OK, `routerTierUsed` ancora T4_full (shadow).

### Fase 1 — Quick win (1–2 settimane) ✅ (2026-05-23)

1. Cache Firestore `tonyContextCache` (+ TTL 120s). ✅
2. `buildContextMeteo` **solo** se domanda/pagina meteo. ✅
3. `tony-quick-replies.js` + `QUICK_REPLY_MAP` iniziale (§5.3). ✅
4. PREVENTIVO_LIST_ACTION deterministico **prima** di Gemini. ✅
5. TTS decoupled + typing indicator client. ✅
6. **`tony-module-gate.js`**: quick reply e navigazione rispettano `moduli_attivi` tenant. ✅ (2026-05-23)

**Done**: p50 consultazione binario A **target** < 1.5s (misurato, non garantito a priori); zero regressione crea lavoro cross-page.

### Fase 2a — Shadow router ✅ (2026-05-23)

1. `tony-intent-router.js`: classifica A/B/C + tier. ✅
2. Log only con `tierUsed: T4_full`. ✅
3. Review log → aggiustare mappe keyword / tierMax. ✅ (base per 2b)

### Fase 2b — Tier enforcement ✅ (2026-05-24)

1. `buildContextAziendaTier(tenantId, tierMax)` — fetch cumulativi T1→T4. ✅
2. `tony-context-tier.js` — `sliceContextAziendaToTier`, `resolveEffectiveTierMax`. ✅
3. Cache: hit T4 → slice al tier; write solo su build T4. ✅
4. Prompt diet condizionale (§6.4). ✅
5. Test Vitest: `tony-context-tier` (8), `tony-intent-router` (9), `tony-context-cache` (5), `tony-quick-reply` (13), `tony-module-gate` (3), `meteo-tony-quick-reply` (44/47 — 3 fail date-driven). ✅
6. **Estensione meteo preventivo-data** (quick reply su form aperto — §5.1). ✅ (2026-05-24)
7. **Retest manuale preventivo end-to-end** (Luca / trebbiano / meteo data / filari) OK. ✅ (2026-05-24)
8. **Deploy produzione + review log** — `routerTierUsed` ≠ sempre `T4_full`; cacheHit 76%; quick reply meteo/tariffe attive. ✅ (2026-05-24)

**Monitoraggio residuo:**
- Canary browser periodico (crea lavoro, preventivo+meteo, tariffe/scorte, RIASSUNTO).
- Più traffico binario A per baseline p50 e distribuzione T1/T2.
- Baseline p50 binario A e −40% Gemini su informativi — **da misurare** su 1–2 settimane log 2b.

### Fase 3 — Percezione e form ✅ (2026-05-25)

1. Streaming CF (`tonyAskStream` SSE, `tony-sse-parse.js`, env `GEMINI_API_KEY` su `tonyask` + `tonyaskstream`). ✅
2. Parser deterministico pattern attività/ore (`tony-activity-patterns.js`) + fallback Gemini. ✅
3. Riduzione retry Treasure Map (parser tollerante). ✅

**Canary chiusi:** scenario 9 (attività + manodopera, SSE ~1.6 s); scenario 7 (crea lavoro pinot/luca, SSE ~7.5 s, `streamUsed=true`).

**Limite residuo pre-3b (§1.3):** multi-turno + domande ridondanti + latenza cumulata ~60–70 s — **risolto** per canary §1.4, §1.5, §1.7, §1.8 e **§1.9** (segna ore workspace). Residui minori: p50/p95 produzione da misurare; pattern client-side save/creazione locale esteso a **magazzino completo** ✅ (3b-C15…**C19**) e **segna ore workspace** ✅ (**3b-C21**); ack tipo stem-only intervista lavoro ✅ (**3b-C20**, 2026-06-03).

### Fase 3b — Crea lavoro entity-first ✅ (2026-05-25)

**Obiettivo:** stesso risultato prodotto, con **≤1 domanda** (solo ambiguità reale) e **≤1 inject pieno** + patch minima; tempo totale percepito **target &lt; 15 s** (p95 &lt; 25 s).

**Esito canary §1.4:** ✅ PASS — 1 domanda trattore (2 compatibili), inject ~13 campi, follow-up macchine **client-side**, totale percepito **&lt; 15 s** (1 CF + inject + risposta locale).

**Non obiettivo:** quick reply binario A sul primo turno crea lavoro (resta binario C / entity-parser + Gemini); follow-up macchine **sì** client-side (equivalente quick reply locale, §3b.7).

#### 3b.1 Estrazione entità al primo turno (server) ✅

1. **`functions/tony-lavoro-entity-parser.js`** — operaio, terreno, tipo, data, durata (`durata 1` breve); trattore solo se **dichiarato** nel messaggio (altrimenti lasciato vuoto per disamb. client).
2. **Hook in `handleTonyAskRequest`** — early return / enrich post-Gemini con `formData` entity-first.
3. **Log `[Tony Perf]`:** `lavoroEntityParseHit`, `lavoroInjectFieldsCount`, `lavoroFollowUpTurns`.

#### 3b.2 Disambiguazione solo se necessaria (server + client) ✅

| Situazione | Comportamento atteso | Stato |
|------------|---------------------|-------|
| Nome mezzo/operaio match **unico** in elenco | Compila, **non chiedere** | ✅ |
| Match **multipli** trattori compatibili (CV attrezzo) | 1 domanda + elenco candidati | ✅ canary Agrifull/T5 |
| Match **zero** trattore nel messaggio iniziale | Chiedi trattore **dopo** inject (non inventare) | ✅ `sanitizeUndeclaredLavoroMacchine` |
| **Sottocategoria / tipo lavoro** | Da **coltura terreno** (`applyLavorazioneDefaultsLavoro`) — **no** domanda chat | ✅ es. Larghetta → Tra le File |
| **Tipo lavoro vago in intervista** («potatura», stem-only) | Disamb. client 2 livelli (M/M poi varianti) o elenco flat — **no** CF | ✅ §3b.8 (2026-05-30) |
| **Auto-pick stem-only** (trinciatura, erpicatura, …) | Ack chat «Ok, [Tipo] su [Terreno]» + prossima domanda — **no** CF | ✅ §1.8 / **3b-C20** (2026-06-03) |
| Utente risponde `t5` / `agrifull` | Intercept client, inject DOM, conferma salvataggio | ✅ §3b.7 |

#### 3b.3 Meno round-trip CF (server) ⏳ parziale

1. **Follow-up form aperto:** ridurre re-invio tabella 68 righe su risposta macchine — **mitigato** da intercept client (no CF); gating proattivo 120 s post-disamb.
2. **Tier:** crea lavoro ≥ T3 — invariato.
3. **Treasure Map:** 1 chiamata per turno utente — ✅ su flusso canary.

#### 3b.4 Inject client a patch ✅

1. **`tony-form-injector.js`:** `patchOnly`, `waitForLavoriFormDataReady`, delay cascata ridotti; `applyLavoroMacchineFromUserReply`, alias trattore (`t5`).
2. **`gestione-lavori-standalone.html`:** `lavori-form-data-ready` **prima** di `loadLavori`.
3. **`main.js`:** gating proattivo; `__tonyPromptLavoroSaveLocal`; intercept macchine; timer `ready_for_save` 800 ms.

#### 3b.5 Test e canary ✅

| # | Scenario | Criterio pass | Esito |
|---|----------|---------------|-------|
| 3b-C1 | `luca` + larghetta + erpicatura + mercoledì + durata 1 gg (senza trattore) | ≤1 domanda; inject ≥13 campi; ≤2 CF totali | ✅ PASS |
| 3b-C2 | Risposta disamb. `agrifull` / `t5` | Inject DOM OK; no CF; «Vuoi che salvi?» | ✅ PASS |
| 3b-C3 | Crea lavoro pinot/luca/trincia (cross-page) | Nessuna regressione | ✅ coperto da **3b-C13** (2026-05-31) |
| 3b-C4 | Messaggio senza operaio | Chiede solo assegnazione | ✅ intervista locale |
| 3b-C5 | «crea lavoro per gaia» + terreno | Persona dal 1° messaggio; no CF follow-up persona | ✅ PASS (2026-05-30) |
| 3b-C6 | Squadra + caposquadra omonimo («pier») | Disamb. caposquadra; save locale | ✅ PASS |
| 3b-C7 | «potatura» vaga | 2 livelli manuale/meccanica → varianti; no CF | ✅ PASS |
| 3b-C8 | «salva» dopo prompt save | Intercept prima creation flow; `SAVE_ACTIVITY` | ✅ PASS |
| 3b-C9 | Potatura **meccanica** (autonomo) | Dopo schedule chiede trattore+attrezzo; no skip a «Ok compilato» | ✅ PASS (2026-05-31) |
| 3b-C10 | Vendemmia squadra su vite | M/M → manuale → no macchine; filtro catalogo vendemmia; save + vendemmia auto | ✅ PASS (2026-05-31) |
| 3b-C11 | Operaio ambiguo («Luca»×2) | Elenco candidati → cognome → inject; no «caposquadra» se autonomo non confermato | ✅ PASS (2026-05-31) |
| 3b-C12 | Terreno ambiguo («sangiovese»×2) | Elenco candidati → «pannelli» → inject; 0 CF follow-up; tipo M/M + save locale | ✅ PASS (2026-05-31) |
| 3b-C13 | **E2E cross-page** terreno×2 + assign «a Luca» + tipo + macchine | Disamb. terreno → disamb. operaio → radio **autonomo** + select operaio → trinciatura → schedule → trattore → save locale; 0 CF follow-up | ✅ PASS (2026-05-31) |
| 3b-C14 | **Preventivo E2E** — save locale dopo intervista completa | Nuovo Preventivo: luca + trinciatura trebbiano → disamb. terreno (lago) → data (meteo → sab 6 giu) → timer `ready_for_save` → «Vuoi che salvi il preventivo?» → «salva» → `SAVE_ACTIVITY` locale; **no** `tonyAskStream` sulla conferma; bozza in elenco | ✅ PASS E2E browser (2026-05-31) |
| 3b-C15 | **Prodotto magazzino E2E** — save locale dopo form completo | Prodotti: crea prodotto (nome, categoria, unità, scorta, prezzo) → timer `ready_for_save` → «Vuoi che salvi il prodotto?» → «salva» → `SAVE_ACTIVITY` locale; **no** `tonyAskStream` sulla conferma | ✅ PASS E2E browser (2026-05-31) |
| 3b-C16 | **Movimento entrata E2E** — creazione locale + prezzo catalogo + save locale | Movimenti: «crea entrata nimrod 10 unità» → **0 CF** creazione (`tryInterceptMovimentoCreateBeforeCf`) → modal + prezzo 45 € da anagrafica → «Vuoi che salvi il movimento?» → «salva» → `SAVE_ACTIVITY` locale; **no** `tonyAskStream` su creazione né conferma | ✅ PASS E2E browser (2026-06-02) |
| 3b-C17 | **Movimento uscita E2E** — creazione locale + save locale (no prezzo) | Movimenti: «registra uscita roundup 5 litri» / «scarico concime 2 kg» → **0 CF** creazione → modal tipo uscita, **no** `mov-prezzo` da catalogo → «Vuoi che salvi il movimento?» → «salva» → `SAVE_ACTIVITY` locale; giacenza decrementata | ✅ PASS E2E browser (2026-06-02) |
| 3b-C18 | **Creazione prodotto E2E** — parse locale + save locale | Prodotti: «crea prodotto roundup fitofarmaci litri scorta 50 prezzo 45 dosaggio 0.5-1 carenza 30» → **0 CF** → modal + inject → save locale | ✅ **PASS E2E** (2026-06-02) |
| 3b-C19 | **Cross-page magazzino** — prodotto + movimento | Abbonamento/conto terzi → nav + pending inject (prodotto 8 campi; movimento 4 campi entrata) | ✅ **PASS E2E** (2026-06-02) |
| 3b-C20 | **Ack tipo stem-only E2E** — intervista lavoro completa + save | Terreno Larghetta già nel form → «dobbiamo trinciare» → ack tipo+terreno → assign/disamb. persona → schedule → macchine → save locale; **0 CF** follow-up | ✅ **PASS E2E** (2026-06-03) |
| 3b-C21 | **Segna ore workspace E2E** — intervista + save locale + validazione | Operaio su workspace mobile → «segniamo le ore» → orari → pausa 0/nessuna → «ok» → submit `#quick-hours-form`; record in validazione manager; **0 CF** intervista | ✅ **PASS E2E** (2026-06-04) |

**Evidenza 3b-C14 (browser, `?_canary=3b-C14-e2e`):** 6× `tonyAskStream` durante dialogo (terreno/data/meteo); dopo «salva» solo Firestore + redirect elenco; console `Timer proattivo preventivo: type= ready_for_save` poi `Salva preventivo-form: conferma utente locale (senza tonyAsk).`

**Evidenza 3b-C15 (browser):** inject prodotto fitofarmaci → timer `ready_for_save` 800 ms → `Salva prodotto-form: conferma utente locale (senza tonyAsk).` + submit; **0** `tonyAskStream` sulla conferma.

**Evidenza 3b-C16 (browser, 2026-06-02):** `crea entrata nimrod 10 unità` → log creazione locale (no intervista CF) → INJECT 4 campi required + prezzo via DOM post-inject (`applyMovPrezzoCatalogoToDom`) → `Salva movimento-form: conferma utente locale` + `SAVE_ACTIVITY`; movimento visibile in lista.

**Evidenza 3b-C17 (browser, 2026-06-02):** `registra uscita roundup 5 litri` → creazione locale (no CF) → tipo uscita, **no** `mov-prezzo` → save locale.

**Evidenza 3b-C18 (browser, 2026-06-02):** `crea prodotto roundup fitofarmaci … dosaggio 0.5-1 carenza 30` → creazione locale (no CF) → INJECT 8 campi → `Salva prodotto-form: conferma utente locale` + `SAVE_ACTIVITY`.

**Evidenza 3b-C19 (browser, 2026-06-02):** da **abbonamento** → prodotto (8 campi pending-after-nav); da **conto terzi** → `crea entrata nimrod 10 unità` → movimenti + INJECT 4 campi (prodotto id, data, entrata, qty) — **0 CF** creazione.

**Evidenza 3b-C20 (browser, 2026-06-03):** terreno Larghetta pre-impostato → `dobbiamo trinciare` → ack «Ok, Trinciatura tra le file su larghetta…» → intervista completa (Luca/fabbri, domani, 1, agrifull) → `Salva lavoro-form: conferma utente locale` + record in lista; **0** `tonyAskStream` sui follow-up.

**Evidenza 3b-C21 (browser, 2026-06-04):** workspace mobile operaio — `segniamo le ore` → inject orari 07:00–18:00 → pausa `0` → `ok` → `Salva rapido workspace: conferma locale` + `SALVA: submit su quick-hours-form`; validazione manager OK (lavoro autonomo); **0** `tonyAskStream` su intervista.

**Test Vitest magazzino (60 pass):** `tony-form-save-local.test.js` (20), `tony-movimento-create-local.test.js` (15), `tony-prodotto-create-local.test.js` (11), `prodotto-form-required.test.js` (5), `movimento-prezzo-catalogo.test.js` (9).

**Test Vitest segna ore workspace (42 pass):** `tony-form-save-local.test.js` (**28**, include quick-hours save), `tony-segna-ora-time-range.test.js` (**14**).

#### 3b.6 File implementati ✅

| Area | File |
|------|------|
| Parser entità | `functions/tony-lavoro-entity-parser.js` |
| Pipeline CF | `functions/index.js` |
| Injector | `core/js/tony-form-injector.js` (patch, macchine, coltura→sottocategoria, **intervista**, disamb. tipo 2 livelli, squadra) |
| Config lavorazioni | `core/config/tony-form-mapping.js` (`LAVORAZIONI_DEFAULTS_TONY.manualMechChoiceStems` / `manualMechSkipStems`) |
| Pagina lavori | `core/admin/gestione-lavori-standalone.html` (`lavori-form-data-ready`) |
| Widget | `core/js/tony/main.js` (intercept, save locale, proactive, **`applyLavoroCreationTurn`**, await modal) |
| Save locale form | **`core/js/tony-form-save-local.js`** (config lavoro + preventivo + **prodotto + movimento**, intercept conferma, `magazzinoProactiveReadyForSave`, 0 CF) |
| Creazione movimento locale | **`core/js/tony-movimento-create-local.js`** (parse, OPEN_MODAL + inject, cross-page, recovery fake save CF) |
| Creazione prodotto locale | **`core/js/tony-prodotto-create-local.js`** (parse, OPEN_MODAL + inject, cross-page, recovery fake save CF) |
| Dosaggio/carenza obbligatori prodotto | **`core/js/prodotto-form-required.js`**, `modules/magazzino/models/Prodotto.js`, `prodotti-standalone.html` |
| Prezzo catalogo entrata | **`core/js/movimento-prezzo-catalogo.js`**, enrich in `tony-form-injector.js`, suggest DOM in `movimenti-standalone.html` |
| Test | … **`tests/tony-prodotto-create-local.test.js`**, **`tests/prodotto-form-required.test.js`**, **`tests/tony-movimento-create-local.test.js`**, **`tests/movimento-prezzo-catalogo.test.js`**, **`tests/tony-form-save-local.test.js`** |

#### 3b.7 Follow-up macchine client-side (performance UX) ✅

Pattern **deterministico locale** (stesso spirito binario A, ma sul form già aperto):

1. Tony emette disambiguazione (`tony-macchine-disambiguation`) con candidati in sessione.
2. Risposta breve utente → **`sendMessage` intercept** → `applyLavoroMacchineFromUserReply` (no `tonyAskStream`).
3. Verifica `lavoro-trattore` / `lavoro-attrezzo` in DOM (option `in_uso` abilitata temporaneamente se serve).
4. **`__tonyPromptLavoroSaveLocal`** → conferma → `SAVE_ACTIVITY` locale.

**Guadagno:** evita CF ~5–30 s con contesto tabella (68 lavori) su ogni risposta «agrifull»/«t5».

**Ordine UX (2026-05-26):** se il messaggio non nomina macchine e ci sono 2+ attrezzi compatibili col tipo lavoro → **prima** disamb. trattore, **poi** attrezzo (`shouldAskAttrezzoDisambigFromTipo`); eccezione: attrezzo già nel messaggio utente.

**Intervista client-side (2026-05-26):** risposte brevi terreno/operaio/data/durata/tipo → `applyLavoroInterviewFromUserReply` (no CF); domanda proattiva locale `promptLavoroInterviewMissing`.

**Attrezzo multiplo ✅ (2026-05-26)** — vedi §14.6.

#### 3b.8 Intervista unificata + disamb. tipo (2026-05-30) ✅

Estensione performance del pattern §3b.7 a **tutto il creation flow** dopo il 1° turno CF:

```
1° turno utente (entity-dense o parziale) → 1× CF binario C (~1–2 s SSE) + inject
2..N risposte brevi (terreno, persona, data, tipo, macchine, «salva») → applyLavoroCreationTurn → 0 CF
```

| Componente | Ruolo performance |
|------------|-------------------|
| `applyLavoroCreationTurn` | Un solo handler; evita doppio routing intervista/macchine e CF spurie |
| `stripLavoroCreationIntentPrefix` + `waitForLavoriManodoperaReady` | Meno turni intervista; persona dal messaggio iniziale |
| `offerTipoLavoroDisambIfNeeded` + 2 livelli M/M | Disamb. tipo locale (no Gemini su «potatura»/«manuale»); solo stem `manualMechChoiceStems` con entrambe le varianti in catalogo |
| `inferRequiresMachineFromTipo` + `classifyTipoLavoroModo` | Gate macchine dopo intervista: meccanica sì, manuale no; «Potatura verde» via keyword `verde` |
| Intercept `__tonyAwaitingLavoroSaveConfirm` **prima** creation flow | «salva» non finisce in parser intervista |
| `syncLavoroOperatoreMacchinaIfNeeded` pre-save | Evita retry DOM / secondo turno macchine |
| `__tonyLavoroPersonDisambCandidates` + `resolvePersonFromDisambReply` | Disamb. operaio autonomo locale (2+ «Luca» → elenco → inject, 0 CF) |
| `lavoroInterviewCanApplyPendingTipoHint` + `lavoroInterviewPersonDisambPending` | Persona **prima** di hint tipo pending; disamb. non ignorata se patch ha altri campi |
| `__tonyLavoroConfirmedAssignMode` + cross-page `tony_pending_lavoro_local_intent` | Autonomo in sessione ≠ default DOM squadra; crea lavoro da altra pagina senza auto-pick operaio |
| `buildLavoroTipoStemOnlyAckMessage` + `prependLavoroTipoStemOnlyAck` | Ack tipo dopo auto-pick stem vago (trinciatura/erpicatura); UX senza CF aggiuntive — §1.8 |

**Prossime estensioni (stesso pattern, §14.6b decisioni):** ~~operaio ambiguo~~ ✅ … ~~creazione prodotto + cross-page magazzino~~ ✅ (3b-C18/C19, 2026-06-02), ~~ack tipo in chat dopo stem vago~~ ✅ (**3b-C20**, 2026-06-03) — **§14.6b chiuso** per intervista lavoro client-side

#### 3b.9 Magazzino — save locale + creazione movimento + prezzo catalogo ✅ (2026-06-02)

Estensione del pattern §3b.8 al modulo **Magazzino**:

```
Intent «crea entrata/uscita …» → tryInterceptMovimentoCreateBeforeCf → OPEN_MODAL + inject (0 CF)
Form completo → timer 800 ms → «Vuoi che salvi il prodotto/movimento?»
«salva» → tryInterceptMagazzinoSaveBeforeCf → SAVE_ACTIVITY locale (0 CF)
```

| Componente | Ruolo performance |
|------------|-------------------|
| `tryInterceptMovimentoCreateBeforeCf` | Evita intervista CF multi-turno su creazione movimento |
| `magazzinoProactiveReadyForSave` | Prompt save senza attendere campi opzionali movimento |
| `tryInterceptMagazzinoSaveBeforeCf` | Conferma save locale; sopprime fake save CF |
| `enrichMovimentoFormDataFromCatalog` + DOM suggest | Prezzo entrata senza turno utente aggiuntivo |

Vedi §1.7 per canary **3b-C15…C19** e evidenza browser.

#### 3b.10 Segna ore workspace campo ✅ (2026-06-04)

Estensione del pattern §3b.8–§3b.9 al form inline **`#quick-hours-form`** (profilo campo, workspace mobile):

```
«segniamo le ore» → intervista locale (0 CF)
Turni orario/pausa → inject DOM (0 CF)
«ok» / «sì» / «salva» → tryInterceptQuickHoursSaveBeforeCf → submit reale Firestore (0 CF)
```

| Componente | Ruolo performance |
|------------|-------------------|
| `tryInterceptSegnaOreIntentBeforeCf` + turn intercepts | Evita CF su intent e turni orario/pausa |
| `tryInterceptQuickHoursSaveBeforeCf` | Conferma save locale; no fake «Ore salvate» CF |
| `tonySalvaQuickHoursWorkspace` + `tonyQuickHoursUserAcknowledgedPause` | Submit reale; gate pausa 0 da **tutti** i turni + flag inject |
| `tony-field-workspace-command.js` | Normalizza alias CF INJECT/SUBMIT |
| `engine.js` parser orari elastici | Meno fallimenti → meno fallback CF |

Vedi §1.9 per canary **3b-C21** e evidenza browser.

### Fase 4 — Binario B deterministico + cache write ✅ (2026-06-03)

**Obiettivo:** navigazione, filtri tabella ovvii, RIASSUNTO e invalidazione cache **senza** Gemini quando il router classifica binario B (o multi-dominio A concatenabile). In dubbio → fallback Gemini (conservativo).

#### 4.1 Invalidazione cache su write ✅

| Elemento | Dettaglio |
|----------|-----------|
| API | `invalidateTonyContextCache(db, tenantId)` in `functions/tony-context-cache.js` — delete `tenants/{tenantId}/tonyContextCache/latest` + purge LRU memoria |
| Trigger | `tonyInvalidateCacheOnProdottiWrite`, `…MovimentiMagazzinoWrite`, `…PreventiviWrite`, `…TariffeWrite`, `…GuastiWrite` (`onDocumentWritten`, europe-west1) |
| Callable | `aggiornaStatoPreventivoPubblico` invalida cache tenant dopo accetta/rifiuta |
| Scope | **Non** su ogni write (ore, attività campo) — solo magazzino + conto terzi + guasti |

**Deploy:** primo deploy CF può fallire su Eventarc Service Agent (400); attendere propagazione IAM e redeploy solo i 5 trigger.

#### 4.2 Navigazione + FILTER_TABLE + RIASSUNTO ✅

| Modulo | Ruolo |
|--------|--------|
| `functions/tony-nav-quick-reply.js` | `APRI_PAGINA` (mappa frase→target + `tony-module-gate`); `RIASSUNTO` da `page.tableDataSummary` / `globalStatus` |
| `functions/tony-filter-table-quick-reply.js` | `FILTER_TABLE` reset, prodotti `solo attivi`, lavori terreno/stato, tariffe attive, movimenti entrate/uscite; `SUM_COLUMN` su `vendemmia` / `tracciabilita_consumi` se aggregati in `currentTableData` |
| Hook | `handleTonyAskRequest` dopo `tryTonyQuickReplies`, prima pattern attività / Gemini |
| Log perf | `quickReplyHit`: `nav`, `riassunto_tabella`, `riassunto_briefing`, `filter_table`, `sum_column` |

**Canary E2E (2026-06-03):** `portami alle tariffe` → APRI_PAGINA, 0 Gemini; `RIASSUNTO` su tariffe → summary tabella; `solo attivi` su prodotti; `filtra per pinot` su lavori; crea lavoro senza regressione (1× CF + intervista client).

#### 4.3 Quick reply multi-blocco ✅

| Elemento | Dettaglio |
|----------|-----------|
| File | `functions/tony-multi-block-quick-reply.js` |
| Logica | 2+ domini (meteo + magazzino + scadenze) → concatena blocchi A; se un blocco manca → null (Gemini) |
| Traffico | Campione produzione ancora piccolo; smoke locale scenario #8 con meteo mock |

#### 4.4 Offline coda ore mobile — ⏸️ Deferred

Track **manodopera / field workspace** separato per **coda offline IndexedDB** (rete assente). **Non** parte di questo piano.

**Nota (2026-06-04):** il flusso **online** segna ore via Tony (intervista + save locale 0 CF, §1.9 / **3b-C21**) è **implementato e verificato E2E** — distinto dalla coda offline deferred.

#### Evidenza post-deploy (`npm run tony:perf-review`)

- Smoke router 8/8 + binario B quick 3/3 (locale).
- Produzione `tonyaskstream` (campione ~89 log, 2026-06-03): `usedGemini false` ~25%; **6** richieste B con quick Fase 4; residuo **~12** B ancora Gemini (estensione mappa frasi).
- Obiettivi formali −40% / p50 &lt; 1,5s: **da misurare** su traffico più ampio.

---


## 10. Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Falsi negativi router (tier basso) | tierMax multi-dominio; shadow mode; in dubbio T4 |
| Quick reply errata | Test fixture; fallback Gemini; log miss |
| Cache stale | TTL 90–180 s; **invalidazione Fase 4.1** su write magazzino/conto terzi/guasti |
| Cache solo in-memory CF | Firestore doc condiviso (§4.3) |
| Percezione “Tony sa meno” | Comunicare stessi dati, risposta più rapida; no slim su consigli complessi |
| Regressione cross-page | Canary: crea lavoro/preventivo da Dashboard |
| Crea lavoro: domande su entità già dette | Fase 3b entity-parser + regole §19.6.10; canary 3b-C1 ✅ |
| Multi-turno >3 CF su stesso lavoro | Patch inject + intercept macchine/intervista client-side + gating proattivo + turn unificato §3b.8 |
| Risposta disamb. macchine → CF lenta | Pattern §3b.7 — intercept locale |
| Risposta intervista/tipo/save → CF o «Non ho capito» | Pattern §3b.8 — `applyLavoroCreationTurn` + ordine intercept |
| Persona nel 1° messaggio ignorata | Await modal + `waitForLavoriManodoperaReady` + strip prefix |
| CF fake save movimento/prodotto senza submit | `tryInterceptMagazzinoSaveBeforeCf` + `isTonyMagazzinoCfFakeSaveText`; creazione locale §3b.9; canary **3b-C15…C19** ✅ |
| Segna ore workspace: CF su ogni turno / save bloccato su «ok» | Pattern §3b.10 — intercept intervista + save locale; `tonyQuickHoursUserAcknowledgedPause`; canary **3b-C21** ✅ |
| Obiettivi −40% / 1.5s non raggiunti | Fase 0 baseline; rivedere mappe, non promettere in marketing prima della misura |

---

## 11. File toccati (implementato)

| Area | File |
|------|------|
| CF entry | `functions/index.js` (`tonyAsk`, `buildContextAziendaTier`, prompt diet, meteo/preventivo hooks) |
| Router / tier / cache / quick reply / gate | `functions/tony-intent-router.js`, `functions/tony-context-tier.js`, `functions/tony-context-cache.js`, `functions/tony-quick-replies.js`, `functions/tony-module-gate.js` |
| **Fase 4** nav / filter / multi-blocco | `functions/tony-nav-quick-reply.js`, `functions/tony-filter-table-quick-reply.js`, `functions/tony-multi-block-quick-reply.js`; hook in `functions/index.js` |
| **Fase 4.1** cache invalidate triggers | `tonyInvalidateCacheOnProdottiWrite`, `…MovimentiMagazzinoWrite`, `…PreventiviWrite`, `…TariffeWrite`, `…GuastiWrite` |
| Meteo | `functions/meteo-service.js`, `functions/tony-meteo-rules.js` |
| Test | `tests/tony-quick-reply.test.js`, `tests/tony-intent-router.test.js`, `tests/tony-context-tier.test.js`, `tests/tony-context-cache.test.js`, `tests/tony-module-gate.test.js`, `tests/meteo-tony-quick-reply.test.js`, **`tests/tony-nav-quick-reply.test.js`**, **`tests/tony-filter-table-quick-reply.test.js`**, **`tests/tony-multi-block-quick-reply.test.js`** |
| Review CLI | `scripts/tony-perf-log-review.mjs` (`npm run tony:perf-review`) — smoke binario B quick |
| Client UX | `core/services/tony-service.js`, `core/js/tony/main.js`, `core/js/tony/voice.js`, `core/js/tony-form-injector.js` |
| Pagina lavori (bootstrap inject) | `core/admin/gestione-lavori-standalone.html` |
| **Fase 3b** | `functions/tony-lavoro-entity-parser.js`, patch injector/main, test disamb. trattore + **intervista client** — vedi §9 Fase 3b, §3b.8 |
| **Fase 3b config** | `core/config/tony-form-mapping.js` (`LAVORAZIONI_DEFAULTS_TONY` disamb. tipo M/M) |
| **Fase 3b.9 magazzino** | `core/js/tony-form-save-local.js`, `core/js/tony-movimento-create-local.js`, `core/js/movimento-prezzo-catalogo.js`, `modules/magazzino/views/movimenti-standalone.html` — vedi §1.7, §3b.9 |
| **Fase 3b.10 segna ore workspace** | `core/js/tony-form-save-local.js`, `core/js/tony/engine.js`, `core/js/tony/main.js`, `core/mobile/js/field-workspace-controller.js`, `functions/tony-field-workspace-command.js` — vedi §1.9, §3b.10 |
| Config client gate | `core/config/tony-module-gate.js` |
| Firestore | `tenants/{id}/tonyContextCache/latest` (+ rules se necessario) |
| Doc post-implementazione | `tony/STATO_ATTUALE.md`, `COSA_ABBIAMO_FATTO.md`, `TONY_DECISIONI_E_REQUISITI.md` §14.4–§14.7, §14.6m, §19.6.10 |

---

## 12. Criteri di successo

**Performance (misurati post Fase 0–1)**:

- p50 consultazione binario A: **target** < 1.5s senza Gemini.
- Riduzione chiamate Gemini su messaggi informativi: **target** > 40%.
- Zero regressioni cross-page / form (Master Plan Fase 2 e 4).

**Binario C — crea lavoro (Fase 3b, canary §1.4 — 2026-05-25):**

- Messaggio entity-dense (operaio + terreno + tipo + data + durata, trattore **non** nel messaggio se ambiguo): **≤1** domanda di disambiguazione; **1** CF + follow-up macchine **client-side** (no seconda CF).
- Tempo totale percepito canary: **&lt; 15 s** (1° CF ~1–2 s + inject ~6–7 s + risposta locale immediata). p50/p95 produzione: **da misurare**.
- Zero domande su sottocategoria/tipo se terreno con coltura nota; zero auto-invento trattore con 2+ compatibili.
- Risposta `t5` / `agrifull`: intercept client, DOM OK, conferma salvataggio locale.
- Log: `lavoroFollowUpTurns` mediana target ≤ 1 — **canary OK** su disamb. trattore.

**Binario C — intervista lavoro post 1° CF (Fase 3b.8, canary §1.5 — 2026-05-30):**

- Ogni risposta breve intervista (terreno, persona, data, durata, tipo, macchine, conferma save): **0 CF**; routing via `applyLavoroCreationTurn`.
- Messaggio con persona embedded («crea lavoro per …»): **0 turni** domanda assegnazione se match univoco.
- Disamb. tipo vago (potatura/vendemmia): **2 livelli** client-side **solo** se catalogo ha manuale **e** meccanica; lavorazioni meccaniche pure (erpicatura, trinciatura): skip livello 1 + **ack** «Ok, [Tipo] su [Terreno]» (§1.8).
- Tipo meccanico post M/M: **obbligo** fase trattore+attrezzo prima di «Ok compilato» (`inferRequiresMachineFromTipo` — 2026-05-31).
- Conferma «salva»/«sì»: intercept save **prima** creation flow → `SAVE_ACTIVITY` locale.
- Test regressione: `tony-lavoro-interview-client.test.js` — **37 pass**.
- Canary **3b-C13**: cross-page + terreno×2 + «a Luca» + autonomo DOM + tipo + macchine + save — **0 CF** follow-up.
- Canary **3b-C20**: ack stem-only + intervista completa + save locale — **0 CF** follow-up (2026-06-03).

**Binario C — magazzino (Fase 3b.9, canary §1.7 — 2026-06-02):**

- Creazione movimento/prodotto da chat: parse locale + OPEN_MODAL + inject — **0 CF** se intent completo (canary **3b-C16/C17/C18/C19**); **cross-page** da dashboard (C19).
- Conferma save prodotto/movimento: **0 CF**; prompt canonico → `SAVE_ACTIVITY` locale (canary **3b-C15…C19**).
- Prezzo entrata: da anagrafica se vuoto; **uscita: no prezzo auto**.
- Test regressione: `tony-form-save-local.test.js` (28), `tony-movimento-create-local.test.js` (15), `tony-prodotto-create-local.test.js` (11), `movimento-prezzo-catalogo.test.js` (9).

**Binario C — segna ore workspace (Fase 3b.10, canary §1.9 — 2026-06-04):**

- Intervista orari/pausa su `#quick-hours-form`: **0 CF** per turno (canary **3b-C21**).
- Conferma «ok»/«sì»/«salva» con pausa 0 dopo cenno utente: submit reale Firestore + validazione manager.
- Test regressione: `tony-form-save-local.test.js` (28), `tony-segna-ora-time-range.test.js` (14).

**Prodotto “braccio destro”**:

- Da Dashboard, domande su tariffe/scorte/scadenze/meteo **affidabili** (numeri da dati, non inventati).
- Messaggi multi-dominio **non** degradati vs oggi (validato in shadow mode).
- Latenza percepita in voce migliorata (TTS decoupled + typing/streaming).
- Base tecnica pronta per **storico multi-anno** e proattività cross-modulo (tier + cache + mappe estendibili).

---

## 13. Riferimenti incrociati

- Visione Tony: `tony/MASTER_PLAN.md` §1, §5 Context Builder, §6 proattività
- Meteo quick reply: `docs-sviluppo/meteo/PLAN_INTEGRAZIONE_METEO.md` §11
- Context Builder: `docs-sviluppo/CONTEXT_BUILDER_SPECIFICHE_SVILUPPO.md`
- Decisioni crea lavoro / macchine / coltura / segna ore workspace: `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` §14.4–§14.7, §14.6m, §19.6.10
- Baseline crea lavoro **pre-3b**: §1.3 (multi-turno ~60–70 s — 2026-05-25)
- Baseline crea lavoro **post-3b**: §1.4 (canary erpicatura larghetta — 2026-05-25)
- Baseline intervista client-side **post-3b.8**: §1.5 (unificazione macchine + tipo + save — 2026-05-30), §1.6 rev.9 (operaio/potatura/vendemmia/gate macchine + assign autonomo E2E — 2026-05-31), §1.8 (ack tipo stem-only — **3b-C20** E2E — 2026-06-03)
- Baseline **magazzino client-side post-3b.9**: §1.7 (save + creazione prodotto/movimento + cross-page — 2026-06-02); canary **3b-C15…C19** ✅ E2E browser
- Baseline **segna ore workspace post-3b.10**: §1.9 (intervista + save locale 0 CF + validazione manager — 2026-06-04); canary **3b-C21** ✅ E2E browser
- **Scalabilità lista lavori (storico 30k+):** `docs-sviluppo/lavori/PLAN_SCALABILITA_LISTA_LAVORI.md` — default ultimo mese + query periodo (da implementare)
- Stato componenti: `docs-sviluppo/tony/STATO_ATTUALE.md`
- Changelog implementazione: `docs-sviluppo/COSA_ABBIAMO_FATTO.md` (2026-06-04 segna ore workspace **3b-C21**; 2026-06-03 ack lavoro; 2026-06-02 magazzino E2E 3b-C15…C19)
