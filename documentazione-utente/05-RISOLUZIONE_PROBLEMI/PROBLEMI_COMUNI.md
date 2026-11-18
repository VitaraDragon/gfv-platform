# 🛠️ Risoluzione Problemi – Problemi Comuni

Elenco dei problemi più frequenti riscontrati dagli utenti e relative soluzioni rapide.

---

## 🔐 Accesso & Autenticazione

### Non riesco a fare login
- Verifica email e password
- Se hai dimenticato la password, usa il link **“Password dimenticata?”**
- Se l’account è stato invitato ma non ancora attivato, completa la registrazione dal link email

### Dopo il login torno sempre alla pagina di accesso
- Assicurati di non avere estensioni o browser che bloccano `localStorage`
- Controlla che l’orario del dispositivo sia corretto (token Firebase dipendono dall’orario)
- Cancella cache e ricarica

---

## 👥 Utenti & Ruoli

### Non vedo alcune sezioni della dashboard
- Potresti non avere il ruolo necessario
- Chiedi all’amministratore di verificare i ruoli assegnati in **Gestisci Utenti**

### Invitato non riceve l’email
- Controlla cartella spam
- Verifica che l’indirizzo sia corretto
- Se necessario, annulla l’invito e inviane uno nuovo

---

## 🌱 Terreni & Mappa

### La mappa è vuota
- Google Maps API non configurata correttamente: verifica `core/google-maps-config.js`
- Stai aprendo il file da `file://`? Serve usare un server (es. `npx serve`)

### Un terreno non appare
- Controlla di aver disegnato il perimetro sulla mappa
- Verifica che il terreno appartenga allo stesso tenant dell’utente

---

## 🧑‍🌾 Lavori & Squadre

### Il caposquadra non vede il lavoro
- Il lavoro non è assegnato o è in stato “Pianificato”
- Modifica il lavoro e assegna correttamente caposquadra/squadra

### Un lavoro rimane “in corso” anche se concluso
- Caposquadra non ha cliccato “Completa lavoro”
- Manager può completarlo manualmente da **Gestione Lavori**

---

## ⏱️ Ore Lavorate

### Operaio non trova il lavoro nell’elenco
- Il lavoro non è per la data attuale
- Il lavoro è in pausa o non è stato ricreato dopo una modifica

### Ore bloccate con stato “Da validare”
- Caposquadra non ha ancora approvato
- Ricorda di notificare ogni sera i capisquadra

### Ore rifiutate senza motivo
- Chiedi al caposquadra di utilizzare il campo “Motivo rifiuto”
- Modifica l’ora e rispedisci se necessario

---

## 🚜 Parco Macchine

### Macchina segnata come “in uso” anche a lavoro chiuso
- Il lavoro non è stato completato correttamente
- Usa la funzione “Liberazione forzata” in Gestione Lavori

### Guasti non appaiono al Manager
- Controlla che il modulo Parco Macchine sia attivo
- Verifica che l’operaio abbia inviato la segnalazione dalla scheda **⚠️ Segnala un problema** della versione mobile (deve leggere «Segnalazione inviata. Grazie.»)
- Il manager vede i guasti in **Parco Macchine** → **Officina & Guasti**

---

## 📱 PWA & Mobile

### Non riesco ad aggiungere l’app alla Home
- Su iOS usa Safari, su Android Chrome/Edge
- Assicurati che `manifest.json` e `service-worker.js` siano pubblicati (GitHub Pages)

### La PWA mostra contenuti vecchi
- Aggiorna (pull-to-refresh)
- Se necessario, cancella i dati dell’app dal browser

---

## 🔔 Comunicazioni & Notifiche

### Operaio non vede la comunicazione
- Assicurati che appartenga alla squadra selezionata
- Verifica che la comunicazione sia attiva (non scaduta)

### Impossibile confermare comunicazione
- Controlla la connessione
- Aggiorna la pagina e riprova

---

## 🧮 Statistiche & Report

### Grafici vuoti
- Nessun dato nel periodo selezionato
- Il canvas potrebbe non essersi caricato: ricarica la pagina

### Export Excel non parte
- Il browser potrebbe bloccare popup/download
- Abilita i download automatici per il dominio

---

## ⛑️ Quando contattare il supporto

Contatta il supporto (supporto@gfv-platform.com) se:
- I problemi persistono dopo i passaggi sopra
- Servono interventi lato server (es. pulizia dati, ripristino tenant)
- Hai bisogno di adattamenti o personalizzazioni

Annota sempre:
1. Data e ora del problema
2. Utente coinvolto
3. Browser/dispositivo
4. Passaggi per riprodurlo

