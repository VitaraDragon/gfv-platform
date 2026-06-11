# Piano — Pipeline audio Tony, barge-in totale e generation token

**Data:** 2026-06-07  
**Stato:** ✅ **Fase 1 implementata** (2026-06-07) · ✅ **Fase 2 chunking TTS** (2026-06-09)  
**Priorità:** Alta — Fase 2 chiude latenza vocale percepita su stream SSE  
**Allineamento:** `MASTER_PLAN.md` (UX vocale campo), `PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` §6.2 (TTS decoupled)

---

## 1. Perché questo documento

Consultazione con Gemini (giugno 2026) su voce, latenza e barge-in. **Concordato:**

- L’architettura binari (A/B/C) + `tony-form-mapping` resta la spina dorsale.
- Il **rischio immediato** prima del chunking è la **“coda fantasma”** (eco: Tony continua a parlare risposte del turno precedente).
- Con **Firebase Callable** (`getTonyAudio`) **non** si usa `AbortController` HTTP nativo: si usa **cancel logico** via **generation token**.
- **Fase 1** = `clearTonyAudioPipeline()` + generation; **Fase 2** = chunking frase su SSE; resto (STT cloud, Neural2, min-instances) dopo.

Questo file è la **fonte unica** per implementare Fase 1 senza perdere il filo tra chat/agenti.

**Documenti correlati (solo lettura):**

| File | Ruolo |
|------|--------|
| `docs-sviluppo/TONY_ALTERNATIVE_SVILUPPO_PER_GEMINI.md` | Quadro alternative + domande a Gemini |
| `docs-sviluppo/TONY_DA_IMPLEMENTARE_POST_GEMINI.md` | Storico decisioni voce 2026-02 |
| `docs-sviluppo/TONY_FUNZIONI_E_SOLUZIONI_TECNICHE.md` | Sintesi funzionale Tony |
| `docs-sviluppo/tony/PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` | Performance, TTS parallelo, binari |

---

## 2. Problema (stato verificato sul codice)

### 2.1 Cosa funziona oggi

| Componente | File | Comportamento |
|------------|------|----------------|
| Coda serializzata | `core/js/tony/voice.js` | `window.__tonyAudioQueue` + `processNextAudio()` + `__tonyIsSpeaking` |
| TTS cloud | `functions/index.js` → `getTonyAudio` | Google TTS `it-IT-Wavenet-D`, MP3 base64 |
| Prefetch cache | `voice.js` → `prefetchTonyTTS` | Warm cache prima di `speakWithTTS` (chiamato da `main.js` in `doDisplay`) |
| Barge-in parziale | `core/js/tony/main.js` | Click mic + `recognition.onspeechstart` → `pause()` su `window.currentTonyAudio` |
| Blocco STT mentre Tony parla | `main.js` `onresult` | `if (currentTonyAudio && !paused) return` |

### 2.2 Lacune (bug / debito prima del chunking)

1. **Coda non svuotata** al barge-in → clip già in `__tonyAudioQueue` possono ripartire.
2. **Fetch `getTonyAudio` in volo** (play + prefetch) non invalidate → callback può fare play dopo interruzione.
3. **`__tonyIsSpeaking`** può restare incoerente se si fa solo `pause()` senza `onDone`.
4. **`forceInterrupt`** in `playOneTTS` esiste ma **nessun chiamante**.
5. **Chiusura pannello Tony** (`#tony-close`) non flusha audio/coda.
6. **Un blob TTS per risposta** — chunking non ancora presente (Fase 2).

### 2.3 Sintomo utente

Utente interrompe Tony a voce → Tony smette un attimo → **riparte** con la stessa risposta o con pezzi accodati prima dell’interruzione (“effetto eco”).

---

## 3. Obiettivi e non-obiettivi

### Fase 1 — Obiettivi (questo sprint)

