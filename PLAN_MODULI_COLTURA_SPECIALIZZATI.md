# 📋 Piano Sviluppo: Moduli Specializzati per Coltura

**Data creazione**: 2026-01-12  
**Ultimo aggiornamento**: 2026-01-24  
**Stato**: 📝 PIANIFICAZIONE - Modulo Vigneto: Funzionalità Vendemmia Completata + Tracciamento Poligono + Calcolo Materiali Impianto + **Integrazione Creazione Vigneti da Lavori Impianto**  
**Priorità**: Media-Alta

---

## 🎯 Obiettivo

Creare moduli specializzati per gestire le specificità di ogni tipo di coltura:
- **Modulo Vigneto** - Gestione vendemmia, potatura, trattamenti, rese
- **Modulo Frutteto** - Gestione raccolta, potatura, diradamento, rese per specie
- **Modulo Oliveto** - Gestione raccolta olive, potatura, resa olio, qualità

Ogni modulo si integra con il Core Base e i moduli esistenti (Manodopera, Parco Macchine) aggiungendo funzionalità specifiche per quella coltura.

---

## 🏗️ Principi Architetturali

### 1. Moduli Opzionali Pay-Per-Use
- Ogni modulo è **attivabile/disattivabile** per tenant
- **Pricing**: €12-15/mese per modulo (da definire)
- Moduli **standalone** ma con integrazioni opzionali

### 2. Integrazione con Core Base
- **Terreni**: Campo `coltura` già presente → filtraggio automatico
- **Lavori**: Tipi lavoro specifici per coltura
- **Attività**: Tracciamento attività specifiche
- **Statistiche**: Report specializzati per coltura

### 3. Estensione Modelli Esistenti
- **NON** modificare modelli core esistenti
- Usare **sub-collections** o **campi opzionali** per dati specifici
- Esempio: `tenants/{tenantId}/terreni/{terrenoId}/datiVigneto/`

### 4. Compatibilità Retroattiva
- Terreni esistenti continuano a funzionare
- Moduli attivabili in qualsiasi momento
- Nessuna migrazione dati obbligatoria

---

## 🔄 Architettura Modelli: Comune vs Specifico

### Modello Base Comune (Riutilizzabile)

Tutti i moduli condividono una **struttura base comune** che può essere implementata come classe base o interfaccia comune:

#### Campi Comuni Anagrafica Impianto

| Campo | Tipo | Descrizione | Esempio |
|-------|------|-------------|---------|
| `terrenoId` | string | Riferimento al terreno (obbligatorio) | "terreno-123" |
| `varieta` | string/array | Varietà coltivata (può essere array per oliveto) | "Sangiovese" o ["Frantoio", "Leccino"] |
| `annataImpianto` | number | Anno di impianto | 2015 |
| `portainnesto` | string | Tipo di portainnesto utilizzato | "1103P", "M9", "selvatico" |
| `densita` | number | Densità impianto (unità/ha) | 5000 (ceppi/ha), 3000 (piante/ha) |
| `formaAllevamento` | string | Forma di allevamento (sistema di potatura) | "Guyot", "vaso", "spalliera", "monocono" |
| `tipoImpianto` | string | Tipo di impianto (sesto, disposizione) | "tradizionale", "intensivo", "superintensivo" |
| `distanzaFile` | number | Distanza tra le file (metri) | 2.5, 3.5, 6.0 |
| `distanzaUnita` | number | Distanza tra unità (ceppi/piante) nella fila (metri) | 0.8, 0.9, 5.0 |
| `orientamentoFilari` | string | Orientamento filari (opzionale) | "N-S", "E-O" |
| `superficieEttari` | number | Superficie dedicata (ha) - calcolata o manuale | 3.0 |
| `note` | string | Note generali | "..." |

#### Campi Comuni Rese e Produzione

| Campo | Tipo | Descrizione | Esempio |
|-------|------|-------------|---------|
| `resaMediaKgHa` | number | Resa media storica (kg/ettaro) | 5000 |
| `resaAnnoPrecedente` | number | Resa anno precedente (kg/ettaro) | 4800 |
| `produzioneTotaleAnno` | number | Produzione totale anno corrente (kg) | 15000 |
| `produzioneTotaleAnnoPrecedente` | number | Produzione totale anno precedente (kg) | 14400 |

#### Campi Comuni Spese e Costi

| Campo | Tipo | Descrizione | Esempio |
|-------|------|-------------|---------|
| `speseManodoperaAnno` | number | Spese manodopera totali anno (€) | 5000 |
| `speseTrattamentiAnno` | number | Spese prodotti fitosanitari anno (€) | 2000 |
| `spesePotaturaAnno` | number | Spese potatura anno (€) | 1500 |
| `speseRaccoltaAnno` | number | Spese raccolta anno (€) | 3000 |
| `speseMacchineAnno` | number | Spese macchine anno (€) - calcolato da ore × costo/ora | 2000 |
| `speseAltroAnno` | number | Altre spese anno (€) | 1000 |
| `costoTotaleAnno` | number | Costo totale anno (€) - calcolato | 12500 |
| `costoPerEttaro` | number | Costo per ettaro (€/ha) - calcolato | 4166.67 |
| `ricavoAnno` | number | Ricavo totale anno (€) | 20000 |
| `margineAnno` | number | Margine anno (€) - calcolato | 7500 |

**Nota Calcolo Spese Macchine**:
- Include sia trattore (`macchinaId`) che attrezzo (`attrezzoId`) quando entrambi presenti nella stessa attività
- Calcolo: `costoMacchine = (oreMacchina × costoOraTrattore) + (oreMacchina × costoOraAttrezzo)`
- Coerenza garantita tra calcolo aggregato e dettaglio

#### Campi Comuni Tracciamento

| Campo | Tipo | Descrizione | Esempio |
|-------|------|-------------|---------|
| `dataUltimaPotatura` | Date | Data ultima potatura | 2025-01-15 |
| `dataUltimoTrattamento` | Date | Data ultimo trattamento | 2025-01-20 |
| `dataUltimaRaccolta` | Date | Data ultima raccolta | 2025-09-15 |
| `statoImpianto` | string | Stato impianto: "attivo" \| "in_riposo" \| "da_rimuovere" | "attivo" |

### Campi Specifici per Modulo

#### Modulo Vigneto - Campi Specifici

| Campo | Tipo | Descrizione | Esempio |
|-------|------|-------------|---------|
| `densitaCepi` | number | Densità ceppi/ha (alias di `densita`) | 5000 |
| `distanzaCepi` | number | Distanza tra ceppi (alias di `distanzaUnita`) | 0.8 |
| `sistemaAllevamento` | string | Sistema allevamento (alias di `formaAllevamento`) | "Guyot", "Cordone speronato" |
| `numeroFilari` | number | Numero filari totali (opzionale, calcolabile) | 120 |
| `ceppiTotali` | number | Numero totale ceppi (opzionale, calcolabile) | 60000 |
| `destinazioneUva` | string | Destinazione principale: "vino" \| "vendita_uva" \| "misto" | "vino" |
| `cantina` | string | Nome cantina di riferimento (opzionale) | "Cantina Sociale" |

#### Modulo Frutteto - Campi Specifici

| Campo | Tipo | Descrizione | Esempio |
|-------|------|-------------|---------|
| `specie` | string | Specie fruttifera (es. "Melo", "Pesco") | "Melo" |
| `densitaPiante` | number | Densità piante/ha (alias di `densita`) | 3000 |
| `distanzaPiante` | number | Distanza tra piante (alias di `distanzaUnita`) | 0.9 |
| `sistemaAllevamento` | string | Sistema allevamento (alias di `formaAllevamento`) | "vaso", "palmetta", "spalliera" |
| `pianteTotali` | number | Numero totale piante (opzionale, calcolabile) | 15000 |
| `calibroMedio` | string | Calibro medio frutta (opzionale) | "70-80mm" |
| `gradoMaturazione` | string | Grado maturazione tipico (opzionale) | "ottimale" |

#### Modulo Oliveto - Campi Specifici

| Campo | Tipo | Descrizione | Esempio |
|-------|------|-------------|---------|
| `varieta` | array | Array varietà (oliveto può avere più varietà) | ["Frantoio", "Leccino"] |
| `densitaPiante` | number | Densità piante/ha (alias di `densita`) | 200 |
| `distanzaPiante` | number | Distanza tra piante (alias di `distanzaUnita`) | 5.0 |
| `sistemaAllevamento` | string | Sistema allevamento (alias di `formaAllevamento`) | "vaso", "monocono" |
| `pianteTotali` | number | Numero totale piante (opzionale, calcolabile) | 800 |
| `resaOlioMedia` | number | Resa olio media storica (%) | 15.0 |
| `frantoioPreferito` | string | Frantoio di riferimento (opzionale) | "Frantoio Rossi" |
| `metodoRaccoltaPreferito` | string | Metodo raccolta: "manuale" \| "meccanica" \| "abbacchiatura" | "manuale" |

---

## 📊 Struttura Dati Dettagliata per Modulo

### Modello Base Comune (Classe Astratta/Interfaccia)

```
ColturaSpecializzata (Base)
├── Campi Anagrafica Comuni
│   ├── terrenoId
│   ├── varieta (string o array)
│   ├── annataImpianto
│   ├── portainnesto
│   ├── densita
│   ├── formaAllevamento
│   ├── tipoImpianto
│   ├── distanzaFile
│   ├── distanzaUnita
│   ├── orientamentoFilari
│   ├── superficieEttari
│   └── note
│
├── Campi Rese Comuni
│   ├── resaMediaKgHa
│   ├── resaAnnoPrecedente
│   ├── produzioneTotaleAnno
│   └── produzioneTotaleAnnoPrecedente
│
├── Campi Spese Comuni
│   ├── speseManodoperaAnno
│   ├── speseTrattamentiAnno
│   ├── spesePotaturaAnno
│   ├── speseRaccoltaAnno
│   ├── speseAltroAnno
│   ├── costoTotaleAnno (calcolato)
│   ├── costoPerEttaro (calcolato)
│   ├── ricavoAnno
│   └── margineAnno (calcolato)
│
└── Campi Tracciamento Comuni
    ├── dataUltimaPotatura
    ├── dataUltimoTrattamento
    ├── dataUltimaRaccolta
    └── statoImpianto
```

### Estensioni Specifiche

```
Vigneto extends ColturaSpecializzata
├── densitaCepi (alias densita)
├── distanzaCepi (alias distanzaUnita)
├── sistemaAllevamento (alias formaAllevamento)
├── numeroFilari
├── ceppiTotali
├── destinazioneUva
└── cantina

Frutteto extends ColturaSpecializzata
├── specie
├── densitaPiante (alias densita)
├── distanzaPiante (alias distanzaUnita)
├── sistemaAllevamento (alias formaAllevamento)
├── pianteTotali
├── calibroMedio
└── gradoMaturazione

Oliveto extends ColturaSpecializzata
├── varieta (array invece di string)
├── densitaPiante (alias densita)
├── distanzaPiante (alias distanzaUnita)
├── sistemaAllevamento (alias formaAllevamento)
├── pianteTotali
├── resaOlioMedia
├── frantoioPreferito
└── metodoRaccoltaPreferito
```

---

## 📦 Contenuto Dettagliato di Ogni Modulo

### Analisi: Cosa Contiene Ogni Modulo

Ogni modulo specializzato per coltura contiene **4 componenti principali**:

1. **Anagrafica Impianto** - Dati tecnici dell'impianto
2. **Gestione Operazioni** - Raccolta, potatura, trattamenti, ecc.
3. **Rese e Produzione** - Tracciamento rese, qualità, produzione
4. **Spese e Costi** - Tracciamento costi e calcolo margini

---

## 🔄 Componenti Comuni (Riutilizzabili)

### 1. Anagrafica Impianto - Campi Comuni

**Tutti i moduli condividono questi campi base**:

| Campo | Tipo | Obbligatorio | Descrizione | Esempio |
|-------|------|--------------|-------------|---------|
| `terrenoId` | string | ✅ Sì | Riferimento terreno | "terreno-123" |
| `varieta` | string/array | ✅ Sì | Varietà coltivata | "Sangiovese" o ["Frantoio", "Leccino"] |
| `annataImpianto` | number | ✅ Sì | Anno impianto | 2015 |
| `portainnesto` | string | ⚠️ Opzionale | Tipo portainnesto | "1103P", "M9", "selvatico" |
| `densita` | number | ✅ Sì | Densità impianto (unità/ha) | 5000 (ceppi), 3000 (piante), 200 (olivi) |
| `formaAllevamento` | string | ✅ Sì | Forma di allevamento | "Guyot", "vaso", "spalliera", "monocono" |
| `tipoImpianto` | string | ⚠️ Opzionale | Tipo impianto | "tradizionale", "intensivo", "superintensivo" |
| `distanzaFile` | number | ✅ Sì | Distanza tra file (metri) | 2.5, 3.5, 6.0 |
| `distanzaUnita` | number | ✅ Sì | Distanza tra unità (metri) | 0.8 (ceppi), 0.9 (piante), 5.0 (olivi) |
| `orientamentoFilari` | string | ⚠️ Opzionale | Orientamento filari | "N-S", "E-O" |
| `superficieEttari` | number | ✅ Sì | Superficie dedicata (ha) | 3.0 |
| `note` | string | ❌ No | Note generali | "..." |

**Note**:
- `varieta` può essere `string` (vigneto, frutteto) o `array` (oliveto con più varietà)
- `densita` unità varia: ceppi/ha (vigneto), piante/ha (frutteto, oliveto)
- `distanzaUnita` varia: distanza ceppi (vigneto), distanza piante (frutteto, oliveto)

### 2. Rese e Produzione - Campi Comuni

**Tutti i moduli tracciano rese e produzione**:

| Campo | Tipo | Descrizione | Calcolo |
|-------|------|-------------|---------|
| `resaMediaKgHa` | number | Resa media storica (kg/ettaro) | Media ultimi 3-5 anni |
| `resaAnnoPrecedente` | number | Resa anno precedente (kg/ettaro) | Dato storico |
| `produzioneTotaleAnno` | number | Produzione totale anno corrente (kg) | Somma raccolte anno |
| `produzioneTotaleAnnoPrecedente` | number | Produzione totale anno precedente (kg) | Dato storico |
| `resaPerVarieta` | object | Resa per varietà `{varieta: resaKgHa}` | Calcolato da raccolte |
| `trendResa` | array | Trend rese ultimi 5 anni `[{anno, resa}]` | Storico calcolato |

**Campi Specifici per Modulo**:
- **Vigneto**: `resaPerVarieta`, `gradazioneMedia`, `aciditaMedia`
- **Frutteto**: `resaPerSpecie`, `calibroMedio`, `gradoMaturazione`
- **Oliveto**: `resaOlioMedia` (%), `resaOlioPerVarieta` (%)

### 3. Spese e Costi - Campi Comuni

**Tutti i moduli tracciano spese e costi**:

| Campo | Tipo | Descrizione | Fonte Dati |
|-------|------|-------------|------------|
| `speseManodoperaAnno` | number | Spese manodopera totali anno (€) | **Calcolato**: Somma costi manodopera di tutti i lavori dell'anno sul terreno |
| `speseTrattamentiAnno` | number | Spese prodotti fitosanitari anno (€) | **Calcolato**: Somma costi lavori "Trattamento" dell'anno |
| `spesePotaturaAnno` | number | Spese potatura anno (€) | **Calcolato**: Somma costi lavori "Potatura" dell'anno |
| `speseRaccoltaAnno` | number | Spese raccolta anno (€) | **Calcolato**: Somma costi lavori "Raccolta" dell'anno (o form dedicato per vendemmia) |
| `speseMacchineAnno` | number | Spese macchine anno (€) | **Calcolato**: Somma costi macchine di tutti i lavori dell'anno |
| `speseAltroAnno` | number | Altre spese anno (€) | **Calcolato**: Somma costi lavori non categorizzati + inserimenti manuali |
| `costoTotaleAnno` | number | Costo totale anno (€) | **Calcolato**: somma tutte le spese |
| `costoPerEttaro` | number | Costo per ettaro (€/ha) | **Calcolato**: costoTotaleAnno / superficieEttari |
| `ricavoAnno` | number | Ricavo totale anno (€) | Inserimento manuale o calcolato |
| `margineAnno` | number | Margine anno (€) | **Calcolato**: ricavoAnno - costoTotaleAnno |
| `marginePerEttaro` | number | Margine per ettaro (€/ha) | **Calcolato**: margineAnno / superficieEttari |
| `roiAnno` | number | ROI anno (%) | **Calcolato**: (margineAnno / costoTotaleAnno) × 100 |

**Campi Specifici per Modulo**:
- **Vigneto**: `speseVendemmiaAnno`, `speseCantinaAnno` (se produce vino)
- **Frutteto**: `speseDiradamentoAnno`, `speseConservazioneAnno`
- **Oliveto**: `speseMolituraAnno`, `speseFrantoioAnno`

### 4. Operazioni Comuni - Sub-Collections

**Tutti i moduli hanno queste sub-collections comuni**:

#### Potature
```
tenants/{tenantId}/{coltura}/{id}/potature/{potaturaId}
{
  data: Timestamp,
  tipo: string,                    // "invernale", "verde", "rinnovo", ecc.
  parcella: string,                // Parcella/blocco lavorato
  unitaLavorate: number,           // Ceppi/piante potate
  operai: [string],                // Array ID operai
  oreImpiegate: number,            // Ore totali
  costoManodopera: number,          // Calcolato: ore × tariffe
  macchinaId: string,              // Opzionale, se usata macchina
  note: string
}
```

#### Trattamenti
```
tenants/{tenantId}/{coltura}/{id}/trattamenti/{trattamentoId}
{
  data: Timestamp,
  prodotto: string,                 // Nome prodotto
  dosaggio: string,                 // Es. "2 kg/ha"
  condizioniMeteo: string,          // "sereno", "nuvoloso", ecc.
  temperatura: number,               // Temperatura (°C)
  operatore: string,                // ID operatore
  macchinaId: string,              // ID macchina utilizzata
  costoProdotto: number,            // Costo prodotto (€)
  costoManodopera: number,          // Costo manodopera (€)
  costoTotale: number,              // Calcolato: prodotto + manodopera
  note: string
}
```

---

## 🍇 Modulo Vigneto - Contenuto Specifico

### Funzionalità Principali

#### 1. Gestione Vigneti
- **Anagrafica Vigneti**:
  - Varietà uva (Sangiovese, Chardonnay, ecc.)
  - Annata impianto
  - Portainnesto
  - Sistema di allevamento (Guyot, Cordone speronato, ecc.)
  - Densità impianto (ceppi/ha)
  - Orientamento filari
  - Distanza filari e ceppi

- **Zone Vigneto**:
  - Suddivisione per parcella/ceppo
  - Mappatura filari sulla mappa terreno
  - Tracciamento zone per lavorazione

#### 2. Gestione Vendemmia
- **Pianificazione Vendemmia**:
  - Data prevista vendemmia per varietà
  - Priorità vendemmia (ordine raccolta)
  - Quantità prevista (kg/ettaro)
  - Destinazione (vino, vendita uva, ecc.)

- **Raccolta Vendemmia**:
  - Registrazione data raccolta
  - Quantità raccolta per varietà/parcella
  - Qualità uva (gradazione zuccherina, acidità)
  - Operai coinvolti
  - Macchine utilizzate

- **Calcolo Compensi Vendemmia**:
  - Tariffe per kg raccolto
  - Tariffe per ora
  - Calcolo automatico compensi operai
  - Distinzione per varietà (se tariffe diverse)

#### 3. Gestione Potatura
- **Tipi Potatura**:
  - Potatura invernale
  - Potatura verde (estiva)
  - Spollonatura
  - Diradamento grappoli (per progetti alta qualità)

#### 3.1. Gestione Diradamento (Progetti Alta Qualità)
- **Diradamento Grappoli**:
  - Data diradamento
  - Parcella/blocco diradato
  - Ceppi diradati
  - Grappoli rimossi (quantità stimata o effettiva)
  - Operai coinvolti
  - Tempo impiegato
  - Obiettivo (riduzione carico produttivo per qualità superiore)

- **Tracciamento Potatura**:
  - Data potatura per parcella
  - Ceppi potati
  - Operai coinvolti
  - Tempo impiegato

#### 4. Gestione Trattamenti
- **Piano Trattamenti**:
  - Calendario trattamenti (antifungini, insetticidi, ecc.)
  - Prodotti utilizzati
  - Dosaggi
  - Intervalli tra trattamenti

- **Registro Trattamenti**:
  - Data trattamento
  - Prodotto utilizzato
  - Dosaggio applicato
  - Condizioni meteo
  - Operatore che ha eseguito

#### 5. Rese e Produzione
- **Rese per Varietà**:
  - Resa media (kg/ettaro) per varietà
  - Confronto annate
  - Grafici produzione nel tempo

- **Qualità Uva**:
  - Gradazione zuccherina
  - Acidità
  - pH
  - Tracciamento per parcella

#### 6. Report e Statistiche
- **Report Vendemmia**:
  - Totale kg raccolti per varietà
  - Resa media per ettaro
  - Costi manodopera vendemmia
  - Confronto con anni precedenti

- **Statistiche Trattamenti**:
  - Numero trattamenti per stagione
  - Costi prodotti fitosanitari
  - Efficacia trattamenti

### Struttura Dati

```
tenants/{tenantId}/vigneti/{vignetoId}
{
  terrenoId: "terreno-123",           // Riferimento terreno
  varieta: "Sangiovese",
  annataImpianto: 2015,
  portainnesto: "1103P",
  sistemaAllevamento: "Guyot",
  densitaCepi: 5000,                   // cepi/ha
  orientamentoFilari: "N-S",
  distanzaFilari: 2.5,                 // metri
  distanzaCepi: 0.8,                   // metri
  note: "..."
}

tenants/{tenantId}/vigneti/{vignetoId}/vendemmie/{vendemmiaId}
{
  data: Timestamp,
  varieta: "Sangiovese",
  quantitaKg: 15000,
  quantitaEttari: 3.0,
  resaKgHa: 5000,
  gradazione: 13.5,                    // gradi Brix
  acidita: 5.2,                        // g/L
  ph: 3.4,
  destinazione: "vino" | "vendita_uva",
  operai: ["user-1", "user-2"],
  macchine: ["macchina-1"],
  note: "..."
}

tenants/{tenantId}/vigneti/{vignetoId}/potature/{potaturaId}
{
  data: Timestamp,
  tipo: "invernale" | "verde" | "spollonatura",
  parcella: "Parcella A",
  ceppiPotati: 500,
  operai: ["user-1"],
  oreImpiegate: 8.5,
  costoManodopera: 170.0,
  macchinaId: "macchina-1",          // Opzionale
  note: "..."
}

tenants/{tenantId}/vigneti/{vignetoId}/diradamenti/{diradamentoId}
{
  data: Timestamp,
  tipo: "grappoli",
  parcella: "Parcella A",
  ceppiDiradati: 500,
  grappoliRimossi: 2000,              // Quantità stimata o effettiva
  operai: ["user-1"],
  oreImpiegate: 10.0,
  costoManodopera: 200.0,
  obiettivo: "riduzione_carico_qualita",
  note: "Diradamento per progetto alta qualità"
}

tenants/{tenantId}/vigneti/{vignetoId}/trattamenti/{trattamentoId}
{
  data: Timestamp,
  prodotto: "Rame",
  dosaggio: "2 kg/ha",
  condizioniMeteo: "sereno",
  temperatura: 18,
  operatore: "user-1",
  macchina: "macchina-1",
  note: "..."
}
```

### Integrazioni

- **Con Terreni**: Filtraggio automatico terreni con coltura "Vite"
- **Con Lavori**: Tipi lavoro specifici (potatura, vendemmia, trattamenti)
- **Con Manodopera**: Calcolo compensi vendemmia, ore potatura
- **Con Parco Macchine**: Macchine per trattamenti, vendemmia meccanica
- **Con Statistiche**: Report produzione, rese, costi

---

## 🍎 Modulo Frutteto - Contenuto Specifico

### Anagrafica Frutteto - Campi Specifici

Oltre ai campi comuni, il frutteto ha:

| Campo | Tipo | Descrizione | Esempio |
|-------|------|-------------|---------|
| `specie` | string | Specie fruttifera | "Melo", "Pesco", "Pero" |
| `densitaPiante` | number | Densità piante/ha (alias di `densita`) | 3000 |
| `distanzaPiante` | number | Distanza tra piante (alias di `distanzaUnita`) | 0.9 |
| `sistemaAllevamento` | string | Sistema allevamento (alias di `formaAllevamento`) | "vaso", "palmetta", "spalliera" |
| `pianteTotali` | number | Numero totale piante (calcolabile) | 15000 |
| `calibroMedio` | string | Calibro medio frutta | "70-80mm" |
| `gradoMaturazione` | string | Grado maturazione tipico | "ottimale" |

### Sub-Collections Specifiche

#### 1. Raccolte Frutta
```
tenants/{tenantId}/frutteti/{fruttetoId}/raccolte/{raccoltaId}
{
  data: Timestamp,
  specie: "Melo",
  varieta: "Gala",
  quantitaKg: 25000,
  quantitaEttari: 5.0,
  resaKgHa: 5000,
  
  // Qualità frutta
  calibro: "70-80mm",
  gradoMaturazione: "ottimale",
  colore: "rosso intenso",
  
  // Operazioni
  operai: ["user-1", "user-2"],
  macchine: ["macchina-1"],            // Opzionale (raccolta meccanica)
  oreImpiegate: 60.0,
  
  // Costi
  costoManodopera: 1200.0,
  costoMacchine: 300.0,               // Se raccolta meccanica
  costoTotale: 1500.0,
  
  // Ricavi
  prezzoVendita: 0.80,                 // €/kg
  ricavo: 20000.0,                     // Calcolato
  
  note: "..."
}
```

#### 2. Diradamenti
```
tenants/{tenantId}/frutteti/{fruttetoId}/diradamenti/{diradamentoId}
{
  data: Timestamp,
  tipo: "fiori" | "frutti",
  parcella: "Parcella A",
  pianteDiradate: 200,
  fruttiRimossi: 5000,                 // kg
  operai: ["user-1"],
  oreImpiegate: 6.0,
  costoManodopera: 120.0,
  obiettivo: "carico_produttivo_ottimale",
  note: "..."
}
```

### Funzionalità Principali

#### 1. Gestione Frutteti
- **Anagrafica Frutteti**:
  - Specie (Pesco, Melo, Pero, ecc.)
  - Varietà (es. "Gala" per melo)
  - Annata impianto
  - Portainnesto
  - Sistema di allevamento (vaso, palmetta, spalliera, ecc.)
  - Densità piante (piante/ha)
  - Distanza tra file e tra piante

- **Zone Frutteto**:
  - Suddivisione per parcella/blocco
  - Mappatura piante sulla mappa terreno
  - Tracciamento zone per lavorazione

#### 2. Gestione Raccolta
- **Pianificazione Raccolta**:
  - Data prevista raccolta per specie/varietà
  - Priorità raccolta
  - Quantità prevista (kg/ettaro)
  - Qualità prevista (calibro, colore, ecc.)

- **Raccolta Frutta**:
  - Registrazione data raccolta
  - Quantità raccolta per specie/varietà/parcella
  - Qualità frutta (calibro, colore, grado maturazione)
  - Operai coinvolti
  - Macchine utilizzate (se raccolta meccanica)

- **Calcolo Compensi Raccolta**:
  - Tariffe per kg raccolto (diverse per specie)
  - Tariffe per ora
  - Calcolo automatico compensi operai

#### 3. Gestione Potatura
- **Tipi Potatura**:
  - Potatura invernale
  - Potatura verde (estiva)
  - Potatura di rinnovo
  - Potatura di produzione

- **Tracciamento Potatura**:
  - Data potatura per parcella
  - Piante potate
  - Operai coinvolti
  - Tempo impiegato

