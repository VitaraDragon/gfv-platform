# 👷 Guida Caposquadra - GFV Platform

Guida completa per Caposquadra su come utilizzare tutte le funzionalità di GFV Platform.

## 🎯 Panoramica

Come Caposquadra, puoi:
- ✅ Visualizzare lavori assegnati a te
- ✅ Gestire la tua squadra
- ✅ Comunicare con gli operai
- ✅ Tracciare zone lavorate sulla mappa
- ✅ Validare ore degli operai
- ✅ Aggiornare avanzamento lavori

## 📋 Dashboard Caposquadra

La tua dashboard mostra:

### Sezione Statistiche Squadra
- **Lavori Attivi**: Lavori assegnati in corso
- **Operai in Squadra**: Numero operai nella tua squadra
- **Ore da Validare**: Ore in attesa di validazione
- **Comunicazioni Inviate**: Comunicazioni inviate alla squadra

### Sezione Comunicazione Rapida
- Form per inviare comunicazioni rapide alla squadra
- Pre-compilazione automatica podere/campo/lavoro
- Invio con un click

### Sezione Azioni Rapide
- Link a funzionalità principali
- Accesso rapido a lavori, validazione ore, squadra

### Sezione Lavori Recenti
- Ultimi lavori assegnati a te
- Stato e avanzamento di ogni lavoro

## 💼 Gestione Lavori

### Visualizzare Lavori Assegnati

1. Vai su **Lavori Caposquadra**
2. Visualizza lista lavori assegnati a te
3. Filtra per stato (Assegnato, In corso, Completato)
4. Clicca su un lavoro per vedere dettagli

### Dettagli Lavoro

Per ogni lavoro vedi:
- **Nome**: Nome identificativo
- **Terreno**: Terreno associato
- **Tipo Lavoro**: Tipo di lavoro da eseguire
- **Data Inizio**: Data prevista inizio
- **Durata Prevista**: Giorni previsti
- **Stato**: Stato attuale del lavoro
- **Avanzamento**: Percentuale completamento
- **Operai Assegnati**: Operai della tua squadra assegnati

### Iniziare un Lavoro

1. Vai su **Lavori Caposquadra**
2. Clicca sul lavoro
3. Clicca **Inizia Lavoro**
4. Il lavoro passa a stato "In corso"

### Tracciare Zone Lavorate

1. Vai su **Lavori Caposquadra**
2. Clicca sul lavoro
3. Clicca **Traccia Zone Lavorate**
4. Sulla mappa:
   - Clicca per creare punti del poligono
   - Trascina punti per spostarli
   - Clicca su punto per eliminarlo
   - Clicca **Salva Zona** quando finito
5. Ripeti per altre zone
6. Clicca **Fine Tracciamento** quando completato

**Suggerimento**: Traccia le zone man mano che lavori per avere dati precisi.

### Aggiornare Avanzamento Lavoro

1. Vai su **Lavori Caposquadra**
2. Clicca sul lavoro
3. Aggiorna **Percentuale Completamento** (0-100%)
4. Il sistema calcola automaticamente:
   - Superficie lavorata totale
   - Giorni effettivi trascorsi
   - Stato progresso (in ritardo/in tempo/in anticipo)

### Completare un Lavoro

1. Vai su **Lavori Caposquadra**
2. Clicca sul lavoro
3. Assicurati che tutte le zone siano tracciate
4. Imposta **Percentuale Completamento** a 100%
5. Clicca **Completa Lavoro**
6. Il lavoro passa a stato "Completato"

## 👥 Gestione Squadra

### Visualizzare Squadra

1. Vai su **Gestione Squadre**
2. Visualizza lista operai nella tua squadra
3. Per ogni operaio vedi:
   - Nome e contatti
   - Tipo operaio
   - Stato (online/offline)
   - Ultimo accesso

### Contatti Squadra

Nella sezione squadra vedi:
- **Email**: Clicca per inviare email
- **Cellulare**: Clicca per chiamare

## 📢 Comunicazioni Squadra

### Inviare Comunicazione Rapida

1. Nella dashboard, sezione **Comunicazione Rapida**
2. I campi sono pre-compilati automaticamente:
   - **Podere**: Dal primo lavoro attivo
   - **Campo**: Dal primo lavoro attivo
   - **Lavoro**: Dal primo lavoro attivo (se più lavori, seleziona dal dropdown)
3. Compila solo:
   - **Orario**: Orario di ritrovo (default 7:00)
   - **Note**: Eventuali note o istruzioni
4. Clicca **Invia Comunicazione**

Gli operai riceveranno la comunicazione nella loro dashboard.

### Inviare Comunicazione Completa

