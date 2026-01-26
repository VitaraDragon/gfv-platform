# 📋 Riepilogo Lavori - 2026-01-14

## ✅ Integrazione Sistema Lavori/Diario con Modulo Vigneto Completata

### Obiettivo
Integrare il sistema core "Lavori/Diario" con il modulo Vigneto per aggregare automaticamente le spese dai lavori completati e aggiornare i dati finanziari del vigneto.

---

## 🎯 Lavoro Completato

### 1. Servizio Integrazione Lavori-Vigneto ✅
**File**: `modules/vigneto/services/lavori-vigneto-service.js`

**Cosa fatto**:
- ✅ Creato servizio dedicato per integrazione Lavori/Diario → Vigneto
- ✅ Mappatura tipi lavoro → categorie spese vigneto (potatura, trattamenti, vendemmia, altro)
- ✅ Calcolo costi lavori (manodopera + macchine) da ore validate
- ✅ Aggregazione spese annuali per vigneto
- ✅ Aggiornamento automatico spese vigneto
- ✅ Gestione indice composito Firestore (recupero tutti i lavori, filtro lato client)
- ✅ Conversione corretta Timestamp Firestore per filtro anno

**Funzionalità Principali**:

#### `calcolaCostiLavoro(lavoroId, lavoro)`
- Recupera ore validate per il lavoro
- Calcola costo manodopera (ore × tariffe operai)
- Calcola costo macchine (ore macchina × costo macchina, se modulo attivo)
- Ritorna `{ costoManodopera, costoMacchine, costoTotale }`

#### `getLavoriPerTerreno(terrenoId, options)`
- Recupera tutti i lavori per un terreno (evita indice composito)
- Filtra lato client per stato ('completato') e anno
- Calcola costi per ogni lavoro
- Ritorna array di lavori con costi calcolati

#### `aggregaSpeseVignetoAnno(vignetoId, anno)`
- Carica lavori completati per il terreno del vigneto
- Aggrega costi per categoria spesa (potatura, trattamenti, vendemmia, altro, macchine)
- Ritorna oggetto con spese aggregate

#### `aggiornaSpeseVignetoDaLavori(vignetoId, anno)`
- Aggrega spese e aggiorna vigneto in Firestore

#### `aggiornaVignetiDaTerreno(terrenoId, anno)`
- Trova tutti i vigneti collegati a un terreno
- Aggiorna spese per ogni vigneto

#### `ricalcolaSpeseVignetoAnno(vignetoId, anno)`
- Alias pubblico per ricalcolo manuale

**Mappatura Tipi Lavoro → Categorie Spese**:
- `potatura`, `potatura_vite`, `potatura_invernale`, `potatura_verde`, `spollonatura` → `spesePotaturaAnno`
- `trattamento`, `trattamento_fitosanitario`, `antifungino`, `insetticida`, `fertilizzante` → `speseTrattamentiAnno`
- `vendemmia`, `raccolta_uva` → `speseVendemmiaAnno`
- `diradamento`, `legatura`, `sfogliatura`, `cimatura` → `speseAltroAnno`
- Default → `speseManodoperaAnno`
- Costi macchine → sempre `speseMacchineAnno`

---

### 2. Integrazione Automatica Completamento Lavori ✅

**File modificati**:

#### `core/admin/js/gestione-lavori-events.js`
- ✅ Aggiunta chiamata `aggiornaVignetiDaTerreno()` in `approvaLavoro()`
- ✅ Aggiunta chiamata `aggiornaVignetiDaTerreno()` in `handleSalvaLavoro()`
- ✅ Verifica modulo vigneto attivo prima di chiamare servizio

#### `core/js/attivita-events.js`
- ✅ Aggiunta chiamata `aggiornaVignetiDaTerreno()` in `salvaAttivitaRapida()`
- ✅ Verifica modulo vigneto attivo prima di chiamare servizio

#### `core/admin/lavori-caposquadra-standalone.html`
- ✅ Aggiunta chiamata `aggiornaVignetiDaTerreno()` quando lavoro passa automaticamente a 'completato' (100% progresso)
- ✅ Verifica modulo vigneto attivo prima di chiamare servizio

