# Video GFV — Storyboard, script e lista clip

**Data:** 2026-08-03 (note mappe demo: 2026-08-04; produzione clip/personaggi: 2026-08-20; sceneggiatura giornata: 2026-08-20 sera; **primo taglio spot ffmpeg: 2026-08-23/24**; **Linea B trattamento Mario Higgsfield: 2026-09-10**; **Linea B movimento magazzino Higgsfield: 2026-09-10**; **Linea B sostituzioni Higgsfield: 2026-09-16**)  
**Stato:** clip UI C01–C05 girate; lock personaggi + H01–H08 tenuti; **primo montaggio spot commerciale fatto in ffmpeg** (cartella `Documents\primo video spot GFV`). Taglio di lavoro **v11**; pronuncia GFV bloccata su **v10**. **Serie feature Linea B:** Higgsfield **trattamento Mario** chiuso (§12); Higgsfield **movimento magazzino** chiuso (§13); Higgsfield **sostituzioni** cartoon I2V chiuso (§14); UI reale di trattamento/magazzino/sostituzioni ancora da girare. Filmora resta opzione per un secondo passaggio (mockup telefono, taglio prof). UI sempre reale.  
**Documento padre:** `PIANO_VIDEO_PRESENTAZIONE_PROF_E_RIUSO_COMMERCIALE.md`  
**Tenant demo:** `docs-sviluppo/da-fare/demo/PIANO_TENANT_DEMO_PRODUZIONE.md` §6.1 (geo v2)  
**Stile visivo:** personaggi 3D stilizzati come Tony FAB (`core/images/tony-icon.png`); UI sempre reale  
**Registrazione:** tutto da **PC** (manager desktop; capo/operaio in Chrome DevTools modalità telefono ~390px). Telefono fisico non obbligatorio.

---

## 1. Flussi reali confermati (usabili in demo)

| # | Ruolo | Flusso | Pagine | Maturità |
|---|-------|--------|--------|----------|
| A | Manager | Crea/assegna lavoro + quadro giornata | `core/admin/gestione-lavori-standalone.html` · `modules/manodopera/views/manodopera-home-standalone.html` · `impegni-giornalieri-standalone.html` | Demo-ready |
| B | Caposquadra | Vede il lavoro → comunicazione all’operaio | `core/mobile/field-workspace-standalone.html` (Comunicazioni) | Demo-ready |
| C | Operaio + Tony | Segnatura ore (con voce Tony) | `core/mobile/field-workspace-standalone.html` | Demo-ready (E2E) |
| D | Caposquadra | Valida le ore dell’operaio | field-workspace (Valida ore) / `validazione-ore-standalone.html` | Demo-ready |
| E | Manager | Chiude il ciclo (ore/lavori aggiornati) | hub / impegni / validazione desktop | Demo-ready |
| F | Opzionale | Guasto macchina → officina | `segnalazione-guasti-standalone.html` → `guasti-list-standalone.html` | Demo-ready (secondario) |

### Note operative
- Comunicazioni = messaggi operativi strutturati (non chat libera).
- In registrazione: **audio sistema ON** quando Tony parla (TTS).
- Guasto: scene opzionali; non spezza il ciclo principale manodopera.
- **Setup ufficiale video (Tony cloud OK):** switcher produzione →  
  `http://127.0.0.1:8000/core/dev/demo-switcher-standalone.html`  
  Password: `DemoGFV2026!` · tenant **AZIENDA DEMO GFV**  
  **Non** usare il simulatore emulator per clip con Tony (401 sulle CF).
- Setup solo UI senza Tony: emulator + `simulator-dev-standalone.html?emulator=1` · `SimGFV2026!`

### Mappe / zone / guasti in video (demo cloud v2)
- Zone lavorate = **fasce lineari** ovest→est (giorni consecutivi), non rettangoli concentrici.
- Basemap: **roadmap privacy** (niente POI/etichette strade) — stile applicato solo al tenant demo.
- Evitare Street View e zoom che mostrino contesto geografico riconoscibile.
- Satellite: ok solo se serve texture; le etichette Google possono riapparire → preferire roadmap per clip pubbliche.

### Glossario rapido
| In video | In gestionale classico |
|----------|------------------------|
| Azienda / tenant | Società |
| Lavoro | Ordine di lavoro / commessa |
| Terreno | Unità produttiva |
| Caposquadra | Caporeparto operativo |
| Segnatura ore | Timbratura / foglio ore |
| Guasto | Ticket manutenzione / fermo mezzo |

---

## 2. Arco narrativo ufficiale (ciclo chiuso)

> Il manager crea il lavoro → arriva al caposquadra → il capo comunica all’operaio → l’operaio segna le ore (con Tony) → il capo valida → tutto torna al manager.

Nel **gestionale** è un ciclo. Nel **video** è una giornata sul terreno **Monte Olivo** (tenant AZIENDA DEMO GFV, lavoro **Potatura di Produzione Monte Olivo**, capo Mario Rossi, operaio Giuseppe Ferrari). Il nome del terreno si dice in voce / cartello Filmora; **non** va scritto sui cartelli in Higgsfield (niente insegne leggibili).

### 2.1 Giornata (sceneggiatura da girare)

**Giorno 1 — pomeriggio**  
Luca in **ufficio** crea e assegna il lavoro di **potatura su Monte Olivo per domani**. La comunicazione arriva a **Mario su un altro lavoro** (trattore su campo arato, **non** già a Monte Olivo). Mario manda le indicazioni a **Giuseppe**, anch’egli su **un altro lavoro** (sacchi di concime in aia, magazzino sullo sfondo, **non** in vigna), che **conferma la ricezione**. Il vigneto Monte Olivo si vede solo dal **giorno 2, ore 7**.

**Giorno 2 — ore 7, vicino alla casa (Monte Olivo)**  
Si ritrova **tutta la Squadra Rossi** nel cortile **accanto alla casa**; i filari **partono da lì** (non il gruppo in mezzo al vigneto con la casa in lontananza). Mario e Giuseppe riconoscibili in 3/4; gli altri anche di spalle.  
Nota stagione: in anagrafica il lavoro è **Potatura di Produzione** con data **21/08/2026** (C01). Nel fumetto il vigneto ha **foglie** (agosto). Non fare tralci spogli invernali: smentirebbero la data in UI. In voce si può dire lavoro in vigna / diradamento; il nome in app resta quello delle clip.

**Giorno 2 — giornata in campo**  
Potatura su Monte Olivo: Giuseppe in primo piano, **1–2 comparse** sullo stesso filare. Deve capirsi che passa **tutta la giornata** (luce + salto temporale), non otto ore di clip.

**Giorno 2 — sera**  
Giuseppe **segna le ore** delle potature (con Tony). Mario **valida**. Luca **vede dal PC** il lavoro Monte Olivo aggiornato.

Ruoli (non invertire): Luca = solo ufficio. Mario = capo in campo + telefono. Giuseppe = operaio + ore. Tony = assistente, costume FAB solo lui.

### 2.2 Cosa c’è **dentro le clip** (va in video, non inventato)

Preso dai take 20/08. Il fumetto e la voce devono ripetere **queste** cose; la UI le mostra già.

| Fatto | Dove si vede | Testo / valore |
|-------|----------------|----------------|
| Terreno e lavoro | C01 form + chat Tony; C02/P1 lavoro | **Potatura di Produzione Monte Olivo** · terreno **Monte Olivo (1,50 Ha)** |
| Per chi | C01 Tony | Lavoro di squadra per **Mario Rossi**, inizio **domani** |
| Data lavoro in anagrafica | C01 campo Data inizio | **21/08/2026** |
| Ritrovo ore 7 + casa | C02 form + messaggio; P1 card | Orario **07:00**. Messaggio: *«domattina partiamo dalla zona vicino alla casa alle 7»* |
| Data/ora sulla comunicazione | C02 | Data **20/08/2026**, orario **07:00** (giorno in cui Mario scrive) |
| Giornata lavorata | C03 Tony; C04 valida | **07:00–18:00**, pausa 90 min → **9,50 ore** · Giuseppe Ferrari |
| Stesso lavoro in chiusura | C05 dettaglio | **Dettaglio: Potatura di Produzione Monte Olivo** |

**Nota date:** in C01 il lavoro parte il **21/08**; in C03/C04 le ore sono sul **20/08**. Per lo spot si racconta la storia del **messaggio** (domani alle 7, casa, Monte Olivo) e la durata **7–18**. Non sottolineare in voce il giorno del foglio ore se contrasta col 21.

**Filmora — cartelli** (oltre al tempo): `Monte Olivo` · `Domani, ore 7 — zona casa`. Non copiare l’URL `127.0.0.1` né i tab Chrome (Gmail, YouTube…): **crop** sulla sola app / mockup telefono-laptop.

