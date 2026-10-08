# 🔧 Guida Operaio - GFV Platform

Guida completa per Operaio su come utilizzare tutte le funzionalità di GFV Platform.

## 🎯 Panoramica

Come Operaio, puoi:
- ✅ Visualizzare lavori assegnati per oggi
- ✅ Segnare le tue ore lavorate
- ✅ Ricevere comunicazioni dal caposquadra
- ✅ Visualizzare le tue statistiche personali
- ✅ Segnalare guasti macchine

## 📋 Dashboard Operaio

La tua dashboard mostra:

### Sezione Comunicazioni
- **Comunicazioni Attive**: Comunicazioni ricevute dal caposquadra
- Dettagli: Podere, campo, data, orario
- Link Google Maps per indicazioni
- Pulsante per confermare ricezione

### Sezione Lavori di Oggi
- **Lavori Assegnati**: Lavori assegnati per oggi
- Dettagli: Nome lavoro, terreno, tipo lavoro
- Link per segnare ore

### Sezione Statistiche Personali
- **Lavori Oggi**: Numero lavori assegnati oggi
- **Ore Segnate**: Ore segnate oggi
- **Stato**: Stato generale (attivo/inattivo)

### Sezione Le Mie Ore
- **Riepilogo**: Ore validate, da validare, rifiutate
- **Ultime Ore Segnate**: Ultime 5 ore segnate
- Link per vedere tutte le ore

## 💼 Visualizzare Lavori

### Lavori di Oggi

1. Nella dashboard, sezione **Lavori di Oggi**
2. Visualizza lavori assegnati per oggi
3. Per ogni lavoro vedi:
   - **Nome**: Nome lavoro
   - **Terreno**: Terreno associato
   - **Tipo Lavoro**: Tipo di lavoro
   - **Stato**: Stato lavoro (Assegnato, In corso)

### Dettagli Lavoro

1. Clicca su un lavoro
2. Visualizza dettagli:
   - **Terreno**: Nome e posizione terreno
   - **Tipo Lavoro**: Tipo di lavoro da eseguire
   - **Data**: Data lavoro
   - **Note**: Note aggiuntive

### Completare Lavoro

Quando finisci un lavoro:
1. Vai su **Lavori di Oggi**
2. Clicca sul lavoro completato
3. Clicca **Lavoro Completato**
4. Conferma

## ⏰ Segnare Ore

### Segnare Ore per un Lavoro

1. Vai su **Segna Ore** (dalla dashboard o menu)
2. Seleziona **Lavoro** dal dropdown
3. Compila i campi:
   - **Data**: Data lavoro (default: oggi)
   - **Ora Inizio**: Orario inizio lavoro (es. 07:00)
   - **Ora Fine**: Orario fine lavoro (es. 17:00)
   - **Pause**: Minuti di pausa (es. 60 per 1 ora)
   - **Note**: Note aggiuntive (opzionale)
4. Clicca **Salva**

Sopra il salvataggio vedi **Le tue ore del giorno**: tutti i turni di quel giorno, su tutti i lavori, con orario, pausa, ore nette e stato. Il turno del lavoro scelto è evidenziato, in fondo c’è il totale.

Due turni dello stesso giorno non possono coprirsi. Se finisci alle 12:00 puoi iniziare un altro turno alle 12:00. Se gli orari si incrociano, il salvataggio si ferma e indica il turno già presente.

**Suggerimento**: Segna le ore alla fine della giornata per avere dati precisi.

### Calcolo Automatico Ore

Il sistema calcola automaticamente:
- **Ore Totali**: Differenza tra ora fine e ora inizio
- **Ore Nette**: Ore totali meno pause
- **Ore Macchina**: Se hai selezionato trattore/attrezzo

### Modificare Ore Già Segnate

Finché l’ora è **in attesa** o **rifiutata** puoi cambiarla o eliminarla, anche dopo qualche giorno. Puoi cambiare data, orari, pausa, note e macchina. Il lavoro resta quello: per un lavoro diverso elimina la riga e segnane una nuova.

1. Vai su **Le Mie Ore** (computer) oppure apri il riquadro del giorno nella versione mobile
2. Sulla riga clicca **Modifica**
3. Sistema i campi e clicca **Salva modifiche**
4. Per toglierla, clicca **Elimina** e conferma

Se l’ora era stata rifiutata, dopo la modifica torna in attesa e il motivo del rifiuto sparisce.

Su un’ora già **validata** non puoi fare nulla. La riga mostra «Validata — per correggerla chiedi al caposquadra» (oppure «al manager», se il lavoro è autonomo o se la riga è del caposquadra).

### Stati Ore

- **Da Validare**: Ora segnata, in attesa. La valida il caposquadra, oppure il manager se il lavoro è autonomo
- **Validate**: Ora approvata, con data e ora di chi l’ha validata
- **Rifiutate**: chi l’ha rifiutata, quando e il motivo

## 📢 Comunicazioni

### Ricevere Comunicazioni

1. Nella dashboard, sezione **Comunicazioni**
2. Visualizza comunicazioni attive
3. Per ogni comunicazione vedi:
   - **Podere**: Podere di ritrovo
   - **Campo**: Campo di ritrovo
   - **Data**: Data comunicazione
   - **Orario**: Orario di ritrovo
   - **Note**: Note aggiuntive dal caposquadra

