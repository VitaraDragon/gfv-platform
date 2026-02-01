# 📊 Stato Moduli Specializzati - Riepilogo Completo

**Data aggiornamento**: 2026-02-01 (**Allineamento modulo Frutteto al Vigneto**: lavori con categorie spese, RaccoltaFrutta isCompleta(), modello Frutteto spese/costi, API costoTotaleAnno) | 2026-01-31 (Raccolta Frutta; lista condivisa Calcolo materiali; forma allevamento Pianificazione frutteto; pali frutteto; Gestione lavori Impianto Frutteto; Pagine e card Potatura e Trattamenti – Vigneto e Frutteto; piano Potatura/Trattamenti da lavori)  
**Focus**: Modulo Vigneto, Modulo Frutteto, Allineamento moduli, Moduli Specializzati per Coltura, Modulo Report/Bilancio Cross-Moduli

---

## 🎯 Panoramica Generale

### Moduli Pianificati

1. **🍇 Modulo Vigneto** - ✅ **IMPLEMENTATO (MVP Base + Funzionalità Avanzate)**
2. **🍎 Modulo Frutteto** - ✅ **IMPLEMENTATO (Fase Base + Dashboard + Integrazione Lavori)**
3. **🫒 Modulo Oliveto** - 📝 **PIANIFICAZIONE**
4. **📑 Modulo Report/Bilancio** - ✅ **IMPLEMENTATO (MVP)** - Report unificati cross-moduli

**Principio Architetturale**: Moduli opzionali pay-per-use che si integrano con il Core Base senza modificare funzionalità esistenti.

---

## 🍇 MODULO VIGNETO - Stato Dettagliato

### ✅ COMPLETATO (2026-01-13 → 2026-01-18)

#### 1. Struttura Base e Architettura ✅
- ✅ Struttura cartelle completa (`models/`, `services/`, `views/`)
- ✅ Modelli implementati:
  - `Vigneto.js` - Anagrafica completa con validazione
  - `Vendemmia.js` - Gestione vendemmia con poligono
  - `PotaturaVigneto.js` - Modello potatura (servizio pronto)
  - `TrattamentoVigneto.js` - Modello trattamento (servizio pronto)
- ✅ Servizi CRUD completi per tutte le entità
- ✅ Firestore Security Rules configurate e pubblicate
- ✅ Integrazione multi-tenant verificata

#### 2. Anagrafica Vigneti ✅ **COMPLETATO 2026-01-13**
- ✅ Vista `vigneti-standalone.html` completa con:
  - Lista vigneti con filtri avanzati (terreno, varietà, stato)
  - Form creazione/modifica con validazione completa
  - **Calcolo automatico densità** da distanza file × distanza ceppi
  - **Precompilazione tipo impianto** automatica (Tradizionale/Intensivo/Superintensivo)
  - **Caricamento superficie** automatico dal terreno selezionato
  - **Dropdown completi** con liste predefinite:
    - 50+ varietà uva (italiane e internazionali)
    - 20+ portainnesti
    - 20+ forme di allevamento
    - 14+ tipi di palo
    - 12 orientamenti filari
  - **Pulsante "+"** per aggiungere valori personalizzati (persistenza localStorage)
  - **Sistema retrocompatibile**: banner informativo per terreni con "Vite" esistenti
- ✅ CRUD completo anagrafica vigneti
- ✅ Validazione dati con modello `Vigneto.js`
- ✅ Calcolo automatico costi, margini, ROI

#### 3. Gestione Vendemmia ✅ **COMPLETATO 2026-01-13 → 2026-01-18**
- ✅ Vista `vendemmia-standalone.html` completa
- ✅ Calcolo automatico resa qli/ha
- ✅ Integrazione con operai e macchine
- ✅ Aggiornamento automatico dati vigneto (produzione, resa media, spese)
- ✅ **Tracciamento Poligono Area Vendemmiata** (2026-01-18 → 2026-01-19):
  - Campo `poligonoVendemmiato` nel modello
  - Pulsante "🗺️ Traccia" con modal mappa interattivo
  - Calcolo automatico superficie da poligono (m² → ettari)
  - Visualizzazione poligono esistente
  - **Funzionalità Avanzate** (2026-01-19):
    - ✅ Cursore crosshair durante il tracciamento
    - ✅ Snap automatico ai vertici del terreno (8m)
    - ✅ Snap automatico al confine del terreno (5m)
    - ✅ Chiusura automatica quando si clicca vicino al primo punto (20m)
    - ✅ Doppio clic per terminare tracciamento
    - ✅ Tolleranza per punti vicini al confine (3m)
    - ✅ Feedback visivo quando applica snap (marker verde temporaneo)
    - ✅ Disabilitazione snap temporanea con Shift
    - ✅ 6 funzioni helper per gestione snap e tolleranza
- ✅ **Tabella Editabile Operai** (2026-01-17):
  - Funziona quando modulo manodopera non attivo
  - Colonne: Data, Nome Operaio, Ore
  - Totale ore in tempo reale
- ✅ **Tabella Macchine (Sola Lettura)** (2026-01-18):
  - Visualizzazione macchine dall'attività quando manodopera non attivo
  - Colonne: Tipo, Nome, Ore
- ✅ **Precompilazione Superficie** automatica dal lavoro collegato
- ✅ **Link "Vedi Lavoro"** corretto per manager
- ✅ Rimozione campi non necessari (Macchine dropdown, Ore Impiegate, Parcella)

#### 4. Integrazione Sistema Lavori/Diario ✅ **COMPLETATO 2026-01-14** (modulo di riferimento per allineamento Frutteto 2026-02-01)
- ✅ **Decisione Strategica**: Una sola registrazione nel sistema Lavori/Diario
- ✅ Collegamento automatico Lavoro → Vigneto (tramite terreno)
- ✅ Calcolo automatico costi lavori (manodopera: ore × tariffe, macchine: ore × costo/ora)
- ✅ Aggregazione annuale automatica spese per categoria
- ✅ Mappatura dinamica tipi lavoro → categorie spese (getCategoriaManodoperaPerTipoLavoro, chiavi dinamiche manodopera*)
- ✅ Aggiornamento automatico vigneto quando lavoro completato/validato
- ✅ Supporto per qualsiasi tipo di lavoro (non solo potatura/trattamenti)
- ✅ Conteggio automatico lavori ripetuti nell'anno
- ✅ Servizio `lavori-vigneto-service.js` completo
- ✅ Integrazione automatica in 3 punti (approvazione manager, attività rapida, completamento automatico)
- ✅ Pulsante ricalcolo manuale nella UI vigneti
- ✅ Ricalcolo automatico in background al caricamento pagina

#### 5. Sistema Spese e Costi ✅ **MIGLIORATO 2026-01-15**
- ✅ **Correzione Calcolo Costo Totale Anno**: Eliminato doppio conteggio categorie
- ✅ **Struttura Gerarchica Dinamica**: Categorie manodopera dinamiche basate sul sistema
- ✅ **Filtro Attività Dirette Migliorato**: Supporto per multiple attività diverse nello stesso giorno
- ✅ **Coerenza Calcoli**: Totali identici tra pagina principale e dettaglio
- ✅ **Ricalcolo Automatico**: Spese aggiornate automaticamente in background
- ✅ **Miglioramenti UI**: Card "Macchine" resa più visibile con gradiente blu
- ✅ **Pulizia Log**: Rimossi tutti i log di debug, console pulita

#### 6. Integrazione Dashboard e Attivazione ✅
- ✅ Card "Vigneto" nella dashboard quando modulo attivo
- ✅ Attivazione modulo in pagina abbonamento
- ✅ Verifica accesso modulo nelle viste (redirect ad abbonamento se non attivo)

---

### 🚧 IN SVILUPPO / DA COMPLETARE

#### 1. Rilevamento Automatico Vendemmia da Lavori ✅ **IMPLEMENTATO**
**Stato**: ✅ **COMPLETATO** - Funzioni presenti e chiamate da hook

**Verifica Codice**:
- ✅ Funzione `createVendemmiaFromLavoro(lavoroId)` presente in `vendemmia-service.js` (linea 368)
- ✅ Funzione `createVendemmiaFromAttivita(attivitaId)` presente in `vendemmia-service.js` (linea 514)
- ✅ Hook implementati in:
  - `core/js/attivita-events.js` (linee 988-989, 999-1000, 1320-1321, 1331-1332)
  - `core/admin/js/gestione-lavori-events.js` (linee 1581-1582)
- ✅ Campo `lavoroId` presente nel modello `Vendemmia.js`
- ✅ Campo `attivitaId` presente nel modello `Vendemmia.js`

**Cosa fa**:
- Rileva automaticamente lavori/attività con tipo contenente "vendemmia" su terreno VITE
- Crea vendemmia automaticamente con dati precompilati (data, vigneto, varietà, operai, macchine)
- Verifica esistenza vendemmia per evitare duplicati
- Gestisce sia lavori che attività dirette (senza lavoro)

