# Tony - Flusso Compilazione Attività Inverso

## 📋 Panoramica

Questo documento descrive il nuovo flusso di compilazione del form attività tramite Tony, dove l'utente parte dal **tipo di lavoro specifico** e il sistema deduce automaticamente la categoria principale, senza mai chiedere all'utente.

## 🎯 Obiettivo

Rendere l'interazione con Tony più naturale e intuitiva, riducendo il numero di domande necessarie per compilare un'attività. L'utente pensa al lavoro fatto (es. "ho erpicato"), non alla categoria astratta (es. "Lavorazione del Terreno").

---

## 🔄 Flusso Attuale vs Nuovo Flusso

### Flusso Attuale (Top-Down)
1. Tony chiede: "Qual è la categoria principale?" → Utente: "Lavorazione del Terreno"
2. Tony chiede: "Qual è la sottocategoria?" → Utente: "Tra le File"
3. Tony chiede: "Qual è il tipo di lavoro specifico?" → Utente: "Erpicatura Tra le File"

**Problemi:**
- L'utente deve conoscere la struttura gerarchica
- Troppe domande intermedie
- Non naturale (l'utente pensa al lavoro fatto, non alla categoria)

### Nuovo Flusso (Bottom-Up)
1. Utente dice: "Oggi ho fatto erpicatura"
2. Sistema deduce automaticamente:
   - Categoria principale: "Lavorazione del Terreno" (da `categoriaId` del tipo lavoro)
   - Sottocategoria: Preseleziona in base al terreno (Vite/Frutteto → "Tra le File", Seminativo → "Generale")
3. Se necessario, Tony chiede: "Dove hai erpicato? Tra le file o generale?" (solo se ambiguità)

**Vantaggi:**
- Più naturale e intuitivo
- Meno domande
- Preselezione intelligente
- L'utente pensa al lavoro concreto, non alla struttura astratta

---

## 🏗️ Architettura Dati

### Struttura Tipo Lavoro

Ogni tipo lavoro nel database ha:
- `nome` (string, obbligatorio) - Es. "Erpicatura", "Trinciatura", "Fresatura Tra le File"
- `categoriaId` (string, obbligatorio) - ID categoria principale (es. "Lavorazione del Terreno")
- `sottocategoriaId` (string, opzionale) - ID sottocategoria (es. "Tra le File", "Generale")

**Esempio:**
```javascript
{
  id: "xbVKKjK8TXmcPR9F5ScY",
  nome: "Erpicatura Tra le File",
  categoriaId: "e5wU8VZZcruA0MUUd9nM", // "Lavorazione del Terreno"
  sottocategoriaId: "wA2YsAlz9NzLPSwPCNml" // "Tra le File"
}
```

### Struttura Terreno

Ogni terreno ha:
- `coltura` (string, opzionale) - Es. "Vite", "Frutteto", "Seminativo", "Olivo"

**Nota:** Un terreno ha sempre una sola coltura principale.

---

## 🧠 Logica di Deduzione Automatica

### 1. Ricerca Tipo Lavoro

Quando l'utente dice un tipo di lavoro (es. "erpicatura", "ho trinciato"):

1. **Ricerca fuzzy nel database** dei tipi lavoro:
   - Cerca per nome (case-insensitive, partial match)
   - **Estrazione verbo:** "ho erpicato" → "Erpicatura" (conversione verbo → sostantivo)
   - **Mappa alias/sinonimi:** Usa una mappa di alias per migliorare il matching
     ```javascript
     const verbiAlias = {
       "trinciato": "Trinciatura",
       "erpicato": "Erpicatura",
       "fresato": "Fresatura",
       "potato": "Potatura",
       "raccolto": "Raccolta",
       "trattato": "Trattamenti"
     };
     ```
   - Esempi di match:
     - "erpicatura" → "Erpicatura", "Erpicatura Tra le File", "Erpicatura Sulla Fila"
     - "trinciatura" → "Trinciatura", "Trinciatura Tra le File"
     - "ho trinciato" → "Trinciatura" (via mappa alias)

2. **Se trovato un solo match univoco:**
   - Usa quel tipo lavoro
   - Legge `categoriaId` → imposta categoria principale automaticamente
   - Legge `sottocategoriaId` se presente → imposta sottocategoria automaticamente

3. **Se trovati più match:**
   - **Usa preselezione basata sul terreno** (vedi punto 2)
   - **Sii trasparente:** Tony deve dire esplicitamente cosa sta facendo e dare all'utente la possibilità di correggere
   - Esempio: "Ok, imposto Erpicatura Tra le File (visto che siamo nel Vigneto). Se invece era sulla fila, dimmelo!"
   - Se preselezione non disponibile → mostra opzioni: "Intendi Erpicatura Tra le File, Erpicatura Sulla Fila, o Erpicatura Generale?"

4. **Se non trovato:**
   - Tony chiede: "Non ho capito quale tipo di lavoro. Puoi essere più specifico?"
   - Oppure: "Intendi erpicatura, fresatura, trinciatura, o altro?"

### 2. Preselezione Sottocategoria Basata sul Terreno

**Regole di preselezione:**

| Coltura Terreno | Tipo Lavoro | Sottocategoria Preselezionata |
|----------------|--------------|-------------------------------|
| Vite, Frutteto | Erpicatura, Trinciatura, Fresatura, Ripasso | "Tra le File" |
| Vite, Frutteto | Altri tipi lavoro | "Tra le File" (se disponibile) |
| Seminativo | Qualsiasi | "Generale" |
| Olivo | Qualsiasi | "Generale" (o "Tra le File" se disponibile) |
| Altro | Qualsiasi | Nessuna preselezione (chiedere) |

**Logica:**
- Se terreno ha coltura = "Vite" o "Frutteto" → preseleziona "Tra le File" per lavori tra le file
- Se terreno ha coltura = "Seminativo" → preseleziona "Generale"
- Se il tipo lavoro ha già una `sottocategoriaId` specifica → usa quella (ha priorità)

### 3. Quando Chiedere la Sottocategoria

La sottocategoria viene chiesta **solo se**:
- Il tipo lavoro può appartenere a più sottocategorie (es. "Erpicatura" può essere "Generale", "Tra le File", "Sulla Fila")
- La preselezione basata sul terreno non è univoca
- Il tipo lavoro non ha una `sottocategoriaId` predefinita

**Esempi:**
- Utente: "Ho erpicato" + Terreno: Vite → Preseleziona "Tra le File" → **NON chiede**
- Utente: "Ho erpicato" + Terreno: Seminativo → Preseleziona "Generale" → **NON chiede**
- Utente: "Ho erpicato" + Terreno: Non specificato → **CHIEDE**: "Dove hai erpicato? Tra le file, sulla fila, o generale?"

---

## 💬 Esempi di Conversazione

### Esempio 1: Flusso Completo (Vigneto)

**Utente:** "Voglio segnare le ore di oggi"

**Tony:** "Bene! Su quale terreno hai lavorato?"

**Utente:** "Sangiovese Casetti"

**Tony:** "Ok, Sangiovese Casetti. Quale lavoro hai fatto oggi?"

**Utente:** "Ho erpicato tra le file"

**Tony:** *(Deduce automaticamente: tipo lavoro "Erpicatura Tra le File" → categoria "Lavorazione del Terreno" → sottocategoria "Tra le File" già presente)*

"Perfetto! Ho impostato Erpicatura Tra le File. Qual è la data di oggi?"

**Utente:** "Oggi è il 9 febbraio 2026"

**Tony:** "Ok, data 9 febbraio 2026. A che ora hai iniziato?"

**Utente:** "Ho iniziato alle 7:00"

**Tony:** "Ok, inizio alle 7:00. A che ora hai finito?"

**Utente:** "Ho finito alle 18:00"

**Tony:** "Ok, fine alle 18:00. Quanti minuti di pausa hai fatto?"

**Utente:** "60 minuti"

**Tony:** "Perfetto! Vuoi salvare l'attività?"

**Utente:** "Sì"

**Tony:** *(Salva l'attività)* "Fatto! Attività salvata."

---

### Esempio 2: Preselezione Automatica (Frutteto)

**Utente:** "Ho trinciato"

**Tony:** "Su quale terreno?"

**Utente:** "Kaki" *(terreno con coltura "Frutteto")*

**Tony:** *(Deduce: "Trinciatura" → categoria "Gestione del Verde" → preseleziona "Tra le File" perché terreno è Frutteto)*

"Ok, ho impostato Trinciatura Tra le File. Qual è la data?"

**Utente:** "Oggi"

**Tony:** "Ok, data di oggi. A che ora hai iniziato?"

---

### Esempio 3: Chiedere Sottocategoria (Terreno Non Specificato)

**Utente:** "Ho fatto erpicatura"

**Tony:** "Su quale terreno?"

**Utente:** "Seminativo"

**Tony:** *(Deduce: "Erpicatura" → categoria "Lavorazione del Terreno" → preseleziona "Generale" perché terreno è Seminativo)*

"Ok, ho impostato Erpicatura Generale. Qual è la data?"

---

### Esempio 4: Ambiguità con Trasparenza (Più Tipi Lavoro Simili)

**Utente:** "Ho erpicato"

**Tony:** "Su quale terreno?"

**Utente:** "Sangiovese Casetti" *(terreno con coltura "Vite")*

**Tony:** *(Trova più match: "Erpicatura", "Erpicatura Tra le File", "Erpicatura Sulla Fila" → usa preselezione "Tra le File" per terreno Vite)*

"Ok, imposto Erpicatura Tra le File (visto che siamo nel Vigneto). Se invece era sulla fila, dimmelo! Qual è la data?"

**Utente:** "No, era sulla fila"

**Tony:** "Ok, correggo: Erpicatura Sulla Fila. Qual è la data?"

---

**Alternativa (se utente non corregge):**

**Tony:** "Ok, imposto Erpicatura Tra le File (visto che siamo nel Vigneto). Se invece era sulla fila, dimmelo! Qual è la data?"

**Utente:** "Oggi è il 9 febbraio" *(non corregge, quindi conferma la preselezione)*

**Tony:** *(Procede con "Erpicatura Tra le File")*

---

### Esempio 5: Tipo Lavoro Non Riconosciuto

**Utente:** "Ho fatto la cosa con la macchina"

**Tony:** "Non ho capito quale tipo di lavoro. Puoi essere più specifico? Intendi erpicatura, fresatura, trinciatura, o altro?"

**Utente:** "Erpicatura"

**Tony:** *(Procede con deduzione automatica)*

---

## 🔧 Implementazione Tecnica

### Stato implementazione (2026-02-10)

**Flusso attualmente in uso:** Treasure Map / INJECT_FORM_DATA (non SET_FIELD singoli).

- **Form Attività**: Cloud Function con `context.form.formId === 'attivita-form'` usa `SYSTEM_INSTRUCTION_ATTIVITA_STRUCTURED`. TonyFormInjector `injectAttivitaForm()` inietta i campi secondo `INJECTION_ORDER` con `deriveCategoriaFromTipo()` come fallback.
- **Form Lavori** (2026-02-16): `context.form.formId === 'lavoro-form'` usa `SYSTEM_INSTRUCTION_LAVORO_STRUCTURED`. TonyFormInjector `injectLavoroForm()` compila sottocategoria, tipo, macchine, stato. Rif. `TONY_COMPILAZIONE_LAVORI_2026-02.md`.
- **SmartFormFiller**: usato solo per comandi `SET_FIELD` singoli su tipo-lavoro (path alternativo, non il principale).

Dettagli: `docs-sviluppo/TONY_COMPILAZIONE_ATTIVITA_IMPLEMENTAZIONE.md`, `docs-sviluppo/TONY_COMPILAZIONE_LAVORI_2026-02.md`.

### Componenti Coinvolti

1. **Tony Service (`tony-service.js`)**
   - Gestisce la conversazione con Gemini
   - Passa il contesto del form a Gemini (incluso `context.form` impostato dal widget prima di `ask()`)
   - Riceve e processa le risposte

2. **Tony Widget (`tony-widget-standalone.js`)**
   - Gestisce l'interfaccia utente
   - `getCurrentFormContext()` + `sendRequestWithContext()` → `setContext('form', formCtx)` prima di `ask()`
   - Esegue `INJECT_FORM_DATA` (attivita-form) e `SET_FIELD` (con SmartFormFiller per tipo-lavoro)

3. **Tony Form Injector (`tony-form-injector.js`)**
   - `injectAttivitaForm()`, `deriveCategoriaFromTipo()`, `INJECTION_ORDER`, delay per cascata

4. **Attività Events (`attivita-events.js`)**
   - Gestisce eventi cambio categoria/sottocategoria
   - Preserva valori quando cambiano dropdown dipendenti

### Modifiche Necessarie

#### 1. Modifica System Instructions per Gemini

Aggiungere nelle system instructions di Tony:

```
Quando l'utente dice un tipo di lavoro specifico (es. "erpicatura", "ho trinciato"):
1. Cerca il tipo lavoro nel contesto fornito (campo "tipi_lavoro")
2. Se trovato un match univoco:
   - Usa quel tipo lavoro
   - NON chiedere mai la categoria principale (viene dedotta automaticamente)
   - Se il tipo lavoro ha una sottocategoria predefinita, usala
   - Se il terreno ha coltura "Vite" o "Frutteto", preseleziona sottocategoria "Tra le File"
   - Se il terreno ha coltura "Seminativo", preseleziona sottocategoria "Generale"
   - Chiedi la sottocategoria SOLO se ci sono più opzioni valide e non c'è preselezione univoca
3. Se trovati più match:
   - Mostra le opzioni all'utente per chiarire
4. Se non trovato:
   - Chiedi chiarimenti all'utente
```

#### 2. Modifica Logica SET_FIELD per Tipo Lavoro (Smart SET_FIELD)

Quando Tony imposta il campo `attivita-tipo-lavoro-gerarchico`:

1. **Cerca il tipo lavoro** nel database/context usando il nome fornito (con mappa alias/sinonimi)
2. **Se trovato:**
   - Imposta `attivita-tipo-lavoro-gerarchico` con il valore trovato
   - **Sincronizzazione automatica dropdown:**
     - Legge `categoriaId` → imposta automaticamente `attivita-categoria-principale`
     - Legge `sottocategoriaId` se presente → imposta automaticamente `attivita-sottocategoria`
     - Se `sottocategoriaId` non presente ma terreno ha coltura Vite/Frutteto → preseleziona "Tra le File"
     - Se `sottocategoriaId` non presente ma terreno ha coltura Seminativo → preseleziona "Generale"
   - **Assicurarsi che i dropdown siano sincronizzati:** Attivare eventi `change` per triggerare il ricaricamento dei dropdown dipendenti

3. **Se non trovato o ambiguo:**
   - Chiedi chiarimenti all'utente

**Nota importante:** La sincronizzazione deve avvenire in modo atomico o in rapida successione per evitare che il DOM non sia ancora pronto quando si tenta di impostare i valori dipendenti.

#### 3. Modifica Logica di Preselezione

Aggiungere funzione helper per preselezione sottocategoria:

```javascript
function getPreselectedSottocategoria(tipoLavoro, terreno) {
  // Se tipo lavoro ha già sottocategoria predefinita, usala
  if (tipoLavoro.sottocategoriaId) {
    return tipoLavoro.sottocategoriaId;
  }
  
  // Preselezione basata su terreno
  const coltura = terreno?.coltura?.toLowerCase() || '';
  
  if (coltura === 'vite' || coltura === 'frutteto') {
    // Per lavori tra le file, preseleziona "Tra le File"
    const lavoriTraLeFile = ['erpicatura', 'trinciatura', 'fresatura', 'ripasso'];
    if (lavoriTraLeFile.some(l => tipoLavoro.nome.toLowerCase().includes(l))) {
      return 'wA2YsAlz9NzLPSwPCNml'; // ID "Tra le File"
    }
  }
  
  if (coltura === 'seminativo') {
    return 'JH5pupkKSiuxzmfghkaj'; // ID "Generale"
  }
  
  return null; // Nessuna preselezione
}
```

#### 4. Modifica Context Passato a Gemini (Context Enrichment)

Nel context passato a Gemini, includere **tutti i dati necessari** per la deduzione automatica:

```javascript
{
  "attivita": {
    "terreni": [
      {
        "id": "...",
        "nome": "Sangiovese Casetti",
        "coltura": "Vite" // IMPORTANTE: includere coltura per preselezione
      }
    ],
    "tipi_lavoro": [
      {
        "id": "...",
        "nome": "Erpicatura Tra le File",
        "categoriaId": "...", // IMPORTANTE: per deduzione automatica categoria
        "sottocategoriaId": "..." // IMPORTANTE: per preselezione sottocategoria
      }
    ],
    "categorie_lavoro": [...],
    "sottocategorie_lavoro": [...],
    "verbi_alias": { // NUOVO: mappa alias verbi → tipi lavoro
      "trinciato": "Trinciatura",
      "erpicato": "Erpicatura",
      "fresato": "Fresatura",
      "potato": "Potatura",
      "raccolto": "Raccolta",
      "trattato": "Trattamenti"
    }
  }
}
```

**Modifiche necessarie in `tony-service.js`:**
- Includere `coltura` per ogni terreno nel context
- Includere `categoriaId` e `sottocategoriaId` per ogni elemento nell'array `tipi_lavoro`
- Includere mappa `verbi_alias` per migliorare il matching

---

## 📝 Regole di Business

### 1. Categoria Principale
- **MAI** chiedere all'utente
- Sempre dedotta automaticamente da `categoriaId` del tipo lavoro selezionato
- Se tipo lavoro non trovato → chiedere chiarimenti sul tipo lavoro, non sulla categoria

### 2. Sottocategoria
- **Chiedere solo se necessario:**
  - Tipo lavoro può appartenere a più sottocategorie
  - Nessuna preselezione univoca disponibile
  - Terreno non specificato o coltura non riconosciuta

### 3. Preselezione
- **Priorità:**
  1. `sottocategoriaId` del tipo lavoro (se presente)
  2. Preselezione basata su terreno (Vite/Frutteto → "Tra le File", Seminativo → "Generale")
  3. Nessuna preselezione → chiedere all'utente

### 4. Ricerca Tipo Lavoro
- **Fuzzy matching:** cerca per nome (case-insensitive, partial match)
- **Estrazione verbo:** "ho erpicato" → "Erpicatura"
- **Mappa alias/sinonimi:** Usa una mappa predefinita di verbi → tipi lavoro per migliorare il matching
  - Esempi: "trinciato" → "Trinciatura", "erpicato" → "Erpicatura", "fresato" → "Fresatura"
  - La mappa deve essere inclusa nel context passato a Gemini

### 5. Trasparenza nell'Ambiguità
- Quando Tony preseleziona una sottocategoria basata sul terreno, **deve essere esplicito**
- Formato: "Ok, imposto [Tipo Lavoro] [Sottocategoria] (visto che siamo nel [Coltura]). Se invece era [altra opzione], dimmelo!"
- Questo crea fiducia nell'utente e gli permette di correggere facilmente se necessario
- Se l'utente non corregge, procede con la preselezione

---

## 🧪 Casi di Test

### Test 1: Tipo Lavoro con Sottocategoria Predefinita
- **Input:** "Ho fatto Erpicatura Tra le File"
- **Terreno:** Qualsiasi
- **Atteso:** Categoria "Lavorazione del Terreno" impostata automaticamente, sottocategoria "Tra le File" impostata automaticamente

### Test 2: Tipo Lavoro Generico + Terreno Vite
- **Input:** "Ho erpicato"
- **Terreno:** "Sangiovese Casetti" (coltura: "Vite")
- **Atteso:** Categoria "Lavorazione del Terreno" impostata automaticamente, sottocategoria "Tra le File" preselezionata automaticamente

### Test 3: Tipo Lavoro Generico + Terreno Seminativo
- **Input:** "Ho erpicato"
- **Terreno:** "Seminativo" (coltura: "Seminativo")
- **Atteso:** Categoria "Lavorazione del Terreno" impostata automaticamente, sottocategoria "Generale" preselezionata automaticamente

### Test 4: Tipo Lavoro Ambiguo con Trasparenza
- **Input:** "Ho erpicato"
- **Terreno:** "Sangiovese Casetti" (coltura: "Vite")
- **Atteso:** 
  - Categoria "Lavorazione del Terreno" impostata automaticamente
  - Sottocategoria "Tra le File" preselezionata automaticamente
  - Tony dice: "Ok, imposto Erpicatura Tra le File (visto che siamo nel Vigneto). Se invece era sulla fila, dimmelo!"
  - Se utente corregge → aggiorna sottocategoria
  - Se utente non corregge → procede con preselezione

### Test 4b: Tipo Lavoro Ambiguo senza Terreno
- **Input:** "Ho erpicato"
- **Terreno:** Non specificato
- **Atteso:** Categoria "Lavorazione del Terreno" impostata automaticamente, Tony chiede: "Dove hai erpicato? Tra le file, sulla fila, o generale?"

### Test 5: Tipo Lavoro Non Riconosciuto
- **Input:** "Ho fatto la cosa con la macchina"
- **Atteso:** Tony chiede: "Non ho capito quale tipo di lavoro. Puoi essere più specifico?"

---

## 🚀 Fasi di Implementazione

### Fase 1: Preparazione Dati
- ✅ Verificare che tutti i tipi lavoro abbiano `categoriaId`
- ✅ Verificare che i terreni abbiano campo `coltura` popolato
- ✅ Creare mappa preselezione coltura → sottocategoria

### Fase 2: Modifica System Instructions
- Modificare system instructions di Tony per includere nuovo flusso
- Aggiungere esempi di conversazione nel nuovo formato

### Fase 3: Modifica Logica SET_FIELD (Smart SET_FIELD)
- Implementare ricerca tipo lavoro per nome (con mappa alias/sinonimi)
- Implementare deduzione automatica categoria
- Implementare preselezione sottocategoria
- **Implementare sincronizzazione automatica dropdown:** Quando si imposta tipo lavoro, triggerare automaticamente il cambio di categoria e sottocategoria corrispondenti
- Assicurarsi che i dropdown siano sincronizzati (attivare eventi `change` per ricaricare dropdown dipendenti)

### Fase 4: Modifica Context (Context Enrichment)
- Includere `coltura` nei dati terreno passati a Gemini
- Includere `categoriaId` e `sottocategoriaId` nei dati tipi lavoro
- Creare e includere mappa `verbi_alias` per migliorare il matching verbi → tipi lavoro
- Modificare `tony-service.js` per arricchire il context con tutti i dati necessari

### Fase 5: Testing
- Testare tutti i casi di test sopra
- Testare con utenti reali
- Raccogliere feedback e iterare

---

## 📚 Riferimenti

- **Modello TipoLavoro:** `core/models/TipoLavoro.js`
- **Modello Terreno:** `core/models/Terreno.js`
- **Tony Service:** `core/services/tony-service.js`
- **Tony Widget:** `core/js/tony-widget-standalone.js`
- **Attività Controller:** `core/js/attivita-controller.js`
- **Attività Events:** `core/js/attivita-events.js`

---

## 🔄 Compatibilità Retroattiva

Il nuovo flusso è **completamente retrocompatibile**:
- Gli utenti possono ancora usare il flusso vecchio (categoria → sottocategoria → tipo lavoro)
- Il form HTML funziona ancora normalmente
- Solo l'interazione vocale con Tony usa il nuovo flusso

---

## 📅 Note di Implementazione

- **Priorità:** Alta (migliora significativamente l'UX)
- **Complessità:** Media (richiede modifiche a più componenti)
- **Rischio:** Basso (retrocompatibile, fallback al flusso vecchio se necessario)

---

## 💡 Raccomandazioni di Gemini

Questo documento è stato arricchito con i suggerimenti di Gemini per migliorare l'implementazione:

### 1. Mappa Alias/Verbi
- **Problema:** L'estrazione dei verbi (es. "ho erpicato" → "Erpicatura") può essere migliorata
- **Soluzione:** Includere una mappa predefinita di alias verbi → tipi lavoro nel context passato a Gemini
- **Beneficio:** Matching più accurato e naturale

### 2. Trasparenza nell'Ambiguità
- **Problema:** Quando Tony preseleziona, l'utente potrebbe non capire perché
- **Soluzione:** Tony deve essere esplicito: "Ok, imposto Erpicatura Tra le File (visto che siamo nel Vigneto). Se invece era sulla fila, dimmelo!"
- **Beneficio:** Crea fiducia e permette correzioni facili

### 3. Sincronizzazione Dropdown
- **Problema:** Quando si imposta tipo lavoro, i dropdown categoria e sottocategoria devono essere sincronizzati
- **Soluzione:** Implementare sincronizzazione automatica che triggera eventi `change` per ricaricare dropdown dipendenti
- **Beneficio:** Evita problemi di sincronizzazione DOM

### 4. Context Enrichment
- **Problema:** Gemini ha bisogno di tutti i dati per dedurre correttamente
- **Soluzione:** Arricchire il context con `coltura` (terreni), `categoriaId`/`sottocategoriaId` (tipi lavoro), e mappa `verbi_alias`
- **Beneficio:** Deduzione più accurata e meno errori

---

**Ultima modifica:** 2026-02-09
**Autore:** Documentazione per implementazione flusso inverso compilazione attività
**Arricchito con:** Suggerimenti di Gemini per migliorare matching, trasparenza e sincronizzazione
