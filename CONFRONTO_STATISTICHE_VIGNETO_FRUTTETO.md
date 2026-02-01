# Confronto statistiche: Vigneto vs Frutteto – Adeguamenti al modulo Frutteto

Documento di analisi per allineare le statistiche del modulo Frutteto a quanto già sviluppato nel modulo Vigneto. **Nessun codice**: solo confronto e piano di adeguamento.

---

## 1. Architettura complessiva

### Vigneto
- **Due livelli**:
  1. **vigneto-statistiche-service.js** – API usate da dashboard e pagina statistiche (getStatisticheVigneto, getVendemmieRecenti, getLavoriVigneto, getProduzioneTemporale, getQualitaUva, getCostiTemporale).
  2. **vigneto-statistiche-aggregate-service.js** – Statistiche pre-calcolate su Firestore (`statistiche_vigneto/{vignetoId}_{anno}`) per performance; il service principale le usa quando esistono e fa fallback al calcolo al volo.
- **Trigger**: dopo salvataggio/aggiornamento lavori (lavori-vigneto-service) e dopo create/update/delete vendemmia (vendemmia-service) viene chiamato `calcolaEAggiornaStatistiche` in background.
- **Costo totale anno**: in dashboard è **sempre** calcolato al volo con `aggregaSpeseVignetoAnno`, così la dashboard non dipende dal pulsante “Ricalcola spese”.

### Frutteto (attuale)
- **Un solo livello**: **frutteto-statistiche-service.js** con solo calcolo al volo (nessun servizio aggregate).
- **Funzioni presenti**: getStatisticheFrutteto, getRaccolteRecenti, getLavoriFrutteto.
- **Funzioni assenti**: getProduzioneTemporale, getQualitaFrutta (o equivalente), getCostiTemporale, nessun servizio di aggregazione pre-calcolata.
- **Trigger**: nessuno (non esistendo aggregazioni).

---

## 2. Confronto funzione per funzione

### 2.1 Statistiche aggregate (anno / singolo frutteto o tutti)

| Aspetto | Vigneto | Frutteto (attuale) | Adeguamento frutteto |
|--------|---------|--------------------|----------------------|
| **Funzione** | `getStatisticheVigneto(vignetoId, anno)` | `getStatisticheFrutteto(fruttetoId, anno)` | Mantenere nome; allineare contenuto e ottimizzazioni. |
| **Unità produzione** | qli (quintali) | kg | Ok: frutteto resta in kg. |
| **Resa** | resaMediaQliHa, resaPerVarieta (qli/ha) | resaMediaKgHa, resaPerSpecie (kg/ha) | Ok: frutteto resta kg/ha e “per specie”. |
| **Spese “raccolta”** | speseVendemmiaAnno | speseRaccoltaAnno | Ok: concetto equivalente (costo delle vendemmie vs costo delle raccolte). |
| **Costo totale anno** | costoTotaleAnno (sempre da aggregaSpeseVignetoAnno) | speseTotaleAnno (da aggregaSpeseFruttetoAnno) | Allineare: esporre anche **costoTotaleAnno** (alias di speseTotaleAnno) per coerenza con vigneto e con dashboard che già mostra “spese totali”. |
| **Produzione per mese** | produzionePerMese (chiave anno-mese) | produzionePerMese | Ok: già presente. |
| **Spese per mese** | spesePerMese (da vendemmie + lavori) | spesePerMese (da raccolte + calcolo costi per ogni lavoro) | Ottimizzare: evitare N chiamate a calcolaCostiLavoro; usare una logica in batch o aggregazioni (vedi sotto). |
| **Ottimizzazione** | Usa getStatisticheAggregate quando disponibile; getVendemmieRange per range anni | Solo calcolo da getRaccolte + getLavoriPerTerreno + calcolaCostiLavoro per ogni lavoro | Introdurre (opzionale ma consigliato) **frutteto-statistiche-aggregate-service** e/o **getRaccolteRange**; ridurre chiamate calcolaCostiLavoro. |
| **Campo costo raccolta** | Vendemmia.costoTotale | Statistiche usano `raccolta.costoRaccolta` | **Correzione**: in RaccoltaFrutta il campo è **costoTotale**, non costoRaccolta. Nelle statistiche usare **costoTotale** (o alias costoRaccolta = costoTotale) per speseRaccoltaAnno e spesePerMese da raccolte. |