#### 4. Gestione Diradamento
- **Diradamento Fiori/Frutti**:
  - Data diradamento
  - Piante diradate
  - Quantità frutti rimossi
  - Operai coinvolti
  - Obiettivo (carico produttivo ottimale)

#### 5. Gestione Trattamenti
- **Piano Trattamenti**:
  - Calendario trattamenti (antifungini, insetticidi, fitoregolatori)
  - Prodotti utilizzati
  - Dosaggi
  - Intervalli tra trattamenti
  - Intervalli di sicurezza (giorni prima raccolta)

- **Registro Trattamenti**:
  - Data trattamento
  - Prodotto utilizzato
  - Dosaggio applicato
  - Condizioni meteo
  - Operatore che ha eseguito

#### 6. Rese e Produzione
- **Rese per Specie/Varietà**:
  - Resa media (kg/ettaro) per specie
  - Confronto annate
  - Grafici produzione nel tempo
  - Analisi per varietà

- **Qualità Frutta**:
  - Calibro medio
  - Grado maturazione
  - Colore
  - Tracciamento per parcella

#### 7. Report e Statistiche
- **Report Raccolta**:
  - Totale kg raccolti per specie/varietà
  - Resa media per ettaro
  - Costi manodopera raccolta
  - Confronto con anni precedenti

- **Statistiche Trattamenti**:
  - Numero trattamenti per stagione
  - Costi prodotti fitosanitari
  - Rispetto intervalli sicurezza

### Struttura Dati

```
tenants/{tenantId}/frutteti/{fruttetoId}
{
  terrenoId: "terreno-123",
  specie: "Melo",
  varieta: "Gala",
  annataImpianto: 2018,
  portainnesto: "M9",
  sistemaAllevamento: "spalliera",
  densitaPiante: 3000,                 // piante/ha
  distanzaFile: 3.5,                   // metri
  distanzaPiante: 0.9,                 // metri
  note: "..."
}

tenants/{tenantId}/frutteti/{fruttetoId}/raccolte/{raccoltaId}
{
  data: Timestamp,
  specie: "Melo",
  varieta: "Gala",
  quantitaKg: 25000,
  quantitaEttari: 5.0,
  resaKgHa: 5000,
  calibro: "70-80mm",
  gradoMaturazione: "ottimale",
  operai: ["user-1", "user-2"],
  macchine: ["macchina-1"],
  note: "..."
}

tenants/{tenantId}/frutteti/{fruttetoId}/diradamenti/{diradamentoId}
{
  data: Timestamp,
  tipo: "fiori" | "frutti",
  parcella: "Parcella A",
  pianteDiradate: 200,
  fruttiRimossi: 5000,                 // kg
  operai: ["user-1"],
  oreImpiegate: 6.0,
  note: "..."
}
```

### Integrazioni

- **Con Terreni**: Filtraggio automatico terreni con coltura "Frutteto"
- **Con Lavori**: Tipi lavoro specifici (potatura, raccolta, diradamento, trattamenti)
- **Con Manodopera**: Calcolo compensi raccolta, ore potatura/diradamento
- **Con Parco Macchine**: Macchine per trattamenti, raccolta meccanica
- **Con Statistiche**: Report produzione, rese, costi

---

## 🫒 Modulo Oliveto - Contenuto Specifico

### Anagrafica Oliveto - Campi Specifici

Oltre ai campi comuni, l'oliveto ha:

| Campo | Tipo | Descrizione | Esempio |
|-------|------|-------------|---------|
| `varieta` | array | Array varietà (oliveto può avere più varietà) | ["Frantoio", "Leccino"] |
| `densitaPiante` | number | Densità piante/ha (alias di `densita`) | 200 |
| `distanzaPiante` | number | Distanza tra piante (alias di `distanzaUnita`) | 5.0 |
| `sistemaAllevamento` | string | Sistema allevamento (alias di `formaAllevamento`) | "vaso", "monocono" |
| `pianteTotali` | number | Numero totale piante (calcolabile) | 800 |
| `resaOlioMedia` | number | Resa olio media storica (%) | 15.0 |
| `frantoioPreferito` | string | Frantoio di riferimento | "Frantoio Rossi" |
| `metodoRaccoltaPreferito` | string | Metodo raccolta: "manuale" \| "meccanica" \| "abbacchiatura" | "manuale" |

### Sub-Collections Specifiche

#### 1. Raccolte Olive
```
tenants/{tenantId}/oliveti/{olivetoId}/raccolte/{raccoltaId}
{
  data: Timestamp,
  varieta: "Frantoio",
  quantitaKg: 8000,
  quantitaEttari: 4.0,
  resaKgHa: 2000,
  
  // Metodo raccolta
  metodoRaccolta: "manuale" | "meccanica" | "abbacchiatura",
  
  // Operazioni
  operai: ["user-1", "user-2"],
  macchine: ["macchina-1"],            // Se raccolta meccanica
  oreImpiegate: 50.0,
  
  // Costi
  costoManodopera: 1000.0,
  costoMacchine: 250.0,                 // Se raccolta meccanica
  costoTotale: 1250.0,
  
  note: "..."
}
```

#### 2. Moliture
```
tenants/{tenantId}/oliveti/{olivetoId}/moliture/{molituraId}
{
  data: Timestamp,
  frantoio: "Frantoio Rossi",
  
  // Quantità
  quantitaOliveKg: 8000,
  quantitaOlioLitri: 1200,
  resaOlio: 15.0,                       // % (calcolato)
  
  // Qualità olio
  acidita: 0.3,                         // %
  numeroPerossidi: 8,
  classificazione: "extravergine",
  
  // Costi
  costoMolitura: 400.0,                 // Costo frantoio (€)
  costoTrasporto: 50.0,                  // Costo trasporto (€)
  costoTotale: 450.0,
  
  // Ricavi
  prezzoVendita: 12.0,                   // €/litro
  ricavo: 14400.0,                      // Calcolato
  
  note: "..."
}
```

### Funzionalità Principali

#### 1. Gestione Oliveti
- **Anagrafica Oliveti**:
  - Varietà (Frantoio, Leccino, Moraiolo, ecc.)
  - Annata impianto
  - Portainnesto
  - Sistema di allevamento (vaso, monocono, ecc.)
  - Densità piante (piante/ha)
  - Distanza tra file e tra piante

- **Zone Oliveto**:
  - Suddivisione per parcella/blocco
  - Mappatura piante sulla mappa terreno
  - Tracciamento zone per lavorazione

#### 2. Gestione Raccolta Olive
- **Pianificazione Raccolta**:
  - Data prevista raccolta
  - Priorità raccolta (per varietà/maturazione)
  - Quantità prevista (kg/ettaro)
  - Metodo raccolta (manuale, meccanica, abbacchiatura)

- **Raccolta Olive**:
  - Registrazione data raccolta
  - Quantità raccolta per varietà/parcella
  - Metodo raccolta utilizzato
  - Operai coinvolti
  - Macchine utilizzate (se raccolta meccanica)

- **Calcolo Compensi Raccolta**:
  - Tariffe per kg raccolto
  - Tariffe per ora
  - Calcolo automatico compensi operai

#### 3. Gestione Potatura
- **Tipi Potatura**:
  - Potatura di produzione
  - Potatura di rinnovo
  - Potatura di ringiovanimento
  - Potatura verde (estiva)

- **Tracciamento Potatura**:
  - Data potatura per parcella
  - Piante potate
  - Operai coinvolti
  - Tempo impiegato

#### 4. Gestione Trattamenti
- **Piano Trattamenti**:
  - Calendario trattamenti (antifungini, insetticidi, ecc.)
  - Prodotti utilizzati
  - Dosaggi
  - Intervalli tra trattamenti
  - Intervalli di sicurezza (giorni prima raccolta)

- **Registro Trattamenti**:
  - Data trattamento
  - Prodotto utilizzato
  - Dosaggio applicato
  - Condizioni meteo
  - Operatore che ha eseguito

#### 5. Produzione Olio
- **Frantoio**:
  - Nome frantoio
  - Data molitura
  - Quantità olive portate (kg)
  - Quantità olio prodotto (litri)
  - Resa olio (%)
  - Qualità olio (acidità, perossidi, ecc.)

- **Tracciamento Qualità**:
  - Acidità olio (%)
  - Numero perossidi
  - Analisi sensoriale
  - Classificazione (extravergine, vergine, ecc.)

#### 6. Rese e Produzione
- **Rese per Varietà**:
  - Resa media (kg/ettaro) per varietà
  - Resa olio (%)
  - Confronto annate
  - Grafici produzione nel tempo

- **Qualità Olio**:
  - Acidità
  - Numero perossidi
  - Tracciamento per lotto

#### 7. Report e Statistiche
- **Report Raccolta**:
  - Totale kg olive raccolte per varietà
  - Resa media per ettaro
  - Costi manodopera raccolta
  - Confronto con anni precedenti

- **Report Produzione Olio**:
  - Totale litri olio prodotto
  - Resa olio (%)
  - Qualità olio
  - Costi molitura

- **Statistiche Trattamenti**:
  - Numero trattamenti per stagione
  - Costi prodotti fitosanitari
  - Rispetto intervalli sicurezza

### Struttura Dati

```
tenants/{tenantId}/oliveti/{olivetoId}
{
  terrenoId: "terreno-123",
  varieta: ["Frantoio", "Leccino"],
  annataImpianto: 2010,
  portainnesto: "selvatico",
  sistemaAllevamento: "vaso",
  densitaPiante: 200,                  // piante/ha
  distanzaFile: 6.0,                   // metri
  distanzaPiante: 5.0,                 // metri
  note: "..."
}

tenants/{tenantId}/oliveti/{olivetoId}/raccolte/{raccoltaId}
{
  data: Timestamp,
  varieta: "Frantoio",
  quantitaKg: 8000,
  quantitaEttari: 4.0,
  resaKgHa: 2000,
  metodoRaccolta: "manuale" | "meccanica" | "abbacchiatura",
  operai: ["user-1", "user-2"],
  macchine: ["macchina-1"],
  note: "..."
}

tenants/{tenantId}/oliveti/{olivetoId}/moliture/{molituraId}
{
  data: Timestamp,
  frantoio: "Frantoio Rossi",
  quantitaOliveKg: 8000,
  quantitaOlioLitri: 1200,
  resaOlio: 15.0,                      // %
  acidita: 0.3,                        // %
  numeroPerossidi: 8,
  classificazione: "extravergine",
  note: "..."
}
```

### Integrazioni

- **Con Terreni**: Filtraggio automatico terreni con coltura "Olivo"
- **Con Lavori**: Tipi lavoro specifici (potatura, raccolta, trattamenti)
- **Con Manodopera**: Calcolo compensi raccolta, ore potatura
- **Con Parco Macchine**: Macchine per trattamenti, raccolta meccanica
- **Con Statistiche**: Report produzione, rese olio, costi

---

## 🔄 Riutilizzo Codice: Servizi e Componenti Comuni

### Servizi Base Comuni (Riutilizzabili)

#### 1. `coltura-base-service.js` (Servizio Base)

Servizio comune per operazioni CRUD base su tutte le colture specializzate:

**Funzioni comuni**:
- `createColtura(colturaData, createdBy)` - Crea anagrafica
- `updateColtura(colturaId, updates)` - Aggiorna anagrafica
- `deleteColtura(colturaId)` - Elimina anagrafica
- `getColtura(colturaId)` - Recupera anagrafica
- `getAllColture(options)` - Lista tutte le anagrafiche
- `calcolaRese(colturaId, anno)` - Calcola rese da raccolte
- `calcolaCosti(colturaId, anno)` - Calcola costi totali
- `calcolaMargini(colturaId, anno)` - Calcola margini

**Uso**:
```javascript
// Vigneto estende servizio base
import { ColturaBaseService } from '../shared/services/coltura-base-service.js';

export class VignetoService extends ColturaBaseService {
  constructor() {
    super('vigneti'); // Collection name
  }
  
  // Aggiunge funzioni specifiche vigneto
  async createVendemmia(vignetoId, vendemmiaData) { ... }
  async getVendemmie(vignetoId, anno) { ... }
}
```

#### 2. `potatura-service.js` (Servizio Comune)

Servizio comune per gestione potature (uguale per tutti i moduli):

**Funzioni**:
- `createPotatura(colturaId, potaturaData)` - Crea potatura
- `getPotature(colturaId, options)` - Lista potature
- `calcolaCostoPotatura(potaturaId)` - Calcola costo potatura
- `getStatistichePotatura(colturaId, anno)` - Statistiche potature

**Uso**:
```javascript
// Tutti i moduli usano lo stesso servizio
import { PotaturaService } from '../shared/services/potatura-service.js';

const potaturaService = new PotaturaService('vigneti'); // o 'frutteti', 'oliveti'
await potaturaService.createPotatura(vignetoId, { ... });
```

#### 3. `trattamento-service.js` (Servizio Comune)

Servizio comune per gestione trattamenti (uguale per tutti i moduli):

**Funzioni**:
- `createTrattamento(colturaId, trattamentoData)` - Crea trattamento
- `getTrattamenti(colturaId, options)` - Lista trattamenti
- `calcolaCostoTrattamento(trattamentoId)` - Calcola costo trattamento
- `getStatisticheTrattamenti(colturaId, anno)` - Statistiche trattamenti
- `getProssimiTrattamenti(colturaId)` - Prossimi trattamenti programmati

#### 4. `raccolta-service.js` (Servizio Base con Estensioni)

Servizio base per raccolte, esteso da ogni modulo:

**Funzioni base comuni**:
- `createRaccolta(colturaId, raccoltaData)` - Crea raccolta
- `getRaccolte(colturaId, options)` - Lista raccolte
- `calcolaResaRaccolta(raccoltaId)` - Calcola resa raccolta
- `calcolaCostoRaccolta(raccoltaId)` - Calcola costo raccolta

**Estensioni specifiche**:
- **Vigneto**: `createVendemmia()` - Aggiunge campi qualità uva
- **Frutteto**: `createRaccoltaFrutta()` - Aggiunge campi qualità frutta
- **Oliveto**: `createRaccoltaOlive()` - Aggiunge metodo raccolta

