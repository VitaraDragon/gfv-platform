# Linea guida – Responsive e architettura pagine standalone

**Versione**: 1.1  
**Data**: 2026-03-18  
**Scopo**: Documento di riferimento per allineare le pagine standalone (e i moduli) a un sistema responsive e a un’architettura condivisa. Da seguire per le pagine esistenti e per le prossime sviluppate.

**Stato attuale**: Il sistema in uso è **CSS centralizzato** (`core/styles/responsive-standalone.css`) con tutte le pagine standalone collegate. I moduli JS condivisi (tabella, filtri, modal) sono previsti come **fase successiva** e non sono ancora implementati; il responsive è ottenuto tramite classi e media query. Nuove pagine devono includere da subito il CSS condiviso e la classe `table-responsive` dove serve.

---

## 1. Obiettivo

- **Responsive uniforme** su smartphone e tablet per tutte le pagine standalone (core e moduli).
- **Codice centralizzato**: stessi breakpoint, stesse regole di layout e comportamento in un unico posto (CSS condiviso + moduli JS).
- **Allineamento all’architettura esistente**: configurazione e componenti condivisi, niente duplicazione, nuove pagine che “usano il sistema”.
- **Aspetto e funzionalità invariati**: colori, tabelle, filtri, modal e logica restano quelli attuali; cambia solo dove e come sono definiti (centralizzati e riutilizzabili).

---

## 2. Cosa abbiamo deciso

### 2.1 Breakpoint condivisi

Utilizzare **tre livelli** su tutte le pagine:

| Breakpoint | Uso |
|------------|-----|
| **1024px** | Tablet / desktop stretto: layout a 2 colonne dove ha senso, padding leggermente ridotti. |
| **768px** | Tablet portrait / smartphone landscape: header a blocchi, filtri in colonna, tabella gestita (scroll o card), stats a 2 colonne, padding ridotti, modal adattati. |
| **480px** | Smartphone: stats a 1 colonna, pulsanti a tutta larghezza, padding minimi. |

### 2.2 Regole comuni (per ogni breakpoint)

- **Container / content**: padding ridotti progressivamente (es. 20px → 12px → 8px).
- **Header**: in colonna da 768px in giù; pulsanti/azioni a tutta larghezza sotto 480px.
- **Filtri**: in colonna da 768px; select/input senza min-width fisso che blocchi il layout.
- **Tabelle**:  
  - **Opzione A** – Scroll orizzontale: wrapper con `overflow-x: auto`, tabella con `min-width` adeguato.  
  - **Opzione B** – Layout a card: su mobile ogni riga diventa una card (grid 1fr + etichette tipo `data-label`). Preferibile per usabilità su smartphone quando la tabella ha molte colonne.
- **Stats grid** (dove presente): 2 colonne a 768px, 1 colonna a 480px.
- **Modal**: larghezza percentuale e padding ridotti su 768px e 480px.
- **Touch**: aree cliccabili adeguate (es. min ~44px), spaziatura tra azioni; evitare azioni solo hover sugli elementi critici.

### 2.3 CSS centralizzato

- **Un foglio condiviso** (o una cartella `styles/` dedicata) che definisce:
  - Breakpoint (1024, 768, 480).
  - Classi comuni: container, header, content, filtri, stats-grid, wrapper tabella (es. `.table-responsive`), modal.
- Le pagine **includono** questo CSS e **usano le stesse classi**; eventuali override sono minimi e specifici (es. colore modulo, nome tabella).
- **Niente** (o pochissimo) responsive inline negli `<style>` di ogni HTML.

### 2.4 JS modulare condiviso (fase successiva, opzionale)

- **Moduli JS** per comportamenti ripetuti sono previsti dalla guida ma **non sono ancora implementati**. Quando e se verranno introdotti, potranno coprire:
  - Wrapper/gestione tabella (scroll, eventuale card layout).
  - Filtri (costruzione barra, sync con URL se usato).
  - Modal (apertura/chiusura, focus, accessibilità).
