# 📋 Riepilogo Lavori - 2026-01-20

## 🎯 Obiettivo: Completamento Funzionalità Modulo Vigneto - Filtri, Integrità Dati e Calcolo Costi Macchine

### Modifiche Implementate

---

## 1. ✅ Implementazione Filtri nelle Viste Vigneto e Vendemmia

### Problema
Le viste `vigneti-standalone.html` e `vendemmia-standalone.html` avevano la struttura HTML per i filtri ma mancava la logica di filtraggio.

### Soluzione Implementata

#### Filtri Vigneti (`vigneti-standalone.html`)
- **Filtro Terreno**: Dropdown con tutti i terreni disponibili
- **Filtro Varietà**: Dropdown popolato automaticamente con tutte le varietà presenti nei vigneti
- **Filtro Stato**: Dropdown con stati impianto (attivo, in_riposo, da_rimuovere)
- **Applicazione automatica**: Filtri applicati automaticamente al cambio selezione (`onchange="applyFilters()"`)
- **Pulsante "Pulisci Filtri"**: Reset di tutti i filtri con un solo click
- **Allineamento UI**: Stile allineato al resto dell'app (pulsante unico, CSS coerente)

#### Filtri Vendemmia (`vendemmia-standalone.html`)
- **Filtro Vigneto**: Dropdown con tutti i vigneti disponibili
- **Filtro Varietà**: Dropdown popolato automaticamente con tutte le varietà presenti nelle vendemmie
- **Filtro Anno**: Dropdown con tutti gli anni disponibili (convertito da input number a select)
- **Applicazione automatica**: Filtri applicati automaticamente al cambio selezione
- **Pulsante "Pulisci Filtri"**: Reset di tutti i filtri
- **Allineamento UI**: Stile allineato al resto dell'app

#### Dettagli Tecnici
- Variabili globali `allVigneti` e `allVendemmie` per mantenere dati non filtrati
- Funzione `applyFilters()` che filtra i dati in base ai valori selezionati
- Funzione `resetFilters()` che resetta tutti i filtri e riapplica il filtro
- Popolamento automatico dropdown varietà/anno con valori unici dai dati

### File Modificati
- ✅ `modules/vigneto/views/vigneti-standalone.html` - Logica filtraggio completa
- ✅ `modules/vigneto/views/vendemmia-standalone.html` - Logica filtraggio completa

---

## 2. ✅ Gestione Modifiche/Eliminazioni Lavori Collegati alle Vendemmie

### Problema
Quando un lavoro collegato a una vendemmia veniva modificato o eliminato, la vendemmia non veniva aggiornata o eliminata, causando inconsistenza nei dati.

### Soluzione Implementata

#### Funzioni Helper Aggiunte (`vendemmia-service.js`)
- `findVendemmiaByLavoroId(lavoroId)`: Trova vendemmia collegata a un lavoro
- `findVendemmiaByAttivitaId(attivitaId)`: Trova vendemmia collegata a un'attività

#### Gestione Modifiche Lavori (`gestione-lavori-events.js`)
- **Tipo lavoro cambiato da vendemmia a altro**: Elimina automaticamente la vendemmia collegata
- **Terreno cambiato da VITE a altro**: Scollega la vendemmia (mantiene dati produzione, rimuove `lavoroId`)
- **Lavoro ancora vendemmia su terreno VITE**: La vendemmia viene aggiornata automaticamente al completamento

#### Gestione Eliminazioni Lavori (`gestione-lavori-events.js`)
- **Lavoro eliminato**: Se collegato a vendemmia, elimina automaticamente la vendemmia

#### Gestione Modifiche Attività (`attivita-events.js`)
- **Tipo lavoro cambiato da vendemmia a altro**: Elimina automaticamente la vendemmia collegata
- **Terreno cambiato da VITE a altro**: Scollega la vendemmia (rimuove `attivitaId`)

#### Gestione Eliminazioni Attività (`attivita-events.js`)
- **Attività eliminata**: Se collegata a vendemmia, elimina automaticamente la vendemmia

### File Modificati
- ✅ `modules/vigneto/services/vendemmia-service.js` - Funzioni helper per ricerca vendemmie
- ✅ `core/admin/js/gestione-lavori-events.js` - Gestione modifiche/eliminazioni lavori
- ✅ `core/js/attivita-events.js` - Gestione modifiche/eliminazioni attività

---

## 3. ✅ Fix Calcolo Costo Macchine nelle Vendemmie

### Problema
Il costo totale delle vendemmie non includeva il costo delle macchine. Il modello `Vendemmia` aveva il campo `costoMacchine` e lo includeva nel calcolo (`costoTotale = costoManodopera + costoMacchine`), ma `costoMacchine` non veniva mai calcolato.

### Soluzione Implementata

#### Calcolo Costo Macchine (`vendemmia-service.js`)
- **Verifica modulo Parco Macchine**: Controlla se il modulo è attivo
- **Supporto formati macchine**: Gestisce sia array di ID che array di oggetti `{id, ore}`
- **Recupero ore macchina**:
  - Se vendemmia collegata a lavoro: recupera ore dalle `oreOperai` validate del lavoro
  - Se vendemmia collegata ad attività: usa `oreMacchina` o `oreNette` dall'attività
  - Altrimenti: stima dividendo `oreImpiegate` per numero macchine
