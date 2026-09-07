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
| **2** | **Zona lavorata / progressi** | Mario → Luca | Seminativo, trattore rosso fermo + dolly cabina H02b | `lavori-caposquadra-standalone` (capo, due punti) + tab Mappa Gestione lavori | Copione §12. Riuso H02b per clip 2 se possibile. |
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
| **Ep. 2 — trattore Mario (seminativo)** | Still `Mario_trattore_lavora_terra` (clip 1, fermo) · still `Mario_trattore_rosso_cabina_telefono` (clip 2) · I2V dolly **TENERE** `hf_20260821_042905_cb1763fb-1c09-4152-b2b5-3c552f96260e` (H02b) |
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

Il trattore compatto da frutteto e il trincia **esistono solo qui** (Giuseppe, beat del guasto). L’ep. 2 usa il **trattore rosso di Mario** in seminativo (asset H02a/H02b), senza attrezzo posteriore. Niente marche, niente scritte sull’attrezzo.

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

**Una frase.** Fine giornata in **seminativo**. Mario ferma il trattore al bordo del pezzo erpicato, due tocchi sul telefono, la fetta diventa verde. In ufficio Luca apre la mappa: ettari di oggi, percentuale, in tempo.

### Personaggi e set (contrasto con ep. 1)

| | Ep. 1 guasto | Ep. 2 zona |
|---|---|---|
| Soul in campo | Giuseppe | **Mario** (caposquadra) |
| Soul in ufficio | — | Luca (clip sue, **mai** nello stesso fotogramma) |
| Luogo | Frutteto + trincia | **Seminativo** (campo aperto, solchi / terreno lavorato) |
| Trattore | Compatto frutteto (verde scuro o arancio) + trincia | **Rosso, stesso asset Mario** di H02a/H02b — **fermo**, senza attrezzo |
| Emozione | Rabbia dopo il danno | Calma, giornata chiusa |
| Hero | Il guasto | I **due tocchi** + la mappa che si colora |

Giuseppe fuori: non è un lavoro autonomo. Il payoff resta manager (Luca), ma chi segna è il capo.

**Perché seminativo + stesso trattore Mario.** L’erpicatura in seminativo è il caso tipico meccanico di squadra; il campo aperto si legge bene in due tocchi sulla mappa. **Non** si reinventa il mezzo: si riusa il **trattore rosso in cabina** già tenuto (`Mario_trattore_lavora_terra` / `Mario_trattore_rosso_cabina_telefono`, clip dolly `hf_20260821_042905_cb1763fb`). Resta distinto dal compatto+trincia dell’ep. 1 (Giuseppe, frutteto).

### Prodotto (vincoli duri — non inventare UI)

Flusso vero, già pubblicato (`zonaLavorataDuePunti`, `enabledAlways`):

1. Terreno **già** con perimetro in Terreni.
2. **Mario** (caposquadra) apre **Segna zona lavorata** su un lavoro di squadra (`caposquadraId`, senza `operaioId`).
3. Tocca **inizio** e **fine** sul bordo del campo. La zona è una **fetta del perimetro già tracciato** (tagli allineati ai lati, non la diagonale I→F).
4. Anteprima **verde** + ettari. Poi **Salva zona**.
5. Luca, tab **Mappa** di Gestione lavori: zona del giorno (verde = giorno 1), superficie, % di completamento, badge **In tempo**.

**Vietato in UI e in Soul:** disegno a mano come gesto hero; trail GPS; heatmap inventata; Recraft; due Soul nello stesso frame; frutteto / trincia / fumo (ep. 1); trattore compatto frutteto dell’ep. 1; parlato in generazione; Giuseppe come chi segna.

Numeri da tenere in registrazione (leggibili in 2s): **1,4 ha oggi · 42% · 1 / 3 giorni · In tempo**. Lavoro: **Erpicatura** (o fresatura) su **seminativo** già in anagrafe — lavoro **di squadra** assegnato a Mario. In UI opzionale: larghezza attrezzo ~3 m.

### Scaletta (~28–32s)

Due blocchi Soul (Mario, poi Luca). Ogni blocco rispetta la grammatica §4. UI **tra** i due blocchi, non in Higgsfield.

