# COPIONE SPOT FLUSSI APP (Linea B)

**Stato:** formato chiuso (2026-09-02). Episodio 1 in produzione: **segnalazione guasto**. Copione episodio 2 chiuso: **zona lavorata / progressi** (2026-09-07).  
**Linea:** serie feature. Non mescolare con lo spot brand (`COPIONE_PRIMO_SPOT_SOCIAL.md`, laptop + retino).  
**Durata per episodio:** ~20–30s (guasto e zona lavorata hanno più beat: ~25–32s). Master **16:9**, poi crop **9:16** (azione / volto + telefono al centro).  
**Motore video Soul:** Seedance / Soul V2 o Soul Cinema, clip da ~5s. **UI mai generata.**  
**Stile casa (tutti gli episodi):** **Pixar 3D** — stesso filo delle take Soul già tenute (magazzino Giuseppe, volti addestrati). Non live-action, non fotorealistico, non cartoon 2D Linea A. Un cambio di stile spezza la serie.

---

## 1. Una frase

I Soul (Tony, Luca, Mario, Giuseppe) sono gli **unici attori da replicare**. Ogni spot è un flusso dell’app: il personaggio fa il gesto umano, guarda **il suo** smartphone, la camera entra in dolly, tagliamo sulla **schermata vera**. Trattori, attrezzi, carri, sacchi brandizzati **non** sono asset da far tornare identici.

---

## 2. Perché così (e non i mezzi)

Higgsfield tiene il volto di un Soul. Non tiene un trattore, una vendemmiatrice o un attrezzo clip dopo clip:

- lo stesso operaio sul trattore in seminativo non può vendere potatura, trincia o vendemmia;
- i mezzi inventano marche, scritte, forme;
- un sacco “posato” ha fisica innaturale; un logo sul telo diventa *SUCK E* / *Bunnes Tieoon*.

La macchina, se compare, è **sfondo generico**. Si può cambiare da un take all’altro. Il riconoscibile è la faccia + il flusso sull’app.

---

## 3. Attori (solo Soul)

| Chi | Ruolo in app | Dove sta | ID noti |
|---|---|---|---|
| **Tony** | closer / cameo, non opera in campo | Cappello di paglia, barba, gilet, bandana rossa. **Mai** l’uomo in camicia verde. | `dfdc8ee8-1009-4240-87dd-2d8d91fbef59` |
| **Luca** | manager | Ufficio, polo, laptop o telefono | Higgsfield: «Balanced Focused Creator» — rinominare Luca |
| **Mario** | caposquadra | Campo / bordo filare, telefono in mano | `97dd3f71-ab41-45b8-ad00-e0de8182484d` |
| **Giuseppe** | operaio | Magazzino o filare, telefono suo | `aa4e8f90-21a3-4c43-bb6a-6ebeb213d057` |

Un Soul per clip. Due persone nello stesso fotogramma: non Soul, serve Element (e di solito non serve: meglio campo/ufficio + taglio).

---

## 4. Grammatica fissa (ogni episodio)

Quattro pezzi, sempre nello stesso ordine. Il dolly è già approvato sul take magazzino `3dc29479-dcb5-4c64-b666-0e8a07b83988`.

| # | Cosa | Chi lo fa | Cosa si vede |
|---|---|---|---|
| 1 | **Gesto** | Higgsfield + Soul | Azione umana del flusso (posa, legge, conferma, parla). Niente hero-machine. |
| 2 | **Sguardo** | stesso take o taglio interno | Guarda **il suo** telefono. Non lo gira verso di noi. Schermo Higgsfield spento / blur / di schiena. |
| 3 | **Dolly** | stesso asse ¾ over-shoulder | Entrata lenta verso lo schermo. Non cammina verso camera col telefono nero in faccia. |
| 4 | **App vera** | screen recording / screenshot | Match cut o overlay sullo schermo. UI registrata dall’app, mai Recraft, mai dashboard inventata. |

