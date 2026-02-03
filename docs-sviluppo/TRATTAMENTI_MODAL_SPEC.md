# Specifiche modal Trattamenti (Vigneto / Frutteto)

Documento di definizione per: dati base + macchine, costi precompilati, zona mappa, tabella righe prodotto.

---

## 1. Dati base (tabella sola lettura)

**Obiettivo:** mostrare nel modal i dati provenienti dal lavoro o dall’attività collegata, in sola lettura.

**Campi attuali:** Data, Terreno, Riferimento (lavoro/attività).

**Aggiunta:**

- **Macchine impiegate**  
  Tabella read-only (come in Potatura), con colonne:
  - **Tipo** (es. Trattore, Attrezzo)
  - **Nome** (macchina/attrezzo)
  - **Ore**

**Fonte dati macchine:**

- Se **lavoro** collegato: da `lavori/{lavoroId}/oreOperai` (ore macchina/attrezzo) aggregate per macchina/attrezzo; eventuale risoluzione nomi da modulo Parco Macchine.
- Se solo **attività** collegata: da attività (es. `macchinaId`/`attrezzoId`, `oreMacchina`/`oreNette`), una riga per macchina/attrezzo.

Se non ci sono macchine, la tabella può restare nascosta o mostrare “Nessuna macchina”.

---

## 2. Costi precompilati (manodopera e macchine)

**Obiettivo:** all’apertura del modal, i campi “Costo manodopera (€)” e “Costo macchina (€)” devono essere precompilati quando il trattamento è collegato a un lavoro o a un’attività.

**Regole:**

- **Se collegato a lavoro**
  - Usare `calcolaCostiLavoro(lavoroId, lavoro)` (da `lavori-vigneto-service.js` o equivalente Frutteto).
  - Precompilare:
    - **Costo manodopera** = `costi.costoManodopera`
    - **Costo macchina** = `costi.costoMacchine`
- **Se collegato solo ad attività (senza lavoro)**
  - **Costo manodopera:** `oreNette * tariffaProprietario` (come in Potatura/Vendemmia).
  - **Costo macchina:** se l’attività ha `macchinaId` o `attrezzoId` e `oreMacchina` (o equivalente), e il Parco Macchine fornisce `costoOra`, allora `costoMacchina = oreMacchina * costoOra`.

Comportamento: stesse logiche già usate in Potatura/Vendemmia (prefill all’apertura; in salvataggio, se i campi sono ancora 0 e c’è lavoro/attività, ricalcolo come in Potatura).

---

## 3. Zona lavorata sulla mappa

**Obiettivo:** in modal Trattamenti poter vedere (e, se previsto, tracciare) la zona lavorata, allineato a Potatura/Vendemmia.

**Regole:**

1. **Trattamento collegato a lavoro**
   - Le zone sono gestite in **Gestione Lavori** (subcollection `lavori/{lavoroId}/zoneLavorate`).
   - Nel modal Trattamenti: **sola consultazione** (come in Potatura: “La zona è tracciata nel lavoro collegato – per modificarla vai alla Gestione Lavori”).
   - Mostrare le zone del lavoro sulla mappa (lettura da `zoneLavorate`), senza pulsanti di modifica.

2. **Trattamento collegato solo ad attività (senza lavoro)**
   - Se in futuro le attività avranno zone proprie, si potranno mostrare in sola lettura.
   - Alternativa: permettere di **tracciare una zona nel modal Trattamenti** e salvarla sul **trattamento** (es. campo `poligonoTrattamento` + eventuale `superficieTrattata` da mappa), senza toccare l’attività.

3. **Implementazione tecnica**
   - Reutilizzare pattern Potatura: modal mappa, pulsante “Traccia”/“Visualizza zona”, caricamento coordinate da lavoro (`zoneLavorate`) o da trattamento (`poligonoTrattamento`).
   - Se fonte = lavoro: messaggio “sola consultazione” e nessun salvataggio zona dal modal Trattamenti.

---

## 4. Tabella righe prodotto (più prodotti per trattamento)

**Obiettivo:** un trattamento può avere **più prodotti**. Per ogni riga: quantità e costo sono **calcolati** a partire da dosaggio, superficie trattata e dati dell’anagrafica prodotto. Giorni di carenza e dosaggio consigliato sono in **anagrafica prodotto**; se non rispettati si mostrano **alert**.

### 4.1 Anagrafica prodotto (fonte dati)

L’anagrafica prodotto (catalogo / magazzino) deve contenere, per ogni prodotto:

- **Dosaggio consigliato** – valore + unità per ha (es. 3 kg/ha, 200 ml/ha). Stessa unità usata per la quantità impiegata (kg o L).
- **Costo unitario** – prezzo per unità (€/kg, €/L o €/confezione). Deve essere coerente con l’unità del dosaggio (es. se dosaggio in kg/ha, costo in €/kg).
- **Giorni di carenza** – periodo di carenza obbligatorio (es. 30 giorni).

Coerenza: la **quantità impiegata** è nella stessa unità del costo unitario (es. kg), così il costo riga = quantità × costo unitario senza conversioni aggiuntive.

### 4.2 Struttura tabella (UI)

Tabella editabile (stile tabella operai Vendemmia):

- **Aggiungi prodotto:** pulsante “➕ Aggiungi prodotto” che inserisce una riga (selezione prodotto da anagrafica o, in assenza, testo libero).
- **Colonne per riga:**
  - **Prodotto** (obbligatorio) – selezione da anagrafica o nome (testo) se anagrafica non disponibile.
  - **Dosaggio** (obbligatorio) – valore per ha usato in questo trattamento (es. 3 kg/ha). Default da “dosaggio consigliato” dell’anagrafica, modificabile.
  - **Quantità** (sola lettura / calcolata) – **calcolata** come: (dosaggio per ha) × (superficie trattata). Stessa unità del dosaggio (kg, L). Eventuale override manuale solo se richiesto (con warning “Valore modificato rispetto al calcolo”).
  - **Costo (€)** (sola lettura / calcolato) – **calcolato** come: quantità × costo unitario prodotto (da anagrafica). Eventuale override solo se richiesto.
  - **Azioni** – pulsante elimina riga (🗑️).

- **Totale:** riga di totali (es. “Totale costo prodotti: X €”) sotto la tabella.

**Nessuna colonna “Giorni di carenza”** in tabella: i giorni di carenza si leggono dall’anagrafica prodotto. In modal si può mostrare un’info tipo “Raccolta consentita da [data]” (vedi 4.5).

### 4.3 Regole di calcolo

- **Quantità riga** = (valore dosaggio per ha, nella stessa unità della quantità) × superficie trattata (ha).  
  Es.: dosaggio 3 kg/ha, superficie 2,5 ha → quantità = 7,5 kg.
- **Costo riga** = quantità × costo unitario prodotto (da anagrafica, nella stessa unità).  
  Es.: 7,5 kg × 2 €/kg = 15 €.
- **Costo prodotto totale** (trattamento) = somma dei costi di tutte le righe.

La **superficie trattata** è un dato a livello trattamento (da lavoro/attività o inserita); al suo cambiamento si ricalcolano quantità e costi di tutte le righe.

### 4.4 Alert (dosaggio e carenza)

- **Alert dosaggio:** se il dosaggio **usato** nella riga (valore per ha) è diverso dal **dosaggio consigliato** in anagrafica (o fuori da un eventuale range ammesso), mostrare un avviso, es. “Dosaggio inferiore/superiore al consigliato per [Prodotto]”.
- **Alert carenza:** se è pianificata una **raccolta** (es. vendemmia) prima della **data fine carenza** del trattamento, mostrare un alert. La data fine carenza del trattamento è: data trattamento + **massimo** tra i giorni di carenza dei prodotti usati (es. prodotto A 30 gg, B 21 gg → si usa 30 gg). L’alert può essere mostrato:
  - in fase di inserimento/modifica trattamento (info “Raccolta consentita da [data]”),
  - in fase di pianificazione raccolta (es. “Attenzione: raccolta prevista prima dello scadere della carenza per trattamento del [data]”).

### 4.5 Data raccolta consentita (trattamento)

- Con **più prodotti**, la data minima per la raccolta è quella **più restrittiva**: data trattamento + **max**(giorni di carenza dei prodotti della tabella), dove i giorni di carenza sono quelli in anagrafica prodotto.
- In modal Trattamenti: mostrare chiaramente “Raccolta consentita da [data]” (e opzionalmente i giorni per singolo prodotto se utile).

### 4.6 Modello dati (Firestore / modello Trattamento)

Sul documento trattamento:

- **`prodotti`** (array di oggetti), ogni elemento:
  - `prodottoId` (string, opzionale) – id prodotto in anagrafica (Fase 2 Magazzino)
  - `prodotto` (string) – nome prodotto (o da anagrafica)
  - `dosaggio` (number o string secondo unità) – valore dosaggio per ha usato (es. 3 per “3 kg/ha”)
  - `unitaDosaggio` (string, opzionale) – es. "kg/ha", "L/ha" per coerenza con quantità
  - `quantita` (number) – **calcolata** (dosaggio × superficie); eventualmente sovrascritta se override
  - `costo` (number) – **calcolato** (quantità × costo unitario); eventualmente sovrascritto se override

