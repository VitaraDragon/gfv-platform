# Modulo Frutteto

Blocco della guida dedicato al **modulo Frutteto**: gestione frutteti (anagrafica per terreno), trattamenti, potatura, raccolta frutta, pianificazione nuovo impianto, calcolo materiali e statistiche. Relazioni con Terreni, Lavori, Magazzino (prodotti) e Manodopera.

---

## 1. Titolo

**Modulo Frutteto** – Gestione frutteti, trattamenti, potatura, raccolta frutta, pianificazione impianto, calcolo materiali e statistiche.

---

## 2. Scopo

Permettere di **gestire i frutteti** (anagrafica collegata ai terreni: specie, varietà, forma di allevamento, densità piante, spese), di **registrare trattamenti** fitosanitari (prodotti, dosaggi, costi, giorni di carenza), di **gestire potatura e raccolta frutta** (con eventuale collegamento a lavori e ore), di **pianificare un nuovo impianto** e di **calcolare i materiali** necessari (funzionalità condivise con il modulo Vigneto, con parametro coltura=frutteto), e di **visualizzare statistiche** (spese, rese, trend). Il modulo è a **pagamento** (piano Base, moduli pay-per-use).

---

## 3. Dove si trova

- **Dashboard principale:** card **Frutteto** (🍎) → link a **Dashboard Frutteto** (`modules/frutteto/views/frutteto-dashboard-standalone.html`).
- **Da Terreni:** da un terreno con coltura frutteto si può aprire il modulo Frutteto (link contestuale) per gestire i frutteti di quel terreno.
- **Dashboard Frutteto:** punto di ingresso del modulo; filtri per frutteto e anno; statistiche riassuntive; card per:
  - **Gestione Raccolta Frutta** → `raccolta-frutta-standalone.html`
  - **Potatura** → `potatura-standalone.html`
  - **Trattamenti** → `trattamenti-standalone.html`
  - **Pianifica Nuovo Impianto** → `../../vigneto/views/pianifica-impianto-standalone.html?coltura=frutteto` (vista condivisa con Vigneto)
  - **Calcolo Materiali** → `../../vigneto/views/calcolo-materiali-standalone.html?coltura=frutteto` (vista condivisa con Vigneto)
  - **Statistiche e Grafici** → `frutteto-statistiche-standalone.html`
- **Lista frutteti:** `frutteti-standalone.html` (elenco frutteti per terreno/tenant; da qui si accede a trattamenti, potatura, raccolta per frutteto).

---

## 4. Funzionalità principali

- **Anagrafica frutteti:** ogni **frutteto** è un documento (collection `frutteti`) collegato a un **terreno** (`terrenoId`). Campi tipici: **specie** (Melo, Pesco, Pero, ecc.), varietà, forma di allevamento, densità piante, distanze, numero piante totali, calibro medio, grado di maturazione tipico, spese (manodopera, macchine, prodotti). Creazione, modifica, eliminazione frutteti; filtri per terreno, specie, varietà, stato impianto.
- **Trattamenti:** sub-collection **trattamenti** sotto ogni frutteto. La **lista** lavori/attività (categoria Trattamenti) usa la stessa logica di ottimizzazione del modulo Vigneto (indice per terreno, cache categorie, parallelismo su “tutti i frutteti”). Registrazione trattamento: data, tipo (antifungino, insetticida, acaricida, fertilizzante, altro), **prodotti** (nome, prodottoId opzionale per link Magazzino, dosaggio, quantità, costo), **superficie trattata** (ha), opzione **superficie da anagrafe terreno** (`superficieDaAnagrafeTerreno`) oppure **poligono** sulla mappa per area parziale. Condizioni meteo, operatore, macchina. Calcolo **costo totale** (prodotto + manodopera + macchina) e **giorni di carenza**; data minima raccolta derivata da carenza. I prodotti possono essere scelti dall’anagrafica **Magazzino** (se modulo attivo); scarico magazzino opzionale al salvataggio se il modulo è attivo.
- **Potatura:** gestione potature frutteto; collegamento a **lavori** (lavoro di potatura assegnato a caposquadra/operaio). Registrazione potatura con eventuale lavoro, date, note; tracciamento **zone lavorate** se il terreno ha confini tracciati (stessa logica di Lavori e attività).
- **Raccolta frutta:** sub-collection **raccolte** sotto ogni frutteto. Registrazione raccolta: data, **specie** e **varietà**, quantità (kg), superficie raccolta (ettari), **resa kg/ha** (calcolata), calibro, grado di maturazione, colore; eventuale **scarto** (totale e per categoria: danno fisico, calibro fuori norma, marciume, maturazione non idonea, altro). Operai e macchine utilizzate, ore impiegate; calcolo **costi** (manodopera, macchine, totale) e opzionalmente prezzo vendita/ricavo. Può essere collegata a un **lavoro** (lavoroId). Le raccolte aggiornano le statistiche del frutteto.
- **Pianificazione impianto e Calcolo materiali:** le funzionalità **Pianifica Nuovo Impianto** e **Calcolo Materiali** sono **condivise** con il modulo Vigneto: si aprono le stesse pagine del modulo Vigneto con parametro **coltura=frutteto**. La pianificazione permette di definire un nuovo impianto frutteto (terreno, specie/varietà, superfici, carraie); il calcolo materiali fornisce pali, fili, tutori, ancore in base al tipo di impianto e alle distanze (configurazioni adattate alla frutticoltura dove applicabile).
- **Statistiche frutteto:** statistiche aggregate per frutteto e anno: spese (manodopera, macchine, prodotti), rese, trend, raccolte recenti. Grafici e confronti. Servizi: `frutteto-statistiche-service.js`, `frutteto-statistiche-aggregate-service.js`.
- **Zone lavorate:** nei flussi Trattamenti, Potatura e Raccolta si possono tracciare **zone lavorate** sul terreno (se il terreno ha confini tracciati); le zone sono salvate sotto il **lavoro** collegato (`tenants/{tenantId}/lavori/{lavoroId}/zoneLavorate`). Vedi modulo Terreni e Lavori e attività.