1. Vai su **Impostazioni** → **Comunicazioni Squadra**
2. Clicca **Nuova Comunicazione**
3. Compila tutti i campi:
   - **Podere**: Seleziona podere
   - **Terreno**: Seleziona terreno
   - **Lavoro**: Seleziona lavoro (opzionale)
   - **Data**: Data comunicazione
   - **Orario**: Orario di ritrovo
   - **Note**: Note dettagliate
4. Clicca **Invia**

### Visualizzare Comunicazioni Inviate

1. Vai su **Impostazioni** → **Comunicazioni Squadra**
2. Visualizza lista comunicazioni inviate
3. Per ogni comunicazione vedi:
   - Dettagli (podere, campo, data, orario)
   - **Conferme**: Numero operai che hanno confermato
   - **Lista Operai**: Chi ha confermato e chi no

## ⏰ Validazione Ore

### Visualizzare Ore da Validare

1. Vai su **Validazione Ore**
2. Visualizza lista ore segnate dagli operai
3. Filtra per:
   - **Lavoro**: Seleziona lavoro specifico
   - **Operaio**: Seleziona operaio specifico
   - **Stato**: Da validare / Validate / Rifiutate

### Validare Ore

1. Vai su **Validazione Ore**
2. Trova l'ora da validare
3. Clicca per vedere dettagli:
   - **Operaio**: Nome operaio
   - **Lavoro**: Lavoro associato
   - **Data**: Data lavoro
   - **Orario Inizio/Fine**: Orari segnati
   - **Pause**: Pause segnate
   - **Ore Totali**: Ore calcolate
   - **Note**: Note aggiunte dall'operaio
4. Scegli azione:
   - **Approva**: Approva l'ora
   - **Rifiuta**: Rifiuta l'ora (aggiungi motivo)
5. Aggiungi note se necessario
6. Conferma

### Rifiutare Ore

Se rifiuti un'ora:
1. Clicca **Rifiuta**
2. Aggiungi **Motivo Rifiuto** (obbligatorio)
3. L'operaio vedrà il motivo nella sua dashboard
4. L'operaio può modificare e rispedire l'ora

### Approvare Multiple Ore

1. Vai su **Validazione Ore**
2. Seleziona multiple ore (checkbox)
3. Clicca **Approva Selezionate**
4. Conferma

## 📊 Statistiche Squadra

### Visualizzare Statistiche

1. Nella dashboard, sezione **Statistiche Squadra**
2. Visualizza:
   - **Lavori Attivi**: Lavori in corso
   - **Operai in Squadra**: Numero operai
   - **Ore da Validare**: Ore in attesa
   - **Comunicazioni Inviate**: Comunicazioni inviate oggi

### Statistiche Dettagliate

1. Vai su **Statistiche** (se disponibile)
2. Visualizza statistiche della tua squadra:
   - Ore totali lavorate
   - Media ore per operaio
   - Lavori completati
   - Superficie lavorata

## 🗺️ Mappa Lavori

### Visualizzare Mappa Lavori

1. Vai su **Lavori Caposquadra**
2. Clicca su un lavoro
3. Visualizza mappa con:
   - **Terreno**: Confini terreno
   - **Zone Lavorate**: Zone già tracciate (verde)
   - **Zone da Lavorare**: Area ancora da lavorare

### Tracciare Zone sulla Mappa

Vedi sezione "Tracciare Zone Lavorate" sopra.

## ⚡ Azioni Rapide

### Dashboard

- **Comunicazione Rapida**: Invia comunicazione con un click
- **Validazione Ore**: Vai direttamente a validazione ore
- **Lavori**: Vai ai lavori assegnati
- **Squadra**: Vai alla gestione squadra

### Menu Impostazioni

- **Comunicazioni Squadra**: Gestisci comunicazioni complete
- **Account**: Modifica dati account
- **Password**: Cambia password

## 💡 Suggerimenti

1. **Comunica regolarmente**: Invia comunicazioni ogni mattina per coordinare la squadra
2. **Valida tempestivamente**: Valida le ore degli operai ogni giorno
3. **Traccia zone man mano**: Traccia le zone lavorate durante il lavoro, non alla fine
4. **Aggiorna avanzamento**: Aggiorna regolarmente la percentuale completamento
5. **Usa note**: Aggiungi note quando rifiuti ore per aiutare gli operai

## ❓ Problemi Comuni

### Non vedo lavori assegnati
- Verifica che i lavori siano stati assegnati a te dal manager
- Controlla i filtri attivi

### Non posso validare ore
- Verifica che le ore siano state segnate dagli operai
- Controlla che non siano già state validate

### La mappa non si carica
- Controlla connessione internet
- Verifica che il terreno abbia coordinate mappa

---

**Hai bisogno di aiuto?** Consulta le [FAQ](02-FAQ.md) o contatta il supporto.

