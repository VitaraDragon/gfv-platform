# COPIONE SPOT FLUSSI APP (Linea B)

**Stato:** formato chiuso (2026-09-02). Episodio in produzione: **segnalazione guasto** (2026-09-03).  
**Linea:** serie feature. Non mescolare con lo spot brand (`COPIONE_PRIMO_SPOT_SOCIAL.md`, laptop + retino).  
**Durata per episodio:** ~20–30s (guasto ha più beat). Master **16:9**, poi crop **9:16** (azione / volto + telefono al centro).  
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
| 2 | Magazzino — movimento / scarico | Giuseppe | Posa il sacco, guarda il telefono | `movimenti-standalone` (o home magazzino) | OTS `3dc29479` OK. Manca lo screen recording. |
| 3 | Crea lavoro (ufficio) | Luca | Al laptop / telefono, un cenno | form Gestione lavori (terreno, tipo, assegnatario) | Clip ufficio Luca non partita |
| 4 | Comunicazione squadra | Mario | Legge il telefono a bordo campo | thread comunicazioni / Impegni giorno | Mezzo in sfondo, non hero |
| 5 | Conferma lavoro | Giuseppe | Conferma sul telefono | conferma ricezione / stato lavoro | Stessa grammatica del magazzino |
| 6 | Preventivo conto terzi | Luca | Ufficio, scorre il preventivo | `nuovo-preventivo` / lista preventivi | |
| 7 | Mappa / avanzamento | Luca | Guarda telefono o monitor | `mappa-aziendale` (progresso, allarmi) | |
| 8 | Buco squadra / sostituto | Mario | Telefono, breve sguardo al filare | shortlist sostituti su Gestione lavori | |
| 9 | Tony in chat | Luca | Parla, Tony riempie | widget Tony + form che si popola | UI vera obbligatoria sul “riempimento” |

Parco macchine, vendemmia meccanica, trattamenti: **stesso schema**. Il Soul consulta la lista / il form sul telefono. Non si genera il mezzo del catalogo.

Serie lunga (manager → capo → operaio, stile `v11` ~93s): si monta **dopo**, concatenando episodi già chiusi. Non si gira come un unico take.

---

## 7. Produzione di un episodio (checklist)

1. Scegliere **un** flusso e **un** Soul.  
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
| Non riusare | `8ca92742` (UI finta), telefono girato verso camera, marche sui sacchi |
| Non mescolare | clip laptop / retino / mezzi giocattolo della Linea A |

---

## 9. Prossimo passo

Episodio 1 — Segnalazione guasto: still A (aereo pulito) → clip 1 crane down. Clip 2–4 solo se la 1 è approvata. UI vera in parallelo (`core/admin/segnalazione-guasti-standalone.html`).

---

## 10. Episodio 1 — Segnalazione guasto (Giuseppe)

Il trattore e il trincia **esistono solo qui**: servono al beat del guasto, non vanno replicati negli altri episodi. Niente marche, niente scritte sull’attrezzo.

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
