# 🍇 Piano Dettagliato: Modulo Vigneto

**Data creazione**: 2026-01-12  
**Ultimo aggiornamento**: 2026-02-03 (Trattamenti: alert dosaggio con conferma salvataggio, colonna Avvisi con bollino verde/⚠️, pulsante Modifica visibile; costi prodotti trattamenti inclusi in statistiche dashboard) | 2026-01-31 (Raccolta Frutta; lista condivisa Calcolo materiali; forma allevamento Pianificazione frutteto; pali frutteto; Gestione lavori Impianto Frutteto; **Pagine e card Potatura e Trattamenti vigneto**)
**Stato**: ✅ IMPLEMENTATO - Funzionalità Vendemmia Completata + Tracciamento Poligono Avanzato + Rilevamento Automatico + Calcolo Compensi + Pianificazione Nuovi Impianti (Base) + Calcolo Materiali Impianto + Integrazione Creazione Vigneti da Lavori + Allineamento Frutteto + Tracciamento Raccolta Frutta + Calcolo materiali: lista forma allevamento condivisa; Pianificazione: forma allevamento visibile e salvata anche per frutteto/oliveto + **Pagine standalone Potatura e Trattamenti + card in dashboard; evoluzione “da lavori/attività” pianificata in PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md**
**Priorità**: Alta  
**Riferimento**: `PLAN_MODULI_COLTURA_SPECIALIZZATI.md`

---

## 🎯 Obiettivo del Modulo

Il Modulo Vigneto estende il sistema base con funzionalità specializzate per la gestione completa di vigneti, dalla pianificazione dell'impianto alla vendemmia, dalla potatura ai trattamenti, fino al tracciamento di rese, costi e qualità dell'uva.

**Valore Aggiunto**:
- Gestione completa ciclo viticolo annuale
- Tracciamento qualità uva (gradazione, acidità, pH)
- Calcolo automatico compensi vendemmia
- Pianificazione e ottimizzazione impianti
- Report produzione e costi dettagliati

---

## 🏗️ Architettura e Integrazione

### Principi Fondamentali

1. **Modulo Opzionale Pay-Per-Use**
   - Attivabile/disattivabile per tenant
   - Pricing: €12-15/mese (da confermare)
   - Nessun impatto su funzionalità esistenti quando disattivato

2. **Integrazione Non Invasiva**
   - Non modifica modelli core esistenti
   - Usa sub-collections separate: `tenants/{tenantId}/vigneti/`
   - Riferimento a terreno: `terrenoId` (collegamento, non duplicazione)

3. **Compatibilità Retroattiva**
   - Terreni esistenti con coltura "Vite" continuano a funzionare
   - Attivazione modulo non richiede migrazione dati
   - Creazione anagrafica vigneto opzionale e guidata

### Struttura Dati

```
tenants/{tenantId}/
├── vigneti/{vignetoId}                    # Anagrafica vigneto
│   ├── vendemmie/{vendemmiaId}            # Sub-collection vendemmie
│   ├── potature/{potaturaId}              # Sub-collection potature
│   ├── diradamenti/{diradamentoId}        # Sub-collection diradamenti
│   └── trattamenti/{trattamentoId}        # Sub-collection trattamenti
└── pianificazioni-impianti/{pianificazioneId}  # Pianificazioni nuovi impianti
```

**Riferimenti**:
- `vigneto.terrenoId` → `terreni/{terrenoId}` (collegamento, non duplicazione)
- `vendemmia.vignetoId` → `vigneti/{vignetoId}`
- `vendemmia.operai[]` → `users/{userId}` (riferimenti operai)
- `vendemmia.macchine[]` → `macchine/{macchinaId}` (riferimenti macchine)

---

## 📋 Funzionalità Dettagliate

### 1. Anagrafica Vigneti

#### 1.1. Dati Base (Campi Comuni)

| Campo | Tipo | Obbligatorio | Descrizione | Esempio |
|-------|------|--------------|-------------|---------|
| `terrenoId` | string | ✅ Sì | Riferimento terreno | "terreno-123" |
| `varieta` | string | ✅ Sì | Varietà uva | "Sangiovese", "Chardonnay" |
| `annataImpianto` | number | ✅ Sì | Anno impianto | 2015 |
| `portainnesto` | string | ⚠️ Opzionale | Tipo portainnesto | "1103P", "SO4", "selvatico" |
| `densita` | number | ✅ Sì | Densità ceppi/ha | 5000 |
| `formaAllevamento` | string | ✅ Sì | Sistema allevamento | "Guyot", "Cordone speronato" |
| `tipoImpianto` | string | ⚠️ Opzionale | Tipo impianto | "tradizionale", "intensivo" |
| `distanzaFile` | number | ✅ Sì | Distanza tra file (metri) | 2.5 |
| `distanzaUnita` | number | ✅ Sì | Distanza tra ceppi (metri) | 0.8 |
| `orientamentoFilari` | string | ⚠️ Opzionale | Orientamento filari | "N-S", "E-O" |
| `superficieEttari` | number | ✅ Sì | Superficie dedicata (ha) | 3.0 |
| `note` | string | ❌ No | Note generali | "..." |

#### 1.2. Campi Specifici Vigneto

| Campo | Tipo | Obbligatorio | Descrizione | Esempio |
|-------|------|--------------|-------------|---------|
| `densitaCepi` | number | ✅ Sì | Densità ceppi/ha (alias di `densita`) | 5000 |
| `distanzaCepi` | number | ✅ Sì | Distanza tra ceppi (alias di `distanzaUnita`) | 0.8 |
| `sistemaAllevamento` | string | ✅ Sì | Sistema allevamento (alias di `formaAllevamento`) | "Guyot", "Cordone speronato" |
| `numeroFilari` | number | ⚠️ Opzionale | Numero filari totali (calcolabile) | 120 |
| `ceppiTotali` | number | ⚠️ Opzionale | Numero totale ceppi (calcolabile) | 60000 |
| `tipoPalo` | string | ✅ Sì | Tipo di palo utilizzato | "cemento", "ferro", "legno", "plastica", "fibra_vetro" |
| `destinazioneUva` | string | ✅ Sì | Destinazione principale | "vino", "vendita_uva", "misto" |
| `cantina` | string | ⚠️ Opzionale | Nome cantina di riferimento | "Cantina Sociale" |

**Note**:
- `densitaCepi`, `distanzaCepi`, `sistemaAllevamento` sono alias per compatibilità terminologia viticola
- `numeroFilari` e `ceppiTotali` possono essere calcolati automaticamente da superficie e distanze
- `tipoPalo` è necessario per la gestione dell'impianto e viene utilizzato anche nella vendemmia
- `destinazioneUva` determina quali report e funzionalità sono più rilevanti

#### 1.3. Campi Rese e Produzione (Aggiornati Automaticamente)

| Campo | Tipo | Descrizione | Calcolo |
|-------|------|-------------|---------|
| `resaMediaQliHa` | number | Resa media storica (quintali/ettaro) | Media ultimi 3-5 anni |
| `resaAnnoPrecedente` | number | Resa anno precedente (quintali/ettaro) | Dato storico |
| `produzioneTotaleAnno` | number | Produzione totale anno corrente (qli, 2 decimali) | Somma vendemmie anno |
| `produzioneTotaleAnnoPrecedente` | number | Produzione totale anno precedente (qli, 2 decimali) | Dato storico |
| `resaPerVarieta` | object | Resa per varietà `{varieta: resaQliHa}` | Calcolato da vendemmie |
| `trendRese` | array | Trend rese ultimi 5 anni `[{anno, resa}]` | Storico calcolato (resa in qli/ha) |

**Note**:
- Le rese sono espresse in **quintali per ettaro** (qli/ha), dove 1 quintale = 100 kg
- La produzione totale è espressa in **quintali** (qli) con 2 decimali di precisione (es. 200.75 qli)
- Conversione automatica: `resaQliHa = quantitaQli / quantitaEttari`

#### 1.4. Campi Spese e Costi (Aggiornati Automaticamente)

| Campo | Tipo | Descrizione | Fonte Dati |
|-------|------|-------------|------------|
| `speseManodoperaAnno` | number | Spese manodopera totali anno (€) | Somma compensi operai |
| `speseTrattamentiAnno` | number | Spese prodotti fitosanitari anno (€) | Somma costi trattamenti |
| `spesePotaturaAnno` | number | Spese potatura anno (€) | Somma costi potature |
| `speseVendemmiaAnno` | number | Spese vendemmia anno (€) | Somma costi vendemmie |
| `speseCantinaAnno` | number | Spese cantina anno (€) | Inserimento manuale (se produce vino) |
| `speseMacchineAnno` | number | Spese macchine anno (€) | Calcolo ore macchine × costo/ora |
| `speseAltroAnno` | number | Altre spese anno (€) | Inserimento manuale |
| `costoTotaleAnno` | number | Costo totale anno (€) | **Calcolato**: somma tutte le spese |
| `costoPerEttaro` | number | Costo per ettaro (€/ha) | **Calcolato**: costoTotaleAnno / superficieEttari |
| `ricavoAnno` | number | Ricavo totale anno (€) | Inserimento manuale o calcolato |
| `margineAnno` | number | Margine anno (€) | **Calcolato**: ricavoAnno - costoTotaleAnno |
| `marginePerEttaro` | number | Margine per ettaro (€/ha) | **Calcolato**: margineAnno / superficieEttari |
| `roiAnno` | number | ROI anno (%) | **Calcolato**: (margineAnno / costoTotaleAnno) × 100 |

#### 1.5. Campi Tracciamento (Aggiornati Automaticamente)

| Campo | Tipo | Descrizione | Aggiornato da |
|-------|------|-------------|---------------|
| `dataUltimaPotatura` | Date | Data ultima potatura | Ultima potatura inserita |
| `dataUltimoTrattamento` | Date | Data ultimo trattamento | Ultimo trattamento inserito |
| `dataUltimaVendemmia` | Date | Data ultima vendemmia | Ultima vendemmia inserita |
| `statoImpianto` | string | Stato impianto | "attivo", "in_riposo", "da_rimuovere" |

---

### 2. Gestione Vendemmia

#### 2.1. Pianificazione Vendemmia

**Obiettivo**: Pianificare la vendemmia per ottimizzare tempi, risorse e qualità.

**Funzionalità**:
- **Calendario Vendemmia**: Visualizzazione vendemmie pianificate per periodo
- **Priorità Vendemmia**: Ordine raccolta per varietà (basato su maturazione)
- **Stima Quantità**: Quantità prevista (quintali/ettaro) per varietà
- **Assegnazione Risorse**: Operai e macchine necessarie
- **Alert Maturazione**: Notifiche quando uva raggiunge maturazione ottimale

**Dati Pianificazione**:
```javascript
{
  vignetoId: "vigneto-123",
  varieta: "Sangiovese",
  dataPrevista: Timestamp,           // Data prevista vendemmia
  priorita: number,                   // 1 = massima priorità
  quantitaPrevistaQli: number,        // Quantità prevista (qli, 2 decimali)
  quantitaPrevistaEttari: number,     // Superficie da vendemmiare (ha)
  destinazione: "vino" | "vendita_uva",
  operaiAssegnati: [string],          // Array ID operai
  macchineAssegnate: [string],        // Array ID macchine
  note: string
}
```

#### 2.2. Registrazione Vendemmia

**Obiettivo**: Registrare ogni operazione di vendemmia con dati completi.

**Campi Vendemmia**:

| Campo | Tipo | Obbligatorio | Descrizione | Esempio |
|-------|------|--------------|-------------|---------|
| `vignetoId` | string | ✅ Sì | Riferimento vigneto | "vigneto-123" |
| `data` | Timestamp | ✅ Sì | Data raccolta | 2025-09-15 |
| `varieta` | string | ✅ Sì | Varietà uva raccolta | "Sangiovese" |
| `quantitaQli` | number | ✅ Sì | Quantità raccolta (qli, 2 decimali) | 200.75 |
| `quantitaEttari` | number | ✅ Sì | Superficie vendemmiata (ha) | 3.0 |
| `resaQliHa` | number | ✅ Sì | Resa (quintali/ettaro) - calcolato | 66.92 |
| `tipoPalo` | string | ✅ Sì | Tipo di palo (ereditato da vigneto) | "cemento", "ferro", "legno", "plastica", "fibra_vetro" |
| `gradazione` | number | ⚠️ Opzionale | Gradazione zuccherina (°Brix) | 13.5 |
| `acidita` | number | ⚠️ Opzionale | Acidità (g/L) | 5.2 |
| `ph` | number | ⚠️ Opzionale | pH | 3.4 |
| `destinazione` | string | ✅ Sì | Destinazione uva | "vino", "vendita_uva" |
| `operai` | array | ✅ Sì | Array ID operai coinvolti | ["user-1", "user-2"] |
| `macchine` | array | ⚠️ Opzionale | Array ID macchine utilizzate | ["macchina-1"] |
| `oreImpiegate` | number | ⚠️ Opzionale | Ore totali impiegate | 40.0 |
| `costoManodopera` | number | ⚠️ Opzionale | Costo manodopera (€) - calcolato | 800.0 |
| `costoMacchine` | number | ⚠️ Opzionale | Costo macchine (€) - calcolato | 200.0 |
| `costoTotale` | number | ⚠️ Opzionale | Costo totale (€) - calcolato | 1000.0 |
| `parcella` | string | ⚠️ Opzionale | Parcella/blocco vendemmiato | "Parcella A" |
| `note` | string | ❌ No | Note | "Vendemmia manuale, qualità ottima" |

**Calcoli Automatici**:
- `resaQliHa` = `quantitaQli` / `quantitaEttari` (resa in quintali/ettaro, 2 decimali)
- `tipoPalo` = ereditato automaticamente da `vigneto.tipoPalo` (può essere sovrascritto se necessario)
- `costoManodopera` = somma compensi operai (da tariffe vendemmia)
- `costoMacchine` = ore macchine × costo/ora
- `costoTotale` = `costoManodopera` + `costoMacchine`

**Note**:
- La quantità raccolta è espressa in **quintali** (qli) con **2 decimali di precisione** (es. 200.75 qli)
- La resa è espressa in **quintali per ettaro** (qli/ha) con 2 decimali (es. 66.92 qli/ha)
- Il campo `tipoPalo` viene ereditato automaticamente dall'anagrafica vigneto ma può essere modificato nella vendemmia se necessario

