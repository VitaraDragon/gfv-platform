# Piano: proposta confine terreno da tap (mappa)

**Stato:** pianificato (design, non implementato)  
**Data decisioni:** 2026-08-28  
**Per chi:** agenti e sviluppatori che toccano **anagrafica Terreni**, **mappa**, `polygonCoords`, eventuali CF di segmentazione.  
**Non implementare il codice** finché la **Fase 0 (pilota di misura)** non ha un go/no-go esplicito.

**Analisi coerenza Master Plan (Fase 4 / GIS Terreni):** questa modifica è scalabile perché non introduce un secondo modello geometrico né `if` Tony per il form terreno. Il tap produce una **proposta** nello stesso `polygonCoords` già usato da lavori, zone, vendemmia, mappa aziendale e allarmi manodopera. La conferma umana è lo stesso principio di Tony Occhi (proposta + revisione, mai auto-save). Tony resta fuori dal primo rilascio: può aprire la pagina; non traccia poligoni.

Piano canonico in repo: questo file. In caso di contrasto con chat precedenti, **prevale questo documento**.

---

## 1. Problema

Catalogare i terreni dal telefono è lento. Oggi l’utente apre la mappa, preme **Traccia Confini** e tocca **vertice per vertice**. Su 20–50 appezzamenti (soprattutto vigneto/frutteto, dove i bordi si vedono bene) il lavoro è ripetitivo.

Su Google Maps, a occhio, i confini “si vedono subito” (filari, siepi, strade bianche, cambio di colore). L’idea di prodotto: **un tap o un click nel campo propone il perimetro**, poi l’utente conferma o ritocca.

---

## 2. Premessa tecnica (da non dimenticare)

Ciò che si vede su Maps **non è un oggetto cliccabile**. È un’immagine satellitare. Google Maps Platform **non espone** un’API del tipo “clicca il campo → ti do il poligono”.

Quindi la domanda non è “si può fare un click?”, ma **da dove ricaviamo il poligono dopo il tap**.

Tre fonti possibili (valutate in design; **solo la 1 è in scope del primo tentativo**):

| # | Fonte | Ruolo | Nota |
|---|--------|--------|------|
| 1 | **Segmentazione sull’immagine** (tap = point prompt → maschera → poligono) | Primaria | Più vicina all’idea “tap nel campo”. |
| 2 | **Catasto / particelle** (WMS/WFS, LPIS/AGEA) | Fuori scope v1 | Preciso sulla particella, spesso **sbagliato come campo di lavoro** (un Sangiovese su tre particelle; una particella con due colture). Licenze da valutare. |
| 3 | **Dataset agricoli già calcolati** (Sentinel, overlay commerciali) | Fuori scope v1 | Copertura e aggiornamento a macchia di leopardo; licenze. |

---

## 3. Decisioni di prodotto (canoniche)

Queste voci chiudono la discussione del 2026-08-28. Prevalgono su ipotesi in chat.