---

## 5. Termini specifici

| Termine | Definizione breve |
|--------|--------------------|
| **Frutteto** | Anagrafica di un appezzamento a frutta: collegato a un terreno, con specie, varietà, forma di allevamento, densità, spese. |
| **Specie** | Specie fruttifera (Melo, Pesco, Pero, Albicocco, Ciliegio, ecc.); obbligatoria per frutteto e raccolta. |
| **Trattamento** | Registrazione di un intervento fitosanitario su un frutteto: data, prodotti, dosaggi, superficie, costi, giorni di carenza. |
| **Giorni di carenza** | Periodo prima della raccolta dopo l’applicazione di un prodotto; determina la data minima raccolta. |
| **Raccolta frutta** | Registrazione della raccolta: data, specie, varietà, quantità (kg), superficie (ha), resa kg/ha, calibro, scarto; costi e eventuale lavoro collegato. |
| **Potatura** | Intervento di potatura sul frutteto; può essere collegato a un lavoro e a zone lavorate. |
| **Resa (kg/ha)** | Quantità di frutta per ettaro (kg/ettaro); calcolata da quantità raccolta e superficie raccolta. |
| **Scarto** | Quantità o percentuale di frutta scartata; può essere dettagliato per categoria (danno fisico, calibro, marciume, ecc.). |
| **Pianificazione impianto / Calcolo materiali** | Funzionalità condivise con Vigneto (parametro coltura=frutteto): pianificazione nuovo impianto e calcolo pali/fili/tutori/ancore. |

---

## 6. Limitazioni e regole

- **Modulo a pagamento:** il modulo Frutteto è attivabile solo con **piano Base** (€5/mese) e ha costo aggiuntivo (pay-per-use, es. €3/mese). Con piano Free il modulo non è disponibile.
- **Dipendenze:** per usare il modulo serve un **terreno** (i frutteti sono collegati a un terreno). Per tracciare zone lavorate il terreno deve avere **confini tracciati** (vedi modulo Terreni). Per collegare prodotti Magazzino ai trattamenti serve il **modulo Magazzino** attivo.
- **Permessi:** la gestione frutteti, trattamenti, potatura e raccolta è tipicamente disponibile per **manager** e **amministratore**; **caposquadra** e **operai** accedono ai lavori dalla Gestione Lavori / Segnatura ore; le statistiche possono essere limitate per ruolo.
- **Validazioni:** frutteto richiede varietà e specie; trattamenti richiedono data, tipo, almeno un prodotto/superficie/costi; raccolta richiede data, specie, varietà, quantità e superficie. Messaggi di errore in caso di campi obbligatori mancanti o formati non validi.
- **Dati derivati:** costi totali trattamento e giorni di carenza sono **calcolati**; la **resa kg/ha** della raccolta è calcolata da quantità (kg) e superficie (ettari). Le statistiche del frutteto si aggiornano con le raccolte e i trattamenti registrati.
- **Pianificazione e Calcolo materiali:** le pagine sono quelle del modulo **Vigneto** con `?coltura=frutteto`; la logica è adattata alla coltura frutteto dove previsto (es. specie/varietà invece di varietà vite).

---

## 7. Relazioni con altri moduli

- **Terreni:** ogni frutteto è collegato a un **terreno** (`terrenoId`). Si accede al modulo Frutteto dalla lista terreni (terreno con coltura frutteto) o dalla Dashboard. Le **zone lavorate** richiedono confini terreno tracciati.
- **Lavori e attività:** **potatura** e **raccolta** possono essere collegate a un **lavoro** (lavoroId); le ore segnate e validate per quel lavoro alimentano il diario e i compensi. Le **zone lavorate** sono salvate sotto il lavoro.
- **Magazzino:** nei **trattamenti** i prodotti possono essere referenziati con **prodottoId** (anagrafica Magazzino) per tracciare uso e giacenza. Senza modulo Magazzino i prodotti sono solo nome e costo.
- **Manodopera:** i lavori di potatura/raccolta sono assegnati a caposquadra/operaio; segnatura ore e validazione come in Lavori e attività. I costi manodopera nelle raccolte possono usare le tariffe operai (modulo Manodopera).
- **Vigneto:** **Pianificazione impianto** e **Calcolo materiali** sono implementate nel modulo Vigneto e riutilizzate per il Frutteto con parametro `coltura=frutteto` (stesse viste, logica adattata).
- **Parco Macchine:** un trattamento può avere **macchina** assegnata; i lavori frutteto possono avere macchina/attrezzo/operatore; le raccolte possono indicare macchine utilizzate (se moduli attivi).
- **Core (Dashboard):** la Dashboard principale mostra la card Frutteto se il modulo è attivo.

Dettagli sui flussi che coinvolgono più moduli (es. trattamento → prodotto Magazzino; lavoro raccolta → ore → attività) in **Intersezioni tra moduli** (`intersezioni-moduli.md`).
