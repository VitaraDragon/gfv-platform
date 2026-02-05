# Modulo Vigneto

Blocco della guida dedicato al **modulo Vigneto**: gestione vigneti (anagrafica per terreno), trattamenti, potatura, vendemmia, calcolo materiali per impianto, pianificazione nuovo impianto e statistiche. Relazioni con Terreni, Lavori, Magazzino (prodotti) e Manodopera.

---

## 1. Titolo

**Modulo Vigneto** – Gestione vigneti, trattamenti, potatura, vendemmia, calcolo materiali, pianificazione impianto e statistiche.

---

## 2. Scopo

Permettere di **gestire i vigneti** (anagrafica collegata ai terreni: varietà, forma di allevamento, densità, rese, spese), di **registrare trattamenti** fitosanitari (prodotti, dosaggi, costi, giorni di carenza), di **gestire potatura e vendemmia** (con eventuale collegamento a lavori e ore), di **calcolare i materiali** necessari per un nuovo impianto (pali, fili, tutori, ancore in base al tipo di impianto), di **pianificare un nuovo impianto** (terreno, coltura vigneto, configurazione) e di **visualizzare statistiche** (spese, rese, trend). Il modulo è a **pagamento** (piano Base, moduli pay-per-use).

---

## 3. Dove si trova

- **Dashboard principale:** card **Vigneto** (🍇) → link a **Dashboard Vigneto** (`modules/vigneto/views/vigneto-dashboard-standalone.html`).
- **Da Terreni:** da un terreno con coltura vigneto si può aprire il modulo Vigneto (link contestuale) per gestire i vigneti di quel terreno.
- **Dashboard Vigneto:** punto di ingresso del modulo; filtri per vigneto e anno; statistiche riassuntive (spese vendemmia, ultima vendemmia); card per:
  - **Gestione Vendemmia** → `vendemmia-standalone.html`
  - **Potatura** → `potatura-standalone.html`
  - **Trattamenti** → `trattamenti-standalone.html`
  - **Statistiche e Grafici** → `vigneto-statistiche-standalone.html`
  - **Pianifica Nuovo Impianto** → `pianifica-impianto-standalone.html?coltura=vigneto`
  - **Calcolo Materiali** → `calcolo-materiali-standalone.html?coltura=vigneto`
- **Lista vigneti:** `vigneti-standalone.html` (elenco vigneti per terreno/tenant; da qui si accede a trattamenti, vendemmia, potatura per vigneto).

---

## 4. Funzionalità principali

- **Anagrafica vigneti:** ogni **vigneto** è un documento (collection `vigneti`) collegato a un **terreno** (`terrenoId`). Campi tipici: varietà, forma di allevamento (es. Guyot, Cordone speronato, Pergola), tipo palo, destinazione uva (vino, vendita uva, misto), densità ceppi, distanze, numero filari/ceppi, cantina, rese (resa media qli/ha, resa anno precedente), spese (vendemmia, cantina, prodotti). Creazione, modifica, eliminazione vigneti; filtri per terreno, varietà, stato impianto.
- **Trattamenti:** sub-collection **trattamenti** sotto ogni vigneto. Registrazione trattamento: data, tipo (antifungino, insetticida, acaricida, fertilizzante, altro), **prodotti** (nome, prodottoId opzionale per link Magazzino, dosaggio, quantità, costo), superficie trattata, eventuale poligono zona trattata (mappa), condizioni meteo, operatore, macchina. Calcolo **costo totale** (prodotto + manodopera + macchina) e **giorni di carenza**; data minima raccolta derivata da carenza. I prodotti possono essere scelti dall’anagrafica **Magazzino** (se modulo attivo) per tracciare consumo e costi.
- **Potatura:** gestione potature vigneto; collegamento a **lavori** (lavoro di potatura assegnato a caposquadra/operaio). Registrazione potatura con eventuale lavoro, date, note; tracciamento **zone lavorate** se il terreno ha confini tracciati (stessa logica di Lavori e attività).
- **Vendemmia:** sub-collection **vendemmie** sotto ogni vigneto. Registrazione vendemmia: data, quantità (ql o kg), varietà, eventuale lavoro collegato; calcolo **compensi** (tariffe operai) e aggiornamento **rese** del vigneto (resa media, resa anno precedente). Le vendemmie alimentano le statistiche (spese vendemmia, ultima vendemmia).
- **Calcolo materiali:** calcolo dei **materiali necessari** per un nuovo impianto in base a: tipo di impianto (Guyot, Cordone speronato, Cordone libero, Pergola, Spalliera, ecc.), superficie, distanze tra filari e tra ceppi. Output: pali, fili (portata e vegetazione), tutori, ancore, legature. I tipi di impianto hanno configurazioni predefinite (numero fili, diametri, necessità tutori/ancore). Utile per preventivi e ordini materiali.
- **Pianificazione impianto:** gestione **pianificazioni** di nuovi impianti (collection `pianificazioni-impianti`). Creazione pianificazione: terreno, tipo coltura (vigneto), forma di allevamento, varietà, superfici, carraie; stati (bozza, confermata, ecc.). Una pianificazione confermata può generare un **lavoro** e/o un **vigneto**. Collegamento con Calcolo materiali per quantità materiali.
- **Statistiche vigneto:** statistiche aggregate per vigneto e anno: spese (manodopera, macchine, prodotti, cantina, vendemmia), rese, trend rese, ultima vendemmia. Grafici (costi per anno, confronti). Servizi: `vigneto-statistiche-service.js`, `vigneto-statistiche-aggregate-service.js`.
- **Zone lavorate:** nei flussi Trattamenti, Vendemmia, Potatura si possono tracciare **zone lavorate** sul terreno (se il terreno ha confini tracciati); le zone sono salvate sotto il **lavoro** collegato (`tenants/{tenantId}/lavori/{lavoroId}/zoneLavorate`). Vedi modulo Terreni e Lavori e attività.

