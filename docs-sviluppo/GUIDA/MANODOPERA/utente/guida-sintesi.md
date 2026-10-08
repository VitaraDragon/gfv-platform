# Manodopera — sintesi per Tony

Modulo **Manodopera** attivo nell’**abbonamento**. Linguaggio utente: **versione mobile** (campo); **azienda** / **abbonamento**, non gergo tecnico.

## Manager — ingresso e home

- **Dashboard con Manodopera attivo:** niente card sparse sotto la panoramica; ingresso via **Moduli** → **Manodopera**, **Per te oggi** («Manodopera: lavori, squadre e ore»), **I miei accessi**, alert **Richiede attenzione**, o Tony «apri manodopera».  
- **Home Manodopera:** KPI (programmati oggi, in corso, ore da validare, eventuale da pianificare con Conto terzi) + sezioni **Pianificazione e lavori** / **Persone** / **Controllo e analisi** (gestione lavori, **impegni giornalieri**, validazione ore, operai, squadre, utenti, compensi, statistiche). **← Dashboard Principale** torna alla dashboard principale; dalle pagine interne **← Dashboard** torna alla home del modulo.  
- **Impegni giornalieri:** foto del giorno (libero / impegnato / assente / prestato / sostituto) + vista per lavoro; solo lettura. Ingresso: card hub, **Impegni giorno** da Gestione lavori, o Tony «apri impegni giornalieri».  
- **Assenze / sostituzioni:** capo può **Segnala assenza** (mobile); manager in **Gestione lavori** conferma → **standby** se sotto equipaggio → **Scegli sostituto** (shortlist + eventuale prestito). Semaforo **rosso/giallo** su impegni/mappa Allarmi. Impegni = solo lettura.  
- **Competenze operai:** scheda skill in Gestione operai (dichiarate + stelline da ore validate) → alimenta la shortlist sostituti.  
- Operaio: **Conferma ricezione** sui messaggi del capo sul lavoro.  
- **Amministrazione** (👑): da **Moduli**, non come card in pagina quando Manodopera è attivo.

## Ruoli (non mischiare)

- **Manager / amministratore:** versione desktop; **home Manodopera** + pagine admin; solo lui **gestione squadre**; **gestione operai**, **compensi**, **validazione ore** globale, **statistiche manodopera**, **gestione lavori**, **impegni giornalieri**, eventuale **Segnatura ore** desktop.  
- **Caposquadra:** **versione mobile** — schede Lavoro (squadra, **valida ore** sul lavoro), Comunicazioni, Ore, Statistiche; **non** gestisce composizione squadre.  
- **Operaio:** **versione mobile** — Lavoro, Ore, Statistiche; **non** Diario manageriale; **non** valida ore altrui; ore da **Segna ore**; dettaglio lavoro in iframe. Può modificare o eliminare le proprie ore finché sono in attesa o rifiutate. Due turni dello stesso giorno non possono sovrapporsi. Un’ora già validata la corregge il caposquadra (lavoro di squadra) o il manager.  
- **Zone lavorate** (dettaglio lavoro): di default **due punti** inizio/fine sul perimetro del terreno (se confini già in Terreni); altrimenti **disegno a mano**. Larghezza macchina = calcolo superficie, non modo di disegno.  
- **Push** (Impostazioni → Notifiche): comunicazioni, lavoro assegnato, conferme mancanti, ore da validare, lavoro da approvare/sospeso, assenza oggi; distinto dai promemoria Tony in app. WhatsApp solo escalation assenza (opzionale).
- **Pieno in campo** (versione mobile operaio/caposquadra): scheda **⛽ Pieno** compare nella scheda **Ore** sotto il form **Segna ore**, solo se lavoro ha **mezzo** (trattore, non solo attrezzo) + Magazzino attivo + prodotti carburante in anagrafica. Registra pieno direttamente dal telefono: scegli carburante (gasolio/benzina), litri, data opzionale → **Registra pieno** → movimento uscita magazzino con origine `pieno` + `macchinaId` dal lavoro; giacenza prodotto carburante **diminuisce**. Se non compare: lavoro senza mezzo, niente Magazzino attivo, o niente prodotti carburante in anagrafica.

## Tony / dati

- **Home Manodopera** e **gestione lavori** manager: contesto liste dove esposto (`pageType` lavori).  
- **Impegni giornalieri:** lista giorno (`pageType` impegni giornalieri); Tony può aprire la pagina e riassumere ciò che è in tabella.  
- **Versione mobile** / **lavori caposquadra:** dati tabella visibili in pagina; contesto **ristretto** per operaio/caposquadra.

Senza modulo **Manodopera** attivo, **non** descrivere schermate manodopera.
