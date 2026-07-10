# Piano: Guida dell'app per l'assistente (Gemini)

Documento di specifica che definisce **intento**, **struttura** e **fasi di sviluppo** della guida dettagliata dell'app GFV Platform. La guida servirà come base di conoscenza per il modulo assistente (Gemini) e come riferimento per sviluppo e onboarding.

---

## 1. Intent e obiettivi

### 1.1 A cosa serve la guida

- **Base di conoscenza per l'assistente**  
  L'assistente (Gemini) riceverà questa documentazione come contesto. Deve poter rispondere su funzionalità, dove trovare le cose, come fare operazioni comuni, senza inventare schermate o flussi inesistenti.

- **Riferimento unico e strutturato**  
  Una sola “mappa” dell'app: sezioni, funzionalità, termini, limiti. Utile per chi sviluppa il modulo assistente, per chi aggiunge nuovi moduli e per onboarding.

- **Scalabilità**  
  La struttura deve permettere di aggiungere **nuovi moduli** in futuro senza riscrivere tutto: ogni modulo ha il suo blocco di documentazione che si integra nel resto.

- **Completezza a livello guida utente**  
  La guida deve esplorare **tutte le funzionalità** dell'app e chiarire “tutte le funzioni di tutte le funzioni” come una guida utente: cosa fa ogni area, come si usa, chi può farlo, dove si trova. In più deve descrivere **come i moduli si intersecano** (es. Magazzino con Trattamenti e Lavori, manodopera/ruoli con caposquadra e operai, Mappe con Terreni e Macchine, Conto terzi con Lavori e Clienti). Così l'assistente può rispondere sia su una singola sezione sia su flussi che coinvolgono più moduli.