---

## 5. Termini specifici

| Termine | Definizione breve |
|--------|--------------------|
| **Vigneto** | Anagrafica di un appezzamento a vite: collegato a un terreno, con varietà, forma di allevamento, densità, rese, spese. |
| **Trattamento** | Registrazione di un intervento fitosanitario su un vigneto: data, prodotti, dosaggi, superficie, costi, giorni di carenza. |
| **Giorni di carenza** | Periodo prima della raccolta dopo l’applicazione di un prodotto; determina la data minima raccolta. |
| **Vendemmia** | Registrazione della raccolta uva: data, quantità, varietà; aggiorna le rese del vigneto e può essere collegata a un lavoro. |
| **Potatura** | Intervento di potatura sul vigneto; può essere collegato a un lavoro (caposquadra/operaio) e a zone lavorate. |
| **Forma di allevamento** | Sistema di coltivazione della vite (Guyot, Cordone speronato, Pergola, Spalliera, ecc.); determina numero fili, pali, tutori nel calcolo materiali. |
| **Pianificazione impianto** | Piano per un nuovo impianto vigneto (terreno, varietà, superfici, carraie); stati bozza/confermata; può generare lavoro e vigneto. |
| **Calcolo materiali** | Calcolo pali, fili, tutori, ancore necessari per un impianto in base a tipo impianto, superficie e distanze. |
| **Resa (qli/ha)** | Quantità di uva per ettaro (quintali/ettaro); resa media e resa anno precedente sono memorizzate nel vigneto. |

---

## 6. Limitazioni e regole

- **Modulo a pagamento:** il modulo Vigneto è attivabile solo con **piano Base** (€5/mese) e ha costo aggiuntivo (pay-per-use, es. €3/mese). Con piano Free il modulo non è disponibile.
- **Dipendenze:** per usare il modulo serve un **terreno** (i vigneti sono collegati a un terreno). Per tracciare zone lavorate nei trattamenti/vendemmia/potatura il terreno deve avere **confini tracciati** (vedi modulo Terreni). Per collegare prodotti Magazzino ai trattamenti serve il **modulo Magazzino** attivo.
- **Permessi:** la gestione vigneti, trattamenti, vendemmia, potatura e pianificazione è tipicamente disponibile per **manager** e **amministratore**; i **caposquadra** e **operai** accedono ai lavori (potatura, vendemmia) dalla Gestione Lavori / Segnatura ore; le statistiche possono essere limitate per ruolo.
- **Validazioni:** trattamenti richiedono data, tipo, almeno un prodotto/superficie/costi; vigneto richiede terreno, varietà, forma di allevamento; vendemmia richiede data e quantità. Messaggi di errore in caso di campi obbligatori mancanti o formati non validi.
- **Dati derivati:** costi totali trattamento (prodotto + manodopera + macchina), giorni di carenza e data raccolta minima sono **calcolati**; le rese del vigneto si aggiornano con le vendemmie registrate.

---

## 7. Relazioni con altri moduli

- **Terreni:** ogni vigneto è collegato a un **terreno** (`terrenoId`). Si accede al modulo Vigneto dalla lista terreni (terreno con coltura vigneto) o dalla Dashboard. Le **zone lavorate** (trattamenti, vendemmia, potatura) richiedono confini terreno tracciati.
- **Lavori e attività:** **potatura** e **vendemmia** possono essere collegate a un **lavoro** (lavoroId); le ore segnate e validate per quel lavoro alimentano il diario e i compensi. Le **zone lavorate** sono salvate sotto il lavoro.
- **Magazzino:** nei **trattamenti** i prodotti possono essere referenziati con **prodottoId** (anagrafica Magazzino); così si traccia l’uso dei prodotti e si può aggiornare la giacenza (scarico magazzino). Senza modulo Magazzino i prodotti sono solo nome e costo.
- **Manodopera:** i lavori di potatura/vendemmia sono assegnati a caposquadra/operaio; segnatura ore e validazione ore come in Lavori e attività. I compensi vendemmia possono usare le tariffe operai (modulo Manodopera).
- **Parco Macchine:** un trattamento può avere **macchina** assegnata; i lavori vigneto possono avere macchina/attrezzo/operatore (se moduli attivi).
- **Core (Dashboard, Statistiche):** la Dashboard principale mostra la card Vigneto se il modulo è attivo; le statistiche core possono includere dati vigneto (rese, spese) se integrati.

Dettagli sui flussi che coinvolgono più moduli (es. trattamento → prodotto Magazzino → scarico; lavoro vendemmia → ore → attività) in **Intersezioni tra moduli** (`intersezioni-moduli.md`).
