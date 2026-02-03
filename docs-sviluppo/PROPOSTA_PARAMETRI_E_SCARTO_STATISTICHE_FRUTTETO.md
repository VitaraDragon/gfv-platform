# Proposta: parametri per i grafici e statistica sullo scarto – Statistiche Frutteto

Documento di proposta (senza codice): dove inserire i parametri che alimentano i grafici e come introdurre una statistica sullo scarto (totale + categorie).

---

## 0. Dove nell’app inseriamo i parametri (calibro, colore, scarto, ecc.)?

**Sì: vanno compilabili nel modal della gestione della raccolta.**

- **Pagina**: Modulo Frutteto → **Raccolta Frutta** (raccolta-frutta-standalone.html).
- **Punto preciso**: il **modal** che si apre quando l’utente clicca su **“Nuova raccolta”** oppure su una raccolta esistente per modificarla. Quel modal contiene il form con i dati della raccolta (specie, varietà, quantità kg, superficie ha, operai, macchine, note).
- **Parametri da inserire lì**:
  - **Calibro, Grado maturazione, Colore**: sono già nel modello RaccoltaFrutta ma **non sono oggi presenti nel form del modal**. Vanno aggiunti come campi compilabili nel modal (es. una sezione “Qualità” o “Parametri qualità” con tre campi: Calibro, Grado maturazione, Colore – select o testo).
  - **Scarto**: oggi non esiste né nel modello né nel form. Va aggiunto al modello (es. scartoTotaleKg + scarto per categoria) e al **medesimo modal** della raccolta: una sezione “Scarto” con campo “Scarto totale (kg)” e, se si vogliono le categorie, una tabella o una serie di campi “Scarto per categoria” (Danno fisico, Calibro fuori norma, Marciume, ecc.).

In sintesi: **tutti questi parametri (calibro, colore, grado maturazione, scarto totale e categorie) vanno inseriti e compilabili nel modal della gestione della raccolta**, così ogni raccolta porta con sé i dati qualità e scarto e le statistiche possono aggregarli.

---

## 1. Dove inserire i parametri per popolare i grafici

Oggi i grafici dipendono solo da **Frutteto** (singolo / Tutti) e **Anno**. Per dare più controllo all’utente e coerenza tra pagina e dati, si possono aggiungere altri parametri in questi punti.

### 1.1 Barra filtri esistente (consigliato come primo passo)

La sezione **Filtri** in alto (subito sotto l’header, sopra la griglia dei grafici) è il posto naturale per **tutti i parametri globali** che valgono per l’intera pagina:

- **Già presenti**: Frutteto, Anno.
- **Da aggiungere in barra**:
  - **Anni da considerare** (es. 3 / 5 / 10) per i grafici “Produzione nel tempo” e “Costi nel tempo”: stesso valore per entrambi, così l’utente sceglie una volta e i due grafici restano allineati.
  - **Specie** (opzionale): filtro “Tutte le specie” vs una specie specifica; utile se ci sono più specie e si vogliono grafici solo su una (resa per specie, qualità, ecc.).
  - **Varietà** (opzionale, magari dipendente da Specie): stesso concetto a livello varietà.

Tutti questi controlli possono stare nella stessa riga (o due righe su mobile) della barra filtri, con etichette chiare (es. “Frutteto”, “Anno”, “Ultimi … anni”, “Specie”, “Varietà”). Al cambio di qualsiasi parametro si ricalcolano e si aggiornano **tutti** i grafici.

**Vantaggio**: un solo “pannello comando”, comportamento prevedibile, nessun parametro nascosto.

### 1.2 Parametri per sezione (alternativa / estensione)

Se in futuro si vogliono **opzioni specifiche per gruppo di grafici** (senza appesantire la barra principale), si può prevedere:

- Una **sezione “Parametri”** (o “Opzioni”) **sopra la griglia**, ma **distinta** dalla barra filtri: ad es. box “Opzioni grafici temporali” con “Ultimi N anni” e magari “Tipo di dato” (solo produzione / solo costi / entrambi).
- Oppure **piccoli controlli sopra ogni grafico** (o sopra il primo di un gruppo), ad es. solo “Ultimi N anni” sopra “Produzione nel tempo” e “Costi nel tempo”.

La scelta dipende da quanti parametri si aggiungono: pochi → tutto in barra filtri; molti o molto specifici → sezione dedicata o controlli per blocco.

### 1.3 Riepilogo consiglio

- **Subito**: estendere la **barra filtri** con “Ultimi … anni” (3 / 5 / 10) e, se utile, “Specie” (e eventualmente “Varietà”).
- **Parametri** = tutto ciò che l’utente può cambiare per “popolare” i grafici (frutteto, anno, intervallo anni, specie/varietà). Restano in un unico punto in alto così è chiaro dove si controlla la pagina.

---