- **Oggi** il responsive è gestito solo dal CSS (classi, media query); le pagine mantengono la propria logica JS per tabelle, filtri e modal. Valutare l’introduzione di moduli JS condivisi in occasione di refactoring di liste, filtri o modal, quando la duplicazione diventa un problema reale.
- Il **responsive visivo** (media query, padding, colonne) resta in CSS; un eventuale JS condiviso gestirebbe solo **comportamenti** comuni.

### 2.5 Convenzioni

- **Nomi classi** e **struttura HTML** delle liste (container → filtri → contenuto) definiti e documentati in §6.
- **Nomi file** condivisi (es. `responsive-standalone.css`, `table-standalone.js`, ecc.) sarebbero indicati qui se e quando introdotti. File condiviso attuale: `core/styles/responsive-standalone.css`. Nomi e path in questa linea guida (o in un file “Come usare il sistema”).
- Le **nuove standalone** devono usare da subito il **CSS condiviso** e la classe `table-responsive` dove c'è una tabella; i moduli JS si applicano solo quando/se verranno sviluppati.

---

## 3. Fasi di implementazione

### Fase A – Base

1. ✅ Creare il **CSS centralizzato** con breakpoint e classi comuni.
2. **Fase successiva (opzionale)**: Creare i moduli JS minimi (wrapper tabella, filtri, modal) e farli usare da una pagina pilota; da valutare in occasione di refactoring.
3. **Verifica manuale**: Controllare la pilota (e eventualmente altre pagine) su desktop, tablet e smartphone.
4. ✅ Aggiornare questa linea guida con le istruzioni d’uso (§6).

### Fase B – Allineare le pagine core

1. ✅ Far adottare il CSS condiviso a: Dashboard, Terreni, Gestione Macchine.
2. ✅ Rimuovere o ridurre media query duplicate.
3. Controllo rapido su smartphone e tablet (a mano).

### Fase C – Estendere ai moduli

1. ✅ Applicare il CSS condiviso a home, liste, form, statistiche/report e a tutte le altre standalone.
2. Ogni **nuova pagina** o **nuovo modulo** include da subito `responsive-standalone.css` e la classe `table-responsive` dove serve.

### Fase D – Manutenzione

- Modifiche a breakpoint o regole comuni: solo in `responsive-standalone.css`.
- Nuove pagine: includono il CSS condiviso e implementano solo la logica specifica.
- Se in futuro si introducono moduli JS condivisi, aggiornare questa guida e le convenzioni (§2.4, §2.5).

---

## 4. Cosa non cambia

- **Colori** di pagina, header, pulsanti, card, badge.
- **Aspetto** delle tabelle (colonne, intestazioni, stile righe, azioni).
- **Funzionalità** (filtri, click, salvataggio, modal, logica di business).
- **Contenuti** (testi, link, form, campi).

Si centralizza e si riusa il codice; il risultato visivo e funzionale resta **identico** a oggi.

---

## 5. Allineamento con l’architettura dell’app

Questo approccio è coerente con:

- **Configurazione al centro** (es. `tony-form-mapping.js`): un solo posto per la definizione dei form e dei comportamenti.
- **Niente patch locali**: niente `if (formId === '...')` nelle pagine; si usa il sistema condiviso.
- **Servizi e contesto condivisi**: Firebase, Context Builder, servizi riusati dai moduli.
- **Estensibilità**: nuove funzionalità e pagine si agganciano al sistema invece di duplicare codice.

Centralizzare responsive, tabelle, filtri e modal in CSS e moduli JS **allinea anche questa parte** all’architettura esistente: un solo posto per regole e comportamenti, pagine che consumano il sistema, estensione tramite configurazione e componenti comuni.

---

## 6. Come usare il sistema (Fase A attiva)

### File condivisi

- **CSS responsive**: `core/styles/responsive-standalone.css`  
  Contiene solo media query (1024, 768, 480) e regole per le classi comuni. Nessuno stile di base (colori, font): quelli restano nella singola pagina o in altri CSS.

### Inclusione nelle pagine

