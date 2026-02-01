# 🧭 Guida Sviluppo Moduli Frutteto e Oliveto

**Data creazione**: 2026-01-27  
**Scopo**: Documento operativo per procedere in modo coordinato (anche con più agenti) senza perdere il focus su cosa fare e come.  
**Aggiornare questo file** quando si completano fasi o si prendono decisioni.

---

## 📌 In sintesi: cosa fare e come

| Cosa | Come |
|------|------|
| **Obiettivo** | Creare i moduli Frutteto e Oliveto riutilizzando il modulo Vigneto esistente (~70–80% codice in comune). |
| **Approccio** | Ereditarietà: base comune + specializzazioni. **Non** clonare e adattare a mano. |
| **Ordine** | 1) Base comune (estratta da vigneto) → 2) Frutteto → 3) Oliveto. |
| **Riferimento codice** | Tutto il modulo `modules/vigneto/` è il modello da cui partire. |

---

## 🎯 Obiettivo condiviso

- **Frutteto**: anagrafica frutteti, raccolta frutta, (diradamento), rese per specie; stesse logiche di vigneto, con campi/terminologia propri (es. specie, calibro, piante/ha).
- **Oliveto**: anagrafica oliveti, raccolta olive, molitura/resa olio; stesse logiche di vigneto, con campi/terminologia propri (es. varietà multiple, resa olio %, frantoio).
- **Coerenza**: stessi pattern di integrazione (lavori, attività, terreni, abbonamento, report) già usati in vigneto.

---

## 📂 Stato attuale (31 gen 2026)

### Esiste e funziona

- **Modulo Vigneto** (`modules/vigneto/`): completo (anagrafica, vendemmia, pianificazione impianti, calcolo materiali, statistiche, integrazioni).
- **Modulo Frutteto** (`modules/frutteto/`): anagrafica frutteti, Gestione Raccolta Frutta, dashboard, statistiche, integrazione lavori; tracciamento poligono, dropdown nome/podere, sync zona da lavoro, colonna Lavoro, Dashboard e ordine pulsanti come Vendemmia.
- **Modulo Report** (`modules/report/`): MVP con adapter vigneto e export Excel.
- **Abbonamento**: moduli/bundle (vigneto, frutteto, oliveto già previsti in `core/config/subscription-plans.js`).
- **Lavori**: tipi "Impianto Nuovo Frutteto" e "Impianto Nuovo Oliveto" già in `core/services/tipi-lavoro-service.js`.

### Completato in Fase 1 (27 gen 2026)

- Classe base condivisa `shared/models/BaseColtura.js`; `Vigneto` estende `BaseColtura`.

### Completato Raccolta Frutta – sistemazione (31 gen 2026)

- Sync zona da lavoro (`loadPoligonoFromZoneLavorate`, pre-popolamento in modifica raccolta da `zoneLavorate` del lavoro).
- Formattazione superficie raccolta (ha) con due decimali.
- Colonna "Lavoro" in tabella raccolte con link "🔗 Vedi Lavoro" (allineato a Vendemmia).
- Pulsante "← Dashboard" funzionante e ordine pulsanti come Vendemmia: Nuova raccolta → ← Frutteti → ← Dashboard.

### Non esiste ancora

- Cartella `modules/oliveto/` (modulo Frutteto esiste in `modules/frutteto/`).
- Servizio base parametrizzato (opzionale; frutteto/oliveto possono usare helper comuni o servizi dedicati).
- Servizi comuni parametrizzati per tipo coltura (CRUD anagrafica, raccolte, spese).

### Documentazione di riferimento (leggere prima di agire)

| File | Contenuto |
|------|-----------|
| `PLAN_MODULI_COLTURA_SPECIALIZZATI.md` | Architettura, campi comuni/specifici, struttura dati, servizi condivisi, frutteto/oliveto. |
| `STATO_MODULI_SPECIALIZZATI_2026-01-18.md` | Stato dettagliato vigneto, cosa è fatto e cosa resta. |
| `modules/vigneto/models/Vigneto.js` | Modello anagrafica da cui estrarre la base. |
| `modules/vigneto/services/vigneti-service.js` | Pattern CRUD da parametrizzare per collezione (`vigneti` → `frutteti` / `oliveti`). |

---

## 🏗️ Architettura decisa (da rispettare)

