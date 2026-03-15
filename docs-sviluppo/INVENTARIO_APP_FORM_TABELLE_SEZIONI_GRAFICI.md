# Inventario Completo App GFV – Form, Tabelle, Sezioni, Grafici

**Data**: 2026-02-28  
**Scopo**: Mappatura di tutti gli elementi interattivi dell'app per valutare scalabilità e supporto Tony.

---

## 1. Form (Modal + Form)

| Pagina | Form ID | Modal ID | Campi circa | Prefix | Complessità |
|--------|---------|----------|-------------|--------|-------------|
| Terreni | terreno-form | terreno-modal | 9 | terreno-* | Bassa |
| Attività | attivita-form | attivita-modal | 14 | attivita-* | Alta |
| Gestione Lavori | lavoro-form | lavoro-modal | 15 | lavoro-* | Alta |
| Segnatura Ore | ora-form | ora-modal | 8 | ora-* | Media |
| Prodotti | prodotto-form | prodotto-modal | 12 | prodotto-* | Bassa |
| Movimenti | movimento-form | movimento-modal | 9 | mov-* | Media |
| Clienti | cliente-form | cliente-modal | 11 | nessuno | Bassa |
| Vendemmia | vendemmia-form | vendemmia-modal | 12+ | nessuno | Alta |
| Vigneti | vigneto-form | vigneto-modal | 15+ | nessuno | Alta |
| Frutteti | frutteto-form | frutteto-modal | molti | nessuno | Alta |
| Trattamenti Vigneto | form-trattamento | - | vari | nessuno | Media |
| Potatura Vigneto | form-potatura | - | vari | nessuno | Media |
| Raccolta Frutta | raccolta-form | raccolta-modal | vari | - | Media |
| Calcolo Materiali | - | - | molti | - | Alta |
| Pianifica Impianto | - | - | molti | - | Alta |
| Preventivi | preventivo-form | - | molti | - | Alta |
| Tariffe | tariffa-form | tariffa-modal | vari | - | Media |
| Gestione Macchine | macchina-form | macchina-modal | vari | - | Media |
| Gestione Squadre | squadra-form | squadra-modal | vari | - | Media |
| Gestione Operai | contratto-form | contratto-modal | vari | - | Media |
| Lavori Caposquadra | zona-form | zona-modal | vari | - | Media |
| Gestisci Utenti | invita-form | invita-modal | vari | - | Media |
| Impostazioni | azienda-form, podere-form, ecc. | podere-modal, ecc. | vari | - | Media |
| Validazione Ore | rifiuta-form | rifiuta-modal | vari | - | Bassa |
| Gestione Guasti | risolvi-guasto-form, riapri-guasto-form | risolvi-modal | vari | - | Media |
| Segnalazione Guasti | segnala-guasto-form | - | vari | - | Media |
| Trattori / Attrezzi / Flotta | form-nuovo | - | pochi | - | Bassa |
| Scadenze | form-rinnova | - | pochi | - | Bassa |
| Guasti List | form-risolvi | - | pochi | - | Bassa |

**Totale form stimato**: ~35+

---

## 2. Tabelle (Liste/Dati)

