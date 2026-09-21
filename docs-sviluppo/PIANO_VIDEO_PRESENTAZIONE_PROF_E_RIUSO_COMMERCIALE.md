# Piano video presentazione GFV — scelte consolidate

**Data:** 2026-08-02 (produzione: spot giornata 2026-08-23/24; Linea B trattamento Mario 2026-09-10; movimento magazzino 2026-09-10; sostituzioni 2026-09-16)  
**Stato:** direzione invariata; dettaglio operativo in `VIDEO_STORYBOARD_SCRIPT_E_CLIP.md` (giornata §4/§11, trattamento Mario §12, movimento magazzino §13, sostituzioni §14)  
**Owner:** Tanner (+ supporto Cursor per script/storyboard/materiali)

---

## 1. Scopo

### Primario (ora)
Presentare GFV Platform al **professore del corso di vibe coding**, in modo che possa:
- capire velocemente cos’è l’app e come funziona;
- valutare l’approccio (gestionale + AI) senza perdere troppo tempo;
- dare feedback utile per continuare lo sviluppo e correggere scelte sbagliate;
- approfondire nel codice **solo se vuole** (accesso al repo GitHub).

### Secondario (se il risultato è buono)
Riusare lo stesso materiale (o una versione leggermente ripulita) come **video esplicativo / promozionale** per scopi commerciali.

> Regola: progettiamo per il professore, ma con qualità e tono tali da non buttare via il lavoro se serve in marketing.

---

## 2. Destinatario principale (professore)

| Aspetto | Assunzione |
|---------|------------|
| Informatica / gestionali | Molto esperto |
| Settore agricolo | Non è il suo campo; conosce i nomi di alcune operazioni, non i dettagli operativi |
| Tempo disponibile | Limitato: **non contare su 1 ora** |
| Cosa può giudicare bene | Architettura, UX da gestionale, manutenibilità, integrazione AI, priorità, debito tecnico |
| Cosa non chiedere | Validità agronomica dettagliata dei flussi di campo |

### Linguaggio da usare
- Partire dal **gestionale** (anagrafiche, magazzino, ore, ruoli, preventivi, report).
- Tradurre i termini agricoli solo quanto basta (terreno ≈ unità produttiva; lavoro ≈ ordine di lavoro/commessa).
- Non fare lezione di agricoltura.

---

## 3. Formato di presentazione (anti-noia, veloce)

### Scelta
**Video corto + accesso demo + accesso GitHub**  
(non una presentazione slide lunga; non un tour verbale di tutti i moduli).

| Elemento | Ruolo | Tempo stimato per lui |
|----------|--------|------------------------|
| Video esplicativo/dinamico | Capire prodotto e flussi | ~8–10 min (versione prof) / ~60–90 sec (spot corto riusabile) |
| Accesso demo (login) | Provare se vuole | opzionale |
| Repo GitHub | Curiosare nel codice se necessario | opzionale |
| Call breve di follow-up | Solo se dopo il video vuole approfondire | ~10–15 min |

### Scelta esclusa
- Presentazione frontale da 45–60 minuti
- Spiegare tutti i moduli uno per uno
- Documentazione tecnica pesante *prima* che abbia visto l’app funzionare

---

## 4. Linguaggio visivo del video

### Decisione: stile fumettoso / 3D stilizzato come Tony (FAB)
**Non** attori fotorealistici e ambientazioni da film live-action.

**Riferimento ufficiale di stile:** icona Tony del FAB  
`core/images/tony-icon.png` + colore FAB in `core/styles/tony-widget.css`

Tratti da rispettare:
- personaggio 3D stilizzato (non foto reale, non flat 2D eccessivamente semplice);
- look amichevole da “contadino/assistente”;
- palette agricola: verdi (`#2E8B57` / `#228B22` e affini), paglia, dettagli caldi (es. bandana rossa di Tony);
- illuminazione soft, tono positivo e chiaro;
- personaggi e ambientazioni **coerenti tra loro** nello stesso stile.

### Formula ibrida (obbligatoria)
1. **Personaggi illustrati** (operaio, caposquadra, manager, Tony) nello stile Tony  
2. **Ambientazioni illustrate** nello stesso stile (campo/vigneto semplificato)  
3. **Schermate dell’app sempre reali** (registrazione / screenshot veri)  
4. Montaggio che alterna: scena personaggio → UI reale dell’azione

> Regola d’oro: l’IA non deve “inventare” l’interfaccia di GFV.  
> UI falsa = rischio credibilità (sia col professore sia in commerciale).

### Perché questa scelta
- Coerente col brand già presente in app (Tony).
- Più tollerante agli artefatti IA rispetto al realistico.
- Più veloce da produrre in modo uniforme.
- Adatta sia a un corso “vibe coding” sia a un video prodotto leggibile.

---

## 5. Contenuti narrativi da mostrare

### Approccio
Pochi flussi reali, raccontati per **ruoli**, non elenco funzioni.

