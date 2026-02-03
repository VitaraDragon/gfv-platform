# Checklist sezioni – Guida app per l'assistente

Documento operativo per implementare la guida dell'app (vedi `PIANO_GUIDA_APP_ASSISTENTE.md`). Contiene: **sezioni distinte**, **ordine di implementazione**, **checklist con stato** e **istruzioni per l'agente**, così che l’assegnazione a un nuovo agente sia univoca.

---

## Dove si trova tutto

- **Piano e regole:** `docs-sviluppo/PIANO_GUIDA_APP_ASSISTENTE.md` (intent, struttura, schema §5, ambiti §1.2).
- **Guida (output):** cartella `docs-sviluppo/guida-app/` (da creare con Fase 1).
- **Questa checklist:** `docs-sviluppo/CHECKLIST_SEZIONI_GUIDA_APP.md`.

---

## Ordine di implementazione

Le sezioni vanno implementate in questo ordine (le dipendenze sono rispettate):

| Ordine | Sezione | File di output | Dipendenze |
|--------|---------|----------------|-------------|
| 1 | Indice e struttura | `guida-app/README.md` + cartelle | Nessuna |
| 2 | Core – Panoramica, accesso, multi-tenant, ruoli | `guida-app/core.md` (parte 1) o `guida-app/core/01-panoramica-accesso-ruoli.md` | S1 |
| 3 | Core – Navigazione, dashboard, opzioni | `guida-app/core.md` (parte 2) o `guida-app/core/02-navigazione-dashboard-opzioni.md` | S1 |
| 4 | Core – Glossario, regole comuni, alert/form/calcoli | `guida-app/core.md` (parte 3) o `guida-app/core/03-glossario-regole-alert-form.md` | S1, S2, S3 |
| 5 | Terreni | `guida-app/moduli/terreni.md` | S1, S2 |
| 6 | Lavori e attività | `guida-app/moduli/lavori-attivita.md` | S1, S2 |
| 7 | Modulo Vigneto | `guida-app/moduli/vigneto.md` | S1–S4 |
| 8 | Modulo Frutteto | `guida-app/moduli/frutteto.md` | S1–S4 |
| 9 | Modulo Magazzino | `guida-app/moduli/magazzino.md` | S1–S4 |
| 10 | Modulo Conto terzi | `guida-app/moduli/conto-terzi.md` | S1–S4 |
| 11 | Intersezioni tra moduli | `guida-app/intersezioni-moduli.md` | S5–S10 (dopo almeno alcuni moduli) |

**Nota:** Si può scegliere se il Core è un unico file `core.md` (da compilare in più passate S2+S3+S4) oppure più file in `guida-app/core/`. La checklist sotto assume **un file `core.md`** aggiornato in sequenza (S2, S3, S4); se preferisci file separati, adatta i path.

---

## Checklist sezioni (stato)

Usa questa tabella per spuntare e assegnare il lavoro. Aggiorna lo stato quando una sezione è completata.

| # | Sezione | File output | Stato |
|---|---------|-------------|--------|
| S1 | Indice e struttura | `guida-app/README.md` | [x] fatto |
| S2 | Core – Panoramica, accesso, multi-tenant, ruoli | `guida-app/core.md` | [x] fatto |
| S3 | Core – Navigazione, dashboard, opzioni | `guida-app/core.md` | [x] fatto |
| S4 | Core – Glossario, regole, alert/form/calcoli | `guida-app/core.md` | [x] fatto |
| S5 | Terreni | `guida-app/moduli/terreni.md` | [x] fatto |
| S6 | Lavori e attività | `guida-app/moduli/lavori-attivita.md` | [x] fatto |
| S7 | Modulo Vigneto | `guida-app/moduli/vigneto.md` | [x] fatto |
| S8 | Modulo Frutteto | `guida-app/moduli/frutteto.md` | [x] fatto |
| S9 | Modulo Magazzino | `guida-app/moduli/magazzino.md` | [x] fatto |
| S10 | Modulo Conto terzi | `guida-app/moduli/conto-terzi.md` | [x] fatto |
| S11 | Intersezioni tra moduli | `guida-app/intersezioni-moduli.md` | [x] fatto |

**Stati possibili:** `[ ] da fare` | `[~] in corso` | `[x] fatto`

---

## Istruzioni per sezione (per l’agente)

Quando assegni una sezione a un agente, dagli:

1. **Questo file** (`CHECKLIST_SEZIONI_GUIDA_APP.md`) e il **Piano** (`PIANO_GUIDA_APP_ASSISTENTE.md`).
2. **Il numero/ID della sezione** (es. S2, S7).
3. **Le istruzioni specifiche** sotto per quella sezione (copia-incolla il blocco corrispondente).

---

### S1 – Indice e struttura

**Cosa fare:** Creare la cartella `docs-sviluppo/guida-app/` e la sottocartella `guida-app/moduli/`. Creare `guida-app/README.md` come indice della guida.