Chiusura (2–3s, a scelta, sempre uguale nella serie): logo GFV + `globalfarmview.net`, oppure Tony che fa cenno col cappello (muto; battuta in montaggio se serve).

---

## 5. Cosa si genera e cosa no

| Sì | No |
|---|---|
| Volto Soul, gesto, OTS, dolly, **look Pixar 3D** | Replicare lo stesso trattore / attrezzo / carro |
| Sfondo agricolo *generico* (stesso stile 3D) | Live-action, fotoreale, marche, scritte su sacchi, UI Higgsfield |
| Audio effetti ambiente (passi, sacco, ufficio) | Parlato italiano in generazione (labiale rotto) |
| UI vera in montaggio | Dashboard Recraft (`8ca92742` e simili) |
| Un flusso = un episodio | Incollare Linea A (laptop, retino, mezzi giocattolo) |

Musica e battute: in montaggio, come Linea A.

---

## 6. Catalogo episodi (un flusso = uno spot)

Il mezzo può comparire se **è il beat** (es. guasto al trincia). Non va tenuto identico negli altri episodi.

| Ep | Flusso | Soul | Gesto | UI vera da registrare | Blocco |
|---|---|---|---|---|---|
| **1** | **Segnalazione guasto** | Giuseppe | Trincia in frutteto → fumo → controllo arrabbiato → telefono | `segnalazione-guasti-standalone` (tipo macchina, attrezzo = trincia) | Scaletta §10. Prima take: still + clip 1. Higgsfield da cloud: 401, serve ri-auth. |
| **2** | **Zona lavorata / progressi** | Mario → Luca | H02a riuso → Mario a piedi ¾ + dolly → UI → mappa manager | `lavori-caposquadra-standalone` + tab Mappa Gestione lavori | Copione §12–§13. Clip 2 nuova (a piedi). |
| 3 | Magazzino — movimento / scarico | Giuseppe | Posa il sacco, guarda il telefono | `movimenti-standalone` (o home magazzino) | OTS `3dc29479` OK. Manca lo screen recording. Può aspettare: take già tenuta. |
| 4 | Crea lavoro (ufficio) | Luca | Al laptop / telefono, un cenno | form Gestione lavori (terreno, tipo, assegnatario) | Clip ufficio Luca non partita |
| 5 | Comunicazione squadra | Mario | Legge il telefono a bordo campo | thread comunicazioni / Impegni giorno | Mezzo in sfondo, non hero |
| 6 | Conferma lavoro | Giuseppe | Conferma sul telefono | conferma ricezione / stato lavoro | Stessa grammatica del magazzino |
| 7 | Preventivo conto terzi | Luca | Ufficio, scorre il preventivo | `nuovo-preventivo` / lista preventivi | |
| 8 | Buco squadra / sostituto | Mario | Telefono, breve sguardo al filare | shortlist sostituti su Gestione lavori | |
| 9 | Tony in chat | Luca | Parla, Tony riempie | widget Tony + form che si popola | UI vera obbligatoria sul “riempimento” |

Parco macchine, vendemmia meccanica, trattamenti: **stesso schema**. Il Soul consulta la lista / il form sul telefono. Non si genera il mezzo del catalogo.

Serie lunga (manager → capo → operaio, stile `v11` ~93s): si monta **dopo**, concatenando episodi già chiusi. Non si gira come un unico take.

---

## 7. Produzione di un episodio (checklist)

1. Scegliere **un** flusso. Un Soul per clip (ep. 2: Giuseppe poi Luca, mai insieme).  
2. Registrare la **UI vera** (emulatore o tenant di prova; niente UI finta). Piano medio del telefono: 9:16, stesso gesto (pollice che tocca).  
3. Prompt Higgsfield: **Pixar 3D** + Soul + gesto + ¾ OTS + dolly in. Schermo del telefono **non** deve essere leggibile.  
4. Take ~5s; se il gesto è lungo, due clip sullo stesso asse (gesto → dolly).  
5. Montaggio: coda dolly → testa UI. Musica unica. Logo.  
6. Crop 9:16 con volto + telefono al centro.

