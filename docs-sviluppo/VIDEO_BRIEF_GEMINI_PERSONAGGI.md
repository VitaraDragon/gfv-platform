# Brief Gemini — personaggi video GFV

**Data:** 2026-08-20 (stato produzione aggiornato in giornata)  
**Ambito:** **Linea A / giornata agosto** (Gemini → I2V). **Non** usare questo brief per la serie feature Linea B (settembre): still Higgsfield Nano Banana, vedi `VIDEO_STORYBOARD_SCRIPT_E_CLIP.md` §12.  
**Uso:** passare questo file (o i blocchi «Da incollare in Gemini») a Gemini per generare gli still.  
**Documento padre:** `PIANO_VIDEO_PRESENTAZIONE_PROF_E_RIUSO_COMMERCIALE.md`  
**Storyboard / clip UI:** `VIDEO_STORYBOARD_SCRIPT_E_CLIP.md`  
**Riferimento stile obbligatorio:** `core/images/tony-icon.png` (icona FAB di Tony)

Questo brief copre **solo i personaggi**. Ambientazioni e animazioni **non** si fanno in questo giro.

---

## 1. Risposte rapide (decisioni)

| Domanda | Decisione |
|---------|-----------|
| Sfondo trasparente? | **Sì, ma come secondo export.** Prima: still su studio neutro (meglio per animazione). Poi: PNG alpha per Filmora. |
| Ambientazioni adesso? | **Sì, nelle pose di scena** (ufficio Luca, vigneto Mario/Giuseppe). Niente pack di fondali vuoti. |
| Animazioni adesso? | **Higgsfield Seedance I2V** dallo still (start image). Audio **off**. Non Kling/Runway per questo video. |
| Quante versioni per personaggio? | **Il minimo per lo spot:** 1 lock (se serve) + 1 still di scena da animare. Niente turnaround. |
| Logo GFV sul gilet? | **No.** Foglia come il FAB; wordmark solo in sigla/end card. |
| UI dell’app? | **Mai.** Gemini non deve disegnare schermate GFV. L’interfaccia è sempre quella registrata. |

Perché due sfondi:

- I modelli **image-to-video** (Kling, Runway, Luma) lavorano male con PNG trasparenti: inventano bordi, gambe, ombre. Vogliono un RGB pieno, personaggio intero, studio semplice.
- **Filmora** per overlay su mockup laptop/telefono vuole PNG con alpha (o chroma pulito).

Ordine di export per ogni still approvato:

1. `studio` — fondo `#F4F1EA` (beige chiaro) o bianco, ombra morbida a terra.
2. `alpha` — stesso frame, sfondo rimosso (Photoroom / remove.bg / Filmora / Gemini se offre PNG trasparente).

Tony da studio è chiuso (`T_identity`, `T_present`). I prossimi still **vanno già in scena** (ufficio / vigneto): i crediti Higgsfield coprono i ponti dello storyboard, non un pack turnaround.

---

## 2. Come lavorare in Gemini (metodo)

1. Apri una chat **nuova per ogni personaggio** (Tony, Luca, Mario, Giuseppe).
2. **Ogni** generazione: allega `tony-icon.png`.
3. Dopo il primo still buono di quel personaggio: allegalo **sempre** come identity lock (oltre a Tony).
4. Genera **un’immagine per messaggio**, non un collage di 12 pose (il volto deriva).
5. Se il volto cambia: non continuare. Riparti dall’identity lock approvato.
6. Salva i file con i nomi della tabella §6. Non rinominare a caso.

Messaggio di apertura (incollare + allegare `tony-icon.png`):

```
Sei il character artist del video GFV Platform.

Stile visivo BLOCCATO sul file allegato (Tony, mascotte FAB):
- 3D stylized cartoon, qualità mobile-game (tipo Hay Day / Clash of Clans), NON fotorealistico, NON anime, NON 2D flat
- pelle liscia, illuminazione soft, materiali plastici morbidi
- palette: verde agricolo #2E8B57 / #228B22, paglia, bandana rossa, dettagli caldi
- espressione amichevole, da guida/mentore

Regole:
- Non inventare l’interfaccia dell’app GFV (niente screenshot, niente UI finta)
- Non mettere il personaggio in un paesaggio: SOLO studio neutro beige chiaro #F4F1EA, ombra morbida a terra
- Un personaggio per immagine, inquadrato intero se chiedo full body
- Volto, proporzioni, vestiti e palette devono restare identici tra un’immagine e l’altra
- Testo nell’immagine: nessuno, tranne se te lo chiedo esplicitamente

Aspetta le schede personaggio e genera solo l’asset che ti chiedo, uno alla volta.
```

