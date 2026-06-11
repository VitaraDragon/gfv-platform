# Handoff — Cambio voce Tony: Google Chirp 3 HD

**Creato:** 2026-06-10  
**Stato:** 📋 **Pianificato** — non ancora implementato in produzione  
**Scopo:** guida completa per un nuovo agente/sviluppatore: stato attuale, scelta voce, implementazione, costi, test, rollback.

**Documenti correlati:**

| File | Ruolo |
|------|--------|
| `PIANO_AUDIO_PIPELINE_BARGEIN.md` | Pipeline audio, barge-in, generation token (Fase 1 ✅); chunking TTS Fase 2 |
| `HANDOFF_CONTINUITA_PERFORMANCE_NAV.md` | Contesto performance/costi Tony (TTS opzionale Priorità 3) |
| `TONY_DA_IMPLEMENTARE_POST_GEMINI.md` | Storico decisioni voce 2026-02 (Wavenet-D) |
| [Chirp 3 HD — Google Cloud](https://cloud.google.com/text-to-speech/docs/chirp3-hd) | Documentazione ufficiale voci e parametri |
| [Pricing TTS](https://cloud.google.com/text-to-speech/pricing) | Tariffe per tipo voce |

---

## Prompt per nuovo agente

```
Implemento / valuto il cambio voce Tony su GFV Platform (Chirp 3 HD).
Leggi:
1. docs-sviluppo/tony/HANDOFF_TTS_CHIRP3.md (questo file)
2. docs-sviluppo/tony/PIANO_AUDIO_PIPELINE_BARGEIN.md
3. functions/index.js → getTonyAudio
4. core/js/tony/voice.js

Non toccare la pipeline Gemini/Tony ask salvo necessità. Il cambio voce è solo in getTonyAudio + eventuale cache client.
Dopo implementazione: aggiorna COSA_ABBIAMO_FATTO.md e STATO_ATTUALE.md.
```

---

## 1. Dove siamo (stato attuale)

### Architettura TTS

```
Risposta Tony (testo)
  → voice.js: pulisciTestoPerVoce / extractTextForTTS
  → prefetchTonyTTS (opzionale, parallelo) o speakWithTTS
  → CF callable getTonyAudio (europe-west1)
  → Google Cloud Text-to-Speech API
  → MP3 base64 → Audio() nel browser
```

### Implementazione corrente

| Elemento | Valore / file |
|----------|----------------|
| Cloud Function | `exports.getTonyAudio` in `functions/index.js` (~riga 4024) |
| SDK | `@google-cloud/text-to-speech` ^5.x |
| Voce | **`it-IT-Wavenet-D`** (maschile, tono profondo — «capocantiere») |
| `audioConfig` | `MP3`, **`pitch: -3.0`**, **`speakingRate: 0.95`** |
| Gate piano | Piano **Free** → `permission-denied`; Base+ ok |
| Client | `core/js/tony/voice.js` — coda, cache locale `lastTTSCache`, timeout 15 s |
| Pulizia testo | `pulisciTestoPerVoce`, espansione q.li/ha/litri/kg (italiano agricolo) |
| API GCP | **Cloud Text-to-Speech API** abilitata sul progetto Firebase |

### Cosa **non** cambia con Chirp 3

- Flusso chat / Gemini / quick reply
- `voice.js` coda e `clearTonyAudioPipeline` (Fase 1 barge-in)
- Pulizia testo lato client (resta valida)

---

## 2. Perché Chirp 3 HD (e alternative)

### Confronto voci Google (italiano)

| Famiglia | Esempio `name` | Qualità percepita | Prezzo (dopo free tier) | Note |
|----------|----------------|-------------------|-------------------------|------|
| **Wavenet** (oggi) | `it-IT-Wavenet-D` | Buona, leggermente «sintetica» | **16 $ / 1M caratteri** | Generazione precedente; D può non essere tra le voci più aggiornate |
| **Neural2** | `it-IT-Neural2-C` (M), `it-IT-Neural2-F` (F) | Migliore di Wavenet | **16 $ / 1M caratteri** | Upgrade **a pari costo** — buon passo intermedio |
| **Chirp 3 HD** | `it-IT-Chirp3-HD-Charon` (M), … | Più naturale, prosodia emotiva | **30 $ / 1M caratteri** | ~**+87%** sul carattere pagato vs Wavenet/Neural2 |

Free tier Google (indicativo): **1M caratteri/mese** per voci WaveNet/Neural2/Chirp3 HD (verificare quota attuale su [pricing](https://cloud.google.com/text-to-speech/pricing)).

### Impatto economico stimato (scenario discussa 2026-06)

Ordine di grandezza a **100 tenant** con uso vocale moderato:

- TTS totale: spesso **< €5–15/mese** anche con Chirp 3
- vs MRR abbonamenti (~€1.700/mese scenario tipo): **trascurabile**
- Il costo dominante resta **Gemini**, non TTS

**Decisione prodotto suggerita:** Chirp 3 ha senso se la **qualità percepita** della voce è prioritaria; altrimenti **Neural2** come step zero-risk sul prezzo.

---

## 3. Scelta voce Chirp 3 per Tony

### Convenzione nome

```
{languageCode}-Chirp3-HD-{VoiceName}
```

Esempio italiano maschile: **`it-IT-Chirp3-HD-Charon`**

### Personalità disponibili (estratto doc Google)

Chirp 3 espone molte voci; per Tony (assistente agricolo, tono **sicuro, maschile, non giovanile**) candidati **maschili**:

| VoiceName | Genere | Uso suggerito |
|-----------|--------|----------------|
| **Charon** | M | Default consigliato — caldo, autorevole |
| **Orus** | M | Alternativa più neutra |
| **Fenrir** | M | Più energico |
| **Puck** | M | Più leggero/giovane — meno «capocantiere» |
| **Iapetus**, **Enceladus**, … | M | Da ascoltare in A/B |

Femminili (se si cambia persona Tony): Kore, Leda, Zephyr, Aoede, …

**Raccomandazione implementazione:** partire da **`it-IT-Chirp3-HD-Charon`**, `speakingRate: 0.95`–`1.0`; **non** copiare `pitch: -3.0` di Wavenet senza ascolto (Chirp ha timbro diverso).

### Ascolto prima del deploy

1. [Pagina demo voci Chirp 3](https://cloud.google.com/text-to-speech/docs/chirp3-hd) (tabella con audio)
2. Script locale (opzionale) con `ttsClient.synthesizeSpeech` e frasi Tony reali:
   - «Sconsiglio di programmare il trattamento mercoledì: probabilità di pioggia elevata.»
   - «Ti porto alle tariffe.»
   - «Ho registrato 8 ore di potatura sul Sangiovese.»

---

## 4. Differenze tecniche Wavenet → Chirp 3

| Aspetto | Wavenet (oggi) | Chirp 3 HD |
|---------|----------------|------------|
| `pitch` in `audioConfig` | Usato (`-3.0`) | Verificare su Chirp; preferire **`speaking_rate`** (0.25–2.0) e testo naturale |
| `speakingRate` | `0.95` | Stesso campo `speaking_rate` in `audioConfig` |
| SSML batch | Supportato | Supportato (subset tag; vedi doc Chirp) |
| SSML streaming | — | SSML **non** supportato su streaming |
| Output | MP3 ✅ | MP3 ✅ (batch) |
| Regione API | Globale | GA su `global`, `eu`, `europe-west2`, … — CF in `europe-west1` ok con endpoint standard |

**Nota:** se `synthesizeSpeech` con `pitch` su Chirp restituisce errore o viene ignorato, rimuovere `pitch` e regolare solo `speakingRate`.

---

## 5. Piano implementazione (checklist)

### Fase A — Configurazione server (obbligatoria)

**File:** `functions/index.js` → `getTonyAudio`

1. Introdurre lettura configurazione voce (non hardcodare solo in produzione):

```javascript
// Esempio target — adattare al pattern env del progetto
const TONY_TTS_VOICE =
  process.env.TONY_TTS_VOICE || "it-IT-Chirp3-HD-Charon";
const TONY_TTS_SPEAKING_RATE = Number(process.env.TONY_TTS_SPEAKING_RATE || "0.95");
// pitch: opzionale solo se test Chirp lo supporta
```

2. Sostituire `VOICE_NAME` fisso `it-IT-Wavenet-D` con `TONY_TTS_VOICE`.

3. Aggiornare `audioConfig`:
   - Mantenere `audioEncoding: "MP3"`
   - `speakingRate: TONY_TTS_SPEAKING_RATE`
   - Valutare rimozione o riduzione `pitch` (es. `0` o omesso)

4. Log strutturato (già presente): includere `voice`, `speakingRate` in `[getTonyAudio]`.

5. Risposta CF: già ritorna `{ audioContent, voice }` — utile per debug client.

**Deploy:**

```bash
firebase deploy --only functions:getTonyAudio
```

Per secret/env in Firebase Functions v2: usare `defineString` / parametri ambiente come nel resto del progetto (non committare segreti).

### Fase B — Cache client (consigliata)

**File:** `core/js/tony/voice.js`

**Problema:** `lastTTSCache` è keyed solo su `text`. Cambiando voce senza invalidare cache, si può riprodurre audio vecchia voce.

**Fix minimo:**

```javascript
var lastTTSCache = { text: '', audioBase64: '', voice: '' };
// hit cache solo se text E voice coincidono con result.data.voice
```

Opzionale: passare `voice` preferita dal client in `getTonyAudio({ text, voice? })` solo se si vuole A/B per tenant — **default: solo server-side env**.

### Fase C — Test e rollout

| Step | Azione |
|------|--------|
| 1 | Ascolto manuale 5–10 frasi Tony (meteo, nav, ore) |
| 2 | Verificare latenza: Chirp può essere leggermente più lento di Wavenet — confrontare con timeout 15 s in `voice.js` |
| 3 | Test barge-in: interrompere Tony a metà frase (pipeline Fase 1) |
| 4 | Test piano Free → errore invariato |
| 5 | Deploy staging / canary: `TONY_TTS_VOICE=it-IT-Wavenet-D` vs Chirp su subset utenti (se esiste meccanismo; altrimenti switch unico) |
| 6 | Monitorare errori CF e dimensione risposta base64 |

**Test automatici (opzionali):** mock `ttsClient.synthesizeSpeech` in test CF — oggi non esiste suite dedicata TTS; accettabile solo smoke manuale iniziale.

### Fase D — Documentazione post-deploy

Aggiornare:

- `docs-sviluppo/COSA_ABBIAMO_FATTO.md`
- `docs-sviluppo/tony/STATO_ATTUALE.md` (riga widget / getTonyAudio)
- Tabella §8 sotto (cronologia)

---

## 6. Rollback

Immediato senza redeploy client:

```bash
# Impostare env functions
TONY_TTS_VOICE=it-IT-Wavenet-D
TONY_TTS_SPEAKING_RATE=0.95
# redeploy getTonyAudio
```

Oppure revert commit su `functions/index.js` e deploy.

---

## 7. Sinergie future (non bloccare Chirp)

| Iniziativa | File | Relazione |
|------------|------|-----------|
| **Chunking TTS per frase** | `PIANO_AUDIO_PIPELINE_BARGEIN.md` Fase 2 | Riduce latenza primo audio; Chirp supporta **streaming** API (evoluzione separata) |
| **Neural2 come fallback** | `getTonyAudio` | Stesso codice, env `TONY_TTS_VOICE=it-IT-Neural2-C` |
| **Prompt Gemini «per voce»** | `functions/index.js` system instruction | Frasi brevi, punteggiatura — già ottimizzato; utile anche con Chirp |

---

## 8. Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Voce troppo «lenta» o diversa da aspettative utenti | A/B con Neural2; `speaking_rate` 0.95–1.05 |
| Costo TTS raddoppiato per carattere | Impatto basso su MRR; monitor billing GCP TTS |
| Errore API voce non trovata | `list_voices` CLI; fallback env a Wavenet-D |
| Cache client audio vecchio | Fase B — includere `voice` in cache key |
| Latenza percepita | Prefetch già in `prefetchTonyTTS`; Fase 2 chunking |
| Pitch Wavenet non replicabile | Non forzare `pitch: -3`; scegliere voce maschile Chirp adeguata |

---

## 9. Comandi utili

```bash
# Deploy solo TTS
firebase deploy --only functions:getTonyAudio

# Lista voci it-IT (con gcloud configurato sul progetto)
gcloud text-to-speech voices list --filter="languageCodes:it-IT" --format="table(name,ssmlGender,naturalSampleRateHertz)"

# Test locale synthesize (Node, credenziali ADC)
# node scripts/tony-tts-preview.mjs  # da creare se serve — non esiste ancora
```

---

## 10. Criteri di accettazione

- [ ] `getTonyAudio` usa `it-IT-Chirp3-HD-*` (o env equivalente)
- [ ] Ascolto approvato su frasi meteo, navigazione, conferme ore
- [ ] Nessuna regressione barge-in / chiusura pannello Tony
- [ ] Piano Free ancora bloccato
- [ ] Cache client coerente con voce (Fase B)
- [ ] Documentazione aggiornata
- [ ] Rollback documentato e testato

---

## 11. Cronologia handoff

| Data | Nota | Stato |
|------|------|--------|
| 2026-06-10 | Documento creato; voce prod ancora `it-IT-Wavenet-D` | 📋 Da implementare |
| | Scelta voce consigliata: `it-IT-Chirp3-HD-Charon` | Da validare ad orecchio |
| | Prossimo step: Fase A env + deploy + ascolto | |

---

## 12. Riferimenti codice (linee indicative)

```4024:4075:functions/index.js
exports.getTonyAudio = onCall(
  ...
  const VOICE_NAME = "it-IT-Wavenet-D";
  ...
  audioConfig: { audioEncoding: "MP3", pitch: -3.0, speakingRate: 0.95 },
```

```6:6:core/js/tony/voice.js
var lastTTSCache = { text: '', audioBase64: '' };
```