Non generare il pezzo Soul **prima** di avere la UI: senza match cut lo spot non chiude e si bruciano crediti.

---

## 8. Riferimenti da riusare / da non toccare

| Cosa | ID / nota |
|---|---|
| Grammatica dolly OK | `3dc29479-dcb5-4c64-b666-0e8a07b83988` (Giuseppe magazzino OTS) |
| Still magazzino B | `1e9a1a15-f168-49cb-b628-36b61afefa83` |
| Magazzino keep primi 4s | `bebce64c-6331-477b-9d23-7b6fee691869` |
| Soul Tony | `dfdc8ee8-1009-4240-87dd-2d8d91fbef59` |
| Soul Giuseppe | `aa4e8f90-21a3-4c43-bb6a-6ebeb213d057` |
| Soul Mario | `97dd3f71-ab41-45b8-ad00-e0de8182484d` |
| **Ep. 2 — clip 1 (riuso)** | I2V **TENERE** `hf_20260821_035909_aa26ab88-e4f6-41e7-8fe5-65b4e2953c5d` (H02a, trattore al lavoro seminativo) |
| **Ep. 2 — clip 2 (nuova)** | Still: Mario **a piedi tra trattore fermo (vicino) e bordo terra lavorata**, ¾ → I2V dolly telefono. Trattore + solco restano in frame |
| Ep. 1 — trattore compatto frutteto + trincia | Solo Giuseppe / guasto — **non** riusare in ep. 2 |
| Non riusare | `8ca92742` (UI finta), telefono girato verso camera, marche sui sacchi |
| Non mescolare | clip laptop / retino / mezzi giocattolo della Linea A |

---

## 9. Prossimo passo

- **Ora (produzione Soul):** episodio 1 — still A + clip 1 guasto (§10–§11). Cloud Higgsfield 401: gira in locale.
- **Ora (copione, questo foglio):** episodio 2 chiuso (§12–§13). Prima cosa da fare sul 2: **registrare le due UI** (due tocchi + mappa manager). Soul solo dopo.
- Magazzino resta in catalogo (ep. 3) con OTS già tenuto: non bruciare crediti lì finché manca lo screen recording.

---

## 10. Episodio 1 — Segnalazione guasto (Giuseppe)

Il trattore compatto da frutteto e il trincia **esistono solo qui** (Giuseppe, beat del guasto). L’ep. 2 usa il **trattore rosso di Mario** in seminativo (asset H02a), senza attrezzo posteriore. Niente marche, niente scritte sull’attrezzo.

**Fotogramma A (lock):** Pixar 3D (stesso look del magazzino). Alto, frutteto a filari (alberi da frutto, **non** vigneto). Trattore da frutteto compatto, colore unico (verde scuro o arancio, senza logo). Dietro: **trincia a mazze** che lavora l’erba nel viale. Giuseppe Soul al posto di guida. Erba tagliata visibile. **Niente fumo, niente fermo.** Tutte le clip 1–2 partono da questo still.

### Scaletta

| Clip | ~t | Immagine | Audio Higgsfield | Vietato |
|---|---|---|---|---|
| **1 Avvicinamento** | 0–5s | Parte dall’alto, camera scende / si avvicina mentre avanza tra i filari e il trincia taglia | Motore + trincia | Fumo, stop, telefono, parlato |
| **2 Guasto** | 5–10s | Stesso asse, più vicino, ¾ posteriore. Colpo metallico; **fumo grigio dal trincia** (attrezzo dietro), non dal cofano. Giuseppe gira la testa; rallenta | Bang + trincia che muore + sibilo | Esplosione, fiamme, fumo dal trattore |
| **3 Controllo + rabbia** | 10–15s | Fermo. Scende, va al trincia, vede il danno. **Arrabbiato**: mascella, gesto verso l’attrezzo (pugno / braccia). Non parla a camera | Passi, uccelli, metallo | Labiale italiano, urlo a noi, telefono già in mano |
| **4 Dolly telefono** | 15–20s | ¾ over-shoulder. Ancora teso. Tira fuori **il suo** telefono, guarda lui. Dolly verso lo schermo (spento / blur / di schiena) | Tasca, tap | Telefono girato verso di noi, UI inventata |
| **5 App vera** | 20–25s | Montaggio: `segnalazione-guasti` — tipo Macchina/Attrezzo, trattore + attrezzo trincia, gravità, dettagli | — | Recraft / dashboard finta |