### Flussi confermati (2026-08-03) — usabili in demo
Dettaglio operativo (pagine, clip, script): `VIDEO_STORYBOARD_SCRIPT_E_CLIP.md`.

**Arco ufficiale (ciclo chiuso):**  
Manager crea lavoro → Caposquadra comunica → Operaio+Tony segna ore → Caposquadra valida → Manager quadro aggiornato.  
(Guasto = scena opzionale secondaria.)

| # | Ruolo | Azione | Dove in app | Stato |
|---|-------|--------|-------------|-------|
| 1 | Manager | Crea/assegna lavoro | `gestione-lavori-standalone` | Confermato |
| 2 | Caposquadra | Comunicazione operativa | `field-workspace-standalone` | Confermato |
| 3 | Operaio + Tony | Segnatura ore (+ voce Tony) | `field-workspace-standalone` | Confermato |
| 4 | Caposquadra | Valida ore | field-workspace / validazione-ore | Confermato |
| 5 | Manager | Quadro aggiornato | hub / impegni | Confermato |

**Registrazione:** tutto da PC (DevTools mobile per capo/operaio). Telefono non obbligatorio.

**Vincoli veri:**
- Comunicazioni = canale operativo strutturato (non chat libera).
- Audio sistema ON per TTS di Tony.
- Serve seed dati (`sim:run:demo-max`).

### Principio
Mostrare solo flussi **davvero esistenti e dimostrabili** nell’app.  
Niente fiction funzionale.

---

## 6. Produzione tecnica (tool)

| Fase | Tool | Note |
|------|------|------|
| Montaggio principale | **ffmpeg** (spot v11, 2026-08-23/24) · Filmora Pro opzionale | ffmpeg = primo taglio commerciale; Filmora per mockup / taglio prof |
| Cattura UI reale | Registrazione schermo (Loom / OBS / strumento OS) | Clip corte, pulite, dati demo popolati |
| Personaggi / ambientazioni stile Tony | Gemini (still) + **Higgsfield I2V** (start image) | **Linea A / giornata (agosto):** Gemini + Seedance; H01–H08 audio off; T0/T1 parlato IT (Wan 2.7) + VO Chirp3. **Linea B / serie feature (settembre):** still Nano Banana o GPT Image 2 (`image_references`, no `soul_id`) + Seedance 2.0, SFX on; trattamento Mario §12, movimento magazzino §13, sostituzioni §14 chiusi (`VIDEO_STORYBOARD_SCRIPT_E_CLIP.md`) |
| Voce | **Tony in-app** `it-IT-Chirp3-HD-Charon` su tutto lo spot; C03 = audio della clip ore | Non tenere il parlato Higgsfield (EN/UK). GFV = **Gi Effe Vu** |
| Eventuali avatar parlanti | Opzionale (HeyGen / simili) | Non obbligatori se bastano personaggi + voce narrante |

### Disponibilità
Si è aperti a tool aggiuntivi oltre Filmora, se servono a migliorare qualità o velocità.

---

## 7. Due versioni dello stesso materiale

