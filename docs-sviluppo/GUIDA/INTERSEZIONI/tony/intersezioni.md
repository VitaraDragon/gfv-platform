# Intersezioni tra moduli

Questa sezione ti aiuta a vedere l'app come un sistema unico, non come blocchi separati.

Se ti chiedi "da dove nasce questo dato?" oppure "cosa succede dopo questo passaggio?", qui trovi la risposta.

Quando indichi **dove andare** in chat o in guida, usa sempre il linguaggio dell'app: **pulsante moduli in alto a sinistra** (graffetta, «Apri o chiudi i moduli»), **home** del modulo (Vigneto, Manodopera, Conto Terzi, …), **Per te oggi**, sezione dashboard **I miei accessi** (solo se visibile), **Richiede attenzione** — non "card in dashboard" (obsoleto) e non un pulsante «Moduli» separato in Home.

**Regola unica nomi comandi (Tony e guide):**
1. **Aprire i moduli** = pulsante moduli in alto a sinistra della pelle Proposta (aria-label «Apri o chiudi i moduli», icona graffetta). Non citare un pulsante «Moduli» in Home: con la pelle Proposta è nascosto.
2. **I miei accessi** = **sezione della dashboard** (barra scorciatoie), **non** voce di menu. In Home Proposta può non essere visibile: non presentarla come percorso principale.
3. **Categoria coltura** nei form Terreno/Preventivo = **Vite** (non «Vigneto»). **Vigneto** resta nome di **modulo/pagina** e valore del **filtro elenco Terreni**.

---

## 0. Navigazione cross-modulo (2026)

### Ingresso moduli

- Il **pulsante moduli in alto a sinistra** (graffetta / «Apri o chiudi i moduli») è il percorso **principale** verso Terreni, Diario, Statistiche, Abbonamento e ogni modulo attivo (Vigneto, Manodopera, Magazzino, Conto Terzi, Parco Macchine, Meteo, Report, …).
- Con **Manodopera** attivo **non** cercare grandi tile sparse sotto la panoramica: Vigneto, Magazzino e gli altri verticali sono nel **pannello moduli**, nella **home Manodopera**, in **Per te oggi** o in **Azioni rapide** (Home).
- **Senza Manodopera**, scorrendo **in fondo** alla dashboard possono comparire **riquadri** modulo (Vigneto, Magazzino, …): stessa voce del pannello, scorciatoia opzionale.
- **Richiede attenzione** può aprire direttamente un modulo (es. prodotti sotto scorta → Magazzino; lavori da pianificare → Conto Terzi; scadenze/guasti → Parco Macchine).

### Hub e ritorno

| Modulo | Home / hub | Torna indietro con |
|--------|------------|-------------------|
| Manodopera | KPI + Pianificazione / Persone / Controllo | **← Dashboard** dalle pagine interne; **← Dashboard Principale** dall’hub |
| Vigneto / Frutteto | Dashboard coltura (statistiche, azioni rapide) | **← Dashboard** dalle pagine interne; **← Dashboard Principale** dall’hub |
| Magazzino | Riepilogo giacenze, azioni rapide, Archivio documenti | **← Dashboard** dalle pagine interne; **← Dashboard Principale** dall’hub |
| Conto Terzi | Panoramica clienti, preventivi, lavori | **← Dashboard** dalle pagine interne; **← Dashboard Principale** dall’hub |
| Parco Macchine | Panoramica mezzi, azioni rapide | **← Dashboard** dalle pagine interne; **← Dashboard Principale** dall’hub |
| Vendemmia meccanica | Home VM, piano stagione, calcolatore | **← Dashboard** dalle pagine interne; **← Dashboard Principale** dall’hub |
| Report | Dashboard report / bilanci | **← Dashboard** dalle pagine interne; **← Dashboard Principale** dall’hub |
| Core (Terreni, Diario, …) | pagina dedicata | **← Dashboard** (home app) |

### Scorciatoie Terreni (Core)