### 2.3 Transizione fumetto → UI (dentro lo schermo)

Regia fissa, stessa per laptop e telefono:

1. **Higgsfield (fine clip H\*):** il personaggio guarda il device (schermo **ancora nero**). La camera fa un **dolly-in lento** finché il rettangolo nero **riempie il frame** (ultimo secondo). Niente UI disegnata.
2. **Filmora (taglio o crossfade 4–8 frame):** dal nero pieno si entra nella **clip reale**, già croppata sull’app (niente barra segnalibri). Su C01 il nero “diventa” il desktop Gestione lavori; su C02/P1/C03/C04 il nero diventa il field workspace a 390px, eventualmente in **mockup iPhone**.
3. **Uscita (opzionale):** fine clip UI → breve pull-back (still o 1 s dell’I2V all’indietro / freeze + zoom out) sul personaggio. Non obbligatorio su ogni beat; basta su Luca (C01) e Mario (C02) perché si capisca il trucco.

Non usare wipe casuali né UI finta in Gemini. Il “cambio inquadratura che ti porta dentro lo schermo” **è** il dolly-in Higgsfield + match-cut Filmora.

Ordine **app** (invariato, clip C01–C05):

1. Manager crea / assegna (desktop)
2. Caposquadra riceve e invia comunicazione (mobile)
3. Operaio legge / conferma, poi segna le ore con Tony
4. Caposquadra valida
5. Manager quadro aggiornato
6. *(Opzionale)* Guasto — fuori da questa giornata

---

## 3. Modalità “tutto da PC”

| Ruolo | Come registrare |
|-------|-----------------|
| Manager | Browser desktop normale |
| Caposquadra / Operaio | Chrome → F12 → Toggle device toolbar → iPhone / **390×844** |
| Tony | Stesso browser; registra **audio desktop** per sentire TTS |

Entry punti dalla pagina simulator-dev (dopo seed):
- **Entra come manager**
- pulsanti **Capo (mobile)** / **Operaio (mobile)** sulla card azienda manodopera

---

## 4. Versione SPOT commerciale (~75–90 secondi)

### 4.1 Storyboard

| Tempo | Personaggio (stile Tony) | UI reale | Voce / testo (taglio v10/v11) |
|------|--------------------------|----------|-------------------------------|
| 0:00–0:05 | Tony presenta (I2V parlato IT) | — | «Ciao, sono Tony. Vi porto dall'ufficio al campo.» |
| 0:05–0:18 | Luca ufficio | C01 Gestione lavori | «Dall'ufficio si crea il lavoro e si assegna alla squadra.» |
| 0:18–0:28 | Mario trattore + telefono | C02 Comunicazioni | «Il caposquadra lo vede e manda le indicazioni in campo.» |
| 0:28–0:44 | Giuseppe sacchi + telefono | P1/P2 ricezione / conferma | «Il messaggio arriva e si conferma.» |
| 0:44–0:54 | Ritrovo + vigna + sera | — | Cartelli `Monte Olivo, ore 7` · `Sera` |
| 0:54–1:08 | Giuseppe + Tony in-app | C03 salvataggio ore | Audio **clip C03** (Tony app); su H06 «Le ore si segnano anche a voce con Tony.» |
| 1:08–1:18 | Mario valida | C04 | «Poi si controlla e si convalida.» |
| 1:18–1:28 | Luca ufficio sera | C05 | «In ufficio torna tutto aggiornato in un solo gestionale.» |
| 1:28–1:33 | Tony saluto (I2V parlato IT) | — | «Gi Effe Vu. Campo e ufficio insieme.» |

Durata montata: **~93 s** (1:33), 1920×1080 30 fps. Target originale 75–90 s: accettato il respiro della giornata.

### 4.2 Script voce (spot) — ufficiale 2026-08-24

Voce = **Tony dell’app**, `it-IT-Chirp3-HD-Charon` (`TONY_TTS_VOICE` in `functions/index.js`). Non Edge, non narratore altro, non audio Higgsfield.

```
Ciao, sono Tony.
Vi porto dall'ufficio al campo.
Dall'ufficio si crea il lavoro e si assegna alla squadra.
Il caposquadra lo vede e manda le indicazioni in campo.
Il messaggio arriva e si conferma.
Le ore si segnano anche a voce con Tony.
Poi si controlla e si convalida.
In ufficio torna tutto aggiornato in un solo gestionale.
Gi Effe Vu.
Campo e ufficio insieme.
```

**GFV si legge a lettere italiane:** **Gi Effe Vu** (non «Gieffevi», non «vi» per la V). Take approvato in `GFV_spot_v10.mp4`. Niente parola «manager».

### 4.3 Note montaggio spot
- Lo spot è un **taglio corto della giornata §2.1 / §11**, non un’altra storia.
- Higgsfield gira **inquadrature, scenografia, movimento** (H01–H08 audio off). **Eccezione T0/T1:** I2V parlato IT (Wan 2.7 da still Tony); l’audio Higgsfield si **scarta** e si sostituisce con Chirp3 allineato al labiale.
- **Assemblaggio attuale:** ffmpeg nella cartella `Documents\primo video spot GFV` (script `_work\build-v11.js`). Filmora resta per un eventuale secondo passaggio (mockup device, taglio prof).
- Taglio personaggio → dispositivo (schermo nero) → **UI reale** croppata (`crop=1920:920:0:188`, niente tab Chrome / `127.0.0.1`) → di nuovo personaggio.
- Transizione **dentro lo schermo:** §2.3 (dolly-in + fade; zoom ultimo 0,5 s sulle clip device).
- Nella scena ore: audio = TTS italiano **della clip C03** (niente musica sopra).
- **Niente sottotitoli a frase** (scartati: barra nera troppo invasiva). Cartelli tempo burned: `Pomeriggio` · `Monte Olivo, ore 7` · `Sera`.
- Speed: H02a trattore **1.22x**; H03a sacco, H04 spiegazione, H05 potatura **1.6x**. C02 accorciata; C04 5,5 s.

### 4.4 File e versioni (cartella spot)