- [x] Una funzione **`clearTonyAudioPipeline(options)`** — unico ingresso per stop audio.
- [x] **`window.__tonyGeneration`** (integer) — invalidazione logica di play/prefetch/callback stale.
- [x] Ogni item coda TTS porta **`gen`**; play/prefetch ignorano se `gen !== __tonyGeneration`.
- [x] Wiring barge-in, chiusura pannello, inizio turno utente.
- [x] Esporre API su `initTonyVoice` return + opzionale `window.__tonyClearAudioPipeline` per debug.
- [ ] Test manuali documentati (§8).

### Fase 1 — Non obiettivi (non fare in questo step)

- Chunking TTS per frase su `tonyAskStream` (Fase 2).
- Cambio voce Neural2 / STT cloud / min-instances CF.
- Soft lock tattile su save form (track separato).
- Modifiche a `getTonyAudio` lato server.
- Test automatici E2E (opzionale dopo; non bloccare Fase 1).

---

## 4. Design — Generation token

### 4.1 Variabile globale

```javascript
window.__tonyGeneration = 0; // init in voice.js initTonyVoice
```

- Intero monotonicamente crescente.
- **Non** resettare a 0 (overflow JS impratico).

### 4.2 Quando incrementare (regola obbligatoria)

| Evento | Incrementa generation? | Chiama clearPipeline? |
|--------|------------------------|------------------------|
| **Nuovo messaggio utente** (`sendMessage` con testo valido, non proactive) | ✅ Sì (`bump: true`) | ✅ Sì (flush + stop) |
| **Barge-in** (click mic mentre Tony parla; `onspeechstart` con audio attivo) | ✅ Sì | ✅ Sì |
| **Chiusura pannello** (`#tony-close`) | ❌ No (solo stop) | ✅ Sì (`bump: false`) |
| **Congedo vocale** / `toggleAutoMode(false)` | ❌ No | ✅ Sì (`bump: false`) — opzionale ma consigliato |
| **Cambio pagina** (navigazione full reload) | N/A | sessionStorage chat separato; opzionale hook futuro |
| **Risposta proactive** (`opts.proactive`) | ❌ No bump extra all’inizio | valutare se speak proactive deve rispettare gen esistente |

**Regola d’oro:** **un bump per turno utente**. `clearTonyAudioPipeline({ bump: true })` = incrementa + flush. `{ bump: false }` = solo flush (stessa generation → callback già in volo del turno *corrente* restano invalidate solo se bumpate prima).

**Nota implementativa:** all’inizio di `sendMessage` (dopo validazione testo non vuoto) chiamare:

```javascript
if (voiceApi.clearTonyAudioPipeline) voiceApi.clearTonyAudioPipeline({ bump: true, reason: 'user_turn' });
```

Il bump **prima** della richiesta Gemini invalida TTS/prefetch del turno precedente.

### 4.3 Item in coda

```javascript
// Prima
{ text, opts }

// Dopo
{ text, opts, gen: window.__tonyGeneration }
```

In `processNextAudio`: se `item.gen !== window.__tonyGeneration` → scarta e `processNextAudio()` (prossimo item).

### 4.4 Play e prefetch

Ogni invocazione async `getTonyAudio`:

1. Cattura `const genAtStart = window.__tonyGeneration` all’inizio.
2. Dopo await, **prima** di play o cache update:
   ```javascript
   if (genAtStart !== window.__tonyGeneration) return; // stale — no onDone che riaccoda
   ```
3. Stesso controllo prima di `audio.play()`.

**Prefetch:** se stale, non aggiornare `lastTTSCache`.

### 4.5 Callable Firebase — perché no AbortController

`httpsCallable('getTonyAudio')` non espone `AbortSignal`. La CF può completare; il client **scarta** il risultato. Accettabile: costo minimo vs complessità REST custom.

---

## 5. Design — `clearTonyAudioPipeline(options)`

### 5.1 Firma proposta

```javascript
/**
 * @param {{ bump?: boolean, reason?: string }} [options]
 * bump: true → __tonyGeneration++ (nuovo turno / barge-in che apre nuovo ascolto)
 * reason: log debug ('barge_in' | 'user_turn' | 'panel_close' | ...)
 */
function clearTonyAudioPipeline(options) {}
```

### 5.2 Azioni interne (ordine)

