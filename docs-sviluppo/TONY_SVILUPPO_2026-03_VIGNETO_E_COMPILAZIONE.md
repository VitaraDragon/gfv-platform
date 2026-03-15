# Tony – Sviluppo Marzo 2026: Vigneto, Compilazione Completa, Salvataggio

**Data**: 2026-03-02  
**Stato**: Implementato e testato  
**Riferimento**: `tony/MASTER_PLAN.md`

Documento per agenti e sviluppatori: traccia le modifiche effettuate per risolvere i problemi di sottocategoria vigneto/frutteto, perdita di compilazione e salvataggio non eseguito.

---

## 1. Problemi risolti

### 1.1 Sottocategoria "Generale" vs "Tra le File" (vigneto/frutteto)

**Sintomo**: Tony impostava "Generale" invece di "Tra le File" per lavorazioni meccaniche (trinciatura, erpicatura) in vigneti e frutteti. L'utente doveva correggere manualmente.

**Causa** (analisi Gemini):
- Race condition: Tony inviava SET_FIELD sottocategoria prima che il dropdown fosse popolato
- "Generale" veniva caricato come primo valore e bloccava l'override
- Conflitto tra SmartFormFiller, terreno change handler e injector

### 1.2 Perdita di compilazione (campi parziali)

**Sintomo**: Tony compilava solo terreno, categoria, sottocategoria, tipo e pause; mancavano orari, macchina, attrezzo, ore-macchina. L'utente doveva dire "riparti coi dati" per completare.

**Causa**:
- OPEN_MODAL con fields: il client espandeva in N comandi SET_FIELD sequenziali
- Race condition tra SET_FIELD e change handler dei dropdown
- CF non sempre includeva tutti i campi inferibili (es. "6 ore" → orari, ore-macchina)

### 1.3 Salvataggio non eseguito

**Sintomo**: Tony rispondeva "Attività salvata correttamente!" ma non cliccava sul bottone Salva.

**Causa**: Gemini restituiva solo testo senza blocco JSON `action: "save"`; il client non riceveva il comando SAVE_ACTIVITY.

---

## 2. Modifiche implementate

### 2.1 Config centralizzata (tony-form-mapping.js)

- **TERRENO_SOTTOCATEGORIA_PREFERENCE**: mapping `traLeFile` / `generale` per pattern coltura
- **getSottocategoriaPreferenceFromColtura(coltura)**: helper esportato, fonte unica
- Estensibile: nuovo tipo terreno → aggiungere pattern in config

### 2.2 SmartFormFiller (tony-smart-filler.js)

- `_getColturaToSottocategoriaPreference`: usa `TONY_FORM_MAPPING.getSottocategoriaPreferenceFromColtura` se disponibile
- Retry: se "Tra le File" non è nelle options, attesa 400ms e nuovo tentativo
- Fallback per label se ID non trovato

### 2.3 Injector (tony-form-injector.js)

- **DELAYS_ATTIVITA**: attivita-terreno 400ms (era 200), _secondPass_tipo_lavoro 400ms
- **waitForSelectOptions(selectId, minOptions)**: attende fino a 3s prima di iniettare attivita-sottocategoria
- **deriveCategoriaFromTipo**: usa `getSottocategoriaPreferenceFromColtura` dalla config
- Prima di attivita-sottocategoria: `await waitForSelectOptions('attivita-sottocategoria', 2)`

### 2.4 Client (main.js)

- **OPEN_MODAL + fields → INJECT_FORM_DATA atomico**: per attivita-modal e lavoro-modal, un solo INJECT_FORM_DATA invece di N SET_FIELD
- **checkTonyPendingAfterNav (openAndInject)**: stesso cambio per pending-after-nav
- **Fallback SAVE_ACTIVITY**: se testo contiene "salvata|salvato|confermato" e form completo ma nessun command → esegue SAVE_ACTIVITY
- **Priorità coda**: INJECT_FORM_DATA priority 18, delay 400ms

### 2.5 Cloud Function (functions/index.js)

