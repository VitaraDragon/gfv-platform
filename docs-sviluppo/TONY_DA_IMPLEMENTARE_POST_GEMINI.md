# Tony – Cose da implementare (post-conversazione Gemini)

*Documento generato il 2026-02-05 in base alla conversazione con Gemini su voce, velocità e qualità di Tony.*

---

## Riepilogo priorità

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
5. Navigazione limitata a: [terreni, attivita, lavori, magazzino, vigneto, frutteto, guasti, report, statistiche, amministrazione, abbonamento, impostazioni, conto terzi].
6. Altre azioni (SEGNA_ORE, GUASTO): Conferma + JSON azione.
7. VOCE: No markdown, no emoji, usa punteggiatura marcata per pause naturali.
```

**Nota:** Mantenere il blocco `[CONTESTO_AZIENDALE]` con `{CONTESTO_PLACEHOLDER}`.

**File:** `core/services/tony-service.js` e `functions/index.js` – sostituire `SYSTEM_INSTRUCTION_BASE`.

---

## 5. Google Cloud Text-to-Speech (opzionale)

**Quando:** Se le voci Web Speech non sono sufficienti.

**Vantaggi:**
- Voci Neurali (it-IT-Neural2-A, it-IT-Neural2-C) molto più naturali
- 1 milione di caratteri/mese gratuiti
- Nessuna API key aggiuntiva: le Functions usano il Service Account del progetto

**Prerequisiti:**
- Abilitare "Cloud Text-to-Speech API" in Google Cloud Console
- `npm install @google-cloud/text-to-speech` nella cartella `functions`

**Cloud Function proposta:** `getTonyAudio` – riceve `{ text }`, restituisce `{ audioContent: base64 }`.

**File:** `functions/index.js` – aggiungere la funzione; `tony-widget-standalone.js` – chiamarla al posto di `speechSynthesis.speak()` quando si vuole usare TTS cloud.

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