## 2. Statistica sullo scarto (totale + categorie)

### 2.1 Cosa intendere per “scarto”

In frutteto lo **scarto** è la parte di produzione **non commercializzata** (scartata in campo, in magazzino o in fase di selezione). Può essere espresso in **kg** (e/o percentuale sulla produzione) e suddiviso per **categoria** (motivo dello scarto).

Esempi di categorie:

- **Danno fisico** (urti, tagli, ecc.)
- **Calibro fuori norma** (sotto/sopra misura)
- **Marciume / alterazioni**
- **Maturazione non idonea**
- **Altro** (libero)

Le categorie possono essere predefinite in configurazione (lista fissa o modificabile dall’azienda) e l’utente, quando registra una raccolta (o un’operazione di selezione/scarto), indica kg scartati per categoria.

### 2.2 Dove raccogliere il dato

- **Opzione A – Nella scheda Raccolta**: nella stessa RaccoltaFrutta si aggiungono campi per lo scarto, ad es. `scartoTotaleKg` e dettaglio per categoria (es. `scartoPerCategoria: { dannoFisico: 10, calibroFuoriNorma: 5, ... }` oppure sottocollezione/liste). Così ogni raccolta può avere “produzione commercializzata” (già presente) e “scarto” (nuovo).
- **Opzione B – Registrazione separata**: “Scarto” come entità a sé (es. “Registrazione scarto” con data, frutteto/specie, kg totali, kg per categoria). Più flessibile se lo scarto avviene in momenti diversi dalla raccolta (es. in magazzino).
- **Opzione C – Solo in fase di selezione**: se lo scarto si fa sempre in un unico momento (es. al nastro), un modulo “Selezione / Scarto” con totali e categorie; le statistiche leggono da lì.

Per la **statistica** serve poter aggregare, per frutteto/anno (e eventualmente specie), **totale kg scartati** e **kg (o %) per categoria**.

### 2.3 Dove mostrare la statistica in pagina

- **Nuovo grafico “Scarto”** nella stessa griglia delle Statistiche Frutteto:
  - **Totale scarto (kg)** nel tempo (es. ultimi N anni, stesso parametro “Ultimi … anni” della barra filtri) – un grafico a barre o a linea.
  - **Scarto per categoria** (kg o %): un grafico a barre orizzontali o a torta con “Totale” + le categorie (Danno fisico, Calibro fuori norma, Marciume, ecc.) per l’anno (e frutteto/specie) selezionati.
- **Riquadro riepilogo** (opzionale): una card in alto o sopra i grafici con “Scarto totale anno” (kg e % sulla produzione) e una mini-breakdown per categoria (testo o mini-torta).

Posizione suggerita nella griglia: dopo “Produzione mensile” o dopo “Qualità” (Calibro / Maturazione / Colore), così produzione → qualità → scarto → costi restano in ordine logico. In alternativa: subito dopo “Resa per specie”, per mettere in evidenza resa vs scarto.

### 2.4 Parametro “totale” e “categorie”

- **Totale**: un unico valore “Scarto totale” (kg) per il periodo/frutteto/specie scelto; può essere mostrato in un grafico temporale (anno per anno) e nella card di riepilogo.
- **Categorie**: stesso periodo/filtri, ma dati scomposti per voce (Danno fisico, Calibro fuori norma, Marciume, …). In grafico: barre o torta “Scarto per categoria” (kg o %); in tabella/riepilogo: colonne “Totale” + una colonna per categoria.

I **parametri** che pilotano anche questa statistica sono gli stessi della pagina: Frutteto, Anno, “Ultimi N anni” (per il trend), eventualmente Specie/Varietà.

---

## 3. Riepilogo

| Tema | Proposta |
|------|----------|
| **Dove mettere i parametri** | Barra filtri unica in alto: Frutteto, Anno, “Ultimi … anni” (3/5/10), eventualmente Specie e Varietà. Stessa barra per tutti i grafici. |
| **Estensioni future** | Se servono molti parametri: sezione “Opzioni” sopra la griglia o piccoli controlli per blocco di grafici. |
| **Scarto – definizione** | Kg (e/o %) di produzione non commercializzata, con totale + categorie (es. Danno fisico, Calibro fuori norma, Marciume, Maturazione non idonea, Altro). |
| **Scarto – dove raccogliere** | In RaccoltaFrutta (campi scarto) o in una registrazione “Scarto” separata; l’importante è poter aggregare per frutteto/anno/specie. |
| **Scarto – dove mostrare** | Nuovo grafico “Scarto totale nel tempo” + grafico “Scarto per categoria” (kg o %); opzionale card riepilogo “Scarto anno” con totale e categorie. |
| **Scarto – parametri** | Stessi della pagina: Frutteto, Anno, Ultimi N anni, eventualmente Specie/Varietà. |

Fine del documento.
