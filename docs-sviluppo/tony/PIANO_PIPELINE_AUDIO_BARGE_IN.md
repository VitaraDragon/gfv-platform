# Piano — Pipeline audio Tony, barge-in e preparazione al chunking TTS

**Data:** 2026-06-07  
**Stato:** 📋 Da implementare (Step 1 non ancora in codice)  
**Priorità:** Alta — prerequisito per chunking TTS per frase e UX vocale in campo  
**Audience:** agenti Cursor / sviluppatori che continuano il lavoro senza perdere il filo

---

## 1. Perché questo documento

Abbiamo consultato Gemini con `docs-sviluppo/TONY_ALTERNATIVE_SVILUPPO_PER_GEMINI.md` e analizzato il codice reale. **Conclusione condivisa:**

- L’architettura Tony (binari A/B/C, `tony-form-mapping`, Context Builder) è solida.
- La **pipeline vocale** ha una coda serializzata ma un **barge-in incompleto**: ferma l’audio corrente, **non** svuota la coda né invalida TTS/prefetch in volo → rischio **“effetto eco”** quando si passa al **chunking per frase**.
- Con le **Firebase Callable** (`getTonyAudio`) non esiste un abort di rete affidabile: serve **cancel logico** via **generation token**.

**Questo piano descrive Step 1 (obbligatorio prima del chunking).** Step 2 (chunking SSE) è solo accennato in fondo.

---

## 2. Stato attuale verificato sul codice (2026-06-07)

### 2.1 File coinvolti

| File | Ruolo |
|------|--------|
| `core/js/tony/voice.js` | Coda TTS, `speakWithTTS`, `prefetchTonyTTS`, `playOneTTS`, pulizia testo |
| `core/js/tony/main.js` | STT (Web Speech), barge-in, invio messaggi, stream risposta, chiamata TTS |
| `functions/index.js` | CF `getTonyAudio` (Google TTS Wavenet-D, MP3 base64) |
| `core/services/tony-service.js` | `ask` / `askStream`, system instruction formato vocale |

### 2.2 Cosa funziona oggi

- **`window.__tonyAudioQueue`**: array FIFO; `processNextAudio()` riproduce **un clip alla volta** (`window.__tonyIsSpeaking`).
- **`speakWithTTS(text)`**: push in coda → `processNextAudio()`.
- **`prefetchTonyTTS(text)`**: warm cache `lastTTSCache` chiamando `getTonyAudio` in background (best-effort).
- **`window.currentTonyAudio`**: elemento `Audio()` in riproduzione.
- **Cache testo identico**: se stesso testo pulito, riusa MP3 senza seconda CF.
- **Barge-in parziale** (`main.js`):
  - click microfono → `pause()` + reset `currentTonyAudio`;
  - `recognition.onspeechstart` → stessa pausa;
  - `recognition.onresult` → **ignora** input se Tony sta ancora parlando.
- **`opts.forceInterrupt`** in `playOneTTS`: definito ma **mai usato** da nessun chiamante.
- **Prefetch al termine risposta** (`main.js` ~6807): `prefetchTonyTTS(out)` poi `speakWithTTS(out)`.

### 2.3 Lacune (confermate — non implementare chunking finché non risolte)

| Lacuna | Rischio |
|--------|---------|
| Coda **non svuotata** al barge-in | Clip accodate ripartono dopo interruzione |
| Prefetch / `getTonyAudio` in volo **non invalidati** | Audio “fantasma” al completamento |
| `__tonyIsSpeaking` può restare incoerente dopo solo `pause()` | Coda bloccata o comportamento errato |
| Nessun **generation token** | Impossibile scartare callback stale in modo uniforme |
| Risposta intera in un solo TTS | Latenza percepita alta (chunking = Step 2) |

---

## 3. Decisioni architetturali (accordate con review Gemini + analisi repo)

### 3.1 Generation token (cancel logico)

