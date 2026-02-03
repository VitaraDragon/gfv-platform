# Core – Panoramica, accesso, multi-tenant, ruoli

Prima parte del Core della guida: cosa fa l'app, come si accede, come funziona il multi-tenant e quali ruoli esistono.

---

## 1. Titolo

**Core** – Panoramica dell'app, accesso, multi-tenant, ruoli.

---

## 2. Scopo (panoramica app)

**GFV Platform** è un'app multi-tenant per la gestione aziendale agricola: terreni, attività, lavori, moduli specializzati (Vigneto, Frutteto, Magazzino, Manodopera, Parco Macchine, Conto Terzi). Ogni **tenant** (azienda/organizzazione) ha i propri dati isolati. L'accesso avviene con **login** (email e password); i **ruoli** (amministratore, manager, caposquadra, operaio) definiscono cosa può fare ogni utente. Parte delle funzionalità è inclusa nel **piano base** (Free o Base); i **moduli** avanzati sono a pagamento (piano Base con moduli pay-per-use).

---

## 3. Dove si trova

**Applicato a tutta l'app.** Accesso, tenant e ruoli valgono per ogni sezione: dopo il login l'utente vede solo i dati del tenant selezionato e solo le funzioni consentite dal proprio ruolo e dai moduli attivi per quel tenant.

---

## 4. Funzionalità

- **Login**  
  Accesso con email e password (Firebase Authentication). Dopo il login l'app carica i dati utente e il tenant (o i tenant) a cui l'utente appartiene.

- **Gestione tenant (multi-tenant)**  
  Un utente può appartenere a **un solo tenant** (un’azienda) o a **più tenant**. Se ha un solo tenant, viene selezionato automaticamente. Se ne ha più di uno, l’app usa il tenant memorizzato in sessione (o un tenant predefinito); l’utente può **cambiare azienda** (tenant) dalle impostazioni o dalla schermata di selezione, se presente. I dati (terreni, lavori, attività, moduli) sono sempre **isolati per tenant**: si vedono solo quelli del tenant corrente.

- **Ruoli**  
  Per ogni tenant l’utente ha uno o più **ruoli**: **amministratore**, **manager**, **caposquadra**, **operaio**.  
  - **Amministratore**: gestisce utenti, ruoli, abbonamento, impostazioni azienda; può fare tutto ciò che può il manager.  
  - **Manager**: gestisce terreni, attività, lavori, squadre, moduli operativi (es. crea/assegna lavori, vede report); non gestisce abbonamento o assegnazione ruoli.  
  - **Caposquadra**: vede i lavori assegnati alla propria squadra, segna/valida ore, può inviare comunicazioni agli operai.  
  - **Operaio**: vede i lavori assegnati (a sé o alla propria squadra), segna ore, riceve comunicazioni dal caposquadra.  
  I ruoli sono assegnati **solo dall’amministratore** (gestione utenti / ruoli).

---

## 5. Termini e concetti

| Termine | Definizione breve |
|--------|--------------------|
| **Tenant** | Azienda/organizzazione: insieme di dati (terreni, lavori, utenti, moduli) isolato. Ogni utente appartiene a uno o più tenant. |
| **Ruolo** | Funzione dell’utente in un tenant: amministratore, manager, caposquadra, operaio. Definisce cosa può fare e vedere. |
| **Amministratore** | Ruolo con massimi permessi: gestione utenti, ruoli, abbonamento, impostazioni; può fare tutto il manager. |
| **Manager** | Ruolo operativo e gestionale: terreni, attività, lavori, squadre, moduli; non gestisce abbonamento né ruoli. |
| **Caposquadra** | Ruolo per chi coordina una squadra: lavori assegnati, ore, validazione ore, comunicazioni agli operai. |
| **Operaio** | Ruolo per chi esegue i lavori: vede lavori assegnati, segna ore, riceve comunicazioni. |
| **Piano / abbonamento** | Piano sottoscritto dal tenant: **Free** (limiti su terreni e attività, nessun modulo) o **Base** (€5/mese, moduli a pagamento aggiuntivi). |
| **Modulo** | Funzionalità aggiuntiva a pagamento (es. Vigneto, Frutteto, Magazzino, Manodopera, Parco Macchine, Conto Terzi). Disponibili solo con piano Base. |