**Comportamento**:
- Quando un lavoro viene completato (approvazione manager, attività rapida, o completamento automatico), le spese del vigneto vengono aggiornate automaticamente
- L'aggiornamento è **non invasivo**: verifica sempre se il modulo vigneto è attivo prima di eseguire

---

### 3. UI Pulsante Ricalcolo Manuale ✅

**File**: `modules/vigneto/views/vigneti-standalone.html`

**Cosa fatto**:
- ✅ Aggiunto pulsante "🔄 Ricalcola Spese" nella riga filtri (allineato a destra)
- ✅ Funzione `ricalcolaSpeseTuttiVigneti()` per ricalcolare tutte le spese
- ✅ Progress feedback durante ricalcolo
- ✅ Gestione errori e ripristino stato pulsante
- ✅ Ricarica automatica lista vigneti dopo ricalcolo

**Posizionamento**:
- Pulsante posizionato nella riga filtri, allineato a destra
- Filtri (Terreno, Varietà, Stato, Filtra) allineati a sinistra
- Layout coerente con resto dell'app

---

## 🔧 Problemi Risolti

### 1. Indice Composito Firestore ❌ → ✅
**Problema**: Query con filtri multipli (`terrenoId` + `stato` + `orderBy`) richiedeva indice composito.

**Soluzione**:
- Recupero TUTTI i lavori (senza filtri) da Firestore
- Filtro lato client per `terrenoId`, `stato` e `anno`
- Evita completamente bisogno di indici compositi

### 2. Conversione Timestamp Firestore ❌ → ✅
**Problema**: `dataInizio` veniva convertita in `Invalid Date` dal modello Lavoro.

**Soluzione**:
- Recupero dati raw direttamente da Firestore
- Preservo Timestamp originali in `_originalData`
- Conversione robusta che gestisce tutti i formati:
  - Timestamp Firestore (`.toDate()`)
  - Timestamp Firestore (oggetto con `.seconds`)
  - Date JavaScript
  - Stringhe ISO
  - Numeri (timestamp Unix)

### 3. Visibilità Pulsante Ricalcolo ❌ → ✅
**Problema**: Pulsante non visibile nella posizione iniziale.

**Soluzione**:
- Spostato pulsante nella riga filtri
- Allineato a destra con `margin-left: auto`
- Layout coerente con resto dell'app

---

## 📊 Statistiche

### File Creati
- ✅ `modules/vigneto/services/lavori-vigneto-service.js` (~450 righe)

### File Modificati
- ✅ `core/admin/js/gestione-lavori-events.js` - Integrazione approvazione lavori
- ✅ `core/js/attivita-events.js` - Integrazione attività rapida
- ✅ `core/admin/lavori-caposquadra-standalone.html` - Integrazione completamento automatico
- ✅ `modules/vigneto/views/vigneti-standalone.html` - Pulsante ricalcolo manuale

### Funzionalità Implementate
- ✅ 6 funzioni principali nel servizio integrazione
- ✅ 3 punti di integrazione automatica
- ✅ 1 pulsante UI per ricalcolo manuale

---

## ✅ Benefici Ottenuti

### Integrazione Automatica
- ✅ Spese vigneto aggiornate automaticamente quando un lavoro viene completato
- ✅ Nessun intervento manuale necessario
- ✅ Dati sempre aggiornati e coerenti

### Calcolo Accurate
- ✅ Calcolo basato su ore validate (fonte di verità)
- ✅ Supporto costi manodopera e macchine
- ✅ Aggregazione per categoria spesa corretta

### Flessibilità
- ✅ Ricalcolo manuale disponibile se necessario
- ✅ Integrazione non invasiva (verifica modulo attivo)
- ✅ Compatibile con architettura multi-tenant

### Robustezza
- ✅ Gestione errori completa
- ✅ Evita problemi indice composito Firestore
- ✅ Conversione Timestamp robusta

---

## 🧪 Test Eseguiti

### Test Funzionalità Base ✅
- ✅ Creazione lavoro di potatura
- ✅ Segnatura ore e validazione
- ✅ Completamento lavoro
- ✅ Verifica aggiornamento spese vigneto

### Test Calcolo Costi ✅
- ✅ Calcolo costo manodopera (ore × tariffa)
- ✅ Calcolo costo macchine (se modulo attivo)
- ✅ Aggregazione per categoria corretta