---

## 3. Stile locked (da `tony-icon.png`)

Tony (mascotte) — tratti da copiare nello **stile**, non sul vestito di tutti:

- uomo anziano, sorriso caldo, occhi marroni
- barba e baffi bianchi/grigi, curati
- cappello di paglia a tesa larga, bordo leggermente frastagliato
- bandana **rossa** al collo
- camicia chiara a quadretti verdi/beige
- gilet verde bosco, icona foglia/germe chiara sul petto
- cornice circolare verde nell’icona originale: **non** copiarla negli still full-body

Palette da rispettare:

| Uso | Colore |
|-----|--------|
| Verde brand / gilet / accenti | `#2E8B57`, `#228B22` |
| Bandana Tony | rosso vivo |
| Paglia cappello | giallo-beige caldo |
| Studio | `#F4F1EA` |
| Ombra a terra | grigio caldo, morbida, non nera dura |

Vietato: foto reale, Unreal/cinematic, Pixar troppo “bambino”, anime, chibi, testo, loghi inventati, schermi con UI finta, watermark.

---

## 4. I quattro personaggi (bible)

Solo **Tony** ha cappello di paglia + bandana rossa + gilet verde. Gli altri tre sono nello **stesso mondo 3D**, vestiti diversi, altrimenti sembrano tutti Tony.

### TONY — mascotte AI (A01)

- Ruolo video: intro, scena ore con Giuseppe, end card.
- Non è un operaio dell’azienda: è l’assistente.
- Età visiva: 65–75. Stesso volto dell’icona FAB.
- Costume: identico all’icona (cappello paglia, bandana rossa, camicia a quadretti, gilet verde).
- Corpo: mezzo busto e full body; corporatura morbida, non atletica.
- Accessori: nessuno extra (niente tablet, niente telefono) salvo pose esplicite «indica / saluta».

### LUCA MARTINI — manager (A02)

- Ruolo video: crea il lavoro (laptop), chiude il ciclo in ufficio.
- Età visiva: 38–45. Capelli castani corti, barba corta curata o pulita (scegline **una** al primo still e non cambiarla).
- Viso: europeo sud, sguardo calmo, professionale, sorriso lieve.
- Costume: polo o camicia chiara, maglia/gilet **senza** cappello di paglia, pantaloni chino. Palette verde/beige coordinata, non completo da città grigio.
- Prop tipici: laptop chiuso o aperto **con schermo spento/neutro** (niente UI).
- Mai: stivali da campo, cappello di paglia, bandana rossa.

### MARIO ROSSI — caposquadra (A03)

- Ruolo video: comunicazione al telefono + validazione ore.
- Età visiva: 45–55. Distinguibile da Tony: **più giovane**, niente cappello di paglia, niente bandana rossa.
- Capelli: castano scuro/grigio, corti. Barba corta o rasato (lock al primo still).
- Costume: camicia da lavoro verde oliva o kaki, pantaloni da campo, stivali; eventuale cappellino da baseball verde **o** niente cappello — scegline uno e tienilo.
- Prop tipici: smartphone in mano (schermo spento/neutro).
- Mai: gilet identico a Tony, bandana rossa, look da manager in ufficio.

### GIUSEPPE FERRARI — operaio (A04)

- Ruolo video: riceve comunicazione, segna le ore con Tony.
- Età visiva: 28–35. Più giovane di Mario. Viso aperto, energia da campo.
- Capelli: castani, corti. Senza cappello, oppure cappellino semplice diverso da Mario.
- Costume: maglia a maniche corte o felpa leggera verde/beige, pantaloni da lavoro, stivali. Eventuali guanti da lavoro in una sola pose.
- Prop tipici: nessuno, o telefono; **Tony può comparire accanto solo nelle pose T+G** (vedi §6), non in ogni still di Giuseppe.
- Mai: identico a Mario; mai il costume di Tony.

---

## 5. Cosa generare adesso (e cosa no)

**Fatto (Tony + Luca, 2026-08-20):**

- `T_identity` / `T_turn_34` — full body 3/4 studio, approvato.
- `T_present` — indica lo spazio a destra, approvato.
- I2V Higgsfield da `T_present` — `Downloads\hf_20260820_102138_e4d77e21-dcce-4af0-b6f3-75700a709231.mp4` (mutare EN).
- `L_laptop` — Luca rasato, tempie grigie, polo sage, ufficio, laptop schermo spento. Primo Gemini scartato (Tony giovane).
- I2V Luca — `Downloads\hf_20260820_113831_752260ba-e42c-4698-a59a-a882a2863f4e.mp4` (5 s 16:9 fumetto, senza audio). Ponte C01 + riuso C05.
- Scartati: turnaround “fronte” (stesso 3/4); I2V fotoreale `hf_20260820_095623_c4234855-…`.

