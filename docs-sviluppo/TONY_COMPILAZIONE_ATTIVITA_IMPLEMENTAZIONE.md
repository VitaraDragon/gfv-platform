# Tony – Compilazione Form Attività: Implementazione Completa

**Documento di riferimento tecnico per sviluppatori.**  
Descrive il flusso end-to-end della compilazione guidata del form attività tramite Tony, i file coinvolti, le responsabilità di ciascuno e come **replicare/estendere** la soluzione ad altri form nell'app.

**Stato: funzionante al 100% (Febbraio 2026).** Tutti i fix descritti sono implementati e testati.

---

## 1. Panoramica

### Cosa funziona oggi (Febbraio 2026)

L'utente sulla **pagina Attività** (`attivita-standalone.html`) con il **modal attività aperto** può dire:
- *"Ho trinciato nel Sangiovese"*
- *"Segna erpicatura nel campo Cumbarazza, oggi dalle 7 alle 12"*
- *"Ho usato l'Agrifull e la trincia per la trinciatura tra le file"* (macchina, attrezzo, ore macchina auto-compilate)
- *"Dalle 7 alle 18, 60 minuti di pausa"* (orari + pause sempre richieste)

Tony (Gemini) estrae intento e dati, restituisce un blocco JSON strutturato con `formData`, e il sistema **inietta** automaticamente i valori rispettando:
- Ordine gerarchico (Categoria → Sottocategoria → Tipo Lavoro)
- Sottocategoria corretta (es. "Trinciatura tra le file" → "Tra le File", non "Generale")
- Dipendenze (es. attrezzi dopo macchina, ore macchina calcolate da orari)
- Derivation automatica di categoria/sottocategoria da tipo lavoro quando Gemini non le invia
- Eccezioni formSummary (pause=0 non considerato compilato, sottocategoria placeholder idem)

### Dove è attiva

- **Pagina:** `core/attivita-standalone.html`
- **Form:** `attivita-form` nel modal `attivita-modal`
- **Modulo Tony:** deve essere attivo (`moduli_attivi.includes('tony')`)

Le altre pagine (Terreni, Vigneto, Gestione Lavori, ecc.) usano Tony per chat e navigazione, ma **non** per compilazione strutturata di form.

---

## 2. Architettura: flusso end-to-end

```
┌─────────────────┐    ┌──────────────────────┐    ┌──────────────────┐
│ Utente scrive   │───►│ Tony Widget          │───►│ Tony Service     │
│ "Ho trinciato   │    │ getCurrentFormContext│    │ ask() / askStream│
│  nel Sangiovese"│    │ setContext('form',..)│    │                  │
└─────────────────┘    └──────────────────────┘    └────────┬─────────┘
                                                             │
                                                             ▼
┌─────────────────┐    ┌──────────────────────┐    ┌──────────────────┐
│ Form compilato  │◄───│ TonyFormInjector     │◄───│ Cloud Function   │
│ (attivita-form) │    │ injectAttivitaForm() │    │ tonyAsk          │
└─────────────────┘    └──────────────────────┘    └────────┬─────────┘
                                                             │
                                                             ▼
                                                    ┌──────────────────┐
                                                    │ Gemini API       │
                                                    │ (Treasure Map /  │
                                                    │ structured JSON) │
                                                    └──────────────────┘
```

### Sequenza dettagliata

1. **Utente** invia messaggio (chat o voce) sulla pagina Attività con modal aperto.
2. **Widget** (`tony-widget-standalone.js`):
   - Chiama `getCurrentFormContext()` per ottenere `formId`, `modalId`, `fields` (stato attuale)
   - Chiama `Tony.setContext('form', formCtx)` **prima** di `ask()`
   - Passa il contesto completo (form + attivita + moduli) alla Cloud Function