- Variabile globale: **`window.__tonyGeneration`** (intero, parte da 0).
- Ogni operazione TTS (coda item, prefetch, play callback) porta **`gen`** catturato al momento dell’accodamento o dell’avvio fetch.
- Prima di **accodare**, **riprodurre** o **aggiornare cache** da prefetch:  
  `if (gen !== window.__tonyGeneration) return;` (drop silenzioso, no play).
- **Non** usare AbortController sulle Callable Firebase come strategia primaria (fetch REST non è il path attuale).

### 3.2 Quando incrementare la generation

**Regola:** un bump invalida tutto il lavoro audio del turno precedente.

| Evento | Azione | `bumpGeneration` |
|--------|--------|------------------|
| Utente invia **nuovo messaggio** (testo o voce) | `clearTonyAudioPipeline({ reason, bump: true })` all’**inizio** di `sendMessage` | ✅ sì |
| **Barge-in** (click mic mentre Tony parla, o `onspeechstart`) | `clearTonyAudioPipeline({ reason: 'barge-in', bump: true })` — equivale a interrompere turno Tony per nuovo input | ✅ sì |
| **Chiusura pannello** chat (X) | `clearTonyAudioPipeline({ reason: 'panel-close', bump: false })` | ❌ no (solo stop) |
| **Disattivazione modalità continua** / congedo vocale | flush senza bump (salvo nuovo messaggio subito dopo) | ❌ no |
| **Cambio pagina** (opzionale Step 1b) | flush `bump: false` su navigazione se widget resta montato | ❌ no |

**Attenzione:** evitare **doppio bump** (es. barge-in che chiama clear con bump e poi sendMessage bump di nuovo nello stesso tick). Pattern consigliato:

- `sendMessage` fa sempre bump **una volta** all’ingresso.
- Barge-in che porta a invio vocale: o bump in barge-in **oppure** in sendMessage, non entrambi — preferenza: **solo in `sendMessage`**; barge-in fa flush **senza bump** + stop audio, poi sendMessage bumpa.

### 3.3 API unica: `clearTonyAudioPipeline(options)`

**Posizione:** `core/js/tony/voice.js`, esposta da `initTonyVoice` e su `window.__tonyClearAudioPipeline` per debug.

```javascript
/**
 * @param {{ bump?: boolean, reason?: string }} [options]
 * bump: true → incrementa __tonyGeneration (invalida TTS/prefetch in volo)
 */
function clearTonyAudioPipeline(options) {
  options = options || {};
  if (options.bump) window.__tonyGeneration = (window.__tonyGeneration || 0) + 1;

  window.__tonyAudioQueue = [];
  window.__tonyIsSpeaking = false;

  if (window.speechSynthesis) window.speechSynthesis.cancel();

  if (window.currentTonyAudio) {
    try {
      window.currentTonyAudio.pause();
      window.currentTonyAudio.currentTime = 0;
      window.currentTonyAudio.src = '';
    } catch (_) {}
    window.currentTonyAudio = null;
  }

  // Opzionale: window.__tonyPlayOnInteractionScheduled = false;
  if (typeof console !== 'undefined' && console.debug) {
    console.debug('[Tony] clearTonyAudioPipeline', options.reason || '', 'gen', window.__tonyGeneration);
  }
}
```

**Alias accettato:** `abortAllTonyAudio` = stesso entry point (nome usato in chat Gemini).

### 3.4 Modifiche a `speakWithTTS` / `playOneTTS` / `prefetchTonyTTS`

1. **`speakWithTTS(text, opts)`**
   - Cattura `var gen = window.__tonyGeneration || 0`.
   - Push `{ text, opts, gen }` in coda (non solo text/opts).
   - In `processNextAudio`: se `item.gen !== window.__tonyGeneration`, scarta e passa al successivo.

2. **`playOneTTS(text, opts, onDone)`**
   - Accetta `opts.gen` o parametro `gen` separato.
   - Dopo await `getTonyAudio` e prima di `play()`: ricontrolla generation.
   - In `onended` / `onerror` / `onDone`: ricontrolla generation prima di `processNextAudio()`.