| Pagina | Tabella / Classe | pageType (currentTableData) | Note |
|--------|------------------|-----------------------------|------|
| Terreni | terreni-container, terreno-row | terreni | ✅ Tony supportato |
| Prodotti | prodotti-table | prodotti | ✅ Tony supportato |
| Movimenti | movimenti-table | movimenti | ✅ Tony supportato |
| Trattori | mezzi-table | trattori | ✅ Tony supportato |
| Attrezzi | mezzi-table | attrezzi | ✅ Tony supportato |
| Flotta | mezzi-table | flotta | ✅ Tony supportato |
| Scadenze | scadenze-table | scadenze | ✅ Tony supportato |
| Guasti | guasti-table | guasti | ✅ Tony supportato |
| Gestione Lavori | lavori-table | lavori | Da dotare |
| Diario Attività | attivita-table | attivita | Da dotare |
| Segnatura Ore | ore-table | ore | Da dotare |
| Validazione Ore | ore-table | - | Da dotare |
| Clienti | clienti-table | clienti | Da dotare |
| Preventivi | preventivi-table | - | Da dotare |
| Tariffe | tariffe-table | - | Da dotare |
| Gestione Squadre | squadre-table | squadre | Da dotare |
| Gestione Operai | operai-table | operai | Da dotare |
| Gestisci Utenti | users-table | utenti | Da dotare |
| Vigneti | vigneti-table | vigneti | Da dotare |
| Frutteti | frutteti-table | frutteti | Da dotare |
| Vendemmie | vendemmie-table, table-vendemmie | - | Da dotare |
| Calcolo Materiali | table-pianificazioni | - | - |
| Report | table-card | - | - |
| Statistiche Manodopera | table | - | - |
| Operai tabelle (potatura, trattamenti, ecc.) | operai-tabella, macchine-tabella | - | Tabelle editabili inline |

**Totale tabelle**: ~25+  
**Con currentTableData attivo**: ~8 (terreni, prodotti, movimenti, trattori, attrezzi, flotta, scadenze, guasti)

---

## 3. Sezioni (data-tour-section / Cards / Blocks)

### Dashboard (data-tour-section)

| Sezione | Descrizione |
|---------|-------------|
| panoramica | Statistiche e overview |
| mappa | Vista Mappa Aziendale |
| core-base | Azioni rapide core |
| gestione-manodopera | Blocco manodopera |
| diario | Diario attività |
| gestione-core | Gestione operativa core |
| caposquadra | Lavori caposquadra |
| operaio | I miei lavori operaio |

### Gestione Lavori

| Sezione | Descrizione |
|---------|-------------|
| lavori-stats | Statistiche lavori |
| lavori-filters | Filtri |
| lavori-list | Lista lavori |
| lavori-approvazione | Area approvazione |
| lavoro-form | Form lavoro (in modal) |

### Terreni

| Sezione | Descrizione |
|---------|-------------|
| lista-terreni | Lista terreni |
| form-terreno | Form terreno (modal) |
| mappa-terreno | Mappa tracciamento |

### Gestione Macchine

| Sezione | Descrizione |
|---------|-------------|
| macchine-filters | Filtri |
| macchine-list | Lista macchine |
| macchina-form | Form macchina (modal) |

### Altre sezioni (section-header, section-title, card)

- section-header: Header con titolo (molte pagine)
- section-title: Titolo sezione (calcolo materiali, impostazioni, ecc.)
- card: Card dashboard, abbonamento, impostazioni, report
- Impostazioni: azienda-section, comunicazioni-section, account-section, password-section, poderi-section, liste-section, tariffe-section, coefficienti-morfologia-section

---

## 4. Grafici (Chart.js)

### Statistiche Generali (statistiche-standalone.html)

| Canvas ID | Descrizione |
|-----------|-------------|
| chart-ore-tipo | Ore per tipo lavoro (torta) |
| chart-attivita-terreno | Attività per terreno (barre) |
| chart-ore-mese | Ore per mese (lineare) |
| chart-top-lavori | Top 5 tipi lavoro (barre orizz.) |
| chart-distribuzione-terreni | Distribuzione terreni |
| chart-distribuzione-superficie | Distribuzione superficie |
| chart-top-macchine | Top macchine (se parco attivo) |
| chart-ore-macchina-terreno | Ore macchina per terreno |
| chart-ore-macchina-vs-lavoratore | Macchina vs lavoratore |
| chart-ore-macchine-mese | Ore macchine per mese |

### Vigneto Statistiche (vigneto-statistiche-standalone.html)