**Contenuto README.md:**
- Titolo: Guida dell’app GFV Platform (per assistente e riferimento).
- Elenco delle sezioni/moduli con link ai file (es. Core → core.md, Terreni → moduli/terreni.md, Vigneto → moduli/vigneto.md, Intersezioni → intersezioni-moduli.md). I file non ancora scritti possono essere elencati come “da compilare”.
- Breve nota: guida modulare, uso per assistente Gemini e per utenti/sviluppatori (riferimento al Piano).

**Output:** `guida-app/README.md`, cartelle `guida-app/`, `guida-app/moduli/`.

**Schema:** Non applicabile (è solo indice e struttura).

---

### S2 – Core – Panoramica, accesso, multi-tenant, ruoli

**Cosa fare:** Scrivere la prima parte del Core della guida: panoramica dell’app, accesso (login), multi-tenant (cambio azienda, isolamento dati), ruoli (admin, manager, caposquadra, operaio) e cosa può fare ognuno in linea di massima.

**Riferimenti:** Piano §3.1 (Parte core), §5 (Schema fisso). Ambito di copertura §1.2: “Accesso e multi-tenant”, “Ruoli e permessi”.

**Schema da rispettare (adattato al core):** Titolo, Scopo (panoramica app), Dove si trova (applicato a tutta l’app), Funzionalità (login, gestione tenant, ruoli), Termini (tenant, ruolo, …), Limitazioni/regole (es. solo admin può…). Vedi Piano §5.

**Output:** Creare `guida-app/core.md` e scrivere questa parte; oppure, se usi file separati, creare `guida-app/core/01-panoramica-accesso-ruoli.md`.

**Dipendenze:** S1 completata (cartelle e README esistono).

---

### S3 – Core – Navigazione, dashboard, opzioni

**Cosa fare:** Aggiungere al Core: navigazione (menu principale, sezioni, come passare da un’area all’altra), dashboard (widget, blocchi), opzioni e impostazioni (dove si trovano, cosa si può configurare, effetti). Riferimento ambiti §1.2: “Dashboard e navigazione”, “Opzioni e impostazioni”.

**Output:** Aggiungere a `guida-app/core.md` (o creare `guida-app/core/02-navigazione-dashboard-opzioni.md`).

**Schema:** Stesso schema Piano §5; “Funzionalità” qui = navigazione, dashboard, opzioni.

**Dipendenze:** S1, S2 (core avviato o file 01 esistente).

---

### S4 – Core – Glossario, regole comuni, alert/form/calcoli (generale)

**Cosa fare:** Completare il Core con: glossario condiviso (termini usati in tutta l’app: tenant, terreno, lavoro, attività, modulo, abbonamento, … con definizione breve); regole comuni (es. “Solo l’admin può…”, “Il modulo X è a pagamento”, “Dati isolati per tenant”); descrizione generale di alert (cosa sono, perché ci sono, es. affitti in scadenza – rosso/giallo/verde), form e validazioni (campi obbligatori, messaggi di errore), campi e tabelle calcolate (come vengono calcolati in generale). Riferimento ambiti §1.2: “Alert e notifiche”, “Form e validazioni”, “Campi e tabelle calcolate”.

**Output:** Aggiungere a `guida-app/core.md` (o creare `guida-app/core/03-glossario-regole-alert-form.md`).

**Dipendenze:** S1, S2, S3.

---

### S5 – Terreni

**Cosa fare:** Scrivere il blocco “Terreni” della guida: creazione, modifica, eliminazione terreni; **tracciamento confini** (come si traccia il perimetro sulla mappa, vertici, superficie calcolata, validazioni); visualizzazione su mappa aziendale. Coprire anche “Zone lavorate” se legate ai terreni (dove si tracciano, da chi). Riferimento ambiti §1.2: “Terreni”, “Zone lavorate”, “Mappe”.

**Output:** Creare `guida-app/moduli/terreni.md`.

**Schema:** Piano §5 (Titolo, Scopo, Dove si trova, Funzionalità principali, Termini specifici, Limitazioni, Relazioni con altri moduli). Usare lo stesso schema per tutti i moduli.

**Dipendenze:** S1, S2 (per riferimenti a ruoli e navigazione).

---

### S6 – Lavori e attività

**Cosa fare:** Scrivere il blocco “Lavori e attività”: creazione lavori, assegnazione, stati, segnatura ore, attività collegate; flussi di completamento e approvazione; relazione con caposquadra/operai e con zone lavorate. Riferimento ambiti §1.2: “Lavori e attività”, “Zone lavorate”.

**Output:** Creare `guida-app/moduli/lavori-attivita.md`.

**Schema:** Piano §5.

**Dipendenze:** S1, S2 (e preferibilmente S5 se le zone lavorate sono descritte lì).

---

### S7 – Modulo Vigneto

