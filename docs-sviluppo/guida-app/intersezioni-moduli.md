# Intersezioni tra moduli

Documento che descrive **come i moduli si intersecano** nell’app GFV Platform: elenco modulo A ↔ modulo B, flussi operativi che attraversano più aree e ruoli nelle varie sezioni. Serve all’assistente (e a chi sviluppa/manutiene) per rispondere a domande come “Da dove registro l’uso di un prodotto in un trattamento?” o “Come si collegano i lavori ai caposquadra e agli operai?”.

Riferimento: Piano guida app §3.4.

---

## 1. Matrice modulo A ↔ modulo B

Per ogni coppia rilevante: cosa si collega e dove.

| Da / verso | Collegamento |
|------------|--------------|
| **Core (Dashboard, Ruoli) ↔ Tutte le aree** | La dashboard mostra sezioni e card in base a **ruolo** e **moduli attivi**. Ogni modulo è accessibile dalla dashboard se attivo; i ruoli (amministratore, manager, caposquadra, operaio) determinano cosa si vede e cosa si può fare in ogni area. |
| **Terreni ↔ Core (Attività, Statistiche)** | Le attività e le statistiche usano i **terreni** (associazione terreno–attività, ore per terreno). I terreni sono la base per il Diario Attività e per i report. |
| **Terreni ↔ Lavori e attività** | Ogni **lavoro** è associato a un **terreno** (terrenoId). Le **zone lavorate** sono salvate sotto il lavoro e richiedono che il terreno abbia **confini tracciati** (tracciati nella pagina Terreni). |
| **Terreni ↔ Vigneto / Frutteto** | Ogni **vigneto** e ogni **frutteto** è collegato a un **terreno** (terrenoId). Si accede a Vigneto/Frutteto dalla lista terreni (terreno con coltura vigneto/frutteto) o dalla dashboard. Le zone lavorate nei trattamenti/vendemmia/potatura/raccolta richiedono confini terreno tracciati. |
| **Terreni ↔ Conto terzi** | I **terreni clienti** sono terreni con **clienteId** valorizzato. Usati in preventivi e lavori conto terzi. La pagina Terreni Clienti elenca i terreni dei clienti; la lista Terreni (core) può filtrare “solo aziendali”. |
| **Terreni ↔ Impostazioni** | I **poderi** (configurati in Impostazioni) sono usati nella pagina Terreni per associare ogni terreno a un podere. Le **colture** sono liste aziendali usate per filtri e mappa. |
| **Lavori e attività ↔ Manodopera (ruoli)** | I **lavori** sono assegnati a un **caposquadra** (lavoro di squadra) o a un **operaio** (lavoro autonomo). Le **ore** sono segnate da operaio/caposquadra e **validate** da caposquadra (lavori squadra) o manager (lavori autonomi). Le **attività** possono avere lavoroId; il **Diario da Lavori** aggrega le ore validate. |
| **Lavori e attività ↔ Vigneto / Frutteto** | **Potatura** e **vendemmia** (Vigneto), **potatura** e **raccolta frutta** (Frutteto) possono essere collegate a un **lavoro** (lavoroId). Le **zone lavorate** si tracciano in quei moduli e sono salvate sotto il lavoro. |
| **Lavori e attività ↔ Conto terzi** | I **lavori conto terzi** hanno **clienteId** (e opzionalmente **preventivoId**). Creati da preventivo accettato (stato “pianificato”) o a mano. Le attività e le ore possono avere clienteId. |
| **Lavori e attività ↔ Parco macchine** | Un **lavoro** può avere **macchinaId**, **attrezzoId**, **operatoreMacchinaId**. Le ore possono includere **ore macchina**. (Modulo Parco macchine: gestione macchine e manutenzioni.) |
| **Magazzino ↔ Trattamenti (Vigneto/Frutteto)** | Nei **trattamenti** vigneto e frutteto i prodotti possono essere referenziati con **prodottoId** (anagrafica Magazzino). Si traccia l’uso e si può registrare un’**uscita** di magazzino (movimento) collegata al trattamento/lavoro, aggiornando la **giacenza**. |
| **Magazzino ↔ Lavori** | I **movimenti** di tipo uscita possono essere collegati a un **lavoro** (lavoroId) o a un’**attività** (attivitaId) per indicare che il prodotto è stato usato in quel contesto. |
| **Conto terzi ↔ Lavori / Clienti** | **Clienti** e **terreni clienti**; **preventivi** (calcolo da tariffe, invio email, accettazione); da preventivo **pianificato** si crea un **lavoro** con clienteId e preventivoId. Lavori per conto di clienti esterni; la fatturazione formale non è implementata nell’app. |
| **Mappe ↔ Terreni** | **Mappa aziendale** (dashboard) visualizza i **terreni** con i loro confini sulla mappa. Filtri per podere e coltura. Con modulo Manodopera: overlay **zone lavorate** e **indicatori lavori**. |
| **Mappe ↔ Parco macchine** | Posizione/uso mezzi sulla mappa (se implementato nel modulo Parco macchine). |
| **Vigneto ↔ Frutteto (Pianificazione / Calcolo materiali)** | Le funzionalità **Pianifica Nuovo Impianto** e **Calcolo Materiali** sono implementate nel modulo Vigneto e riutilizzate per il Frutteto con parametro **coltura=frutteto** (stesse viste, logica adattata). |