| Clip | ~t | Chi | Immagine | Audio Higgsfield | Vietato |
|---|---|---|---|---|---|
| **1 Fine pezzo** | 0–5s | Mario | Still A: **seminativo**, tardo pomeriggio. **Stesso trattore rosso Mario** (H02a), **fermo** al bordo del pezzo erpicato (solco/terreno lavorato vs da fare). Mario in **cabina**, guarda indietro sul tratto fatto. Motore spento. Niente telefono. Camera ferma o lieve push | Motore che si spegne, vento campo | Trincia, fumo, frutteto, vigneto, telefono, parlato |
| **2 Dolly cabina** | 5–10s | Mario | **Riuso preferito:** clip H02b tenuta (`cb1763fb`) — ¾ cabina, telefono schermo nero, **dolly verso display**. Alternativa: rigenerare da still `Mario_trattore_rosso_cabina_telefono` con stesso prompt/asse. In montaggio: zoom ultimi 0,5 s se serve match cut su U1 | Tasca, tap (se rigenerata) | Telefono verso camera, UI inventata, scende dal trattore |
| **3 App caposquadra** | 10–18s | — | Montaggio, 9:16 telefono: `lavori-caposquadra-standalone` (sessione **caposquadra**) → **Segna zona lavorata** → tap inizio → tap fine → fetta verde + `1,40 ha` → **Salva zona** | — (tap in edit se serve) | «A mano», Recraft, GPS, poligono libero, account operaio |
| **4 Ufficio** | 18–23s | Luca | Ufficio, polo, laptop o telefono. Un cenno verso lo schermo (schermo Higgsfield spento). Dolly breve ¾, stesso look Pixar | Ufficio, click | Parlato, UI finta, Mario in stanza |
| **5 App manager** | 23–30s | — | Montaggio: Gestione lavori → tab **Mappa**. Compare la zona verde di oggi, lista `1,40 ha`, percentuale **42%**, badge **In tempo**. Niente overlay inventato | — | `mappa-aziendale` come unica inquadratura se il dettaglio lavoro non si legge; dashboard Recraft |
| **6 Chiusura** | 30–32s | Tony opz. | Logo GFV + `globalfarmview.net`, oppure Tony cenno col cappello (muto) | — | Battuta in generazione |

Battuta in montaggio (opzionale, sulla coda di clip 5 o sul cenno di Tony), voce tua / Chirp3 Charon come v11:

> Oggi si vede da qui.

Non obbligatoria. Se c’è, **Gi Effe Vu** solo se si dice il marchio in chiusura (stesso §10.20 dello spot v11).

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

Match cut: coda dolly Mario → testa U1 (pollice già sul primo tap). Coda dolly Luca → testa U2 (mappa già aperta, zona che «arriva» o è appena comparsa).

### Decisioni chiuse (2026-09-07, agg. ruoli)

- Episodio **2** della serie. Il beat è **segna (capo) → vede (manager)**.
- **Mario** segna (lavoro di squadra), **Luca** legge. Giuseppe fuori.
- **Seminativo** + **trattore rosso Mario** (asset H02a/H02b), fermo in cabina. **Non** il compatto+trincia dell’ep. 1.
- **Clip 2:** riuso diretto H02b (`cb1763fb`) se il look combacia; altrimenti rigenerare da stesso still cabina.
- Gesto hero = **due tocchi** sul perimetro già tracciato. Disegno a mano = fallback, non si mostra.
- Niente GPS continuo (decisione prodotto §11.5).
- Due Soul, clip separate. UI vera obbligatoria; senza U1/U2 non si genera Soul.
- Seedance ~5s, 16:9, effetti accesi, **niente parlato** in generazione.
- Non generare clip 2 (Mario) né il blocco Luca finché clip 1 non è tenuta.
- Still A pulito: niente telefono, niente fumo.

### Produzione

1. Registrare **U1** (sessione caposquadra) e **U2** (emulatore / tenant di prova). Terreno demo = **seminativo** con perimetro.
2. **Clip 1:** still A da `Mario_trattore_lavora_terra` (variante **fermo** a fine pezzo erpicato) + Soul Mario (`97dd3f71-ab41-45b8-ad00-e0de8182484d`) → I2V Seedance ~5s. Oppure ultimo fotogramma utile di H02a con freeze/match se già coerente.
3. **Clip 2:** **riuso** `hf_20260821_042905_cb1763fb` (H02b) — niente crediti se il take è pulito. Se rigeneri: still `Mario_trattore_rosso_cabina_telefono`, stesso dolly ¾ verso schermo nero.
4. Still Luca + clip 4 (ufficio, dolly).
5. Montaggio: 1 → 2 (o H02b) → U1 → 4 → U2 → logo. Match cut: coda dolly → pollice su primo tap U1. Musica in edit.

**Nota episodio autonomo (fuori da questo spot).** Se un giorno servisse un secondo take «Giuseppe a piedi», sarebbe un episodio a parte con lavoro `operaioId` — non mescolarlo qui.

---

## 13. Brief agente locale (Higgsfield) — episodio 2 clip 1

Incollare all’agente Cursor **desktop** (Higgsfield autenticato) **dopo** aver registrato U1 (sessione **caposquadra**). Non lanciare da cloud. Non lanciare se U1 non esiste.