**Checklist Implementazione**:
- [x] Funzione `createVendemmiaFromLavoro(lavoroId)` ✅ IMPLEMENTATA
- [x] Funzione `createVendemmiaFromAttivita(attivitaId)` ✅ IMPLEMENTATA
- [x] Hook creazione vendemmia automatica al salvataggio lavoro ✅ IMPLEMENTATO
- [x] Hook creazione vendemmia automatica al salvataggio attività ✅ IMPLEMENTATO
- [ ] Creare tipi lavoro "Vendemmia Manuale" e "Vendemmia Meccanica" nel sistema (da verificare se esistono)
- [ ] Aggiornare UI elenco vendemmie (badge stato "Incompleta" per vendemmie senza quantità)
- [ ] Implementare filtro dropdown tipi lavoro (solo vendemmia quando terreno=VITE)
- [x] Aggiornare `lavori-vigneto-service.js` per riconoscere vendemmia nelle spese ✅ (già riconosce)
- [ ] Implementare gestione modifiche/eliminazioni lavoro (aggiornamento vendemmia)
- [x] Implementare validazione stato vendemmia (completa/incompleta) ✅ (metodo `isCompleta()` presente)

**Note**: La funzionalità è implementata e funzionante. Manca solo l'UI per mostrare badge "Incompleta" e il filtro dropdown tipi lavoro.

#### 2. Calcolo Compensi Vendemmia ✅ **IMPLEMENTATO**
**Stato**: ✅ **COMPLETATO** - Funzione presente e funzionante

**Verifica Codice**:
- ✅ Funzione `calcolaCompensiVendemmia(vendemmia)` presente in `vendemmia-service.js` (linea 642)
- ✅ Chiamata automaticamente in `createVendemmia()` e `updateVendemmia()` (linee 173, 229)
- ✅ Import di `getTariffaOperaio` da `calcolo-compensi-service.js` (linea 23)

**Cosa fa**:
- Se vendemmia collegata a lavoro: calcola dalle ore validate del lavoro (`oreOperai` con stato 'validate')
- Se vendemmia standalone con modulo manodopera: calcola da `oreImpiegate` e tariffe operai
- Se vendemmia standalone senza modulo manodopera: lascia costo a 0 (operai non nel sistema)
- Usa tariffe personalizzate o tipo operaio per calcolo

**Metodi di Calcolo Implementati**:
1. ✅ Tariffa per ora (tariffa oraria standard) - **IMPLEMENTATO**
2. ⚠️ Tariffa per quintale raccolto (configurabile per varietà) - **NON IMPLEMENTATO**
3. ⚠️ Tariffa mista (futuro) - **NON IMPLEMENTATO**

**File**: `modules/vigneto/services/vendemmia-service.js` (linee 636-726)

**Note**: Il calcolo compensi è implementato e funzionante. Manca solo la tariffa per quintale (funzionalità avanzata).

#### 3. Filtri nelle Viste 🚧 **PARZIALMENTE IMPLEMENTATO**
**Stato**: Struttura HTML presente, logica filtraggio mancante

**Verifica Codice**:
- ✅ HTML filtri presente in entrambe le viste:
  - `vigneti-standalone.html`: filtri per terreno, varietà, stato (linee 332-356)
  - `vendemmia-standalone.html`: filtri per vigneto, varietà, anno (linee 501-519)
- ✅ Dropdown popolati automaticamente:
  - Vigneti: terreni con Vite (linee 977-989)
  - Vendemmie: vigneti e varietà (linee 952-972)
- ⚠️ Funzione `applyFilters()` presente ma vuota (solo TODO):
  - `vigneti-standalone.html` (linea 1201-1204)
  - `vendemmia-standalone.html` (linea 1645-1648)

**Cosa manca**:
- [ ] Logica filtraggio in `applyFilters()` per vigneti (terreno, varietà, stato)
- [ ] Logica filtraggio in `applyFilters()` per vendemmie (vigneto, varietà, anno)
- [ ] Aggiornamento tabella dopo filtro

**File con TODO**:
- `modules/vigneto/views/vigneti-standalone.html` (linea 1202)
- `modules/vigneto/views/vendemmia-standalone.html` (linea 1646)

**Note**: La struttura è completa, manca solo la logica di filtraggio (circa 20-30 righe di codice per vista).

---

#### 9. Pagine e card Potatura e Trattamenti ✅ **IMPLEMENTATO (2026-01-31)**
- **Potatura vigneto:** `modules/vigneto/views/potatura-standalone.html` – filtro vigneto/anno, tabella potature (tipo invernale/verde/rinnovo/spollonatura, ceppi potati, ore, costo), modal CRUD. Integrazione con `potatura-vigneto-service.js`.
- **Trattamenti vigneto:** `modules/vigneto/views/trattamenti-standalone.html` – stessa struttura, tema vigneto, integrazione con `trattamenti-vigneto-service.js`.
- **Dashboard vigneto:** card **Potatura** e **Trattamenti** nelle Azioni rapide (dopo Vendemmia, prima Statistiche).
- **Evoluzione pianificata:** documento `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md` – dati base da lavori/attività (Gestione lavori + Diario), pagine dedicate per consultazione e compilazione dati aggiuntivi (stesso procedimento di Vendemmia/Raccolta), dati base in sola lettura. Da implementare in seguito.

---

### 📋 DA IMPLEMENTARE (Non ancora iniziato)

#### 1. Diradamento Grappoli
**Stato**: Pianificato ma non implementato

**Cosa manca**:
- [ ] Modello `DiradamentoVigneto.js` (o sub-collection)
- [ ] Servizio `diradamento-vigneto-service.js`
- [ ] Vista `diradamento-vigneto-standalone.html`
- [ ] Integrazione con sistema spese

#### 4. Pianificazione Nuovi Impianti (Reticolato)
**Stato**: ✅ **PARZIALMENTE IMPLEMENTATO** (2026-01-21 → 2026-01-22)

**Funzionalità Implementate**:
- ✅ Reticolato sovrapponibile sulla mappa terreno
- ✅ Rotazione reticolato (angolo filari) con controlli interattivi
- ✅ Configurazione sesto di impianto (distanze file e ceppi)
- ✅ Gestione carraie avanzata (strade di servizio):
  - Creazione poligoni per ogni segmento del perimetro terreno
  - **Classificazione automatica** carraie (principali/laterali) basata su orientamento
  - **Pulsanti selezione rapida**: Principali (6m), Laterali (4m), Configurazione Tipica
  - Visualizzazione etichette (A, B, C, D, ecc.) su ogni segmento
  - Selezione multipla segmenti per raggruppare in carraie
  - Larghezza configurabile per ogni carraia con aggiornamento automatico classificazione
  - **Verifica punto interno/esterno** per garantire carraie sempre all'interno (2026-01-22)
  - Esclusione automatica filari che intersecano carraie
- ✅ **UI Ottimizzata** (2026-01-22):
  - **Ordine controlli logico**: Rotazione → Carraie → Sesto di impianto → Calcoli → Salvataggio
  - **Titolo sezione "Sesto di impianto"** per consistenza UI
- ✅ Calcolo automatico materiali (file, ceppi, pali, fili)
- ✅ Calcolo superficie carraie e superficie netta impianto
- ✅ Salvataggio pianificazioni in Firestore
- ✅ Servizio migliorato con gestione errore indice Firestore (fallback automatico)

**Miglioramenti Tecnici (2026-01-22)**:
- ✅ **Fix offset carraie robusto**: Verifica punto interno/esterno invece di sistema orario/antiorario
- ✅ Funziona per qualsiasi forma di terreno, anche molto complessa
- ✅ Sistema automatico e trasparente per l'utente

**File Implementati**:
- ✅ `modules/vigneto/views/pianifica-impianto-standalone.html` - Vista completa con mappa interattiva
- ✅ `modules/vigneto/services/pianificazione-impianto-service.js` - Servizio CRUD pianificazioni
- ✅ `modules/vigneto/models/PianificazioneImpianto.js` - Modello dati pianificazione

**Funzionalità Pianificate (Non Implementate)**:
- ⏳ Stima costi impianto (fase avanzata)
- ⏳ Card dedicata nel sottomenù "PIANIFICA VIGNETO" per gestione pianificazioni salvate (visualizzazione/caricamento/eliminazione)
- ⏳ Template sesti di impianto predefiniti

**Note**:
- La sezione UI per visualizzare/caricare pianificazioni salvate è stata rimossa dal pannello controllo (2026-01-21) per essere reimplementata in una card dedicata nel sottomenù "PIANIFICA VIGNETO"
- Il servizio gestisce automaticamente l'errore di indice Firestore mancante con fallback a ordinamento in memoria

**Priorità**: Media (funzionalità avanzata)