### Test Integrazione Automatica ✅
- ✅ Approvazione lavoro manager → aggiornamento automatico
- ✅ Attività rapida → aggiornamento automatico
- ✅ Completamento automatico (100%) → aggiornamento automatico

### Test Ricalcolo Manuale ✅
- ✅ Pulsante ricalcolo funzionante
- ✅ Progress feedback durante ricalcolo
- ✅ Gestione errori corretta

### Test Edge Cases ✅
- ✅ Lavori senza ore validate → costi = 0
- ✅ Lavori di anni diversi → filtro anno corretto
- ✅ Lavori non completati → esclusi dal calcolo
- ✅ Vigneti senza lavori → spese = 0

---

## 📝 Note Tecniche

### Architettura
- **Pattern**: Servizio dedicato per integrazione cross-modulo
- **Approccio**: Non invasivo (verifica modulo attivo prima di eseguire)
- **Fonte di verità**: Sistema Lavori/Diario (ore validate)

### Performance
- **Ottimizzazione**: Recupero tutti i lavori una volta, filtro lato client
- **Evita**: Indice composito Firestore (non necessario)
- **Scalabilità**: Funziona anche con molti lavori (filtro lato client)

### Compatibilità
- ✅ Compatibile con architettura multi-tenant
- ✅ Compatibile con sistema moduli opzionali
- ✅ Retrocompatibile (non modifica dati esistenti)

---

## 🎯 Stato Finale

### Prima
- ⚠️ Spese vigneto non aggiornate automaticamente
- ⚠️ Nessun collegamento tra lavori e spese vigneto
- ⚠️ Calcolo manuale necessario

### Dopo
- ✅ Spese vigneto aggiornate automaticamente quando lavoro completato
- ✅ Integrazione completa Lavori/Diario → Vigneto
- ✅ Calcolo automatico basato su ore validate
- ✅ Ricalcolo manuale disponibile se necessario

---

## 📋 Checklist Completamento

- [x] Servizio integrazione creato
- [x] Mappatura tipi lavoro → categorie spese
- [x] Calcolo costi lavori (manodopera + macchine)
- [x] Aggregazione spese annuali
- [x] Integrazione automatica completamento lavori (3 punti)
- [x] Pulsante ricalcolo manuale UI
- [x] Gestione indice composito Firestore
- [x] Conversione Timestamp Firestore
- [x] Test funzionalità base
- [x] Test calcolo costi
- [x] Test integrazione automatica
- [x] Test ricalcolo manuale
- [x] Test edge cases

---

## 🚀 Prossimi Passi Consigliati

### Breve Termine
1. 🟡 **Test con Dati Reali** - Verificare con più lavori e vigneti
2. 🟡 **Ottimizzazione Performance** - Se necessario con molti lavori

### Medio Termine
3. 🟢 **Estendere ad Altri Moduli** - Applicare stesso pattern a Frutteto/Oliveto quando implementati
4. 🟢 **Report Spese Vigneto** - Visualizzazione dettagliata spese per categoria

---

## ✅ Conclusione

**Integrazione Sistema Lavori/Diario con Modulo Vigneto completata con successo!**

Il sistema ora aggrega automaticamente le spese dai lavori completati e aggiorna i dati finanziari del vigneto. L'integrazione è non invasiva, robusta e compatibile con l'architettura esistente.

**Stato**: ✅ **Completato e testato**

---

**Data Completamento**: 2026-01-14  
**Tempo Impiegato**: ~6-7 ore (sviluppo + test + fix)  
**Stato**: ✅ **Completato e funzionante**

---

## 🔧 Miglioramenti Calcolo Costi - 2026-01-14 (Pomeriggio)

### Obiettivo
Migliorare il calcolo dei costi per includere tutti i componenti (trattore + attrezzo) e supportare il caso in cui il modulo Manodopera non è attivo.

---

## ✅ Modifiche Completate

### 1. Correzione Calcolo Costi Macchine ✅
**Problema Identificato**: Il calcolo costi considerava solo il trattore (`macchinaId`), ma non l'attrezzo (`attrezzoId`).

