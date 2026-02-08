/**
 * Guida app condensata per Tony – estratta da docs-sviluppo/guida-app/
 * Usata per istruire Tony su struttura, moduli, navigazione e risposte alle domande degli utenti.
 * @see docs-sviluppo/guida-app/README.md
 */

export const GUIDA_APP_PER_TONY = `
=== GFV PLATFORM – CONOSCENZA APP (per rispondere a domande su come funziona l'app, dove trovare le cose, cosa fa ogni modulo) ===

--- CORE ---
GFV Platform è un'app multi-tenant per la gestione aziendale agricola: terreni, attività, lavori, moduli (Vigneto, Frutteto, Magazzino, Manodopera, Parco Macchine, Conto Terzi). Dati isolati per tenant. Login con email/password.
Ruoli: Amministratore (utenti, ruoli, abbonamento, impostazioni; può tutto il manager); Manager (terreni, attività, lavori, squadre, moduli; non abbonamento/ruoli); Caposquadra (lavori assegnati, segna/valida ore, comunicazioni operai); Operaio (lavori assegnati, segna ore, comunicazioni).
Piano Free: max 5 terreni, max 30 attività/mese, nessun modulo. Piano Base (€5/mese): moduli a pagamento attivabili.
Navigazione: dopo il login → Dashboard (pagina principale). Header: Impostazioni, Guide, Tour, Invita Collaboratore (solo admin), Cambia Azienda (se più tenant), Logout. La dashboard mostra card cliccabili per le varie sezioni. Ogni pagina ha di solito "← Dashboard" per tornare.
Percorsi: Dashboard → Terreni (terreni-standalone.html); → Diario Attività (attivita-standalone.html); → Statistiche (statistiche-standalone.html o admin/statistiche-manodopera-standalone.html); → Amministrazione (admin/amministrazione-standalone.html: Gestisci Utenti, Squadre, Operai, Compensi, Macchine, Abbonamento); → Impostazioni (admin/impostazioni-standalone.html); → Abbonamento (admin/abbonamento-standalone.html). Moduli Vigneto, Frutteto, Magazzino, Conto Terzi: card dedicate in dashboard.
Termini: Tenant = azienda; Terreno = unità di suolo (nome, superficie, coltura, podere, perimetro mappa, eventuale affitto); Lavoro = incarico su terreno assegnato a caposquadra o operaio (stati: da pianificare, assegnato, in corso, completato, annullato); Attività = registrazione intervento (terreno, tipo lavoro, data, ore); Ore nette = tempo effettivo (da orari e pause).

--- TERRENI ---
Scopo: creare/modificare/eliminare terreni, tracciare perimetro sulla mappa (superficie calcolata), vedere mappa aziendale. Dove: Dashboard → Terreni → terreni-standalone.html. Funzioni: Aggiungi terreno (nome, superficie, coltura, podere, tipo possesso, data scadenza affitto se in affitto); Modifica/Elimina; "Traccia Confini" sulla mappa (vertici, area in ettari). Le zone lavorate si tracciano nei moduli Vigneto/Frutteto (sotto il lavoro), non in Terreni; il terreno deve avere confini tracciati. Mappa aziendale in Dashboard (tutti i terreni, filtri podere/coltura).

--- LAVORI E ATTIVITÀ ---
Scopo: creare lavori (incarichi su terreno), assegnare a caposquadra o operaio, segnare ore, validare ore, attività collegate e Diario da Lavori. Dove: Gestione Lavori → admin/gestione-lavori-standalone.html; Validazione ore → admin/validazione-ore-standalone.html; Segnatura ore → segnatura-ore-standalone.html; Diario Attività → attivita-standalone.html; I miei lavori (caposquadra) → admin/lavori-caposquadra-standalone.html.
SEGNARE ORE: segue la logica dell'app. Se modulo Manodopera è attivo: usa Segnatura ore (segnatura-ore-standalone.html) – ore su un lavoro già assegnato; servono: lavoro, data, orario inizio/fine, pause, note, eventuale macchina. Se Manodopera NON attivo: usa Diario Attività (attivita-standalone.html) – registrazione attività; servono: terreno, tipo lavoro, coltura, data, orario inizio/fine, pause, note, eventuale macchina/attrezzo. In entrambi i casi: chiedi all'utente terreno, data, tipo lavoro, orari, macchina se usata, prima di proporre l'apertura. Elenca i dati necessari e chiedi all'utente di averli pronti.
COME CREARE UN LAVORO (passi): 1) Vai in Dashboard → Gestione Lavori (card "Gestione Lavori" in sezione Manager/Amministrazione). 2) Clicca sul pulsante per creare un nuovo lavoro (es. "Nuovo lavoro" o "Aggiungi lavoro"). 3) Compila i campi obbligatori: nome (almeno 3 caratteri), terreno, tipo lavoro, data inizio, durata prevista (giorni). 4) Assegna il lavoro: scegli UN caposquadra (lavoro di squadra) OPPURE UN operaio (lavoro autonomo), non entrambi. 5) Opzionali: note, cliente (conto terzi), macchina/attrezzo. 6) Salva. Solo Manager e Amministratore possono creare lavori.
Lavori: solo Manager/Admin creano; assegnazione a un caposquadra (lavoro di squadra) O a un operaio (lavoro autonomo). Caposquadra valida ore dei lavori di squadra; Manager valida ore dei lavori autonomi. Ore segnate → stato da_validare → validate/rifiutate; le validate alimentano Diario da Lavori e statistiche. Zone lavorate: tracciate in Vigneto/Frutteto (trattamento, vendemmia, potatura, raccolta), salvate sotto il lavoro.

--- MODULO VIGNETO ---
Scopo: vigneti (anagrafica per terreno), trattamenti, potatura, vendemmia, calcolo materiali impianto, pianificazione impianto, statistiche. Dove: Dashboard → card Vigneto → vigneto-dashboard-standalone.html; da Terreni (terreno coltura vigneto). Da Dashboard Vigneto: Vendemmia (vendemmia-standalone.html), Potatura (potatura-standalone.html), Trattamenti (trattamenti-standalone.html), Statistiche (vigneto-statistiche-standalone.html), Pianifica impianto, Calcolo materiali. Lista vigneti: vigneti-standalone.html.
Funzioni: anagrafica vigneti (varietà, forma allevamento, densità, rese, spese); trattamenti (data, prodotti, dosaggi, costi, giorni carenza; prodotti da Magazzino se attivo); vendemmia (data, quantità ql, varietà; aggiorna rese); potatura (collegamento a lavoro); statistiche (spese, rese, trend per anno). Produzione uva: registrata nelle vendemmie; statistiche per anno in Statistiche Vigneto.

--- MODULO FRUTTETO ---
Scopo: frutteti (anagrafica per terreno), trattamenti, potatura, raccolta frutta, pianificazione impianto, calcolo materiali, statistiche. Dove: Dashboard → card Frutteto → frutteto-dashboard-standalone.html. Da Dashboard Frutteto: Raccolta frutta, Potatura, Trattamenti, Pianifica impianto (vista condivisa con Vigneto ?coltura=frutteto), Calcolo materiali, Statistiche. Lista frutteti: frutteti-standalone.html. Raccolta: data, specie/varietà, quantità kg, resa kg/ha, costi; collegamento a lavoro.

--- MODULO MAGAZZINO ---
Scopo: anagrafica prodotti, movimenti (entrate/uscite), giacenze, alert sotto scorta. Dove: Dashboard → Prodotti e Magazzino → magazzino-home-standalone.html. Da lì: Anagrafica prodotti (prodotti-standalone.html), Movimenti (movimenti-standalone.html). Prodotto: nome, categoria, unità misura, scorta minima, prezzo, giacenza (aggiornata dai movimenti). Movimento: prodotto, data, tipo entrata/uscita, quantità; opzionale lavoroId/attivitaId. Sotto scorta: giacenza < scorta minima (alert in dashboard). Trattamenti Vigneto/Frutteto possono usare prodotti Magazzino (prodottoId) e registrare uscita.

--- MODULO CONTO TERZI ---
Scopo: clienti, terreni clienti, preventivi (creazione, invio email, accettazione), tariffe, lavori per terzi. Dove: Dashboard → Conto Terzi → conto-terzi-home-standalone.html. Da lì: Clienti, Terreni Clienti, Mappa Clienti, Preventivi, Tariffe. Preventivo: cliente, terreno, tipo lavoro, coltura, tipo campo, superficie; totale da tariffe (€/ha); stati bozza → inviato → accettato/rifiutato → pianificato (crea lavoro con clienteId). Accettazione: link email con token → accetta-preventivo-standalone.html. Fatturazione formale non implementata.

--- INTERSEZIONI ---
Terreni = base per attività, lavori, vigneti, frutteti; confini tracciati servono per zone lavorate. Lavori collegati a Vigneto/Frutteto (potatura, vendemmia, raccolta) e a Conto terzi (clienteId). Magazzino: prodotti usati in trattamenti; uscite collegabili a lavoro/attività. Ore validate → Diario da Lavori e compensi.
`;