| File | Ruolo |
|------|--------|
| `GFV_spot_v10.mp4` | **Pronuncia GFV approvata** — non sovrascrivere |
| `GFV_spot_v11.mp4` | **Taglio di lavoro** (stesso video v10 + mix: C03 allineato, 01b/07b meno accelerati, loudnorm) |
| `GFV_spot_v2.mp4` | Transizioni + speedup — tenuta |
| `_work\hf-it\` | Clip Higgsfield IT intro/chiusura |
| `_work\vo6\07a.mp3` | Battuta «Gi Effe Vu» Chirp3 |

Dettaglio operativo: `Documents\primo video spot GFV\LEGGIMI-MONTAGGIO.txt`.

---

## 5. Versione PROF / review (8–10 minuti)

Tono: prima persona studente. Meno spot, più chiarezza + feedback.

### 5.1 Scaletta

| Blocco | Minuti | Contenuto |
|--------|--------|-----------|
| Intro | 0:00–0:45 | Cos’è GFV in termini da gestionale; repo a disposizione |
| Manager crea lavoro | 0:45–2:15 | Gestione lavori: creazione/assegnazione |
| Caposquadra comunica | 2:15–3:30 | Field workspace → comunicazione |
| Operaio + Tony | 3:30–5:30 | Ore con Tony (testo/voce) + audio risposta |
| Caposquadra valida | 5:30–6:30 | Valida ore |
| Manager chiude | 6:30–7:30 | Hub/impegni: ciclo chiuso |
| Opz. guasto | 7:30–8:15 | Solo se tempo |
| Chiusura tecnica | 8:15–9:30 | Stack breve + 5 domande feedback |
| Outro | 9:30–9:50 | Demo + GitHub |

### 5.2 Script voce (versione prof)

#### Intro
> Ciao professore. Ti mostro GFV Platform: un gestionale multi-azienda per imprese agricole, con ruoli manager, caposquadra, operaio, e un assistente AI — Tony — dentro i flussi operativi.  
> Non serve conoscere l’agricoltura nel dettaglio: i “lavori” sono come ordini di lavoro, i terreni come unità produttive.  
> Ti mostro un ciclo completo: dal manager al campo e ritorno. Demo e repository li trovi nel messaggio.

#### Manager crea lavoro
> Partiamo dall’ufficio. Il manager crea un lavoro e lo assegna alla squadra.  
> *[gestione-lavori: crea/assegna]*  
> Da qui parte tutto il flusso operativo.

#### Caposquadra comunica
> Sul field workspace — qui in vista telefono dal PC — il caposquadra vede il lavoro e invia una comunicazione operativa all’operaio.  
> Non è una chat generica: è un messaggio strutturato legato al lavoro.

#### Operaio + Tony
> L’operaio apre lo stesso workspace, vede l’indicazione e registra le ore.  
> Con Tony: chiedo le ore a voce o per testo — *[es. “Dalle 8 alle 17 con 30 minuti di pausa”]* — e si sente la risposta di Tony.  
> Confermo, i campi si riempiono, salvo. Il dato è reale nel gestionale.

#### Caposquadra valida
> Le ore tornano al caposquadra in “Valida ore”. Controlla e approva.

#### Manager chiude
> Di nuovo in ufficio: il manager vede il quadro aggiornato. Il ciclo è chiuso nello stesso gestionale.

#### Chiusura tecnica
> Stack in sintesi: pagine standalone JS, Firebase, Cloud Functions; Tony con mapping form centralizzato.  
> Solido: filo manodopera campo–ufficio e “occhi/liste + mani/form”.  
> In evoluzione: copertura form, performance, pezzi di roadmap.  
> Ti chiedo da costruttore di gestionali:  
> 1) Architettura sensata?  
> 2) UX da gestionale coerente?  
> 3) Tony integrato bene o pezzo a sé?  
> 4) Quali 2–3 cose correggeresti subito?  
> 5) Su cosa concentrare lo sviluppo dopo?

#### Outro
> Link demo e repo nel messaggio. Grazie anche solo per un feedback breve.

### 5.3 Overlay utili
- “1 · Manager crea il lavoro”
- “2 · Caposquadra comunica”
- “3 · Operaio + Tony segna le ore”
- “4 · Caposquadra valida”
- “5 · Manager: ciclo chiuso”
- “Registrato da PC — UI reale”

---

## 6. Lista clip UI (reali, da PC)

Convenzione target: `clip-XX-ruolo-azione.mp4`  
**Cartella take 2026-08-20:** `c:\Users\tanne\Videos\Captures\` (non copiate nel repo).  
Tenant: **AZIENDA DEMO GFV**. Lavoro in tutte le clip: **Potatura di Produzione Monte Olivo**. Capo Mario Rossi; operaio Giuseppe Ferrari. Audio sistema solo dove Tony parla (C03).

### Pacchetto da usare in Filmora (verificato su disco 20/08 sera)

Ciclo completo = **C01 → C02 → ricezione → conferma → C03 → C04 → C05**. Nella lista che hai mandato **manca C04**. C’è in cartella: usala. **Non** usare `clip invio comunicazione con disconnessione.mp4` (c’è logout/login; il taglio buono è già `…buona.mp4`).

| ID | File | Ruolo | Nel tuo elenco | Note |
|----|------|-------|----------------|------|
| C01 | `clip creazione lavoro con domanda giorni.mp4` | Luca | sì | Creazione lavoro Monte Olivo (Tony chiede i giorni) |
| C02 | `clip invio comunicazione buona.mp4` | Mario | sì | Usare questa, non la versione “con disconnessione” |
| P1 | `clip ricezione comunicazione buona.mp4` | Giuseppe | sì | Ponte C02→C03 |
| P2 | `clip conferma ricezione buona.mp4` | Giuseppe | sì | Conferma che torna visibile al capo |
| C03 | `clip salvataggio ore buona.mp4` | Giuseppe + Tony | sì | Ore 9h 30min; TTS italiano |
| **C04** | `clip validazione ore buona.mp4` | Mario | **no — va aggiunta** | File presente in Captures (20/08 06:04) |
| C05 | `clip controllo ore validate da manager buona-tagliata.mp4` | Luca | sì | Senza flash «0 lavori»; non usare la `…buona.mp4` non tagliata |

Fuori pacchetto (take vecchi 06–16/08 o sorgenti): `clip capo comunicazione.mp4`, `clip manager da usare.mp4`, `clip ricezione avvenuta.mp4`, `clip salvataggio ore operaio.mp4`, `creazione lavoro manager.mp4`, `invio comunicazione capo.mp4`, `validazione ore caposquadra.mp4`, `clip controllo ore validate da manager buona.mp4` (pre-taglio).

| ID | File take | Ruolo | Viewport | Azioni | Spot | Stato 20/08 |
|----|-----------|-------|----------|--------|------|-------------|
| C01 | `clip creazione lavoro con domanda giorni.mp4` | manager | desktop | Crea/assegna lavoro Monte Olivo (Tony chiede i giorni) | ✅ | Usabile così |
| C02 | `clip invio comunicazione buona.mp4` | caposquadra | mobile | Invio comunicazione | ✅ | Usabile (già tagliata) |
| P1+P2 | `clip ricezione comunicazione buona.mp4` + `clip conferma ricezione buona.mp4` | operaio | mobile | Ricezione / conferma | ponte | Usabili |
| C03 | `clip salvataggio ore buona.mp4` | operaio | mobile | Ore con Tony (TTS italiano) | ✅ | Usabile; 9h 30min |
| C04 | `clip validazione ore buona.mp4` | caposquadra | mobile | Approva ore | ✅ | Usabile — **mancava nell’elenco chat** |
| C05 | `clip controllo ore validate da manager buona-tagliata.mp4` | manager | desktop | Quadro Monte Olivo aggiornato | ✅ | Usabile dopo taglio |

Setup usato: switcher `demo-switcher-standalone.html` + tenant cloud (non emulator per clip con Tony).

### Setup prima di registrare
1. Emulator Auth+Firestore attivi + `npm start` (porta 8000).  
2. Seed demo (`npm run sim:run:demo-max` o tenant manodopera già seedato).  
3. Aprire simulator-dev con `?emulator=1`.  
4. Provare login Manager / Capo / Operaio **prima** di premere rec.  
5. Per C03: volume sistema su; disattivare altre notifiche audio.  
6. Stesso tenant per tutte le clip del ciclo.

### Checklist prova “tutto da PC” (prima delle take definitive)
- [ ] Manager: apro gestione lavori e vedo/creo un lavoro  
- [ ] Capo (DevTools mobile): vedo il lavoro e invio una comunicazione  
- [ ] Operaio (DevTools mobile): leggo comunicazione / segno ore con Tony (audio ok?)  
- [ ] Capo: valido le ore  
- [ ] Manager: quadro aggiornato  

---

## 7. Asset illustrati (stile Tony)

Brief operativo per Gemini (personaggi, pose, studio vs alpha, niente ambientazioni in questo giro): `VIDEO_BRIEF_GEMINI_PERSONAGGI.md`.

| Asset ID | Soggetto | Uso |
|----------|----------|-----|
| A01 | Tony (FAB + still + I2V parlato IT) | Intro T0 / end T1 — **tenuto 2026-08-23** (Wan 2.7, VO Chirp3; audio Higgsfield scartato) |
| A02 | Manager (Luca) | Ufficio pomeriggio → C01: **H01 tenuto**. Ufficio sera → C05: **H08 tenuto** `hf_20260821_153742_bd1b6f3f-…`. Idle `L_laptop` fallback |
| A03 | Caposquadra (Mario) | **H02a/H02b tenuti** (pomeriggio). **H07 tenuto** `hf_20260821_142116_7895eec2-…` (auto aia → C04). Idle `M_phone` fallback |
| A04 | Operaio (Giuseppe) | **H03a/H03b/H04/H05/H06 tenuti.** H06 sera `hf_20260821_134024_95fc988c-…` → C03 (Filmora zoom ultimo 0,5 s sul nero) |
| A05 | Vigneto / ufficio / casa / trattore stilizzati | Dentro gli still di scena (§11), non pack fondali vuoti |
| A06 | End card GFV + Tony | Chiusura — riuso A01 |

**Pipeline personaggi (2026-08-20, aggiornata 2026-08-23):** Gemini still → Higgsfield I2V, start frame = still, **audio off sulle scene H\***. T2V senza still = fotoreale (scartare). **T0/T1:** I2V parlato IT da `tony presenta.jpg` / `Tony saluto silenzioso.jpg` (Wan 2.7); audio Higgsfield (EN o UK) **non si tiene**. VO spot = `it-IT-Chirp3-HD-Charon` (stessa voce di Tony in-app). C03 = audio della clip UI.

Tony già prodotto:

| File | Ruolo | Note |
|------|-------|------|
| `T_identity` / `T_turn_34` | Lock full body 3/4 studio | Approvato vs `tony-icon.png` |
| `T_present` | Gesto verso destra, spazio UI | Approvato |
| `hf_20260820_102138_e4d77e21-dcce-4af0-b6f3-75700a709231.mp4` | I2V 5 s 16:9 da `T_present` | Fallback; labiale EN — **sostituito** da take IT 2026-08-23 |
| `_work\hf-it\tony-intro-it.mp4` | T0 parlato IT (Wan 2.7) | **Tenere**; VO Chirp3 in montaggio |
| `_work\hf-it\tony-chiusura-it.mp4` | T1 parlato IT (Wan 2.7) | **Tenere**; chiusura «Gi Effe Vu» |
| `hf_20260820_095623_c4234855-cc85-40e5-b691-fc2cc5d8c526.mp4` | Take errato (persona vera) | Scartare |

Luca già prodotto (lock: rasato, tempie grigie, polo sage, **non** Tony giovane):

| File | Ruolo | Note |
|------|-------|------|
| `L_laptop` | Ufficio, laptop schermo spento | Still Gemini approvato (2° take) |
| `hf_20260820_113831_752260ba-e42c-4698-a59a-a882a2863f4e.mp4` | I2V 5 s 16:9 da `L_laptop` | **Tenere**; no audio; blink a inizio/fine → tagliare sul centro in Filmora; ponte C01 + riuso C05 |

Tony studio e i quattro I2V idle **non si buttano**: restano intro/end e fallback se un take “giornata” deriva. I crediti nuovi vanno sulle scene H01–H06 (§11), non su un film Higgsfield unico.

**Prompt base:**  
> “3D stylized cartoon character, same art style as a friendly elderly farmer mascot with straw hat and green utility vest, soft lighting, mobile-game quality, agricultural colors (greens, straw, warm accents), not photorealistic, not anime, clean background”

---

## 8. Messaggio al professore

```
Ciao professore,