- Icona **grappolo** (Vigneto) o **mela** (Frutteto) sulla riga terreno → **anagrafica** coltura per quel campo, **non** la dashboard del modulo.
- Per il riepilogo viola/arancio del modulo → pulsante moduli in alto a sinistra → **Vigneto** / **Frutteto**.
- **Traccia confini** (Terreni aziendali e **Terreni clienti** Conto terzi): stesso gesto — chiusura sul primo punto o doppio tap, Togli ultimo, aggancio ai campi già salvati (in CT solo quelli del cliente). Tony non disegna il poligono.

### Tony tra moduli

- **Tony Guida** (piano Base): spiega i passaggi e indica il **pulsante moduli in alto a sinistra** + nome modulo; non apre pagine da solo.
- **Tony Avanzato**: può **aprire** moduli e schede (es. «apri Conto Terzi», «vai a validazione ore», «apri impegni giornalieri») se il modulo e i permessi lo consentono.
- **Documenti magazzino** (Avanzato + Magazzino): foto/PDF dalla chat → Tony legge le cifre → revisione → movimenti + Archivio; reminder **prezzi in attesa**.
- **Briefing** anche su hub (es. Magazzino): reminder corti + follow-up «apri»; riassunto lungo tipicamente in dashboard.
- Se l'utente è su una pagina e chiede un'azione di **altro modulo**, il percorso tipico è: descrivere pulsante moduli in alto a sinistra → modulo → sezione, oppure (Avanzato) navigazione automatica.

---

## 1. Mappa connessioni principali

- **Core ↔ tutti i moduli:** ruoli, azienda selezionata, abbonamento e pannello moduli governano tutto.
- **Terreni ↔ Lavori/Attività:** ogni lavoro nasce su un terreno; ore e attività ereditano quel contesto (Pulsante moduli → **Terreni** / **Diario** / **Manodopera** a seconda del passo).
- **Terreni ↔ Vigneto/Frutteto:** anagrafiche coltura legate al terreno; icone grappolo/mela per anagrafica rapida.
- **Lavori/Attività ↔ Vigneto/Frutteto:** trattamenti, concimazioni, potatura nascono da **lavoro** o **attività Diario** con categoria corretta; vendemmia/raccolta spesso dirette dal modulo coltura.
- **Vigneto/Frutteto ↔ Magazzino:** prodotti, dosaggi, opzione scarico, movimenti uscita, **Tracciabilità consumi**.
- **Conto terzi ↔ Lavori:** preventivo accettato → lavoro da pianificare → **Gestione lavori** (Manodopera) → ore; elenco in corso/completati in **Gestione lavori** filtrata conto terzi (con Manodopera) o nel **Diario** filtrato (senza).
- **Manodopera ↔ Diario:** con Manodopera il **Diario** è solo storico (nessuna attività nuova, niente modifica/elimina) e le giornate nuove vanno in **Gestione lavori**; senza Manodopera Gestione lavori è bloccata («Modulo Manodopera non attivo») e si usa il Diario.
- **Parco Macchine ↔ Diario/Lavori:** trattore, attrezzo, ore macchina opzionali nel **Diario** (e flussi Manodopera se attivo).
- **Core/Abbonamento ↔ Moduli:** i flussi esistono solo se i moduli necessari sono attivi (ingranaggio in alto a destra → **Abbonamento**).
- **Report ↔ tutti i moduli:** aggrega dati operativi (ingresso dal pannello moduli se modulo Report attivo). Path tipici: `modules/report/views/report-dashboard-standalone.html`, `report-standalone.html`, `report-terreni-standalone.html`. Guide dedicate: `GUIDA/REPORT/`. Molte card hub sono ancora «in sviluppo»; Terreni e Vigneto MVP sono le aree operative.

---

## 2. Flussi completi tra moduli

### 2.1 Preventivo conto terzi → lavoro → ore → diario