#### 2.3. Calcolo Compensi Vendemmia ✅ **IMPLEMENTATO**

**Stato**: ✅ **COMPLETATO** - Funzione presente e funzionante (verificato nel codice 2026-01-18)

**Obiettivo**: Calcolare automaticamente i compensi degli operai per la vendemmia.

**Metodi di Calcolo**:

1. **Tariffa per quintale raccolto**:
   - Tariffa configurabile per varietà (es. €15.00/qli per Sangiovese, €18.00/qli per Chardonnay)
   - Calcolo: `compenso = quantitaQli × tariffaPerQli`
   - Distribuzione: compenso diviso tra operai coinvolti

2. **Tariffa per ora**:
   - Tariffa oraria standard (es. €20/ora)
   - Calcolo: `compenso = oreImpiegate × tariffaOraria × numeroOperai`
   - Distribuzione: compenso diviso tra operai coinvolti

3. **Tariffa mista** (futuro):
   - Combinazione tariffa/qli + tariffa/ora
   - Utile per incentivare produttività

**Implementazione**:
- ✅ Funzione `calcolaCompensiVendemmia(vendemmia)` presente in `vendemmia-service.js` (linee 636-726)
- ✅ Chiamata automaticamente in `createVendemmia()` e `updateVendemmia()`
- ✅ Se vendemmia collegata a lavoro: calcola dalle ore validate del lavoro (`oreOperai` con stato 'validate')
- ✅ Se vendemmia standalone con modulo manodopera: calcola da `oreImpiegate` e tariffe operai
- ✅ Se vendemmia standalone senza modulo manodopera: lascia costo a 0 (operai non nel sistema)
- ✅ Usa tariffe personalizzate o tipo operaio per calcolo

**Metodi di Calcolo Implementati**:
1. ✅ Tariffa per ora (tariffa oraria standard) - **IMPLEMENTATO**
2. ⚠️ Tariffa per quintale raccolto (configurabile per varietà) - **NON IMPLEMENTATO** (funzionalità avanzata)
3. ⚠️ Tariffa mista (futuro) - **NON IMPLEMENTATO**

**Integrazione con Sistema Manodopera**:
- I compensi vendemmia vengono registrati automaticamente come attività nel diario
- Collegamento con sistema ore e compensi esistente
- Report vendemmia include dettaglio compensi per operaio

**Configurazione Tariffe**:
- Tariffe configurabili per tenant
- Possibilità di tariffe diverse per varietà (non ancora implementato)
- Possibilità di tariffe stagionali (es. vendemmia anticipata = tariffa maggiore) (non ancora implementato)

---

### 3. Gestione Potatura

**Nota Architetturale**: I modelli e servizi `PotaturaVigneto.js` e `potatura-vigneto-service.js` sono implementati. **Pagine standalone e card dashboard** (2026-01-31): `potatura-standalone.html` – filtro vigneto/anno, tabella potature, modal CRUD (tipo invernale/verde/rinnovo/spollonatura, ceppi potati, operai, ore, costi); card “Potatura” nella dashboard vigneto. Evoluzione **“Potatura da lavori/attività”** (dati base da Gestione lavori/Diario, dati aggiuntivi compilabili, base in sola lettura) pianificata in `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`.

#### 3.1. Tipi Potatura

**Tipi supportati**:

1. **Potatura Invernale** (dicembre-marzo)
   - Potatura principale per formazione struttura
   - Rimozione tralci vecchi
   - Formazione capo a frutto e sperone

2. **Potatura Verde** (estiva, maggio-luglio)
   - Spollonatura (rimozione germogli inutili)
   - Cimatura (taglio apici vegetativi)
   - Diradamento foglie (per aereazione)

3. **Potatura di Rinnovo**
   - Sostituzione capo a frutto invecchiato
   - Rinnovo struttura impianto

4. **Spollonatura**
   - Rimozione germogli basali
   - Pulizia ceppo

#### 3.2. Registrazione Potatura

**Campi Potatura**:

| Campo | Tipo | Obbligatorio | Descrizione | Esempio |
|-------|------|--------------|-------------|---------|
| `vignetoId` | string | ✅ Sì | Riferimento vigneto | "vigneto-123" |
| `data` | Timestamp | ✅ Sì | Data potatura | 2025-01-15 |
| `tipo` | string | ✅ Sì | Tipo potatura | "invernale", "verde", "rinnovo", "spollonatura" |
| `parcella` | string | ⚠️ Opzionale | Parcella/blocco potato | "Parcella A" |
| `ceppiPotati` | number | ✅ Sì | Numero ceppi potati | 500 |
| `operai` | array | ✅ Sì | Array ID operai coinvolti | ["user-1"] |
| `oreImpiegate` | number | ✅ Sì | Ore totali impiegate | 8.5 |
| `costoManodopera` | number | ⚠️ Opzionale | Costo manodopera (€) - calcolato | 170.0 |
| `macchinaId` | string | ⚠️ Opzionale | ID macchina utilizzata | "macchina-1" |
| `costoMacchina` | number | ⚠️ Opzionale | Costo macchina (€) - calcolato | 50.0 |
| `costoTotale` | number | ⚠️ Opzionale | Costo totale (€) - calcolato | 220.0 |
| `note` | string | ❌ No | Note | "Potatura Guyot, 2 gemme per ceppo" |

**Calcoli Automatici**:
- `costoManodopera` = `oreImpiegate` × `tariffaOraria` × `numeroOperai`
- `costoMacchina` = `oreMacchina` × `costoOraMacchina` (se macchina utilizzata)
- `costoTotale` = `costoManodopera` + `costoMacchina`

**Aggiornamento Automatico**:
- `vigneto.dataUltimaPotatura` aggiornato automaticamente
- `vigneto.spesePotaturaAnno` aggiornato automaticamente

---

### 4. Gestione Diradamento (Progetti Alta Qualità)

#### 4.1. Obiettivo Diradamento

Il diradamento dei grappoli è una pratica per progetti di alta qualità che riduce il carico produttivo per ceppo, migliorando la qualità dell'uva (maggiore concentrazione zuccherina, migliore struttura, maggiore complessità aromatica).

**Quando eseguire**:
- Dopo l'allegagione (giugno-luglio)
- Prima dell'invaiatura (cambio colore acini)
- Obiettivo: 1-1.5 kg uva per ceppo (per alta qualità)

#### 4.2. Registrazione Diradamento

**Campi Diradamento**:

| Campo | Tipo | Obbligatorio | Descrizione | Esempio |
|-------|------|--------------|-------------|---------|
| `vignetoId` | string | ✅ Sì | Riferimento vigneto | "vigneto-123" |
| `data` | Timestamp | ✅ Sì | Data diradamento | 2025-07-15 |
| `tipo` | string | ✅ Sì | Tipo diradamento | "grappoli" |
| `parcella` | string | ⚠️ Opzionale | Parcella/blocco diradato | "Parcella A" |
| `ceppiDiradati` | number | ✅ Sì | Numero ceppi diradati | 500 |
| `grappoliRimossi` | number | ⚠️ Opzionale | Numero grappoli rimossi (stimato o effettivo) | 2000 |
| `operai` | array | ✅ Sì | Array ID operai coinvolti | ["user-1"] |
| `oreImpiegate` | number | ✅ Sì | Ore totali impiegate | 10.0 |
| `costoManodopera` | number | ⚠️ Opzionale | Costo manodopera (€) - calcolato | 200.0 |
| `obiettivo` | string | ⚠️ Opzionale | Obiettivo diradamento | "riduzione_carico_qualita" |
| `note` | string | ❌ No | Note | "Diradamento per progetto alta qualità, obiettivo 1kg/ceppo" |

**Calcoli Automatici**:
- `costoManodopera` = `oreImpiegate` × `tariffaOraria` × `numeroOperai`
- `grappoliRimossi` può essere stimato (es. 4 grappoli/ceppo) o contato effettivamente

**Impatto su Rese**:
- Il diradamento riduce la produzione totale ma migliora la qualità
- Il sistema può tracciare l'impatto del diradamento sulle rese finali
- Confronto: resa con/senza diradamento per valutare efficacia

---

### 5. Gestione Trattamenti

**Nota Architetturale**: I modelli e servizi `TrattamentoVigneto.js` e `trattamenti-vigneto-service.js` sono implementati. **Pagine standalone e card dashboard** (2026-01-31): `trattamenti-standalone.html` – filtro vigneto/anno, tabella trattamenti, modal CRUD (prodotto, dosaggio, tipo, operatore, superficie, costi, giorni di carenza). **Miglioramenti 2026-02-03**: (1) Alert dosaggio (validazione vs dosaggioMin/dosaggioMax anagrafica; confirm "Salvare comunque?" in salvataggio); (2) Colonna Avvisi in lista (bollino verde se ok, ⚠️ con tooltip se dosaggio fuori range); (3) Pulsante Modifica visibile (btn-secondary come Potatura, .modal .btn-primary); (4) Costi prodotti trattamenti inclusi in `aggregaSpeseVignetoAnno` → Spese totali dashboard. Card “Trattamenti” nella dashboard vigneto. Evoluzione **“Trattamenti da lavori/attività”** (dati base da Gestione lavori/Diario, dati aggiuntivi compilabili, base in sola lettura) pianificata in `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`.

#### 5.1. Piano Trattamenti

**Obiettivo**: Pianificare e tracciare tutti i trattamenti fitosanitari del vigneto.

**Funzionalità**:
- **Calendario Trattamenti**: Visualizzazione trattamenti programmati
- **Intervalli di Sicurezza**: Alert giorni di carenza prima raccolta
- **Prodotti Utilizzati**: Database prodotti con dosaggi e costi
- **Condizioni Meteo**: Tracciamento condizioni al momento trattamento

**Tipi Trattamenti**:
- **Antifungini**: Contro peronospora, oidio, botrite
- **Insetticidi**: Contro tignole, cocciniglie, fillossera
- **Acaricidi**: Contro acari
- **Fertilizzanti Foliari**: Nutrizione fogliare
- **Altri**: Biostimolanti, fitoregolatori, ecc.

#### 5.2. Registrazione Trattamento

**Campi Trattamento**:

| Campo | Tipo | Obbligatorio | Descrizione | Esempio |
|-------|------|--------------|-------------|---------|
| `vignetoId` | string | ✅ Sì | Riferimento vigneto | "vigneto-123" |
| `data` | Timestamp | ✅ Sì | Data trattamento | 2025-05-20 |
| `prodotto` | string | ✅ Sì | Nome prodotto | "Rame", "Zolfo" |
| `dosaggio` | string | ✅ Sì | Dosaggio applicato | "2 kg/ha", "500 g/ha" |
| `tipoTrattamento` | string | ✅ Sì | Tipo trattamento | "antifungino", "insetticida", "fertilizzante" |
| `condizioniMeteo` | string | ⚠️ Opzionale | Condizioni meteo | "sereno", "nuvoloso", "pioggia" |
| `temperatura` | number | ⚠️ Opzionale | Temperatura (°C) | 18 |
| `umidita` | number | ⚠️ Opzionale | Umidità relativa (%) | 65 |
| `velocitaVento` | number | ⚠️ Opzionale | Velocità vento (km/h) | 5 |
| `operatore` | string | ✅ Sì | ID operatore che ha eseguito | "user-1" |
| `macchinaId` | string | ⚠️ Opzionale | ID macchina utilizzata | "macchina-1" |
| `superficieTrattata` | number | ✅ Sì | Superficie trattata (ha) | 3.0 |
| `costoProdotto` | number | ✅ Sì | Costo prodotto (€) | 150.0 |
| `costoManodopera` | number | ⚠️ Opzionale | Costo manodopera (€) - calcolato | 50.0 |
| `costoMacchina` | number | ⚠️ Opzionale | Costo macchina (€) - calcolato | 30.0 |
| `costoTotale` | number | ⚠️ Opzionale | Costo totale (€) - calcolato | 230.0 |
| `giorniCarenza` | number | ⚠️ Opzionale | Giorni di carenza prodotto | 21 |
| `dataRaccoltaMinima` | Date | ⚠️ Opzionale | Data minima raccolta (calcolata) | 2025-09-10 |
| `parcella` | string | ⚠️ Opzionale | Parcella/blocco trattato | "Parcella A" |
| `note` | string | ❌ No | Note | "Trattamento preventivo peronospora" |

**Calcoli Automatici**:
- `costoManodopera` = `oreImpiegate` × `tariffaOraria`
- `costoMacchina` = `oreMacchina` × `costoOraMacchina` (se macchina utilizzata)
- `costoTotale` = `costoProdotto` + `costoManodopera` + `costoMacchina`
- `dataRaccoltaMinima` = `data` + `giorniCarenza` (se giorniCarenza specificato)

**Validazioni**:
- Alert se trattamento troppo vicino a vendemmia prevista (rispetto giorni carenza)
- Alert se condizioni meteo non ottimali (pioggia, vento forte)
- Alert se temperatura fuori range ottimale prodotto

**Aggiornamento Automatico**:
- `vigneto.dataUltimoTrattamento` aggiornato automaticamente
- `vigneto.speseTrattamentiAnno` aggiornato automaticamente

---

### 6. Rese e Produzione

#### 6.1. Calcolo Rese Automatico

**Rese per Varietà**:
- Calcolo automatico da vendemmie registrate
- Resa media (quintali/ettaro) per varietà (2 decimali)
- Resa anno corrente vs anno precedente
- Trend rese ultimi 5 anni

**Qualità Uva**:
- Tracciamento gradazione zuccherina (°Brix)
- Tracciamento acidità (g/L)
- Tracciamento pH
- Media per varietà/annata
- Confronto qualità tra annate

#### 6.2. Report Produzione

**Report Disponibili**:
1. **Report Vendemmia Annuale**:
   - Totale quintali raccolti per varietà (2 decimali)
   - Resa media per ettaro (in quintali, 2 decimali)
   - Qualità uva (gradazione, acidità, pH)
   - Confronto con anni precedenti

2. **Report Produzione per Varietà**:
   - Produzione totale per varietà (in quintali, 2 decimali)
   - Resa per varietà (in quintali/ettaro, 2 decimali)
   - Qualità per varietà
   - Trend produzione nel tempo

3. **Report Qualità Uva**:
   - Gradazione media per varietà/annata
   - Acidità media per varietà/annata
   - pH medio per varietà/annata
   - Grafici qualità nel tempo

---