sto sviluppando GFV Platform: un gestionale multi-tenant per aziende agricole
(con ruoli manager / caposquadra / operaio) e un assistente AI integrato (Tony).

Ti ho preparato un video in cui si vede l’app vera in azione (non slide),
con un ciclo completo: creazione lavoro → comunicazione → ore → validazione → ritorno in ufficio.

Il verticale è agricolo, ma i pattern sono da gestionale.
Se ti va, dopo il video mi interessa un giudizio da esperto di gestionali:
1) Architettura generale sensata?
2) UX da gestionale coerente?
3) L’AI è integrata nel modo giusto?
4) Quali 2–3 cose correggeresti subito?
5) Su cosa concentrare lo sviluppo dopo?

Ti lascio anche demo e accesso al repository GitHub.

Grazie anche solo per un feedback breve.
```

---

## 9. Checklist avanzamento

- [x] Flussi reali verificati  
- [x] Arco: manager → capo → operaio+Tony → validazione → manager  
- [x] Storyboard spot aggiornato  
- [x] Script spot + prof aggiornati  
- [x] Lista clip allineata al ciclo  
- [x] Strategia registrazione tutto-da-PC  
- [x] Seed demo + prove login 3 ruoli (tenant cloud AZIENDA DEMO GFV)  
- [x] Prova ciclo completo a mano (senza rec)  
- [x] Registrazione clip C01–C05 (take 20/08 + tagli C02/C05)  
- [x] Lock personaggi + primi I2V idle (Tony, Luca, Mario, Giuseppe)  
- [x] H01 Luca ufficio (carte → laptop → dolly; `hf_20260820_160946_0831fc22-…`)  
- [x] H02a Mario trattore campo arato (`hf_20260821_035909_aa26ab88-…`)  
- [x] H02b Mario cabina + telefono (`hf_20260821_042905_cb1763fb-…`; Filmora zoom sul nero → C02)  
- [x] H03a Giuseppe sacchi + magazzino (`hf_20260821_102132_af72f479-…`)  
- [x] H03b Giuseppe telefono (`hf_20260821_114541_94b7bb26-…`; Filmora zoom sul nero → ricezione)  
- [x] H04 ritrovo squadra ore 7 (`hf_20260821_125641_2d38c342-…`)  
- [x] H05 lavoro filare (`hf_20260821_131934_12d246f8-…`; taglio grappolo + caduta)  
- [x] H06 Giuseppe sera telefono (`hf_20260821_134024_95fc988c-…`; sbadiglio poi dolly → C03)  
- [x] H07 Mario sera auto in aia (`hf_20260821_142116_7895eec2-…`; gamba + dito via, poi dolly → C04)  
- [x] H08 Luca ufficio sera (`hf_20260821_153742_bd1b6f3f-…`; chiude quaderno, poi dolly → C05)  
- [x] Primo montaggio spot ffmpeg (giornata + UI C01–C05), taglio **v11**  
- [x] T0/T1 parlati IT + VO Tony Chirp3; GFV = **Gi Effe Vu** (v10)  
- [x] Linea B — Higgsfield trattamento Mario (clip 01–06 tenute, 2026-09-10)  
- [x] Linea B — Higgsfield movimento magazzino (clip 01–02 tenute, 2026-09-10)  
- [x] Linea B — Higgsfield sostituzioni (clip 1–6 tenute, 2026-09-16)  
- [ ] Linea B — UI reale trattamento (ore + zona + Sospendi; Luca vede sospeso; Luca Crea ripresa)  
- [ ] Linea B — UI reale magazzino (Luca, Movimenti → Entrata; no OCR)  
- [ ] Linea B — UI reale sostituzioni (Mario Segnala assenza; Luca Assegna sostituto / prestito)  
- [ ] Eventuale secondo passaggio Filmora (mockup device, lucidi)  
- [ ] `START_HERE` repo  
- [ ] Invio al professore  

---

## 10. Prossimo passo operativo

1. **Non** sovrascrivere `GFV_spot_v10.mp4` (pronuncia GFV) né rifare 07a «Gi Effe Vu» senza richiesta. Taglio di lavoro = `GFV_spot_v11.mp4`.  
2. Scene H01–H08 **non** si rifanno se il taglio v11 è accettato; solo T0/T1 se si vuole un labiale nuovo.  
3. **Linea B:** Higgsfield trattamento Mario (§12), movimento magazzino (§13) e sostituzioni (§14) **chiusi**. Prossimo = rec UI (switcher demo, tenant AZIENDA DEMO GFV, Chrome 390×844). Magazzino: solo Luca, Movimenti → Entrata, niente OCR. Sostituzioni: Mario Segnala assenza, Luca Assegna sostituto / prestito Giuseppe. Non rigenerare clip Higgsfield se non richiesto.  
4. Opzionale: passaggio Filmora (mockup iPhone, lucidi, taglio prof 8–10 min dallo stesso materiale).  
5. Poi `START_HERE` repo e pacchetto al professore.

---

## 11. Scene Higgsfield — giornata (regia, scenografia, movimento)

**Divisione:** Higgsfield = inquadratura, set, luce, gesto. **ffmpeg (spot 2026-08)** = sequenza, cartelli tempo, clip UI, voce. Filmora = eventuale secondo passaggio (mockup).  
**Stile:** stesso 3D cartoon di `tony-icon.png`. Deve **sembrare una situazione di lavoro vera** (ufficio, campo, casa alle 7, potatura, sera), non uno studio vuoto — ma **non** fotoreale, non Italia riconoscibile, niente insegne leggibili.  
**Tecnica fissa (H01–H08):** I2V, `start_image` = still 16:9, 5 s, audio **OFF**, un take per scena. Vietato T2V senza still. Schermi laptop/telefono **neri**, zero UI GFV. **T0/T1:** I2V parlato IT da still Tony, poi VO Chirp3 al posto dell’audio Higgsfield.  
**Camera:** un solo movimento per clip. Sulle scene con device (**H01, H02b, H03b, H06**): **dolly-in** lento verso laptop/telefono finché lo schermo nero riempie il frame (ponte §2.3). **H02a** e **H03a** sono lavoro in corso (solco lento / posa sacco), camera locked, **niente** telefono. Altre scene: locked o pan minimo. Niente walking shot, niente corsa. Lip-sync solo su **T0/T1** (poi VO Chirp3).

Lock costumi (in ogni prompt):

| Chi | Sì | No |
|-----|----|----|
| Tony | Cappello paglia, bandana rossa, gilet verde, barba bianca | — |
| Luca | Polo sage, rasato, tempie grigie, ufficio | Cappello/bandana/gilet Tony; stivali da campo |
| Mario | Camicia oliva maniche lunghe, stubble, niente cappello | Costume Tony; polo sage |
| Giuseppe | Maglia maniche corte chiara, rasato, più giovane | Costume Tony; camicia lunga di Mario |

### Ordine di montaggio (ffmpeg spot; Filmora opzionale)

| Beat | Higgsfield | Poi UI reale | Cartello |
|------|------------|--------------|----------|
| Intro | Tony I2V già tenuto (`T_present`) | — | — |
| Pomeriggio ufficio | **H01** Luca | **C01** creazione lavoro | Pomeriggio |
| Pomeriggio capo | **H02a** trattore + **H02b** telefono | **C02** invio comunicazione | — |
| Pomeriggio operaio | **H03a** sacchi + **H03b** telefono | clip ricezione / conferma | — |
| Mattina dopo | **H04** incontro 7:00 | — | Monte Olivo, ore 7 |
| Giornata | **H05** potatura | — | (opz. dissolve luce) |
| Sera ore | **H06** Giuseppe (+ Tony da I2V tenuto in overlay se serve) | **C03** salvataggio ore + TTS | Sera |
| Sera valida | **H07** Mario auto in aia | **C04** validazione | Sera, prima di casa |
| Sera ufficio | **H08** Luca ufficio | **C05** quadro manager | Sera |
| Fine | Tony I2V tenuto | — | end card |

I2V idle già tenuti (fallback, non da rigenerare):

- Tony: `Downloads\hf_20260820_102138_e4d77e21-dcce-4af0-b6f3-75700a709231.mp4`
- Luca idle: `Downloads\hf_20260820_113831_752260ba-e42c-4698-a59a-a882a2863f4e.mp4`
- **H01 Luca giornata (TENERE):** `Downloads\hf_20260820_160946_0831fc22-10c8-403b-a6c0-aa21162580df.mp4` — Filmora: zoom ultimo 0,5 s sul display nero, poi C01. **Non** riusare per C05 (serve H08).
- **H02a Mario trattore (TENERE):** `Downloads\hf_20260821_035909_aa26ab88-e4f6-41e7-8fe5-65b4e2953c5d.mp4` — campo arato, solco lento.
- **H02b Mario cabina + telefono (TENERE):** `Downloads\hf_20260821_042905_cb1763fb-1c09-4152-b2b5-3c552f96260e.mp4` — Filmora: zoom ultimo 0,5 s sul display nero, poi C02. **Non** riusare per C04 (serve H07).
- Mario idle: `Downloads\hf_20260820_141520_15b9e1d4-6c81-45f6-b4bf-83e64ca9fb6b.mp4`
- **H03a Giuseppe sacchi (TENERE):** `Downloads\hf_20260821_102132_af72f479-950a-4e18-af85-15e2f897b6e5.mp4` — posa sacco, magazzino dietro.
- **H03b Giuseppe telefono (TENERE):** `Downloads\hf_20260821_114541_94b7bb26-d462-472e-a042-d2c658d18b36.mp4` — fronte, poi dolly; Filmora zoom ultimo 0,5 s sul nero, poi clip ricezione.
- **H04 ritrovo squadra (TENERE):** `Downloads\hf_20260821_125641_2d38c342-088d-4e5f-a201-cb0876c7971e.mp4` — Mario spiega, comparse ascoltano; poi H05 lavoro sul filare.
- **H05 lavoro filare (TENERE):** `Downloads\hf_20260821_131934_12d246f8-0747-46f2-b2ef-c41823256d02.mp4` — Giuseppe e comparse tagliano un grappolo e lo lasciano cadere.
- **H06 Giuseppe sera + telefono (TENERE):** `Downloads\hf_20260821_134024_95fc988c-f378-4414-b2a3-1c2aed0fa924.mp4` — sbadiglio, poi dolly; Filmora zoom ultimo 0,5 s sul nero, poi C03.
- **H07 Mario auto aia (TENERE):** `Downloads\hf_20260821_142116_7895eec2-a70f-4b12-81eb-528c5be66fc5.mp4` — entra con l’altra gamba, toglie il dito, poi dolly; Filmora zoom ultimo 0,5 s sul nero, poi C04.
- **H08 Luca ufficio sera (TENERE):** `Downloads\hf_20260821_153742_bd1b6f3f-9a8c-41f4-aad1-5b5b2b77d175.mp4` — chiude il quaderno, poi dolly; Filmora zoom ultimo 0,5 s sul nero, poi C05.
- Giuseppe idle: `Downloads\hf_20260820_150004_6233a701-7f58-4918-a330-14e44f2a97e4.mp4`

---

### H01 — Luca, ufficio, pomeriggio (→ C01)

**Set:** ufficio agricolo stilizzato, non open-space città. Scrivania con **carte bianche/illeggibili** (niente logo GFV, niente testo), penna, laptop **schermo nero**. Finestra con luce pomeridiana calda.  
**Inquadratura:** piano americano, 3/4, Luca a sinistra/centro, spazio a destra per il taglio UI.  
**Movimento I2V (5 s, prima di C01):** ~0–3 s lavora in ufficio (sfoglia carte illeggibili, sposta un foglio, guarda gli appunti, una mano sul laptop **chiuso o schermo nero** — niente UI). Poi si concentra sul laptop. Ultimi ~1,5 s **dolly-in** fino a riempire il frame con lo schermo nero (= inizia a creare il lavoro, che è C01). Nessun digitare visibile sulla UI.

**Gemini (chat nuova; allega tony-icon + T_identity + L_laptop):** still 16:9 ufficio con carte, stesso Luca approvato.  
**I2V (dopo PNG ok):**

```
Keep this exact 3D cartoon man. Do NOT replace with a real person. Do NOT make photoreal.
Same face, sage polo, clean shaven, grey temples, same office, same blank black laptop screen, same unreadable papers.
He is ALREADY at work before opening the app: first he looks at the papers, shifts one sheet, maybe touches a pen, small head turns, gentle breathing. Then he turns his attention to the laptop as if about to start a task.
Slow camera dolly-in toward the laptop. In the last 1.5 seconds the blank black screen fills the entire frame.
No typing on a visible UI, no readable text, no GFV, no extra people, no speech, no English, no lip sync, no costume change.
No straw hat, no red bandana, no green utility vest.
```

---

### H02a — Mario, trattore su altro lavoro (pomeriggio, prima di C02)

**Set:** campo **arato** cartoon (terra, solchi, alberi all’orizzonte). **Non** filari di vigneto Monte Olivo: Mario è su un altro lavoro. Trattore rosso con attrezzo al suolo.  
**Inquadratura:** campo largo, 16:9, trattore a centro/medio campo.  
**Movimento I2V (TENUTO):** solco **lento**, ruote che girano poco, polvere leggera. Camera locked. Niente telefono, niente dolly, niente corsa.

**Still:** Gemini `Mario_trattore_lavora_terra`.  
**I2V tenuto:** `Downloads\hf_20260821_035909_aa26ab88-e4f6-41e7-8fe5-65b4e2953c5d.mp4`

---

### H02b — Mario, cabina + telefono (→ C02 e riuso C04)

**Set:** stesso trattore rosso di H02a, ma **inquadratura cabina** (mezzo/primo piano). Mario con **camicia oliva maniche lunghe** come `M_phone` (non maglia chiara da lontano). Telefono in mano, **schermo nero pieno** (zero UI, zero testo). Trattore fermo o al minimo; l’azione è il telefono, non l’aratura.  
**Inquadratura:** 3/4, Mario a sinistra/centro, telefono visibile e abbastanza grande da poter fare dolly.  
**Movimento I2V (TENUTO):** sguardo al telefono, poi dolly verso lo schermo nero (non riempie il frame: in Filmora zoom ultimo 0,5 s poi C02). Trattore fermo.

**Still:** Gemini `Mario_trattore_rosso_cabina_telefono`.  
**I2V tenuto:** `Downloads\hf_20260821_042905_cb1763fb-1c09-4152-b2b5-3c552f96260e.mp4`

**I2V (prompt usato):**

```
Keep this exact 3D cartoon crew leader. Do NOT replace with a real person. Do NOT make photoreal.
Same face, olive-khaki LONG-sleeve shirt, brown trousers and boots, same red tractor cab, same blank black phone.
He looks from the field down to the phone, light blink, gentle breathing.
Tractor stays still. Camera slowly dollies in; last 1.5 seconds the blank black phone screen fills the entire frame.
No driving, no tillage, no walking, no UI on the phone, no readable text, no extra people, no speech, no English, no lip sync, no costume change.
No straw hat, no red bandana, no green utility vest.
```

---

### H03a — Giuseppe, sacchi di concime (pomeriggio, prima della ricezione)

**Set:** aia cartoon, **magazzino/capanno sullo sfondo**. Pallet con sacchi già impilati. Giuseppe sta **appoggiando un sacco sopra agli altri**. Sacchi neutri (niente marca, niente testo). **Non** vigneto, **non** cabina trattore.  
**Inquadratura:** campo medio/largo, 16:9, magazzino visibile dietro.  
**Movimento I2V (TENUTO):** posa lenta del sacco sulla pila, polvere leggera. Camera locked. Niente telefono.

**Still:** Gemini `Giuseppe_sposta_sacchi`.  
**I2V tenuto:** `Downloads\hf_20260821_102132_af72f479-950a-4e18-af85-15e2f897b6e5.mp4`

**I2V (prompt usato):**

```
Keep this exact 3D cartoon young farm worker. Do NOT replace with a real person. Do NOT make photoreal.
Same face, light short-sleeve shirt, brown trousers and boots, same farmyard, same warehouse in the background, same fertilizer sacks.
He is ALONE. One slow action only: he sets a sack on top of the existing stack. Gentle dust, no sprint.
Locked camera. No phone, no vineyard, no tractor cab, no walking away, no extra people, no Tony.
No speech, no UI, no readable brand names or signs.
No straw hat, no red bandana, no green utility vest.
```

---

### H03b — Giuseppe, telefono (→ clip ricezione / conferma)

**Set:** stesso magazzino di H03a, **3/4 laterale** (come H02b Mario cabina). Un solo telefono, **schermo nero visibile**.  
**Inquadratura:** mezzo busto 3/4.  
**Movimento I2V (TENUTO):** mano libera si asciuga la fronte, poi dolly verso lo schermo nero (non riempie il frame: in Filmora zoom ultimo 0,5 s poi clip ricezione).

**Still:** Gemini 3/4 laterale (frontale e doppio telefono scartati).  
**I2V tenuto:** `Downloads\hf_20260821_114541_94b7bb26-d462-472e-a042-d2c658d18b36.mp4`

**I2V (prompt usato):** sudore fronte con mano libera, poi dolly sul nero.

---

### H04 — Ore 7, ritrovo squadra vicino alla casa di Monte Olivo (nessuna UI)

**Set:** **alba**, casa colonica **vicina** (niente civico, niente scritte). Cortile/sentiero di ritrovo **davanti o a lato della casa**. I filari **iniziano subito dopo**, foglie verdi (agosto), **niente grappoli da vendemmia** in primo piano.  
**Cast:** Mario e Giuseppe in **3/4**, riconoscibili (lock H02b / H03b), non in posa da foto. Comparse anche di spalle; **almeno due donne**; maglie diverse; nessuno guarda in camera.  
**Inquadratura:** wide, casa grande a sinistra o dietro-accanto, non un puntino in fondo al filare.  
**Movimento I2V (TENUTO):** Mario spiega indicando i filari; gli altri ascoltano (cenni). Camera locked.

**Still:** Gemini ritrovo casa+vigneto alba.  
**I2V tenuto:** `Downloads\hf_20260821_125641_2d38c342-088d-4e5f-a201-cb0876c7971e.mp4`

---

### H05 — Lavoro in vigna (diradamento / intervento verde), passa la giornata (nessuna UI)

**Set:** stessi filari di H04, **foglie verdi** (agosto, data UI 21/08). Giuseppe in primo piano con cesoie su grappolo verde; **2 comparse su filari diversi**. Casa a sinistra. Luce diurna calda.  
**Inquadratura:** 3/4 su Giuseppe. Non posa da foto.  
**Movimento I2V (TENUTO):** Giuseppe taglia **un** grappolo con le forbici e lo lascia cadere a terra; le comparse fanno lo stesso. Camera locked. Niente camminata lungo il filare.

**Still:** Gemini filari paralleli, Giuseppe maglia beige + cesoie.  
**I2V tenuto:** `Downloads\hf_20260821_131934_12d246f8-0747-46f2-b2ef-c41823256d02.mp4`

---

### H06 — Sera, Giuseppe sta per segnare le ore (→ C03)

**Set:** stessa vigna di H05, luce **sera** (più bassa/calda, ombre lunghe). Giuseppe **solo**, stesso vestito H05 (maglia beige, pantaloni marroni). Un telefono **schermo nero pieno** (le ore vere sono C03). Tony **non** nello still: in Filmora si può affiancare l’I2V Tony già tenuto.  
**Inquadratura:** mezzo busto **3/4** (come H03b), Giuseppe a sinistra/centro, spazio a destra. Telefono visibile e abbastanza grande da poter fare dolly. **Un solo telefono**, schermo verso camera (non il dorso). Niente mugshot frontale.  
**Movimento I2V (TENUTO):** sbadiglio (fine giornata), poi dolly verso lo schermo nero (non riempie il frame: in Filmora zoom ultimo 0,5 s poi C03).

**Still:** Gemini sera, Giuseppe solo, telefono nero 3/4, forbici nel fodero con impugnatura in fuori.  
**I2V tenuto:** `Downloads\hf_20260821_134024_95fc988c-f378-4414-b2a3-1c2aed0fa924.mp4`

Dopo H06: clip **C03** (TTS Tony italiano). Poi **H07** → C04, **H08** → C05.

---

### H07 — Sera, Mario in auto nell’aia (→ C04)

**Set:** **aia** dell’azienda (stesso magazzino/capanno di H03a). Mario è **già in macchina** (auto di lavoro/civile, **non** il trattore rosso), parcheggiata, **prima di tornare a casa**. Luce **sera** (come H06). Niente Giuseppe, niente Tony.  
**Inquadratura:** mezzo busto **3/4** dal finestrino / portiera, Mario a sinistra/centro. Un telefono **schermo nero** visibile e abbastanza grande da dolly. Niente mugshot frontale, niente dorso del telefono, un solo telefono.  
**Movimento I2V (TENUTO):** entra con l’altra gamba, toglie il dito dallo schermo, poi dolly verso il telefono nero (Filmora zoom ultimo 0,5 s → C04). Auto ferma.

**Still:** Gemini auto aia (poi specchio orizzontale per guida italiana).  
**I2V tenuto:** `Downloads\hf_20260821_142116_7895eec2-a70f-4b12-81eb-528c5be66fc5.mp4`

---

### H08 — Sera, Luca in ufficio controlla le ore validate (→ C05)

**Set:** stesso ufficio di H01, ma **sera**: lampada da tavolo / luci interne **accese**, finestra scura o crepuscolo (non il pomeriggio di H01). Luca **solo**, polo sage. Laptop **schermo nero pieno** (il quadro manager è C05). Carte illeggibili ok, niente UI, niente GFV.  
**Inquadratura:** 3/4, Luca a sinistra/centro, laptop visibile e abbastanza grande da dolly. Non mugshot frontale. Non sta creando un lavoro (quello è H01): sta **controllando** dopo la validazione di Mario.  
**Movimento I2V (TENUTO):** la destra chiude il quaderno (da 45° a piatto), poi dolly verso lo schermo nero del laptop (Filmora zoom ultimo 0,5 s → C05).

**Still:** Gemini ufficio sera, lampada, quaderno semiaperto pagine bianche, destra sul coperchio obliquo.  
**I2V tenuto:** `Downloads\hf_20260821_153742_bd1b6f3f-9a8c-41f4-aad1-5b5b2b77d175.mp4`

---

### QA prima di Generate / dopo l’mp4

**Non lanciare I2V** se lo still ha: UI sul telefono, testo GFV, fotoreale, cappello/bandana/gilet Tony su Luca/Mario/Giuseppe, persona in più non prevista, trattore in corsa.  
**Scarta l’mp4** se: persona vera, volto morphato, parla inglese, compare una schermata app, secondo personaggio comparso da solo, costume cambiato. Un take; il successivo solo con ok esplicito.

---

## 12. Linea B — trattamento Mario (pioggia / zona / ripresa) — 2026-09-10

**Linea:** serie feature (Pixar 3D), **non** lo spot giornata H01–H08 e **non** lo spot social Linea A (`COPIONE_PRIMO_SPOT_SOCIAL.md`).  
**Stato Higgsfield:** chiuso. **Stato UI:** da girare.  
**Cartella ufficiale (fuori repo):** `Documents\personaggi GFV\video\trattamento mario\`  
(`clip/`, `STILL/`, `clip/scarti/`, `STILL/varianti/`, `registrazioni schermo/`). Non usare copie in `workspace/output/`.

### 12.1 Storia (allineata all’app)

1. Mario tratta in vigna (mattina).
2. Pioggia → **prima** registra **ore** e **zona lavorata** (lavoro ancora `assegnato` / `in_corso`; dopo Sospendi la UI nasconde la zona).
3. Poi **Sospendi** (es. pioggia) → Luca vede `sospeso`.
4. Temporale passato → Luca **Crea ripresa** (lavoro nuovo, stesso terreno / tipo / assegnazione).
5. Mario continua sulla ripresa (luce pomeriggio–sera).

Match-cut come §2.3: OTS 3/4 da dietro, dolly nello schermo **nero**, poi UI reale.

### 12.2 Pipeline Higgsfield (lock)

| Pezzo | Decisione |
|-------|-----------|
| Still | Nano Banana, `image_references`, **niente `soul_id`** |
| Video | Seedance 2.0 I2V, 5 s, 16:9, SFX on, no parlato / no musica |
| Preset | Declina **IN THE DARK** (`24bae836-2c4a-48e0-89b6-49fcc0b21612`) |
| Schermi | Telefono/laptop **neri**; UI GFV solo in registrazione |
| MCP | `plugin-higgsfield-higgsfield` |

Lastre tenute: Mario tuta+maschera `7a988152`; trattore khaki cabina chiusa `07cc71b2`; atomizzatore nebbia `f2006317`; vigneto foglie `f21b1def`.

### 12.3 Clip tenute

| # | Beat | Job Higgsfield | File locale | UI dopo |
|---|------|----------------|-------------|---------|
| 1 | Trattamento mattina | `6aea9a49-2b5c-41fc-b2d4-2d9303941c47` | `clip/01-mario-trattamento.mp4` | — |
| 2 | Pioggia, atomizzatore spento | `6507b75b-9c87-45fd-a9cb-23621a2aff41` | `clip/02-mario-pioggia.mp4` | — |
| 3 | Mario OTS telefono | `405eaa9a-bff4-4ced-9cb0-7f59565d2633` | `clip/03-mario-ots-telefono.mp4` | ore → zona lavorata → Sospendi |
| 4 | Luca libreria (notifica sospensione) | `868f6055-5562-49b7-82e0-feb48413d783` | `clip/04-luca-libreria-ots.mp4` | vede lavoro `sospeso` |
| 5 | Luca finestra sole (Crea ripresa) | `166ddb8f-3a2b-4d3d-a7d0-71fcbca99bd8` | `clip/05-luca-finestra-ots.mp4` | Crea ripresa |
| 6 | Ripresa sera | `189e6e70-8dd6-4c88-887a-c8f562d3e48c` | `clip/06-mario-ripresa-sera.mp4` | — |

Start still allineati (`STILL/01`–`06`): `62c220b9` · `c2d6d866` · `0373ce53` · `288c870b` · `43fbaadd` · `ba4c074c`.

Due beat Luca **di proposito**: sospensione ≠ Crea ripresa. Polo sage in entrambi.

### 12.4 UI da registrare

Setup: `http://127.0.0.1:8000/core/dev/demo-switcher-standalone.html` · password `DemoGFV2026!` · tenant **AZIENDA DEMO GFV** · Chrome **390×844** · crop sull’app (niente tab / `127.0.0.1`). Cartella destinazione: `registrazioni schermo\`.

