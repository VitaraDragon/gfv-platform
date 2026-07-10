# Analisi Subagent e Integrazione Master Plan

**Data**: 2026-02-28  
**Obiettivo**: Censire i subagent, capire meccanismo di attivazione, integrazione con SmartFormFiller e stato della persistenza cross-page. Proporre allineamento al Master Plan per evitare SET_FIELD a vuoto.

---

## 1. Censimento Subagent

### 1.1 Definizioni nel codice

**Posizione**: `functions/index.js` (righe 413–490)

| Subagent | Costante | Attivazione | Contenuto |
|----------|----------|-------------|-----------|
| **Vignaiolo** | `SUBAGENT_VIGNAIOLO` | `pagePath` contiene `/vigneto/` | Personalità esperto viticoltura; target nav: vendemmia, potatura, trattamenti, statistiche vigneto, calcolo materiali, pianificazione impianto |
| **Logistico** | `SUBAGENT_LOGISTICO` | `pagePath` contiene `/magazzino/` | Personalità esperto scorte; target nav: prodotti, movimenti, magazzino |
| **Meccanico** | `SUBAGENT_MECCANICO` | `pagePath` contiene `/macchine/` o `macchine`/`mezzi` | Personalità responsabile officina; INJECT_FORM_DATA per `segnala-guasto-form` e `macchina-form`; gravità guasti; regole SmartValidator mezzi |

### 1.2 Subagent NON presenti

- **Attività / Diario**: nessun subagent dedicato → gestito da SYSTEM_INSTRUCTION_ADVANCED base
- **Lavori**: nessun subagent → gestito da ADVANCED
- **Terreni**: nessun subagent → gestito da ADVANCED
- **Frutteto**: nessun subagent

**Totale**: 3 subagent definiti, tutti basati su `pagePath`.

---

## 2. Meccanismo di attivazione

### 2.1 Router basato su `pagePath`

**Logica** (functions/index.js, righe 548–567):

```javascript
const pagePath = (ctx.page && ctx.page.pagePath) ? String(ctx.page.pagePath) : "";
const isMacchineContext = pagePath.includes("/macchine/") || pagePath.includes("macchine") || pagePath.includes("mezzi")
  || (pageTitle && /mezzi|macchine|parco\s*macchine|gestione\s*mezzi/i.test(pageTitle));

if (pagePath.includes("/vigneto/"))  extraBlocks += SUBAGENT_VIGNAIOLO;
if (pagePath.includes("/magazzino/")) extraBlocks += SUBAGENT_LOGISTICO;
if (isMacchineContext)                extraBlocks += SUBAGENT_MECCANICO;
```

- **Criterio**: solo `pagePath` (e `pageTitle` per macchine).
- **Non c’è**: routing su intento utente; nessuna logica che tenga conto di `tony_pending_intent` o del fatto che si stia navigando per aprire un modal.

### 2.2 Limiti

1. **Subagent per modulo, non per intento**: se l’utente è su Dashboard e chiede “aggiungi prodotto” o “segnala guasto”, non c’è subagent attivo (Dashboard non contiene `/vigneto/`, `/magazzino/`, `/macchine/`).
2. **Nessun “subagent in attesa”**: dopo navigazione con `tony_pending_intent` (Fase 2), la nuova pagina carica con `pagePath` corretto, ma i subagent non ricevono info sull’intento appena eseguito.
3. **Possibili conflitti**: su una pagina tipo `/modules/vigneto/magazzino-vigneto/` il path può contenere sia `vigneto` che `magazzino`; la logica attuale attiva entrambi i blocchi.

---

## 3. Integrazione con SmartFormFiller / Tony Form Injector

### 3.1 SmartFormFiller (tony-smart-filler.js)

- **Ruolo**: esegue `SET_FIELD` “intelligente” per campi gerarchici (es. `attivita-tipo-lavoro-gerarchico`).
- **Delega da main.js**: quando `SET_FIELD` arriva per `attivita-tipo-lavoro-gerarchico`, viene passato a SmartFormFiller invece che alla logica standard.
- **Condizione**: il modal deve essere già aperto e i dropdown popolati; se il modal non è pronto, il comando fallisce o dà risultati errati.
- **Subagent**: né Vignaiolo né Logistico né Meccanico parlano di SmartFormFiller; è una responsabilità del client (main.js).

