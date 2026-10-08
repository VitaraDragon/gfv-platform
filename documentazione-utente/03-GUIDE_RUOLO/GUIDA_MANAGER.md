# 📊 Guida Manager - GFV Platform

Guida completa per Manager su come utilizzare tutte le funzionalità di GFV Platform.

## 🎯 Panoramica

Come Manager, puoi:
- ✅ Creare e gestire lavori
- ✅ Gestire terreni e mappa aziendale
- ✅ Visualizzare statistiche e report
- ✅ Gestire squadre e operai
- ✅ Validare ore e calcolare compensi
- ✅ Gestire parco macchine

## 📋 Dashboard Manager

La tua dashboard mostra:

### Sezione Superiore
- **Card Amministrazione**: Statistiche utenti, moduli, piano
- **Card Statistiche**: Link a statistiche dettagliate
- **Card Terreni**: Numero terreni totali
- **Mappa Aziendale**: Visualizzazione completa terreni e lavori

### Sezione Gestione Manodopera
- **Statistiche**: Lavori attivi, ore validate, superficie lavorata, guasti
- **Lavori Recenti**: Ultimi lavori creati
- **Azioni Rapide**: Link a funzionalità principali

### Sezione Diario da Lavori
- Attività generate automaticamente dalle ore validate
- Visualizzazione per data, terreno, tipo lavoro, operai

## 🗺️ Gestione Terreni

### Creare un Nuovo Terreno

1. Vai su **Terreni** (dalla dashboard o menu)
2. Clicca **Nuovo Terreno**
3. Compila i campi:
   - **Nome**: Nome identificativo (es. "Campo Nord")
   - **Podere**: Seleziona podere esistente o crea nuovo
   - **Coltura**: Tipo di coltura (Vite, Frutteto, Seminativo, ecc.)
   - **Superficie**: Ettari (es. 2.5)
   - **Note**: Note aggiuntive (opzionale)
4. **Traccia perimetro sulla mappa**:
   - Clicca sulla mappa per creare punti
   - Trascina punti per spostarli
   - Clicca su punto per eliminarlo
   - Clicca **Salva** quando finito
5. Clicca **Salva Terreno**

### Modificare un Terreno

1. Vai su **Terreni**
2. Clicca sul terreno da modificare
3. Clicca **Modifica**
4. Modifica i campi necessari
5. Clicca **Salva**

### Eliminare un Terreno

⚠️ **Attenzione**: Eliminare un terreno può creare riferimenti orfani se è usato in attività o lavori.

1. Vai su **Terreni**
2. Clicca sul terreno
3. Clicca **Elimina**
4. Conferma l'eliminazione

## 💼 Gestione Lavori

### Creare un Nuovo Lavoro

1. Vai su **Gestione Lavori**
2. Clicca **Nuovo Lavoro**
3. Compila i campi:
   - **Nome**: Nome identificativo (es. "Potatura Vigneto Nord")
   - **Terreno**: Seleziona terreno dal dropdown
   - **Tipo Lavoro**: Seleziona tipo lavoro (es. "Potatura")
   - **Data Inizio**: Data prevista inizio lavoro
   - **Durata Prevista**: Giorni previsti (es. 5)
   - **Tipo Assegnazione**:
     - **A caposquadra**: Assegna a un caposquadra
     - **Diretta a operaio**: Assegna direttamente a un operaio
   - **Caposquadra/Operaio**: Seleziona dal dropdown
   - **Trattore/Attrezzo**: Seleziona se disponibili (opzionale)
   - **Note**: Note aggiuntive (opzionale)
4. Clicca **Salva**

### Tipi di Lavoro

**Lavoro di Squadra** (assegnato a caposquadra):
- Il caposquadra gestisce la squadra
- Può tracciare zone lavorate
- Valida ore degli operai

**Lavoro Autonomo** (assegnato direttamente a operaio):
- L'operaio lavora autonomamente
- Segna direttamente le proprie ore
- Il manager valida le ore

### Ore: correzione dopo la validazione

In **Validazione ore** i contatori in alto sono in ore (sotto, tra parentesi, il numero di righe). La coda mostra anche la pausa e un avviso se due turni dello stesso operaio si sovrappongono.