**Non** si salvano in ogni riga i giorni di carenza: si leggono dall’anagrafica prodotto quando serve (calcolo data raccolta consentita, alert).

Campi trattamento a livello globale:

- `costoProdotto`: **totale** = somma dei `costo` di tutte le righe (calcolato in salvataggio/lettura).
- `superficieTrattata`: usata per il calcolo quantità di tutte le righe.
- `costoManodopera`, `costoMacchina`, `operatore`, `parcella`, `note`, `tipoTrattamento`: come da resto specifiche.
- **Retrocompatibilità:** documenti con vecchio formato (singolo `prodotto`, `dosaggio`, `costoProdotto`, `giorniCarenza`) in lettura si mappano come una singola riga in `prodotti`; in salvataggio si usa sempre `prodotti` e `costoProdotto` = totale.

### 4.7 Validazione

- Almeno **una riga** prodotto.
- Per ogni riga: **Prodotto** e **Dosaggio** obbligatori.
- Dosaggio e quantità ≥ 0; costo ≥ 0.
- Superficie trattata presente e > 0 quando ci sono righe prodotti (per calcolo quantità/costo).

### 4.8 Fase 2 Magazzino

- Sostituire il campo Prodotto con **selezione da catalogo prodotti/magazzino** (id prodotto).
- Quantità calcolata e costo da anagrafica; eventuale **prelievo** da magazzino e collegamento riga trattamento → movimento.
- Anagrafica prodotto diventa la fonte unica per: dosaggio consigliato, costo unitario, giorni di carenza, unità di misura.

---

## 5. Ordine di implementazione suggerito

1. **Dati base + macchine** – estendere tabella sola lettura con “Macchine impiegate”.
2. **Costi precompilati** – prefill costo manodopera e costo macchina all’apertura (e ricalcolo in salvataggio se 0 e c’è lavoro/attività).
3. **Zona mappa** – consultazione zone da lavoro; eventuale traccia zona su trattamento se solo attività.
4. **Anagrafica prodotto** (se non esiste) – campi: dosaggio consigliato (valore + unità/ha), costo unitario (€/unità), giorni di carenza, unità di misura.
5. **Tabella righe prodotto** – colonne Prodotto, Dosaggio, Quantità (calcolata), Costo (calcolato), Azioni; calcolo quantità = dosaggio × superficie, costo = quantità × costo unitario; totale costo prodotti; validazione; retrocompatibilità.
6. **Alert** – dosaggio usato ≠ consigliato; raccolta prima della data fine carenza (data trattamento + max giorni carenza prodotti).
7. **Fase 2** – integrazione Magazzino (prodotto da catalogo, prelievi).

---

## 6. Riepilogo campi modal dopo le modifiche

- **Sezione “Dati da lavoro/attività (sola lettura)”**
  - Data, Terreno, Riferimento
  - **Macchine impiegate** (tabella: Tipo, Nome, Ore)

- **Costi**
  - Costo manodopera (€) – precompilato da lavoro/attività
  - Costo macchina (€) – precompilato da lavoro/attività

- **Tabella Prodotti**
  - Righe: **Prodotto** | **Dosaggio** (per ha, usato) | **Quantità** (calcolata: dosaggio × superficie) | **Costo (€)** (calcolato: quantità × costo unitario da anagrafica) | Azioni
  - Nessuna colonna "Giorni di carenza" (letti da anagrafica prodotto)
  - Totale costo prodotti (somma costi righe)
  - Info "Raccolta consentita da [data]" (data trattamento + max giorni carenza prodotti)
  - **Alert:** dosaggio ≠ consigliato; raccolta prima della data fine carenza

- **Anagrafica prodotto** (catalogo / magazzino)
  - Dosaggio consigliato (valore + unità/ha), costo unitario (€/unità), giorni di carenza, unità di misura

- **Altri campi**
  - Operatore, Superficie trattata (ha), Tipo trattamento, Parcella, Note
  - Pulsante “Traccia zona” / “Visualizza zona” e modal mappa (consultazione o tracciamento)

- **Salvataggio**
  - `prodotti[]` (prodotto, dosaggio, quantita, costo; quantità e costo calcolati), `costoProdotto` (totale), `costoManodopera`, `costoMacchina`, eventuale `poligonoTrattamento` e superficie da mappa.

Se vuoi, il passo successivo può essere l’implementazione in codice (a partire da punti 1 e 2, poi 3 e 4).
