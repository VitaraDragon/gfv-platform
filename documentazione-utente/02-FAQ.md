# ❓ FAQ - Domande Frequenti

Le risposte alle domande più comuni su GFV Platform.

## 🔐 Account e Accesso

### Come mi registro?
Se ricevi un invito via email:
1. Clicca sul link nell'email
2. Completa il form di registrazione
3. Imposta la tua password
4. Accedi alla dashboard

Se non hai ricevuto invito:
- Contatta l'amministratore della tua azienda
- Oppure registrati direttamente (se abilitato)

### Ho dimenticato la password
1. Vai alla pagina di login
2. Clicca su "Password dimenticata?"
3. Inserisci la tua email
4. Controlla la casella email per il link di reset

### Posso cambiare la mia password?
Sì! Vai su **Impostazioni** → **Account** → **Cambia Password**

### Posso avere più ruoli?
Sì! Un utente può avere più ruoli contemporaneamente (es. Manager + Caposquadra). L'amministratore può assegnare ruoli multipli.

## 👥 Ruoli e Permessi

### Quali sono i ruoli disponibili?
- **Amministratore**: Gestisce tutto (utenti, abbonamenti, configurazione)
- **Manager**: Gestisce lavori, terreni, statistiche
- **Caposquadra**: Gestisce squadra, valida ore, traccia lavori
- **Operaio**: Segna ore, riceve comunicazioni, visualizza lavori

### Cosa posso fare con il mio ruolo?
Consulta le guide specifiche:
- [Guida Manager](03-GUIDE_RUOLO/GUIDA_MANAGER.md)
- [Guida Caposquadra](03-GUIDE_RUOLO/GUIDA_CAPOSQUADRA.md)
- [Guida Operaio](03-GUIDE_RUOLO/GUIDA_OPERAIO.md)

### Chi può modificare i ruoli?
Solo l'**Amministratore** può assegnare o modificare ruoli degli utenti.

## 🗺️ Terreni e Mappa

### Come aggiungo un terreno?
1. Vai su **Terreni**
2. Clicca **Nuovo Terreno**
3. Inserisci nome, podere, coltura, superficie
4. Traccia il perimetro sulla mappa
5. Salva

### Come traccio il perimetro di un terreno?
1. Clicca sulla mappa per creare punti
2. Clicca sui punti per spostarli
3. Clicca su un punto per eliminarlo
4. Clicca **Salva** quando finito

### Posso modificare un terreno esistente?
Sì! Vai su **Terreni**, clicca sul terreno, poi **Modifica**.

### La mappa non si carica
- Verifica la connessione internet
- Controlla che Google Maps API sia configurata
- Prova a ricaricare la pagina

## 💼 Lavori

### Come creo un nuovo lavoro?
1. Vai su **Gestione Lavori** (Manager)
2. Clicca **Nuovo Lavoro**
3. Compila i campi (nome, terreno, tipo lavoro, data inizio, durata)
4. Assegna a caposquadra o operaio
5. Salva

### Quali sono gli stati di un lavoro?
- **Pianificato**: Lavoro creato ma non ancora iniziato
- **Assegnato**: Lavoro assegnato a caposquadra/operaio
- **In corso**: Lavoro iniziato
- **Completato**: Lavoro terminato
- **Approvato**: Lavoro verificato e approvato dal manager

### Come assegno un lavoro a un operaio?
Quando crei o modifichi un lavoro:
1. Seleziona **Tipo assegnazione**: "Diretta a operaio"
2. Scegli l'operaio dal dropdown
3. Salva

### Come assegno un lavoro a un caposquadra?
Quando crei o modifichi un lavoro:
1. Seleziona **Tipo assegnazione**: "A caposquadra"
2. Scegli il caposquadra
3. Salva

## ⏰ Segnatura Ore

### Come segno le mie ore?
1. Vai su **Segna Ore** (Operaio)
2. Seleziona il lavoro
3. Inserisci orario inizio e fine
4. Aggiungi pause se necessario
5. Aggiungi note (opzionale)
6. Salva

### Posso modificare ore già segnate?
Sì, ma solo se non sono ancora state validate. Vai su **Le Mie Ore**, trova l'ora, clicca **Modifica**.

### Cosa succede dopo che segno le ore?
Le tue ore vengono inviate al caposquadra per la validazione. Puoi vedere lo stato nella sezione **Le Mie Ore**.

### Cosa significa "Da validare"?
Le tue ore sono state segnate ma non ancora controllate dal caposquadra.

### Cosa significa "Validate"?
Il caposquadra ha approvato le tue ore. Sono ora conteggiate nelle statistiche.

### Cosa significa "Rifiutate"?
Il caposquadra ha rifiutato le tue ore. Controlla le note per capire il motivo.

## 👷 Squadre e Caposquadra