| Canvas ID | Descrizione |
|-----------|-------------|
| chart-produzione-tempo | Produzione nel tempo |
| chart-resa-varieta | Resa per varietà |
| chart-produzione-mensile | Produzione mensile |
| chart-gradazione | Gradazione °Brix |
| chart-acidita | Acidità |
| chart-ph | pH |
| chart-costi-tempo | Costi nel tempo |
| chart-spese-categoria | Spese per categoria |
| chart-spese-mensili | Spese mensili |

### Frutteto Statistiche (frutteto-statistiche-standalone.html)

| Canvas ID | Descrizione |
|-----------|-------------|
| chart-produzione-tempo | Produzione nel tempo |
| chart-resa-specie | Resa per specie |
| chart-produzione-mensile | Produzione mensile |
| chart-calibro | Calibro |
| chart-maturazione | Maturazione |
| chart-colore | Colore |
| chart-scarto-tempo | Scarto nel tempo |
| chart-scarto-categoria | Scarto per categoria |
| chart-costi-tempo | Costi nel tempo |
| chart-spese-categoria | Spese per categoria |
| chart-spese-mensili | Spese mensili |

### Report (report-standalone.html)

- chart-placeholder (grafici in sviluppo)

### Dashboard Lavori / Vigneto (mini grafici nelle card)

- Mini chart nelle stat-card (produzione, resa, spese)

**Totale grafici**: ~35+ canvas Chart.js

---

## 5. Mappe

| Contesto | Elemento | Note |
|----------|----------|------|
| Dashboard | Vista Mappa Aziendale | Terreni su mappa, filtri podere/coltura |
| Terreno form | Mappa tracciamento confini | Calcolo superficie da poligono |
| Vendemmia | Mappa area vendemmiata | Tracciamento zona |
| Potatura Vigneto | Mappa zone potate | canvas + drawing |
| Potatura Frutteto | Mappa zone potate | idem |
| Trattamenti | Mappa zone trattate | idem |
| Raccolta Frutta | - | Simile vendemmia |

---

## 6. Riepilogo Numerico

| Categoria | Conteggio | Note |
|-----------|-----------|------|
| Form | ~35+ | Solo principali, escludendo mini-form (add varietà, ecc.) |
| Tabelle | ~25+ | Liste dati principali |
| Tabelle con currentTableData | 8 | Terreni, Magazzino, Macchine |
| Sezioni data-tour-section | ~15 | Dashboard, Lavori, Terreni, Macchine |
| Cards / section-header | ~40+ | Sparsi in tutta l'app |
| Grafici Chart.js | ~35+ | 4 pagine statistiche principali |
| Mappe interattive | ~6 | Dashboard, Terreno, Vendemmia, Potature, Trattamenti |

---

## 7. Implicazioni per Tony e Universal Form Controller

### Già supportato da Tony

- **Form**: attivita, lavoro, terreno (parziale)
- **Tabelle**: FILTER_TABLE, SUM_COLUMN per terreni; FILTER_TABLE per attivita (terreno, tipoLavoro, coltura, origine, data)
- **currentTableData**: 8 pagine (terreni, prodotti, movimenti, macchine)
- **Rotte**: 56 target in tony-routes.json

### Da estendere per Tony

- Form: prodotto, movimento, cliente, ora (segna ore), macchina, squadra, ecc.
- Tabelle: FILTER_TABLE/SUM_COLUMN per altre pagine (lavori, clienti, vigneti, ecc.)
- currentTableData: ~17 pagine ancora senza

### Elementi fuori scope form-injection

- **Grafici**: sola lettura, Tony non "compila" grafici
- **Mappe**: tracciamento complesso, richiederebbe comandi dedicati
- **Sezioni**: navigazione e contesto, non compilazione

### Conclusione

L'app ha **decine di form, tabelle, sezioni e grafici**. Un Universal Form Controller che legga da mapping funzionerebbe bene per i form semplici (~10–15), ma molti form hanno logiche specifiche. Le tabelle richiedono estensione di currentTableData e di FILTER_TABLE/SUM_COLUMN a tutte le pagine lista. I grafici sono fuori dallo scope della compilazione form.
