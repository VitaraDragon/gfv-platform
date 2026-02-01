# Piano: Potatura e Trattamenti da Lavori e Attività

**Obiettivo:** far sì che le pagine **Potatura** e **Trattamenti** (vigneto e frutteto) mostrino dati che **provengono** da lavori e attività già create (Gestione lavori e Diario), e consentano di **completare manualmente** i dati aggiuntivi specifici (come già avviene per Vendemmia e Raccolta). I dati “base” del lavoro/attività restano in sola lettura.

---

## 1. Scelte concordate

### 1.1 Origine del dato base
- **Entrambe le fonti:** i record in Potatura e Trattamenti provengono sia da **Gestione lavori** (lavori) sia dal **Diario** (attività).
- Stesse regole e stessi campi aggiuntivi per entrambe le fonti.

### 1.2 Riconoscimento Potatura vs Trattamento
- Si usano le **liste dei lavori** già presenti nell’app.
- Il filtro è sulla **categoria** (es. “Potatura”, “Trattamenti”), senza distinguere nel dettaglio (es. manuale/meccanica, sottocategorie).
- Un lavoro o un’attività con categoria **Potatura** compare nella pagina Potatura; con categoria **Trattamenti** nella pagina Trattamenti.

### 1.3 Collegamento vigneto / frutteto
- Il legame avviene **tramite il terreno**.
- Un terreno ha **un solo** vigneto o frutteto (relazione 1:1).
- Da lavoro/attività si ha il terreno → da terreno si deriva se si parla di vigneto o frutteto e quale.

### 1.4 Allineamento a Vendemmia e Raccolta
- Stesso **procedimento** usato per Vendemmia e Raccolta: il dato “base” nasce dal lavoro/attività; la pagina dedicata mostra l’elenco e permette di compilare (e consultare) i **dati aggiuntivi** specifici.

### 1.5 Dove si crea l’evento
- **Solo** il flusso: l’utente crea prima il **lavoro** (Gestione lavori) o l’**attività** (Diario).
- Non si prevede la creazione di una Potatura o di un Trattamento “da zero” dalla pagina dedicata (che creerebbe anche il lavoro/attività). La pagina Potatura/Trattamenti è per **consultazione e completamento**.

### 1.6 Dati base in Potatura/Trattamenti
- I dati provenienti da lavoro/attività (data, terreno, operai, ore, ecc.) sono in **sola lettura** nella pagina Potatura/Trattamenti.
- Per modificarli l’utente deve andare in Diario o in Gestione lavori.

---

## 2. Flusso utente

1. L’utente crea un **lavoro** (Gestione lavori) o un’**attività** (Diario) di tipo/categoria **Potatura** o **Trattamenti**, associato a un terreno (e quindi a un vigneto o a un frutteto).
2. Nella pagina **Potatura** (vigneto o frutteto) o **Trattamenti** (vigneto o frutteto) compare l’elenco dei lavori/attività con quella categoria, filtrato per il contesto (vigneto/frutteto, eventualmente anno).
3. L’utente seleziona un elemento dalla lista e può **compilare o modificare solo i dati aggiuntivi** (es. tipo potatura, ceppi/piante potati, costi; prodotto, dosaggio, giorni di carenza, costi).
4. I dati base (data, terreno, operai, ore da lavoro, ecc.) sono **visualizzati in sola lettura**; per cambiarli si agisce sul lavoro/attività in Diario o Gestione lavori.

---

## 3. Implicazioni da definire in fase di analisi

- **Dove risiedono i dati aggiuntivi:** in un campo/oggetto sul documento lavoro/attività, in una sottocollezione (es. `potature`/`trattamenti` per vigneto/frutteto) con riferimento al lavoro/attività, o altro. Da allineare al modello usato per Vendemmia e Raccolta (collegamento lavoro ↔ vendemmia/raccolta e dove sono salvati i campi specifici).
- **Identificazione univoca:** come si associa in modo stabile un record “Potatura” o “Trattamento” nella pagina dedicata al lavoro o all’attività di origine (id lavoro, id attività, eventuale id documento “dettaglio”).
- **Categoria nei dati:** nome esatto del campo “categoria” (o equivalente) nelle strutture lavoro e attività, e valori usati per “Potatura” e “Trattamenti”, da verificare sul codice/schema esistente.
- **Terreno ↔ vigneto/frutteto:** conferma nel modello dati che un terreno ha esattamente un vigneto o un frutteto e dove sia memorizzato questo legame (anagrafica terreni, vigneti, frutteti).

---

## 4. Cosa non è in scope (in base alle scelte)

- Creazione di una nuova Potatura o Trattamento dalla sola pagina dedicata (senza aver prima creato lavoro/attività).
- Modifica dalla pagina Potatura/Trattamenti dei dati base (data, terreno, operai, ecc.); solo lettura e modifica dei **dati aggiuntivi** specifici.

---

## 5. Riepilogo

Le pagine **Potatura** e **Trattamenti** diventano **viste specializzate** su lavori e attività già create (categoria Potatura o Trattamenti), con dati base in **sola lettura** e **dati aggiuntivi** compilabili e modificabili dall’utente, sullo stesso modello di Vendemmia e Raccolta. Origine: sia Gestione lavori sia Diario. Collegamento al vigneto/frutteto tramite terreno (1:1).