### Decisioni chiuse (2026-09-03)

- **Stile Pixar 3D** su still e clip (non live-action). Stesso filo delle generazioni Soul già tenute.
- Fumo = dal **trincia**, modestamente (guasto meccanico, non incendio).
- Rabbia = **dopo** aver visto il danno, non mentre guida.
- Clip 1 **pulita** (senza fumo) per avere un lock riusabile.
- Un Soul per clip (solo Giuseppe).
- Seedance ~5s, 16:9, effetti accesi, **niente parlato** in generazione.
- Non generare clip 2–4 finché la 1 non è tenuta.

### Produzione

1. Still A Pixar 3D con Soul Giuseppe (`aa4e8f90-21a3-4c43-bb6a-6ebeb213d057`) + `soul_2` / `soul_cinematic`. Prompt: *Pixar 3D animated feature still, subsurface skin, stylized orchard, no photoreal.*
2. Clip 1 image-to-video da quello still (crane down, avanzamento, trincia al lavoro).
3. Se la 1 è OK: clip 2 dallo stesso still o dall’ultimo fotogramma utile della 1.
4. Screen recording form guasti (emulatore / tenant di prova).
5. Montaggio: 1→2→3→4→UI. Musica in edit.

---

## 11. Brief agente locale (Higgsfield)

Incollare all’agente Cursor **desktop** (Higgsfield autenticato). Non lanciare da cloud.