#### 5. `statistiche-coltura-service.js` (Servizio Comune)

Servizio comune per calcolo statistiche e report:

**Funzioni**:
- `calcolaReseAnno(colturaId, anno)` - Calcola rese anno
- `calcolaCostiAnno(colturaId, anno)` - Calcola costi anno
- `calcolaMarginiAnno(colturaId, anno)` - Calcola margini anno
- `getTrendRese(colturaId, anni)` - Trend rese ultimi N anni
- `getConfrontoAnnate(colturaId, anni)` - Confronto annate
- `getReportCompleto(colturaId, anno)` - Report completo anno

### Componenti UI Comuni (Riutilizzabili)

#### 1. Form Anagrafica Impianto

Componente form comune per anagrafica (stesso form per tutti i moduli, con campi dinamici):

**Campi comuni**:
- Terreno (dropdown)
- Varietà (input/array)
- Annata impianto
- Portainnesto
- Densità
- Forma allevamento
- Tipo impianto
- Distanze (file, unità)
- Orientamento filari
- Superficie ettari
- Note

**Campi specifici** (mostrati dinamicamente):
- Vigneto: destinazione uva, cantina
- Frutteto: specie, calibro medio
- Oliveto: frantoio preferito, metodo raccolta

#### 2. Tabella Rese e Produzione

Componente comune per visualizzare rese:

- Grafico trend rese
- Tabella rese per varietà/specie
- Confronto annate
- Statistiche aggregate

#### 3. Tabella Spese e Costi

Componente comune per visualizzare spese:

- Breakdown spese (manodopera, trattamenti, potatura, raccolta, altro)
- Grafico costi per categoria
- Calcolo margini
- ROI

#### 4. Calendario Trattamenti

Componente comune per calendario trattamenti:

- Visualizzazione calendario
- Alert prossimi trattamenti
- Intervalli di sicurezza
- Storico trattamenti

### Struttura File Proposta (Con Riutilizzo)

```
modules/
├── shared/                                    # Componenti comuni
│   ├── services/
│   │   ├── coltura-base-service.js           # Servizio base CRUD
│   │   ├── potatura-service.js               # Servizio potature (comune)
│   │   ├── trattamento-service.js            # Servizio trattamenti (comune)
│   │   ├── raccolta-base-service.js          # Servizio base raccolte
│   │   └── statistiche-coltura-service.js      # Servizio statistiche (comune)
│   ├── components/
│   │   ├── form-anagrafica-impianto.js       # Form anagrafica comune
│   │   ├── tabella-rese.js                   # Tabella rese comune
│   │   ├── tabella-spese.js                  # Tabella spese comune
│   │   └── calendario-trattamenti.js        # Calendario comune
│   └── models/
│       └── ColturaBase.js                    # Modello base comune
│
├── vigneto/
│   ├── models/
│   │   ├── Vigneto.js                        # Estende ColturaBase
│   │   ├── Vendemmia.js                     # Specifico vigneto
│   │   └── DiradamentoVigneto.js            # Specifico vigneto
│   ├── services/
│   │   ├── vigneti-service.js               # Estende coltura-base-service
│   │   ├── vendemmia-service.js             # Estende raccolta-base-service
│   │   └── diradamento-vigneto-service.js    # Estende diradamento-service
│   └── views/
│       ├── vigneti-standalone.html          # Usa form-anagrafica-impianto
│       ├── vendemmia-standalone.html
│       ├── vigneto-dashboard-standalone.html # Dashboard dedicata
│       └── vigneto-statistiche-standalone.html # Statistiche dedicate
│       # Note: potatura-vigneto-standalone.html e trattamenti-vigneto-standalone.html NON NECESSARIE
│       # - Potatura: dati già nel sistema Lavori/Diario
│       # - Trattamenti: rimandati a modulo Trattamenti dedicato futuro
│
├── frutteto/
│   ├── models/
│   │   ├── Frutteto.js                       # Estende ColturaBase
│   │   └── Diradamento.js                   # Specifico frutteto
│   ├── services/
│   │   ├── frutteti-service.js               # Estende coltura-base-service
│   │   └── diradamento-service.js            # Specifico frutteto
│   └── views/
│       ├── frutteti-standalone.html          # Usa form-anagrafica-impianto
│       └── diradamento-standalone.html
│
└── oliveto/
    ├── models/
    │   ├── Oliveto.js                        # Estende ColturaBase
    │   └── Molitura.js                       # Specifico oliveto
    ├── services/
    │   ├── oliveti-service.js                # Estende coltura-base-service
    │   └── molitura-service.js               # Specifico oliveto
    └── views/
        ├── oliveti-standalone.html           # Usa form-anagrafica-impianto
        └── molitura-standalone.html
```

### Vantaggi Riutilizzo Codice

1. **Sviluppo più veloce**: 
   - Servizi comuni sviluppati una volta
   - Moduli successivi più veloci (riutilizzano codice)

2. **Manutenzione semplificata**:
   - Bug fix in servizi comuni → tutti i moduli beneficiari
   - Aggiornamenti funzionalità comuni → tutti i moduli aggiornati

3. **Consistenza**:
   - Stessa logica per tutti i moduli
   - Stessa UX per funzionalità comuni

4. **Test semplificati**:
   - Test servizi comuni una volta
   - Test specifici solo per funzionalità uniche

### Stima Risparmio Sviluppo

- **Senza riutilizzo**: ~6-8 settimane per 3 moduli
- **Con riutilizzo**: ~4-5 settimane per 3 moduli
- **Risparmio**: ~30-40% tempo sviluppo

---

## 🗺️ Pianificazione Nuovi Impianti con Reticolato

### Funzionalità: Reticolato Sovrapponibile sulla Mappa

**Obiettivo**: Permettere di pianificare nuovi impianti sovrapponendo un reticolato direzionabile e dimensionabile sulla mappa del terreno, per calcolare automaticamente file, pali, piante, fili, ecc.

### Flusso Utente (Riepilogo)

**Passo 1**: Utente seleziona **terreno già censito** nell'app (con poligono mappato)

**Passo 2**: Utente clicca **"Pianifica Nuovo Impianto"** nella pagina anagrafica coltura

**Passo 3**: Si apre mappa con:
- Poligono terreno visualizzato
- Reticolato sovrapposto (ruotabile e configurabile)

**Passo 4**: Utente configura parametri (ordine ottimizzato 2026-01-22):
- **Angolo rotazione** reticolato (gradi) - per allineare con orientamento ottimale
- **Larghezza carraie** (metri):
  - Classificazione automatica (principali/laterali)
  - Pulsanti selezione rapida (Principali 6m, Laterali 4m, Configurazione Tipica)
- **Sesto di impianto**:
  - Distanza tra file (metri)
  - Distanza tra unità nella fila (metri)

**Passo 5**: Sistema calcola automaticamente in tempo reale:
- Numero file
- Numero totale piante/ceppi
- Numero pali necessari
- Lunghezza fili necessari
- Altri materiali (supporti, legacci, ecc.)
- Superficie netta impianto (esclusa carraie)
- Densità effettiva

**Passo 6**: Utente può:
- Ruotare reticolato per trovare orientamento ottimale
- Modificare parametri e vedere calcoli aggiornati
- Salvare configurazione pianificata
- Esportare calcoli (PDF/Excel)

**Risultato**: Dati precisi per pianificazione impianto (pali, piante, fili, materiali, costi stimati)

### Fattibilità Tecnica

✅ **FATTIBILE** - Il sistema già usa Google Maps API con:
- Poligoni per terreni (`google.maps.Polygon`)
- Geometry Library per calcoli
- Overlay personalizzati possibili

### Funzionalità Proposte

#### 1. Reticolato Interattivo sulla Mappa

**Caratteristiche**:
- **Sovrapposizione**: Reticolato visualizzato sopra il poligono terreno
- **Direzionabile**: Rotazione reticolato (angolo filari)
- **Dimensionabile**: Distanza tra file e tra unità (ceppi/piante) configurabile
- **Interattivo**: Drag & drop, rotazione con mouse/touch
- **Visualizzazione**: Linee reticolato visibili, colori personalizzabili
- **Carraie visibili**: Zone carraie evidenziate con colore diverso (es. grigio/beige)

**Parametri Configurabili** (ordine ottimizzato 2026-01-22):
- Angolo rotazione reticolato (gradi)
- **Larghezza carraie** (metri) - Strade di servizio intorno all'impianto
  - Classificazione automatica (principali/laterali) basata su orientamento
  - Pulsanti selezione rapida (Principali 6m, Laterali 4m, Configurazione Tipica)
  - Verifica punto interno/esterno per offset corretto (2026-01-22)
- Distanza tra file (metri)
- Distanza tra unità nella fila (metri)
- Offset iniziale (per allineare con confini terreno)
  - Classificazione automatica (principali/laterali) basata su orientamento
  - Pulsanti selezione rapida (Principali 6m, Laterali 4m, Configurazione Tipica)
  - Verifica punto interno/esterno per offset corretto (2026-01-22)

#### 1.1. Gestione Carraie (Strade di Servizio)

**Definizione**: Le carraie sono le strade di servizio necessarie per l'accesso con macchine agricole (trattori, raccoglitrici, ecc.) intorno e all'interno dell'impianto.

**Caratteristiche Carraie**:
- **Posizione**: Intorno al perimetro del terreno (carraie perimetrali)
- **Classificazione automatica** (2026-01-22): Principali (perpendicolari ai filari, tipicamente 6m) e Laterali (parallele ai filari, tipicamente 4m)
- **Larghezza configurabile**: Tipicamente 2.5-6.0 metri (dipende da tipo carraia e macchine utilizzate)
- **Visualizzazione**: Zone evidenziate sulla mappa con colore diverso dal reticolato (arancione per principali, azzurro per laterali)
- **Verifica offset** (2026-01-22): Sistema automatico verifica punto interno/esterno per garantire carraie sempre all'interno
- **Sottrazione superficie**: La superficie carraie viene sottratta dal calcolo superficie netta impianto

**Calcolo Carraie**:
- **Carraie perimetrali**: Perimetro terreno × larghezza carraia
- **Carraie interne** (opzionale, fase avanzata): Carraie trasversali per accesso interno
- **Superficie totale carraie**: Somma carraie perimetrali + carraie interne

**Impatto Calcoli**:
- **Superficie netta impianto** = Superficie totale terreno - Superficie carraie
- **Numero unità effettive** = Calcolato solo sulla superficie netta (esclusa area carraie)
- **Densità effettiva** = Numero unità / Superficie netta (più precisa della densità lorda)

#### 2. Calcoli Automatici

**Calcoli in tempo reale**:
- **Numero file**: Calcolo file che attraversano il poligono terreno (esclusa area carraie)
- **Numero unità per fila**: Calcolo ceppi/piante per fila (esclusa superficie carraie)
- **Numero totale unità**: Calcolo totale ceppi/piante nell'impianto (esclusa superficie carraie)
- **Numero pali**: Calcolo pali necessari (con distanza pali configurabile)
  - Pali per fila: (lunghezza fila netta / distanza pali) + 2 (pali testata)
  - Totale pali: somma pali per tutte le file
- **Lunghezza fili**: Calcolo lunghezza fili necessari
  - Fili portanti: numero file × lunghezza fila netta × numero fili per fila
  - Fili di legatura: calcolo basato su numero unità
- **Altri materiali**:
  - Supporti/legacci (se necessari)
  - Ganci/fermaglie (se necessari)
- **Lunghezza filari**: Calcolo lunghezza totale filari (esclusa lunghezza carraie)
- **Superficie carraie**: Superficie totale occupata dalle carraie
- **Superficie netta impianto**: Superficie coperta dal reticolato meno carraie
- **Superficie lorda**: Superficie totale terreno
- **Densità effettiva**: Densità calcolata (unità/ha) basata su superficie netta

**Formule di calcolo**:
```
// Calcolo file
Numero file = (larghezza terreno / distanza file) × cos(angolo)

// Calcolo superficie carraie
Superficie carraie = (perimetro terreno × larghezza carraia) + (carraie interne)
Superficie netta impianto = superficie totale - superficie carraie

// Calcolo unità (piante/ceppi)
Lunghezza fila netta = lunghezza fila - (larghezza carraia × 2) // Carraie ai lati
Numero unità per fila = (lunghezza fila netta / distanza unità)
Numero totale unità = somma(unità per fila) per tutte le file

// Calcolo pali
Pali per fila = (lunghezza fila netta / distanza pali) + 2 // Pali testata
Numero totale pali = somma(pali per fila) per tutte le file

// Calcolo fili
Lunghezza fili portanti = numero file × lunghezza fila netta × numero fili per fila
Lunghezza fili di legatura = numero totale unità × lunghezza media legatura

// Densità
Densità effettiva = numero totale unità / superficie netta impianto
```

#### 3. Interfaccia Utente

**Pannello Controllo Reticolato**:
- **Parametri Impianto**:
  - Distanza tra file (metri)
  - Distanza tra unità (metri)
  - Angolo rotazione (gradi) - slider o input
  - Distanza pali (metri) - per calcolo pali
  - **Larghezza carraie (metri)** - Strade di servizio intorno all'impianto

- **Visualizzazione**:
  - Toggle mostra/nascondi reticolato
  - Colore linee reticolato
  - Spessore linee
  - Opacità

- **Calcoli Visualizzati**:
  - Numero file
  - Numero totale unità (ceppi/piante) - **esclusa superficie carraie**
  - Numero pali
  - Lunghezza filari totale (netta)
  - **Superficie carraie** (ha)
  - **Superficie netta impianto** (ha) - totale meno carraie
  - Superficie lorda (ha) - totale terreno
  - Densità effettiva (unità/ha) - basata su superficie netta

- **Azioni**:
  - Salva configurazione reticolato
  - Esporta calcoli (PDF/Excel)
  - Reset parametri

#### 4. Integrazione con Anagrafica Impianto

