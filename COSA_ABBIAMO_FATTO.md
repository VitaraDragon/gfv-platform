# 📋 Cosa Abbiamo Fatto - Riepilogo Core

## 🎯 Distinzione Importante

### "Core" = Fondamenta Tecniche (Quello che abbiamo fatto)

Il **core** che abbiamo sviluppato finora è la **base tecnica** dell'applicazione:

```
core/
├── services/          ✅ Servizi base (backend/logica)
│   ├── firebase-service.js      # Operazioni database
│   ├── auth-service.js          # Autenticazione
│   ├── tenant-service.js        # Multi-tenant
│   ├── permission-service.js    # Controllo permessi
│   └── role-service.js            # Gestione ruoli
│
└── models/            ✅ Modelli dati base
    ├── Base.js        # Classe base per modelli
    └── User.js         # Modello utente
```

**Cosa fa**: Fornisce le funzionalità base che TUTTE le parti dell'app useranno.

---

### "Applicazione" = Core + Moduli + UI (Da sviluppare)

L'applicazione completa includerà:

```
gfv-platform/
├── core/              ✅ FATTO - Servizi base
│   ├── services/      ✅ FATTO
│   ├── models/        ✅ FATTO
│   ├── auth/          ❌ DA FARE - UI autenticazione
│   ├── tenant/        ❌ DA FARE - UI gestione tenant
│   └── subscription/  ❌ DA FARE - UI abbonamenti
│
├── modules/           ✅ IN SVILUPPO - Moduli applicativi
│   ├── conto-terzi/   ✅ Fase 1 MVP completata (2025-12-07)
│   │   ├── models/Cliente.js
│   │   ├── services/clienti-service.js
│   │   └── views/ (3 pagine)
│   ├── parco-macchine/ ✅ Completato
│   ├── vendemmia/     ❌ Da refactorizzare da vecchia app
│   ├── clienti/       ❌ Da refactorizzare da vecchia app
│   ├── bilancio/      ❌ Da refactorizzare da vecchia app
│   └── ...
│
└── shared/            ❌ DA SVILUPPARE - Componenti condivisi
    ├── components/    ❌ Widget riutilizzabili
    ├── utils/         ❌ Utility functions
    └── styles/        ❌ Stili globali
```

---

## ✅ Cosa Abbiamo Fatto (Core Base)

### 1. Servizi Core ✅
- **Firebase Service**: Operazioni database con multi-tenant
- **Auth Service**: Login, registrazione, gestione sessione
- **Tenant Service**: Isolamento dati per tenant
- **Permission Service**: Controllo permessi basato su ruoli
- **Role Service**: Assegnazione/rimozione ruoli

### 2. Modelli Base ✅
- **Base Model**: Classe base per tutti i modelli
- **User Model**: Modello utente con ruoli e tenant

### 3. Configurazione ✅
- **Firebase**: Progetto configurato (Web, Android, iOS)
- **Git**: Repository separato creato

---

## ❌ Cosa Manca (Applicazione Completa)

