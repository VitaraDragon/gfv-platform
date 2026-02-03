# Modulo Lavori e attività

Blocco della guida dedicato a **lavori** (creazione, assegnazione, stati, ore) e **attività** (diario, collegamento ai lavori). Include segnatura ore, validazione ore, flussi di completamento e approvazione, e relazione con caposquadra, operai e zone lavorate.

---

## 1. Titolo

**Lavori e attività** – Gestione lavori, assegnazione, ore, validazione e attività collegate.

---

## 2. Scopo

Permettere di **creare e gestire i lavori** (incarichi su un terreno, assegnati a un caposquadra o a un operaio), di **segnare le ore** lavorate (operai/caposquadra), di **validare o rifiutare** le ore (caposquadra per lavori di squadra, manager per lavori autonomi) e di avere **attività collegate** (registrazioni nel diario, anche generate dalle ore validate). I lavori sono la base per moduli come Vigneto e Frutteto (trattamenti, vendemmia, potatura, raccolta) e per le **zone lavorate** tracciate in quei moduli.

---

## 3. Dove si trova

- **Gestione Lavori:** Dashboard → **Gestione Lavori** (card in sezione Manager/Amministrazione) → `admin/gestione-lavori-standalone.html`. Da qui si creano, modificano, eliminano lavori e si filtrano per stato (da pianificare, in corso, completato, ecc.).
- **Validazione ore:** Dashboard → **Validazione ore** (card in sezione Manager/Manodopera o Caposquadra) → `admin/validazione-ore-standalone.html`. Qui il caposquadra valida/rifiuta le ore segnate dai propri operai; il manager valida le ore dei **lavori autonomi** (assegnati direttamente a un operaio).
- **Segnatura ore:** Dashboard → **Segnatura ore** (o da contesto lavoro) → `segnatura-ore-standalone.html`. Operai e caposquadra segnano le ore lavorate per un lavoro (data, orari, ore nette, note).
- **I miei lavori (caposquadra):** Dashboard → **I miei lavori** (sezione Caposquadra) → `admin/lavori-caposquadra-standalone.html`. Elenco lavori assegnati al caposquadra con azioni rapide (validazione ore, comunicazioni).
- **Diario Attività:** Dashboard → **Diario Attività** → `attivita-standalone.html`. Registrazione attività lavorative (terreno, tipo lavoro, data, orari, ore nette); le attività possono essere collegate a un lavoro (`lavoroId`) o create in modo autonomo.
- **Diario da Lavori:** nella Dashboard (sezione Manager con Manodopera) è presente il blocco **"Diario da Lavori"**: attività generate automaticamente dalle **ore validate** dei lavori (aggregazione ore segnate dagli operai e validate dai caposquadra).

---

## 4. Funzionalità principali

### Lavori

- **Creazione lavoro:** solo **manager** e **amministratore**. Campi obbligatori: nome (min 3 caratteri), terreno, tipo lavoro, data inizio, durata prevista (giorni). **Assegnazione:** deve essere assegnato **o** a un **caposquadra** (lavoro di squadra) **o** a un **operaio** (lavoro autonomo), non entrambi. Opzionali: note, cliente (conto terzi), preventivo, macchina/attrezzo/operatore (Parco Macchine).
- **Modifica lavoro:** **manager** e **amministratore** possono modificare tutti i campi; il **caposquadra** può modificare solo **stato** e **note** dei lavori a lui assegnati.
- **Eliminazione lavoro:** solo **manager** e **amministratore**; l'app può impedire l'eliminazione se sono presenti ore o zone lavorate (opzione `force` per forzare, se prevista).
- **Stati lavoro:**  
  - **Da pianificare** – lavoro creato ma non ancora assegnato o in attesa di avvio.  
  - **Assegnato** – assegnato a caposquadra o operaio, in attesa di esecuzione.  
  - **In corso** – lavoro in esecuzione.  
  - **Completato** – lavoro concluso.  
  - **Annullato** – lavoro annullato.  
  Transizioni tipiche: da pianificare → assegnato → in corso → completato; oppure annullato in qualsiasi momento.
- **Dati derivati (calcolati):** superficie totale lavorata, superficie rimanente, percentuale completamento, giorni effettivi, stato progresso (in anticipo / in tempo / in ritardo). Aggiornati in base a zone lavorate e date.

