# Specifica: Sezione Reti Antigrandine nel Calcolo Materiali

Documento di definizione per l’aggiunta della sezione **Reti antigrandine** nel modal di configurazione e nel calcolo materiali (pianificazione impianto).

---

## 1. Obiettivo

- Aggiungere un **checkbox** “Impianto reti antigrandine” nella **Configurazione Calcolo Materiali**.
- Se il checkbox è **attivo**, mostrare una **sottosezione dedicata** con i parametri della struttura antigrandine (tipo struttura, distanza pali, altezza, cavi, ancore).
- Il **calcolo materiali** deve restituire, oltre ai materiali dell’impianto (pali, fili, tutori, ecc.), anche i **materiali antigrandine** (pali antigrandine, cavi/funi, tiranti/ancore, rete in m²) quando il checkbox è selezionato.
- I dati di **terreno/impianto** (numero file, lunghezza filari, superficie, distanza tra file) sono già disponibili dalla **pianificazione** selezionata.

---

## 2. Posizione nel modal

- **Dove**: nella stessa sezione **“Configurazione Calcolo Materiali”** (`#config-section`), **dopo** i campi attuali (dopo “Fissaggio Tutori” e prima dei pulsanti “Calcola Materiali” / “Reset”).
- **Checkbox**: una sola riga con label tipo “Impianto reti antigrandine” e checkbox. Se **non** flaggato: la sottosezione antigrandine è **nascosta** e il calcolo non include materiali antigrandine. Se **flaggato**: la sottosezione antigrandine è **visibile** e il calcolo include i materiali antigrandine.
- **Sottosezione**: un blocco (es. `#config-antigrandine`) con titolo “Configurazione Reti Antigrandine” e i campi sotto elencati. Visibile solo se `checkbox === true`.

---

## 3. Campi della sottosezione “Reti Antigrandine”

Tutti i campi sono **opzionali** come valori espliciti; dove indicato si usano **default** in base al tipo struttura.

| Campo | Tipo | Default | Note |
|-------|------|---------|------|
| **Tipo struttura** | Select | Rete piana | Opzioni: **Rete piana**, **Capannina**, **Sistema a V**. Influenza default di distanza pali e altezza. |
| **Distanza tra pali (m)** | Number, min 4, max 12, step 0.5 | 8 (rete piana), 10 (capannina), 8 (V) | Distanza tra i pali **lungo il filare** (e, se applicabile, in direzione trasversale). |
| **Altezza pali fuori terra (m)** | Number, min 3, max 6, step 0.1 | 4 (rete piana), 4.5 (capannina), 4 (V) | Altezza utile del palo per il sostegno della rete. |
| **Diametro cavi/funi (mm)** | Number o Select | 6 | Valori tipici: 5, 6, 7 mm (acciaio zincato). |
| **Usa tiranti/ancore** | Select (Sì/No) | Sì | Per pali di testata (e angoli). Sempre consigliato per strutture tese. |

**Note UI:**

- Breve testo di aiuto sotto “Tipo struttura”: es. “Rete piana: più economica, 8 m tra pali. Capannina: struttura più alta, 10 m tra pali.”
- Placeholder/default coerenti con il tipo struttura selezionato (es. cambio tipo → aggiornare default distanza e altezza).

---

## 4. Dati dalla pianificazione (già disponibili)

Da **pianificazione** e **reticolato** si usano (come già nel calcolo materiali impianto):

- **numeroFile** – numero di filari.
- **lunghezzaFilariTotale** – somma delle lunghezze di tutti i filari (m). Se non presente, stima da `superficieNettaImpianto` e `numeroFile`.
- **lunghezzaMediaFila** – `lunghezzaFilariTotale / numeroFile` (m).
- **superficieNettaImpianto** – superficie netta (Ha).
- **distanzaFile** – distanza tra i file (m); se non in pianificazione, usare un default (es. da config coltura o 3–4 m).

Questi valori sono gli **input** per le formule sotto.

---

## 5. Logica di calcolo materiali antigrandine

Si assume una struttura a **filari**: i pali sono disposti lungo ogni filare ogni `distanzaPaliAntigrandine` metri, con **2 pali di testata** per filare (inizio e fine). I cavi corrono lungo i filari (colmo) e in direzione trasversale tra i filari.

### 5.1 Pali

- **Pali per filare** = `ceil(lunghezzaMediaFila / distanzaPaliAntigrandine) + 2`  
  (intermedi + 2 testata).
- **Pali totali** = `numeroFile * paliPerFila`.
- **Pali di testata** = `2 * numeroFile`.
- **Pali intermedi** = `pali totali - pali di testata`.

**Unità**: pezzi.  
**Descrizione**: es. “Pali antigrandine (cemento/ferro), h = X m fuori terra”.

### 5.2 Cavi / funi

- **Cavi longitudinali (colmo)**  
  - 1 cavo di colmo per filare (lungo la fila).  
  - **Lunghezza colmo** = `numeroFile * lunghezzaMediaFila` (m).