1. Pulsante moduli → **Conto Terzi** → **Nuovo preventivo** (cliente, terreno cliente, voci, tariffe).
2. Lista **Preventivi** → invio → accettazione (cliente o manager).
3. **Pianifica lavoro** dal preventivo accettato (o da **Lavori da pianificare** in home Conto Terzi / alert **Richiede attenzione**).
4. Pulsante moduli → **Manodopera** → **Gestione lavori** (completare pianificazione, assegnazioni).
5. Caposquadra/operaio: ore in **versione mobile** o flussi Manodopera; manager: **Validazione ore** dalla home Manodopera.
6. **Lavori in corso** / **completati** dalla home Conto Terzi: con Manodopera aprono **Gestione lavori** filtrata conto terzi; senza Manodopera il **Diario attività** filtrato; consolidamento in statistiche.

Ruoli: manager/amministratore per preventivi e pianificazione; caposquadra/operaio per esecuzione.

### 2.2 Trattamento/concimazione → scarico magazzino → tracciabilità

1. Creare prima **lavoro** (**Gestione lavori** / **Manodopera**) o **attività Diario** sul terreno con categoria **Trattamenti** / **Concimazione** / **Potatura**. Su un lavoro di **trattamento** il manager può indicare la **Miscela prevista** (acqua, prodotti, dose/ha); con la **capacità botte** sull’attrezzo (**Parco Macchine**) l’app calcola botti piene e ultima botte, e operaio/caposquadra la leggono nella scheda **Lavoro** in campo.
2. Pulsante moduli → **Vigneto**, **Frutteto** o **Seminativo** → pagina registro (**Trattamenti**, **Concimazioni**, **Potatura**) → riga in elenco → **Azioni** → completare prodotti, superficie, dosaggi. Sui trattamenti: **registro privato** — confermare avversità, dose e carenza della scheda pubblica (**Leggi scheda** / **Conferma**), acqua usata, avvisi non bloccanti al Salva, **Esporta CSV / XML**. GFV non invia nulla al SIAN.
3. Se modulo **Magazzino** attivo: spuntare **Registra scarico in magazzino** (se previsto) al salvataggio. I fitofarmaci in **Anagrafica prodotti** hanno il pallino di lettura scheda (giallo / verde / rosso) e conservano le conferme per coltura.
4. Pulsante moduli → **Magazzino** → **Movimenti** (verifica uscita) e **Tracciabilità consumi** (filtri prodotto/terreno). Cancellare un trattamento confermato non toglie i movimenti di magazzino.

Ruoli: principalmente manager/amministratore.

### 2.3 Lavoro agricolo con aree lavorate

1. Lavoro su terreno (**Manodopera** → **Gestione lavori** o **Per te oggi**).
2. Esecuzione caposquadra/operaio; eventuali zone/aree nel Diario o nel lavoro.
3. Chiusura lavoro; registri coltura (Vigneto/Frutteto) se categoria lo richiede.
4. Riepilogo in **Statistiche** / dashboard modulo coltura (**Lavori vigneto** / **Lavori frutteto** = lavori + voci Diario, non elenco trattamenti).

### 2.4 Flusso ore tra ruoli (da campo a controllo)

1. Operaio: versione **mobile**, lavoro scelto, registrazione ore.
2. Caposquadra: validazione ore squadra (mobile).
3. Manager: **Manodopera** → **Validazione ore**, **Statistiche manodopera**, alert in **Richiede attenzione** (ore da validare).

### 2.5 Assenza → sostituto → mappa

1. Manager: **Manodopera** → **Gestione lavori** → segna **assenza** → lavoro in **standby** se sotto equipaggio minimo.
2. **Assegna sostituto** (shortlist con prossimità terreno/podere) oppure, eccezione, Impegni → **Scegli manualmente** (roster giorno).
3. Controlla **Impegni giornalieri** (semaforo rosso/giallo, KPI allarmi).
4. **Mappa** aziendale: layer **Allarmi** (pin ! sul terreno del lavoro) → link a Gestione lavori.
5. Tony Avanzato: «chi è libero?», «candidati sostituto» — legge shortlist/contesto giorno, non ricalcola.
6. Dettaglio UX manager/capo/operaio: `GUIDA/MANODOPERA/utente/guida-manager.md` § assenze/standby/sostituzioni (+ guide capo/operaio).