### 7. Spese e Costi

#### 7.1. Categorie Spese Vigneto

**Spese Tracciate**:
1. **Manodopera**: Compensi operai (vendemmia, potatura, trattamenti, altro)
2. **Trattamenti**: Costi prodotti fitosanitari
3. **Potatura**: Costi potatura (manodopera + eventuali macchine)
4. **Vendemmia**: Costi vendemmia (manodopera + macchine)
5. **Cantina**: Costi cantina (se produce vino) - inserimento manuale
6. **Macchine**: Costi utilizzo macchine (calcolati da ore × costo/ora)
7. **Altro**: Altre spese (materiali, supporti, fili, ecc.)

#### 7.2. Calcolo Costi Automatico

**Costi Aggregati**:
- `costoTotaleAnno` = somma tutte le categorie spese
- `costoPerEttaro` = `costoTotaleAnno` / `superficieEttari`
- `margineAnno` = `ricavoAnno` - `costoTotaleAnno`
- `marginePerEttaro` = `margineAnno` / `superficieEttari`
- `roiAnno` = (`margineAnno` / `costoTotaleAnno`) × 100

**Aggiornamento Automatico**:
- Tutte le spese vengono aggregate automaticamente
- I costi vengono ricalcolati ogni volta che viene inserita una nuova spesa
- I report mostrano breakdown dettagliato per categoria

**Calcolo Spese Macchine**:
- ✅ Include sia trattore (`macchinaId`) che attrezzo (`attrezzoId`) quando entrambi presenti nella stessa attività
- ✅ Calcolo: `costoMacchine = (oreMacchina × costoOraTrattore) + (oreMacchina × costoOraAttrezzo)`
- ✅ Coerenza tra calcolo aggregato (`aggregaSpeseVignetoAnno`) e dettaglio (`getDettaglioSpeseVignetoAnno`)
- ✅ UI dettaglio mostra breakdown costi macchine per ogni attività diretta

#### 7.3. Report Costi

**Report Disponibili**:
1. **Report Costi Annuale**:
   - Breakdown spese per categoria
   - Costo totale anno
   - Costo per ettaro
   - Confronto con anni precedenti

2. **Report Costi per Operazione**:
   - Costi vendemmia
   - Costi potatura
   - Costi trattamenti
   - Costi altro

3. **Report Margini e ROI**:
   - Margine anno
   - Margine per ettaro
   - ROI anno
   - Confronto margini tra annate

---

### 8. Pianificazione Nuovi Impianti ✅ **IMPLEMENTATO (2026-01-21 → 2026-01-22)**

#### 8.1. Funzionalità Reticolato ✅ **COMPLETATO**

**Obiettivo**: Pianificare nuovi impianti con calcolo automatico di file, ceppi, pali, fili, materiali.

**Caratteristiche Implementate**:
- ✅ Reticolato sovrapponibile sulla mappa terreno
- ✅ Rotazione reticolato (angolo filari) con controlli interattivi:
  - Slider per rotazione precisa
  - Pulsanti incremento/decremento 1°
  - Preset direzioni (N, NE, E, SE, S, SW, W, NW)
  - Bussola visiva con rotazione in tempo reale
- ✅ **UI Ottimizzata** (2026-01-22):
  - **Ordine controlli logico**: Rotazione → Carraie → Sesto di impianto → Calcoli → Salvataggio
  - **Titolo sezione "Sesto di impianto"** per consistenza UI
- ✅ Configurazione sesto di impianto (distanze file e ceppi)
- ✅ Gestione carraie avanzata (strade di servizio):
  - Creazione poligoni per ogni segmento del perimetro terreno
  - **Classificazione automatica** carraie (principali/laterali) basata su orientamento rispetto ai filari
  - **Pulsanti selezione rapida**: Principali (6m), Laterali (4m), Configurazione Tipica
  - Visualizzazione etichette (A, B, C, D, ecc.) su ogni segmento (solo lettere, senza "Carraia")
  - Selezione multipla segmenti per raggruppare in carraie
  - Larghezza configurabile per ogni carraia individualmente con aggiornamento automatico classificazione
  - **Verifica punto interno/esterno** per garantire carraie sempre all'interno del perimetro (2026-01-22)
  - Esclusione automatica filari che intersecano carraie
  - Supporto per poligoni complessi (nessun limite numero segmenti)
- ✅ Calcolo automatico materiali necessari

**Calcoli Automatici Implementati**:
- ✅ Numero file
- ✅ Numero totale ceppi (esclusa superficie carraie)
- ✅ Numero pali necessari
- ✅ Lunghezza fili necessari (portanti + legatura)
- ✅ Superficie carraie
- ✅ Superficie netta impianto
- ✅ Densità effettiva

**Salvataggio Pianificazioni**:
- ✅ Salvataggio in Firestore (`pianificazioni-impianti` collection)
- ✅ Salvataggio tutti i parametri (distanze, larghezze carraie, angolo rotazione)
- ✅ Supporto retrocompatibilità (larghezze A, B, C, D) + nuovo formato (tutte le larghezze)
- ✅ Servizio migliorato con gestione errore indice Firestore (fallback automatico)

**Integrazione**:
- ⏳ Quando pianificazione viene "confermata", crea automaticamente anagrafica vigneto (pianificato)
- ✅ Dati pianificazione salvati per riferimento futuro
- ⏳ Possibilità di confrontare pianificato vs reale dopo impianto (pianificato)

**Miglioramenti Tecnici (2026-01-22)**:
- ✅ **Fix offset carraie robusto**: Verifica punto interno/esterno invece di sistema orario/antiorario
- ✅ Funziona per qualsiasi forma di terreno, anche molto complessa
- ✅ Sistema automatico e trasparente per l'utente

**Note**:
- La sezione UI per visualizzare/caricare pianificazioni salvate è stata rimossa dal pannello controllo (2026-01-21) per essere reimplementata in una card dedicata nel sottomenù "PIANIFICA VIGNETO"
- Il servizio gestisce automaticamente l'errore di indice Firestore mancante con fallback a ordinamento in memoria

#### 8.2. Calcolo Materiali Impianto ✅ **IMPLEMENTATO (2026-01-23)**

**Obiettivo**: Calcolare automaticamente i materiali necessari (pali, fili, tutori, braccetti, ancore, ecc.) basandosi sulle pianificazioni salvate e sul tipo di impianto selezionato.

**Funzionalità Implementate**:
- ✅ **Pagina Calcolo Materiali** (`calcolo-materiali-standalone.html`):
  - Lista pianificazioni salvate con indicazione dati completi/incompleti
  - Selezione pianificazione per calcolare materiali
  - Form configurazione con:
    - Tipo Impianto (dropdown con 17 tipi)
    - Distanza tra Pali, Altezza Pali
    - Numero Fili di Portata e Diametro (con precompilazione)
    - Numero Fili di Vegetazione e Diametro (con precompilazione)
    - Usa Braccetti (con precompilazione)
    - Usa Ancore (con precompilazione)
    - Fissaggio Tutori (legacci o gancetti)
  - Precompilazione automatica di tutti i valori in base al tipo impianto
  - Calcolo e visualizzazione materiali in tabella
  - Riepilogo dettagliato pianificazione e configurazione

- ✅ **Servizio Calcolo Materiali** (`calcolo-materiali-service.js`):
  - **17 tipi di impianto** con configurazioni predefinite:
    - Sistemi a Spalliera (11 tipi): Guyot, Cordone Speronato, Cordone Libero, Cordone Doppio, Spalliera, Spalliera Doppia, Sylvoz, Casarsa, Doppio Capovolto, Raggiera, Scott Henry
    - Sistemi Sopraelevati (4 tipi): Pergola, Tendone, GDC (Geneva Double Curtain), Lyre
    - Sistemi Tradizionali (2 tipi): Alberello, Vite Maritata
  - **Calcolo materiali completo**:
    - Pali (testata, intermedi, totali)
    - Fili di Portata (con diametro specifico, 4-5mm)
    - Fili di Vegetazione (con diametro specifico, 2-2.5mm, solo se presenti)
    - Braccetti (2 per palo, solo sistemi sopraelevati)
    - Tutori (1 per unità, sempre presenti)
    - Ancore (solo per pali testata, se necessari)
    - Legacci per Tutori (1 per tutore, se scelto "legacci")
    - Gancetti per Tutori (1 per tutore, se scelto "gancetti")
    - Ganci per Braccetti (2 per palo, se presenti braccetti)
  - Formattazione per tabella con unità di misura

**Correzioni Terminologia**:
- ✅ **Tutori vs Braccetti**: Distinzione corretta:
  - **Tutori** = sostegno per pianta (1 per unità) - per far crescere eretta la pianta
  - **Braccetti** = sostegni strutturali per pali (2 per palo) - per sistemi sopraelevati
- ✅ **Fili di Portata vs Fili di Vegetazione**: Distinzione con diametri diversi:
  - **Fili di Portata**: sostegno principale (diametro maggiore, 4-5mm)
  - **Fili di Vegetazione**: contenimento chioma (diametro minore, 2-2.5mm)
- ✅ **Fissaggio Tutori**: Scelta tra legacci o gancetti (mutualmente esclusivi)

**Gestione Pianificazioni Incomplete**:
- ✅ Verifica dati completi (numeroFile > 0, numeroUnitaTotale > 0, superficieNettaImpianto > 0)
- ✅ Icona warning (⚠️) nella tabella per pianificazioni incomplete
- ✅ Pulsante disabilitato ("Dati Incompleti") per pianificazioni incomplete
- ✅ Avviso utente quando si seleziona pianificazione incompleta
- ✅ Controllo nel calcolo per prevenire errori

**Fix Implementati**:
- ✅ **Salvataggio Calcoli Pianificazione**: Corretto `onSalvaPianificazione()` per includere tutti i calcoli (numeroFile, numeroUnitaTotale, superficieNettaImpianto, ecc.)
- ✅ **Navigazione Pagina Pianificazione**: Corretto pulsante "Dashboard" per reindirizzare a `vigneto-dashboard-standalone.html`, rimosso pulsante "Vigneti"
- ✅ **Pulizia Log Debug**: Rimossi log di debug eccessivi

**File Creati**:
- ✅ `modules/vigneto/views/calcolo-materiali-standalone.html` - Pagina calcolo materiali
- ✅ `modules/vigneto/services/calcolo-materiali-service.js` - Servizio calcolo materiali

**File Modificati**:
- ✅ `modules/vigneto/views/pianifica-impianto-standalone.html` - Fix navigazione e salvataggio calcoli
- ✅ `modules/vigneto/services/pianificazione-impianto-service.js` - Pulizia log

**Note**:
- I materiali vengono calcolati in base ai dati della pianificazione salvata (lunghezza filari, numero file, numero unità)
- La precompilazione automatica può essere sovrascritta manualmente
- I calcoli sono basati su standard viticoli reali per ogni tipo di impianto

#### 8.3. Stima Costi Impianto

**Funzionalità** (da implementare in fase avanzata):
- Database prezzi materiali configurabile
- Calcolo automatico costi materiali (pali, fili, piante, supporti, legacci)
- Stima costi manodopera impianto
- Costo totale impianto
- Preventivo completo per nuovo impianto

---

## 🖥️ Interfacce Utente

### 1. Pagina Anagrafica Vigneti ✅ COMPLETATO 2026-01-13

**Percorso**: `modules/vigneto/views/vigneti-standalone.html`

**Funzionalità Implementate**:
- ✅ Lista tutti i vigneti del tenant
- ✅ Filtri: per terreno, per varietà, per stato
- ✅ Creazione nuovo vigneto
- ✅ Modifica anagrafica esistente
- ✅ Visualizzazione dettaglio vigneto
- ✅ **Calcolo automatico densità** da distanza file × distanza ceppi
- ✅ **Precompilazione tipo impianto** automatica (Tradizionale/Intensivo/Superintensivo)
- ✅ **Caricamento superficie** automatico dal terreno selezionato
- ✅ **Dropdown completi** con liste predefinite (50+ varietà, 20+ portainnesti, 20+ forme, 14+ tipi palo, 12 orientamenti)
- ✅ **Pulsante "+"** per aggiungere valori personalizzati
- ✅ **Sistema retrocompatibile**: banner informativo per terreni con "Vite" esistenti

**Sezioni**:
1. **Dati Base**: Form anagrafica (campi comuni + specifici vigneto)
2. **Rese e Produzione**: Tabella rese, grafici trend
3. **Spese e Costi**: Breakdown spese, grafici costi
4. **Operazioni Recenti**: Ultime vendemmie, potature, trattamenti
5. **Link Azioni**: "Nuova Vendemmia", "Nuova Potatura", "Nuovo Trattamento", "Pianifica Impianto"

**Integrazione**:
- Dropdown terreno: filtra solo terreni con coltura "Vite"
- Se terreno selezionato ha già anagrafica vigneto → mostra warning
- Link a pagina terreno per visualizzare mappa

### 2. Pagina Gestione Vendemmia ✅ COMPLETATO 2026-01-13

**Percorso**: `modules/vigneto/views/vendemmia-standalone.html`

**Funzionalità Implementate**:
- ✅ Lista tutte le vendemmie (filtrabile per anno, varietà, vigneto)
- ✅ Creazione nuova vendemmia
- ✅ Modifica vendemmia esistente
- ✅ Visualizzazione dettaglio vendemmia
- ✅ Calcolo automatico resa qli/ha
- ✅ Integrazione con operai e macchine
- ✅ Aggiornamento automatico dati vigneto (produzione, resa media, spese)
- ✅ Calcolo automatico compensi ✅ **IMPLEMENTATO** (funzione `calcolaCompensiVendemmia` presente e funzionante)

**Sezioni**:
1. **Lista Vendemmie**: Tabella con filtri (anno, varietà, vigneto)
2. **Form Vendemmia**: Inserimento dati vendemmia
3. **Calcolo Compensi**: Visualizzazione compensi operai (automatico)
4. **Grafici**: Produzione nel tempo, rese per varietà

**Workflow**:
1. Utente seleziona vigneto
2. Compila dati vendemmia (data, quantità, qualità, operai, macchine)
3. Sistema calcola automaticamente: resa, costi, compensi
4. Salvataggio → aggiornamento automatico anagrafica vigneto

### 3. Pagina Gestione Potatura ✅ **IMPLEMENTATA (2026-01-31)**