- **Calcolo costo**: Per ogni macchina, calcola `costo = oreMacchina × macchina.costoOra`
- **Aggiornamento automatico**: `costoMacchine` viene calcolato e salvato automaticamente

#### Logica Chiamata Aggiornata
- `createVendemmia()`: Calcola sempre se ci sono operai o macchine
- `updateVendemmia()`: Ricalcola se operai, macchine o oreImpiegate vengono modificati
- `createVendemmiaFromLavoro()`: Calcola quando la vendemmia viene creata automaticamente
- `createVendemmiaFromAttivita()`: Calcola quando la vendemmia viene creata automaticamente

#### Estrazione Macchine dal Form (`vendemmia-standalone.html`)
- **Vendemmia collegata a lavoro**: Recupera macchine dal lavoro (`macchinaId`, `attrezzoId`)
- **Vendemmia non collegata**: Estrae macchine dalla tabella con `data-macchina-id` e ore
- **Aggiunta ID macchine**: Quando vengono caricate dall'attività, viene incluso l'ID per il calcolo costi

#### Log Dettagliati
- Aggiunti log completi per tracciare:
  - Stato modulo Parco Macchine
  - Macchine trovate nella vendemmia
  - Formato macchine (array ID o oggetti)
  - Ore calcolate/recuperate per ogni macchina
  - Dati macchina caricati (nome, costoOra)
  - Costo calcolato per ogni macchina
  - Costo totale macchine

### File Modificati
- ✅ `modules/vigneto/services/vendemmia-service.js` - Calcolo costo macchine completo
- ✅ `modules/vigneto/views/vendemmia-standalone.html` - Estrazione macchine dal form e aggiunta ID

---

## 4. 📝 Pianificazione Dashboard Standalone Dedicata

### Obiettivo
Creare una dashboard dedicata per il modulo vigneto, allineata al pattern del modulo Conto Terzi, accessibile solo a manager/amministratori.

### Struttura Pianificata

#### Layout Generale
- **Header**: Sfondo viola (`#6A1B9A`), titolo "🍇 VIGNETO", link "← Dashboard Principale"
- **Filtri**: Dropdown vigneto (tutti i vigneti) + dropdown anno (anno corrente default)
- **Stats Grid**: Card statistiche con numeri e grafici Chart.js
- **Quick Actions**: Card azioni rapide
- **Sezioni**: Vendemmie recenti, lavori vigneto

#### Card Statistiche
1. **Produzione Anno Corrente**: Qli totali + mini grafico a barre produzione mensile
2. **Resa Media**: Qli/Ha complessiva + mini grafico a barre resa per varietà
3. **Spese Vendemmia Anno**: € totali + mini grafico a linee trend mensile spese
4. **Numero Vigneti Totali**: Conteggio vigneti
5. **Vendemmie Anno Corrente**: Conteggio vendemmie
6. **Ultima Vendemmia**: Data ultima vendemmia con link al dettaglio

#### Card Azioni Rapide
- Anagrafica Vigneti → `vigneti-standalone.html`
- Gestione Vendemmia → `vendemmia-standalone.html`
- Pianificazione Nuovo Vigneto → pulsante che apre modal esistente
- Potatura (se implementata)
- Trattamenti (se implementata)

#### Sezione Vendemmie Recenti
- Tabella ultime 10 vendemmie (data, vigneto, quantità, resa, costo, link)
- Filtrabile per vigneto/anno

#### Sezione Lavori Vigneto
- Lavori in corso collegati a vigneti
- Lavori completati recenti (ultimi 10)
- Filtrabile per vigneto/anno

#### Servizi da Creare
- Nuovo file: `modules/vigneto/services/vigneto-statistiche-service.js`
  - `getStatisticheVigneto(vignetoId, anno)`: aggregazione dati produzione, resa, costi
  - `getVendemmieRecenti(vignetoId, anno, limit)`: ultime N vendemmie
  - `getLavoriVigneto(vignetoId, anno)`: lavori collegati a vigneto

#### Tecnologie
- Chart.js per grafici (mini grafici nelle card statistiche)
- Stile viola (`#6A1B9A`) allineato al tema vigneto
- Mobile-friendly come dashboard Conto Terzi
- Responsive design

### Documentazione Aggiornata
- ✅ `PLAN_MODULO_VIGNETO_DETTAGLIATO.md` - Aggiunta sezione 6.2 "Dashboard Standalone Dedicata"
- ✅ `STATO_MODULI_SPECIALIZZATI_2026-01-18.md` - Aggiunta sezione 7 "Dashboard Standalone Dedicata"

### File da Creare (Pianificato)
- 📝 `modules/vigneto/views/vigneto-dashboard-standalone.html` - Dashboard principale
- 📝 `modules/vigneto/services/vigneto-statistiche-service.js` - Servizio statistiche

---

## 📊 Riepilogo Funzionalità

