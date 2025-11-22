# 📋 Piano Core Base - GFV Platform

**Data creazione**: 2025-01-09  
**Stato**: Pianificazione completata - Pronto per implementazione  
**Versione**: 1.0.0

---

## 🎯 Visione Core Base

Il **core base** è la funzionalità essenziale inclusa in ogni abbonamento, senza moduli aggiuntivi. È concepito come un **"diario attività"** per tracciare le attività svolte dall'azienda agricola.

### Principi Fondamentali

- **Semplicità**: Focus su tracciamento attività, senza complessità di squadre/validazioni
- **Single-user**: Solo il proprietario (utente loggato) può vedere e gestire i suoi dati
- **Scalabilità**: Base solida per moduli futuri (MANODOPERA, CONTO TERZI, VENDEMMIA)
- **Utilità immediata**: Funzionale anche senza moduli aggiuntivi

---

## 📦 Componenti Core Base

### 1. Terreni

**Descrizione**: Gestione elenco terreni di proprietà o in utilizzo dell'azienda.

**Struttura Dati**:
```javascript
Terreno: {
  id: "terreno-123",
  nome: "Terreno Sud",              // Obbligatorio
  superficie: 2.5,                   // Ettari (opzionale, manuale o da mappa)
  coordinate: {                      // Opzionale (punto centrale)
    lat: 44.5,
    lng: 11.3
  },
  polygonCoords: [...],               // Opzionale (coordinate poligono mappa)
  note: "Terreno in collina",        // Opzionale
  creatoIl: timestamp,
  aggiornatoIl: timestamp
}
```

**Funzionalità**:
- ✅ CRUD completo terreni (crea, modifica, elimina)
- ✅ Mappe opzionali (come nella vecchia app):
  - Tracciamento confini terreno (poligono)
  - Calcolo automatico superficie da mappa
  - Salvataggio coordinate poligono
  - Vista satellitare
  - Ricerca indirizzo
  - Modifica poligono esistente
  - Cancellazione poligono
- ✅ Superficie: inserimento manuale OPPURE calcolo automatico da mappa
- ✅ Note opzionali

**Comportamento Mappe**:
- Mappe sono **opzionali**: terreno può esistere senza mappa
- Se mappa tracciata: calcolo superficie automatico
- Se mappa non tracciata: inserimento manuale superficie
- Possibilità di aggiungere mappa a terreno esistente

---

### 2. Diario Attività

**Descrizione**: Registrazione cronologica delle attività lavorative svolte.

**Struttura Dati**:
```javascript
Attività: {
  id: "attivita-456",
  data: "2025-03-31",                 // Solo presente/passate (NO futuro)
  terrenoId: "terreno-123",           // Riferimento terreno
  terrenoNome: "Terreno Sud",         // Denormalizzato per performance
  tipoLavoro: "Potatura",             // Da lista personalizzabile (obbligatorio)
  coltura: "Vite",                    // Da lista personalizzabile (obbligatorio, associata all'attività)
  orarioInizio: "08:00",              // Formato HH:MM (obbligatorio)
  orarioFine: "17:00",                // Formato HH:MM (obbligatorio)
  pauseMinuti: 60,                    // Minuti di pausa (obbligatorio)
  oreNette: 8,                        // Calcolato automaticamente: (fine - inizio) - pause
  note: "Potato viti, lavoro procede bene",  // Opzionale
  creatoIl: timestamp,
  aggiornatoIl: timestamp
}
```

**Validazioni**:
- ✅ Data: solo presente o passate (NO futuro)
- ✅ Orario fine > orario inizio
- ✅ Pause < (fine - inizio)
- ✅ Terreno: obbligatorio
- ✅ Tipo lavoro: obbligatorio
- ✅ Coltura: obbligatorio

**Calcolo Ore Automatico**:
- Formula: `oreNette = (orarioFine - orarioInizio) - pauseMinuti`
- Calcolo in tempo reale nel form (feedback immediato)
- Display ore nette sempre visibile