| Tema | Decisione |
|------|-----------|
| **Obiettivo UX** | Non “crea confine definitivo”, ma **«Proponi confine»**. Tap → poligono in evidenza → **ettari calcolati come oggi** → ritocco vertici se serve → **Salva** esplicito. |
| **Superficie (ha)** | **Sì, identica al sistema classico.** Stesso poligono → stessa funzione (`google.maps.geometry.spherical.computeArea` → m² / 10 000 = ha). Appare in «Superficie calcolata», riempie il campo **Superficie (ettari)** e si ricalcola se si spostano i vertici. Non un secondo motore di area. |
| **Aspetto della bozza** | **Tratteggio, non pulse.** Finché non si salva: perimetro **tratteggiato bianco** (spessore > tratto classico), riempimento coltura più trasparente, pallini vertice trascinabili. Dopo **Salva**: stesso stile solido del tracciamento attuale (colore coltura). Niente animazione continua (il pulse in GFV = allarme manodopera). Opzionale: un flash breve all’apparire, poi si ferma. Chip in mappa: «Bozza — verifica i confini». |
| **Conferma umana** | **Obbligatoria.** Mai salvare in silenzio. Un poligono sbagliato si propaga a lavori, zone, vendemmia, mappa allarmi. Stesso principio del form di revisione Tony Occhi. |
| **Fallback** | Il tracciamento attuale (tap punto-punto + trascinamento pallini) **resta**. Se la proposta è sbagliata: scarta e disegna a mano. |
| **Un tap, un terreno** | La proposta è un solo poligono. Se il modello unisce due appezzamenti, l’utente deve poter **scartare** (spezzare in v1 non è obbligatorio: si ridisegna). |
| **Sovrapposizione** | Avvisare se il poligono proposto interseca un terreno già in anagrafe (stesso tenant; terreni clienti vs aziendali da non mescolare). |
| **Telefono** | Il dito è impreciso. Dopo il tap: **zoom sul risultato**, non solo sul punto toccato. |
| **Anagrafica** | Il tap accelera **solo la geometria**. Nome, coltura, podere, possesso, affitto restano il form attuale. |
| **GPS** | Resta opzionale e dichiarato approssimativo (già in UI). Non è la fonte del perimetro automatico. |
| **Dove vive la feature** | **UX della mappa Terreni** (e, in seguito, stesso pattern su terreni clienti CT). **Non** un comando Tony nel primo rilascio. |
| **Tony** | Limitazione Master Plan invariata: *Tony non traccia poligoni*. Potrà dire «mappa questo campo» **solo dopo** che l’azione mappa esiste e l’utente conferma. |
| **Gemini** | **Non** è lo strumento del perimetro. Utile in casa per testo (Tony) e documenti (Occhi); debole nel restituire geometrie allineate a filari/siepi (può inventare coordinate). Gemini, **semmai dopo**, per aiuto semantico (sembra un vigneto, nome/coltura). |
| **Strumento geometrico** | **Segmentatore** con point prompt (famiglia SAM / equivalente), poi conversione maschera → `polygonCoords` (lat/lng). L’utente ritocca i vertici come oggi. |
| **Verità legale** | Il sistema **non** è catasto, PAC, contratto o rilievo del geometra. Segue ciò che **si vede** sul satellite, non la particella. |
| **Passo intermedio (senza IA)** | Ammesso e consigliato se il pilota ML è deludente: chiusura automatica, meno punti, eventuale aggancio al bordo mentre si disegna. Meno wow, già un risparmio. |

---

## 4. Situazione attuale nel codice

Non si parte da zero. Si **estende** il disegno mappa esistente.

| Pezzo | Dove | Comportamento oggi |
|-------|------|-------------------|
| Form terreno + mappa | `core/terreni-standalone.html` | Cerca indirizzo, **Traccia Confini**, Cancella, GPS centra / punto da GPS, superficie calcolata vs manuale |
| Logica mappa | `core/js/terreni-maps.js` | Click → vertice; poligono editabile/trascinabile; area; GPS come vertice |
| Modello | `core/models/Terreno.js` | `polygonCoords` opzionale (`{lat, lng}[]`); `superficie`; `coordinate` centro |
| Persistenza | `core/services/terreni-service.js` | Stesso documento terreno |
| Consumatori | lavori, zone, vendemmia, `dashboard-maps.js`, `geo-terreno-utils.js`, allarmi manodopera | Un poligono sbagliato **non** resta isolato in anagrafe |
| Terreni clienti | `modules/conto-terzi/views/terreni-clienti-standalone.html` | Stesso concetto di tracciamento; allineare **dopo** il go su terreni aziendali, non con un fork di logica |

Tour / guida utente parlano già di “almeno 3 punti” e di trascinare i pallini verdi in modifica. Quel ritocco **è** il passo di conferma della proposta.

---

## 5. Architettura prevista (quando si implementa)

Flusso unico:

1. Utente in form terreno, mappa satellite, modalità **Proponi confine**.
2. Tap/click in un punto interno al campo.
3. Si ritaglia la vista (o si usano bounds + punto in lat/lng).
4. Un **segmentatore** restituisce una maschera (o un poligono già in coordinate mappa).
5. Conversione in `polygonCoords` (≥ 3 vertici, poligono semplice).
6. Overlay sulla mappa **editabile**, in **stile bozza** (tratteggio bianco; vedi §3 Aspetto).
7. Calcolo ettari con **`updateAreaInfo`** già usata dal tracciamento classico (stesso overlay, stesso campo form).
8. Check sovrapposizione con altri terreni del tenant.
9. Utente ritocca / scarta / salva. Solo **Salva Terreno** persiste (`polygonCoords` + `superficie` in ha) e lo stile passa a **confermato** (tratto continuo colore coltura).

**Gemini non entra nel passo 4.** Eventuale passo semantico (coltura suggerita) è una fase successiva, con lo stesso vincolo: proposta + conferma, niente scrittura silenziosa.

Configurazione > codice: un helper mappa riusabile (terreni aziendali e, dopo, clienti), non rami `if (formId === 'terreno')` nel core Tony.

### 5.1 Come si vede la proposta (stati visivi)

Due stati, così l’utente non confonde bozza e terreno già in anagrafe.

| Stato | Perimetro | Riempimento | Vertici | Animazione |
|-------|-----------|-------------|---------|------------|
| **Bozza** (dopo il tap, prima di Salva) | **Tratteggiato**, bianco, più spesso del tratto classico (legibile sul satellite) | Colore coltura già scelta (o Default blu), **più trasparente** del confermato (~0,18–0,25 vs 0,35) per vedere filari/siepi sotto | Pallini trascinabili come oggi | **Niente pulse continuo.** Al massimo un flash di 1–2 s all’apparire, poi fermo |
| **Confermato** (dopo Salva, o terreno già salvato) | **Continuo**, colore coltura, spessore 3 — identico a Traccia Confini | Colore coltura, opacità attuale (~0,35) | Pallini in modifica, come oggi | Nessuna |

Chip/testo sotto la mappa in bozza: **«Bozza dei confini — trascina i punti o Salva»**.

**Perché non pulse / non verde / non rosso**

- Il **pulse** in GFV è già il semaforo allarmi manodopera (mappa aziendale). Un poligono che pulsa sembrerebbe un’urgenza, stanca sul telefono e copre il satellite.
- Il **verde pieno** è già delle zone lavorate.
- Il **rosso** è già il terreno di riferimento quando si tracciano zone/vendemmia.
- Il **tratteggio bianco** su satellite è il segnale “ancora da confermare”, indipendente dalla coltura (un tratteggio giallo sul seminativo sparirebbe).

---

## 6. Affidabilità attesa (realismo, non marketing)

Un sistema del genere è **affidabile come assistente, inaffidabile come geometra**.

In letteratura, sui benchmark di confini agricoli:

- modelli specializzati: spesso ~**0,75 IoU** sui pixel; a livello di *oggetto intero* (campo né spezzato né unito al vicino) anche sotto **0,50**;
- SAM zero-shot su piccoli appezzamenti: circa **6 campi su 10** identificati (soglia IoU 0,5);
- due campi attaccati e visivamente uguali: IoU che può scendere verso **0,35–0,50** (il modello vede una macchia sola).

Traduzione operativa GFV:

| Situazione | Attesa |
|------------|--------|
| Vigneto/frutteto/oliveto chiuso da strada, siepe, scolina visibile | Bozza usabile: campo giusto, 2–4 vertici da spostare. A volte quasi pronto. |
| Due Sangiovese attaccati, stesso impianto, niente bordo visibile | Spesso **unisce** i due. Qui non ci si può fidare senza conferma. |
| Seminativo grande e regolare | Bordo spesso ok; può inglobare capezzagne o tagliare dove il colore cambia. |
| Collina, terrazze, campi piccoli, ombre, satellite datato | Più errori, più ritocco. |