- Vista `potatura-standalone.html`: filtro vigneto/anno, tabella potature, modal Nuova/Modifica. Card “Potatura” in dashboard vigneto.
- Evoluzione “da lavori/attività” pianificata in `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`.

### 4. Pagina Gestione Trattamenti ✅ **IMPLEMENTATA (2026-01-31)**

- Vista `trattamenti-standalone.html`: filtro vigneto/anno, tabella trattamenti, modal Nuova/Modifica. Card “Trattamenti” in dashboard vigneto.
- Evoluzione “da lavori/attività” pianificata in `PIANO_POTATURA_TRATTAMENTI_DA_LAVORI.md`.

### 5. Pagina Pianificazione Impianto ✅ **IMPLEMENTATO (2026-01-21 → 2026-01-22)**

**Percorso**: `modules/vigneto/views/pianifica-impianto-standalone.html`

**Funzionalità Implementate**:
- ✅ Selezione terreno mappato
- ✅ Visualizzazione mappa con reticolato sovrapposto
- ✅ Configurazione parametri reticolato (distanze, angolo rotazione)
- ✅ Gestione carraie avanzata:
  - Classificazione automatica (principali/laterali)
  - Pulsanti selezione rapida (Principali 6m, Laterali 4m, Configurazione Tipica)
  - Selezione multipla segmenti, larghezze configurabili
  - Verifica punto interno/esterno per offset corretto (2026-01-22)
- ✅ **UI Ottimizzata** (2026-01-22):
  - Ordine controlli logico: Rotazione → Carraie → Sesto → Calcoli → Salvataggio
  - Titolo sezione "Sesto di impianto" per consistenza
  - Etichette marker semplificate (solo lettere A, B, C, ecc.)
- ✅ **Fix Navigazione** (2026-01-23):
  - Pulsante "Dashboard" reindirizza a `vigneto-dashboard-standalone.html`
  - Rimosso pulsante "Vigneti"
- ✅ Calcolo automatico materiali
- ✅ **Salvataggio Calcoli Completi** (2026-01-23):
  - Tutti i calcoli (numeroFile, numeroUnitaTotale, superficieNettaImpianto, ecc.) vengono salvati correttamente
- ✅ Salvataggio pianificazione in Firestore

**Sezioni Implementate**:
1. ✅ **Mappa Interattiva**: Terreno + reticolato + carraie con etichette
2. ✅ **Pannello Controllo**: Parametri reticolato (distanze, angolo, carraie)
3. ✅ **Calcoli Automatici**: File, ceppi, pali, fili, superficie (aggiornati in tempo reale)
4. ⏳ **Stima Costi** (fase avanzata): Costi materiali, costo totale impianto (pianificato)
5. ✅ **Azioni**: Salva (implementato)
   - ⏳ Esporta PDF/Excel (pianificato)
   - ⏳ Conferma (crea anagrafica) (pianificato)

**Funzionalità Pianificate (Non Implementate)**:
- ⏳ Card dedicata nel sottomenù "PIANIFICA VIGNETO" per gestione pianificazioni salvate (visualizzazione/caricamento/eliminazione)
- ⏳ Template sesti di impianto predefiniti

### 6. Pagina Calcolo Materiali ✅ **IMPLEMENTATO (2026-01-23)**

**Percorso**: `modules/vigneto/views/calcolo-materiali-standalone.html`

**Funzionalità Implementate**:
- ✅ Lista pianificazioni salvate con indicazione dati completi/incompleti
- ✅ Selezione pianificazione per calcolare materiali
- ✅ Form configurazione con 17 tipi di impianto
- ✅ Precompilazione automatica valori in base al tipo impianto
- ✅ Calcolo e visualizzazione materiali in tabella
- ✅ Riepilogo dettagliato pianificazione e configurazione
- ✅ Gestione pianificazioni incomplete (warning, disabilitazione calcolo)

**Dettagli**: Vedi sezione "8.2. Calcolo Materiali Impianto" sopra.

---

## 🔗 Integrazioni con Sistema Esistente

### 1. Integrazione con Lavori Impianto ✅ **IMPLEMENTATO (2026-01-24)**

**Obiettivo**: Creare automaticamente vigneti quando si crea un lavoro di tipo "Impianto Nuovo Vigneto" con una pianificazione confermata.

**Funzionalità Implementate**:
- ✅ **Tipi Lavoro Predefiniti**:
  - "Impianto Nuovo Vigneto" - Sottocategoria `semina_piantagione_impianto`
  - "Impianto Nuovo Frutteto" - Sottocategoria `semina_piantagione_impianto`
  - "Impianto Nuovo Oliveto" - Sottocategoria `semina_piantagione_impianto`

- ✅ **Form Vigneto Integrato**:
  - Dropdown pianificazioni confermate (filtro per tipo coltura)
  - Pre-compilazione automatica da pianificazione:
    - Distanze (file, unità) - readonly
    - Superficie (Ha) - formattata 2 decimali, readonly
    - Densità (ceppi/ha) - formattata intero, readonly
    - Forma allevamento - selezionata dalla pianificazione
  - Campi compilabili:
    - Varietà Uva (dropdown) - stesse liste anagrafica vigneti
    - Anno Impianto (number)
    - Portainnesto (dropdown) - stesse liste anagrafica vigneti
    - Tipo Palo (dropdown)
    - Destinazione Uva (dropdown)
    - Note (textarea)

- ✅ **Creazione Automatica Vigneto**:
  - Quando si salva lavoro "Impianto Nuovo Vigneto" con pianificazione:
    - Crea vigneto con dati dalla pianificazione + form
    - Collegamento `Lavoro.pianificazioneId` → `PianificazioneImpianto.id`
    - Gestione errori non bloccante (alert warning)

- ✅ **Modello Lavoro Esteso**:
  - Campo `pianificazioneId` (string | null) per collegamento

**File Modificati**:
- `core/services/categorie-service.js` - Sottocategoria "Impianto"
- `core/services/tipi-lavoro-service.js` - Tipi lavoro predefiniti
- `core/admin/gestione-lavori-standalone.html` - Form vigneto integrato
- `core/admin/js/gestione-lavori-events.js` - Creazione automatica vigneto
- `core/models/Lavoro.js` - Campo `pianificazioneId`

**Flusso Completo**:
1. Manager crea pianificazione → stato "BOZZA"
2. Manager conferma pianificazione → stato "CONFERMATO"
3. Manager crea lavoro → tipo "Impianto Nuovo Vigneto"
4. Sistema mostra dropdown → seleziona pianificazione confermata
5. Sistema pre-compila form vigneto → dati dalla pianificazione
6. Manager completa campi → varietà, anno, tipo palo, destinazione
7. Manager salva lavoro → sistema crea lavoro + vigneto automaticamente

---

### 2. Integrazione con Terreni

**Comportamento**:
- Filtraggio automatico terreni con coltura "Vite"
- Link bidirezionale: vigneto → terreno, terreno → vigneto
- Pagina terreni mostra pulsante "Gestisci Vigneto" se modulo attivo

**Flusso**:
1. Utente visualizza terreno con coltura "Vite"
2. Se modulo vigneto attivo → mostra pulsante "Gestisci Vigneto"
3. Cliccando → apre pagina anagrafica vigneto (o crea nuova se non esiste)
4. Anagrafica vigneto referenzia terreno (non duplica dati)

### 2. Integrazione con Sistema Lavori/Diario - Vendemmia Automatica (NUOVO APPROCCIO - 2026-01-16)

**Vedi sezione dettagliata "🔄 Integrazione Vendemmia-Lavori: Rilevamento Automatico" più in basso per i dettagli completi.**

**Principio Fondamentale**: 
- Tutte le operazioni vengono registrate nel sistema Lavori/Diario (fonte unica di verità)
- Il modulo Vigneto aggrega e calcola le spese automaticamente dai lavori registrati
- Qualsiasi tipo di lavoro viene conteggiato automaticamente (non solo potatura/trattamenti)
- **Vendemmia**: Rilevamento automatico da lavori con tipo "Vendemmia Manuale/Meccanica" su terreno VITE

### 3. Integrazione con Manodopera

**Comportamento**:
- Compensi vendemmia registrati automaticamente come attività nel diario
- Collegamento con sistema ore e compensi esistente
- Report vendemmia include dettaglio compensi per operaio

**Flusso**:
1. Utente registra vendemmia con operai coinvolti
2. Sistema calcola compensi automaticamente (da tariffe vendemmia)
3. Compensi registrati come attività nel diario operai
4. Report vendemmia mostra dettaglio compensi per operaio

### 4. Integrazione con Parco Macchine

**Comportamento**:
- Macchine utilizzate in vendemmia/potatura/trattamenti tracciate
- Calcolo costi macchine automatico (ore × costo/ora)
- Report utilizzo macchine per vigneto

**Flusso**:
1. Utente registra vendemmia/potatura/trattamento con macchina
2. Sistema calcola costo macchina automaticamente
3. Costo macchina incluso nel costo totale operazione
4. Report mostra utilizzo macchine per vigneto

### 5. Integrazione con Statistiche

**Comportamento**:
- Report esistenti si estendono con sezioni specifiche vigneto
- Nuovi report dedicati: "Produzione Vigneto", "Rese Vigneto", "Costi Vigneto"
- Dati aggregati automaticamente

**Flusso**:
1. Utente visualizza pagina statistiche
2. Se modulo vigneto attivo → mostra sezione "Vigneto"
3. Report vigneto include: produzione, rese, costi, qualità uva
4. Grafici e tabelle interattive

### 6. Integrazione con Dashboard

#### 6.1. Card nella Dashboard Principale

**Comportamento**:
- Dashboard mostra sezioni specifiche se modulo attivo E ci sono dati rilevanti
- Card "Vigneto" con link a dashboard dedicata quando il modulo è attivo
- Card "Vendemmia in corso" se ci sono vendemmie attive
- Card "Prossimi Trattamenti" se ci sono trattamenti programmati
- Card "Rese Anno Corrente" con confronto anno precedente

**Flusso**:
1. Utente visualizza dashboard
2. Sistema verifica se modulo vigneto attivo
3. Se attivo → carica dati vigneto (vendemmie, trattamenti, rese)
4. Mostra card/sezioni specifiche se dati disponibili

#### 6.2. Dashboard Standalone Dedicata ✅ **COMPLETATO (2026-01-20 → 2026-01-21)**

**File**: 
- `modules/vigneto/views/vigneto-dashboard-standalone.html` - Dashboard principale
- `modules/vigneto/views/vigneto-statistiche-standalone.html` - Pagina statistiche dedicata

**Obiettivo**: Dashboard dedicata per manager/amministratori con panoramica completa del modulo vigneto, allineata al pattern del modulo Conto Terzi.

**Struttura Implementata**:

1. ✅ **Dashboard Principale** (`vigneto-dashboard-standalone.html`)
   - Header con sfondo viola (`#6A1B9A`), titolo "🍇 VIGNETO", link "← Dashboard Principale"
   - Card statistiche principali (produzione, resa, spese, numero vigneti, vendemmie)
   - Card azioni rapide (Anagrafica Vigneti, Gestione Vendemmia, Statistiche)
   - Sezione vendemmie recenti
   - Sezione lavori vigneto

2. ✅ **Pagina Statistiche Dedicata** (`vigneto-statistiche-standalone.html`)
   - Filtri vigneto/anno con aggiornamento automatico
   - **9 Grafici Chart.js completi**:
     - Produzione temporale (ultimi 3 anni) - Line chart
     - Resa per varietà - Bar chart
     - Produzione mensile - Bar chart
     - Qualità uva - Gradazione (Bar chart)
     - Qualità uva - Acidità (Bar chart)
     - Qualità uva - pH (Bar chart)
     - Costi nel tempo (manodopera, macchine, prodotti, cantina, altro) - Line chart multi-serie
     - Spese per categoria - Doughnut chart
     - Spese mensili - Bar chart
   - Gestione stati vuoti con messaggi informativi
   - Ricreazione automatica canvas se necessario

3. ✅ **Servizio Statistiche** (`vigneto-statistiche-service.js`)
   - `getStatisticheVigneto(vignetoId, anno)`: aggregazione dati produzione, resa, costi
   - `getProduzioneTemporale(vignetoId, anniIndietro)`: dati produzione ultimi N anni (default: 3)
   - `getQualitaUva(vignetoId, anno)`: dati qualità uva per varietà (gradazione, acidità, pH)
   - `getCostiTemporale(vignetoId, anniIndietro)`: dati costi per categoria ultimi N anni (default: 3)
   - `getVendemmieRecenti(vignetoId, anno, limit)`: ultime N vendemmie
   - `getLavoriVigneto(vignetoId, anno)`: lavori collegati a vigneto
   - Ottimizzazione performance con `Promise.all` per caricamento parallelo

**Miglioramenti Implementati (2026-01-21)**:
- ✅ **Fix Grafico Costi nel Tempo**: Logica verifica dati migliorata (controlla tutte le categorie: manodopera, macchine, prodotti, cantina, altro, non solo totale)
- ✅ **Allineamento UI**: Pulsante dashboard allineato agli altri moduli ("← Dashboard" invece di "← Dashboard Vigneto")
- ✅ **Pulizia Codice**: Rimossi tutti i log di debug (~50+ log), codice pulito e pronto per produzione

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
- ✅ Stile viola (`#6A1B9A`) allineato al tema vigneto
- ✅ Mobile-friendly e responsive
- ✅ Ottimizzazione performance (caricamento dati parallelo, riduzione anni da 5 a 3 per ridurre query)

**Permessi**:
- ✅ Solo manager/amministratori (verifica implementata con controllo tenant e moduli)

**Stato**: ✅ **COMPLETATO** - Dashboard e pagina statistiche implementate e funzionanti

---

## 🔐 Permessi e Ruoli

### Permessi per Ruolo

| Ruolo | Anagrafica Vigneto | Vendemmia | Potatura | Trattamenti | Report |
|-------|-------------------|-----------|----------|-------------|--------|
| **Amministratore** | ✅ Lettura/Scrittura | ✅ Lettura/Scrittura | ✅ Lettura/Scrittura | ✅ Lettura/Scrittura | ✅ Lettura |
| **Manager** | ✅ Lettura/Scrittura | ✅ Lettura/Scrittura | ✅ Lettura/Scrittura | ✅ Lettura/Scrittura | ✅ Lettura |
| **Caposquadra** | ⚠️ Solo Lettura | ✅ Lettura/Scrittura | ✅ Lettura/Scrittura | ✅ Lettura/Scrittura | ⚠️ Solo Lettura |
| **Operaio** | ⚠️ Solo Lettura | ⚠️ Solo Lettura | ⚠️ Solo Lettura | ⚠️ Solo Lettura | ❌ Nessun accesso |