```
Sei l’agente di generazione Higgsfield per GFV Platform, Linea B (spot flussi app).

LEGGI PRIMA
- docs-sviluppo/COPIONE_SPOT_FLUSSI_APP.md (tutto, soprattutto §10–§11)
- Non mescolare con Linea A (docs-sviluppo/COPIONE_PRIMO_SPOT_SOCIAL.md: laptop, retino, mezzi giocattolo).

OBIETTIVO DI QUESTO TURNO (e basta)
1) Verificare che Higgsfield MCP sia autenticato (show_characters).
2) Confermare Soul Giuseppe ready.
3) get_cost, poi generare SOLO:
   - still A (fotogramma lock)
   - clip 1 image-to-video da quello still (~5s)
4) Mostrare still + clip e FERMARTI. Non clip 2–4, non UI, non montaggio, non musica.

SOUL
- Giuseppe: aa4e8f90-21a3-4c43-bb6a-6ebeb213d057
- Un solo soul_id per generazione. Modelli still: soul_2 o soul_cinematic (solo questi accettano Soul).
- Non usare Tony / Mario / Luca. Non l’uomo in camicia verde.

STILE (vincolo duro)
- Pixar 3D animated feature. Stesso filo delle take Soul già tenute (magazzino Giuseppe 3dc29479).
- Vietato: live-action, photoreal, documentary, cartoon 2D Linea A.
- Prompt always include: "Pixar 3D animated feature, stylized subsurface skin, cinematic lighting, no photoreal, no live-action".

SCENA — still A (lock)
- Vista dall’alto (high aerial / crane start) su frutteto a filari (alberi da frutto, NON vigneto).
- Trattore da frutteto compatto, un colore (verde scuro o arancio), NESSUN logo / scritta / marca.
- Dietro: trincia a mazze (flail mower) che lavora l’erba nel viale. Erba tagliata visibile.
- Giuseppe Soul al posto di guida, riconoscibile, caschetto/abiti da campo coerenti col Soul.
- Niente fumo, niente fermo, niente telefono, niente persone extra.
- 16:9.

CLIP 1 (da still A)
- Motore: Seedance 2.0 (non 2.5: 2.0 rispetta start_image). start_image = job/media dello still A.
- ~5s, 16:9, 720p finché non approvata, audio effetti ON, niente parlato, niente musica.
- Camera scende / si avvicina (crane down + gentle push) mentre il trattore avanza tra i filari e il trincia taglia.
- Giuseppe guida, concentratto, non arrabbiato.
- Vietato in clip 1: fumo, stop, telefono, taglio di asse, seconda camera.

DOPO (non ora)
Clip 2 fumo dal TRINCIA (non dal cofano). Clip 3 scende + rabbia. Clip 4 dolly ¾ OTS sul SUO telefono (schermo spento/di schiena). Clip 5 = UI vera segnalazione-guasti, MAI generata.

HIGGSFIELD — procedura
1. get_workflow_instructions senza argomento; questa è generazione Soul+Seedance, NON ugc-website, NON faceless, NON ad-multiplier.
2. show_characters action=list status=ready; se Giuseppe non è ready, STOP.
3. models_explore get su soul_2 / soul_cinematic e seedance 2.0 (aspect, soul_id, start_image role).
4. generate_image get_cost:true; poi genera still (count 1). use_unlim solo se l’utente lo chiede esplicitamente.
5. Se lo still ha marche, fumo, vigneto, volto sbagliato o look fotoreale: NON fare il video; mostra e chiedi.
6. generate_video Seedance 2.0, get_cost:true, poi 1 take. medias start_image = still approvato/ok.
7. Restituisci job id still + job id clip 1. Stop.

PROMPT STILL (inglese, da usare così, adatta solo se il modello rifiuta soul_id)

Pixar 3D animated feature still, 16:9. High aerial view looking down a fruit orchard (apple or peach trees in neat rows, NOT a vineyard). A compact orchard tractor (solid dark green, no logos, no brand text) drives between the rows. A rear flail mower (trincia) is working, freshly cut grass in the alley. Giuseppe, the trained Soul character, sits in the driver's seat, clearly readable from above, field clothes, focused, not angry. Stylized Pixar subsurface skin, cinematic morning light, clean sky. No smoke, no fire, no phone, no other people, no readable text, no photoreal, no live-action.

PROMPT CLIP 1 (image-to-video)

Locked to the start frame. Pixar 3D animated feature. Camera crane-down from high aerial toward the tractor as it slowly advances between fruit-tree rows. The rear flail mower spins and cuts grass. Giuseppe stays in the seat, driving, calm and focused. Continuous single shot, no cut. Engine and mower SFX only. No smoke, no stopping, no phone, no speech, no music, no logos, no photoreal.

VIETATO
- Clip 2–4 in questo turno
- UI / dashboard / Recraft (8ca92742)
- Parlato italiano in generazione
- Marche su trattore/trincia
- Fumo o rabbia in clip 1
- Riusare clip Linea A (laptop, retino) o start frame sbagliati (24a8eca6, 47ad0a1e, c4b295dd)
- Bruciare crediti se Higgsfield non è auth o Giuseppe non è ready
```

---

## 12. Episodio 2 — Zona lavorata / progressi (Mario → Luca)

**Perché questo e non il magazzino.** L’ep. 1 è l’eccezione (il mezzo si rompe). L’ep. 2 è il ritmo di ogni giorno: il **caposquadra** segna quanto ha fatto la squadra, il manager vede i progressi **senza telefonata**. Il magazzino ha già un OTS tenuto (`3dc29479`): può aspettare. La mappa a due tocchi è il gesto più nuovo e più filmabile dell’app.

**Catena ruoli (prodotto).** Manager assegna il lavoro al caposquadra → il capo coordina la squadra in campo → **il capo traccia la zona lavorata** ogni giorno (`SPECIFICA_DASHBOARD_RUOLI.md`). L’operaio segna la zona **solo** su lavori **autonomi** (`operaioId` senza `caposquadraId`). Questo spot racconta il caso tipico — **lavoro di squadra** — quindi **Mario**, non Giuseppe.

**Una frase.** Mario erpica il seminativo; scende, due tocchi sul telefono accanto al solco; la zona diventa verde. In ufficio Luca la vede sulla mappa — niente telefonata.