1. **Modello base comune**  
   Classe (es. `BaseColtura`) con tutti i campi comuni (terrenoId, varietà, annataImpianto, densità, formaAllevamento, distanze, superficie, rese, spese, costi, statoImpianto, date ultima potatura/trattamento/raccolta).  
   Vigneto/Frutteto/Oliveto **estendono** questa base e aggiungono solo i campi specifici (vedi tabelle in `PLAN_MODULI_COLTURA_SPECIALIZZATI.md`).

2. **Collezioni Firestore**  
   - `tenants/{tenantId}/vigneti/` (esiste).  
   - `tenants/{tenantId}/frutteti/` (da creare).  
   - `tenants/{tenantId}/oliveti/` (da creare).  
   Nessuna modifica invasiva alle collezioni esistenti (terreni, lavori, attività).

3. **Servizi**  
   - Opzione A (consigliata): servizio base parametrizzato per nome collezione + tipo modello (es. `getAllColture('frutteti', Frutteto)`).  
   - Opzione B: servizio per coltura (frutteti-service, oliveti-service) che usa internamente una base comune.  
   In entrambi i casi, **non** duplicare a mano la logica CRUD: estrarre/compartire.

4. **Integrazioni**  
   Stesso schema del vigneto:  
   - Lavori/Attività → collegamento tramite `terrenoId`; eventuale creazione automatica anagrafica da “Impianto Nuovo Frutteto/Oliveto”.  
   - Spese/costi → aggregazione da lavori/attività (come in `lavori-vigneto-service.js`).  
   - Abbonamento: moduli `frutteto` e `oliveto` già in config; solo assicurarsi che le pagine rispettino `tenant.modules`.

5. **UI**  
   - Per ogni modulo: anagrafica (lista + form) + raccolta (equivalente “vendemmia”) come primo step.  
   - Terminologia: “Raccolta” invece di “Vendemmia”; label e placeholder specifici (es. specie, calibro, resa olio).

---

## 📋 Piano operativo step-by-step

### Fase 0 – Prerequisito (chi lavora sul codice)

- [x] Leggere **sezioni rilevanti** di `PLAN_MODULI_COLTURA_SPECIALIZZATI.md` (campi comuni, strutture Vigneto/Frutteto/Oliveto, servizi condivisi).
- [x] Avere chiaro dove si trova il modulo vigneto: `modules/vigneto/` (models, services, views, config).

### Fase 1 – Base comune (da fare per prima)

**Obiettivo**: codice condiviso per anagrafica e logica “raccolta”, senza rompere il vigneto esistente.

1. **Modello base**
   - [x] Creare `shared/models/` (shared/ esisteva già; aggiunta cartella models).
   - [x] Creare classe base `BaseColtura` in `shared/models/BaseColtura.js` con i **soli** campi comuni da `PLAN_MODULI_COLTURA_SPECIALIZZATI.md`.
   - [x] Metodi comuni: `validate()`, `calcolaCostoTotaleAnno()`, `calcolaCostoPerEttaro()`, `calcolaMargineAnno()`, `aggiornaCostiCalcolati()`, `isAttivo()`, `getStatoFormattato()`.

2. **Adattare il vigneto alla base**
   - [x] Far estendere `Vigneto` da `BaseColtura` invece che da `Base`; spostata in BaseColtura la logica condivisa; Vigneto mantiene solo campi/metodi specifici.
   - [x] Verificare che anagrafica vigneti e vendemmia continuino a funzionare (test manuale effettuato – tutto ok).

3. **Servizio base (opzionale ma utile)**
   - [ ] Creare un servizio generico (es. `coltura-base-service.js`) che accetta nome collezione e modello, e implementa getAll/get/create/update/delete usando `firebase-service` e `tenant-service`.  
   - [ ] Oppure documentare in questo file come i singoli servizi frutteto/oliveto devono richiamare helper comuni (senza duplicare if/else).

**Checkpoint Fase 1**: build/test vigneto invariato; classe base utilizzabile da frutteto/oliveto. *(Servizio base opzionale rimandato.)*

### Fase 2 – Modulo Frutteto

**Obiettivo**: anagrafica frutteti + gestione “raccolta frutta” (equivalente vendemmia).

