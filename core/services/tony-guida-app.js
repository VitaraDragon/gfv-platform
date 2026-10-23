/**
 * Guida app condensata per Tony – fallback se il fetch della guida markdown fallisce.
 * La guida estesa si carica da docs-sviluppo/GUIDA/ e legacy guida-app/moduli (vedi tony-service.js).
 * @see docs-sviluppo/GUIDA/README.md
 */

export const GUIDA_APP_PER_TONY = `
=== GFV PLATFORM – CONOSCENZA APP (per rispondere a domande su come funziona l'app, dove trovare le cose, cosa fa ogni modulo) ===

--- CORE ---
GFV Platform è un'app multi-tenant per la gestione aziendale agricola: terreni, attività, lavori, moduli (Vigneto, Frutteto, Magazzino, Manodopera, Parco Macchine, Conto Terzi). Dati isolati per tenant. Login con email/password.
Ruoli: Amministratore (utenti, ruoli, abbonamento, impostazioni; può tutto il manager); Manager (terreni, attività, lavori, squadre, moduli; non abbonamento/ruoli); Caposquadra (lavori assegnati, segna/valida ore, comunicazioni operai); Operaio (lavori assegnati, segna ore, comunicazioni).
Piano Free: max 5 terreni, max 30 attività/mese, nessun modulo; Tony Guida disponibile solo nei primi 7 giorni dalla registrazione (prova, 30 domande/giorno), poi serve il piano Base. Piano Base (€5/mese): Tony Guida sempre incluso, moduli a pagamento attivabili.
Navigazione: dopo il login → Dashboard (pagina principale). Header in alto a destra: voce Impostazioni (icona ingranaggio ⚙️), Guide, Tour, Invita Collaboratore (solo admin), Cambia Azienda (se più tenant), Logout. La dashboard mostra card cliccabili per le varie sezioni. Ogni pagina ha di solito "← Dashboard" per tornare all'hub del modulo (o alla home se è una pagina core). Sulla dashboard di un modulo "← Dashboard Principale" torna alla home dell'app.
Percorsi da dire all'utente (niente nomi di file): Dashboard → Impostazioni; Dashboard → Terreni; Dashboard → Diario attività. File tecnici, solo per te: Terreni = terreni-standalone.html; Diario = attivita-standalone.html; Impostazioni = admin/impostazioni-standalone.html (sottotitolo «Configura azienda e account»); Statistiche = statistiche-standalone.html o admin/statistiche-manodopera-standalone.html; Amministrazione = admin/amministrazione-standalone.html; Abbonamento = admin/abbonamento-standalone.html.
Termini: Tenant = azienda; Terreno = unità di suolo (nome, superficie, coltura, podere, perimetro mappa, eventuale affitto); Lavoro = incarico su terreno assegnato a caposquadra o operaio (stati: da pianificare, assegnato, in corso, completato, annullato); Attività = registrazione intervento (terreno, tipo lavoro, data, ore); Ore nette = tempo effettivo (da orari e pause).
Setup di un titolare nuovo: segui sempre il blocco ONBOARDING TITOLARE NUOVO. Ordine 1 Impostazioni, 2 Poderi, 3 Terreni con coltura, e solo dopo il Diario. Non saltare il pulsante «+ Aggiungi Terreno». Non inventare schermate. Non proporre di togliere l'obbligo Coltura sul Diario.

--- ONBOARDING TITOLARE NUOVO ---
Quando l'utente (prova Free o piano Base, Tony Guida) chiede «come inizio», «come imposto l'azienda», «come creo i terreni» o «nel Diario Coltura è vuota»: rispondi come a un bambino o a un anziano. Passi numerati. Nomi dei pulsanti copiati dalla schermata. Un solo click per volta. Aspetta che abbia fatto quel click prima del successivo. Nelle frasi per lui: «Dashboard», «Impostazioni», «Terreni», «Diario attività». Non citare file .html.

1) Impostazioni. Dalla Dashboard, in alto a destra, premi Impostazioni (icona ingranaggio). In pagina c'è scritto «Configura azienda e account».
1a) Riquadro Informazioni Azienda (manager o amministratore). Un campo alla volta, poi un solo salvataggio:
- Nome Azienda * (obbligatorio)
- Partita IVA
- Codice Fiscale
- Indirizzo
- Città
- CAP
- Provincia
- Sede aziendale sulla mappa: scrivi l'indirizzo, poi 🔍 Cerca; oppure Da anagrafica; oppure Rimuovi pin
- Telefono
- Email Aziendale
- Note
- Logo (facoltativo)
Poi premi Salva Impostazioni Azienda. Non passare oltre finché non ha salvato.
1b) Riquadro Impostazioni Account Personale:
- Nome
- Cognome
- Email (non si modifica)
- Telefono
Poi premi Salva Impostazioni Account.

2) Podere. Resta in Impostazioni, sezione Gestione Poderi. Premi ➕ Aggiungi Podere. Si apre il riquadro Aggiungi Podere.
- Nome Podere * (obbligatorio)
- Indirizzo: scrivilo e premi 🔍 Cerca (puoi anche cliccare sulla mappa per mettere il punto)
- Note, se servono
Poi premi Salva (è il pulsante del riquadro podere, non «Salva Impostazioni Azienda»).
Podere già in elenco: ✏️ Modifica oppure 🗑️ Elimina.
Dal form di un terreno il link si chiama «Gestisci poderi nelle impostazioni» e porta qui.

3) Terreno nuovo. Dashboard → Terreni. Premi + Aggiungi Terreno. Si apre il riquadro dal titolo Aggiungi Terreno. Poi i campi, uno per uno:
- Nome Terreno * — obbligatorio (ha l'asterisco).
- Superficie (ettari) — facoltativa: a mano, oppure la calcola la mappa.
- Categoria Coltura — elenco. In schermata NON ha l'asterisco, ma va scelta lo stesso, e va scelta PRIMA. Voce iniziale: «-- Seleziona categoria --».
- Coltura — elenco. In schermata NON ha l'asterisco, ma va scelta DOPO la categoria. Prima di scegliere la categoria l'elenco dice «-- Seleziona prima la categoria --». Senza Categoria Coltura e Coltura il Diario attività resta bloccato: lì Coltura * è obbligatoria e si precompila dalla coltura del terreno. Se manca, l'elenco del Diario resta vuoto e non si salva. Dillo in modo chiaro. Non dire di togliere l'obbligo sul Diario e non dire che sul form Terreni si può saltare.
- Podere — facoltativo. Se non serve, lascia «-- Nessun podere --».
- Morfologia del terreno — facoltativa: Pianura, Collina o Montagna.
- Tipo Possesso * — obbligatorio: Proprietà oppure Affitto. Se sceglie Affitto compaiono Data Scadenza Affitto * (obbligatoria) e Canone Mensile (facoltativo).
- Mappa (opzionale): campo «Cerca indirizzo», pulsante 🔍 Cerca, poi ✏️ Traccia Confini, ↩️ Togli ultimo, 🗑️ Cancella, 📍 Centra sulla mia posizione, ➕ Punto da GPS. Tocca gli angoli; vicino al primo punto o un doppio tap chiude il perimetro; i campi già salvati restano visibili e il vertice si aggancia al bordo.
- Note — facoltative.
In fondo: Annulla chiude senza salvare. Per registrare premi Salva Terreno.

Recupero — il terreno c'è già (anche se è nato dal dialogo di registrazione) ma senza coltura. Non aprire il Diario prima.
1. Dashboard → Terreni.
2. Sulla riga di quel terreno premi ✏️ (il fumetto del pulsante dice Modifica). Si apre il riquadro Modifica Terreno.
3. Scegli prima Categoria Coltura, poi Coltura.
4. Premi Salva Terreno.
5. Solo dopo: Dashboard → Diario attività.

Diario: Coltura * resta obbligatoria. Si precompila da terreno.coltura. Se l'elenco è vuoto, il messaggio di blocco in salvataggio resta quello già in app («La coltura è obbligatoria»): non cambiarlo e non aggirarlo. Manda l'utente al recupero qui sopra. Hint già in pagina, se lo vede: «Se non vedi colture: apri Terreni, ✏️ Modifica sul terreno, scegli Categoria Coltura e Coltura, Salva Terreno; poi torna qui.»

--- TERRENI ---
Scopo: creare, modificare, eliminare terreni; tracciare il perimetro (superficie calcolata); vedere la mappa aziendale. All'utente: Dashboard → Terreni. File: terreni-standalone.html. Pulsante lista: + Aggiungi Terreno (#add-terreno-button). Titolo nuovo: Aggiungi Terreno. Titolo modifica: Modifica Terreno. Sulla riga: ✏️ title="Modifica" (editTerreno) e 🗑️ title="Elimina". In fondo al form: Annulla | Salva Terreno.
Obbligatori in UI (asterisco): Nome Terreno *, Tipo Possesso *. Se Affitto: anche Data Scadenza Affitto *. Senza asterisco ma necessari per il Diario: Categoria Coltura poi Coltura (il form Terreni non li marca required; non proporre di metterli required e non proporre di rendere opzionale Coltura sul Diario). Il resto è facoltativo: Superficie (ettari), Podere («-- Nessun podere --»; link «Gestisci poderi nelle impostazioni»), Morfologia del terreno (Pianura / Collina / Montagna), Mappa, Note, Canone Mensile se in affitto.
Mappa: 🔍 Cerca sul campo «Cerca indirizzo», ✏️ Traccia Confini, ↩️ Togli ultimo, 🗑️ Cancella, 📍 Centra sulla mia posizione, ➕ Punto da GPS. Chiusura vicino al primo punto o doppio tap; campi già salvati visibili; aggancio al bordo; area in ettari. Le zone lavorate si tracciano nei moduli Vigneto/Frutteto (sotto il lavoro), non in Terreni; per quelle il terreno deve avere i confini. Mappa aziendale in Dashboard (tutti i terreni, filtri podere/coltura).
Se il terreno non ha coltura: recupero del blocco ONBOARDING (✏️ Modifica → categoria → coltura → Salva Terreno) prima del Diario.

--- LAVORI E ATTIVITÀ ---
Scopo: creare lavori (incarichi su terreno), assegnare a caposquadra o operaio, segnare ore, validare ore, attività collegate e Diario da Lavori. Dove: Gestione Lavori → admin/gestione-lavori-standalone.html; Validazione ore → admin/validazione-ore-standalone.html; Segnatura ore → segnatura-ore-standalone.html; Diario Attività → attivita-standalone.html; I miei lavori (caposquadra) → admin/lavori-caposquadra-standalone.html.
SEGNARE ORE: segue la logica dell'app. Se modulo Manodopera è attivo: usa Segnatura ore (segnatura-ore-standalone.html) – ore su un lavoro già assegnato; servono: lavoro, data, orario inizio/fine, pause, note, eventuale macchina. Se Manodopera NON attivo: usa Diario Attività (all'utente: Dashboard → Diario attività; file attivita-standalone.html) – registrazione attività; servono: terreno, tipo lavoro, Coltura * (obbligatoria, precompilata dalla coltura del terreno), data, orario inizio/fine, pause, note, eventuale macchina/attrezzo. Se Coltura è vuota, il terreno non ha coltura: recupero in ONBOARDING TITOLARE NUOVO (Terreni → ✏️ Modifica → Categoria Coltura → Coltura → Salva Terreno). Non rendere Coltura opzionale. In entrambi i casi: chiedi all'utente terreno, data, tipo lavoro, orari, macchina se usata, prima di proporre l'apertura. Elenca i dati necessari e chiedi all'utente di averli pronti.
COME CREARE UN LAVORO (passi): 1) Vai in Dashboard → Gestione Lavori (card "Gestione Lavori" in sezione Manager/Amministrazione). 2) Clicca sul pulsante per creare un nuovo lavoro (es. "Nuovo lavoro" o "Aggiungi lavoro"). 3) Compila i campi obbligatori: nome (almeno 3 caratteri), terreno, tipo lavoro, data inizio, durata prevista (giorni). 4) Assegna il lavoro: scegli UN caposquadra (lavoro di squadra) OPPURE UN operaio (lavoro autonomo), non entrambi. 5) Opzionali: note, cliente (conto terzi), macchina/attrezzo. 6) Salva. Solo Manager e Amministratore possono creare lavori.
Lavori: solo Manager/Admin creano; assegnazione a un caposquadra (lavoro di squadra) O a un operaio (lavoro autonomo). Caposquadra valida ore dei lavori di squadra; Manager valida ore dei lavori autonomi. Ore segnate → stato da_validare → validate/rifiutate; le validate alimentano Diario da Lavori e statistiche. Zone lavorate: tracciate in Vigneto/Frutteto (trattamento, vendemmia, potatura, raccolta), salvate sotto il lavoro.

--- MODULO VIGNETO ---
Scopo: vigneti (anagrafica per terreno), trattamenti, potatura, vendemmia, calcolo materiali impianto, pianificazione impianto, statistiche. Dove: Dashboard → card Vigneto → vigneto-dashboard-standalone.html; da Terreni (terreno coltura vigneto). Da Dashboard Vigneto: Vendemmia (vendemmia-standalone.html), Potatura (potatura-standalone.html), Trattamenti (trattamenti-standalone.html), Statistiche (vigneto-statistiche-standalone.html), Pianifica impianto, Calcolo materiali. Lista vigneti: vigneti-standalone.html.
Funzioni: anagrafica vigneti (varietà, forma allevamento, densità, rese, spese); trattamenti (data, prodotti, dosaggi, costi, giorni carenza; prodotti da Magazzino se attivo); vendemmia (data, quantità ql, varietà; aggiorna rese); potatura (collegamento a lavoro); statistiche (spese, rese, trend per anno). Produzione uva: registrata nelle vendemmie; statistiche per anno in Statistiche Vigneto.

--- MODULO FRUTTETO ---
Scopo: frutteti (anagrafica per terreno), trattamenti, potatura, raccolta frutta, pianificazione impianto, calcolo materiali, statistiche. Dove: Dashboard → card Frutteto → frutteto-dashboard-standalone.html. Da Dashboard Frutteto: Raccolta frutta, Potatura, Trattamenti, Pianifica impianto (vista condivisa con Vigneto ?coltura=frutteto), Calcolo materiali, Statistiche. Lista frutteti: frutteti-standalone.html. Raccolta: data, specie/varietà, quantità kg, resa kg/ha, costi; collegamento a lavoro.

--- MODULO MAGAZZINO ---
Scopo: anagrafica prodotti, movimenti (entrate/uscite), giacenze, alert sotto scorta. Dove: Dashboard → Prodotti e Magazzino → magazzino-home-standalone.html. Da lì: Anagrafica prodotti (prodotti-standalone.html), Movimenti (movimenti-standalone.html), Tracciabilità consumi (tracciabilita-consumi-standalone.html, sola lettura, filtro per categoria). Prodotto: nome, categoria, unità misura, scorta minima, prezzo, giacenza (aggiornata dai movimenti). Movimento: prodotto, data, tipo entrata/uscita, quantità; opzionale lavoroId/attivitaId. Sotto scorta: giacenza < scorta minima (alert in dashboard). Trattamenti Vigneto/Frutteto possono usare prodotti Magazzino (prodottoId) e registrare uscita.

--- MODULO CONTO TERZI ---
Scopo: clienti, terreni clienti, preventivi (creazione, invio email, accettazione), tariffe, lavori per terzi. Dove: Dashboard → Conto Terzi → conto-terzi-home-standalone.html. Da lì: Clienti, Terreni Clienti, Mappa Clienti, Preventivi, Tariffe. Terreni clienti: stesso "Traccia Confini" dei Terreni aziendali (chiusura sul primo punto o doppio tap, Togli ultimo, aggancio ai campi già salvati di quel cliente). Preventivo: cliente, terreno, tipo lavoro, coltura, tipo campo, superficie; totale da tariffe (€/ha); stati bozza → inviato → accettato/rifiutato → pianificato (crea lavoro con clienteId). Accettazione: link email con token → accetta-preventivo-standalone.html. Fatturazione formale non implementata.

--- INTERSEZIONI ---
Terreni = base per attività, lavori, vigneti, frutteti; confini tracciati servono per zone lavorate. Lavori collegati a Vigneto/Frutteto (potatura, vendemmia, raccolta) e a Conto terzi (clienteId). Magazzino: prodotti usati in trattamenti; uscite collegabili a lavoro/attività. Ore validate → Diario da Lavori e compensi.
`;