- **Obiettivo finale**  
  Con la guida, **utente e assistente devono diventare esperti e sfruttare completamente l'app**: nessuna funzione, opzione o flusso deve essere tralasciato. La guida deve essere in grado di **condurre l'utente** (o l'assistente che risponde all'utente) in tutte le funzioni richieste: opzioni, impostazioni, multi-tenant, ruoli, confini terreni, zone lavorate, alert e loro significato, compilazione form e validazioni, campi e tabelle calcolate, ecc. In pratica: chi usa la guida (o chi riceve risposte dall'assistente basate sulla guida) deve poter padroneggiare l'app al 100%.

### 1.2 Ambito di copertura (cosa deve essere in guida per non tralasciare nulla)

Per raggiungere l'obiettivo “esperto e sfruttare completamente l'app”, la guida deve coprire **tutti** i seguenti ambiti (da adattare all'app reale; usare questa lista come checklist di copertura):

| Ambito | Cosa descrivere nella guida |
|--------|-----------------------------|
| **Accesso e multi-tenant** | Login, cambio tenant/azienda, isolamento dati, cosa vede l'utente in base all'azienda selezionata. |
| **Ruoli e permessi** | Admin, Manager, Caposquadra, Operaio: cosa può fare ognuno in ogni sezione (menu, pulsanti, dati visibili). |
| **Opzioni e impostazioni** | Dove si trovano le impostazioni (generali, azienda, abbonamento, poderi, ecc.), cosa si può configurare e quali effetti ha. |
| **Dashboard e navigazione** | Menu principale, sezioni, come passare da un'area all'altra, widget e blocchi in dashboard. |
| **Terreni** | Creazione, modifica, eliminazione; **tracciamento confini** (come si traccia il perimetro sulla mappa, vertici, superficie calcolata, validazioni); visualizzazione su mappa aziendale. |
| **Zone lavorate** | Come si tracciano le zone/segmenti lavorati (caposquadra: clic sulla mappa, snap al confine, chiusura poligono, larghezza, superficie); dove si salvano; come si vedono sulla mappa; relazione con lavori e terreno. |
| **Lavori e attività** | Creazione lavori, assegnazione, stati, segnatura ore, attività collegate; flussi completamento e approvazione. |
| **Moduli (Vigneto, Frutteto, Magazzino, Conto terzi, …)** | Per ogni modulo: funzionalità, dove si trova, termini, limitazioni, **relazioni con altri moduli** (§3.4). |
| **Alert e notifiche** | **Cosa sono** gli alert mostrati nell'app (es. affitti in scadenza, scadenza documenti, guasti), **perché ci sono** (regole di business: es. “rosso = scade entro 30 giorni”), come leggerli e cosa fare. |
| **Form e validazioni** | Come compilare i form principali (campi obbligatori, formati, date); **perché** compaiono certi messaggi di errore o avviso; quali campi sono calcolati in automatico e quali vanno inseriti a mano. |
| **Campi e tabelle calcolate** | **Come sono calcolati** i campi derivati (es. superficie da poligono, ore nette, materiali da pianificazione, percentuale completamento lavoro); **come sono costruite** le tabelle riepilogative (colonne, filtri, totali). |
| **Mappe** | Uso delle mappe (terreni, zone lavorate, parco macchine, mappa aziendale); livelli, legende, interazioni (clic, trascinamento). |
| **Intersezioni tra moduli** | Flussi che coinvolgono più aree (§3.4); ruoli nelle intersezioni. |

Ogni nuovo ambito o funzionalità introdotta nell'app deve essere aggiunto a questa lista e alla guida; la checklist di copertura (§4) deve riflettere questi ambiti così da non tralasciare nulla.

### 1.3 Cosa non è

- **Non è la documentazione utente**  
  La documentazione per gli utenti finali resta in `documentazione-utente/` (guide per ruoli, FAQ, primi passi). La guida per l'assistente può essere più tecnica e completa, orientata a “cosa fa l'app e dove”.

- **Non è documentazione di codice**  
  Non descrive API, classi o file; descrive **funzionalità, schermate, flussi e termini** come li vede chi usa l'app (e come li deve “vedere” l’assistente).

---

## 2. Destinatari e usi

| Destinatario / uso | Come usa la guida |
|--------------------|-------------------|
| **Modulo assistente (Gemini)** | Contesto (system prompt / RAG) per rispondere alle domande degli utenti sull'app. |
| **Sviluppatori del modulo assistente** | Per definire scope, esempi di domande, e quali parti del contesto caricare (core + moduli rilevanti). |
| **Sviluppatori di nuovi moduli** | Per sapere come descrivere il nuovo modulo (schema fisso) e dove inserirlo (indice, cartella). |
| **Utente finale** | Può usare la guida (o le risposte dell'assistente basate sulla guida) per padroneggiare tutte le funzioni, opzioni e flussi dell'app. |
| **Onboarding / manutenzione** | Riferimento rapido su “cosa c’è” e “dove si trova” nell'app. |

---

## 3. Struttura della guida

La guida è **modulare**: una parte **core** (una volta) + un **blocco per ogni modulo** (esistente o futuro).

### 3.1 Parte core

Contenuto da definire in un unico documento (o in una cartella `guida-app/core/`):

- **Panoramica dell'app**  
  Cosa fa GFV Platform, multi-tenant, moduli a pagamento, ruoli.
- **Accesso e ruoli**  
  Login, tipi di utente (admin, manager, caposquadra, operaio), cosa può fare ognuno in linea di massima.
- **Navigazione e layout**  
  Menu principale, sezioni sempre presenti, dashboard, come si passa da una sezione all'altra.
- **Glossario condiviso**  
  Termini usati in tutta l'app (es. tenant, terreno, lavoro, attività, modulo, abbonamento) con definizione breve.
- **Regole comuni**  
  Es. “Solo l’admin può…”, “Il modulo X è incluso / a pagamento”, “I dati sono isolati per tenant”.

### 3.2 Un blocco per ogni modulo

Per ogni modulo (Vigneto, Frutteto, Magazzino, Conto terzi, e futuri) si usa **lo stesso schema**:

- **Nome e scopo**  
  Nome del modulo (come in menu/app) e in una riga a cosa serve.
- **Dove si trova**  
  Voce di menu, sottomenu, eventuale percorso (es. “Dashboard → Vigneto → Trattamenti”).
- **Funzionalità principali**  
  Elenco delle cose che l’utente può fare (es. registrare trattamenti, calcolare materiali, vedere statistiche).
- **Termini specifici**  
  Parole tipiche di quel modulo (es. per Vigneto: trattamento, potatura, vendemmia, ettari, ecc.) con definizione breve.
- **Limitazioni e dipendenze**  
  Es. “Disponibile solo con abbonamento al modulo Vigneto”, “Solo admin e manager possono…”.
- **Relazioni con altri moduli**  
  Con quali altre aree si interseca questo modulo (es. Trattamenti usa prodotti da Magazzino; Lavori coinvolge squadre/caposquadra/operai; Calcolo materiali usa terreni e prodotti). Breve elenco + riferimento al documento “Intersezioni” (§3.4) per i dettagli dei flussi.

Per i **nuovi moduli** futuri: si crea un nuovo file/cartella seguendo questo schema, si aggiunge la voce nell’indice e si aggiorna il documento Intersezioni (§3.4) se il modulo si collega ad altri.

### 3.3 Indice / mappa dei moduli

Un documento (o sezione) che elenca:

- **Moduli attualmente presenti**  
  Nome, una riga di descrizione, riferimento al file/cartella della guida di quel modulo.
- **Aggiornamento**  
  Ogni volta che si aggiunge un modulo, si aggiunge una riga qui. L’assistente (e chi configura il contesto) sa così quali aree esistono e non inventa moduli.

### 3.4 Intersezioni tra moduli

Un documento dedicato (es. `guida-app/intersezioni-moduli.md`) che descrive **come i moduli si intersecano** e quali flussi coinvolgono più aree. Senza questa parte, la guida descriverebbe ogni modulo da solo e l’assistente non saprebbe rispondere a domande tipo “Da dove registro l’uso di un prodotto in un trattamento?” o “Come si collegano i lavori ai capisquadra e agli operai?”.

**Contenuto suggerito:**

- **Matrice o elenco “modulo A ↔ modulo B”**  
  Per ogni coppia rilevante: in una riga cosa si collega (es. “Magazzino ↔ Trattamenti: i trattamenti vigneto/frutteto possono consumare prodotti dal magazzino”; “Lavori ↔ Manodopera/Ruoli: i lavori sono assegnati a squadre, capisquadra, operai”; “Mappe ↔ Terreni / Parco macchine: visualizzazione terreni e mezzi”; “Conto terzi ↔ Lavori / Clienti: lavori per conto di clienti esterni, fatturazione”).

- **Flussi operativi che attraversano più moduli**  
  Breve descrizione dei flussi tipici (es. “Registrare un trattamento e scaricare i prodotti dal magazzino”; “Creare un lavoro, assegnare caposquadra e operai, segnare ore”; “Preventivo conto terzi → lavoro → fattura”). Per ogni flusso: quali sezioni dell’app tocca, in che ordine (se ha senso), chi può farlo.

- **Ruoli e moduli**  
  Come ruoli (admin, manager, caposquadra, operaio) si riflettono sulle varie aree e sulle intersezioni (es. “Solo il caposquadra può assegnare operai al lavoro”; “L’operaio vede solo i lavori a cui è assegnato”).

**Esempi di intersezioni da coprire (da adattare all’app reale):**

| Da / verso | Collegamento |
|-----------|--------------|
| Magazzino ↔ Trattamenti (Vigneto/Frutteto) | Prodotti usati nei trattamenti, scarico magazzino. |
| Magazzino ↔ Lavori | Materiali/attrezzature usati nei lavori. |
| Lavori ↔ Manodopera (caposquadra, operai) | Assegnazione squadre, ore, presenza. |
| Mappe ↔ Terreni | Visualizzazione terreni su mappa. |
| Mappe ↔ Parco macchine | Posizione/uso mezzi. |
| Conto terzi ↔ Lavori / Clienti | Lavori per terzi, preventivi, fatture. |
| Dashboard / Ruoli ↔ Tutte le aree | Cosa vede e può fare ogni ruolo in ogni modulo. |

L’indice della guida deve includere il riferimento a questo documento; quando si aggiunge un nuovo modulo che si interseca con altri, si aggiorna anche “Intersezioni tra moduli”.

---

## 4. Come sviluppare la guida (modalità operativa)

**Non un unico file enorme.** La guida non va scritta come un solo documento gigante. Conviene svilupparla come **insieme di file**: un file per la parte core, un file per ogni modulo (vedi §3 e §8). Vantaggi:

- Più facile da mantenere e da aggiornare (cambi solo il file che serve).
- Per Gemini/RAG puoi indicizzare o caricare solo i file rilevanti (core + modulo richiesto).
- Meno rischio di tralasciare qualcosa: lavori su un’area alla volta e hai una checklist (vedi sotto).

**Poco alla volta, in ordine.** Sviluppare la guida **incrementale**:

1. **Prima** indice + struttura cartelle + parte core (anche sintetica). Così hai subito la “mappa” e il contesto condiviso.
2. **Poi** un modulo alla volta: scegli un modulo (es. Vigneto), compili il suo file con lo schema fisso (§5), aggiorni l’indice, passi al successivo. Non serve finire tutto in un colpo solo.
3. **Infine** manutenzione: quando aggiungi funzionalità o un nuovo modulo, aggiorni solo il file (e l’indice) coinvolto.

In questo modo non rischi di scrivere “tutto insieme” e di tralasciare parti per stanchezza o confusione; ogni sessione ha un obiettivo chiaro (un file, un modulo).

**Checklist di copertura (per non tralasciare nulla).** Per non dimenticare aree, moduli o ambiti:

- **Elenco da cui spuntare:** nell’indice (o in un file separato “checklist-copertura”) tieni la lista di tutto ciò che va documentato: “Core”, “Terreni”, “Lavori”, “Vigneto”, “Frutteto”, “Magazzino”, “Conto terzi”, eventuali altre sezioni dell’app (es. “Dashboard”, “Abbonamenti”). Accanto a ogni voce: stato “da fare” / “in corso” / “fatto”.
- **Fonte della lista:** la lista va ricavata dall’app reale (menu, sezioni principali, moduli attivi). Quando aggiungi un nuovo modulo all’app, aggiungi una riga alla checklist e al relativo file della guida.
- **Uso:** prima di considerare “guida completa” compili tutte le voci; per ogni modulo spunti quando il file è scritto e aggiornato nell’indice.

La checklist deve includere sia sezioni/moduli sia gli ambiti di copertura (§1.2); così la guida sarà in grado di guidare l'utente (e l'assistente) in tutte le funzioni richieste senza tralasciare nulla.

In sintesi: **più file (core + un file per modulo), sviluppo poco alla volta (prima core, poi un modulo alla volta), checklist di copertura (elenco di aree/moduli e ambiti §1.2 da spuntare)**. Così la guida non diventa un file enorme e si riduce il rischio di tralasciare qualcosa.

---

## 5. Schema fisso per ogni sezione/modulo

Per uniformità e per facilitare l’integrazione di nuovi moduli, ogni blocco (core e moduli) rispetta uno **schema tipo**:

1. **Titolo** (nome sezione o modulo)
2. **Scopo** (cosa fa, in breve)
3. **Dove si trova** (navigazione)
4. **Funzionalità / azioni principali** (elenco)
5. **Termini e concetti** (glossario locale)
6. **Limitazioni / regole** (permessi, abbonamenti, eccezioni)
7. **Relazioni con altri moduli** (con chi si interseca, in breve; dettagli in “Intersezioni tra moduli”)

Si può usare lo stesso schema sia per la parte “core” sia per ogni file di modulo; per il core, “Dove si trova” può essere “Applicato a tutta l’app”, “Funzionalità” può essere “Login, dashboard, gestione tenant, …”, e “Relazioni con altri moduli” può essere “Ruoli e permessi su tutte le aree; vedi Intersezioni per flussi tra moduli”.

---

## 6. Fasi di sviluppo

### Fase 1 – Fondamenta (subito)

- **Indice della guida**  
  Creare il documento “Indice / mappa” con l’elenco dei moduli attuali (anche solo nome + “da compilare”).
- **Struttura cartelle**  
  Definire dove vivono i file (es. `docs-sviluppo/guida-app/` con `core.md` e `moduli/` con un file per modulo).
- **Parte core**  
  Scrivere la parte core (panoramica, accesso/ruoli, navigazione, glossario condiviso, regole comuni). Si può partire da “abbastanza per capire l’app” e approfondire dopo.

**Risultato:** l’assistente ha già una mappa e il contesto base; i moduli possono essere ancora “scheletro”.

### Fase 2 – Moduli esistenti

- **Un blocco per ogni modulo già presente**  
  Per Vigneto, Frutteto, Magazzino, Conto terzi (e altri già in app), compilare il blocco secondo lo schema (scopo, dove si trova, funzionalità, termini, limitazioni, relazioni con altri moduli).
- **Documento “Intersezioni tra moduli”**  
  Compilare `intersezioni-moduli.md` (o equivalente): matrice/elenco modulo A ↔ modulo B, flussi operativi che attraversano più moduli, ruoli nelle varie aree (§3.4).
- **Aggiornare l’indice**  
  Collegare ogni modulo al suo file, includere il riferimento a “Intersezioni tra moduli”, aggiungere una riga di descrizione per ogni modulo.

**Risultato:** la guida copre tutte le funzionalità e le intersezioni tra moduli; l’assistente può rispondere sia su una singola area sia su flussi che coinvolgono più moduli (magazzino–trattamenti, lavori–manodopera, mappe–terreni/macchine, conto terzi–lavori, ecc.).

### Fase 3 – Manutenzione e nuovi moduli

- **Nuovo modulo**  
  Quando si sviluppa un nuovo modulo: (1) creare il file/cartella nella stessa struttura, (2) compilare con lo stesso schema, (3) aggiornare l’indice.
- **Modifiche all’app**  
  Quando si aggiunge una funzionalità o una schermata: aggiornare il blocco corrispondente (core o modulo). Se la modifica coinvolge il rapporto tra moduli, aggiornare anche “Intersezioni tra moduli”. Se si usa RAG, aggiornare i chunk/documenti indicizzati.

**Risultato:** la guida resta allineata all’app e scala con i nuovi moduli senza rifacimenti globali.

---

## 7. Convenzioni

- **Nomi uguali all’app**  
  Usare gli stessi nomi di menu, schermate e pulsanti che vede l’utente (es. “Calcolo materiali”, “Trattamenti vigneto”). Evitare sinonimi che confondono l’assistente.
- **Linguaggio chiaro e breve**  
  Frasi corte; elenchi dove possibile; evitare gergo non definito nel glossario.
- **Un file per modulo**  
  Salvo moduli molto grandi, un modulo = un file (o una cartella con un README + eventuali sotto-sezioni). Nome file coerente (es. `vigneto.md`, `frutteto.md`, `magazzino.md`).
- **Versione e stato**  
  In cima alla guida (o all’indice) si può indicare data/versione dell’ultimo aggiornamento e “Moduli coperti: …” per controllo rapido.

---

## 8. Dove si colloca nel progetto

| Elemento | Posizione suggerita |
|----------|----------------------|
| **Questo piano** | `docs-sviluppo/PIANO_GUIDA_APP_ASSISTENTE.md` (documento che stai leggendo). |
| **Guida vera e propria** | Es. `docs-sviluppo/guida-app/` con `README.md` (indice), `core.md`, `intersezioni-moduli.md`, e `moduli/` (un file per modulo). **Checklist sezioni e ordine:** `docs-sviluppo/CHECKLIST_SEZIONI_GUIDA_APP.md`. |
| **Documentazione utente** | Resta in `documentazione-utente/` (distinta dalla guida per l’assistente). |

La guida per l’assistente è **documentazione di sviluppo / riferimento**, quindi vive in `docs-sviluppo/` (o in una sottocartella dedicata), non nella documentazione utente.

---

## 9. Riepilogo

- **Intent:** fornire una base di conoscenza strutturata e modulare per l’assistente Gemini e per chi sviluppa/manutiene l’app; **completezza a livello guida utente** (tutte le funzionalità, incluse le intersezioni tra moduli). **Obiettivo finale:** con la guida, utente e assistente devono diventare esperti e sfruttare completamente l'app; nessuna funzione, opzione o flusso tralasciato (§1.1 e §1.2).
- **Struttura:** core + un blocco per modulo (stesso schema, incluso “Relazioni con altri moduli”) + **documento “Intersezioni tra moduli”** (flussi che coinvolgono più aree) + indice aggiornato; **ambito di copertura** (§1.2) come checklist per non tralasciare nulla.
- **Modalità di sviluppo:** più file (non un unico file enorme), poco alla volta (prima core, poi un modulo alla volta, poi intersezioni), checklist di copertura per non tralasciare nulla (§4).
- **Fasi:** (1) Indice + core, (2) Moduli esistenti + Intersezioni tra moduli, (3) Manutenzione e nuovi moduli (schema + aggiornamento indice e Intersezioni).
- **Convenzioni:** nomi come in app, schema fisso, un file per modulo, aggiornare l’indice e le Intersezioni a ogni nuovo modulo.

Quando si inizia a scrivere la guida, usare questo piano come riferimento per intento, modalità operativa (§4) e fasi; quando si aggiunge un modulo futuro, seguire lo schema e aggiornare l’indice e il documento Intersezioni (§3.4).