1. **Struttura**
   - [ ] Creare `modules/frutteto/models/Frutteto.js` (extends BaseColtura), `RaccoltaFrutta.js` (analogo a Vendemmia).
   - [ ] Creare `modules/frutteto/services/frutteti-service.js`, `raccolta-frutta-service.js` (o uso del servizio base + estensioni).
   - [ ] Creare `modules/frutteto/config/` con liste per dropdown: specie (Melo, Pesco, Pero, …), forme allevamento frutteto (vaso, palmetta, spalliera), varietà per specie (es. Gala, Fuji, …).

2. **Viste**
   - [ ] `frutteti-standalone.html`: lista frutteti, filtri (terreno, specie, varietà, stato), form creazione/modifica (campi da `PLAN_MODULI_COLTURA_SPECIALIZZATI.md` – Frutteto).
   - [ ] `raccolta-frutta-standalone.html`: lista raccolte, form con quantità, qualità (calibro, grado maturazione), operai/macchine come in vendemmia.

3. **Integrazioni**
   - [ ] Firestore rules per `frutteti` e subcollection `raccolte`.
   - [ ] Abbonamento: modulo `frutteto` già in config; le nuove pagine devono controllare `tenant.modules.includes('frutteto')`.
   - [ ] Dashboard: card/link “Frutteto” visibili se modulo attivo (stesso pattern della card Vigneto in `core/js/dashboard-sections.js`).
   - [ ] (Opzionale) Lavori: form “Impianto Nuovo Frutteto” e creazione automatica frutteto da pianificazione, su modello di `creaVignetoDaLavoro` in `gestione-lavori-events.js`.

**Checkpoint Fase 2**: si possono creare frutteti e raccolte; le viste sono raggiungibili con modulo frutteto attivo; nessun errore in console.

### Fase 3 – Modulo Oliveto

**Obiettivo**: anagrafica oliveti + gestione raccolta olive (+ eventuale molitura/resa olio).

1. **Struttura**
   - [ ] Creare `modules/oliveto/models/Oliveto.js` (extends BaseColtura; campo `varieta` come array), `RaccoltaOlive.js`; opzionale `Molitura.js` se si gestisce la resa olio in questa fase.
   - [ ] Creare servizi analoghi a frutteto (oliveti-service, raccolta-olive-service).
   - [ ] Creare `modules/oliveto/config/` con varietà olive (Frantoio, Leccino, Moraiolo, …), forme allevamento (vaso, monocono), metodo raccolta (manuale, meccanica, abbacchiatura).

2. **Viste**
   - [ ] `oliveti-standalone.html`: lista oliveti, form con varietà multiple, frantoio preferito, metodo raccolta preferito.
   - [ ] `raccolta-olive-standalone.html`: lista raccolte, form con quantità, metodo raccolta, operai/macchine.
   - [ ] (Fase successiva) `molitura-standalone.html` se si include la gestione olio.

3. **Integrazioni**
   - [ ] Firestore rules per `oliveti` e subcollection `raccolte` (e eventualmente `moliture`).
   - [ ] Abbonamento e dashboard come per frutteto, chiave modulo `oliveto`.
   - [ ] (Opzionale) Lavori: “Impianto Nuovo Oliveto” e creazione automatica oliveto da pianificazione.

**Checkpoint Fase 3**: anagrafica oliveti e raccolte olive utilizzabili; UX coerente con frutteto e vigneto.

### Fase 4 – Allineamenti e report (dopo MVP)

- [ ] Report/Bilancio: adapter Frutteto e Oliveto per il modulo report (come `vigneto-adapter.js`).
- [ ] Pianificazione impianti: estendere `pianificazioni-impianti` e viste per `tipoColtura = 'frutteto'` e `'oliveto'` (reticolato e calcolo materiali hanno parametri diversi: distanze, strutture).
- [ ] Calcolo materiali: logiche specifiche per frutteto/oliveto (pali, reti, ecc.) come da `PLAN_MODULI_COLTURA_SPECIALIZZATI.md`.

---

## ✅ Decisioni già prese (non cambiare senza discutere)

