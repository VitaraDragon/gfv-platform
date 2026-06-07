# Tony (GFV Platform) — Alternative di sviluppo per review Gemini

**Data:** 2026-06-07  
**Scopo:** documento **autocontenuto** da incollare in Gemini (o altro LLM) per valutare **strade possibili** di evoluzione — in particolare **interazione vocale**, latenza, costi e architettura.  
**Non è** una spec di implementazione: è un quadro decisionale.

---

## Come usarlo con Gemini (prompt suggerito)

Copia tutto questo file e aggiungi in coda:

> Sei consulente tecnico-prodotto. Leggi il documento. Per ogni area (STT, TTS, LLM, latenza, UX vocale, costi, rischi) elenca:
> 1. **Opzioni** (minimo 2–3 per area, incluse quelle già in uso)
> 2. **Pro/contro** nel nostro contesto (PWA agricola, multi-tenant, italiano, campo/mobile)
> 3. **Raccomandazione** con priorità (quick win vs investimento)
> 4. **Cosa evitare** e perché
> 5. **Ordine di implementazione** suggerito nei prossimi 3–6 mesi

---

## 1. Cos’è GFV Platform e Tony

- **GFV Platform**: ERP web multi-tenant per aziende agricole (35+ form, 25+ tabelle, moduli Vigneto, Frutteto, Magazzino, Manodopera, Meteo, Conto terzi, ecc.).
- **Tony**: assistente IA centrale (“capocantiere digitale”) integrato in ogni pagina via widget (FAB + chat).
- **Utenti**: manager/proprietario, caposquadra, operai in campo (spesso smartphone, guanti, rumore).
- **Canali**: chat testuale + **voce** (priorità crescente in campo).
- **Deploy**: PWA / pagine HTML standalone + Firebase (Auth, Firestore, Cloud Functions `europe-west1`). **Nessuna app nativa** oggi.

**Visione (north star):** Tony deve conoscere i dati aziendali, rispondere, compilare form, navigare, dare consigli — da **qualsiasi pagina**, anche a voce, senza che l’utente impari menu e flussi.

**Vincoli architetturali già decisi:**
- Configurazione centralizzata (`tony-form-mapping.js`), no patch per singola pagina nel core.
- Context Builder lato cloud (`buildContextAzienda`) con slice per tier di complessità.
- Piano Free: Tony disabilitato; Base+: Tony Guida; modulo Tony Avanzato per funzioni estese.

---

## 2. Architettura attuale (sintesi)

```
Utente (browser PWA)
  ├─ STT: Web Speech API (SpeechRecognition)          [client]
  ├─ UI: core/js/tony/main.js, ui.js, voice.js        [client]
  ├─ Tony Service: ask / askStream                    [client → CF]
  ├─ CF tonyAsk (callable) + tonyAskStream (SSE)      [Gemini generateContent / stream]
  ├─ CF getTonyAudio (callable)                       [Google Cloud TTS]
  ├─ Context: buildContextAzienda + page context      [CF]
  └─ Azioni: APRI_PAGINA, INJECT_FORM_DATA, FILTER_TABLE, … [client + CF]
```

**Modello Gemini attuale:** `gemini-2.5-flash` (env `GEMINI_MODEL` override).  
**Regione:** `europe-west1`.

---

## 3. Interazione vocale — stato attuale

### 3.1 Flusso end-to-end oggi

| Fase | Tecnologia | Dove | Note |
|------|------------|------|------|
| **Input voce (STT)** | Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) | `core/js/tony/main.js` | Italiano browser-dipendente; qualità variabile su Android/iOS |
| **Invio testo** | Stesso pipeline di chat | `tony-service.js` | Flag `fromVoice: true` per UX post-risposta |
| **Ragionamento** | Gemini via `tonyAsk` / `tonyAskStream` | `functions/index.js`, `tony-ask-stream.js` | System instruction con regole **FORMATO OUTPUT VOCALE** |
| **Pulizia testo TTS** | `pulisciTestoPerVoce`, `extractTextForTTS`, espansione unità (q.li → quintali, ha → ettari) | `core/js/tony/voice.js` | Rimuove emoji, markdown, JSON dalle risposte |
| **Output voce (TTS)** | Cloud Function `getTonyAudio` | `functions/index.js` | Google Cloud Text-to-Speech, voce **it-IT-Wavenet-D**, pitch -3, rate 0.95, MP3 base64 |
| **Riproduzione** | `Audio()` + coda | `voice.js` | Cache testo identico in sessione; policy browser → audio al primo click |