3. **Cloud Function** (`functions/index.js`):
   - Se `context.form.formId === 'attivita-form'` **e** modulo Tony attivo → usa `SYSTEM_INSTRUCTION_ATTIVITA_STRUCTURED`
   - Gemini risponde con blocco \`\`\`json contenente `action`, `replyText`, `formData`
   - Estrae il blocco, converte in `{ command: { type: 'INJECT_FORM_DATA', formId, formData } }`
4. **Tony Service** → `triggerAction('INJECT_FORM_DATA', ...)`
5. **Widget** (callback `onAction`):
   - Se `formId === 'attivita-form'` → chiama `TonyFormInjector.injectAttivitaForm(formData, context)`
6. **TonyFormInjector** (`tony-form-injector.js`):
   - Auto-compila ore macchina se macchina/attrezzo presenti e orari disponibili
   - Se `formData['attivita-tipo-lavoro-gerarchico']` presente ma mancano categoria/sottocategoria → `deriveCategoriaFromTipo()`
   - Inietta i campi secondo `INJECTION_ORDER` con delay (categoria/sottocategoria 250ms, terreno 200ms, macchina 350ms, ecc.)
   - Post-iniezione: se ore macchina ancora vuota con macchina/attrezzo → calcola da orari DOM
   - Risolve nomi → ID tramite resolver (terreno, categoria, tipo lavoro, macchina, attrezzo)

---

## 3. File coinvolti e responsabilità

| File | Responsabilità |
|------|----------------|
| **core/attivita-standalone.html** | Pagina con modal `attivita-modal` e form `attivita-form`. Carica dati (terreni, tipi lavoro, categorie, macchine) in `window.attivitaState`. Passa contesto `attivita` con `terreni` (coltura_categoria), `colture_con_filari`, `tipi_che_richiedono_macchina`, ecc. |
| **core/js/tony-widget-standalone.js** | Widget UI (FAB, chat, dialog). `getCurrentFormContext()` estrae stato form dal modal attivo. `generateFormSummary()` con eccezioni per pause=0 e sottocategoria placeholder. `sendRequestWithContext()` chiama `setContext('form', formCtx)` prima di `ask()`. Gestisce `INJECT_FORM_DATA`, `OPEN_MODAL`, `SET_FIELD`, `SAVE_ACTIVITY`. |
| **core/js/tony-form-injector.js** | Iniezione campi nel form attività. `deriveCategoriaFromTipo()` con match specifico, override da nome tipo, non sovrascrivere se Gemini ha Tra le File/Sulla Fila. Auto-ore-macchina pre e post iniezione. `INJECTION_ORDER`, resolver, delay tra campi dipendenti. |
| **core/config/tony-form-mapping.js** | Configurazione "Treasure Map": `ATTIVITA_FORM_MAP`, schema. Riferimento per estensione. |
| **core/services/tony-service.js** | `ask()`, `askStream()`, `setContext()`, `triggerAction()`. Passa `context` (incl. `form`) alla Cloud Function. |
| **functions/index.js** | Cloud Function `tonyAsk`. System instruction con ECCEZIONE PAUSE, ECCEZIONE SOTTOCATEGORIA, ORE MACCHINA OBBLIGATORIE, regole sottocategoria da terreno. Estrae blocco \`\`\`json, emette `INJECT_FORM_DATA`. |
| **core/js/tony-smart-filler.js** | Usato per comandi `SET_FIELD` singoli (non per `INJECT_FORM_DATA`). |
| **core/js/attivita-events.js** | Eventi cambio categoria/sottocategoria per cascata dropdown. |

---

## 4. Dettagli implementativi

### 4.1 Contesto form per Gemini

La Cloud Function attiva la modalità structured **solo se**:
- `moduli_attivi.includes('tony')`
- `context.form.formId === 'attivita-form'` **oppure** `context.form.modalId === 'attivita-modal'`

Il widget **deve** chiamare `Tony.setContext('form', formCtx)` prima di `ask()`. `formCtx` viene da `getCurrentFormContext()`, che:
- Cerca il modal con classe `.modal.active`
- Estrae i campi del form (id, value, valueLabel, required, isVisible)
- Per SELECT: aggiunge `valueLabel` con il testo dell'opzione selezionata (legibile per Gemini)
- Genera `formSummary` tramite `generateFormSummary()` con **eccezioni**: `attivita-pause = 0` e sottocategoria placeholder NON marcano come compilato
- Restituisce `{ formId, modalId, fields, formSummary, submitId }`

### 4.2 Contesto attivita per Gemini (pagina)

La pagina deve passare a Tony (`setContext('attivita', ...)`) almeno:
- **terreni**: `[{ id, nome, coltura, coltura_categoria }]` — `coltura_categoria` da `mapColturaToCategoria` (Vite, Frutteto, Seminativo, ecc.)
- **colture_con_filari**: `['Vite', 'Frutteto', 'Olivo']` — per regole sottocategoria (mai "Generale" su terreni a filari)
- **tipi_che_richiedono_macchina**: array di nomi — derivato da `tipi_lavoro` con regex su nome (trinciat, erpicat, fresat, ecc.)
- **tipi_lavoro**: `[{ id, nome, categoriaId, sottocategoriaId }]` — per deduzione automatica
- **categorie_con_tipi**, **categorie_manuale_meccanico**, **macchine** — come già documentato

### 4.3 SYSTEM_INSTRUCTION_ATTIVITA_STRUCTURED (Cloud Function)

Regole principali:
- **ECCEZIONE PAUSE**: se formSummary mostra "Pause (minuti): 0" con ✓, NON considerarlo compilato; chiedere sempre "Quanti minuti di pausa hai fatto?"
- **ECCEZIONE SOTTOCATEGORIA**: se categoria in `categorie_manuale_meccanico` e sottocategoria placeholder → chiedere "Hai usato macchine?"
- **Sottocategoria da terreno**: se `terreno.coltura_categoria` in `colture_con_filari` → solo "Tra le File" o "Sulla Fila", mai "Generale"
- **ORE MACCHINA OBBLIGATORIE**: se macchina o attrezzo compilati → includere `attivita-ore-macchina` (default = ore nette da orari)
- **Categoria/sottocategoria obbligatorie** con tipo lavoro: cercare in `tipi_lavoro` e includere i nomi
- **Coltura**: non includere se si imposta solo il terreno; il form la precompila
- **formData**: usare sempre **nomi**, non ID

### 4.4 deriveCategoriaFromTipo (TonyFormInjector)

Se Gemini invia `attivita-tipo-lavoro-gerarchico` ma non categoria/sottocategoria, l'injector:
1. **Match più specifico**: `filter` + `sort` per nome più lungo — "Trinciatura tra le file" vince su "Trinciatura" (che ha sottocat Generale)
2. Legge `categoriaId` e `sottocategoriaId` dal tipo matched
3. Trova i nomi in `categorie_lavoro` e `sottocategorieLavoriMap`
4. **Override da nome**: se risultato "Generale" ma `tipoNome` contiene "tra le file" o "sulla fila" → usa "Tra le File" o "Sulla Fila"
5. **Non sovrascrivere**: se formData ha già "Tra le File" o "Sulla Fila" e derived è "Generale" → lasciare valore di Gemini

### 4.5 Ore macchina e formSummary

**Ore macchina** (tony-form-injector.js): (a) Pre-iniezione: se formData ha macchina/attrezzo ma ore-macchina vuota e ha orari+pause → calcola ore nette; (b) Post-iniezione: se nel DOM macchina/attrezzo selezionati ma ore-macchina vuota → legge orari, calcola, imposta.

**formSummary** (tony-widget-standalone.js): (a) `attivita-pause = 0` → NON marcare come compilato (no ✓); (b) `attivita-sottocategoria` con placeholder e value vuoto → NON marcare come compilato.

### 4.6 INJECTION_ORDER e delay

Ordine in `tony-form-injector.js`:
```
attivita-data, attivita-terreno, attivita-categoria-principale, attivita-sottocategoria,
attivita-tipo-lavoro-gerarchico, attivita-coltura-categoria, attivita-coltura-gerarchica,
attivita-orario-inizio, attivita-orario-fine, attivita-pause,
attivita-macchina, attivita-attrezzo, attivita-ore-macchina, attivita-note
```

Delay:
- Dopo `attivita-categoria-principale` / `attivita-sottocategoria`: 250 ms
- Dopo `attivita-terreno`: 200 ms
- Dopo `attivita-macchina`: 350 ms (per popolare dropdown attrezzi)
- Dopo `attivita-tipo-lavoro-gerarchico`: 150 ms
- Seconda passata sul tipo lavoro: 350 ms

### 4.7 Fallback: estrazione da risposta senza comando

Se la Cloud Function non restituisce `command` ma la risposta contiene un blocco \`\`\`json con `formData`, il widget: controlla `shouldTryExtract`, chiama `TonyFormInjector.extractAndInjectFromResponse()`.

### 4.8 showMessageInChat

Nel widget, `showMessageInChat(text, type)` per messaggi di errore e avviso modulo Tony non attivo.

---

## 5. Come estendere ad altri form (Gestione Lavori, raccolta frutta, vendemmia, ecc.)

### 5.1 Cosa implementare (checklist per ogni nuova pagina)

**Obbligatorio** (basato su quanto funziona per Attività):

1. **Contesto specifico** (pagina): `setContext('moduloX', { ... })` con dati necessari per deduzioni (equivalente di terreni, colture_con_filari, tipi_che_richiedono_macchina, ecc.)

2. **generateFormSummary eccezioni** (se applicabile): campi con valore default che devono essere esplicitamente confermati dall'utente → NON marcare come compilato

3. **Injector** (`tony-form-injector.js`): `injectNuovoForm(formData, context)` con:
   - Ordine iniezione rispettando dipendenze DOM
   - Delay adeguati dopo campi padre
   - Derivazione campi mancanti (se un campo deduce da un altro, come deriveCategoriaFromTipo)
   - Auto-compilazione campi calcolati (come ore macchina)
   - Regola "non sovrascrivere" quando Gemini invia valore esplicito corretto e la derivazione restituirebbe valore sbagliato

4. **Cloud Function** (`functions/index.js`): system instruction strutturata con:
   - Eccezioni formSummary per campi default/placeholder
   - Regole deduttive basate sui dati (non casi hardcoded)
   - Ordine domande coerente con gerarchia form

5. **Widget** (`tony-widget-standalone.js`): case `INJECT_FORM_DATA` per `formId` nuovo, `shouldTryExtract` esteso

### 5.2 Pattern condiviso

- **Nomi nel formData**: Gemini invia sempre nomi leggibili; i resolver li mappano agli ID
- **Ordine iniezione**: prima i padri (dropdown che abilitano i figli), poi i figli, con delay
- **Derivazione**: se un campo può essere dedotto da un altro, implementarla nell'injector come fallback
- **Match specifico**: nei resolver/derivation, preferire match esatto o più lungo per evitare falsi positivi

### 5.3 Moduli prioritari (da GUIDA_TONY_OPERATIVO)

- **Fase 2**: Gestione Lavori (switch, visibilità condizionale)
- **Fase 3**: Raccolta frutta, Vendemmia, altri form con struttura simile

---

## 6. Correzioni e modifiche (2026-02)

| Modifica | File | Descrizione |
|----------|------|-------------|
| ECCEZIONE PAUSE | functions/index.js, tony-widget | Pause=0 non considerato compilato; Gemini deve chiedere |
| ECCEZIONE SOTTOCATEGORIA | functions/index.js | Sottocategoria placeholder per categorie manuale/meccanico non considerata compilata |
| colture_con_filari, coltura_categoria | attivita-standalone.html | Contesto per regole sottocategoria (mai Generale su Vite/Frutteto/Olivo) |
| tipi_che_richiedono_macchina | attivita-standalone.html | Derivato da tipi_lavoro con regex |
| ORE MACCHINA OBBLIGATORIE | functions/index.js | Se macchina/attrezzo → includere ore-macchina (default ore nette) |
| deriveCategoriaFromTipo match specifico | tony-form-injector.js | filter+sort per nome più lungo |
| deriveCategoriaFromTipo override nome | tony-form-injector.js | Se "Generale" ma tipo contiene "tra le file" → "Tra le File" |
| deriveCategoriaFromTipo non sovrascrivere | tony-form-injector.js | Se formData ha "Tra le File"/"Sulla Fila" e derived "Generale" → tenere Gemini |
| Ore macchina auto-compilate | tony-form-injector.js | Pre-iniezione da formData, post-iniezione da DOM |
| formSummary isPauseDefault, isSottocategoriaPlaceholder | tony-widget-standalone.js | Non marcare come compilato |

---

## 7. Test manuali

1. Aprire `attivita-standalone.html`, modulo Tony attivo.
2. Aprire il modal attività.
3. *"Ho trinciato nel Sangiovese"* → terreno, categoria, sottocategoria "Tra le File", tipo "Trinciatura tra le file"
4. *"Ho usato l'Agrifull e la trincia"* → macchina, attrezzo, ore macchina auto-compilate
5. *"Dalle 7 alle 18, 60 minuti di pausa"* → orari, pause (Tony deve chiedere le pause se non specificate)
6. Verificare che "Tra le File" non venga mai sovrascritta con "Generale"

---

## 8. Riferimenti

- **Flusso inverso**: `docs-sviluppo/TONY_FLUSSO_COMPILAZIONE_ATTIVITA_INVERSO.md`
- **Architettura operativa**: `docs-sviluppo/GUIDA_TONY_OPERATIVO_ARCHITETTURA_GLOBALE.md`
- **Separazione Guida/Operativo**: `docs-sviluppo/TONY_MODULO_SEPARATO.md`

---

*Ultimo aggiornamento: 2026-02-13*