| Dopo clip | Ruolo | Azioni |
|-----------|-------|--------|
| 3 | Mario (mobile) | Segna ore → zona lavorata (due punti) → Sospendi (pioggia) |
| 4 | Luca (desktop) | Vede il lavoro `sospeso` |
| 5 | Luca (desktop) | **Crea ripresa** |

### 12.5 Lezioni (non ripetere)

- **Non** usare il trattore studio di Giuseppe (`804bb80e`, troppo giocattolo). Hero = compatto da frutteto in scena (`9b4a3cda` / `f80545e9`) **con cabina chiusa**; il colore può essere khaki.
- Atomizzatore = ventola **posteriore**; nebbia fine, non getti d’acqua. Niente ugello sul fronte/sinistra del serbatoio. Scarto: `clip/scarti/01-mario-trattamento-ugello-davanti.mp4`.
- Seedance da still trattamento spesso **fallisce/filtra** senza `video_references`. Pattern che tiene: start_image + ref `bf7c9b1e` (lavoro Giuseppe) oppure la clip 01 tenuta `6aea9a49`.
- Clip 6 deve **copiare l’andatura** di `6aea9a49` e cambiare solo la luce. Non una composizione nuova (scarto `4131e161` / `clip/scarti/04-mario-ripresa-andatura-diversa.mp4`).
- Primi still OTS duplicavano Mario (in cabina + in piedi). Fix: **una** persona, cabina vuota. Da dietro la tuta può sembrare una felpa: accettato.
- Costume di **questa** sequenza = tuta + maschera, non la camicia oliva di H02.
- Higgsfield di questo spot: **non** rigenerare se non richiesto.