### 3.2 UX vocale implementata

- **Push-to-talk**: card “Hai detto: …” con Annulla / Invia (se modalità continua off).
- **Modalità continua (hands-free)**: toggle microfono; dopo risposta Tony riapre ascolto.
- **Timeout inattività** (~20 s): spegne microfono se nessuno parla.
- **Congedo vocale**: “Grazie Tony, a posto così” → esce da modalità continua.
- **Barge-in**: click microfono interrompe TTS e riascolta.
- **Persistenza sessione**: `sessionStorage` (chat, modalità auto, ~10 min).
- **Streaming testo**: `askStream` / SSE — testo in chat a chunk (TTS spesso **dopo** testo completo).

### 3.3 Regole prompt per voce (Gemini)

Nel system instruction (`tony-service.js` + CF):
- Testo **puro** (no markdown, no emoji, no JSON visibile all’utente).
- Elenco con “Primo… Poi… Infine…” invece di bullet.
- “più” / “percento” al posto di simboli.
- Punteggiatura pensata per pause TTS (virgole, …, ? !).
- **MEMORIA VOCALE**: risposte brevi utente (“sì”, “apri”) interpretate rispetto all’ultimo messaggio Tony.

### 3.4 Problemi noti / limiti attuali

| Problema | Impatto |
|----------|---------|
| STT browser inconsistente | Errori riconoscimento dialetto/rumore/campo |
| Latenza TTS **serializzata** dopo Gemini | Voce arriva tardi (15 s timeout CF); in console: “Audio rinviato: riproduzione al primo click” |
| Nessun STT cloud | Nessun fallback se Web Speech fallisce |
| TTS solo Wavenet-D | Una voce fissa; niente scelta utente |
| Turni Gemini lenti su binario “complesso” | Esempio osservato ~33 s su crea lavoro multi-campo |
| Autoplay browser | Primo audio può richiedere interazione utente |
| Solo italiano | OK per prodotto, ma STT/TTS multilingua non previsti |

---

## 4. Alternative STT (input voce)

| Opzione | Descrizione | Pro | Contro | Stato |
|---------|-------------|-----|--------|-------|
| **A. Web Speech API** (attuale) | API nativa browser | Zero costo API; nessun audio sul server | Qualità/device; offline limitato; poco controllo | ✅ In produzione |
| **B. Google Cloud Speech-to-Text** | Audio → CF → testo | Accuratezza superiore; modelli it-IT; diarization opzionale | Costo per minuto; invio audio; latenza rete; privacy/GDPR da gestire | ❌ Non implementato |
| **C. Gemini multimodale (audio in)** | Invio audio clip a Gemini | Un solo vendor; possibile intent+testo insieme | Costo; latenza; prompt più complesso; non allineato a “no vision/audio” in roadmap attuale | ❌ Esplicitamente fuori scope finché non c’è requisito |
| **D. Whisper / OpenAI / altri STT** | API terze | Buona qualità | Nuovo vendor, compliance, integrazione CF | ❌ Non valutato in prod |
| **E. App nativa (Capacitor/React Native)** | STT OS-level | Migliore su iOS/Android | Abbandona PWA pura; costo sviluppo | ❌ Fuori stack attuale |

**Domanda per Gemini:** conviene **B** come fallback quando confidence STT browser è bassa, o investire prima in **prompt + UX** (conferma vocale, ripeti)?

---

## 5. Alternative TTS (output voce)

| Opzione | Descrizione | Pro | Contro | Stato |
|---------|-------------|-----|--------|-------|
| **A. Google Cloud TTS Wavenet** (attuale) | `getTonyAudio`, it-IT-Wavenet-D | Qualità alta; voce maschile “capocantiere”; controllo pitch/rate | Costo per carattere; round-trip CF; latenza | ✅ In produzione |
| **B. Google Cloud TTS Neural2 / Studio** | Voci più recenti | Possibile naturalezza migliore | Prezzo; test A/B necessario | ⏳ Non testato |
| **C. Web Speech API synthesis** | `speechSynthesis` lato client | Zero latenza server; offline parziale | Qualità inferiore; voci device-dipendenti; **rimosso** deliberatamente | ❌ Scartato (2026-02) |
| **D. Gemini native audio output** | Modello con output audio | Potenziale end-to-end | Vendor lock-in; costo; controllo limitato su SSML | ❌ Non in roadmap |
| **E. Pre-generazione / cache server** | Cache frasi comuni su Firestore/CDN | Risposta istantanea per saluti/conferme | Manutenzione corpus; poco flessibile | ⏳ Solo cache testo identico in sessione (client) |
| **F. TTS in parallelo al testo** | Avviare `getTonyAudio` appena arriva primo chunk stream | Percezione molto migliore in campo | Complessità (testo parziale vs finale); doppie chiamate | ⏳ **Pianificato** (PLAN performance §6.2) |