**Funzionalità**:
- ✅ Aggiungi attività (form completo)
- ✅ Modifica attività (sempre possibile, anche vecchie)
- ✅ Elimina attività (con conferma obbligatoria)
- ✅ Vista cronologica (lista ordinata per data, più recenti prima)
- ✅ Filtri:
  - Per terreno
  - Per tipo lavoro
  - Per coltura
  - Per periodo (range date)
- ✅ Ricerca testuale (nelle note)

**Esempio Flusso**:
1. Fine giornata → "Aggiungi Attività"
2. Seleziona data (solo presente/passate)
3. Seleziona terreno (dropdown)
4. Seleziona tipo lavoro (dropdown, con possibilità aggiungere nuovo)
5. Seleziona coltura (dropdown, con possibilità aggiungere nuova)
6. Inserisci orario inizio (time picker)
7. Inserisci orario fine (time picker)
8. Inserisci pause (minuti, input numerico)
9. Sistema calcola ore nette automaticamente (display in tempo reale)
10. Note (opzionale, textarea)
11. Salva

---

### 3. Liste Personalizzabili

**Descrizione**: Gestione liste predefinite e custom per tipi lavoro e colture.

**Struttura Dati**:
```javascript
Liste Personalizzate: {
  tipiLavoro: [
    "Potatura",      // Predefinito (non eliminabile)
    "Raccolta",      // Predefinito
    "Trattamento",   // Predefinito
    "Semina",        // Predefinito
    "Aratura",       // Predefinito
    "Irrigazione",   // Predefinito
    "Concimazione",  // Predefinito
    "Diserbo",       // Predefinito
    "Raccolta frutta",    // Predefinito
    "Raccolta verdura",   // Predefinito
    "Lavoro Custom 1",    // Aggiunto dall'utente (eliminabile)
    "Lavoro Custom 2"     // Aggiunto dall'utente (eliminabile)
  ],
  colture: [
    "Vite",          // Predefinito (non eliminabile)
    "Frutteto",      // Predefinito
    "Seminativo",    // Predefinito
    "Orto",          // Predefinito
    "Prato",         // Predefinito
    "Olivo",         // Predefinito
    "Agrumeto",      // Predefinito
    "Bosco",         // Predefinito
    "Coltura Custom 1",  // Aggiunto dall'utente (eliminabile)
    "Coltura Custom 2"   // Aggiunto dall'utente (eliminabile)
  ]
}
```

**Predefiniti (Non Eliminabili)**:
- **Tipi Lavoro**: Potatura, Raccolta, Trattamento, Semina, Aratura, Irrigazione, Concimazione, Diserbo, Raccolta frutta, Raccolta verdura
- **Colture**: Vite, Frutteto, Seminativo, Orto, Prato, Olivo, Agrumeto, Bosco

**Funzionalità**:
- ✅ Gestione in pagina "Impostazioni"
- ✅ Aggiungi nuovo (custom)
- ✅ Elimina solo custom (con conferma se usato in attività)
- ✅ Validazione: no duplicati (case-insensitive)
- ✅ Badge "Custom" per distinguere predefiniti da custom
- ✅ Dropdown con ricerca nei form

**Validazione Eliminazione**:
- Se tipo lavoro/coltura usato in attività: avviso "Usato in X attività, elimina comunque?"
- Se confermato: elimina e aggiorna attività (o lascia vuoto? - da decidere)

---

### 4. Statistiche Base

**Descrizione**: Dashboard con aggregazioni e grafici sulle attività.

**Metriche Dashboard**:
- ✅ Totale terreni
- ✅ Totale ore lavorate (mese corrente, anno corrente)
- ✅ Attività totali (mese/anno)
- ✅ Ore per tipo lavoro (grafico a torta/barre)
- ✅ Attività per terreno (grafico)
- ✅ Ore per mese (grafico lineare)
- ✅ Tipi lavoro più frequenti