- **OPEN_MODAL CHECKLIST**: quando utente dice "X ore" + lavoro + terreno, includere TUTTI i campi inferibili: data, orari, pause, ore-macchina, macchina, attrezzo
- **SALVATAGGIO (OBBLIGATORIO)**: quando utente dice "salva", "puoi salvare", ecc., DEVI rispondere con `action: "save"` nel blocco ```json
- **Context Builder**: terreni arricchiti con `coltura_categoria` (derivata da colture + categorie)
- **Esempi**: aggiornati con checklist completa e ordine campi

### 2.6 attivita-standalone.html (già presente)

- Listener cambio terreno: se vigneto/frutteto e sottocategoria Generale → imposta Tra le File.
- Non modificato in questa sessione: già funzionante.

---

## 3. File modificati

| File | Modifiche |
|------|-----------|
| `core/config/tony-form-mapping.js` | TERRENO_SOTTOCATEGORIA_PREFERENCE, getSottocategoriaPreferenceFromColtura |
| `core/js/tony-smart-filler.js` | Config-based preference, retry sottocategoria |
| `core/js/tony-form-injector.js` | waitForSelectOptions, delay terreno 400ms, derive da config, **override Generale su terreni con filari (2026-03-02)** |
| `core/js/tony/main.js` | OPEN_MODAL→INJECT_FORM_DATA, fallback SAVE_ACTIVITY (fix regex su domande 2026-03-02), priorità coda |
| `functions/index.js` | Checklist OPEN_MODAL, regola salvataggio, coltura_categoria terreni, **attivita.terreni, regola sottocategoria Frutteto (2026-03-02)** |
| `core/attivita-standalone.html` | **terreniList con coltura_categoria al cambio terreno (2026-03-02)** |

---

## 4. Flusso attuale (end-to-end)

### Scenario: "Ho trinciato 6 ore nel Sangiovese" (da Dashboard)

1. **CF** → OPEN_MODAL con fields completi (data, terreno, categoria, sottocategoria, tipo, orari, pause, ore-macchina, macchina, attrezzo)
2. **Client** → APRI_PAGINA attivita (se non sulla pagina), OPEN_MODAL attivita-modal
3. **checkTonyPendingAfterNav** → attende modal nel DOM, poi INJECT_FORM_DATA con tutti i campi
4. **Injector** → attende dropdown sottocategoria, inietta in ordine con delay
5. **Form completo** → utente dice "puoi salvare"
6. **CF** → action: "save" (o testo "Attività salvata correttamente!")
7. **Client** → SAVE_ACTIVITY (da command o fallback su testo)
8. **processTonyCommand** → clic submit, handleSaveAttivita, modal si chiude

### Scenario: "Perfetto puoi salvare" (form già compilato)

1. **CF** → risponde con action: "save" o solo testo "Attività salvata correttamente!"
2. **Client** → se command presente: SAVE_ACTIVITY; se assente ma testo match "salvata|salvato|confermato" e form completo: fallback SAVE_ACTIVITY
3. **Salvataggio** → eseguito

---

## 5. Principi rispettati (Master Plan)

- **No patch locali**: regole sottocategoria in config, non `if (formId === 'attivita')`
- **Configurazione > codice**: TERRENO_SOTTOCATEGORIA_PREFERENCE estensibile
- **Hook opzionali**: attività form ha logica specifica ma centralizzata (deriveCategoriaFromTipo, injector)
- **Scalabilità**: nuovo tipo terreno → aggiungere pattern in config

---

## 6. Riferimenti per agenti futuri

- **Master Plan**: `docs-sviluppo/tony/MASTER_PLAN.md`
- **Changelog**: `docs-sviluppo/COSA_ABBIAMO_FATTO.md` (sezione "Tony Form Attività: fallback SAVE_ACTIVITY, sottocategoria Frutteto" 2026-03-02)
- **Compilazione form**: `docs-sviluppo/TONY_COMPILAZIONE_ATTIVITA_IMPLEMENTAZIONE.md`
- **Guida sviluppo**: `docs-sviluppo/GUIDA_SVILUPPO_TONY.md`
- **Form mapping**: `core/config/tony-form-mapping.js` (TONY_FORM_MAPPING.getSottocategoriaPreferenceFromColtura)
- **Deploy**: frontend + `firebase deploy --only functions` per CF

---

## 7. Cosa non fare

- **Non hardcodare** "vigneto", "frutteto" in più punti: usare config
- **Non usare SET_FIELD** per OPEN_MODAL con fields su attivita/lavoro: usare INJECT_FORM_DATA
- **Non ignorare** il fallback SAVE_ACTIVITY: se Gemini non risponde con JSON, il testo "salvata" è sufficiente quando form completo

---

## 8. Fix regressioni (2026-03-02)

### 8.1 Fallback SAVE_ACTIVITY su domande

**Problema**: Il regex includeva "fatto" → "Quali orari hai fatto? Inizio e fine." attivava erroneamente SAVE_ACTIVITY.

**Fix** (`main.js`):
- Esclusione domande: se testo contiene `?` o inizia con "quali", "quante", "come", ecc. → no fallback
- Regex ristretta: `salvat[ao](?:\s|!|\.|$)|confermato!|ok salvo|perfetto salvo|attività salvata` (rimosso "fatto")

### 8.2 Sottocategoria "Generale" su Frutteto (injector)

**Problema**: Tony inviava "Generale" per Erpicatura su terreno Kaki (Frutteto); l'injector lo preservava come "esplicita utente".

**Fix** (`tony-form-injector.js`):
- Se `formData['attivita-sottocategoria']` è "Generale" e il terreno ha `coltura_categoria` in [Vite, Frutteto, Olivo, Arboreo, Alberi] → **override** con "Tra le File"
- Usa `attivitaState.terreniList` e `terreno.coltura_categoria`

### 8.3 Istruzioni CF (functions/index.js)

- **Regola critica**: Erpicatura/Trinciatura su terreno con coltura_categoria Vite/Frutteto/Olivo → SEMPRE "Tra le File", MAI "Generale". "Kaki è un frutteto → usa Tra le File"
- **Contesto attivita**: aggiunto `ctxFinal.attivita.terreni` e `ctxFinal.attivita.colture_con_filari = ["Vite","Frutteto","Olivo"]`
- **Eccezione**: se utente dice "generale" ma terreno ha filari → IGNORA e usa "Tra le File"

### 8.4 terreniList al cambio terreno (attivita-standalone.html)

**Problema**: Il listener `change` su attivita-terreno sovrascriveva `terreniList` con `terreni` senza `coltura_categoria`, impedendo all'injector di derivare la sottocategoria.

**Fix**: Nel listener, mappare terreni con `mapColturaToCategoria` per preservare `coltura_categoria`.