### 2.2 Elenco “recenti” (vendemmie / raccolte)

| Aspetto | Vigneto | Frutteto | Adeguamento frutteto |
|--------|---------|----------|----------------------|
| **Funzione** | getVendemmieRecenti(vignetoId, anno, limit) | getRaccolteRecenti(fruttetoId, anno, limit) | Nessuno: già allineata. |
| **Contenuto** | Oggetti con vignetoNome, vignetoId | Oggetti con fruttetoNome, fruttetoId | Ok. |

### 2.3 Lavori (e attività diario) collegati al terreno

| Aspetto | Vigneto | Frutteto | Adeguamento frutteto |
|--------|---------|----------|----------------------|
| **Funzione** | getLavoriVigneto(vignetoId, anno, stato, limit) | getLavoriFrutteto(fruttetoId, anno, stato, limit) | Nessuno: già allineata. |
| **Source** | 'lavoro' \| 'diario' | 'lavoro' \| 'diario' | Ok. Vigneto usa costi.costoTotale nelle attività diario; frutteto usa costoTotale: verificare che la chiave sia la stessa dove la UI si aspetta costoTotale. |

### 2.4 Produzione temporale (ultimi N anni)

| Aspetto | Vigneto | Frutteto | Adeguamento frutteto |
|--------|---------|----------|----------------------|
| **Funzione** | getProduzioneTemporale(vignetoId, anniIndietro) | **Assente** | **Aggiungere** getProduzioneTemporale(fruttetoId, anniIndietro). |
| **Ritorno** | `{ anni: number[], produzione: number[] }` (qli) | – | `{ anni: number[], produzione: number[] }` in **kg**. |
| **Implementazione vigneto** | Usa getProduzioneTemporaleAggregata se singolo vigneto, altrimenti getVendemmieRange + aggregazione per anno | – | Frutteto: caricare raccolte per range anni (getRaccolteRange o loop getRaccolte per anno), sommare quantitaKg per anno. Se si introduce aggregate, prevedere getProduzioneTemporaleAggregata. |

### 2.5 Qualità (uva vs frutta)

| Aspetto | Vigneto | Frutteto | Adeguamento frutteto |
|--------|---------|----------|----------------------|
| **Funzione** | getQualitaUva(vignetoId, anno) | **Assente** | **Aggiungere** getQualitaFrutta(fruttetoId, anno) con struttura adatta alla frutta. |
| **Dati vigneto** | Per varietà: gradazioneMedia, aciditaMedia, pHMedio, quantitaQli (numerici) | RaccoltaFrutta: calibro, gradoMaturazione, colore (testuali/categorici) | Frutteto non ha “gradazione/pH”: ha **calibro**, **gradoMaturazione**, **colore**. |
| **Ritorno suggerito** | Per varietà: medie + quantitaQli | Per specie/varietà: distribuzioni o medie dove sensato; quantitaKg. Es.: per specie: `{ calibro: { 'S' : 120, 'M' : 300 }, gradoMaturazione: { 'Ottimale' : 400 }, colore: {...}, quantitaKg }` oppure liste per grafici a barre. | Definire formato (es. conteggi per categoria calibro/maturazione/colore) e grafici conseguenti (barre o torta) invece di grafici “gradazione/acidità/pH”. |

### 2.6 Costi temporale (ultimi N anni per categoria)

| Aspetto | Vigneto | Frutteto | Adeguamento frutteto |
|--------|---------|----------|----------------------|
| **Funzione** | getCostiTemporale(vignetoId, anniIndietro) | **Assente** | **Aggiungere** getCostiTemporale(fruttetoId, anniIndietro). |
| **Ritorno** | anni, manodopera, macchine, prodotti, cantina, altro, totale (array per anno) | – | Stessa struttura; per frutteto **cantina** e **altro** possono essere 0 (o rimappare “altro” se in futuro si aggiungono categorie). |
| **Fonte dati vigneto** | aggregaSpeseVignetoAnno per ogni anno (e per ogni vigneto se “tutti”) | aggregaSpeseFruttetoAnno ha: speseManodoperaAnno, speseMacchineAnno, speseProdottiAnno, speseRaccoltaAnno, speseTotaleAnno | Mappare: manodopera, macchine, prodotti; cantina=0, altro=0 (o includere speseRaccoltaAnno in “altro” o in una voce dedicata “raccolta” se si vuole grafico a parte). Totale = speseTotaleAnno. |

---