---

## 6. Limitazioni e regole

- **Solo l’amministratore** può: invitare/gestire utenti, assegnare o rimuovere ruoli, gestire l’abbonamento e le impostazioni azienda (poderi, ecc.).
- **Manager e amministratore** possono: creare/modificare/eliminare lavori, gestire terreni e attività, accedere a tutte le sezioni consentite dai moduli attivi. Il **caposquadra** può modificare solo alcuni campi dei lavori a lui assegnati (es. ore, stato); **l’operaio** vede solo i propri lavori e le comunicazioni.
- **Dati isolati per tenant**: terreni, lavori, attività, utenti (per membership), moduli e abbonamento sono per tenant; non si vedono dati di altri tenant.
- **Piano Free**: massimo 5 terreni, massimo 30 attività al mese; **nessun modulo** attivabile. Per usare moduli (Vigneto, Frutteto, Magazzino, Manodopera, ecc.) serve il **piano Base** (€5/mese) e l’attivazione dei moduli desiderati (pay-per-use).
- **Multi-tenant membership**: un utente può essere membro di più aziende (tenant); i ruoli sono **per tenant** (in `tenantMemberships`). In ogni sessione si lavora su **un solo tenant** (quello “corrente”); il cambio azienda cambia tutto ciò che si vede e si può fare.

---

## 7. Relazioni con altri moduli

Ruoli e permessi si applicano a **tutte le aree** dell’app (core e moduli). Quale sezione sia visibile e cosa si possa fare dipende da: ruolo dell’utente nel tenant corrente, moduli attivi per il tenant, eventuali limiti del piano. I dettagli su “chi fa cosa” nelle singole aree e nei flussi che coinvolgono più moduli sono nel documento **Intersezioni tra moduli** (`intersezioni-moduli.md`).

---

# Core – Navigazione, dashboard, opzioni

Seconda parte del Core: come ci si sposta nell'app, com'è fatta la dashboard e dove si trovano le opzioni e le impostazioni.

---

## 1. Titolo

**Core** – Navigazione, dashboard, opzioni e impostazioni.

---

## 2. Scopo

Descrivere **come si naviga** nell'app (menu, link, ritorno alla dashboard), **com'è strutturata la dashboard** (blocchi per ruolo, widget, statistiche, azioni rapide) e **dove si configurano** le opzioni (impostazioni azienda, poderi, cambio azienda, abbonamento).

---

## 3. Dove si trova

**Applicato a tutta l'app.** La **dashboard** è la pagina principale dopo il login (`dashboard-standalone.html`). Da lì si raggiungono tutte le sezioni tramite **link e card**. Le **impostazioni** sono in una pagina dedicata raggiungibile dall'header della dashboard (**Impostazioni**) o dal link "Abbonamento" nella dashboard.

---

## 4. Funzionalità

### Navigazione