### Come creo una squadra?
1. Vai su **Gestione Squadre** (Manager)
2. Clicca **Nuova Squadra**
3. Inserisci nome squadra
4. Seleziona caposquadra
5. Aggiungi operai
6. Salva

### Come comunico con la mia squadra?
1. Vai su **Comunicazione Rapida** (Caposquadra)
2. Compila il form (podere, campo, data, orario, note)
3. Invia

Gli operai riceveranno la comunicazione nella loro dashboard.

### Come valido le ore degli operai?
1. Vai su **Validazione Ore** (Caposquadra)
2. Vedi lista ore da validare
3. Per ogni ora: controlla dettagli, approva o rifiuta
4. Aggiungi note se necessario

## 📊 Statistiche e Report

### Dove vedo le statistiche?
- **Dashboard**: Statistiche rapide in tempo reale
- **Statistiche**: Pagina dedicata con report dettagliati

### Quali statistiche posso vedere?
Dipende dal tuo ruolo:
- **Manager**: Tutte le statistiche (lavori, ore, superficie, squadre)
- **Caposquadra**: Statistiche della propria squadra
- **Operaio**: Solo le proprie statistiche personali

### Come esporto i dati?
Alcuni report hanno pulsante **Esporta Excel** (es. Compensi Operai).

## 🚜 Parco Macchine

### Come aggiungo un trattore?
1. Vai su **Gestione Macchine** (Manager)
2. Clicca **Nuovo Trattore**
3. Compila i dati (marca, modello, CV, targa, ecc.)
4. Salva

### Come segnalo un guasto?
1. Vai su **Segnalazione Guasti** (Operaio)
2. Seleziona trattore/attrezzo
3. Indica gravità (grave/non grave)
4. Aggiungi dettagli
5. Invia

### Cosa succede dopo la segnalazione?
Il manager vede il guasto in **Parco Macchine** → **Officina & Guasti** e lo chiude con **Segna risolto** quando il problema è sistemato. Finché il guasto è in attesa, chi l’ha segnalato può chiuderlo con **Risolto da me** (il guasto si chiude subito) o ritirarlo con **Annulla segnalazione**.

### Ho annullato una segnalazione per errore
Un guasto annullato non si riapre: fai una nuova segnalazione.

## 💰 Compensi

### Come calcolo i compensi degli operai?
1. Vai su **Compensi Operai** (Manager)
2. Seleziona periodo
3. Filtra per tipo operaio o singolo operaio
4. Visualizza compensi calcolati
5. Esporta in Excel se necessario

### Come funzionano le tariffe?
- **Tariffe default**: Per tipo operaio (configurabili in Impostazioni)
- **Tariffe personalizzate**: Per singolo operaio (in Gestione Operai)

## 🔧 Problemi Tecnici

### L'app è lenta
- Controlla la connessione internet
- Prova a ricaricare la pagina
- Chiudi altre schede del browser

### Non vedo alcuni dati
- Verifica di avere i permessi necessari
- Controlla i filtri attivi
- Assicurati che i dati siano stati salvati

### La mappa non funziona
- Verifica connessione internet
- Controlla che Google Maps API sia configurata
- Prova un altro browser

### Ho perso i dati
- I dati sono salvati automaticamente in cloud
- Controlla di essere loggato con l'account corretto
- Contatta il supporto se il problema persiste

## 📱 Mobile e App

### Funziona su smartphone?
Sì! GFV Platform è responsive e funziona su:
- iPhone (Safari, Chrome)
- Android (Chrome, Firefox)

### Posso installarla come app?
Sì! È una PWA (Progressive Web App):
- **iPhone**: Safari → Condividi → Aggiungi alla schermata home
- **Android**: Chrome → Menu → Aggiungi alla schermata home

### Funziona offline?
Alcune funzionalità richiedono connessione internet. I dati vengono salvati in cloud.

## 💳 Abbonamenti e Moduli

### Quali piani sono disponibili?
- **Starter**: Funzionalità base
- **Professional**: Funzionalità avanzate
- **Enterprise**: Tutte le funzionalità

### Cosa sono i moduli?
I moduli aggiungono funzionalità specifiche:
- **Manodopera**: Gestione squadre, lavori, ore
- **Parco Macchine**: Gestione trattori, attrezzi, guasti

### Come attivo un modulo?
Vai su **Abbonamento** (solo Amministratore) e attiva i moduli desiderati.

## 🆘 Supporto

### Come contatto il supporto?
- **Email**: supporto@gfv-platform.com
- **Telefono**: [numero da inserire]
- **Orari**: Lun-Ven 9:00-18:00

### Ho trovato un bug
Segnalalo al supporto con:
- Descrizione del problema
- Passaggi per riprodurlo
- Screenshot (se possibile)
- Browser e dispositivo usato

---

**Non trovi la risposta?** Contatta il supporto o consulta le [Guide per Ruolo](03-GUIDE_RUOLO/).