### Filtri nelle Viste
- ✅ Filtri vigneti (terreno, varietà, stato) - Funzionanti
- ✅ Filtri vendemmia (vigneto, varietà, anno) - Funzionanti
- ✅ Applicazione automatica al cambio selezione
- ✅ Pulsante "Pulisci Filtri" per reset rapido
- ✅ UI allineata al resto dell'app

### Integrità Dati Vendemmie
- ✅ Gestione modifiche lavori collegati (eliminazione/scollegamento vendemmia)
- ✅ Gestione eliminazioni lavori collegati (eliminazione vendemmia)
- ✅ Gestione modifiche attività collegata (eliminazione/scollegamento vendemmia)
- ✅ Gestione eliminazioni attività collegata (eliminazione vendemmia)
- ✅ Funzioni helper per ricerca vendemmie per lavoroId/attivitaId

### Calcolo Costi Macchine
- ✅ Calcolo automatico costo macchine nelle vendemmie
- ✅ Supporto vendemmie collegate a lavoro (ore da oreOperai)
- ✅ Supporto vendemmie collegate ad attività (ore da attività)
- ✅ Supporto vendemmie standalone (stima ore)
- ✅ Estrazione macchine dal form con ID e ore
- ✅ Log dettagliati per debug

### Pianificazione Dashboard
- ✅ Struttura completa pianificata
- ✅ Servizi da creare identificati
- ✅ Documentazione aggiornata

---

## 🔧 Dettagli Tecnici

### Filtri
- **Variabili globali**: `allVigneti[]` e `allVendemmie[]` per dati non filtrati
- **Funzione applyFilters()**: Filtra array in base ai valori selezionati
- **Popolamento dropdown**: Estrazione valori unici dai dati (varietà, anni)
- **CSS allineato**: `align-items: flex-end`, `min-width: 150px` per select

### Integrità Dati
- **Ricerca vendemmie**: Scansione di tutti i vigneti per trovare vendemmia collegata
- **Gestione errori**: Try-catch per non bloccare operazioni principali
- **Log di debug**: Console log per tracciare operazioni

### Calcolo Costi Macchine
- **Libreria**: Usa `getMacchina()` dal modulo Parco Macchine
- **Costo orario**: `macchina.costoOra` (€/ora)
- **Formato dati**: Supporta array di ID o array di oggetti `{id, ore}`
- **Recupero ore**: Priorità: oreOperai validate > attività > stima

### Dashboard Pianificata
- **Pattern**: Allineato a `conto-terzi-home-standalone.html`
- **Grafici**: Chart.js per mini grafici nelle card
- **Permessi**: Solo manager/amministratori
- **Filtri**: Vigneto (tutti) + Anno (default: corrente)

---

## ✅ Stato Completamento

### Completato Oggi
- [x] Filtri vigneti (terreno, varietà, stato)
- [x] Filtri vendemmia (vigneto, varietà, anno)
- [x] Allineamento UI filtri al resto dell'app
- [x] Gestione modifiche lavori collegati a vendemmie
- [x] Gestione eliminazioni lavori collegati a vendemmie
- [x] Gestione modifiche attività collegata a vendemmie
- [x] Gestione eliminazioni attività collegata a vendemmie
- [x] Funzioni helper ricerca vendemmie
- [x] Calcolo costo macchine nelle vendemmie
- [x] Estrazione macchine dal form con ID
- [x] Log dettagliati per debug calcolo costi
- [x] Pianificazione dashboard standalone
- [x] Aggiornamento documentazione

### Da Implementare (Prossimi Passi)
- [ ] Dashboard standalone dedicata (`vigneto-dashboard-standalone.html`)
- [ ] Servizio statistiche (`vigneto-statistiche-service.js`)
- [ ] Grafici Chart.js nelle card statistiche

---

## 📝 Note

### Filtri
- I filtri vengono applicati automaticamente al cambio selezione per migliorare UX
- Il pulsante "Pulisci Filtri" è unico (non più "Filtra" + "Reset") per coerenza con resto app
- I dropdown varietà/anno vengono popolati automaticamente con valori unici dai dati

### Integrità Dati
- Le vendemmie vengono gestite automaticamente quando si modifica/elimina il lavoro/attività collegato
- Se il terreno cambia da VITE a altro, la vendemmia viene scollegata ma non eliminata (mantiene dati produzione)
- Se il tipo lavoro cambia da vendemmia a altro, la vendemmia viene eliminata completamente

### Calcolo Costi Macchine
- Il costo viene calcolato solo se il modulo Parco Macchine è attivo
- Se una macchina non ha `costoOra` impostato, viene saltata nel calcolo (log di warning)
- Le ore vengono recuperate prioritariamente dalle `oreOperai` validate del lavoro se disponibili

### Dashboard
- La dashboard sarà accessibile solo a manager/amministratori
- I filtri vigneto/anno aggiornano automaticamente tutte le sezioni
- I grafici Chart.js saranno mini grafici integrati nelle card statistiche

---

**Data**: 2026-01-20  
**Stato**: ✅ Completato (Filtri, Integrità Dati, Calcolo Costi Macchine) + 📝 Pianificato (Dashboard Standalone)