### 2.6 Bolla o fattura magazzino (foto / PDF con Tony)

1. **Tony Avanzato** + **Magazzino**, ruolo manager/admin: in chat, icona **fotocamera** → scatto o PDF → **Acquisizione terminata**.
2. Tony **legge le cifre** (più attento sui numeri di una sola occhiata) → **form di revisione** → **Registra dati**.
3. Cascata: **Movimenti** (entrate) + **Archivio documenti**; sulla bolla eventuale **prezzo in attesa** fino alla fattura (senza raddoppiare la merce).
4. Completare prezzo in Movimenti o da reminder dashboard/hub Magazzino («apri»).
5. Prezzo medio prodotto aggiornato quando le entrate con prezzo lo prevedono.

L’ingresso resta lo **scatto**, non un file fiscale da cercare. Dettaglio: guida **Tony** (foto bolla o fattura) e guida **Magazzino**.

### 2.7 Vendemmia meccanica ↔ lavori / Conto terzi

Path tipici (standalone): hub `modules/vendemmia-meccanica/views/vm-home-standalone.html`; piano stagione, calcolatore, tariffe VM, bilancio, calcoli salvati sotto la stessa cartella `views/`. Guide dedicate: `GUIDA/VENDEMMIA_MECCANICA/`. Per i flussi che creano lavori usare anche Conto terzi / Manodopera.

1. Modulo **Vendemmia meccanica** attivo (+ spesso Conto terzi per clienti).
2. **Piano stagione** / home VM → terreni in piano; **calcolatore** compenso; sync con **lavori** Manodopera quando il lavoro è di tipo VM.
3. Chiusura lavoro / zone → aggiornamento stato piano (vendemmiato / residui) secondo regole modulo.

---

## 2bis. Procedure guidate (navigazione)

### Da preventivo accettato a lavoro chiuso

**Quando:** cliente conto terzi ha accettato; serve arrivare a lavoro completato e ore validate.

**Percorso Moduli:** **Conto Terzi** (preventivi) → **Manodopera** (lavori, validazione ore) → **Diario** (storico conto terzi).

**Passi**
1. Pulsante moduli → **Conto Terzi** → preventivo **accettato** → **Pianifica lavoro**.
2. Pulsante moduli → **Manodopera** → **Gestione lavori** → completa dati, squadra, date.
3. Campo: ore da operaio/caposquadra.
4. **Validazione ore** (home Manodopera o **Per te oggi**).
5. Chiudi lavoro; verifica in **Diario** (filtro conto terzi completati) e in home Conto Terzi.

**Controllo:** lavoro in storico; ore validate; attività nei riepiloghi.

### Intervento coltura con scarico magazzino

**Percorso Moduli:** **Manodopera** o **Diario** (creazione lavoro/attività) → **Vigneto**/**Frutteto** (registro) → **Magazzino** (tracciabilità).

**Passi**
1. Lavoro/attività con categoria corretta sul terreno del vigneto/frutteto.
2. Pulsante moduli → **Vigneto**/**Frutteto** → **Trattamenti** o **Concimazioni** → completa riga → prodotti → conferma **scarico magazzino** se serve.
3. Pulsante moduli → **Magazzino** → **Tracciabilità consumi** (filtra prodotto o terreno).

**Controllo:** movimento uscita in **Movimenti**; intervento nel registro coltura.

### Mezzo in campo (Parco Macchine + Diario)

1. Pulsante moduli → **Parco Macchine** → censire trattore/attrezzo se mancante.
2. Pulsante moduli → **Diario attività** (o attività da lavoro Manodopera): campi **trattore** / **attrezzo** / **ore macchina** (opzionali; rispettare CV/compatibility).
3. Scadenze/guasti: alert **Richiede attenzione** o hub Parco Macchine.