3. **`prefetchTonyTTS(text)`**
   - Cattura `gen` all’avvio.
   - Dopo risposta CF: aggiorna `lastTTSCache` **solo se** `gen === window.__tonyGeneration`.

4. **`forceInterrupt`**
   - Deprecare uso diretto; `playOneTTS` con forceInterrupt può chiamare `clearTonyAudioPipeline({ bump: false })` all’inizio del play forzato, oppure rimuovere ramo se ridondante.

### 3.5 Modifiche a `main.js` (punti di aggancio)

| Punzione / evento | Modifica |
|-------------------|----------|
| **`sendMessage(text, opts)`** — prima riga utile | `clearTonyAudioPipeline({ bump: true, reason: 'new-message' })` **oppure** solo `generation++` se barge-in ha già flushato senza bump — vedere §3.2 |
| **`micBtn` click** (Tony parla) | Sostituire blocco pause manuale con `clearTonyAudioPipeline({ bump: false, reason: 'barge-in-mic' })` poi riapri ascolto |
| **`recognition.onspeechstart`** | `clearTonyAudioPipeline({ bump: false, reason: 'barge-in-speech' })` |
| **Close pannello** (`closeBtn`) | Aggiungere `clearTonyAudioPipeline({ bump: false, reason: 'panel-close' })` |
| **`doDisplay` / fine stream** | Passare `gen` corrente del turno a `speakWithTTS` / prefetch (turno = generation catturata all’inizio sendMessage) |

**Turno utente:** salvare in closure o `window.__tonyTurnGeneration` all’inizio di `sendMessage`; usare quella per scartare risposte Gemini/stream se `__tonyTurnGeneration !== window.__tonyGeneration` (prepara Step 2 chunking).

---

## 4. Step 1 — Checklist implementazione

### 4.1 `voice.js`

- [ ] Inizializzare `window.__tonyGeneration = 0` in `initTonyVoice`.
- [ ] Implementare `clearTonyAudioPipeline`.
- [ ] Item coda con `{ text, opts, gen }`.
- [ ] Guard generation in `processNextAudio`, `playOneTTS`, `prefetchTonyTTS`.
- [ ] Esportare `{ speakWithTTS, prefetchTonyTTS, clearTonyAudioPipeline }`.
- [ ] Esporre `window.__tonyClearAudioPipeline` (alias).

### 4.2 `main.js`

- [ ] Import/uso `clearTonyAudioPipeline` da voiceApi.
- [ ] Wire barge-in (mic + onspeechstart) — rimuovere duplicati pause sparsi.
- [ ] Wire chiusura pannello.
- [ ] Bump generation all’inizio `sendMessage` (documentare scelta bump unico).
- [ ] (Opzionale Step 1b) listener navigazione / `beforeunload` flush.

### 4.3 Test manuali

1. Modalità continua: Tony parla → parla sopra → **nessun** audio residuo della frase precedente.
2. Tony parla → click mic → **coda vuota**, nessun secondo clip.
3. Chiusura pannello durante TTS → audio stop immediato.
4. Due messaggi rapidi: solo l’ultimo viene parlato.
5. Prefetch: messaggio A poi barge-in messaggio B → cache di A non deve far parlare A.
6. Console: log generation su clear (debug, non in prod se rumoroso → usare `console.debug`).

### 4.4 Test automatici (opzionale, consigliato)

- Unit test su guard generation (estrarre helper puri in `voice.js` se necessario).
- Non richiesto per merge Step 1 se test manuali documentati.

---

## 5. Step 2 — Chunking TTS per frase (DOPO Step 1)

**Non iniziare prima che Step 1 sia merged e testato.**

### 5.1 Obiettivo