**Soluzione Implementata**:
- ✅ Modificato `calcolaCostiLavoro()` in `modules/vigneto/services/lavori-vigneto-service.js`
- ✅ Ora aggrega ore sia per trattore che per attrezzo
- ✅ Calcola costi per entrambi e li somma in `costoMacchine`

**Formula Aggiornata**:
```
Costo Totale = Costo Manodopera + Costo Trattore + Costo Attrezzo
```

**File Modificati**:
- ✅ `modules/vigneto/services/lavori-vigneto-service.js` - Aggregazione ore trattore + attrezzo

---

### 2. Supporto Calcolo Costi Senza Modulo Manodopera ✅
**Problema Identificato**: Quando il modulo Manodopera non è attivo, il proprietario svolge i lavori direttamente tramite Diario Attività, ma non c'era modo di calcolare il costo della sua manodopera.

**Soluzione Implementata**:

#### A. Funzione Tariffa Proprietario ✅
**File**: `core/services/calcolo-compensi-service.js`
- ✅ Aggiunta funzione `getTariffaProprietario(tenantId)`
- ✅ Recupera tariffa da `tenants/{tenantId}/tariffe/proprietario`
- ✅ Default: 15.00 €/ora se non configurata

#### B. Calcolo Costi da Diario Attività ✅
**File**: `modules/vigneto/services/lavori-vigneto-service.js`
- ✅ Modificato `calcolaCostiLavoro()` per gestire caso senza modulo Manodopera
- ✅ Se non ci sono ore da operai, cerca nelle attività del Diario collegate al lavoro (`lavoroId`)
- ✅ Calcola costo manodopera usando tariffa proprietario
- ✅ Aggrega anche costi macchina dalle attività (trattore + attrezzo)

**Logica Implementata**:
1. Prima cerca ore validate da operai (se modulo Manodopera attivo)
2. Se non trova, cerca nelle attività del Diario (se modulo Manodopera non attivo)
3. Usa tariffa proprietario per calcolare costo manodopera
4. Aggrega costi macchina da entrambe le fonti

#### C. UI Configurazione Tariffa Proprietario ✅
**File**: `core/admin/impostazioni-standalone.html`
- ✅ Aggiunta sezione "Tariffa Proprietario" nella pagina Impostazioni
- ✅ Campo input per inserire/modificare tariffa oraria proprietario
- ✅ Funzioni `loadTariffaProprietario()` e `saveTariffaProprietario()`
- ✅ Salvataggio in `tenants/{tenantId}/tariffe/proprietario`