## 3. Servizio aggregazioni (statistiche pre-calcolate)

### Vigneto
- **vigneto-statistiche-aggregate-service.js**:
  - `calcolaEAggiornaStatistiche(vignetoId, anno)` – calcola da vendemmie + aggregaSpeseVignetoAnno e salva in `statistiche_vigneto/{vignetoId}_{anno}`.
  - `getStatisticheAggregate(vignetoId, anno, forceRecalc)` – legge documento o ricalcola.
  - `invalidaStatistiche(vignetoId, anno)`.
  - `getProduzioneTemporaleAggregata`, `getCostiTemporaleAggregati` – leggono i documenti per più anni.

### Frutteto – Adeguamento
- **Aggiungere** (opzionale ma consigliato per performance):
  - **frutteto-statistiche-aggregate-service.js** con:
    - Collezione Firestore tipo `statistiche_frutteto/{fruttetoId}_{anno}`.
    - `calcolaEAggiornaStatistiche(fruttetoId, anno)` da raccolte + aggregaSpeseFruttetoAnno; salvare produzioneTotaleKg, resaPerSpecie, produzionePerMese, spesePerMese, eventuale qualitaFrutta (aggregato calibro/maturazione/colore), speseManodoperaAnno, speseMacchineAnno, speseProdottiAnno, speseTotaleAnno.
    - `getStatisticheAggregate(fruttetoId, anno, forceRecalc)`.
    - `invalidaStatistiche(fruttetoId, anno)`.
    - Se si vuole simmetria con vigneto: `getProduzioneTemporaleAggregata`, `getCostiTemporaleAggregati` che leggono i documenti per più anni.
- **Trigger**: dopo salvataggio/aggiornamento lavori (lavori-frutteto-service) e dopo create/update/delete raccolta frutta (raccolta-frutta-service) chiamare `calcolaEAggiornaStatistiche` in background (senza bloccare la risposta).

---

## 4. Ottimizzazioni calcolo al volo (se non si usano subito le aggregazioni)

- **getRaccolteRange(fruttetoIds, annoInizio, annoFine)** (analoga a getVendemmieRange): una query (o una per frutteto) per caricare le raccolte nel range, poi aggregare per anno/mese in memoria. Evita N chiamate getRaccolte.
- **Spese per mese**: oggi in getStatisticheFrutteto per ogni lavoro si chiama calcolaCostiLavoro. Alternative: (1) usare i costi già presenti sul lavoro se affidabili; (2) calcolare le spese totali solo con aggregaSpeseFruttetoAnno e non scomporre per mese (come compromesso); (3) introdurre le aggregazioni e leggere spesePerMese da lì.

---

## 5. UI: Dashboard e pagina Statistiche

### Dashboard
- **Vigneto**: card con produzione (qli), resa (qli/ha), spese vendemmia, **costo totale anno**, numero vigneti/vendemmie, data ultima vendemmia; sottotitoli da produzionePerMese, resaPerVarieta, spesePerMese; link a **vigneto-statistiche-standalone.html**.
- **Frutteto**: card con produzione (kg), resa (kg/ha), **spese totale anno**, numero frutteti/raccolte, sottotitoli da produzionePerMese, resaPerSpecie, spesePerMese; link “Statistiche e Grafici” con **href="#"** e testo “Statistiche frutteto in sviluppo”.

**Adeguamento**:
- Allineare etichetta/concetto “costo totale anno” (es. usare costoTotaleAnno nel JSON e “Costo totale anno” in UI se si vuole coerenza con vigneto).
- Sostituire il link con **frutteto-statistiche-standalone.html** (da creare) quando la pagina statistiche frutteto sarà implementata.

### Pagina Statistiche dedicata
- **Vigneto**: **vigneto-statistiche-standalone.html** – filtri (vigneto, anno), cache sessionStorage, grafici: Produzione nel tempo, Resa per varietà, Produzione mensile, Gradazione, Acidità, pH, Costi nel tempo, Spese per categoria, Spese mensili (Chart.js).
- **Frutteto**: **Manca** frutteto-statistiche-standalone.html.