#### 4b. Calcolo materiali e Pianificazione – Lista condivisa e forma allevamento frutteto ✅ **2026-01-31**
- **Lista condivisa**: Il dropdown "Tipo impianto / Forma di allevamento" in Calcolo materiali usa le stesse liste di Pianificazione nuovo impianto (vigneto: `getFormeAllevamentoList()`; frutteto: `FORME_ALLEVAMENTO_FRUTTETO` + custom). Precompilazione da `pianificazione.formaAllevamento`; in invio al service si passa la chiave tecnica.
- **Pianificazione**: Il gruppo "Forma di allevamento" è visibile e salvato anche per frutteto/oliveto (config `showFormaAllevamento`); precompilazione e salvataggio per tutte le colture.
- **File**: `modules/vigneto/views/calcolo-materiali-standalone.html`, `modules/vigneto/views/pianifica-impianto-standalone.html`.

#### 5. Report Avanzati
**Stato**: 📝 Pianificato come **modulo unico cross-moduli** (non per-modulo)

**Decisione**: evitare N pagine “report” per ogni modulo (es. Vigneto/Frutteto/Oliveto).  
I report/esportazioni (PDF/Excel/CSV) verranno gestiti tramite un **modulo Report/Bilancio unico** adattivo, che riusa i servizi/aggregati già presenti (es. statistiche vigneto).

**Cosa verrà coperto dal modulo Report/Bilancio** (esempi, non vincolanti):
- Report vendemmia/produzione/costi/qualità (derivati da dati già presenti nelle statistiche)
- Export PDF/Excel/CSV con filtri unificati (periodo + selezione coltura/impianto)

**Nota**: “Report Trattamenti” non è in scope ora (trattamenti rimandati a modulo dedicato futuro).

**Priorità**: Media (attivare solo se richiesto da utenti / esigenza di export)

#### 6. Integrazione Link da Pagina Terreni
**Stato**: ✅ **COMPLETATO**

**Cosa manca**:
- [x] Pulsante "🍇" (Gestisci Vigneto) nella pagina terreni per terreni con coltura "Vite"
- [x] Link diretto a `vigneti-standalone.html?terrenoId=...`
- [x] Apertura automatica: se esiste vigneto sul terreno → edit; altrimenti → crea con terreno pre-selezionato

**File modificati**: `core/terreni-standalone.html`, `core/js/terreni-controller.js`, `modules/vigneto/views/vigneti-standalone.html`

#### 7. Dashboard Standalone Dedicata ✅ **COMPLETATO (2026-01-20 → 2026-01-21)**
**Stato**: ✅ **COMPLETATO** - Dashboard e pagina statistiche implementate e funzionanti

**Obiettivo**: Dashboard dedicata per manager/amministratori con panoramica completa del modulo vigneto, allineata al pattern del modulo Conto Terzi.

**Struttura Implementata**:
- ✅ **File Dashboard**: `modules/vigneto/views/vigneto-dashboard-standalone.html`
  - Header con sfondo viola (`#6A1B9A`), titolo "🍇 VIGNETO", link "← Dashboard Principale"
  - Card statistiche principali (produzione, resa, spese, numero vigneti, vendemmie)
  - Card azioni rapide (Anagrafica Vigneti, Gestione Vendemmia, Statistiche)
  - Sezione vendemmie recenti
  - Sezione lavori vigneto
- ✅ **File Statistiche**: `modules/vigneto/views/vigneto-statistiche-standalone.html`
  - Pagina dedicata con 9 grafici Chart.js completi:
    - Produzione temporale (ultimi 3 anni)
    - Resa per varietà
    - Produzione mensile
    - Qualità uva (gradazione, acidità, pH)
    - Costi nel tempo (manodopera, macchine, prodotti, cantina, altro)
    - Spese per categoria
    - Spese mensili
  - Filtri vigneto/anno con aggiornamento automatico
  - Ottimizzazione performance con caricamento dati parallelo
- ✅ **Servizio Statistiche**: `modules/vigneto/services/vigneto-statistiche-service.js`
  - `getStatisticheVigneto(vignetoId, anno)`: aggregazione dati produzione, resa, costi
  - `getProduzioneTemporale(vignetoId, anniIndietro)`: dati produzione ultimi N anni
  - `getQualitaUva(vignetoId, anno)`: dati qualità uva per varietà
  - `getCostiTemporale(vignetoId, anniIndietro)`: dati costi per categoria ultimi N anni
  - `getVendemmieRecenti(vignetoId, anno, limit)`: ultime N vendemmie
  - `getLavoriVigneto(vignetoId, anno)`: lavori collegati a vigneto
  - Ottimizzazione con `Promise.all` per caricamento parallelo

**Miglioramenti Implementati (2026-01-21)**:
- ✅ **Fix Grafico Costi nel Tempo**: Logica verifica dati migliorata (controlla tutte le categorie, non solo totale)
- ✅ **Allineamento UI**: Pulsante dashboard allineato agli altri moduli ("← Dashboard" invece di "← Dashboard Vigneto")
- ✅ **Pulizia Codice**: Rimossi tutti i log di debug, codice pulito e pronto per produzione

**Pulizia Completa Log Debug (2026-01-22)**:
- ✅ **Rimozione Completa Log Debug**: Rimossi tutti i log di debug (~65+ log) dal modulo statistiche vigneto
- ✅ **File Puliti**:
  - `vigneto-statistiche-standalone.html` - Rimossi ~30+ log (funzione `loadCharts()`, `ensureCanvas()`, errori generici)
  - `vigneto-statistiche-service.js` - Rimossi ~20+ log (funzione `getStatisticheVigneto()`, funzioni di supporto)
  - `vigneto-statistiche-aggregate-service.js` - Rimossi ~15+ log (funzione `getStatisticheAggregate()`, altre funzioni)
- ✅ **Pattern Log Rimossi**: `[VIGNETO-STATISTICHE]`, `[VIGNETO-STATISTICHE-SERVICE]`, `[VIGNETO-STATISTICHE-AGGREGATE]`
- ✅ **Risultato**: Codice completamente pulito, funzionalità mantenuta, pronto per produzione

**Tecnologie**:
- ✅ Chart.js per grafici (9 grafici completi nella pagina statistiche)
- ✅ Stile viola allineato al tema vigneto
- ✅ Mobile-friendly e responsive
- ✅ Ottimizzazione performance (caricamento dati parallelo, riduzione anni da 5 a 3)

**Permessi**: ✅ Solo manager/amministratori (verifica implementata)

**File Creati/Modificati**:
- ✅ `modules/vigneto/views/vigneto-dashboard-standalone.html` - Dashboard principale
- ✅ `modules/vigneto/views/vigneto-statistiche-standalone.html` - Pagina statistiche con 9 grafici
- ✅ `modules/vigneto/services/vigneto-statistiche-service.js` - Servizio statistiche completo
- ✅ `core/js/dashboard-sections.js` - Card vigneto nella dashboard principale

#### 8. Sezione Vigneto nella Dashboard Principale
**Stato**: Card base presente, sezione dettagliata mancante

**Cosa manca**:
- [ ] Card "Vendemmia in corso" con dettagli
- [ ] Card "Prossimi Trattamenti" con alert
- [ ] Card "Rese Anno Corrente" con confronto anno precedente
- [ ] Grafici produzione nel tempo

**File da modificare**: `core/dashboard-standalone.html`

#### 8. Notifiche e Alert Automatici
**Stato**: Pianificato ma non implementato

**Alert da implementare**:
- [ ] Alert giorni di carenza prima vendemmia (trattamenti)
- [ ] Alert vendemmie incomplete
- [ ] Alert prossimi trattamenti programmati
- [ ] Notifiche push (futuro)

---

## 🍎 MODULO FRUTTETO - Stato Dettagliato

### ✅ IMPLEMENTATO (Fase Base - 2026-01-29)

#### 1. Struttura Base e Architettura ✅
- ✅ Struttura cartelle completa (`models/`, `services/`, `views/`)
- ✅ Modelli implementati:
  - `Frutteto.js` - Anagrafica completa con validazione (estende `BaseColtura`)
  - `RaccoltaFrutta.js` - Gestione raccolta frutta con qualità e costi
- ✅ Servizi CRUD completi per tutte le entità
- ✅ Firestore Security Rules configurate e pubblicate
- ✅ Integrazione multi-tenant verificata
- ✅ Ereditarietà da `BaseColtura` (classe base comune con Vigneto)