- Ereditarietà da base comune; niente clonazione “cieca” del vigneto.
- Stesse integrazioni del vigneto: lavori, attività, terreni, abbonamento, multi-tenant.
- Potatura/trattamenti **non** viste dedicate: restano nei Lavori/Diario; le anagrafiche coltura aggregavano già le spese da lì.
- Raccolta (vendemmia/raccolta frutta/raccolta olive) ha form dedicato per dati specifici (quantità, qualità, ecc.); costi operai/macchine restano legati a lavori/attività.
- Moduli frutteto e oliveto sono **opzionali** e controllati da `tenant.modules`; le pagine devono controllare l’accesso e, se il modulo non è attivo, reindirizzare (es. ad abbonamento) come fa il vigneto.

---

## ❌ Cose da non fare

- **Non** duplicare interi file del vigneto rinominando “vigneto” in “frutteto”: porta a 3 copie da mantenere e divergenze.
- **Non** modificare il comportamento attuale del vigneto senza avere test o checklist che confermano che nulla si rompe.
- **Non** introdurre nuove collezioni o campi “a caso” in terreni/lavori/attività: usare il pattern già in uso (riferimenti per id, subcollection per dati di coltura).
- **Non** saltare la Fase 1 per “andare veloce” su frutteto: senza base comune, frutteto e oliveto diventeranno due copie pesanti e fragili.

---

## 📁 File chiave da conoscere

| Ruolo | Path |
|-------|------|
| Modello base comune | `shared/models/BaseColtura.js` |
| Modello anagrafica | `modules/vigneto/models/Vigneto.js` |
| Modello raccolta | `modules/vigneto/models/Vendemmia.js` |
| Servizio anagrafica | `modules/vigneto/services/vigneti-service.js` |
| Servizio raccolta | `modules/vigneto/services/vendemmia-service.js` |
| Integrazione lavori | `modules/vigneto/services/lavori-vigneto-service.js` |
| Form vigneto in lavori | `core/admin/gestione-lavori-standalone.html` (blocco “vigneto-form-group”), `core/admin/js/gestione-lavori-events.js` (`creaVignetoDaLavoro`) |
| Config moduli/abbonamento | `core/config/subscription-plans.js` |
| Card dashboard | `core/js/dashboard-sections.js` (es. `createVignetoCard`) |
| Regole Firestore | `firestore.rules` (cercare `vigneti`) |

---

## 🔄 Per gli agenti: come usare questa guida

1. **Prima di iniziare**  
   Leggere almeno: “In sintesi” (sopra), “Obiettivo condiviso”, “Architettura decisa”, “Fase” su cui si lavora e “Cose da non fare”.

2. **Durante il lavoro**  
   - Seguire l’ordine Fase 1 → 2 → 3; non implementare frutteto/oliveto prima di avere la base comune se si sta facendo architettura.  
   - Aggiornare le checkbox `[ ]` → `[x]` nel documento quando si completa un sotto-task.

3. **Dopo una sessione**  
   - Scrivere in coda al file (sezione “Log modifiche”) cosa è stato fatto e quali file sono stati toccati.  
   - Se è stata presa una decisione diversa dal piano (es. nome classe base, percorso `shared/`), aggiornare la sezione “Decisioni già prese” o “Architettura decisa” e la data.

4. **Se si lavora in parallelo**  
   - Un agente può occuparsi della Fase 1 (base comune + refactor vigneto), un altro della Fase 2 **solo dopo** che Fase 1 è stabile e documentata.  
   - Evitare due agenti che modificano gli stessi file (es. stessi servizi o stesse viste) senza accordo esplicito.

---

## 📝 Log modifiche

*(Compilare a ogni sessione significativa.)*

| Data | Chi/Cosa | Modifiche |
|------|----------|-----------|
| 2026-01-27 | Creazione documento | Prima stesura guida operativa per moduli Frutteto/Oliveto e lavoro multi-agente. |
| 2026-01-27 | Fase 1 – Base comune | Creato `shared/models/BaseColtura.js` con campi e metodi comuni (validate, costi, margini, stato). `modules/vigneto/models/Vigneto.js` ora estende `BaseColtura`; mantenuta compatibilità Firestore (dataUltimaVendemmia, alias). Servizio base generico non ancora creato. |
| 2026-01-27 | Verifica Fase 1 | Test manuale anagrafica vigneti e vendemmia: tutto funzionante; nessun errore in console. Checkpoint Fase 1 confermato. |

---

*Ultimo aggiornamento: 2026-01-29*