### Assegnazione e ruoli

- **Lavoro di squadra:** assegnato a un **caposquadra**; gli operai della sua squadra (o assegnati al lavoro) segnano le ore; il caposquadra **valida** le ore.
- **Lavoro autonomo:** assegnato direttamente a un **operaio**; l'operaio segna le ore; il **manager** (o amministratore) **valida** le ore (non il caposquadra).
- **Caposquadra:** vede solo i lavori a lui assegnati; può aggiornare stato e note; accede a Validazione ore per i propri lavori. Può inviare comunicazioni agli operai.
- **Operaio:** vede solo i lavori a cui è assegnato (direttamente o tramite squadra); segna le ore; non può validare.

### Segnatura ore

- **Chi segna:** operaio o caposquadra, per i lavori a cui sono assegnati.
- **Dove:** pagina **Segnatura ore** o da contesto lavoro (form con data, orario inizio/fine, pause, ore nette calcolate, note).
- **Salvataggio:** le ore vengono salvate nella **sub-collection** `oreOperai` del documento lavoro: `tenants/{tenantId}/lavori/{lavoroId}/oreOperai`. Ogni record contiene: data, operaioId, oreNette, stato (inizialmente **da_validare**), note, eventuali ore macchina.
- **Stati ore:** **da_validare** (appena segnate), **validate** (approvate), **rifiutate** (rifiutate da chi valida).

### Validazione ore

- **Chi valida:**  
  - **Caposquadra:** valida le ore dei **lavori di squadra** a lui assegnati (ore segnate dagli operai di quei lavori).  
  - **Manager / Amministratore:** valida le ore dei **lavori autonomi** (lavori assegnati direttamente a un operaio, senza caposquadra).
- **Dove:** pagina **Validazione ore** (`admin/validazione-ore-standalone.html`). Lista ore in stato **da_validare**; per ogni ora: approva (→ **validate**) o rifiuta (→ **rifiutate**). Opzionalmente si può associare una data/note di validazione.
- **Effetto:** le ore **validate** contribuiscono al calcolo delle attività (Diario da Lavori) e alle statistiche (ore totali, compensi). Le ore rifiutate non vengono conteggiate.

### Attività collegate

- **Attività** sono registrazioni nel **Diario Attività** (collection `attivita`): data, terreno, tipo lavoro, coltura, orari, ore nette, note. Possono essere **collegate a un lavoro** (`lavoroId`) oppure create in modo autonomo (solo terreno e tipo lavoro).
- **Diario da Lavori:** nella Dashboard, il blocco "Diario da Lavori" mostra le **attività generate automaticamente** dalle ore validate dei lavori: le ore segnate dagli operai e validate dai caposquadra vengono aggregate e presentate come attività (lavoro, terreno, ore totali, numero operai, ecc.). Così il manager vede in un colpo d'occhio il lavoro svolto derivato dalle ore approvate.
- **Flusso:** operaio segna ore → caposquadra (o manager) valida → ore validate alimentano statistiche e Diario da Lavori; le attività con `lavoroId` collegano esplicitamente il diario al lavoro.

### Completamento e approvazione (flussi)

- **Completamento lavoro:** il manager o il caposquadra può portare lo stato del lavoro a **Completato** quando il lavoro è finito. Non è obbligatorio validare tutte le ore prima di completare; la percentuale completamento e i dati derivati si aggiornano in base a zone lavorate e ore.
- **Approvazione ore:** flusso separato (validazione ore). Le ore validate determinano quali ore entrano nelle statistiche e nel Diario da Lavori; le rifiutate restano registrate ma non conteggiate.

### Zone lavorate

- Le **zone lavorate** (segmenti di terreno effettivamente lavorati) non si tracciano nella Gestione Lavori ma nei **moduli Vigneto e Frutteto** (Trattamenti, Vendemmia, Potatura, Raccolta), quando si lavora su un lavoro assegnato a un terreno. Il terreno deve avere **confini già tracciati** (vedi modulo Terreni). Le zone sono salvate sotto il lavoro: `tenants/{tenantId}/lavori/{lavoroId}/zoneLavorate`. La **superficie totale lavorata** e la **percentuale completamento** del lavoro possono essere aggiornate in base a queste zone.