#### 2. Anagrafica Frutteti ✅ **COMPLETATO 2026-01-29**
- ✅ Vista `frutteti-standalone.html` completa con:
  - Lista frutteti con filtri avanzati (terreno, specie, varietà, stato)
  - Form creazione/modifica con validazione completa
  - **Dropdown specie** da servizio centralizzato `colture-service.js` (categoria "frutteto")
  - **Dropdown varietà dinamico** per specie da `varieta-frutteto-service.js`
  - **Modal aggiunta varietà personalizzate** (localStorage temporaneo)
  - **Pre-compilazione da terreno** (URL parameter `terrenoId`):
    - Pre-selezione terreno
    - Pre-compilazione superficie
    - Pre-compilazione specie se terreno ha coltura corrispondente
    - Popolamento automatico dropdown varietà
  - **Normalizzazione nomi specie** con alias (plurali/singolari): `Prugne` → `Susino`, `Albicocche` → `Albicocco`, ecc.
- ✅ CRUD completo anagrafica frutteti
- ✅ Validazione dati con modello `Frutteto.js`
- ✅ Calcolo automatico costi, margini, ROI (ereditato da `BaseColtura`)

#### 3. Gestione Raccolta Frutta ✅ **COMPLETATO 2026-01-29 → 2026-01-30**
- ✅ Gestione raccolte integrate nella pagina anagrafica
- ✅ Calcolo automatico resa kg/ha
- ✅ Campi qualità: calibro, grado maturazione, colore
- ✅ Integrazione con operai e macchine
- ✅ Aggiornamento automatico dati frutteto (produzione, spese)
- ✅ Calcolo automatico costi (manodopera, macchine)
- ✅ **Tracciamento poligono area raccolta** (2026-01-30, allineato a Vendemmia):
  - Cursore crosshair durante il tracciamento (classe `drawing-mode` + JS su container/canvas)
  - Snap ai vertici (8 m) e al confine terreno (5 m), disabilitabile con Shift
  - Doppio clic per terminare tracciamento; chiusura poligono cliccando vicino al primo punto
  - Validazione punto dentro i confini del terreno (tolleranza 3 m)
  - Feedback visivo snap (marker verde temporaneo); toggle "Pausa tracciamento"
- ✅ **Dropdown terreni/frutteti** (2026-01-30): nei dropdown e in tabella viene mostrato **nome del terreno e podere** invece dell’id (pagina Frutteti: `getTerrenoLabel`; Gestione Raccolta: `getFruttetoOptionLabel` con Specie Varietà – Nome terreno – Podere)
- ✅ **Sistemazione Raccolta Frutta** (2026-01-31):
  - **Sync zona da lavoro**: `loadPoligonoFromZoneLavorate(lavoroId)`; in modifica raccolta collegata a lavoro, la zona tracciata dagli operai (`zoneLavorate`) viene caricata nella mappa e salvata al primo salvataggio
  - **Formattazione superficie (ha)**: due decimali (`.toFixed(2)`) nel modal e in tabella
  - **Colonna Lavoro**: in tabella raccolte colonna con link "🔗 Vedi Lavoro" quando raccolta collegata a lavoro (allineato a Vendemmia)
  - **Pulsante Dashboard**: href a `frutteto-dashboard-standalone.html` + `resolvePath`; ordine pulsanti come Vendemmia: **Nuova raccolta** → **← Frutteti** → **← Dashboard**
- ✅ **Gestione lavori – Impianto Nuovo Frutteto** (2026-01-31): stesso comportamento del vigneto: form "Dati Frutteto" (Specie, Varietà, Anno, Forma Allevamento, distanze/superficie/densità readonly, Note) con precompilazione dalla pianificazione; modali ➕ per specie/varietà/forma; alla conferma lavoro viene chiamata `creaFruttetoDaLavoro()` che crea l’anagrafica frutteto. File: `core/admin/gestione-lavori-standalone.html`, `core/admin/js/gestione-lavori-events.js`.
- ✅ **Calcolo materiali frutteto** (2026-01-31): lista forma di allevamento condivisa con Pianificazione; in `TIPI_IMPIANTO_FRUTTETO` aggiunti `distanzaPali` e `altezzaPali` per forma (fusetto 7 m/3,2 m, spalliera 4 m/3,2 m, pergola 5 m/3,5 m, vaso 6 m/3 m); al cambio forma nel modal vengono precompilati Distanza e Altezza pali. File: `modules/vigneto/services/calcolo-materiali-service.js`, `modules/vigneto/views/calcolo-materiali-standalone.html`.

#### 4. Servizio Centralizzato Varietà ✅ **COMPLETATO 2026-01-29**
- ✅ **Nuovo servizio**: `core/services/varieta-frutteto-service.js`
- ✅ Liste predefinite per tutte le specie principali:
  - Melo, Pesco, Pero, Albicocco, Ciliegio, Susino, Kiwi, Fico
  - Nocciolo, Castagno, Mandorlo, Arancio, Limone, Mandarino, Clementine
  - Kaki, Melograno, Fico d'India, Mora, Lampone, Mirtillo, Ribes
- ✅ Normalizzazione nomi specie con alias (plurali/singolari)
- ✅ Supporto varietà personalizzate (localStorage temporaneo)
- ✅ Funzione `populateVarietaDropdown()` per popolamento UI dinamico
- ✅ Cache e ottimizzazioni

#### 5. Integrazione Sistema ✅ **COMPLETATO 2026-01-29**
- ✅ **Integrazione Terreni**:
  - Icona "🍎" nella lista terreni per terreni con coltura frutteto
  - Pulsante "Gestisci Frutteto" che reindirizza con pre-compilazione
  - Funzione `isColturaFrutteto()` per identificare colture frutteto
- ✅ **Integrazione Dashboard**:
  - Card modulo frutteto visibile quando modulo attivo
  - Link a `frutteti-standalone.html`
- ✅ **Integrazione Abbonamento**:
  - Modulo già presente in configurazione
  - Attivazione/disattivazione funzionante

#### 6. Firestore Security Rules ✅ **COMPLETATO 2026-01-29**
- ✅ Regole per collection `frutteti` (read, create, update, delete)
- ✅ Regole per sub-collection `raccolte` (read, create, update, delete)
- ✅ Regole per collection `raccolteFrutta` (standalone, non sotto frutteti) - **AGGIUNTO 2026-01-29**
- ✅ Permessi per utenti autenticati con ruolo `manager` o `amministratore`

#### 7. Dashboard Standalone Dedicata ✅ **COMPLETATO 2026-01-29**
- ✅ **File Dashboard**: `modules/frutteto/views/frutteto-dashboard-standalone.html`
  - Dashboard clonata da vigneto con tema arancione
  - Statistiche principali: produzione totale (kg), resa media (kg/ha), spese totali (€), numero frutteti, numero raccolte
  - **Card Azioni rapide** (2026-01-31): Anagrafica Frutteti, Gestione Raccolta Frutta, **Potatura**, **Trattamenti**, Pianifica Nuovo Impianto, Calcolo Materiali, Statistiche e Grafici
  - Sezione "Raccolte Recenti" con tabella dati
  - Sezione "Lavori Frutteto" con tabella lavori completati
  - Filtri per frutteto e anno
  - Integrazione Firebase e Tenant Service (pattern condiviso)
- ✅ **Pagine Potatura e Trattamenti** (2026-01-31): `potatura-standalone.html`, `trattamenti-standalone.html` – liste + modal CRUD; evoluzione “da lavori/attività” in `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`.
- ✅ **Link dalla dashboard principale** alla dashboard frutteto dedicata
- ✅ **Link dall'anagrafica** alla dashboard frutteto (non più dashboard principale)

#### 8. Servizio Statistiche Frutteto ✅ **COMPLETATO 2026-01-29**
- ✅ **File**: `modules/frutteto/services/frutteto-statistiche-service.js`
- ✅ `getStatisticheFrutteto(fruttetoId, anno)`: statistiche aggregate per frutteto o tutti i frutteti
- ✅ Calcolo produzione totale, resa media, spese totali, spese raccolta
- ✅ Statistiche per mese (produzione e spese)
- ✅ Resa per specie
- ✅ `getRaccolteRecenti(fruttetoId, anno, limit)`: raccolte recenti con ordinamento
- ✅ `getLavoriFrutteto(fruttetoId, anno, stato, limit)`: lavori completati con dati frutteto

#### 9. Integrazione Sistema Lavori/Diario ✅ **COMPLETATO 2026-01-29** → **ALLINEATO AL VIGNETO 2026-02-01**
- ✅ **File**: `modules/frutteto/services/lavori-frutteto-service.js`
- ✅ `getLavoriPerTerreno(terrenoId, options)`: recupera lavori per terreno con filtri anno/stato
- ✅ `calcolaCostiLavoro(lavoroId, lavoro)`: calcolo costi manodopera, macchine e prodotti
  - Carica ore validate da `lavori/{lavoroId}/oreOperai`
  - Calcola costi manodopera usando `getTariffaOperaio` (modulo Manodopera)
  - Fallback su attività Diario se modulo Manodopera non attivo
  - Calcola costi macchine usando servizio parco macchine se disponibile
  - Include costi prodotti dal lavoro