Il singolo **Valida** non chiede conferma. **Valida selezionate** e **Valida tutte** chiedono una conferma sola.

Sotto la coda ci sono le ore degli **ultimi 30 giorni**, validate e rifiutate, filtrabili per operaio, lavoro e stato. I contatori **Validate** e **Rifiutate** contano quelle stesse righe. **Da validare** resta la tua coda. Su ogni riga si legge chi ha validato, corretto, annullato o rifiutato, con data, ora e motivo. Su ogni riga:

- **Correggi** (anche sulla coda, prima di validare): orari, pausa, note, ore macchina; la riga validata resta validata
- **Annulla validazione**: torna in attesa
- **Rifiuta / togli**: passa a rifiutata con motivo, senza cancellarla

Serve sempre un motivo breve. Se manca, compare «Scrivi il motivo: è obbligatorio.». Dopo il rifiuto leggi «Ora rifiutata». Una riga validata non si elimina: toglierla significa rifiutarla, così resta traccia di chi e quando.

Le ore macchina già contate sul mezzo si aggiornano con la correzione. Se la riga è vecchia e non ha il conteggio salvato, il mezzo non si tocca e compare l’avviso di verificare a mano.

### Stati Lavoro

- **Pianificato**: Creato ma non ancora iniziato
- **Assegnato**: Assegnato a caposquadra/operaio
- **In corso**: Lavoro iniziato
- **Completato**: Lavoro terminato
- **Approvato**: Verificato e approvato

### Modificare un Lavoro

1. Vai su **Gestione Lavori**
2. Clicca sul lavoro
3. Clicca **Modifica**
4. Modifica i campi necessari
5. Clicca **Salva**

### Completare un Lavoro

1. Vai su **Gestione Lavori**
2. Clicca sul lavoro
3. Clicca **Completa Lavoro**
4. Conferma

## 📊 Statistiche e Report

### Statistiche Dashboard

La dashboard mostra in tempo reale:
- **Lavori Attivi**: Numero lavori in corso
- **Ore Validate**: Ore totali validate (mese/totale)
- **Superficie Lavorata**: Ettari lavorati
- **Guasti Segnalati**: Guasti aperti

### Statistiche Dettagliate

1. Vai su **Statistiche** (dalla dashboard)
2. Seleziona **Periodo**: Oggi / Settimana / Mese / Personalizzato
3. Seleziona **Filtri**: Terreno, Tipo Lavoro
4. Visualizza:
   - **Statistiche Lavori**: Totali, attivi, completati, pianificati
   - **Statistiche Ore**: Validate, da validare, media/giorno
   - **Statistiche Squadre**: Totali, attive, operai
   - **Statistiche Superficie**: Lavorata, totale, percentuale

### Report Ore Operai

1. Vai su **Statistiche** → **Report Ore Operai**
2. Seleziona **Periodo**
3. Filtra per **Tipo Operaio** o **Singolo Operaio**
4. Visualizza statistiche aggregate e tabella dettagliata
5. Esporta in Excel se necessario

### Calcolo Compensi

1. Vai su **Compensi Operai**
2. Seleziona **Periodo**
3. Filtra per **Tipo Operaio** o **Singolo Operaio**
4. Visualizza compensi calcolati automaticamente
5. **Esporta Excel**: Genera file Excel professionale con logo

## 👥 Gestione Squadre

### Creare una Squadra

1. Vai su **Gestione Squadre**
2. Clicca **Nuova Squadra**
3. Compila:
   - **Nome Squadra**: Nome identificativo
   - **Caposquadra**: Seleziona caposquadra
   - **Operai**: Seleziona operai da aggiungere
4. Clicca **Salva**

### Modificare una Squadra

1. Vai su **Gestione Squadre**
2. Clicca sulla squadra
3. Clicca **Modifica**
4. Modifica caposquadra o operai
5. Clicca **Salva**

## 🚜 Parco Macchine

### Aggiungere Trattore