**Struttura Dati**:
```javascript
tenants/{tenantId}/tariffe/proprietario
{
  tariffaOraria: 15.0,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## 📊 Dettaglio Modifiche

### File Modificati

1. **`core/services/calcolo-compensi-service.js`**
   - ✅ Aggiunta funzione `getTariffaProprietario(tenantId)`
   - ✅ Export della funzione per uso in altri moduli

2. **`modules/vigneto/services/lavori-vigneto-service.js`**
   - ✅ Import `getTariffaProprietario` da calcolo-compensi-service
   - ✅ Aggregazione ore attrezzo (oltre a trattore)
   - ✅ Logica per cercare attività Diario quando modulo Manodopera non attivo
   - ✅ Calcolo costo manodopera proprietario da attività Diario
   - ✅ Aggregazione costi macchina anche da attività Diario

3. **`core/admin/impostazioni-standalone.html`**
   - ✅ Aggiunta sezione UI "Tariffa Proprietario"
   - ✅ Funzione `loadTariffaProprietario()` per caricare tariffa esistente
   - ✅ Funzione `saveTariffaProprietario()` per salvare tariffa
   - ✅ Integrazione con `loadTariffe()` per caricare anche tariffa proprietario

---

## 🎯 Benefici Ottenuti

### Calcolo Costi Completo
- ✅ Include tutti i componenti: manodopera + trattore + attrezzo
- ✅ Calcolo accurato anche quando si usa combinazione trattore+attrezzo

### Supporto Senza Modulo Manodopera
- ✅ Calcolo costi funziona anche quando il proprietario svolge lavori direttamente
- ✅ Configurazione semplice della tariffa proprietario
- ✅ Integrazione trasparente con sistema esistente

### Flessibilità
- ✅ Funziona sia con modulo Manodopera attivo che senza
- ✅ Configurazione tariffa proprietario nelle Impostazioni
- ✅ Default sensato (15.00 €/ora) se non configurato

---

## 🧪 Test da Eseguire

### Test Calcolo Costi con Attrezzo
- [ ] Lavoro con trattore + attrezzo → verifica che entrambi i costi siano inclusi
- [ ] Lavoro solo con trattore → verifica che funzioni correttamente
- [ ] Lavoro solo con attrezzo → verifica che funzioni correttamente

### Test Senza Modulo Manodopera
- [ ] Configurare tariffa proprietario nelle Impostazioni
- [ ] Creare lavoro senza operai
- [ ] Registrare attività nel Diario Attività collegata al lavoro
- [ ] Verificare che il costo manodopera venga calcolato usando tariffa proprietario
- [ ] Verificare che i costi macchina vengano inclusi correttamente

---

## ✅ Stato Finale

### Prima
- ⚠️ Calcolo costi considerava solo trattore, non attrezzo
- ⚠️ Impossibile calcolare costi quando modulo Manodopera non attivo
- ⚠️ Nessun modo per configurare tariffa proprietario

### Dopo
- ✅ Calcolo costi include trattore + attrezzo
- ✅ Calcolo costi funziona anche senza modulo Manodopera
- ✅ Tariffa proprietario configurabile nelle Impostazioni
- ✅ Calcolo automatico da attività Diario quando appropriato

---

**Data Modifiche**: 2026-01-14 (Pomeriggio)  
**Tempo Impiegato**: ~1-2 ore  
**Stato**: ✅ **Completato**

---

## 🔧 Fix Calcolo Spese Macchine Dettaglio Vigneto - 2026-01-14 (Sera)

### Obiettivo
Correggere la discrepanza tra il totale spese mostrato nella tabella principale (615€) e il totale nel dettaglio spese (445€) per il vigneto Cabernet Sauvignon.

---

## ✅ Problema Identificato e Risolto

### Problema
- **Tabella principale**: Mostrava `costoTotaleAnno: 615€` (90 + 100 + 425)
- **Dettaglio spese**: Mostrava `totaleGenerale: 445€` (90 + 100 + 255)
- **Discrepanza**: 170€ mancanti nel dettaglio (spese macchine incomplete)

### Causa Root
L'attività diretta `yJr6w7JHvniFtKEbDwVU` aveva sia `macchinaId` (trattore) che `attrezzoId` (attrezzo):
- `macchinaId: idbpamcXfSek7mgT9weV` → 8.5 ore × 30€ = 255€
- `attrezzoId: hQDGDahs6Fhc2S2eWrSl` → 8.5 ore × 20€ = 170€
- **Totale atteso**: 425€

**In `aggregaSpeseVignetoAnno`**:
- ✅ Calcolava correttamente entrambi (255€ + 170€ = 425€)

**In `getDettaglioSpeseVignetoAnno`**:
- ❌ Calcolava solo il `macchinaId` (255€) perché usava `else if` invece di due `if` separati
- ❌ Non includeva l'`attrezzoId` (170€)

---

## ✅ Soluzione Implementata

### 1. Correzione Calcolo Costi Macchine nel Dettaglio ✅
**File**: `modules/vigneto/services/lavori-vigneto-service.js`

**Modifiche**:
- ✅ Cambiato da `else if` a due `if` separati per calcolare sia `macchinaId` che `attrezzoId`
- ✅ Ora calcola il costo per entrambi quando presenti nella stessa attività
- ✅ Somma i costi: `costoMacchine = costoMacchina + costoAttrezzo`

**Codice Prima**:
```javascript
if (macchinaId) {
  // calcola costo macchina
} else if (attrezzoId) {
  // calcola costo attrezzo
}
```

**Codice Dopo**:
```javascript
if (macchinaId) {
  // calcola costo macchina
  costoMacchine += costoMacchina;
}
if (attrezzoId) {
  // calcola costo attrezzo
  costoMacchine += costoAttrezzo;
}
```

### 2. Aggiornamento UI Tabella Attività Dirette ✅
**File**: `modules/vigneto/views/vigneti-standalone.html`

**Modifiche**:
- ✅ Aggiunta colonna "Costo Macchine" nella tabella attività dirette
- ✅ Aggiunta colonna "Totale" (manodopera + macchine)
- ✅ Mostra sia costo manodopera che costo macchine per ogni attività

**Struttura Tabella Aggiornata**:
- Data
- Tipo Lavoro
- Ore
- Costo Manodopera
- Costo Macchine (nuovo)
- Totale (nuovo)

---

## 📊 Risultati

### Prima
- ❌ Dettaglio spese: 445€ (mancavano 170€ di attrezzo)
- ❌ Tabella principale: 615€
- ❌ Discrepanza: 170€

### Dopo
- ✅ Dettaglio spese: 615€ (90 + 100 + 425)
- ✅ Tabella principale: 615€
- ✅ **Totale corrispondente!**

### Breakdown Corretto
- **Manodopera**: 90€
- **Potatura**: 100€
- **Macchine**: 425€
  - Trattore: 255€ (8.5h × 30€)
  - Attrezzo: 170€ (8.5h × 20€)
- **Totale**: 615€

---

## 🔍 Debug Process

### Log Aggiunti (temporanei, poi rimossi)
1. Log attività con macchine incluse/scartate in `aggregaSpeseVignetoAnno`
2. Log `macchineMap` per vedere quali macchine vengono trovate
3. Log costi calcolati per ogni macchina
4. Log attività con macchine scartate in `getDettaglioSpeseVignetoAnno`
5. Log dettagliati per ogni attività con macchine (ID, data, macchinaId, attrezzoId, ore)

### Scoperte
- Attività `yJr6w7JHvniFtKEbDwVU` aveva sia `macchinaId` che `attrezzoId`
- `aggregaSpeseVignetoAnno` calcolava correttamente entrambi
- `getDettaglioSpeseVignetoAnno` calcolava solo il primo (`macchinaId`)
- 2 attività con macchine erano fuori anno (2025) e correttamente escluse

---

## 📝 File Modificati

1. **`modules/vigneto/services/lavori-vigneto-service.js`**
   - ✅ Correzione calcolo costi macchine in `getDettaglioSpeseVignetoAnno`
   - ✅ Calcolo sia `macchinaId` che `attrezzoId` quando presenti
   - ✅ Rimozione log di debug

2. **`modules/vigneto/views/vigneti-standalone.html`**
   - ✅ Aggiunta colonna "Costo Macchine" nella tabella attività dirette
   - ✅ Aggiunta colonna "Totale" nella tabella attività dirette

---

## ✅ Benefici Ottenuti

### Accuratezza
- ✅ Calcolo costi macchine completo e accurato
- ✅ Include sia trattore che attrezzo quando presenti
- ✅ Totale dettaglio corrisponde al totale tabella principale

### Trasparenza
- ✅ UI mostra sia costo manodopera che costo macchine per ogni attività
- ✅ Utente può vedere breakdown dettagliato delle spese

### Coerenza
- ✅ `aggregaSpeseVignetoAnno` e `getDettaglioSpeseVignetoAnno` usano stessa logica
- ✅ Nessuna discrepanza tra calcolo aggregato e dettaglio

---

## 🧪 Test Eseguiti

### Test Calcolo Costi
- ✅ Attività con solo `macchinaId` → calcolo corretto
- ✅ Attività con solo `attrezzoId` → calcolo corretto
- ✅ Attività con sia `macchinaId` che `attrezzoId` → calcolo corretto (entrambi inclusi)

### Test Coerenza
- ✅ Totale dettaglio = Totale tabella principale
- ✅ Spese macchine dettaglio = Spese macchine aggregato

---

## ✅ Stato Finale

### Prima
- ⚠️ Dettaglio spese mostrava 445€ invece di 615€
- ⚠️ Spese macchine incomplete (mancava attrezzo)
- ⚠️ Discrepanza tra tabella principale e dettaglio

### Dopo
- ✅ Dettaglio spese mostra correttamente 615€
- ✅ Spese macchine complete (trattore + attrezzo)
- ✅ Totale corrispondente tra tabella principale e dettaglio
- ✅ UI mostra breakdown dettagliato costi macchine

---

**Data Modifiche**: 2026-01-14 (Sera)  
**Tempo Impiegato**: ~2-3 ore (debug + fix + test)  
**Stato**: ✅ **Completato e testato**