### Montaggio in tre atti (decisione 2026-09-07)

1. **Lavoro** — riuso clip H02a (trattore rosso al lavoro, seminativo).
2. **Segna** — clip **nuova**: Mario **sceso**, **a pochi metri dal trattore fermo** e **sul bordo della terra lavorata** (entrambi in frame), **¾**, dolly sul **suo** telefono → UI vera (due tocchi + Salva).
3. **Manager vede** — UI Gestione lavori, tab Mappa (zona verde, ha, %, In tempo). Il salvataggio **è** l’invio al manager (niente pulsante inventato).

### Personaggi e set (contrasto con ep. 1)

| | Ep. 1 guasto | Ep. 2 zona |
|---|---|---|
| Soul in campo | Giuseppe | **Mario** (caposquadra) |
| Soul in ufficio | — | Luca (clip breve opz., **mai** con Mario in frame) |
| Luogo | Frutteto + trincia | **Seminativo** |
| Trattore | Compatto frutteto + trincia | **Rosso H02a** — in clip 1 al lavoro; in clip 2 **fermo sullo sfondo** |
| Posizione Mario clip 2 | — | **A piedi** tra **trattore fermo** (vicino, leggibile) e **bordo terreno lavorato** — i piedi sul solco o appena fuori |
| Emozione | Rabbia | Calma, fine pezzo |
| Hero | Il guasto | **Due tocchi** + mappa che si colora |

Giuseppe fuori. H02b (dolly in cabina) resta per il v11/C02 — **non** per questo episodio.

### Composizione clip 2 (vincolo duro)

Mario **non** è in campo lontano dal mezzo, **non** è solo davanti a un muro di terra senza trattore, **non** è in cabina.

In ogni fotogramma utile devono leggersi **insieme**:
1. **Mario** a piedi, ¾.
2. Il **trattore rosso fermo** a pochi metri (porta, gradino o ruota posteriore visibili — stesso asset H02a).
3. Il **confine** tra terreno **già lavorato** (sotto i piedi / accanto) e pezzo ancora da fare.

È la posa naturale del capo che scende e segna subito il pezzo appena fatto, senza allontanarsi.

### Prodotto (vincoli duri — non inventare UI)

Flusso vero, già pubblicato (`zonaLavorataDuePunti`, `enabledAlways`):

1. Terreno **già** con perimetro in Terreni.
2. **Mario** (caposquadra) apre **Segna zona lavorata** su un lavoro di squadra (`caposquadraId`, senza `operaioId`).
3. Tocca **inizio** e **fine** sul bordo del campo. La zona è una **fetta del perimetro già tracciato** (tagli allineati ai lati, non la diagonale I→F).
4. Anteprima **verde** + ettari. Poi **Salva zona**.
5. Luca, tab **Mappa** di Gestione lavori: zona del giorno (verde = giorno 1), superficie, % di completamento, badge **In tempo**.

**Vietato in UI e in Soul:** disegno a mano come gesto hero; trail GPS; heatmap inventata; Recraft; due Soul nello stesso frame; frutteto / trincia / fumo (ep. 1); trattore compatto frutteto dell’ep. 1; parlato in generazione; Giuseppe come chi segna.

Numeri da tenere in registrazione (leggibili in 2s): **1,4 ha oggi · 42% · 1 / 3 giorni · In tempo**. Lavoro: **Erpicatura** (o fresatura) su **seminativo** già in anagrafe — lavoro **di squadra** assegnato a Mario. In UI opzionale: larghezza attrezzo ~3 m.

### Scaletta (~30–36s)