**Parametri attuali TTS:** MP3, pitch -3.0, speakingRate 0.95.

**Domanda per Gemini:** strategia migliore tra **F (parallelo)** vs **streaming audio nativo** vs **sentence-chunking** (TTS per frase mentre Gemini scrive)?

---

## 6. Alternative LLM / ragionamento

| Opzione | Descrizione | Pro | Contro | Stato |
|---------|-------------|-----|--------|-------|
| **A. Gemini 2.5 Flash** (attuale) | Tutti i turni “complessi” | Bilanciamento costo/velocità; function-like JSON in risposta | Ancora lento su turni pesanti; context grande | ✅ In produzione |
| **B. Quick reply deterministici** | Bypass Gemini se pattern noto (meteo, scorte, scadenze…) | ~1–3 s; costo zero token | Solo domini mappati | ✅ Parziale (`meteo-service`, router tier) |
| **C. Tier context / slice** | Invio a Gemini solo slice contesto (T0–T4) | Meno token, più veloce | Complessità router | ✅ Fase 2b |
| **D. Gemini 2.5 Flash-Lite / modello più piccolo** | Modello diverso per binario semplice | Latenza/costo minori | Qualità inferiore su form complessi | ⏳ Da valutare con A/B |
| **E. Due passaggi** | Classificatore leggero → modello pesante solo se serve | Latenza media minore | Due chiamate; orchestrazione | ⏳ Idea in linea con router |
| **F. Treasure Map / entity-first client** | Parser client + inject form senza multi-turno Gemini | Risolve “mi chiede trattore già detto” | Manutenzione pattern | ✅ Parziale (lavori, ore, magazzino) |
| **G. Fine-tuning / system cache Gemini** | Cache contesto lungo | Riduce token ripetuti | Setup Google; invalidazione | ⏳ Esplorativo |

**Binari (PLAN performance):**
- **A — Deterministico:** quick reply, no Gemini.
- **B — Istruzionale:** navigazione, filtri semplici.
- **C — Ragionamento:** crea lavoro, consigli cross-modulo, form complessi.

**Domanda per Gemini:** per **voce in campo**, ha senso forzare più turni su binario **A/B** con risposte brevi vocali, riservando **C** solo dopo conferma esplicita?

---

## 7. Alternative UX dialogo vocale

| Opzione | Descrizione | Pro | Contro |
|---------|-------------|-----|--------|
| **Modalità continua** (attuale) | Loop ascolto → risposta → riascolto | Hands-free | Errori STT si propagano; timeout |
| **Conferma obbligatoria** | Ripeti comando prima di azioni write | Sicurezza | Più lento; fastidioso |
| **Wake word** (“Ehi Tony”) | Attivazione hands-free | UX moderna | Browser non supporta bene; batteria |
| **Solo TTS per risposte, input testo** | Voce output-only | Affidabile | Perde valore in campo |
| **Indicatori stato** (“Sto ascoltando / Sto pensando”) | Feedback visivo+haptico | Riduce frustrazione | UI da progettare |
| **Risposte vocali corte + dettaglio in chat** | Tony parla 1–2 frasi, resto testo | TTS veloce | Doppio canale |
| **Interruzione intelligente** | Barge-in + cancel CF in flight | Reattività | Complessità tecnica |

**Domanda per Gemini:** pattern UX migliore per **operaio in campo** vs **manager in ufficio** — stesso widget o due modalità?

---

## 8. Performance e costi (trade-off)

### Obiettivo
Tony usabile **ogni giorno** in campo: risposta percepita < 2–3 s su domande semplici; < 8–10 s accettabile su azioni complesse.

### Leve già in roadmap interna
1. **TTS decoupled** — testo subito, audio in parallelo.
2. **Streaming CF → widget** — chunk visibili (SSE già presente, da sfruttare meglio per voce).
3. **Più quick reply** — replicare pattern meteo su scorte/scadenze/mezzi.
4. **Meno retry Gemini** — Treasure Map / first-shot entity extraction.
5. **Cache context** — non rifare 13 fetch Firestore ogni “ciao”.

