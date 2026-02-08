# Tony – Cose da implementare (post-conversazione Gemini)

*Documento generato il 2026-02-05 in base alla conversazione con Gemini su voce, velocità e qualità di Tony. Aggiornato il 2026-02-06 con le implementazioni completate.*

---

## ✅ Implementato (2026-02-06)

Tutti gli interventi prioritari sono stati implementati:

### 1. Pulizia testo per TTS
- **Funzione** `pulisciTestoPerVoce(testo)` in `tony-widget-standalone.js`
- Rimuove: emoji, markdown (`**`, `*`, `_`), blocchi JSON `{...}`, virgolette `"` `«` `»`, parole "asterisco"/"virgolette"
- Applicata prima di `speechSynthesis.speak()` quando la risposta arriva da voce

### 2. Streaming risposta
- **Metodo** `Tony.askStream(userPrompt, { onChunk })` in `tony-service.js`
- Usa `generateContentStream` quando SDK Firebase AI è disponibile
- Fallback su `ask()` quando si usa la Cloud Function callable (nessuno streaming)
- Widget mostra il testo in tempo reale man mano che arrivano i chunk

### 3. TTS cloud (getTonyAudio) – 2026-02-07
- **Cloud Function** `getTonyAudio`: Google Cloud Text-to-Speech, voce **it-IT-Wavenet-D** (maschile, profonda)
- **Parametri**: `pitch: -3.0`, `speakingRate: 0.95`, MP3
- **Nessun fallback** su Web Speech API (rimosso)

### 4. System Instruction ottimizzata per voce
- **TONO E VOCABOLARIO**: verbi attivi, colloquiali ("Dagli un'occhiata", "Ecco fatto!"), interiezioni ("Bene, allora...")
- **FORMATO OUTPUT VOCALE**: testo puro, niente markdown, niente virgolette; "più" invece di +, "percento" invece di %
- **PAUSE E PUNTEGGIATURA**: virgola, punto, punti di sospensione, punto interrogativo/esclamativo per timing TTS
- **MEMORIA VOCALE**: se l'utente risponde "Sì", "Vai", "Ok apri", Tony guarda l'ultimo messaggio per capire il contesto

### 5. Strato voce (Push-to-Talk)
- Pulsante microfono: tieni premuto per parlare
- Card di conferma: "Hai detto: «...»" con [Annulla] [Invia]
- TTS dopo conferma quando `opts.fromVoice === true`

### File modificati
- `core/js/tony-widget-standalone.js` – pulisciTestoPerVoce, speakWithTTS, voice selection, askStream, streaming UI
- `core/services/tony-service.js` – askStream, system instruction compressa e ottimizzata per voce
- `functions/index.js` – system instruction allineata

---

## ✅ Aggiornamenti 2026-02-06 (miglioramenti chirurgici)

Rifinitura basata su suggerimenti per latenza e esperienza vocale:

### 1. Modello gemini-2.0-flash
- Sostituito `gemini-2.5-flash` con `gemini-2.0-flash` per tempo di risposta più basso e maggiore stabilità

### 2. Pulizia testo per TTS (pulisciTestoPerVoce) migliorata
- `\{[\s\S]*?\}` – blocchi JSON completi anche multilinea
- Simboli markdown residui: `#` `*` `>` `_` `~` backtick
- `(\w+)-(\w+)` → `$1 $2` – es. "it-IT" → "it IT" (evita che il TTS legga il trattino)

### 3. JSON nascosto durante streaming
- Funzione `nascondiJsonDaStreaming()` nel widget: l'UI non mostra blocchi `{...}` mentre arrivano i chunk
- L'utente vede solo testo pulito in tempo reale

### 4. Guida app solo al primo messaggio
- `_getContextForPrompt()` in tony-service: esclude `guida_app` quando `chatHistory.length > 0`
- Riduce token e latenza sui messaggi successivi (Gemini ricorda la guida nella conversazione)

### 5. TTS rate 0.98
- `u.rate = 0.98` – voce più calma e autorevole

---

## Riepilogo priorità (originale)