| Clip | ~t | Chi | Immagine | Note montaggio |
|---|---|---|---|---|
| **1 Lavoro (riuso)** | 0–5s | Mario | **Riuso H02a** `aa26ab88` — trattore rosso erpica il seminativo (solco, polvere leggera). Preferire i secondi centrali; tagliare blink in/out | Zero crediti. Stesso asset trattore per coerenza clip 2 |
| **2 Segna (nuova)** | 5–10s | Mario | **Still + I2V nuovi.** Mario **sceso**, **accanto al trattore fermo** (pochi metri, mezzo leggibile in frame) **e** sul **bordo terreno lavorato** (piedi sul solco). **¾**. Guarda il pezzo fatto, tira fuori il telefono, **dolly ¾ OTS** verso schermo spento/nero. Trattore + terra lavorata restano visibili sullo sfondo durante il dolly | Generare solo dopo U1. **Non** H02b. **Non** Mario lontano dal trattore |
| **3 App capo** | 10–18s | — | UI 9:16: `lavori-caposquadra-standalone` → **Segna zona lavorata** → tap inizio → tap fine → verde + `1,40 ha` → **Salva zona** | Match cut: coda dolly clip 2 → pollice su primo tap |
| **4 Manager vede** | 18–28s | Luca opz. | UI: Gestione lavori → tab **Mappa** — zona verde di oggi, `1,40 ha`, **42%**, **In tempo**. Opz.: 2s Luca ufficio (dolly) prima di U2 | Salvataggio = dato sul manager, niente «Invia» inventato |
| **5 Chiusura** | 28–32s | Tony opz. | Logo GFV + `globalfarmview.net` | Battuta opz.: *Oggi si vede da qui.* |

**Transizione 1→2:** il trattore in H02a **si ferma**; clip 2 parte con Mario **già sceso**, **a lato del mezzo**, piedi sul bordo del solco. Stesso seminativo, stessa luce, trattore e terra lavorata nello stesso piano.

### UI da registrare prima delle take Soul

Due clip, tenant di prova / emulatore, **niente dati di produzione**. Piano medio del telefono 9:16, pollice visibile sui tap.

**U1 — Caposquadra** (`core/admin/lavori-caposquadra-standalone.html`, login **Mario** / ruolo caposquadra)

- Lavoro **di squadra** assegnato a Mario (`caposquadraId`, **senza** `operaioId`), terreno con `polygonCoords`, stato in corso.
- Apri **Segna zona lavorata**. Data = oggi. Larghezza opzionale (se meccanico: es. 3 m — ok se compare, non è il focus).
- Hint visibile: due tocchi, zona che segue i bordi.
- Tap 1 (inizio) → tap 2 (fine) → anteprima verde → etichetta **Superficie lavorata** ~1,40 ha → **Salva zona**.
- Non aprire «A mano». Non usare account operaio / lavoro autonomo.

**U2 — Manager** (Gestione lavori, dettaglio lavoro, tab Mappa)

- Stesso lavoro, dopo il salvataggio (o reload).
- Mappa con poligono terreno + zona del giorno **verde**.
- Lista zone: data di oggi, `1,40 ha`.
- Quadro progresso: 42%, **In tempo**, `1 / 3 giorni` se entra in inquadratura.
- Info window al tap sulla zona solo se non ruba tempo: nome lavoro, data, superficie.

Match cut: coda dolly clip 2 → testa U1. U2 può aprirsi direttamente o dopo 1–2s di Luca (opz.).

### Decisioni chiuse (2026-09-07)

- **Clip 1 = riuso H02a** (trattore al lavoro). **Clip 2 = nuova** (Mario a piedi, ¾, dolly telefono). **Non** H02b cabina.
- **Seminativo**, erpicatura, lavoro di squadra, Mario caposquadra.
- Trattore rosso H02a **fermo e vicino** a Mario in clip 2 (non sullo sfondo lontano).
- Composizione: Mario + trattore + bordo terra lavorata **nello stesso frame**.
- UI vera obbligatoria prima della clip 2 Soul. Salvataggio zona = manager vede in mappa (no CTA inventata).
- Seedance ~5s clip 2, 16:9, effetti ON, niente parlato in generazione.
- Non generare clip 2 finché U1/U2 non sono registrate e H02a è in timeline.

### Produzione (ordine)