**Flusso**:
1. Utente seleziona terreno mappato
2. Clicca "Pianifica Nuovo Impianto"
3. Si apre mappa con poligono terreno + reticolato sovrapposto
4. Utente configura parametri reticolato
5. Sistema calcola automaticamente file, unità, pali
6. Utente salva configurazione
7. Sistema crea anagrafica impianto con dati calcolati

**Dati salvati**:
- Parametri reticolato (distanze, angolo)
- Calcoli (file, unità, pali)
- Coordinate reticolato (per visualizzazione futura)

### Struttura Dati Proposta

```
tenants/{tenantId}/pianificazioni-impianti/{pianificazioneId}
{
  terrenoId: "terreno-123",
  tipoColtura: "vigneto" | "frutteto" | "oliveto",
  
  // Parametri reticolato
  distanzaFile: 2.5,                    // metri
  distanzaUnita: 0.8,                   // metri
  angoloRotazione: 15,                  // gradi
  distanzaPali: 5.0,                    // metri (opzionale)
  larghezzaCarraie: 3.0,                // metri - Strade di servizio
  
  // Calcoli automatici
  numeroFile: 120,
  numeroUnitaTotale: 58000,             // Esclusa superficie carraie
  numeroPali: 1450,
  lunghezzaFiliPortanti: 14400,         // metri (2 fili per fila × 120 file × 60m)
  lunghezzaFiliLegatura: 11600,         // metri (stima)
  lunghezzaFilariTotale: 7200,          // metri (netta, esclusa carraie)
  superficieCarraie: 0.15,              // ettari
  superficieNettaImpianto: 2.85,         // ettari (totale - carraie)
  superficieLorda: 3.0,                 // ettari (totale terreno)
  densitaEffettiva: 5200,                // unità/ha (basata su superficie netta)
  
  // Materiali aggiuntivi (opzionale, calcolati se necessario)
  numeroSupporti: 0,                    // Se necessari
  numeroLegacci: 58000,                 // Uno per unità
  numeroGanci: 0                        // Se necessari
  
  // Coordinate reticolato (per visualizzazione)
  reticolatoCoords: [
    { file: 1, start: {lat, lng}, end: {lat, lng} },
    { file: 2, start: {lat, lng}, end: {lat, lng} },
    // ...
  ],
  
  // Stato
  stato: "bozza" | "confermato" | "impiantato",
  dataCreazione: Timestamp,
  dataConferma: Timestamp,
  creatoDa: "user-123"
}
```

### Implementazione Tecnica

#### 1. Overlay Reticolato su Google Maps

**Approccio**:
- Usare `google.maps.OverlayView` per creare overlay personalizzato
- Disegnare linee reticolato usando Canvas o SVG
- **Disegnare carraie** come zone rettangolari intorno al perimetro terreno
- Calcolare intersezioni reticolato con poligono terreno (esclusa area carraie)
- Aggiornare calcoli in tempo reale quando parametri cambiano

**Librerie Utili**:
- Google Maps Geometry Library (già presente)
- Calcoli geometrici per intersezioni reticolato/poligono

#### 2. Calcoli Geometrici

**Algoritmi necessari**:
- **Intersezione retta/poligono**: Per calcolare file che attraversano terreno
- **Creazione poligono carraie**: Generare poligono carraie perimetrali (offset interno dal perimetro terreno)
- **Sottrazione area carraie**: Creare poligono "terreno meno carraie" per calcoli netti
- **Intersezione reticolato/poligono netto**: Calcolare file che attraversano solo area netta (esclusa carraie)
- **Lunghezza segmento interno**: Per calcolare lunghezza filari dentro poligono netto (esclusa area carraie)
- **Conteggio unità**: Dividere lunghezza filare netta per distanza unità
- **Rotazione reticolato**: Trasformazione coordinate con angolo
- **Calcolo superficie carraie**: Area perimetro terreno × larghezza carraia + eventuali carraie interne
- **Calcolo perimetro terreno**: Per calcolo preciso superficie carraie perimetrali

#### 3. Performance

**Ottimizzazioni**:
- Calcoli solo quando parametri cambiano (debounce)
- Cache risultati calcoli
- Rendering reticolato solo quando visibile
- Limitare numero file visualizzate (zoom out → semplificazione)

### Vantaggi Funzionalità

1. **Pianificazione Preciso**:
   - Visualizzazione immediata layout impianto
   - Calcoli precisi prima di impiantare (inclusa superficie carraie)
   - Evita errori di stima
   - **Considera carraie nella pianificazione** (superficie effettiva disponibile)

2. **Ottimizzazione Costi**:
   - Calcolo preciso materiali (pali, fili, piante, supporti, legacci) - **esclusa superficie carraie**
   - Stima costi più accurata (considera superficie netta)
   - Confronto scenari (diverse distanze, diverse larghezze carraie)
   - **Valutazione impatto carraie** su densità e costi
   - **Lista materiali completa** per preventivo impianto

3. **Documentazione**:
   - Salvataggio configurazione pianificata (inclusa larghezza carraie)
   - Confronto pianificato vs reale
   - Storico modifiche
   - **Tracciamento superficie carraie** per documentazione

4. **Supporto Decisioni**:
   - Testare diverse configurazioni
   - Confrontare densità diverse (con/senza carraie)
   - Valutare orientamento ottimale
   - **Valutare larghezza carraie ottimale** (accesso macchine vs superficie persa)

### Integrazione con Moduli Coltura

**Quando modulo attivo**:
- Link "Pianifica Nuovo Impianto" nella pagina anagrafica
- Reticolato pre-configurato con parametri tipici coltura
- Calcoli specifici per tipo coltura (ceppi vs piante)

**Esempi**:
- **Vigneto**: Reticolato con distanze tipiche vigneto (2.5m file, 0.8m ceppi)
- **Frutteto**: Reticolato con distanze tipiche frutteto (3.5m file, 0.9m piante)
- **Oliveto**: Reticolato con distanze tipiche oliveto (6m file, 5m piante)

### UI/UX Proposta

**Layout**:
```
┌─────────────────────────────────────────┐
│  Mappa Terreno + Reticolato + Carraie   │
│  (Visualizzazione interattiva)          │
│  [Carraie evidenziate in colore diverso]│
│                                         │
│  [Controlli Reticolato]                 │
│  - Distanza file: [2.5] m              │
│  - Distanza unità: [0.8] m             │
│  - Angolo: [15]° [slider]              │
│  - Distanza pali: [5.0] m              │
│  - Larghezza carraie: [3.0] m          │
│                                         │
│  [Calcoli Automatici]                   │
│  - File: 120                           │
│  - Unità totali: 58,000 (netto)       │
│  - Pali: 1,450                         │
│  - Fili portanti: 14,400 m            │
│  - Fili legatura: 11,600 m            │
│  - Lunghezza filari: 7,200 m (netta)  │
│  - Superficie carraie: 0.15 ha         │
│  - Superficie netta: 2.85 ha           │
│  - Superficie lorda: 3.00 ha           │
│  - Densità: 5,200 unità/ha (netta)    │
│                                         │
│  [Azioni]                               │
│  [Salva] [Esporta] [Reset]             │
└─────────────────────────────────────────┘
```

### Fasi di Implementazione

**Fase 1: MVP** (2-3 settimane)
- Reticolato base (linee parallele, no rotazione)
- **Carraie base** (perimetro terreno, larghezza configurabile)
- Calcoli base (file, unità, superficie netta/lorda)
- Salvataggio configurazione

**Fase 2: Avanzato** (2 settimane)
- Rotazione reticolato
- **Carraie avanzate** (carraie interne configurabili, visualizzazione migliorata)
- Calcolo pali
- **Calcoli avanzati carraie** (superficie dettagliata, impatto densità)
- Esportazione calcoli

**Fase 3: Ottimizzazioni** (1 settimana)
- Performance rendering
- UI migliorata
- Integrazione completa moduli

---

## 💡 Suggerimenti Funzionalità Aggiuntive

### 1. Stima Costi Impianto (Alto Valore)

**Funzionalità**: Calcolo automatico costi totali impianto basato su materiali e prezzi configurabili.

**Implementazione**:
- Database prezzi materiali configurabile per tenant
- Calcolo automatico: `quantità × prezzo unitario` per ogni materiale
- Totale costi materiali
- Costi manodopera impianto (stima giorni/uomini)
- Costo totale impianto

**Vantaggi**:
- Preventivo automatico per nuovo impianto
- Confronto costi tra scenari diversi
- Budget planning preciso
- Integrazione con sistema preventivi esistente (modulo conto-terzi)

**Struttura dati**:
```
tenants/{tenantId}/prezzi-materiali/{materialeId}
{
  nome: "Palo vite 2.5m",
  categoria: "pali",
  prezzoUnitario: 3.50,              // €
  unitaMisura: "pezzo",
  fornitore: "Fornitore X"           // Opzionale
}

// Nella pianificazione
costiMateriali: {
  pali: { quantita: 1450, prezzoUnitario: 3.50, totale: 5075.0 },
  fili: { quantita: 14400, prezzoUnitario: 0.15, totale: 2160.0 },
  piante: { quantita: 58000, prezzoUnitario: 2.00, totale: 116000.0 },
  // ...
},
costoTotaleMateriali: 125235.0,
costoManodoperaImpianto: 5000.0,      // Stima
costoTotaleImpianto: 130235.0
```

### 2. Template Sesti di Impianto Predefiniti (Media Priorità)

**Funzionalità**: Template predefiniti con sesti tipici per ogni coltura.

**Implementazione**:
- Database template sesti per coltura
- Selezione template → pre-compila parametri
- Possibilità di modificare e salvare come nuovo template

**Template esempio**:
```
Template "Vigneto Tradizionale":
- Distanza file: 2.5m
- Distanza ceppi: 0.8m
- Larghezza carraie: 3.0m
- Densità: ~5000 ceppi/ha

Template "Vigneto Intensivo":
- Distanza file: 2.0m
- Distanza ceppi: 0.7m
- Larghezza carraie: 3.0m
- Densità: ~7000 ceppi/ha
```

**Vantaggi**:
- Velocizza pianificazione (non inserire parametri da zero)
- Standardizzazione (sesti testati e validati)
- Guida utenti meno esperti

### 3. Confronto Scenari (Media Priorità)

**Funzionalità**: Salvare più versioni di pianificazione e confrontarle.

**Implementazione**:
- Salvataggio multiplo configurazioni (scenario A, B, C)
- Tabella confronto: materiali, costi, densità, superficie
- Visualizzazione grafica differenze
- Selezione scenario ottimale

**Vantaggi**:
- Valutare diverse opzioni prima di decidere
- Confronto costi/benefici tra scenari
- Documentazione decisioni

**UI proposta**:
```
┌─────────────────────────────────────────┐
│  Confronto Scenari                      │
│                                         │
│  Scenario A  Scenario B  Scenario C    │
│  ─────────  ─────────  ─────────       │
│  File: 120    File: 150   File: 100    │
│  Unità: 58k   Unità: 60k  Unità: 55k   │
│  Costo: 130k  Costo: 140k Costo: 125k  │
│  Densità: 5.2k Densità: 5.5k Densità: 5.0k│
│                                         │
│  [Seleziona Scenario Ottimale]        │
└─────────────────────────────────────────┘
```

### 4. Esportazione Preventivo PDF/Excel (Alto Valore)

**Funzionalità**: Esportare lista materiali e costi in formato PDF o Excel.

**Contenuto esportazione**:
- Dettaglio materiali (quantità, prezzo unitario, totale)
- Costi totali
- Parametri impianto (sesto, carraie, superficie)
- Calcoli (file, unità, pali, fili)
- Mappa terreno (opzionale, screenshot)

**Vantaggi**:
- Condivisione con fornitori
- Documentazione ufficiale
- Richiesta preventivi a fornitori
- Archiviazione

### 5. Validazione Parametri (Bassa Priorità)

**Funzionalità**: Alert se parametri non realistici o fuori range tipici.

**Validazioni**:
- Densità troppo alta/bassa per coltura
- Distanze file troppo strette/larghe
- Larghezza carraie insufficiente per macchine
- Angolo rotazione estremo

**Vantaggi**:
- Evita errori di configurazione
- Guida utenti meno esperti
- Suggerimenti miglioramenti

### 6. Integrazione Lavori Impianto con Creazione Automatica Vigneti ✅ **IMPLEMENTATO (2026-01-24)**

**Funzionalità**: Creare automaticamente vigneti quando si crea un lavoro di tipo "Impianto Nuovo Vigneto" con una pianificazione confermata.

**Implementazione**:
- ✅ Tipi lavoro predefiniti: "Impianto Nuovo Vigneto", "Impianto Nuovo Frutteto", "Impianto Nuovo Oliveto"
- ✅ Sottocategoria "Impianto" nella categoria "Semina e Piantagione"
- ✅ Form vigneto integrato nel form creazione lavori
- ✅ Dropdown pianificazioni confermate (filtro per tipo coltura)
- ✅ Pre-compilazione automatica form vigneto da pianificazione:
  - Distanze (file, unità) - readonly
  - Superficie (Ha) - formattata 2 decimali, readonly
  - Densità (ceppi/ha) - formattata intero, readonly
  - Forma allevamento - selezionata dalla pianificazione
- ✅ Campi compilabili: varietà (dropdown), anno, portainnesto (dropdown), tipo palo, destinazione uva, note
- ✅ Creazione automatica vigneto al salvataggio lavoro
- ✅ Collegamento `Lavoro.pianificazioneId` → `PianificazioneImpianto.id`

**Flusso Completo**:
1. Manager crea pianificazione → stato "BOZZA"
2. Manager conferma pianificazione → stato "CONFERMATO"
3. Manager crea lavoro → tipo "Impianto Nuovo Vigneto"
4. Sistema mostra dropdown → seleziona pianificazione confermata
5. Sistema pre-compila form vigneto → dati dalla pianificazione
6. Manager completa campi → varietà, anno, tipo palo, destinazione
7. Manager salva lavoro → sistema crea lavoro + vigneto automaticamente