| Versione | Durata target | Uso |
|----------|---------------|-----|
| **Prof / review** | 8–10 minuti | Contestualizza, mostra 3–4 flussi, chiude con richieste di feedback |
| **Spot commerciale (storia)** | ~90 secondi | Ciclo chiuso ufficio→campo. Taglio lavoro: `GFV_spot_v11.mp4` |
| **Spot social 59s** | ~59 secondi | Mondo GFV che prova a uscire da un laptop. **Prova stile 2026-08-23: non è lo spot.** Decisioni: `Documents\primo video spot GFV\SPOT SOCIAL\LEGGIMI.txt` |
| **Serie feature Linea B** | clip 5 s + UI reale | Un flusso per spot. Trattamento Mario: Higgsfield chiuso 2026-09-10, UI da girare (§12). Movimento magazzino: Higgsfield chiuso 2026-09-10 (Giuseppe sacchi + Luca foto bolla), UI da girare come Luca, niente OCR (§13). Sostituzioni: Higgsfield chiuso 2026-09-16 (carro pesche, shortlist, prestito Giuseppe, raccolta nel filare), UI da girare (§14). Cartelle `Documents\personaggi GFV\video\trattamento mario\`, `movimento magazzino\`, `sostituzioni\` |

Stessa formula ibrida (personaggi 3D + UI reale).  
Lo spot social è un asset **separato**, non un taglio dello spot storia. Linea B non si mescola in montaggio con Linea A.

---

## 8. Accessi da fornire al professore

1. **Link video** (versione prof)  
2. **Credenziali demo** (se possibile, con dati già popolati)  
3. **Invito GitHub** al repository  
4. **Documento “Start here”** (breve): dove guardare nel codice se vuole approfondire  
5. **5 domande di feedback** precise (architettura, UX gestionale, AI, priorità, debito tecnico)

---

## 9. Cosa chiedere esplicitamente in feedback

1. L’architettura generale del gestionale è sensata?  
2. La UX (liste, form, ruoli, flussi) è coerente con un gestionale serio?  
3. Tony è integrato nel modo giusto o è un pezzo a sé?  
4. Quali 2–3 cose correggeresti subito?  
5. Su cosa concentrare lo sviluppo dopo?

Non chiedere: “ti piace?” in astratto.  
Non chiedere validazione agronomica di dettaglio.

---

## 10. Divisione del lavoro

| Cosa | Chi |
|------|-----|
| Documento scelte, script, storyboard, messaggio al prof, Start here | Cursor / preparazione scritta |
| Registrazione schermate reali con account demo | Tanner (eventualmente guidato) |
| Generazione asset personaggi/scene stile Tony | Gemini still + Higgsfield I2V; Cursor per prompt/QA. T0/T1 parlati IT 2026-08-23 |
| Montaggio spot | ffmpeg (v11) in `Documents\primo video spot GFV`; Filmora opzionale |
| Invito GitHub e invio pacchetto al professore | Tanner |

---

## 11. Decisioni già chiuse

- [x] Destinatario primario = professore vibe coding  
- [x] Riuso commerciale = obiettivo secondario se qualità ok  
- [x] Formato = video dinamico + demo + repo (no lezione lunga)  
- [x] Linguaggio = gestionale first, agricoltura solo di contesto  
- [x] Stile visivo = fumettoso/3D stilizzato come Tony FAB (**non** fotorealistico)  
- [x] UI app = sempre reale  
- [x] Montaggio = Filmora Pro (+ altri tool se utili)  
- [x] Due tagli possibili: lungo (prof) e corto (commerciale)  
- [x] Flussi demo = ciclo chiuso manager → capo → operaio+Tony → validazione → manager  
- [x] Storyboard + script + lista clip in `VIDEO_STORYBOARD_SCRIPT_E_CLIP.md`  
- [x] Strategia registrazione tutto-da-PC  
- [x] Pronuncia brand: **Gi Effe Vu** (spot storia v10; social: *Gìeffevù. Il tuo mondo. In un’app.*)  
- [x] Spot social 59s: idea laptop + onde **approvata**; prova Higgsfield 23 ago = solo stile. Filo chiuso: barriera elastica / risucchio / ondata successiva. Tony = solo cast `personaggi GFV`. Non rifare a clip scollegate. Dettaglio in `SPOT SOCIAL\LEGGIMI.txt`.  

---

## 12. Aperti / prossimi passi

1. ~~**Tenant demo cloud**~~ seed + switcher + **geo privacy-safe v2** (fasce lineari, origin privacy, stile mappa demo-only): `da-fare/demo/PIANO_TENANT_DEMO_PRODUZIONE.md` §6.1  
   - Switcher: `core/dev/demo-switcher-standalone.html` (password `DemoGFV2026!`)  
2. ~~Prova manuale del ciclo video sul tenant demo via switcher (Tony cloud).~~  
3. Smoke mappe: gestione lavori → tab Mappa (fasce O→E, roadmap senza etichette) — se serve in clip mappa.  
4. ~~Registrare clip `C01`–`C05`.~~ Take 2026-08-20 in `Videos\Captures\` + tagli C02/C05; dettaglio in `VIDEO_STORYBOARD_SCRIPT_E_CLIP.md`.  
5. Personaggi: lock + I2V idle tenuti. Scene Higgsfield **H01–H08 tenute**. T0/T1 parlati IT 2026-08-23.  
6. ~~Prossimo: montaggio Filmora~~ **Spot storia montato in ffmpeg:** `Documents\primo video spot GFV\GFV_spot_v11.mp4` (lavoro) · `GFV_spot_v10.mp4` (pronuncia GFV **Gi Effe Vu**, non sovrascrivere). Filmora resta opzionale (mockup, taglio prof).  
7. **Spot social 59s:** fermo dopo prova stile (`GFV_spot_social_prova.mp4`). Ripartire solo con 4–6 clip legati + Tony di `personaggi GFV` + barriera elastica. Crediti: attendere rinnovo Plus (~20 set 2026) o ricarica 2000. Non spendere su un altro giro di clip indipendenti.  
8. Scrivere `START_HERE` tecnico per il repo.  
9. Inviare pacchetto al professore.

---

## 13. Nota di metodo

Questo documento fissa la **direzione**.  
Script, storyboard e clip list operativi stanno in `VIDEO_STORYBOARD_SCRIPT_E_CLIP.md`.  
Spot social 59s (prove, crediti, filo barriera elastica): `Documents\primo video spot GFV\SPOT SOCIAL\LEGGIMI.txt`.  
Ogni nuova scelta rilevante (tool IA definitivi, durata finale montata, link pubblicati) va aggiornata qui o lì, così non si riparte da zero.