1. Se `options.bump === true` → `window.__tonyGeneration++`
2. `window.__tonyAudioQueue = []`
3. `window.__tonyIsSpeaking = false`
4. Stop audio:
   - `window.currentTonyAudio`: `pause()`, `currentTime = 0`, `src = ''`, `null`
   - `window.speechSynthesis.cancel()` se presente (legacy / sicurezza)
5. Opzionale: `window.__tonyPlayOnInteractionScheduled = false` (evitare replay deferred stale)
6. Log dev: `[Tony Voice] pipeline cleared`, reason, generation

### 5.3 Cosa NON fare in clear

- Non chiamare `onPlayEnd` / `reopenMicIfAutoMode` — l’interruzione è intenzionale; il chiamante (barge-in / sendMessage) gestisce il mic.
- Non cancellare `lastTTSCache` globale (può servire testo identico stesso turno); opzionale invalidare cache se `bump: true` — **decisione:** lasciare cache testo, play è già gated da `gen`.

### 5.4 Alias

`forceInterrupt` path in `playOneTTS` → delegare a `clearTonyAudioPipeline({ bump: false })` oppure rimuovere ramo duplicato.

---

## 6. Modifiche file — checklist agente

### 6.1 `core/js/tony/voice.js`

| # | Task |
|---|------|
| V1 | Init `window.__tonyGeneration = 0` in `initTonyVoice` |
| V2 | Implementare `clearTonyAudioPipeline(options)` |
| V3 | `speakWithTTS`: push `{ text, opts, gen: window.__tonyGeneration }` |
| V4 | `processNextAudio`: skip item stale `gen` |
| V5 | `playOneTTS`: `genAtStart` check post-fetch e pre-play; on stale → `onDone()` senza side effect |
| V6 | `prefetchTonyTTS`: `genAtStart` + skip cache update se stale |
| V7 | Return `{ speakWithTTS, prefetchTonyTTS, clearTonyAudioPipeline }` |
| V8 | Esporre `window.__tonyClearAudioPipeline = clearTonyAudioPipeline` (debug) |

### 6.2 `core/js/tony/main.js`

| # | Hook | Azione |
|---|------|--------|
| M1 | `sendMessage` — dopo `if (!text) return`, prima di append bubble | `clearTonyAudioPipeline({ bump: true, reason: 'user_turn' })` |
| M2 | `#tony-mic` click — ramo “Tony sta parlando” | sostituire solo pause con `clearTonyAudioPipeline({ bump: true, reason: 'barge_in_mic' })` poi `startListeningRef()` |
| M3 | `recognition.onspeechstart` | se audio attivo OR coda non vuota OR `__tonyIsSpeaking` → `clearTonyAudioPipeline({ bump: true, reason: 'barge_in_speech' })` |
| M4 | `#tony-close` click | `clearTonyAudioPipeline({ bump: false, reason: 'panel_close' })` (prima di toggleAutoMode) |
| M5 | `toggleAutoMode(false)` | opzionale `clearTonyAudioPipeline({ bump: false })` se si esce da hands-free mentre parla |
| M6 | Destrutturare `voiceApi`: `var clearTonyAudioPipeline = voiceApi.clearTonyAudioPipeline` |

**Attenzione `onresult`:** dopo Fase 1, valutare se rimuovere il guard `if (currentTonyAudio && !paused) return` — con bump su `onspeechstart` l’utente potrebbe già aver invalidato; tenere guard come sicurezza extra.

### 6.3 Nessuna modifica (Fase 1)

- `functions/index.js` (`getTonyAudio`)
- `core/services/tony-service.js` (stream Gemini)
- CSS widget

---

## 7. Fase 2 — Chunking TTS (dopo Fase 1)

**Prerequisito:** Fase 1 merged e testata.

### Obiettivo

Non attendere risposta Gemini completa: a ogni **frase completa** (delimitatore `.` `?` `!` o `\n`) durante SSE:

1. `prefetchTonyTTS(frase, gen)`
2. `speakWithTTS(frase, { gen, ... })`

### Hook probabile