**Vantaggi**:
- ✅ Workflow completo: Pianificazione → Conferma → Lavoro → Vigneto automatico
- ✅ Riduzione errori manuali con pre-compilazione automatica
- ✅ Coerenza dati tra pianificazione, lavoro e vigneto
- ✅ Integrazione seamless tra moduli

**File Modificati**:
- `core/services/categorie-service.js` - Sottocategoria "Impianto"
- `core/services/tipi-lavoro-service.js` - Tipi lavoro predefiniti
- `core/admin/gestione-lavori-standalone.html` - Form vigneto integrato
- `core/admin/js/gestione-lavori-events.js` - Creazione automatica vigneto
- `core/models/Lavoro.js` - Campo `pianificazioneId`
- `modules/vigneto/views/vigneti-standalone.html` - Fix errore FORME_ALLEVAMENTO_PREDEFINITE

**Riferimento**: Vedi `RIEPILOGO_LAVORI_2026-01-24.md` per dettagli completi.

---

### 7. Tracciamento Realizzazione (Media Priorità)

**Funzionalità**: Confronto pianificato vs reale dopo impianto.

**Implementazione**:
- Quando impianto è "impiantato", possibilità di inserire dati reali
- Confronto: pianificato vs reale
- Scostamenti evidenziati
- Storico modifiche

**Vantaggi**:
- Verifica accuratezza pianificazione
- Miglioramento future pianificazioni
- Documentazione realizzazione

**Dati confronto**:
```
Pianificato    Reale      Scostamento
─────────────────────────────────────
File: 120      File: 118  -2 file
Unità: 58,000  Unità: 57,500 -500 unità
Costo: 130k    Costo: 128k   -2k €
```

### 7. Calcolo Tempi Impianto (Bassa Priorità)

**Funzionalità**: Stima giorni/uomini necessari per realizzare impianto.

**Calcoli**:
- Tempo per unità (es. 2 minuti/pianta)
- Tempo totale: `numero unità × tempo per unità`
- Giorni/uomini: `tempo totale / (ore giorno × numero uomini)`
- Costi manodopera: `giorni × uomini × tariffa oraria`

**Vantaggi**:
- Pianificazione temporale impianto
- Stima costi manodopera
- Coordinamento risorse

### 8. Integrazione Calendario (Bassa Priorità)

**Funzionalità**: Pianificazione temporale impianto nel calendario.

**Implementazione**:
- Data inizio/fine prevista impianto
- Fasi impianto (preparazione terreno, posa pali, impianto piante, ecc.)
- Visualizzazione calendario
- Alert scadenze

**Vantaggi**:
- Pianificazione temporale
- Coordinamento attività
- Rispetto tempistiche

### 9. Import/Export Configurazioni (Bassa Priorità)

**Funzionalità**: Salvare/caricare configurazioni reticolato.

**Implementazione**:
- Export configurazione (JSON)
- Import configurazione
- Condivisione configurazioni tra tenant/utenti
- Libreria configurazioni comuni

**Vantaggi**:
- Backup configurazioni
- Condivisione best practices
- Riutilizzo configurazioni testate

### 10. Ottimizzazione Automatica (Bassa Priorità - Futuro)

**Funzionalità**: Suggerire configurazione ottimale basata su obiettivi.

**Algoritmi**:
- Massimizzare densità (con vincoli)
- Minimizzare costi
- Ottimizzare orientamento (esposizione solare)
- Bilanciare densità/costi

**Vantaggi**:
- Supporto decisioni avanzato
- Ottimizzazione automatica
- Valore aggiunto premium

---

## 🎯 Priorità Suggerimenti

### Alta Priorità (Implementare subito)
1. ✅ **Stima Costi Impianto** - Valore immediato, integrazione con preventivi
2. ✅ **Esportazione PDF/Excel** - Necessario per condivisione con fornitori

### Media Priorità (Implementare dopo MVP)
3. ⚠️ **Template Sesti Predefiniti** - Velocizza pianificazione
4. ⚠️ **Confronto Scenari** - Valore decisionale
5. ⚠️ **Tracciamento Realizzazione** - Miglioramento continuo

### Bassa Priorità (Nice to have)
6. ⏳ **Validazione Parametri** - Utile ma non critico
7. ⏳ **Calcolo Tempi Impianto** - Utile per pianificazione
8. ⏳ **Integrazione Calendario** - Utile ma non essenziale
9. ⏳ **Import/Export Configurazioni** - Utile per avanzati
10. ⏳ **Ottimizzazione Automatica** - Futuro, valore premium

---

## 🔗 Integrazione Pratica nell'App Esistente

### Principio Fondamentale: Non Invasività

**Regola d'oro**: I moduli specializzati per coltura sono **completamente opzionali** e **non modificano** il funzionamento esistente dell'app quando non sono attivi.

### Comportamento: Moduli Attivi vs Non Attivi

#### Quando i Moduli NON sono Attivi

✅ **Tutto continua a funzionare esattamente come prima**:
- Pagine esistenti (Terreni, Lavori, Attività, Statistiche) funzionano normalmente
- Terreni con coltura "Vite", "Frutteto", "Olivo" funzionano normalmente
- Nessuna perdita di funzionalità
- Nessuna modifica al comportamento esistente
- Utenti non vedono differenze

**Esempio**: Un terreno con coltura "Vite" continua a funzionare come qualsiasi altro terreno, senza funzionalità specifiche vigneto.

#### Quando i Moduli SONO Attivi

✅ **Nuove pagine dedicate compaiono automaticamente**:
- Nuove voci nel menu navigazione (es. "Vigneti", "Vendemmia", "Pianifica Impianto")
- Nuove pagine standalone per gestione specifica
- Estensioni alle pagine esistenti (campi aggiuntivi, filtri, sezioni)

✅ **Pagine esistenti si arricchiscono**:
- Dashboard mostra sezioni specifiche (es. "Vendemmia in corso")
- Pagina Terreni mostra pulsante "Gestisci Vigneto" per terreni con Vite
- Pagina Lavori include tipi lavoro specifici (es. "Vendemmia", "Potatura Vite")
- Statistiche mostrano report specifici (es. "Produzione Vigneto")

### Flusso Integrazione UI

#### 1. Attivazione Modulo

**Dove**: Impostazioni → Moduli (come Parco Macchine)

**Cosa succede**:
- Amministratore attiva modulo (es. "Vigneto")
- Sistema verifica abbonamento/pagamento
- Modulo diventa disponibile per il tenant
- Sistema scansiona terreni esistenti

#### 2. Rilevamento Automatico Terreni

**Cosa succede**:
- Sistema identifica terreni con coltura corrispondente (es. "Vite" → modulo Vigneto)
- Mostra suggerimento: "Hai 3 terreni con Vite. Vuoi creare anagrafica vigneti?"
- Utente può ignorare o procedere

#### 3. Nuove Pagine nel Menu

**Menu navigazione si aggiorna automaticamente**:
```
Menu Principale:
├── Dashboard
├── Terreni
├── Lavori
├── Attività
├── Statistiche
├── [NUOVO] Vigneti          ← Solo se modulo attivo
├── [NUOVO] Vendemmia        ← Solo se modulo attivo
├── [NUOVO] Potatura Vigneto ← Solo se modulo attivo
└── [NUOVO] Pianifica Impianto ← Solo se modulo attivo
```

#### 4. Estensioni Pagine Esistenti

**Dashboard**:
- Se modulo attivo E ci sono dati rilevanti → mostra sezioni specifiche
- Esempio: Card "Vendemmia in corso" se ci sono vendemmie attive
- Se nessun dato → sezioni non appaiono

**Pagina Terreni**:
- Terreno con coltura "Vite" + modulo Vigneto attivo → mostra pulsante "Gestisci Vigneto"
- Cliccando → apre pagina anagrafica vigneto collegata al terreno
- Terreno resta fonte di verità (superficie, mappa, podere)

**Pagina Lavori**:
- Form creazione lavoro include tipi lavoro specifici se modulo attivo
- Esempio: Dropdown tipo lavoro include "Vendemmia", "Potatura Vite"
- Lavori esistenti continuano a funzionare normalmente

**Pagina Statistiche**:
- Report esistenti si estendono con sezioni specifiche
- Esempio: "Produzione Vigneto" con grafici vendemmia
- Dati aggregati automaticamente

### Struttura Pagine Nuove

#### Pagine Standalone (Nuove)

Ogni modulo aggiunge pagine dedicate:

**Modulo Vigneto**:
- `modules/vigneto/views/vigneti-standalone.html` - Anagrafica vigneti
- `modules/vigneto/views/vendemmia-standalone.html` - Gestione vendemmie
- ~~`modules/vigneto/views/potatura-vigneto-standalone.html`~~ ❌ **NON NECESSARIA** (dati già nel sistema Lavori/Diario)
- ~~`modules/vigneto/views/trattamenti-vigneto-standalone.html`~~ ❌ **RIMANDATA** (modulo Trattamenti dedicato futuro)
- `modules/vigneto/views/pianifica-impianto-standalone.html` - Pianificazione reticolato

**Modulo Frutteto**:
- `modules/frutteto/views/frutteti-standalone.html` - Anagrafica frutteti
- `modules/frutteto/views/raccolta-frutta-standalone.html` - Gestione raccolte
- `modules/frutteto/views/diradamento-standalone.html` - Diradamenti
- `modules/frutteto/views/pianifica-impianto-standalone.html` - Pianificazione reticolato

**Modulo Oliveto**:
- `modules/oliveto/views/oliveti-standalone.html` - Anagrafica oliveti
- `modules/oliveto/views/raccolta-olive-standalone.html` - Gestione raccolte
- `modules/oliveto/views/molitura-standalone.html` - Gestione moliture
- `modules/oliveto/views/pianifica-impianto-standalone.html` - Pianificazione reticolato

#### Pagine Esistenti (Estese)

Le pagine esistenti si arricchiscono dinamicamente:

**Dashboard** (`core/dashboard-standalone.html`):
- Verifica se moduli attivi
- Se sì, carica e mostra sezioni specifiche
- Esempio: `if (hasModuleAccess('vigneto')) { renderVendemmiaSection(); }`

**Terreni** (`core/terreni-standalone.html`):
- Per ogni terreno, verifica se modulo corrispondente attivo
- Se sì, mostra pulsante "Gestisci [Coltura]"
- Esempio: Terreno con "Vite" → pulsante "Gestisci Vigneto"

**Lavori** (`core/admin/gestione-lavori-standalone.html`):
- Dropdown tipo lavoro include tipi specifici se modulo attivo
- Form può mostrare campi aggiuntivi (es. varietà uva)

**Statistiche** (`core/statistiche-standalone.html`):
- Report esistenti si estendono con sezioni specifiche
- Dati aggregati automaticamente

### Isolamento Dati

**Sub-collections separate**:
- `tenants/{tenantId}/vigneti/` - Dati vigneti
- `tenants/{tenantId}/frutteti/` - Dati frutteti
- `tenants/{tenantId}/oliveti/` - Dati oliveti
- `tenants/{tenantId}/pianificazioni-impianti/` - Pianificazioni

**Nessuna modifica a collezioni esistenti**:
- `tenants/{tenantId}/terreni/` - Resta invariato
- `tenants/{tenantId}/lavori/` - Resta invariato
- `tenants/{tenantId}/attivita/` - Resta invariato

**Riferimenti**:
- Anagrafiche coltura referenziano terreno: `terrenoId: "terreno-123"`
- Terreno resta fonte di verità (superficie, mappa, podere)

### Compatibilità Retroattiva Garantita

✅ **Terreni esistenti**:
- Continuano a funzionare senza moduli
- Nessuna modifica necessaria
- Attivazione modulo non richiede migrazione dati

✅ **Lavori esistenti**:
- Continuano a funzionare normalmente
- Tipi lavoro esistenti restano disponibili
- Nuovi tipi lavoro aggiunti solo se modulo attivo

✅ **Attività esistenti**:
- Continuano a funzionare normalmente
- Nuove attività specifiche aggiunte solo se modulo attivo

✅ **Statistiche esistenti**:
- Continuano a funzionare normalmente
- Nuovi report aggiunti solo se modulo attivo

### Esempio Pratico: Flusso Utente

**Scenario**: Utente ha 3 terreni con coltura "Vite" già censiti.

**Prima attivazione modulo**:
1. Terreni funzionano normalmente
2. Nessuna funzionalità specifica vigneto
3. App funziona come sempre

**Dopo attivazione modulo Vigneto**:
1. Dashboard mostra suggerimento: "Hai 3 terreni con Vite"
2. Menu mostra nuove voci: "Vigneti", "Vendemmia", "Pianifica Impianto"
3. Pagina Terreni mostra pulsante "Gestisci Vigneto" per ogni terreno con Vite
4. Utente clicca "Gestisci Vigneto" → apre pagina anagrafica vigneto
5. Crea anagrafica vigneto collegata al terreno
6. Dashboard mostra "Vendemmia in corso" se ci sono vendemmie attive
7. Crea vendemmia → si collega al vigneto → crea attività nel diario
8. Statistiche mostrano report "Produzione Vigneto"

**Se disattiva modulo**:
1. Nuove voci menu scompaiono
2. Pagine nuove non più accessibili
3. Tutto torna a funzionare come prima
4. Dati moduli restano salvati (non eliminati), ma non accessibili

### Vantaggi Approccio

1. **Zero Rischio**: Nessuna modifica a funzionalità esistenti
2. **Progressive Enhancement**: Funzionalità aggiunte, non sostituite
3. **Flessibilità**: Moduli attivabili/disattivabili in qualsiasi momento
4. **Scalabilità**: Facile aggiungere nuovi moduli in futuro
5. **User Experience**: Utenti vedono solo funzionalità rilevanti

---

## 🔗 Integrazione con Sistema Esistente

### 1. Rilevamento Automatico Coltura

**Quando un modulo viene attivato**:
- Il sistema rileva automaticamente i terreni con quella coltura
- Mostra funzionalità specifiche nella dashboard
- Filtra automaticamente lavori/attività per quella coltura

**Esempio**:
```javascript
// Pseudo-codice (non implementare)
if (hasModuleAccess('vigneto')) {
  const terreniVigneto = terreni.filter(t => t.coltura === 'Vite');
  // Mostra sezione "Gestione Vigneti"
  // Filtra lavori per tipi lavoro vigneto
}
```