### 1. UI Core (Da sviluppare)
- **auth/**: Pagine login, registrazione, reset password
- **tenant/**: Gestione tenant, configurazione azienda
- **subscription/**: Gestione abbonamenti, moduli attivi

### 2. Moduli Applicativi (Da sviluppare/refactorizzare)
- **vendemmia/**: Calcolatore vendemmia (da vecchia app)
- **clienti/**: Anagrafica clienti (da vecchia app)
- **bilancio/**: Report e statistiche (da vecchia app)

### 3. Componenti Condivisi (Da sviluppare)
- **components/**: Widget riutilizzabili (bottoni, form, tabelle)
- **utils/**: Funzioni utility (date, formattazione, validazione)
- **styles/**: Stili globali, tema, design system

---

## ✅ Badge Conto Terzi e Filtri per Categoria nel Diario Attività (2025-12-18) - COMPLETATO

### Obiettivo
Migliorare l'identificazione delle attività conto terzi nel diario attività e implementare filtri per categoria per Tipo Lavoro e Colture, raggruppando automaticamente tutte le varianti.

### Implementazione

#### Badge Conto Terzi
- ✅ **Badge nella colonna Tipo Lavoro**: Aggiunto badge "💼 Conto Terzi" nella colonna "Tipo Lavoro" per tutte le attività conto terzi
- ✅ **Visibilità sempre garantita**: Il badge è visibile anche quando la colonna "Cliente" non è presente (modalità core senza modulo conto terzi attivo)
- ✅ **Coerenza con dashboard**: Stesso stile e comportamento del badge presente nella dashboard manager

#### Filtri per Categoria

##### Filtro Tipo Lavoro
- ✅ **Dropdown con categorie**: Il filtro mostra le categorie principali (es. "Lavorazione del Terreno", "Potatura", "Trattamenti") invece dei tipi specifici
- ✅ **Raggruppamento automatico**: Selezionando una categoria, vengono mostrate tutte le attività con tipi lavoro appartenenti a quella categoria
- ✅ **Mapping intelligente**: Usa `categoriaId` dalla struttura gerarchica per mappare tipo lavoro → categoria
- ✅ **Fallback**: Se le categorie non sono ancora caricate, usa categorie predefinite

##### Filtro Colture
- ✅ **Dropdown con categorie**: Il filtro mostra le categorie principali (Vite, Frutteto, Seminativo, Orto, Prato, Olivo, Agrumeto, Bosco) invece delle colture specifiche
- ✅ **Raggruppamento automatico**: Selezionando una categoria (es. "Frutteto"), vengono mostrate tutte le attività con colture appartenenti a quella categoria (Albicocche, Pesche, Mele, Pere, ecc.)
- ✅ **Mapping intelligente**: Usa funzione `mapColturaToCategoria()` per mappare coltura specifica → categoria generica
- ✅ **Sempre disponibile**: Categorie hardcoded, sempre disponibili anche se le colture non sono ancora caricate

#### Funzioni di Mapping
- ✅ **`mapColturaToColorCategory()`**: Spostata in `shared/utils/map-colors.js` per riutilizzo in tutta l'applicazione
- ✅ **`mapColturaToCategoria()`**: Funzione helper locale sincrona per uso nei filtri
- ✅ **Mapping tipo lavoro**: Logica per trovare categoria tramite `categoriaId` in `tipiLavoroList`

#### Popolamento Dropdown
- ✅ **Funzioni dedicate**: Create `populateFiltroTipoLavoro()` e `populateFiltroColture()` per gestire il popolamento
- ✅ **Chiamate multiple**: I filtri vengono popolati sia in `loadListePersonalizzate()` che dopo il caricamento completo dei dati
- ✅ **Inizializzazione garantita**: `loadCategorieLavori()` viene sempre chiamata all'inizializzazione per assicurare che le categorie siano disponibili

### File Modificati
- `core/attivita-standalone.html` - Aggiunto badge conto terzi, implementati filtri per categoria, funzioni di mapping
- `shared/utils/map-colors.js` - Aggiunta funzione `mapColturaToColorCategory()` e `getColturaCategories()`

### Risultato
- ✅ Attività conto terzi facilmente identificabili con badge visibile
- ✅ Filtri più intuitivi e organizzati per categoria
- ✅ Raggruppamento automatico di tutte le varianti (es. tutte le varietà di vite, tutti i frutti, ecc.)
- ✅ Esperienza utente migliorata con filtri più semplici e logici

---

## ✅ Ottimizzazione Colori e Visibilità Mappe (2025-12-18) - COMPLETATO

### Obiettivo
Migliorare la visibilità dei perimetri delle mappe e implementare una palette colori più distinta e visibile per le diverse colture su tutte le mappe dell'applicazione.

### Implementazione

#### Palette Colori Ottimizzata
- ✅ **Nuova palette colori visibile**: Implementata palette con colori fill e stroke distinti per ogni categoria coltura
  - Vite: Rosso scuro brillante (#DC143C) / Rosso scuro perimetro (#8B0000)
  - Frutteto: Arancione brillante (#FF6600) / Arancione scuro perimetro (#CC5500)
  - Seminativo: Giallo oro (#FFD700) / Giallo scuro perimetro (#B8860B)
  - Orto: Verde lime brillante (#00FF00) / Verde scuro perimetro (#00AA00)
  - Prato: Verde chiaro (#90EE90) / Verde scuro perimetro (#228B22)
  - Olivo: Viola medio (#9370DB) / Viola scuro perimetro (#6A5ACD)
  - Agrumeto: Arancione (#FFA500) / Arancione scuro perimetro (#FF8C00)
  - Bosco: Marrone sella (#8B4513) / Marrone scuro perimetro (#654321)
  - Default: Blu dodger (#1E90FF) / Blu scuro perimetro (#0066CC) - invece di verde

#### Miglioramento Visibilità Perimetri
- ✅ **Stroke più spesso**: Aumentato `strokeWeight` da 2px a 3px
- ✅ **Opacità massima**: Aumentato `strokeOpacity` da 0.8 a 1.0
- ✅ **Colori stroke scuri**: Ogni categoria ha una versione scura del colore per il perimetro per massima visibilità

#### Mapping Intelligente Colture
- ✅ **Funzione `mapColturaToColorCategory()`**: Implementata funzione che mappa automaticamente colture specifiche a categorie generiche
  - Esempi: "Vite da Vino" → "Vite", "Albicocche" → "Frutteto", "Pomodoro" → "Orto"
  - Supporta mapping per tutte le varianti di colture (Vite da Tavola, Vite da Vino, tutte le varietà di frutti, ecc.)
  - Usa anche la categoria se disponibile nel terreno per mapping più accurato

#### Fix Bug Mappa Clienti
- ✅ **Eliminato bagliore bianco**: Risolto problema del flash bianco durante il cambio cliente nella mappa clienti
  - Implementata creazione anticipata dei nuovi poligoni prima della rimozione dei vecchi
  - Eliminato gap temporale tra rimozione vecchi elementi e aggiunta nuovi
  - Cambiato background container da grigio chiaro (#f0f0f0) a nero scuro (#1a1a1a)

#### Coerenza tra Mappe
- ✅ **Stessa palette su tutte le mappe**: Applicata la stessa palette colori e parametri a:
  - Dashboard (`core/dashboard-standalone.html`)
  - Gestione Terreni (`core/terreni-standalone.html`)
  - Mappa Clienti (`modules/conto-terzi/views/mappa-clienti-standalone.html`)

#### Tracciamento Confini Terreni
- ✅ **Colore dinamico in base a coltura**: Il tracciamento confini in "Gestione Terreni" ora usa il colore della coltura selezionata invece di sempre verde
- ✅ **Listener per cambio coltura**: Implementato listener che aggiorna il colore del poligono quando si cambia la coltura selezionata

### File Modificati
- `core/dashboard-standalone.html` - Aggiornata palette colori e parametri perimetri
- `core/terreni-standalone.html` - Aggiunta palette colori, mapping colture, colore dinamico tracciamento
- `modules/conto-terzi/views/mappa-clienti-standalone.html` - Aggiornata palette colori, fix bug cambio cliente
- `shared/utils/map-colors.js` - Creato file centralizzato per palette colori (per uso futuro)

### Risultato
- ✅ Perimetri terreni molto più visibili su mappa satellitare
- ✅ Colori distinti e riconoscibili per ogni categoria coltura
- ✅ Nessun bagliore bianco durante cambio cliente nella mappa clienti
- ✅ Coerenza visiva tra tutte le mappe dell'applicazione
- ✅ Leggende aggiornate con i nuovi colori

---

## ✅ Miglioramenti Modulo Conto Terzi - Registrazione Ore e UI (2025-12-13)

### Modifiche Form Rapido Conto Terzi
- ✅ **Sostituito campo singolo "Ore Lavorate"** con sistema completo ora inizio/fine/pause
- ✅ **Aggiunto calcolo automatico ore nette** nel form rapido attività conto terzi
- ✅ **Modificato `salvaAttivitaRapida`** per leggere orari invece di ore singole
- ✅ **Validazione completa orari** (ora fine > ora inizio, ore nette > 0)
- ✅ **Event listeners** per calcolo automatico in tempo reale

### Modifiche Modal Principale Attività Conto Terzi
- ✅ **Sostituito campo "Ore Lavorate"** con sistema ora inizio/fine/pause
- ✅ **Aggiunto calcolo automatico ore nette** anche nel modal principale
- ✅ **Funzione `updateOreNetteContoTerzi`** per aggiornamento automatico
- ✅ **Modificato `handleSaveAttivita`** per calcolare ore nette da orari

### Miglioramenti Funzione `generaVoceDiarioContoTerzi`
- ✅ **Aggiunto parametro opzionale `orariOpzionali`** per passare orari dalla attività salvata
- ✅ **Riutilizzo orari** invece di default quando disponibili
- ✅ **Implementato in entrambi i file**: `attivita-standalone.html` e `gestione-lavori-standalone.html`

### Correzione Visualizzazione Lavori Completati Conto Terzi
- ✅ **Ore visualizzate correttamente**: usa `totaleOreAttivita` quando Manodopera non attivo
- ✅ **Percentuale completamento**: 100% quando lavoro completato senza zone tracciate
- ✅ **Raggruppamento ore per data**: unisce ore attività con ore validate per dettagli giornalieri
- ✅ **Visualizzazione superficie**: mostra solo superficie totale quando non ci sono zone tracciate

### Correzione UI Pagina "Lavori da Pianificare"
- ✅ **Gradiente blu invece di verde** quando aperta da dashboard conto terzi
- ✅ **Rilevamento automatico modalità conto terzi** da parametri URL
- ✅ **Script nell'head** per applicare stili immediatamente (evita flash verde)
- ✅ **Link dashboard corretto**: torna alla dashboard conto terzi invece che principale
- ✅ **Titolo aggiornato**: "Lavori da Pianificare - Conto Terzi"

### Miglioramenti Card Statistiche
- ✅ **Colori distintivi per card progresso**:
  - In Ritardo: gradiente rosso (`#dc3545` → `#c82333`)
  - In Tempo: gradiente verde (`#28a745` → `#218838`)
  - In Anticipo: gradiente blu chiaro (`#17a2b8` → `#138496`)
- ✅ **Esclusione dalla regola generale** che applica blu a tutte le card
- ✅ **Testo bianco** per buon contrasto su sfondi colorati

### Correzioni Tecniche
- ✅ **Rimosso script inline** dal template literal per evitare errori di sintassi
- ✅ **Funzione `initCalcoloOreNetteRapido`** separata per inizializzazione form rapidi
- ✅ **Rimozione attributo `required`** dai campi Conto Terzi quando sezione nascosta
- ✅ **Rilevamento modalità conto terzi** migliorato con controllo parametri URL

### File Modificati
- `core/attivita-standalone.html` - Form rapido, modal principale, visualizzazione lavori completati
- `core/admin/gestione-lavori-standalone.html` - Stili UI, link dashboard, card statistiche
- `core/models/Attivita.js` - Già aggiornato in precedenza con `clienteId` e `lavoroId`

### Risultato
- ✅ Nessuna duplicazione inserimento ore: sistema unificato ora inizio/fine/pause
- ✅ Calcolo automatico ore nette in tutti i form
- ✅ UI coerente con tema Conto Terzi (blu) invece di verde
- ✅ Statistiche ben visibili con colori distintivi
- ✅ Navigazione corretta tra dashboard e pagine

---

## ✅ Uniformazione Stile Statistiche Colorato (2025-01-26)

### Obiettivo
Uniformare lo stile di tutte le statistiche applicando gradienti colorati per creare coerenza visiva in tutta l'applicazione.

### Implementazione

#### Statistiche Manodopera
- **File modificato**: `core/admin/statistiche-manodopera-standalone.html`
- Statistiche Lavori: 4 card colorate (Blu, Arancione, Verde, Viola)
- Statistiche Ore: 4 card colorate (Verde, Arancione, Viola)
- Statistiche Squadre: 4 card colorate (Blu, Verde)
- Statistiche Superficie: 3 card colorate (Verde, Blu, Viola)
- Report Ore Operai: 4 card aggregate colorate

#### Statistiche Core Base
- **File modificato**: `core/statistiche-standalone.html`
- Card "Terreni Totali" colorata (Blu) per coerenza
- Statistiche Terreni e Macchine già colorate, verificate

#### Palette Colori
- Blu: metriche neutre/informative
- Verde: metriche positive
- Arancione: metriche intermedie
- Viola: metriche speciali
- Rosso: metriche critiche
- Turchese: metriche informative alternative

---

## ✅ Gestione Affitti Terreni e Statistiche (2025-01-26)

### Obiettivo
Aggiungere la possibilità di specificare se un terreno è di proprietà o in affitto, con monitoraggio scadenze e statistiche complete.

### Implementazione

#### Modello Terreno Esteso
- **File modificato**: `core/models/Terreno.js`
- Campo `tipoPossesso`: "proprieta" | "affitto" (default: "proprieta")
- Campo `dataScadenzaAffitto`: Data scadenza contratto (obbligatorio se affitto)
- Campo `canoneAffitto`: Canone mensile in euro (opzionale)
- Validazione: Data scadenza obbligatoria per terreni in affitto
- Retrocompatibilità: Terreni esistenti senza campo considerati "proprietà"

#### Sistema Alert Scadenza
- **File modificato**: `core/terreni-standalone.html`
- Traffic light system: Verde (>6 mesi), Giallo (1-6 mesi), Rosso (≤1 mese), Grigio (scaduto)
- Visualizzazione: Pallini colorati nella lista terreni con tooltip
- Filtri: Per tipo possesso e alert scadenza

#### Card Dashboard Affitti
- **File modificato**: `core/dashboard-standalone.html`, `core/js/dashboard-sections.js`
- Card "Affitti in Scadenza" per Core Base e Manager
- Mostra solo affitti urgenti (rosso/giallo), massimo 5
- Link diretto a gestione terreni

#### Statistiche Terreni
- **File modificato**: `core/statistiche-standalone.html`, `core/admin/statistiche-manodopera-standalone.html`
- 8 metriche: Totali, Proprietà, Affitto, Superficie, Canoni
- Grafici Chart.js: Distribuzione terreni e superficie
- Lista affitti in scadenza completa

#### Layout Core Base Ottimizzato
- **File modificato**: `core/dashboard-standalone.html`, `core/styles/dashboard.css`
- Layout con 5 card sopra mappa (Terreni, Diario, Affitti, Statistiche, Abbonamento)
- Larghezza ottimizzata: 240px (desktop), 220px (tablet)
- Padding ridotto per card più compatte

---

## ✅ Sistema Categorie Gerarchico Unificato (2025-01-23)

### Obiettivo
Unificare le categorie di attrezzi e lavori in un unico sistema gerarchico per evitare duplicazioni e migliorare l'organizzazione.

### Modello Unificato
- **File creato**: `core/models/Categoria.js`
- Struttura gerarchica con `parentId` per sottocategorie
- Campo `applicabileA` per specificare se categoria si applica ad attrezzi/lavori/entrambi
- 10 categorie principali predefinite + sottocategorie

### Servizio Unificato
- **File creato**: `core/services/categorie-service.js`
- CRUD completo categorie
- Supporto gerarchico completo
- Funzioni per ottenere struttura gerarchica

### Migrazione Automatica
- Migrazione automatica da `categorieAttrezzi` → `categorie`
- Migrazione automatica da `categorieLavori` → `categorie`
- Creazione automatica categorie predefinite mancanti
- Idempotente e sicura

### UI Gerarchica
- Dropdown categoria principale + sottocategoria dinamica
- Event listener automatici per mostrare sottocategorie
- Filtri migliorati per includere sottocategorie
- Supporto completo per creazione tipi lavoro specifici

### File Modificati
- `core/admin/gestione-macchine-standalone.html` - UI gerarchica attrezzi
- `core/admin/gestione-lavori-standalone.html` - UI gerarchica lavori
- `modules/parco-macchine/models/Macchina.js` - Usa categoriaId unificato
- `core/models/TipoLavoro.js` - Usa categoriaId unificato

---

## 🎯 Risposta alla Tua Domanda

### "Il core è solo quello che abbiamo fatto?"

**SÌ e NO**:

- **SÌ**: Abbiamo fatto il **core tecnico** (servizi e modelli base)
- **NO**: Manca ancora il **core UI** (pagine auth, tenant, subscription)
- **NO**: Manca l'**applicazione** (moduli vendemmia, clienti, bilancio)

### "Il core è la parte che sviluppiamo adesso?"

**SÌ**: Il core tecnico è fatto. Ora possiamo:
1. Sviluppare i moduli applicativi (vendemmia, clienti, bilancio)
2. Creare le UI core (auth, tenant, subscription)
3. Creare componenti condivisi

---

## 📊 Confronto: Vecchia App vs Nuova App

### Vecchia App (Monolitica)
```
vecchia app/
├── index.html          # Tutto insieme
├── anagrafica_clienti.html
├── bilancio.html
└── [tutto in file HTML grandi]
```

### Nuova App (Modulare) - Target
```
gfv-platform/
├── core/               ✅ Base tecnica (FATTO)
│   └── services/      ✅ FATTO
│
├── modules/            ❌ Moduli (DA FARE)
│   ├── vendemmia/     ❌ Da refactorizzare
│   ├── clienti/        ❌ Da refactorizzare
│   └── bilancio/      ❌ Da refactorizzare
│
└── shared/             ❌ Condivisi (DA FARE)
```

---

## 🚀 Prossimi Passi di Sviluppo

### Fase 1: Core UI (Prossimo)
- [ ] Pagine autenticazione (login, registrazione)
- [ ] Dashboard base
- [ ] Gestione tenant/azienda

### Fase 2: Moduli (Dopo)
- [ ] Refactorizzare modulo vendemmia da vecchia app
- [ ] Refactorizzare modulo clienti da vecchia app
- [ ] Refactorizzare modulo bilancio da vecchia app

### Fase 3: Componenti (In parallelo)
- [ ] Componenti UI riutilizzabili
- [ ] Design system
- [ ] Utility functions

---

## 💡 In Sintesi

**Core tecnico** = ✅ FATTO (servizi, modelli, configurazione)  
**Core UI** = ❌ DA FARE (pagine auth, tenant, subscription)  
**Moduli** = ❌ DA FARE (vendemmia, clienti, bilancio)  
**Componenti** = ❌ DA FARE (widget, utils, styles)

**Il core che abbiamo fatto è la FONDAMENTA. Ora possiamo costruire l'applicazione sopra!** 🏗️

---

## 📝 Aggiornamenti Recenti (2025-01-20)

### Dashboard Ruoli Ottimizzate ✅
- **Dashboard Operaio**: Rimossa visualizzazione Core Base (terreni, diario attività, statistiche, abbonamento)
  - Visualizza solo: Comunicazioni dal Caposquadra, Lavori di Oggi, Segna Ore, Le Mie Ore
  - Statistiche personali: Lavori Oggi, Ore Segnate, Stato
  - Sezione "Le Mie Ore" con riepilogo (Validate/Da validare/Rifiutate) e ultime 5 ore segnate
- **Dashboard Caposquadra**: Rimossa visualizzazione Core Base
  - Visualizza solo: Statistiche squadra, Comunicazione Rapida, Azioni Rapide, Lavori Recenti
- **Logica**: Core Base nascosto solo se utente è SOLO Operaio o SOLO Caposquadra
- **File modificati**: `core/dashboard-standalone.html`

### Diario da Lavori Automatico ✅
- **Campo Tipo Lavoro**: Aggiunto campo obbligatorio `tipoLavoro` al modello Lavoro
  - Validazione: campo obbligatorio
  - Dropdown popolato dalle liste personalizzate (predefiniti + custom)
- **Form Lavori**: Aggiunto dropdown Tipo Lavoro nel form creazione/modifica lavoro
  - Caricamento automatico tipi lavoro dalle liste personalizzate
  - Salvataggio tipo lavoro nel documento lavoro
- **Generazione Automatica Attività**: Funzione per generare attività dalle ore validate
  - Raggruppa ore validate per data e lavoro
  - Calcola orario inizio (prima ora) e fine (ultima ora) del giorno
  - Somma pause e ore nette totali
  - Conta numero operai che hanno lavorato
  - Recupera dati terreno (nome, coltura) e lavoro (tipo lavoro)
- **Vista Dashboard Manager**: Nuova sezione "Diario da Lavori"
  - Tabella con colonne: Data, Terreno, Tipo Lavoro, Coltura, Orario, Ore, Operai, Lavoro
  - Mostra ultime 20 attività generate
  - Ordinamento per data (più recenti prima)
  - Messaggio quando non ci sono attività
- **File modificati**: 
  - `core/models/Lavoro.js`
  - `core/admin/gestione-lavori-standalone.html`
  - `core/dashboard-standalone.html`

### Sistema Comunicazioni Squadra e Separazione Impostazioni ✅
- Separazione impostazioni per ruolo:
  - Manager/Amministratore: tutte le sezioni (Azienda, Poderi, Liste, Account, Password)
  - Caposquadra: solo Comunicazioni Squadra + Account + Password
  - Operaio: solo Account + Password
- Scheda veloce comunicazioni nella dashboard caposquadra:
  - Card "Invia Comunicazione Rapida" direttamente nella dashboard
  - Pre-compilazione automatica podere, campo e lavoro dal primo lavoro attivo
  - Dropdown per selezionare lavoro se ce ne sono più di uno
  - Solo orario (default 7:00) e note da compilare
  - Invio rapido in un click
- Sistema comunicazioni di ritrovo per caposquadra:
  - Pre-compilazione automatica podere/terreno dal lavoro assegnato
  - Dropdown selezione lavoro per pre-compilare automaticamente
  - Invio comunicazione alla squadra con notifica nella dashboard operai
  - Lista comunicazioni inviate con statistiche conferme
  - Versione completa nelle Impostazioni per casi particolari
- Visualizzazione comunicazioni nella dashboard operaio:
  - Card comunicazioni attive con dettagli (podere, campo, data, orario)
  - Conferma ricezione obbligatoria
  - Link Google Maps per indicazioni al podere geolocalizzato
  - Stato visivo (giallo se non confermata, verde se confermata)

### Campo Cellulare per Utenti ✅
- Aggiunto campo cellulare opzionale nel form invito utente (Manager)
- Campo cellulare obbligatorio nella registrazione via invito
- Visualizzazione contatti squadra per caposquadra con link cliccabili (`mailto:` e `tel:`)
- Validazione formato cellulare

### Gestione Poderi ✅
- Aggiunta sezione "Gestione Poderi" in Impostazioni
- Integrazione Google Maps con visualizzazione satellitare
- Marker draggable per posizionamento preciso poderi
- Ricerca indirizzo con geocoding e reverse geocoding
- Campo podere nei terreni con dropdown
- Salvataggio coordinate poderi per indicazioni stradali

**File modificati**:
- `core/admin/gestisci-utenti-standalone.html`
- `core/auth/registrazione-invito-standalone.html`
- `core/admin/gestione-squadre-standalone.html`
- `core/admin/impostazioni-standalone.html`
- `core/terreni-standalone.html`
- `core/models/Terreno.js`
- `core/dashboard-standalone.html`

## 📝 Aggiornamenti Recenti (2025-01-20)

### Riorganizzazione Dashboard Manager con Manodopera Attivo ✅
- **Problema**: Dashboard confusa con duplicazione tra diario manuale Core Base e diario automatico
- **Soluzione**: 
  - Core Base nascosto quando Manodopera è attivo (Manager e Amministratore)
  - Card Amministrazione che porta a pagina dedicata
  - Card Statistiche che porta a pagina dedicata
  - Sezione Gestione Manodopera completa mantenuta
  - Diario da Lavori come sezione principale
- **Risultato**: Dashboard più pulita, organizzata e intuitiva
- **File modificati**: `core/dashboard-standalone.html`

### Pagina Amministrazione Dedicata ✅
- **File creato**: `core/admin/amministrazione-standalone.html`
- **Funzionalità**:
  - Statistiche: Piano Attuale, Moduli Attivi, Utenti Totali
  - Card cliccabili: Gestisci Utenti, Gestione Squadre, Abbonamento
  - Design coerente con altre pagine admin
  - Verifica permessi automatica

### Pagina Statistiche Manodopera Dedicata ✅
- **File creato**: `core/admin/statistiche-manodopera-standalone.html`

### Calcolo Compensi Operai ✅
- **File creato**: `core/admin/compensi-operai-standalone.html`
- **Funzionalità**: Pagina dedicata per calcolo compensi operai
- **Sistema tariffe**: Tariffe default configurabili per tipo operaio + tariffe personalizzate per singolo operaio
- **Calcolo automatico**: Basato su ore validate nel periodo selezionato
- **Esportazione Excel**: Formato professionale con logo aziendale, colori, formattazione completa
- **Formato ore**: Leggibile (es. "64h 10min" invece di "64.17")
- **Accesso**: Solo Manager/Amministratore, richiede modulo Manodopera attivo
- **Statistiche implementate**:
  - Lavori: Totali, Attivi, Completati, Pianificati
  - Ore: Validate (Mese/Totale), Da Validare, Media Ore/Giorno
  - Squadre: Totali, Attive, Operai Totali, Operai Online
  - Superficie: Lavorata, Totale Terreni, % Lavorata
- **Struttura modulare**: Facile aggiungere nuove statistiche in futuro
- **File modificati**: `core/dashboard-standalone.html` (aggiunta card Statistiche)

### Mappa Aziendale Dashboard Manager ✅
- **Layout superiore dashboard Manager**:
  - Riga superiore con layout a 2 colonne:
    - Sinistra: 3 card verticali (Amministrazione, Statistiche, Terreni)
    - Destra: Mappa Aziendale grande che occupa tutto lo spazio disponibile
  - Layout responsive: su schermi <1024px le card si impilano sopra la mappa
- **Mappa satellitare completa**:
  - Visualizzazione tutti i terreni con confini geolocalizzati (poligoni)
  - Mappa satellitare Google Maps con zoom automatico su tutti i terreni
  - Colori distinti per coltura (palette predefinita: Vite, Frutteto, Seminativo, ecc.)
  - Legenda colture dinamica (si aggiorna in base ai terreni presenti)
  - Click su terreno per vedere info dettagliate (nome, podere, coltura, superficie, note)
  - Info window con link diretto a dettagli terreno
  - Visualizzazione solo terreni con mappa tracciata
- **Responsive design**:
  - Desktop (>1200px): colonna sinistra 280px, mappa occupa il resto
  - Tablet (1024-1200px): colonna sinistra 260px, mappa più larga
  - Tablet piccolo (<1024px): layout verticale (card sopra, mappa sotto)
  - Mobile (<768px): mappa compatta con altezza ridotta
  - Ridimensionamento automatico mappa al cambio dimensione finestra
- **Integrazione dashboard**:
  - Mappa visibile per Manager e Amministratore
  - Posizionata in alto dopo le card Amministrazione/Statistiche
  - Sotto la mappa: Gestione Manodopera e Diario da Lavori
  - Allineamento perfetto con margine destro sezione "Gestione Manodopera"
- **File modificati**: `core/dashboard-standalone.html`

### Miglioramenti Mappa Aziendale Fase 2 ✅ COMPLETATI (2025-01-20)

**1. Overlay Lavori Attivi** ✅
- Visualizzazione zone lavorate come poligoni verdi semi-trasparenti sulla mappa
- Toggle nell'header per mostrare/nascondere overlay
- Info window con dettagli lavoro quando si clicca su zona lavorata
- Caricamento automatico lavori attivi e zone lavorate dal modulo Manodopera
- Legenda aggiornata con sezione "Zone Lavorate"

**2. Filtri Podere e Coltura** ✅
- Dropdown filtri nell'header mappa (Podere e Coltura)
- Filtraggio dinamico terreni visualizzati sulla mappa
- Filtri combinabili (podere E coltura)
- Legenda aggiornata automaticamente in base ai filtri attivi
- Zoom automatico sui terreni filtrati

**3. Indicatori Stato Lavori** ✅
- Marker colorati per ogni lavoro attivo sulla mappa
- Colori: rosso (in ritardo), giallo (in tempo), verde (in anticipo), blu (in corso)
- Marker posizionati al centro del terreno associato
- Info window completa con dettagli lavoro (nome, terreno, tipo, stato, progresso, superficie, date)
- Toggle nell'header per mostrare/nascondere indicatori
- Legenda aggiornata con spiegazione colori indicatori

**4. Zoom Automatico Migliorato** ✅
- Padding personalizzato (50px standard, 100px per aree grandi) per evitare taglio bordi
- Zoom intelligente basato su dimensione area:
  - Terreni molto piccoli: zoom ravvicinato (livello 18)
  - Terreni normali: zoom automatico con padding standard
  - Aree molto grandi: zoom più lontano con padding maggiore
- Zoom automatico quando si applicano filtri
- Gestione responsive al ridimensionamento finestra

**File modificati**: `core/dashboard-standalone.html`

## 📝 Aggiornamenti Recenti (2025-01-20) - Mappa Aziendale

### Mappa Aziendale Dashboard Manager ✅
- **Layout superiore dashboard Manager**:
  - Riga superiore con layout a 2 colonne:
    - Sinistra: 3 card verticali (Amministrazione, Statistiche, Terreni)
    - Destra: Mappa Aziendale grande che occupa tutto lo spazio disponibile
  - Layout responsive: su schermi <1024px le card si impilano sopra la mappa
- **Mappa satellitare completa**:
  - Visualizzazione tutti i terreni con confini geolocalizzati (poligoni)
  - Mappa satellitare Google Maps con zoom automatico su tutti i terreni
  - Colori distinti per coltura (palette predefinita)
  - Legenda colture dinamica
  - Click su terreno per vedere info dettagliate
  - Responsive design per tutti i dispositivi
- **Integrazione dashboard**:
  - Mappa visibile per Manager e Amministratore
  - Posizionata in alto dopo le card Amministrazione/Statistiche
  - Sotto la mappa: Gestione Manodopera e Diario da Lavori
  - Allineamento perfetto con margine destro sezione "Gestione Manodopera"

**File modificati**: `core/dashboard-standalone.html`

### Miglioramenti Pianificati Mappa Aziendale (Fase 2)
**Priorità implementazione**:
1. **Overlay Lavori Attivi** (Alta priorità) - Visualizzazione zone lavorate sulla mappa
2. **Filtri (Podere, Coltura)** (Media priorità) - Filtrare terreni per podere/coltura
3. **Indicatori Stato Lavori** (Media priorità) - Marker colorati per lavori attivi
4. **Zoom Automatico Migliorato** (Bassa priorità) - Miglioramenti zoom esistente

## 📝 Aggiornamenti Recenti (2025-01-21)

### Gestione Contratti Operai ✅
**Data completamento**: 2025-01-21

**File creati**:
- `core/admin/gestione-operai-standalone.html` - Pagina dedicata gestione contratti operai

**File modificati**:
- `core/models/User.js` - Aggiunti campi contratto (tipoOperaio, tipoContratto, dataInizioContratto, dataScadenzaContratto, noteContratto)
- `core/dashboard-standalone.html` - Aggiunto link Gestione Operai nella sezione Amministrazione
- `core/admin/amministrazione-standalone.html` - Aggiunta card Gestione Operai

**Funzionalità implementate**:
- ✅ Pagina Gestione Operai con filtro automatico per ruolo "operaio"
- ✅ Tabella completa con colonne: Nome, Email, Tipo Operaio, Tipo Contratto, Data Inizio, Data Scadenza, Alert, Azioni
- ✅ Tipi Operai: 6 tipi predefiniti (Semplice, Specializzato, Trattorista, Meccanico, Elettricista, Altro)
- ✅ Gestione Contratti: Tipo Contratto (Stagionale/Determinato/Indeterminato), Date Inizio/Scadenza, Note
- ✅ Sistema Semaforo Alert: Verde (>30 giorni), Giallo (8-30 giorni), Rosso (0-7 giorni), Grigio (scaduto)
- ✅ Filtri Avanzati: Per Stato, Tipo Contratto, Tipo Operaio, Alert
- ✅ Storico Contratti: Contratti scaduti rimangono visibili per storico
- ✅ Validazione: Data scadenza >= data inizio, campi obbligatori verificati
- ✅ Permessi: Solo Manager/Amministratore può vedere/modificare contratti

**Vantaggi**:
- ✅ Scadenziario completo per monitorare rinnovi contratti
- ✅ Sistema alert automatico per non perdere scadenze
- ✅ Tipi operai pronti per calcolo compensi futuri
- ✅ Storico completo contratti per tracciabilità
- ✅ Semplice e funzionale, senza complessità normative

**File modificati**:
- `core/models/User.js`
- `core/admin/gestione-operai-standalone.html`
- `core/dashboard-standalone.html`
- `core/admin/amministrazione-standalone.html`

### Report Ore Operai con Filtri Avanzati ✅
**Data completamento**: 2025-01-21

**File modificati**:
- `core/admin/statistiche-manodopera-standalone.html` - Aggiunta sezione Report Ore Operai completa

**Funzionalità implementate**:
- ✅ Sezione Report Ore Operai nella pagina Statistiche Manodopera
- ✅ Filtri periodo: Oggi / Questa Settimana / Questo Mese / Personalizzato
- ✅ Filtro per Tipo Operaio: Tutti i 6 tipi disponibili
- ✅ Filtro per Singolo Operaio: Dropdown con lista operai completa
- ✅ Aggiornamento automatico con debounce (700ms) quando si cambiano i filtri
- ✅ Statistiche aggregate: Ore Totali, Media Ore/Giorno, Giorni Lavorati, Operai Attivi
- ✅ Statistiche per tipo operaio: Card con ore aggregate per categoria
- ✅ Tabella report operai: Colonne complete con ordinamento automatico
- ✅ Formattazione ore leggibile (es. "8h 30min")
- ✅ Colori distinti per ore validate (verde) e da validare (giallo)
- ✅ Pulsante "Pulisci Filtri" per reset rapido

**Vantaggi**:
- ✅ Analisi rapida ore lavorate per periodo/tipo/singolo operaio
- ✅ Aggiornamento automatico senza click ripetuti (miglior UX)
- ✅ Statistiche aggregate sempre aggiornate in base ai filtri
- ✅ Flessibilità filtri combinati per analisi approfondite
- ✅ Performance ottimizzata con debounce per evitare query multiple

**File modificati**:
- `core/admin/statistiche-manodopera-standalone.html`

### Calcolo Compensi Operai ✅
**Data completamento**: 2025-01-23

**File creati**:
- `core/admin/compensi-operai-standalone.html` - Pagina dedicata calcolo compensi operai

**File modificati**:
- `core/models/User.js` - Aggiunto campo `tariffaPersonalizzata`
- `core/admin/impostazioni-standalone.html` - Aggiunta sezione "Tariffe Operai"
- `core/admin/gestione-operai-standalone.html` - Aggiunto campo tariffa personalizzata
- `core/admin/statistiche-manodopera-standalone.html` - Rimossa sezione compensi, aggiunto link
- `core/dashboard-standalone.html` - Aggiunto link Compensi Operai
- `core/admin/amministrazione-standalone.html` - Aggiunta card Compensi Operai

**Funzionalità implementate**:
- ✅ Pagina dedicata per calcolo compensi (separata da Statistiche)
- ✅ Sistema tariffe: default per tipo operaio + personalizzate per singolo operaio
- ✅ Calcolo automatico basato su ore validate nel periodo selezionato
- ✅ Filtri: periodo (oggi/settimana/mese/personalizzato), tipo operaio, singolo operaio
- ✅ Statistiche aggregate: compenso totale, operai compensati, ore compensate, media
- ✅ Formato ore leggibile: "64h 10min" invece di "64.17"
- ✅ Esportazione Excel professionale:
  - Formato .xlsx nativo (nessun alert Excel)
  - Logo aziendale grande e leggibile (righe 1-7)
  - Formattazione completa con colori (intestazioni verdi, righe alternate, colonna compensi evidenziata)
  - Formato numeri: ore leggibili, tariffe e compensi in euro italiano
  - Tabella inizia dalla riga 8 con margine superiore corretto

**Vantaggi**:
- ✅ Gestione finanziaria dedicata (non più in Statistiche)
- ✅ Sistema tariffe flessibile e scalabile
- ✅ Esportazione professionale pronta per condivisione/documentazione
- ✅ Pronto per integrazione futura con modulo Bilancio

**File modificati**:
- `core/admin/compensi-operai-standalone.html`
- `core/admin/statistiche-manodopera-standalone.html`
- `core/admin/impostazioni-standalone.html`
- `core/admin/gestione-operai-standalone.html`
- `core/models/User.js`
- `core/dashboard-standalone.html`
- `core/admin/amministrazione-standalone.html`

### Fix Superficie Lavorata Dashboard Manager ✅
**Data completamento**: 2025-01-21

**Problema risolto**:
- La card "Superficie Lavorata" nella dashboard Manager mostrava sempre 0.00 HA
- Causa: campo cercato era `superficieLavorata` invece di `superficieTotaleLavorata`

**Correzioni applicate**:
- ✅ Corretto campo nella dashboard Manager (`loadManagerManodoperaStats()`)
- ✅ Corretto campo nella pagina Statistiche (`loadSuperficieStats()`)
- ✅ Corretti riferimenti in Gestione Lavori con fallback per compatibilità
- ✅ Migliorata funzione `loadProgressiLavoro()` per usare prima campo documento

**Risultato**:
- ✅ La superficie lavorata ora mostra correttamente gli ettari lavorati
- ✅ Dati calcolati dalle zone tracciate dai caposquadra
- ✅ Compatibilità con lavori vecchi senza campo aggiornato

**File modificati**:
- `core/dashboard-standalone.html`
- `core/admin/statistiche-manodopera-standalone.html`
- `core/admin/gestione-lavori-standalone.html`

## 📝 Aggiornamenti Recenti (2025-01-23)

### Separazione Dashboard Core Base/Modulo Manodopera ✅
**Data completamento**: 2025-01-23

**Problema risolto**: Dashboard mostrava sezioni Amministrazione e mappa avanzata anche quando il modulo Manodopera era disattivato, creando confusione.

**Soluzione implementata**:
- ✅ **Dashboard pulita senza Manodopera**:
  - Rimossa completamente sezione Amministrazione quando Manodopera è disattivato
  - Link "Invita Collaboratore" nell'header nascosto quando Manodopera è disattivato
  - Solo funzionalità Core Base visibili (Terreni, Diario Attività, Statistiche, Abbonamento)
- ✅ **Mappa semplificata Core Base**:
  - Versione base quando Manodopera è disattivato: solo visualizzazione terreni
  - Nessun filtro avanzato, overlay lavori, indicatori lavori
  - Legenda base solo con colture
- ✅ **Mappa completa con Manodopera**:
  - Mantiene tutte le funzionalità avanzate quando Manodopera è attivo
  - Filtri, overlay, indicatori disponibili

**Vantaggi**:
- ✅ Dashboard pulita e focalizzata quando Manodopera è disattivato
- ✅ Separazione logica chiara tra Core Base e moduli avanzati
- ✅ Mappa semplificata funziona correttamente senza dipendenze dal modulo

**File modificati**: `core/dashboard-standalone.html`

### Fix Configurazione Google Maps ✅
**Data completamento**: 2025-01-23

**Problema risolto**: Google Maps API key non veniva caricata correttamente, mappa non visualizzata.

**Soluzione implementata**:
- ✅ Corretto percorso file config Google Maps
- ✅ Caricamento config prima di inizializzare API
- ✅ Gestione corretta timing: config → Firebase → Google Maps API
- ✅ Controlli dimensioni container
- ✅ Resize trigger per forzare rendering
- ✅ Logging dettagliato per debugging

**Risultato**:
- ✅ Mappa visualizzata correttamente sia con che senza Manodopera
- ✅ Config caricato correttamente da file locale o fallback GitHub
- ✅ Funziona sia in locale che online

**File modificati**: `core/dashboard-standalone.html`

### Refactoring Dashboard Standalone ✅
**Data completamento**: 2025-01-23

**Problema identificato**:
- File `dashboard-standalone.html` troppo grande (4864 righe)
- Mix di HTML, CSS e JavaScript nello stesso file
- Difficile manutenzione e debugging

**Soluzione implementata**:
- ✅ **CSS estratto**: ~515 righe → `styles/dashboard.css`
- ✅ **Config Loader estratto**: ~240 righe → `js/config-loader.js`
- ✅ **Utility Functions estratte**: ~110 righe → `js/dashboard-utils.js`
- ✅ **Sezioni Dashboard estratte**: ~600+ righe → `js/dashboard-sections.js`

**Risultati**:
- ✅ Riduzione file HTML: **4864 → 3374 righe (-30.6%)**
- ✅ Codice più modulare e organizzato
- ✅ Funzionalità mantenute al 100%
- ✅ Compatibile con `file://` e server HTTP

**File creati**:
- `core/styles/dashboard.css`
- `core/js/config-loader.js`
- `core/js/dashboard-utils.js`
- `core/js/dashboard-sections.js`

**File modificati**:
- `core/dashboard-standalone.html`

---

## 🔧 Sistema Segnalazione e Gestione Guasti Macchine (2025-01-24)

### Funzionalità Implementate

#### 1. Segnalazione Guasti Operai
- ✅ Pagina dedicata per operai (`core/admin/segnalazione-guasti-standalone.html`)
- ✅ Precompilazione automatica campi:
  - Trattore assegnato al lavoro corrente
  - Attrezzo assegnato al lavoro corrente
  - Lavoro attivo più recente
- ✅ Supporto lavori autonomi e lavori di squadra
- ✅ Selezione gravità guasto (grave/non grave)
- ✅ Campo dettagli guasto
- ✅ Aggiornamento automatico stato macchine
- ✅ Sospensione automatica lavori per guasti gravi
- ✅ Risoluzione guasti con note e costo riparazione

#### 2. Gestione Guasti Manager
- ✅ Pagina dedicata per manager (`core/admin/gestione-guasti-standalone.html`)
- ✅ Visualizzazione tutti i guasti (aperti e risolti)
- ✅ Filtri per stato, gravità, macchina
- ✅ Azioni manager:
  - Approvare continuazione lavoro (guasti non gravi)
  - Sospendere lavoro (qualsiasi guasto)
  - Risolvere guasto
  - Riaprire guasto risolto
- ✅ Storico guasti per macchina
- ✅ Integrazione dashboard manager (card real-time)

#### 3. Correzioni e Miglioramenti
- ✅ Fix errori sintassi ES6 modules (import statements)
- ✅ Fix ricerca lavori attivi (stati multipli)
- ✅ Fix visualizzazione terreno nella dashboard operaio
- ✅ Fix calcolo automatico stato progresso marcatori mappa
- ✅ Fix precompilazione automatica campi
- ✅ Fix gestione lavori assegnati tramite caposquadra

#### 4. Calcolo Stato Progresso Lavori
- ✅ Calcolo automatico `giorniEffettivi` dalla `dataInizio`
- ✅ Calcolo automatico `percentualeCompletamento` da superficie
- ✅ Calcolo automatico `statoProgresso` (in_ritardo/in_tempo/in_anticipo)
- ✅ Marcatori mappa colorati con stato progresso

**File creati**:
- `core/admin/segnalazione-guasti-standalone.html` (NUOVO)
- `core/admin/gestione-guasti-standalone.html` (NUOVO)

**File modificati**:
- `core/dashboard-standalone.html` (card guasti + calcolo progresso)
- `core/js/dashboard-sections.js` (link segnalazione guasti)

---

## 🚜 Integrazione Modulo Macchine nel Core Base ✅ (2025-01-24)

### Obiettivo
Integrare il modulo Parco Macchine nel Core Base per permettere tracciamento macchine anche senza modulo Manodopera, con compatibilità totale quando Manodopera viene aggiunto successivamente.

### Funzionalità Implementate

#### 1. Service Unificato Macchine Utilizzo ✅
- **File creato**: `modules/parco-macchine/services/macchine-utilizzo-service.js`
- Funzione riutilizzabile `aggiornaOreMacchinaDaUtilizzo()` per aggiornare ore macchine
- Verifica automatica manutenzioni e alert quando superate
- Usabile da Core Base (Diario Attività) e modulo Manodopera (Segna Ore/Validazione Ore)
- Calcolo ore macchina default basato su ore lavoratore

#### 2. Diario Attività con Macchine ✅
- **File modificato**: `core/attivita-standalone.html`
- Campo "Ora fine" reso opzionale (non più obbligatorio)
- Dropdown trattori e attrezzi (solo se modulo Parco Macchine attivo)
- Compatibilità attrezzi basata su CV trattore (filtro automatico)
- Campo ore macchina separato da ore lavoratore
- **Liberazione automatica macchine** quando c'è "ora fine" (attività completata)
- **Impostazione "in_uso"** quando non c'è "ora fine" (attività in corso)
- **Controllo conflitti orario**: previene sovrapposizioni stessa macchina/attrezzo stesso orario/data
- **Fallback automatico**: libera macchine di attività del giorno precedente senza "ora fine"
- Visualizzazione macchine nella lista attività
- Gestione modifica attività: libera macchine vecchie se cambiate, gestisce aggiunta/rimozione "ora fine"
- **Struttura gerarchica tipi lavoro** (2025-01-24):
  - Quando Macchine o Manodopera attivo, usa struttura gerarchica (Categoria → Sottocategoria → Tipo Lavoro)
  - Lista piatta rimane disponibile quando nessun modulo attivo
  - Compatibilità completa: stessa logica sia con solo Macchine, sia con Manodopera attivo
  - Campo coltura aggiunto anche nella struttura gerarchica, popolato automaticamente dai terreni
  - Modali per creare categorie e tipi lavoro direttamente dal diario
  - Layout modali corretto con pulsanti sempre visibili (z-index, padding, stili)
  - Gestione errori CORS per ambiente file:// migliorata

#### 3. Gestione Lavori con Macchine ✅
- **File modificato**: `core/admin/gestione-lavori-standalone.html`
- Liberazione automatica macchine quando lavoro completato/approvato
- Correzione automatica macchine di lavori già completati (funzione `correggiMacchineLavoriCompletati()`)
- Popolamento dropdown trattori quando si apre modal creazione/modifica lavoro
- Log dettagliati per debugging gestione macchine

#### 4. Lavori Caposquadra con Macchine ✅
- **File modificato**: `core/admin/lavori-caposquadra-standalone.html`
- Liberazione automatica macchine quando lavoro raggiunge 100% completamento

#### 5. Refactoring Validazione Ore ✅ (2025-01-24)
- **File modificato**: `core/admin/validazione-ore-standalone.html`
- Rimossa funzione duplicata `aggiornaOreMacchina()` (75+ righe di codice duplicato)
- Sostituita con chiamata al service unificato `macchine-utilizzo-service.js`
- Aggiunta funzione `loadMacchineUtilizzoService()` per caricamento dinamico del service
- Gestione ambiente file:// (CORS) migliorata
- Zero duplicazione codice: logica centralizzata nel service unificato
- Compatibilità totale mantenuta: stesse funzionalità, codice più pulito e manutenibile
- Le ore macchina vengono aggiornate solo alla validazione (non alla segnatura)

#### 6. Correzione Barra Progresso Lavori Completati ✅ (2025-01-24)
- **Problema identificato**: Lavori completati (soprattutto conto terzi) mostravano barra progresso a 0% anche se completati
- **File modificato**: `core/dashboard-standalone.html`
  - Funzione `loadRecentLavoriManagerManodopera()`: aggiunta visualizzazione barra progresso
  - Funzione `loadRecentLavori()`: aggiunta visualizzazione barra progresso
  - Lavori completati mostrano automaticamente 100% se `percentualeCompletamento` è 0 o mancante
  - Badge "Conto Terzi" visualizzato correttamente nella lista lavori recenti
  - Caricamento terreni per calcolo percentuale se mancante
- **File modificato**: `core/admin/gestione-lavori-standalone.html`
  - Correzione calcolo percentuale per lavori completati nella tabella
  - Lavori completati mostrano 100% anche se `percentualeCompletamento` è 0 o mancante
  - Calcolo automatico percentuale da superficie lavorata/totale se mancante
  - Logica: se `stato === 'completato'` e `percentuale === 0`, imposta `percentuale = 100`

### Caratteristiche Principali

**Tracciamento Accurato**:
- Ore precise per terreno e macchina
- Possibilità di tracciare utilizzo macchina per ogni campo lavorato
- Statistiche accurate per macchina/attrezzo

**Gestione Automatica Stati**:
- Macchine liberate automaticamente quando attività completata (con "ora fine")
- Macchine impostate come "in_uso" quando attività in corso (senza "ora fine")
- Fallback automatico per attività del giorno precedente

**Controllo Conflitti**:
- Previene sovrapposizioni di orario per stessa macchina/attrezzo
- Permette utilizzo stesso trattore/attrezzo in orari diversi
- Gestisce correttamente attività completate vs attività in corso

**Compatibilità Moduli**:
- Funziona con solo Core Base + modulo Macchine
- Funziona con Core Base + modulo Macchine + modulo Manodopera
- Zero perdita dati quando si aggiungono/rimuovono moduli

### File Creati/Modificati
- ✅ `modules/parco-macchine/services/macchine-utilizzo-service.js` (NUOVO)
- ✅ `core/attivita-standalone.html` (MODIFICATO)
- ✅ `core/admin/gestione-lavori-standalone.html` (MODIFICATO)
- ✅ `core/admin/lavori-caposquadra-standalone.html` (MODIFICATO)
- ✅ `core/statistiche-standalone.html` (MODIFICATO - Sezione Statistiche Macchine aggiunta)
- ✅ `core/admin/validazione-ore-standalone.html` (MODIFICATO - Refactoring service unificato, 2025-01-24)
- ✅ `core/dashboard-standalone.html` (MODIFICATO - Correzione barra progresso lavori completati, 2025-01-24)

#### 5. Statistiche Macchine ✅
- **File modificato**: `core/statistiche-standalone.html`
- **Sezione "Statistiche Macchine"** (visibile solo se modulo Parco Macchine attivo):
  - **Metriche Cards**:
    - Ore Macchine Totali (somma di tutte le ore macchina nel periodo)
    - Macchine Utilizzate (numero di macchine diverse utilizzate)
    - Manutenzioni in Scadenza (conteggio prossimi 30 giorni / 50 ore)
    - Utilizzo Medio Macchina (ore medie per macchina)
  - **Grafici**:
    - Top 5 Macchine Più Utilizzate (bar chart orizzontale)
    - Ore Macchina per Terreno (bar chart verticale)
    - Ore Macchina vs Ore Lavoratore (grafico a ciambella comparativo)
    - Ore Macchine per Mese (line chart temporale)
  - **Dati unificati**: Combina dati da:
    - Attività Core Base (Diario Attività)
    - Ore operai (se modulo Manodopera attivo)
  - **Filtri applicati**: I filtri periodo/terreno/tipo lavoro si applicano anche alle statistiche macchine
  - **Compatibilità**: Funziona con e senza modulo Manodopera

## 📝 Aggiornamenti Recenti (2025-01-24)

### Refactoring Macchine e Correzione Barra Progresso (2025-01-24)

#### Refactoring Validazione Ore ✅
- **File modificato**: `core/admin/validazione-ore-standalone.html`
- Rimossa funzione duplicata `aggiornaOreMacchina()` (75+ righe di codice duplicato)
- Sostituita con chiamata al service unificato `macchine-utilizzo-service.js`
- Aggiunta funzione `loadMacchineUtilizzoService()` per caricamento dinamico del service
- Gestione ambiente file:// (CORS) migliorata
- Zero duplicazione codice: logica centralizzata nel service unificato
- Compatibilità totale mantenuta: stesse funzionalità, codice più pulito e manutenibile
- Le ore macchina vengono aggiornate solo alla validazione (non alla segnatura)

#### Correzione Barra Progresso Lavori Completati ✅
- **Problema identificato**: Lavori completati (soprattutto conto terzi) mostravano barra progresso a 0% anche se completati
- **File modificato**: `core/dashboard-standalone.html`
  - Funzione `loadRecentLavoriManagerManodopera()`: aggiunta visualizzazione barra progresso
  - Funzione `loadRecentLavori()`: aggiunta visualizzazione barra progresso
  - Lavori completati mostrano automaticamente 100% se `percentualeCompletamento` è 0 o mancante
  - Badge "Conto Terzi" visualizzato correttamente nella lista lavori recenti
  - Caricamento terreni per calcolo percentuale se mancante
- **File modificato**: `core/admin/gestione-lavori-standalone.html`
  - Correzione calcolo percentuale per lavori completati nella tabella
  - Lavori completati mostrano 100% anche se `percentualeCompletamento` è 0 o mancante
  - Calcolo automatico percentuale da superficie lavorata/totale se mancante
  - Logica: se `stato === 'completato'` e `percentuale === 0`, imposta `percentuale = 100`

---

### Correzione Tour Terreni (2025-01-24)

### Problema Identificato
Il tour della pagina terreni aveva problemi di posizionamento dei popup:
- Popup che coprivano elementi importanti (barra ricerca)
- Overlay evidenziato non allineato correttamente agli elementi
- Popup non leggibili o tagliati
- Problemi di refresh quando si navigava avanti/indietro nel tour

### Soluzioni Implementate

#### 1. Wrapper Barra Ricerca ✅
- **File modificato**: `core/terreni-standalone.html`
- **Problema**: L'overlay evidenziato non era allineato con la barra di ricerca
- **Soluzione**: Creato wrapper `#map-search-wrapper` che contiene input e pulsante "Cerca"
- **Risultato**: Overlay ora evidenzia correttamente l'area della barra di ricerca

#### 2. Posizionamento Popup Ottimizzato ✅
- **Popup barra ricerca**: Posizionato a sinistra (`position: 'left'`) per non coprire l'input
- **Popup tracciamento confini**: Posizionamento dinamico (~60% viewport) per ottimale leggibilità
- **Funzione `ensureTooltipVisible()`**: Gestisce posizionamento adattivo in base a dimensioni schermo
- **Margini dinamici**: Mobile (30px), Tablet (25px), Desktop (20px)

#### 3. Refresh Overlay Corretto ✅
- **Problema**: Overlay non si aggiornava correttamente quando si navigava avanti
- **Soluzione**: Logica di refresh con tentativi multipli (50ms, 150ms, 300ms, 500ms)
- **Calcolo diretto coordinate**: Overlay posizionato usando `getBoundingClientRect()` dell'elemento target
- **Gestione scroll**: Include `window.scrollY` e `window.scrollX` per coordinate corrette

#### 4. Gestione Modal Migliorata ✅
- **Apertura temporanea**: Modal aperto temporaneamente per costruire step correttamente
- **Chiusura/riapetura**: Modal chiuso prima del tour, riaperto quando necessario
- **Scroll intelligente**: Scroll automatico quando si apre/chiude il modal

#### 5. Ordine Step Ottimizzato ✅
- **Nuovo ordine**: Header → Pulsante aggiungi → Form/Mappa → Lista terreni
- **Lista terreni alla fine**: Spostata dopo tutti gli step del modal per migliore UX
- **Gestione apertura/chiusura**: Modal aperto per step form/mappa, chiuso per lista

### Caratteristiche Finali
- ✅ Popup sempre leggibili e posizionati correttamente
- ✅ Overlay evidenziato allineato perfettamente agli elementi
- ✅ Navigazione fluida avanti/indietro senza problemi di posizionamento
- ✅ Adattivo a diverse dimensioni schermo (mobile, tablet, desktop)
- ✅ Scroll automatico intelligente per mantenere tutto visibile

**File modificati**: `core/terreni-standalone.html`

---

## 📝 Aggiornamenti Recenti (2025-12-09) - Fix Statistiche e Permessi

### 1. Fix Visualizzazione Caposquadra nelle Statistiche Manodopera ✅

**Problema Identificato**:
- I caposquadra non venivano visualizzati correttamente nella tabella statistiche
- Il campo "Tipo Operaio" risultava vuoto per i caposquadra senza `tipoOperaio` impostato
- Il sistema leggeva solo `tipoOperaio`, ignorando il ruolo `caposquadra`

**Soluzione Implementata**:
- **Funzione `getTipoOperaioDisplay()`**: Combina ruolo e tipoOperaio per visualizzazione corretta
  - Se è caposquadra senza `tipoOperaio` → mostra "Caposquadra"
  - Se è caposquadra con `tipoOperaio` → mostra "Caposquadra - Trattorista" (esempio)
  - Se è solo operaio → mostra solo il tipoOperaio
- **Salvataggio ruoli**: Ora vengono salvati anche i `ruoli` quando si caricano i dati degli operai
- **Filtro aggiornato**: Aggiunta opzione "Caposquadra" nel dropdown filtro
- **Dropdown operai**: Ora include anche i caposquadra (non solo gli operai)

**Caratteristiche**:
- ✅ I caposquadra compaiono sempre nelle statistiche, anche senza `tipoOperaio` impostato
- ✅ Distinzione mantenuta tra ruolo (permessi) e tipo (classificazione)
- ✅ Possibilità di filtrare per "Caposquadra" nel dropdown
- ✅ Statistiche per tipo ora mostrano anche "Caposquadra" come categoria separata

**File modificati**: `core/admin/statistiche-manodopera-standalone.html`

---

### 2. Fix Permessi Firestore per Categorie Attrezzi ✅

**Problema Identificato**:
- Errore "Missing or insufficient permissions" in `gestione-macchine-standalone.html`
- La collezione `categorieAttrezzi` (vecchia collezione per migrazione) non aveva regole Firestore

**Soluzione Implementata**:
- Aggiunta regola Firestore per `categorieAttrezzi`:
  - **Lettura**: permessa per utenti autenticati del tenant
  - **Scrittura**: permessa solo per Manager/Amministratore del tenant
- Stessa logica della regola per `categorieLavori` (altra collezione vecchia per migrazione)

**File modificati**: `firestore.rules`

---

### 3. Fix Funzione escapeHtml Mancante in Statistiche ✅

**Problema Identificato**:
- Errore `ReferenceError: escapeHtml is not defined` in `statistiche-standalone.html`
- La funzione veniva chiamata ma non era definita nel file

**Soluzione Implementata**:
- Aggiunta funzione `escapeHtml()` per prevenire XSS quando si inserisce testo nell'HTML
- Funzione posizionata prima di `loadStatisticheTerreni()` dove viene utilizzata

**File modificati**: `core/statistiche-standalone.html`

---

## 📝 Aggiornamenti Recenti (2025-12-10) - Supporto Operai Autonomi e Comunicazioni

### 1. Regole Firestore per Comunicazioni ✅

**Problema Identificato**:
- Gli operai non potevano leggere le comunicazioni del tenant
- Gli operai non potevano confermare la ricezione delle comunicazioni (aggiornare campo `conferme`)

**Soluzione Implementata**:
- Aggiunta regola Firestore per `/tenants/{tenantId}/comunicazioni/{comunicazioneId}`:
  - **Lettura**: permessa per utenti autenticati del tenant (`isAuthenticated() && belongsToTenant(tenantId)`)
  - **Creazione**: permessa per caposquadra e manager/admin (`hasRole('caposquadra') || isManagerOrAdmin()`)
  - **Aggiornamento**: permessa per caposquadra/manager/admin O per operai che aggiornano solo il campo `conferme`
  - **Eliminazione**: permessa solo per manager/admin

**Caratteristiche**:
- ✅ Operai possono leggere tutte le comunicazioni del loro tenant
- ✅ Operai possono confermare la ricezione aggiornando il campo `conferme`
- ✅ Caposquadra e manager possono creare e gestire comunicazioni
- ✅ Solo manager/admin possono eliminare comunicazioni

**File modificati**: `firestore.rules`

---

### 2. Supporto Operai Autonomi - Segnatura Lavori Completati ✅

**Problema Identificato**:
- Gli operai autonomi non potevano segnare come completato i lavori autonomi assegnati a loro
- La funzione `segnaCompletato` in `lavori-caposquadra-standalone.html` supportava solo i caposquadra per lavori di squadra
- Le regole Firestore per `lavori` non permettevano agli operai di aggiornare i lavori autonomi

**Soluzione Implementata**:

#### A. Regole Firestore per Lavori - Operai Autonomi
- Aggiunta regola per permettere agli operai di aggiornare lavori autonomi assegnati a loro:
  - **Condizioni**: `hasRole('operaio') && resource.data.operaioId == request.auth.uid && resource.data.caposquadraId == null`
  - **Campi permessi**: `stato`, `percentualeCompletamentoTracciata`, `completatoDa`, `completatoIl`, `aggiornatoIl`
  - **Stati permessi**: `completato_da_approvare`, `in_corso`, o mantenere lo stato corrente
- Aggiunto campo `percentualeCompletamentoTracciata` alla lista dei campi permessi per operai

#### B. Funzione `segnaCompletato` Aggiornata
- **Supporto doppio**: Ora supporta sia caposquadra (lavori di squadra) che operai (lavori autonomi)
- **Verifica permessi**:
  - Per caposquadra: verifica che il lavoro sia di squadra (`caposquadraId == userId && operaioId == null`)
  - Per operai: verifica che il lavoro sia autonomo (`operaioId == userId && caposquadraId == null`)
- **Log di debug**: Aggiunti log dettagliati per tracciare:
  - Dati lavoro (ID, nome, caposquadraId, operaioId, stato)
  - Utente corrente (ID, ruoli)
  - Campi aggiornati
  - Esito operazione

#### C. Logica Visualizzazione Lavori Migliorata
- **Lavori "assegnato"**: Ora vengono mostrati anche se la data inizio è futura
- **Lavori "in_corso"**: Mostrati solo se la data inizio è oggi o passata
- **Log di debug**: Aggiunti log per tracciare totale lavori, lavori diretti, lavori inclusi

**Caratteristiche**:
- ✅ Operai autonomi possono segnare come completato i lavori autonomi assegnati a loro
- ✅ Caposquadra possono segnare come completato i lavori di squadra assegnati a loro
- ✅ Validazione permessi lato client e server (Firestore rules)
- ✅ Log dettagliati per debugging e tracciamento operazioni
- ✅ Messaggi di errore specifici per tipo di lavoro (squadra vs autonomo)

**File modificati**: 
- `firestore.rules`
- `core/admin/lavori-caposquadra-standalone.html`
- `core/dashboard-standalone.html`

---

### 3. Log di Debug Aggiunti ✅

**Miglioramenti Debug**:
- **`loadLavori()` in lavori-caposquadra-standalone.html**: Log per `isCaposquadra`, `isOperaio`, `userId`, `totaleLavori`
- **`segnaCompletato()`**: Log dettagliati per dati lavoro, utente corrente, permessi, campi aggiornati
- **`loadComunicazioniOperaio()` in dashboard-standalone.html**: Log per tracciare caricamento e filtraggio comunicazioni
- **`loadLavoriOggiOperaio()`**: Log per totale lavori, lavori diretti, lavori inclusi

**Caratteristiche**:
- ✅ Debug completo per tracciare flusso dati e permessi
- ✅ Facilita identificazione problemi di permessi o logica
- ✅ Log strutturati con emoji per facile identificazione

**File modificati**: 
- `core/admin/lavori-caposquadra-standalone.html`
- `core/dashboard-standalone.html`

---

## ✅ Evidenziazione Visiva Lavori Conto Terzi (2025-12-10)

### Obiettivo
Rendere immediatamente riconoscibili i lavori conto terzi rispetto ai lavori interni, sia nella gestione lavori che nel diario da lavori della dashboard.

### Implementazione

#### Gestione Lavori
- **File modificato**: `core/admin/gestione-lavori-standalone.html`
- **Filtro "Tipo Lavoro"**: Aggiunto filtro per separare lavori interni da conto terzi
  - Opzioni: Tutti i lavori, Lavori Interni, Conto Terzi
- **Evidenziazione visiva**: Gradiente blu/azzurro (`#E3F2FD` → `#BBDEFB`) per lavori conto terzi
  - Bordo sinistro blu (`#1976D2`)
  - Badge "💼 Conto Terzi" accanto al nome lavoro
  - Hover con gradiente più scuro
- **Logica filtraggio**: Filtra in base al campo `clienteId` (se presente = conto terzi)
- **Applicato a tutte le sezioni**: Tabella lavori normali e sezione lavori in attesa di approvazione

#### Dashboard - Diario da Lavori
- **File modificato**: `core/dashboard-standalone.html`
- **Evidenziazione visiva**: Stesso gradiente blu/azzurro per lavori conto terzi
  - Badge "💼 Conto Terzi" accanto al tipo lavoro
  - Stile CSS inline per evitare conflitti
- **Campo clienteId**: Aggiunto all'oggetto attività quando viene creata dalla funzione `loadDiarioDaLavori()`

### Caratteristiche
- ✅ Stile coerente con sezione Conto Terzi (colori blu distintivi)
- ✅ Riconoscimento immediato a colpo d'occhio
- ✅ Filtro funzionante insieme agli altri filtri esistenti
- ✅ Compatibile con tutti i moduli attivi

**File modificati**:
- `core/admin/gestione-lavori-standalone.html`
- `core/dashboard-standalone.html`

---

## ✅ Pianificazione Lavori Conto Terzi senza Manodopera (2025-12-10) - COMPLETATO

### Problema Risolto
Quando un utente ha solo **Core Base + Conto Terzi** (o **Core Base + Parco Macchine + Conto Terzi**), può creare lavori da preventivi accettati e ora può anche pianificarli perché la pagina "Gestione Lavori" è accessibile anche senza il modulo Manodopera attivo.

### Scenario Realistico
Piccolo proprietario che:
- Fa lavori conto terzi per clienti
- Ha trattori/attrezzi da gestire (Parco Macchine)
- Lavora da solo o con pochi collaboratori
- Non ha bisogno di gestione squadre/operai (Manodopera)

### Soluzione Implementata: Opzione 1 Rivista

**"Gestione Lavori" accessibile anche senza Manodopera**, con modalità semplificata:

#### Quando Manodopera NON è attivo:
- ✅ Mostra solo pianificazione base:
  - Nome lavoro
  - Terreno
  - Tipo lavoro
  - Data inizio
  - Durata prevista
  - Note
  - Stato (da_pianificare → in_corso → completato)
- ✅ Se Parco Macchine attivo: mostra anche assegnazione macchine (trattore/attrezzo)
- ✅ Nascondi completamente:
  - Assegnazione caposquadra/operai
  - Gestione squadre
  - Tracciamento zone lavorate
  - Segnatura/validazione ore
- ✅ Se lavoro ha `clienteId` (conto terzi): mostra anche dati cliente
- ✅ Generazione automatica voce diario quando lavoro completato

#### Quando Manodopera è attivo:
- ✅ Mostra tutte le funzionalità complete (come prima)

### Implementazione Tecnica
- ✅ Funzione `setupManodoperaVisibility()` nasconde/mostra elementi in base al modulo attivo
- ✅ Validazione semplificata: richiede solo terreno quando Manodopera non attivo
- ✅ Stato default `in_corso` quando Manodopera non attivo
- ✅ Funzione `generaVoceDiarioContoTerzi()` crea attività automaticamente
- ✅ Supporto completo Parco Macchine anche senza Manodopera
- ✅ Filtro `da_pianificare` funziona anche senza Manodopera

### Vantaggi
- ✅ Funziona in tutti gli scenari realistici
- ✅ Non duplica codice (una sola pagina che si adatta)
- ✅ Scalabile (se aggiungi Manodopera dopo, tutto funziona già)
- ✅ Non cambia il Core Base (pianificazione rimane opzionale)

### Impatto
- **Core Base**: Rimane "solo diario" per default
- **Pianificazione lavori**: Diventa disponibile solo se crei lavori da preventivi o manualmente
- **Non obbligatoria**: Puoi continuare a usare solo il diario attività

### File Modificati
- ✅ `core/admin/gestione-lavori-standalone.html` - Funzione `setupManodoperaVisibility()`, validazione semplificata, generazione voce diario

### Stato
✅ **Completato** (2025-12-10)

**File da modificare**:
- `core/admin/gestione-lavori-standalone.html` - Rimuovere blocco Manodopera, aggiungere modalità semplificata

---

## 🆕 Modifiche 2025-12-14

### Branding Email Preventivi con Logo Aziendale ✅ COMPLETATO

#### Configurazione Firebase Storage CORS
- ✅ **Installato Google Cloud SDK**: Installato Google Cloud SDK su Windows per accesso a `gsutil`
- ✅ **Configurato CORS Storage**: Configurato CORS sul bucket Firebase Storage (`gfv-platform.firebasestorage.app`) per permettere richieste da:
  - `https://vitaradragon.github.io` (GitHub Pages)
  - `http://localhost:*` (sviluppo locale)
  - `http://127.0.0.1:*` (sviluppo locale)
- ✅ **File creati**:
  - `cors.json`: Configurazione CORS per bucket Storage
  - `CONFIGURA_CORS_STORAGE.md`: Guida dettagliata per configurazione CORS
- ✅ **Comandi eseguiti**:
  ```bash
  gcloud init  # Configurazione progetto gfv-platform
  gsutil cors set cors.json gs://gfv-platform.firebasestorage.app
  gsutil cors get gs://gfv-platform.firebasestorage.app  # Verifica
  ```

#### Caricamento Logo Aziendale
- ✅ **Upload logo**: Implementata funzionalità completa per caricare logo aziendale nelle Impostazioni
  - File: `core/admin/impostazioni-standalone.html`
  - Input file con preview
  - Validazione file (solo immagini, max 2MB)
  - Normalizzazione tenant ID per percorsi Storage
  - Upload su Firebase Storage con metadata
  - Salvataggio `logoUrl` in Firestore tenant document
- ✅ **Eliminazione logo**: Implementata funzionalità per rimuovere logo esistente
  - Eliminazione da Firebase Storage
  - Rimozione `logoUrl` da Firestore
- ✅ **Visualizzazione logo**: Logo mostrato nell'anteprima e nelle email preventivi
- ✅ **Gestione errori**: Messaggi specifici per:
  - CORS errors
  - Permission errors
  - Network errors
  - Bucket not found
  - File protocol (file://) warnings

#### Regole Firebase Storage
- ✅ **File creato**: `storage.rules`
- ✅ **Regole implementate**:
  - Solo utenti autenticati del tenant possono upload/delete loghi
  - Validazione dimensione file (max 2MB)
  - Validazione content type (solo immagini)
  - Percorso: `tenants/{tenantId}/logo_*.{ext}`
- ✅ **Firebase.json aggiornato**: Aggiunta sezione `storage` con riferimento a `storage.rules`

#### Template Email Preventivi
- ✅ **Template EmailJS aggiornato**: Template completo con branding aziendale
  - Header più alto (40px padding, min-height 120px) per spazio logo
  - Logo aziendale nell'header (se presente)
  - Nome azienda ben formattato (bianco, 36px, bold, text-shadow)
  - Footer con dati azienda completi (nome, indirizzo, telefono, email, P.IVA)
- ✅ **Variabili EmailJS**:
  - `logo_url`: URL del logo (solo URL, non HTML)
  - `nome_azienda`: Nome azienda per header
  - `nome_azienda_footer`: Nome azienda per footer
  - `indirizzo_azienda`, `telefono_azienda`, `email_azienda`, `piva_azienda`: Dati azienda
- ✅ **File modificato**: `modules/conto-terzi/views/preventivi-standalone.html`
  - Preparazione variabili azienda per template email
  - Invio `logo_url` invece di HTML per evitare problemi EmailJS
  - Debug logging per verifica dati inviati

#### Risoluzione Problemi EmailJS
- ✅ **Problema "corrupted variables"**: Risolto usando solo URL per logo invece di HTML nelle variabili
- ✅ **Template HTML**: Template configurato correttamente per HTML con variabili semplici
- ✅ **Rendering logo**: Logo renderizzato correttamente usando `{{logo_url}}` direttamente nel tag `<img>`

#### Documentazione
- ✅ **File aggiornati**:
  - `GUIDA_CONFIGURAZIONE_FIREBASE.md`: Aggiunta sezione "STEP 9: Configura Firebase Storage"
  - `CONFIGURA_CORS_STORAGE.md`: Guida completa per configurazione CORS
  - `ISTRUZIONI_TEMPLATE_EMAIL_PREVENTIVO.md`: Aggiornate variabili EmailJS con dati azienda

### Risultato Finale
- ✅ Logo aziendale visibile nelle email preventivi
- ✅ Nome azienda ben formattato e leggibile nell'header email
- ✅ Dati azienda completi nel footer email
- ✅ Email funzionanti senza errori
- ✅ Branding aziendale invece di "GFV Platform" nelle email preventivi