**Note**:
- **Anagrafica Vigneto**: Solo Manager/Amministratore possono creare/modificare anagrafica
- **Vendemmia/Potatura/Trattamenti**: Manager e Caposquadra possono inserire dati operativi
- **Report**: Solo Manager/Amministratore possono visualizzare report completi
- **Operai**: Accesso solo lettura per consultare dati operativi

---

## 📊 Report e Statistiche

### Report Disponibili

#### 1. Report Vendemmia Annuale

**Contenuto**:
- Totale quintali raccolti per varietà (2 decimali)
- Resa media per ettaro in quintali (per varietà e totale, 2 decimali)
- Qualità uva (gradazione media, acidità media, pH medio)
- Costi manodopera vendemmia
- Costi macchine vendemmia
- Costo totale vendemmia
- Confronto con anni precedenti

**Visualizzazioni**:
- Tabella dati
- Grafico produzione nel tempo
- Grafico rese per varietà
- Grafico qualità uva (gradazione, acidità, pH)

#### 2. Report Produzione Vigneto

**Contenuto**:
- Produzione totale anno corrente (in quintali, 2 decimali)
- Produzione per varietà (in quintali, 2 decimali)
- Rese per varietà (in quintali/ettaro, 2 decimali)
- Trend produzione ultimi 5 anni
- Confronto annate

**Visualizzazioni**:
- Tabella dati
- Grafico trend produzione
- Grafico produzione per varietà
- Grafico confronto annate

#### 3. Report Trattamenti

**Contenuto**:
- Numero trattamenti per stagione
- Costi prodotti fitosanitari
- Costi manodopera trattamenti
- Costi macchine trattamenti
- Costo totale trattamenti
- Tipi trattamenti eseguiti
- Prodotti utilizzati

**Visualizzazioni**:
- Tabella dati
- Grafico costi trattamenti nel tempo
- Grafico numero trattamenti per tipo
- Calendario trattamenti

#### 4. Report Costi Vigneto

**Contenuto**:
- Breakdown spese per categoria
- Costo totale anno
- Costo per ettaro
- Margine anno
- Margine per ettaro
- ROI anno
- Confronto costi con anni precedenti

**Visualizzazioni**:
- Tabella breakdown spese
- Grafico costi per categoria (torta)
- Grafico costi nel tempo
- Grafico margini nel tempo

#### 5. Report Qualità Uva

**Contenuto**:
- Gradazione media per varietà/annata
- Acidità media per varietà/annata
- pH medio per varietà/annata
- Trend qualità nel tempo
- Confronto qualità tra annate

**Visualizzazioni**:
- Tabella dati
- Grafico gradazione nel tempo
- Grafico acidità nel tempo
- Grafico pH nel tempo
- Grafico confronto qualità annate

---

### ⚠️ Considerazioni Performance Report e Statistiche (2026-01-21)

**Problema Identificato**:
La pagina statistiche vigneto (`vigneto-statistiche-standalone.html`) con 9 grafici Chart.js è già lenta (~2-3 secondi) con pochi dati. Con molti dati (più vigneti, più anni, più vendemmie/lavori) i tempi potrebbero aumentare significativamente (stimati 10-15 secondi).

**Causa Problemi**:
1. Query Firestore multiple per ogni vigneto e anno
2. Aggregazioni lato client (calcoli in JavaScript dopo caricamento dati)
3. Ricreazione completa 9 grafici ad ogni cambio filtro
4. Nessuna cache (ricarica tutto da Firestore ogni volta)

**Soluzione Consigliata**:
- **Priorità Alta**: Implementare aggregazioni pre-calcolate in Firestore (vedi sezione "Fase 3: Ottimizzazioni" per dettagli)
- **Breve Termine**: Cache lato client + debounce filtri + loading progressivo
- **Stima Miglioramento**: Da 10-15 secondi a 1-2 secondi con aggregazioni pre-calcolate

Vedi sezione **"Fase 3: Ottimizzazioni"** per strategie dettagliate.

---

## 🎯 Priorità di Implementazione

### Fase 1: MVP (2-3 settimane) - 🚧 IN CORSO
**Data inizio**: 2026-01-13  
**Stato**: ~60% completato

**Funzionalità Core**:
1. ✅ Anagrafica vigneti (CRUD base) ✅ **COMPLETATO 2026-01-13**
2. ✅ Gestione vendemmia (registrazione + calcolo compensi) ✅ **COMPLETATO 2026-01-13** (calcolo compensi ✅ IMPLEMENTATO - verificato nel codice)
3. ~~Gestione potatura (registrazione base)~~ ❌ **NON NECESSARIA** - Dati già nel sistema Lavori/Diario
4. ~~Gestione trattamenti (registrazione base)~~ ❌ **RIMANDATA** - Modulo Trattamenti dedicato futuro
5. ✅ Calcolo rese automatico (da vendemmie) ✅ **COMPLETATO 2026-01-13**
6. ✅ Calcolo costi automatico (aggregazione spese) ✅ **COMPLETATO 2026-01-13**
7. 🚧 Report base (vendemmia, produzione, costi) - **DA IMPLEMENTARE**

**Obiettivo**: Sistema funzionante per gestione base vigneto  
**Stato attuale**: ~70-75% completato - Anagrafica, Vendemmia, Integrazione Lavori funzionanti

### Fase 2: Funzionalità Avanzate (2 settimane)

**Funzionalità Aggiuntive**:
1. ✅ Diradamento grappoli
2. ✅ Qualità uva dettagliata (gradazione, acidità, pH)
3. ✅ Calendario trattamenti con alert carenza
4. ✅ Report avanzati (qualità, trend, confronti)
5. ✅ Integrazione completa con dashboard
6. ✅ Pianificazione nuovi impianti (reticolato base) - **COMPLETATO (2026-01-21)**

**Obiettivo**: Sistema completo con tutte le funzionalità principali

### Fase 3: Ottimizzazioni e Estensioni (1-2 settimane)

**Miglioramenti**:
1. ⚠️ Pianificazione impianti avanzata (stima costi, template sesti) - ⏳ Card gestione salvate da implementare
2. ⚠️ Report esportabili (PDF/Excel)
3. ⚠️ Notifiche e alert automatici
4. ⚠️ Integrazione mobile (PWA)
5. ⚠️ Performance ottimizzazioni

**Obiettivo**: Sistema ottimizzato e user-friendly

---

## 📝 Note Implementative

### 1. Compatibilità Retroattiva

- **Terreni esistenti**: Continuano a funzionare senza moduli
- **Attivazione modulo**: Non richiede migrazione dati
- **Creazione anagrafica**: Opzionale e guidata (suggerimento se terreni con "Vite" rilevati)

### 2. Performance

- **Sub-collections**: Dati specifici in sub-collections (non sovraccaricano documenti terreni)
- **Indici Firestore**: Indici per query frequenti (vendemmie per data, potature per tipo, ecc.)
- **Cache locale**: Cache dati lettura frequente (anagrafiche vigneti)

### 3. Scalabilità

- **Modulo indipendente**: Può essere sviluppato in parallelo ad altri moduli
- **Pattern riutilizzabile**: Vigneto = template per frutteto/oliveto
- **Estensibile**: Facile aggiungere nuove funzionalità in futuro

### 4. UX

- **Dashboard adattiva**: Mostra solo sezioni rilevanti
- **Filtri automatici**: Terreni/lavori per coltura
- **Guide/Tour**: Tour guidato per nuovo modulo
- **Messaggi informativi**: Quando modulo non attivo, spiega come attivarlo

---

## 🧪 Testing e Validazione

### Test da Eseguire

#### 1. Test Funzionalità Base
- [ ] Creazione anagrafica vigneto
- [ ] Modifica anagrafica vigneto
- [ ] Eliminazione anagrafica vigneto
- [ ] Filtraggio terreni con coltura "Vite"

#### 2. Test Vendemmia
- [ ] Registrazione vendemmia
- [ ] Calcolo compensi automatico
- [ ] Aggiornamento rese automatico
- [ ] Aggiornamento costi automatico

#### 3. Test Potatura
- [ ] Registrazione potatura
- [ ] Calcolo costi potatura
- [ ] Aggiornamento data ultima potatura

#### 4. Test Trattamenti
- [ ] Registrazione trattamento
- [ ] Calcolo costi trattamento
- [ ] Alert giorni di carenza
- [ ] Aggiornamento data ultimo trattamento

#### 5. Test Integrazioni
- [ ] Integrazione con terreni
- [ ] Integrazione con lavori
- [ ] Integrazione con manodopera
- [ ] Integrazione con parco macchine
- [ ] Integrazione con statistiche
- [ ] Integrazione con dashboard

#### 6. Test Permessi
- [ ] Permessi per ruolo (Amministratore, Manager, Caposquadra, Operaio)
- [ ] Verifica accesso negato per operai ai report

#### 7. Test Multi-Tenant
- [ ] Isolamento dati tra tenant
- [ ] Verifica che tenant A non veda dati tenant B

---

## 📚 Riferimenti

### Documenti Correlati
- `PLAN_MODULI_COLTURA_SPECIALIZZATI.md` - Piano generale moduli specializzati
- `core/services/colture-service.js` - Servizio colture esistente
- `core/models/Terreno.js` - Modello terreno esistente
- `modules/conto-terzi/` - Esempio modulo esistente
- `modules/parco-macchine/` - Esempio integrazione modulo

### Servizi da Utilizzare
- `core/services/firebase-service.js` - Servizio Firebase base
- `core/services/tenant-service.js` - Servizio tenant
- `core/services/auth-service.js` - Servizio autenticazione
- `core/services/ore-service.js` - Servizio ore (per compensi)
- `modules/parco-macchine/services/macchine-service.js` - Servizio macchine

---

## ✅ Checklist Implementazione

### Fase 1: MVP
- [x] Creare struttura cartelle `modules/vigneto/` ✅ 2026-01-13
- [x] Creare modelli: `Vigneto.js`, `Vendemmia.js`, `PotaturaVigneto.js`, `TrattamentoVigneto.js` ✅ 2026-01-13
- [x] Creare servizi: `vigneti-service.js`, `vendemmia-service.js`, `potatura-vigneto-service.js`, `trattamenti-vigneto-service.js` ✅ 2026-01-13
- [x] Creare viste: `vigneti-standalone.html`, `vendemmia-standalone.html` ✅ 2026-01-13
- [x] ~~Creare viste: `potatura-vigneto-standalone.html`, `trattamenti-vigneto-standalone.html`~~ ❌ **NON NECESSARIE** - Vedi sezione "Decisioni Architetturali"
- [x] Implementare CRUD anagrafica vigneti ✅ 2026-01-13
- [x] Implementare registrazione vendemmia ✅ 2026-01-13
- [x] Implementare calcolo compensi vendemmia ✅ **IMPLEMENTATO** (verificato nel codice 2026-01-18)
- [ ] Implementare registrazione potatura 🚧
- [ ] Implementare registrazione trattamenti 🚧
- [x] Implementare calcolo rese automatico ✅ 2026-01-13
- [x] Implementare calcolo costi automatico ✅ 2026-01-13
- [ ] Implementare report base 🚧
- [x] Test funzionalità base (anagrafica + vendemmia) ✅ 2026-01-13

### Fase 2: Funzionalità Avanzate
- [ ] Implementare diradamento grappoli
- [ ] Implementare qualità uva (gradazione, acidità, pH)
- [ ] Implementare calendario trattamenti
- [ ] Implementare alert giorni di carenza
- [ ] Implementare report avanzati
- [ ] Implementare integrazione dashboard
- [x] **Dashboard Standalone Dedicata** ✅ **COMPLETATO (2026-01-20 → 2026-01-21)** - Vedi sezione 6.2
- [x] Implementare pianificazione impianti (reticolato base) - **COMPLETATO (2026-01-21)**
- [ ] Test funzionalità avanzate

### Fase 3: Ottimizzazioni
- [ ] Implementare stima costi impianto
- [ ] **Report/Bilancio (PDF/Excel) via modulo unico cross-moduli** (evitare export/pagine duplicate per singolo modulo)
- [ ] Implementare notifiche automatiche
- [ ] Ottimizzare performance
- [ ] Test completo sistema

---

## 📑 Direzione “Report Avanzati” (scelta architetturale)

**Premessa**: nel modulo Vigneto esiste già una pagina “Statistiche” completa (grafici + filtri). Creare anche una pagina “Report” dedicata al solo Vigneto porterebbe duplicazione e UX frammentata (soprattutto per tenant con più moduli).

**Decisione**: i report/esportazioni (PDF/Excel/CSV, riepilogo stampabile, bilancio) verranno gestiti tramite un **modulo unico** `report/bilancio` cross-moduli che:
- si adatta ai moduli attivi del tenant
- riusa i servizi/aggregati già disponibili (es. `vigneto-statistiche-service.js`, aggregazioni spese da lavori)
- espone un’unica UX per report e export in tutta l’app

**Conseguenza**: nel Vigneto restano **Dashboard** + **Statistiche** (analisi interattiva). Per i report, al massimo un link/CTA verso il modulo Report/Bilancio quando attivo.

## 📊 Stato Implementazione

**Data aggiornamento**: 2026-01-22 (Pulizia Completa Log Debug - Modulo Statistiche Vigneto)
**Stato**: ✅ MVP BASE COMPLETATO + Dashboard Standalone Dedicata + Pagina Statistiche con 9 Grafici + Codice Pulito ✅

### ✅ Completato (2026-01-13)

#### 1. Struttura Base
- ✅ Creata struttura cartelle `modules/vigneto/models/`, `modules/vigneto/services/`, `modules/vigneto/views/`
- ✅ Creati modelli: `Vigneto.js`, `Vendemmia.js`, `PotaturaVigneto.js`, `TrattamentoVigneto.js`
- ✅ Creati servizi: `vigneti-service.js`, `vendemmia-service.js`, `potatura-vigneto-service.js`, `trattamenti-vigneto-service.js`
- ✅ Implementate regole Firestore per collection `vigneti` e sub-collections