---

## 2. Flussi operativi che attraversano più moduli

Breve descrizione dei flussi tipici: quali sezioni toccano, in che ordine, chi può farlo.

### 2.1 Registrare un trattamento e (opzionale) scaricare i prodotti dal magazzino

1. **Vigneto** o **Frutteto** → Trattamenti: apri il modulo (Dashboard → Vigneto/Frutteto → Trattamenti), seleziona vigneto/frutteto, crea trattamento (data, tipo, prodotti, dosaggio, superficie, costi).
2. **Magazzino:** i prodotti possono essere scelti dall’anagrafica (prodottoId); nome, dosaggio e costo sono coerenti con il prodotto. Opzionalmente si registra un’**uscita** di magazzino (Movimenti) collegata al lavoro/attività del trattamento, aggiornando la giacenza.
3. **Chi può farlo:** tipicamente Manager e Amministratore (gestione trattamenti); l’operatore del trattamento può essere un operaio/caposquadra (campo operatore nel trattamento).

### 2.2 Creare un lavoro, assegnare caposquadra o operaio, segnare e validare le ore

1. **Gestione Lavori** (Dashboard → Gestione Lavori): crea lavoro (nome, terreno, tipo lavoro, data inizio, durata; **caposquadra** per lavoro di squadra oppure **operaio** per lavoro autonomo). Solo Manager e Amministratore.
2. **Segnatura ore:** Operaio o Caposquadra, dalla pagina Segnatura ore o da contesto lavoro, inserisce data, orari, ore nette per il lavoro. Le ore sono salvate nella sub-collection **oreOperai** del lavoro (stato **da_validare**).
3. **Validazione ore:** **Caposquadra** valida le ore dei **lavori di squadra** a lui assegnati; **Manager** valida le ore dei **lavori autonomi**. Dalla pagina Validazione ore: approva (→ **validate**) o rifiuta (→ **rifiutate**).
4. **Attività / Diario da Lavori:** le ore **validate** alimentano il Diario da Lavori (attività generate dalle ore approvate) e le statistiche (ore totali, compensi).

### 2.3 Tracciare zone lavorate su un lavoro (es. trattamento vigneto)