### 2. Estensione Tipi Lavoro

**Tipi lavoro specifici per coltura**:
- Quando un modulo è attivo, aggiunge tipi lavoro specifici
- Esempio: "Vendemmia", "Potatura Vite" per modulo Vigneto
- Integrazione con sistema categorie gerarchico esistente

### 3. Dashboard Adattiva

**Sezioni specifiche per coltura**:
- Dashboard mostra sezioni specifiche se modulo attivo
- Esempio: "Vendemmia in corso", "Raccolta frutta", "Raccolta olive"
- Integrazione con statistiche esistenti

### 4. Report Estesi

**Statistiche specifiche**:
- Estende report esistenti con dati specifici coltura
- Esempio: Report "Produzione Vigneto", "Rese Frutteto"
- Integrazione con `core/statistiche-standalone.html`

---

## 📁 Struttura File Proposta

```
modules/
├── vigneto/
│   ├── models/
│   │   ├── Vigneto.js
│   │   ├── Vendemmia.js
│   │   ├── PotaturaVigneto.js
│   │   └── TrattamentoVigneto.js
│   ├── services/
│   │   ├── vigneti-service.js
│   │   ├── vendemmia-service.js
│   │   ├── potatura-vigneto-service.js       # Pronto per uso futuro (dati già in Lavori/Diario)
│   │   └── trattamenti-vigneto-service.js   # Pronto per uso futuro (rimandato a modulo Trattamenti)
│   └── views/
│       ├── vigneti-standalone.html
│       ├── vendemmia-standalone.html
│       ├── vigneto-dashboard-standalone.html
│       └── vigneto-statistiche-standalone.html
│       # Note: potatura-vigneto-standalone.html e trattamenti-vigneto-standalone.html NON NECESSARIE
│       # - Potatura: dati già nel sistema Lavori/Diario (duplicazione evitata)
│       # - Trattamenti: rimandati a modulo Trattamenti dedicato futuro (generale, non solo vigneto)
│
├── frutteto/
│   ├── models/
│   │   ├── Frutteto.js
│   │   ├── RaccoltaFrutta.js
│   │   ├── PotaturaFrutteto.js
│   │   ├── Diradamento.js
│   │   └── TrattamentoFrutteto.js
│   ├── services/
│   │   ├── frutteti-service.js
│   │   ├── raccolta-frutta-service.js
│   │   ├── potatura-frutteto-service.js
│   │   ├── diradamento-service.js
│   │   └── trattamenti-frutteto-service.js
│   └── views/
│       ├── frutteti-standalone.html
│       ├── raccolta-frutta-standalone.html
│       ├── potatura-frutteto-standalone.html
│       └── diradamento-standalone.html
│
└── oliveto/
    ├── models/
    │   ├── Oliveto.js
    │   ├── RaccoltaOlive.js
    │   ├── PotaturaOliveto.js
    │   ├── Molitura.js
    │   └── TrattamentoOliveto.js
    ├── services/
    │   ├── oliveti-service.js
    │   ├── raccolta-olive-service.js
    │   ├── potatura-oliveto-service.js
    │   ├── molitura-service.js
    │   └── trattamenti-oliveto-service.js
    └── views/
        ├── oliveti-standalone.html
        ├── raccolta-olive-standalone.html
        ├── potatura-oliveto-standalone.html
        └── molitura-standalone.html
```

---

## 🎯 Priorità di Implementazione

### Fase 1: Modulo Vigneto (Priorità Alta)
**Motivazione**: 
- Probabilmente il più richiesto
- Ha funzionalità complesse (vendemmia, calcolo compensi)
- Può essere modello per gli altri

**Funzionalità Core**:
1. Anagrafica vigneti
2. Gestione vendemmia (raccolta + compensi)
3. Gestione potatura
4. Report produzione

**Tempo stimato**: 2-3 settimane

### Fase 2: Modulo Frutteto (Priorità Media)
**Motivazione**:
- Simile a vigneto ma con specificità (diradamento, specie multiple)
- Può riutilizzare pattern vigneto

**Funzionalità Core**:
1. Anagrafica frutteti
2. Gestione raccolta
3. Gestione diradamento
4. Report produzione

**Tempo stimato**: 2 settimane

### Fase 3: Modulo Oliveto (Priorità Media)
**Motivazione**:
- Specificità produzione olio (molitura, qualità)
- Meno comune ma importante per aziende olivicole

**Funzionalità Core**:
1. Anagrafica oliveti
2. Gestione raccolta olive
3. Gestione molitura e produzione olio
4. Report produzione olio

**Tempo stimato**: 2 settimane

---

## 🔄 Flusso di Attivazione Modulo

### 1. Attivazione da Amministratore
- Amministratore attiva modulo da "Impostazioni" → "Moduli"
- Sistema verifica abbonamento/pagamento
- Modulo diventa disponibile per il tenant

### 2. Rilevamento Automatico Terreni
- Sistema scansiona terreni esistenti
- Identifica terreni con coltura corrispondente
- Suggerisce creazione anagrafica specifica

### 3. Integrazione UI
- Dashboard mostra sezioni specifiche
- Menu navigazione aggiunge voci modulo
- Filtri automatici per coltura

### 4. Migrazione Dati (Opzionale)
- Se terreni già hanno dati, suggerisce migrazione
- Esempio: se terreno ha coltura "Vite" e modulo vigneto attivato, suggerisce creazione anagrafica vigneto

---

## 📊 Report e Statistiche Specifiche

### Modulo Vigneto
- **Report Vendemmia**: kg raccolti, resa/ha, costi manodopera
- **Report Produzione**: confronto annate, grafici produzione
- **Report Trattamenti**: numero trattamenti, costi prodotti
- **Statistiche Rese**: resa media per varietà, trend temporale

### Modulo Frutteto
- **Report Raccolta**: kg raccolti per specie, resa/ha, costi manodopera
- **Report Produzione**: confronto annate, grafici produzione per specie
- **Report Diradamento**: piante diradate, frutti rimossi
- **Statistiche Rese**: resa media per specie/varietà, trend temporale

### Modulo Oliveto
- **Report Raccolta**: kg olive raccolte, resa/ha, costi manodopera
- **Report Produzione Olio**: litri olio, resa olio (%), qualità
- **Report Molitura**: resa per frantoio, qualità olio
- **Statistiche Rese**: resa media per varietà, trend temporale

---

## 🔐 Permessi e Ruoli

### Permessi Moduli
- **Amministratore**: Attiva/disattiva moduli, gestione completa
- **Manager**: Accesso completo a funzionalità modulo
- **Caposquadra**: Accesso lettura + inserimento dati operativi
- **Operaio**: Accesso lettura (vede dati ma non modifica)

### Permessi Specifici
- **Gestione Anagrafica**: Solo Manager/Amministratore
- **Inserimento Raccolta**: Manager, Caposquadra
- **Inserimento Trattamenti**: Manager, Caposquadra
- **Visualizzazione Report**: Manager, Amministratore

---

## 🧪 Testing e Validazione

### Test per Modulo
1. **Test Attivazione**: Verifica che modulo si attivi correttamente
2. **Test Integrazione Terreni**: Verifica filtraggio automatico
3. **Test CRUD**: Crea/modifica/elimina anagrafica
4. **Test Raccolta**: Inserimento raccolta, calcolo compensi
5. **Test Report**: Verifica report e statistiche
6. **Test Permessi**: Verifica permessi per ruolo

### Test Integrazione
1. **Test con Manodopera**: Verifica calcolo compensi
2. **Test con Parco Macchine**: Verifica assegnazione macchine
3. **Test con Statistiche**: Verifica report estesi
4. **Test Multi-Tenant**: Verifica isolamento dati

---

## 📝 Note Implementative

### 1. Compatibilità Retroattiva
- Terreni esistenti continuano a funzionare senza moduli
- Moduli aggiungono funzionalità, non modificano dati esistenti
- Attivazione modulo non richiede migrazione dati

### 2. Performance
- Sub-collections per dati specifici (non sovraccaricano documenti terreni)
- Indici Firestore per query frequenti (es. vendemmie per data)
- Cache locale per dati lettura frequente

### 3. Scalabilità
- Moduli indipendenti (possono essere sviluppati in parallelo)
- Pattern riutilizzabile (vigneto = template per frutteto/oliveto)
- Estensibile (facile aggiungere nuovi moduli coltura)

### 4. UX
- Dashboard adattiva (mostra solo sezioni rilevanti)
- Filtri automatici (terreni/lavori per coltura)
- Guide/Tour per ogni modulo
- Messaggi informativi quando modulo non attivo

---

## 🎯 Prossimi Passi

### 1. Validazione Piano
- [ ] Review piano con stakeholder
- [ ] Definire priorità moduli
- [ ] Confermare funzionalità core

### 2. Design Dettagliato
- [ ] Mockup UI per ogni modulo
- [ ] Definire struttura dati dettagliata
- [ ] Definire API/services

### 3. Prototipo
- [ ] Creare prototipo modulo Vigneto (MVP)
- [ ] Testare integrazione con core
- [ ] Validare pattern architetturale

### 4. Implementazione
- [ ] Sviluppo modulo Vigneto completo
- [ ] Test e validazione
- [ ] Documentazione utente

---

## 📚 Riferimenti

- **Sistema Colture Esistente**: `core/services/colture-service.js`
- **Modello Terreno**: `core/models/Terreno.js`
- **Modulo Conto Terzi** (esempio modulo): `modules/conto-terzi/`
- **Modulo Parco Macchine** (esempio integrazione): `modules/parco-macchine/`
- **Sistema Categorie**: `core/services/categorie-service.js`

---

---

## ✅ Riepilogo: Cosa Contiene Ogni Modulo

### Conferma Campi Comuni (Tutti i Moduli)

✅ **Varietà** - Campo comune (string per vigneto/frutteto, array per oliveto)  
✅ **Portainnesto** - Campo comune (opzionale ma presente in tutti)  
✅ **Densità** - Campo comune (unità varia: ceppi/ha, piante/ha)  
✅ **Tipo Impianto** - Campo comune (forma di allevamento + tipo impianto)  
✅ **Resa** - Campi comuni (resa media, resa anno precedente, produzione totale)  
✅ **Spese** - Campi comuni (manodopera, trattamenti, potatura, raccolta, altro)  
✅ **Costi** - Campi comuni (costo totale, costo/ettaro, margine, ROI)  

### Struttura Comune Ogni Modulo

Ogni modulo contiene **4 sezioni principali**:

1. **Anagrafica Impianto** 
   - Campi comuni (varietà, portainnesto, densità, tipo impianto, distanze)
   - Campi specifici (destinazione uva, specie, frantoio, ecc.)

2. **Operazioni**
   - **Comuni**: Potature, Trattamenti
   - **Specifiche**: Vendemmia (vigneto), Raccolta frutta (frutteto), Diradamento (frutteto), Raccolta olive (oliveto), Molitura (oliveto)

3. **Rese e Produzione**
   - Campi comuni (resa media, produzione totale, trend)
   - Campi specifici (gradazione uva, calibro frutta, resa olio %)

4. **Spese e Costi**
   - Campi comuni (tutte le categorie spese, costi, margini)
   - Campi specifici (spese vendemmia, spese molitura, ecc.)

### Riutilizzo Codice Massimizzato

**Servizi Comuni** (riutilizzabili al 100%):
- ✅ `coltura-base-service.js` - CRUD base
- ✅ `potatura-service.js` - Gestione potature
- ✅ `trattamento-service.js` - Gestione trattamenti
- ✅ `statistiche-coltura-service.js` - Calcolo statistiche

**Servizi Parzialmente Comuni** (base comune + estensioni):
- ⚠️ `raccolta-base-service.js` - Base comune, esteso per ogni modulo
- ⚠️ `diradamento-service.js` - Base comune (vigneto e frutteto), esteso per specificità

**Componenti UI Comuni** (riutilizzabili al 100%):
- ✅ Form anagrafica impianto
- ✅ Tabella rese e produzione
- ✅ Tabella spese e costi
- ~~Calendario trattamenti~~ ❌ **RIMANDATO** - Modulo Trattamenti dedicato futuro

**Stima Riutilizzo**: ~60-70% codice comune tra moduli

---

## 📊 Stato Implementazione Moduli

**Data aggiornamento**: 2026-01-18

### 🍇 Modulo Vigneto - Stato: ✅ IMPLEMENTATO (MVP Base + Tracciamento Poligono + Tabella Macchine)

**Data inizio sviluppo**: 2026-01-13  
**Priorità**: Alta (Primo modulo da implementare)

#### ✅ Completato (2026-01-13)

**Struttura Base:**
- ✅ Struttura cartelle e modelli completi (Vigneto, Vendemmia, PotaturaVigneto, TrattamentoVigneto)
- ✅ Servizi CRUD completi per tutte le entità
- ✅ Firestore Security Rules configurate e pubblicate

**Anagrafica Vigneti:**
- ✅ Vista `vigneti-standalone.html` completa con:
  - Lista vigneti con filtri avanzati
  - Form creazione/modifica con validazione
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
- ✅ Sistema retrocompatibile: banner informativo per terreni con "Vite" esistenti

**Gestione Vendemmia:**
- ✅ Vista `vendemmia-standalone.html` completa
- ✅ Calcolo automatico resa qli/ha
- ✅ Aggiornamento automatico dati vigneto (produzione, resa media, spese)

**Integrazione:**
- ✅ Card "Vigneto" nella dashboard
- ✅ Attivazione modulo in pagina abbonamento
- ✅ Verifica accesso modulo nelle viste

#### ✅ Completato (2026-01-14)
- ✅ **Integrazione Sistema Lavori/Diario** (DECISIONE STRATEGICA):
  - ✅ Collegamento automatico Lavoro → Vigneto (tramite terreno)
  - ✅ Calcolo automatico costi lavori (manodopera: ore × tariffe, macchine: ore × costo/ora)
  - ✅ Aggregazione annuale automatica spese per categoria
  - ✅ Mappatura dinamica tipi lavoro → categorie spese
  - ✅ Aggiornamento automatico vigneto quando lavoro completato/validato
  - ✅ Supporto per qualsiasi tipo di lavoro (non solo potatura/trattamenti)
  - ✅ Conteggio automatico lavori ripetuti nell'anno (es. "Trinciare" fatto 3 volte)