---

## 13. Linea B — movimento magazzino (carico + foto bolla) — 2026-09-10

**Linea:** serie feature (Pixar 3D), **non** lo spot giornata H01–H08 e **non** lo spot social Linea A.  
**Stato Higgsfield:** chiuso. **Stato UI:** da girare (tentativo rec da Cursor 2026-09-10 fallito: Playwright senza ffmpeg).  
**Cartella ufficiale (fuori repo):** `Documents\personaggi GFV\video\movimento magazzino\`  
(`clip/`, `still/`, `still/varianti/`, `still/ref/`, `registrazioni schermo/`).

### 13.1 Storia (allineata all’app)

1. Giuseppe (operaio) sposta i sacchi **dentro** il magazzino di legno (stesso set della foto).
2. Luca (manager) fotografa la bolla cartoon (scritte illeggibili, niente marche). Il flash illumina **solo il foglio**; lo schermo del telefono resta **nero**.
3. Taglio a UI reale: Luca, **Movimenti → Entrata** (prodotti generici: Rame ossicloruro, Zolfo bagnabile, NPK — non marche commerciali).

**Vietato in questo spot:** OCR / form revisione Gemini / Tony documenti (non commerciale-ready). La foto è solo il verbo «sta scattando».

Ruoli (non invertire): Giuseppe = solo lavoro fisico. Luca = unica persona che può registrare. Gate codice: `canUseTonyDocumentCapture` (manager/amministratore) e `movimenti-standalone.html` («Solo Manager o Amministratore»).

### 13.2 Pipeline Higgsfield (lock)

| Pezzo | Decisione |
|-------|-----------|
| Still | Nano Banana, `image_references`, **niente `soul_id`**, max **3** ref |
| Video | Seedance 2.0 I2V, 5 s, 16:9, SFX on, no parlato / no musica |
| Preset | Declina **IN THE DARK** (`24bae836-2c4a-48e0-89b6-49fcc0b21612`) |
| Schermi | Telefono **nero**; UI GFV solo in registrazione |
| MCP | `plugin-higgsfield-higgsfield` |

Costume di **questa** sequenza: Giuseppe maglia menta, pantaloni/stivali marroni, capelli ondulati, barba leggera. Luca **polo blu navy**, rasato, tempie grigie (la polo sage resta per l’ufficio H01/H08).

### 13.3 Clip tenute

| # | Beat | Job Higgsfield | File locale | UI dopo |
|---|------|----------------|-------------|---------|
| 1 | Giuseppe posa il sacco | `07c89dba-14d3-4d55-ba0f-6e261d065a7d` | `clip/01-giuseppe-sacchi-magazzino.mp4` | — |
| 2 | Luca foto bolla + flash | `d806d303-25c1-4cd0-ae17-097b185d1421` | `clip/02-luca-foto-bolla.mp4` | Movimenti → Entrata |

Start still: `ea9baa7d` (`still/01-giuseppe-sacchi-magazzino.png`) · `97df577e` (`still/02-luca-foto-bolla.png`).

Prompt flash tenuto (Seedance, start = still Luca): stesso testo del take Giuseppe `6c061344`, unica sostituzione `Same navy blue polo` al posto di `Same sage mint t-shirt`.

### 13.4 UI da registrare

Setup: `http://127.0.0.1:8000/core/dev/demo-switcher-standalone.html` · password `DemoGFV2026!` · **Manager — Luca Martini** · tenant **AZIENDA DEMO GFV** · Chrome **390×844** · crop sull’app (niente tab / `127.0.0.1`). Destinazione: `registrazioni schermo\`.

