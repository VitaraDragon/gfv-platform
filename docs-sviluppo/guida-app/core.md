# Core

Questa e` la base di tutta GFV Platform.

Se hai poco tempo, parti da qui: capirai subito come accedere, quali funzioni puoi usare in base al tuo ruolo e come leggere la dashboard senza confusione.

---

## 1. Scopo

Spiegare in modo chiaro:

- come entrare e orientarsi nell'app;
- cosa puo fare ogni ruolo;
- cosa cambia tra piano Free/Freemium e Base;
- come i moduli e Tony impattano l'operativita quotidiana.

---

## 2. Accesso e multi-tenant

- Accesso con email e password.
- Ogni sessione lavora sempre su un **tenant corrente** (azienda corrente).
- Se appartieni a piu aziende, puoi passare da una all'altra con **Cambia Azienda**.
- Tutti i dati sono isolati per tenant: terreni, lavori, attivita, utenti, moduli e abbonamento.

Suggerimento pratico: se non trovi un dato che eri sicuro di aver inserito, controlla per prima cosa il tenant selezionato.

---

## 3. Ruoli

- **Amministratore:** gestisce azienda, utenti, ruoli, abbonamento e puo operare su tutto come un manager.
- **Manager:** guida operativa dell'azienda (terreni, lavori, moduli, pianificazione, controllo).
- **Caposquadra:** lavora sui compiti assegnati alla propria squadra, gestisce avanzamento e ore operative.
- **Operaio:** lavora sui compiti assegnati e registra le proprie ore.

Nota pratica: dashboard e azioni cambiano in modo netto tra manager, caposquadra e operaio.

---

## 4. Dashboard e navigazione

- La dashboard e` il punto di ingresso dopo il login.
- Nell'header trovi in genere: `Impostazioni`, `Guide`, `Cambia Azienda` (se multi-tenant) e `Logout`.
- Il pulsante `Guide` e` il riferimento utente principale, soprattutto quando Tony non e` disponibile.
- Le card che vedi dipendono sempre da ruolo e moduli attivi.
- La navigazione e` per card/pagine dedicate, non con un menu laterale unico.

Percorsi principali (i piu usati):

- Dashboard -> Terreni
- Dashboard -> Diario Attivita
- Dashboard -> Gestione Lavori / Validazione Ore (se modulo e ruolo lo consentono)
- Dashboard -> Amministrazione
- Dashboard -> Abbonamento
- Dashboard -> Moduli attivi (Vigneto, Frutteto, Magazzino, Conto terzi, Report, ecc.)

---

## 5. Piani, moduli e funzioni sbloccate

### Free/Freemium

- Funzioni base con limiti (ad esempio su terreni/attivita).
- Moduli non disponibili.
- Tony puo essere limitato o non presente, in base alla configurazione attiva.

### Base

- Abilita l'accesso ai moduli a pagamento.
- Sblocca flussi avanzati e un'operativita piu completa.

### Moduli attivi

Ogni modulo attivo aggiunge pagine, strumenti e dati dedicati.  
Esempi:

- Manodopera: lavori, segnatura/validazione ore, dashboard operative squadra.
- Vigneto/Frutteto: registri specialistici, raccolte, trattamenti, concimazioni.
- Magazzino: anagrafica prodotti, movimenti, tracciabilita consumi.
- Conto terzi: clienti, preventivi, tariffe, pianificazione lavori terzi.
- Report: dashboard e viste di analisi dedicate.

---

## 6. Tony e Guide

GFV mette a disposizione due canali di supporto:

- **Guide (documentazione):** consultazione manuale, stabile e sempre disponibile.
- **Tony:** assistente conversazionale, con capacita che cambiano in base a piano/modulo.

Modello pratico:

- **Tony Guida:** spiega come muoversi nell'app e come eseguire i passaggi.
- **Tony Avanzato/Operativo:** puo anche accompagnare azioni operative quando attivo.
- **Freemium senza Tony:** la guida documentale resta il canale principale.

---

## 7. Regole comuni

- Le autorizzazioni dipendono sempre da ruolo + tenant + moduli attivi.
- Una pagina puo esistere ma non essere realmente utilizzabile se il modulo non e attivo.
- I campi calcolati (ore nette, superfici, aggregati) dipendono dai dati operativi inseriti.
- Le scelte in abbonamento cambiano direttamente dashboard e percorsi disponibili.

---

## 8. Relazioni con i moduli

Il Core non sostituisce i moduli: li coordina e li rende leggibili.

- `terreni.md`: base geografica e anagrafica.
- `lavori-attivita.md`: esecuzione operativa giornaliera.
- `vigneto.md` e `frutteto.md`: processi specialistici di coltura.
- `magazzino.md`: consumi, giacenze, tracciabilita.
- `conto-terzi.md`: ciclo cliente-preventivo-lavoro.
- `intersezioni-moduli.md`: visione completa dei flussi cross-modulo.