### Costi indicativi (qualitativi)
- **Gemini:** per token (input context pesante = costo alto).
- **Cloud TTS:** per carattere (ogni risposta parlata).
- **STT browser:** gratuito ma qualità variabile.
- **STT cloud:** costo minuto audio.

**Domanda per Gemini:** come stimare **costo per sessione vocale** (5 min campo) e dove tagliare senza rovinare UX?

---

## 9. Cosa abbiamo già scartato (o posticipato)

| Scelta | Motivo |
|--------|--------|
| Web Speech TTS fallback | Qualità insufficiente vs Cloud TTS |
| Visione / foto → Gemini | Roadmap futura (magazzino DDT); non in Tony core ora |
| App nativa | Stack PWA + standalone HTML |
| Parsing testo libero per azioni | Preferito JSON strutturato / comandi configurati |
| Tony logic per singolo formId nel core | Solo `tony-form-mapping.js` |
| gemini-2.0-flash | Deprecato / 404 |

---

## 10. Roadmap prodotto rilevante per la voce (non ancora completa)

- **Proattività vocale:** “Ho notato X, vuoi che…?” cross-modulo (Fase 6 Master Plan).
- **Grafici vocali:** “mostrami andamento vendemmia” → MOSTRA_GRAFICO (Fase 5).
- **Storico multi-anno** in risposta vocale (progetto trasversale, non ancora implementato).
- **Multimodale magazzino** (foto bolla/fattura) — roadmap separata, non Tony voce generale.

---

## 11. File di riferimento nel repository

| Area | Path |
|------|------|
| Voce TTS/STT | `core/js/tony/voice.js`, `core/js/tony/main.js` |
| Client Tony | `core/services/tony-service.js` |
| CF Gemini + TTS | `functions/index.js` (`handleTonyAskRequest`, `getTonyAudio`), `functions/tony-ask-stream.js` |
| Form injection | `core/js/tony-form-injector.js`, `core/config/tony-form-mapping.js` |
| Performance / binari | `docs-sviluppo/tony/PLAN_OTTIMIZZAZIONE_PERFORMANCE.md` |
| Visione | `docs-sviluppo/tony/MASTER_PLAN.md`, `docs-sviluppo/tony/STATO_ATTUALE.md` |
| Storico decisioni voce | `docs-sviluppo/TONY_DA_IMPLEMENTARE_POST_GEMINI.md` |
| Sintesi funzionale | `docs-sviluppo/TONY_FUNZIONI_E_SOLUZIONI_TECNICHE.md` |
| Bundle codice (parzialmente datato) | `tony-code-per-gemini.html` |

---

## 12. Domande aperte (risposta richiesta a Gemini)

1. **STT:** restare su Web Speech + UX conferma, o introdurre STT cloud solo su fallback / piano Avanzato?
2. **TTS:** conviene **chunk per frase** durante lo stream, o una sola chiamata a fine risposta?
3. **Voce:** Neural2/Studio vale un A/B rispetto a Wavenet-D per utenti agricoli?
4. **Latenza:** quali 3 interventi massimo impatto per portare il 80% delle domande vocali sotto 3 s?
5. **Sicurezza:** per azioni distruttive (salva lavoro, movimento magazzino) — conferma vocale basta o serve tap?
6. **Offline / rete debole:** strategie realistiche in PWA (cache risposte, modalità degradata)?
7. **Costi:** architettura target per tenere Tony vocale sostenibile con 50–200 tenant attivi?
8. **Product:** due profili UX (Campo vs Ufficio) nello stesso widget — sì/no e come?

---

## 13. Contesto metriche osservate (realistiche)

- Dashboard pronta: ~1 s (widget, no Tony).
- `tony.checkGlobalStatus`: ~0,5–0,7 s (deferred).
- Meteo fetch widget: ~0,25–0,45 s.
- Turno Gemini complesso (crea lavoro ricco): fino a **~33 s** osservati (2026-05).
- TTS: chiamata CF fino a 15 s timeout; spesso ritardato da policy autoplay browser.

---

## 14. Piano implementazione (agenti)

Specifica operativa Fase 1–2 (generation token, `clearTonyAudioPipeline`, chunking):  
→ **`docs-sviluppo/tony/PIANO_AUDIO_PIPELINE_BARGEIN.md`**

---

*Fine documento — versione 1.0 (2026-06-07)*