| # | Intervento | Priorità | Costo | Impatto |
|---|------------|----------|-------|---------|
| 1 | Pulizia testo per TTS | Alta | 0 | Voce non legge emoji/JSON |
| 2 | Streaming risposta | Alta | 0 | Percezione velocità +50–70% |
| 3 | TTS migliorato (voce, rate, stop overlap) | Media | 0 | Voce meno metallica |
| 4 | System Instruction compressa | Media | 0 | Time to First Token ridotto |
| 5 | Google Cloud TTS (voci Neurali) | Opzionale | 1M char/mese free | Voce quasi umana |

---

## 1. Pulizia testo per TTS

**Problema:** La sintesi vocale legge letteralmente emoji (es. "segno di spunta verde"), markdown (`*grassetto*`) e blocchi JSON (`{ "action": "APRI_PAGINA" }`).

**Soluzione:** Funzione `pulisciTestoPerVoce(testo)` da applicare al testo **prima** di passarlo a `speechSynthesis.speak()`.

**Regex da usare:**
- Rimuovere emoji: `[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]`
- Rimuovere grassetto Markdown: `\*(.*?)\*` → `$1`
- Rimuovere blocchi JSON/azioni: `\{.*?\}` (o usare la logica già presente in `_parseAndTriggerActions`)

**Nota streaming:** Con lo streaming il testo arriva a pezzi. La pulizia va fatta sul **testo completo finale** prima del TTS, non sui singoli chunk (altrimenti si rischia di leggere parentesi graffe isolate).

**File:** `core/js/tony-widget-standalone.js` – aggiungere la funzione e usarla prima di `speechSynthesis.speak()`.

---

## 2. Streaming risposta Gemini

**Problema:** Tony aspetta la risposta completa prima di mostrarla → percezione di lentezza.

**Soluzione:** Usare `generateContentStream` (Firebase AI SDK client-side) invece di `generateContent`.

**Architettura:**
- **SDK client-side (Firebase AI):** Supporta `generateContentStream` → usare per lo streaming.
- **Cloud Function Callable:** Non supporta streaming (richiesta/risposta singola). Usare solo come fallback quando l’SDK non è disponibile.

**Flusso:**
1. Widget chiama `Tony.askStream(text)` se disponibile.
2. Il service emette chunk via callback: `onChunk(textChunk)`.
3. Il widget sostituisce "Sto pensando..." con un messaggio che si aggiorna man mano.
4. Al termine, si ottiene il testo completo per TTS e per la history.

**Loading progressivo:** Mostrare "..." o puntini animati; appena arriva il primo chunk, sostituire con il testo in tempo reale.

**File:**
- `core/services/tony-service.js` – aggiungere `askStream(userPrompt, { onChunk })`.
- `core/js/tony-widget-standalone.js` – usare `askStream` quando disponibile, altrimenti `ask`.

---

## 3. TTS migliorato (Web Speech API)

**Problema:** Voce metallica, legge virgole in modo innaturale, due voci si sovrappongono se l’utente invia una nuova domanda mentre Tony parla.

**Soluzioni:**

### 3.1 Stop overlap
All’inizio di ogni nuova domanda: `window.speechSynthesis.cancel()` per interrompere l’audio in corso.

### 3.2 Voce migliore
Preferire voci Google o Natural (Chrome):
```javascript
let voices = window.speechSynthesis.getVoices();
let tonyVoice = voices.find(v => v.lang === 'it-IT' && v.name.includes('Google'))
             || voices.find(v => v.lang === 'it-IT' && v.name.includes('Natural'))
             || voices.find(v => v.lang.startsWith('it'));
```
Le voci arrivano in modo asincrono: usare `speechSynthesis.onvoiceschanged` o un polling iniziale.

### 3.3 Parametri
- `rate: 0.9` – un po’ più lento, meno metallico
- `pitch: 0.9` – tono leggermente più basso

**File:** `core/js/tony-widget-standalone.js` – modificare il blocco TTS in `sendMessage`.

---

## 4. System Instruction compressa

**Problema:** Istruzioni lunghe aumentano il Time to First Token.

**Soluzione:** Versione sintetica e imperativa (da Gemini):