- ✅ **Allineamento 2026-02-01 – Categorie spese (come vigneto)**:
  - **normalizzaTipoLavoro**, **getCategoriaManodoperaPerTipoLavoro** (mappatura tipo lavoro → categoria: potatura, trattamenti, raccolta, lavorazione_terreno, diserbo, semina_piantagione, gestione_verde, trasporto, manutenzione, altro)
  - **aggiungiManodoperaPerCategoria**: accumula manodopera in chiavi dinamiche (manodoperaPotatura, manodoperaTrattamenti, manodoperaRaccolta, ecc.)
  - **aggregaSpeseFruttetoAnno**: per ogni lavoro e attività diretta usa la categorizzazione; in uscita spesePotaturaAnno, speseTrattamentiAnno, speseRaccoltaAnno dalle chiavi dinamiche; restituisce anche **costoTotaleAnno** (API allineata al vigneto)
- ✅ `ricalcolaSpeseFruttetoAnno(fruttetoId, anno)`: ricalcola e salva spese nel documento frutteto
  - Salva `speseManodoperaAnno`, `speseMacchineAnno`, `speseProdottiAnno`, `spesePotaturaAnno`, `speseTrattamentiAnno`, `speseRaccoltaAnno`, `speseTotaleAnno`, `costoTotaleAnno`
- ✅ Pulsante ricalcolo manuale nella UI frutteti con indicatore progresso
- ✅ Modello Frutteto gestisce **speseProdottiAnno** e **calcolaCostoTotaleAnno()** (workaround speseAltroAnno rimosso da frutteti-service)
- ✅ `aggiornaCostiCalcolati()` chiamato solo se `costoTotaleAnno` non presente o è 0 (evita sovrascrittura valori già calcolati)

#### 10. Allineamento al Vigneto (lavori, raccolta, modello) ✅ **2026-02-01**
- ✅ **RaccoltaFrutta**: metodo **isCompleta()** (true se valorizzati quantità kg, superficie ettari, specie e varietà), allineato a Vendemmia.
- ✅ **Modello Frutteto**: campo **speseProdottiAnno** nel costruttore; override **calcolaCostoTotaleAnno()** che include tutte le spese (manodopera, macchine, prodotti, trattamenti, potatura, raccolta, altro). Workaround speseProdottiAnno → speseAltroAnno rimosso da frutteti-service.
- ✅ **Statistiche**: in `frutteto-statistiche-service.js` per il singolo frutteto si usa **speseAgg.costoTotaleAnno ?? speseAgg.speseTotaleAnno** per coerenza con l’API di aggregazione.
- 📋 **Escluso (da affrontare separatamente)**: sezione Trattamenti (es. isTroppoVicinoARaccolta su TrattamentoFrutteto).

**File toccati**: `lavori-frutteto-service.js`, `RaccoltaFrutta.js`, `Frutteto.js`, `frutteti-service.js`, `frutteto-statistiche-service.js`. Riferimento: `RIEPILOGO_LAVORI_2026-02-01.md`, `COSA_ABBIAMO_FATTO.md` (Allineamento modulo Frutteto al Vigneto 2026-02-01).

### 📋 DA IMPLEMENTARE (Prossimi Passi)

#### Funzionalità Avanzate
- [x] **Gestione potatura** (pagine standalone + card dashboard) ✅ **2026-01-31** – modello e servizio già pronti; evoluzione “da lavori/attività” in `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`
- [ ] Gestione diradamento (fiori/frutti)
- [x] **Gestione trattamenti** (pagine standalone + card dashboard) ✅ **2026-01-31** – modello e servizio già pronti; evoluzione “da lavori/attività” in `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`
- [ ] Pianificazione nuovi impianti (calcolo materiali)
- [ ] Report produzione specifici frutteto
- [ ] Calcolo compensi raccolta (tariffa per kg, tariffa per ora)
- [x] Tracciamento poligono area raccolta (come vendemmia) ✅ **2026-01-30**

#### Integrazioni Future
- ✅ **Integrazione con sistema Lavori/Diario** ✅ **COMPLETATO 2026-01-29**
  - Servizio `lavori-frutteto-service.js` completo
  - Calcolo costi lavori allineato al vigneto
  - Aggregazione spese annuali automatica
  - Ricalcolo spese funzionante
- ✅ **Dashboard standalone dedicata frutteto** ✅ **COMPLETATO 2026-01-29**
  - Dashboard `frutteto-dashboard-standalone.html` con statistiche e lavori
  - Servizio statistiche `frutteto-statistiche-service.js` completo
  - Link dalla dashboard principale alla dashboard frutteto
- ✅ **Statistiche avanzate** ✅ **COMPLETATO 2026-01-29**
  - Statistiche aggregate per frutteto o tutti i frutteti
  - Produzione totale, resa media, spese totali
  - Statistiche per mese e per specie
- [ ] Export report Excel/PDF

### 📊 Completamento Modulo Frutteto

**Fase Base (Anagrafica + Raccolta)**: ✅ **100%**  
**Dashboard e Statistiche**: ✅ **100%** (2026-01-29)  
**Integrazione Lavori/Spese**: ✅ **100%** (2026-01-29)  
**Funzionalità Avanzate**: 📝 **0%** (pianificate)

**Completamento Generale**: ~**55-60%** (MVP base + Dashboard + Statistiche + Integrazione Lavori completati)

**Piano Dettagliato**: Vedi `PLAN_MODULO_FRUTTETO_DETTAGLIATO.md`

---

## 📝 Aggiornamento 2026-01-31: Lista condivisa, forma allevamento, pali frutteto, Gestione lavori Impianto Frutteto

### Modulo Vigneto (pagine condivise)
- **Calcolo materiali**: dropdown Tipo impianto popolato con le stesse liste di Pianificazione (vigneto: `getFormeAllevamentoList()`; frutteto: `FORME_ALLEVAMENTO_FRUTTETO` + custom). Precompilazione da `pianificazione.formaAllevamento`; chiave tecnica passata al service.
- **Pianificazione nuovo impianto**: gruppo "Forma di allevamento" visibile e salvato anche per frutteto/oliveto (`showFormaAllevamento` in config); precompilazione e lettura forma per tutte le colture.

### Modulo Frutteto
- **Calcolo materiali** (pagina condivisa in `modules/vigneto/views/`): per frutteto/oliveto aggiunti `distanzaPali` e `altezzaPali` in `TIPI_IMPIANTO_FRUTTETO`; al cambio forma nel modal vengono precompilati Distanza tra Pali e Altezza Pali.
- **Gestione lavori**: tipo lavoro "Impianto Nuovo Frutteto" con pianificazione selezionata mostra il form "Dati Frutteto" (Specie, Varietà, Anno, Forma Allevamento, distanze/superficie/densità readonly, Note); precompilazione da pianificazione; modali ➕ per valori custom; alla conferma viene chiamata `creaFruttetoDaLavoro()` che crea l’anagrafica frutteto con `createFrutteto()`.

### File toccati
- `modules/vigneto/views/calcolo-materiali-standalone.html`, `modules/vigneto/services/calcolo-materiali-service.js`, `modules/vigneto/views/pianifica-impianto-standalone.html`
- `core/admin/gestione-lavori-standalone.html`, `core/admin/js/gestione-lavori-events.js`

### Riferimento
- `RIEPILOGO_LAVORI_2026-01-31.md`, `COSA_ABBIAMO_FATTO.md` (sezione 2026-01-31)

---

## 📝 Aggiornamento 2026-01-31: Pagine e card Potatura e Trattamenti (Vigneto e Frutteto) + Piano da lavori

### Modulo Vigneto
- **Pagine Potatura e Trattamenti:** create `potatura-standalone.html` e `trattamenti-standalone.html` in `modules/vigneto/views/` – filtro vigneto/anno, tabella, modal CRUD. Integrazione con `potatura-vigneto-service.js` e `trattamenti-vigneto-service.js`.
- **Dashboard:** aggiunte card **Potatura** e **Trattamenti** nelle Azioni rapide (dopo Vendemmia, prima Statistiche).

### Modulo Frutteto
- Le pagine `potatura-standalone.html` e `trattamenti-standalone.html` e le card in dashboard erano già presenti; allineamento strutturale con il vigneto completato in sessioni precedenti.

### Piano evoluzione “Potatura/Trattamenti da lavori e attività”
- Creato **`PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`**: dati base da Gestione lavori e Diario; riconoscimento per categoria (Potatura/Trattamenti); collegamento vigneto/frutteto tramite terreno; stesso procedimento di Vendemmia e Raccolta; creazione solo da lavoro/attività; dati base in sola lettura; dati aggiuntivi compilabili. Da implementare in seguito.

### File toccati
- Creati: `modules/vigneto/views/potatura-standalone.html`, `modules/vigneto/views/trattamenti-standalone.html`, `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`
- Modificati: `modules/vigneto/views/vigneto-dashboard-standalone.html` (card Potatura e Trattamenti)