**Cosa fare:** Scrivere il blocco completo del modulo Vigneto: nome e scopo, dove si trova nel menu, funzionalità principali (trattamenti, potatura, vendemmia, calcolo materiali, pianificazione impianto, statistiche, ecc.), termini specifici, limitazioni/dipendenze abbonamento, relazioni con altri moduli (es. Magazzino per prodotti, Terreni, Lavori). Riferimento ambiti §1.2 e Piano §3.2, §3.4.

**Output:** Creare `guida-app/moduli/vigneto.md`.

**Schema:** Piano §5 (tutti i punti 1–7).

**Dipendenze:** S1–S4; S5 e S6 utili per “Relazioni con altri moduli”.

---

### S8 – Modulo Frutteto

**Cosa fare:** Come S7, per il modulo Frutteto: funzionalità (trattamenti, potatura, raccolta, statistiche, …), dove si trova, termini, limitazioni, relazioni con altri moduli.

**Output:** Creare `guida-app/moduli/frutteto.md`.

**Schema:** Piano §5.

**Dipendenze:** S1–S4; S5, S6, S7 utili per relazioni.

---

### S9 – Modulo Magazzino

**Cosa fare:** Come S7, per il modulo Magazzino: prodotti, movimenti, categorie, dove si trova, termini, limitazioni, relazioni (es. con Trattamenti vigneto/frutteto, Lavori).

**Output:** Creare `guida-app/moduli/magazzino.md`.

**Schema:** Piano §5.

**Dipendenze:** S1–S4; S7, S8 utili per relazioni.

---

### S10 – Modulo Conto terzi

**Cosa fare:** Come S7, per il modulo Conto terzi: clienti, preventivi, lavori per terzi, fatturazione, tariffe, dove si trova, termini, limitazioni, relazioni (Lavori, Clienti, Terreni clienti).

**Output:** Creare `guida-app/moduli/conto-terzi.md`.

**Schema:** Piano §5.

**Dipendenze:** S1–S4; S6 utile per relazioni.

---

### S11 – Intersezioni tra moduli

**Cosa fare:** Scrivere il documento “Intersezioni tra moduli”: matrice/elenco “modulo A ↔ modulo B” (es. Magazzino ↔ Trattamenti, Lavori ↔ Manodopera, Mappe ↔ Terreni/Macchine, Conto terzi ↔ Lavori/Clienti); flussi operativi che attraversano più moduli (passi e sezioni coinvolte); ruoli nelle varie aree e nelle intersezioni. Riferimento Piano §3.4.

**Output:** Creare `guida-app/intersezioni-moduli.md`.

**Dipendenze:** Meglio dopo aver completato almeno S5–S10, così le intersezioni sono coerenti con i moduli già descritti.

---

## Come usare la checklist con un nuovo agente

1. **Scegli la sezione** dalla tabella “Checklist sezioni” (es. S7 – Modulo Vigneto).
2. **Imposta lo stato** a “in corso” (es. `[~] in corso` per S7).
3. **Assegna all’agente** con un messaggio tipo:

   > Devi implementare la sezione **S7 – Modulo Vigneto** della guida app.
   > - Riferimenti: leggi `docs-sviluppo/PIANO_GUIDA_APP_ASSISTENTE.md` (in particolare §3.2, §5 e §1.2 Ambito di copertura) e `docs-sviluppo/CHECKLIST_SEZIONI_GUIDA_APP.md` (blocco “S7 – Modulo Vigneto”).
   > - Output: crea il file `docs-sviluppo/guida-app/moduli/vigneto.md`.
   > - Contenuto: blocco completo del modulo Vigneto seguendo lo schema §5 del Piano (Titolo, Scopo, Dove si trova, Funzionalità principali, Termini specifici, Limitazioni, Relazioni con altri moduli). Copri tutte le funzionalità del modulo nell’app (trattamenti, potatura, vendemmia, calcolo materiali, pianificazione, statistiche, ecc.) e gli ambiti di copertura rilevanti (form, alert, calcoli dove applicabile).
   > - Non inventare: descrivi solo ciò che esiste nell’app (usa il codice o la documentazione esistente se necessario).

4. **Dopo la consegna:** verifica il file, aggiorna l’indice `guida-app/README.md` se serve (link a `moduli/vigneto.md`), e imposta lo stato della sezione a `[x] fatto`.

---

## Estensioni future

- **Nuovo modulo app:** Aggiungi una riga nella tabella “Ordine di implementazione” e “Checklist sezioni”, con un blocco “Istruzioni per sezione” (stesso schema S7–S10). Dipendenze: S1–S4; altre sezioni moduli utili per “Relazioni”.
- **Nuova sezione core:** Se dividi il core in più file (es. core/01-..., 02-..., 03-...), aggiungi le voci corrispondenti nella checklist e nell’ordine.

---

**Ultimo aggiornamento checklist:** 2026-02-03 — Sezioni S1–S11 completate.
