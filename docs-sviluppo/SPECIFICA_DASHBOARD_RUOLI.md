# 📊 Specifica Dashboard per Ruolo - GFV Platform

**Data creazione**: 2025-01-13  
**Versione**: 1.0  
**Stato**: Definizione completa

---

## 🎯 Obiettivo

Questo documento definisce **esattamente** cosa vede ogni ruolo nella dashboard principale, includendo:
- Statistiche da visualizzare
- Azioni rapide disponibili
- Sezioni/widget da mostrare
- Filtri e permessi applicati
- Comportamento con moduli avanzati

---

## 📋 Struttura Generale Dashboard

### Componenti Comuni (Tutti i Ruoli)

**Header Dashboard** (sempre visibile):
- Logo/Nome app "GFV Platform"
- Info utente: Nome completo + Email
- Badge ruoli (es: 👑 Amministratore, 📊 Manager)
- Pulsante "⚙️ Impostazioni" (link a `admin/impostazioni-standalone.html`)
- Pulsante "Logout"

**Sezione Core Base** (sempre visibile per tutti):
- Card "Terreni" → link a `terreni-standalone.html`
- Card "Diario Attività" → link a `attivita-standalone.html`
- Card "Statistiche" → link a `statistiche-standalone.html`
- Card "Abbonamento" → link a `admin/abbonamento-standalone.html` (solo se amministratore)
- Card "Impostazioni" → link a `admin/impostazioni-standalone.html` (solo se amministratore, opzionale, può essere solo nell'header)

---

## 👑 AMMINISTRATORE

### Quando Mostrare
- **Visibilità condizionale** basata sul modulo Manodopera:
  - **Se modulo Manodopera è attivo**: Mostra sezione completa "Amministrazione" con gestione utenti, squadre e ruoli
  - **Se modulo Manodopera NON è attivo** (Core Base solo): Mostra solo Core Base (terreni, attività, statistiche, abbonamento, impostazioni)
- **Anche con solo Core Base** (non richiede moduli avanzati)
- **Priorità massima**: sezione sempre in cima quando presente

### Logica Condizionale
**Motivazione**: 
- Per aziende piccole dove solo il proprietario lavora, non serve gestione utenti/squadre/ruoli
- La gestione utenti e squadre ha senso solo quando c'è bisogno di gestire dipendenti (modulo Manodopera)
- Nel Core Base, l'amministratore gestisce solo: terreni, attività, statistiche, abbonamento, impostazioni

**Implementazione**:
- Verifica modulo attivo: `tenants/{tenantId}.modules` contiene `'manodopera'` (o `'lavori'`)
- Se modulo Manodopera attivo: mostra sezione Amministrazione completa
- Se modulo Manodopera NON attivo: mostra solo Core Base (senza sezione Amministrazione)

### Sezione 1: Statistiche Aziendali

**Card Statistiche** (grid 3 colonne):

1. **Utenti Totali**
   - **Valore**: Conteggio totale utenti del tenant
   - **Query**: `users` collection, filtro `tenantId == currentTenantId`
   - **Formato**: Numero intero (es: "12")
   - **Icona**: 👥
   - **Colore**: Verde

2. **Moduli Attivi**
   - **Valore**: Numero moduli attivi nel tenant
   - **Query**: `tenants/{tenantId}`, campo `modules` (array)
   - **Formato**: Numero moduli (es: "3 moduli") o "Solo Core" se nessun modulo avanzato
   - **Icona**: 📦
   - **Colore**: Blu

3. **Piano Abbonamento**
   - **Valore**: Nome piano corrente
   - **Query**: `tenants/{tenantId}`, campo `piano`
   - **Formato**: "Starter" / "Professional" / "Enterprise"
   - **Icona**: 💳
   - **Colore**: Oro

**Dettagli Implementazione**:
- Caricare dati da Firestore al caricamento dashboard
- Mostrare "-" durante caricamento
- Gestire errori con messaggio "Errore caricamento"

### Sezione 2: Azioni Rapide Amministrazione

**Grid Azioni** (4 colonne desktop, responsive):

**Visibile solo se**: Modulo Manodopera è attivo (`modules.includes('manodopera')`)

1. **Gestisci Utenti**
   - **Link**: `admin/gestisci-utenti-standalone.html`
   - **Icona**: 👥
   - **Descrizione**: "Invita e gestisci utenti azienda"
   - **Visibile solo se**: Modulo Manodopera attivo
   - **Nota**: Permette di gestire utenti e assegnare ruoli (operai, caposquadra, manager)

2. **Gestione Squadre**
   - **Link**: `admin/gestione-squadre-standalone.html`
   - **Icona**: 👷
   - **Descrizione**: "Crea e gestisci squadre di lavoro"
   - **Visibile solo se**: Modulo Manodopera attivo

3. **Abbonamento**
   - **Link**: `admin/abbonamento-standalone.html`
   - **Icona**: 💳
   - **Descrizione**: "Gestisci piano e moduli"
   - **Sempre visibile**: Sì (anche nel Core Base, nell'header o Core Base section)

4. **Impostazioni**
   - **Link**: `admin/impostazioni-standalone.html`
   - **Icona**: ⚙️
   - **Descrizione**: "Configura azienda e account"
   - **Sempre visibile**: Sì (anche nel Core Base, nell'header)

5. **Report Completi** (solo con moduli avanzati)
   - **Link**: `admin/report-standalone.html`
   - **Icona**: 📊
   - **Descrizione**: "Visualizza tutte le statistiche"
   - **Visibile solo se**: `hasAdvancedModules == true`

### Sezione 3: Core Base

**Sempre visibile** (vedi sezione "Componenti Comuni")

### Sezione 4: Alert e Notifiche (Futuro)

**Widget Alert** (opzionale, futuro):
- Scadenze abbonamento
- Inviti pendenti
- Utenti da attivare
- Moduli disponibili non attivati

---

## 📊 MANAGER

### Quando Mostrare
- **Visibile** se utente ha ruolo `manager`
- **Adattivo ai moduli**: mostra contenuto diverso se Core Only vs Moduli Avanzati
- **Priorità**: dopo Amministratore (se presente)

### Sezione 1: Statistiche Operative

**Card Statistiche** (grid 3-4 colonne, dipende da moduli):

#### Se Solo Core Base:

1. **Terreni Totali**
   - **Valore**: Conteggio terreni del tenant
   - **Query**: `tenants/{tenantId}/terreni` collection
   - **Formato**: Numero intero (es: "25")
   - **Icona**: 🗺️
   - **Colore**: Verde

2. **Attività Questo Mese**
   - **Valore**: Conteggio attività del mese corrente
   - **Query**: `tenants/{tenantId}/attivita`, filtro `data >= primoGiornoMese AND data <= oggi`
   - **Formato**: Numero intero (es: "48")
   - **Icona**: 📝
   - **Colore**: Blu

3. **Ore Questo Mese**
   - **Valore**: Somma ore nette del mese corrente
   - **Query**: Stessa query attività, somma campo `oreNette`
   - **Formato**: "Xh Ymin" (es: "320h 45min")
   - **Icona**: ⏱️
   - **Colore**: Arancione

#### Con Moduli Avanzati (aggiunge):

4. **Clienti Totali**
   - **Valore**: Conteggio clienti del tenant
   - **Query**: `tenants/{tenantId}/clienti` collection
   - **Formato**: Numero intero (es: "15")
   - **Icona**: 👥
   - **Colore**: Viola

5. **Lavori Attivi**
   - **Valore**: Conteggio lavori in corso
   - **Query**: `tenants/{tenantId}/lavori`, filtro `stato == "in_corso"`
   - **Formato**: Numero intero (es: "8")
   - **Icona**: 📋
   - **Colore**: Rosso

6. **Squadre Attive**
   - **Valore**: Conteggio squadre con lavori assegnati
   - **Query**: `tenants/{tenantId}/squadre`, filtro con lavori attivi
   - **Formato**: Numero intero (es: "3")
   - **Icona**: 👷
   - **Colore**: Verde scuro

### Sezione 2: Azioni Rapide Operative

**Grid Azioni** (responsive, 3-4 colonne):

#### Se Solo Core Base:

1. **Terreni**
   - **Link**: `terreni-standalone.html`
   - **Icona**: 🗺️
   - **Descrizione**: "Gestisci terreni e vigneti"

2. **Diario Attività**
   - **Link**: `attivita-standalone.html`
   - **Icona**: 📝
   - **Descrizione**: "Registra attività lavorative"

3. **Statistiche**
   - **Link**: `statistiche-standalone.html`
   - **Icona**: 📊
   - **Descrizione**: "Visualizza statistiche e grafici"

#### Con Moduli Avanzati (aggiunge):

4. **Clienti**
   - **Link**: `modules/clienti/clienti-standalone.html` (futuro)
   - **Icona**: 👥
   - **Descrizione**: "Gestisci anagrafica clienti"

5. **Calcolatore Vendemmia**
   - **Link**: `modules/vendemmia/calcolatore-standalone.html` (futuro)
   - **Icona**: 🍇
   - **Descrizione**: "Crea calcoli e preventivi"

6. **Lavori**
   - **Link**: `modules/lavori/lavori-standalone.html` (futuro)
   - **Icona**: 📋
   - **Descrizione**: "Assegna e gestisci lavori"

7. **Bilancio**
   - **Link**: `modules/bilancio/bilancio-standalone.html` (futuro)
   - **Icona**: 💰
   - **Descrizione**: "Gestisci entrate e uscite"

### Sezione 3: Attività Recenti

**Widget Lista Attività** (solo con Core Base):
- **Titolo**: "Attività Recenti"
- **Query**: `tenants/{tenantId}/attivita`, ordinato per `data DESC`, limite 5
- **Campi mostrati**:
  - Data attività
  - Terreno (nome)
  - Tipo lavoro
  - Ore nette
- **Formato**: Lista con link a dettaglio attività
- **Se nessuna attività**: Mostra "Nessuna attività recente"

### Sezione 4: Lavori in Corso (solo con moduli avanzati)

**Widget Lavori** (solo se `hasAdvancedModules == true`):
- **Titolo**: "Lavori in Corso"
- **Query**: `tenants/{tenantId}/lavori`, filtro `stato == "in_corso"`, ordinato per `priorita DESC`, limite 5
- **Campi mostrati**:
  - Nome lavoro
  - Terreno
  - Caposquadra assegnato
  - Data inizio
  - Priorità
- **Formato**: Lista con badge priorità
- **Se nessun lavoro**: Mostra "Nessun lavoro in corso"

### Sezione 5: Monitoraggio Progressi Lavori (solo con moduli avanzati)

**Widget Progressi in Tempo Reale** (solo se `hasAdvancedModules == true`):
- **Titolo**: "Monitoraggio Progressi Lavori"
- **Query**: `tenants/{tenantId}/lavori`, filtro `stato == "in_corso"`, ordinato per `priorita DESC`
- **Campi mostrati per ogni lavoro**:
  - Nome lavoro
  - Terreno (con link a mappa)
  - Caposquadra assegnato
  - Superficie totale terreno (ha)
  - Superficie lavorata finora (ha) - calcolata da zone tracciate dal caposquadra
  - Superficie rimanente (ha)
  - Percentuale completamento (%) - con progress bar
  - Durata prevista (giorni) vs durata effettiva (giorni)
  - Stato: "🟢 In anticipo" / "🟡 In tempo" / "🔴 In ritardo"
  - Ultimo aggiornamento (quando caposquadra ha tracciato ultima zona)
- **Formato**: Card con:
  - Progress bar visiva
  - Mappa interattiva con zone lavorate evidenziate
  - Grafico andamento (superficie lavorata nel tempo)
  - Alert se lavoro in ritardo
- **Aggiornamento**: Tempo reale (quando caposquadra traccia zone lavorate)
- **Azioni disponibili**:
  - Visualizza dettaglio lavoro
  - Visualizza mappa con zone lavorate
  - Contatta caposquadra
  - Modifica priorità/scadenze

**Vantaggi per Manager**:
- Visione completa in tempo reale di tutti i lavori
- Può intervenire tempestivamente se c'è ritardo
- Tracciamento preciso sulla mappa
- Calcolo automatico progressi
- Alert automatici per lavori in ritardo

---

## 👷 CAPOSQUADRA

### Quando Mostrare
- **Visibile** se utente ha ruolo `caposquadra`
- **Dati filtrati**: solo lavori assegnati a lui e sua squadra
- **Priorità**: dopo Manager (se presente)

### Funzionalità Principali

**Il Caposquadra deve poter fare**:
1. **Vidimare/Validare le ore** che segna ogni operaio della sua squadra
2. **Vedere componenti squadra**: nome, cognome, cellulare di ogni operaio
3. **Vedere lavori assegnati**: lavoro e terreno assegnati dal manager
4. **Tracciare zone lavorate**: ogni giorno traccia sulla mappa la zona lavorata (sistema zone escluse vendemmia, ma al contrario)
5. **Mostrare progressi al manager**: il manager vede in tempo reale quanto lavoro è stato fatto

### Sistema Tracciamento Zone Lavorate

**Concetto**: Stesso sistema delle "zone escluse" della vecchia app, ma al contrario
- **Zone escluse**: tracciava zone NON lavorate → calcolava superficie esclusa
- **Zone lavorate**: traccia zone LAVORATE → calcola superficie lavorata

**Come funziona**:
1. Manager assegna lavoro: "Potatura Campo A - 3 giorni previsti"
2. Caposquadra ogni giorno traccia sulla mappa la zona lavorata quel giorno
3. Sistema calcola automaticamente:
   - Superficie lavorata oggi (ha)
   - Superficie totale lavorata (somma di tutti i giorni)
   - Superficie rimanente (totale terreno - totale lavorata)
   - Percentuale completamento
4. Manager vede in tempo reale:
   - Quanto è stato fatto
   - Quanto rimane da fare
   - Se è in ritardo/anticipo rispetto ai 3 giorni previsti

**Vantaggi**:
- Manager ha visione completa in tempo reale
- Può intervenire tempestivamente se c'è ritardo
- Tracciamento preciso sulla mappa (come zone escluse)
- Calcolo automatico superficie

### Sezione 1: Statistiche Squadra

**Card Statistiche** (grid 3 colonne):

1. **Lavori Assegnati**
   - **Valore**: Conteggio lavori assegnati a lui
   - **Query**: `tenants/{tenantId}/lavori`, filtro `caposquadraId == currentUserId AND stato == "in_corso"`
   - **Formato**: Numero intero (es: "5")
   - **Icona**: 📋
   - **Colore**: Blu

2. **Ore da Validare**
   - **Valore**: Conteggio ore pendenti di validazione (della sua squadra)
   - **Query**: `tenants/{tenantId}/ore`, filtro `caposquadraId == currentUserId AND stato == "da_validare"`
   - **Formato**: Numero intero (es: "12")
   - **Icona**: ✅
   - **Colore**: Arancione

3. **Dimensione Squadra**
   - **Valore**: Numero operai nella sua squadra
   - **Query**: `tenants/{tenantId}/squadre`, filtro `caposquadraId == currentUserId`, conta operai
   - **Formato**: Numero intero (es: "8")
   - **Icona**: 👥
   - **Colore**: Verde

### Sezione 2: Azioni Rapide

**Grid Azioni** (3 colonne):

1. **I Miei Lavori**
   - **Link**: `modules/lavori/miei-lavori-standalone.html`
   - **Icona**: 📋
   - **Descrizione**: "Visualizza lavori assegnati con terreno"
   - **Funzionalità**: Lista lavori assegnati dal manager, con terreno associato

2. **Valida Ore**
   - **Link**: `modules/lavori/valida-ore-standalone.html`
   - **Icona**: ✅
   - **Descrizione**: "Valida ore degli operai della squadra"
   - **Funzionalità**: Lista ore da validare, con azioni "Valida" / "Rifiuta"

3. **La Mia Squadra**
   - **Link**: `modules/lavori/mia-squadra-standalone.html`
   - **Icona**: 👥
   - **Descrizione**: "Vedi componenti squadra (nome, cognome, cellulare)"
   - **Funzionalità**: Lista operai con contatti

4. **Traccia Zone Lavorate** (NUOVO)
   - **Link**: `modules/lavori/traccia-zone-lavorate-standalone.html`
   - **Icona**: 🗺️
   - **Descrizione**: "Traccia zone lavorate ogni giorno sulla mappa"
   - **Funzionalità**: 
     - Apri mappa terreno
     - Traccia poligono zona lavorata oggi
     - Calcolo automatico superficie
     - Salvataggio con data
     - Visualizzazione progressi

### Sezione 3: Lavori Assegnati

**Widget Lista Lavori**:
- **Titolo**: "I Miei Lavori Assegnati"
- **Query**: `tenants/{tenantId}/lavori`, filtro `caposquadraId == currentUserId`, ordinato per `dataInizio DESC`
- **Campi mostrati**:
  - Nome lavoro
  - Terreno (con link a mappa)
  - Data inizio prevista
  - Durata prevista (giorni)
  - Progresso (% completamento)
  - Stato (in corso, completato, sospeso)
  - Priorità
- **Formato**: Lista con badge stato, progress bar, link a tracciamento zone
- **Se nessun lavoro**: Mostra "Nessun lavoro assegnato"

### Sezione 4: Ore da Validare

**Widget Ore Pendenti**:
- **Titolo**: "Ore da Validare"
- **Query**: `tenants/{tenantId}/ore`, filtro `caposquadraId == currentUserId AND stato == "da_validare"`, ordinato per `data DESC`, limite 20
- **Campi mostrati**:
  - Nome operaio
  - Cognome operaio
  - Data lavoro
  - Terreno
  - Tipo lavoro
  - Ore segnate (formato: "Xh Ymin")
  - Note (se presenti)
  - Azioni: "✅ Valida" / "❌ Rifiuta"
- **Formato**: Tabella con azioni rapide
- **Se nessuna ora**: Mostra "Nessuna ora da validare"

### Sezione 5: La Mia Squadra

**Widget Componenti Squadra**:
- **Titolo**: "Componenti della Mia Squadra"
- **Query**: `tenants/{tenantId}/squadre`, filtro `caposquadraId == currentUserId`, espandi operai
- **Campi mostrati**:
  - Nome
  - Cognome
  - Cellulare (con link chiamata)
  - Ruolo (sempre "operaio")
  - Stato (attivo/inattivo)
- **Formato**: Lista con card, mobile-friendly
- **Se nessun operaio**: Mostra "Nessun operaio nella squadra"

### Sezione 6: Progressi Lavori (per Manager)

**Widget Progressi** (visibile anche al Manager):
- **Titolo**: "Progressi Lavori"
- **Query**: `tenants/{tenantId}/lavori`, filtro `caposquadraId == currentUserId AND stato == "in_corso"`
- **Campi mostrati per ogni lavoro**:
  - Nome lavoro
  - Terreno
  - Superficie totale terreno (ha)
  - Superficie lavorata finora (ha) - calcolata da zone tracciate
  - Superficie rimanente (ha)
  - Percentuale completamento (%)
  - Giorni previsti vs giorni effettivi
  - Stato: "In anticipo" / "In tempo" / "In ritardo"
- **Formato**: Card con progress bar, mappa interattiva, grafici
- **Aggiornamento**: Tempo reale (quando caposquadra traccia zone)

**Nota**: Questo widget è visibile anche al Manager per monitoraggio in tempo reale

---

## 🔧 OPERAIO

### Quando Mostrare
- **Visibile** se utente ha ruolo `operaio`
- **Dati filtrati**: solo suoi dati personali, solo lavori di oggi
- **Priorità**: ultima (dopo tutti gli altri ruoli)
- **Mobile-first**: interfaccia ottimizzata per mobile
- **Semplicità**: interfaccia minimale, solo funzionalità essenziali

### Funzionalità Principali

**L'Operaio deve poter fare SOLO**:
1. Vedere le sue statistiche base personali
2. Segnare le sue ore lavorate (con calcolo automatico come nel Diario Attività)

**NON può**:
- Vedere ore di altri operai
- Vedere lavori futuri o passati (solo oggi)
- Tracciare zone lavorate (lo fa il caposquadra)
- Validare ore (lo fa il caposquadra)

### Sezione 1: Statistiche Personali Base

**Card Statistiche** (grid 3 colonne, mobile: 1 colonna):

1. **Lavori Oggi**
   - **Valore**: Conteggio lavori assegnati per oggi
   - **Query**: `tenants/{tenantId}/lavori`, filtro `operaioId == currentUserId AND data == oggi`
   - **Formato**: Numero intero (es: "2")
   - **Icona**: 📋
   - **Colore**: Blu

2. **Ore Segnate Oggi**
   - **Valore**: Somma ore segnate oggi
   - **Query**: `tenants/{tenantId}/ore`, filtro `operaioId == currentUserId AND data == oggi`
   - **Formato**: "Xh Ymin" (es: "6h 30min")
   - **Icona**: ⏱️
   - **Colore**: Verde

3. **Stato Validazione**
   - **Valore**: Stato validazione ore di oggi
   - **Query**: `tenants/{tenantId}/ore`, filtro `operaioId == currentUserId AND data == oggi`
   - **Formato**: "Da validare" / "Validate" / "Rifiutate" / "Nessuna ora"
   - **Icona**: ✅
   - **Colore**: Dinamico (giallo=da validare, verde=validate, rosso=rifiutate)

### Sezione 2: Azione Principale - Segna Ore

**Card Grande Evidenziata** (mobile: full width):

**Segna Ore**
- **Link**: `modules/lavori/segna-ore-standalone.html`
- **Icona**: ⏱️ (grande)
- **Descrizione**: "Registra inizio/fine lavoro con calcolo automatico"
- **Funzionalità**:
  - Form identico al Diario Attività esistente
  - Selezione lavoro assegnato (solo lavori di oggi)
  - Orario inizio/fine
  - Pause (minuti)
  - Calcolo automatico ore nette: `(orarioFine - orarioInizio) - pauseMinuti`
  - Formato ore: "Xh Ymin" (come già implementato)
  - Salvataggio con stato "da_validare"
  - Solo i suoi dati, solo oggi

**Nota**: Usa lo stesso sistema di calcolo automatico già implementato in `attivita-standalone.html`

### Sezione 3: Lavori di Oggi (Opzionale)

**Widget Lista Lavori Oggi** (semplificato):
- **Titolo**: "I Miei Lavori di Oggi"
- **Query**: `tenants/{tenantId}/lavori`, filtro `operaioId == currentUserId AND data == oggi`, ordinato per `orarioInizio ASC`
- **Campi mostrati**:
  - Nome lavoro
  - Terreno/vigneto
  - Tipo lavoro
  - Orario previsto
- **Formato**: Lista semplice, mobile-friendly
- **Se nessun lavoro**: Mostra "Nessun lavoro assegnato per oggi"

**Nota Importante**: 
- **NON mostra** lavori futuri o passati
- **Solo oggi** (data corrente)
- Vista semplificata, senza dettagli complessi

---

## 🔄 GESTIONE RUOLI MULTIPLI

### Regole di Visualizzazione

**Se utente ha più ruoli** (es: `["amministratore", "manager"]`):

1. **Unione Sezioni**: Mostra tutte le sezioni corrispondenti ai ruoli
2. **Ordine Priorità**: 
   - Amministratore (prima)
   - Manager (seconda)
   - Caposquadra (terza)
   - Operaio (ultima)
3. **Evitare Duplicati**: 
   - Sezione Core Base mostrata **una sola volta** (non duplicata)
   - Azioni rapide duplicate vengono mostrate una volta sola
4. **Statistiche Aggregate**: 
   - Se due ruoli hanno statistiche simili, possono essere aggregate o separate
   - Esempio: Manager + Caposquadra → mostra statistiche manager + statistiche squadra

### Esempi Pratici

**Esempio 1**: Utente con `["amministratore", "manager"]`
- Mostra: Sezione Amministratore + Sezione Manager + Core Base (una volta)
- Non mostra: Sezione Caposquadra, Sezione Operaio

**Esempio 2**: Utente con `["manager", "caposquadra"]`
- Mostra: Sezione Manager + Sezione Caposquadra + Core Base (una volta)
- Non mostra: Sezione Amministratore, Sezione Operaio

**Esempio 3**: Utente con `["caposquadra", "operaio"]`
- Mostra: Sezione Caposquadra + Sezione Operaio + Core Base (una volta)
- Nota: Operaio vede solo suoi dati, Caposquadra vede dati squadra

---

## 📦 ADATTAMENTO AI MODULI

### Logica Moduli Disponibili

**Core Base** (sempre disponibile):
- Terreni
- Attività
- Statistiche
- Liste Personalizzate

**Moduli Avanzati** (pay-per-use):
- Clienti
- Vendemmia
- Lavori/Manodopera
- Bilancio
- Magazzino (futuro)
- Altri moduli futuri

### Comportamento Dashboard

**Se Solo Core Base** (`hasOnlyCoreModules == true`):
- Mostra solo funzionalità core
- Nasconde riferimenti a moduli avanzati
- Mostra placeholder o messaggi informativi se necessario

**Se Moduli Avanzati Disponibili** (`hasAdvancedModules == true`):
- Mostra tutte le funzionalità disponibili
- Aggiunge statistiche e azioni rapide per moduli avanzati
- Mostra widget specifici per moduli

### Esempio Manager

**Solo Core**:
- Statistiche: Terreni, Attività mese, Ore mese
- Azioni: Terreni, Diario Attività, Statistiche

**Con Moduli**:
- Statistiche: + Clienti, Lavori attivi, Squadre
- Azioni: + Clienti, Vendemmia, Lavori, Bilancio
- Widget: + Lavori in corso

---

## 🎨 PRIORITÀ VISIVA E UX

### Ordine Sezioni (Top to Bottom)

1. **Header** (sempre in cima)
2. **Sezione Amministratore** (se presente)
3. **Sezione Manager** (se presente)
4. **Sezione Caposquadra** (se presente)
5. **Sezione Operaio** (se presente)
6. **Sezione Core Base** (sempre visibile, ma può essere integrata nelle sezioni ruolo)

### Responsive Design

**Desktop** (> 768px):
- Grid multi-colonna per statistiche (3-4 colonne)
- Grid multi-colonna per azioni rapide (3-4 colonne)
- Layout a colonne per widget

**Tablet** (≤ 768px):
- Grid 2 colonne per statistiche
- Grid 2 colonne per azioni rapide
- Layout verticale per widget

**Mobile** (≤ 480px):
- Grid 1 colonna per statistiche
- Grid 1 colonna per azioni rapide
- Layout verticale per widget
- Card più grandi per facilità touch
- **Operaio**: Ottimizzazione speciale mobile-first

---

## 📝 NOTE IMPLEMENTAZIONE

### Query Performance

- **Limitare risultati**: Usare `.limit()` per liste (es: ultime 5-10 attività)
- **Indici Firestore**: Creare indici per query complesse (filtri multipli)
- **Cache locale**: Considerare cache per statistiche che cambiano poco

### Loading States

- Mostrare "-" o spinner durante caricamento dati
- Gestire errori con messaggi chiari
- Fallback se query fallisce

### Permessi e Sicurezza

- **Filtri obbligatori**: Sempre filtrare per `tenantId`
- **Filtri ruolo**: Applicare filtri specifici per ruolo (es: Operaio vede solo suoi dati)
- **Verifica permessi**: Controllare permessi prima di mostrare azioni

### Test

Per ogni ruolo, testare:
- [ ] Statistiche caricate correttamente
- [ ] Filtri applicati (tenant, ruolo, periodo)
- [ ] Azioni rapide funzionanti
- [ ] Link corretti
- [ ] Responsive design
- [ ] Ruoli multipli
- [ ] Con/senza moduli avanzati

---

## ✅ CHECKLIST SVILUPPO

### Per Ogni Ruolo

- [ ] Definire statistiche da mostrare
- [ ] Creare query Firestore
- [ ] Implementare funzioni caricamento dati
- [ ] Creare componenti UI (card statistiche, azioni rapide)
- [ ] Integrare nella dashboard principale
- [ ] Applicare filtri e permessi
- [ ] Testare con ruolo singolo
- [ ] Testare con ruoli multipli
- [ ] Testare responsive
- [ ] Gestire loading/errori

---

---

## 💡 CONSIDERAZIONI FINALI

### Approccio Sistema Tracciamento Zone Lavorate

**✅ Vantaggi dell'approccio proposto**:

1. **Riutilizzo codice esistente**: Sistema zone escluse già funzionante nella vecchia app
   - Stessa logica di tracciamento poligoni sulla mappa
   - Stesso calcolo automatico superficie
   - Stesso salvataggio coordinate

2. **Visione Manager in tempo reale**: 
   - Manager vede immediatamente i progressi
   - Può intervenire tempestivamente
   - Gestione proattiva invece che reattiva

3. **Precisione**: 
   - Tracciamento sulla mappa è preciso
   - Calcolo automatico elimina errori manuali
   - Storico completo delle zone lavorate

4. **Scalabilità**: 
   - Funziona per qualsiasi tipo di lavoro
   - Funziona per qualsiasi terreno
   - Sistema modulare e riutilizzabile

### Flusso Completo di Lavoro

**Esempio pratico: "Potatura Campo A - 3 giorni previsti"**

1. **Manager assegna lavoro**:
   - Crea lavoro "Potatura Campo A"
   - Assegna a Caposquadra X
   - Imposta durata prevista: 3 giorni
   - Terreno: Campo A (5 ha)

2. **Caposquadra vede lavoro assegnato**:
   - Apre "I Miei Lavori"
   - Vede "Potatura Campo A - 3 giorni"
   - Vede terreno sulla mappa

3. **Giorno 1 - Caposquadra traccia zona lavorata**:
   - Apre "Traccia Zone Lavorate"
   - Seleziona lavoro "Potatura Campo A"
   - Traccia poligono sulla mappa: zona lavorata oggi (1.5 ha)
   - Sistema calcola automaticamente:
     - Superficie lavorata oggi: 1.5 ha
     - Superficie totale lavorata: 1.5 ha
     - Superficie rimanente: 3.5 ha
     - Percentuale: 30%

4. **Manager vede progressi in tempo reale**:
   - Apre dashboard Manager
   - Vede "Potatura Campo A - 30% completato"
   - Vede mappa con zona lavorata evidenziata
   - Vede "In tempo" (1.5 ha in 1 giorno = ok per 3 giorni)

5. **Giorno 2 - Caposquadra traccia altra zona**:
   - Traccia nuova zona lavorata oggi (1.8 ha)
   - Sistema aggiorna:
     - Superficie totale lavorata: 3.3 ha
     - Superficie rimanente: 1.7 ha
     - Percentuale: 66%

6. **Manager vede aggiornamento**:
   - Vede "66% completato"
   - Vede "In anticipo" (3.3 ha in 2 giorni, rimangono 1.7 ha per 1 giorno = ok)

7. **Giorno 3 - Completamento**:
   - Caposquadra traccia ultima zona (1.7 ha)
   - Sistema aggiorna: 100% completato
   - Lavoro marcato come "completato"

### Dati da Salvare

**Per ogni lavoro**:
```javascript
{
  lavoroId: "lavoro-123",
  nome: "Potatura Campo A",
  terrenoId: "terreno-456",
  caposquadraId: "user-789",
  dataInizio: "2025-01-13",
  durataPrevista: 3, // giorni
  stato: "in_corso",
  
  // Zone lavorate (array di zone tracciate)
  zoneLavorate: [
    {
      data: "2025-01-13",
      caposquadraId: "user-789",
      coordinate: [...], // poligono mappa
      superficieHa: 1.5,
      note: "Zona nord-est"
    },
    {
      data: "2025-01-14",
      caposquadraId: "user-789",
      coordinate: [...],
      superficieHa: 1.8,
      note: "Zona centro"
    }
  ],
  
  // Calcoli automatici
  superficieTotaleTerreno: 5.0, // ha
  superficieTotaleLavorata: 3.3, // ha (somma zoneLavorate)
  superficieRimanente: 1.7, // ha
  percentualeCompletamento: 66, // %
  
  // Statistiche
  giorniEffettivi: 2, // giorni passati dall'inizio
  statoProgresso: "in_anticipo" // "in_anticipo" | "in_tempo" | "in_ritardo"
}
```

### Integrazione con Ore Operai

**Sistema completo**:
- Operaio segna ore → stato "da_validare"
- Caposquadra valida ore → stato "validate"
- Caposquadra traccia zone lavorate → aggiorna progressi lavoro
- Manager vede tutto: ore validate + progressi lavoro

**Vantaggi integrazione**:
- Manager ha visione completa: ore lavorate + superficie lavorata
- Può verificare efficienza: ore vs superficie
- Può identificare problemi: molte ore ma poca superficie = problema

---

**Ultimo aggiornamento**: 2025-01-13  
**Prossimo passo**: Implementare dashboard per ogni ruolo seguendo questa specifica