**Adeguamento**:
- Creare **frutteto-statistiche-standalone.html** con:
  - Filtri: frutteto (singolo / “Tutti”), anno.
  - Grafici da replicare/adattare:
    - Produzione nel tempo (kg) – dati da getProduzioneTemporale.
    - Resa per specie (kg/ha) – da getStatisticheFrutteto.resaPerSpecie.
    - Produzione mensile (kg) – da getStatisticheFrutteto.produzionePerMese.
    - Qualità frutta: non gradazione/acidità/pH ma **calibro / grado maturazione / colore** (conteggi o distribuzione) – dati da getQualitaFrutta.
    - Costi nel tempo (€) – da getCostiTemporale (stesse categorie: manodopera, macchine, prodotti, totale; cantina/altro eventualmente 0 o “altro”).
    - Spese per categoria (anno corrente) – da getStatisticheFrutteto o da un breakdown di aggregaSpeseFruttetoAnno (manodopera, macchine, prodotti, raccolta se distinto).
    - Spese mensili (€) – da getStatisticheFrutteto.spesePerMese.
  - Cache e caricamento progressivo come in vigneto (opzionale ma consigliato).

---

## 6. Riepilogo adeguamenti

1. **frutteto-statistiche-service.js**
   - Correggere uso costo raccolta: usare **costoTotale** (RaccoltaFrutta) invece di costoRaccolta per speseRaccoltaAnno e spesePerMese.
   - Esporre **costoTotaleAnno** (alias di speseTotaleAnno) nell’oggetto ritornato da getStatisticheFrutteto per coerenza con vigneto.
   - Aggiungere **getProduzioneTemporale(fruttetoId, anniIndietro)** → `{ anni, produzione }` in kg.
   - Aggiungere **getQualitaFrutta(fruttetoId, anno)** → struttura per specie/varietà con calibro, gradoMaturazione, colore (e quantitaKg).
   - Aggiungere **getCostiTemporale(fruttetoId, anniIndietro)** → anni + array manodopera, macchine, prodotti, cantina, altro, totale (cantina/altro a 0 o mappati).
   - Ottimizzare getStatisticheFrutteto: introdurre **getRaccolteRange** (o equivalente) e ridurre chiamate a calcolaCostiLavoro; opzionale uso di getStatisticheAggregate quando esisterà il servizio aggregate.

2. **frutteto-statistiche-aggregate-service.js** (nuovo, opzionale)
   - Calcolo e salvataggio statistiche in `statistiche_frutteto/{fruttetoId}_{anno}`.
   - getStatisticheAggregate, invalidaStatistiche, getProduzioneTemporaleAggregata, getCostiTemporaleAggregati.
   - Chiamate a calcolaEAggiornaStatistiche da lavori-frutteto-service e raccolta-frutta-service (in background).

3. **lavori-frutteto-service**
   - Se si introduce l’aggregate: dopo salvataggio/aggiornamento lavoro chiamare calcolaEAggiornaStatistiche(fruttetoId, anno) in background.

4. **raccolta-frutta-service**
   - Se si introduce l’aggregate: dopo create/update/delete raccolta chiamare calcolaEAggiornaStatistiche(fruttetoId, anno) in background.

5. **UI**
   - Dashboard frutteto: link “Statistiche e Grafici” → **frutteto-statistiche-standalone.html** (quando pronta).
   - Nuova pagina **frutteto-statistiche-standalone.html** con filtri e grafici (produzione tempo, resa per specie, produzione mensile, qualità frutta, costi tempo, spese categoria, spese mensili).

6. **Naming e Firestore**
   - Decidere se in frutteto si usa sempre **speseTotaleAnno** o anche **costoTotaleAnno** nei documenti/API (per coerenza con vigneto e con altre parti dell’app che già usano costoTotaleAnno).
   - Regole Firestore: aggiungere lettura/scrittura per `statistiche_frutteto` se si introduce il servizio aggregate.

---

## 7. Ordine consigliato di implementazione (solo piano, senza codice)

1. Correzione **costoRaccolta → costoTotale** e **costoTotaleAnno** in getStatisticheFrutteto.
2. **getProduzioneTemporale** e **getCostiTemporale** (solo calcolo al volo, senza aggregate).
3. **getQualitaFrutta** (formato dati + eventuale uso in futuro in dashboard).
4. Ottimizzazione **getRaccolteRange** e riduzione chiamate **calcolaCostiLavoro** in getStatisticheFrutteto.
5. Creazione **frutteto-statistiche-standalone.html** e collegamento dalla dashboard.
6. (Opzionale) **frutteto-statistiche-aggregate-service** + trigger + uso nel service principale e in getProduzioneTemporale/getCostiTemporale.

Fine del documento.