1. Vai su **Gestione Macchine**
2. Clicca **Nuovo Trattore**
3. Compila:
   - **Marca/Modello**: Es. "John Deere 6120M"
   - **CV**: Cavalli (es. 120)
   - **Targa**: Targa veicolo
   - **Anno**: Anno di acquisto
   - **Categoria**: Categoria funzionale
   - **Ore Iniziali**: Ore al momento inserimento
   - **Ore Prossima Manutenzione**: Ore per prossima manutenzione
   - **Data Prossima Manutenzione**: Data prossima manutenzione
4. Clicca **Salva**

### Aggiungere Attrezzo

1. Vai su **Gestione Macchine**
2. Clicca **Nuovo Attrezzo**
3. Compila:
   - **Nome**: Nome identificativo
   - **Categoria**: Categoria funzionale
   - **Trattore Compatibile**: CV minimo richiesto
   - **Note**: Note aggiuntive
4. Clicca **Salva**

### Gestire Guasti

1. Vai su **Gestione Guasti**
2. Visualizza lista guasti (aperti e risolti)
3. Filtra per stato, gravità, macchina
4. Per ogni guasto:
   - **Approva Continuazione**: Se non grave, permette continuazione lavoro
   - **Sospendi Lavoro**: Sospende lavoro associato
   - **Risolvi Guasto**: Marca guasto come risolto
   - **Riapri**: Riapre guasto risolto

## 🗺️ Mappa Aziendale

### Visualizzazione Mappa

La mappa mostra:
- **Terreni**: Poligoni colorati per coltura
- **Zone Lavorate**: Overlay verde semi-trasparente
- **Indicatori Lavori**: Marker colorati per stato progresso
  - 🔴 Rosso: In ritardo
  - 🟡 Giallo: In tempo
  - 🟢 Verde: In anticipo
  - 🔵 Blu: In corso

### Filtri Mappa

- **Filtro Podere**: Mostra solo terreni di un podere
- **Filtro Coltura**: Mostra solo terreni di una coltura
- **Toggle Zone Lavorate**: Mostra/nasconde zone lavorate
- **Toggle Indicatori Lavori**: Mostra/nasconde indicatori lavori

### Click su Terreno

Cliccando su un terreno vedi:
- Nome terreno
- Podere
- Coltura
- Superficie
- Note
- Link a dettagli terreno

### Click su Indicatore Lavoro

Cliccando su un indicatore vedi:
- Nome lavoro
- Terreno
- Tipo lavoro
- Stato
- Progresso (in ritardo/in tempo/in anticipo)
- Percentuale completamento
- Superficie lavorata
- Date e durata

## ⚡ Azioni Rapide

### Dashboard

- **Nuovo Lavoro**: Clicca su "Nuovo Lavoro" nella sezione Gestione Manodopera
- **Statistiche**: Clicca sulla card Statistiche
- **Gestione Utenti**: Clicca su "Invita Collaboratore" nell'header
- **Mappa**: Visualizza direttamente nella dashboard

### Menu Impostazioni

- **Azienda**: Configura dati azienda
- **Poderi**: Gestisci poderi
- **Liste**: Gestisci liste personalizzate (tipi lavoro, colture)
- **Tariffe Operai**: Configura tariffe default
- **Account**: Modifica dati account
- **Password**: Cambia password

## 💡 Suggerimenti

1. **Usa la mappa**: La mappa aziendale ti dà una visione completa dei lavori
2. **Monitora statistiche**: Controlla regolarmente statistiche per ottimizzare risorse
3. **Valida ore tempestivamente**: Valida le ore degli operai per mantenere dati aggiornati
4. **Usa filtri**: I filtri ti aiutano a trovare rapidamente quello che cerchi
5. **Esporta report**: Esporta report Excel per analisi approfondite

## ❓ Problemi Comuni

### Non vedo alcuni lavori
- Controlla i filtri attivi
- Verifica che i lavori siano assegnati correttamente

### Le statistiche non si aggiornano
- Ricarica la pagina
- Verifica che i dati siano stati salvati

### La mappa non si carica
- Controlla connessione internet
- Verifica configurazione Google Maps API

---

**Hai bisogno di aiuto?** Consulta le [FAQ](02-FAQ.md) o contatta il supporto.