- Durante `tonyAskStream` (SSE), non attendere risposta completa.
- Delimitare **frasi complete** (`.`, `?`, `!`, `…`, o soglia lunghezza) sui chunk testo.
- Per ogni frase: `prefetchTonyTTS(frase, gen)` + `speakWithTTS(frase, { gen })`.
- Stesso `gen` del turno; barge-in invalida tutte le frasi pendenti.

### 5.2 File aggiuntivi

- `core/js/tony/main.js` — parser chunk su stream.
- `core/services/tony-service.js` / `tony-sse-parse.js` — se serve buffer lato client.
- Eventualmente helper `core/js/tony/voice-chunking.js` (solo se logica > ~40 righe).

### 5.3 Riferimento performance

- `docs-sviluppo/tony/PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` §6.2 TTS decoupled.

---

## 6. Step 3+ — Backlog (non in scope Step 1)

| Voce | Note |
|------|------|
| Neural2 vs Wavenet-D | Test pronuncia termini agricoli prima di switch |
| STT cloud piano Avanzato | GDPR, costo; Web Speech + “ripeti?” resta default |
| Soft lock tap su save/delete | Estendere pattern dialog conferma navigazione |
| UX Campo vs Ufficio | Due modalità stesso widget |
| Min-instances CF | Cold start, non latenza Gemini binario C |
| `requestID` esplicito per chunk | Può coincidere con `__tonyTurnGeneration` |

---

## 7. Cosa NON fare in Step 1

- ❌ Chunking SSE frase-per-frase.
- ❌ Migrare `getTonyAudio` a REST solo per AbortController.
- ❌ Cambiare voce TTS / modello Gemini.
- ❌ Refactor `tony-widget-standalone.js` (è solo loader verso `main.js`).
- ❌ Logica per-pagina nel core Tony.

---

## 8. Documenti correlati

| Documento | Contenuto |
|-----------|-----------|
| `docs-sviluppo/TONY_ALTERNATIVE_SVILUPPO_PER_GEMINI.md` | Quadro alternative + domande a Gemini |
| `docs-sviluppo/TONY_DA_IMPLEMENTARE_POST_GEMINI.md` | Storico decisioni voce 2026-02 |
| `docs-sviluppo/TONY_FUNZIONI_E_SOLUZIONI_TECNICHE.md` | Sintesi funzionale |
| `docs-sviluppo/tony/PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` | Binari, TTS decoupled |
| `docs-sviluppo/tony/MASTER_PLAN.md` | Visione Tony |
| `docs-sviluppo/tony/STATO_ATTUALE.md` | Stato componenti (aggiornare dopo Step 1) |
| `tony-code-per-gemini.html` | Bundle codice (parzialmente datato pre-split `voice.js`) |

---

## 9. Dopo il merge — documentazione obbligatoria agenti Tony

Aggiornare **solo**:

1. `docs-sviluppo/COSA_ABBIAMO_FATTO.md` — voce con data e Step 1 completato.
2. `docs-sviluppo/tony/STATO_ATTUALE.md` — pipeline audio / barge-in.
3. `docs-sviluppo/tony/MASTER_PLAN.md` — solo se cambia stato fase voce.
4. `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` — generation token come decisione implementata.

Aggiornare **questo file** (`PIANO_PIPELINE_AUDIO_BARGE_IN.md`): sezione Stato → ✅ Step 1 completato + link commit/PR.

---

## 10. Prompt per agente che implementa Step 1

```
Leggi docs-sviluppo/tony/PIANO_PIPELINE_AUDIO_BARGE_IN.md.

Implementa SOLO Step 1 (§4):
- clearTonyAudioPipeline con generation token in core/js/tony/voice.js
- Guard gen su coda, playOneTTS, prefetchTonyTTS
- Wire main.js: sendMessage (bump), barge-in, chiusura pannello

Non implementare chunking SSE (Step 2).
Non modificare functions/getTonyAudio.
Test manuali §4.3.
Aggiorna i 4 file doc indicati in §9.
```

---

*Fine piano — v1.0 (2026-06-07)*