| Dopo clip | Ruolo | Azioni |
|-----------|-------|--------|
| 2 | Luca (mobile) | Magazzino → Movimenti → Nuovo → **Entrata** (prodotto generico, qty, Salva). Niente fotocamera Tony, niente revisione OCR. |

### 13.5 Lezioni (non ripetere)

- **Non** far fotografare/registrare la bolla a Giuseppe: dal suo account non esiste il percorso.
- Nano Banana: **≤3** `image_references`. Quattro ref = job failed senza widget.
- Non usare `51256e42` (Giuseppe OTS magazzino) come ref per Luca: vince l’identità Giuseppe (maglia menta). Magazzino = prompt del set Luca + lastre Luca.
- Flash: **non** Genjutsu / motion-control dal clip Giuseppe (`6c061344`) sullo still Luca — accende lo schermo. Rifare Seedance I2V col prompt tenuto, start frame Luca.
- Polo Luca in magazzino = **navy**, non sage: altrimenti si confonde con Giuseppe.
- Rec UI da agente Cursor: Playwright vuole ffmpeg in cache sandbox; install hung. Girare a mano come C01–C05.
- Higgsfield di questo spot: **non** rigenerare se non richiesto.

---

## 14. Linea B — sostituzioni (carro pesche / shortlist / prestito) — 2026-09-16