### Riferimento
- `RIEPILOGO_LAVORI_2026-01-31.md` (§ 10, § 11), `COSA_ABBIAMO_FATTO.md` (Potatura e Trattamenti: pagine e card + piano da lavori)

---

## 📝 Aggiornamento 2026-02-01: Allineamento modulo Frutteto al Vigneto (lavori, raccolta, modello)

### Modulo Vigneto (riferimento)
- Il modulo Vigneto è il riferimento per: aggregazione spese per categoria (potatura, trattamenti, vendemmia/raccolta, lavorazione terreno, altro), API costoTotaleAnno, modello con spese specifiche e calcolaCostoTotaleAnno(), modello Vendemmia con isCompleta().

### Modulo Frutteto (allineato)
- **Lavori**: `lavori-frutteto-service.js` – mappatura tipo lavoro → categoria (normalizzaTipoLavoro, getCategoriaManodoperaPerTipoLavoro, aggiungiManodoperaPerCategoria); aggregaSpeseFruttetoAnno restituisce spesePotaturaAnno, speseTrattamentiAnno, speseRaccoltaAnno dalle chiavi dinamiche e costoTotaleAnno.
- **RaccoltaFrutta**: metodo isCompleta() (quantità, superficie, specie, varietà).
- **Modello Frutteto**: speseProdottiAnno nel costruttore; override calcolaCostoTotaleAnno(); rimosso workaround speseProdottiAnno → speseAltroAnno da frutteti-service.
- **Statistiche**: uso di costoTotaleAnno da aggregazione (costoTotaleAnno ?? speseTotaleAnno).
- **Escluso (da affrontare separatamente)**: TrattamentoFrutteto (es. isTroppoVicinoARaccolta).

### File toccati
- `modules/frutteto/services/lavori-frutteto-service.js`, `modules/frutteto/models/RaccoltaFrutta.js`, `modules/frutteto/models/Frutteto.js`, `modules/frutteto/services/frutteti-service.js`, `modules/frutteto/services/frutteto-statistiche-service.js`

### Riferimento
- `RIEPILOGO_LAVORI_2026-02-01.md`, `COSA_ABBIAMO_FATTO.md` (Allineamento modulo Frutteto al Vigneto 2026-02-01)

---

## 🔄 ALLINEAMENTO MODULI FRUTTETO E VIGNETO (2026-01-29)

### Obiettivo
Allineare anagrafica e dashboard tra Frutteto e Vigneto: stesso comportamento per spese (lavori + attività da diario), elenco lavori con attività "Da diario", dettaglio spese con cambio anno automatico, totale spese sempre calcolato al volo.

### Completato ✅

#### Dashboard – Totale spese e elenco lavori
- **Frutteto**: Totale spese con `aggregaSpeseFruttetoAnno` (lavori + attività dirette diario). Elenco lavori con `getAttivitaDirettePerTerreno`: tabella unificata con lavori (link "Dettaglio") e attività da diario (badge "Da diario"). `getStatisticheFrutteto` usa `aggregaSpeseFruttetoAnno` per il totale.
- **Vigneto**: Card "Spese totali (€)" in dashboard; valore sempre calcolato al volo con `aggregaSpeseVignetoAnno`. Elenco lavori con `getAttivitaDirettePerTerreno`: stessa tabella unificata con badge "Da diario". In `lavori-vigneto-service.js`: `getAttivitaDirettePerTerreno`, `costoTotaleAnno` in return di `aggregaSpeseVignetoAnno`. In `vigneto-statistiche-service.js`: `costoTotaleAnno` sempre calcolato al volo (singolo, tutti, fallback).

#### Anagrafica – Dettaglio spese e selettore anno
- **Vigneto** e **Frutteto**: Listener `change` sul select "Anno" del modal Dettaglio Spese; al cambio anno i dettagli si ricaricano senza cliccare "Aggiorna".

#### UI e documentazione
- **Frutteto**: Icona card "Gestione Raccolta Frutta" da 🧺 a 📦 (casse di frutta); stessa icona per stato vuoto raccolte.
- **Documento indirizzo**: `PIANIFICA_IMPIANTO_CALCOLO_MATERIALI_CONDIVISI.md` – decisioni per modulo condiviso Pianifica impianto e Calcolo materiali (opzione C, filtro coltura, precompilazione da terreno, modello dati unico, UX identica).

### File toccati
- Frutteto: `lavori-frutteto-service.js`, `frutteto-statistiche-service.js`, `frutteto-dashboard-standalone.html`, `frutteti-standalone.html`
- Vigneto: `lavori-vigneto-service.js`, `vigneto-statistiche-service.js`, `vigneto-dashboard-standalone.html`, `vigneti-standalone.html`
- Creato: `PIANIFICA_IMPIANTO_CALCOLO_MATERIALI_CONDIVISI.md`

### Risultato
- Moduli Frutteto e Vigneto allineati su anagrafica e funzioni dashboard; direzione chiara per modulo condiviso Pianifica impianto / Calcolo materiali.

---

## 🫒 MODULO OLIVETO - Stato

**Stato**: 📝 **PIANIFICAZIONE**

**Priorità**: Media (Dopo Vigneto)

**Piano**: Vedi `PLAN_MODULI_COLTURA_SPECIALIZZATI.md` sezione "Modulo Oliveto"

**Funzionalità Pianificate**:
- Anagrafica oliveti
- Gestione raccolta olive
- Gestione molitura e produzione olio
- Gestione potatura
- Gestione trattamenti
- Report produzione olio

**Tempo stimato**: 2 settimane (riutilizzando pattern vigneto)

---

## 📊 Riepilogo Percentuale Completamento

### Modulo Vigneto
- **Struttura Base**: ✅ 100%
- **Anagrafica Vigneti**: ✅ 100%
- **Gestione Vendemmia**: ✅ 98% (manca solo tariffa per quintale, funzionalità avanzata)
- **Integrazione Lavori/Diario**: ✅ 100%
- **Sistema Spese/Costi**: ✅ 100%
- **Gestione Potatura**: ✅ Pagine e card implementate (2026-01-31); evoluzione “da lavori” pianificata in `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`
- **Gestione Trattamenti**: ✅ Pagine e card implementate (2026-01-31); evoluzione “da lavori” pianificata in `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`
- **Diradamento**: 📝 0% (pianificato)
- **Pianificazione Impianti**: ✅ ~70% (implementato - salvataggio funzionante, card gestione salvate da implementare)
- **Report/Bilancio (cross-moduli)**: 📝 0% (pianificato)
- **Dashboard Standalone**: ✅ 100% (completata - 2026-01-20 → 2026-01-21, vedi sezione 7)
- **Integrazioni UI**: ✅ 100% (dashboard standalone completata, link terreni completato)

**Completamento Generale Modulo Vigneto**: ~**85-90%** (Dashboard Standalone completata, Link Terreni completato)

### Moduli Specializzati (Generale)
- **Modulo Vigneto**: ~85-90%
- **Modulo Frutteto**: ~55-60% (Fase Base + Dashboard + Statistiche + Integrazione Lavori completati - 2026-01-29)
- **Modulo Oliveto**: 0% (pianificato)

**Completamento Generale Moduli Specializzati**: ~**47-50%** (Modulo Frutteto avanzato con Dashboard e Statistiche)

---

## 🎯 Priorità Prossimi Passi

### Alta Priorità (Completare MVP Vigneto)
1. ✅ ~~Integrazione Sistema Lavori/Diario~~ **COMPLETATO**
2. ✅ ~~Sistema Spese e Costi~~ **COMPLETATO**
3. ✅ ~~Tracciamento Poligono Vendemmia~~ **COMPLETATO**
4. ✅ ~~Rilevamento Automatico Vendemmia da Lavori~~ **COMPLETATO** (verificato nel codice)
5. ✅ ~~Calcolo Compensi Vendemmia~~ **COMPLETATO** (verificato nel codice)
6. ✅ ~~Filtri nelle Viste~~ **COMPLETATO** (2026-01-19)
7. ✅ ~~Dashboard Standalone Dedicata~~ **COMPLETATO** (2026-01-20 → 2026-01-21, vedi sezione 7)

### Media Priorità (Funzionalità Avanzate Vigneto)
7. ✅ ~~**Vista Potatura Standalone**~~ **COMPLETATA** (2026-01-31 – pagina + card dashboard)
8. ✅ ~~**Vista Trattamenti Standalone**~~ **COMPLETATA** (2026-01-31 – pagina + card dashboard)
9. 📝 **Diradamento Grappoli**
10. 📝 **Report/Bilancio (cross-moduli)** (PDF/Excel/CSV)
11. ✅ ~~**Integrazione Link da Pagina Terreni**~~ **COMPLETATO** (pulsante "🍇 Vigneto" nella pagina terreni)
12. ✅ ~~**Dashboard Standalone Dedicata**~~ **COMPLETATO** (2026-01-20 → 2026-01-21, vedi sezione 7)
13. 📝 **Sezione Vigneto nella Dashboard Principale** (dettagliata - opzionale)