**Filtri Statistiche**:
- ✅ Periodo (mese, anno, custom range)
- ✅ Terreno specifico
- ✅ Tipo lavoro specifico

---

## 🗂️ Struttura File Proposta

```
core/
├── terreni/
│   ├── views/
│   │   └── terreni.html
│   ├── controllers/
│   │   └── terreni-controller.js
│   ├── services/
│   │   └── terreni-service.js
│   └── styles/
│       └── terreni.css
│
├── attivita/
│   ├── views/
│   │   └── diario.html
│   ├── controllers/
│   │   └── attivita-controller.js
│   ├── services/
│   │   └── attivita-service.js
│   └── styles/
│       └── attivita.css
│
├── statistiche/
│   ├── views/
│   │   └── dashboard.html
│   ├── controllers/
│   │   └── statistiche-controller.js
│   ├── services/
│   │   └── statistiche-service.js
│   └── styles/
│       └── statistiche.css
│
├── impostazioni/
│   ├── views/
│   │   └── impostazioni.html
│   ├── controllers/
│   │   └── impostazioni-controller.js
│   ├── services/
│   │   └── liste-service.js
│   └── styles/
│       └── impostazioni.css
│
└── models/
    ├── Terreno.js
    ├── Attivita.js
    └── ListePersonalizzate.js
```

---

## ✅ Checklist Implementazione

### Fase 1: Modelli e Servizi Base
- [ ] Modello `Terreno.js`
  - [ ] Campi: id, nome, superficie, coordinate, polygonCoords, note
  - [ ] Metodi: toFirestore(), fromFirestore(), validate()
- [ ] Modello `Attivita.js`
  - [ ] Campi: id, data, terrenoId, terrenoNome, tipoLavoro, coltura, orarioInizio, orarioFine, pauseMinuti, oreNette, note
  - [ ] Metodi: toFirestore(), fromFirestore(), validate(), calculateOreNette()
- [ ] Modello `ListePersonalizzate.js`
  - [ ] Campi: tipiLavoro, colture
  - [ ] Metodi: toFirestore(), fromFirestore(), addTipoLavoro(), addColtura(), removeTipoLavoro(), removeColtura()
- [ ] Service `terreni-service.js`
  - [ ] getAllTerreni()
  - [ ] getTerreno(id)
  - [ ] createTerreno(data)
  - [ ] updateTerreno(id, data)
  - [ ] deleteTerreno(id)
- [ ] Service `attivita-service.js`
  - [ ] getAllAttivita(filters)
  - [ ] getAttivita(id)
  - [ ] createAttivita(data)
  - [ ] updateAttivita(id, data)
  - [ ] deleteAttivita(id)
  - [ ] calculateOreNette(inizio, fine, pause)
- [ ] Service `liste-service.js`
  - [ ] getListe()
  - [ ] addTipoLavoro(nome)
  - [ ] removeTipoLavoro(nome)
  - [ ] addColtura(nome)
  - [ ] removeColtura(nome)
  - [ ] isPredefinito(tipo, nome)
- [ ] Service `statistiche-service.js`
  - [ ] getTotaleTerreni()
  - [ ] getTotaleOre(periodo)
  - [ ] getTotaleAttivita(periodo)
  - [ ] getOrePerTipoLavoro(periodo)
  - [ ] getAttivitaPerTerreno(periodo)
  - [ ] getOrePerMese(periodo)

### Fase 2: Terreni
- [ ] View `terreni.html`
  - [ ] Lista terreni (tabella/card)
  - [ ] Bottone "Aggiungi Terreno"
  - [ ] Modal form crea/modifica terreno
  - [ ] Bottone "Traccia Confini" (opzionale)
  - [ ] Integrazione mappa (container)
- [ ] Controller `terreni-controller.js`
  - [ ] Caricamento lista terreni
  - [ ] Gestione form crea/modifica
  - [ ] Validazione form
  - [ ] Integrazione mappe (da vecchia app)
  - [ ] Salvataggio coordinate poligono
  - [ ] Calcolo superficie da mappa