1. **Terreni:** il **terreno** del lavoro deve avere **confini già tracciati** (pagina Terreni → Traccia confini). Altrimenti l’app segnala di tracciare prima i confini.
2. **Vigneto** (o Frutteto) → Trattamenti (o Vendemmia, Potatura, Raccolta): apri il **lavoro** collegato, traccia le **zone lavorate** sulla mappa (segmenti/aree effettivamente lavorate). Le zone sono salvate sotto il lavoro: `tenants/{tenantId}/lavori/{lavoroId}/zoneLavorate`.
3. **Lavori:** la **superficie totale lavorata** e la **percentuale completamento** del lavoro possono essere aggiornate in base alle zone lavorate.
4. **Chi può farlo:** tipicamente Caposquadra o chi gestisce il lavoro (in contesto Vigneto/Frutteto).

### 2.4 Preventivo conto terzi → accettazione → lavoro pianificato

1. **Conto terzi** → Clienti: anagrafica cliente (ragione sociale, contatti). **Terreni Clienti:** terreni con clienteId (o creazione da preventivo).
2. **Conto terzi** → Tariffe: configurazione tariffe (tipo lavoro, coltura, tipo campo, €/ettaro).
3. **Conto terzi** → Nuovo preventivo: compila cliente, terreno (o nuovo), tipo lavoro, coltura, tipo campo, superficie; il **totale** è calcolato dalle tariffe. Salva (stato **bozza**), poi **invia** per email (stato **inviato**); il cliente riceve il link con token.
4. **Accetta preventivo** (pagina pubblica): il cliente apre il link e **accetta** o **rifiuta**. Lo stato passa a **accettato_email** o **rifiutato**.
5. **Conto terzi** → Preventivi: il Manager conferma (eventualmente **accettato_manager**) e **pianifica**: viene creato un **lavoro** con clienteId e preventivoId; lo stato del preventivo diventa **pianificato** e il campo **lavoroId** viene valorizzato.
6. **Gestione Lavori:** il lavoro conto terzi compare nella lista; si assegnano caposquadra/operaio, si segnano e validano le ore come per gli altri lavori. Le attività collegate possono avere clienteId.
7. **Chi può farlo:** Manager e Amministratore (clienti, preventivi, tariffe, pianificazione); il **cliente** solo accettazione/rifiuto tramite link (senza login obbligatorio). Fatturazione formale non implementata.

### 2.5 Visualizzare terreni e zone lavorate sulla mappa aziendale

1. **Dashboard** → sezione **Vista Mappa Aziendale**: vengono mostrati tutti i **terreni** del tenant con i loro confini sulla mappa. Filtri per **podere** e **coltura**.
2. Con modulo **Manodopera** attivo: pulsanti **Zone Lavorate** e **Indicatori Lavori** per mostrare/nascondere overlay delle zone lavorate e indicatori stato lavori.
3. **Chi può farlo:** chi ha accesso alla dashboard e ai terreni (in base a ruolo e moduli attivi).

### 2.6 Vendemmia / Raccolta frutta con lavoro e ore

1. **Vigneto** → Vendemmia (o **Frutteto** → Raccolta frutta): crea registrazione vendemmia/raccolta (data, quantità, varietà/specie, eventuale **lavoroId**). Può essere collegata a un **lavoro** già creato (es. “Vendemmia Chardonnay”).
2. **Lavori e attività:** il lavoro è assegnato a caposquadra/operaio; le **ore** segnate e validate per quel lavoro alimentano il Diario da Lavori e i **compensi**. Le spese vendemmia/raccolta possono usare le tariffe operai (modulo Manodopera).
3. **Chi può farlo:** Manager/Amministratore per creare vendemmia/raccolta e collegare il lavoro; Caposquadra/Operaio per segnare ore; Caposquadra/Manager per validare ore.

---

## 3. Ruoli e moduli

Come i **ruoli** (amministratore, manager, caposquadra, operaio) si riflettono sulle varie aree e sulle intersezioni.