1. Nel `<head>` della pagina standalone, dopo gli altri CSS (es. tour.css), aggiungere:
   ```html
   <link rel="stylesheet" href="../styles/responsive-standalone.css">
   ```
   (aggiustare il path se la pagina è in `core/`, `core/admin/`, `modules/.../views/`.)

2. Struttura HTML da rispettare (con le classi che il CSS condiviso si aspetta):
   - `.container` sul wrapper principale
   - `.header` per l’intestazione, con `.header-actions` per pulsanti/link
   - `.content` per l’area sotto l’header
   - `.filters` e `.filter-group` per la barra filtri
   - `.stats-grid` e `.stat-card` per le card statistiche (se presenti)
   - Per le tabelle con scroll orizzontale su mobile: aggiungere la classe **`table-responsive`** al div che contiene la `<table>` (es. il div che oggi ha solo `id="lavori-container"` diventa `id="lavori-container" class="table-responsive"`).
   - `.modal-content` per i modal (il foglio condiviso ne riduce larghezza e padding su 768/480).

3. **Rimuovere** dalla pagina le media query duplicate (breakpoint 768 e 480) già coperte da `responsive-standalone.css`. Tenere negli `<style>` della pagina solo:
   - stili specifici (colori modulo, classi tabelle tipo `.lavori-table`, `.macchine-table`),
   - eventuali override necessari per quella vista.

### Pagine collegate (Fase A + B + C)

- **Core**: Gestione Lavori, Dashboard, Terreni, Gestione Macchine (vedi Fase A/B).
- **Conto terzi**: `conto-terzi-home-standalone.html`, `clienti-standalone.html`, `preventivi-standalone.html` (link + `table-responsive` dove c’è tabella).
- **Magazzino**: `magazzino-home-standalone.html`, `prodotti-standalone.html`, `movimenti-standalone.html`.
- **Vigneto**: `vigneto-dashboard-standalone.html`, `vigneti-standalone.html` (.table-container.table-responsive).
- **Frutteto**: `frutteto-dashboard-standalone.html`, `frutteti-standalone.html` (.table-container.table-responsive).
- **Parco Macchine (modulo)**: `macchine-dashboard-standalone.html`, `flotta-list-standalone.html`, `trattori-list-standalone.html`, `attrezzi-list-standalone.html`, `guasti-list-standalone.html`, `scadenze-list-standalone.html` (link + `table-responsive` su id="table-container" dove presente).
- **Priorità alta (aggiunte successive)**: `attivita-standalone.html` (Diario), `segnatura-ore-standalone.html`, `impostazioni-standalone.html`, `gestione-operai-standalone.html`, `gestione-squadre-standalone.html`, `nuovo-preventivo-standalone.html`, `segnalazione-guasti-standalone.html`, `validazione-ore-standalone.html`, `gestione-guasti-standalone.html`.
- **Priorità media**: `vendemmia-standalone.html`, potatura e trattamenti (vigneto e frutteto), `raccolta-frutta-standalone.html`, `tariffe-standalone.html`, `terreni-clienti-standalone.html`, `lavori-caposquadra-standalone.html`.
- **Completamento**: tutte le altre standalone collegate allo stesso CSS: **core** `statistiche-standalone.html`; **core/admin** report, amministrazione, compensi-operai, statistiche-manodopera, abbonamento, gestisci-utenti; **core/auth** login, registrazione, registrazione-invito, reset-password; **modules** vigneto-statistiche, frutteto-statistiche, mappa-clienti, accetta-preventivo, calcolo-materiali, pianifica-impianto; **modules/report** report-standalone. Ogni nuova pagina standalone deve includere da subito `responsive-standalone.css`.

---

## 7. Riferimenti

- Analisi responsive: confronto tra Gestione Lavori, Gestione Macchine, Terreni, Dashboard (discussione 2026-03-18).
- Architettura Tony e Master Plan: `docs-sviluppo/tony/MASTER_PLAN.md`.
- Regole progetto: configurazione > codice, no local patches, global mobility.

---

*Documento creato come linea guida da seguire per responsive e architettura delle pagine standalone. Aggiornare quando si introducono nuovi file condivisi (CSS/JS) o si cambiano le convenzioni.*