- [ ] Integrazione Mappe (da vecchia app)
  - [ ] Copia codice mappe da `anagrafica_clienti.html`
  - [ ] Adattamento per core base
  - [ ] Tracciamento poligono
  - [ ] Calcolo superficie automatico
  - [ ] Salvataggio coordinate
  - [ ] Ricerca indirizzo
  - [ ] Vista satellitare
- [ ] Stili `terreni.css`
  - [ ] Layout responsive
  - [ ] Stili form
  - [ ] Stili mappa

### Fase 3: Attività (Diario)
- [ ] View `diario.html`
  - [ ] Lista cronologica attività
  - [ ] Bottone "Aggiungi Attività"
  - [ ] Modal form crea/modifica attività
  - [ ] Filtri (terreno, tipo lavoro, coltura, periodo)
  - [ ] Ricerca testuale
- [ ] Controller `attivita-controller.js`
  - [ ] Caricamento lista attività
  - [ ] Gestione form crea/modifica
  - [ ] Validazione form (data, orari, pause)
  - [ ] Calcolo ore nette in tempo reale
  - [ ] Filtri e ricerca
  - [ ] Eliminazione con conferma
- [ ] Validazioni
  - [ ] Data solo presente/passate (no futuro)
  - [ ] Orario fine > orario inizio
  - [ ] Pause < (fine - inizio)
  - [ ] Campi obbligatori
- [ ] Stili `attivita.css`
  - [ ] Layout responsive
  - [ ] Stili form
  - [ ] Stili lista cronologica

### Fase 4: Liste Personalizzate
- [ ] View `impostazioni.html`
  - [ ] Sezione "Tipi Lavoro"
    - [ ] Lista predefiniti + custom
    - [ ] Badge "Custom" per distinguere
    - [ ] Bottone "Aggiungi nuovo tipo"
    - [ ] Bottone elimina (solo custom)
  - [ ] Sezione "Colture"
    - [ ] Lista predefiniti + custom
    - [ ] Badge "Custom" per distinguere
    - [ ] Bottone "Aggiungi nuova coltura"
    - [ ] Bottone elimina (solo custom)
- [ ] Controller `impostazioni-controller.js`
  - [ ] Caricamento liste
  - [ ] Aggiunta nuovo tipo lavoro/coltura
  - [ ] Validazione (no duplicati)
  - [ ] Eliminazione con controllo uso
  - [ ] Conferma eliminazione se usato
- [ ] Stili `impostazioni.css`
  - [ ] Layout responsive
  - [ ] Stili liste

### Fase 5: Statistiche
- [ ] View `dashboard.html`
  - [ ] Card metriche (totale terreni, ore, attività)
  - [ ] Grafici (ore per tipo, attività per terreno, ore per mese)
  - [ ] Filtri periodo
- [ ] Controller `statistiche-controller.js`
  - [ ] Caricamento dati aggregati
  - [ ] Generazione grafici (Chart.js o simile)
  - [ ] Filtri periodo
- [ ] Stili `statistiche.css`
  - [ ] Layout dashboard
  - [ ] Stili grafici

### Fase 6: Integrazione e Test
- [ ] Integrazione con core services esistenti
  - [ ] Firebase Service (multi-tenant)
  - [ ] Auth Service (verifica autenticazione)
  - [ ] Tenant Service (isolamento dati)
- [ ] Test funzionalità
  - [ ] CRUD terreni
  - [ ] CRUD attività
  - [ ] Calcolo ore automatico
  - [ ] Validazioni
  - [ ] Mappe
  - [ ] Liste personalizzate
  - [ ] Statistiche
- [ ] Test multi-tenant
  - [ ] Isolamento dati per tenant
  - [ ] Liste personalizzate per tenant

---

## 🔗 Integrazione con Core Esistente