1. Registrare **U1** + **U2** (seminativo, login caposquadra Mario).
2. Montare **bozza** con H02a in testa — verificare transizione verso clip 2.
3. Still clip 2: Mario a piedi **tra trattore fermo (vicino) e bordo terreno lavorato**, ¾ — entrambi in composizione.
4. I2V clip 2: tira fuori telefono, guarda lui, dolly ¾ OTS verso schermo nero → match U1.
5. Montaggio finale: H02a → clip 2 → U1 → (Luca opz.) → U2 → logo.

**Nota episodio autonomo (fuori da questo spot).** Se un giorno servisse un secondo take «Giuseppe a piedi», sarebbe un episodio a parte con lavoro `operaioId` — non mescolarlo qui.

---

## 13. Brief agente locale (Higgsfield) — episodio 2 clip 2 (Mario a piedi)

Incollare all’agente Cursor **desktop** **dopo** U1/U2 registrate e H02a in timeline. Genera **solo clip 2** (Mario sceso, ¾, dolly). **Non** rigenerare H02a. **Non** usare H02b cabina.

```
Sei l’agente di generazione Higgsfield per GFV Platform, Linea B, EPISODIO 2 — CLIP 2 SOLO.

LEGGI: docs-sviluppo/COPIONE_SPOT_FLUSSI_APP.md §12–§13.

OBIETTIVO
1) show_characters — Mario ready (97dd3f71-ab41-45b8-ad00-e0de8182484d).
2) get_cost → still B (Mario a piedi, seminativo, trattore rosso fermo dietro).
3) get_cost → clip 2 I2V da still B (~5s): ¾ OTS, tira fuori telefono, dolly verso schermo nero.
4) Stop. Non UI, non Luca, non H02a, non H02b.

PRECONDIZIONI
- U1 (due tocchi + Salva) registrata.
- H02a (aa26ab88) già scelto in montaggio per clip 1.

SOUL: Mario 97dd3f71-ab41-45b8-ad00-e0de8182484d — un solo soul_id.

STILE: Pixar 3D. Stesso trattore rosso e seminativo di H02a. No photoreal.

STILL B (lock)
- Tardo pomeriggio, seminativo.
- Mario Soul IN PIEDI, ¾, **a pochi metri dal trattore rosso FERMO** (stesso look H02a: porta cabina o ruota posteriore leggibili).
- **Piedi sul bordo del terreno lavorato** (solco erpicato sotto / accanto ai piedi); davanti a lui il pezzo fatto, dietro o di lato il da fare.
- Trattore e terra lavorata **entrambi in frame**, non solo sfondo sfocato lontano.
- Niente telefono in mano (o in tasca). Niente frutteto, fumo, altre persone.
- 16:9.

CLIP 2 (I2V da still B)
- Seedance 2.0, ~5s, 16:9, audio effetti ON, no speech, no music.
- Mario stays on foot **beside the stopped tractor and worked soil edge**. Pulls out phone, ¾ OTS dolly toward dark screen.
- **Tractor and worked ground remain visible** in background during dolly (do not crop them out).
- Vietato: in cabina, far from tractor, phone toward camera, invented UI, H02b.

PROMPT STILL

Pixar 3D animated feature still, 16:9. Late-afternoon seminativo. Mario, trained Soul, stands three-quarter view ON THE EDGE of the worked soil strip, feet beside fresh furrows. The same red generic tractor as H02a is STOPPED only a few meters away (door or rear wheel clearly visible, not distant). Worked earth underfoot, unworked field beyond. Calm field clothes. No phone in hand, no orchard, no smoke, no logos, no photoreal.

PROMPT CLIP 2

Locked to start frame. Pixar 3D. Mario on foot beside the stopped red tractor and worked soil edge pulls out his phone, looks down. Three-quarter over-shoulder dolly toward dark phone screen. Tractor and worked furrows stay visible in frame behind him. Field wind, no speech, no music, no invented UI, no photoreal.

VIETATO: Mario lontano dal trattore; trattore fuori campo; solo terra senza mezzo; H02b cabina; rigenerare H02a; UI; Luca; parlato IT.
```
