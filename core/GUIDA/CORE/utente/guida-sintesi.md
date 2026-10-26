# GFV Core — sintesi per Tony (solo app base)

Testo breve: stesso linguaggio della guida utente. Usalo per rispondere a «come si fa», ordine dei passi e cosa è normale non vedere senza moduli attivi.

## Prima di tutto

1. **Impostazioni** (in alto a destra, icona ingranaggio; in pagina «Configura azienda e account»). Ordine: riquadro **Informazioni Azienda** (**Nome Azienda**, Partita IVA, Codice Fiscale, Indirizzo, Città, CAP, Provincia, **Sede aziendale sulla mappa** con **🔍 Cerca** / **Da anagrafica** / **Rimuovi pin**, Telefono, Email Aziendale, Note, Logo) → **Salva Impostazioni Azienda**. Poi **Impostazioni Account Personale** (Nome, Cognome, Email non modificabile, Telefono) → **Salva Impostazioni Account**. **Podere solo se serve** (non obbligatorio): **➕ Aggiungi Podere** (**Nome Podere** obbligatorio, indirizzo e **🔍 Cerca**, **Salva**; in elenco **✏️ Modifica** / **🗑️ Elimina**). **Logo** opzionale (preventivi Conto terzi). **Liste personalizzate** (tipi lavoro / colture) per manager. **Tariffa proprietario** per i costi dal Diario senza Manodopera. **Tariffe operai** e **morfologia** solo con moduli **Manodopera** / **Conto terzi**. **Cambio Password** e scheda **Notifiche** (push ciclo lavoro + assenze, fascia oraria, eventuale WhatsApp escalation assenze — distinto dai promemoria Tony in app).
2. **Dashboard manager/amministratore** (ordine tipico dall’alto): pulsante moduli in alto a sinistra (icona graffetta, «Apri o chiudi i moduli» — **modo principale** per Vigneto, Magazzino, ecc.; non c’è un pulsante «Moduli» separato in Home con pelle Proposta); sezione **Meteo sede** (solo piano Base); panoramica con **tre sezioni** (**Richiede attenzione** / **Per te oggi** / **Accessi rapidi**); **I miei accessi** è una **sezione della dashboard** (non voce di menu; in Home Proposta può non vedersi). Sezioni **Scadenze amministrazione** e **In arrivo**. **Riquadri modulo in fondo pagina**: **solo** con moduli attivi **senza** Manodopera; **con Manodopera** non compaiono — usare il pulsante moduli in alto a sinistra.
3. **Terreni** (Dashboard → Terreni): premi **+ Aggiungi Terreno** (riquadro **Aggiungi Terreno**). Campi in ordine: **Nome Terreno** (obbligatorio); **Superficie (ettari)** facoltativa; **Categoria Coltura** poi **Coltura** (vanno scelte sempre, altrimenti il Diario resta bloccato); **Podere** facoltativo («-- Nessun podere --»; link **Gestisci poderi nelle impostazioni**); **Morfologia del terreno** (Pianura / Collina / Montagna); **Tipo Possesso** (Proprietà / Affitto; se Affitto: **Data Scadenza Affitto** e Canone Mensile facoltativo); mappa facoltativa (**Cerca indirizzo**, **🔍 Cerca**, **✏️ Traccia Confini**, **↩️ Togli ultimo**, **🗑️ Cancella**, **📍 Centra sulla mia posizione**, **➕ Punto da GPS**); **Note**. Poi **Salva Terreno** (o **Annulla**). Confini: clic sugli angoli; chiudi sul primo punto o con doppio tap; i campi già salvati si vedono e il vertice si aggancia al bordo. Terreno già creato senza coltura (anche dalla registrazione): sulla riga **✏️** (fumetto **Modifica**, riquadro **Modifica Terreno**) → categoria → coltura → **Salva Terreno**, e solo dopo il Diario. Con moduli **Vigneto** / **Frutteto** attivi: in lista, **grappolo**/**mela** → anagrafica vigneti/frutteti **già collegata a quel terreno** (non la dashboard del modulo; da lì link alla dashboard vigneto/frutteto).
4. **Diario attività**: **➕ Aggiungi Attività**. **Coltura** è obbligatoria: dopo aver salvato categoria e coltura sul terreno, nel Diario la Coltura si riempie da sola; se l’elenco è vuoto, manca la coltura sul terreno — Terreni → **✏️ Modifica** → **Categoria Coltura** e **Coltura** → **Salva Terreno** → torna al Diario. Non togliere l’obbligo. Poi data, terreno, tipo lavoro, orari, pause, note, **Salva Attività**. Opzionale: flag GPS approssimativo (non certificato).
5. **Mappa**: link in intestazione, **Per te oggi**, o pagina dedicata; terreni **con confini** già disegnati in Terreni. Con **Manodopera**: anche zone lavorate, progresso e layer **Allarmi** (pin ! sul terreno lavoro) — dettaglio guida Manodopera.
6. **Statistiche**: filtri periodo / terreno / tipo lavoro, poi **Applica filtri**.

## Menu con la freccetta

Apri il riquadro, scegli la voce; se ci sono due livelli (es. categoria coltura poi coltura), **nell’ordine** indicato dalle etichette.

## Piani e Tony (Core)

- **Free**: limiti terreni/attività; **no** acquisto moduli; **no** prova moduli (serve Base); **no** Tony.
- **Base**: terreni/attività illimitati, **Tony Guida** (orientamento + suggerimenti moduli non invasivi), moduli verticali **pay-per-use** o **prova 30gg** (un modulo alla volta).
- **Modulo Tony Avanzato**: automazioni (navigazione, form, filtri, **foto bolla/fattura** → magazzino) — **oltre** Tony Guida del Base; non confonderli.

## Ruoli e moduli

Dashboard e voci dipendono da **ruolo**, **piano** e **moduli attivi**. Operaio/caposquadra: versione mobile o sezioni campo, non panoramica ufficio. Senza modulo Manodopera: niente squadre/lavori strutturati — non è un errore.

## Tony con solo app base / piano Base senza automazioni

Spiega dove sono le funzioni e i termini in schermata; con **Base** può suggerire moduli utili; **non** inventare schermate o automazioni senza modulo **Tony** attivo e ruolo compatibile.

**PWA:** su login/invito può comparire “Installa”; su iOS spesso Aggiungi a Home. Opzionale; utile con le push.

**Seminativo:** modulo colture a pieno campo (guide in `GUIDA/SEMINATIVO/`; codice completo su main).

**Accesso:** email/password; **Password dimenticata?** dal login; invito via link email (non registrazione generica); **cambia azienda** se siete su più tenant.