**Fatto in più (Mario + Giuseppe idle, 2026-08-20 sera):**

- `M_phone` + I2V `hf_20260820_141520_15b9e1d4-…` — TENERE (ponte C02/C04).
- `G_work` solo Giuseppe (senza Tony) + I2V `hf_20260820_150004_6233a701-…` — TENERE (ponte C03).
- Coppia Gemini TG_together: non usata per I2V (si è scelto Giuseppe solo).

**Adesso (sceneggiatura giornata, §11 dello storyboard):** still di **scena**, non altri identity.

1. ~~H01 Luca ufficio con carte~~ **tenuto** `hf_20260820_160946_0831fc22-…` (Filmora: zoom sul nero → C01).
2. ~~H02a Mario trattore campo arato~~ **tenuto** `hf_20260821_035909_aa26ab88-…` (solco lento, niente telefono).
3. ~~H02b Mario cabina + telefono~~ **tenuto** `hf_20260821_042905_cb1763fb-…` (Filmora: zoom sul nero → C02).
4. ~~H03a Giuseppe sacchi + magazzino~~ **tenuto** `hf_20260821_102132_af72f479-…`.
5. ~~H03b Giuseppe telefono 3/4~~ **tenuto** `hf_20260821_114541_94b7bb26-…` (Filmora: zoom sul nero → ricezione).
6. ~~H04 ritrovo Squadra Rossi ore 7~~ **tenuto** `hf_20260821_125641_2d38c342-…`.
7. ~~H05 Giuseppe + comparse filari (taglio grappolo)~~ **tenuto** `hf_20260821_131934_12d246f8-…`.
8. ~~H06 Giuseppe sera, telefono spento~~ **tenuto** `hf_20260821_134024_95fc988c-…` (sbadiglio, poi dolly → C03).
9. ~~H07 Mario sera, auto in aia~~ **tenuto** `hf_20260821_142116_7895eec2-…` → C04.
10. ~~H08 Luca ufficio sera, luci accese~~ **tenuto** `hf_20260821_153742_bd1b6f3f-…` (chiude quaderno, poi dolly → C05).

I2V idle già tenuti = fallback, non da rifare. **Niente riuso** H02b/H01 per C04/C05.

**Non fare:** altri still Tony da studio; turnaround fronte/profilo; T2V senza start image; **tenere** l’audio parlato Higgsfield (EN/UK) su T0/T1 — si sostituisce con Chirp3; scritta GFV sul gilet.

---

## 6. Elenco file da produrre

Convenzione: `{id}_{chi}_{inquadratura}_{posa}_studio.png`  
Poi copia alpha: stesso nome con `_alpha.png`.

Formato: PNG, 1:1 a 2048 px (o il massimo che Gemini dà). Poi in Filmora si ritaglia.

### 6.1 Tony (`T`)

| File | Inquadratura | Posa | Serve per |
|------|----------------|------|-----------|
| `T_identity` | Busto 3/4 | Sorriso verso camera, come l’icona | Lock + intro |
| `T_turn_front` | Full body fronte | In piedi, braccia rilassate | I2V / turnaround |
| `T_turn_34` | Full body 3/4 | Idem | I2V |
| `T_turn_side` | Full body profilo | Idem | I2V |
| `T_wave` | Busto o full | Saluta con la mano | Intro / end |
| `T_present` | Busto | Indica di lato (spazio per UI a destra) | Transizione verso clip |
| `T_talk` | Busto | Bocca leggermente aperta, espressione che parla | Scena ore (sopra TTS vero) |

### 6.2 Luca (`L`)

| File | Inquadratura | Posa | Serve per |
|------|----------------|------|-----------|
| `L_identity` | Busto 3/4 | Sorriso professionale | Lock + cartello C01/C05 |
| `L_turn_front` | Full body fronte | In piedi | I2V |
| `L_turn_34` | Full body 3/4 | Idem | I2V |
| `L_laptop` | Piano americano | Siede o sta in piedi con laptop, schermo spento | Scena manager |
| `L_look` | Busto | Guarda verso destra (verso la UI) | Ponte verso clip C01/C05 |

### 6.3 Mario (`M`)