| Ruolo | In sintesi | Aree e intersezioni |
|-------|------------|----------------------|
| **Amministratore** | Massimi permessi: utenti, ruoli, abbonamento, impostazioni azienda; può fare tutto il manager. | Può accedere a tutte le sezioni e moduli attivi per il tenant. Gestisce clienti, preventivi, tariffe, terreni, lavori, trattamenti, prodotti, movimenti, statistiche. Nelle intersezioni: può creare lavori da preventivo, validare ore (lavori autonomi), registrare trattamenti e uscite magazzino, tracciare zone lavorate (se abilitato in UI). |
| **Manager** | Gestione operativa e gestionale: terreni, attività, lavori, squadre, moduli; non gestisce abbonamento né assegnazione ruoli. | Può creare/modificare/eliminare lavori, gestire terreni, attività, clienti, preventivi, tariffe, terreni clienti, trattamenti, vendemmia, raccolta, prodotti e movimenti. **Valida le ore** dei **lavori autonomi** (lavori assegnati direttamente a un operaio). Non può assegnare/rimuovere ruoli né gestire l’abbonamento. |
| **Caposquadra** | Vede solo i **lavori a lui assegnati** (lavori di squadra). Può aggiornare **stato** e **note** dei lavori; **valida le ore** segnate dagli operai per quei lavori. Può inviare comunicazioni agli operai. | Non accede a Clienti, Preventivi, Tariffe, Anagrafica prodotti, Gestione Lavori (creazione). Accede a: I miei lavori, Validazione ore (solo lavori squadra), Segnatura ore, eventualmente tracciamento zone lavorate in Vigneto/Frutteto per i propri lavori. Nelle intersezioni: valida ore → queste alimentano Diario da Lavori e compensi; non può creare lavori da preventivo. |
| **Operaio** | Vede solo i **lavori a cui è assegnato** (direttamente o tramite squadra). Segna le **ore**; non può validare. Riceve comunicazioni dal caposquadra. | Non accede a Gestione Lavori, Validazione ore, Clienti, Preventivi, Tariffe, Prodotti/Movimenti, impostazioni. Accede a: Lavori di oggi, Segnatura ore, Comunicazioni, eventualmente pagine semplificate per i propri lavori. Nelle intersezioni: le ore che segna restano in stato **da_validare** finché caposquadra o manager non le approvano; non vede dati di altri lavori o clienti. |

- **Dashboard e navigazione:** le **sezioni e le card** visibili in dashboard dipendono da **ruolo** e **moduli attivi** (es. senza modulo Manodopera non compaiono Gestione Lavori, Validazione ore, Zone lavorate; l’operaio vede solo le sezioni pertinenti).
- **Isolamento dati:** i dati sono **isolati per tenant**; i ruoli sono **per tenant** (tenantMemberships). In ogni sessione si lavora su un solo tenant (tenant corrente); il cambio azienda cambia tutto ciò che si vede.

---

## 4. Riepilogo

- **Matrice:** Core/Dashboard e Ruoli applicati a tutte le aree; Terreni con Lavori, Vigneto, Frutteto, Conto terzi, Impostazioni; Lavori con Manodopera, Vigneto/Frutteto, Conto terzi, Parco macchine; Magazzino con Trattamenti e Lavori; Conto terzi con Lavori e Clienti; Mappe con Terreni (e Parco macchine); Vigneto con Frutteto (pianificazione/calcolo materiali condivisi).
- **Flussi:** Trattamento + scarico magazzino; Lavoro → ore → validazione → Diario da Lavori; Zone lavorate (terreno con confini + lavoro in Vigneto/Frutteto); Preventivo → accettazione → lavoro pianificato; Mappa aziendale (terreni + zone lavorate); Vendemmia/raccolta con lavoro e ore.
- **Ruoli:** Amministratore e Manager su tutte le aree consentite dai moduli; Caposquadra su propri lavori e validazione ore squadra; Operaio solo su propri lavori e segnatura ore. Validazione ore autonomi solo Manager/Amministratore.

Quando si aggiunge un **nuovo modulo** che si interseca con altri, aggiornare questo documento (matrice, flussi e ruoli) e i file guida dei moduli coinvolti (sezione “Relazioni con altri moduli”).