```
Sei l’agente di generazione Higgsfield per GFV Platform, Linea B (spot flussi app), EPISODIO 2.

LEGGI PRIMA
- docs-sviluppo/COPIONE_SPOT_FLUSSI_APP.md §4, §5, §12, §13
- Non mescolare con Linea A (laptop, retino) né con l’episodio 1 (frutteto, trincia in fumo, rabbia Giuseppe).

OBIETTIVO DI QUESTO TURNO (e basta)
1) Verificare Higgsfield MCP autenticato (show_characters).
2) Confermare Soul Mario ready (97dd3f71-ab41-45b8-ad00-e0de8182484d).
3) get_cost, poi generare SOLO (se H02b NON è riusabile in montaggio):
   - still A (seminativo, Mario in cabina trattore rosso FERMO, niente telefono)
   - clip 1 image-to-video da quello still (~5s)
4) Se H02b (cb1763fb) è già OK per clip 2, NON rigenerare il dolly — mostra still + clip 1 e FERMARTI.

PRIMA DI GENERARE
- Controlla se puoi montare clip 2 con H02b tenuta: hf_20260821_042905_cb1763fb-1c09-4152-b2b5-3c552f96260e (stesso trattore rosso, dolly cabina). Se sì, genera solo clip 1.

PRECONDIZIONE
Se l’utente non ha la screen recording U1 (caposquadra, due tocchi + salva zona), STOP. Non bruciare crediti.

SOUL
- Mario: 97dd3f71-ab41-45b8-ad00-e0de8182484d
- Un solo soul_id. Modelli still: soul_2 o soul_cinematic.
- Non usare Tony / Giuseppe / Luca. Non l’uomo in camicia verde.

STILE (vincolo duro)
- Pixar 3D animated feature. Stesso filo H02a/H02b (trattore rosso Mario, seminativo).
- Vietato: live-action, photoreal, documentary, cartoon 2D Linea A, frutteto, trincia ep. 1.
- Prompt always include: "Pixar 3D animated feature, stylized subsurface skin, cinematic lighting, no photoreal, no live-action".

SCENA — still A (lock) — basata su Mario_trattore_lavora_terra, ma FERMO
- Tardo pomeriggio, **seminativo** (open arable field, furrows, NOT vineyard, NOT orchard).
- **Same red tractor** as H02a/H02b (generic, no logos, NO rear implement).
- Mario Soul in CABIN, ¾, looks back along the **just-worked** strip (worked soil vs untouched).
- Tractor STOPPED, engine off. Calm end-of-day.
- Niente telefono, niente fumo, niente trincia, niente frutteto, niente altre persone, niente testo.
- 16:9.

CLIP 1 (da still A) — solo se serve nuova clip 1
- Motore: Seedance 2.0. start_image = still A.
- ~5s, 16:9, 720p, audio effetti ON, niente parlato, niente musica.
- Lieve push-in. Mario in cab turns head along worked field strip, exhales. Tractor stays still.
- Vietato: telefono, moving tractor, smoke, orchard, vineyard, anger, speech.

CLIP 2 — NON generare se H02b cb1763fb va in montaggio
- Riuso diretto: hf_20260821_042905_cb1763fb (¾ cabina, dolly verso telefono nero).
- Se rigeneri: still Mario_trattore_rosso_cabina_telefono, stesso movimento H02b.

HIGGSFIELD — procedura
1. get_workflow_instructions senza argomento; questa è generazione Soul+Seedance, NON ugc, NON faceless, NON ad-multiplier.
2. show_characters action=list status=ready; se Mario non è ready, STOP.
3. models_explore get su soul_2 / soul_cinematic e seedance 2.0.
4. generate_image get_cost:true; poi 1 still. use_unlim solo se l’utente lo chiede.
5. Se lo still ha trincia, frutteto, vigneto, telefono, trattore in movimento, volto sbagliato o look fotoreale: NON fare il video; mostra e chiedi.
6. generate_video Seedance 2.0, get_cost:true, poi 1 take.
7. Restituisci job id still + job id clip 1. Stop.

PROMPT STILL (inglese)

Pixar 3D animated feature still, 16:9. Late-afternoon open arable field (seminativo), furrows, worked soil. The same red generic tractor as reference H02a, STOPPED at the edge of the worked strip (no logos, no rear implement). Mario, the trained Soul character, sits in the driver's cab, field clothes, calm, looking back along the strip he just finished. Engine off. Stylized Pixar subsurface skin, warm cinematic light. No phone, no smoke, no flail mower, no orchard, no vineyard, no other people, no readable text, no photoreal, no live-action.

PROMPT CLIP 1 (image-to-video)

Locked to the start frame. Pixar 3D animated feature. Gentle camera push-in. Mario in the stopped red tractor cab slowly turns his head along the finished worked field strip, exhales. Tractor stays still, engine off. Field wind only. Continuous single shot. No orchard, no vineyard, no smoke, no moving tractor, no phone, no speech, no music, no logos, no photoreal.

VIETATO
- Rigenerare clip 2 se H02b cb1763fb è già OK
- Clip 2+ Luca, UI, Recraft (8ca92742)
- Parlato italiano in generazione
- Frutteto / trincia / fumo (episodio 1 Giuseppe)
- Trattore compatto frutteto ep. 1
- Giuseppe al posto di Mario
- Telefono in still A o clip 1
- Riusare clip Linea A o start frame sbagliati (24a8eca6, 47ad0a1e, c4b295dd)
- Bruciare crediti se Higgsfield non è auth, Mario non è ready, o manca U1
```
