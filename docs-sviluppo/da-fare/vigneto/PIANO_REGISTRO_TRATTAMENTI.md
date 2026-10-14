# Registro trattamenti GFV — impostazione

- Titolo: Registro trattamenti GFV — impostazione
- Settore: Ricerca
- Data: 3 ottobre 2026
- Aggiornato: 14 ottobre 2026 (niente SIAN; l'etichetta la legge Gemini sul PDF, due volte; una riga entra solo se confermata. Non pubblicato. Il servlet del Ministero, nel pomeriggio, rispondeva con errore)
- Autore: Coord Ricerca

Documento per chi deve modificare il prodotto. L’impostazione del 3 ottobre resta valida. Le decisioni del 13 ottobre mattina la completano. Se un punto diverge, comanda il paragrafo «Decisioni del 13 ottobre 2026, pomeriggio», e per nome e semaforo il paragrafo «Già in codice il 13 ottobre 2026, sera». Su come si legge l’etichetta comanda «Decisioni del 14 ottobre 2026». La lettura sta in anagrafica, in background. I passi 1, 2, 3, 4 e 5 del pomeriggio sono nel repo e non sono pubblicati. La coda non è online e «Leggi scheda» resta.

## Cosa è, e cosa non è

GFV ha già un diario trattamenti. Va reso un registro privato compilabile, non un quaderno «autorizzato» e non un invio al SIAN.

L’obbligo di tenuta e di conservazione è dell’azienda agricola. GFV ospita la compilazione su Firebase. Non dice che il file è stato inviato al fascicolo. L’azienda, o il suo CAA, carica l’export se vuole.

Frase verso il cliente: i dati anagrafici del prodotto vengono dal Ministero della Salute; carenza e avversità sono quelle della scheda pubblica, filtrate sulla specie del terreno e confermate in azienda.

## Cosa c’è già

- Vigneto: `tenants/{tenantId}/vigneti/{vignetoId}/trattamenti/{id}`
  Modello `modules/vigneto/models/TrattamentoVigneto.js`.
- Frutteto: `tenants/{tenantId}/frutteti/{fruttetoId}/trattamenti/{id}`
  Modello `modules/frutteto/models/TrattamentoFrutteto.js`.
- Seminativo: `tenants/{tenantId}/trattamentiSeminativo/{id}`
  Modello `modules/seminativo/models/SeminativoTrattamento.js`.
- UI condivisa vigneto/frutteto: `shared/js/trattamenti-coltura-page.js`.
- Prodotti: `tenants/{tenantId}/prodotti/{id}` (`modules/magazzino/models/Prodotto.js`).
  Hanno nome, codice, categoria (inclusi i fitofarmaci), dose e giorni di carenza. Non hanno numero di registrazione né principio attivo.
- La varietà non si usa per il registro. La specie non è uniforme: il dettaglio, e il caso del vigneto, è nel paragrafo del 13 ottobre «Specie: non è già pronta dappertutto».
- Stessa scheda per lavori e diario (`lavoroId` oppure `attivitaId`). Non aggiungere un secondo registro.

## Cosa aggiungere sui dati

Sul prodotto, una volta sola:

- numero di registrazione
- principio attivo
- fonte (open data Ministero) e data di lettura

Sul trattamento, oltre ai campi già salvati:

- avversità scelta (testo della riga confermata)
- carenza in giorni per quella coltura (già c’è `giorniCarenza`: va riempita dalla riga, non a mano)
- specie usata per il filtro
- riferimento alla riga confermata (nome prodotto, numero registrazione, coltura della scheda)
- chi ha confermato e quando

Non servono codice EPPO, stadio BBCH, ora del trattamento, né un flag «registro ufficiale». Non copiare l’archivio impieghi del SIAN dentro Firestore.

## Come si propone, senza database nostro

1. L’utente indica il nome del prodotto (o lo sceglie dal magazzino).
2. GFV compila numero di registrazione, denominazione e principio attivo dagli open data del Ministero della Salute (dataset fitosanitari, licenza IODL, citare la fonte). Il file è settimanale. La banca HTML è più aggiornata: il numero si può anche leggere da lì, senza salvare l’intero archivio.
3. GFV legge la specie di quel vigneto, frutteto o seminativo.
4. Sulla scheda pubblica SIAN (impieghi e avversità) propone solo le righe di quella specie: avversità, tempo di carenza, numero massimo di impieghi nell’anno, giorni minimi tra un passaggio e l’altro, dose per ettaro e dose per ettolitro. Se la specie manca, non indovina. Il 13 ottobre precisa che massimo e intervallo servono agli avvisi, non a un blocco, e che le dosi servono a preparare la miscela.
5. L’utente conferma una riga. Si salvano solo i campi confermati sull’anagrafica del prodotto e sul trattamento. La volta dopo, per lo stesso prodotto e la stessa specie, si ripropone quella conferma.
6. Resta un link alla scheda pubblica, per chi vuole controllare.

La carenza in serra è un’altra riga. Non proporla su un pieno campo.

Gemini non è la fonte. Può servire solo se la scheda non si legge e l’utente allega l’etichetta: propone, la persona conferma, non si salva l’output del modello come dato autorizzato.

Non acquistare Fitogest per incorporarlo. La licenza è di lettura, non di riuso in un altro gestionale.

## Export e conservazione

- Export CSV o XML del registro, con i campi sopra. Un PDF solo grafico non è il formato elettronico richiesto.
- L’export è dell’azienda. GFV non lo invia al SIAN.
- Non cancellare in silenzio. I trattamenti confermati restano almeno tre anni, oppure si esportano prima di una cancellazione e lo si dice.
- In landing e in app: registro privato di compilazione. Non «autorizzato», non «accreditato SIAN», non «inviato al fascicolo».

## Cosa non fare

- Non costruire una banca dati impieghi proprietaria.
- Non chiamare il diario attuale «quaderno di campagna».
- Non aggiungere sensori o hardware.
- Non far compilare a mano numero, principio, carenza e avversità se il nome e la specie ci sono già.
- Non copiare il layout di stampa di Image Line. I dati che servono sono elencati il 13 ottobre; la grafica del loro PDF no.
- Il codice parte da questo foglio solo quando Pier chiede esplicitamente di implementarlo.

## Ordine di lavoro

L’elenco breve del 3 ottobre è sostituito dall’ordine del 13 ottobre, in fondo a questo foglio. Non implementare solo i cinque punti vecchi.

## Decisioni del 13 ottobre 2026

Concordate rileggendo questo foglio, il decreto e una stampa reale del registro Image Line (senza copiarne i dati anagrafici nel documento).

### Cosa la legge chiede sul registro

Decreto legislativo 14 agosto 2012, n. 150, articolo 16, comma 3. Per ogni intervento il registro riporta:

- i dati anagrafici dell’azienda;
- la coltura trattata e gli ettari;
- la data, il prodotto, la quantità in chilogrammi o litri, l’avversità.

La parola «terreno» non c’è. Senza il campo, però, non si capisce dove è stata trattata quella coltura. Nel quaderno sul fascicolo il trattamento è legato all’appezzamento. Nell’export il nome del terreno ci va.

### Cosa c’è nella stampa Image Line, e cosa non copiamo

La stampa esaminata è intestata allo stesso articolo 16. È fatta di tre parti.

- In testa: azienda, indirizzo, recapiti, dati fiscali, ettari totali e SAU, titolare, sedi separate.
- Poi l’elenco dei campi, chiamati unità produttive. Ogni riga ha un numero, il nome dato dall’azienda, il tipo di coltivazione (nella stampa letta: produzione pieno campo), coltura e varietà, ettari, anno e data di impianto. Ci sono colonne per portinnesto, numero di piante, inizio fioritura e inizio raccolta: in quella stampa erano vuote.
- Poi i trattamenti, in ordine di data. Su ogni riga: data, avversità e eventuale nota «trattamento preventivo», nome del prodotto, numero e data di registrazione, principio attivo con percentuale, indicazioni di pericolo, quantità in chili o litri, dose per ettaro e dose per ettolitro, acqua in ettolitri (totale e per ettaro), i numeri dei campi e la coltura, gli ettari, chi ha fatto l’operazione, la macchina.
- In fondo: dichiarazione che i trattamenti dell’anno sono tutti riportati, e spazio per la firma.

Il nome del campo sta nell’elenco. Sulla riga del trattamento Image Line scrive solo i numeri. Se lo stesso giorno tratta più campi, fa una sola riga con i numeri e la somma degli ettari. I giorni di carenza in quella stampa non ci sono.

GFV non riproduce quel PDF. Nell’export si scrive il nome del terreno, non un numero e non una lettera. Le lettere A, B, C occupano lo stesso spazio dei numeri, dopo ventisei campi non bastano, e se l’elenco cambia ordine la lettera indica un altro campo. Se un passaggio copre più campi, si scrivono i nomi.

### Acqua impiegata e dosi

L’articolo 16 non elenca l’acqua. Si registra lo stesso, perché senza acqua e senza dosi la miscela non si prepara. Image Line la stampa in ettolitri, totale e per ettaro.

Sul lavoro il manager indica, insieme ai prodotti, l’acqua prevista: ettolitri per ettaro, oppure il totale del campo. Se c’è uno dei due numeri e ci sono gli ettari, l’app calcola l’altro. Alla registrazione si scrive l’acqua davvero usata, che può essere diversa da quella prevista.

Le dosi stanno sulla riga confermata: dose per ettaro e dose per ettolitro. Il manager sceglie la dose per ettaro da usare. L’app calcola la quantità di prodotto per quel campo (dose per ettaro × ettari), in chili o litri. La dose per ettolitro dice quanto prodotto mettere ogni 100 litri. L’acqua dice quanti ettolitri caricare.

Se alla registrazione la quantità di prodotto e l’acqua usata non tornano con la dose per ettolitro della riga confermata, l’avviso lo dice e lascia salvare. Non è un blocco.

### Dose a botte piena

In campagna la miscela si prepara a botte, non a ettaro. Una botte da 4 quintali e una da 15 non portano gli stessi chili di prodotto, anche se la dose per ettolitro è la stessa. Un quintale di botte vale 100 litri.

La capacità si scrive una volta sola sulla scheda macchina, in `modules/parco-macchine/models/Macchina.js`, per ogni attrezzo che ha una botte. Vale sia per i trattamenti (nebulizzatore, atomizzatore) sia per il diserbo (barra o botte da diserbo): è lo stesso campo, la stessa botte, lo stesso conto. Oggi quel dato non c’è: la scheda ha nome, marca, modello, ore, e non ha i quintali della botte. Non va chiesto sugli attrezzi senza serbatoio. Un aratro non ha botte. Se la capacità manca, la miscela resta con dosi, quantità del campo e acqua, e non si inventa la botte piena.

Sul lavoro di trattamento c’è già l’attrezzo. Se è indicato e la botte ha i quintali, per ogni prodotto l’app calcola:

dose a botte piena = dose per ettolitro × quintali della botte.

Esempio. Folpan a 1,25 kg ogni 100 litri e Karathane a 0,25 litri ogni 100 litri. Sulla Florida da 4 quintali: 5 kg di Folpan e 1 litro di Karathane a botte piena. Sul Vulcano trainato da 15 quintali: 18,75 kg di Folpan e 3,75 litri di Karathane. L’operaio vede il nome dell’attrezzo e questi numeri.

L’acqua del campo divisa per la botte dice quante botti piene servono, e se l’ultima è parziale. Una botte parziale usa la stessa dose per ettolitro sulla quantità d’acqua di quell’ultima botte, non la dose della botte piena. Altrimenti sul campo piccolo si caricherebbe prodotto per una botte intera.

### Carenza: si registra, non si blocca

I giorni di carenza arrivano dalla riga confermata della scheda, per quella coltura, e si scrivono sul trattamento. Servono a sapere da quale data si può raccogliere. Non impediscono di salvare. La carenza in serra è un’altra riga: non proporla su un pieno campo.

Oggi i giorni li scrive l’azienda, oppure arrivano dal numero sull’anagrafica prodotto. Dopo la conferma comanda la riga. Il numero sull’anagrafica può restare come suggerimento finché non c’è conferma. I fitofarmaci oggi obbligano quel numero in anagrafica: non toglierlo prima che la conferma ci sia.

### Avvisi su numero massimo e intervallo

Oltre a quanto già deciso il 3 ottobre, sulla riga confermata si salvano anche:

- quanti impieghi di quel prodotto sono ammessi nell’anno su quella coltura;
- quanti giorni devono passare tra un passaggio e l’altro;
- la dose per ettaro e la dose per ettolitro di quella riga, così la miscela ha i numeri.

Sono avvisi, non divieti. Stesso stile dell’avviso dose già in app: si segnala e si può salvare. Il controllo Image Line arriva a registro già scritto. Il nostro, sul numero massimo e sull’intervallo, arriva anche prima, quando il lavoro viene creato. Alla registrazione si aggiunge l’avviso sulla diluizione, se l’acqua usata e la quantità di prodotto non tornano con la dose per ettolitro.

Il conto è per lo stesso prodotto, la stessa coltura e lo stesso campo, nell’anno. Un passaggio sul barricato non conta per un altro campo. Se la scheda di quel prodotto e di quella specie non è mai stata confermata, non si inventa la soglia: si dice che il controllo non si può fare.

Due momenti.

1. Prima del lavoro. Il manager, creando il lavoro di trattamento, indica i prodotti, la dose per ettaro e l’acqua prevista. L’app aggiunge la quantità di prodotto per il campo, la dose per ettolitro della riga confermata e gli ettolitri totali. Quella è la miscela. Tony avvisa se per quel campo si è già al numero massimo, o se l’ultimo passaggio registrato è troppo vicino. È il punto che gli altri sistemi, Image Line compreso, non fanno: loro lo dicono dopo, a registrazione fatta.
2. Alla registrazione. Quando il trattamento viene completato, si scrivono i prodotti davvero usati e l’acqua davvero usata. Lo stesso avviso su numero massimo e intervallo si ripete. Se prodotto e acqua non tornano con la dose per ettolitro confermata, c’è un avviso anche per quello. Non blocca.

Se un trattamento di ieri non è ancora stato registrato, Tony non lo vede e l’avviso può mancare. Va detto così, non nascosto.

La dose per ettaro resta l’avviso già esistente, confrontato con minimo e massimo scritti in anagrafica. Questo lavoro non lo sostituisce con un controllo nuovo sulla dose di etichetta.

### Miscela sul lavoro, visibile all’operaio

Oggi il lavoro di trattamento ha campo, giorno e squadra. Prodotto e dose si scrivono dopo, sulla pagina trattamenti, a lavoro fatto. Per questo un avviso alla creazione del lavoro, oggi, non avrebbe nulla da controllare.

La miscela prevista sta sul lavoro. Per ogni prodotto l’operaio vede, prima di uscire:

- il nome;
- la dose per ettaro scelta dal manager;
- la quantità totale di prodotto per quel campo, in chili o litri (dose per ettaro × ettari);
- la dose per ettolitro della riga confermata, se c’è;
- l’acqua prevista, in ettolitri per ettaro e in totale sul campo;
- se l’attrezzo ha la capacità della botte: il nome dell’attrezzo, la dose a botte piena di ogni prodotto, quante botti piene servono e, se l’ultima non è piena, quanto prodotto va in quell’acqua.

Tony usa prodotto e campo per l’avviso sul numero massimo e sull’intervallo. Senza miscela sul lavoro l’avviso anticipato non parte; l’avviso alla registrazione resta.

Non serve un’app a parte. Il workspace di campo mostra già il lavoro: deve mostrare anche cosa usare.

### Export

CSV o XML. Il file è dell’azienda. GFV non lo invia al SIAN e non lo carica sul fascicolo. Un PDF solo grafico non è il formato elettronico. Non è nemmeno una copia della stampa Image Line.

Ogni riga dell’export contiene ciò che l’articolo 16 chiede e ciò che in app c’è già, più i campi confermati:

- dati anagrafici dell’azienda (dal tenant);
- data del trattamento;
- nome del terreno;
- coltura e varietà, se ci sono;
- ettari trattati;
- nome del prodotto, quantità in chilogrammi o litri, dose per ettaro, dose per ettolitro della riga confermata;
- acqua impiegata, in ettolitri totali e per ettaro;
- numero di registrazione, principio attivo, fonte e data di lettura;
- avversità confermata;
- giorni di carenza della riga confermata;
- specie usata per il filtro;
- chi ha confermato e quando;
- operatore;
- macchina, se c’è.

Non mettere nell’export, in questo lavoro: le indicazioni di pericolo e i codici lettera dei campi. Acqua e dosi ci sono.

### Specie: non è già pronta dappertutto

Il filtro della scheda usa la specie del campo. Se manca, non si indovina.

- Frutteto: c’è `specie` (melo, pesco, pero) in `modules/frutteto/models/Frutteto.js`.
- Seminativo: c’è `colturaNome` sulla campagna.
- Vigneto: ci sono varietà e destinazione uva (`vino`, `vendita_uva`, `misto`) in `modules/vigneto/models/Vigneto.js`. Non c’è una specie già uguale alle voci della banca. Con destinazione `misto`, o se il valore non si mappa, non si propone nulla. I nomi usati dopo la lettura del 13 ottobre sera sono `vite da vino` e `vite da tavola`.

La corrispondenza fra i nostri valori e le colture della scheda sta in una configurazione unica, non ricopiata in tre pagine.

### Dove sta il codice oggi (verificato il 13 ottobre 2026)

- Vigneto: `tenants/{tenantId}/vigneti/{vignetoId}/trattamenti/{id}`, modello `modules/vigneto/models/TrattamentoVigneto.js`.
- Frutteto: `tenants/{tenantId}/frutteti/{fruttetoId}/trattamenti/{id}`, modello `modules/frutteto/models/TrattamentoFrutteto.js`.
- Seminativo: `tenants/{tenantId}/trattamentiSeminativo/{id}`, modello `modules/seminativo/models/SeminativoTrattamento.js`, pagina `modules/seminativo/js/trattamenti-page.js`.
- UI condivisa vigneto e frutteto: `shared/js/trattamenti-coltura-page.js`.
- Prodotto: `modules/magazzino/models/Prodotto.js`. Ha nome, categoria, dose minima e massima, `giorniCarenza`. Non ha numero di registrazione né principio attivo. Nel repo, al 13 ottobre 2026, non compare nessuna di quelle parole.
- Il trattamento nasce da un lavoro o da un’attività. Non aggiungere un secondo registro. Piano già in `docs-sviluppo/da-fare/vigneto/PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`.
- Vigneto e frutteto sono collegati al terreno con `terrenoId` in `shared/models/BaseColtura.js`.
- Sul trattamento ci sono già data, superficie, righe prodotto, operatore, macchina. La quantità è dose per ettaro moltiplicata per gli ettari.
- L’avviso dose confronta con minimo e massimo di anagrafica e lascia salvare (`avvisoDosaggioTrattamento` in `shared/js/trattamenti-coltura-page.js`).
- `isTroppoVicinoAVendemmia` sta nel modello vigneto e non è richiamato dalla pagina. Non trasformarlo in un blocco in questo lavoro.
- `deleteTrattamento` cancella subito il documento e toglie anche i movimenti di magazzino collegati (`modules/vigneto/services/trattamenti-vigneto-service.js`; lo stesso va verificato su frutteto e seminativo). Contraddice «non cancellare in silenzio per tre anni».
- Il lavoro non contiene i prodotti. Il workspace di campo (`core/mobile/js/field-workspace-controller.js`) non mostra una miscela.
- La macchina non ha la capacità della botte (`modules/parco-macchine/models/Macchina.js`). Sul trattamento il collegamento all’attrezzo c’è già (`macchinaId`).

### Come si legge la scheda, senza database nostro

Il pomeriggio sposta questa lettura in anagrafica e la fa per tutte le colture del prodotto. Il paragrafo qui sotto descrive il codice del mattino.

La chiamata agli open data del Ministero della Salute e alla scheda pubblica non sta nel browser. Sta in una Cloud Function: riceve prodotto e specie, restituisce solo le righe di quella specie, non salva l’archivio. Motivo pratico: il browser non può leggere quei siti in modo affidabile, e il file ministeriale è settimanale.

Un solo helper per vigneto, frutteto e seminativo. Non ricopiare la lettura nella pagina del seminativo.

Si salvano solo i campi confermati, sul prodotto e sul trattamento. La volta dopo, stesso prodotto e stessa specie, si ripropone quella conferma.

Gemini non è la fonte. Solo se la scheda non si legge e l’utente allega l’etichetta: propone, la persona conferma.

### Conservazione

I trattamenti confermati restano almeno tre anni, oppure si esportano prima di una cancellazione e lo si dice. Va cambiato il comportamento attuale, che cancella subito. I movimenti di magazzino collegati non si tolgono in silenzio insieme al registro.

### Testi, lingua del campo, Tony

In landing e in app: registro privato di compilazione. Non «autorizzato», non «accreditato SIAN», non «inviato al fascicolo», non «quaderno di campagna».

Le scritte nuove viste sul telefono di campo passano dal catalogo multilingua (`core/config/field-ui-i18n.js` e `core/services/field-ui-i18n.js`). I campi che Tony compila (miscela sul lavoro, campi del trattamento) stanno in `core/config/tony-form-mapping.js`. Niente `if` nel core per una sola pagina, se la configurazione basta.

### Ordine, quando Pier chiede di scrivere il codice

1. Campi sul prodotto: numero di registrazione, principio attivo, fonte, data di lettura.
2. Conferma della riga, sui tre moduli con un solo helper: avversità, carenza per la coltura, specie usata, riferimento alla riga, chi ha confermato e quando, numero massimo di impieghi nell’anno, giorni minimi tra un passaggio e l’altro, dose per ettaro e dose per ettolitro. La lettura sta in una Cloud Function e non salva l’archivio.
3. Mappa specie verso le colture della scheda, in configurazione. Se la specie manca o non si mappa, non proporre.
4. Sulla scheda macchina, per gli attrezzi con botte usati nei trattamenti e nel diserbo, un solo campo: capacità in quintali (1 quintale = 100 litri). Non obbligatorio sugli attrezzi senza serbatoio.
5. Miscela prevista sul lavoro, visibile all’operaio nel workspace di campo: per ogni prodotto, dose per ettaro scelta dal manager, quantità totale del campo (dose × ettari), dose per ettolitro della riga confermata, acqua prevista in ettolitri per ettaro e totale. Se l’attrezzo ha la botte: dose a botte piena, numero di botti e dose dell’ultima botte se è parziale. Alla registrazione, l’acqua davvero usata.
6. Avviso non bloccante alla creazione del lavoro (numero massimo e intervallo), e lo stesso al completamento, più l’avviso se prodotto e acqua usata non tornano con la dose per ettolitro. Conto per prodotto, coltura e campo, nell’anno. Senza conferma, dire che il controllo non si può fare.
7. Export CSV o XML con i campi elencati sopra. GFV non lo invia. Nell’export la dose a botte piena non è un campo in più: si ricalcola da dose per ettolitro e capacità dell’attrezzo.
8. Testo in interfaccia: privato, conferma dell’azienda, niente invio SIAN.
9. Conservazione: niente cancellazione silenziosa dei trattamenti confermati prima dei tre anni; allineare anche frutteto e seminativo, e non togliere in silenzio i movimenti di magazzino.
10. Stringhe del campo nel catalogo multilingua. Campi compilati da Tony nel mapping dei form.

### Già in codice il 13 ottobre 2026, mattina

Il paragrafo «Dove sta il codice oggi» è la fotografia di prima di quel codice. Non usarla come elenco di cose ancora da scrivere.

Sono già nel repo, su vigneto, frutteto e seminativo: numero di registrazione e principio attivo sul prodotto, conferma di riga, mappa specie, capacità botte, miscela prevista sul lavoro e nel workspace di campo, avvisi non bloccanti, export CSV e XML, testi del registro privato, conservazione tre anni, stringhe di campo e mapping Tony. La funzione `leggiSchedaRegistroTrattamento` (europe-west1) è pubblicata. Legge solo il CSV settimanale del Ministero: nome, numero, principio attivo. Non apre la banca SIAN e non scarica l’etichetta. Senza quelle righe risponde `schedaImpieghi: non_letta` e non inventa avversità, carenza o dosi. Il pulsante «Leggi scheda» sta oggi sul completamento del trattamento ed è manuale. Il pomeriggio lo sposta.

### Decisioni del 13 ottobre 2026, pomeriggio

Concordate il 13 ottobre dopo aver letto etichette reali (Aliette: vite e peronospora, 1,5–2,5 kg/ha; Envita SC: 0,5–0,7 L/ha in pre-fioritura). La banca SIAN non è una fonte: dal 14 ottobre non si apre.

#### Quando parte la lettura

Parte la prima volta che il prodotto entra in anagrafica: scritto a mano, oppure letto da un documento. Un carico successivo dello stesso prodotto non la rifà.

Basta il nome per cercarlo. Se il Ministero ha più registrazioni con quel nome, l’azienda sceglie quella giusta. Da lì conta il numero di registrazione.

Il salvataggio del prodotto non aspetta il Ministero. La lettura gira sul server, dopo. In anagrafica si vede «lettura in corso», poi le righe, oppure «da riprovare» se il sito non risponde. Il prodotto resta in magazzino e la lettura si riprova da sola. L’utente non resta sulla pagina ad aspettare.

Se nel frattempo si crea un lavoro, prodotto e dose si possono scrivere a mano. Il menu di avversità e dosi arriva quando la scheda di quel prodotto è pronta. Fino ad allora si dice che il controllo sul numero massimo e sull’intervallo non si può fare.

#### Cosa si legge, e da dove

Due fonti, per quel solo prodotto. Non si copia il sito del Ministero e non si apre `sian.it`.

1. Open data del Ministero della Salute, dataset fitosanitari, licenza IODL 2.0, file settimanale. Danno nome, numero di registrazione, principio attivo, stato, scadenza e revoca. Non danno gli impieghi.
2. Etichetta autorizzata in PDF, dalla banca `https://www.fitosanitari.salute.gov.it/fitosanitariws_new/EtichettaServlet?id=`. L’id non è il numero di registrazione: si trova nella riga di quel numero, nella lista della sua sostanza attiva. Si scarica solo quel PDF, solo se un utente ha aggiunto il prodotto o ne ha cambiato il numero, e si riusa se è già in cache. Avversità, coltura e dose minima e massima si propongono solo se l’estrazione è affidabile. Altrimenti «da verificare a mano», con il link.

#### Cosa si archivia

Sulla scheda di quel prodotto, tutte le colture scritte sulla sua etichetta, pieno campo e serra, e ogni epoca in cui la dose, l’avversità, la carenza, il numero massimo o l’intervallo cambiano. Se l’etichetta ha un solo numero per tutta la stagione, resta una riga. Se dà un intervallo (1,5–2,5 kg/ha), la riga ha minimo e massimo. Fonte e data di lettura restano.

Le epoche non sono i mesi e non sono uno stadio BBCH da compilare. Sono le finestre già scritte sull’etichetta: pre-fioritura, fioritura, dopo la fioritura, trattamento precoce o tardivo, vegetazione piena. Righe separate, così in conferma si sceglie quella giusta.

Questo non è un archivio nazionale. Sono i prodotti che l’azienda ha in anagrafica. Le righe non stanno nei campi del documento prodotto: `getAllProdotti` scarica l’intero documento, e l’elenco magazzino deve restare nome, giacenza e numero. Le righe stanno in una sottocollezione del prodotto, caricata quando si apre quel prodotto o quando lo si sceglie nel lavoro. Non si allega il PDF dell’etichetta al documento prodotto.

La conferma di oggi, `confermeSpecie` per sola specie, non basta più: la stessa coltura può avere più epoche e più avversità. La chiave della conferma è coltura della scheda, epoca e avversità. La volta dopo si ripropone quella conferma.

I nomi coltura della banca SIAN sono quelli della scheda. Il 13 ottobre, sulla seconda pagina di SIVANTO PRIME, la vite non è una riga sola: ci sono `VITE`, `VITE DA VINO` e `VITE DA TAVOLA`. `UVA SPINA` è un’altra coltura. Il vino del campo va su `VITE DA VINO`, l’uva da tavola su `VITE DA TAVOLA`. La riga `VITE` da sola non si assegna. Il nome deve coincidere per intero: un pezzo di nome non basta. Se il campo non si mappa, non si propone nulla.

#### Al lavoro

La specie del terreno sceglie la coltura. La data del lavoro sceglie l’epoca. Si propone un menu di avversità di quella riga, con la dose minima e massima ammesse. Se l’etichetta ha un solo numero, minimo e massimo coincidono. L’azienda conferma. La riga di serra non si propone su un pieno campo.

Se nello stesso momento restano più finestre, o un intervallo, la scelta resta all’azienda. Non si decide da soli «estate, quindi 2 kg/ha».

L’avviso su numero massimo e intervallo usa la riga confermata, come già deciso al mattino. Senza conferma, si dice che il controllo non si può fare. L’avviso dose già in anagrafica (minimo e massimo scritti a mano) resta finché la riga della scheda non c’è. Non lo si sostituisce con un numero inventato.

#### La scheda invecchia

La scheda salvata è la foto di quel giorno. Autorizzazione, dose, epoca e carenza possono cambiare dopo mesi. Ogni sei mesi, al massimo, si rilegge. Il file settimanale degli open data è il controllo leggero: numero, stato, data di variazione. L’etichetta si rilegge per intero solo se quel controllo vede un cambiamento, oppure allo scadere dei sei mesi. Se si crea un lavoro e la foto di quel prodotto è più vecchia, si aggiorna quel solo prodotto prima di proporre la dose.

L’aggiornamento cambia la proposta. I trattamenti già registrati tengono la dose, la carenza e l’avversità confermate quel giorno.

La rilettura gira dietro, un prodotto alla volta, e non tiene ferma la pagina del magazzino. La prima lettura di un prodotto può durare decine di secondi: è il sito pubblico, non il peso dei dati. Per SIVANTO, nome e scheda impieghi, il 13 ottobre ci sono voluti circa venti secondi, senza ancora tutte le pagine e senza l’etichetta.

#### Peso

Decine di prodotti all’anno non riempiono il database. Il rallentamento arriva solo se le righe di coltura viaggiano con l’elenco magazzino. Non metterle lì.

#### Ordine del pomeriggio, quando si scrive il codice

1. Stato di lettura sul prodotto (`in corso`, `pronta`, `da riprovare`) e sottocollezione delle righe, fuori dal documento che carica l’elenco.
2. Lettura sul server, dopo il salvataggio, senza bloccare l’utente: open data, poi tutte le pagine impieghi SIAN di quel numero, poi etichetta. Stessi helper per i tre moduli.
3. Menu sul lavoro: avversità e dose minima e massima della coltura del terreno e dell’epoca della data. Conferma per coltura, epoca e avversità.
4. Controllo leggero settimanale e rilettura completa al cambiamento o entro sei mesi. I trattamenti già salvati non si riscrivono.
5. Allineare la mappa specie ai nomi coltura della banca SIAN, dopo aver letto la pagina della vite. Fino ad allora, se il nome non si mappa, non proporre.

### Già in codice il 13 ottobre 2026, sera

I passi 1, 2, 3, 4 e 5 sono nel repo e non sono pubblicati. L’utente non preme nulla per far partire la lettura. «Leggi scheda» sul completamento del trattamento resta finché la coda non è pubblicata: è ancora l’unico modo online per leggere nome e numero.

Nel repo, non pubblicati:

- Sul fitofarmaco: `letturaSchedaStato` (`in_corso`, `pronta`, `da_riprovare`), motivo e data. Il salvataggio anagrafica non riscrive questi campi, né numero, principio, fonte e data di lettura, né lo stato amministrativo e la data di revoca o scadenza usati dal controllo settimanale.
- Sottocollezione `tenants/{tenantId}/prodotti/{prodottoId}/schedaImpieghi`. Le righe non stanno nel documento dell’elenco. In `firestore.rules` il browser può leggerle e non scriverle. La regola non è pubblicata. Indici di gruppo in `firestore.indexes.json`, non pubblicati.
- `onProdottoSchedaScritto`: al salvataggio di un fitofarmaco nuovo, o se cambia il nome, mette «in corso» e, se il nome cambia, toglie numero e righe vecchie. Non aspetta il Ministero. La coda include anche i fitofarmaci già in anagrafica, uno alla volta.
- Un nome è un numero. Folpan e Folpan Gold non si scambiano. Se il nome ne tocca più di uno, non si sceglie e la lettura resta da riprovare.
- `leggiSchedeRegistroInCoda`: ogni cinque minuti, un solo prodotto. Prima quelli «in corso», poi quelli senza stato, poi «da riprovare» se sono passate almeno sei ore. Open data, poi le pagine coltura della banca SIAN (carenza in pieno campo e in serra), poi l’etichetta se il testo si legge. La dose si scrive solo se il testo la lega a quella coltura. Un intervallo (1,5–2,5 kg/ha) resta minimo e massimo. Due epoche con due numeri restano due righe.
- Per ogni coltura si apre l’elenco avversità della banca. Il nome si salva senza la classe (da «Insetti-ALEURODE…» resta «ALEURODE…»). Se per una coltura l’elenco non arriva, la scheda non diventa «pronta» e il semaforo non va al verde. Non si inventa il nome.
- In elenco, accanto al nome, c’è il semaforo già usato altrove: verde scheda letta, giallo in corso o in attesa, rosso non letta. Il rosso non è un pulsante. Il verde arriva solo con i nomi delle avversità.
- Menu sul lavoro, stesso riquadro per vigneto, frutteto e seminativo. Se la scheda è pronta, propone le avversità della coltura del campo, con dose minima e massima. Se ci sono più finestre, restano tutte: la data non sceglie la dose. La riga di serra non compare in pieno campo. La conferma si salva per coltura, epoca e avversità, e la volta dopo si ripropone.
- Rilettura nella stessa coda. Una volta a settimana confronta numero, stato amministrativo e data di revoca o di scadenza. Nel file del Ministero non c’è una colonna «data di variazione»: si usano decorrenza o decreto di revoca, altrimenti la scadenza dell’autorizzazione. Se sono gli stessi e la foto ha meno di sei mesi, le righe restano. Se uno di quei dati cambia, o sono passati sei mesi, rilegge impieghi ed etichetta. I trattamenti già salvati non si riscrivono. Se si apre un lavoro e la foto ha più di sei mesi, quel prodotto passa avanti e la dose non si propone finché la scheda non è aggiornata.

La mappa specie (passo 5) usa i nomi letti quella sera. Destinazione `vino` → `vite da vino`, `vendita_uva` → `vite da tavola`, `misto` non si mappa. Melo, pero e susino coincidono già con `MELO`, `PERO` e `SUSINO`. Su quella scheda c’è anche `CILIEGIO DOLCE`: non si mappa il ciliegio dell’anagrafica su quel nome, perché la banca può separare dolce e acido e l’acido non era su questa pagina. Poi si pubblica la coda e si toglie «Leggi scheda».

#### Ancora fuori

Quaderno di campagna come nome in interfaccia. Archivio impieghi di tutti i prodotti d’Italia. PDF dell’etichetta dentro il documento prodotto. Attesa dell’utente sulla lettura. Dose o avversità inventate. Riga di serra su un pieno campo. Riscrittura dei trattamenti già confermati quando la scheda si aggiorna. Gemini come fonte dei numeri (dal 14 ottobre è il lettore del PDF, non la fonte). Fitogest. Stadio BBCH obbligatorio. Imparare a memoria i nomi dei prodotti in commercio.

### Decisioni del 14 ottobre 2026

La banca SIAN resta esclusa. Le fonti restano due: gli open data Fitosanitari (anagrafica, stato, scadenza, revoca) e il PDF dell’etichetta autorizzata. Gemini non è una terza fonte. Legge quel PDF e basta. Non si scarica l’archivio del Ministero. Non si ripubblica il PDF. L’archivio delle righe è uno solo, `etichetteFitofarmaci`, per numero di registrazione, condiviso fra le aziende. Non è un database per azienda. Il trattamento non richiama Gemini: prende la riga della coltura del terreno. Data, appezzamento, ettari, quantità usata, operatore e macchina restano i dati dell’app. La data non sceglie la dose e non sceglie l’epoca: se restano più finestre, restano in menu.

#### Cosa si è provato

1. Tre etichette feromone (Aomate Prays, Mister P 2024, Praystec 2024) per trovare l’indirizzo vero del PDF. Non è il numero di registrazione. Nella lista della sostanza attiva, la riga di quel numero ha `EtichettaServlet?id=` con un id opaco. Il sito manda un’intestazione TLS rotta: i client normali falliscono; la chiamata che funziona è TLS con i certificati di sistema e la risposta letta a mano.
2. Nimrod, da un archivio di ditta e non dal Ministero, per vedere se da un’etichetta a più colture escono carenza, dose, massimo e intervallo. Sì, coltura per coltura, su quel formato. La serra si archivia quando il numero è diverso e non si offre in pieno campo.
3. Cinque etichette multi-coltura (Switch, Score 25 EC, Delan 70 WG, Signum, Cabrio WG). Alla prima lettura, zero righe. Poi un lettore per tabella («Coltura / Patogeno», «Malattia», «Avversità») e per la frase «contro». Su quei cinque i dati uscivano.
4. Altri undici PDF di ditta (Actlet, Zorvec, Back 100, Enervin Duo, Efficon, Eradicoat, Decis Evo, Basagran, Wing, Mobigo, Stratos Ultra), altri impaginati, tutti a zero righe all’inizio. I lettori sono stati allargati a «Parassita», «Fitofagi» e al diserbo quando la dose è legata alla coltura. Non è una lista di prodotti ammessi: è il formato. Un formato ancora diverso non propone la dose.
5. Campione di undici etichette prese dal Ministero, diverse dalle precedenti: Teldor Plus, Affirm, Scala, Epik SL, Mildicut, Geoxe, Cantus, Vivando, Sercadis, Flint e Topas 2.5 WG. La ricerca per nome sostanza nell’indirizzo non filtra e restituisce l’elenco generale. Ha funzionato il modulo del sito, con tutti i campi e il cookie di sessione, una sostanza alla volta, solo la prima pagina. Il lettore a regole, su queste undici: sette senza nessuna riga (Teldor Plus, Affirm, Epik SL, Mildicut, Geoxe, Flint, Topas). Quattro con righe. Solo Cantus è uscito pulito (dose, massimo, intervallo). Scala ha messo sulla vite da tavola la dose della lattuga e ha perso zucchina e la seconda riga della fragola. Vivando ha letto le dosi e ha perso massimo, intervallo e carenza, e ha segnato come pieno campo melanzana e peperone che in etichetta sono in serra. Sercadis ha molte colture, e in alcune righe l’«avversità» è la coltura successiva (erba cipollina, cardo, altri ortaggi).

#### Cosa si è deciso

Imparare i nomi dei prodotti in commercio non si fa. In open data sono migliaia, le etichette cambiano, e il campione è caduto sul formato, non sul nome. Una regola di formato vale per tutti i prodotti scritti così. Non si legge il mercato in blocco.

L’affidabilità che serve è quella delle righe archiviate. Il lettore a regole, su etichette mai viste, è basso proprio perché a volte scrive una riga come sicura ed è sbagliata. Dal 14 ottobre la coda non usa più quel lettore per scrivere la scheda. Il PDF va a Gemini, visto come documento, senza OCR, due volte. La seconda lettura non riceve i numeri della prima e deve ritrovarli sulla stessa coltura. La riga entra solo se le due letture coincidono e la citazione di quella coltura contiene l’avversità, la dose con l’unità e, se ci sono, la carenza, il massimo di interventi e l’intervallo, ed è chiaro a che cosa serve ciascun numero. Due dosi nella stessa citazione, un nome di coltura usato come avversità, o una serra non scritta in quella riga: quella coltura non si archivia e resta da verificare a mano. Il registro non compila una dose dubbia.

La sera del 14 ottobre il sito è tornato. Dieci etichette nuove, diverse dalle undici del mattino: Luna Privilege, Banjo, Closer, Luna Sensation, Chorus, Teppeki, Revus Pro SC, Collis, Vertimec EC e Karate Zeon 1.5. Pergado D non era nella prima pagina, e al suo posto è entrato Karate Zeon. La prima prova non ha archiviato nessuna riga. Su tre etichette si è visto il perché: Luna Privilege aveva cinque colture identiche nelle due letture, scartate perché la carenza non era vicina alla parola «giorni» dentro la citazione; Banjo era scartato perché l’avversità non compariva tutta nella citazione, o era scritta in modo diverso fra le due letture; Closer è stato tagliato a metà risposta. Il confronto non guarda più la citazione. Prima i campi vengono messi nella stessa forma (coltura completa in minuscolo, virgola e punto, unità, spazi). Entra solo la riga in cui le due letture coincidono. Nel dubbio resta da verificare a mano. Rilettura delle stesse dieci: 42 righe archiviate, 13 scartate perché manca dose o avversità, 49 scartate perché le due letture non coincidono. Pronte: Luna Privilege, Banjo, Teppeki, Collis, Vertimec EC. Da verificare: Luna Sensation, Chorus, Revus Pro SC. Da riprovare: Closer e Karate Zeon. Le undici del mattino restano fuori dal repo.

Se il Ministero mostra quella pagina di errore, non è «etichetta non trovata». La coda riprova più tardi e non salva in cache una scheda vuota. Un 403 resta «da verificare», per non insistere.

In codice, non pubblicato. Alla pubblicazione `leggiSchedeRegistroInCoda` deve avere il secret `GEMINI_API_KEY`. «Leggi scheda» resta finché la coda non è online. I trattamenti già salvati non si riscrivono.

### Fuori da questo lavoro

- Scheda annuale di taratura della macchina (è un altro adempimento del Piano d’azione nazionale, non questo registro).
- Avvisi che impediscono di salvare.
- Codici lettera al posto del nome del terreno.
- Copia del PDF Image Line, indicazioni di pericolo, data di registrazione come obbligo di export.
- Invio al SIAN o al fascicolo.
- Banca dati impieghi in Firestore, Fitogest, EPPO, BBCH, ora del trattamento, flag «registro ufficiale», sensori.
- Trasformare `isTroppoVicinoAVendemmia` in un blocco.
