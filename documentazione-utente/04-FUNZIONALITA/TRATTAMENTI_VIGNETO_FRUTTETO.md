# 🌿 Trattamenti Vigneto e Frutteto

Guida al modal **Completa trattamento** nei moduli Vigneto e Frutteto: mappa per la superficie trattata, tabella prodotti multipli, calcolo quantità e costi.

---

## 🎯 Obiettivi

- Completare un’attività di trattamento indicando **superficie trattata**, **prodotti usati** (anche più di uno), dosaggi e costi
- Tracciare la **zona trattata** sulla mappa con snap al confine del terreno e validazione
- Calcolare automaticamente **quantità** (dosaggio × superficie) e **costo totale prodotti** per ogni riga e in totale

---

## 👥 Ruoli e percorso

- **Manager** e **Amministratore** (pieno accesso)
- **Caposquadra / Operaio**: possono aprire il modal da lavoro/attività per completare il trattamento

**Percorso**: Dashboard → modulo **Vigneto** o **Frutteto** → **Trattamenti** → da lista lavori/attività apri il trattamento e clicca **Completa** (o **Modifica** per modificare un trattamento già salvato).

---

## ⚡ Lista trattamenti

Il caricamento dell’elenco (lavori e attività di categoria “Trattamenti”) è ottimizzato lato applicazione: con molti vigneti/frutteti o molti dati storici dovresti notare tempi di attesa più brevi rispetto a versioni precedenti.

---

## 📋 Modal “Completa trattamento”

Il modal contiene:

1. **Dati da lavoro/attività** (sola lettura): terreno, tipo lavoro, data, operatore, **macchine impiegate**
2. **Superficie trattata (ha)** – subito sotto le macchine:
   - **Opzione “Tutto il terreno”**: se attivi la casella, la superficie viene presa dall’**anagrafe del terreno** (stesso valore in archivio), con decimali allineati al dato ufficiale: non serve aprire la mappa per definire l’area quando hai trattato l’intero appezzamento. Il campo superficie è in sola lettura e il pulsante mappa resta disabilitato per questo caso.
   - Se **non** usi l’opzione (es. trattamento su una parte del terreno), compili o modifichi gli ha a mano e puoi usare il pulsante **Traccia** per aprire la **mappa** e disegnare il poligono della zona trattata.
   - La casella è disponibile solo se sul **terreno** è già indicata la **superficie** in anagrafe; altrimenti compare un messaggio che invita a completarla.
3. **Prodotti**: tabella con più righe (prodotto, dosaggio per ha, unità, quantità calcolata, costo €) e totale costo prodotti
4. **Costo manodopera** (opzionale) e **Note**

L’ordine è pensato per compilare prima macchine e superficie, poi aggiungere le righe prodotti: quantità e costi si aggiornano in base alla superficie.

---

## 🗺️ Mappa – Tracciamento superficie

- Se hai scelto **superficie da anagrafe (tutto il terreno)**, non è necessario usare la mappa per l’area: il pulsante **Traccia** resta disabilitato.
- Clic su **Traccia** (quando attivo) apre un modal con la mappa del terreno. Puoi **tracciare un poligono** per definire la zona trattata.
- **Avvio**: clic su **Traccia poligono**; il cursore diventa a croce. Clicca sulla mappa per aggiungere i vertici.
- **Snap e validazione**:
  - I punti si **agganciano** al confine del terreno (bordo) o ai vertici esistenti quando sei vicino, con indicazione visiva (es. marker verde).
  - I punti devono restare **entro il confine** del terreno; se clicchi fuori, il sistema può spostare il punto sul bordo (tolleranza circa 3 m) per evitare geometrie invalide.
- **Pausa**: puoi mettere in **Pausa tracciamento** senza cancellare il poligono; riprendi con **Traccia poligono** per aggiungere altri vertici.
- **Chiusura**: **doppio clic** per chiudere il poligono, oppure clic **vicino al primo punto** per chiudere automaticamente.
- **Elimina**: **Elimina poligono** cancella il disegno; puoi ridisegnare da capo.
- **Chiudi**: chiudendo il modal, la **superficie (ha)** viene aggiornata nel form del trattamento (se il poligono è valido).