#### 2. Anagrafica Vigneti (MVP)
- ✅ Creata vista `vigneti-standalone.html` con:
  - Lista vigneti con filtri (terreno, varietà, stato)
  - Form creazione/modifica vigneto
  - Calcolo automatico densità ceppi/ha da distanza file e distanza ceppi
  - Precompilazione automatica tipo impianto in base alla densità:
    - Tradizionale: < 3000 ceppi/ha
    - Intensivo: 3000-6000 ceppi/ha
    - Superintensivo: > 6000 ceppi/ha
  - Caricamento automatico superficie dal terreno selezionato
  - Dropdown con liste predefinite per:
    - Varietà uva (50+ varietà italiane e internazionali)
    - Portainnesti (20+ portainnesti comuni)
    - Forme di allevamento (20+ forme)
    - Tipi di palo (14+ tipi inclusi "Ferro zincato a caldo" e "Ferro zincato a freddo")
    - Orientamento filari (12 opzioni)
  - Pulsante "+" per aggiungere nuovi valori personalizzati (salvati in localStorage)
  - Sistema retrocompatibile: banner informativo quando ci sono terreni con coltura "Vite" ma nessun vigneto
- ✅ CRUD completo anagrafica vigneti
- ✅ Validazione dati con modello `Vigneto.js`
- ✅ Calcolo automatico costi, margini, ROI

#### 3. Gestione Vendemmia (MVP)
- ✅ Creata vista `vendemmia-standalone.html` con:
  - Lista vendemmie con filtri (vigneto, varietà, anno)
  - Form creazione/modifica vendemmia
  - Calcolo automatico resa qli/ha
  - Integrazione con operai e macchine
  - Aggiornamento automatico dati vigneto (produzione totale, resa media, spese vendemmia)
- ✅ CRUD completo vendemmie
- ✅ Calcolo automatico costi vendemmia

#### 4. Integrazione Dashboard
- ✅ Aggiunta card "Vigneto" nella dashboard quando il modulo è attivo
- 📝 **Dashboard Standalone Dedicata** (Pianificata - 2026-01-20)
- ✅ Link rapido nella sezione Core Base
- ✅ Verifica accesso modulo nelle viste (redirect ad abbonamento se non attivo)

#### 5. Attivazione Modulo
- ✅ Aggiunta card "Vigneto" nella pagina abbonamento (`core/admin/abbonamento-standalone.html`)
- ✅ Verifica attivazione modulo nelle viste prima del caricamento dati

#### 6. Firestore Security Rules
- ✅ Aggiunte regole per collection `vigneti`
- ✅ Aggiunte regole per sub-collections: `vendemmie`, `potature`, `trattamenti`
- ✅ Regole pubblicate su Firebase

### 🚧 In Sviluppo / Da Completare

#### Fase 1: MVP (Restante)
- [x] **Integrazione Sistema Lavori/Diario** ✅ **COMPLETATO 2026-01-14**:
  - [x] Collegamento automatico Lavoro → Vigneto (tramite terreno) ✅
  - [x] Calcolo automatico costi lavori (manodopera + macchine) ✅
  - [x] Aggregazione annuale automatica spese per categoria ✅
  - [x] Mappatura tipi lavoro → categorie spese ✅
  - [x] Aggiornamento automatico vigneto quando lavoro completato/validato ✅
  - [x] Servizio integrazione `lavori-vigneto-service.js` creato ✅
  - [x] Integrazione automatica in 3 punti (approvazione manager, attività rapida, completamento automatico) ✅
  - [x] Pulsante ricalcolo manuale nella UI ✅
  - [x] Gestione indice composito Firestore (filtro lato client) ✅
  - [x] Conversione Timestamp Firestore robusta ✅
- [x] **Rilevamento Automatico Vendemmia da Lavori** ✅ **IMPLEMENTATO** (verificato nel codice 2026-01-18):
  - [x] Funzione `createVendemmiaFromLavoro(lavoroId)` ✅
  - [x] Funzione `createVendemmiaFromAttivita(attivitaId)` ✅
  - [x] Hook in `attivita-events.js` e `gestione-lavori-events.js` ✅
  - [x] Campo `lavoroId` e `attivitaId` nel modello ✅
- [x] **Calcolo Compensi Vendemmia** ✅ **IMPLEMENTATO** (verificato nel codice 2026-01-18):
  - [x] Funzione `calcolaCompensiVendemmia` presente e funzionante ✅
  - [x] Calcola da ore validate del lavoro o da ore impiegate ✅
- [x] Form dedicato vendemmia (mantenere per dati aggiuntivi) ✅
- [x] ~~Viste `potatura-vigneto-standalone.html` e `trattamenti-vigneto-standalone.html`~~ ❌ **NON NECESSARIE**:
  - **Potatura**: Dati già nel sistema Lavori/Diario (duplicazione evitata)
  - **Trattamenti**: Rimandati a modulo Trattamenti dedicato futuro (generale, non solo vigneto)

#### Fase 2: Funzionalità Avanzate
- [ ] Implementare diradamento grappoli
- ~~[ ] Calendario trattamenti con alert giorni di carenza~~ ❌ **RIMANDATO** - Modulo Trattamenti dedicato futuro
- [x] Integrazione link da pagina terreni: pulsante "Gestisci Vigneto" ✅ **COMPLETATO**
- [x] Sezione vigneto nella dashboard con card riepilogative ✅ **COMPLETATO** (Dashboard standalone dedicata)
- [ ] **Report/Bilancio (PDF/Excel) via modulo unico cross-moduli** (NO pagina report dedicata vigneto)

#### Fase 3: Ottimizzazioni

##### 3.1. Ottimizzazioni Performance Dashboard Statistiche ⚠️ **PRIORITÀ ALTA**

**Problema Identificato (2026-01-21)**:
- La pagina statistiche vigneto (`vigneto-statistiche-standalone.html`) è già lenta (~2-3 secondi) con pochi dati
- Con molti dati (più vigneti, più anni, più vendemmie/lavori) i tempi potrebbero aumentare a 10-15 secondi

**Causa Problemi**:
1. Query Firestore multiple per ogni vigneto e anno
2. Aggregazioni lato client (calcoli in JavaScript dopo caricamento dati)
3. Ricreazione completa 9 grafici ad ogni cambio filtro
4. Nessuna cache (ricarica tutto da Firestore ogni volta)

**Strategie di Ottimizzazione**:

**Breve Termine (Facile Implementazione)**:
- [ ] **Debounce sui Filtri** (Impatto: Basso, migliora UX)
  - Attendere 300-500ms dopo ultimo cambio filtro prima di ricaricare
  - Evita ricariche multiple durante selezione

- [ ] **Cache Lato Client** (Impatto: Alto)
  - Salvare risultati in `localStorage`/`sessionStorage` con TTL (5-10 minuti)
  - Evitare query ripetute per stessi filtri
  - Invalidare cache solo quando cambiano dati (vendemmia creata/modificata)

- [ ] **Loading Progressivo** (Impatto: Medio, migliora UX)
  - Mostrare grafici man mano che si caricano
  - Mostrare quelli pronti subito invece di attendere tutti i dati

- [x] **Limitare Dati di Default** ✅ **GIÀ IMPLEMENTATO**
  - Ridotto da 5 a 3 anni per ridurre query

**Medio Termine (Impatto Maggiore)**:
- [ ] **Aggregazioni Pre-calcolate** (Impatto: Molto Alto) ⭐ **PRIORITÀ**
  - Creare documenti aggregazione in Firestore (es. `statistiche_vigneto_2026`)
  - Aggiornarli in background quando cambiano vendemmie/lavori
  - Pagina legge solo documenti aggregati invece di calcolare tutto
  - **Stima miglioramento**: Da 10-15 secondi a 1-2 secondi anche con molti dati
  - **Implementazione**: Cloud Functions o trigger Firestore

- [ ] **Indicizzazione Firestore** (Impatto: Alto)
  - Creare indici compositi per query più frequenti
  - Riduce tempi query anche con molti documenti

- [ ] **Ottimizzazione Query Firestore** (Impatto: Alto)
  - Usare `where` e `limit` per ridurre documenti caricati
  - Evitare campi non necessari
  - Usare `select()` per limitare campi

**Lungo Termine (Architettura)**:
- [ ] **Cloud Functions per Aggregazioni Automatiche**
  - Trigger automatici quando cambiano vendemmie/lavori
  - Calcolo aggregazioni in background
  - Aggiornamento documenti statistiche

- [ ] **Cache Lato Server** (se si aggiunge backend)
  - Redis o simile per cache aggregazioni
  - Riduce carico su Firestore

**Stima Impatto**:
- **Attuale**: ~2-3 secondi (pochi dati), ~10-15 secondi stimati (molti dati)
- **Con ottimizzazioni brevi/medie**: ~3-5 secondi anche con molti dati
- **Con aggregazioni pre-calcolate**: ~1-2 secondi anche con molti dati

**Priorità Consigliate**:
1. Immediato: Debounce filtri + Cache lato client + Loading progressivo
2. Prossimo Sprint: Aggregazioni pre-calcolate (soluzione più efficace)
3. Futuro: Cloud Functions + Indicizzazione avanzata

**Note Tecniche**:
- ✅ Già implementato: Caricamento dati parallelo con `Promise.all`
- ✅ Già implementato: Riduzione anni da 5 a 3
- ⚠️ Da implementare: Cache lato client
- ⚠️ Da implementare: Aggregazioni pre-calcolate (soluzione più efficace)

##### 3.2. Altre Ottimizzazioni
- [x] Pianificazione nuovi impianti (reticolato base) - **COMPLETATO (2026-01-21)**
- [ ] Pianificazione impianti avanzata (stima costi, template sesti, card gestione salvate)
- [ ] Notifiche automatiche

---

---

## 🔄 Decisione Strategica: Integrazione Sistema Lavori/Diario (2026-01-13)

**Problema Identificato**: 
Registrare le stesse operazioni due volte (una nel sistema Lavori/Diario e una nel modulo Vigneto) è ridondante, inefficiente e fonte di errori.

**Soluzione Adottata**:
- **Una sola registrazione**: Tutte le operazioni vengono registrate nel sistema Lavori/Diario (fonte unica di verità)
- **Calcolo automatico**: Il modulo Vigneto aggrega e calcola le spese automaticamente dai lavori registrati
- **Flessibilità totale**: Qualsiasi tipo di lavoro viene conteggiato automaticamente (non solo potatura/trattamenti)
- **Scalabilità**: Nuovi tipi di lavoro vengono conteggiati automaticamente senza modifiche al codice

**Eccezione**: 
- **Vendemmia**: Mantiene form dedicato per dati aggiuntivi specifici (quantità raccolta, qualità uva, gradazione, acidità, pH)

**Vantaggi**:
- ✅ Nessuna duplicazione di dati
- ✅ Tracciabilità completa di tutti i lavori
- ✅ Calcolo automatico di tutte le spese
- ✅ Supporto per qualsiasi tipo di lavoro
- ✅ Conteggio automatico lavori ripetuti nell'anno

**Dettagli Implementazione**: Vedi sezione "2. Integrazione con Sistema Lavori/Diario" in questo documento.

**Stato Implementazione**: ✅ **COMPLETATO 2026-01-14**
- ✅ Servizio `lavori-vigneto-service.js` creato e funzionante
- ✅ Calcolo costi lavori (manodopera + macchine) da ore validate
- ✅ Aggregazione spese annuali per categoria
- ✅ Aggiornamento automatico quando lavoro completato (3 punti integrazione)
- ✅ Pulsante ricalcolo manuale nella UI vigneti
- ✅ Gestione indice composito Firestore (recupero tutti i lavori, filtro lato client)
- ✅ Conversione Timestamp Firestore robusta
- ✅ Test funzionalità completati e verificati

### 🔧 Fix Calcolo Spese Macchine Dettaglio (2026-01-14 - Sera)

**Problema Identificato**:
- Discrepanza tra totale spese tabella principale (615€) e dettaglio spese (445€)
- Spese macchine incomplete nel dettaglio (255€ invece di 425€)

**Causa Root**:
- Attività dirette con sia `macchinaId` (trattore) che `attrezzoId` (attrezzo)
- `aggregaSpeseVignetoAnno` calcolava correttamente entrambi (255€ + 170€ = 425€)
- `getDettaglioSpeseVignetoAnno` calcolava solo `macchinaId` (255€) perché usava `else if` invece di due `if` separati

**Soluzione Implementata**:
- ✅ Correzione calcolo costi macchine in `getDettaglioSpeseVignetoAnno`
- ✅ Calcolo sia `macchinaId` che `attrezzoId` quando entrambi presenti (come in `aggregaSpeseVignetoAnno`)
- ✅ Aggiornamento UI: aggiunta colonna "Costo Macchine" e "Totale" nella tabella attività dirette

**Risultato**:
- ✅ Totale dettaglio corrisponde al totale tabella principale (615€)
- ✅ Spese macchine complete (trattore + attrezzo quando presenti)
- ✅ UI mostra breakdown dettagliato costi macchine per ogni attività

**File Modificati**:
- `modules/vigneto/services/lavori-vigneto-service.js` - Correzione calcolo costi macchine
- `modules/vigneto/views/vigneti-standalone.html` - Aggiornamento UI tabella attività dirette

---

### 🔧 Miglioramenti Sistema Spese (2026-01-15)

**Obiettivo**: Correggere i calcoli delle spese, migliorare la struttura gerarchica delle categorie, e ottimizzare l'esperienza utente.

**Modifiche Implementate**:

#### 1. Correzione Calcolo Costo Totale Anno ✅
- **Problema**: Doppio conteggio categorie (speseManodoperaAnno sommato con spesePotaturaAnno, speseTrattamentiAnno, speseVendemmiaAnno)
- **Soluzione**: Corretto `calcolaCostoTotaleAnno()` nel modello `Vigneto` per non sommare categorie duplicate
- **File**: `modules/vigneto/models/Vigneto.js`
- **Risultato**: Calcoli corretti e coerenti

#### 2. Struttura Gerarchica Dinamica Categorie Manodopera ✅
- **Problema**: Categorie hardcoded, non riflettevano struttura gerarchica (es. Potatura è sotto-categoria di Manodopera)
- **Soluzione**: 
  - Implementata `getCategoriaPrincipaleDaTipoLavoro()` per recupero dinamico categorie dal sistema
  - Refactoring `getCategoriaManodoperaPerTipoLavoro()` per usare categorie dinamiche
  - Aggregazione con struttura gerarchica dinamica (es. `manodoperaPotatura`, `manodoperaLavorazioneTerreno`)