### Confermare Comunicazione

1. Vai su **Comunicazioni**
2. Trova la comunicazione
3. Clicca **Conferma Ricezione**
4. La comunicazione passa a stato "Confermata"

**Importante**: Conferma sempre le comunicazioni per far sapere al caposquadra che le hai ricevute.

### Indicazioni Stradali

1. Nella comunicazione, clicca **Apri Google Maps**
2. Si apre Google Maps con indicazioni al podere
3. Segui le indicazioni per raggiungere il luogo

## 📊 Le Mie Ore

### Visualizzare Tutte le Ore

1. Vai su **Le Mie Ore**
2. Visualizza:
   - **Riepilogo**: 
     - Ore Validate: Totale ore approvate
     - Da Validare: Ore in attesa
     - Rifiutate: Ore rifiutate
   - **Ultime Ore Segnate**: Ultime 5 ore segnate

### Dettagli Ora

Cliccando su un'ora vedi:
- **Lavoro**: Lavoro associato
- **Data**: Data lavoro
- **Orario**: Inizio, fine, pause
- **Ore**: Ore totali e nette
- **Stato**: Da validare / Validate / Rifiutate
- **Note**: Note aggiunte
- **Motivo Rifiuto**: Se rifiutata, motivo del rifiuto

### Filtrare Ore

1. Vai su **Le Mie Ore**
2. Usa filtri:
   - **Periodo**: Oggi / Settimana / Mese / Personalizzato
   - **Stato**: Tutte / Da validare / Validate / Rifiutate
   - **Lavoro**: Seleziona lavoro specifico

## 🚜 Segnalare Guasti

### Segnalare Guasto Macchina

1. Vai su **Segnalazione Guasti**
2. I campi sono pre-compilati automaticamente:
   - **Trattore**: Trattore assegnato al lavoro corrente
   - **Attrezzo**: Attrezzo assegnato al lavoro corrente
   - **Lavoro**: Lavoro attivo più recente
3. Compila:
   - **Gravità**: 
     - **Non Grave**: Macchina usabile, lavoro può continuare
     - **Grave**: Macchina non usabile, lavoro sospeso
   - **Dettagli Guasto**: Descrizione dettagliata del problema
4. Clicca **Segnala Guasto**

**Nota**: Per guasti gravi, il lavoro viene automaticamente sospeso.

### Visualizzare Guasti Segnalati

1. Vai su **Segnalazione Guasti**
2. Visualizza lista guasti segnalati
3. Per ogni guasto vedi:
   - **Macchina**: Trattore/attrezzo
   - **Gravità**: Grave / Non grave
   - **Stato**: Aperto / Risolto
   - **Data**: Data segnalazione

## 📊 Statistiche Personali

### Statistiche Dashboard

La dashboard mostra:
- **Lavori Oggi**: Numero lavori assegnati oggi
- **Ore Segnate**: Ore segnate oggi
- **Stato**: Stato generale

### Statistiche Dettagliate

1. Vai su **Statistiche** (se disponibile)
2. Visualizza:
   - **Ore Totali**: Ore totali segnate (periodo selezionato)
   - **Media Ore/Giorno**: Media ore lavorate per giorno
   - **Giorni Lavorati**: Giorni in cui hai lavorato
   - **Lavori Completati**: Lavori completati

## ⚡ Azioni Rapide

### Dashboard

- **Segna Ore**: Vai direttamente a segnatura ore
- **Comunicazioni**: Vedi comunicazioni ricevute
- **Le Mie Ore**: Vedi tutte le tue ore
- **Lavori**: Vedi lavori assegnati

### Menu Impostazioni

- **Account**: Modifica dati account
- **Password**: Cambia password

## 💡 Suggerimenti

1. **Segna ore regolarmente**: Segna le ore ogni giorno per avere dati precisi
2. **Conferma comunicazioni**: Conferma sempre le comunicazioni ricevute
3. **Controlla stato ore**: Controlla regolarmente lo stato delle tue ore
4. **Aggiungi note**: Aggiungi note quando segni ore per chiarimenti
5. **Segnala guasti tempestivamente**: Segnala guasti appena si verificano

## ❓ Problemi Comuni

### Non vedo lavori assegnati
- Verifica che ci siano lavori assegnati a te per oggi
- Controlla che il lavoro sia in stato "Assegnato" o "In corso"

### Non posso segnare ore
- Verifica che ci sia un lavoro assegnato a te
- Controlla che il lavoro sia per oggi

### Le mie ore sono state rifiutate
- Controlla il motivo del rifiuto, visibile sulla riga
- Modifica l’ora: torna in attesa da sola
- Se gli orari si sovrappongono a un altro turno, cambia fascia oppure modifica quell’altra riga

### Non ricevo comunicazioni
- Verifica che il caposquadra abbia inviato comunicazioni
- Controlla la sezione Comunicazioni nella dashboard

---

**Hai bisogno di aiuto?** Consulta le [FAQ](02-FAQ.md) o contatta il supporto.