- **Punto di partenza:** dopo il login si arriva alla **Dashboard** (pagina principale con titolo "GFV Platform").
- **Header della dashboard:** in alto a destra ci sono i pulsanti/link: **Impostazioni** (⚙️), **Guide** (📘, apre la documentazione utente), **Tour** (🧭, tour guidato della dashboard), **Invita Collaboratore** (visibile solo ad amministratori), **Cambia Azienda** (visibile solo se l'utente appartiene a più tenant), **Logout**.
- **Passaggio da un'area all'altra:** non c'è un menu laterale fisso; la dashboard mostra **blocchi (sezioni)** con **card cliccabili** che portano alle varie pagine (Terreni, Diario Attività, Statistiche, Gestione Lavori, Validazione ore, Amministrazione, Abbonamento, ecc.). Ogni pagina interna ha in genere un link **"← Dashboard"** per tornare alla dashboard.
- **Percorsi tipici:**  
  - **Dashboard → Terreni** → `terreni-standalone.html`  
  - **Dashboard → Diario Attività** → `attivita-standalone.html`  
  - **Dashboard → Statistiche** → `statistiche-standalone.html` o (con modulo Manodopera) `admin/statistiche-manodopera-standalone.html`  
  - **Dashboard → Amministrazione** → `admin/amministrazione-standalone.html` (da lì: Gestisci Utenti, Gestione Squadre, Gestione Operai, Compensi, Gestione Macchine, Abbonamento)  
  - **Dashboard → Impostazioni** → `admin/impostazioni-standalone.html`  
  - **Dashboard → Abbonamento** → `admin/abbonamento-standalone.html`  
  I moduli (Vigneto, Frutteto, Magazzino, Conto Terzi) sono raggiungibili da card dedicate in dashboard o da link contestuali (es. da un terreno si può aprire Vigneto/Frutteto per quel terreno).

### Dashboard

- **Contenuto dinamico per ruolo:** la dashboard mostra **sezioni diverse** in base al ruolo (amministratore, manager, caposquadra, operaio) e ai **moduli attivi** per il tenant.
- **Sezioni tipiche:**  
  - **Core Base:** card per Terreni, Diario Attività, Statistiche, (se attivo) Gestione Macchine, Abbonamento.  
  - **Amministrazione** (solo admin): statistiche (utenti totali, moduli attivi, piano), card per Gestisci Utenti, Gestione Squadre, Gestione Operai, Compensi Operai, (se attivo) Gestione Macchine, (se applicabile) Report Completi.  
  - **Gestione Operativa** (manager): statistiche (terreni, attività/ore), card per Terreni, Diario Attività, Statistiche; se il modulo Manodopera è attivo: Lavori, Validazione ore, Statistiche Manodopera, Gestione Macchine, e blocchi "Lavori recenti", "Ore da validare".  
  - **Caposquadra:** statistiche sui propri lavori, card per "I miei lavori", Validazione ore, Gestione squadre, Comunicazioni; eventuale blocco comunicazioni rapide e lista comunicazioni inviate.  
  - **Operaio:** comunicazioni ricevute, statistiche (lavori di oggi, ore segnate, stato), card per "I miei lavori", Segnalazione guasti, lista "Lavori di oggi", "Le mie ore".  
- **Widget e blocchi:** ogni sezione può avere **stat-card** (numeri riassuntivi, es. terreni, attività, ore) e **action-card** (link a una pagina). Alcune card mostrano liste (es. affitti in scadenza, lavori recenti). La **mappa aziendale** (se presente) mostra i terreni del tenant.
- **Tour:** il pulsante **Tour** nell'header avvia un tour guidato (intro.js) che illustra le parti principali della dashboard.

### Opzioni e impostazioni

- **Dove si trovano:**  
  - **Impostazioni** → link nell'header della dashboard → `admin/impostazioni-standalone.html`.  
  - **Abbonamento (piano e moduli)** → card "Abbonamento" nella dashboard o da Amministrazione → `admin/abbonamento-standalone.html`.
- **Cosa si può configurare:**  
  - **Informazioni Azienda** (solo manager/amministratore): nome azienda, P.IVA, Codice fiscale, indirizzo, città, CAP, provincia, telefono, email, note, logo aziendale. Salvataggio con "Salva Impostazioni Azienda".  
  - **Poderi:** lista dei poderi dell'azienda; aggiunta, modifica ed eliminazione (nome, indirizzo/coordinate su mappa). I poderi servono per associare terreni e per invio comunicazioni (scelta del podere).  
  - **Comunicazioni (impostazioni):** scelta del podere predefinito per le comunicazioni.  
  - **Profilo utente / Cambia password:** nella pagina Impostazioni è disponibile il form per cambiare la password (utente autenticato).  
  - **Cambio azienda (tenant):** se l'utente è membro di più aziende, il pulsante **Cambia Azienda** nell'header permette di selezionare un altro tenant; i dati mostrati (terreni, lavori, moduli) diventano quelli del tenant selezionato.  
  - **Abbonamento:** nella pagina Abbonamento si vede il piano attuale (Free/Base), si attivano/disattivano i moduli a pagamento e, se disponibili, i bundle.
- **Effetti:** le impostazioni azienda e i poderi influenzano i dati usati in tutta l'app (es. terreni associati a podere, comunicazioni con podere). Il cambio tenant cambia contesto e visibilità. L'abbonamento determina quali moduli e limiti (terreni, attività) sono attivi.

---

## 5. Termini e concetti

| Termine | Definizione breve |
|--------|--------------------|
| **Dashboard** | Pagina principale dopo il login; mostra sezioni, statistiche e card per accedere a Terreni, Attività, Lavori, Amministrazione, Impostazioni, moduli. |
| **Card / Action card** | Blocco cliccabile nella dashboard che porta a una pagina (es. "Terreni", "Diario Attività", "Abbonamento"). |
| **Stat-card** | Blocco che mostra un numero riassuntivo (es. numero terreni, ore del mese, lavori da pianificare). |
| **Impostazioni** | Pagina in cui si configurano dati azienda, poderi, comunicazioni e password; raggiungibile dall'header dashboard. |
| **Podere** | Unità organizzativa dell'azienda (nome, posizione); i terreni possono essere associati a un podere; usato anche per le comunicazioni. |
| **Amministrazione** | Insieme di pagine per gestire utenti, squadre, operai, compensi, macchine, abbonamento; accessibile dalla card "Amministrazione" o "Apri Amministrazione" in dashboard. |

---

## 6. Limitazioni e regole

- **Impostazioni azienda e poderi:** solo **manager** e **amministratore** possono modificare le informazioni azienda e gestire i poderi; gli altri ruoli possono solo cambiare la propria password (se la pagina lo consente).
- **Cambio azienda:** il pulsante "Cambia Azienda" è visibile solo se l'utente ha **più di un tenant** (multi-tenant membership).
- **Dashboard:** le sezioni e le card visibili dipendono da **ruolo** e **moduli attivi**: ad esempio, senza modulo Manodopera non compaiono le card Lavori, Validazione ore, Gestione Squadre; l'operaio vede solo le sezioni pertinenti (comunicazioni, lavori di oggi, ore).

---

## 7. Relazioni con altri moduli

La navigazione e la dashboard **collegano** tutte le aree: Core (Terreni, Attività, Statistiche), Amministrazione (utenti, squadre, lavori, abbonamento), moduli (Vigneto, Frutteto, Magazzino, Conto Terzi, Parco Macchine). Le opzioni (impostazioni azienda, poderi, abbonamento) influenzano i dati e le funzionalità disponibili in ogni modulo. Dettagli sui flussi tra moduli in **Intersezioni tra moduli** (`intersezioni-moduli.md`).

---

# Core – Glossario, regole comuni, alert, form e calcoli

Terza parte del Core: glossario condiviso, regole comuni, cosa sono gli alert e come leggerli, form e validazioni, campi e tabelle calcolate (in generale).

---

## 1. Titolo

**Core** – Glossario condiviso, regole comuni, alert e notifiche, form e validazioni, campi e tabelle calcolate.

---

## 2. Scopo

Fornire un **glossario unico** dei termini usati in tutta l'app, riepilogare le **regole comuni** (permessi, abbonamento, isolamento dati), spiegare **cosa sono gli alert** (es. affitti in scadenza) e come interpretarli, descrivere in generale **form e validazioni** (campi obbligatori, messaggi di errore) e **campi/tabelle calcolate** (come vengono calcolati i valori derivati).

---

## 3. Dove si trova

**Applicato a tutta l'app.** Il glossario e le regole sono di riferimento per ogni sezione. Gli **alert** compaiono in dashboard (es. card "Affitti in Scadenza"), in liste e dettagli (es. scadenze documenti, guasti). **Form e validazioni** sono presenti in ogni pagina di creazione/modifica (terreni, attività, lavori, impostazioni, moduli). I **campi calcolati** e le **tabelle riepilogative** compaiono in statistiche, dashboard, dettagli lavori e attività.

---

## 4. Funzionalità

### Glossario condiviso

Termini usati in tutta l'app, con definizione breve (integrano quelli già introdotti nelle parti precedenti del Core):

| Termine | Definizione breve |
|--------|--------------------|
| **Tenant** | Azienda/organizzazione: insieme di dati (terreni, lavori, utenti, moduli) isolato. Ogni utente appartiene a uno o più tenant. |
| **Ruolo** | Funzione dell'utente in un tenant: amministratore, manager, caposquadra, operaio. Definisce cosa può fare e vedere. |
| **Terreno** | Unità di suolo gestita dall'azienda: nome, superficie, coltura, podere, eventuale perimetro sulla mappa e data scadenza affitto. |
| **Lavoro** | Incarico assegnato a un caposquadra o a un operaio: nome, terreno, date, stato (da pianificare, in corso, completato, ecc.), eventuali zone lavorate e ore. |
| **Attività** | Registrazione di un'intervento lavorativo su un terreno: tipo lavoro, terreno, data, orari, ore nette, note; può essere collegata a un lavoro (es. ore validate). |
| **Modulo** | Funzionalità aggiuntiva a pagamento (Vigneto, Frutteto, Magazzino, Manodopera, Parco Macchine, Conto Terzi). Disponibili solo con piano Base. |
| **Abbonamento** | Piano sottoscritto dal tenant: Free (limiti terreni/attività, nessun modulo) o Base (€5/mese, moduli pay-per-use). |
| **Podere** | Unità organizzativa dell'azienda (nome, posizione); i terreni possono essere associati a un podere. |
| **Ore nette** | Tempo di lavoro effettivo (orario fine − orario inizio − pause), in ore decimali; usato per attività, ore operai e compensi. |
| **Superficie** | Estensione in ettari; per i terreni può essere inserita a mano o **calcolata automaticamente** dal perimetro tracciato sulla mappa. |

### Regole comuni

- **Solo l'amministratore** può: invitare/gestire utenti, assegnare o rimuovere ruoli, gestire l'abbonamento e le impostazioni azienda (dati azienda, poderi).
- **Manager e amministratore** possono: creare/modificare/eliminare lavori e gestire terreni e attività; il caposquadra può modificare solo alcuni campi dei lavori a lui assegnati; l'operaio vede solo i propri lavori e le comunicazioni.
- **Dati isolati per tenant:** tutti i dati (terreni, lavori, attività, utenti per membership, moduli) sono per tenant; non si vedono dati di altri tenant.
- **Il modulo X è a pagamento:** i moduli (Vigneto, Frutteto, Magazzino, Manodopera, Parco Macchine, Conto Terzi) sono attivabili solo con piano Base; il piano Free non include moduli.
- **Limiti piano Free:** massimo 5 terreni, massimo 30 attività al mese.

### Alert e notifiche

- **Cosa sono:** avvisi visivi (card, badge, colori) che segnalano scadenze o stati che richiedono attenzione (es. affitto in scadenza, documento in scadenza, guasto segnalato).
- **Perché ci sono:** regole di business per aiutare l'utente a non perdere scadenze; i colori indicano l'urgenza.
- **Esempio – Affitti in scadenza:** nella dashboard può comparire la card "Affitti in Scadenza" con i terreni in affitto e la data di scadenza. L'alert è calcolato in base ai giorni rimanenti:
  - **Rosso (red):** scade entro 30 giorni (testo es. "X giorni").
  - **Giallo (yellow):** scade entro 180 giorni (testo es. "~X mesi").
  - **Verde (green):** scade oltre 180 giorni (testo es. "~X mesi").
  - **Grigio (grey):** già scaduto (testo "Scaduto").
  Gli elementi più urgenti (rosso e giallo) sono mostrati in evidenza; l'ordine è per urgenza (prima rosso, poi giallo, poi verde, poi grigio).
- Altri contesti: scadenze documenti (es. macchine, operai), guasti segnalati; la logica è analoga (scadenza vicina = colore più critico).

### Form e validazioni

- **Campi obbligatori:** nei form di creazione/modifica molti campi sono obbligatori (es. nome terreno, terreno e data inizio per un lavoro, tipo lavoro e terreno per un'attività). Se mancano, il salvataggio viene bloccato e può essere mostrato un messaggio di errore.
- **Messaggi di errore:** l'app mostra messaggi espliciti quando la validazione fallisce (es. "ID lavoro obbligatorio", "Deve essere assegnato almeno un caposquadra o un operaio", "Le ore nette devono essere maggiori di 0"). Formati non validi (es. date, numeri) possono generare avvisi specifici.
- **Campi calcolati automatici:** alcuni campi non vanno inseriti a mano ma sono **calcolati** (es. ore nette da orari e pause, superficie da perimetro mappa). Se si modificano i dati sorgente (orari, vertici), il valore calcolato si aggiorna.
- **Effetto:** compilare correttamente i campi obbligatori e rispettare i formati evita errori di salvataggio e dati incoerenti.

### Campi e tabelle calcolate

- **Come vengono calcolati in generale:**
  - **Ore nette:** da orario inizio, orario fine e minuti di pausa: (minuti totali lavorati) / 60, in ore decimali. Usate in attività, ore operai, statistiche e compensi.
  - **Superficie terreno:** può essere inserita manualmente oppure **calcolata dal perimetro** tracciato sulla mappa (geometria del poligono); il valore è in ettari. Se si modifica il perimetro, la superficie si ricalcola.
  - **Superficie lavorata / percentuale:** nei lavori può essere presente una superficie totale lavorata (da zone lavorate); la percentuale rispetto alla superficie del terreno è (superficie lavorata / superficie terreno) × 100.
  - **Totali in tabelle:** le tabelle riepilogative (es. ore per tipo lavoro, ore per mese, ore per operaio) sommano i valori delle righe (es. ore nette) in base a filtri (periodo, lavoro, stato). Le colonne "totale" o "riepilogo" sono quindi calcolate.
- **Tabelle:** colonne tipiche sono dati inseriti (nome, data, tipo) e colonne calcolate (ore totali, percentuale, totale ettari). I filtri (data, stato, terreno) restringono le righe; i totali si aggiornano di conseguenza.

---

## 5. Termini e concetti

Oltre ai termini già in tabella nel glossario sopra: **alert** (avviso di scadenza o stato critico, con colore legato all'urgenza); **validazione** (controllo sui campi prima del salvataggio); **campo calcolato** (valore derivato da altri campi o dalla geometria, non inserito a mano); **tabella riepilogativa** (tabella con totali o aggregati calcolati sulle righe).

---

## 6. Limitazioni e regole

- Le regole comuni (chi può fare cosa, isolamento tenant, piani e moduli) valgono in tutta l'app e sono riassunte sopra.
- Gli alert dipendono dai dati presenti (es. se non ci sono terreni in affitto, la card "Affitti in Scadenza" può essere vuota o nascosta).
- I campi calcolati non sono modificabili direttamente dall'utente; si aggiornano modificando i dati sorgente (orari, perimetro, zone lavorate).

---

## 7. Relazioni con altri moduli

Glossario, regole, alert, form e calcoli sono **trasversali**: ogni modulo usa gli stessi concetti (tenant, ruolo, terreno, lavoro, attività) e può avere propri form, validazioni e campi calcolati (es. calcolo materiali nel Vigneto, statistiche nel Frutteto). I dettagli specifici per modulo sono nei rispettivi file di guida; i flussi tra moduli in **Intersezioni tra moduli** (`intersezioni-moduli.md`).