- **Cavi trasversali**  
  - Tratte trasversali tra filari adiacenti: tra ogni coppia di filari c’è una tratta di lunghezza ≈ `distanzaFile`; le tratte sono tante quante le “campate” tra pali lungo il filare.  
  - **Numero tratte trasversali** = `(paliPerFila - 1)` (o equivalente in base allo schema scelto).  
  - **Lunghezza trasversale** per una campata = `(numeroFile - 1) * distanzaFile`.  
  - **Lunghezza totale cavi trasversali** = `(paliPerFila - 1) * (numeroFile - 1) * distanzaFile` (m).

- **Totale cavi** = lunghezza colmo + lunghezza trasversali (m).  
  In output si può riportare **totale metri** e, opzionalmente, “Colmo: X m” e “Trasversali: Y m”.

**Unità**: m.  
**Descrizione**: es. “Cavi/funi acciaio zincato Ø X mm per struttura antigrandine”.

### 5.3 Tiranti / ancore

- **Ancore** = **pali di testata** (ogni palo di testata ancorato):  
  `numeroAncore = 2 * numeroFile`.

**Unità**: pezzi.  
**Descrizione**: es. “Tiranti/ancore per pali di testata antigrandine”.

### 5.4 Rete antigrandine

- **Superficie coperta** ≈ area del blocco filari con eventuale margine.  
  Approssimazione:  
  **Superficie rete (m²)** = `superficieNettaImpianto * 10000 * fattoreMargine`  
  con `fattoreMargine` = es. 1.05–1.10 (5–10% per sovrapposizioni/margini).  
  Alternativa: `larghezzaCopertura * lunghezzaTotale` con `larghezzaCopertura = (numeroFile - 1) * distanzaFile + margini`.

**Unità**: m².  
**Descrizione**: es. “Rete antigrandine HDPE (m²)”.

### 5.5 Accessori (solo indicativo)

- **Placchette / clip fissaggio**: quantità indicativa (es. 1 ogni 1–2 m di perimetro o a fornitore). Opzionale in prima versione.
- **Copripali**: numero = pali totali. Opzionale in prima versione.

In fase 1 si può omettere dal calcolo automatico e lasciare solo “da definire in cantiere” o introdurre in seguito.

---

## 6. Default per “Tipo struttura”

| Tipo struttura | Distanza pali (m) | Altezza pali (m) |
|----------------|-------------------|-------------------|
| Rete piana     | 8                 | 4                 |
| Capannina      | 10                | 4.5               |
| Sistema a V    | 8                 | 4                 |

Alla **selezione del tipo** nella UI, aggiornare i campi “Distanza tra pali” e “Altezza pali” con questi default (l’utente può comunque modificarli).

---

## 7. Output in “Materiali Necessari”

Quando **checkbox antigrandine = sì**, nella sezione risultati “Materiali Necessari” aggiungere una **sottosezione** (o gruppo) **“Reti antigrandine”** con righe tipo:

| Categoria / Materiale | Quantità | Unità | Descrizione |
|------------------------|----------|--------|-------------|
| Pali antigrandine (testata) | … | pezzi | … |
| Pali antigrandine (intermedi) | … | pezzi | … |
| Pali antigrandine (totale) | … | pezzi | … |
| Cavi/funi struttura | … | m | Ø X mm |
| Tiranti/ancore | … | pezzi | … |
| Rete antigrandine | … | m² | … |

Formattazione e raggruppamento allineati al resto della tabella materiali (es. stessa classe/stile “antigrandine”).

---

## 8. Riepilogo flusso

1. Utente seleziona una **pianificazione** (come oggi).
2. Compila i campi della **configurazione calcolo materiali** (tipo impianto/forma, pali, fili, ecc.).
3. **Checkbox “Impianto reti antigrandine”**: se **no** → nessun campo antigrandine e nessun output antigrandine. Se **sì** → si mostra la sottosezione “Configurazione Reti Antigrandine”.
4. In sottosezione antigrandine: **tipo struttura** (con default distanza/altezza), **distanza pali**, **altezza pali**, **diametro cavi**, **usa tiranti/ancore**.
5. Clic su **“Calcola Materiali”**: il servizio calcola sia i **materiali impianto** (come oggi) sia i **materiali antigrandine** (pali, cavi, ancore, m² rete) usando pianificazione + config antigrandine.
6. In **“Materiali Necessari”** vengono mostrati prima i materiali impianto, poi il blocco “Reti antigrandine” (solo se checkbox era attivo).

---

## 9. Estensioni future (non in scope ora)

- Rete antigrandine in **m²** per **rotoli** (lunghezza × altezza commerciale).
- Dettaglio accessori (placchette, copripali, numero pezzi).
- Config/etichette **per coltura** (vigneto vs frutteto) per la sezione antigrandine, se necessario.
- Export PDF che includa anche la tabella “Reti antigrandine”.

---

*Specifica v1 – Sezione Reti Antigrandine nel Calcolo Materiali.*
