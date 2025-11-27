# ⚠️ Risoluzione Problemi – Errori Frequenti

Se riscontri errori specifici (alert, console o messaggi nella UI), ecco come interpretarli e risolverli.

---

## 🔑 Configurazione & API

### “Errore caricamento config Firebase”
- Il file `core/firebase-config.js` non è presente o non contiene valori
- Verifica che il file NON sia ignorato (in locale) e che contenga la configurazione del progetto reale

### “Google Maps non disponibile”
- Mancata inizializzazione API
- Verifica `core/google-maps-config.js` e assicurati che `loadGoogleMapsAPI()` venga chiamato dopo `loadGoogleMapsConfig()`

---

## 🔒 Autenticazione & Permessi

### “Accesso negato” su Firestore
- L’utente non appartiene al tenant del documento richiesto
- Le regole Firestore richiedono `tenantId` coerente: controlla il documento utente

### Utente senza ruoli dopo registrazione
- In rari casi la scrittura su Firestore può tardare
- La dashboard prova a correggere automaticamente (cerca tenant creato, assegna ruolo admin)
- Se persiste, aggiorna manualmente i ruoli da **Gestisci Utenti**

---

## 📥 Caricamento dati

### “Container non trovato”
- Alcune sezioni della dashboard si aspettano elementi specifici
- Assicurati di non aver rimosso ID/elementi quando modifichi l’HTML

### “Errore listener Firestore”
- Spesso dovuto a indici mancanti
- Controlla la console: viene mostrato il link diretto per creare l’indice richiesto

---

## 🗺️ Mappa

### “Google is not defined”
- Lo script Google Maps non è stato caricato
- Succede aprendo il file `dashboard-standalone.html` da `file://`
- Usa un server locale o GitHub Pages

### Mappa bloccata in “Caricamento…”
- La div mappa non ha dimensioni
- Assicurati che il container abbia `height` e `width` (lo stile di default lo fa, ma non rimuoverlo)

---

## 🧑‍🌾 Lavori & Ore

### Doppie assegnazioni o lavori fantasma
- Se modifichi un lavoro mentre gli operai stanno segnando ore, aspettati qualche minuto di propagazione
- Evita di eliminare un lavoro se ci sono ore già collegate

### “Ore già segnate” quando non dovrebbe
- Gli operai possono segnare una sola riga per lavoro/giorno
- Se serve un secondo turno, crea un’ora con orari differenti nello stesso giorno

---

## 🚜 Modulo Macchine

### “Attrezzo incompatibile con il trattore selezionato”
- L’attrezzo richiede più CV di quelli dichiarati per il trattore
- Modifica il requisito o scegli un trattore più potente

### “Macchina già in uso”
- La macchina è associata a un lavoro in corso
- Concludi il lavoro o libera la macchina manualmente

---

## 📦 PWA / Cache

### Vedo la versione vecchia del sito
- La PWA potrebbe avere il service worker in cache
- Forza l’aggiornamento: Apri gli strumenti sviluppatore → Application → Service Worker → “Skip waiting” / “Update”

### Installazione PWA fallita
- Verifica che manifest e service worker siano raggiungibili via HTTPS
- GitHub Pages richiede qualche minuto dopo il push per rigenerare la PWA

---

## 🧑‍💻 Debug avanzato

### Come abilitare log dettagliati
- In dashboard sono presenti diversi `console.log`/`console.warn`
- Apri DevTools (F12) e controlla la console
- Per isolare i log di GFV, filtra per “GFV” o “🔍”

### Raccolta informazioni per il supporto
1. Copia l’errore completo dalla console
2. Indica URL e ruolo utilizzato
3. Segnala data/ora e passaggi per riprodurre

---

Se l’errore non è in elenco, documenta il messaggio esatto e contatta il supporto: sarà più semplice risolverlo e aggiornare questa sezione per il futuro.