| File | Inquadratura | Posa | Serve per |
|------|----------------|------|-----------|
| `M_identity` | Busto 3/4 | Espressione operativa, sorriso lieve | Lock |
| `M_turn_front` | Full body fronte | In piedi | I2V |
| `M_turn_34` | Full body 3/4 | Idem | I2V |
| `M_phone` | Piano americano | Smartphone in mano, schermo spento | Comunicazione |
| `M_approve` | Busto | Cenno di ok / pollice su | Validazione ore |
| `M_look` | Busto | Guarda verso destra | Ponte verso clip C02/C04 |

### 6.4 Giuseppe (`G`)

| File | Inquadratura | Posa | Serve per |
|------|----------------|------|-----------|
| `G_identity` | Busto 3/4 | Sorriso aperto | Lock |
| `G_turn_front` | Full body fronte | In piedi | I2V |
| `G_turn_34` | Full body 3/4 | Idem | I2V |
| `G_phone` | Piano americano | Legge il telefono, schermo spento | Ricezione |
| `G_work` | Full body 3/4 | In campo, posa di lavoro ferma (non in movimento) | Cartello C03 |
| `G_look` | Busto | Guarda verso destra | Ponte verso clip |

### 6.5 Coppia (solo dopo i lock singoli)

| File | Contenuto | Serve per |
|------|-----------|-----------|
| `TG_together` | Giuseppe in primo piano, Tony accanto (stesso stile, stesso studio) | Scena «operaio + Tony» |

Non fare altre coppie (Luca+Mario, ecc.) in questo giro.

**Totale indicativo:** ~28 still studio + gli stessi in alpha. Basta per Filmora e per first-frame I2V.

---

## 7. Prompt da incollare (uno alla volta)

Sostituisci solo la riga **SHOT**. Prefisso identico.

### Prefisso (sempre)

```
Same 3D stylized cartoon art style as the attached Tony mascot reference.
Soft studio lighting, smooth plastic-like materials, mobile-game quality.
Friendly agricultural character, not photorealistic, not anime, not flat 2D.
Plain light beige studio background #F4F1EA, soft contact shadow on the ground.
No text, no UI, no logos, no photo-real skin, no circular icon frame.
```

### Tony — identity (primo still, allega solo `tony-icon.png`)

```
SHOT: Chest-up 3/4 portrait of TONY, the elderly farmer mascot.
Straw hat, white beard, bright red bandana, forest-green utility vest over
a light checkered shirt, small sprout/leaf badge on vest.
Warm smile, looking at camera. Match the attached face as closely as possible.
```

### Tony — full body front

```
SHOT: Full-body front view of the SAME Tony already approved.
Standing relaxed, feet visible, straw hat, red bandana, green vest, checkered shirt.
Keep identical face and costume.
```

### Luca — identity (allega `tony-icon.png` + `T_identity` solo come stile, non copiare il vestito)

```
SHOT: Chest-up 3/4 portrait of LUCA, farm-company manager, age about 40.
Same 3D art style as Tony, DIFFERENT person: no straw hat, no red bandana, no green utility vest.
Short brown hair, light professional smile, polo or light shirt, earth-and-green palette.
Office-capable but still agricultural brand, not a city banker.
```

### Luca — laptop

```
SHOT: Medium shot of the SAME Luca, standing or sitting with a closed or blank-screen laptop.
No visible user interface on the screen. Same face and clothes as Luca identity.
Beige studio background.
```

### Mario — identity

```
SHOT: Chest-up 3/4 portrait of MARIO, farm crew leader, age about 50.
Same 3D art style as Tony, DIFFERENT person: younger than Tony, no straw hat, no red bandana.
Short dark hair, light stubble, olive work shirt, outdoor crew-lead look.
Friendly but practical expression.
```

### Mario — phone

```
SHOT: Medium shot of the SAME Mario holding a smartphone, screen off or blank.
Same face and clothes. Beige studio. No UI on the phone.
```

### Giuseppe — identity

```
SHOT: Chest-up 3/4 portrait of GIUSEPPE, young farm worker, age about 30.
Same 3D art style as Tony, DIFFERENT person: no straw hat, no red bandana, no Tony vest.
Short brown hair, open smile, simple work t-shirt or light sweatshirt in green/beige, work trousers.
```

### Giuseppe — work pose

```
SHOT: Full-body 3/4 of the SAME Giuseppe, standing in a still field-work pose (not walking, not running).
Beige studio only, no vineyard background. Same face and clothes.
```

### Coppia Tony + Giuseppe (solo a lock approvati; allega entrambi gli identity)