- **File**: `modules/vigneto/services/lavori-vigneto-service.js`
- **Risultato**: Categorie dinamiche basate sul sistema, supporto per categorie multiple (manuale/meccanico)

#### 3. Filtro Attività Dirette Migliorato ✅
- **Problema**: Filtro troppo restrittivo, escludeva attività legittime dello stesso giorno ma di tipo diverso
- **Soluzione**: Filtro aggiornato per escludere solo se stesso giorno/dopo primo lavoro **E** stesso `tipoLavoro`
- **File**: `modules/vigneto/services/lavori-vigneto-service.js`
- **Risultato**: Supporto per multiple attività diverse nello stesso giorno (es. potatura campo A, lavorazione campo B)

#### 4. Coerenza Calcoli Pagina Principale ↔ Dettaglio ✅
- **Problema**: Discrepanze tra totali pagina principale e dettaglio
- **Soluzione**: `getDettaglioSpeseVignetoAnno()` ora usa `aggregaSpeseVignetoAnno()` per i totali
- **File**: `modules/vigneto/services/lavori-vigneto-service.js`
- **Risultato**: Totali identici tra pagina principale e dettaglio

#### 5. Ricalcolo Automatico al Caricamento ✅
- **Problema**: Ricalcolo manuale sempre necessario
- **Soluzione**: Aggiunta funzione `ricalcolaSpeseAutomatico()` eseguita in background dopo caricamento pagina
- **File**: `modules/vigneto/views/vigneti-standalone.html`
- **Risultato**: Spese aggiornate automaticamente, ricalcolo silenzioso senza disturbare utente

#### 6. Miglioramenti UI Card Spese ✅
- **Problema**: Card "Macchine" poco visibile (grigio chiaro, testo grigio scuro)
- **Soluzione**: 
  - Sfondo gradiente blu (`linear-gradient(135deg, #0056b3 0%, #007bff 100%)`)
  - Testo bianco per contrasto
  - Stile allineato alla card "Manodopera"
- **File**: `modules/vigneto/views/vigneti-standalone.html`
- **Risultato**: Card ben visibile e coerente con Manodopera

#### 7. Pulizia Log di Debug ✅
- **Problema**: Console piena di log di debug
- **Soluzione**: Rimossi tutti i `console.log`, `console.debug`, `console.info` di debug
- **File**:
  - `modules/vigneto/views/vigneti-standalone.html`
  - `modules/vigneto/services/vigneti-service.js`
  - `modules/vigneto/services/lavori-vigneto-service.js`
  - `core/services/firebase-service.js`

#### 8. Pulizia Completa Log Debug - Modulo Statistiche Vigneto ✅ **COMPLETATO (2026-01-22)**
- **Contesto**: Dopo completamento ottimizzazione prestazioni con aggregazioni pre-calcolate e risoluzione bug
- **Problema**: Numerosi log di debug aggiunti durante debugging non più necessari in produzione
- **Soluzione**: Rimozione completa di tutti i log di debug (~65+ log) dal modulo statistiche vigneto
- **File Puliti**:
  - `modules/vigneto/views/vigneto-statistiche-standalone.html` - Rimossi ~30+ log
    - Funzione `loadCharts()`: log inizializzazione, parametri, import servizi, cache, promesse, caricamento dati, aggiornamento grafici, completamento, errori
    - Funzione `ensureCanvas()`: log errori per chartId, indice, container, canvas
    - Log errori generici: caricamento dati, inizializzazione filtri
  - `modules/vigneto/services/vigneto-statistiche-service.js` - Rimossi ~20+ log
    - Funzione `getStatisticheVigneto()`: log inizializzazione, parametri, tenantId, aggregazioni, combinazione, fallback, errori
    - Funzioni di supporto: `getVendemmieRecenti()`, `getLavoriVigneto()`, `getVendemmieRange()`, `getProduzioneTemporale()`, `getQualitaUva()`, `getCostiTemporale()`
  - `modules/vigneto/services/vigneto-statistiche-aggregate-service.js` - Rimossi ~15+ log
    - Funzione `getStatisticheAggregate()`: log inizializzazione, parametri, tenantId, documento pre-calcolato, calcolo, errori, fallback
    - Altre funzioni: `calcolaEAggiornaStatistiche()`, `invalidaStatistiche()`, `getProduzioneTemporaleAggregata()`, `getCostiTemporaleAggregati()`
- **Pattern Log Rimossi**: `[VIGNETO-STATISTICHE]`, `[VIGNETO-STATISTICHE-SERVICE]`, `[VIGNETO-STATISTICHE-AGGREGATE]`
- **Risultato**: 
  - ✅ Codice completamente pulito senza log di debug
  - ✅ Funzionalità completa mantenuta
  - ✅ Codice più leggibile e performante
  - ✅ Pronto per produzione
- **Risultato**: Console pulita, mantenuti solo `console.error` e `console.warn`

**File Modificati**:
- `modules/vigneto/models/Vigneto.js` - Correzione calcolo costoTotaleAnno, aggiunto speseProdottiAnno
- `modules/vigneto/services/vigneti-service.js` - Ricalcolo automatico costi al caricamento, rimossi log
- `modules/vigneto/services/lavori-vigneto-service.js` - Struttura gerarchica dinamica, filtro migliorato, coerenza calcoli, rimossi log
- `modules/vigneto/views/vigneti-standalone.html` - Ricalcolo automatico, miglioramenti UI, rimossi log
- `core/services/firebase-service.js` - Rimosso log

**Risultati**:
- ✅ Calcoli corretti e coerenti
- ✅ Totali identici tra pagina principale e dettaglio
- ✅ Card Macchine ben visibile
- ✅ Ricalcolo automatico in background
- ✅ Console pulita

---

## 🔄 Integrazione Vendemmia-Lavori: Rilevamento Automatico (2026-01-16)

### 🎯 Obiettivo

Implementare un sistema di rilevamento automatico della vendemmia basato sulla creazione di lavori/attività nel sistema, eliminando la necessità di creare manualmente la vendemmia e garantendo un'unica fonte di verità per tutti i dati operativi.

### 📋 Principi Architetturali

#### 1. Rilevamento Automatico
- **Trigger**: Quando si crea un Lavoro o Attività con:
  - Tipo lavoro: "Vendemmia Manuale" o "Vendemmia Meccanica"
  - Terreno con coltura: "VITE"
- **Azione**: Sistema crea automaticamente una vendemmia collegata al lavoro
- **Risultato**: Elenco vendemmie popolato automaticamente

#### 2. Unica Fonte di Verità
- **Dati operativi** (operai, ore, macchine, zone): nel Lavoro/Attività
- **Dati produzione** (quantità, qualità, rese): nella Vendemmia
- **Collegamento**: `vendemmia.lavoroId` → `lavoro.id`

#### 3. Tipi Lavoro Specifici
- **Pre-creati nel sistema**:
  - "Vendemmia Manuale" (Categoria: RACCOLTA → Sottocategoria: Manuale)
  - "Vendemmia Meccanica" (Categoria: RACCOLTA → Sottocategoria: Meccanica)
- **Filtro dropdown**: Quando terreno = "VITE" e categoria = "RACCOLTA", mostrare solo tipi vendemmia

### 🔄 Flusso Operativo

#### Fase 1: Creazione Lavoro/Attività
1. Utente crea Lavoro o Attività nel sistema
2. Seleziona:
   - Categoria: "RACCOLTA"
   - Terreno: (con coltura "VITE")
   - Tipo lavoro: "Vendemmia Manuale" o "Vendemmia Meccanica"
3. Sistema rileva automaticamente:
   - `IF (tipoLavoro.includes("Vendemmia") AND terreno.coltura === "VITE")`
   - Crea vendemmia automaticamente al salvataggio del lavoro
   - Collega: `vendemmia.lavoroId = lavoro.id`
   - Collega vigneto: `vendemmia.vignetoId` (tramite `lavoro.terrenoId`)

#### Fase 2: Precompilazione Dati Vendemmia
**Dati precompilati automaticamente dal lavoro**:
- `data`: dal lavoro
- `vignetoId`: trovato tramite `terrenoId`
- `varieta`: dal vigneto collegato
- `operai`: array dal lavoro (per tabella consultazione)
- `macchine`: array dal lavoro (se presente, per tabella consultazione)
- `oreImpiegate`: somma ore dal lavoro
- `zone`: zone tracciate dal lavoro (se presenti)

**Dati da completare manualmente**:
- `quantitaQli`: obbligatorio
- `quantitaEttari`: obbligatorio
- `gradazione`: opzionale
- `acidita`: opzionale
- `ph`: opzionale
- `destinazione`: obbligatorio
- `parcella`: opzionale
- `note`: opzionale

#### Fase 3: Completamento Dati Vendemmia
1. Utente apre "Gestione Vendemmia" nel modulo vigneto
2. Vede elenco vendemmie (già popolato dai lavori)
3. Badge "Incompleta" su vendemmie senza: `quantitaQli`, `quantitaEttari` o `destinazione`
4. Clicca su vendemmia → completa dati mancanti
5. Vendemmia diventa "Completa"

### 📊 Struttura Dati

#### Modello Vendemmia
```javascript
{
  id: "vendemmia-123",
  vignetoId: "vigneto-456",
  lavoroId: "lavoro-789",  // ← NUOVO: Collegamento al lavoro
  data: Timestamp,
  varieta: "Sangiovese",
  
  // Dati produzione (da completare)
  quantitaQli: 200.75,
  quantitaEttari: 3.0,
  resaQliHa: 66.92,  // Calcolato automaticamente
  gradazione: 13.5,
  acidita: 5.2,
  ph: 3.4,
  destinazione: "vino",
  
  // Dati operativi (precompilati dal lavoro, sola consultazione)
  operai: ["user-1", "user-2"],  // Array ID operai
  macchine: ["macchina-1"],      // Array ID macchine
  oreImpiegate: 40.0,
  zone: [...],  // Poligoni zone lavorate
  
  // Costi (calcolati dal lavoro)
  costoManodopera: 800.0,
  costoMacchine: 200.0,
  costoTotale: 1000.0,
  
  // Stato
  stato: "completa" | "incompleta",
  parcella: "Parcella A",
  note: "..."
}
```

### 🎨 Interfaccia Utente

#### Elenco Vendemmie
**Tabella con colonne**:
- Data (dal lavoro)
- Vigneto/Varietà
- Quantità (qli) — se non compilato: badge "Da completare"
- Resa (qli/ha) — se non compilato: "-"
- Qualità (gradazione) — se non compilato: "-"
- Stato: "Completa" / "Incompleta" (badge colorato)
- Azioni: "Completa Dati" / "Modifica" / "Vedi Lavoro" (link)

**Filtri**:
- Anno
- Vigneto/Varietà
- Stato (Completa/Incompleta/Tutte)
- Destinazione (Vino/Vendita Uva)

#### Modal Completamento Vendemmia
**Sezione "Dati Lavoro" (sola lettura)**:
- Data, operai, ore, macchine (dal lavoro)
- Tabella operai: Data, Nome Operaio, Ore (precompilata, non editabile)
- Tabella macchine: Tipo, Nome, Ore (precompilata, non editabile) - **Ore caricate da oreOperai validate**
- Zone tracciate (visualizzazione Maps)
- Link "Vedi Dettagli Lavoro" - **Punta a gestione-lavori-standalone.html (accessibile a manager)**

**Sezione "Dati Vendemmia" (editabile)**:
- Quantità (qli) *
- Superficie (ha) * - **Precompilata automaticamente dal lavoro** (superficieTotaleLavorata o percentualeCompletamento × superficieTerreno)
- Resa (calcolata automaticamente)
- Gradazione, acidità, pH
- Destinazione *
- Note

**Sezione Operai (condizionale)**:
- **Con modulo manodopera attivo**: Dropdown selezionabile con lista operai
- **Senza modulo manodopera**: Tabella editabile con colonne (Data, Nome Operaio, Ore) - **Funzioni aggiungi/rimuovi riga**
- **Vendemmia collegata a lavoro**: Sezione operai nascosta (dati dal lavoro)

**Campi Rimossi**:
- ~~Macchine Utilizzate (dropdown)~~ - Rimosso (macchine mostrate solo in sezione "Dati Lavoro")
- ~~Ore Impiegate~~ - Rimosso (calcolate automaticamente da tabella operai se presente)
- ~~Parcella/Blocco~~ - Rimosso

**Badge/Alert**:
- Badge "Incompleta" se mancano dati obbligatori
- Alert quando si salva vendemmia incompleta

### 🔗 Integrazione con Sistema Spese

#### Classificazione Spese Vendemmia
- **Vendemmia Manuale** → Voce "Vendemmia" sotto macrocategoria **MANODOPERA**
- **Vendemmia Meccanica** → Voce "Vendemmia" sotto macrocategoria **MACCHINE**
- Se entrambe presenti → due voci separate nei rispettivi totali

#### Breakdown Spese Vigneto
```
Spese Manodopera Anno: 5000€
  ├── Potatura: 1500€
  ├── Lavorazione Terreno: 2000€
  └── Vendemmia: 1500€  ← Nuova voce (solo se Vendemmia Manuale)

Spese Macchine Anno: 2000€
  ├── Trattamenti: 800€
  └── Vendemmia: 1200€  ← Nuova voce (solo se Vendemmia Meccanica)
```

#### Integrazione con `lavori-vigneto-service`
- Il servizio `lavori-vigneto-service.js` riconosce lavori "Vendemmia"
- Classifica automaticamente come "Vendemmia" nelle spese
- Aggrega sotto MANODOPERA o MACCHINE in base al tipo

### ⚙️ Gestione Modifiche ed Eliminazioni

#### Modifica Lavoro
- Se si modifica un lavoro collegato a vendemmia:
  - Aggiorna automaticamente vendemmia (operai, ore, macchine, zone)
  - Mantiene dati produzione invariati (quantità, qualità)

#### Modifica Tipo Lavoro
- Se si cambia tipo lavoro da "Vendemmia" a altro:
  - Elimina automaticamente la vendemmia collegata
  - Avviso all'utente: "La vendemmia collegata verrà eliminata"

#### Cambio Terreno
- Se si cambia terreno da "VITE" a altro:
  - Mantiene vendemmia ma scollega il lavoro
  - `vendemmia.lavoroId = null`
  - Vendemmia diventa "standalone" (dati produzione conservati)