### Bassa Priorità (Ottimizzazioni)
13. ✅ **Pianificazione Nuovi Impianti** (reticolato base - 2026-01-21) - ⏳ Card gestione salvate da implementare
14. 📝 **Notifiche e Alert Automatici**
15. 📝 **Ottimizzazioni Performance**

### Futuro (Altri Moduli)
16. ✅ ~~**Modulo Frutteto** (Fase Base)~~ **COMPLETATO** (2026-01-29)
17. 📝 **Modulo Frutteto** (Funzionalità Avanzate: potatura, diradamento, trattamenti, pianificazione impianti)
18. 📝 **Modulo Oliveto** (dopo completamento Vigneto)

---

## 📑 MODULO REPORT/BILANCIO - Stato Dettagliato

**Data implementazione**: 2026-01-22  
**Stato**: ✅ **IMPLEMENTATO (MVP)**

### ✅ COMPLETATO (2026-01-22)

#### 1. Struttura Base ✅
- ✅ Creata struttura `modules/report/` con:
  - `views/report-standalone.html` - Pagina principale
  - `services/report-service.js` - Servizio orchestratore
  - `adapters/vigneto-adapter.js` - Primo adapter per modulo Vigneto

#### 2. Funzionalità Core ✅
- ✅ Verifica accesso modulo report (con fallback robusto per race condition tenant)
- ✅ Caricamento dinamico adapter in base ai moduli attivi del tenant
- ✅ UI adattiva: mostra solo sezioni per moduli con adapter disponibili
- ✅ Integrazione dashboard: card "Report/Bilancio" visibile solo se modulo attivo

#### 3. Adapter Vigneto ✅
- ✅ Implementato `vigneto-adapter.js` che:
  - Espone `getFilters()`: lista vigneti e anni disponibili
  - Espone `getReportData()`: statistiche aggregate + vendemmie + lavori
  - Riutilizza servizi esistenti (`vigneto-statistiche-service.js`) - nessuna duplicazione

#### 4. UI Report Vigneto ✅
- ✅ Card riepilogo: Produzione (Qli), Resa Media (Qli/Ha), Costi Totali (€)
- ✅ Tabella Vendemmie: data, quantità, ettari, costo, destinazione
- ✅ Tabella Lavori: data, tipo, ore, costo
- ✅ Filtri: anno, vigneto (se modulo vigneto attivo)

#### 5. Export Excel ✅
- ✅ Export con ExcelJS (3 fogli):
  - **Riepilogo**: statistiche aggregate (produzione, resa, spese)
  - **Vendemmie**: dettaglio vendemmie con tutte le colonne
  - **Lavori**: dettaglio lavori completati
- ✅ Formattazione numeri (decimali, separatori)
- ✅ Download automatico file `.xlsx`

#### 6. Integrazione App ✅
- ✅ Modulo aggiunto in `core/admin/abbonamento-standalone.html` (attivabile/disattivabile)
- ✅ Card aggiunta in `core/js/dashboard-sections.js` (visibile solo se modulo attivo)
- ✅ Card aggiunta in entrambi i percorsi dashboard (con/senza Manodopera)

### 📋 DA IMPLEMENTARE (Prossimi Passi)

#### Adapter Altri Moduli
- [ ] Adapter Frutteto (modulo base implementato, adapter da creare)
- [ ] Adapter Oliveto (quando modulo implementato)
- [ ] Adapter Conto Terzi (report preventivi/fatture)
- [ ] Adapter Core (lavori, terreni, operai, macchine) - anche senza moduli specializzati

#### Funzionalità Avanzate
- [ ] Export PDF (jsPDF + html2canvas per screenshot grafici)
- [ ] Filtri avanzati (range date, categoria lavori, squadra, macchina)
- [ ] Report comparativi (anno su anno, vigneto vs vigneto)
- [ ] Template report personalizzabili

### 📊 Completamento Modulo Report/Bilancio

**MVP Base**: ✅ **100%** (Adapter Vigneto + Export Excel funzionante)  
**Funzionalità Avanzate**: 📝 **0%** (pianificate)

**Completamento Generale**: ~**40-50%** (MVP funzionante, mancano adapter altri moduli e PDF)

---

## 📝 Note Implementative

### Architettura
- ✅ Moduli completamente opzionali (non invasivi)
- ✅ Sub-collections separate per dati specifici
- ✅ Riferimenti a terreni (non duplicazione)
- ✅ Compatibilità retroattiva garantita

### Performance e Ottimizzazioni

#### Situazione Attuale (2026-01-21)
- ⚠️ **Problema Identificato**: La pagina statistiche vigneto (`vigneto-statistiche-standalone.html`) è già lenta (~2-3 secondi) con pochi dati
- ⚠️ **Rischio Scalabilità**: Con molti dati (più vigneti, più anni, più vendemmie/lavori) i tempi di caricamento potrebbero aumentare significativamente (stimati 10-15 secondi)

#### Problemi Attuali e Futuri

**Cosa Rallenta Ora**:
1. **Query Firestore Multiple**: Per ogni vigneto e anno vengono eseguite query separate per vendemmie e lavori
2. **Aggregazioni Lato Client**: Tutti i calcoli (spese, medie, totali) avvengono in JavaScript dopo aver caricato tutti i dati
3. **Ricreazione Completa Grafici**: Ad ogni cambio filtro vengono distrutti e ricreati tutti i 9 grafici
4. **Nessuna Cache**: Ogni volta si ricarica tutto da Firestore

**Cosa Peggiorerà con Più Dati**:
- Più vigneti = più query (crescita lineare)
- Più anni di storico = più query per ogni vigneto
- Più vendemmie/lavori = più documenti da processare in memoria
- Più varietà = più calcoli per i grafici qualità uva

#### Strategie di Ottimizzazione Identificate

**Breve Termine (Facile Implementazione)**:
1. **Debounce sui Filtri** (Impatto: Basso, ma migliora UX)
   - Attendere 300-500ms dopo l'ultimo cambio filtro prima di ricaricare
   - Evita ricariche multiple durante la selezione

2. **Cache Lato Client** (Impatto: Alto)
   - Salvare risultati in `localStorage` o `sessionStorage` con TTL (es. 5-10 minuti)
   - Evitare query ripetute per gli stessi filtri
   - Invalidare cache solo quando cambiano i dati (vendemmia creata/modificata)

3. **Loading Progressivo** (Impatto: Medio, migliora UX)
   - Mostrare i grafici man mano che si caricano
   - Invece di attendere tutti i dati, mostrare quelli pronti subito

4. **Limitare Dati di Default** (Impatto: Medio)
   - Mostrare solo anno corrente di default
   - Opzione "Mostra storico" per caricare altri anni
   - ✅ Già implementato: ridotto da 5 a 3 anni

**Medio Termine (Impatto Maggiore)**:
1. **Aggregazioni Pre-calcolate** (Impatto: Molto Alto) ⭐ **PRIORITÀ**
   - Creare documenti di aggregazione in Firestore (es. `statistiche_vigneto_2026`)
   - Aggiornarli in background quando cambiano vendemmie/lavori (Cloud Functions o trigger)
   - La pagina legge solo i documenti aggregati invece di calcolare tutto
   - **Stima miglioramento**: Da 10-15 secondi a 1-2 secondi anche con molti dati

2. **Indicizzazione Firestore** (Impatto: Alto)
   - Creare indici compositi per le query più frequenti
   - Riduce tempi di query anche con molti documenti

3. **Ottimizzazione Query Firestore** (Impatto: Alto)
   - Usare `where` e `limit` per ridurre documenti caricati
   - Evitare di caricare campi non necessari
   - Usare `select()` per limitare i campi

**Lungo Termine (Architettura)**:
1. **Cloud Functions per Aggregazioni Automatiche**
   - Trigger automatici quando cambiano vendemmie/lavori
   - Calcolo aggregazioni in background
   - Aggiornamento documenti statistiche

2. **Cache Lato Server** (se si aggiunge backend)
   - Redis o simile per cache aggregazioni
   - Riduce carico su Firestore

#### Stima Impatto Ottimizzazioni

**Scenario Attuale**:
- Con pochi dati: ~2-3 secondi
- Con molti dati (senza ottimizzazioni): ~10-15 secondi stimati

**Scenario Ottimizzato**:
- Con ottimizzazioni brevi/medie: ~3-5 secondi anche con molti dati
- Con aggregazioni pre-calcolate: ~1-2 secondi anche con molti dati

#### Priorità Consigliate

1. **Immediato**: Debounce filtri + Cache lato client + Loading progressivo
2. **Prossimo Sprint**: Aggregazioni pre-calcolate (impatto maggiore)
3. **Futuro**: Cloud Functions + Indicizzazione avanzata

#### Note Tecniche

