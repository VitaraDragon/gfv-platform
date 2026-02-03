# Modulo Conto terzi

Blocco della guida dedicato al **modulo Conto terzi**: gestione clienti, poderi clienti, terreni clienti, preventivi (creazione, invio email, accettazione, pianificazione lavoro), tariffe per il calcolo automatico dei preventivi, e mappa clienti. Relazioni con Lavori, Terreni e (eventualmente) fatturazione.

---

## 1. Titolo

**Modulo Conto terzi** – Clienti, preventivi, lavori per terzi, tariffe e terreni clienti.

---

## 2. Scopo

Permettere di **gestire i clienti** (anagrafica per lavori conto terzi), i **poderi** e i **terreni** dei clienti, di **creare e inviare preventivi** (con calcolo automatico da tariffe), di **gestire l’accettazione** (link email, stati bozza/inviato/accettato/rifiutato/scaduto/pianificato) e di **pianificare un lavoro** a partire da un preventivo accettato (creazione lavoro con clienteId e preventivoId). Le **tariffe** (€/ettaro per tipo lavoro, coltura e tipo campo) servono al calcolo del totale preventivo. Il modulo è a **pagamento** (piano Base, moduli pay-per-use). La **fatturazione** (emissione fatture formali) non è attualmente implementata nell’app; il flusso si conclude con il lavoro pianificato e le ore/attività collegate.

---

## 3. Dove si trova

- **Dashboard principale:** card **Conto Terzi** (🤝) → link a **Conto Terzi** (`modules/conto-terzi/views/conto-terzi-home-standalone.html`).
- **Home Conto terzi:** punto di ingresso del modulo; statistiche (preventivi aperti, terreni clienti); card per:
  - **Clienti** → `clienti-standalone.html`
  - **Terreni Clienti** → `terreni-clienti-standalone.html`
  - **Mappa Clienti** → `mappa-clienti-standalone.html`
  - **Preventivi** → `preventivi-standalone.html`
  - **Tariffe** → `tariffe-standalone.html`
- **Nuovo preventivo:** da Preventivi o da Home → `nuovo-preventivo-standalone.html`
- **Accettazione preventivo:** il cliente riceve un’email con link → `accetta-preventivo-standalone.html` (pagina pubblica con token).

---

## 4. Funzionalità principali

- **Clienti:** anagrafica clienti (collection `clienti`). Campi: **ragione sociale** (obbligatorio), partita IVA, codice fiscale, indirizzo, città, CAP, provincia, telefono, email, note, **stato** (attivo, sospeso, archiviato). Statistiche calcolate: data primo/ultimo lavoro, totale lavori. Creazione, modifica, archiviazione clienti; filtri per stato.
- **Poderi clienti:** ogni cliente può avere **poderi** (collection o sub-collection poderi clienti): nome podere, indirizzo, località, CAP, coordinate (lat/lng), note. I poderi servono a identificare i luoghi di lavoro del cliente; i **terreni clienti** possono essere associati a un podere o al cliente.
- **Terreni clienti:** i **terreni** con **clienteId** compilato appartengono a un cliente (conto terzi). Sono gestiti nella stessa collection **terreni** del core; la pagina **Terreni Clienti** elenca e filtra i terreni per cliente. Campi tipici: nome, superficie, coltura, podere (cliente), tipo campo (pianura, collina, montagna). I terreni clienti sono usati nei preventivi (terrenoId) e nei **lavori** (lavoro con clienteId e terreno cliente).
- **Preventivi:** collection `preventivi`. Ogni preventivo ha: **numero** (es. PREV-2025-001), **cliente**, **terreno** (opzionale, può essere nuovo), **tipo lavoro**, **coltura**, **tipo campo** (pianura/collina/montagna), **superficie** (ettari), eventuale macchina, **data prevista**, **stato** (bozza, inviato, accettato_email, accettato_manager, rifiutato, scaduto, pianificato, annullato). **Totale** e **totale con IVA** sono calcolati automaticamente in base alle **tariffe** (tipo lavoro + coltura + tipo campo). Note, **data scadenza** (es. +30 giorni), **token accettazione** per il link email, **data invio** e **data accettazione**. Quando lo stato diventa **pianificato** viene creato un **lavoro** collegato (preventivoId, clienteId, terrenoId); il campo **lavoroId** nel preventivo punta al lavoro creato.
- **Calcolo preventivo:** il totale è calcolato usando le **tariffe** (tariffa base €/ettaro per tipo lavoro, coltura e tipo campo; coefficiente per tipo campo). IVA configurabile (default 22%); totaleConIva = totale × (1 + iva/100).
- **Invio e accettazione:** il manager può **inviare** il preventivo per email al cliente (template email con link). Il link contiene un **token**; il cliente apre **Accetta preventivo** e può accettare o rifiutare. Lo stato passa a accettato_email o rifiutato; il manager può poi confermare (accettato_manager) e **pianificare** (crea lavoro, stato pianificato).
- **Tariffe:** collection `tariffe`. Ogni tariffa definisce: **tipo lavoro** (es. Aratura, Semina), **coltura** (opzionale; se vuota si applica a tutta la categoria), **tipo campo** (pianura, collina, montagna), **tariffa base** (€/ettaro), **coefficiente** moltiplicativo, note, flag **attiva**. Le tariffe sono usate per il calcolo automatico del totale preventivo (ricerca tariffa per tipo lavoro, coltura, tipo campo).
- **Mappa clienti:** vista che mostra i **clienti** e/o i **poderi clienti** sulla mappa (coordinate), per visualizzare la distribuzione geografica.
- **Lavori per terzi:** i **lavori** con **clienteId** (e opzionalmente **preventivoId**) sono “lavori conto terzi”. Creati da preventivo pianificato o manualmente. Le **attività** e le **ore** collegate possono avere clienteId; le statistiche e il Diario da Lavori distinguono le attività conto terzi. I terreni di questi lavori sono **terreni clienti** (clienteId sul terreno).