---

## 3. Ruoli nelle intersezioni

- **Manager/Amministratore:** dashboard desktop, pannello moduli (pulsante graffetta in alto a sinistra) e hub moduli. Impostazioni, **Abbonamento** e **Azienda** (se più aziende) stanno nell’ingranaggio in alto a destra. Con Manodopera, utenti/squadre/operai dalla **home Manodopera** (**Gestisci utenti** aperto a manager e amministratore).
- **Caposquadra:** versione **mobile** per ore e squadra; passaggio eventuale a vista desktop per consultazioni.
- **Operaio:** versione **mobile** semplificata; non vede l'intera panoramica manager.

Punto chiave: la stessa funzione può comportarsi in modo diverso in base al ruolo, anche nella stessa pagina.

---

## 4. Piani e disponibilità flussi

- Un flusso cross-modulo funziona solo se **tutti** i moduli coinvolti sono attivi sull'abbonamento.
- Esempio: scarico da trattamento richiede modulo coltura + modulo **Magazzino**.
- Esempio: validazione ore strutturata richiede **Manodopera**; senza Manodopera restano Diario e tariffa proprietario in Impostazioni (Core).
- Se manca un modulo, il flusso resta **parziale** (registro intervento senza scarico, preventivo senza pianificazione lavori strutturata, ecc.).

---

## 5. Tony e intersezioni

- **Tony Guida** (Base): descrive passaggi tra moduli con pulsante moduli → nome modulo → sezione; non inventare tile o "card" in dashboard.
- **Tony Avanzato:** può aprire moduli e compilare schede lungo il flusso; rispetta permessi ruolo e moduli attivi.
- **Consigliere moduli** (solo Base): suggerisce moduli mancanti utili al flusso descritto; max 1–2; rimanda ad **Abbonamento**, non promuove Tony Avanzato.

### Esempi pratici

- «Dal preventivo accettato al lavoro operativo»: elencare **Conto Terzi** → pianifica → **Manodopera** → **Gestione lavori** → ore → **Validazione ore**; con Avanzato, aprire i passaggi consentiti.
- «Manca un operaio oggi»: **Gestione lavori** → assenza → shortlist → Impegni/semaforo → mappa Allarmi; Tony può elencare liberi/candidati dal contesto giorno.
- «Ho una bolla da registrare»: foto/PDF in chat con Tony → revisione → Magazzino Movimenti + Archivio; prezzi in attesa se manca prezzo.
- «Ho registrato trattamento, come verifico lo scarico?»: Pulsante moduli → **Magazzino** → **Tracciabilità consumi** (e **Movimenti**); ricordare che la riga trattamento nasce da lavoro/Diario con categoria corretta.
- «Devo passare dal vigneto al magazzino»: non usare Terreni/grappolo per il riepilogo; Pulsante moduli → **Vigneto** per dashboard, Pulsante moduli → **Magazzino** per giacenze.
- «Apri manodopera e validazione ore» / «apri impegni giornalieri»: intent valido per Avanzato; operaio/caposquadra → solo flussi mobile pertinenti al ruolo.

## Notifiche push ↔ Manodopera / Core

- Preferenze e permesso browser: **Impostazioni** (Core) → scheda **Notifiche**.
- Payload e destinatari: catalogo `notification-catalog.js`; trigger CF su comunicazioni / lavori / ore / assenze (Manodopera).
- Deep link tipici: **field-workspace** (campo) o **gestione-lavori** (manager). WhatsApp solo escalation **assenza**, se abilitato.
- Tony in-app (briefing / chat) **≠** push dispositivo.

## Seminativo ↔ Terreni / Diario / Magazzino / Manodopera

Modulo **`seminativo`** (guide in `GUIDA/SEMINATIVO/`; codice completo su **main**). Hub campagne → anagrafica su terreni; operazioni da Diario o lavori Manodopera; scarico magazzino su trattamenti/concimazioni se Magazzino accessibile.