### Servizi da Usare

**Firebase Service** (`core/services/firebase-service.js`):
- `getCollectionData(collection, filters)` - Lista terreni/attività
- `getDocument(collection, id)` - Dettaglio
- `createDocument(collection, data)` - Crea
- `updateDocument(collection, id, data)` - Modifica
- `deleteDocument(collection, id)` - Elimina

**Tenant Service** (`core/services/tenant-service.js`):
- `getCurrentTenantId()` - ID tenant corrente
- Isolamento automatico dati per tenant

**Auth Service** (`core/services/auth-service.js`):
- `getCurrentUser()` - Utente corrente
- Verifica autenticazione

### Struttura Firestore

```
Firestore/
├── tenants/{tenantId}/
│   ├── terreni/
│   │   └── {terrenoId}/
│   │       ├── nome
│   │       ├── superficie
│   │       ├── coordinate
│   │       ├── polygonCoords
│   │       └── note
│   │
│   ├── attivita/
│   │   └── {attivitaId}/
│   │       ├── data
│   │       ├── terrenoId
│   │       ├── terrenoNome
│   │       ├── tipoLavoro
│   │       ├── coltura
│   │       ├── orarioInizio
│   │       ├── orarioFine
│   │       ├── pauseMinuti
│   │       ├── oreNette
│   │       └── note
│   │
│   └── liste/
│       └── personalizzate/
│           ├── tipiLavoro
│           └── colture
```

---

## 📝 Note Implementative

### 1. Colture Associate all'Attività
- Campo `coltura` in ogni attività (non nel terreno)
- Dropdown in form attività
- Filtro per coltura nel diario

### 2. Date Solo Presente/Passate
- Date picker con `max = oggi`
- Validazione lato client e server
- Nessuna pianificazione futura

### 3. Modifica Sempre Possibile
- Nessun blocco temporale
- Tutte le attività modificabili (anche vecchie)
- Log timestamp aggiornamento

### 4. Eliminazione con Conferma
- Modal di conferma obbligatorio
- Messaggio chiaro ("Eliminare questa attività?")
- Azione irreversibile

### 5. Mappe Opzionali
- Terreno può esistere senza mappa
- Bottone "Traccia confini" opzionale
- Se mappa tracciata: calcolo superficie automatico
- Se mappa non tracciata: inserimento manuale superficie

### 6. Single-User
- Solo proprietario (utente loggato) vede/gestisce dati
- Architettura multi-tenant già presente (1 utente = 1 tenant)
- Nessuna gestione permessi necessaria nel core base

---

## 🚀 Ordine di Implementazione Consigliato

1. **Fase 1**: Modelli e servizi base (fondamenta)
2. **Fase 2**: Terreni (più semplice, base per attività)
3. **Fase 3**: Liste personalizzate (necessarie per attività)
4. **Fase 4**: Attività (core funzionalità)
5. **Fase 5**: Statistiche (aggregazioni)
6. **Fase 6**: Integrazione mappe (da vecchia app)

---

## 📚 Riferimenti

- **Vecchia App**: `vecchia app/anagrafica_clienti.html` - Codice mappe da riutilizzare
- **Core Services**: `core/services/` - Servizi base già implementati
- **Architettura**: `vecchia app/.cursorrules` - Regole e convenzioni

---

## 🎯 Obiettivo Finale

Un'applicazione core base funzionante che permette a un'azienda agricola di:
- ✅ Gestire i propri terreni (con mappe opzionali)
- ✅ Tracciare le attività lavorative svolte (diario)
- ✅ Personalizzare tipi lavoro e colture
- ✅ Visualizzare statistiche base
- ✅ Essere pronta per moduli futuri (MANODOPERA, CONTO TERZI, VENDEMMIA)

---

**Stato**: ✅ Pianificazione completata - Pronto per implementazione  
**Prossimo passo**: Iniziare Fase 1 (Modelli e Servizi Base)