---

## 5. Termini specifici

| Termine | Definizione breve |
|--------|--------------------|
| **Cliente** | Soggetto (azienda o privato) per cui si eseguono lavori conto terzi: ragione sociale, P.IVA, CF, contatti, stato. |
| **Podere cliente** | Unità territoriale del cliente (nome, indirizzo, coordinate); i terreni clienti possono essere riferiti al podere. |
| **Terreno cliente** | Terreno con clienteId compilato; appartiene a un cliente e viene usato in preventivi e lavori conto terzi. |
| **Preventivo** | Offerta per un lavoro conto terzi: cliente, terreno, tipo lavoro, coltura, tipo campo, superficie, totale (da tariffe), stato, scadenza, accettazione, eventuale lavoro creato (lavoroId). |
| **Tariffa** | Prezzo di riferimento €/ettaro per tipo lavoro, coltura e tipo campo; usata per il calcolo automatico del totale preventivo. |
| **Tipo campo** | Morfologia del terreno: pianura, collina, montagna; influenza la tariffa (coefficiente) e i preventivi. |
| **Lavoro conto terzi** | Lavoro con clienteId (e opzionalmente preventivoId); può essere creato da un preventivo accettato (stato pianificato). |
| **Accettazione preventivo** | Il cliente, tramite link email (token), può accettare o rifiutare il preventivo; lo stato passa a accettato_email o rifiutato. |

---

## 6. Limitazioni e regole

- **Modulo a pagamento:** il modulo Conto terzi è attivabile solo con **piano Base** (€5/mese) e ha costo aggiuntivo (pay-per-use, es. €6/mese). Con piano Free il modulo non è disponibile.
- **Permessi:** la gestione clienti, preventivi, tariffe e terreni clienti è tipicamente riservata a **Manager** e **Amministratore**. L’**accettazione preventivo** (pagina con token) è accessibile al cliente tramite link (senza login obbligatorio nell’app).
- **Preventivi:** gli stati sono bozza → inviato → (accettato_email / accettato_manager / rifiutato / scaduto) → pianificato (dopo creazione lavoro). Un preventivo **pianificato** ha lavoroId valorizzato; il lavoro creato ha preventivoId e clienteId.
- **Terreni clienti:** i terreni con clienteId sono visibili nella sezione Terreni Clienti e nei filtri preventivi/lavori; non si mescolano con i terreni aziendali (senza clienteId) nella lista Terreni principale se si filtra “solo aziendali”.
- **Fatturazione:** l’emissione di fatture formali (documenti fiscali) **non è implementata** nell’app attuale. Il flusso conto terzi copre: cliente → preventivo → accettazione → lavoro pianificato → ore/attività. L’eventuale fatturazione è esterna o da sviluppare in seguito.

---

## 7. Relazioni con altri moduli

- **Lavori e attività:** i **lavori** con **clienteId** (e opzionalmente **preventivoId**) sono lavori conto terzi. Creati da preventivo in stato “pianificato” o inseriti a mano. Le **attività** e le **ore** possono avere clienteId; il Diario da Lavori e le statistiche possono distinguere le voci conto terzi. Gestione Lavori può filtrare per cliente e mostrare il link a Conto terzi / Preventivi.
- **Terreni:** i **terreni clienti** sono documenti nella collection terreni con **clienteId** valorizzato. La pagina Terreni (core) può filtrare per “solo aziendali” o “per cliente”; la pagina **Terreni Clienti** del modulo Conto terzi elenca i terreni dei clienti. I lavori conto terzi usano un terreno cliente (terrenoId).
- **Core (Dashboard):** la Dashboard principale mostra la card Conto Terzi se il modulo è attivo. Dalla Gestione Lavori si può avere un link alla Home Conto terzi (es. se il contesto è conto terzi).
- **Vigneto / Frutteto:** i lavori conto terzi possono essere di tipo potatura, vendemmia, raccolta, trattamento; i moduli Vigneto/Frutteto possono aprire lavori con clienteId e terreno cliente. Nessuna modifica specifica ai modelli vigneto/frutteto: il collegamento è tramite **lavoro** (clienteId, preventivoId).
- **Manodopera:** le ore e i compensi per i lavori conto terzi seguono le stesse regole (caposquadra/operaio, validazione); le tariffe compensi operai sono distinte dalle **tariffe preventivo** (€/ha per tipo lavoro/coltura/tipo campo).

Dettagli sui flussi che coinvolgono più moduli (es. preventivo → accettazione → lavoro → ore → attività) in **Intersezioni tra moduli** (`intersezioni-moduli.md`).
