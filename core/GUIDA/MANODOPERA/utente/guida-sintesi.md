# Manodopera — sintesi per Tony

Modulo **Manodopera** attivo nell’**abbonamento**. Linguaggio utente: **versione mobile** (campo); **azienda** / **abbonamento**, non gergo tecnico.

## Manager — ingresso e home

- **Dashboard con Manodopera attivo:** niente card sparse sotto la panoramica; ingresso via **Moduli** → **Manodopera**, **Per te oggi** («Manodopera: lavori, squadre e ore»), **I miei accessi**, alert **Richiede attenzione**, o Tony «apri manodopera».  
- **Home Manodopera:** KPI (programmati oggi, in corso, ore da validare, eventuale da pianificare con Conto terzi) + sezioni **Pianificazione e lavori** / **Persone** / **Controllo e analisi** (gestione lavori, **impegni giornalieri**, validazione ore, operai, squadre, utenti, compensi, statistiche). **← Dashboard** torna alla dashboard principale; dalle pagine admin **← Manodopera** torna alla home modulo.  
- **Impegni giornalieri:** foto del giorno (libero / impegnato / assente / prestato / sostituto) + vista per lavoro; solo lettura. Ingresso: card hub, **Impegni giorno** da Gestione lavori, o Tony «apri impegni giornalieri».  
- **Amministrazione** (👑): da **Moduli**, non come card in pagina quando Manodopera è attivo.

## Ruoli (non mischiare)

- **Manager / amministratore:** versione desktop; **home Manodopera** + pagine admin; solo lui **gestione squadre**; **gestione operai**, **compensi**, **validazione ore** globale, **statistiche manodopera**, **gestione lavori**, **impegni giornalieri**, eventuale **Segnatura ore** desktop.  
- **Caposquadra:** **versione mobile** — schede Lavoro (squadra, **valida ore** sul lavoro), Comunicazioni, Ore, Statistiche; **non** gestisce composizione squadre.  
- **Operaio:** **versione mobile** — Lavoro, Ore, Statistiche; **non** Diario manageriale; **non** valida ore altrui; ore da **Segna ore**; dettaglio lavoro in iframe.

## Tony / dati

- **Home Manodopera** e **gestione lavori** manager: contesto liste dove esposto (`pageType` lavori).  
- **Impegni giornalieri:** lista giorno (`pageType` impegni giornalieri); Tony può aprire la pagina e riassumere ciò che è in tabella.  
- **Versione mobile** / **lavori caposquadra:** dati tabella visibili in pagina; contesto **ristretto** per operaio/caposquadra.

Senza modulo **Manodopera** attivo, **non** descrivere schermate manodopera.