```
Ruolo: Tony, Capocantiere GFV Platform. Tono: Pratico, cordiale, breve.
Regole:
1. Usa SOLO JSON [CONTESTO_AZIENDALE]. No invenzioni.
2. Info mancanti? Indica il modulo corretto.
3. Domande "Come fare": Spiega passi -> Chiedi "Aprire pagina?" -> Includi { "action": "APRI_PAGINA" } SOLO dopo conferma utente ("sì", "apri").
4. Richieste esplicite ("Vai a..."): Includi subito { "action": "APRI_PAGINA", "params": {"target": "..."} }.
5. Navigazione: target estesi (dashboard, validazione ore, lavori caposquadra, statistiche manodopera, utenti, squadre, operai, compensi, macchine, prodotti, movimenti, vendemmia, potatura vigneto, trattamenti vigneto, calcolo materiali, raccolta frutta, clienti, preventivi, tariffe, ecc.).
6. Altre azioni (SEGNA_ORE, GUASTO): Conferma + JSON azione.
7. VOCE: No markdown, no emoji, usa punteggiatura marcata per pause naturali.
```

**Nota:** Mantenere il blocco `[CONTESTO_AZIENDALE]` con `{CONTESTO_PLACEHOLDER}`.

**File:** `core/services/tony-service.js` e `functions/index.js` – sostituire `SYSTEM_INSTRUCTION_BASE`.

---

## 5. Google Cloud Text-to-Speech – ✅ IMPLEMENTATO 2026-02-07

**Cloud Function `getTonyAudio`** (europe-west1):
- Input: `{ text: string }`. Richiede `request.auth`.
- Voce: **it-IT-Wavenet-D** (maschile, profonda). Alternative: it-IT-Wavenet-B, it-IT-Standard-B.
- Parametri: `pitch: -3.0`, `speakingRate: 0.95`, encoding MP3.
- Output: `{ audioContent: base64, voice: string }`.
- **Nota**: it-IT-Neural2-B non esiste nell'API (errore 500).

**Widget** (`tony-widget-standalone.js`): `speakWithTTS()` chiama getTonyAudio; nessun fallback su speechSynthesis; Tony parla per ogni risposta.

---

## Ordine di implementazione consigliato

1. **Pulizia testo** – rapida, nessuna dipendenza
2. **System Instruction compressa** – riduce latenza percepita
3. **TTS migliorato** – stop overlap + voce + rate/pitch
4. **Streaming** – richiede modifiche a service e widget
5. **TTS Cloud** – solo se necessario

---

## Riferimenti

- Conversazione Gemini (2026-02-05)
- `docs-sviluppo/GUIDA_SVILUPPO_TONY.md`
- `docs-sviluppo/TONY_FUNZIONI_E_SOLUZIONI_TECNICHE.md`
- Firebase AI: https://firebase.google.com/docs/ai-logic/stream-responses

---

## ✅ Aggiornamenti 2026-02-07 (modalità continua, persistenza, navigazione)

### Modalità dialogo continuo (hands-free)
- Toggle microfono: un click attiva/disattiva; invio automatico dopo fine parlato; microfono si riattiva dopo risposta Tony.
- Timeout inattività (20 s): spegnimento automatico; timer non parte mentre Tony parla.
- Congedo vocale: `checkFarewellIntent` ("grazie", "a posto così", ecc.) → `toggleAutoMode(false)`.
- Barge-in: clic microfono mentre Tony parla → interrompe e attiva ascolto.

### Persistenza sessione (sessionStorage)
- `saveTonyState()`: chatHistory, isAutoMode, lastPath, timestamp a ogni messaggio e `beforeunload`.
- `restoreTonyState()`: ripristino se sessione < 10 min; saluto contestuale su cambio pagina.
- Cache audio: riuso se testo identico (risparmio getTonyAudio).

### Navigazione migliorata
- Percorsi assoluti (`/core/terreni-standalone.html`).
- `resolveTarget`: alias, normalizzazione, fuzzy matching per varianti Gemini.

---

## Da fare (opzionale)

- **Google Cloud TTS** (voci Neurali): solo se le voci Web Speech non sono sufficienti. Cloud Function `getTonyAudio` + `@google-cloud/text-to-speech`.