- `main.js` — handler chunk `tonyAskStream` / `doDisplay` parziale (oggi `doDisplay` solo a fine turno).
- Riutilizzare stesso `__tonyGeneration` del turno (bump solo a `sendMessage`, non per frase).

### Criterio

Utente sente prima frase mentre Gemini genera la seconda; barge-in con bump invalida **tutti** i chunk del turno.

**Non implementare Fase 2 nello stesso PR di Fase 1.**

---

## 8. Test manuali — criteri accettazione Fase 1

| # | Scenario | Esito atteso |
|---|----------|--------------|
| T1 | Tony parla risposta lunga → click mic | Audio stop immediato; **nessuna** ripresa voce; mic in ascolto |
| T2 | Tony parla → utente parla sopra (`onspeechstart`) | Stesso di T1 |
| T3 | Tony parla → chiudi pannello X | Audio stop; coda vuota; riapri pannello → nessun audio fantasma |
| T4 | Invia messaggio testo mentre Tony parla ancora turno precedente | Turno precedente silenziato; solo nuova risposta |
| T5 | Modalità continua: Tony finisce → riascolto | Comportamento invariato (regressione) |
| T6 | Risposta con prefetch (console/network getTonyAudio) → barge-in mid-fetch | Nessun play dopo interruzione |
| T7 | Due messaggi rapidi consecutivi | Solo ultima risposta parlata |

**Console:** log `[Tony Voice] pipeline cleared` con `reason` e `generation` incrementale.

---

## 9. Fase 3+ — Backlog (da Gemini, non in scope immediato)

| Item | Note |
|------|------|
| STT cloud premium (piano Avanzato) | Web Speech + “non ho capito” prima; GDPR/costo |
| TTS Neural2 | Test pronuncia termini agricoli prima di switch |
| Min-instances CF | Cold start, non latenza Gemini 30s |
| Soft lock tap su save/delete | Estendere pattern dialog navigazione |
| Profili UX Campo vs Ufficio | Alto contrasto, vibrazione fine ascolto |
| Context prefetch al modulo | Prima del click mic |

---

## 10. Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Doppio bump (sendMessage + barge-in stesso gesto) | Bump solo sendMessage per nuovo testo; barge-in bump solo se **non** segue immediatamente send (o bump solo in sendMessage se testo inviato entro 1s) — **semplificazione:** barge-in mic durante TTS bumpa; sendMessage bumpa sempre all’inizio → due bump se barge-in poi invio: accettabile (gen salta di 2, ancora coerente) |
| `onPlayEnd` / reopen mic non chiamato dopo clear | Documentato: chiamante barge-in riapre mic esplicitamente |
| Prefetch completa dopo bump e sporca cache | Gate su `genAtStart` prima di scrivere cache |
| Regressioni proactive briefing | Non bumpare su `opts.proactive` in sendMessage |

---

## 11. Dopo l’implementazione — doc da aggiornare

Seguire `tony-agent-onboarding.mdc`:

1. `docs-sviluppo/COSA_ABBIAMO_FATTO.md` — voce con data
2. `docs-sviluppo/tony/STATO_ATTUALE.md` — sezione voce / barge-in
3. **Questo file** — cambiare stato in ✅ Fase 1 implementata + data commit
4. `TONY_DECISIONI_E_REQUISITI.md` — solo se decisione “generation token” diventa requisito formale

**Non** duplicare in `DOBBIAMO_ANCORA_FARE.md` ecc.

---

## 12. Prompt per agente implementatore

Copia in chat Cursor:

```
Implementa Fase 1 di docs-sviluppo/tony/PIANO_AUDIO_PIPELINE_BARGEIN.md:
- clearTonyAudioPipeline + __tonyGeneration in core/js/tony/voice.js
- wiring main.js (sendMessage, barge-in mic, onspeechstart, tony-close)
- Nessun chunking SSE (Fase 2)
- Esegui test manuali T1–T4 e descrivi esito
- Aggiorna COSA_ABBIAMO_FATTO.md e STATO_ATTUALE.md sezione voce
```

---

*Fine piano — v1.0 (2026-06-07)*