**Linea:** serie feature (Pixar 3D), **non** lo spot giornata H01–H08 e **non** lo spot social Linea A.  
**Stato Higgsfield:** chiuso. **Stato UI:** da girare.  
**Cartella ufficiale (fuori repo):** `Documents\personaggi GFV\video\sostituzioni\`  
(`clip/` solo take tenuti, `clip/varianti/` scarti, `STILL/` lastre + lettera tenuta, `STILL/varianti/`, `registrazioni schermo/`). Non lasciare gli scarti I2V in `clip/`.

### 14.1 Storia (allineata all’app)

Equipaggio carro raccolta frutta = **4 persone compreso Mario**. Manca uno → **non si parte**. L’assente (Stefano) non compare: niente chiamata a Mario. Catena: Mario segnala a Luca → Luca shortlist / prestito Giuseppe dal magazzino → Giuseppe sale, il carro parte.

| # | Higgsfield | UI dopo |
|---|------------|---------|
| 1 | Carro fermo in frutteto pesche. Due comparse già sopra, in attesa. Mario **a terra**, scocciato. Niente raccolta in corso, niente telefono | — |
| 2 | Mario 3/4 di spalle, dolly nello schermo **nero** | Field workspace → **Segnala assenza** |
| 3 | Luca ufficio OTS, polo sage, laptop nero | Gestione lavori → standby / 3/4 → **Assegna sostituto** → Giuseppe spostabile → prestito |
| 4 | Giuseppe posa il sacco, poi notifica (telefono nero). Set magazzino Linea B | — |
| 4b | Giuseppe OTS magazzino, dolly telefono nero | — |
| 5 | Giuseppe sul 4° posto; il carro **parte** (qui inizia la raccolta) | — |
| 6 | Raccolta nel filare da dietro: carro **avanza**, pesche nei bins | — |

### 14.2 Pipeline Higgsfield (lock)

| Pezzo | Decisione |
|-------|-----------|
| Still | GPT Image 2 (Nano Banana **non** in catalogo 2026-09-11), 16:9, 2k high. Lastre separate prima delle scene. Max **3** ref. **Niente `soul_id`** |
| Video | Seedance 2.0 I2V dopo approvazione still, 5 s, 16:9, SFX on. Eventuale parlato Seedance: **mutare in montaggio** (labiale/gesti si tengono) |
| Preset | Declina **IN THE DARK** (`24bae836-2c4a-48e0-89b6-49fcc0b21612`) |
| Schermi | Telefono/laptop **neri**; UI GFV solo in registrazione |
| Costume Mario | Camicia oliva maniche lunghe (ref 29/08), **non** tuta+maschera del trattamento |
| MCP | `plugin-higgsfield-higgsfield` |

### 14.3 Lastre

| Lastra | Job / file | Stato |
|--------|------------|--------|
| Mario identità (scocciato, niente telefono) | `6f0555bb` → `STILL/01-mario.png` | **Tenuta** 2026-09-11 (variante A; B in `STILL/varianti/`) |
| Carro raccolta (due piani, forbice, cassette su entrambi, parapetti) | `dc2a729c` → `STILL/02-carro.png` (I) | **Tenuto** 2026-09-12 |
| Frutteto pesche a palmetta (location, alto) | `03afdd04` → `STILL/03-frutteto.png` (B) | **Tenuto** 2026-09-12 |
| Clip 1 (carro fermo, Mario a terra, 2 comparse) | `14d6950d` → `STILL/04-scena1.png` (D) | **Tenuta** 2026-09-12. Comparse parlano; una seduta. Parapetto basso bucato: tenuto; **fix obbligatorio** da clip 2 in poi |
| Clip 2 (Mario OTS, telefono nero, dolly) | `36d7d927` → `STILL/05-scena2.png` (C) | **Tenuta** 2026-09-12. Parapetto basso chiuso davanti alle gambe. Ripetere questo lock su ogni still col carro |
| Clip 3 (Luca ufficio OTS, polo sage, laptop nero) | `7814959e` → `STILL/06-luca.png` (A) | **Tenuta** 2026-09-14 |
| Clip 4 start (Giuseppe sacco in mano, magazzino) | `1182604b` → `STILL/07-giuseppe.png` (B) | **Tenuta** 2026-09-14. I2V: posa sacco → buzz → telefono nero. Niente UI |
| Clip 4b (Giuseppe OTS magazzino, telefono nero) | `08aa5508` → `STILL/07b-giuseppe-ots.png` (A) | **Tenuta** 2026-09-15. Dolly notifica |
| Clip 5 (4 sul carro, Giuseppe 4° posto, partenza) | `625d0415` → `STILL/08-scena5.png` (B) | **Tenuta** 2026-09-14. Parapetti chiusi. I2V: il carro parte |
| Clip 6 start (raccolta nel filare, da dietro) | `06da6e1f` → `STILL/09-raccolta.png` (C) | **Tenuta** 2026-09-15. Mario alla guida, Giuseppe piano alto |
| Clip 6 end (carro più in fondo, stesso inquadratura) | `a546a6ff` → `STILL/09-raccolta-end.png` (A) | **Tenuta** 2026-09-16. Serve a forzare l’avanzamento in I2V. B in `STILL/varianti/` |

Ref Mario usate (3): fronte `d78476e5` · volto `ee49906d` · figura `9d7c7a7c`.

### 14.4 Clip I2V

| # | Beat | Job Higgsfield | File locale | Note |
|---|------|----------------|-------------|------|
| 1 | Carro fermo, comparse parlano, Mario a terra | `bfa1b695-1a62-4ca2-b1a1-e4243d86ff3a` | `clip/01-scena1.mp4` | **Tenuta** 2026-09-14. Parlato Seedance da tagliare in montaggio; labiale/gesti ok |
| 2 | Mario OTS, dolly telefono nero | `edd41a5d-5efc-4aee-a15f-6668abaa19af` | `clip/02-scena2.mp4` | **Tenuta** 2026-09-14. Primo take con ref trattamento: `ip_detected`. Zoom 0,5 s in montaggio se non chiude sul nero |
| 3 | Luca ufficio, dolly laptop nero | `66925985-2571-4db9-ba7a-db69ee944776` | `clip/03-luca.mp4` | **Tenuta** 2026-09-15 |
| 4 | Giuseppe posa sacco in magazzino | `5c86bb99-7b13-410a-93a0-bb878bf7dfff` | `clip/04-giuseppe.mp4` | **Tenuta** 2026-09-15. Poi beat 4b dolly notifica |
| 4b | Giuseppe OTS magazzino, dolly telefono nero | `29210180-9d5f-498d-a158-dcd22a8b98ce` | `clip/04b-giuseppe-dolly.mp4` | **Tenuta** 2026-09-15 |
| 5 | Carro parte, 4 a bordo | `3ddb4ad2-5503-4522-a7c8-28a7fad8f286` | `clip/05-scena5.mp4` | **Tenuta** 2026-09-15 |
| 6 | Raccolta nel filare, carro avanza, pesche nei bins | `be377c93-5232-4d54-818d-02572ba3bedf` | `clip/06-raccolta.mp4` | **Tenuta** 2026-09-16 (H). Start `06da6e1f` + end `a546a6ff` per forzare avanzamento. Scarti B–H in `clip/varianti/` |

### 14.5 UI da registrare

Setup: `http://127.0.0.1:8000/core/dev/demo-switcher-standalone.html` · password `DemoGFV2026!` · tenant **AZIENDA DEMO GFV** · Chrome **390×844** · crop sull’app (niente tab / `127.0.0.1`). Destinazione: `registrazioni schermo\`.

| Dopo clip | Ruolo | Azioni |
|-----------|-------|--------|
| 2 | Mario (mobile) | Field workspace → **Segnala assenza**. Stefano **non** compare in scena |
| 3 | Luca (desktop) | Gestione lavori → standby / 3/4 → **Assegna sostituto** → Giuseppe dal magazzino (prestito) |

### 14.6 Lezioni (non ripetere)

- Pescheto **palmetta/fusetto**, non vigneto. Equipaggio = **4 compreso Mario**; senza il 4° non si parte. Stefano assente: niente cameo, niente chiamata a Mario.
- Parapetti gialli: il tubo basso **non** deve bucare le gambe della comparsa seduta. Clip 1 tenuta col buco (`14d6950d`); da clip 2 in poi lock `36d7d927`.
- Clip 2: **non** usare come `video_references` l’OTS trattamento (`405eaa9a`) → `ip_detected`. I2V solo `start_image`.
- Raccolta: devono **staccare** le pesche e **metterle nei bins** (niente elastico / snap-back). Da dietro Seedance confonde l’avanzamento: `video_references` di un take in retromarcia (D/F) **copia la retromarcia**. Non invertire il file con ffmpeg (invertirebbe anche il gesto). Forzare direzione con `start_image` + `end_image` (carro più piccolo, più terra in primo piano). Take tenuto: H `be377c93`.
- In `clip/` solo i take tenuti. Scarti I2V → `clip/varianti/`; still scartate → `STILL/varianti/`.
- Higgsfield di questo spot: **non** rigenerare se non richiesto.