Comportamento allineato a quello della mappa in **Vendemmia** (snap, pausa, validazione entro confine).

---

## 📦 Tabella Prodotti

- **Colonne**: Prodotto (dropdown dall’anagrafica Magazzino + opzione “Altro (testo libero)”), Dosaggio (per ha), Unità, Quantità (calcolata), Costo (€).
- **Prodotto**: scegli dall’anagrafica Prodotti e Magazzino; per prodotti con **dosaggio min/max** e **giorni di carenza** in anagrafica, il sistema li usa per calcoli e (quando previsto) per avvisi su dose e data raccolta consentita.
- **Dosaggio (per ha)**: valore numerico; per prodotti dall’anagrafica l’unità è quella del prodotto (es. L, kg). Se in anagrafica sono impostati **dosaggio min** e/o **dosaggio max**, in fase di salvataggio il sistema avvisa se il valore è fuori range (es. “Dosaggio superiore al consigliato per [nome prodotto]. Salvare comunque?”): puoi confermare e salvare ugualmente oppure correggere il dosaggio. In **lista trattamenti** la colonna **Avvisi** mostra un segnale di attenzione (⚠️) per i trattamenti con dosaggio fuori range; passando il mouse sull’icona si vede il dettaglio (es. “Dosaggio superiore al consigliato per…”).
- **Quantità**: calcolata automaticamente come **dosaggio × superficie trattata (ha)**.
- **Costo (€)**: se il prodotto ha prezzo in anagrafica, il costo può essere calcolato; per “Altro” si può inserire il costo a mano.
- **Aggiungi prodotto**: pulsante **➕ Aggiungi prodotto** per inserire più righe.
- **Totale costo prodotti**: somma dei costi di tutte le righe, mostrata sotto la tabella e salvata come costo totale prodotti del trattamento.

In **modifica** trattamento, le righe salvate vengono caricate nella tabella; puoi aggiungere, togliere o modificare righe e ricalcolare.

---

## 📊 Lista trattamenti

Nella lista trattamenti (Vigneto o Frutteto):

- Se il trattamento ha **un solo prodotto**, in colonna prodotto viene mostrato il nome del prodotto.
- Se ha **più prodotti**, viene mostrato l'elenco dei nomi dei prodotti (separati da virgola).
- La colonna **Avvisi** mostra un segnale di attenzione (⚠️) per i trattamenti in cui almeno un prodotto ha dosaggio fuori dal range consigliato in anagrafica (min/max); passando il mouse sull'icona si vede il dettaglio (es. dosaggio superiore/inferiore al consigliato per un prodotto).

---

## 🔗 Collegamento con Prodotti e Magazzino

- I prodotti selezionabili nella tabella provengono dall’**Anagrafica Prodotti** (modulo Prodotti e Magazzino). Per usare dosaggio min/max e giorni di carenza nei trattamenti, compila questi campi in anagrafica; vedi [Prodotti e Magazzino](PRODOTTI_E_MAGAZZINO.md).
- Con il modulo **Prodotti e Magazzino** attivo, nel modal puoi spuntare **Registra scarico in magazzino** al salvataggio per generare le uscite in base alle quantità delle righe prodotto collegate all’anagrafica; vedi la guida [Prodotti e Magazzino](PRODOTTI_E_MAGAZZINO.md) per i dettagli.

---

## ✅ Riepilogo

| Cosa | Dove |
|------|------|
| Superficie trattata | Campo “Superficie trattata (ha)”; opzione **tutto il terreno** = valore da anagrafe terreno; oppure mappa (**Traccia**) con poligono (snap e validazione) |
| Prodotti e dosaggi | Tabella prodotti (più righe, quantità = dosaggio × ha) |
| Totale costo prodotti | Sotto la tabella, salvato con il trattamento |
| Mappa | Solo se non usi solo l’anagrafe per l’intera superficie: snap al confine/vertice, pausa tracciamento, chiusura con doppio clic o clic vicino al primo punto |

Per l’anagrafica prodotti (dosaggio min/max, giorni di carenza) vedi [Prodotti e Magazzino](PRODOTTI_E_MAGAZZINO.md).