Un IoU “buono” (0,75) **non** garantisce ettari giusti. Su ~2 ha, pochi metri su un lato lungo bastano per sballare la superficie del **5–10%**. Va bene per mappa e lavori se qualcuno rivede; non va bene per dosi, costi/ha e confronti precisi senza ritocco.

Tre errori, in ordine di gravità:

1. **Campo sbagliato o fuso col vicino** — lavori e allarmi sul terreno errato.
2. **Bordo storto di qualche metro** — visibile, correggibile con i pallini già esistenti.
3. **Ettari un po’ diversi** — conseguenza del punto 2.

Il tap dal telefono aggiunge imprecisione: se si tocca vicino al bordo, il modello può prendere il campo accanto.

Il confronto onesto è con il **disegno attuale dal telefono**, non con un geometra. Anche l’umano sbaglia di metri; il GPS in app è già dichiarato approssimativo.

---

## 7. Criterio go / no-go (Fase 0, prima del codice prodotto)

Misura su **20–30 terreni già mappati** (poligono salvato = riferimento):

1. Tap al centro del campo sulla stessa vista satellite.
2. Confronta proposta vs `polygonCoords` esistente.

Tre conteggi:

| Metrica | Cosa misura |
|---------|-------------|
| **Campo giusto sì/no** | È l’appezzamento che l’utente intendeva? (non fuso, non il vicino) |
| **Ritocco** | Quanti vertici si sposterebbero? (soglia pratica: ≤ 3–4 = “minimo”) |
| **Scostamento ettari** | `|ha_proposta − ha_salvati| / ha_salvati` |

**Go (proseguire con UX in app), sui vigneti/frutteti ben bordati:**  
«campo giusto + ritocco minimo» **sopra circa due terzi**.

**No-go / ridimensionare:**  
la stessa metrica **verso uno su due** → non vendere come magia; tenere al massimo come scorciatoia opzionale, oppure investire prima nel disegno più veloce **senza** IA (chiusura smart, meno punti).

Non usare un unico “90% dei pixel” come KPI di prodotto.

---

## 8. Fasi di lavoro

Ordine vincolante. Non saltare la Fase 0.

### Fase 0 — Pilota di misura (obbligatoria)

- Nessuna UI utente nuova in produzione.
- Confrontare proposte del segmentatore con terreni già in anagrafe.
- Decisione go / no-go / “solo miglioramento disegno”.
- Esito da annotare in `TONY_DECISIONI_E_REQUISITI.md` §21 e in questo file (stato).

### Fase 1 — UX «Proponi confine» (solo se go)

- Pulsante accanto a **Traccia Confini** (label chiara: proposta, non creazione).
- Tap → overlay editabile in **stile bozza** (tratteggio bianco, fill più trasparente, chip «Bozza») → **ettari con `updateAreaInfo`**; si ricalcola se si trascinano i vertici. Dopo Salva → stile classico solido.
- Scarta proposta → torna al disegno attuale.
- Stesso salvataggio `polygonCoords` + `superficie` (ha).
- Mobile: zoom sul poligono proposto.
- Avviso sovrapposizione se rilevabile in modo semplice (stesso tenant, stessa “famiglia” di terreni).

### Fase 1b — Disegno più veloce senza IA (parallela o alternativa)

- Chiusura automatica, doppio tap, meno attrito sui vertici.
- Eventuale snap visivo.
- Da fare **comunque** se Fase 0 è no-go; utile anche se Fase 1 va in produzione.

### Fase 2 — Qualità (dopo v1 usabile)

- Feedback esplicito “proposta inaffidabile, disegna a mano”.
- Non unire in silenzio due campi; preferire fallire in modo visibile.
- Allineare **terreni clienti** (Conto terzi) allo stesso helper, senza fork.