- ✅ Form dedicato vendemmia (mantenere per dati aggiuntivi: quantità, qualità uva)
- ✅ Pulsante ricalcolo manuale spese nella UI vigneti

#### ✅ Miglioramenti Sistema Spese (2026-01-15)
- ✅ **Correzione Calcolo Costo Totale Anno**: Eliminato doppio conteggio categorie
- ✅ **Struttura Gerarchica Dinamica**: Categorie manodopera dinamiche basate sul sistema (es. Potatura, Lavorazione del Terreno come sotto-categorie di Manodopera)
- ✅ **Filtro Attività Dirette Migliorato**: Supporto per multiple attività diverse nello stesso giorno
- ✅ **Coerenza Calcoli**: Totali identici tra pagina principale e dettaglio
- ✅ **Ricalcolo Automatico**: Spese aggiornate automaticamente in background al caricamento pagina
- ✅ **Miglioramenti UI**: Card "Macchine" resa più visibile con gradiente blu
- ✅ **Pulizia Log**: Rimossi tutti i log di debug, console pulita

#### ✅ Completamento Funzionalità Vendemmia (2026-01-17)
- ✅ **Tabella Editabile Operai**: Implementata quando modulo manodopera non attivo
- ✅ **Visualizzazione Ore Macchina**: Corretta nella sezione "Dati Lavoro"
- ✅ **Precompilazione Superficie**: Automatica dal lavoro collegato
- ✅ **Link "Vedi Lavoro"**: Corretto per manager
- ✅ **Rimozione Campi**: Macchine dropdown, Ore Impiegate, Parcella
- ✅ **Correzione Validazione**: Form quando vendemmia collegata a lavoro

#### ✅ Tracciamento Poligono e Tabella Macchine (2026-01-18)
- ✅ **Tracciamento Poligono Area Vendemmiata**:
  - Campo `poligonoVendemmiato` aggiunto al modello Vendemmia
  - Pulsante "🗺️ Traccia" accanto al campo superficie
  - Modal mappa con tracciamento interattivo
  - Calcolo automatico superficie da poligono (m² → ettari)
  - Salvataggio coordinate poligono
  - Visualizzazione poligono esistente
- ✅ **Totale Ore Operai**: Riga totale sotto tabella editabile operai
- ✅ **Tabella Macchine (Sola Lettura)**: Visualizzazione macchine dall'attività quando manodopera non attivo
- ✅ **Correzione Visualizzazione Macchine**: Fix per lista attività del diario
- ✅ **Aggiunta Campi Macchine**: Modello Attivita aggiornato per preservare `macchinaId`, `attrezzoId`, `oreMacchina`
- ✅ **Rimozione Messaggio Automatico**: Note vendemmia senza messaggi automatici

#### 📝 In Pianificazione (2026-01-16)
- [ ] **Integrazione Vendemmia-Lavori: Rilevamento Automatico**:
  - [ ] Creare tipi lavoro "Vendemmia Manuale" e "Vendemmia Meccanica"
  - [ ] Implementare hook creazione vendemmia automatica al salvataggio lavoro
  - [ ] Aggiungere campo `lavoroId` al modello Vendemmia
  - [ ] Implementare funzione `createVendemmiaFromLavoro(lavoroId)`
  - [ ] Aggiornare UI elenco vendemmie (badge, link, filtri)
  - [ ] Aggiornare modal vendemmia (sezione dati lavoro, tabelle precompilate)
  - [ ] Implementare filtro dropdown tipi lavoro (solo vendemmia quando terreno=VITE)
  - [ ] Aggiornare `lavori-vigneto-service.js` per riconoscere vendemmia nelle spese
  - [ ] Implementare gestione modifiche/eliminazioni lavoro
  - [ ] Implementare validazione stato vendemmia (completa/incompleta)

#### 🚧 In Sviluppo
- [ ] Calcolo compensi vendemmia completo
- [ ] Integrazione link da pagina terreni

#### 📋 Da Implementare
- [ ] Pianificazione nuovi impianti
- [x] ~~**Modulo Report/Bilancio (unico, cross-moduli)**~~ ✅ **IMPLEMENTATO (MVP 2026-01-22)** - Adapter Vigneto + Export Excel funzionante
- [ ] Notifiche automatiche

### 🍎 Modulo Frutteto - Stato: 📝 PIANIFICAZIONE
**Priorità**: Media (Dopo Vigneto)

### 🫒 Modulo Oliveto - Stato: 📝 PIANIFICAZIONE
**Priorità**: Media (Dopo Vigneto)

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

**Implementazione**:
Vedi sezione "Integrazione Sistema Lavori/Diario" in `PLAN_MODULO_VIGNETO_DETTAGLIATO.md` per dettagli tecnici.

---

## 📑 Strategia Report/Bilancio Unico (Cross-Moduli)

**Problema**: se ogni modulo aggiunge la propria pagina “Report”, un utente con 3 moduli finisce con 3 pagine diverse (UX frammentata + duplicazione di logica export/filtri).

**Decisione**: introdurre un **modulo unico** `report/bilancio` integrabile su tutta l’app, che si **adatta dinamicamente** ai moduli attivi del tenant.

### Obiettivi
- **Un solo punto** per report/stampe/esportazioni (PDF/Excel/CSV)
- **Filtri unificati** (periodo, azienda/tenant, eventualmente terreno/vigneto/frutteto/oliveto)
- **Sezioni modulari**: compaiono solo se il modulo è attivo e ci sono dati
- **Nessuna duplicazione dati**: i report consumano gli stessi aggregati/servizi già usati dalle statistiche

### Struttura proposta (indicativa)
- `modules/report/views/report-standalone.html`
- `modules/report/services/report-service.js` (orchestratore)
- `modules/report/services/report-export-service.js` (export PDF/Excel)

### Integrazione “plug-in” per moduli
Ogni modulo opzionale può esporre un piccolo **adapter** (interfaccia comune) per:
- **metadati** (nome, icona)
- **filtri specifici** (es. vignetoId, varietà, destinazione)
- **dataset export** (righe dettagli + riepiloghi)
- **metriche standard** (produzione/costi/ore dove applicabile)

Il modulo report:
- legge moduli attivi con `getAvailableModules()` / `hasModuleAccess()`
- carica solo gli adapter disponibili
- renderizza solo le sezioni abilitate

### Relazione con “Statistiche”
- **Statistiche**: pagine di analisi interattiva (grafici, drill-down)
- **Report/Bilancio**: generazione documenti/esportazioni e riepilogo “stampabile”

**Nota**: dove esistono già pagine statistiche dedicate (es. Vigneto), **non si crea una pagina report dedicata** del modulo; si aggancia l’export al modulo Report/Bilancio unico.

**Ultimo aggiornamento**: 2026-01-23  
**Stato**: ✅ IMPLEMENTATO - Modulo Vigneto MVP Base Completato + Tracciamento Poligono + Tabella Macchine + Calcolo Materiali Impianto

---

## 📝 Aggiornamento 2026-01-23: Implementazione Calcolo Materiali Impianto Vigneto

### Modifiche Implementate

#### 1. ✅ Pagina Calcolo Materiali
- **Nuova pagina**: `modules/vigneto/views/calcolo-materiali-standalone.html`
- Lista pianificazioni salvate con verifica dati completi/incompleti
- Form configurazione con 17 tipi di impianto
- Precompilazione automatica valori in base al tipo impianto
- Calcolo e visualizzazione materiali in tabella

#### 2. ✅ Servizio Calcolo Materiali
- **Nuovo servizio**: `modules/vigneto/services/calcolo-materiali-service.js`
- 17 tipi di impianto con configurazioni predefinite (Guyot, Cordone Speronato, Pergola, Tendone, GDC, Lyre, ecc.)
- Calcolo completo materiali: pali, fili di portata/vegetazione, braccetti, tutori, ancore, legacci/gancetti

#### 3. ✅ Distinzione Fili di Portata e Vegetazione
- Separati fili di portata (sostegno principale, 4-5mm) e fili di vegetazione (contenimento chioma, 2-2.5mm)
- Configurazioni specifiche per ogni tipo di impianto
- Precompilazione automatica diametri

#### 4. ✅ Correzione Terminologia
- **Tutori**: sostegno per pianta (1 per unità)
- **Braccetti**: sostegni strutturali per pali (2 per palo, sistemi sopraelevati)
- **Fissaggio Tutori**: scelta tra legacci o gancetti (mutualmente esclusivi)

#### 5. ✅ Fix Salvataggio Calcoli Pianificazione
- Corretto `onSalvaPianificazione()` per includere tutti i calcoli (numeroFile, numeroUnitaTotale, superficieNettaImpianto, ecc.)
- Pianificazioni salvate ora contengono dati completi

#### 6. ✅ Gestione Pianificazioni Incomplete
- Verifica dati completi con icona warning
- Disabilitazione calcolo per pianificazioni incomplete
- Avviso utente quando si seleziona pianificazione incompleta

#### 7. ✅ Fix Navigazione
- Pulsante "Dashboard" reindirizza a `vigneto-dashboard-standalone.html`
- Rimosso pulsante "Vigneti"

**File Creati**:
- ✅ `modules/vigneto/views/calcolo-materiali-standalone.html`
- ✅ `modules/vigneto/services/calcolo-materiali-service.js`

**File Modificati**:
- ✅ `modules/vigneto/views/pianifica-impianto-standalone.html`
- ✅ `modules/vigneto/services/pianificazione-impianto-service.js`

---

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
- `quantitaEttari`: **precompilato automaticamente** da `superficieTotaleLavorata` o `percentualeCompletamento × superficieTerreno`
- `operai`: array dal lavoro (per tabella consultazione in sezione "Dati Lavoro")
- `macchine`: array dal lavoro con ore (per tabella consultazione in sezione "Dati Lavoro")
- `zone`: zone tracciate dal lavoro (se presenti)

**Dati da completare manualmente**:
- `quantitaQli`: obbligatorio
- `gradazione`: opzionale
- `acidita`: opzionale
- `ph`: opzionale
- `destinazione`: obbligatorio
- `note`: opzionale

**Nota**: I campi `parcella`, `oreImpiegate` e `macchine` (dropdown) sono stati rimossi. Le macchine vengono mostrate solo nella sezione "Dati Lavoro" (sola lettura).

#### Fase 3: Completamento Dati Vendemmia
1. Utente apre "Gestione Vendemmia" nel modulo vigneto
2. Vede elenco vendemmie (già popolato dai lavori)
3. Badge "Incompleta" su vendemmie senza: `quantitaQli`, `quantitaEttari` o `destinazione`
4. Clicca su vendemmia → completa dati mancanti
5. Vendemmia diventa "Completa"

### 📊 Integrazione con Sistema Spese

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

### ⚙️ Gestione Modifiche ed Eliminazioni

- **Modifica Lavoro**: Aggiorna automaticamente vendemmia (operai, ore, macchine, zone)
- **Modifica Tipo Lavoro**: Se cambia da "Vendemmia" → elimina vendemmia automaticamente
- **Cambio Terreno**: Se cambia da "VITE" → mantiene vendemmia ma scollega lavoro
- **Eliminazione Lavoro**: Elimina automaticamente anche la vendemmia

### 🎯 Validazione e Stato

- **Vendemmia Completa**: Ha `quantitaQli`, `quantitaEttari`, `destinazione`
- **Vendemmia Incompleta**: Manca almeno uno dei campi obbligatori (badge nell'elenco)

### ✅ Vantaggi Approccio

1. **Zero Duplicazione**: Un solo punto di inserimento (lavoro)
2. **Rilevamento Automatico**: Nessuna azione manuale per creare vendemmia
3. **Elenco Sempre Aggiornato**: Vendemmie compaiono automaticamente
4. **Dati Base Già Presenti**: Operai, ore, macchine dal lavoro
5. **Dati Aggiuntivi Separati**: Quantità, qualità nella vendemmia
6. **Tracciabilità Completa**: Collegamento bidirezionale lavoro ↔ vendemmia
7. **Funziona con Qualsiasi Configurazione**: Con o senza moduli avanzati

**Dettagli Implementazione**: Vedi sezione "🔄 Integrazione Vendemmia-Lavori: Rilevamento Automatico" in `PLAN_MODULO_VIGNETO_DETTAGLIATO.md`

---

## 📝 Aggiornamenti Implementazione Modulo Vigneto

### ✅ Aggiornamento 2026-01-17: Completamento Funzionalità Vendemmia

#### Modifiche Implementate

1. **Tabella Editabile Operai (Senza Modulo Manodopera)**
   - Quando il modulo manodopera non è attivo, il sistema mostra una tabella editabile con colonne (Data, Nome Operaio, Ore) invece del dropdown
   - Struttura dati operai: array di oggetti `{data, nome, ore}` quando manodopera non attivo, array di ID quando attivo

2. **Visualizzazione Ore Macchina**
   - Corretta visualizzazione ore macchina nella sezione "Dati Lavoro"
   - Ore caricate da `oreOperai` validate, visualizzate per macchina/attrezzo (senza totale cumulativo)

3. **Precompilazione Automatica Superficie Vendemmiata**
   - Implementato calcolo automatico superficie vendemmiata dal lavoro collegato
   - Priorità: `superficieTotaleLavorata` (da zone tracciate) o `percentualeCompletamento × superficieTerreno`

4. **Link "Vedi Lavoro"**
   - Corretto link per manager: ora punta a `gestione-lavori-standalone.html` con apertura automatica modal

5. **Semplificazione Form Vendemmia**
   - Rimossi campi: Macchine Utilizzate (dropdown), Ore Impiegate, Parcella/Blocco
   - Mantenuti: Note, Sezione "Dati Lavoro" (sola lettura)

**Stato**: ✅ Completato

---