- ✅ **Già Implementato**: Caricamento dati parallelo con `Promise.all` (ottimizzazione base)
- ✅ **Già Implementato**: Riduzione anni da 5 a 3 per ridurre query
- ⚠️ **Da Implementare**: Cache lato client
- ⚠️ **Da Implementare**: Aggregazioni pre-calcolate (soluzione più efficace)

### Scalabilità
- ✅ Pattern riutilizzabile (vigneto = template per frutteto/oliveto)
- ✅ Servizi comuni pianificati (non ancora implementati)
- ✅ Estensibile per nuovi moduli

### UX
- ✅ Dashboard adattiva (base implementata)
- ⚠️ Guide/Tour da implementare
- ⚠️ Messaggi informativi quando modulo non attivo

---

## 🔗 File Chiave

### Modulo Vigneto
- **Piano Generale**: `PLAN_MODULI_COLTURA_SPECIALIZZATI.md`
- **Piano Dettagliato**: `PLAN_MODULO_VIGNETO_DETTAGLIATO.md`
- **Modelli**: `modules/vigneto/models/`
- **Servizi**: `modules/vigneto/services/`
- **Viste**: `modules/vigneto/views/`

### Modulo Frutteto
- **Piano Generale**: `PLAN_MODULI_COLTURA_SPECIALIZZATI.md`
- **Piano Dettagliato**: `PLAN_MODULO_FRUTTETO_DETTAGLIATO.md`
- **Modelli**: `modules/frutteto/models/`
- **Servizi**: `modules/frutteto/services/`
- **Viste**: `modules/frutteto/views/`
- **Servizio Centralizzato**: `core/services/varieta-frutteto-service.js`

### Integrazioni
- **Sistema Lavori**: `modules/vigneto/services/lavori-vigneto-service.js`
- **Dashboard**: `core/dashboard-standalone.html`
- **Abbonamento**: `core/admin/abbonamento-standalone.html`

---

**Ultimo aggiornamento**: 2026-01-31 (Lista condivisa Calcolo materiali, forma allevamento Pianificazione frutteto, pali frutteto, Gestione lavori Impianto Frutteto; Pagine e card Potatura e Trattamenti – Vigneto e Frutteto; piano Potatura/Trattamenti da lavori)  
**Prossimo aggiornamento previsto**: Dopo implementazione evoluzione “Potatura/Trattamenti da lavori” o Modulo Oliveto

---

## 📝 Aggiornamento 2026-01-23: Implementazione Calcolo Materiali Impianto Vigneto

### ✅ COMPLETATO (2026-01-23)

#### 1. Pagina Calcolo Materiali ✅
- ✅ **Nuova pagina**: `modules/vigneto/views/calcolo-materiali-standalone.html`
- ✅ Lista pianificazioni salvate con verifica dati completi/incompleti
- ✅ Form configurazione con 17 tipi di impianto
- ✅ Precompilazione automatica valori in base al tipo impianto
- ✅ Calcolo e visualizzazione materiali in tabella
- ✅ Gestione pianificazioni incomplete (warning, disabilitazione calcolo)

#### 2. Servizio Calcolo Materiali ✅
- ✅ **Nuovo servizio**: `modules/vigneto/services/calcolo-materiali-service.js`
- ✅ **17 tipi di impianto** con configurazioni predefinite:
  - Sistemi a Spalliera (11 tipi): Guyot, Cordone Speronato, Cordone Libero, Cordone Doppio, Spalliera, Spalliera Doppia, Sylvoz, Casarsa, Doppio Capovolto, Raggiera, Scott Henry
  - Sistemi Sopraelevati (4 tipi): Pergola, Tendone, GDC (Geneva Double Curtain), Lyre
  - Sistemi Tradizionali (2 tipi): Alberello, Vite Maritata
- ✅ **Calcolo materiali completo**:
  - Pali (testata, intermedi, totali)
  - Fili di Portata (con diametro specifico, 4-5mm)
  - Fili di Vegetazione (con diametro specifico, 2-2.5mm, solo se presenti)
  - Braccetti (2 per palo, solo sistemi sopraelevati)
  - Tutori (1 per unità, sempre presenti)
  - Ancore (solo per pali testata, se necessari)
  - Legacci per Tutori (1 per tutore, se scelto "legacci")
  - Gancetti per Tutori (1 per tutore, se scelto "gancetti")
  - Ganci per Braccetti (2 per palo, se presenti braccetti)

#### 3. Distinzione Fili di Portata e Vegetazione ✅
- ✅ Separati fili di portata (sostegno principale, 4-5mm) e fili di vegetazione (contenimento chioma, 2-2.5mm)
- ✅ Configurazioni specifiche per ogni tipo di impianto
- ✅ Precompilazione automatica diametri

#### 4. Correzione Terminologia ✅
- ✅ **Tutori**: sostegno per pianta (1 per unità) - per far crescere eretta la pianta
- ✅ **Braccetti**: sostegni strutturali per pali (2 per palo) - per sistemi sopraelevati
- ✅ **Fissaggio Tutori**: scelta tra legacci o gancetti (mutualmente esclusivi)
- ✅ Rimossi "fili di legatura" (errore concettuale)

#### 5. Fix Salvataggio Calcoli Pianificazione ✅
- ✅ Corretto `onSalvaPianificazione()` per includere tutti i calcoli (numeroFile, numeroUnitaTotale, superficieNettaImpianto, ecc.)
- ✅ Pianificazioni salvate ora contengono dati completi

#### 6. Gestione Pianificazioni Incomplete ✅
- ✅ Verifica dati completi (numeroFile > 0, numeroUnitaTotale > 0, superficieNettaImpianto > 0)
- ✅ Icona warning (⚠️) nella tabella per pianificazioni incomplete
- ✅ Pulsante disabilitato ("Dati Incompleti") per pianificazioni incomplete
- ✅ Avviso utente quando si seleziona pianificazione incompleta
- ✅ Controllo nel calcolo per prevenire errori

#### 7. Fix Navigazione ✅
- ✅ Pulsante "Dashboard" reindirizza a `vigneto-dashboard-standalone.html`
- ✅ Rimosso pulsante "Vigneti"

#### 8. Pulizia Log Debug ✅
- ✅ Rimossi log di debug eccessivi da `pianificazione-impianto-service.js` e `calcolo-materiali-standalone.html`

**File Creati**:
- ✅ `modules/vigneto/views/calcolo-materiali-standalone.html`
- ✅ `modules/vigneto/services/calcolo-materiali-service.js`

**File Modificati**:
- ✅ `modules/vigneto/views/pianifica-impianto-standalone.html` (fix navigazione e salvataggio calcoli)
- ✅ `modules/vigneto/services/pianificazione-impianto-service.js` (pulizia log)

**Riferimento Completo**: Vedi `RIEPILOGO_LAVORI_2026-01-23.md` per dettagli completi.

---

---

## ✅ Verifica Codice - Correzioni Documento

**Data verifica**: 2026-01-18

### Correzioni Applicate

1. **Rilevamento Automatico Vendemmia**: 
   - ❌ Segnato come "PIANIFICATO" → ✅ **IMPLEMENTATO**
   - Funzioni `createVendemmiaFromLavoro` e `createVendemmiaFromAttivita` presenti e chiamate da hook

2. **Calcolo Compensi Vendemmia**: 
   - ❌ Segnato come "TODO nel codice" → ✅ **IMPLEMENTATO**
   - Funzione `calcolaCompensiVendemmia` presente e funzionante

3. **Filtri nelle Viste**: 
   - ⚠️ Segnato come "non implementato" → 🚧 **PARZIALMENTE IMPLEMENTATO**
   - Struttura HTML completa, logica filtraggio mancante (solo ~30 righe codice)

4. **Completamento Generale**: 
   - Aggiornato da ~65-70% a ~**70-75%** (più accurato)

### Stato Reale vs Documento Precedente

| Funzionalità | Documento Precedente | Stato Reale (Codice) |
|--------------|---------------------|---------------------|
| Rilevamento Automatico Vendemmia | 📝 Pianificato | ✅ **IMPLEMENTATO** |
| Calcolo Compensi Vendemmia | 🚧 TODO | ✅ **IMPLEMENTATO** |
| Filtri nelle Viste | 🚧 TODO | 🚧 **PARZIALE** (HTML ok, logica mancante) |
| Viste Potatura/Trattamenti | 📝 Da implementare | ✅ **IMPLEMENTATE** (2026-01-31 – pagine + card vigneto e frutteto) |
| Diradamento | 📝 Da implementare | ❌ **NON ESISTE** |
| Pianificazione Impianti | ✅ Implementato (2026-01-21) | ✅ **ESISTE** (`pianifica-impianto-standalone.html`) |
| Link da Terreni | 📝 Da implementare | ❌ **NON ESISTE** |
| Dashboard Dettagliata | 📝 Da implementare | ❌ **NON ESISTE** |