```
SHOT: Same Giuseppe in the foreground, same Tony standing beside him, both in approved costumes.
Same height relationship: Tony slightly shorter/rounder. Beige studio. No UI. No extra people.
```

Per turnaround e altre pose: stesso prefisso + «SHOT: full-body front / 3/4 / side profile of the SAME [nome] already approved. Identical face and costume.»

### Variante alpha (dopo che lo still studio è buono)

```
Same exact character, pose, framing and costume as the last approved image.
Remove the background completely: transparent PNG, clean edges, no halo, no studio floor.
Do not change the character.
```

Se Gemini non dà alpha pulito: tieni lo studio e togli lo sfondo in Photoroom/Filmora.

---

## 8. Controllo qualità (quando dire «no, rifai»)

Scarta e rigenera se:

- il volto non è lo stesso dell’identity lock
- Mario o Giuseppe hanno cappello di paglia / bandana rossa / gilet di Tony
- compare UI, testo, watermark, cornice tonda dell’icona
- manca un piede/mano tagliata sul full body (inutile per I2V)
- illuminazione da film realistico o pelle fotografica
- sfondo con vigneto, ufficio, strada, cielo (troppo presto)

Tieni se: stesso volto, stesso vestito, studio pulito, personaggio intero, stile 3D da icona.

---

## 9. Handoff verso l’animazione (dopo, altro servizio)

Quando gli still `studio` sono approvati:

1. Non usare i file `_alpha` come first frame.
2. Carica `*_turn_front` o la posa di scena (`L_laptop`, `M_phone`, …).
3. Prompt I2V **corto**, esempio:

```
Subtle idle motion only, same 3D cartoon character, slight smile, gentle head movement,
camera locked, no walking, no talking, no morphing face, no extra objects, keep costume identical.
```

4. Durata 3–5 secondi. Un clip per still.
5. In Filmora: loop o Ken Burns sugli still se l’I2V deforma il volto.

Servizio in uso: **Higgsfield Seedance**, image-to-video, start frame = PNG scena. Piano Plus (crediti a consumo, non rollover).  
Prompt I2V: movimento minimo, **stesso personaggio 3D**, camera fissa, `Do NOT replace with a real person`, `No speech`.  
Se lo slot start image non mostra il fumetto, non generare. Voce italiano = TTS delle clip UI / narratore in Filmora. Non HeyGen.

---

## 10. Collegamento alle clip UI già girate

Le clip vere restano in `c:\Users\tanne\Videos\Captures\`. I personaggi sono solo i «cartelli» prima/dopo:

| Cartello personaggio | Clip UI |
|----------------------|---------|
| Luca `L_laptop` / `L_look` | `clip creazione lavoro con domanda giorni.mp4` |
| Mario `M_phone` | `clip invio comunicazione buona.mp4` |
| Giuseppe `G_phone` | `clip ricezione comunicazione buona.mp4` |
| `TG_together` + `T_talk` | `clip salvataggio ore buona.mp4` (audio TTS Tony originale) |
| Mario `M_approve` | `clip validazione ore buona.mp4` |
| Luca `L_look` | `clip controllo ore validate da manager buona-tagliata.mp4` |

---

## 11. Checklist di questo giro

- [x] Chat Gemini con `tony-icon.png`
- [x] `T_identity` approvato (full body 3/4 vs icona)
- [x] `T_present` approvato
- [ ] Tony turnaround + wave + talk — **saltati** (non servono allo spot)
- [x] I2V Tony `T_present` (Higgsfield) — mutare audio
- [x] `L_laptop` ufficio + I2V Higgsfield (rasato; non Tony giovane)
- [x] Mario `M_phone` vigneto + I2V (idle; ponte C02/C04)
- [x] Giuseppe `G_work` solo + I2V (idle; ponte C03)
- [x] H01 Luca ufficio I2V giornata
- [x] H02a Mario trattore I2V giornata
- [x] H02b Mario cabina + telefono (dolly → C02)
- [x] H03a Giuseppe sacchi + magazzino (movimento)
- [x] H03b Giuseppe telefono (dolly → ricezione)
- [x] H04 ritrovo squadra ore 7 (comparse)
- [x] H05 lavoro filare (Giuseppe + comparse, taglio grappolo)
- [x] H06 Giuseppe sera telefono (sbadiglio, dolly → C03)
- [x] H07 Mario sera auto in aia → C04
- [x] H08 Luca ufficio sera, luci accese → C05
- [ ] Export `_alpha` solo se overlay Filmora su mockup
- [ ] Stop studio pack. Prossimo = scene di storyboard, non pose extra