#### Eliminazione Lavoro
- Se si elimina un lavoro collegato a vendemmia:
  - Elimina automaticamente anche la vendemmia
  - Avviso all'utente: "La vendemmia collegata verrà eliminata"

### 🎯 Validazione e Stato

#### Vendemmia Completa
**Criteri**:
- `quantitaQli` presente e > 0
- `quantitaEttari` presente e > 0
- `destinazione` presente

**Comportamento**:
- Badge "Completa" nell'elenco
- Nessun alert
- Inclusa nei report produzione

#### Vendemmia Incompleta
**Criteri**:
- Manca almeno uno dei campi obbligatori

**Comportamento**:
- Badge "Incompleta" nell'elenco (colore arancione/giallo)
- Alert quando si apre modulo vigneto: "X vendemmie incomplete"
- Permettere salvataggio incompleto (con alert)
- Escludere dai report produzione finché non completa

### 🔧 Implementazione Tecnica

#### 1. Creazione Tipi Lavoro
- Pre-creare nel sistema:
  - "Vendemmia Manuale" (Categoria: RACCOLTA → Sottocategoria: Manuale)
  - "Vendemmia Meccanica" (Categoria: RACCOLTA → Sottocategoria: Meccanica)

#### 2. Hook Creazione Lavoro
- Nel servizio `lavori-service.js` o `attivita-service.js`:
  - Dopo salvataggio lavoro/attività
  - Verifica: `IF (tipoLavoro.includes("Vendemmia") AND terreno.coltura === "VITE")`
  - Chiama `createVendemmiaFromLavoro(lavoroId)`

#### 3. Servizio Vendemmia
- Nuova funzione: `createVendemmiaFromLavoro(lavoroId)`
  - Recupera lavoro
  - Trova vigneto tramite `lavoro.terrenoId`
  - Crea vendemmia con dati precompilati
  - Collega: `vendemmia.lavoroId = lavoro.id`

#### 4. Filtro Dropdown Tipi Lavoro
- Quando categoria = "RACCOLTA" e terreno = "VITE":
  - Mostrare solo: "Vendemmia Manuale" e "Vendemmia Meccanica"
  - Nascondere: tipi raccolta di altre colture

#### 5. Aggiornamento UI Vendemmia
- Elenco vendemmie: badge stato, link "Vedi Lavoro"
- Modal vendemmia: sezione "Dati Lavoro" (sola lettura), tabelle precompilate
- Filtri: anno, vigneto, stato, destinazione

#### 6. Integrazione Spese
- Aggiornare `lavori-vigneto-service.js`:
  - Riconoscere lavori "Vendemmia"
  - Classificare come voce "Vendemmia" nelle spese
  - Aggregare sotto MANODOPERA o MACCHINE

### ✅ Vantaggi Approccio

1. **Zero Duplicazione**: Un solo punto di inserimento (lavoro)
2. **Rilevamento Automatico**: Nessuna azione manuale per creare vendemmia
3. **Elenco Sempre Aggiornato**: Vendemmie compaiono automaticamente
4. **Dati Base Già Presenti**: Operai, ore, macchine dal lavoro
5. **Dati Aggiuntivi Separati**: Quantità, qualità nella vendemmia
6. **Tracciabilità Completa**: Collegamento bidirezionale lavoro ↔ vendemmia
7. **Funziona con Qualsiasi Configurazione**: Con o senza moduli avanzati

### 📝 Checklist Implementazione

- [ ] Creare tipi lavoro "Vendemmia Manuale" e "Vendemmia Meccanica" nel sistema (da verificare se esistono)
- [x] Implementare hook creazione vendemmia automatica al salvataggio lavoro ✅ **IMPLEMENTATO**
- [x] Aggiungere campo `lavoroId` al modello Vendemmia ✅ **IMPLEMENTATO**
- [x] Implementare funzione `createVendemmiaFromLavoro(lavoroId)` ✅ **IMPLEMENTATO**
- [x] Implementare funzione `createVendemmiaFromAttivita(attivitaId)` ✅ **IMPLEMENTATO**
- [ ] Aggiornare UI elenco vendemmie (badge stato "Incompleta" per vendemmie senza quantità)
- [x] Aggiornare modal vendemmia (sezione dati lavoro, tabelle precompilate) ✅ **IMPLEMENTATO** (2026-01-17)
- [ ] Implementare filtro dropdown tipi lavoro (solo vendemmia quando terreno=VITE)
- [x] Aggiornare `lavori-vigneto-service.js` per riconoscere vendemmia nelle spese ✅ **GIÀ RICONOSCE**
- [ ] Implementare gestione modifiche/eliminazioni lavoro (aggiornamento vendemmia)
- [x] Implementare validazione stato vendemmia (completa/incompleta) ✅ **IMPLEMENTATO** (metodo `isCompleta()` presente)
- [ ] Test integrazione completa

**Stato**: ✅ **FUNZIONALITÀ IMPLEMENTATA** - Funzioni presenti e chiamate da hook in `attivita-events.js` e `gestione-lavori-events.js`

---

---

## 📝 Aggiornamenti Implementazione

### ✅ Aggiornamento 2026-01-17: Completamento Funzionalità Vendemmia

#### Modifiche Implementate

1. **Tabella Editabile Operai (Senza Modulo Manodopera)**
   - Implementata tabella editabile con colonne (Data, Nome Operaio, Ore) quando modulo manodopera non attivo
   - Funzioni: `aggiungiRigaOperaio()`, `rimuoviRigaOperaio()`, `popolaTabellaOperai()`, `getOperaiFromTabella()`
   - Struttura dati: `operai` può essere array di ID (con manodopera) o array di oggetti `{data, nome, ore}` (senza manodopera)

2. **Visualizzazione Ore Macchina**
   - Corretta visualizzazione ore macchina nella tabella "Dati Lavoro"
   - Ore caricate da `oreOperai` validate, raggruppate per macchina/attrezzo
   - Rimossa somma totale (trattore+attrezzo lavorano insieme, stesse ore)

3. **Precompilazione Automatica Superficie Vendemmiata**
   - Implementato calcolo automatico da `lavoro.superficieTotaleLavorata` o `percentualeCompletamento × superficieTerreno`
   - Precompilazione automatica quando vendemmia collegata a lavoro e campo vuoto

4. **Link "Vedi Lavoro"**
   - Corretto link per manager: ora punta a `gestione-lavori-standalone.html?lavoroId=...`
   - Apertura automatica modal dettaglio con parametro URL

5. **Rimozione Campi Non Necessari**
   - Rimossi: Macchine Utilizzate (dropdown), Ore Impiegate, Parcella/Blocco
   - Mantenuti: Note, Sezione "Dati Lavoro" (sola lettura)

6. **Correzione Validazione Form**
   - Risolto problema validazione quando vendemmia collegata a lavoro (rimozione `required` da campo operai nascosto)

**File Modificati**:
- `modules/vigneto/views/vendemmia-standalone.html`
- `modules/vigneto/models/Vendemmia.js`
- `modules/vigneto/services/vendemmia-service.js`
- `core/admin/gestione-lavori-standalone.html`

**Stato**: ✅ Completato

---

### ✅ Aggiornamento 2026-01-18 → 2026-01-19: Tracciamento Poligono Area Vendemmiata e Tabella Macchine

#### Modifiche Implementate

1. **Tracciamento Poligono Area Vendemmiata** (2026-01-18)
   - Aggiunto campo `poligonoVendemmiato` al modello Vendemmia (array coordinate `{lat, lng}`)
   - Pulsante "🗺️ Traccia" accanto al campo "Superficie Vendemmiata"
   - Modal mappa dedicato per tracciare poligono con:
     - Visualizzazione confini terreno (verde)
     - Tracciamento click sulla mappa
     - Validazione punti dentro confini terreno
     - Poligono editabile (vertice trascinabili)
     - Chiusura automatica (click entro 20m dal primo punto)
     - Calcolo automatico superficie con `google.maps.geometry.spherical.computeArea()`
     - Compilazione automatica campo superficie (m² → ettari)
   - Salvataggio coordinate poligono nel documento vendemmia
   - Visualizzazione poligono esistente quando si modifica vendemmia
   - Caricamento Google Maps API con libreria Geometry

2. **Miglioramenti Tracciamento Poligono** (2026-01-19)
   - ✅ **Cursore Crosshair**: Cursore crosshair durante il tracciamento per maggiore precisione (CSS + JavaScript)
   - ✅ **Snap Automatico ai Vertici**: Snap automatico ai vertici del terreno entro 8 metri
   - ✅ **Snap Automatico al Confine**: Snap automatico al confine del terreno entro 5 metri
   - ✅ **Disabilitazione Snap Temporanea**: Tieni premuto Shift per disabilitare lo snap temporaneamente
   - ✅ **Feedback Visivo**: Marker verde temporaneo quando viene applicato lo snap
   - ✅ **Chiusura Automatica Migliorata**: Click entro 20 metri dal primo punto chiude automaticamente il poligono
   - ✅ **Doppio Clic**: Doppio clic termina il tracciamento (se ci sono almeno 3 punti)
   - ✅ **Tolleranza Confine**: Permette punti entro 3 metri dal confine anche se tecnicamente fuori
   - ✅ **Spostamento Automatico**: Sposta automaticamente i punti leggermente dentro se sono sul confine
   - ✅ **Funzioni Helper**: 6 funzioni helper aggiunte per gestione snap e tolleranza:
     - `findNearestVertex()` - Trova vertice più vicino del terreno
     - `findNearestPointOnBoundary()` - Trova punto più vicino sul confine
     - `getClosestPointOnSegment()` - Calcola punto più vicino su un segmento
     - `getDistanceToBoundary()` - Calcola distanza minima dal confine
     - `movePointInsideBoundary()` - Sposta punto dentro il confine
     - `getPolygonCenter()` - Calcola centro di un poligono
   - ✅ **Fix Click Listener**: Risolto problema click non funzionanti (isDrawingPolygon veniva resettato)

2. **Totale Ore Operai nella Tabella Editabile**
   - Aggiunta riga `<tfoot>` con totale ore sotto la tabella operai
   - Funzione `aggiornaTotaleOreOperai()` con aggiornamento in tempo reale
   - Formattazione con 1 decimale (es. "15.5")
   - Visibilità condizionale (footer visibile solo se ci sono righe)

3. **Tabella Macchine (Sola Lettura) per Vendemmia**
   - Sezione `macchine-tabella-section` aggiunta quando:
     - Modulo manodopera NON attivo
     - Vendemmia NON collegata a lavoro
   - Tabella di sola lettura (come quando manodopera è attivo)
   - Caricamento automatico dall'attività collegata (`attivitaId`)
   - Priorità: Attività collegata → Macchine salvate nella vendemmia
   - Colonne: Tipo (Trattore/Attrezzo), Nome, Ore
   - Senza totale ore (come quando manodopera è attivo)

4. **Correzione Visualizzazione Macchine nella Lista Attività**
   - Risolto problema: `renderAttivita()` chiamata prima che `loadMacchine()` completasse
   - Rimossa chiamata interna `renderAttivitaCallback()` da `loadAttivita()`
   - Aggiunta chiamata esterna `renderAttivita()` dopo `Promise.all()`
   - Aggiunto controllo `macchineList` non vuota prima di costruire `macchineMap`

5. **Aggiunta Campi Macchine al Modello Attivita**
   - Aggiunti campi `macchinaId`, `attrezzoId`, `oreMacchina` al costruttore
   - Campi ora preservati quando oggetto ricreato da Firestore
   - Documentazione JSDoc aggiornata

6. **Rimozione Messaggio Automatico Note Vendemmia**
   - Campo `note` lasciato vuoto invece di messaggio automatico quando vendemmia creata da attività

**File Modificati**:
- `modules/vigneto/models/Vendemmia.js` (campo `poligonoVendemmiato`)
- `modules/vigneto/views/vendemmia-standalone.html` (modal mappa, totale ore, tabella macchine, miglioramenti tracciamento poligono 2026-01-19)
- `core/js/attivita-controller.js` (correzione ordine caricamento)
- `core/attivita-standalone.html` (chiamata renderAttivita dopo Promise.all)
- `core/models/Attivita.js` (campi macchine)
- `modules/vigneto/services/vendemmia-service.js` (rimozione messaggio automatico)

**Stato**: ✅ Completato (2026-01-18) + ✅ Miglioramenti Tracciamento (2026-01-19)

---

**Ultimo aggiornamento**: 2026-01-23 (Implementazione Calcolo Materiali Impianto)  
**Stato**: ✅ IMPLEMENTATO - Funzionalità Vendemmia Completata + Tracciamento Poligono Avanzato + Tabella Macchine + Calcolo Materiali Impianto

---

## ✅ Verifica Codice - Correzioni Documento (2026-01-18)

### Correzioni Applicate

1. **Rilevamento Automatico Vendemmia**: 
   - ✅ **IMPLEMENTATO** - Funzioni `createVendemmiaFromLavoro` e `createVendemmiaFromAttivita` presenti in `vendemmia-service.js`
   - ✅ Hook implementati in `core/js/attivita-events.js` e `core/admin/js/gestione-lavori-events.js`
   - ✅ Campo `lavoroId` e `attivitaId` presenti nel modello `Vendemmia.js`

2. **Calcolo Compensi Vendemmia**: 
   - ✅ **IMPLEMENTATO** - Funzione `calcolaCompensiVendemmia` presente in `vendemmia-service.js` (linee 636-726)
   - ✅ Chiamata automaticamente in `createVendemmia()` e `updateVendemmia()`
   - ✅ Calcola da ore validate del lavoro o da ore impiegate e tariffe

3. **Stato Generale**: 
   - Aggiornato da ~60% a ~**70-75%** completamento (più accurato)

### Stato Reale vs Documento Precedente

| Funzionalità | Documento Precedente | Stato Reale (Codice) |
|--------------|---------------------|---------------------|
| Rilevamento Automatico Vendemmia | 📝 Pianificato | ✅ **IMPLEMENTATO** |
| Calcolo Compensi Vendemmia | 🚧 TODO | ✅ **IMPLEMENTATO** |
| Tracciamento Poligono | ✅ Completato | ✅ **COMPLETATO + MIGLIORATO (2026-01-19)** |
| Tabella Macchine | ✅ Completato | ✅ **COMPLETATO** |