---

## 5. Termini specifici

| Termine | Definizione breve |
|--------|--------------------|
| **Lavoro** | Incarico su un terreno, con nome, tipo lavoro, date, stato; assegnato a un caposquadra (squadra) o a un operaio (autonomo). |
| **Lavoro di squadra** | Lavoro assegnato a un caposquadra; gli operai della squadra (o assegnati) segnano le ore; il caposquadra le valida. |
| **Lavoro autonomo** | Lavoro assegnato direttamente a un operaio; l'operaio segna le ore; il manager le valida. |
| **Stato lavoro** | da_pianificare, assegnato, in_corso, completato, annullato. |
| **Ore (ore operai)** | Registrazioni di ore lavorate per un lavoro; salvate in sub-collection `oreOperai` del lavoro; stati: da_validare, validate, rifiutate. |
| **Segnatura ore** | Inserimento da parte di operaio/caposquadra di data, orari e ore nette per un lavoro. |
| **Validazione ore** | Approvazione (validate) o rifiuto (rifiutate) delle ore in stato da_validare; caposquadra per lavori squadra, manager per lavori autonomi. |
| **Attività** | Voce del diario: data, terreno, tipo lavoro, orari, ore nette; può essere collegata a un lavoro (lavoroId). |
| **Diario da Lavori** | Vista (Dashboard) delle attività generate dalle ore validate dei lavori (aggregazione ore approvate). |
| **Zone lavorate** | Aree di terreno effettivamente lavorate; tracciate nei moduli Vigneto/Frutteto, salvate sotto il lavoro. |

---

## 6. Limitazioni e regole

- **Permessi:** creare, modificare (tutti i campi) ed eliminare lavori: solo **manager** e **amministratore**. Modificare solo stato e note: anche **caposquadra** per i propri lavori. Segnare ore: **operaio** e **caposquadra** per i lavori a cui sono assegnati. Validare ore: **caposquadra** (lavori di squadra) o **manager/amministratore** (lavori autonomi).
- **Modulo Manodopera:** le funzionalità complete (gestione lavori, squadre, validazione ore, Diario da Lavori, comunicazioni) richiedono il **modulo Manodopera** attivo. Senza modulo Manodopera, la gestione lavori può essere limitata o assente.
- **Assegnazione:** ogni lavoro deve avere **almeno** caposquadra **o** operaio (non entrambi); se il modulo Manodopera è attivo l'assegnazione è di fatto obbligatoria.
- **Validazione:** il caposquadra non può validare le ore dei lavori autonomi (solo manager/admin); il manager valida solo le ore in stato da_validare dei lavori assegnati a un operaio diretto.
- **Zone lavorate:** per tracciare zone lavorate in Vigneto/Frutteto il terreno del lavoro deve avere confini tracciati (vedi modulo Terreni).

---

## 7. Relazioni con altri moduli

- **Terreni:** ogni lavoro è legato a un **terreno**; le zone lavorate richiedono confini terreno tracciati.
- **Core (Attività/Diario):** le **attività** (collection attivita) possono avere `lavoroId`; il **Diario da Lavori** aggrega le ore validate dei lavori. Le statistiche ore/attività usano sia attività sia ore validate.
- **Manodopera (squadre, operai, compensi):** lavori assegnati a caposquadra/operaio; ore e validazione alimentano **compensi operai** e statistiche manodopera.
- **Vigneto / Frutteto:** trattamenti, vendemmia, potatura, raccolta sono **lavori** (o si aprono da un lavoro); le **zone lavorate** si tracciano in quei moduli e sono salvate sotto il lavoro.
- **Conto terzi:** i lavori possono essere **conto terzi** (clienteId, preventivoId); le attività collegate possono avere clienteId.
- **Parco Macchine:** un lavoro può avere macchina/attrezzo/operatore assegnati; le ore possono includere ore macchina.
- **Dashboard:** sezioni Gestione Lavori, Validazione ore, Diario da Lavori, Lavori caposquadra, Lavori operaio; mappa aziendale con overlay zone lavorate e indicatori lavori.

Dettagli sui flussi che coinvolgono più moduli in **Intersezioni tra moduli** (`intersezioni-moduli.md`).