### Fase 3 — Fuori v1 (solo con requisito esplicito)

- Catasto/particelle come **seconda** fonte di bozza, mai come verità operativa.
- Gemini per suggerimento coltura/nome **dopo** il poligono confermato.
- Comando Tony («mappa questo campo») che apre la mappa e avvia **Proponi confine**, senza tracciare lui il poligono e senza salvare.

---

## 9. Fuori scope (esplicito)

- Auto-catalogazione di tutti i campi visibili nella viewport.
- Salvataggio senza conferma.
- Sostituire nome/coltura/affitto con l’IA.
- Usare il poligono proposto per PAC, catasto, contratti, incentivi.
- Tracking GPS continuo del dipendente (già **scartato**, §11.5 decisioni: art. 4 St. Lav. + GDPR).
- Patch Tony `if (formId === 'terreno')` per disegnare sulla mappa.
- Nuovo campo Firestore al posto di `polygonCoords` (al massimo metadati opzionali *fonte proposta / ritoccata*, se servono in una fase successiva).
- Visione/upload multimodale in chat Tony per questa feature (regola Master Plan: niente visione in Tony senza flusso, persistenza e traccia; qui il flusso è la **mappa Terreni**, non Occhi).

---

## 10. Rischi e mitighi

| Rischio | Mitigo |
|---------|--------|
| Due vigneti attaccati fusi in un poligono | Conferma visiva; scarta; avviso overlap |
| Ettari sbagliati del 5–10% | Superficie calcolata visibile **prima** del Salva; ritocco vertici |
| Tap sul bordo prende il campo accanto | Istruzione “tocca al centro”; zoom sul risultato |
| Satellite vecchio / ombre / nubi | Fallback disegno manuale; non insistere con retry automatici |
| Costo/latenza inferenza | Fase 0 misura anche tempo; timeout → messaggio e fallback |
| Licenze tile Google vs invio immagine a un modello | Da verificare in Fase 1 (ToS Maps; preferire inferenza sui bounds già visibili all’utente, senza redistribuire tile) |
| Divergenza terreni aziendali vs clienti | Un helper mappa condiviso in Fase 2 |

---

## 11. File che si toccheranno (solo a implementazione, non ora)

Indicativi, da non anticipare prima del go Fase 0:

- `core/js/terreni-maps.js` — ingresso proposta + riuso Polygon editabile
- `core/terreni-standalone.html` — pulsante, hint, stati UI
- in seguito `modules/conto-terzi/views/terreni-clienti-standalone.html`
- eventuale modulo helper (maschera → `polygonCoords`, overlap)
- eventuale Cloud Function di inferenza (non Gemini per la geometria)
- test: overlap, conversione maschera, non regressione area/vertici
- guida utente Terreni **solo dopo** il rilascio (checklist GUIDA), non in questo commit di design

Tony (`tony-form-mapping.js`, `main.js`, CF `tonyAsk`): **non toccare** in Fase 1.

---

## 12. Allineamento documentazione di progetto

| Documento | Ruolo |
|-----------|--------|
| Questo file | Piano di implementazione e decisioni |
| `TONY_DECISIONI_E_REQUISITI.md` §21 | Inventario decisioni (stato **pianificato**) |
| `tony/MASTER_PLAN.md` §10 | Tony continua a **non** tracciare poligoni; puntatore a questo piano |
| `COSA_ABBIAMO_FATTO.md` | Changelog: piano scritto 2026-08-28 |

Dopo un eventuale go Fase 0: aggiornare stato in questo file e in §21 (`pianificato` → `in corso` / `implementato` / `abbandonato`).

---

## 13. Sintesi in una frase

**Tap sulla mappa = bozza di perimetro da confermare e ritoccare (ettari dallo stesso calcolo classico); segmentazione per la geometria, non Gemini; niente Tony e niente auto-save finché la proposta non batte “due terzi usabili” sui campi già mappati.**