### 3.2 Tony Form Injector (tony-form-injector.js)

- **Supporto**: `injectAttivitaForm`, `injectLavoroForm`. Non `injectTerrenoForm` (si usa `OPEN_MODAL` + `fields`).
- **INJECT_FORM_DATA in main.js**: supporta solo `attivita-form` e `lavoro-form`.
- **Subagent Meccanico**: invita a usare `INJECT_FORM_DATA` per `segnala-guasto-form` e `macchina-form`, ma il client non le gestisce → `formId non supportato`.

### 3.3 Situazione

| Form | Subagent che lo cita | Injector | main.js INJECT | SET_FIELD |
|------|----------------------|----------|----------------|-----------|
| attivita-form | Nessuno (base ADVANCED) | injectAttivitaForm | ✅ | ✅ + SmartFormFiller |
| lavoro-form | Nessuno | injectLavoroForm | ✅ | ✅ |
| terreno-form | Nessuno | - | - | ✅ via OPEN_MODAL+fields |
| segnala-guasto-form | Meccanico | - | ❌ | - |
| macchina-form | Meccanico | - | ❌ | - |

Quindi i subagent non sono connessi al meccanismo di compilazione form: le istruzioni del Meccanico non hanno implementazione sul client.

---

## 4. Stato della “memoria” e Fase 2

### 4.1 `tony_pending_intent` (Fase 2)

- **Implementato**: salvataggio in sessionStorage al fallback APRI_PAGINA quando il modal non esiste.
- **Recupero**: `checkTonyPendingAfterNav()` su nuova pagina legge l’intento, apre il modal e applica i campi.
- **Subagent**: non partecipano a questo flusso. Non sanno che c’è stato un intento pendente né che il modal è stato aperto “a distanza”.

### 4.2 Flusso attuale

1. Utente su Dashboard: “ho trinciato 6 ore”.
2. Tony (ADVANCED base, nessun subagent) risponde con `OPEN_MODAL attivita-modal` + fields.
3. Client: modal assente → fallback APRI_PAGINA + salva in `tony_pending_intent` → navigazione.
4. Pagina attività: `checkTonyPendingAfterNav()` → apre modal e compila campi.
5. La successiva domanda utente va a tonyAsk con `pagePath` = attività. Non c’è subagent attivo; il form è aperto, ma il contesto non indica che l’apertura è avvenuta tramite pending intent.

### 4.3 Gaps

- I subagent non ricevono né aggiornano `tony_pending_intent`.
- Non c’è segnalazione al modello: “il form è stato appena aperto da un intento pendente, attendi che sia pronto prima di emettere SET_FIELD”.

---

## 5. Problema “SET_FIELD a vuoto”

### 5.1 Cosa succede

Tony emette `SET_FIELD` (singoli o in sequenza) quando:

1. Il modal non è ancora aperto (es. risposta con `OPEN_MODAL` + `SET_FIELD`).
2. I dropdown non sono popolati (SmartFormFiller non trova le opzioni).
3. La pagina non è quella del form (cross-page).

In questi casi i comandi vanno in coda, vengono eseguiti “a vuoto” e compaiono errori in console.

### 5.2 Cause strutturali

1. **Nessuna guard “form pronto”**: il client esegue subito SET_FIELD senza controllare che il modal sia aperto e i dropdown pronti.
2. **Ordine e timing**: anche con `_WAIT_MODAL_READY` i ritardi possono non essere sufficienti.
3. **Cross-page**: fino alla Fase 2, i SET_FIELD venivano emessi sulla pagina sbagliata; con `tony_pending_intent` il problema è mitigato, ma non eliminato (es. race tra apertura modal e iniezione campi).

---

## 6. Proposta di integrazione nel Master Plan

### 6.1 Principi

1. **Delega allo specialista solo quando il contesto è pronto**: non emettere SET_FIELD/INJECT se il form non è aperto o non è sulla pagina giusta.
2. **Subagent = specialista di modulo**: usare subagent per vocabolario, target e regole di validazione; non come router di comandi che il client non supporta.
3. **Unificare persistenza e readiness**: `tony_pending_intent` + segnale esplicito “form pronto” per evitare comandi a vuoto.

### 6.2 Modifiche suggerite

#### A) System prompt – “Non SET_FIELD prima che il form sia pronto”

Aggiungere regola:

```
REGOLA FORM PRONTO (anti-SET_FIELD a vuoto):
- Prima di emettere SET_FIELD o INJECT_FORM_DATA, verifica [CONTESTO].form:
  - Se form.formId è assente o form.fields è vuoto/undefined → il form NON è aperto.
  - In quel caso: emetti SOLO OPEN_MODAL con id del modal appropriato (e opzionali fields).
  - NON emettere SET_FIELD nella stessa risposta se il form non è già aperto.
- Eccezione ENTRY POINT DA OVUNQUE: da pagina dove il modal non esiste, usa OPEN_MODAL con fields; il client gestirà navigazione e persistenza.
- Aspetta la risposta dell'utente dopo OPEN_MODAL: al turno successivo, se form.formId è presente, puoi emettere SET_FIELD.
```

#### B) Client – Guard “form pronto” prima di eseguire SET_FIELD

In `processTonyCommand`, per `SET_FIELD`:

- Controllare che il modal del form esista nel DOM e sia aperto (es. classe `active` o equivalente).
- Se non pronto: rinviare in coda (con backoff) oppure ignorare e loggare, invece di eseguire a vuoto.

#### C) Estendere INJECT_FORM_DATA ai form del Meccanico

- Aggiungere in main.js il supporto per `segnala-guasto-form` e `macchina-form` (o equivalenti).
- Creare `injectSegnalaGuastoForm` e `injectMacchinaForm` nel Form Injector (o un handler generico basato su mapping).
- Allineare così le istruzioni del subagent Meccanico alle capacità reali del client.

#### D) Subagent e `tony_pending_intent`

- Opzionale: includere nel contesto inviato a tonyAsk un flag `session.tonyJustResumedPendingIntent` (true per il primo messaggio dopo `checkTonyPendingAfterNav`).
- Il modello può usarlo per sapere che il form è stato appena aperto e deve attendere conferma/pronto prima di emettere nuovi SET_FIELD.

#### E) Subagent Operativo (opzionale)

- Creare un “Subagent Operativo” attivo quando `pagePath` contiene `attivita` o `lavori` (o quando `form.formId === 'attivita-form'`).
- Competenze: compilazione attività/lavori, ordine campi, SmartValidator.
- Serve a ridurre il carico sull’ADVANCED base e a centralizzare le regole operative.

### 6.3 Schema aggiornato

```
                    ┌─────────────────────────────────────┐
                    │         Context Builder              │
                    │  + form.formId (se modal aperto)     │
                    │  + session.tonyJustResumedPending    │
                    └─────────────────┬───────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                               │
        ▼                             ▼                               ▼
┌───────────────┐           ┌─────────────────┐           ┌─────────────────┐
│ Router        │           │ Subagent        │           │ Regola           │
│ (pagePath)    │           │ Vignaiolo/       │           │ FORM PRONTO      │
│ → subagent    │           │ Logistico/       │           │ → no SET_FIELD   │
│ attivi        │           │ Meccanico        │           │ se form non aperto│
└───────────────┘           └─────────────────┘           └─────────────────┘
        │                             │                               │
        └─────────────────────────────┼─────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │   tonyAsk                             │
                    │   + OPEN_MODAL con fields se cross-page│
                    │   + SET_FIELD solo se form pronto     │
                    └─────────────────────────────────────┘
```

---

## 7. Riepilogo azioni prioritarie

| # | Azione | File | Priorità |
|---|--------|------|----------|
| 1 | Regola “FORM PRONTO” nel system prompt | functions/index.js | Alta |
| 2 | Guard form pronto prima di eseguire SET_FIELD | core/js/tony/main.js | Alta |
| 3 | Estendere INJECT_FORM_DATA a segnala-guasto-form, macchina-form | main.js + tony-form-injector.js | Media |
| 4 | Subagent Operativo per attività/lavori | functions/index.js | Media |
| 5 | Flag `tonyJustResumedPendingIntent` nel contesto | main.js | Bassa |

---

## 8. Riferimenti

- `docs-sviluppo/tony/MASTER_PLAN.md` (ex MASTER_PLAN_TONY_UNIVERSAL, archiviato)
- `functions/index.js` (SUBAGENT_*, tonyAsk)
- `core/js/tony/main.js` (processTonyCommand, checkTonyPendingAfterNav)
- `core/js/tony-form-injector.js`
- `core/js/tony-smart-filler.js`
